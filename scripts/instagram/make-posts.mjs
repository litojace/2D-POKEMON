// The Instagram starter pack (docs/instagram.md): the profile picture and
// the first nine posts, each at the three sizes Instagram shows, in the
// game's look, Poster (docs/ui-themes.md): the fighter's element colour with
// its halftone, ink slabs and a white stripe, white clippings with hard
// offset shadows, Anton capitals and Archivo text. Everything comes from the
// game itself: its rules (packages/shared), fonts, fighters' drawings,
// painted art and real captures.
//
//   VISUAL_UI=poster npx playwright test --config scripts/site-clips/playwright.config.ts scripts/site-clips/scenes.spec.ts
//   npx playwright test --config scripts/instagram/playwright.config.ts
//   python3 scripts/instagram/make-reel.py
//   npx tsx scripts/instagram/make-posts.mjs            # -> instagram/
//
// The first command records the real battles in Poster (the same scenes as
// the website's "Ways to play"); the next two record the Mythical skins and
// cut their stills (post 8). A post whose capture is missing is skipped with
// a note. POSTS=1,4 renders only those. PW_CHROMIUM points at a Chromium
// already on the machine, as in tests/visual. Run with tsx: the champions'
// data is read from packages/shared.
//
// Sizes (1080 px wide, Instagram's upload width):
//   feed   1080 x 1350 (4:5, the tallest a feed post shows)
//   square 1080 x 1080 (1:1)
//   story  1080 x 1920 (9:16, Stories and Reels covers)
// The profile grid crops posts to 3:4, so every word keeps 84 px from the
// left and right edges of a feed post; a story keeps its words out of the
// top 260 px and bottom 330 px, where Instagram draws its own bars.
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHARACTERS } from "../../packages/shared/src/index";
import { CHAMPION_SKINS } from "../../packages/shared/src/shop";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const OUT = path.join(ROOT, "instagram");
// A file page, so it may load the repo's files (setContent's blank page may not).
const TMP = mkdtempSync(path.join(tmpdir(), "instagram-"));
const at = (p) => path.join(ROOT, p);
const url = (p) => "file://" + at(p);

const SIZES = {
  feed: [1080, 1350],
  square: [1080, 1080],
  story: [1080, 1920],
};

/** A champion as the posts need it; `el` is its colour, as the Lobby's --el. */
const champ = (id) => {
  const c = CHARACTERS[id];
  return { ...c, el: "#" + c.color.toString(16).padStart(6, "0") };
};
/** The game's element colours (apps/client/src/ui/tokens.css, --el-*). */
const EL = {
  electric: "#ffd84a",
  fire: "#ff7a45",
  water: "#4fb3ff",
  aura: "#7fe7ff",
  light: "#fff1a8",
  psychic: "#c47dff",
  earth: "#c8955a",
  shadow: "#8a6bff",
  nature: "#7fcf6a",
};

/**
 * A real capture of the game (2622 x 1206), cropped to 16:9 like make-scenes.py.
 * Each post's frame is picked by eye from the scene's 37 (owner, 27 Nov): a
 * big move going off, with every fighter still in sight, never one buried
 * under a flash. Duels 8 (the charged beam into the lightning field; from 14
 * on the flash hides Frost), teams 8 (from 9 the pillar's glow hides Blaze),
 * free-for-all 11 (the chestnut storm, Sunny's orb and Ink's tendrils, all
 * four in sight), Spire 15 (the beam beside Echo Wombolder, not on it).
 */
const capture = (file, cx, cy, share) => ({ file, cx, cy, share });
const SCENES = "site-clips/scenes";

/** Painted art: the game's raid splash and loading art (1536 x 1024). */
const painting = (file, x = 50, y = 50) => ({ painting: file, x, y });

/**
 * The nine posts, in posting order. `kind` picks the layout:
 * - "art": a painting full bleed above an ink slab that carries the words,
 * - "shot": a real capture of the game as a white clipping on the element
 *   colour,
 * - "roster", "champion", "skins": the fighters themselves.
 * `el` is the post's colour (what the Lobby's --el would be); a champion's
 * post takes the champion's.
 */
const POSTS = [
  {
    id: 1,
    name: "welcome",
    kind: "art",
    el: EL.electric,
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
    el: EL.water,
    art: capture(`${SCENES}/duels/008.png`, 0.53, 0.47, 0.42),
    eyebrow: "1v1 duels",
    title: "Dodge. Dash. Land the big one.",
    line: "Every fight is live: aim your skills, read your rival, time your ultimate.",
  },
  {
    id: 3,
    name: "roster",
    kind: "roster",
    el: EL.electric,
    eyebrow: "Meet the champions",
    title: "18 creatures.",
    accent: "9 elements.",
    line: "Who are you picking first?",
  },
  {
    id: 4,
    name: "raid-lumiwick",
    kind: "art",
    el: EL.fire,
    art: painting("apps/client/src/art/raid-splash/emberwing.webp", 50, 40),
    eyebrow: "Raid boss · Lumiwick",
    title: "Seven bosses, seven puzzles.",
    line: "Every boss has one trick to learn. Solve it solo or with up to three friends.",
  },
  {
    id: 5,
    name: "teams",
    kind: "shot",
    el: EL.nature,
    art: capture(`${SCENES}/teams/008.png`, 0.5, 0.36, 0.56),
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
    // The skills, said short; the full text is the game's (packages/shared).
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
    el: EL.psychic,
    art: capture(`${SCENES}/ffa/011.png`, 0.57, 0.4, 0.46),
    eyebrow: "Free-for-all",
    title: "Four fighters. One winner.",
    line: "Everyone against everyone in the Ember Forge.",
  },
  {
    id: 8,
    name: "skins",
    kind: "skins",
    el: EL.light,
    // The stills make-reel.py cut from the fitting room at Stage III.
    skins: ["pyranda-harvest-moon", "tidefin-moontide", "cindrake-sunforged"],
    eyebrow: "The Shop · Mythical skins",
    title: "Walk in a legend.",
    line: "Their own entrance, victory and ultimate. All cosmetic, never stronger.",
  },
  {
    id: 9,
    name: "spire",
    kind: "shot",
    el: EL.aura,
    art: capture(`${SCENES}/spire/015.png`, 0.47, 0.61, 0.48),
    eyebrow: "The Spire",
    title: "70 floors. How high can you climb?",
    line: "Seven zones of ten floors, an elite halfway up and a boss at the top of each.",
  },
];

const ICON = url("apps/client/public/icons/arena-512.png");
/** The game's name: a skewed ink block, as the Lobby's LOBBY / PLAZA tab. */
const LOGO = `<div class="logo"><span><img src="${ICON}">Element Arena</span></div>`;
/** Where to play: the Lobby's PLAY, an ink block with the red bar under it. */
const PLAY = `<div class="play"><span>Play free · link in bio</span></div>`;

const BASE = `
@font-face { font-family: Anton; font-weight: 400; src: url(${url("apps/client/public/assets/fonts/anton-latin-400-normal.woff2")}); }
@font-face { font-family: Archivo; font-weight: 100 900; src: url(${url("apps/client/public/assets/fonts/archivo-latin-wght-normal.woff2")}); }
* { box-sizing: border-box; }
:root { --ink: #0d0d0f; --hot: #ff2e4d; font-synthesis: none; }
html, body { margin: 0; overflow: hidden; background: var(--ink); color: var(--ink); }
.page { position: relative; width: var(--w); height: var(--h); overflow: hidden; background: var(--el); }
/* The Lobby's halftone (lobby.css), at this canvas's scale. */
.halftone { position: absolute; inset: 0; background: radial-gradient(circle, rgba(0,0,0,.16) 2.8px, transparent 3.6px) 0 0 / 18px 18px, var(--el); }
.halftone::after { content: ""; position: absolute; inset: 0; background: radial-gradient(55% 45% at 50% 52%, var(--el) 25%, transparent 75%); }
.logo { align-self: flex-start; display: inline-block; background: var(--ink); padding: 10px 26px 10px 14px; transform: skewX(-10deg); box-shadow: 8px 8px 0 rgba(0,0,0,.35); }
.logo span { display: flex; align-items: center; gap: 16px; transform: skewX(10deg); font: 400 44px/1 Anton; text-transform: uppercase; letter-spacing: .02em; color: #fff; }
.logo img { width: 60px; height: 60px; border: 3px solid #fff; }
.chip { align-self: flex-start; background: var(--ink); color: #fff; font: 800 28px/1 Archivo; text-transform: uppercase; letter-spacing: .06em; padding: 10px 16px; }
h1 { margin: 0; font: 400 124px/.92 Anton; text-transform: uppercase; color: var(--ink); text-wrap: balance; }
p { margin: 0; font: 600 34px/1.3 Archivo; color: var(--ink); text-wrap: pretty; }
.play { align-self: flex-start; background: var(--ink); padding: 18px 40px; transform: skewX(-10deg); box-shadow: 12px 10px 0 var(--hot); }
.play span { display: block; transform: skewX(10deg); font: 400 46px/1 Anton; text-transform: uppercase; letter-spacing: .02em; color: var(--el); white-space: nowrap; }
/* A word huge and outlined behind the picture, as the Lobby's fighter name. */
.big { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-7deg); font: 400 var(--big, 420px)/.8 Anton; text-transform: uppercase; white-space: nowrap; color: rgba(255,255,255,.42); -webkit-text-stroke: 4px rgba(13,13,15,.55); }
/* A white clipping: the Lobby's cards. */
.clip { position: relative; background: #fff; border: 5px solid var(--ink); box-shadow: 14px 14px 0 rgba(0,0,0,.35); }
`;

/** Where the words go on each size: the flow's top and bottom. */
const SAFE = {
  feed: { top: 72, bottom: 72 },
  square: { top: 60, bottom: 60 },
  story: { top: 260, bottom: 330 },
};
/** Smaller type for the square, where the words have less room. */
const SQUARE = `h1 { font-size: 96px; } p { font-size: 28px; } .chip { font-size: 23px; }
.play { padding: 14px 30px; } .play span { font-size: 36px; } .logo span { font-size: 34px; } .logo img { width: 46px; height: 46px; }`;

/**
 * The page as a column inside the safe area: the words on top, the picture
 * in the middle taking what room is left, the words at the bottom. Nothing
 * can overlap, whatever a title wraps to.
 */
function flow(size, head, middle, foot, css = "") {
  const { top, bottom } = SAFE[size];
  return `
<style>
.flow { position: absolute; left: 84px; right: 84px; top: ${top}px; bottom: ${bottom}px; display: flex; flex-direction: column; gap: ${size === "story" ? 44 : size === "square" ? 20 : 30}px; }
.head, .foot { display: flex; flex-direction: column; gap: ${size === "square" ? 14 : 20}px; }
.head .logo { margin-bottom: ${size === "story" ? 30 : size === "square" ? 4 : 12}px; }
.mid { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; position: relative; }
${size === "square" ? SQUARE : ""}
${css}
</style>
<div class="flow"><div class="head">${LOGO}${head}</div><div class="mid">${middle}</div><div class="foot">${foot}</div></div>`;
}

/**
 * A painting full bleed, an ink slab with a slanted top edge and the white
 * stripe along it (the Lobby's slab, turned to run across), the words on it.
 */
function artPost(post, size) {
  const { top, bottom } = SAFE[size];
  // Where the slab's top edge meets the left and right sides.
  const slab = { feed: [700, 610], square: [560, 480], story: [1080, 990] }[
    size
  ];
  return `
<style>
img.art { position: absolute; left: 0; top: 0; width: 100%; height: ${slab[0] + 40}px; object-fit: cover; object-position: ${post.art.x}% ${post.art.y}%; }
.slab { position: absolute; inset: 0; background: var(--ink); clip-path: polygon(0 ${slab[0]}px, 100% ${slab[1]}px, 100% 100%, 0 100%); }
.stripe { position: absolute; inset: 0; background: #fff; clip-path: polygon(0 ${slab[0] - 16}px, 100% ${slab[1] - 16}px, 100% ${slab[1] - 6}px, 0 ${slab[0] - 6}px); }
.words { position: absolute; left: 84px; right: 84px; bottom: ${bottom}px; display: flex; flex-direction: column; gap: ${size === "square" ? 14 : 22}px; }
.words .chip { background: var(--el); color: var(--ink); }
.words h1 { color: #fff; font-size: ${size === "square" ? 84 : size === "story" ? 116 : 100}px; }
.words p { color: #d8d8de; font-size: ${size === "square" ? 28 : 32}px; }
.words .play { background: var(--el); margin-top: 6px; }
.words .play span { color: var(--ink); }
${size === "square" ? SQUARE.replace(/h1 \{[^}]*\}/, "") : ""}
</style>
<img class="art" src="${url(post.art.painting)}"><div class="slab"></div><div class="stripe"></div>
<div style="position:absolute;left:84px;top:${top}px">${LOGO}</div>
<div class="words"><div class="chip">${post.eyebrow}</div><h1>${post.title}</h1><p>${post.line}</p>${PLAY}</div>`;
}

/**
 * The 16:9 crop of a capture as CSS for an <img> in a 16:9 window, in
 * shares of the window, so the window can take whatever size fits.
 */
function cropStyle({ cx, cy, share }) {
  const [iw, ih] = [2622, 1206];
  const cw = share * iw;
  const ch = (cw * 9) / 16;
  const x0 = Math.min(Math.max(0, cx * iw - cw / 2), iw - cw);
  const y0 = Math.min(Math.max(0, cy * ih - ch / 2), ih - ch);
  const pc = (v) => `${(v * 100).toFixed(3)}%`;
  return `width:${pc(iw / cw)};left:${pc(-x0 / cw)};top:${pc(-y0 / ch)}`;
}

/**
 * A capture as a white clipping on the element colour. The clipping takes
 * the room the words leave, up to its full width, so a title that wraps to
 * three lines shrinks the picture instead of running into it.
 */
function shotPost(post, size) {
  const cardW = size === "square" ? 700 : 880;
  return (
    `<div class="halftone"></div>` +
    flow(
      size,
      `<div class="chip">${post.eyebrow}</div><h1>${post.title}</h1>`,
      `<div class="clip shot"><div class="window"><img src="${url(post.art.file)}" style="${cropStyle(post.art)}"></div></div>`,
      `<p>${post.line}</p>${PLAY}`,
      `.shot { flex: none; padding: 10px; height: min(100%, ${(cardW * 9) / 16 + 30}px); transform: rotate(-1.5deg); }
.window { position: relative; height: 100%; aspect-ratio: 16 / 9; overflow: hidden; }
.window img { position: absolute; height: auto; }`,
    )
  );
}

/** A fighter's full drawing (the game's own, as on the selection screen). */
const drawing = (id) =>
  url(`apps/client/public/assets/fighters/${id}/selection.svg`);

/** The roster: ink, every fighter on a tile in its element's colour. */
function rosterPost(post, size) {
  const small = size === "square";
  const story = size === "story";
  const cell = story ? 140 : small ? 112 : 136;
  // Two per element, in the game's element order (as the Fighters screen).
  const order = Object.keys(EL);
  const cells = Object.keys(CHARACTERS)
    .sort(
      (a, b) =>
        order.indexOf(CHARACTERS[a].element.toLowerCase()) -
        order.indexOf(CHARACTERS[b].element.toLowerCase()),
    )
    .map((id) => {
      const c = champ(id);
      const el = EL[c.element.toLowerCase()];
      return `<figure style="--tile:${el}"><span class="tile"><img src="${drawing(id)}"></span><figcaption>${c.name}<small>${c.element}</small></figcaption></figure>`;
    })
    .join("");
  return (
    `<div class="ink"></div>` +
    flow(
      size,
      `<div class="chip">${post.eyebrow}</div><h1>${post.title} <em>${post.accent}</em></h1>`,
      `<div class="grid">${cells}</div>`,
      `<div class="row"><p>${post.line}</p>${PLAY}</div>`,
      `.ink { position: absolute; inset: 0; background: radial-gradient(circle, rgba(255,255,255,.06) 2.8px, transparent 3.6px) 0 0 / 18px 18px, var(--ink); }
.chip { background: var(--el); color: var(--ink); }
.logo { box-shadow: 8px 8px 0 var(--hot); }
h1 { color: #fff; } h1 em { font-style: normal; color: var(--el); }
p { color: #d8d8de; }
.play { background: var(--el); } .play span { color: var(--ink); }
.grid { display: grid; grid-template-columns: repeat(6, ${cell}px); gap: ${story ? "26px 12px" : small ? "4px 18px" : "16px 12px"}; }
figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.tile { display: block; width: ${cell}px; height: ${cell}px; background: radial-gradient(circle, rgba(0,0,0,.16) 1.6px, transparent 2.2px) 0 0 / 10px 10px, var(--tile); border: 3px solid #fff; box-shadow: 6px 6px 0 rgba(255,255,255,.12); }
.tile img { width: 100%; height: 100%; object-fit: contain; }
figcaption { font: 400 ${small ? 21 : 26}px/1 Anton; text-transform: uppercase; color: #fff; text-align: center; }
figcaption small { display: block; margin-top: 4px; font: 800 ${small ? 13 : 16}px/1 Archivo; text-transform: uppercase; letter-spacing: .08em; color: var(--tile); }
.row { display: flex; ${story ? "flex-direction: column; gap: 22px;" : "align-items: center; justify-content: space-between; gap: 24px;"} }`,
    )
  );
}

/** A champion as the Lobby shows one: its name huge behind it, its kit below. */
function championPost(post, size) {
  const c = champ(post.champion);
  const small = size === "square";
  const moves = post.moves
    .map(
      ([name, text], i) =>
        `<li class="${i === post.moves.length - 1 ? "ult" : ""}"><b>${name}</b><span>${text}</span></li>`,
    )
    .join("");
  const head = `<div class="chip">${post.eyebrow}</div><div class="plate"><span>${c.name}</span></div><div class="tags"><span class="tag">${c.element}</span><span class="tag ink">${c.role}</span></div>`;
  const css = `.plate { align-self: flex-start; background: var(--ink); padding: 8px 34px; transform: skewX(-10deg); box-shadow: 10px 10px 0 rgba(0,0,0,.35); }
.plate span { display: block; transform: skewX(10deg); font: 400 ${small ? 88 : 112}px/1 Anton; text-transform: uppercase; color: var(--el); }
.tags { display: flex; gap: 10px; }
.tag { background: #fff; color: var(--ink); font: 800 ${small ? 20 : 24}px/1 Archivo; text-transform: uppercase; letter-spacing: .12em; padding: 10px 16px; }
.tag.ink { background: var(--ink); color: #fff; }
.hero { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: ${small ? 10 : 12}px; }
li { display: grid; gap: 2px; padding: ${small ? "10px 16px" : "10px 20px"}; background: #fff; border: 4px solid var(--ink); box-shadow: 8px 8px 0 rgba(0,0,0,.3); }
li b { font: 400 ${small ? 28 : 32}px/1 Anton; text-transform: uppercase; color: var(--ink); }
li span { font: 600 ${small ? 20 : 24}px/1.25 Archivo; color: #2a2a30; }
li.ult { background: var(--ink); box-shadow: 8px 8px 0 var(--hot); }
li.ult b { color: var(--el); } li.ult span { color: #fff; }`;
  const back = `<div class="halftone"></div><div class="big" style="--big:${small ? 300 : 380}px">${c.name}</div>`;
  if (small)
    // Square: the drawing on the right, the words in a column on the left.
    return (
      back +
      flow(
        size,
        head,
        ``,
        `<ul style="width:560px">${moves}</ul>`,
        css +
          `.hero { inset: auto; right: 20px; top: 200px; width: 470px; height: 470px; }`,
      ) +
      `<img class="hero" src="${drawing(c.id)}">`
    );
  return (
    back +
    flow(
      size,
      head,
      `<img class="hero" src="${drawing(c.id)}">`,
      `<ul>${moves}</ul>`,
      css,
    )
  );
}

/** The Mythicals at their Stage III ultimate, as white clippings. */
function skinsPost(post, size) {
  const small = size === "square";
  const story = size === "story";
  const missing = post.skins.find(
    (id) => !existsSync(at(`instagram-clips/${id}/still.jpg`)),
  );
  if (missing)
    throw new Error(
      `instagram-clips/${missing}/still.jpg missing: run skins.spec.ts and make-reel.py first`,
    );
  const cards = post.skins
    .map((id, i) => {
      const s = CHAMPION_SKINS.find((x) => x.id === id);
      const c = champ(s.champion);
      const still = `instagram-clips/${id}/still.jpg`;
      return `<figure style="--c:${c.el}; --tilt:${[-2, 1.5, -1][i]}deg"><div class="clip"><img src="${url(still)}"></div><figcaption><span class="name"><span>${s.name}</span></span><small>${c.name} · Stage III</small></figcaption></figure>`;
    })
    .join("");
  const cardW = story ? 230 : small ? 236 : 262;
  return (
    `<div class="halftone"></div><div class="big" style="--big:${story ? 420 : 340}px">Mythical</div>` +
    flow(
      size,
      `<div class="chip">${post.eyebrow}</div><h1>${post.title}</h1>`,
      `<div class="row">${cards}</div>`,
      `<p>${post.line}</p>${PLAY}`,
      `.row { display: flex; ${story ? "flex-direction: column; gap: 26px;" : `gap: ${small ? 22 : 26}px;`} }
figure { margin: 0; display: flex; ${story ? "flex-direction: row; align-items: center; gap: 30px;" : "flex-direction: column; align-items: center; gap: 22px;"} }
figure .clip { padding: 8px; transform: rotate(var(--tilt)); }
figure img { display: block; width: ${cardW}px; height: ${cardW}px; object-fit: cover; }
figcaption { display: flex; flex-direction: column; align-items: ${story ? "flex-start" : "center"}; gap: 8px; }
.name { background: var(--ink); padding: 6px 16px; transform: skewX(-10deg); }
.name span { display: block; transform: skewX(10deg); font: 400 ${small ? 26 : story ? 46 : 32}px/1 Anton; text-transform: uppercase; color: var(--c); white-space: nowrap; }
figcaption small { font: 800 ${small ? 15 : story ? 22 : 17}px/1 Archivo; text-transform: uppercase; letter-spacing: .1em; color: var(--ink); }`,
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
  const html = `<style>html,body{margin:0;background:#0d0d0f}img{width:1080px;height:1080px;display:block}</style><img src="file://${src}">`;
  await shoot(
    page,
    html,
    [1080, 1080],
    path.join(OUT, "profile-picture.png"),
    "png",
  );
}

async function shoot(page, html, [w, h], file, type = "jpeg") {
  const sheet = path.join(TMP, "page.html");
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
  const el = post.el ?? champ(post.champion).el;
  for (const [size, dims] of Object.entries(SIZES)) {
    const body = LAYOUTS[post.kind](post, size);
    const html = `<style>${BASE} :root { --w: ${dims[0]}px; --h: ${dims[1]}px; }</style><div class="page" style="--el:${el}">${body}</div>`;
    const file = path.join(
      OUT,
      `${String(post.id).padStart(2, "0")}-${post.name}-${size}.jpg`,
    );
    await shoot(page, html, dims, file);
  }
  console.log(`post ${post.id}: ${post.name}`);
}
await browser.close();
