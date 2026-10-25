import { defineConfig, devices } from "@playwright/test";

/**
 * Visual checks: the real client in Chromium with no server (see harness/).
 * They assert what you'd notice by eye (one fighter on the select screen, the
 * arena canvas filling its frame, dialogs fitting a phone) and attach a
 * screenshot of each screen to the report for a person to look over.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "../../playwright-report" }]] : "list",
  outputDir: "../../test-results/visual",
  use: {
    baseURL: "http://localhost:4179",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: {
    command: "npx vite --config tests/visual/vite.config.ts",
    cwd: "../..",
    url: "http://localhost:4179",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
