import type Phaser from "phaser";
import type { Ability, Projectile, Zone } from "@arena/shared";
import { fxFor, type Fx } from "./fx-engine";
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
    fx.bolt(bx, by, x, y, c, {
      width: 1.8,
      jag: 0.28,
      depth: 3,
      seed: pr.id * 7 + Math.floor(now / 40),
    });
    fx.g.fillStyle(WHITE, 1).fillCircle(x, y, r * 0.45);
    fx.glow(x, y + 26, r * 2.4, c, 0.18, true);
    fx.trail(`p${pr.id}`, 0.035, () =>
      fx.burst({
        x: x - cos * 8,
        y,
        z: 0,
        count: 1,
        kind: "mote",
        color: [c, PALE],
        speed: [20, 70],
        life: [0.12, 0.25],
        size: [1, 1.8],
        drag: 4,
      }),
    );
    return true;
  }
  if (a.id === "static-lance") {
    const len = 96,
      bx = x - cos * len,
      by = y - sin * len,
      seed = pr.id * 13 + Math.floor(now / 35);
    // Ionised channel behind the tip.
    fx.g
      .lineStyle(r * 1.6, c, 0.14)
      .lineBetween(x - cos * len * 0.8, y - sin * len * 0.8, x, y);
    fx.g
      .lineStyle(r * 1.1, c, 0.32)
      .lineBetween(x - cos * len * 0.6, y - sin * len * 0.6, x, y);
    fx.bolt(bx, by, x, y, c, { width: 2.6, jag: 0.16, branches: 1, seed });
    fx.bolt(bx, by, x, y, BLUE, {
      width: 1.4,
      jag: 0.22,
      seed: seed + 50,
      alpha: 0.7,
    });
    fx.glow(x, y, r * 4.6, c, 0.45);
    fx.glow(x, y, r * 1.5, PALE, 0.6);
    fx.solid.fillStyle(0x1b1638, 0.35).fillCircle(x, y, r * 1.05);
    fx.solid.fillStyle(c, 1).fillCircle(x, y, r * 0.85);
    // Lens flare cross on the white-hot tip.
    const f = r * (4.5 + hash(seed) * 1.5);
    fx.g
      .lineStyle(2, WHITE, 0.7)
      .lineBetween(x - f, y, x + f, y)
      .lineBetween(x, y - f * 0.45, x, y + f * 0.45);
    fx.g.fillStyle(WHITE, 1).fillCircle(x, y, r * 0.55);
    fx.glow(x, y + 30, r * 3.5, c, 0.22, true);
    fx.trail(`p${pr.id}`, 0.022, () =>
      fx.burst({
        x: x - cos * 14,
        y,
        z: 10,
        count: 2,
        kind: "spark",
        color: [c, PALE],
        angle: dir + Math.PI,
        spread: 0.7,
        speed: [90, 240],
        up: [40, 160],
        life: [0.25, 0.45],
        size: [1, 1.6],
        grav: 900,
        drag: 2.5,
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
    fx.solid
      .fillStyle(PALE, 0.9)
      .fillCircle(x - r * 0.12, oy - r * 0.12, r * 0.62);
    fx.solid
      .fillStyle(WHITE, 1)
      .fillCircle(x - r * 0.18, oy - r * 0.18, r * 0.3);
    fx.g
      .lineStyle(2, BLUE, 0.6)
      .strokeCircle(x, oy, r * (1 + Math.sin(now / 60) * 0.06));
    // Plasma surface: arcs leap from the core to the edge and beyond.
    for (let i = 0; i < 4; i++) {
      const ang = hash(seed + i * 3) * TAU,
        reach = r * (1.05 + hash(seed - i) * 0.9);
      fx.bolt(x, oy, x + Math.cos(ang) * reach, oy + Math.sin(ang) * reach, c, {
        width: 1.6,
        jag: 0.4,
        depth: 3,
        seed: seed + i * 7,
      });
    }
    // Every so often an arc grounds itself, scattering sparks on the floor.
    if (hash(Math.floor(now / 220) + pr.id) > 0.55) {
      const gx = x + (hash(seed) - 0.5) * r * 3,
        gy = y + 22 + hash(seed + 1) * 10;
      fx.bolt(x, oy + r * 0.6, gx, gy, c, {
        width: 1.4,
        jag: 0.35,
        depth: 3,
        seed,
      });
      fx.trail(`g${pr.id}${Math.floor(now / 220)}`, 1, () =>
        fx.burst({
          x: gx,
          y: gy,
          count: 5,
          kind: "spark",
          color: [c, WHITE],
          speed: [40, 140],
          up: [60, 200],
          life: [0.2, 0.4],
          size: [1, 1.5],
          grav: 900,
        }),
      );
    }
    fx.trail(`p${pr.id}`, 0.04, () =>
      fx.burst({
        x,
        y,
        z: 10 - bob,
        count: 1,
        kind: "mote",
        color: [c, BLUE],
        speed: [10, 40],
        up: [10, 40],
        life: [0.3, 0.6],
        size: [1, 2],
        drag: 2,
      }),
    );
    return true;
  }
  return false;
}

// ───────────── Practice Grid (free practice's jump drill) ─────────────
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
    fx.bolt(x + 20, y - 520, x, y, WHITE, {
      width: 5 * (1 - k) + 1,
      jag: 0.12,
      branches: 3,
      seed: z.id * 5,
    });
    fx.glow(x, y, r * 2.2 * (1 - k * 0.5), PALE, 1 - k);
    fx.trail(`zs${z.id}`, 999, () => {
      fx.burst({
        x,
        y,
        count: 34,
        kind: "spark",
        color: [c, WHITE, PALE],
        speed: [120, 420],
        up: [120, 420],
        life: [0.35, 0.8],
        size: [1.2, 2],
        grav: 1000,
        drag: 1.5,
      });
      fx.decal({ kind: "scorch", x, y, r: r * 0.45, color: c, life: 4.6 });
      fx.shake(140, 0.003);
    });
  }
  // Charged floor: dark base, glowing lattice and a live rim.
  g.fillStyle(0x0d1430, 0.28 * fade * born).fillEllipse(
    x,
    y,
    r * 2,
    r * 2 * 0.82,
  );
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
    fx.bolt(nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y, c, {
      width: 1.8,
      jag: 0.25,
      seed: seed + i * 11,
      alpha: fade,
      onFloor: true,
    });
  }
  // Static lifting off the ground.
  fx.trail(`zm${z.id}`, 0.05, () => {
    const a = Math.random() * TAU,
      d = Math.sqrt(Math.random()) * r;
    fx.burst({
      x: x + Math.cos(a) * d,
      y: y + Math.sin(a) * d * sq,
      count: 1,
      kind: "mote",
      color: [c, BLUE, WHITE],
      speed: [0, 15],
      up: [40, 110],
      life: [0.5, 1],
      size: [1, 1.8],
      drag: 1.5,
    });
  });
}

// ───────────── Overcharge ─────────────
/** Wind-up: energy pours into Voltkit while the real blast area is marked. */
export function overchargeWindup(
  g: G,
  a: Ability,
  x: number,
  y: number,
  color: number,
  k: number,
  now: number,
) {
  const fx = fxFor(g.scene),
    r = a.radius,
    cy = y - 10;
  g.fillStyle(color, 0.06 + k * 0.1).fillEllipse(x, y, r * 2, r * 2 * 0.82);
  g.lineStyle(2, color, 0.75).strokeEllipse(x, y, r * 2, r * 2 * 0.82);
  fx.floor
    .lineStyle(3, PALE, 0.4 + k * 0.5)
    .strokeEllipse(x, y, r * 2 * (1 - k * 0.85), r * 2 * 0.82 * (1 - k * 0.85));
  fx.glow(x, cy, 30 + k * 70, color, 0.35 + k * 0.5);
  fx.glow(x, cy, 12 + k * 20, WHITE, 0.6 + k * 0.4);
  const seed = Math.floor(now / 45);
  for (let i = 0; i < 2 + Math.floor(k * 4); i++) {
    const ang = hash(seed + i * 5) * TAU;
    fx.bolt(
      x + Math.cos(ang) * r * 0.95,
      y + Math.sin(ang) * r * 0.78,
      x,
      cy,
      color,
      { width: 1.4, jag: 0.3, seed: seed + i, alpha: 0.4 + k * 0.5 },
    );
  }
  fx.trail(`oc${Math.round(x)}${Math.round(y)}`, 0.02, () => {
    for (let i = 0; i < 3; i++) {
      const ang = Math.random() * TAU,
        d = r * (0.7 + Math.random() * 0.3);
      fx.burst({
        x: x + Math.cos(ang) * d,
        y: y + Math.sin(ang) * d * 0.82,
        z: 10,
        count: 1,
        kind: "spark",
        color: [color, PALE],
        angle: ang + Math.PI,
        spread: 0.05,
        speed: [d * 2.4, d * 3],
        life: [0.3, 0.36],
        size: [1, 1.6],
        drag: 0.5,
      });
    }
  });
}

export function overchargeBurst(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: (ms: number, draw: (k: number) => void) => void,
) {
  const fx = fxFor(scene),
    r = a.radius,
    cy = y - 10;
  fx.burst({
    x,
    y,
    z: 10,
    count: 70,
    kind: "spark",
    color: [color, WHITE, PALE],
    speed: [260, 720],
    up: [80, 420],
    life: [0.4, 0.9],
    size: [1.2, 2.2],
    grav: 1000,
    drag: 1.6,
  });
  fx.burst({
    x,
    y,
    z: 10,
    count: 22,
    kind: "mote",
    color: [color, BLUE],
    speed: [80, 260],
    up: [20, 120],
    life: [0.6, 1.2],
    size: [1.2, 2.4],
    drag: 2,
  });
  fx.decal({ kind: "scorch", x, y, r: r * 0.5, color, life: 5 });
  fx.decal({ kind: "crack", x, y, r: r * 0.95, color, life: 4 });
  fx.shake(240, 0.006);
  shot(fx.reduced ? 200 : 620, (k) => {
    const flash = Math.max(0, 1 - k / 0.14);
    fx.glow(x, cy, r * 0.8, PALE, 0.6 * flash);
    fx.glow(x, cy, r * 1.1, color, 0.6 * (1 - k));
    fx.glow(x, y, r * 1.2, color, 0.6 * (1 - k), true);
    fx.shockwave(x, y, r * ease(Math.min(1, k * 1.8)), k, color, 14);
    if (k > 0.12)
      fx.shockwave(
        x,
        y,
        r * 0.75 * ease(Math.min(1, (k - 0.12) * 2)),
        k,
        PALE,
        8,
      );
    const seed = Math.floor((k * 620) / 40);
    for (let i = 0; i < 9; i++) {
      const ang = (i * TAU) / 9 + hash(i + 3) * 0.5,
        reach = r * Math.min(1, 0.3 + k * 2.4);
      fx.bolt(
        x,
        cy,
        x + Math.cos(ang) * reach,
        y + Math.sin(ang) * reach * 0.82,
        color,
        {
          width: 2.6 * (1 - k) + 0.6,
          jag: 0.24,
          branches: 2,
          seed: seed * 19 + i,
          alpha: 1 - k * 0.9,
        },
      );
    }
  });
}

// ───────────── Ball Lightning burst, casts and hits ─────────────
export function ballLightningImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: (ms: number, draw: (k: number) => void) => void,
) {
  const fx = fxFor(scene),
    blast = a.explosion ?? 100;
  fx.burst({
    x,
    y,
    z: 12,
    count: 44,
    kind: "spark",
    color: [color, WHITE, PALE],
    speed: [180, 520],
    up: [80, 360],
    life: [0.35, 0.8],
    size: [1.2, 2],
    grav: 1000,
    drag: 1.8,
  });
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
      fx.bolt(
        x,
        y - 10,
        x + Math.cos(ang) * blast,
        y + Math.sin(ang) * blast * 0.82,
        color,
        {
          width: 2 * (1 - k) + 0.6,
          jag: 0.3,
          branches: 1,
          seed: seed * 7 + i,
          alpha: 1 - k,
        },
      );
    }
  });
}

/**
 * Static Glide: the takeoff pop (a crackling ring out to pop.radius, which is
 * how far it shoves) and sparks shaken off the glider membranes.
 */
function staticGlide(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = a.pop?.radius ?? 150;
  fx.burst({
    x,
    y,
    z: 18,
    count: 16,
    kind: "spark",
    color: [color, PALE, BLUE],
    speed: [120, 320],
    up: [40, 160],
    life: [0.25, 0.5],
    size: [1, 2],
    drag: 3,
  });
  shot(fx.reduced ? 160 : 340, (k) => {
    const rr = r * (0.25 + 0.75 * Math.min(1, k / 0.6));
    fx.shockwave(x, y, rr, k, color, 8);
    fx.glow(x, y - 20, 50 * (1 - k * 0.5), color, 0.55 * (1 - k));
    // Streaks lifting off behind the glide.
    for (let i = 0; i < 4; i++) {
      const off = (i - 1.5) * 0.35,
        bx = x - Math.cos(angle + off) * 30 * k,
        by = y - 24 - 26 * k - Math.sin(angle + off) * 10 * k;
      fx.g
        .lineStyle(2, i % 2 ? PALE : color, 0.8 * (1 - k))
        .lineBetween(bx, by, bx - Math.cos(angle + off) * 18, by + 6);
    }
  });
}

/** Muzzle flash when a bolt leaves Voltkit's antennae. */
export function electricCast(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: (ms: number, draw: (k: number) => void) => void,
) {
  const fx = fxFor(scene),
    mx = x + Math.cos(angle) * 26,
    my = y - 14 + Math.sin(angle) * 26,
    big = a.id === "static-lance";
  fx.burst({
    x: mx,
    y: my + 14,
    z: 14,
    count: big ? 12 : 4,
    kind: "spark",
    color: [color, WHITE],
    angle,
    spread: 0.6,
    speed: [120, big ? 420 : 260],
    up: [20, 140],
    life: [0.15, 0.35],
    size: [1, 1.6],
    grav: 900,
  });
  if (big) fx.shake(90, 0.002);
  shot(big ? 220 : 120, (k) => {
    fx.glow(mx, my, (big ? 46 : 24) * (1 - k * 0.4), color, 0.9 * (1 - k));
    fx.glow(mx, my, big ? 18 : 10, WHITE, 1 - k);
    if (big)
      for (let i = -1; i <= 1; i++)
        fx.bolt(
          mx,
          my,
          mx + Math.cos(angle + i * 0.5) * 46,
          my + Math.sin(angle + i * 0.5) * 46,
          color,
          { width: 1.4, jag: 0.35, depth: 3, seed: i + 9, alpha: 1 - k },
        );
  });
}

/** Electric hit: arcs crawl over the target and sparks bounce off the floor. */
export function electricHit(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  shot: (ms: number, draw: (k: number) => void) => void,
) {
  const fx = fxFor(scene),
    cy = y - 18;
  fx.burst({
    x,
    y,
    z: 18,
    count: 12,
    kind: "spark",
    color: [color, WHITE],
    speed: [80, 300],
    up: [60, 260],
    life: [0.25, 0.55],
    size: [1, 1.6],
    grav: 1000,
    drag: 2,
  });
  shot(fx.reduced ? 140 : 360, (k) => {
    fx.glow(x, cy, 40 * (1 - k * 0.5), color, 0.8 * (1 - k));
    fx.glow(x, cy, 14, WHITE, Math.max(0, 1 - k * 2.5));
    const seed = Math.floor((k * 360) / 45);
    for (let i = 0; i < 3; i++) {
      const a0 = hash(seed + i) * TAU,
        a1 = a0 + 1.4 + hash(seed - i) * 1.6;
      fx.bolt(
        x + Math.cos(a0) * 24,
        cy + Math.sin(a0) * 26,
        x + Math.cos(a1) * 24,
        cy + Math.sin(a1) * 26,
        color,
        { width: 1.5, jag: 0.4, depth: 3, seed: seed + i * 3, alpha: 1 - k },
      );
    }
  });
}

// ───────────── Coilemur: a ring-tailed lemur with a magnet tail ─────────────
const RING = 0x2b2633;
const FUR = 0xe9e4da;
const MAG = 0xff5f57;
const STEEL = 0xd4dde9;
const SQ = 0.82;
/** Run `draw(k)` every frame for `ms` from inside a per-frame draw (zones). */
const shotOn =
  (scene: Phaser.Scene): Shot =>
  (ms, draw) => {
    draw(0);
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      onUpdate: (tw) => draw(tw.getValue() ?? 1),
      onComplete: () => undefined,
    });
  };
/** A ring-tail: alternating dark and pale bands along a polyline. */
function ringTail(
  fx: Fx,
  pts: { x: number; y: number }[],
  width: number,
  alpha: number,
) {
  for (let i = 0; i < pts.length - 1; i++) {
    const w = width * (1 - (i / pts.length) * 0.45);
    fx.solid
      .lineStyle(w + 3, RING, 0.45 * alpha)
      .lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    fx.solid
      .lineStyle(w, i % 2 ? RING : FUR, alpha)
      .lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
  }
}
/** A horseshoe magnet opening along `dir`: red bow, steel poles. */
function horseshoe(
  fx: Fx,
  x: number,
  y: number,
  r: number,
  dir: number,
  alpha = 1,
) {
  const bx = x - Math.cos(dir) * r * 0.35,
    by = y - Math.sin(dir) * r * 0.35,
    w = Math.max(2, r * 0.62);
  fx.solid
    .lineStyle(w + 3, RING, 0.5 * alpha)
    .beginPath()
    .arc(bx, by, r, dir + Math.PI / 2, dir + (Math.PI * 3) / 2)
    .strokePath();
  fx.solid
    .lineStyle(w, MAG, alpha)
    .beginPath()
    .arc(bx, by, r, dir + Math.PI / 2, dir + (Math.PI * 3) / 2)
    .strokePath();
  for (const side of [-1, 1]) {
    const px = bx + Math.cos(dir + (side * Math.PI) / 2) * r,
      py = by + Math.sin(dir + (side * Math.PI) / 2) * r;
    fx.solid
      .lineStyle(w, STEEL, alpha)
      .lineBetween(
        px,
        py,
        px + Math.cos(dir) * r * 0.75,
        py + Math.sin(dir) * r * 0.75,
      );
  }
  fx.g
    .lineStyle(1.5, WHITE, 0.7 * alpha)
    .beginPath()
    .arc(bx, by, r - w * 0.3, dir + Math.PI * 0.75, dir + Math.PI * 1.1)
    .strokePath();
}

/** Coil Swipe: the striped tail sweeps the real arc, crackling at its tip. */
function coilSwipe(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    cy = y - 10,
    spread = Math.min(Math.PI * 0.95, Math.acos(a.arc ?? 0.35)),
    range = a.range;
  fx.burst({
    x: x + Math.cos(angle) * range * 0.8,
    y: y + Math.sin(angle) * range * 0.8,
    z: 12,
    count: 8,
    kind: "spark",
    color: [color, WHITE, PALE],
    angle: angle + Math.PI / 2,
    spread: 0.8,
    speed: [90, 260],
    up: [40, 180],
    life: [0.2, 0.4],
    size: [1, 1.6],
    grav: 900,
  });
  shot(fx.reduced ? 140 : 260, (k) => {
    const sweep = ease(Math.min(1, k / 0.55)),
      fade = 1 - Math.max(0, (k - 0.35) / 0.65),
      head = angle - spread + 2 * spread * sweep,
      tail = Math.max(angle - spread, head - spread * 1.2),
      rr = range * 0.86;
    fx.floor
      .fillStyle(color, 0.12 * (1 - k))
      .slice(x, y, range, angle - spread, angle + spread);
    fx.floor.fillPath();
    const pts = Array.from({ length: 11 }, (_, j) => {
      const t = j / 10,
        a2 = head - (head - tail) * t,
        d = rr * (1 - t * 0.35);
      return { x: x + Math.cos(a2) * d, y: cy + Math.sin(a2) * d };
    });
    ringTail(fx, pts, 9, fade);
    const tipX = pts[0].x,
      tipY = pts[0].y;
    fx.g
      .lineStyle(6, color, 0.35 * fade)
      .beginPath()
      .arc(x, cy, range * 0.95, tail, head)
      .strokePath();
    fx.bolt(pts[3].x, pts[3].y, tipX, tipY, color, {
      width: 1.6,
      jag: 0.35,
      depth: 3,
      seed: Math.floor(k * 9),
      alpha: fade,
    });
    fx.glow(tipX, tipY, 26, color, 0.75 * fade);
    fx.glow(tipX, tipY, 9, WHITE, fade);
  });
}

/** Static Clamp: two magnet jaws snap shut ahead and cage the target in arcs. */
function staticClamp(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    cy = y - 12,
    spread = Math.min(Math.PI * 0.95, Math.acos(a.arc ?? 0.35)),
    range = a.range,
    hx = x + Math.cos(angle) * range * 0.68,
    hy = cy + Math.sin(angle) * range * 0.68,
    seed = Math.floor(Math.random() * 1000);
  fx.burst({
    x: hx,
    y: hy + 12,
    z: 14,
    count: 14,
    kind: "spark",
    color: [color, WHITE, BLUE],
    speed: [100, 320],
    up: [60, 240],
    life: [0.25, 0.5],
    size: [1, 1.8],
    grav: 1000,
    drag: 2,
  });
  fx.shake(110, 0.003);
  shot(fx.reduced ? 200 : 460, (k) => {
    const close = ease(Math.min(1, k / 0.28)),
      fade = 1 - Math.max(0, (k - 0.3) / 0.7),
      shut = k > 0.26;
    fx.floor
      .fillStyle(color, 0.14 * (1 - k))
      .slice(x, y, range, angle - spread, angle + spread);
    fx.floor.fillPath();
    fx.floor
      .lineStyle(2, color, 0.5 * (1 - k))
      .beginPath()
      .arc(x, y, range, angle - spread, angle + spread)
      .strokePath();
    // The jaws come in from the sides of the real arc and meet ahead.
    for (const side of [-1, 1]) {
      const from = angle + side * spread * 0.9,
        a2 = from + (angle - from) * close,
        d = range * (0.9 - close * 0.22),
        jx = x + Math.cos(a2) * d,
        jy = cy + Math.sin(a2) * d;
      horseshoe(fx, jx, jy, 13, a2 + Math.PI + side * 0.9, fade);
      if (!shut)
        fx.g
          .lineStyle(2, color, 0.5)
          .beginPath()
          .arc(x, cy, d, Math.min(from, a2), Math.max(from, a2))
          .strokePath();
    }
    if (shut) {
      // The cage: arcs crawling around whoever is held.
      const kk = (k - 0.26) / 0.74,
        s2 = seed + Math.floor(k * 14);
      fx.glow(hx, hy, 44 * (1 - kk * 0.5), color, 0.8 * fade);
      if (kk < 0.2) fx.glow(hx, hy, 34, WHITE, 1 - kk / 0.2);
      for (let i = 0; i < 4; i++) {
        const a0 = hash(s2 + i) * TAU,
          a1 = a0 + 1.6 + hash(s2 - i) * 1.4;
        fx.bolt(
          hx + Math.cos(a0) * 26,
          hy + Math.sin(a0) * 28,
          hx + Math.cos(a1) * 26,
          hy + Math.sin(a1) * 28,
          i % 2 ? BLUE : color,
          { width: 1.6, jag: 0.4, depth: 3, seed: s2 + i * 5, alpha: fade },
        );
      }
      fx.g.lineStyle(2.5, PALE, 0.8 * fade).strokeEllipse(hx, hy, 60, 64);
    }
  });
}

/** Magnet Lash wind-up: the tail cocks back and the lash's real lane lights. */
function magnetLashWindup(
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
    len = a.range,
    w = a.radius * 2,
    ex = x + cos * len,
    ey = y + sin * len;
  // The real lane (as wide as the lash head) out to its range.
  g.lineStyle(w, color, 0.07 + k * 0.12).lineBetween(x, y, ex, ey);
  const nx = -sin * a.radius,
    ny = cos * a.radius;
  g.lineStyle(1.5, color, 0.35 + k * 0.4)
    .lineBetween(x + nx, y + ny, ex + nx, ey + ny)
    .lineBetween(x - nx, y - ny, ex - nx, ey - ny);
  // Pulses running down the lane toward the far end.
  for (let i = 0; i < 4; i++) {
    const t = (now / 500 + i / 4) % 1;
    fx.floor
      .fillStyle(PALE, 0.7 * k * (1 - t))
      .fillCircle(x + cos * len * t, y + sin * len * t, 2.5);
  }
  fx.floor
    .lineStyle(2, color, 0.8)
    .strokeEllipse(ex, ey, w * 1.6, w * 1.6 * SQ);
  // The tail coils back over the shoulder, the magnet tip charging.
  const back = angle + Math.PI,
    cy = y - 16,
    pts = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8,
        a2 = back + (t - 0.3) * 2.2 * (0.6 + k * 0.4),
        d = 14 + t * 30;
      return {
        x: x + Math.cos(a2) * d,
        y: cy - t * 18 + Math.sin(a2) * d * 0.5,
      };
    });
  ringTail(fx, pts, 7, 1);
  const tip = pts[pts.length - 1];
  horseshoe(fx, tip.x, tip.y, 8, angle, 1);
  fx.glow(tip.x, tip.y, 18 + k * 30, color, 0.4 + k * 0.5);
  const seed = Math.floor(now / 45);
  for (let i = 0; i < 1 + Math.floor(k * 3); i++)
    fx.bolt(
      tip.x,
      tip.y,
      tip.x + (hash(seed + i) - 0.5) * 50,
      tip.y + (hash(seed - i) - 0.5) * 40,
      color,
      {
        width: 1.2,
        jag: 0.4,
        depth: 3,
        seed: seed + i * 3,
        alpha: 0.5 + k * 0.5,
      },
    );
}

/** Magnet Lash in flight: a magnet head on a crackling field line home. */
function magnetLash(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    a = pr.ability,
    c = pr.color,
    r = a.radius,
    dir = Math.atan2(pr.vy, pr.vx),
    cos = Math.cos(dir),
    sin = Math.sin(dir),
    x = pr.x,
    y = pr.y,
    left = Number.isFinite(pr.remaining) ? pr.remaining : a.range,
    travelled = Math.max(0, Math.min(a.range, a.range - left)),
    ox = x - cos * travelled,
    oy = y - sin * travelled,
    seed = pr.id * 11 + Math.floor(now / 40);
  // The field line back to where it was cracked: a wave tightening to the head.
  const pts = Array.from({ length: 17 }, (_, i) => {
    const t = i / 16,
      amp = Math.sin(t * Math.PI) * r * 0.9 * (1 - t * 0.5),
      o = Math.sin(t * 14 - now / 30) * amp;
    return {
      x: ox + (x - ox) * t - sin * o,
      y: oy + (y - oy) * t + cos * o,
    };
  });
  fx.solid.lineStyle(4, RING, 0.25).strokePoints(pts, false);
  fx.g.lineStyle(5, c, 0.25).strokePoints(pts, false);
  fx.g.lineStyle(1.6, PALE, 0.75).strokePoints(pts, false);
  if (travelled > 30)
    fx.bolt(
      x - cos * Math.min(travelled, 110),
      y - sin * Math.min(travelled, 110),
      x,
      y,
      c,
      {
        width: 1.6,
        jag: 0.25,
        depth: 3,
        seed,
      },
    );
  fx.glow(x, y, r * 3.6, c, 0.45);
  horseshoe(fx, x, y, r * 0.95, dir);
  // Field arcs reaching out from the poles for whatever they will grab.
  for (const side of [-1, 1])
    fx.g
      .lineStyle(1.5, BLUE, 0.6)
      .beginPath()
      .arc(
        x + cos * r * 0.6,
        y + sin * r * 0.6,
        r * (1.2 + ((now / 120) % 1) * 0.8),
        dir + side * 0.2 - 0.6,
        dir + side * 0.2 + 0.6,
      )
      .strokePath();
  fx.glow(x, y + 24, r * 2.2, c, 0.2, true);
  fx.trail(`ml${pr.id}`, 0.03, () =>
    fx.burst({
      x,
      y,
      z: 8,
      count: 2,
      kind: "spark",
      color: [c, PALE, BLUE],
      angle: dir + Math.PI,
      spread: 0.6,
      speed: [60, 200],
      up: [30, 120],
      life: [0.2, 0.35],
      size: [1, 1.5],
      grav: 900,
    }),
  );
}

/** Magnet Lash ends: the field collapses onto the point it latched. */
function magnetLashImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = a.radius * 4;
  fx.burst({
    x,
    y,
    z: 14,
    count: 12,
    kind: "spark",
    color: [color, WHITE, BLUE],
    speed: [80, 260],
    up: [40, 200],
    life: [0.2, 0.45],
    size: [1, 1.6],
    grav: 1000,
  });
  shot(fx.reduced ? 160 : 340, (k) => {
    const pull = 1 - ease(k);
    // Rings snapping inward: the pull.
    for (let i = 0; i < 3; i++) {
      const rr = r * Math.max(0.05, pull - i * 0.18);
      fx.g
        .lineStyle(2.5 - i * 0.5, i ? BLUE : color, 0.8 * (1 - k))
        .strokeEllipse(x, y - 14, rr * 2, rr * 2);
    }
    fx.glow(x, y - 14, 30 * (1 - k * 0.5), color, 0.8 * (1 - k));
    fx.glow(x, y - 14, 10, WHITE, Math.max(0, 1 - k * 2));
  });
}

/** Spark Tether: a ring-tail of current around Coilemur that pulses on each shock. */
function sparkTether(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    a = z.ability,
    c = z.color,
    r = z.radius,
    x = z.x,
    y = z.y,
    fade =
      progress > 0.88 ? (1 - progress) / 0.12 : Math.min(1, progress / 0.06),
    t = progress * a.duration,
    since = t - (a.tickDelay ?? 0),
    every = Math.max(0.05, a.tickInterval ?? 0.5),
    pulse = since >= 0 ? 1 - Math.min(1, (since % every) / (every * 0.35)) : 0,
    spin = now / 900,
    seed = Math.floor(now / 70) + z.id;
  fx.floorSolid
    .fillStyle(0x0d1430, 0.12 * fade)
    .fillEllipse(x, y, r * 2, r * 2 * SQ);
  fx.glow(x, y, r * 1.1, c, (0.14 + pulse * 0.3) * fade, true);
  // The banded rim: dark stripes on the ground, lit stripes in the light.
  const bands = 24;
  for (let i = 0; i < bands; i++) {
    const a0 = spin + (i * TAU) / bands,
      a1 = a0 + TAU / bands,
      x0 = x + Math.cos(a0) * r,
      y0 = y + Math.sin(a0) * r * SQ,
      x1 = x + Math.cos(a1) * r,
      y1 = y + Math.sin(a1) * r * SQ;
    if (i % 2)
      fx.floorSolid.lineStyle(7, RING, 0.55 * fade).lineBetween(x0, y0, x1, y1);
    else
      fx.floor
        .lineStyle(7, c, (0.55 + pulse * 0.4) * fade)
        .lineBetween(x0, y0, x1, y1);
  }
  fx.floor
    .lineStyle(1.5, WHITE, (0.35 + pulse * 0.6) * fade)
    .strokeEllipse(x, y, r * 2, r * 2 * SQ);
  // Current running round the rim, and a shock inward on each tick.
  for (let i = 0; i < 3; i++) {
    const a0 = hash(seed + i) * TAU,
      a1 = a0 + 0.5 + hash(seed - i) * 0.6;
    fx.bolt(
      x + Math.cos(a0) * r,
      y + Math.sin(a0) * r * SQ,
      x + Math.cos(a1) * r,
      y + Math.sin(a1) * r * SQ,
      c,
      {
        width: 1.4,
        jag: 0.3,
        depth: 3,
        seed: seed + i,
        alpha: fade,
        onFloor: true,
      },
    );
  }
  if (pulse > 0.2)
    for (let i = 0; i < 5; i++) {
      const a0 = (i * TAU) / 5 + hash(Math.floor(since / every) + i) * 1.2;
      fx.bolt(
        x,
        y - 14,
        x + Math.cos(a0) * r * 0.97,
        y + Math.sin(a0) * r * 0.97 * SQ,
        c,
        {
          width: 1.6 * pulse,
          jag: 0.3,
          depth: 4,
          seed: seed * 3 + i,
          alpha: pulse * fade,
        },
      );
    }
  fx.trail(`st${z.id}`, 0.06, () => {
    const a0 = Math.random() * TAU;
    fx.burst({
      x: x + Math.cos(a0) * r,
      y: y + Math.sin(a0) * r * SQ,
      count: 1,
      kind: "mote",
      color: [c, PALE],
      speed: [0, 15],
      up: [40, 100],
      life: [0.4, 0.8],
      size: [1, 1.8],
      drag: 1.5,
    });
  });
}

/**
 * Electromagnet (ultimate): Coilemur becomes a magnet. Field lines stream in
 * from the real radius, filings and sparks are dragged to the core and every
 * tick shocks out to the rim.
 */
function electromagnet(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    a = z.ability,
    c = z.color,
    r = z.radius,
    x = z.x,
    y = z.y,
    cy = y - 22,
    fade =
      progress > 0.88 ? (1 - progress) / 0.12 : Math.min(1, progress / 0.05),
    t = progress * a.duration,
    since = t - (a.tickDelay ?? 0),
    every = Math.max(0.05, a.tickInterval ?? 0.4),
    pulse = since >= 0 ? 1 - Math.min(1, (since % every) / (every * 0.4)) : 0,
    seed = Math.floor(now / 60) + z.id;
  // The moment it switches on: the screen dims and the field slams inward.
  fx.trail(`em${z.id}`, 999, () => {
    fx.ultimate(c, 900);
    fx.shake(220, 0.005);
    fx.decal({ kind: "glyph", x, y, r: r * 0.96, color: c, life: a.duration });
    fx.burst({
      x,
      y,
      z: 20,
      count: 30,
      kind: "spark",
      color: [c, WHITE, MAG],
      speed: [160, 420],
      up: [80, 300],
      life: [0.3, 0.6],
      size: [1.2, 2],
      grav: 1000,
    });
    shotOn(g.scene)(fx.reduced ? 200 : 520, (k) => {
      fx.shockwave(x, y, r * (1 - ease(k)) + 8, k, WHITE, 12);
      fx.shockwave(x, y, r * (1 - ease(Math.min(1, k * 1.4))) + 4, k, c, 8);
      fx.glow(x, cy, r * 0.5 * (1 - k), c, 0.7 * (1 - k));
    });
  });
  fx.floorSolid
    .fillStyle(0x0d1430, 0.2 * fade)
    .fillEllipse(x, y, r * 2, r * 2 * SQ);
  fx.glow(x, y, r * 1.05, c, (0.18 + pulse * 0.25) * fade, true);
  // Polarity rim: red and gold halves turning, white edge.
  const spin = now / 700;
  for (let h = 0; h < 2; h++) {
    const pts = Array.from({ length: 25 }, (_, i) => {
      const a2 = spin + h * Math.PI + (i / 24) * Math.PI;
      return { x: x + Math.cos(a2) * r, y: y + Math.sin(a2) * r * SQ };
    });
    fx.floor.lineStyle(6, h ? MAG : c, 0.65 * fade).strokePoints(pts, false);
  }
  fx.floor
    .lineStyle(2, WHITE, (0.5 + pulse * 0.5) * fade)
    .strokeEllipse(x, y, r * 2, r * 2 * SQ);
  // Field lines spiralling in, with dashes of current flowing toward the core.
  const lines = 12;
  for (let i = 0; i < lines; i++) {
    const base = (i * TAU) / lines + now / 2600,
      pts = Array.from({ length: 13 }, (_, j) => {
        const tt = j / 12,
          a2 = base + tt * 0.9,
          d = r * (1 - tt * 0.9);
        return { x: x + Math.cos(a2) * d, y: y + Math.sin(a2) * d * SQ };
      });
    fx.floor
      .lineStyle(1.5, i % 2 ? BLUE : c, 0.35 * fade)
      .strokePoints(pts, false);
    const flow = (now / 600 + hash(i)) % 1,
      p = pts[Math.min(12, Math.floor(flow * 12))];
    fx.floor.fillStyle(WHITE, 0.9 * fade).fillCircle(p.x, p.y, 2.4);
    fx.glow(p.x, p.y, 14, c, 0.5 * fade, true);
  }
  // The core over Coilemur: a pulsing magnet heart.
  fx.glow(x, cy, 40 + pulse * 30, c, (0.5 + pulse * 0.4) * fade);
  fx.glow(x, cy, 14 + pulse * 8, WHITE, 0.8 * fade);
  for (let i = 0; i < 3; i++)
    fx.g
      .lineStyle(2, i % 2 ? MAG : c, 0.6 * fade)
      .strokeEllipse(
        x,
        cy,
        (30 + ((now / 8 + i * 20) % 60)) * 1,
        (30 + ((now / 8 + i * 20) % 60)) * 0.5,
      );
  // Each tick: shocks lash out to the rim and back.
  if (pulse > 0.15)
    for (let i = 0; i < 7; i++) {
      const a0 = (i * TAU) / 7 + hash(Math.floor(since / every) * 7 + i) * 0.8;
      fx.bolt(
        x,
        cy,
        x + Math.cos(a0) * r,
        y + Math.sin(a0) * r * SQ,
        i % 3 ? c : WHITE,
        {
          width: 2.2 * pulse + 0.4,
          jag: 0.22,
          branches: 1,
          seed: seed * 5 + i,
          alpha: pulse * fade,
        },
      );
    }
  // Iron filings and sparks dragged from the rim to the core.
  fx.trail(`emf${z.id}`, 0.025, () => {
    for (let i = 0; i < 2; i++) {
      const a0 = Math.random() * TAU,
        d = r * (0.85 + Math.random() * 0.15),
        life = 0.5;
      fx.burst({
        x: x + Math.cos(a0) * d,
        y: y + Math.sin(a0) * d * SQ,
        z: 4,
        count: 1,
        kind: i ? "spark" : "debris",
        color: i ? [c, PALE] : [0x6a6f7c, 0x3a3e48],
        angle: a0 + Math.PI,
        spread: 0.05,
        speed: [(d / life) * 0.9, d / life],
        up: [20, 60],
        life: [life * 0.9, life],
        size: i ? [1, 1.6] : [1.5, 2.5],
        drag: 0.2,
        grav: 120,
      });
    }
  });
}

export const electricKit: FxKit = {
  projectile: {
    "spark-dart": (g, pr, now) => void electricProjectile(g, pr, now),
    "static-lance": (g, pr, now) => void electricProjectile(g, pr, now),
    "ball-lightning": (g, pr, now) => void electricProjectile(g, pr, now),
    "magnet-lash": magnetLash,
  },
  zone: {
    "practice-grid": stormGrid,
    "spark-tether": sparkTether,
    electromagnet,
  },
  windup: {
    overcharge: (g, a, x, y, _angle, _ax, _ay, color, k, now) =>
      overchargeWindup(g, a, x, y, color, k, now),
    "magnet-lash": magnetLashWindup,
  },
  cast: {
    "spark-dart": electricCast,
    "static-lance": electricCast,
    "ball-lightning": electricCast,
    overcharge: (scene, a, x, y, _angle, color, shot) =>
      overchargeBurst(scene, a, x, y, color, shot),
    "static-glide": staticGlide,
    "coil-swipe": coilSwipe,
    "static-clamp": staticClamp,
  },
  impact: {
    "ball-lightning": ballLightningImpact,
    "spark-dart": fizzle,
    "static-lance": fizzle,
    "magnet-lash": magnetLashImpact,
  },
  hit: { electric: electricHit },
};
/** A bolt that ends without a target: a few sparks and a blink of light. */
function fizzle(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  fx.burst({
    x,
    y,
    z: 12,
    count: a.id === "static-lance" ? 10 : 5,
    kind: "spark",
    color: [color, WHITE],
    speed: [60, 220],
    up: [40, 200],
    life: [0.2, 0.45],
    size: [1, 1.5],
    grav: 1000,
  });
  shot(140, (k) => fx.glow(x, y - 8, 26 * (1 - k * 0.5), color, 0.8 * (1 - k)));
}
