/*
 * Element Bistro's furniture, drawn closer to the real thing: wood with its
 * grain, brushed steel and chrome, glazed ceramic, glass that shows what is
 * inside, fabric with seams and buttons. Each item stands on tile (x, y);
 * `t` is the clock in seconds for what moves (steam, leaves, lights).
 */
import {
  ellipse,
  iso,
  isoBox,
  lin,
  poly,
  rad,
  shade,
  softShadow,
} from "./bistro-geom";

type Ctx = CanvasRenderingContext2D;
type Pt = { x: number; y: number };
const TAU = Math.PI * 2;
const rnd = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const up = (p: Pt, d: number): Pt => ({ x: p.x, y: p.y - d });

/* ───────────── materials ───────────── */

/** A box of wood: lit top, mid left face, dark right face, with grain. */
export function woodBox(
  ctx: Ctx,
  gx0: number,
  gy0: number,
  gx1: number,
  gy1: number,
  z: number,
  h: number,
  base: string,
  seed = 1,
) {
  isoBox(ctx, gx0, gy0, gx1, gy1, z, h, {
    top: shade(base, 0.12),
    left: shade(base, -0.05),
    right: shade(base, -0.32),
  });
  const A = iso(gx0, gy0),
    B = iso(gx1, gy0),
    C = iso(gx1, gy1),
    D = iso(gx0, gy1);
  ctx.save();
  ctx.lineWidth = 0.7;
  // Grain on the top: along its long edge.
  const long =
    Math.hypot(B.x - A.x, B.y - A.y) >= Math.hypot(D.x - A.x, D.y - A.y);
  const [p0, p1, q0] = long ? [A, B, D] : [A, D, B];
  poly(ctx, [up(A, z + h), up(B, z + h), up(C, z + h), up(D, z + h)]);
  ctx.clip();
  ctx.strokeStyle = shade(base, -0.28);
  ctx.globalAlpha = 0.35;
  const n = 6;
  for (let i = 1; i < n; i++) {
    const f = i / n + (rnd(seed + i) - 0.5) * 0.08;
    const sx = p0.x + (q0.x - p0.x) * f,
      sy = p0.y + (q0.y - p0.y) * f - z - h;
    const ex = sx + (p1.x - p0.x),
      ey = sy + (p1.y - p0.y);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(
      sx + (ex - sx) * 0.33,
      sy + (ey - sy) * 0.33 + (rnd(seed * 3 + i) - 0.5) * 3,
      sx + (ex - sx) * 0.66,
      sy + (ey - sy) * 0.66 + (rnd(seed * 7 + i) - 0.5) * 3,
      ex,
      ey,
    );
    ctx.stroke();
  }
  ctx.restore();
  // Grain on the left face: lengthwise.
  if (h >= 8) {
    ctx.save();
    poly(ctx, [up(D, z), up(C, z), up(C, z + h), up(D, z + h)]);
    ctx.clip();
    ctx.strokeStyle = shade(base, -0.35);
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 0.6;
    for (let i = 1; i < 4; i++) {
      const dz = z + (h * i) / 4 + (rnd(seed + i * 11) - 0.5) * 3;
      ctx.beginPath();
      ctx.moveTo(D.x, D.y - dz);
      ctx.quadraticCurveTo(
        (D.x + C.x) / 2,
        (D.y + C.y) / 2 - dz + (rnd(i + seed) - 0.5) * 3,
        C.x,
        C.y - dz,
      );
      ctx.stroke();
    }
    ctx.restore();
  }
}
/** A brushed-steel gradient across x0..x1. */
const steel = (ctx: Ctx, x0: number, x1: number) =>
  lin(ctx, x0, 0, x1, 0, [
    [0, "#8d969e"],
    [0.25, "#e9edf0"],
    [0.5, "#b9c1c8"],
    [0.75, "#dfe4e8"],
    [1, "#7a838b"],
  ]);
/** A glossy glint. */
function glint(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  a = 0.6,
  rot = 0,
) {
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  ctx.fill();
}
/** A soft round light. */
function glow(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  rgb: string,
  a: number,
) {
  ctx.fillStyle = rad(ctx, x, y, r, [
    [0, `rgba(${rgb},${a})`],
    [1, `rgba(${rgb},0)`],
  ]);
  ellipse(ctx, x, y, r, r);
  ctx.fill();
}
/** A terracotta pot: tapered body, a thick lip, dark soil. */
function terracotta(ctx: Ctx, x: number, y: number, rTop: number, h: number) {
  const rBot = rTop * 0.72;
  ctx.fillStyle = lin(ctx, x - rTop, 0, x + rTop, 0, [
    [0, "#9a4a2a"],
    [0.35, "#d9774a"],
    [0.65, "#c4643a"],
    [1, "#7e3a20"],
  ]);
  ctx.beginPath();
  ctx.moveTo(x - rTop * 0.92, y - h + 5);
  ctx.lineTo(x - rBot, y - 2);
  ctx.ellipse(x, y - 2, rBot, rBot * 0.35, 0, Math.PI, 0, true);
  ctx.lineTo(x + rTop * 0.92, y - h + 5);
  ctx.closePath();
  ctx.fill();
  // The lip: a band with its own light.
  ctx.fillStyle = lin(ctx, x - rTop, 0, x + rTop, 0, [
    [0, "#a5532f"],
    [0.4, "#e8875a"],
    [1, "#86401f"],
  ]);
  ctx.beginPath();
  ctx.ellipse(x, y - h + 5, rTop, rTop * 0.34, 0, 0, Math.PI);
  ctx.lineTo(x - rTop, y - h);
  ctx.ellipse(x, y - h, rTop, rTop * 0.34, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#c86c42";
  ellipse(ctx, x, y - h, rTop, rTop * 0.34);
  ctx.fill();
  ctx.fillStyle = rad(ctx, x, y - h + 1, rTop * 0.85, [
    [0, "#5a3a26"],
    [1, "#2e1c10"],
  ]);
  ellipse(ctx, x, y - h + 0.5, rTop * 0.82, rTop * 0.26);
  ctx.fill();
  ctx.fillStyle = "rgba(160,120,80,.6)";
  for (let i = 0; i < 6; i++)
    ctx.fillRect(
      x - rTop * 0.6 + rnd(i) * rTop * 1.2,
      y - h - 1 + rnd(i + 9) * 3,
      1,
      1,
    );
  glint(ctx, x - rTop * 0.55, y - h * 0.45, rTop * 0.08, h * 0.25, 0.25);
}

/* ───────────── plants ───────────── */

/** A fern frond: a curved stem with pairs of leaflets, smaller to the tip. */
function frond(
  ctx: Ctx,
  x: number,
  y: number,
  len: number,
  a: number,
  col: string,
  bend: number,
) {
  const n = 9;
  let px = x,
    py = y;
  ctx.strokeStyle = shade(col, -0.3);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  const pts: [number, number, number][] = [];
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    const ang = a + bend * f * f;
    px += Math.cos(ang) * (len / n);
    py += Math.sin(ang) * (len / n);
    ctx.lineTo(px, py);
    pts.push([px, py, ang]);
  }
  ctx.stroke();
  for (const [i, [lx, ly, ang]] of pts.entries()) {
    const f = 1 - i / n;
    const l = 3 + f * 6;
    for (const side of [-1, 1]) {
      const la = ang + side * 1.1;
      ctx.fillStyle = side < 0 ? shade(col, 0.12) : shade(col, -0.12);
      ctx.beginPath();
      ctx.ellipse(
        lx + Math.cos(la) * l * 0.5,
        ly + Math.sin(la) * l * 0.5,
        l * 0.55,
        1.4 + f * 0.8,
        la,
        0,
        TAU,
      );
      ctx.fill();
    }
  }
}
export function drawPlant(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 20, 9, 0.28);
  // Fronds behind the rim first, then the pot, then the ones in front.
  const fronds: [number, number, string][] = [
    [-2.3, 34, "#3f8f45"],
    [-1.9, 38, "#4a9e4a"],
    [-1.4, 40, "#3f8f45"],
    [-1.75, 30, "#5aae50"],
    [-1.15, 34, "#58ad4f"],
    [-0.85, 32, "#3f8f45"],
    [-2.6, 28, "#58ad4f"],
  ];
  for (const [i, [a, len, col]] of fronds.entries()) {
    const sw = Math.sin(t * 1.3 + i) * 0.04;
    frond(ctx, c.x, c.y - 26, len, a + sw, col, (a < -1.57 ? -1 : 1) * 0.9);
  }
  terracotta(ctx, c.x, c.y, 14, 26);
  for (const [i, a] of [-2.9, -0.25].entries()) {
    const sw = Math.sin(t * 1.3 + i + 7) * 0.04;
    frond(
      ctx,
      c.x + (i ? 4 : -4),
      c.y - 25,
      24,
      a + sw,
      "#4a9e4a",
      (i ? 1 : -1) * 1.1,
    );
  }
}
export function drawBonsai(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 22, 10, 0.28);
  woodBox(ctx, x - 0.3, y - 0.3, x + 0.3, y + 0.3, 0, 26, "#6e4126", 3);
  // A shallow glazed pot on little feet.
  const py = c.y - 27;
  ctx.fillStyle = "#1f3a52";
  for (const dx of [-11, 11]) {
    ctx.fillRect(c.x + dx - 2, py - 1, 4, 3);
  }
  ctx.fillStyle = lin(ctx, c.x - 16, 0, c.x + 16, 0, [
    [0, "#24486b"],
    [0.35, "#4f84b0"],
    [1, "#1c3854"],
  ]);
  ctx.beginPath();
  ctx.moveTo(c.x - 16, py - 9);
  ctx.lineTo(c.x - 14, py);
  ctx.lineTo(c.x + 14, py);
  ctx.lineTo(c.x + 16, py - 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#5a8fbd";
  ellipse(ctx, c.x, py - 9, 16, 4);
  ctx.fill();
  ctx.fillStyle = "#3a2a1c";
  ellipse(ctx, c.x, py - 9, 13.5, 2.8);
  ctx.fill();
  glint(ctx, c.x - 10, py - 5, 3, 1, 0.35);
  // Moss on the soil.
  ctx.fillStyle = "#5c8f3a";
  for (let i = 0; i < 6; i++) {
    ellipse(ctx, c.x - 10 + i * 4, py - 9 + (i % 2) * 0.8, 2.2, 0.9);
    ctx.fill();
  }
  // A gnarled trunk: thick at the base, twisting up.
  ctx.lineCap = "round";
  const trunk = (w: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(c.x + 2, py - 9);
    ctx.bezierCurveTo(c.x - 12, py - 18, c.x + 12, py - 26, c.x - 2, py - 36);
    ctx.stroke();
  };
  trunk(6, "#4e2f1c");
  trunk(3.5, "#7a5236");
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#5e3a24";
  ctx.beginPath();
  ctx.moveTo(c.x - 4, py - 20);
  ctx.quadraticCurveTo(c.x + 4, py - 24, c.x + 12, py - 26);
  ctx.moveTo(c.x - 1, py - 30);
  ctx.quadraticCurveTo(c.x - 8, py - 34, c.x - 14, py - 34);
  ctx.stroke();
  // Foliage pads: dark undersides, lit tops, leaf texture.
  const pads: [number, number, number][] = [
    [-13, -36, 10],
    [12, -28, 9],
    [-1, -42, 12],
    [6, -48, 8],
  ];
  for (const [i, [dx, dy, r]] of pads.entries()) {
    const s = Math.sin(t * 1.2 + i) * 0.5;
    const px = c.x + dx + s,
      pyy = py + dy;
    ctx.fillStyle = "#2f6a2e";
    ellipse(ctx, px, pyy + 1.5, r, r * 0.55);
    ctx.fill();
    ctx.fillStyle = rad(ctx, px - r * 0.3, pyy - r * 0.4, r * 1.1, [
      [0, "#a6e08c"],
      [0.6, "#5aa648"],
      [1, "#3a7f36"],
    ]);
    ellipse(ctx, px, pyy, r, r * 0.5);
    ctx.fill();
    ctx.fillStyle = "rgba(30,80,30,.5)";
    for (let k = 0; k < 6; k++) {
      ellipse(
        ctx,
        px + (rnd(i * 9 + k) - 0.5) * r * 1.5,
        pyy + (rnd(i * 5 + k) - 0.3) * r * 0.5,
        1.2,
        0.8,
      );
      ctx.fill();
    }
  }
}
export function drawVase(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 14, 6, 0.26);
  // Stems and flowers behind the neck.
  const flowers: [number, number, string][] = [
    [-9, -44, "#ff7aa8"],
    [6, -50, "#ffd65b"],
    [-1, -56, "#ff5d7a"],
    [10, -40, "#fff4f8"],
  ];
  for (const [i, [dx, dy, col]] of flowers.entries()) {
    const sw = Math.sin(t * 1.5 + i) * 1.2;
    const fx = c.x + dx + sw,
      fy = c.y + dy;
    ctx.strokeStyle = "#3f7f34";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 30);
    ctx.quadraticCurveTo(c.x + dx * 0.3, c.y - 38, fx, fy);
    ctx.stroke();
    ctx.fillStyle = "#4f9f3f";
    ctx.beginPath();
    ctx.ellipse(
      c.x + dx * 0.5,
      c.y - 37,
      3.4,
      1.4,
      dx > 0 ? -0.6 : 0.6,
      0,
      TAU,
    );
    ctx.fill();
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * TAU + i;
      ctx.fillStyle = shade(
        col.length === 7 ? col : "#ffffff",
        p % 2 ? -0.08 : 0.05,
      );
      ctx.beginPath();
      ctx.ellipse(
        fx + Math.cos(a) * 2.6,
        fy + Math.sin(a) * 2,
        2.4,
        1.6,
        a,
        0,
        TAU,
      );
      ctx.fill();
    }
    ctx.fillStyle = "#f2b234";
    ellipse(ctx, fx, fy, 1.3, 1.1);
    ctx.fill();
  }
  // A blue-and-white porcelain vase: round belly, narrow neck, painted bands.
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(c.x - 4.5, c.y - 31);
    ctx.quadraticCurveTo(c.x - 5, c.y - 24, c.x - 11, c.y - 16);
    ctx.quadraticCurveTo(c.x - 14, c.y - 6, c.x - 6, c.y);
    ctx.lineTo(c.x + 6, c.y);
    ctx.quadraticCurveTo(c.x + 14, c.y - 6, c.x + 11, c.y - 16);
    ctx.quadraticCurveTo(c.x + 5, c.y - 24, c.x + 4.5, c.y - 31);
    ctx.closePath();
  };
  ctx.fillStyle = lin(ctx, c.x - 13, 0, c.x + 13, 0, [
    [0, "#c9d3df"],
    [0.35, "#ffffff"],
    [0.7, "#e6ecf2"],
    [1, "#a9b6c4"],
  ]);
  body();
  ctx.fill();
  ctx.save();
  body();
  ctx.clip();
  ctx.strokeStyle = "#2a5fa0";
  ctx.lineWidth = 1.6;
  for (const yy of [-27, -9, -3]) {
    ctx.beginPath();
    ctx.moveTo(c.x - 14, c.y + yy);
    ctx.lineTo(c.x + 14, c.y + yy);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c.x - 8, c.y - 15);
  ctx.bezierCurveTo(c.x - 3, c.y - 22, c.x + 2, c.y - 10, c.x + 8, c.y - 16);
  ctx.stroke();
  ctx.fillStyle = "#2a5fa0";
  for (const [dx, dy] of [
    [-5, -18],
    [1, -14],
    [6, -17],
  ]) {
    ellipse(ctx, c.x + dx, c.y + dy, 1.6, 1);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "#dfe6ee";
  ellipse(ctx, c.x, c.y - 31, 4.8, 1.6);
  ctx.fill();
  glint(ctx, c.x - 5.5, c.y - 12, 1.4, 5, 0.6, 0.2);
}

/* ───────────── machines ───────────── */

export function drawTipJar(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 18, 8, 0.26);
  woodBox(ctx, x - 0.26, y - 0.26, x + 0.26, y + 0.26, 0, 26, "#8a5530", 5);
  const by = c.y - 27;
  // Inside the jar: a heap of coins and a folded bill.
  ctx.fillStyle = "#4f9a52";
  ctx.save();
  ctx.translate(c.x + 2, by - 9);
  ctx.rotate(-0.5);
  ctx.fillRect(-5, -2.5, 10, 5);
  ctx.fillStyle = "#7cc47c";
  ctx.fillRect(-4, -1.5, 8, 3);
  ctx.restore();
  for (let i = 0; i < 7; i++) {
    const px = c.x - 6 + (i % 4) * 4,
      py = by - 2 - Math.floor(i / 4) * 3 - (i % 2);
    ctx.fillStyle = "#b98314";
    ellipse(ctx, px, py + 0.8, 3.2, 1.4);
    ctx.fill();
    ctx.fillStyle = i % 3 ? "#f2c94c" : "#ffe27a";
    ellipse(ctx, px, py, 3.2, 1.4);
    ctx.fill();
  }
  // The glass: rounded, a lid band, reflections, a label.
  ctx.fillStyle = "rgba(210,240,255,.28)";
  ctx.beginPath();
  ctx.roundRect(c.x - 9, by - 22, 18, 22, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.75)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = steel(ctx, c.x - 9, c.x + 9);
  ctx.beginPath();
  ctx.roundRect(c.x - 8, by - 25, 16, 4, 1.5);
  ctx.fill();
  ctx.fillStyle = "#fbf3dc";
  ctx.beginPath();
  ctx.roundRect(c.x - 6, by - 17, 12, 6, 1);
  ctx.fill();
  ctx.fillStyle = "#c0392b";
  ctx.beginPath();
  ctx.moveTo(c.x, by - 12.6);
  ctx.bezierCurveTo(c.x - 3, by - 14.5, c.x - 1.6, by - 16.6, c.x, by - 15);
  ctx.bezierCurveTo(c.x + 1.6, by - 16.6, c.x + 3, by - 14.5, c.x, by - 12.6);
  ctx.fill();
  glint(ctx, c.x - 6, by - 10, 1, 6, 0.55);
  const tw = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.fillStyle = `rgba(255,250,210,${0.3 + tw * 0.6})`;
  ellipse(ctx, c.x + 5, by - 19, 1.4, 1.4);
  ctx.fill();
}
/**
 * Draw on the left face of a box (the one toward the viewer's left), in its
 * own frame: x along the face (0 at its middle), y up from its bottom edge
 * (negative), sloping with the face.
 */
function onFront(
  ctx: Ctx,
  x: number,
  yEdge: number,
  lift: number,
  fn: () => void,
) {
  const f = iso(x, yEdge);
  ctx.save();
  ctx.translate(f.x, f.y - lift);
  ctx.transform(1, 0.5, 0, 1, 0, 0);
  fn();
  ctx.restore();
}
export function drawEspresso(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 26, 11, 0.3);
  woodBox(ctx, x - 0.32, y - 0.24, x + 0.32, y + 0.24, 0, 28, "#3e2a20", 7);
  // The machine: a steel body with a cup warmer on top.
  const z = 28;
  isoBox(ctx, x - 0.26, y - 0.18, x + 0.26, y + 0.18, z, 30, {
    top: "#cfd6dc",
    left: steel(ctx, c.x - 24, c.x + 4),
    right: "#7d868e",
  });
  onFront(ctx, x, y + 0.18, z, () => {
    // A red band, a pressure gauge, the group head and its portafilter.
    ctx.fillStyle = "#b0302a";
    ctx.fillRect(-12, -27, 24, 3);
    ctx.fillStyle = "#f4f4ef";
    ellipse(ctx, -7, -19, 3.4, 3.4);
    ctx.fill();
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-7, -19);
    ctx.lineTo(-5.4, -21);
    ctx.stroke();
    ctx.fillStyle = "#5c656d";
    ctx.fillRect(1, -16, 8, 4);
    ctx.fillStyle = steel(ctx, 0, 10);
    ctx.fillRect(0, -12, 10, 3);
    ctx.strokeStyle = "#1c1c1e";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(9, -10.5);
    ctx.lineTo(15, -10);
    ctx.stroke();
    // The drip tray and a cup under the spout.
    ctx.fillStyle = "#2a2e33";
    ctx.fillRect(-4, -3, 16, 2.5);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(2, -8.5);
    ctx.lineTo(8, -8.5);
    ctx.lineTo(7.4, -3.4);
    ctx.lineTo(2.6, -3.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#5a3018";
    ellipse(ctx, 5, -8.4, 3, 0.8);
    ctx.fill();
    // The steam wand on the left.
    ctx.strokeStyle = steel(ctx, -12, -6);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-9, -14);
    ctx.quadraticCurveTo(-12, -12, -11, -5);
    ctx.stroke();
  });
  // Cups warming on top.
  const top = iso(x, y);
  for (const dx of [-7, 4]) {
    ctx.fillStyle = "#f6f3ee";
    ctx.beginPath();
    ctx.roundRect(top.x + dx - 3, top.y - z - 36, 6, 5, 1.5);
    ctx.fill();
    ctx.fillStyle = "#d9d3c8";
    ellipse(ctx, top.x + dx, top.y - z - 36, 3, 1);
    ctx.fill();
  }
  // Steam from the cup.
  const f = iso(x, y + 0.18);
  const sx = f.x + 5,
    sy = f.y + 2.5 - z - 10;
  const s = (t * 0.8) % 1;
  ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - s)})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(sx, sy - s * 6);
  ctx.bezierCurveTo(
    sx - 3,
    sy - 4 - s * 10,
    sx + 3,
    sy - 8 - s * 12,
    sx,
    sy - 12 - s * 14,
  );
  ctx.stroke();
}
export function drawCart(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 26, 11, 0.26);
  const legs: [number, number][] = [
    [-0.3, -0.2],
    [0.3, -0.2],
    [0.3, 0.2],
    [-0.3, 0.2],
  ];
  // Back legs, the shelves, then the front legs.
  const leg = (lx: number, ly: number) => {
    const p = iso(x + lx, y + ly);
    ctx.strokeStyle = steel(ctx, p.x - 1.5, p.x + 1.5);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 5);
    ctx.lineTo(p.x, p.y - 36);
    ctx.stroke();
    ctx.fillStyle = "#222";
    ellipse(ctx, p.x, p.y - 2.5, 2.6, 2.6);
    ctx.fill();
    ctx.fillStyle = "#777";
    ellipse(ctx, p.x, p.y - 2.5, 1, 1);
    ctx.fill();
  };
  leg(...legs[0]);
  leg(...legs[1]);
  for (const z of [9, 31])
    woodBox(ctx, x - 0.32, y - 0.22, x + 0.32, y + 0.22, z, 3, "#8a5a34", z);
  leg(...legs[2]);
  leg(...legs[3]);
  // The push bar.
  const h0 = iso(x + 0.36, y - 0.22),
    h1 = iso(x + 0.36, y + 0.22);
  ctx.strokeStyle = steel(ctx, h0.x - 4, h1.x + 4);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(h0.x, h0.y - 34);
  ctx.lineTo(h0.x + 4, h0.y - 44);
  ctx.lineTo(h1.x + 4, h1.y - 44);
  ctx.lineTo(h1.x, h1.y - 34);
  ctx.stroke();
  // A stack of plates below; a silver cloche on top.
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? "#ece6dc" : "#ffffff";
    ellipse(ctx, c.x - 2, c.y - 14 - i * 1.6, 9, 3.2);
    ctx.fill();
  }
  ctx.fillStyle = "#cfd6dc";
  ellipse(ctx, c.x, c.y - 35, 13, 4.5);
  ctx.fill();
  ctx.fillStyle = rad(ctx, c.x - 4, c.y - 44, 14, [
    [0, "#ffffff"],
    [0.5, "#d6dde3"],
    [1, "#8d969e"],
  ]);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 36, 11, 10, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#9aa3ab";
  ellipse(ctx, c.x, c.y - 46.5, 2.2, 1.4);
  ctx.fill();
  glint(ctx, c.x - 5, c.y - 41, 2, 4, 0.6, 0.5);
}
export function drawArcade(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 24, 10, 0.3);
  isoBox(ctx, x - 0.3, y - 0.26, x + 0.3, y + 0.26, 0, 72, {
    top: "#2a1640",
    left: lin(ctx, 0, c.y - 72, 0, c.y, [
      [0, "#5b2a86"],
      [1, "#33174f"],
    ]),
    right: "#24103a",
  });
  // Side art: a lightning stripe.
  const r0 = iso(x + 0.3, y - 0.26),
    r1 = iso(x + 0.3, y + 0.26);
  ctx.strokeStyle = "#ffd65b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r0.x + 4, r0.y - 60);
  ctx.lineTo((r0.x + r1.x) / 2, (r0.y + r1.y) / 2 - 40);
  ctx.lineTo((r0.x + r1.x) / 2 + 3, (r0.y + r1.y) / 2 - 36);
  ctx.lineTo(r1.x - 3, r1.y - 14);
  ctx.stroke();
  onFront(ctx, x, y + 0.26, 0, () => {
    // The marquee, lit.
    ctx.fillStyle = lin(ctx, -13, 0, 13, 0, [
      [0, "#ff5a8a"],
      [1, "#ffb34a"],
    ]);
    ctx.fillRect(-13, -70, 26, 8);
    glow(ctx, 0, -66, 16, "255,140,180", 0.25);
    // The screen: a bezel and a little game.
    ctx.fillStyle = "#0c0c14";
    ctx.fillRect(-12, -59, 24, 19);
    ctx.fillStyle = "#101a3a";
    ctx.fillRect(-10, -57, 20, 15);
    const hue = (t * 40) % 360;
    ctx.fillStyle = `hsl(${hue},80%,60%)`;
    for (let i = 0; i < 4; i++)
      ctx.fillRect(-8 + i * 4.5, -55 + (i % 2) * 2, 3, 2);
    ctx.fillStyle = "#ffd65b";
    ctx.fillRect(-2 + Math.sin(t * 2) * 5, -45, 4, 2);
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.fillRect(-10, -57, 20, 4);
    // The control panel: a joystick and buttons.
    ctx.fillStyle = "#1a1a24";
    ctx.fillRect(-13, -37, 26, 6);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-7, -35);
    ctx.lineTo(-7, -40);
    ctx.stroke();
    ctx.fillStyle = "#e74c3c";
    ellipse(ctx, -7, -41, 2, 2);
    ctx.fill();
    for (const [dx, col] of [
      [1, "#f1c40f"],
      [5, "#3498db"],
      [9, "#2ecc71"],
    ] as const) {
      ctx.fillStyle = col;
      ellipse(ctx, dx, -34.5, 1.6, 1);
      ctx.fill();
    }
    // The coin door.
    ctx.fillStyle = "#1c0e2c";
    ctx.fillRect(-5, -22, 10, 10);
    ctx.fillStyle = "#e0b83a";
    ctx.fillRect(-1, -20, 2, 4);
  });
}
export function drawFreezer(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 28, 12, 0.28);
  // A white enamel chest.
  isoBox(ctx, x - 0.36, y - 0.28, x + 0.36, y + 0.28, 0, 28, {
    top: "#e6edf1",
    left: lin(ctx, 0, c.y - 28, 0, c.y, [
      [0, "#ffffff"],
      [1, "#dde4e9"],
    ]),
    right: "#c9d2d8",
  });
  const f0 = iso(x - 0.36, y + 0.28),
    f1 = iso(x + 0.36, y + 0.28);
  ctx.strokeStyle = "#4fa3d9";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(f0.x + 2, f0.y - 9);
  ctx.lineTo(f1.x - 1, f1.y - 9);
  ctx.stroke();
  ctx.fillStyle = "#8a959c";
  ctx.fillRect((f0.x + f1.x) / 2 - 3, (f0.y + f1.y) / 2 - 24, 6, 2);
  // Through the sliding glass: tubs of ice cream with scoops.
  const tubs: [number, number, string][] = [
    [-0.2, -0.1, "#ff9fb3"],
    [0.05, -0.1, "#fff1b8"],
    [0.25, -0.1, "#9fe0c8"],
    [-0.15, 0.12, "#8a5a3a"],
    [0.12, 0.12, "#c9a0ff"],
  ];
  for (const [dx, dy, col] of tubs) {
    const p = iso(x + dx, y + dy);
    ctx.fillStyle = "#aab6be";
    ctx.fillRect(p.x - 7, p.y - 30, 14, 3);
    ctx.fillStyle = col;
    ellipse(ctx, p.x, p.y - 30.5, 6.5, 2.6);
    ctx.fill();
    ctx.fillStyle = shade(col, 0.25);
    ellipse(ctx, p.x - 1.5, p.y - 31.5, 3, 1.4);
    ctx.fill();
  }
  // The glass lids: tinted, with a frame and a reflection.
  const A = iso(x - 0.34, y - 0.26),
    B = iso(x + 0.34, y - 0.26),
    C = iso(x + 0.34, y + 0.26),
    D = iso(x - 0.34, y + 0.26);
  ctx.fillStyle = "rgba(170,220,245,.45)";
  poly(ctx, [up(A, 29), up(B, 29), up(C, 29), up(D, 29)]);
  ctx.fill();
  ctx.strokeStyle = "#b9c3ca";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const m0 = iso(x, y - 0.26),
    m1 = iso(x, y + 0.26);
  ctx.beginPath();
  ctx.moveTo(m0.x, m0.y - 29);
  ctx.lineTo(m1.x, m1.y - 29);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.35)";
  poly(ctx, [
    up(iso(x - 0.3, y - 0.26), 29),
    up(iso(x - 0.18, y - 0.26), 29),
    up(iso(x - 0.3, y + 0.1), 29),
  ]);
  ctx.fill();
}
export function drawMassage(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 28, 12, 0.32);
  // A modern massage chair: a glossy black shell wrapped round cream
  // cushions, reclined, with a leg rest and a control panel.
  const shell = (x0: number, x1: number) =>
    lin(ctx, x0, 0, x1, 0, [
      [0, "#1c1c20"],
      [0.35, "#4a4a52"],
      [0.6, "#2a2a30"],
      [1, "#101014"],
    ]);
  const cream = (x0: number, x1: number) =>
    lin(ctx, x0, 0, x1, 0, [
      [0, "#cdb89a"],
      [0.4, "#f2e4cc"],
      [1, "#b8a080"],
    ]);
  // The base.
  ctx.fillStyle = "#18181c";
  ellipse(ctx, c.x, c.y - 2, 22, 8);
  ctx.fill();
  // The back shell, leaning back, with a hood round the head.
  ctx.fillStyle = shell(c.x - 20, c.x + 24);
  ctx.beginPath();
  ctx.moveTo(c.x - 18, c.y - 22);
  ctx.quadraticCurveTo(c.x - 16, c.y - 66, c.x + 2, c.y - 74);
  ctx.quadraticCurveTo(c.x + 20, c.y - 76, c.x + 22, c.y - 58);
  ctx.lineTo(c.x + 18, c.y - 22);
  ctx.closePath();
  ctx.fill();
  // The back cushion: rolls with seams.
  ctx.fillStyle = cream(c.x - 12, c.x + 14);
  ctx.beginPath();
  ctx.moveTo(c.x - 11, c.y - 24);
  ctx.quadraticCurveTo(c.x - 10, c.y - 60, c.x + 2, c.y - 66);
  ctx.quadraticCurveTo(c.x + 14, c.y - 66, c.x + 14, c.y - 52);
  ctx.lineTo(c.x + 12, c.y - 24);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(120,95,60,.45)";
  ctx.lineWidth = 1;
  for (const yy of [-32, -40, -48, -56]) {
    ctx.beginPath();
    ctx.moveTo(c.x - 10, c.y + yy);
    ctx.quadraticCurveTo(c.x + 1, c.y + yy + 2, c.x + 13, c.y + yy);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(c.x + 1, c.y - 62);
  ctx.lineTo(c.x + 1, c.y - 26);
  ctx.stroke();
  // The leg rest, sloping to the floor.
  ctx.fillStyle = shell(c.x - 12, c.x + 12);
  ctx.beginPath();
  ctx.moveTo(c.x - 11, c.y - 18);
  ctx.lineTo(c.x + 11, c.y - 18);
  ctx.lineTo(c.x + 9, c.y);
  ctx.lineTo(c.x - 9, c.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = cream(c.x - 8, c.x + 8);
  ctx.beginPath();
  ctx.moveTo(c.x - 8, c.y - 17);
  ctx.lineTo(c.x + 8, c.y - 17);
  ctx.lineTo(c.x + 6.5, c.y - 3);
  ctx.lineTo(c.x - 6.5, c.y - 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(120,95,60,.45)";
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 16);
  ctx.lineTo(c.x, c.y - 4);
  ctx.stroke();
  // The seat cushion.
  ctx.fillStyle = cream(c.x - 14, c.x + 14);
  ctx.beginPath();
  ctx.roundRect(c.x - 13, c.y - 26, 26, 9, 4.5);
  ctx.fill();
  glint(ctx, c.x - 4, c.y - 23.5, 6, 1.2, 0.35);
  // The arm wings, glossy, the remote on the right.
  for (const sx of [-1, 1]) {
    const ax = c.x + sx * 17;
    ctx.fillStyle = shell(ax - 6, ax + 6);
    ctx.beginPath();
    ctx.roundRect(ax - 6, c.y - 40, 12, 26, 6);
    ctx.fill();
    glint(ctx, ax - 2, c.y - 33, 1.4, 6, 0.3);
  }
  ctx.fillStyle = "#0c0c10";
  ctx.beginPath();
  ctx.roundRect(c.x + 13, c.y - 39, 8, 5, 1.5);
  ctx.fill();
  ctx.fillStyle = "#7ad3c4";
  ellipse(ctx, c.x + 15.5, c.y - 36.8, 1.2, 0.9);
  ctx.fill();
  ctx.fillStyle = "#ffb34a";
  ellipse(ctx, c.x + 18.5, c.y - 36.8, 1.2, 0.9);
  ctx.fill();
  glint(ctx, c.x + 6, c.y - 68, 6, 1.6, 0.25, -0.3);
}
export function drawPodium(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 30, 12, 0.3);
  const gold = (h: number) => ({
    top: lin(ctx, c.x - 20, 0, c.x + 20, 0, [
      [0, "#e9c25a"],
      [0.5, "#fff1b0"],
      [1, "#d4a63a"],
    ]),
    left: lin(ctx, 0, c.y - h, 0, c.y, [
      [0, "#f2cf6a"],
      [1, "#b8892a"],
    ]),
    right: "#9a7216",
  });
  isoBox(ctx, x - 0.36, y - 0.36, x + 0.36, y + 0.36, 0, 8, gold(8));
  isoBox(ctx, x - 0.28, y - 0.28, x + 0.28, y + 0.28, 8, 8, gold(16));
  isoBox(ctx, x - 0.2, y - 0.2, x + 0.2, y + 0.2, 16, 18, gold(34));
  // A velvet cushion and a gem on it.
  ctx.fillStyle = lin(ctx, c.x - 12, 0, c.x + 12, 0, [
    [0, "#8a1a20"],
    [0.4, "#c8303a"],
    [1, "#6e1218"],
  ]);
  ctx.beginPath();
  ctx.roundRect(c.x - 12, c.y - 42, 24, 7, 3.5);
  ctx.fill();
  const tw = 0.5 + 0.5 * Math.sin(t * 4);
  glow(ctx, c.x, c.y - 50, 22, "255,225,120", 0.2 + 0.2 * tw);
  ctx.fillStyle = lin(ctx, c.x - 5, c.y - 56, c.x + 5, c.y - 44, [
    [0, "#d9f2ff"],
    [1, "#4aa3e0"],
  ]);
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 56);
  ctx.lineTo(c.x + 5, c.y - 50);
  ctx.lineTo(c.x, c.y - 43);
  ctx.lineTo(c.x - 5, c.y - 50);
  ctx.closePath();
  ctx.fill();
  glint(ctx, c.x - 1.5, c.y - 52, 1.2, 2.2, 0.85);
}
export function drawRobot(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 24, 10, 0.28);
  // The dock: a disc with a glowing ring.
  ctx.fillStyle = "#3a4048";
  ellipse(ctx, c.x, c.y, 22, 10);
  ctx.fill();
  ctx.fillStyle = "#5a626b";
  ellipse(ctx, c.x, c.y - 2, 21, 9);
  ctx.fill();
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.5);
  ctx.strokeStyle = `rgba(90,220,255,${0.5 + pulse * 0.5})`;
  ctx.lineWidth = 1.6;
  ellipse(ctx, c.x, c.y - 2, 17, 7);
  ctx.stroke();
  const bob = Math.sin(t * 3) * 1.5;
  // The body: a glossy white capsule, a dark waist, a tray on top.
  ctx.fillStyle = lin(ctx, c.x - 12, 0, c.x + 12, 0, [
    [0, "#c9d2da"],
    [0.35, "#ffffff"],
    [1, "#9aa6b0"],
  ]);
  ctx.beginPath();
  ctx.roundRect(c.x - 11, c.y - 34 + bob, 22, 30, 10);
  ctx.fill();
  ctx.fillStyle = "#2a3038";
  ctx.fillRect(c.x - 11, c.y - 14 + bob, 22, 3);
  // Head with a screen face.
  ctx.fillStyle = lin(ctx, c.x - 9, 0, c.x + 9, 0, [
    [0, "#d6dde3"],
    [0.4, "#ffffff"],
    [1, "#a3aeb8"],
  ]);
  ctx.beginPath();
  ctx.roundRect(c.x - 9, c.y - 48 + bob, 18, 13, 5);
  ctx.fill();
  ctx.fillStyle = "#14202c";
  ctx.beginPath();
  ctx.roundRect(c.x - 7, c.y - 46 + bob, 14, 8, 3);
  ctx.fill();
  const blink = Math.sin(t * 1.7) > 0.96 ? 0.3 : 1;
  ctx.fillStyle = "#5fe0ff";
  for (const dx of [-3, 3]) {
    ellipse(ctx, c.x + dx, c.y - 42 + bob, 1.5, 1.6 * blink);
    ctx.fill();
  }
  // The tray it carries.
  ctx.fillStyle = "#c9ced3";
  ellipse(ctx, c.x + 14, c.y - 30 + bob, 9, 3);
  ctx.fill();
  ctx.strokeStyle = "#9aa3ab";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(c.x + 9, c.y - 24 + bob);
  ctx.lineTo(c.x + 13, c.y - 30 + bob);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(c.x + 11, c.y - 36 + bob, 6, 6, 1.5);
  ctx.fill();
  glint(ctx, c.x - 6, c.y - 26 + bob, 1.6, 6, 0.55);
}

/* ───────────── decor ───────────── */

export function drawScreen(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 26, 10, 0.26);
  // Three panels zig-zagging: a dark wood frame, paper with a lattice,
  // a plum branch painted across.
  const pts = [
    iso(x - 0.42, y + 0.1),
    iso(x - 0.14, y - 0.1),
    iso(x + 0.14, y + 0.1),
    iso(x + 0.42, y - 0.1),
  ];
  const H = 58;
  for (let i = 0; i < 3; i++) {
    const a = pts[i],
      b = pts[i + 1];
    const quad = [up(a, 0), up(b, 0), up(b, H), up(a, H)];
    ctx.fillStyle = i % 2 ? "#ebe0c4" : "#f6eed8";
    poly(ctx, quad);
    ctx.fill();
    ctx.save();
    poly(ctx, quad);
    ctx.clip();
    ctx.strokeStyle = "rgba(110,70,35,.55)";
    ctx.lineWidth = 0.8;
    for (let k = 1; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - (H * k) / 5);
      ctx.lineTo(b.x, b.y - (H * k) / 5);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
    ctx.lineTo((a.x + b.x) / 2, (a.y + b.y) / 2 - H);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = "#5a3420";
    ctx.lineWidth = 2.2;
    poly(ctx, quad);
    ctx.stroke();
  }
  ctx.strokeStyle = "#3a2418";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(pts[0].x + 4, pts[0].y - 18);
  ctx.bezierCurveTo(
    pts[1].x,
    pts[1].y - 36,
    pts[2].x - 4,
    pts[2].y - 26,
    pts[3].x - 6,
    pts[3].y - 44,
  );
  ctx.stroke();
  ctx.fillStyle = "#e85a7a";
  for (let i = 0; i < 7; i++) {
    const f = i / 6;
    const px = pts[0].x + 6 + (pts[3].x - pts[0].x - 12) * f,
      py = pts[0].y - 22 - f * 22 - Math.sin(f * 6) * 4;
    ellipse(ctx, px, py, 1.8, 1.6);
    ctx.fill();
  }
}
export function drawBookshelf(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 26, 11, 0.28);
  woodBox(ctx, x - 0.34, y - 0.22, x + 0.34, y + 0.22, 0, 66, "#6e4126", 9);
  // The open front (the left face): shelves of books.
  const D = iso(x - 0.34, y + 0.22),
    C = iso(x + 0.34, y + 0.22);
  const along = (f: number, z: number): Pt => ({
    x: D.x + (C.x - D.x) * f,
    y: D.y + (C.y - D.y) * f - z,
  });
  ctx.fillStyle = "#2e1a0e";
  poly(ctx, [along(0.06, 4), along(0.94, 4), along(0.94, 62), along(0.06, 62)]);
  ctx.fill();
  const cols = [
    "#9b2d2a",
    "#2e5f8a",
    "#c79a2a",
    "#2f7a4a",
    "#6a3f8a",
    "#d8cfbe",
    "#8a4a2a",
  ];
  for (let r = 0; r < 3; r++) {
    const z0 = 5 + r * 19;
    let f = 0.08;
    let i = 0;
    while (f < 0.9) {
      const w = 0.055 + rnd(r * 13 + i) * 0.04,
        h = 12 + rnd(r * 7 + i) * 5;
      const lean = i === 4 && r === 1 ? 2.5 : 0;
      const p0 = along(f, z0),
        p1 = along(Math.min(0.92, f + w), z0);
      const col = cols[(i + r * 3) % cols.length];
      ctx.fillStyle = col;
      poly(ctx, [
        p0,
        p1,
        { x: p1.x + lean, y: p1.y - h },
        { x: p0.x + lean, y: p0.y - h },
      ]);
      ctx.fill();
      ctx.fillStyle = shade(col, 0.35);
      poly(ctx, [
        { x: p0.x, y: p0.y - h * 0.72 },
        { x: p1.x, y: p1.y - h * 0.72 },
        { x: p1.x, y: p1.y - h * 0.62 },
        { x: p0.x, y: p0.y - h * 0.62 },
      ]);
      ctx.fill();
      f += w + 0.006;
      i++;
    }
    // The shelf board.
    ctx.fillStyle = "#8a5a34";
    poly(ctx, [
      along(0.06, z0),
      along(0.94, z0),
      along(0.94, z0 - 2),
      along(0.06, z0 - 2),
    ]);
    ctx.fill();
  }
}
export function drawKoi(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  // A ring of grey stones round dark water.
  ctx.fillStyle = "#6e7378";
  ellipse(ctx, c.x, c.y - 3, 36, 17);
  ctx.fill();
  ctx.fillStyle = rad(ctx, c.x - 6, c.y - 10, 32, [
    [0, "#3fa3c4"],
    [0.6, "#1f6f8f"],
    [1, "#123f55"],
  ]);
  ellipse(ctx, c.x, c.y - 5, 29, 13);
  ctx.fill();
  // Koi: orange and white, with a tail that swings.
  for (let i = 0; i < 3; i++) {
    const a = t * (0.5 + i * 0.18) + i * 2.1;
    const fx = c.x + Math.cos(a) * (14 + i * 3),
      fy = c.y - 5 + Math.sin(a) * (5 + i);
    const dir = a + Math.PI / 2;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(1, 0.55);
    ctx.rotate(dir);
    ctx.fillStyle = i === 1 ? "#ffffff" : "#ff7a2e";
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 2.6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = i === 1 ? "#ff5a2e" : "#ffffff";
    ellipse(ctx, 1.5, 0, 2, 1.4);
    ctx.fill();
    ctx.fillStyle = i === 1 ? "#f2f2f2" : "#ff8a3d";
    const sw = Math.sin(t * 6 + i) * 1.5;
    ctx.beginPath();
    ctx.moveTo(-5.5, 0);
    ctx.lineTo(-9.5, -2.5 + sw);
    ctx.lineTo(-9.5, 2.5 + sw);
    ctx.fill();
    ctx.restore();
  }
  // Lily pads with a flower; a glint on the water.
  for (const [dx, dy, r] of [
    [16, -9, 5],
    [-17, -2, 4],
  ] as const) {
    ctx.fillStyle = "#3f9a45";
    ctx.beginPath();
    ctx.ellipse(c.x + dx, c.y + dy, r, r * 0.5, 0, 0.3, TAU - 0.1);
    ctx.lineTo(c.x + dx, c.y + dy);
    ctx.fill();
  }
  ctx.fillStyle = "#ffc2d8";
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * TAU;
    ellipse(
      ctx,
      c.x + 16 + Math.cos(a) * 1.8,
      c.y - 10.5 + Math.sin(a) * 0.9,
      1.6,
      1,
    );
    ctx.fill();
  }
  glint(ctx, c.x - 10, c.y - 11, 8, 1.2, 0.25);
  // The stones: each a rounded lump with its own shade.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const sx = c.x + Math.cos(a) * 32,
      sy = c.y - 3 + Math.sin(a) * 14.5;
    if (Math.sin(a) < -0.2) continue; // the far stones are hidden by the water's rim
    ctx.fillStyle = rad(ctx, sx - 1.5, sy - 2, 6, [
      [0, shade("#a8adb2", rnd(i) * 0.2)],
      [1, "#5f6468"],
    ]);
    ellipse(ctx, sx, sy, 5 + rnd(i + 3) * 2, 3.2 + rnd(i + 5));
    ctx.fill();
  }
}
export function drawChandelier(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 18, 8, 0.26);
  const brass = (x0: number, x1: number) =>
    lin(ctx, x0, 0, x1, 0, [
      [0, "#8a6a1a"],
      [0.4, "#f2d36a"],
      [1, "#7a5a12"],
    ]);
  // A turned brass stand on a round foot.
  ctx.fillStyle = brass(c.x - 12, c.x + 12);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 2, 12, 4.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = brass(c.x - 2.5, c.x + 2.5);
  ctx.fillRect(c.x - 2, c.y - 64, 4, 62);
  for (const yy of [-20, -42]) {
    ctx.fillStyle = brass(c.x - 4.5, c.x + 4.5);
    ellipse(ctx, c.x, c.y + yy, 4.5, 2.4);
    ctx.fill();
  }
  // Arms with candles, crystal drops hanging below.
  glow(ctx, c.x, c.y - 78, 36, "255,240,190", 0.3);
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i / 4) * Math.PI;
    const ax = c.x + Math.cos(a) * 18,
      ay = c.y - 66 + Math.sin(a) * -4;
    ctx.strokeStyle = brass(c.x - 18, c.x + 18);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 62);
    ctx.quadraticCurveTo((c.x + ax) / 2, c.y - 58, ax, ay);
    ctx.stroke();
    ctx.fillStyle = "#fbf6ea";
    ctx.fillRect(ax - 1.5, ay - 9, 3, 9);
    const fl = 1 + Math.sin(t * 9 + i) * 0.15;
    ctx.fillStyle = "rgba(255,200,90,.95)";
    ctx.beginPath();
    ctx.ellipse(ax, ay - 11, 1.4, 2.6 * fl, 0, 0, TAU);
    ctx.fill();
    for (const k of [0, 1]) {
      const dx = ax + (k ? 3 : -3),
        dy = ay + 3 + k * 2;
      ctx.fillStyle = "rgba(225,240,255,.95)";
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx + 1.4, dy + 3);
      ctx.lineTo(dx, dy + 6);
      ctx.lineTo(dx - 1.4, dy + 3);
      ctx.closePath();
      ctx.fill();
    }
  }
}
export function drawHayBale(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 30, 13, 0.28);
  isoBox(ctx, x - 0.38, y - 0.26, x + 0.38, y + 0.26, 0, 24, {
    top: "#ecd27a",
    left: lin(ctx, 0, c.y - 24, 0, c.y, [
      [0, "#e2c060"],
      [1, "#b8913a"],
    ]),
    right: "#a8823a",
  });
  // Straw: many short strokes on every face.
  const A = iso(x - 0.38, y - 0.26),
    B = iso(x + 0.38, y - 0.26),
    C = iso(x + 0.38, y + 0.26),
    D = iso(x - 0.38, y + 0.26);
  const faces: Pt[][] = [
    [up(A, 24), up(B, 24), up(C, 24), up(D, 24)],
    [up(D, 0), up(C, 0), up(C, 24), up(D, 24)],
    [up(B, 0), up(C, 0), up(C, 24), up(B, 24)],
  ];
  for (const [fi, f] of faces.entries()) {
    ctx.save();
    poly(ctx, f);
    ctx.clip();
    const xs = f.map((p) => p.x),
      ys = f.map((p) => p.y);
    const x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      y0 = Math.min(...ys),
      y1 = Math.max(...ys);
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 60; i++) {
      const px = x0 + rnd(i * 3 + fi) * (x1 - x0),
        py = y0 + rnd(i * 7 + fi * 5) * (y1 - y0);
      const a = (rnd(i + fi * 11) - 0.5) * 1.2 + (fi === 0 ? 0.3 : 0);
      ctx.strokeStyle = i % 3 ? "rgba(140,100,30,.45)" : "rgba(255,240,170,.6)";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a) * 5, py + Math.sin(a) * 5);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Two bands of twine.
  ctx.strokeStyle = "#7a5a2a";
  ctx.lineWidth = 1.4;
  for (const f of [0.3, 0.7]) {
    const a = iso(x - 0.38 + f * 0.76, y - 0.26),
      d = iso(x - 0.38 + f * 0.76, y + 0.26);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - 24);
    ctx.lineTo(d.x, d.y - 24);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }
}
export function drawTrophy(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 20, 9, 0.28);
  woodBox(ctx, x - 0.24, y - 0.24, x + 0.24, y + 0.24, 0, 20, "#4e2c18", 11);
  // A small brass plaque.
  const f = iso(x, y + 0.24);
  ctx.fillStyle = "#d9b44a";
  ctx.fillRect(f.x - 12, f.y - 13, 9, 5);
  // The Golden Plate on a stand: an engraved rim, a deep shine.
  const py = c.y - 40;
  ctx.strokeStyle = "#a07818";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x - 5, c.y - 21);
  ctx.lineTo(c.x, py + 8);
  ctx.lineTo(c.x + 5, c.y - 21);
  ctx.stroke();
  ctx.fillStyle = lin(ctx, c.x - 15, py - 15, c.x + 15, py + 15, [
    [0, "#fff1a8"],
    [0.4, "#e8b83a"],
    [0.7, "#c48a1a"],
    [1, "#f2d36a"],
  ]);
  ellipse(ctx, c.x, py, 14, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(140,90,10,.6)";
  ctx.lineWidth = 1;
  ellipse(ctx, c.x, py, 10.5, 10.5);
  ctx.stroke();
  ctx.setLineDash([1.5, 1.5]);
  ellipse(ctx, c.x, py, 12.5, 12.5);
  ctx.stroke();
  ctx.setLineDash([]);
  const sh = (t * 0.4) % 1;
  ctx.save();
  ellipse(ctx, c.x, py, 14, 14);
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,.45)";
  ctx.beginPath();
  ctx.moveTo(c.x - 20 + sh * 40, py - 16);
  ctx.lineTo(c.x - 14 + sh * 40, py - 16);
  ctx.lineTo(c.x - 26 + sh * 40, py + 16);
  ctx.lineTo(c.x - 32 + sh * 40, py + 16);
  ctx.fill();
  ctx.restore();
}
