#!/usr/bin/env node

import path from "node:path";
import { chromium } from "@playwright/test";
import {
  DEFAULT_BASE_URL,
  ROUTE_BUDGETS,
  intArg,
  parseArgs,
  percentile,
  proofDirForManifest,
  readLatestManifest,
  writeJson,
} from "./crm-performance-proof-lib.mjs";

const args = parseArgs(process.argv.slice(2));
const manifest = readLatestManifest();
const baseUrl = (args.values.baseUrl ?? process.env.CRM_PERF_BASE_URL ?? manifest?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
const adminCredentials = {
  email: args.values.email ?? process.env.CRM_PERF_ADMIN_EMAIL ?? manifest?.auth?.admin?.email ?? manifest?.auth?.email,
  password:
    args.values.password ?? process.env.CRM_PERF_ADMIN_PASSWORD ?? manifest?.auth?.admin?.password ?? manifest?.auth?.password,
};
const engineerCredentials = {
  email:
    args.values.engineerEmail ??
    process.env.CRM_PERF_ENGINEER_EMAIL ??
    manifest?.auth?.engineer?.email ??
    adminCredentials.email,
  password:
    args.values.engineerPassword ??
    process.env.CRM_PERF_ENGINEER_PASSWORD ??
    manifest?.auth?.engineer?.password ??
    adminCredentials.password,
};
const iterations = intArg(args, "iterations", 5);
const shellBudgetMs = intArg(args, "shell-budget-ms", 500);

if (!adminCredentials.email || !adminCredentials.password) {
  throw new Error("Missing benchmark credentials. Run crm:perf:seed first or pass --email/--password.");
}
if (!engineerCredentials.email || !engineerCredentials.password) {
  throw new Error("Missing engineer benchmark credentials. Run crm:perf:seed first or pass --engineerEmail/--engineerPassword.");
}

async function login(page, credentials) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await Promise.race([
    page.waitForURL(/\/dashboard/, { waitUntil: "domcontentloaded", timeout: 60000 }),
    page.getByText(/Dashboard|Today|Leads|Jobs/i).first().waitFor({ state: "visible", timeout: 60000 }),
  ]);
}

function summarize(values) {
  return {
    count: values.length,
    minMs: Math.min(...values),
    maxMs: Math.max(...values),
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
  };
}

async function clickRoute(page, route) {
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible", timeout: 5000 });

  const startedAt = performance.now();
  const pendingPromise = page
    .locator('[data-crm-navigation-pending="true"]')
    .waitFor({ state: "attached", timeout: 750 })
    .then(() => true)
    .catch(() => false);

  const link = page.locator(`a[href="${route.path}"]`).first();
  await link.waitFor({ state: "visible", timeout: 10000 });
  await link.click();

  await page.waitForURL(new RegExp(`${route.path.replaceAll("/", "\\/")}(\\?.*)?$`), {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  const shellMs = Math.round(performance.now() - startedAt);
  const pendingIndicatorSeen = await pendingPromise;

  await page.locator('[data-crm-screen-ready="true"]').first().waitFor({ state: "attached", timeout: 45000 });
  const readyMs = Math.round(performance.now() - startedAt);

  return {
    path: route.path,
    role: route.role,
    shellMs,
    readyMs,
    pendingIndicatorSeen,
    url: page.url(),
  };
}

const browser = await chromium.launch();

try {
  const results = [];

  async function benchmarkRole(role, credentials) {
    const routes = ROUTE_BUDGETS.filter((route) => route.role === role);
    if (routes.length === 0) return;

    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await login(page, credentials);

      for (const route of routes) {
        const samples = [];
        for (let i = 0; i < iterations; i += 1) {
          try {
            samples.push(await clickRoute(page, route));
          } catch (error) {
            samples.push({
              path: route.path,
              role: route.role,
              shellMs: 999999,
              readyMs: 999999,
              pendingIndicatorSeen: false,
              url: page.url(),
              error: String(error?.message ?? error).split("\n")[0],
            });
          }
        }
        console.log(
          `[crm:perf:transitions] ${role} ${route.path} shell=${samples.map((sample) => `${sample.shellMs}ms`).join(", ")} ready=${samples.map((sample) => `${sample.readyMs}ms`).join(", ")}`,
        );
        results.push({
          ...route,
          shellBudgetMs,
          samples,
        });
      }
    } finally {
      await context.close();
    }
  }

  await benchmarkRole("admin", adminCredentials);
  await benchmarkRole("engineer", engineerCredentials);

  const routes = results.map((route) => {
    const shell = summarize(route.samples.map((sample) => sample.shellMs));
    const ready = summarize(route.samples.map((sample) => sample.readyMs));
    const statusOk = route.samples.every((sample) => !sample.error);
    const shellOk = shell.p95Ms <= route.shellBudgetMs;
    const readyOk = ready.p95Ms <= route.thresholdMs;
    const passed = statusOk && shellOk && readyOk;
    return {
      ...route,
      shell,
      ready,
      passed,
      failure: passed
        ? null
        : !statusOk
          ? "one or more transition samples failed"
          : !shellOk
            ? `shell p95 ${shell.p95Ms}ms exceeded ${route.shellBudgetMs}ms`
            : `ready p95 ${ready.p95Ms}ms exceeded ${route.thresholdMs}ms`,
    };
  });

  const payload = {
    capturedAt: new Date().toISOString(),
    baseUrl,
    tenant: manifest?.tenant ?? null,
    iterations,
    routes,
    passed: routes.every((route) => route.passed),
  };
  const proofDir = proofDirForManifest(manifest);
  writeJson(path.join(proofDir, "transition-benchmark.json"), payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = payload.passed ? 0 : 1;
} finally {
  await browser.close();
}
