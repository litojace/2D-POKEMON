import { defineConfig } from "@playwright/test";
import visual from "../../tests/visual/playwright.config";

/**
 * The README's pictures (docs/readme/, docs/development.md "README
 * pictures"): the App Store scenes in the look players have, at a phone in
 * landscape. Run with:
 *
 *   npx playwright test --config scripts/readme/playwright.config.ts
 */
export default defineConfig({
  ...visual,
  testDir: ".",
  testMatch: "*.spec.ts",
  timeout: 240_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "../../test-results/readme",
  webServer: { ...visual.webServer!, cwd: "../.." } as any,
});
