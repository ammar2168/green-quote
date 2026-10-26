import { defineConfig, devices } from "@playwright/test";

import { testDatabaseUrl } from "./e2e/support/test-database";

/**
 * Away from `pnpm dev` (3000, or 3100 from .claude/launch.json). `E2E_PORT`
 * moves it, for a second run alongside one in `--ui` mode (pair it with its
 * own `E2E_DATABASE_URL`, or the two runs drop each other's database).
 */
const PORT = Number(process.env.E2E_PORT ?? 3200);
const BASE_URL = `http://localhost:${PORT}`;

/**
 * End-to-end tests against a production build of the app, backed by a
 * throwaway Postgres database (see `e2e/support/test-database.ts`).
 *
 *   pnpm test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  // Each worker is a Chromium plus a scrypt sign-in on the one server. More
  // than two starve a busy laptop until sign-in outlasts the test timeout.
  workers: process.env.CI ? 1 : 2,
  // A whole journey (sign in, save a quote, read it back) on a production
  // build; the 30 s default leaves no headroom on a loaded machine.
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Sign-in runs scrypt (32 MiB per hash), which takes seconds when the
  // machine is busy; the default 5 s is too tight for it.
  expect: { timeout: 20_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: BASE_URL,
    // Never reuse: a server already on this port could be talking to the
    // development database instead of the test one.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: testDatabaseUrl(),
      // Fixed so the suite runs without a configured .env secret; it only
      // ever signs cookies for the throwaway database's users.
      SESSION_SECRET: "e2e-only-session-secret-not-for-real-use",
    },
  },
});
