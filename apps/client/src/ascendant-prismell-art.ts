/**
 * Ascendant Prismell's new attacks in the Sun Atrium (raid-prismatail-art.ts
 * and boss-spell-art.ts call these):
 *
 * - The Eclipse's warning: sunfall on the old skylight (its exact circle,
 *   filling, with a countdown) while a dark moon slides over the lens, and
 *   the window the light opens at next: a gold ring with a sun on it and a
 *   dashed arrow from the old window, shown from the start.
 * - The Umbral Prism: on its raider (for everyone) a violet ring at the
 *   feet with the shatter countdown, a dark prism beside them, a gold arc
 *   that fills while handed-on light reaches them, the beam it comes along,
 *   and a faint dashed ring at the hand-off distance (light from closer
 *   doesn't count).
 *
 * Like every raid warning, edges are the server's exact shapes and only
 * fills pulse. The effects (the new window's glow, motes round a dark
 * prism, the light pouring in) go through the effects engine; the glows
 * that say where to go are inside fx.essential, so Low's glow budget never
 * shrinks them.
 */
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import {
  ASCENDANT_PRISMELL as A,
  type RaidWarning,
} from "../../../packages/shared/src/raid";
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
  EDGE = 0xff9ab0,
  SUN = 0xffd65b,
  IVORY = 0xfff3c4,
  UMBRA = 0x2a1846,
  VIOLET = 0xb48cff,
  NIGHT = 0x120a22;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const progressOf = (w: RaidWarning, now: number) =>
  w.startedAt === undefined
    ? 1
    : clamp((now - w.startedAt) / Math.max(0.01, w.at - w.startedAt));

/** Where the dark prism floats from its raider's feet (beside them: name tags sit above). */
export const UMBRAL_MARK = { x: 66, y: -16 };
/** The new window's gold ring (px round the skylight's lens). */
export const WINDOW_RING = 62;

/** A dashed circle. */
function dashed(
  g: G,
  x: number,
  y: number,
  r: number,
  width: number,
  color: number,
  alpha: number,
  n = 28,
) {
  g.lineStyle(width, color, alpha);
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * Math.PI * 2,
      a1 = ((i + 1) / n) * Math.PI * 2;
    g.beginPath().arc(x, y, r, a0, a1).strokePath();
  }
}
/** A progress arc just inside a circle's edge (a countdown). */
function arc(
  g: G,
  x: number,
  y: number,
  r: number,
  k: number,
  c: number,
  w = 5,
) {
  if (k <= 0) return;
  g.lineStyle(w, c, 0.95)
    .beginPath()
    .arc(x, y, Math.max(0, r), -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2)
    .strokePath();
}
/** A small sun: a disc and eight rays. */
function sun(g: G, x: number, y: number, s: number, alpha = 1) {
  g.fillStyle(NIGHT, 0.85 * alpha).fillCircle(x, y, 17 * s);
  g.lineStyle(3, SUN, alpha);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.lineBetween(
      x + Math.cos(a) * 9 * s,
      y + Math.sin(a) * 9 * s,
      x + Math.cos(a) * 15 * s,
      y + Math.sin(a) * 15 * s,
    );
  }
  g.fillStyle(SUN, alpha).fillCircle(x, y, 6.5 * s);
}
/** The dark prism: a violet-black crystal outlined in lilac. */
function prism(g: G, x: number, y: number, s: number, lit: number) {
  const pts = [
    { x, y: y - 17 * s },
    { x: x + 10 * s, y: y - 3 * s },
    { x, y: y + 15 * s },
    { x: x - 10 * s, y: y - 3 * s },
  ];
  g.fillStyle(NIGHT, 0.95).fillCircle(x, y, 21 * s);
  g.fillStyle(UMBRA, 1).fillPoints(pts, true);
  g.lineStyle(3, lit > 0 ? IVORY : VIOLET, 1).strokePoints(pts, true);
  g.lineStyle(2, VIOLET, 0.8).lineBetween(
    x - 10 * s,
    y - 3 * s,
    x + 10 * s,
    y - 3 * s,
  );
  if (lit > 0) arc(g, x, y, 20 * s, lit, SUN, 3);
}

/** Ascendant Prismell's warnings. Returns false for kinds it doesn't draw. */
export function drawAscendantPrismellWarning(
  g: G,
  state: Snapshot,
  w: RaidWarning,
  reduced = false,
) {
  const t = state.time;
  const k = progressOf(w, t);
  const pulse = reduced ? 1 : 0.86 + Math.sin(t * 7) * 0.14;
  if (w.kind === "eclipse") {
    // Sunfall on the old window: its exact circle, filling.
    g.fillStyle(DANGER, (0.12 + 0.24 * k) * pulse).fillCircle(
      w.x,
      w.y,
      w.radius,
    );
    g.lineStyle(4, EDGE, 1).strokeCircle(w.x, w.y, w.radius);
    arc(g, w.x, w.y, w.radius - 9, k, SUN);
    // The dark moon slides over the lens.
    const mx = w.x - 46 * (1 - k),
      my = w.y - 23;
    g.fillStyle(SUN, 0.9).fillCircle(w.x, my, 20);
    g.fillStyle(NIGHT, 0.96).fillCircle(mx, my, 20);
    g.lineStyle(2, VIOLET, 0.9).strokeCircle(mx, my, 20);
    // The new window, from the start: a gold ring and a sun.
    const dx = w.tx - w.x,
      dy = w.ty - w.y,
      len = Math.hypot(dx, dy);
    if (len > 1) {
      const ux = dx / len,
        uy = dy / len;
      const from = w.radius + 10,
        to = len - WINDOW_RING - 10;
      const flow = reduced ? 0 : (t * 60) % 26;
      for (const [width, color, alpha] of [
        [7, NIGHT, 0.45],
        [4, SUN, 0.95],
      ] as const) {
        g.lineStyle(width, color, alpha);
        for (let s = from + flow; s < to; s += 26) {
          const e = Math.min(to, s + 14);
          g.lineBetween(w.x + ux * s, w.y + uy * s, w.x + ux * e, w.y + uy * e);
        }
      }
      // arrow head
      const hx = w.x + ux * to,
        hy = w.y + uy * to;
      g.fillStyle(SUN, 1).fillTriangle(
        hx + ux * 12,
        hy + uy * 12,
        hx - ux * 6 - uy * 9,
        hy - uy * 6 + ux * 9,
        hx - ux * 6 + uy * 9,
        hy - uy * 6 - ux * 9,
      );
    }
    g.fillStyle(SUN, (0.1 + 0.16 * k) * pulse).fillCircle(
      w.tx,
      w.ty,
      WINDOW_RING,
    );
    g.lineStyle(2, NIGHT, 0.7).strokeCircle(w.tx, w.ty, WINDOW_RING + 4);
    dashed(g, w.tx, w.ty, WINDOW_RING, 5, SUN, 1, 20);
    sun(g, w.tx, w.ty - 23, 1.1);
    return true;
  }
  if (w.kind === "umbral-prism") {
    const lit = clamp((w.lit ?? 0) / A.umbral.lit);
    const fed = Math.hypot(w.tx - w.x, w.ty - w.y) > 1;
    // light from closer than this doesn't count
    dashed(g, w.x, w.y, A.umbral.apart, 3, VIOLET, 0.75, 40);
    // the beam it is handed along
    if (fed) {
      g.lineStyle(14, SUN, 0.32).lineBetween(w.tx, w.ty, w.x, w.y);
      g.lineStyle(5, IVORY, 1).lineBetween(w.tx, w.ty, w.x, w.y);
    }
    // the ring at the feet, the shatter countdown and the light it soaked
    g.fillStyle(UMBRA, (0.22 + 0.2 * k) * pulse).fillCircle(w.x, w.y, w.radius);
    g.lineStyle(4, VIOLET, 1).strokeCircle(w.x, w.y, w.radius);
    arc(g, w.x, w.y, w.radius - 7, 1 - k, DANGER, 4);
    arc(g, w.x, w.y, w.radius + 6, lit, SUN, 5);
    prism(g, w.x + UMBRAL_MARK.x, w.y + UMBRAL_MARK.y, 1.35, lit);
    return true;
  }
  return false;
}

/**
 * Effects: the new window welling with light and the old one's sunfall
 * gathering (essential: they say where to go and where not to stand),
 * violet motes round a dark prism, gold ones while light reaches it.
 */
export function drawAscendantPrismellFx(
  fx: Fx,
  glow: Glow,
  state: Snapshot,
  casts: BossCast[],
  low: boolean,
) {
  const r = state.raid;
  if (!r) return;
  for (const w of r.warnings) {
    const k = progressOf(w, state.time);
    if (k <= 0 || k >= 1) continue;
    if (w.kind === "eclipse") {
      fx.essential(() => {
        glow(w.tx, w.ty, WINDOW_RING * 1.1, SUN, 0.14 + 0.2 * k, true);
        glow(w.x, w.y, w.radius * 0.7, DANGER, 0.08 + 0.12 * k, true);
      });
      continue;
    }
    if (w.kind !== "umbral-prism") continue;
    const lit = (w.lit ?? 0) > 0 && Math.hypot(w.tx - w.x, w.ty - w.y) > 1;
    if (lit)
      fx.essential(() => glow(w.x, w.y, w.radius * 0.9, SUN, 0.22, true));
    fx.trail(`prism-umbra-${w.id}`, low ? 0.4 : 0.18, () =>
      fx.burst({
        x: w.x + UMBRAL_MARK.x,
        y: w.y + UMBRAL_MARK.y,
        z: 0,
        count: 1,
        kind: "mote",
        color: lit ? [SUN, IVORY] : [VIOLET, 0x6a4cc0],
        speed: [10, 30],
        up: [20, 50],
        life: [0.5, 0.8],
        size: [2, 3.2],
        drag: 1,
      }),
    );
  }
  for (const c of casts) {
    if (c.kind !== "eclipse") continue;
    // the sunfall lands: a ring of light breaking outwards
    const k = clamp(c.age / 0.5);
    if (k >= 1) continue;
    fx.floor
      .lineStyle(10 * (1 - k) + 2, SUN, 0.7 * (1 - k))
      .strokeEllipse(
        c.x,
        c.y,
        c.radius * 2 * (0.8 + 0.5 * k),
        c.radius * 1.1 * (0.8 + 0.5 * k),
      );
  }
}

/**
 * Ascendant Prismell's aura: a slow corona ring on the marble and a few
 * prism shards circling its shell. No glows (it is always on).
 */
export function paintAscendantPrismellAura(
  fx: Fx,
  x: number,
  y: number,
  time: number,
  phase: number,
  reduced: boolean,
  low: boolean,
) {
  const t = reduced ? 0 : time,
    deep = 0.5 + 0.15 * phase;
  const fy = y + 20;
  const ring = 96 + ((t * 18) % 40);
  fx.floor
    .lineStyle(2.4, SUN, 0.4 * deep * (1 - (ring - 96) / 40))
    .strokeEllipse(x, fy, ring * 2, ring * 0.8);
  fx.floor.lineStyle(1.6, VIOLET, 0.26 * deep).strokeEllipse(x, fy, 184, 70);
  if (reduced) return;
  const count = low ? 2 : 3 + phase;
  for (let i = 0; i < count; i++) {
    const a = t * 0.8 + (i / count) * Math.PI * 2;
    const px = x + Math.cos(a) * 120,
      py = y - 60 + Math.sin(a) * 34;
    const c = i % 2 ? VIOLET : SUN;
    fx.g.fillStyle(c, 0.75).fillTriangle(px, py - 6, px + 4, py, px - 4, py);
    fx.g.fillStyle(c, 0.5).fillTriangle(px, py + 6, px + 4, py, px - 4, py);
  }
}

/** Ascendant Prismell's callouts, most urgent first ("" when none). */
export function ascendantPrismellCue(
  state: Snapshot,
  myId: string,
  w: RaidWarning | undefined,
) {
  const r = state.raid;
  if (r?.boss !== "prismatail" || r.variant !== "ascendant") return "";
  const mine = r.warnings.find(
    (x) => x.kind === "umbral-prism" && x.targetId === myId,
  );
  const alone =
    state.players.filter((p) => !p.raidBoss && p.hp > 0).length <= 1;
  if (w?.kind === "eclipse")
    return "Eclipse — leave the sunfall! The light opens at the gold window.";
  if (mine)
    return alone
      ? "Umbral Prism on you — stand in the skylight's light to cleanse it!"
      : "Umbral Prism on you — stand a step past a teammate in the light!";
  const other = r.warnings.find((x) => x.kind === "umbral-prism");
  if (other && (!w || w.kind === "umbral-prism")) {
    const who = state.players.find((p) => p.id === other.targetId)?.name;
    return `Umbral Prism on ${who ?? "an ally"} — hand them the light from a step away!`;
  }
  return "";
}
