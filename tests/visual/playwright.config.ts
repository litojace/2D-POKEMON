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
  // One worker, so timing and frame-rate checks have the machine to
  // themselves. CI splits the suite into shards on separate runners
  // (.github/workflows/ci.yml); fullyParallel lets a shard take single tests
  // rather than whole files, so a long file doesn't hold one shard up.
  fullyParallel: true,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // Each CI shard writes a blob; the visual-report job merges them into one
  // HTML report.
  reporter: process.env.CI ? [["list"], ["blob", { outputDir: "../../blob-report" }]] : "list",
  outputDir: "../../test-results/visual",
  use: {
    baseURL: "http://localhost:4179",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
      // PW_CHROMIUM: a Chromium already on the machine, when Playwright's own
      // download isn't installed (e.g. /opt/pw-browsers/.../chrome).
      ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
    },
  },
  webServer: {
    command: "npx vite --config tests/visual/vite.config.ts",
    cwd: "../..",
    url: "http://localhost:4179",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
