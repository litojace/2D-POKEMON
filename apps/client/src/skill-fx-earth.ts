import type Phaser from "phaser";
import type { Ability, Zone } from "@arena/shared";
import { fxFor, type Fx } from "./fx-engine";
import { TAU, ease, hash, type FxKit, type G, type Shot } from "./fx-kits";
/**
 * Terradon's kit: weight. Rock chips with shadows that bounce and settle,
 * rolling dust, cracked floor, rock spikes. Sizes come from the shared
 * abilities (range, arc, radius).
 */
const SAND = 0xd9bf8f;
const DUST = 0xc4a678;
const DARK = 0x6b5640;
const ROCK = [0x8a7a66, 0x6e604f, 0xa8977d];
const LEAF = 0x9be07a;

/** Dust puffs that roll outward and settle. */
const dust = (fx: Fx, x: number, y: number, n: number, speed: [number, number], o: { angle?: number; spread?: number; size?: [number, number] } = {}) =>
  fx.burst({ x, y, z: 4, count: n, kind: "smoke", color: [SAND, DUST, 0xe6d3ad], speed, up: [10, 50], life: [0.6, 1.2], size: o.size ?? [10, 18], drag: 3, angle: o.angle, spread: o.spread });
const rocks = (fx: Fx, x: number, y: number, n: number, speed: [number, number], up: [number, number], o: { angle?: number; spread?: number; size?: [number, number] } = {}) =>
  fx.burst({ x, y, z: 6, count: n, kind: "debris", color: ROCK, speed, up, life: [0.7, 1.2], size: o.size ?? [2.5, 5], grav: 1100, drag: 1.4, bounce: 0.3, angle: o.angle, spread: o.spread });

/** A heavy arc swing: a solid sweep with a dusty trailing edge. */
function sweep(fx: Fx, x: number, y: number, a: Ability, angle: number, k: number, color: number, width: number) {
  const spread = Math.min(Math.PI * 0.95, Math.acos(a.arc ?? 0.3)),
    from = angle - spread,
    to = from + 2 * spread * Math.min(1, ease(k * 1.8)),
    r = a.range * 0.9,
    fade = 1 - k;
  const arc = (rr: number) => {
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const t = from + ((to - from) * i) / 18;
      pts.push({ x: x + Math.cos(t) * rr, y: y + Math.sin(t) * rr * 0.82 });
    }
    return pts;
  };
  // The swept area itself: a dusty wedge, so the swing has mass.
  const wedge = [{ x, y }, ...arc(r)];
  fx.solid.fillStyle(SAND, 0.22 * fade).fillPoints(wedge, true);
  fx.solid.lineStyle(width * 1.6, DARK, 0.3 * fade).strokePoints(arc(r), false);
  fx.solid.lineStyle(width, color, 0.85 * fade).strokePoints(arc(r), false);
  fx.solid.lineStyle(width * 0.35, 0xfff1d6, 0.9 * fade).strokePoints(arc(r - width * 0.2), false);
  fx.soft(x + Math.cos(to) * r, y + Math.sin(to) * r * 0.82, 26 * fade + 8, SAND, 0.6 * fade);
}

function boulderSwipe(scene: Phaser.Scene, a: Ability, x: number, y: number, angle: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    cy = y - 8;
  const hx = x + Math.cos(angle) * a.range * 0.7,
    hy = y + Math.sin(angle) * a.range * 0.6;
  rocks(fx, hx, hy, 10, [120, 300], [80, 260], { angle, spread: 0.8, size: [3.5, 6] });
  dust(fx, hx, hy, 6, [40, 140], { angle, spread: 1, size: [12, 20] });
  shot(fx.reduced ? 160 : 300, (k) => sweep(fx, x, cy, a, angle, k, color, 12));
}

function shellSlam(scene: Phaser.Scene, a: Ability, x: number, y: number, angle: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    hx = x + Math.cos(angle) * a.range * 0.55,
    hy = y + Math.sin(angle) * a.range * 0.45;
  rocks(fx, hx, hy, 18, [100, 340], [180, 420], { size: [3.5, 7] });
  dust(fx, hx, hy, 14, [120, 260], { size: [12, 22] });
  fx.decal({ kind: "crack", x: hx, y: hy, r: 60, color, life: 3 });
  fx.shake(200, 0.006);
  shot(fx.reduced ? 200 : 480, (k) => {
    sweep(fx, x, y - 8, a, angle, Math.min(1, k * 1.6), color, 16);
    // Ground ring kicked up by the impact.
    const rr = 30 + ease(k) * 90;
    fx.floorSolid.lineStyle(10 * (1 - k), DARK, 0.25 * (1 - k)).strokeEllipse(hx, hy, rr * 2, rr * 2 * 0.62);
    fx.floorSolid.lineStyle(6 * (1 - k), SAND, 0.7 * (1 - k)).strokeEllipse(hx, hy, rr * 2, rr * 2 * 0.62);
  });
}

function hibernate(scene: Phaser.Scene, a: Ability, x: number, y: number, _angle: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    ms = Math.min(2400, (a.duration ?? 2.5) * 1000);
  shot(fx.reduced ? 600 : ms, (k) => {
    const breathe = 0.5 + Math.sin(k * TAU * 2.2) * 0.5,
      fade = k > 0.85 ? (1 - k) / 0.15 : Math.min(1, k * 6);
    fx.glow(x, y, 60 + breathe * 14, LEAF, 0.35 * fade, true);
    fx.glow(x, y - 18, 40, LEAF, 0.25 * fade * breathe);
    // Sleepy "z"s drifting up and away.
    for (let i = 0; i < 3; i++) {
      const t = (k * 2.4 + i / 3) % 1,
        zx = x + 18 + i * 8 + Math.sin(t * 6 + i) * 6,
        zy = y - 44 - t * 60,
        s = 5 + t * 5,
        al = (t < 0.15 ? t / 0.15 : 1 - t) * fade;
      fx.solid.lineStyle(4, DARK, 0.35 * al).strokePoints([{ x: zx - s, y: zy - s }, { x: zx + s, y: zy - s }, { x: zx - s, y: zy + s }, { x: zx + s, y: zy + s }], false);
      fx.solid.lineStyle(2.5, 0xffffff, 0.95 * al).strokePoints([{ x: zx - s, y: zy - s }, { x: zx + s, y: zy - s }, { x: zx - s, y: zy + s }, { x: zx + s, y: zy + s }], false);
    }
    // Healing pollen rising from the ground.
    fx.trail(`hb${Math.round(x)}`, 0.07, () => {
      const ang = Math.random() * TAU;
      fx.burst({ x: x + Math.cos(ang) * 34, y: y + Math.sin(ang) * 18, count: 1, kind: "mote", color: [LEAF, 0xe9ffb8], speed: [0, 10], up: [30, 70], life: [0.7, 1.2], size: [1.2, 2], drag: 1 });
    });
  });
  void color;
}

function dustCloud(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    r = z.radius,
    x = z.x,
    y = z.y,
    fade = progress > 0.8 ? (1 - progress) / 0.2 : Math.min(1, progress / 0.08);
  fx.trail(`dc${z.id}`, 999, () => {
    dust(fx, x, y, 16, [120, 260], { size: [14, 24] });
    fx.decal({ kind: "wet", x, y, r: r * 0.95, color: DUST, life: (z.ability.duration ?? 3) + 1.5 });
  });
  g.fillStyle(DUST, 0.12 * fade).fillEllipse(x, y, r * 2, r * 2 * 0.82);
  // Billowing body: overlapping puffs slowly turning, darker at the base.
  for (let i = 0; i < 14; i++) {
    const a0 = (i * TAU) / 14 + now / 2600 + hash(z.id + i) * 0.6,
      d = r * (0.25 + hash(i * 3 + z.id) * 0.6),
      px = x + Math.cos(a0) * d,
      py = y + Math.sin(a0) * d * 0.78 - 10 - hash(i + 9) * 22,
      pr = r * (0.28 + hash(i * 7) * 0.16) * (1 + Math.sin(now / 700 + i) * 0.06);
    fx.soft(px, py + 10, pr * 1.1, DARK, 0.18 * fade, 0.7);
    fx.soft(px, py, pr, i % 2 ? SAND : DUST, 0.42 * fade, 0.8);
  }
  fx.trail(`dm${z.id}`, 0.06, () => {
    const a0 = Math.random() * TAU,
      d = Math.sqrt(Math.random()) * r;
    fx.burst({ x: x + Math.cos(a0) * d, y: y + Math.sin(a0) * d * 0.8, count: 1, kind: "mote", color: [0xf2e2bf, SAND], speed: [10, 30], up: [10, 40], life: [0.8, 1.4], size: [1, 1.8], drag: 1.5 });
  });
  fx.floorSolid.lineStyle(2, DARK, 0.3 * fade).strokeEllipse(x, y, r * 2, r * 2 * 0.82);
}

function tremorWindup(g: G, a: Ability, x: number, y: number, _angle: number, _ax: number, _ay: number, color: number, k: number, now: number) {
  const fx = fxFor(g.scene),
    r = a.radius;
  g.fillStyle(DARK, 0.06 + k * 0.1).fillEllipse(x, y, r * 2, r * 2 * 0.82);
  fx.floorSolid.lineStyle(3, DARK, 0.5).strokeEllipse(x, y, r * 2, r * 2 * 0.82);
  // Cracks spreading out to the edge of the real area.
  fx.floorSolid.lineStyle(2.5, 0x2a2016, 0.6);
  for (let i = 0; i < 9; i++) {
    const ang = (i * TAU) / 9 + hash(i) * 0.4;
    let px = x,
      py = y;
    const reach = r * k;
    for (let s = 1; s <= 4; s++) {
      const rr = (reach * s) / 4,
        j = (hash(i * 9 + s) - 0.5) * 0.5;
      const nx = x + Math.cos(ang + j) * rr,
        ny = y + Math.sin(ang + j) * rr * 0.82;
      fx.floorSolid.lineBetween(px, py, nx, ny);
      px = nx;
      py = ny;
    }
  }
  // Pebbles hop as the ground rumbles.
  fx.trail(`tw${Math.round(x)}`, 0.05, () => {
    const ang = Math.random() * TAU,
      d = Math.random() * r * k;
    rocks(fx, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.82, 1, [0, 30], [80, 160], { size: [1.5, 3] });
  });
  if (!fx.reduced && Math.floor(now / 60) % 2 === 0) g.scene.cameras.main.shake(60, 0.0012 * k, false);
  void color;
}

function tremor(scene: Phaser.Scene, a: Ability, x: number, y: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    r = a.radius;
  fx.decal({ kind: "crack", x, y, r: r * 0.95, color, life: 4.5 });
  fx.decal({ kind: "scorch", x, y, r: r * 0.35, color: DARK, life: 3.5 });
  rocks(fx, x, y, 34, [140, 520], [220, 560], { size: [3, 6] });
  dust(fx, x, y, 22, [220, 420], { size: [14, 26] });
  fx.shake(320, 0.009);
  // Rock spikes that thrust up around the ring and sink back.
  const spikes = Array.from({ length: 12 }, (_, i) => {
    const ang = (i * TAU) / 12 + hash(i * 5) * 0.3,
      d = r * (0.45 + hash(i) * 0.45);
    return { x: x + Math.cos(ang) * d, y: y + Math.sin(ang) * d * 0.82, h: 26 + hash(i * 3) * 26, w: 9 + hash(i * 7) * 6, delay: d / r * 0.25 };
  });
  shot(fx.reduced ? 300 : 900, (k) => {
    const wave = r * ease(Math.min(1, k * 1.8));
    fx.floorSolid.lineStyle(16 * (1 - k), DARK, 0.3 * (1 - k)).strokeEllipse(x, y, wave * 2, wave * 2 * 0.82);
    fx.floorSolid.lineStyle(8 * (1 - k), SAND, 0.75 * (1 - k)).strokeEllipse(x, y, wave * 2, wave * 2 * 0.82);
    for (const s of spikes) {
      const kk = Math.max(0, Math.min(1, (k - s.delay) / 0.5));
      if (kk <= 0 || kk >= 1) continue;
      const up = kk < 0.25 ? ease(kk / 0.25) : 1 - (kk - 0.25) / 0.75,
        h = s.h * up;
      fx.solid.fillStyle(0x000000, 0.22).fillEllipse(s.x, s.y + 2, s.w * 2.4, s.w);
      fx.solid.fillStyle(ROCK[1], 1).fillTriangle(s.x - s.w, s.y, s.x + s.w, s.y, s.x + s.w * 0.15, s.y - h);
      fx.solid.fillStyle(ROCK[2], 1).fillTriangle(s.x - s.w, s.y, s.x + s.w * 0.15, s.y - h, s.x - s.w * 0.1, s.y);
    }
  });
}

function earthHit(scene: Phaser.Scene, x: number, y: number, _color: number, shot: Shot) {
  const fx = fxFor(scene);
  rocks(fx, x, y, 7, [80, 220], [100, 260], { size: [2, 3.5] });
  dust(fx, x, y, 4, [30, 90], { size: [8, 14] });
  shot(fx.reduced ? 120 : 260, (k) => {
    fx.solid.lineStyle(4 * (1 - k), SAND, 0.8 * (1 - k)).strokeEllipse(x, y - 14, 20 + k * 40, 16 + k * 30);
  });
}

export const earthKit: FxKit = {
  cast: {
    "boulder-swipe": boulderSwipe,
    "shell-slam": shellSlam,
    hibernate,
    tremor: (scene, a, x, y, _angle, color, shot) => tremor(scene, a, x, y, color, shot),
  },
  zone: { "dust-cloud": dustCloud },
  windup: { tremor: tremorWindup },
  hit: { earth: earthHit },
};
