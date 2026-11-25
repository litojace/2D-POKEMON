// Builds the review demo of the website: the real page, plus a bar to switch
// between the three style directions, as one page for a claude.ai Artifact
// (which supplies its own <head>, and loads fonts from Google Fonts only).
//
//   node apps/site/tools/demo.mjs <out-dir>
//
// Writes <out-dir>/index.html; publish it with apps/site's img/ and
// favicon-32.png beside it. Not part of the live site.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2];
if (!out) throw new Error("usage: node apps/site/tools/demo.mjs <out-dir>");

const html = readFileSync(path.join(site, "index.html"), "utf8");
const css = readFileSync(path.join(site, "site.css"), "utf8").replace(
  /@font-face\s*{[^}]*}\s*/g,
  "",
);
const body = html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>"));
const script = readFileSync(path.join(site, "site.js"), "utf8");

const STYLES = [
  ["dusk", "Arena Dusk", "The game's own navy and gold"],
  ["day", "Sunny Plaza", "Bright daylight, friendly"],
  ["raid", "Raid Night", "Storm-dark, louder type"],
];

const demo = `<title>Element Arena Website</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=DM+Sans:wght@400;600&display=swap">
<style>
${css}
/* ---- Demo only: the style switcher ---- */
.demo {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
  padding: 10px max(12px, env(safe-area-inset-right, 0px)) calc(10px + env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px));
  background: #0b1020f2; color: #eef2ff; border-top: 1px solid #ffffff2e;
  display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;
  font: 600 0.85rem/1.2 var(--body);
}
.demo-label { color: #a9b6cf; margin-right: 4px; }
.demo button {
  min-height: 44px; padding: 6px 14px; border-radius: 999px; cursor: pointer;
  border: 1px solid #ffffff40; background: transparent; color: inherit;
  font: 700 1rem/1.1 var(--display); letter-spacing: .04em; text-transform: uppercase;
}
.demo button[aria-pressed="true"] { background: #ffd65b; color: #2a1a00; border-color: #ffd65b; }
.demo button:focus-visible { outline: 3px solid #7fe7ff; outline-offset: 2px; }
.foot { padding-bottom: calc(110px + env(safe-area-inset-bottom, 0px)); }
@media (max-width: 520px) { .demo-label { width: 100%; text-align: center; margin: 0; } }
@media (max-height: 500px) { .demo { padding-block: 6px calc(6px + env(safe-area-inset-bottom, 0px)); } .demo button { min-height: 44px; padding-block: 4px; } .demo-label { display: none; } }
</style>
${body}
<div class="demo" role="group" aria-label="Demo: choose a style direction">
  <span class="demo-label">Demo, pick a style:</span>
  ${STYLES.map(([id, name, hint]) => `<button type="button" data-pick="${id}" title="${hint}" aria-pressed="${id === "dusk"}">${name}</button>`).join("\n  ")}
</div>
<script>
${script}
</script>
<script>
(() => {
  const root = document.documentElement;
  const hero = document.querySelector(".hero-art");
  const alts = {
    dusk: "Coilemur dodges a beam of light from Halcyra in a coliseum at sunset",
    day: "Four creatures battle on a sunny beach court at Tide Pools",
    raid: "The Storm Twins, two thunder-jellies tied by lightning, over a rainy arena",
  };
  function pick(id) {
    root.dataset.style = id;
    for (const s of hero.querySelectorAll("source, img")) {
      for (const attr of ["src", "srcset"]) {
        const v = s.getAttribute(attr);
        if (v) s.setAttribute(attr, v.replace(/hero-(dusk|day|raid)-/g, "hero-" + id + "-"));
      }
    }
    hero.querySelector("img").alt = alts[id];
    for (const b of document.querySelectorAll("[data-pick]")) b.setAttribute("aria-pressed", String(b.dataset.pick === id));
    try { localStorage.setItem("ea-demo-style", id); } catch {}
  }
  for (const b of document.querySelectorAll("[data-pick]")) b.addEventListener("click", () => pick(b.dataset.pick));
  let saved = null;
  try { saved = localStorage.getItem("ea-demo-style"); } catch {}
  if (saved && alts[saved]) pick(saved);
})();
</script>
`;

mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "index.html"), demo);
console.log("wrote", path.join(out, "index.html"));
