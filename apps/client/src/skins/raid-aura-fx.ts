import type Phaser from "phaser";
import { sparkle } from "./skin-fx";

/**
 * The raid bosses' auras, each in its boss's own look since the bosses were
 * remade (14 Nov; owner, 26 Nov: the boss effects were "khá outdated"). The
 * seven had become the same thin dotted ring under the Legendary flourish.
 * Ids stay the old boss names (CLAUDE.md, raid-roster.ts).
 *
 * An aura plays all match long, so these stay light: no large glows (the
 * Legendary flourish already pools a soft light on the ground), small items,
 * and no more fill area a frame than the old ones painted
 * (tests/unit/raid-aura.test.ts). Items circle in depth as every aura's do:
 * on `front` on the near half, behind the fighter on the far half.
 */
type G = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };
type Item = (
  gg: G,
  px: number,
  py: number,
  i: number,
  a: number,
  d: number,
  f: number,
) => void;
const TAU = Math.PI * 2;
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

interface Ctx {
  g: G;
  front?: G;
  x: number;
  y: number;
  /** Milliseconds; 0 when motion is reduced. */
  t: number;
  reduced: boolean;
  flat: number;
  lift: number;
}
/** `n` items round an ellipse `rx` wide, `up` higher than the aura's items. */
function orbit(
  c: Ctx,
  n: number,
  rx: number,
  speed: number,
  up: number,
  draw: Item,
  phase = 0,
) {
  for (let i = 0; i < n; i++) {
    const a = c.t / speed + (i / n) * TAU + phase;
    const near = Math.sin(a);
    draw(
      c.front && near > 0 ? c.front : c.g,
      c.x + Math.cos(a) * rx,
      c.y - c.lift - up + near * rx * c.flat,
      i,
      a,
      1 + 0.16 * near,
      0.82 + 0.18 * near,
    );
  }
}
/** A point on the aura's ground ellipse. */
const onGround = (c: Ctx, a: number, r: number): Pt => ({
  x: c.x + Math.cos(a) * r,
  y: c.y + Math.sin(a) * r * c.flat,
});

/**
 * Storm Twins (Spark aura): the two thunder-jellies, gold and ice blue, circle
 * the fighter opposite each other, a crackle of lightning flickering between
 * them behind it, over a ring of static.
 */
function stormTwins(c: Ctx) {
  const { g, x, y, t, flat } = c;
  g.lineStyle(1.4, 0x8edfff, 0.5).strokeEllipse(x, y, 100, 100 * flat);
  g.lineStyle(1, 0xffe18b, 0.45).strokeEllipse(x, y, 88, 88 * flat);
  const at: Pt[] = [];
  orbit(c, 2, 50, 5200, 16, (gg, px, py, i, _a, d, f) => {
    const bob = c.reduced ? 0 : Math.sin(t / 300 + i * 2) * 2.5;
    at.push({ x: px, y: py + bob * d });
    const color = i ? 0x8edfff : 0xffe18b;
    gg.lineStyle(1.3 * d, color, 0.9 * f);
    for (let k = -1; k <= 1; k++) {
      const w = c.reduced ? 0 : Math.sin(t / 160 + k * 2 + i) * 1.6 * d;
      gg.lineBetween(
        px + k * 3 * d,
        py + bob * d,
        px + k * 3 * d + w,
        py + (bob + 7) * d,
      );
    }
    gg.fillStyle(color, 0.95 * f).beginPath();
    gg.arc(px, py + bob * d, 6 * d, Math.PI, TAU)
      .closePath()
      .fillPath();
    gg.fillStyle(0x2b2440, f)
      .fillCircle(px - 2 * d, py + (bob - 2) * d, 0.9 * d)
      .fillCircle(px + 2 * d, py + (bob - 2) * d, 0.9 * d);
  });
  // The crackle between them, behind the fighter, now and then.
  const flash = hash(Math.floor(t / 140));
  if (!c.reduced && flash > 0.45 && at.length === 2) {
    const pts: Pt[] = [];
    for (let k = 0; k <= 6; k++) {
      const s = k / 6;
      pts.push({
        x: at[0].x + (at[1].x - at[0].x) * s,
        y:
          at[0].y +
          (at[1].y - at[0].y) * s -
          Math.sin(s * Math.PI) * 10 +
          (k % 6 ? (hash(Math.floor(t / 70) * 7 + k) - 0.5) * 8 : 0),
      });
    }
    g.lineStyle(1.4, flash > 0.75 ? 0xffe18b : 0x8edfff, 0.75).strokePoints(
      pts,
    );
  }
}

/** A small paper lantern lit from inside. */
function lantern(
  gg: G,
  px: number,
  py: number,
  d: number,
  f: number,
  paper: number,
  frame: number,
  flicker: number,
) {
  gg.fillStyle(0xffc46b, 0.18 * f).fillCircle(px, py, 8 * d);
  gg.fillStyle(paper, 0.95 * f).fillEllipse(px, py, 7 * d, 9 * d);
  gg.fillStyle(0xfff1c2, (0.7 + 0.3 * flicker) * f).fillEllipse(
    px,
    py + 0.8 * d,
    3 * d,
    4.4 * d,
  );
  gg.fillStyle(frame, f)
    .fillRect(px - 2.2 * d, py - 5.4 * d, 4.4 * d, 1.2 * d)
    .fillRect(px - 1.8 * d, py + 4.2 * d, 3.6 * d, 1.2 * d);
}
/**
 * Lumiwick (Ember aura): three sky lanterns float slowly round the fighter,
 * bobbing, over a warm ring, with embers rising from it.
 */
function lumiwick(c: Ctx) {
  const { g, x, y, t, flat } = c;
  g.lineStyle(2, 0xffa66c, 0.7).strokeEllipse(x, y, 100, 100 * flat);
  const flicker = c.reduced ? 1 : hash(Math.floor(t / 90));
  orbit(c, 3, 50, 9000, 20, (gg, px, py, i, _a, d, f) => {
    const bob = c.reduced ? 0 : Math.sin(t / 700 + i * 2.1) * 3;
    lantern(gg, px, py + bob * d, d, f, 0xff8a4f, 0x8a3b1f, flicker);
  });
  for (let i = 0; i < 5; i++) {
    const k = c.reduced ? 0.4 : (t / 1800 + i / 5) % 1;
    const p = onGround(c, i * 1.7 + Math.floor(t / 1800 + i / 5) * 2.3, 46);
    g.fillStyle(i % 2 ? 0xffd28b : 0xff8a4f, 0.9 * (1 - k)).fillCircle(
      p.x + Math.sin(k * 9 + i) * 2,
      p.y - k * 30,
      1.3 * (1 - k * 0.5),
    );
  }
}

const BANDS = [0xff7d9c, 0xffb36b, 0xffe27a, 0x8ff0b5, 0x7fd8ff, 0xb59bff];
/**
 * Prismell (Halo aura): six prism crystals circle the fighter over a halo of
 * rainbow rings, and the light runs from crystal to crystal round the ring.
 */
function prismell(c: Ctx) {
  const { g, x, y, t, flat } = c;
  const shift = c.reduced ? 0 : Math.floor(t / 400);
  for (let r = 0; r < 3; r++) {
    const w = 96 + r * 7;
    g.lineStyle(1.4, BANDS[(r * 2 + shift) % 6], 0.6).strokeEllipse(
      x,
      y,
      w,
      w * flat,
    );
  }
  const lit = c.reduced ? 0 : Math.floor(t / 260) % 6;
  orbit(c, 6, 50, 6500, 10, (gg, px, py, i, _a, d, f) => {
    const h = 7 * d,
      w = 4 * d;
    gg.fillStyle(0xf4fbff, 0.95 * f).fillTriangle(
      px - w,
      py,
      px + w,
      py,
      px,
      py - h,
    );
    gg.fillStyle(BANDS[i], 0.95 * f).fillTriangle(
      px - w,
      py,
      px + w,
      py,
      px,
      py + h * 0.8,
    );
    gg.fillStyle(0xffffff, 0.7 * f).fillTriangle(
      px,
      py - h,
      px + w,
      py,
      px + 0.6 * d,
      py,
    );
    if (i === lit) sparkle(gg, px, py - h * 0.4, 3.4 * d, 0xffffff, 0.95 * f);
  });
}

/**
 * Cragmuff (Mountain aura): a ring of mossy stones on the ground and amber
 * crystals, the crystal of its horns, turning slowly round the fighter and
 * catching the light.
 */
function cragmuff(c: Ctx) {
  const { g, x, y, t } = c;
  // Stones, then their moss, each in one colour pass.
  const stones = Array.from({ length: 8 }, (_, i) =>
    onGround(c, (i / 8) * TAU + 0.2, 50),
  );
  g.fillStyle(0x7d6c58, 0.95);
  for (const p of stones) g.fillEllipse(p.x, p.y, 8, 4.4);
  g.fillStyle(0x7fae5a, 0.9);
  for (const p of stones) g.fillEllipse(p.x - 0.6, p.y - 1.2, 5, 2);
  orbit(c, 5, 50, 12000, 6, (gg, px, py, i, _a, d, f) => {
    const tall = (i % 2 ? 9 : 12) * d,
      w = (i % 2 ? 2.6 : 3.2) * d;
    const body: Pt[] = [
      { x: px - w, y: py },
      { x: px - w, y: py - tall * 0.7 },
      { x: px, y: py - tall },
      { x: px + w, y: py - tall * 0.7 },
      { x: px + w, y: py },
    ];
    gg.fillStyle(0xe58a2e, 0.95 * f).fillPoints(body, true);
    gg.fillStyle(0xffd28c, 0.95 * f).fillPoints(
      [body[1], body[2], { x: px, y: py }, body[0]],
      true,
    );
    const glint = c.reduced ? 0 : Math.max(0, Math.sin(t / 500 + i * 1.7)) ** 8;
    if (glint > 0.1) sparkle(gg, px, py - tall, 3 * d, 0xfff3c4, glint * f);
  });
}

/**
 * Tidelotl (Tidal aura): a ring of rolling water, its waves running round,
 * bubbles rising from it, and Tidelotl's pearl circling the fighter.
 */
function tidelotl(c: Ctx) {
  const { g, x, y, t, flat } = c;
  const roll = c.reduced ? 0 : t / 500;
  for (const [r, color, alpha, width] of [
    [49, 0x2f9fc4, 0.75, 3],
    [49, 0xbff6ff, 0.85, 1.2],
  ] as const) {
    const pts: Pt[] = [];
    // Smooth swells running round (enough points that it never looks
    // like a polygon), each cresting a little higher than it dips.
    for (let k = 0; k <= 60; k++) {
      const a = (k / 60) * TAU,
        swell = Math.sin(a * 6 - roll);
      const rr = r + swell * 1.8;
      pts.push({
        x: x + Math.cos(a) * rr,
        y: y + Math.sin(a) * rr * flat - (swell + 1) * 0.9,
      });
    }
    g.lineStyle(width, color, alpha).strokePoints(pts);
  }
  for (let i = 0; i < 4; i++) {
    const k = c.reduced ? 0.3 : (t / 2200 + i / 4) % 1;
    const p = onGround(c, i * 1.9 + Math.floor(t / 2200 + i / 4) * 2.7, 47);
    g.lineStyle(1, 0xe6fbff, 0.85 * (1 - k)).strokeCircle(
      p.x,
      p.y - 4 - k * 26,
      1.6 + k * 1.2,
    );
  }
  orbit(c, 1, 52, 5000, 8, (gg, px, py, _i, _a, d, f) => {
    gg.fillStyle(0x7fe9ff, 0.2 * f).fillCircle(px, py, 6.5 * d);
    gg.fillStyle(0xfff1f6, f).fillCircle(px, py, 3.4 * d);
    gg.fillStyle(0xffffff, 0.95 * f).fillCircle(
      px - 1 * d,
      py - 1.2 * d,
      1.1 * d,
    );
    const glint = c.reduced ? 0 : Math.max(0, Math.sin(t / 400)) ** 10;
    if (glint > 0.1)
      sparkle(gg, px + 2 * d, py - 2.5 * d, 3 * d, 0xffffff, glint * f);
  });
}

/** A crescent moon: a disc with a bite taken out, as one filled path. */
function crescent(
  gg: G,
  cx: number,
  cy: number,
  r: number,
  color: number,
  alpha: number,
) {
  gg.fillStyle(color, alpha).beginPath();
  gg.arc(cx, cy, r, Math.PI * 0.5, Math.PI * 1.5);
  gg.arc(cx - r * 0.45, cy, r * 0.8, Math.PI * 1.4, Math.PI * 0.6, true);
  gg.closePath().fillPath();
}
/**
 * Inkpurr (Nightmote): a ring of ink on the ground, rimmed with violet, and
 * the Lantern Yard's little lanterns circling the fighter with Inkpurr's
 * crescent moon.
 */
function inkpurr(c: Ctx) {
  const { g, x, y, t, flat } = c;
  g.lineStyle(4, 0x2a1f4a, 0.75).strokeEllipse(x, y, 100, 100 * flat);
  g.lineStyle(1.2, 0x9c7bff, 0.6).strokeEllipse(x, y, 106, 106 * flat);
  for (let i = 0; i < 6; i++) {
    const p = onGround(c, (i / 6) * TAU + 0.5, 50);
    g.fillStyle(0x2a1f4a, 0.85).fillEllipse(
      p.x,
      p.y + 1.5,
      5 + (i % 2) * 2,
      2.6,
    );
  }
  const flicker = c.reduced ? 1 : hash(Math.floor(t / 110));
  orbit(c, 4, 48, 7000, 18, (gg, px, py, i, _a, d, f) => {
    const bob = c.reduced ? 0 : Math.sin(t / 600 + i * 1.7) * 2.5;
    if (i === 3) crescent(gg, px, py + bob * d, 5 * d, 0xffd65b, f);
    else
      lantern(gg, px, py + bob * d, d * 0.85, f, 0xffd65b, 0x3a2c66, flicker);
  });
}

/** A dream rune: a few strokes, after the Dreamer's runes in Snoozaku's raid. */
const RUNES: number[][][] = [
  [
    [-3, -3, 3, 3],
    [-3, 3, 3, -3],
  ],
  [
    [0, -4, 0, 4],
    [-3, -1, 3, -1],
  ],
  [
    [-3, -3, 3, -3],
    [3, -3, -3, 3],
    [-3, 3, 3, 3],
  ],
  [
    [-3, 4, 0, -4],
    [0, -4, 3, 4],
    [-2, 1, 2, 1],
  ],
  [
    [-3, -4, -3, 4],
    [-3, 0, 3, -4],
    [-3, 0, 3, 4],
  ],
  [
    [0, -4, 3, 0],
    [3, 0, 0, 4],
    [0, 4, -3, 0],
    [-3, 0, 0, -4],
  ],
];
/** "z", drawn in three strokes. */
function zee(
  g: G,
  cx: number,
  cy: number,
  s: number,
  color: number,
  alpha: number,
) {
  g.lineStyle(Math.max(1, s * 0.26), color, alpha)
    .lineBetween(cx - s / 2, cy - s / 2, cx + s / 2, cy - s / 2)
    .lineBetween(cx + s / 2, cy - s / 2, cx - s / 2, cy + s / 2)
    .lineBetween(cx - s / 2, cy + s / 2, cx + s / 2, cy + s / 2);
}
/**
 * Snoozaku (Lullaby aura): the Dreamer's runes lie in a ring on the ground
 * and light up one after another, in order, as in Snoozaku's raid; stars
 * circle the fighter and sleepy z's drift up.
 */
function snoozaku(c: Ctx) {
  const { g, x, y, t, flat } = c;
  g.lineStyle(1.2, 0xc9a3ff, 0.45).strokeEllipse(x, y, 100, 100 * flat);
  const lit = c.reduced ? -1 : Math.floor(t / 450) % RUNES.length;
  const turn = c.reduced ? 0 : t / 14000;
  RUNES.forEach((rune, i) => {
    const p = onGround(c, turn + (i / RUNES.length) * TAU, 48);
    const on = i === lit;
    g.lineStyle(on ? 1.9 : 1.4, on ? 0xfff1c2 : 0xb48cff, on ? 1 : 0.8);
    for (const [x0, y0, x1, y1] of rune)
      g.lineBetween(
        p.x + x0,
        p.y + y0 * flat * 1.6,
        p.x + x1,
        p.y + y1 * flat * 1.6,
      );
  });
  orbit(c, 3, 44, 6000, 22, (gg, px, py, i, _a, d, f) => {
    const tw = c.reduced ? 1 : 0.6 + 0.4 * Math.sin(t / 300 + i * 2);
    sparkle(gg, px, py, 3 * d * tw, i % 2 ? 0xffd86b : 0xc9a3ff, 0.95 * f);
  });
  for (let i = 0; i < 2; i++) {
    const k = c.reduced ? 0.5 : (t / 2600 + i / 2) % 1;
    zee(
      g,
      x + (i ? 30 : -34) + Math.sin(k * 6) * 2,
      y - 26 - k * 30,
      4 + k * 3,
      0x9f7bff,
      Math.min(1, k * 4) * (1 - k),
    );
  }
}

const RAID_AURAS: Record<string, (c: Ctx) => void> = {
  "spark-aura": stormTwins,
  "ember-aura": lumiwick,
  "halo-aura": prismell,
  "mountain-aura": cragmuff,
  "tidal-aura": tidelotl,
  nightmote: inkpurr,
  "lullaby-aura": snoozaku,
};
/** Draw a raid boss's aura (its own items; the flourish comes after). */
export function drawRaidAura(
  g: G,
  id: string,
  x: number,
  y: number,
  now: number,
  reduced: boolean,
  front: G | undefined,
  flat: number,
  lift: number,
) {
  const draw = RAID_AURAS[id];
  if (!draw) return false;
  draw({ g, front, x, y, t: reduced ? 0 : now, reduced, flat, lift });
  return true;
}
export const RAID_AURA_IDS = Object.keys(RAID_AURAS);
