/**
 * Somnara's Cloud Deck as painted pieces (raid-map-atlas.ts draws them once
 * into one atlas): gilded rune stones with lapis basins and enamel runes, the
 * light they throw, the correct-step ring and the wrong step's cracks, the
 * Nightmare's shockwave, the Quiet Zone's moonlit pool and the song's hush,
 * music notes, dream bubbles, dream trails, and the overhead markers (the
 * Dreamer's plaque, the rune-call tile, drowsy pips and the sleep Z).
 *
 * Pure Canvas 2D: each drawer takes (ctx, k), with ctx already scaled to
 * world units around the piece's centre (k = texels per unit). Gameplay edges
 * keep their exact radii: the pad's entry edge at SOMNARA.padRadius (56) and
 * its dashed ring at +9, the Quiet Zone's edge at the server's radius, the
 * dream bubble's rim at its radius (24) and the trail's edge at 45. Rune
 * colours and symbols are the game's own.
 */
import { SOMNARA, type DreamRune } from "../../../packages/shared/src/raid";
import type { Ctx, MapPiece } from "./raid-map-atlas";

const TAU = Math.PI * 2;
export const RUNES: DreamRune[] = ["circle", "star", "moon", "wave"];
/** The rune colours (unchanged from the flat drawing). */
export const RUNE: Record<DreamRune, string> = {
  circle: "#92efdb",
  star: "#ffdf8d",
  moon: "#d1b2ff",
  wave: "#8bceff",
};
// Light enamel cores and deep tints for each rune's material.
const CORE: Record<DreamRune, string> = {
  circle: "#e9fff8",
  star: "#fff6d8",
  moon: "#f3eaff",
  wave: "#e4f4ff",
};
const DEEP: Record<DreamRune, string> = {
  circle: "#1d5a55",
  star: "#6a4b1a",
  moon: "#4a3478",
  wave: "#1f4a78",
};
const MINT = "#99efdd",
  ROSE = "#ff647f",
  NIGHT = "#c090ff";
const PR = SOMNARA.padRadius;
/** Dream trail edge (the server dissolves bubbles within it). */
export const TRAIL_RADIUS = 45;

type Stops = [number, string][];
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rgba = (h: string, a: number) => {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const radial = (
  ctx: Ctx,
  x: number,
  y: number,
  r0: number,
  r1: number,
  stops: Stops,
) => {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
};
const disc = (ctx: Ctx, x: number, y: number, r: number) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
};

// ---- Rune glyph paths (same shapes and proportions as drawDreamRune) ----
function starPath(ctx: Ctx, s: number, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2,
      r = i % 2 ? s * inner : s;
    if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}
/** The crescent drawDreamRune makes by covering a disc, as one closed path. */
function moonPath(ctx: Ctx, s: number) {
  const R = s * 0.8,
    r = s * 0.7,
    bx = s * 0.45,
    by = -s * 0.3,
    d = Math.hypot(bx, by);
  const a = (R * R - r * r + d * d) / (2 * d),
    h = Math.sqrt(R * R - a * a);
  const ux = bx / d,
    uy = by / d,
    px = ux * a,
    py = uy * a;
  const p1 = [px - uy * h, py + ux * h],
    p2 = [px + uy * h, py - ux * h];
  const t1 = Math.atan2(p1[1], p1[0]),
    t2 = Math.atan2(p2[1], p2[0]);
  const f1 = Math.atan2(p1[1] - by, p1[0] - bx),
    f2 = Math.atan2(p2[1] - by, p2[0] - bx);
  const mid = (s0: number, s1: number) => {
    let e = s1;
    while (e < s0) e += TAU;
    return (s0 + e) / 2;
  };
  // Outer arc: the side away from the covering disc.
  let m = mid(t1, t2);
  const ccwA = Math.hypot(Math.cos(m) * R - bx, Math.sin(m) * R - by) < r;
  m = mid(f2, f1);
  const ccwB = Math.hypot(bx + Math.cos(m) * r, by + Math.sin(m) * r) > R;
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.arc(0, 0, R, t1, t2, ccwA);
  ctx.arc(bx, by, r, f2, f1, ccwB);
  ctx.closePath();
}
function wavePath(ctx: Ctx, s: number, row = s * 0.21, amp = s * 0.17) {
  ctx.beginPath();
  for (const dy of [-row, row])
    for (let i = 0; i <= 30; i++) {
      const x = -s + (i * s * 2) / 30,
        y = dy + Math.sin((i * TAU) / 30) * amp;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
}
/** Paint a glyph: filled runes fill, line runes stroke at width lw. */
function glyph(ctx: Ctx, rune: DreamRune, s: number, lw: number) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (rune === "circle") {
    disc(ctx, 0, 0, s * 0.7);
    ctx.lineWidth = lw;
    ctx.stroke();
  } else if (rune === "wave") {
    wavePath(ctx, s);
    ctx.lineWidth = lw;
    ctx.stroke();
  } else {
    if (rune === "star") starPath(ctx, s);
    else moonPath(ctx, s);
    ctx.fill();
    if (lw > 3.5) {
      ctx.lineWidth = lw - 3.5;
      ctx.stroke();
    }
  }
}
const glyphStyle = (ctx: Ctx, c: string | CanvasGradient) => {
  ctx.fillStyle = c;
  ctx.strokeStyle = c;
};

/** Fine marble veins inside the current clip. */
function veins(
  ctx: Ctx,
  r: number,
  rand: () => number,
  color: string,
  n: number,
) {
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    let x = (rand() - 0.5) * r * 2,
      y = (rand() - 0.5) * r * 2,
      a = rand() * TAU;
    ctx.lineWidth = 0.35 + rand() * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 5 + ((rand() * 6) | 0);
    for (let j = 0; j < steps; j++) {
      a += (rand() - 0.5) * 1.1;
      x += Math.cos(a) * (3 + rand() * 6);
      y += Math.sin(a) * (3 + rand() * 6);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
function sparkShape(ctx: Ctx, r: number, thin = 0.18) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2,
      rr = i % 2 ? r * thin : r;
    if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

// ======== Rune pads ========
/** Soft contact shadow under a raised pad. */
function padShadow(ctx: Ctx) {
  ctx.save();
  ctx.scale(1, 0.62);
  ctx.fillStyle = radial(ctx, 0, 0, 20, 82, [
    [0, "rgba(16,10,48,0.62)"],
    [0.55, "rgba(16,10,48,0.38)"],
    [1, "rgba(16,10,48,0)"],
  ]);
  disc(ctx, 0, 0, 82);
  ctx.fill();
  ctx.restore();
}
/** Light the pad throws on the marble around it. */
const padFloorLight = (rune: DreamRune) => (ctx: Ctx) => {
  const c = RUNE[rune];
  ctx.fillStyle = radial(ctx, 0, 0, 0, 112, [
    [0, rgba(c, 0)],
    [0.44, rgba(c, 0)],
    [0.53, rgba(c, 0.5)],
    [0.66, rgba(c, 0.2)],
    [1, rgba(c, 0)],
  ]);
  disc(ctx, 0, 0, 112);
  ctx.fill();
};
/**
 * The rune stone: a gilded bronze bezel set into the marble, a recessed basin
 * of night-blue lapis with veins and star flecks, a fine inner ring, and the
 * rune carved into it (groove only; its enamel is the glyph piece).
 */
const padStone = (rune: DreamRune, seed: number) => (ctx: Ctx) => {
  const rand = rng(seed);
  // Drum side: the stone stands a little proud of the floor.
  ctx.fillStyle = "#3a2a3e";
  disc(ctx, 1.2, 3.4, PR);
  ctx.fill();
  ctx.fillStyle = radial(ctx, 0, 3.4, PR - 6, PR, [
    [0, "#6b4d3a"],
    [1, "#2a1d2c"],
  ]);
  disc(ctx, 0.8, 2.6, PR);
  ctx.fill();
  // Gilded bezel, lit from the top left like the painting.
  const g = ctx.createLinearGradient(-PR, -PR, PR, PR);
  g.addColorStop(0, "#fff0c4");
  g.addColorStop(0.28, "#e2bb72");
  g.addColorStop(0.62, "#a77a3f");
  g.addColorStop(1, "#5e3f27");
  ctx.fillStyle = g;
  disc(ctx, 0, 0, PR);
  ctx.fill();
  // Brushed metal rings on the bezel.
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = i % 2 ? "rgba(255,240,200,0.18)" : "rgba(60,36,20,0.18)";
    ctx.lineWidth = 0.6;
    disc(ctx, 0, 0, PR - 1.6 - i * 1.5);
    ctx.stroke();
  }
  // Twelve engraved notches and four studs.
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12 + Math.PI / 12;
    const x = Math.cos(a) * (PR - 3.6),
      y = Math.sin(a) * (PR - 3.6);
    ctx.fillStyle = "rgba(48,28,22,0.55)";
    disc(ctx, x + 0.3, y + 0.3, 1.25);
    ctx.fill();
    ctx.fillStyle = "rgba(255,244,214,0.55)";
    disc(ctx, x - 0.25, y - 0.25, 0.6);
    ctx.fill();
  }
  for (let i = 0; i < 4; i++) {
    const a = (i * TAU) / 4 - Math.PI / 2,
      x = Math.cos(a) * (PR - 3.6),
      y = Math.sin(a) * (PR - 3.6);
    ctx.fillStyle = radial(ctx, x - 0.6, y - 0.6, 0, 2.6, [
      [0, "#fffbe8"],
      [0.5, RUNE[rune]],
      [1, DEEP[rune]],
    ]);
    disc(ctx, x, y, 2.4);
    ctx.fill();
  }
  // Chips and wear on the bezel's rim.
  for (let i = 0; i < 9; i++) {
    const a = rand() * TAU,
      r = PR - 0.8 - rand() * 1.2;
    ctx.fillStyle = "rgba(52,30,26,0.5)";
    ctx.beginPath();
    ctx.ellipse(
      Math.cos(a) * r,
      Math.sin(a) * r,
      1.6 + rand() * 1.6,
      0.7,
      a + Math.PI / 2,
      0,
      TAU,
    );
    ctx.fill();
  }
  // The recessed basin.
  const B = PR - 7.5;
  ctx.fillStyle = "#3b2a36";
  disc(ctx, 0, 0, B + 1.2);
  ctx.fill();
  ctx.save();
  disc(ctx, 0, 0, B);
  ctx.clip();
  ctx.fillStyle = radial(ctx, -B * 0.25, -B * 0.3, 2, B * 1.25, [
    [0, "#3c3f7c"],
    [0.5, "#252a5c"],
    [1, "#11153a"],
  ]);
  ctx.fillRect(-B, -B, B * 2, B * 2);
  // A tint of the rune's colour in the stone.
  ctx.fillStyle = radial(ctx, 0, 0, 0, B, [
    [0, rgba(RUNE[rune], 0.2)],
    [1, rgba(RUNE[rune], 0.04)],
  ]);
  ctx.fillRect(-B, -B, B * 2, B * 2);
  veins(ctx, B, rand, "rgba(190,180,255,0.16)", 14);
  veins(ctx, B, rand, "rgba(240,205,140,0.22)", 4);
  for (let i = 0; i < 46; i++) {
    const a = rand() * TAU,
      r = Math.sqrt(rand()) * B;
    ctx.fillStyle = `rgba(255,250,235,${0.25 + rand() * 0.55})`;
    disc(ctx, Math.cos(a) * r, Math.sin(a) * r, 0.25 + rand() * 0.55);
    ctx.fill();
  }
  // Recess: shadow under the top-left lip, light on the bottom-right wall.
  ctx.lineWidth = 7;
  ctx.strokeStyle = radial(ctx, -B * 0.5, -B * 0.55, 0, B * 1.9, [
    [0, "rgba(6,4,24,0.75)"],
    [0.55, "rgba(6,4,24,0.2)"],
    [1, "rgba(6,4,24,0)"],
  ]);
  disc(ctx, 0, 0, B);
  ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = radial(ctx, B * 0.6, B * 0.65, 0, B * 1.6, [
    [0, "rgba(255,232,190,0.4)"],
    [1, "rgba(255,232,190,0)"],
  ]);
  disc(ctx, 0, 0, B - 0.6);
  ctx.stroke();
  ctx.restore();
  // Fine gold inner ring and ticks, as in an astrolabe.
  ctx.strokeStyle = "rgba(232,196,122,0.55)";
  ctx.lineWidth = 0.8;
  disc(ctx, 0, 0, B - 6);
  ctx.stroke();
  for (let i = 0; i < 24; i++) {
    const a = (i * TAU) / 24,
      r0 = B - 6,
      r1 = B - (i % 6 ? 3.6 : 1.6);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();
  }
  // The carved groove the enamel sits in: dark wall top-left, lit lip bottom-right.
  ctx.save();
  ctx.translate(-0.9, -0.9);
  glyphStyle(ctx, "rgba(4,4,20,0.8)");
  glyph(ctx, rune, 24, 7.2);
  ctx.restore();
  ctx.save();
  ctx.translate(0.9, 0.9);
  glyphStyle(ctx, "rgba(255,226,170,0.45)");
  glyph(ctx, rune, 24, 6.2);
  ctx.restore();
  glyphStyle(ctx, "#0b0c26");
  glyph(ctx, rune, 24, 6);
};
/** The rune's enamel, always at full strength so the symbol stays readable. */
const padGlyph =
  (rune: DreamRune, s = 24, lw = 4.2) =>
  (ctx: Ctx) => {
    const g = radial(ctx, -s * 0.3, -s * 0.35, 0, s * 1.3, [
      [0, CORE[rune]],
      [0.18, RUNE[rune]],
      [1, RUNE[rune]],
    ]);
    glyphStyle(ctx, g);
    glyph(ctx, rune, s, lw);
    // A glassy highlight along the top-left of the enamel.
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.ellipse(-s * 0.35, -s * 0.5, s * 0.8, s * 0.32, -0.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  };
/** A soft halo of the glyph's colour (additive, inside the dark basin). */
const padGlyphGlow = (rune: DreamRune) => (ctx: Ctx, k: number) => {
  ctx.shadowColor = RUNE[rune];
  ctx.shadowBlur = 9 * k;
  glyphStyle(ctx, rgba(RUNE[rune], 0.7));
  glyph(ctx, rune, 24, 6);
  ctx.shadowBlur = 16 * k;
  glyph(ctx, rune, 24, 6);
};
/** The basin lights up from inside when its rune is called (additive, dark basin). */
const padBasinGlow = (color: string) => (ctx: Ctx) => {
  ctx.fillStyle = radial(ctx, 0, 0, 0, PR - 7, [
    [0, rgba(color, 0.55)],
    [0.7, rgba(color, 0.32)],
    [1, rgba(color, 0.08)],
  ]);
  disc(ctx, 0, 0, PR - 7);
  ctx.fill();
};
/**
 * The exact entry radius as a crisp line: the edge you cross to step on the
 * pad (SOMNARA.padRadius), and the thin dashed ring at +9.
 */
const padEdge = (rune: DreamRune, w: number) => (ctx: Ctx) => {
  ctx.strokeStyle = RUNE[rune];
  ctx.lineWidth = w;
  disc(ctx, 0, 0, PR);
  ctx.stroke();
  ctx.strokeStyle = rgba(RUNE[rune], 0.5);
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  disc(ctx, 0, 0, PR + 9);
  ctx.stroke();
};
/** A soft ring of light on the pad's edge. */
const rimGlow = (color: string, r: number, width: number) => (ctx: Ctx) => {
  ctx.fillStyle = radial(ctx, 0, 0, r - width, r + width, [
    [0, rgba(color, 0)],
    [0.5, rgba(color, 0.75)],
    [1, rgba(color, 0)],
  ]);
  disc(ctx, 0, 0, r + width);
  ctx.fill();
};
/** Four-point twinkle, tinted. */
const spark = (color: string, r: number) => (ctx: Ctx) => {
  ctx.fillStyle = radial(ctx, 0, 0, 0, r * 0.6, [
    [0, rgba(color, 0.7)],
    [1, rgba(color, 0)],
  ]);
  disc(ctx, 0, 0, r * 0.6);
  ctx.fill();
  ctx.fillStyle = radial(ctx, 0, 0, 0, r, [
    [0, "#ffffff"],
    [0.35, color],
    [1, rgba(color, 0.2)],
  ]);
  sparkShape(ctx, r);
  ctx.fill();
};
/** Sharp five-point star (orbits a called pad, as before). */
const orbitStar = (color: string) => (ctx: Ctx) => {
  ctx.fillStyle = radial(ctx, 0, 0, 0, 9, [
    [0, rgba(color, 0.55)],
    [1, rgba(color, 0)],
  ]);
  disc(ctx, 0, 0, 9);
  ctx.fill();
  ctx.fillStyle = radial(ctx, -1, -1.4, 0, 5, [
    [0, "#ffffff"],
    [0.5, color],
    [1, color],
  ]);
  starPath(ctx, 4.6);
  ctx.fill();
};
/** A correct step: an expanding mint ring (scaled out per frame). */
function ringMint(ctx: Ctx) {
  ctx.fillStyle = radial(ctx, 0, 0, 44, 66, [
    [0, rgba(MINT, 0)],
    [0.55, rgba(MINT, 0.6)],
    [0.7, "rgba(220,255,245,0.6)"],
    [1, rgba(MINT, 0)],
  ]);
  disc(ctx, 0, 0, 66);
  ctx.fill();
}
/** A wrong step: the lapis cracks, rose light in the seams. */
function padCracks(ctx: Ctx) {
  const rand = rng(77);
  const lines: [number, number][][] = [];
  for (let i = 0; i < 7; i++) {
    let a = (i * TAU) / 7 + (rand() - 0.5) * 0.6,
      x = (rand() - 0.5) * 6,
      y = (rand() - 0.5) * 6;
    const pts: [number, number][] = [[x, y]];
    while (Math.hypot(x, y) < PR - 9) {
      a += (rand() - 0.5) * 0.9;
      const step = 5 + rand() * 6;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      pts.push([x, y]);
      if (rand() < 0.25)
        lines.push([
          [x, y],
          [x + Math.cos(a + 1) * 7, y + Math.sin(a + 1) * 7],
        ]);
    }
    lines.push(pts);
  }
  ctx.save();
  disc(ctx, 0, 0, PR - 7.5);
  ctx.clip();
  const path = (w: number, c: string) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const pts of lines) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
  };
  path(4.2, "rgba(255,100,127,0.28)");
  path(2.2, "rgba(10,4,16,0.9)");
  path(0.9, "#ffc1cc");
  ctx.restore();
}
/** Radius of the Nightmare ring piece's bright crest (scaled to 500 per frame). */
export const NIGHT_RING_RADIUS = 135.5;
/** The Nightmare's shockwave from the whale. */
function nightRing(ctx: Ctx) {
  ctx.fillStyle = rgba(NIGHT, 0.07);
  disc(ctx, 0, 0, 132);
  ctx.fill();
  ctx.fillStyle = radial(ctx, 0, 0, 122, 140, [
    [0, rgba(NIGHT, 0)],
    [0.55, rgba(NIGHT, 0.45)],
    [0.75, "rgba(236,214,255,0.9)"],
    [0.86, rgba(NIGHT, 0.4)],
    [1, rgba(NIGHT, 0)],
  ]);
  disc(ctx, 0, 0, 140);
  ctx.fill();
}

// ======== Quiet Zone (Whale Song) ========
/** A pool of moonlit hush on the marble; its edge is exactly at the server's radius R. */
const quietPool = (R: number) => (ctx: Ctx) => {
  ctx.fillStyle = radial(ctx, 0, 0, 0, R, [
    [0, "rgba(146,239,219,0.14)"],
    [0.75, "rgba(146,239,219,0.2)"],
    [0.95, "rgba(146,239,219,0.34)"],
    [1, "rgba(146,239,219,0.4)"],
  ]);
  disc(ctx, 0, 0, R);
  ctx.fill();
  // Ripples of the song across the pool.
  ctx.strokeStyle = "rgba(217,255,241,0.16)";
  ctx.lineWidth = 1.2;
  for (const f of [0.32, 0.55, 0.76]) {
    disc(ctx, 0, 0, R * f);
    ctx.stroke();
  }
  // Dotted inner ring (R - 9) and the crisp safe edge at R.
  ctx.strokeStyle = "rgba(217,255,241,0.85)";
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 7]);
  ctx.lineCap = "round";
  disc(ctx, 0, 0, R - 9);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(6,40,44,0.55)";
  ctx.lineWidth = 6;
  disc(ctx, 0, 0, R + 2.5);
  ctx.stroke();
  ctx.strokeStyle = "#92efdb";
  ctx.lineWidth = 4;
  disc(ctx, 0, 0, R);
  ctx.stroke();
  ctx.strokeStyle = "rgba(240,255,250,0.9)";
  ctx.lineWidth = 1.2;
  disc(ctx, 0, 0, R - 1);
  ctx.stroke();
};
/** Moonlight inside the pool. */
const quietGlow = (R: number) => (ctx: Ctx) => {
  ctx.fillStyle = radial(ctx, 0, 0, 0, R + 18, [
    [0, "rgba(146,239,219,0.28)"],
    [0.8, "rgba(146,239,219,0.12)"],
    [0.93, "rgba(200,255,240,0.32)"],
    [1, "rgba(146,239,219,0)"],
  ]);
  disc(ctx, 0, 0, R + 18);
  ctx.fill();
};
/** The song's rose hush over the deck, darker at the edges (stretched over the arena). */
function hushVeil(ctx: Ctx) {
  ctx.fillStyle = "rgba(212,76,125,0.11)";
  ctx.fillRect(-80, -45, 160, 90);
  ctx.save();
  ctx.scale(1, 0.5625);
  ctx.fillStyle = radial(ctx, 0, 0, 40, 95, [
    [0, "rgba(60,10,50,0)"],
    [1, "rgba(80,14,60,0.22)"],
  ]);
  ctx.fillRect(-80, -80, 160, 160);
  ctx.restore();
}
function noteShape(ctx: Ctx) {
  ctx.beginPath();
  ctx.ellipse(-3, 7, 5.4, 3.7, -0.35, 0, TAU);
  ctx.fill();
  ctx.fillRect(1.4, -11, 1.8, 18);
  ctx.beginPath();
  ctx.moveTo(3.2, -11);
  ctx.bezierCurveTo(9, -8, 10, -4, 7.5, 0);
  ctx.bezierCurveTo(8, -4, 6, -6, 3.2, -6.5);
  ctx.closePath();
  ctx.fill();
}
/** An ivory music note with a soft glow. */
const note = (color: string) => (ctx: Ctx, k: number) => {
  ctx.shadowColor = rgba(color, 0.9);
  ctx.shadowBlur = 5 * k;
  ctx.fillStyle = color;
  noteShape(ctx);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(-4.2, 5.8, 2, 1.1, -0.35, 0, TAU);
  ctx.fill();
};

// ======== Dream Bubbles, Dream Trails ========
/** A floating soap bubble with a fresnel rim, at exactly SOMNARA.bubbles.radius. */
function bubble(ctx: Ctx) {
  const R = SOMNARA.bubbles.radius;
  ctx.fillStyle = radial(ctx, -4, -5, 0, R, [
    [0, "rgba(255,255,255,0.05)"],
    [0.6, "rgba(211,181,255,0.14)"],
    [0.86, "rgba(186,150,255,0.32)"],
    [1, "rgba(255,190,240,0.55)"],
  ]);
  disc(ctx, 0, 0, R);
  ctx.fill();
  // Iridescent bands along the rim.
  const bands: [string, number, number][] = [
    ["rgba(140,230,255,0.55)", 0.4, 1.6],
    ["rgba(255,170,230,0.55)", 2.2, 3.4],
    ["rgba(255,236,160,0.45)", 4.0, 4.9],
  ];
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  for (const [c, a0, a1] of bands) {
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.arc(0, 0, R - 2.4, a0, a1);
    ctx.stroke();
  }
  ctx.strokeStyle = "#c9a3ff";
  ctx.lineWidth = 2.5;
  disc(ctx, 0, 0, R - 0.2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(0, 0, R - 1.6, Math.PI * 1.05, Math.PI * 1.6);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.ellipse(-8, -10, 5, 2.8, -0.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  disc(ctx, 9.5, 8.5, 1.6);
  ctx.fill();
}
/** The star inside a bubble: faceted gold. */
function bubbleStar(ctx: Ctx) {
  ctx.fillStyle = radial(ctx, 0, 0, 0, 12, [
    [0, "rgba(255,226,160,0.5)"],
    [1, "rgba(255,226,160,0)"],
  ]);
  disc(ctx, 0, 0, 12);
  ctx.fill();
  const s = 7.5;
  for (let i = 0; i < 5; i++) {
    const a = (i * TAU) / 5 - Math.PI / 2,
      b = a + Math.PI / 5,
      c = a - Math.PI / 5;
    for (const [o, col] of [
      [b, i < 2 || i === 4 ? "#fff3c8" : "#e2a94a"],
      [c, i < 3 && i > 0 ? "#f7cf6c" : "#ffe9a8"],
    ] as [number, string][]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
      ctx.lineTo(Math.cos(o) * s * 0.45, Math.sin(o) * s * 0.45);
      ctx.closePath();
      ctx.fill();
    }
  }
}
function bubbleShadow(ctx: Ctx) {
  ctx.save();
  ctx.scale(1, 0.4);
  ctx.fillStyle = radial(ctx, 0, 0, 0, 22, [
    [0, "rgba(40,16,80,0.42)"],
    [1, "rgba(40,16,80,0)"],
  ]);
  disc(ctx, 0, 0, 22);
  ctx.fill();
  ctx.restore();
}
/** Duskveil's dream trail: a puff of violet mist, dashed edge at radius 45. */
function mist(ctx: Ctx) {
  const rand = rng(9);
  for (let i = 0; i < 9; i++) {
    const a = rand() * TAU,
      r = rand() * 18,
      x = Math.cos(a) * r,
      y = Math.sin(a) * r,
      s = 18 + rand() * 14;
    ctx.fillStyle = radial(ctx, x, y, 0, s, [
      [0, "rgba(84,46,150,0.34)"],
      [1, "rgba(84,46,150,0)"],
    ]);
    disc(ctx, x, y, s);
    ctx.fill();
  }
  ctx.fillStyle = radial(ctx, -6, -8, 0, 30, [
    [0, "rgba(230,215,255,0.16)"],
    [1, "rgba(230,215,255,0)"],
  ]);
  disc(ctx, -6, -8, 30);
  ctx.fill();
  for (let i = 0; i < 9; i++) {
    const a = rand() * TAU,
      r = Math.sqrt(rand()) * 38;
    ctx.fillStyle = `rgba(240,230,255,${0.4 + rand() * 0.5})`;
    disc(ctx, Math.cos(a) * r, Math.sin(a) * r, 0.5 + rand() * 0.8);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(60,30,120,0.35)";
  ctx.lineWidth = 3;
  disc(ctx, 0, 0, TRAIL_RADIUS - 0.5);
  ctx.stroke();
  ctx.strokeStyle = "rgba(214,184,255,0.75)";
  ctx.lineWidth = 1.6;
  ctx.setLineDash([5, 5]);
  disc(ctx, 0, 0, TRAIL_RADIUS);
  ctx.stroke();
}

// ======== Over-head markers ========
/** Drowsy pip: a lit moon-pearl, or an empty dark socket. */
const pip = (lit: boolean) => (ctx: Ctx) => {
  ctx.fillStyle = "rgba(10,8,30,0.6)";
  disc(ctx, 0.4, 0.8, 6.6);
  ctx.fill();
  if (lit) {
    ctx.fillStyle = radial(ctx, -1.6, -1.8, 0, 6, [
      [0, "#ffffff"],
      [0.35, "#e2ccff"],
      [0.8, "#c9a3ff"],
      [1, "#8e64d8"],
    ]);
    disc(ctx, 0, 0, 5.4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,240,205,0.9)";
    ctx.lineWidth = 1;
    disc(ctx, 0, 0, 5.6);
    ctx.stroke();
  } else {
    ctx.fillStyle = radial(ctx, 1, 1.2, 0, 6, [
      [0, "#2a3560"],
      [1, "#141a36"],
    ]);
    disc(ctx, 0, 0, 5.4);
    ctx.fill();
    ctx.strokeStyle = "rgba(201,163,255,0.55)";
    ctx.lineWidth = 1;
    disc(ctx, 0, 0, 5.6);
    ctx.stroke();
  }
};
/** Sleep "Z" as a little cloud letter: ivory, outlined in deep violet. */
const sleepZ = (s: number) => (ctx: Ctx) => {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-8 * s, 0);
    ctx.lineTo(8 * s, 0);
    ctx.lineTo(-8 * s, 14 * s);
    ctx.lineTo(8 * s, 14 * s);
  };
  ctx.translate(0, -7 * s);
  path();
  ctx.strokeStyle = "rgba(42,24,90,0.85)";
  ctx.lineWidth = 7 * s;
  ctx.stroke();
  path();
  ctx.strokeStyle = "#e4d8ff";
  ctx.lineWidth = 3.6 * s;
  ctx.stroke();
  path();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1.2 * s;
  ctx.translate(-0.6, -0.6);
  ctx.stroke();
};
/** Night-glass plaque body with a gilt edge. */
function plaqueBody(ctx: Ctx, w: number, h: number, r: number) {
  ctx.fillStyle = "rgba(6,6,24,0.45)";
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 1, -h / 2 + 2.5, w, h, r);
  ctx.fill();
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, "#28305e");
  g.addColorStop(0.5, "#151b3d");
  g.addColorStop(1, "#0e1230");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, r);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 2, -h / 2 + 1.5, w - 4, h * 0.42, [
    r - 2,
    r - 2,
    2,
    2,
  ]);
  ctx.stroke();
  const e = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  e.addColorStop(0, "#f6dc9c");
  e.addColorStop(0.5, "#b88a4a");
  e.addColorStop(1, "#e2bd78");
  ctx.strokeStyle = e;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, r);
  ctx.stroke();
}
/** One slice of the Dreamer's panel: left cap, stretchable middle, right cap. */
const plaqueSlice = (part: "L" | "M" | "R") => (ctx: Ctx) => {
  const W = 60,
    H = 40;
  ctx.save();
  ctx.beginPath();
  if (part === "L") {
    ctx.rect(-8, -26, 16, 52);
    ctx.translate(-8 + W / 2, 0);
  } else if (part === "R") {
    ctx.rect(-8, -26, 16, 52);
    ctx.translate(8 - W / 2, 0);
  } else ctx.rect(-2, -26, 4, 52);
  ctx.clip();
  plaqueBody(ctx, W, H, 10);
  ctx.restore();
};
/** The rune-call speech tile (44 x 42), with a small tail toward the caller. */
function callTile(ctx: Ctx) {
  ctx.save();
  ctx.translate(-22, 21);
  ctx.fillStyle = "#151b3d";
  ctx.strokeStyle = "#d9b46c";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(4, -6);
  ctx.lineTo(-5, 7);
  ctx.lineTo(12, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  plaqueBody(ctx, 44, 42, 10);
}
/** A small enamel rune coin for the panels. */
const runeCoin = (rune: DreamRune, s: number) => (ctx: Ctx) => {
  ctx.fillStyle = radial(ctx, 0, 0, 0, s * 1.15, [
    [0, rgba(RUNE[rune], 0.28)],
    [1, rgba(RUNE[rune], 0)],
  ]);
  disc(ctx, 0, 0, s * 1.15);
  ctx.fill();
  const g = radial(ctx, -s * 0.3, -s * 0.35, 0, s * 1.3, [
    [0, CORE[rune]],
    [0.5, RUNE[rune]],
    [1, RUNE[rune]],
  ]);
  ctx.save();
  ctx.translate(0.5, 0.8);
  glyphStyle(ctx, "rgba(0,0,16,0.6)");
  glyph(ctx, rune, s, 3.4);
  ctx.restore();
  glyphStyle(ctx, g);
  glyph(ctx, rune, s, 3);
};
/** The backwards arrow: gold, a head and a stretchable shaft. */
function arrowHead(ctx: Ctx) {
  ctx.fillStyle = "rgba(20,10,40,0.6)";
  ctx.beginPath();
  ctx.moveTo(-6, 1);
  ctx.lineTo(4, -5);
  ctx.lineTo(4, 7);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, -6, 0, 6);
  g.addColorStop(0, "#fff1c2");
  g.addColorStop(1, "#e0a944");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(4, -6);
  ctx.lineTo(4, 6);
  ctx.closePath();
  ctx.fill();
}
function arrowShaft(ctx: Ctx) {
  ctx.fillStyle = "rgba(20,10,40,0.6)";
  ctx.fillRect(-2, -0.6, 4, 4);
  const g = ctx.createLinearGradient(0, -1.8, 0, 1.8);
  g.addColorStop(0, "#fff1c2");
  g.addColorStop(1, "#e0a944");
  ctx.fillStyle = g;
  ctx.fillRect(-2, -1.6, 4, 3.2);
}

// ======== Floor bake: the constellation inlay ring (r 275 around the whale) ========
/** Where the constellation ring and its twelve gems sit. */
export const CONSTELLATION = { x: 800, y: 450, r: 275 };
/** Baked once into the floor picture: a gold inlay ring with twelve star gems. */
export function paintConstellationInlay(c: Ctx) {
  const { x: cx, y: cy, r: R } = CONSTELLATION;
  c.save();
  c.translate(cx, cy);
  c.strokeStyle = "rgba(40,20,80,0.32)";
  c.lineWidth = 7;
  disc(c, 0.8, 1.2, R);
  c.stroke();
  c.strokeStyle = "rgba(226,190,120,0.55)";
  c.lineWidth = 2;
  disc(c, 0, 0, R);
  c.stroke();
  c.strokeStyle = "rgba(255,246,220,0.45)";
  c.lineWidth = 0.8;
  disc(c, -0.6, -0.6, R);
  c.stroke();
  c.strokeStyle = "rgba(201,163,255,0.4)";
  c.lineWidth = 1;
  disc(c, 0, 0, R - 7);
  c.stroke();
  for (let i = 0; i < 96; i++) {
    if (i % 8 === 0) continue;
    const a = (i * TAU) / 96;
    c.fillStyle = "rgba(240,215,160,0.55)";
    disc(c, Math.cos(a) * (R - 7), Math.sin(a) * (R - 7), 0.9);
    c.fill();
  }
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      x = Math.cos(a) * R,
      y = Math.sin(a) * R;
    c.fillStyle = "rgba(30,14,60,0.4)";
    disc(c, x + 1, y + 1.4, 6);
    c.fill();
    c.fillStyle = radial(c, x - 2, y - 2, 0, 7.5, [
      [0, "#fff4cf"],
      [0.5, "#d6a85c"],
      [1, "#6e4a2a"],
    ]);
    disc(c, x, y, 5.2);
    c.fill();
    c.fillStyle = radial(c, x - 1, y - 1.2, 0, 3.6, [
      [0, "#ffffff"],
      [0.4, "#efe6ff"],
      [1, "#9b7fe0"],
    ]);
    c.save();
    c.translate(x, y);
    sparkShape(c, 4.6, 0.34);
    c.fill();
    c.restore();
  }
  c.restore();
}

/** The Cloud Deck's pieces, with the Quiet Zone drawn at radius `quiet`. */
export function cloudDeckPieces(quiet: number): MapPiece[] {
  const P: MapPiece[] = [];
  const add = (
    name: string,
    w: number,
    h: number,
    draw: MapPiece["draw"],
    res = 1,
  ) => P.push({ name, w, h, draw, res });
  // res < 1: soft glows are drawn at lower resolution (they are smooth anyway).
  add("padShadow", 170, 110, padShadow, 0.5);
  RUNES.forEach((r, i) => {
    add(`floor-${r}`, 226, 226, padFloorLight(r), 0.5);
    add(`stone-${r}`, 120, 122, padStone(r, 31 + i * 17));
    add(`glyph-${r}`, 56, 56, padGlyph(r));
    add(`glyphGlow-${r}`, 100, 100, padGlyphGlow(r), 0.5);
    add(`basin-${r}`, 100, 100, padBasinGlow(RUNE[r]), 0.5);
    add(`edge-${r}`, 134, 134, padEdge(r, 2.4));
    add(`edgeHot-${r}`, 134, 134, padEdge(r, 4));
    add(`rim-${r}`, 150, 150, rimGlow(RUNE[r], PR, 13), 0.5);
    add(`orbit-${r}`, 20, 20, orbitStar(RUNE[r]));
    add(`coinS-${r}`, 34, 34, runeCoin(r, 13));
    add(`coinT-${r}`, 30, 30, runeCoin(r, 11));
  });
  add("basin-mint", 100, 100, padBasinGlow(MINT), 0.5);
  add("basin-rose", 100, 100, padBasinGlow(ROSE), 0.5);
  add("rim-mint", 150, 150, rimGlow(MINT, PR, 13), 0.5);
  add("rim-rose", 150, 150, rimGlow(ROSE, PR, 13), 0.5);
  add("ringMint", 134, 134, ringMint, 0.5);
  add("sparkMint", 18, 18, spark(MINT, 8));
  add("sparkLilac", 18, 18, spark("#e7d7ff", 8));
  add("cracks", 100, 100, padCracks);
  add("nightRing", 284, 284, nightRing, 0.5);
  add(`quiet-${quiet}`, quiet * 2 + 12, quiet * 2 + 12, quietPool(quiet));
  add(
    `quietGlow-${quiet}`,
    quiet * 2 + 40,
    quiet * 2 + 40,
    quietGlow(quiet),
    0.5,
  );
  add("hush", 160, 90, hushVeil, 0.5);
  add("noteIvory", 30, 36, note("#f4ecff"));
  add("noteMint", 30, 36, note("#d9fff1"));
  add("bubble", 52, 52, bubble);
  add("bubbleStar", 26, 26, bubbleStar);
  add("bubbleShadow", 48, 22, bubbleShadow, 0.5);
  add("mist", 96, 96, mist);
  add("pipOn", 16, 16, pip(true));
  add("pipOff", 16, 16, pip(false));
  add("zBig", 28, 28, sleepZ(1));
  add("zSmall", 18, 18, sleepZ(0.55));
  add("plaqueL", 16, 52, plaqueSlice("L"));
  add("plaqueM", 4, 52, plaqueSlice("M"));
  add("plaqueR", 16, 52, plaqueSlice("R"));
  add("callTile", 54, 56, callTile);
  add("arrowHead", 16, 16, arrowHead);
  add("arrowShaft", 4, 8, arrowShaft);
  add("gemGlow", 20, 20, spark("#e9dcff", 9));
  return P;
}
