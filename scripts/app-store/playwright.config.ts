import { defineConfig } from "@playwright/test";
import visual from "../../tests/visual/playwright.config";

/**
 * App Store screenshots (docs/app-store-screenshots.md): the real client in
 * the visual harness (tests/visual), staged into each scene and captured at
 * the iPhone sizes App Store Connect asks for. Run with:
 *
 *   npx playwright test --config scripts/app-store/playwright.config.ts
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
  outputDir: "../../test-results/app-store",
  webServer: { ...visual.webServer!, cwd: "../.." } as any,
});
