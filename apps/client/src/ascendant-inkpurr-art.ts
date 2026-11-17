/**
 * Ascendant Inkpurr's new attacks in the Lantern Yard (raid-gloomshade-art.ts
 * and boss-spell-art.ts call these): Nightfall's warning (the dark closing
 * in, its pools of moonlight and the lit lanterns that stay safe), the pools
 * that linger as light once it lands, and the Shade Pounce's circles. Like
 * every raid warning, edges are the server's exact shapes (a pool's radius,
 * a circle's radius) and only fills pulse; each is told apart by shape as
 * well as colour (a crescent in each pool, a paw and order dots in each
 * circle, an eclipse icon for "can't jump this").
 *
 * The effects (pools welling with moonlight, a pounce's wind-up and its
 * landing splash) go through the effects engine, inside fx.essential: they
 * warn, so Low's glow budget never shrinks them.
 */
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import type { RaidWarning } from "../../../packages/shared/src/raid";
import { lanternRadius } from "../../../packages/shared/src/raid";
import type { Fx } from "./fx-engine";
import type { BossCast } from "./boss-performance";

type G = Phaser.GameObjects.Graphics;
type Glow = (
  x: number,
  y: number,
  r: number,
  c: number,
  a: number,
  floor?: boolean,
) => void;
const DANGER = 0xff4059,
  EDGE = 0xff8c99,
  DARK = 0x05030c,
  INK = 0x2a1f62,
  CURSE = 0xb07bff,
  MOON = 0xfff3c4,
  MOON_GOLD = 0xffd65b,
  PALE = 0xd9e4ff,
  LAMP = 0xffd27a;
const W = 1600,
  H = 900;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const progressOf = (w: RaidWarning, now: number) =>
  w.startedAt === undefined
    ? 1
    : clamp((now - w.startedAt) / Math.max(0.01, w.at - w.startedAt));

/** A crescent moon (the "safe light" glyph). */
function crescent(g: G, x: number, y: number, r: number, alpha: number) {
  g.fillStyle(0x10142c, 0.85 * alpha).fillCircle(x, y, r + 5);
  g.fillStyle(MOON, alpha).fillCircle(x, y, r);
  g.fillStyle(0x10142c, alpha).fillCircle(x + r * 0.45, y - r * 0.3, r * 0.85);
}
/** "Can't jump this": an eclipsed moon, an up arrow struck through. */
function eclipseIcon(g: G, x: number, y: number) {
  g.fillStyle(0x0c0a1f, 0.94).fillCircle(x, y, 24);
  g.lineStyle(3, DANGER, 1).strokeCircle(x, y, 24);
  g.lineStyle(3, MOON, 0.9).strokeCircle(x, y, 15);
  g.lineStyle(4, MOON, 1)
    .lineBetween(x, y + 9, x, y - 9)
    .lineBetween(x - 7, y - 2, x, y - 9)
    .lineBetween(x + 7, y - 2, x, y - 9);
  g.lineStyle(4, DANGER, 1).lineBetween(x - 15, y + 15, x + 15, y - 15);
}
/** A paw print (the pounce glyph). */
function paw(g: G, x: number, y: number, s: number, color: number, a: number) {
  g.fillStyle(color, a).fillEllipse(x, y + s * 0.35, s * 1.25, s);
  for (const [dx, dy] of [
    [-0.62, -0.42],
    [-0.22, -0.78],
    [0.22, -0.78],
    [0.62, -0.42],
  ])
    g.fillCircle(x + dx * s, y + dy * s, s * 0.26);
}
/** A progress arc just inside a circle's edge (the countdown). */
function timer(g: G, x: number, y: number, r: number, k: number, c: number) {
  g.lineStyle(5, c, 0.95)
    .beginPath()
    .arc(x, y, Math.max(0, r), -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2)
    .strokePath();
}
/** A dashed line (the leap a body will make). */
function dashed(
  g: G,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: number,
  alpha: number,
  flow: number,
) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1) return;
  const ux = (x1 - x0) / len,
    uy = (y1 - y0) / len;
  g.lineStyle(3, color, alpha);
  for (let s = flow % 28; s < len; s += 28) {
    const e = Math.min(len, s + 14);
    g.lineBetween(x0 + ux * s, y0 + uy * s, x0 + ux * e, y0 + uy * e);
  }
}

/** Ascendant Inkpurr's warnings. Returns false for kinds it doesn't draw. */
export function drawAscendantInkWarning(
  g: G,
  state: Snapshot,
  w: RaidWarning,
  reduced: boolean,
) {
  const r = state.raid!;
  const t = state.time;
  const pulse = reduced ? 1 : 0.86 + Math.sin(t * 8) * 0.14;
  const progress = progressOf(w, t);
  if (w.kind === "nightfall") {
    const pools = w.pools ?? [];
    // The yard darkens, and the dark closes in from every edge.
    g.fillStyle(DARK, (0.25 + 0.4 * progress) * pulse).fillRect(0, 0, W, H);
    const band = 20 + progress * 150;
    g.fillStyle(DARK, 0.55)
      .fillRect(0, 0, W, band)
      .fillRect(0, H - band, W, band)
      .fillRect(0, band, band, H - band * 2)
      .fillRect(W - band, band, band, H - band * 2);
    g.lineStyle(3, EDGE, 0.7).strokeRect(
      band,
      band,
      W - band * 2,
      H - band * 2,
    );
    // Lit lanterns hold the dark back: a gold ring at their reach.
    const reach = lanternRadius(r.trait);
    for (const l of r.lanterns ?? []) {
      if (!l.lit) continue;
      g.fillStyle(LAMP, 0.1).fillCircle(l.x, l.y, reach);
      g.lineStyle(4, LAMP, 0.95).strokeCircle(l.x, l.y, reach);
    }
    // The pools of moonlight: pale, exact edges, a crescent and a timer.
    for (const p of pools) {
      g.fillStyle(PALE, 0.22 + 0.16 * progress).fillCircle(p.x, p.y, p.radius);
      g.lineStyle(5, MOON, 1).strokeCircle(p.x, p.y, p.radius);
      g.lineStyle(2, 0x10142c, 0.8).strokeCircle(p.x, p.y, p.radius + 4);
      timer(g, p.x, p.y, p.radius - 11, progress, MOON_GOLD);
      crescent(g, p.x, p.y, 16, 1);
    }
    eclipseIcon(g, W / 2, 64);
    return true;
  }
  if (w.kind === "pounce") {
    // The body that will leap (its dashed path), the exact circle, a paw,
    // its order in dots, and the countdown.
    const from =
      w.body === undefined
        ? undefined
        : w.body === 0
          ? state.players.find((p) => p.raidBoss)
          : (r.decoys ?? []).find((d) => d.id === w.body);
    if (from && progress < 0.95)
      dashed(g, from.x, from.y, w.x, w.y, CURSE, 0.55, reduced ? 0 : t * 60);
    g.fillStyle(INK, 0.22 * pulse).fillCircle(w.x, w.y, w.radius);
    g.fillStyle(DANGER, 0.08 + 0.14 * progress).fillCircle(
      w.x,
      w.y,
      w.radius * (0.25 + 0.75 * progress),
    );
    g.lineStyle(4, DANGER, 1).strokeCircle(w.x, w.y, w.radius);
    g.lineStyle(1, EDGE, 0.9).strokeCircle(w.x, w.y, Math.max(0, w.radius - 7));
    paw(g, w.x, w.y - 6, 22, 0xe0ccff, 0.75);
    timer(g, w.x, w.y, w.radius - 12, progress, 0xffd1d6);
    // Its order in dots, inside the circle below the paw (name tags and
    // bodies stand above a circle; the lower half stays clear).
    const order = w.chain ?? 1;
    const dy = w.y + w.radius * 0.55;
    for (let i = 0; i < order; i++) {
      const x = w.x + (i - (order - 1) / 2) * 20;
      g.fillStyle(0x2a0d12, 1).fillCircle(x, dy, 8.5);
      g.fillStyle(0xffd1d6, 1).fillCircle(x, dy, 5.5);
    }
    return true;
  }
  return false;
}

/** Nightfall's pools once it has landed: soft moonlight, fading out. */
export function drawMoonPools(g: G, state: Snapshot, reduced: boolean) {
  const t = state.time;
  for (const b of state.raid?.lights ?? []) {
    if (!b.moon) continue;
    const left = b.until - t;
    if (left <= 0) continue;
    const fade = Math.min(1, left / 0.8);
    const shimmer = reduced ? 1 : 0.9 + 0.1 * Math.sin(t * 3 + b.x);
    g.fillStyle(PALE, 0.16 * fade * shimmer).fillCircle(b.x, b.y, b.radius);
    g.lineStyle(3, MOON, 0.7 * fade).strokeCircle(b.x, b.y, b.radius);
  }
}

/**
 * Effects: moonlight welling up in Nightfall's pools, a pounce's wind-up in
 * its circle, the splash of ink where it lands, and the dark settling.
 */
export function drawAscendantInkFx(
  fx: Fx,
  glow: Glow,
  state: Snapshot,
  casts: BossCast[],
  low: boolean,
) {
  const r = state.raid;
  if (!r) return;
  for (const w of r.warnings) {
    const start = w.startedAt ?? w.at - 1,
      k = clamp((state.time - start) / Math.max(0.01, w.at - start));
    if (k <= 0 || k >= 1) continue;
    if (w.kind === "nightfall")
      for (const p of w.pools ?? []) {
        fx.essential(() =>
          glow(p.x, p.y, p.radius * 0.55, PALE, 0.1 + 0.16 * k, true),
        );
        fx.trail(`ink-moon-${w.id}-${p.x | 0}`, low ? 0.3 : 0.14, () => {
          const a = Math.random() * Math.PI * 2,
            d = Math.random() * p.radius * 0.7;
          fx.burst({
            x: p.x + Math.cos(a) * d,
            y: p.y + Math.sin(a) * d * 0.6,
            z: 0,
            count: 1,
            kind: "mote",
            color: [MOON, PALE, 0xffffff],
            speed: [5, 20],
            up: [30, 70],
            life: [0.5, 0.8],
            size: [2, 3],
            drag: 1.2,
          });
        });
      }
    else if (w.kind === "pounce" && k > 0.5)
      fx.essential(() =>
        glow(w.x, w.y, w.radius * 0.3 * k, CURSE, 0.12 + 0.18 * k, true),
      );
  }
  for (const c of casts) {
    if (c.kind === "pounce") {
      // the landing: a splash of ink inside its circle, and a ring
      fx.trail(`ink-pounce-${c.id}`, 99, () =>
        fx.burst({
          x: c.x,
          y: c.y,
          z: 0,
          count: low ? 6 : 12,
          kind: "drop",
          color: [0x07030f, INK, CURSE],
          speed: [40, c.radius * 1.4],
          up: [80, 200],
          life: [0.35, 0.6],
          size: [2.5, 5],
          grav: 900,
        }),
      );
      const k = clamp(c.age / 0.5);
      if (k >= 1) continue;
      fx.floor
        .lineStyle(6 * (1 - k) + 1, CURSE, 0.5 * (1 - k))
        .strokeEllipse(
          c.x,
          c.y,
          c.radius * 2 * (0.4 + 0.6 * k),
          c.radius * 1.1 * (0.4 + 0.6 * k),
        );
    } else if (c.kind === "nightfall") {
      // the dark settles: a ring of shadow sweeping in from the edges
      const k = clamp(c.age / 0.6);
      if (k >= 1) continue;
      const inset = 40 + k * 260;
      fx.floor
        .lineStyle(18 * (1 - k) + 2, 0x1a1036, 0.6 * (1 - k))
        .strokeRect(inset, inset * 0.56, W - inset * 2, H - inset * 1.12);
    }
  }
}

/**
 * Ascendant Inkpurr's aura, on every body alike (copies included, so it
 * never tells the real one apart): a slow violet ring on the floor and a few
 * moon motes rising. No glows: up to five bodies carry it.
 */
export function paintAscendantInkAura(
  fx: Fx,
  x: number,
  y: number,
  time: number,
  phase: number,
  seed: number,
  reduced: boolean,
  low: boolean,
) {
  const t = reduced ? 0 : time,
    deep = 0.5 + 0.15 * phase;
  const fy = y + 18;
  const ring = 70 + ((t * 18 + seed * 7) % 36);
  fx.floor
    .lineStyle(2.2, CURSE, 0.4 * deep * (1 - (ring - 70) / 36))
    .strokeEllipse(x, fy, ring * 2, ring * 0.8);
  fx.floor.lineStyle(1.6, MOON, 0.22 * deep).strokeEllipse(x, fy, 132, 52);
  if (reduced) return;
  const count = low ? 2 : 3 + phase;
  for (let i = 0; i < count; i++) {
    const k = (t * 0.5 + i / count + seed * 0.13) % 1,
      side = Math.sin(i * 2.7 + seed) * 0.5;
    const px = x + side * 110 + Math.sin(k * 5 + i) * 8,
      py = y - 30 - k * 120;
    const c = i % 2 ? CURSE : MOON;
    fx.g.fillStyle(c, Math.sin(k * Math.PI) * 0.75).fillCircle(px, py, 2.2);
  }
}
