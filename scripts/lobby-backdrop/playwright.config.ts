import { defineConfig } from "@playwright/test";
import visual from "../../tests/visual/playwright.config";

/** Runs capture.spec.ts against the visual-test harness (see capture.spec.ts). */
export default defineConfig({
  ...visual,
  testDir: ".",
  testMatch: "capture.spec.ts",
  timeout: 180_000,
  outputDir: "../../test-results/lobby-backdrop",
  reporter: "list",
  webServer: { ...visual.webServer, cwd: "../.." } as typeof visual.webServer,
});
