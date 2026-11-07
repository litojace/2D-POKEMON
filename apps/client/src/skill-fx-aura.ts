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
 * Auralynx's kit: crystal aura. Faceted prisms, rainbow refraction, glass
 * shards that tumble and bounce, hex mirrors. Sizes come from the abilities.
 */
const GLASS = 0xdff4ff;
const PINK = 0xff9be0;
const CYAN = 0x8ff6ff;
const GOLD = 0xffe58f;
const INK = 0x26285a;

function shards(
  fx: Fx,
  x: number,
  y: number,
  n: number,
  color: number,
  o: { angle?: number; spread?: number; power?: number } = {},
) {
  const p = o.power ?? 1;
  fx.burst({
    x,
    y,
    z: 16,
    count: n,
    kind: "debris",
    color: [color, GLASS, 0xb9c8ff],
    angle: o.angle,
    spread: o.spread,
    speed: [80 * p, 260 * p],
    up: [120 * p, 320 * p],
    life: [0.5, 0.9],
    size: [2.5, 4.5],
    grav: 1100,
    bounce: 0.35,
  });
  fx.burst({
    x,
    y,
    z: 16,
    count: Math.ceil(n / 2),
    kind: "spark",
    color: [color, PINK, CYAN],
    angle: o.angle,
    spread: o.spread,
    speed: [120 * p, 380 * p],
    up: [40, 200],
    life: [0.2, 0.4],
    size: [1, 1.5],
    grav: 600,
  });
}
/** A faceted gem: dark rim, two-tone faces, white facet line. */
function gem(
  fx: Fx,
  x: number,
  y: number,
  r: number,
  color: number,
  rot: number,
) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = rot + (i * TAU) / 6;
    return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 1.25 };
  });
  fx.solid.fillStyle(INK, 0.5).fillPoints(
    pts.map((p) => ({ x: x + (p.x - x) * 1.12, y: y + (p.y - y) * 1.12 })),
    true,
  );
  fx.solid.fillStyle(color, 1).fillPoints(pts, true);
  fx.solid
    .fillStyle(GLASS, 0.85)
    .fillTriangle(x, y, pts[0].x, pts[0].y, pts[1].x, pts[1].y);
  fx.solid
    .fillStyle(0xb9c8ff, 0.9)
    .fillTriangle(x, y, pts[3].x, pts[3].y, pts[4].x, pts[4].y);
  fx.solid
    .lineStyle(1.5, 0xffffff, 0.9)
    .lineBetween(pts[0].x, pts[0].y, pts[3].x, pts[3].y);
}
/** Refraction: the same outline split into pink, cyan and gold. */
function prismLine(
  fx: Fx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  alpha: number,
) {
  const nx = -(y1 - y0),
    ny = x1 - x0,
    l = Math.hypot(nx, ny) || 1;
  [PINK, CYAN, GOLD].forEach((c, i) => {
    const o = (i - 1) * 3;
    fx.g
      .lineStyle(width, c, alpha)
      .lineBetween(
        x0 + (nx / l) * o,
        y0 + (ny / l) * o,
        x1 + (nx / l) * o,
        y1 + (ny / l) * o,
      );
  });
}

// ───────────── Prism Jab: a focused crystal thrust ─────────────
function prismJab(
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
    cy = y - 12,
    tipX = x + Math.cos(angle) * a.range,
    tipY = cy + Math.sin(angle) * a.range;
  shards(fx, tipX, tipY + 12, 6, color, { angle, spread: 0.7, power: 0.7 });
  shot(fx.reduced ? 140 : 240, (k) => {
    // The strike stays on the caster while it moves.
    const { x, y } = at?.() ?? origin,
      cy = y - 12;
    const reach = ease(Math.min(1, k * 3)),
      fade = 1 - Math.max(0, (k - 0.3) / 0.7),
      hx = x + Math.cos(angle) * a.range * reach,
      hy = cy + Math.sin(angle) * a.range * reach,
      nx = -Math.sin(angle) * 9,
      ny = Math.cos(angle) * 9;
    fx.solid
      .fillStyle(INK, 0.35 * fade)
      .fillTriangle(
        x + nx * 1.3,
        cy + ny * 1.3,
        x - nx * 1.3,
        cy - ny * 1.3,
        hx,
        hy,
      );
    fx.solid
      .fillStyle(color, 0.95 * fade)
      .fillTriangle(x + nx, cy + ny, x - nx, cy - ny, hx, hy);
    fx.solid
      .fillStyle(GLASS, 0.9 * fade)
      .fillTriangle(
        x + nx * 0.35,
        cy + ny * 0.35,
        x - nx * 0.35,
        cy - ny * 0.35,
        hx,
        hy,
      );
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
  fx.solid
    .fillStyle(0x000000, 0.18)
    .fillEllipse(pr.x, pr.y + 4, r * 1.8, r * 0.6);
  prismLine(fx, x - Math.cos(a) * 90, y - Math.sin(a) * 90, x, y, 3, 0.45);
  fx.glow(x, y, r * 2.4, c, 0.4);
  gem(fx, x, y, r * 0.8, c, now / 90 + pr.id);
  // Light refracting off the gem onto the floor.
  fx.glow(pr.x + Math.cos(now / 200) * 10, pr.y + 4, r * 1.6, PINK, 0.25, true);
  fx.glow(pr.x - Math.cos(now / 200) * 10, pr.y + 4, r * 1.6, CYAN, 0.25, true);
  if (hash(Math.floor(now / 90) + pr.id) > 0.6) {
    const s = r * 1.6;
    fx.g
      .lineStyle(2, 0xffffff, 0.9)
      .lineBetween(x - s, y - s * 0.4, x + s, y + s * 0.4)
      .lineBetween(x - s * 0.3, y + s, x + s * 0.3, y - s);
  }
  fx.trail(`ps${pr.id}`, 0.04, () =>
    fx.burst({
      x,
      y: pr.y,
      z: hover,
      count: 1,
      kind: "mote",
      color: [PINK, CYAN, GOLD],
      speed: [10, 40],
      up: [-10, 20],
      life: [0.3, 0.6],
      size: [1, 1.6],
      drag: 2,
    }),
  );
}
function prismImpact(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  shards(fx, x, y, 12, color);
  shot(320, (k) => {
    fx.glow(x, y - 12, 44 * (1 - k * 0.4), color, 0.6 * (1 - k));
    fx.shockwave(x, y, 46 * ease(k), k, CYAN, 5);
  });
}

// ───────────── Shatter Paw: the air itself cracks ─────────────
function shatterPalm(
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
        layer.lineBetween(
          mx,
          my,
          hx + Math.cos(aa) * len,
          hy + Math.sin(aa) * len,
        );
      }
    }
    for (const rr of [18, 38]) {
      fx.g.lineStyle(2, CYAN, 0.8 * fade);
      for (let i = 0; i < 9; i++) {
        const a0 = (i * TAU) / 9 + hash(seed + i) * 0.4;
        if (hash(seed + i * 3 + rr) > 0.35)
          fx.g
            .beginPath()
            .arc(hx, hy, rr * grow, a0, a0 + 0.5)
            .strokePath();
      }
    }
    fx.shockwave(
      x + Math.cos(angle) * a.range * 0.85,
      y + Math.sin(angle) * a.range * 0.85,
      a.range * 0.7 * grow,
      k,
      PINK,
      7,
    );
  });
}

// ───────────── Facet Guard: crystal facets snap together ─────────────
function mirrorGuard(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
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
      const hex = Array.from({ length: 6 }, (_, j) => ({
        x: px + Math.cos(j * (TAU / 6)) * s,
        y: py + Math.sin(j * (TAU / 6)) * s,
      }));
      fx.solid.fillStyle(color, 0.35 * fade).fillPoints(hex, true);
      fx.solid.lineStyle(3, INK, 0.3 * fade).strokePoints(hex, true);
      fx.g.lineStyle(2, GLASS, 0.95 * fade).strokePoints(hex, true);
      // A sheen sliding across the mirrors.
      if (Math.abs((i + 2) / 4 - sweep) < 0.2)
        fx.glow(px, py, 22, 0xffffff, 0.6 * fade);
    }
    fx.glow(x, cy, 70, color, 0.25 * fade);
  });
  shards(fx, x, y, 6, color, { power: 0.5 });
}

// ───────────── Crystal Cage: a ring of crystal spires ─────────────
function novaWindup(
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
    sq = 0.82;
  fx.floorSolid
    .fillStyle(color, 0.08 + k * 0.12)
    .fillEllipse(x, y, r * 2, r * 2 * sq);
  fx.floorSolid.lineStyle(2, color, 0.7).strokeEllipse(x, y, r * 2, r * 2 * sq);
  fx.floor
    .lineStyle(3, GLASS, 0.5 + k * 0.4)
    .strokeEllipse(x, y, r * 2 * k, r * 2 * sq * k);
  // Crystals grow out of the rim as the charge builds.
  for (let i = 0; i < 12; i++) {
    const aa = (i * TAU) / 12 + now / 3000,
      px = x + Math.cos(aa) * r,
      py = y + Math.sin(aa) * r * sq,
      h = 6 + k * 22;
    fx.solid
      .fillStyle(color, 0.9)
      .fillTriangle(px - 5, py, px + 5, py, px, py - h);
    fx.solid
      .fillStyle(GLASS, 0.9)
      .fillTriangle(px - 1.5, py, px + 3, py, px, py - h * 0.85);
  }
  fx.glow(x, y - 14, 30 + k * 50, color, 0.4 + k * 0.4);
}
/** Crystal Cage rises: spikes punch up all round the ring at once. */
function cageCast(
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
    sq = 0.82;
  for (let i = 0; i < 8; i++) {
    const aa = (i * TAU) / 8;
    shards(fx, x + Math.cos(aa) * r, y + Math.sin(aa) * r * sq, 5, color, {
      power: 1,
    });
  }
  fx.decal({ kind: "glyph", x, y, r: r * 0.95, color, life: 3 });
  fx.shake(200, 0.005);
  shot(fx.reduced ? 200 : 520, (k) => {
    const fade = 1 - k;
    if (k < 0.15) fx.glow(x, y - 14, r * 0.7, GLASS, 0.7 * (1 - k / 0.15));
    [PINK, CYAN, GOLD].forEach((c, i) =>
      fx.shockwave(x, y, r * (1 - i * 0.03), k, c, 6 * fade + 1),
    );
  });
}
/**
 * Crystal Cage: a ring of faceted spires round where it rose, for as long as
 * it stands; they crack and fall in the last moments.
 */
function crystalCage(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    r = z.radius,
    sq = 0.82,
    color = z.color,
    rise = ease(Math.min(1, progress * 12)),
    fall = progress > 0.88 ? 1 - (progress - 0.88) / 0.12 : 1;
  fx.floor
    .lineStyle(10, INK, 0.25 * fall)
    .strokeEllipse(z.x, z.y, r * 2, r * 2 * sq);
  fx.floor
    .lineStyle(3, color, 0.7 * fall)
    .strokeEllipse(z.x, z.y, r * 2, r * 2 * sq);
  const n = Math.max(14, Math.round(r / 11));
  // Back spires first, so the front ones overlap them.
  const spires = Array.from({ length: n }, (_, i) => (i * TAU) / n).sort(
    (m, k) => Math.sin(m) - Math.sin(k),
  );
  for (const aa of spires) {
    const i = Math.round((aa / TAU) * n),
      px = z.x + Math.cos(aa) * r,
      py = z.y + Math.sin(aa) * r * sq,
      h = (34 + hash(i) * 22) * rise * fall,
      w = 9 + hash(i * 7) * 4;
    if (h <= 1) continue;
    fx.solid
      .fillStyle(0x000000, 0.18)
      .fillEllipse(px + 4, py + 2, w * 2.4, w * 0.9);
    fx.solid
      .fillStyle(INK, 0.5)
      .fillTriangle(px - w - 2, py + 2, px + w + 2, py + 2, px, py - h - 3);
    fx.solid
      .fillStyle(color, 1)
      .fillTriangle(px - w, py, px, py + 3, px, py - h);
    fx.solid
      .fillStyle(GLASS, 1)
      .fillTriangle(px, py + 3, px + w, py, px, py - h);
    fx.g
      .fillStyle(0xffffff, 0.5 + 0.3 * Math.sin(now / 240 + i))
      .fillTriangle(px + 1, py - 3, px + 4, py - 5, px, py - h + 4);
  }
  if (progress > 0.88)
    fx.trail(`cage-${z.id}`, 999, () =>
      shards(fx, z.x, z.y, 24, color, { power: 1.4 }),
    );
}

// ───────────── Hits ─────────────
function auraHit(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  shards(fx, x, y, 8, color, { power: 0.8 });
  shot(fx.reduced ? 140 : 300, (k) => {
    fx.glow(x, y - 18, 36 * (1 - k * 0.4), color, 0.6 * (1 - k));
    const s = 18 * (1 - k * 0.5);
    fx.g.lineStyle(2, GLASS, 1 - k).strokePoints(
      Array.from({ length: 6 }, (_, j) => ({
        x: x + Math.cos(j * (TAU / 6)) * s,
        y: y - 18 + Math.sin(j * (TAU / 6)) * s,
      })),
      true,
    );
  });
}

// ───────────── Halcyra: a kingfisher marksman with a crystal beak ─────────────
const KING = 0xff9a4a;
const SQ = 0.82;
/** Beams fly at chest height above the ground line the server traces. */
const LIFT = 14;
/** A feather of aura: dark outline, coloured vane, glassy shaft. */
function feather(
  fx: Fx,
  x: number,
  y: number,
  len: number,
  w: number,
  dir: number,
  color: number,
  alpha = 1,
) {
  const c = Math.cos(dir),
    s = Math.sin(dir),
    p = (f: number, side: number) => ({
      x: x + c * len * f - s * w * side,
      y: y + s * len * f + c * w * side,
    });
  const vane = [
    p(0.5, 0),
    p(0.25, 0.85),
    p(-0.15, 1),
    p(-0.42, 0.55),
    p(-0.36, 0),
    p(-0.42, -0.55),
    p(-0.15, -1),
    p(0.25, -0.85),
  ];
  fx.solid.fillStyle(INK, 0.45 * alpha).fillPoints(
    vane.map((q) => ({ x: x + (q.x - x) * 1.15, y: y + (q.y - y) * 1.15 })),
    true,
  );
  fx.solid.fillStyle(color, 0.95 * alpha).fillPoints(vane, true);
  fx.solid
    .fillStyle(GLASS, 0.55 * alpha)
    .fillTriangle(
      vane[0].x,
      vane[0].y,
      vane[1].x,
      vane[1].y,
      vane[2].x,
      vane[2].y,
    );
  const tail = p(-0.62, 0),
    tip = p(0.5, 0);
  fx.solid
    .lineStyle(1.5, 0xffffff, 0.9 * alpha)
    .lineBetween(tail.x, tail.y, tip.x, tip.y);
  // Barbs.
  for (const f of [-0.05, 0.15]) {
    const b = p(f, 0);
    for (const side of [-1, 1]) {
      const e = p(f - 0.18, side * 0.8);
      fx.solid.lineStyle(1, INK, 0.35 * alpha).lineBetween(b.x, b.y, e.x, e.y);
    }
  }
}
/** How far along its range a shot has flown (0 → 1): its far-range bonus. */
function flown(pr: Projectile) {
  const a = pr.ability,
    left = Number.isFinite(pr.remaining) ? pr.remaining : a.range;
  return Math.max(0, Math.min(1, 1 - left / Math.max(1, a.range)));
}

// ───────────── Aura Quill and Pinning Quill ─────────────
function auraQuill(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    a = pr.ability,
    r = a.radius,
    c = pr.color,
    dir = Math.atan2(pr.vy, pr.vx),
    hover = 14,
    x = pr.x,
    y = pr.y - hover,
    pin = a.id === "pinning-quill",
    // Shots with a far-range bonus burn brighter the farther they fly.
    f = a.farBonus ? flown(pr) : 0.5,
    tail = 60 + f * 90,
    tx = x - Math.cos(dir) * tail,
    ty = y - Math.sin(dir) * tail;
  fx.solid
    .fillStyle(0x000000, 0.16)
    .fillEllipse(pr.x, pr.y + 4, r * 2.2, r * 0.6);
  fx.g
    .lineStyle(r * (1 + f * 0.8), c, 0.16 + f * 0.2)
    .lineBetween(tx, ty, x, y);
  prismLine(
    fx,
    x - Math.cos(dir) * tail * 0.7,
    y - Math.sin(dir) * tail * 0.7,
    x,
    y,
    1.5,
    0.3 + f * 0.4,
  );
  fx.glow(x, y, r * (2.4 + f * 2.4), c, 0.3 + f * 0.35);
  feather(fx, x, y, r * (pin ? 4.6 : 4), r * (pin ? 1 : 0.95), dir, c);
  if (pin) {
    // The crystal point and a band of kingfisher orange.
    const bx = x - Math.cos(dir) * r * 0.9,
      by = y - Math.sin(dir) * r * 0.9;
    fx.solid
      .lineStyle(3, KING, 0.95)
      .lineBetween(
        bx - Math.sin(dir) * r * 0.75,
        by + Math.cos(dir) * r * 0.75,
        bx + Math.sin(dir) * r * 0.75,
        by - Math.cos(dir) * r * 0.75,
      );
    gem(
      fx,
      x + Math.cos(dir) * r * 2.4,
      y + Math.sin(dir) * r * 2.4,
      r * 0.45,
      GLASS,
      dir,
    );
  }
  if (f > 0.55) {
    const s = r * (1 + f * 1.4);
    fx.g
      .lineStyle(1.5, 0xffffff, (f - 0.55) * 1.8)
      .lineBetween(x - s, y, x + s, y)
      .lineBetween(x, y - s * 0.5, x, y + s * 0.5);
  }
  fx.trail(`aq${pr.id}`, 0.04, () =>
    fx.burst({
      x,
      y: pr.y,
      z: hover,
      count: 1,
      kind: "mote",
      color: [c, CYAN, pin ? KING : PINK],
      speed: [10, 40],
      up: [-10, 20],
      life: [0.25, 0.5],
      size: [1, 1.6],
      drag: 2,
    }),
  );
  void now;
}
function quillImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    pin = a.id === "pinning-quill",
    r = a.radius;
  shards(fx, x, y, pin ? 10 : 5, color, { power: pin ? 0.9 : 0.6 });
  fx.burst({
    x,
    y,
    z: 18,
    count: pin ? 5 : 3,
    kind: "mote",
    color: [color, KING, GLASS],
    speed: [20, 70],
    up: [20, 60],
    life: [0.6, 1],
    size: [1.4, 2.2],
    grav: 60,
    drag: 2,
  });
  const lean = hash(x + y) * 0.6 - 0.3;
  shot(fx.reduced ? 160 : pin ? 640 : 260, (k) => {
    fx.glow(x, y - 12, r * 3.4 * (1 - k * 0.4), color, 0.6 * (1 - k));
    fx.shockwave(x, y, r * 3 * ease(Math.min(1, k * 2)), k, CYAN, 4);
    if (pin) {
      // The quill stays pinned in the floor for a moment, rings closing on it.
      const fade = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      feather(
        fx,
        x,
        y - r * 1.6,
        r * 4.2,
        r * 0.9,
        -Math.PI / 2 + lean,
        color,
        fade,
      );
      for (let i = 0; i < 2; i++) {
        const rr = r * (3.2 - i * 1.1) * (1 - ease(Math.min(1, k * 2)) * 0.45);
        fx.floor
          .lineStyle(2, i ? KING : color, 0.8 * fade)
          .strokeEllipse(x, y, rr * 2, rr * 2 * SQ);
      }
    }
  });
}

// ───────────── Focus Shot: the visor locks on, then an instant beam ─────────────
function focusWindup(
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
    cos = Math.cos(angle),
    sin = Math.sin(angle),
    lance = a.id === "skyline-lance",
    sy = y - LIFT,
    len = a.range,
    ex = x + cos * len,
    ey = sy + sin * len,
    nx = -sin * a.radius,
    ny = cos * a.radius,
    bx = x + cos * 22,
    by = sy + sin * 22;
  // The real lane: as wide as the beam, out to its full range.
  g.lineStyle(a.radius * 2, color, 0.05 + k * 0.1).lineBetween(x, sy, ex, ey);
  g.lineStyle(1.5, color, 0.25 + k * 0.45)
    .lineBetween(x + nx, sy + ny, ex + nx, ey + ny)
    .lineBetween(x - nx, sy - ny, ex - nx, ey - ny);
  // The sight line from the crystal beak, steadying as it locks.
  const jitter = ((1 - k) * 0.4 * a.radius * Math.sin(now / 37)) / len;
  fx.g
    .lineStyle(1.2, k > 0.85 ? 0xffffff : CYAN, 0.35 + k * 0.5)
    .lineBetween(
      bx,
      by,
      x + Math.cos(angle + jitter) * len,
      sy + Math.sin(angle + jitter) * len,
    );
  // Focus brackets sliding out along the lane.
  for (let i = 0; i < 3; i++) {
    const t = ((now / (lance ? 700 : 450) + i / 3) % 1) * (0.3 + k * 0.7),
      px = x + cos * len * t,
      py = sy + sin * len * t;
    fx.g
      .lineStyle(2, GLASS, 0.6 * k * (1 - t))
      .lineBetween(
        px + nx * 1.4,
        py + ny * 1.4,
        px + nx * 1.4 + cos * 10,
        py + ny * 1.4 + sin * 10,
      )
      .lineBetween(
        px - nx * 1.4,
        py - ny * 1.4,
        px - nx * 1.4 + cos * 10,
        py - ny * 1.4 + sin * 10,
      );
  }
  // The visor lens: rings closing on the beak.
  const rr = (lance ? 46 : 30) * (1.4 - k);
  fx.g.lineStyle(2, color, 0.5 + k * 0.4).strokeEllipse(bx, by, rr * 2, rr * 2);
  fx.g
    .lineStyle(1.5, KING, 0.4 + k * 0.4)
    .strokeEllipse(bx, by, rr * 1.2, rr * 1.2);
  fx.glow(
    bx,
    by,
    (lance ? 30 : 16) + k * (lance ? 60 : 26),
    color,
    0.45 + k * 0.45,
  );
  fx.glow(bx, by, 6 + k * (lance ? 16 : 8), 0xffffff, 0.6 + k * 0.4);
  if (lance) {
    // Skyline Lance: wings of light open and aura pours into the beak.
    for (const side of [-1, 1]) {
      const pts = Array.from({ length: 9 }, (_, j) => {
        const t = j / 8,
          aa = angle + Math.PI + side * (0.6 + t * 1.3 * (0.4 + k * 0.6)),
          d = 30 + t * 50 * (0.5 + k * 0.5);
        return {
          x: x + Math.cos(aa) * d,
          y: sy - 10 + Math.sin(aa) * d * 0.6 - t * 18 * k,
        };
      });
      fx.g.lineStyle(4 + k * 4, color, 0.3 + k * 0.4).strokePoints(pts, false);
      fx.g.lineStyle(1.5, GLASS, 0.5 + k * 0.4).strokePoints(pts, false);
    }
    fx.trail(`sl${Math.round(x)}${Math.round(y)}`, 0.03, () => {
      for (let i = 0; i < 2; i++) {
        const aa = Math.random() * TAU,
          d = 70 + Math.random() * 40;
        fx.burst({
          x: bx + Math.cos(aa) * d,
          y: by + LIFT + Math.sin(aa) * d * 0.6,
          z: LIFT,
          count: 1,
          kind: "spark",
          color: [color, CYAN, PINK],
          angle: aa + Math.PI,
          spread: 0.05,
          speed: [d * 2.6, d * 3],
          life: [0.3, 0.34],
          size: [1, 1.6],
          drag: 0.4,
        });
      }
    });
    if (k > 0.8)
      fx.g
        .lineStyle(2, 0xffffff, (k - 0.8) * 4)
        .lineBetween(x + nx, sy + ny, ex + nx, ey + ny)
        .lineBetween(x - nx, sy - ny, ex - nx, ey - ny);
  }
}
function focusShot(
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
    sy = y - LIFT,
    ey = ty - LIFT,
    len = Math.hypot(tx - x, ty - y),
    dir = Math.atan2(ty - y, tx - x),
    // The beam pays more the farther it reaches: show it at the far end.
    f = Math.min(1, len / Math.max(1, a.range)),
    w = a.radius * 2;
  shards(fx, tx, ty, 6 + Math.round(f * 8), color, {
    angle: dir,
    spread: 0.8,
    power: 0.7 + f * 0.6,
  });
  if (f > 0.6) fx.shake(90, 0.0025);
  shot(fx.reduced ? 160 : 340, (k) => {
    const fade = 1 - k,
      ww = w * (1 - k * 0.6);
    fx.g.lineStyle(ww * 1.8, color, 0.22 * fade).lineBetween(x, sy, tx, ey);
    fx.g.lineStyle(ww, color, 0.6 * fade).lineBetween(x, sy, tx, ey);
    prismLine(fx, x, sy, tx, ey, 1.5, 0.7 * fade);
    fx.g
      .lineStyle(Math.max(1, ww * 0.25), 0xffffff, fade)
      .lineBetween(x, sy, tx, ey);
    // Lens rings along the beam, swelling toward the far end.
    for (let d = 60; d < len; d += 90) {
      const t = d / len,
        px = x + Math.cos(dir) * d,
        py = sy + Math.sin(dir) * d,
        s = a.radius * (0.8 + t * f * 0.8) * (1 + k * 0.8);
      fx.g
        .lineStyle(1.5, GLASS, 0.6 * fade * t)
        .strokeEllipse(px, py, s * 0.7, s * 2);
    }
    fx.glow(
      x + Math.cos(dir) * 22,
      sy + Math.sin(dir) * 22,
      26 * fade,
      color,
      0.8 * fade,
    );
    const flare = a.radius * (1.6 + f * 2.4);
    fx.glow(tx, ey, flare * (1 - k * 0.4), color, (0.5 + f * 0.4) * fade);
    fx.glow(tx, ey, flare * 0.45, 0xffffff, Math.max(0, 1 - k * 2.2));
    fx.g
      .lineStyle(2, 0xffffff, (0.4 + f * 0.6) * fade)
      .lineBetween(tx - flare, ey, tx + flare, ey)
      .lineBetween(tx, ey - flare * 0.5, tx, ey + flare * 0.5);
  });
}

// ───────────── Halcyon Rewind: back to where it was ─────────────
/** Where Halcyra leaves from: a ripple of feathers folding back in time. */
function rewindCast(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  _angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    cy = y - 20;
  fx.burst({
    x,
    y,
    z: 24,
    count: 10,
    kind: "mote",
    color: [color, KING, GLASS],
    speed: [30, 90],
    up: [10, 50],
    life: [0.6, 1],
    size: [1.5, 2.5],
    grav: 50,
    drag: 2,
  });
  shot(fx.reduced ? 200 : 480, (k) => {
    const fade = 1 - k;
    // Clock-hand ripples turning backwards.
    for (let i = 0; i < 3; i++) {
      const kk = (k * 1.5 + i * 0.25) % 1,
        a0 = -k * 6 - i;
      fx.g
        .lineStyle(2, i % 2 ? CYAN : KING, 0.7 * fade * (1 - kk))
        .beginPath()
        .arc(x, cy, 22 + kk * 30, a0, a0 + Math.PI * 1.3)
        .strokePath();
    }
    fx.glow(x, cy, 40, color, 0.35 * fade);
  });
}
/** Where Halcyra lands: a burst of light and a healing shimmer. */
function rewindLand(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    cy = y - 20;
  fx.burst({
    x,
    y: cy,
    z: 10,
    count: 8,
    kind: "mote",
    color: [0x7dffb0, GLASS],
    speed: [20, 60],
    up: [60, 110],
    life: [0.6, 1],
    size: [1.5, 2.4],
    drag: 2,
  });
  shot(fx.reduced ? 200 : 420, (k) => {
    fx.glow(x, cy, 50 * (1 - k * 0.4), color, 0.55 * (1 - k));
    fx.g
      .lineStyle(3 * (1 - k) + 1, GLASS, 0.8 * (1 - k))
      .strokeCircle(x, cy, 10 + k * 30);
  });
}

// ───────────── Skyline Lance (ultimate): a lance of aura across the court ─────────────
function skylineLance(
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
    sy = y - LIFT,
    ey = ty - LIFT,
    len = Math.hypot(tx - x, ty - y),
    dir = Math.atan2(ty - y, tx - x),
    cos = Math.cos(dir),
    sin = Math.sin(dir),
    w = a.radius * 2;
  fx.ultimate(color, 900);
  fx.shake(280, 0.007);
  shards(fx, tx, ty, 24, color, { angle: dir, spread: 1.2, power: 1.6 });
  fx.decal({ kind: "scorch", x: tx, y: ty, r: a.radius * 1.6, color, life: 4 });
  fx.burst({
    x: x + cos * 24,
    y: y + sin * 24,
    z: LIFT,
    count: 20,
    kind: "spark",
    color: [color, GLASS, CYAN],
    angle: dir + Math.PI,
    spread: 0.9,
    speed: [120, 360],
    up: [20, 160],
    life: [0.3, 0.6],
    size: [1, 1.8],
    grav: 600,
  });
  shot(fx.reduced ? 260 : 760, (k) => {
    const fire = Math.min(1, k / 0.08),
      fade = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5,
      ww = w * (k < 0.5 ? 1 : 1 - (k - 0.5) * 1.6),
      reach = len * ease(fire);
    const ex = x + cos * reach,
      eyy = sy + sin * reach;
    // Soft light pooled under and around the whole length.
    for (let d = 0; d <= reach; d += 90) {
      fx.glow(
        x + cos * d,
        y + sin * d,
        a.radius * 2.2,
        color,
        0.3 * fade,
        true,
      );
      fx.glow(x + cos * d, sy + sin * d, a.radius * 1.8, color, 0.28 * fade);
    }
    fx.g.lineStyle(ww * 1.7, color, 0.25 * fade).lineBetween(x, sy, ex, eyy);
    fx.g.lineStyle(ww, color, 0.7 * fade).lineBetween(x, sy, ex, eyy);
    prismLine(fx, x, sy, ex, eyy, 2.5, 0.8 * fade);
    fx.g
      .lineStyle(Math.max(1.5, ww * 0.35), 0xffffff, fade)
      .lineBetween(x, sy, ex, eyy);
    // Shock rings racing down the lance.
    for (let i = 0; i < 6; i++) {
      const t = (k * 2.2 + i / 6) % 1,
        px = x + cos * reach * t,
        py = sy + sin * reach * t,
        s = w * (0.8 + t * 0.6);
      fx.g
        .lineStyle(2, i % 2 ? GLASS : KING, 0.7 * fade)
        .strokeEllipse(px, py, s * 0.55, s * 1.6);
    }
    // Muzzle: a horizon-wide flare from the crystal beak.
    const mx = x + cos * 22,
      my = sy + sin * 22;
    fx.glow(mx, my, w * 2 * fade, color, 0.9 * fade);
    fx.glow(mx, my, w * 0.8, 0xffffff, fade);
    fx.g
      .lineStyle(3, 0xffffff, 0.7 * Math.max(0, 1 - k * 2))
      .lineBetween(mx - 260, my, mx + 260, my);
    // Where it stops: a burst the width of the lance.
    if (fire >= 1) {
      fx.glow(tx, ey, w * 2.2 * (1 - k * 0.3), color, 0.8 * fade);
      fx.glow(tx, ey, w * 0.9, 0xffffff, Math.max(0, 1 - k * 2));
      fx.shockwave(tx, ty, w * 1.6 * ease(Math.min(1, k * 2)), k, CYAN, 10);
    }
  });
}

export const auraKit: FxKit = {
  projectile: {
    "prism-shot": prismShot,
    "aura-quill": auraQuill,
    "pinning-quill": auraQuill,
  },
  zone: { "crystal-cage": crystalCage },
  windup: {
    "crystal-cage": novaWindup,
    "focus-shot": focusWindup,
    "skyline-lance": focusWindup,
  },
  cast: {
    "prism-jab": prismJab,
    "shatter-paw": shatterPalm,
    "facet-guard": mirrorGuard,
    "crystal-cage": cageCast,
    "halcyon-rewind": rewindCast,
  },
  impact: {
    "prism-shot": prismImpact,
    "aura-quill": quillImpact,
    "pinning-quill": quillImpact,
    "halcyon-rewind": rewindLand,
  },
  beam: { "focus-shot": focusShot, "skyline-lance": skylineLance },
  hit: { aura: auraHit },
};
