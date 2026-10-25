import { defineConfig } from "@playwright/test";
import { spawnSync } from "node:child_process";

// Nix's Chromium includes its shared libraries; downloaded Linux builds do not.
// Other hosts use Playwright's installed browser when no system Chromium exists.
const systemChromium = spawnSync("which", ["chromium"], { encoding: "utf8" });
const executablePath = systemChromium.status === 0 ? systemChromium.stdout.trim() : undefined;

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "generated-artifacts/test-results",
  use: {
    baseURL: "http://127.0.0.1:5011",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "api", testMatch: /api.*\.spec\.js/ },
    { name: "chromium", testMatch: /browser.*\.spec\.js/, use: { browserName: "chromium", launchOptions: { executablePath } } },
  ],
  webServer: {
    command: "node tests/support/offline-server.js",
    url: "http://127.0.0.1:5011/api/health",
    reuseExistingServer: false,
    timeout: 20_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
});
