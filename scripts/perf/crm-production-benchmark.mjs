#!/usr/bin/env node

import path from "node:path";
import { chromium } from "@playwright/test";
import {
  DEFAULT_BASE_URL,
  ROUTE_BUDGETS,
  evaluateRouteBudgets,
  intArg,
  parseArgs,
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
const settleMs = intArg(args, "settle-ms", 500);

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

async function measureRoute(page, route) {
  const startedAt = performance.now();
  try {
    const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.locator("body").waitFor({ state: "visible", timeout: 5000 }).catch(() => null);
    if (settleMs > 0) {
      await page.waitForTimeout(settleMs);
    }
    const durationMs = Math.round(performance.now() - startedAt);
    const browserTiming = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      if (!nav) return null;
      return {
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
        loadEventMs: Math.round(nav.loadEventEnd),
        responseStartMs: Math.round(nav.responseStart),
      };
    }).catch(() => null);
    return {
      path: route.path,
      role: route.role ?? "admin",
      status: response?.status() ?? 0,
      url: page.url(),
      durationMs,
      browserTiming,
    };
  } catch (error) {
    return {
      path: route.path,
      role: route.role ?? "admin",
      status: 0,
      url: page.url(),
      durationMs: Math.round(performance.now() - startedAt),
      browserTiming: null,
      error: String(error?.message ?? error).split("\n")[0],
    };
  }
}

const browser = await chromium.launch();

try {
  const warmups = [];
  const results = [];

  async function benchmarkRole(role, credentials) {
    const routes = ROUTE_BUDGETS.filter((route) => route.role === role);
    if (routes.length === 0) return;

    const context = await browser.newContext();
    try {
      const loginPage = await context.newPage();
      await login(loginPage, credentials);
      await loginPage.close();

      for (const route of routes) {
        const page = await context.newPage();
        warmups.push(await measureRoute(page, route));
        await page.close();
      }

      for (const route of routes) {
        const samples = [];
        for (let i = 0; i < iterations; i += 1) {
          const page = await context.newPage();
          samples.push(await measureRoute(page, route));
          await page.close();
        }
        results.push({ ...route, samples });
        console.log(`[crm:perf:benchmark] ${role} ${route.path} ${samples.map((sample) => `${sample.durationMs}ms`).join(", ")}`);
      }
    } finally {
      await context.close();
    }
  }

  await benchmarkRole("admin", adminCredentials);
  await benchmarkRole("engineer", engineerCredentials);

  const evaluated = evaluateRouteBudgets(results);
  const payload = {
    capturedAt: new Date().toISOString(),
    baseUrl,
    tenant: manifest?.tenant ?? null,
    iterations,
    warmups,
    routes: evaluated,
    passed: evaluated.every((route) => route.passed),
  };
  const proofDir = proofDirForManifest(manifest);
  writeJson(path.join(proofDir, "benchmark.json"), payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = payload.passed ? 0 : 1;
} finally {
  await browser.close();
}
