import { defineConfig } from "@playwright/test";
import visual from "../../tests/visual/playwright.config";

/**
 * The website's skill clips (docs/website.md): every champion's moves, cast
 * in the real client against a training target, captured frame by frame.
 *
 *   npx playwright test --config scripts/site-clips/playwright.config.ts
 *   python3 apps/site/tools/make-clips.py
 */
export default defineConfig({
  ...visual,
  testDir: ".",
  testMatch: "*.spec.ts",
  timeout: 600_000,
  fullyParallel: true,
  retries: 0,
  reporter: "line",
  outputDir: "../../test-results/site-clips",
  webServer: { ...visual.webServer!, cwd: "../.." } as any,
});
