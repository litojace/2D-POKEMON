import type Phaser from "phaser";
import type { Ability, Projectile, Zone } from "@arena/shared";
import { fxFor, type Fx } from "./fx-engine";
import { TAU, ease, hash, type FxKit, type G, type Shot } from "./fx-kits";
/**
 * Mystowl's kit: telekinesis. Space bends: rings split into cyan and pink
 * edges like light through a lens, motes hang weightless, glyphs burn into
 * the floor. Sizes come from the shared abilities (radius, range).
 */
const PINK = 0xff9de2;
const CYAN = 0x9ff3ff;
const INK = 0x2a1446;
const WHITE = 0xffffff;

/** A ring with a chromatic split: cyan inside, pink outside, white heart. */
function lensRing(fx: Fx, x: number, y: number, r: number, color: number, alpha: number, width = 4, squash = 0.82, onFloor = false) {
  if (r <= 1 || alpha <= 0) return;
  const g = onFloor ? fx.floor : fx.g;
  (onFloor ? fx.floorSolid : fx.solid).lineStyle(width * 1.6, INK, 0.28 * alpha).strokeEllipse(x, y, r * 2, r * 2 * squash);
  g.lineStyle(width, CYAN, 0.5 * alpha).strokeEllipse(x, y, (r - 2) * 2, (r - 2) * 2 * squash);
  g.lineStyle(width, PINK, 0.5 * alpha).strokeEllipse(x, y, (r + 2) * 2, (r + 2) * 2 * squash);
  g.lineStyle(Math.max(1, width * 0.45), color, 0.9 * alpha).strokeEllipse(x, y, r * 2, r * 2 * squash);
}
/** Runic circle: two rings and spokes, slowly turning. */
function glyph(fx: Fx, x: number, y: number, r: number, color: number, alpha: number, spin: number, onFloor = true) {
  const g = onFloor ? fx.floor : fx.g,
    sq = 0.78;
  g.lineStyle(2, color, 0.7 * alpha).strokeEllipse(x, y, r * 2, r * 2 * sq);
  g.lineStyle(1.5, color, 0.45 * alpha).strokeEllipse(x, y, r * 1.6, r * 1.6 * sq);
  for (let i = 0; i < 6; i++) {
    const a = spin + (i * TAU) / 6;
    const px = x + Math.cos(a) * r * 0.9,
      py = y + Math.sin(a) * r * 0.9 * sq;
    g.lineStyle(1.5, color, 0.6 * alpha).lineBetween(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8 * sq, px, py);
    g.fillStyle(WHITE, 0.8 * alpha).fillCircle(px, py, 2);
  }
  // Triangle sigil inside.
  const tri = (rot: number) =>
    [0, 1, 2].map((i) => ({ x: x + Math.cos(rot + (i * TAU) / 3) * r * 0.62, y: y + Math.sin(rot + (i * TAU) / 3) * r * 0.62 * sq }));
  g.lineStyle(1.5, color, 0.55 * alpha).strokePoints(tri(-spin), true);
  g.strokePoints(tri(-spin + Math.PI), true);
}
const floatMotes = (fx: Fx, x: number, y: number, n: number, color: number, spread = 30) =>
  fx.burst({ x, y, z: 10, count: n, kind: "mote", color: [color, PINK, CYAN], speed: [10, spread], up: [20, 70], life: [0.6, 1.2], size: [1, 2], drag: 2.5 });

// ───────────── Mind Dart ─────────────
function mindDart(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    c = pr.color,
    r = pr.ability.radius,
    dir = Math.atan2(pr.vy, pr.vx),
    x = pr.x,
    y = pr.y,
    cos = Math.cos(dir),
    sin = Math.sin(dir);
  // Thought ripples left behind, each expanding as it ages.
  for (let i = 0; i < 3; i++) {
    const k = ((now / 260 + i / 3) % 1),
      d = 10 + k * 46;
    const rx = x - cos * d,
      ry = y - sin * d;
    // An ellipse turned across the path: thin along travel, wide across it.
    const across = r * 0.8 + k * r * 1.6,
      along = across * 0.42;
    const pts = Array.from({ length: 17 }, (_, j) => {
      const t = (j / 16) * TAU,
        ex = Math.cos(t) * along,
        ey = Math.sin(t) * across;
      return { x: rx + ex * cos - ey * sin, y: ry + ex * sin + ey * cos };
    });
    fx.g.lineStyle(2, i % 2 ? CYAN : PINK, 0.6 * (1 - k)).strokePoints(pts, true);
  }
  fx.glow(x, y, r * 3.4, c, 0.45);
  const tip = { x: x + cos * r * 1.5, y: y + sin * r * 1.5 };
  const l = { x: x + Math.cos(dir + 2.4) * r, y: y + Math.sin(dir + 2.4) * r };
  const rr = { x: x + Math.cos(dir - 2.4) * r, y: y + Math.sin(dir - 2.4) * r };
  const back = { x: x - cos * r * 0.4, y: y - sin * r * 0.4 };
  fx.solid.fillStyle(INK, 0.4).fillPoints([{ x: tip.x + cos * 2, y: tip.y + sin * 2 }, { x: l.x - cos, y: l.y - sin }, back, { x: rr.x - cos, y: rr.y - sin }], true);
  fx.solid.fillStyle(c, 1).fillPoints([tip, l, back, rr], true);
  fx.solid.fillStyle(WHITE, 0.95).fillCircle(x + cos * r * 0.3, y + sin * r * 0.3, r * 0.32);
  fx.trail(`p${pr.id}`, 0.05, () => floatMotes(fx, x - cos * 10, y, 1, c, 15));
}

// ───────────── Focus Ray ─────────────
function focusRay(scene: Phaser.Scene, a: Ability, x: number, y: number, tx: number, ty: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    sy = y - 16,
    len = Math.hypot(tx - x, ty - sy) || 1,
    ux = (tx - x) / len,
    uy = (ty - sy) / len,
    w = a.radius;
  fx.burst({ x: tx, y: ty + 14, z: 14, count: 14, kind: "spark", color: [color, PINK, CYAN], speed: [80, 260], up: [40, 200], life: [0.25, 0.5], size: [1, 1.6], grav: 700 });
  floatMotes(fx, tx, ty + 14, 8, color, 60);
  fx.shake(90, 0.0025);
  shot(fx.reduced ? 160 : 420, (k) => {
    const on = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25,
      width = w * 2 * (k < 0.1 ? k / 0.1 : 1) * (1 - k * 0.4);
    // Dark sheath, chromatic edges, then the white-hot core.
    fx.solid.lineStyle(width * 1.25, INK, 0.3 * on).lineBetween(x, sy, tx, ty);
    fx.g.lineStyle(width, color, 0.35 * on).lineBetween(x, sy, tx, ty);
    fx.g.lineStyle(width * 0.5, CYAN, 0.45 * on).lineBetween(x - uy * 2, sy + ux * 2, tx - uy * 2, ty + ux * 2);
    fx.g.lineStyle(width * 0.5, PINK, 0.45 * on).lineBetween(x + uy * 2, sy - ux * 2, tx + uy * 2, ty - ux * 2);
    fx.g.lineStyle(Math.max(2, width * 0.28), WHITE, 0.95 * on).lineBetween(x, sy, tx, ty);
    // Lens rings sliding down the beam.
    for (let i = 0; i < 4; i++) {
      const t = ((k * 2.2 + i / 4) % 1) * len;
      const px = x + ux * t,
        py = sy + uy * t;
      fx.g.lineStyle(2, i % 2 ? CYAN : PINK, 0.7 * on).strokeEllipse(px, py, w * 1.1, w * 2.6);
    }
    fx.glow(x + ux * 20, sy + uy * 20, w * 3, color, 0.8 * on);
    fx.glow(tx, ty, w * 4.5 * (1 - k * 0.3), color, 0.7 * on);
    fx.glow(tx, ty, w * 1.6, WHITE, 0.9 * on);
    fx.glow((x + tx) / 2, (sy + ty) / 2 + 30, len * 0.45, color, 0.18 * on, true, 0.25);
  });
}

// ───────────── Repulse ─────────────
function repulse(scene: Phaser.Scene, a: Ability, x: number, y: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    r = a.radius,
    cy = y - 12;
  fx.decal({ kind: "glyph", x, y, r: r * 0.55, color, life: 2.6 });
  // Grit and pebbles thrown outward by the push.
  fx.burst({ x, y, count: 18, kind: "debris", color: [0x8a7f74, 0x6d6460], speed: [220, 480], up: [60, 200], life: [0.5, 0.9], size: [2, 3.5], grav: 900, drag: 1.2 });
  floatMotes(fx, x, y, 16, color, 160);
  fx.shake(160, 0.004);
  shot(fx.reduced ? 220 : 560, (k) => {
    for (let i = 0; i < 3; i++) {
      const kk = Math.max(0, Math.min(1, k * 1.5 - i * 0.18));
      if (kk <= 0 || kk >= 1) continue;
      lensRing(fx, x, y, r * ease(kk), color, 1 - kk, 7 - i * 2, 0.82, true);
    }
    fx.glow(x, cy, r * 0.8 * (1 - k), color, 0.7 * (1 - k));
    fx.glow(x, cy, 26, WHITE, Math.max(0, 1 - k * 3));
    glyph(fx, x, y, r * 0.55, color, 1 - k, k * 2);
  });
}

// ───────────── Ward ─────────────
function ward(scene: Phaser.Scene, a: Ability, x: number, y: number, _angle: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    cy = y - 18,
    R = 46;
  floatMotes(fx, x, y, 10, color, 40);
  shot(fx.reduced ? 300 : 900, (k) => {
    const grow = ease(Math.min(1, k * 2.5)),
      fade = k > 0.7 ? (1 - k) / 0.3 : 1;
    glyph(fx, x, y + 4, R * grow, color, fade, k * 3);
    // A dome of hexagonal light assembling around Mystowl.
    for (let i = 0; i < 6; i++) {
      const a0 = (i * TAU) / 6 + Math.PI / 6,
        a1 = a0 + TAU / 6;
      const lift = Math.max(0, Math.min(1, k * 3 - i * 0.12));
      fx.g.lineStyle(3, color, 0.8 * fade * lift).lineBetween(x + Math.cos(a0) * R * grow, cy + Math.sin(a0) * R * grow, x + Math.cos(a1) * R * grow, cy + Math.sin(a1) * R * grow);
    }
    lensRing(fx, x, cy, R * grow, color, 0.6 * fade, 3, 1);
    fx.glow(x, cy, R * 1.4 * grow, color, 0.35 * fade);
  });
  void a;
}

// ───────────── Thoughtstrike ─────────────
function thoughtstrike(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    a = z.ability,
    c = z.color,
    r = z.radius,
    x = z.x,
    y = z.y,
    strikeAt = (a.tickDelay ?? 0.35) / a.duration;
  if (progress < strikeAt) {
    // Reticle closes on the target while an eye opens overhead.
    const k = progress / strikeAt;
    g.fillStyle(c, 0.06 + k * 0.1).fillEllipse(x, y, r * 2, r * 2 * 0.82);
    lensRing(fx, x, y, r, c, 0.8, 3, 0.82, true);
    lensRing(fx, x, y, r * (1.5 - k * 1.2), c, 0.5 + k * 0.5, 3, 0.82, true);
    glyph(fx, x, y, r * 0.6, c, k, now / 500);
    const ey = y - 120 - (1 - k) * 30,
      open = Math.min(1, k * 1.6);
    fx.solid.fillStyle(INK, 0.5 * open).fillEllipse(x, ey, 64, 30 * open);
    fx.solid.fillStyle(c, 0.95 * open).fillEllipse(x, ey, 54, 24 * open);
    fx.solid.fillStyle(WHITE, open).fillCircle(x, ey, 7 * open);
    fx.glow(x, ey, 60, c, 0.5 * open);
    return;
  }
  const k = (progress - strikeAt) / (1 - strikeAt);
  fx.trail(`ts${z.id}`, 999, () => {
    fx.decal({ kind: "glyph", x, y, r: r * 0.7, color: c, life: 3 });
    fx.decal({ kind: "crack", x, y, r: r * 0.6, color: c, life: 2.4 });
    fx.burst({ x, y, count: 22, kind: "debris", color: [0x8a7f74, 0x6d6460, 0x9c9389], speed: [60, 200], up: [200, 420], life: [0.6, 1], size: [2, 4], grav: 900 });
    floatMotes(fx, x, y, 14, c, 120);
    fx.shake(170, 0.005);
  });
  // The psychic hammer: a shaft from above, then the floor ripples.
  const shaft = Math.max(0, 1 - k * 2.2);
  fx.glow(x, y - 160, 70, c, 0.6 * shaft, false, 3.2);
  fx.glow(x, y - 160, 26, WHITE, 0.9 * shaft, false, 4.5);
  fx.glow(x, y, r * 1.3, c, 0.6 * (1 - k), true);
  fx.glow(x, y - 10, r * 0.7, WHITE, Math.max(0, 1 - k * 3));
  lensRing(fx, x, y, r * ease(Math.min(1, k * 1.6)), c, 1 - k, 7, 0.82, true);
  if (k > 0.15) lensRing(fx, x, y, r * 0.7 * ease(Math.min(1, (k - 0.15) * 2)), c, 1 - k, 4, 0.82, true);
}

// ───────────── Casts, hits ─────────────
function dartCast(scene: Phaser.Scene, _a: Ability, x: number, y: number, angle: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    mx = x + Math.cos(angle) * 22,
    my = y - 16 + Math.sin(angle) * 22;
  shot(160, (k) => {
    lensRing(fx, mx, my, 6 + k * 16, color, 1 - k, 2, 1);
    fx.glow(mx, my, 22, color, 0.6 * (1 - k));
  });
}
function rayCast(scene: Phaser.Scene, _a: Ability, x: number, y: number, _angle: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    cy = y - 16;
  shot(260, (k) => {
    lensRing(fx, x, cy, 40 * (1 - k) + 6, color, 0.9 * (1 - k * 0.5), 3, 1);
    fx.glow(x, cy, 50, color, 0.7 * (1 - k));
  });
}
function psychicHit(scene: Phaser.Scene, x: number, y: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    cy = y - 16;
  floatMotes(fx, x, y, 6, color, 40);
  shot(fx.reduced ? 160 : 380, (k) => {
    lensRing(fx, x, cy, 10 + ease(k) * 34, color, 1 - k, 3, 1);
    if (k > 0.2) lensRing(fx, x, cy, 6 + ease((k - 0.2) / 0.8) * 22, color, 1 - k, 2, 1);
    fx.glow(x, cy, 30 * (1 - k * 0.5), color, 0.7 * (1 - k));
  });
}
/** Wind-up for the zone: the same reticle the server's hit area uses. */
function strikeWindup(g: G, a: Ability, x: number, y: number, angle: number, aimX: number, aimY: number, color: number, k: number, now: number) {
  const fx = fxFor(g.scene),
    d = Math.min(a.range, Math.hypot(aimX - x, aimY - y)),
    tx = x + Math.cos(angle) * d,
    ty = y + Math.sin(angle) * d;
  lensRing(fx, tx, ty, a.radius, color, 0.6, 2, 0.82, true);
  g.fillStyle(color, 0.05 + k * 0.1).fillEllipse(tx, ty, a.radius * 2 * k, a.radius * 2 * 0.82 * k);
  glyph(fx, tx, ty, a.radius * 0.5, color, k * 0.8, now / 400);
  fx.glow(x, y - 16, 20 + k * 30, color, 0.4 + k * 0.4);
  void hash;
}

export const psychicKit: FxKit = {
  projectile: { "mind-dart": mindDart },
  beam: { "focus-ray": focusRay },
  zone: { thoughtstrike },
  windup: { thoughtstrike: strikeWindup },
  cast: {
    "mind-dart": dartCast,
    "focus-ray": rayCast,
    repulse: (scene, a, x, y, _angle, color, shot) => repulse(scene, a, x, y, color, shot),
    ward,
  },
  hit: { psychic: psychicHit },
};
