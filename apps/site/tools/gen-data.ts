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
import {
  RAID_BOSSES,
  RAID_BOSS_ORDER,
  type RaidBossId,
} from "../../../packages/shared/src/raid-roster";

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

// The raid week (index.html, between the raids markers): one boss a day,
// Sunday first, from the game's raid roster. site.js opens today's (Pacific).
const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
// How each splash is framed: the side the words sit on (away from the boss),
// and the picture's alt text.
const RAID_ART: Record<RaidBossId, { side: "left" | "right"; alt: string }> = {
  grumblecrag: {
    side: "right",
    alt: "Cragmuff, a woolly ram with amber crystal horns, charging through a ruined arena",
  },
  tidewyrm: {
    side: "left",
    alt: "Tidelotl, a round axolotl with a pearl on its brow, riding a wave over sunken ruins",
  },
  gloomshade: {
    side: "right",
    alt: "Inkpurr, a cat-eared sprite of living ink, prowling a lantern-lit yard",
  },
  somnara: {
    side: "left",
    alt: "Snoozaku, a sleepy baku in a starry nightcap, on a cloud floor of glowing runes",
  },
  prismatail: {
    side: "right",
    alt: "Prismell, a snail with a spiral shell of prism crystal, in a hall of light",
  },
  emberwing: {
    side: "left",
    alt: "Lumiwick, a smiling sky-lantern spirit floating above three braziers",
  },
  "storm-twins": {
    side: "right",
    alt: "The Storm Twins, two thunder-jellies tied by a crackling ribbon, in a storm",
  },
};
const week = RAID_BOSS_ORDER.map((id) => RAID_BOSSES[id]).sort(
  (a, b) => a.day - b.day,
);
const stars = (n: number) =>
  `<p class="stars" aria-label="Difficulty ${n} of 3">${"★".repeat(n)}${n < 3 ? `<span>${"★".repeat(3 - n)}</span>` : ""}</p>`;
const raidPanels = week
  .map(
    (
      b,
      i,
    ) => `<article class="raid" id="raid-${b.id}" role="tabpanel" aria-labelledby="day-${b.id}" data-day="${b.day}" data-side="${RAID_ART[b.id].side}" style="--el: var(--el-${b.element.toLowerCase()})"${i ? " hidden" : ""}>
  <picture class="raid-art">
    <source type="image/avif" srcset="img/raids/${b.id}-768.avif 768w, img/raids/${b.id}-1280.avif 1280w" sizes="(min-width: 1200px) 1168px, 100vw" />
    <img src="img/raids/${b.id}-1280.webp" srcset="img/raids/${b.id}-768.webp 768w, img/raids/${b.id}-1280.webp 1280w" sizes="(min-width: 1200px) 1168px, 100vw" alt="${esc(RAID_ART[b.id].alt)}" width="1280" height="853" loading="lazy" decoding="async" />
  </picture>
  <div class="raid-tx">
    <p class="raid-when"><span class="today-tag">Today</span>${DAYS[b.day]}s · ${b.element}</p>
    ${stars(b.stars)}
    <h3>${esc(b.name)}</h3>
    <p class="epithet">${esc(b.epithet)}</p>
    <p class="blurb">${esc(b.blurb)}</p>
    <div class="beat"><span>How to beat it</span><p class="trick">${esc(b.signature)}</p></div>
  </div>
</article>`,
  )
  .join("\n");
const raidTabs = week
  .map(
    (
      b,
      i,
    ) => `<button type="button" class="day" role="tab" id="day-${b.id}" aria-controls="raid-${b.id}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}" data-day="${b.day}" style="--el: var(--el-${b.element.toLowerCase()})">
  <img src="img/bosses/${b.id}.webp" alt="" width="400" height="600" loading="lazy" decoding="async" />
  <span class="d">${DAYS[b.day].slice(0, 3)}</span><span class="n">${esc(b.name)}</span>
</button>`,
  )
  .join("\n");
let page2 = readFileSync(indexPath, "utf8");
for (const [name, html] of [
  ["raids", raidPanels],
  ["days", raidTabs],
] as const)
  page2 = page2.replace(
    new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(\\s*<!-- ${name}:end -->)`),
    `$1\n${html}$2`,
  );
writeFileSync(indexPath, page2);
