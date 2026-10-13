import type { CharacterId } from "@arena/shared";
import type { Facing } from "./animation/controller";
export type CreaturePart =
  | "tail"
  | "wings"
  | "legL"
  | "legR"
  | "body"
  | "armL"
  | "armR"
  | "head"
  | "ears"
  | "eyes"
  | "scarf"
  | "flame";
export const creatureParts: CreaturePart[] = [
  "tail",
  "wings",
  "legL",
  "legR",
  "body",
  "armL",
  "armR",
  "head",
  "ears",
  "eyes",
  "scarf",
  "flame",
];
export const creaturePalette: Record<
  CharacterId,
  { light: string; mid: string; dark: string; glow: string }
> = {
  voltkit: {
    light: "#fff2a2",
    mid: "#efc63e",
    dark: "#36384e",
    glow: "#ffe778",
  },
  cindrake: {
    light: "#ffc39b",
    mid: "#ee7749",
    dark: "#963749",
    glow: "#ffe08a",
  },
  tidefin: {
    light: "#b1f6ff",
    mid: "#36b9d0",
    dark: "#235d95",
    glow: "#a7faff",
  },
  auralynx: {
    light: "#f3d9ff",
    mid: "#b386e8",
    dark: "#583e92",
    glow: "#f2b7ff",
  },
  thornback: {
    light: "#d6ef9a",
    mid: "#80b477",
    dark: "#385f58",
    glow: "#f7d989",
  },
  frostfang: {
    light: "#ffffff",
    mid: "#b8ddeb",
    dark: "#6892b4",
    glow: "#d8faff",
  },
  duskveil: {
    light: "#c8a1f2",
    mid: "#664c98",
    dark: "#272440",
    glow: "#c1a4ff",
  },
  terradon: {
    light: "#dac8ad",
    mid: "#988b83",
    dark: "#4c5363",
    glow: "#ffbc71",
  },
};
export function creatureLayers(id: CharacterId, dir: Facing) {
  const p = creaturePalette[id],
    prefix = `${id}-${dir}`;
  const back = dir === "up",
    profile = dir === "left" || dir === "right",
    side = dir === "left" ? -1 : 1;
  const body = `url(#${prefix}-body)`,
    face = `url(#${prefix}-face)`,
    pearl = `url(#${prefix}-pearl)`,
    jewel = `url(#${prefix}-jewel)`;
  const defs = `<defs>
    <radialGradient id="${prefix}-body" cx="27%" cy="17%" r="92%"><stop stop-color="${p.light}"/><stop offset=".38" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.dark}"/></radialGradient>
    <radialGradient id="${prefix}-face" cx="32%" cy="20%" r="83%"><stop stop-color="${p.light}"/><stop offset=".6" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.dark}"/></radialGradient>
    <radialGradient id="${prefix}-pearl" cx="30%" cy="12%"><stop stop-color="#ffffff"/><stop offset=".5" stop-color="${p.light}"/><stop offset="1" stop-color="${p.mid}"/></radialGradient>
    <linearGradient id="${prefix}-jewel" x2=".8" y2="1"><stop stop-color="#ffffff"/><stop offset=".28" stop-color="${p.glow}"/><stop offset="1" stop-color="${p.mid}"/></linearGradient>
    <radialGradient id="${prefix}-shine"><stop stop-color="#ffffff"/><stop offset=".4" stop-color="${p.glow}"/><stop offset="1" stop-color="${p.mid}"/></radialGradient>
  </defs>`;
  const e = (x: number, y: number, rx: number, ry: number, fill = body) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
  const crystal = (x: number, y: number, size: number) =>
    `<path d="m${x} ${y - size} ${size * 0.65} ${size} -${size * 0.65} ${size} -${size * 0.65} -${size}Z" fill="${jewel}"/><path d="M${x} ${y - size}V${y + size}" stroke="#fff" opacity=".5"/>`;
  const paw = (x: number, y: number, large = false) =>
    `<path d="M${x - 10} ${y - 19}q-7 12-5 24 15 9 30 0 2-13-5-24Z" fill="${body}"/>${e(x, y + 4, large ? 17 : 14, 9)}<path d="m${x - 7} ${y + 7}v4m7-4v5m7-5v4" stroke="${p.light}" stroke-width="2.5"/>`;
  const eye = (x: number) =>
    `<path d="M${x - 10} 80q10-6 19 0" stroke="${p.dark}" stroke-width="3" fill="none"/>${e(x, 88, 9, 12, "#102038")}${e(x + 1, 91, 5, 7, p.glow)}${e(x - 3, 84, 3.5, 4.5, "#ffffff")}<circle cx="${x + 4}" cy="94" r="1.5" fill="#fff"/>`;
  const eyes = back ? "" : profile ? eye(100 + side * 18) : eye(80) + eye(120);
  const muzzle = back
    ? ""
    : `${e(100, 109, 24, 11, pearl)}<path d="m95 104 5 5 5-5Z" fill="${p.dark}"/><path d="M90 111q5 7 10 0 5 7 10 0" stroke="${p.dark}" fill="none" stroke-width="1.7"/>`;
  const cheeks = `<path d="M63 92 51 99l11 5-7 9 15 1m67-22 12 7-11 5 7 9-15 1" fill="${face}"/>`;
  const layers: Record<CreaturePart, string> = {
    tail: "",
    wings: "",
    legL: paw(78, 161),
    legR: paw(122, 161),
    body: `${e(100, 139, 34, 29)}${back ? "" : e(100, 142, 19, 21, pearl)}<path d="M76 120q16-10 27-7" stroke="${p.light}" stroke-width="3" opacity=".65" fill="none"/>`,
    armL: paw(64, 143),
    armR: paw(136, 143),
    head: `${e(100, 88, 40, 32, face)}${cheeks}${muzzle}<path d="M73 68q12-8 25-7" stroke="${p.light}" stroke-width="4" stroke-linecap="round" opacity=".8" fill="none"/>`,
    ears: "",
    eyes,
    scarf: "",
    flame: "",
  };
  if (id === "voltkit") {
    layers.ears = `<path d="M77 69Q42 51 48 13q29 13 38 48m28 0q9-35 38-48 6 38-29 56" fill="${body}"/><path d="M76 57 56 25l3 23 13 16m52-7 20-32-3 23-13 16" fill="#292d43"/><path d="m57 26 10 16m76-16-10 16" stroke="${p.glow}" stroke-width="3"/>`;
    layers.scarf = `<path d="m69 111-12 10 18-1-7 14 19-5 13 14 13-14 19 5-7-14 18 1-12-10" fill="#35354b"/><path d="m83 115 17 15 17-15" stroke="${p.glow}" fill="none" stroke-width="3"/>`;
    layers.tail =
      side === 1 && profile
        ? `<path d="M72 142 44 137 52 117 29 99 42 73 63 96 54 112 81 128Z" fill="${body}"/><path d="m42 73 9 25-10 9" fill="#33354b"/>`
        : `<path d="M128 142 156 137 148 117 171 99 158 73 137 96 146 112 119 128Z" fill="${body}"/><path d="m158 73-9 25 10 9" fill="#33354b"/>`;
    layers.head += back
      ? ""
      : `<path d="m70 97-6 5 8 4m58-9 6 5-8 4" stroke="${p.glow}" fill="none" stroke-width="3"/>`;
  }
  if (id === "cindrake") {
    layers.ears = `<path d="M76 68 67 39 89 57m35 11 9-29-22 18" fill="${body}"/>`;
    layers.flame = `<path d="M78 66q-14-22 7-40-2 16 9 11 3-20 15-30-4 26 10 33l7-17q18 29-5 43Z" fill="${jewel}"/><path d="M91 63q-5-14 13-28-2 16 10 21l-6 8Z" fill="#fff1b0"/>`;
    layers.wings = `<path d="M71 121 35 91l3 27-14 10 24 7 20 12m61-26 36-30-3 27 14 10-24 7-20 12" fill="${body}"/><path d="m37 103 28 29m98-29-28 29" stroke="#ffd69b" opacity=".6" stroke-width="2"/>`;
    layers.tail =
      profile && side === 1
        ? `<path d="M74 145q-50 31-45-37 10 42 44 22Z" fill="${body}"/>${crystal(32, 96, 17)}`
        : `<path d="M126 145q50 31 45-37-10 42-44 22Z" fill="${body}"/>${crystal(168, 96, 17)}`;
    layers.scarf = `<path d="m70 114 14 13 16-9 16 9 14-13" fill="${jewel}"/>`;
  }
  if (id === "tidefin") {
    layers.ears = `<path d="M78 70Q53 57 62 21l21 25-6 12m46 12q25-13 16-49l-21 25 6 12" fill="${jewel}"/><path d="m65 32 9 23m61-23-9 23" stroke="#dfffff" stroke-width="2"/>`;
    layers.wings = `<path d="M66 82 31 61l12 27-20 9 23 9-9 21 37-18m60-27 35-21-12 27 20 9-23 9 9 21-37-18" fill="${jewel}"/><path d="M35 76 61 93 37 100m128-24-26 17 24 7" stroke="#efffff" fill="none" opacity=".65"/>`;
    layers.tail =
      profile && side === 1
        ? `<path d="M72 141Q18 168 27 92q11 34 44 36Z" fill="${body}"/><path d="m29 107-16-18 5 45 18 7Z" fill="${jewel}"/>`
        : `<path d="M128 141q54 27 45-49-11 34-44 36Z" fill="${body}"/><path d="m171 107 16-18-5 45-18 7Z" fill="${jewel}"/>`;
    layers.scarf = `<path d="M71 119q29 19 58 0l-4 13q-25 14-50 0Z" fill="${pearl}"/>`;
  }
  if (id === "auralynx") {
    layers.ears = `<path d="M76 69 57 20l32 30m35 19 19-49-32 30" fill="${pearl}"/><path d="m70 47-6-15 17 21m49-6 6-15-17 21" fill="${jewel}"/>${crystal(100, 39, 15)}`;
    layers.head = `${e(100, 89, 39, 31, pearl)}${cheeks}${muzzle}`;
    layers.scarf = `<path d="M67 109 58 127l20-4-1 15 23-13 23 13-1-15 20 4-9-18" fill="${jewel}"/>`;
    layers.wings = `${crystal(37, 89, 10)}${crystal(164, 104, 12)}<path d="M33 122q67 28 134-6" stroke="${p.glow}" opacity=".4" fill="none"/>`;
    layers.tail = `<path d="M130 143q31 20 40-8 7-23-13-25" fill="none" stroke="${p.mid}" stroke-width="14"/>${crystal(155, 106, 11)}`;
  }
  if (id === "thornback") {
    layers.body = `${e(100, 133, 45, 35)}<path d="m100 106 25 15-5 29-20 12-20-12-5-29Z" fill="#376c56"/><path d="m100 108 1 48m-25-34 44 27m4-28-43 28" stroke="#b6db88" stroke-width="3"/>`;
    layers.head = `${e(100, 92, 35, 27, face)}${muzzle}`;
    layers.wings = `<path d="M79 120Q25 122 39 76q35 4 40 44m40 0q54 2 40-44-35 4-40 44" fill="${body}"/><path d="m43 84 27 30m87-30-27 30" stroke="#d9eea4" fill="none" stroke-width="3"/>`;
    layers.ears = `<path d="M98 67Q69 44 86 23q31 7 19 40m-1-4q23-24 38-10-3 23-33 18" fill="${body}"/><path d="m91 33 9 26m31-7-23 9" stroke="#e1f3b6" fill="none" stroke-width="2"/>`;
    layers.tail = `<path d="m133 148 28-8-12 24Z" fill="${body}"/>`;
    layers.armL = paw(63, 144, true);
    layers.armR = paw(137, 144, true);
  }
  if (id === "frostfang") {
    layers.head = `<path d="M65 70 80 65l20-11 20 11 15 5 12 13-8 11 6 12-16 13-29 5-29-5-16-13 6-12-8-11Z" fill="${pearl}"/>${muzzle}`;
    layers.ears = `<path d="m76 67-20-34 4-21 29 37m35 18 20-34-4-21-29 37" fill="${jewel}"/>${crystal(100, 48, 18)}`;
    layers.scarf = `<path d="m68 111-15 13 18 1-4 17 18-7 15 17 15-17 18 7-4-17 18-1-15-13" fill="${pearl}"/><path d="m80 115 12 17 8-11 8 11 12-17" fill="${jewel}"/>`;
    layers.tail = `<path d="M130 142q38 24 40-13l-7-26-10 12-5-8-7 15 7 18-21-5Z" fill="${pearl}"/>`;
    layers.wings = `${crystal(41, 111, 10)}${crystal(160, 117, 8)}`;
  }
  if (id === "duskveil") {
    layers.head = `<path d="M62 86q-1-27 38-32 39 5 38 32l9 15-13 14-34 9-34-9-13-14Z" fill="${face}"/>${muzzle}`;
    layers.ears = `<path d="M79 69Q39 41 60 14l29 34m32 21q40-28 19-55l-29 34" fill="${body}"/><path d="m63 26 11 26m63-26-11 26" stroke="${p.glow}" fill="none" stroke-width="3"/>`;
    layers.eyes = back
      ? ""
      : profile
        ? eye(100 + side * 18)
        : eye(80) + eye(120);
    layers.scarf = `<path d="M68 107 51 130l21-2-3 16 20-10 11 11 11-11 20 10-3-16 21 2-17-23" fill="${body}"/><path d="m84 117 16 10 16-10" stroke="${p.glow}" fill="none" stroke-width="2"/>`;
    layers.tail = `<path d="M131 143q49 16 39-25-7-24-28-5-8 10 9 16-30-15-8-37 35-19 45 22 10 48-55 47Z" fill="${body}"/>`;
    layers.wings = `<path d="M44 118q-17-19 3-42-8 20 7 31m102 11q17-19-3-42 8 20-7 31" stroke="${p.glow}" fill="none" opacity=".65" stroke-width="4"/>`;
  }
  if (id === "terradon") {
    layers.head = `<path d="m67 66 33-13 33 13 12 23-9 26-36 9-36-9-9-26Z" fill="${face}"/><path d="m67 66 8 24-11 25m69-49-8 24 11 25" stroke="${p.light}" opacity=".6" fill="none"/>${muzzle}`;
    layers.body = `<path d="m69 115 31-12 31 12 9 29-20 23H80l-20-23Z" fill="${body}"/>${crystal(100, 136, 17)}<path d="M70 125 83 119m34 0 13 6" stroke="${p.light}" stroke-width="3"/>`;
    layers.ears = `${crystal(80, 48, 19)}${crystal(105, 30, 25)}${crystal(129, 53, 17)}`;
    layers.armL = `<path d="m59 120-17 7-3 24 18 11 19-7-2-28Z" fill="${body}"/>${crystal(57, 140, 8)}`;
    layers.armR = `<path d="m141 120 17 7 3 24-18 11-19-7 2-28Z" fill="${body}"/>${crystal(143, 140, 8)}`;
    layers.tail = `${crystal(148, 124, 19)}${crystal(165, 143, 11)}`;
    layers.legL = paw(78, 161, true);
    layers.legR = paw(122, 161, true);
  }
  if (back) {
    // Authored rear silhouette: no facial features or inner ear markings.
    layers.head = `${e(100, 88, profile ? 32 : 40, 32, face)}<path d="M78 78q22 12 44 0" stroke="${p.light}" opacity=".6" fill="none" stroke-width="3"/>`;
    layers.eyes = "";
    if (id === "terradon")
      layers.head = `<path d="m67 66 33-13 33 13 12 23-9 26-36 9-36-9-9-26Z" fill="${face}"/><path d="m70 77 30 9 30-9" fill="none" stroke="${p.light}"/>`;
    layers.body += `<path d="M82 125q18-8 36 0" fill="none" stroke="${p.light}" opacity=".3" stroke-width="3"/>`;
  } else if (profile) {
    // Author the entire profile together, including a protruding muzzle and one visible eye.
    // Coordinates are projected explicitly; no whole-character mirror or detached front mouth.
    const px = (x: number) => 100 + side * (x - 100);
    const fur = ["voltkit", "auralynx", "frostfang", "duskveil"].includes(id);
    const skin = id === "auralynx" || id === "frostfang" ? pearl : face;
    layers.head = `${e(px(96), 88, 31, 29, skin)}${fur ? `<path d="M${px(73)} 94 ${px(64)} 102 ${px(76)} 107 ${px(72)} 115 ${px(89)} 116" fill="${skin}"/>` : ""}<path d="M${px(112)} 97Q${px(125)} 97 ${px(137)} 103Q${px(143)} 106 ${px(137)} 113Q${px(124)} 119 ${px(107)} 113Z" fill="${pearl}"/><path d="M${px(136)} 103 ${px(142)} 106 ${px(137)} 110Z" fill="${p.dark}"/><path d="M${px(136)} 113Q${px(127)} 117 ${px(119)} 112" stroke="${p.dark}" stroke-width="1.7" fill="none"/><path d="M${px(77)} 70Q${px(91)} 62 ${px(103)} 65" stroke="${p.light}" opacity=".75" stroke-width="3" fill="none"/>`;
    layers.eyes = eye(px(109));
    if (id === "terradon")
      layers.head += `<path d="M${px(74)} 69 ${px(82)} 88 ${px(72)} 107" stroke="${p.light}" opacity=".6" fill="none"/>`;
    layers.body = `<g transform="translate(${side * 4} 0) translate(100 0) scale(.78 1) translate(-100 0)">${layers.body}</g>`;
    layers.ears = `<g transform="translate(${side * 3} 0) translate(100 0) scale(.72 1) translate(-100 0)">${layers.ears}</g>`;
    layers.scarf = `<g transform="translate(${side * 6} 0) translate(100 0) scale(.73 1) translate(-100 0)">${layers.scarf}</g>`;
    // Forelegs and hind legs converge in depth rather than remaining in a frontal stance.
    layers.armL = `<g opacity=".75">${paw(px(88), 140, id === "terradon")}</g>`;
    layers.armR = paw(px(112), 145, id === "terradon");
    layers.legL = `<g opacity=".8">${paw(px(87), 159)}</g>`;
    layers.legR = paw(px(113), 163);
    layers.wings = `<g transform="translate(${-side * 3} 0) translate(100 0) scale(.65 1) translate(-100 0)">${layers.wings}</g>`;
    if (id === "auralynx")
      layers.tail = `<path d="M${px(74)} 142Q${px(36)} 161 ${px(32)} 131Q${px(28)} 108 ${px(47)} 106" stroke="${p.mid}" stroke-width="14" fill="none"/>${crystal(px(47), 106, 11)}`;
    if (id === "thornback")
      layers.tail = `<path d="M${px(74)} 144 ${px(50)} 136 ${px(58)} 160Z" fill="${body}"/>`;
    if (id === "frostfang")
      layers.tail = `<path d="M${px(74)} 142Q${px(30)} 162 ${px(32)} 126L${px(42)} 105 ${px(47)} 118 ${px(56)} 113 ${px(54)} 134 ${px(79)} 135Z" fill="${pearl}"/>`;
    if (id === "duskveil")
      layers.tail = `<path d="M${px(74)} 142Q${px(28)} 161 ${px(27)} 122Q${px(31)} 87 ${px(58)} 105Q${px(77)} 124 ${px(52)} 132Q${px(65)} 115 ${px(48)} 113Q${px(36)} 115 ${px(42)} 132L${px(79)} 135Z" fill="${body}"/>`;
    if (id === "terradon")
      layers.tail = `${crystal(px(60), 124, 19)}${crystal(px(40), 143, 11)}`;
  }
  return { defs, layers };
}
export function creatureSvg(
  id: CharacterId,
  dir: Facing = "down",
  part?: CreaturePart,
  viewBox = "0 0 200 190",
) {
  const { defs, layers } = creatureLayers(id, dir);
  const group = (p: CreaturePart) =>
    `<g class="fighter-${p === "body" ? "torso" : p}">${layers[p]}</g>`;
  const content = part
    ? layers[part]
    : `<ellipse class="fighter-shadow" cx="100" cy="177" rx="40" ry="8" fill="#060d24" opacity=".25"/><g class="fighter-character">${(["tail", "wings", "legL", "legR", "body", "armL", "armR"] as CreaturePart[]).map(group).join("")}<g class="fighter-face">${(["head", "ears", "eyes", "flame"] as CreaturePart[]).map(group).join("")}</g>${group("scarf")}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${defs}<g stroke="${creaturePalette[id].dark}" stroke-width="1.25" stroke-linejoin="round">${content}</g></svg>`;
}
