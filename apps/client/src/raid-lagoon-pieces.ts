/**
 * Tidewyrm's Lagoon Court as painted pieces (raid-map-atlas.ts draws them
 * once into one atlas): sand islands with wet rims, foam lace and sunken
 * shadows, their cracks, the soaked look before they sink, the sandbank seen
 * through the water once sunk, the deep hole once gone, the High Tide flood,
 * surf, warning rim and rings, and the capacity pips.
 *
 * Pure Canvas 2D: each drawer takes (ctx, k), with ctx already scaled to
 * world units around the piece's anchor (k = texels per unit). Gameplay
 * edges keep their exact radii: the island's walkable edge at R (78, or 92
 * with Spring Tide), the High Tide ring at R + 10 and the over-capacity ring
 * at R + 3.
 */
import { TIDEWYRM } from "../../../packages/shared/src/raid";
import type { Ctx, MapPiece } from "./raid-map-atlas";

const TAU = Math.PI * 2;
type Pt = [number, number];
type Stops = [number, string][];

function rng(s: number) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const wob = (a: number, s: number) =>
  Math.sin(a * 3 + s) * 0.5 +
  Math.sin(a * 7 + s * 2.1) * 0.3 +
  Math.sin(a * 13 + s * 3.7) * 0.2;
const circ = (c: Ctx, x: number, y: number, r: number) => {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
};
const rad = (
  c: Ctx,
  x: number,
  y: number,
  r0: number,
  r1: number,
  stops: Stops,
) => {
  const g = c.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
};
const pathOf = (c: Ctx, pts: Pt[]) => {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
};

/** A web of caustic lines (jittered grid, curved links); alpha(x, y) shapes it. */
function causticNet(
  c: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cell: number,
  rnd: () => number,
  alpha: (x: number, y: number) => number,
  width: number,
) {
  const cols = Math.ceil((x1 - x0) / cell) + 1,
    rows = Math.ceil((y1 - y0) / cell) + 1,
    pts: Pt[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      pts.push([
        x0 + i * cell + (rnd() - 0.5) * cell * 0.8,
        y0 + j * cell + (rnd() - 0.5) * cell * 0.8,
      ]);
  c.lineCap = "round";
  const link = (a: Pt, b: Pt) => {
    const mx = (a[0] + b[0]) / 2,
      my = (a[1] + b[1]) / 2,
      al = alpha(mx, my);
    if (al <= 0.01) return;
    c.strokeStyle = `rgba(255,255,255,${al})`;
    c.lineWidth = width * (0.6 + rnd() * 0.8);
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.quadraticCurveTo(
      mx + (rnd() - 0.5) * cell * 0.5,
      my + (rnd() - 0.5) * cell * 0.5,
      b[0],
      b[1],
    );
    c.stroke();
  };
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const p = pts[j * cols + i];
      if (i + 1 < cols) link(p, pts[j * cols + i + 1]);
      if (j + 1 < rows) link(p, pts[(j + 1) * cols + i]);
    }
}
/** A jagged polyline through points. */
function jag(pts: Pt[], step: number, amp: number, rnd: () => number) {
  const out: Pt[] = [pts[0]];
  for (let s = 1; s < pts.length; s++) {
    const [ax, ay] = pts[s - 1],
      [bx, by] = pts[s],
      len = Math.hypot(bx - ax, by - ay),
      n = Math.max(1, Math.round(len / step));
    const nx = -(by - ay) / len,
      ny = (bx - ax) / len;
    for (let i = 1; i <= n; i++) {
      const u = i / n,
        j = i === n ? 0 : (rnd() - 0.5) * 2 * amp;
      out.push([ax + (bx - ax) * u + nx * j, ay + (by - ay) * u + ny * j]);
    }
  }
  return out;
}

/** Shallows around an island, the sand slope under water, and its contact shadow. */
function drawBase(c: Ctx, R: number) {
  const rnd = rng(R * 13 + 1);
  c.fillStyle = rad(c, 0, 0, R - 4, R + 46, [
    [0, "rgba(240,255,232,0.82)"],
    [0.12, "rgba(212,247,220,0.6)"],
    [0.38, "rgba(150,230,214,0.3)"],
    [1, "rgba(90,205,212,0)"],
  ]);
  circ(c, 0, 0, R + 46);
  c.fill();
  c.fillStyle = rad(c, 0, 0, R - 4, R + 30, [
    [0, "rgba(236,212,150,0.8)"],
    [0.45, "rgba(226,214,160,0.4)"],
    [1, "rgba(220,214,160,0)"],
  ]);
  circ(c, 0, 0, R + 30);
  c.fill();
  // Contact shadow under the water, cast to the lower right (sun from top left).
  c.save();
  c.translate(13, 18);
  c.scale(1, 0.94);
  c.fillStyle = rad(c, 0, 0, R * 0.8, R + 26, [
    [0, "rgba(3,40,56,0.62)"],
    [0.45, "rgba(3,40,56,0.3)"],
    [1, "rgba(3,40,56,0)"],
  ]);
  circ(c, 0, 0, R + 26);
  c.fill();
  c.restore();
  // Caustics on the sandy slope, brightest near the shore.
  causticNet(
    c,
    -R - 46,
    -R - 46,
    R + 46,
    R + 46,
    19,
    rnd,
    (x, y) => {
      const d = Math.hypot(x, y);
      if (d < R + 1 || d > R + 44) return 0;
      const lit = 0.6 + 0.4 * Math.cos(Math.atan2(y, x) + 2.4);
      return 0.3 * (1 - (d - R) / 44) * lit;
    },
    1.5,
  );
  // Sun glints on the lit side of the shallows.
  for (let i = 0; i < 26; i++) {
    const a = -2.4 + (rnd() - 0.5) * 2.2,
      d = R + 4 + rnd() * 30;
    c.fillStyle = `rgba(255,255,250,${0.35 + rnd() * 0.5})`;
    c.beginPath();
    c.ellipse(
      Math.cos(a) * d,
      Math.sin(a) * d,
      1 + rnd() * 2.2,
      0.6 + rnd() * 0.8,
      a + Math.PI / 2,
      0,
      TAU,
    );
    c.fill();
  }
}

/** The island itself: wet sand rim, dry lit top with wind ripples, grain and props. */
function drawBody(c: Ctx, R: number) {
  const rnd = rng(R * 7 + 3),
    seed = R * 0.37;
  // Wet sand out to exactly R (the walkable edge).
  c.fillStyle = rad(c, -0.3 * R, -0.35 * R, 0, 1.45 * R, [
    [0, "#c9a86c"],
    [0.6, "#b08d58"],
    [1, "#8d6e43"],
  ]);
  circ(c, 0, 0, R);
  c.fill();
  // Wet sheen on the sunny side of the rim.
  c.lineCap = "round";
  c.strokeStyle = "rgba(255,252,236,0.5)";
  c.lineWidth = 2.2;
  c.beginPath();
  c.arc(0, 0, R - 3.2, 3.45, 5.05);
  c.stroke();
  c.strokeStyle = "rgba(60,40,20,0.28)";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(0, 0, R - 2.5, 0.2, 2.6);
  c.stroke();
  // Dry top: an irregular mound a little inside the rim.
  const top: Pt[] = [];
  for (let a = 0; a < TAU; a += 0.04) {
    const rr = R - 8.5 + wob(a, seed) * 3;
    top.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  const topPath = () => {
    pathOf(c, top);
    c.closePath();
  };
  // Damp halo just outside the dry line.
  topPath();
  c.strokeStyle = "rgba(120,92,52,0.45)";
  c.lineWidth = 3.5;
  c.stroke();
  c.save();
  topPath();
  c.clip();
  c.fillStyle = rad(c, -0.32 * R, -0.4 * R, 0, 1.45 * R, [
    [0, "#fdf0c8"],
    [0.42, "#eed49d"],
    [0.8, "#d8b679"],
    [1, "#c29a5e"],
  ]);
  c.fillRect(-R, -R, 2 * R, 2 * R);
  // Damp patches.
  for (let i = 0; i < 4; i++) {
    c.fillStyle = "rgba(176,136,82,0.13)";
    c.beginPath();
    c.ellipse(
      (rnd() - 0.5) * R,
      (rnd() - 0.2) * R * 0.9,
      10 + rnd() * 16,
      5 + rnd() * 8,
      rnd() * 3,
      0,
      TAU,
    );
    c.fill();
  }
  // Wind ripples across the dune: a lit crest over a shaded trough.
  const ang = -0.38,
    ca = Math.cos(ang),
    sa = Math.sin(ang);
  for (let j = -7; j <= 7; j++) {
    const ph = rnd() * 6;
    for (const [off, col, lw] of [
      [1.6, "rgba(150,108,58,0.24)", 1.4],
      [0, "rgba(255,248,224,0.5)", 1.1],
    ] as [number, string, number][]) {
      c.beginPath();
      for (let u = -R; u <= R; u += 4) {
        const v = j * 11.5 + Math.sin(u * 0.075 + ph) * 3.2 + off;
        const x = u * ca - v * sa,
          y = u * sa + v * ca;
        if (u === -R) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.strokeStyle = col;
      c.lineWidth = lw;
      c.stroke();
    }
  }
  // Grain.
  const n = Math.round(R * R * 0.28);
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * 2 * R,
      y = (rnd() - 0.5) * 2 * R,
      light = rnd() < 0.5;
    c.fillStyle = light
      ? `rgba(255,250,228,${0.2 + rnd() * 0.35})`
      : `rgba(128,92,50,${0.12 + rnd() * 0.25})`;
    c.fillRect(x, y, 0.6 + rnd() * 0.9, 0.6 + rnd() * 0.9);
  }
  // Rounded shoulder: darker toward the rim, darkest on the lower right.
  c.fillStyle = rad(c, 0, 0, R - 36, R - 7, [
    [0, "rgba(120,80,40,0)"],
    [1, "rgba(112,76,38,0.32)"],
  ]);
  c.fillRect(-R, -R, 2 * R, 2 * R);
  c.fillStyle = rad(c, -0.25 * R, -0.3 * R, R * 0.6, R * 1.25, [
    [0, "rgba(90,60,30,0)"],
    [1, "rgba(90,60,30,0.22)"],
  ]);
  c.fillRect(-R, -R, 2 * R, 2 * R);
  c.restore();
  // Pebbles.
  const pebble = (x: number, y: number, r: number, sq: number) => {
    c.fillStyle = "rgba(70,45,20,0.32)";
    c.beginPath();
    c.ellipse(x + 1.3, y + 1.6, r * 1.05, r * sq, 0, 0, TAU);
    c.fill();
    c.fillStyle = rad(c, x - r * 0.4, y - r * 0.45, 0, r * 1.4, [
      [0, "#e4ddcf"],
      [0.5, "#9b9183"],
      [1, "#5f574c"],
    ]);
    c.beginPath();
    c.ellipse(x, y, r, r * sq, 0, 0, TAU);
    c.fill();
  };
  pebble(-R * 0.42, -R * 0.08, 3.6, 0.78);
  pebble(-R * 0.36, -R * 0.0, 2.2, 0.8);
  pebble(R * 0.12, R * 0.5, 3, 0.75);
  pebble(R * 0.5, R * 0.18, 2.6, 0.8);
  pebble(-R * 0.05, -R * 0.55, 2.2, 0.8);
  // Shell, where the flat drawing had its pink shell (x - 30, y + 28).
  c.save();
  c.translate(-30, 28);
  c.rotate(-0.35);
  c.fillStyle = "rgba(80,45,30,0.3)";
  c.beginPath();
  c.ellipse(1.6, 2.2, 8.5, 6, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.moveTo(0, 5);
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + 0.45 + (i / 8) * (Math.PI - 0.9);
    c.lineTo(Math.cos(a) * 9.5, 5 + Math.sin(a) * 9.5 - (i % 2 ? 0 : 0.8));
  }
  c.closePath();
  c.fillStyle = rad(c, -2, -3, 0, 11, [
    [0, "#fff1f6"],
    [0.55, "#ffc9de"],
    [1, "#d68aa8"],
  ]);
  c.fill();
  c.strokeStyle = "rgba(170,90,120,0.55)";
  c.lineWidth = 0.8;
  for (let i = 1; i < 8; i++) {
    const a = Math.PI + 0.45 + (i / 8) * (Math.PI - 0.9);
    c.beginPath();
    c.moveTo(0, 5);
    c.lineTo(Math.cos(a) * 8.6, 5 + Math.sin(a) * 8.6);
    c.stroke();
  }
  c.fillStyle = "#e9a4bf";
  c.fillRect(-2.6, 3.6, 5.2, 2.6);
  c.restore();
  // Starfish.
  c.save();
  c.translate(R * 0.3, R * 0.36);
  c.rotate(0.5);
  const star = () => {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        r = i % 2 ? 2.2 : 6;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
  };
  c.save();
  c.translate(1.2, 1.6);
  star();
  c.fillStyle = "rgba(80,40,20,0.3)";
  c.fill();
  c.restore();
  star();
  c.fillStyle = rad(c, -1.5, -1.5, 0, 7, [
    [0, "#ffc08a"],
    [1, "#e0683f"],
  ]);
  c.fill();
  c.fillStyle = "rgba(255,236,210,0.8)";
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 5;
    c.fillRect(Math.cos(a) * 3.2 - 0.4, Math.sin(a) * 3.2 - 0.4, 0.9, 0.9);
  }
  c.restore();
  // Beach grass where the flat drawing's tuft stood (x + 22..38, y - 40..-16).
  c.fillStyle = "rgba(90,60,28,0.28)";
  c.beginPath();
  c.ellipse(36, -13, 15, 5, 0.2, 0, TAU);
  c.fill();
  const blades = [
    [23, -16, -5, -21],
    [26, -17, -1, -25],
    [29, -16, 2, -27],
    [31, -17, 6, -22],
    [34, -16, 9, -19],
    [27, -15, -8, -14],
    [36, -15, 12, -12],
    [30, -15, 0, -18],
  ];
  for (const [bx, by, dx, dy] of blades) {
    const tx = bx + dx,
      ty = by + dy;
    c.beginPath();
    c.moveTo(bx - 1.6, by);
    c.quadraticCurveTo(bx + dx * 0.25 - 1, by + dy * 0.6, tx, ty);
    c.quadraticCurveTo(bx + dx * 0.25 + 1.2, by + dy * 0.6, bx + 1.6, by);
    c.closePath();
    const g = c.createLinearGradient(bx, by, tx, ty);
    g.addColorStop(0, "#2c6a43");
    g.addColorStop(0.6, "#5aa863");
    g.addColorStop(1, "#b5e08e");
    c.fillStyle = g;
    c.fill();
  }
}

/** Lacy foam exactly on the shore line (straddles R). Two seeds cross-fade. */
function drawFoam(c: Ctx, R: number, seed: number) {
  const rnd = rng(seed);
  const thick = (a: number) =>
    1.8 + 3.4 * Math.max(0, wob(a * 1.3, seed) + 0.25);
  c.lineCap = "round";
  c.strokeStyle = "rgba(255,255,255,0.2)";
  c.lineWidth = 10;
  circ(c, 0, 0, R + 3);
  c.stroke();
  // The band: thicker in clumps, thinner between.
  for (let a = 0; a < TAU; a += 0.02) {
    const rr = R + 1 + wob(a, seed + 1) * 1.2;
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.lineWidth = thick(a);
    c.beginPath();
    c.arc(0, 0, rr, a, a + 0.03);
    c.stroke();
  }
  // Bubbles bunch where the band is thick and spill outward.
  const n = Math.round(TAU * R * 1.1);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU,
      th = thick(a);
    if (rnd() > th / 5.5) continue;
    const rr = R + 1 + (rnd() - 0.3) * th * 2,
      s = 0.5 + rnd() * 1.5;
    c.fillStyle = `rgba(255,255,255,${0.55 + rnd() * 0.45})`;
    circ(c, Math.cos(a) * rr, Math.sin(a) * rr, s);
    c.fill();
  }
  // Punch lace holes into the band.
  c.globalCompositeOperation = "destination-out";
  for (let i = 0; i < n * 0.45; i++) {
    const a = rnd() * TAU,
      rr = R + 1 + (rnd() - 0.5) * thick(a) * 0.8;
    c.fillStyle = `rgba(0,0,0,${0.5 + rnd() * 0.4})`;
    circ(c, Math.cos(a) * rr, Math.sin(a) * rr, 0.5 + rnd() * 1.1);
    c.fill();
  }
  c.globalCompositeOperation = "source-over";
  // Trailing foam lines a little way out.
  for (let i = 0; i < 22; i++) {
    const a = rnd() * TAU,
      rr = R + 6 + rnd() * 7;
    c.strokeStyle = `rgba(255,255,255,${0.22 + rnd() * 0.3})`;
    c.lineWidth = 0.8 + rnd() * 0.8;
    c.beginPath();
    c.arc(0, 0, rr, a, a + 0.06 + rnd() * 0.22);
    c.stroke();
  }
  // Foam on the shaded side is a little blue.
  c.strokeStyle = "rgba(60,140,175,0.25)";
  c.lineWidth = 7;
  c.beginPath();
  c.arc(0, 0, R + 2.5, -0.2, 1.9);
  c.stroke();
}

/** High Tide surf breaking round the shore at R + 10 (the flat drawing's foam ring). */
function drawSurf(c: Ctx, R: number) {
  const rnd = rng(R + 99);
  c.lineCap = "round";
  c.strokeStyle = "rgba(20,110,140,0.3)";
  c.lineWidth = 5;
  circ(c, 1.5, 3, R + 13);
  c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.32)";
  c.lineWidth = 12;
  circ(c, 0, 0, R + 10);
  c.stroke();
  c.beginPath();
  for (let a = 0; a <= TAU + 0.01; a += 0.03) {
    const rr = R + 10 + wob(a, 4.1) * 2;
    if (a === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.strokeStyle = "rgba(255,255,255,0.85)";
  c.lineWidth = 4.5;
  c.stroke();
  for (let i = 0; i < Math.round((TAU * R) / 1.8); i++) {
    const a = rnd() * TAU,
      rr = R + 3 + rnd() * 16;
    c.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.6})`;
    circ(c, Math.cos(a) * rr, Math.sin(a) * rr, 0.6 + rnd() * 2);
    c.fill();
  }
}

/** A thin broken ring of radius 100 (scaled per frame) for ripples and bursts. */
function drawRipple(c: Ctx) {
  const rnd = rng(5);
  c.lineCap = "round";
  c.strokeStyle = "rgba(255,255,255,0.16)";
  c.lineWidth = 6;
  circ(c, 0, 0, 100);
  c.stroke();
  for (let a = 0; a < TAU;) {
    const len = 0.2 + rnd() * 0.45;
    c.strokeStyle = `rgba(255,255,255,${0.6 + rnd() * 0.35})`;
    c.lineWidth = 2 + rnd() * 1.2;
    c.beginPath();
    c.arc(0, 0, 100, a, Math.min(TAU, a + len));
    c.stroke();
    a += len + 0.04 + rnd() * 0.12;
  }
}

/** A four-point sun glint (drawn additive, over water). */
function drawGlint(c: Ctx) {
  c.fillStyle = rad(c, 0, 0, 0, 7, [
    [0, "rgba(255,255,255,1)"],
    [0.3, "rgba(255,255,240,0.6)"],
    [1, "rgba(255,255,240,0)"],
  ]);
  circ(c, 0, 0, 7);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.9)";
  c.beginPath();
  c.ellipse(0, 0, 9, 0.9, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.ellipse(0, 0, 0.9, 6, 0, 0, TAU);
  c.fill();
}

/** The crack's main line for island i, crack ci, along the flat drawing's own lines. */
function crackLine(R: number, i: number, ci: number) {
  const rnd = rng(i * 31 + ci * 7 + R);
  const a = ci * 2.2 + i;
  const p0: Pt = [Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2];
  const p1: Pt = [
    p0[0] + Math.cos(a) * R * 0.45,
    p0[1] + Math.sin(a) * R * 0.45,
  ];
  const p2: Pt = [
    p0[0] + Math.cos(a + 0.6) * R * 0.8,
    p0[1] + Math.sin(a + 0.6) * R * 0.8,
  ];
  return { rnd, pts: jag([p0, p1, p2], 4.5, 1.6, rnd) };
}
/** The box (island coordinates) a crack's drawing fits in. */
export function crackBox(R: number, i: number, ci: number) {
  const { pts } = crackLine(R, i, ci);
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const m = 18;
  const x0 = Math.max(-R, Math.floor(Math.min(...xs) - m)),
    y0 = Math.max(-R, Math.floor(Math.min(...ys) - m)),
    x1 = Math.min(R, Math.ceil(Math.max(...xs) + m)),
    y1 = Math.min(R, Math.ceil(Math.max(...ys) + m));
  return { x0, y0, w: x1 - x0, h: y1 - y0 };
}
function drawCrack(
  c: Ctx,
  R: number,
  ci: number,
  line: ReturnType<typeof crackLine>,
) {
  const { rnd, pts } = line;
  const n = pts.length - 1;
  // Width along the crack: hairline at the ends, widest a third of the way.
  const wAt = (s: number) =>
    0.5 + 4.2 * Math.pow(Math.sin(Math.PI * Math.min(1, (s / n) * 1.25)), 0.7);
  const tapered = (
    dx: number,
    dy: number,
    mul: number,
    add: number,
    style: string,
  ) => {
    c.strokeStyle = style;
    for (let s = 0; s < n; s++) {
      c.lineWidth = wAt(s + 0.5) * mul + add;
      c.beginPath();
      c.moveTo(pts[s][0] + dx, pts[s][1] + dy);
      c.lineTo(pts[s + 1][0] + dx, pts[s + 1][1] + dy);
      c.stroke();
    }
  };
  c.save();
  circ(c, 0, 0, R - 3);
  c.clip();
  c.lineCap = "round";
  c.lineJoin = "round";
  // Damp sand around it, then the lit lip, the shaded wall and the dark gap.
  tapered(0, 0, 1, 9, "rgba(112,80,42,0.16)");
  tapered(0, 0, 1, 4, "rgba(104,74,40,0.22)");
  tapered(-1.2, -1.2, 1, 1.4, "rgba(255,246,214,0.7)");
  tapered(0.5, 0.6, 1, 0.6, "#7a5a33");
  tapered(0, 0, 0.85, 0, "#3a2611");
  tapered(
    0.3,
    0.3,
    0.38,
    0,
    ci ? "rgba(52,120,130,0.85)" : "rgba(40,78,84,0.8)",
  );
  // Hairline branches, tapered.
  for (let b = 0; b < 3; b++) {
    const s = 2 + Math.floor(rnd() * (n - 4)),
      [sx, sy] = pts[s],
      [nx, ny] = pts[s + 1];
    const d =
        Math.atan2(ny - sy, nx - sx) +
        (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.6),
      len = 6 + rnd() * 7;
    const br = jag(
      [
        [sx, sy],
        [sx + Math.cos(d) * len, sy + Math.sin(d) * len],
      ],
      2.5,
      0.7,
      rnd,
    );
    for (let j = 0; j < br.length - 1; j++) {
      const w = 1.5 * (1 - j / (br.length - 1)) + 0.3;
      c.strokeStyle = "rgba(255,246,214,0.5)";
      c.lineWidth = w + 0.8;
      c.beginPath();
      c.moveTo(br[j][0] - 0.7, br[j][1] - 0.7);
      c.lineTo(br[j + 1][0] - 0.7, br[j + 1][1] - 0.7);
      c.stroke();
      c.strokeStyle = "rgba(70,46,22,0.85)";
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(br[j][0], br[j][1]);
      c.lineTo(br[j + 1][0], br[j + 1][1]);
      c.stroke();
    }
  }
  // Crumbs kicked up along the edges.
  for (let j = 0; j < 16; j++) {
    const [x, y] = pts[Math.floor(rnd() * pts.length)];
    c.fillStyle = rnd() < 0.5 ? "rgba(96,66,34,0.6)" : "rgba(250,236,200,0.75)";
    c.fillRect(
      x + (rnd() - 0.5) * 9,
      y + (rnd() - 0.5) * 9,
      0.8 + rnd(),
      0.8 + rnd(),
    );
  }
  c.restore();
}

/** After the second strand: water soaks in from the rim (it is about to sink). */
function drawSoggy(c: Ctx, R: number) {
  c.fillStyle = rad(c, 0, 0, R - 38, R - 2, [
    [0, "rgba(96,74,44,0)"],
    [0.6, "rgba(96,74,44,0.26)"],
    [1, "rgba(62,78,76,0.5)"],
  ]);
  circ(c, 0, 0, R - 1);
  c.fill();
  // A ragged damp front creeping inward, made of soft blotches.
  const rnd = rng(R + 17);
  for (let i = 0; i < 70; i++) {
    const a = rnd() * TAU,
      d = R - 8 - rnd() * (12 + 8 * (wob(a, 2) + 1)),
      r = 2 + rnd() * 5;
    c.fillStyle = rad(c, Math.cos(a) * d, Math.sin(a) * d, 0, r, [
      [0, "rgba(88,68,40,0.28)"],
      [1, "rgba(88,68,40,0)"],
    ]);
    circ(c, Math.cos(a) * d, Math.sin(a) * d, r);
    c.fill();
  }
  // Wet shine on the sunny side.
  c.strokeStyle = "rgba(220,250,255,0.35)";
  c.lineWidth = 1.4;
  c.lineCap = "round";
  c.beginPath();
  c.arc(0, 0, R - 13, 3.6, 4.6);
  c.stroke();
}

/** Sunk until next chapter: the sandbank seen through the water, edge dashed. */
function drawSunk(c: Ctx, R: number) {
  const rnd = rng(R + 41);
  c.fillStyle = rad(c, 0, 0, 0, R + 16, [
    [0, "rgba(242,228,176,0.55)"],
    [0.6, "rgba(214,216,168,0.42)"],
    [0.86, "rgba(160,226,206,0.24)"],
    [1, "rgba(120,215,215,0)"],
  ]);
  circ(c, 0, 0, R + 16);
  c.fill();
  c.save();
  circ(c, 0, 0, R - 4);
  c.clip();
  for (let j = -6; j <= 6; j++) {
    c.beginPath();
    for (let u = -R; u <= R; u += 5) {
      const v = j * 12 + Math.sin(u * 0.07 + j) * 3;
      const x = u * 0.93 + v * 0.37,
        y = -u * 0.37 + v * 0.93;
      if (u === -R) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.strokeStyle = "rgba(255,250,228,0.2)";
    c.lineWidth = 1.2;
    c.stroke();
  }
  c.restore();
  // Seaweed where the grass was; the shell, blurred by water.
  c.lineCap = "round";
  for (let s = 0; s < 4; s++) {
    c.strokeStyle = "rgba(40,118,92,0.45)";
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(24 + s * 4, -16);
    c.bezierCurveTo(20 + s * 4, -24, 30 + s * 4, -30, 26 + s * 5, -38 + s);
    c.stroke();
  }
  c.fillStyle = "rgba(255,210,226,0.35)";
  c.beginPath();
  c.ellipse(-30, 27, 7, 5, -0.35, 0, TAU);
  c.fill();
  causticNet(
    c,
    -R - 10,
    -R - 10,
    R + 10,
    R + 10,
    15,
    rnd,
    (x, y) => {
      const d = Math.hypot(x, y);
      return d > R + 6 ? 0 : 0.3 * (1 - (d / (R + 6)) * 0.5);
    },
    1.2,
  );
  // Where the dry edge was, and the "comes back" rings (0.7 R sand, 0.35 R).
  c.setLineDash([10, 7]);
  c.strokeStyle = "rgba(226,252,246,0.6)";
  c.lineWidth = 2.6;
  circ(c, 0, 0, R);
  c.stroke();
  c.setLineDash([]);
  c.strokeStyle = "rgba(225,200,140,0.32)";
  c.lineWidth = 2;
  circ(c, 0, 0, R * 0.7);
  c.stroke();
  c.strokeStyle = "rgba(226,252,246,0.5)";
  c.lineWidth = 2;
  circ(c, 0, 0, R * 0.35);
  c.stroke();
}

/** Sunk for good (Peril 3): a dark deep hole with rubble, no way back. */
function drawGone(c: Ctx, R: number) {
  const rnd = rng(R + 63);
  c.fillStyle = rad(c, 0, 0, 0, R + 18, [
    [0, "rgba(3,36,54,0.72)"],
    [0.62, "rgba(5,52,72,0.5)"],
    [1, "rgba(8,70,90,0)"],
  ]);
  circ(c, 0, 0, R + 18);
  c.fill();
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU,
      d = R * (0.2 + rnd() * 0.75),
      x = Math.cos(a) * d,
      y = Math.sin(a) * d,
      r = 3 + rnd() * 6;
    c.fillStyle = "rgba(10,40,52,0.45)";
    c.beginPath();
    c.ellipse(x + 1.5, y + 2, r, r * 0.7, 0, 0, TAU);
    c.fill();
    c.fillStyle = "rgba(70,120,124,0.42)";
    c.beginPath();
    c.ellipse(x, y, r, r * 0.7, rnd(), 0, TAU);
    c.fill();
    c.fillStyle = "rgba(170,215,210,0.22)";
    c.beginPath();
    c.ellipse(x - r * 0.3, y - r * 0.3, r * 0.45, r * 0.25, 0, 0, TAU);
    c.fill();
  }
  c.setLineDash([4, 14]);
  c.strokeStyle = "rgba(217,245,240,0.26)";
  c.lineWidth = 2;
  circ(c, 0, 0, R);
  c.stroke();
  c.setLineDash([]);
}

/** The flood's size: the floor inside the walls (36 from each edge). */
export const FLOOD = { x: 36, y: 36, w: 1528, h: 828 };
/** High Tide water over the floor: one soft quad, deeper at the walls. */
function drawFlood(c: Ctx) {
  const rnd = rng(77),
    { w, h } = FLOOD;
  c.save();
  c.beginPath();
  c.roundRect(0, 0, w, h, 40);
  c.clip();
  c.fillStyle = "rgba(64,190,222,0.3)";
  c.fillRect(0, 0, w, h);
  c.fillStyle = rad(c, w / 2, h / 2, 120, 900, [
    [0, "rgba(160,245,250,0.12)"],
    [1, "rgba(8,74,116,0.32)"],
  ]);
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    c.fillStyle = `rgba(225,250,255,${0.05 + rnd() * 0.08})`;
    c.beginPath();
    c.ellipse(
      rnd() * w,
      rnd() * h,
      60 + rnd() * 160,
      5 + rnd() * 10,
      (rnd() - 0.5) * 0.3,
      0,
      TAU,
    );
    c.fill();
  }
  c.restore();
}

/** Two rows of rolling swell crests (the flat drawing's 18 px arcs every 180 px). */
function drawSwell(c: Ctx) {
  c.lineCap = "round";
  const crest = (x: number, y: number) => {
    const a0 = Math.PI * 1.15,
      a1 = Math.PI * 1.85;
    c.strokeStyle = "rgba(20,110,150,0.32)";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(x, y + 3.5, 16, a0, a1);
    c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.2)";
    c.lineWidth = 8;
    c.beginPath();
    c.arc(x, y, 18, a0, a1);
    c.stroke();
    c.strokeStyle = "rgba(250,255,255,0.92)";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(x, y, 18, a0 + 0.06, a1 - 0.06);
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.8)";
    circ(c, x + Math.cos(a1) * 18, y + Math.sin(a1) * 18, 1.6);
    c.fill();
    circ(c, x + Math.cos(a1) * 22 + 2, y + Math.sin(a1) * 22 + 3, 1);
    c.fill();
  };
  for (let j = 0; j < 9; j++) crest(90 + j * 180, 24);
  for (let j = 0; j < 10; j++) crest(j * 180, 82);
}

function drawPip(c: Ctx, on: boolean) {
  c.fillStyle = "rgba(0,0,0,0.35)";
  circ(c, 0.8, 1.4, 7);
  c.fill();
  if (on) {
    c.fillStyle = rad(c, -2, -2.4, 0, 8, [
      [0, "#fffbd8"],
      [0.4, "#ffd65b"],
      [1, "#b47c10"],
    ]);
    circ(c, 0, 0, 6.5);
    c.fill();
    c.strokeStyle = "rgba(90,52,0,0.9)";
    c.lineWidth = 1.2;
    circ(c, 0, 0, 6.5);
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.beginPath();
    c.ellipse(-2, -2.6, 2.2, 1.2, -0.6, 0, TAU);
    c.fill();
  } else {
    c.fillStyle = rad(c, 1, 1.4, 0, 7, [
      [0, "#1a2c48"],
      [1, "#0a1628"],
    ]);
    circ(c, 0, 0, 6.5);
    c.fill();
    c.strokeStyle = "rgba(230,240,255,0.55)";
    c.lineWidth = 1.3;
    circ(c, 0, 0, 6.5);
    c.stroke();
  }
}
/** A crisp ring at an exact radius (gameplay edges), with a dark underline for contrast. */
function drawRing(c: Ctx, r: number, w: number, col: string, shade: string) {
  c.strokeStyle = shade;
  c.lineWidth = w + 2.5;
  circ(c, 0, 0, r);
  c.stroke();
  c.strokeStyle = col;
  c.lineWidth = w;
  circ(c, 0, 0, r);
  c.stroke();
}
/** Soft light band around a ring (drawn additive: light falling on sand and water). */
function drawRingGlow(c: Ctx, r: number, rgb: string) {
  c.fillStyle = rad(c, 0, 0, r - 14, r + 16, [
    [0, `rgba(${rgb},0)`],
    [0.47, `rgba(${rgb},0.5)`],
    [1, `rgba(${rgb},0)`],
  ]);
  circ(c, 0, 0, r + 16);
  c.fill();
}
/** High Tide's "stand here" arrow, tip at the anchor (the flat drawing's triangle). */
function drawChevron(c: Ctx) {
  c.fillStyle = "rgba(255,214,91,0.35)";
  c.beginPath();
  c.ellipse(0, -7, 15, 12, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.moveTo(-9, -14);
  c.lineTo(9, -14);
  c.lineTo(0, 0);
  c.closePath();
  c.lineJoin = "round";
  c.strokeStyle = "rgba(70,40,0,0.9)";
  c.lineWidth = 3;
  c.stroke();
  const g = c.createLinearGradient(-9, -14, 6, 0);
  g.addColorStop(0, "#fff6c0");
  g.addColorStop(0.45, "#ffd65b");
  g.addColorStop(1, "#d39a1c");
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = "rgba(255,255,255,0.8)";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(-7, -12.6);
  c.lineTo(7, -12.6);
  c.stroke();
}
/** Rim pieces for the High Tide warning: glow strip, crisp line strip, a corner. */
function drawRimGlow(c: Ctx) {
  const g = c.createLinearGradient(0, 0, 0, 40);
  g.addColorStop(0, "rgba(150,240,255,0.62)");
  g.addColorStop(0.45, "rgba(127,233,255,0.24)");
  g.addColorStop(1, "rgba(127,233,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 40);
}
function drawRimLine(c: Ctx) {
  c.fillStyle = "rgba(4,40,60,0.35)";
  c.fillRect(0, 1.5, 64, 3.5);
  c.fillStyle = "rgba(127,233,255,0.95)";
  c.fillRect(0, -2, 64, 4);
  c.fillStyle = "rgba(235,252,255,0.8)";
  c.fillRect(0, -1.6, 64, 1);
}
function drawRimCorner(c: Ctx) {
  c.save();
  c.beginPath();
  c.moveTo(0, 0);
  c.arc(0, 0, 42, Math.PI, Math.PI * 1.5);
  c.closePath();
  c.clip();
  c.fillStyle = rad(c, 0, 0, 0, 40, [
    [0, "rgba(127,233,255,0)"],
    [0.55, "rgba(127,233,255,0.24)"],
    [1, "rgba(150,240,255,0.62)"],
  ]);
  circ(c, 0, 0, 40);
  c.fill();
  c.restore();
  c.lineCap = "butt";
  c.strokeStyle = "rgba(4,40,60,0.35)";
  c.lineWidth = 3.5;
  c.beginPath();
  c.arc(0, 0, 37, Math.PI, Math.PI * 1.5);
  c.stroke();
  c.strokeStyle = "rgba(127,233,255,0.95)";
  c.lineWidth = 4;
  c.beginPath();
  c.arc(0, 0, 40, Math.PI, Math.PI * 1.5);
  c.stroke();
}
function drawDrop(c: Ctx) {
  c.fillStyle = rad(c, -0.8, -0.8, 0, 3.2, [
    [0, "rgba(255,255,255,1)"],
    [0.5, "rgba(214,246,255,0.92)"],
    [1, "rgba(120,205,232,0.7)"],
  ]);
  circ(c, 0, 0, 3);
  c.fill();
}

/** Every island piece's name for radius R. */
export const lagoonName = {
  base: (R: number) => `base${R}`,
  body: (R: number) => `body${R}`,
  foamA: (R: number) => `foamA${R}`,
  foamB: (R: number) => `foamB${R}`,
  surf: (R: number) => `surf${R}`,
  soggy: (R: number) => `soggy${R}`,
  sunk: (R: number) => `sunk${R}`,
  gone: (R: number) => `gone${R}`,
  crack: (R: number, i: number, ci: number) => `crack${R}_${i}_${ci}`,
  gold: (R: number) => `gold${R}`,
  goldGlow: (R: number) => `goldGlow${R}`,
  red: (R: number) => `red${R}`,
  redGlow: (R: number) => `redGlow${R}`,
};
/** Island radii a lagoon might use: the plain one and Spring Tide's. */
export const ISLAND_RADII = [
  TIDEWYRM.islandRadius,
  TIDEWYRM.springIslandRadius,
];

/** The Lagoon Court's pieces for islands of radius R. */
export function lagoonPieces(R: number): MapPiece[] {
  const P: MapPiece[] = [];
  const add = (
    name: string,
    w: number,
    h: number,
    draw: (c: Ctx) => void,
    o: { ax?: number; ay?: number; res?: number } = {},
  ) => P.push({ name, w, h, draw, ...o });
  const N = lagoonName;
  const B = R + 50;
  // Soft washes (shallows, soaking, the deep hole) at lower density.
  add(N.base(R), 2 * B, 2 * B, (c) => drawBase(c, R), { res: 0.75 });
  add(N.body(R), 2 * R + 2, 2 * R + 2, (c) => drawBody(c, R));
  add(N.foamA(R), 2 * R + 26, 2 * R + 26, (c) => drawFoam(c, R, 11));
  add(N.foamB(R), 2 * R + 26, 2 * R + 26, (c) => drawFoam(c, R, 23));
  add(N.surf(R), 2 * R + 46, 2 * R + 46, (c) => drawSurf(c, R));
  add(N.soggy(R), 2 * R, 2 * R, (c) => drawSoggy(c, R), { res: 0.5 });
  add(N.sunk(R), 2 * R + 34, 2 * R + 34, (c) => drawSunk(c, R));
  add(N.gone(R), 2 * R + 38, 2 * R + 38, (c) => drawGone(c, R), { res: 0.5 });
  // Each crack only as big as its own lines (the island's centre is its anchor).
  for (let i = 0; i < TIDEWYRM.islands.length; i++)
    for (let ci = 0; ci < 2; ci++) {
      const box = crackBox(R, i, ci);
      add(
        N.crack(R, i, ci),
        box.w,
        box.h,
        (c) => drawCrack(c, R, ci, crackLine(R, i, ci)),
        {
          ax: -box.x0,
          ay: -box.y0,
        },
      );
    }
  add(N.gold(R), 2 * R + 30, 2 * R + 30, (c) =>
    drawRing(c, R + 10, 4, "#ffd65b", "rgba(70,40,0,0.45)"),
  );
  add(
    N.goldGlow(R),
    2 * R + 56,
    2 * R + 56,
    (c) => drawRingGlow(c, R + 10, "255,214,91"),
    {
      res: 0.5,
    },
  );
  add(N.red(R), 2 * R + 18, 2 * R + 18, (c) =>
    drawRing(c, R + 3, 4, "#ff4059", "rgba(60,0,10,0.5)"),
  );
  add(
    N.redGlow(R),
    2 * R + 42,
    2 * R + 42,
    (c) => drawRingGlow(c, R + 3, "255,64,89"),
    {
      res: 0.5,
    },
  );
  add("ripple", 210, 210, drawRipple);
  add("glint", 20, 14, drawGlint);
  add("pipOn", 18, 18, (c) => drawPip(c, true), { ax: 8, ay: 8 });
  add("pipOff", 18, 18, (c) => drawPip(c, false), { ax: 8, ay: 8 });
  add("chevron", 34, 30, drawChevron, { ax: 17, ay: 23 });
  add("drop", 8, 8, drawDrop);
  add("rimGlow", 64, 40, drawRimGlow, { ax: 0, ay: 0 });
  add("rimLine", 64, 8, drawRimLine, { ax: 0, ay: 3 });
  add("rimCorner", 44, 44, drawRimCorner, { ax: 42, ay: 42 });
  add("swell", 1660, 110, drawSwell, { ax: 22, ay: 0, res: 0.5 });
  add("flood", FLOOD.w, FLOOD.h, drawFlood, { ax: 0, ay: 0, res: 0.25 });
  return P;
}
