/**
 * The Sun Atrium's pieces (Prismatail's arena): crystal mirrors on marble
 * plinths, brass skylight medallions, light-relay beams, Sun Pillars and the
 * Blinded marker, matched to the painted marble and gold of the arena art.
 *
 * Everything here is pure: each piece drawer paints one piece at its origin
 * into a 2D canvas, `k` texture pixels per world unit, once, into an atlas
 * (raid-prismatail-atrium-rig.ts shows it). `atriumFrame` says where each
 * piece goes this frame, from the battle's own state; the rig only places,
 * turns, scales and fades images. The inlaid rings, glass and the mirrors'
 * turning tracks never move, so they are painted into the baked floor
 * (`paintAtriumInlay`, raid-arena-art.ts) and cost nothing per frame.
 *
 * Gameplay stays as the server has it: the mirrors stand where they are and
 * sort with the raiders by their front edge (y + 23), each points one of
 * eight ways in its own colour, beams follow the server's exact lines (gold
 * for the first beam, cyan for the second) and the skylight's reach is the
 * exact range ring (300, or 360 with Dazzling), drawn as a dashed edge of
 * light so it never reads as one of the gold inlays.
 */
import { groundHeight } from "../../../packages/shared/src/world-art";
import {
  PRISMATAIL as P,
  PRISM_COLORS,
} from "../../../packages/shared/src/raid-prismatail";

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
/** The ground's tilt (height of a floor circle over its width). */
const GY = groundHeight(1);
/** The relay beams float this high over the floor line they follow. */
export const BEAM_LIFT = 20;
/** Gold for the first beam, cyan for the second (as the server's colours). */
export const BEAM_COLORS = [0xffdc83, 0x9cddff] as const;
/** The skylight's range ring is drawn for this radius and scaled to the real one. */
const RANGE_ART = 300;
/** Where the inlaid rings are centred (the boss's home). */
const RING_CENTRE = { x: 1000, y: 450 };
const FLOOR6 = [0xd97c91, 0xe0ba70, 0x80b9a8, 0x70a9c7, 0x8d8dc0, 0xb18dbd];

// ---- Colour helpers ----
const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const css = (c: number, a = 1) => {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${a})`;
};
const mix = (c: number, d: number, t: number) => {
  const A = rgb(c),
    B = rgb(d);
  return (
    (Math.round(A[0] + (B[0] - A[0]) * t) << 16) |
    (Math.round(A[1] + (B[1] - A[1]) * t) << 8) |
    Math.round(A[2] + (B[2] - A[2]) * t)
  );
};
const lighten = (c: number, t: number) => mix(c, 0xffffff, t);
const deepen = (c: number, t: number) => mix(c, 0x2a1530, t);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function rand(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// =====================================================================
//  Shared drawing helpers
// =====================================================================
function goldGrad(c: Ctx, x0: number, y0: number, x1: number, y1: number) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, "#fff3c4");
  g.addColorStop(0.22, "#f2cb6a");
  g.addColorStop(0.52, "#b8802a");
  g.addColorStop(0.78, "#e8bb5c");
  g.addColorStop(1, "#6b4512");
  return g;
}
function star(
  c: Ctx,
  x: number,
  y: number,
  r: number,
  fill: string,
  points = 4,
  inner = 0.2,
  rot = 0,
) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i * Math.PI) / points - Math.PI / 2,
      rr = i % 2 ? r * inner : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fillStyle = fill;
  c.fill();
}
function diamondPath(c: Ctx, hw: number, hh: number) {
  c.beginPath();
  c.moveTo(0, -hh);
  c.lineTo(hw, 0);
  c.lineTo(0, hh);
  c.lineTo(-hw, 0);
  c.closePath();
}
/** A faceted crystal: four facets lit from the upper left, inner fire, edges and a sparkle. */
function facetGem(
  c: Ctx,
  col: number,
  hw: number,
  hh: number,
  o: { core?: string; outline?: string; ow?: number } = {},
) {
  const T = [0, -hh],
    R = [hw, 0],
    B = [0, hh],
    L = [-hw, 0],
    C = [hw * 0.16, -hh * 0.1];
  const tri = (a: number[], b: number[], d: number[], fill: CanvasGradient) => {
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.lineTo(d[0], d[1]);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  };
  const lg = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    c0: string,
    c1: string,
  ) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    return g;
  };
  tri(
    T,
    L,
    C,
    lg(-hw * 0.5, -hh, 0, 0, css(lighten(col, 0.55)), css(lighten(col, 0.12))),
  );
  tri(
    T,
    C,
    R,
    lg(0, -hh, hw, 0, css(lighten(col, 0.22)), css(deepen(col, 0.06))),
  );
  tri(L, B, C, lg(-hw, 0, 0, hh, css(col), css(deepen(col, 0.34))));
  tri(
    C,
    B,
    R,
    lg(
      hw * 0.2,
      0,
      hw * 0.4,
      hh,
      css(deepen(col, 0.18)),
      css(deepen(col, 0.55)),
    ),
  );
  c.save();
  diamondPath(c, hw, hh);
  c.clip();
  const fire = c.createRadialGradient(
    -hw * 0.25,
    -hh * 0.35,
    0,
    -hw * 0.25,
    -hh * 0.35,
    hh * 0.8,
  );
  fire.addColorStop(0, "rgba(255,255,255,0.42)");
  fire.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = fire;
  c.fillRect(-hw, -hh, hw * 2, hh * 2);
  if (o.core) {
    const g = c.createRadialGradient(0, hh * 0.15, 0, 0, hh * 0.15, hh * 0.55);
    g.addColorStop(0, o.core);
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(-hw, -hh, hw * 2, hh * 2);
  }
  c.strokeStyle = css(lighten(col, 0.7), 0.5);
  c.lineWidth = hh * 0.025;
  c.beginPath();
  c.moveTo(-hw * 0.5, hh * 0.1);
  c.lineTo(hw * 0.1, hh * 0.55);
  c.moveTo(-hw * 0.1, -hh * 0.6);
  c.lineTo(hw * 0.55, -hh * 0.05);
  c.stroke();
  c.restore();
  c.strokeStyle = "rgba(255,255,255,0.55)";
  c.lineWidth = Math.max(0.5, hh * 0.03);
  c.beginPath();
  for (const p of [T, L, R, B]) {
    c.moveTo(C[0], C[1]);
    c.lineTo(p[0], p[1]);
  }
  c.stroke();
  diamondPath(c, hw, hh);
  c.lineJoin = "round";
  c.strokeStyle = o.outline ?? "rgba(38,22,48,0.6)";
  c.lineWidth = o.ow ?? Math.max(0.8, hh * 0.055);
  c.stroke();
  // a bright sliver along the upper-left edge
  c.beginPath();
  c.moveTo(-hw * 0.08, -hh * 0.86);
  c.lineTo(-hw * 0.82, -hh * 0.06);
  c.lineTo(-hw * 0.62, -hh * 0.07);
  c.closePath();
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.fill();
  star(c, -hw * 0.3, -hh * 0.46, hh * 0.22, "rgba(255,255,255,0.95)");
}
function radial(c: Ctx, r: number, stops: [number, string][], sx = 1, sy = 1) {
  c.save();
  c.scale(sx, sy);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g;
  c.fillRect(-r, -r, r * 2, r * 2);
  c.restore();
}

// =====================================================================
//  Piece drawers: (ctx, k), ctx at the piece's origin.
// =====================================================================
/** A white glow, tinted when placed. */
function drawGlow(c: Ctx, k: number) {
  c.scale(k, k);
  radial(c, 32, [
    [0, "rgba(255,255,255,1)"],
    [0.22, "rgba(255,255,255,0.6)"],
    [0.5, "rgba(255,255,255,0.2)"],
    [1, "rgba(255,255,255,0)"],
  ]);
}
/** Dashes per quarter of the range ring (so its halves tile). */
export const RANGE_DASHES = 18;
/**
 * One half (y ≥ 0) of the skylight's reach, a circle of exactly 300
 * units: a warm wash that thickens towards the edge, and the edge itself as
 * cream dashes of light over an indigo shadow with inward sun ticks. The
 * gold inlays are solid gold lines, so the two never read alike.
 */
function drawRangeHalf(c: Ctx, k: number) {
  c.scale(k, k);
  const R = RANGE_ART;
  // A hair of overlap so the halves meet without a seam.
  c.beginPath();
  c.rect(-R - 12, -0.5, 2 * R + 24, R + 12);
  c.clip();
  radial(c, R + 6, [
    [0, "rgba(255,240,196,0)"],
    [0.62, "rgba(255,240,196,0.03)"],
    [0.9, "rgba(255,236,176,0.09)"],
    [0.985, "rgba(255,236,176,0.22)"],
    [1, "rgba(255,236,176,0)"],
  ]);
  c.beginPath();
  c.arc(0, 0, R, 0, TAU);
  c.lineWidth = 6.5;
  c.strokeStyle = "rgba(30,28,72,0.36)";
  c.stroke();
  const period = (TAU * R) / 4 / RANGE_DASHES;
  c.setLineDash([period * 0.62, period * 0.38]);
  c.lineWidth = 3.4;
  c.strokeStyle = "rgba(255,248,226,1)";
  c.stroke();
  c.setLineDash([]);
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12;
    c.save();
    c.translate(Math.cos(a) * (R - 5), Math.sin(a) * (R - 5));
    c.rotate(a);
    // a small sun ray pointing in: inside the ring is lit
    c.beginPath();
    c.moveTo(4, -5);
    c.lineTo(-9, 0);
    c.lineTo(4, 5);
    c.closePath();
    c.fillStyle = "rgba(255,250,232,1)";
    c.fill();
    c.lineWidth = 1.2;
    c.strokeStyle = "rgba(30,28,72,0.65)";
    c.stroke();
    c.restore();
  }
}
/** A slanted shaft of sunlight from the skylight above, landing on the medallion. */
function drawShaft(c: Ctx, k: number) {
  c.scale(k, k);
  for (let i = 0; i < 7; i++) {
    const f = i / 6,
      wt = 24 + (1 - f) * 28,
      wb = 38 + (1 - f) * 44;
    const g = c.createLinearGradient(0, -412, 0, 0);
    g.addColorStop(0, "rgba(255,253,244,0)");
    g.addColorStop(0.45, "rgba(255,253,244,0.06)");
    g.addColorStop(1, "rgba(255,252,238,0.13)");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-wt, -412);
    c.lineTo(wt, -412);
    c.lineTo(wb, 0);
    c.ellipse(0, 0, wb, wb * GY * 0.5, 0, 0, Math.PI, false);
    c.closePath();
    c.fill();
  }
  radial(
    c,
    70,
    [
      [0, "rgba(255,253,244,0.4)"],
      [1, "rgba(255,253,244,0)"],
    ],
    1,
    GY,
  );
}
/** Brass sun medallion inlaid in the floor (seen at the ground's tilt). */
function drawPlate(c: Ctx, k: number) {
  c.scale(k, k);
  c.scale(1, GY);
  c.beginPath();
  c.arc(1.5, 3, 52, 0, TAU);
  c.fillStyle = "rgba(60,36,8,0.16)";
  c.fill();
  for (let i = 0; i < 16; i++) {
    const a = (i * TAU) / 16,
      long = i % 2 === 0,
      r1 = 34,
      r2 = long ? 52 : 44,
      w = long ? 0.13 : 0.1;
    c.beginPath();
    c.moveTo(Math.cos(a - w) * r1, Math.sin(a - w) * r1);
    c.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    c.lineTo(Math.cos(a + w) * r1, Math.sin(a + w) * r1);
    c.closePath();
    c.fillStyle = goldGrad(c, -40, -40, 40, 40);
    c.fill();
    c.lineWidth = 0.7;
    c.strokeStyle = "rgba(70,42,10,0.7)";
    c.stroke();
  }
  c.beginPath();
  c.arc(0, 0, 35, 0, TAU);
  c.lineWidth = 6;
  c.strokeStyle = "rgba(70,44,12,0.55)";
  c.stroke();
  c.lineWidth = 3;
  c.strokeStyle = goldGrad(c, -35, -35, 35, 35);
  c.stroke();
  const disc = c.createRadialGradient(-9, -9, 2, 0, 0, 34);
  disc.addColorStop(0, "#fffbf0");
  disc.addColorStop(0.55, "#ffe8ac");
  disc.addColorStop(1, "#d9a24a");
  c.beginPath();
  c.arc(0, 0, 32.5, 0, TAU);
  c.fillStyle = disc;
  c.fill();
  c.beginPath();
  c.arc(0, 0, 22, 0, TAU);
  c.lineWidth = 1.3;
  c.strokeStyle = "rgba(130,86,22,0.5)";
  c.stroke();
  star(c, 0, 0, 13, "rgba(196,140,48,0.85)", 8, 0.42);
  star(c, 0, 0, 7, "rgba(255,250,232,0.95)", 8, 0.45);
}
function drawLens(c: Ctx, k: number) {
  c.scale(k, k);
  facetGem(c, 0xffe9ac, 14.4, 24, { outline: "rgba(112,70,14,0.75)" });
}
/** Six slow light blades around the lens. */
function drawCrown(c: Ctx, k: number) {
  c.scale(k, k);
  for (let i = 0; i < 6; i++) {
    c.save();
    c.rotate((i * TAU) / 6);
    c.beginPath();
    c.moveTo(30, -3.2);
    c.quadraticCurveTo(40, -1.8, 47, 0);
    c.quadraticCurveTo(40, 1.8, 30, 3.2);
    c.closePath();
    const g = c.createLinearGradient(30, 0, 47, 0);
    g.addColorStop(0, "#fff8da");
    g.addColorStop(1, "rgba(255,206,110,0.85)");
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 0.8;
    c.strokeStyle = "rgba(112,70,14,0.6)";
    c.stroke();
    c.restore();
  }
}
/** Mirror post: gilded hoop behind, a marble plinth on a gold flange, a coloured gem and the crystal's cup. */
function drawPost(c: Ctx, k: number, col: number) {
  c.scale(k, k);
  c.save();
  c.translate(6, 20);
  radial(
    c,
    30,
    [
      [0, "rgba(20,12,4,0.35)"],
      [1, "rgba(20,12,4,0)"],
    ],
    1,
    0.35,
  );
  c.restore();
  c.beginPath();
  c.arc(0, -24, 28, 0, TAU);
  c.lineWidth = 7;
  c.strokeStyle = "rgba(58,36,10,0.55)";
  c.stroke();
  c.lineWidth = 4.2;
  c.strokeStyle = goldGrad(c, -28, -52, 28, 4);
  c.stroke();
  c.beginPath();
  c.arc(0, -24, 28.6, Math.PI * 1.05, Math.PI * 1.62);
  c.lineWidth = 1.1;
  c.strokeStyle = "rgba(255,248,215,0.9)";
  c.stroke();
  c.save();
  c.translate(0, -54);
  diamondPath(c, 3.4, 5.4);
  c.fillStyle = goldGrad(c, -3, -5, 3, 5);
  c.fill();
  c.lineWidth = 0.8;
  c.strokeStyle = "rgba(60,36,8,0.8)";
  c.stroke();
  c.restore();
  for (const x of [-28, 28]) {
    c.beginPath();
    c.arc(x, -24, 2.8, 0, TAU);
    c.fillStyle = goldGrad(c, x - 3, -27, x + 3, -21);
    c.fill();
    c.lineWidth = 0.7;
    c.strokeStyle = "rgba(60,36,8,0.8)";
    c.stroke();
  }
  // flange
  c.beginPath();
  c.ellipse(0, 19, 26, 9.5, 0, 0, TAU);
  c.fillStyle = goldGrad(c, -26, 10, 26, 28);
  c.fill();
  c.lineWidth = 1;
  c.strokeStyle = "rgba(60,36,8,0.8)";
  c.stroke();
  // marble body
  c.beginPath();
  c.moveTo(-19, -2);
  c.lineTo(-21, 17);
  c.ellipse(0, 17, 21, 7.5, 0, Math.PI, 0, true);
  c.lineTo(19, -2);
  c.ellipse(0, -2, 19, 7, 0, 0, Math.PI, true);
  c.closePath();
  const m = c.createLinearGradient(-21, 0, 21, 0);
  m.addColorStop(0, "#efe6da");
  m.addColorStop(0.3, "#d3c6b4");
  m.addColorStop(0.68, "#9a8a76");
  m.addColorStop(1, "#4f4234");
  c.fillStyle = m;
  c.fill();
  c.save();
  c.clip();
  const r = rand(7 + col);
  c.strokeStyle = "rgba(110,130,150,0.35)";
  c.lineWidth = 0.6;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    let x = -20 + r() * 30,
      y = -4 + r() * 6;
    c.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      x += 3 + r() * 6;
      y += 2 + r() * 5;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  c.restore();
  c.lineWidth = 0.9;
  c.strokeStyle = "rgba(70,48,20,0.55)";
  c.stroke();
  // gold bands (front halves)
  c.beginPath();
  c.ellipse(0, 4, 20, 7.2, 0, 0, Math.PI);
  c.lineWidth = 2.4;
  c.strokeStyle = goldGrad(c, -20, 0, 20, 12);
  c.stroke();
  c.beginPath();
  c.ellipse(0, 13, 20.6, 7.4, 0, 0, Math.PI);
  c.lineWidth = 1.3;
  c.stroke();
  // the mirror's colour, set in the plinth
  c.save();
  c.translate(0, 10.5);
  diamondPath(c, 5, 6.6);
  c.fillStyle = goldGrad(c, -5, -6, 5, 6);
  c.fill();
  c.lineWidth = 0.7;
  c.strokeStyle = "rgba(60,36,8,0.85)";
  c.stroke();
  facetGem(c, col, 3.3, 4.6, { ow: 0.5 });
  c.restore();
  // top face
  c.beginPath();
  c.ellipse(0, -2, 19, 7, 0, 0, TAU);
  const top = c.createRadialGradient(-6, -5, 1, 0, -2, 20);
  top.addColorStop(0, "#fbf3e4");
  top.addColorStop(1, "#c4b293");
  c.fillStyle = top;
  c.fill();
  c.lineWidth = 1.8;
  c.strokeStyle = goldGrad(c, -19, -9, 19, 5);
  c.stroke();
  // cup
  c.beginPath();
  c.ellipse(0, -3, 7.5, 3, 0, 0, TAU);
  c.fillStyle = goldGrad(c, -7, -6, 7, 0);
  c.fill();
  c.lineWidth = 0.7;
  c.strokeStyle = "rgba(60,36,8,0.8)";
  c.stroke();
}
function drawMirrorGem(c: Ctx, k: number, col: number) {
  c.scale(k, k);
  facetGem(c, col, 14, 23);
}
/** The arrow's outline, pointing along +x from 22 to 66 units out. */
export const ARROW = { tail: 22, headBase: 45, tip: 66, halfWidth: 9.5 };
const arrowPath = (c: Ctx) => {
  c.beginPath();
  c.moveTo(22, -3.6);
  c.lineTo(46, -3.6);
  c.lineTo(45, -9.5);
  c.lineTo(66, 0);
  c.lineTo(45, 9.5);
  c.lineTo(46, 3.6);
  c.lineTo(22, 3.6);
  c.lineTo(25.5, 0);
  c.closePath();
};
/** Floor-inlaid gold arrow with a glass core, pointing along +x. */
function drawArrow(c: Ctx, k: number) {
  c.scale(k, k);
  c.save();
  c.translate(1.6, 2.2);
  arrowPath(c);
  c.fillStyle = "rgba(30,18,4,0.38)";
  c.fill();
  c.restore();
  arrowPath(c);
  c.lineJoin = "round";
  c.lineWidth = 3;
  c.strokeStyle = "#3e2808";
  c.stroke();
  const g = c.createLinearGradient(0, -9, 0, 9);
  g.addColorStop(0, "#fff4c8");
  g.addColorStop(0.35, "#f2c960");
  g.addColorStop(0.7, "#b47c25");
  g.addColorStop(1, "#7a5014");
  c.fillStyle = g;
  c.fill();
  c.beginPath();
  c.moveTo(28, -1.3);
  c.lineTo(50, -1.3);
  c.lineTo(49.4, -4.8);
  c.lineTo(61, 0);
  c.lineTo(49.4, 4.8);
  c.lineTo(50, 1.3);
  c.lineTo(28, 1.3);
  c.closePath();
  const core = c.createLinearGradient(28, 0, 61, 0);
  core.addColorStop(0, "#fff6d6");
  core.addColorStop(1, "#fffef8");
  c.fillStyle = core;
  c.fill();
  c.beginPath();
  c.arc(22, 0, 3.3, 0, TAU);
  c.fillStyle = goldGrad(c, 19, -3, 25, 3);
  c.fill();
  c.lineWidth = 0.9;
  c.strokeStyle = "#3e2808";
  c.stroke();
}
/** A soft halo the shape of the arrow (a mirror carrying light). */
function drawArrowGlow(c: Ctx, k: number) {
  for (let i = 0; i < 2; i++) {
    c.save();
    c.scale(k, k);
    c.translate(0, -1000);
    arrowPath(c);
    c.restore();
    c.shadowColor = "rgba(255,238,170,1)";
    c.shadowBlur = (i ? 4 : 9) * k;
    c.shadowOffsetY = 1000 * k;
    c.fillStyle = "#000";
    c.fill();
  }
}
/** The turn chime: a ring at the game's radius 35 with sparkles. */
function drawChime(c: Ctx, k: number) {
  c.scale(k, k);
  c.beginPath();
  c.arc(0, 0, 35, 0, TAU);
  c.fillStyle = "rgba(255,223,141,0.12)";
  c.fill();
  c.lineWidth = 6;
  c.strokeStyle = "rgba(92,58,12,0.45)";
  c.stroke();
  c.lineWidth = 4;
  c.strokeStyle = "rgba(255,214,120,1)";
  c.stroke();
  c.lineWidth = 1.2;
  c.strokeStyle = "rgba(255,255,240,0.95)";
  c.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8 + 0.2;
    star(c, Math.cos(a) * 42, Math.sin(a) * 42, 4.5, "rgba(255,246,210,0.95)");
  }
}
function drawBeam(c: Ctx, k: number, col: number) {
  c.scale(k, k);
  const d = deepen(col, 0.62);
  const g = c.createLinearGradient(0, -5, 0, 5);
  g.addColorStop(0, css(d, 0));
  g.addColorStop(0.22, css(d, 0.62));
  g.addColorStop(0.78, css(d, 0.62));
  g.addColorStop(1, css(d, 0));
  c.fillStyle = g;
  c.fillRect(0, -5.5, 64, 11);
  c.fillStyle = css(col, 1);
  c.fillRect(0, -2.5, 64, 5);
  c.fillStyle = css(lighten(col, 0.7), 1);
  c.fillRect(0, -0.6, 64, 1.2);
}
function drawBeamGlow(
  c: Ctx,
  k: number,
  col: number,
  half: number,
  peak: number,
) {
  c.scale(k, k);
  const g = c.createLinearGradient(0, -half, 0, half);
  for (const [o, a] of [
    [0, 0],
    [0.28, 0.1],
    [0.42, 0.42],
    [0.5, 1],
    [0.58, 0.42],
    [0.72, 0.1],
    [1, 0],
  ])
    g.addColorStop(o, css(col, a * peak));
  c.fillStyle = g;
  c.fillRect(0, -half, 64, half * 2);
}
function drawSpark(c: Ctx, k: number, col: number) {
  c.scale(k, k);
  radial(c, 14, [
    [0, css(lighten(col, 0.5), 0.9)],
    [0.4, css(col, 0.35)],
    [1, css(col, 0)],
  ]);
  star(c, 0, 0, 11, "rgba(255,255,255,0.95)", 4, 0.16);
  star(c, 0, 0, 5, "rgba(255,255,255,0.8)", 4, 0.3, Math.PI / 4);
}
function drawFlare(c: Ctx, k: number, col: number) {
  c.scale(k, k);
  radial(c, 24, [
    [0, css(lighten(col, 0.6), 0.75)],
    [0.35, css(col, 0.3)],
    [1, css(col, 0)],
  ]);
  star(c, 0, 0, 20, css(lighten(col, 0.65), 0.85), 6, 0.1);
  c.beginPath();
  c.arc(0, 0, 3, 0, TAU);
  c.fillStyle = "#fff";
  c.fill();
}
/** Sun pillar floor: a burning rune ring. */
function drawPillarBase(c: Ctx, k: number) {
  c.scale(k, k);
  c.scale(1, GY);
  radial(c, 46, [
    [0, "rgba(255,206,120,0.42)"],
    [0.6, "rgba(255,150,60,0.2)"],
    [1, "rgba(255,150,60,0)"],
  ]);
  c.beginPath();
  c.arc(0, 0, 41, 0, TAU);
  c.lineWidth = 6;
  c.strokeStyle = "rgba(96,40,8,0.28)";
  c.stroke();
  c.beginPath();
  c.arc(0, 0, 34, 0, TAU);
  c.lineWidth = 2.2;
  c.strokeStyle = "rgba(255,176,74,0.95)";
  c.stroke();
  c.beginPath();
  c.arc(0, 0, 27, 0, TAU);
  c.lineWidth = 1;
  c.strokeStyle = "rgba(255,214,140,0.7)";
  c.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8 + 0.39;
    c.save();
    c.translate(Math.cos(a) * 34, Math.sin(a) * 34);
    c.rotate(a);
    diamondPath(c, 2.4, 4.4);
    c.fillStyle = "#fff0c4";
    c.fill();
    c.restore();
  }
}
function drawPillarCrystal(c: Ctx, k: number) {
  c.scale(k, k);
  facetGem(c, 0xffc35a, 19.2, 32, {
    outline: "rgba(120,50,8,0.8)",
    core: "rgba(255,252,220,0.85)",
  });
}
/** A crossed-out eye over a Blinded raider's head. */
function drawBlind(c: Ctx, k: number) {
  c.scale(k, k);
  const eye = () => {
    c.beginPath();
    c.moveTo(-17, 0);
    c.quadraticCurveTo(0, -15, 17, 0);
    c.quadraticCurveTo(0, 15, -17, 0);
    c.closePath();
  };
  c.save();
  c.translate(1, 2);
  eye();
  c.fillStyle = "rgba(10,6,30,0.35)";
  c.fill();
  c.restore();
  eye();
  const g = c.createLinearGradient(0, -8, 0, 8);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#cfc6ff");
  c.fillStyle = g;
  c.fill();
  c.lineWidth = 2.2;
  c.strokeStyle = "#2b2459";
  c.stroke();
  const iris = c.createRadialGradient(-1.5, -1.5, 0, 0, 0, 6);
  iris.addColorStop(0, "#a898ff");
  iris.addColorStop(1, "#4b3aa8");
  c.beginPath();
  c.arc(0, 0, 6, 0, TAU);
  c.fillStyle = iris;
  c.fill();
  c.beginPath();
  c.arc(0, 0, 2.4, 0, TAU);
  c.fillStyle = "#1b1440";
  c.fill();
  c.beginPath();
  c.arc(-2, -2, 1.5, 0, TAU);
  c.fillStyle = "#fff";
  c.fill();
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-18, 12);
  c.lineTo(18, -12);
  c.lineWidth = 5.2;
  c.strokeStyle = "#2b2459";
  c.stroke();
  c.lineWidth = 2.6;
  c.strokeStyle = "#d4caff";
  c.stroke();
}
function drawGlint(c: Ctx, k: number) {
  c.scale(k, k);
  radial(c, 11, [
    [0, "rgba(255,255,240,0.8)"],
    [1, "rgba(255,255,240,0)"],
  ]);
  star(c, 0, 0, 10, "rgba(255,255,255,0.95)", 4, 0.14);
}

// =====================================================================
//  Piece list and atlas packing
// =====================================================================
export interface AtriumPiece {
  name: string;
  /** Size in world units. */
  w: number;
  h: number;
  /** The origin inside it, in world units from the top left. */
  ox: number;
  oy: number;
  /** Texture detail relative to the atlas (soft light needs less). */
  q: number;
  draw: (c: Ctx, k: number) => void;
}
const piece = (
  name: string,
  w: number,
  h: number,
  ox: number,
  oy: number,
  draw: AtriumPiece["draw"],
  q = 1,
): AtriumPiece => ({ name, w, h, ox, oy, q, draw });
export function atriumPieces(): AtriumPiece[] {
  const list = [
    piece("glow", 64, 64, 32, 32, drawGlow, 0.5),
    // thin lines over a soft wash: three quarters of the atlas's detail is plenty
    piece(
      "range",
      2 * RANGE_ART + 22,
      RANGE_ART + 11,
      RANGE_ART + 11,
      1,
      drawRangeHalf,
      0.75,
    ),
    piece("shaft", 172, 434, 86, 414, drawShaft, 0.5),
    piece("plate", 116, 80, 58, 40, drawPlate),
    piece("lens", 34, 54, 17, 27, drawLens),
    piece("crown", 100, 100, 50, 50, drawCrown),
    piece("arrow", 72, 28, 0, 14, drawArrow),
    piece("arrowGlow", 84, 40, 0, 20, drawArrowGlow, 0.5),
    piece("chime", 100, 100, 50, 50, drawChime),
    piece("pbase", 100, 70, 50, 35, drawPillarBase),
    piece("pcrys", 44, 72, 22, 36, drawPillarCrystal),
    piece("blind", 50, 38, 25, 19, drawBlind),
    piece("glint", 24, 24, 12, 12, drawGlint),
  ];
  for (let i = 0; i < 4; i++)
    list.push(
      piece(`post${i}`, 76, 92, 38, 64, (c, k) =>
        drawPost(c, k, PRISM_COLORS[i]),
      ),
      piece(`gem${i}`, 34, 52, 17, 26, (c, k) =>
        drawMirrorGem(c, k, PRISM_COLORS[i]),
      ),
    );
  for (let b = 0; b < 2; b++) {
    const col = BEAM_COLORS[b];
    list.push(
      piece(`beam${b}`, 64, 12, 0, 6, (c, k) => drawBeam(c, k, col)),
      piece(
        `bglow${b}`,
        64,
        44,
        0,
        22,
        (c, k) => drawBeamGlow(c, k, col, 22, 0.6),
        0.5,
      ),
      piece(
        `spill${b}`,
        64,
        52,
        0,
        26,
        (c, k) => drawBeamGlow(c, k, col, 26, 0.45),
        0.5,
      ),
      piece(`spark${b}`, 28, 28, 14, 14, (c, k) => drawSpark(c, k, col)),
      piece(`flare${b}`, 48, 48, 24, 24, (c, k) => drawFlare(c, k, col)),
    );
  }
  return list;
}
export interface AtriumSpot {
  piece: AtriumPiece;
  /** Where its frame starts in the atlas, and its size (texture pixels). */
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Texture pixels of clear border round each frame (no bleeding when filtered). */
const PAD = 2;
/** Shelf-pack the pieces at `k` texture pixels per world unit. */
export function packAtrium(k: number, pieces = atriumPieces()) {
  const width = Math.ceil(700 * k);
  const list = pieces
    .map((p) => ({
      p,
      w: Math.ceil(p.w * k * p.q),
      h: Math.ceil(p.h * k * p.q),
    }))
    .sort((a, b) => b.h - a.h || b.w - a.w);
  const spots: AtriumSpot[] = [];
  let x = 0,
    y = 0,
    row = 0;
  for (const it of list) {
    if (x + it.w + PAD * 2 > width) {
      x = 0;
      y += row;
      row = 0;
    }
    spots.push({ piece: it.p, x: x + PAD, y: y + PAD, w: it.w, h: it.h });
    x += it.w + PAD * 2;
    row = Math.max(row, it.h + PAD * 2);
  }
  return { width, height: y + row, spots };
}
/** Paint every piece into its spot (the atlas canvas, drawn once). */
export function paintAtrium(c: Ctx, spots: AtriumSpot[], k: number) {
  for (const s of spots) {
    const q = k * s.piece.q;
    c.save();
    c.beginPath();
    c.rect(s.x, s.y, s.w, s.h);
    c.clip();
    c.translate(s.x + s.piece.ox * q, s.y + s.piece.oy * q);
    s.piece.draw(c, q);
    c.restore();
  }
}

// =====================================================================
//  The baked floor: inlaid rings, glass and the mirrors' turning tracks
// =====================================================================
/**
 * Paint the Sun Atrium's static inlays over its illustration, in world
 * units: the glass ellipse and spokes, the two gold rings round the boss's
 * home with their gems, and under each mirror its contact shadow and the
 * eight-notch track it turns on.
 */
export function paintAtriumInlay(c: Ctx) {
  c.save();
  // glass
  c.beginPath();
  c.ellipse(800, 450, 575, groundHeight(1150) / 2, 0, 0, TAU);
  c.lineWidth = 4;
  c.strokeStyle = "rgba(80,50,15,0.12)";
  c.stroke();
  c.lineWidth = 1.5;
  c.strokeStyle = "rgba(255,220,140,0.34)";
  c.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12;
    const ax = 800 + Math.cos(a) * 300,
      ay = 450 + Math.sin(a) * groundHeight(300);
    const bx = 800 + Math.cos(a) * 570,
      by = 450 + Math.sin(a) * groundHeight(570);
    const len = Math.hypot(bx - ax, by - ay),
      nx = -(by - ay) / len,
      ny = (bx - ax) / len;
    c.beginPath();
    c.moveTo(ax + nx * 3.2, ay + ny * 3.2);
    c.lineTo(bx + nx * 1.2, by + ny * 1.2);
    c.lineTo(bx - nx * 1.2, by - ny * 1.2);
    c.lineTo(ax - nx * 3.2, ay - ny * 3.2);
    c.closePath();
    c.fillStyle = css(PRISM_COLORS[i % 6], 0.2);
    c.fill();
    c.lineWidth = 0.8;
    c.strokeStyle = "rgba(230,190,110,0.36)";
    c.stroke();
  }
  // gold rings
  const { x: cx, y: cy } = RING_CENTRE;
  for (const R of [210, 310]) {
    c.beginPath();
    c.arc(cx, cy, R, 0, TAU);
    c.lineWidth = 7.5;
    c.strokeStyle = "rgba(72,46,14,0.4)";
    c.stroke();
    c.lineWidth = 3.4;
    c.strokeStyle = "#c39140";
    c.stroke();
    c.beginPath();
    c.arc(cx + 0.9, cy + 0.9, R, 0, TAU);
    c.lineWidth = 0.8;
    c.strokeStyle = "rgba(90,56,12,0.55)";
    c.stroke();
    c.beginPath();
    c.arc(cx - 0.9, cy - 0.9, R, 0, TAU);
    c.lineWidth = 1;
    c.strokeStyle = "rgba(255,243,200,0.75)";
    c.stroke();
  }
  for (let i = 1; i < 24; i += 2) {
    const a = (i * TAU) / 24;
    c.save();
    c.translate(cx + Math.cos(a) * 210, cy + Math.sin(a) * 210);
    c.rotate(a);
    diamondPath(c, 5, 2.6);
    c.fillStyle = "#e9c271";
    c.fill();
    c.lineWidth = 0.7;
    c.strokeStyle = "rgba(70,42,10,0.8)";
    c.stroke();
    c.restore();
  }
  for (const [i, g] of ringGems().entries()) {
    c.save();
    c.translate(g.x, g.y);
    c.save();
    c.translate(1.6, 2.2);
    diamondPath(c, 9.5, 14.5);
    c.fillStyle = "rgba(30,18,4,0.32)";
    c.fill();
    c.restore();
    diamondPath(c, 9.5, 14.5);
    c.fillStyle = goldGrad(c, -9, -14, 9, 14);
    c.fill();
    c.lineWidth = 1.1;
    c.strokeStyle = "rgba(60,36,8,0.8)";
    c.stroke();
    facetGem(c, lighten(FLOOR6[i % 6], 0.12), 6, 10.4, { ow: 0.8 });
    c.restore();
  }
  // each mirror's contact shadow and turning track
  for (const m of P.mirrors) {
    c.save();
    c.translate(m.x, m.y);
    radial(
      c,
      44,
      [
        [0, "rgba(20,12,4,0.55)"],
        [0.55, "rgba(20,12,4,0.3)"],
        [1, "rgba(20,12,4,0)"],
      ],
      1,
      0.36,
    );
    c.beginPath();
    c.arc(0, 0, MIRROR_TRACK, 0, TAU);
    c.lineWidth = 3.4;
    c.strokeStyle = "rgba(60,38,10,0.36)";
    c.stroke();
    c.lineWidth = 1.3;
    c.strokeStyle = "rgba(246,214,142,0.75)";
    c.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8;
      c.save();
      c.translate(Math.cos(a) * MIRROR_TRACK, Math.sin(a) * MIRROR_TRACK);
      c.rotate(a);
      c.beginPath();
      c.moveTo(-3.8, 0);
      c.lineTo(0, -2.8);
      c.lineTo(3.8, 0);
      c.lineTo(0, 2.8);
      c.closePath();
      c.fillStyle = goldGrad(c, -4, -3, 4, 3);
      c.fill();
      c.lineWidth = 0.7;
      c.strokeStyle = "rgba(60,36,8,0.85)";
      c.stroke();
      c.restore();
    }
    c.restore();
  }
  c.restore();
}
/** Radius of each mirror's eight-notch turning track. */
export const MIRROR_TRACK = 46;
/** The twelve gems set in the outer ring (they glint while the heart is open). */
export const ringGems = () =>
  Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    return {
      x: RING_CENTRE.x + Math.cos(a) * 310,
      y: RING_CENTRE.y + Math.sin(a) * 310,
    };
  });

// =====================================================================
//  Per frame: where each piece goes
// =====================================================================
export interface Placement {
  piece: string;
  x: number;
  y: number;
  rot?: number;
  sx?: number;
  sy?: number;
  alpha?: number;
  tint?: number;
}
/** Something standing up, sorted with the raiders by its ground line. */
export interface AtriumStand {
  key: string;
  groundY: number;
  items: Placement[];
}
export interface AtriumFrame {
  /** On the floor, under the warnings and everyone standing. */
  floor: Placement[];
  stands: AtriumStand[];
  /** Light over the scene (still under skill effects and the HUD). */
  top: Placement[];
}
export interface AtriumMirror {
  x: number;
  y: number;
  /** The server's direction (radians). */
  angle: number;
  /** The direction shown, easing towards `angle` after a turn. */
  shown: number;
  /** Seconds since it was last turned (Infinity if not lately). */
  turnAge: number;
}
export interface AtriumInput {
  mirrors: AtriumMirror[];
  links: { x: number; y: number; tx: number; ty: number; beam?: number }[];
  sources: { x: number; y: number }[];
  /** The skylight's exact reach. */
  range: number;
  /** The skylights shine (false while the heart is open). */
  lit: boolean;
  pillars: { x: number; y: number; until: number }[];
  /** Feet of each raider who is Blinded now. */
  blinded: { x: number; y: number }[];
  /** Battle time (seconds), for the pillars' timers. */
  time: number;
  /** A smooth clock for idle motion; hold it still for reduced motion. */
  anim: number;
  /** Low graphics: no sunbeam shafts or floor light strips. */
  low: boolean;
  /** Reduced motion: no light blades, no sparkle, nothing spins or bobs. */
  reduced: boolean;
}
/**
 * How high over a raider's feet the Blinded eye floats: above the name and
 * health bar, which are drawn over the battle and would hide it lower down.
 */
export const BLIND_LIFT = 146;
/** How long a mirror's turn chime rings (the server's turn cooldown). */
export const CHIME = 0.4;
/** Where the skylights stand: two in phase 3 with a party, else one. */
export function atriumSources(r: { phase: number; partySize: number }) {
  return r.phase === 3 && r.partySize > 1
    ? [
        { x: 350, y: 300 },
        { x: 350, y: 600 },
      ]
    : [{ ...P.source }];
}
/** The skylight's exact reach for a run's trait. */
export const atriumRange = (trait?: string) =>
  P.range + (trait === "dazzling" ? 60 : 0);
/**
 * How far out a mirror's arrow sits. Pointing up the screen it would hide
 * behind the crystal and its hoop, so it moves out until its head clears
 * them; sideways and downwards it starts at the post.
 */
export const arrowPush = (angle: number) => Math.max(0, -Math.sin(angle)) * 30;
/** A pillar's strength: fades in over 0.25 s and out over its last 0.5 s. */
export const pillarFade = (time: number, until: number) =>
  clamp((until - time) / 0.5) * clamp((time - (until - 4)) / 0.25);
const same = (a: { x: number; y: number }, x: number, y: number) =>
  Math.abs(a.x - x) < 0.5 && Math.abs(a.y - y) < 0.5;

export function atriumFrame(o: AtriumInput): AtriumFrame {
  const anim = o.reduced ? 0 : o.anim;
  const floor: Placement[] = [],
    top: Placement[] = [],
    stands: AtriumStand[] = [];
  const range = o.range / RANGE_ART;
  const lit = o.mirrors.map((m) =>
    o.links.some((l) => same(m, l.x, l.y) || same(m, l.tx, l.ty)),
  );
  // ---- floor ----
  for (const s of o.sources) {
    if (o.lit) {
      // two halves of the reach; the dashes drift slowly round
      const spin = anim * 0.05;
      for (let q = 0; q < 2; q++)
        floor.push({
          piece: "range",
          x: s.x,
          y: s.y,
          rot: spin + q * Math.PI,
          sx: range,
          sy: range,
        });
    }
    floor.push({ piece: "plate", x: s.x, y: s.y, alpha: o.lit ? 1 : 0.55 });
    if (o.lit)
      floor.push({
        piece: "glow",
        x: s.x,
        y: s.y,
        sx: 2.4,
        sy: 2.4 * GY,
        alpha: 0.42 + 0.06 * Math.sin(anim * 2),
        tint: 0xfffcf0,
      });
  }
  for (const p of o.pillars) {
    const fade = pillarFade(o.time, p.until);
    if (fade <= 0) continue;
    floor.push({ piece: "pbase", x: p.x, y: p.y, alpha: fade });
    floor.push({
      piece: "glow",
      x: p.x,
      y: p.y,
      sx: 1.8,
      sy: 1.8 * GY,
      alpha: 0.42 * fade * (0.85 + 0.15 * Math.sin(anim * 13)),
      tint: 0xffb556,
    });
  }
  o.mirrors.forEach((m, i) => {
    const a = m.shown,
      push = arrowPush(a);
    // the notch it points at shines in its colour
    floor.push({
      piece: "glow",
      x: m.x + Math.cos(m.angle) * MIRROR_TRACK,
      y: m.y + Math.sin(m.angle) * MIRROR_TRACK,
      sx: 0.36,
      sy: 0.36,
      tint: PRISM_COLORS[i],
    });
    const ax = m.x + Math.cos(a) * push,
      ay = m.y + Math.sin(a) * push;
    if (lit[i]) {
      floor.push({
        piece: "glow",
        x: m.x + 4,
        y: m.y + 18,
        sx: 1.6,
        sy: 0.55,
        alpha: 0.38,
        tint: PRISM_COLORS[i],
      });
      floor.push({
        piece: "arrowGlow",
        x: ax,
        y: ay,
        rot: a,
        alpha: 0.55 + 0.12 * Math.sin(anim * 5),
      });
    }
    floor.push({ piece: "arrow", x: ax, y: ay, rot: a });
  });
  // beams: light on the floor along the server's line, the beam itself lifted
  for (const L of o.links) {
    const len = Math.hypot(L.tx - L.x, L.ty - L.y);
    if (len < 0.5) continue;
    const rot = Math.atan2(L.ty - L.y, L.tx - L.x),
      b = L.beam ? 1 : 0,
      sx = len / 64;
    if (!o.low)
      floor.push({ piece: `spill${b}`, x: L.x, y: L.y, rot, sx, alpha: 0.7 });
    floor.push({
      piece: `bglow${b}`,
      x: L.x,
      y: L.y - BEAM_LIFT,
      rot,
      sx,
      alpha: 0.85,
    });
    floor.push({ piece: `beam${b}`, x: L.x, y: L.y - BEAM_LIFT, rot, sx });
  }
  // ---- standing ----
  o.mirrors.forEach((m, i) => {
    const u = m.turnAge / CHIME;
    const ringing = u >= 0 && u < 1;
    const pop = ringing && !o.reduced ? 1 + 0.12 * Math.sin(u * Math.PI) : 1;
    const gy = m.y - 24 + Math.sin(anim * 1.7 + i) * 1.2;
    const items: Placement[] = [{ piece: `post${i}`, x: m.x, y: m.y }];
    // light behind the crystal, so its facets stay clear (never washed white)
    if (lit[i])
      items.push({
        piece: "glow",
        x: m.x,
        y: m.y - 24,
        sx: 1.05,
        sy: 1.05,
        alpha: 0.5 + 0.1 * Math.sin(anim * 4 + i),
        tint: PRISM_COLORS[i],
      });
    if (ringing)
      items.push({
        piece: "glow",
        x: m.x,
        y: m.y - 24,
        sx: 1.3,
        sy: 1.3,
        alpha: (1 - u) * 0.55,
        tint: 0xffe2a0,
      });
    items.push({ piece: `gem${i}`, x: m.x, y: gy, sx: pop, sy: pop });
    stands.push({ key: `mirror-${i}`, groundY: m.y + 23, items });
    if (ringing) {
      const grow = o.reduced ? 1 : 1 + 0.25 * u;
      top.push({
        piece: "chime",
        x: m.x,
        y: m.y,
        sx: grow,
        sy: grow,
        alpha: 1 - u,
      });
    }
  });
  o.pillars.forEach((p, j) => {
    const fade = pillarFade(o.time, p.until);
    if (fade <= 0) return;
    stands.push({
      key: `pillar-${j}`,
      groundY: p.y,
      items: [
        {
          piece: "glow",
          x: p.x,
          y: p.y - 35,
          sx: 1.2,
          sy: 1.5,
          alpha: fade * (0.5 + 0.2 * Math.sin(anim * 17) * Math.sin(anim * 7)),
          tint: 0xffb556,
        },
        {
          piece: "pcrys",
          x: p.x,
          y: p.y - 35 - (1 - fade) * 8,
          alpha: fade,
        },
      ],
    });
  });
  o.sources.forEach((s, j) => {
    const y = s.y - 23 + Math.sin(anim * 1.6) * 1.5;
    const items: Placement[] = [];
    if (o.lit && !o.reduced)
      items.push({ piece: "crown", x: s.x, y, rot: anim * 0.18 });
    if (o.lit)
      items.push({
        piece: "glow",
        x: s.x,
        y,
        alpha: 0.45 + 0.06 * Math.sin(anim * 2.3),
        tint: 0xfffcf0,
      });
    items.push({ piece: "lens", x: s.x, y, alpha: o.lit ? 1 : 0.6 });
    stands.push({ key: `skylight-${j}`, groundY: s.y, items });
  });
  // ---- light over the scene ----
  if (o.lit && !o.low)
    for (const s of o.sources)
      top.push({
        piece: "shaft",
        x: s.x,
        y: s.y,
        rot: -0.5,
        alpha: 0.85 + 0.1 * Math.sin(anim * 0.9),
      });
  o.links.forEach((L, j) => {
    const b = L.beam ? 1 : 0;
    if (!o.reduced) {
      const p = (anim * 0.65) % 1;
      top.push({
        piece: `spark${b}`,
        x: L.x + (L.tx - L.x) * p,
        y: L.y + (L.ty - L.y) * p - BEAM_LIFT,
      });
    }
    const prev = o.links[j - 1];
    if (prev && (prev.beam ? 1 : 0) === b && same(L, prev.tx, prev.ty)) {
      const s = 0.7 + 0.08 * Math.sin(anim * 6 + j);
      top.push({
        piece: `flare${b}`,
        x: L.x,
        y: L.y - BEAM_LIFT,
        rot: anim * 0.8,
        sx: s,
        sy: s,
        alpha: 0.75,
      });
    }
  });
  if (!o.lit && !o.reduced)
    ringGems().forEach((g, i) => {
      const tw = Math.max(0, Math.sin(anim * 2.4 + i * 1.7));
      top.push({
        piece: "glint",
        x: g.x,
        y: g.y - 4,
        sx: 0.6 + tw * 0.6,
        sy: 0.6 + tw * 0.6,
        alpha: 0.25 + tw * 0.75,
      });
    });
  for (const p of o.blinded)
    top.push({
      piece: "blind",
      x: p.x,
      y: p.y - BLIND_LIFT + Math.sin(anim * 3) * 1.5,
      sx: 1.15,
      sy: 1.15,
    });
  return { floor, stands, top };
}
/** Images a frame draws (for the budget notes and tests). */
export const atriumImages = (f: AtriumFrame) =>
  f.floor.length +
  f.top.length +
  f.stands.reduce((n, s) => n + s.items.length, 0);
/**
 * The server's mirror-turn flash (a raid-impact of radius 35 on a mirror):
 * the atrium rings its own chime for it, so the scene skips the plain ring.
 */
export function isMirrorTurnImpact(
  raid: { boss: string; mirrors?: { x: number; y: number }[] } | undefined,
  e: { kind: string; x: number; y: number; raidRadius?: number },
) {
  return (
    raid?.boss === "prismatail" &&
    e.kind === "raid-impact" &&
    e.raidRadius === 35 &&
    (raid.mirrors ?? []).some((m) => same(m, e.x, e.y))
  );
}
