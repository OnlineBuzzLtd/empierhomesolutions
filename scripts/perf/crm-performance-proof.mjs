#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildMarkdownReport,
  proofDirForManifest,
  readJsonIfExists,
  readLatestManifest,
  writeJson,
} from "./crm-performance-proof-lib.mjs";

const manifest = readLatestManifest();
if (!manifest) {
  throw new Error("No performance proof manifest found. Run npm run crm:perf:seed first.");
}

function runStep(label, script) {
  console.log(`[crm:perf:proof] ${label}`);
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? 1;
}

const benchmarkStatus = runStep("running authenticated route benchmark", "scripts/perf/crm-production-benchmark.mjs");
const transitionStatus = runStep("running authenticated transition benchmark", "scripts/perf/crm-transition-benchmark.mjs");
const explainStatus = runStep("running database explain audit", "scripts/perf/crm-db-explain.mjs");

const proofDir = proofDirForManifest(manifest);
const benchmark = readJsonIfExists(path.join(proofDir, "benchmark.json"));
const transitions = readJsonIfExists(path.join(proofDir, "transition-benchmark.json"));
const explain = readJsonIfExists(path.join(proofDir, "explain.json"));
const errors = [];
if (benchmarkStatus !== 0) errors.push(`route benchmark command exited with ${benchmarkStatus}`);
if (transitionStatus !== 0) errors.push(`transition benchmark command exited with ${transitionStatus}`);
if (explainStatus !== 0) errors.push(`database explain command exited with ${explainStatus}`);
if (!benchmark) errors.push("route benchmark did not write benchmark.json");
if (!transitions) errors.push("transition benchmark did not write transition-benchmark.json");
if (!explain) errors.push("database explain did not write explain.json");

const payload = {
  capturedAt: new Date().toISOString(),
  baseUrl: benchmark?.baseUrl ?? manifest.baseUrl,
  tenant: manifest.tenant,
  counts: manifest.counts,
  routes: benchmark?.routes ?? [],
  transitions: transitions?.routes ?? [],
  queries: explain?.queries ?? [],
  errors,
  passed: Boolean(
    benchmark?.passed &&
      transitions?.passed &&
      explain?.passed &&
      benchmarkStatus === 0 &&
      transitionStatus === 0 &&
      explainStatus === 0,
  ),
};

writeJson(path.join(proofDir, "proof-summary.json"), payload);
fs.writeFileSync(path.join(proofDir, "REPORT.md"), buildMarkdownReport(payload));
console.log(`[crm:perf:proof] wrote ${path.join(proofDir, "REPORT.md")}`);
process.exitCode = payload.passed ? 0 : 1;
