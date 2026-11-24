/**
 * The Lantern Yard's pieces (Gloomshade's arena): stone-and-bronze lantern
 * posts lit and out, their light pools with an exact edge, the snuff's
 * creeping shade, hit pips and the "hit me" ring, relight sparks, Ball
 * Lightning's patch, and the night closing in from the hedges.
 *
 * Every drawer is pure, (ctx, k): one unit is one world pixel with the
 * origin at the piece's anchor, k is texture pixels per world pixel (for
 * hairlines). They are painted once per look into an atlas
 * (raid-piece-stage.ts); the yard places them each frame. Small pure layout
 * helpers (where and how bright each piece goes) follow at the end.
 */
import type { Ctx, PieceDef } from "./raid-piece-stage";

const TAU = Math.PI * 2;
type Rng = () => number;
function rng(s: number): Rng {
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const NIGHT_RGB = "7,9,20";

// ─────────────── small material helpers ───────────────
function chipRect(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  R: Rng,
  ch: number,
) {
  const a = () => 0.5 + R() * ch;
  const t1 = a(),
    t2 = a(),
    t3 = a(),
    t4 = a();
  c.beginPath();
  c.moveTo(x + t1, y);
  c.lineTo(x + w * (0.3 + R() * 0.3), y + R() * 0.5);
  c.lineTo(x + w - t2, y);
  c.lineTo(x + w, y + t2 * 0.8);
  c.lineTo(x + w - R() * 0.4, y + h * 0.5);
  c.lineTo(x + w, y + h - t3);
  c.lineTo(x + w - t3 * 0.8, y + h);
  c.lineTo(x + w * (0.4 + R() * 0.3), y + h - R() * 0.5);
  c.lineTo(x + t4, y + h);
  c.lineTo(x, y + h - t4 * 0.7);
  c.lineTo(x, y + t1 * 0.8);
  c.closePath();
}
function speckle(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  R: Rng,
  n: number,
  light: string,
  dark: string,
) {
  for (let i = 0; i < n; i++) {
    c.fillStyle = R() < 0.5 ? light : dark;
    c.beginPath();
    c.arc(x + R() * w, y + R() * h, 0.2 + R() * 0.8, 0, TAU);
    c.fill();
  }
}
function crack(
  c: Ctx,
  k: number,
  x: number,
  y: number,
  len: number,
  ang: number,
  R: Rng,
) {
  const pts: [number, number][] = [[x, y]];
  let px = x,
    py = y;
  for (let i = 0; i < 4; i++) {
    ang += (R() - 0.5) * 1.2;
    px += (Math.cos(ang) * len) / 4;
    py += (Math.sin(ang) * len) / 4;
    pts.push([px, py]);
  }
  const line = (dx: number, dy: number, col: string, w: number) => {
    c.beginPath();
    pts.forEach(([a, b], i) =>
      i ? c.lineTo(a + dx, b + dy) : c.moveTo(a + dx, b + dy),
    );
    c.strokeStyle = col;
    c.lineWidth = w;
    c.stroke();
  };
  line(0.35, 0.45, "rgba(205,195,245,.28)", Math.max(0.45, 0.8 / k));
  line(0, 0, "rgba(16,10,30,.85)", Math.max(0.5, 0.9 / k));
}
function moss(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  R: Rng,
  n: number,
) {
  const cols = ["#3f5a48", "#56704f", "#2e4338", "#6c7f55"];
  for (let i = 0; i < n; i++) {
    c.fillStyle = cols[(R() * cols.length) | 0];
    c.globalAlpha = 0.35 + R() * 0.4;
    c.beginPath();
    c.arc(x + R() * w, y + R() * h, 0.3 + R() * 0.9, 0, TAU);
    c.fill();
  }
  c.globalAlpha = 1;
}
function bronze(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#f0d08a");
  g.addColorStop(0.4, "#b08442");
  g.addColorStop(1, "#4e3418");
  c.fillStyle = g;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
  c.strokeStyle = "rgba(30,18,8,.7)";
  c.lineWidth = 0.6;
  c.stroke();
  c.strokeStyle = "rgba(255,244,210,.65)";
  c.lineWidth = 0.5;
  c.beginPath();
  c.moveTo(x + r, y + 0.5);
  c.lineTo(x + w - r, y + 0.5);
  c.stroke();
}
function warmOver(c: Ctx, cx: number, cy: number, r: number, a: number) {
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(255,186,96,${a})`);
  g.addColorStop(1, "rgba(255,160,80,0)");
  c.fillStyle = g;
  c.fillRect(cx - r, cy - r, r * 2, r * 2);
}
function radial(c: Ctx, r: number, stops: [number, string][]) {
  const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.fill();
}

/** A carved stone block from above and in front: lit top, shaded front, chips, cracks, moss. */
function stoneBlock(
  c: Ctx,
  k: number,
  x: number,
  y: number,
  w: number,
  topH: number,
  frontH: number,
  seed: number,
  lit: boolean,
) {
  const R = rng(seed);
  chipRect(c, x, y + topH, w, frontH, R, 1.6);
  let g = c.createLinearGradient(0, y + topH, 0, y + topH + frontH);
  g.addColorStop(0, "#564d7e");
  g.addColorStop(1, "#272140");
  c.fillStyle = g;
  c.fill();
  c.save();
  c.clip();
  g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, "rgba(190,180,240,.12)");
  g.addColorStop(0.5, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(8,6,20,.4)");
  c.fillStyle = g;
  c.fillRect(x, y + topH, w, frontH);
  speckle(
    c,
    x,
    y + topH,
    w,
    frontH,
    R,
    w * 3,
    "rgba(215,205,255,.14)",
    "rgba(10,6,24,.25)",
  );
  if (lit) {
    g = c.createLinearGradient(0, y + topH, 0, y + topH + frontH);
    g.addColorStop(0, "rgba(255,170,80,.28)");
    g.addColorStop(1, "rgba(255,170,80,0)");
    c.fillStyle = g;
    c.fillRect(x, y + topH, w, frontH);
  }
  moss(c, x, y + topH + frontH - 2.6, w * 0.45, 2.4, R, w * 0.7);
  moss(c, x + w * 0.7, y + topH + frontH - 2, w * 0.3, 2, R, w * 0.3);
  c.restore();
  crack(
    c,
    k,
    x + w * (0.55 + R() * 0.2),
    y + topH + 0.6,
    frontH * 0.8,
    1.6 + R() * 0.4,
    R,
  );
  chipRect(c, x, y, w, topH + 0.6, R, 1.1);
  g = c.createLinearGradient(x, y, x + w, y + topH);
  g.addColorStop(0, "#9a8fc6");
  g.addColorStop(1, "#5f5789");
  c.fillStyle = g;
  c.fill();
  c.save();
  c.clip();
  speckle(
    c,
    x,
    y,
    w,
    topH,
    R,
    w * 2,
    "rgba(235,228,255,.18)",
    "rgba(20,14,40,.22)",
  );
  if (lit) warmOver(c, x + w / 2, y + topH / 2, w * 0.6, 0.7);
  c.restore();
  c.strokeStyle = lit ? "rgba(255,226,180,.7)" : "rgba(225,215,255,.55)";
  c.lineWidth = Math.max(0.5, 0.8 / k);
  c.beginPath();
  c.moveTo(x + 1.2, y + topH + 0.2);
  c.lineTo(x + w - 1.2, y + topH + 0.2);
  c.stroke();
  moss(c, x + 0.5, y + 0.5, 4, topH * 0.7, R, 7);
}

// ─────────────── the lantern post: lit and out ───────────────
export function drawPost(c: Ctx, k: number, lit: boolean) {
  stoneBlock(c, k, -21, 15, 42, 7, 11, 11, lit);
  stoneBlock(c, k, -13.5, 7.5, 27, 4.5, 6, 23, lit);
  // Iron pole with a bronze collar.
  const px = -3.6,
    pw = 7.2,
    py0 = -24,
    py1 = 9;
  let g = c.createLinearGradient(px, 0, px + pw, 0);
  g.addColorStop(0, "#5e5a86");
  g.addColorStop(0.3, "#2e2a45");
  g.addColorStop(0.75, "#15121f");
  g.addColorStop(1, "#3a3456");
  c.fillStyle = g;
  c.fillRect(px, py0, pw, py1 - py0);
  c.strokeStyle = "rgba(10,8,18,.6)";
  c.lineWidth = 0.5;
  for (const fx of [-1.2, 1.4]) {
    c.beginPath();
    c.moveTo(fx, py0 + 2);
    c.lineTo(fx, py1 - 3);
    c.stroke();
  }
  if (lit) {
    g = c.createLinearGradient(0, py0, 0, py0 + 16);
    g.addColorStop(0, "rgba(255,176,86,.55)");
    g.addColorStop(1, "rgba(255,176,86,0)");
    c.fillStyle = g;
    c.fillRect(px, py0, pw, 16);
  }
  bronze(c, -6.2, 5, 12.4, 4, 1.2);
  bronze(c, -5, -9.5, 10, 2.6, 1);
  // Scroll brackets under the lamp.
  c.lineCap = "round";
  for (const s of [-1, 1]) {
    c.strokeStyle = "#17141f";
    c.lineWidth = 1.7;
    c.beginPath();
    c.moveTo(s * 3, -13);
    c.bezierCurveTo(s * 10, -14, s * 13, -19, s * 11, -24.5);
    c.stroke();
    c.beginPath();
    c.arc(s * 9.6, -15.6, 1.8, 0, TAU);
    c.stroke();
    c.strokeStyle = lit ? "rgba(255,190,110,.6)" : "rgba(170,165,215,.35)";
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(s * 3, -13.8);
    c.bezierCurveTo(s * 9.6, -14.8, s * 12.2, -19, s * 10.6, -24);
    c.stroke();
  }
  // Tray and drip finial.
  c.fillStyle = "#1a1725";
  c.beginPath();
  c.moveTo(-4, -22);
  c.lineTo(4, -22);
  c.lineTo(0, -17.5);
  c.closePath();
  c.fill();
  bronze(c, -14.5, -26, 29, 4, 1.4);
  // Glass body: three panes of a six-sided lantern.
  const glass = () => {
    c.beginPath();
    c.moveTo(-12, -25.5);
    c.lineTo(12, -25.5);
    c.lineTo(15, -51);
    c.lineTo(-15, -51);
    c.closePath();
  };
  glass();
  let fill: CanvasGradient;
  if (lit) {
    fill = c.createRadialGradient(0, -34, 0, 0, -37, 19);
    fill.addColorStop(0, "#fffbe8");
    fill.addColorStop(0.3, "#ffe49c");
    fill.addColorStop(0.7, "#ffb44c");
    fill.addColorStop(1, "#d8701f");
  } else {
    fill = c.createLinearGradient(-15, -51, 12, -25);
    fill.addColorStop(0, "#545a8e");
    fill.addColorStop(0.45, "#2a2b4a");
    fill.addColorStop(1, "#141429");
  }
  c.fillStyle = fill;
  c.fill();
  c.save();
  c.clip();
  if (lit) {
    c.fillStyle = "rgba(255,255,240,.45)";
    c.beginPath();
    c.moveTo(-11.5, -49);
    c.lineTo(-9, -49);
    c.lineTo(-7.6, -28);
    c.lineTo(-9.4, -28);
    c.closePath();
    c.fill();
  } else {
    // Moonlight glint on the cold glass, soot at the top, a dead wick.
    c.fillStyle = "rgba(200,210,255,.38)";
    c.beginPath();
    c.moveTo(-13, -50);
    c.lineTo(-9.5, -50);
    c.lineTo(-12.6, -36);
    c.lineTo(-13.6, -38);
    c.closePath();
    c.fill();
    c.fillStyle = "rgba(200,210,255,.18)";
    c.fillRect(9, -48, 1.2, 14);
    g = c.createRadialGradient(0, -52, 0, 0, -52, 14);
    g.addColorStop(0, "rgba(0,0,0,.55)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(-16, -52, 32, 16);
    c.strokeStyle = "#0b0a12";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, -26);
    c.lineTo(0, -31);
    c.stroke();
    c.fillStyle = "#2a2232";
    c.beginPath();
    c.arc(0, -31.5, 0.9, 0, TAU);
    c.fill();
  }
  c.restore();
  // Iron frame and pane dividers.
  c.lineJoin = "round";
  c.strokeStyle = "#16131f";
  c.lineWidth = 2;
  glass();
  c.stroke();
  c.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(s * 5.6, -25.5);
    c.lineTo(s * 7, -51);
    c.stroke();
  }
  if (lit) {
    c.strokeStyle = "rgba(255,206,130,.55)";
    c.lineWidth = 0.45;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * 5.6 - 0.9, -26);
      c.lineTo(s * 7 - 0.9, -50.5);
      c.stroke();
    }
  } else {
    c.strokeStyle = "rgba(190,200,255,.55)";
    c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(-15.6, -50);
    c.lineTo(-12.6, -26.5);
    c.stroke();
  }
  c.fillStyle = "#d7b066";
  for (const [rx, ry] of [
    [-14.6, -50],
    [14.6, -50],
    [-11.8, -27],
    [11.8, -27],
  ]) {
    c.beginPath();
    c.arc(rx, ry, 0.9, 0, TAU);
    c.fill();
  }
  // Crown band and roof.
  bronze(c, -17.5, -55.5, 35, 4.5, 1.4);
  c.beginPath();
  c.moveTo(-20, -55);
  c.quadraticCurveTo(-11, -57, -8, -62.5);
  c.lineTo(-2.6, -68.5);
  c.lineTo(2.6, -68.5);
  c.lineTo(8, -62.5);
  c.quadraticCurveTo(11, -57, 20, -55);
  c.closePath();
  g = c.createLinearGradient(-20, -68, 20, -55);
  g.addColorStop(0, "#5a5482");
  g.addColorStop(0.45, "#2b2741");
  g.addColorStop(1, "#14111d");
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = "#0e0c15";
  c.lineWidth = 0.8;
  c.stroke();
  c.strokeStyle = "rgba(200,195,250,.4)";
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(-1.5, -68);
  c.lineTo(-6.5, -56.5);
  c.stroke();
  c.strokeStyle = lit ? "rgba(255,196,110,.85)" : "rgba(215,176,102,.6)";
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(-19.5, -55.2);
  c.lineTo(19.5, -55.2);
  c.stroke();
  // Finial ring.
  c.strokeStyle = "#c9a25a";
  c.lineWidth = 1.3;
  c.beginPath();
  c.arc(0, -72.4, 2.6, 0, TAU);
  c.stroke();
  c.fillStyle = "#e3c27a";
  c.beginPath();
  c.arc(0, -69.4, 1.3, 0, TAU);
  c.fill();
}

export function drawContact(c: Ctx) {
  c.save();
  c.scale(1, 0.34);
  radial(c, 32, [
    [0, "rgba(5,6,16,.75)"],
    [0.6, "rgba(5,6,16,.45)"],
    [1, "rgba(5,6,16,0)"],
  ]);
  c.restore();
}
/** Moonlight from the upper left lays a long, soft post shadow on the stones. */
export function drawMoonShadow(c: Ctx) {
  c.save();
  c.rotate(0.38);
  const g = c.createLinearGradient(0, 0, 92, 0);
  g.addColorStop(0, "rgba(6,6,18,.5)");
  g.addColorStop(1, "rgba(6,6,18,0)");
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(36, 0, 46, 6.5, 0, 0, TAU);
  c.fill();
  const h = c.createRadialGradient(76, 0, 0, 76, 0, 15);
  h.addColorStop(0, "rgba(6,6,18,.3)");
  h.addColorStop(1, "rgba(6,6,18,0)");
  c.fillStyle = h;
  c.beginPath();
  c.ellipse(76, 0, 16, 10, 0, 0, TAU);
  c.fill();
  c.restore();
}
export function drawFlame(c: Ctx) {
  const tear = (s: number) => {
    c.beginPath();
    c.moveTo(0, -15 * s);
    c.bezierCurveTo(3.8 * s, -9 * s, 5.2 * s, -4 * s, 4.2 * s, -1.2 * s);
    c.quadraticCurveTo(0, 2.6 * s, -4.2 * s, -1.2 * s);
    c.bezierCurveTo(-5.2 * s, -4 * s, -3.8 * s, -9 * s, 0, -15 * s);
    c.closePath();
  };
  tear(1);
  let g = c.createRadialGradient(0, -3, 0, 0, -5, 11);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.25, "#fff0a8");
  g.addColorStop(0.6, "#ffad3a");
  g.addColorStop(1, "#ff5a14");
  c.fillStyle = g;
  c.fill();
  tear(0.5);
  g = c.createLinearGradient(0, 1, 0, -7);
  g.addColorStop(0, "#bfe0ff");
  g.addColorStop(0.5, "#ffffff");
  g.addColorStop(1, "#fff6d0");
  c.fillStyle = g;
  c.fill();
}
export function drawHalo(c: Ctx) {
  radial(c, 46, [
    [0, "rgba(255,220,150,.75)"],
    [0.28, "rgba(255,176,86,.36)"],
    [0.62, "rgba(255,140,60,.1)"],
    [1, "rgba(255,140,60,0)"],
  ]);
}
/**
 * Lantern light on the floor, out to the exact reach R. Faint shadows of the
 * four cage bars and leaf dapple break it up like the painting's own light.
 */
export function drawPool(c: Ctx, k: number, R: number) {
  radial(c, R, [
    [0, "rgba(255,204,118,.62)"],
    [0.16, "rgba(255,188,100,.42)"],
    [0.45, "rgba(255,170,90,.21)"],
    [0.8, "rgba(255,160,85,.11)"],
    [0.975, "rgba(255,160,85,.085)"],
    [1, "rgba(255,160,85,0)"],
  ]);
  c.globalCompositeOperation = "destination-out";
  const g = c.createRadialGradient(0, 0, 18, 0, 0, R);
  g.addColorStop(0, "rgba(0,0,0,.4)");
  g.addColorStop(1, "rgba(0,0,0,.14)");
  c.fillStyle = g;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    c.beginPath();
    c.moveTo(Math.cos(a - 0.16) * 18, Math.sin(a - 0.16) * 18);
    c.lineTo(Math.cos(a - 0.05) * R, Math.sin(a - 0.05) * R);
    c.lineTo(Math.cos(a + 0.05) * R, Math.sin(a + 0.05) * R);
    c.lineTo(Math.cos(a + 0.16) * 18, Math.sin(a + 0.16) * 18);
    c.closePath();
    c.fill();
  }
  const Rn = rng(R * 7 + 3);
  for (let i = 0; i < 46; i++) {
    const a = Rn() * TAU,
      d = R * (0.35 + Rn() * 0.6),
      r = 5 + Rn() * 12;
    const x = Math.cos(a) * d,
      y = Math.sin(a) * d;
    const h = c.createRadialGradient(x, y, 0, x, y, r);
    h.addColorStop(0, "rgba(0,0,0,.2)");
    h.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = h;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  }
  c.globalCompositeOperation = "source-over";
}
/** The exact edge of a light: a thin line at R on a hairline of shade. */
export function drawRim(
  c: Ctx,
  R: number,
  rgb: string,
  a: number,
  glow: number,
) {
  c.beginPath();
  c.arc(0, 0, R, 0, TAU);
  c.arc(0, 0, R - 12, 0, TAU, true);
  const g = c.createRadialGradient(0, 0, R - 12, 0, 0, R);
  g.addColorStop(0, `rgba(${rgb},0)`);
  g.addColorStop(1, `rgba(${rgb},${glow})`);
  c.fillStyle = g;
  c.fill();
  c.lineWidth = 2.6;
  c.strokeStyle = "rgba(12,8,26,.32)";
  c.beginPath();
  c.arc(0, 0, R + 1.7, 0, TAU);
  c.stroke();
  c.lineWidth = 2;
  c.strokeStyle = `rgba(${rgb},${a})`;
  c.beginPath();
  c.arc(0, 0, R, 0, TAU);
  c.stroke();
}
export function drawDarkPool(c: Ctx, R: number) {
  radial(c, R, [
    [0, `rgba(${NIGHT_RGB},.55)`],
    [0.5, `rgba(${NIGHT_RGB},.42)`],
    [0.8, `rgba(${NIGHT_RGB},.18)`],
    [1, `rgba(${NIGHT_RGB},0)`],
  ]);
}
export function drawSmoke(c: Ctx) {
  const R = rng(5);
  for (let i = 0; i < 5; i++) {
    const x = (R() - 0.5) * 7,
      y = (R() - 0.5) * 7,
      r = 4 + R() * 4;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(180,172,215,.75)");
    g.addColorStop(1, "rgba(150,140,190,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  }
}
/** The dark plate behind the hit pips. */
export function drawPlate(c: Ctx) {
  c.beginPath();
  c.roundRect(-16.5, -8, 33, 16, 8);
  const g = c.createLinearGradient(0, -8, 0, 8);
  g.addColorStop(0, "#2a2840");
  g.addColorStop(1, "#0d0c18");
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = "rgba(215,176,102,.75)";
  c.lineWidth = 0.9;
  c.stroke();
}
/**
 * A hit pip: a glowing moon-gold stone when struck, an empty socket when
 * not. Both keep the game's moon-yellow ring at radius 5.
 */
export function drawPip(c: Ctx, on: boolean) {
  if (on) {
    radial(c, 9, [
      [0, "rgba(255,214,91,.5)"],
      [1, "rgba(255,214,91,0)"],
    ]);
    const g = c.createRadialGradient(-1.4, -1.6, 0, 0, 0, 5);
    g.addColorStop(0, "#fffbe0");
    g.addColorStop(0.45, "#ffd65b");
    g.addColorStop(1, "#c4851c");
    c.fillStyle = g;
  } else {
    const g = c.createRadialGradient(0, 1.2, 0, 0, 0, 5);
    g.addColorStop(0, "#14284a");
    g.addColorStop(1, "#060d1a");
    c.fillStyle = g;
  }
  c.beginPath();
  c.arc(0, 0, 5, 0, TAU);
  c.fill();
  c.strokeStyle = "#ffd65b";
  c.lineWidth = 2;
  c.stroke();
  if (on) {
    c.fillStyle = "rgba(255,255,255,.85)";
    c.beginPath();
    c.arc(-1.6, -1.8, 1.1, 0, TAU);
    c.fill();
  }
}
/** The "hit me" ring, radius 35 (scaled to the game's 22 → 48 sweep). */
export function drawHitRing(c: Ctx) {
  c.lineWidth = 7;
  c.strokeStyle = "rgba(255,214,91,.22)";
  c.beginPath();
  c.arc(0, 0, HIT_RING_RADIUS, 0, TAU);
  c.stroke();
  c.lineWidth = 3;
  c.strokeStyle = "#ffd65b";
  c.stroke();
  c.lineWidth = 1;
  c.strokeStyle = "rgba(255,250,220,.8)";
  c.stroke();
}
/** Snuff: shadow fingers crawl in from the light's edge R. Frame p in [0, 1]. */
export function drawSnuffShade(c: Ctx, R: number, p: number) {
  const left = R * (1 - p);
  const col = "24,18,43";
  c.beginPath();
  c.arc(0, 0, R, 0, TAU);
  if (left > 1) c.arc(0, 0, Math.max(0, left - 10), 0, TAU, true);
  const g = c.createRadialGradient(0, 0, Math.max(0, left - 10), 0, 0, R);
  g.addColorStop(0, `rgba(${col},0)`);
  g.addColorStop(
    Math.min(0.99, 16 / Math.max(16, R - left + 10)),
    `rgba(${col},.55)`,
  );
  g.addColorStop(1, `rgba(${col},.62)`);
  c.fillStyle = g;
  c.fill("evenodd");
  const Rn = rng(91);
  c.fillStyle = `rgba(${col},.55)`;
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU + Rn() * 0.15,
      len = 12 + Rn() * 26,
      w = 0.035 + Rn() * 0.04;
    const r0 = Math.max(left - 2, 0),
      r1 = Math.max(0, left - len);
    c.beginPath();
    c.moveTo(Math.cos(a - w) * r0, Math.sin(a - w) * r0);
    c.quadraticCurveTo(
      (Math.cos(a + 0.05) * (r0 + r1)) / 2,
      (Math.sin(a + 0.05) * (r0 + r1)) / 2,
      Math.cos(a) * r1,
      Math.sin(a) * r1,
    );
    c.lineTo(Math.cos(a + w) * r0, Math.sin(a + w) * r0);
    c.closePath();
    c.fill();
  }
}
/** The snuff's red edge, exactly at the light's reach R. */
export function drawSnuffEdge(c: Ctx, R: number) {
  c.lineWidth = 9;
  c.strokeStyle = "rgba(255,64,89,.22)";
  c.beginPath();
  c.arc(0, 0, R, 0, TAU);
  c.stroke();
  c.lineWidth = 3;
  c.strokeStyle = "rgba(255,140,153,.95)";
  c.stroke();
}
export function drawSpark(c: Ctx, rgb: string) {
  radial(c, 7, [
    [0, `rgba(${rgb},.8)`],
    [1, `rgba(${rgb},0)`],
  ]);
  c.fillStyle = "rgba(255,255,255,.95)";
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      r = i % 2 ? 1.2 : 5.5;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
}
export function drawFlash(c: Ctx) {
  radial(c, 64, [
    [0, "rgba(255,240,190,.9)"],
    [0.3, "rgba(255,196,96,.45)"],
    [1, "rgba(255,160,70,0)"],
  ]);
}
/** Ball Lightning: cool white light on the stones out to R. */
export function drawBallPool(c: Ctx, R: number) {
  radial(c, R, [
    [0, "rgba(235,246,255,.5)"],
    [0.12, "rgba(200,228,255,.34)"],
    [0.5, "rgba(170,210,255,.16)"],
    [0.96, "rgba(160,200,255,.085)"],
    [1, "rgba(160,200,255,0)"],
  ]);
}
/** Its exact blue edge at R, with small crackles inside it. */
export function drawBallRim(c: Ctx, R: number) {
  drawRim(c, R, "191,228,255", 0.8, 0.22);
  const Rn = rng(17);
  c.lineCap = "round";
  for (let i = 0; i < 9; i++) {
    const a0 = (i / 9) * TAU + Rn() * 0.3;
    c.beginPath();
    for (let j = 0; j <= 5; j++) {
      const a = a0 + j * 0.045,
        r = R - 4 - Rn() * 9;
      if (j) c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.strokeStyle = "rgba(220,240,255,.55)";
    c.lineWidth = 1.1;
    c.stroke();
  }
}
export function drawBallCore(c: Ctx) {
  radial(c, 28, [
    [0, "rgba(255,255,255,1)"],
    [0.22, "rgba(225,242,255,.9)"],
    [0.45, "rgba(150,205,255,.4)"],
    [1, "rgba(120,180,255,0)"],
  ]);
}
export function drawBolt(c: Ctx) {
  const pts = [
    [0, 0],
    [5, -1.6],
    [8, 1.4],
    [12, -1.2],
    [15, 0.8],
    [19, 0],
  ];
  const line = (col: string, w: number) => {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.strokeStyle = col;
    c.lineWidth = w;
    c.lineJoin = "round";
    c.lineCap = "round";
    c.stroke();
  };
  line("rgba(255,243,160,.3)", 5);
  line("rgba(255,243,160,.95)", 2);
  line("rgba(255,255,255,.9)", 0.8);
}
/** The night: edge strips that darken toward the hedges, with cool mist. */
export function drawVignette(c: Ctx) {
  const B = NIGHT_BAND,
    W = 1600,
    H = 900;
  const strip = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
  ) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(${NIGHT_RGB},.56)`);
    g.addColorStop(0.25, `rgba(${NIGHT_RGB},.36)`);
    g.addColorStop(0.62, `rgba(${NIGHT_RGB},.13)`);
    g.addColorStop(1, `rgba(${NIGHT_RGB},0)`);
    c.fillStyle = g;
    c.fillRect(rx, ry, rw, rh);
  };
  strip(0, 0, 0, B, 0, 0, W, B);
  strip(0, H, 0, H - B, 0, H - B, W, B);
  strip(0, 0, B, 0, 0, 0, B, H);
  strip(W, 0, W - B, 0, W - B, 0, B, H);
  const R = rng(7);
  for (let i = 0; i < 70; i++) {
    const side = i % 4,
      along = R(),
      inset = R() * 110,
      r = 40 + R() * 70;
    const x = side < 2 ? along * W : side === 2 ? inset : W - inset;
    const y = side === 0 ? inset : side === 1 ? H - inset : along * H;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(34,30,76,.22)");
    g.addColorStop(1, "rgba(34,30,76,0)");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
export function drawMist(c: Ctx) {
  const R = rng(29);
  for (let i = 0; i < 9; i++) {
    const x = (R() - 0.5) * 170,
      y = (R() - 0.5) * 30,
      r = 26 + R() * 30;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(70,64,130,.2)");
    g.addColorStop(1, "rgba(70,64,130,0)");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// ─────────────── the piece table ───────────────
/** Frames of the snuff's creeping shade, from untouched to swallowed. */
export const SNUFF_FRAMES = 6;
/** Width of the night band at the yard's edges (world px). */
export const NIGHT_BAND = 300;
export const HIT_RING_RADIUS = 35;
/** Ball Lightning's reach (GLOOMSHADE spark radius; drawn at the server's). */
export const BALL_RADIUS = 160;
/** The eight frames of the night, its middle left out (world px). */
export function nightSlices(W = 1600, H = 900, B = NIGHT_BAND) {
  return [
    [0, 0, B, B],
    [B, 0, W - 2 * B, B],
    [W - B, 0, B, B],
    [0, B, B, H - 2 * B],
    [W - B, B, B, H - 2 * B],
    [0, H - B, B, B],
    [B, H - B, W - 2 * B, B],
    [W - B, H - B, B, B],
  ].map(([x, y, w, h], i) => ({ name: `night-${i}`, x, y, w, h }));
}
const at =
  (ax: number, ay: number, draw: (c: Ctx, k: number) => void) =>
  (c: Ctx, k: number) => {
    c.translate(ax, ay);
    draw(c, k);
  };
const piece = (
  name: string,
  w: number,
  h: number,
  ax: number,
  ay: number,
  q: number,
  draw: (c: Ctx, k: number) => void,
  slices?: PieceDef["slices"],
): PieceDef => ({ name, w, h, ax, ay, q, draw: at(ax, ay, draw), slices });

/**
 * Every Lantern Yard piece for a light reach R (150, or 185 when Moonlit).
 * The big light pools, darks and shades are drawn at low texture density
 * (soft gradients); exact edges (rims) at about one texel per pixel.
 */
export function yardPieces(R: number, ball = BALL_RADIUS): PieceDef[] {
  const list: PieceDef[] = [
    piece("postLit", 46, 112, 23, 76, 2, (c, k) => drawPost(c, k, true)),
    piece("postOut", 46, 112, 23, 76, 2, (c, k) => drawPost(c, k, false)),
    piece("contact", 70, 26, 35, 13, 1, drawContact),
    piece("moonShadow", 110, 50, 6, 18, 0.6, drawMoonShadow),
    piece("flame", 12, 20, 6, 16, 3, drawFlame),
    piece("halo", 92, 92, 46, 46, 0.8, drawHalo),
    piece(`pool${R}`, R * 2, R * 2, R, R, 0.5, (c, k) => drawPool(c, k, R)),
    piece(`rim${R}`, R * 2 + 8, R * 2 + 8, R + 4, R + 4, 1.25, (c) =>
      drawRim(c, R, "255,216,140", 0.72, 0.16),
    ),
    piece(`dark${R}`, R * 2.3, R * 2.3, R * 1.15, R * 1.15, 0.35, (c) =>
      drawDarkPool(c, R * 1.15),
    ),
    piece(`snuffEdge${R}`, R * 2 + 12, R * 2 + 12, R + 6, R + 6, 1.25, (c) =>
      drawSnuffEdge(c, R),
    ),
    piece("smoke", 22, 22, 11, 11, 1, drawSmoke),
    piece("plate", 35, 18, 17.5, 9, 2, drawPlate),
    piece("pipOn", 20, 20, 10, 10, 2.5, (c) => drawPip(c, true)),
    piece("pipOff", 14, 14, 7, 7, 2.5, (c) => drawPip(c, false)),
    piece("ring", 80, 80, 40, 40, 1.5, drawHitRing),
    piece("sparkWarm", 14, 14, 7, 7, 1.5, (c) => drawSpark(c, "255,200,110")),
    piece("flash", 128, 128, 64, 64, 0.6, drawFlash),
    piece("ballPool", ball * 2, ball * 2, ball, ball, 0.5, (c) =>
      drawBallPool(c, ball),
    ),
    piece(
      "ballRim",
      ball * 2 + 8,
      ball * 2 + 8,
      ball + 4,
      ball + 4,
      1.25,
      (c) => drawBallRim(c, ball),
    ),
    piece("ballCore", 56, 56, 28, 28, 1, drawBallCore),
    piece("bolt", 22, 8, 1, 4, 2, drawBolt),
    piece("vignette", 1600, 900, 0, 0, 0.25, drawVignette, nightSlices()),
    piece("mist", 240, 90, 120, 45, 0.4, drawMist),
  ];
  for (let f = 0; f < SNUFF_FRAMES; f++)
    list.push(
      piece(`shade${R}_${f}`, R * 2, R * 2, R, R, 0.45, (c) =>
        drawSnuffShade(c, R, f / (SNUFF_FRAMES - 1)),
      ),
    );
  return list;
}

// ─────────────── layout (pure) ───────────────
/** How dark the night presses in: as before, 0.1 plus up to 0.22 as lanterns go out. */
export function nightDark(out: number, total: number) {
  return 0.1 + (out / Math.max(1, total)) * 0.22;
}
/** The night texture's alpha (its darkest is drawn for the fully dark yard). */
export const nightAlpha = (out: number, total: number) =>
  nightDark(out, total) / 0.32;
/** Two snuff frames to cross-fade for a progress in [0, 1]. */
export function snuffBlend(progress: number, frames = SNUFF_FRAMES) {
  const fp = Math.max(0, Math.min(1, progress)) * (frames - 1);
  const f0 = Math.min(frames - 2, Math.floor(fp)),
    fr = fp - f0;
  return { f0, f1: f0 + 1, a0: 1 - fr, a1: fr };
}
/** Lantern flicker (fills only; edges never move). */
export const poolFlicker = (t: number, i: number, reduced: boolean) =>
  reduced
    ? 1
    : 0.92 + Math.sin(t * 9 + i * 1.7) * 0.05 + Math.sin(t * 23 + i) * 0.03;
/** Seconds a relit lantern's light takes to spread back out. */
export const RELIGHT_SPREAD = 0.35;
/**
 * A lit lantern's light pool: alpha and scale. Snuffing shrinks the warm
 * fill (the rim stays at the exact reach); a relight spreads it back out.
 */
export function poolLook(
  i: number,
  t: number,
  reduced: boolean,
  snuff?: number,
  relightAge?: number,
) {
  let alpha = poolFlicker(t, i, reduced),
    scale = 1;
  if (snuff !== undefined) {
    scale = Math.max(0.12, 1 - snuff * 0.9);
    alpha *= 1 - snuff * 0.45;
  }
  if (relightAge !== undefined) {
    const r = Math.min(1, relightAge / RELIGHT_SPREAD);
    alpha *= r;
    scale = 0.6 + 0.4 * r;
  }
  return { alpha, scale };
}
/** The "hit me" ring: radius 22 → 48 each 1/0.9 s, as before (static 35 with reduced motion). */
export function hitRing(t: number, reduced: boolean) {
  const ring = reduced ? 0.5 : (t * 0.9) % 1;
  const radius = 22 + ring * 26;
  return {
    radius,
    scale: radius / HIT_RING_RADIUS,
    alpha: 0.6 * (1 - ring) + 0.15,
  };
}
/** Where the hit pips sit over an unlit lantern at (x, y). */
export const pipSpot = (x: number, y: number, h: number) => ({
  x: x - 7 + h * 14,
  y: y - 84,
});
/** The thin curl of smoke over an unlit lantern: three puffs. */
export function smokePuffs(
  x: number,
  y: number,
  i: number,
  t: number,
  reduced: boolean,
) {
  return [0, 1, 2].map((k) => {
    const p = reduced ? k / 3 : (t * 0.5 + k / 3) % 1;
    const s = (4 + p * 5) / 5.2;
    return {
      x: x + Math.sin(p * 6 + i) * 6,
      y: y - 70 - p * 40,
      alpha: 0.7 * (1 - p) * Math.min(1, p * 6 + 0.2),
      scale: s,
      rot: p * 2,
    };
  });
}
/** Sparks thrown up out of a relit lamp at (x, y), `age` seconds in. */
export function relightSparks(x: number, y: number, age: number, count = 12) {
  const out: {
    x: number;
    y: number;
    alpha: number;
    scale: number;
    rot: number;
  }[] = [];
  for (let s = 0; s < count; s++) {
    const a = (s + 1) * 2.39996,
      sp = 40 + ((s + 1) % 7) * 16,
      life = 0.6 + ((s + 1) % 5) * 0.1;
    if (age >= life) continue;
    const u = age / life;
    out.push({
      x: x + Math.cos(a) * sp * age,
      y: y + Math.sin(a) * sp * 0.6 * age - 90 * age + 70 * age * age,
      alpha: 1 - u,
      scale: 1 - u * 0.5,
      rot: a,
    });
  }
  return out;
}
/** How long the relight's flash and sparks last. */
export const RELIGHT_SHOW = 1.1;
/** Mist drifting along the hedges: four banks (x, y, rotation). */
export function mistBanks(t: number, reduced: boolean) {
  const drift = reduced ? 0 : t;
  return (
    [
      [300, 70, 9, 0],
      [1150, 830, -8, 2],
      [70, 470, 6, 4],
      [1530, 330, -7, 1],
    ] as const
  ).map(([mx, my, sp, ph]) => ({
    x: mx + Math.sin(drift * 0.12 * Math.sign(sp) + ph) * 60,
    y: my + Math.cos(drift * 0.1 + ph) * 8,
    rot: mx < 200 || mx > 1400 ? Math.PI / 2 : 0,
  }));
}
