import type Phaser from "phaser";
import type { Ability, Projectile } from "@arena/shared";
import { fxFor, type Fx } from "./fx-engine";
import { TAU, ease, hash, type FxKit, type G, type Shot } from "./fx-kits";
/**
 * Lumoth's kit: starlight. Solid twinkling stars, lens flares, glitter that
 * drifts down, god rays. Light is given solid cores and soft dark edges so it
 * still reads on bright floors. Sizes come from the shared abilities.
 */
const GOLD = 0xffd76a;
const CREAM = 0xfff6d6;
const INK = 0x4a3a18;

/** A four-point twinkle with a dark rim, solid body and white heart. */
function twinkle(fx: Fx, x: number, y: number, s: number, color: number, alpha = 1, rot = 0, points = 4) {
  const star = (r: number, inner: number) =>
    Array.from({ length: points * 2 }, (_, i) => {
      const a = rot + (i * Math.PI) / points - Math.PI / 2,
        d = i % 2 ? r * inner : r;
      return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
    });
  fx.solid.fillStyle(INK, 0.35 * alpha).fillPoints(star(s * 1.18, points === 4 ? 0.3 : 0.45), true);
  fx.solid.fillStyle(color, alpha).fillPoints(star(s, points === 4 ? 0.28 : 0.45), true);
  fx.solid.fillStyle(CREAM, alpha).fillPoints(star(s * 0.5, points === 4 ? 0.3 : 0.45), true);
}
/** Horizontal lens-flare streak. */
function flare(fx: Fx, x: number, y: number, len: number, color: number, alpha: number) {
  fx.glow(x, y, len, color, alpha * 0.8, false, 0.05);
  fx.glow(x, y, len * 0.5, 0xffffff, alpha, false, 0.04);
}
function glitter(fx: Fx, x: number, y: number, n: number, color: number, power = 1) {
  fx.burst({ x, y, z: 18, count: n, kind: "mote", color: [color, GOLD, CREAM], speed: [30 * power, 140 * power], up: [40, 160 * power], life: [0.6, 1.2], size: [1, 1.8], grav: 120, drag: 2.2 });
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
  fx.g.lineStyle(r * 1.2, c, 0.25).lineBetween(x - Math.cos(a) * 60, y - Math.sin(a) * 60, x, y);
  fx.g.lineStyle(2, CREAM, 0.7).lineBetween(x - Math.cos(a) * 40, y - Math.sin(a) * 40, x, y);
  fx.glow(x, y, r * 2.4, c, 0.4);
  twinkle(fx, x, y, r * 1.5, c, 1, now / 120);
  flare(fx, x, y, r * 4 + Math.sin(now / 50) * r, c, 0.6);
  fx.trail(`gl${pr.id}`, 0.03, () => glitter(fx, x, pr.y, 1, c, 0.3));
}

// ───────────── Starfall Spray: five falling stars ─────────────
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
    fx.g.lineStyle(r * (2.2 - t * 1.6), t > 0.6 ? CREAM : c, 0.18 + t * 0.35).lineBetween(x - Math.cos(a) * tail * (1 - t * 0.7), y - Math.sin(a) * tail * (1 - t * 0.7), x, y);
  }
  fx.glow(x, y, r * 2.6, c, 0.45);
  twinkle(fx, x, y, r * 1.4, c, 1, now / 300 + pr.id, 5);
  fx.trail(`sf${pr.id}`, 0.04, () => glitter(fx, x - Math.cos(a) * 10, pr.y, 1, c, 0.3));
}
function starImpact(scene: Phaser.Scene, _a: Ability, x: number, y: number, color: number, shot: Shot) {
  const fx = fxFor(scene);
  glitter(fx, x, y, 8, color);
  shot(300, (k) => {
    twinkle(fx, x, y - 12, 16 * (1 - k), color, 1 - k, k * 2);
    flare(fx, x, y - 12, 50 * (1 - k * 0.5), color, 1 - k);
  });
}

// ───────────── Dust Strike: a wingbeat of glittering dust ─────────────
function dustStrike(scene: Phaser.Scene, a: Ability, x: number, y: number, angle: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    cy = y - 12,
    spread = Math.min(Math.PI * 0.95, Math.acos(a.arc ?? 0.35)),
    range = a.range;
  for (let i = 0; i < 12; i++) {
    const off = (i / 11 - 0.5) * 2 * spread,
      d = range * (0.5 + hash(i) * 0.5);
    fx.burst({ x: x + Math.cos(angle + off) * d, y: y + Math.sin(angle + off) * d, z: 14, count: 2, kind: "mote", color: [color, GOLD, CREAM], angle: angle + off, spread: 0.4, speed: [40, 120], up: [20, 90], life: [0.6, 1.1], size: [1, 1.8], grav: 80, drag: 2 });
  }
  shot(fx.reduced ? 160 : 420, (k) => {
    const sweep = Math.min(1, k / 0.4),
      fade = 1 - Math.max(0, (k - 0.3) / 0.7);
    fx.floor.fillStyle(color, 0.14 * (1 - k)).slice(x, cy + 12, range, angle - spread, angle + spread);
    fx.floor.fillPath();
    // A soft, golden cloud of dust along the swing.
    for (let i = 0; i < 7; i++) {
      const t = i / 6,
        aa = angle - spread + 2 * spread * Math.min(t, sweep),
        d = range * (0.55 + 0.25 * Math.sin(t * Math.PI));
      fx.soft(x + Math.cos(aa) * d, cy + Math.sin(aa) * d, 26 + k * 18, GOLD, 0.35 * fade);
    }
    const pts = Array.from({ length: 16 }, (_, i) => {
      const aa = angle - spread + 2 * spread * sweep * (i / 15);
      return { x: x + Math.cos(aa) * range * 0.8, y: cy + Math.sin(aa) * range * 0.8 };
    });
    fx.solid.lineStyle(7, INK, 0.2 * fade).strokePoints(pts, false);
    fx.g.lineStyle(6, color, 0.6 * fade).strokePoints(pts, false);
    fx.g.lineStyle(2, CREAM, fade).strokePoints(pts.slice(6), false);
    const head = pts[pts.length - 1];
    twinkle(fx, head.x, head.y, 9 * fade, color, fade, k * 4);
  });
}

// ───────────── Kindle: a halo lights up ─────────────
function kindle(scene: Phaser.Scene, _a: Ability, x: number, y: number, _angle: number, color: number, shot: Shot) {
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
      twinkle(fx, px, py, 5 * (1 - t * 0.5), i % 2 ? color : GOLD, fade * (1 - t * 0.3), t * 6);
    }
    // The halo settles above the head.
    fx.solid.lineStyle(6, INK, 0.25 * fade * form).strokeEllipse(x, cy - 44, 46 * form, 14 * form);
    fx.g.lineStyle(5, GOLD, 0.9 * fade * form).strokeEllipse(x, cy - 44, 44 * form, 13 * form);
    fx.g.lineStyle(2, CREAM, fade * form).strokeEllipse(x, cy - 44, 44 * form, 13 * form);
    fx.glow(x, cy - 44, 36, color, 0.5 * fade * form);
    fx.glow(x, cy, 50 * (0.8 + Math.sin(k * 20) * 0.1), color, 0.35 * fade);
  });
}

// ───────────── Radiant Flare: a sunburst ─────────────
function flareWindup(g: G, a: Ability, x: number, y: number, _angle: number, _ax: number, _ay: number, color: number, k: number, now: number) {
  const fx = fxFor(g.scene),
    r = a.radius,
    sq = 0.82,
    cy = y - 16;
  fx.floorSolid.fillStyle(color, 0.08 + k * 0.12).fillEllipse(x, y, r * 2, r * 2 * sq);
  fx.floorSolid.lineStyle(2, GOLD, 0.8).strokeEllipse(x, y, r * 2, r * 2 * sq);
  // Light pours inward from the rim.
  for (let i = 0; i < 12; i++) {
    const aa = (i * TAU) / 12 + now / 1500,
      from = r * (1 - k * 0.6),
      to = r * (0.9 - k * 0.8);
    fx.g.lineStyle(3, GOLD, 0.35 + k * 0.5).lineBetween(x + Math.cos(aa) * from, y + Math.sin(aa) * from * sq, x + Math.cos(aa) * to, y + Math.sin(aa) * to * sq);
  }
  fx.glow(x, cy, 24 + k * 60, color, 0.4 + k * 0.5);
  twinkle(fx, x, cy, 6 + k * 14, color, 0.6 + k * 0.4, now / 200);
}
function radiantFlare(scene: Phaser.Scene, a: Ability, x: number, y: number, _angle: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    r = a.radius,
    sq = 0.82,
    cy = y - 16;
  glitter(fx, x, y, 40, color, 2);
  fx.decal({ kind: "glyph", x, y, r: r * 0.9, color: GOLD, life: 3 });
  fx.shake(180, 0.004);
  shot(fx.reduced ? 240 : 700, (k) => {
    const out = ease(Math.min(1, k * 2.2)),
      fade = 1 - k;
    // God rays: long solid-cored beams rotating slowly outward.
    for (let i = 0; i < 14; i++) {
      const aa = (i * TAU) / 14 + k * 0.4,
        len = r * (i % 2 ? 0.8 : 1.05) * out,
        w = 0.07;
      const p1 = { x: x + Math.cos(aa - w) * len, y: cy + Math.sin(aa - w) * len * sq },
        p2 = { x: x + Math.cos(aa + w) * len, y: cy + Math.sin(aa + w) * len * sq };
      fx.solid.fillStyle(GOLD, 0.45 * fade).fillTriangle(x, cy, p1.x, p1.y, p2.x, p2.y);
      fx.g.fillStyle(CREAM, 0.35 * fade).fillTriangle(x, cy, (x + p1.x) / 2, (cy + p1.y) / 2, (x + p2.x) / 2, (cy + p2.y) / 2);
    }
    fx.glow(x, cy, r * 0.8, color, 0.6 * fade);
    if (k < 0.15) fx.glow(x, cy, r * 0.6, 0xffffff, 0.8 * (1 - k / 0.15));
    flare(fx, x, cy, r * 1.4 * (1 - k * 0.4), color, fade);
    twinkle(fx, x, cy, 26 * (1 - k * 0.6), color, fade, k * 3);
    fx.shockwave(x, y, r * out, k, GOLD, 8);
  });
}

// ───────────── Casts and hits ─────────────
function lightCast(scene: Phaser.Scene, _a: Ability, x: number, y: number, angle: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    mx = x + Math.cos(angle) * 22,
    my = y - 14 + Math.sin(angle) * 22;
  shot(160, (k) => {
    twinkle(fx, mx, my, 12 * (1 - k), color, 1 - k, k * 3);
    fx.glow(mx, my, 30 * (1 - k * 0.4), color, 0.6 * (1 - k));
  });
}
function lightHit(scene: Phaser.Scene, x: number, y: number, color: number, shot: Shot) {
  const fx = fxFor(scene);
  glitter(fx, x, y, 8, color, 0.8);
  shot(fx.reduced ? 140 : 320, (k) => {
    twinkle(fx, x, y - 18, 14 * (1 - k * 0.6), color, 1 - k, k * 2);
    flare(fx, x, y - 18, 44 * (1 - k * 0.4), color, 0.9 * (1 - k));
  });
}

export const lightKit: FxKit = {
  projectile: { glint, "starfall-spray": fallingStar },
  windup: { "radiant-flare": flareWindup },
  cast: { glint: lightCast, "starfall-spray": lightCast, "dust-strike": dustStrike, kindle, "radiant-flare": radiantFlare },
  impact: { glint: starImpact, "starfall-spray": starImpact },
  hit: { light: lightHit },
};
