import type Phaser from "phaser";
import type { CharacterId } from "@arena/shared";
import type { FxContext, FxShape } from "./skin-fx";
import { WORLD_ART } from "../../../../packages/shared/src/world-art";

/**
 * Signature effects for the Legendary skins: each Nova Vanguard suit and
 * each Sky Pirates captain has its own motif tied to its champion (Voltkit's
 * pulse chevrons or storm compass, Sunbara's rising dawn or shoulder parrot,
 * Mystowl's star chart or treasure map...), summoned by its ultimate rather
 * than worn all the time, plus idle light on the suit, a movement trail, and
 * a landing and a victory: Nova's hero landing and star fan, the pirates'
 * anchor drop and treasure chest. Epics keep the small glint every Epic has.
 *
 * Budget: every motif draws on the rig's two existing Graphics layers (no
 * scene objects). With `ambient` off (Low, or past the two-fighter battle
 * cap) it draws a compact version within 20 Graphics calls and emits
 * no idle particles; with it on, at most 40 calls and a few particles a
 * second. An ultimate also throws one small burst in its own shape. Nothing changes hitboxes, sizes or timing, and motifs
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

// ---- Sky Pirates: a crew of sky-pirate captains, each with their own kit.
const pirates: Record<CharacterId, Signature> = {
  voltkit: {
    name: "Storm compass",
    c: 0xffd65b,
    h: 0x7ff3ff,
    burst: "spark",
    draw: (f) => {
      // A brass compass hovers by the head; its needle swings and crackles.
      const cx = f.headX + f.headR + 6 * f.s,
        cy = f.headCY + Math.sin(f.t / 700) * 2 * f.s;
      const r = 6 * f.s * f.boost;
      f.g.fillStyle(0xfff6e0, 1).fillCircle(cx, cy, r).lineStyle(1.6 * f.s, 0xc89a3a, 1).strokeCircle(cx, cy, r);
      const a = Math.sin(f.t / 260) * 1.2 + f.t / 900;
      f.g.fillStyle(0xd8323a, 1).fillTriangle(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8, cx + Math.cos(a + 1.6) * 1.4 * f.s, cy + Math.sin(a + 1.6) * 1.4 * f.s, cx + Math.cos(a - 1.6) * 1.4 * f.s, cy + Math.sin(a - 1.6) * 1.4 * f.s);
      if (f.full && (f.t / 450) % 1 < 0.15) sparkle(f.g, cx + r, cy - r, 2 * f.s, f.h);
    },
  },
  cindrake: {
    name: "Ship lantern",
    c: 0xffb347,
    h: 0xfff0a0,
    burst: "spark",
    draw: (f) => {
      // A ship's lantern swings from a hook at its side, its flame flickering.
      const side = f.fx > 0.3 ? -1 : 1;
      const px = f.x + side * 30 * f.s,
        py = f.headCY;
      const a = Math.sin(f.t / 600) * 0.35;
      const lx = px + Math.sin(a) * 12 * f.s,
        ly = py + Math.cos(a) * 12 * f.s;
      const s = f.s * f.boost;
      f.g.lineStyle(1 * f.s, 0x3a2a1c, 0.9).lineBetween(px, py, lx, ly - 5 * s);
      f.g.fillStyle(f.c, 0.25 + 0.1 * wave(f.t / 120)).fillCircle(lx, ly, 9 * s);
      f.g.fillStyle(0x3a2a1c, 1).fillRect(lx - 4 * s, ly - 6 * s, 8 * s, 2 * s).fillRect(lx - 4 * s, ly + 4 * s, 8 * s, 2 * s);
      f.g.fillStyle(f.h, 0.9).fillRect(lx - 3 * s, ly - 4 * s, 6 * s, 8 * s);
      f.g.fillStyle(f.c, 1).fillEllipse(lx, ly + 0.5 * s, 2.6 * s, (4 + Math.sin(f.t / 90)) * s);
    },
  },
  tidefin: {
    name: "Ship's wheel",
    c: 0x9a6a3a,
    h: 0xe6c46a,
    burst: "coin",
    draw: (f) => {
      // A ship's wheel turns slowly behind the admiral.
      const r = (f.headR + 4 * f.s) * f.boost;
      const cx = f.x,
        cy = f.body - 6 * f.s;
      const a0 = Math.sin(f.t / 2000) * 0.8;
      const n = f.full ? 8 : 6;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * TAU;
        f.under.lineStyle(2.2 * f.s, f.c, 0.95).lineBetween(cx, cy, cx + Math.cos(a) * (r + 6 * f.s), cy + Math.sin(a) * (r + 6 * f.s));
        if (f.full) dot(f.under, cx + Math.cos(a) * (r + 6 * f.s), cy + Math.sin(a) * (r + 6 * f.s), 2 * f.s, f.c);
      }
      f.under.lineStyle(3 * f.s, f.c, 0.95).strokeCircle(cx, cy, r);
      f.under.lineStyle(1 * f.s, f.h, 0.9).strokeCircle(cx, cy, r - 2 * f.s);
    },
  },
  auralynx: {
    name: "Spyglass glint",
    c: 0xe6c46a,
    h: 0xffffff,
    burst: "star",
    draw: (f) => {
      // A brass spyglass hovers by the head, its lens catching the light.
      const side = f.fx < -0.3 ? -1 : 1;
      const sx = f.headX + side * (f.headR + 2 * f.s),
        sy = f.headY + Math.sin(f.t / 800) * 2 * f.s;
      const s = f.s * f.boost;
      const ex = sx + side * 16 * s,
        ey = sy - 6 * s;
      f.g.lineStyle(5 * s, 0x6a4a2a, 1).lineBetween(sx, sy, ex, ey);
      f.g.lineStyle(3.4 * s, f.c, 1).lineBetween(sx + side * 6 * s, sy - 2.2 * s, ex, ey);
      f.g.fillStyle(0xbfe8ff, 1).fillCircle(ex, ey, 2.4 * s);
      if ((f.t / 1600) % 1 < 0.2) sparkle(f.g, ex, ey, (2.4 + 2 * Math.sin(((f.t / 1600) % 1 / 0.2) * Math.PI)) * f.s, f.h);
    },
  },
  lumoth: {
    name: "Message in a bottle",
    c: 0xa6ffd9,
    h: 0xfff3b0,
    burst: "bubble",
    draw: (f) => {
      // A glowing bottle with a rolled message bobs round it.
      const o = orbit(f, 0, 1, 4200, 36, 9, -10);
      const g = on(f, o.front);
      const s = f.s * f.boost;
      const tilt = Math.sin(f.t / 500) * 0.5;
      g.fillStyle(f.c, 0.25).fillCircle(o.x, o.y, 8 * s);
      g.fillStyle(0x8fd9c0, 0.9).fillEllipse(o.x, o.y, 7 * s, 10 * s);
      g.fillStyle(0x9a6a3a, 1).fillRect(o.x - 1.5 * s + Math.sin(tilt) * 4 * s, o.y - 8 * s, 3 * s, 3 * s);
      g.fillStyle(f.h, 1).fillRect(o.x - 1.6 * s, o.y - 3 * s, 3.2 * s, 6 * s);
    },
  },
  mystowl: {
    name: "Treasure map",
    c: 0xf1dfb0,
    h: 0xd8323a,
    burst: "star",
    draw: (f) => {
      // A rolled treasure map hangs open beside the quartermaster, a dotted
      // trail leading to a pulsing X.
      const side = f.fx > 0.3 ? -1 : 1;
      const s = f.s * f.boost;
      const cx = f.headX + side * (f.headR + 12 * f.s),
        cy = f.headCY + Math.sin(f.t / 900) * 1.5 * f.s;
      const w = 10 * s,
        hgt = 12 * s;
      f.g.fillStyle(f.c, 1).fillRect(cx - w, cy - hgt, w * 2, hgt * 2);
      f.g.fillStyle(0xc9a86a, 1).fillRect(cx - w - 1.5 * s, cy - hgt - 2 * s, w * 2 + 3 * s, 3.5 * s).fillRect(cx - w - 1.5 * s, cy + hgt - 1.5 * s, w * 2 + 3 * s, 3.5 * s);
      if (f.full)
        for (let i = 0; i < 4; i++) dot(f.g, cx - w * 0.7 + i * w * 0.38, cy + hgt * 0.5 - i * hgt * 0.32, 0.9 * f.s, 0x7a5a3a);
      const k = 0.7 + 0.3 * wave(f.t / 900);
      const xs = 2.8 * s * k,
        xx = cx + w * 0.45,
        xy = cy - hgt * 0.5;
      f.g.lineStyle(1.8 * f.s, f.h, 1).lineBetween(xx - xs, xy - xs, xx + xs, xy + xs).lineBetween(xx - xs, xy + xs, xx + xs, xy - xs);
    },
  },
  terradon: {
    name: "Swinging anchor",
    c: 0x6a7a8a,
    h: 0xe6c46a,
    burst: "pebble",
    draw: (f) => {
      // An iron anchor swings on its chain at the captain's side.
      const side = f.fx > 0.3 ? -1 : 1;
      const px = f.x + side * 34 * f.s,
        py = f.headCY;
      const a = Math.sin(f.t / 900) * 0.3;
      const len = 20 * f.s;
      const ax = px + Math.sin(a) * len,
        ay = py + Math.cos(a) * len;
      const s = f.s * f.boost;
      f.g.lineStyle(1.2 * f.s, 0x8a8a8a, 0.9).lineBetween(px, py, ax, ay - 7 * s);
      f.g.lineStyle(2.4 * s, f.c, 1).lineBetween(ax, ay - 7 * s, ax, ay + 5 * s).lineBetween(ax - 4 * s, ay - 4 * s, ax + 4 * s, ay - 4 * s);
      f.g.beginPath().arc(ax, ay + 1 * s, 6 * s, 0.2, Math.PI - 0.2).strokePath();
      f.g.lineStyle(1.6 * f.s, f.h, 1).strokeCircle(ax, ay - 8.5 * s, 1.6 * s);
    },
  },
  duskveil: {
    name: "Ghost flag",
    c: 0xd6c8ff,
    h: 0x2a2448,
    burst: "puff",
    draw: (f) => {
      // A ghostly pirate flag ripples on a pole behind the wisp.
      const side = f.fx > 0.3 ? -1 : 1;
      const px = f.x + side * 30 * f.s,
        top = f.headY - 6 * f.s;
      f.under.lineStyle(1.6 * f.s, 0x5a4a3a, 1).lineBetween(px, top, px, f.ground);
      const w = 20 * f.s * f.boost,
        hgt = 12 * f.s * f.boost;
      const n = f.full ? 6 : 4;
      const edge = (dy: number) =>
        curve(n, (u) => ({ x: px + side * u * w, y: top + dy + Math.sin(u * 4 - f.t / 220) * 2.2 * f.s * u }));
      const pts = [...edge(0), ...edge(hgt).reverse()];
      f.under.fillStyle(f.h, 0.85).fillPoints(pts, true);
      f.under.lineStyle(1 * f.s, f.c, 0.8).strokePoints(pts, true);
      dot(f.under, px + side * w * 0.45, top + hgt * 0.45 + Math.sin(1.8 - f.t / 220) * 1 * f.s, 2.4 * f.s, f.c, 0.95);
    },
  },
  coilemur: {
    name: "Rigging lasso",
    c: 0xc9a06a,
    h: 0xffffff,
    burst: "ring",
    draw: (f) => {
      // A rope lasso spins above the runner's head.
      const cy = f.headY - 10 * f.s;
      const rx = 18 * f.s * f.boost,
        ry = 5 * f.s * f.boost;
      const a = f.t / 180;
      f.g.lineStyle(2 * f.s, f.c, 1).strokeEllipse(f.headX, cy, rx * 2, ry * 2);
      f.g.lineStyle(2 * f.s, f.c, 1).lineBetween(f.headX + Math.cos(a) * rx, cy + Math.sin(a) * ry, f.headX + f.headR * 0.6, f.headCY);
      if (f.full) dot(f.g, f.headX + Math.cos(a) * rx, cy + Math.sin(a) * ry, 1.6 * f.s, f.h);
    },
  },
  pyranda: {
    name: "Doubloons",
    c: 0xffd65b,
    h: 0xa8823a,
    burst: "coin",
    draw: (f) => {
      // Gold doubloons circle, flipping as they go.
      const n = f.full ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const o = orbit(f, i, n, 3000, 36, 10, -8);
        const g = on(f, o.front);
        const flip = Math.abs(Math.cos(f.t / 250 + i));
        const r = 3.4 * f.s * f.boost;
        g.fillStyle(f.c, o.front ? 1 : 0.6).fillEllipse(o.x, o.y, r * 2 * (0.2 + 0.8 * flip), r * 2);
        g.lineStyle(0.8 * f.s, f.h, 0.9).strokeEllipse(o.x, o.y, r * 2 * (0.2 + 0.8 * flip), r * 2);
      }
    },
  },
  glacelle: {
    name: "Frost sail",
    c: 0xeaf6ff,
    h: 0x7fb6e6,
    burst: "flake",
    draw: (f) => {
      // A small sail on a mast at her side billows outward in the wind.
      const side = f.fx > 0.3 ? -1 : 1;
      const mx = f.x + side * 30 * f.s,
        top = f.headY + 2 * f.s;
      const hgt = (f.ground - top) * 0.7 * f.boost;
      const belly = (10 + 5 * wave(f.t / 1400)) * f.s * f.boost;
      f.under.lineStyle(2 * f.s, 0x8a6a4a, 1).lineBetween(mx, top - 4 * f.s, mx, f.ground);
      const pts = curve(f.full ? 8 : 5, (u) => ({ x: mx + side * (Math.sin(u * Math.PI) * belly + 2 * f.s), y: top + u * hgt }));
      f.under.fillStyle(f.c, 0.95).fillPoints(pts, true);
      f.under.lineStyle(1 * f.s, f.h, 0.9).strokePoints(pts, true);
      if (f.full) f.under.lineStyle(1 * f.s, f.h, 0.6).lineBetween(mx + side * 2 * f.s, top + hgt * 0.5, mx + side * belly * 0.9, top + hgt * 0.5);
    },
  },
  halcyra: {
    name: "Seagull wingman",
    c: 0xffffff,
    h: 0x3a3a4a,
    burst: "ray",
    draw: (f) => {
      // A seagull wheels round above the ace, flapping now and then.
      const a = (f.t / 2600) * TAU;
      const gx = f.headX + Math.cos(a) * 34 * f.s,
        gy = f.headY - 14 * f.s + Math.sin(a) * 7 * f.s;
      const flap = Math.sin(f.t / 120) * 0.6 + 0.3;
      const s = 7 * f.s * f.boost;
      const g = Math.sin(a) > 0 ? f.g : f.under;
      g.lineStyle(2 * f.s, f.c, 1).strokePoints([
        { x: gx - s, y: gy - s * flap },
        { x: gx - s * 0.4, y: gy - s * 0.1 },
        { x: gx, y: gy },
        { x: gx + s * 0.4, y: gy - s * 0.1 },
        { x: gx + s, y: gy - s * flap },
      ]);
      dot(g, gx, gy, 1 * f.s, f.h);
    },
  },
  sunbara: {
    name: "Shoulder parrot",
    c: 0x3fbf5a,
    h: 0xd8323a,
    burst: "leaf",
    draw: (f) => {
      // A parrot perches on its shoulder, bobbing and flicking a wing.
      const side = f.fx < -0.3 ? -1 : 1;
      const s = f.s * f.boost;
      const bx = f.x + side * (f.headR * 0.95),
        by = f.chest - 4 * f.s + Math.abs(Math.sin(f.t / 400)) * -2 * f.s;
      const g = f.g;
      g.fillStyle(f.c, 1).fillEllipse(bx, by, 7 * s, 10 * s);
      g.fillStyle(f.h, 1).fillCircle(bx + side * 1 * s, by - 6 * s, 3.6 * s);
      g.fillStyle(0xffd65b, 1).fillTriangle(bx + side * 4 * s, by - 6.5 * s, bx + side * 7 * s, by - 5 * s, bx + side * 4 * s, by - 4 * s);
      dot(g, bx + side * 2 * s, by - 7 * s, 0.8 * s, 0x1a1a1a);
      const wing = Math.sin(f.t / 150) > 0.7 ? -0.6 : 0;
      g.fillStyle(0x2a8f45, 1).fillTriangle(bx - side * 2 * s, by - 2 * s, bx - side * (6 + wing * 6) * s, by + (4 + wing * 6) * s, bx, by + 4 * s);
      g.fillStyle(0x3a7fd8, 1).fillTriangle(bx - 1.5 * s, by + 4 * s, bx + 1.5 * s, by + 4 * s, bx, by + 11 * s);
    },
  },
  astrabun: {
    name: "Moon galleon",
    c: 0xfff3c4,
    h: 0x9a6a3a,
    burst: "star",
    draw: (f) => {
      // A tiny moonlit galleon sails an orbit round the bosun.
      const o = orbit(f, 0, 1, 5200, 38, 11, -6);
      const g = on(f, o.front);
      const s = f.s * f.boost;
      const dir = Math.cos(o.a + Math.PI / 2) > 0 ? 1 : -1;
      g.fillStyle(f.h, o.front ? 1 : 0.6).fillTriangle(o.x - 7 * s, o.y, o.x + 7 * s, o.y, o.x + dir * 5 * s, o.y + 3.5 * s);
      g.fillRect(o.x - 5 * s, o.y - 1 * s, 10 * s, 2 * s);
      g.fillStyle(f.c, o.front ? 1 : 0.6).fillTriangle(o.x, o.y - 12 * s, o.x, o.y - 1.5 * s, o.x + dir * 6 * s, o.y - 2 * s);
      g.lineStyle(0.8 * f.s, f.h, 1).lineBetween(o.x, o.y - 13 * s, o.x, o.y);
    },
  },
  wombolder: {
    name: "Cannon smoke",
    c: 0xd8d8d8,
    h: 0xffb347,
    burst: "puff",
    draw: (f) => {
      // A small deck cannon at its side booms on the beat: a flash, then smoke.
      const side = f.fx > 0.3 ? -1 : 1;
      const cx = f.x + side * 32 * f.s,
        cy = f.ground - 4 * f.s;
      const s = f.s * f.boost;
      f.under.fillStyle(0x3a3a44, 1).fillRect(cx - 7 * s, cy - 5 * s, 12 * s, 6 * s).fillCircle(cx - 4 * s, cy + 1 * s, 2.6 * s).fillCircle(cx + 3 * s, cy + 1 * s, 2.6 * s);
      const k = (f.t / 1800) % 1;
      const mx = cx + side * 6 * s;
      if (k < 0.08) f.under.fillStyle(f.h, 0.9).fillCircle(mx, cy - 3 * s, 4 * s);
      if (k < 0.7)
        for (let i = 0; i < (f.full ? 3 : 2); i++) {
          const r = (2.4 + k * 8 + i * 1.6) * s;
          f.under.fillStyle(f.c, 0.6 * (1 - k / 0.7)).fillCircle(mx + side * (k * 16 + i * 4) * s, cy - 4 * s - k * 12 * s - i * 2 * s, r);
        }
    },
  },
  shadopus: {
    name: "Kraken tentacle",
    c: 0x6a3a8a,
    h: 0xff8fd0,
    burst: "bubble",
    draw: (f) => {
      // A kraken's tentacle curls up from the ground behind the captain.
      const side = f.fx > 0.3 ? -1 : 1;
      const bx = f.x + side * 26 * f.s;
      const hgt = (f.ground - f.headY) * 0.75 * f.boost;
      const pts = curve(f.full ? 10 : 6, (u) => ({
        x: bx + side * Math.sin(u * 2.4 + Math.sin(f.t / 500) * 0.6) * 10 * f.s * u,
        y: f.ground - u * hgt,
      }));
      f.under.lineStyle(6 * f.s, f.c, 1).strokePoints(pts);
      f.under.lineStyle(2 * f.s, 0x9a6abf, 1).strokePoints(pts);
      if (f.full)
        for (const i of [3, 5, 7]) if (pts[i]) dot(f.under, pts[i].x - side * 2 * f.s, pts[i].y, 1.1 * f.s, f.h);
    },
  },
  pangrove: {
    name: "Ship's bell",
    c: 0xe6c46a,
    h: 0xffffff,
    burst: "leaf",
    draw: (f) => {
      // A brass ship's bell on a bracket swings and rings on the beat.
      const side = f.fx > 0.3 ? -1 : 1;
      const px = f.x + side * 32 * f.s,
        py = f.headCY - 2 * f.s;
      const k = (f.t / 2000) % 1;
      const swing = k < 0.4 ? Math.sin(k * 25) * 0.4 * (1 - k / 0.4) : 0;
      const s = f.s * f.boost;
      f.g.lineStyle(2 * f.s, 0x5a3a22, 1).lineBetween(px - side * 8 * s, py, px, py);
      const bx = px + Math.sin(swing) * 6 * s,
        by = py + 7 * s;
      f.g.fillStyle(f.c, 1).fillTriangle(bx - 6 * s, by + 5 * s, bx + 6 * s, by + 5 * s, bx, by - 6 * s).fillCircle(bx, by - 2 * s, 4 * s);
      f.g.fillStyle(0xa8823a, 1).fillCircle(bx + Math.sin(swing) * 3 * s, by + 5.5 * s, 1.4 * s);
      if (f.full && k < 0.4)
        for (const d of [1, -1]) f.g.lineStyle(1 * f.s, f.h, 0.8 * (1 - k / 0.4)).beginPath().arc(bx, by, (9 + k * 10) * s, d > 0 ? -0.6 : Math.PI - 0.6, d > 0 ? 0.6 : Math.PI + 0.6).strokePath();
    },
  },
  mossloth: {
    name: "Swaying hammock",
    c: 0xd9c9a0,
    h: 0x8a6a4a,
    burst: "leaf",
    draw: (f) => {
      // A rope hammock sways between two posts behind the lazy pirate.
      const w = (f.headR * 1.6) * f.boost;
      const y0 = f.body - 6 * f.s;
      f.under.lineStyle(2.4 * f.s, f.h, 1).lineBetween(f.x - w, y0 - 10 * f.s, f.x - w, f.ground).lineBetween(f.x + w, y0 - 10 * f.s, f.x + w, f.ground);
      const sway = Math.sin(f.t / 900) * 4 * f.s;
      const pts = curve(f.full ? 10 : 6, (u) => ({ x: f.x - w + u * w * 2 + sway * Math.sin(u * Math.PI), y: y0 - 8 * f.s + Math.sin(u * Math.PI) * 16 * f.s }));
      f.under.lineStyle(5 * f.s, f.c, 0.95).strokePoints(pts);
      f.under.lineStyle(1 * f.s, f.h, 0.8).strokePoints(pts);
    },
  },
};

const TABLES: [string, Record<CharacterId, Signature>][] = [
  ["nova-vanguard", vanguard],
  ["sky-pirates", pirates],
];
/** Every signature by skin id. */
export const EPIC_SIGNATURES: Record<string, Signature> = Object.fromEntries(
  TABLES.flatMap(([suffix, table]) => Object.entries(table).map(([id, sig]) => [`${id}-${suffix}`, sig])),
);

/** How long a champion's own motif stays out once summoned. */
const FLOURISH_MS = 1900;
/** When each fighter's motif was last summoned (ultimate, landing, win). */
const FLOURISHES = new WeakMap<object, number>();
const isPirate = (skin: string) => skin.endsWith("-sky-pirates");
/** A Sky Pirate's anchor landing and treasure victory, drawn over time. */
const PIRATE_MOMENTS = new WeakMap<object, { land?: number; win?: number }>();
const LAND_MS = 1100,
  WIN_MS = 1400;
/**
 * The same Graphics with every fill and line drawn at a fraction of its
 * alpha, so a motif can fade in and out without each one knowing about it.
 */
function faded(g: G, a: number): G {
  if (a >= 1) return g;
  const p: G = new Proxy(g, {
    get(t, k) {
      const v = (t as any)[k];
      if (typeof v !== "function") return v;
      if (k === "fillStyle") return (c: number, al = 1) => (t.fillStyle(c, al * a), p);
      if (k === "lineStyle") return (w: number, c: number, al = 1) => (t.lineStyle(w, c, al * a), p);
      return (...args: unknown[]) => {
        const r = v.apply(t, args);
        return r === t ? p : r;
      };
    },
  });
  return p;
}
/** Ease out with a little overshoot: a pop that settles (0 → ~1.1 → 1). */
const easeOutBack = (x: number) => {
  const c1 = 1.70158,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

/**
 * Draw a Legendary skin's effects for one frame.
 *
 * Modelled on how premium skins work in League of Legends, Mobile Legends
 * and Brawl Stars: the effects live on the costume and on what the fighter
 * does, not on props circling it all the time.
 *
 *  - Idle: light that belongs to the suit itself (Nova's energy running
 *    along its seams into a breathing emblem; a glint sweeping a pirate's
 *    gold-edged brim and buckle) and, with the ambient budget, a few motes
 *    drifting off it with air resistance.
 *  - Moving: a trail at the feet (Nova's energy ripples and dash streaks;
 *    the pirates' sea-spray puffs and gold dust), like Legend skin trails.
 *  - Moments: the landing and victory of each collection, and the
 *    champion's own motif summoned with a pop on its ultimate, landing and
 *    victory, then gone.
 */
export function drawEpicSignature(ctx: FxContext, skin: string) {
  const sig = EPIC_SIGNATURES[skin];
  if (!sig || ctx.defeated) return;
  const { sc } = ctx;
  const ground = ctx.y + WORLD_ART.fighterFeet * sc;
  const pirate = isPirate(skin);
  // The motif answers the ultimate; Nova also shows it on landing and win
  // (the pirates have their anchor and chest there instead).
  if (ctx.ultimate || (!pirate && (ctx.greeting || ctx.celebrating))) FLOURISHES.set(ctx.g, ctx.now);
  if (pirate && (ctx.greeting || ctx.celebrating)) {
    // Sky Pirates: an anchor drops and bites the ground, or a treasure chest
    // bursts open behind the captain; drawn over the next frames.
    let m = PIRATE_MOMENTS.get(ctx.g);
    if (!m) PIRATE_MOMENTS.set(ctx.g, (m = {}));
    if (ctx.greeting) m.land = ctx.now;
    else m.win = ctx.now;
  } else if (ctx.greeting) {
    // Nova hero landing: a column of the suit's light behind it, a ring
    // over the ground and motes that slow in the air as they rise.
    ctx.emit({ x: ctx.x, y: ground, vx: 0, vy: 0, life: 1, size: 11 * sc, color: sig.c, shape: "beam", glow: true, behind: true, fadeIn: 0.12 });
    ctx.emit({ x: ctx.x, y: ground, vx: 0, vy: 0, life: 0.7, size: 12 * sc, color: sig.h, shape: "shock" });
    for (let i = 0; i < (ctx.ambient ? 10 : 5); i++) {
      const a = Math.PI + (i / 9) * Math.PI;
      ctx.emit({ x: ctx.x, y: ground - 2 * sc, vx: Math.cos(a) * 150, vy: Math.sin(a) * 70, life: 0.8, size: 2.4 * sc, color: sig.h, to: sig.c, shape: "dot", glow: true, behind: true, drag: 3, grow: 0.3 });
    }
  } else if (ctx.celebrating) {
    // Nova victory: a fan of stars rises behind the hero, slowing as it goes.
    for (let i = 0; i < (ctx.ambient ? 12 : 6); i++) {
      const a = -Math.PI * (0.15 + (0.7 * i) / 11);
      ctx.emit({ x: ctx.x, y: ctx.headY + 6 * sc, vx: Math.cos(a) * 130, vy: Math.sin(a) * 160, life: 1.1, size: 2.8 * sc, color: 0xfff3c4, to: sig.c, shape: "star", glow: true, behind: true, drag: 2.2, fadeIn: 0.1, grow: 0.5 });
    }
  }
  if (ctx.ultimate) {
    // One burst in the motif's own shape, plus a ring on the ground.
    const n = ctx.ambient ? 11 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.3;
      ctx.emit({
        x: ctx.x,
        y: ctx.y - 14 * sc,
        vx: Math.cos(a) * 150,
        vy: Math.sin(a) * 100 - 30,
        life: 0.8,
        size: 2.4 * sc,
        color: i % 2 ? sig.c : sig.h,
        shape: sig.burst,
        spin: (Math.random() - 0.5) * 10,
        behind: true,
        drag: 2.5,
        grow: 0.4,
      });
    }
    ctx.emit({ x: ctx.x, y: ground, vx: 0, vy: 0, life: 0.6, size: 10 * sc, color: sig.c, shape: "shock" });
  }
  // The rig gives the feet line and the head top; a chibi champion's head is
  // a little over half its height, the chest just under it.
  const tall = Math.max(10, ground - ctx.headY);
  const headR = tall * 0.28;
  const frame: Frame = {
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
    boost: 1,
    c: sig.c,
    h: sig.h,
  };
  if (pirate) pirateSuit(frame);
  else novaSuit(frame);
  // The champion's own motif, summoned: it pops in with a little overshoot
  // as it fades up, holds, then eases back as it fades out.
  const since = ctx.now - (FLOURISHES.get(ctx.g) ?? -Infinity);
  if (since >= 0 && since < FLOURISH_MS) {
    const k = since / FLOURISH_MS;
    const a = Math.min(1, k / 0.1, (1 - k) / 0.2);
    frame.boost = k < 0.16 ? 0.6 + 0.4 * easeOutBack(k / 0.16) : 1 - 0.15 * Math.max(0, (k - 0.8) / 0.2);
    frame.g = faded(ctx.g, a);
    frame.under = faded(ctx.under, a);
    sig.draw(frame);
    frame.boost = 1;
    frame.g = ctx.g;
    frame.under = ctx.under;
  }
  if (pirate) pirateMoments(frame);
}

/** Nova Vanguard: energy running along the suit's seams into its emblem. */
function novaSuit(f: Frame) {
  const { ctx, s } = f;
  const ex = f.x,
    ey = f.body - 2 * s;
  // The emblem breathes.
  const b = wave(f.t / 1800);
  f.g.fillStyle(f.c, 0.1 + 0.1 * b).fillCircle(ex, ey, 7 * s);
  f.g.fillStyle(f.h, 0.45 + 0.35 * b).fillCircle(ex, ey, 1.8 * s);
  // A pulse runs up one seam, through the emblem and down the other, with a
  // short fading tail, every couple of seconds.
  const seam = [
    [-10, 11],
    [-5, 2],
    [0, -2],
    [5, 2],
    [10, 11],
  ].map(([u, v]) => ({ x: ex + u * s, y: ey + v * s }));
  const at = (q: number) => {
    const p = Math.max(0, Math.min(0.9999, q)) * (seam.length - 1);
    const i = Math.floor(p),
      r = p - i;
    return { x: seam[i].x + (seam[i + 1].x - seam[i].x) * r, y: seam[i].y + (seam[i + 1].y - seam[i].y) * r };
  };
  const k = (f.t / 2200) % 1;
  if (k < 0.55) {
    const head = k / 0.55;
    for (let i = 0; i < (f.full ? 4 : 2); i++) {
      const q = head - i * 0.06;
      if (q < 0) continue;
      const p = at(q);
      dot(f.g, p.x, p.y, (1.6 - i * 0.3) * s, i ? f.c : f.h, 0.9 - i * 0.2);
    }
  }
  // With the ambient budget, motes lift off the emblem and slow in the air.
  if (f.full && ctx.chance(3, ctx.dt))
    ctx.emit({ x: ex + (Math.random() - 0.5) * 6 * s, y: ey, vx: (Math.random() - 0.5) * 24, vy: -42 - Math.random() * 18, life: 1, size: 1.4 * s, color: f.h, to: f.c, shape: "dot", glow: true, drag: 1.6, grow: 0.3, fadeIn: 0.2, sway: 2 });
  // Moving: energy ripples where the feet land; dashing: light streaks.
  if (ctx.dashing ? ctx.chance(30, ctx.dt) : ctx.moving && ctx.chance(f.full ? 6 : 3, ctx.dt)) {
    const side = Math.random() < 0.5 ? -1 : 1;
    ctx.emit({ x: f.x + side * 5 * s, y: f.ground, vx: 0, vy: 0, life: 0.5, size: 3 * ctx.sc, color: f.c, shape: "shock", behind: true });
    if (ctx.dashing) {
      const back = ctx.angle + Math.PI;
      ctx.emit({ x: f.x, y: f.body, vx: Math.cos(back) * 160, vy: Math.sin(back) * 60, life: 0.3, size: 3 * ctx.sc, color: f.h, shape: "ray", glow: true, behind: true, drag: 3 });
    }
  }
}

/** Sky Pirates: gold catching the light, and sea spray at the feet. */
function pirateSuit(f: Frame) {
  const { ctx, s } = f;
  // A glint sweeps along the tricorne's gold-edged brim now and then...
  const k = (f.t / 2800) % 1;
  if (k < 0.22) {
    const u = k / 0.22;
    const half = f.headR * 0.95;
    const gx = f.headX - half + u * half * 2;
    const gy = f.headY + 1 * s + Math.sin(u * Math.PI) * 3 * s;
    const a = Math.sin(u * Math.PI);
    f.g.fillStyle(0xfff3c4, 0.25 * a).fillCircle(gx, gy, 4 * s);
    sparkle(f.g, gx, gy, (1.4 + 1.2 * a) * s, 0xffffff, a);
  }
  // The gold buckle always holds a little warm light...
  f.g.fillStyle(0xffe08a, 0.3 + 0.2 * wave(f.t / 1600)).fillCircle(f.x + 1.5 * s, f.body + 4 * s, 1.6 * s);
  // ...and flashes, a beat after the brim.
  const kb = (f.t / 2800 + 0.5) % 1;
  if (kb < 0.12) {
    const a = Math.sin((kb / 0.12) * Math.PI);
    sparkle(f.g, f.x + 1.5 * s, f.body + 4 * s, (1.2 + a) * s, 0xfff3c4, a);
  }
  // With the ambient budget, flecks of gold dust drift off the coat.
  if (f.full && ctx.chance(2, ctx.dt))
    ctx.emit({ x: f.x + (Math.random() - 0.5) * 22 * s, y: f.body + (Math.random() - 0.3) * 10 * s, vx: (Math.random() - 0.5) * 8, vy: 10 + Math.random() * 8, life: 1.4, size: 1.2 * s, color: 0xffe08a, to: 0xffb347, shape: "dot", fadeIn: 0.3, grow: 0.4, sway: 3 });
  // Moving: sea-spray puffs that bloom and thin out, with gold dust.
  if (ctx.dashing ? ctx.chance(30, ctx.dt) : ctx.moving && ctx.chance(f.full ? 7 : 3, ctx.dt)) {
    const back = ctx.angle + Math.PI;
    ctx.emit({ x: f.x + Math.cos(back) * 8 * s + (Math.random() - 0.5) * 10 * s, y: f.ground - 2 * s, vx: Math.cos(back) * 30 + (Math.random() - 0.5) * 20, vy: -14 - Math.random() * 10, life: 0.7, size: 1.5 * ctx.sc, color: 0xeef8ff, to: 0xbfe3f2, shape: "puff", behind: true, drag: 3, grow: 1.4, fadeIn: 0.15, sway: 1.5 });
    if (Math.random() < 0.7)
      ctx.emit({ x: f.x + (Math.random() - 0.5) * 12 * s, y: f.ground - 4 * s, vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 30, life: 0.6, size: 1.2 * ctx.sc, color: 0xfff3c4, to: 0xffb347, shape: "dot", glow: true, drag: 2.5, grow: 0.4 });
  }
}

/**
 * The Sky Pirates' landing and victory. Landing: an anchor falls (faster as
 * it drops), bites the ground with a small rebound, a ring and a bloom of
 * dust. Victory: a treasure chest behind the captain springs open with an
 * overshoot, glows, and doubloons arc up and fall back. Both stay within a
 * step of the fighter and off the face.
 */
function pirateMoments(f: Frame) {
  const m = PIRATE_MOMENTS.get(f.ctx.g);
  if (!m) return;
  const { ctx } = f;
  const s = ctx.sc * 1.35;
  if (m.land !== undefined) {
    const k = (ctx.now - m.land) / LAND_MS;
    if (k < 0 || k > 1) m.land = undefined;
    else {
      const side = f.fx > 0.3 ? -1 : 1;
      const ax = f.x + side * 30 * s;
      const drop = 0.25;
      const fall = Math.min(1, k / drop);
      const rebound = k > drop && k < drop + 0.14 ? Math.sin(((k - drop) / 0.14) * Math.PI) * 4 * s : 0;
      const ay = f.ground - 90 * s * (1 - fall * fall) - rebound;
      const a = k > 0.75 ? (1 - k) / 0.25 : 1;
      const g = f.under;
      // The chain up out of sight, the shank, the stock and the flukes.
      g.lineStyle(1.4 * s, 0x8a8a8a, 0.9 * a).lineBetween(ax, ay - 40 * s, ax, ay - 22 * s);
      g.lineStyle(3.4 * s, 0x5a6a7a, a).lineBetween(ax, ay - 22 * s, ax, ay - 2 * s).lineBetween(ax - 7 * s, ay - 17 * s, ax + 7 * s, ay - 17 * s);
      g.beginPath().arc(ax, ay - 8 * s, 9 * s, 0.25, Math.PI - 0.25).strokePath();
      g.lineStyle(1.6 * s, 0xe6c46a, a).strokeCircle(ax, ay - 24 * s, 2.4 * s);
      if (k >= drop && k - (ctx.dt * 1000) / LAND_MS < drop) {
        ctx.emit({ x: ax, y: f.ground, vx: 0, vy: 0, life: 0.6, size: 10 * ctx.sc, color: 0xe6c46a, shape: "shock" });
        for (let i = 0; i < (ctx.ambient ? 7 : 4); i++) {
          const d = Math.PI + ((i + 0.5) / (ctx.ambient ? 7 : 4)) * Math.PI;
          ctx.emit({ x: ax, y: f.ground - 2 * ctx.sc, vx: Math.cos(d) * 120, vy: Math.sin(d) * 40, life: 0.8, size: 1.6 * ctx.sc, color: 0xe8dcc4, to: 0xf8f4ec, shape: "puff", behind: true, drag: 4, grow: 1.3, fadeIn: 0.1, sway: 1.5 });
        }
      }
    }
  }
  if (m.win !== undefined) {
    const k = (ctx.now - m.win) / WIN_MS;
    if (k < 0 || k > 1) m.win = undefined;
    else {
      const side = f.fx > 0.3 ? -1 : 1;
      const cx = f.x + side * 26 * s,
        cy = f.ground - 2 * s;
      const a = k > 0.8 ? (1 - k) / 0.2 : 1;
      const raw = Math.min(1, Math.max(0, (k - 0.15) / 0.15));
      const open = raw > 0 ? Math.min(1.15, easeOutBack(raw)) : 0;
      const w = 11 * s,
        hgt = 8 * s;
      const g = f.under;
      // Gold glow from inside, the box, its bands and the lid tipping back.
      if (open > 0) g.fillStyle(0xffe08a, 0.35 * Math.min(1, open) * a * (0.8 + 0.2 * Math.sin(ctx.now / 90))).fillCircle(cx, cy - hgt, 13 * s);
      g.fillStyle(0x7a4a24, a).fillRect(cx - w, cy - hgt, w * 2, hgt);
      g.lineStyle(1.2 * s, 0xe6c46a, a).strokeRect(cx - w, cy - hgt, w * 2, hgt).lineBetween(cx - w * 0.5, cy - hgt, cx - w * 0.5, cy).lineBetween(cx + w * 0.5, cy - hgt, cx + w * 0.5, cy);
      const lidY = cy - hgt - open * 8 * s;
      g.fillStyle(0x8a5a2c, a).fillEllipse(cx, lidY, w * 2, Math.max(1, (5 - open * 3) * s + 1));
      g.lineStyle(1.2 * s, 0xe6c46a, a).strokeEllipse(cx, lidY, w * 2, Math.max(1, (5 - open * 3) * s + 1));
      if (raw >= 1 && k - (ctx.dt * 1000) / WIN_MS < 0.3)
        for (let i = 0; i < (ctx.ambient ? 12 : 6); i++) {
          const d = -Math.PI * (0.2 + (0.6 * i) / 11);
          ctx.emit({ x: cx, y: cy - hgt, vx: Math.cos(d) * (60 + Math.random() * 40), vy: Math.sin(d) * (150 + Math.random() * 60), life: 1.1, size: 2.6 * ctx.sc, color: i % 3 ? 0xffd65b : 0xfff3c4, shape: "coin", spin: 8 + Math.random() * 6, behind: true, fadeIn: 0.08, drag: 0.6 });
        }
    }
  }
}
