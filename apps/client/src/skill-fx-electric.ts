import type Phaser from "phaser";
import type { Ability, Projectile, Zone } from "@arena/shared";
import { fxFor } from "./fx-engine";
import type { FxKit, Shot } from "./fx-kits";
/**
 * Voltkit's kit: plasma, branching arcs and real light. Every size still comes
 * from the shared ability (radius, range, explosion), so what players see
 * matches what can hit them.
 */
type G = Phaser.GameObjects.Graphics;
const TAU = Math.PI * 2;
const WHITE = 0xffffff;
const PALE = 0xfff6c2;
const BLUE = 0x9fe8ff;
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const ease = (k: number) => 1 - (1 - k) ** 3;

// ───────────── Projectiles ─────────────
export function electricProjectile(g: G, pr: Projectile, now: number): boolean {
  const fx = fxFor(g.scene),
    a = pr.ability,
    c = pr.color,
    r = a.radius,
    dir = Math.atan2(pr.vy, pr.vx),
    cos = Math.cos(dir),
    sin = Math.sin(dir),
    x = pr.x,
    y = pr.y;
  if (a.id === "spark-dart") {
    const bx = x - cos * 48,
      by = y - sin * 48;
    fx.glow(x, y, r * 3.6, c, 0.4);
    fx.solid.fillStyle(0x1b1638, 0.35).fillCircle(x, y, r * 0.95);
    fx.solid.fillStyle(c, 1).fillCircle(x, y, r * 0.75);
    fx.bolt(bx, by, x, y, c, { width: 1.8, jag: 0.28, depth: 3, seed: pr.id * 7 + Math.floor(now / 40) });
    fx.g.fillStyle(WHITE, 1).fillCircle(x, y, r * 0.45);
    fx.glow(x, y + 26, r * 2.4, c, 0.18, true);
    fx.trail(`p${pr.id}`, 0.035, () =>
      fx.burst({ x: x - cos * 8, y, z: 0, count: 1, kind: "mote", color: [c, PALE], speed: [20, 70], life: [0.12, 0.25], size: [1, 1.8], drag: 4 }),
    );
    return true;
  }
  if (a.id === "static-lance") {
    const len = 96,
      bx = x - cos * len,
      by = y - sin * len,
      seed = pr.id * 13 + Math.floor(now / 35);
    // Ionised channel behind the tip.
    fx.g.lineStyle(r * 1.6, c, 0.14).lineBetween(x - cos * len * 0.8, y - sin * len * 0.8, x, y);
    fx.g.lineStyle(r * 1.1, c, 0.32).lineBetween(x - cos * len * 0.6, y - sin * len * 0.6, x, y);
    fx.bolt(bx, by, x, y, c, { width: 2.6, jag: 0.16, branches: 1, seed });
    fx.bolt(bx, by, x, y, BLUE, { width: 1.4, jag: 0.22, seed: seed + 50, alpha: 0.7 });
    fx.glow(x, y, r * 4.6, c, 0.45);
    fx.glow(x, y, r * 1.5, PALE, 0.6);
    fx.solid.fillStyle(0x1b1638, 0.35).fillCircle(x, y, r * 1.05);
    fx.solid.fillStyle(c, 1).fillCircle(x, y, r * 0.85);
    // Lens flare cross on the white-hot tip.
    const f = r * (4.5 + hash(seed) * 1.5);
    fx.g.lineStyle(2, WHITE, 0.7).lineBetween(x - f, y, x + f, y).lineBetween(x, y - f * 0.45, x, y + f * 0.45);
    fx.g.fillStyle(WHITE, 1).fillCircle(x, y, r * 0.55);
    fx.glow(x, y + 30, r * 3.5, c, 0.22, true);
    fx.trail(`p${pr.id}`, 0.022, () =>
      fx.burst({
        x: x - cos * 14, y, z: 10, count: 2, kind: "spark", color: [c, PALE],
        angle: dir + Math.PI, spread: 0.7, speed: [90, 240], up: [40, 160], life: [0.25, 0.45], size: [1, 1.6], grav: 900, drag: 2.5,
      }),
    );
    return true;
  }
  if (a.id === "ball-lightning") {
    const bob = Math.sin(now / 140 + pr.id) * 3,
      oy = y - 10 + bob,
      seed = pr.id * 17 + Math.floor(now / 55);
    // Shadow and light on the floor below a hovering orb.
    fx.solid.fillStyle(0x000000, 0.22).fillEllipse(x, y + 20, r * 2.2, r * 0.8);
    fx.glow(x, y + 20, r * 3.4, c, 0.35, true);
    fx.glow(x, oy, r * 3.2, c, 0.32);
    // Plasma body: a solid, shaded sphere so it reads on any floor.
    fx.solid.fillStyle(0x2a1d52, 0.45).fillCircle(x, oy, r * 1.08);
    fx.solid.fillStyle(c, 0.85).fillCircle(x, oy, r);
    fx.solid.fillStyle(PALE, 0.9).fillCircle(x - r * 0.12, oy - r * 0.12, r * 0.62);
    fx.solid.fillStyle(WHITE, 1).fillCircle(x - r * 0.18, oy - r * 0.18, r * 0.3);
    fx.g.lineStyle(2, BLUE, 0.6).strokeCircle(x, oy, r * (1 + Math.sin(now / 60) * 0.06));
    // Plasma surface: arcs leap from the core to the edge and beyond.
    for (let i = 0; i < 4; i++) {
      const ang = hash(seed + i * 3) * TAU,
        reach = r * (1.05 + hash(seed - i) * 0.9);
      fx.bolt(x, oy, x + Math.cos(ang) * reach, oy + Math.sin(ang) * reach, c, { width: 1.6, jag: 0.4, depth: 3, seed: seed + i * 7 });
    }
    // Every so often an arc grounds itself, scattering sparks on the floor.
    if (hash(Math.floor(now / 220) + pr.id) > 0.55) {
      const gx = x + (hash(seed) - 0.5) * r * 3,
        gy = y + 22 + hash(seed + 1) * 10;
      fx.bolt(x, oy + r * 0.6, gx, gy, c, { width: 1.4, jag: 0.35, depth: 3, seed });
      fx.trail(`g${pr.id}${Math.floor(now / 220)}`, 1, () =>
        fx.burst({ x: gx, y: gy, count: 5, kind: "spark", color: [c, WHITE], speed: [40, 140], up: [60, 200], life: [0.2, 0.4], size: [1, 1.5], grav: 900 }),
      );
    }
    fx.trail(`p${pr.id}`, 0.04, () =>
      fx.burst({ x, y, z: 10 - bob, count: 1, kind: "mote", color: [c, BLUE], speed: [10, 40], up: [10, 40], life: [0.3, 0.6], size: [1, 2], drag: 2 }),
    );
    return true;
  }
  return false;
}

// ───────────── Storm Grid ─────────────
export function stormGrid(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    c = z.color,
    r = z.radius,
    x = z.x,
    y = z.y,
    fade = progress > 0.85 ? (1 - progress) / 0.15 : 1,
    born = Math.min(1, progress / 0.06),
    seed = Math.floor(now / 90) + z.id;
  // The strike that lays the grid: a bolt from the sky, once.
  if (progress < 0.07) {
    const k = progress / 0.07;
    fx.bolt(x + 20, y - 520, x, y, WHITE, { width: 5 * (1 - k) + 1, jag: 0.12, branches: 3, seed: z.id * 5 });
    fx.glow(x, y, r * 2.2 * (1 - k * 0.5), PALE, 1 - k);
    fx.trail(`zs${z.id}`, 999, () => {
      fx.burst({ x, y, count: 34, kind: "spark", color: [c, WHITE, PALE], speed: [120, 420], up: [120, 420], life: [0.35, 0.8], size: [1.2, 2], grav: 1000, drag: 1.5 });
      fx.decal({ kind: "scorch", x, y, r: r * 0.45, color: c, life: 4.6 });
      fx.shake(140, 0.003);
    });
  }
  // Charged floor: dark base, glowing lattice and a live rim.
  g.fillStyle(0x0d1430, 0.28 * fade * born).fillEllipse(x, y, r * 2, r * 2 * 0.82);
  fx.glow(x, y, r * 1.15, c, 0.22 * fade, true);
  const sq = 0.82,
    lines = 6;
  fx.floor.lineStyle(1.5, c, 0.38 * fade * born);
  for (let i = 1; i < lines; i++) {
    const o = -r + (2 * r * i) / lines,
      h = Math.sqrt(Math.max(0, r * r - o * o));
    fx.floor.lineBetween(x + o, y - h * sq, x + o, y + h * sq);
    fx.floor.lineBetween(x - h, y + o * sq, x + h, y + o * sq);
  }
  // Current pulses running along the lattice.
  for (let i = 0; i < 8; i++) {
    const row = (i % (lines - 1)) + 1,
      o = -r + (2 * r * row) / lines,
      h = Math.sqrt(Math.max(0, r * r - o * o)),
      t = ((now / 700 + hash(z.id + i)) % 1) * 2 - 1,
      vertical = i % 2 === 0;
    const px = vertical ? x + o : x + t * h,
      py = vertical ? y + t * h * sq : y + o * sq;
    fx.floor.fillStyle(WHITE, 0.85 * fade).fillCircle(px, py, 2.2);
    fx.glow(px, py, 16, c, 0.6 * fade, true);
  }
  fx.floor.lineStyle(3, c, 0.8 * fade).strokeEllipse(x, y, r * 2, r * 2 * sq);
  // Six pylons on the rim, arcing to each other and into the field.
  const nodes = Array.from({ length: 6 }, (_, i) => {
    const a = (i * TAU) / 6 + now / 2400;
    return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * sq };
  });
  for (const n of nodes) {
    fx.glow(n.x, n.y, 22, c, 0.75 * fade, true);
    fx.floor.fillStyle(WHITE, 0.9 * fade).fillCircle(n.x, n.y, 3);
  }
  for (let i = 0; i < 3; i++) {
    const a = Math.floor(hash(seed + i) * 6),
      b = hash(seed - i) > 0.5 ? (a + 1) % 6 : (a + 3) % 6;
    fx.bolt(nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y, c, { width: 1.8, jag: 0.25, seed: seed + i * 11, alpha: fade, onFloor: true });
  }
  // Static lifting off the ground.
  fx.trail(`zm${z.id}`, 0.05, () => {
    const a = Math.random() * TAU,
      d = Math.sqrt(Math.random()) * r;
    fx.burst({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * sq, count: 1, kind: "mote", color: [c, BLUE, WHITE], speed: [0, 15], up: [40, 110], life: [0.5, 1], size: [1, 1.8], drag: 1.5 });
  });
}

// ───────────── Overcharge ─────────────
/** Wind-up: energy pours into Voltkit while the real blast area is marked. */
export function overchargeWindup(g: G, a: Ability, x: number, y: number, color: number, k: number, now: number) {
  const fx = fxFor(g.scene),
    r = a.radius,
    cy = y - 10;
  g.fillStyle(color, 0.06 + k * 0.1).fillEllipse(x, y, r * 2, r * 2 * 0.82);
  g.lineStyle(2, color, 0.75).strokeEllipse(x, y, r * 2, r * 2 * 0.82);
  fx.floor.lineStyle(3, PALE, 0.4 + k * 0.5).strokeEllipse(x, y, r * 2 * (1 - k * 0.85), r * 2 * 0.82 * (1 - k * 0.85));
  fx.glow(x, cy, 30 + k * 70, color, 0.35 + k * 0.5);
  fx.glow(x, cy, 12 + k * 20, WHITE, 0.6 + k * 0.4);
  const seed = Math.floor(now / 45);
  for (let i = 0; i < 2 + Math.floor(k * 4); i++) {
    const ang = hash(seed + i * 5) * TAU;
    fx.bolt(x + Math.cos(ang) * r * 0.95, y + Math.sin(ang) * r * 0.78, x, cy, color, { width: 1.4, jag: 0.3, seed: seed + i, alpha: 0.4 + k * 0.5 });
  }
  fx.trail(`oc${Math.round(x)}${Math.round(y)}`, 0.02, () => {
    for (let i = 0; i < 3; i++) {
      const ang = Math.random() * TAU,
        d = r * (0.7 + Math.random() * 0.3);
      fx.burst({ x: x + Math.cos(ang) * d, y: y + Math.sin(ang) * d * 0.82, z: 10, count: 1, kind: "spark", color: [color, PALE], angle: ang + Math.PI, spread: 0.05, speed: [d * 2.4, d * 3], life: [0.3, 0.36], size: [1, 1.6], drag: 0.5 });
    }
  });
}

export function overchargeBurst(scene: Phaser.Scene, a: Ability, x: number, y: number, color: number, shot: (ms: number, draw: (k: number) => void) => void) {
  const fx = fxFor(scene),
    r = a.radius,
    cy = y - 10;
  fx.burst({ x, y, z: 10, count: 70, kind: "spark", color: [color, WHITE, PALE], speed: [260, 720], up: [80, 420], life: [0.4, 0.9], size: [1.2, 2.2], grav: 1000, drag: 1.6 });
  fx.burst({ x, y, z: 10, count: 22, kind: "mote", color: [color, BLUE], speed: [80, 260], up: [20, 120], life: [0.6, 1.2], size: [1.2, 2.4], drag: 2 });
  fx.decal({ kind: "scorch", x, y, r: r * 0.5, color, life: 5 });
  fx.decal({ kind: "crack", x, y, r: r * 0.95, color, life: 4 });
  fx.shake(240, 0.006);
  shot(fx.reduced ? 200 : 620, (k) => {
    const flash = Math.max(0, 1 - k / 0.14);
    fx.glow(x, cy, r * 0.8, PALE, 0.6 * flash);
    fx.glow(x, cy, r * 1.1, color, 0.6 * (1 - k));
    fx.glow(x, y, r * 1.2, color, 0.6 * (1 - k), true);
    fx.shockwave(x, y, r * ease(Math.min(1, k * 1.8)), k, color, 14);
    if (k > 0.12) fx.shockwave(x, y, r * 0.75 * ease(Math.min(1, (k - 0.12) * 2)), k, PALE, 8);
    const seed = Math.floor((k * 620) / 40);
    for (let i = 0; i < 9; i++) {
      const ang = (i * TAU) / 9 + hash(i + 3) * 0.5,
        reach = r * Math.min(1, 0.3 + k * 2.4);
      fx.bolt(x, cy, x + Math.cos(ang) * reach, y + Math.sin(ang) * reach * 0.82, color, {
        width: 2.6 * (1 - k) + 0.6, jag: 0.24, branches: 2, seed: seed * 19 + i, alpha: 1 - k * 0.9,
      });
    }
  });
}

// ───────────── Ball Lightning burst, casts and hits ─────────────
export function ballLightningImpact(scene: Phaser.Scene, a: Ability, x: number, y: number, color: number, shot: (ms: number, draw: (k: number) => void) => void) {
  const fx = fxFor(scene),
    blast = a.explosion ?? 100;
  fx.burst({ x, y, z: 12, count: 44, kind: "spark", color: [color, WHITE, PALE], speed: [180, 520], up: [80, 360], life: [0.35, 0.8], size: [1.2, 2], grav: 1000, drag: 1.8 });
  fx.decal({ kind: "scorch", x, y, r: blast * 0.55, color, life: 4 });
  fx.shake(130, 0.0035);
  shot(fx.reduced ? 200 : 480, (k) => {
    fx.glow(x, y - 10, blast * 1.2, PALE, 0.8 * Math.max(0, 1 - k / 0.16));
    fx.glow(x, y - 10, blast, color, 0.55 * (1 - k));
    fx.glow(x, y, blast * 1.1, color, 0.5 * (1 - k), true);
    fx.shockwave(x, y, blast * ease(Math.min(1, k * 2)), k, color, 10);
    const seed = Math.floor((k * 480) / 40);
    for (let i = 0; i < 7; i++) {
      const ang = (i * TAU) / 7 + hash(i) * 0.6;
      fx.bolt(x, y - 10, x + Math.cos(ang) * blast, y + Math.sin(ang) * blast * 0.82, color, { width: 2 * (1 - k) + 0.6, jag: 0.3, branches: 1, seed: seed * 7 + i, alpha: 1 - k });
    }
  });
}

/** Muzzle flash when a bolt leaves Voltkit's antennae. */
export function electricCast(scene: Phaser.Scene, a: Ability, x: number, y: number, angle: number, color: number, shot: (ms: number, draw: (k: number) => void) => void) {
  const fx = fxFor(scene),
    mx = x + Math.cos(angle) * 26,
    my = y - 14 + Math.sin(angle) * 26,
    big = a.id === "static-lance";
  fx.burst({ x: mx, y: my + 14, z: 14, count: big ? 12 : 4, kind: "spark", color: [color, WHITE], angle, spread: 0.6, speed: [120, big ? 420 : 260], up: [20, 140], life: [0.15, 0.35], size: [1, 1.6], grav: 900 });
  if (big) fx.shake(90, 0.002);
  shot(big ? 220 : 120, (k) => {
    fx.glow(mx, my, (big ? 46 : 24) * (1 - k * 0.4), color, 0.9 * (1 - k));
    fx.glow(mx, my, big ? 18 : 10, WHITE, 1 - k);
    if (big)
      for (let i = -1; i <= 1; i++)
        fx.bolt(mx, my, mx + Math.cos(angle + i * 0.5) * 46, my + Math.sin(angle + i * 0.5) * 46, color, { width: 1.4, jag: 0.35, depth: 3, seed: i + 9, alpha: 1 - k });
  });
}

/** Electric hit: arcs crawl over the target and sparks bounce off the floor. */
export function electricHit(scene: Phaser.Scene, x: number, y: number, color: number, shot: (ms: number, draw: (k: number) => void) => void) {
  const fx = fxFor(scene),
    cy = y - 18;
  fx.burst({ x, y, z: 18, count: 12, kind: "spark", color: [color, WHITE], speed: [80, 300], up: [60, 260], life: [0.25, 0.55], size: [1, 1.6], grav: 1000, drag: 2 });
  shot(fx.reduced ? 140 : 360, (k) => {
    fx.glow(x, cy, 40 * (1 - k * 0.5), color, 0.8 * (1 - k));
    fx.glow(x, cy, 14, WHITE, Math.max(0, 1 - k * 2.5));
    const seed = Math.floor((k * 360) / 45);
    for (let i = 0; i < 3; i++) {
      const a0 = hash(seed + i) * TAU,
        a1 = a0 + 1.4 + hash(seed - i) * 1.6;
      fx.bolt(x + Math.cos(a0) * 24, cy + Math.sin(a0) * 26, x + Math.cos(a1) * 24, cy + Math.sin(a1) * 26, color, { width: 1.5, jag: 0.4, depth: 3, seed: seed + i * 3, alpha: 1 - k });
    }
  });
}

export const electricKit: FxKit = {
  projectile: {
    "spark-dart": (g, pr, now) => void electricProjectile(g, pr, now),
    "static-lance": (g, pr, now) => void electricProjectile(g, pr, now),
    "ball-lightning": (g, pr, now) => void electricProjectile(g, pr, now),
  },
  zone: { "storm-grid": stormGrid },
  windup: {
    overcharge: (g, a, x, y, _angle, _ax, _ay, color, k, now) => overchargeWindup(g, a, x, y, color, k, now),
  },
  cast: {
    "spark-dart": electricCast,
    "static-lance": electricCast,
    "ball-lightning": electricCast,
    overcharge: (scene, a, x, y, _angle, color, shot) => overchargeBurst(scene, a, x, y, color, shot),
  },
  impact: {
    "ball-lightning": ballLightningImpact,
    "spark-dart": fizzle,
    "static-lance": fizzle,
  },
  hit: { electric: electricHit },
};
/** A bolt that ends without a target: a few sparks and a blink of light. */
function fizzle(scene: Phaser.Scene, a: Ability, x: number, y: number, color: number, shot: Shot) {
  const fx = fxFor(scene);
  fx.burst({ x, y, z: 12, count: a.id === "static-lance" ? 10 : 5, kind: "spark", color: [color, WHITE], speed: [60, 220], up: [40, 200], life: [0.2, 0.45], size: [1, 1.5], grav: 1000 });
  shot(140, (k) => fx.glow(x, y - 8, 26 * (1 - k * 0.5), color, 0.8 * (1 - k)));
}
