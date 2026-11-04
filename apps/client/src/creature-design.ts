import {
  creatureProfile,
  profileViewBox,
  profilePartOrder,
  profileFaceOrder,
  PROFILE_HEAD_WIDTH,
  PROFILE_FACE_PARTS,
} from "./creature-profile";
import { championMaterials } from "./champion-materials";
import { pyrandaMarks } from "./champion-markings";
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
  coilemur: {
    light: "#f7f3ea",
    mid: "#a9a6bd",
    dark: "#2c2840",
    glow: "#ffd84a",
    accent: "#d9823b",
  },
  pyranda: {
    light: "#ffe0c4",
    mid: "#d9572b",
    dark: "#4a1a12",
    glow: "#ffcf4d",
    accent: "#fbf3e6",
  },
  glacelle: {
    light: "#f4feff",
    mid: "#9fe8ff",
    dark: "#1d4f7a",
    glow: "#ff9a6b",
    accent: "#d9f6ff",
  },
  halcyra: {
    light: "#e8eeff",
    mid: "#6f8dff",
    dark: "#1c2456",
    glow: "#c9f4ff",
    accent: "#ff9a4a",
  },
  sunbara: {
    light: "#fff1d6",
    mid: "#c98f52",
    dark: "#4a2e18",
    glow: "#ffe066",
    accent: "#ffb732",
  },
  astrabun: {
    light: "#ffffff",
    mid: "#e3c8ff",
    dark: "#4b2a6b",
    glow: "#ffe9a3",
    accent: "#8a5cff",
  },
  wombolder: {
    light: "#efdcc0",
    mid: "#b08a62",
    dark: "#3e2a1a",
    glow: "#9bd36a",
    accent: "#8b8f99",
  },
  shadopus: {
    light: "#e9e0ff",
    mid: "#7b5cff",
    dark: "#1a1240",
    glow: "#ff6bd6",
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
/**
 * Each champion's eye shape, so faces read apart at a glance (Duskveil keeps its
 * glowing void eyes). Moods (happy, hurt, dizzy) still use the shared shapes.
 */
type EyeStyle =
  | "round"
  | "sparkle"
  | "fierce"
  | "drop"
  | "gem"
  | "dewy"
  | "owl"
  | "sleepy"
  | "glance"
  | "shy"
  | "frost"
  | "keen"
  | "content"
  | "star"
  | "bead";
export const EYE_STYLE: Partial<Record<CharacterId, EyeStyle>> = {
  voltkit: "sparkle",
  cindrake: "fierce",
  tidefin: "drop",
  auralynx: "gem",
  lumoth: "dewy",
  mystowl: "owl",
  terradon: "sleepy",
  coilemur: "glance",
  pyranda: "shy",
  glacelle: "frost",
  halcyra: "keen",
  sunbara: "content",
  astrabun: "star",
  wombolder: "bead",
};
/**
 * Champions that float instead of standing: the rig glides them above the
 * ground, and menus give them a soft floor shadow instead of paw contact.
 */
export const HOVERING: readonly CharacterId[] = [
  "auralynx",
  "lumoth",
  "mystowl",
  "duskveil",
  "glacelle",
];
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
/**
 * `flat` draws the creature without its masked overlays: the champion
 * material brush marks and a skin's pattern. Each of those is a wallpaper
 * the size of the canvas, masked to one part's shape, so a renderer that
 * gets SVG masks wrong paints whole rectangles over the creature. Desktop
 * Safari did exactly that for fighters drawn into the Plaza's canvas (dark
 * boxes over every part); the Plaza falls back to this drawing when it
 * detects it (see plaza/plaza-sprite.ts).
 */
export function creatureLayers(
  id: CharacterId,
  dir: Facing,
  mood: Mood = "normal",
  worn?: SkinLook | null,
  flat = false,
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
  // Extra materials some of the newer champions use (all views).
  const EXTRA_DEFS: Partial<Record<CharacterId, string>> = {
    glacelle: `<radialGradient id="${prefix}-heart" cx="40%" cy="35%"><stop stop-color="#fff0c8"/><stop offset=".5" stop-color="${p.glow}"/><stop offset="1" stop-color="#e2553a"/></radialGradient><radialGradient id="${prefix}-heartglow"><stop stop-color="${p.glow}" stop-opacity=".55"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>`,
    halcyra: `<radialGradient id="${prefix}-chest" cx="35%" cy="20%"><stop stop-color="#ffe1c2"/><stop offset=".6" stop-color="${p.accent}"/><stop offset="1" stop-color="#c25a1e"/></radialGradient>`,
    sunbara: `<radialGradient id="${prefix}-muzzle" cx="40%" cy="25%"><stop stop-color="${p.light}"/><stop offset="1" stop-color="#d9a873"/></radialGradient><radialGradient id="${prefix}-yuzu" cx="35%" cy="30%"><stop stop-color="#fff6c2"/><stop offset=".55" stop-color="${p.accent}"/><stop offset="1" stop-color="#e08a16"/></radialGradient>`,
    astrabun: `<linearGradient id="${prefix}-moon" x2="1" y2="1"><stop stop-color="#fffbe6"/><stop offset="1" stop-color="${p.glow}"/></linearGradient>`,
    wombolder: `<radialGradient id="${prefix}-stone" cx="35%" cy="25%"><stop stop-color="#c9ccd4"/><stop offset=".55" stop-color="${p.accent}"/><stop offset="1" stop-color="#4b4e57"/></radialGradient>`,
  };
  defs += EXTRA_DEFS[id] ? `<defs>${EXTRA_DEFS[id]}</defs>` : "";
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
  const e = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    fill = body,
    extra = "",
  ) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"${extra}/>`;
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
   * +1 when the nose is to the right of this eye, -1 when it is to the left.
   * Side views are drawn facing left (the right view mirrors that drawing),
   * so their eye always looks toward -x.
   */
  const toNose = (x: number) => (profile ? -1 : x < 100 ? 1 : -1);
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
      const k = toNose(x);
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
    const k = toNose(x),
      y = 93 - h - 3;
    return `<path d="M${x - k * w} ${y - 5}L${x + k * w * 0.85} ${y + 2}" stroke="${ink}" stroke-width="4.4" stroke-linecap="round" fill="none"/>`;
  };
  // Big glossy chibi eye: dark iris, element-coloured ring, two catchlights.
  // Each champion draws it in its own shape (EYE_STYLE) so faces read apart.
  const style = EYE_STYLE[id] ?? "round";
  const n = (v: number) => +v.toFixed(2);
  const styledEye = (
    x: number,
    y: number,
    w: number,
    h: number,
    ring: string,
  ) => {
    const k = toNose(x);
    const glints = `${e(x - w * 0.3, y - h * 0.36, w * 0.44, h * 0.38, "#ffffff")}<circle cx="${n(x + w * 0.38)}" cy="${n(y + h * 0.34)}" r="${n(w * 0.17)}" fill="#fff"/><circle cx="${n(x + w * 0.42)}" cy="${n(y - h * 0.5)}" r="${n(w * 0.09)}" fill="#fff"/>`;
    const round = `${e(x, y, w, h, INK)}${e(x, y + h * 0.3, w * 0.74, h * 0.52, ring)}${e(x, y + h * 0.22, w * 0.42, h * 0.4, INK)}`;
    if (style === "sparkle")
      // Star-shaped catchlights: the hyperactive look.
      return `${round}${sparkle(n(x - w * 0.26), n(y - h * 0.3), n(w * 0.5))}${sparkle(n(x + w * 0.42), n(y - h * 0.52), n(w * 0.2))}<circle cx="${n(x + w * 0.36)}" cy="${n(y + h * 0.36)}" r="${n(w * 0.15)}" fill="#fff"/>`;
    if (style === "fierce") {
      // A slightly flattened upper lid, tipped a little toward the nose: cocky, not cross.
      const shape = `M${n(x - k * w)} ${y}A${n(w)} ${n(h)} 0 0 ${k === 1 ? 0 : 1} ${n(x + k * w)} ${y}Q${n(x + k * w)} ${n(y - h * 0.62)} ${n(x + k * w * 0.4)} ${n(y - h * 0.76)}Q${x} ${n(y - h * 0.9)} ${n(x - k * w * 0.45)} ${n(y - h * 0.9)}Q${n(x - k * w)} ${n(y - h * 0.84)} ${n(x - k * w)} ${y}Z`;
      return `<path d="${shape}" fill="${INK}"/>${e(x, y + h * 0.28, w * 0.72, h * 0.5, ring)}${e(x, y + h * 0.2, w * 0.4, h * 0.36, INK)}${e(x - k * w * 0.22, y - h * 0.24, w * 0.4, h * 0.32, "#ffffff")}<circle cx="${n(x + k * w * 0.32)}" cy="${n(y + h * 0.36)}" r="${n(w * 0.15)}" fill="#fff"/>${e(x + k * w * 0.38, y - h * 0.48, w * 0.09, h * 0.08, "#ffd34d")}`;
    }
    if (style === "dewy") {
      // Extra-glossy eyes with lashes and a lower shine: dreamy.
      // Three lashes on the outer, upper edge, each pointing straight outward.
      const lashes = [0.35, 0.7, 1.05]
        .map((t) => {
          const a = Math.PI + t,
            dx = k * Math.cos(a),
            dy = Math.sin(a);
          return `M${n(x + dx * w)} ${n(y + dy * h)}l${n(dx * 5)} ${n(dy * 5)}`;
        })
        .join("");
      return `${round}${glints}<path d="M${n(x - w * 0.5)} ${n(y + h * 0.55)}Q${x} ${n(y + h * 0.82)} ${n(x + w * 0.5)} ${n(y + h * 0.55)}" stroke="#ffffff" stroke-width="2" opacity=".55" fill="none" stroke-linecap="round"/>${sparkle(n(x + k * w * 0.05), n(y + h * 0.1), n(w * 0.14))}<path d="${lashes}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`;
    }
    if (style === "drop") {
      // A water-drop catchlight.
      const cx = x - w * 0.27,
        cy = y - h * 0.26,
        r = w * 0.27;
      return `${round}<path d="M${n(cx)} ${n(cy - r * 1.55)}C${n(cx + r * 0.25)} ${n(cy - r * 0.7)} ${n(cx + r)} ${n(cy - r * 0.25)} ${n(cx + r)} ${n(cy + r * 0.25)}A${n(r)} ${n(r)} 0 0 1 ${n(cx - r)} ${n(cy + r * 0.25)}C${n(cx - r)} ${n(cy - r * 0.25)} ${n(cx - r * 0.25)} ${n(cy - r * 0.7)} ${n(cx)} ${n(cy - r * 1.55)}Z" fill="#fff" stroke="none"/><circle cx="${n(x + w * 0.38)}" cy="${n(y + h * 0.36)}" r="${n(w * 0.15)}" fill="#fff"/>${sparkle(n(x + w * 0.4), n(y - h * 0.5), n(w * 0.16))}`;
    }
    if (style === "gem")
      // Diamond-shaped catchlights, like the crystals Auralynx wears.
      return `${round}<path d="M${n(x - w * 0.28)} ${n(y - h * 0.66)}L${n(x - w * 0.02)} ${n(y - h * 0.3)}L${n(x - w * 0.28)} ${n(y + h * 0.06)}L${n(x - w * 0.54)} ${n(y - h * 0.3)}Z" fill="#fff" stroke="none"/><path d="M${n(x + w * 0.38)} ${n(y + h * 0.2)}L${n(x + w * 0.5)} ${n(y + h * 0.36)}L${n(x + w * 0.38)} ${n(y + h * 0.52)}L${n(x + w * 0.26)} ${n(y + h * 0.36)}Z" fill="#fff" stroke="none"/>`;
    if (style === "owl")
      // Concentric rings: a hypnotic owl stare.
      return `${e(x, y, w, h, INK)}${e(x, y, w * 0.8, h * 0.8, ring)}${e(x, y, w * 0.6, h * 0.6, p.dark)}${e(x, y, w * 0.44, h * 0.44, ring)}${e(x, y, w * 0.27, h * 0.27, INK)}${e(x - w * 0.32, y - h * 0.34, w * 0.36, h * 0.3, "#ffffff")}<circle cx="${n(x + w * 0.34)}" cy="${n(y + h * 0.32)}" r="${n(w * 0.14)}" fill="#fff"/>`;
    if (style === "sleepy") {
      // Drowsy half-lowered lids with a soft lid line.
      const shape = `M${n(x - w)} ${n(y - h * 0.08)}Q${x} ${n(y - h * 0.6)} ${n(x + w)} ${n(y - h * 0.08)}A${n(w)} ${n(h)} 0 0 1 ${n(x - w)} ${n(y - h * 0.08)}Z`;
      return `<path d="${shape}" fill="${INK}"/>${e(x, y + h * 0.3, w * 0.72, h * 0.48, ring)}${e(x, y + h * 0.26, w * 0.4, h * 0.34, INK)}${e(x - w * 0.3, y - h * 0.02, w * 0.28, h * 0.2, "#ffffff")}<circle cx="${n(x + w * 0.34)}" cy="${n(y + h * 0.38)}" r="${n(w * 0.12)}" fill="#fff"/><path d="M${n(x - w * 0.96)} ${n(y - h * 0.08)}Q${x} ${n(y - h * 0.6)} ${n(x + w * 0.96)} ${n(y - h * 0.08)}" stroke="${p.dark}" stroke-width="1.8" stroke-linecap="round" opacity=".6" fill="none"/>`;
    }
    if (style === "glance" || style === "shy") {
      // Glance: a cheeky sideways look. Shy: eyes cast down and away.
      const [dx, dy] =
        style === "glance" ? [profile ? -0.26 : 0.26, -0.05] : [-0.18, 0.18];
      const cx = x + dx * w,
        cy = y + dy * h;
      return `${e(x, y, w, h, INK)}${e(n(cx), n(cy + h * 0.2), n(w * 0.66), n(h * 0.48), ring)}${e(n(cx), n(cy + h * 0.14), n(w * 0.38), n(h * 0.36), INK)}${e(n(x - w * 0.28), n(y - h * 0.38), n(w * 0.4), n(h * 0.34), "#ffffff")}<circle cx="${n(x + w * 0.4)}" cy="${n(y + h * 0.36)}" r="${n(w * 0.15)}" fill="#fff"/>`;
    }
    if (style === "frost") {
      // Frosted lashes on the outer upper edge and an ice-diamond glint.
      const lash = (dx: number, dy: number, lx: number, ly: number) =>
        `M${n(x - k * dx)} ${n(y + dy)}l${n(-k * lx)} ${ly}`;
      return `${round}${glints}<path d="${lash(12, -9, 4, -3.5)}${lash(9, -12.5, 3, -4.2)}${lash(5, -14.5, 1.5, -4.6)}" stroke="#e9fbff" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M${n(x + k * 7)} ${y - 7}l2 3l-2 3l-2 -3Z" fill="#e9fbff" stroke="none"/>`;
    }
    if (style === "keen") {
      // A marksman's level stare: a straight brow, sloping a touch toward the nose.
      const brow =
        mood === "normal"
          ? `<path d="M${n(x - k * 12)} ${n(y - 13.5)}L${n(x + k * 8)} ${n(y - 12.2)}" stroke="${p.dark}" stroke-width="2.8" stroke-linecap="round" fill="none"/>`
          : "";
      return round + glints + brow;
    }
    if (style === "content") {
      // Eyes closed in bliss, resting on the cheeks: a capybara in a hot spring.
      return `<path d="M${n(x - w * 0.9)} ${n(y - 1)}Q${x} ${n(y + h * 0.62)} ${n(x + w * 0.9)} ${n(y - 1)}" stroke="${INK}" stroke-width="4.2" fill="none" stroke-linecap="round"/><path d="M${n(x - k * w * 0.9)} ${n(y - 1)}l${n(-k * 3.2)} -2.6" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    }
    if (style === "star") {
      // A five-pointed star for a pupil: the moon rabbit.
      const r = w * 0.51,
        sx = x,
        sy = y + h * 0.19;
      const star = Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5,
          rr = i % 2 ? r * 0.45 : r;
        return `${i ? "L" : "M"}${n(sx + Math.cos(a) * rr)} ${n(sy + Math.sin(a) * rr)}`;
      }).join("");
      return `${e(x, y, w, h, INK)}${e(x, n(y + h * 0.15), n(w * 0.77), n(h * 0.71), ring)}<path d="${star}Z" fill="#ffe27a" stroke="none"/>${e(n(x - w * 0.3), n(y - h * 0.37), n(w * 0.34), n(h * 0.25), "#ffffff")}`;
    }
    if (style === "bead") {
      // Small, stubborn beady eyes under a heavy brow.
      const by = y - 6;
      const brow =
        mood === "normal"
          ? `<path d="M${n(x - 10)} ${by - 9.5}H${n(x + 10)}" stroke="${p.dark}" stroke-width="4.2" stroke-linecap="round" fill="none"/>`
          : "";
      return `${e(x, by, n(w * 0.72), n(h * 0.62), INK)}${e(n(x - w * 0.23), n(by - h * 0.16), n(w * 0.26), n(w * 0.26), "#ffffff")}${brow}`;
    }
    return round + glints;
  };
  const eye = (x: number, ring = p.glow, w0 = 9, h0 = 11) => {
    const w = w0 * 1.3,
      h = h0 * 1.22,
      y = 93;
    if (mood !== "normal" && mood !== "focus") return moodEye(x, w, h);
    const open = styledEye(x, y, w, h, ring);
    return mood === "focus" ? open + brow(x, w, h) : open;
  };
  const frontEyes = (ring = p.glow, w = 9, h = 11) =>
    eye(79, ring, w, h) + eye(121, ring, w, h);
  // Each champion's own mouth (the head layer: it never changes with mood).
  /** An ellipse with no outline (tongues, little mouths, blush). */
  const dot = (x: number, y: number, rx: number, ry: number, fill: string) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="none"/>`;
  const stroke = (d: string, color = p.dark, width = 1.9) =>
    `<path d="${d}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const MOUTHS: Partial<Record<CharacterId, string>> = {
    // Big open grin with a tongue.
    voltkit: `<path d="M93.5 106.5Q100 104.5 106.5 106.5Q105.5 115 100 115Q94.5 115 93.5 106.5Z" fill="${INK}" stroke="none"/>${dot(100, 112.3, 3.8, 2.4, "#ff7d9c")}`,
    // Lopsided smirk with one fang.
    cindrake: `${stroke("M93 108.5Q99 112.5 107 106.5")}<path d="M96.4 109.6L97.8 113.4L99.4 110.4Z" fill="#ffffff" stroke="${p.dark}" stroke-width="1"/>`,
    // Cat nose over the ω mouth.
    auralynx: `<path d="M97.2 103.2H102.8L100 106.2Z" fill="#ff9fc0" stroke="${p.dark}" stroke-width="1"/>${stroke("M100 106.2V108.4M95.5 109Q97.8 112 100 108.6Q102.2 112 104.5 109")}`,
    // A tiny "o" of wonder.
    lumoth: `${dot(100, 110, 2.8, 3.4, INK)}${dot(100, 111.2, 1.6, 1.3, "#ff8fb0")}`,
    // Soft, contented smile.
    terradon: stroke("M92.5 108Q100 114.5 107.5 108", p.dark, 2),
  };
  const mouth =
    MOUTHS[id] ??
    `<path d="M95.5 109Q97.8 112 100 109.6Q102.2 112 104.5 109" stroke="${p.dark}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`;
  const blushColor = id === "mystowl" ? "#c2268a" : "#ff8fb0";
  const soft = (s: string) =>
    s.replace(/fill="([^"]+)"/g, 'fill="$1" opacity=".5" stroke="none"');
  const blush =
    id === "terradon"
      ? soft(
          `${e(72, 112, 9, 5.5, blushColor)}${e(128, 112, 9, 5.5, blushColor)}`,
        )
      : id === "cindrake"
        ? // Anime blush slashes over a soft pink patch.
          soft(
            `${e(69, 106, 8, 4.5, blushColor)}${e(131, 106, 8, 4.5, blushColor)}`,
          ) +
          stroke(
            "M63 106l3-4M68 107l3-4M73 108l3-4M127 108l-3-4M132 107l-3-4M137 106l-3-4",
            "#ff6f6f",
            2,
          )
        : id === "pyranda"
          ? // Shy: a flush with little lines, and a nervous sweat drop.
            soft(
              `${e(69, 108, 8, 4.5, blushColor)}${e(131, 108, 8, 4.5, blushColor)}`,
            ) +
            line(
              "M62 104l3-3.5M66 105l3-3.5M134 105l3-3.5M138 104l3-3.5",
              "#ff6f6f",
              1.6,
              0.8,
            ) +
            path(
              "M140 66Q146 74 143 79Q138 82 135.5 77.5Q135 72 140 66Z",
              "#bfeaff",
              ` stroke="${p.dark}" stroke-width="1.2"`,
            )
          : id === "lumoth"
            ? soft(
                `${e(66, 109, 10, 5.5, blushColor)}${e(134, 109, 10, 5.5, blushColor)}`,
              )
            : soft(
                `${e(68, 108, 8, 4.5, blushColor)}${e(132, 108, 8, 4.5, blushColor)}`,
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
    earFar: "",
    ears: "",
    eyes: frontEyes(),
    scarf: "",
    flame: "",
  };
  // ---- Pieces the new eight share between parts.
  /** A small living flame (Pyranda's tail tip and its chestnut). */
  const flameTip = (x: number, y: number, r = 9) =>
    `<circle cx="${x}" cy="${y}" r="${n(r * 1.6)}" fill="${shine}" stroke="none" opacity=".8"/>${path(`M${n(x - r * 0.7)} ${n(y + r * 0.5)}Q${x - r} ${n(y - r * 0.6)} ${x} ${n(y - r * 1.6)}Q${n(x + r * 0.2)} ${n(y - r * 0.6)} ${n(x + r * 0.7)} ${n(y - r * 0.9)}Q${x + r} ${y} ${n(x + r * 0.7)} ${n(y + r * 0.5)}Q${x} ${y + r} ${n(x - r * 0.7)} ${n(y + r * 0.5)}Z`, jewel)}${path(`M${n(x - r * 0.3)} ${n(y + r * 0.4)}Q${n(x - r * 0.4)} ${n(y - r * 0.3)} ${x} ${n(y - r * 0.8)}Q${n(x + r * 0.4)} ${n(y - r * 0.2)} ${n(x + r * 0.3)} ${n(y + r * 0.4)}Z`, "#fff3b8", ' stroke="none"')}`;
  /** A drifting snow crystal (Glacelle). */
  const snowflake = (x: number, y: number, r: number) =>
    `<g opacity=".9">${line(`M${x - r} ${y}H${x + r}M${n(x - r * 0.5)} ${n(y - r * 0.86)}L${n(x + r * 0.5)} ${n(y + r * 0.86)}M${n(x - r * 0.5)} ${n(y + r * 0.86)}L${n(x + r * 0.5)} ${n(y - r * 0.86)}`, "#e8fbff", 1.6)}</g>`;
  /** A curling tentacle with suckers (Shadopus), from (x0, y0) to (x1, y1) bending through (cx, cy). */
  const tentacle = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    cx: number,
    cy: number,
  ) => {
    const d = `M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}`;
    const at = (t: number) => [
      (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1,
      (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1,
    ];
    return `${line(d, p.dark, 15)}${line(d, body, 11.5)}<circle cx="${x1}" cy="${y1}" r="5.6" fill="${body}"/>${[
      0.35, 0.6, 0.82,
    ]
      .map((t) => {
        const [bx, by] = at(t);
        return `<circle cx="${n(bx)}" cy="${n(by + 3)}" r="2" fill="${p.light}" stroke="none" opacity=".85"/>`;
      })
      .join("")}`;
  };
  /**
   * Shadopus's glowing eye under its ink mask: half-lidded and sly. Moods use
   * the shared shapes drawn in glow, as Duskveil's do.
   */
  const inkEye = (x: number) => {
    const halo = (r: number, o: number) =>
      `<circle cx="${x}" cy="94" r="${r}" fill="${shine}" stroke="none" opacity="${o}"/>`;
    if (mood !== "normal" && mood !== "focus")
      return halo(12, 0.55) + moodEye(x, 8, 9, p.glow);
    const lid = `${path(`M${x - 9} 94Q${x} 85 ${x + 9} 94L${x + 9} 84H${x - 9}Z`, p.accent, ' stroke="none"')}${stroke(`M${x - 8.5} 93.5Q${x} 86 ${x + 8.5} 93.5`, p.glow, 1.4)}`;
    return `${halo(13, 0.75)}${e(x, 94, 7.5, 8.5, p.glow)}${e(x - 2.5, 93, 3, 2.6, "#ffffff")}${lid}${mood === "focus" ? brow(x, 7.5, 9.5, p.glow) : ""}`;
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
    // A wide axolotl smile.
    layers.head = `${e(100, 90, 42, 31, face)}${highlight(70, 78, 22)}${path("M88 107Q100 117 112 107", "none", ` stroke="${p.dark}" stroke-width="2.2" stroke-linecap="round"`)}`;
    // The bandana is tied at the back, so its tails show in the side and back
    // views only; one-sided tails here made the head look tilted.
    layers.flame = `${path("M60 76Q100 58 140 76L138 85Q100 70 62 85Z", p.accent)}${path("M94 66Q100 58 106 66Q104 74 100 75Q96 74 94 66Z", "#ffe7c2")}${line("M97 64L100 70L103 64", p.mid, 1.4, 0.8)}`;
    // Round eyes with a water-drop catchlight.
    layers.eyes = eye(78, "#7cf6ff", 8.6, 9.8) + eye(122, "#7cf6ff", 8.6, 9.8);
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
    // Young tortoise boy with a champion-like oval face, sprout, mossy shell,
    // and short, sturdy limbs.
    const flower = (x: number, y: number, c = "#ffb3d1", r = 3.4) =>
      `${[0, 1, 2, 3, 4].map((i) => e(+(x + Math.cos((i * 2 * Math.PI) / 5) * r).toFixed(1), +(y + Math.sin((i * 2 * Math.PI) / 5) * r).toFixed(1), r * 0.85, r * 0.85, c).replace("/>", ' stroke="none"/>')).join("")}<circle cx="${x}" cy="${y}" r="${(r * 0.6).toFixed(1)}" fill="#fff3a0" stroke="none"/>`;
    // The shell, worn upright on its back: round, with moss along the top.
    layers.wings = `${path("M56 150Q48 116 64 98Q82 80 100 80Q118 80 136 98Q152 116 144 150Q136 166 100 166Q64 166 56 150Z", body)}${line("M100 82V164M72 104Q100 112 128 104M62 132Q100 142 138 132", p.dark, 2.2, 0.45)}${path("M64 100Q72 84 88 84Q100 76 112 84Q128 84 136 100Q124 94 112 96Q100 88 88 96Q76 94 64 100Z", p.glow)}${flower(64, 108)}${flower(138, 112, "#ffffff")}${path("M140 98L144 76L151 90L157 72L160 96L148 104Z", "#bfe9ff")}${line("M145 82L147 94M156 78L155 92", "#ffffff", 1.4, 0.8)}`;
    // Match the other champions' horizontal oval face and simple smile, with
    // the same soft brow arcs as the side view (creature-profile.ts).
    layers.head = `${e(100, 88, 40, 33, face)}${highlight(72, 70, 26)}${line("M68 75Q79 71.5 90 75.5M132 75Q121 71.5 110 75.5", p.dark, 1.8, 0.48)}${mouth}`;
    layers.eyes = frontEyes(p.glow, 10, 12);
    layers.flame = `${line("M100 60Q98 48 101 36", "#5aa64a", 3.4)}${path("M100 50Q84 38 76 46Q86 58 100 50Z", p.glow)}${path("M100 44Q114 28 126 36Q114 48 100 44Z", p.glow)}${flower(101, 34, "#ffb3d1", 3.8)}`;
    // A slightly broader, lifted torso tucks under the head to avoid a neck gap.
    layers.body = `${e(100, 136, 28, 25)}${e(100, 142, 18, 18, pearl)}${line("M86 135Q100 139 114 135M87 146Q100 150 113 146", p.mid, 1.6, 0.55)}`;
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
  if (id === "coilemur") {
    // Ring-tailed lemur: pointed ears, a white face mask with dark eye patches,
    // a copper-banded electromagnet tail, coil bracers and a horseshoe-magnet clip.
    const ear = (dir: number) => {
      const x = (v: number) => 100 + dir * v;
      return `${path(`M${x(22)} 66Q${x(30)} 34 ${x(50)} 28Q${x(52)} 50 ${x(40)} 72Z`, body)}${path(`M${x(28)} 64Q${x(34)} 42 ${x(46)} 36Q${x(46)} 52 ${x(38)} 66Z`, p.light, ' stroke="none"')}`;
    };
    layers.ears = ear(-1) + ear(1);
    layers.head = `${e(100, 88, 41, 33, face)}${path("M62 92Q66 66 100 64Q134 66 138 92Q132 116 100 120Q68 116 62 92Z", p.light, ' stroke="none"')}${e(79, 94, 16, 15, p.dark, ' opacity=".85" stroke="none" transform="rotate(-18 79 94)"')}${e(121, 94, 16, 15, p.dark, ' opacity=".85" stroke="none" transform="rotate(18 121 94)"')}${path("M96 102L104 102L100 107Z", INK, ' stroke="none"')}${highlight(70, 74, 18)}${stroke("M93.5 108Q100 112.5 106.5 107.5")}${path("M101.5 109.6Q103 116.5 107.4 113Q108.4 110 106 108.6Z", "#ff7d9c", ` stroke="${p.dark}" stroke-width="1.3"`)}`;
    layers.eyes = frontEyes("#ffb02e", 8.5, 10);
    // A horseshoe magnet clipped to the right ear, sparking.
    layers.flame = `${path("M118 52Q118 40 128 40Q138 40 138 52L133 52Q133 45 128 45Q123 45 123 52Z", "#e8473f")}${path("M118 52H123V56H118ZM133 52H138V56H133Z", "#e6ecf5")}${sparkle(142, 40, 4, p.glow)}`;
    const tail =
      "M124 152Q160 156 166 128Q170 104 152 92Q140 82 150 64Q158 50 176 52";
    layers.tail = `${line(tail, p.dark, 22)}${line(tail, p.mid, 17.5)}<path d="${tail}" fill="none" stroke="${p.accent}" stroke-width="17.5" stroke-dasharray="9 9" stroke-linecap="butt"/>${line(tail, "#ffffff", 3, 0.35)}<circle cx="176" cy="52" r="15" fill="${shine}" stroke="none"/>${sparkle(176, 52, 6)}${line("M170 36L174 44L168 46L172 54", p.glow, 2.2, 0.9)}`;
    layers.body = `${e(100, 138, 29, 28)}${e(100, 144, 18, 18, pearl)}${highlight(80, 124, 16)}`;
    const coil = (x: number) =>
      `${hand(x)}${[136, 142, 148].map((y) => e(x, y, 10.5, 2.6, p.accent, ` stroke="${p.dark}" stroke-width="1.2"`)).join("")}${e(x, 156, 7, 3.5, p.dark, ' opacity=".55" stroke="none"')}`;
    layers.armL = coil(67);
    layers.armR = coil(133);
    layers.legL = paw(80, 160, 14);
    layers.legR = paw(120, 160, 14);
  }
  if (id === "pyranda") {
    const marks = pyrandaMarks(p);
    // Red panda, the "fire fox": white-rimmed ears, white brow spots, tear
    // marks, dark legs and belly, a fluffy tail with a flame tip, and a
    // bandolier of glowing chestnuts it lobs as mortars.
    const ear = (dir: number) => {
      const x = (v: number) => 100 + dir * v;
      return `${path(`M${x(20)} 68Q${x(22)} 36 ${x(42)} 32Q${x(56)} 44 ${x(44)} 72Z`, p.accent)}${path(`M${x(26)} 66Q${x(28)} 44 ${x(41)} 41Q${x(49)} 50 ${x(41)} 68Z`, marks.mark, ' stroke="none"')}`;
    };
    layers.ears = ear(-1) + ear(1);
    const shyMouth = stroke(
      "M93.5 111Q96 108.5 98.5 111Q101 113.5 103.5 111Q105.5 109 107 110.5",
    );
    layers.head = `${e(100, 88, 41, 33, face)}${path("M78 101Q80 92 91 94Q100 97 109 94Q120 92 122 101Q120 116 100 118Q80 116 78 101Z", p.accent, ' stroke="none"')}${e(77, 74, 7.5, 4.2, p.accent, ' stroke="none" transform="rotate(16 77 74)"')}${e(123, 74, 7.5, 4.2, p.accent, ' stroke="none" transform="rotate(-16 123 74)"')}${line("M69 100Q71 111 78 116M131 100Q129 111 122 116", marks.mark, 4, 0.5)}${path("M96 102H104L100 106Z", INK, ' stroke="none"')}${highlight(68, 72, 22)}${shyMouth}`;
    layers.eyes = frontEyes("#ffb84d", 9, 11);
    const dark = marks.limb;
    layers.body = `${e(100, 138, 30, 28)}${e(100, 144, 17, 18, marks.belly)}${highlight(80, 124, 16)}`;
    layers.armL = hand(67, dark);
    layers.armR = `${path("M134 132Q134 120 143 118Q152 120 152 130Q150 138 143 138Q136 138 134 132Z", "#8a4a22")}${e(143, 121, 7, 3, "#c98a52")}${flameTip(143, 110, 6)}${hand(133, dark)}`;
    layers.legL = paw(80, 160, 14, dark);
    layers.legR = paw(120, 160, 14, dark);
    layers.tail = `${path("M122 152Q160 160 172 132Q180 108 164 92Q156 86 150 94Q162 104 158 120Q152 140 120 140Z", body)}${line("M150 140Q160 136 168 128M158 118Q166 114 174 114", marks.mark, 6, 0.35)}${flameTip(157, 88, 10)}`;
    layers.scarf = `${line("M72 120L128 158", "#6b3a1e", 6)}${[0.3, 0.55, 0.8]
      .map((t) => {
        const x = 72 + 56 * t,
          y = 120 + 38 * t;
        return `${e(x, y, 4.5, 4.5, "#8a4a22")}${e(x, y - 1, 1.8, 1.8, p.glow, ' stroke="none"')}`;
      })
      .join("")}`;
  }
  if (id === "glacelle") {
    // Sea angel: a translucent floating body with a glowing orange heart, two
    // frosted wing-flaps, little ice horns and drifting snow crystals.
    layers.legL = "";
    layers.legR = "";
    layers.ears = `${path("M76 60L70 34L86 54Z", jewel)}${path("M124 60L130 34L114 54Z", jewel)}${line("M72 40L78 50M128 40L122 50", "#ffffff", 1.4, 0.8)}`;
    const frost = (x: number, y: number) =>
      line(
        `M${x - 2.4} ${y}H${x + 2.4}M${x} ${y - 2.4}V${y + 2.4}`,
        "#ffffff",
        1.3,
        0.9,
      );
    layers.head = `${e(100, 88, 39, 34, face, ' fill-opacity=".93"')}${highlight(70, 72, 24)}${stroke("M96.5 109.5Q100 112.6 103.5 109.5")}${frost(66, 103)}${frost(71, 109)}${frost(134, 103)}${frost(129, 109)}`;
    layers.eyes = frontEyes("#43c6ff", 9.5, 11.5);
    layers.body = `${path("M72 120Q100 110 128 120Q134 146 116 166Q106 178 100 186Q94 178 84 166Q66 146 72 120Z", body, ' fill-opacity=".9"')}${e(100, 140, 9, 11, `url(#${prefix}-heart)`, ' stroke="none"')}<circle cx="100" cy="140" r="17" fill="url(#${prefix}-heartglow)" stroke="none"/>${line("M86 128Q84 146 92 162M114 128Q116 146 108 162", "#ffffff", 1.6, 0.45)}`;
    const flap = (dir: number) => {
      const x = (v: number) => 100 + dir * v;
      return `${path(`M${x(26)} 126Q${x(52)} 104 ${x(64)} 118Q${x(70)} 132 ${x(54)} 146Q${x(40)} 150 ${x(26)} 140Z`, jewel, ' fill-opacity=".85"')}${line(`M${x(30)} 132Q${x(46)} 124 ${x(58)} 124`, "#ffffff", 1.5, 0.75)}${sparkle(x(54), 132, 3)}`;
    };
    layers.armL = flap(-1);
    layers.armR = flap(1);
    layers.wings = `${snowflake(40, 96, 6)}${snowflake(164, 80, 5)}${snowflake(156, 150, 4)}${snowflake(44, 156, 4)}`;
    layers.flame = path(
      "M88 58Q100 46 112 58Q106 54 100 56Q94 54 88 58Z",
      "#ffffff",
      ' opacity=".9" stroke="none"',
    );
  }
  if (id === "halcyra") {
    // Kingfisher marksman: a swept crest, a long crystal beak, white cheek
    // flashes, an orange chest, feathered wing-arms, small orange feet and a
    // focusing visor ring over one eye.
    layers.ears = `${path("M70 62Q60 46 70 34Q78 48 84 52Q82 36 94 26Q98 44 104 50Q110 34 124 32Q118 50 126 60Z", body)}${line("M76 54Q78 46 76 40M96 46Q98 38 96 32M114 50Q118 42 120 36", p.light, 1.6, 0.6)}`;
    layers.head = `${e(100, 88, 41, 33, face)}${path("M60 98Q64 112 78 116Q70 106 72 98Z", "#ffffff", ' stroke="none"')}${path("M140 98Q136 112 122 116Q130 106 128 98Z", "#ffffff", ' stroke="none"')}${highlight(70, 72, 24)}`;
    layers.eyes = frontEyes(p.glow, 8.5, 10.5);
    layers.flame = `${path("M92 100L108 100L100 136Z", jewel)}${line("M100 102V132", "#ffffff", 1.6, 0.8)}${path("M92 100Q100 96 108 100Q100 104 92 100Z", p.dark, ' opacity=".5" stroke="none"')}${path("M100 62L105 69L100 76L95 69Z", jewel)}<circle cx="100" cy="69" r="9" fill="${shine}" stroke="none" opacity=".6"/><circle cx="121" cy="93" r="17" fill="none" stroke="${p.glow}" stroke-width="2.6"/><circle cx="121" cy="93" r="17" fill="none" stroke="#ffffff" stroke-width="1" opacity=".7" stroke-dasharray="6 30"/>${stroke("M137 98Q144 104 140 111", p.glow, 1.6)}`;
    layers.body = `${e(100, 138, 29, 28)}${e(100, 144, 19, 20, `url(#${prefix}-chest)`)}${highlight(80, 124, 16)}`;
    const wing = (dir: number) => {
      const x = (v: number) => 100 + dir * v;
      return `${path(`M${x(26)} 120Q${x(48)} 124 ${x(46)} 150Q${x(44)} 162 ${x(34)} 166Q${x(36)} 156 ${x(30)} 158Q${x(30)} 150 ${x(24)} 150Q${x(18)} 136 ${x(26)} 120Z`, body)}${line(`M${x(30)} 132Q${x(38)} 142 ${x(36)} 156`, p.light, 1.5, 0.6)}${path(`M${x(28)} 126Q${x(40)} 128 ${x(40)} 138Q${x(32)} 136 ${x(28)} 132Z`, p.glow, ' stroke="none" opacity=".55"')}`;
    };
    layers.armL = wing(-1);
    layers.armR = wing(1);
    const foot = (x: number) =>
      line(
        `M${x} 162V172M${x} 172L${x - 6} 176M${x} 172L${x + 6} 176M${x} 172V178`,
        p.accent,
        3.2,
      );
    layers.legL = foot(88);
    layers.legR = foot(112);
    layers.tail = path(
      "M122 150Q146 156 158 172Q144 172 140 166Q138 174 128 172Q130 164 120 158Z",
      body,
    );
  }
  if (id === "sunbara") {
    // Capybara on a sunny day: a broad boxy muzzle, tiny ears, blissful closed
    // eyes, a glowing yuzu with a leaf and sun rays, and a striped bath towel.
    layers.ears = `${e(66, 64, 9, 8)}${e(66, 65, 4.5, 4, p.dark, ' opacity=".55" stroke="none"')}${e(134, 64, 9, 8)}${e(134, 65, 4.5, 4, p.dark, ' opacity=".55" stroke="none"')}`;
    layers.head = `${path("M58 90Q58 56 100 56Q142 56 142 90Q142 120 100 122Q58 120 58 90Z", face)}${path("M74 100Q74 90 100 90Q126 90 126 100Q126 120 100 121Q74 120 74 100Z", `url(#${prefix}-muzzle)`)}${e(92, 101, 3, 2.2, p.dark, ' stroke="none"')}${e(108, 101, 3, 2.2, p.dark, ' stroke="none"')}${stroke("M95.5 111Q97.8 114 100 111.6Q102.2 114 104.5 111")}${highlight(68, 70, 26)}`;
    layers.eyes = eye(80, p.glow, 9, 11) + eye(120, p.glow, 9, 11);
    layers.flame = `<circle cx="100" cy="40" r="24" fill="${shine}" stroke="none" opacity=".75"/>${[
      0, 1, 2, 3, 4, 5, 6, 7,
    ]
      .map((i) => {
        const a = (i * Math.PI) / 4;
        return line(
          `M${n(100 + Math.cos(a) * 17)} ${n(40 + Math.sin(a) * 17)}L${n(100 + Math.cos(a) * 23)} ${n(40 + Math.sin(a) * 23)}`,
          p.glow,
          2.4,
          0.9,
        );
      })
      .join(
        "",
      )}${e(100, 41, 13, 12, `url(#${prefix}-yuzu)`)}${path("M100 30Q106 20 116 24Q110 32 100 30Z", "#7cc46a")}${e(96, 37, 4, 2.5, "#ffffff", ' opacity=".6" stroke="none"')}`;
    layers.body = `${e(100, 140, 33, 27)}${e(100, 145, 20, 18, pearl)}${highlight(78, 126, 18)}`;
    layers.scarf = `${path("M68 122Q100 134 132 122L134 132Q100 146 66 132Z", "#ffffff")}${line("M70 127Q100 139 130 127", "#ff8f6b", 2, 0.85)}${path("M126 128L138 156L128 156L120 132Z", "#ffffff")}${line("M128 140H134M130 148H136", "#ff8f6b", 1.6, 0.85)}`;
    layers.legL = paw(82, 162, 13);
    layers.legR = paw(118, 162, 13);
    layers.armL = hand(65);
    layers.armR = hand(135);
  }
  if (id === "astrabun") {
    // Moon rabbit: tall ears (one folded at the tip), a crescent-moon mark,
    // star pupils, a cotton tail and a wooden mochi mallet with a gold band.
    layers.ears = `${path("M78 64Q64 30 72 8Q84 4 88 30Q90 50 90 62Z", body)}${path("M80 58Q72 34 76 16Q82 16 84 34Q86 48 86 58Z", "#ffc6e3", ' stroke="none"')}${path("M110 62Q110 40 118 22Q124 12 134 14Q132 24 126 22Q124 34 124 64Z", body)}${path("M114 58Q114 42 120 28L122 58Z", "#ffc6e3", ' stroke="none"')}${path("M118 22Q128 6 146 8Q140 18 128 22Z", body)}`;
    layers.head = `${e(100, 88, 39, 33, face)}${highlight(72, 72, 22)}${path("M97 103Q100 100 103 103Q100 106 97 103Z", "#ff8fb8", ' stroke="none"')}${stroke("M100 105V107.6M100 107.6Q97.5 110.5 95.5 109.5M100 107.6Q102.5 110.5 104.5 109.5")}${path("M98.3 108.2H101.7V111.4H98.3Z", "#ffffff", ` stroke="${p.dark}" stroke-width=".9"`)}${line("M100 108.2V111.4", p.dark, 0.8)}`;
    layers.flame = `${path("M104 58Q94 62 95 72Q96 80 106 82Q98 76 99 70Q100 62 104 58Z", `url(#${prefix}-moon)`)}${sparkle(112, 62, 3, p.glow)}`;
    layers.eyes = frontEyes(p.accent, 9, 11);
    layers.body = `${e(100, 138, 28, 28)}${e(100, 143, 17, 19, pearl)}${highlight(80, 124, 16)}`;
    layers.tail = `${e(130, 156, 13, 12, "#ffffff")}${e(126, 152, 5, 4, "#ffffff", ' stroke="none" opacity=".9"')}`;
    const mallet = `${path("M148 154L156 96L162 97L154 155Z", "#b37a45")}${path("M140 80Q140 72 160 74Q178 76 178 86L176 100Q176 108 158 106Q140 104 140 96Z", "#d29a5c")}${path("M152 76L150 104L156 105L158 76Z", p.glow)}${line("M144 82Q158 82 174 86", "#ffffff", 1.6, 0.5)}`;
    layers.armR = `${mallet}${hand(133)}`;
    layers.legL = paw(82, 160, 15);
    layers.legR = paw(118, 160, 15);
  }
  if (id === "wombolder") {
    // Wombat: a wide, squat body, small round ears, a big broad nose, the
    // boulder-hard rump plate it blocks with (on its back), mossy patches,
    // digging claws and a pebble pouch.
    layers.wings = `${path("M46 158Q34 118 54 100Q74 86 100 86Q126 86 146 100Q166 118 154 158Q132 172 100 172Q68 172 46 158Z", `url(#${prefix}-stone)`)}${line("M58 114L70 126L64 140M142 110L132 124L140 136M52 146L62 152", p.dark, 1.8, 0.45)}${path("M52 106Q68 92 84 96Q76 104 60 110Z", p.glow, ' opacity=".9"')}${path("M128 96Q144 96 150 110Q140 106 126 102Z", p.glow, ' opacity=".9"')}`;
    layers.ears = `${e(64, 62, 10, 10)}${e(64, 63, 5, 5, p.dark, ' opacity=".45" stroke="none"')}${e(136, 62, 10, 10)}${e(136, 63, 5, 5, p.dark, ' opacity=".45" stroke="none"')}`;
    layers.head = `${e(100, 90, 44, 32, face)}${path("M88 98Q88 91 100 91Q112 91 112 98Q112 106 100 106Q88 106 88 98Z", "#3a2a22")}${e(95, 95, 3, 2, "#ffffff", ' opacity=".5" stroke="none"')}${stroke("M95 113Q100 115 105 113", p.dark, 2.2)}${highlight(66, 72, 26)}`;
    layers.eyes = eye(76, p.glow, 6, 8.4) + eye(124, p.glow, 6, 8.4);
    layers.flame = `${e(112, 60, 9, 6, `url(#${prefix}-stone)`)}${path("M104 58Q108 50 116 54Q112 58 104 58Z", p.glow, ' stroke="none"')}`;
    layers.body = `${e(100, 140, 36, 27)}${e(100, 146, 22, 17, pearl)}${highlight(76, 126, 18)}`;
    layers.scarf = `${path("M66 134Q100 146 134 134L134 140Q100 152 66 140Z", "#6b4a2c")}${e(124, 146, 8, 7, "#8a6440")}${line("M118 142Q124 138 130 142", "#3e2a1a", 1.4, 0.8)}`;
    const claw = (x: number) =>
      `${e(x, 140, 11, 14)}${e(x, 152, 12, 7)}${line(`M${x - 6} 156L${x - 7} 161M${x} 157V162M${x + 6} 156L${x + 7} 161`, "#f4ead8", 2.6)}`;
    layers.armL = claw(62);
    layers.armR = claw(138);
    layers.legL = paw(80, 164, 16);
    layers.legR = paw(120, 164, 16);
  }
  if (id === "shadopus") {
    // Midnight octopus: a tall mantle with glowing spots, a bandit ink mask
    // over glowing eyes, curling tentacle arms and legs with suckers, ink drips.
    layers.head = `${path("M58 96Q54 48 100 40Q146 48 142 96Q138 120 100 122Q62 120 58 96Z", face)}${e(84, 58, 4, 3, p.glow, ' opacity=".8" stroke="none"')}${e(118, 52, 3, 2.5, p.glow, ' opacity=".8" stroke="none"')}${e(128, 70, 2.5, 2, p.glow, ' opacity=".7" stroke="none"')}${highlight(70, 66, 22)}${path("M60 88Q100 76 140 88L140 102Q100 92 60 102Z", p.accent)}${path("M60 92L50 86L54 96Z", p.accent)}${stroke("M91 108Q99 115 108 106.5", p.light, 2)}${stroke("M108 106.5l2 -1.6", p.light, 1.6)}`;
    layers.eyes = inkEye(82) + inkEye(118);
    layers.body = `${e(100, 136, 26, 22)}${highlight(82, 124, 14)}`;
    layers.armL = tentacle(80, 132, 46, 128, 54, 154);
    layers.armR = tentacle(120, 132, 154, 128, 146, 154);
    layers.legL =
      tentacle(90, 150, 70, 176, 72, 160) +
      tentacle(96, 154, 92, 182, 100, 170);
    layers.legR =
      tentacle(110, 150, 130, 176, 128, 160) +
      tentacle(104, 154, 108, 182, 100, 170);
    const curl = "M118 140Q160 150 168 116Q172 96 156 92";
    layers.tail = `${line(curl, p.dark, 15)}${line(curl, body, 11.5)}<circle cx="156" cy="92" r="5.6" fill="${body}"/>${e(160, 170, 7, 4, p.accent, ' opacity=".7" stroke="none"')}${e(40, 172, 5, 3, p.accent, ' opacity=".6" stroke="none"')}`;
  }
  if (dir === "down" && id !== "duskveil" && id !== "shadopus")
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
  // A flat drawing leaves out every masked overlay (see FLAT_ART below).
  if (!flat) defs += championMaterials(id, prefix, p, layers);
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
  if (art && look) dressLayers(id, dir, look, art, p, prefix, layers, flat);
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
  flat: boolean,
) {
  if (art.pattern && !flat) {
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
  flat = false,
) {
  return creatureSvgRenderer(id, dir, mood, look, flat)(part, viewBox);
}
/** Prepare a look once when several cropped textures share the same drawing. */
export function creatureSvgRenderer(
  id: CharacterId,
  dir: Facing,
  mood: Mood = "normal",
  look?: SkinLook | null,
  flat = false,
) {
  const { defs, layers } = creatureLayers(id, dir, mood, look, flat);
  const stroke = paletteFor(id, lookFor(id, look)).dark;
  const FACE_PARTS: CreaturePart[] = [
    "head",
    "earFar",
    "ears",
    "eyes",
    "flame",
  ];
  const order = dir === "down" ? [] : profilePartOrder(dir, id);
  // A part listed after the head (Terradon's shell from behind) draws over it.
  const firstFace = order.findIndex((p) => FACE_PARTS.includes(p));
  const lastFace =
    order.length -
    1 -
    [...order].reverse().findIndex((p) => FACE_PARTS.includes(p));
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
