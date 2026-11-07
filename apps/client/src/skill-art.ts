/**
 * Illustrated skill icons: a small painted scene per move (dark element-lit
 * backdrop, a lit subject with glow, sparks), instead of a single-colour
 * line glyph. 128 × 128, with the subject kept inside a centred circle so
 * the same art reads in the round in-match buttons and the rounded squares
 * of the roster and kit lists (the frame is the container's CSS).
 *
 * Cheap to draw: no SVG filters (blurs on five buttons that repaint during
 * cooldowns would cost older phones). Glow is layered translucent strokes
 * and radial gradients. Gradients are defined once per page in a hidden
 * <svg> (ensureSkillArtDefs), so icons repeat without duplicate ids.
 */
type Element =
  | "electric"
  | "fire"
  | "water"
  | "aura"
  | "light"
  | "psychic"
  | "earth"
  | "shadow"
  | "nature";
interface Theme {
  /** Backdrop: centre, middle, edge. */
  bg: [string, string, string];
  /** Accent: deep, main, bright. */
  accent: [string, string, string];
  /** The near-white highlight. */
  hot: string;
}
const THEMES: Record<Element, Theme> = {
  electric: {
    bg: ["#4b3d98", "#1b1848", "#06071a"],
    accent: ["#e08a12", "#ffd84a", "#fff3a6"],
    hot: "#fffbe6",
  },
  fire: {
    bg: ["#7c2610", "#371008", "#110404"],
    accent: ["#e2410f", "#ff9a2a", "#ffe08a"],
    hot: "#fffbea",
  },
  water: {
    bg: ["#155a7c", "#082a42", "#020c16"],
    accent: ["#0c7fae", "#3fd0ee", "#bff6ff"],
    hot: "#ffffff",
  },
  aura: {
    bg: ["#3a3f9a", "#161a4c", "#05071a"],
    accent: ["#4b5fe0", "#8fa8ff", "#dfe6ff"],
    hot: "#ffffff",
  },
  light: {
    bg: ["#1d6b5a", "#0b2e2a", "#041311"],
    accent: ["#1fbf8e", "#86f0c0", "#e9fff4"],
    hot: "#fffdf0",
  },
  psychic: {
    bg: ["#7a2a74", "#33113a", "#100515"],
    accent: ["#c4359c", "#ff79d2", "#ffd3f1"],
    hot: "#fff3fb",
  },
  earth: {
    bg: ["#6b4a24", "#2e1f10", "#0f0905"],
    accent: ["#8a5a24", "#d9a85e", "#ffe2a8"],
    hot: "#fff6e0",
  },
  shadow: {
    bg: ["#3e2470", "#180d33", "#060312"],
    accent: ["#6a3fd0", "#a77bff", "#e6d8ff"],
    hot: "#f6f0ff",
  },
  nature: {
    bg: ["#2f6b2a", "#12301a", "#050f07"],
    accent: ["#3f9a3a", "#8fe06a", "#e4ffc8"],
    hot: "#fbfff0",
  },
};
const ELEMENTS = Object.keys(THEMES) as Element[];

/** Shared gradients, once per page. */
export function skillArtDefs() {
  let d = "";
  for (const el of ELEMENTS) {
    const t = THEMES[el];
    d +=
      `<radialGradient id="sa-bg-${el}" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="${t.bg[0]}"/><stop offset=".55" stop-color="${t.bg[1]}"/><stop offset="1" stop-color="${t.bg[2]}"/></radialGradient>` +
      `<radialGradient id="sa-glow-${el}"><stop offset="0" stop-color="${t.accent[1]}" stop-opacity=".75"/><stop offset=".55" stop-color="${t.accent[1]}" stop-opacity=".22"/><stop offset="1" stop-color="${t.accent[1]}" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="sa-core-${el}"><stop offset="0" stop-color="${t.hot}"/><stop offset=".3" stop-color="${t.accent[2]}"/><stop offset=".65" stop-color="${t.accent[1]}" stop-opacity=".7"/><stop offset="1" stop-color="${t.accent[0]}" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="sa-orb-${el}" cx=".4" cy=".36" r=".62"><stop offset="0" stop-color="${t.hot}"/><stop offset=".3" stop-color="${t.accent[2]}"/><stop offset=".7" stop-color="${t.accent[1]}"/><stop offset="1" stop-color="${t.accent[0]}"/></radialGradient>` +
      `<linearGradient id="sa-up-${el}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${t.accent[0]}"/><stop offset=".6" stop-color="${t.accent[1]}"/><stop offset="1" stop-color="${t.accent[2]}"/></linearGradient>` +
      `<linearGradient id="sa-diag-${el}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${t.accent[0]}" stop-opacity="0"/><stop offset=".55" stop-color="${t.accent[1]}"/><stop offset="1" stop-color="${t.hot}"/></linearGradient>`;
  }
  d +=
    `<radialGradient id="sa-vig" cx=".5" cy=".46" r=".72"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>` +
    `<linearGradient id="sa-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  return `<svg class="skill-art-defs" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><defs>${d}</defs></svg>`;
}
/** Put the shared gradients on the page (once). */
export function ensureSkillArtDefs() {
  if (
    typeof document === "undefined" ||
    document.querySelector(".skill-art-defs")
  )
    return;
  const host = document.createElement("div");
  host.innerHTML = skillArtDefs();
  document.body.prepend(host.firstElementChild!);
}

// ── Drawing helpers ──────────────────────────────────────────────────────
const n = (v: number) => Math.round(v * 10) / 10;
/** A stroke with a soft halo (wide translucent copies underneath). */
function glow(
  d: string,
  color: string,
  width: number,
  halo = color,
  fill = "none",
) {
  return (
    `<path d="${d}" fill="none" stroke="${halo}" stroke-width="${n(width * 4)}" stroke-opacity=".12" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${halo}" stroke-width="${n(width * 2.2)}" stroke-opacity=".28" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="${fill}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}
/** A jagged lightning path through the given points (deterministic jitter). */
function bolt(points: [number, number][], jag = 5, seed = 1) {
  let s = seed;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280 - 0.5;
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1],
      [x1, y1] = points[i];
    const steps = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 9));
    for (let k = 1; k <= steps; k++) {
      const u = k / steps,
        last = k === steps;
      const nx = -(y1 - y0),
        ny = x1 - x0,
        len = Math.hypot(nx, ny) || 1,
        j = last ? 0 : rand() * jag * 2;
      d += ` L${n(x0 + (x1 - x0) * u + (nx / len) * j)} ${n(y0 + (y1 - y0) * u + (ny / len) * j)}`;
    }
  }
  return d;
}
const sparks = (pts: [number, number, number][], color: string) =>
  pts
    .map(
      ([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`,
    )
    .join("");
/** Four-point star glint. */
const glint = (x: number, y: number, r: number, color: string) =>
  `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z" fill="${color}"/>`;
const halo = (el: Element, x: number, y: number, r: number, o = 1) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#sa-glow-${el})" opacity="${o}"/>`;
const floorGlow = (
  el: Element,
  x: number,
  y: number,
  rx: number,
  ry: number,
  o = 1,
) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#sa-glow-${el})" opacity="${o}"/>`;
const backdrop = (el: Element) =>
  `<rect width="128" height="128" fill="url(#sa-bg-${el})"/>`;

// ── The eighty moves ─────────────────────────────────────────────────────
const E = THEMES.electric,
  F = THEMES.fire,
  W = THEMES.water,
  A = THEMES.aura,
  L = THEMES.light,
  P = THEMES.psychic,
  R = THEMES.earth,
  S = THEMES.shadow,
  N = THEMES.nature;

// ── Props for the Nature champions ───────────────────────────────────────
/** A pointed leaf (or leaf scale) centred on (x, y), with its midrib. */
const leaf = (
  x: number,
  y: number,
  s: number,
  rot: number,
  fill: string,
  rib = "#1f4626",
) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 -10 Q8 -1 0 10 Q-8 -1 0 -10Z" fill="${fill}" stroke="${rib}" stroke-width="${n(1.3 / s)}"/><path d="M0 -7 V7.5" stroke="${rib}" stroke-width="${n(1 / s)}" opacity=".5"/></g>`;
/** A curved thorn pointing along `rot` degrees. */
const thorn = (
  x: number,
  y: number,
  s: number,
  rot: number,
  fill = "#c7e88a",
) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M-9 -3 Q0 -2 10 0 Q0 2 -9 3 Q-11 0 -9 -3Z" fill="${fill}" stroke="#1f4626" stroke-width="${n(1.2 / s)}"/></g>`;
/** A winding root through the points (thick, bark-brown with a lit edge). */
const root = (pts: [number, number][], w: number) => {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i],
      [nx, ny] = pts[i + 1];
    d += ` Q${x} ${y} ${n((x + nx) / 2)} ${n((y + ny) / 2)}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  d += ` T${lx} ${ly}`;
  return (
    `<path d="${d}" fill="none" stroke="#2a1a0e" stroke-width="${w + 3}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="#7a5230" stroke-width="${w}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${N.accent[1]}" stroke-width="${n(w * 0.25)}" stroke-linecap="round" opacity=".55"/>`
  );
};
/** A seed (Mossloth's ammunition). */
const seed = (x: number, y: number, s: number, rot = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M-8 0 Q-6 -7 2 -6 Q9 -4 9 0 Q9 4 2 6 Q-6 7 -8 0Z" fill="#a8743e" stroke="#3d2a14" stroke-width="1.4"/><path d="M-4 -2 Q1 -4 5 -2" stroke="#ffe2a8" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".7"/></g>`;

// ── Props for the second eight champions ─────────────────────────────────
/** A faceted rock (or coal) around (x, y). */
const rock = (
  x: number,
  y: number,
  r: number,
  fill: string,
  stroke: string,
  sw = 1.4,
) =>
  `<path d="M${n(x - r)} ${y} L${n(x - r * 0.4)} ${n(y - r)} L${n(x + r * 0.7)} ${n(y - r * 0.8)} L${n(x + r)} ${n(y + r * 0.2)} L${n(x + r * 0.3)} ${n(y + r)} L${n(x - r * 0.7)} ${n(y + r * 0.7)}Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
/** A six-armed snowflake. */
function flake(x: number, y: number, r: number, color: string, w = 1.6) {
  let d = "";
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 - Math.PI / 2,
      bx = x + Math.cos(a) * r * 0.55,
      by = y + Math.sin(a) * r * 0.55;
    d += `M${x} ${y} L${n(x + Math.cos(a) * r)} ${n(y + Math.sin(a) * r)}`;
    for (const s of [-0.8, 0.8])
      d += ` M${n(bx)} ${n(by)} L${n(bx + Math.cos(a + s) * r * 0.32)} ${n(by + Math.sin(a + s) * r * 0.32)}`;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
}
/** A five-point stun star. */
function star(x: number, y: number, r: number, color: string) {
  let d = "";
  for (let k = 0; k < 10; k++) {
    const a = (k * Math.PI) / 5 - Math.PI / 2,
      rr = k % 2 ? r * 0.45 : r;
    d += `${k ? "L" : "M"}${n(x + Math.cos(a) * rr)} ${n(y + Math.sin(a) * rr)}`;
  }
  return `<path d="${d}Z" fill="${color}"/>`;
}
/** A healing plus. */
const plus = (x: number, y: number, s: number, color: string, o = 1) =>
  `<path d="M${n(x - s * 0.34)} ${n(y - s)} h${n(s * 0.68)} v${n(s * 0.66)} h${n(s * 0.66)} v${n(s * 0.68)} h${n(-s * 0.66)} v${n(s * 0.66)} h${n(-s * 0.68)} v${n(-s * 0.66)} h${n(-s * 0.66)} v${n(-s * 0.68)} h${n(s * 0.66)}Z" fill="${color}" opacity="${o}"/>`;
/** A chevron pointing along angle `deg` (0 = right). */
const chevron = (
  x: number,
  y: number,
  s: number,
  deg: number,
  color: string,
  w = 3,
  o = 1,
) =>
  `<path d="M${-s} ${-s} L0 0 L${-s} ${s}" transform="translate(${x} ${y}) rotate(${deg})" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${o}"/>`;
/** Coilemur's horseshoe magnet: opens toward +x before `rot`. */
const magnet = (x: number, y: number, s: number, rot: number) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">` +
  `<path d="M15 -12 H0 A12 12 0 0 0 0 12 H15" fill="none" stroke="#e2463a" stroke-width="16" stroke-opacity=".25"/>` +
  `<path d="M15 -12 H0 A12 12 0 0 0 0 12 H15" fill="none" stroke="#8e1d16" stroke-width="10"/>` +
  `<path d="M15 -12 H0 A12 12 0 0 0 0 12 H15" fill="none" stroke="#ef4c3c" stroke-width="7"/>` +
  `<path d="M3 -14.5 H0 A14.5 14.5 0 0 0 -11 -9.5" fill="none" stroke="#ffb0a2" stroke-width="1.6" stroke-linecap="round"/>` +
  `<path d="M9 -12 H16 M9 12 H16" stroke="#d8dcef" stroke-width="10"/>` +
  `<path d="M9 -15 H16 M9 9 H16" stroke="#fff" stroke-width="2"/></g>`;
/** Pyranda's burning chestnut: point leads (−y before `rot`), flames trail. */
const chestnut = (x: number, y: number, s: number, rot = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">` +
  `<path d="M-12 4 Q-14 22 -4 40 Q-2 30 2 34 Q2 24 8 30 Q14 18 12 4Z" fill="url(#sa-up-fire)"/>` +
  `<path d="M-6 8 Q-6 20 0 28 Q4 20 6 8Z" fill="${F.accent[2]}"/>` +
  `<path d="M0 -13 Q5 -10 10 -6 Q15 0 12 7 Q8 13 0 13 Q-8 13 -12 7 Q-15 0 -10 -6 Q-5 -10 0 -13Z" fill="#7a3416" stroke="${F.accent[1]}" stroke-width="1.6"/>` +
  `<path d="M-13 5 Q0 10 13 5 Q9 13 0 13 Q-9 13 -13 5Z" fill="#ecc690"/>` +
  `<path d="M-1.5 -13 L0 -17 L1.5 -13Z" fill="#ecc690"/>` +
  `<path d="M-7 -4 Q-6 -9 -1 -10" fill="none" stroke="#d9804a" stroke-width="2.4" stroke-linecap="round"/></g>`;
/** Sunbara's yuzu, with its leaf. */
const yuzu = (x: number, y: number, r: number) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffc83a"/>` +
  `<path d="M${n(x - r)} ${y} A${r} ${r} 0 0 0 ${n(x + r)} ${y} A${r} ${n(r * 0.7)} 0 0 1 ${n(x - r)} ${y}Z" fill="#e88a14" opacity=".75"/>` +
  `<g fill="#d98a10" opacity=".55"><circle cx="${n(x + r * 0.3)}" cy="${n(y + r * 0.1)}" r="${n(r * 0.07)}"/><circle cx="${n(x - r * 0.1)}" cy="${n(y + r * 0.35)}" r="${n(r * 0.07)}"/><circle cx="${n(x + r * 0.5)}" cy="${n(y - r * 0.25)}" r="${n(r * 0.07)}"/></g>` +
  `<ellipse cx="${n(x - r * 0.38)}" cy="${n(y - r * 0.4)}" rx="${n(r * 0.28)}" ry="${n(r * 0.17)}" fill="#fff8d0" transform="rotate(-35 ${n(x - r * 0.38)} ${n(y - r * 0.4)})"/>` +
  `<path d="M${x} ${n(y - r * 0.9)} q${n(r * 0.1)} ${n(-r * 0.3)} ${n(r * 0.3)} ${n(-r * 0.4)}" fill="none" stroke="#6b4a24" stroke-width="${n(r * 0.12)}" stroke-linecap="round"/>` +
  `<path d="M${n(x + r * 0.2)} ${n(y - r * 1.15)} q${n(r * 0.5)} ${n(-r * 0.5)} ${n(r * 1)} ${n(-r * 0.2)} q${n(-r * 0.4)} ${n(r * 0.55)} ${n(-r * 1)} ${n(r * 0.2)}Z" fill="#6fc36a" stroke="#3f8e44" stroke-width="1"/>`;
/** Halcyra's quill: tip toward −y before `rot`. */
const quill = (x: number, y: number, s: number, rot: number) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">` +
  `<path d="M0 -26 Q10 -12 8 8 Q5 18 0 22 Q-5 18 -8 8 Q-10 -12 0 -26Z" fill="url(#sa-orb-aura)"/>` +
  `<path d="M0 -26 Q5 -20 6 -14 L0 -10 L-6 -14 Q-5 -20 0 -26Z" fill="#ff9a4a"/>` +
  `<path d="M0 -22 V34" stroke="#fff" stroke-width="2" stroke-linecap="round"/>` +
  `<path d="M0 -4 L-7 -9 M0 4 L-7 -1 M0 12 L-6 7 M0 -4 L7 -9 M0 4 L7 -1 M0 12 L6 7" stroke="${A.accent[0]}" stroke-width="1.2" opacity=".8"/></g>`;
/** Halcyra the kingfisher, facing +x: solid, or a dashed mirage. */
function kingfisher(x: number, y: number, s: number, ghost = false) {
  const body =
    "M-16 6 Q-14 -8 0 -10 Q4 -18 12 -16 Q18 -14 18 -8 L36 -6 L17 -1 Q16 10 2 13 L-10 14 L-26 24 L-18 10Z";
  return (
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    (ghost
      ? `<path d="${body}" fill="${A.accent[2]}" opacity=".4"/><path d="${body}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="3 3"/>`
      : `<path d="${body}" fill="${A.accent[1]}" stroke="${A.accent[2]}" stroke-width="1.4"/>` +
        `<path d="M-6 0 Q2 12 15 0 Q16 10 2 13 L-8 13Z" fill="#ff9a4a"/>` +
        `<path d="M-14 4 Q-6 -6 6 -4" fill="none" stroke="${A.accent[0]}" stroke-width="2.4" stroke-linecap="round"/>` +
        `<circle cx="10" cy="-10" r="2.4" fill="${A.bg[2]}"/><circle cx="10.8" cy="-10.8" r=".8" fill="#fff"/>`) +
    `</g>`
  );
}
/** Astrabun's mochi mallet: head at the origin, handle toward +y before `rot`. */
const mallet = (x: number, y: number, s: number, rot: number) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">` +
  `<path d="M0 10 V46" stroke="#5e3a1c" stroke-width="7" stroke-linecap="round"/><path d="M0 10 V46" stroke="#b98250" stroke-width="4" stroke-linecap="round"/>` +
  `<rect x="-20" y="-11" width="40" height="22" rx="5" fill="#d9a46a" stroke="#6b4222" stroke-width="1.6"/>` +
  `<rect x="-22" y="-13" width="7" height="26" rx="3" fill="#a8703e" stroke="#6b4222" stroke-width="1.4"/><rect x="15" y="-13" width="7" height="26" rx="3" fill="#a8703e" stroke="#6b4222" stroke-width="1.4"/>` +
  `<path d="M-13 -6 H13" stroke="#fff1d8" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></g>`;
/** A crescent moon opening to the right. */
const crescent = (x: number, y: number, r: number, fill: string) =>
  `<path d="M${x} ${n(y - r)} A${r} ${r} 0 1 0 ${x} ${n(y + r)} A${n(r * 1.25)} ${n(r * 1.25)} 0 0 1 ${x} ${n(y - r)}Z" fill="${fill}"/>`;
/** A moon rabbit silhouette sitting at (x, y), facing right. */
const bunny = (x: number, y: number, s: number, fill: string, o = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})" fill="${fill}" opacity="${o}"><ellipse cx="0" cy="4" rx="9" ry="7"/><circle cx="7" cy="-3" r="5"/><ellipse cx="4" cy="-13" rx="2.2" ry="7" transform="rotate(-14 4 -13)"/><ellipse cx="9" cy="-12" rx="2.2" ry="7" transform="rotate(12 9 -12)"/><circle cx="-9" cy="3" r="2.4"/></g>`;
/** A tapered tentacle along a cubic Bézier, suckers on one side. */
function tentacle(
  p: [number, number][],
  w0: number,
  w1: number,
  fill: string,
  rim: string,
  sucker = "",
) {
  const N = 20,
    left: string[] = [],
    right: string[] = [],
    cups: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N,
      u = 1 - t;
    const at = (k: 0 | 1) =>
      u * u * u * p[0][k] +
      3 * u * u * t * p[1][k] +
      3 * u * t * t * p[2][k] +
      t * t * t * p[3][k];
    const slope = (k: 0 | 1) =>
      3 * u * u * (p[1][k] - p[0][k]) +
      6 * u * t * (p[2][k] - p[1][k]) +
      3 * t * t * (p[3][k] - p[2][k]);
    const x = at(0),
      y = at(1),
      dx = slope(0),
      dy = slope(1),
      len = Math.hypot(dx, dy) || 1,
      nx = -dy / len,
      ny = dx / len,
      w = (w0 + (w1 - w0) * t) / 2;
    left.push(`${n(x + nx * w)} ${n(y + ny * w)}`);
    right.push(`${n(x - nx * w)} ${n(y - ny * w)}`);
    if (sucker && i > 1 && i < N - 2 && i % 2 === 0)
      cups.push(
        `<circle cx="${n(x - nx * w * 0.42)}" cy="${n(y - ny * w * 0.42)}" r="${n(Math.max(0.9, w * 0.4))}" fill="${sucker}"/>`,
      );
  }
  const d = `M${left.join(" L")} L${right.reverse().join(" L")}Z`;
  return (
    `<path d="${d}" fill="none" stroke="${rim}" stroke-width="6" stroke-opacity=".22" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="${fill}" stroke="${rim}" stroke-width="1.6" stroke-linejoin="round"/>` +
    cups.join("")
  );
}
/** Shadopus's ink: near-black violet, lit by a magenta rim. */
const INK = "#1a1036",
  INK_RIM = "#ff6bd6";
const art: Record<string, { el: Element; draw: () => string }> = {
  // Voltkit · Electric
  "Spark Dart": {
    el: "electric",
    draw: () =>
      `<path d="M18 104 L80 46" stroke="url(#sa-diag-electric)" stroke-width="10" stroke-linecap="round" opacity=".35"/>` +
      [
        [22, 88, 70, 40, 1],
        [34, 104, 86, 56, 2],
        [14, 74, 52, 38, 3],
      ]
        .map(
          ([x0, y0, x1, y1, s], i) =>
            `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="url(#sa-diag-electric)" stroke-width="${i === 1 ? 4 : 2.6}" stroke-linecap="round"/>` +
            glow(
              bolt(
                [
                  [x1 - 8, y1 + 8],
                  [x1 + 8, y1 - 8],
                ],
                3,
                s,
              ),
              E.hot,
              i === 1 ? 2.4 : 1.8,
              E.accent[1],
            ),
        )
        .join("") +
      halo("electric", 88, 42, 30) +
      `<circle cx="88" cy="42" r="10" fill="url(#sa-orb-electric)"/>` +
      glow(
        bolt(
          [
            [84, 30],
            [92, 42],
            [86, 54],
          ],
          3,
          7,
        ),
        E.hot,
        2.2,
        E.accent[1],
      ) +
      sparks(
        [
          [104, 30, 1.6],
          [102, 60, 1.4],
          [62, 22, 1.2],
          [26, 54, 1.1],
        ],
        E.accent[2],
      ),
  },
  "Static Lance": {
    el: "electric",
    draw: () =>
      `<path d="M14 98 L96 40 L102 48 L22 106Z" fill="url(#sa-diag-electric)" opacity=".9"/>` +
      glow(
        bolt(
          [
            [18, 101],
            [98, 44],
          ],
          4,
          3,
        ),
        E.hot,
        2.4,
        E.accent[1],
      ) +
      halo("electric", 100, 40, 30) +
      `<path d="M118 26 L92 36 L98 42 L104 52Z" fill="${E.hot}"/><path d="M118 26 L98 42" stroke="${E.accent[1]}" stroke-width="2"/>` +
      // Paralysis: a crackling ring and locked chain links at the tip.
      `<ellipse cx="102" cy="42" rx="18" ry="16" fill="none" stroke="${E.accent[2]}" stroke-width="2" stroke-dasharray="4 4" opacity=".8"/>` +
      glow(
        bolt(
          [
            [86, 30],
            [80, 18],
            [90, 14],
          ],
          3,
          11,
        ),
        E.accent[2],
        1.6,
        E.accent[1],
      ) +
      glow(
        bolt(
          [
            [112, 56],
            [118, 68],
            [108, 74],
          ],
          3,
          13,
        ),
        E.accent[2],
        1.6,
        E.accent[1],
      ) +
      sparks(
        [
          [40, 30, 1.4],
          [24, 60, 1.2],
          [70, 108, 1.5],
        ],
        E.accent[2],
      ),
  },
  "Ball Lightning": {
    el: "electric",
    draw: () =>
      `<g opacity=".35"><circle cx="34" cy="86" r="9" fill="${E.accent[1]}"/><circle cx="22" cy="96" r="6" fill="${E.accent[1]}"/></g>` +
      halo("electric", 68, 60, 50) +
      `<circle cx="68" cy="60" r="28" fill="url(#sa-orb-electric)"/>` +
      `<circle cx="68" cy="60" r="28" fill="none" stroke="${E.hot}" stroke-opacity=".5" stroke-width="1.5"/>` +
      glow(
        bolt(
          [
            [58, 42],
            [70, 58],
            [62, 66],
            [76, 80],
          ],
          2.5,
          5,
        ),
        "#fff",
        2,
        E.accent[2],
      ) +
      [
        [
          [92, 48],
          [104, 40],
          [112, 30],
        ],
        [
          [92, 74],
          [104, 84],
          [110, 96],
        ],
        [
          [44, 74],
          [32, 84],
          [28, 98],
        ],
        [
          [46, 44],
          [34, 34],
          [32, 22],
        ],
      ]
        .map((pts, i) =>
          glow(
            bolt(pts as [number, number][], 3, i + 2),
            E.accent[2],
            2,
            E.accent[1],
          ),
        )
        .join("") +
      `<ellipse cx="58" cy="47" rx="8" ry="5" fill="#fff" opacity=".55" transform="rotate(-30 58 47)"/>` +
      sparks(
        [
          [112, 62, 1.6],
          [18, 56, 1.4],
          [88, 112, 1.5],
        ],
        E.accent[2],
      ),
  },
  "Practice Grid": {
    el: "electric",
    draw: () =>
      `<path d="M8 40 Q22 22 42 30 Q56 14 76 24 Q96 12 120 32 Q110 44 90 40 Q70 48 54 40 Q30 50 8 40Z" fill="#2e2876"/>` +
      `<path d="M14 36 Q30 26 44 32 Q60 20 76 28 Q96 20 114 32" fill="none" stroke="#4d43a8" stroke-width="2"/>` +
      floorGlow("electric", 64, 90, 56, 24) +
      `<ellipse cx="64" cy="90" rx="46" ry="18" fill="#1a1440"/>` +
      `<g stroke="${E.accent[1]}" stroke-width="1.5" opacity=".85">` +
      [74, 82, 90, 98, 106]
        .map((y) => {
          const w = 46 * Math.sqrt(Math.max(0, 1 - ((y - 90) / 18) ** 2));
          return `<path d="M${n(64 - w)} ${y} H${n(64 + w)}"/>`;
        })
        .join("") +
      [-36, -18, 0, 18, 36]
        .map((x) => {
          const h = 18 * Math.sqrt(1 - (x / 46) ** 2);
          return `<path d="M${64 + x} ${n(90 - h)} V${n(90 + h)}"/>`;
        })
        .join("") +
      `</g>` +
      glow(
        `M18 90 A46 18 0 0 0 110 90 A46 18 0 0 0 18 90`,
        E.accent[2],
        2.4,
        E.accent[1],
      ) +
      glow(
        bolt(
          [
            [40, 40],
            [36, 58],
            [44, 82],
          ],
          4,
          3,
        ),
        E.hot,
        2.2,
        E.accent[1],
      ) +
      glow(
        bolt(
          [
            [88, 38],
            [94, 60],
            [84, 86],
          ],
          4,
          9,
        ),
        E.hot,
        2.2,
        E.accent[1],
      ) +
      glow(
        bolt(
          [
            [64, 92],
            [60, 76],
            [66, 66],
          ],
          3,
          4,
        ),
        E.accent[2],
        1.8,
        E.accent[1],
      ) +
      sparks(
        [
          [30, 82, 1.5],
          [100, 98, 1.6],
          [64, 68, 1.3],
        ],
        E.accent[2],
      ),
  },
  "Static Glide": {
    el: "electric",
    draw: () =>
      // A sugar glider sailing on spread membranes over its takeoff pop.
      floorGlow("electric", 64, 100, 50, 14) +
      `<ellipse cx="64" cy="100" rx="44" ry="11" fill="none" stroke="${E.accent[2]}" stroke-width="2.2" opacity=".85"/>` +
      `<ellipse cx="64" cy="100" rx="30" ry="7" fill="none" stroke="${E.accent[1]}" stroke-width="1.4" opacity=".6"/>` +
      halo("electric", 64, 50, 40) +
      `<path d="M22 46 Q40 30 58 38 L64 34 L70 38 Q88 30 106 46 Q92 52 82 64 L70 58 L64 62 L58 58 L46 64 Q36 52 22 46Z" fill="url(#sa-orb-electric)"/>` +
      `<path d="M22 46 Q40 30 58 38 M106 46 Q88 30 70 38" fill="none" stroke="${E.hot}" stroke-width="1.6" opacity=".8"/>` +
      `<ellipse cx="64" cy="44" rx="9" ry="12" fill="${E.accent[1]}"/>` +
      `<circle cx="64" cy="34" r="7" fill="${E.accent[2]}"/><circle cx="61.5" cy="33" r="1.6" fill="${E.bg[2]}"/><circle cx="66.5" cy="33" r="1.6" fill="${E.bg[2]}"/>` +
      `<path d="M64 56 Q66 70 60 80" fill="none" stroke="${E.accent[1]}" stroke-width="4" stroke-linecap="round"/>` +
      glow(
        bolt(
          [
            [30, 74],
            [26, 86],
          ],
          3,
          7,
        ),
        E.hot,
        1.6,
        E.accent[1],
      ) +
      glow(
        bolt(
          [
            [98, 74],
            [102, 86],
          ],
          3,
          9,
        ),
        E.hot,
        1.6,
        E.accent[1],
      ) +
      sparks(
        [
          [16, 30, 1.4],
          [112, 28, 1.4],
          [44, 18, 1.2],
          [86, 16, 1.2],
        ],
        E.accent[2],
      ),
  },
  Overcharge: {
    el: "electric",
    draw: () =>
      floorGlow("electric", 64, 98, 54, 16) +
      `<ellipse cx="64" cy="98" rx="44" ry="12" fill="none" stroke="${E.accent[2]}" stroke-width="2" opacity=".8"/>` +
      `<ellipse cx="64" cy="98" rx="30" ry="8" fill="none" stroke="${E.accent[1]}" stroke-width="1.6" opacity=".6"/>` +
      `<g fill="${E.accent[1]}" opacity=".75">` +
      [0, 1, 2, 3, 4, 5, 6, 7]
        .map((k) => {
          const a = (k / 8) * Math.PI * 2 - Math.PI / 2,
            a1 = a - 0.09,
            a2 = a + 0.09;
          return `<path d="M64 62 L${n(64 + Math.cos(a1) * 54)} ${n(62 + Math.sin(a1) * 54)} L${n(64 + Math.cos(a2) * 54)} ${n(62 + Math.sin(a2) * 54)}Z"/>`;
        })
        .join("") +
      `</g>` +
      halo("electric", 64, 62, 46) +
      `<circle cx="64" cy="62" r="22" fill="url(#sa-core-electric)"/>` +
      [0, 1, 2, 3, 4]
        .map((k) => {
          const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
          return glow(
            bolt(
              [
                [64 + Math.cos(a) * 14, 62 + Math.sin(a) * 14],
                [64 + Math.cos(a) * 46, 62 + Math.sin(a) * 46],
              ],
              4,
              k + 3,
            ),
            E.hot,
            2.2,
            E.accent[1],
          );
        })
        .join("") +
      `<circle cx="64" cy="62" r="8" fill="#fff"/>` +
      sparks(
        [
          [24, 30, 1.5],
          [104, 24, 1.4],
          [112, 70, 1.6],
          [16, 72, 1.4],
        ],
        E.accent[2],
      ),
  },

  // Cindrake · Fire
  "Cinder Snap": {
    el: "fire",
    draw: () =>
      halo("fire", 70, 60, 44) +
      // A crescent bite of flame snapping forward.
      `<path d="M30 92 Q32 44 76 30 Q104 24 112 46 Q96 36 78 44 Q52 56 50 92Z" fill="url(#sa-up-fire)"/>` +
      `<path d="M38 88 Q42 54 76 40 Q94 34 104 42 Q86 42 74 50 Q56 62 56 88Z" fill="${F.accent[2]}" opacity=".85"/>` +
      `<path d="M60 84 Q62 64 80 54" stroke="${F.hot}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
      [
        [98, 58],
        [106, 70],
        [94, 76],
      ]
        .map(
          ([x, y], i) =>
            `<path d="M${x} ${y} q6 -8 2 -14 q8 6 4 16 q-3 4 -6 -2Z" fill="${i ? F.accent[1] : F.accent[2]}"/>`,
        )
        .join("") +
      sparks(
        [
          [24, 40, 1.6],
          [92, 22, 1.3],
          [110, 92, 1.4],
          [44, 106, 1.2],
        ],
        F.accent[2],
      ),
  },
  "Crest Flare": {
    el: "fire",
    draw: () =>
      // A widening cone of flame from the lower left.
      `<path d="M16 100 L104 18 Q120 50 112 84Z" fill="url(#sa-glow-fire)" opacity=".9"/>` +
      `<path d="M18 98 Q60 60 100 30 Q104 52 98 70 Q70 74 18 98Z" fill="url(#sa-diag-fire)"/>` +
      `<path d="M20 96 Q60 66 104 58 Q100 76 92 88 Q60 86 20 96Z" fill="${F.accent[1]}" opacity=".75"/>` +
      `<path d="M22 96 Q58 72 92 64" stroke="${F.hot}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9"/>` +
      `<circle cx="20" cy="98" r="9" fill="url(#sa-core-fire)"/>` +
      sparks(
        [
          [96, 26, 1.8],
          [110, 46, 1.5],
          [102, 96, 1.4],
          [76, 22, 1.3],
          [118, 70, 1.2],
        ],
        F.accent[2],
      ) +
      `<g fill="none" stroke="${F.accent[2]}" stroke-width="1.6" stroke-linecap="round" opacity=".7"><path d="M60 40 q6 -6 12 -4"/><path d="M84 92 q8 2 12 -4"/></g>`,
  },
  "Magma Bomb": {
    el: "fire",
    draw: () =>
      `<path d="M14 104 Q30 70 52 62" stroke="url(#sa-diag-fire)" stroke-width="10" stroke-linecap="round" fill="none" opacity=".55"/>` +
      halo("fire", 70, 56, 46) +
      `<circle cx="70" cy="56" r="26" fill="#3a1408"/>` +
      // Cracked magma rock, glowing seams.
      `<circle cx="70" cy="56" r="26" fill="url(#sa-orb-fire)" opacity=".55"/>` +
      glow(
        `M56 44 L66 54 L60 62 L72 70 M76 38 L72 52 L84 58 M84 66 L78 74`,
        F.accent[2],
        2.4,
        F.accent[1],
      ) +
      `<path d="M70 30 q-4 -12 4 -20 q2 10 10 12 q-6 4 -14 8Z" fill="url(#sa-up-fire)"/>` +
      `<path d="M88 36 q4 -10 12 -12 q-2 8 2 14Z" fill="${F.accent[1]}"/>` +
      `<ellipse cx="62" cy="46" rx="7" ry="4" fill="#fff" opacity=".35" transform="rotate(-30 62 46)"/>` +
      sparks(
        [
          [104, 70, 1.8],
          [100, 88, 1.4],
          [30, 40, 1.3],
          [96, 18, 1.2],
        ],
        F.accent[2],
      ),
  },
  "Heat Cracks": {
    el: "fire",
    draw: () =>
      floorGlow("fire", 64, 96, 54, 16) +
      // A spiral tornado of flame.
      [0, 1, 2, 3]
        .map((k) => {
          const y = 92 - k * 18,
            rx = 40 - k * 6,
            ry = 10 - k;
          return `<path d="M${64 - rx} ${y} A${rx} ${ry} 0 0 0 ${64 + rx} ${y}" fill="none" stroke="${k % 2 ? F.accent[1] : F.accent[2]}" stroke-width="${5 - k * 0.6}" stroke-linecap="round" opacity="${0.95 - k * 0.12}"/><path d="M${64 + rx} ${y} A${rx} ${ry} 0 0 0 ${64 - rx} ${y}" fill="none" stroke="${F.accent[0]}" stroke-width="${3 - k * 0.4}" stroke-linecap="round" opacity=".5"/>`;
        })
        .join("") +
      `<path d="M64 98 Q50 70 62 46 Q66 36 64 22 Q80 40 72 62 Q68 80 64 98Z" fill="url(#sa-up-fire)" opacity=".9"/>` +
      `<path d="M64 92 Q58 72 64 56 Q70 72 64 92Z" fill="${F.hot}" opacity=".8"/>` +
      [
        [24, 70],
        [104, 64],
        [30, 44],
        [98, 40],
      ]
        .map(
          ([x, y], i) =>
            `<path d="M${x} ${y} q5 -7 1 -12 q7 5 3 13 q-2 3 -4 -1Z" fill="${i % 2 ? F.accent[1] : F.accent[2]}"/>`,
        )
        .join("") +
      sparks(
        [
          [20, 90, 1.5],
          [110, 86, 1.4],
          [64, 14, 1.3],
        ],
        F.accent[2],
      ),
  },
  "Sunfire Pillar": {
    el: "fire",
    draw: () =>
      floorGlow("fire", 64, 104, 50, 14) +
      `<ellipse cx="64" cy="104" rx="34" ry="9" fill="none" stroke="${F.accent[2]}" stroke-width="2" opacity=".85"/>` +
      `<rect x="40" y="0" width="48" height="104" fill="url(#sa-glow-fire)" opacity=".8"/>` +
      `<path d="M46 104 Q42 60 52 30 Q58 12 64 0 Q70 12 76 30 Q86 60 82 104Z" fill="url(#sa-up-fire)"/>` +
      `<path d="M54 104 Q52 66 60 36 Q64 22 64 8 Q68 24 70 40 Q76 70 74 104Z" fill="${F.accent[2]}"/>` +
      `<path d="M60 104 Q60 70 64 44 Q68 70 68 104Z" fill="${F.hot}"/>` +
      // A sun disc at the crown.
      `<circle cx="64" cy="22" r="12" fill="url(#sa-core-fire)"/>` +
      [0, 1, 2, 3, 4, 5]
        .map((k) => {
          const a = (k / 6) * Math.PI * 2;
          return `<path d="M${n(64 + Math.cos(a) * 16)} ${n(22 + Math.sin(a) * 16)} L${n(64 + Math.cos(a) * 24)} ${n(22 + Math.sin(a) * 24)}" stroke="${F.accent[2]}" stroke-width="2" stroke-linecap="round"/>`;
        })
        .join("") +
      sparks(
        [
          [28, 80, 1.6],
          [100, 74, 1.5],
          [24, 50, 1.2],
          [106, 44, 1.3],
        ],
        F.accent[2],
      ),
  },

  // Tidefin · Water
  "Tide Needle": {
    el: "water",
    draw: () =>
      `<path d="M14 100 Q60 84 96 40" stroke="url(#sa-diag-water)" stroke-width="7" fill="none" stroke-linecap="round" opacity=".5"/>` +
      halo("water", 94, 40, 26) +
      // A slim water needle with a droplet head.
      `<path d="M26 98 Q66 80 96 40 L102 46 Q72 86 30 104Z" fill="url(#sa-diag-water)"/>` +
      `<path d="M106 26 Q104 40 94 46 Q90 38 96 30 Q100 26 106 26Z" fill="${W.accent[2]}"/>` +
      `<path d="M104 30 Q102 38 96 42" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      [
        [44, 96],
        [60, 88],
        [74, 74],
      ]
        .map(
          ([x, y], i) =>
            `<circle cx="${x}" cy="${y}" r="${2.6 - i * 0.5}" fill="${W.accent[2]}"/>`,
        )
        .join("") +
      `<g fill="none" stroke="${W.accent[1]}" stroke-width="1.4" opacity=".4"><path d="M8 112 Q30 106 52 112 T96 112 T128 110"/></g>` +
      sparks(
        [
          [112, 56, 1.5],
          [84, 22, 1.3],
          [24, 62, 1.2],
        ],
        W.accent[2],
      ),
  },
  "Gill Siphon": {
    el: "water",
    draw: () =>
      // A wavy stream from the gill fronds to a target; droplets flow home.
      floorGlow("water", 64, 104, 56, 12) +
      `<path d="M40 110 Q52 96 64 104 Q76 96 88 110" fill="none" stroke="#ff9fc4" stroke-width="5" stroke-linecap="round" opacity=".8"/>` +
      glow(
        "M30 84 Q50 64 64 70 Q80 76 96 52 Q104 40 108 34",
        W.hot,
        5,
        W.accent[1],
      ) +
      `<circle cx="108" cy="32" r="14" fill="none" stroke="${W.accent[2]}" stroke-width="2.4" stroke-dasharray="4 4"/>` +
      [
        [52, 68, 4],
        [76, 70, 3.4],
        [94, 52, 3],
      ]
        .map(
          ([x, y, r]) =>
            `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#sa-orb-water)"/><circle cx="${x - 1}" cy="${y - 1}" r="${r * 0.35}" fill="#fff" opacity=".85"/>`,
        )
        .join("") +
      halo("water", 30, 86, 14) +
      `<path d="M24 92 l6 -12 l6 12" fill="none" stroke="#7dffb0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
      sparks(
        [
          [18, 30, 1.4],
          [60, 20, 1.2],
          [118, 92, 1.3],
        ],
        W.accent[2],
      ),
  },
  Eddy: {
    el: "water",
    draw: () =>
      floorGlow("water", 64, 70, 58, 36, 0.8) +
      [0, 1, 2, 3, 4]
        .map((k) => {
          const r = 48 - k * 9;
          return `<path d="M${64 - r} 70 A${r} ${r * 0.55} 0 1 1 ${64 + r * 0.6} ${70 + r * 0.44}" fill="none" stroke="${k % 2 ? W.accent[1] : W.accent[2]}" stroke-width="${4.4 - k * 0.6}" stroke-linecap="round" opacity="${0.95 - k * 0.1}" transform="rotate(${k * 34} 64 70)"/>`;
        })
        .join("") +
      `<ellipse cx="64" cy="70" rx="8" ry="4.5" fill="${W.bg[2]}"/>` +
      `<ellipse cx="64" cy="70" rx="12" ry="7" fill="none" stroke="#fff" stroke-width="1.6" opacity=".8"/>` +
      [
        [24, 40],
        [104, 36],
        [110, 96],
        [20, 98],
      ]
        .map(
          ([x, y]) =>
            `<path d="M${x} ${y} q3 -6 0 -9 q-3 3 0 9Z" fill="${W.accent[2]}"/>`,
        )
        .join("") +
      sparks(
        [
          [64, 22, 1.5],
          [36, 26, 1.2],
        ],
        W.accent[2],
      ),
  },
  "Tide Double": {
    el: "water",
    draw: () =>
      // A misty decoy silhouette beside the real dash streaks.
      `<ellipse cx="44" cy="62" rx="26" ry="40" fill="url(#sa-glow-water)" opacity=".7"/>` +
      `<g opacity=".55"><circle cx="44" cy="44" r="12" fill="${W.accent[2]}"/><path d="M26 98 Q26 62 44 58 Q62 62 62 98Z" fill="${W.accent[2]}"/></g>` +
      `<g fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 4" opacity=".75"><circle cx="44" cy="44" r="12"/><path d="M26 98 Q26 62 44 58 Q62 62 62 98"/></g>` +
      [
        [70, 46, 118, 34],
        [72, 64, 122, 60],
        [70, 82, 116, 88],
      ]
        .map(([x0, y0, x1, y1], i) =>
          glow(
            `M${x0} ${y0} L${x1} ${y1}`,
            i === 1 ? W.hot : W.accent[2],
            i === 1 ? 3 : 2,
            W.accent[1],
          ),
        )
        .join("") +
      `<path d="M10 104 Q30 96 50 104 T90 104" fill="none" stroke="${W.accent[1]}" stroke-width="2" opacity=".5"/>` +
      sparks(
        [
          [86, 24, 1.4],
          [20, 30, 1.2],
          [104, 104, 1.3],
        ],
        W.accent[2],
      ),
  },
  "Riptide Wave": {
    el: "water",
    draw: () =>
      // A towering breaking wave, curling over.
      `<path d="M0 112 Q20 104 34 84 Q48 50 78 34 Q106 22 118 44 Q104 38 92 46 Q84 52 88 62 Q96 74 116 70 Q104 92 76 98 Q40 104 20 128 H0Z" fill="url(#sa-up-water)"/>` +
      `<path d="M30 92 Q46 58 78 42 Q100 32 112 44 Q100 42 90 50 Q80 58 86 70" fill="none" stroke="${W.accent[2]}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M40 86 Q54 62 76 52" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>` +
      [
        [116, 46, 3],
        [122, 58, 2.4],
        [110, 32, 2],
        [100, 24, 1.6],
        [122, 72, 2],
      ]
        .map(
          ([x, y, r]) =>
            `<circle cx="${x}" cy="${y}" r="${r}" fill="${W.accent[2]}"/>`,
        )
        .join("") +
      `<path d="M0 118 Q30 110 60 116 T128 112 V128 H0Z" fill="${W.accent[0]}" opacity=".7"/>` +
      glow(`M20 70 L4 70 M24 56 L10 54`, W.accent[2], 2, W.accent[1]),
  },

  // Auralynx · Aura
  "Prism Jab": {
    el: "aura",
    draw: () =>
      halo("aura", 70, 60, 46) +
      // A crystal fist punching through a burst.
      [0, 1, 2, 3, 4, 5, 6, 7]
        .map((k) => {
          const a = (k / 8) * Math.PI * 2;
          return `<path d="M${n(84 + Math.cos(a) * 14)} ${n(48 + Math.sin(a) * 14)} L${n(84 + Math.cos(a) * 34)} ${n(48 + Math.sin(a) * 34)}" stroke="${A.accent[2]}" stroke-width="2" stroke-linecap="round" opacity=".7"/>`;
        })
        .join("") +
      `<path d="M30 94 L52 72 L60 80 L38 102Z" fill="${A.accent[0]}"/>` +
      `<path d="M50 70 L70 46 L92 42 L98 56 L90 70 L66 84Z" fill="url(#sa-orb-aura)"/>` +
      `<path d="M70 46 L80 60 L66 84 M80 60 L98 56 M80 60 L92 42" stroke="#fff" stroke-width="1.6" fill="none" opacity=".75"/>` +
      `<path d="M52 72 L66 84" stroke="${A.accent[2]}" stroke-width="3"/>` +
      glint(84, 48, 12, "#fff") +
      sparks(
        [
          [24, 40, 1.4],
          [108, 92, 1.5],
          [40, 20, 1.2],
        ],
        A.accent[2],
      ),
  },
  "Prism Shot": {
    el: "aura",
    draw: () =>
      `<path d="M16 104 L82 48" stroke="url(#sa-diag-aura)" stroke-width="12" stroke-linecap="round" opacity=".5"/>` +
      halo("aura", 86, 44, 32) +
      // A faceted crystal shard flying, refracting rainbow edges.
      `<path d="M66 60 L88 26 L112 34 L104 58 L80 68Z" fill="url(#sa-orb-aura)"/>` +
      `<path d="M88 26 L90 50 L66 60 M90 50 L112 34 M90 50 L104 58 L80 68" stroke="#fff" stroke-width="1.5" fill="none" opacity=".8"/>` +
      `<path d="M62 64 L30 92" stroke="#ff9ad0" stroke-width="2" opacity=".7"/><path d="M66 68 L36 98" stroke="#9affd8" stroke-width="2" opacity=".7"/><path d="M58 60 L26 86" stroke="#fff3a0" stroke-width="2" opacity=".7"/>` +
      glint(100, 32, 9, "#fff") +
      sparks(
        [
          [112, 70, 1.5],
          [44, 30, 1.3],
          [96, 98, 1.2],
        ],
        A.accent[2],
      ),
  },
  "Shatter Paw": {
    el: "aura",
    draw: () =>
      // A crystal-gauntleted lynx paw, a shockwave cracking outward.
      [0, 1, 2]
        .map(
          (k) =>
            `<path d="M${76 + k * 10} ${20 + k * 2} A${30 + k * 12} ${40 + k * 12} 0 0 1 ${76 + k * 10} ${108 - k * 2}" fill="none" stroke="${k ? A.accent[1] : A.accent[2]}" stroke-width="${4 - k}" stroke-linecap="round" opacity="${0.95 - k * 0.25}"/>`,
        )
        .join("") +
      halo("aura", 54, 64, 40) +
      `<ellipse cx="54" cy="72" rx="22" ry="20" fill="url(#sa-orb-aura)"/>` +
      [
        [36, 46, 8],
        [50, 40, 8.5],
        [64, 42, 8],
        [74, 52, 7],
      ]
        .map(
          ([x, y, r]) =>
            `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r + 1.5}" fill="url(#sa-orb-aura)"/>`,
        )
        .join("") +
      `<path d="M44 84 L54 64 L64 84 L54 96Z" fill="${A.hot}" opacity=".85"/><path d="M54 64 V96" stroke="${A.accent[0]}" stroke-width="1.2" opacity=".6"/>` +
      glow(
        `M96 40 L106 52 L100 60 L112 70 M100 86 L110 94`,
        "#fff",
        1.8,
        A.accent[1],
      ) +
      sparks(
        [
          [116, 30, 1.5],
          [118, 100, 1.4],
          [20, 30, 1.2],
        ],
        A.accent[2],
      ),
  },
  "Facet Guard": {
    el: "aura",
    draw: () =>
      halo("aura", 64, 62, 50) +
      // A faceted crystal shield bouncing a bolt back.
      `<path d="M64 14 L102 30 L96 78 L64 106 L32 78 L26 30Z" fill="url(#sa-orb-aura)" opacity=".9"/>` +
      `<path d="M64 14 L64 106 M26 30 L102 30 M32 78 L96 78 M26 30 L64 60 L102 30 M32 78 L64 60 L96 78" stroke="#fff" stroke-width="1.4" fill="none" opacity=".55"/>` +
      `<path d="M64 14 L102 30 L96 78 L64 106 L32 78 L26 30Z" fill="none" stroke="${A.accent[2]}" stroke-width="2.4"/>` +
      glow(`M8 44 L40 56`, "#ff9a9a", 2.4, "#ff6a6a") +
      glow(`M40 56 L10 76`, A.hot, 2.4, A.accent[1]) +
      `<path d="M10 76 l8 -1 l-4 7Z" fill="#fff"/>` +
      glint(78, 40, 9, "#fff") +
      sparks(
        [
          [110, 98, 1.5],
          [116, 54, 1.3],
        ],
        A.accent[2],
      ),
  },
  "Crystal Cage": {
    el: "aura",
    draw: () =>
      // A ring of crystal spires round a lone enemy; a shot shatters on it.
      floorGlow("aura", 64, 86, 56, 20) +
      `<ellipse cx="64" cy="84" rx="48" ry="20" fill="none" stroke="${A.accent[2]}" stroke-width="2.4" opacity=".85"/>` +
      `<circle cx="64" cy="74" r="9" fill="#1b1636" opacity=".85"/><circle cx="64" cy="62" r="7" fill="#1b1636" opacity=".85"/>` +
      Array.from({ length: 11 }, (_, k) => (k / 11) * Math.PI * 2)
        .sort((a, b) => Math.sin(a) - Math.sin(b))
        .map((a) => {
          const x = 64 + Math.cos(a) * 48,
            y = 84 + Math.sin(a) * 20,
            h = 30 + (Math.sin(a * 3) + 1) * 6;
          return (
            `<path d="M${n(x - 7)} ${n(y)} L${n(x)} ${n(y - h)} L${n(x)} ${n(y + 2)}Z" fill="${A.accent[1]}"/>` +
            `<path d="M${n(x)} ${n(y + 2)} L${n(x)} ${n(y - h)} L${n(x + 7)} ${n(y)}Z" fill="#dff4ff"/>`
          );
        })
        .join("") +
      `<path d="M120 28 L100 44" stroke="#ff9be0" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 4"/>` +
      sparks(
        [
          [98, 46, 2.2],
          [20, 26, 1.5],
          [108, 112, 1.3],
        ],
        A.accent[2],
      ),
  },

  // Lumoth · Light
  Glint: {
    el: "light",
    draw: () =>
      `<path d="M16 102 Q48 84 80 50" stroke="url(#sa-diag-light)" stroke-width="8" fill="none" stroke-linecap="round" opacity=".5"/>` +
      [
        [34, 90, 1.8],
        [48, 80, 1.5],
        [60, 70, 1.3],
      ]
        .map(
          ([x, y, r]) =>
            `<circle cx="${x}" cy="${y}" r="${r}" fill="${L.accent[2]}"/>`,
        )
        .join("") +
      halo("light", 84, 46, 36) +
      glint(84, 46, 24, L.accent[1]) +
      glint(84, 46, 14, L.hot) +
      `<circle cx="84" cy="46" r="4" fill="#fff"/>` +
      glint(108, 78, 6, L.accent[2]) +
      glint(40, 30, 5, L.accent[2]) +
      sparks(
        [
          [106, 24, 1.3],
          [22, 60, 1.2],
        ],
        L.accent[2],
      ),
  },
  "Wing Dust": {
    el: "light",
    draw: () =>
      [
        [-50, 0.9],
        [-25, 1],
        [0, 1.2],
        [25, 1],
        [50, 0.9],
      ]
        .map(([deg, s], i) => {
          const a = ((deg - 90) * Math.PI) / 180,
            x = n(64 + Math.cos(a) * 46),
            y = n(104 + Math.sin(a) * 76);
          return (
            `<path d="M64 104 L${x} ${y}" stroke="url(#sa-diag-light)" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>` +
            halo("light", x, y, 12 * s) +
            glint(x, y, 10 * s, i === 2 ? L.hot : L.accent[2])
          );
        })
        .join("") +
      `<ellipse cx="64" cy="106" rx="20" ry="5" fill="url(#sa-glow-light)"/>` +
      sparks(
        [
          [20, 50, 1.2],
          [108, 46, 1.3],
          [64, 12, 1.4],
        ],
        L.accent[2],
      ),
  },
  "Eyespot Flash": {
    el: "light",
    draw: () => {
      // Two wings snap open, their big eyespots flaring.
      const spot = (x: number, y: number) =>
        `<circle cx="${x}" cy="${y}" r="15" fill="${L.hot}"/><circle cx="${x}" cy="${y}" r="11" fill="${L.accent[1]}"/><circle cx="${x}" cy="${y}" r="6.5" fill="${L.bg[2]}"/><circle cx="${x - 2.4}" cy="${y - 2.6}" r="2.2" fill="#fff"/>`;
      return (
        halo("light", 64, 60, 50) +
        [0, 1, 2, 3, 4, 5, 6, 7]
          .map((k) => {
            const a = (k / 8) * Math.PI * 2,
              x0 = 64 + Math.cos(a) * 46,
              y0 = 60 + Math.sin(a) * 46,
              x1 = 64 + Math.cos(a) * 58,
              y1 = 60 + Math.sin(a) * 58;
            return `<path d="M${n(x0)} ${n(y0)} L${n(x1)} ${n(y1)}" stroke="${L.accent[2]}" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>`;
          })
          .join("") +
        `<path d="M62 58 Q34 20 14 40 Q8 70 34 82 Q50 86 62 70Z" fill="url(#sa-up-light)"/>` +
        `<path d="M66 58 Q94 20 114 40 Q120 70 94 82 Q78 86 66 70Z" fill="url(#sa-up-light)"/>` +
        `<ellipse cx="64" cy="66" rx="5" ry="16" fill="${L.accent[0]}"/>` +
        spot(38, 56) +
        spot(90, 56) +
        sparks(
          [
            [22, 100, 1.4],
            [106, 100, 1.4],
            [64, 108, 1.3],
            [64, 14, 1.3],
          ],
          L.accent[2],
        )
      );
    },
  },
  Kindle: {
    el: "light",
    draw: () =>
      floorGlow("light", 64, 100, 46, 12) +
      halo("light", 64, 58, 50) +
      // An empowering flame-light rising through two upward chevrons.
      `<path d="M64 100 Q40 80 48 54 Q52 66 58 68 Q52 46 66 22 Q70 42 82 50 Q90 76 64 100Z" fill="url(#sa-up-light)"/>` +
      `<path d="M64 94 Q52 80 58 64 Q62 72 66 72 Q66 58 72 50 Q80 74 64 94Z" fill="${L.hot}"/>` +
      `<path d="M24 64 L36 52 L48 64 M80 64 L92 52 L104 64" fill="none" stroke="${L.accent[2]}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M24 80 L36 68 L48 80 M80 80 L92 68 L104 80" fill="none" stroke="${L.accent[1]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>` +
      glint(96, 26, 6, L.hot) +
      glint(30, 30, 5, L.accent[2]),
  },
  "Radiant Flare": {
    el: "light",
    draw: () =>
      // Three long rays turning round Lumoth like a lighthouse's.
      floorGlow("light", 64, 98, 54, 16) +
      halo("light", 64, 62, 50) +
      `<path d="M28 34 A50 50 0 0 1 64 14" fill="none" stroke="${L.accent[2]}" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="4 5"/><path d="M60 8 L66 14 L58 18" fill="none" stroke="${L.accent[2]}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
      [0, 1, 2]
        .map((k) => {
          const a = -0.5 + (k / 3) * Math.PI * 2,
            w = 0.16,
            len = 60;
          return (
            `<path d="M64 62 L${n(64 + Math.cos(a - w) * len)} ${n(62 + Math.sin(a - w) * len)} L${n(64 + Math.cos(a + w) * len)} ${n(62 + Math.sin(a + w) * len)}Z" fill="${L.accent[1]}" opacity=".75"/>` +
            `<path d="M64 62 L${n(64 + Math.cos(a - w * 0.4) * len * 0.95)} ${n(62 + Math.sin(a - w * 0.4) * len * 0.95)} L${n(64 + Math.cos(a + w * 0.4) * len * 0.95)} ${n(62 + Math.sin(a + w * 0.4) * len * 0.95)}Z" fill="#fff6d6"/>`
          );
        })
        .join("") +
      `<circle cx="64" cy="62" r="16" fill="url(#sa-core-light)"/>` +
      glint(64, 62, 12, "#fff") +
      sparks(
        [
          [106, 20, 1.5],
          [112, 96, 1.3],
          [16, 92, 1.3],
        ],
        L.accent[2],
      ),
  },

  // Mystowl · Psychic
  "Mind Dart": {
    el: "psychic",
    draw: () =>
      `<path d="M14 102 Q50 92 84 50" stroke="url(#sa-diag-psychic)" stroke-width="8" fill="none" stroke-linecap="round" opacity=".5"/>` +
      [0, 1, 2]
        .map(
          (k) =>
            `<ellipse cx="${46 + k * 12}" cy="${86 - k * 12}" rx="${7 - k}" ry="${3.5 - k * 0.4}" fill="none" stroke="${P.accent[2]}" stroke-width="1.4" opacity="${0.4 + k * 0.2}" transform="rotate(-40 ${46 + k * 12} ${86 - k * 12})"/>`,
        )
        .join("") +
      halo("psychic", 88, 44, 30) +
      // A darting eye of psychic energy.
      `<path d="M70 52 Q88 30 108 34 Q100 52 78 60Z" fill="url(#sa-orb-psychic)"/>` +
      `<circle cx="92" cy="42" r="6" fill="#fff"/><circle cx="93" cy="42" r="3" fill="${P.accent[0]}"/>` +
      sparks(
        [
          [110, 60, 1.5],
          [70, 22, 1.3],
          [24, 70, 1.2],
        ],
        P.accent[2],
      ),
  },
  "Third-Eye Ray": {
    el: "psychic",
    draw: () =>
      // A third-eye firing a straight beam.
      `<path d="M42 64 L128 50 L128 78Z" fill="url(#sa-glow-psychic)"/>` +
      `<path d="M44 62 L128 58 L128 70 L44 66Z" fill="${P.accent[2]}"/>` +
      `<path d="M44 63.5 L128 63 L128 65 L44 64.5Z" fill="#fff"/>` +
      [80, 100, 118]
        .map(
          (x, i) =>
            `<ellipse cx="${x}" cy="64" rx="${4 + i}" ry="${12 + i * 3}" fill="none" stroke="${P.accent[2]}" stroke-width="1.6" opacity="${0.8 - i * 0.2}"/>`,
        )
        .join("") +
      halo("psychic", 38, 64, 30) +
      `<path d="M14 64 Q38 40 62 64 Q38 88 14 64Z" fill="url(#sa-orb-psychic)"/>` +
      `<circle cx="38" cy="64" r="10" fill="#fff"/><circle cx="40" cy="64" r="5.5" fill="${P.accent[0]}"/><circle cx="42" cy="62" r="2" fill="#fff"/>` +
      sparks(
        [
          [20, 30, 1.4],
          [30, 100, 1.3],
          [70, 30, 1.2],
        ],
        P.accent[2],
      ),
  },
  "Booming Hoot": {
    el: "psychic",
    draw: () =>
      halo("psychic", 64, 64, 30) +
      [0, 1, 2]
        .map(
          (k) =>
            `<circle cx="64" cy="64" r="${24 + k * 13}" fill="none" stroke="${k ? P.accent[1] : P.accent[2]}" stroke-width="${4 - k}" opacity="${0.95 - k * 0.25}"/>`,
        )
        .join("") +
      [0, 1, 2, 3]
        .map((k) => {
          const a = (k / 4) * Math.PI * 2 + Math.PI / 4,
            x = 64 + Math.cos(a) * 46,
            y = 64 + Math.sin(a) * 46,
            ax = Math.cos(a) * 9,
            ay = Math.sin(a) * 9;
          return `<path d="M${n(x - ax)} ${n(y - ay)} L${n(x + ax)} ${n(y + ay)} M${n(x + ax - ay * 0.6 - ax * 0.5)} ${n(y + ay + ax * 0.6 - ay * 0.5)} L${n(x + ax)} ${n(y + ay)} L${n(x + ax + ay * 0.6 - ax * 0.5)} ${n(y + ay - ax * 0.6 - ay * 0.5)}" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
        })
        .join("") +
      `<circle cx="64" cy="64" r="14" fill="url(#sa-core-psychic)"/>` +
      `<path d="M52 64 Q64 54 76 64 Q64 74 52 64Z" fill="#fff"/><circle cx="64" cy="64" r="3.5" fill="${P.accent[0]}"/>`,
  },
  "Wing Cloak": {
    el: "psychic",
    draw: () =>
      halo("psychic", 64, 62, 50) +
      // A hexagonal psychic barrier.
      `<path d="M64 14 L106 38 L106 86 L64 110 L22 86 L22 38Z" fill="url(#sa-glow-psychic)"/>` +
      `<path d="M64 14 L106 38 L106 86 L64 110 L22 86 L22 38Z" fill="none" stroke="${P.accent[2]}" stroke-width="3"/>` +
      `<g stroke="${P.accent[1]}" stroke-width="1.4" opacity=".7" fill="none"><path d="M64 30 L92 46 L92 78 L64 94 L36 78 L36 46Z"/><path d="M64 14 V30 M106 38 L92 46 M106 86 L92 78 M64 110 V94 M22 86 L36 78 M22 38 L36 46"/></g>` +
      `<path d="M48 62 Q64 46 80 62 Q64 78 48 62Z" fill="#fff"/><circle cx="64" cy="62" r="5" fill="${P.accent[0]}"/>` +
      glow(`M114 30 L96 44`, "#ffb0b0", 2, "#ff6a6a") +
      `<circle cx="96" cy="44" r="4" fill="#fff" opacity=".8"/>` +
      sparks(
        [
          [16, 20, 1.3],
          [112, 108, 1.4],
        ],
        P.accent[2],
      ),
  },
  "Silent Swoop": {
    el: "psychic",
    draw: () =>
      floorGlow("psychic", 64, 92, 50, 18) +
      // A target circle, then the psychic blast falling from above.
      `<ellipse cx="64" cy="92" rx="40" ry="13" fill="none" stroke="${P.accent[2]}" stroke-width="2.4"/>` +
      `<ellipse cx="64" cy="92" rx="26" ry="8" fill="none" stroke="${P.accent[1]}" stroke-width="1.8" stroke-dasharray="4 4"/>` +
      `<path d="M46 0 L82 0 L70 90 L58 90Z" fill="url(#sa-glow-psychic)"/>` +
      `<path d="M58 0 L70 0 L66 88 L62 88Z" fill="${P.accent[2]}"/>` +
      halo("psychic", 64, 86, 26) +
      `<circle cx="64" cy="86" r="10" fill="url(#sa-core-psychic)"/>` +
      `<path d="M46 34 Q64 18 82 34 Q64 50 46 34Z" fill="url(#sa-orb-psychic)"/><circle cx="64" cy="34" r="6" fill="#fff"/><circle cx="64" cy="34" r="3" fill="${P.accent[0]}"/>` +
      sparks(
        [
          [22, 70, 1.5],
          [106, 72, 1.5],
          [30, 104, 1.2],
          [100, 106, 1.2],
        ],
        P.accent[2],
      ),
  },

  // Terradon · Earth
  "Boulder Swipe": {
    el: "earth",
    draw: () =>
      // A wide arc of rock and dust swung across.
      `<path d="M16 90 Q24 36 76 24 Q108 20 118 40 Q100 34 80 38 Q40 48 30 94Z" fill="url(#sa-up-earth)" opacity=".85"/>` +
      `<path d="M22 92 Q30 46 76 32 Q98 28 110 36" fill="none" stroke="${R.accent[2]}" stroke-width="3" stroke-linecap="round"/>` +
      [
        [96, 46, 12],
        [108, 64, 9],
        [84, 70, 7],
      ]
        .map(
          ([x, y, r], i) =>
            `<path d="M${x - r} ${y} L${x - r * 0.4} ${y - r} L${x + r * 0.7} ${y - r * 0.8} L${x + r} ${y + r * 0.2} L${x + r * 0.3} ${y + r} L${x - r * 0.7} ${y + r * 0.7}Z" fill="${i ? R.accent[0] : R.accent[1]}" stroke="${R.accent[2]}" stroke-width="1.4"/>`,
        )
        .join("") +
      `<g fill="${R.accent[2]}" opacity=".5"><circle cx="40" cy="104" r="6"/><circle cx="54" cy="110" r="4"/><circle cx="28" cy="110" r="3"/></g>` +
      sparks(
        [
          [118, 82, 1.6],
          [70, 92, 1.2],
          [26, 40, 1.2],
        ],
        R.accent[2],
      ),
  },
  "Shell Bash": {
    el: "earth",
    draw: () =>
      floorGlow("earth", 64, 100, 52, 14) +
      // A heavy shell crashing down, stars of a stun.
      `<path d="M30 84 Q30 40 64 36 Q98 40 98 84Z" fill="url(#sa-up-earth)"/>` +
      `<path d="M30 84 Q30 40 64 36 Q98 40 98 84Z" fill="none" stroke="${R.accent[2]}" stroke-width="2.4"/>` +
      `<g fill="none" stroke="${R.accent[0]}" stroke-width="2"><path d="M64 36 V84 M44 46 L52 84 M84 46 L76 84 M34 64 H94"/></g>` +
      `<path d="M20 98 L34 86 L94 86 L108 98" fill="none" stroke="${R.accent[2]}" stroke-width="3" stroke-linecap="round"/>` +
      glow(
        `M14 96 L4 90 M114 96 L124 90 M24 104 L14 108 M104 104 L114 108`,
        R.accent[2],
        2,
        R.accent[1],
      ) +
      glint(44, 22, 6, "#fff3c0") +
      glint(64, 14, 7, "#fff3c0") +
      glint(84, 22, 6, "#fff3c0"),
  },
  "Shell Up": {
    el: "earth",
    draw: () =>
      halo("earth", 64, 70, 46, 0.8) +
      // A tortoise shell pulled shut, plates glowing, moss on top, regrowing.
      `<ellipse cx="64" cy="70" rx="48" ry="40" fill="none" stroke="#9be07a" stroke-width="2" opacity=".55" stroke-dasharray="4 5"/>` +
      `<path d="M22 92 Q20 50 64 44 Q108 50 106 92 Q100 100 64 100 Q28 100 22 92Z" fill="url(#sa-up-earth)"/>` +
      `<path d="M22 92 Q20 50 64 44 Q108 50 106 92" fill="none" stroke="${R.accent[2]}" stroke-width="2.4"/>` +
      `<path d="M52 58 L64 52 L76 58 L76 72 L64 78 L52 72Z M30 74 L40 64 L52 72 L50 88 L36 92 Z M98 74 L88 64 L76 72 L78 88 L92 92 Z" fill="none" stroke="${R.bg[2]}" stroke-width="2.2" stroke-linejoin="round" opacity=".7"/>` +
      `<path d="M36 52 Q48 40 64 42 Q80 40 92 52 Q80 48 64 50 Q48 48 36 52Z" fill="#6fae4f"/>` +
      `<g fill="#7dffb0"><path d="M14 40 h4 v-4 h4 v4 h4 v4 h-4 v4 h-4 v-4 h-4Z"/><path d="M104 28 h3 v-3 h3 v3 h3 v3 h-3 v3 h-3 v-3 h-3Z" opacity=".75"/></g>`,
  },
  "Mud Mire": {
    el: "earth",
    draw: () =>
      // A patch of sticky mud with a footprint sinking into it.
      floorGlow("earth", 64, 80, 54, 26, 0.7) +
      `<ellipse cx="64" cy="80" rx="50" ry="24" fill="${R.bg[1]}"/>` +
      `<ellipse cx="64" cy="78" rx="44" ry="19" fill="${R.accent[0]}"/>` +
      [
        [40, 76, 9, 5],
        [70, 70, 11, 6],
        [86, 86, 8, 4],
        [52, 90, 7, 3.5],
      ]
        .map(
          ([x, y, rx, ry]) =>
            `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${R.accent[1]}" opacity=".55"/>`,
        )
        .join("") +
      `<circle cx="60" cy="66" r="4" fill="none" stroke="${R.accent[2]}" stroke-width="1.6" opacity=".8"/><circle cx="82" cy="78" r="3" fill="none" stroke="${R.accent[2]}" stroke-width="1.4" opacity=".7"/>` +
      `<path d="M48 54 Q46 42 52 36 Q58 42 56 54Z M62 50 Q62 38 68 34 Q72 42 68 52Z" fill="${R.accent[1]}" opacity=".9"/>` +
      `<path d="M30 50 L40 58 M98 50 L88 58" stroke="${R.accent[2]}" stroke-width="2" stroke-linecap="round" opacity=".7"/>` +
      sparks(
        [
          [22, 44, 1.4],
          [112, 92, 1.3],
          [30, 104, 1.2],
        ],
        R.accent[2],
      ),
  },
  Tremor: {
    el: "earth",
    draw: () =>
      floorGlow("earth", 64, 84, 58, 22) +
      // The ground splitting in a star of cracks, rocks thrown up.
      `<ellipse cx="64" cy="86" rx="52" ry="20" fill="${R.bg[1]}"/>` +
      glow(
        `M64 86 L40 78 L18 82 M64 86 L54 100 L34 108 M64 86 L82 100 L100 108 M64 86 L88 76 L110 80 M64 86 L66 72`,
        R.accent[2],
        2.6,
        R.accent[1],
      ) +
      [0, 1, 2]
        .map(
          (k) =>
            `<ellipse cx="64" cy="86" rx="${20 + k * 14}" ry="${7 + k * 5}" fill="none" stroke="${R.accent[1]}" stroke-width="${2.4 - k * 0.6}" opacity="${0.8 - k * 0.2}"/>`,
        )
        .join("") +
      [
        [40, 44, 9],
        [86, 38, 11],
        [64, 24, 7],
        [104, 56, 6],
        [24, 58, 6],
      ]
        .map(
          ([x, y, r], i) =>
            `<path d="M${x - r} ${y} L${x - r * 0.4} ${y - r} L${x + r * 0.7} ${y - r * 0.8} L${x + r} ${y + r * 0.2} L${x + r * 0.3} ${y + r} L${x - r * 0.7} ${y + r * 0.7}Z" fill="${i % 2 ? R.accent[0] : R.accent[1]}" stroke="${R.accent[2]}" stroke-width="1.2"/>`,
        )
        .join(""),
  },

  // Duskveil · Shadow
  "Lantern Wisp": {
    el: "shadow",
    draw: () =>
      `<path d="M14 104 Q40 96 54 80 Q66 66 80 56" stroke="url(#sa-diag-shadow)" stroke-width="10" fill="none" stroke-linecap="round" opacity=".5"/>` +
      halo("shadow", 86, 48, 32) +
      // A little ghost flame with a face.
      `<path d="M86 22 Q104 36 102 54 Q100 70 86 72 Q70 70 70 54 Q70 40 86 22Z" fill="url(#sa-orb-shadow)"/>` +
      `<path d="M70 56 Q60 64 52 62 Q60 72 74 68Z" fill="${S.accent[1]}" opacity=".8"/>` +
      `<ellipse cx="80" cy="52" rx="2.6" ry="3.6" fill="${S.bg[2]}"/><ellipse cx="92" cy="52" rx="2.6" ry="3.6" fill="${S.bg[2]}"/>` +
      sparks(
        [
          [106, 26, 1.4],
          [110, 76, 1.3],
          [40, 30, 1.2],
          [30, 80, 1.3],
        ],
        S.accent[2],
      ),
  },
  "Shade Crawl": {
    el: "shadow",
    draw: () =>
      // A shadow tearing along the ground, claws rising.
      `<ellipse cx="64" cy="94" rx="58" ry="14" fill="url(#sa-glow-shadow)"/>` +
      `<path d="M8 96 Q40 86 76 92 Q100 96 120 84 Q104 104 76 104 Q40 106 8 96Z" fill="${S.bg[2]}" stroke="${S.accent[1]}" stroke-width="2"/>` +
      [
        [70, 90],
        [86, 88],
        [102, 82],
      ]
        .map(
          ([x, y], i) =>
            `<path d="M${x} ${y} Q${x - 4} ${y - 30 - i * 4} ${x + 8} ${y - 44 - i * 6} Q${x + 2} ${y - 26} ${x + 8} ${y}Z" fill="url(#sa-up-shadow)"/>`,
        )
        .join("") +
      glow(`M10 82 L40 82 M14 70 L36 72`, S.accent[2], 1.8, S.accent[1]) +
      sparks(
        [
          [112, 30, 1.4],
          [40, 40, 1.2],
          [60, 24, 1.2],
        ],
        S.accent[2],
      ),
  },
  Ghostfire: {
    el: "shadow",
    draw: () => {
      const flame = (x: number, y: number, s: number) =>
        `<g transform="translate(${x} ${y}) scale(${s})">${halo("shadow", 0, 0, 22)}<path d="M0 -20 Q14 -6 12 6 Q10 18 0 18 Q-10 18 -12 6 Q-14 -6 0 -20Z" fill="url(#sa-up-shadow)"/><path d="M0 -6 Q6 2 5 8 Q4 14 0 14 Q-4 14 -5 8 Q-6 2 0 -6Z" fill="${S.hot}"/></g>`;
      return (
        [
          [64, 104, 64, 36],
          [64, 104, 32, 54],
          [64, 104, 96, 54],
        ]
          .map(
            ([x0, y0, x1, y1]) =>
              `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="url(#sa-diag-shadow)" stroke-width="3" stroke-linecap="round" opacity=".5"/>`,
          )
          .join("") +
        flame(64, 36, 1.15) +
        flame(32, 56, 0.95) +
        flame(96, 56, 0.95) +
        sparks(
          [
            [20, 30, 1.3],
            [108, 26, 1.3],
            [64, 112, 1.3],
          ],
          S.accent[2],
        )
      );
    },
  },
  "Haunted Lantern": {
    el: "shadow",
    draw: () =>
      // A lantern hung on a crooked post, its ghost flame lighting the ground.
      floorGlow("shadow", 64, 104, 54, 14) +
      `<ellipse cx="64" cy="104" rx="50" ry="12" fill="none" stroke="${S.accent[2]}" stroke-width="1.6" opacity=".55" stroke-dasharray="4 4"/>` +
      `<path d="M44 106 V30 Q44 22 52 22 H74" fill="none" stroke="${S.bg[2]}" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M44 106 V30 Q44 22 52 22 H74" fill="none" stroke="${S.accent[0]}" stroke-width="2" stroke-linecap="round" opacity=".8"/>` +
      `<path d="M74 22 V32" stroke="${S.accent[2]}" stroke-width="1.6"/>` +
      halo("shadow", 76, 52, 30) +
      `<rect x="62" y="32" width="28" height="34" rx="7" fill="${S.bg[1]}" stroke="${S.accent[2]}" stroke-width="2.4"/>` +
      `<path d="M76 38 Q86 48 84 56 Q82 62 76 62 Q70 62 68 56 Q66 48 76 38Z" fill="#7dffe1"/>` +
      `<path d="M76 46 Q80 52 79 56 Q78 59 76 59 Q74 59 73 56 Q72 52 76 46Z" fill="#e6fff8"/>` +
      `<path d="M96 70 Q104 74 108 84" fill="none" stroke="#7dffe1" stroke-width="3" stroke-linecap="round" opacity=".8"/><circle cx="109" cy="87" r="4" fill="#7dffe1"/>` +
      sparks(
        [
          [22, 26, 1.3],
          [106, 22, 1.4],
          [20, 96, 1.2],
          [100, 50, 1.2],
        ],
        S.accent[2],
      ),
  },
  "Void Orb": {
    el: "shadow",
    draw: () =>
      halo("shadow", 64, 62, 54) +
      // A swirling void sphere with a dark core.
      [0, 1, 2]
        .map(
          (k) =>
            `<ellipse cx="64" cy="62" rx="${46 - k * 4}" ry="${14 + k * 2}" fill="none" stroke="${k ? S.accent[1] : S.accent[2]}" stroke-width="${2.6 - k * 0.6}" opacity="${0.9 - k * 0.2}" transform="rotate(${-20 + k * 40} 64 62)"/>`,
        )
        .join("") +
      `<circle cx="64" cy="62" r="26" fill="url(#sa-orb-shadow)"/>` +
      `<circle cx="64" cy="62" r="14" fill="${S.bg[2]}"/>` +
      `<circle cx="64" cy="62" r="14" fill="none" stroke="${S.accent[2]}" stroke-width="2"/>` +
      `<path d="M58 56 Q64 50 70 56" fill="none" stroke="${S.hot}" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>` +
      sparks(
        [
          [18, 30, 1.4],
          [110, 24, 1.5],
          [112, 100, 1.4],
          [18, 100, 1.3],
        ],
        S.accent[2],
      ),
  },
  // Coilemur · Electric
  "Coil Swipe": {
    el: "electric",
    draw: () =>
      halo("electric", 70, 60, 46) +
      // A crackling three-claw swipe with the ringed tail's arc behind it.
      `<path d="M22 100 Q18 40 74 22 Q102 14 116 30 Q90 24 72 36 Q42 56 40 102Z" fill="url(#sa-up-electric)" opacity=".45"/>` +
      `<path d="M28 98 Q26 46 74 28 Q98 20 110 28" fill="none" stroke="#2c2840" stroke-width="8" stroke-linecap="round" opacity=".8"/>` +
      `<path d="M28 98 Q26 46 74 28 Q98 20 110 28" fill="none" stroke="#f7f3ea" stroke-width="8" stroke-dasharray="7 7" opacity=".7"/>` +
      [
        [40, 86, 56, 52, 92, 36],
        [52, 96, 68, 62, 102, 48],
        [64, 106, 80, 74, 110, 62],
      ]
        .map(([x0, y0, cx, cy, x1, y1], i) =>
          glow(
            `M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`,
            i === 1 ? "#fff" : E.hot,
            i === 1 ? 4 : 3,
            E.accent[1],
          ),
        )
        .join("") +
      glow(
        bolt(
          [
            [92, 36],
            [100, 24],
          ],
          3,
          4,
        ),
        E.accent[2],
        1.6,
        E.accent[1],
      ) +
      glow(
        bolt(
          [
            [110, 62],
            [118, 72],
          ],
          3,
          6,
        ),
        E.accent[2],
        1.6,
        E.accent[1],
      ) +
      sparks(
        [
          [24, 40, 1.5],
          [116, 46, 1.4],
          [86, 104, 1.3],
          [52, 20, 1.2],
        ],
        E.accent[2],
      ),
  },
  "Magnet Lash": {
    el: "electric",
    draw: () =>
      // A horseshoe magnet cracking a lash of lightning that hooks its target back.
      halo("electric", 98, 38, 26) +
      glow(
        bolt(
          [
            [48, 76],
            [62, 52],
            [82, 38],
            [98, 38],
          ],
          4,
          5,
        ),
        E.hot,
        2.8,
        E.accent[1],
      ) +
      `<circle cx="100" cy="38" r="9" fill="url(#sa-orb-electric)"/>` +
      `<circle cx="100" cy="38" r="15" fill="none" stroke="${E.accent[2]}" stroke-width="2" stroke-dasharray="4 4"/>` +
      chevron(86, 64, 6, 135, E.accent[2], 3) +
      chevron(74, 76, 6, 135, E.accent[1], 3, 0.7) +
      halo("electric", 38, 88, 30, 0.8) +
      magnet(36, 88, 1.35, -50) +
      sparks(
        [
          [22, 34, 1.5],
          [114, 66, 1.5],
          [62, 22, 1.3],
          [106, 98, 1.2],
        ],
        E.accent[2],
      ),
  },
  "Static Clamp": {
    el: "electric",
    draw: () =>
      halo("electric", 84, 64, 40) +
      // Two charged jaws snapping shut on a target; stun stars above.
      `<path d="M16 48 Q36 20 68 28 Q86 32 92 50 Q76 42 62 44 Q40 48 28 62Z" fill="url(#sa-orb-electric)" stroke="${E.accent[2]}" stroke-width="2"/>` +
      `<path d="M16 80 Q36 108 68 100 Q86 96 92 78 Q76 86 62 84 Q40 80 28 66Z" fill="url(#sa-orb-electric)" stroke="${E.accent[2]}" stroke-width="2"/>` +
      `<path d="M24 50 Q40 32 66 34" fill="none" stroke="#fff" stroke-width="1.6" opacity=".7" stroke-linecap="round"/>` +
      halo("electric", 94, 64, 20) +
      `<circle cx="94" cy="64" r="9" fill="url(#sa-orb-electric)"/>` +
      glow(
        bolt(
          [
            [90, 50],
            [94, 64],
            [90, 78],
          ],
          4,
          3,
        ),
        "#fff",
        2.4,
        E.accent[1],
      ) +
      glow(
        bolt(
          [
            [104, 58],
            [118, 52],
          ],
          3,
          8,
        ),
        E.accent[2],
        1.6,
        E.accent[1],
      ) +
      glow(
        bolt(
          [
            [104, 70],
            [118, 78],
          ],
          3,
          9,
        ),
        E.accent[2],
        1.6,
        E.accent[1],
      ) +
      star(82, 20, 5.5, E.accent[2]) +
      star(98, 14, 6.5, E.hot) +
      star(112, 24, 5, E.accent[2]) +
      sparks(
        [
          [20, 100, 1.4],
          [44, 112, 1.2],
        ],
        E.accent[2],
      ) +
      `<circle cx="94" cy="64" r="17" fill="none" stroke="#fff" stroke-width="2.2" stroke-dasharray="5 4" opacity=".9"/><path d="M94 47 V54" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  "Spark Tether": {
    el: "electric",
    draw: () => {
      // A coiled, ringed tail at the centre of a crackling ring, tethered to two foes.
      const ring = Array.from({ length: 13 }, (_, k) => {
        const a = (k / 12) * Math.PI * 2;
        return [n(64 + Math.cos(a) * 46), n(88 + Math.sin(a) * 16)] as [
          number,
          number,
        ];
      });
      return (
        floorGlow("electric", 64, 88, 56, 22) +
        glow(bolt(ring, 2.2, 4), E.accent[2], 2.2, E.accent[1]) +
        [0, 1, 2, 3, 4]
          .map((k) => {
            const y = 82 - k * 11,
              rx = 14 - k;
            return `<path d="M${64 + rx} ${y} A${rx} 4.5 0 0 0 ${64 - rx} ${y}" fill="none" stroke="${E.bg[0]}" stroke-width="4"/><path d="M${64 - rx} ${y} A${rx} 4.5 0 0 0 ${64 + rx} ${y}" fill="none" stroke="${k % 2 ? "#2c2840" : "#f7f3ea"}" stroke-width="5" stroke-linecap="round"/>`;
          })
          .join("") +
        halo("electric", 64, 32, 22) +
        `<circle cx="64" cy="32" r="7" fill="url(#sa-orb-electric)"/>` +
        glow(
          bolt(
            [
              [58, 34],
              [36, 46],
              [18, 54],
            ],
            3,
            6,
          ),
          E.hot,
          2,
          E.accent[1],
        ) +
        glow(
          bolt(
            [
              [70, 34],
              [92, 44],
              [110, 52],
            ],
            3,
            7,
          ),
          E.hot,
          2,
          E.accent[1],
        ) +
        `<circle cx="16" cy="56" r="6" fill="${E.bg[2]}" stroke="${E.accent[2]}" stroke-width="2"/><circle cx="112" cy="54" r="6" fill="${E.bg[2]}" stroke="${E.accent[2]}" stroke-width="2"/>` +
        sparks(
          [
            [30, 20, 1.3],
            [100, 18, 1.4],
            [64, 112, 1.3],
          ],
          E.accent[2],
        )
      );
    },
  },
  Electromagnet: {
    el: "electric",
    draw: () =>
      floorGlow("electric", 64, 100, 54, 14) +
      // A great magnet whose field drags everything nearby inward.
      `<g fill="none" stroke="${E.accent[1]}" stroke-width="2" stroke-dasharray="3 5" opacity=".75"><path d="M40 92 Q4 64 34 26"/><path d="M88 92 Q124 64 94 26"/><path d="M42 94 Q16 108 8 84"/><path d="M86 94 Q112 108 120 84"/></g>` +
      halo("electric", 64, 58, 46) +
      magnet(64, 54, 2, 90) +
      glow(
        bolt(
          [
            [42, 90],
            [64, 92],
            [86, 90],
          ],
          3,
          5,
        ),
        "#fff",
        2.2,
        E.accent[1],
      ) +
      chevron(24, 104, 6, 0, E.accent[2], 3) +
      chevron(14, 104, 6, 0, E.accent[1], 3, 0.6) +
      chevron(104, 104, 6, 180, E.accent[2], 3) +
      chevron(114, 104, 6, 180, E.accent[1], 3, 0.6) +
      sparks(
        [
          [20, 22, 1.5],
          [108, 20, 1.5],
          [10, 64, 1.2],
          [118, 62, 1.2],
        ],
        E.accent[2],
      ),
  },

  // Pyranda · Fire
  "Ember Lob": {
    el: "fire",
    draw: () =>
      // A tail-tip ember lobbed in a long arc.
      `<path d="M16 104 Q40 20 96 44" fill="none" stroke="${F.accent[1]}" stroke-width="2.4" stroke-dasharray="3 6" stroke-linecap="round" opacity=".8"/>` +
      halo("fire", 92, 46, 32) +
      `<g transform="translate(92 46) rotate(22)"><path d="M0 -11 Q-22 -8 -40 0 Q-22 8 0 11Z" fill="url(#sa-up-fire)" opacity=".9"/><path d="M0 -6 Q-14 -4 -26 0 Q-14 4 0 6Z" fill="${F.accent[2]}"/></g>` +
      `<circle cx="92" cy="46" r="11" fill="url(#sa-orb-fire)"/><circle cx="89" cy="43" r="4" fill="#fff" opacity=".8"/>` +
      `<path d="M14 108 q-6 -10 2 -18 q2 8 8 8 q-2 -8 4 -12 q4 10 -2 22Z" fill="url(#sa-up-fire)"/>` +
      sparks(
        [
          [110, 30, 1.6],
          [106, 66, 1.4],
          [64, 24, 1.2],
          [40, 54, 1.2],
        ],
        F.accent[2],
      ),
  },
  "Chestnut Mortar": {
    el: "fire",
    draw: () =>
      // A burning chestnut lobbed over a wall onto a target.
      `<path d="M14 104 Q50 -8 98 94" fill="none" stroke="${F.accent[1]}" stroke-width="2.2" stroke-dasharray="3 6" stroke-linecap="round" opacity=".7"/>` +
      floorGlow("fire", 98, 98, 26, 9) +
      `<ellipse cx="98" cy="98" rx="20" ry="7" fill="none" stroke="${F.accent[2]}" stroke-width="2.2"/>` +
      `<path d="M98 88 V94 M98 102 V108 M74 98 H82 M114 98 H122" stroke="${F.accent[2]}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M62 108 V82 H80 V108Z" fill="#3a1a10" stroke="${F.accent[0]}" stroke-width="1.6"/><path d="M62 90 H80 M62 99 H80 M71 82 V90 M67 90 V99 M75 99 V108" stroke="${F.accent[0]}" stroke-width="1.4"/>` +
      `<path d="M28 58 Q38 40 50 38" fill="none" stroke="url(#sa-diag-fire)" stroke-width="8" stroke-linecap="round" opacity=".7"/>` +
      halo("fire", 58, 38, 28) +
      chestnut(60, 42, 1.3, 100) +
      sparks(
        [
          [86, 20, 1.5],
          [24, 30, 1.3],
          [110, 72, 1.3],
        ],
        F.accent[2],
      ),
  },
  "Hot Coals": {
    el: "fire",
    draw: () =>
      // A scatter of glowing coals, heat shimmering off them.
      floorGlow("fire", 64, 86, 58, 24) +
      `<ellipse cx="64" cy="86" rx="50" ry="18" fill="#260b05"/>` +
      `<ellipse cx="64" cy="86" rx="50" ry="18" fill="none" stroke="${F.accent[0]}" stroke-width="2" stroke-dasharray="5 4"/>` +
      [
        [36, 84, 9],
        [58, 92, 10],
        [82, 84, 9],
        [100, 92, 7],
        [48, 76, 6],
        [72, 74, 7],
        [28, 94, 6],
      ]
        .map(
          ([x, y, r]) =>
            `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n(r * 0.72)}" fill="#3a1408" stroke="${F.accent[1]}" stroke-width="1.6"/>` +
            `<ellipse cx="${x}" cy="${n(y + r * 0.28)}" rx="${n(r * 0.75)}" ry="${n(r * 0.32)}" fill="${F.accent[0]}" opacity=".85"/>` +
            `<path d="M${n(x - r * 0.6)} ${y} L${n(x - r * 0.15)} ${n(y - r * 0.3)} L${n(x + r * 0.2)} ${n(y + r * 0.05)} L${n(x + r * 0.6)} ${n(y - r * 0.2)}" fill="none" stroke="${F.accent[2]}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
        )
        .join("") +
      `<g fill="none" stroke="${F.accent[2]}" stroke-width="2" stroke-linecap="round" opacity=".55"><path d="M40 64 q-6 -8 0 -16 q6 -8 0 -16"/><path d="M64 60 q-6 -8 0 -16 q6 -8 0 -16 q-6 -8 0 -14"/><path d="M88 64 q-6 -8 0 -16 q6 -8 0 -16"/></g>` +
      `<path d="M58 84 q-4 -10 2 -16 q1 7 5 7 q0 -6 4 -9 q4 10 -2 18Z" fill="url(#sa-up-fire)"/>` +
      sparks(
        [
          [22, 50, 1.5],
          [106, 46, 1.4],
          [64, 20, 1.3],
          [110, 72, 1.2],
        ],
        F.accent[2],
      ),
  },
  "Ember Curtain": {
    el: "fire",
    draw: () =>
      // A wall of flame tongues; an incoming shot burns up against it.
      floorGlow("fire", 64, 104, 58, 12) +
      `<path d="M10 104 H118" stroke="${F.accent[0]}" stroke-width="5" stroke-linecap="round" opacity=".8"/>` +
      Array.from({ length: 7 }, (_, i) => {
        const x = 16 + i * 16,
          h = 46 + (i % 3) * 12;
        return (
          `<path d="M${x - 8} 104 Q${x - 6} ${104 - h * 0.5} ${x} ${104 - h} Q${x + 6} ${104 - h * 0.5} ${x + 8} 104Z" fill="url(#sa-orb-fire)"/>` +
          `<path d="M${x - 3.5} 104 Q${x - 2} ${104 - h * 0.35} ${x} ${104 - h * 0.65} Q${x + 2} ${104 - h * 0.35} ${x + 3.5} 104Z" fill="#fff4b0" opacity=".85"/>`
        );
      }).join("") +
      `<path d="M126 30 L104 42" stroke="#cfe8ff" stroke-width="3" stroke-linecap="round" opacity=".8" stroke-dasharray="4 4"/>` +
      `<circle cx="98" cy="46" r="6" fill="#ffd166" opacity=".9"/>` +
      sparks(
        [
          [98, 46, 2.2],
          [24, 24, 1.3],
          [60, 16, 1.2],
        ],
        F.accent[2],
      ),
  },
  "Chestnut Storm": {
    el: "fire",
    draw: () =>
      // Burning chestnuts raining onto a wide, glowing target.
      floorGlow("fire", 64, 98, 58, 18) +
      `<ellipse cx="64" cy="98" rx="52" ry="15" fill="none" stroke="${F.accent[2]}" stroke-width="2.2"/>` +
      `<ellipse cx="64" cy="98" rx="34" ry="9" fill="none" stroke="${F.accent[1]}" stroke-width="1.6" stroke-dasharray="4 4"/>` +
      [
        [34, 34, 0.85],
        [74, 22, 0.95],
        [98, 52, 0.8],
        [54, 66, 1],
      ]
        .map(
          ([x, y, s]) =>
            `<path d="M${x} ${y} L${x + 30 * s} ${y - 34 * s}" stroke="url(#sa-diag-fire)" stroke-width="${n(9 * s)}" stroke-linecap="round" opacity=".6"/>` +
            halo("fire", x, y, 18 * s) +
            chestnut(x, y, s, 220),
        )
        .join("") +
      [
        [30, 96],
        [96, 100],
      ]
        .map(
          ([x, y]) =>
            `<path d="M${x} ${y} q-5 -9 1 -15 q2 6 6 6 q0 -6 4 -9 q4 10 -2 18Z" fill="url(#sa-up-fire)"/>`,
        )
        .join("") +
      sparks(
        [
          [112, 24, 1.5],
          [16, 64, 1.3],
          [112, 80, 1.3],
        ],
        F.accent[2],
      ),
  },

  // Glacelle · Water (frost)
  "Rime Shard": {
    el: "water",
    draw: () =>
      `<path d="M16 104 L80 50" stroke="url(#sa-diag-water)" stroke-width="10" stroke-linecap="round" opacity=".45"/>` +
      halo("water", 88, 42, 28) +
      // A slim ice shard, frost glittering in its wake.
      `<path d="M66 64 L80 40 L106 24 L92 50Z" fill="url(#sa-orb-water)"/>` +
      `<path d="M66 64 L106 24 M80 40 L92 50" stroke="#fff" stroke-width="1.6" fill="none" opacity=".85"/>` +
      `<path d="M66 64 L80 40 L106 24 L92 50Z" fill="none" stroke="${W.accent[2]}" stroke-width="1.6"/>` +
      flake(42, 82, 6, W.accent[2], 1.4) +
      flake(28, 96, 4, W.accent[2], 1.2) +
      flake(58, 74, 3.5, "#fff", 1.1) +
      glint(104, 26, 7, "#fff") +
      sparks(
        [
          [112, 60, 1.4],
          [70, 22, 1.2],
          [24, 58, 1.2],
        ],
        W.accent[2],
      ),
  },
  Hailstone: {
    el: "water",
    draw: () =>
      // A heavy, faceted hailstone dropping in, frost spreading where it lands.
      floorGlow("water", 72, 104, 44, 12) +
      `<ellipse cx="72" cy="104" rx="34" ry="8" fill="none" stroke="${W.accent[2]}" stroke-width="2" stroke-dasharray="4 4"/>` +
      [
        [20, 10, 52, 40],
        [36, 6, 62, 32],
        [8, 30, 44, 54],
      ]
        .map(([x0, y0, x1, y1], i) =>
          glow(
            `M${x0} ${y0} L${x1} ${y1}`,
            i ? W.accent[2] : "#fff",
            i ? 2 : 2.6,
            W.accent[1],
          ),
        )
        .join("") +
      halo("water", 72, 64, 40) +
      `<circle cx="72" cy="64" r="26" fill="url(#sa-orb-water)"/>` +
      `<path d="M72 38 L60 52 L66 70 L84 72 L90 54Z M60 52 L48 60 M66 70 L58 86 M84 72 L92 84 M90 54 L98 60 M72 38 L84 40" fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round" opacity=".6"/>` +
      `<circle cx="72" cy="64" r="26" fill="none" stroke="${W.accent[2]}" stroke-width="2"/>` +
      `<ellipse cx="62" cy="52" rx="7" ry="4" fill="#fff" opacity=".6" transform="rotate(-35 62 52)"/>` +
      flake(26, 92, 6, W.accent[2], 1.4) +
      flake(112, 96, 5, W.accent[2], 1.3) +
      sparks(
        [
          [112, 30, 1.4],
          [104, 52, 1.2],
        ],
        W.accent[2],
      ),
  },
  "Frost Bloom": {
    el: "water",
    draw: () =>
      // An ice flower blooming on the ground, crystals shooting up to freeze.
      floorGlow("water", 64, 90, 58, 22) +
      `<g transform="translate(64 90) scale(1 .4)">` +
      [0, 1, 2, 3, 4, 5]
        .map(
          (k) =>
            `<path d="M0 0 Q14 -22 0 -48 Q-14 -22 0 0Z" fill="${k % 2 ? W.accent[1] : W.accent[2]}" opacity=".85" transform="rotate(${k * 60 + 30})"/>`,
        )
        .join("") +
      `<circle r="50" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 6" opacity=".7"/></g>` +
      halo("water", 64, 64, 40) +
      [
        [64, 24, 9, 92],
        [46, 46, 7, 92],
        [82, 42, 7, 92],
      ]
        .map(
          ([x, top, w, base]) =>
            `<path d="M${x - w} ${base} L${x - w} ${top + w * 1.6} L${x} ${top} L${x + w} ${top + w * 1.6} L${x + w} ${base}Z" fill="url(#sa-orb-water)" stroke="${W.accent[2]}" stroke-width="1.6" stroke-linejoin="round"/>` +
            `<path d="M${x} ${top} V${base}" stroke="#fff" stroke-width="1.4" opacity=".7"/>`,
        )
        .join("") +
      glint(64, 24, 8, "#fff") +
      flake(22, 54, 6, W.accent[2], 1.4) +
      flake(106, 50, 6, W.accent[2], 1.4) +
      sparks(
        [
          [30, 24, 1.3],
          [100, 22, 1.3],
        ],
        W.accent[2],
      ),
  },
  "Frost Breath": {
    el: "water",
    draw: () =>
      // A freezing cone of breath, snowflakes swirling in it.
      `<path d="M16 64 L120 22 Q132 64 120 106Z" fill="url(#sa-glow-water)"/>` +
      `<path d="M18 64 L116 32 Q124 64 116 96Z" fill="${W.accent[1]}" opacity=".25"/>` +
      `<g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".55"><path d="M26 62 Q50 50 70 54 T112 44"/><path d="M28 68 Q54 78 76 72 T114 84"/></g>` +
      halo("water", 20, 64, 22) +
      `<circle cx="20" cy="64" r="8" fill="url(#sa-core-water)"/>` +
      flake(62, 62, 9, "#fff", 2) +
      flake(94, 44, 8, W.accent[2], 1.8) +
      flake(98, 84, 7, W.accent[2], 1.6) +
      flake(80, 66, 4.5, W.accent[2], 1.3) +
      flake(44, 76, 4, W.accent[2], 1.2) +
      sparks(
        [
          [112, 62, 1.5],
          [70, 34, 1.2],
          [66, 96, 1.2],
        ],
        W.accent[2],
      ),
  },
  Whiteout: {
    el: "water",
    draw: () =>
      // A blizzard cloud pouring snow onto frozen ground.
      floorGlow("water", 64, 100, 56, 16) +
      `<ellipse cx="64" cy="100" rx="46" ry="12" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/>` +
      glow(
        `M30 100 L44 96 L52 104 M76 98 L88 104 L100 98`,
        W.accent[2],
        1.6,
        W.accent[1],
      ) +
      `<g stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".6"><path d="M30 52 L18 82"/><path d="M50 54 L36 92"/><path d="M72 54 L58 94"/><path d="M94 52 L82 86"/><path d="M110 52 L102 72"/></g>` +
      `<path d="M20 46 Q14 30 30 28 Q34 14 50 18 Q60 6 76 14 Q92 8 98 22 Q114 22 112 38 Q118 50 104 52 H28 Q18 52 20 46Z" fill="#e8f8ff"/>` +
      `<path d="M20 46 Q30 42 40 46 Q52 40 64 46 Q78 40 90 46 Q102 42 110 46 Q114 52 104 52 H28 Q18 52 20 46Z" fill="${W.accent[1]}" opacity=".5"/>` +
      flake(44, 74, 7, "#fff", 1.8) +
      flake(80, 70, 6, W.accent[2], 1.6) +
      flake(66, 86, 5, "#fff", 1.4) +
      flake(26, 92, 4.5, W.accent[2], 1.3) +
      flake(104, 84, 4.5, W.accent[2], 1.3) +
      sparks(
        [
          [12, 64, 1.3],
          [118, 64, 1.3],
        ],
        W.accent[2],
      ),
  },

  // Halcyra · Aura
  "Aura Quill": {
    el: "aura",
    draw: () =>
      `<path d="M14 106 L76 52" stroke="url(#sa-diag-aura)" stroke-width="12" stroke-linecap="round" opacity=".5"/>` +
      glow(`M20 82 L46 60 M40 104 L64 84`, A.accent[2], 1.6, A.accent[1]) +
      halo("aura", 84, 46, 34) +
      // A feather of aura loosed like an arrow.
      quill(80, 50, 1.25, 45) +
      glint(100, 28, 8, "#fff") +
      sparks(
        [
          [112, 62, 1.5],
          [62, 22, 1.3],
          [22, 50, 1.2],
        ],
        A.accent[2],
      ),
  },
  "Pinning Quill": {
    el: "aura",
    draw: () =>
      // A heavy quill driven into the ground, pinning the spot in place.
      floorGlow("aura", 64, 96, 54, 16) +
      `<ellipse cx="64" cy="96" rx="40" ry="11" fill="none" stroke="${A.accent[2]}" stroke-width="2.2"/>` +
      `<ellipse cx="64" cy="96" rx="24" ry="6" fill="none" stroke="${A.accent[1]}" stroke-width="1.6" stroke-dasharray="4 4"/>` +
      glow(
        `M64 96 L44 92 L30 96 M64 96 L80 104 M64 96 L86 90 L100 92`,
        A.accent[2],
        1.8,
        A.accent[1],
      ) +
      halo("aura", 56, 56, 40) +
      quill(52, 50, 1.55, 145) +
      chevron(24, 64, 6, 90, A.accent[2], 3) +
      chevron(24, 52, 6, 90, A.accent[1], 3, 0.6) +
      chevron(104, 64, 6, 90, A.accent[2], 3) +
      chevron(104, 52, 6, 90, A.accent[1], 3, 0.6) +
      sparks(
        [
          [96, 24, 1.4],
          [20, 30, 1.3],
          [112, 108, 1.2],
        ],
        A.accent[2],
      ),
  },
  "Focus Shot": {
    el: "aura",
    draw: () =>
      // Crosshairs locked on, a beam punching straight through them.
      `<path d="M8 104 L120 24" stroke="${A.accent[1]}" stroke-width="16" stroke-linecap="round" opacity=".25"/>` +
      glow(`M10 102 L118 26`, "#fff", 4, A.accent[1]) +
      halo("aura", 64, 64, 30) +
      `<circle cx="64" cy="64" r="32" fill="none" stroke="${A.accent[2]}" stroke-width="3"/>` +
      `<circle cx="64" cy="64" r="18" fill="none" stroke="${A.accent[1]}" stroke-width="2" stroke-dasharray="4 4"/>` +
      `<path d="M64 20 V40 M64 88 V108 M20 64 H40 M88 64 H108" stroke="${A.hot}" stroke-width="3.4" stroke-linecap="round"/>` +
      `<circle cx="64" cy="64" r="4.5" fill="#fff"/>` +
      halo("aura", 14, 100, 16) +
      `<circle cx="14" cy="100" r="6" fill="url(#sa-core-aura)"/>` +
      sparks(
        [
          [108, 92, 1.5],
          [24, 26, 1.3],
          [100, 16, 1.2],
        ],
        A.accent[2],
      ),
  },
  "Halcyon Rewind": {
    el: "aura",
    draw: () =>
      // Halcyra dives back along a dotted loop from where it is (a fading
      // ghost) to where it was two seconds ago; a little clock runs backward.
      halo("aura", 36, 82, 26) +
      `<path d="M100 48 Q118 74 90 94 Q62 110 44 90" fill="none" stroke="${A.hot}" stroke-width="3" stroke-dasharray="5 5" stroke-linecap="round"/>` +
      `<path d="M54 86 L44 90 L50 99" fill="none" stroke="${A.hot}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>` +
      kingfisher(94, 40, 0.75, true) +
      kingfisher(30, 80, 0.85) +
      `<circle cx="112" cy="18" r="9" fill="none" stroke="${A.accent[2]}" stroke-width="2" opacity=".75"/>` +
      `<path d="M112 12 V18 L107 21" fill="none" stroke="${A.accent[2]}" stroke-width="2" stroke-linecap="round" opacity=".8"/>` +
      plus(64, 30, 7, "#7dffb0", 0.9) +
      sparks(
        [
          [18, 30, 1.4],
          [116, 106, 1.3],
        ],
        A.accent[2],
      ),
  },
  "Skyline Lance": {
    el: "aura",
    draw: () =>
      // A court-wide lance of aura over the horizon.
      `<path d="M0 98 L22 88 L34 94 L52 84 L70 92 L88 82 L104 90 L128 84 V128 H0Z" fill="${A.bg[2]}"/>` +
      `<path d="M0 98 L22 88 L34 94 L52 84 L70 92 L88 82 L104 90 L128 84" fill="none" stroke="${A.accent[1]}" stroke-width="1.6" opacity=".7"/>` +
      `<path d="M0 34 H128 V78 H0Z" fill="url(#sa-glow-aura)"/>` +
      `<path d="M10 44 H104 L124 56 L104 68 H10Z" fill="${A.accent[1]}"/>` +
      `<path d="M10 50 H104 L116 56 L104 62 H10Z" fill="${A.accent[2]}"/>` +
      `<path d="M10 54.5 H108 L112 56 L108 57.5 H10Z" fill="#fff"/>` +
      [40, 66, 92]
        .map(
          (x, i) =>
            `<ellipse cx="${x}" cy="56" rx="${4 + i}" ry="${18 + i * 2}" fill="none" stroke="${A.accent[2]}" stroke-width="1.6" opacity="${0.5 + i * 0.15}"/>`,
        )
        .join("") +
      halo("aura", 14, 56, 26) +
      `<circle cx="14" cy="56" r="12" fill="url(#sa-core-aura)"/>` +
      `<path d="M0 108 H128" stroke="${A.accent[1]}" stroke-width="1.4" opacity=".35"/>` +
      sparks(
        [
          [30, 22, 1.4],
          [86, 18, 1.4],
          [112, 30, 1.2],
          [60, 112, 1.2],
        ],
        A.accent[2],
      ),
  },

  // Sunbara · Light
  Sunseed: {
    el: "light",
    draw: () =>
      `<path d="M16 104 Q48 88 76 56" stroke="url(#sa-diag-light)" stroke-width="9" fill="none" stroke-linecap="round" opacity=".5"/>` +
      halo("light", 84, 46, 36) +
      // A warm seed of sunlight with a fresh sprout.
      [0, 1, 2, 3, 4, 5, 6, 7]
        .map((k) => {
          const a = (k / 8) * Math.PI * 2;
          return `<path d="M${n(84 + Math.cos(a) * 20)} ${n(48 + Math.sin(a) * 20)} L${n(84 + Math.cos(a) * 28)} ${n(48 + Math.sin(a) * 28)}" stroke="#ffe066" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>`;
        })
        .join("") +
      `<g transform="rotate(40 84 48)"><path d="M84 34 Q96 46 92 58 Q88 64 84 64 Q80 64 76 58 Q72 46 84 34Z" fill="#ffd36b" stroke="#fff6c2" stroke-width="1.6"/><path d="M84 40 Q88 50 86 60" fill="none" stroke="#e8a030" stroke-width="1.6" stroke-linecap="round"/></g>` +
      `<path d="M78 38 Q72 26 62 26 Q66 36 78 38Z" fill="${L.accent[1]}" stroke="${L.accent[2]}" stroke-width="1"/>` +
      sparks(
        [
          [36, 88, 1.8],
          [50, 78, 1.5],
          [108, 76, 1.4],
          [104, 20, 1.3],
        ],
        L.accent[2],
      ),
  },
  "Yuzu Toss": {
    el: "light",
    draw: () =>
      // A glowing yuzu bursting in a spray of juice.
      `<path d="M14 106 Q24 70 56 58" fill="none" stroke="url(#sa-diag-light)" stroke-width="7" stroke-linecap="round" opacity=".5"/>` +
      halo("light", 74, 54, 50) +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        .map((k) => {
          const a = (k / 10) * Math.PI * 2 + 0.2,
            r = k % 2 ? 40 : 48;
          return (
            `<path d="M${n(74 + Math.cos(a) * 26)} ${n(54 + Math.sin(a) * 26)} L${n(74 + Math.cos(a) * r)} ${n(54 + Math.sin(a) * r)}" stroke="${k % 2 ? "#ffe066" : L.accent[2]}" stroke-width="3" stroke-linecap="round"/>` +
            `<circle cx="${n(74 + Math.cos(a) * (r + 5))}" cy="${n(54 + Math.sin(a) * (r + 5))}" r="${k % 2 ? 2 : 2.8}" fill="#ffd34a"/>`
          );
        })
        .join("") +
      yuzu(74, 56, 19) +
      sparks(
        [
          [20, 30, 1.3],
          [24, 64, 1.2],
        ],
        L.accent[2],
      ),
  },
  "Warm Spring": {
    el: "light",
    draw: () =>
      // A steaming spring with a yuzu bobbing in it; healing rises.
      floorGlow("light", 64, 88, 58, 24) +
      `<ellipse cx="64" cy="88" rx="48" ry="19" fill="#4a3a2a"/>` +
      `<ellipse cx="64" cy="86" rx="42" ry="15" fill="#2fbfa6"/>` +
      `<ellipse cx="64" cy="84" rx="34" ry="10" fill="#7fe8d0" opacity=".55"/>` +
      [
        [22, 90, 6],
        [32, 102, 6],
        [52, 106, 6],
        [76, 106, 6],
        [96, 102, 6],
        [106, 90, 6],
        [24, 76, 5],
        [104, 76, 5],
      ]
        .map(
          ([x, y, r]) =>
            `<ellipse cx="${x}" cy="${y}" rx="${r + 2}" ry="${r - 1}" fill="#8f7a64" stroke="#c9b293" stroke-width="1.2"/>`,
        )
        .join("") +
      `<g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"><path d="M44 74 q-6 -8 0 -16 q6 -8 0 -16"/><path d="M64 70 q-6 -8 0 -16 q6 -8 0 -16 q-6 -8 0 -14"/><path d="M86 74 q-6 -8 0 -16 q6 -8 0 -16"/></g>` +
      yuzu(78, 82, 9) +
      `<path d="M66 88 Q78 94 90 88" fill="none" stroke="#bff6ec" stroke-width="1.6" stroke-linecap="round"/>` +
      plus(24, 38, 7, "#7dffb0") +
      plus(104, 30, 6, "#7dffb0", 0.85) +
      plus(100, 56, 4, "#7dffb0", 0.7),
  },
  Daybreak: {
    el: "light",
    draw: () =>
      // The sun breaking over the horizon in a stunning flash.
      halo("light", 64, 80, 58) +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        .map((k) => {
          const a = Math.PI + (k / 10) * Math.PI,
            r = k % 2 ? 44 : 56;
          return `<path d="M${n(64 + Math.cos(a - 0.06) * 30)} ${n(80 + Math.sin(a - 0.06) * 30)} L${n(64 + Math.cos(a) * r)} ${n(80 + Math.sin(a) * r)} L${n(64 + Math.cos(a + 0.06) * 30)} ${n(80 + Math.sin(a + 0.06) * 30)}Z" fill="${k % 2 ? L.accent[1] : "#ffe066"}"/>`;
        })
        .join("") +
      `<path d="M36 80 A28 28 0 0 1 92 80Z" fill="url(#sa-core-light)"/>` +
      `<path d="M40 80 A24 24 0 0 1 88 80Z" fill="#fff6c2"/>` +
      `<path d="M6 80 H122" stroke="#fff" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M0 82 H128 V128 H0Z" fill="${L.bg[2]}" opacity=".7"/>` +
      `<g stroke="#ffe066" stroke-width="2" stroke-linecap="round" opacity=".6"><path d="M44 90 H84"/><path d="M52 98 H76"/><path d="M58 106 H70"/></g>` +
      star(24, 42, 6, "#fff6c2") +
      star(104, 42, 6, "#fff6c2") +
      star(64, 16, 5, "#fff6c2"),
  },
  Sanctuary: {
    el: "light",
    draw: () =>
      // A sunny glade under a dome of light, healing drifting up.
      floorGlow("light", 64, 94, 58, 20) +
      `<ellipse cx="64" cy="94" rx="50" ry="15" fill="#1f5a3c"/>` +
      `<ellipse cx="64" cy="94" rx="50" ry="15" fill="none" stroke="${L.accent[2]}" stroke-width="2.2"/>` +
      `<path d="M14 94 A50 64 0 0 1 114 94" fill="url(#sa-glow-light)" opacity=".7"/>` +
      `<path d="M14 94 A50 64 0 0 1 114 94" fill="none" stroke="${L.accent[2]}" stroke-width="2" stroke-dasharray="5 5" opacity=".8"/>` +
      [
        [30, 96],
        [48, 104],
        [80, 104],
        [98, 96],
        [64, 86],
      ]
        .map(
          ([x, y]) =>
            `<path d="M${x - 2} ${y} Q${x - 4} ${y - 6} ${x - 8} ${y - 10} M${x} ${y} Q${x} ${y - 8} ${x + 1} ${y - 14} M${x + 2} ${y} Q${x + 4} ${y - 6} ${x + 8} ${y - 9}" fill="none" stroke="${L.accent[1]}" stroke-width="2.4" stroke-linecap="round"/>`,
        )
        .join("") +
      `<circle cx="40" cy="84" r="3" fill="#ffe066"/><circle cx="90" cy="86" r="3" fill="#fff6c2"/>` +
      halo("light", 64, 30, 22) +
      `<circle cx="64" cy="30" r="9" fill="#ffe066"/><circle cx="64" cy="30" r="6" fill="#fff6c2"/>` +
      plus(40, 60, 7, "#7dffb0") +
      plus(88, 54, 8, "#7dffb0") +
      plus(64, 70, 5, "#7dffb0", 0.8),
  },

  // Astrabun · Psychic
  "Mallet Bop": {
    el: "psychic",
    draw: () =>
      // A mochi mallet swung down in a bonk.
      `<g fill="none" stroke="${P.accent[2]}" stroke-width="2.4" stroke-linecap="round" opacity=".55"><path d="M30 34 Q54 14 84 22"/><path d="M24 50 Q44 30 70 30"/></g>` +
      halo("psychic", 100, 84, 26) +
      [0, 1, 2, 3, 4, 5, 6]
        .map((k) => {
          const a = (k / 7) * Math.PI * 2 + 0.3;
          return `<path d="M${n(100 + Math.cos(a) * 10)} ${n(86 + Math.sin(a) * 10)} L${n(100 + Math.cos(a) * 22)} ${n(86 + Math.sin(a) * 22)}" stroke="${P.hot}" stroke-width="2.6" stroke-linecap="round"/>`;
        })
        .join("") +
      mallet(76, 62, 1.15, 45) +
      glint(100, 86, 8, "#fff") +
      sparks(
        [
          [112, 40, 1.4],
          [22, 84, 1.3],
          [58, 110, 1.2],
        ],
        P.accent[2],
      ),
  },
  "Moon Hop": {
    el: "psychic",
    draw: () =>
      // A blink trail from a fading ring to the moon rabbit landing.
      `<ellipse cx="28" cy="98" rx="16" ry="5" fill="none" stroke="${P.accent[2]}" stroke-width="2" stroke-dasharray="3 4" opacity=".7"/>` +
      bunny(28, 88, 0.95, P.accent[1], 0.35) +
      [
        [36, 78, 2],
        [44, 66, 2.6],
        [54, 56, 3.2],
        [64, 50, 3.8],
      ]
        .map(([x, y, r]) => glint(x, y, r * 1.6, P.accent[2]))
        .join("") +
      halo("psychic", 88, 48, 40) +
      crescent(86, 46, 28, "#ffe9a3") +
      bunny(96, 50, 1.25, "#fffbe6") +
      `<ellipse cx="94" cy="94" rx="26" ry="7" fill="url(#sa-glow-psychic)"/>` +
      `<ellipse cx="94" cy="94" rx="20" ry="5" fill="none" stroke="${P.accent[2]}" stroke-width="2"/>` +
      sparks(
        [
          [112, 18, 1.4],
          [20, 30, 1.3],
          [118, 70, 1.2],
        ],
        P.accent[2],
      ),
  },
  "Mochi Pound": {
    el: "psychic",
    draw: () =>
      // An overhead pound flattening a mochi; stars spin.
      floorGlow("psychic", 64, 98, 50, 14) +
      `<g fill="none" stroke="${P.accent[2]}" stroke-width="2.4" stroke-linecap="round" opacity=".55"><path d="M30 20 Q40 6 56 4"/><path d="M98 20 Q88 6 72 4"/></g>` +
      `<path d="M30 96 Q28 80 46 78 Q64 74 82 78 Q100 80 98 96 Q98 102 64 102 Q30 102 30 96Z" fill="#fff6f0" stroke="${P.accent[2]}" stroke-width="1.6"/>` +
      `<ellipse cx="50" cy="90" rx="5" ry="2.4" fill="#ffb3d6" opacity=".8"/><ellipse cx="78" cy="90" rx="5" ry="2.4" fill="#ffb3d6" opacity=".8"/>` +
      `<path d="M58 88 Q64 92 70 88" fill="none" stroke="${P.accent[0]}" stroke-width="1.6" stroke-linecap="round"/>` +
      `<g stroke="${P.hot}" stroke-width="2.4" stroke-linecap="round"><path d="M22 80 L12 74"/><path d="M106 80 L116 74"/><path d="M24 92 L12 92"/><path d="M104 92 L116 92"/></g>` +
      mallet(64, 56, 1.2, 180) +
      star(32, 60, 5.5, "#ffe9a3") +
      star(96, 60, 5.5, "#ffe9a3") +
      star(108, 44, 4, "#ffe9a3") +
      [0, 1, 2].map((k) => `<circle cx="${50 + k * 14}" cy="118" r="${2.6 + k * 1.3}" fill="#fff0f5" opacity="${0.6 + k * 0.2}"/>`).join(""),
  },
  "Moon Gravity": {
    el: "psychic",
    draw: () =>
      // A little moon bearing down on a patch of heavy gravity.
      floorGlow("psychic", 64, 92, 58, 22) +
      [0, 1, 2]
        .map(
          (k) =>
            `<ellipse cx="64" cy="92" rx="${48 - k * 14}" ry="${16 - k * 4.6}" fill="none" stroke="${k ? P.accent[1] : P.accent[2]}" stroke-width="${2.6 - k * 0.5}" ${k ? 'stroke-dasharray="4 4"' : ""}/>`,
        )
        .join("") +
      [36, 64, 92]
        .map(
          (x, i) =>
            chevron(x, i === 1 ? 72 : 76, 7, 90, P.accent[2], 3.4) +
            chevron(x, i === 1 ? 60 : 64, 7, 90, P.accent[1], 3, 0.6),
        )
        .join("") +
      halo("psychic", 64, 30, 28) +
      `<circle cx="64" cy="30" r="15" fill="#ffe9a3"/>` +
      `<circle cx="58" cy="26" r="3.6" fill="#e6c870"/><circle cx="70" cy="34" r="2.6" fill="#e6c870"/><circle cx="66" cy="22" r="1.8" fill="#e6c870"/>` +
      `<circle cx="64" cy="30" r="15" fill="none" stroke="#fffbe6" stroke-width="1.6"/>` +
      sparks(
        [
          [20, 26, 1.4],
          [108, 24, 1.4],
          [16, 64, 1.2],
          [112, 64, 1.2],
        ],
        P.accent[2],
      ),
  },
  "Full Moon": {
    el: "psychic",
    draw: () =>
      // The full moon, its rabbit on its face, crashing down in a shockwave.
      floorGlow("psychic", 64, 102, 60, 18) +
      [0, 1, 2]
        .map(
          (k) =>
            `<ellipse cx="64" cy="102" rx="${30 + k * 14}" ry="${8 + k * 3.5}" fill="none" stroke="${k ? P.accent[1] : P.hot}" stroke-width="${3 - k * 0.7}" opacity="${1 - k * 0.25}"/>`,
        )
        .join("") +
      `<g stroke="${P.accent[2]}" stroke-width="2.4" stroke-linecap="round" opacity=".6"><path d="M36 8 V22"/><path d="M50 2 V14"/><path d="M78 2 V14"/><path d="M92 8 V22"/></g>` +
      halo("psychic", 64, 54, 50) +
      `<circle cx="64" cy="54" r="32" fill="#ffe9a3"/>` +
      `<circle cx="64" cy="54" r="32" fill="url(#sa-glow-psychic)" opacity=".35"/>` +
      bunny(64, 60, 1.8, "#e0c26e") +
      `<circle cx="46" cy="38" r="4" fill="#ecd08a"/><circle cx="84" cy="70" r="3" fill="#ecd08a"/><circle cx="82" cy="36" r="2.4" fill="#ecd08a"/>` +
      `<circle cx="64" cy="54" r="32" fill="none" stroke="#fffbe6" stroke-width="2"/>` +
      rock(20, 90, 5, P.accent[0], P.accent[2], 1.2) +
      rock(110, 88, 6, P.accent[0], P.accent[2], 1.2),
  },

  // Wombolder · Earth
  "Rump Bump": {
    el: "earth",
    draw: () =>
      // A wombat shoving sideways with its boulder-hard rump.
      floorGlow("earth", 56, 100, 50, 12) +
      `<path d="M28 96 v8 h8 v-8 M56 96 v8 h8 v-8" fill="#6b4a2c" stroke="#3e2a1a" stroke-width="1.4"/>` +
      `<ellipse cx="46" cy="72" rx="34" ry="26" fill="#b08a62" stroke="#3e2a1a" stroke-width="1.8"/>` +
      `<path d="M20 80 Q46 98 74 84" fill="none" stroke="#efdcc0" stroke-width="3" stroke-linecap="round" opacity=".5"/>` +
      `<path d="M24 52 Q20 40 28 40 Q32 46 30 54Z" fill="#8a6440" stroke="#3e2a1a" stroke-width="1.4"/>` +
      `<circle cx="20" cy="64" r="2.6" fill="#1a120a"/><ellipse cx="10" cy="74" rx="5" ry="4" fill="#3e2a1a"/>` +
      `<ellipse cx="76" cy="70" rx="13" ry="25" fill="#8b8f99" stroke="#c9ccd4" stroke-width="2"/>` +
      `<path d="M72 50 Q80 60 76 70 Q72 80 78 90" fill="none" stroke="#4b4e57" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="72" cy="58" rx="3" ry="7" fill="#fff" opacity=".35"/>` +
      halo("earth", 98, 70, 24) +
      [-50, -25, 0, 25, 50]
        .map((deg) => {
          const a = (deg * Math.PI) / 180;
          return `<path d="M${n(94 + Math.cos(a) * 8)} ${n(70 + Math.sin(a) * 8)} L${n(94 + Math.cos(a) * 26)} ${n(70 + Math.sin(a) * 26)}" stroke="${R.hot}" stroke-width="3" stroke-linecap="round"/>`;
        })
        .join("") +
      `<g fill="none" stroke="${R.accent[2]}" stroke-width="2.4" stroke-linecap="round" opacity=".7"><path d="M108 40 Q124 70 108 100"/></g>` +
      sparks(
        [
          [104, 24, 1.4],
          [30, 24, 1.2],
          [118, 112, 1.3],
        ],
        R.accent[2],
      ),
  },
  "Burrow Rush": {
    el: "earth",
    draw: () =>
      // The wombat charging up out of its tunnel, dirt flying.
      `<g stroke="${R.accent[2]}" stroke-width="2.4" stroke-linecap="round" opacity=".55"><path d="M6 44 H34"/><path d="M14 56 H40"/><path d="M4 32 H26"/></g>` +
      `<path d="M0 100 H128 V128 H0Z" fill="${R.bg[2]}"/><path d="M0 100 H128" stroke="${R.accent[0]}" stroke-width="2"/>` +
      `<path d="M2 102 Q12 72 40 72 Q60 74 66 102Z" fill="#5a3a1e" stroke="${R.accent[1]}" stroke-width="2"/>` +
      `<ellipse cx="36" cy="92" rx="14" ry="7" fill="#1a1008"/>` +
      `<ellipse cx="54" cy="80" rx="22" ry="16" fill="#9a7650" stroke="#3e2a1a" stroke-width="1.6"/>` +
      `<ellipse cx="78" cy="66" rx="26" ry="20" fill="#b08a62" stroke="#3e2a1a" stroke-width="1.8"/>` +
      `<path d="M62 50 Q60 36 70 38 Q72 46 70 52Z" fill="#8a6440" stroke="#3e2a1a" stroke-width="1.4"/>` +
      `<ellipse cx="100" cy="72" rx="12" ry="10" fill="#c9a27a" stroke="#3e2a1a" stroke-width="1.4"/>` +
      `<ellipse cx="106" cy="68" rx="7" ry="5.4" fill="#3e2a1a"/><ellipse cx="104" cy="66" rx="2.4" ry="1.4" fill="#fff" opacity=".5"/>` +
      `<circle cx="86" cy="58" r="3" fill="#1a120a"/><circle cx="87" cy="57" r="1" fill="#fff"/>` +
      `<path d="M84 84 Q92 92 98 90 M88 84 l2 8 M93 85 l2 7" fill="none" stroke="#efdcc0" stroke-width="2" stroke-linecap="round"/>` +
      rock(30, 58, 5, R.accent[0], R.accent[2], 1.2) +
      rock(48, 46, 4, R.accent[1], R.accent[2], 1.2) +
      rock(14, 74, 4, R.accent[0], R.accent[2], 1.2) +
      `<g fill="${R.accent[2]}" opacity=".45"><circle cx="70" cy="104" r="6"/><circle cx="84" cy="108" r="4"/><circle cx="58" cy="110" r="4"/></g>` +
      sparks(
        [
          [116, 40, 1.5],
          [118, 92, 1.3],
          [96, 22, 1.2],
        ],
        R.accent[2],
      ),
  },
  "Bush Boomerang": {
    el: "earth",
    draw: () =>
      // A wooden boomerang spinning out on a curved path that loops home.
      `<path d="M22 100 Q64 10 108 60 Q86 104 30 104" fill="none" stroke="${R.accent[2]}" stroke-width="2.6" stroke-dasharray="5 5" stroke-linecap="round" opacity=".7"/>` +
      `<path d="M36 98 L26 104 L36 110" fill="none" stroke="${R.accent[2]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>` +
      halo("earth", 84, 40, 26) +
      `<g transform="translate(84 44) rotate(-24)"><path d="M-32 8 Q-16 -16 2 -16 Q18 -14 30 8 Q32 15 25 14 Q14 -3 2 -4 Q-12 -4 -24 14 Q-32 16 -32 8Z" fill="#c98b4a" stroke="#4a2c14" stroke-width="2" stroke-linejoin="round"/><path d="M-26 6 Q-12 -10 2 -11 Q14 -10 24 6" fill="none" stroke="#efdcc0" stroke-width="1.6" stroke-linecap="round" opacity=".75"/><path d="M-6 -12 L-2 -5 M6 -12 L4 -5" stroke="#4a2c14" stroke-width="1.4" opacity=".6"/></g><path d="M50 30 Q60 22 72 24 M100 64 Q108 56 110 46" fill="none" stroke="#efdcc0" stroke-width="2" stroke-linecap="round" opacity=".5"/>` +
      sparks(
        [
          [112, 24, 1.4],
          [20, 40, 1.2],
          [70, 112, 1.2],
        ],
        R.accent[2],
      ),
  },
  "Grudge Thump": {
    el: "earth",
    draw: () =>
      // A heavy thump: a cracked ring in the ground and an angry glare.
      floorGlow("earth", 64, 96, 58, 18) +
      `<ellipse cx="64" cy="96" rx="54" ry="16" fill="none" stroke="#ff6a5a" stroke-width="2.4" stroke-dasharray="6 5"/>` +
      `<path d="M64 96 L40 88 M64 96 L90 86 M64 96 L52 110 M64 96 L84 108" stroke="${R.accent[2]}" stroke-width="2.4" stroke-linecap="round"/>` +
      halo("earth", 64, 62, 30) +
      `<ellipse cx="64" cy="70" rx="26" ry="20" fill="#b08a62" stroke="#3e2a1a" stroke-width="2"/>` +
      `<path d="M50 60 L60 64 M78 60 L68 64" stroke="#3e2a1a" stroke-width="3.4" stroke-linecap="round"/>` +
      `<circle cx="56" cy="68" r="3" fill="#1b1636"/><circle cx="72" cy="68" r="3" fill="#1b1636"/>` +
      `<path d="M58 80 Q64 76 70 80" fill="none" stroke="#3e2a1a" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M96 28 l6 10 l-8 2 l6 10" fill="none" stroke="#ff6a5a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M32 28 l-6 10 l8 2 l-6 10" fill="none" stroke="#ff6a5a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
      sparks(
        [
          [112, 70, 1.3],
          [16, 70, 1.3],
        ],
        R.accent[2],
      ),
  },
  Landslide: {
    el: "earth",
    draw: () =>
      // An unstoppable boulder charge; the ground erupts on impact.
      floorGlow("earth", 84, 98, 46, 14) +
      `<ellipse cx="88" cy="98" rx="34" ry="10" fill="${R.bg[1]}"/>` +
      glow(
        `M88 98 L70 102 L58 98 M88 98 L106 104 M88 98 L104 92`,
        R.accent[2],
        2,
        R.accent[1],
      ) +
      [
        [70, 100, 7, 70],
        [82, 96, 9, 52],
        [98, 98, 8, 60],
        [110, 102, 6, 76],
      ]
        .map(
          ([x, y, w, top]) =>
            `<path d="M${x - w} ${y} L${x - 2} ${top} L${x + w} ${y}Z" fill="${R.accent[0]}" stroke="${R.accent[2]}" stroke-width="1.6" stroke-linejoin="round"/><path d="M${x - 2} ${top} L${x + 2} ${y}" stroke="${R.accent[1]}" stroke-width="1.6"/>`,
        )
        .join("") +
      rock(94, 40, 5, R.accent[1], R.accent[2], 1.2) +
      rock(112, 52, 4, R.accent[0], R.accent[2], 1.2) +
      rock(76, 36, 3.5, R.accent[0], R.accent[2], 1.2) +
      `<g stroke="${R.accent[2]}" stroke-width="2.4" stroke-linecap="round" opacity=".55"><path d="M2 50 H18"/><path d="M4 66 H14"/><path d="M2 82 H18"/></g>` +
      halo("earth", 40, 68, 32) +
      `<circle cx="40" cy="68" r="22" fill="#8b8f99" stroke="#c9ccd4" stroke-width="2"/>` +
      `<path d="M26 56 Q40 48 52 54 M30 80 L42 70 L56 74 M40 48 L42 70" fill="none" stroke="#4b4e57" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M28 60 Q34 50 44 50" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".5"/>` +
      `<path d="M16 84 A28 28 0 0 1 20 50" fill="none" stroke="${R.accent[2]}" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>` +
      sparks(
        [
          [64, 20, 1.3],
          [116, 26, 1.4],
        ],
        R.accent[2],
      ),
  },

  // Shadopus · Shadow
  "Tentacle Lash": {
    el: "shadow",
    draw: () =>
      // A tentacle whipping across in a bright slash.
      glow(`M20 74 Q44 20 104 26`, S.hot, 2.4, S.accent[1]) +
      halo("shadow", 70, 52, 44) +
      tentacle(
        [
          [8, 132],
          [20, 46],
          [110, 6],
          [100, 58],
        ],
        18,
        2,
        "#7b5cff",
        S.accent[2],
        "#e9e0ff",
      ) +
      sparks(
        [
          [112, 76, 1.5],
          [40, 22, 1.2],
          [94, 104, 1.3],
        ],
        S.accent[2],
      ),
  },
  "Ink Jet": {
    el: "shadow",
    draw: () =>
      // A squirt of midnight ink splattering ahead.
      tentacle(
        [
          [10, 104],
          [34, 84],
          [58, 64],
          [86, 46],
        ],
        5,
        22,
        INK,
        INK_RIM,
      ) +
      halo("shadow", 92, 42, 30) +
      `<circle cx="92" cy="42" r="15" fill="none" stroke="${INK_RIM}" stroke-width="7" stroke-opacity=".22"/>` +
      `<circle cx="92" cy="42" r="15" fill="${INK}" stroke="${INK_RIM}" stroke-width="1.8"/>` +
      [
        [110, 30, 4],
        [112, 50, 3],
        [100, 22, 2.6],
        [118, 40, 2],
        [104, 60, 2.4],
      ]
        .map(
          ([x, y, r]) =>
            `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}" stroke="${INK_RIM}" stroke-width="1.4"/>`,
        )
        .join("") +
      `<path d="M84 36 Q88 30 96 32" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/>` +
      `<path d="M30 84 Q50 66 74 54" fill="none" stroke="${INK_RIM}" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>` +
      sparks(
        [
          [24, 40, 1.3],
          [60, 100, 1.2],
          [116, 92, 1.3],
        ],
        S.accent[2],
      ),
  },
  "Ink Strike": {
    el: "shadow",
    draw: () =>
      // A flurry of arms striking one point at once.
      halo("shadow", 98, 62, 30) +
      [
        [
          [-8, 18],
          [36, 14],
          [70, 34],
          [92, 56],
        ],
        [
          [-8, 50],
          [36, 44],
          [64, 56],
          [90, 60],
        ],
        [
          [-8, 84],
          [34, 86],
          [64, 72],
          [90, 64],
        ],
        [
          [-8, 116],
          [40, 112],
          [70, 88],
          [92, 68],
        ],
      ]
        .map((p) =>
          tentacle(
            p as [number, number][],
            14,
            2,
            "#7b5cff",
            S.accent[2],
            "#e9e0ff",
          ),
        )
        .join("") +
      [0, 1, 2, 3, 4, 5, 6, 7]
        .map((k) => {
          const a = (k / 8) * Math.PI * 2;
          return `<path d="M${n(98 + Math.cos(a) * 9)} ${n(62 + Math.sin(a) * 9)} L${n(98 + Math.cos(a) * (k % 2 ? 18 : 26))} ${n(62 + Math.sin(a) * (k % 2 ? 18 : 26))}" stroke="${S.hot}" stroke-width="2.6" stroke-linecap="round"/>`;
        })
        .join("") +
      glint(98, 62, 10, "#fff") +
      sparks(
        [
          [116, 24, 1.4],
          [114, 104, 1.3],
        ],
        S.accent[2],
      ),
  },
  "Ink Cloud": {
    el: "shadow",
    draw: () => {
      // Vanishing into a billow of ink, only the eyes still showing.
      const puffs: [number, number, number][] = [
        [42, 70, 22],
        [68, 54, 26],
        [92, 72, 21],
        [62, 84, 22],
        [28, 88, 14],
        [100, 48, 14],
        [96, 92, 12],
      ];
      return (
        halo("shadow", 64, 68, 56) +
        puffs
          .map(
            ([x, y, r]) =>
              `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${S.accent[1]}" stroke-width="5"/>`,
          )
          .join("") +
        puffs
          .map(
            ([x, y, r]) =>
              `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/>`,
          )
          .join("") +
        `<g fill="none" stroke="${S.accent[0]}" stroke-width="2" stroke-linecap="round"><path d="M40 60 Q48 52 56 58"/><path d="M80 82 Q90 80 92 70"/><path d="M88 46 Q96 44 100 52"/></g>` +
        `<ellipse cx="60" cy="68" rx="5" ry="6.5" fill="${INK_RIM}"/><ellipse cx="78" cy="68" rx="5" ry="6.5" fill="${INK_RIM}"/>` +
        `<ellipse cx="61" cy="69" rx="2" ry="3.6" fill="#fff"/><ellipse cx="79" cy="69" rx="2" ry="3.6" fill="#fff"/>` +
        [
          [18, 40, 3],
          [112, 26, 3.4],
          [116, 108, 2.4],
          [14, 112, 2.6],
        ]
          .map(
            ([x, y, r]) =>
              `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}" stroke="${S.accent[1]}" stroke-width="1.4"/>`,
          )
          .join("") +
        sparks(
          [
            [40, 24, 1.3],
            [86, 18, 1.2],
          ],
          S.accent[2],
        )
      );
    },
  },
  "Kraken Grasp": {
    el: "shadow",
    draw: () => {
      // Every arm rising at once to seize the middle; stars spin.
      const side = (p: number[][]) => [
        p as [number, number][],
        p.map(([x, y]) => [128 - x, y]) as [number, number][],
      ];
      const arms = (ps: [number, number][][], w: number) =>
        ps
          .map((p) => tentacle(p, w, 2, "#7b5cff", S.accent[2], "#e9e0ff"))
          .join("");
      return (
        floorGlow("shadow", 64, 98, 58, 18) +
        `<ellipse cx="64" cy="98" rx="50" ry="14" fill="${S.accent[0]}" fill-opacity=".25" stroke="${S.accent[1]}" stroke-width="2"/>` +
        arms(
          side([
            [44, 92],
            [36, 64],
            [50, 40],
            [58, 52],
          ]),
          10,
        ) +
        arms(
          side([
            [22, 100],
            [8, 60],
            [34, 22],
            [54, 38],
          ]),
          14,
        ) +
        star(64, 62, 7, "#ffe9a3") +
        star(50, 72, 5, "#ffe9a3") +
        star(78, 72, 5, "#ffe9a3") +
        arms(
          side([
            [36, 112],
            [24, 84],
            [44, 70],
            [56, 82],
          ]),
          14,
        ) +
        sparks(
          [
            [64, 18, 1.4],
            [16, 30, 1.2],
            [112, 30, 1.2],
          ],
          S.accent[2],
        ) +
        // Then it is hurled away.
        `<path d="M70 40 Q96 6 120 26" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-dasharray="5 5" opacity=".85"/><path d="M112 20 L121 27 L111 32" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`
      );
    },
  },

  // Pangrove · Nature
  "Scale Swipe": {
    el: "nature",
    draw: () =>
      // A paw of leaf scales sweeping through, claws leaving three slashes.
      halo("nature", 70, 62, 44) +
      [
        [34, 92, -60],
        [40, 70, -35],
        [54, 52, -12],
        [74, 42, 10],
        [96, 44, 35],
      ]
        .map(([x, y, r], i) =>
          leaf(x, y, 1.6 - i * 0.08, r, i % 2 ? N.accent[1] : N.accent[0]),
        )
        .join("") +
      glow("M40 104 Q78 92 104 58", N.hot, 3.2, N.accent[1]) +
      glow("M52 112 Q88 100 112 70", N.hot, 2.6, N.accent[1]) +
      glow("M64 118 Q96 108 118 84", N.hot, 2, N.accent[1]) +
      sparks(
        [
          [108, 30, 1.5],
          [20, 40, 1.2],
          [116, 108, 1.3],
        ],
        N.accent[2],
      ),
  },
  "Tongue Grapple": {
    el: "nature",
    draw: () =>
      // The pangolin zips along its own tongue toward what it caught.
      `<g stroke="${N.accent[2]}" stroke-width="2.6" stroke-linecap="round" opacity=".55"><path d="M2 50 H18"/><path d="M4 66 H22"/><path d="M2 82 H16"/></g>` +
      floorGlow("nature", 64, 104, 56, 12) +
      `<path d="M14 50 Q34 34 52 46 Q64 54 62 66 Q56 80 34 80 Q18 78 14 66Z" fill="#7fcf6a" stroke="#1f4626" stroke-width="1.8"/>` +
      leaf(24, 46, 1.1, -30, "#3f8f4a") +
      leaf(38, 40, 1.1, 0, "#3f8f4a") +
      `<circle cx="40" cy="56" r="4" fill="#1b1636"/><circle cx="39" cy="54.6" r="1.4" fill="#fff"/>` +
      glow("M60 68 Q84 78 104 66", "#ff8fb0", 4.5, "#ffb3c8") +
      `<circle cx="108" cy="64" r="16" fill="none" stroke="${N.accent[2]}" stroke-width="2.4" stroke-dasharray="4 4"/>` +
      `<circle cx="108" cy="64" r="6" fill="#ff8fb0" stroke="#8a2a48" stroke-width="1.6"/>` +
      `<path d="M74 92 L92 92 M86 86 L92 92 L86 98" fill="none" stroke="${N.hot}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
      sparks(
        [
          [112, 24, 1.4],
          [70, 22, 1.2],
          [118, 104, 1.2],
        ],
        N.accent[2],
      ),
  },
  "Scale Shrapnel": {
    el: "nature",
    draw: () =>
      // The armour plates tear off and fly out as a fan of leaf blades.
      halo("nature", 30, 70, 30) +
      `<circle cx="30" cy="70" r="20" fill="#3f8f4a" stroke="#1f4626" stroke-width="2"/>` +
      leaf(24, 64, 1.1, -60, "#7fcf6a") +
      leaf(36, 76, 1.1, 120, "#5daa4f") +
      [-36, -18, 0, 18, 36]
        .map((deg, i) => {
          const a = (deg * Math.PI) / 180,
            d = 70 + (i % 2) * 12,
            x = n(30 + Math.cos(a) * d),
            y = n(70 + Math.sin(a) * d);
          return (
            `<path d="M${n(30 + Math.cos(a) * 26)} ${n(70 + Math.sin(a) * 26)} L${n(30 + Math.cos(a) * (d - 14))} ${n(70 + Math.sin(a) * (d - 14))}" stroke="url(#sa-diag-nature)" stroke-width="3" stroke-linecap="round" opacity=".6"/>` +
            halo("nature", x, y, 10) +
            leaf(x, y, 1.3, deg + 90, i % 2 ? "#c7e88a" : "#7fcf6a")
          );
        })
        .join("") +
      sparks(
        [
          [112, 20, 1.4],
          [16, 30, 1.2],
          [114, 112, 1.3],
        ],
        N.accent[2],
      ),
  },
  "Curl & Roll": {
    el: "nature",
    draw: () =>
      // Curled into a ball of leaf plates, rolling fast; dust behind it.
      `<path d="M0 104 H128 V128 H0Z" fill="${N.bg[2]}"/><path d="M0 104 H128" stroke="${N.accent[0]}" stroke-width="2"/>` +
      `<g fill="${N.accent[1]}" opacity=".35"><circle cx="18" cy="98" r="9"/><circle cx="32" cy="102" r="6"/><circle cx="8" cy="90" r="5"/></g>` +
      `<g stroke="${N.accent[2]}" stroke-width="2.6" stroke-linecap="round" opacity=".55"><path d="M4 56 H34"/><path d="M10 72 H36"/><path d="M2 86 H28"/></g>` +
      halo("nature", 76, 66, 48) +
      `<circle cx="76" cy="66" r="36" fill="#3f8f4a" stroke="#1f4626" stroke-width="2"/>` +
      [
        [76, 38, 10],
        [54, 50, -40],
        [98, 50, 60],
        [50, 74, -100],
        [102, 76, 110],
        [64, 94, -160],
        [90, 94, 160],
        [76, 64, 20],
      ]
        .map(([x, y, r], i) =>
          leaf(x, y, i < 7 ? 1.4 : 1.2, r, i % 2 ? "#7fcf6a" : "#c7e88a"),
        )
        .join("") +
      `<path d="M76 26 A40 40 0 0 1 116 66" fill="none" stroke="${N.hot}" stroke-width="3" stroke-linecap="round" opacity=".7"/>` +
      sparks(
        [
          [118, 22, 1.4],
          [44, 18, 1.2],
          [118, 112, 1.3],
        ],
        N.accent[2],
      ),
  },
  Pinball: {
    el: "nature",
    draw: () =>
      // A ball of leaf plates ricocheting between two walls, faster each time.
      `<path d="M2 8 H14 V120 H2Z M114 8 H126 V120 H114Z" fill="${N.bg[2]}" stroke="${N.accent[0]}" stroke-width="2"/>` +
      glow("M24 108 L104 76 L24 44 L92 16", N.hot, 3, N.accent[1]) +
      [
        [104, 76],
        [24, 44],
      ]
        .map(
          ([x, y]) =>
            `<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="${N.accent[2]}" stroke-width="2.4"/>`,
        )
        .join("") +
      halo("nature", 88, 22, 22) +
      `<circle cx="88" cy="22" r="16" fill="#3f8f4a" stroke="#1f4626" stroke-width="2"/>` +
      leaf(84, 16, 1, -30, "#c7e88a") +
      leaf(94, 26, 1, 150, "#7fcf6a") +
      sparks(
        [
          [104, 76, 2],
          [24, 44, 2],
          [60, 110, 1.3],
        ],
        N.accent[2],
      ),
  },

  // Mossloth · Nature
  "Seed Spit": {
    el: "nature",
    draw: () =>
      // A hard seed flying fast, a puff of moss behind it.
      `<g fill="${N.accent[1]}" opacity=".35"><circle cx="20" cy="88" r="12"/><circle cx="34" cy="98" r="7"/><circle cx="12" cy="104" r="6"/></g>` +
      `<g stroke="url(#sa-diag-nature)" stroke-width="3" stroke-linecap="round" opacity=".7"><path d="M24 80 L70 56"/><path d="M30 92 L72 70"/><path d="M20 70 L58 50"/></g>` +
      halo("nature", 88, 50, 26) +
      seed(88, 50, 2.6, -28) +
      sparks(
        [
          [112, 24, 1.5],
          [114, 80, 1.2],
          [62, 22, 1.2],
        ],
        N.accent[2],
      ),
  },
  Seedling: {
    el: "nature",
    draw: () =>
      // A seed grows in three stages: sprout, bud, bloom.
      floorGlow("nature", 64, 104, 60, 12) +
      [
        [22, 0.7],
        [64, 1],
        [106, 1.3],
      ]
        .map(
          ([x, k]) =>
            `<ellipse cx="${x}" cy="104" rx="${n(14 * k)}" ry="${n(5 * k)}" fill="#6b4526" stroke="#2a1a0e" stroke-width="1.4"/>` +
            `<path d="M${x} 102 L${x} ${n(102 - 26 * k)}" stroke="#3f7a34" stroke-width="${n(3 * k)}" stroke-linecap="round"/>`,
        )
        .join("") +
      leaf(18, 88, 0.9, -50, "#7fcf6a") +
      leaf(26, 88, 0.9, 50, "#3f8f4a") +
      leaf(58, 84, 1.1, -50, "#7fcf6a") +
      leaf(70, 84, 1.1, 50, "#3f8f4a") +
      `<ellipse cx="64" cy="72" rx="5" ry="7" fill="#3f7a34"/><ellipse cx="64" cy="70" rx="3" ry="4" fill="#ff9fc4"/>` +
      leaf(98, 82, 1.2, -50, "#7fcf6a") +
      leaf(114, 82, 1.2, 50, "#3f8f4a") +
      halo("nature", 106, 64, 18) +
      [0, 72, 144, 216, 288]
        .map((d) => {
          const a = (d * Math.PI) / 180;
          return `<ellipse cx="${n(106 + Math.cos(a) * 8)}" cy="${n(64 + Math.sin(a) * 7)}" rx="7" ry="5.4" fill="#ff9fc4" stroke="#b0527a" stroke-width="1"/>`;
        })
        .join("") +
      `<circle cx="106" cy="64" r="4" fill="#ffd166"/>` +
      `<path d="M30 30 Q46 22 58 30 M70 30 Q86 22 98 30" fill="none" stroke="${N.accent[2]}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="3 4"/>` +
      sparks(
        [
          [116, 30, 1.4],
          [12, 40, 1.2],
        ],
        N.accent[2],
      ),
  },
  "Sloth Time": {
    el: "nature",
    draw: () =>
      // A bubble where time crawls: a clock face, slow ripples.
      `<circle cx="64" cy="64" r="52" fill="#c9b6ff" fill-opacity=".18" stroke="#c9b6ff" stroke-width="3"/>` +
      `<circle cx="64" cy="64" r="40" fill="none" stroke="#c9b6ff" stroke-width="1.6" opacity=".5"/>` +
      `<circle cx="64" cy="64" r="28" fill="none" stroke="#c9b6ff" stroke-width="1.2" opacity=".35"/>` +
      Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180,
          r0 = i % 3 ? 44 : 40;
        return `<path d="M${n(64 + Math.cos(a) * r0)} ${n(64 + Math.sin(a) * r0)} L${n(64 + Math.cos(a) * 49)} ${n(64 + Math.sin(a) * 49)}" stroke="#fff" stroke-width="${i % 3 ? 2 : 3}" stroke-linecap="round" opacity=".8"/>`;
      }).join("") +
      `<path d="M64 64 L64 34 M64 64 L86 74" stroke="#fff" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="64" cy="64" r="5" fill="#9bd36a" stroke="#1f4626" stroke-width="1.6"/>` +
      `<path d="M20 22 Q24 14 32 16 M100 110 Q108 108 110 100" fill="none" stroke="#c9b6ff" stroke-width="2.4" stroke-linecap="round"/>` +
      sparks(
        [
          [112, 20, 1.4],
          [16, 108, 1.2],
        ],
        N.accent[2],
      ),
  },
  "Lazy Swap": {
    el: "nature",
    draw: () =>
      // Two spots trade places along a lazy loop of leaves; a sleepy "z".
      floorGlow("nature", 64, 104, 58, 10) +
      `<ellipse cx="28" cy="96" rx="16" ry="5" fill="${N.accent[0]}" fill-opacity=".4"/><ellipse cx="100" cy="96" rx="16" ry="5" fill="${N.accent[0]}" fill-opacity=".4"/>` +
      `<circle cx="28" cy="76" r="14" fill="#9bd36a" stroke="#1f4626" stroke-width="2"/>` +
      `<circle cx="100" cy="76" r="14" fill="#c9b6ff" stroke="#4b3a7a" stroke-width="2"/>` +
      glow("M28 56 Q64 18 100 56", N.hot, 3.4, N.accent[1]) +
      glow("M100 98 Q64 124 28 98", "#c9b6ff", 3, "#e9d7ff") +
      `<path d="M92 48 L100 56 L104 46" fill="none" stroke="${N.hot}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M36 106 L28 98 L24 108" fill="none" stroke="#c9b6ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
      leaf(64, 34, 1.1, 0, "#7fcf6a") +
      `<text x="52" y="78" font-size="16" font-weight="800" fill="#fff" opacity=".85">z</text><text x="64" y="68" font-size="12" font-weight="800" fill="#fff" opacity=".6">z</text>` +
      sparks(
        [
          [112, 22, 1.4],
          [14, 26, 1.2],
        ],
        N.accent[2],
      ),
  },
  Overgrowth: {
    el: "nature",
    draw: () =>
      // Vines erupt all round in a ring, every bloom opening at once.
      floorGlow("nature", 64, 100, 60, 20) +
      `<ellipse cx="64" cy="100" rx="56" ry="16" fill="${N.accent[0]}" fill-opacity=".35" stroke="${N.hot}" stroke-width="2.2"/>` +
      root(
        [
          [16, 104],
          [12, 76],
          [24, 54],
        ],
        6,
      ) +
      root(
        [
          [112, 104],
          [116, 76],
          [104, 54],
        ],
        6,
      ) +
      root(
        [
          [44, 106],
          [38, 70],
          [50, 40],
          [44, 22],
        ],
        7,
      ) +
      root(
        [
          [84, 106],
          [90, 70],
          [78, 40],
          [84, 20],
        ],
        7,
      ) +
      [
        [24, 52],
        [104, 52],
        [44, 20],
        [84, 18],
      ]
        .map(
          ([x, y]) =>
            [0, 72, 144, 216, 288]
              .map((d) => {
                const a = (d * Math.PI) / 180;
                return `<ellipse cx="${n(x + Math.cos(a) * 5)}" cy="${n(y + Math.sin(a) * 4)}" rx="5" ry="4" fill="#ff9fc4"/>`;
              })
              .join("") +
            `<circle cx="${x}" cy="${y}" r="2.6" fill="#ffd166"/>`,
        )
        .join("") +
      sparks(
        [
          [64, 40, 1.6],
          [12, 30, 1.2],
          [116, 30, 1.2],
        ],
        N.accent[2],
      ),
  },
};

export const SKILL_ART_NAMES = Object.keys(art);
const cache = new Map<string, string>();
/** The illustrated icon for a champion move, or undefined (no art yet). */
export function skillArt(name: string) {
  const entry = art[name];
  if (!entry) return undefined;
  let svg = cache.get(name);
  if (!svg) {
    svg =
      `<svg class="skill-icon skill-art" data-skill-art="${name}" viewBox="0 0 128 128" aria-hidden="true" focusable="false">` +
      backdrop(entry.el) +
      entry.draw() +
      `<rect width="128" height="128" fill="url(#sa-vig)"/><rect width="128" height="128" fill="url(#sa-sheen)"/></svg>`;
    cache.set(name, svg);
  }
  ensureSkillArtDefs();
  return svg;
}
