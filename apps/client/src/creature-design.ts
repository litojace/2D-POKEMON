import {
  creatureProfile,
  profileViewBox,
  profilePartOrder,
  profileFaceOrder,
  PROFILE_HEAD_WIDTH,
  PROFILE_FACE_PARTS,
} from "./creature-profile";
import { championMaterials } from "./champion-materials";
import type { CharacterId } from "@arena/shared";
import type { Facing } from "./animation/controller";
import { awakeningSvg } from "./skins/mythic-art";
import {
  PATTERN_PARTS,
  SKIN_ART,
  accessorySvg,
  patternSvg,
  type SkinArt,
} from "./skins/skin-art";
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
  | "earFar"
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
  "earFar",
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
  earFar: FACE,
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
/** Facial expressions the rig swaps in (the eyes layer only). */
export type Mood = "normal" | "happy" | "hurt" | "dizzy" | "focus";
export const MOODS: Mood[] = ["happy", "hurt", "dizzy", "focus"];
/** A Shop skin worn by a champion, at its Awakening stage (Mythicals). */
export interface SkinLook {
  skin: string;
  stage?: number;
}
/** The palette a champion wears (its own, or a skin's over it). */
export function paletteFor(id: CharacterId, look?: SkinLook | null): Palette {
  const art = look ? SKIN_ART[look.skin] : undefined;
  return { ...creaturePalette[id], ...(art?.palette ?? {}) };
}
/** Only a skin made for this champion applies. */
export function lookFor(id: CharacterId, look?: SkinLook | null) {
  return look && look.skin.startsWith(`${id}-`) && SKIN_ART[look.skin]
    ? look
    : null;
}
export function creatureLayers(
  id: CharacterId,
  dir: Facing,
  mood: Mood = "normal",
  worn?: SkinLook | null,
) {
  const look = lookFor(id, worn);
  const art = look ? SKIN_ART[look.skin] : undefined;
  const p = paletteFor(id, look),
    prefix = `${id}-${dir}${look ? `-${look.skin}` : ""}`;
  const back = dir === "up",
    profile = dir === "left" || dir === "right",
    side = dir === "left" ? -1 : 1;
  const body = `url(#${prefix}-body)`,
    face = `url(#${prefix}-face)`,
    pearl = `url(#${prefix}-pearl)`,
    jewel = `url(#${prefix}-jewel)`,
    shine = `url(#${prefix}-shine)`;
  let defs = `<defs>
    <radialGradient id="${prefix}-body" cx="30%" cy="18%" r="95%"><stop stop-color="${p.light}"/><stop offset=".42" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.dark}"/></radialGradient>
    <radialGradient id="${prefix}-face" cx="34%" cy="22%" r="85%"><stop stop-color="${p.light}"/><stop offset=".62" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.dark}"/></radialGradient>
    <radialGradient id="${prefix}-pearl" cx="32%" cy="15%"><stop stop-color="#ffffff"/><stop offset=".55" stop-color="${p.light}"/><stop offset="1" stop-color="${p.mid}"/></radialGradient>
    <linearGradient id="${prefix}-jewel" x2=".8" y2="1"><stop stop-color="#ffffff"/><stop offset=".3" stop-color="${p.glow}"/><stop offset="1" stop-color="${p.mid}"/></linearGradient>
    <radialGradient id="${prefix}-shine"><stop stop-color="#ffffff"/><stop offset=".35" stop-color="${p.glow}"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
  </defs>`;
  if (dir === "right")
    defs = defs
      .replace('cx="30%"', 'cx="70%"')
      .replace('cx="34%"', 'cx="66%"')
      .replace('cx="32%"', 'cx="68%"');
  // Tails trail behind: on the right in front/back/left views, on the left facing right.
  const behind = profile && side === 1;
  const path = (d: string, fill: string, extra = "") =>
    `<path d="${d}" fill="${fill}"${extra}/>`;
  /** An outline-free line in a colour (veins, markings, glowing cracks). */
  const line = (d: string, color: string, width = 2.2, opacity = 1) =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${opacity < 1 ? ` opacity="${opacity}"` : ""}/>`;
  const tailPath = (d: string, fill: string, extra = "") =>
    path(behind ? mirrorPath(d) : d, fill, extra);
  const tailX = (x: number) => (behind ? 200 - x : x);
  const e = (x: number, y: number, rx: number, ry: number, fill = body) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
  const sparkle = (x: number, y: number, r: number, color = "#ffffff") =>
    path(
      `M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`,
      color,
      ' stroke="none"',
    );
  const highlight = (x: number, y: number, w: number) =>
    `<path d="M${x} ${y}Q${x + w / 2} ${y - w * 0.32} ${x + w} ${y - w * 0.12}" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" opacity=".55" fill="none"/>`;
  const paw = (x: number, y: number, w = 14, fill = body) =>
    `<path d="M${x - 9} ${y - 18}Q${x - 14} ${y - 4} ${x - w} ${y + 3}Q${x} ${y + 12} ${x + w} ${y + 3}Q${x + 14} ${y - 4} ${x + 9} ${y - 18}Z" fill="${fill}"/>${e(x, y + 4, w, 7, fill)}<path d="M${x - 6} ${y + 7}V${y + 10}M${x} ${y + 7}V${y + 11}M${x + 6} ${y + 7}V${y + 10}" stroke="${p.dark}" stroke-width="1.6" opacity=".5"/>`;
  const hand = (x: number, fill = body) =>
    `${e(x, 138, 9, 17, fill)}${e(x, 151, 10, 7, fill)}`;
  // ---- Eyes, with the rig's expressions.
  const INK = "#1b1636";
  /**
   * Expression shapes drawn in place of an eye: happy arcs, squeezed
   * chevrons, dizzy spirals. `inward` points the chevron towards the nose.
   */
  const moodEye = (x: number, w: number, h: number, ink = INK) => {
    const y = 93;
    const s = ` stroke="${ink}" stroke-width="4.2" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
    if (mood === "happy")
      return `<path d="M${x - w * 0.95} ${y + 3}Q${x} ${y - h * 1.05} ${x + w * 0.95} ${y + 3}"${s}/>`;
    if (mood === "hurt") {
      const k = x < 100 ? 1 : -1;
      return `<path d="M${x - k * w * 0.75} ${y - h * 0.6}L${x + k * w * 0.6} ${y}L${x - k * w * 0.75} ${y + h * 0.6}"${s}/>`;
    }
    if (mood === "dizzy") {
      // A spiral of half-turns that each grow a little, always turning one way.
      const r = Math.max(w, h) * 0.95;
      const pts = [0.08, -0.26, 0.46, -0.7, 0.95].map((f) => x + f * r);
      let d = `M${pts[0].toFixed(1)} ${y}`;
      for (let i = 1; i < pts.length; i++) {
        const rad = Math.abs(pts[i] - pts[i - 1]) / 2;
        d += `A${rad.toFixed(1)} ${rad.toFixed(1)} 0 0 1 ${pts[i].toFixed(1)} ${y}`;
      }
      return `<path d="${d}"${s.replace("4.2", "3.4")}/>`;
    }
    return "";
  };
  /** A determined brow over an eye (the "focus" expression). */
  const brow = (x: number, w: number, h: number, ink = INK) => {
    const k = x < 100 ? 1 : -1,
      y = 93 - h - 3;
    return `<path d="M${x - k * w} ${y - 5}L${x + k * w * 0.85} ${y + 2}" stroke="${ink}" stroke-width="4.4" stroke-linecap="round" fill="none"/>`;
  };
  // Big glossy chibi eye: dark iris, element-coloured ring, two catchlights.
  const eye = (x: number, ring = p.glow, w0 = 9, h0 = 11) => {
    const w = w0 * 1.3,
      h = h0 * 1.22,
      y = 93;
    if (mood !== "normal" && mood !== "focus") return moodEye(x, w, h);
    const open = `${e(x, y, w, h, INK)}${e(x, y + h * 0.3, w * 0.74, h * 0.52, ring)}${e(x, y + h * 0.22, w * 0.42, h * 0.4, INK)}${e(x - w * 0.3, y - h * 0.36, w * 0.44, h * 0.38, "#ffffff")}<circle cx="${x + w * 0.38}" cy="${y + h * 0.34}" r="${w * 0.17}" fill="#fff"/><circle cx="${x + w * 0.42}" cy="${y - h * 0.5}" r="${w * 0.09}" fill="#fff"/>`;
    return mood === "focus" ? open + brow(x, w, h) : open;
  };
  const frontEyes = (ring = p.glow, w = 9, h = 11) =>
    eye(79, ring, w, h) + eye(121, ring, w, h);
  const mouth = `<path d="M95.5 109Q97.8 112 100 109.6Q102.2 112 104.5 109" stroke="${p.dark}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`;
  const blushColor = id === "mystowl" ? "#c2268a" : "#ff8fb0";
  const blush = (
    id === "terradon"
      ? `${e(72, 112, 9, 5.5, blushColor)}${e(128, 112, 9, 5.5, blushColor)}`
      : `${e(68, 108, 8, 4.5, blushColor)}${e(132, 108, 8, 4.5, blushColor)}`
  ).replace(/fill="([^"]+)"/g, 'fill="$1" opacity=".5" stroke="none"');
  const layers: Record<CreaturePart, string> = {
    tail: "",
    wings: "",
    legL: paw(80, 160),
    legR: paw(120, 160),
    body: `${e(100, 138, 30, 28)}${e(100, 143, 18, 19, pearl)}${highlight(80, 124, 18)}`,
    armL: hand(67),
    armR: hand(133),
    head: `${e(100, 88, 40, 33, face)}${highlight(72, 70, 26)}${mouth}`,
    earFar: "",
    ears: "",
    eyes: frontEyes(),
    scarf: "",
    flame: "",
  };
  // Per-creature anatomy (evolved forms). Each block only replaces the parts
  // that make the creature distinct.
  if (id === "voltkit") {
    // Storm glider: big tufted ears, flight goggles, dark glider stripe and
    // eye rings, a storm-blue kerchief, circuit-lit membranes and a bolt tail.
    // Round glider ears (tilted out) with a cyan inner glow.
    const ear = (dir: number) => {
      const x = (v: number) => 100 + dir * v;
      return `<ellipse cx="${x(40)}" cy="58" rx="19" ry="20" fill="${body}" transform="rotate(${dir * 18} ${x(40)} 58)"/><ellipse cx="${x(40)}" cy="60" rx="11" ry="12" fill="${p.light}" stroke="none" transform="rotate(${dir * 18} ${x(40)} 60)"/><ellipse cx="${x(40)}" cy="62" rx="5" ry="6" fill="${p.glow}" stroke="none" opacity=".45"/>`;
    };
    layers.ears = ear(-1) + ear(1);
    layers.head = `${e(100, 88, 41, 33, face)}${e(79, 93, 17, 17, p.dark).replace("/>", ' opacity=".22" stroke="none"/>')}${e(121, 93, 17, 17, p.dark).replace("/>", ' opacity=".22" stroke="none"/>')}${path("M64 98Q100 128 136 98Q128 119 100 121Q72 119 64 98Z", p.light, ' stroke="none"')}${path("M96 70Q100 66 104 70L102 86Q100 88 98 86Z", p.dark, ' stroke="none" opacity=".75"')}${highlight(68, 76, 18)}${mouth}`;
    // Goggles pushed up on the forehead.
    layers.flame = `${path("M60 72Q100 54 140 72L138 79Q100 62 62 79Z", p.accent)}${e(84, 66, 11, 9, p.accent)}${e(116, 66, 11, 9, p.accent)}${e(84, 66, 7.5, 6, jewel)}${e(116, 66, 7.5, 6, jewel)}${line("M80 63Q83 61 86 62M112 63Q115 61 118 62", "#ffffff", 2, 0.9)}`;
    layers.eyes = frontEyes(p.accent);
    layers.wings = `${path("M70 122Q40 128 34 156Q52 150 60 158Q66 150 76 154Z", p.light, ' opacity=".95"')}${path("M130 122Q160 128 166 156Q148 150 140 158Q134 150 124 154Z", p.light, ' opacity=".95"')}${line("M40 150L50 140H58L64 132M160 150L150 140H142L136 132", p.accent, 2.2, 0.9)}<circle cx="50" cy="140" r="2.4" fill="${p.accent}" stroke="none"/><circle cx="150" cy="140" r="2.4" fill="${p.accent}" stroke="none"/>`;
    layers.tail = `${tailPath("M124 150Q162 158 174 126Q182 100 166 84Q152 102 150 116Q140 136 120 140Z", body)}${tailPath("M166 84Q160 96 160 108Q170 102 176 110Q182 92 166 84Z", p.light, ' stroke="none"')}${tailPath("M150 116Q154 106 162 100", "none", ` stroke="${p.dark}" stroke-width="5" stroke-linecap="round" opacity=".35"`)}<circle cx="${tailX(168)}" cy="84" r="16" fill="${shine}" stroke="none"/><circle cx="${tailX(168)}" cy="84" r="6" fill="${jewel}"/>`;
    layers.body = `${e(100, 138, 29, 28)}${e(100, 143, 17, 19, pearl)}${highlight(80, 124, 16)}`;
    layers.scarf = `${path("M72 118Q100 128 128 118L127 126Q100 136 73 126Z", p.accent)}${path("M100 128L92 142L100 139L108 142Z", p.accent)}${path("M100 125L97 131H101L99 136", "none", ` stroke="${p.glow}" stroke-width="2" stroke-linecap="round"`)}`;
  }
  if (id === "cindrake") {
    // Magma drake: curled horns, a tall three-tongue crest, sprouted
    // ember wings, a plated belly with lava seams, a bracer and a fire-tipped tail.
    const horn = (dir: number) => {
      const x = (v: number) => 100 + dir * v;
      return `${path(`M${x(26)} 68Q${x(40)} 48 ${x(52)} 40Q${x(48)} 54 ${x(38)} 72Z`, p.accent)}${line(`M${x(44)} 48L${x(40)} 56`, p.glow, 1.8, 0.8)}`;
    };
    layers.ears = horn(-1) + horn(1);
    layers.head = `${e(100, 90, 43, 33, face)}${line("M62 84Q72 92 70 102M138 84Q128 92 130 102M84 66Q90 74 86 80M116 66Q110 74 114 80", p.glow, 2.4, 0.85)}${highlight(68, 74, 26)}${mouth}`;
    layers.flame = `${path("M80 66Q68 42 82 24Q84 40 92 42Q88 18 104 2Q104 26 112 32Q120 20 118 10Q136 40 120 66Z", jewel)}${path("M88 64Q84 48 94 38Q96 50 104 52Q108 44 110 38Q118 54 110 64Z", "#fff3b8", ' stroke="none"')}${path("M96 63Q96 56 101 52Q103 58 106 63Z", "#ffffff", ' stroke="none"')}`;
    layers.wings = `${path("M74 122Q50 104 40 84Q54 92 58 88Q60 100 68 98Q66 110 80 116Z", p.accent)}${path("M126 122Q150 104 160 84Q146 92 142 88Q140 100 132 98Q134 110 120 116Z", p.accent)}${line("M70 114Q56 102 46 90M130 114Q144 102 154 90", p.glow, 1.8, 0.7)}`;
    layers.body = `${e(100, 139, 32, 27)}${path("M84 126Q100 120 116 126L118 158Q100 166 82 158Z", pearl)}${line("M84 136H116M84 146H116", p.mid, 1.8, 0.6)}${line("M80 130Q86 138 82 148M120 130Q114 138 118 148", p.glow, 2.2, 0.8)}`;
    layers.legL = paw(78, 161, 16);
    layers.legR = paw(122, 161, 16);
    layers.armL = `${hand(67)}${path("M57 144H77V150H57Z", p.accent)}<circle cx="67" cy="147" r="2.2" fill="${p.glow}" stroke="none"/>`;
    layers.tail = `${tailPath("M124 152Q164 162 178 138Q184 120 170 108Q166 126 154 134Q140 142 122 140Z", body)}${tailPath("M170 108Q156 96 164 80Q168 92 174 92Q174 80 182 72Q186 92 180 106Z", jewel)}${tailPath("M171 104Q166 96 170 88Q174 96 177 98Z", "#fff3b8", ' stroke="none"')}<circle cx="${tailX(152)}" cy="138" r="4" fill="${shine}" stroke="none"/>`;
  }
  if (id === "tidefin") {
    // Tide corsair: long feathered gill fronds, a bandana with streaming
    // tails and a shell knot, a coral fin-blade, a sash and a spotted fin tail.
    const frond = (x: number, y: number, dx: number) =>
      `${path(`M${x} ${y - 4}Q${x + dx * 0.5} ${y - 18} ${x + dx} ${y - 8}Q${x + dx * 0.55} ${y + 10} ${x} ${y + 6}Z`, p.glow)}${line(`M${x + dx * 0.15} ${y}Q${x + dx * 0.55} ${y - 4} ${x + dx * 0.85} ${y - 6}`, "#ffd2e4", 1.6, 0.9)}`;
    layers.ears = `${frond(64, 70, -40)}${frond(61, 84, -46)}${frond(65, 98, -36)}${frond(136, 70, 40)}${frond(139, 84, 46)}${frond(135, 98, 36)}`;
    layers.head = `${e(100, 90, 42, 31, face)}${highlight(70, 78, 22)}${path("M90 108Q100 116 110 108", "none", ` stroke="${p.dark}" stroke-width="2.2" stroke-linecap="round"`)}<circle cx="74" cy="104" r="2" fill="${p.light}" stroke="none"/><circle cx="128" cy="102" r="2.4" fill="${p.light}" stroke="none"/>`;
    layers.flame = `${path("M60 76Q100 58 140 76L138 85Q100 70 62 85Z", p.accent)}${path("M138 80Q150 84 156 96Q146 94 138 86Z", p.accent)}${path("M138 82Q154 82 162 88Q150 90 138 86Z", p.accent)}${path("M94 66Q100 58 106 66Q104 74 100 75Q96 74 94 66Z", "#ffe7c2")}${line("M97 64L100 70L103 64", p.mid, 1.4, 0.8)}`;
    layers.eyes = frontEyes("#7cf6ff", 8, 9);
    layers.body = `${e(100, 138, 26, 28)}${e(100, 142, 15, 19, pearl)}`;
    layers.scarf = `${path("M74 144Q100 152 126 144L127 152Q100 160 73 152Z", p.accent)}${path("M120 150Q138 156 146 170Q132 168 122 157Z", p.accent)}<circle cx="100" cy="153" r="4" fill="#ffe7c2"/>`;
    layers.tail = `${tailPath("M122 150Q164 154 186 126Q168 130 158 126Q170 116 180 94Q150 108 140 128Q132 138 120 140Z", body)}${tailPath("M180 94Q168 114 158 126Q170 130 186 126", "none", ` stroke="${p.light}" stroke-width="2"`)}<circle cx="${tailX(146)}" cy="134" r="3" fill="${p.light}" stroke="none"/><circle cx="${tailX(160)}" cy="140" r="2.2" fill="${p.light}" stroke="none"/>`;
    // A coral fin-blade, held point-up beside the right hand.
    const blade = (x: number) =>
      `${path(`M${x - 2} 150Q${x + 4} 116 ${x + 20} 92Q${x + 30} 114 ${x + 8} 152Z`, `url(#${prefix}-jewel)`)}${line(`M${x + 4} 146Q${x + 10} 120 ${x + 19} 100`, "#ffffff", 1.6, 0.8)}${path(`M${x - 6} 150H${x + 14}L${x + 12} 156H${x - 4}Z`, "#ffe7c2")}`;
    layers.armL = hand(69);
    layers.armR = `${blade(131)}${hand(131)}`;
  }
  if (id === "auralynx") {
    // Ascendant lynx monk: tall ears with crystal tips, a forehead gem, a
    // beaded mane, crystal gauntlets and a halo of orbiting shards.
    const ear = (dir: number) => {
      const x = (v: number) => 100 + dir * v;
      return `${path(`M${x(36)} 76Q${x(46)} 34 ${x(34)} 24Q${x(18)} 38 ${x(10)} 60Z`, body)}${path(`M${x(30)} 66Q${x(36)} 42 ${x(32)} 36Q${x(22)} 46 ${x(16)} 58Z`, p.light, ' stroke="none"')}${path(`M${x(34)} 26L${x(31)} 12L${x(39)} 20Z`, jewel)}`;
    };
    layers.ears = ear(-1) + ear(1);
    layers.head = `${e(100, 88, 39, 32, face)}${path("M62 94Q50 100 58 106Q52 114 72 112Z", p.light)}${path("M138 94Q150 100 142 106Q148 114 128 112Z", p.light)}${highlight(72, 74, 20)}${mouth}`;
    layers.flame = `${path("M100 60L106 68L100 78L94 68Z", jewel)}${line("M86 64L92 70M114 64L108 70", p.accent, 2.2, 0.8)}`;
    layers.eyes = frontEyes(p.glow, 8.5, 10);
    layers.scarf = `${path("M64 116Q100 96 136 116L130 126Q120 120 112 126Q106 120 100 128Q94 120 88 126Q80 120 70 126Z", p.light)}${[76, 88, 100, 112, 124].map((x, i) => `<circle cx="${x}" cy="${121 - (i === 2 ? 3 : i % 2 ? 1 : 0)}" r="3" fill="${i === 2 ? jewel : p.accent}" stroke="none"/>`).join("")}`;
    const gauntlet = (x: number) =>
      `${hand(x)}${path(`M${x - 10} 144L${x - 4} 132L${x + 4} 132L${x + 10} 144L${x} 158Z`, jewel)}${line(`M${x} 134V156`, "#ffffff", 1.4, 0.7)}`;
    layers.armL = gauntlet(66);
    layers.armR = gauntlet(134);
    // Orbiting shards on a faint ring; the rig spins this layer.
    const shard = (a: number, r: number, s: number) => {
      const cx = 100 + Math.cos(a) * r,
        cy = 115 + Math.sin(a) * r * 0.62;
      return path(
        `M${+cx.toFixed(1)} ${+(cy - s).toFixed(1)}L${+(cx + s * 0.55).toFixed(1)} ${+cy.toFixed(1)}L${+cx.toFixed(1)} ${+(cy + s).toFixed(1)}L${+(cx - s * 0.55).toFixed(1)} ${+cy.toFixed(1)}Z`,
        jewel,
      );
    };
    layers.wings = `<ellipse cx="100" cy="115" rx="74" ry="46" fill="none" stroke="${p.glow}" stroke-width="1.4" stroke-dasharray="3 7" opacity=".45"/>${shard(-2.6, 74, 9)}${shard(-0.5, 74, 7)}${shard(0.9, 74, 8)}${shard(2.4, 74, 6)}`;
    layers.tail = `${tailPath("M124 148Q144 152 148 138Q140 132 124 140Z", body)}${tailPath("M140 134Q148 134 148 140Q146 146 140 146Z", p.accent, ' stroke="none"')}`;
  }
  if (id === "lumoth") {
    // Luna moth: feathered antennae, four-lobed wings with eye-spots and
    // glitter, a cloud ruff and a fluffy forelock.
    const fern = (x0: number, dir: number) =>
      `${line(`M${x0} 60Q${x0 + dir * 10} 34 ${x0 + dir * 28} 16`, p.dark, 2.4)}${[
        0, 1, 2, 3, 4,
      ]
        .map((i) => {
          const t = 0.2 + i * 0.17;
          const bx = x0 + dir * 28 * t * 1.05,
            by = 60 - 44 * t;
          return line(
            `M${bx} ${by}Q${bx + dir * 10} ${by + 2} ${bx + dir * 13} ${by + 10}M${bx} ${by}Q${bx - dir * 6} ${by - 2} ${bx - dir * 8} ${by + 6}`,
            i === 4 ? p.glow : p.mid,
            2,
          );
        })
        .join(
          "",
        )}<circle cx="${x0 + dir * 28}" cy="16" r="3.5" fill="${p.glow}" stroke="none"/>`;
    layers.ears = fern(88, -1) + fern(112, 1);
    const wing = (dir: number) => {
      const x = (v: number) => 100 + dir * v;
      return `${path(`M${x(16)} 120Q${x(36)} 50 ${x(80)} 46Q${x(100)} 62 ${x(88)} 96Q${x(66)} 112 ${x(16)} 124Z`, body)}${path(`M${x(18)} 124Q${x(58)} 118 ${x(72)} 132Q${x(76)} 152 ${x(56)} 158Q${x(34)} 154 ${x(18)} 134Z`, body)}${e(x(60), 84, 12, 13, p.light).replace("/>", ' stroke="none"/>')}${e(x(60), 85, 7, 8, p.glow)}${e(x(60), 86, 3, 3.5, p.dark)}${e(x(52), 142, 6, 6, p.light).replace("/>", ' stroke="none"/>')}${e(x(52), 142, 3, 3, p.glow)}${line(`M${x(24)} 116Q${x(50)} 96 ${x(78)} 60`, p.light, 1.6, 0.6)}${sparkle(x(78), 70, 4)}${sparkle(x(40), 98, 3)}${sparkle(x(64), 150, 2.6)}`;
    };
    layers.wings = wing(-1) + wing(1);
    layers.head = `${e(100, 88, 38, 32, face)}${highlight(72, 72, 22)}${mouth}`;
    layers.flame = `${path("M88 62Q86 48 98 46Q94 54 102 56Q100 48 110 46Q118 52 112 62Q100 58 88 62Z", p.accent)}`;
    layers.eyes = frontEyes(p.glow, 10, 12);
    layers.scarf = `${path("M64 130Q68 116 80 124Q84 112 94 120Q100 108 106 120Q116 112 120 124Q132 116 136 130Q122 146 100 144Q78 146 64 130Z", p.accent)}${line("M80 132Q90 136 100 134Q110 136 120 132", "#dff7ee", 2, 0.9)}`;
    layers.body = `${e(100, 138, 29, 28)}${e(100, 143, 17, 19, pearl)}${line("M84 150Q100 156 116 150M86 160Q100 165 114 160", p.mid, 2, 0.7)}`;
  }
  if (id === "mystowl") {
    // Astral owl: starred horn tufts, a heart-shaped facial disc, a radiant
    // third eye under a crescent, and a star-lined cloak of wings.
    const tuft = (dir: number) => {
      const x = (v: number) => 100 + dir * v;
      return `${path(`M${x(18)} 62Q${x(40)} 42 ${x(46)} 18Q${x(30)} 36 ${x(12)} 56Z`, body)}${path(`M${x(26)} 62Q${x(50)} 50 ${x(60)} 30Q${x(40)} 44 ${x(20)} 58Z`, p.mid)}${path(`M${x(30)} 64Q${x(54)} 62 ${x(66)} 46Q${x(46)} 54 ${x(26)} 60Z`, p.light)}${sparkle(x(46), 17, 5, p.glow)}`;
    };
    layers.ears = tuft(-1) + tuft(1);
    layers.head = `${e(100, 88, 41, 34, face)}${path("M100 74Q90 64 76 70Q60 78 64 96Q70 112 100 114Q130 112 136 96Q140 78 124 70Q110 64 100 74Z", p.accent)}${path("M96 100L100 108L104 100Z", p.glow)}${highlight(70, 70, 22)}`;
    layers.flame = `${path("M100 46L108 58L100 70L92 58Z", jewel)}<circle cx="100" cy="58" r="12" fill="${shine}" stroke="none" opacity=".7"/>${path("M92 40Q100 30 110 36Q102 34 98 42Z", p.glow, ' stroke="none"')}${line("M100 72V76M86 52L82 49M114 52L118 49", p.glow, 1.8, 0.8)}`;
    layers.eyes = frontEyes("#c86bff", 10, 11);
    const cloak = (dir: number) => {
      const x = (v: number) => 100 + dir * v;
      return `${path(`M${x(28)} 114Q${x(62)} 118 ${x(60)} 166Q${x(48)} 160 ${x(40)} 166Q${x(34)} 158 ${x(24)} 160Z`, body)}${path(`M${x(30)} 122Q${x(50)} 128 ${x(50)} 156Q${x(42)} 152 ${x(32)} 154Z`, p.dark, ' stroke="none" opacity=".55"')}${sparkle(x(42), 136, 3.5, p.glow)}${sparkle(x(46), 150, 2.5, "#ffffff")}<circle cx="${x(38)}" cy="146" r="1.4" fill="#ffffff" stroke="none"/>`;
    };
    layers.wings = cloak(-1) + cloak(1);
    layers.body = `${e(100, 138, 29, 28)}${path("M100 120L86 134L100 162L114 134Z", p.accent)}${line("M90 138L100 146L110 138M92 150L100 156L108 150", p.mid, 2)}`;
    layers.armL = "";
    layers.armR = "";
    layers.legL = line("M88 164L84 172M92 164V173M96 164L99 172", p.glow, 3);
    layers.legR = line(
      "M104 164L101 172M108 164V173M112 164L116 172",
      p.glow,
      3,
    );
    layers.tail = `${tailPath("M118 156Q136 176 156 166Q148 160 152 152Q140 158 132 150Q130 156 120 150Z", body)}${tailPath("M140 160L146 164", "none", ` stroke="${p.light}" stroke-width="2"`)}`;
  }
  if (id === "terradon") {
    // Sprout tortoise boy: a broad brow, tapered jaw and small beak-like snout,
    // with a sapling, a mossy shell and short, sturdy limbs.
    const flower = (x: number, y: number, c = "#ffb3d1", r = 3.4) =>
      `${[0, 1, 2, 3, 4].map((i) => e(+(x + Math.cos((i * 2 * Math.PI) / 5) * r).toFixed(1), +(y + Math.sin((i * 2 * Math.PI) / 5) * r).toFixed(1), r * 0.85, r * 0.85, c).replace("/>", ' stroke="none"/>')).join("")}<circle cx="${x}" cy="${y}" r="${(r * 0.6).toFixed(1)}" fill="#fff3a0" stroke="none"/>`;
    // The shell, worn upright on its back: round, with moss along the top.
    layers.wings = `${path("M56 150Q48 116 64 98Q82 80 100 80Q118 80 136 98Q152 116 144 150Q136 166 100 166Q64 166 56 150Z", body)}${line("M100 82V164M72 104Q100 112 128 104M62 132Q100 142 138 132", p.dark, 2.2, 0.45)}${path("M64 100Q72 84 88 84Q100 76 112 84Q128 84 136 100Q124 94 112 96Q100 88 88 96Q76 94 64 100Z", p.glow)}${flower(64, 108)}${flower(138, 112, "#ffffff")}${path("M140 98L144 76L151 90L157 72L160 96L148 104Z", "#bfe9ff")}${line("M145 82L147 94M156 78L155 92", "#ffffff", 1.4, 0.8)}`;
    // Wider at the brow and gently tapered at the chin, with a little turtle beak.
    layers.head = `${path("M100 56Q78 56 66 71Q58 83 62 99Q66 117 82 125Q91 130 100 129Q109 130 118 125Q134 117 138 99Q142 83 134 71Q122 56 100 56Z", face)}${highlight(72, 70, 22)}${path("M88 103Q100 108 112 103Q111 114 100 117Q89 114 88 103Z", p.mid, ' stroke="none"')}<path d="M94 111Q97 114 100 111Q103 114 106 111" stroke="${p.dark}" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="96" cy="104" r="1.15" fill="${p.dark}" stroke="none"/><circle cx="104" cy="104" r="1.15" fill="${p.dark}" stroke="none"/><path d="M69 78Q79 74 89 78M111 78Q121 74 131 78" stroke="${p.dark}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".48"/>`;
    layers.eyes = eye(81, p.glow, 10, 12) + eye(119, p.glow, 10, 12);
    layers.flame = `${line("M100 60Q98 48 101 36", "#5aa64a", 3.4)}${path("M100 50Q84 38 76 46Q86 58 100 50Z", p.glow)}${path("M100 44Q114 28 126 36Q114 48 100 44Z", p.glow)}${flower(101, 34, "#ffb3d1", 3.8)}`;
    // A round torso with its plated belly (plastron).
    layers.body = `${e(100, 140, 24, 21)}${e(100, 143, 17, 16, pearl)}${line("M88 138Q100 142 112 138M88 148Q100 152 112 148", p.mid, 1.6, 0.55)}`;
    // Short, chubby legs and arms; mossy stone pauldrons on its shoulders.
    layers.legL = paw(87, 165, 12);
    layers.legR = paw(113, 165, 12);
    const arm = (x: number) => {
      const out = x < 100 ? -1 : 1;
      return `${e(x + out * 2, 140, 9, 12)}${e(x + out * 4, 150, 9, 7)}${e(x, 128, 11, 7, p.accent)}${e(x - 2, 123, 6, 2.6, p.glow)}`;
    };
    layers.armL = arm(74);
    layers.armR = arm(126);
    layers.tail = `${tailPath("M128 152Q142 156 152 164Q142 168 126 160Z", body)}`;
  }
  if (id === "duskveil") {
    // Lantern wraith: a tall tattered hood with a star stitch, a void face,
    // a crescent clasp, a ragged robe and a lantern swinging from a crook.
    const hood =
      "M56 104Q50 70 76 54Q90 42 98 18Q104 10 112 14Q104 22 108 40Q124 52 142 66Q152 84 144 104L138 98L134 110L126 104Q116 122 100 122Q84 122 74 104L66 110L62 98Z";
    layers.head = `${path(hood, face)}${e(100, 94, 30, 24, p.accent)}${highlight(68, 70, 16)}${sparkle(122, 58, 5, p.glow)}${line("M128 50L132 46M126 46L130 42", p.light, 1.4, 0.6)}`;
    const glowEye = (x: number) => {
      if (mood !== "normal" && mood !== "focus")
        return `<circle cx="${x}" cy="93" r="12" fill="${shine}" stroke="none" opacity=".55"/>${moodEye(x, 8, 9, p.glow)}`;
      const squint = mood === "focus";
      return `<circle cx="${x}" cy="93" r="14" fill="${shine}" stroke="none" opacity=".7"/>${e(x, squint ? 95 : 93, 7.5, squint ? 6 : 9.5, p.glow)}${e(x - 2.5, squint ? 93 : 89.5, 3, squint ? 2 : 3.4, "#ffffff")}${squint ? brow(x, 7.5, 9.5, p.glow) : ""}`;
    };
    layers.eyes =
      glowEye(85) +
      glowEye(115) +
      (mood === "normal"
        ? `<path d="M97 106Q100 109 103 106" stroke="${p.glow}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".9"/>`
        : "");
    layers.body = `${path("M72 116Q100 108 128 116Q136 150 144 172L132 162L124 174L114 162L106 175L98 162L88 174L78 162L66 172L56 166Q64 150 72 116Z", body)}${line("M100 122V160", p.light, 2, 0.35)}${line("M80 150Q84 156 82 162M120 150Q116 156 118 162", p.light, 1.6, 0.3)}`;
    layers.legL = "";
    layers.legR = "";
    layers.armL = `${path("M74 124Q56 134 54 154L68 152Q70 140 80 132Z", body)}${e(60, 154, 6, 5, p.light)}`;
    layers.armR = `${path("M126 124Q144 134 146 154L132 152Q130 140 120 132Z", body)}${e(140, 154, 6, 5, p.light)}`;
    layers.scarf = `${path("M64 112Q100 128 136 112L132 124Q100 138 68 124Z", p.dark)}${path("M96 122Q92 132 100 136Q94 130 100 124Z", p.glow)}`;
    // Lantern on a crook, hanging from its tip; the rig swings this layer.
    layers.tail = `${tailPath("M126 150Q150 148 156 120Q160 98 172 92Q180 92 180 100", "none", ` stroke="${p.dark}" stroke-width="4" stroke-linecap="round"`)}${line(`M${tailX(180)} 100V106`, p.dark, 2)}<circle cx="${tailX(180)}" cy="118" r="17" fill="${shine}" stroke="none"/>${path(`M${tailX(173)} 108H${tailX(187)}L${tailX(185)} 128H${tailX(175)}Z`, p.accent)}${e(tailX(180), 118, 4.5, 7, p.glow)}${e(tailX(180), 120, 2, 3.5, "#ffffff")}${line(`M${tailX(172)} 107H${tailX(188)}M${tailX(174)} 129H${tailX(186)}`, p.dark, 3)}`;
  }
  if (dir === "down" && id !== "duskveil" && id !== "terradon")
    layers.head += blush;
  if (dir === "left" || dir === "right" || dir === "up") {
    const painted = creatureProfile(id, dir, {
      palette: p,
      prefix,
      mood,
      eye,
      expression: moodEye,
    });
    Object.assign(layers, painted.layers);
    defs += painted.defs;
  }
  // All views now use complete articulated anatomy and the same front-art materials.
  defs += championMaterials(id, prefix, p, layers);
  // Cragstone skin (menus): glowing cracks, hidden unless the skin is worn.
  // The rig paints its own cracks, and display="none" keeps them out of it.
  const crack = (d: string) =>
    `<g class="crag-cracks" display="none" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${d}" stroke="#ff9a2e" stroke-width="4.5" opacity=".35"/><path d="${d}" stroke="#ffcf7a" stroke-width="1.7"/></g>`;
  if (layers.body && !back)
    layers.body += crack("M88 127l6 7-3 6 7 8M113 131l-5 7 4 7");
  else if (layers.body)
    layers.body += crack("M90 124l7 9-4 8 8 9M112 128l-6 9 5 8");
  if (layers.head)
    layers.head += back
      ? crack("M84 70l7 8-3 7 8 6M116 66l-6 9 4 7")
      : crack("M84 64l5 6-2 5 6 4M117 63l-4 6 3 5");
  for (const part of creatureParts)
    if (layers[part]) {
      const { s, cx, cy } = PROPORTIONS[part];
      layers[part] =
        `<g transform="matrix(${s} 0 0 ${s} ${+(cx - s * cx).toFixed(3)} ${+(cy - s * cy).toFixed(3)})">${layers[part]}</g>`;
    }
  if (art && look) dressLayers(id, dir, look, art, p, prefix, layers);
  if (profile)
    for (const part of PROFILE_FACE_PARTS)
      if (layers[part])
        layers[part] =
          `<g transform="matrix(${PROFILE_HEAD_WIDTH} 0 0 1 ${+(100 - 100 * PROFILE_HEAD_WIDTH).toFixed(3)} 0)">${layers[part]}</g>`;
  return { defs, layers };
}
/**
 * Paint a skin's pattern over the parts it covers (masked to each part's own
 * shape, in final coordinates) and add its accessories on top.
 */
function dressLayers(
  id: CharacterId,
  dir: Facing,
  look: SkinLook,
  art: SkinArt,
  p: Palette,
  prefix: string,
  layers: Record<CreaturePart, string>,
) {
  if (art.pattern) {
    const { kind, color, color2, opacity = 0.6, parts } = art.pattern;
    const wallpaper = patternSvg(kind, color, color2, look.skin);
    const covered =
      parts?.includes("ears") && !parts.includes("earFar")
        ? [...parts, "earFar" as const]
        : parts;
    for (const part of covered ?? PATTERN_PARTS) {
      if (!layers[part]) continue;
      const m = `${prefix}-m-${part}`;
      layers[part] +=
        `<mask id="${m}" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="-40" y="-60" width="280" height="280"><g stroke="none">${layers[part]}</g></mask>` +
        `<g mask="url(#${m})" stroke="none" opacity="${opacity}">${wallpaper}</g>`;
    }
  }
  const stage = look.stage ?? 1;
  const extras = [
    ...(art.accessories ?? []),
    ...(art.stageAccessories ?? [])
      .filter((s) => stage >= s.stage)
      .map((s) => s.accessory),
  ];
  for (const a of extras)
    for (const [part, svg] of accessorySvg(a, id, dir, p))
      layers[part] += `<g class="skin-accessory skin-${a}">${svg}</g>`;
  if (art.mythic)
    for (const [part, svg] of awakeningSvg(art.mythic, stage, id, dir, p))
      layers[part] += `<g class="skin-awakening">${svg}</g>`;
}
export function creatureSvg(
  id: CharacterId,
  dir: Facing = "down",
  part?: CreaturePart,
  viewBox = CREATURE_VIEWBOX,
  mood: Mood = "normal",
  look?: SkinLook | null,
) {
  return creatureSvgRenderer(id, dir, mood, look)(part, viewBox);
}
/** Prepare a look once when several cropped textures share the same drawing. */
export function creatureSvgRenderer(
  id: CharacterId,
  dir: Facing,
  mood: Mood = "normal",
  look?: SkinLook | null,
) {
  const { defs, layers } = creatureLayers(id, dir, mood, look);
  const stroke = paletteFor(id, lookFor(id, look)).dark;
  const FACE_PARTS: CreaturePart[] = ["head", "earFar", "ears", "eyes", "flame"];
  const order = dir === "down" ? [] : profilePartOrder(dir, id);
  // A part listed after the head (Terradon's shell from behind) draws over it.
  const firstFace = order.findIndex((p) => FACE_PARTS.includes(p));
  const lastFace = order.length - 1 - [...order].reverse().findIndex((p) => FACE_PARTS.includes(p));
  const lowerParts: CreaturePart[] =
    dir === "down"
      ? ["tail", "wings", "legL", "legR", "body", "armL", "armR"]
      : order.slice(0, firstFace).filter((p) => p !== "scarf");
  const faceParts: CreaturePart[] | null =
    dir === "down" ? null : order.slice(firstFace, lastFace + 1);
  const group = (p: CreaturePart) =>
    `<g class="fighter-${p === "body" ? "torso" : p}">${layers[p]}</g>`;
  return (
    part?: CreaturePart,
    viewBox = CREATURE_VIEWBOX,
    omit: readonly CreaturePart[] = [],
  ) => {
    if (
      !part &&
      viewBox === CREATURE_VIEWBOX &&
      (dir === "left" || dir === "right" || dir === "up")
    )
      viewBox = profileViewBox(id, dir);
    const content = part
      ? layers[part]
      : `<ellipse class="fighter-shadow" cx="100" cy="177" rx="40" ry="8" fill="#060d24" opacity=".25"/><g class="fighter-character">${lowerParts
          .filter((p) => !omit.includes(p))
          .map(group)
          .join("")}<g class="fighter-face">${(
          (faceParts ?? ["head", "ears", "eyes", "flame"]) as CreaturePart[]
        )
          .filter((p) => !omit.includes(p))
          .map(group)
          .join("")}</g>${omit.includes("scarf") ? "" : group("scarf")}</g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${defs}<g stroke="${stroke}" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round">${content}</g></svg>`;
  };
}
