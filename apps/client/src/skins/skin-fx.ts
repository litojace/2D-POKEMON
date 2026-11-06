import { WORLD_ART } from "../../../../packages/shared/src/world-art";
import type Phaser from "phaser";
import { hexToNumber, type SkinArt, type Trail } from "./skin-art";
import { VOID_KNIGHTS } from "./mythic-art";

/**
 * In-game extras for Shop skins, drawn by the rig each frame: dash trails
 * (Rare and up), a small animated detail (Epic and up) and the Mythicals'
 * Awakening effects. They are cosmetic only: nothing here touches hitboxes,
 * sizes or timing, and none of it draws when motion is reduced (the rig skips
 * its effects then).
 */
export type FxShape =
  | "dot"
  | "spark"
  | "star"
  | "bubble"
  | "puff"
  | "pebble"
  | "confetti"
  | "leaf"
  | "coin"
  | "pixel"
  | "flake"
  | "ring"
  /** A column of light rising from the feet (tiered entrances). */
  | "beam"
  /** A flat ring sweeping out across the ground. */
  | "shock"
  /** A streak of light trailing behind the particle as it flies. */
  | "ray";
export interface FxParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: number;
  shape: FxShape;
  spin?: number;
  /** A soft halo under the particle (cosmetic entrances and victories). */
  glow?: boolean;
  /** Cosmetic sparks emitted behind the body stay behind as they rise. */
  behind?: boolean;
}
export interface FxContext {
  g: Phaser.GameObjects.Graphics;
  /** Drawn behind the fighter. */
  under: Phaser.GameObjects.Graphics;
  emit: (p: FxParticle) => void;
  chance: (rate: number, dt: number) => boolean;
  /** Where the fighter's feet are, and the head top, in screen pixels. */
  x: number;
  y: number;
  headX: number;
  headY: number;
  sc: number;
  now: number;
  dt: number;
  angle: number;
  moving: boolean;
  dashing: boolean;
  hurt: boolean;
  defeated: boolean;
  /** This frame starts the round greeting, the victory, or the knockout. */
  greeting: boolean;
  celebrating: boolean;
  knockedOut: boolean;
  /** An ultimate just went off. */
  ultimate: boolean;
  /** Extra ambient particles are within the on-screen budget; ornaments always draw. */
  ambient: boolean;
  /** Height/width of the ground plane (the fighter's shadow and auras). */
  flat?: number;
}

const TRAIL_SHAPE: Record<Trail, FxShape> = {
  snow: "flake",
  confetti: "confetti",
  spice: "dot",
  lily: "leaf",
  coin: "coin",
  petal: "leaf",
  leaf: "leaf",
  page: "confetti",
  bubble: "bubble",
  dust: "dot",
  pixel: "pixel",
  star: "star",
  ember: "dot",
  void: "puff",
};
/** Extra gravity per shape (px/s²); negative floats up. */
export const FX_GRAVITY: Partial<Record<FxShape, number>> = {
  confetti: 90,
  leaf: 40,
  coin: 260,
  flake: 25,
  pixel: 0,
  puff: 20,
  star: -6,
  pebble: 420,
};
const pick = (colors: number[]) => colors[Math.floor(Math.random() * colors.length)];

/** Particles left behind while moving (a few) and dashing (a burst). */
function trail(ctx: FxContext, art: SkinArt) {
  if (!art.trail || ctx.defeated) return;
  const rate = ctx.dashing ? 40 : ctx.moving ? 6 : 0;
  if (!rate || !ctx.chance(rate, ctx.dt)) return;
  const back = ctx.angle + Math.PI;
  const shape = TRAIL_SHAPE[art.trail.kind];
  ctx.emit({
    x: ctx.x + Math.cos(back) * 12 * ctx.sc + (Math.random() - 0.5) * 14 * ctx.sc,
    y: ctx.y - 4 * ctx.sc + (Math.random() - 0.5) * 10 * ctx.sc,
    vx: Math.cos(back) * 30 + (Math.random() - 0.5) * 30,
    vy: (shape === "bubble" || shape === "star" ? -24 : -12) - Math.random() * 18,
    life: 0.5 + Math.random() * 0.35,
    size: (shape === "confetti" || shape === "pixel" ? 2.4 : 2) * ctx.sc + Math.random() * ctx.sc,
    color: pick(art.trail.colors),
    shape,
    spin: (Math.random() - 0.5) * 12,
  });
}

/** A four-point sparkle. */
export function sparkle(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, color: number, alpha: number) {
  g.fillStyle(color, alpha)
    .fillTriangle(x - s * 0.35, y, x + s * 0.35, y, x, y - s * 1.3)
    .fillTriangle(x - s * 0.35, y, x + s * 0.35, y, x, y + s * 1.3)
    .fillTriangle(x, y - s * 0.35, x, y + s * 0.35, x - s * 1.3, y)
    .fillTriangle(x, y - s * 0.35, x, y + s * 0.35, x + s * 1.3, y);
}

/** Epic and Mythical: a small looping detail in the skin's colour. */
function detail(ctx: FxContext, art: SkinArt) {
  const { g, x, y, sc, now } = ctx;
  const color = art.skill ?? 0xffffff;
  const mid = y - 10 * sc;
  switch (art.detail) {
    case "pulse": {
      const k = (now / 1100) % 1;
      g.lineStyle(1.6 * sc, color, 0.45 * (1 - k)).strokeCircle(x, mid, (10 + k * 18) * sc);
      break;
    }
    case "glint": {
      // A glint sweeps across every 2.4 s.
      const k = (now / 2400) % 1;
      if (k < 0.2) sparkle(g, ctx.headX + (k / 0.2 - 0.5) * 30 * sc, ctx.headY + 10 * sc, 3.2 * sc, 0xffffff, Math.sin((k / 0.2) * Math.PI));
      break;
    }
    case "flicker": {
      const f = 0.7 + Math.sin(now / 70) * 0.15 + Math.sin(now / 33) * 0.1;
      g.fillStyle(color, 0.22 * f).fillCircle(ctx.headX, ctx.headY - 2 * sc, 9 * sc);
      g.fillStyle(0xffffff, 0.8 * f).fillEllipse(ctx.headX, ctx.headY - 4 * sc, 3 * sc, 6 * sc * f);
      break;
    }
    case "shimmer":
      if (ctx.chance(5, ctx.dt)) {
        const a = Math.random() * Math.PI * 2;
        ctx.emit({
          x: x + Math.cos(a) * 18 * sc,
          y: mid + Math.sin(a) * 18 * sc,
          vx: 0,
          vy: -8,
          life: 0.6,
          size: 1.8 * sc,
          color,
          shape: "star",
        });
      }
      break;
    case "gears": {
      const r = 5 * sc,
        cx = x + 18 * sc,
        cy = mid - 16 * sc,
        a0 = now / 500;
      g.lineStyle(1.4 * sc, color, 0.7).strokeCircle(cx, cy, r);
      for (let i = 0; i < 6; i++) {
        const a = a0 + (i / 6) * Math.PI * 2;
        g.lineBetween(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a) * (r + 2.5 * sc), cy + Math.sin(a) * (r + 2.5 * sc));
      }
      break;
    }
    case "frost":
      if (ctx.chance(4, ctx.dt))
        ctx.emit({
          x: x + (Math.random() - 0.5) * 30 * sc,
          y: mid + (Math.random() - 0.5) * 24 * sc,
          vx: 0,
          vy: 10,
          life: 0.8,
          size: 2 * sc,
          color: 0xffffff,
          shape: "flake",
        });
      break;
  }
}

/** Points around an ellipse, for orbiting motes. */
const orbit = (ctx: FxContext, i: number, n: number, speed: number, rx: number, ry: number, dy = -10) => {
  const a = ctx.now / speed + (i / n) * Math.PI * 2;
  return {
    x: ctx.x + Math.cos(a) * rx * ctx.sc,
    y: ctx.y + dy * ctx.sc + Math.sin(a) * ry * ctx.sc,
    front: Math.sin(a) > 0,
  };
};

/** Skin rings lie where the shadow and auras do: centred on the feet, on the
 * same ground plane, so they stay parallel with them. */
const groundFlat = (ctx: FxContext) => ctx.flat ?? WORLD_ART.groundY;
const groundY = (ctx: FxContext) => ctx.y + WORLD_ART.fighterFeet * ctx.sc;

/** Split a ground ring at its side points so its far arc is occluded. */
function groundRing(
  ctx: FxContext,
  width: number,
  color: number,
  alpha: number,
  lineWidth: number,
) {
  const { x, sc, g, under } = ctx;
  const cy = groundY(ctx),
    rx = width / 2,
    ry = (width * groundFlat(ctx)) / 2;
  for (let half = 0; half < 2; half++) {
    const layer = half === 0 ? g : under;
    layer.lineStyle(lineWidth, color, alpha).beginPath();
    for (let i = 0; i <= 32; i++) {
      const a = half * Math.PI + (i / 32) * Math.PI;
      const px = x + Math.cos(a) * rx,
        py = cy + Math.sin(a) * ry;
      if (i === 0) layer.moveTo(px, py);
      else layer.lineTo(px, py);
    }
    layer.strokePath();
  }
}

/**
 * The Void Knights' Awakening effects, in each knight's rune colour.
 * Stage I: black smoke curls off the armour with rune sparks.
 * Stage II: a rune circle turns on the ground beneath it.
 * Stage III: void flames lick up behind it and rune shards orbit it.
 */
function mythic(ctx: FxContext, art: SkinArt, stage: number) {
  const { g, under, x, y, sc, now } = ctx;
  const knight = art.mythic ? VOID_KNIGHTS[art.mythic] : undefined;
  if (!knight) return;
  const color = art.skill ?? 0xffffff;
  const hot = hexToNumber(knight.hot);
  const mid = y - 10 * sc;
  if (ctx.ambient && ctx.chance(stage >= 2 ? 9 : 6, ctx.dt))
    ctx.emit({
      x: x + (Math.random() - 0.5) * 34 * sc,
      y: mid + (Math.random() - 0.1) * 22 * sc,
      vx: (Math.random() - 0.5) * 10,
      vy: -22 - Math.random() * 16,
      life: 0.9,
      size: (2.4 + Math.random() * 1.6) * sc,
      color: 0x120a1e,
      shape: "puff",
      behind: true,
    });
  if (ctx.ambient && ctx.chance(stage >= 3 ? 7 : 3, ctx.dt))
    ctx.emit({
      x: x + (Math.random() - 0.5) * 30 * sc,
      y: mid + (Math.random() - 0.3) * 24 * sc,
      vx: (Math.random() - 0.5) * 16,
      vy: -30 - Math.random() * 20,
      life: 0.6,
      size: 1.6 * sc,
      color: Math.random() < 0.6 ? color : hot,
      shape: "spark",
    });
  if (stage >= 2) {
    // A rune circle: a ring with glyph ticks that turns slowly.
    const k = 0.5 + Math.sin(now / 520) * 0.5;
    const w = 56 * sc;
    groundRing(ctx, w, color, 0.3 + k * 0.25, 1.8 * sc);
    groundRing(ctx, w * 0.78, color, 0.18 + k * 0.12, 1.2 * sc);
    const cy = groundY(ctx),
      flat = groundFlat(ctx);
    for (let i = 0; i < 8; i++) {
      const a = now / 2600 + (i / 8) * Math.PI * 2;
      const r0 = w * 0.39,
        r1 = w * 0.5;
      const layer = Math.sin(a) > 0 ? g : under;
      layer
        .lineStyle(1.6 * sc, i % 2 ? color : hot, 0.55 + k * 0.3)
        .lineBetween(x + Math.cos(a) * r0, cy + Math.sin(a) * r0 * flat, x + Math.cos(a) * r1, cy + Math.sin(a) * r1 * flat);
    }
  }
  if (stage >= 3) {
    // Void flames behind the body: dark tongues edged in rune light.
    for (let i = 0; i < 7; i++) {
      const t = (i - 3) / 3;
      const fx = x + t * 22 * sc,
        base = y + 2 * sc,
        h = (32 - Math.abs(t) * 10 + Math.sin(now / 110 + i * 1.7) * 6) * sc,
        w = 6 * sc;
      under.fillStyle(color, 0.5).fillTriangle(fx - w - 2 * sc, base, fx + w + 2 * sc, base, fx + t * 5 * sc, base - h - 5 * sc);
      under.fillStyle(0x0c0614, 0.75).fillTriangle(fx - w, base, fx + w, base, fx + t * 4 * sc, base - h);
    }
    // Three rune shards orbit at chest height.
    for (let i = 0; i < 3; i++) {
      const o = orbit(ctx, i, 3, 1100, 30, 10, -14);
      const tgt = o.front ? g : under;
      const s = 3.4 * sc;
      tgt.fillStyle(color, 0.3).fillCircle(o.x, o.y, s * 1.8);
      tgt.fillStyle(0x1a1028, 1).fillTriangle(o.x, o.y - s * 1.5, o.x + s, o.y, o.x - s, o.y).fillTriangle(o.x, o.y + s * 1.5, o.x + s, o.y, o.x - s, o.y);
      tgt.lineStyle(1.1 * sc, hot, 0.95).strokeTriangle(o.x, o.y - s * 1.5, o.x + s, o.y, o.x - s, o.y).strokeTriangle(o.x, o.y + s * 1.5, o.x + s, o.y, o.x - s, o.y);
    }
  }
}

/** Draw a skin's extras for one frame (the rig then draws all particles). */
export function drawSkinFx(ctx: FxContext, art: SkinArt | undefined, stage: number) {
  if (!art) return;
  trail(ctx, art);
  moments(ctx, art, stage);
  if (ctx.defeated) return;
  detail(ctx, art);
  if (art.mythic) mythic(ctx, art, stage);
}

/** One-off bursts: KO poof (Epic+), Mythical entrance, victory and ultimate. */
function moments(ctx: FxContext, art: SkinArt, stage: number) {
  const color = art.skill;
  if (color === undefined) return;
  const colors = art.trail?.colors.length ? art.trail.colors : [color];
  const burst = (n: number, speed: number, shape: FxShape, dy = -10, life = 0.7) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const v = speed * (0.6 + Math.random() * 0.5);
      ctx.emit({
        x: ctx.x,
        y: ctx.y + dy * ctx.sc,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v * 0.7 - 20,
        life,
        size: 2.4 * ctx.sc,
        color: i % 2 ? color : pick(colors),
        shape,
        spin: (Math.random() - 0.5) * 10,
      });
    }
  };
  // Epic and up: a custom knockout poof in the skin's colours.
  if (ctx.knockedOut) burst(14, 80, "puff", -8, 0.8);
  if (!art.mythic) return;
  // Mythicals: their own entrance and victory. A Void Knight arrives in a
  // rune shockwave and a plume of black smoke, and wins in a shower of sparks.
  if (ctx.greeting) {
    burst(16, 110, "puff", -12, 0.9);
    burst(14, 150, "spark", -14, 0.7);
    ctx.emit({ x: ctx.x, y: ctx.y + 4 * ctx.sc, vx: 0, vy: 0, life: 0.6, size: 10 * ctx.sc, color, shape: "shock" });
  }
  if (ctx.celebrating) {
    burst(24, 150, "spark", -26, 1);
    burst(10, 90, "star", -30, 1.1);
  }
  // Stage III: the full ultimate effect, a ring of the skin's colour.
  if (ctx.ultimate && stage >= 3) {
    burst(20, 170, "star", -10, 0.6);
    ctx.emit({ x: ctx.x, y: ctx.y - 10 * ctx.sc, vx: 0, vy: 0, life: 0.5, size: 18 * ctx.sc, color, shape: "ring" });
  }
}

/** Draw one particle of a skin-only shape. Returns false for the rig's own shapes. */
export function drawFxParticle(
  g: Phaser.GameObjects.Graphics,
  p: FxParticle & { age: number },
  fade: number,
) {
  const s = p.size;
  switch (p.shape) {
    case "confetti": {
      const a = p.age * (p.spin ?? 6);
      const w = Math.abs(Math.cos(a)) * s + 0.4;
      g.fillStyle(p.color, fade).fillRect(p.x - w, p.y - s * 0.6, w * 2, s * 1.2);
      return true;
    }
    case "pixel":
      g.fillStyle(p.color, fade).fillRect(p.x - s, p.y - s, s * 2, s * 2);
      return true;
    case "leaf": {
      const a = p.age * (p.spin ?? 4);
      const dx = Math.cos(a) * s * 1.4,
        dy = Math.sin(a) * s * 1.4;
      g.fillStyle(p.color, fade)
        .fillTriangle(p.x - dx, p.y - dy, p.x + dx, p.y + dy, p.x - dy * 0.5, p.y + dx * 0.5)
        .fillTriangle(p.x - dx, p.y - dy, p.x + dx, p.y + dy, p.x + dy * 0.5, p.y - dx * 0.5);
      return true;
    }
    case "coin": {
      const w = Math.abs(Math.cos(p.age * 10)) * s + 0.5;
      g.fillStyle(p.color, fade).fillEllipse(p.x, p.y, w * 2, s * 2);
      g.lineStyle(1, 0x8a5a10, fade * 0.8).strokeEllipse(p.x, p.y, w * 2, s * 2);
      return true;
    }
    case "ring":
      g.lineStyle(3, p.color, fade).strokeCircle(p.x, p.y, p.size * (1 + p.age * 6));
      return true;
    case "beam": {
      // Narrow core inside a wider soft glow; it thins as it fades.
      const k = 1 - p.age / p.life,
        h = s * 9;
      g.fillStyle(p.color, 0.22 * fade).fillRect(p.x - s * 1.6 * k, p.y - h, s * 3.2 * k, h);
      g.fillStyle(0xffffff, 0.55 * fade).fillRect(p.x - s * 0.35 * k, p.y - h, s * 0.7 * k, h);
      g.fillStyle(p.color, 0.3 * fade).fillEllipse(p.x, p.y, s * 5 * k, s * 1.6 * k);
      return true;
    }
    case "shock": {
      const r = s * (1 + p.age * 9);
      g.lineStyle(2.6, p.color, fade).strokeEllipse(p.x, p.y, r * 2, r * 0.75);
      g.lineStyle(6, p.color, 0.25 * fade).strokeEllipse(p.x, p.y, r * 2.1, r * 0.8);
      return true;
    }
    case "ray": {
      // The tail points back along the flight; it shortens as it fades.
      const k = 0.11 * fade;
      g.lineStyle(s * 0.55, p.color, 0.35 * fade).lineBetween(p.x, p.y, p.x - p.vx * k, p.y - p.vy * k);
      g.lineStyle(s * 0.22, 0xffffff, 0.9 * fade).lineBetween(p.x, p.y, p.x - p.vx * k * 0.7, p.y - p.vy * k * 0.7);
      return true;
    }
    case "flake":
      g.lineStyle(1.1, p.color, fade)
        .lineBetween(p.x - s, p.y, p.x + s, p.y)
        .lineBetween(p.x - s * 0.5, p.y - s * 0.86, p.x + s * 0.5, p.y + s * 0.86)
        .lineBetween(p.x - s * 0.5, p.y + s * 0.86, p.x + s * 0.5, p.y - s * 0.86);
      return true;
  }
  return false;
}

/**
 * Draw any particle: the skin shapes above plus the rig's own (dot, bubble,
 * puff, pebble, spark, star). Shared by the rig and the Shop/Wardrobe live
 * thumbnails so both show exactly the same effect.
 */
export function drawAnyParticle(
  g: Phaser.GameObjects.Graphics,
  p: FxParticle & { age: number },
  fade: number,
) {
  if (p.glow && p.shape !== "ring" && p.shape !== "beam" && p.shape !== "shock" && p.shape !== "ray")
    g.fillStyle(p.color, 0.16 * fade).fillCircle(p.x, p.y, p.size * 2.6);
  if (drawFxParticle(g, p, fade)) return;
  const s = p.size;
  if (p.shape === "dot") g.fillStyle(p.color, 0.85 * fade).fillCircle(p.x, p.y, s);
  else if (p.shape === "bubble")
    g.lineStyle(1.2, p.color, 0.8 * fade).strokeCircle(p.x, p.y, s);
  else if (p.shape === "puff")
    g.fillStyle(p.color, 0.35 * fade).fillCircle(p.x, p.y, s * (1 + p.age * 2));
  else if (p.shape === "pebble")
    g.fillStyle(p.color, fade)
      .fillTriangle(p.x - s, p.y, p.x, p.y - s * 0.8, p.x + s, p.y)
      .fillTriangle(p.x - s, p.y, p.x, p.y + s * 0.7, p.x + s, p.y);
  else if (p.shape === "spark")
    g.lineStyle(1.6, p.color, fade)
      .lineBetween(p.x - s, p.y, p.x, p.y - s * 0.6)
      .lineBetween(p.x, p.y - s * 0.6, p.x + s * 0.4, p.y + s * 0.5);
  // A tiny four-point star.
  else sparkle(g, p.x, p.y, s, p.color, 0.9 * fade);
}
