import type Phaser from "phaser";
import { WORLD_ART } from "../../../../packages/shared/src/world-art";
import type { FxParticle } from "./skin-fx";
import { sparkle } from "./skin-fx";

/**
 * The raid bosses' victories, t seconds into the finale (0 to 3, fading out
 * from 2.4), all behind the fighter on `under`, in their bosses' looks since
 * the bosses were remade (14 Nov; owner, 26 Nov: the boss effects were
 * "khá outdated"). Ids stay the old boss names (CLAUDE.md, raid-roster.ts).
 *
 * In a match the fighter's name and health bar sit about 80 to 120 units
 * over the effect's origin and 65 either side: a finale that settled there
 * was hidden on a phone (Crescent Bow's moon, Twin Spark's pair, Sweet
 * Dreams' baku). What stays now settles below that band or beside the
 * fighter; only things in flight (lanterns rising) pass through it. On a
 * phone's Wardrobe stage the column of buttons covers the stage's right
 * side from about 45 units out, so a finale's main piece (the moon, the
 * wave's curl, the baku) stands on the left, and nothing reaches past
 * about 80 either side.
 */
type G = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };
type Emit = (p: FxParticle) => void;
const TAU = Math.PI * 2;
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const pop = (k: number) =>
  k <= 0 ? 0 : k >= 1 ? 1 : 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
/** Crossed `at` this frame. */
const crossed = (t: number, dt: number, at: number) => t >= at && t - dt < at;

interface Finale {
  under: G;
  emit: Emit;
  chance: (rate: number, dt: number) => boolean;
  x: number;
  y: number;
  sc: number;
  t: number;
  dt: number;
  /** 1, fading to 0 from 2.4 s to 3 s. */
  fade: number;
  /** The floor, where the feet stand. */
  gy: number;
}

/** A thunder-jelly: a round bell with eyes and wavy tentacles. */
function jelly(
  g: G,
  cx: number,
  cy: number,
  s: number,
  color: number,
  t: number,
  alpha: number,
) {
  g.fillStyle(color, 0.2 * alpha).fillCircle(cx, cy, 15 * s);
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
  g.arc(cx, cy, 9 * s, Math.PI, TAU)
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
/** A jagged bolt, re-forking with `seed`. */
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
  for (let i = 0; i <= 5; i++) {
    const k = i / 5,
      jitter = i === 0 || i === 5 ? 0 : (hash(seed + i) - 0.5) * 16 * sc;
    pts.push({ x: x0 + (x1 - x0) * k + jitter, y: y0 + (y1 - y0) * k });
  }
  g.lineStyle(7 * sc, color, 0.25 * alpha).strokePoints(pts);
  g.lineStyle(2.6 * sc, color, alpha).strokePoints(pts);
  g.lineStyle(1 * sc, 0xffffff, alpha).strokePoints(pts);
}
/**
 * Storm Twins (Twin Spark): the two thunder-jellies, gold and ice blue, pop
 * in either side of the fighter and dance on their crackling ribbon; they
 * meet behind its head in a shower of sparks, and bolts crack down to the
 * floor beside it.
 */
function stormTwins(f: Finale) {
  const { under: g, x, y, sc, t, dt, fade, gy } = f;
  const s = sc * 1.6 * pop(span(t, 0, 0.3));
  const meet = Math.sin(Math.PI * span(t, 0.75, 1.35));
  const pos = (side: number) => {
    const a = t * 2.4 + (side > 0 ? Math.PI : 0);
    return {
      x: x + side * (50 - 32 * meet) * sc + Math.cos(a) * 6 * sc,
      y: y - (50 + 6 * meet) * sc + Math.sin(a * 2) * 6 * sc,
    };
  };
  const a = pos(-1),
    b = pos(1);
  if (s > 0.05 * sc) {
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
            Math.sin(k * Math.PI) * 10 * sc +
            (i % 8
              ? (hash(seed + i + Math.floor(t * 18) * 9) - 0.5) * 7 * sc
              : 0),
        });
      }
      g.lineStyle(2.4 * sc, color, 0.9 * fade).strokePoints(pts);
    }
    jelly(g, a.x, a.y, s, 0xffe18b, t, fade);
    jelly(g, b.x, b.y, s, 0x8edfff, t, fade);
  }
  // Where they meet: a flash and a shower of sparks behind the head.
  const flash = span(t, 1.0, 1.35);
  if (flash > 0 && flash < 1) {
    g.fillStyle(0xffffff, 0.5 * (1 - flash) * fade).fillCircle(
      x,
      y - 56 * sc,
      (10 + 26 * flash) * sc,
    );
    g.lineStyle(2 * sc, 0xffe18b, 0.8 * (1 - flash) * fade).strokeCircle(
      x,
      y - 56 * sc,
      (14 + 40 * flash) * sc,
    );
  }
  if (crossed(t, dt, 1.0))
    for (let i = 0; i < 16; i++) {
      const an = (i / 16) * TAU;
      f.emit({
        x,
        y: y - 56 * sc,
        vx: Math.cos(an) * rnd(90, 150),
        vy: Math.sin(an) * rnd(70, 120) - 30,
        life: rnd(0.6, 0.9),
        size: 2.6 * sc,
        color: i % 2 ? 0xffe18b : 0x8edfff,
        shape: "star",
        drag: 1.4,
      });
    }
  // Bolts from each jelly down to the floor beside the fighter.
  for (const at of [0.45, 1.6, 2.15]) {
    const k = (t - at) / 0.18;
    if (k >= 0 && k < 1)
      for (const [side, p, color] of [
        [-1, a, 0xffe18b],
        [1, b, 0x8edfff],
      ] as const)
        bolt(
          g,
          p.x,
          p.y + 10 * sc,
          x + side * 44 * sc,
          gy,
          11 + Math.floor(t * 30) * 5 + side,
          color,
          (1 - k) * fade,
          sc,
        );
  }
}

/** A sky lantern lit from inside. */
function lantern(
  g: G,
  cx: number,
  cy: number,
  s: number,
  alpha: number,
  flicker: number,
) {
  g.fillStyle(0xffb347, 0.18 * alpha).fillCircle(cx, cy, 13 * s);
  g.fillStyle(0xff8a4f, alpha).fillEllipse(cx, cy, 11 * s, 14 * s);
  g.fillStyle(0xffe6a6, (0.6 + 0.3 * flicker) * alpha).fillEllipse(
    cx,
    cy + 1 * s,
    6 * s,
    9 * s,
  );
  g.fillStyle(0xfffbe8, (0.8 + 0.2 * flicker) * alpha).fillEllipse(
    cx,
    cy + 2 * s,
    2.4 * s,
    4 * s,
  );
  g.fillStyle(0x8a3b1f, alpha)
    .fillRect(cx - 3.4 * s, cy - 8 * s, 6.8 * s, 1.8 * s)
    .fillRect(cx - 2.8 * s, cy + 6.4 * s, 5.6 * s, 1.8 * s);
}
/** A feather of light: a leaf of warm light with a bright quill. */
function feather(
  g: G,
  cx: number,
  cy: number,
  s: number,
  tilt: number,
  alpha: number,
) {
  const dx = Math.sin(tilt) * 9 * s,
    dy = Math.cos(tilt) * 9 * s;
  g.fillStyle(0xffc86b, 0.95 * alpha)
    .fillTriangle(
      cx - dx,
      cy - dy,
      cx + dx,
      cy + dy,
      cx - dy * 0.35,
      cy + dx * 0.35,
    )
    .fillTriangle(
      cx - dx,
      cy - dy,
      cx + dx,
      cy + dy,
      cx + dy * 0.35,
      cy - dx * 0.35,
    );
  g.lineStyle(1 * s, 0xfff1c2, alpha).lineBetween(
    cx - dx,
    cy - dy,
    cx + dx,
    cy + dy,
  );
}
/**
 * Lumiwick (Feather Fall): sky lanterns are let go one after another from
 * round the fighter and float up into the night, while feathers of warm
 * light come drifting down round it.
 */
function lumiwick(f: Finale) {
  const { under: g, x, y, sc, t, fade, gy } = f;
  g.fillStyle(0xffb347, 0.16 * fade).fillEllipse(x, gy, 130 * sc, 30 * sc);
  const flicker = hash(Math.floor(t * 12));
  const starts = [0.05, 0.3, 0.55, 0.8, 1.05, 1.3];
  const from = [-46, 34, -22, 46, -64, 12];
  starts.forEach((start, i) => {
    const k = span(t, start, start + 1.9);
    if (k <= 0 || k >= 1) return;
    const cx = x + (from[i] + Math.sin(t * 2.2 + i) * 6 * k) * sc,
      cy = y + 4 * sc - easeOut(k) * (150 + (i % 3) * 25) * sc;
    lantern(
      g,
      cx,
      cy,
      sc * (1.5 - 0.45 * k),
      Math.min(1, k * 8) * (1 - span(k, 0.75, 1)) * fade,
      flicker,
    );
  });
  for (let i = 0; i < 8; i++) {
    const k = span(t, 0.5 + i * 0.16, 2.3 + i * 0.16);
    if (k <= 0 || k >= 1) continue;
    const cx =
        x +
        ((i % 2 ? 1 : -1) * (24 + (i % 4) * 12) + Math.sin(k * 7 + i) * 10) *
          sc,
      cy = y - (80 - 90 * k) * sc;
    feather(
      g,
      cx,
      cy,
      sc * 1.35,
      Math.sin(k * 6 + i) * 0.9,
      Math.min(1, k * 5) * (1 - span(k, 0.7, 1)) * fade,
    );
  }
}

/**
 * A crescent moon as one filled path: the disc's lit limb, then back along
 * the edge of the bite (a disc 0.95 as big, 0.4 r off centre). `facing` is
 * the side the bite is on, where the horns point.
 */
function crescent(
  g: G,
  cx: number,
  cy: number,
  r: number,
  color: number,
  alpha: number,
  facing: 1 | -1,
) {
  const d = 0.4 * r * facing,
    r1 = 0.95 * r;
  const ix = (d * d + r * r - r1 * r1) / (2 * d),
    iy = Math.sqrt(r * r - ix * ix);
  g.fillStyle(color, alpha).beginPath();
  g.arc(cx, cy, r, Math.atan2(iy, ix), Math.atan2(-iy, ix), facing < 0);
  g.arc(
    cx + d,
    cy,
    r1,
    Math.atan2(-iy, ix - d),
    Math.atan2(iy, ix - d),
    facing > 0,
  );
  g.closePath().fillPath();
}
/**
 * Inkpurr (Crescent Bow): a pool of ink spreads at the feet, a crescent moon
 * rises beside the fighter as it bows, and two lanterns of the Lantern Yard
 * light up and bob on the other side. (The moon was a disc with a dark one drawn
 * over it, which showed as a black ball on the sand court.)
 */
function inkpurr(f: Finale) {
  const { under: g, x, y, sc, t, fade, gy } = f;
  const pool = easeOut(span(t, 0, 0.4));
  g.fillStyle(0x231a3d, 0.85 * fade).fillEllipse(
    x,
    gy,
    120 * sc * pool,
    28 * sc * pool,
  );
  g.lineStyle(1.6 * sc, 0x9c7bff, 0.7 * fade).strokeEllipse(
    x,
    gy,
    122 * sc * pool,
    29 * sc * pool,
  );
  const rise = easeOut(span(t, 0.1, 0.9));
  const mx = x - 50 * sc,
    my = y - (12 + 42 * rise) * sc,
    r = 24 * sc;
  g.fillStyle(0xffd65b, 0.2 * fade).fillCircle(mx, my, r * 1.6);
  // Horns toward the fighter, its lit back to the night.
  crescent(g, mx, my, r, 0xffd65b, 0.95 * fade, 1);
  const flicker = hash(Math.floor(t * 12));
  [
    [46, 52, 0.35],
    [62, 28, 0.55],
  ].forEach(([dx, up, start]) => {
    const on = span(t, start, start + 0.3);
    if (on <= 0) return;
    const cx = x + dx * sc,
      cy = y - (up + Math.sin(t * 2.4 + dx) * 3) * sc;
    lantern(g, cx, cy, sc * 1.3, on * fade, flicker);
  });
  if (f.chance(10, f.dt))
    f.emit({
      x: x + rnd(-80, 80) * sc,
      y: y - rnd(20, 70) * sc,
      vx: 0,
      vy: rnd(-10, 10),
      life: rnd(0.8, 1.2),
      size: 2.4 * sc,
      color: 0xfff1c2,
      shape: "star",
    });
}

/**
 * Tidelotl (Splashdown): a wave rears up behind the fighter, curls over and
 * crashes in spray and surf; Tidelotl's pearl glints in the foam.
 */
function tidelotl(f: Finale) {
  const { under: g, x, sc, t, dt, fade, gy } = f;
  const rise = easeOut(span(t, 0, 0.55)),
    crash = span(t, 0.8, 1.2) ** 2;
  // Its crest peaks just under a match's health bar.
  const H = 96 * sc * rise * (1 - crash * 0.85);
  if (H > 3 * sc && crash < 1) {
    const lean = 30 * sc * crash,
      a = fade * (1 - crash * 0.6);
    // Drawn curling to the left (the side a phone's Wardrobe stage keeps
    // clear of its buttons): dx counts leftwards.
    const P = (dx: number, up: number, curl = 0): Pt => ({
      x: x - dx * sc - lean * curl,
      y: gy - H * up,
    });
    const body = [
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
      P(54, 0.55, 0.8),
      P(62, 0.4, 0.5),
      P(80, 0.24, 0.2),
      P(95, 0.12),
      P(95, 0),
    ];
    g.fillStyle(0x1f7fa8, 0.9 * a).fillPoints(body, true);
    g.fillStyle(0x4fc3e0, 0.9 * a).fillPoints(
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
        .fillStyle(0xffffff, 0.95 * a)
        .fillCircle(p.x, p.y, (2.4 + (i % 3) * 1.1 + i * 0.25) * sc),
    );
  }
  if (crossed(t, dt, 0.95))
    for (let i = 0; i < 26; i++)
      f.emit({
        x: x + rnd(-50, 50) * sc,
        y: gy - rnd(10, 40) * sc,
        vx: rnd(-170, 170),
        vy: rnd(-240, -70),
        life: rnd(0.7, 1.1),
        size: rnd(2, 3.4) * sc,
        color: i % 3 ? 0xe6fbff : 0x7fe9ff,
        shape: "dot",
      });
  // The water runs out across the floor, foam riding its edges.
  const surf = span(t, 0.95, 2.6);
  if (surf > 0 && surf < 1) {
    const out = easeOut(surf),
      a = (1 - surf) * fade;
    g.fillStyle(0x4fc3e0, 0.35 * a).fillEllipse(
      x,
      gy,
      (90 + 120 * out) * sc,
      (16 + 10 * out) * sc,
    );
    for (const side of [-1, 1])
      for (let j = 0; j < 5; j++) {
        const r = (6 - j) * sc;
        g.fillStyle(0xffffff, 0.9 * a).fillEllipse(
          x + side * (40 + 62 * out - j * 9) * sc,
          gy + ((j % 2) * 3 - 1) * sc,
          r * 2.2,
          r,
        );
      }
  }
  const glint = span(t, 1.3, 2.4);
  if (glint > 0 && glint < 1) {
    const px = x - 40 * sc,
      py = gy - 6 * sc;
    g.fillStyle(0xfff1f6, fade).fillCircle(px, py, 3.6 * sc);
    sparkle(
      g,
      px + 2 * sc,
      py - 3 * sc,
      6 * sc * Math.sin(glint * Math.PI),
      0xffffff,
      fade,
    );
  }
}

/**
 * Snoozaku (Sweet Dreams): a little dream baku in a nightcap drifts up
 * beside the fighter (it used to rise over the head, behind a match's
 * health bar), stars twinkling round it.
 */
function snoozaku(f: Finale) {
  const { under: g, x, y, sc, t, fade } = f;
  // The baku at four fifths of its old size, so it fits beside the fighter.
  const k = 0.8 * sc,
    rise = Math.min(1, t / 0.8),
    wx = x - 54 * sc + Math.sin(t * 1.8) * 5 * sc,
    wy = y - (15 + rise * 24) * sc;
  g.fillStyle(0xc9a3ff, 0.18 * fade).fillEllipse(x, f.gy, 136 * sc, 34 * sc);
  g.fillStyle(0x9a91e0, fade).fillEllipse(
    wx - 6 * k,
    wy + 4 * k,
    62 * k,
    36 * k,
  );
  g.fillStyle(0xf6e6c8, fade).fillEllipse(
    wx - 12 * k,
    wy + 4 * k,
    20 * k,
    34 * k,
  );
  g.fillStyle(0x9a91e0, fade).fillCircle(wx + 20 * k, wy - 8 * k, 17 * k);
  g.fillStyle(0xfff1dc, fade).fillCircle(wx + 8 * k, wy - 18 * k, 6 * k);
  g.fillStyle(0x9a91e0, fade)
    .fillCircle(wx + 34 * k, wy - 2 * k, 6 * k)
    .fillCircle(wx + 37 * k, wy + 5 * k, 5.5 * k);
  g.fillStyle(0xe7b8dc, fade).fillCircle(wx + 38 * k, wy + 10 * k, 4.5 * k);
  g.fillStyle(0x433d9a, fade).fillTriangle(
    wx + 6 * k,
    wy - 20 * k,
    wx + 34 * k,
    wy - 22 * k,
    wx + 8 * k,
    wy - 46 * k,
  );
  g.fillStyle(0xfff4dc, fade)
    .fillCircle(wx + 6 * k, wy - 46 * k, 4.5 * k)
    .fillEllipse(wx + 20 * k, wy - 21 * k, 30 * k, 8 * k);
  g.lineStyle(1.5 * k, 0x283452, fade).lineBetween(
    wx + 20 * k,
    wy - 8 * k,
    wx + 27 * k,
    wy - 7 * k,
  );
  if (f.chance(12, f.dt))
    f.emit({
      x: wx + rnd(-40, 40) * sc,
      y: wy + rnd(-30, 25) * sc,
      vx: rnd(-15, 15),
      vy: rnd(-35, -10),
      life: 1,
      size: 2.5 * sc,
      color: 0xffdf8d,
      shape: "star",
    });
}

const RAID_VICTORIES: Record<string, (f: Finale) => void> = {
  "twin-spark": stormTwins,
  "feather-fall": lumiwick,
  "crescent-bow": inkpurr,
  splashdown: tidelotl,
  "sweet-dreams": snoozaku,
};
const finale = (
  under: G,
  emit: Emit,
  chance: Finale["chance"],
  x: number,
  y: number,
  sc: number,
  t: number,
  dt: number,
): Finale => ({
  under,
  emit,
  chance,
  x,
  y,
  sc,
  t,
  dt,
  fade: t > 2.4 ? Math.max(0, 1 - (t - 2.4) / 0.6) : 1,
  gy: y + WORLD_ART.fighterFeet * sc,
});
/** Draw a raid boss's victory. False when it is not one, or has played. */
export function drawRaidVictory(
  under: G,
  emit: Emit,
  chance: Finale["chance"],
  id: string,
  x: number,
  y: number,
  sc: number,
  t: number,
  dt: number,
) {
  const draw = RAID_VICTORIES[id];
  if (!draw || t > 3) return false;
  draw(finale(under, emit, chance, x, y, sc, t, dt));
  return true;
}
export const RAID_VICTORY_IDS = Object.keys(RAID_VICTORIES);

/**
 * Cragmuff (Rockslide Flex) is the rig's own: a pile of rocks rises under
 * the fighter, who flexes on top (rig.ts). Beside it, amber crystals (the
 * crystal of Cragmuff's horns) burst up from the ground as the pile lands,
 * dust rolls out, and they glint until the pile sinks. In a match the rig
 * draws its pile first on the same layer, so the crystals stand clear of
 * it (the pile is about 30 units either side), never over its stones.
 */
export function drawRaidVictoryBackdrop(
  under: G,
  id: string,
  x: number,
  y: number,
  sc: number,
  t: number,
) {
  if (id !== "rockslide-flex" || t > 3) return;
  const f = finale(
    under,
    () => {},
    () => false,
    x,
    y,
    sc,
    t,
    0,
  );
  const { gy, fade } = f;
  const dust = span(t, 0.3, 1.1);
  if (dust > 0 && dust < 1)
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++)
        under
          .fillStyle(0xb8a48a, 0.45 * (1 - dust) * fade)
          .fillCircle(
            x + side * (42 + i * 14 + 24 * dust) * sc,
            gy - (4 + i * 3) * sc,
            (8 + 10 * dust - i) * sc,
          );
  // x offset, height, width: tallest nearest the pile, smaller outwards.
  const crystals: [number, number, number][] = [
    [-44, 68, 16],
    [44, 68, 16],
    [-62, 48, 13],
    [62, 48, 13],
    [-78, 28, 10],
    [78, 28, 10],
  ];
  crystals.forEach(([dx, tall, wide], i) => {
    const up =
      pop(span(t, 0.32 + i * 0.04, 0.62 + i * 0.04)) * (t > 2.4 ? fade : 1);
    if (up < 0.02) return;
    const bx = x + dx * sc,
      by = gy - 4 * sc,
      h = tall * sc * up,
      w = wide * sc * 0.5;
    const body: Pt[] = [
      { x: bx - w, y: by },
      { x: bx - w, y: by - h * 0.72 },
      { x: bx, y: by - h },
      { x: bx + w, y: by - h * 0.72 },
      { x: bx + w, y: by },
    ];
    under.fillStyle(0xe58a2e, 0.95 * fade).fillPoints(body, true);
    under
      .fillStyle(0xffd28c, 0.95 * fade)
      .fillPoints([body[1], body[2], { x: bx, y: by }, body[0]], true);
    under.lineStyle(1.2 * sc, 0x8a4f1c, 0.8 * fade).strokePoints(body, true);
    const glint = Math.max(0, Math.sin(t * 5 + i * 1.9)) ** 6;
    if (t > 0.7 && glint > 0.1)
      sparkle(under, bx, by - h + 2 * sc, 5 * sc, 0xfff3c4, glint * fade);
  });
}
