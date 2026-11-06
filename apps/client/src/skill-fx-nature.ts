import type Phaser from "phaser";
import type { Ability, Projectile, Zone } from "@arena/shared";
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
 * The Nature kit (Pangrove and Mossloth): leaves, thorns, sap and roots.
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
        x: x + Math.sin(t * 2.4 + lean) * lean * 10 * t + lean * h * 0.35 * t * t,
        y: y - h * t,
      };
    });
  fx.solid.lineStyle(width + 3, BARK_DARK, 0.85 * alpha).strokePoints(pts, false);
  fx.solid.lineStyle(width, BARK, alpha).strokePoints(pts, false);
  fx.g
    .lineStyle(Math.max(1, width * 0.3), LEAF, 0.6 * alpha)
    .strokePoints(pts, false);
  const tip = pts[pts.length - 1];
  if (rise > 0.6) leaf(fx.solid, tip.x, tip.y - 3, 9, -Math.PI / 2 + lean, LEAF, alpha);
}
/** Roots coiled round a point on the ground (Rooted, Rootsnare's grip). */
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
    fx.soft(pr.x - c * r * i * 0.9, pr.y - s * r * i * 0.9, r * (0.8 - i * 0.15), LEAF, 0.35 - i * 0.08);
  fx.solid.fillStyle(BARK_DARK, 1).fillEllipse(pr.x, pr.y, r * 2.2, r * 1.5);
  fx.solid.fillStyle(0xa8743e, 1).fillEllipse(pr.x - c, pr.y - s, r * 1.8, r * 1.1);
  fx.g.fillStyle(0xffe2a8, 0.7).fillCircle(pr.x - r * 0.3, pr.y - r * 0.3, r * 0.3);
  void now;
}
/** Rootsnare: a sprouting seed trailing little roots and leaves. */
function rootsnareShot(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    dir = Math.atan2(pr.vy, pr.vx);
  fx.trail(pr.id, 0.04, () =>
    leaves(fx, pr.x, pr.y, 1, [10, 40], { angle: dir + Math.PI, spread: 0.6 }),
  );
  fx.glow(pr.x, pr.y, r * 2.8, LEAF, 0.5);
  for (let i = 0; i < 3; i++) {
    const a = dir + Math.PI + (i - 1) * 0.6 + Math.sin(now / 90 + i) * 0.2;
    const len = r * (1.4 + hash(i) * 0.6);
    fx.solid
      .lineStyle(2.4, BARK, 0.9)
      .lineBetween(pr.x, pr.y, pr.x + Math.cos(a) * len, pr.y + Math.sin(a) * len);
  }
  fx.solid.fillStyle(BARK_DARK, 1).fillCircle(pr.x, pr.y, r * 0.8);
  fx.solid.fillStyle(0xa8743e, 1).fillCircle(pr.x, pr.y, r * 0.62);
  leaf(fx.solid, pr.x + Math.cos(dir) * r * 0.5, pr.y - r * 0.6, r * 1.1, dir - 0.8, LEAF, 1);
}
/** Thorn Volley: a pale green thorn. */
function thornShot(g: G, pr: Projectile) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    dir = Math.atan2(pr.vy, pr.vx),
    c = Math.cos(dir),
    s = Math.sin(dir);
  fx.glow(pr.x, pr.y, r * 2.2, LEAF, 0.4);
  fx.g
    .lineStyle(r * 0.5, LEAF, 0.35)
    .lineBetween(pr.x - c * r * 3, pr.y - s * r * 3, pr.x, pr.y);
  const tip = { x: pr.x + c * r * 1.4, y: pr.y + s * r * 1.4 },
    l = { x: pr.x - c * r * 1.2 - s * r * 0.45, y: pr.y - s * r * 1.2 + c * r * 0.45 },
    rr = { x: pr.x - c * r * 1.2 + s * r * 0.45, y: pr.y - s * r * 1.2 - c * r * 0.45 };
  fx.solid.fillStyle(0x1f4626, 1).fillTriangle(tip.x, tip.y, l.x, l.y, rr.x, rr.y);
  fx.solid.fillStyle(0xc7e88a, 1).fillTriangle(
    tip.x - c,
    tip.y - s,
    l.x + c * 1.2,
    l.y + s * 1.2,
    rr.x + c * 1.2,
    rr.y + s * 1.2,
  );
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
/** Rootsnare lands: roots burst up and coil round the spot. */
function snareImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = Math.max(a.radius * 1.4, 22);
  leaves(fx, x, y, 7, [40, 140]);
  fx.decal({ kind: "crack", x, y: y + 4, r: r * 1.1, color: LEAF, life: 2 });
  shot(fx.reduced ? 300 : Math.min(1400, (a.statusDuration ?? 1) * 900), (k) => {
    const fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    rootCoil(fx, x, y + 6, r, k, fade);
    fx.glow(x, y, r * 2, color, 0.3 * fade);
  });
}
/** Thornwheel stops: a burst of thorns and a ring of roots around the target. */
function wheelImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    R = a.explosion || 90;
  fx.shake(160, 0.006);
  leaves(fx, x, y, 16, [80, 260]);
  sapDrops(fx, x, y - 10, 8);
  fx.decal({ kind: "crack", x, y: y + 4, r: R * 0.8, color: LEAF, life: 2.5 });
  shot(fx.reduced ? 300 : 900, (k) => {
    const fade = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    fx.shockwave(x, y + 6, R * ease(Math.min(1, k * 2)), Math.min(1, k * 1.4), LEAF, 10, SQ);
    for (let i = 0; i < 8; i++) {
      const ang = (i * TAU) / 8 + hash(i) * 0.4,
        d = R * (0.55 + hash(i * 3) * 0.35);
      rootUp(
        fx,
        x + Math.cos(ang) * d,
        y + 6 + Math.sin(ang) * d * SQ,
        26 + hash(i * 5) * 14,
        Math.cos(ang) * -0.6,
        5,
        ease(Math.min(1, k * 4 - hash(i) * 0.6)),
        fade,
      );
    }
    fx.glow(x, y, R * (1 - k * 0.4), color, 0.4 * fade);
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
    range = a.range,
    heavy = a.drain !== undefined;
  shot(heavy ? 300 : 220, (k) => {
    const { x, y } = at?.() ?? origin,
      sweep = ease(k),
      fade = 1 - k;
    const from = angle - spread,
      cur = from + 2 * spread * sweep;
    fx.floor
      .fillStyle(color, 0.14 * fade)
      .slice(x, y, range, from, cur);
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
      .lineStyle(4 * fade + 1, heavy ? SAP : LEAF_LIGHT, 0.8 * fade)
      .beginPath()
      .arc(x, y - 10, range * 0.85, from, cur)
      .strokePath();
  });
}
/** Sap Bite: jaws snap shut in front, gold sap splashes back to the caster. */
function sapBite(
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
    reach = a.range * 0.7;
  sapDrops(fx, origin.x + Math.cos(angle) * reach, origin.y - 12 + Math.sin(angle) * reach, 6);
  shot(fx.reduced ? 200 : 420, (k) => {
    const { x, y } = at?.() ?? origin,
      bx = x + Math.cos(angle) * reach,
      by = y - 12 + Math.sin(angle) * reach,
      shut = ease(Math.min(1, k * 3)),
      fade = k > 0.5 ? 1 - (k - 0.5) / 0.5 : 1,
      gap = 22 * (1 - shut) + 3,
      px = -Math.sin(angle),
      py = Math.cos(angle);
    for (const side of [-1, 1]) {
      const jx = bx + px * gap * side,
        jy = by + py * gap * side;
      for (let t = -2; t <= 2; t++) {
        const tx = jx + Math.cos(angle) * t * 6,
          ty = jy + Math.sin(angle) * t * 6;
        fx.solid
          .fillStyle(0xfffbea, fade)
          .fillTriangle(
            tx - Math.cos(angle) * 3,
            ty - Math.sin(angle) * 3,
            tx + Math.cos(angle) * 3,
            ty + Math.sin(angle) * 3,
            tx - px * side * 7,
            ty - py * side * 7,
          );
      }
    }
    fx.glow(bx, by, 30, color, 0.45 * fade);
    // Sap streaming home.
    for (let i = 0; i < 4; i++) {
      const t = Math.max(0, Math.min(1, k * 1.6 - i * 0.15));
      if (t <= 0 || t >= 1) continue;
      fx.glow(bx + (x - bx) * t, by + (y - 20 - by) * t - Math.sin(t * Math.PI) * 18, 7, SAP, 0.8);
    }
  });
}
/** Scale Curl: leaf scales fold round the caster into a ball. */
function scaleCurl(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  _angle: number,
  color: number,
  shot: Shot,
  at?: Follow,
) {
  const fx = fxFor(scene),
    ms = Math.min(1600, Math.max(500, a.duration * 700));
  leaves(fx, x, y - 10, 8, [40, 120]);
  shot(fx.reduced ? 300 : ms, (k) => {
    const p = at?.() ?? { x, y },
      fold = ease(Math.min(1, k * 4)),
      fade = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    for (let i = 0; i < 10; i++) {
      const ang = (i * TAU) / 10 + k * 1.2,
        d = 60 - 18 * fold;
      leaf(
        fx.solid,
        p.x + Math.cos(ang) * d,
        p.y - 12 + Math.sin(ang) * d * 0.85,
        18,
        ang + Math.PI / 2,
        i % 2 ? LEAF : LEAF_DEEP,
        0.9 * fade,
      );
    }
    fx.glow(p.x, p.y - 12, 54, color, 0.25 * fade);
  });
}
/** Thornwheel takeoff: curled up, thorns out, rolling off in a spray of leaves. */
function wheelCast(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
  at?: Follow,
) {
  const fx = fxFor(scene),
    seconds = a.range / Math.max(1, a.speed);
  fx.ultimate(color, 700);
  leaves(fx, x, y, 10, [60, 200], { angle: angle + Math.PI, spread: 0.8 });
  shot(fx.reduced ? 250 : seconds * 1000 + 120, (k) => {
    const p = at?.() ?? { x, y },
      spin = k * 14,
      R = 30;
    fx.trail(`thornwheel-${Math.round(x)}`, 0.03, () =>
      leaves(fx, p.x, p.y, 2, [10, 60], { angle: angle + Math.PI, spread: 0.5 }),
    );
    fx.floorSolid.fillStyle(BARK_DARK, 0.25).fillEllipse(p.x, p.y + 8, 64, 64 * SQ);
    for (let i = 0; i < 10; i++) {
      const ang = (i * TAU) / 10 + spin;
      fx.solid
        .fillStyle(0xc7e88a, 1)
        .fillTriangle(
          p.x + Math.cos(ang) * (R + 12),
          p.y - 16 + Math.sin(ang) * (R + 12),
          p.x + Math.cos(ang + 0.2) * R,
          p.y - 16 + Math.sin(ang + 0.2) * R,
          p.x + Math.cos(ang - 0.2) * R,
          p.y - 16 + Math.sin(ang - 0.2) * R,
        );
    }
    fx.solid.fillStyle(LEAF_DEEP, 1).fillCircle(p.x, p.y - 16, R);
    for (let i = 0; i < 6; i++) {
      const ang = (i * TAU) / 6 + spin;
      leaf(fx.solid, p.x + Math.cos(ang) * R * 0.55, p.y - 16 + Math.sin(ang) * R * 0.55, 16, ang + Math.PI / 2, LEAF, 1);
    }
    fx.glow(p.x, p.y - 16, R * 2, color, 0.4);
  });
}
/** Wind-up: Pangrove tucks in, leaves swirl, the lane it will roll glows. */
function wheelWindup(
  g: G,
  a: Ability,
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
    len = a.range,
    w = 26;
  const px = -Math.sin(angle) * w,
    py = Math.cos(angle) * w,
    ex = x + Math.cos(angle) * len,
    ey = y + Math.sin(angle) * len;
  fx.floor
    .fillStyle(color, 0.08 + k * 0.14)
    .fillPoints(
      [
        { x: x + px, y: y + py },
        { x: ex + px, y: ey + py },
        { x: ex - px, y: ey - py },
        { x: x - px, y: y - py },
      ],
      true,
    );
  fx.floor.lineStyle(2, color, 0.4 + k * 0.4).lineBetween(x, y, ex, ey);
  for (let i = 0; i < 8; i++) {
    const ang = (i * TAU) / 8 + now / 140;
    leaf(fx.solid, x + Math.cos(ang) * (44 - k * 14), y - 14 + Math.sin(ang) * (36 - k * 10), 14, ang + Math.PI / 2, LEAF, 0.4 + k * 0.5);
  }
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
/** Tongue Snag: a long pink tongue flicks out to the hit point and back. */
function tongueSnag(
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
  shot(fx.reduced ? 200 : 360, (k) => {
    const out = k < 0.45 ? ease(k / 0.45) : 1 - ease((k - 0.45) / 0.55),
      sx = x,
      sy = y - 14,
      ex = sx + (tx - sx) * out,
      ey = sy + (ty - 14 - sy) * out;
    const mx = (sx + ex) / 2 - (ey - sy) * 0.08,
      my = (sy + ey) / 2 + (ex - sx) * 0.08;
    const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      x: (1 - t) ** 2 * sx + 2 * (1 - t) * t * mx + t * t * ex,
      y: (1 - t) ** 2 * sy + 2 * (1 - t) * t * my + t * t * ey,
    }));
    fx.solid.lineStyle(9, 0x8a2a48, 0.9).strokePoints(pts, false);
    fx.solid.lineStyle(6, 0xff8fb0, 1).strokePoints(pts, false);
    fx.g.lineStyle(2, 0xffd3e1, 0.8).strokePoints(pts, false);
    fx.solid.fillStyle(0xff8fb0, 1).fillCircle(ex, ey, 6);
    fx.glow(ex, ey, 18, color, 0.5);
  });
  // Where it struck, roots grab (the target is Rooted if it was a hit).
  shot(fx.reduced ? 300 : 800, (k) => {
    if (k < 0.3) return;
    const kk = (k - 0.3) / 0.7;
    rootCoil(fx, tx, ty + 6, 20, kk, kk > 0.7 ? 1 - (kk - 0.7) / 0.3 : 1);
  });
}

// ───────────── Zones ─────────────
/** Bramble Patch: thorny canes over the real radius; a dark bed beneath. */
function bramblePatch(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    r = z.radius,
    grow = ease(Math.min(1, progress * 6)),
    fade = progress > 0.85 ? 1 - (progress - 0.85) / 0.15 : 1;
  fx.floorSolid
    .fillStyle(BARK_DARK, 0.35 * fade)
    .fillEllipse(z.x, z.y, r * 2 * grow, r * 2 * SQ * grow);
  fx.floor
    .lineStyle(2, LEAF, 0.55 * fade)
    .strokeEllipse(z.x, z.y, r * 2 * grow, r * 2 * SQ * grow);
  for (let i = 0; i < 16; i++) {
    const a = hash(i * 7 + z.id) * TAU,
      d = r * Math.sqrt(hash(i * 13 + z.id)) * 0.85,
      bx = z.x + Math.cos(a) * d,
      by = z.y + Math.sin(a) * d * SQ,
      sway = Math.sin(now / 400 + i) * 0.15;
    const h = (16 + hash(i * 3) * 14) * grow;
    const ex = bx + (sway + (hash(i) - 0.5)) * 12;
    fx.solid.lineStyle(6, BARK_DARK, 0.6 * fade).lineBetween(bx, by, ex, by - h);
    fx.solid.lineStyle(4, 0x3f7a34, fade).lineBetween(bx, by, ex, by - h);
    for (let t = 1; t <= 2; t++) {
      const tx = bx + (ex - bx) * (t / 3),
        ty = by - h * (t / 3),
        s = t % 2 ? 1 : -1;
      fx.solid
        .fillStyle(0xc7e88a, fade)
        .fillTriangle(tx, ty - 2, tx + s * 8, ty - 4, tx, ty + 2);
    }
    if (i % 4 === 0)
      fx.solid.fillStyle(BLOOM, fade).fillCircle(bx + sway * 12, by - h, 2.6);
  }
  fx.glow(z.x, z.y, r, LEAF, 0.15 * fade, true);
}
/**
 * Wild Roots: the real circle cracks and glows during the delay, then great
 * roots erupt over it all at once and settle back.
 */
function wildRoots(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    r = z.radius,
    life = z.ability.duration || 0.6,
    delay = z.ability.tickDelay ?? 0.35,
    burstAt = Math.min(0.95, delay / life),
    pre = Math.min(1, progress / burstAt),
    post = progress < burstAt ? 0 : (progress - burstAt) / (1 - burstAt);
  fx.floorSolid
    .fillStyle(BARK_DARK, 0.25 + 0.2 * pre)
    .fillEllipse(z.x, z.y, r * 2, r * 2 * SQ);
  fx.floor
    .lineStyle(3, LEAF, 0.4 + 0.5 * pre)
    .strokeEllipse(z.x, z.y, r * 2, r * 2 * SQ);
  fx.glow(z.x, z.y, r * (0.6 + 0.4 * pre), LEAF, 0.2 + 0.3 * pre, true);
  if (post <= 0) {
    // Cracks running in from the edge as the roots gather.
    for (let i = 0; i < 9; i++) {
      const a = (i * TAU) / 9 + hash(i) * 0.3,
        len = r * pre * 0.8;
      fx.floor
        .lineStyle(2, LEAF_LIGHT, 0.6)
        .lineBetween(
          z.x + Math.cos(a) * r,
          z.y + Math.sin(a) * r * SQ,
          z.x + Math.cos(a) * (r - len),
          z.y + Math.sin(a) * (r - len) * SQ,
        );
    }
    if (!fx.reduced && pre > 0.7 && Math.floor(now / 60) % 2 === 0)
      g.scene.cameras.main.shake(40, 0.001, false);
    return;
  }
  // Once, as the roots break the surface.
  fx.trail(`wild-roots-${z.id}`, 10, () => {
    fx.shake(200, 0.008);
    leaves(fx, z.x, z.y, 18, [80, 240]);
  });
  const fade = post > 0.5 ? 1 - (post - 0.5) / 0.5 : 1;
  for (let i = 0; i < 11; i++) {
    const a = hash(i * 5 + z.id) * TAU,
      d = r * Math.sqrt(hash(i * 11 + z.id)) * 0.9;
    rootUp(
      fx,
      z.x + Math.cos(a) * d,
      z.y + Math.sin(a) * d * SQ,
      48 + hash(i * 3) * 34,
      (hash(i * 9) - 0.5) * 1.2,
      9,
      ease(Math.min(1, post * 5)),
      fade,
    );
  }
  fx.shockwave(z.x, z.y, r * ease(Math.min(1, post * 2)), Math.min(1, post * 1.5), LEAF, 10, SQ);
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
    fx.g.lineStyle(3 * (1 - k) + 1, LEAF_LIGHT, 0.8 * (1 - k)).strokeCircle(x, y, 10 + k * 16);
  });
}

export const natureKit: FxKit = {
  projectile: {
    "seed-spit": seedSpit,
    rootsnare: rootsnareShot,
    "thorn-volley": thornShot,
  },
  zone: { "bramble-patch": bramblePatch, "wild-roots": wildRoots },
  windup: { thornwheel: wheelWindup },
  cast: {
    "scale-swipe": scaleSwipe,
    "sap-bite": (scene, a, x, y, angle, color, shot, at) => {
      scaleSwipe(scene, a, x, y, angle, color, shot, at);
      sapBite(scene, a, x, y, angle, color, shot, at);
    },
    "scale-curl": scaleCurl,
    thornwheel: wheelCast,
    "seed-spit": spitCast,
    rootsnare: spitCast,
    "thorn-volley": spitCast,
  },
  impact: {
    "seed-spit": seedImpact,
    rootsnare: snareImpact,
    "thorn-volley": seedImpact,
    thornwheel: wheelImpact,
  },
  beam: { "tongue-snag": tongueSnag },
  hit: { nature: natureHit },
};
