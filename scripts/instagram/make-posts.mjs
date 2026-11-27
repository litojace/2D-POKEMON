// The Instagram starter pack (docs/instagram.md): the profile picture and
// the first nine posts, each at the three sizes Instagram shows, built from
// the game's own art, real captures of the game and the game's fonts.
//
//   npx playwright test --config scripts/site-clips/playwright.config.ts scripts/site-clips/scenes.spec.ts
//   npx playwright test --config scripts/app-store/playwright.config.ts
//   node scripts/instagram/make-posts.mjs            # -> instagram/
//
// The first two commands render the real battles and the Plaza (the same
// captures as the website's "Ways to play"); a post whose capture is missing
// is skipped with a note. POSTS=1,4 renders only those. PW_CHROMIUM points
// at a Chromium already on the machine, as in tests/visual.
//
// Sizes (1080 px wide, Instagram's upload width):
//   feed   1080 x 1350 (4:5, the tallest a feed post shows)
//   square 1080 x 1080 (1:1)
//   story  1080 x 1920 (9:16, Stories and Reels covers)
// The profile grid crops posts to 3:4, so every word keeps 80 px or more
// from the left and right edges of a feed post; a story keeps its words out
// of the top 250 px and bottom 320 px, where Instagram draws its own bars.
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const OUT = path.join(ROOT, "instagram");
const at = (p) => path.join(ROOT, p);
const url = (p) => "file://" + at(p);

const champions = JSON.parse(
  readFileSync(at("apps/site/data/champions.json"), "utf8"),
);
const champ = (id) => champions.find((c) => c.id === id);

const SIZES = {
  feed: [1080, 1350],
  square: [1080, 1080],
  story: [1080, 1920],
};

/** A real capture of the game (2622 x 1206), cropped to 16:9 like make-scenes.py. */
const capture = (file, cx, cy, share) => ({ file, cx, cy, share });
const SCENES = "site-clips/scenes";

/** Painted art: the game's raid splash and loading art (1536 x 1024). */
const painting = (file, x = 50, y = 50) => ({ painting: file, x, y });

/**
 * The nine posts, in posting order. `kind` picks the layout:
 * - "art": a painting full bleed, words over its lower part,
 * - "shot": a real capture of the game as a card, words above and below,
 * - "roster", "champion", "skins": drawn from the fighters' own SVGs.
 */
const POSTS = [
  {
    id: 1,
    name: "welcome",
    kind: "art",
    art: painting(
      "apps/client/src/art/loading-art/startup-art-duel-skyline-lance.webp",
      52,
      50,
    ),
    eyebrow: "Real-time creature battles",
    title: "Pick an element. Outplay your friends.",
    line: "18 original creatures, 9 elements. Free to play in your browser.",
  },
  {
    id: 2,
    name: "duels",
    kind: "shot",
    art: capture(`${SCENES}/duels/014.png`, 0.53, 0.47, 0.42),
    eyebrow: "1v1 duels",
    title: "Dodge. Dash. Land the big one.",
    line: "Every fight is live: aim your skills, read your rival, time your ultimate.",
  },
  {
    id: 3,
    name: "roster",
    kind: "roster",
    eyebrow: "Meet the champions",
    title: "18 creatures. 9 elements.",
    line: "Who are you picking first?",
  },
  {
    id: 4,
    name: "raid-lumiwick",
    kind: "art",
    art: painting("apps/client/src/art/raid-splash/emberwing.webp", 50, 40),
    eyebrow: "Raid boss · Lumiwick",
    title: "Seven bosses, seven puzzles.",
    line: "Every boss has one trick to learn. Solve it solo or with up to three friends.",
  },
  {
    id: 5,
    name: "teams",
    kind: "shot",
    art: capture(`${SCENES}/teams/014.png`, 0.5, 0.36, 0.56),
    eyebrow: "2v2 team battles",
    title: "Better with a friend.",
    line: "Team up, stack your skills and wipe the other side.",
  },
  {
    id: 6,
    name: "pyranda",
    kind: "champion",
    champion: "pyranda",
    eyebrow: "Champion spotlight",
    // The skills, said short; the full text is the game's (champions.json).
    moves: [
      ["Chestnut Mortar", "Lobs a burning chestnut over walls."],
      ["Hot Coals", "A patch of coals that burns anyone in it."],
      ["Ember Curtain", "A wall of embers that burns up enemy shots."],
      ["Chestnut Storm", "Ultimate: five blasts march across the arena."],
    ],
  },
  {
    id: 7,
    name: "free-for-all",
    kind: "shot",
    art: capture(`${SCENES}/ffa/016.png`, 0.57, 0.4, 0.46),
    eyebrow: "Free-for-all",
    title: "Four fighters. One winner.",
    line: "Everyone against everyone in the Ember Forge.",
  },
  {
    id: 8,
    name: "skins",
    kind: "skins",
    skins: ["pyranda-harvest-moon", "tidefin-moontide", "cindrake-sunforged"],
    eyebrow: "The Shop",
    title: "Walk in a legend.",
    line: "Costumes with their own entrance and victory. All cosmetic, never stronger.",
  },
  {
    id: 9,
    name: "spire",
    kind: "shot",
    art: capture(`${SCENES}/spire/016.png`, 0.47, 0.61, 0.48),
    eyebrow: "The Spire",
    title: "70 floors. How high can you climb?",
    line: "Seven zones of ten floors, an elite halfway up and a boss at the top of each.",
  },
];

/** The words every post shares: the game's name, and where to play. */
const LOGO = `<div class="logo"><img src="${url("apps/client/public/icons/arena-512.png")}">Element Arena</div>`;
const PLAY = `<div class="play">Play free · link in bio</div>`;

const BASE = `
@font-face { font-family: B; font-weight: 800; src: url(${url("apps/site/fonts/barlow-condensed-latin-800-normal.woff2")}); }
@font-face { font-family: B; font-weight: 700; src: url(${url("apps/site/fonts/barlow-condensed-latin-700-normal.woff2")}); }
@font-face { font-family: D; font-weight: 600; src: url(${url("apps/site/fonts/dm-sans-latin-600-normal.woff2")}); }
@font-face { font-family: D; font-weight: 400; src: url(${url("apps/site/fonts/dm-sans-latin-400-normal.woff2")}); }
* { box-sizing: border-box; }
html, body { margin: 0; overflow: hidden; background: #0b1020; color: #fff; }
.page { position: relative; width: var(--w); height: var(--h); overflow: hidden; }
.logo { display: flex; align-items: center; gap: 18px; font: 800 46px/1 B; text-transform: uppercase; letter-spacing: .03em; }
.logo img { width: 72px; height: 72px; border-radius: 16px; box-shadow: 0 4px 18px #0008; }
.eyebrow { font: 700 34px/1 B; text-transform: uppercase; letter-spacing: .12em; color: #ffd65b; }
h1 { margin: 0; font: 800 100px/.94 B; text-transform: uppercase; text-wrap: balance; }
p { margin: 0; font: 600 34px/1.32 D; color: #dfe6f7; text-wrap: pretty; }
.play { align-self: flex-start; background: #ffd65b; color: #2a1a00; font: 800 38px/1 B; text-transform: uppercase; letter-spacing: .05em; padding: 20px 36px; border-radius: 999px; }
.pad { position: absolute; left: 84px; right: 84px; display: flex; flex-direction: column; gap: 22px; }
`;

/** Where the words go on each size: [top block's top, bottom block's bottom]. */
const SAFE = {
  feed: { top: 72, bottom: 72 },
  square: { top: 64, bottom: 64 },
  story: { top: 260, bottom: 330 },
};

function artPost(post, size) {
  const { top, bottom } = SAFE[size];
  const small = size === "square";
  return `
<style>
img.art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: ${post.art.x}% ${post.art.y}%; }
.shade { position: absolute; inset: 0; background:
  linear-gradient(to bottom, #0b1020d0 0%, #0b102000 ${small ? 24 : 18}%),
  linear-gradient(to top, #0b1020f5 0%, #0b1020c8 ${small ? 34 : 30}%, #0b102000 ${small ? 62 : 55}%); }
${small ? "h1 { font-size: 84px; } p { font-size: 30px; }" : ""}
</style>
<img class="art" src="${url(post.art.painting)}"><div class="shade"></div>
<div class="pad" style="top:${top}px">${LOGO}</div>
<div class="pad" style="bottom:${bottom}px">
  <div class="eyebrow">${post.eyebrow}</div><h1>${post.title}</h1><p>${post.line}</p>${PLAY}
</div>`;
}

/** The 16:9 crop of a capture as CSS for an <img> inside a box `w` wide. */
function cropStyle({ cx, cy, share }, w) {
  const [iw, ih] = [2622, 1206];
  const cw = share * iw;
  const ch = (cw * 9) / 16;
  const x0 = Math.min(Math.max(0, cx * iw - cw / 2), iw - cw);
  const y0 = Math.min(Math.max(0, cy * ih - ch / 2), ih - ch);
  const k = w / cw;
  return `width:${iw * k}px;height:${ih * k}px;left:${-x0 * k}px;top:${-y0 * k}px`;
}

/** Smaller type for the square, where the words have less room. */
const SQUARE = `h1 { font-size: 74px; } p { font-size: 28px; } .eyebrow { font-size: 28px; }
.play { font-size: 30px; padding: 15px 28px; } .logo { font-size: 36px; } .logo img { width: 56px; height: 56px; }`;

/**
 * The page as a column inside the safe area: the words on top, the picture
 * in the middle taking what room is left, the words at the bottom. Nothing
 * can overlap, whatever a title wraps to.
 */
function flow(size, head, middle, foot, css = "") {
  const { top, bottom } = SAFE[size];
  return `
<style>
.flow { position: absolute; left: 84px; right: 84px; top: ${top}px; bottom: ${bottom}px; display: flex; flex-direction: column; gap: ${size === "story" ? 44 : size === "square" ? 22 : 30}px; }
.head, .foot { display: flex; flex-direction: column; gap: ${size === "square" ? 14 : 20}px; }
.head .logo { margin-bottom: ${size === "story" ? 34 : size === "square" ? 4 : 10}px; }
.mid { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
${size === "square" ? SQUARE : ""}
${css}
</style>
<div class="flow"><div class="head">${LOGO}${head}</div><div class="mid">${middle}</div><div class="foot">${foot}</div></div>`;
}

function shotPost(post, size) {
  const cardW = size === "square" ? 700 : 912;
  return (
    `<div class="blur"></div>` +
    flow(
      size,
      `<div class="eyebrow">${post.eyebrow}</div><h1>${post.title}</h1>`,
      `<div class="card"><img src="${url(post.art.file)}" style="${cropStyle(post.art, cardW)}"></div>`,
      `<p>${post.line}</p>${PLAY}`,
      `.blur { position: absolute; inset: -60px; background: url(${url(post.art.file)}) center/cover; filter: blur(42px) saturate(1.2) brightness(.42); }
.card { position: relative; flex: none; width: ${cardW}px; height: ${(cardW * 9) / 16}px; overflow: hidden; border-radius: 28px; box-shadow: 0 0 0 4px #ffd65b, 0 24px 60px #000a; }
.card img { position: absolute; }`,
    )
  );
}

/** The fighters' own drawings (the website's copies, written from the game's). */
const creature = (id) => url(`apps/site/img/creatures/${id}.svg`);
const skinArt = (id) => url(`apps/site/img/skins/${id}.svg`);

function rosterPost(post, size) {
  const story = size === "story";
  const small = size === "square";
  const cols = 6;
  const cell = story ? 142 : small ? 118 : 138;
  const cells = champions
    .map(
      (c) =>
        `<figure style="--c:${c.color}"><img src="${creature(c.id)}"><figcaption>${c.name}<small>${c.element}</small></figcaption></figure>`,
    )
    .join("");
  return (
    `<div class="bg"></div>` +
    flow(
      size,
      `<div class="eyebrow">${post.eyebrow}</div><h1>${post.title}</h1>`,
      `<div class="grid">${cells}</div>`,
      `<div class="row"><p>${post.line}</p>${PLAY}</div>`,
      `.bg { position: absolute; inset: 0; background: radial-gradient(120% 80% at 50% 45%, #1d2a55 0%, #0b1020 70%); }
.grid { display: grid; grid-template-columns: repeat(${cols}, ${cell}px); gap: ${story ? "30px 12px" : small ? "2px 18px" : "14px 12px"}; }
figure { margin: 0; display: flex; flex-direction: column; align-items: center; }
figure img { width: ${cell}px; height: ${cell}px; object-fit: contain; filter: drop-shadow(0 6px 10px #0009); }
figcaption { margin-top: -4px; font: 800 ${small ? 22 : 26}px/1 B; text-transform: uppercase; text-align: center; }
figcaption small { display: block; margin-top: 4px; font: 700 ${small ? 16 : 18}px/1 B; letter-spacing: .1em; color: var(--c); }
.row { display: flex; ${story ? "flex-direction: column; gap: 20px;" : "align-items: center; justify-content: space-between; gap: 24px;"} }`,
    )
  );
}

function championPost(post, size) {
  const c = champ(post.champion);
  const small = size === "square";
  const story = size === "story";
  const moves = post.moves
    .map(
      ([name, text], i) =>
        `<li class="${i === post.moves.length - 1 ? "ult" : ""}"><b>${name}</b><span>${text}</span></li>`,
    )
    .join("");
  const head = `<div class="eyebrow">${post.eyebrow}</div><div class="name">${c.name}</div><div class="tag">${c.element} · ${c.role}</div>`;
  const css = `.bg { position: absolute; inset: 0; background: radial-gradient(70% 45% at ${small ? "74% 50%" : "50% 40%"}, ${c.color}88 0%, #2a1530 45%, #0b1020 80%); }
.mid { position: relative; }
.hero { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 16px 30px #000b); }
.name { font: 800 ${small ? 92 : 120}px/.9 B; text-transform: uppercase; }
.tag { font: 700 ${small ? 30 : 36}px/1 B; text-transform: uppercase; letter-spacing: .1em; color: ${c.color}; }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: ${small ? 10 : 14}px; }
li { display: grid; gap: 4px; padding: ${small ? "10px 16px" : "14px 22px"}; border-radius: 18px; background: #0b1020c0; border: 2px solid #ffffff1f; }
li b { font: 800 ${small ? 28 : 36}px/1 B; text-transform: uppercase; letter-spacing: .02em; }
li span { font: 400 ${small ? 22 : 27}px/1.25 D; color: #dfe6f7; }
li.ult { border-color: #ffd65b; } li.ult b { color: #ffd65b; }`;
  if (small) {
    // Square: the drawing on the right, the words in a column on the left.
    return (
      `<div class="bg"></div>` +
      flow(
        size,
        head,
        ``,
        `<ul style="width:540px">${moves}</ul>`,
        css +
          `.hero { inset: auto; right: 30px; top: 200px; width: 470px; height: 470px; }`,
      ) +
      `<img class="hero" src="${creature(c.id)}">`
    );
  }
  return (
    `<div class="bg"></div>` +
    flow(
      size,
      head,
      `<img class="hero" src="${creature(c.id)}">`,
      `<ul>${moves}</ul>`,
      css,
    )
  );
}

function skinsPost(post, size) {
  const small = size === "square";
  const story = size === "story";
  const all = champions.flatMap((c) =>
    c.skins.map((s) => ({ ...s, champ: c })),
  );
  const cards = post.skins
    .map((id) => {
      const s = all.find((x) => x.id === id);
      return `<figure><img src="${skinArt(id)}"><figcaption>${s.name}<small>${s.champ.name} · ${s.rarity}</small></figcaption></figure>`;
    })
    .join("");
  const cardW = story ? 912 : small ? 290 : 300;
  return (
    `<div class="bg"></div>` +
    flow(
      size,
      `<div class="eyebrow">${post.eyebrow}</div><h1>${post.title}</h1>`,
      `<div class="row">${cards}</div>`,
      `<p>${post.line}</p>${PLAY}`,
      `.bg { position: absolute; inset: 0; background: radial-gradient(90% 55% at 50% 50%, #3b2a12 0%, #160f22 55%, #0b1020 85%); }
.row { display: flex; ${story ? "flex-direction: column; gap: 0;" : "gap: 6px;"} }
figure { margin: 0; width: ${cardW}px; display: flex; ${story ? "flex-direction: row; align-items: center; gap: 24px;" : "flex-direction: column; align-items: center;"} }
figure img { width: ${story ? 270 : cardW}px; height: ${story ? 270 : small ? 250 : cardW + 40}px; object-fit: contain; filter: drop-shadow(0 0 26px #ffd65b55) drop-shadow(0 10px 16px #000a); }
figcaption { font: 800 ${small ? 32 : story ? 52 : 40}px/1 B; text-transform: uppercase; text-align: ${story ? "left" : "center"}; }
figcaption small { display: block; margin-top: 8px; font: 700 ${small ? 18 : story ? 28 : 22}px/1 B; letter-spacing: .1em; color: #ffd65b; }`,
    )
  );
}

const LAYOUTS = {
  art: artPost,
  shot: shotPost,
  roster: rosterPost,
  champion: championPost,
  skins: skinsPost,
};

/** The profile picture: the app icon's circle-safe (maskable) drawing. */
async function avatar(page) {
  const src = at("apps/client/public/icons/arena-maskable-512.png");
  const html = `<style>html,body{margin:0;background:#0b1020}img{width:1080px;height:1080px;display:block}</style><img src="file://${src}">`;
  await shoot(
    page,
    html,
    [1080, 1080],
    path.join(OUT, "profile-picture.png"),
    "png",
  );
}

async function shoot(page, html, [w, h], file, type = "jpeg") {
  const sheet = path.join(OUT, ".page.html");
  writeFileSync(sheet, `<!doctype html><meta charset="utf-8">${html}`);
  await page.setViewportSize({ width: w, height: h });
  await page.goto("file://" + sheet, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: file,
    type,
    ...(type === "jpeg" && { quality: 92 }),
  });
}

const only = process.env.POSTS?.split(",").map(Number);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const page = await browser.newPage();
if (!only) await avatar(page);
for (const post of POSTS) {
  if (only && !only.includes(post.id)) continue;
  const needs = post.art?.file;
  if (needs && !existsSync(at(needs))) {
    console.warn(`skipped post ${post.id} (${post.name}): ${needs} missing`);
    continue;
  }
  for (const [size, dims] of Object.entries(SIZES)) {
    const body = LAYOUTS[post.kind](post, size);
    const html = `<style>${BASE} :root { --w: ${dims[0]}px; --h: ${dims[1]}px; }</style><div class="page">${body}</div>`;
    const file = path.join(
      OUT,
      `${String(post.id).padStart(2, "0")}-${post.name}-${size}.jpg`,
    );
    await shoot(page, html, dims, file);
  }
  console.log(`post ${post.id}: ${post.name}`);
}
await browser.close();
