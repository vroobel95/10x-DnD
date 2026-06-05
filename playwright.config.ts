import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

// Load .env.e2e so credentials are available without manually exporting env vars.
if (existsSync(".env.e2e")) {
  for (const line of readFileSync(".env.e2e", "utf-8").split(/\r?\n/)) {
    const m = /^([^#=\s][^=]*)=(.*)$/.exec(line);
    if (m) process.env[m[1].trim()] ??= m[2].trim();
  }
}

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4321",
    trace: "on-first-retry",
  },
  projects: [
    // Runs global.setup.ts once — logs in and saves cookies to .auth/state.json.
    // Uses msedge so no separate Playwright browser download is needed on Windows.
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
    {
      name: "msedge",
      use: {
        ...devices["Desktop Edge"],
        channel: "msedge",
        // Auth is injected from saved state — no UI login per test
        storageState: "tests/e2e/.auth/state.json",
      },
      dependencies: ["setup"],
    },
  ],
});
