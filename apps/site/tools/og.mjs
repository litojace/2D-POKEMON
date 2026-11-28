// The link preview image (og.jpg, 1200 x 630) that chats and social apps
// show for the site: the hero art, the game's name and a line, in the
// game's own look. Run from the repo root after make-images.py:
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

// Poster, as the site: an ink slab with a slanted edge and a white stripe
// (the game's Lobby) over the hero art, Anton capitals, a yellow block with a
// hard red shadow.
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: A; src: url(${url("fonts/anton-latin-400-normal.woff2")}); }
@font-face { font-family: R; font-weight: 100 900; src: url(${url("fonts/archivo-latin-wght-normal.woff2")}); }
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #0d0d0f; }
img.art { position: absolute; left: 360px; top: 0; width: 945px; height: 630px; object-fit: cover; }
.slab { position: absolute; inset: 0; background: #0d0d0f; clip-path: polygon(0 0, 600px 0, 490px 100%, 0 100%); }
.stripe { position: absolute; inset: 0; background: #fff; clip-path: polygon(610px 0, 624px 0, 514px 100%, 500px 100%); }
.dots { position: absolute; inset: 0; background: radial-gradient(circle, rgba(255,216,74,.22) 1.4px, transparent 1.8px) 0 0 / 9px 9px; clip-path: polygon(0 0, 600px 0, 490px 100%, 0 100%); -webkit-mask: linear-gradient(to bottom, transparent 30%, #000); }
.tx { position: absolute; left: 60px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; gap: 18px; color: #fff; }
.logo { display: flex; align-items: center; gap: 14px; font: 40px/1 A; text-transform: uppercase; letter-spacing: .03em; }
.logo img { width: 60px; height: 60px; border: 3px solid #ffd84a; }
h1 { margin: 0; font: 104px/.9 A; text-transform: uppercase; max-width: 520px; }
h1 span { color: #ffd84a; }
p { margin: 0; font: 600 27px/1.3 R; color: #b8b8c0; max-width: 440px; }
.play { align-self: flex-start; margin-top: 10px; background: #ffd84a; color: #0d0d0f; font: 30px/1 A; text-transform: uppercase; letter-spacing: .05em; padding: 15px 24px 13px; box-shadow: 7px 7px 0 #ff2e4d; }
</style>
<img class="art" src="${url("img/hero-dusk-2048.webp")}"><div class="slab"></div><div class="dots"></div><div class="stripe"></div>
<div class="tx"><div class="logo"><img src="${url("icon-192.png")}">Element Arena</div>
<h1>Real-time <span>creature</span> battles</h1><p>18 creatures, 9 elements. Duels, teams and raid bosses.</p>
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
