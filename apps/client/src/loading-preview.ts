/**
 * Startup curtain styles to choose from (loading-preview.html). Every style
 * uses the game's own art and tips: the current curtain (a), your fighter
 * beside the tip (b, like League of Legends' loading screen), a big
 * illustrated tip (c) and the front door's painting (d). A review page, not
 * part of the game. ?v=refs draws the painting brief's skins for reference
 * pictures (scripts/loading-art/export-references.mjs).
 */
import "./ui/tokens.css";
import "./style.css";
import "./server-connection.css";
import "./loading-preview.css";
import { CHARACTERS, ORB_SPOTS, RULES, type CharacterId } from "@arena/shared";
import { fighterStageArt, setWornSkins } from "./fighter-selection";
import { LOADING_TIPS, tipMarkup, type LoadingTip } from "./loading-tips";
import { LOADING_SCENES } from "./loading-art";
import starfield from "./art/startup-starfield.webp";
import {
  curtainStep,
  holdStartupCurtain,
  setCurtainTip,
} from "./server-connection";

const query = new URLSearchParams(location.search);
const style = query.get("v") ?? "a";
const fighter = (
  Object.hasOwn(CHARACTERS, query.get("f") ?? "") ? query.get("f") : "voltkit"
) as CharacterId;
const skin = query.get("skin");
if (skin)
  setWornSkins({
    [fighter]: { skin, stage: Number(query.get("stage") ?? 1) },
  });
const tip: LoadingTip =
  LOADING_TIPS.find((t) => t.id === query.get("tip")) ?? LOADING_TIPS[0];
const progress = Number(query.get("p") ?? 0.62);
const champion = CHARACTERS[fighter];
const hex = `#${champion.color.toString(16).padStart(6, "0")}`;

const title = `<h1 class="lp-title" aria-label="Element Arena"><span>ELEMENT</span><span>ARENA</span></h1>`;
const bar = (status: string) =>
  `<div class="lp-bar"><div class="server-startup-progress" style="--startup-progress:${progress}"><i></i></div><small>${status}</small></div>`;
const tipText = tip.text.replace(/(\d) (s\b)/g, "$1\u00a0$2");

/** The arena from above, large and moving: where and when the orbs appear. */
function arenaMap() {
  const [top, bottom] = ORB_SPOTS;
  const orb = (
    x: number,
    y: number,
    fill: string,
    label: string,
    time: string,
  ) =>
    `<g class="lp-orb" transform="translate(${x} ${y})"><circle class="lp-orb-halo" r="120" fill="${fill}"/><circle r="70" fill="${fill}"/><text y="30" text-anchor="middle" font-size="90" font-weight="800" fill="#06101f">${label}</text></g><text x="${x + 140}" y="${y + 6}" font-size="80" font-weight="700" fill="${fill}">${time}</text><text x="${x + 140}" y="${y + 78}" font-size="54" fill="#cfe0f5">then every ${RULES.orbInterval * 2}s</text>`;
  return `<svg class="lp-arena" viewBox="0 0 1600 900" aria-hidden="true"><rect x="20" y="20" width="1560" height="860" rx="90" fill="#0d2a33" stroke="#dfbd6b" stroke-width="14"/><line x1="800" y1="40" x2="800" y2="860" stroke="#dfbd6b55" stroke-width="8" stroke-dasharray="40 30"/><g fill="#6fb5ff"><circle cx="260" cy="450" r="46"/></g><text x="260" y="560" text-anchor="middle" font-size="60" fill="#9fcbff">YOU</text><circle cx="1340" cy="450" r="46" fill="#ff7a7a"/><text x="1340" y="560" text-anchor="middle" font-size="60" fill="#ffaaaa">RIVAL</text>${orb(top.x, top.y, "#7dffb0", "+", `0:${String(RULES.orbFirst).padStart(2, "0")}`)}${orb(bottom.x, bottom.y, "#ffd166", "⚡", `0:${String(RULES.orbFirst + RULES.orbInterval).padStart(2, "0")}`)}</svg>`;
}

const fighterArt = `<div class="lp-fighter" style="--el:${hex}">${fighterStageArt(fighter, "loading-preview")}</div>`;
const nameplate = `<div class="lp-name" style="--el:${hex}"><b>${champion.name}</b><span>${champion.element}</span></div>`;

const styles: Record<string, string> = {
  // b: your fighter, in your skin, beside the tip.
  b: `<section class="lp lp-b" style="--bg:url('${starfield}');--el:${hex}"><div class="lp-b-stage">${fighterArt}${nameplate}</div><div class="lp-b-side">${title}<div class="lp-tipcard"><b>TIP</b><p>${tipText}</p></div>${bar("Loading your profile…")}</div></section>`,
  // c: the tip is the picture.
  c: `<section class="lp lp-c" style="--bg:url('${starfield}')"><header>${title}<span class="lp-kicker">HOW THE ARENA WORKS</span></header>${arenaMap()}<p class="lp-c-text">${tipText}</p><div class="lp-dots">${LOADING_TIPS.map((t) => `<i class="${t.id === tip.id ? "on" : ""}"></i>`).join("")}</div>${bar("Loading your profile…")}</section>`,
  // d: the front door's painting and a caption (it already has Voltkit).
  d: `<section class="lp lp-d"><div class="lp-d-art"></div>${title}<div class="lp-d-caption"><div class="lp-d-tip"><b>TIP</b> ${tipText}</div>${bar("Loading your profile…")}</div></section>`,
};
/** The tip as a card. */
const tipCard = (compact = false) =>
  `<div class="lp-tipcard${compact ? " is-compact" : ""}"><b>TIP</b><p>${tipText}</p></div>`;
// e: your fighter (b) with the illustrated tip (c) when the tip has one.
styles.e = `<section class="lp lp-b lp-e" style="--bg:url('${starfield}');--el:${hex}"><div class="lp-b-stage">${fighterArt}${nameplate}</div><div class="lp-b-side">${title}${tipCard()}${bar("Loading your profile…")}</div></section>`;
// f: the Lobby to come: its blurred Plaza, your fighter where the Lobby will
// stand it, the tip where its cards will be, the bar where PLAY will be.
styles.f = `<section class="lp lp-f" style="--el:${hex}"><div class="lp-f-art"></div>${title}<div class="lp-f-fighter">${fighterArt}${nameplate}</div><div class="lp-f-side">${tipCard(true)}${bar("Loading your profile…")}</div></section>`;
/*
 * h-k: the painting layouts with a full-width bar and the gold star crest by
 * the title (the owner, 20 Nov), the tip short and text only:
 * h brand top right, tip mid right; i brand top left, tip above the bar on
 * the left; j brand top centre, tip above the bar in the middle; k brand top
 * right, tip above the bar on the right.
 */
const painting =
  query.get("art") ?? "/assets/backgrounds/elemental-horizon.webp";
const crest = `<svg class="lp-crest" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lp-crest-gold" x2="0" y2="1"><stop stop-color="#fff1a3"/><stop offset="1" stop-color="#d9a340"/></linearGradient></defs><path fill="url(#lp-crest-gold)" fill-rule="evenodd" d="M32 2 42 21 62 32 43 43 32 62 21 43 2 32 21 21Zm0 14L16 32l16 16 16-16Z"/></svg>`;
for (const v of ["h", "i", "j", "k"])
  styles[v] =
    `<section class="lp-x lp-x-${v}" style="--painting:url('${painting}')">` +
    `<header class="lp-x-brand">${crest}<h1 class="lp-title" aria-label="Element Arena"><span>ELEMENT</span><span>ARENA</span></h1></header>` +
    `<div class="lp-x-tip"><b>TIP</b> ${tipText}</div>` +
    `<footer class="lp-x-foot"><div class="lp-x-line"><span>Opening the arena…</span><small>Loading your profile…</small></div><div class="server-startup-progress" style="--startup-progress:${progress}"><i></i></div></footer>` +
    `</section>`;

/*
 * k2: k with a bigger crest and title, and one status line instead of two:
 * each startup step replaces the last (a short cross-fade), as the real
 * curtain's steps do (startup-curtain.ts STEPS), while the bar fills.
 */
const K2_STEPS: [string, number][] = [
  ["Connecting to the game server…", 0.1],
  ["Checking your account…", 0.3],
  ["Loading your profile…", 0.5],
  ["Entering Elemental Plaza…", 0.72],
  ["Preparing your fighter…", 0.88],
];
styles.k2 =
  `<section class="lp-x lp-x-k lp-x-k2" style="--painting:url('${painting}')">` +
  `<header class="lp-x-brand">${crest}<h1 class="lp-title" aria-label="Element Arena"><span>ELEMENT</span><span>ARENA</span></h1></header>` +
  `<div class="lp-x-tip"><b>TIP</b> ${tipText}</div>` +
  `<footer class="lp-x-foot"><div class="lp-x-status" role="status" aria-live="polite"><span>${K2_STEPS[0][0]}</span></div><div class="server-startup-progress" style="--startup-progress:${K2_STEPS[0][1]}"><i></i></div></footer>` +
  `</section>`;

// refs: every skin the painting brief uses, one per box, for
// scripts/loading-art/export-references.mjs to save as reference pictures.
if (style === "refs") {
  const skins = new Map<string, CharacterId>();
  for (const scene of LOADING_SCENES)
    for (const f of scene.fighters) skins.set(f.skin, f.champion);
  styles.refs = `<div class="lp-refs">${[...skins]
    .map(
      ([id, champion]) =>
        `<figure data-ref="${id}">${fighterStageArt(champion, `ref-${id}`, { skin: id, stage: 1 })}</figure>`,
    )
    .join("")}</div>`;
}
if (styles[style])
  document.querySelector("#loading-preview")!.innerHTML = styles[style];
// k2: walk through the steps (?step=<n> holds one, for a still).
if (style === "k2") {
  const line = document.querySelector<HTMLElement>(".lp-x-status")!;
  const meter = document.querySelector<HTMLElement>(
    ".lp-x-k2 .server-startup-progress",
  )!;
  const show = (n: number) => {
    const [text, amount] = K2_STEPS[n];
    const old = line.querySelector("span:not(.is-out)");
    old?.classList.add("is-out");
    setTimeout(() => old?.remove(), 300);
    line.insertAdjacentHTML("beforeend", `<span>${text}</span>`);
    meter.style.setProperty("--startup-progress", String(amount));
  };
  const held = query.get("step");
  if (held !== null) show(Math.min(K2_STEPS.length - 1, Number(held)));
  else {
    let n = 0;
    const next = () => {
      n = (n + 1) % K2_STEPS.length;
      show(n);
      setTimeout(next, n === K2_STEPS.length - 1 ? 2000 : 1100);
    };
    setTimeout(next, 1100);
  }
} else {
  // a: the curtain as it ships, drawn by its own code.
  holdStartupCurtain();
  setCurtainTip(tipMarkup(tip));
  curtainStep(progress, "Loading your profile…");
  // g: the curtain (a) with your fighter inside the crest's orbits.
  if (style === "g") {
    const art = document.querySelector<HTMLElement>(".server-startup-art")!;
    art.classList.add("lp-g-art");
    art.style.setProperty("--el", hex);
    art.querySelector("img")!.hidden = true;
    art.insertAdjacentHTML("beforeend", fighterArt);
  }
}
// f: placed as the Lobby places them (measured from lobby.css at these sizes).
const lobby = document.querySelector<HTMLElement>(".lp-f");
if (lobby) {
  const big = innerHeight >= 360;
  lobby.style.setProperty("--fx", `${big ? 238 : 165}px`);
  lobby.style.setProperty("--fy", `${big ? 94 : 116}px`);
  lobby.style.setProperty("--fs", `${big ? 228 : 136}px`);
  lobby.style.setProperty("--side", `${big ? 634 : 376}px`);
}
