import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** Targeted Safari-engine checks; the default visual suite stays on Chromium. */
export default defineConfig({
  ...base,
  outputDir: "../../test-results/visual-webkit",
  use: { ...base.use, browserName: "webkit", launchOptions: {} },
});
