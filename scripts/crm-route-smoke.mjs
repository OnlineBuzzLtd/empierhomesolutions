import { getCrmScriptConfig } from "./crm-env.mjs";

const { baseUrl } = getCrmScriptConfig();

if (!baseUrl) {
  throw new Error("Missing CRM_BASE_URL or NEXT_PUBLIC_SITE_URL for route smoke checks.");
}

const publicChecks = [
  {
    path: "/login",
    expectedStatus: 200,
    mustContain: ["Sign in to your workspace", "Sign In"],
  },
  {
    path: "/signup",
    expectedStatus: 200,
    mustContain: ["Create your workspace", "Create Workspace"],
  },
];

const protectedRouteChecks = [
  "/dashboard",
  "/leads",
  "/customers",
  "/jobs",
  "/calendar",
  "/quotes",
  "/invoices",
  "/staff",
  "/reports",
  "/settings",
];

const protectedApiChecks = [
  { path: "/api/crm/reports/summary", method: "GET" },
  { path: "/api/crm/attachments/upload", method: "POST", body: new FormData() },
];

if (process.env.CRM_DEMO_SMOKE === "1") {
  protectedApiChecks.push(
    { path: "/api/crm/demo/start", method: "POST" },
    { path: "/api/crm/demo/stop", method: "POST" },
  );
}

function logPass(message) {
  console.log(`PASS ${message}`);
}

function logFail(message) {
  console.error(`FAIL ${message}`);
}

let failed = false;

for (const check of publicChecks) {
  const response = await fetch(`${baseUrl}${check.path}`, {
    headers: { Accept: "text/html" },
    redirect: "manual",
  });
  const body = await response.text();

  if (response.status !== check.expectedStatus) {
    failed = true;
    logFail(`${check.path} expected ${check.expectedStatus}, got ${response.status}`);
    continue;
  }

  const missing = check.mustContain.filter((text) => !body.includes(text));
  if (missing.length > 0) {
    failed = true;
    logFail(`${check.path} missing text: ${missing.join(", ")}`);
    continue;
  }

  logPass(`${check.path} returned ${response.status}`);
}

for (const path of protectedRouteChecks) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: "text/html" },
    redirect: "manual",
  });
  const location = response.headers.get("location") ?? "";

  if (![302, 303, 307, 308].includes(response.status) || !location.includes("/login")) {
    failed = true;
    logFail(`${path} did not redirect to login correctly. status=${response.status} location=${location}`);
    continue;
  }

  logPass(`${path} redirects to login`);
}

for (const check of protectedApiChecks) {
  const response = await fetch(`${baseUrl}${check.path}`, {
    method: check.method,
    body: check.body,
    redirect: "manual",
  });

  if (response.status !== 401) {
    failed = true;
    logFail(`${check.method} ${check.path} expected 401, got ${response.status}`);
    continue;
  }

  logPass(`${check.method} ${check.path} rejects unauthenticated access`);
}

if (failed) {
  process.exit(1);
}
