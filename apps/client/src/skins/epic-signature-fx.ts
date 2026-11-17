import type Phaser from "phaser";
import type { CharacterId } from "@arena/shared";
import type { FxContext, FxShape } from "./skin-fx";
import { WORLD_ART } from "../../../../packages/shared/src/world-art";

/**
 * Signature effects for the Abyssal Expedition, Dream Carnival and Nova
 * Vanguard Epics: each of the 54 skins has its own motif, tied to the
 * champion and the collection (Tidefin's reef fish, Lumoth's angler lure,
 * Astrabun's juggled mochi, Shadopus's cards...).
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
const diamond = (g: G, x: number, y: number, w: number, hgt: number, c: number, a = 1) =>
  g.fillStyle(c, a).fillPoints(
    [
      { x, y: y - hgt },
      { x: x + w, y },
      { x, y: y + hgt },
      { x: x - w, y },
    ],
    true,
  );
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

// ---- Abyssal Expedition: bioluminescence, sonar and sea life. ----
const abyssal: Record<CharacterId, Signature> = {
  voltkit: {
    name: "Electric eel",
    c: 0x7ff3ff,
    h: 0xfff07a,
    burst: "spark",
    draw: (f) => {
      // An eel swims a ring round the waist, its body flickering with charge.
      const head = (f.t / 1700) % 1;
      const pts = curve(f.full ? 10 : 6, (u) => {
        const a = (head - u * 0.32) * TAU;
        return {
          x: f.x + Math.cos(a) * 30 * f.s * f.boost,
          y: f.body + Math.sin(a) * 9 * f.s + Math.sin(u * 12 + f.t / 90) * 1.6 * f.s,
        };
      });
      const g = on(f, Math.sin(head * TAU) > 0);
      g.lineStyle(3.4 * f.s, f.c, 0.85).strokePoints(pts);
      g.lineStyle(1.2 * f.s, f.h, 0.4 + 0.5 * wave(f.t / 160)).strokePoints(pts);
      glowDot(g, pts[0].x, pts[0].y, 2.2 * f.s, f.h);
    },
  },
  cindrake: {
    name: "Thermal vent",
    c: 0xff9a4d,
    h: 0x7ff3e6,
    burst: "bubble",
    draw: (f) => {
      // A vent glows on the sea floor and heat shimmers up behind.
      const k = wave(f.t / 1400);
      f.under.fillStyle(f.c, 0.16 + 0.12 * k).fillEllipse(f.x, f.ground, 46 * f.s * f.boost, 13 * f.s * f.boost);
      f.under.fillStyle(0xffe08a, 0.25 + 0.2 * k).fillEllipse(f.x, f.ground, 18 * f.s, 5 * f.s);
      for (const dx of f.full ? [-22, 22, -12, 12] : [-22, 22]) {
        const pts = curve(6, (u) => ({
          x: f.x + dx * f.s + Math.sin(u * 7 + f.t / 260 + dx) * 2.4 * f.s,
          y: f.ground - u * 52 * f.s * f.boost,
        }));
        f.under.lineStyle(1.6 * f.s, f.c, 0.45).strokePoints(pts);
      }
      if (f.full && f.ctx.chance(3, f.ctx.dt))
        f.ctx.emit({ x: f.x + (Math.random() - 0.5) * 40 * f.s, y: f.ground - 4 * f.s, vx: 0, vy: -28, life: 1.1, size: 2 * f.s, color: f.h, shape: "bubble", behind: true });
    },
  },
  tidefin: {
    name: "Reef school",
    c: 0xffb35c,
    h: 0x7ff3e6,
    burst: "bubble",
    draw: (f) => {
      // A small school of reef fish circles at chest height.
      const n = f.full ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const o = orbit(f, i, n, 3600, 34, 10, 0);
        const dir = Math.cos(o.a + Math.PI / 2) > 0 ? 1 : -1;
        const s = 3 * f.s * f.boost;
        on(f, o.front)
          .fillStyle(i % 2 ? f.c : f.h, o.front ? 1 : 0.6)
          .fillEllipse(o.x, o.y, s * 2.4, s * 1.2)
          .fillTriangle(o.x - dir * s * 1.1, o.y, o.x - dir * s * 2, o.y - s * 0.8, o.x - dir * s * 2, o.y + s * 0.8);
      }
    },
  },
  auralynx: {
    name: "Cryo crystals",
    c: 0xbfe8ff,
    h: 0xffffff,
    burst: "flake",
    draw: (f) => {
      // Three ice shards drift round slowly, catching a glint in turn.
      for (let i = 0; i < 3; i++) {
        const o = orbit(f, i, 3, 5200, 34, 9, -10);
        const g = on(f, o.front);
        diamond(g, o.x, o.y, 2.6 * f.s * f.boost, 6 * f.s * f.boost, f.c, o.front ? 0.95 : 0.55);
        g.lineStyle(1 * f.s, 0x2a6a9a, 0.7).lineBetween(o.x, o.y - 5 * f.s, o.x, o.y + 5 * f.s);
        if (f.full && (f.t / 600 + i / 3) % 1 < 0.15) sparkle(g, o.x, o.y - 4 * f.s, 2.2 * f.s, f.h);
      }
      if (f.full && f.ctx.chance(2, f.ctx.dt))
        f.ctx.emit({ x: f.x + (Math.random() - 0.5) * 50 * f.s, y: f.headCY, vx: 0, vy: 12, life: 0.9, size: 2 * f.s, color: f.h, shape: "flake" });
    },
  },
  lumoth: {
    name: "Angler lure",
    c: 0xb6ffe0,
    h: 0xffffff,
    burst: "dot",
    draw: (f) => {
      // A glowing lure bobs on a stalk curving forward over the head.
      const side = Math.abs(f.fx) > 0.3 ? Math.sign(f.fx) : 1;
      const bob = Math.sin(f.t / 420) * 3 * f.s;
      const tip = { x: f.headX + side * 16 * f.s * f.boost, y: f.headY - 12 * f.s * f.boost + bob };
      const stalk = curve(6, (u) => ({
        x: f.headX + side * u * 16 * f.s * f.boost,
        y: f.headY - Math.sin(u * Math.PI * 0.8) * 16 * f.s * f.boost + u * bob,
      }));
      f.g.lineStyle(1.4 * f.s, 0x2a4a5a, 0.9).strokePoints(stalk);
      glowDot(f.g, tip.x, tip.y, (2.8 + wave(f.t / 900)) * f.s * f.boost, f.c);
      if (f.full)
        for (let i = 0; i < 3; i++) {
          const a = f.t / 400 + (i / 3) * TAU;
          dot(f.g, tip.x + Math.cos(a) * 7 * f.s, tip.y + Math.sin(a) * 4 * f.s, 0.9 * f.s, f.c, 0.7);
        }
    },
  },
  mystowl: {
    name: "Sonar sweep",
    c: 0x8ff5e6,
    h: 0xffffff,
    burst: "ring",
    draw: (f) => {
      // Sonar pings out from the owl: ahead of it in profile, round its head
      // when it faces you or away.
      const n = f.full ? 3 : 2;
      const side = Math.abs(f.fx) > 0.3 ? Math.sign(f.fx) : 0;
      for (let i = 0; i < n; i++) {
        const k = (f.t / 1500 + i / n) % 1;
        const r = f.headR + k * 30 * f.s * f.boost;
        if (side)
          f.g.lineStyle(1.8 * f.s, f.c, 0.75 * (1 - k)).beginPath().arc(f.headX, f.headCY, r, (side > 0 ? 0 : Math.PI) - 0.6, (side > 0 ? 0 : Math.PI) + 0.6).strokePath();
        else f.under.lineStyle(1.8 * f.s, i ? f.c : f.h, 0.75 * (1 - k)).strokeEllipse(f.headX, f.headCY, r * 2, r * 1.5);
      }
    },
  },
  terradon: {
    name: "Anemone garden",
    c: 0xff8fb8,
    h: 0xffe0a0,
    burst: "bubble",
    draw: (f) => {
      // Anemones sway on the sea floor round the shell.
      const n = f.full ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + 0.4;
        const bx = f.x + Math.cos(a) * 34 * f.s,
          by = f.ground + Math.sin(a) * 10 * f.s;
        const sway = Math.sin(f.t / 500 + i) * 3 * f.s;
        const g = on(f, Math.sin(a) > 0);
        g.lineStyle(2 * f.s, f.c, 0.85).lineBetween(bx, by, bx + sway, by - 9 * f.s * f.boost);
        dot(g, bx + sway, by - 9 * f.s * f.boost, 1.8 * f.s, f.h, 0.9);
      }
    },
  },
  duskveil: {
    name: "Moon jelly",
    c: 0xd6b8ff,
    h: 0x8ff5e6,
    burst: "bubble",
    draw: (f) => {
      // A small moon jelly drifts beside the wisp, pulsing as it swims.
      const side = f.fx > 0.3 ? -1 : 1;
      const k = wave(f.t / 1300);
      const jx = f.x + side * 34 * f.s,
        jy = f.headCY - k * 5 * f.s;
      const w = (12 - k * 3) * f.s * f.boost;
      for (const dx of f.full ? [-3, 0, 3] : [-2, 2]) {
        const pts = curve(5, (u) => ({
          x: jx + dx * f.s + Math.sin(u * 5 + f.t / 300 + dx) * 1.6 * f.s,
          y: jy + u * 12 * f.s * f.boost,
        }));
        f.g.lineStyle(1 * f.s, f.c, 0.6).strokePoints(pts);
      }
      f.g.fillStyle(f.c, 0.55).fillEllipse(jx, jy, w, w * 0.7);
      f.g.fillStyle(f.h, 0.8).fillEllipse(jx, jy - 1 * f.s, w * 0.4, w * 0.25);
    },
  },
  coilemur: {
    name: "Live cable",
    c: 0xffd65b,
    h: 0x7ff3ff,
    burst: "spark",
    draw: (f) => {
      // A cable loops the waist; pulses of current run along it.
      const rx = 32 * f.s * f.boost,
        ry = 9 * f.s * f.boost;
      flatRing(f, f.x, f.body + 6 * f.s, rx, ry, 0x5a7890, 0.9, 1.8 * f.s, f.full ? 10 : 6);
      for (let i = 0; i < (f.full ? 3 : 2); i++) {
        const o = orbit(f, i, 3, 1100, 32, 9, 6);
        glowDot(on(f, o.front), o.x, o.y, 1.8 * f.s, i % 2 ? f.h : f.c);
      }
    },
  },
  pyranda: {
    name: "Rescue buoy",
    c: 0xff6a5a,
    h: 0xffffff,
    burst: "ring",
    draw: (f) => {
      // A rescue ring floats beside her, bobbing on an unseen swell.
      const side = f.fx > 0.3 ? -1 : 1;
      const bx = f.x + side * 34 * f.s,
        by = f.body - 4 * f.s + Math.sin(f.t / 600) * 3 * f.s;
      const r = 7 * f.s * f.boost;
      f.g.lineStyle(4 * f.s, f.c, 1).strokeCircle(bx, by, r);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + Math.sin(f.t / 900) * 0.3 + Math.PI / 4;
        f.g.lineStyle(4.2 * f.s, f.h, 1).beginPath().arc(bx, by, r, a - 0.25, a + 0.25).strokePath();
      }
    },
  },
  glacelle: {
    name: "Caustic light",
    c: 0x9ff0ff,
    h: 0xffffff,
    burst: "flake",
    draw: (f) => {
      // Rippling caustics of light play on the ground beneath the bell.
      for (let i = 0; i < (f.full ? 3 : 2); i++) {
        const r = (16 + i * 9) * f.s * f.boost;
        const pts = curve(16, (u) => {
          const a = u * TAU;
          const rr = r + Math.sin(a * 5 + f.t / 380 + i * 2) * 2 * f.s;
          return { x: f.x + Math.cos(a) * rr, y: f.ground + Math.sin(a) * rr * 0.32 };
        });
        f.under.lineStyle(1.3 * f.s, f.c, 0.55 - i * 0.12).strokePoints(pts);
      }
      if (f.full && (f.t / 1700) % 1 < 0.2) sparkle(f.under, f.x + 20 * f.s, f.ground - 2 * f.s, 2.2 * f.s, f.h);
    },
  },
  halcyra: {
    name: "Ocean current",
    c: 0x7ff3e6,
    h: 0xffffff,
    burst: "bubble",
    draw: (f) => {
      // Current streaks stream past behind her, against the way she faces.
      const back = f.fx < -0.3 ? 1 : -1;
      for (let i = 0; i < (f.full ? 3 : 2); i++) {
        const k = (f.t / 900 + i * 0.37) % 1;
        const y0 = f.headCY + i * 14 * f.s;
        const x0 = f.x + back * (16 + k * 30) * f.s * f.boost;
        const pts = curve(5, (u) => ({ x: x0 + back * u * 18 * f.s, y: y0 + Math.sin(u * 5 + f.t / 200) * 2 * f.s }));
        f.under.lineStyle(1.8 * f.s, i % 2 ? f.h : f.c, 0.85 * Math.sin(k * Math.PI)).strokePoints(pts);
      }
    },
  },
  sunbara: {
    name: "Harbour beacon",
    c: 0xfff0a0,
    h: 0xffc84d,
    burst: "star",
    draw: (f) => {
      // A small beacon above the helmet sweeps its beam round like a lighthouse.
      const lx = f.headX,
        ly = f.headY - 8 * f.s;
      const a = (f.t / 2600) * TAU;
      const reach = 44 * f.s * f.boost,
        spread = 0.22;
      const g = Math.sin(a) > 0 ? f.g : f.under;
      g.fillStyle(f.c, 0.2).fillTriangle(lx, ly, lx + Math.cos(a - spread) * reach, ly + Math.sin(a - spread) * reach * 0.3, lx + Math.cos(a + spread) * reach, ly + Math.sin(a + spread) * reach * 0.3);
      glowDot(f.g, lx, ly, 2.4 * f.s, f.h);
    },
  },
  astrabun: {
    name: "Moon bubbles",
    c: 0xd8f4ff,
    h: 0xfff3b0,
    burst: "bubble",
    draw: (f) => {
      // Big bubbles rise past an ear, each holding a sliver of moon.
      for (let i = 0; i < (f.full ? 3 : 2); i++) {
        const k = (f.t / 2400 + i / 3) % 1;
        const bx = f.headX + f.headR + 4 * f.s + Math.sin(k * 6 + i) * 3 * f.s,
          by = f.body - k * 50 * f.s;
        const r = (2.6 + i) * f.s * f.boost;
        const a = Math.sin(k * Math.PI);
        f.g.lineStyle(1.1 * f.s, f.c, 0.85 * a).strokeCircle(bx, by, r);
        f.g.lineStyle(1 * f.s, f.h, 0.9 * a).beginPath().arc(bx, by, r * 0.55, 0.6, 2.6).strokePath();
      }
    },
  },
  wombolder: {
    name: "Headlamp",
    c: 0xfff3c0,
    h: 0xffffff,
    burst: "pebble",
    draw: (f) => {
      // The miner's lamp casts a beam the way it faces, dust drifting in it.
      const dir = Math.abs(f.fx) > 0.3 ? Math.sign(f.fx) : 0;
      const lx = f.headX + dir * 6 * f.s,
        ly = f.headY + 4 * f.s;
      const len = 50 * f.s * f.boost;
      const g = f.fy < -0.3 ? f.under : f.g;
      if (dir) g.fillStyle(f.c, 0.2).fillTriangle(lx, ly, lx + dir * len, ly - 10 * f.s, lx + dir * len, ly + 20 * f.s);
      // Facing you, the beam lands as a pool of light at its feet.
      else f.under.fillStyle(0xffd27a, 0.2 + 0.08 * wave(f.t / 1800)).fillEllipse(f.x, f.ground + 6 * f.s, 50 * f.s * f.boost, 14 * f.s * f.boost);
      glowDot(g, lx, ly, 2.2 * f.s, f.h);
      if (f.full)
        for (let i = 0; i < 3; i++) {
          const k = (f.t / 3000 + i / 3) % 1;
          dot(g, dir ? lx + dir * k * len * 0.8 : f.x + (i - 1) * 14 * f.s, dir ? ly + Math.sin(k * 9 + i) * 5 * f.s : f.ground - k * 20 * f.s, 1 * f.s, f.c, 0.8 * Math.sin(k * Math.PI));
        }
    },
  },
  shadopus: {
    name: "Nautilus spiral",
    c: 0xffc98a,
    h: 0x8ff5e6,
    burst: "bubble",
    draw: (f) => {
      // A glowing nautilus spiral turns slowly behind the captain.
      const rot = -f.t / 1600;
      const pts = curve(f.full ? 22 : 14, (u) => {
        const a = rot + u * TAU * 2.2;
        const r = (3 + u * 30) * f.s * f.boost;
        return { x: f.x + Math.cos(a) * r, y: f.body - 8 * f.s + Math.sin(a) * r };
      });
      f.under.lineStyle(2 * f.s, f.c, 0.65).strokePoints(pts);
      glowDot(f.under, pts[pts.length - 1].x, pts[pts.length - 1].y, 1.8 * f.s, f.h);
    },
  },
  pangrove: {
    name: "Kelp guard",
    c: 0x6fe0a0,
    h: 0xd6ffcf,
    burst: "leaf",
    draw: (f) => {
      // Three kelp blades orbit like a living shield, fluttering as they go.
      for (let i = 0; i < 3; i++) {
        const o = orbit(f, i, 3, 4200, 34, 10, -4);
        const g = on(f, o.front);
        const flutter = Math.sin(f.t / 220 + i) * 0.4;
        const len = 11 * f.s * f.boost;
        const tx = o.x + Math.sin(flutter) * len,
          ty = o.y - Math.cos(flutter) * len;
        g.fillStyle(f.c, o.front ? 0.95 : 0.55).fillTriangle(o.x - 3 * f.s, o.y, o.x + 3 * f.s, o.y, tx, ty);
        g.lineStyle(0.8 * f.s, f.h, 0.8).lineBetween(o.x, o.y, tx, ty);
      }
    },
  },
  mossloth: {
    name: "Coral polyps",
    c: 0xff9ac8,
    h: 0xfff0f6,
    burst: "dot",
    draw: (f) => {
      // Little coral branches glow at the feet, their polyps opening in turn.
      for (const [i, dx] of (f.full ? [-28, -12, 24] : [-26, 22]).entries()) {
        const bx = f.x + dx * f.s,
          by = f.ground + (i === 1 ? 4 : 0) * f.s;
        const k = wave(f.t / 1600 + i * 0.33);
        const top = by - (10 + k * 3) * f.s * f.boost;
        f.under.lineStyle(2 * f.s, f.c, 0.9).lineBetween(bx, by, bx, top).lineBetween(bx, by - 5 * f.s, bx - 4 * f.s, top + 3 * f.s);
        dot(f.under, bx, top, (1.2 + k) * f.s, f.h, 0.9);
      }
    },
  },
};

// ---- Dream Carnival: props, stage lights and tricks. ----
const carnival: Record<CharacterId, Signature> = {
  voltkit: {
    name: "Jester bells",
    c: 0xffd84d,
    h: 0xd85b98,
    burst: "star",
    draw: (f) => {
      // Three little bells circle the head and ring with sparks in turn.
      for (let i = 0; i < 3; i++) {
        const a = (f.t / 3000) * TAU + (i / 3) * TAU;
        const front = Math.sin(a) > 0;
        const x = f.headX + Math.cos(a) * (f.headR + 6 * f.s) * f.boost,
          y = f.headY + Math.sin(a) * 5 * f.s;
        const g = on(f, front);
        const r = 3 * f.s * f.boost;
        g.fillStyle(f.c, front ? 1 : 0.6).fillCircle(x, y, r);
        g.fillStyle(0x6a4a1f, 0.9).fillCircle(x, y + r * 0.5, r * 0.3);
        if (f.full && (f.t / 500 + i / 3) % 1 < 0.18) sparkle(g, x + 3 * f.s, y - 3 * f.s, 1.8 * f.s, 0xffffff);
      }
    },
  },
  cindrake: {
    name: "Fire poi",
    c: 0xff7a3a,
    h: 0xffe08a,
    burst: "spark",
    draw: (f) => {
      // Two fire poi swing in circles at its sides, trailing flame arcs.
      for (const side of [-1, 1]) {
        const cx = f.x + side * 30 * f.s,
          cy = f.body;
        const a = (side * f.t) / 520;
        const r = 9 * f.s * f.boost;
        const g = side < 0 ? f.under : f.g;
        g.lineStyle(2.4 * f.s, f.c, 0.45).beginPath().arc(cx, cy, r, a - 1.6 * side, a, side < 0).strokePath();
        g.lineStyle(0.8 * f.s, 0x5a3a2a, 0.7).lineBetween(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        if (f.full) glowDot(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.2 * f.s, f.h);
        else dot(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.2 * f.s, f.h);
      }
    },
  },
  tidefin: {
    name: "Pearl garland",
    c: 0xfff4ea,
    h: 0xc3679b,
    burst: "dot",
    draw: (f) => {
      // A garland of pearls hangs below the chin, a jewel at its centre.
      const swing = Math.sin(f.t / 700) * 2 * f.s;
      const n = f.full ? 10 : 6;
      const y0 = f.headCY + f.headR * 0.92;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = f.x + (u - 0.5) * 30 * f.s * f.boost + swing * Math.sin(u * Math.PI);
        const y = y0 + Math.sin(u * Math.PI) * 7 * f.s;
        const mid = i === n / 2;
        dot(f.g, x, y, (mid ? 2.6 : 1.6) * f.s, mid ? f.h : f.c, 0.95);
      }
    },
  },
  auralynx: {
    name: "Moon trapeze",
    c: 0xffe08a,
    h: 0x9cc4ff,
    burst: "star",
    draw: (f) => {
      // A crescent moon swings on a trapeze above, a star riding it.
      const a = Math.sin(f.t / 800) * 0.5;
      const px = f.headX,
        py = f.headY - 40 * f.s;
      const len = 22 * f.s;
      const mx = px + Math.sin(a) * len,
        my = py + Math.cos(a) * len;
      f.under.lineStyle(0.8 * f.s, f.c, 0.5).lineBetween(px - 5 * f.s, py, mx - 5 * f.s, my).lineBetween(px + 5 * f.s, py, mx + 5 * f.s, my);
      f.under.lineStyle(3 * f.s * f.boost, f.c, 0.95).beginPath().arc(mx, my, 6 * f.s * f.boost, 0.2, Math.PI - 0.2).strokePath();
      sparkle(f.under, mx, my - 2 * f.s, 2 * f.s * f.boost, f.h, 0.9);
    },
  },
  lumoth: {
    name: "Wing ribbons",
    c: 0xb98cff,
    h: 0xffe19a,
    burst: "confetti",
    draw: (f) => {
      // Two satin ribbons stream from the wings in slow waves.
      for (const side of [-1, 1]) {
        const pts = curve(f.full ? 8 : 5, (u) => ({
          x: f.x + side * (18 + u * 22) * f.s * f.boost,
          y: f.body - 8 * f.s + u * 16 * f.s + Math.sin(u * 6 - f.t / 260 + side) * 4 * f.s * u,
        }));
        f.under.lineStyle(3 * f.s, side < 0 ? f.c : f.h, 0.85).strokePoints(pts);
      }
    },
  },
  mystowl: {
    name: "Big-top bunting",
    c: 0xe0405a,
    h: 0xffe19a,
    burst: "confetti",
    draw: (f) => {
      // A string of big-top pennants frames the ringmaster like a tent
      // entrance: its ends tied at the shoulders, its arch high over the hat
      // and plumes, swaying, each flag ruffling in turn. Saturated cloth with
      // a dark edge, so it reads on bright sand and dark courts alike.
      const n = f.full ? 9 : 5;
      const span = (f.headR + 16 * f.s) * f.boost;
      const sway = Math.sin(f.t / 1100) * 2.5 * f.s;
      const peak = f.headY - 20 * f.s * f.boost,
        foot = f.chest;
      const at = (u: number) => {
        // u from -1 (left shoulder) to 1 (right shoulder), sagging a little
        // between the pegs.
        const x = f.headX + Math.sin((u * Math.PI) / 2) * span + sway * (1 - u * u);
        const arch = Math.cos((u * Math.PI) / 2);
        return { x, y: foot - (foot - peak) * arch + Math.abs(Math.sin(u * Math.PI * 2)) * 2 * f.s };
      };
      f.under.lineStyle(1 * f.s, 0x3a2140, 0.9).strokePoints(curve(10, (u) => at(u * 2 - 1)));
      const colors = [f.c, f.h, 0xfff6ea];
      const flags: [number, number, number, number, number, number][] = [];
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) / n) * 2 - 1;
        // Each pennant is pinned at one point and hangs straight down, so the
        // flags on the steep sides of the arch keep their full width.
        const p = at(u);
        const half = 3.4 * f.s * f.boost;
        const a = { x: p.x - half, y: p.y },
          b = { x: p.x + half, y: p.y };
        const ruffle = Math.sin(f.t / 260 + i * 1.3) * 2 * f.s;
        const len = 8 * f.s * f.boost;
        const tip = { x: p.x + ruffle, y: p.y + len };
        f.under.fillStyle(colors[i % 3], 1).fillTriangle(a.x, a.y, b.x, b.y, tip.x, tip.y);
        flags.push([a.x, a.y, b.x, b.y, tip.x, tip.y]);
      }
      f.under.lineStyle(0.9 * f.s, 0x3a2140, 0.85);
      for (const fl of flags) f.under.strokeTriangle(...fl);
    },
  },
  terradon: {
    name: "Carousel lights",
    c: 0xffe19a,
    h: 0xee9b42,
    burst: "coin",
    draw: (f) => {
      // A carousel rim of bulbs turns on the ground, chasing in two colours.
      const n = f.full ? 10 : 6;
      for (let i = 0; i < n; i++) {
        const a = f.t / 2600 + (i / n) * TAU;
        const x = f.x + Math.cos(a) * 34 * f.s * f.boost,
          y = f.ground + Math.sin(a) * 11 * f.s * f.boost;
        const lit = (Math.floor(f.t / 300) + i) % 2 === 0;
        dot(on(f, Math.sin(a) > 0), x, y, 1.8 * f.s, lit ? f.c : f.h, lit ? 1 : 0.6);
      }
    },
  },
  duskveil: {
    name: "Marionette strings",
    c: 0xf2e6ff,
    h: 0xdf718c,
    burst: "star",
    draw: (f) => {
      // A puppeteer's cross bobs above; its strings run down to the wisp.
      const bob = Math.sin(f.t / 650) * 3 * f.s;
      const cy = f.headY - 34 * f.s * f.boost + bob;
      const tilt = Math.sin(f.t / 900) * 4 * f.s * f.boost;
      const w = 14 * f.s * f.boost;
      f.under.lineStyle(2.2 * f.s, f.h, 0.95).lineBetween(f.headX - w, cy - tilt, f.headX + w, cy + tilt).lineBetween(f.headX, cy - 6 * f.s, f.headX, cy + 6 * f.s);
      for (const [dx, ty] of [
        [-14, f.body],
        [14, f.body],
        [0, f.headY + 2 * f.s],
      ] as const)
        f.under.lineStyle(0.7 * f.s, f.c, 0.6).lineBetween(f.headX + dx * f.s, cy + (dx / 14) * tilt, f.x + dx * 1.4 * f.s, ty);
    },
  },
  coilemur: {
    name: "Spinning hoop",
    c: 0x538fcd,
    h: 0xffe19a,
    burst: "ring",
    draw: (f) => {
      // A hoop spins round the waist, tipping as it goes.
      const tip = Math.sin(f.t / 300) * 4 * f.s;
      const r = 30 * f.s * f.boost;
      const cy = f.body + 4 * f.s;
      const half = (front: boolean) =>
        curve(f.full ? 12 : 8, (u) => {
          const a = (front ? 0 : Math.PI) + u * Math.PI;
          return { x: f.x + Math.cos(a) * r, y: cy + Math.sin(a) * 7 * f.s + Math.cos(a) * tip };
        });
      f.under.lineStyle(2.6 * f.s, f.c, 0.9).strokePoints(half(false));
      f.g.lineStyle(2.6 * f.s, f.c, 0.95).strokePoints(half(true));
      const o = orbit(f, 0, 1, 450, 30, 7, 4);
      dot(on(f, o.front), o.x, o.y, 1.6 * f.s, f.h);
    },
  },
  pyranda: {
    name: "Silk fan",
    c: 0xe0405a,
    h: 0xffe19a,
    burst: "leaf",
    draw: (f) => {
      // A great folding fan opens and closes behind her shoulders.
      const open = 0.35 + 0.65 * wave(f.t / 2000);
      const cx = f.x,
        cy = f.chest;
      const r = f.headR + 22 * f.s * f.boost;
      const ribs = f.full ? 7 : 5;
      const a0 = -Math.PI / 2 - open * 1.2,
        a1 = -Math.PI / 2 + open * 1.2;
      f.under.fillStyle(f.c, 0.55).slice(cx, cy, r, a0, a1, false).fillPath();
      for (let i = 0; i <= ribs; i++) {
        const a = a0 + ((a1 - a0) * i) / ribs;
        f.under.lineStyle(1 * f.s, f.h, 0.85).lineBetween(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
    },
  },
  glacelle: {
    name: "Snow-globe pirouette",
    c: 0xffffff,
    h: 0xbd6889,
    burst: "flake",
    draw: (f) => {
      // Glitter spirals up round the ballerina as she turns.
      const n = f.full ? 7 : 4;
      for (let i = 0; i < n; i++) {
        const k = (f.t / 2200 + i / n) % 1;
        const a = k * TAU * 1.5 + i;
        const x = f.x + Math.cos(a) * (30 - k * 8) * f.s * f.boost,
          y = f.ground - k * 64 * f.s;
        const g = on(f, Math.sin(a) > 0);
        if (i % 2) sparkle(g, x, y, 1.8 * f.s, f.c, Math.sin(k * Math.PI));
        else dot(g, x, y, 1.3 * f.s, f.h, Math.sin(k * Math.PI));
      }
    },
  },
  halcyra: {
    name: "Aria notes",
    c: 0xffe19a,
    h: 0xb265af,
    burst: "star",
    draw: (f) => {
      // Music notes rise and sway away from the singer.
      for (let i = 0; i < (f.full ? 3 : 2); i++) {
        const k = (f.t / 2000 + i / 3) % 1;
        const side = i % 2 ? -1 : 1;
        const x = f.headX + side * (f.headR + k * 14 * f.s) + Math.sin(k * 8) * 2 * f.s,
          y = f.headCY - k * 30 * f.s;
        const a = Math.sin(k * Math.PI);
        const s = f.s * f.boost;
        const c = i % 2 ? f.c : f.h;
        f.g.fillStyle(c, a).fillEllipse(x, y, 4.4 * s, 3.4 * s);
        f.g.lineStyle(1.1 * f.s, c, a).lineBetween(x + 2 * s, y, x + 2 * s, y - 9 * s).lineBetween(x + 2 * s, y - 9 * s, x + 5 * s, y - 6 * s);
      }
    },
  },
  sunbara: {
    name: "Parade balloons",
    c: 0xeb9970,
    h: 0x8dd8bd,
    burst: "confetti",
    draw: (f) => {
      // Two balloons bob on strings tied behind.
      for (const [i, side] of [-1, 1].entries()) {
        const bx = f.x + side * 20 * f.s + Math.sin(f.t / 900 + i) * 2 * f.s,
          by = f.headY - 18 * f.s - i * 6 * f.s + Math.sin(f.t / 700 + i * 2) * 3 * f.s;
        const r = 6 * f.s * f.boost;
        f.under.lineStyle(0.7 * f.s, 0xffffff, 0.6).lineBetween(bx, by + r, f.x + side * 6 * f.s, f.body);
        f.under.fillStyle(i ? f.h : f.c, 0.95).fillEllipse(bx, by, r * 1.7, r * 2);
        f.under.fillStyle(0xffffff, 0.6).fillEllipse(bx - r * 0.3, by - r * 0.4, r * 0.4, r * 0.6);
      }
    },
  },
  astrabun: {
    name: "Juggled mochi",
    c: 0xffd6e8,
    h: 0xb6f0c8,
    burst: "dot",
    draw: (f) => {
      // Three mochi arc over the head in a juggling cascade.
      for (let i = 0; i < 3; i++) {
        const k = (f.t / 1500 + i / 3) % 1;
        const x = f.headX + Math.cos(k * TAU) * 18 * f.s * f.boost,
          y = f.headY - 8 * f.s - Math.abs(Math.sin(k * TAU)) * 22 * f.s * f.boost;
        const r = 3.4 * f.s;
        f.g.fillStyle([f.c, 0xffffff, f.h][i], 1).fillEllipse(x, y, r * 2.2, r * 1.8);
        f.g.lineStyle(0.8 * f.s, 0x8a5a6a, 0.5).strokeEllipse(x, y, r * 2.2, r * 1.8);
      }
    },
  },
  wombolder: {
    name: "Drum major baton",
    c: 0xffe19a,
    h: 0x8c72c9,
    burst: "ring",
    draw: (f) => {
      // A baton twirls overhead; each beat rings out on the ground.
      const a = f.t / 260;
      const cx = f.x + 24 * f.s,
        cy = f.headY - 10 * f.s;
      const r = 12 * f.s * f.boost;
      const ex = Math.cos(a) * r,
        ey = Math.sin(a) * r * 0.45;
      f.g.lineStyle(2 * f.s, f.c, 1).lineBetween(cx - ex, cy - ey, cx + ex, cy + ey);
      dot(f.g, cx + ex, cy + ey, 2.4 * f.s, f.h);
      dot(f.g, cx - ex, cy - ey, 1.8 * f.s, f.c);
      const beat = (f.t / 800) % 1;
      groundEllipse(f, 30 + beat * 40, f.h, 0.6 * (1 - beat));
    },
  },
  shadopus: {
    name: "Card fan",
    c: 0xfff6ea,
    h: 0xdf4f5f,
    burst: "confetti",
    draw: (f) => {
      // Playing cards circle, flipping to show their suit.
      const n = f.full ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const o = orbit(f, i, n, 3400, 36, 10, -8);
        const flip = Math.abs(Math.cos(f.t / 400 + i));
        const w = 4 * f.s * f.boost * (0.2 + 0.8 * flip),
          hgt = 6 * f.s * f.boost;
        const g = on(f, o.front);
        g.fillStyle(f.c, o.front ? 1 : 0.6).fillRect(o.x - w, o.y - hgt, w * 2, hgt * 2);
        if (flip > 0.4) diamond(g, o.x, o.y, w * 0.4, hgt * 0.4, f.h, o.front ? 1 : 0.6);
      }
    },
  },
  pangrove: {
    name: "Pinwheel",
    c: 0xd16587,
    h: 0x9fe08a,
    burst: "leaf",
    draw: (f) => {
      // A paper pinwheel on a stick spins at its shoulder.
      const side = f.fx > 0.3 ? -1 : 1;
      const cx = f.x + side * 30 * f.s,
        cy = f.headCY;
      f.under.lineStyle(1.2 * f.s, 0x8a6a3a, 0.9).lineBetween(cx, cy, cx - side * 4 * f.s, f.body + 8 * f.s);
      const a0 = f.t / 220;
      const r = 8 * f.s * f.boost;
      for (let i = 0; i < 4; i++) {
        const a = a0 + (i / 4) * TAU;
        f.under.fillStyle(i % 2 ? f.c : f.h, 0.95).fillTriangle(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a + 0.9) * r * 0.6, cy + Math.sin(a + 0.9) * r * 0.6);
      }
      dot(f.under, cx, cy, 1.4 * f.s, 0xffe19a);
    },
  },
  mossloth: {
    name: "Dream Zs",
    c: 0xe6d6ff,
    h: 0xa263c3,
    burst: "star",
    draw: (f) => {
      // Sleepy Zs float up, swaying, beside a tiny crescent.
      for (let i = 0; i < (f.full ? 3 : 2); i++) {
        const k = (f.t / 2600 + i / 3) % 1;
        const x = f.headX + f.headR + k * 10 * f.s + Math.sin(k * 6) * 3 * f.s,
          y = f.headCY - k * 34 * f.s;
        const s = (2.4 + k * 2) * f.s * f.boost;
        f.g.lineStyle(1.4 * f.s, i % 2 ? f.h : f.c, Math.sin(k * Math.PI)).strokePoints([
          { x: x - s, y: y - s },
          { x: x + s, y: y - s },
          { x: x - s, y: y + s },
          { x: x + s, y: y + s },
        ]);
      }
      f.g.lineStyle(1.6 * f.s, 0xffe19a, 0.85).beginPath().arc(f.headX - f.headR - 4 * f.s, f.headY, 4 * f.s, 0.9, 4.2).strokePath();
    },
  },
};

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

const TABLES: [string, Record<CharacterId, Signature>][] = [
  ["abyssal-expedition", abyssal],
  ["dream-carnival", carnival],
  ["nova-vanguard", vanguard],
];
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
