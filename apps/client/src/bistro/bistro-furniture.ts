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

/* ───────────── pieces with a still body and a moving part ───────────── *
 * Each has a body (drawn once into a bitmap by bistro-art) and a live part
 * drawn every frame on top: a swinging lantern, swimming fish, flames.   */

/** A paper lantern: ribs, gold caps, a warm light inside, a tassel. */
function paperLantern(
  ctx: Ctx,
  lx: number,
  ly: number,
  r: number,
  red: string,
  t: number,
  sw: number,
) {
  glow(ctx, lx, ly, r * 2.6, "255,170,90", 0.22 + 0.04 * Math.sin(t * 3));
  ctx.fillStyle = rad(ctx, lx - r * 0.25, ly - r * 0.2, r * 1.3, [
    [0, "#ffd9a0"],
    [0.35, shade(red, 0.25)],
    [0.8, red],
    [1, shade(red, -0.35)],
  ]);
  ellipse(ctx, lx, ly, r, r * 1.15);
  ctx.fill();
  ctx.strokeStyle = "rgba(90,15,10,.45)";
  ctx.lineWidth = 0.8;
  for (const f of [0.35, 0.7]) {
    ellipse(ctx, lx, ly, r * f, r * 1.15);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,220,160,.35)";
  for (const dy of [-0.55, 0, 0.55]) {
    ctx.beginPath();
    ctx.ellipse(
      lx,
      ly + dy * r,
      r * Math.sqrt(1 - dy * dy * 0.75),
      r * 0.18,
      0,
      0,
      Math.PI,
    );
    ctx.stroke();
  }
  ctx.fillStyle = lin(ctx, lx - r * 0.5, 0, lx + r * 0.5, 0, [
    [0, "#b8862a"],
    [0.5, "#ffe08a"],
    [1, "#a07018"],
  ]);
  ctx.fillRect(lx - r * 0.48, ly - r * 1.22, r * 0.96, r * 0.24);
  ctx.fillRect(lx - r * 0.48, ly + r * 1.0, r * 0.96, r * 0.24);
  ctx.strokeStyle = "#d4302a";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(lx, ly + r * 1.24);
  ctx.lineTo(lx + sw * 0.4, ly + r * 1.9);
  ctx.stroke();
  ctx.fillStyle = "#d4302a";
  ctx.beginPath();
  ctx.moveTo(lx + sw * 0.4 - 1.6, ly + r * 1.9);
  ctx.lineTo(lx + sw * 0.4 + 1.6, ly + r * 1.9);
  ctx.lineTo(lx + sw * 0.5 + 1, ly + r * 2.4);
  ctx.lineTo(lx + sw * 0.5 - 1, ly + r * 2.4);
  ctx.fill();
  glint(ctx, lx - r * 0.45, ly - r * 0.35, r * 0.12, r * 0.4, 0.35, 0.2);
}

export function lampBody(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 16, 7, 0.26);
  // A turned wooden base and post, a brass hook.
  ctx.fillStyle = lin(ctx, c.x - 10, 0, c.x + 10, 0, [
    [0, "#3a2210"],
    [0.4, "#7a4e2c"],
    [1, "#2e1a0c"],
  ]);
  ellipse(ctx, c.x, c.y - 1, 10, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 4, 7, 3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = lin(ctx, c.x - 2, 0, c.x + 2, 0, [
    [0, "#3a2210"],
    [0.45, "#8a5a34"],
    [1, "#2e1a0c"],
  ]);
  ctx.fillRect(c.x - 1.8, c.y - 76, 3.6, 72);
  ctx.strokeStyle = lin(ctx, c.x, 0, c.x + 14, 0, [
    [0, "#8a6a1a"],
    [0.5, "#f2d36a"],
    [1, "#8a6a1a"],
  ]);
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 74);
  ctx.quadraticCurveTo(c.x + 2, c.y - 88, c.x + 14, c.y - 86);
  ctx.stroke();
}
export function lampLive(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  const sw = Math.sin(t * 1.6) * 1.5;
  ctx.strokeStyle = "#3a2210";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(c.x + 14, c.y - 86);
  ctx.lineTo(c.x + 14 + sw, c.y - 81);
  ctx.stroke();
  paperLantern(ctx, c.x + 14 + sw, c.y - 66, 12, "#d8362c", t, sw);
}

export function luckyCatBody(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 20, 9, 0.28);
  // A lacquered red pedestal with a gold band.
  isoBox(ctx, x - 0.26, y - 0.26, x + 0.26, y + 0.26, 0, 22, {
    top: lin(ctx, c.x - 20, 0, c.x + 20, 0, [
      [0, "#a8221e"],
      [0.5, "#e04a40"],
      [1, "#8a1a16"],
    ]),
    left: lin(ctx, 0, c.y - 22, 0, c.y, [
      [0, "#c8302a"],
      [1, "#8a1c18"],
    ]),
    right: "#701410",
  });
  onFront(ctx, x, y + 0.26, 0, () => {
    ctx.fillStyle = "#e0b83a";
    ctx.fillRect(-12, -16, 24, 2);
  });
  const by = c.y - 22;
  const porcelain = (r: number, cx: number, cy: number) =>
    rad(ctx, cx - r * 0.35, cy - r * 0.4, r * 1.3, [
      [0, "#ffffff"],
      [0.7, "#f3efe8"],
      [1, "#d9d2c6"],
    ]);
  // Body and the paw in its lap.
  ctx.fillStyle = porcelain(14, c.x, by - 14);
  ellipse(ctx, c.x, by - 14, 13, 15);
  ctx.fill();
  ctx.fillStyle = porcelain(5, c.x - 7, by - 16);
  ellipse(ctx, c.x - 7, by - 15, 4.5, 5.5);
  ctx.fill();
  // The gold koban coin it holds.
  ctx.fillStyle = lin(ctx, c.x - 6, by - 16, c.x + 6, by - 4, [
    [0, "#fff1a8"],
    [0.5, "#e8b83a"],
    [1, "#b8861a"],
  ]);
  ellipse(ctx, c.x + 1, by - 9, 7, 5.5);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,80,10,.6)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(c.x + 1, by - 13);
  ctx.lineTo(c.x + 1, by - 5);
  ctx.moveTo(c.x - 2, by - 9);
  ctx.lineTo(c.x + 4, by - 9);
  ctx.stroke();
  // Head, ears.
  ctx.fillStyle = porcelain(12, c.x, by - 34);
  ellipse(ctx, c.x, by - 34, 12, 10);
  ctx.fill();
  for (const sx of [-1, 1]) {
    ctx.fillStyle = "#f6f2ec";
    ctx.beginPath();
    ctx.moveTo(c.x + sx * 11, by - 38);
    ctx.lineTo(c.x + sx * 8, by - 48);
    ctx.lineTo(c.x + sx * 3, by - 42);
    ctx.fill();
    ctx.fillStyle = "#f29aa6";
    ctx.beginPath();
    ctx.moveTo(c.x + sx * 9.5, by - 40);
    ctx.lineTo(c.x + sx * 8, by - 45);
    ctx.lineTo(c.x + sx * 5, by - 42);
    ctx.fill();
  }
  // Painted face: happy closed eyes, a pink nose, whiskers, red spots.
  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(c.x - 4.5, by - 34, 2, Math.PI * 1.1, Math.PI * 1.9);
  ctx.moveTo(c.x + 6.4, by - 34.7);
  ctx.arc(c.x + 4.5, by - 34, 2, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (const sx of [-1, 1])
    for (const dy of [-0.6, 0.8]) {
      ctx.moveTo(c.x + sx * 4, by - 30 + dy);
      ctx.lineTo(c.x + sx * 11, by - 31 + dy * 2);
    }
  ctx.stroke();
  ctx.fillStyle = "#ff8a8a";
  ellipse(ctx, c.x, by - 31, 1.4, 1);
  ctx.fill();
  ctx.fillStyle = "rgba(230,80,80,.35)";
  for (const sx of [-1, 1]) {
    ellipse(ctx, c.x + sx * 7, by - 31, 2.2, 1.2);
    ctx.fill();
  }
  // A red collar with a gold bell.
  ctx.fillStyle = "#c8302a";
  ctx.beginPath();
  ctx.ellipse(c.x, by - 25.5, 10, 2.4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rad(ctx, c.x - 0.8, by - 23, 3, [
    [0, "#fff1a8"],
    [1, "#c8901a"],
  ]);
  ellipse(ctx, c.x, by - 22, 2.6, 2.6);
  ctx.fill();
  glint(ctx, c.x - 5, by - 18, 2, 5, 0.6, 0.3);
  glint(ctx, c.x - 4, by - 38, 2.5, 1.2, 0.7);
}
export function luckyCatLive(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  const by = c.y - 22;
  const wave = Math.sin(t * 4) * 0.45;
  ctx.save();
  ctx.translate(c.x + 9, by - 22);
  ctx.rotate(-0.5 + wave);
  ctx.fillStyle = lin(ctx, -3.5, 0, 3.5, 0, [
    [0, "#ffffff"],
    [1, "#dcd5ca"],
  ]);
  ctx.beginPath();
  ctx.roundRect(-3.5, -18, 7, 18, 3.5);
  ctx.fill();
  ctx.fillStyle = "#f29aa6";
  ellipse(ctx, 0, -15, 1.6, 1.2);
  ctx.fill();
  ctx.restore();
}

export function jukeboxBody(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 26, 12, 0.3);
  woodBox(ctx, x - 0.34, y - 0.3, x + 0.34, y + 0.3, 0, 62, "#8a4a22", 13);
  onFront(ctx, x, y + 0.3, 0, () => {
    // The arched chrome bezel round a glass dome with records inside.
    ctx.fillStyle = lin(ctx, -16, 0, 16, 0, [
      [0, "#8d969e"],
      [0.3, "#f2f4f6"],
      [0.7, "#c4cbd1"],
      [1, "#7a838b"],
    ]);
    ctx.beginPath();
    ctx.moveTo(-15, -26);
    ctx.lineTo(-15, -46);
    ctx.quadraticCurveTo(-15, -66, 0, -68);
    ctx.quadraticCurveTo(15, -66, 15, -46);
    ctx.lineTo(15, -26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1c1210";
    ctx.beginPath();
    ctx.moveTo(-11, -30);
    ctx.lineTo(-11, -46);
    ctx.quadraticCurveTo(-11, -62, 0, -63);
    ctx.quadraticCurveTo(11, -62, 11, -46);
    ctx.lineTo(11, -30);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "#0c0c0c";
      ellipse(ctx, -6 + i * 4, -42 - (i % 2), 4, 4);
      ctx.fill();
      ctx.fillStyle = i % 2 ? "#d4302a" : "#e8b83a";
      ellipse(ctx, -6 + i * 4, -42 - (i % 2), 1.2, 1.2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.beginPath();
    ctx.moveTo(-9, -48);
    ctx.quadraticCurveTo(-8, -60, 0, -61);
    ctx.lineTo(0, -58);
    ctx.quadraticCurveTo(-6, -57, -7, -48);
    ctx.fill();
    // Selector buttons and a chrome speaker grille.
    ctx.fillStyle = "#f2e8d0";
    ctx.fillRect(-10, -28, 20, 4);
    ctx.fillStyle = "#c8302a";
    for (let i = 0; i < 5; i++) ctx.fillRect(-9 + i * 4, -27.4, 2.4, 2.6);
    ctx.fillStyle = "#2a1810";
    ctx.fillRect(-12, -21, 24, 14);
    ctx.fillStyle = lin(ctx, -12, 0, 12, 0, [
      [0, "#8d969e"],
      [0.5, "#eef1f3"],
      [1, "#7a838b"],
    ]);
    for (let i = 0; i < 6; i++) ctx.fillRect(-11 + i * 4.2, -20, 1.4, 12);
  });
}
export function jukeboxLive(ctx: Ctx, x: number, y: number, t: number) {
  const hue = (t * 60) % 360;
  onFront(ctx, x, y + 0.3, 0, () => {
    // Neon tubes up the arch, the colours cycling.
    ctx.strokeStyle = `hsl(${hue},95%,62%)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-13, -27);
    ctx.lineTo(-13, -46);
    ctx.quadraticCurveTo(-13, -64, 0, -65.5);
    ctx.quadraticCurveTo(13, -64, 13, -46);
    ctx.lineTo(13, -27);
    ctx.stroke();
    glow(ctx, 0, -52, 22, "255,200,120", 0.12);
    // Lights in the selector strip.
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = `hsla(${(hue + i * 50) % 360},90%,65%,${0.5 + 0.5 * Math.abs(Math.sin(t * 5 + i))})`;
      ctx.fillRect(-9 + i * 4, -33, 2.4, 2);
    }
  });
}

export function aquariumBody(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 34, 15, 0.3);
  woodBox(ctx, x - 0.44, y - 0.3, x + 0.44, y + 0.3, 0, 24, "#5a3a22", 17);
  onFront(ctx, x, y + 0.3, 0, () => {
    ctx.strokeStyle = "rgba(20,10,5,.5)";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-19, -20, 18, 16);
    ctx.strokeRect(1, -20, 18, 16);
    ctx.fillStyle = "#d9b44a";
    ctx.fillRect(-3, -13, 1.4, 3);
    ctx.fillRect(1.6, -13, 1.4, 3);
  });
  // The water: deeper blue at the bottom, gravel, rocks and plants.
  const tankCol = {
    top: "rgba(170,230,255,.5)",
    left: lin(ctx, 0, c.y - 74, 0, c.y - 24, [
      [0, "rgba(120,210,245,.8)"],
      [1, "rgba(25,95,150,.92)"],
    ]),
    right: "rgba(25,90,145,.9)",
  };
  isoBox(ctx, x - 0.44, y - 0.3, x + 0.44, y + 0.3, 24, 48, tankCol);
  onFront(ctx, x, y + 0.3, 24, () => {
    ctx.fillStyle = "#c9a878";
    ctx.beginPath();
    ctx.moveTo(-21, 0);
    for (let i = 0; i <= 10; i++)
      ctx.lineTo(-21 + i * 4.2, -4 - rnd(i + 3) * 3);
    ctx.lineTo(21, 0);
    ctx.fill();
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = ["#e8d4a8", "#a8865a", "#f2e6c8"][i % 3];
      ellipse(ctx, -19 + rnd(i) * 38, -1.5 - rnd(i + 7) * 2.5, 0.9, 0.6);
      ctx.fill();
    }
    ctx.fillStyle = "#6e7378";
    ellipse(ctx, 10, -6, 6, 4.5);
    ctx.fill();
    ctx.fillStyle = "#8a8f94";
    ellipse(ctx, 8.6, -7.2, 3.5, 2.2);
    ctx.fill();
    // Weed: tall ribbons of green.
    for (const [px, h, col] of [
      [-15, 30, "#3fae6a"],
      [-11, 22, "#2f8f55"],
      [16, 26, "#4fbf74"],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, -3);
      ctx.bezierCurveTo(px - 3, -h * 0.4, px + 3, -h * 0.7, px, -h);
      ctx.stroke();
    }
  });
  // The rim and the lid with its light.
  isoBox(ctx, x - 0.46, y - 0.32, x + 0.46, y + 0.32, 72, 4, {
    top: "#2a2f36",
    left: "#1f2328",
    right: "#171a1e",
  });
}
export function aquariumLive(ctx: Ctx, x: number, y: number, t: number) {
  onFront(ctx, x, y + 0.3, 24, () => {
    const fishes = [
      ["#ff8a3d", 0.0, 14],
      ["#ffd65b", 0.45, 26],
      ["#ff5a7a", 0.8, 36],
    ] as const;
    for (const [col, ph, dz] of fishes) {
      const u = Math.sin(t * 0.7 + ph * 6);
      const dirR = Math.cos(t * 0.7 + ph * 6) > 0;
      const px = u * 15,
        py = -dz;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(px, py, 4.5, 2.6, 0, 0, TAU);
      ctx.fill();
      const tx = dirR ? px - 4.5 : px + 4.5;
      ctx.beginPath();
      ctx.moveTo(tx, py);
      ctx.lineTo(tx + (dirR ? -3.5 : 3.5), py - 2.6);
      ctx.lineTo(tx + (dirR ? -3.5 : 3.5), py + 2.6);
      ctx.fill();
      ctx.fillStyle = "#111";
      ellipse(ctx, px + (dirR ? 2.4 : -2.4), py - 0.6, 0.6, 0.6);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,.7)";
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.6 + i * 0.25) % 1;
      ellipse(
        ctx,
        9 + Math.sin(ph * 12) * 1.5,
        -6 - ph * 38,
        0.9 + ph * 0.8,
        0.9 + ph * 0.8,
      );
      ctx.fill();
    }
    // Light rippling through the water, and the glass's glint.
    ctx.fillStyle = `rgba(255,255,255,${0.08 + 0.05 * Math.sin(t * 2)})`;
    ctx.fillRect(-20, -46, 40, 4);
    ctx.fillStyle = "rgba(255,255,255,.2)";
    ctx.beginPath();
    ctx.moveTo(-17, -44);
    ctx.lineTo(-13, -44);
    ctx.lineTo(-17, -8);
    ctx.lineTo(-21, -8);
    ctx.fill();
  });
}

export function fountainBody(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 38, 16, 0.3);
  // A carved stone basin: its wall, a moulded rim, speckled stone.
  ctx.fillStyle = lin(ctx, c.x - 34, 0, c.x + 34, 0, [
    [0, "#8a8f98"],
    [0.4, "#d9dde4"],
    [1, "#767c86"],
  ]);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 4, 34, 15, 0, 0, Math.PI);
  ctx.lineTo(c.x - 34, c.y - 18);
  ctx.ellipse(c.x, c.y - 18, 34, 15, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(90,95,105,.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 9, 34, 15, 0, 0.1, Math.PI - 0.1);
  ctx.stroke();
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = i % 2 ? "rgba(80,85,95,.35)" : "rgba(255,255,255,.35)";
    const a = rnd(i) * Math.PI;
    ellipse(
      ctx,
      c.x + Math.cos(a) * 32,
      c.y - 6 - rnd(i + 5) * 10 + Math.sin(a) * 13,
      0.8,
      0.6,
    );
    ctx.fill();
  }
  ctx.fillStyle = lin(ctx, c.x - 36, 0, c.x + 36, 0, [
    [0, "#b9bfc8"],
    [0.4, "#eef0f3"],
    [1, "#a3a9b3"],
  ]);
  ellipse(ctx, c.x, c.y - 18, 35, 15.5);
  ctx.fill();
  // The water, deeper in the middle.
  ctx.fillStyle = rad(ctx, c.x - 6, c.y - 21, 30, [
    [0, "#8ae0ff"],
    [0.6, "#3fa3d9"],
    [1, "#2a7fb8"],
  ]);
  ellipse(ctx, c.x, c.y - 18, 29, 12);
  ctx.fill();
  // A central column with a small upper bowl.
  ctx.fillStyle = lin(ctx, c.x - 5, 0, c.x + 5, 0, [
    [0, "#8a8f98"],
    [0.4, "#e6e9ee"],
    [1, "#7a808a"],
  ]);
  ctx.fillRect(c.x - 4, c.y - 42, 8, 24);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 42, 12, 4.5, 0, 0, Math.PI);
  ctx.lineTo(c.x - 12, c.y - 44);
  ctx.ellipse(c.x, c.y - 44, 12, 4.5, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#5fc0ec";
  ellipse(ctx, c.x, c.y - 44, 10, 3.5);
  ctx.fill();
}
export function fountainLive(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  // Ripples on the basin.
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 2; i++) {
    const ph = (t * 0.6 + i * 0.5) % 1;
    ctx.globalAlpha = 1 - ph;
    ellipse(ctx, c.x, c.y - 18, 8 + ph * 20, 3 + ph * 8);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Water falling from the upper bowl in arcs.
  ctx.strokeStyle = "rgba(200,240,255,.75)";
  ctx.lineWidth = 1.6;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c.x + s * 11, c.y - 44);
    ctx.quadraticCurveTo(
      c.x + s * 18,
      c.y - 42 + Math.sin(t * 8) * 1,
      c.x + s * 21,
      c.y - 21,
    );
    ctx.stroke();
  }
  // The element crystal floating above, slowly turning colour.
  const hue = (t * 40) % 360;
  const by = c.y - 52 + Math.sin(t * 2) * 2;
  glow(ctx, c.x, by - 14, 22, "200,240,255", 0.25);
  ctx.fillStyle = lin(ctx, c.x - 9, by - 30, c.x + 9, by, [
    [0, `hsl(${hue},95%,85%)`],
    [1, `hsl(${(hue + 60) % 360},85%,55%)`],
  ]);
  ctx.beginPath();
  ctx.moveTo(c.x, by - 30);
  ctx.lineTo(c.x + 9, by - 14);
  ctx.lineTo(c.x, by);
  ctx.lineTo(c.x - 9, by - 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.beginPath();
  ctx.moveTo(c.x, by - 30);
  ctx.lineTo(c.x - 9, by - 14);
  ctx.lineTo(c.x - 2, by - 14);
  ctx.closePath();
  ctx.fill();
}

export function drawPiano(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 4, 38, 15, 0.32);
  // Three legs with brass casters.
  for (const [lx, ly] of [
    [-0.36, 0.3],
    [0.36, 0.3],
    [0.3, -0.3],
  ]) {
    const p = iso(x + lx, y + ly);
    ctx.fillStyle = "#121216";
    ctx.beginPath();
    ctx.moveTo(p.x - 2.6, p.y - 15);
    ctx.lineTo(p.x + 2.6, p.y - 15);
    ctx.lineTo(p.x + 1.6, p.y - 2);
    ctx.lineTo(p.x - 1.6, p.y - 2);
    ctx.fill();
    ctx.fillStyle = "#d9b44a";
    ellipse(ctx, p.x, p.y - 1, 2, 1.2);
    ctx.fill();
  }
  // The case: glossy black lacquer with reflections.
  isoBox(ctx, x - 0.42, y - 0.36, x + 0.42, y + 0.36, 14, 18, {
    top: "#16161a",
    left: lin(ctx, 0, c.y - 32, 0, c.y - 14, [
      [0, "#2e2e36"],
      [1, "#0e0e12"],
    ]),
    right: "#0a0a0e",
  });
  // Inside, under the raised lid: the gold harp and strings.
  const A = iso(x - 0.38, y - 0.32),
    B = iso(x + 0.38, y - 0.32),
    C = iso(x + 0.38, y + 0.2),
    D = iso(x - 0.38, y + 0.2);
  ctx.fillStyle = "#b8862a";
  poly(ctx, [up(A, 32.5), up(B, 32.5), up(C, 32.5), up(D, 32.5)]);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,240,200,.6)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = 1; i < 9; i++) {
    const f = i / 9;
    const p0 = iso(x - 0.38 + 0.76 * f, y - 0.3),
      p1 = iso(x - 0.38 + 0.76 * f, y + 0.18);
    ctx.moveTo(p0.x, p0.y - 33);
    ctx.lineTo(p1.x, p1.y - 33);
  }
  ctx.stroke();
  // The keyboard along the front: white keys, black keys.
  onFront(ctx, x, y + 0.36, 14, () => {
    ctx.fillStyle = "#0a0a0e";
    ctx.fillRect(-20, -20, 40, 6);
    ctx.fillStyle = "#f6f4ee";
    ctx.fillRect(-19, -19, 38, 4);
    ctx.fillStyle = "rgba(0,0,0,.25)";
    for (let i = 1; i < 16; i++) ctx.fillRect(-19 + i * 2.4, -19, 0.3, 4);
    ctx.fillStyle = "#111";
    for (let i = 0; i < 15; i++)
      if (i % 7 !== 2 && i % 7 !== 6)
        ctx.fillRect(-18 + i * 2.4, -19, 1.3, 2.4);
    ctx.fillStyle = "#d9b44a";
    ctx.fillRect(-4, -11, 8, 1);
  });
  // The raised lid on its prop stick, catching the light along its edge.
  const L0 = up(A, 33),
    L1 = up(B, 33),
    L2 = up(iso(x + 0.38, y + 0.05), 33);
  const top = { x: (L0.x + L1.x) / 2 + 6, y: (L0.y + L1.y) / 2 - 30 };
  ctx.strokeStyle = "#1c1c20";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(L2.x - 6, L2.y);
  ctx.lineTo(top.x + 4, top.y + 10);
  ctx.stroke();
  ctx.fillStyle = lin(ctx, L0.x, L0.y, top.x, top.y, [
    [0, "#0e0e12"],
    [0.6, "#2a2a32"],
    [1, "#16161a"],
  ]);
  ctx.beginPath();
  ctx.moveTo(L0.x, L0.y);
  ctx.lineTo(L1.x, L1.y);
  ctx.lineTo(top.x, top.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(L1.x, L1.y);
  ctx.lineTo(top.x, top.y);
  ctx.stroke();
  glint(ctx, c.x - 14, c.y - 24, 7, 1, 0.25, 0.45);
}

export function neonBody(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 20, 8, 0.26);
  // A steel stand and a dark acrylic board on stand-offs.
  ctx.fillStyle = "#2b2f36";
  ellipse(ctx, c.x, c.y - 1, 12, 4.5);
  ctx.fill();
  ctx.fillStyle = steel(ctx, c.x - 2, c.x + 2);
  ctx.fillRect(c.x - 1.6, c.y - 44, 3.2, 43);
  ctx.fillStyle = "rgba(20,20,30,.82)";
  ctx.beginPath();
  ctx.roundRect(c.x - 25, c.y - 72, 50, 30, 5);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.18)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#9aa3ab";
  for (const [dx, dy] of [
    [-22, -69],
    [22, -69],
    [-22, -45],
    [22, -45],
  ])
    (ellipse(ctx, c.x + dx, c.y + dy, 1.2, 1.2), ctx.fill());
}
export function neonLive(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  const on = Math.sin(t * 11) > -0.92 ? 1 : 0.3;
  glow(ctx, c.x, c.y - 57, 36, "255,80,200", 0.3 * on);
  const tube = (col: string, w: number, path: () => void) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    path();
    ctx.stroke();
  };
  const frame = () => {
    ctx.beginPath();
    ctx.roundRect(c.x - 20, c.y - 68, 40, 22, 7);
  };
  const arc = () => {
    ctx.beginPath();
    ctx.moveTo(c.x - 11, c.y - 52);
    ctx.quadraticCurveTo(c.x, c.y - 64, c.x + 11, c.y - 52);
  };
  // Each tube: a soft wide glow, then the bright core.
  tube(`rgba(255,90,210,${0.35 * on})`, 5, frame);
  tube(`rgba(255,200,240,${on})`, 1.6, frame);
  tube(`rgba(90,230,255,${0.35 * on})`, 5, arc);
  tube(`rgba(220,250,255,${on})`, 1.6, arc);
  ctx.fillStyle = `rgba(255,236,140,${on})`;
  for (const dx of [-7, 0, 7]) {
    ellipse(ctx, c.x + dx, c.y - 50.5, 1.8, 1.8);
    ctx.fill();
  }
}

export function statueBody(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 28, 12, 0.32);
  // A two-tier stone plinth with a carved band.
  const stone = {
    top: "#c4bfb5",
    left: lin(ctx, 0, c.y - 16, 0, c.y, [
      [0, "#a8a296"],
      [1, "#8a847a"],
    ]),
    right: "#76716a",
  };
  isoBox(ctx, x - 0.34, y - 0.34, x + 0.34, y + 0.34, 0, 8, stone);
  isoBox(ctx, x - 0.28, y - 0.28, x + 0.28, y + 0.28, 8, 10, stone);
  onFront(ctx, x, y + 0.28, 8, () => {
    ctx.strokeStyle = "rgba(70,65,58,.55)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      ctx.moveTo(-12 + i * 4.6, -3);
      ctx.quadraticCurveTo(-10 + i * 4.6, -7, -12 + i * 4.6 + 2.3, -7);
    }
    ctx.stroke();
  });
  // A jade dragon coiled up into the air: scaled body, a spiny back.
  const jade = lin(ctx, c.x - 22, 0, c.x + 22, 0, [
    [0, "#145a3a"],
    [0.45, "#4cc58e"],
    [1, "#0f4a2f"],
  ]);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(c.x - 16, c.y - 18);
    ctx.bezierCurveTo(
      c.x - 30,
      c.y - 40,
      c.x + 10,
      c.y - 36,
      c.x - 4,
      c.y - 54,
    );
    ctx.bezierCurveTo(
      c.x - 14,
      c.y - 66,
      c.x + 8,
      c.y - 74,
      c.x + 10,
      c.y - 64,
    );
  };
  ctx.lineCap = "round";
  ctx.strokeStyle = "#0c3a24";
  ctx.lineWidth = 11;
  path();
  ctx.stroke();
  ctx.strokeStyle = jade;
  ctx.lineWidth = 8.5;
  path();
  ctx.stroke();
  // Scales: short dark marks along the body.
  ctx.setLineDash([1.6, 2.4]);
  ctx.strokeStyle = "rgba(8,50,30,.45)";
  ctx.lineWidth = 5;
  path();
  ctx.stroke();
  ctx.setLineDash([]);
  // Little gold spines along the back, every few steps of the curve.
  ctx.fillStyle = "#e0b83a";
  const spine: [number, number][] = [
    [-24, -30],
    [-16, -40],
    [-6, -46],
    [-10, -60],
    [-4, -68],
    [3, -71],
  ];
  for (const [dx, dy] of spine) {
    ctx.beginPath();
    ctx.moveTo(c.x + dx - 1.6, c.y + dy + 1);
    ctx.lineTo(c.x + dx - 2.6, c.y + dy - 3);
    ctx.lineTo(c.x + dx + 1.4, c.y + dy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(200,255,220,.35)";
  ctx.lineWidth = 2;
  path();
  ctx.stroke();
  // The head: snout, horns, whiskers.
  const hx = c.x + 11,
    hy = c.y - 67;
  ctx.fillStyle = jade;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 8, 6, -0.2, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hx + 7, hy + 1, 5, 3.2, 0.1, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#e0b83a";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(hx - 3, hy - 5);
  ctx.quadraticCurveTo(hx - 6, hy - 12, hx - 10, hy - 13);
  ctx.moveTo(hx + 1, hy - 5);
  ctx.quadraticCurveTo(hx, hy - 12, hx - 3, hy - 15);
  ctx.stroke();
  ctx.strokeStyle = "rgba(230,200,90,.8)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(hx + 10, hy + 2);
  ctx.quadraticCurveTo(hx + 16, hy + 4, hx + 17, hy + 10);
  ctx.moveTo(hx + 10, hy + 0.5);
  ctx.quadraticCurveTo(hx + 17, hy - 1, hx + 19, hy + 3);
  ctx.stroke();
  glint(ctx, hx - 2, hy - 2, 2.4, 1, 0.5);
}
export function statueLive(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  const tw = 0.5 + 0.5 * Math.sin(t * 2.5);
  ctx.fillStyle = `rgba(255,214,91,${0.6 + 0.4 * tw})`;
  ellipse(ctx, c.x + 13, c.y - 69, 1.6, 1.6);
  ctx.fill();
  // The pearl it chases.
  glow(ctx, c.x + 26, c.y - 76, 10, "255,250,220", 0.25 + 0.2 * tw);
  ctx.fillStyle = rad(ctx, c.x + 25, c.y - 77, 4, [
    [0, "#ffffff"],
    [1, "#d9d2c0"],
  ]);
  ellipse(ctx, c.x + 26, c.y - 76 + Math.sin(t * 1.5), 3.4, 3.4);
  ctx.fill();
}

export function cornerBody(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 34, 13, 0.28);
  // A tatami mat, two floor cushions and a low tea table.
  const mat = [
    iso(x - 0.46, y - 0.36),
    iso(x + 0.46, y - 0.36),
    iso(x + 0.46, y + 0.36),
    iso(x - 0.46, y + 0.36),
  ];
  ctx.fillStyle = "#c9c08a";
  poly(ctx, mat);
  ctx.fill();
  ctx.strokeStyle = "#3f6a3a";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  poly(ctx, mat);
  ctx.clip();
  ctx.strokeStyle = "rgba(120,110,60,.35)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let f = 0; f <= 1; f += 0.05) {
    const a = iso(x - 0.46 + 0.92 * f, y - 0.36),
      b = iso(x - 0.46 + 0.92 * f, y + 0.36);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  ctx.restore();
  for (const [dx, col] of [
    [-0.28, "#d8584a"],
    [0.28, "#4f9f8f"],
  ] as const) {
    const p = iso(x + dx, y + 0.1);
    ctx.fillStyle = shade(col, -0.3);
    ellipse(ctx, p.x, p.y - 2, 12, 5.5);
    ctx.fill();
    ctx.fillStyle = rad(ctx, p.x - 3, p.y - 6, 13, [
      [0, shade(col, 0.25)],
      [1, col],
    ]);
    ellipse(ctx, p.x, p.y - 4, 11.5, 5);
    ctx.fill();
    ctx.fillStyle = shade(col, -0.4);
    ellipse(ctx, p.x, p.y - 4, 1.1, 0.7);
    ctx.fill();
  }
  woodBox(ctx, x - 0.18, y - 0.16, x + 0.18, y + 0.16, 4, 9, "#6e3f22", 19);
  for (const [lx, ly] of [
    [-0.16, 0.14],
    [0.16, 0.14],
  ]) {
    const p = iso(x + lx, y + ly);
    ctx.fillStyle = "#4e2c18";
    ctx.fillRect(p.x - 1, p.y - 5, 2, 5);
  }
  // A clay teapot, two cups of tea, a plate of mochi.
  const top = c.y - 13;
  ctx.fillStyle = rad(ctx, c.x - 3, top - 10, 10, [
    [0, "#b8784a"],
    [1, "#6e3a1e"],
  ]);
  ellipse(ctx, c.x, top - 6, 7, 6);
  ctx.fill();
  ctx.fillStyle = "#5a2e16";
  ellipse(ctx, c.x, top - 11.5, 3.5, 1.4);
  ctx.fill();
  ellipse(ctx, c.x, top - 13, 1.2, 1);
  ctx.fill();
  ctx.strokeStyle = "#7a4424";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x + 6, top - 6);
  ctx.quadraticCurveTo(c.x + 11, top - 8, c.x + 12, top - 12);
  ctx.moveTo(c.x - 6, top - 9);
  ctx.quadraticCurveTo(c.x - 11, top - 7, c.x - 6, top - 3);
  ctx.stroke();
  glint(ctx, c.x - 3, top - 8, 1.6, 1, 0.45);
  for (const dx of [-11, 10]) {
    ctx.fillStyle = "#efe8da";
    ctx.beginPath();
    ctx.moveTo(c.x + dx - 2.6, top - 4);
    ctx.lineTo(c.x + dx + 2.6, top - 4);
    ctx.lineTo(c.x + dx + 2, top);
    ctx.lineTo(c.x + dx - 2, top);
    ctx.fill();
    ctx.fillStyle = "#8aa83a";
    ellipse(ctx, c.x + dx, top - 4, 2.4, 0.8);
    ctx.fill();
  }
  ctx.fillStyle = "#f6f2ea";
  ellipse(ctx, c.x + 3, top + 2.5, 5, 1.8);
  ctx.fill();
  for (const [dx, col] of [
    [1.5, "#ffd0de"],
    [4.5, "#e8f2d0"],
  ] as const) {
    ctx.fillStyle = col;
    ellipse(ctx, c.x + dx, top + 1.5, 1.8, 1.3);
    ctx.fill();
  }
}
export function cornerLive(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  const top = c.y - 13;
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 2; i++) {
    const k = (t * 0.6 + i * 0.5) % 1;
    ctx.globalAlpha = 1 - k;
    ctx.beginPath();
    ctx.moveTo(c.x + 12, top - 13 - k * 14);
    ctx.quadraticCurveTo(
      c.x + 16,
      top - 18 - k * 14,
      c.x + 12,
      top - 24 - k * 14,
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function pumpkinBody(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 24, 10, 0.3);
  // Ribbed lobes, the back ones darker; a curled stem.
  const lobes: [number, number, number][] = [
    [-11, 9, 0.25],
    [11, 9, 0.25],
    [-6, 11, 0.1],
    [6, 11, 0.1],
    [0, 12, 0],
  ];
  for (const [dx, r, dark] of lobes) {
    ctx.fillStyle = rad(ctx, c.x + dx - r * 0.3, c.y - 20, r * 1.6, [
      [0, shade("#ffb04a", -dark)],
      [0.7, shade("#e8701e", -dark)],
      [1, shade("#a8480e", -dark)],
    ]);
    ellipse(ctx, c.x + dx, c.y - 15, r, 15);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(120,50,10,.35)";
  ctx.lineWidth = 1;
  for (const dx of [-8, -3, 3, 8]) {
    ctx.beginPath();
    ctx.moveTo(c.x + dx * 0.6, c.y - 29);
    ctx.quadraticCurveTo(c.x + dx * 1.3, c.y - 15, c.x + dx * 0.6, c.y - 1);
    ctx.stroke();
  }
  ctx.strokeStyle = "#4a6a24";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 28);
  ctx.quadraticCurveTo(c.x + 1, c.y - 35, c.x + 5, c.y - 37);
  ctx.stroke();
  ctx.strokeStyle = "#5f8a2a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(c.x + 8, c.y - 34, 3, Math.PI, Math.PI * 2.4);
  ctx.stroke();
  glint(ctx, c.x - 6, c.y - 24, 2.5, 4, 0.3, 0.3);
  // The carved face: dark cut-outs (the candle lights them, live).
  ctx.fillStyle = "#3a1806";
  pumpkinFace(ctx, c.x, c.y);
  ctx.fill();
}
function pumpkinFace(ctx: Ctx, cx: number, cy: number) {
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(cx + s * 8, cy - 19);
    ctx.lineTo(cx + s * 4, cy - 24);
    ctx.lineTo(cx + s * 2, cy - 18.5);
    ctx.closePath();
  }
  ctx.moveTo(cx - 1.2, cy - 15);
  ctx.lineTo(cx + 1.2, cy - 15);
  ctx.lineTo(cx, cy - 17);
  ctx.closePath();
  ctx.moveTo(cx - 8, cy - 12);
  ctx.quadraticCurveTo(cx, cy - 4, cx + 8, cy - 12);
  ctx.lineTo(cx + 5, cy - 10.5);
  ctx.lineTo(cx + 3.5, cy - 12);
  ctx.lineTo(cx + 1, cy - 10);
  ctx.lineTo(cx - 1.5, cy - 12);
  ctx.lineTo(cx - 4, cy - 10);
  ctx.closePath();
}
export function pumpkinLive(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  const flick = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.7);
  glow(ctx, c.x, c.y - 15, 26, "255,170,60", 0.18 * flick);
  ctx.fillStyle = `rgba(255,${190 + 50 * flick},90,${0.85 * flick})`;
  pumpkinFace(ctx, c.x, c.y);
  ctx.fill();
}

export function lanternStandBody(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 18, 7, 0.3);
  // A lacquered post with a cross foot and a carved bracket.
  const wood = lin(ctx, c.x - 2.5, 0, c.x + 2.5, 0, [
    [0, "#3a1e10"],
    [0.45, "#7a3e22"],
    [1, "#2e160a"],
  ]);
  ctx.fillStyle = "#4a2614";
  ctx.beginPath();
  ctx.moveTo(c.x - 11, c.y - 1);
  ctx.lineTo(c.x + 11, c.y - 1);
  ctx.lineTo(c.x + 9, c.y - 5);
  ctx.lineTo(c.x - 9, c.y - 5);
  ctx.fill();
  ctx.fillStyle = wood;
  ctx.fillRect(c.x - 2.2, c.y - 74, 4.4, 70);
  ctx.fillRect(c.x - 2, c.y - 75, 18, 3.2);
  ctx.strokeStyle = "#5a2e18";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(c.x + 1, c.y - 64);
  ctx.quadraticCurveTo(c.x + 4, c.y - 71, c.x + 12, c.y - 72);
  ctx.stroke();
  ctx.fillStyle = "#e0b83a";
  ctx.fillRect(c.x - 2.4, c.y - 76, 4.8, 1.6);
  ctx.fillRect(c.x + 15, c.y - 75.5, 2, 4);
}
export function lanternStandLive(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  const sw = Math.sin(t * 1.6) * 2;
  ctx.strokeStyle = "#3a1e10";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(c.x + 12, c.y - 72);
  ctx.lineTo(c.x + 12 + sw, c.y - 66);
  ctx.stroke();
  paperLantern(ctx, c.x + 12 + sw, c.y - 52, 11, "#c8161a", t, sw);
}

export function blossomBody(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 22, 9, 0.28);
  // A round glazed pot with a painted rim.
  ctx.fillStyle = lin(ctx, c.x - 14, 0, c.x + 14, 0, [
    [0, "#1c4a7a"],
    [0.35, "#4f8fc8"],
    [1, "#163a62"],
  ]);
  ctx.beginPath();
  ctx.moveTo(c.x - 13, c.y - 18);
  ctx.quadraticCurveTo(c.x - 15, c.y - 4, c.x - 8, c.y);
  ctx.lineTo(c.x + 8, c.y);
  ctx.quadraticCurveTo(c.x + 15, c.y - 4, c.x + 13, c.y - 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#e8d48a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 12, 13.6, 4, 0, 0.1, Math.PI - 0.1);
  ctx.stroke();
  ctx.fillStyle = "#5f9fd8";
  ellipse(ctx, c.x, c.y - 18, 13, 4);
  ctx.fill();
  ctx.fillStyle = "#3a2a1c";
  ellipse(ctx, c.x, c.y - 18, 10.5, 2.8);
  ctx.fill();
  glint(ctx, c.x - 8, c.y - 10, 1.4, 4, 0.4, 0.2);
  // Dark, crooked plum branches.
  ctx.lineCap = "round";
  const branch = (w: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 18);
    ctx.quadraticCurveTo(c.x - 9, c.y - 36, c.x - 4, c.y - 58);
    ctx.moveTo(c.x - 4, c.y - 34);
    ctx.quadraticCurveTo(c.x + 8, c.y - 40, c.x + 13, c.y - 55);
    ctx.moveTo(c.x - 6, c.y - 46);
    ctx.lineTo(c.x - 14, c.y - 52);
    ctx.stroke();
  };
  branch(3.4, "#2e1a10");
  branch(1.4, "#6a4430");
  // Blossoms: five round petals, a gold heart; buds.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + i;
    const r = 5 + ((i * 7) % 11);
    const px = c.x + Math.cos(a) * r + (i % 2 ? 5 : -3),
      py = c.y - 50 + Math.sin(a) * r * 0.7;
    if (i % 4 === 3) {
      ctx.fillStyle = "#e8507a";
      ellipse(ctx, px, py, 1.4, 1.6);
      ctx.fill();
      continue;
    }
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * TAU + i;
      ctx.fillStyle = p % 2 ? "#ff9ab8" : "#ffc4d6";
      ellipse(ctx, px + Math.cos(pa) * 1.8, py + Math.sin(pa) * 1.5, 1.6, 1.4);
      ctx.fill();
    }
    ctx.fillStyle = "#f2c14e";
    ellipse(ctx, px, py, 0.8, 0.8);
    ctx.fill();
  }
}
export function blossomLive(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  // A petal or two drifting down.
  for (let i = 0; i < 2; i++) {
    const f = (t * 0.15 + i * 0.5) % 1;
    ctx.fillStyle = `rgba(255,190,210,${Math.min(1, (1 - f) * 3) * 0.9})`;
    ctx.beginPath();
    ctx.ellipse(
      c.x - 6 + i * 12 + Math.sin(t * 2 + i) * 4,
      c.y - 48 + f * 46,
      1.8,
      1.1,
      t * 2 + i,
      0,
      TAU,
    );
    ctx.fill();
  }
}
