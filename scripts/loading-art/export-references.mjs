#!/usr/bin/env node
/**
 * Reference pictures for the loading-screen paintings
 * (docs/loading-art-prompts.md): every Legendary / Mythical skin the scenes
 * in apps/client/src/loading-art.ts use, drawn by the game itself on a
 * transparent background, one PNG per skin (<skin id>.png). Attach them in
 * ChatGPT so the painting shows the skin players can buy, not a guess.
 *
 * Usage: node scripts/loading-art/export-references.mjs [out-folder]
 * (default: loading-art-references). PW_CHROMIUM picks a Chromium binary
 * when Playwright's own isn't installed.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const out = resolve(process.argv[2] ?? "loading-art-references");
mkdirSync(out, { recursive: true });
const server = await createServer({
  configFile: resolve("apps/client/vite.config.ts"),
  root: resolve("apps/client"),
  server: { port: 5298 },
  logLevel: "error",
});
await server.listen();
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
try {
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  const base = server.resolvedUrls.local[0];
  await page.goto(new URL("loading-preview.html?v=refs", base).href);
  await page.waitForSelector("[data-ref]");
  // The game's page backgrounds (the Plaza behind the hub) aren't part of
  // a fighter: transparent, so only the skin is in the picture.
  await page.addStyleTag({
    content:
      "html,body,html::before,html::after,body::before,body::after{background:transparent!important;background-image:none!important}",
  });
  const ids = await page.$$eval("[data-ref]", (els) =>
    els.map((el) => el.getAttribute("data-ref")),
  );
  for (const id of ids) {
    await page
      .locator(`[data-ref="${id}"]`)
      .screenshot({ path: `${out}/${id}.png`, omitBackground: true });
    console.log(`${out}/${id}.png`);
  }
} finally {
  await browser.close();
  await server.close();
}
