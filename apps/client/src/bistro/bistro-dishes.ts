/**
 * The dishes, drawn closer to the real thing: glazed porcelain with a rim,
 * a foot and a shine, glass that shows what is inside, and food with its
 * own texture (grains, char marks, translucent rice paper, broth with fat
 * glinting on it). Each dish is drawn at (x, y), its plate's centre, `s` its
 * radius in world units; `k = s / 20` is one unit of the drawings below.
 *
 * `drawDishBody` is the still part (bistro-art caches it as a bitmap per
 * size); `drawDishLive` is what moves (bubbles, sizzle) and is drawn every
 * frame on top.
 */
import type { DishId } from "../../../../packages/shared/src/bistro";

type Ctx = CanvasRenderingContext2D;
type Stops = [number, string][];
const TAU = Math.PI * 2;

/* ───────────── helpers ───────────── */

/** Lighter (f > 0) or darker (f < 0) "#rrggbb". */
function tone(col: string, f: number): string {
  const n = parseInt(col.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  if (f >= 0) {
    r += (255 - r) * f;
    g += (255 - g) * f;
    b += (255 - b) * f;
  } else {
    r *= 1 + f;
    g *= 1 + f;
    b *= 1 + f;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
/** A steady pseudo-random number in [0, 1). */
const rnd = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
function el(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.05, rx), Math.max(0.05, ry), rot, 0, TAU);
}
function lin(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  s: Stops,
) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of s) g.addColorStop(o, c);
  return g;
}
function rad(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  s: Stops,
  x1 = x,
  y1 = y,
  r0 = 0,
) {
  const g = ctx.createRadialGradient(x, y, r0, x1, y1, Math.max(0.1, r));
  for (const [o, c] of s) g.addColorStop(o, c);
  return g;
}
/** A soft shadow on the table under something. */
function shadow(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  a = 0.25,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = rad(ctx, 0, 0, rx, [
    [0, `rgba(30,18,8,${a})`],
    [0.6, `rgba(30,18,8,${a * 0.6})`],
    [1, "rgba(30,18,8,0)"],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}
/** A white glint. */
function glint(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  a = 0.7,
  rot = 0,
) {
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  el(ctx, x, y, rx, ry, rot);
  ctx.fill();
}
/** Draw `fn` clipped to an ellipse. */
function inEllipse(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fn: () => void,
) {
  ctx.save();
  el(ctx, x, y, rx, ry);
  ctx.clip();
  fn();
  ctx.restore();
}
/** Small dots scattered in an ellipse (grains, pepper, sesame). */
function speckle(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  n: number,
  col: string,
  size: number,
  seed: number,
) {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const a = rnd(seed + i * 3.1) * TAU,
      d = Math.sqrt(rnd(seed + i * 7.7));
    el(
      ctx,
      x + Math.cos(a) * rx * d,
      y + Math.sin(a) * ry * d,
      size,
      size * 0.7,
      a,
    );
    ctx.fill();
  }
}
/** A herb leaf with its middle vein. */
function leaf(
  ctx: Ctx,
  x: number,
  y: number,
  len: number,
  w: number,
  rot: number,
  col: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = lin(ctx, 0, -w, 0, w, [
    [0, tone(col, 0.25)],
    [1, tone(col, -0.25)],
  ]);
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.quadraticCurveTo(0, -w * 1.4, len / 2, 0);
  ctx.quadraticCurveTo(0, w * 1.4, -len / 2, 0);
  ctx.fill();
  ctx.strokeStyle = tone(col, -0.35);
  ctx.lineWidth = Math.max(0.15, w * 0.18);
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.lineTo(len * 0.4, 0);
  ctx.stroke();
  ctx.restore();
}
/** Curly strands (noodles) inside an ellipse. */
function strands(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  n: number,
  col: string,
  width: number,
  seed: number,
) {
  inEllipse(ctx, x, y, rx, ry, () => {
    ctx.strokeStyle = col;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const yy = y - ry + ((i + 0.5) / n) * ry * 2;
      const ph = rnd(seed + i) * TAU;
      ctx.beginPath();
      ctx.moveTo(x - rx, yy);
      for (let j = 1; j <= 6; j++) {
        const xx = x - rx + (j / 6) * rx * 2;
        ctx.quadraticCurveTo(
          xx - rx / 6,
          yy + Math.sin(ph + j * 1.7) * ry * 0.35,
          xx,
          yy + Math.sin(ph + j * 2.3) * ry * 0.12,
        );
      }
      ctx.stroke();
    }
  });
}

/* ───────────── tableware ───────────── */

/** A porcelain plate: its edge's thickness, a shallow well, a rim line. */
function plate(ctx: Ctx, x: number, y: number, r: number, band = "#4d86b8") {
  const ry = r * 0.4;
  shadow(ctx, x + r * 0.05, y + r * 0.14, r * 1.1, ry * 1.2, 0.3);
  ctx.fillStyle = lin(ctx, x - r, 0, x + r, 0, [
    [0, "#d6cec1"],
    [0.45, "#ece6dc"],
    [1, "#bfb5a6"],
  ]);
  el(ctx, x, y + r * 0.07, r, ry);
  ctx.fill();
  ctx.fillStyle = rad(ctx, x - r * 0.3, y - ry * 0.6, r * 1.1, [
    [0, "#ffffff"],
    [0.65, "#f7f3ec"],
    [1, "#e6dfd3"],
  ]);
  el(ctx, x, y, r, ry);
  ctx.fill();
  // The well: darker at the back, where the rim shades it.
  ctx.fillStyle = lin(ctx, 0, y - ry * 0.7, 0, y + ry * 0.7, [
    [0, "#ddd4c6"],
    [0.4, "#f1ece4"],
    [1, "#fbf9f5"],
  ]);
  el(ctx, x, y + ry * 0.05, r * 0.7, ry * 0.68);
  ctx.fill();
  if (band) {
    ctx.strokeStyle = band;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = Math.max(0.3, r * 0.03);
    el(ctx, x, y, r * 0.86, ry * 0.84);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = "rgba(255,255,255,.95)";
  ctx.lineWidth = Math.max(0.3, r * 0.035);
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.95, ry * 0.92, 0, Math.PI * 1.08, Math.PI * 1.45);
  ctx.stroke();
}
interface BowlLook {
  glaze: string;
  /** The inside's colour (default white porcelain). */
  inner?: string;
  /** A painted ring under the rim. */
  band?: string;
  depth?: number;
}
/** A bowl seen from above the side; returns where its contents' surface is. */
function bowl(ctx: Ctx, x: number, y: number, r: number, look: BowlLook) {
  const ry = r * 0.34,
    d = (look.depth ?? 0.8) * r,
    g = look.glaze;
  shadow(ctx, x + r * 0.08, y + d * 0.98, r * 0.95, r * 0.3, 0.32);
  ctx.fillStyle = tone(g, -0.4);
  el(ctx, x, y + d * 0.95, r * 0.42, r * 0.1);
  ctx.fill();
  ctx.fillStyle = lin(ctx, x - r, 0, x + r, 0, [
    [0, tone(g, 0.1)],
    [0.3, g],
    [0.75, tone(g, -0.18)],
    [1, tone(g, -0.4)],
  ]);
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.bezierCurveTo(
    x - r,
    y + d * 0.62,
    x - r * 0.55,
    y + d * 0.95,
    x,
    y + d * 0.95,
  );
  ctx.bezierCurveTo(x + r * 0.55, y + d * 0.95, x + r, y + d * 0.62, x + r, y);
  ctx.ellipse(x, y, r, ry, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fill();
  if (look.band) {
    ctx.strokeStyle = look.band;
    ctx.lineWidth = Math.max(0.3, r * 0.06);
    ctx.beginPath();
    ctx.ellipse(x, y + d * 0.2, r * 0.96, ry, 0, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.lineWidth = Math.max(0.2, r * 0.025);
    ctx.beginPath();
    ctx.ellipse(x, y + d * 0.32, r * 0.9, ry * 0.95, 0, 0.25, Math.PI - 0.25);
    ctx.stroke();
  }
  // The shine down the lit side.
  glint(ctx, x - r * 0.62, y + d * 0.42, r * 0.07, d * 0.26, 0.4, 0.3);
  // The rim's lip, then the inside (the far wall lit, the near one in shadow).
  ctx.fillStyle = tone(look.inner ?? "#f6f3ee", 0.4);
  el(ctx, x, y, r, ry);
  ctx.fill();
  const inner = look.inner ?? "#f3efe8";
  ctx.fillStyle = lin(ctx, 0, y - ry, 0, y + ry, [
    [0, tone(inner, 0.2)],
    [0.55, inner],
    [1, tone(inner, -0.3)],
  ]);
  el(ctx, x, y + ry * 0.05, r * 0.93, ry * 0.86);
  ctx.fill();
  return { cx: x, cy: y + ry * 0.2, rx: r * 0.85, ry: ry * 0.68 };
}
/** A liquid's surface: darker at the edge, a little sheen. */
function broth(
  ctx: Ctx,
  s: { cx: number; cy: number; rx: number; ry: number },
  col: string,
) {
  ctx.fillStyle = rad(ctx, s.cx - s.rx * 0.25, s.cy - s.ry * 0.3, s.rx, [
    [0, tone(col, 0.18)],
    [0.7, col],
    [1, tone(col, -0.3)],
  ]);
  el(ctx, s.cx, s.cy, s.rx, s.ry);
  ctx.fill();
}
/** Little drops of fat or oil glinting on a broth. */
function fatDrops(
  ctx: Ctx,
  s: { cx: number; cy: number; rx: number; ry: number },
  n: number,
  seed: number,
  col = "rgba(255,236,170,.75)",
) {
  for (let i = 0; i < n; i++) {
    const a = rnd(seed + i) * TAU,
      d = 0.25 + rnd(seed + i * 5) * 0.65;
    const px = s.cx + Math.cos(a) * s.rx * d,
      py = s.cy + Math.sin(a) * s.ry * d,
      rr = s.rx * (0.025 + rnd(seed + i * 9) * 0.04);
    ctx.strokeStyle = col;
    ctx.lineWidth = rr * 0.5;
    el(ctx, px, py, rr, rr * 0.55);
    ctx.stroke();
  }
}
/** A tall drinking glass's front: drawn over what is inside it. */
function glassFront(
  ctx: Ctx,
  x: number,
  top: number,
  bottom: number,
  wTop: number,
  wBot: number,
) {
  ctx.strokeStyle = "rgba(255,255,255,.75)";
  ctx.lineWidth = Math.max(0.3, wTop * 0.06);
  ctx.beginPath();
  ctx.moveTo(x - wTop, top);
  ctx.lineTo(x - wBot, bottom);
  ctx.moveTo(x + wTop, top);
  ctx.lineTo(x + wBot, bottom);
  ctx.stroke();
  // Reflections: a broad soft one and a thin bright one.
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.beginPath();
  ctx.moveTo(x - wTop * 0.78, top + 1);
  ctx.lineTo(x - wTop * 0.45, top + 1);
  ctx.lineTo(x - wBot * 0.45, bottom - 1);
  ctx.lineTo(x - wBot * 0.75, bottom - 1);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.beginPath();
  ctx.moveTo(x + wTop * 0.6, top + 2);
  ctx.lineTo(x + wTop * 0.68, top + 2);
  ctx.lineTo(x + wBot * 0.66, bottom - 2);
  ctx.lineTo(x + wBot * 0.58, bottom - 2);
  ctx.fill();
  // The rim and the thick base.
  ctx.strokeStyle = "rgba(255,255,255,.85)";
  ctx.lineWidth = Math.max(0.3, wTop * 0.05);
  el(ctx, x, top, wTop, wTop * 0.3);
  ctx.stroke();
  ctx.fillStyle = "rgba(220,240,250,.35)";
  el(ctx, x, bottom, wBot, wBot * 0.32);
  ctx.fill();
}

/* ───────────── food parts ───────────── */

/** A cooked shrimp curled into a C, pink with orange stripes. */
function shrimp(ctx: Ctx, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#f07a52";
  ctx.lineWidth = r * 0.75;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI * 0.15, Math.PI * 1.35);
  ctx.stroke();
  ctx.strokeStyle = "#ffb08f";
  ctx.lineWidth = r * 0.32;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, Math.PI * 0.3, Math.PI * 1.2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(190,60,30,.7)";
  ctx.lineWidth = r * 0.12;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * (0.35 + i * 0.25);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65);
    ctx.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35);
    ctx.stroke();
  }
  // The tail fan.
  ctx.fillStyle = "#e0502e";
  const ta = Math.PI * 1.38;
  ctx.beginPath();
  ctx.moveTo(Math.cos(ta) * r, Math.sin(ta) * r);
  ctx.lineTo(Math.cos(ta) * r + r * 0.7, Math.sin(ta) * r - r * 0.45);
  ctx.lineTo(Math.cos(ta) * r + r * 0.25, Math.sin(ta) * r - r * 0.8);
  ctx.fill();
  ctx.restore();
}
/** A thin slice of meat: `col` its colour, a browned edge. */
function slice(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot: number,
  col: string,
  edge: string,
) {
  ctx.fillStyle = rad(ctx, x - rx * 0.2, y - ry * 0.3, rx, [
    [0, tone(col, 0.15)],
    [0.75, col],
    [1, edge],
  ]);
  el(ctx, x, y, rx, ry, rot);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.lineWidth = ry * 0.18;
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 0.7, ry * 0.5, rot, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();
}
/** Scallion rings: little green circles with a pale middle. */
function scallions(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  n: number,
  k: number,
  seed: number,
) {
  for (let i = 0; i < n; i++) {
    const a = rnd(seed + i * 2.3) * TAU,
      d = Math.sqrt(rnd(seed + i * 4.1));
    const px = x + Math.cos(a) * rx * d,
      py = y + Math.sin(a) * ry * d;
    ctx.strokeStyle = i % 3 ? "#4fae3c" : "#8fd36a";
    ctx.lineWidth = 0.55 * k;
    el(ctx, px, py, 1.1 * k, 0.7 * k, a);
    ctx.stroke();
  }
}
/** A wedge of lime: rind, pith and segments. */
function lime(ctx: Ctx, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = "#4f9a2a";
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f2f7d9";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#b7de5a";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(245,250,220,.9)";
  ctx.lineWidth = r * 0.08;
  for (let i = 1; i < 4; i++) {
    const a = Math.PI + (i / 4) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
    ctx.stroke();
  }
  ctx.restore();
}
/** Wooden chopsticks lying from (x0, y0) towards (x1, y1). */
function chopsticks(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  k: number,
) {
  ctx.lineCap = "round";
  for (const o of [0, 1]) {
    const dx = o * 2.4 * k,
      dy = o * 1.2 * k;
    ctx.strokeStyle = "rgba(40,20,5,.25)";
    ctx.lineWidth = 1.5 * k;
    ctx.beginPath();
    ctx.moveTo(x0 + dx + 0.6 * k, y0 + dy + 1.4 * k);
    ctx.lineTo(x1 + dx + 0.6 * k, y1 + dy + 1.4 * k);
    ctx.stroke();
    ctx.strokeStyle = lin(ctx, x0, y0, x1, y1, [
      [0, "#7a4a25"],
      [0.3, "#c08550"],
      [1, "#d9a46c"],
    ]);
    ctx.lineWidth = 1.3 * k;
    ctx.beginPath();
    ctx.moveTo(x0 + dx, y0 + dy);
    ctx.lineTo(x1 + dx, y1 + dy);
    ctx.stroke();
  }
}
/** A cucumber slice: dark skin ring, pale flesh, seeds. */
function cucumber(ctx: Ctx, x: number, y: number, r: number) {
  ctx.fillStyle = "#2f7a2c";
  el(ctx, x, y, r, r * 0.55);
  ctx.fill();
  ctx.fillStyle = "#d8f0b4";
  el(ctx, x, y - r * 0.05, r * 0.85, r * 0.45);
  ctx.fill();
  ctx.fillStyle = "#b6dc8a";
  el(ctx, x, y - r * 0.05, r * 0.45, r * 0.24);
  ctx.fill();
}
/** A tomato slice: red flesh, seed pockets. */
function tomato(ctx: Ctx, x: number, y: number, r: number) {
  ctx.fillStyle = "#c92a1e";
  el(ctx, x, y, r, r * 0.55);
  ctx.fill();
  ctx.fillStyle = "#ee4a36";
  el(ctx, x, y - r * 0.05, r * 0.82, r * 0.44);
  ctx.fill();
  ctx.fillStyle = "#f9b49a";
  for (const a of [0.6, 2.7, 4.8]) {
    el(
      ctx,
      x + Math.cos(a) * r * 0.42,
      y - r * 0.05 + Math.sin(a) * r * 0.22,
      r * 0.22,
      r * 0.12,
      a,
    );
    ctx.fill();
  }
}
/** A small saucer of dipping sauce. */
function sauce(ctx: Ctx, x: number, y: number, r: number, col: string) {
  const s = bowl(ctx, x, y, r, { glaze: "#f1ede6", depth: 0.45 });
  broth(ctx, s, col);
  glint(
    ctx,
    s.cx - s.rx * 0.35,
    s.cy - s.ry * 0.3,
    s.rx * 0.3,
    s.ry * 0.25,
    0.45,
  );
  return s;
}

/* ───────────── the dishes ───────────── */

function goicuon(ctx: Ctx, x: number, y: number, k: number) {
  plate(ctx, x, y, 20 * k);
  // Three rolls of rice paper: what's inside shows through it.
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(x - 10 * k + i * 8 * k, y - 1.5 * k + (i % 2) * 1.5 * k);
    ctx.rotate(0.55);
    const L = 9.5 * k,
      W = 4.2 * k;
    shadow(ctx, 1 * k, 1.2 * k, W * 1.2, L * 1.05, 0.25);
    // Inside: noodles, lettuce, shrimp halves pressed against the paper.
    ctx.fillStyle = "#f4f1e8";
    ctx.beginPath();
    ctx.roundRect(-W, -L, W * 2, L * 2, W);
    ctx.fill();
    ctx.fillStyle = "#79c35a";
    ctx.beginPath();
    ctx.roundRect(-W * 0.85, -L * 0.25, W * 1.7, L * 1.1, W * 0.6);
    ctx.fill();
    for (const sy of [-0.55, 0.05]) {
      ctx.fillStyle = "#f59a7c";
      el(ctx, -W * 0.15, sy * L, W * 0.6, L * 0.24, 0.1);
      ctx.fill();
      ctx.strokeStyle = "#e0603c";
      ctx.lineWidth = 0.5 * k;
      for (let j = -1; j <= 1; j++) {
        ctx.beginPath();
        ctx.moveTo(-W * 0.65, sy * L + j * L * 0.12);
        ctx.lineTo(W * 0.35, sy * L + j * L * 0.12 + 0.6 * k);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "#c9e8a6";
    el(ctx, W * 0.45, L * 0.6, W * 0.35, L * 0.3);
    ctx.fill();
    // The paper: translucent, with soft wrinkles and a shine along the top.
    ctx.fillStyle = lin(ctx, -W, 0, W, 0, [
      [0, "rgba(232,226,210,.82)"],
      [0.35, "rgba(255,253,246,.42)"],
      [0.7, "rgba(255,253,246,.35)"],
      [1, "rgba(205,198,180,.85)"],
    ]);
    ctx.beginPath();
    ctx.roundRect(-W, -L, W * 2, L * 2, W);
    ctx.fill();
    ctx.strokeStyle = "rgba(200,192,170,.6)";
    ctx.lineWidth = 0.35 * k;
    for (const yy of [-0.7, -0.1, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(-W * 0.9, yy * L);
      ctx.quadraticCurveTo(0, yy * L + 1.2 * k, W * 0.9, yy * L - 0.4 * k);
      ctx.stroke();
    }
    glint(ctx, -W * 0.45, -L * 0.1, W * 0.18, L * 0.75, 0.55);
    ctx.restore();
  }
  // Hoisin and peanut dip.
  const s = sauce(ctx, x + 13 * k, y + 4 * k, 5.2 * k, "#7a3a1e");
  speckle(ctx, s.cx, s.cy, s.rx * 0.6, s.ry * 0.6, 6, "#e7c38a", 0.5 * k, 3);
  speckle(ctx, s.cx, s.cy, s.rx * 0.5, s.ry * 0.5, 3, "#e8402a", 0.35 * k, 9);
}

function banhmi(ctx: Ctx, x: number, y: number, k: number) {
  plate(ctx, x, y, 20 * k);
  speckle(ctx, x, y + 2 * k, 14 * k, 4 * k, 9, "#d9a456", 0.4 * k, 21);
  ctx.save();
  ctx.translate(x, y - 1.5 * k);
  ctx.rotate(-0.22);
  shadow(ctx, 1 * k, 4 * k, 17 * k, 4.5 * k, 0.32);
  const L = 16 * k,
    H = 5.6 * k;
  const loaf = (lift: number) => {
    ctx.beginPath();
    ctx.moveTo(-L, lift);
    ctx.bezierCurveTo(-L * 0.9, -H + lift, L * 0.9, -H + lift, L, lift);
    ctx.bezierCurveTo(L * 0.9, H * 0.9, -L * 0.9, H * 0.9, -L, lift);
  };
  // The bottom half of the loaf.
  ctx.fillStyle = lin(ctx, 0, -H, 0, H, [
    [0, "#e9a14a"],
    [0.6, "#c47a2c"],
    [1, "#8c4f18"],
  ]);
  loaf(0);
  ctx.fill();
  // The filling along the cut: pâté, cold cuts, pickles, cucumber, coriander.
  ctx.fillStyle = "#9a5a3c";
  el(ctx, 0, -1.4 * k, L * 0.82, 1.6 * k);
  ctx.fill();
  for (let i = 0; i < 4; i++)
    slice(
      ctx,
      -9 * k + i * 6 * k,
      -2.4 * k,
      3.6 * k,
      1.5 * k,
      0.1,
      "#f0a4a0",
      "#c76a68",
    );
  ctx.lineCap = "round";
  ctx.lineWidth = 0.8 * k;
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = i % 2 ? "#ff8a2a" : "#fbf4e2";
    const px = -11 * k + i * 2.6 * k;
    ctx.beginPath();
    ctx.moveTo(px, -2.6 * k);
    ctx.lineTo(px + 2 * k, -4.4 * k - (i % 3) * 0.4 * k);
    ctx.stroke();
  }
  ctx.fillStyle = "#3f8f34";
  ctx.beginPath();
  ctx.roundRect(-8 * k, -4.1 * k, 14 * k, 1.3 * k, 0.6 * k);
  ctx.fill();
  ctx.fillStyle = "#cfeaa0";
  ctx.beginPath();
  ctx.roundRect(-7.5 * k, -3.9 * k, 13 * k, 0.6 * k, 0.3 * k);
  ctx.fill();
  for (const [lx, a] of [
    [-6, -0.9],
    [1, -0.6],
    [7, -1.1],
  ] as const)
    leaf(ctx, lx * k, -5.6 * k, 3.4 * k, 1 * k, a, "#4cae3c");
  ctx.fillStyle = "#d8261c";
  for (const cx of [-3, 4.5]) {
    el(ctx, cx * k, -4.8 * k, 0.9 * k, 0.6 * k);
    ctx.fill();
  }
  // The top crust, lifted a little off the filling.
  ctx.save();
  ctx.translate(0.6 * k, -4.2 * k);
  ctx.scale(1, 0.62);
  ctx.fillStyle = lin(ctx, 0, -H, 0, H * 0.4, [
    [0, "#f4c27a"],
    [0.45, "#dd9440"],
    [1, "#b4692a"],
  ]);
  ctx.beginPath();
  ctx.moveTo(-L * 0.98, 0);
  ctx.bezierCurveTo(-L * 0.85, -H * 1.1, L * 0.85, -H * 1.1, L * 0.98, 0);
  ctx.quadraticCurveTo(0, H * 0.5, -L * 0.98, 0);
  ctx.fill();
  // Scored crust: pale ridges with a dark edge.
  for (const sx of [-9, -2, 5]) {
    ctx.strokeStyle = "rgba(120,60,15,.55)";
    ctx.lineWidth = 1 * k;
    ctx.beginPath();
    ctx.moveTo(sx * k, -1 * k);
    ctx.quadraticCurveTo((sx + 2) * k, -4 * k, (sx + 4.5) * k, -5.4 * k);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,226,160,.9)";
    ctx.lineWidth = 0.7 * k;
    ctx.beginPath();
    ctx.moveTo((sx + 0.5) * k, -1.4 * k);
    ctx.quadraticCurveTo((sx + 2.4) * k, -4.2 * k, (sx + 4.8) * k, -5.6 * k);
    ctx.stroke();
  }
  glint(ctx, -4 * k, -4.8 * k, 6 * k, 0.9 * k, 0.4);
  ctx.restore();
  ctx.restore();
}

function pho(ctx: Ctx, x: number, y: number, k: number) {
  const s = bowl(ctx, x, y - 5 * k, 16 * k, {
    glaze: "#f4f2ec",
    band: "#2f62a8",
  });
  broth(ctx, s, "#d39a48");
  // Noodles just under the surface, beef, onion, herbs.
  strands(
    ctx,
    s.cx,
    s.cy,
    s.rx * 0.8,
    s.ry * 0.75,
    7,
    "rgba(255,250,236,.55)",
    1.1 * k,
    5,
  );
  slice(
    ctx,
    s.cx - 4.5 * k,
    s.cy - 0.8 * k,
    4.6 * k,
    1.9 * k,
    0.25,
    "#c98a7c",
    "#8a4a3a",
  );
  slice(
    ctx,
    s.cx + 2.5 * k,
    s.cy + 0.6 * k,
    4.4 * k,
    1.8 * k,
    -0.2,
    "#d4948a",
    "#8f5040",
  );
  slice(
    ctx,
    s.cx - 0.5 * k,
    s.cy - 2.2 * k,
    3.8 * k,
    1.5 * k,
    0.05,
    "#b97a6c",
    "#7a3e30",
  );
  ctx.strokeStyle = "rgba(250,246,255,.9)";
  ctx.lineWidth = 0.5 * k;
  for (const [ox, oy] of [
    [6, -1],
    [-8, 1],
    [3, 2.2],
  ]) {
    el(ctx, s.cx + ox * k, s.cy + oy * k, 1.8 * k, 0.9 * k);
    ctx.stroke();
  }
  scallions(ctx, s.cx, s.cy, s.rx * 0.75, s.ry * 0.7, 10, k, 11);
  leaf(ctx, s.cx + 7 * k, s.cy - 1.6 * k, 3.6 * k, 1.2 * k, -0.4, "#3f9a35");
  leaf(ctx, s.cx - 7.5 * k, s.cy - 1.4 * k, 3.2 * k, 1.1 * k, 0.5, "#4aa83c");
  speckle(
    ctx,
    s.cx,
    s.cy,
    s.rx * 0.7,
    s.ry * 0.6,
    8,
    "rgba(40,25,15,.7)",
    0.25 * k,
    17,
  );
  fatDrops(ctx, s, 7, 3);
  lime(ctx, x + 14 * k, y - 7.5 * k, 3.4 * k, 0.4);
  chopsticks(ctx, x - 6 * k, y - 4 * k, x + 15 * k, y - 15 * k, k);
}

function buncha(ctx: Ctx, x: number, y: number, k: number) {
  plate(ctx, x - 6 * k, y + 1 * k, 13 * k);
  // Two little bundles of rice vermicelli.
  for (const [bx, by] of [
    [-10, 0],
    [-3.5, 2],
  ] as const) {
    ctx.fillStyle = "#f6f2e6";
    el(ctx, x + bx * k, y + by * k, 4.4 * k, 2.4 * k);
    ctx.fill();
    strands(
      ctx,
      x + bx * k,
      y + by * k,
      4.4 * k,
      2.4 * k,
      6,
      "rgba(205,198,180,.8)",
      0.35 * k,
      bx * 3,
    );
    glint(ctx, x + (bx - 1.5) * k, y + (by - 1) * k, 1.6 * k, 0.6 * k, 0.6);
  }
  leaf(ctx, x - 13 * k, y - 3 * k, 6 * k, 2.2 * k, -0.3, "#6cbf4a");
  leaf(ctx, x - 9.5 * k, y - 4 * k, 4.6 * k, 1.8 * k, 0.4, "#7b4a8a");
  // The dipping bowl: nước chấm with grilled patties and pickles.
  const s = bowl(ctx, x + 8 * k, y - 3 * k, 10 * k, {
    glaze: "#f2efe8",
    band: "#2f62a8",
    depth: 0.7,
  });
  broth(ctx, s, "#d9925a");
  for (const [dx, dy] of [
    [-3.5, -0.6],
    [1, 0.4],
    [4.2, -0.8],
  ] as const) {
    const px = s.cx + dx * k,
      py = s.cy + dy * k;
    ctx.fillStyle = rad(ctx, px - 0.6 * k, py - 0.6 * k, 2.4 * k, [
      [0, "#9a5228"],
      [0.7, "#6a3014"],
      [1, "#3a1806"],
    ]);
    el(ctx, px, py, 2.4 * k, 1.5 * k);
    ctx.fill();
    ctx.strokeStyle = "rgba(25,10,0,.6)";
    ctx.lineWidth = 0.35 * k;
    ctx.beginPath();
    ctx.moveTo(px - 1.4 * k, py - 0.4 * k);
    ctx.lineTo(px + 0.4 * k, py + 0.8 * k);
    ctx.moveTo(px - 0.4 * k, py - 1 * k);
    ctx.lineTo(px + 1.4 * k, py + 0.3 * k);
    ctx.stroke();
    glint(ctx, px - 0.7 * k, py - 0.7 * k, 0.8 * k, 0.4 * k, 0.5);
  }
  ctx.fillStyle = "#f7b45a";
  ctx.fillRect(s.cx - 1 * k, s.cy - 2 * k, 1.6 * k, 1 * k);
  ctx.fillStyle = "#f4ecd2";
  ctx.fillRect(s.cx + 2.2 * k, s.cy + 0.8 * k, 1.5 * k, 0.9 * k);
  speckle(ctx, s.cx, s.cy, s.rx * 0.7, s.ry * 0.6, 4, "#e2261c", 0.3 * k, 31);
  fatDrops(ctx, s, 4, 8);
}

function comtam(ctx: Ctx, x: number, y: number, k: number) {
  plate(ctx, x, y, 20 * k);
  // A dome of broken rice: grains catching the light, scallion oil on top.
  const rx = 7.6 * k,
    ry = 4.6 * k,
    rcx = x - 6 * k,
    rcy = y - 2 * k;
  shadow(ctx, rcx + 1 * k, rcy + 2.6 * k, rx * 1.05, ry * 0.6, 0.25);
  ctx.fillStyle = rad(ctx, rcx - 2 * k, rcy - 2 * k, rx * 1.1, [
    [0, "#ffffff"],
    [0.7, "#f6f1e3"],
    [1, "#ddd3bd"],
  ]);
  el(ctx, rcx, rcy, rx, ry);
  ctx.fill();
  speckle(
    ctx,
    rcx,
    rcy,
    rx * 0.9,
    ry * 0.85,
    26,
    "rgba(205,195,170,.8)",
    0.45 * k,
    41,
  );
  speckle(
    ctx,
    rcx - 1 * k,
    rcy - 1 * k,
    rx * 0.7,
    ry * 0.6,
    10,
    "#ffffff",
    0.45 * k,
    43,
  );
  speckle(
    ctx,
    rcx,
    rcy - 1.5 * k,
    rx * 0.45,
    ry * 0.35,
    6,
    "#4aa83c",
    0.55 * k,
    47,
  );
  // The grilled pork chop: glazed, with char lines and a fat edge.
  ctx.save();
  ctx.translate(x + 7 * k, y);
  ctx.rotate(-0.2);
  shadow(ctx, 0.6 * k, 1.8 * k, 8.4 * k, 2.6 * k, 0.3);
  ctx.fillStyle = "#e8c48a";
  el(ctx, 0, 0.4 * k, 8.6 * k, 4 * k);
  ctx.fill();
  ctx.fillStyle = rad(ctx, -2 * k, -1.5 * k, 9 * k, [
    [0, "#c8743a"],
    [0.6, "#9a4a1c"],
    [1, "#5e2a0c"],
  ]);
  el(ctx, 0, 0, 8 * k, 3.5 * k);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,14,2,.75)";
  ctx.lineWidth = 0.7 * k;
  for (const dx of [-4.5, -1.5, 1.5, 4.5]) {
    ctx.beginPath();
    ctx.moveTo(dx * k - 1.2 * k, -2.6 * k);
    ctx.lineTo(dx * k + 1.4 * k, 2.6 * k);
    ctx.stroke();
  }
  glint(ctx, -2.5 * k, -1.4 * k, 3 * k, 0.6 * k, 0.45, -0.1);
  ctx.restore();
  // A fried egg: lacy brown edge, set white, glossy yolk.
  const ex = x - 1 * k,
    ey = y + 5.5 * k;
  ctx.fillStyle = "#c9873a";
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * TAU,
      r = 5.6 * k * (0.88 + rnd(i + 3) * 0.2);
    const px = ex + Math.cos(a) * r,
      py = ey + Math.sin(a) * r * 0.48;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.fill();
  ctx.fillStyle = rad(ctx, ex - 1 * k, ey - 1 * k, 5 * k, [
    [0, "#ffffff"],
    [0.8, "#fbf6ec"],
    [1, "#efe2c6"],
  ]);
  el(ctx, ex, ey, 4.8 * k, 2.2 * k);
  ctx.fill();
  ctx.fillStyle = rad(ctx, ex - 0.5 * k, ey - 1.2 * k, 2.2 * k, [
    [0, "#ffd35a"],
    [0.7, "#f7a51e"],
    [1, "#e0860e"],
  ]);
  el(ctx, ex + 0.3 * k, ey - 0.6 * k, 2 * k, 1.4 * k);
  ctx.fill();
  glint(ctx, ex - 0.3 * k, ey - 1.1 * k, 0.7 * k, 0.4 * k, 0.85);
  cucumber(ctx, x - 13.5 * k, y + 3 * k, 2.4 * k);
  cucumber(ctx, x - 11 * k, y + 4.6 * k, 2.4 * k);
  tomato(ctx, x - 8 * k, y + 5.8 * k, 2.3 * k);
}

function che(ctx: Ctx, x: number, y: number, k: number) {
  // Chè ba màu in a tall glass: red beans, mung bean, pandan jelly,
  // coconut milk and crushed ice.
  shadow(ctx, x + 1 * k, y + 1.5 * k, 9 * k, 3 * k, 0.3);
  const top = y - 23 * k,
    wT = 7.2 * k,
    wB = 5.6 * k;
  const w = (yy: number) => wB + (wT - wB) * ((y - yy) / (y - top));
  const band = (y0: number, y1: number, fill: string | CanvasGradient) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x - w(y0), y0);
    ctx.lineTo(x + w(y0), y0);
    ctx.lineTo(x + w(y1), y1);
    ctx.lineTo(x - w(y1), y1);
    ctx.closePath();
    ctx.fill();
  };
  const yA = top + 5 * k,
    yB = top + 10 * k,
    yC = top + 15 * k;
  band(yC, y, "#6e1f2a");
  speckle(
    ctx,
    x,
    (yC + y) / 2,
    wB * 0.8,
    (y - yC) * 0.4,
    14,
    "#9a3440",
    0.9 * k,
    51,
  );
  speckle(
    ctx,
    x - 1 * k,
    (yC + y) / 2 - 1 * k,
    wB * 0.7,
    (y - yC) * 0.35,
    6,
    "rgba(255,200,200,.5)",
    0.35 * k,
    53,
  );
  band(
    yB,
    yC,
    lin(ctx, x - wT, 0, x + wT, 0, [
      [0, "#e8b636"],
      [0.5, "#f7d25e"],
      [1, "#d9a22a"],
    ]),
  );
  band(yA, yB, "#bfe6a8");
  ctx.strokeStyle = "#3fae4a";
  ctx.lineWidth = 1 * k;
  ctx.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    const px = x - wT * 0.7 + i * wT * 0.28;
    ctx.beginPath();
    ctx.moveTo(px, yA + 0.8 * k);
    ctx.quadraticCurveTo(
      px + 1.4 * k,
      (yA + yB) / 2,
      px - 0.4 * k,
      yB - 0.6 * k,
    );
    ctx.stroke();
  }
  band(top + 1.6 * k, yA, "#fbf6e8");
  // Crushed ice heaped over the top.
  for (let i = 0; i < 7; i++) {
    const px = x - wT * 0.75 + i * wT * 0.25,
      py = top + 1 * k - (i % 3) * 1.1 * k;
    ctx.fillStyle = "rgba(225,244,255,.92)";
    ctx.beginPath();
    ctx.moveTo(px - 1.6 * k, py + 1 * k);
    ctx.lineTo(px - 0.4 * k, py - 1.4 * k);
    ctx.lineTo(px + 1.5 * k, py - 0.6 * k);
    ctx.lineTo(px + 1 * k, py + 1.3 * k);
    ctx.closePath();
    ctx.fill();
    glint(ctx, px - 0.3 * k, py - 0.5 * k, 0.5 * k, 0.3 * k, 0.9);
  }
  glassFront(ctx, x, top, y, wT, wB);
  // A long spoon.
  ctx.strokeStyle = lin(ctx, x, top - 10 * k, x, top, [
    [0, "#eef2f5"],
    [1, "#9aa4ad"],
  ]);
  ctx.lineWidth = 1.1 * k;
  ctx.beginPath();
  ctx.moveTo(x + 2.5 * k, top + 1 * k);
  ctx.lineTo(x + 6.5 * k, top - 10 * k);
  ctx.stroke();
}

function caphe(ctx: Ctx, x: number, y: number, k: number) {
  // Cà phê sữa đá: a phin dripping onto ice, condensed milk at the bottom.
  shadow(ctx, x + 1 * k, y + 1.5 * k, 8.5 * k, 2.8 * k, 0.3);
  const top = y - 19 * k,
    wT = 6.8 * k,
    wB = 5.4 * k;
  ctx.fillStyle = lin(ctx, 0, top, 0, y, [
    [0, "#8a4e26"],
    [0.3, "#5a2c12"],
    [0.68, "#3a1a08"],
    [0.8, "#a8744a"],
    [1, "#efe0c2"],
  ]);
  ctx.beginPath();
  ctx.moveTo(x - wT, top + 2 * k);
  ctx.lineTo(x + wT, top + 2 * k);
  ctx.lineTo(x + wB, y);
  ctx.lineTo(x - wB, y);
  ctx.closePath();
  ctx.fill();
  // Ice cubes: clear edges, a bright corner.
  for (const [dx, dy, r] of [
    [-2.6, 4, 2.6],
    [2.4, 6.5, 2.4],
    [-0.6, 9.5, 2.3],
  ] as const) {
    const px = x + dx * k,
      py = top + dy * k;
    ctx.fillStyle = "rgba(210,170,130,.35)";
    ctx.strokeStyle = "rgba(255,235,210,.6)";
    ctx.lineWidth = 0.4 * k;
    ctx.beginPath();
    ctx.roundRect(px - r * k, py - r * k, r * 2 * k, r * 2 * k, 0.6 * k);
    ctx.fill();
    ctx.stroke();
    glint(ctx, px - r * 0.45 * k, py - r * 0.45 * k, 0.6 * k, 0.4 * k, 0.8);
  }
  glassFront(ctx, x, top, y, wT, wB);
  // Beads of condensation.
  speckle(
    ctx,
    x,
    top + 9 * k,
    wT * 0.8,
    7 * k,
    7,
    "rgba(255,255,255,.6)",
    0.35 * k,
    61,
  );
  // The phin: a stainless cup with a lid, on a wide plate.
  const py = top + 0.5 * k;
  ctx.fillStyle = lin(ctx, x - 8 * k, 0, x + 8 * k, 0, [
    [0, "#9aa3ab"],
    [0.35, "#eef1f3"],
    [1, "#7c858d"],
  ]);
  el(ctx, x, py, 8 * k, 2.3 * k);
  ctx.fill();
  ctx.fillStyle = lin(ctx, x - 4.8 * k, 0, x + 4.8 * k, 0, [
    [0, "#8e979f"],
    [0.3, "#f2f4f6"],
    [0.6, "#c4cbd1"],
    [1, "#6f7880"],
  ]);
  ctx.beginPath();
  ctx.moveTo(x - 4.6 * k, py - 0.6 * k);
  ctx.lineTo(x - 4.2 * k, py - 7.5 * k);
  ctx.lineTo(x + 4.2 * k, py - 7.5 * k);
  ctx.lineTo(x + 4.6 * k, py - 0.6 * k);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#dfe4e8";
  el(ctx, x, py - 7.5 * k, 4.6 * k, 1.3 * k);
  ctx.fill();
  ctx.fillStyle = "#aeb6bd";
  el(ctx, x, py - 8.2 * k, 1.4 * k, 0.6 * k);
  ctx.fill();
}

function lau(ctx: Ctx, x: number, y: number, k: number) {
  // A steel hotpot with handles: spicy red broth, seafood, mushrooms, greens.
  const r = 17 * k,
    cy = y - 4 * k;
  for (const sx of [-1, 1]) {
    ctx.fillStyle = "#4a4f55";
    ctx.beginPath();
    ctx.roundRect(
      x + sx * (r + 1.5 * k) - 2.5 * k,
      cy - 0.5 * k,
      5 * k,
      2.2 * k,
      1 * k,
    );
    ctx.fill();
  }
  const s = bowl(ctx, x, cy, r, {
    glaze: "#c9ced3",
    inner: "#9aa1a8",
    depth: 0.62,
  });
  broth(ctx, s, "#d8452a");
  // Chili oil pooled on top.
  ctx.fillStyle = "rgba(255,150,40,.45)";
  for (const [dx, dy, rr] of [
    [-6, -1, 3],
    [5, 1, 2.6],
    [1, -2.2, 2],
  ] as const) {
    el(ctx, s.cx + dx * k, s.cy + dy * k, rr * k, rr * 0.45 * k);
    ctx.fill();
  }
  // Morning glory leaves, enoki, a shiitake cap, tofu, fish balls, shrimp.
  leaf(ctx, s.cx - 9 * k, s.cy - 0.5 * k, 5 * k, 1.6 * k, 0.3, "#3f9a35");
  leaf(ctx, s.cx - 7 * k, s.cy + 1.4 * k, 4.4 * k, 1.4 * k, -0.2, "#4fae3c");
  ctx.strokeStyle = "#f6f1de";
  ctx.lineWidth = 0.5 * k;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(s.cx - 2.5 * k + i * 0.6 * k, s.cy + 1.5 * k);
    ctx.lineTo(s.cx - 3.2 * k + i * 0.7 * k, s.cy - 2.5 * k);
    ctx.stroke();
  }
  ctx.fillStyle = rad(ctx, s.cx + 7 * k, s.cy - 2 * k, 2.6 * k, [
    [0, "#9a6a40"],
    [1, "#4e2c14"],
  ]);
  el(ctx, s.cx + 7.5 * k, s.cy - 1.6 * k, 2.6 * k, 1.5 * k);
  ctx.fill();
  ctx.fillStyle = "#f8f3e4";
  ctx.fillRect(s.cx + 1 * k, s.cy + 0.5 * k, 2.6 * k, 1.8 * k);
  ctx.fillStyle = "#e9e2cc";
  ctx.fillRect(s.cx + 1 * k, s.cy + 2.3 * k, 2.6 * k, 0.5 * k);
  for (const [dx, dy] of [
    [4, -2.4],
    [-1.5, -2.8],
  ] as const) {
    ctx.fillStyle = rad(
      ctx,
      s.cx + (dx - 0.4) * k,
      s.cy + (dy - 0.4) * k,
      1.4 * k,
      [
        [0, "#f6ead2"],
        [1, "#c9b088"],
      ],
    );
    el(ctx, s.cx + dx * k, s.cy + dy * k, 1.3 * k, 1 * k);
    ctx.fill();
  }
  shrimp(ctx, s.cx + 7 * k, s.cy + 1.6 * k, 1.8 * k, 0.6);
  shrimp(ctx, s.cx - 3 * k, s.cy - 0.4 * k, 1.6 * k, -0.4);
  speckle(ctx, s.cx, s.cy, s.rx * 0.8, s.ry * 0.7, 5, "#b81c10", 0.45 * k, 71);
}

function banhxeo(ctx: Ctx, x: number, y: number, k: number) {
  plate(ctx, x, y, 20 * k);
  // Lettuce under it.
  leaf(ctx, x - 9 * k, y + 3 * k, 12 * k, 3.6 * k, 0.2, "#7cc85a");
  leaf(ctx, x + 10 * k, y + 3.5 * k, 10 * k, 3 * k, -0.25, "#6cbf4a");
  // The open edge: sprouts, shrimp and pork spilling out.
  ctx.lineCap = "round";
  ctx.lineWidth = 0.7 * k;
  for (let i = 0; i < 12; i++) {
    ctx.strokeStyle = i % 2 ? "#f4f0d8" : "#e9e2b8";
    const px = x - 11 * k + i * 2 * k;
    ctx.beginPath();
    ctx.moveTo(px, y + 0.5 * k);
    ctx.lineTo(px + (rnd(i) - 0.5) * 2 * k, y + 2.6 * k);
    ctx.stroke();
  }
  shrimp(ctx, x - 5 * k, y + 1 * k, 1.8 * k, 2.6);
  shrimp(ctx, x + 4 * k, y + 1.4 * k, 1.8 * k, 2.4);
  slice(ctx, x + 0 * k, y + 1.6 * k, 2.4 * k, 1 * k, 0, "#e8b8a0", "#b07050");
  // The crepe: turmeric gold, browned spots, crisp lacy rim.
  const crepe = () => {
    ctx.beginPath();
    ctx.moveTo(x - 15 * k, y + 1 * k);
    ctx.bezierCurveTo(
      x - 14 * k,
      y - 15 * k,
      x + 14 * k,
      y - 15 * k,
      x + 15 * k,
      y + 1 * k,
    );
    ctx.quadraticCurveTo(x, y - 1.5 * k, x - 15 * k, y + 1 * k);
  };
  shadow(ctx, x + 1 * k, y + 1 * k, 15 * k, 4 * k, 0.25);
  ctx.fillStyle = "#b8661c";
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.04, 1.05);
  ctx.translate(-x, -y);
  crepe();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = rad(ctx, x - 3 * k, y - 8 * k, 16 * k, [
    [0, "#ffe07a"],
    [0.55, "#f5b832"],
    [1, "#d98a1a"],
  ]);
  crepe();
  ctx.fill();
  ctx.save();
  crepe();
  ctx.clip();
  speckle(
    ctx,
    x,
    y - 5 * k,
    11 * k,
    5 * k,
    16,
    "rgba(170,90,20,.55)",
    1 * k,
    81,
  );
  speckle(
    ctx,
    x - 2 * k,
    y - 7 * k,
    8 * k,
    3 * k,
    8,
    "rgba(255,245,200,.6)",
    0.6 * k,
    83,
  );
  ctx.restore();
  // The crisp, lacy rim: a browned band with holes along the curve.
  ctx.save();
  crepe();
  ctx.clip();
  ctx.strokeStyle = "rgba(160,80,15,.75)";
  ctx.lineWidth = 2.2 * k;
  crepe();
  ctx.stroke();
  ctx.setLineDash([0.6 * k, 1.6 * k]);
  ctx.strokeStyle = "rgba(255,236,170,.9)";
  ctx.lineWidth = 0.9 * k;
  crepe();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  glint(ctx, x - 5 * k, y - 8.5 * k, 4 * k, 0.9 * k, 0.4, -0.2);
}

function miquang(ctx: Ctx, x: number, y: number, k: number) {
  // A sesame rice cracker leaning on the bowl's back.
  ctx.save();
  ctx.translate(x - 5 * k, y - 9.5 * k);
  ctx.rotate(-0.35);
  ctx.fillStyle = rad(ctx, -1 * k, -1 * k, 9 * k, [
    [0, "#f7e2b0"],
    [0.8, "#e2bb76"],
    [1, "#c69a52"],
  ]);
  el(ctx, 0, 0, 9 * k, 6.5 * k);
  ctx.fill();
  speckle(ctx, 0, 0, 8 * k, 5.6 * k, 26, "#3a2a1a", 0.32 * k, 91);
  speckle(ctx, 0, 0, 8 * k, 5.6 * k, 12, "#fff4dc", 0.3 * k, 93);
  glint(ctx, -3 * k, -2.5 * k, 3 * k, 1 * k, 0.4, -0.3);
  ctx.restore();
  const s = bowl(ctx, x, y - 4 * k, 16 * k, {
    glaze: "#e9f0f5",
    band: "#2a5f9a",
    depth: 0.66,
  });
  broth(ctx, s, "#e8a83a");
  // Wide turmeric noodles, a little broth, shrimp, pork, quail eggs, peanuts.
  strands(ctx, s.cx, s.cy, s.rx * 0.85, s.ry * 0.8, 5, "#f7cf4a", 1.8 * k, 7);
  strands(
    ctx,
    s.cx,
    s.cy + 0.6 * k,
    s.rx * 0.8,
    s.ry * 0.7,
    4,
    "rgba(214,150,30,.7)",
    0.5 * k,
    8,
  );
  shrimp(ctx, s.cx - 6 * k, s.cy - 0.6 * k, 1.8 * k, 0.3);
  slice(
    ctx,
    s.cx + 5.5 * k,
    s.cy - 1 * k,
    2.8 * k,
    1.2 * k,
    0.2,
    "#f0d0b8",
    "#b8805a",
  );
  for (const dx of [1, 4]) {
    ctx.fillStyle = "#fffaf0";
    el(ctx, s.cx + dx * k, s.cy + 1.4 * k, 1.5 * k, 1.1 * k);
    ctx.fill();
    ctx.fillStyle = "#f6b62c";
    el(ctx, s.cx + dx * k, s.cy + 1.3 * k, 0.75 * k, 0.55 * k);
    ctx.fill();
  }
  for (let i = 0; i < 7; i++) {
    const px = s.cx - 4 * k + rnd(i + 5) * 9 * k,
      py = s.cy - 1.5 * k + rnd(i + 9) * 2.5 * k;
    ctx.fillStyle = "#c98b48";
    el(ctx, px, py, 0.8 * k, 0.55 * k, rnd(i) * 3);
    ctx.fill();
    glint(ctx, px - 0.25 * k, py - 0.2 * k, 0.3 * k, 0.18 * k, 0.6);
  }
  leaf(ctx, s.cx - 8 * k, s.cy + 1 * k, 3.4 * k, 1.1 * k, 0.3, "#3f9a35");
  scallions(ctx, s.cx, s.cy, s.rx * 0.6, s.ry * 0.5, 5, k, 97);
}

function chaca(ctx: Ctx, x: number, y: number, k: number) {
  // A cast-iron skillet: turmeric fish, a heap of dill and spring onion.
  shadow(ctx, x + 1 * k, y + 2.5 * k, 18 * k, 6 * k, 0.32);
  ctx.strokeStyle = "#2a2a2e";
  ctx.lineWidth = 2.6 * k;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 14 * k, y - 2 * k);
  ctx.lineTo(x + 22 * k, y - 5 * k);
  ctx.stroke();
  ctx.fillStyle = "#1c1c20";
  el(ctx, x, y, 16 * k, 6.2 * k);
  ctx.fill();
  ctx.fillStyle = lin(ctx, x - 16 * k, 0, x + 16 * k, 0, [
    [0, "#4a4a52"],
    [0.4, "#2e2e34"],
    [1, "#18181c"],
  ]);
  el(ctx, x, y - 1 * k, 16 * k, 5.8 * k);
  ctx.fill();
  ctx.fillStyle = "#2a2a30";
  el(ctx, x, y - 1.6 * k, 13.8 * k, 4.8 * k);
  ctx.fill();
  // Shimmering oil.
  ctx.fillStyle = "rgba(240,180,60,.25)";
  el(ctx, x, y - 1.6 * k, 12.5 * k, 4.2 * k);
  ctx.fill();
  for (const [dx, dy, a] of [
    [-7, -1.5, 0.2],
    [-1.5, 0.4, -0.1],
    [4.5, -1, 0.15],
    [-4, -3.4, -0.2],
    [2, -3.6, 0.1],
    [8, -2.8, -0.3],
  ] as const) {
    const px = x + dx * k,
      py = y + dy * k;
    ctx.fillStyle = rad(ctx, px - 0.8 * k, py - 0.6 * k, 3.4 * k, [
      [0, "#ffd36a"],
      [0.6, "#e6a12a"],
      [1, "#a8601a"],
    ]);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.roundRect(-3 * k, -1.5 * k, 6 * k, 3 * k, 1.2 * k);
    ctx.fill();
    ctx.restore();
    glint(ctx, px - 0.8 * k, py - 0.6 * k, 1.2 * k, 0.4 * k, 0.55);
  }
  // Dill: feathery fronds.
  ctx.strokeStyle = "#5fb43c";
  ctx.lineWidth = 0.35 * k;
  for (let i = 0; i < 9; i++) {
    const bx = x - 3 * k + i * 1.1 * k,
      by = y - 5 * k;
    for (let j = 0; j < 5; j++) {
      const a = -Math.PI / 2 + (rnd(i * 7 + j) - 0.5) * 2.2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a) * 3 * k, by + Math.sin(a) * 2.4 * k);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "#8ad05e";
  ctx.lineWidth = 0.8 * k;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 2 * k + i * 2 * k, y - 4 * k);
    ctx.lineTo(x + 1 * k + i * 2 * k, y - 6.5 * k);
    ctx.stroke();
  }
  speckle(
    ctx,
    x + 6 * k,
    y - 0.5 * k,
    3 * k,
    1.2 * k,
    5,
    "#c98b48",
    0.5 * k,
    101,
  );
}

function flan(ctx: Ctx, x: number, y: number, k: number) {
  plate(ctx, x, y, 17 * k, "");
  // Caramel pooled on the plate.
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU,
      r = 11 * k * (0.86 + rnd(i + 11) * 0.22);
    pts.push([x + Math.cos(a) * r, y + 0.4 * k + Math.sin(a) * r * 0.4]);
  }
  ctx.fillStyle = rad(ctx, x - 3 * k, y - 1 * k, 12 * k, [
    [0, "rgba(190,100,25,.85)"],
    [1, "rgba(120,52,8,.85)"],
  ]);
  ctx.beginPath();
  for (let i = 0; i <= pts.length; i++) {
    const p0 = pts[i % pts.length],
      p1 = pts[(i + 1) % pts.length];
    const mx = (p0[0] + p1[0]) / 2,
      my = (p0[1] + p1[1]) / 2;
    i ? ctx.quadraticCurveTo(p0[0], p0[1], mx, my) : ctx.moveTo(mx, my);
  }
  ctx.fill();
  glint(ctx, x - 6.5 * k, y + 1.4 * k, 2.6 * k, 0.5 * k, 0.55);
  glint(ctx, x + 7 * k, y + 2 * k, 1.4 * k, 0.35 * k, 0.45);
  // The custard: pale gold sides, tiny bubbles, a glossy caramel top.
  shadow(ctx, x + 1 * k, y + 0.5 * k, 9 * k, 2.4 * k, 0.3);
  ctx.fillStyle = lin(ctx, x - 9 * k, 0, x + 9 * k, 0, [
    [0, "#e8bd5e"],
    [0.3, "#fbe2a0"],
    [0.75, "#f2cd78"],
    [1, "#d39f44"],
  ]);
  ctx.beginPath();
  ctx.moveTo(x - 9 * k, y - 0.5 * k);
  ctx.lineTo(x - 7 * k, y - 10 * k);
  ctx.lineTo(x + 7 * k, y - 10 * k);
  ctx.lineTo(x + 9 * k, y - 0.5 * k);
  ctx.ellipse(x, y - 0.5 * k, 9 * k, 2.6 * k, 0, 0, Math.PI, false);
  ctx.fill();
  speckle(
    ctx,
    x,
    y - 5 * k,
    6.5 * k,
    3.5 * k,
    10,
    "rgba(255,250,230,.7)",
    0.35 * k,
    111,
  );
  ctx.fillStyle = rad(ctx, x - 2 * k, y - 11 * k, 7 * k, [
    [0, "#c26a1c"],
    [0.6, "#8a400c"],
    [1, "#5e2806"],
  ]);
  el(ctx, x, y - 10 * k, 7 * k, 2.2 * k);
  ctx.fill();
  // Drips down the side.
  ctx.fillStyle = "rgba(140,62,10,.85)";
  for (const [dx, len] of [
    [-5, 4],
    [-1, 2.6],
    [3.5, 5],
    [6, 3],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x + (dx - 0.9) * k, y - 9.6 * k);
    ctx.lineTo(x + (dx - 0.6) * k, y - (9.6 - len) * k);
    ctx.arc(x + dx * k, y - (9.6 - len) * k, 0.6 * k, Math.PI, 0, true);
    ctx.lineTo(x + (dx + 0.9) * k, y - 9.6 * k);
    ctx.fill();
  }
  glint(ctx, x - 2.5 * k, y - 10.6 * k, 2.6 * k, 0.6 * k, 0.7);
  leaf(ctx, x + 3 * k, y - 11 * k, 3.2 * k, 1.3 * k, -0.5, "#3fae4a");
  leaf(ctx, x + 1.4 * k, y - 11.4 * k, 2.6 * k, 1.1 * k, 0.7, "#4cbc54");
}

function banhcanh(ctx: Ctx, x: number, y: number, k: number) {
  const s = bowl(ctx, x, y - 4 * k, 17 * k, {
    glaze: "#efe9dc",
    band: "#b8402a",
  });
  broth(ctx, s, "#e2702e");
  fatDrops(ctx, s, 9, 13, "rgba(255,120,40,.85)");
  // Thick tapioca noodles.
  strands(
    ctx,
    s.cx,
    s.cy,
    s.rx * 0.8,
    s.ry * 0.7,
    4,
    "rgba(255,244,226,.9)",
    1.7 * k,
    15,
  );
  // Fish cake slices, quail eggs, crab meat and a claw.
  for (const [dx, dy] of [
    [-7, -0.6],
    [-3.5, 1.4],
  ] as const) {
    ctx.fillStyle = "#c28a4a";
    el(ctx, s.cx + dx * k, s.cy + dy * k, 2.4 * k, 1.2 * k);
    ctx.fill();
    ctx.fillStyle = "#f4e6c8";
    el(ctx, s.cx + dx * k, s.cy + dy * k, 1.9 * k, 0.9 * k);
    ctx.fill();
  }
  ctx.fillStyle = "#fffaf0";
  el(ctx, s.cx + 0.5 * k, s.cy - 1.6 * k, 1.5 * k, 1.1 * k);
  ctx.fill();
  ctx.fillStyle = "#f6b62c";
  el(ctx, s.cx + 0.5 * k, s.cy - 1.7 * k, 0.75 * k, 0.55 * k);
  ctx.fill();
  speckle(
    ctx,
    s.cx - 1 * k,
    s.cy + 0.6 * k,
    2.4 * k,
    1 * k,
    6,
    "#f8eede",
    0.6 * k,
    117,
  );
  // The crab claw: red shell, darker tips, a bit of white meat.
  ctx.save();
  ctx.translate(s.cx + 6 * k, s.cy - 1 * k);
  ctx.rotate(-0.4);
  ctx.fillStyle = rad(ctx, -1 * k, -1 * k, 4 * k, [
    [0, "#ff7a4a"],
    [0.7, "#d8401e"],
    [1, "#a02a10"],
  ]);
  el(ctx, 0, 0, 3.6 * k, 2 * k);
  ctx.fill();
  ctx.fillStyle = "#3a1a10";
  ctx.beginPath();
  ctx.moveTo(3 * k, -1 * k);
  ctx.lineTo(6 * k, -2.6 * k);
  ctx.lineTo(4.4 * k, -0.4 * k);
  ctx.moveTo(3 * k, 0.6 * k);
  ctx.lineTo(5.6 * k, 0.4 * k);
  ctx.lineTo(3.6 * k, 1.4 * k);
  ctx.fill();
  ctx.fillStyle = "#fbf2e6";
  el(ctx, -3 * k, 0.2 * k, 1 * k, 1.2 * k);
  ctx.fill();
  glint(ctx, -1 * k, -1 * k, 1.2 * k, 0.4 * k, 0.6);
  ctx.restore();
  scallions(ctx, s.cx, s.cy, s.rx * 0.7, s.ry * 0.6, 8, k, 119);
  speckle(ctx, s.cx, s.cy, s.rx * 0.6, s.ry * 0.5, 7, "#8a4a1a", 0.45 * k, 121);
}

function phoenix(ctx: Ctx, x: number, y: number, k: number) {
  // The Phoenix Feast: a whole roast bird on a wooden board, a fan of
  // carved "feathers" (carrot, pepper, mango) and fruit around it.
  shadow(ctx, x + 1 * k, y + 3 * k, 20 * k, 6 * k, 0.35);
  ctx.fillStyle = "#6a3e1e";
  el(ctx, x, y + 0.8 * k, 18.5 * k, 6.4 * k);
  ctx.fill();
  ctx.fillStyle = lin(ctx, x - 18 * k, 0, x + 18 * k, 0, [
    [0, "#b0743f"],
    [0.5, "#c98a52"],
    [1, "#9a6232"],
  ]);
  el(ctx, x, y - 0.4 * k, 18 * k, 5.8 * k);
  ctx.fill();
  ctx.strokeStyle = "rgba(110,60,25,.35)";
  ctx.lineWidth = 0.4 * k;
  for (const dy of [-3, -1, 1.5]) {
    ctx.beginPath();
    ctx.ellipse(
      x,
      y - 0.4 * k + dy * k,
      14 * k,
      1.6 * k,
      0,
      Math.PI * 1.1,
      Math.PI * 1.9,
    );
    ctx.stroke();
  }
  // Feather fan behind the bird.
  const cols = [
    "#e8401e",
    "#ff8a1e",
    "#ffc23a",
    "#e8401e",
    "#ff8a1e",
    "#ffc23a",
    "#e8401e",
  ];
  for (let i = 0; i < cols.length; i++) {
    const a = -2.5 + i * 0.28;
    ctx.save();
    ctx.translate(x + 7 * k, y - 4 * k);
    ctx.rotate(a);
    ctx.fillStyle = lin(ctx, 0, 0, 10 * k, 0, [
      [0, tone(cols[i], -0.2)],
      [1, tone(cols[i], 0.2)],
    ]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(5 * k, -1.8 * k, 10 * k, 0);
    ctx.quadraticCurveTo(5 * k, 1.8 * k, 0, 0);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 0.3 * k;
    ctx.beginPath();
    ctx.moveTo(1 * k, 0);
    ctx.lineTo(9 * k, 0);
    ctx.stroke();
    ctx.restore();
  }
  // The roast: glossy mahogany skin, darker where it browned most.
  const bx = x - 2 * k,
    by = y - 5 * k;
  shadow(ctx, bx + 1 * k, by + 4 * k, 10 * k, 3 * k, 0.35);
  ctx.fillStyle = rad(ctx, bx - 3 * k, by - 3 * k, 12 * k, [
    [0, "#f2a24a"],
    [0.45, "#c8641e"],
    [0.85, "#8a3a0e"],
    [1, "#5e2406"],
  ]);
  el(ctx, bx, by, 9.5 * k, 6 * k);
  ctx.fill();
  // Drumsticks and wing.
  for (const sx of [-1, 1]) {
    // A drumstick: plump end against the body, the bone pointing forward.
    const lx = bx + sx * 3.6 * k,
      ly = by + 2.6 * k;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(sx * 0.55);
    ctx.fillStyle = rad(ctx, -0.8 * k, -0.8 * k, 4 * k, [
      [0, "#eb9a44"],
      [0.6, "#b4561a"],
      [1, "#6e2a08"],
    ]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.4 * k, 3.2 * k, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#a8501a";
    ctx.beginPath();
    ctx.moveTo(-1 * k, 2.4 * k);
    ctx.lineTo(1 * k, 2.4 * k);
    ctx.lineTo(0.6 * k, 4.4 * k);
    ctx.lineTo(-0.6 * k, 4.4 * k);
    ctx.fill();
    ctx.fillStyle = "#f6ecd8";
    el(ctx, 0, 4.8 * k, 0.9 * k, 0.6 * k);
    ctx.fill();
    glint(ctx, -0.8 * k, -1 * k, 0.8 * k, 1.4 * k, 0.4);
    ctx.restore();
  }
  // The breastbone's ridge catching the light.
  ctx.strokeStyle = "rgba(255,210,150,.45)";
  ctx.lineWidth = 0.6 * k;
  ctx.beginPath();
  ctx.moveTo(bx - 4 * k, by - 3.5 * k);
  ctx.quadraticCurveTo(bx, by - 5.6 * k, bx + 4 * k, by - 3.5 * k);
  ctx.stroke();
  ctx.fillStyle = rad(ctx, bx - 7 * k, by - 1 * k, 4 * k, [
    [0, "#d8782a"],
    [1, "#6e2a08"],
  ]);
  el(ctx, bx - 7.5 * k, by + 0.5 * k, 3 * k, 1.8 * k, -0.5);
  ctx.fill();
  speckle(ctx, bx, by, 7 * k, 4 * k, 10, "rgba(90,30,5,.5)", 0.6 * k, 131);
  glint(ctx, bx - 3 * k, by - 3 * k, 4 * k, 1.2 * k, 0.55, -0.2);
  glint(ctx, bx + 2 * k, by - 4 * k, 1.6 * k, 0.5 * k, 0.6);
  // Garnish: orange slices, cherry tomatoes, herbs.
  for (const [ox, oy] of [
    [-14, 1],
    [13, 2],
  ] as const) {
    ctx.fillStyle = "#f08a1a";
    el(ctx, x + ox * k, y + oy * k, 2.8 * k, 1.5 * k);
    ctx.fill();
    ctx.fillStyle = "#ffc45a";
    el(ctx, x + ox * k, y + (oy - 0.1) * k, 2.2 * k, 1.1 * k);
    ctx.fill();
  }
  for (const [ox, oy] of [
    [-11, 3],
    [10, -0.5],
    [12, 3.5],
  ] as const) {
    ctx.fillStyle = rad(ctx, x + (ox - 0.4) * k, y + (oy - 0.4) * k, 1.4 * k, [
      [0, "#ff7a6a"],
      [1, "#b8180c"],
    ]);
    el(ctx, x + ox * k, y + oy * k, 1.3 * k, 1.1 * k);
    ctx.fill();
  }
  leaf(ctx, x - 12 * k, y - 1.5 * k, 4 * k, 1.4 * k, -0.3, "#3f9a35");
  leaf(ctx, x + 14.5 * k, y - 0.5 * k, 3.6 * k, 1.2 * k, 0.4, "#4aa83c");
}

/** The still part of a dish. */
export function drawDishBody(
  ctx: Ctx,
  id: DishId,
  x: number,
  y: number,
  s: number,
) {
  const k = s / 20;
  switch (id) {
    case "goicuon":
      return goicuon(ctx, x, y, k);
    case "banhmi":
      return banhmi(ctx, x, y, k);
    case "pho":
      return pho(ctx, x, y, k);
    case "buncha":
      return buncha(ctx, x, y, k);
    case "comtam":
      return comtam(ctx, x, y, k);
    case "che":
      return che(ctx, x, y, k);
    case "caphe":
      return caphe(ctx, x, y, k);
    case "lau":
      return lau(ctx, x, y, k);
    case "banhxeo":
      return banhxeo(ctx, x, y, k);
    case "miquang":
      return miquang(ctx, x, y, k);
    case "chaca":
      return chaca(ctx, x, y, k);
    case "flan":
      return flan(ctx, x, y, k);
    case "banhcanh":
      return banhcanh(ctx, x, y, k);
    case "phoenix":
      return phoenix(ctx, x, y, k);
  }
}
/** Drinks and desserts that don't steam. */
export const COLD_DISHES: ReadonlySet<DishId> = new Set<DishId>([
  "che",
  "caphe",
  "flan",
]);
/** The part of a dish that moves: the hotpot's bubbles, the skillet's sizzle. */
export function drawDishLive(
  ctx: Ctx,
  id: DishId,
  x: number,
  y: number,
  s: number,
  t: number,
) {
  const k = s / 20;
  if (id === "lau") {
    ctx.fillStyle = "rgba(255,230,200,.75)";
    for (let i = 0; i < 4; i++) {
      const ph = (t * 1.5 + i * 0.27) % 1;
      ctx.beginPath();
      ctx.arc(
        x + (-8 + i * 5.5) * k,
        y - 4.4 * k + (i % 2) * 1.6 * k,
        (0.3 + ph * 1.4) * k,
        0,
        TAU,
      );
      ctx.fill();
    }
  } else if (id === "chaca") {
    ctx.fillStyle = "rgba(255,255,255,.6)";
    for (let i = 0; i < 4; i++) {
      const ph = (t * 2 + i * 0.27) % 1;
      ctx.beginPath();
      ctx.arc(
        x + (-9 + i * 6) * k,
        y - 2 * k - ph * 5 * k,
        0.7 * k * (1 - ph * 0.5),
        0,
        TAU,
      );
      ctx.fill();
    }
  }
}
