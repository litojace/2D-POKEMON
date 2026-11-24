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

// ── the rest of its kit: hands, curse and haunt, pulse, split, found ──
// Shapes are the demo's paths, sampled once into points; every effect is
// vector drawing into the raid's own graphics (no images, no glows), with
// the highlights dropped on Low graphics and no motion with reduced motion.

const CURSE = 0xb07bff,
  CURSE_HI = 0xe0ccff,
  GOLD = 0xffd65b,
  GOLD_HI = 0xfff3c4;
/** Ink colours of the grasping hands (also how tests count them). */
export const HAND_INK = 0x130b31,
  HAND_TOP = 0x33266f;
/** The little ink ghost's body colour. */
export const GHOST_INK = 0x3a2c88;
/** The nightmare pulse's violet band and the copies' fizzling ring. */
export const PULSE_BAND = 0x965aff,
  FIZZLE = 0xc8b4ff;
/** A split's glossy ink blob, and the gold of the found burst. */
export const BLOB_INK = 0x0e0828,
  FOUND_GOLD = 0xffe08a;
/** How long the hands' grab, the pulse wave, a copy's fizzle, a blob's flight and the found burst last. */
export const GRAB_SECONDS = 0.6;
export const PULSE_WAVE_SECONDS = 0.75;
export const FIZZLE_SECONDS = 0.5;
export const BLOB_SECONDS = 0.45;
export const BLOB_STAGGER = 0.06;
export const BURST_SECONDS = 0.5;
/** The curse's beam, from the gem, at the start of the warning. */
export const BEAM_SECONDS = 0.6;

/** A path of quadratic (4 numbers) and cubic (6 numbers) segments, sampled. */
function sampled(start: Pt, segs: number[][], n = 6): Pt[] {
  const out: Pt[] = [{ ...start }];
  let p = start;
  for (const s of segs) {
    const end = { x: s[s.length - 2], y: s[s.length - 1] };
    for (let i = 1; i <= n; i++) {
      const t = i / n,
        u = 1 - t;
      out.push(
        s.length === 4
          ? {
              x: u * u * p.x + 2 * u * t * s[0] + t * t * end.x,
              y: u * u * p.y + 2 * u * t * s[1] + t * t * end.y,
            }
          : {
              x:
                u * u * u * p.x +
                3 * u * u * t * s[0] +
                3 * u * t * t * s[2] +
                t * t * t * end.x,
              y:
                u * u * u * p.y +
                3 * u * u * t * s[1] +
                3 * u * t * t * s[3] +
                t * t * t * end.y,
            },
      );
    }
    p = end;
  }
  return out;
}
/** A shadow hand rising out of the stone (origin: the floor; 64 tall). */
const HAND = sampled({ x: -11, y: 0 }, [
  [-10, -18, -14, -30, -16, -38],
  [-18, -46, -14, -50, -11, -46],
  [-10, -52, -9, -60, -5, -60],
  [-2, -60, -1.5, -54, -1, -50],
  [0, -60, 2, -64, 5, -63],
  [8, -62, 8, -55, 7.5, -50],
  [10, -57, 13, -58, 15, -55],
  [17, -52, 15, -46, 14, -42],
  [13, -30, 10, -18, 11, 0],
  [0, 4, -11, 0],
]);
/** The little ink ghost: cat ears, a wavy hem (origin: its middle). */
const GHOST = sampled(
  { x: -14, y: 10 },
  [
    [-16, -6, -12, -18, -8, -20],
    [-11, -28, -9, -31],
    [-4, -27, -2, -22],
    [0, -22.5, 2, -22],
    [4, -27, 9, -31],
    [11, -28, 8, -20],
    [12, -18, 16, -6, 14, 10],
    [11, 16, 8, 11],
    [5, 16, 2, 11],
    [-1, 16, -4, 11],
    [-7, 16, -10, 11],
    [-12, 15, -14, 10],
  ],
  4,
);
const placed = (
  shape: Pt[],
  x: number,
  y: number,
  sx: number,
  sy = sx,
  rot = 0,
  bend?: (p: Pt) => Pt,
) => {
  const c = Math.cos(rot),
    s = Math.sin(rot);
  return shape.map((p0) => {
    const p = bend ? bend(p0) : p0;
    const px = p.x * sx,
      py = p.y * sy;
    return { x: x + px * c - py * s, y: y + px * s + py * c };
  });
};

/**
 * One grasping hand at the floor point (x, y): `rise` 0..1 out of the
 * stone, `curl` 0..1 closing its fingers (the grab).
 */
export function inkHand(
  g: G,
  x: number,
  y: number,
  scale: number,
  rise: number,
  curl: number,
  alpha: number,
  low: boolean,
) {
  if (rise <= 0.02 || alpha <= 0.01) return;
  const bend = curl
    ? (p: Pt) =>
        p.y < -44
          ? {
              x: p.x * (1 - 0.3 * curl),
              y: -44 + (p.y + 44) * (1 - 0.6 * curl),
            }
          : p
    : undefined;
  g.fillStyle(0x0c0620, 0.9 * alpha).fillEllipse(
    x,
    y + scale,
    40 * scale,
    12 * scale,
  );
  g.fillStyle(HAND_INK, 0.97 * alpha).fillPoints(
    placed(HAND, x, y, scale, scale * rise, 0, bend),
    true,
  );
  // the lit top of the palm and fingers
  g.fillStyle(HAND_TOP, alpha).fillPoints(
    placed(
      HAND,
      x - scale,
      y - 10 * scale * rise,
      scale * 0.72,
      scale * rise * 0.78,
      0,
      bend,
    ),
    true,
  );
  if (!low)
    g.lineStyle(1.2, 0xb0a0ff, 0.55 * alpha).strokePoints(
      placed(HAND, x, y, scale, scale * rise, 0, bend).slice(0, 34),
    );
  g.fillStyle(0xc79bff, alpha)
    .fillCircle(x - 4 * scale, y - 34 * scale * rise, 2.2 * scale)
    .fillCircle(x + 4 * scale, y - 34 * scale * rise, 2.2 * scale);
}
/** The hands on one dark tile while the warning runs (two, or one on Low). */
export function handsOnTile(
  g: G,
  cx: number,
  floor: number,
  rise: number,
  clock: number,
  seed: number,
  reduced: boolean,
  low: boolean,
) {
  const sway = reduced ? 0 : Math.sin(clock * 3 + seed) * 2;
  if (low) return inkHand(g, cx + sway, floor, 0.75, rise, 0, 1, true);
  for (const k of [-1, 1])
    inkHand(g, cx + k * 30 + sway * k, floor, 0.75, rise, 0, 1, false);
}
/** The grab when the hands land: fingers close, then the hands sink away. */
export function handsGrab(
  g: G,
  cx: number,
  floor: number,
  age: number,
  reduced: boolean,
  low: boolean,
) {
  if (age < 0 || age > GRAB_SECONDS) return;
  const u = age / GRAB_SECONDS,
    curl = reduced ? 1 : smooth(0, 0.35, u),
    rise = reduced ? 1 : 1 - 0.45 * smooth(0.4, 1, u),
    a = 1 - smooth(0.6, 1, u);
  if (low) return inkHand(g, cx, floor, 0.75, rise, curl, a, true);
  for (const k of [-1, 1])
    inkHand(
      g,
      cx + k * 30 * (1 - 0.3 * curl),
      floor,
      0.75,
      rise,
      curl,
      a,
      false,
    );
}

/** A little ink ghost (the curse coming down, the Haunted raider's). */
export function inkGhost(
  g: G,
  x: number,
  y: number,
  scale: number,
  alpha: number,
  tilt: number,
  low: boolean,
) {
  if (alpha <= 0.01) return;
  if (!low)
    g.fillStyle(CURSE, 0.26 * alpha).fillCircle(x, y - 8 * scale, 24 * scale);
  const body = placed(GHOST, x, y, scale, scale, tilt);
  g.fillStyle(GHOST_INK, alpha).fillPoints(body, true);
  g.fillStyle(0x7c66dc, 0.9 * alpha).fillPoints(
    placed(
      GHOST,
      x - 1.5 * scale,
      y - 9 * scale,
      scale * 0.66,
      scale * 0.6,
      tilt,
    ),
    true,
  );
  g.lineStyle(1.8, CURSE_HI, alpha).strokePoints(body, true);
  const c = Math.cos(tilt),
    s = Math.sin(tilt);
  for (const k of [-5, 5])
    g.fillStyle(GOLD_HI, alpha).fillCircle(
      x + (k * c + 8 * s) * scale,
      y + (k * s - 8 * c) * scale,
      2.6 * scale,
    );
}
/** One curse wisp circling a raider (angle `a`), with a short tail. */
export function curseWisp(
  g: G,
  cx: number,
  cy: number,
  a: number,
  reduced: boolean,
  low: boolean,
) {
  const at = (k: number) => ({
    x: cx + Math.cos(a - k) * 34,
    y: cy + Math.sin(a - k) * 14,
  });
  if (!reduced && !low)
    for (let i = 3; i >= 1; i--) {
      const p = at(i * 0.22);
      g.fillStyle(CURSE, 0.22 * (1 - i / 4)).fillCircle(p.x, p.y, 7 - i * 1.4);
    }
  const p = at(0);
  g.fillStyle(CURSE, 0.35).fillCircle(p.x, p.y, 9);
  g.fillStyle(GHOST_INK, 0.95).fillCircle(p.x, p.y, 5.5);
  g.fillStyle(CURSE_HI, 0.95).fillCircle(p.x - 1.2, p.y - 1.2, 2.8);
}
/** The curse's beam from a gem to the raider; `k` 0..1 its strength. */
export function curseBeam(g: G, from: Pt, to: Pt, k: number, low: boolean) {
  if (k <= 0.02) return;
  const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 50 };
  const pts: Pt[] = [];
  for (let i = 0; i <= 16; i++) pts.push(qb(from, mid, to, i / 16));
  if (!low) stroke(g, pts, 8 * k + 2, CURSE, 0.35 * k);
  stroke(g, pts, 4 * k + 1.5, 0xffe296, 0.9 * k);
  if (!low) stroke(g, pts, 1.4, 0xffffff, 0.7 * k);
  g.lineStyle(2, CURSE_HI, 0.8 * k).strokeCircle(to.x, to.y, 6 + 10 * (1 - k));
}

/**
 * The nightmare pulse landing, from the real one only: a violet band with a
 * moon-gold edge rolling out to its exact radius.
 */
export function pulseWave(
  g: G,
  x: number,
  y: number,
  radius: number,
  age: number,
  reduced: boolean,
  low: boolean,
) {
  if (age < 0 || age > PULSE_WAVE_SECONDS) return;
  const u = age / PULSE_WAVE_SECONDS,
    e = Math.min(1, u * 1.6),
    r = reduced ? radius : 30 + (radius - 30) * (1 - (1 - e) * (1 - e)),
    a = 1 - smooth(0.55, 1, u);
  g.lineStyle(34, PULSE_BAND, 0.45 * a).strokeCircle(x, y, r);
  if (!low) g.lineStyle(10, 0xc8aaff, 0.7 * a).strokeCircle(x, y, r);
  g.lineStyle(3, 0xffe28c, 0.9 * a).strokeCircle(x, y, r);
}
/** A copy's ring when the pulse lands: it only fizzles away, dashed. */
export function pulseFizzle(
  g: G,
  x: number,
  y: number,
  radius: number,
  age: number,
  reduced: boolean,
) {
  if (age < 0 || age > FIZZLE_SECONDS) return;
  const u = age / FIZZLE_SECONDS,
    r = radius * (1 + (reduced ? 0 : 0.06 * u));
  g.lineStyle(2, FIZZLE, 0.45 * (1 - u));
  for (let k = 0; k < 18; k++) {
    const a0 = (k / 18) * TAU;
    g.beginPath()
      .arc(x, y, r, a0, a0 + (TAU / 18) * 0.45, false)
      .strokePath();
  }
}

/** A glossy ink blob in flight, stretched along `ang` by `st`. */
export function inkBlob(
  g: G,
  x: number,
  y: number,
  ang: number,
  st: number,
  low: boolean,
  k = 1.5,
) {
  g.fillStyle(BLOB_INK, 1).fillPoints(
    arc(x, y, 18 * k * st, (18 * k) / st, ang),
    true,
  );
  g.fillStyle(0x2c2168, 1).fillPoints(
    arc(x - 2 * k, y - 2 * k, 14 * k * st, (14 * k) / st, ang),
    true,
  );
  g.fillStyle(0x6e5cc8, 1).fillCircle(x - 5 * k, y - 6 * k, 5.5 * k);
  if (!low)
    stroke(
      g,
      arc(x, y, 17 * k * st, (17.3 * k) / st, ang, -0.5, 1.2, 8),
      1.4 * k,
      0xb0c6ff,
      0.7,
    );
  g.fillStyle(0xffffff, 0.85).fillEllipse(x - 6 * k, y - 7 * k, 6 * k, 9 * k);
}
export interface SplitBlob {
  from: Pt;
  to: Pt;
  /** Seconds after the split this blob leaves. */
  delay: number;
  arc: number;
}
/**
 * The split: ink divides into glossy blobs that arc out to every spot (the
 * real one's included, all alike) and splash where each body pops up.
 */
export function splitBlobs(
  g: G,
  blobs: SplitBlob[],
  age: number,
  reduced: boolean,
  low: boolean,
) {
  for (const b of blobs) {
    const u = (age - b.delay) / BLOB_SECONDS;
    if (u > 0 && u < 1 && !reduced) {
      const x = b.from.x + (b.to.x - b.from.x) * u,
        y = b.from.y + (b.to.y - b.from.y) * u - Math.sin(u * Math.PI) * b.arc;
      inkBlob(
        g,
        x,
        y,
        Math.atan2(b.to.y - b.from.y, b.to.x - b.from.x),
        1 + 0.25 * Math.sin(u * Math.PI),
        low,
      );
    }
    // the splash where it lands
    const v = (age - b.delay - BLOB_SECONDS) / BLOB_SECONDS;
    if (v >= 0 && v < 1) {
      const a = 1 - v;
      g.fillStyle(BLOB_INK, 0.8 * a).fillEllipse(b.to.x, b.to.y + 4, 70, 22);
      if (!reduced)
        g.lineStyle(6 * a + 1, CURSE, 0.8 * a).strokeEllipse(
          b.to.x,
          b.to.y,
          16 + 110 * Math.sqrt(v),
          (16 + 110 * Math.sqrt(v)) * 0.5,
        );
    }
  }
}
/** How far a body has popped up after the split (0 hidden, 1 shown). */
export function splitAppear(age: number, delay: number, reduced: boolean) {
  return reduced ? clamp(age / 0.4) : clamp((age - delay - BLOB_SECONDS) / 0.1);
}

/** Found: the gold burst where a copy pops. */
export function foundBurst(
  g: G,
  x: number,
  y: number,
  age: number,
  size: number,
  reduced: boolean,
  low: boolean,
) {
  if (age < 0 || age > BURST_SECONDS) return;
  const u = age / BURST_SECONDS,
    a = 1 - smooth(0.4, 1, u),
    grow = reduced ? 1 : Math.sqrt(u),
    r = (14 + 60 * grow) * size;
  g.fillStyle(FOUND_GOLD, 0.35 * a).fillCircle(x, y, (26 - 12 * u) * size);
  g.lineStyle(5 * (1 - u) + 1.5, FOUND_GOLD, 0.9 * a).strokeEllipse(
    x,
    y,
    r * 2,
    r,
  );
  const rays = low ? 4 : 8;
  for (let i = 0; i < rays; i++) {
    const ang = (i / rays) * TAU + 0.3,
      r0 = (10 + 26 * grow) * size,
      r1 = r0 + (16 + 18 * (1 - u)) * size;
    g.lineStyle(3, GOLD, a).lineBetween(
      x + Math.cos(ang) * r0,
      y + Math.sin(ang) * r0 * 0.7,
      x + Math.cos(ang) * r1,
      y + Math.sin(ang) * r1 * 0.7,
    );
  }
  if (!low) g.fillStyle(GOLD_HI, a).fillCircle(x, y, 5 * size * (1 - u * 0.5));
}
