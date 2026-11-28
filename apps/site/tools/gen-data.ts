// The website's champion data, from the game's own code, so the site never
// says something the game doesn't (docs/website.md):
//
//   npx tsx apps/site/tools/gen-data.ts
//
// Writes apps/site/data/champions.json (stats, the basic attack, the three
// skills and the ultimate, featured skins) and the page's markup made from
// the game (index.html, between its markers). The skins' loops and stills
// are recorded from the fitting room (scripts/site-clips/skins.spec.ts,
// make-skin-clips.py). tests/unit/site.test.ts fails when the JSON no longer
// matches the game, so a balance change can't leave the site stale: run this
// again and commit.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { siteChampions } from "./champion-data";
import {
  CHAMPION_SKIN_BY_ID,
  COLLECTION_NAMES,
  LOOK_ITEM_BY_ID,
  MYTHIC_TRIAL_WINS,
  RARITY_NAMES,
} from "../../../packages/shared/src/shop";
import { CHARACTERS } from "../../../packages/shared/src/index";
import {
  RAID_BOSSES,
  RAID_BOSS_ORDER,
  RAID_REWARDS,
  type RaidBossId,
} from "../../../packages/shared/src/raid";

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const champions = siteChampions();

mkdirSync(path.join(site, "data"), { recursive: true });
writeFileSync(
  path.join(site, "data/champions.json"),
  JSON.stringify(champions, null, 1) + "\n",
);

console.log(
  `wrote ${champions.length} champions with ${champions.reduce((n, c) => n + c.skins.length, 0)} featured skins`,
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
    <div class="mon-art"><img src="img/creatures/${c.id}.svg" alt="" width="200" height="202" loading="lazy" /></div>
    <div class="mon-tx">
      <h3>${esc(c.name)}</h3>
      <p class="el">${c.element}</p>
      <p class="role">${esc(c.role)}</p>
    </div>
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
// The champion ticker (index.html, between the ticker markers): every
// champion, twice over so the strip loops without a seam; the second copy is
// hidden from screen readers and the keyboard. A tap opens the champion.
const tickerItem = (c: (typeof champions)[number], copy: boolean) =>
  `<a class="tick" href="#champion-${c.id}" data-champion="${c.id}" style="--el: var(--el-${c.element.toLowerCase()})"${copy ? ' aria-hidden="true" tabindex="-1"' : ""}><img src="img/creatures/${c.id}.svg" alt="" width="200" height="202" loading="lazy" decoding="async" /><span>${esc(c.name)}</span></a>`;
const ticker = [
  ...champions.map((c) => tickerItem(c, false)),
  ...champions.map((c) => tickerItem(c, true)),
].join("\n");
let page = readFileSync(indexPath, "utf8");
for (const [name, html] of [
  ["roster", cards],
  ["chips", chips],
  ["ticker", ticker],
] as const)
  page = page.replace(
    new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(\\s*<!-- ${name}:end -->)`),
    `$1\n${html}$2`,
  );
writeFileSync(indexPath, page);

// The raid bosses (index.html, between the raids and bosses markers), in
// the Raid Hub's order, from the game's roster: every boss can be raided any
// day; Cragmuff comes first and the other six open after one clear of it
// (raidUnlocked in apps/client/src/screens/raid-hall-view.ts).
// How each splash is framed: the side the words sit on (away from the boss),
// and the picture's alt text.
const RAID_ART: Record<
  RaidBossId,
  { side: "left" | "right"; face: number; alt: string }
> = {
  grumblecrag: {
    side: "right",
    face: 47,
    alt: "Cragmuff, a woolly ram with amber crystal horns, charging through a ruined arena",
  },
  tidewyrm: {
    side: "left",
    face: 60,
    alt: "Tidelotl, a round axolotl with a pearl on its brow, riding a wave over sunken ruins",
  },
  gloomshade: {
    side: "right",
    face: 52,
    alt: "Inkpurr, a cat-eared sprite of living ink, prowling a lantern-lit yard",
  },
  somnara: {
    side: "left",
    face: 62,
    alt: "Snoozaku, a sleepy baku in a starry nightcap, on a cloud floor of glowing runes",
  },
  prismatail: {
    side: "right",
    face: 64,
    alt: "Prismell, a snail with a spiral shell of prism crystal, in a hall of light",
  },
  emberwing: {
    side: "left",
    face: 60,
    alt: "Lumiwick, a smiling sky-lantern spirit floating above three braziers",
  },
  "storm-twins": {
    side: "right",
    face: 58,
    alt: "The Storm Twins, two thunder-jellies tied by a crackling ribbon, in a storm",
  },
};
const lineup = RAID_BOSS_ORDER.map((id) => RAID_BOSSES[id]);
const rewardsOf = (id: RaidBossId) =>
  RAID_REWARDS.filter((r) => r.boss === id).length;
// Filled stars in the boss's colour, empty ones as outlines in grey that
// still reads on ink (dimmed filled stars were 1.7:1); one picture with its
// difficulty as its name.
const stars = (n: number) =>
  `<p class="stars" role="img" aria-label="Difficulty ${n} of 3">${"★".repeat(n)}${n < 3 ? `<span>${"☆".repeat(3 - n)}</span>` : ""}</p>`;
const raidPanels = lineup
  .map(
    (
      b,
      i,
    ) => `<article class="raid" id="raid-${b.id}" role="tabpanel" aria-labelledby="pick-${b.id}" data-side="${RAID_ART[b.id].side}" style="--el: var(--el-${b.element.toLowerCase()}); --fx: ${RAID_ART[b.id].face}%"${i ? " hidden" : ""}>
  <picture class="raid-art">
    <source type="image/avif" srcset="img/raids/${b.id}-768.avif 768w, img/raids/${b.id}-1280.avif 1280w" sizes="(min-width: 1200px) 1168px, 100vw" />
    <img src="img/raids/${b.id}-1280.webp" srcset="img/raids/${b.id}-768.webp 768w, img/raids/${b.id}-1280.webp 1280w" sizes="(min-width: 1200px) 1168px, 100vw" alt="${esc(RAID_ART[b.id].alt)}" width="1280" height="853" loading="lazy" decoding="async" />
  </picture>
  <div class="raid-tx">
    <p class="raid-when">${i === 0 ? `<span class="start-tag">Start here</span>` : ""}${b.element} · ${rewardsOf(b.id)} rewards</p>
    ${stars(b.stars)}
    <h3>${esc(b.name)}</h3>
    <p class="epithet">${esc(b.epithet)}</p>
    <p class="blurb">${esc(b.blurb)}</p>
    <div class="beat"><span>How to beat it</span><p class="trick">${esc(b.signature)}</p></div>
  </div>
</article>`,
  )
  .join("\n");
const raidTabs = lineup
  .map(
    (
      b,
      i,
    ) => `<button type="button" class="pick" role="tab" id="pick-${b.id}" aria-controls="raid-${b.id}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}" style="--el: var(--el-${b.element.toLowerCase()})">
  <img src="img/bosses/${b.id}.webp" alt="" width="400" height="600" loading="lazy" decoding="async" />
  <span class="s" aria-hidden="true">${"★".repeat(b.stars)}</span><span class="n">${esc(b.name)}</span>
</button>`,
  )
  .join("\n");
let page2 = readFileSync(indexPath, "utf8");
for (const [name, html] of [
  ["raids", raidPanels],
  ["bosses", raidTabs],
] as const)
  page2 = page2.replace(
    new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(\\s*<!-- ${name}:end -->)`),
    `$1\n${html}$2`,
  );
writeFileSync(indexPath, page2);

// The Shop spotlight (index.html, between the spotlight and picks markers):
// six pieces from the Shop's catalog (names, rarities, lines), each the
// fitting room's own stage playing it at 60 frames a second
// (scripts/site-clips/skins.spec.ts, make-skin-clips.py: media/skins/<id>.mp4,
// its poster and thumbnail in img/skins/). No prices: the website never
// names an amount of the game's money (owner, 27 Nov). The first piece is
// shown before any script runs.
const SHOWCASE: [picture: string, item: string][] = [
  ["cinder-medic", "pyranda-nova-vanguard"],
  ["storm-corsair", "voltkit-sky-pirates"],
  ["sun-sovereign", "sunbara-sun-dynasty"],
  ["hellforge", "cindrake-sunforged"],
  ["abyssal-reaver", "tidefin-moontide"],
  ["sky-curtain", "borealis-victory"],
];
const SLOT_NAMES: Record<string, string> = {
  aura: "Aura for every fighter",
  victory: "Victory for every fighter",
  entrance: "Entrance for every fighter",
  frame: "Portrait frame",
  colours: "Colours for every fighter",
};
/** What a loop plays, for its description (the fitting room's showcase). */
const PLAYS: Record<string, string> = {
  mythical: "casting its ultimate at Stage III",
  legendary: "playing its victory",
};
/** The pause and play switch every stage carries (site.js). */
const MOTION_BUTTON = `<button type="button" class="motion" data-motion-toggle aria-label="Pause motion"><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg><svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg></button>`;
const pieces = SHOWCASE.map(([pic, id]) => {
  const skin = CHAMPION_SKIN_BY_ID[id];
  const look = LOOK_ITEM_BY_ID[id];
  const item = skin ?? look;
  if (!item) throw new Error(`showcase: no Shop item ${id}`);
  const kind = skin
    ? `${CHARACTERS[skin.champion].name} skin`
    : (SLOT_NAMES[look.slot] ?? look.slot);
  const set =
    item.collection && item.collection in COLLECTION_NAMES
      ? COLLECTION_NAMES[item.collection as keyof typeof COLLECTION_NAMES]
      : null;
  const note =
    skin && item.rarity === "mythical"
      ? `Unlocks after ${MYTHIC_TRIAL_WINS} wins with ${CHARACTERS[skin.champion].name}, then awakens as you keep winning.`
      : item.rarity === "legendary" && skin
        ? "Comes with its own entrance and victory."
        : "Every fighter can wear it.";
  const plays = skin ? (PLAYS[item.rarity] ?? "") : "playing on Voltkit";
  return { pic, id, item, kind, set, note, plays };
});
const spotlight = pieces
  .map(
    (
      x,
      i,
    ) => `<article class="spot r-${x.item.rarity}" id="spot-${x.pic}" role="tabpanel" aria-labelledby="pick-shop-${x.pic}"${i ? " hidden" : ""}>
  <div class="stage">
    <span class="stage-rays" aria-hidden="true"></span>
    <video muted loop playsinline preload="none" poster="img/skins/${x.id}.webp" width="720" height="720" aria-label="${esc(x.item.name)} in the game's fitting room${x.plays ? `, ${x.plays}` : ""}"><source src="media/skins/${x.id}.mp4" type="video/mp4" /></video>
    <span class="stage-sparks" aria-hidden="true"></span>
    <span class="stage-slash" aria-hidden="true"></span>
    ${MOTION_BUTTON}
  </div>
  <div class="spot-tx">
    <p class="spot-r">${RARITY_NAMES[x.item.rarity]}${x.set ? ` · ${esc(x.set)}` : ""}</p>
    <h3>${esc(x.item.name)}</h3>
    <p class="spot-k">${esc(x.kind)}</p>
    <p class="spot-d">${esc(x.item.description)}</p>
    <p class="spot-note">${esc(x.note)}</p>
    <a class="btn btn-play spot-go" href="https://play.elementarenausa.com/">Try it on in the Shop</a>
  </div>
</article>`,
  )
  .join("\n");
const picks = pieces
  .map(
    (
      x,
      i,
    ) => `<button type="button" class="shop-pick r-${x.item.rarity}" role="tab" id="pick-shop-${x.pic}" aria-controls="spot-${x.pic}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}">
  <img src="img/skins/${x.id}-thumb.webp" alt="" width="192" height="192" loading="lazy" decoding="async" />
  <span>${esc(x.item.name)}</span>
</button>`,
  )
  .join("\n");
let page3 = readFileSync(indexPath, "utf8");
for (const [name, markup] of [
  ["spotlight", spotlight],
  ["picks", picks],
] as const)
  page3 = page3.replace(
    new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(\\s*<!-- ${name}:end -->)`),
    `$1\n${markup}$2`,
  );
writeFileSync(indexPath, page3);
