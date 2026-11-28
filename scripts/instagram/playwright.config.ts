import { defineConfig } from "@playwright/test";
import visual from "../../tests/visual/playwright.config";

/**
 * The Instagram skins Reel (docs/instagram.md): the fitting room recorded
 * in the visual harness (tests/visual). Run with:
 *
 *   npx playwright test --config scripts/instagram/playwright.config.ts
 */
export default defineConfig({
  ...visual,
  testDir: ".",
  testMatch: "*.spec.ts",
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  outputDir: "../../test-results/instagram",
  webServer: { ...visual.webServer!, cwd: "../.." } as any,
});
