import fs from "node:fs";
import path from "node:path";

export const DEFAULT_BASE_URL = "https://empire-home-solutions.vercel.app";
export const DEFAULT_THRESHOLDS_MS = {
  hotList: 1500,
  operational: 2000,
  reports: 2500,
};

export const ROUTE_BUDGETS = [
  { path: "/dashboard", group: "operational", role: "admin", thresholdMs: DEFAULT_THRESHOLDS_MS.operational },
  { path: "/jobs", group: "hotList", role: "admin", thresholdMs: DEFAULT_THRESHOLDS_MS.hotList },
  { path: "/leads", group: "hotList", role: "admin", thresholdMs: DEFAULT_THRESHOLDS_MS.hotList },
  { path: "/customers", group: "hotList", role: "admin", thresholdMs: DEFAULT_THRESHOLDS_MS.hotList },
  { path: "/quotes", group: "hotList", role: "admin", thresholdMs: DEFAULT_THRESHOLDS_MS.hotList },
  { path: "/invoices", group: "hotList", role: "admin", thresholdMs: DEFAULT_THRESHOLDS_MS.hotList },
  { path: "/calendar", group: "operational", role: "admin", thresholdMs: DEFAULT_THRESHOLDS_MS.operational },
  { path: "/diary", group: "operational", role: "engineer", thresholdMs: DEFAULT_THRESHOLDS_MS.operational },
  { path: "/reports", group: "reports", role: "admin", thresholdMs: DEFAULT_THRESHOLDS_MS.reports },
];

export function percentile(values, percentileValue) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
}

export function summarizeSamples(samples) {
  const durations = samples.map((sample) => sample.durationMs);
  return {
    count: durations.length,
    minMs: Math.min(...durations),
    maxMs: Math.max(...durations),
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
  };
}

export function evaluateRouteBudgets(routeResults) {
  return routeResults.map((result) => {
    const summary = summarizeSamples(result.samples);
    const statusesOk = result.samples.every((sample) => sample.status >= 200 && sample.status < 400);
    const passed = statusesOk && summary.p95Ms <= result.thresholdMs;
    return {
      ...result,
      summary,
      passed,
      failure: passed
        ? null
        : summary.p95Ms > result.thresholdMs
          ? `p95 ${summary.p95Ms}ms exceeded ${result.thresholdMs}ms`
          : "one or more route samples returned an error status or navigation failure",
    };
  });
}

function walkPlanNodes(node, visitor) {
  if (!node || typeof node !== "object") return;
  visitor(node);
  for (const child of node.Plans ?? []) {
    walkPlanNodes(child, visitor);
  }
}

export function hasSequentialScanOnTables(plan, tableNames) {
  const tableSet = new Set(tableNames);
  let found = false;
  walkPlanNodes(plan, (node) => {
    if (node["Node Type"] === "Seq Scan" && tableSet.has(node["Relation Name"])) {
      found = true;
    }
  });
  return found;
}

export function evaluateExplainBudgets(results) {
  return results.map((result) => {
    const durationOk = result.executionTimeMs <= result.thresholdMs;
    const scanOk = !result.disallowSeqScan || !hasSequentialScanOnTables(result.plan, result.disallowSeqScan);
    const passed = durationOk && scanOk;
    return {
      ...result,
      passed,
      failure: passed
        ? null
        : !durationOk
          ? `execution ${result.executionTimeMs}ms exceeded ${result.thresholdMs}ms`
          : `sequential scan detected on ${result.disallowSeqScan.join(", ")}`,
    };
  });
}

export function parseArgs(argv) {
  const parsed = { flags: new Set(), values: {} };
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [rawKey, rawValue] = arg.slice(2).split("=");
    if (rawValue === undefined) {
      parsed.flags.add(rawKey);
    } else {
      parsed.values[rawKey] = rawValue;
    }
  }
  return parsed;
}

export function intArg(args, key, fallback) {
  const value = Number.parseInt(args.values[key] ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function nowStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
}

export function ensureProofDir(stamp = nowStamp()) {
  const dir = path.join(process.cwd(), "docs", "private", "performance-proof", stamp);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function proofStampFromManifest(manifest, fallback = nowStamp()) {
  return manifest?.proofStamp ?? manifest?.stamp ?? fallback;
}

export function proofDirForManifest(manifest, fallback = nowStamp()) {
  return ensureProofDir(proofStampFromManifest(manifest, fallback));
}

export function readLatestManifest() {
  const root = path.join(process.cwd(), "docs", "private", "performance-proof");
  if (!fs.existsSync(root)) return null;
  const manifests = [];
  const dirs = fs.readdirSync(root);
  for (const dir of dirs) {
    const manifestPath = path.join(root, dir, "manifest.json");
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      manifests.push({
        ...manifest,
        proofStamp: manifest.proofStamp ?? manifest.stamp ?? dir,
        manifestSortKey: manifest.createdAt ?? manifest.stamp ?? dir,
      });
    }
  }
  manifests.sort((a, b) => String(b.manifestSortKey).localeCompare(String(a.manifestSortKey)));
  return manifests[0] ?? null;
}

export function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

export function buildMarkdownReport(input) {
  const errors = input.errors ?? [];
  const routeLines = input.routes.map((route) => (
    `| \`${route.path}\` | ${route.role ?? "admin"} | ${route.summary.p50Ms} | ${route.summary.p95Ms} | ${route.thresholdMs} | ${route.passed ? "PASS" : `FAIL: ${route.failure}`} |`
  ));
  const transitionLines = (input.transitions ?? []).map((route) => (
    `| \`${route.path}\` | ${route.role ?? "admin"} | ${route.shell.p95Ms} | ${route.shellBudgetMs} | ${route.ready.p95Ms} | ${route.thresholdMs} | ${route.passed ? "PASS" : `FAIL: ${route.failure}`} |`
  ));
  const queryLines = input.queries.map((query) => (
    `| ${query.name} | ${query.executionTimeMs} | ${query.thresholdMs} | ${query.passed ? "PASS" : `FAIL: ${query.failure}`} |`
  ));

  return `# CRM Performance Proof

Captured: ${input.capturedAt}
Deployment: ${input.baseUrl}
Tenant: ${input.tenant.slug} (${input.tenant.id})

## Data Volume

| Entity | Rows |
| --- | ---: |
${Object.entries(input.counts).map(([key, value]) => `| ${key} | ${value} |`).join("\n")}

## Route Budgets

| Route | Role | p50 ms | p95 ms | Budget ms | Result |
| --- | --- | ---: | ---: | ---: | --- |
${routeLines.join("\n")}

## Screen Transition Budgets

| Route | Role | Shell p95 ms | Shell budget ms | Data-ready p95 ms | Data-ready budget ms | Result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
${transitionLines.length > 0 ? transitionLines.join("\n") : "| n/a | n/a | 0 | 0 | 0 | 0 | NOT RUN |"}

## Database Query Budgets

| Query | Execution ms | Budget ms | Result |
| --- | ---: | ---: | --- |
${queryLines.join("\n")}

${errors.length > 0 ? `## Proof Errors\n\n${errors.map((error) => `- ${error}`).join("\n")}\n\n` : ""}
## Result

${input.passed ? "PASS: all CRM performance proof budgets passed." : "FAIL: one or more CRM performance proof budgets failed."}
`;
}
