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
const dust = (
  fx: Fx,
  x: number,
  y: number,
  n: number,
  speed: [number, number],
  o: { angle?: number; spread?: number; size?: [number, number] } = {},
) =>
  fx.burst({
    x,
    y,
    z: 4,
    count: n,
    kind: "smoke",
    color: [SAND, DUST, 0xe6d3ad],
    speed,
    up: [10, 50],
    life: [0.6, 1.2],
    size: o.size ?? [10, 18],
    drag: 3,
    angle: o.angle,
    spread: o.spread,
  });
const rocks = (
  fx: Fx,
  x: number,
  y: number,
  n: number,
  speed: [number, number],
  up: [number, number],
  o: { angle?: number; spread?: number; size?: [number, number] } = {},
) =>
  fx.burst({
    x,
    y,
    z: 6,
    count: n,
    kind: "debris",
    color: ROCK,
    speed,
    up,
    life: [0.7, 1.2],
    size: o.size ?? [2.5, 5],
    grav: 1100,
    drag: 1.4,
    bounce: 0.3,
    angle: o.angle,
    spread: o.spread,
  });

/** A heavy arc swing: a solid sweep with a dusty trailing edge. */
function sweep(
  fx: Fx,
  x: number,
  y: number,
  a: Ability,
  angle: number,
  k: number,
  color: number,
  width: number,
) {
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
  fx.solid
    .lineStyle(width * 0.35, 0xfff1d6, 0.9 * fade)
    .strokePoints(arc(r - width * 0.2), false);
  fx.soft(
    x + Math.cos(to) * r,
    y + Math.sin(to) * r * 0.82,
    26 * fade + 8,
    SAND,
    0.6 * fade,
  );
}

function boulderSwipe(
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
    cy = y - 8;
  const hx = x + Math.cos(angle) * a.range * 0.7,
    hy = y + Math.sin(angle) * a.range * 0.6;
  rocks(fx, hx, hy, 10, [120, 300], [80, 260], {
    angle,
    spread: 0.8,
    size: [3.5, 6],
  });
  dust(fx, hx, hy, 6, [40, 140], { angle, spread: 1, size: [12, 20] });
  shot(fx.reduced ? 160 : 300, (k) => {
    // The strike stays on the caster while it moves.
    const { x, y } = at?.() ?? origin,
      cy = y - 8;
    sweep(fx, x, cy, a, angle, k, color, 12);
  });
}

function shellSlam(
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
    hx = x + Math.cos(angle) * a.range * 0.55,
    hy = y + Math.sin(angle) * a.range * 0.45;
  rocks(fx, hx, hy, 18, [100, 340], [180, 420], { size: [3.5, 7] });
  dust(fx, hx, hy, 14, [120, 260], { size: [12, 22] });
  fx.decal({ kind: "crack", x: hx, y: hy, r: 60, color, life: 3 });
  fx.shake(200, 0.006);
  shot(fx.reduced ? 200 : 480, (k) => {
    // The strike stays on the caster while it moves.
    const { x, y } = at?.() ?? origin;
    sweep(fx, x, y - 8, a, angle, Math.min(1, k * 1.6), color, 16);
    // Ground ring kicked up by the impact.
    const rr = 30 + ease(k) * 90;
    fx.floorSolid
      .lineStyle(10 * (1 - k), DARK, 0.25 * (1 - k))
      .strokeEllipse(hx, hy, rr * 2, rr * 2 * 0.62);
    fx.floorSolid
      .lineStyle(6 * (1 - k), SAND, 0.7 * (1 - k))
      .strokeEllipse(hx, hy, rr * 2, rr * 2 * 0.62);
  });
}

/**
 * Shell Up: Terradon pulls into its shell (the rig hides everything else).
 * A hard, mossy shimmer of shell plates closes over it, and green motes rise
 * on each heal tick.
 */
function shellUp(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  _angle: number,
  _color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    ms = Math.min(2600, (a.duration ?? 2.5) * 1000),
    cy = y - 22;
  rocks(fx, x, y, 5, [40, 120], [60, 160], { size: [2, 3] });
  shot(fx.reduced ? 600 : ms, (k) => {
    const close = Math.min(1, k / 0.12),
      fade = k > 0.9 ? (1 - k) / 0.1 : 1,
      r = 46 - 8 * close;
    // Plates of the shell's guard, slowly turning.
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + k * 0.8,
        hx = x + Math.cos(ang) * r * 0.75,
        hy = cy + Math.sin(ang) * r * 0.55;
      const hex = Array.from({ length: 6 }, (_, j) => ({
        x: hx + Math.cos((j / 6) * Math.PI * 2) * 11,
        y: hy + Math.sin((j / 6) * Math.PI * 2) * 9,
      }));
      fx.solid
        .lineStyle(2.5, SAND, 0.55 * fade * close)
        .strokePoints(hex, true);
    }
    fx.solid
      .lineStyle(4, DARK, 0.3 * fade)
      .strokeEllipse(x, cy, r * 2, r * 1.6);
    fx.solid
      .lineStyle(2, LEAF, 0.7 * fade)
      .strokeEllipse(x, cy, r * 2, r * 1.6);
    fx.glow(x, cy, 58, LEAF, 0.22 * fade);
  });
  // Regrowth: a little green rise on each heal tick (every half second).
  const ticks = Math.round((a.duration ?? 2.5) / 0.5);
  for (let i = 0; i < ticks; i++)
    scene.time.delayedCall(400 + i * 500, () =>
      fx.burst({
        x,
        y: cy,
        z: 10,
        count: 4,
        kind: "mote",
        color: [LEAF, 0xd8ffb8],
        speed: [8, 30],
        up: [50, 100],
        life: [0.6, 1],
        size: [1.5, 2.4],
        drag: 2,
      }),
    );
}
function dustCloud(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    r = z.radius,
    x = z.x,
    y = z.y,
    fade = progress > 0.8 ? (1 - progress) / 0.2 : Math.min(1, progress / 0.08);
  fx.trail(`dc${z.id}`, 999, () => {
    dust(fx, x, y, 16, [120, 260], { size: [14, 24] });
    fx.decal({
      kind: "wet",
      x,
      y,
      r: r * 0.95,
      color: DUST,
      life: (z.ability.duration ?? 3) + 1.5,
    });
  });
  g.fillStyle(DUST, 0.12 * fade).fillEllipse(x, y, r * 2, r * 2 * 0.82);
  // Billowing body: overlapping puffs slowly turning, darker at the base.
  for (let i = 0; i < 14; i++) {
    const a0 = (i * TAU) / 14 + now / 2600 + hash(z.id + i) * 0.6,
      d = r * (0.25 + hash(i * 3 + z.id) * 0.6),
      px = x + Math.cos(a0) * d,
      py = y + Math.sin(a0) * d * 0.78 - 10 - hash(i + 9) * 22,
      pr =
        r * (0.28 + hash(i * 7) * 0.16) * (1 + Math.sin(now / 700 + i) * 0.06);
    fx.soft(px, py + 10, pr * 1.1, DARK, 0.18 * fade, 0.7);
    fx.soft(px, py, pr, i % 2 ? SAND : DUST, 0.42 * fade, 0.8);
  }
  fx.trail(`dm${z.id}`, 0.06, () => {
    const a0 = Math.random() * TAU,
      d = Math.sqrt(Math.random()) * r;
    fx.burst({
      x: x + Math.cos(a0) * d,
      y: y + Math.sin(a0) * d * 0.8,
      count: 1,
      kind: "mote",
      color: [0xf2e2bf, SAND],
      speed: [10, 30],
      up: [10, 40],
      life: [0.8, 1.4],
      size: [1, 1.8],
      drag: 1.5,
    });
  });
  fx.floorSolid
    .lineStyle(2, DARK, 0.3 * fade)
    .strokeEllipse(x, y, r * 2, r * 2 * 0.82);
}

function tremorWindup(
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
  g.fillStyle(DARK, 0.06 + k * 0.1).fillEllipse(x, y, r * 2, r * 2 * 0.82);
  fx.floorSolid
    .lineStyle(3, DARK, 0.5)
    .strokeEllipse(x, y, r * 2, r * 2 * 0.82);
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
    rocks(
      fx,
      x + Math.cos(ang) * d,
      y + Math.sin(ang) * d * 0.82,
      1,
      [0, 30],
      [80, 160],
      { size: [1.5, 3] },
    );
  });
  if (!fx.reduced && Math.floor(now / 60) % 2 === 0)
    g.scene.cameras.main.shake(60, 0.0012 * k, false);
  void color;
}

function tremor(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
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
    return {
      x: x + Math.cos(ang) * d,
      y: y + Math.sin(ang) * d * 0.82,
      h: 26 + hash(i * 3) * 26,
      w: 9 + hash(i * 7) * 6,
      delay: (d / r) * 0.25,
    };
  });
  shot(fx.reduced ? 300 : 900, (k) => {
    const wave = r * ease(Math.min(1, k * 1.8));
    fx.floorSolid
      .lineStyle(16 * (1 - k), DARK, 0.3 * (1 - k))
      .strokeEllipse(x, y, wave * 2, wave * 2 * 0.82);
    fx.floorSolid
      .lineStyle(8 * (1 - k), SAND, 0.75 * (1 - k))
      .strokeEllipse(x, y, wave * 2, wave * 2 * 0.82);
    for (const s of spikes) {
      const kk = Math.max(0, Math.min(1, (k - s.delay) / 0.5));
      if (kk <= 0 || kk >= 1) continue;
      const up = kk < 0.25 ? ease(kk / 0.25) : 1 - (kk - 0.25) / 0.75,
        h = s.h * up;
      fx.solid
        .fillStyle(0x000000, 0.22)
        .fillEllipse(s.x, s.y + 2, s.w * 2.4, s.w);
      fx.solid
        .fillStyle(ROCK[1], 1)
        .fillTriangle(
          s.x - s.w,
          s.y,
          s.x + s.w,
          s.y,
          s.x + s.w * 0.15,
          s.y - h,
        );
      fx.solid
        .fillStyle(ROCK[2], 1)
        .fillTriangle(
          s.x - s.w,
          s.y,
          s.x + s.w * 0.15,
          s.y - h,
          s.x - s.w * 0.1,
          s.y,
        );
    }
  });
}

function earthHit(
  scene: Phaser.Scene,
  x: number,
  y: number,
  _color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  rocks(fx, x, y, 7, [80, 220], [100, 260], { size: [2, 3.5] });
  dust(fx, x, y, 4, [30, 90], { size: [8, 14] });
  shot(fx.reduced ? 120 : 260, (k) => {
    fx.solid
      .lineStyle(4 * (1 - k), SAND, 0.8 * (1 - k))
      .strokeEllipse(x, y - 14, 20 + k * 40, 16 + k * 30);
  });
}

// ═════════════ Wombolder: burrowing charges and a boulder-hard rump ═════════════
const PLATE = 0x8d8478;
const PLATE_LIGHT = 0xb9b0a2;
const SOIL = 0x5a4330;
const SQ = 0.82;

/** A wide shove: the rump plate's imprint and pressure lines over the arc. */
function rumpBump(
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
    cy = y - 10,
    spread = Math.min(Math.PI * 0.95, Math.acos(a.arc ?? 0.15)),
    hx = x + Math.cos(angle) * a.range * 0.6,
    hy = y + Math.sin(angle) * a.range * 0.5;
  dust(fx, hx, hy, 8, [80, 200], {
    angle,
    spread: spread * 0.8,
    size: [10, 18],
  });
  rocks(fx, hx, hy, 5, [100, 240], [60, 180], { angle, spread: spread * 0.7 });
  shot(fx.reduced ? 160 : 340, (k) => {
    // The strike stays on the caster while it moves.
    const { x, y } = at?.() ?? origin,
      cy = y - 10;
    sweep(fx, x, cy, a, angle, Math.min(1, k * 1.4), color, 10);
    // Shove waves rolling out across the arc to its range.
    for (let i = 0; i < 3; i++) {
      const kk = Math.max(0, Math.min(1, k * 1.6 - i * 0.2));
      if (kk <= 0 || kk >= 1) continue;
      const rr = a.range * (0.35 + 0.6 * ease(kk)),
        pts = Array.from({ length: 13 }, (_, j) => {
          const t = angle - spread * 0.85 + (spread * 1.7 * j) / 12;
          return { x: x + Math.cos(t) * rr, y: cy + Math.sin(t) * rr * SQ };
        });
      fx.solid.lineStyle(6, DARK, 0.25 * (1 - kk)).strokePoints(pts, false);
      fx.solid
        .lineStyle(3, PLATE_LIGHT, 0.85 * (1 - kk))
        .strokePoints(pts, false);
    }
  });
}

// ───────────── Rushes (Burrow Rush, Landslide) ─────────────
/**
 * Charges in flight, so the contact (playImpact) can stop the trail where
 * the fighter actually stopped. Cosmetic bookkeeping only.
 */
interface Charge {
  scene: Phaser.Scene;
  id: string;
  x: number;
  y: number;
  angle: number;
  stop: number;
  born: number;
}
const charges: Charge[] = [];
function stopCharge(scene: Phaser.Scene, a: Ability, x: number, y: number) {
  const now = Date.now();
  for (let i = charges.length - 1; i >= 0; i--) {
    const c = charges[i];
    if (now - c.born > 4000) {
      charges.splice(i, 1);
      continue;
    }
    if (c.scene !== scene || c.id !== a.id) continue;
    const dx = x - c.x,
      dy = y - c.y,
      along = dx * Math.cos(c.angle) + dy * Math.sin(c.angle),
      across = Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle));
    if (across < 120 && along > -40 && along < (a.range || 0) + 80)
      c.stop = Math.max(0, Math.min(c.stop, along - 34));
  }
}
/**
 * The charge: Wombolder digs in and tears across the floor at the rush's
 * speed for its range, leaving a ploughed furrow with dirt thrown up at the
 * front. `big` (Landslide) also heaves rock spikes up along the furrow.
 */
function burrowCharge(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
  big: boolean,
) {
  const fx = fxFor(scene),
    range = a.range || 300,
    speed = Math.max(1, a.speed || 1000),
    travel = (range / speed) * 1000,
    fadeMs = big ? 900 : 650,
    ms = travel + fadeMs,
    cos = Math.cos(angle),
    sin = Math.sin(angle),
    w = big ? 30 : 22,
    charge: Charge = {
      scene,
      id: a.id,
      x,
      y,
      angle,
      stop: range,
      born: Date.now(),
    };
  charges.push(charge);
  if (charges.length > 16) charges.shift();
  // Digging in: dirt thrown back behind the start.
  rocks(fx, x, y, big ? 14 : 8, [120, 280], [120, 280], {
    angle: angle + Math.PI,
    spread: 0.7,
  });
  dust(fx, x, y, big ? 12 : 7, [60, 180], {
    angle: angle + Math.PI,
    spread: 0.9,
  });
  if (big) {
    fx.ultimate(color, 800);
    fx.shake(220, 0.006);
  }
  const spikes = big
    ? Array.from({ length: Math.max(4, Math.round(range / 70)) }, (_, i) => ({
        d: (i + 0.6) * 70,
        side: i % 2 ? 1 : -1,
        h: 22 + hash(i * 5) * 20,
        w: 8 + hash(i * 3) * 5,
      }))
    : [];
  let emitted = 0;
  shot(fx.reduced ? Math.min(ms, 500) : ms, (k) => {
    const t = k * (fx.reduced ? Math.min(ms, 500) : ms),
      head = Math.min(charge.stop, range, (t / travel) * range),
      after = Math.max(0, t - travel) / fadeMs,
      moving = head < Math.min(charge.stop, range) && t < travel,
      fade = 1 - Math.min(1, after),
      hx = x + cos * head,
      hy = y + sin * head;
    if (fade <= 0) return;
    // The furrow: dark soil with ploughed ridges either side.
    const nx = -sin * w * 0.5,
      ny = cos * w * 0.5 * SQ;
    // Narrow where it dug in, full width at the front, rounded ends.
    const furrow = (scale: number) => {
      const left: { x: number; y: number }[] = [],
        right: { x: number; y: number }[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8,
          d = head * t,
          ww = scale * (0.45 + 0.55 * t);
        left.push({ x: x + cos * d + nx * ww, y: y + sin * d + ny * ww });
        right.push({ x: x + cos * d - nx * ww, y: y + sin * d - ny * ww });
      }
      const cap = Array.from({ length: 7 }, (_, i) => {
        const t = angle + Math.PI / 2 - (i / 6) * Math.PI;
        return {
          x: hx + Math.cos(t) * w * 0.5 * scale,
          y: hy + Math.sin(t) * w * 0.5 * scale * SQ,
        };
      });
      return [...left, ...cap, ...right.reverse()];
    };
    if (head > 2) {
      fx.floorSolid.fillStyle(DARK, 0.22 * fade).fillPoints(furrow(1.5), true);
      fx.floorSolid.fillStyle(SOIL, 0.55 * fade).fillPoints(furrow(1), true);
      fx.floorSolid
        .lineStyle(3, SAND, 0.6 * fade)
        .strokePoints(furrow(1.15), true);
    }
    // Clods of the ridge along the way.
    for (let d = 16; d < head; d += 26) {
      const j = hash(d + a.id.length),
        side = j > 0.5 ? 1 : -1,
        px = x + cos * d + nx * side * 1.1,
        py = y + sin * d + ny * side * 1.1;
      fx.floorSolid
        .fillStyle(ROCK[((d / 26) % 3) | 0], 0.85 * fade)
        .fillEllipse(px, py, 7 + j * 6, 4 + j * 3);
    }
    for (const s of spikes) {
      if (s.d > head) continue;
      // Each spike heaves up as the front passes, then sinks back.
      const age = (t - (s.d / range) * travel) / 1000,
        up =
          age < 0.08
            ? ease(age / 0.08)
            : Math.max(0, Math.min(1, 1 - (age - 0.3) / 0.5)),
        h = s.h * up;
      if (h <= 1) continue;
      const px = x + cos * s.d + nx * s.side * 1.6,
        py = y + sin * s.d + ny * s.side * 1.6;
      fx.solid.fillStyle(0x000000, 0.2).fillEllipse(px, py + 2, s.w * 2.4, s.w);
      fx.solid
        .fillStyle(ROCK[1], 1)
        .fillTriangle(px - s.w, py, px + s.w, py, px + s.w * 0.15, py - h);
      fx.solid
        .fillStyle(ROCK[2], 1)
        .fillTriangle(
          px - s.w,
          py,
          px + s.w * 0.15,
          py - h,
          px - s.w * 0.1,
          py,
        );
    }
    if (moving) {
      // The burrowing front: a heaving mound and a plume of dirt.
      fx.solid.fillStyle(DARK, 0.5).fillEllipse(hx, hy + 2, w * 2.2, w * 1.1);
      fx.solid.fillStyle(SAND, 0.9).fillEllipse(hx, hy - 3, w * 1.8, w * 0.9);
      fx.soft(hx, hy - 10, w * 1.6, DUST, 0.45);
      fx.trail(`br${charge.born}`, 0.03, () => {
        emitted++;
        rocks(fx, hx, hy, big ? 3 : 2, [40, 160], [120, 280], {
          angle: angle + Math.PI,
          spread: 1.2,
          size: [2, 4],
        });
        if (emitted % 2) dust(fx, hx, hy, 1, [20, 60], { size: [10, 16] });
      });
    }
  });
}
/** Contact: rocks and dust burst off the target, a thud ring rolls out. */
function rushContact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  stopCharge(scene, a, x, y);
  const fx = fxFor(scene),
    r = 60;
  rocks(fx, x, y, 14, [120, 320], [140, 360], { size: [3, 6] });
  dust(fx, x, y, 10, [100, 220], { size: [12, 20] });
  fx.decal({ kind: "crack", x, y, r: 44, color, life: 2.6 });
  fx.shake(150, 0.005);
  shot(fx.reduced ? 160 : 380, (k) => {
    const rr = 18 + ease(k) * r;
    fx.floorSolid
      .lineStyle(10 * (1 - k), DARK, 0.3 * (1 - k))
      .strokeEllipse(x, y, rr * 2, rr * 2 * SQ);
    fx.floorSolid
      .lineStyle(5 * (1 - k), SAND, 0.8 * (1 - k))
      .strokeEllipse(x, y, rr * 2, rr * 2 * SQ);
    // Impact star where the rump connects.
    for (let i = 0; i < 8; i++) {
      const aa = (i * TAU) / 8 + 0.2,
        l = (i % 2 ? 22 : 34) * (1 - k * 0.5);
      fx.solid
        .lineStyle(4 * (1 - k), PLATE_LIGHT, 0.9 * (1 - k))
        .lineBetween(
          x + Math.cos(aa) * 10,
          y - 18 + Math.sin(aa) * 10,
          x + Math.cos(aa) * l,
          y - 18 + Math.sin(aa) * l,
        );
    }
    fx.glow(x, y - 18, 30 * (1 - k), SAND, 0.6 * (1 - k));
  });
}

// ───────────── Landslide ─────────────
/**
 * Wind-up: Wombolder paws the ground and the lane it will plough (the
 * rush's range, toward the aim) cracks and rumbles.
 */
function landslideWindup(
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
    len = a.range * Math.min(1, 0.25 + k),
    cos = Math.cos(angle),
    sin = Math.sin(angle),
    w = 30;
  g.lineStyle(w * 2, DARK, 0.08 + k * 0.1).lineBetween(
    x,
    y,
    x + cos * a.range,
    y + sin * a.range,
  );
  fx.floorSolid
    .lineStyle(2, DARK, 0.45)
    .lineBetween(
      x - sin * w,
      y + cos * w * SQ,
      x + cos * a.range - sin * w,
      y + sin * a.range + cos * w * SQ,
    )
    .lineBetween(
      x + sin * w,
      y - cos * w * SQ,
      x + cos * a.range + sin * w,
      y + sin * a.range - cos * w * SQ,
    );
  // A crack running down the middle of the lane.
  fx.floorSolid.lineStyle(2.5, 0x2a2016, 0.6);
  let px = x,
    py = y;
  for (let d = 24; d <= len; d += 24) {
    const j = (hash(d) - 0.5) * 16,
      qx = x + cos * d - sin * j,
      qy = y + sin * d + cos * j * SQ;
    fx.floorSolid.lineBetween(px, py, qx, qy);
    px = qx;
    py = qy;
  }
  fx.trail(`lw${Math.round(x)}`, 0.05, () => {
    const d = Math.random() * len;
    rocks(fx, x + cos * d, y + sin * d, 1, [0, 30], [80, 160], {
      size: [1.5, 3],
    });
  });
  // Chevrons running down the lane: the way the charge will go.
  for (let i = 0; i < 5; i++) {
    const d = (((now / 900 + i / 5) % 1) * 0.9 + 0.08) * a.range,
      cx = x + cos * d,
      cy = y + sin * d,
      s = 14,
      al = 0.25 + 0.45 * k;
    fx.floorSolid
      .lineStyle(5, DARK, al)
      .beginPath()
      .moveTo(cx - cos * s - sin * s, cy - sin * s + cos * s * SQ)
      .lineTo(cx, cy)
      .lineTo(cx - cos * s + sin * s, cy - sin * s - cos * s * SQ)
      .strokePath();
  }
  // Dirt kicked back by the pawing feet.
  fx.trail(`lk${Math.round(x)}`, 0.09, () =>
    dust(fx, x - cos * 14, y - sin * 14, 1, [40, 110], {
      angle: angle + Math.PI,
      spread: 0.6,
      size: [8, 13],
    }),
  );
  fx.glow(x, y, 40 + k * 30, color, 0.2 + k * 0.25, true);
  if (!fx.reduced && Math.floor(now / 60) % 2 === 0)
    g.scene.cameras.main.shake(60, 0.001 * k, false);
}
/** The eruption at contact: the ground heaves up around the target, out to the real explosion radius. */
function landslideEruption(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  stopCharge(scene, a, x, y);
  const fx = fxFor(scene),
    r = a.explosion ?? 130;
  fx.decal({ kind: "crack", x, y, r: r * 0.95, color, life: 4.5 });
  fx.decal({ kind: "scorch", x, y, r: r * 0.35, color: DARK, life: 3.5 });
  rocks(fx, x, y, 30, [r * 1.2, r * 3.6], [240, 560], { size: [3, 6.5] });
  dust(fx, x, y, 20, [r * 1.6, r * 3], { size: [14, 26] });
  fx.shake(300, 0.009);
  const spikes = Array.from({ length: 14 }, (_, i) => {
    const ang = (i * TAU) / 14 + hash(i * 5 + 2) * 0.3,
      d = r * (0.35 + hash(i + 4) * 0.6);
    return {
      x: x + Math.cos(ang) * d,
      y: y + Math.sin(ang) * d * SQ,
      h: 30 + hash(i * 3 + 1) * 30,
      w: 10 + hash(i * 7 + 1) * 7,
      delay: (d / r) * 0.22,
    };
  });
  shot(fx.reduced ? 300 : 900, (k) => {
    const wave = r * ease(Math.min(1, k * 1.8));
    fx.floorSolid
      .fillStyle(SOIL, 0.25 * (1 - k))
      .fillEllipse(x, y, wave * 2, wave * 2 * SQ);
    fx.floorSolid
      .lineStyle(18 * (1 - k), DARK, 0.3 * (1 - k))
      .strokeEllipse(x, y, wave * 2, wave * 2 * SQ);
    fx.floorSolid
      .lineStyle(9 * (1 - k), SAND, 0.8 * (1 - k))
      .strokeEllipse(x, y, wave * 2, wave * 2 * SQ);
    for (const s of [...spikes].sort((p, q) => p.y - q.y)) {
      const kk = Math.max(0, Math.min(1, (k - s.delay) / 0.55));
      if (kk <= 0 || kk >= 1) continue;
      const up = kk < 0.2 ? ease(kk / 0.2) : 1 - (kk - 0.2) / 0.8,
        h = s.h * up;
      fx.solid
        .fillStyle(0x000000, 0.22)
        .fillEllipse(s.x, s.y + 2, s.w * 2.4, s.w);
      fx.solid
        .fillStyle(ROCK[1], 1)
        .fillTriangle(
          s.x - s.w,
          s.y,
          s.x + s.w,
          s.y,
          s.x + s.w * 0.15,
          s.y - h,
        );
      fx.solid
        .fillStyle(ROCK[2], 1)
        .fillTriangle(
          s.x - s.w,
          s.y,
          s.x + s.w * 0.15,
          s.y - h,
          s.x - s.w * 0.1,
          s.y,
        );
    }
    fx.soft(x, y - 20, r * 0.7 * (1 - k * 0.5), DUST, 0.5 * (1 - k));
    if (k < 0.12) fx.glow(x, y - 16, r * 0.5, 0xfff1d6, 0.7 * (1 - k / 0.12));
  });
}

// ───────────── Pebble Spray ─────────────
function pebble(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    hop = Math.abs(Math.sin(now / 90 + pr.id * 1.7)) * 10,
    x = pr.x,
    y = pr.y - 8 - hop,
    spin = now / 60 + pr.id;
  fx.solid
    .fillStyle(0x000000, 0.22)
    .fillEllipse(pr.x, pr.y + 6, r * 1.8 * (1 - hop / 40), r * 0.7);
  const stone = (s: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = spin + (i * TAU) / 6,
        d = r * s * (0.8 + hash(pr.id * 6 + i) * 0.35);
      return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.85 };
    });
  fx.solid.fillStyle(DARK, 1).fillPoints(stone(1.12), true);
  fx.solid.fillStyle(ROCK[pr.id % 3], 1).fillPoints(stone(0.95), true);
  fx.solid
    .fillStyle(0xd8ccb6, 0.9)
    .fillEllipse(x - r * 0.25, y - r * 0.3, r * 0.6, r * 0.35);
  fx.trail(`pb${pr.id}`, 0.06, () =>
    dust(fx, pr.x, pr.y, 1, [5, 20], { size: [5, 9] }),
  );
}
function pebbleImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  _color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = a.radius;
  rocks(fx, x, y, 5, [60, 180], [80, 220], { size: [1.8, 3.2] });
  dust(fx, x, y, 2, [20, 60], { size: [7, 11] });
  shot(fx.reduced ? 100 : 220, (k) =>
    fx.solid
      .lineStyle(3 * (1 - k), SAND, 0.8 * (1 - k))
      .strokeEllipse(x, y - 6, r * 2 + k * 30, r * 1.6 + k * 24),
  );
}
/** Kicked back: dirt sprays out of the dig in the aim's direction. */
function pebbleKick(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  _color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    spread = ((a.count ?? 5) - 1) * 0.11 * 0.5 + 0.15;
  dust(fx, x + Math.cos(angle) * 20, y + Math.sin(angle) * 20, 6, [80, 220], {
    angle,
    spread,
    size: [9, 15],
  });
  rocks(fx, x, y, 5, [160, 320], [60, 160], { angle, spread, size: [1.5, 3] });
  shot(fx.reduced ? 120 : 240, (k) => {
    fx.floorSolid
      .fillStyle(SOIL, 0.4 * (1 - k))
      .fillEllipse(x - Math.cos(angle) * 6, y + 6, 34, 14);
    fx.floor
      .fillStyle(SAND, 0.18 * (1 - k))
      .slice(
        x,
        y,
        (a.range || 300) * 0.35 * ease(k),
        angle - spread,
        angle + spread,
      );
    fx.floor.fillPath();
  });
}

// ───────────── Rump Block ─────────────
/**
 * Wombolder turns its armoured rump: a slab of riveted boulder plate stands
 * around it for the block's duration, with a bright edge that flickers like
 * it is ready to bounce hits back.
 */
function rumpBlock(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    ms = Math.min(2400, (a.duration || 1.6) * 1000),
    cy = y - 22,
    R = 56;
  rocks(fx, x, y, 6, [40, 140], [80, 180], { size: [2, 3.5] });
  dust(fx, x, y, 8, [60, 140], { size: [10, 16] });
  fx.shake(90, 0.003);
  shot(fx.reduced ? 500 : ms, (k) => {
    const close = ease(Math.min(1, k / 0.1)),
      fade = k > 0.88 ? (1 - k) / 0.12 : 1,
      r = R * (1.3 - 0.3 * close);
    // Ground ring where it braced its feet.
    fx.floorSolid
      .lineStyle(5, DARK, 0.35 * fade)
      .strokeEllipse(x, y, r * 2.1, r * 2.1 * 0.5);
    // Boulder plates in an overlapping ring, the back ones darker.
    const plates = 8;
    for (let pass = 0; pass < 2; pass++)
      for (let i = 0; i < plates; i++) {
        const ang = (i * TAU) / plates + angle + Math.PI / plates,
          front = Math.sin(ang) > 0;
        if (front !== (pass === 1)) continue;
        const px = x + Math.cos(ang) * r * 0.85,
          py = cy + Math.sin(ang) * r * 0.55,
          pw = 19,
          ph = 26,
          // The back row stays see-through so the fighter shows.
          see = front ? 1 : 0.4;
        fx.solid
          .fillStyle(DARK, 0.55 * fade * close * see)
          .fillRoundedRect(
            px - pw / 2 - 1.5,
            py - ph / 2 - 1.5,
            pw + 3,
            ph + 3,
            5,
          );
        fx.solid
          .fillStyle(front ? PLATE : 0x6e665c, 0.85 * fade * close * see)
          .fillRoundedRect(px - pw / 2, py - ph / 2, pw, ph, 4);
        fx.solid
          .fillStyle(PLATE_LIGHT, 0.8 * fade * close * see)
          .fillRect(px - pw / 2 + 3, py - ph / 2 + 3, pw - 6, 3)
          .fillCircle(px, py + 4, 1.8);
      }
    // The ready edge: a hard light that pulses (the 30% bounce).
    const pulse = 0.55 + 0.45 * Math.sin(k * ms * 0.02);
    fx.g
      .lineStyle(2.5, color, 0.7 * fade * pulse)
      .strokeEllipse(x, cy, r * 2.05, r * 1.25);
    fx.g
      .lineStyle(1.2, 0xfff1d6, 0.8 * fade * pulse)
      .strokeEllipse(x, cy, r * 2.05, r * 1.25);
    if (k < 0.12) fx.glow(x, cy, r * 1.2, SAND, 0.6 * (1 - k / 0.12));
  });
}

export const earthKit: FxKit = {
  projectile: { "pebble-spray": pebble },
  cast: {
    "rump-bump": rumpBump,
    "burrow-rush": (scene, a, x, y, angle, color, shot) =>
      burrowCharge(scene, a, x, y, angle, color, shot, false),
    "pebble-spray": pebbleKick,
    "rump-block": rumpBlock,
    landslide: (scene, a, x, y, angle, color, shot) =>
      burrowCharge(scene, a, x, y, angle, color, shot, true),
    "boulder-swipe": boulderSwipe,
    "shell-bash": shellSlam,
    "shell-up": shellUp,
    tremor: (scene, a, x, y, _angle, color, shot) =>
      tremor(scene, a, x, y, color, shot),
  },
  zone: { "mud-mire": dustCloud },
  windup: { tremor: tremorWindup, landslide: landslideWindup },
  impact: {
    "burrow-rush": rushContact,
    landslide: landslideEruption,
    "pebble-spray": pebbleImpact,
  },
  hit: { earth: earthHit },
};
