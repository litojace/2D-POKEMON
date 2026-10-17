import type Phaser from "phaser";
import type { SkinArt, Trail } from "./skin-art";

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
  | "ring";
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
  /** Mythical ambient effects are within the on-screen budget. */
  ambient: boolean;
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

/**
 * Mythical Awakening effects. Stage 1 is the skin's signature effect,
 * stage 2 adds an orbit, stage 3 the full form (and its accessory).
 */
function mythic(ctx: FxContext, art: SkinArt, stage: number) {
  const { g, under, x, y, sc, now } = ctx;
  const color = art.skill ?? 0xffffff;
  const mid = y - 10 * sc;
  switch (art.mythic) {
    case "stormcrown": {
      // Crackling arcs leap across the body.
      if (Math.floor(now / 90) % (stage >= 2 ? 4 : 7) === 0) {
        const a = Math.random() * Math.PI * 2;
        let px = x + Math.cos(a) * 14 * sc,
          py = mid + Math.sin(a) * 14 * sc;
        g.lineStyle(1.6 * sc, color, 0.9).beginPath();
        g.moveTo(px, py);
        for (let k = 0; k < 4; k++) {
          px += Math.cos(a) * 5 * sc + (Math.random() - 0.5) * 8 * sc;
          py += Math.sin(a) * 5 * sc + (Math.random() - 0.5) * 8 * sc;
          g.lineTo(px, py);
        }
        g.strokePath();
      }
      if (stage >= 2)
        for (let i = 0; i < 3; i++) {
          const o = orbit(ctx, i, 3, 420, 26, 9, 2);
          sparkle(o.front ? g : under, o.x, o.y, 2.6 * sc, color, 0.9);
        }
      if (stage >= 3) {
        // A small storm cloud with rain flickers above the crown.
        const cx = ctx.headX,
          cy = ctx.headY - 26 * sc;
        g.fillStyle(0x5a6478, 0.85).fillCircle(cx - 8 * sc, cy, 6 * sc).fillCircle(cx, cy - 3 * sc, 8 * sc).fillCircle(cx + 9 * sc, cy, 6 * sc);
        if (Math.floor(now / 140) % 5 === 0)
          g.lineStyle(1.6 * sc, color, 1).lineBetween(cx, cy + 5 * sc, cx - 3 * sc, cy + 11 * sc).lineBetween(cx - 3 * sc, cy + 11 * sc, cx + 2 * sc, cy + 15 * sc);
      }
      break;
    }
    case "sunforged": {
      if (ctx.chance(stage >= 2 ? 14 : 8, ctx.dt))
        ctx.emit({
          x: x + (Math.random() - 0.5) * 30 * sc,
          y: mid + (Math.random() - 0.3) * 20 * sc,
          vx: (Math.random() - 0.5) * 12,
          vy: -40 - Math.random() * 30,
          life: 0.7,
          size: (1.4 + Math.random()) * sc,
          color: Math.random() < 0.5 ? 0xffd65b : 0xffb02e,
          shape: "dot",
        });
      if (stage >= 2) {
        const k = 0.5 + Math.sin(now / 300) * 0.5;
        g.lineStyle(2 * sc, 0xffd65b, 0.25 + k * 0.25).strokeEllipse(x, y + 20 * sc, 50 * sc, 16 * sc);
      }
      if (stage >= 3) {
        // A slowly turning sun behind the fighter.
        under.fillStyle(0xffd65b, 0.16).fillCircle(ctx.headX, ctx.headY + 14 * sc, 34 * sc);
        for (let i = 0; i < 12; i++) {
          const a = now / 2400 + (i / 12) * Math.PI * 2;
          under.lineStyle(3 * sc, 0xffb02e, 0.45).lineBetween(
            ctx.headX + Math.cos(a) * 30 * sc,
            ctx.headY + 14 * sc + Math.sin(a) * 30 * sc,
            ctx.headX + Math.cos(a) * 42 * sc,
            ctx.headY + 14 * sc + Math.sin(a) * 42 * sc,
          );
        }
      }
      break;
    }
    case "moontide": {
      // A crescent moon drifts around; the tide rises with each stage.
      const o = orbit(ctx, 0, 1, 900, 28, 10, -16);
      const tgt = o.front ? g : under;
      tgt.fillStyle(0xc8f6ff, 0.95).fillCircle(o.x, o.y, 5 * sc);
      tgt.fillStyle(0x070d24, 1).fillCircle(o.x + 2.4 * sc, o.y - 1 * sc, 4.4 * sc);
      if (ctx.chance(6, ctx.dt))
        ctx.emit({ x: x + (Math.random() - 0.5) * 30 * sc, y: y + 14 * sc, vx: 0, vy: -26, life: 0.9, size: 2 * sc, color: 0x7ff3ff, shape: "bubble" });
      if (stage >= 2)
        for (let i = 0; i < 2; i++) {
          const k = ((now / 1400 + i / 2) % 1);
          g.lineStyle(1.6 * sc, 0x7ff3ff, 0.5 * (1 - k)).strokeEllipse(x, y + 20 * sc, (40 + k * 40) * sc, (12 + k * 12) * sc);
        }
      if (stage >= 3) {
        under.fillStyle(0x7ff3ff, 0.12).fillEllipse(x, y + 18 * sc, 90 * sc, 26 * sc);
        for (let i = 0; i < 6; i++) {
          const wx = x + (i - 2.5) * 13 * sc;
          const wy = y + 18 * sc + Math.sin(now / 260 + i) * 2 * sc;
          under.lineStyle(1.4 * sc, 0xc8f6ff, 0.6).lineBetween(wx - 5 * sc, wy, wx + 5 * sc, wy);
        }
      }
      break;
    }
    case "celestial-sage":
    case "starweaver":
    case "oracle": {
      const n = stage >= 2 ? 5 : 3;
      const pts = Array.from({ length: n }, (_, i) => orbit(ctx, i, n, art.mythic === "oracle" ? 700 : 1100, 30, 11, -14));
      if (stage >= 3 || art.mythic === "starweaver") {
        // Threads join the stars into a moving constellation.
        g.lineStyle(1 * sc, color, 0.35);
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i],
            b = pts[(i + 1) % pts.length];
          if (a.front && b.front) g.lineBetween(a.x, a.y, b.x, b.y);
        }
      }
      for (const o of pts) {
        const tgt = o.front ? g : under;
        if (art.mythic === "oracle") {
          // Little watching eyes.
          tgt.fillStyle(0x1a0a2a, 0.9).fillEllipse(o.x, o.y, 7 * sc, 5 * sc);
          tgt.fillStyle(color, 1).fillCircle(o.x, o.y, 1.6 * sc);
        } else sparkle(tgt, o.x, o.y, 2.8 * sc, color, 0.95);
      }
      if (stage >= 3 && art.mythic === "oracle") {
        const k = (now / 1600) % 1;
        g.lineStyle(1.4 * sc, color, 0.5 * (1 - k)).strokeCircle(ctx.headX, ctx.headY + 14 * sc, (12 + k * 26) * sc);
      }
      if (art.mythic === "starweaver" && ctx.chance(stage >= 2 ? 10 : 5, ctx.dt))
        ctx.emit({ x: x + (Math.random() - 0.5) * 50 * sc, y: mid + (Math.random() - 0.5) * 20 * sc, vx: 0, vy: 14, life: 0.9, size: 1.8 * sc, color: 0xfff3b0, shape: "star" });
      break;
    }
    case "world-shell": {
      // Clouds drift around the little island; birds at stage 3.
      const clouds = stage >= 2 ? 2 : 1;
      for (let i = 0; i < clouds; i++) {
        const o = orbit(ctx, i, clouds, 2200, 24, 6, 0);
        const cx = ctx.headX + (o.x - x),
          cy = ctx.headY - 12 * sc + (o.y - y) * 0.6;
        (o.front ? g : under).fillStyle(0xffffff, 0.85).fillCircle(cx - 3 * sc, cy, 3.4 * sc).fillCircle(cx + 2 * sc, cy - 1.5 * sc, 4 * sc).fillCircle(cx + 6 * sc, cy, 3 * sc);
      }
      if (ctx.chance(stage >= 2 ? 4 : 2, ctx.dt))
        ctx.emit({ x: ctx.headX + 12 * sc, y: ctx.headY - 6 * sc, vx: 4, vy: 30, life: 0.5, size: 1.4 * sc, color: 0x7fd0ff, shape: "dot" });
      if (stage >= 3)
        for (let i = 0; i < 2; i++) {
          const a = now / 800 + i * Math.PI;
          const bx = ctx.headX + Math.cos(a) * 30 * sc,
            by = ctx.headY - 26 * sc + Math.sin(a * 2) * 4 * sc;
          const flap = Math.sin(now / 80 + i) * 2 * sc;
          g.lineStyle(1.3 * sc, 0x2a3a1c, 0.9).lineBetween(bx - 3 * sc, by - flap, bx, by).lineBetween(bx, by, bx + 3 * sc, by - flap);
        }
      break;
    }
    case "eclipse": {
      // A dark sun behind the head, ringed in light that brightens by stage.
      const r = 22 * sc,
        cx = ctx.headX,
        cy = ctx.headY + 16 * sc;
      const k = 0.5 + Math.sin(now / 500) * 0.5;
      under.fillStyle(0xffd65b, 0.12 + stage * 0.05).fillCircle(cx, cy, r + (6 + k * 4) * sc);
      under.lineStyle(2 * sc, 0xfff3b0, 0.5 + stage * 0.12).strokeCircle(cx, cy, r);
      if (stage >= 2)
        for (let i = 0; i < 16; i++) {
          const a = -now / 3000 + (i / 16) * Math.PI * 2;
          const len = (i % 2 ? 6 : 11) * sc;
          under.lineStyle(1.5 * sc, 0xffd65b, 0.55).lineBetween(cx + Math.cos(a) * (r + 2 * sc), cy + Math.sin(a) * (r + 2 * sc), cx + Math.cos(a) * (r + 2 * sc + len), cy + Math.sin(a) * (r + 2 * sc + len));
        }
      if (stage >= 3)
        for (let i = 0; i < 3; i++) {
          const o = orbit(ctx, i, 3, 1300, 30, 10, -12);
          sparkle(o.front ? g : under, o.x, o.y, 2.4 * sc, 0xfff3b0, 0.9);
        }
      break;
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
  if (art.mythic && ctx.ambient) mythic(ctx, art, stage);
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
  // Mythicals: their own entrance and victory bursts.
  if (ctx.greeting) burst(18, 120, art.trail ? TRAIL_SHAPE[art.trail.kind] : "star", -12, 0.9);
  if (ctx.celebrating) burst(24, 150, "star", -26, 1);
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
    case "flake":
      g.lineStyle(1.1, p.color, fade)
        .lineBetween(p.x - s, p.y, p.x + s, p.y)
        .lineBetween(p.x - s * 0.5, p.y - s * 0.86, p.x + s * 0.5, p.y + s * 0.86)
        .lineBetween(p.x - s * 0.5, p.y + s * 0.86, p.x + s * 0.5, p.y - s * 0.86);
      return true;
  }
  return false;
}
