import type Phaser from "phaser";
import type { Ability, Projectile } from "@arena/shared";
import { fxFor, type Fx } from "./fx-engine";
import { TAU, ease, hash, type FxKit, type G, type Shot } from "./fx-kits";
/**
 * Auralynx's kit: crystal aura. Faceted prisms, rainbow refraction, glass
 * shards that tumble and bounce, hex mirrors. Sizes come from the abilities.
 */
const GLASS = 0xdff4ff;
const PINK = 0xff9be0;
const CYAN = 0x8ff6ff;
const GOLD = 0xffe58f;
const INK = 0x26285a;

function shards(fx: Fx, x: number, y: number, n: number, color: number, o: { angle?: number; spread?: number; power?: number } = {}) {
  const p = o.power ?? 1;
  fx.burst({ x, y, z: 16, count: n, kind: "debris", color: [color, GLASS, 0xb9c8ff], angle: o.angle, spread: o.spread, speed: [80 * p, 260 * p], up: [120 * p, 320 * p], life: [0.5, 0.9], size: [2.5, 4.5], grav: 1100, bounce: 0.35 });
  fx.burst({ x, y, z: 16, count: Math.ceil(n / 2), kind: "spark", color: [color, PINK, CYAN], angle: o.angle, spread: o.spread, speed: [120 * p, 380 * p], up: [40, 200], life: [0.2, 0.4], size: [1, 1.5], grav: 600 });
}
/** A faceted gem: dark rim, two-tone faces, white facet line. */
function gem(fx: Fx, x: number, y: number, r: number, color: number, rot: number) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = rot + (i * TAU) / 6;
    return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 1.25 };
  });
  fx.solid.fillStyle(INK, 0.5).fillPoints(pts.map((p) => ({ x: x + (p.x - x) * 1.12, y: y + (p.y - y) * 1.12 })), true);
  fx.solid.fillStyle(color, 1).fillPoints(pts, true);
  fx.solid.fillStyle(GLASS, 0.85).fillTriangle(x, y, pts[0].x, pts[0].y, pts[1].x, pts[1].y);
  fx.solid.fillStyle(0xb9c8ff, 0.9).fillTriangle(x, y, pts[3].x, pts[3].y, pts[4].x, pts[4].y);
  fx.solid.lineStyle(1.5, 0xffffff, 0.9).lineBetween(pts[0].x, pts[0].y, pts[3].x, pts[3].y);
}
/** Refraction: the same outline split into pink, cyan and gold. */
function prismLine(fx: Fx, x0: number, y0: number, x1: number, y1: number, width: number, alpha: number) {
  const nx = -(y1 - y0),
    ny = x1 - x0,
    l = Math.hypot(nx, ny) || 1;
  [PINK, CYAN, GOLD].forEach((c, i) => {
    const o = (i - 1) * 3;
    fx.g.lineStyle(width, c, alpha).lineBetween(x0 + (nx / l) * o, y0 + (ny / l) * o, x1 + (nx / l) * o, y1 + (ny / l) * o);
  });
}

// ───────────── Prism Jab: a focused crystal thrust ─────────────
function prismJab(scene: Phaser.Scene, a: Ability, x: number, y: number, angle: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    cy = y - 12,
    tipX = x + Math.cos(angle) * a.range,
    tipY = cy + Math.sin(angle) * a.range;
  shards(fx, tipX, tipY + 12, 6, color, { angle, spread: 0.7, power: 0.7 });
  shot(fx.reduced ? 140 : 240, (k) => {
    const reach = ease(Math.min(1, k * 3)),
      fade = 1 - Math.max(0, (k - 0.3) / 0.7),
      hx = x + Math.cos(angle) * a.range * reach,
      hy = cy + Math.sin(angle) * a.range * reach,
      nx = -Math.sin(angle) * 9,
      ny = Math.cos(angle) * 9;
    fx.solid.fillStyle(INK, 0.35 * fade).fillTriangle(x + nx * 1.3, cy + ny * 1.3, x - nx * 1.3, cy - ny * 1.3, hx, hy);
    fx.solid.fillStyle(color, 0.95 * fade).fillTriangle(x + nx, cy + ny, x - nx, cy - ny, hx, hy);
    fx.solid.fillStyle(GLASS, 0.9 * fade).fillTriangle(x + nx * 0.35, cy + ny * 0.35, x - nx * 0.35, cy - ny * 0.35, hx, hy);
    prismLine(fx, x, cy, hx, hy, 1.5, 0.6 * fade);
    fx.glow(hx, hy, 30 * fade + 6, color, 0.7 * fade);
    gem(fx, hx, hy, 7 * fade + 2, GLASS, k * 6);
  });
}

// ───────────── Prism Shot ─────────────
function prismShot(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    c = pr.color,
    a = Math.atan2(pr.vy, pr.vx),
    hover = 14,
    x = pr.x,
    y = pr.y - hover;
  fx.solid.fillStyle(0x000000, 0.18).fillEllipse(pr.x, pr.y + 4, r * 1.8, r * 0.6);
  prismLine(fx, x - Math.cos(a) * 90, y - Math.sin(a) * 90, x, y, 3, 0.45);
  fx.glow(x, y, r * 2.4, c, 0.4);
  gem(fx, x, y, r * 0.8, c, now / 90 + pr.id);
  // Light refracting off the gem onto the floor.
  fx.glow(pr.x + Math.cos(now / 200) * 10, pr.y + 4, r * 1.6, PINK, 0.25, true);
  fx.glow(pr.x - Math.cos(now / 200) * 10, pr.y + 4, r * 1.6, CYAN, 0.25, true);
  if (hash(Math.floor(now / 90) + pr.id) > 0.6) {
    const s = r * 1.6;
    fx.g.lineStyle(2, 0xffffff, 0.9).lineBetween(x - s, y - s * 0.4, x + s, y + s * 0.4).lineBetween(x - s * 0.3, y + s, x + s * 0.3, y - s);
  }
  fx.trail(`ps${pr.id}`, 0.04, () =>
    fx.burst({ x, y: pr.y, z: hover, count: 1, kind: "mote", color: [PINK, CYAN, GOLD], speed: [10, 40], up: [-10, 20], life: [0.3, 0.6], size: [1, 1.6], drag: 2 }),
  );
}
function prismImpact(scene: Phaser.Scene, _a: Ability, x: number, y: number, color: number, shot: Shot) {
  const fx = fxFor(scene);
  shards(fx, x, y, 12, color);
  shot(320, (k) => {
    fx.glow(x, y - 12, 44 * (1 - k * 0.4), color, 0.6 * (1 - k));
    fx.shockwave(x, y, 46 * ease(k), k, CYAN, 5);
  });
}

// ───────────── Shatter Palm: the air itself cracks ─────────────
function shatterPalm(scene: Phaser.Scene, a: Ability, x: number, y: number, angle: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    cy = y - 14,
    hx = x + Math.cos(angle) * a.range * 0.85,
    hy = cy + Math.sin(angle) * a.range * 0.85;
  shards(fx, hx, hy + 14, 22, color, { angle, spread: 0.9, power: 1.3 });
  fx.shake(160, 0.0045);
  const seed = Math.floor(Math.random() * 1000);
  shot(fx.reduced ? 220 : 560, (k) => {
    const fade = 1 - k,
      grow = ease(Math.min(1, k * 4));
    fx.glow(hx, hy, 70 * grow, color, 0.7 * fade);
    if (k < 0.12) fx.glow(hx, hy, 50, GLASS, 1 - k / 0.12);
    // Cracked-glass star hanging in the air: radial cracks and broken rings.
    fx.solid.lineStyle(2.5, INK, 0.4 * fade);
    fx.g.lineStyle(2, GLASS, 0.95 * fade);
    for (let i = 0; i < 9; i++) {
      const aa = (i * TAU) / 9 + hash(seed + i) * 0.4,
        len = (34 + hash(seed - i) * 30) * grow;
      const mx = hx + Math.cos(aa + 0.12) * len * 0.5,
        my = hy + Math.sin(aa + 0.12) * len * 0.5;
      for (const layer of [fx.solid, fx.g]) {
        layer.lineBetween(hx, hy, mx, my);
        layer.lineBetween(mx, my, hx + Math.cos(aa) * len, hy + Math.sin(aa) * len);
      }
    }
    for (const rr of [18, 38]) {
      fx.g.lineStyle(2, CYAN, 0.8 * fade);
      for (let i = 0; i < 9; i++) {
        const a0 = (i * TAU) / 9 + hash(seed + i) * 0.4;
        if (hash(seed + i * 3 + rr) > 0.35) fx.g.beginPath().arc(hx, hy, rr * grow, a0, a0 + 0.5).strokePath();
      }
    }
    fx.shockwave(x + Math.cos(angle) * a.range * 0.85, y + Math.sin(angle) * a.range * 0.85, a.range * 0.7 * grow, k, PINK, 7);
  });
}

// ───────────── Mirror Guard: hex mirrors snap together ─────────────
function mirrorGuard(scene: Phaser.Scene, a: Ability, x: number, y: number, angle: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    cy = y - 16;
  shot(Math.min(900, a.duration * 1000), (k) => {
    const form = ease(Math.min(1, k * 4)),
      fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1,
      sweep = (k * 3) % 1;
    for (let i = -2; i <= 2; i++) {
      const aa = angle + i * 0.42,
        d = 46 + (1 - form) * 40,
        px = x + Math.cos(aa) * d,
        py = cy + Math.sin(aa) * d * 0.85,
        s = 15;
      const hex = Array.from({ length: 6 }, (_, j) => ({ x: px + Math.cos(j * (TAU / 6)) * s, y: py + Math.sin(j * (TAU / 6)) * s }));
      fx.solid.fillStyle(color, 0.35 * fade).fillPoints(hex, true);
      fx.solid.lineStyle(3, INK, 0.3 * fade).strokePoints(hex, true);
      fx.g.lineStyle(2, GLASS, 0.95 * fade).strokePoints(hex, true);
      // A sheen sliding across the mirrors.
      if (Math.abs((i + 2) / 4 - sweep) < 0.2) fx.glow(px, py, 22, 0xffffff, 0.6 * fade);
    }
    fx.glow(x, cy, 70, color, 0.25 * fade);
  });
  shards(fx, x, y, 6, color, { power: 0.5 });
}

// ───────────── Nova Burst: crystal spikes erupt ─────────────
function novaWindup(g: G, a: Ability, x: number, y: number, _angle: number, _ax: number, _ay: number, color: number, k: number, now: number) {
  const fx = fxFor(g.scene),
    r = a.radius,
    sq = 0.82;
  fx.floorSolid.fillStyle(color, 0.08 + k * 0.12).fillEllipse(x, y, r * 2, r * 2 * sq);
  fx.floorSolid.lineStyle(2, color, 0.7).strokeEllipse(x, y, r * 2, r * 2 * sq);
  fx.floor.lineStyle(3, GLASS, 0.5 + k * 0.4).strokeEllipse(x, y, r * 2 * k, r * 2 * sq * k);
  // Crystals grow out of the rim as the charge builds.
  for (let i = 0; i < 12; i++) {
    const aa = (i * TAU) / 12 + now / 3000,
      px = x + Math.cos(aa) * r,
      py = y + Math.sin(aa) * r * sq,
      h = 6 + k * 22;
    fx.solid.fillStyle(color, 0.9).fillTriangle(px - 5, py, px + 5, py, px, py - h);
    fx.solid.fillStyle(GLASS, 0.9).fillTriangle(px - 1.5, py, px + 3, py, px, py - h * 0.85);
  }
  fx.glow(x, y - 14, 30 + k * 50, color, 0.4 + k * 0.4);
}
function novaBurst(scene: Phaser.Scene, a: Ability, x: number, y: number, _angle: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    r = a.radius,
    sq = 0.82;
  shards(fx, x, y, 34, color, { power: 1.6 });
  fx.decal({ kind: "glyph", x, y, r: r * 0.95, color, life: 3 });
  fx.shake(200, 0.005);
  shot(fx.reduced ? 220 : 620, (k) => {
    const out = ease(Math.min(1, k * 2.2)),
      fade = 1 - k;
    if (k < 0.12) fx.glow(x, y - 14, r * 0.9, GLASS, 0.8 * (1 - k / 0.12));
    fx.glow(x, y, r * 1.1, color, 0.45 * fade, true);
    // Prismatic shockwave: three colour-split rings.
    [PINK, CYAN, GOLD].forEach((c, i) => fx.shockwave(x, y, r * out * (1 - i * 0.04), k, c, 7));
    // A ring of crystal spikes punches out of the floor.
    for (let i = 0; i < 16; i++) {
      const aa = (i * TAU) / 16,
        d = r * (0.35 + out * 0.6),
        px = x + Math.cos(aa) * d,
        py = y + Math.sin(aa) * d * sq,
        h = (18 + hash(i) * 26) * Math.sin(Math.min(1, k * 1.6) * Math.PI);
      if (h <= 0) continue;
      fx.solid.fillStyle(INK, 0.35).fillTriangle(px - 8, py + 2, px + 8, py + 2, px, py - h - 2);
      fx.solid.fillStyle(color, 1).fillTriangle(px - 7, py, px + 7, py, px, py - h);
      fx.solid.fillStyle(GLASS, 0.95).fillTriangle(px - 2, py, px + 4, py, px, py - h * 0.9);
    }
  });
}

// ───────────── Hits ─────────────
function auraHit(scene: Phaser.Scene, x: number, y: number, color: number, shot: Shot) {
  const fx = fxFor(scene);
  shards(fx, x, y, 8, color, { power: 0.8 });
  shot(fx.reduced ? 140 : 300, (k) => {
    fx.glow(x, y - 18, 36 * (1 - k * 0.4), color, 0.6 * (1 - k));
    const s = 18 * (1 - k * 0.5);
    fx.g.lineStyle(2, GLASS, 1 - k).strokePoints(Array.from({ length: 6 }, (_, j) => ({ x: x + Math.cos(j * (TAU / 6)) * s, y: y - 18 + Math.sin(j * (TAU / 6)) * s })), true);
  });
}

export const auraKit: FxKit = {
  projectile: { "prism-shot": prismShot },
  windup: { "nova-burst": novaWindup },
  cast: { "prism-jab": prismJab, "shatter-palm": shatterPalm, "mirror-guard": mirrorGuard, "nova-burst": novaBurst },
  impact: { "prism-shot": prismImpact },
  hit: { aura: auraHit },
};
