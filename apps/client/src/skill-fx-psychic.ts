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
 * Mystowl's kit: telekinesis. Space bends: rings split into cyan and pink
 * edges like light through a lens, motes hang weightless, glyphs burn into
 * the floor. Sizes come from the shared abilities (radius, range).
 */
const PINK = 0xff9de2;
const CYAN = 0x9ff3ff;
const INK = 0x2a1446;
const WHITE = 0xffffff;

/** A ring with a chromatic split: cyan inside, pink outside, white heart. */
function lensRing(
  fx: Fx,
  x: number,
  y: number,
  r: number,
  color: number,
  alpha: number,
  width = 4,
  squash = 0.82,
  onFloor = false,
) {
  if (r <= 1 || alpha <= 0) return;
  const g = onFloor ? fx.floor : fx.g;
  (onFloor ? fx.floorSolid : fx.solid)
    .lineStyle(width * 1.6, INK, 0.28 * alpha)
    .strokeEllipse(x, y, r * 2, r * 2 * squash);
  g.lineStyle(width, CYAN, 0.5 * alpha).strokeEllipse(
    x,
    y,
    (r - 2) * 2,
    (r - 2) * 2 * squash,
  );
  g.lineStyle(width, PINK, 0.5 * alpha).strokeEllipse(
    x,
    y,
    (r + 2) * 2,
    (r + 2) * 2 * squash,
  );
  g.lineStyle(Math.max(1, width * 0.45), color, 0.9 * alpha).strokeEllipse(
    x,
    y,
    r * 2,
    r * 2 * squash,
  );
}
/** Runic circle: two rings and spokes, slowly turning. */
function glyph(
  fx: Fx,
  x: number,
  y: number,
  r: number,
  color: number,
  alpha: number,
  spin: number,
  onFloor = true,
) {
  const g = onFloor ? fx.floor : fx.g,
    sq = 0.78;
  g.lineStyle(2, color, 0.7 * alpha).strokeEllipse(x, y, r * 2, r * 2 * sq);
  g.lineStyle(1.5, color, 0.45 * alpha).strokeEllipse(
    x,
    y,
    r * 1.6,
    r * 1.6 * sq,
  );
  for (let i = 0; i < 6; i++) {
    const a = spin + (i * TAU) / 6;
    const px = x + Math.cos(a) * r * 0.9,
      py = y + Math.sin(a) * r * 0.9 * sq;
    g.lineStyle(1.5, color, 0.6 * alpha).lineBetween(
      x + Math.cos(a) * r * 0.8,
      y + Math.sin(a) * r * 0.8 * sq,
      px,
      py,
    );
    g.fillStyle(WHITE, 0.8 * alpha).fillCircle(px, py, 2);
  }
  // Triangle sigil inside.
  const tri = (rot: number) =>
    [0, 1, 2].map((i) => ({
      x: x + Math.cos(rot + (i * TAU) / 3) * r * 0.62,
      y: y + Math.sin(rot + (i * TAU) / 3) * r * 0.62 * sq,
    }));
  g.lineStyle(1.5, color, 0.55 * alpha).strokePoints(tri(-spin), true);
  g.strokePoints(tri(-spin + Math.PI), true);
}
const floatMotes = (
  fx: Fx,
  x: number,
  y: number,
  n: number,
  color: number,
  spread = 30,
) =>
  fx.burst({
    x,
    y,
    z: 10,
    count: n,
    kind: "mote",
    color: [color, PINK, CYAN],
    speed: [10, spread],
    up: [20, 70],
    life: [0.6, 1.2],
    size: [1, 2],
    drag: 2.5,
  });

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
    const k = (now / 260 + i / 3) % 1,
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
    fx.g
      .lineStyle(2, i % 2 ? CYAN : PINK, 0.6 * (1 - k))
      .strokePoints(pts, true);
  }
  fx.glow(x, y, r * 3.4, c, 0.45);
  const tip = { x: x + cos * r * 1.5, y: y + sin * r * 1.5 };
  const l = { x: x + Math.cos(dir + 2.4) * r, y: y + Math.sin(dir + 2.4) * r };
  const rr = { x: x + Math.cos(dir - 2.4) * r, y: y + Math.sin(dir - 2.4) * r };
  const back = { x: x - cos * r * 0.4, y: y - sin * r * 0.4 };
  fx.solid
    .fillStyle(INK, 0.4)
    .fillPoints(
      [
        { x: tip.x + cos * 2, y: tip.y + sin * 2 },
        { x: l.x - cos, y: l.y - sin },
        back,
        { x: rr.x - cos, y: rr.y - sin },
      ],
      true,
    );
  fx.solid.fillStyle(c, 1).fillPoints([tip, l, back, rr], true);
  fx.solid
    .fillStyle(WHITE, 0.95)
    .fillCircle(x + cos * r * 0.3, y + sin * r * 0.3, r * 0.32);
  fx.trail(`p${pr.id}`, 0.05, () => floatMotes(fx, x - cos * 10, y, 1, c, 15));
}

// ───────────── Third-Eye Ray ─────────────
function focusRay(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  tx: number,
  ty: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    sy = y - 16,
    len = Math.hypot(tx - x, ty - sy) || 1,
    ux = (tx - x) / len,
    uy = (ty - sy) / len,
    w = a.radius;
  fx.burst({
    x: tx,
    y: ty + 14,
    z: 14,
    count: 14,
    kind: "spark",
    color: [color, PINK, CYAN],
    speed: [80, 260],
    up: [40, 200],
    life: [0.25, 0.5],
    size: [1, 1.6],
    grav: 700,
  });
  floatMotes(fx, tx, ty + 14, 8, color, 60);
  fx.shake(90, 0.0025);
  shot(fx.reduced ? 160 : 420, (k) => {
    const on = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25,
      width = w * 2 * (k < 0.1 ? k / 0.1 : 1) * (1 - k * 0.4);
    // Dark sheath, chromatic edges, then the white-hot core.
    fx.solid.lineStyle(width * 1.25, INK, 0.3 * on).lineBetween(x, sy, tx, ty);
    fx.g.lineStyle(width, color, 0.35 * on).lineBetween(x, sy, tx, ty);
    fx.g
      .lineStyle(width * 0.5, CYAN, 0.45 * on)
      .lineBetween(x - uy * 2, sy + ux * 2, tx - uy * 2, ty + ux * 2);
    fx.g
      .lineStyle(width * 0.5, PINK, 0.45 * on)
      .lineBetween(x + uy * 2, sy - ux * 2, tx + uy * 2, ty - ux * 2);
    fx.g
      .lineStyle(Math.max(2, width * 0.28), WHITE, 0.95 * on)
      .lineBetween(x, sy, tx, ty);
    // Lens rings sliding down the beam.
    for (let i = 0; i < 4; i++) {
      const t = ((k * 2.2 + i / 4) % 1) * len;
      const px = x + ux * t,
        py = sy + uy * t;
      fx.g
        .lineStyle(2, i % 2 ? CYAN : PINK, 0.7 * on)
        .strokeEllipse(px, py, w * 1.1, w * 2.6);
    }
    fx.glow(x + ux * 20, sy + uy * 20, w * 3, color, 0.8 * on);
    fx.glow(tx, ty, w * 4.5 * (1 - k * 0.3), color, 0.7 * on);
    fx.glow(tx, ty, w * 1.6, WHITE, 0.9 * on);
    fx.glow(
      (x + tx) / 2,
      (sy + ty) / 2 + 30,
      len * 0.45,
      color,
      0.18 * on,
      true,
      0.25,
    );
  });
}

// ───────────── Booming Hoot ─────────────
function repulse(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = a.radius,
    cy = y - 12;
  fx.decal({ kind: "glyph", x, y, r: r * 0.55, color, life: 2.6 });
  // Grit and pebbles thrown outward by the push.
  fx.burst({
    x,
    y,
    count: 18,
    kind: "debris",
    color: [0x8a7f74, 0x6d6460],
    speed: [220, 480],
    up: [60, 200],
    life: [0.5, 0.9],
    size: [2, 3.5],
    grav: 900,
    drag: 1.2,
  });
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

// ───────────── Wing Cloak ─────────────
function ward(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  _angle: number,
  color: number,
  shot: Shot,
) {
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
      fx.g
        .lineStyle(3, color, 0.8 * fade * lift)
        .lineBetween(
          x + Math.cos(a0) * R * grow,
          cy + Math.sin(a0) * R * grow,
          x + Math.cos(a1) * R * grow,
          cy + Math.sin(a1) * R * grow,
        );
    }
    lensRing(fx, x, cy, R * grow, color, 0.6 * fade, 3, 1);
    fx.glow(x, cy, R * 1.4 * grow, color, 0.35 * fade);
  });
  void a;
}

// ───────────── Silent Swoop ─────────────
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
    fx.burst({
      x,
      y,
      count: 22,
      kind: "debris",
      color: [0x8a7f74, 0x6d6460, 0x9c9389],
      speed: [60, 200],
      up: [200, 420],
      life: [0.6, 1],
      size: [2, 4],
      grav: 900,
    });
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
  if (k > 0.15)
    lensRing(
      fx,
      x,
      y,
      r * 0.7 * ease(Math.min(1, (k - 0.15) * 2)),
      c,
      1 - k,
      4,
      0.82,
      true,
    );
}

// ───────────── Casts, hits ─────────────
function dartCast(
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
    my = y - 16 + Math.sin(angle) * 22;
  shot(160, (k) => {
    lensRing(fx, mx, my, 6 + k * 16, color, 1 - k, 2, 1);
    fx.glow(mx, my, 22, color, 0.6 * (1 - k));
  });
}
function rayCast(
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
  shot(260, (k) => {
    lensRing(fx, x, cy, 40 * (1 - k) + 6, color, 0.9 * (1 - k * 0.5), 3, 1);
    fx.glow(x, cy, 50, color, 0.7 * (1 - k));
  });
}
function psychicHit(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    cy = y - 16;
  floatMotes(fx, x, y, 6, color, 40);
  shot(fx.reduced ? 160 : 380, (k) => {
    lensRing(fx, x, cy, 10 + ease(k) * 34, color, 1 - k, 3, 1);
    if (k > 0.2)
      lensRing(fx, x, cy, 6 + ease((k - 0.2) / 0.8) * 22, color, 1 - k, 2, 1);
    fx.glow(x, cy, 30 * (1 - k * 0.5), color, 0.7 * (1 - k));
  });
}
/** Wind-up for the zone: the same reticle the server's hit area uses. */
function strikeWindup(
  g: G,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  aimX: number,
  aimY: number,
  color: number,
  k: number,
  now: number,
) {
  const fx = fxFor(g.scene),
    d = Math.min(a.range, Math.hypot(aimX - x, aimY - y)),
    tx = x + Math.cos(angle) * d,
    ty = y + Math.sin(angle) * d;
  lensRing(fx, tx, ty, a.radius, color, 0.6, 2, 0.82, true);
  g.fillStyle(color, 0.05 + k * 0.1).fillEllipse(
    tx,
    ty,
    a.radius * 2 * k,
    a.radius * 2 * 0.82 * k,
  );
  glyph(fx, tx, ty, a.radius * 0.5, color, k * 0.8, now / 400);
  fx.glow(x, y - 16, 20 + k * 30, color, 0.4 + k * 0.4);
  void hash;
}

/** Mind Dart lands: a small lens pulse and a few weightless motes. */
function dartImpact(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  floatMotes(fx, x, y + 10, 4, color, 30);
  shot(fx.reduced ? 120 : 260, (k) => {
    lensRing(fx, x, y, 6 + ease(k) * 22, color, 1 - k, 2, 1);
    fx.glow(x, y, 20 * (1 - k * 0.5), color, 0.6 * (1 - k));
  });
}

// ═════════════ Astrabun: moon rabbit, mochi mallet, hops through space ═════════════
const MOON = 0xfff3cf;
const MOCHI = 0xfff0f5;
const WOOD = 0x9a6a44;
const WOOD_DARK = 0x5c3a24;
const SQ = 0.82;

const moonDust = (
  fx: Fx,
  x: number,
  y: number,
  n: number,
  speed: [number, number],
  color: number,
) =>
  fx.burst({
    x,
    y,
    z: 8,
    count: n,
    kind: "mote",
    color: [MOON, color, PINK],
    speed,
    up: [30, 120],
    life: [0.6, 1.1],
    size: [1, 2],
    grav: 40,
    drag: 2,
  });
/** Points of a crescent: disc (x, y, r) minus a disc offset toward `rot`. */
function crescentPoints(
  x: number,
  y: number,
  r: number,
  rot: number,
  scale = 1,
) {
  const ox = x + Math.cos(rot) * r * 0.5,
    oy = y + Math.sin(rot) * r * 0.5,
    r2 = r * 0.85,
    pts: { x: number; y: number }[] = [];
  // The lit rim, then back along the inner edge.
  for (let i = 0; i <= 32; i++) {
    const t = rot + (i / 32) * Math.PI * 2,
      px = x + Math.cos(t) * r,
      py = y + Math.sin(t) * r;
    if (Math.hypot(px - ox, py - oy) > r2) pts.push({ x: px, y: py });
  }
  // Keep the rim's points in one run around the lit side.
  const lit = rot + Math.PI;
  pts.sort(
    (p, q) =>
      Math.atan2(
        Math.sin(Math.atan2(p.y - y, p.x - x) - lit),
        Math.cos(Math.atan2(p.y - y, p.x - x) - lit),
      ) -
      Math.atan2(
        Math.sin(Math.atan2(q.y - y, q.x - x) - lit),
        Math.cos(Math.atan2(q.y - y, q.x - x) - lit),
      ),
  );
  const inner: { x: number; y: number }[] = [];
  for (let i = 0; i <= 32; i++) {
    const t = lit + Math.PI - (i / 32) * Math.PI * 2,
      px = ox + Math.cos(t) * r2,
      py = oy + Math.sin(t) * r2;
    if (Math.hypot(px - x, py - y) < r) inner.push({ x: px, y: py });
  }
  inner.sort(
    (p, q) =>
      Math.atan2(
        Math.sin(Math.atan2(q.y - oy, q.x - ox) - lit),
        Math.cos(Math.atan2(q.y - oy, q.x - ox) - lit),
      ) -
      Math.atan2(
        Math.sin(Math.atan2(p.y - oy, p.x - ox) - lit),
        Math.cos(Math.atan2(p.y - oy, p.x - ox) - lit),
      ),
  );
  return [...pts, ...inner].map((p) => ({
    x: x + (p.x - x) * scale,
    y: y + (p.y - y) * scale,
  }));
}
/** A moon: a crescent lit away from `rot`, or full with craters. */
function crescent(
  fx: Fx,
  x: number,
  y: number,
  r: number,
  rot: number,
  alpha: number,
  full = false,
) {
  if (r <= 0.5 || alpha <= 0) return;
  fx.glow(x, y, r * 2.4, MOON, 0.28 * alpha);
  if (full) {
    fx.solid.fillStyle(INK, 0.35 * alpha).fillCircle(x, y, r * 1.1);
    fx.solid.fillStyle(MOON, alpha).fillCircle(x, y, r);
    // Craters.
    fx.solid
      .fillStyle(0xe6d6a6, alpha)
      .fillCircle(x - r * 0.3, y - r * 0.2, r * 0.22)
      .fillCircle(x + r * 0.35, y + r * 0.25, r * 0.16)
      .fillCircle(x + r * 0.1, y - r * 0.45, r * 0.1);
    return;
  }
  fx.solid
    .fillStyle(INK, 0.4 * alpha)
    .fillPoints(crescentPoints(x, y, r, rot, 1.12), true);
  fx.solid
    .fillStyle(MOON, alpha)
    .fillPoints(crescentPoints(x, y, r, rot), true);
}
/** The mochi mallet: a wooden handle and a barrel head, drawn at `ang`. */
function mallet(
  fx: Fx,
  hx: number,
  hy: number,
  ang: number,
  size: number,
  alpha: number,
) {
  const cos = Math.cos(ang),
    sin = Math.sin(ang),
    // Head across the handle's end.
    w = size,
    h = size * 0.62;
  const hand = { x: hx - cos * size * 1.6, y: hy - sin * size * 1.6 };
  fx.solid
    .lineStyle(size * 0.26, WOOD_DARK, alpha)
    .lineBetween(hand.x, hand.y, hx, hy);
  fx.solid
    .lineStyle(size * 0.15, WOOD, alpha)
    .lineBetween(hand.x, hand.y, hx, hy);
  const corner = (u: number, v: number) => ({
    x: hx + cos * u - sin * v,
    y: hy + sin * u + cos * v,
  });
  const box = (s: number) => [
    corner(-h * 0.5 * s, -w * 0.5 * s),
    corner(h * 0.5 * s, -w * 0.5 * s),
    corner(h * 0.5 * s, w * 0.5 * s),
    corner(-h * 0.5 * s, w * 0.5 * s),
  ];
  fx.solid.fillStyle(WOOD_DARK, alpha).fillPoints(box(1.15), true);
  fx.solid.fillStyle(WOOD, alpha).fillPoints(box(1), true);
  // Pink bands at each end of the barrel.
  for (const v of [-0.38, 0.38]) {
    const a0 = corner(-h * 0.5, w * v),
      a1 = corner(h * 0.5, w * v);
    fx.solid.lineStyle(3, PINK, alpha).lineBetween(a0.x, a0.y, a1.x, a1.y);
  }
}
/** The mallet's swing over the ability's real arc and range. */
function malletSwing(
  fx: Fx,
  x: number,
  y: number,
  a: Ability,
  angle: number,
  k: number,
  color: number,
) {
  const spread = Math.min(Math.PI * 0.95, Math.acos(a.arc ?? 0.3)),
    sweep = ease(Math.min(1, k * 2)),
    to = angle - spread + 2 * spread * sweep,
    r = a.range * 0.85,
    fade = 1 - Math.max(0, (k - 0.4) / 0.6);
  fx.floor
    .fillStyle(color, 0.14 * fade)
    .slice(x, y + 12, a.range, angle - spread, angle + spread);
  fx.floor.fillPath();
  const pts = Array.from({ length: 14 }, (_, i) => {
    const t = angle - spread + (to - angle + spread) * (i / 13);
    return { x: x + Math.cos(t) * r, y: y + Math.sin(t) * r * SQ };
  });
  fx.solid.lineStyle(9, INK, 0.2 * fade).strokePoints(pts, false);
  fx.g.lineStyle(7, color, 0.55 * fade).strokePoints(pts, false);
  fx.g.lineStyle(2.5, MOCHI, 0.9 * fade).strokePoints(pts.slice(5), false);
  const hx = x + Math.cos(to) * r,
    hy = y + Math.sin(to) * r * SQ;
  mallet(fx, hx, hy, to, 30, fade);
}

// ───────────── Mallet Bop ─────────────
function malletBop(
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
    cy = y - 14,
    hx = x + Math.cos(angle) * a.range * 0.85,
    hy = cy + Math.sin(angle) * a.range * 0.85 * SQ;
  shot(fx.reduced ? 160 : 300, (k) => {
    // The strike stays on the caster while it moves.
    const { x, y } = at?.() ?? origin,
      cy = y - 14;
    malletSwing(fx, x, cy, a, angle, k, color);
    if (k > 0.45) {
      const kk = (k - 0.45) / 0.55;
      lensRing(fx, hx, hy, 8 + ease(kk) * 22, color, 1 - kk, 3, 1);
    }
  });
  scene.time.delayedCall(fx.reduced ? 70 : 140, () =>
    moonDust(fx, hx, hy + 14, 5, [30, 90], color),
  );
}

// ───────────── Mochi Pound ─────────────
/**
 * The mallet comes down overhead on the ability's range; the ground
 * squashes like mochi and a lens ring rolls over the hit arc.
 */
function mochiPound(
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
    spread = Math.min(Math.PI * 0.95, Math.acos(a.arc ?? 0.3)),
    reach = a.range * 0.7,
    hx = x + Math.cos(angle) * reach,
    hy = y + Math.sin(angle) * reach * SQ,
    once = { hit: false };
  shot(fx.reduced ? 260 : 620, (k) => {
    // The strike stays on the caster while it moves.
    const { x, y } = at?.() ?? origin;
    // The swept wedge: what the pound can reach.
    const fade = 1 - Math.max(0, (k - 0.35) / 0.65);
    fx.floor
      .fillStyle(color, 0.16 * fade)
      .slice(x, y, a.range, angle - spread, angle + spread);
    fx.floor.fillPath();
    if (k < 0.3) {
      // Up and over: the mallet rises behind and drops onto the spot.
      const kk = k / 0.3,
        lift = Math.sin(kk * Math.PI) * 70,
        mx = x + (hx - x) * ease(kk),
        my = y - 30 + (hy - 16 - (y - 30)) * ease(kk) - lift;
      // Swing from straight up to pointing at the spot (shortest turn).
      const turn = Math.atan2(
        Math.sin(angle + Math.PI / 2),
        Math.cos(angle + Math.PI / 2),
      );
      mallet(fx, mx, my, -Math.PI / 2 + turn * ease(kk), 36, 1);
      return;
    }
    if (!once.hit) {
      once.hit = true;
      fx.decal({ kind: "crack", x: hx, y: hy, r: 40, color, life: 2.5 });
      fx.burst({
        x: hx,
        y: hy,
        count: 12,
        kind: "debris",
        color: [0x8a7f74, 0x6d6460, MOCHI],
        speed: [100, 260],
        up: [120, 300],
        life: [0.5, 0.9],
        size: [2, 4],
        grav: 1000,
      });
      moonDust(fx, hx, hy, 10, [60, 180], color);
      fx.shake(150, 0.005);
    }
    const kk = (k - 0.3) / 0.7,
      squash = 1 - ease(Math.min(1, kk * 3)) * 0.5;
    // The mochi splat under the mallet.
    fx.solid
      .fillStyle(INK, 0.3 * (1 - kk))
      .fillEllipse(hx, hy, 66 / squash, 28 * squash);
    fx.solid
      .fillStyle(MOCHI, 0.95 * (1 - kk))
      .fillEllipse(hx, hy - 2, 58 / squash, 22 * squash);
    fx.solid
      .fillStyle(PINK, 0.6 * (1 - kk))
      .fillEllipse(hx - 8, hy - 5, 14 / squash, 5 * squash);
    mallet(fx, hx, hy - 12 - kk * 10, angle, 36, 1 - kk);
    lensRing(
      fx,
      hx,
      hy,
      20 + ease(kk) * a.range * 0.6,
      color,
      1 - kk,
      6,
      SQ,
      true,
    );
    fx.glow(hx, hy - 10, 60 * (1 - kk * 0.5), color, 0.6 * (1 - kk));
    if (kk < 0.15) fx.glow(hx, hy - 10, 40, WHITE, 0.9 * (1 - kk / 0.15));
  });
}

// ───────────── Moon Hop ─────────────
/** Takeoff: Astrabun folds into a crescent of moonlight and is gone. */
function hopTakeoff(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    cy = y - 22,
    big = a.id === "full-moon";
  moonDust(fx, x, y, big ? 18 : 10, [20, 90], color);
  fx.burst({
    x,
    y,
    count: big ? 10 : 6,
    kind: "smoke",
    color: [0xe9e2ff, MOCHI],
    speed: [40, 120],
    up: [10, 40],
    life: [0.4, 0.8],
    size: [8, 13],
    drag: 3,
  });
  shot(fx.reduced ? 160 : big ? 460 : 340, (k) => {
    const fade = 1 - k;
    // Space pinches shut where it stood.
    lensRing(fx, x, cy, 46 * (1 - ease(k)) + 4, color, fade, 3, 1);
    lensRing(fx, x, y, 40 + ease(k) * 30, color, 0.6 * fade, 2, SQ, true);
    crescent(fx, x, cy - k * 30, 14 * (1 - k * 0.6), angle + Math.PI, fade);
    // A streak toward where it lands.
    fx.g
      .lineStyle(10 * fade, color, 0.3 * fade)
      .lineBetween(
        x,
        cy,
        x + Math.cos(angle) * 60 * ease(k),
        cy + Math.sin(angle) * 60 * ease(k) - 20 * k,
      );
    if (big) fx.glow(x, cy - 80 * ease(k), 30, MOON, 0.7 * fade, false, 3);
  });
}
/** Landing: a little moonburst out to the real radius. */
function hopLanding(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = a.radius || 60,
    cy = y - 22;
  moonDust(fx, x, y, 14, [r * 0.8, r * 2], color);
  fx.decal({ kind: "glyph", x, y, r: r * 0.8, color, life: 1.8 });
  shot(fx.reduced ? 200 : 460, (k) => {
    const out = ease(Math.min(1, k * 1.8)),
      fade = 1 - k;
    fx.floorSolid
      .fillStyle(color, 0.16 * fade)
      .fillEllipse(x, y, r * 2 * out, r * 2 * SQ * out);
    lensRing(fx, x, y, r * out, color, fade, 5, SQ, true);
    glyph(fx, x, y, r * 0.6, color, fade, k * 3);
    // Pop in: a crescent flash where Astrabun appears.
    const pop = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
    crescent(fx, x, cy - 30, 12 * pop, -0.6, pop);
    fx.glow(x, cy, 46 * (1 - k * 0.4), color, 0.7 * fade);
    if (k < 0.12) fx.glow(x, cy, 36, WHITE, 0.9 * (1 - k / 0.12));
  });
}

// ───────────── Moon Gravity ─────────────
/**
 * A patch of heavy moon gravity, as wide as the zone: a pale crater with
 * rings pressing inward and moon dust falling hard onto the floor.
 */
function moonGravity(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    c = z.color,
    r = z.radius,
    { x, y } = z,
    grow = ease(Math.min(1, progress / 0.1)),
    fade = progress > 0.88 ? (1 - progress) / 0.12 : 1,
    rr = r * grow;
  fx.trail(`mg${z.id}`, 999, () => {
    fx.decal({
      kind: "crack",
      x,
      y,
      r: r * 0.5,
      color: c,
      life: (z.ability.duration || 2) + 0.8,
    });
    fx.shake(100, 0.003);
  });
  // The ground sags: dark violet bowl with a pale rim.
  fx.floorSolid
    .fillStyle(INK, 0.32 * fade)
    .fillEllipse(x, y, rr * 2, rr * 2 * SQ);
  fx.floorSolid
    .fillStyle(0x140a26, 0.25 * fade)
    .fillEllipse(x, y + rr * 0.06, rr * 1.4, rr * 1.4 * SQ);
  fx.glow(x, y, rr * 1.05, c, 0.25 * fade, true);
  lensRing(fx, x, y, rr, c, 0.9 * fade, 4, SQ, true);
  // Rings pressing inward: the pull of the weight.
  for (let i = 0; i < 3; i++) {
    const k = (now / 1100 + i / 3) % 1,
      rp = rr * (1 - ease(k)) * 0.95;
    fx.floor
      .lineStyle(2.5, i % 2 ? CYAN : PINK, 0.6 * fade * Math.min(1, k * 4))
      .strokeEllipse(x, y, rp * 2, rp * 2 * SQ);
  }
  glyph(fx, x, y, rr * 0.55, MOON, 0.7 * fade, -now / 900);
  // A full moon looming low over the patch.
  const my = y - rr * SQ - 60 - Math.sin(now / 700) * 4;
  crescent(fx, x, my, 18 * grow, 0, 0.75 * fade, true);
  fx.glow(x, (y + my) / 2, rr * 0.4, MOON, 0.12 * fade, false, 2.6);
  // Moon dust slammed straight down.
  fx.trail(`mgd${z.id}`, 0.04, () => {
    const ang = Math.random() * TAU,
      d = Math.sqrt(Math.random()) * rr * 0.95;
    fx.burst({
      x: x + Math.cos(ang) * d,
      y: y + Math.sin(ang) * d * SQ,
      z: 70 + Math.random() * 40,
      count: 1,
      kind: "mote",
      color: [MOON, c, PINK],
      speed: [0, 6],
      up: [-120, -60],
      life: [0.45, 0.7],
      size: [1.2, 2],
      grav: 900,
      bounce: 0.05,
      drag: 0.5,
    });
  });
}
function gravityCast(
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
    my = y - 20 + Math.sin(angle) * 22;
  shot(fx.reduced ? 160 : 320, (k) => {
    crescent(fx, mx, my - k * 20, 9 * (1 - k * 0.4), angle, 1 - k, true);
    lensRing(fx, mx, my, 6 + k * 24, color, 1 - k, 2, 1);
  });
}

// ───────────── Full Moon ─────────────
/** Where a blink will land: toward the aim, up to its range. */
const landingOf = (
  a: Ability,
  x: number,
  y: number,
  angle: number,
  aimX: number,
  aimY: number,
) => {
  const d = Math.min(a.range || 0, Math.hypot(aimX - x, aimY - y));
  return { x: x + Math.cos(angle) * d, y: y + Math.sin(angle) * d };
};
/**
 * Wind-up: Astrabun rises into a swelling full moon while the shockwave's
 * real radius is marked where it will crash down.
 */
function fullMoonWindup(
  g: G,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  aimX: number,
  aimY: number,
  color: number,
  k: number,
  now: number,
) {
  const fx = fxFor(g.scene),
    r = a.radius,
    t = landingOf(a, x, y, angle, aimX, aimY);
  // Target: the full shockwave area at the landing spot.
  g.fillStyle(color, 0.05 + k * 0.12).fillEllipse(t.x, t.y, r * 2, r * 2 * SQ);
  lensRing(fx, t.x, t.y, r, color, 0.5 + k * 0.4, 3, SQ, true);
  lensRing(fx, t.x, t.y, r * (1 - k) + 6, color, 0.4 + k * 0.6, 2, SQ, true);
  glyph(fx, t.x, t.y, r * 0.5, MOON, 0.4 + k * 0.5, now / 500);
  // The moon swelling above as the rabbit lifts off.
  const my = y - 60 - k * 50;
  fx.glow(x, my, 40 + k * 50, MOON, 0.35 + k * 0.35);
  crescent(fx, x, my, 10 + k * 18, 0, 0.6 + k * 0.4, k > 0.5);
  fx.glow(x, y, 50 * (0.6 + k * 0.4), color, 0.25 + k * 0.3, true);
  // Moon dust drawn up into it.
  fx.trail(`fmw${Math.round(x)}`, 0.04, () =>
    fx.burst({
      x: x + (Math.random() - 0.5) * 60,
      y: y + (Math.random() - 0.5) * 20,
      z: 4,
      count: 1,
      kind: "mote",
      color: [MOON, color],
      speed: [0, 10],
      up: [120, 200],
      life: [0.4, 0.6],
      size: [1, 1.8],
      drag: 0.5,
    }),
  );
}
/**
 * The crash: the full moon drops onto the landing spot and a shockwave
 * rolls out to the real radius. Astrabun's ultimate set piece.
 */
function fullMoonCrash(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = a.radius || 120,
    once = { hit: false };
  fx.ultimate(color, 850);
  shot(fx.reduced ? 360 : 1000, (k) => {
    if (k < 0.16) {
      // The moon falls out of the sky onto the spot.
      const kk = k / 0.16,
        my = y - 240 * (1 - kk * kk) - 20,
        mr = 30 + kk * 16;
      // A streak of moonlight behind it as it drops.
      fx.glow(x, my - mr * 2.2, mr * 1.1, MOON, 0.35, false, 3.2);
      crescent(fx, x, my, mr, 0, 1, true);
      fx.floorSolid
        .fillStyle(0x000000, 0.15 + kk * 0.2)
        .fillEllipse(x, y, r * 0.8 * kk + 20, (r * 0.8 * kk + 20) * SQ);
      return;
    }
    if (!once.hit) {
      once.hit = true;
      fx.decal({ kind: "crack", x, y, r: r * 0.85, color, life: 4 });
      fx.decal({ kind: "glyph", x, y, r: r * 0.95, color: MOON, life: 3 });
      fx.burst({
        x,
        y,
        count: 30,
        kind: "debris",
        color: [0x8a7f74, 0x6d6460, 0x9c9389, MOON],
        speed: [r * 1.2, r * 3],
        up: [200, 480],
        life: [0.6, 1.1],
        size: [2.5, 5],
        grav: 1000,
      });
      moonDust(fx, x, y, 30, [r * 1, r * 2.6], color);
      fx.shake(320, 0.009);
    }
    const kk = (k - 0.16) / 0.84,
      out = ease(Math.min(1, kk * 1.7)),
      fade = 1 - kk;
    fx.floorSolid
      .fillStyle(INK, 0.25 * fade)
      .fillEllipse(x, y, r * 2 * out, r * 2 * SQ * out);
    fx.floorSolid
      .fillStyle(color, 0.16 * fade)
      .fillEllipse(x, y, r * 1.6 * out, r * 1.6 * SQ * out);
    for (let i = 0; i < 3; i++) {
      const ki = Math.max(0, Math.min(1, kk * 1.6 - i * 0.16));
      if (ki <= 0 || ki >= 1) continue;
      lensRing(fx, x, y, r * ease(ki), color, 1 - ki, 9 - i * 2.5, SQ, true);
    }
    fx.shockwave(x, y, r * out, kk, MOON, 14);
    // The moon sinks into the ground and fades as moonlight.
    const sink = Math.max(0, 1 - kk * 2.5);
    crescent(fx, x, y - 30 + kk * 20, 46 * sink, 0, sink, true);
    fx.glow(x, y - 20, r * 0.9, color, 0.6 * fade);
    fx.glow(x, y, r * 1.1, MOON, 0.4 * fade, true);
    if (kk < 0.1) fx.glow(x, y - 20, r * 0.6, WHITE, 0.9 * (1 - kk / 0.1));
    glyph(fx, x, y, r * 0.55, MOON, fade, kk * 2);
  });
}

export const psychicKit: FxKit = {
  projectile: { "mind-dart": mindDart },
  beam: { "third-eye-ray": focusRay },
  zone: { "silent-swoop": thoughtstrike, "moon-gravity": moonGravity },
  windup: { "silent-swoop": strikeWindup, "full-moon": fullMoonWindup },
  cast: {
    "mind-dart": dartCast,
    "third-eye-ray": rayCast,
    "booming-hoot": (scene, a, x, y, _angle, color, shot) =>
      repulse(scene, a, x, y, color, shot),
    "wing-cloak": ward,
    "mallet-bop": malletBop,
    "moon-hop": hopTakeoff,
    "mochi-pound": mochiPound,
    "moon-gravity": gravityCast,
    "full-moon": hopTakeoff,
  },
  impact: {
    "mind-dart": dartImpact,
    "moon-hop": hopLanding,
    "full-moon": fullMoonCrash,
  },
  hit: { psychic: psychicHit },
};
