import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Tests that need log output assert on a logger of their own.
    env: { LOG_LEVEL: "silent" },
    // Playwright specs, run by `pnpm test:e2e` instead.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
