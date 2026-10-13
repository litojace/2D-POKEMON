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
/**
 * Fighters without authored artwork render as a deliberately generic placeholder
 * creature (slate body, element-coloured glow) until licensed art is supplied
 * through the asset pipeline. See docs/fighter-assets.md.
 */
export const PLACEHOLDER_FIGHTERS: CharacterId[] = [
  "eevee",
  "mewtwo",
  "snorlax",
  "gengar",
];
const placeholder = (glow: string) => ({
  light: "#c9d2e3",
  mid: "#8893a8",
  dark: "#3b4357",
  glow,
});
export const creaturePalette: Record<
  CharacterId,
  { light: string; mid: string; dark: string; glow: string }
> = {
  pikachu: {
    light: "#fff0a0",
    mid: "#ffdf65",
    dark: "#6b4a30",
    glow: "#ffe57b",
  },
  charizard: {
    light: "#ffd69c",
    mid: "#f3a366",
    dark: "#98523c",
    glow: "#ffbe4d",
  },
  greninja: {
    light: "#a6c7ed",
    mid: "#5b91c6",
    dark: "#25395f",
    glow: "#88dcff",
  },
  lucario: {
    light: "#a6d5ee",
    mid: "#689fc8",
    dark: "#303d55",
    glow: "#85dfff",
  },
  eevee: placeholder("#ffd38a"),
  mewtwo: placeholder("#e3a6ff"),
  snorlax: placeholder("#8fe0d8"),
  gengar: placeholder("#c39bff"),
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
  if (id === "pikachu") {
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
  if (id === "charizard") {
    layers.ears = `<path d="M76 68 67 39 89 57m35 11 9-29-22 18" fill="${body}"/>`;
    layers.flame = `<path d="M78 66q-14-22 7-40-2 16 9 11 3-20 15-30-4 26 10 33l7-17q18 29-5 43Z" fill="${jewel}"/><path d="M91 63q-5-14 13-28-2 16 10 21l-6 8Z" fill="#fff1b0"/>`;
    layers.wings = `<path d="M71 121 35 91l3 27-14 10 24 7 20 12m61-26 36-30-3 27 14 10-24 7-20 12" fill="${body}"/><path d="m37 103 28 29m98-29-28 29" stroke="#ffd69b" opacity=".6" stroke-width="2"/>`;
    layers.tail =
      profile && side === 1
        ? `<path d="M74 145q-50 31-45-37 10 42 44 22Z" fill="${body}"/>${crystal(32, 96, 17)}`
        : `<path d="M126 145q50 31 45-37-10 42-44 22Z" fill="${body}"/>${crystal(168, 96, 17)}`;
    layers.scarf = `<path d="m70 114 14 13 16-9 16 9 14-13" fill="${jewel}"/>`;
  }
  if (id === "greninja") {
    layers.ears = `<path d="M78 70Q53 57 62 21l21 25-6 12m46 12q25-13 16-49l-21 25 6 12" fill="${jewel}"/><path d="m65 32 9 23m61-23-9 23" stroke="#dfffff" stroke-width="2"/>`;
    layers.wings = `<path d="M66 82 31 61l12 27-20 9 23 9-9 21 37-18m60-27 35-21-12 27 20 9-23 9 9 21-37-18" fill="${jewel}"/><path d="M35 76 61 93 37 100m128-24-26 17 24 7" stroke="#efffff" fill="none" opacity=".65"/>`;
    layers.tail =
      profile && side === 1
        ? `<path d="M72 141Q18 168 27 92q11 34 44 36Z" fill="${body}"/><path d="m29 107-16-18 5 45 18 7Z" fill="${jewel}"/>`
        : `<path d="M128 141q54 27 45-49-11 34-44 36Z" fill="${body}"/><path d="m171 107 16-18-5 45-18 7Z" fill="${jewel}"/>`;
    layers.scarf = `<path d="M71 119q29 19 58 0l-4 13q-25 14-50 0Z" fill="${pearl}"/>`;
  }
  if (id === "lucario") {
    layers.ears = `<path d="M76 69 57 20l32 30m35 19 19-49-32 30" fill="${pearl}"/><path d="m70 47-6-15 17 21m49-6 6-15-17 21" fill="${jewel}"/>${crystal(100, 39, 15)}`;
    layers.head = `${e(100, 89, 39, 31, pearl)}${cheeks}${muzzle}`;
    layers.scarf = `<path d="M67 109 58 127l20-4-1 15 23-13 23 13-1-15 20 4-9-18" fill="${jewel}"/>`;
    layers.wings = `${crystal(37, 89, 10)}${crystal(164, 104, 12)}<path d="M33 122q67 28 134-6" stroke="${p.glow}" opacity=".4" fill="none"/>`;
    layers.tail = `<path d="M130 143q31 20 40-8 7-23-13-25" fill="none" stroke="${p.mid}" stroke-width="14"/>${crystal(155, 106, 11)}`;
  }
  // Pokemon silhouettes and signature anatomy, using the existing articulated parts.
  const hand = (x: number, fill = body) =>
    `${e(x, 137, 9, 19, fill)}${e(x, 152, 10, 6, fill)}`;
  layers.armL = hand(65);
  layers.armR = hand(135);
  if (id === "pikachu") {
    layers.scarf = "";
    layers.wings = "";
    layers.head = `${e(100, 89, 43, 33, face)}${back ? "" : `${e(63, 103, 10, 7, "#ed6464")}${e(137, 103, 10, 7, "#ed6464")}<path d="m96 98 4 3 4-3Z" fill="#493a3c"/><path d="M93 107q7 8 14 0" stroke="#493a3c" fill="none"/>`}`;
  }
  if (id === "charizard") {
    layers.flame = "";
    layers.scarf = "";
    layers.head = `<path d="M63 78 63 47q0-9 19 15 18-7 36 0 19-24 19-15v31q18 44-37 44T63 78Z" fill="${face}"/>${back ? "" : muzzle}`;
    layers.ears = "";
    layers.wings = `<path d="M74 114Q29 54 22 77l10 52q24-16 39 9m55-24q45-60 52-37l-10 52q-24-16-39 9" fill="#78c9cc" stroke="#cc8150"/>`;
    layers.tail = `<path d="M128 145q43 18 32-33" fill="none" stroke="#ed995b" stroke-width="12"/><path d="M158 117q-16-10-3-31 4 12 10 5 14 20-7 26Z" fill="#ffce55"/>`;
  }
  if (id === "greninja") {
    layers.wings = "";
    layers.tail = "";
    layers.ears = "";
    layers.head = `<path d="M57 83 44 55q-3-8 28 9l24-22q4-5 8 0l24 22q31-17 28-9l-13 28q10 37-43 37T57 83Z" fill="${face}"/><path d="M59 82q19-5 41 14 22-19 41-14l-4 25q-37 30-74 0Z" fill="#f3efdc"/>`;
    layers.scarf = `<path d="M70 115q30 15 60 0l3 14q-33 14-66 0Z" fill="#ee9ab4"/><path d="M129 120q33-26 46-9-23 1-35 23Z" fill="#ee9ab4"/>`;
    layers.body = `${e(100, 137, 28, 30)}${e(100, 140, 16, 23, "#f3efdc")}`;
  }
  if (id === "lucario") {
    layers.wings = "";
    layers.scarf = "";
    layers.flame = "";
    layers.head = `<path d="M59 84q-3-34 41-34t41 34q10 38-41 38T59 84Z" fill="${face}"/><path d="M57 79q19-16 43-6 24-10 43 6l-7 26-26-4-10-9-10 9-26 4Z" fill="#303d55"/>${muzzle}`;
    layers.ears = `<path d="m75 65-12-44q-2-11 15 4l12 35m20 0 12-35q17-15 15-4l-12 44" fill="#303d55"/>`;
    layers.body = `${e(100, 137, 28, 31)}${e(100, 139, 20, 24, "#f6e6bc")}<path d="m95 130 5-13 5 13-5 5Z" fill="#fff9e6"/>`;
    layers.armL = hand(65, "#303d55");
    layers.armR = hand(135, "#303d55");
    layers.tail = `<path d="M128 141q38-11 25 15-18 10-34-1Z" fill="${body}"/>`;
  }
  if (back) {
    // Authored rear silhouette: no facial features or inner ear markings.
    layers.head = `${e(100, 88, profile ? 32 : 40, 32, face)}<path d="M78 78q22 12 44 0" stroke="${p.light}" opacity=".6" fill="none" stroke-width="3"/>`;
    layers.eyes = "";
    layers.body += `<path d="M82 125q18-8 36 0" fill="none" stroke="${p.light}" opacity=".3" stroke-width="3"/>`;
  } else if (profile) {
    // Author the entire profile together, including a protruding muzzle and one visible eye.
    // Coordinates are projected explicitly; no whole-character mirror or detached front mouth.
    const px = (x: number) => 100 + side * (x - 100);
    const fur = ["pikachu", "lucario"].includes(id);
    const skin = id === "lucario" ? pearl : face;
    layers.head = `${e(px(96), 88, 31, 29, skin)}${fur ? `<path d="M${px(73)} 94 ${px(64)} 102 ${px(76)} 107 ${px(72)} 115 ${px(89)} 116" fill="${skin}"/>` : ""}<path d="M${px(112)} 97Q${px(125)} 97 ${px(137)} 103Q${px(143)} 106 ${px(137)} 113Q${px(124)} 119 ${px(107)} 113Z" fill="${pearl}"/><path d="M${px(136)} 103 ${px(142)} 106 ${px(137)} 110Z" fill="${p.dark}"/><path d="M${px(136)} 113Q${px(127)} 117 ${px(119)} 112" stroke="${p.dark}" stroke-width="1.7" fill="none"/><path d="M${px(77)} 70Q${px(91)} 62 ${px(103)} 65" stroke="${p.light}" opacity=".75" stroke-width="3" fill="none"/>`;
    layers.eyes = eye(px(109));
    layers.body = `<g transform="translate(${side * 4} 0) translate(100 0) scale(.78 1) translate(-100 0)">${layers.body}</g>`;
    layers.ears = `<g transform="translate(${side * 3} 0) translate(100 0) scale(.72 1) translate(-100 0)">${layers.ears}</g>`;
    layers.scarf = `<g transform="translate(${side * 6} 0) translate(100 0) scale(.73 1) translate(-100 0)">${layers.scarf}</g>`;
    // Forelegs and hind legs converge in depth rather than remaining in a frontal stance.
    layers.armL = "";
    layers.armR = hand(px(120), id === "lucario" ? "#303d55" : body);
    layers.legL = `<g opacity=".8">${paw(px(87), 159)}</g>`;
    layers.legR = paw(px(113), 163);
    layers.wings = `<g transform="translate(${-side * 3} 0) translate(100 0) scale(.65 1) translate(-100 0)">${layers.wings}</g>`;
    if (id === "lucario")
      layers.tail = `<path d="M${px(74)} 142Q${px(36)} 161 ${px(32)} 131Q${px(28)} 108 ${px(47)} 106" stroke="${p.mid}" stroke-width="14" fill="none"/>${crystal(px(47), 106, 11)}`;
  }
  if (profile || back) {
    const px = (x: number) => 100 + side * (x - 100);
    if (id === "pikachu") {
      if (profile) layers.head += e(px(112), 101, 7, 5, "#ed6464");
      if (back)
        layers.body = `${e(100, 139, 31, 29)}<path d="M82 129h36m-30 11h24" stroke="#a67b45" stroke-width="5"/>`;
    }
    if (id === "charizard") {
      if (back) layers.body = e(100, 139, 30, 29);
      if (profile)
        layers.tail = `<path d="M${px(74)} 145q${-side * 43} 18 ${-side * 32}-33" stroke="#ed995b" stroke-width="12" fill="none"/><path d="M${px(43)} 118q${-side * 16}-10 ${-side * 3}-31 4 12 10 5 14 20-7 26Z" fill="#ffce55"/>`;
    }
    if (id === "greninja") {
      if (profile)
        layers.head += `<path d="M${px(75)} 79 ${px(72)} 53 ${px(90)} 67 ${px(104)} 47 ${px(117)} 73" fill="${face}"/><path d="M${px(95)} 96 ${px(120)} 82 ${px(132)} 100 ${px(107)} 111Z" fill="#f3efdc"/>`;
      if (back) layers.body = e(100, 139, 28, 29);
    }
    if (id === "lucario") {
      if (profile)
        layers.head += `<path d="M${px(77)} 78Q${px(94)} 69 ${px(121)} 76L${px(123)} 94 ${px(103)} 99 ${px(85)} 91Z" fill="#303d55"/>`;
      if (back) layers.body = e(100, 139, 28, 29);
    }
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
