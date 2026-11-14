/**
 * Inkpurr's two signature effects, drawn into the raid's own graphics layers
 * (no scene objects of their own, no images, no glows):
 *
 * - the snuff's tendril: ink reaching out of its paw to the lantern,
 *   coiling round the lamp and squeezing as the warning's timer runs, then
 *   letting go;
 * - the ink lunge: a streak of ink with a claw head racing down the lane
 *   the moment the lunge lands, leaving one splat.
 *
 * The warnings themselves (lane, lantern edge and timer) are unchanged and
 * drawn by raid-gloomshade-art.ts and the yard; these only dress them.
 */
import type Phaser from "phaser";

type G = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };
const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const INK = 0x07030f,
  INK_BODY = 0x2a1f62,
  INK_LIT = 0xb4aaff,
  CLAW_EYE = 0xffd982;

/** Seconds the tendril takes to reach the lamp, and to let go after the snuff. */
export const TENDRIL_REACH = 0.5;
export const TENDRIL_LET_GO = 0.3;
/** How long the lunge's streak shows, and its splat. */
export const STREAK_SECONDS = 0.9;
export const SPLAT_SECONDS = 2.2;

/** A point on a quadratic curve. */
const qb = (a: Pt, b: Pt, c: Pt, t: number) => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * b.x + t * t * c.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * b.y + t * t * c.y,
});
function stroke(g: G, pts: Pt[], width: number, color: number, alpha: number) {
  if (pts.length < 2) return;
  g.lineStyle(width, color, alpha).beginPath().moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.strokePath();
}
/** Points round an ellipse (rotated), from a0 to a1. */
function arc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot: number,
  a0 = 0,
  a1 = TAU,
  n = 24,
) {
  const c = Math.cos(rot),
    s = Math.sin(rot),
    out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n,
      x = Math.cos(a) * rx,
      y = Math.sin(a) * ry;
    out.push({ x: cx + x * c - y * s, y: cy + x * s + y * c });
  }
  return out;
}

/**
 * The snuff's tendril this frame. `age` counts from the warning's start,
 * `left` is the time until it lands (negative after: letting go).
 */
export function drawTendril(
  g: G,
  from: Pt,
  lamp: Pt,
  age: number,
  total: number,
  left: number,
  clock: number,
  reduced: boolean,
  low: boolean,
) {
  const reach =
    left >= 0
      ? smooth(0, Math.min(TENDRIL_REACH, total * 0.4), age)
      : 1 - smooth(0, TENDRIL_LET_GO, -left);
  if (reach <= 0.01) return;
  const mid = { x: (from.x + lamp.x) / 2, y: Math.min(from.y, lamp.y) - 70 };
  const pts: Pt[] = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * reach,
      w = reduced ? 0 : Math.sin(t * 9 - clock * 6) * 5 * (1 - t);
    const q = qb(from, mid, lamp, t),
      q2 = qb(from, mid, lamp, Math.min(1, t + 0.02)),
      d = Math.hypot(q2.x - q.x, q2.y - q.y) || 1;
    pts.push({
      x: q.x - ((q2.y - q.y) / d) * w,
      y: q.y + ((q2.x - q.x) / d) * w,
    });
  }
  stroke(g, pts, 15, INK, 0.95);
  stroke(g, pts, 10.5, INK_BODY, 1);
  if (!low)
    stroke(
      g,
      pts.map((p) => ({ x: p.x - 2, y: p.y - 2.5 })),
      2.4,
      INK_LIT,
      0.6,
    );
  // coiled round the lamp, squeezing as the timer runs
  if (reach > 0.98 && left >= -0.05) {
    const sq =
      1 -
      0.32 *
        clamp((age - TENDRIL_REACH) / Math.max(0.1, total - TENDRIL_REACH));
    for (const [oy, ph] of [
      [-8, 0],
      [5, 0.13],
    ]) {
      const ring = arc(
        lamp.x,
        lamp.y + oy,
        20 * sq,
        7,
        0,
        0.05 * Math.PI + ph,
        0.95 * Math.PI + ph,
        16,
      );
      stroke(g, ring, 9, INK, 0.95);
      stroke(g, ring, 5.5, 0x2c2066, 1);
      if (!low) stroke(g, ring, 1.6, INK_LIT, 0.55);
    }
    // a little paw clutching the lamp's crown
    g.fillStyle(INK, 0.95).fillCircle(lamp.x + 2, lamp.y - 18, 9);
    g.fillStyle(0x3a2c80, 1).fillCircle(lamp.x + 2, lamp.y - 18, 7.2);
    g.fillStyle(0xf0ecff, 0.85).fillCircle(lamp.x - 0.5, lamp.y - 20.5, 1.8);
  }
}

/** The ink claw at a streak's head, pointing along `ang`. */
function claw(g: G, x: number, y: number, ang: number, s: number, a: number) {
  const c = Math.cos(ang),
    sn = Math.sin(ang);
  const P = (px: number, py: number) => ({
    x: x + (px * c - py * sn) * s,
    y: y + (px * sn + py * c) * s,
  });
  g.fillStyle(INK, 0.95 * a);
  for (const k of [-1, 0, 1]) {
    // a curved talon: out along the head, hooking at the tip
    const pts: Pt[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(P(6 + 26 * t, k * (9 + 4 * t) - 4 + 3 * t * t * (k || 1)));
    }
    for (let i = 8; i >= 0; i--) {
      const t = i / 8;
      pts.push(P(6 + 22 * t, k * (9 + 2 * t) + 5 - 2 * t));
    }
    g.fillPoints(pts, true);
  }
  const p = P(-4, 0);
  g.fillStyle(INK, 0.95 * a).fillCircle(p.x, p.y, 15 * s);
  g.fillStyle(0x2c2168, a).fillCircle(p.x, p.y, 12.5 * s);
  for (const k of [-3, 6]) {
    const e = P(-6, k);
    g.fillStyle(CLAW_EYE, a).fillCircle(e.x, e.y, 2.6 * s);
  }
}

export interface InkStreak {
  x: number;
  y: number;
  tx: number;
  ty: number;
  hw: number;
  /** When the lunge landed (server time). */
  t0: number;
}
/** The ink lunge racing down its lane, then its single splat. */
export function drawStreak(
  g: G,
  s: InkStreak,
  now: number,
  reduced: boolean,
  low: boolean,
) {
  const age = now - s.t0;
  if (age < 0) return;
  const dx = s.tx - s.x,
    dy = s.ty - s.y,
    len = Math.hypot(dx, dy) || 1,
    ux = dx / len,
    uy = dy / len,
    ang = Math.atan2(dy, dx);
  // the splat it leaves, halfway down the lane
  if (age < SPLAT_SECONDS) {
    const a = 0.85 * (1 - smooth(0.6 * SPLAT_SECONDS, SPLAT_SECONDS, age));
    const mx = s.x + dx * 0.55,
      my = s.y + dy * 0.55;
    g.fillStyle(0x0e0826, a).fillPoints(
      arc(mx, my, Math.min(150, len * 0.22), s.hw * 0.55, ang, 0, TAU, 28),
      true,
    );
    for (const [f, side, r] of [
      [0.42, 1, 5],
      [0.6, -1, 6],
      [0.7, 1, 3.5],
    ])
      g.fillCircle(
        s.x + dx * f - uy * side * s.hw * 0.75,
        s.y + dy * f + ux * side * s.hw * 0.75,
        r,
      );
    if (!low)
      g.lineStyle(1.6, 0x9678ff, 0.4 * a).strokePoints(
        arc(
          mx,
          my,
          Math.min(150, len * 0.22) * 0.7,
          s.hw * 0.3,
          ang,
          1.1 * Math.PI,
          1.7 * Math.PI,
          10,
        ),
      );
  }
  if (reduced || age > STREAK_SECONDS) return;
  const u = clamp(age / 0.24),
    fade = 1 - smooth(0.3, STREAK_SECONDS, age);
  const head = len * u * u * (3 - 2 * u),
    tail = Math.max(0, head - 420) + len * smooth(0.24, 0.8, age);
  if (head - tail < 2) return;
  const L: Pt[] = [],
    R: Pt[] = [];
  const N = 18;
  for (let i = 0; i <= N; i++) {
    const d = tail + ((head - tail) * i) / N,
      k = i / N;
    const w =
      s.hw *
      (0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, k * 1.1))) *
      (1 + 0.12 * Math.sin(d / 18 + age * 20));
    const x = s.x + ux * d,
      y = s.y + uy * d;
    L.push({ x: x - uy * w, y: y + ux * w });
    R.push({ x: x + uy * w, y: y - ux * w });
  }
  const band = [...L, ...R.reverse()];
  g.fillStyle(0x0e0826, 0.92 * fade).fillPoints(band, true);
  if (!low) g.lineStyle(3, 0xa06eff, 0.55 * fade).strokePoints(band, true);
  if (u < 1 || age < 0.32)
    claw(g, s.x + ux * head, s.y + uy * head, ang, 1.7, fade);
}
