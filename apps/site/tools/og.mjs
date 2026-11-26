// The link preview image (og.jpg, 1200 x 630) that chats and social apps
// show for the site: the hero art, the game's name and a line, in the
// game's own font. Run from the repo root after make-images.py:
//
//   node apps/site/tools/og.mjs
//
// Uses the repo's Playwright; PW_CHROMIUM points it at a Chromium already
// on the machine (as in tests/visual).
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = (p) => "file://" + path.join(site, p);

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: B; font-weight: 800; src: url(${url("fonts/barlow-condensed-latin-800-normal.woff2")}); }
@font-face { font-family: D; font-weight: 600; src: url(${url("fonts/dm-sans-latin-600-normal.woff2")}); }
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #0b1020; }
img.art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 42%; }
.shade { position: absolute; inset: 0; background: linear-gradient(to right, #0b1020f2 0%, #0b1020b8 38%, transparent 66%); }
.tx { position: absolute; left: 64px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; gap: 18px; color: #fff; }
.logo { display: flex; align-items: center; gap: 16px; font: 800 44px/1 B; text-transform: uppercase; letter-spacing: .02em; }
.logo img { width: 64px; height: 64px; border-radius: 14px; }
h1 { margin: 0; font: 800 92px/.95 B; text-transform: uppercase; max-width: 600px; }
p { margin: 0; font: 600 28px/1.3 D; color: #dfe6f7; max-width: 560px; }
.play { align-self: flex-start; margin-top: 8px; background: #ffd65b; color: #2a1a00; font: 800 34px/1 B; text-transform: uppercase; letter-spacing: .04em; padding: 16px 32px; border-radius: 999px; }
</style>
<img class="art" src="${url("img/hero-dusk-1536.webp")}"><div class="shade"></div>
<div class="tx"><div class="logo"><img src="${url("icon-192.png")}">Element Arena</div>
<h1>Real-time creature battles</h1><p>18 creatures, 9 elements. Duels, teams and raid bosses.</p>
<div class="play">Play free in your browser</div></div>`;

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
// A file page, so it may load the site's files (setContent's blank page may not).
const sheet = path.join(mkdtempSync(path.join(tmpdir(), "og-")), "og.html");
writeFileSync(sheet, html);
await page.goto("file://" + sheet, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({
  path: path.join(site, "og.jpg"),
  type: "jpeg",
  quality: 82,
});
await browser.close();
console.log("wrote", path.join(site, "og.jpg"));
