import type Phaser from "phaser";
import {
  blinkLanding,
  type Ability,
  type Projectile,
  type Zone,
} from "@arena/shared";
import { fxFor, type Fx } from "./fx-engine";
import {
  TAU,
  ease,
  hash,
  type FxKit,
  type G,
  type Shot,
  type Follow,
} from "./fx-kits";
/**
 * The Nature kit (Pangrove and Mossloth): leaf scales, a tongue, seedlings,
 * roots and slowed time.
 * Roots are drawn as real bark (normal blend) with a green rim light; sap
 * is warm gold. Every size comes from the shared abilities, so what players
 * see is what can hit them.
 */
const LEAF = 0x7fcf6a;
const LEAF_DEEP = 0x3f8f4a;
const LEAF_LIGHT = 0xd6f5a8;
const BARK = 0x6b4526;
const BARK_DARK = 0x2a1a0e;
const SAP = 0xffd166;
const BLOOM = 0xff9fc4;
const SQ = 0.55;
/** Sloth Time's lavender. */
const TIME = 0xc9b6ff;

const leaves = (
  fx: Fx,
  x: number,
  y: number,
  n: number,
  speed: [number, number] = [40, 160],
  o: { angle?: number; spread?: number; z?: number } = {},
) =>
  fx.burst({
    x,
    y,
    z: o.z ?? 10,
    count: n,
    kind: "debris",
    color: [LEAF, LEAF_DEEP, LEAF_LIGHT],
    speed,
    up: [60, 180],
    angle: o.angle,
    spread: o.spread,
    life: [0.5, 1],
    size: [2, 3.6],
    grav: 380,
    drag: 2.5,
  });
const pollen = (fx: Fx, x: number, y: number, n: number, color = LEAF_LIGHT) =>
  fx.burst({
    x,
    y,
    z: 10,
    count: n,
    kind: "mote",
    color: [color, 0xffffff],
    speed: [10, 50],
    up: [20, 70],
    life: [0.5, 1.1],
    size: [1, 1.8],
    drag: 2,
  });
const sapDrops = (fx: Fx, x: number, y: number, n: number) =>
  fx.burst({
    x,
    y,
    z: 14,
    count: n,
    kind: "drop",
    color: [SAP, 0xffe9a8],
    speed: [30, 110],
    up: [60, 160],
    life: [0.4, 0.8],
    size: [1.6, 2.6],
    grav: 600,
  });

/** A leaf (or leaf scale) on graphics `g`, pointing along `rot`. */
function leaf(
  g: G,
  x: number,
  y: number,
  len: number,
  rot: number,
  color: number,
  alpha: number,
) {
  if (alpha <= 0 || len <= 0) return;
  const c = Math.cos(rot),
    s = Math.sin(rot),
    w = len * 0.42;
  const pt = (u: number, v: number) => ({
    x: x + c * u - s * v,
    y: y + s * u + c * v,
  });
  const pts = [
    pt(-len / 2, 0),
    pt(-len / 4, w * 0.8),
    pt(len / 4, w * 0.7),
    pt(len / 2, 0),
    pt(len / 4, -w * 0.7),
    pt(-len / 4, -w * 0.8),
  ];
  g.fillStyle(color, alpha).fillPoints(pts, true);
  const a = pt(-len / 2, 0),
    b = pt(len / 2, 0);
  g.lineStyle(1, BARK_DARK, 0.45 * alpha).lineBetween(a.x, a.y, b.x, b.y);
}
/** A root rising from (x, y): a bark curve with a lit edge, `rise` 0 → 1. */
function rootUp(
  fx: Fx,
  x: number,
  y: number,
  height: number,
  lean: number,
  width: number,
  rise: number,
  alpha = 1,
) {
  if (rise <= 0 || alpha <= 0) return;
  const h = height * rise,
    pts = Array.from({ length: 7 }, (_, i) => {
      const t = i / 6;
      return {
        x:
          x +
          Math.sin(t * 2.4 + lean) * lean * 10 * t +
          lean * h * 0.35 * t * t,
        y: y - h * t,
      };
    });
  fx.solid
    .lineStyle(width + 3, BARK_DARK, 0.85 * alpha)
    .strokePoints(pts, false);
  fx.solid.lineStyle(width, BARK, alpha).strokePoints(pts, false);
  fx.g
    .lineStyle(Math.max(1, width * 0.3), LEAF, 0.6 * alpha)
    .strokePoints(pts, false);
  const tip = pts[pts.length - 1];
  if (rise > 0.6)
    leaf(fx.solid, tip.x, tip.y - 3, 9, -Math.PI / 2 + lean, LEAF, alpha);
}
/** Roots coiled round a point on the ground (Rooted, a seedling's grip). */
export function rootCoil(
  fx: Fx,
  x: number,
  y: number,
  r: number,
  k: number,
  alpha = 1,
) {
  const grow = ease(Math.min(1, k * 3));
  fx.floorSolid
    .fillStyle(BARK_DARK, 0.3 * alpha)
    .fillEllipse(x, y, r * 2.4 * grow, r * 2.4 * SQ * grow);
  for (let i = 0; i < 5; i++) {
    const a = (i * TAU) / 5 + 0.3,
      bx = x + Math.cos(a) * r,
      by = y + Math.sin(a) * r * SQ;
    rootUp(fx, bx, by, r * 1.1, Math.cos(a) * -0.8, 4, grow, alpha);
  }
  fx.glow(x, y, r * 1.8, LEAF, 0.25 * alpha, true);
}

// ───────────── Projectiles ─────────────
/** Seed Spit: a hard brown seed with a green trail. */
function seedSpit(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    dir = Math.atan2(pr.vy, pr.vx);
  fx.trail(pr.id, 0.05, () => pollen(fx, pr.x, pr.y, 1));
  fx.glow(pr.x, pr.y, r * 2.6, LEAF, 0.45);
  const c = Math.cos(dir),
    s = Math.sin(dir);
  for (let i = 1; i <= 3; i++)
    fx.soft(
      pr.x - c * r * i * 0.9,
      pr.y - s * r * i * 0.9,
      r * (0.8 - i * 0.15),
      LEAF,
      0.35 - i * 0.08,
    );
  fx.solid.fillStyle(BARK_DARK, 1).fillEllipse(pr.x, pr.y, r * 2.2, r * 1.5);
  fx.solid
    .fillStyle(0xa8743e, 1)
    .fillEllipse(pr.x - c, pr.y - s, r * 1.8, r * 1.1);
  fx.g
    .fillStyle(0xffe2a8, 0.7)
    .fillCircle(pr.x - r * 0.3, pr.y - r * 0.3, r * 0.3);
  void now;
}
/** Scale Shrapnel: a spinning leaf-scale blade with a short green streak. */
function shrapnelBlade(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    dir = Math.atan2(pr.vy, pr.vx),
    c = Math.cos(dir),
    s = Math.sin(dir);
  fx.glow(pr.x, pr.y, r * 2.2, LEAF, 0.4);
  fx.g
    .lineStyle(r * 0.6, LEAF, 0.3)
    .lineBetween(pr.x - c * r * 3, pr.y - s * r * 3, pr.x, pr.y);
  const spin = now / 45 + pr.id;
  leaf(fx.solid, pr.x, pr.y, r * 2.2, spin, LEAF_DEEP, 1);
  leaf(fx.solid, pr.x, pr.y, r * 1.5, spin, 0xc7e88a, 1);
}

// ───────────── Impacts ─────────────
function seedImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = a.radius;
  leaves(fx, x, y, 4, [30, 120]);
  fx.burst({
    x,
    y,
    z: 8,
    count: 4,
    kind: "debris",
    color: [0xa8743e, BARK],
    speed: [40, 140],
    up: [60, 160],
    life: [0.4, 0.7],
    size: [1.6, 2.6],
    grav: 700,
  });
  shot(220, (k) => {
    fx.glow(x, y, r * 3 * (1 - k * 0.4), color, 0.55 * (1 - k));
    fx.shockwave(x, y + 6, r * 2.2 * ease(k), k, LEAF, 4, SQ);
  });
}
/** A shrapnel blade lands: a few leaf shards. */
function bladeImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  leaves(fx, x, y, 3, [30, 110]);
  shot(160, (k) =>
    fx.glow(x, y, a.radius * 2.4 * (1 - k * 0.4), color, 0.5 * (1 - k)),
  );
}
/** Curl & Roll rams someone, or Pinball strikes: a thump, leaves and a ring. */
function ballImpact(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    R = 56;
  fx.shake(120, 0.005);
  leaves(fx, x, y, 12, [70, 220]);
  fx.decal({ kind: "crack", x, y: y + 4, r: R * 0.7, color: LEAF, life: 1.6 });
  shot(fx.reduced ? 220 : 420, (k) => {
    fx.shockwave(x, y + 6, R * ease(Math.min(1, k * 1.6)), k, LEAF, 8, SQ);
    fx.glow(x, y, R * (1 - k * 0.4), color, 0.45 * (1 - k));
  });
}
/**
 * A seedling goes off: roots burst up and coil round it, with a puff of
 * petals, over its real burst radius.
 */
function seedBurst(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = a.radius;
  leaves(fx, x, y, 10, [60, 200]);
  fx.burst({
    x,
    y,
    z: 14,
    count: 8,
    kind: "mote",
    color: [BLOOM, 0xffd3e1],
    speed: [40, 140],
    up: [60, 160],
    life: [0.5, 0.9],
    size: [1.6, 2.6],
    drag: 2,
  });
  fx.decal({ kind: "crack", x, y: y + 4, r: r * 0.8, color: LEAF, life: 2 });
  shot(
    fx.reduced ? 300 : Math.min(1400, (a.statusDuration ?? 1) * 900),
    (k) => {
      const fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      fx.shockwave(
        x,
        y + 4,
        r * ease(Math.min(1, k * 3)),
        Math.min(1, k * 2),
        LEAF,
        8,
        SQ,
      );
      rootCoil(fx, x, y + 6, r * 0.45, k, fade);
      fx.glow(x, y, r * 1.2, color, 0.35 * fade);
    },
  );
}
/** Lazy Swap: a leafy puff and a little swirl where someone lands. */
function swapPoof(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  leaves(fx, x, y - 10, 6, [30, 110]);
  pollen(fx, x, y - 10, 6, 0xe9d7ff);
  shot(fx.reduced ? 200 : 520, (k) => {
    const fade = 1 - k;
    for (let i = 0; i < 3; i++) {
      const r = 14 + i * 10 + k * 20,
        a0 = k * 6 + i * 2;
      fx.g
        .lineStyle(2.5, i % 2 ? LEAF_LIGHT : 0xd9c8ff, 0.8 * fade)
        .beginPath()
        .arc(x, y - 14, r, a0, a0 + Math.PI * 1.2)
        .strokePath();
    }
    fx.glow(x, y - 14, 34, color, 0.4 * fade);
  });
}

// ───────────── Casts ─────────────
/** A swipe of leaf scales in front of the caster, staying on it while it moves. */
function scaleSwipe(
  scene: Phaser.Scene,
  a: Ability,
  x0: number,
  y0: number,
  angle: number,
  color: number,
  shot: Shot,
  at?: Follow,
) {
  const origin = at?.() ?? { x: x0, y: y0 };
  const fx = fxFor(scene),
    spread = Math.min(Math.PI * 0.9, Math.acos(a.arc ?? 0.3)),
    range = a.range;
  shot(220, (k) => {
    const { x, y } = at?.() ?? origin,
      sweep = ease(k),
      fade = 1 - k;
    const from = angle - spread,
      cur = from + 2 * spread * sweep;
    fx.floor.fillStyle(color, 0.14 * fade).slice(x, y, range, from, cur);
    fx.floor.fillPath();
    for (let i = 0; i < 6; i++) {
      const t = i / 5,
        ang = from + (cur - from) * t,
        d = range * (0.55 + 0.35 * t);
      leaf(
        fx.solid,
        x + Math.cos(ang) * d,
        y - 14 + Math.sin(ang) * d * 0.8,
        14 + t * 6,
        ang + Math.PI / 2,
        i % 2 ? LEAF : LEAF_DEEP,
        fade,
      );
    }
    fx.g
      .lineStyle(4 * fade + 1, LEAF_LIGHT, 0.8 * fade)
      .beginPath()
      .arc(x, y - 10, range * 0.85, from, cur)
      .strokePath();
  });
}
/** Scale Shrapnel: the plates tear off the back and fly out in a fan. */
function shrapnelCast(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    half = (a.fan ?? 1.2) / 2;
  leaves(fx, x, y - 16, 8, [80, 200], { angle, spread: half });
  shot(fx.reduced ? 160 : 260, (k) => {
    fx.floor
      .fillStyle(color, 0.16 * (1 - k))
      .slice(x, y, a.range * ease(k), angle - half, angle + half);
    fx.floor.fillPath();
    fx.glow(x, y - 16, 40 * (1 - k * 0.5), color, 0.5 * (1 - k));
  });
}
/** Curl & Roll: the leaf scales fold shut round Pangrove in a swirl of leaves. */
function curlCast(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  _angle: number,
  color: number,
  shot: Shot,
  at?: Follow,
) {
  const fx = fxFor(scene);
  leaves(fx, x, y - 10, 8, [40, 120]);
  shot(fx.reduced ? 200 : 380, (k) => {
    const p = at?.() ?? { x, y },
      fold = ease(Math.min(1, k * 2)),
      fade = 1 - k;
    for (let i = 0; i < 8; i++) {
      const ang = (i * TAU) / 8 + k * 4,
        d = 58 - 30 * fold;
      leaf(
        fx.solid,
        p.x + Math.cos(ang) * d,
        p.y - 14 + Math.sin(ang) * d * 0.85,
        16,
        ang + Math.PI / 2,
        i % 2 ? LEAF : LEAF_DEEP,
        0.9 * fade,
      );
    }
    fx.glow(p.x, p.y - 14, 50, color, 0.3 * fade);
  });
}
/** Pinball launches: the ultimate wash and a spray of leaves behind it. */
function pinballCast(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  fx.ultimate(color, 600);
  leaves(fx, x, y, 12, [80, 240], { angle: angle + Math.PI, spread: 0.7 });
  shot(fx.reduced ? 160 : 300, (k) =>
    fx.shockwave(x, y + 6, 70 * ease(k), k, LEAF, 8, SQ),
  );
}
/**
 * Pinball wind-up: Pangrove tucks in while its first stretch (to the first
 * wall in the way) lights up on the ground.
 */
function pinballWindup(
  g: G,
  _a: Ability,
  x: number,
  y: number,
  angle: number,
  _ax: number,
  _ay: number,
  color: number,
  k: number,
  now: number,
) {
  const fx = fxFor(g.scene),
    end = blinkLanding({ x, y }, angle, 1700),
    w = 26;
  const px = -Math.sin(angle) * w,
    py = Math.cos(angle) * w;
  fx.floor.fillStyle(color, 0.08 + k * 0.14).fillPoints(
    [
      { x: x + px, y: y + py },
      { x: end.x + px, y: end.y + py },
      { x: end.x - px, y: end.y - py },
      { x: x - px, y: y - py },
    ],
    true,
  );
  fx.floor.lineStyle(2, color, 0.4 + k * 0.4).lineBetween(x, y, end.x, end.y);
  // Where it will bounce.
  fx.floor
    .lineStyle(3, LEAF_LIGHT, 0.4 + k * 0.5)
    .strokeEllipse(end.x, end.y, 40, 40 * SQ);
  for (let i = 0; i < 8; i++) {
    const ang = (i * TAU) / 8 + now / 140;
    leaf(
      fx.solid,
      x + Math.cos(ang) * (44 - k * 14),
      y - 14 + Math.sin(ang) * (36 - k * 10),
      14,
      ang + Math.PI / 2,
      LEAF,
      0.4 + k * 0.5,
    );
  }
}
/** Sloth Time: a lazy chime ring at Mossloth as the bubble forms at the aim. */
function slothCast(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  _angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  pollen(fx, x, y - 20, 6, 0xe9d7ff);
  shot(fx.reduced ? 200 : 600, (k) => {
    fx.g
      .lineStyle(3 * (1 - k) + 1, 0xd9c8ff, 0.8 * (1 - k))
      .strokeCircle(x, y - 20, 12 + k * 30);
    fx.glow(x, y - 20, 30, color, 0.35 * (1 - k));
  });
}
/** Overgrowth wind-up: vines gather in a ring of the real radius. */
function overgrowthWindup(
  g: G,
  a: Ability,
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
    r = a.radius;
  fx.floorSolid
    .fillStyle(BARK_DARK, 0.15 + 0.2 * k)
    .fillEllipse(x, y, r * 2, r * 2 * SQ);
  fx.floor
    .lineStyle(3, color, 0.4 + 0.5 * k)
    .strokeEllipse(x, y, r * 2, r * 2 * SQ);
  for (let i = 0; i < 9; i++) {
    const ang = (i * TAU) / 9 + now / 900,
      len = r * k * 0.7;
    fx.floor
      .lineStyle(2, LEAF_LIGHT, 0.6)
      .lineBetween(
        x + Math.cos(ang) * r,
        y + Math.sin(ang) * r * SQ,
        x + Math.cos(ang) * (r - len),
        y + Math.sin(ang) * (r - len) * SQ,
      );
  }
}
/** Overgrowth: great vines erupt over the whole circle at once and settle. */
function overgrowth(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  _angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = a.radius;
  fx.ultimate(color, 700);
  fx.shake(220, 0.008);
  leaves(fx, x, y, 22, [80, 260]);
  fx.decal({ kind: "crack", x, y: y + 4, r: r * 0.9, color: LEAF, life: 2.5 });
  shot(fx.reduced ? 400 : 1100, (k) => {
    const fade = k > 0.55 ? 1 - (k - 0.55) / 0.45 : 1;
    for (let i = 0; i < 13; i++) {
      const ang = hash(i * 5) * TAU,
        d = r * Math.sqrt(hash(i * 11)) * 0.9;
      rootUp(
        fx,
        x + Math.cos(ang) * d,
        y + Math.sin(ang) * d * SQ,
        48 + hash(i * 3) * 34,
        (hash(i * 9) - 0.5) * 1.2,
        9,
        ease(Math.min(1, k * 5 - hash(i) * 0.5)),
        fade,
      );
    }
    fx.shockwave(
      x,
      y,
      r * ease(Math.min(1, k * 2)),
      Math.min(1, k * 1.5),
      LEAF,
      10,
      SQ,
    );
    fx.glow(x, y, r * 0.8, color, 0.3 * fade, true);
  });
}
/** Tongue Grapple: a pink puff at the mouth as the tongue shoots out. */
function tongueCast(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  angle: number,
  _color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    mx = x + Math.cos(angle) * 22,
    my = y - 14 + Math.sin(angle) * 22;
  shot(160, (k) =>
    fx.soft(mx, my, 12 * (1 - k * 0.4), 0xff8fb0, 0.5 * (1 - k)),
  );
}
/** A small puff at the mouth for Mossloth's shots. */
function spitCast(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    mx = x + Math.cos(angle) * 24,
    my = y - 14 + Math.sin(angle) * 24;
  pollen(fx, mx, my + 14, 3);
  shot(140, (k) => {
    fx.soft(mx, my, 12 * (1 - k * 0.4), LEAF, 0.45 * (1 - k));
    fx.glow(mx, my, 20, color, 0.45 * (1 - k));
  });
}

// ───────────── Beam ─────────────
/**
 * Tongue Grapple: a long pink tongue shoots out to what it caught (an enemy
 * or a wall), then reels in as Pangrove zips along it.
 */
function tongueGrapple(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  tx: number,
  ty: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  shot(fx.reduced ? 200 : 420, (k) => {
    const out = k < 0.35 ? ease(k / 0.35) : 1,
      // Reeling in: the tongue's base follows Pangrove toward the tip.
      reel = k < 0.35 ? 0 : ease((k - 0.35) / 0.65),
      sx = x + (tx - x) * reel,
      sy = y - 14 + (ty - y) * reel,
      ex = x + (tx - x) * out,
      ey = y - 14 + (ty - y) * out;
    const mx = (sx + ex) / 2 - (ey - sy) * 0.06,
      my = (sy + ey) / 2 + (ex - sx) * 0.06;
    const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      x: (1 - t) ** 2 * sx + 2 * (1 - t) * t * mx + t * t * ex,
      y: (1 - t) ** 2 * sy + 2 * (1 - t) * t * my + t * t * ey,
    }));
    const fade = k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
    fx.solid.lineStyle(9, 0x8a2a48, 0.9 * fade).strokePoints(pts, false);
    fx.solid.lineStyle(6, 0xff8fb0, fade).strokePoints(pts, false);
    fx.g.lineStyle(2, 0xffd3e1, 0.8 * fade).strokePoints(pts, false);
    fx.solid.fillStyle(0xff8fb0, fade).fillCircle(ex, ey, 7);
    fx.glow(ex, ey, 20, color, 0.5 * fade);
  });
}

// ───────────── Zones ─────────────
/**
 * Seedling: a little plant growing on a dirt mound. Its stage (sprout, bud,
 * bloom) follows the server's (a stage every `seed.grow` seconds since it
 * was planted); a faint ring shows where stepping sets it off, and an arc
 * fills toward the next stage.
 */
function seedlingZone(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    a = z.ability,
    seed = a.seed ?? { grow: 1.5, stages: [1], trigger: 30 },
    age = progress * (a.duration || 1),
    last = seed.stages.length - 1,
    stage = Math.min(last, Math.floor(age / seed.grow)),
    toNext = stage < last ? (age % seed.grow) / seed.grow : 1,
    trigger = seed.trigger + 24,
    x = z.x,
    y = z.y,
    sway = Math.sin(now / 500 + z.id) * 0.12;
  // Where stepping sets it off, and the bigger circle it hits.
  fx.floor
    .lineStyle(1.5, LEAF, 0.3 + 0.1 * stage)
    .strokeEllipse(x, y, trigger * 2, trigger * 2 * SQ);
  fx.floor
    .lineStyle(1, LEAF_LIGHT, 0.12)
    .strokeEllipse(x, y, z.radius * 2, z.radius * 2 * SQ);
  if (stage < last)
    fx.floor
      .lineStyle(3, LEAF_LIGHT, 0.55)
      .beginPath()
      .arc(x, y, trigger * 0.62, -Math.PI / 2, -Math.PI / 2 + TAU * toNext)
      .strokePath();
  // The mound.
  fx.floorSolid.fillStyle(BARK_DARK, 0.5).fillEllipse(x, y, 30, 30 * SQ);
  fx.floorSolid.fillStyle(BARK, 0.9).fillEllipse(x, y - 1, 24, 24 * SQ);
  const h = [10, 18, 26][stage] ?? 26;
  const top = { x: x + sway * h, y: y - h };
  fx.solid.lineStyle(4, BARK_DARK, 0.7).lineBetween(x, y - 2, top.x, top.y);
  fx.solid.lineStyle(3, 0x3f7a34, 1).lineBetween(x, y - 2, top.x, top.y);
  const leafCount = stage === 0 ? 2 : 4;
  for (let i = 0; i < leafCount; i++) {
    const t = 0.45 + (i >> 1) * 0.3,
      side = i % 2 ? 1 : -1;
    leaf(
      fx.solid,
      x + (top.x - x) * t + side * 6,
      y - 2 + (top.y - y) * t,
      10 + stage * 2,
      side * 0.7 + sway - Math.PI / 2,
      i % 2 ? LEAF : LEAF_DEEP,
      1,
    );
  }
  if (stage === 1) {
    fx.solid.fillStyle(0x3f7a34, 1).fillEllipse(top.x, top.y - 3, 9, 12);
    fx.solid.fillStyle(BLOOM, 1).fillEllipse(top.x, top.y - 6, 5, 7);
  } else if (stage >= 2) {
    for (let i = 0; i < 5; i++) {
      const ang = (i * TAU) / 5 + now / 1500;
      fx.solid
        .fillStyle(BLOOM, 1)
        .fillEllipse(
          top.x + Math.cos(ang) * 6,
          top.y - 4 + Math.sin(ang) * 5,
          9,
          7,
        );
    }
    fx.solid.fillStyle(SAP, 1).fillCircle(top.x, top.y - 4, 3.4);
    fx.glow(top.x, top.y - 4, 22, BLOOM, 0.35 + Math.sin(now / 200) * 0.1);
  }
}
/**
 * Sloth Time: a slow lavender bubble over the real radius, a clock face
 * round its rim and hands that crawl; ripples drift inward.
 */
function slothTime(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    r = z.radius,
    grow = ease(Math.min(1, progress * 8)),
    fade = progress > 0.85 ? 1 - (progress - 0.85) / 0.15 : 1,
    t = now / 1000;
  fx.floor
    .fillStyle(TIME, 0.1 * fade)
    .fillEllipse(z.x, z.y, r * 2 * grow, r * 2 * SQ * grow);
  fx.floor
    .lineStyle(3, TIME, 0.6 * fade)
    .strokeEllipse(z.x, z.y, r * 2 * grow, r * 2 * SQ * grow);
  // The dome.
  fx.g
    .lineStyle(2, 0xffffff, 0.22 * fade)
    .beginPath()
    .arc(z.x, z.y, r * grow, Math.PI, 0)
    .strokePath();
  // Twelve hour ticks on the rim.
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12,
      inner = r * (i % 3 ? 0.9 : 0.84);
    fx.floor
      .lineStyle(i % 3 ? 2 : 3, 0xe9e0ff, 0.45 * fade)
      .lineBetween(
        z.x + Math.cos(a) * inner * grow,
        z.y + Math.sin(a) * inner * SQ * grow,
        z.x + Math.cos(a) * r * 0.97 * grow,
        z.y + Math.sin(a) * r * 0.97 * SQ * grow,
      );
  }
  // Hands that crawl.
  const hands: [number, number, number][] = [
    [t * 0.25 + z.id, 0.45, 5],
    [t * 1.2 + z.id, 0.7, 3],
  ];
  for (const [ang, len, w] of hands)
    fx.floor
      .lineStyle(w, 0xe9e0ff, 0.55 * fade)
      .lineBetween(
        z.x,
        z.y,
        z.x + Math.cos(ang) * r * len * grow,
        z.y + Math.sin(ang) * r * len * SQ * grow,
      );
  // Ripples drifting in.
  for (let i = 0; i < 3; i++) {
    const k = 1 - ((t * 0.35 + i / 3) % 1);
    fx.floor
      .lineStyle(2, TIME, 0.35 * fade * (1 - k))
      .strokeEllipse(z.x, z.y, r * 2 * k * grow, r * 2 * k * SQ * grow);
  }
  fx.glow(z.x, z.y, r, TIME, 0.12 * fade, true);
}

// ───────────── Hit ─────────────
function natureHit(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  leaves(fx, x, y, 5, [40, 150]);
  shot(200, (k) => {
    fx.glow(x, y, 26 * (1 - k * 0.5), color, 0.6 * (1 - k));
    fx.g
      .lineStyle(3 * (1 - k) + 1, LEAF_LIGHT, 0.8 * (1 - k))
      .strokeCircle(x, y, 10 + k * 16);
  });
}

/** Pangrove's armour plates: one cracks off (break) or grows back (grow). */
export function plateFx(
  scene: Phaser.Scene,
  x: number,
  y: number,
  grow: boolean,
) {
  const fx = fxFor(scene);
  if (grow) {
    pollen(fx, x, y - 24, 5);
    return;
  }
  fx.burst({
    x,
    y: y - 20,
    z: 16,
    count: 6,
    kind: "debris",
    color: [LEAF_DEEP, 0xc7e88a, BARK],
    speed: [80, 180],
    up: [80, 200],
    life: [0.4, 0.8],
    size: [2.4, 3.8],
    grav: 700,
  });
}
/** Pinball bounces off a wall: leaves fly and the camera thumps. */
export function bounceFx(scene: Phaser.Scene, x: number, y: number) {
  const fx = fxFor(scene);
  fx.shake(80, 0.003);
  leaves(fx, x, y, 8, [60, 180]);
}

export const natureKit: FxKit = {
  projectile: {
    "seed-spit": seedSpit,
    "scale-shrapnel": shrapnelBlade,
  },
  zone: { seedling: seedlingZone, "sloth-time": slothTime },
  windup: { pinball: pinballWindup, overgrowth: overgrowthWindup },
  cast: {
    "scale-swipe": scaleSwipe,
    "tongue-grapple": tongueCast,
    "scale-shrapnel": shrapnelCast,
    "curl-roll": curlCast,
    pinball: pinballCast,
    "seed-spit": spitCast,
    seedling: spitCast,
    "sloth-time": slothCast,
    "lazy-swap": (scene, a, x, y, _angle, color, shot) =>
      swapPoof(scene, a, x, y, color, shot),
    overgrowth,
  },
  impact: {
    "seed-spit": seedImpact,
    "scale-shrapnel": bladeImpact,
    "curl-roll": ballImpact,
    pinball: ballImpact,
    seedling: seedBurst,
    "lazy-swap": swapPoof,
  },
  beam: { "tongue-grapple": tongueGrapple },
  hit: { nature: natureHit },
};
