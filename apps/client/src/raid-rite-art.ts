import type { RaidRite } from "../../../packages/shared/src/raid";

// Filled pictograms connect an action to its result. The small characters mean
// nearby allies, not a particular champion or an unrelated elemental skill.
const arrow = (x: number, y: number, width = 20) =>
  `<path d="M${x} ${y}h${width}m-7-6 7 6-7 6" fill="none" stroke="#e6edf9" stroke-width="3"/>`;
const ally = (x: number, y: number, scale = 1) =>
  `<g transform="translate(${x} ${y}) scale(${scale})" fill="#dbe9fa" stroke="#263650" stroke-width="2"><circle cy="-9" r="7"/><path d="M-12 12v-6a12 12 0 0 1 24 0v6Z"/></g>`;
const shield = (x: number, y: number, scale = 1) =>
  `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0-25 23-16v18C23 19 0 31 0 31S-23 19-23 2v-18Z" fill="currentColor" fill-opacity=".22"/><path d="m-9 1 6 7 14-17" fill="none" stroke="#eafff7" stroke-width="4"/></g>`;
const bolt = (x: number, y: number, scale = 1) =>
  `<path transform="translate(${x} ${y}) scale(${scale})" d="m4-23-20 26H-2l-4 20L17-5H3Z" fill="#ffe6a3" stroke="#654c2d" stroke-width="2"/>`;
const heart = (x: number, y: number, scale = 1) =>
  `<path transform="translate(${x} ${y}) scale(${scale})" d="M0 21S-25 5-22-10C-20-23-6-24 0-14 7-24 21-23 23-10 26 5 13 13 0 21Z" fill="currentColor" fill-opacity=".32"/>`;
const plus = (x: number, y: number, scale = 1) =>
  `<path transform="translate(${x} ${y}) scale(${scale})" d="M-5-15H5v10h10V5H5v10H-5V5h-10V-5h10Z" fill="#baf7bd" stroke="#304c43" stroke-width="2"/>`;
const paw = (x: number, y: number, scale = 1) =>
  `<g transform="translate(${x} ${y}) scale(${scale})" fill="currentColor"><path d="M-13 9c0-8 7-18 13-18S13 1 13 9C13 20-13 20-13 9Z" fill-opacity=".38"/><ellipse cx="-16" cy="-13" rx="5" ry="7"/><ellipse cx="-6" cy="-23" rx="5" ry="7"/><ellipse cx="7" cy="-23" rx="5" ry="7"/><ellipse cx="17" cy="-13" rx="5" ry="7"/></g>`;
const fire = (x: number, y: number, scale = 1) =>
  `<path transform="translate(${x} ${y}) scale(${scale})" d="M0 21C-22 21-22 5-13-5c1 10 7 6 5-1C-10-15 1-25 4-27c-3 13 10 14 14 26 7 17-5 22-18 22Z" fill="#ffbe77" stroke="#80512e" stroke-width="2"/>`;
const eye = (x: number, y: number, scale = 1) =>
  `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M-25 0Q0-27 25 0 0 27-25 0Z" fill="currentColor" fill-opacity=".24"/><circle r="9" fill="#eaf6ff"/><circle r="4" fill="#27344e" stroke="none"/></g>`;
const rune = (x: number, y: number) =>
  `<path d="m${x} ${y - 9} 3 6 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z" fill="#ffe4a4" stroke="#654c2d" stroke-width="1.5"/>`;
const lantern = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><path d="M-10-20-5-28H5l5 8M0 16v12m-12 1h24" fill="none"/><rect x="-14" y="-20" width="28" height="36" rx="5" fill="#fff0b0" stroke="#8a7442" stroke-width="3"/>${fire(0, -1, 0.4)}</g>`;

const pictures: Record<RaidRite, { color: string; art: string }> = {
  shelter: {
    color: "#83e8cf",
    art: `<path d="M7 34h17M3 45h16M8 56h15" stroke-opacity=".7"/>${paw(34, 53, 0.7)}${arrow(53, 44, 17)}<ellipse cx="98" cy="77" rx="26" ry="10" fill="currentColor" fill-opacity=".13"/>${ally(87, 63, 0.58)}${ally(107, 63, 0.58)}${shield(97, 40, 1.05)}`,
  },
  sharing: {
    color: "#ffd86b",
    art: `<circle cx="30" cy="38" r="23" fill="currentColor" fill-opacity=".12"/><circle cx="30" cy="38" r="15" fill="#ffeab0" stroke="#806a36"/>${bolt(30, 38, 0.5)}<path d="M55 39h17l15-17m-15 17 15 20" fill="none"/>${ally(104, 30, 0.75)}${ally(104, 72, 0.75)}${bolt(91, 20, 0.32)}${bolt(91, 63, 0.32)}`,
  },
  core: {
    color: "#ffb17d",
    art: `<path d="m76 12 28 9 17 29-17 30H70L55 55l5-26Z" fill="#52637b" stroke="#a6b6ca"/><path d="m87 29 14 19-14 22-15-22Z" fill="currentColor"/><path d="m69 18 10 11-5 10m35 19-9 4 4 13" fill="none" stroke="#dbe4ef" stroke-opacity=".6"/><circle cx="87" cy="49" r="24" fill="none" stroke="#ffe8b4" stroke-dasharray="25 8"/><path d="m10 68 23-25 9 8-23 25-10 2Z" fill="#dceafa" stroke="#60788e"/><path d="m31 48 16-19 7 7-17 18" fill="#fff0bf" stroke="#9d7e47"/>${arrow(44, 48, 17)}<path d="m62 31 3 8m-5 18 7-4" stroke="#fff0bf"/>`,
  },
  rescue: {
    color: "#91d5ff",
    art: `<ellipse cx="27" cy="73" rx="22" ry="6" fill="currentColor" fill-opacity=".12"/><g transform="translate(27 59) rotate(-68)">${ally(0, 0, 0.9)}</g>${arrow(52, 45, 18)}${ally(95, 53, 1.25)}${plus(111, 22, 0.5)}<path d="M82 79h26" stroke="#baf7bd" stroke-width="5"/>`,
  },
  courage: {
    color: "#ffa0b6",
    art: `${heart(29, 39, 0.9)}<rect x="8" y="66" width="43" height="9" rx="4" fill="#28354e" stroke="#56657d"/><rect x="9" y="67" width="15" height="7" rx="3" fill="#ff8ca7" stroke="none"/><path d="M30 64v13" stroke="#e7edf8" stroke-dasharray="2 2"/>${arrow(56, 42, 15)}<path d="m86 61 21-42 11-3 2 12-27 38Z" fill="#ffe5e9" stroke="#a8657a"/><path d="m82 59 19 11m-15-7-8 13" stroke-width="5"/><path d="m107 60 8 5m-1-15 9 1m-10-19 7-4" stroke="#ffd9a5"/>`,
  },
  mending: {
    color: "#b2f598",
    art: `<circle cx="30" cy="43" r="21" fill="currentColor" fill-opacity=".12"/><path d="m30 14 7 14 15 4-11 12 1 17-12-8-13 8 1-17-11-12 16-4Z" fill="#ffe6a5" stroke="#8d7948"/>${arrow(56, 44, 15)}<ellipse cx="100" cy="76" rx="26" ry="10" fill="currentColor" fill-opacity=".2"/>${ally(88, 59, 0.74)}${ally(111, 59, 0.74)}${plus(100, 25, 0.65)}`,
  },
  grounded: {
    color: "#9fdfff",
    art: `${bolt(24, 35, 0.8)}<path d="M45 34h17" stroke="#ffe6a3" stroke-width="4"/>${ally(84, 48, 0.95)}${shield(84, 39, 0.9)}<path d="M84 69v12m-15 0h30m-24 7h18" stroke-width="3"/><path d="m111 31 8 8-8 9" stroke-opacity=".3"/><path d="m110 28 12 23" stroke="#ffb4c0" stroke-width="4"/>`,
  },
  fireproof: {
    color: "#ffbd83",
    art: `${fire(26, 64, 0.75)}${ally(33, 45, 0.65)}${shield(32, 38, 0.85)}${arrow(57, 44, 14)}${fire(100, 36, 0.85)}<path d="M79 55h42l-6 12H85Zm10 14-4 15m24-15 5 15M81 85h36" fill="#535d70" stroke="#c5cfda"/><path d="m81 25 7 7-7 7m-8-14 7 7-7 7" stroke="#ffe9ae"/>`,
  },
  polished: {
    color: "#ffe2a0",
    art: `<circle cx="19" cy="23" r="12" fill="#ffe9a6" stroke="#b3994e"/>${ally(43, 64, 0.9)}<path d="M22 28 43 51 106 36" stroke="#ffe9a6" stroke-width="4" fill="none"/><path d="m106 13 15 23-15 23-16-23Z" fill="#9edee9" stroke="#dff7ff"/><path d="M49 81h65m-58-5-7 5 7 5m51-10 7 5-7 5" stroke="#dceefb" fill="none"/><path d="m67 36 5-5 5 5" stroke-opacity=".5"/>`,
  },
  lucid: {
    color: "#c9a3ff",
    art: `<circle cx="29" cy="39" r="21" fill="currentColor" fill-opacity=".14"/><path d="m19 32 12-1-12 13h13m3-20h10l-10 10h10" fill="none" stroke="#e4dbfc"/><path d="m10 59 35-40" stroke="#ffb8c8" stroke-width="4"/>${arrow(56, 43, 12)}${eye(98, 37, 0.9)}<rect x="79" y="65" width="38" height="20" rx="6" fill="#28344e" stroke="currentColor"/>${rune(89, 74)}<path d="M104 72h7m-7 5h7" stroke="#64718a" stroke-width="2"/>`,
  },
  footing: {
    color: "#7fe9ff",
    art: `<path d="M5 70q9-7 18 0t18 0 18 0 18 0 18 0 18 0M7 82q9-6 18 0t18 0 18 0 18 0 18 0 18 0" fill="none" stroke-opacity=".6"/><circle cx="27" cy="32" r="17" fill="currentColor" fill-opacity=".12" stroke-dasharray="12 7"/><path d="m14 45 27-27" stroke="#ffb7c8" stroke-width="3"/>${paw(85, 46, 0.95)}<path d="M48 40h13m-17 10h16m45-20 9 6-9 6m-1 5 9 6-9 6" fill="none" stroke="#e0fbff"/>`,
  },
  lamplighter: {
    color: "#ffd65b",
    art: `<path d="M7 42h19m-7-6 7 6-7 6m2-19 5 4m-5 22 5-4" fill="none" stroke="#d9e8fc" stroke-width="3"/><circle cx="48" cy="38" r="29" fill="currentColor" fill-opacity=".08" stroke="none"/>${lantern(48, 43)}${arrow(72, 44, 12)}${heart(105, 45, 0.7)}${plus(105, 42, 0.45)}<path d="M94 76h23m-18-6v12m7-12v12m7-12v12" stroke="#baf7bd" stroke-width="2"/>`,
  },
};

export function raidRitePicture(id: RaidRite) {
  const { color, art } = pictures[id];
  return `<span class="raid-rite-icon" style="--rite-color:${color}"><svg data-rite-picture="${id}" viewBox="0 0 128 96" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${art}</svg></span>`;
}

/** The payoff is part of the emblem, not a separate sentence below it.
 * Text stays in HTML so small phone layouts retain readable, unscaled figures.
 * Rites without a numeric bonus show their actual mechanic instead. */
const buffs: Record<
  RaidRite,
  {
    art: string;
    value: string;
    unit: string;
    trigger: string;
    second?: { value: string; unit: string };
  }
> = {
  shelter: {
    art: `${paw(29, 62, 0.85)}${arrow(52, 51, 16)}<path d="m113 8 39 15v33c0 30-39 49-39 49S74 86 74 56V23Z" fill="currentColor" fill-opacity=".2"/>${ally(113, 32, 0.65)}`,
    value: "−25%",
    unit: "damage · 3s",
    trigger: "Dash → ward nearby allies",
  },
  sharing: {
    art: `<circle cx="28" cy="52" r="22" fill="#ffeab0" stroke="#806a36"/>${bolt(28, 52, 0.65)}${arrow(55, 51, 14)}<circle cx="113" cy="56" r="42" fill="currentColor" fill-opacity=".12"/>${ally(101, 29, 0.65)}${ally(125, 29, 0.65)}`,
    value: "+12",
    unit: "ult charge / ally",
    trigger: "Pick up energy → share charge",
  },
  core: {
    art: `<path d="m94 8 38 8 24 35-16 46-42 10-26-35 5-39Z" fill="#34465b" stroke="#a6b6ca"/><path d="m113 23 29 32-29 39-29-39Z" fill="currentColor" fill-opacity=".22"/><path d="m81 21 13 13-7 11m57 26-13 3 5 16" fill="none" stroke="#dbe4ef" stroke-opacity=".6"/><path d="m9 78 23-31 10 8-24 32-9 2 1-12m23-25 16-20 8 8-16 20" fill="#fff0bf" stroke="#9d7e47"/>${arrow(51, 51, 15)}`,
    value: "+8",
    unit: "damage · 1×/s",
    trigger: "Hit an exposed core",
  },
  rescue: {
    art: `<circle cx="40" cy="39" r="25" fill="currentColor" fill-opacity=".14"/><path d="M34 7h12m-6 7v8m0 17V25m0 14 11 6" fill="none"/>${heart(119, 40, 1.13)}${plus(119, 31, 0.45)}`,
    value: "+15%",
    unit: "revived HP",
    trigger: "Revive an ally",
    second: { value: "+35%", unit: "revive speed" },
  },
  courage: {
    art: `${heart(28, 42, 0.9)}<rect x="7" y="71" width="43" height="9" rx="4" fill="#28354e" stroke="#56657d"/><rect x="8" y="72" width="15" height="7" rx="3" fill="#ff8ca7" stroke="none"/><path d="M29 69v13" stroke="#e7edf8" stroke-dasharray="2 2"/>${arrow(55, 51, 13)}<path d="m83 74 45-58 15-2 1 15-51 54Z" fill="#ffe5e9" stroke="#a8657a"/><path d="m76 70 25 18m-15-10-9 13" stroke-width="5"/><rect x="74" y="47" width="78" height="48" rx="16" fill="#382c42" stroke-opacity=".6"/>`,
    value: "+20%",
    unit: "damage",
    trigger: "While below 50% HP",
  },
  mending: {
    art: `<path d="m28 22 7 14 15 4-11 12 1 17-12-8-13 8 1-17L5 40l16-4Z" fill="#ffe6a5" stroke="#8d7948"/>${arrow(55, 51, 13)}${heart(113, 51, 1.55)}${ally(103, 29, 0.55)}${ally(123, 29, 0.55)}`,
    value: "12%",
    unit: "ally HP healed",
    trigger: "Use ultimate → heal nearby allies",
  },
  grounded: {
    art: `${bolt(28, 51, 0.95)}${arrow(54, 51, 14)}<path d="m113 8 39 15v33c0 30-39 49-39 49S74 86 74 56V23Z" fill="currentColor" fill-opacity=".17"/><path d="m102 26 7 7-7 7m14-14 7 7-7 7m-16 0 25-16" fill="none" stroke="#ffb4c0"/>`,
    value: "NO",
    unit: "chain jumps",
    trigger: "Wrong polarity: normal damage",
  },
  fireproof: {
    art: `${fire(40, 40, 0.92)}${shield(40, 32, 0.62)}${fire(119, 32, 0.7)}<path d="M96 48h46l-7 12h-32Zm10 14-4 10m30-10 4 10" fill="#535d70" stroke="#c5cfda"/>`,
    value: "×2",
    unit: "brazier speed",
    trigger: "Resist fire · light braziers faster",
    second: { value: "−50%", unit: "ground dmg" },
  },
  polished: {
    art: `<circle cx="17" cy="28" r="12" fill="#ffe9a6" stroke="#b3994e"/>${ally(33, 68, 0.85)}<path d="m20 32 15 26 40-16" stroke="#ffe9a6" stroke-width="4" fill="none"/><path d="m113 8 39 43-39 53-39-53Z" fill="#4c7682" stroke="#b7f2fa"/><path d="m104 18 9 8 9-8" stroke-opacity=".6"/>`,
    value: "+60",
    unit: "relay range (px)",
    trigger: "Carry sunlight without burning",
  },
  lucid: {
    art: `<circle cx="28" cy="49" r="23" fill="currentColor" fill-opacity=".14"/><path d="M15 38h16L15 55h16m2-26h11l-11 11h11M10 69l37-42" fill="none" stroke="#e4dbfc"/>${arrow(56, 51, 12)}<rect x="73" y="13" width="80" height="89" rx="20" fill="currentColor" fill-opacity=".12"/>${eye(113, 32, 0.7)}`,
    value: "1st",
    unit: "rune revealed",
    trigger: "Dream Bubbles: no Drowsy",
  },
  footing: {
    art: `<circle cx="27" cy="45" r="21" fill="currentColor" fill-opacity=".12" stroke-dasharray="12 7"/><path d="m12 61 30-32M74 96q10-8 20 0t20 0 20 0 20 0M74 106q10-6 20 0t20 0 20 0 20 0" fill="none"/>${arrow(54, 51, 14)}${paw(113, 32, 0.62)}<rect x="73" y="47" width="80" height="46" rx="15" fill="#203b4b" stroke-opacity=".6"/>`,
    value: "+15%",
    unit: "water speed",
    trigger: "Bubbles cannot root you",
  },
  lamplighter: {
    art: `${lantern(29, 55)}<path d="M7 18h10m-5-5v10" stroke="#ffe9a6"/>${arrow(54, 51, 14)}${heart(113, 51, 1.55)}${plus(113, 27, 0.45)}`,
    value: "1%",
    unit: "HP / second",
    trigger: "1 hit relights · heal in lantern light",
  },
};

export function raidRiteBuffTrigger(id: RaidRite) {
  return buffs[id].trigger;
}

export function raidRiteBuffPicture(id: RaidRite) {
  const { color } = pictures[id],
    buff = buffs[id];
  const stat = (value: string, unit: string, second = false) =>
    `<span class="raid-rite-buff-stat${second ? " raid-rite-buff-stat--second" : ""}"><span class="raid-rite-buff-value">${value}</span><span class="raid-rite-buff-unit">${unit}</span></span>`;
  return `<span class="raid-rite-icon raid-rite-icon--buff${buff.second ? " raid-rite-icon--dual" : ""}" style="--rite-color:${color}" aria-hidden="true"><svg data-rite-picture="${id}" viewBox="0 0 160 116" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${buff.art}</svg>${stat(buff.value, buff.unit)}${buff.second ? stat(buff.second.value, buff.second.unit, true) : ""}</span>`;
}
