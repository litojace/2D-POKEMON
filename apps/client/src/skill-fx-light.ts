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
 * Lumoth's kit: starlight. Solid twinkling stars, lens flares, glitter that
 * drifts down, god rays. Light is given solid cores and soft dark edges so it
 * still reads on bright floors. Sizes come from the shared abilities.
 */
const GOLD = 0xffd76a;
const CREAM = 0xfff6d6;
const INK = 0x4a3a18;

/** A four-point twinkle with a dark rim, solid body and white heart. */
function twinkle(
  fx: Fx,
  x: number,
  y: number,
  s: number,
  color: number,
  alpha = 1,
  rot = 0,
  points = 4,
) {
  const star = (r: number, inner: number) =>
    Array.from({ length: points * 2 }, (_, i) => {
      const a = rot + (i * Math.PI) / points - Math.PI / 2,
        d = i % 2 ? r * inner : r;
      return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
    });
  fx.solid
    .fillStyle(INK, 0.35 * alpha)
    .fillPoints(star(s * 1.18, points === 4 ? 0.3 : 0.45), true);
  fx.solid
    .fillStyle(color, alpha)
    .fillPoints(star(s, points === 4 ? 0.28 : 0.45), true);
  fx.solid
    .fillStyle(CREAM, alpha)
    .fillPoints(star(s * 0.5, points === 4 ? 0.3 : 0.45), true);
}
/** Horizontal lens-flare streak. */
function flare(
  fx: Fx,
  x: number,
  y: number,
  len: number,
  color: number,
  alpha: number,
) {
  fx.glow(x, y, len, color, alpha * 0.8, false, 0.05);
  fx.glow(x, y, len * 0.5, 0xffffff, alpha, false, 0.04);
}
function glitter(
  fx: Fx,
  x: number,
  y: number,
  n: number,
  color: number,
  power = 1,
) {
  fx.burst({
    x,
    y,
    z: 18,
    count: n,
    kind: "mote",
    color: [color, GOLD, CREAM],
    speed: [30 * power, 140 * power],
    up: [40, 160 * power],
    life: [0.6, 1.2],
    size: [1, 1.8],
    grav: 120,
    drag: 2.2,
  });
}

// ───────────── Glint ─────────────
function glint(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    c = pr.color,
    a = Math.atan2(pr.vy, pr.vx),
    x = pr.x,
    y = pr.y - 12;
  fx.glow(pr.x, pr.y + 6, r * 2, c, 0.25, true);
  fx.g
    .lineStyle(r * 1.2, c, 0.25)
    .lineBetween(x - Math.cos(a) * 60, y - Math.sin(a) * 60, x, y);
  fx.g
    .lineStyle(2, CREAM, 0.7)
    .lineBetween(x - Math.cos(a) * 40, y - Math.sin(a) * 40, x, y);
  fx.glow(x, y, r * 2.4, c, 0.4);
  twinkle(fx, x, y, r * 1.5, c, 1, now / 120);
  flare(fx, x, y, r * 4 + Math.sin(now / 50) * r, c, 0.6);
  fx.trail(`gl${pr.id}`, 0.03, () => glitter(fx, x, pr.y, 1, c, 0.3));
}

// ───────────── Wing Dust: five glittering motes ─────────────
function fallingStar(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    c = pr.color,
    a = Math.atan2(pr.vy, pr.vx),
    x = pr.x,
    y = pr.y - 14,
    tail = 70;
  // Comet tail: wide and soft at the back, white-hot near the star.
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    fx.g
      .lineStyle(r * (2.2 - t * 1.6), t > 0.6 ? CREAM : c, 0.18 + t * 0.35)
      .lineBetween(
        x - Math.cos(a) * tail * (1 - t * 0.7),
        y - Math.sin(a) * tail * (1 - t * 0.7),
        x,
        y,
      );
  }
  fx.glow(x, y, r * 2.6, c, 0.45);
  twinkle(fx, x, y, r * 1.4, c, 1, now / 300 + pr.id, 5);
  fx.trail(`sf${pr.id}`, 0.04, () =>
    glitter(fx, x - Math.cos(a) * 10, pr.y, 1, c, 0.3),
  );
}
function starImpact(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  glitter(fx, x, y, 8, color);
  shot(300, (k) => {
    twinkle(fx, x, y - 12, 16 * (1 - k), color, 1 - k, k * 2);
    flare(fx, x, y - 12, 50 * (1 - k * 0.5), color, 1 - k);
  });
}

// ───────────── Eyespot Flash: the eyespots open and flash ─────────────
/**
 * Eyespot Flash: two big eyespots open on the wings in front of Lumoth and
 * a ring of light flashes out to the ability's radius (whoever is looking at
 * Lumoth is stunned).
 */
function eyespotFlash(
  scene: Phaser.Scene,
  a: Ability,
  x0: number,
  y0: number,
  angle: number,
  color: number,
  shot: Shot,
  at?: Follow,
) {
  // Start where the caster is drawn (not the server position it was cast from).
  const origin = at?.() ?? { x: x0, y: y0 },
    { x, y } = origin;
  const fx = fxFor(scene),
    reach = a.radius;
  // The flash: a ring of light out to its reach (whoever looks is stunned).
  glitter(fx, x, y, 18, color, 1);
  shot(fx.reduced ? 220 : 520, (k) => {
    const { x, y } = at?.() ?? origin;
    const out = ease(Math.min(1, k * 1.6)),
      fade = 1 - k;
    fx.floor
      .lineStyle(6, GOLD, 0.55 * fade)
      .strokeEllipse(x, y, reach * 2 * out, reach * 2 * out * 0.82);
    fx.floor
      .lineStyle(2, CREAM, 0.8 * fade)
      .strokeEllipse(x, y, reach * 1.9 * out, reach * 1.9 * out * 0.82);
    fx.floor
      .fillStyle(GOLD, 0.1 * fade)
      .fillEllipse(x, y, reach * 2 * out, reach * 2 * out * 0.82);
    if (k < 0.2) fx.glow(x, y - 22, 90, 0xffffff, 0.6 * (1 - k / 0.2));
  });
  shot(fx.reduced ? 200 : 460, (k) => {
    // The strike stays on the caster while it moves.
    const { x, y } = at?.() ?? origin,
      cy = y - 22;
    const open = Math.min(1, k / 0.25),
      fade = k > 0.55 ? 1 - (k - 0.55) / 0.45 : 1,
      r = 20 * open;
    for (const side of [-1, 1]) {
      const ex = x + Math.cos(angle + side * 0.8) * 46,
        ey = cy + Math.sin(angle + side * 0.8) * 30;
      fx.solid.fillStyle(INK, 0.5 * fade).fillCircle(ex, ey, r * 1.25);
      fx.solid.fillStyle(CREAM, fade).fillCircle(ex, ey, r);
      fx.solid.fillStyle(GOLD, fade).fillCircle(ex, ey, r * 0.7);
      fx.solid.fillStyle(INK, fade).fillCircle(ex, ey, r * 0.4);
      fx.solid
        .fillStyle(0xffffff, fade)
        .fillCircle(ex - r * 0.15, ey - r * 0.18, r * 0.14);
      fx.glow(ex, ey, r * 3, GOLD, 0.5 * fade);
    }
  });
}
function kindle(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  _angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    cy = y - 16;
  glitter(fx, x, y, 14, color, 0.6);
  shot(fx.reduced ? 300 : 1000, (k) => {
    const fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1,
      form = ease(Math.min(1, k * 3));
    // Sparkles spiralling up around Lumoth.
    for (let i = 0; i < 8; i++) {
      const t = (k * 1.4 + i / 8) % 1,
        aa = t * TAU * 1.5 + i,
        px = x + Math.cos(aa) * 30,
        py = cy + 10 - t * 60 + Math.sin(aa) * 8;
      twinkle(
        fx,
        px,
        py,
        5 * (1 - t * 0.5),
        i % 2 ? color : GOLD,
        fade * (1 - t * 0.3),
        t * 6,
      );
    }
    // The halo settles above the head.
    fx.solid
      .lineStyle(6, INK, 0.25 * fade * form)
      .strokeEllipse(x, cy - 44, 46 * form, 14 * form);
    fx.g
      .lineStyle(5, GOLD, 0.9 * fade * form)
      .strokeEllipse(x, cy - 44, 44 * form, 13 * form);
    fx.g
      .lineStyle(2, CREAM, fade * form)
      .strokeEllipse(x, cy - 44, 44 * form, 13 * form);
    fx.glow(x, cy - 44, 36, color, 0.5 * fade * form);
    fx.glow(x, cy, 50 * (0.8 + Math.sin(k * 20) * 0.1), color, 0.35 * fade);
  });
}

// ───────────── Radiant Flare: a sunburst ─────────────
function flareWindup(
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
    r = a.radius,
    sq = 0.82,
    cy = y - 16;
  fx.floorSolid
    .fillStyle(color, 0.08 + k * 0.12)
    .fillEllipse(x, y, r * 2, r * 2 * sq);
  fx.floorSolid.lineStyle(2, GOLD, 0.8).strokeEllipse(x, y, r * 2, r * 2 * sq);
  // Light pours inward from the rim.
  for (let i = 0; i < 12; i++) {
    const aa = (i * TAU) / 12 + now / 1500,
      from = r * (1 - k * 0.6),
      to = r * (0.9 - k * 0.8);
    fx.g
      .lineStyle(3, GOLD, 0.35 + k * 0.5)
      .lineBetween(
        x + Math.cos(aa) * from,
        y + Math.sin(aa) * from * sq,
        x + Math.cos(aa) * to,
        y + Math.sin(aa) * to * sq,
      );
  }
  fx.glow(x, cy, 24 + k * 60, color, 0.4 + k * 0.5);
  twinkle(fx, x, cy, 6 + k * 14, color, 0.6 + k * 0.4, now / 200);
}
/** Radiant Flare's cast: Lumoth lights up (the rays are the zone). */
function radiantFlare(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  _angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    cy = y - 16;
  glitter(fx, x, y, 30, color, 1.6);
  fx.decal({ kind: "glyph", x, y, r: a.range * 0.5, color: GOLD, life: 2.4 });
  fx.shake(140, 0.003);
  shot(fx.reduced ? 200 : 420, (k) => {
    const fade = 1 - k;
    fx.glow(x, cy, 120 * (1 - k * 0.5), 0xffffff, 0.7 * fade);
    flare(fx, x, cy, 80 * (1 - k * 0.4), color, fade);
  });
}
/**
 * Radiant Flare: rays of light turning round Lumoth like a lighthouse's
 * (`count` of them, `radius` px long, pointing from `z.angle`).
 */
function lighthouse(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    a = z.ability,
    rays = a.count ?? 3,
    len = z.radius * ease(Math.min(1, progress * 10)),
    fade = progress > 0.9 ? 1 - (progress - 0.9) / 0.1 : 1,
    sq = 0.82,
    cy = z.y - 16,
    w = Math.atan2(a.radius, z.radius);
  for (let i = 0; i < rays; i++) {
    const ang = (z.angle ?? 0) + (i * TAU) / rays;
    const tip = (o: number, l: number) => ({
      x: z.x + Math.cos(ang + o) * l,
      y: cy + Math.sin(ang + o) * l * sq,
    });
    // A pool of light on the floor, then the beam itself.
    const f1 = tip(-w * 1.6, len),
      f2 = tip(w * 1.6, len);
    fx.floor
      .fillStyle(GOLD, 0.14 * fade)
      .fillTriangle(z.x, z.y, f1.x, f1.y + 16, f2.x, f2.y + 16);
    const p1 = tip(-w, len),
      p2 = tip(w, len);
    fx.solid.fillStyle(GOLD, 0.5 * fade).fillTriangle(z.x, cy, p1.x, p1.y, p2.x, p2.y);
    const c1 = tip(-w * 0.4, len * 0.95),
      c2 = tip(w * 0.4, len * 0.95);
    fx.g.fillStyle(CREAM, 0.75 * fade).fillTriangle(z.x, cy, c1.x, c1.y, c2.x, c2.y);
    const end = tip(0, len);
    fx.glow(end.x, end.y, 26, GOLD, 0.45 * fade);
  }
  fx.glow(z.x, cy, 60, GOLD, 0.55 * fade);
  twinkle(fx, z.x, cy, 18, GOLD, fade, now / 300);
}

// ───────────── Casts and hits ─────────────
function lightCast(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    mx = x + Math.cos(angle) * 22,
    my = y - 14 + Math.sin(angle) * 22;
  shot(160, (k) => {
    twinkle(fx, mx, my, 12 * (1 - k), color, 1 - k, k * 3);
    fx.glow(mx, my, 30 * (1 - k * 0.4), color, 0.6 * (1 - k));
  });
}
function lightHit(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  glitter(fx, x, y, 8, color, 0.8);
  shot(fx.reduced ? 140 : 320, (k) => {
    twinkle(fx, x, y - 18, 14 * (1 - k * 0.6), color, 1 - k, k * 2);
    flare(fx, x, y - 18, 44 * (1 - k * 0.4), color, 0.9 * (1 - k));
  });
}

// ═════════════ Sunbara: sunlight, yuzu and warm springs ═════════════
const YUZU = 0xffc83d;
const PEEL = 0xe8961c;
const ZEST = 0xfff07a;
const LEAF = 0x8fd16a;
const SPRING = 0x6fd3c4;
const STONE = 0x8b7d6b;
const SQ = 0.82;

/** A little yuzu: dark rim, peel, dimples, a leaf and a shine. */
function yuzu(
  fx: Fx,
  x: number,
  y: number,
  r: number,
  spin: number,
  alpha = 1,
) {
  fx.solid.fillStyle(INK, 0.45 * alpha).fillCircle(x, y, r * 1.12);
  fx.solid.fillStyle(PEEL, alpha).fillCircle(x, y, r);
  fx.solid
    .fillStyle(YUZU, alpha)
    .fillCircle(x - r * 0.12, y - r * 0.12, r * 0.82);
  for (let i = 0; i < 6; i++) {
    const a = spin + i * 1.9,
      d = r * (0.3 + hash(i) * 0.4);
    fx.solid
      .fillStyle(PEEL, 0.55 * alpha)
      .fillCircle(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.07 + 0.6);
  }
  fx.solid
    .fillStyle(CREAM, 0.9 * alpha)
    .fillEllipse(x - r * 0.38, y - r * 0.42, r * 0.5, r * 0.3);
  // Stem and leaf.
  const lx = x + Math.cos(spin - 1.6) * r * 0.9,
    ly = y + Math.sin(spin - 1.6) * r * 0.9;
  fx.solid
    .fillStyle(0x3f7a2c, alpha)
    .fillEllipse(
      lx + Math.cos(spin - 1.1) * r * 0.3,
      ly + Math.sin(spin - 1.1) * r * 0.3,
      r * 0.75,
      r * 0.38,
    );
  fx.solid
    .fillStyle(LEAF, alpha)
    .fillEllipse(
      lx + Math.cos(spin - 1.1) * r * 0.28,
      ly + Math.sin(spin - 1.1) * r * 0.28,
      r * 0.6,
      r * 0.26,
    );
}
/** A healing plus: dark outline, coloured body, soft light. */
function healPlus(
  fx: Fx,
  x: number,
  y: number,
  s: number,
  color: number,
  alpha: number,
) {
  if (alpha <= 0 || s <= 0) return;
  fx.solid
    .fillStyle(INK, 0.4 * alpha)
    .fillRect(x - s * 0.42, y - s * 1.12, s * 0.84, s * 2.24)
    .fillRect(x - s * 1.12, y - s * 0.42, s * 2.24, s * 0.84);
  fx.solid
    .fillStyle(color, alpha)
    .fillRect(x - s * 0.3, y - s, s * 0.6, s * 2)
    .fillRect(x - s, y - s * 0.3, s * 2, s * 0.6);
  fx.solid
    .fillStyle(CREAM, alpha)
    .fillRect(x - s * 0.12, y - s * 0.75, s * 0.24, s * 1.5);
  fx.glow(x, y, s * 2.6, color, 0.35 * alpha);
}
/**
 * Pluses rising from the spring after each heal tick (the zone's own
 * tickDelay and tickInterval), spread over its radius.
 */
function healTicks(
  fx: Fx,
  z: Zone,
  progress: number,
  color: number,
  n: number,
) {
  const a = z.ability,
    t = progress * (a.duration || 1) - (a.tickDelay ?? 0.35),
    every = a.tickInterval ?? 0.5;
  if (t < 0) return;
  const tick = Math.floor(t / every),
    phase = (t - tick * every) / every;
  for (let i = 0; i < n; i++) {
    const seed = z.id * 13 + tick * 7 + i,
      ang = hash(seed) * TAU,
      d = Math.sqrt(hash(seed + 3)) * z.radius * 0.8,
      px = z.x + Math.cos(ang) * d,
      py = z.y + Math.sin(ang) * d * SQ - 14 - phase * 46,
      fade = phase < 0.15 ? phase / 0.15 : 1 - (phase - 0.15) / 0.85;
    healPlus(fx, px, py, 6 + hash(seed + 5) * 3, i % 2 ? LEAF : color, fade);
  }
}

// ───────────── Sunseed ─────────────
function sunseed(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    c = pr.color,
    a = Math.atan2(pr.vy, pr.vx),
    cos = Math.cos(a),
    sin = Math.sin(a),
    x = pr.x,
    y = pr.y - 12;
  fx.solid
    .fillStyle(0x000000, 0.16)
    .fillEllipse(pr.x, pr.y + 12, r * 1.8, r * 0.6);
  // A warm comet tail that tapers to nothing behind it.
  for (let i = 0; i < 5; i++) {
    const t0 = i / 5,
      t1 = (i + 1) / 5,
      len = 56;
    fx.g
      .lineStyle(r * (0.3 + t1 * 0.9), t1 > 0.7 ? ZEST : c, 0.12 + t1 * 0.3)
      .lineBetween(
        x - cos * len * (1 - t0),
        y - sin * len * (1 - t0),
        x - cos * len * (1 - t1),
        y - sin * len * (1 - t1),
      );
  }
  fx.glow(x, y, r * 2.6, c, 0.4);
  // The seed: a teardrop pointing along its flight, with a sprout behind.
  const tip = { x: x + cos * r * 1.5, y: y + sin * r * 1.5 },
    back = { x: x - cos * r * 0.9, y: y - sin * r * 0.9 },
    side = (s: number) => ({
      x: x - sin * r * 0.85 * s,
      y: y + cos * r * 0.85 * s,
    });
  fx.solid.fillStyle(INK, 0.4).fillPoints(
    [
      { x: tip.x + cos * 2, y: tip.y + sin * 2 },
      { x: side(1.2).x, y: side(1.2).y },
      { x: back.x - cos * 2, y: back.y - sin * 2 },
      { x: side(-1.2).x, y: side(-1.2).y },
    ],
    true,
  );
  fx.solid.fillStyle(GOLD, 1).fillPoints([tip, side(1), back, side(-1)], true);
  fx.solid
    .fillStyle(CREAM, 1)
    .fillCircle(x + cos * r * 0.15, y + sin * r * 0.15, r * 0.35);
  const wag = Math.sin(now / 70 + pr.id) * 0.5;
  fx.solid
    .fillStyle(LEAF, 1)
    .fillEllipse(
      back.x - Math.cos(a + wag) * r * 0.5,
      back.y - Math.sin(a + wag) * r * 0.5 - 2,
      r * 0.8,
      r * 0.45,
    );
  fx.trail(`ss${pr.id}`, 0.04, () =>
    glitter(fx, x - cos * 8, pr.y, 1, c, 0.15),
  );
}
function sunseedImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = a.radius;
  glitter(fx, x, y, 7, color, 0.7);
  shot(fx.reduced ? 140 : 300, (k) => {
    twinkle(fx, x, y - 12, r * 1.5 * (1 - k), GOLD, 1 - k, k * 2);
    fx.shockwave(x, y, r * (1 + ease(k) * 2.2), k, GOLD, 4);
    fx.glow(x, y - 12, r * 3 * (1 - k * 0.5), color, 0.6 * (1 - k));
  });
}

// ───────────── Yuzu Toss ─────────────
function yuzuToss(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    c = pr.color,
    a = Math.atan2(pr.vy, pr.vx),
    hop = Math.abs(Math.sin(now / 140 + pr.id)) * 8,
    x = pr.x,
    y = pr.y - 16 - hop;
  fx.solid
    .fillStyle(0x000000, 0.2)
    .fillEllipse(pr.x, pr.y + 12, r * 2 * (1 - hop / 30), r * 0.7);
  fx.glow(x, y, r * 3.2, c, 0.4);
  fx.glow(pr.x, pr.y + 10, r * 2.2, YUZU, 0.25, true);
  yuzu(fx, x, y, r, now / 90 + pr.id);
  fx.trail(`yz${pr.id}`, 0.05, () =>
    fx.burst({
      x: x - Math.cos(a) * r,
      y: pr.y,
      z: 16 + hop,
      count: 1,
      kind: "drop",
      color: [YUZU, ZEST],
      speed: [10, 40],
      up: [20, 60],
      life: [0.4, 0.7],
      size: [1.6, 2.6],
      grav: 500,
    }),
  );
}
/** The yuzu bursts: juice, peel and zest out to the real explosion radius. */
function yuzuBurst(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    blast = a.explosion ?? 80;
  fx.decal({ kind: "wet", x, y, r: blast * 0.8, color: YUZU, life: 3 });
  fx.burst({
    x,
    y,
    z: 14,
    count: 22,
    kind: "drop",
    color: [YUZU, ZEST, PEEL],
    speed: [blast * 1.2, blast * 3.2],
    up: [120, 300],
    life: [0.5, 0.9],
    size: [2, 3.6],
    grav: 900,
    drag: 1.2,
  });
  fx.burst({
    x,
    y,
    z: 14,
    count: 8,
    kind: "debris",
    color: [PEEL, YUZU],
    speed: [blast * 1, blast * 2.4],
    up: [160, 320],
    life: [0.6, 1],
    size: [3, 5],
    grav: 1000,
    bounce: 0.3,
  });
  glitter(fx, x, y, 12, color, 1.2);
  fx.shake(110, 0.003);
  shot(fx.reduced ? 220 : 520, (k) => {
    const out = ease(Math.min(1, k * 1.8)),
      fade = 1 - k;
    fx.floorSolid
      .fillStyle(YUZU, 0.22 * fade)
      .fillEllipse(x, y, blast * 2 * out, blast * 2 * SQ * out);
    fx.shockwave(x, y, blast * out, k, YUZU, 9);
    // Yuzu wedges flung outward, tumbling.
    const hold = k < 0.6 ? 1 : (1 - k) / 0.4;
    for (let i = 0; i < 6; i++) {
      const aa = (i * TAU) / 6 + 0.3,
        d = blast * 0.8 * out,
        px = x + Math.cos(aa) * d,
        py = y - 14 + Math.sin(aa) * d * SQ - Math.sin(out * Math.PI) * 18,
        rot = aa + k * 6 * (i % 2 ? 1 : -1);
      fx.solid
        .fillStyle(INK, 0.4 * hold)
        .slice(px, py, 11, rot - 1, rot + 1)
        .fillPath();
      fx.solid
        .fillStyle(PEEL, hold)
        .slice(px, py, 10, rot - 0.95, rot + 0.95)
        .fillPath();
      fx.solid
        .fillStyle(ZEST, hold)
        .slice(px, py, 7.5, rot - 0.85, rot + 0.85)
        .fillPath();
    }
    fx.glow(x, y - 12, blast * 0.8, color, 0.45 * fade);
    if (k < 0.2) fx.glow(x, y - 12, blast * 0.5, 0xffffff, 0.8 * (1 - k / 0.2));
  });
}
function yuzuCast(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  lightCast(scene, a, x, y, angle, color, shot);
  const fx = fxFor(scene);
  // A little zest spray as the yuzu leaves.
  fx.burst({
    x: x + Math.cos(angle) * 26,
    y: y + Math.sin(angle) * 26,
    z: 16,
    count: 5,
    kind: "drop",
    color: [YUZU, ZEST],
    angle,
    spread: 0.6,
    speed: [40, 120],
    up: [40, 120],
    life: [0.4, 0.7],
    size: [1.4, 2.4],
    grav: 600,
  });
}

// ───────────── Warm Spring ─────────────
/**
 * A still hot spring at Sunbara's feet, as wide as the zone: a ring of
 * stones, warm teal water with ripples, a yuzu bobbing in it, steam, and
 * pluses on each heal tick.
 */
function warmSpring(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    r = z.radius,
    { x, y } = z,
    c = z.color,
    grow = ease(Math.min(1, progress / 0.1)),
    fade = progress > 0.88 ? (1 - progress) / 0.12 : 1,
    a = fade,
    rr = r * (0.55 + 0.45 * grow);
  fx.trail(`wsb${z.id}`, 999, () => {
    fx.burst({
      x,
      y,
      z: 6,
      count: 14,
      kind: "drop",
      color: [SPRING, 0xbff3ea, CREAM],
      speed: [40, r * 1.2],
      up: [120, 260],
      life: [0.5, 0.9],
      size: [1.8, 3],
      grav: 800,
    });
  });
  // Water: deep teal edge, warm golden centre.
  fx.floorSolid
    .fillStyle(0x2e6f73, 0.3 * a)
    .fillEllipse(x, y, rr * 2, rr * 2 * SQ);
  fx.floorSolid
    .fillStyle(SPRING, 0.42 * a)
    .fillEllipse(x, y, rr * 1.84, rr * 1.84 * SQ);
  fx.glow(x, y, rr * 0.9, GOLD, 0.35 * a, true);
  fx.glow(x, y, rr * 1.1, c, 0.18 * a, true);
  // Ripples spreading from the middle.
  for (let i = 0; i < 3; i++) {
    const k = (now / 1600 + i / 3) % 1,
      rp = rr * (0.15 + k * 0.75);
    fx.floor
      .lineStyle(2, CREAM, 0.45 * a * (1 - k))
      .strokeEllipse(x, y, rp * 2, rp * 2 * SQ);
  }
  // Glints on the water.
  for (let i = 0; i < 6; i++) {
    const ang = hash(z.id + i) * TAU + now / 3000,
      d = rr * (0.3 + hash(i * 5) * 0.5),
      tw = 0.5 + 0.5 * Math.sin(now / 200 + i * 2);
    fx.floor
      .fillStyle(0xffffff, 0.55 * a * tw)
      .fillEllipse(x + Math.cos(ang) * d, y + Math.sin(ang) * d * SQ, 8, 2.5);
  }
  // Ring of rim stones at the real radius.
  const stones = Math.max(10, Math.round(rr / 9));
  for (let i = 0; i < stones; i++) {
    const ang = (i * TAU) / stones + hash(z.id + i * 3) * 0.12,
      sx = x + Math.cos(ang) * rr,
      sy = y + Math.sin(ang) * rr * SQ,
      s = 6 + hash(i * 7 + z.id) * 4;
    fx.floorSolid
      .fillStyle(0x3d342b, 0.5 * a)
      .fillEllipse(sx, sy + 2, s * 2.3, s * 1.4);
    fx.floorSolid
      .fillStyle(STONE, 0.95 * a)
      .fillEllipse(sx, sy, s * 2, s * 1.3);
    fx.floorSolid
      .fillStyle(0xb7a993, 0.9 * a)
      .fillEllipse(sx - s * 0.25, sy - s * 0.3, s * 0.9, s * 0.5);
  }
  // A yuzu bobbing in the water.
  const bob = Math.sin(now / 420 + z.id) * 2.5,
    yx = x + Math.cos(now / 2400 + z.id) * rr * 0.28,
    yy = y + Math.sin(now / 2400 + z.id) * rr * 0.2;
  fx.floor.lineStyle(2, CREAM, 0.5 * a).strokeEllipse(yx, yy + 4, 34, 11);
  yuzu(fx, yx, yy - 3 + bob, 10 * grow, 0.6 + Math.sin(now / 900) * 0.2, a);
  // Steam rising.
  fx.trail(`wss${z.id}`, 0.09, () => {
    const ang = Math.random() * TAU,
      d = Math.sqrt(Math.random()) * rr * 0.8;
    fx.burst({
      x: x + Math.cos(ang) * d,
      y: y + Math.sin(ang) * d * SQ,
      z: 6,
      count: 1,
      kind: "smoke",
      color: [0xfff8ea, 0xffffff],
      speed: [2, 12],
      up: [30, 60],
      life: [0.9, 1.5],
      size: [7, 12],
      drag: 0.8,
    });
  });
  healTicks(fx, z, progress, GOLD, 4);
}
function springCast(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  _angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  glitter(fx, x, y, 8, color, 0.6);
  shot(fx.reduced ? 160 : 360, (k) =>
    fx.glow(x, y - 16, 44 * (1 - k * 0.4), GOLD, 0.6 * (1 - k)),
  );
}

// ───────────── Daybreak ─────────────
/**
 * Morning breaks around Sunbara: the sun lifts over its head, rays sweep out
 * to the real radius and a bright dawn ring rolls to the edge.
 */
function daybreak(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  _angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = a.radius,
    cy = y - 16;
  glitter(fx, x, y, 26, color, 1.6);
  fx.decal({ kind: "glyph", x, y, r: r * 0.95, color: GOLD, life: 2.2 });
  fx.shake(140, 0.004);
  shot(fx.reduced ? 240 : 760, (k) => {
    const out = ease(Math.min(1, k * 2)),
      fade = 1 - k,
      rise = ease(Math.min(1, k * 2.5));
    fx.floorSolid
      .fillStyle(color, 0.16 * fade)
      .fillEllipse(x, y, r * 2 * out, r * 2 * SQ * out);
    fx.glow(x, y, r * 1.1 * out, GOLD, 0.45 * fade, true);
    // Rays fanning out on the ground, out to the edge of the stun.
    for (let i = 0; i < 16; i++) {
      const aa = (i * TAU) / 16 + 0.1,
        len = r * out * (i % 2 ? 0.82 : 1),
        w = 0.06;
      fx.floor
        .fillStyle(i % 2 ? GOLD : CREAM, 0.5 * fade)
        .fillTriangle(
          x,
          y,
          x + Math.cos(aa - w) * len,
          y + Math.sin(aa - w) * len * SQ,
          x + Math.cos(aa + w) * len,
          y + Math.sin(aa + w) * len * SQ,
        );
    }
    fx.shockwave(x, y, r * out, k, GOLD, 12);
    fx.shockwave(x, y, r * 0.7 * out, k, color, 6);
    // The sun climbs over the yuzu and blooms.
    const sy = cy - 26 - rise * 40,
      sr = 14 + rise * 8;
    fx.glow(x, sy, sr * 4.5, color, 0.6 * fade);
    fx.solid.fillStyle(INK, 0.3 * fade).fillCircle(x, sy, sr * 1.12);
    fx.solid.fillStyle(PEEL, fade).fillCircle(x, sy, sr);
    fx.solid.fillStyle(YUZU, fade).fillCircle(x, sy, sr * 0.82);
    fx.solid.fillStyle(CREAM, fade).fillCircle(x, sy, sr * 0.45);
    for (let i = 0; i < 10; i++) {
      const aa = (i * TAU) / 10 + k,
        r0 = sr * 1.35,
        r1 = sr * (1.9 + (i % 2) * 0.5);
      fx.g
        .lineStyle(3, GOLD, 0.85 * fade)
        .lineBetween(
          x + Math.cos(aa) * r0,
          sy + Math.sin(aa) * r0,
          x + Math.cos(aa) * r1,
          sy + Math.sin(aa) * r1,
        );
    }
    flare(fx, x, sy, r * 1.2 * (1 - k * 0.3), color, fade);
    if (k < 0.12) fx.glow(x, cy, r * 0.7, 0xffffff, 0.85 * (1 - k / 0.12));
  });
}

// ───────────── Sanctuary ─────────────
/**
 * A sunny glade that follows Sunbara (the zone's own position each frame):
 * grass and flowers out to the radius, shafts of sun, pollen, heal pluses.
 * Enemies are slowed inside, shown by petals drifting along the rim. Opens
 * with the ultimate's screen-wide moment.
 */
function sanctuary(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    r = z.radius,
    { x, y } = z,
    c = z.color,
    dur = z.ability.duration || 1,
    t = progress * dur,
    grow = ease(Math.min(1, t / 0.35)),
    fade = progress > 0.9 ? (1 - progress) / 0.1 : 1,
    a = fade,
    rr = r * grow;
  fx.trail(`sct${z.id}`, 999, () => {
    fx.ultimate(GOLD, 900);
    fx.shake(160, 0.004);
    glitter(fx, x, y, 40, c, 2);
    fx.burst({
      x,
      y,
      z: 20,
      count: 26,
      kind: "mote",
      color: [0xffb3c8, CREAM, LEAF],
      speed: [r * 0.8, r * 1.8],
      up: [80, 220],
      life: [0.9, 1.6],
      size: [1.6, 2.6],
      grav: 60,
      drag: 1.6,
    });
  });
  // The glade opening: a sunlit shockwave out to the real radius.
  if (t < 0.6) {
    const k = t / 0.6;
    fx.shockwave(x, y, r * ease(k), k, GOLD, 14);
    fx.glow(x, y - 40, 90, 0xffffff, 0.7 * (1 - k));
  }
  // Grass and warm light on the floor.
  fx.floorSolid
    .fillStyle(0x4f8a3a, 0.16 * a)
    .fillEllipse(x, y, rr * 2, rr * 2 * SQ);
  fx.floorSolid
    .fillStyle(LEAF, 0.14 * a)
    .fillEllipse(x, y, rr * 1.6, rr * 1.6 * SQ);
  fx.glow(x, y, rr * 1.05, GOLD, 0.32 * a, true);
  fx.floor.lineStyle(3, GOLD, 0.6 * a).strokeEllipse(x, y, rr * 2, rr * 2 * SQ);
  // Grass tufts and flowers around the rim (they travel with the glade).
  const n = Math.max(14, Math.round(rr / 10));
  for (let i = 0; i < n; i++) {
    const ang = (i * TAU) / n + hash(z.id + i) * 0.15,
      d = rr * (0.92 + hash(i * 3) * 0.1),
      px = x + Math.cos(ang) * d,
      py = y + Math.sin(ang) * d * SQ,
      sway = Math.sin(now / 500 + i) * 2;
    fx.floorSolid.lineStyle(2, 0x3f7a2c, 0.9 * a);
    for (const off of [-4, 0, 4])
      fx.floorSolid.lineBetween(
        px + off,
        py,
        px + off * 1.4 + sway,
        py - 9 - Math.abs(off),
      );
    if (i % 3 === 0) {
      const fc = i % 2 ? 0xfff6d6 : 0xffb3c8;
      for (let p = 0; p < 5; p++) {
        const pa = (p * TAU) / 5 + now / 1500;
        fx.floorSolid
          .fillStyle(fc, 0.95 * a)
          .fillCircle(
            px + sway + Math.cos(pa) * 3.2,
            py - 11 + Math.sin(pa) * 3.2,
            2.4,
          );
      }
      fx.floorSolid.fillStyle(YUZU, a).fillCircle(px + sway, py - 11, 2);
    }
  }
  // Shafts of sunlight swaying across the glade.
  for (let i = 0; i < 5; i++) {
    const ang = (i * TAU) / 5 + now / 4000 + z.id,
      d = rr * (0.25 + hash(i * 11) * 0.5),
      px = x + Math.cos(ang) * d,
      py = y + Math.sin(ang) * d * SQ,
      pulse = 0.7 + 0.3 * Math.sin(now / 350 + i * 1.7);
    fx.glow(px + 18, py - 70, 34, GOLD, 0.28 * a * pulse, false, 3.4);
    fx.glow(px + 18, py - 70, 14, CREAM, 0.3 * a * pulse, false, 4.5);
    fx.glow(px, py, 30, GOLD, 0.35 * a * pulse, true);
  }
  // Petals circling the rim: the slowing edge.
  for (let i = 0; i < 10; i++) {
    const ang = (i * TAU) / 10 + now / 1800,
      px = x + Math.cos(ang) * rr * 0.97,
      py =
        y + Math.sin(ang) * rr * 0.97 * SQ - 16 - Math.sin(now / 300 + i) * 5;
    fx.solid
      .fillStyle(i % 2 ? 0xffb3c8 : CREAM, 0.85 * a)
      .fillEllipse(px, py, 7, 3.5);
  }
  fx.trail(`scp${z.id}`, 0.05, () => {
    const ang = Math.random() * TAU,
      d = Math.sqrt(Math.random()) * rr;
    glitter(fx, x + Math.cos(ang) * d, y + Math.sin(ang) * d * SQ, 1, c, 0.4);
  });
  healTicks(fx, z, progress, GOLD, 6);
}

export const lightKit: FxKit = {
  projectile: {
    glint,
    "wing-dust": fallingStar,
    sunseed,
    "yuzu-toss": yuzuToss,
  },
  zone: { "warm-spring": warmSpring, sanctuary, "radiant-flare": lighthouse },
  windup: { "radiant-flare": flareWindup },
  cast: {
    glint: lightCast,
    "wing-dust": lightCast,
    "eyespot-flash": eyespotFlash,
    kindle,
    "radiant-flare": radiantFlare,
    sunseed: lightCast,
    "yuzu-toss": yuzuCast,
    "warm-spring": springCast,
    daybreak,
    sanctuary: springCast,
  },
  impact: {
    glint: starImpact,
    "wing-dust": starImpact,
    sunseed: sunseedImpact,
    "yuzu-toss": yuzuBurst,
  },
  hit: { light: lightHit },
};
