/**
 * The Storm Twins' conductor ring: copper conductor posts (idle, charging,
 * conducting), the polarity pad (+/−, cancelling), polarity marks over the
 * raiders, the static field, the link beam's band and bolts, and the ring
 * inlaid in the floor (baked once with the background).
 *
 * Every drawer is pure, (ctx, k): one unit is one world pixel with the
 * origin at the piece's cell top-left (the atlas painter scales by k, the
 * texture pixels per world pixel). No pixel read-back anywhere: paths,
 * gradients and seeded strokes, painted once into an atlas
 * (raid-piece-stage.ts). Pure layout helpers follow the table.
 */
import type { Ctx, PieceDef } from "./raid-piece-stage";

type Rng = () => number;

const TAU = Math.PI * 2;
const rng =
  (s: number): Rng =>
  () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
const ell = (c: Ctx, x: number, y: number, rx: number, ry: number) => {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
};
const circ = (c: Ctx, x: number, y: number, r: number) => {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
};
/** A soft round light or shadow: radial gradient squashed into an ellipse. */
function soft(
  c: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  stops: [number, string][],
) {
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g;
  circ(c, 0, 0, rx);
  c.fill();
  c.restore();
}

// Colour meanings, unchanged from the game (raid-storm-twins-art.ts).
export const COL = {
  plus: "#ffd579", // pad + (0xffd579), mark + 0xffda85
  minus: "#8adfff", // pad − (0x8adfff), mark − 0x8edfff
  markPlus: "#ffda85",
  markMinus: "#8edfff",
  cancel: "#8de8cf", // cancelled mark 0x8de8cf
  gold: "#ffe18b", // beam bolt 0xffe18b
  cyan: "#9ce4ff", // beam bolt 0x9ce4ff
  band: "#ffdc8d", // beam band 0xffdc8d
  warn: "#ff7799", // link-beam warning 0xff7799 / 0xffbdc9
  warnCore: "#ffbdc9",
  field: "#a5c8ff", // static field edge 0xa5c8ff, fill 0x7d9fff
  fieldFill: "#7d9fff",
  fieldBolt: "#9dcfff",
  warm: "#ffb36e",
};

// ───────--------------------------------------------------------- copper
/** Hammered copper with a verdigris patina, clipped by the caller. */
function patina(
  c: Ctx,
  r: Rng,
  x0: number,
  y0: number,
  w: number,
  h: number,
  n: number,
  bias = 1,
) {
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * w,
      y = y0 + Math.pow(r(), bias) * h,
      rr = 0.6 + r() * 2.4;
    c.fillStyle = rgba(r() < 0.5 ? "#4fae96" : "#6fc8ac", 0.18 + r() * 0.35);
    ell(c, x, y, rr * (1 + r()), rr);
    c.fill();
  }
}
function hammered(
  c: Ctx,
  r: Rng,
  x0: number,
  y0: number,
  w: number,
  h: number,
  n: number,
) {
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * w,
      y = y0 + r() * h;
    c.fillStyle = r() < 0.5 ? "rgba(40,16,8,0.18)" : "rgba(255,214,170,0.14)";
    ell(c, x, y, 0.5 + r() * 0.9, 0.35 + r() * 0.5);
    c.fill();
  }
}
function rivet(c: Ctx, x: number, y: number, rr = 1) {
  c.fillStyle = "rgba(10,8,14,0.55)";
  circ(c, x + 0.35 * rr, y + 0.45 * rr, rr * 1.05);
  c.fill();
  const g = c.createRadialGradient(x - rr * 0.4, y - rr * 0.45, 0, x, y, rr);
  g.addColorStop(0, "#ffe2b8");
  g.addColorStop(0.45, "#c98450");
  g.addColorStop(1, "#4a2616");
  c.fillStyle = g;
  circ(c, x, y, rr);
  c.fill();
}

// ───────----------------------------------------------------- the post
// Design cell 44 × 75, world point (post.x, post.y) at (22, 52). Foot at y+17
// (where the game sorts the post), orb centre at y−36.
const PS = 1.2; // the post is drawn in 44 × 75 design units, scaled up 1.2×
export const POST = {
  w: 44 * PS,
  h: 75 * PS,
  ox: 22 * PS,
  oy: 52 * PS,
  orbY: (14 - 52) * PS,
};
function drawPost(c: Ctx) {
  c.scale(PS, PS);
  const r = rng(731),
    cx = 22;
  // stone plinth drum
  c.fillStyle = "#151a26";
  ell(c, cx, 66, 19.5, 6.6);
  c.fill();
  let g = c.createLinearGradient(cx - 19, 0, cx + 19, 0);
  g.addColorStop(0, "#8b6a4f");
  g.addColorStop(0.3, "#5d5058");
  g.addColorStop(0.7, "#343a4e");
  g.addColorStop(1, "#4a6f96");
  c.fillStyle = g;
  c.fillRect(cx - 19.5, 60, 39, 6);
  // chips in the drum
  for (let i = 0; i < 7; i++) {
    c.fillStyle = "rgba(12,14,24,0.45)";
    const x = cx - 18 + r() * 36;
    c.fillRect(x, 61 + r() * 4, 1 + r() * 2, 0.8);
  }
  g = c.createRadialGradient(cx - 6, 57, 1, cx, 60, 20);
  g.addColorStop(0, "#9b8676");
  g.addColorStop(0.6, "#5f5560");
  g.addColorStop(1, "#353a4c");
  c.fillStyle = g;
  ell(c, cx, 60, 19.5, 6.6);
  c.fill();
  // moss / cracks on the plinth top
  c.strokeStyle = "rgba(18,20,30,0.6)";
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(cx - 15, 61);
  c.lineTo(cx - 11, 59.6);
  c.lineTo(cx - 8, 60.8);
  c.moveTo(cx + 9, 63.5);
  c.lineTo(cx + 13, 61.4);
  c.stroke();
  // copper collar ring set into the plinth
  c.strokeStyle = "#3a1e12";
  c.lineWidth = 2.6;
  ell(c, cx, 60.3, 15, 5);
  c.stroke();
  g = c.createLinearGradient(cx - 15, 0, cx + 15, 0);
  g.addColorStop(0, "#ffc58a");
  g.addColorStop(0.45, "#c0743f");
  g.addColorStop(1, "#5f86a6");
  c.strokeStyle = g;
  c.lineWidth = 1.5;
  ell(c, cx, 59.8, 15, 5);
  c.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    if (Math.sin(a) < -0.2) continue; // back rivets hidden by the shaft
    rivet(c, cx + Math.cos(a) * 17.2, 60 + Math.sin(a) * 5.8, 0.85);
  }
  // contact shadow of the shaft on the plinth
  soft(c, cx + 1, 59.5, 12, 3.4, [
    [0, "rgba(8,6,12,0.75)"],
    [1, "rgba(8,6,12,0)"],
  ]);
  // shaft
  const L = cx - 9,
    R = cx + 9;
  c.save();
  c.beginPath();
  c.moveTo(L, 22);
  c.lineTo(R, 22);
  c.lineTo(R, 58);
  c.ellipse(cx, 58, 9, 3, 0, 0, Math.PI);
  c.closePath();
  g = c.createLinearGradient(L, 0, R, 0);
  g.addColorStop(0, "#5e2f1c");
  g.addColorStop(0.1, "#d98e58");
  g.addColorStop(0.24, "#ffcf97");
  g.addColorStop(0.4, "#c87843");
  g.addColorStop(0.68, "#7d3f24");
  g.addColorStop(0.88, "#2f1b17");
  g.addColorStop(1, "#5d8fb8");
  c.fillStyle = g;
  c.fill();
  c.clip();
  hammered(c, r, L, 22, 18, 36, 70);
  // verdigris pooling at the foot and dripping from the bands
  patina(c, r, L, 46, 18, 13, 26, 0.6);
  for (let i = 0; i < 9; i++) {
    const x = L + 1 + r() * 16,
      y0 = r() < 0.5 ? 37 : 53,
      len = 3 + r() * 8;
    c.strokeStyle = rgba("#6cc4aa", 0.25 + r() * 0.3);
    c.lineWidth = 0.5 + r() * 0.9;
    c.beginPath();
    c.moveTo(x, y0);
    c.quadraticCurveTo(x + (r() - 0.5) * 1.5, y0 + len / 2, x, y0 + len);
    c.stroke();
  }
  // a warm reflected bounce near the floor (the gold side of the arena)
  g = c.createLinearGradient(0, 58, 0, 44);
  g.addColorStop(0, "rgba(255,170,90,0.28)");
  g.addColorStop(1, "rgba(255,170,90,0)");
  c.fillStyle = g;
  c.fillRect(L, 44, 9, 14);
  c.restore();
  // iron bands with rivets
  for (const y of [53, 37]) {
    g = c.createLinearGradient(L - 1, 0, R + 1, 0);
    g.addColorStop(0, "#3b3036");
    g.addColorStop(0.25, "#9a8c86");
    g.addColorStop(0.5, "#4d4a55");
    g.addColorStop(0.85, "#1a1b24");
    g.addColorStop(1, "#4f78a0");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(L - 1, y - 2);
    c.ellipse(cx, y - 2, 10, 2.4, 0, Math.PI, 0, true);
    c.lineTo(R + 1, y + 2);
    c.ellipse(cx, y + 2, 10, 2.4, 0, 0, Math.PI);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(255,230,200,0.35)";
    c.lineWidth = 0.5;
    c.beginPath();
    c.ellipse(cx, y - 2, 10, 2.4, 0, Math.PI * 0.95, Math.PI * 0.05, true);
    c.stroke();
    for (const dx of [-6, 0, 6]) rivet(c, cx + dx, y + 0.8, 0.7);
  }
  // the coil: copper wire wound under the orb
  c.save();
  c.beginPath();
  c.rect(L - 1.5, 23, 21, 11);
  c.clip();
  for (let i = 0; i < 7; i++) {
    const y = 24.2 + i * 1.5;
    c.strokeStyle = "rgba(40,14,6,0.8)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.ellipse(cx, y, 10.2, 2.2, 0, 0, Math.PI);
    c.stroke();
    const wg = c.createLinearGradient(L, 0, R, 0);
    wg.addColorStop(0, "#a5592f");
    wg.addColorStop(0.28, "#ffd8a0");
    wg.addColorStop(0.62, "#b4652f");
    wg.addColorStop(1, "#7fb3dd");
    c.strokeStyle = wg;
    c.lineWidth = 0.85;
    c.beginPath();
    c.ellipse(cx, y - 0.3, 10.2, 2.2, 0, 0.05, Math.PI - 0.05);
    c.stroke();
  }
  c.restore();
  // collar cap and neck
  g = c.createLinearGradient(L, 0, R, 0);
  g.addColorStop(0, "#6b3a22");
  g.addColorStop(0.3, "#f0b075");
  g.addColorStop(0.7, "#6b3520");
  g.addColorStop(1, "#5a86ad");
  c.fillStyle = g;
  ell(c, cx, 23, 11, 3.3);
  c.fill();
  c.strokeStyle = "rgba(255,226,186,0.6)";
  c.lineWidth = 0.6;
  c.beginPath();
  c.ellipse(cx, 22.6, 11, 3.3, 0, Math.PI, 0);
  c.stroke();
  c.fillStyle = g;
  c.fillRect(cx - 3, 17, 6, 6);
  // the orb (brass terminal)
  g = c.createRadialGradient(cx - 3, 10.5, 0.5, cx, 14, 8.5);
  g.addColorStop(0, "#fff4d8");
  g.addColorStop(0.22, "#f2c184");
  g.addColorStop(0.58, "#a8623a");
  g.addColorStop(1, "#331a12");
  c.fillStyle = g;
  circ(c, cx, 14, 8);
  c.fill();
  // cool rim light from the blue side of the arena
  c.strokeStyle = "rgba(130,200,255,0.7)";
  c.lineWidth = 1.1;
  c.beginPath();
  c.arc(cx, 14, 7.4, -0.9, 1.2);
  c.stroke();
  c.fillStyle = "rgba(255,255,255,0.85)";
  ell(c, cx - 3.2, 10.6, 1.8, 1.1);
  c.fill();
}
function drawPostShadow(c: Ctx) {
  // a tight contact shadow plus a long soft fall-off
  soft(c, 52, 24, 48, 18, [
    [0, "rgba(6,10,24,0.42)"],
    [0.5, "rgba(6,10,24,0.2)"],
    [1, "rgba(6,10,24,0)"],
  ]);
  soft(c, 49, 22, 24, 9, [
    [0, "rgba(4,6,14,0.7)"],
    [0.7, "rgba(4,6,14,0.3)"],
    [1, "rgba(4,6,14,0)"],
  ]);
}

// ───────----------------------------------------------------- lights
const glow =
  (col: string, core = 0.95) =>
  (c: Ctx) => {
    soft(c, 28, 28, 28, 28, [
      [0, `rgba(255,255,255,${core})`],
      [0.1, rgba(col, 0.9)],
      [0.32, rgba(col, 0.32)],
      [0.62, rgba(col, 0.08)],
      [1, rgba(col, 0)],
    ]);
  };
const floorLight = (col: string) => (c: Ctx) => {
  soft(c, 80, 36, 80, 34, [
    [0, rgba(col, 0.42)],
    [0.35, rgba(col, 0.18)],
    [1, rgba(col, 0)],
  ]);
};
function drawSpark(c: Ctx) {
  soft(c, 9, 9, 9, 9, [
    [0, "rgba(255,255,255,0.95)"],
    [0.3, "rgba(170,210,255,0.45)"],
    [1, "rgba(170,210,255,0)"],
  ]);
  c.strokeStyle = "rgba(235,245,255,0.9)";
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(9, 1.5);
  c.lineTo(9, 16.5);
  c.moveTo(1.5, 9);
  c.lineTo(16.5, 9);
  c.stroke();
}

// ───────----------------------------------------------------- bolts
// Cell 160 × 26, origin at the left middle: stretched between two points.
const BOLT = { w: 160, h: 26 };
const bolt = (col: string, seed: number) => (c: Ctx) => {
  const r = rng(seed),
    n = 12,
    pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      amp = Math.sin(Math.PI * t) * 7.5;
    pts.push([
      2 + t * 156 + (i && i < n ? (r() - 0.5) * 6 : 0),
      13 + (i && i < n ? (r() - 0.5) * 2 * amp : 0),
    ]);
  }
  const fork: [number, number][] = [];
  if (seed % 2) {
    const i = 4 + Math.floor(r() * 4);
    let [x, y] = pts[i];
    fork.push([x, y]);
    for (let j = 0; j < 3; j++) {
      x += 7 + r() * 6;
      y += (r() < 0.5 ? -1 : 1) * (2 + r() * 3);
      fork.push([x, Math.max(2, Math.min(24, y))]);
    }
  }
  const line = (p: [number, number][], w: number, s: string) => {
    c.strokeStyle = s;
    c.lineWidth = w;
    c.beginPath();
    p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  };
  c.lineJoin = c.lineCap = "round";
  line(pts, 12, rgba(col, 0.2));
  line(pts, 5, rgba(col, 0.9));
  line(pts, 1.1, "rgba(255,255,255,0.9)");
  if (fork.length) {
    line(fork, 3.2, rgba(col, 0.75));
    line(fork, 0.8, "rgba(255,255,255,0.8)");
  }
};
/** The live beam's danger band, exactly 44 wide (S.link.width × 2). */
function drawBand(c: Ctx) {
  const g = c.createLinearGradient(0, 4, 0, 48);
  g.addColorStop(0, rgba(COL.band, 0.32));
  g.addColorStop(0.18, rgba(COL.band, 0.13));
  g.addColorStop(0.5, rgba(COL.band, 0.2));
  g.addColorStop(0.82, rgba(COL.band, 0.13));
  g.addColorStop(1, rgba(COL.band, 0.32));
  c.fillStyle = g;
  c.fillRect(0, 4, 32, 44);
  c.fillStyle = rgba(COL.band, 0.55);
  c.fillRect(0, 4, 32, 1);
  c.fillRect(0, 47, 32, 1);
}

// ───────----------------------------------------------------- polarity pad
// Cell 150 × 150 centred: radius 58 (S.polarity.padRadius) is the rim.
export const PAD = { w: 150, h: 150, r: 58 };
function drawPadPlate(c: Ctx) {
  const r = rng(58),
    cx = 75,
    cy = 75;
  // the plate sits in a cut in the floor: soft shadow around and below
  soft(c, cx + 2, cy + 4, 70, 70, [
    [0.78, "rgba(4,8,18,0.55)"],
    [0.9, "rgba(4,8,18,0.22)"],
    [1, "rgba(4,8,18,0)"],
  ]);
  // copper bezel 53 → 63
  let g = c.createLinearGradient(cx - 60, cy - 60, cx + 60, cy + 60);
  g.addColorStop(0, "#ffcf98");
  g.addColorStop(0.3, "#c77a45");
  g.addColorStop(0.65, "#7a3d22");
  g.addColorStop(1, "#4f7fa6");
  c.fillStyle = g;
  circ(c, cx, cy, 63);
  c.fill();
  c.save();
  c.beginPath();
  c.arc(cx, cy, 63, 0, TAU);
  c.arc(cx, cy, 53, 0, TAU, true);
  c.clip();
  hammered(c, r, cx - 63, cy - 63, 126, 126, 380);
  for (let i = 0; i < 22; i++) {
    const a = r() * TAU,
      rr = 54 + r() * 8;
    c.fillStyle = rgba(r() < 0.5 ? "#4fae96" : "#79d0b5", 0.25 + r() * 0.35);
    ell(
      c,
      cx + Math.cos(a) * rr,
      cy + Math.sin(a) * rr,
      1.5 + r() * 3,
      1 + r() * 2,
    );
    c.fill();
  }
  c.restore();
  c.strokeStyle = "rgba(255,232,200,0.55)";
  c.lineWidth = 0.9;
  c.beginPath();
  c.arc(cx, cy, 62.4, Math.PI * 0.95, Math.PI * 1.75);
  c.stroke();
  c.strokeStyle = "rgba(20,8,6,0.7)";
  c.beginPath();
  c.arc(cx, cy, 62.6, Math.PI * 0.05, Math.PI * 0.8);
  c.stroke();
  // inner disc: dark bronze, recessed (shadow on the top edge)
  g = c.createRadialGradient(cx - 14, cy - 18, 4, cx, cy, 54);
  g.addColorStop(0, "#7a6658");
  g.addColorStop(0.65, "#4f4650");
  g.addColorStop(1, "#2c2c3a");
  c.fillStyle = g;
  circ(c, cx, cy, 53);
  c.fill();
  c.save();
  circ(c, cx, cy, 53);
  c.clip();
  hammered(c, r, cx - 53, cy - 53, 106, 106, 260);
  // engraved rings and spokes
  const groove = (draw: (o: number) => void) => {
    c.strokeStyle = "rgba(6,8,14,0.7)";
    c.lineWidth = 1.4;
    draw(0);
    c.strokeStyle = "rgba(200,170,140,0.28)";
    c.lineWidth = 0.6;
    draw(0.8);
  };
  for (const rr of [44, 31])
    groove((o) => {
      c.beginPath();
      c.arc(cx, cy + o, rr, 0, TAU);
      c.stroke();
    });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + Math.PI / 12;
    groove((o) => {
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * 33, cy + Math.sin(a) * 33 + o);
      c.lineTo(cx + Math.cos(a) * 42, cy + Math.sin(a) * 42 + o);
      c.stroke();
    });
  }
  // recess shadow under the bezel's top lip
  c.strokeStyle = "rgba(4,6,12,0.65)";
  c.lineWidth = 5;
  c.beginPath();
  c.arc(cx, cy + 3, 54, Math.PI * 1.05, Math.PI * 1.95);
  c.stroke();
  // the glyph recess
  g = c.createRadialGradient(cx, cy - 4, 2, cx, cy, 25);
  g.addColorStop(0, "#1e2030");
  g.addColorStop(1, "#3a3644");
  c.fillStyle = g;
  circ(c, cx, cy, 24);
  c.fill();
  c.restore();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    rivet(c, cx + Math.cos(a) * 58, cy + Math.sin(a) * 58, 1.25);
  }
}
/** Colour-coded rim at exactly r58 plus the sign glyph (normal blend). */
const padSign = (col: string, plus: boolean) => (c: Ctx) => {
  const cx = 75,
    cy = 75;
  c.strokeStyle = "rgba(8,12,24,0.75)";
  c.lineWidth = 6.5;
  circ(c, cx, cy, 58);
  c.stroke();
  c.strokeStyle = col;
  c.lineWidth = 4;
  circ(c, cx, cy, 58);
  c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.55)";
  c.lineWidth = 1;
  circ(c, cx, cy, 58);
  c.stroke();
  const bars = (dx: number, dy: number, w: number, s: string) => {
    c.strokeStyle = s;
    c.lineWidth = w;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(cx - 16 + dx, cy + dy);
    c.lineTo(cx + 16 + dx, cy + dy);
    if (plus) {
      c.moveTo(cx + dx, cy - 16 + dy);
      c.lineTo(cx + dx, cy + 16 + dy);
    }
    c.stroke();
  };
  c.strokeStyle = rgba(col, 0.75);
  c.lineWidth = 1.2;
  for (const rr of [44, 31]) {
    c.beginPath();
    c.arc(cx, cy, rr, 0, TAU);
    c.stroke();
  }
  c.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + Math.PI / 12;
    c.moveTo(cx + Math.cos(a) * 33, cy + Math.sin(a) * 33);
    c.lineTo(cx + Math.cos(a) * 42, cy + Math.sin(a) * 42);
  }
  c.stroke();
  bars(0.8, 1.6, 8, "rgba(4,6,12,0.8)");
  bars(0, 0, 6.5, col);
  bars(0, -0.3, 2, "rgba(255,255,255,0.85)");
};
/** Additive light of the pad: rim glow, inner wash and glyph halo. */
const padGlow = (col: string) => (c: Ctx) => {
  const cx = 75,
    cy = 75;
  c.fillStyle = rgba(col, 0.2);
  circ(c, cx, cy, 56);
  c.fill();
  for (const rr of [44, 31]) {
    c.strokeStyle = rgba(col, 0.18);
    c.lineWidth = 5;
    circ(c, cx, cy, rr);
    c.stroke();
  }
  for (const [w, a] of [
    [18, 0.06],
    [11, 0.12],
    [6, 0.22],
  ]) {
    c.strokeStyle = rgba(col, a);
    c.lineWidth = w;
    circ(c, cx, cy, 58);
    c.stroke();
  }
  soft(c, cx, cy, 30, 30, [
    [0, rgba(col, 0.45)],
    [1, rgba(col, 0)],
  ]);
};

// ───────----------------------------------------------------- marks
// Cell 72 × 72 centred; the medallion sits 100 px above the raider.
const MARK = { w: 72, h: 72 };
function drawMarkBase(c: Ctx) {
  const cx = 36,
    cy = 36;
  c.fillStyle = "rgba(0,0,0,0.38)";
  circ(c, cx + 1.4, cy + 2.6, 27);
  c.fill();
  let g = c.createLinearGradient(cx - 26, cy - 26, cx + 26, cy + 26);
  g.addColorStop(0, "#ffd6a0");
  g.addColorStop(0.35, "#c47a44");
  g.addColorStop(0.75, "#6a341e");
  g.addColorStop(1, "#5a8db6");
  c.fillStyle = g;
  circ(c, cx, cy, 27);
  c.fill();
  const r = rng(9);
  c.save();
  circ(c, cx, cy, 27);
  c.clip();
  patina(c, r, cx - 27, cy - 27, 54, 54, 14);
  c.restore();
  g = c.createRadialGradient(cx - 7, cy - 9, 2, cx, cy, 24);
  g.addColorStop(0, "#22395c");
  g.addColorStop(1, "#0b1628");
  c.fillStyle = g;
  circ(c, cx, cy, 22.5);
  c.fill();
  c.strokeStyle = "rgba(0,0,0,0.55)";
  c.lineWidth = 3;
  c.beginPath();
  c.arc(cx, cy + 1.5, 22, Math.PI * 1.1, Math.PI * 1.9);
  c.stroke();
  c.strokeStyle = "rgba(255,236,206,0.6)";
  c.lineWidth = 0.8;
  c.beginPath();
  c.arc(cx, cy, 26.4, Math.PI * 1.0, Math.PI * 1.7);
  c.stroke();
}
const markGlyph =
  (col: string, kind: "plus" | "minus" | "check") => (c: Ctx) => {
    const cx = 36,
      cy = 36;
    soft(c, cx, cy, 20, 20, [
      [0, rgba(col, 0.5)],
      [1, rgba(col, 0)],
    ]);
    c.strokeStyle = col;
    c.lineWidth = 3;
    circ(c, cx, cy, 23);
    c.stroke();
    const path = (dx: number, dy: number) => {
      c.beginPath();
      if (kind === "check") {
        c.moveTo(cx - 10 + dx, cy + dy);
        c.lineTo(cx - 2 + dx, cy + 8 + dy);
        c.lineTo(cx + 12 + dx, cy - 9 + dy);
      } else {
        c.moveTo(cx - 11 + dx, cy + dy);
        c.lineTo(cx + 11 + dx, cy + dy);
        if (kind === "plus") {
          c.moveTo(cx + dx, cy - 11 + dy);
          c.lineTo(cx + dx, cy + 11 + dy);
        }
      }
      c.stroke();
    };
    c.lineCap = c.lineJoin = "round";
    c.strokeStyle = "rgba(0,0,0,0.6)";
    c.lineWidth = 6;
    path(0.6, 1.2);
    c.strokeStyle = col;
    c.lineWidth = 4.4;
    path(0, 0);
    c.strokeStyle = "rgba(255,255,255,0.8)";
    c.lineWidth = 1.3;
    path(0, -0.3);
  };

// ───────----------------------------------------------------- static field
// Cell 230 × 230 centred; radius 100 (S.field.radius) is the crisp edge.
export const FIELD = { w: 230, h: 230, r: 100 };
function drawFieldDisc(c: Ctx) {
  const cx = 115,
    cy = 115,
    r = rng(100);
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, 100);
  g.addColorStop(0, rgba(COL.fieldFill, 0.12));
  g.addColorStop(0.62, rgba(COL.fieldFill, 0.15));
  g.addColorStop(0.92, rgba(COL.fieldFill, 0.24));
  g.addColorStop(1, rgba(COL.fieldFill, 0.3));
  c.fillStyle = g;
  circ(c, cx, cy, 100);
  c.fill();
  // faint ionised crackle etched over the floor
  c.save();
  circ(c, cx, cy, 97);
  c.clip();
  c.lineJoin = "round";
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU,
      d = 20 + r() * 72;
    let x = cx + Math.cos(a) * d,
      y = cy + Math.sin(a) * d;
    c.strokeStyle = rgba("#cfe0ff", 0.1 + r() * 0.14);
    c.lineWidth = 0.6 + r() * 0.6;
    c.beginPath();
    c.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      x += (r() - 0.5) * 14;
      y += (r() - 0.5) * 14;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  c.restore();
}
const fieldEdge = (seed: number) => (c: Ctx) => {
  const cx = 115,
    cy = 115,
    r = rng(seed);
  for (const [w, a] of [
    [12, 0.07],
    [7, 0.14],
  ]) {
    c.strokeStyle = rgba(COL.field, a);
    c.lineWidth = w;
    circ(c, cx, cy, 100);
    c.stroke();
  }
  c.strokeStyle = "rgba(10,18,48,0.55)";
  c.lineWidth = 5;
  circ(c, cx, cy, 100);
  c.stroke();
  c.strokeStyle = rgba(COL.field, 0.95);
  c.lineWidth = 3;
  circ(c, cx, cy, 100);
  c.stroke();
  // little arcs crawling along the edge
  c.lineJoin = "round";
  for (let i = 0; i < 16; i++) {
    const a0 = r() * TAU,
      span = 0.12 + r() * 0.18;
    c.strokeStyle = r() < 0.5 ? "rgba(235,244,255,0.9)" : rgba(COL.field, 0.9);
    c.lineWidth = 0.8 + r() * 0.6;
    c.beginPath();
    for (let j = 0; j <= 5; j++) {
      const a = a0 + (span * j) / 5,
        d =
          100 + (j % 2 ? 1 : -1) * (2 + r() * 4) * Math.sin((Math.PI * j) / 5);
      const x = cx + Math.cos(a) * d,
        y = cy + Math.sin(a) * d;
      j ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
  }
};

// ───────----------------------------------------------------- the ring
/**
 * The conductor ring inlaid in the floor, baked once with the background
 * (paintIllustratedRaidFloor): the same four rings at the same radii, now a
 * riveted copper rail in a groove, a live cyan filament, a thin copper
 * inlay and an etched inner circle.
 */
export function paintRingInlay(c: Ctx) {
  c.save();
  const r = rng(380);
  const path = (rx: number, ry: number, dy = 0) => {
    c.beginPath();
    c.ellipse(800, 450 + dy, rx, ry, 0, 0, TAU);
  };
  const warmCool = (a: number) => {
    const g = c.createLinearGradient(70, 0, 1530, 0);
    g.addColorStop(0, rgba("#ffc27e", a));
    g.addColorStop(0.45, rgba("#c27a48", a));
    g.addColorStop(0.7, rgba("#a0684c", a));
    g.addColorStop(1, rgba("#8fb6d8", a));
    return g;
  };
  // outer copper rail (730 × 380)
  c.strokeStyle = "rgba(4,8,20,0.5)";
  c.lineWidth = 10;
  path(730, 380, 2);
  c.stroke();
  c.strokeStyle = "#2a160e";
  c.lineWidth = 6.5;
  path(730, 380);
  c.stroke();
  c.strokeStyle = warmCool(0.95);
  c.lineWidth = 4.5;
  path(730, 380);
  c.stroke();
  c.strokeStyle = "rgba(255,226,180,0.55)";
  c.lineWidth = 1.2;
  path(729, 379, -1.4);
  c.stroke();
  // verdigris along the rail
  for (let i = 0; i < 70; i++) {
    const a0 = r() * TAU,
      span = 0.01 + r() * 0.04;
    c.strokeStyle = rgba(r() < 0.5 ? "#4fae96" : "#7fd3b8", 0.25 + r() * 0.4);
    c.lineWidth = 2 + r() * 2.5;
    c.beginPath();
    c.ellipse(800, 450, 730, 380, 0, a0, a0 + span);
    c.stroke();
  }
  // rivet studs every 10°
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    rivet(c, 800 + Math.cos(a) * 730, 450 + Math.sin(a) * 380, 2.2);
  }
  // the live filament (710 × 360): glass channel with a cyan core
  c.strokeStyle = "rgba(4,8,20,0.55)";
  c.lineWidth = 5;
  path(710, 360);
  c.stroke();
  c.strokeStyle = "rgba(140,220,255,0.1)";
  c.lineWidth = 7;
  path(710, 360);
  c.stroke();
  c.strokeStyle = "rgba(165,218,240,0.6)";
  c.lineWidth = 1.6;
  path(710, 360);
  c.stroke();
  // thin copper inlay (500 × 285)
  c.strokeStyle = "rgba(4,8,20,0.4)";
  c.lineWidth = 4.5;
  path(500, 285, 1);
  c.stroke();
  c.strokeStyle = warmCool(0.6);
  c.lineWidth = 2.2;
  path(500, 285);
  c.stroke();
  c.strokeStyle = "rgba(255,226,180,0.3)";
  c.lineWidth = 0.7;
  path(500, 285, -0.9);
  c.stroke();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + TAU / 32;
    const x = 800 + Math.cos(a) * 500,
      y = 450 + Math.sin(a) * 285;
    c.save();
    c.translate(x, y);
    c.rotate(a + Math.PI / 4);
    c.fillStyle = "rgba(4,8,20,0.5)";
    c.fillRect(-3.2, -3.2 + 1, 6.4, 6.4);
    c.fillStyle = warmCool(0.8);
    c.fillRect(-2.6, -2.6, 5.2, 5.2);
    c.restore();
  }
  // etched inner circle (r150): double groove with a faint cyan charge
  for (const rr of [150, 144]) {
    c.strokeStyle = "rgba(4,8,20,0.45)";
    c.lineWidth = 2.2;
    c.beginPath();
    c.arc(800, 450 + 0.8, rr, 0, TAU);
    c.stroke();
    c.strokeStyle =
      rr === 150 ? "rgba(165,218,240,0.45)" : "rgba(200,170,140,0.22)";
    c.lineWidth = rr === 150 ? 1.4 : 0.8;
    c.beginPath();
    c.arc(800, 450, rr, 0, TAU);
    c.stroke();
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    c.strokeStyle = "rgba(165,218,240,0.28)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(800 + Math.cos(a) * 144, 450 + Math.sin(a) * 144);
    c.lineTo(800 + Math.cos(a) * 150, 450 + Math.sin(a) * 150);
    c.stroke();
  }
  c.restore();
}

// ─────────────── the piece table ───────────────
const piece = (
  name: string,
  w: number,
  h: number,
  ax: number,
  ay: number,
  q: number,
  draw: (c: Ctx, k: number) => void,
): PieceDef => ({ name, w, h, ax, ay, q, draw });
/** Bolt variants per colour (cycled for flicker). */
export const BOLT_VARIANTS = 4;
/**
 * Every conductor-ring piece. Soft lights at one texel per world pixel,
 * crisp metal, glyphs and edges at two.
 */
export function ringPieces(): PieceDef[] {
  const list: PieceDef[] = [
    piece("post", POST.w, POST.h, POST.ox, POST.oy, 2, drawPost),
    piece("postShadow", 104, 46, 52, 22, 1, drawPostShadow),
    piece("glowWarm", 56, 56, 28, 28, 1, glow(COL.warm, 0.6)),
    piece("glowPink", 56, 56, 28, 28, 1, glow(COL.warn)),
    piece("glowGold", 56, 56, 28, 28, 1, glow(COL.gold)),
    piece("glowCyan", 56, 56, 28, 28, 1, glow(COL.cyan)),
    piece("floorWarm", 160, 72, 80, 36, 0.75, floorLight(COL.warm)),
    piece("floorPink", 160, 72, 80, 36, 0.75, floorLight(COL.warn)),
    piece("floorGold", 160, 72, 80, 36, 0.75, floorLight(COL.gold)),
    piece("spark", 18, 18, 9, 9, 1.5, drawSpark),
    piece("band", 32, 52, 0, 26, 1, drawBand),
    piece("padPlate", PAD.w, PAD.h, 75, 75, 2, drawPadPlate),
    piece("padSignPlus", PAD.w, PAD.h, 75, 75, 2, padSign(COL.plus, true)),
    piece("padSignMinus", PAD.w, PAD.h, 75, 75, 2, padSign(COL.minus, false)),
    piece("padGlowPlus", PAD.w, PAD.h, 75, 75, 1, padGlow(COL.plus)),
    piece("padGlowMinus", PAD.w, PAD.h, 75, 75, 1, padGlow(COL.minus)),
    piece("markBase", MARK.w, MARK.h, 36, 36, 2, drawMarkBase),
    piece(
      "markPlus",
      MARK.w,
      MARK.h,
      36,
      36,
      2,
      markGlyph(COL.markPlus, "plus"),
    ),
    piece(
      "markMinus",
      MARK.w,
      MARK.h,
      36,
      36,
      2,
      markGlyph(COL.markMinus, "minus"),
    ),
    piece(
      "markCheck",
      MARK.w,
      MARK.h,
      36,
      36,
      2,
      markGlyph(COL.cancel, "check"),
    ),
    piece("fieldDisc", FIELD.w, FIELD.h, 115, 115, 1, drawFieldDisc),
    piece("fieldEdge0", FIELD.w, FIELD.h, 115, 115, 1.5, fieldEdge(11)),
    piece("fieldEdge1", FIELD.w, FIELD.h, 115, 115, 1.5, fieldEdge(29)),
  ];
  for (const [name, col] of [
    ["Gold", COL.gold],
    ["Cyan", COL.cyan],
    ["Pink", COL.warnCore],
    ["Field", COL.fieldBolt],
  ] as const)
    for (let v = 0; v < BOLT_VARIANTS; v++)
      list.push(
        piece(
          `bolt${name}${v}`,
          BOLT.w,
          BOLT.h,
          0,
          BOLT.h / 2,
          1.25,
          bolt(col, 17 + v * 13 + name.length),
        ),
      );
  return list;
}

// ─────────────── layout (pure) ───────────────
/** A stable pseudo-random number in [0, 1) for a tick (flicker that repeats). */
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
export type PostState = "idle" | "charge" | "conduct";
/** Each post's state: conducting the live beam, charging under its warning, or idle. */
export function postStates(
  count: number,
  beamPost: number | undefined,
  warnPost: number | undefined,
): PostState[] {
  return Array.from({ length: count }, (_, i) =>
    i === beamPost ? "conduct" : i === warnPost ? "charge" : "idle",
  );
}
/** Where a post's orb is, for a post standing at (x, y). */
export const orbOf = (x: number, y: number) => ({ x, y: y + POST.orbY });
/** The live beam's danger band: the strip piece's height for an exact width. */
export const bandThickness = (width: number) => (width * 52) / 44;
/** Static field: which edge frame and its turn (still with reduced motion). */
export function fieldEdgeLook(t: number, i: number, reduced: boolean) {
  if (reduced) return { frame: "fieldEdge0", rot: i };
  return {
    frame: Math.floor(t * 9 + i) % 2 ? "fieldEdge1" : "fieldEdge0",
    rot: t * 0.25 + i,
  };
}
/** The three bolts turning inside a static field of radius r at (x, y). */
export function fieldBolts(x: number, y: number, r: number, t: number) {
  return [0, 1, 2].map((i) => {
    const a = (i * Math.PI * 2) / 3 + t * 0.4,
      d = r * 0.7;
    return {
      a: { x: x - Math.cos(a) * d, y: y - Math.sin(a) * d },
      b: { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d },
    };
  });
}
