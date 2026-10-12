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
  const profile = dir === "left" || dir === "right",
    side = dir === "left" ? -1 : 1;
  const bodyFill = `url(#${prefix}-body)`,
    faceFill = `url(#${prefix}-face)`;
  const defs = `<defs><radialGradient id="${prefix}-body" cx="30%" cy="22%" r="80%"><stop stop-color="${p.light}"/><stop offset=".5" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.dark}"/></radialGradient><radialGradient id="${prefix}-face" cx="30%" cy="22%" r="85%"><stop stop-color="${p.light}"/><stop offset=".7" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.dark}"/></radialGradient><radialGradient id="${prefix}-shine"><stop stop-color="white"/><stop offset=".3" stop-color="${p.glow}"/><stop offset="1" stop-color="${p.mid}"/></radialGradient></defs>`;
  const ellipse = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    fill = bodyFill,
  ) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
  const eye = (x: number) =>
    `${ellipse(x, 86, 8, 11, "#14233b")}<ellipse cx="${x - 2}" cy="82" rx="3" ry="4" fill="white"/><circle cx="${x + 3}" cy="91" r="1.5" fill="${p.glow}"/>`;
  const layers: Record<CreaturePart, string> = {
    tail: "",
    wings: "",
    legL: ellipse(78, 159, 15, 9),
    legR: ellipse(122, 159, 15, 9),
    body: ellipse(100, 136, 30, 31),
    armL: ellipse(65, 137, 10, 18),
    armR: ellipse(135, 137, 10, 18),
    head: ellipse(100, 92, 43, 32, faceFill),
    ears: "",
    eyes:
      dir === "up" ? "" : profile ? eye(100 + side * 17) : eye(80) + eye(120),
    scarf: "",
    flame: "",
  };
  if (id === "voltkit") {
    layers.body =
      ellipse(100, 137, profile ? 25 : 32, 29, "#36384e") +
      `<path d="M76 126q24-16 48 0v22q-24 20-48 0Z" fill="${bodyFill}"/><path d="M80 135q20 8 40 0m-38 9q18 8 36 0" stroke="#3b3950" stroke-width="4" fill="none"/>`;
    layers.head = `<rect x="${profile ? 64 : 53}" y="63" width="${profile ? 76 : 94}" height="60" rx="29" fill="${faceFill}"/><path d="M62 84q38-18 76 0v17q-38 19-76 0Z" fill="#36384e"/>${dir === "up" ? '<path d="M80 82h40m-34 11h28" stroke="#ffe778" stroke-width="4"/>' : '<path d="M94 110q6 5 12 0" fill="none" stroke="#45304a" stroke-width="2"/>'}`;
    layers.ears = `<path d="M80 65Q63 39 65 29m55 36q17-26 15-36" stroke="#343b54" stroke-width="6" fill="none"/>${ellipse(65, 28, 8, 8, `url(#${prefix}-shine)`)}${ellipse(135, 28, 8, 8, `url(#${prefix}-shine)`)}<circle cx="62" cy="25" r="2" fill="white"/><circle cx="132" cy="25" r="2" fill="white"/>`;
    layers.armL = `<path d="M65 123q-13 9-11 20l10 11 10-9-3-17Z" fill="${bodyFill}"/>`;
    layers.armR = `<path d="M135 123q13 9 11 20l-10 11-10-9 3-17Z" fill="${bodyFill}"/>`;
    layers.tail = `<path d="M130 141q31 11 26-16" fill="none" stroke="#343b54" stroke-width="7"/>${ellipse(157, 123, 7, 7, `url(#${prefix}-shine)`)} `;
  }

  if (id === "cindrake") {
    layers.head = `<path d="M52 90q-8-28 48-29t48 29q12 32-48 35T52 90Z" fill="${faceFill}"/><path d="M64 106q36 13 72 0" stroke="#9b4944" stroke-width="2" fill="none"/>`;
    layers.body =
      ellipse(100, 137, 30, 29) +
      ellipse(100, 143, 18, 20, "#ffd29a") +
      '<circle cx="83" cy="130" r="3" fill="#f9c06f"/><circle cx="118" cy="130" r="3" fill="#f9c06f"/>';
    layers.flame = `<path d="M81 66q-14-18 4-31 1 14 8 6 6-14 13-19-4 17 9 20 4-7 3-14 22 26 0 38Z" fill="url(#${prefix}-shine)"/><path d="M93 64q-5-13 9-24 0 10 8 13l-4 11Z" fill="#fff7c4"/>`;
    layers.tail = `<path d="M126 141q57 15 44-41 24 53-16 65l-31-13Z" fill="${bodyFill}"/><path d="M145 151q17 4 20-14" stroke="#f9c77f" stroke-width="5" fill="none"/>`;
    layers.armL = ellipse(65, 135, 11, 17) + ellipse(59, 150, 12, 6, "#dc6644");
    layers.armR =
      ellipse(135, 135, 11, 17) + ellipse(141, 150, 12, 6, "#dc6644");
  }
  if (id === "tidefin") {
    layers.head = `<path d="M57 85q0-27 43-24t43 24q14 36-43 36T57 85Z" fill="${faceFill}"/>${ellipse(100, 108, 25, 9, "#b9f5ef")}<path d="M94 107q6 6 12 0" stroke="#28638a" fill="none"/>`;
    layers.wings = `<path d="M69 90 28 70q-4 31 32 49l-30 9q30 22 47-6m54-32 41-20q4 31-32 49l30 9q-30 22-47-6" fill="${bodyFill}"/><path d="M35 82l27 22m103-22-27 22" stroke="#b4faff" stroke-width="3"/>`;
    layers.body =
      ellipse(100, 139, 25, 29) + ellipse(100, 140, 13, 22, "#b4efe9");
    layers.armL = `<path d="M68 123q-22 4-24 30 24 1 31-19Z" fill="${bodyFill}"/>`;
    layers.armR = `<path d="M132 123q22 4 24 30-24 1-31-19Z" fill="${bodyFill}"/>`;
    layers.tail = `<path d="M123 147q50-1 48-40 23 50-39 56Z" fill="${bodyFill}"/><path d="m153 150 30 7-5-26Z" fill="#98eff3"/>`;
  }
  if (id === "auralynx") {
    layers.head = `<path d="m100 47 41 34-11 33-30 16-30-16-11-33Z" fill="${faceFill}"/><path d="m100 47-3 39-38-5m38 5 44-5m-44 5 3 44" stroke="#edd2ff" opacity=".65" fill="none" stroke-width="2"/>`;
    layers.body = `<path d="m100 112 25 25-25 34-25-34Z" fill="${bodyFill}"/>${ellipse(100, 137, 9, 12, `url(#${prefix}-shine)`)} `;
    layers.wings = `<path d="m36 89 14 11-5 21-14-13Zm128 0-14 11 5 21 14-13Z" fill="${faceFill}"/><path d="M42 130q58 38 116 0" stroke="#d5b8ff" opacity=".35" fill="none"/>`;
    layers.armL =
      '<path d="m65 122 9 12-11 19-11-16Z" fill="' + bodyFill + '"/>';
    layers.armR =
      '<path d="m135 122-9 12 11 19 11-16Z" fill="' + bodyFill + '"/>';
    layers.legL = layers.legR = "";
    layers.ears = '<path d="m100 19 9 13-9 16-9-16Z" fill="' + faceFill + '"/>';
  }
  if (id === "thornback") {
    layers.body = `<ellipse cx="100" cy="135" rx="46" ry="33" fill="${bodyFill}"/><path d="m100 111 21 11-4 24-17 12-17-12-4-24Z" fill="#628b61" stroke="#b9da96" stroke-width="3"/><path d="m79 122-21 5m63-5 21 5m-25 19 16 14m-50-14-16 14" stroke="#b9da96" stroke-width="2" fill="none"/>`;
    layers.head =
      ellipse(100, 96, 34, 27, faceFill) +
      '<path d="M91 110q9 8 18 0" stroke="#45614f" fill="none"/>';
    layers.wings = `<path d="M66 124Q30 90 48 87q34 2 42 30M110 113q30-39 48-26 10 20-33 33" fill="#91c778"/><path d="m50 94 26 20m65-16-22 15" stroke="#e1efac" fill="none"/><circle cx="139" cy="97" r="7" fill="#f5b5b5"/><circle cx="139" cy="97" r="3" fill="#ffe9a4"/>`;
    layers.armL = ellipse(65, 143, 12, 17, "#849975");
    layers.armR = ellipse(135, 143, 12, 17, "#849975");
    layers.legL = ellipse(78, 162, 17, 9, "#64796b");
    layers.legR = ellipse(122, 162, 17, 9, "#64796b");
  }
  if (id === "frostfang") {
    layers.head = `<path d="M62 65q-13-20 5-17l17 14 16-9 16 9 17-14q18-3 5 17l9 13-5 13 5 12-12 13-20 6H85l-20-6-12-13 5-12-5-13Z" fill="${faceFill}"/>${ellipse(100, 107, 23, 13, "#f4fbff")}<path d="m94 104 6 6 6-6Z" fill="#638fa7"/>`;
    layers.body = `<path d="M74 113q26-12 52 0l8 15-7 8 6 16-12 13H79l-12-13 6-16-7-8Z" fill="${bodyFill}"/>`;
    layers.scarf =
      '<path d="m67 99-22-7 14 13-16 5 22 4m68-15 22-7-14 13 16 5-22 4" stroke="#b4f8ff" stroke-width="3" fill="none"/>';
    layers.armL = ellipse(65, 139, 11, 17, "#e4f3fa");
    layers.armR = ellipse(135, 139, 11, 17, "#e4f3fa");
  }
  if (id === "duskveil") {
    layers.head = `<path d="M63 83q-1-33 37-36 37 3 37 36l9 29-46 14-46-14Z" fill="${faceFill}"/><path d="M70 81q30-17 60 0l-7 23-23 8-23-8Z" fill="#211e39"/>`;
    layers.body = `<path d="M75 113q25 10 50 0l16 40-18 17-15-7-17 7-17-10-15 6Z" fill="${bodyFill}"/><path d="M89 128q-6 20-9 27m24-25 8 28" stroke="#9b79ce" opacity=".5" fill="none"/>`;
    layers.armL =
      '<path d="M66 122q-25 6-20 26l26-9Z" fill="' + bodyFill + '"/>';
    layers.armR =
      '<path d="M134 122q25 6 20 26l-26-9Z" fill="' + bodyFill + '"/>';
    layers.legL = layers.legR = "";
    layers.eyes =
      dir === "up"
        ? ""
        : profile
          ? `<ellipse cx="${100 + side * 16}" cy="86" rx="7" ry="10" fill="#dcb9ff"/>`
          : '<ellipse cx="80" cy="86" rx="8" ry="10" fill="#dcb9ff"/><ellipse cx="120" cy="86" rx="8" ry="10" fill="#dcb9ff"/>';
  }
  if (id === "terradon") {
    layers.head = `<path d="m66 58 34-9 34 9 13 24-10 32-37 11-37-11-10-32Z" fill="${faceFill}"/><path d="m66 58 10 24-13 32m71-56-10 24 13 32" stroke="#e9d8bc" opacity=".35" fill="none"/><path d="M87 108h26" stroke="#494957" stroke-width="3"/>`;
    layers.body =
      '<path d="m73 113 27-8 27 8 8 35-15 19H80l-15-19Z" fill="' +
      bodyFill +
      '"/><path d="m100 124 11 13-11 17-11-17Z" fill="' +
      p.glow +
      '"/>';
    layers.armL =
      '<path d="m62 117-16 7-4 22 14 16 22-6-3-26Z" fill="' +
      bodyFill +
      '"/><path d="m55 129 10 5-2 13-11-4Z" fill="' +
      p.glow +
      '"/>';
    layers.armR =
      '<path d="m138 117 16 7 4 22-14 16-22-6 3-26Z" fill="' +
      bodyFill +
      '"/><path d="m145 129-10 5 2 13 11-4Z" fill="' +
      p.glow +
      '"/>';
    layers.ears =
      '<path d="m91 59-3-24 12 7 9-19 7 38Z" fill="' + p.glow + '"/>';
    layers.legL =
      '<path d="m69 150 19 2 8 17-28 2-8-8Z" fill="' + bodyFill + '"/>';
    layers.legR =
      '<path d="m131 150-19 2-8 17 28 2 8-8Z" fill="' + bodyFill + '"/>';
  }

  if (dir === "right") {
    if (id === "voltkit")
      layers.tail = `<path d="M70 141q-31 11-26-16" fill="none" stroke="#343b54" stroke-width="7"/>${ellipse(43, 123, 7, 7, `url(#${prefix}-shine)`)}`;
    if (id === "cindrake")
      layers.tail = `<path d="M74 141q-57 15-44-41-24 53 16 65l31-13Z" fill="${bodyFill}"/><path d="M55 151q-17 4-20-14" stroke="#f9c77f" stroke-width="5" fill="none"/>`;
    if (id === "tidefin")
      layers.tail = `<path d="M77 147q-50-1-48-40-23 50 39 56Z" fill="${bodyFill}"/><path d="m47 150-30 7 5-26Z" fill="#98eff3"/>`;
  }
  if (dir === "up") {
    layers.eyes = "";
    layers.head = layers.head.replace(
      /<path[^>]*(?:stroke="#9b4944"|stroke="#28638a"|stroke="#45614f"|stroke="#494957"|d="M94 110|d="M91 110)[^>]*\/>/g,
      "",
    );
    if (id === "duskveil")
      layers.head = `<path d="M63 83q-1-33 37-36 37 3 37 36l9 29-46 14-46-14Z" fill="${faceFill}"/>`;
    layers.head += `<path d="M80 90q20 12 40 0" stroke="${p.dark}" stroke-width="3" opacity=".35" fill="none"/>`;
  } else if (profile) {
    // Narrow the facial anatomy while keeping authored appendages; never flip the whole creature.
    layers.head = `<g transform="translate(${side * 9} 0) translate(100 0) scale(.78 1) translate(-100 0)">${layers.head}</g>`;
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
  const content = part
    ? layers[part]
    : `<ellipse cx="100" cy="177" rx="40" ry="8" fill="#060d24" opacity=".25"/>${creatureParts.map((p) => `<g class="fighter-${p === "body" ? "torso" : p}">${layers[p]}</g>`).join("")}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${defs}<g stroke="${creaturePalette[id].dark}" stroke-width="1.25" stroke-linejoin="round">${content}</g></svg>`;
}
