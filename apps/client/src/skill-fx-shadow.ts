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
 * Duskveil's kit: darkness and ghost-light. Shade is drawn as real dark
 * (normal blend), ghostfire as cold teal flame, and the void pulls things in
 * before it bursts. Sizes come from the shared abilities.
 */
const GHOST = 0x7dffe1;
const PALE = 0xd9fff6;
const SHADE = 0x150b26;
const VIOLET = 0xb59bff;

/** Cold flame: dark rim, teal body, pale heart; tongue trails behind travel. */
function ghostFlame(
  fx: Fx,
  x: number,
  y: number,
  r: number,
  dir: number,
  now: number,
  seed: number,
  color = GHOST,
) {
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
const wisps = (
  fx: Fx,
  x: number,
  y: number,
  n: number,
  speed: [number, number] = [10, 40],
) =>
  fx.burst({
    x,
    y,
    z: 8,
    count: n,
    kind: "smoke",
    color: [SHADE, 0x2a1846],
    speed,
    up: [20, 60],
    life: [0.5, 1],
    size: [6, 11],
    drag: 2,
  });
const ghostMotes = (fx: Fx, x: number, y: number, n: number, color = GHOST) =>
  fx.burst({
    x,
    y,
    z: 10,
    count: n,
    kind: "mote",
    color: [color, PALE],
    speed: [10, 50],
    up: [30, 80],
    life: [0.5, 1],
    size: [1, 1.8],
    drag: 2,
  });

// ───────────── Projectiles ─────────────
function lanternWisp(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    dir = Math.atan2(pr.vy, pr.vx);
  fx.solid
    .fillStyle(0x000000, 0.18)
    .fillEllipse(
      pr.x,
      pr.y + 18,
      pr.ability.radius * 2,
      pr.ability.radius * 0.7,
    );
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
    fx.floorSolid
      .fillStyle(SHADE, 0.55 - i * 0.07)
      .fillEllipse(
        x - cos * d - sin * wob,
        y - sin * d * 0.8 + cos * wob * 0.5,
        r * (2.4 - i * 0.25),
        r * (1.3 - i * 0.14),
      );
  }
  fx.floorSolid.fillStyle(pr.color, 0.5).fillEllipse(x, y, r * 2.2, r * 1.15);
  const ex = -sin * 4,
    ey = cos * 3;
  fx.floor
    .fillStyle(GHOST, 1)
    .fillCircle(x + cos * 6 + ex, y + sin * 4 + ey, 2.4)
    .fillCircle(x + cos * 6 - ex, y + sin * 4 - ey, 2.4);
  fx.glow(x + cos * 6, y, 14, GHOST, 0.4, true);
  fx.trail(`p${pr.id}`, 0.035, () => wisps(fx, x - cos * r, y - 6, 1, [5, 20]));
}
/**
 * Haunted Lantern: a crooked post with the lantern hanging from it, its ghost
 * flame flickering, and a faint pool of light on the floor as far as it
 * shoots (turret.range). The wisps it fires draw as Lantern Wisps.
 */
function hauntedLantern(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    { x, y } = z,
    reach = z.ability.turret?.range ?? 330,
    grow = Math.min(1, progress / 0.08),
    fade = progress > 0.9 ? (1 - progress) / 0.1 : 1,
    a = grow * fade,
    flick = 0.85 + hash(z.id + Math.floor(now / 90)) * 0.3;
  // The pool of light it watches over.
  fx.floor
    .fillStyle(GHOST, 0.05 * a)
    .fillEllipse(x, y, reach * 2, reach * 2 * 0.62);
  fx.floor
    .lineStyle(2, GHOST, 0.28 * a)
    .strokeEllipse(x, y, reach * 2, reach * 2 * 0.62);
  fx.glow(x, y, 70 * flick, GHOST, 0.22 * a, true);
  // Post and crook.
  const top = y - 58 * grow,
    lx = x + 14,
    ly = top + 16;
  fx.solid.fillStyle(0x000000, 0.25 * a).fillEllipse(x, y + 2, 26, 8);
  fx.solid.lineStyle(5, SHADE, 0.95 * a).lineBetween(x, y, x, top);
  fx.solid.lineStyle(4, SHADE, 0.95 * a).lineBetween(x, top, lx, top + 2);
  fx.solid.lineStyle(1.5, VIOLET, 0.8 * a).lineBetween(lx, top + 2, lx, ly - 8);
  // The lantern and its ghost flame.
  fx.solid
    .fillStyle(0x2a1846, 0.95 * a)
    .fillRoundedRect(lx - 8, ly - 8, 16, 18, 4);
  fx.solid
    .lineStyle(2, VIOLET, 0.9 * a)
    .strokeRoundedRect(lx - 8, ly - 8, 16, 18, 4);
  if (a > 0.2) ghostFlame(fx, lx, ly + 1, 5 * flick, -Math.PI / 2, now, z.id);
  fx.trail(`z${z.id}`, 0.18, () => ghostMotes(fx, lx, ly, 1));
}
function voidOrb(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    x = pr.x,
    y = pr.y - 8;
  fx.solid
    .fillStyle(0x000000, 0.25)
    .fillEllipse(pr.x, pr.y + 16, r * 2.2, r * 0.8);
  // Event horizon: a black core rimmed by bent violet light.
  fx.glow(x, y, r * 2.6, pr.color, 0.5);
  for (let i = 0; i < 3; i++) {
    const a = -now / 160 + (i * TAU) / 3;
    fx.g
      .lineStyle(3, VIOLET, 0.85)
      .beginPath()
      .arc(x, y, r * 1.35, a, a + 1.4)
      .strokePath();
  }
  fx.soft(x, y, r * 1.5, SHADE, 0.9);
  fx.solid.fillStyle(0x05020c, 1).fillCircle(x, y, r * 0.95);
  fx.solid.lineStyle(2, pr.color, 0.9).strokeCircle(x, y, r * 0.95);
  // Motes spiralling into it.
  fx.trail(`p${pr.id}`, 0.03, () => {
    const a = Math.random() * TAU,
      d = r * 2.6;
    fx.burst({
      x: x + Math.cos(a) * d,
      y: pr.y + Math.sin(a) * d * 0.8,
      z: 8,
      count: 1,
      kind: "mote",
      color: [VIOLET, PALE],
      angle: a + Math.PI - 0.5,
      spread: 0.1,
      speed: [d * 3, d * 3.5],
      life: [0.25, 0.32],
      size: [1, 1.6],
      drag: 0.4,
    });
  });
}

// ───────────── Void Orb wind-up and burst ─────────────
function voidWindup(
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
    cx = x + Math.cos(angle) * 30,
    cy = y - 18 + Math.sin(angle) * 30,
    r = a.radius * (0.3 + k * 0.7);
  // The real lane the orb will travel, as wide as its hit radius.
  const len = Math.min(a.range ?? 600, 420);
  g.lineStyle(a.radius * 2, SHADE, 0.08 + k * 0.1).lineBetween(
    x,
    y - 10,
    x + Math.cos(angle) * len,
    y - 10 + Math.sin(angle) * len,
  );
  fx.soft(cx, cy, r * 2, SHADE, 0.5 + k * 0.4);
  fx.solid.fillStyle(0x05020c, 0.9).fillCircle(cx, cy, r * 0.8);
  fx.g
    .lineStyle(2, VIOLET, 0.6 + k * 0.4)
    .strokeCircle(cx, cy, r * (1 + Math.sin(now / 40) * 0.05));
  fx.trail(`vw${Math.round(x)}`, 0.025, () => {
    const t = Math.random() * TAU,
      d = 70;
    fx.burst({
      x: cx + Math.cos(t) * d,
      y: cy + 18 + Math.sin(t) * d,
      z: 18,
      count: 1,
      kind: "mote",
      color: [VIOLET, color],
      angle: t + Math.PI,
      spread: 0.05,
      speed: [d * 3.4, d * 3.8],
      life: [0.25, 0.28],
      size: [1, 1.6],
      drag: 0.3,
    });
  });
}
function voidBurst(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    blast = a.explosion ?? 120;
  fx.decal({ kind: "scorch", x, y, r: blast * 0.6, color: VIOLET, life: 4 });
  fx.shake(200, 0.005);
  shot(fx.reduced ? 260 : 700, (k) => {
    // Implode first (everything pulled to the centre), then burst.
    if (k < 0.3) {
      const kk = k / 0.3;
      fx.soft(x, y - 8, blast * (1 - kk * 0.7), SHADE, 0.75);
      fx.g
        .lineStyle(4, VIOLET, 0.9)
        .strokeEllipse(x, y, blast * 2 * (1 - kk), blast * 2 * 0.82 * (1 - kk));
      fx.trail(`vi${Math.round(x)}`, 0.02, () => {
        const t = Math.random() * TAU;
        fx.burst({
          x: x + Math.cos(t) * blast,
          y: y + Math.sin(t) * blast * 0.82,
          z: 8,
          count: 2,
          kind: "mote",
          color: [VIOLET, PALE],
          angle: t + Math.PI,
          spread: 0.05,
          speed: [blast * 3, blast * 3.4],
          life: [0.25, 0.3],
          size: [1.2, 2],
          drag: 0.2,
        });
      });
      return;
    }
    const kk = (k - 0.3) / 0.7;
    fx.trail(`vb${Math.round(x)}`, 999, () => {
      wisps(fx, x, y, 14, [120, 320]);
      fx.burst({
        x,
        y,
        z: 10,
        count: 30,
        kind: "spark",
        color: [VIOLET, color, PALE],
        speed: [160, 480],
        up: [80, 320],
        life: [0.35, 0.7],
        size: [1.2, 2],
        grav: 900,
      });
    });
    fx.soft(x, y - 8, blast * 0.9 * (1 - kk), SHADE, 0.55 * (1 - kk));
    fx.glow(x, y - 8, blast * 1.1, color, 0.6 * (1 - kk));
    fx.glow(x, y - 8, blast * 0.4, PALE, Math.max(0, 1 - kk * 3));
    fx.shockwave(x, y, blast * ease(Math.min(1, kk * 1.6)), kk, VIOLET, 12);
    fx.shockwave(x, y, blast * 0.65 * ease(Math.min(1, kk * 2)), kk, color, 6);
  });
}

// ───────────── Casts, impacts, hits ─────────────
function shadowCast(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    mx = x + Math.cos(angle) * 24,
    my = y - 16 + Math.sin(angle) * 24;
  wisps(fx, mx, my + 16, a.id === "ghostfire" ? 5 : 2, [20, 80]);
  shot(180, (k) => {
    fx.glow(
      mx,
      my,
      30 * (1 - k * 0.4),
      a.id === "haunted-lantern" ? color : GHOST,
      0.7 * (1 - k),
    );
    fx.soft(mx, my, 18 * (1 - k), SHADE, 0.5 * (1 - k));
  });
}
function wispImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  _color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  ghostMotes(fx, x, y, a.id === "ghostfire" ? 8 : 5);
  wisps(fx, x, y, 3);
  shot(200, (k) => fx.glow(x, y - 6, 34 * (1 - k * 0.5), GHOST, 0.7 * (1 - k)));
}
function shadowHit(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    cy = y - 16;
  wisps(fx, x, y, 6, [30, 110]);
  ghostMotes(fx, x, y, 6);
  shot(fx.reduced ? 140 : 340, (k) => {
    fx.soft(x, cy, 30 * (1 - k * 0.3), SHADE, 0.45 * (1 - k));
    fx.glow(x, cy, 26 * (1 - k * 0.5), color, 0.6 * (1 - k));
  });
}

// ═════════════ Shadopus: midnight octopus, ink and tentacles ═════════════
const INK_BLACK = 0x0c0818;
const INK_DEEP = 0x231545;
const ARM = 0x4a3590;
const ARM_LIGHT = 0x8f78e6;
const SUCKER = 0xe4d6ff;
const SQ = 0.82;

/** Ink drops flicked off a tentacle or a jet. */
const inkDrops = (
  fx: Fx,
  x: number,
  y: number,
  n: number,
  speed: [number, number],
  o: { angle?: number; spread?: number; z?: number } = {},
) =>
  fx.burst({
    x,
    y,
    z: o.z ?? 12,
    count: n,
    kind: "drop",
    color: [INK_BLACK, INK_DEEP, 0x3a2470],
    speed,
    up: [60, 200],
    life: [0.4, 0.8],
    size: [1.8, 3.4],
    grav: 900,
    drag: 1.2,
    angle: o.angle,
    spread: o.spread,
  });
/**
 * One tentacle from (x0, y0) reaching `len` along `ang`, curling by `curl`:
 * tapered dark-rimmed arm with a pale row of suckers.
 */
function tentacle(
  fx: Fx,
  x0: number,
  y0: number,
  ang: number,
  len: number,
  curl: number,
  width: number,
  alpha: number,
  phase = 0,
) {
  if (len <= 2 || alpha <= 0) return;
  // Walk a gently turning, slightly sinuous path out from the base.
  const n = 10,
    step = len / n,
    path = [{ x: x0, y: y0 }];
  let px = x0,
    py = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n,
      a = ang + curl * t * t + Math.sin(t * 6 + phase) * 0.28 * t;
    px += Math.cos(a) * step;
    py += Math.sin(a) * step * SQ;
    path.push({ x: px, y: py });
  }
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < n; i++) {
      const t = i / n,
        w = width * (1 - t * 0.8);
      const p0 = path[i],
        p1 = path[i + 1];
      if (pass === 0)
        fx.solid
          .lineStyle(w + 3, INK_BLACK, 0.85 * alpha)
          .lineBetween(p0.x, p0.y, p1.x, p1.y);
      else if (pass === 1)
        fx.solid.lineStyle(w, ARM, alpha).lineBetween(p0.x, p0.y, p1.x, p1.y);
      else {
        fx.solid
          .lineStyle(Math.max(1, w * 0.3), ARM_LIGHT, 0.8 * alpha)
          .lineBetween(p0.x, p0.y - w * 0.2, p1.x, p1.y - w * 0.2);
        if (i % 2 === 0 && i < n - 1)
          fx.solid
            .fillStyle(SUCKER, 0.85 * alpha)
            .fillCircle(p1.x, p1.y + w * 0.25, Math.max(1, w * 0.18));
      }
    }
  return path[n];
}

// ───────────── Tentacle Lash, Ink Strike ─────────────
/**
 * Tentacles lash across the real arc and range. Ink Strike sends all eight
 * at once, fanned across its arc; the basic lash is a quick pair. The
 * tentacles are Shadopus's own, so they stay on its body while it moves
 * (`at`: where it is drawn now), instead of hanging where the lash began.
 */
function lash(
  scene: Phaser.Scene,
  a: Ability,
  x0: number,
  y0: number,
  angle: number,
  color: number,
  shot: Shot,
  at?: Follow,
) {
  const start = at?.() ?? { x: x0, y: y0 };
  const fx = fxFor(scene),
    spread = Math.min(Math.PI * 0.95, Math.acos(a.arc ?? 0.3)),
    strike = a.id === "ink-strike",
    arms = strike ? 8 : 2,
    range = a.range;
  shot(fx.reduced ? 180 : strike ? 420 : 280, (k) => {
    const { x, y } = at?.() ?? start,
      cy = y - 14;
    const reach = ease(Math.min(1, k * (strike ? 2.6 : 3))),
      back = k > 0.5 ? 1 - (k - 0.5) / 0.5 : 1,
      fade = 1 - Math.max(0, (k - 0.55) / 0.45);
    fx.floor
      .fillStyle(color, (strike ? 0.16 : 0.1) * fade)
      .slice(x, y, range, angle - spread, angle + spread);
    fx.floor.fillPath();
    for (let i = 0; i < arms; i++) {
      const t = i / (arms - 1),
        off = strike ? (t - 0.5) * 2 * spread * 0.9 : (t - 0.5) * spread * 1.2,
        lag = strike ? hash(i * 3) * 0.12 : i * 0.15,
        rr = Math.max(0, Math.min(1, reach - lag)) * back,
        curl = (strike ? (i % 2 ? 0.5 : -0.5) : i ? 1.2 : -1.2) * (1.25 - rr);
      const tip = tentacle(
        fx,
        x + Math.cos(angle + off) * 12,
        cy + Math.sin(angle + off) * 8,
        angle + off - curl * 0.5,
        range * 0.92 * rr,
        curl,
        strike ? 9 : 11,
        fade,
        k * 8 + i * 1.7,
      );
      if (tip && rr > 0.85) fx.glow(tip.x, tip.y, 16, color, 0.45 * fade);
    }
    // The slash streak along the reach.
    const pts = Array.from({ length: 14 }, (_, i) => {
      const aa = angle - spread + (2 * spread * i) / 13;
      return {
        x: x + Math.cos(aa) * range * 0.85,
        y: cy + Math.sin(aa) * range * 0.85 * SQ,
      };
    });
    if (k > 0.15 && k < 0.7) {
      const s = 1 - Math.abs((k - 0.4) / 0.3);
      fx.solid.lineStyle(8, INK_BLACK, 0.25 * s).strokePoints(pts, false);
      fx.g.lineStyle(5, color, 0.6 * s).strokePoints(pts, false);
      fx.g.lineStyle(1.5, SUCKER, 0.9 * s).strokePoints(pts, false);
    }
  });
  const tx = start.x + Math.cos(angle) * range * 0.8,
    ty = start.y + Math.sin(angle) * range * 0.8;
  inkDrops(fx, tx, ty, strike ? 12 : 5, [60, 200], { angle, spread: spread });
  if (strike) {
    wisps(fx, tx, ty, 5, [40, 140]);
    fx.shake(110, 0.003);
  }
}

// ───────────── Ink Jet ─────────────
function inkJet(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    dir = Math.atan2(pr.vy, pr.vx),
    cos = Math.cos(dir),
    sin = Math.sin(dir),
    x = pr.x,
    y = pr.y - 12;
  fx.solid
    .fillStyle(0x000000, 0.2)
    .fillEllipse(pr.x, pr.y + 10, r * 2.4, r * 0.7);
  // The jet: a stream that thins out behind the leading glob.
  for (let i = 5; i >= 0; i--) {
    const d = i * r * 0.9,
      wob = Math.sin(now / 45 - i * 1.3) * r * 0.18,
      s = r * (1 - i * 0.13);
    const px = x - cos * d - sin * wob,
      py = y - sin * d + cos * wob;
    fx.solid.fillStyle(INK_BLACK, 0.9 - i * 0.1).fillCircle(px, py, s * 1.08);
    fx.solid.fillStyle(INK_DEEP, 0.95 - i * 0.12).fillCircle(px, py, s * 0.9);
  }
  fx.glow(x, y, r * 2.4, pr.color, 0.35);
  fx.solid.lineStyle(2, pr.color, 0.85).strokeCircle(x, y, r * 0.95);
  // Glossy shine on the ink.
  fx.solid
    .fillStyle(SUCKER, 0.85)
    .fillEllipse(x - r * 0.3, y - r * 0.4, r * 0.55, r * 0.28);
  fx.trail(`ij${pr.id}`, 0.035, () =>
    inkDrops(fx, x - cos * r * 3, pr.y, 1, [10, 40], {
      angle: dir + Math.PI,
      spread: 0.5,
      z: 12,
    }),
  );
}
/** The ink lands: a splat on the floor and drops everywhere. */
function inkSplat(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = a.radius;
  fx.decal({ kind: "wet", x, y, r: r * 2.4, color: INK_BLACK, life: 2.6 });
  // Flung drops land around it as their own little splats.
  for (let i = 0; i < 5; i++) {
    const aa = hash(x * 3 + i) * TAU,
      d = r * (2.2 + hash(y + i * 7) * 2.6);
    fx.decal({
      kind: "wet",
      x: x + Math.cos(aa) * d,
      y: y + Math.sin(aa) * d * SQ,
      r: r * (0.35 + hash(i + x) * 0.35),
      color: INK_BLACK,
      life: 2.2,
    });
  }
  inkDrops(fx, x, y, 16, [60, 240]);
  fx.burst({
    x,
    y,
    z: 14,
    count: 5,
    kind: "smoke",
    color: [INK_DEEP, 0x3a2470],
    speed: [20, 60],
    up: [10, 40],
    life: [0.5, 0.9],
    size: [8, 13],
    drag: 2,
  });
  wisps(fx, x, y, 3);
  shot(fx.reduced ? 160 : 360, (k) => {
    const out = ease(Math.min(1, k * 2.5)),
      fade = 1 - k;
    // A splat with blobby fingers.
    fx.floorSolid
      .fillStyle(INK_BLACK, 0.6 * fade)
      .fillEllipse(x, y, r * 3 * out, r * 3 * SQ * out);
    for (let i = 0; i < 7; i++) {
      const aa = (i * TAU) / 7 + 0.4,
        d = r * (1.6 + hash(i) * 0.9) * out;
      fx.floorSolid
        .fillStyle(INK_DEEP, 0.7 * fade)
        .fillCircle(x + Math.cos(aa) * d, y + Math.sin(aa) * d * SQ, r * 0.35);
    }
    fx.glow(x, y - 8, r * 2.2 * (1 - k * 0.5), color, 0.5 * fade);
  });
}
/** Kraken Grasp: the thrown enemy crashes down in a splash of ink. */
function krakenLand(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = a.explosion ?? 90;
  fx.decal({ kind: "wet", x, y, r: r * 0.8, color: INK_BLACK, life: 2.4 });
  fx.decal({ kind: "crack", x, y, r: r * 0.6, color, life: 3 });
  inkDrops(fx, x, y, 22, [80, 300]);
  // The body hits the floor: grit jumps and a dust ring rolls out.
  fx.burst({
    x,
    y,
    z: 4,
    count: 10,
    kind: "debris",
    color: [0x6b5a48, 0x4a3b30],
    speed: [80, 220],
    up: [150, 320],
    life: [0.5, 0.8],
    size: [1.6, 3],
    grav: 1100,
    bounce: 0.35,
  });
  fx.burst({
    x,
    y,
    z: 4,
    count: 10,
    kind: "smoke",
    color: [0xb8a890, 0x8f7f6a],
    speed: [r, r * 2],
    up: [5, 30],
    life: [0.5, 0.9],
    size: [10, 16],
    drag: 2.4,
  });
  fx.shake(200, 0.007);
  shot(fx.reduced ? 180 : 420, (k) => {
    const out = ease(Math.min(1, k * 2.2)),
      fade = 1 - k;
    fx.floorSolid
      .fillStyle(INK_BLACK, 0.55 * fade)
      .fillEllipse(x, y, r * 2 * out, r * 2 * SQ * out);
    fx.shockwave(x, y, r * out, k, color, 6);
    fx.glow(x, y - 10, r * (1 - k * 0.5), color, 0.5 * fade);
  });
}
function inkCast(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    mx = x + Math.cos(angle) * 24,
    my = y - 14 + Math.sin(angle) * 24;
  inkDrops(fx, mx, my + 14, 4, [60, 160], { angle, spread: 0.4 });
  shot(160, (k) => {
    fx.soft(mx, my, 16 * (1 - k * 0.4), INK_BLACK, 0.6 * (1 - k));
    fx.glow(mx, my, 24, color, 0.5 * (1 - k));
  });
}

// ───────────── Ink Cloud ─────────────
/**
 * Shadopus blows a cloud of ink and is gone: a billow of real dark that
 * hangs for a moment, two glowing eyes blinking out inside it, and an ink
 * pool on the floor.
 */
function inkCloud(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  _angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    ms = Math.min(1600, Math.max(700, (a.statusDuration || 1.2) * 800)),
    cy = y - 22,
    R = 70;
  fx.decal({ kind: "wet", x, y, r: R * 0.9, color: INK_BLACK, life: 3 });
  inkDrops(fx, x, y, 14, [80, 220]);
  wisps(fx, x, y, 10, [40, 160]);
  const puffs = Array.from({ length: 11 }, (_, i) => ({
    a: (i * TAU) / 11 + hash(i * 7) * 0.5,
    d: 0.25 + hash(i * 3) * 0.6,
    s: 0.4 + hash(i * 5) * 0.25,
    lift: hash(i + 2) * 30,
  }));
  shot(fx.reduced ? 400 : ms, (k) => {
    const grow = ease(Math.min(1, k / 0.18)),
      fade = k > 0.45 ? 1 - (k - 0.45) / 0.55 : 1,
      spread = R * (0.6 + 0.4 * grow + k * 0.25);
    for (const p of puffs) {
      const px = x + Math.cos(p.a + k * 0.6) * spread * p.d,
        py = cy + Math.sin(p.a + k * 0.6) * spread * p.d * 0.6 - p.lift * k;
      fx.soft(px, py + 6, R * p.s * 1.15 * grow, INK_BLACK, 0.55 * fade);
      fx.soft(px, py, R * p.s * grow, INK_DEEP, 0.6 * fade);
    }
    fx.glow(x, cy, R * 0.9 * grow, color, 0.25 * fade);
    // Two eyes over the mask, closing as it vanishes.
    const open = k < 0.4 ? 1 : Math.max(0, 1 - (k - 0.4) / 0.15);
    if (open > 0)
      for (const side of [-1, 1]) {
        const ex = x + side * 11,
          ey = cy - 4;
        fx.glow(ex, ey, 12, color, 0.7 * open);
        fx.solid.fillStyle(SUCKER, open).fillEllipse(ex, ey, 9, 5 * open + 0.5);
        fx.solid.fillStyle(INK_BLACK, open).fillCircle(ex, ey, 1.6 * open);
      }
  });
}

// ───────────── Kraken Grasp ─────────────
/** Where Kraken Grasp's arms come up: across the arc, out to the range. */
const graspArms = (a: Ability, angle: number) => {
  const spread = Math.min(Math.PI, Math.acos(a.arc ?? 0)),
    n = 8;
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n,
      ang = angle - spread + 2 * spread * t;
    return { ang, d: a.range * (0.72 + hash(i * 9) * 0.22), i };
  });
};
/**
 * Wind-up: an ink pool spreads over the grasp's real area and tentacle tips
 * break the surface around its edge, curling, ready to snap shut.
 */
function graspWindup(
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
    spread = Math.min(Math.PI, Math.acos(a.arc ?? 0)),
    range = a.range;
  fx.floorSolid
    .fillStyle(INK_BLACK, 0.18 + k * 0.25)
    .slice(x, y, range * Math.min(1, 0.3 + k), angle - spread, angle + spread);
  fx.floorSolid.fillPath();
  fx.floor
    .lineStyle(2.5, color, 0.5 + k * 0.4)
    .beginPath()
    .arc(x, y, range, angle - spread, angle + spread)
    .strokePath();
  fx.glow(x, y, range * 0.7, color, 0.12 + k * 0.2, true);
  for (const arm of graspArms(a, angle)) {
    const px = x + Math.cos(arm.ang) * arm.d,
      py = y + Math.sin(arm.ang) * arm.d,
      rise = Math.max(0, Math.min(1, k * 1.6 - hash(arm.i) * 0.5)),
      wave = Math.sin(now / 120 + arm.i) * 0.5;
    fx.floorSolid
      .fillStyle(INK_BLACK, 0.6 * rise)
      .fillEllipse(px, py, 22 * rise + 2, 9 * rise + 1);
    tentacle(fx, px, py, -Math.PI / 2 + wave, 34 * rise, 1.6 + wave, 8, rise);
  }
  // Eyes glinting over the pool.
  fx.glow(x, y - 30, 30 + k * 30, color, 0.3 + k * 0.4);
  if (!fx.reduced && k > 0.6 && Math.floor(now / 60) % 2 === 0)
    g.scene.cameras.main.shake(50, 0.001, false);
}
/**
 * Every tentacle bursts up at once across the arc and snaps shut on the
 * caster; an ink shockwave rolls to the range. The lights go out for the
 * ultimate.
 */
function krakenGrasp(
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
    spread = Math.min(Math.PI, Math.acos(a.arc ?? 0)),
    range = a.range,
    arms = graspArms(a, angle);
  fx.ultimate(color, 800, true);
  fx.shake(260, 0.008);
  fx.decal({ kind: "wet", x, y, r: 46, color: INK_BLACK, life: 3.5 });
  for (const arm of arms) {
    const px = x + Math.cos(arm.ang) * arm.d,
      py = y + Math.sin(arm.ang) * arm.d;
    inkDrops(fx, px, py, 4, [40, 140], { z: 4 });
    fx.burst({
      x: px,
      y: py,
      count: 3,
      kind: "debris",
      color: [0x6d6460, 0x4a4350],
      speed: [40, 140],
      up: [120, 260],
      life: [0.5, 0.9],
      size: [2, 3.5],
      grav: 1000,
    });
  }
  shot(fx.reduced ? 300 : 900, (k) => {
    // The strike stays on the caster while it moves.
    const { x, y } = at?.() ?? origin;
    const fade = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    fx.floorSolid
      .fillStyle(INK_BLACK, 0.35 * fade)
      .slice(x, y, range, angle - spread, angle + spread);
    fx.floorSolid.fillPath();
    fx.floor
      .fillStyle(color, 0.14 * fade)
      .slice(x, y, range, angle - spread, angle + spread);
    fx.floor.fillPath();
    // Shockwave along the reach of the grasp.
    const wave = range * ease(Math.min(1, k * 2));
    fx.floor
      .lineStyle(12 * (1 - k), color, 0.35 * (1 - k))
      .beginPath()
      .arc(x, y, wave, angle - spread, angle + spread)
      .strokePath();
    fx.floor
      .lineStyle(4 * (1 - k), SUCKER, 0.85 * (1 - k))
      .beginPath()
      .arc(x, y, wave, angle - spread, angle + spread)
      .strokePath();
    // Arms: up from the floor (first third), then whip in toward the caster.
    for (const arm of [...arms].sort(
      (p, q) => Math.sin(p.ang) - Math.sin(q.ang),
    )) {
      const px = x + Math.cos(arm.ang) * arm.d,
        py = y + Math.sin(arm.ang) * arm.d,
        up = ease(Math.min(1, k / 0.25)),
        grab = Math.max(0, Math.min(1, (k - 0.25) / 0.3)),
        len = (46 + 60 * up) * (1 - grab * 0.2);
      fx.floorSolid
        .fillStyle(INK_BLACK, 0.7 * fade)
        .fillEllipse(px, py, 30, 12);
      // Rise straight up, then lean over toward the caster (shortest turn).
      const toward = Math.atan2(y - 20 - py, x - px),
        turn = Math.atan2(
          Math.sin(toward + Math.PI / 2),
          Math.cos(toward + Math.PI / 2),
        );
      tentacle(
        fx,
        px,
        py,
        -Math.PI / 2 + turn * grab * 0.7,
        len,
        (turn >= 0 ? 1 : -1) * (0.6 + grab * 1.2),
        16,
        fade,
      );
    }
    fx.glow(x, y - 20, range * 0.6 * (1 - k * 0.4), color, 0.4 * fade);
    if (k < 0.1) fx.glow(x, y - 20, 60, SUCKER, 0.8 * (1 - k / 0.1));
  });
}

export const shadowKit: FxKit = {
  projectile: {
    "lantern-wisp": lanternWisp,
    ghostfire,
    "shade-crawl": shadeCrawl,
    // The lantern's shots are small wisps.
    "haunted-lantern-shot": lanternWisp,
    "void-orb": voidOrb,
    "ink-jet": inkJet,
  },
  zone: { "haunted-lantern": hauntedLantern },
  windup: { "void-orb": voidWindup, "kraken-grasp": graspWindup },
  cast: {
    "tentacle-lash": lash,
    "ink-jet": inkCast,
    "ink-strike": lash,
    "ink-cloud": inkCloud,
    "kraken-grasp": krakenGrasp,
    "lantern-wisp": shadowCast,
    ghostfire: shadowCast,
    "shade-crawl": shadowCast,
    "haunted-lantern": shadowCast,
  },
  impact: {
    "void-orb": voidBurst,
    "ink-jet": inkSplat,
    "kraken-grasp": krakenLand,
    "haunted-lantern-shot": wispImpact,
    "lantern-wisp": wispImpact,
    ghostfire: wispImpact,
    "shade-crawl": wispImpact,
  },
  hit: { shadow: shadowHit },
};
