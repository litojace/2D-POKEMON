// The Instagram starter pack (docs/instagram.md): the profile picture and
// the posts, each at the three sizes Instagram shows, in the
// game's look, Poster (docs/ui-themes.md): the fighter's element colour with
// its halftone, ink slabs and a white stripe, white clippings with hard
// offset shadows, Anton capitals and Archivo text. Everything comes from the
// game itself: its rules (packages/shared), fonts, fighters' drawings,
// painted art and real captures.
//
//   npx playwright test --config scripts/instagram/playwright.config.ts   # battles, skins, music, the report menu
//   python3 scripts/instagram/make-reel.py
//   npx tsx scripts/instagram/make-posts.mjs            # -> instagram/
//
// The first command records, in Poster, the real battles as a phone shows
// them, whole screen and touch controls included (battles.spec.ts, the
// website's scenes), the Mythical skins, the game's music and its menu;
// make-reel.py cuts the skins' Reel and stills (post 8). A post whose capture is missing is skipped with
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
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
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
 * A real battle as the player sees it: the whole phone screen, HUD,
 * joystick, skill buttons and scoreboard included, never cropped (owner,
 * 28 Nov), from battles.spec.ts at the owner's iPhone size held sideways
 * (2868 x 1320). Each frame is picked by eye from the scene's 37 (owner,
 * 27 Nov): a big move going off, with every fighter still in sight, never
 * one buried under a flash. Duels 8 (the charged beam into the lightning
 * field), teams 8 (Blaze charging in its rings, all four in sight; from 9
 * the pillar hides Blaze), free-for-all 11 (the chestnut storm, Sunny's
 * orb and Ink's tendrils), Spire 11 (the beam beside Echo Wombolder; from
 * 13 its flash covers it).
 */
const BATTLES = "instagram-clips/battles";
const screen = (file) => ({ file: `${BATTLES}/${file}` });
const PHONE_ASPECT = 2868 / 1320;
/**
 * A screen outside battle, whole, from screens.spec.ts (same phone, same
 * look): the Plaza in an Orb Shower with made-up players and their titles
 * over their names, every tier (#650; frame 14: every name and title in
 * sight, none behind a lamp post), Friends with made-up friends.
 * Coin counts are blurred where they stand (the owner's rule: no amounts of
 * the game's money outside the game).
 */
const ui = (file) => ({ file: `instagram-clips/screens/${file}` });

/** Painted art: the game's raid splash and loading art (1536 x 1024). */
const painting = (file, x = 50, y = 50) => ({ painting: file, x, y });

/**
 * The posts, numbered as planned. `kind` picks the layout:
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
    eyebrow: "Open beta · free in your browser",
    title: "Pick an element. Outplay your friends.",
    line: "18 original creatures, 9 elements. The iPhone and Android apps come later.",
  },
  {
    id: 2,
    name: "duels",
    kind: "shot",
    el: EL.water,
    art: screen("duels/008.png"),
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
    art: screen("teams/008.png"),
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
    art: screen("ffa/011.png"),
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
    art: screen("spire/011.png"),
    eyebrow: "The Spire",
    title: "70 floors. How high can you climb?",
    line: "Seven zones of ten floors, an elite halfway up and a boss at the top of each.",
  },
  {
    id: 10,
    name: "report-bugs",
    kind: "report",
    el: EL.light,
    // report.spec.ts captures the game's Menu and its report form.
    art: { file: "instagram-clips/report/menu.png" },
    boxes: "instagram-clips/report/boxes.json",
    eyebrow: "Open beta",
    title: "Found a bug? Tell us.",
    line: "In the game: tap the gear, then Report a problem (with a free account). Or tell us in the comments. Every report gets read.",
  },
  {
    id: 12,
    name: "plaza",
    kind: "shot",
    el: EL.shadow,
    art: ui("plaza/14.png"),
    eyebrow: "The Plaza · up to 40 players",
    title: "Hang out between fights.",
    line: "Bounce pads, a ball pitch, a dash track, a photo spot, and an Orb Shower every 15 minutes.",
  },
  {
    id: 13,
    name: "friends",
    kind: "shot",
    // Blue: the Lobby behind the sheet is Pyranda's orange.
    el: EL.water,
    art: ui("friends/00.png"),
    eyebrow: "Friends",
    title: "Bring your friends.",
    line: "Share your code, invite them to your room, or watch their match live.",
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
.play span { display: block; transform: skewX(10deg); font: 400 46px/1 Anton; text-transform: uppercase; letter-spacing: .02em; color: #ffd65b; white-space: nowrap; }
/* PLAY's word is gold for every fighter, as the game's PLAY (#673). */
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
.words h1 { color: #fff; font-size: ${size === "square" ? 84 : 100}px; }
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
 * A battle's whole phone screen as a white clipping on the element colour.
 * The clipping takes the room the words leave, up to its full width, so a
 * title that wraps to three lines shrinks the picture instead of running
 * into it.
 */
function shotPost(post, size) {
  const cardW = size === "square" ? 700 : 880;
  return (
    `<div class="halftone"></div>` +
    flow(
      size,
      `<div class="chip">${post.eyebrow}</div><h1>${post.title}</h1>`,
      `<div class="clip shot"><div class="window"><img src="${url(post.art.file)}"></div></div>`,
      `<p>${post.line}</p>${PLAY}`,
      `.shot { flex: none; padding: 10px; height: min(100%, ${Math.round(cardW / PHONE_ASPECT) + 20}px); transform: rotate(-1.5deg); }
.window { position: relative; height: 100%; aspect-ratio: 2868 / 1320; overflow: hidden; }
.window img { width: 100%; height: 100%; display: block; }`,
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
      // Each skill's button as the game draws it in battle (kit.spec.ts;
      // owner, 28 Nov: show what the skill buttons look like).
      ([name, text], i) =>
        `<li class="${i === post.moves.length - 1 ? "ult" : ""}"><img class="key" src="${url(`instagram-clips/kit/${c.id}/${i}.png`)}" alt=""><b>${name}</b><span>${text}</span></li>`,
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
li { display: grid; grid-template-columns: ${small ? 76 : 108}px 1fr; column-gap: ${small ? 14 : 18}px; row-gap: 2px; align-items: center; padding: ${small ? "8px 14px" : "8px 18px"}; background: #fff; border: 4px solid var(--ink); box-shadow: 8px 8px 0 rgba(0,0,0,.3); }
li .key { grid-row: span 2; width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 50%; }
li b { align-self: end; } li span { align-self: start; }
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
  // Feed and story: the drawing placed on its own, beside the name in the
  // feed and the story, so the taller list
  // (each move with its button) never shrinks it.
  const hero =
    size === "story"
      ? `.hero { inset: auto; right: 10px; top: 330px; width: 600px; height: 600px; }`
      : `.hero { inset: auto; right: 10px; top: 150px; width: 560px; height: 560px; }`;
  return (
    back +
    flow(size, head, ``, `<ul>${moves}</ul>`, css + hero) +
    `<img class="hero" src="${drawing(c.id)}">`
  );
}

/** The Mythicals at their Stage III ultimate, as white clippings. */
function skinsPost(post, size) {
  const small = size === "square";
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
  // One row at every size: a story has the height, and its width is the feed's.
  const cardW = small ? 236 : 262;
  return (
    `<div class="halftone"></div>` +
    flow(
      size,
      `<div class="chip">${post.eyebrow}</div><h1>${post.title}</h1>`,
      `<div class="row">${cards}</div>`,
      `<p>${post.line}</p>${PLAY}`,
      `.row { display: flex; gap: ${small ? 22 : 26}px; }
figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 22px; }
figure .clip { padding: 8px; transform: rotate(var(--tilt)); }
figure img { display: block; width: ${cardW}px; height: ${cardW}px; object-fit: cover; }
figcaption { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.name { background: var(--ink); padding: 6px 16px; transform: skewX(-10deg); }
.name span { display: block; transform: skewX(10deg); font: 400 ${small ? 26 : 32}px/1 Anton; text-transform: uppercase; color: var(--c); white-space: nowrap; }
figcaption small { font: 800 ${small ? 15 : 17}px/1 Archivo; text-transform: uppercase; letter-spacing: .1em; color: var(--ink); }`,
    )
  );
}

/**
 * The open beta's "found a bug?" post: the game's Menu as one clipping,
 * with rings on the two things to tap (1 the gear, 2 Report a problem),
 * placed from where report.spec.ts found them (boxes.json). The coin count
 * is covered: no amounts of the game's money outside the game (owner,
 * 27 Nov, for the website).
 */
function reportPost(post, size) {
  const small = size === "square";
  const b = JSON.parse(readFileSync(at(post.boxes), "utf8"));
  // The crop: from the menu's left edge to the screen's right, from the top
  // to just under the menu (CSS pixels of the 844 x 390 capture).
  const c = { x: b.panel.x - 12, y: 0, w: 844 - (b.panel.x - 12) };
  c.h = b.panel.y + b.panel.height + 10;
  const pc = (v, of) => `${((v / of) * 100).toFixed(3)}%`;
  const place = (r, pad = 6) =>
    `left:${pc(r.x - pad - c.x, c.w)};top:${pc(r.y - pad - c.y, c.h)};width:${pc(r.width + 2 * pad, c.w)};height:${pc(r.height + 2 * pad, c.h)}`;
  return (
    `<div class="halftone"></div>` +
    flow(
      size,
      `<div class="chip">${post.eyebrow}</div><h1>${post.title}</h1>`,
      `<div class="clip shot"><div class="win"><img src="${url(post.art.file)}" style="width:${pc(844, c.w)};left:${pc(-c.x, c.w)};top:${pc(-c.y, c.h)}"><i class="cover" style="${place(b.coins, 0)}"></i><i class="ring" style="${place(b.gear)}"><b>1</b></i><i class="ring right" style="${place(b.report)}"><b>2</b></i></div></div>`,
      `<p>${post.line}</p>${PLAY}`,
      `.shot { flex: none; padding: 10px; height: min(100%, ${small ? 560 : 760}px); transform: rotate(-1.5deg); }
.win { position: relative; height: 100%; aspect-ratio: ${c.w} / ${c.h}; overflow: hidden; }
.win img { position: absolute; display: block; }
.cover { position: absolute; background: #0d0d0f; }
.ring { position: absolute; border: 5px solid var(--hot); box-shadow: 0 0 0 4px #fff; }
.ring.right b { right: auto; left: calc(100% + 10px); }
.ring b { position: absolute; right: calc(100% + 10px); top: 50%; transform: translateY(-50%); font: 400 44px/1 Anton; background: var(--hot-fill, #e0143a); color: #fff; padding: 4px 13px; box-shadow: 4px 4px 0 rgba(0,0,0,.5); }`,
    )
  );
}

/**
 * "Play it like an app" (owner, 27 Nov: the first posts show how to add
 * the game to the home screen, from a real phone, never drawings): the
 * owner's own iPhone screenshots, scrubbed and cropped by phone-howto.py
 * (instagram-clips/phone/steps.json), with a ring on what to tap. A
 * carousel (cover, five steps, done) and a story for each step.
 */
// phone-howto.py's scrubbed crops (committed; the raw screenshots never are).
const PHONE = "scripts/instagram/phone";
const STEP_TEXT = [
  [
    "Open the game in Safari",
    `Go to <b>play.elementarenausa.com</b>, then tap the button at the left end of the address bar.`,
  ],
  ["Tap Share", "It's near the top of the menu."],
  ["Tap View More", "At the end of the row of buttons."],
  ["Tap Add to Home Screen", "At the bottom of the list."],
  [
    "Keep Open as Web App on. Tap Add.",
    "The switch makes it open fullscreen, like an app.",
  ],
];

/** One screenshot crop as a dark phone clipping, its rings drawn on. */
function phoneShot(step, maxH) {
  const [w, h] = step.size;
  const rings = step.rings
    .map(
      ([x0, y0, x1, y1]) =>
        `<i class="ring" style="left:${x0 * 100}%;top:${y0 * 100}%;width:${(x1 - x0) * 100}%;height:${(y1 - y0) * 100}%"></i>`,
    )
    .join("");
  // A wide crop is held to the column's width (860 px of screen inside
  // the frame), a tall one to maxH.
  const tall = Math.min(maxH, Math.round((860 * h) / w) + 24);
  return `<div class="pshot" style="height:min(100%, ${tall}px)"><div class="win" style="aspect-ratio:${w} / ${h}"><img src="${url(`${PHONE}/${step.file}`)}">${rings}</div></div>`;
}
const PHONE_CSS = `
.pshot { flex: none; padding: 12px; background: var(--ink); border-radius: 34px; box-shadow: 14px 14px 0 rgba(0,0,0,.35); }
.pshot .win { position: relative; height: 100%; border-radius: 24px; overflow: hidden; }
.pshot img { width: 100%; height: 100%; display: block; object-fit: cover; }
.ring { position: absolute; border: 6px solid var(--hot); border-radius: 14px; box-shadow: 0 0 0 5px #fff, 0 0 30px rgba(255,46,77,.8); }
.chip.step { background: var(--ink); color: var(--el); }
p b { font-weight: 800; }
`;

function howtoStep(size, n, phone) {
  const [title, line] = STEP_TEXT[n];
  const story = size === "story";
  return (
    `<div class="halftone"></div>` +
    flow(
      size,
      `<div class="chip step">iPhone · Step ${n + 1} of 5</div><h1>${title}</h1>`,
      phoneShot(phone.steps[n], story ? 980 : 760),
      `<p>${line}</p>`,
      PHONE_CSS +
        `h1 { font-size: ${story ? 104 : 92}px; } p { font-size: ${story ? 38 : 34}px; }`,
    )
  );
}

/**
 * The icon on the home screen, over the game held sideways: our own
 * battle, the whole screen with its HUD and touch controls (the owner,
 * 28 Nov: not their screenshots, and never cropped). The icon sits above
 * the phone, so it covers nothing on its screen. The cover has the duel's
 * lightning field going off between both fighters, the last slide the
 * four-way fight's chestnut storm with all four in sight.
 */
const HOWTO_SHOTS = {
  cover: screen("duels/026.png"),
  done: screen("ffa/018.png"),
};
function iconAndGame(phone, size, shot, feedWidth = 800) {
  const w = size === "story" ? 900 : feedWidth;
  return `<div class="pair" style="width:${w}px"><div class="icon-shot"><img src="${url(`${PHONE}/${phone.icon.file}`)}"></div><div class="land" style="width:${w}px"><img src="${url(shot.file)}"></div></div>`;
}
const PAIR_CSS = `
.pair { position: relative; display: grid; justify-items: center; gap: 14px; }
.icon-shot { position: relative; z-index: 2; width: 170px; padding: 9px; background: var(--ink); border-radius: 26px; box-shadow: 8px 8px 0 rgba(0,0,0,.35); transform: rotate(-4deg); }
.icon-shot img { width: 100%; display: block; border-radius: 18px; }
.land { aspect-ratio: 2868 / 1320; border: 14px solid var(--ink); border-radius: 44px; overflow: hidden; box-shadow: 16px 16px 0 rgba(0,0,0,.35); transform: rotate(-1.5deg); background: var(--ink); }
.land img { width: 100%; height: 100%; display: block; }
p b { font-weight: 800; }
`;

function howtoCover(size, phone) {
  return (
    `<div class="halftone"></div>` +
    flow(
      size,
      `<div class="chip">Open beta · iPhone · 30 seconds</div><h1>Play it like an app.</h1>`,
      iconAndGame(phone, size, HOWTO_SHOTS.cover),
      `<p>Add Element Arena to your home screen: fullscreen, no download, one tap to open. <b>Swipe for the 5 steps.</b></p>`,
      PAIR_CSS,
    )
  );
}

function howtoDone(size, phone) {
  return (
    `<div class="halftone"></div>` +
    flow(
      size,
      `<div class="chip">Done</div><h1>Tap the icon. Turn it sideways. Play.</h1>`,
      // Narrower in the feed: the last slide's words take three lines.
      iconAndGame(phone, size, HOWTO_SHOTS.done, 720),
      `<p>Fullscreen, no browser bars. On Android: Chrome's menu, then <b>Install app</b>. Found a bug? Report it from the gear <b>(⚙)</b> in the game.</p>${PLAY}`,
      PAIR_CSS + `h1 { font-size: ${size === "story" ? 110 : 96}px; }`,
    )
  );
}

/** The carousel's slides and the stories: [file, size, body, colour]. */
function howto(id, phone) {
  const out = [
    [`${id}-1-feed.jpg`, "feed", howtoCover("feed", phone), EL.electric],
  ];
  for (let n = 0; n < 5; n++)
    out.push([
      `${id}-${n + 2}-feed.jpg`,
      "feed",
      howtoStep("feed", n, phone),
      EL.water,
    ]);
  out.push([`${id}-7-feed.jpg`, "feed", howtoDone("feed", phone), EL.fire]);
  for (let n = 0; n < 5; n++)
    out.push([
      `${id}-story-${n + 1}.jpg`,
      "story",
      howtoStep("story", n, phone),
      EL.water,
    ]);
  out.push([`${id}-story-6.jpg`, "story", howtoDone("story", phone), EL.fire]);
  return out;
}

const LAYOUTS = {
  art: artPost,
  shot: shotPost,
  roster: rosterPost,
  champion: championPost,
  skins: skinsPost,
  report: reportPost,
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
// The home-screen how-to (HOWTO=1 makes only it), once phone-howto.py has
// made its pictures from the owner's screenshots.
if (!only || process.env.HOWTO) {
  const steps = at(`${PHONE}/steps.json`);
  if (!existsSync(steps))
    console.warn("skipped the how-to: scripts/instagram/phone/ is missing");
  else {
    const phone = JSON.parse(readFileSync(steps, "utf8"));
    for (const [file, size, body, el] of howto("11-home-screen", phone)) {
      const [w, h] = SIZES[size];
      const html = `<style>${BASE} :root { --w: ${w}px; --h: ${h}px; }</style><div class="page" style="--el:${el}">${body}</div>`;
      await shoot(page, html, [w, h], path.join(OUT, file));
    }
    console.log("how-to: 7 slides, 6 stories");
  }
}
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
