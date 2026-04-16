import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // Load .env.local so Supabase credentials are available without
    // needing to manually export them before running.
    setupFiles: ["tests/integration/setup-env.ts"],
    // Give real network calls more time than unit tests
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
