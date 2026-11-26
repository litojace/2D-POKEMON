// The website's champion data, from the game's own code, so the site never
// says something the game doesn't (docs/website.md):
//
//   npx tsx apps/site/tools/gen-data.ts
//
// Writes apps/site/data/champions.json (stats, the basic attack, the three
// skills and the ultimate, featured skins) and the featured skins' pictures
// in apps/site/img/skins/. tests/unit/site.test.ts fails when the JSON no
// longer matches the game, so a balance change can't leave the site stale:
// run this again and commit.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { siteChampions } from "./champion-data";
import { creatureSvg } from "../../client/src/creature-design";

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const champions = siteChampions();

mkdirSync(path.join(site, "data"), { recursive: true });
writeFileSync(
  path.join(site, "data/champions.json"),
  JSON.stringify(champions, null, 1) + "\n",
);

const skins = path.join(site, "img/skins");
mkdirSync(skins, { recursive: true });
for (const c of champions)
  for (const s of c.skins)
    writeFileSync(
      path.join(skins, `${s.id}.svg`),
      creatureSvg(c.id, "down", undefined, undefined, "normal", {
        skin: s.id,
        stage: 1,
      }),
    );
console.log(
  `wrote ${champions.length} champions and ${champions.reduce((n, c) => n + c.skins.length, 0)} skin pictures`,
);

// The roster's markup in index.html, between its markers: the page works
// (and search engines read it) before any script runs.
const ELEMENTS = [...new Set(champions.map((c) => c.element))];
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const cards = champions
  .map(
    (
      c,
    ) => `<li class="mon" data-el="${c.element}" style="--el: var(--el-${c.element.toLowerCase()})">
  <a class="mon-btn" href="#champion-${c.id}" data-champion="${c.id}" aria-haspopup="dialog">
    <img src="img/creatures/${c.id}.svg" alt="" width="200" height="202" loading="lazy" />
    <h3>${esc(c.name)}</h3>
    <p class="el">${c.element}</p>
    <p class="role">${esc(c.role)}</p>
  </a>
</li>`,
  )
  .join("\n");
const chips = [
  `<button type="button" class="chip" data-filter="all" aria-pressed="true">All</button>`,
  ...ELEMENTS.map(
    (e) =>
      `<button type="button" class="chip" data-filter="${e}" aria-pressed="false" style="--el: var(--el-${e.toLowerCase()})"><span class="dot" aria-hidden="true"></span>${e}</button>`,
  ),
].join("\n");
const indexPath = path.join(site, "index.html");
let page = readFileSync(indexPath, "utf8");
for (const [name, html] of [
  ["roster", cards],
  ["chips", chips],
] as const)
  page = page.replace(
    new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(\\s*<!-- ${name}:end -->)`),
    `$1\n${html}$2`,
  );
writeFileSync(indexPath, page);
