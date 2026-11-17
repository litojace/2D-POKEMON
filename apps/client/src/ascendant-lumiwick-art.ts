/**
 * Ascendant Lumiwick's new attacks on the Sky Terrace (raid-emberwing-art.ts
 * and boss-spell-art.ts call these):
 *
 * - The Snuffing Gale's warning: its exact lane (red, like every hit) with
 *   cold wind chevrons blowing down it, every brazier ring in it drawn as a
 *   gold shelter (standing in a ring is safe), and the flame it blows at
 *   ringed with the countdown: solid gold while someone holds it, dashed
 *   red and white while nobody does (it will go out).
 * - Bound Wicks: a burning cord between the bound braziers whose sparks run
 *   in from both ends and meet in the middle as the fuse ends; each bound
 *   ring in gold with a tick when someone stands in it; and the Backdraft's
 *   exact circle round each one, faint at first and filling red in the
 *   last seconds (step out if the wick can't be lit).
 *
 * Like every raid warning, edges are the server's exact shapes and only
 * fills pulse. The effects (wind motes down the lane, the fuse's sparks)
 * go through the effects engine; the glows that say where to stand or not
 * to stand are inside fx.essential, so Low's glow budget never shrinks them.
 */
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import {
  ASCENDANT_LUMIWICK as A,
  EMBERWING as E,
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
type Point = { x: number; y: number };
const DANGER = 0xff4059,
  EDGE = 0xffa0ad,
  GOLD = 0xffd778,
  IVORY = 0xfff3c4,
  WIND = 0xd8f4ff,
  FROST = 0x8eddf0,
  CORD = 0x2a120a,
  EMBER = 0xffb347,
  ASH = 0x6f625a,
  NIGHT = 0x140806;
const R = E.brazierRadius;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const progressOf = (w: RaidWarning, now: number) =>
  w.startedAt === undefined
    ? 1
    : clamp((now - w.startedAt) / Math.max(0.01, w.at - w.startedAt));
const segment = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
};

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
  offset = 0,
) {
  g.lineStyle(width, color, alpha);
  for (let i = 0; i < n; i += 2) {
    const a0 = ((i + offset) / n) * Math.PI * 2,
      a1 = ((i + 1 + offset) / n) * Math.PI * 2;
    g.beginPath().arc(x, y, r, a0, a1).strokePath();
  }
}
/** A progress arc just outside a circle's edge (a countdown). */
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
/** A small shield (a sheltered ring's mark), point down. */
function shield(g: G, x: number, y: number, s: number, color = GOLD) {
  const pts = [
    { x: x - 11 * s, y: y - 12 * s },
    { x: x + 11 * s, y: y - 12 * s },
    { x: x + 11 * s, y: y + 1 * s },
    { x, y: y + 13 * s },
    { x: x - 11 * s, y: y + 1 * s },
  ];
  g.fillStyle(NIGHT, 0.85).fillCircle(x, y, 17 * s);
  g.fillStyle(color, 1).fillPoints(pts, true);
  g.lineStyle(2, NIGHT, 0.9).strokePoints(pts, true);
}
/** A wind curl (the gale about to snuff a flame). */
function curl(g: G, x: number, y: number, s: number) {
  g.lineStyle(7, NIGHT, 0.55);
  g.beginPath()
    .arc(x, y, 12 * s, Math.PI * 0.9, Math.PI * 2.4)
    .strokePath();
  g.lineStyle(4, WIND, 1);
  g.beginPath()
    .arc(x, y, 12 * s, Math.PI * 0.9, Math.PI * 2.4)
    .strokePath();
  g.lineBetween(x - 26 * s, y + 6 * s, x - 6 * s, y + 6 * s);
}
/**
 * Where a ring's mark sits (the shelter's shield, the wick's tick, the
 * gale's curl mirrored): below the ring, as name tags sit above a raider.
 */
export const SHELTER_MARK = { x: R * 0.78, y: R * 0.66 };
/** Is a raider standing in this ring (the server's lighting test)? */
const held = (state: Snapshot, b: Point) =>
  state.players.some(
    (p) => !p.raidBoss && p.hp > 0 && Math.hypot(p.x - b.x, p.y - b.y) <= R,
  );

/** Ascendant Lumiwick's warnings. Returns false for kinds it doesn't draw. */
export function drawAscendantLumiwickWarning(
  g: G,
  state: Snapshot,
  w: RaidWarning,
  reduced = false,
) {
  const r = state.raid;
  if (!r) return false;
  const t = state.time;
  const k = progressOf(w, t);
  const pulse = reduced ? 1 : 0.86 + Math.sin(t * 7) * 0.14;
  const braziers = r.braziers ?? [];
  if (w.kind === "snuff-gale") {
    const dx = w.tx - w.x,
      dy = w.ty - w.y,
      len = Math.hypot(dx, dy) || 1,
      ux = dx / len,
      uy = dy / len,
      nx = -uy * w.radius,
      ny = ux * w.radius;
    const quad = [
      { x: w.x + nx, y: w.y + ny },
      { x: w.tx + nx, y: w.ty + ny },
      { x: w.tx - nx, y: w.ty - ny },
      { x: w.x - nx, y: w.y - ny },
    ];
    // The lane: its exact edges, the fill growing as it nears.
    g.fillStyle(DANGER, (0.24 + 0.2 * k) * pulse).fillPoints(quad, true);
    g.lineStyle(9, NIGHT, 0.6)
      .lineBetween(quad[0].x, quad[0].y, quad[1].x, quad[1].y)
      .lineBetween(quad[3].x, quad[3].y, quad[2].x, quad[2].y);
    g.lineStyle(4.5, EDGE, 1)
      .lineBetween(quad[0].x, quad[0].y, quad[1].x, quad[1].y)
      .lineBetween(quad[3].x, quad[3].y, quad[2].x, quad[2].y);
    // Cold wind chevrons blowing down it.
    const flow = reduced ? 0 : (t * 220) % 90;
    for (let s = 40 + flow; s < len - 20; s += 90) {
      const cx = w.x + ux * s,
        cy = w.y + uy * s;
      if (braziers.some((b) => Math.hypot(cx - b.x, cy - b.y) < R + 10))
        continue;
      for (const [width, color, alpha] of [
        [10, NIGHT, 0.5],
        [5, WIND, 1],
      ] as const)
        g.lineStyle(width, color, alpha)
          .lineBetween(
            cx - ux * 24 + nx * 0.55,
            cy - uy * 24 + ny * 0.55,
            cx,
            cy,
          )
          .lineBetween(
            cx - ux * 24 - nx * 0.55,
            cy - uy * 24 - ny * 0.55,
            cx,
            cy,
          );
    }
    // Every ring in the lane shelters whoever stands in it.
    braziers.forEach((b, i) => {
      if (segment(b, w, { x: w.tx, y: w.ty }) > w.radius + R) return;
      g.fillStyle(GOLD, 0.3).fillCircle(b.x, b.y, R);
      g.lineStyle(6, NIGHT, 0.6).strokeCircle(b.x, b.y, R);
      g.lineStyle(3.5, GOLD, 1).strokeCircle(b.x, b.y, R);
      if (i !== w.brazier)
        shield(g, b.x + SHELTER_MARK.x, b.y + SHELTER_MARK.y, 0.8);
    });
    // The flame it blows at: held (gold) or about to go out (red and white).
    const b = w.brazier !== undefined ? braziers[w.brazier] : undefined;
    if (b) {
      const keep = held(state, b);
      if (keep) {
        g.lineStyle(5, GOLD, 1).strokeCircle(b.x, b.y, R + 10);
        shield(g, b.x + SHELTER_MARK.x, b.y + SHELTER_MARK.y, 1.1);
      } else {
        dashed(g, b.x, b.y, R + 10, 5, DANGER, 1, 24, reduced ? 0 : t * 3);
        dashed(g, b.x, b.y, R + 10, 5, IVORY, 1, 24, reduced ? 1 : t * 3 + 1);
      }
      arc(g, b.x, b.y, R + 18, 1 - k, keep ? IVORY : DANGER, 5);
      curl(g, b.x - SHELTER_MARK.x, b.y + SHELTER_MARK.y, 1.15);
    }
    return true;
  }
  if (w.kind === "bound-wicks") {
    const bound = (w.braziers ?? [])
      .map((i) => braziers[i])
      .filter((b): b is NonNullable<typeof b> => !!b);
    const left = Math.max(0, w.at - t);
    const late = clamp(1 - left / 1.6);
    // The Backdraft's exact circle round each bound brazier.
    for (const b of bound) {
      if (late > 0)
        g.fillStyle(DANGER, (0.08 + 0.3 * late) * pulse).fillCircle(
          b.x,
          b.y,
          w.radius,
        );
      dashed(g, b.x, b.y, w.radius, 7, NIGHT, 0.45, 36);
      dashed(g, b.x, b.y, w.radius, late > 0 ? 4.5 : 3.5, EDGE, 1, 36);
    }
    // The burning cord, sparks running in from both ends.
    const pairs: [Point, Point][] = [];
    for (let i = 0; i < bound.length; i++)
      for (let j = i + 1; j < bound.length; j++)
        if (bound.length < 3 || j === i + 1 || (i === 0 && j === 2))
          pairs.push([bound[i], bound[j]]);
    for (const [a, c] of pairs) {
      const len = Math.hypot(c.x - a.x, c.y - a.y) || 1,
        ux = (c.x - a.x) / len,
        uy = (c.y - a.y) / len;
      const s0 = R + 4,
        s1 = len - R - 4,
        mid = (s0 + s1) / 2;
      const burnt = (mid - s0) * k;
      const p = (s: number) => ({ x: a.x + ux * s, y: a.y + uy * s });
      // the link stays drawn (gold dashes over a dark band), ash behind
      // each spark, the cord ahead
      g.lineStyle(10, NIGHT, 0.55);
      g.lineBetween(p(s0).x, p(s0).y, p(s1).x, p(s1).y);
      g.lineStyle(3, GOLD, 0.95);
      for (let s = s0; s < s1; s += 18)
        g.lineBetween(
          p(s).x,
          p(s).y,
          p(Math.min(s + 9, s1)).x,
          p(Math.min(s + 9, s1)).y,
        );
      g.lineStyle(3, ASH, 0.9);
      g.lineBetween(p(s0).x, p(s0).y, p(s0 + burnt).x, p(s0 + burnt).y);
      g.lineBetween(p(s1 - burnt).x, p(s1 - burnt).y, p(s1).x, p(s1).y);
      g.lineStyle(7, CORD, 1).lineBetween(
        p(s0 + burnt).x,
        p(s0 + burnt).y,
        p(s1 - burnt).x,
        p(s1 - burnt).y,
      );
      const flow = reduced ? 0 : (t * 40) % 22;
      g.lineStyle(4, EMBER, 1);
      for (let s = s0 + burnt + flow; s < s1 - burnt - 6; s += 22)
        g.lineBetween(
          p(s).x,
          p(s).y,
          p(Math.min(s + 9, s1 - burnt)).x,
          p(Math.min(s + 9, s1 - burnt)).y,
        );
      for (const s of [s0 + burnt, s1 - burnt]) {
        const q = p(s);
        g.fillStyle(NIGHT, 0.7).fillCircle(q.x, q.y, 10);
        g.fillStyle(EMBER, 1).fillCircle(q.x, q.y, 7);
        g.fillStyle(IVORY, 1).fillCircle(q.x, q.y, 3.5);
      }
    }
    // Each bound ring: gold, with a tick while someone stands in it.
    for (const b of bound) {
      const lit = b.litUntil > t;
      const on = held(state, b);
      g.lineStyle(7, NIGHT, 0.55).strokeCircle(b.x, b.y, R + 6);
      g.lineStyle(4, GOLD, 1).strokeCircle(b.x, b.y, R + 6);
      arc(g, b.x, b.y, R + 14, 1 - k, late > 0 ? DANGER : IVORY, 5);
      const mx = b.x - SHELTER_MARK.x,
        my = b.y + SHELTER_MARK.y;
      g.fillStyle(NIGHT, 0.85).fillCircle(mx, my, 15);
      g.lineStyle(3, on || lit ? GOLD : EDGE, 1).strokeCircle(mx, my, 11);
      if (on || lit)
        g.lineStyle(4, GOLD, 1)
          .beginPath()
          .moveTo(mx - 6, my)
          .lineTo(mx - 1.5, my + 5)
          .lineTo(mx + 7, my - 5)
          .strokePath();
    }
    return true;
  }
  return false;
}

/**
 * Effects: the flame the gale blows at and the bound rings (essential:
 * they say where to stand), the Backdraft gathering in its last seconds,
 * wind motes down the lane and embers off the fuse's sparks.
 */
export function drawAscendantLumiwickFx(
  fx: Fx,
  glow: Glow,
  state: Snapshot,
  casts: BossCast[],
  low: boolean,
) {
  const r = state.raid;
  if (!r) return;
  const braziers = r.braziers ?? [];
  for (const w of r.warnings) {
    const k = progressOf(w, state.time);
    if (k <= 0 || k >= 1) continue;
    if (w.kind === "snuff-gale") {
      const b = w.brazier !== undefined ? braziers[w.brazier] : undefined;
      if (b)
        fx.essential(() =>
          glow(b.x, b.y, R * 1.1, GOLD, 0.18 + 0.16 * k, true),
        );
      fx.trail(`lumi-gale-${w.id}`, low ? 0.3 : 0.12, () => {
        const s = Math.random();
        fx.burst({
          x: w.x + (w.tx - w.x) * s,
          y: w.y + (w.ty - w.y) * s,
          z: 10,
          count: 1,
          kind: "mote",
          color: [WIND, FROST],
          speed: [60, 120],
          up: [0, 10],
          life: [0.4, 0.7],
          size: [2, 3],
          drag: 0.5,
        });
      });
      continue;
    }
    if (w.kind !== "bound-wicks") continue;
    const left = Math.max(0, w.at - state.time);
    for (const i of w.braziers ?? []) {
      const b = braziers[i];
      if (!b) continue;
      fx.essential(() => {
        glow(b.x, b.y, R * 1.05, GOLD, 0.16, true);
        if (left < 1.6)
          glow(
            b.x,
            b.y,
            w.radius * 0.8,
            DANGER,
            0.1 + 0.14 * (1 - left / 1.6),
            true,
          );
      });
    }
    fx.trail(`lumi-wick-${w.id}`, low ? 0.4 : 0.16, () => {
      const [a, c] = (w.braziers ?? []).map((i) => braziers[i]);
      if (!a || !c) return;
      fx.burst({
        x: a.x + (c.x - a.x) * (0.5 * k),
        y: a.y + (c.y - a.y) * (0.5 * k),
        z: 0,
        count: 1,
        kind: "spark",
        color: [EMBER, IVORY],
        speed: [30, 70],
        up: [30, 60],
        life: [0.3, 0.5],
        size: [1.6, 2.6],
        drag: 1,
      });
    });
  }
  for (const c of casts) {
    if (c.kind !== "bound-wicks") continue;
    // the wick snaps: a ring of fire breaking out of each brazier
    const k = clamp(c.age / 0.5);
    if (k >= 1) continue;
    fx.floor
      .lineStyle(10 * (1 - k) + 2, EMBER, 0.7 * (1 - k))
      .strokeEllipse(
        c.x,
        c.y,
        (R + A.wicks.burst) * 2 * (0.8 + 0.4 * k),
        (R + A.wicks.burst) * 1.1 * (0.8 + 0.4 * k),
      );
  }
}

/**
 * Ascendant Lumiwick's aura: a slow ring of heat on the stone under it and
 * a few paper lanterns circling it. No glows (it is always on).
 */
export function paintAscendantLumiwickAura(
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
  const fy = y + 30;
  const ring = 90 + ((t * 16) % 40);
  fx.floor
    .lineStyle(2.4, EMBER, 0.4 * deep * (1 - (ring - 90) / 40))
    .strokeEllipse(x, fy, ring * 2, ring * 0.8);
  if (reduced) return;
  const count = low ? 2 : 2 + phase;
  for (let i = 0; i < count; i++) {
    const a = t * 0.7 + (i / count) * Math.PI * 2;
    const px = x + Math.cos(a) * 125,
      py = y - 80 + Math.sin(a) * 30;
    fx.g.fillStyle(0xffe1a0, 0.85).fillRoundedRect(px - 4, py - 6, 8, 11, 2);
    fx.g.fillStyle(0xff8a3d, 0.9).fillRect(px - 2, py + 1, 4, 3);
  }
}

/** Ascendant Lumiwick's callouts, most urgent first ("" when none). */
export function ascendantLumiwickCue(
  state: Snapshot,
  myId: string,
  w: RaidWarning | undefined,
) {
  const r = state.raid;
  if (r?.boss !== "emberwing" || r.variant !== "ascendant") return "";
  const me = state.players.find((p) => p.id === myId);
  const braziers = r.braziers ?? [];
  const inRing = (i: number) =>
    !!me &&
    !!braziers[i] &&
    Math.hypot(me.x - braziers[i].x, me.y - braziers[i].y) <= R;
  const gale = r.warnings.find((x) => x.kind === "snuff-gale");
  if (gale && (!w || w.kind === "snuff-gale" || w.kind === "bound-wicks")) {
    if (gale.brazier !== undefined && inRing(gale.brazier))
      return "Snuffing Gale — hold the flame! Stay in the ring: it shelters you.";
    return gale.brazier !== undefined
      ? "Snuffing Gale — someone hold that flame! Or leave the lane."
      : "Snuffing Gale — leave the lane!";
  }
  const wick = r.warnings.find((x) => x.kind === "bound-wicks");
  if (wick && (!w || w.kind === "bound-wicks")) {
    const left = Math.max(0, wick.at - state.time);
    const mine = (wick.braziers ?? []).some(inRing);
    if (left < 1.2 && mine)
      return "The wick is snapping — step out of the Backdraft!";
    const n = (wick.braziers ?? []).length;
    return `Bound Wicks — ${n > 2 ? "all three" : "both"} rings at once! ${Math.ceil(left)}s`;
  }
  return "";
}
