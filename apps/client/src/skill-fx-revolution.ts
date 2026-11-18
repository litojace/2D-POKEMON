import type Phaser from "phaser";
import type { Ability, Zone } from "@arena/shared";
import { fxFor } from "./fx-engine";
import { TAU, ease, hash, type FxKit, type G, type Shot } from "./fx-kits";
/**
 * The skill revolution's moves (docs/skill-revolution.md), wave A: River
 * Dash and the court-wide Riptide Wave (Tidefin), Ball Lightning's zaps and
 * Thunderstorm (Voltkit), Wraith Hunt (Duskveil) and the hanging Radiant
 * Flare (Lumoth). Every size comes from the ability or the zone the server
 * sent, so what players see is what can hit them. Warnings (the wave's lane,
 * the bolts' marks, the flare's pull and burst rings, the wraith itself) are
 * drawn inside `fx.essential`, so Low's glow budget never shrinks them.
 */
const WHITE = 0xffffff;
const FOAM = 0xe9fbff;
const DEEP = 0x0b5f86;
const PALE = 0xfff6c2;
const SUN = 0xfff3b0;
const GHOST = 0xc9b6ff;
const SQ = 0.82;

/**
 * How far through its life a zone is (0 → 1), from what the server sent: the
 * drawn progress is measured against the ability's duration, which a zone's
 * own life (until − born) may not match (Thunderstorm's bolts).
 */
function lifeOf(z: Zone, progress: number) {
  const life = Math.max(
    0.01,
    z.until - (z.born ?? z.until - z.ability.duration),
  );
  const left = Math.max(0, (1 - progress) * z.ability.duration);
  return Math.max(0, Math.min(1, 1 - left / life));
}
const struck = new Set<number>();
/** Run `fn` once for this zone (a bolt striking, a flare bursting). */
function onceFor(id: number, fn: () => void) {
  if (struck.has(id)) return;
  struck.add(id);
  if (struck.size > 200) struck.delete(struck.values().next().value!);
  fn();
}

// ───────────── Tidefin · River Dash ─────────────
/** A jet of water under Tidefin for the length of the dash. */
const riverDash: NonNullable<FxKit["cast"]>[string] = (
  scene,
  a,
  x,
  y,
  angle,
  color,
  shot,
  at,
) => {
  const fx = fxFor(scene),
    seconds = a.range / Math.max(1, a.speed);
  fx.burst({
    x,
    y: y + 10,
    z: 6,
    count: 14,
    kind: "drop",
    color: [color, FOAM],
    angle: angle + Math.PI,
    spread: 0.7,
    speed: [80, 260],
    up: [60, 180],
    life: [0.35, 0.6],
    size: [1.4, 2.6],
    grav: 1100,
  });
  shot(seconds * 1000 + 120, (k) => {
    const p = at?.() ?? {
      x: x + Math.cos(angle) * a.range * Math.min(1, k),
      y: y + Math.sin(angle) * a.range * Math.min(1, k),
    };
    const fade = 1 - k * 0.6;
    // The jet: a bright streak from where it left to where Tidefin is now.
    fx.floorSolid
      .lineStyle(26 * fade, color, 0.35 * fade)
      .lineBetween(x, y + 12, p.x, p.y + 12);
    fx.floor
      .lineStyle(10 * fade, FOAM, 0.55 * fade)
      .lineBetween(x, y + 12, p.x, p.y + 12);
    fx.glow(p.x, p.y + 6, 34, color, 0.45 * fade, true);
    fx.trail(`rd${Math.round(x)}${Math.round(y)}`, 0.03, () =>
      fx.burst({
        x: p.x,
        y: p.y + 12,
        z: 6,
        count: 3,
        kind: "drop",
        color: [FOAM, color],
        angle: angle + Math.PI,
        spread: 0.9,
        speed: [40, 140],
        up: [60, 160],
        life: [0.3, 0.5],
        size: [1.2, 2.2],
        grav: 1100,
      }),
    );
  });
};

// ───────────── Tidefin · Riptide Wave ─────────────
function waveWindup(
  g: G,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  _ax: number,
  _ay: number,
  color: number,
  k: number,
) {
  const fx = fxFor(g.scene),
    nx = -Math.sin(angle),
    ny = Math.cos(angle),
    len = Math.min(a.range, 520) * (0.4 + k * 0.6),
    w = a.radius;
  // Its true lane, as wide as the wall of water, filling in as it charges.
  fx.floorSolid.fillStyle(color, 0.08 + k * 0.12);
  fx.floorSolid.fillPoints(
    [
      { x: x + nx * w, y: y + ny * w },
      {
        x: x + Math.cos(angle) * len + nx * w,
        y: y + Math.sin(angle) * len + ny * w,
      },
      {
        x: x + Math.cos(angle) * len - nx * w,
        y: y + Math.sin(angle) * len - ny * w,
      },
      { x: x - nx * w, y: y - ny * w },
    ],
    true,
  );
  fx.floor.lineStyle(3, FOAM, 0.3 + k * 0.5);
  fx.floor.lineBetween(x + nx * w, y + ny * w, x - nx * w, y - ny * w);
  fx.glow(x, y - 12, 30 + k * 40, color, 0.4 + k * 0.4);
}
/** The wall of water: a curled crest across its whole width, at its front. */
function riptideWave(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    a = z.ability,
    w = z.radius,
    c = z.color,
    ang = z.angle ?? 0,
    cos = Math.cos(ang),
    sin = Math.sin(ang),
    nx = -sin,
    ny = cos,
    k = lifeOf(z, progress),
    front = a.range * k,
    fx0 = z.x + cos * front,
    fy0 = z.y + sin * front;
  fx.essential(() => {
    // The lane still ahead of it (it crosses the whole court): jump it.
    const ahead = Math.min(a.range - front, 360);
    if (ahead > 4) {
      fx.floorSolid.fillStyle(c, 0.12);
      fx.floorSolid.fillPoints(
        [
          { x: fx0 + nx * w, y: fy0 + ny * w },
          { x: fx0 + cos * ahead + nx * w, y: fy0 + sin * ahead + ny * w },
          { x: fx0 + cos * ahead - nx * w, y: fy0 + sin * ahead - ny * w },
          { x: fx0 - nx * w, y: fy0 - ny * w },
        ],
        true,
      );
    }
  });
  // Wet floor behind it.
  for (let i = 1; i <= 3; i++) {
    const b = i * 46;
    fx.floorSolid
      .lineStyle(18 - i * 4, c, 0.22 - i * 0.05)
      .lineBetween(
        fx0 - cos * b + nx * w,
        fy0 - sin * b + ny * w,
        fx0 - cos * b - nx * w,
        fy0 - sin * b - ny * w,
      );
  }
  const crest = (back: number, lift: number) =>
    Array.from({ length: 21 }, (_, i) => {
      const s = i / 20 - 0.5,
        bulge = Math.cos(s * Math.PI) * 14 - back,
        chop = lift > 0 ? Math.sin(s * 17 + now / 90 + z.id) * 5 : 0;
      return {
        x: fx0 + cos * bulge + nx * s * 2 * w,
        y:
          fy0 +
          sin * bulge +
          ny * s * 2 * w -
          lift * (0.6 + 0.4 * Math.cos(s * Math.PI)) -
          chop,
      };
    });
  const base = crest(46, 0),
    top = crest(0, 40 + Math.sin(now / 80) * 3);
  fx.solid
    .fillStyle(DEEP, 0.8)
    .fillPoints([...base, ...top.slice().reverse()], true);
  fx.solid
    .fillStyle(c, 0.95)
    .fillPoints([...crest(34, 8), ...crest(4, 34).reverse()], true);
  fx.solid.lineStyle(8, FOAM, 0.95).strokePoints(top, false);
  fx.glow(fx0, fy0 - 12, Math.min(w, 120), c, 0.3);
  fx.trail(`rw${z.id}`, 0.03, () => {
    const p = top[Math.floor(Math.random() * top.length)];
    fx.burst({
      x: p.x,
      y: p.y + 30,
      z: 30,
      count: 2,
      kind: "drop",
      color: [FOAM, c],
      angle: ang,
      spread: 0.8,
      speed: [40, 160],
      up: [80, 200],
      life: [0.35, 0.55],
      size: [1.4, 2.4],
      grav: 1100,
    });
  });
}
/** Slammed into a wall by the wave: a burst of spray. */
function waveSlam(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  fx.burst({
    x,
    y: y + 10,
    z: 16,
    count: 26,
    kind: "drop",
    color: [color, FOAM],
    speed: [120, 380],
    up: [140, 360],
    life: [0.45, 0.8],
    size: [1.6, 3],
    grav: 1100,
  });
  fx.decal({ kind: "wet", x, y: y + 10, r: 60, color, life: 3 });
  fx.shake(160, 0.005);
  shot(fx.reduced ? 160 : 360, (k) => {
    fx.shockwave(x, y + 8, 70 * ease(k), k, FOAM, 8);
    fx.glow(x, y, 50, color, 0.5 * (1 - k));
  });
}
const waveCast: NonNullable<FxKit["cast"]>[string] = (
  scene,
  _a,
  x,
  y,
  _angle,
  color,
) => {
  const fx = fxFor(scene);
  fx.ultimate(color);
  fx.shake(220, 0.004);
  fx.burst({
    x,
    y,
    z: 10,
    count: 20,
    kind: "drop",
    color: [color, FOAM],
    speed: [80, 260],
    up: [120, 300],
    life: [0.4, 0.8],
    size: [1.6, 2.8],
    grav: 1100,
  });
};

// ───────────── Voltkit · Ball Lightning's zaps ─────────────
function ballZap(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  tx: number,
  ty: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    seed = Math.floor(Math.random() * 1000);
  shot(fx.reduced ? 100 : 200, (k) => {
    const fade = 1 - k;
    fx.bolt(x, y - 10, tx, ty - 18, color, {
      width: 2.6 * fade + 0.6,
      jag: 0.3,
      branches: 1,
      seed: seed + Math.floor(k * 4),
      alpha: fade,
    });
    fx.glow(tx, ty - 18, 22, color, 0.6 * fade);
  });
}

// ───────────── Voltkit · Thunderstorm ─────────────
function stormWindup(
  g: G,
  _a: Ability,
  x: number,
  y: number,
  _angle: number,
  _ax: number,
  _ay: number,
  color: number,
  k: number,
  now: number,
) {
  const fx = fxFor(g.scene),
    top = y - 60 - k * 50;
  fx.glow(x, y - 30, 26 + k * 40, color, 0.4 + k * 0.5);
  fx.glow(x, top, 18 + k * 30, PALE, 0.3 + k * 0.5);
  const seed = Math.floor(now / 50);
  fx.bolt(x, y - 30, x + (hash(seed) - 0.5) * 30, top, color, {
    width: 1.2 + k * 1.6,
    jag: 0.3,
    seed,
    alpha: 0.5 + k * 0.5,
  });
}
const stormCast: NonNullable<FxKit["cast"]>[string] = (
  scene,
  _a,
  x,
  y,
  _angle,
  color,
  shot,
) => {
  const fx = fxFor(scene);
  fx.ultimate(color, 2200, true);
  fx.shake(200, 0.004);
  shot(fx.reduced ? 160 : 420, (k) => {
    fx.bolt(x, y - 30, x, y - 420, color, {
      width: 4 * (1 - k) + 1,
      jag: 0.2,
      branches: 2,
      seed: Math.floor(k * 6),
      alpha: 1 - k,
    });
    fx.glow(x, y - 30, 60, PALE, 0.7 * (1 - k));
  });
};
/**
 * A bolt's mark: a ring that tightens until it strikes (the warning), then
 * the strike from the sky. The storm itself (radius 0) draws nothing.
 */
function stormBolt(g: G, z: Zone, progress: number, now: number) {
  if (z.radius <= 0) return;
  const fx = fxFor(g.scene),
    a = z.ability,
    c = z.color,
    r = z.radius,
    life = Math.max(0.01, z.until - (z.born ?? z.until)),
    strikeAt = Math.min(0.99, (a.tickDelay ?? 0.55) / life),
    k = lifeOf(z, progress);
  if (k < strikeAt) {
    const kk = k / strikeAt;
    fx.essential(() => {
      fx.floorSolid
        .fillStyle(c, 0.1 + kk * 0.14)
        .fillEllipse(z.x, z.y, r * 2, r * 2 * SQ);
      fx.floor
        .lineStyle(3, c, 0.6 + kk * 0.4)
        .strokeEllipse(z.x, z.y, r * 2, r * 2 * SQ);
      fx.floor
        .lineStyle(2, PALE, 0.5 + kk * 0.5)
        .strokeEllipse(
          z.x,
          z.y,
          r * 2 * (1 - kk * 0.8),
          r * 2 * SQ * (1 - kk * 0.8),
        );
      fx.glow(z.x, z.y, r * 0.5 * (0.4 + kk), c, 0.25 + kk * 0.35, true);
    });
    return;
  }
  const kk = Math.min(1, (k - strikeAt) / Math.max(0.01, 1 - strikeAt));
  onceFor(z.id, () => {
    fx.burst({
      x: z.x,
      y: z.y,
      z: 8,
      count: 18,
      kind: "spark",
      color: [c, WHITE, PALE],
      speed: [120, 380],
      up: [80, 300],
      life: [0.3, 0.6],
      size: [1, 1.8],
      grav: 1000,
      bounce: 0.4,
    });
    fx.decal({ kind: "scorch", x: z.x, y: z.y, r: r * 0.6, color: c, life: 3 });
    fx.shake(90, 0.003);
  });
  const seed = Math.floor(now / 40);
  fx.bolt(z.x + (hash(z.id) - 0.5) * 40, z.y - 480, z.x, z.y - 6, c, {
    width: 5 * (1 - kk) + 1,
    jag: 0.18,
    branches: 2,
    seed: seed + z.id,
    alpha: 1 - kk * 0.8,
  });
  fx.bolt(z.x, z.y - 480, z.x, z.y - 6, WHITE, {
    width: 2 * (1 - kk) + 0.5,
    jag: 0.18,
    branches: 0,
    seed: seed + z.id,
    alpha: 1 - kk * 0.8,
  });
  fx.glow(z.x, z.y - 10, r * 0.9, PALE, 0.8 * (1 - kk));
  fx.shockwave(z.x, z.y, r * ease(kk), kk, c, 8);
}

// ───────────── Duskveil · Wraith Hunt ─────────────
function wraithWindup(
  g: G,
  _a: Ability,
  x: number,
  y: number,
  _angle: number,
  _ax: number,
  _ay: number,
  color: number,
  k: number,
) {
  const fx = fxFor(g.scene);
  fx.glow(x, y - 34, 18 + k * 34, color, 0.4 + k * 0.5);
  fx.glow(x, y - 34, 8 + k * 12, GHOST, 0.6);
  fx.floorSolid
    .fillStyle(0x0b0618, 0.2 + k * 0.25)
    .fillEllipse(x, y + 8, 90 + k * 40, 40 + k * 18);
}
const wraithCast: NonNullable<FxKit["cast"]>[string] = (
  scene,
  _a,
  x,
  y,
  _angle,
  color,
) => {
  const fx = fxFor(scene);
  fx.ultimate(color, 900, true);
  fx.burst({
    x,
    y: y - 30,
    z: 30,
    count: 16,
    kind: "smoke",
    color: [0x1a1030, color],
    speed: [30, 120],
    up: [20, 80],
    life: [0.6, 1.1],
    size: [8, 14],
  });
};
/** The wraith: a hooded shape trailing wisps, its eyes on its prey. */
function wraith(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    c = z.color,
    r = z.radius,
    k = lifeOf(z, progress),
    fade = k > 0.9 ? (1 - k) / 0.1 : Math.min(1, k * 6),
    bob = Math.sin(now / 160 + z.id) * 5,
    x = z.x,
    y = z.y - 30 + bob;
  fx.essential(() => {
    // Its reach on the floor: what touches it is hit.
    fx.floorSolid
      .fillStyle(0x0b0618, 0.35 * fade)
      .fillEllipse(z.x, z.y, r * 2, r * 2 * SQ);
    fx.floor
      .lineStyle(2, c, 0.6 * fade)
      .strokeEllipse(z.x, z.y, r * 2, r * 2 * SQ);
    fx.glow(x, y, r * 1.1, c, 0.35 * fade);
  });
  // Body: a hood narrowing into a ragged tail.
  const sway = Math.sin(now / 220 + z.id) * 6;
  const body = [
    { x: x - 20, y: y - 6 },
    { x: x - 14, y: y - 26 },
    { x, y: y - 34 },
    { x: x + 14, y: y - 26 },
    { x: x + 20, y: y - 6 },
    { x: x + 16 + sway, y: y + 16 },
    { x: x + 6 + sway * 1.4, y: y + 30 },
    { x: x - 2 + sway * 1.8, y: y + 22 },
    { x: x - 10 + sway * 1.4, y: y + 32 },
    { x: x - 18 + sway, y: y + 14 },
  ];
  fx.solid.fillStyle(0x140b26, 0.82 * fade).fillPoints(body, true);
  fx.solid.lineStyle(2, GHOST, 0.7 * fade).strokePoints(body, true);
  // Eyes.
  fx.g
    .fillStyle(0x7dffe1, fade)
    .fillCircle(x - 6, y - 14, 3)
    .fillCircle(x + 6, y - 14, 3);
  fx.glow(x, y - 14, 14, 0x7dffe1, 0.5 * fade);
  fx.trail(`wr${z.id}`, 0.06, () =>
    fx.burst({
      x: x + (Math.random() - 0.5) * 20,
      y: y + 24,
      z: 20,
      count: 1,
      kind: "smoke",
      color: [0x1a1030, c],
      speed: [10, 40],
      up: [10, 30],
      life: [0.5, 0.8],
      size: [6, 10],
    }),
  );
}
/** Reaped: the wraith takes its prey. */
function reap(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  fx.burst({
    x,
    y: y - 20,
    z: 20,
    count: 20,
    kind: "smoke",
    color: [0x0b0618, color],
    speed: [40, 160],
    up: [40, 140],
    life: [0.6, 1],
    size: [8, 14],
  });
  fx.shake(200, 0.005);
  shot(fx.reduced ? 200 : 520, (k) => {
    fx.glow(x, y - 20, 70 * (1 - k * 0.5), color, 0.7 * (1 - k));
    fx.shockwave(x, y, 90 * ease(k), k, GHOST, 8);
  });
}

// ───────────── Lumoth · Radiant Flare ─────────────
function flareWindup(
  g: G,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  aimX: number,
  aimY: number,
  color: number,
  k: number,
) {
  const fx = fxFor(g.scene),
    d = Math.min(a.range, Math.hypot(aimX - x, aimY - y)),
    tx = x + Math.cos(angle) * d,
    ty = y + Math.sin(angle) * d;
  fx.glow(x, y - 30, 20 + k * 30, SUN, 0.4 + k * 0.5);
  // Where it will hang, and how far it will pull.
  fx.floor
    .lineStyle(2, color, 0.3 + k * 0.4)
    .strokeEllipse(tx, ty, a.radius * 2, a.radius * 2 * SQ);
  fx.floorSolid
    .fillStyle(color, 0.05 + k * 0.08)
    .fillEllipse(tx, ty, a.radius * 2, a.radius * 2 * SQ);
}
const flareCast: NonNullable<FxKit["cast"]>[string] = (
  scene,
  _a,
  x,
  y,
  angle,
  color,
  shot,
) => {
  const fx = fxFor(scene);
  fx.ultimate(SUN);
  // The flare rises from Lumoth toward where it will hang.
  shot(fx.reduced ? 120 : 260, (k) => {
    fx.glow(
      x + Math.cos(angle) * 40 * k,
      y - 30 - 40 * k,
      22,
      SUN,
      0.8 * (1 - k),
    );
  });
  fx.burst({
    x,
    y: y - 30,
    z: 30,
    count: 10,
    kind: "mote",
    color: [SUN, color],
    speed: [40, 120],
    up: [60, 140],
    life: [0.5, 0.9],
    size: [1.2, 2.2],
    drag: 1.5,
  });
};
/**
 * The hanging flare: a little sun over the spot, the ring it pulls from with
 * motes streaming in, and the burst ring brightening as it nears.
 */
function flare(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    a = z.ability,
    c = z.color,
    k = lifeOf(z, progress),
    burst = a.explosion ?? 160,
    y = z.y - 70 - Math.sin(now / 300) * 4;
  fx.essential(() => {
    fx.floor
      .lineStyle(2, c, 0.45)
      .strokeEllipse(z.x, z.y, z.radius * 2, z.radius * 2 * SQ);
    fx.floorSolid
      .fillStyle(SUN, 0.08 + k * 0.16)
      .fillEllipse(z.x, z.y, burst * 2, burst * 2 * SQ);
    fx.floor
      .lineStyle(3 + k * 3, SUN, 0.5 + k * 0.5)
      .strokeEllipse(z.x, z.y, burst * 2, burst * 2 * SQ);
    fx.glow(z.x, y, 30 + k * 26, SUN, 0.6 + k * 0.3);
  });
  fx.glow(z.x, y, 12, WHITE, 0.9);
  fx.glow(z.x, z.y, burst * 0.6, c, 0.2 + k * 0.2, true);
  // Light falling from the flare to the floor.
  fx.floor.lineStyle(6, SUN, 0.18).lineBetween(z.x, y, z.x, z.y);
  // Motes drawn in from the edge of the pull.
  for (let i = 0; i < 10; i++) {
    const t = (((now / 900 + hash(i + z.id)) % 1) + 1) % 1,
      ang = hash(i * 7 + z.id) * TAU,
      d = z.radius * (1 - t);
    fx.g
      .fillStyle(i % 2 ? SUN : c, 0.8 * (1 - t * 0.5))
      .fillCircle(
        z.x + Math.cos(ang) * d,
        z.y + Math.sin(ang) * d * SQ - 8,
        2.4,
      );
  }
}
/** The flare bursts. */
function flareBurst(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = a.explosion ?? 160;
  fx.burst({
    x,
    y: y - 20,
    z: 40,
    count: 40,
    kind: "mote",
    color: [SUN, WHITE, color],
    speed: [120, 420],
    up: [60, 260],
    life: [0.4, 0.9],
    size: [1.4, 2.6],
    drag: 1.6,
  });
  fx.decal({ kind: "glyph", x, y, r: r * 0.7, color, life: 3 });
  fx.shake(200, 0.005);
  shot(fx.reduced ? 220 : 560, (k) => {
    const flash = Math.max(0, 1 - k / 0.15);
    fx.glow(x, y - 30, r * 0.9, WHITE, 0.7 * flash);
    fx.glow(x, y, r, SUN, 0.5 * (1 - k), true);
    fx.shockwave(x, y, r * ease(Math.min(1, k * 1.6)), k, SUN, 12);
  });
}

export const revolutionKit: FxKit = {
  zone: {
    "riptide-wave": riptideWave,
    thunderstorm: stormBolt,
    "wraith-hunt": wraith,
    "radiant-flare": flare,
  },
  windup: {
    "riptide-wave": waveWindup,
    thunderstorm: stormWindup,
    "wraith-hunt": wraithWindup,
    "radiant-flare": flareWindup,
  },
  cast: {
    "river-dash": riverDash,
    "riptide-wave": waveCast,
    thunderstorm: stormCast,
    "wraith-hunt": wraithCast,
    "radiant-flare": flareCast,
  },
  impact: {
    "riptide-wave": waveSlam,
    "wraith-hunt": reap,
    "radiant-flare": flareBurst,
  },
  beam: { "ball-lightning": ballZap },
};
