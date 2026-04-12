import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    cwd: process.cwd(),
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      ...process.env,
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
      NEXT_PUBLIC_CALL_NUMBER: "01895 725 151",
      FORM_WEBHOOK_URL: "http://127.0.0.1:3000/api/mock-webhook",
      CONVERSION_API_SECRET: "dev-conversion-secret",
      NEXT_PUBLIC_CALL_NUMBER_RULES: '{"default":"01895 725 151","googleRepair":"01895 725 151"}',
      NEXT_PUBLIC_LP_AB_FLAGS: '{"headline":"control","cta":"call-now","trustOrder":"default"}',
      CRM_E2E_PLATFORM_FIXTURES: "1",
    },
  },
});
