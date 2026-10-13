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
    light: "#fff0a0",
    mid: "#ffdf65",
    dark: "#6b4a30",
    glow: "#ffe57b",
  },
  cindrake: {
    light: "#ffd69c",
    mid: "#f3a366",
    dark: "#98523c",
    glow: "#ffbe4d",
  },
  tidefin: {
    light: "#a6c7ed",
    mid: "#5b91c6",
    dark: "#25395f",
    glow: "#88dcff",
  },
  auralynx: {
    light: "#a6d5ee",
    mid: "#689fc8",
    dark: "#303d55",
    glow: "#85dfff",
  },
  thornback: {
    light: "#ffffff",
    mid: "#aee2b5",
    dark: "#46735c",
    glow: "#ff8cab",
  },
  frostfang: {
    light: "#899dde",
    mid: "#5267a7",
    dark: "#263454",
    glow: "#f7d665",
  },
  duskveil: {
    light: "#ffffff",
    mid: "#f7d9e9",
    dark: "#ad709e",
    glow: "#ffd3ee",
  },
  terradon: {
    light: "#ffedb6",
    mid: "#d6bb79",
    dark: "#584335",
    glow: "#bd96ee",
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
  // Pokemon silhouettes and signature anatomy, using the existing articulated parts.
  const hand = (x: number, fill = body) =>
    `${e(x, 137, 9, 19, fill)}${e(x, 152, 10, 6, fill)}`;
  layers.armL = hand(65);
  layers.armR = hand(135);
  if (id === "voltkit") {
    layers.scarf = "";
    layers.wings = "";
    layers.head = `${e(100, 89, 43, 33, face)}${back ? "" : `${e(63, 103, 10, 7, "#ed6464")}${e(137, 103, 10, 7, "#ed6464")}<path d="m96 98 4 3 4-3Z" fill="#493a3c"/><path d="M93 107q7 8 14 0" stroke="#493a3c" fill="none"/>`}`;
  }
  if (id === "cindrake") {
    layers.flame = "";
    layers.scarf = "";
    layers.head = `<path d="M63 78 63 47q0-9 19 15 18-7 36 0 19-24 19-15v31q18 44-37 44T63 78Z" fill="${face}"/>${back ? "" : muzzle}`;
    layers.ears = "";
    layers.wings = `<path d="M74 114Q29 54 22 77l10 52q24-16 39 9m55-24q45-60 52-37l-10 52q-24-16-39 9" fill="#78c9cc" stroke="#cc8150"/>`;
    layers.tail = `<path d="M128 145q43 18 32-33" fill="none" stroke="#ed995b" stroke-width="12"/><path d="M158 117q-16-10-3-31 4 12 10 5 14 20-7 26Z" fill="#ffce55"/>`;
  }
  if (id === "tidefin") {
    layers.wings = "";
    layers.tail = "";
    layers.ears = "";
    layers.head = `<path d="M57 83 44 55q-3-8 28 9l24-22q4-5 8 0l24 22q31-17 28-9l-13 28q10 37-43 37T57 83Z" fill="${face}"/><path d="M59 82q19-5 41 14 22-19 41-14l-4 25q-37 30-74 0Z" fill="#f3efdc"/>`;
    layers.scarf = `<path d="M70 115q30 15 60 0l3 14q-33 14-66 0Z" fill="#ee9ab4"/><path d="M129 120q33-26 46-9-23 1-35 23Z" fill="#ee9ab4"/>`;
    layers.body = `${e(100, 137, 28, 30)}${e(100, 140, 16, 23, "#f3efdc")}`;
  }
  if (id === "auralynx") {
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
  if (id === "thornback") {
    layers.tail = "";
    layers.wings = "";
    layers.scarf = "";
    layers.ears = "";
    layers.head = `${e(100, 91, 32, 32, "#f7ffef")}<path d="M61 96Q51 47 100 43q49 4 39 53l-18-33-5 57-16-8-16 8-5-57Z" fill="#80c89a"/>`;
    layers.body = `<path d="M83 113q17-8 34 0l6 21 26 35q-49 12-98 0l26-35Z" fill="#f9fff3"/><path d="m98 116-9-13 16 3 8 18Z" fill="#e36d89"/>`;
    layers.armL = hand(65, "#80c89a");
    layers.armR = hand(135, "#80c89a");
    layers.eyes = back
      ? ""
      : profile
        ? eye(100 + side * 12)
        : eye(83) + eye(117);
  }
  if (id === "frostfang") {
    layers.scarf = "";
    layers.tail = `<path d="M128 143 166 127 157 153 122 156Z" fill="${body}"/>`;
    layers.flame = "";
    layers.head = `<path d="m63 63 24-9 13-13 13 13 24 9 10 22-16 30-31 7-31-7-16-30Z" fill="${face}"/><path d="m100 59-10 20 10-5 10 5Z" fill="#f7d665"/>${muzzle}`;
    layers.ears = `<path d="M65 69 38 58 43 44l37 7m55 18 27-11-5-14-37 7" fill="${body}"/>`;
    layers.body = `${e(100, 139, 33, 29)}<path d="M81 115q19 9 38 0l9 33-28 18-28-18Z" fill="#c56863"/><path d="m100 146-10 15 10-4 10 4Z" fill="#f7d665"/>`;
    layers.wings = `<path d="m65 124-25-14 10 31 22 5m63-22 25-14-10 31-22 5" fill="${body}"/>`;
  }
  if (id === "duskveil") {
    layers.head = `${e(100, 90, 39, 32, "#fff7fc")}${muzzle}`;
    layers.ears = `<path d="M76 66Q44 43 56 13q32 12 33 45m35 8q32-23 20-53-32 12-33 45" fill="#f1bed7"/><path d="M71 54 62 26l17 25m50 3 9-28-17 25" fill="#739cc6"/>`;
    layers.body = `${e(100, 139, 31, 28, "#fff7fc")}${e(100, 143, 18, 20, "#f9ddeb")}`;
    layers.scarf = `<path d="m100 118-18-9-6 15 24-5 24 5-6-15Z" fill="#edafd0"/><path d="M80 119q-37 26-26 40m67-40q38 26 27 40" stroke="#fff0fb" stroke-width="10" fill="none"/><path d="m52 151 5 12m90-12-5 12" stroke="#86bad6" stroke-width="5"/>`;
    layers.wings = "";
    layers.flame = "";
    layers.tail = `<path d="M130 143q44 17 31-20-9-13-22 0" stroke="#f4c1db" stroke-width="13" fill="none"/>`;
  }
  if (id === "terradon") {
    layers.body = `<path d="M73 108 127 108l19 55-14 9-15-7-17 9-17-9-15 7-14-9Z" fill="${body}"/><path d="M80 118q-4 22-10 36m40-36 17 36" stroke="#a68d57" fill="none" opacity=".4"/>`;
    layers.head = `${e(100, 90, 37, 32, face)}<path d="M91 105q9 8 18 0m-21-2 3 5m5-1 1 6m6-6-1 6m7-10-3 5" stroke="#584335" fill="none" stroke-width="2"/>${e(65, 99, 8, 5, "#ad674d")}${e(135, 99, 8, 5, "#ad674d")}`;
    layers.ears = `<path d="M77 66Q45 43 60 12l26 43m29 0 21-32q7 9 7 20l-21 26" fill="${body}"/><path d="m57 19 10 17m68-8-9 14" stroke="#584335" stroke-width="10"/>`;
    layers.eyes = back
      ? ""
      : `${e(80, 87, 7, 9, "#584335")}${e(120, 87, 7, 9, "#584335")}`;
    layers.armL = "";
    layers.armR = "";
    layers.wings = "";
    layers.scarf = "";
    layers.flame = "";
    layers.legL = e(78, 163, 11, 5, "#584335");
    layers.legR = e(122, 163, 11, 5, "#584335");
    layers.tail = `<path d="m130 145 28-25-3 19 17 2-37 20Z" fill="#70573d"/>`;
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
    const fur = ["voltkit", "auralynx", "duskveil"].includes(id);
    const skin = id === "auralynx" || id === "frostfang" ? pearl : face;
    layers.head = `${e(px(96), 88, 31, 29, skin)}${fur ? `<path d="M${px(73)} 94 ${px(64)} 102 ${px(76)} 107 ${px(72)} 115 ${px(89)} 116" fill="${skin}"/>` : ""}<path d="M${px(112)} 97Q${px(125)} 97 ${px(137)} 103Q${px(143)} 106 ${px(137)} 113Q${px(124)} 119 ${px(107)} 113Z" fill="${pearl}"/><path d="M${px(136)} 103 ${px(142)} 106 ${px(137)} 110Z" fill="${p.dark}"/><path d="M${px(136)} 113Q${px(127)} 117 ${px(119)} 112" stroke="${p.dark}" stroke-width="1.7" fill="none"/><path d="M${px(77)} 70Q${px(91)} 62 ${px(103)} 65" stroke="${p.light}" opacity=".75" stroke-width="3" fill="none"/>`;
    layers.eyes = eye(px(109));
    if (id === "terradon")
      layers.head += `<path d="M${px(74)} 69 ${px(82)} 88 ${px(72)} 107" stroke="${p.light}" opacity=".6" fill="none"/>`;
    layers.body = `<g transform="translate(${side * 4} 0) translate(100 0) scale(.78 1) translate(-100 0)">${layers.body}</g>`;
    layers.ears = `<g transform="translate(${side * 3} 0) translate(100 0) scale(.72 1) translate(-100 0)">${layers.ears}</g>`;
    layers.scarf = `<g transform="translate(${side * 6} 0) translate(100 0) scale(.73 1) translate(-100 0)">${layers.scarf}</g>`;
    // Forelegs and hind legs converge in depth rather than remaining in a frontal stance.
    layers.armL = "";
    layers.armR = hand(px(120), id === "auralynx" ? "#303d55" : body);
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
  if (profile || back) {
    const px = (x: number) => 100 + side * (x - 100);
    if (id === "voltkit") {
      if (profile) layers.head += e(px(112), 101, 7, 5, "#ed6464");
      if (back)
        layers.body = `${e(100, 139, 31, 29)}<path d="M82 129h36m-30 11h24" stroke="#a67b45" stroke-width="5"/>`;
    }
    if (id === "cindrake") {
      if (back) layers.body = e(100, 139, 30, 29);
      if (profile)
        layers.tail = `<path d="M${px(74)} 145q${-side * 43} 18 ${-side * 32}-33" stroke="#ed995b" stroke-width="12" fill="none"/><path d="M${px(43)} 118q${-side * 16}-10 ${-side * 3}-31 4 12 10 5 14 20-7 26Z" fill="#ffce55"/>`;
    }
    if (id === "tidefin") {
      if (profile)
        layers.head += `<path d="M${px(75)} 79 ${px(72)} 53 ${px(90)} 67 ${px(104)} 47 ${px(117)} 73" fill="${face}"/><path d="M${px(95)} 96 ${px(120)} 82 ${px(132)} 100 ${px(107)} 111Z" fill="#f3efdc"/>`;
      if (back) layers.body = e(100, 139, 28, 29);
    }
    if (id === "auralynx") {
      if (profile)
        layers.head += `<path d="M${px(77)} 78Q${px(94)} 69 ${px(121)} 76L${px(123)} 94 ${px(103)} 99 ${px(85)} 91Z" fill="#303d55"/>`;
      if (back) layers.body = e(100, 139, 28, 29);
    }
    if (id === "thornback") {
      layers.head += profile
        ? `<path d="M${px(66)} 95Q${px(60)} 49 ${px(102)} 44Q${px(130)} 45 ${px(126)} 76L${px(104)} 64 ${px(98)} 119 ${px(81)} 108Z" fill="#80c89a"/>`
        : `<path d="M63 103Q52 48 100 43q48 5 37 60l-15 13-22-8-22 8Z" fill="#80c89a"/>`;
    }
    if (id === "frostfang") {
      if (profile)
        layers.head += `<path d="M${px(106)} 64 ${px(96)} 83 ${px(111)} 76 ${px(120)} 82Z" fill="#f7d665"/>`;
      layers.tail = `<path d="M${profile ? px(74) : 128} 143 ${profile ? px(35) : 166} 127 ${profile ? px(45) : 157} 153 ${profile ? px(77) : 122} 156Z" fill="${body}"/>`;
    }
    if (id === "duskveil" && profile)
      layers.tail = `<path d="M${px(74)} 144Q${px(36)} 156 ${px(37)} 129Q${px(43)} 111 ${px(57)} 121" stroke="#f4c1db" stroke-width="13" fill="none"/>`;
    if (id === "terradon") {
      layers.armL = layers.armR = "";
      layers.tail = `<path d="M${profile ? px(74) : 130} 145 ${profile ? px(46) : 158} 120 ${profile ? px(49) : 155} 139 ${profile ? px(32) : 172} 141 ${profile ? px(65) : 135} 161Z" fill="#70573d"/>`;
      layers.eyes = back ? "" : e(px(109), 88, 7, 9, "#584335");
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
