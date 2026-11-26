import type Phaser from "phaser";
import { WORLD_ART } from "../../../../packages/shared/src/world-art";
import { sparkle } from "./skin-fx";

/**
 * The raid bosses' entrances, drawn over the greeting (t seconds in) behind
 * the fighter, each in its boss's own look since the bosses were remade
 * (14 Nov; owner, 26 Nov: the old ones were "khá outdated"). Their ids stay
 * the old boss names (CLAUDE.md, raid-roster.ts). The burst each one also
 * plays is in collection-fx.ts (baseEntrance).
 *
 * `x`, `y`: the effect's origin (as every Look effect gets it); the floor
 * is `WORLD_ART.fighterFeet` lower, where the feet stand.
 *
 * In a match the fighter's name and health bar sit above its head, about
 * 100 to 140 units over the floor and 65 either side: a piece that settles
 * there is hidden on a phone, so what stays (a cloud, a lantern, a prism)
 * settles lower, or beside the fighter.
 */
type G = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };
export interface DrawnEntrance {
  /** Seconds it draws for. */
  length: number;
  /**
   * The room it takes in a thumbnail, in entrance units: `w` wide, `h`
   * tall, the origin `feet` of the way down (the usual frame: 104, 92,
   * 0.82).
   */
  reach: { w: number; h: number; feet: number };
  /** The moment a catalogue tile shows. */
  still: number;
  draw: (under: G, x: number, y: number, sc: number, t: number) => void;
}

const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const easeIn = (k: number) => k * k;
/** A pop with a little overshoot (0 → 1). */
const pop = (k: number) =>
  k <= 0 ? 0 : k >= 1 ? 1 : 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
/** In, held, then out: 0 → 1 → 0 over [a, b] … [c, d]. */
const life = (t: number, a: number, b: number, c: number, d: number) =>
  Math.min(span(t, a, b), 1 - span(t, c, d));
/** The same "random" number every frame for the same n, in [0, 1). */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const floorOf = (y: number, sc: number) => y + WORLD_ART.fighterFeet * sc;

/** A jagged bolt from (x0, y0) to (x1, y1), re-forking with `seed`. */
function bolt(
  g: G,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  seed: number,
  color: number,
  alpha: number,
  sc: number,
) {
  const pts: Pt[] = [];
  for (let i = 0; i <= 7; i++) {
    const k = i / 7,
      jitter = i === 0 || i === 7 ? 0 : (hash(seed + i) - 0.5) * 26 * sc;
    pts.push({ x: x0 + (x1 - x0) * k + jitter, y: y0 + (y1 - y0) * k });
  }
  g.lineStyle(13 * sc, color, 0.22 * alpha).strokePoints(pts);
  g.lineStyle(5 * sc, color, 0.95 * alpha).strokePoints(pts);
  g.lineStyle(2 * sc, 0xffffff, alpha).strokePoints(pts);
  g.fillStyle(0xffffff, 0.5 * alpha).fillCircle(x1, y1, 9 * sc);
}
/** A thunder-jelly: a round bell with two eyes and wavy tentacles. */
function jelly(
  g: G,
  cx: number,
  cy: number,
  s: number,
  color: number,
  t: number,
  alpha: number,
) {
  g.fillStyle(color, 0.22 * alpha).fillCircle(cx, cy, 15 * s);
  g.lineStyle(1.8 * s, color, 0.9 * alpha);
  for (let i = -1; i <= 1; i++) {
    const tx = cx + i * 5 * s,
      w = Math.sin(t * 9 + i * 2) * 2.5 * s;
    g.lineBetween(tx, cy, tx + w, cy + 7 * s).lineBetween(
      tx + w,
      cy + 7 * s,
      tx - w,
      cy + 13 * s,
    );
  }
  g.fillStyle(color, alpha).beginPath();
  g.arc(cx, cy, 9 * s, Math.PI, Math.PI * 2)
    .closePath()
    .fillPath();
  g.fillStyle(0xffffff, 0.75 * alpha).fillEllipse(
    cx - 3.5 * s,
    cy - 5.5 * s,
    4 * s,
    2.4 * s,
  );
  g.fillStyle(0x2b2440, alpha)
    .fillCircle(cx - 3 * s, cy - 2 * s, 1.3 * s)
    .fillCircle(cx + 3 * s, cy - 2 * s, 1.3 * s);
}
/**
 * Storm Twins (Lightning-strike): two bolts strike the spot, one gold, one
 * ice blue (Fizz and Crackle's opposite charges), the floor flashes, then
 * the two little thunder-jellies bob either side of the fighter, their
 * crackling ribbon strung behind its head, and pop into sparks.
 */
function stormTwins(g: G, x: number, y: number, sc: number, t: number) {
  const gy = floorOf(y, sc);
  const strikes: [number, number, number, number][] = [
    [0, -40, -8, 0xffe18b],
    [0.16, 44, 8, 0x8edfff],
  ];
  for (const [at, from, to, color] of strikes) {
    const k = (t - at) / 0.24;
    if (k >= 0 && k < 1)
      bolt(
        g,
        x + from * sc,
        gy - 150 * sc,
        x + to * sc,
        gy,
        7 + Math.floor(t * 25) * 3,
        color,
        (0.65 + 0.35 * hash(Math.floor(t * 40))) * (1 - k * k),
        sc,
      );
  }
  const flash = span(t, 0, 0.5);
  if (flash < 1) {
    g.fillStyle(0xffffff, 0.45 * (1 - flash)).fillEllipse(
      x,
      gy,
      76 * sc * easeOut(flash),
      20 * sc * easeOut(flash),
    );
    g.lineStyle(2 * sc, 0xffe18b, 0.8 * (1 - flash)).strokeEllipse(
      x,
      gy,
      110 * sc * easeOut(flash),
      28 * sc * easeOut(flash),
    );
  }
  const twins: [number, number, number][] = [
    [-1, 0.3, 0xffe18b],
    [1, 0.42, 0x8edfff],
  ];
  const pos = (side: number) => ({
    x: x + side * 46 * sc,
    y: gy - 64 * sc + Math.sin(t * 5 + side) * 5 * sc,
  });
  const gone = span(t, 1.5, 1.72);
  const shown = (start: number) =>
    pop(span(t, start, start + 0.2)) * (1 - gone);
  // The ribbon: two crackling strands between them, behind the head.
  const ribbon = Math.min(shown(0.3), shown(0.42));
  if (ribbon > 0.05) {
    const a = pos(-1),
      b = pos(1);
    for (const [color, seed] of [
      [0xffe18b, 31],
      [0x8edfff, 57],
    ] as const) {
      const pts: Pt[] = [];
      for (let i = 0; i <= 8; i++) {
        const k = i / 8;
        pts.push({
          x: a.x + (b.x - a.x) * k,
          y:
            a.y +
            (b.y - a.y) * k +
            Math.sin(k * Math.PI) * 12 * sc +
            (i % 8
              ? (hash(seed + i + Math.floor(t * 18) * 9) - 0.5) * 7 * sc
              : 0),
        });
      }
      g.lineStyle(2.4 * sc, color, 0.9 * ribbon).strokePoints(pts);
    }
  }
  for (const [side, start, color] of twins) {
    const s = shown(start);
    if (s > 0.02) {
      const p = pos(side);
      jelly(g, p.x, p.y, sc * 1.35 * s, color, t, 1);
    }
  }
  if (gone > 0 && gone < 1)
    for (const [side, , color] of twins) {
      const p = pos(side);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2,
          d = 22 * sc * easeOut(gone);
        sparkle(
          g,
          p.x + Math.cos(a) * d,
          p.y + Math.sin(a) * d,
          3.2 * sc * (1 - gone),
          color,
          1 - gone,
        );
      }
    }
}

/** A paper lantern lit from inside, `glow` how bright (0..2). */
function lantern(
  g: G,
  cx: number,
  cy: number,
  s: number,
  glow: number,
  alpha: number,
  paper: number,
  frame: number,
  flicker: number,
) {
  g.fillStyle(0xffb347, 0.16 * glow * alpha).fillCircle(cx, cy, 28 * s);
  g.fillStyle(0xffd27a, 0.2 * glow * alpha).fillCircle(cx, cy, 17 * s);
  g.fillStyle(paper, alpha).fillEllipse(cx, cy, 21 * s, 25 * s);
  g.fillStyle(0xffe6a6, (0.55 + 0.3 * flicker) * alpha).fillEllipse(
    cx,
    cy + 1 * s,
    12 * s,
    17 * s,
  );
  g.fillStyle(0xfffbe8, (0.75 + 0.25 * flicker) * alpha).fillEllipse(
    cx,
    cy + 3 * s,
    4 * s,
    7 * s,
  );
  g.lineStyle(1 * s, frame, 0.45 * alpha)
    .lineBetween(cx - 6 * s, cy - 10 * s, cx - 6 * s, cy + 10 * s)
    .lineBetween(cx + 6 * s, cy - 10 * s, cx + 6 * s, cy + 10 * s);
  g.fillStyle(frame, alpha)
    .fillRect(cx - 6 * s, cy - 14 * s, 12 * s, 3 * s)
    .fillRect(cx - 5 * s, cy + 11 * s, 10 * s, 3 * s);
}
/**
 * Lumiwick (Firefall): a sky lantern drifts down out of the sky, swaying,
 * to hang glowing behind the fighter's head; it flares, its light rings out
 * over the fighter, and two little lanterns are let go to float back up.
 */
function lumiwick(g: G, x: number, y: number, sc: number, t: number) {
  const gy = floorOf(y, sc);
  const fall = easeOut(span(t, 0, 0.7));
  const flare = span(t, 0.7, 1.05),
    out = span(t, 1.0, 1.3);
  const flicker = hash(Math.floor(t * 14));
  if (out < 1) {
    const cx = x - 54 * sc + Math.sin(t * 4) * 6 * sc * (1 - fall),
      cy = gy - (165 - 95 * fall) * sc;
    lantern(
      g,
      cx,
      cy,
      sc * (1 + 0.12 * flare),
      1 + 1.4 * flare,
      1 - out,
      0xff8a4f,
      0x8a3b1f,
      flicker,
    );
  }
  if (flare > 0 && out < 1)
    g.lineStyle(3 * sc, 0xffd27a, 0.7 * (1 - out)).strokeCircle(
      x - 54 * sc,
      gy - 70 * sc,
      (16 + 26 * easeOut(out)) * sc,
    );
  for (const [side, start] of [
    [-1, 0.95],
    [1, 1.1],
  ]) {
    const k = span(t, start, start + 1.1);
    if (k > 0 && k < 1) {
      const cx =
          x + side * (58 + 12 * k) * sc + Math.sin(t * 5 + side) * 4 * sc,
        cy = gy - (30 + 80 * k) * sc;
      lantern(
        g,
        cx,
        cy,
        sc * 0.55,
        1,
        Math.min(1, k * 6) * (1 - easeIn(span(k, 0.6, 1))),
        0xffa25a,
        0x8a3b1f,
        flicker,
      );
    }
  }
}

/**
 * Prismell (Sunburst): a sunbeam slants down onto a little prism above the
 * fighter's head; the prism splits it into six rainbow beams that fan down
 * round the fighter to the floor, then it shatters into glitter.
 */
const PRISM_BANDS = [
  0xff7d9c, 0xffb36b, 0xffe27a, 0x8ff0b5, 0x7fd8ff, 0xb59bff,
];
function prismell(g: G, x: number, y: number, sc: number, t: number) {
  const gy = floorOf(y, sc),
    px = x,
    py = gy - 90 * sc;
  const fade = span(t, 1.25, 1.55);
  const beam = easeOut(span(t, 0, 0.26));
  if (beam > 0 && fade < 1) {
    const sx = x - 92 * sc,
      sy = gy - 160 * sc;
    const ex = sx + (px - sx) * beam,
      ey = sy + (py - sy) * beam;
    g.lineStyle(10 * sc, 0xfff3c4, 0.3 * (1 - fade)).lineBetween(
      sx,
      sy,
      ex,
      ey,
    );
    g.lineStyle(3 * sc, 0xffffff, 0.9 * (1 - fade)).lineBetween(sx, sy, ex, ey);
  }
  const fan = easeOut(span(t, 0.24, 0.5));
  if (fan > 0 && fade < 1)
    PRISM_BANDS.forEach((c, i) => {
      const fx = x + (i - 2.5) * 32 * sc,
        tx = px + (fx - px) * fan,
        ty = py + (gy - py) * fan,
        w = 7 * sc * fan;
      g.fillStyle(c, 0.3 * (1 - fade)).fillTriangle(
        px,
        py,
        tx - w,
        ty,
        tx + w,
        ty,
      );
      g.lineStyle(1.6 * sc, c, 0.85 * (1 - fade)).lineBetween(px, py, tx, ty);
      if (fan > 0.95)
        g.fillStyle(c, 0.45 * (1 - fade)).fillEllipse(tx, ty, 18 * sc, 5 * sc);
    });
  const shown = pop(span(t, 0.16, 0.34)) * (1 - span(t, 1.25, 1.3));
  if (shown > 0.02) {
    const s = sc * shown,
      wob = Math.sin(t * 6) * 2 * s;
    g.fillStyle(0xfff3c4, 0.35).fillCircle(px, py, 13 * s);
    g.fillStyle(0xffffff, 0.95).fillTriangle(
      px - 7 * s + wob,
      py,
      px + 7 * s + wob,
      py,
      px + wob,
      py - 11 * s,
    );
    g.fillStyle(0xd9f1ff, 0.95).fillTriangle(
      px - 7 * s + wob,
      py,
      px + 7 * s + wob,
      py,
      px + wob,
      py + 9 * s,
    );
    g.fillStyle(0xffd6ea, 0.8).fillTriangle(
      px + wob,
      py - 11 * s,
      px + 7 * s + wob,
      py,
      px + 1 * s + wob,
      py,
    );
  }
  const shards = span(t, 1.27, 1.75);
  if (shards > 0 && shards < 1)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3,
        d = 34 * sc * easeOut(shards);
      sparkle(
        g,
        px + Math.cos(a) * d,
        py + Math.sin(a) * d + 16 * sc * shards * shards,
        3.4 * sc * (1 - shards * 0.6),
        PRISM_BANDS[i % 6],
        1 - shards,
      );
    }
}

/**
 * Cragmuff (Mountainborn): the floor cracks open round the feet, glowing
 * amber in the cracks, and a ring of amber crystals thrusts up behind the
 * fighter, glints, then sinks back into the ground. (The rig bursts the
 * pebbles: rig.ts, rig-piece-fx.ts.)
 */
function cragmuff(g: G, x: number, y: number, sc: number, t: number) {
  const gy = floorOf(y, sc);
  const gone = span(t, 1.45, 1.85);
  const crack = easeOut(span(t, 0, 0.28));
  if (crack > 0 && gone < 1)
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.25,
        l = (44 + hash(i) * 22) * sc * crack,
        bend = (hash(i + 9) - 0.5) * 0.5;
      const mid = {
          x: x + Math.cos(a + bend) * l * 0.5,
          y: gy + Math.sin(a + bend) * l * 0.5 * 0.3,
        },
        end = { x: x + Math.cos(a) * l, y: gy + Math.sin(a) * l * 0.3 };
      const pts = [{ x, y: gy }, mid, end];
      g.lineStyle(3 * sc, 0x4a3a28, 0.85 * (1 - gone)).strokePoints(pts);
      g.lineStyle(1.2 * sc, 0xffb347, 0.9 * (1 - gone)).strokePoints(pts);
    }
  const crystals: [number, number, number][] = [
    [-50, 44, 11],
    [-27, 62, 14],
    [0, 80, 16],
    [27, 62, 14],
    [50, 44, 11],
  ];
  crystals.forEach(([dx, tall, wide], i) => {
    const rise =
      pop(span(t, 0.12 + i * 0.05, 0.4 + i * 0.05)) * (1 - easeIn(gone));
    if (rise < 0.02) return;
    const bx = x + dx * sc,
      by = gy - (8 - Math.abs(dx) * 0.08) * sc,
      h = tall * sc * rise,
      w = wide * sc * 0.5;
    const body: Pt[] = [
      { x: bx - w, y: by },
      { x: bx - w, y: by - h * 0.72 },
      { x: bx, y: by - h },
      { x: bx + w, y: by - h * 0.72 },
      { x: bx + w, y: by },
    ];
    g.fillStyle(0xffb347, 0.16 * (1 - gone)).fillCircle(
      bx,
      by - h * 0.55,
      w * 2.4,
    );
    g.fillStyle(0xe58a2e, 0.95 * (1 - gone)).fillPoints(body, true);
    g.fillStyle(0xffd28c, 0.95 * (1 - gone)).fillPoints(
      [body[1], body[2], { x: bx, y: by }, { x: bx - w, y: by }],
      true,
    );
    g.lineStyle(1.2 * sc, 0x8a4f1c, 0.8 * (1 - gone)).strokePoints(body, true);
    const glint = Math.max(0, Math.sin(t * 6 + i * 1.9)) ** 6;
    if (t > 0.5 && glint > 0.1)
      sparkle(g, bx, by - h + 2 * sc, 4 * sc, 0xfff3c4, glint * (1 - gone));
  });
}

/**
 * Tidelotl (Riptide): a wave rears up behind the fighter, curls over and
 * crashes into foam round its feet; a pearl in a bubble floats up out of
 * the surf and pops with a shine.
 */
function tidelotl(g: G, x: number, y: number, sc: number, t: number) {
  const gy = floorOf(y, sc);
  const rise = easeOut(span(t, 0, 0.42)),
    crash = easeIn(span(t, 0.42, 0.8));
  const H = 124 * sc * rise * (1 - crash * 0.85);
  if (H > 3 * sc && crash < 1) {
    // A wave that rears up from the left and curls over to the right; as
    // it crashes, its crest falls forward and down.
    const lean = 30 * sc * crash;
    const P = (dx: number, up: number, curl = 0): Pt => ({
      x: x + dx * sc + lean * curl,
      y: gy - H * up,
    });
    const back = [
      P(-95, 0),
      P(-95, 0.16),
      P(-72, 0.3),
      P(-48, 0.48),
      P(-24, 0.68),
      P(0, 0.86, 0.5),
      P(24, 0.97, 0.8),
      P(46, 1, 1),
      P(64, 0.92, 1),
      P(74, 0.78, 1),
      P(70, 0.64, 1),
      P(60, 0.62, 1),
    ];
    const face = [
      P(54, 0.55, 0.8),
      P(62, 0.4, 0.5),
      P(80, 0.24, 0.2),
      P(95, 0.12),
      P(95, 0),
    ];
    const body = [...back, ...face];
    const fade = 1 - crash;
    g.fillStyle(0x1f7fa8, 0.92 * fade).fillPoints(body, true);
    // The lit water along the top, and the hollow under the curl.
    g.fillStyle(0x4fc3e0, 0.9 * fade).fillPoints(
      [
        P(-72, 0.27),
        P(-48, 0.44),
        P(-24, 0.63),
        P(0, 0.8, 0.5),
        P(24, 0.9, 0.8),
        P(44, 0.92, 1),
        P(58, 0.86, 1),
        P(50, 0.74, 1),
        P(30, 0.7, 0.8),
        P(4, 0.6, 0.5),
        P(-22, 0.45),
        P(-48, 0.3),
        P(-70, 0.18),
      ],
      true,
    );
    g.fillStyle(0x155f82, 0.9 * fade).fillPoints(
      [P(60, 0.62, 1), P(54, 0.55, 0.8), P(46, 0.66, 0.9), P(52, 0.72, 1)],
      true,
    );
    // Foam along the crest and over the curl.
    const crest = [
      P(-24, 0.68),
      P(-8, 0.8, 0.3),
      P(8, 0.9, 0.6),
      P(24, 0.97, 0.8),
      P(40, 1, 1),
      P(56, 0.98, 1),
      P(68, 0.88, 1),
      P(73, 0.76, 1),
    ];
    crest.forEach((p, i) =>
      g
        .fillStyle(0xffffff, 0.95 * fade)
        .fillCircle(p.x, p.y, (2.4 + (i % 3) * 1.1 + i * 0.25) * sc),
    );
  }
  // Surf round the feet once it crashes: small white foam that shrinks away.
  const surf = span(t, 0.55, 1.35);
  if (surf > 0 && surf < 1)
    for (let i = 0; i < 8; i++) {
      const dx = (i - 3.5) * 22 * sc,
        grow = easeOut(Math.min(1, surf * 3)),
        r = (4.5 + (i % 3) * 1.6) * sc * grow * (1 - surf * 0.85);
      g.fillStyle(0xffffff, 0.92).fillCircle(
        x + dx + Math.sign(dx) * 10 * sc * surf,
        gy - 2 * sc,
        r,
      );
    }
  const pearl = span(t, 0.62, 1.5);
  if (pearl > 0 && pearl < 1) {
    const cx = x + (30 + 10 * pearl) * sc + Math.sin(t * 5) * 3 * sc,
      cy = gy - (12 + 104 * easeOut(pearl)) * sc;
    g.fillStyle(0x7fe9ff, 0.18).fillCircle(cx, cy, 11 * sc);
    g.lineStyle(1.4 * sc, 0xe6fbff, 0.9).strokeCircle(cx, cy, 11 * sc);
    g.fillStyle(0xfff1f6, 1).fillCircle(cx, cy, 5 * sc);
    g.fillStyle(0xffffff, 0.9).fillCircle(
      cx - 1.6 * sc,
      cy - 1.8 * sc,
      1.6 * sc,
    );
  }
  const popped = span(t, 1.5, 1.85);
  if (popped > 0 && popped < 1) {
    const cx = x + 40 * sc,
      cy = gy - 116 * sc;
    sparkle(g, cx, cy, 9 * sc * (1 - popped), 0xffffff, 1 - popped);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2,
        d = 18 * sc * easeOut(popped);
      g.fillStyle(0xe6fbff, 0.9 * (1 - popped)).fillCircle(
        cx + Math.cos(a) * d,
        cy + Math.sin(a) * d,
        1.6 * sc,
      );
    }
  }
}

/**
 * Inkpurr (Shadowstep): a drop of ink falls and splats into a pool at the
 * fighter's feet; a little ink cat peeks out of the pool beside it and
 * blinks, two lanterns of the Lantern Yard light up either side, then the
 * ink drains away.
 */
function inkpurr(g: G, x: number, y: number, sc: number, t: number) {
  const gy = floorOf(y, sc);
  const drop = span(t, 0, 0.22);
  if (drop < 1) {
    const cy = gy - 150 * sc * (1 - easeIn(drop));
    g.fillStyle(0x231a3d, 1)
      .fillCircle(x, cy, 8 * sc)
      .fillTriangle(
        x - 7.5 * sc,
        cy - 3 * sc,
        x + 7.5 * sc,
        cy - 3 * sc,
        x,
        cy - 20 * sc,
      );
    g.lineStyle(1.4 * sc, 0x9c7bff, 0.9).strokeCircle(x, cy, 8 * sc);
    g.fillStyle(0xc9b6ff, 0.9).fillCircle(x - 2.6 * sc, cy - 2 * sc, 2 * sc);
  }
  const pool = easeOut(span(t, 0.2, 0.42)) * (1 - easeIn(span(t, 1.45, 1.9)));
  if (pool > 0.02) {
    g.fillStyle(0x231a3d, 0.92).fillEllipse(
      x,
      gy,
      108 * sc * pool,
      28 * sc * pool,
    );
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4,
        r = (5 + hash(i + 3) * 5) * sc * pool;
      g.fillEllipse(
        x + Math.cos(a) * 54 * sc * pool,
        gy + Math.sin(a) * 14 * sc * pool,
        r * 2,
        r * 0.8,
      );
    }
    g.fillStyle(0x5b4a99, 0.45).fillEllipse(
      x - 10 * sc * pool,
      gy - 2 * sc * pool,
      60 * sc * pool,
      10 * sc * pool,
    );
    // A violet rim of light, so the ink reads on a dark floor too.
    g.lineStyle(1.6 * sc, 0x9c7bff, 0.75).strokeEllipse(
      x,
      gy,
      110 * sc * pool,
      29 * sc * pool,
    );
  }
  const splash = span(t, 0.22, 0.62);
  if (splash > 0 && splash < 1)
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI * (0.12 + (i / 7) * 0.76),
        d = (40 + hash(i) * 26) * sc * easeOut(splash);
      g.fillStyle(0x2b2245, 1 - splash).fillCircle(
        x + Math.cos(a) * d,
        Math.min(gy, gy + Math.sin(a) * d * 0.8 + 40 * sc * splash * splash),
        (2.6 - splash) * sc,
      );
    }
  // The little ink cat beside the fighter, Inkpurr itself: it pops up out
  // of the ink, blinks its lantern eyes, flicks its crescent-moon tail and
  // sinks back.
  const peek = pop(span(t, 0.45, 0.65)) * (1 - easeIn(span(t, 1.1, 1.35)));
  if (peek > 0.02) {
    const cx = x + 50 * sc,
      cy = gy - 1 * sc,
      s = sc * 1.45 * peek,
      flick = Math.sin(t * 7) * 2 * s;
    // Tail, curling up behind it to a crescent moon.
    g.lineStyle(3 * s, 0x231a3d, 1)
      .lineBetween(cx + 8 * s, cy - 4 * s, cx + 14 * s, cy - 12 * s)
      .lineBetween(cx + 14 * s, cy - 12 * s, cx + 13 * s + flick, cy - 19 * s);
    g.fillStyle(0xffd65b, 1).fillCircle(
      cx + 13 * s + flick,
      cy - 22 * s,
      3.6 * s,
    );
    g.fillStyle(0x231a3d, 1).fillCircle(
      cx + 14.6 * s + flick,
      cy - 23.2 * s,
      3 * s,
    );
    g.fillStyle(0x231a3d, 1).fillEllipse(cx, cy - 6 * s, 22 * s, 16 * s);
    g.fillTriangle(
      cx - 10 * s,
      cy - 9 * s,
      cx - 3 * s,
      cy - 12 * s,
      cx - 8 * s,
      cy - 20 * s,
    );
    g.fillTriangle(
      cx + 10 * s,
      cy - 9 * s,
      cx + 3 * s,
      cy - 12 * s,
      cx + 8 * s,
      cy - 20 * s,
    );
    g.lineStyle(1.2 * sc, 0x9c7bff, 0.85).strokeEllipse(
      cx,
      cy - 6 * s,
      22 * s,
      16 * s,
    );
    g.strokeTriangle(
      cx - 10 * s,
      cy - 9 * s,
      cx - 3 * s,
      cy - 12 * s,
      cx - 8 * s,
      cy - 20 * s,
    );
    g.strokeTriangle(
      cx + 10 * s,
      cy - 9 * s,
      cx + 3 * s,
      cy - 12 * s,
      cx + 8 * s,
      cy - 20 * s,
    );
    const blink = t > 0.86 && t < 0.94 ? 0.15 : 1;
    g.fillStyle(0xffd65b, 1)
      .fillEllipse(cx - 4 * s, cy - 8 * s, 3.6 * s, 4.4 * s * blink)
      .fillEllipse(cx + 4 * s, cy - 8 * s, 3.6 * s, 4.4 * s * blink);
  }
  const flicker = hash(Math.floor(t * 12));
  for (const [side, start, lift] of [
    [-1, 0.4, 64],
    [1, 0.56, 70],
  ]) {
    const on = life(t, start, start + 0.25, 1.5, 1.9);
    if (on > 0.02) {
      // Hanging from a string, swaying a little, lit one after the other.
      const sway = Math.sin(t * 3 + side) * 3 * sc,
        cx = x + side * 62 * sc + sway,
        cy = gy - lift * sc;
      g.lineStyle(1.2 * sc, 0x3a2c66, Math.min(1, on * 1.6)).lineBetween(
        cx - sway * 0.6,
        cy - 44 * sc,
        cx,
        cy - 13 * sc,
      );
      lantern(
        g,
        cx,
        cy,
        sc * 0.9,
        on,
        Math.min(1, on * 1.6),
        0xffd65b,
        0x3a2c66,
        flicker,
      );
    }
  }
}

/** "Z", drawn in three strokes. */
function zee(
  g: G,
  cx: number,
  cy: number,
  s: number,
  color: number,
  alpha: number,
) {
  g.lineStyle(Math.max(1, s * 0.28), color, alpha)
    .lineBetween(cx - s / 2, cy - s / 2, cx + s / 2, cy - s / 2)
    .lineBetween(cx + s / 2, cy - s / 2, cx - s / 2, cy + s / 2)
    .lineBetween(cx - s / 2, cy + s / 2, cx + s / 2, cy + s / 2);
}
/**
 * Snoozaku (Dreamdrift): little thought bubbles rise from the fighter's
 * head into a dream cloud beside it (on its left), a moon and stars inside;
 * sleepy Z's drift up, then the dream pops into stardust.
 */
function snoozaku(g: G, x: number, y: number, sc: number, t: number) {
  const gy = floorOf(y, sc);
  // On the left: the Shop's and Wardrobe's stage keeps its buttons on the
  // right, and a phone's stage is narrow.
  const cx = x - 54 * sc,
    cy = gy - 80 * sc;
  [
    [16, 62, 2.6],
    [24, 69, 3.6],
    [31, 75, 4.6],
  ].forEach(([dx, up, r], i) => {
    const s = pop(span(t, i * 0.08, i * 0.08 + 0.14)) * (1 - span(t, 1.4, 1.6));
    if (s > 0.02) {
      g.fillStyle(0xe9dcff, 0.95).fillCircle(
        x - dx * sc,
        gy - up * sc,
        r * sc * s,
      );
      g.lineStyle(1.2 * sc, 0xc9a3ff, 0.9).strokeCircle(
        x - dx * sc,
        gy - up * sc,
        r * sc * s,
      );
    }
  });
  const gone = span(t, 1.45, 1.75);
  const s = sc * 0.78 * pop(span(t, 0.24, 0.5)) * (1 + 0.15 * gone),
    a = 1 - gone;
  if (s > 0.02 * sc && a > 0) {
    const puffs: [number, number, number][] = [
      [-20, 2, 12],
      [-8, -8, 15],
      [9, -9, 14],
      [21, 1, 11],
    ];
    g.fillStyle(0xc9a3ff, 0.9 * a);
    for (const [dx, dy, r] of puffs)
      g.fillCircle(cx + dx * s, cy + dy * s, (r + 1.4) * s);
    g.fillEllipse(cx, cy + 6 * s, 64 * s, 20 * s);
    g.fillStyle(0xf3ecff, 0.97 * a);
    for (const [dx, dy, r] of puffs)
      g.fillCircle(cx + dx * s, cy + dy * s, r * s);
    g.fillEllipse(cx, cy + 6 * s, 60 * s, 17 * s);
    // Inside the dream: a crescent moon and twinkling stars.
    g.fillStyle(0xffd86b, a).fillCircle(cx - 5 * s, cy - 2 * s, 7 * s);
    g.fillStyle(0xf3ecff, a).fillCircle(cx - 2 * s, cy - 4 * s, 6 * s);
    for (let i = 0; i < 3; i++) {
      const tw = 0.5 + 0.5 * Math.sin(t * 8 + i * 2.2);
      sparkle(
        g,
        cx + (6 + i * 6) * s,
        cy + (i % 2 ? 4 : -6) * s,
        (2 + tw) * s,
        0x9f7bff,
        a * (0.5 + 0.5 * tw),
      );
    }
  }
  for (let i = 0; i < 3; i++) {
    const k = span(t, 0.5 + i * 0.25, 1.3 + i * 0.25);
    if (k > 0 && k < 1)
      zee(
        g,
        cx + (8 + i * 9 + Math.sin(k * 6) * 3) * sc,
        cy - (24 + k * 22) * sc,
        (6 + i * 2) * sc,
        0x9f7bff,
        Math.min(1, k * 5) * (1 - k),
      );
  }
  if (gone > 0 && gone < 1)
    for (let i = 0; i < 8; i++) {
      const an = (i / 8) * Math.PI * 2,
        d = 32 * sc * easeOut(gone);
      sparkle(
        g,
        cx + Math.cos(an) * d,
        cy + Math.sin(an) * d * 0.7,
        3.4 * sc * (1 - gone),
        i % 2 ? 0xffd86b : 0xc9a3ff,
        1 - gone,
      );
    }
}

/** The raid entrances that draw (ids are the old boss names: CLAUDE.md). */
export const RAID_DRAWN_ENTRANCES: Record<string, DrawnEntrance> = {
  "lightning-strike": {
    length: 1.75,
    reach: { w: 146, h: 180, feet: 0.778 },
    still: 0.62,
    draw: stormTwins,
  },
  firefall: {
    length: 2.1,
    reach: { w: 200, h: 210, feet: 0.838 },
    still: 0.9,
    draw: lumiwick,
  },
  sunburst: {
    length: 1.8,
    reach: { w: 200, h: 182, feet: 0.813 },
    still: 0.7,
    draw: prismell,
  },
  mountainborn: {
    length: 1.85,
    reach: { w: 132, h: 123, feet: 0.65 },
    still: 0.75,
    draw: cragmuff,
  },
  riptide: {
    length: 1.85,
    reach: { w: 220, h: 150, feet: 0.773 },
    still: 0.36,
    draw: tidelotl,
  },
  shadowstep: {
    length: 1.9,
    reach: { w: 186, h: 195, feet: 0.785 },
    still: 0.85,
    draw: inkpurr,
  },
  dreamdrift: {
    length: 1.8,
    reach: { w: 180, h: 148, feet: 0.77 },
    still: 0.95,
    draw: snoozaku,
  },
};
