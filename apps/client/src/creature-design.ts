import type { CharacterId } from "@arena/shared";
import type { Facing } from "./animation/controller";
/**
 * Original Element Arena creatures, authored as separately animated layers for the
 * articulated rig (see animation/assets.ts for each part's crop bounds and pivot).
 * Coordinates live in a 200x190 canvas; the creature stands centred on x = 100.
 */
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
 * Chibi proportions baked into every part: the face (head, ears, eyes, crest)
 * grows from just above the chin while the body and limbs shrink toward the
 * feet so they stay planted. The rig maps its crop boxes and pivots through
 * the same transform (see animation/assets.ts).
 */
const FACE = { s: 1.17, cx: 100, cy: 118 },
  FRAME = { s: 0.86, cx: 100, cy: 172 };
export const PROPORTIONS: Record<CreaturePart, typeof FACE> = {
  tail: FRAME,
  wings: FRAME,
  legL: FRAME,
  legR: FRAME,
  body: FRAME,
  armL: FRAME,
  armR: FRAME,
  head: FACE,
  ears: FACE,
  eyes: FACE,
  scarf: FRAME,
  flame: FACE,
};
/** Where a point of part `part` lands once its proportion transform is applied. */
export function proportioned(part: CreaturePart, x: number, y: number) {
  const { s, cx, cy } = PROPORTIONS[part];
  return [cx + (x - cx) * s, cy + (y - cy) * s];
}
/** Head-and-shoulders crop, centred on the face, for small round avatars. */
export const AVATAR_VIEWBOX = "22 -8 156 156";
/** The whole creature (big head included) fits this box; cards use it by default. */
export const CREATURE_VIEWBOX = "0 -12 200 202";
/** Fighters still waiting for authored art. Every current fighter has a design. */
export const PLACEHOLDER_FIGHTERS: CharacterId[] = [];
type Palette = {
  light: string;
  mid: string;
  dark: string;
  glow: string;
  /** Secondary colour for markings and accessories. */
  accent: string;
};
export const creaturePalette: Record<CharacterId, Palette> = {
  voltkit: {
    light: "#fff6cf",
    mid: "#ffd65b",
    dark: "#6a4a1f",
    glow: "#7ff3ff",
    accent: "#2fb7d6",
  },
  cindrake: {
    light: "#ffd7a8",
    mid: "#ff7a4f",
    dark: "#5e2316",
    glow: "#ffd34d",
    accent: "#3b1a14",
  },
  tidefin: {
    light: "#dcfbff",
    mid: "#4fd6e6",
    dark: "#113f57",
    glow: "#ff8fb8",
    accent: "#1d2c5c",
  },
  auralynx: {
    light: "#e6ebff",
    mid: "#7f9cff",
    dark: "#202a58",
    glow: "#c9f4ff",
    accent: "#1a1f3d",
  },
  lumoth: {
    light: "#f4fff9",
    mid: "#86f0c0",
    dark: "#1d5a49",
    glow: "#fff1a0",
    accent: "#ffffff",
  },
  mystowl: {
    light: "#ffe6f7",
    mid: "#ff79d2",
    dark: "#581d5c",
    glow: "#9ff7ff",
    accent: "#ffd6f0",
  },
  terradon: {
    light: "#f1dcb5",
    mid: "#c79a5b",
    dark: "#46301c",
    glow: "#8fd36a",
    accent: "#7e6a55",
  },
  duskveil: {
    light: "#e6dbff",
    mid: "#9c6bff",
    dark: "#1e1340",
    glow: "#7dffe1",
    accent: "#120b26",
  },
};
/** Mirror the x coordinates of an absolute-command SVG path around x = 100. */
function mirrorPath(d: string) {
  return d.replace(
    /([MLQCTSHVZ])([^MLQCTSHVZ]*)/g,
    (_, cmd: string, args: string) => {
      const n = (args.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      if (cmd === "H") return cmd + n.map((x) => 200 - x).join(" ");
      if (cmd === "V" || cmd === "Z") return cmd + args;
      return cmd + n.map((v, i) => (i % 2 === 0 ? 200 - v : v)).join(" ");
    },
  );
}
export function creatureLayers(id: CharacterId, dir: Facing) {
  const p = creaturePalette[id],
    prefix = `${id}-${dir}`;
  const back = dir === "up",
    profile = dir === "left" || dir === "right",
    side = dir === "left" ? -1 : 1;
  const body = `url(#${prefix}-body)`,
    face = `url(#${prefix}-face)`,
    pearl = `url(#${prefix}-pearl)`,
    jewel = `url(#${prefix}-jewel)`,
    shine = `url(#${prefix}-shine)`;
  const defs = `<defs>
    <radialGradient id="${prefix}-body" cx="30%" cy="18%" r="95%"><stop stop-color="${p.light}"/><stop offset=".42" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.dark}"/></radialGradient>
    <radialGradient id="${prefix}-face" cx="34%" cy="22%" r="85%"><stop stop-color="${p.light}"/><stop offset=".62" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.dark}"/></radialGradient>
    <radialGradient id="${prefix}-pearl" cx="32%" cy="15%"><stop stop-color="#ffffff"/><stop offset=".55" stop-color="${p.light}"/><stop offset="1" stop-color="${p.mid}"/></radialGradient>
    <linearGradient id="${prefix}-jewel" x2=".8" y2="1"><stop stop-color="#ffffff"/><stop offset=".3" stop-color="${p.glow}"/><stop offset="1" stop-color="${p.mid}"/></linearGradient>
    <radialGradient id="${prefix}-shine"><stop stop-color="#ffffff"/><stop offset=".35" stop-color="${p.glow}"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
  </defs>`;
  // Tails trail behind: on the right in front/back/left views, on the left facing right.
  const behind = profile && side === 1;
  const path = (d: string, fill: string, extra = "") =>
    `<path d="${d}" fill="${fill}"${extra}/>`;
  const tailPath = (d: string, fill: string, extra = "") =>
    path(behind ? mirrorPath(d) : d, fill, extra);
  const e = (x: number, y: number, rx: number, ry: number, fill = body) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
  const highlight = (x: number, y: number, w: number) =>
    `<path d="M${x} ${y}Q${x + w / 2} ${y - w * 0.32} ${x + w} ${y - w * 0.12}" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" opacity=".55" fill="none"/>`;
  const paw = (x: number, y: number, w = 14, fill = body) =>
    `<path d="M${x - 9} ${y - 18}Q${x - 14} ${y - 4} ${x - w} ${y + 3}Q${x} ${y + 12} ${x + w} ${y + 3}Q${x + 14} ${y - 4} ${x + 9} ${y - 18}Z" fill="${fill}"/>${e(x, y + 4, w, 7, fill)}<path d="M${x - 6} ${y + 7}V${y + 10}M${x} ${y + 7}V${y + 11}M${x + 6} ${y + 7}V${y + 10}" stroke="${p.dark}" stroke-width="1.6" opacity=".5"/>`;
  const hand = (x: number, fill = body) =>
    `${e(x, 138, 9, 17, fill)}${e(x, 151, 10, 7, fill)}`;
  // Big glossy chibi eye: dark iris, element-coloured ring, two catchlights.
  const eye = (x: number, ring = p.glow, w0 = 9, h0 = 11) => {
    const w = w0 * 1.3,
      h = h0 * 1.22,
      y = 93;
    return `${e(x, y, w, h, "#1b1636")}${e(x, y + h * 0.3, w * 0.74, h * 0.52, ring)}${e(x, y + h * 0.22, w * 0.42, h * 0.4, "#1b1636")}${e(x - w * 0.3, y - h * 0.36, w * 0.44, h * 0.38, "#ffffff")}<circle cx="${x + w * 0.38}" cy="${y + h * 0.34}" r="${w * 0.17}" fill="#fff"/><circle cx="${x + w * 0.42}" cy="${y - h * 0.5}" r="${w * 0.09}" fill="#fff"/>`;
  };
  const frontEyes = (ring = p.glow, w = 9, h = 11) =>
    eye(79, ring, w, h) + eye(121, ring, w, h);
  const mouth = `<path d="M95.5 109Q97.8 112 100 109.6Q102.2 112 104.5 109" stroke="${p.dark}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`;
  const blushColor = id === "mystowl" ? "#c2268a" : "#ff8fb0";
  const blush =
    `${e(68, 108, 8, 4.5, blushColor)}${e(132, 108, 8, 4.5, blushColor)}`.replace(
      /fill="([^"]+)"/g,
      'fill="$1" opacity=".5" stroke="none"',
    );
  const layers: Record<CreaturePart, string> = {
    tail: "",
    wings: "",
    legL: paw(80, 160),
    legR: paw(120, 160),
    body: `${e(100, 138, 30, 28)}${e(100, 143, 18, 19, pearl)}${highlight(80, 124, 18)}`,
    armL: hand(67),
    armR: hand(133),
    head: `${e(100, 88, 40, 33, face)}${highlight(72, 70, 26)}${mouth}`,
    ears: "",
    eyes: frontEyes(),
    scarf: "",
    flame: "",
  };
  // Per-creature anatomy. Each block only replaces the parts that make the creature distinct.
  if (id === "voltkit") {
    // Sugar-glider kit: round ears, spark antennae, glider membranes, fluffy striped tail.
    layers.ears = `${e(64, 63, 12, 13)}${e(64, 64, 6, 7, p.light)}${e(136, 63, 12, 13)}${e(136, 64, 6, 7, p.light)}${path("M88 58Q80 34 66 26", "none", ` stroke="${p.accent}" stroke-width="3.5" stroke-linecap="round"`)}${path("M112 58Q120 34 134 26", "none", ` stroke="${p.accent}" stroke-width="3.5" stroke-linecap="round"`)}<circle cx="66" cy="25" r="11" fill="${shine}" stroke="none"/><circle cx="134" cy="25" r="11" fill="${shine}" stroke="none"/><circle cx="66" cy="25" r="5" fill="${jewel}"/><circle cx="134" cy="25" r="5" fill="${jewel}"/>`;
    layers.head = `${e(100, 88, 41, 33, face)}${path("M64 96Q100 128 136 96Q128 118 100 120Q72 118 64 96Z", p.light, ' stroke="none"')}${path("M100 56L95 70L103 72L98 84", "none", ` stroke="${p.accent}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`)}${highlight(70, 72, 22)}${mouth}`;
    layers.eyes = frontEyes(p.accent);
    layers.wings = `${path("M70 124Q46 132 44 152Q58 150 74 156Z", p.light, ` opacity=".92"`)}${path("M130 124Q154 132 156 152Q142 150 126 156Z", p.light, ` opacity=".92"`)}${path("M50 146Q58 140 70 144M150 146Q142 140 130 144", "none", ` stroke="${p.mid}" stroke-width="2"`)}`;
    layers.tail = `${tailPath("M124 150Q160 156 172 124Q180 98 160 84Q150 104 148 116Q138 136 120 140Z", body)}${tailPath("M160 84Q154 98 154 106Q166 100 172 108Q178 92 160 84Z", p.accent, ' stroke="none"')}`;
    layers.body = `${e(100, 138, 29, 28)}${e(100, 143, 17, 19, pearl)}${path("M100 120L95 132H103L98 146", "none", ` stroke="${p.accent}" stroke-width="3" stroke-linecap="round" opacity=".8"`)}`;
  }
  if (id === "cindrake") {
    // Magma newt: wide flat head, horn nubs, living flame crest, glowing cracks, ember tail.
    layers.head = `${e(100, 90, 43, 33, face)}${path("M62 84Q72 92 70 102M138 84Q128 92 130 102M84 66Q90 74 86 80", "none", ` stroke="${p.glow}" stroke-width="2.4" stroke-linecap="round" opacity=".85"`)}${highlight(68, 74, 26)}${mouth}`;
    layers.ears = `${e(68, 62, 7, 9, p.accent)}${e(132, 62, 7, 9, p.accent)}`;
    layers.flame = `${path("M84 64Q76 44 88 30Q88 44 96 46Q94 26 106 12Q106 32 114 38Q120 30 120 22Q130 44 116 64Z", jewel)}${path("M92 62Q90 50 98 42Q100 52 106 54Q110 48 112 44Q116 56 108 62Z", "#fff3b8", ' stroke="none"')}`;
    layers.body = `${e(100, 139, 32, 27)}${e(100, 144, 19, 17, pearl)}${path("M84 128Q90 136 86 146M116 128Q110 136 114 146", "none", ` stroke="${p.glow}" stroke-width="2.2" opacity=".75"`)}`;
    layers.legL = paw(78, 161, 16);
    layers.legR = paw(122, 161, 16);
    layers.tail = `${tailPath("M124 152Q164 162 178 138Q184 118 168 108Q166 126 154 134Q140 142 122 140Z", body)}<circle cx="${behind ? 30 : 170}" cy="${118}" r="5" fill="${shine}" stroke="none"/><circle cx="${behind ? 44 : 156}" cy="${136}" r="4" fill="${shine}" stroke="none"/>`;
  }
  if (id === "tidefin") {
    // Axolotl duelist: feathery gill fronds, headband, river sash, finned tail.
    const frond = (x: number, y: number, dx: number) =>
      path(
        `M${x} ${y - 4}Q${x + dx * 0.5} ${y - 16} ${x + dx} ${y - 6}Q${x + dx * 0.55} ${y + 9} ${x} ${y + 6}Z`,
        p.glow,
      );
    layers.ears = `${frond(64, 72, -34)}${frond(62, 84, -38)}${frond(66, 96, -30)}${frond(136, 72, 34)}${frond(138, 84, 38)}${frond(134, 96, 30)}`;
    layers.head = `${e(100, 90, 42, 31, face)}${highlight(70, 74, 24)}${path("M90 108Q100 116 110 108", "none", ` stroke="${p.dark}" stroke-width="2.2" stroke-linecap="round"`)}`;
    layers.flame = `${path("M62 74Q100 60 138 74L136 82Q100 70 64 82Z", p.accent)}${path("M136 76Q150 70 156 60Q150 74 140 82Z", p.accent)}<circle cx="100" cy="72" r="3" fill="${p.glow}" stroke="none"/>`;
    layers.eyes = frontEyes("#7cf6ff", 8, 9);
    layers.body = `${e(100, 138, 26, 28)}${e(100, 142, 15, 19, pearl)}`;
    layers.scarf = `${path("M74 144Q100 152 126 144L127 152Q100 160 73 152Z", p.accent)}${path("M120 150Q138 156 146 168Q132 166 122 156Z", p.accent)}`;
    layers.tail = `${tailPath("M122 150Q162 152 182 128Q166 132 156 128Q166 118 176 98Q150 110 140 128Q132 138 120 140Z", body)}${tailPath("M176 98Q166 116 156 128Q168 132 182 128", "none", ` stroke="${p.light}" stroke-width="2"`)}`;
    layers.armL = hand(69);
    layers.armR = hand(131);
  }
  if (id === "auralynx") {
    // Lynx monk: tall tufted ears, cheek ruff, mane collar, crystal gauntlets, orbiting shards.
    layers.ears = `${path("M64 76Q56 34 68 28Q82 40 90 60Z", body)}${path("M70 66Q65 42 70 38Q79 47 84 58Z", p.light, ' stroke="none"')}${e(67, 31, 4, 5, p.accent)}${path("M136 76Q144 34 132 28Q118 40 110 60Z", body)}${path("M130 66Q135 42 130 38Q121 47 116 58Z", p.light, ' stroke="none"')}${e(133, 31, 4, 5, p.accent)}`;
    layers.head = `${e(100, 88, 39, 32, face)}${path("M62 94Q50 100 58 106Q52 114 72 112Z", p.light)}${path("M138 94Q150 100 142 106Q148 114 128 112Z", p.light)}${path("M88 62L100 72L112 62", "none", ` stroke="${p.accent}" stroke-width="3" stroke-linecap="round"`)}${highlight(72, 72, 22)}${mouth}`;
    layers.eyes = frontEyes(p.glow, 8.5, 10);
    layers.scarf = `${path("M68 116Q100 98 132 116L124 128Q112 120 100 126Q88 120 76 128Z", p.light)}`;
    layers.armL = `${hand(66)}${path("M58 142L66 132L74 142L66 154Z", jewel)}`;
    layers.armR = `${hand(134)}${path("M126 142L134 132L142 142L134 154Z", jewel)}`;
    layers.wings = `${path("M40 80L46 70L52 80L46 92Z", jewel)}${path("M152 96L158 86L164 96L158 108Z", jewel)}${path("M30 120L34 113L38 120L34 128Z", jewel)}`;
    layers.tail = tailPath("M124 148Q142 150 144 138Q138 134 124 140Z", body);
  }
  if (id === "lumoth") {
    // Fluffy moth: fern antennae, rounded star-dusted wings, white ruff collar.
    const fern = (x0: number, dir: number) =>
      `${path(`M${x0} 60Q${x0 + dir * 10} 34 ${x0 + dir * 26} 18`, "none", ` stroke="${p.dark}" stroke-width="2.2" stroke-linecap="round"`)}${[
        0, 1, 2, 3,
      ]
        .map((i) => {
          const t = 0.25 + i * 0.2;
          const bx = x0 + dir * 26 * t * 1.05,
            by = 60 - 42 * t;
          return path(
            `M${bx} ${by}Q${bx + dir * 9} ${by + 2} ${bx + dir * 12} ${by + 9}`,
            "none",
            ` stroke="${p.mid}" stroke-width="2" stroke-linecap="round"`,
          );
        })
        .join("")}`;
    layers.ears = fern(88, -1) + fern(112, 1);
    const wing = (dir: number) => {
      const x = (v: number) => 100 + dir * v;
      return `${path(`M${x(14)} 118Q${x(46)} 54 ${x(82)} 62Q${x(96)} 82 ${x(76)} 108Q${x(92)} 128 ${x(72)} 148Q${x(40)} 150 ${x(14)} 132Z`, body)}<circle cx="${x(60)}" cy="${90}" r="10" fill="${shine}" stroke="none"/><circle cx="${x(60)}" cy="90" r="5" fill="${p.glow}"/><circle cx="${x(56)}" cy="130" r="5" fill="${p.light}" stroke="none"/>`;
    };
    layers.wings = wing(-1) + wing(1);
    layers.head = `${e(100, 88, 38, 32, face)}${highlight(72, 72, 22)}${mouth}`;
    layers.eyes = frontEyes(p.glow, 10, 12);
    layers.scarf = `${path("M68 130Q74 120 83 126Q89 118 95 124Q100 116 105 124Q111 118 117 126Q126 120 132 130Q118 142 100 140Q82 142 68 130Z", p.accent)}`;
  }
  if (id === "mystowl") {
    // Floating owl: feather horns, facial disc, third-eye gem, wing cloak, tiny talons.
    const tuft = (dir: number) => {
      const x = (v: number) => 100 + dir * v;
      return `${path(`M${x(20)} 62Q${x(40)} 44 ${x(44)} 24Q${x(30)} 38 ${x(14)} 56Z`, body)}${path(`M${x(26)} 62Q${x(48)} 52 ${x(56)} 34Q${x(38)} 46 ${x(20)} 58Z`, p.mid)}${path(`M${x(30)} 64Q${x(52)} 62 ${x(62)} 48Q${x(44)} 54 ${x(26)} 60Z`, p.light)}`;
    };
    layers.ears = tuft(-1) + tuft(1);
    layers.head = `${e(100, 88, 41, 34, face)}${e(82, 89, 17, 16, p.accent)}${e(118, 89, 17, 16, p.accent)}${path("M96 100L100 108L104 100Z", p.glow)}${highlight(70, 70, 22)}`;
    layers.flame = `${path("M100 50L107 60L100 70L93 60Z", jewel)}<circle cx="100" cy="60" r="9" fill="${shine}" stroke="none" opacity=".7"/>`;
    layers.eyes = frontEyes("#c86bff", 10, 11);
    layers.wings = `${path("M72 116Q46 128 50 160Q62 152 74 152Z", body)}${path("M128 116Q154 128 150 160Q138 152 126 152Z", body)}${path("M56 136Q62 132 70 136M144 136Q138 132 130 136", "none", ` stroke="${p.light}" stroke-width="2"`)}`;
    layers.body = `${e(100, 138, 29, 28)}${path("M100 120L86 134L100 162L114 134Z", p.accent)}${path("M90 138L100 146L110 138M92 150L100 156L108 150", "none", ` stroke="${p.mid}" stroke-width="2"`)}`;
    layers.armL = "";
    layers.armR = "";
    layers.legL = `${path("M88 164L84 172M92 164V173M96 164L99 172", "none", ` stroke="${p.glow}" stroke-width="3" stroke-linecap="round"`)}`;
    layers.legR = `${path("M104 164L101 172M108 164V173M112 164L116 172", "none", ` stroke="${p.glow}" stroke-width="3" stroke-linecap="round"`)}`;
    layers.tail = tailPath(
      "M120 156Q140 170 150 160Q144 156 146 150Q134 154 122 148Z",
      body,
    );
  }
  if (id === "terradon") {
    // Boulder tortoise: mossy rock shell, sleepy lids, sprout, sturdy legs.
    layers.wings = `${path("M42 150Q36 96 100 84Q164 96 158 150Q100 160 42 150Z", `url(#${prefix}-body)`)}${path("M60 112L84 104L100 116L118 104L142 114M52 134L74 128L92 140L110 130L134 138L150 132", "none", ` stroke="${p.dark}" stroke-width="2.4" opacity=".6"`)}${e(70, 96, 12, 5, p.glow)}${e(132, 98, 10, 4, p.glow)}`;
    layers.head = `${e(100, 90, 34, 29, face)}${highlight(76, 74, 20)}${path("M95 110Q100 113 105 110", "none", ` stroke="${p.dark}" stroke-width="2" stroke-linecap="round"`)}`;
    // Sleepy eyes: heavy lids over small irises.
    const sleepy = (x: number) =>
      `${e(x, 94, 10.5, 9.5, "#1b1636")}${e(x, 96, 5.5, 4.5, p.glow)}<circle cx="${x - 3}" cy="97" r="2" fill="#fff"/>${path(`M${x - 11.5} 92Q${x} 80 ${x + 11.5} 92Z`, p.mid)}${path(`M${x - 11.5} 92Q${x} 87 ${x + 11.5} 92`, "none", ` stroke="${p.dark}" stroke-width="2"`)}`;
    layers.eyes = sleepy(81) + sleepy(119);
    layers.flame = `${path("M100 62Q98 50 100 44", "none", ` stroke="#5aa64a" stroke-width="3" stroke-linecap="round"`)}${path("M100 48Q88 38 84 46Q92 52 100 48Z", p.glow)}${path("M100 46Q110 32 118 40Q110 48 100 46Z", p.glow)}`;
    layers.body = `${e(100, 140, 33, 27)}${e(100, 144, 22, 18, pearl)}${path("M80 136H120M82 148H118", "none", ` stroke="${p.mid}" stroke-width="2" opacity=".6"`)}`;
    layers.legL = paw(76, 162, 17);
    layers.legR = paw(124, 162, 17);
    layers.armL = hand(64);
    layers.armR = hand(136);
    layers.tail = tailPath("M126 156Q146 162 150 152Q140 150 128 148Z", body);
  }
  if (id === "duskveil") {
    // Hooded lantern wisp: pointed hood, void face with glowing eyes, ragged robe, lantern tail.
    layers.head = `${path("M58 102Q54 64 82 50Q96 36 100 22Q106 40 120 50Q146 66 142 102Q128 122 100 122Q72 122 58 102Z", face)}${e(100, 94, 30, 24, p.accent)}${highlight(70, 68, 18)}`;
    const slit = (x: number) =>
      `<circle cx="${x}" cy="93" r="14" fill="${shine}" stroke="none" opacity=".7"/>${e(x, 93, 7.5, 9.5, p.glow)}${e(x - 2.5, 89.5, 3, 3.4, "#ffffff")}`;
    layers.eyes =
      slit(85) +
      slit(115) +
      `<path d="M97 106Q100 109 103 106" stroke="${p.glow}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".9"/>`;
    layers.body = `${path("M74 116Q100 108 126 116Q134 150 140 170L128 162L118 172L108 162L100 172L92 162L82 172L72 162L60 170Q66 150 74 116Z", body)}${path("M100 120V160", "none", ` stroke="${p.light}" stroke-width="2" opacity=".35"`)}`;
    layers.legL = "";
    layers.legR = "";
    layers.armL = `${path("M74 124Q58 134 58 152L70 150Q72 138 80 132Z", body)}${e(62, 152, 6, 5, p.light)}`;
    layers.armR = `${path("M126 124Q142 134 142 152L130 150Q128 138 120 132Z", body)}${e(138, 152, 6, 5, p.light)}`;
    layers.scarf = path(
      "M66 112Q100 128 134 112L130 124Q100 136 70 124Z",
      p.dark,
    );
    layers.tail = `${tailPath("M126 150Q160 150 164 118Q166 104 158 98", "none", ` stroke="${p.dark}" stroke-width="4" stroke-linecap="round"`)}<circle cx="${behind ? 42 : 158}" cy="110" r="16" fill="${shine}" stroke="none"/>${e(behind ? 42 : 158, 110, 7, 9, p.glow)}${path(behind ? "M36 100H48" : "M152 100H164", "none", ` stroke="${p.dark}" stroke-width="3"`)}`;
  }
  if (dir === "down" && id !== "duskveil") layers.head += blush;
  // Rear view: no face; keep silhouettes, ears, crests and accessories.
  if (back) {
    layers.eyes = "";
    const headShape =
      id === "duskveil"
        ? path(
            "M58 102Q54 64 82 50Q96 36 100 22Q106 40 120 50Q146 66 142 102Q128 122 100 122Q72 122 58 102Z",
            face,
          )
        : id === "cindrake"
          ? e(100, 90, 45, 30, face)
          : e(100, 88, 40, 33, face);
    layers.head = `${headShape}${highlight(78, 74, 24)}${path("M80 96Q100 108 120 96", "none", ` stroke="${p.light}" stroke-width="3" opacity=".45"`)}`;
    if (id === "tidefin")
      layers.flame = `${path("M62 74Q100 60 138 74L136 82Q100 70 64 82Z", p.accent)}${path("M96 76Q90 92 84 100M104 76Q110 92 116 100", "none", ` stroke="${p.accent}" stroke-width="5" stroke-linecap="round"`)}`;
    if (id === "mystowl") layers.flame = "";
    if (id !== "duskveil" && id !== "mystowl")
      layers.body = `${e(100, 138, id === "terradon" ? 33 : 29, 28)}${highlight(82, 126, 18)}`;
  } else if (profile) {
    // Profile: compress depth, show one eye on the facing side and a short snout.
    const px = (x: number) => 100 + side * (x - 100);
    const squeeze = (s: string, sx: number, shift: number) =>
      `<g transform="translate(${side * shift} 0) translate(100 0) scale(${sx} 1) translate(-100 0)">${s}</g>`;
    if (id === "mystowl")
      layers.head = `${e(100, 88, 41, 34, face)}${e(px(116), 89, 18, 16, p.accent)}${path(`M${px(128)} 100L${px(136)} 104L${px(128)} 108Z`, p.glow)}${highlight(70, 70, 22)}`;
    layers.head = squeeze(layers.head, 0.82, 4);
    layers.ears = squeeze(layers.ears, 0.7, 2);
    layers.flame = squeeze(layers.flame, 0.75, 3);
    layers.scarf = squeeze(layers.scarf, 0.75, 4);
    layers.body = squeeze(layers.body, 0.8, 2);
    layers.wings = squeeze(layers.wings, 0.6, -side * 4);
    if (id !== "duskveil" && id !== "mystowl") {
      layers.head += e(px(136), 100, 7, 6, face);
      layers.head += `<circle cx="${px(140)}" cy="98" r="1.6" fill="${p.dark}" stroke="none"/>`;
    }
    layers.eyes =
      id === "terradon"
        ? `${e(px(117), 94, 10.5, 9.5, "#1b1636")}${e(px(117), 96, 5.5, 4.5, p.glow)}<circle cx="${px(114)}" cy="97" r="2" fill="#fff"/>${path(`M${px(105.5)} 92Q${px(117)} 80 ${px(128.5)} 92Z`, p.mid)}`
        : id === "duskveil"
          ? `<circle cx="${px(116)}" cy="93" r="14" fill="${shine}" stroke="none" opacity=".7"/>${e(px(116), 93, 7.5, 9.5, p.glow)}${e(px(116) - 2.5, 89.5, 3, 3.4, "#ffffff")}`
          : eye(px(114), id === "voltkit" ? p.accent : p.glow, 8, 11);
    // Far limbs tuck behind the body; near limbs swing on the projected pivots.
    if (id !== "mystowl" && id !== "duskveil") {
      layers.armL = "";
      layers.armR = hand(px(120));
      layers.legL = `<g opacity=".8">${paw(px(88), 158)}</g>`;
      layers.legR = paw(px(112), 162);
    }
    if (id === "duskveil") {
      layers.armL = "";
      layers.armR = `${path(`M${px(118)} 124Q${px(136)} 134 ${px(136)} 152L${px(124)} 150Q${px(122)} 138 ${px(112)} 132Z`, body)}`;
    }
  }
  for (const part of creatureParts)
    if (layers[part]) {
      const { s, cx, cy } = PROPORTIONS[part];
      layers[part] =
        `<g transform="matrix(${s} 0 0 ${s} ${+(cx - s * cx).toFixed(3)} ${+(cy - s * cy).toFixed(3)})">${layers[part]}</g>`;
    }
  return { defs, layers };
}
export function creatureSvg(
  id: CharacterId,
  dir: Facing = "down",
  part?: CreaturePart,
  viewBox = CREATURE_VIEWBOX,
) {
  const { defs, layers } = creatureLayers(id, dir);
  const group = (p: CreaturePart) =>
    `<g class="fighter-${p === "body" ? "torso" : p}">${layers[p]}</g>`;
  const content = part
    ? layers[part]
    : `<ellipse class="fighter-shadow" cx="100" cy="177" rx="40" ry="8" fill="#060d24" opacity=".25"/><g class="fighter-character">${(["tail", "wings", "legL", "legR", "body", "armL", "armR"] as CreaturePart[]).map(group).join("")}<g class="fighter-face">${(["head", "ears", "eyes", "flame"] as CreaturePart[]).map(group).join("")}</g>${group("scarf")}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${defs}<g stroke="${creaturePalette[id].dark}" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round">${content}</g></svg>`;
}
