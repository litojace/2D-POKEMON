import type { CharacterId } from "@arena/shared";
import type { CreaturePart } from "../creature-design";
import type { ModernTheme } from "./modern-fashion";

/**
 * Per-champion designs for the modern collections: inside one collection,
 * every champion plays its own role with its own accessories, drawn from
 * who the champion is (Voltkit's electricity, Mystowl's stars and books,
 * Terradon's shell and stone, Tidefin's water, Sunbara's sun and orange).
 */
export interface Kit {
  id: CharacterId;
  side: number;
  back: boolean;
  hx: number;
  ht: number;
  C: number;
  T: number;
  B: number;
  W: number;
  L: number;
  R: number;
  ink: string;
  put: (part: CreaturePart, svg: string, under?: boolean) => void;
  path: (d: string, fill: string, stroke?: string, sw?: number) => string;
  line: (d: string, color: string, sw?: number) => string;
  circle: (x: number, y: number, r: number, fill: string, stroke?: string, sw?: number) => string;
  rect: (x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, sw?: number) => string;
  lume: (kind: "pulse" | "blink" | "chase" | "twinkle", svg: string, i?: number, color?: string) => string;
  garment: (svg: string) => string;
  star: (x: number, y: number, r: number, n: number, inner?: number) => string;
  /** An Epic collection's costume: tailored cloth (see `tailorFront`). */
  epic?: boolean;
}

/** Eye areas (both eyes, front; the near eye, side), measured from the art. */
const EYES: Partial<Record<CharacterId, { down: number[]; side: number[] }>> = {
  voltkit: { down: [60, 72, 139, 106], side: [108, 72, 142, 105] },
  mystowl: { down: [59, 72, 140, 106], side: [112, 72, 146, 106] },
  terradon: { down: [59, 82, 140, 106], side: [108, 82, 142, 105] },
  tidefin: { down: [60, 74, 140, 104], side: [108, 72, 142, 104] },
  sunbara: { down: [59, 83, 140, 96], side: [101, 83, 136, 96] },
};
/** Lens centres and radius over a champion's eyes in this view. */
function lenses(k: Kit) {
  const e = EYES[k.id] ?? { down: [60, 72, 140, 106], side: [108, 72, 142, 105] };
  if (k.side) {
    const [x0, y0, x1, y1] = e.side;
    const x = k.side > 0 ? (x0 + x1) / 2 : 200 - (x0 + x1) / 2;
    return { pts: [[x, (y0 + y1) / 2]], r: Math.max(10, (y1 - y0) / 2 + 2) };
  }
  const [x0, y0, x1, y1] = e.down;
  const w = x1 - x0;
  return { pts: [[x0 + w * 0.24, (y0 + y1) / 2], [x1 - w * 0.24, (y0 + y1) / 2]], r: Math.max(10, (y1 - y0) / 2 + 2) };
}

// ---- Shared shapes.
export const torso = (k: Kit, color: string, extra = "") =>
  k.garment(k.rect(k.L - 2, k.T - 2, k.R - k.L + 4, k.B - k.T + 6, 0, color, "none") + (k.epic ? tailorFront(k) : "") + extra);

// ---- Epic tailoring. An Epic costume reads as cut cloth rather than a flat
// sticker: light on the shoulders, shade at the hem and the sides, seams and
// stitching. It is drawn in the garment's own colours (white and black at a
// low opacity), never in metal or a second body hue: the gold rim, clasp and
// two-tone body stay Legendary's.
/** The light (top) and shade (bottom, sides) gradients the tailoring uses. */
export const CLOTH_DEFS =
  `<defs><linearGradient id="epic-cloth-v" x1="0" y1="0" x2="0" y2="1">` +
  `<stop offset="0" stop-color="#ffffff" stop-opacity=".32"/><stop offset=".32" stop-color="#ffffff" stop-opacity="0"/>` +
  `<stop offset=".62" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity=".36"/></linearGradient>` +
  `<linearGradient id="epic-cloth-h" x1="0" y1="0" x2="1" y2="0">` +
  `<stop offset="0" stop-color="#000000" stop-opacity=".26"/><stop offset=".24" stop-color="#000000" stop-opacity="0"/>` +
  `<stop offset=".76" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity=".26"/></linearGradient></defs>`;
/** Shading, seams and a stitched hem over a front or profile garment's
 * base cloth (inside its clip, under the design's own pieces). */
export function tailorFront(k: Kit) {
  const box = `x="${k.L - 3}" y="${k.T - 3}" width="${k.R - k.L + 6}" height="${k.B - k.T + 8}"`;
  const seam = (d: string) => `<path d="${d}" fill="none" stroke="#000000" stroke-opacity=".3" stroke-width=".9" stroke-linecap="round"/>`;
  const seams = k.side
    ? // The side seam, toward the back of the profile.
      seam(`M${k.C - k.side * k.W * 0.35} ${k.T + 2}Q${k.C - k.side * k.W * 0.45} ${(k.T + k.B) / 2} ${k.C - k.side * k.W * 0.38} ${k.B + 2}`)
    : // Princess seams from the shoulders to the hem.
      [-1, 1].map((s) => seam(`M${k.C + s * k.W * 0.62} ${k.T}Q${k.C + s * k.W * 0.42} ${(k.T + k.B) / 2} ${k.C + s * k.W * 0.5} ${k.B + 2}`)).join("");
  return (
    CLOTH_DEFS +
    `<rect ${box} fill="url(#epic-cloth-v)"/><rect ${box} fill="url(#epic-cloth-h)"/>` +
    seams +
    // A stitched hem and its fold line.
    `<path d="M${k.L - 2} ${k.B - 4.5}H${k.R + 2}" stroke="#000000" stroke-opacity=".22" stroke-width="1"/>` +
    `<path d="M${k.L} ${k.B - 2.4}H${k.R}" stroke="#ffffff" stroke-opacity=".55" stroke-width=".8" stroke-dasharray="1.8 1.5"/>`
  );
}
/** The box of an SVG path's points. Paths here use absolute commands; H and
 * V break the x y pairing, so only the M/L/Q/C/T points are read. */
function pathBox(d: string) {
  const xs: number[] = [],
    ys: number[] = [];
  for (const m of d.matchAll(/[MLQCT]\s*([-\d.\s,]+)/g)) {
    const v = (m[1].match(/-?\d*\.?\d+/g) ?? []).map(Number);
    for (let i = 0; i + 1 < v.length; i += 2) xs.push(v[i]), ys.push(v[i + 1]);
  }
  if (!xs.length) return null;
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
let clothIds = 0;
/**
 * The back of an Epic costume: its panel or cape (the first filled shape
 * of the back piece, if it is wide enough to be one) gains the same light
 * and shade, a yoke seam across the shoulders, a centre back seam and
 * topstitching round its edge, so it reads as a garment from behind too.
 */
export function tailorBack(k: Kit, svg: string) {
  // Opaque cloth only: a see-through piece (a jelly bell) is not sewn.
  const m = svg.match(/<path d="([^"]+)" fill="(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})"[^>]*\/>/);
  if (!m) return svg;
  const box = pathBox(m[1]);
  if (!box || box.x1 - box.x0 < k.W * 1.4 || box.y1 - box.y0 < (k.B - k.T) * 0.7) return svg;
  const id = `epic-back-${k.id}-${clothIds++}`;
  const { x0, x1, y0, y1 } = box,
    c = (x0 + x1) / 2,
    w = x1 - x0,
    h = y1 - y0;
  const overlay =
    CLOTH_DEFS +
    `<defs><clipPath id="${id}"><path d="${m[1]}"/></clipPath></defs><g clip-path="url(#${id})">` +
    `<path d="${m[1]}" fill="url(#epic-cloth-v)"/><path d="${m[1]}" fill="url(#epic-cloth-h)"/>` +
    // A yoke across the shoulders and a centre back seam below it.
    `<path d="M${x0} ${y0 + h * 0.2}Q${c} ${y0 + h * 0.28} ${x1} ${y0 + h * 0.2}" fill="none" stroke="#000000" stroke-opacity=".3" stroke-width="1"/>` +
    `<path d="M${x0} ${y0 + h * 0.2 + 1.6}Q${c} ${y0 + h * 0.28 + 1.6} ${x1} ${y0 + h * 0.2 + 1.6}" fill="none" stroke="#ffffff" stroke-opacity=".4" stroke-width=".7" stroke-dasharray="1.8 1.5"/>` +
    `<path d="M${c} ${y0 + h * 0.26}V${y1}" stroke="#000000" stroke-opacity=".24" stroke-width=".9"/>` +
    // Fold lines falling from the yoke to the hem.
    [-1, 1].map((s) => `<path d="M${c + s * w * 0.22} ${y0 + h * 0.34}Q${c + s * w * 0.28} ${y0 + h * 0.7} ${c + s * w * 0.3} ${y1}" fill="none" stroke="#000000" stroke-opacity=".16" stroke-width="1.6"/>`).join("") +
    // Topstitching just inside the edge.
    `<path d="${m[1]}" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="3" stroke-dasharray="1.8 1.5"/>` +
    `<path d="${m[1]}" fill="none" stroke="#000000" stroke-opacity=".25" stroke-width="6.4"/></g>`;
  const at = (m.index ?? 0) + m[0].length;
  return svg.slice(0, at) + overlay + svg.slice(at);
}
export const backPanel = (k: Kit, color: string, extra = "", hem = 2) =>
  k.put(
    "scarf",
    k.epic
      ? // Tailored: sloped shoulders, a hem that curves and a collar.
        k.path(`M${k.C - k.W - 2} ${k.T + 5}Q${k.C - k.W + 2} ${k.T - 2} ${k.C - k.W * 0.45} ${k.T - 2}Q${k.C} ${k.T - 5} ${k.C + k.W * 0.45} ${k.T - 2}Q${k.C + k.W - 2} ${k.T - 2} ${k.C + k.W + 2} ${k.T + 5}L${k.C + k.W + 3} ${k.B + hem - 1}Q${k.C} ${k.B + hem + 4} ${k.C - k.W - 3} ${k.B + hem - 1}Z`, color) +
          `<path d="M${k.C - k.W * 0.5} ${k.T - 2}Q${k.C} ${k.T - 6} ${k.C + k.W * 0.5} ${k.T - 2}L${k.C + k.W * 0.42} ${k.T + 3}Q${k.C} ${k.T + 0.5} ${k.C - k.W * 0.42} ${k.T + 3}Z" fill="${color}" stroke="${k.ink}" stroke-width=".9" stroke-linejoin="round"/>` +
          `<path d="M${k.C - k.W * 0.5} ${k.T - 2}Q${k.C} ${k.T - 6} ${k.C + k.W * 0.5} ${k.T - 2}L${k.C + k.W * 0.42} ${k.T + 3}Q${k.C} ${k.T + 0.5} ${k.C - k.W * 0.42} ${k.T + 3}Z" fill="#000000" fill-opacity=".28" stroke="none"/>` +
          extra
      : k.path(`M${k.C - k.W - 1} ${k.T + 1}Q${k.C} ${k.T - 4} ${k.C + k.W + 1} ${k.T + 1}L${k.C + k.W + 2} ${k.B + hem}L${k.C - k.W - 2} ${k.B + hem}Z`, color) + extra,
  );
/** Something carried on a pole slung across the back, shown above a shoulder. */
export function onPole(k: Kit, item: (x: number, y: number) => string) {
  const s = k.side ? -k.side : 1;
  if (k.back) {
    const x = k.C - s * 34,
      y = k.T - 34;
    k.put("scarf", k.line(`M${k.C + s * 10} ${k.B - 4}L${x} ${y + 8}`, "#7a5a3a", 2.2) + item(x, y));
  } else {
    const x = k.C + s * (k.side ? 30 : 64),
      y = k.T - 46;
    k.put("body", k.line(`M${k.C + s * 12} ${k.B - 6}L${x - s * 2} ${y + 9}`, "#7a5a3a", 2.2) + item(x, y), true);
  }
}
/**
 * A goggle or lens strap round the head at height y: `front` across the
 * brow from the front; in profile from the near lens back over the skull,
 * ending at the head's edge rather than past it; across the back of the head
 * from behind, with a small buckle.
 */
export function headStrap(k: Kit, y: number, color: string, sw: number, front: string) {
  const d = k.back
    ? `M${k.hx - 44} ${y + 6}Q${k.hx} ${y + 12} ${k.hx + 44} ${y + 6}`
    : k.side
      ? `M${k.hx + k.side * 8} ${y - 2}Q${k.hx - k.side * 14} ${y - 6} ${k.hx - k.side * 30} ${y + 8}`
      : front;
  return k.line(d, color, sw) + (k.back ? k.rect(k.hx - 3.5, y + 6.5, 7, 5, 1.2, "#8a8f9c", k.ink, 0.6) : "");
}
/** A brimmed hat crown + brim, front or side. */
export function hatShape(k: Kit, w: number, h: number, y: number, crown: string, brim: string, brimW = 1.25) {
  const x = k.hx + k.side * 2;
  if (k.side)
    return k.path(`M${x - w * brimW} ${y}Q${x} ${y + 6} ${x + w * brimW} ${y - 2}Q${x} ${y - 6} ${x - w * brimW} ${y}Z`, brim) +
      k.path(`M${x - w * 0.7} ${y - 1}Q${x - w * 0.75} ${y - h} ${x} ${y - h}Q${x + w * 0.7} ${y - h} ${x + w * 0.65} ${y - 2}Z`, crown);
  return k.path(`M${x - w * brimW} ${y}Q${x} ${y + 8} ${x + w * brimW} ${y}Q${x} ${y - 7} ${x - w * brimW} ${y}Z`, brim) +
    k.path(`M${x - w * 0.62} ${y - 1}Q${x - w * 0.66} ${y - h} ${x} ${y - h}Q${x + w * 0.66} ${y - h} ${x + w * 0.62} ${y - 1}Z`, crown);
}

export type Design = (k: Kit) => void;

export const DESIGNS: Partial<Record<ModernTheme, Partial<Record<CharacterId, Design>>>> = {
  // ================= Neon Campus =================
  campus: {
    // Gaming Club: a hoodie with glowing circuit traces and a cat-ear LED headset.
    voltkit(k) {
      const hood = "#2b2f3d",
        neon = "#59f0ff";
      if (k.back) backPanel(k, hood, k.path(`M${k.C - 16} ${k.T + 1}Q${k.C} ${k.T + 18} ${k.C + 16} ${k.T + 1}`, "#363b4d") +
        [0, 1, 2, 3].map((i) => k.lume("chase", k.circle(k.C - 9 + i * 6, k.B - 8 + (i % 2) * 3, 1, neon, "none", 0), i, neon)).join(""));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, hood,
          k.path(`M${c - 12} ${k.T}Q${c} ${k.T + 9} ${c + 12} ${k.T}`, "#3a4058", k.ink, 0.9) +
            k.line(`M${c - 4} ${k.T + 6}V${k.T + 16}M${c + 4} ${k.T + 6}V${k.T + 16}`, "#f2f2f8", 0.9) +
            // Circuit traces: a pad at each end, lit in a run.
            k.lume("chase", k.line(`M${c - 10} ${k.B - 4}V${k.B - 12}H${c - 4}`, neon, 1), 0, neon) +
            k.lume("chase", k.line(`M${c + 10} ${k.B - 4}V${k.B - 14}H${c + 3}V${k.T + 20}`, neon, 1), 1, neon) +
            k.lume("chase", k.circle(c - 4, k.B - 12, 1.3, neon, "none", 0) + k.circle(c + 3, k.T + 20, 1.3, neon, "none", 0), 2, neon)));
      }
      // The headset: a band, cups with LED rings, and cat ears outlined in light.
      const span = k.side ? 0 : 52,
        cy = k.ht + 46;
      const cups = k.side ? [k.hx - k.side * 18] : [k.hx - span, k.hx + span];
      const ear = (x: number, s: number) => k.path(`M${x - 7} ${k.ht + 2}L${x + s * 2} ${k.ht - 14}L${x + 8} ${k.ht + 1}Z`, "#2b2f3d") +
        k.lume("pulse", k.line(`M${x - 4} ${k.ht}L${x + s * 2} ${k.ht - 9}L${x + 5} ${k.ht}`, neon, 1.2), 0, neon);
      k.put("flame",
        (k.side ? k.line(`M${cups[0]} ${cy - 8}Q${cups[0] - k.side * 4} ${k.ht - 8} ${cups[0] + k.side * 14} ${k.ht - 4}`, "#2b2f3d", 4.6)
          : k.line(`M${k.hx - span} ${cy - 8}Q${k.hx - span + 2} ${k.ht - 12} ${k.hx} ${k.ht - 12}Q${k.hx + span - 2} ${k.ht - 12} ${k.hx + span} ${cy - 8}`, "#2b2f3d", 4.6) + ear(k.hx - 26, -1) + ear(k.hx + 26, 1)) +
          cups.map((x) => k.circle(x, cy, 10, "#2b2f3d") + k.lume("pulse", `<circle cx="${x}" cy="${cy}" r="7" fill="none" stroke="${neon}" stroke-width="1.8"/>`, 1, neon)).join("") +
          (k.back ? "" : k.line(`M${cups[cups.length - 1]} ${cy + 6}Q${cups[cups.length - 1] - (k.side || 1) * 2} ${cy + 22} ${cups[cups.length - 1] - (k.side || 1) * 18} ${cy + 26}`, "#2b2f3d", 1.8) +
            k.lume("blink", k.circle(cups[cups.length - 1] - (k.side || 1) * 19, cy + 26, 1.8, "#ff4f8a", k.ink, 0.5), 0, "#ff4f8a")));
    },
    // Library Prefect: round glasses that catch the light, a sweater vest
    // with a bow tie and a prefect's star pin.
    mystowl(k) {
      const vest = "#6a3f7e",
        diamond = "#8a5aa0";
      if (k.back) backPanel(k, vest, [0, 1].map((i) => k.path(`M${k.C - 10 + i * 20} ${k.T + 6}l6 8l-6 8l-6 -8Z`, diamond, "none")).join(""));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, vest,
          // Argyle diamonds, a white collar and a bow tie.
          [-1, 0, 1].map((i) => k.path(`M${c + i * 13} ${k.T + 10}l6 8l-6 8l-6 -8Z`, diamond, "none")).join("") +
            k.line(`M${c - 16} ${k.T + 14}L${c + 16} ${k.T + 30}M${c + 16} ${k.T + 14}L${c - 16} ${k.T + 30}`, "#c9a3e7", 0.5) +
            k.path(`M${c - 10} ${k.T - 1}L${c} ${k.T + 7}L${c + 10} ${k.T - 1}Z`, "#f7f4ee", k.ink, 0.8) +
            k.path(`M${c} ${k.T + 3}l-6 -3v6Z M${c} ${k.T + 3}l6 -3v6Z`, "#ffd65b", k.ink, 0.6) +
            k.lume("pulse", k.path(k.star(c + (k.side ? k.side * 8 : 11), k.T + 15, 3.4, 5), "#ffe08a", k.ink, 0.5), 0, "#ffe08a")));
      }
      if (!k.back) {
        const { pts, r } = lenses(k);
        k.put("flame",
          pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff22" stroke="#c9a24a" stroke-width="2.2"/>`).join("") +
            (pts.length > 1 ? k.line(`M${pts[0][0] + r} ${pts[0][1] - 2}Q100 ${pts[0][1] - 8} ${pts[1][0] - r} ${pts[1][1] - 2}`, "#c9a24a", 2) : "") +
            // A glint slides across each lens.
            pts.map(([x, y], i) => k.lume("twinkle", k.line(`M${x - r * 0.5} ${y - r * 0.2}L${x - r * 0.1} ${y - r * 0.6}`, "#ffffff", 2.2), i, "#ffffff")).join(""));
      }
    },
    // Sports Captain: a jersey with a lit number, a striped sweatband and a whistle.
    terradon(k) {
      const jersey = "#2f8a4f",
        white = "#f7f4ee";
      if (k.back) backPanel(k, jersey, k.lume("pulse", `<text x="${k.C}" y="${k.B - 6}" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="22" text-anchor="middle" fill="#d6ff7a" stroke="${k.ink}" stroke-width="0.8">1</text>`, 0, "#d6ff7a"));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, jersey,
          k.path(`M${c - 10} ${k.T - 2}Q${c} ${k.T + 8} ${c + 10} ${k.T - 2}`, white, k.ink, 0.8) +
            k.line(`M${k.L} ${k.T + 6}H${k.R}`, white, 2) +
            k.lume("pulse", `<text x="${c}" y="${k.B - 7}" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="17" text-anchor="middle" fill="#d6ff7a" stroke="${k.ink}" stroke-width="0.7">1</text>`, 0, "#d6ff7a") +
            // The whistle on its cord.
            k.line(`M${c - 7} ${k.T}Q${c - 3} ${k.T + 12} ${c + 6} ${k.T + 14}`, "#ff8a3a", 0.9) +
            k.rect(c + 4, k.T + 12, 7, 4, 2, "#d9d9e0", k.ink, 0.6)));
      }
      // A sweatband round the brow, with a glowing stripe.
      const y = k.ht + 14;
      const w = k.side ? 44 : 48;
      const x = k.hx + k.side * 3;
      k.put("flame", k.path(`M${x - w} ${y + 2}Q${x} ${y - 6} ${x + w} ${y + 2}L${x + w} ${y + 9}Q${x} ${y + 1} ${x - w} ${y + 9}Z`, white) +
        k.lume("chase", k.line(`M${x - w + 2} ${y + 5.5}Q${x} ${y - 2.5} ${x + w - 2} ${y + 5.5}`, "#3ad86a", 1.8), 0, "#3ad86a"));
    },
    // Swim Team: a swim cap with goggles pushed up on it, a track jacket and a towel.
    tidefin(k) {
      const capC = "#ff6f8f",
        jacket = "#1f6f8b";
      if (k.back) backPanel(k, jacket, k.line(`M${k.C - k.W} ${k.T + 12}H${k.C + k.W}`, "#ffffff", 2) + k.path(`M${k.C - 14} ${k.T - 2}Q${k.C} ${k.T + 10} ${k.C + 14} ${k.T - 2}`, "#ffffff"));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, jacket,
          // Zip, side stripes, a towel round the neck, a glowing zip pull.
          k.line(`M${c} ${k.T + 4}V${k.B}`, "#0f3a4a", 1.2) +
            k.line(`M${k.L + 3} ${k.T + 2}V${k.B}M${k.R - 3} ${k.T + 2}V${k.B}`, "#ffffff", 1.6) +
            k.path(`M${c - 13} ${k.T - 2}Q${c} ${k.T + 8} ${c + 13} ${k.T - 2}L${c + 9} ${k.T + 16}L${c + 5} ${k.T + 6}Q${c} ${k.T + 9} ${c - 5} ${k.T + 6}L${c - 9} ${k.T + 16}Z`, "#ffffff", k.ink, 0.8) +
            k.lume("pulse", k.rect(c - 1.6, k.T + 18, 3.2, 5, 1, "#7ff0ff", k.ink, 0.5), 0, "#7ff0ff")));
      }
      // The cap hugs the top of the head; goggles rest on its front.
      const x = k.hx + k.side * 2,
        y = k.ht + 22;
      const w = k.side ? 44 : 50;
      let cap = k.path(`M${x - w} ${y + 2}Q${x - w} ${k.ht - 8} ${x} ${k.ht - 8}Q${x + w} ${k.ht - 8} ${x + w} ${y + 2}Q${x} ${y - 6} ${x - w} ${y + 2}Z`, capC) +
        k.line(`M${x - w * 0.5} ${k.ht - 3}Q${x - w * 0.6} ${y - 6} ${x - w * 0.7} ${y}`, "#ffffff88", 2);
      if (!k.back) {
        const gx = k.side ? [x + k.side * 18] : [x - 16, x + 16];
        cap += k.line(`M${x - w} ${y - 2}Q${x} ${y - 10} ${x + w} ${y - 2}`, "#2b2f3d", 2.2) +
          gx.map((g, i) => k.path(`M${g - 9} ${y - 6}Q${g} ${y - 14} ${g + 9} ${y - 6}Q${g + 9} ${y + 2} ${g} ${y + 2}Q${g - 9} ${y + 2} ${g - 9} ${y - 6}Z`, "#2b2f3d") +
            k.lume("pulse", k.path(`M${g - 6.5} ${y - 6}Q${g} ${y - 11} ${g + 6.5} ${y - 6}Q${g + 6.5} ${y} ${g} ${y}Q${g - 6.5} ${y} ${g - 6.5} ${y - 6}Z`, "#7ff0ff", "none"), i, "#7ff0ff")).join("");
      }
      k.put("flame", cap);
    },
    // Art Club: a beret beside the orange, a smock splashed with glow-in-the-dark
    // paint and a brush tucked behind an ear.
    sunbara(k) {
      const smock = "#f4f1ea";
      const splash = (x: number, y: number, r: number, c: string, i: number) =>
        k.lume("twinkle", k.path(`M${x - r} ${y}Q${x - r} ${y - r} ${x} ${y - r}Q${x + r * 1.2} ${y - r * 0.8} ${x + r} ${y + r * 0.2}Q${x + r * 0.4} ${y + r * 1.3} ${x - r * 0.4} ${y + r * 0.8}Z`, c, "none"), i, c);
      const dots = (c: number) =>
        splash(c - 12, k.T + 12, 3.2, "#ff4fd8", 0) + splash(c + 9, k.T + 20, 2.8, "#59f0ff", 1) + splash(c - 4, k.B - 8, 3, "#b6ff4f", 2) + splash(c + 13, k.T + 6, 2, "#ffd84a", 3);
      if (k.back) backPanel(k, smock, dots(k.C) + k.line(`M${k.C - 12} ${k.T + 2}L${k.C + 12} ${k.T + 2}`, k.ink, 0.6));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, smock, k.path(`M${c - 9} ${k.T - 1}L${c} ${k.T + 8}L${c + 9} ${k.T - 1}`, "none", k.ink, 0.8) + k.rect(c - 7, k.B - 18, 14, 8, 2, "#ece6da", k.ink, 0.6) + dots(c)));
      }
      // A big beret tipped over the crown (in place of the orange), and a
      // brush behind the ear.
      const s = k.side ? -k.side : -1;
      const bx = k.hx + s * 12,
        by = k.ht + 4;
      k.put("flame", `<ellipse cx="${bx}" cy="${by}" rx="38" ry="15" fill="#c8323a" stroke="${k.ink}" stroke-width="1.2" transform="rotate(${s * 10} ${bx} ${by})"/>` +
        k.line(`M${bx - 30} ${by + 6}Q${bx} ${by + 14} ${bx + 30} ${by + 6}`, "#a02028", 1.6) +
        k.circle(bx - s * 4, by - 15, 2.6, "#c8323a") +
        (k.back ? "" : k.line(`M${k.hx - s * 46} ${k.ht + 30}L${k.hx - s * 58} ${k.ht + 8}`, "#d9a35a", 2.4) +
          k.lume("pulse", k.circle(k.hx - s * 58, k.ht + 7, 2.6, "#ff4fd8", k.ink, 0.5), 4, "#ff4fd8")));
    },
  },

  // ================= Hero Squad =================
  hero: {
    // Speedster: a winged visor over the brow and a lightning bolt that runs
    // down the suit in light.
    voltkit(k) {
      const suit = "#2b4c9b",
        bolt = "#ffd84a";
      const boltD = (c: number, t: number, b: number) => `M${c + 3} ${t}L${c - 6} ${(t + b) / 2 + 1}L${c} ${(t + b) / 2 + 1}L${c - 3} ${b}L${c + 7} ${(t + b) / 2 - 3}L${c + 1} ${(t + b) / 2 - 3}Z`;
      if (k.back) backPanel(k, suit, k.lume("chase", k.path(boltD(k.C, k.T + 3, k.B - 2), bolt, k.ink, 0.6), 0, bolt));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, suit, k.line(`M${k.L} ${k.T + 3}Q${c} ${k.T + 10} ${k.R} ${k.T + 3}`, "#ffffff", 1.4) + k.lume("chase", k.path(boltD(c, k.T + 4, k.B - 3), bolt, k.ink, 0.6), 0, bolt)));
      }
      // The visor band: a lens across the brow with swept wings at the sides.
      const y = k.ht + 20;
      const x = k.hx + k.side * 3;
      const w = k.side ? 40 : 50;
      const wing = (s: number) => k.path(`M${x + s * (w - 4)} ${y - 4}L${x + s * (w + 14)} ${y - 16}L${x + s * (w + 8)} ${y - 4}L${x + s * (w + 16)} ${y - 6}L${x + s * w} ${y + 6}Z`, "#f2f2f8");
      k.put("flame", (k.side ? wing(-k.side) : wing(-1) + wing(1)) +
        k.path(`M${x - w} ${y - 4}Q${x} ${y - 12} ${x + w} ${y - 4}L${x + w} ${y + 5}Q${x} ${y - 3} ${x - w} ${y + 5}Z`, "#2b2f3d") +
        (k.back ? "" : k.lume("pulse", k.path(`M${x - w + 6} ${y - 1}Q${x} ${y - 8} ${x + w - 6} ${y - 1}L${x + w - 6} ${y + 2}Q${x} ${y - 5} ${x - w + 6} ${y + 2}Z`, bolt, "none"), 1, bolt)));
    },
    // Mystic Sorcerer: a tall star-lined collar cape, a rune amulet and a circlet.
    mystowl(k) {
      const robe = "#3a2458",
        lining = "#1b1438";
      const stars = (x0: number, y0: number, w: number, h: number) =>
        [0, 1, 2, 3, 4].map((i) => k.lume("twinkle", k.path(k.star(x0 + ((i * 0.37) % 1) * w, y0 + ((i * 0.61) % 1) * h, 1.6, 4), "#fff3c4", "none"), i, "#fff3c4")).join("");
      if (k.back) k.put("scarf", k.path(`M${k.C - k.W} ${k.T - 6}Q${k.C} ${k.T - 12} ${k.C + k.W} ${k.T - 6}L${k.C + k.W + 10} ${k.B + 12}Q${k.C} ${k.B + 18} ${k.C - k.W - 10} ${k.B + 12}Z`, lining) + stars(k.C - k.W - 4, k.T, 2 * k.W + 8, k.B - k.T + 8));
      else {
        const c = k.C + k.side * 3;
        // The high collar rises behind the head's lower edge.
        k.put("body", k.path(`M${k.C - k.W - 6} ${k.T + 4}L${k.C - k.W - 12} ${k.T - 18}Q${k.C - k.W} ${k.T - 10} ${k.C - 8} ${k.T - 4}Z`, lining, k.ink, 0.9) +
          k.path(`M${k.C + k.W + 6} ${k.T + 4}L${k.C + k.W + 12} ${k.T - 18}Q${k.C + k.W} ${k.T - 10} ${k.C + 8} ${k.T - 4}Z`, lining, k.ink, 0.9) +
          k.path(`M${k.C - k.W - 4} ${k.T + 2}L${k.C - k.W - 10} ${k.B + 10}L${k.C - k.W + 2} ${k.B}Z M${k.C + k.W + 4} ${k.T + 2}L${k.C + k.W + 10} ${k.B + 10}L${k.C + k.W - 2} ${k.B}Z`, lining, k.ink, 0.9), true);
        // The amulet: a ring of runes round a gem, glowing.
        k.put("body", torso(k, robe, k.line(`M${c - 9} ${k.T - 1}L${c} ${k.T + 8}L${c + 9} ${k.T - 1}`, "#c9a24a", 1)) +
          k.circle(c, k.T + 15, 7, "#2b1c44", "#c9a24a", 1.2) +
          k.lume("pulse", `<circle cx="${c}" cy="${k.T + 15}" r="5" fill="none" stroke="#c7a8ff" stroke-width="0.9" stroke-dasharray="1.6 1.2"/>` + k.path(k.star(c, k.T + 15, 3, 4), "#e6d8ff", "none"), 0, "#c7a8ff"));
      }
      if (!k.back) {
        // A thin gold circlet with a gem on the brow.
        const x = k.hx + k.side * 4,
          y = k.ht + 18;
        const w = k.side ? 40 : 48;
        k.put("flame", k.line(`M${x - w} ${y + 4}Q${x} ${y - 6} ${x + w} ${y + 4}`, "#c9a24a", 2) +
          k.lume("pulse", k.path(`M${x + k.side * 10} ${y - 7}l4 5l-4 5l-4 -5Z`, "#c7a8ff", k.ink, 0.6), 1, "#c7a8ff"));
      }
    },
    // Iron Bulwark: stone pauldrons and a chest plate with lava running in its cracks.
    terradon(k) {
      const stone = "#7a6a58",
        dark = "#4a3f34",
        lava = "#ff8a3a";
      const cracks = (c: number, y: number) => k.line(`M${c - 9} ${y - 6}L${c - 3} ${y}L${c - 6} ${y + 6}M${c - 3} ${y}L${c + 5} ${y - 2}L${c + 9} ${y + 5}M${c + 5} ${y - 2}L${c + 3} ${y - 8}`, lava, 1.3);
      if (k.back) backPanel(k, dark, k.path(`M${k.C - 14} ${k.T + 6}H${k.C + 14}L${k.C + 10} ${k.B - 4}H${k.C - 10}Z`, stone) + k.lume("pulse", cracks(k.C, k.T + 18), 0, lava));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, dark, k.path(`M${c - 15} ${k.T + 2}H${c + 15}L${c + 11} ${k.B - 6}L${c} ${k.B - 2}L${c - 11} ${k.B - 6}Z`, stone) + k.lume("pulse", cracks(c, k.T + 16), 0, lava)));
        // Pauldrons: boulders on the shoulders, glowing at their seams.
        const pad = (s: number) => k.path(`M${k.C + s * (k.W - 6)} ${k.T + 6}Q${k.C + s * (k.W - 4)} ${k.T - 8} ${k.C + s * (k.W + 10)} ${k.T - 4}Q${k.C + s * (k.W + 16)} ${k.T + 4} ${k.C + s * (k.W + 10)} ${k.T + 10}Z`, stone) +
          k.lume("pulse", k.line(`M${k.C + s * (k.W - 2)} ${k.T + 2}L${k.C + s * (k.W + 8)} ${k.T}`, lava, 1.1), 1, lava);
        k.put("body", k.side ? pad(-k.side) : pad(-1) + pad(1));
      }
      // A horned stone helm band.
      const x = k.hx + k.side * 3,
        y = k.ht + 12;
      const w = k.side ? 42 : 48;
      const horn = (s: number) => k.path(`M${x + s * (w - 12)} ${y - 4}Q${x + s * (w + 4)} ${y - 14} ${x + s * (w + 2)} ${y - 26}Q${x + s * (w - 8)} ${y - 14} ${x + s * (w - 20)} ${y - 6}Z`, "#e8dcc4");
      k.put("flame", (k.side ? horn(-k.side) : horn(-1) + horn(1)) +
        k.path(`M${x - w} ${y + 4}Q${x} ${y - 8} ${x + w} ${y + 4}L${x + w} ${y + 10}Q${x} ${y - 1} ${x - w} ${y + 10}Z`, stone) +
        (k.back ? "" : k.lume("pulse", k.circle(x + k.side * 8, y - 1, 2.6, lava, k.ink, 0.6), 2, lava)));
    },
    // Tide Guardian: a fin-crested helm, a trident emblem and a belt of wave lights.
    tidefin(k) {
      const suit = "#1f5f7a",
        foam = "#7ff0ff";
      const trident = (c: number, y: number, s: number) => k.path(`M${c} ${y - 8 * s}l2 4v4h2v-6l2 2v6q0 3 -4 3h-1v6h-2v-6h-1q-4 0 -4 -3v-6l2 -2v6h2v-4Z`.replace(/(\d+(?:\.\d+)?)/g, (m) => m), "#ffd84a", k.ink, 0.5);
      if (k.back) k.put("scarf", k.path(`M${k.C - k.W + 2} ${k.T}Q${k.C} ${k.T - 4} ${k.C + k.W - 2} ${k.T}L${k.C + k.W + 8} ${k.B + 10}Q${k.C + k.W / 2} ${k.B + 4} ${k.C} ${k.B + 10}Q${k.C - k.W / 2} ${k.B + 4} ${k.C - k.W - 8} ${k.B + 10}Z`, "#2f8fb0") +
        [0, 1, 2, 3, 4].map((i) => k.lume("chase", k.circle(k.C - k.W - 6 + i * (2 * k.W + 12) / 4, k.B + 8 - (i % 2) * 4, 1.2, foam, "none", 0), i, foam)).join(""));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, suit,
          k.path(`M${k.L} ${k.T + 2}Q${c} ${k.T + 12} ${k.R} ${k.T + 2}L${k.R} ${k.T - 2}L${k.L} ${k.T - 2}Z`, "#2f8fb0", "none") +
            k.lume("pulse", trident(c, k.T + 16, 1), 0, "#ffd84a") +
            k.rect(k.L - 2, k.B - 10, k.R - k.L + 4, 4, 0, "#0f3a4a") +
            [0, 1, 2, 3, 4].map((i) => k.lume("chase", k.circle(k.L + 4 + i * (k.R - k.L - 8) / 4, k.B - 8, 1.2, foam, "none", 0), i, foam)).join("")));
      }
      // A fin crest along the top of the head, lit along its edge.
      const x = k.hx + k.side * 2;
      const crest = k.side
        ? k.path(`M${x - k.side * 20} ${k.ht + 4}Q${x - k.side * 6} ${k.ht - 22} ${x + k.side * 14} ${k.ht - 10}Q${x + k.side * 4} ${k.ht - 4} ${x + k.side * 6} ${k.ht + 4}Z`, "#2f8fb0")
        : k.path(`M${x - 8} ${k.ht + 4}Q${x - 10} ${k.ht - 16} ${x} ${k.ht - 26}Q${x + 10} ${k.ht - 16} ${x + 8} ${k.ht + 4}Z`, "#2f8fb0");
      k.put("flame", crest + k.lume("pulse", k.side ? k.line(`M${x - k.side * 16} ${k.ht}Q${x - k.side * 4} ${k.ht - 18} ${x + k.side * 11} ${k.ht - 10}`, foam, 1.4) : k.line(`M${x - 5} ${k.ht + 2}Q${x - 6} ${k.ht - 14} ${x} ${k.ht - 22}Q${x + 6} ${k.ht - 14} ${x + 5} ${k.ht + 2}`, foam, 1.4), 1, foam));
    },
    // Solar Flare: the orange becomes a solar core ringed with light, a sun
    // emblem on the suit and a short flame-coloured cape.
    sunbara(k) {
      const suit = "#a5402c",
        sun = "#ffd84a";
      const sunEm = (c: number, y: number, r: number) => k.circle(c, y, r * 0.55, sun, k.ink, 0.6) +
        k.line(Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `M${c + Math.cos(a) * r * 0.75} ${y + Math.sin(a) * r * 0.75}L${c + Math.cos(a) * r * 1.15} ${y + Math.sin(a) * r * 1.15}`; }).join(""), sun, 1.4);
      if (k.back) k.put("scarf", k.path(`M${k.C - k.W + 2} ${k.T}Q${k.C} ${k.T - 4} ${k.C + k.W - 2} ${k.T}L${k.C + k.W + 6} ${k.B + 8}Q${k.C} ${k.B + 14} ${k.C - k.W - 6} ${k.B + 8}Z`, "#ff8a3a") + k.lume("pulse", sunEm(k.C, k.T + 18, 6), 0, sun));
      else {
        const c = k.C + k.side * 3;
        k.put("body", k.path(`M${k.C - k.W - 4} ${k.T + 2}L${k.C - k.W - 8} ${k.B + 8}L${k.C - k.W + 2} ${k.B}Z M${k.C + k.W + 4} ${k.T + 2}L${k.C + k.W + 8} ${k.B + 8}L${k.C + k.W - 2} ${k.B}Z`, "#ff8a3a", k.ink, 0.9), true);
        k.put("body", torso(k, suit, k.line(`M${k.L} ${k.B - 9}H${k.R}`, sun, 2) + k.lume("pulse", sunEm(c, k.T + 15, 6), 0, sun)));
      }
      // A ring of light round the orange on the head, its rays running. It
      // is part of the solar core, so it rocks with the orange (data-crest).
      const ox = k.hx + k.side * 2,
        oy = k.ht - 12;
      k.put("flame", `<g data-crest="1"><circle cx="${ox}" cy="${oy}" r="17" fill="none" stroke="#ffb347" stroke-width="2"/>` +
        Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return k.lume("chase", k.line(`M${ox + Math.cos(a) * 20} ${oy + Math.sin(a) * 20}L${ox + Math.cos(a) * 25} ${oy + Math.sin(a) * 25}`, sun, 1.8), i, sun);
        }).join("") + "</g>");
    },
  },

  // ================= Starlight Idol =================
  idol: {
    // Rock Idol: a studded jacket, a lightning guitar strap and star shades up on the head.
    voltkit(k) {
      const leather = "#23232c",
        hot = "#ff4f8a";
      const studs = (c: number) => [0, 1, 2, 3, 4].map((i) => k.lume("twinkle", k.circle(c - 14 + i * 7, k.T + 4 + (i % 2) * 2, 0.9, "#e8e8f0", "none", 0), i, "#ffffff")).join("");
      if (k.back) backPanel(k, leather, k.lume("pulse", k.path(k.star(k.C, k.T + 16, 8, 5), hot, k.ink, 0.6), 0, hot) + studs(k.C));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, leather,
          k.path(`M${c - 8} ${k.T}L${c} ${k.T + 14}L${c + 8} ${k.T}Z`, "#f7f4ee", k.ink, 0.7) + studs(c) +
            // The strap crosses the chest with a lightning bolt on it, lit.
            k.line(`M${k.L} ${k.T + 2}L${k.R} ${k.B - 2}`, "#c8323a", 4) +
            k.lume("pulse", k.path(`M${c + 1} ${k.T + 12}l-4 6h3l-2 6l6 -8h-3l2 -4Z`, "#ffd84a", k.ink, 0.5), 0, "#ffd84a")));
      }
      // Star-shaped shades pushed up on the head.
      if (!k.back) {
        const y = k.ht + 8;
        const xs = k.side ? [k.hx + k.side * 14] : [k.hx - 15, k.hx + 15];
        k.put("flame", (k.side ? "" : k.line(`M${k.hx - 6} ${y}H${k.hx + 6}`, hot, 1.6)) +
          xs.map((x, i) => k.path(k.star(x, y, 10, 5, 0.55), hot, k.ink, 1) + k.lume("twinkle", k.line(`M${x - 4} ${y - 2}L${x - 1} ${y - 5}`, "#ffffff", 1.6), i + 5, "#ffffff")).join(""));
      }
    },
    // Moon Witch: a little witch hat with a crescent charm, a frilled capelet and a moon brooch.
    mystowl(k) {
      const cloth = "#2a1f44",
        frill = "#c9a3e7";
      if (k.back) backPanel(k, cloth, k.path(`M${k.C - k.W - 4} ${k.T + 2}Q${k.C} ${k.T + 16} ${k.C + k.W + 4} ${k.T + 2}L${k.C + k.W + 6} ${k.T + 12}Q${k.C} ${k.T + 26} ${k.C - k.W - 6} ${k.T + 12}Z`, frill));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, cloth,
          k.path(`M${k.L - 2} ${k.T - 2}Q${c} ${k.T + 14} ${k.R + 2} ${k.T - 2}L${k.R + 2} ${k.T + 6}Q${c} ${k.T + 22} ${k.L - 2} ${k.T + 6}Z`, frill, k.ink, 0.8) +
            [0, 1, 2, 3, 4, 5].map((i) => k.circle(k.L + 3 + i * (k.R - k.L - 6) / 5, k.T + 6 + Math.sin((i / 5) * Math.PI) * 9, 1.4, "#ffffff", k.ink, 0.4)).join("")) +
          k.lume("pulse", k.path(`M${c + 2} ${k.T + 6}A6 6 0 1 0 ${c + 2} ${k.T + 18}A4.5 4.5 0 1 1 ${c + 2} ${k.T + 6}Z`, "#ffe08a", k.ink, 0.6), 0, "#ffe08a"));
      }
      // The hat, tipped, between the ear tufts, with a crescent hanging from its tip.
      const x = k.hx + (k.side ? k.side * 4 : 0),
        y = k.ht + 10;
      const tipX = x + (k.side ? -k.side * 20 : 18),
        tipY = y - 46;
      const hat = "#4a2a7a";
      k.put("flame", k.path(`M${x - 34} ${y}Q${x} ${y + 8} ${x + 34} ${y}Q${x} ${y - 8} ${x - 34} ${y}Z`, hat) +
        k.path(`M${x - 19} ${y - 2}Q${x - 12} ${y - 24} ${tipX} ${tipY}Q${x + 6} ${y - 22} ${x + 19} ${y - 2}Z`, hat) +
        k.line(`M${x - 18} ${y - 6}Q${x} ${y - 2} ${x + 18} ${y - 6}`, "#ffd65b", 3) +
        k.path(k.star(x - 6, y - 16, 2.4, 4), "#fff3c4", "none") +
        k.lume("twinkle", k.path(`M${tipX + 1} ${tipY + 2}A4 4 0 1 0 ${tipX + 1} ${tipY + 10}A3 3 0 1 1 ${tipX + 1} ${tipY + 2}Z`, "#ffe08a", k.ink, 0.5), 2, "#ffe08a"));
    },
    // Street Dancer: a bucket hat, headphones round the neck and a hoodie with a neon tag.
    terradon(k) {
      const hoodie = "#f2b84a",
        neon = "#4fff9a";
      if (k.back) backPanel(k, hoodie, k.lume("pulse", k.line(`M${k.C - 12} ${k.T + 18}q4 -8 8 0t8 0t8 0`, "#ff4fd8", 2), 0, "#ff4fd8"));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, hoodie,
          k.rect(c - 10, k.B - 16, 20, 9, 3, "#e0a238", k.ink, 0.6) +
            // A sprayed tag, lit like neon.
            k.lume("pulse", k.line(`M${c - 9} ${k.T + 16}q3 -7 6 0t6 0t6 0`, "#ff4fd8", 1.8), 0, "#ff4fd8")));
        // Headphones round the neck.
        k.put("body", k.path(`M${c - 15} ${k.T + 2}Q${c} ${k.T + 10} ${c + 15} ${k.T + 2}`, "none", "#2b2f3d", 2.6) +
          [-1, 1].map((s) => k.circle(c + s * 16, k.T + 3, 5.5, "#2b2f3d") + k.lume("pulse", `<circle cx="${c + s * 16}" cy="${k.T + 3}" r="3.4" fill="none" stroke="${neon}" stroke-width="1.2"/>`, 1, neon)).join(""));
      }
      // A bucket hat with a glowing band.
      const y = k.ht + 14;
      k.put("flame", hatShape(k, 34, 22, y, "#3a3f52", "#3a3f52", 1.5) +
        k.lume("chase", k.line(`M${k.hx + k.side * 2 - 20} ${y - 4}Q${k.hx + k.side * 2} ${y - 7} ${k.hx + k.side * 2 + 20} ${y - 4}`, neon, 1.6), 0, neon));
    },
    // Mermaid Pop: a shell tiara with a glowing pearl, a pearl necklace and a sea-foam frill top.
    tidefin(k) {
      const top = "#bff3ee",
        pearl = "#fff6f0";
      const pearls = (c: number, y: number) => [0, 1, 2, 3, 4, 5, 6].map((i) => {
        const u = i / 6;
        return k.lume("twinkle", k.circle(c - 12 + u * 24, y + Math.sin(u * Math.PI) * 6, 1.6, pearl, "#c9b8b0", 0.4), i, "#ffffff");
      }).join("");
      if (k.back) backPanel(k, top, k.path(`M${k.C - k.W - 2} ${k.B - 6}q4 6 8 0t8 0t8 0t8 0t8 0t8 0`, "#7fd8e0", k.ink, 0.7));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, top, k.path(`M${k.L - 2} ${k.B - 8}q5 7 10 0t10 0t10 0t10 0t10 0t10 0L${k.R + 2} ${k.B + 4}H${k.L - 2}Z`, "#7fd8e0", k.ink, 0.7)) + pearls(c, k.T + 1));
      }
      // The tiara: a scallop shell at the front with a pearl that glows.
      const x = k.hx + k.side * 4,
        y = k.ht + 10;
      const shell = k.path(`M${x - 11} ${y}Q${x - 12} ${y - 14} ${x} ${y - 16}Q${x + 12} ${y - 14} ${x + 11} ${y}Z`, "#ffb3cf") +
        k.line(`M${x} ${y}V${y - 15}M${x - 5} ${y}L${x - 8} ${y - 13}M${x + 5} ${y}L${x + 8} ${y - 13}`, "#e8869f", 0.8);
      k.put("flame", k.line(`M${x - 40} ${y + 6}Q${x} ${y - 6} ${x + 40} ${y + 6}`, "#ffd1e0", 2) + shell +
        k.lume("pulse", k.circle(x, y - 2, 3, pearl, "#c9b8b0", 0.5), 0, "#ffffff"));
    },
    // Sunflower Sweetheart: a sunflower clip by the orange, heart antennae and a cheer top.
    sunbara(k) {
      const top = "#ffd84a",
        heart = "#ff4f8a";
      const heartD = (x: number, y: number, r: number) => `M${x} ${y + r * 0.9}C${x - r * 1.4} ${y - r * 0.1} ${x - r * 0.6} ${y - r * 1.1} ${x} ${y - r * 0.35}C${x + r * 0.6} ${y - r * 1.1} ${x + r * 1.4} ${y - r * 0.1} ${x} ${y + r * 0.9}Z`;
      if (k.back) backPanel(k, top, k.line(`M${k.C - k.W} ${k.T + 10}H${k.C + k.W}`, "#ffffff", 2.4));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, top, k.path(`M${k.L - 2} ${k.T + 8}L${c} ${k.T + 20}L${k.R + 2} ${k.T + 8}L${k.R + 2} ${k.T + 12}L${c} ${k.T + 24}L${k.L - 2} ${k.T + 12}Z`, "#ffffff", "none") +
          k.lume("pulse", k.path(heartD(c, k.T + 10, 5), heart, k.ink, 0.6), 0, heart)));
      }
      // Heart antennae on a headband, bobbing lights; a sunflower clip.
      const x = k.hx + k.side * 2,
        y = k.ht + 6;
      const ant = (s: number, i: number) => k.line(`M${x + s * 22} ${y + 2}Q${x + s * 30} ${y - 12} ${x + s * 26} ${y - 22}`, "#2b2f3d", 1.4) +
        k.lume("pulse", k.path(heartD(x + s * 26, y - 25, 5), heart, k.ink, 0.6), i, heart);
      const flower = (fx: number, fy: number) =>
        Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return `<ellipse cx="${fx + Math.cos(a) * 6}" cy="${fy + Math.sin(a) * 6}" rx="3.6" ry="1.8" fill="#ffd84a" stroke="${k.ink}" stroke-width="0.4" transform="rotate(${(a * 180) / Math.PI} ${fx + Math.cos(a) * 6} ${fy + Math.sin(a) * 6})"/>`;
        }).join("") + k.circle(fx, fy, 3.6, "#7a4a24");
      // The orange gives way to a big sunflower on the headband, its heart glowing.
      k.put("flame", k.line(`M${x - 46} ${y + 10}Q${x} ${y - 6} ${x + 46} ${y + 10}`, "#2b2f3d", 2) +
        (k.side ? ant(-k.side, 1) : ant(-1, 1) + ant(1, 2)) +
        `<g transform="translate(${x + (k.side ? k.side * 6 : 0)} ${y - 6}) scale(1.6) translate(${-(x + (k.side ? k.side * 6 : 0))} ${-(y - 6)})">${flower(x + (k.side ? k.side * 6 : 0), y - 6)}</g>` +
        k.lume("pulse", k.circle(x + (k.side ? k.side * 6 : 0), y - 6, 4, "#ffb347", "none", 0), 3, "#ffb347"));
    },
  },

  // ================= Hồn Việt =================
  viet: {
    // Trung Thu: áo bà ba and a star lantern (đèn ông sao) carried on a pole.
    voltkit(k) {
      const shirt = "#2f6fb8";
      if (k.back) backPanel(k, shirt);
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, shirt, k.path(`M${c - 9} ${k.T - 1}Q${c} ${k.T + 6} ${c + 9} ${k.T - 1}`, "none", k.ink, 0.9) + k.line(`M${c} ${k.T + 4}V${k.B}`, "#1f4f8c", 0.9) +
          [0, 1, 2].map((i) => k.circle(c, k.T + 9 + i * 7, 1, "#f7f4ee", k.ink, 0.4)).join("") + k.rect(c - 14, k.B - 14, 9, 7, 1.5, "#2a62a6", k.ink, 0.6)));
      }
      // The star lantern: red cellophane on a frame, a candle glowing inside.
      onPole(k, (x, y) => k.lume("pulse", k.path(k.star(x, y - 4, 16, 5, 0.5), "#e8322a", k.ink, 1.1) + k.path(k.star(x, y - 4, 9, 5, 0.5), "#ffb347", "none"), 0, "#ffb347") +
        k.line(`M${x - 6} ${y + 10}l-3 9M${x + 6} ${y + 10}l3 9`, "#ffd84a", 1.2));
    },
    // Quan họ Kinh Bắc: a flat nón quai thao with a fringe, a yếm and a sash.
    mystowl(k) {
      const outer = "#6b3f2a",
        yem = "#e8322a";
      if (k.back) backPanel(k, outer, k.line(`M${k.C - k.W} ${k.B - 10}H${k.C + k.W}`, "#3fa04f", 3));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, outer,
          // The yếm (bodice) in the opening of the four-panel coat, embroidered in gold.
          k.path(`M${c - 9} ${k.T - 1}L${c + 9} ${k.T - 1}L${c + 8} ${k.B - 10}L${c - 8} ${k.B - 10}Z`, yem, k.ink, 0.7) +
            k.line(`M${k.L} ${k.B - 10}H${k.R}`, "#3fa04f", 3) +
            k.line(`M${c - 2} ${k.B - 9}l-4 10M${c + 2} ${k.B - 9}l4 10`, "#3fa04f", 2) +
            k.lume("pulse", k.circle(c, k.T + 12, 3, "#ffd84a", k.ink, 0.4) + k.line(`M${c - 5} ${k.T + 12}H${c + 5}M${c} ${k.T + 7}V${k.T + 17}`, "#ffd84a", 0.7), 0, "#ffd84a")));
      }
      // Nón quai thao: a wide, flat disc hat with a fringe of tassels that shimmer.
      const x = k.hx + k.side * 2,
        y = k.ht + 6;
      const w = k.side ? 46 : 54;
      k.put("flame", `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${k.side ? 8 : 10}" fill="#e8c88a" stroke="${k.ink}" stroke-width="1.1"/>` +
        `<ellipse cx="${x}" cy="${y - 2}" rx="${w * 0.42}" ry="5" fill="#d4b06a" stroke="${k.ink}" stroke-width="0.8"/>` +
        Array.from({ length: 9 }, (_, i) => {
          const u = (i + 0.5) / 9;
          const tx = x - w + u * 2 * w;
          return k.lume("chase", k.line(`M${tx} ${y + 6}v8`, "#ffd84a", 1.2), i, "#ffd84a");
        }).join(""));
    },
    // Kim Quy: áo dài for men with a bronze-drum sun, a khăn đóng, and the
    // returned sword (gươm Thuận Thiên) glowing on the back.
    terradon(k) {
      const brocade = "#1f3a6e",
        gold = "#f2c14e";
      const drum = (c: number, y: number, r: number) => k.circle(c, y, r, "#2b4a86", gold, 0.8) +
        k.lume("pulse", k.path(k.star(c, y, r * 0.75, 12, 0.4), gold, "none"), 0, gold);
      if (k.back) backPanel(k, brocade, drum(k.C, k.T + 18, 8));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, brocade, k.line(`M${c + 2} ${k.T + 2}Q${c + 8} ${k.T + 5} ${c + 12} ${k.T + 11}`, gold, 1) + drum(c - (k.side ? 0 : 3), k.T + 18, 7.5)) +
          k.rect(c - 8, k.T - 4, 16, 6, 2, brocade, k.ink, 0.9));
      }
      // The sword across the back: hilt over the left shoulder (clear of the
      // shell's crystal on the right), its blade lit.
      const s = k.side ? -k.side : -1;
      const hilt = (x: number, y: number) => k.line(`M${x} ${y}L${x + s * 7} ${y - 12}`, "#5a3a22", 3.2) + k.line(`M${x - 5} ${y + 2}L${x + 5} ${y - 2}`, gold, 2.2);
      if (k.back) k.put("scarf", k.lume("pulse", k.line(`M${k.C + 14} ${k.B}L${k.C - 20} ${k.T - 20}`, "#cfe8ff", 2.6), 1, "#cfe8ff") + hilt(k.C - 20, k.T - 20));
      else {
        // Hilt and a hand's width of blade show past the side of the head.
        const hx0 = k.C + s * (k.side ? 30 : 54),
          hy0 = k.T - 28;
        k.put("body", k.lume("pulse", k.line(`M${hx0} ${hy0}L${hx0 - s * 9} ${hy0 + 16}`, "#cfe8ff", 2.6), 1, "#cfe8ff") + hilt(hx0, hy0), true);
      }
      // Khăn đóng: a round wrapped turban, its folds in bands.
      const x = k.hx + k.side * 2,
        y = k.ht + 16;
      const w = k.side ? 42 : 46;
      k.put("flame", k.path(`M${x - w} ${y + 2}Q${x - w - 2} ${k.ht - 10} ${x} ${k.ht - 12}Q${x + w + 2} ${k.ht - 10} ${x + w} ${y + 2}Q${x} ${y - 5} ${x - w} ${y + 2}Z`, "#1b1b24") +
        [0.25, 0.5, 0.75].map((u) => k.line(`M${x - w + 2} ${y - (y - k.ht + 10) * u}Q${x} ${y - (y - k.ht + 10) * u - 5} ${x + w - 2} ${y - (y - k.ht + 10) * u}`, "#3a3a48", 1)).join(""));
    },
    // Hoa đăng: an áo dài with carp-scale embroidery and a nón lá crowned by a lotus lamp.
    tidefin(k) {
      const silk = "#2f7fb8",
        gold = "#f2c14e";
      const scales = (c: number, y: number) => [0, 1, 2].flatMap((r) => [0, 1, 2].map((q) => k.lume("chase", k.path(`M${c - 8 + q * 6 + (r % 2) * 3} ${y + r * 4}q3 -4 6 0`, "none", gold, 0.9), r * 3 + q, gold))).join("");
      if (k.back) k.put("scarf", k.path(`M${k.C - k.W - 1} ${k.T + 1}Q${k.C} ${k.T - 4} ${k.C + k.W + 1} ${k.T + 1}L${k.C + k.W + 1} ${k.B - 2}L${k.C + 6} ${k.B + 16}L${k.C - 6} ${k.B + 16}L${k.C - k.W - 1} ${k.B - 2}Z`, silk) + scales(k.C, k.T + 10));
      else {
        const c = k.C + k.side * 3;
        k.put("body", k.path(`M${c - 8} ${k.B - 6}L${c + 8} ${k.B - 6}L${c + 7} ${k.B + 16}Q${c} ${k.B + 19} ${c - 7} ${k.B + 16}Z`, silk, k.ink, 0.9), true);
        k.put("body", torso(k, silk, k.line(`M${c + 2} ${k.T + 2}Q${c + 8} ${k.T + 5} ${c + 12} ${k.T + 11}`, gold, 0.9) + scales(c - 2, k.T + 12)) + k.rect(c - 8, k.T - 4, 16, 6, 2, silk, k.ink, 0.9));
      }
      // Nón lá with a lotus lamp (hoa đăng) glowing on its tip.
      const w = k.side ? 40 : 48;
      const y = k.ht + 14,
        apex = y - 30,
        x = k.hx + k.side * 2;
      const lotus = (lx: number, ly: number) => [-1, 0, 1].map((s) => k.path(`M${lx} ${ly}Q${lx + s * 9} ${ly - 3} ${lx + s * 5} ${ly - 10}Q${lx + s * 2} ${ly - 5} ${lx} ${ly}Z`, "#ff9ac0", k.ink, 0.6)).join("");
      k.put("flame", k.path(`M${x} ${apex}L${x + w} ${y}Q${x} ${y + 9} ${x - w} ${y}Z`, "#f1d9a0", "#8a6a3a", 1.1) +
        [0.35, 0.6, 0.82].map((u) => k.line(`M${x - w * u} ${apex + (y - apex) * u}Q${x} ${apex + (y - apex) * u + 4 * u} ${x + w * u} ${apex + (y - apex) * u}`, "#b8955a", 0.7)).join("") +
        k.lume("pulse", lotus(x, apex + 2) + k.circle(x, apex - 3, 2, "#ffd84a", "none", 0), 0, "#ffb3cf"));
    },
    // Tết: a red áo dài with gold hoa mai, a khăn vấn under the orange and a mai sprig.
    sunbara(k) {
      const silk = "#c8102e",
        gold = "#f2c14e";
      const mai = (x: number, y: number, r: number, i: number) => k.lume("twinkle",
        Array.from({ length: 5 }, (_, j) => { const a = (j / 5) * Math.PI * 2 - Math.PI / 2; return k.circle(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, "#ffd84a", "#c8902a", 0.3); }).join("") + k.circle(x, y, r * 0.5, "#e86a1a", "none", 0), i, "#ffe08a");
      if (k.back) k.put("scarf", k.path(`M${k.C - k.W - 1} ${k.T + 1}Q${k.C} ${k.T - 4} ${k.C + k.W + 1} ${k.T + 1}L${k.C + k.W + 1} ${k.B - 2}L${k.C + 6} ${k.B + 16}L${k.C - 6} ${k.B + 16}L${k.C - k.W - 1} ${k.B - 2}Z`, silk) + mai(k.C - 6, k.T + 12, 2.2, 0) + mai(k.C + 6, k.T + 22, 2, 1));
      else {
        const c = k.C + k.side * 3;
        k.put("body", k.path(`M${c - 8} ${k.B - 6}L${c + 8} ${k.B - 6}L${c + 7} ${k.B + 16}Q${c} ${k.B + 19} ${c - 7} ${k.B + 16}Z`, silk, k.ink, 0.9) + mai(c, k.B + 8, 2, 3), true);
        k.put("body", torso(k, silk, k.line(`M${c - 12} ${k.B - 4}Q${c - 2} ${k.T + 18} ${c + 10} ${k.T + 8}`, "#7a4a24", 0.9) + mai(c - 8, k.T + 16, 2.2, 0) + mai(c + 4, k.T + 11, 2, 1) + mai(c + 9, k.T + 20, 1.8, 2)) +
          k.rect(c - 8, k.T - 4, 16, 6, 2, silk, k.ink, 0.9) + k.line(`M${c - 7} ${k.T - 2.6}H${c + 7}`, gold, 0.8));
      }
      // Khăn vấn: a wrapped band round the head, below the orange.
      const x = k.hx + k.side * 2,
        y = k.ht + 8;
      const w = k.side ? 42 : 48;
      k.put("flame", k.path(`M${x - w} ${y + 6}Q${x} ${y - 10} ${x + w} ${y + 6}L${x + w - 2} ${y + 13}Q${x} ${y - 2} ${x - w + 2} ${y + 13}Z`, "#8a1f2c") +
        k.line(`M${x - w + 4} ${y + 6}Q${x} ${y - 6} ${x + w - 4} ${y + 6}`, "#b8323a", 1.2) + (k.back ? "" : mai(x + (k.side ? k.side * 24 : 30), y + 4, 2.4, 4)));
    },
  },

  // ================= Stars & Stripes =================
  stars: {
    // Space Ranger: a white flight suit with a glowing mission patch and a
    // headset with a blinking antenna.
    voltkit(k) {
      const suit = "#f2f2f6";
      const patch = (c: number, y: number) => k.circle(c, y, 6.5, "#1f2f5c", "#c8323a", 1.4) + k.lume("pulse", k.path(k.star(c, y, 4, 5), "#ffffff", "none"), 0, "#bfe0ff");
      if (k.back) backPanel(k, suit, k.rect(k.C - 10, k.T + 4, 20, 22, 4, "#d9d9e0") + k.lume("blink", k.circle(k.C, k.T + 10, 1.5, "#5aff7a", "none", 0), 0, "#5aff7a"));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, suit, k.line(`M${c} ${k.T + 2}V${k.B}`, "#c8c8d0", 1.2) +
          [0, 1, 2].map((i) => k.line(`M${c + 4} ${k.T + 6 + i * 2.2}h8`, i % 2 ? "#ffffff" : "#c8323a", 1.4)).join("") + k.rect(c + 4, k.T + 5, 4, 3.6, 0, "#1f2f5c", "none") +
          patch(c - 9, k.T + 16) + k.rect(k.L - 2, k.B - 10, k.R - k.L + 4, 4, 0, "#4a5068")));
      }
      // Headset with an antenna whose light blinks.
      const cy = k.ht + 46;
      const x = k.side ? k.hx - k.side * 18 : k.hx + 52;
      k.put("flame", (k.side ? k.line(`M${x} ${cy - 8}Q${x - k.side * 4} ${k.ht - 8} ${x + k.side * 14} ${k.ht - 4}`, "#d9d9e0", 3.4) : k.line(`M${k.hx - 52} ${cy - 8}Q${k.hx - 50} ${k.ht - 12} ${k.hx} ${k.ht - 12}Q${k.hx + 50} ${k.ht - 12} ${k.hx + 52} ${cy - 8}`, "#d9d9e0", 3.4) + k.circle(k.hx - 52, cy, 8, "#d9d9e0")) +
        k.circle(x, cy, 8, "#d9d9e0") + k.line(`M${x} ${cy - 6}L${x + 4} ${cy - 26}`, "#8a8a96", 1.4) + k.lume("blink", k.circle(x + 4, cy - 27, 2.2, "#ff4f5a", k.ink, 0.5), 0, "#ff4f5a"));
    },
    // Lady Liberty: a spiked crown lit ray by ray, a green toga and a torch on the back.
    mystowl(k) {
      const toga = "#5fae9a",
        fold = "#4a8f7e";
      if (k.back) backPanel(k, toga, k.line(`M${k.C - k.W} ${k.T + 4}L${k.C + k.W} ${k.B - 4}`, fold, 2));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, toga, [0, 1, 2].map((i) => k.line(`M${k.L + i * 6} ${k.T - 2}L${k.R} ${k.B - 12 + i * 6}`, fold, 1.4)).join("") +
          k.lume("pulse", k.rect(c - 5, k.B - 18, 10, 7, 1, "#cfe8d8", k.ink, 0.6), 0, "#ffffff")));
      }
      // The torch, held high (drawn larger than the pole's other loads).
      onPole(k, (x, y) => `<g transform="translate(${x} ${y}) scale(1.4) translate(${-x} ${-y})">` + k.path(`M${x - 5} ${y + 4}H${x + 5}L${x + 3} ${y + 10}H${x - 3}Z`, "#5fae9a") +
        k.lume("pulse", k.path(`M${x} ${y - 10}Q${x + 7} ${y - 2} ${x + 4} ${y + 4}H${x - 4}Q${x - 7} ${y - 2} ${x} ${y - 10}Z`, "#ffb347", k.ink, 0.7) + k.path(`M${x} ${y - 4}Q${x + 3} ${y} ${x + 2} ${y + 3}H${x - 2}Q${x - 3} ${y} ${x} ${y - 4}Z`, "#fff3a8", "none"), 1, "#ffb347") + "</g>");
      // The crown: a band with seven rays, lit one after another.
      const x = k.hx + k.side * 3,
        y = k.ht + 12;
      const w = k.side ? 38 : 44;
      const n = k.side ? 4 : 7;
      const rays = k.back ? [] : Array.from({ length: n }, (_, i) => {
        const u = i / (n - 1);
        const ang = k.side ? -Math.PI / 2 + k.side * (u - 0.1) * 1.4 : -Math.PI / 2 + (u - 0.5) * 2.2;
        const bx = x + Math.cos(ang) * w * 0.55,
          by = y - 2 + Math.sin(ang) * 6;
        return k.lume("chase", k.path(`M${bx - 3} ${by}L${bx + Math.cos(ang) * 16} ${by + Math.sin(ang) * 16}L${bx + 3} ${by}Z`, "#cfe8d8", k.ink, 0.7), i, "#ffffff");
      });
      k.put("flame", rays.join("") + k.path(`M${x - w} ${y + 2}Q${x} ${y - 8} ${x + w} ${y + 2}L${x + w} ${y + 8}Q${x} ${y - 2} ${x - w} ${y + 8}Z`, toga));
    },
    // Sheriff: a wide-brimmed hat, a star badge that glows, a bandana and a fringed vest.
    terradon(k) {
      const vest = "#8a5a2c",
        shirt = "#e8dcc4";
      if (k.back) backPanel(k, vest, [0, 1, 2, 3, 4, 5].map((i) => k.line(`M${k.C - k.W + i * k.W * 0.4} ${k.B}v5`, "#6a4220", 1.2)).join(""));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, shirt, k.path(`M${k.L - 2} ${k.T - 2}H${c - 6}L${c - 4} ${k.B + 4}H${k.L - 2}Z M${k.R + 2} ${k.T - 2}H${c + 6}L${c + 4} ${k.B + 4}H${k.R + 2}Z`, vest, k.ink, 0.8) +
          [0, 1, 2, 3].map((i) => k.line(`M${k.L + 2 + i * 4} ${k.B - 6}v6M${k.R - 2 - i * 4} ${k.B - 6}v6`, "#6a4220", 1)).join("") +
          k.lume("pulse", k.path(k.star(c - (k.side ? 0 : 11), k.T + 14, 5, 6, 0.55), "#ffd84a", k.ink, 0.6), 0, "#ffd84a")));
        // The bandana knotted at the neck.
        k.put("body", k.path(`M${c - 12} ${k.T - 2}Q${c} ${k.T + 6} ${c + 12} ${k.T - 2}L${c} ${k.T + 12}Z`, "#c8323a", k.ink, 0.8) + k.circle(c - 4, k.T + 3, 0.8, "#ffffff", "none", 0) + k.circle(c + 3, k.T + 5, 0.8, "#ffffff", "none", 0));
      }
      const y = k.ht + 16;
      k.put("flame", hatShape(k, 36, 28, y, "#a0703c", "#8a5a2c", 1.7) + k.line(`M${k.hx + k.side * 2 - 22} ${y - 4}Q${k.hx + k.side * 2} ${y - 7} ${k.hx + k.side * 2 + 22} ${y - 4}`, "#3a2a1c", 2.2));
    },
    // Malibu Surfer: neon shades on the head, a wave-print tank and a surfboard
    // on the back with a glowing stripe.
    tidefin(k) {
      const tank = "#ffb347",
        neon = "#ff4fd8";
      if (k.back) backPanel(k, tank);
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, tank, k.line(`M${k.L} ${k.T + 14}q5 -5 10 0t10 0t10 0t10 0t10 0`, "#ffffff", 1.6) + k.line(`M${k.L} ${k.T + 22}q5 -5 10 0t10 0t10 0t10 0t10 0`, "#2f8fb0", 1.6) +
          // A shark-tooth necklace.
          k.line(`M${c - 10} ${k.T}Q${c} ${k.T + 8} ${c + 10} ${k.T}`, "#5a3a22", 0.8) + k.path(`M${c - 2} ${k.T + 4}L${c + 2} ${k.T + 4}L${c} ${k.T + 10}Z`, "#f7f4ee", k.ink, 0.5)));
      }
      // The surfboard behind, its stripe lit, on the side away from the tail.
      const s = k.side ? -k.side : -1;
      const board = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="30" fill="#f7f4ee" stroke="${k.ink}" stroke-width="1.1" transform="rotate(${s * 18} ${x} ${y})"/>` +
        k.lume("pulse", `<line x1="${x}" y1="${y - 26}" x2="${x}" y2="${y + 26}" stroke="${neon}" stroke-width="2.2" transform="rotate(${s * 18} ${x} ${y})"/>`, 0, neon);
      if (k.back) k.put("scarf", board(k.C, k.T + 4));
      else k.put("body", board(k.C + s * (k.side ? 34 : 58), k.T - 10), true);
      // Neon shades up on the head.
      if (!k.back) {
        const y = k.ht + 8;
        const xs = k.side ? [k.hx + k.side * 14] : [k.hx - 15, k.hx + 15];
        k.put("flame", (k.side ? "" : k.line(`M${k.hx - 5} ${y}H${k.hx + 5}`, neon, 1.6)) +
          xs.map((x, i) => k.lume("pulse", `<rect x="${x - 10}" y="${y - 6}" width="20" height="11" rx="5" fill="#2b2f3d" stroke="${neon}" stroke-width="1.8"/>`, i + 1, neon)).join(""));
      }
    },
    // Fourth of July: a mini striped top hat on the orange with a sparkler, star shades and a vest.
    sunbara(k) {
      const vest = "#1f2f5c",
        red = "#c8323a";
      if (k.back) backPanel(k, vest, [0, 1, 2].map((i) => k.path(k.star(k.C - 10 + i * 10, k.T + 14, 2.4, 5), "#ffffff", "none")).join(""));
      else {
        const c = k.C + k.side * 3;
        k.put("body", torso(k, "#f7f1e1", [0, 1, 2, 3, 4].map((i) => k.line(`M${k.L} ${k.T + 4 + i * 7}H${k.R}`, red, 2.4)).join("") +
          k.path(`M${k.L - 2} ${k.T - 2}H${c - 5}L${c - 3} ${k.B + 4}H${k.L - 2}Z M${k.R + 2} ${k.T - 2}H${c + 5}L${c + 3} ${k.B + 4}H${k.R + 2}Z`, vest, k.ink, 0.8) +
          [0, 1, 2].map((i) => k.lume("twinkle", k.path(k.star(k.L + 5, k.T + 6 + i * 9, 2.2, 5), "#ffffff", "none"), i, "#ffffff")).join("")));
      }
      // A small top hat perched by the orange, a sparkler in its band.
      // A striped top hat on the crown (in place of the orange), tipped a
      // little, with a sparkler in its band.
      const x = k.hx + k.side * 3,
        y = k.ht + 8;
      k.put("flame", `<g transform="rotate(${k.side ? k.side * 6 : -8} ${x} ${y})">` +
        k.path(`M${x - 30} ${y}Q${x} ${y + 8} ${x + 30} ${y}Q${x} ${y - 7} ${x - 30} ${y}Z`, vest) +
        k.rect(x - 18, y - 34, 36, 33, 3, "#f7f1e1") + [0, 1, 2].map((i) => k.rect(x - 18, y - 30 + i * 9, 36, 4, 0, red, "none")).join("") +
        k.rect(x - 18, y - 8, 36, 6, 0, vest, "none") + [0, 1, 2].map((i) => k.path(k.star(x - 10 + i * 10, y - 5, 1.8, 5), "#ffffff", "none")).join("") +
        k.line(`M${x + 14} ${y - 8}L${x + 26} ${y - 40}`, "#8a8a96", 1.2) +
        [0, 1, 2, 3].map((i) => k.lume("twinkle", k.path(k.star(x + 26 + [0, 5, -4, 3][i], y - 42 + [0, -4, -3, 4][i], 3, 4), "#fff3a8", "none"), i + 3, "#fff3a8")).join("") + "</g>");
      // Star sunglasses over the closed, smiling eyes.
      if (!k.back) {
        const { pts } = lenses(k);
        k.put("flame", (pts.length > 1 ? k.line(`M${pts[0][0] + 9} ${pts[0][1]}H${pts[1][0] - 9}`, red, 1.6) : "") +
          pts.map(([px, py], i) => k.path(k.star(px, py, 12, 5, 0.55), "#2b2f3d", red, 1.6) + k.lume("twinkle", k.line(`M${px - 5} ${py - 2}L${px - 2} ${py - 6}`, "#ffffff", 1.6), i + 8, "#ffffff")).join(""));
      }
    },
  },
};

/**
 * Which of the champion's own pieces a design takes off: the neck piece
 * always (the costume dresses the neck), and the head-top crest wherever a
 * hat or headpiece sits there. A few designs build on the crest instead:
 * Sunbara's orange becomes a solar core (Hero Squad) and a Tết quất
 * (Hồn Việt), and Cindrake's and Pyranda's flames stay where no design is drawn.
 */
export function modernReplaces(theme: ModernTheme, id: CharacterId): CreaturePart[] {
  const keepCrest = (id === "sunbara" && (theme === "hero" || theme === "viet")) || (id === "cindrake" && (theme === "viet" || theme === "vietlegend" || theme === "hero" || theme === "campus" || theme === "stars" || theme === "idol")) || (!DESIGNS[theme]?.[id] && ["cindrake", "pyranda", "sunbara"].includes(id));
  return keepCrest ? ["scarf"] : ["scarf", "flame"];
}
