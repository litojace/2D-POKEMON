import type Phaser from "phaser";
import type { Ability, Projectile } from "@arena/shared";
import { fxFor, type Fx } from "./fx-engine";
import { TAU, ease, hash, type FxKit, type G, type Shot } from "./fx-kits";
/**
 * Duskveil's kit: darkness and ghost-light. Shade is drawn as real dark
 * (normal blend), ghostfire as cold teal flame, and the void pulls things in
 * before it bursts. Sizes come from the shared abilities.
 */
const GHOST = 0x7dffe1;
const PALE = 0xd9fff6;
const SHADE = 0x150b26;
const VIOLET = 0xb59bff;

/** Cold flame: dark rim, teal body, pale heart; tongue trails behind travel. */
function ghostFlame(fx: Fx, x: number, y: number, r: number, dir: number, now: number, seed: number, color = GHOST) {
  const flick = 0.85 + hash(seed + Math.floor(now / 70)) * 0.3,
    bx = -Math.cos(dir),
    by = -Math.sin(dir);
  for (let i = 3; i >= 0; i--) {
    const d = i * r * 0.55 * flick,
      s = r * (1 - i * 0.2);
    fx.soft(x + bx * d, y + by * d - i * 2, s * 1.6, SHADE, 0.28);
    fx.soft(x + bx * d, y + by * d - i * 2, s * 1.25, color, 0.75 - i * 0.12);
  }
  fx.glow(x, y, r * 3, color, 0.45);
  fx.soft(x, y, r * 0.55, PALE, 0.95);
}
const wisps = (fx: Fx, x: number, y: number, n: number, speed: [number, number] = [10, 40]) =>
  fx.burst({ x, y, z: 8, count: n, kind: "smoke", color: [SHADE, 0x2a1846], speed, up: [20, 60], life: [0.5, 1], size: [6, 11], drag: 2 });
const ghostMotes = (fx: Fx, x: number, y: number, n: number, color = GHOST) =>
  fx.burst({ x, y, z: 10, count: n, kind: "mote", color: [color, PALE], speed: [10, 50], up: [30, 80], life: [0.5, 1], size: [1, 1.8], drag: 2 });

// ───────────── Projectiles ─────────────
function lanternWisp(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    dir = Math.atan2(pr.vy, pr.vx);
  fx.solid.fillStyle(0x000000, 0.18).fillEllipse(pr.x, pr.y + 18, pr.ability.radius * 2, pr.ability.radius * 0.7);
  ghostFlame(fx, pr.x, pr.y, pr.ability.radius, dir, now, pr.id);
  fx.trail(`p${pr.id}`, 0.05, () => ghostMotes(fx, pr.x, pr.y, 1));
}
function ghostfire(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    dir = Math.atan2(pr.vy, pr.vx),
    r = pr.ability.radius;
  ghostFlame(fx, pr.x, pr.y, r * 1.1, dir, now, pr.id);
  fx.trail(`p${pr.id}`, 0.04, () => {
    wisps(fx, pr.x - Math.cos(dir) * r, pr.y, 1);
    ghostMotes(fx, pr.x, pr.y, 1);
  });
}
function shadeCrawl(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    dir = Math.atan2(pr.vy, pr.vx),
    r = pr.ability.radius,
    cos = Math.cos(dir),
    sin = Math.sin(dir),
    x = pr.x,
    y = pr.y + 8;
  // A puddle of shadow slithering along the floor, eyes leading.
  for (let i = 0; i < 6; i++) {
    const d = i * r * 0.9,
      wob = Math.sin(now / 60 - i * 0.9) * r * 0.35;
    fx.floorSolid.fillStyle(SHADE, 0.55 - i * 0.07).fillEllipse(x - cos * d - sin * wob, y - sin * d * 0.8 + cos * wob * 0.5, r * (2.4 - i * 0.25), r * (1.3 - i * 0.14));
  }
  fx.floorSolid.fillStyle(pr.color, 0.5).fillEllipse(x, y, r * 2.2, r * 1.15);
  const ex = -sin * 4,
    ey = cos * 3;
  fx.floor.fillStyle(GHOST, 1).fillCircle(x + cos * 6 + ex, y + sin * 4 + ey, 2.4).fillCircle(x + cos * 6 - ex, y + sin * 4 - ey, 2.4);
  fx.glow(x + cos * 6, y, 14, GHOST, 0.4, true);
  fx.trail(`p${pr.id}`, 0.035, () => wisps(fx, x - cos * r, y - 6, 1, [5, 20]));
}
function curseMark(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    x = pr.x,
    y = pr.y,
    spin = now / 200;
  const tri = (rot: number, rr: number) => [0, 1, 2].map((i) => ({ x: x + Math.cos(rot + (i * TAU) / 3) * rr, y: y + Math.sin(rot + (i * TAU) / 3) * rr }));
  fx.solid.fillStyle(SHADE, 0.55).fillCircle(x, y, r * 1.25);
  fx.glow(x, y, r * 3, pr.color, 0.45);
  fx.g.lineStyle(2.5, pr.color, 0.95).strokeCircle(x, y, r);
  fx.g.lineStyle(2, VIOLET, 0.9).strokePoints(tri(spin, r * 0.95), true).strokePoints(tri(spin + Math.PI, r * 0.95), true);
  // Runes orbiting the sigil.
  for (let i = 0; i < 3; i++) {
    const a = -spin * 1.6 + (i * TAU) / 3;
    fx.g.fillStyle(PALE, 0.9).fillCircle(x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 1.6, 2.2);
  }
  fx.g.fillStyle(PALE, 1).fillCircle(x, y, r * 0.22);
  fx.trail(`p${pr.id}`, 0.05, () => wisps(fx, x, y, 1));
}
function voidOrb(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    x = pr.x,
    y = pr.y - 8;
  fx.solid.fillStyle(0x000000, 0.25).fillEllipse(pr.x, pr.y + 16, r * 2.2, r * 0.8);
  // Event horizon: a black core rimmed by bent violet light.
  fx.glow(x, y, r * 2.6, pr.color, 0.5);
  for (let i = 0; i < 3; i++) {
    const a = -now / 160 + (i * TAU) / 3;
    fx.g.lineStyle(3, VIOLET, 0.85).beginPath().arc(x, y, r * 1.35, a, a + 1.4).strokePath();
  }
  fx.soft(x, y, r * 1.5, SHADE, 0.9);
  fx.solid.fillStyle(0x05020c, 1).fillCircle(x, y, r * 0.95);
  fx.solid.lineStyle(2, pr.color, 0.9).strokeCircle(x, y, r * 0.95);
  // Motes spiralling into it.
  fx.trail(`p${pr.id}`, 0.03, () => {
    const a = Math.random() * TAU,
      d = r * 2.6;
    fx.burst({ x: x + Math.cos(a) * d, y: pr.y + Math.sin(a) * d * 0.8, z: 8, count: 1, kind: "mote", color: [VIOLET, PALE], angle: a + Math.PI - 0.5, spread: 0.1, speed: [d * 3, d * 3.5], life: [0.25, 0.32], size: [1, 1.6], drag: 0.4 });
  });
}

// ───────────── Void Orb wind-up and burst ─────────────
function voidWindup(g: G, a: Ability, x: number, y: number, angle: number, _ax: number, _ay: number, color: number, k: number, now: number) {
  const fx = fxFor(g.scene),
    cx = x + Math.cos(angle) * 30,
    cy = y - 18 + Math.sin(angle) * 30,
    r = a.radius * (0.3 + k * 0.7);
  // The real lane the orb will travel, as wide as its hit radius.
  const len = Math.min(a.range ?? 600, 420);
  g.lineStyle(a.radius * 2, SHADE, 0.08 + k * 0.1).lineBetween(x, y - 10, x + Math.cos(angle) * len, y - 10 + Math.sin(angle) * len);
  fx.soft(cx, cy, r * 2, SHADE, 0.5 + k * 0.4);
  fx.solid.fillStyle(0x05020c, 0.9).fillCircle(cx, cy, r * 0.8);
  fx.g.lineStyle(2, VIOLET, 0.6 + k * 0.4).strokeCircle(cx, cy, r * (1 + Math.sin(now / 40) * 0.05));
  fx.trail(`vw${Math.round(x)}`, 0.025, () => {
    const t = Math.random() * TAU,
      d = 70;
    fx.burst({ x: cx + Math.cos(t) * d, y: cy + 18 + Math.sin(t) * d, z: 18, count: 1, kind: "mote", color: [VIOLET, color], angle: t + Math.PI, spread: 0.05, speed: [d * 3.4, d * 3.8], life: [0.25, 0.28], size: [1, 1.6], drag: 0.3 });
  });
}
function voidBurst(scene: Phaser.Scene, a: Ability, x: number, y: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    blast = a.explosion ?? 120;
  fx.decal({ kind: "scorch", x, y, r: blast * 0.6, color: VIOLET, life: 4 });
  fx.shake(200, 0.005);
  shot(fx.reduced ? 260 : 700, (k) => {
    // Implode first (everything pulled to the centre), then burst.
    if (k < 0.3) {
      const kk = k / 0.3;
      fx.soft(x, y - 8, blast * (1 - kk * 0.7), SHADE, 0.75);
      fx.g.lineStyle(4, VIOLET, 0.9).strokeEllipse(x, y, blast * 2 * (1 - kk), blast * 2 * 0.82 * (1 - kk));
      fx.trail(`vi${Math.round(x)}`, 0.02, () => {
        const t = Math.random() * TAU;
        fx.burst({ x: x + Math.cos(t) * blast, y: y + Math.sin(t) * blast * 0.82, z: 8, count: 2, kind: "mote", color: [VIOLET, PALE], angle: t + Math.PI, spread: 0.05, speed: [blast * 3, blast * 3.4], life: [0.25, 0.3], size: [1.2, 2], drag: 0.2 });
      });
      return;
    }
    const kk = (k - 0.3) / 0.7;
    fx.trail(`vb${Math.round(x)}`, 999, () => {
      wisps(fx, x, y, 14, [120, 320]);
      fx.burst({ x, y, z: 10, count: 30, kind: "spark", color: [VIOLET, color, PALE], speed: [160, 480], up: [80, 320], life: [0.35, 0.7], size: [1.2, 2], grav: 900 });
    });
    fx.soft(x, y - 8, blast * 0.9 * (1 - kk), SHADE, 0.55 * (1 - kk));
    fx.glow(x, y - 8, blast * 1.1, color, 0.6 * (1 - kk));
    fx.glow(x, y - 8, blast * 0.4, PALE, Math.max(0, 1 - kk * 3));
    fx.shockwave(x, y, blast * ease(Math.min(1, kk * 1.6)), kk, VIOLET, 12);
    fx.shockwave(x, y, blast * 0.65 * ease(Math.min(1, kk * 2)), kk, color, 6);
  });
}

// ───────────── Casts, impacts, hits ─────────────
function shadowCast(scene: Phaser.Scene, a: Ability, x: number, y: number, angle: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    mx = x + Math.cos(angle) * 24,
    my = y - 16 + Math.sin(angle) * 24;
  wisps(fx, mx, my + 16, a.id === "ghostfire" ? 5 : 2, [20, 80]);
  shot(180, (k) => {
    fx.glow(mx, my, 30 * (1 - k * 0.4), a.id === "curse-mark" ? color : GHOST, 0.7 * (1 - k));
    fx.soft(mx, my, 18 * (1 - k), SHADE, 0.5 * (1 - k));
  });
}
function curseImpact(scene: Phaser.Scene, a: Ability, x: number, y: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    r = a.radius * 2.4;
  fx.decal({ kind: "glyph", x, y: y + 14, r, color, life: 2 });
  wisps(fx, x, y, 5);
  shot(fx.reduced ? 160 : 420, (k) => {
    const tri = (rot: number) => [0, 1, 2].map((i) => ({ x: x + Math.cos(rot + (i * TAU) / 3) * r * (1 + k * 0.3), y: y - 10 + Math.sin(rot + (i * TAU) / 3) * r * (1 + k * 0.3) }));
    fx.g.lineStyle(3, color, 1 - k).strokePoints(tri(k * 2), true).strokePoints(tri(k * 2 + Math.PI), true);
    fx.glow(x, y - 10, r * 1.4, color, 0.5 * (1 - k));
  });
}
function wispImpact(scene: Phaser.Scene, a: Ability, x: number, y: number, _color: number, shot: Shot) {
  const fx = fxFor(scene);
  ghostMotes(fx, x, y, a.id === "ghostfire" ? 8 : 5);
  wisps(fx, x, y, 3);
  shot(200, (k) => fx.glow(x, y - 6, 34 * (1 - k * 0.5), GHOST, 0.7 * (1 - k)));
}
function shadowHit(scene: Phaser.Scene, x: number, y: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    cy = y - 16;
  wisps(fx, x, y, 6, [30, 110]);
  ghostMotes(fx, x, y, 6);
  shot(fx.reduced ? 140 : 340, (k) => {
    fx.soft(x, cy, 30 * (1 - k * 0.3), SHADE, 0.45 * (1 - k));
    fx.glow(x, cy, 26 * (1 - k * 0.5), color, 0.6 * (1 - k));
  });
}

export const shadowKit: FxKit = {
  projectile: {
    "lantern-wisp": lanternWisp,
    ghostfire,
    "shade-crawl": shadeCrawl,
    "curse-mark": curseMark,
    "void-orb": voidOrb,
  },
  windup: { "void-orb": voidWindup },
  cast: {
    "lantern-wisp": shadowCast,
    ghostfire: shadowCast,
    "shade-crawl": shadowCast,
    "curse-mark": shadowCast,
  },
  impact: {
    "void-orb": voidBurst,
    "curse-mark": curseImpact,
    "lantern-wisp": wispImpact,
    ghostfire: wispImpact,
    "shade-crawl": wispImpact,
  },
  hit: { shadow: shadowHit },
};
