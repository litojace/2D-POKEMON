import type Phaser from "phaser";
import type { CharacterId } from "@arena/shared";
import type { FxContext, FxShape } from "./skin-fx";
import { WORLD_ART } from "../../../../packages/shared/src/world-art";

/**
 * Signature effects for the Legendary Nova Vanguard suits: each of the 18 has
 * its own motif tied to its champion (Voltkit's pulse chevrons, Astrabun's
 * orbiting comet, Pyranda's medic cross...), plus a hero landing and a
 * victory. Epics keep the small glint every Epic has; motifs moving round
 * every fighter on the court read as clutter, so they stay a Legendary mark.
 *
 * Budget: every motif draws on the rig's two existing Graphics layers (no
 * scene objects). With `ambient` off (Low, or past the two-fighter battle
 * cap) it draws a compact version within 20 Graphics calls and emits
 * nothing; with it on, at most 40 calls and a few particles a second. An
 * ultimate swells the motif for under a second and throws one small burst
 * in its own shape. Nothing changes hitboxes, sizes or timing, and motifs
 * stay off the face: beside, behind, above the head or on the ground.
 */
type G = Phaser.GameObjects.Graphics;
interface Frame {
  ctx: FxContext;
  g: G;
  under: G;
  /** Feet line of the rig, chest and ground (the shadow's line). */
  x: number;
  y: number;
  body: number;
  chest: number;
  ground: number;
  /** Head top, and the head's centre and radius as drawn. */
  headX: number;
  headY: number;
  headCY: number;
  headR: number;
  /** Motif unit in pixels. */
  s: number;
  t: number;
  /** Facing: across the screen and toward the camera. */
  fx: number;
  fy: number;
  full: boolean;
  /** 1 normally; up to 1.7 while an ultimate swells the motif. */
  boost: number;
  c: number;
  h: number;
}
interface Signature {
  name: string;
  c: number;
  h: number;
  /** The particle its ultimate burst throws. */
  burst: FxShape;
  draw: (f: Frame) => void;
}

// ---- Small shapes (1–6 Graphics calls each). ----
const TAU = Math.PI * 2;
const wave = (k: number) => 0.5 + 0.5 * Math.sin(k * TAU);
const orbit = (f: Frame, i: number, n: number, period: number, rx: number, ry: number, dy: number) => {
  const a = (f.t / period) * TAU + (i / n) * TAU;
  return {
    x: f.x + Math.cos(a) * rx * f.s * f.boost,
    y: f.body + dy * f.s + Math.sin(a) * ry * f.s * f.boost,
    front: Math.sin(a) > 0,
    a,
  };
};
const on = (f: Frame, front: boolean) => (front ? f.g : f.under);
const dot = (g: G, x: number, y: number, r: number, c: number, a = 1) => g.fillStyle(c, a).fillCircle(x, y, r);
const glowDot = (g: G, x: number, y: number, r: number, c: number, a = 1) =>
  g
    .fillStyle(c, 0.25 * a)
    .fillCircle(x, y, r * 2.2)
    .fillStyle(c, a)
    .fillCircle(x, y, r)
    .fillStyle(0xffffff, 0.85 * a)
    .fillCircle(x - r * 0.3, y - r * 0.3, r * 0.4);
const sparkle = (g: G, x: number, y: number, s: number, c: number, a = 1) =>
  g
    .fillStyle(c, a)
    .fillTriangle(x - s * 0.35, y, x + s * 0.35, y, x, y - s * 1.3)
    .fillTriangle(x - s * 0.35, y, x + s * 0.35, y, x, y + s * 1.3)
    .fillTriangle(x, y - s * 0.35, x, y + s * 0.35, x - s * 1.3, y)
    .fillTriangle(x, y - s * 0.35, x, y + s * 0.35, x + s * 1.3, y);
const poly = (cx: number, cy: number, r: number, n: number, rot: number, squash = 1) =>
  Array.from({ length: n }, (_, i) => {
    const a = rot + (i / n) * TAU;
    return { x: cx + Math.cos(a) * r * squash, y: cy + Math.sin(a) * r };
  });
/** A curve sampled from a function of u in [0, 1]. */
const curve = (n: number, fn: (u: number) => { x: number; y: number }) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
/** A flat ring on the ground plane round (x, y): its far half behind the
 * fighter, its near half in front. */
const flatRing = (f: Frame, x: number, y: number, rx: number, ry: number, c: number, a: number, lw: number, segs = 10) => {
  for (const front of [false, true]) {
    const pts = curve(segs, (u) => {
      const ang = (front ? 0 : Math.PI) + u * Math.PI;
      return { x: x + Math.cos(ang) * rx, y: y + Math.sin(ang) * ry };
    });
    on(f, front).lineStyle(lw, c, a).strokePoints(pts);
  }
};
/** A ground ellipse centred on the feet, wholly behind the fighter. */
const groundEllipse = (f: Frame, w: number, c: number, a: number, lw = 1.4, x = f.x) =>
  f.under.lineStyle(lw * f.s, c, a).strokeEllipse(x, f.ground, w * f.s * f.boost, w * 0.32 * f.s * f.boost);

// ---- Nova Vanguard: hero energy, emblems and power rings. ----
const vanguard: Record<CharacterId, Signature> = {
  voltkit: {
    name: "Pulse chevrons",
    c: 0x7ff3ff,
    h: 0xfff07a,
    burst: "spark",
    draw: (f) => {
      // Energy chevrons climb above the head like a charging meter.
      for (let i = 0; i < (f.full ? 3 : 2); i++) {
        const k = (f.t / 1100 + i / 3) % 1;
        const y = f.headY - 2 * f.s - k * 26 * f.s;
        const w = 10 * f.s * f.boost;
        f.g.lineStyle(2.4 * f.s, i % 2 ? f.h : f.c, Math.sin(k * Math.PI)).strokePoints([
          { x: f.headX - w, y: y + 5 * f.s },
          { x: f.headX, y },
          { x: f.headX + w, y: y + 5 * f.s },
        ]);
      }
    },
  },
  cindrake: {
    name: "Solar halo",
    c: 0xffb347,
    h: 0xfff0a0,
    burst: "spark",
    draw: (f) => {
      // A ring of sun rays turns behind the head.
      const n = f.full ? 14 : 10;
      const r = f.headR + 4 * f.s * f.boost;
      for (let i = 0; i < n; i++) {
        const a = f.t / 2400 + (i / n) * TAU;
        const len = (i % 2 ? 5 : 9) * f.s * f.boost;
        f.under.lineStyle(2 * f.s, i % 2 ? f.h : f.c, 0.85).lineBetween(f.headX + Math.cos(a) * r, f.headCY + Math.sin(a) * r, f.headX + Math.cos(a) * (r + len), f.headCY + Math.sin(a) * (r + len));
      }
    },
  },
  tidefin: {
    name: "Riptide crescent",
    c: 0x5ff0ff,
    h: 0xffffff,
    burst: "bubble",
    draw: (f) => {
      // A crescent of water circles it like a spinning blade.
      const o = orbit(f, 0, 1, 1600, 36, 10, 0);
      const g = on(f, o.front);
      const r = 11 * f.s * f.boost;
      g.lineStyle(3.6 * f.s, f.c, 0.9).beginPath().arc(o.x, o.y, r, o.a + 1.2, o.a + 3.6).strokePath();
      g.lineStyle(1.2 * f.s, f.h, 0.9).beginPath().arc(o.x, o.y, r - 1.8 * f.s, o.a + 1.6, o.a + 3.2).strokePath();
      if (f.full) dot(g, o.x + Math.cos(o.a + 2.4) * r, o.y + Math.sin(o.a + 2.4) * r, 1.4 * f.s, f.h);
    },
  },
  auralynx: {
    name: "Prism panels",
    c: 0xbfa8ff,
    h: 0xffffff,
    burst: "star",
    draw: (f) => {
      // Hexagonal shield panels orbit, flaring as they pass in front.
      for (let i = 0; i < 3; i++) {
        const o = orbit(f, i, 3, 3800, 34, 10, -6);
        const g = on(f, o.front);
        const pts = poly(o.x, o.y, 5 * f.s * f.boost, 6, Math.PI / 6, 0.4 + 0.6 * Math.abs(Math.cos(o.a)));
        g.fillStyle(f.c, o.front ? 0.35 : 0.18).fillPoints(pts, true);
        g.lineStyle(1.2 * f.s, f.h, o.front ? 0.95 : 0.5).strokePoints(pts, true);
      }
    },
  },
  lumoth: {
    name: "Lumen beacons",
    c: 0xfff3b0,
    h: 0xa6ffd9,
    burst: "star",
    draw: (f) => {
      // Two beacon orbs orbit the wings; each pulses a ray downward.
      for (let i = 0; i < 2; i++) {
        const o = orbit(f, i, 2, 3000, 36, 9, -12);
        const g = on(f, o.front);
        const k = wave(f.t / 900 + i / 2);
        if (f.full) g.lineStyle(1 * f.s, f.c, 0.35 * k).lineBetween(o.x, o.y, o.x, f.ground);
        glowDot(g, o.x, o.y, (2 + k) * f.s * f.boost, i ? f.h : f.c);
      }
    },
  },
  mystowl: {
    name: "Living star chart",
    c: 0xd6e8ff,
    h: 0xffe19a,
    burst: "star",
    draw: (f) => {
      // A constellation behind it turns slowly, its stars twinkling.
      const n = f.full ? 6 : 4;
      const pts = poly(f.x, f.headCY, f.headR + 10 * f.s * f.boost, n, f.t / 6000).map((p, i) => ({
        x: p.x + (i % 2 ? 4 : -3) * f.s,
        y: p.y + (i % 3) * 3 * f.s,
      }));
      f.under.lineStyle(0.8 * f.s, f.c, 0.4).strokePoints(pts, false);
      pts.forEach((p, i) => {
        const r = (1.4 + 0.8 * wave(f.t / 1200 + i / n)) * f.s;
        if (f.full) sparkle(f.under, p.x, p.y, r, i % 2 ? f.h : f.c, 0.9);
        else dot(f.under, p.x, p.y, r * 0.7, i % 2 ? f.h : f.c, 0.9);
      });
    },
  },
  terradon: {
    name: "Bulwark ring",
    c: 0x9fe08a,
    h: 0xedcf94,
    burst: "leaf",
    draw: (f) => {
      // A hex-plated power ring turns on the ground round the shell.
      groundEllipse(f, 76, f.c, 0.6, 1.6);
      const n = f.full ? 8 : 6;
      for (let i = 0; i < n; i++) {
        const a = f.t / 3000 + (i / n) * TAU;
        const x = f.x + Math.cos(a) * 38 * f.s * f.boost,
          y = f.ground + Math.sin(a) * 12.2 * f.s * f.boost;
        on(f, Math.sin(a) > 0).fillStyle(f.h, 0.85).fillPoints(poly(x, y, 2.6 * f.s, 6, 0), true);
      }
    },
  },
  duskveil: {
    name: "Echo waves",
    c: 0xb8a8ff,
    h: 0xfff0b0,
    burst: "ring",
    draw: (f) => {
      // Echo rings pulse out from the hood, stretched wide like sound.
      const n = f.full ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const k = (f.t / 1800 + i / n) % 1;
        const r = f.headR + k * 24 * f.s * f.boost;
        f.under.lineStyle(1.4 * f.s, i ? f.c : f.h, 0.7 * (1 - k)).strokeEllipse(f.headX, f.headCY, r * 2.2, r * 1.4);
      }
    },
  },
  coilemur: {
    name: "Flux rings",
    c: 0x7ff3ff,
    h: 0xffd65b,
    burst: "spark",
    draw: (f) => {
      // Two induction rings slide up and down the body, out of step.
      for (let i = 0; i < 2; i++) {
        const k = wave(f.t / 1400 + i / 2);
        const y = f.ground - 6 * f.s - k * 36 * f.s;
        const rx = (20 - k * 4) * f.s * f.boost;
        flatRing(f, f.x, y, rx, rx * 0.2, i ? f.h : f.c, 0.9, 1.8 * f.s, 6);
      }
    },
  },
  pyranda: {
    name: "Medic cross",
    c: 0xffffff,
    h: 0xff6a7a,
    burst: "dot",
    draw: (f) => {
      // A medic's cross hovers overhead, beating like a heart.
      const k = wave(f.t / 1000);
      const s = (4 + k * 1.2) * f.s * f.boost;
      const cy = f.headY - 16 * f.s;
      f.g.fillStyle(f.h, 0.3).fillCircle(f.headX, cy, s * 2.2);
      f.g.fillStyle(f.c, 0.95).fillRect(f.headX - s * 0.4, cy - s * 1.2, s * 0.8, s * 2.4).fillRect(f.headX - s * 1.2, cy - s * 0.4, s * 2.4, s * 0.8);
      if (f.full && f.ctx.chance(2, f.ctx.dt))
        f.ctx.emit({ x: f.x + (Math.random() - 0.5) * 40 * f.s, y: f.body, vx: 0, vy: -24, life: 0.9, size: 1.8 * f.s, color: f.h, shape: "dot" });
    },
  },
  glacelle: {
    name: "Frost lattice",
    c: 0xd6f4ff,
    h: 0xffffff,
    burst: "flake",
    draw: (f) => {
      // A large snowflake glyph turns slowly behind her head.
      const cx = f.headX,
        cy = f.headCY;
      const r = f.headR + 14 * f.s * f.boost;
      const a0 = f.t / 4000;
      for (let i = 0; i < 6; i++) {
        const a = a0 + (i / 6) * TAU;
        const ex = cx + Math.cos(a) * r,
          ey = cy + Math.sin(a) * r;
        const bx = cx + Math.cos(a) * (r - 8 * f.s),
          by = cy + Math.sin(a) * (r - 8 * f.s);
        f.under.lineStyle(1.6 * f.s, f.c, 0.7).lineBetween(bx - Math.cos(a) * 6 * f.s, by - Math.sin(a) * 6 * f.s, ex, ey);
        if (f.full) f.under.lineBetween(bx, by, bx + Math.cos(a + 0.8) * 5 * f.s, by + Math.sin(a + 0.8) * 5 * f.s).lineBetween(bx, by, bx + Math.cos(a - 0.8) * 5 * f.s, by + Math.sin(a - 0.8) * 5 * f.s);
      }
    },
  },
  halcyra: {
    name: "Gale vortex",
    c: 0xbff6ff,
    h: 0xffffff,
    burst: "ray",
    draw: (f) => {
      // Wind loops spiral up round her, narrowing as they rise.
      const n = f.full ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const k = (f.t / 1300 + i / n) % 1;
        const y = f.ground - 4 * f.s - k * 54 * f.s;
        const rx = (34 - k * 12) * f.s * f.boost;
        const a = f.t / 200 + i;
        const pts = curve(6, (u) => {
          const ang = a + u * 2.4;
          return { x: f.x + Math.cos(ang) * rx, y: y + Math.sin(ang) * rx * 0.28 };
        });
        on(f, Math.sin(a + 1.2) > 0).lineStyle(1.6 * f.s, i % 2 ? f.h : f.c, 0.8 * Math.sin(k * Math.PI)).strokePoints(pts);
      }
    },
  },
  sunbara: {
    name: "Rising dawn",
    c: 0xffc84d,
    h: 0xfff3c0,
    burst: "star",
    draw: (f) => {
      // A dawn sun rises behind it, rays turning slowly.
      const r = f.headR + 6 * f.s * f.boost;
      const cy = f.headCY + f.headR * 0.4;
      f.under.fillStyle(f.c, 0.28).slice(f.x, cy, r, Math.PI, TAU, false).fillPath();
      const n = f.full ? 9 : 7;
      for (let i = 0; i < n; i++) {
        const a = Math.PI + ((i + 0.5) / n) * Math.PI + Math.sin(f.t / 1500) * 0.08;
        f.under.lineStyle(2 * f.s, f.h, 0.8).lineBetween(f.x + Math.cos(a) * (r + 3 * f.s), cy + Math.sin(a) * (r + 3 * f.s), f.x + Math.cos(a) * (r + 11 * f.s), cy + Math.sin(a) * (r + 11 * f.s));
      }
    },
  },
  astrabun: {
    name: "Orbiting comet",
    c: 0xa8e8ff,
    h: 0xffffff,
    burst: "star",
    draw: (f) => {
      // A little comet orbits, its tail streaming behind.
      const o = orbit(f, 0, 1, 2200, 36, 11, -6);
      const tail = curve(f.full ? 6 : 4, (u) => {
        const p = orbit({ ...f, t: f.t - u * 260 }, 0, 1, 2200, 36, 11, -6);
        return { x: p.x, y: p.y };
      });
      const g = on(f, o.front);
      g.lineStyle(3 * f.s, f.c, 0.45).strokePoints(tail);
      sparkle(g, o.x, o.y, 2.6 * f.s * f.boost, f.h);
    },
  },
  wombolder: {
    name: "Quake pulse",
    c: 0xffb347,
    h: 0xedcf94,
    burst: "pebble",
    draw: (f) => {
      // Cracks glow on the ground and a shock ring rolls out on each pulse.
      const k = (f.t / 1600) % 1;
      const glow = 1 - k;
      for (let i = 0; i < (f.full ? 6 : 4); i++) {
        const a = (i / 6) * TAU + 0.5;
        const r = 30 * f.s;
        f.under.lineStyle(1.8 * f.s, f.c, 0.35 + 0.5 * glow).strokePoints([
          { x: f.x + Math.cos(a) * 10 * f.s, y: f.ground + Math.sin(a) * 3.2 * f.s },
          { x: f.x + Math.cos(a + 0.2) * r * 0.6, y: f.ground + Math.sin(a + 0.2) * r * 0.2 },
          { x: f.x + Math.cos(a) * r, y: f.ground + Math.sin(a) * r * 0.32 },
        ]);
      }
      groundEllipse(f, 34 + k * 50, f.h, 0.6 * glow, 1.8);
    },
  },
  shadopus: {
    name: "Oracle eye",
    c: 0xc9a8ff,
    h: 0xffe19a,
    burst: "star",
    draw: (f) => {
      // An oracle's eye glyph opens and closes above, rays round it.
      const cy = f.headY - 18 * f.s;
      const open = Math.min(1, Math.abs(Math.sin(f.t / 1400)) * 1.6);
      const w = 10 * f.s * f.boost;
      f.g.lineStyle(1.4 * f.s, f.c, 0.95).strokeEllipse(f.headX, cy, w * 2, w * 0.9 * open + 0.6 * f.s);
      dot(f.g, f.headX, cy, 2.2 * f.s * open, f.h);
      if (f.full)
        for (const a of [-2.2, -1.57, -0.94]) f.g.lineStyle(1 * f.s, f.c, 0.6).lineBetween(f.headX + Math.cos(a) * w * 0.9, cy + Math.sin(a) * w * 0.7, f.headX + Math.cos(a) * w * 1.3, cy + Math.sin(a) * w * 1.1);
    },
  },
  pangrove: {
    name: "Briar circle",
    c: 0x6fcf7a,
    h: 0xff8fb8,
    burst: "leaf",
    draw: (f) => {
      // A thorned vine circles the waist, a rose blooming where it passes.
      const half = (front: boolean) =>
        curve(f.full ? 14 : 9, (u) => {
          const a = (front ? 0 : Math.PI) + u * Math.PI + f.t / 3000;
          const r = (31 + (Math.round(u * 14) % 2) * 2.4) * f.s * f.boost;
          return { x: f.x + Math.cos(a) * r, y: f.body + 6 * f.s + Math.sin(a) * r * 0.3 };
        });
      f.under.lineStyle(1.6 * f.s, f.c, 0.85).strokePoints(half(false));
      f.g.lineStyle(1.6 * f.s, f.c, 0.95).strokePoints(half(true));
      const o = orbit(f, 0, 1, 3000, 32, 9.6, 6);
      glowDot(on(f, o.front), o.x, o.y, 2 * f.s, f.h);
    },
  },
  mossloth: {
    name: "Cloud cushions",
    c: 0xf4f8ff,
    h: 0xc8e0ff,
    burst: "puff",
    draw: (f) => {
      // Little clouds drift round it slowly.
      const n = f.full ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const o = orbit(f, i, n, 6000, 36, 9, -14);
        const g = on(f, o.front);
        const r = 4 * f.s * f.boost;
        g.fillStyle(i % 2 ? f.h : f.c, o.front ? 0.95 : 0.6).fillCircle(o.x - r, o.y, r).fillCircle(o.x + r, o.y, r * 0.9).fillCircle(o.x, o.y - r * 0.6, r * 1.2);
      }
    },
  },
};

const TABLES: [string, Record<CharacterId, Signature>][] = [["nova-vanguard", vanguard]];
/** Every signature by skin id. */
export const EPIC_SIGNATURES: Record<string, Signature> = Object.fromEntries(
  TABLES.flatMap(([suffix, table]) => Object.entries(table).map(([id, sig]) => [`${id}-${suffix}`, sig])),
);

const ULT_MS = 900;
/** The Legendary hero landing and victory pose, swelling a little longer. */
const MOMENT_MS = 1200;
const ULTS = new WeakMap<object, { at: number; ms: number }>();
/** Nova Vanguard is the Legendary set: it also lands and wins in style. */
const isLegendary = (skin: string) => skin.endsWith("-nova-vanguard");

/** Draw a signature for one frame. */
export function drawEpicSignature(ctx: FxContext, skin: string) {
  const sig = EPIC_SIGNATURES[skin];
  if (!sig || ctx.defeated) return;
  const { sc } = ctx;
  const ground = ctx.y + WORLD_ART.fighterFeet * sc;
  if (isLegendary(skin) && (ctx.greeting || ctx.celebrating)) {
    ULTS.set(ctx.g, { at: ctx.now, ms: MOMENT_MS });
    if (ctx.greeting) {
      // Hero landing: a column of the suit's light comes down on the spot,
      // a ring rolls out over the ground, and motes of the motif scatter.
      ctx.emit({ x: ctx.x, y: ground, vx: 0, vy: 0, life: 1, size: 11 * sc, color: sig.c, shape: "beam", glow: true, behind: true });
      ctx.emit({ x: ctx.x, y: ground, vx: 0, vy: 0, life: 0.7, size: 12 * sc, color: sig.h, shape: "shock" });
      for (let i = 0; i < (ctx.ambient ? 10 : 5); i++) {
        const a = Math.PI + (i / 9) * Math.PI;
        ctx.emit({ x: ctx.x, y: ground - 2 * sc, vx: Math.cos(a) * 120, vy: Math.sin(a) * 50, life: 0.6, size: 2.2 * sc, color: i % 2 ? sig.c : sig.h, shape: sig.burst, spin: (Math.random() - 0.5) * 8, behind: true });
      }
    } else {
      // Victory: a fan of stars rises behind the hero, off its face.
      for (let i = 0; i < (ctx.ambient ? 12 : 6); i++) {
        const a = -Math.PI * (0.15 + (0.7 * i) / 11);
        ctx.emit({ x: ctx.x, y: ctx.headY + 6 * sc, vx: Math.cos(a) * 90, vy: Math.sin(a) * 110, life: 1, size: 2.6 * sc, color: i % 2 ? sig.c : 0xfff3c4, shape: "star", glow: true, behind: true });
      }
    }
  }
  if (ctx.ultimate) {
    ULTS.set(ctx.g, { at: ctx.now, ms: ULT_MS });
    // One small burst in the motif's own shape, plus a ring on the ground.
    const n = ctx.ambient ? 12 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.3;
      ctx.emit({
        x: ctx.x,
        y: ctx.y - 14 * sc,
        vx: Math.cos(a) * 110,
        vy: Math.sin(a) * 70 - 30,
        life: 0.7,
        size: 2.4 * sc,
        color: i % 2 ? sig.c : sig.h,
        shape: sig.burst,
        spin: (Math.random() - 0.5) * 10,
        behind: true,
      });
    }
    ctx.emit({ x: ctx.x, y: ground, vx: 0, vy: 0, life: 0.6, size: 10 * sc, color: sig.c, shape: "shock" });
  }
  const swell = ULTS.get(ctx.g);
  const since = swell ? ctx.now - swell.at : Infinity;
  const boost = swell && since >= 0 && since < swell.ms ? 1 + 0.7 * Math.sin((since / swell.ms) * Math.PI) : 1;
  // The rig gives the feet line and the head top; a chibi champion's head is
  // a little over half its height, the chest just under it.
  const tall = Math.max(10, ground - ctx.headY);
  const headR = tall * 0.28;
  sig.draw({
    ctx,
    g: ctx.g,
    under: ctx.under,
    x: ctx.x,
    y: ctx.y,
    body: ground - tall * 0.3,
    chest: ground - tall * 0.36,
    ground,
    headX: ctx.headX,
    headY: ctx.headY,
    headCY: ctx.headY + headR,
    headR,
    // Motifs are drawn in units a little larger than the rig's, so they read
    // beside a fighter rather than as specks on it.
    s: sc * 1.35,
    t: ctx.now,
    fx: Math.cos(ctx.angle),
    fy: Math.sin(ctx.angle),
    full: ctx.ambient,
    boost,
    c: sig.c,
    h: sig.h,
  });
}
