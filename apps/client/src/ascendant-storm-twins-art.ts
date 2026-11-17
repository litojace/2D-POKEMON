/**
 * Ascendant Storm Twins' new attacks on the Conductor Ring
 * (raid-storm-twins-art.ts and boss-spell-art.ts call these):
 *
 * - Mirror Charge: each twin's charge in a big badge over it (gold + on
 *   Fizz, cyan − on Crackle) with the discharge it still needs as pips and
 *   the countdown round the badge; every raider's sign in a medallion over
 *   them (alone: the sign it flips to beside it, with the time to the
 *   flip), and a dashed tether from each raider to the twin its hits
 *   discharge (mine bright). A twin left charged overloads: its exact ring
 *   in red, filling as it lands.
 * - Short Circuit: the overcharged beam at its exact width, a solid violet
 *   bar with white edges and cross-bars (nothing like the thin pink Link
 *   Beam, which is jumped): stand on it. The share count sits at its
 *   middle, a pip per raider up, gold for each one standing on it.
 *
 * Like every raid warning, edges are the server's exact shapes and only
 * fills pulse. The effects (sparks off the charged twins and the beam, the
 * discharge's arcs) go through the effects engine; the glows that say
 * where to stand or not to stand are inside fx.essential, so Low's glow
 * budget never shrinks them.
 */
import type Phaser from "phaser";
import { RULES, type Snapshot } from "@arena/shared";
import {
  ASCENDANT_STORM_TWINS as A,
  STORM_TWINS as S,
  type RaidWarning,
  type StormMirror,
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
  PLUS = 0xffd36e,
  MINUS = 0x8edfff,
  CHECK = 0x8de8cf,
  VIOLET = 0xb88cff,
  WHITE = 0xf4ecff,
  PIP = 0xffd65b,
  PIP_OFF = 0x3a3020,
  NIGHT = 0x060a16;
const TAU = Math.PI * 2;
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
/** Where a twin's charge badge sits over it, and a raider's sign medallion. */
export const TWIN_BADGE = { y: -122, r: 25 };
export const RAIDER_SIGN = { y: -100, r: 17 };

/** A raider's sign right now (alone, it flips at flipAt). */
export function mirrorSign(m: StormMirror, id: string, now: number) {
  const s = m.signs.find((x) => x.playerId === id)?.sign;
  if (s === undefined) return undefined;
  return m.flipAt !== undefined && now >= m.flipAt ? (-s as 1 | -1) : s;
}
/** The twin `myId`'s hits discharge in a Mirror Charge (still charged), if any. */
export function mirrorTwinFor(state: Snapshot, myId: string) {
  const r = state.raid;
  const m = r?.stormMirror;
  if (!m) return undefined;
  const sign = mirrorSign(m, myId, state.time);
  if (sign === undefined) return undefined;
  const t = m.twins.find((x) => x.sign !== sign && x.hits < x.need);
  return t && state.players.find((p) => p.id === t.id && p.hp > 0);
}
/** Is a raider at `p` standing on this Short Circuit (the server's test)? */
export const onShortCircuit = (w: RaidWarning, p: Point) =>
  segment(p, w, { x: w.tx, y: w.ty }) <= w.radius + RULES.radius;

/** A + or − stroke. */
function signMark(
  g: G,
  x: number,
  y: number,
  plus: boolean,
  color: number,
  s: number,
) {
  for (const [w, c, a] of [
    [7 * s, NIGHT, 0.8],
    [4 * s, color, 1],
  ] as const) {
    g.lineStyle(w, c, a).lineBetween(x - 9 * s, y, x + 9 * s, y);
    if (plus) g.lineBetween(x, y - 9 * s, x, y + 9 * s);
  }
}
/** A medallion: dark disc, coloured rim, its sign. */
function medallion(
  g: G,
  x: number,
  y: number,
  r: number,
  plus: boolean,
  color: number,
  alpha = 1,
) {
  g.fillStyle(NIGHT, 0.88 * alpha).fillCircle(x, y, r);
  g.lineStyle(3, color, alpha).strokeCircle(x, y, r);
  signMark(g, x, y, plus, color, r / 17);
}
/** A countdown arc just outside a circle. */
function arc(g: G, x: number, y: number, r: number, k: number, c: number) {
  if (k <= 0) return;
  g.lineStyle(6.5, NIGHT, 0.55)
    .beginPath()
    .arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + k * TAU)
    .strokePath();
  g.lineStyle(4, c, 0.95)
    .beginPath()
    .arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + k * TAU)
    .strokePath();
}
/** A tick (a discharged twin). */
function tick(g: G, x: number, y: number, s: number) {
  for (const [w, c] of [
    [7 * s, NIGHT],
    [4 * s, CHECK],
  ] as const)
    g.lineStyle(w, c, 1)
      .beginPath()
      .moveTo(x - 9 * s, y)
      .lineTo(x - 2 * s, y + 7 * s)
      .lineTo(x + 10 * s, y - 7 * s)
      .strokePath();
}
/** A row of pips centred at (x, y): `on` of `n` lit. */
function pips(g: G, x: number, y: number, n: number, on: number) {
  const gap = 13;
  for (let i = 0; i < n; i++) {
    const px = x + (i - (n - 1) / 2) * gap;
    g.fillStyle(NIGHT, 0.8).fillCircle(px, y, 6.5);
    g.fillStyle(i < on ? PIP : PIP_OFF, 1).fillCircle(px, y, 4.6);
  }
}
/** A dashed line. */
function dashedLine(g: G, a: Point, b: Point, dash = 12, gap = 9) {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1,
    ux = (b.x - a.x) / len,
    uy = (b.y - a.y) / len;
  for (let s = 0; s < len; s += dash + gap) {
    const e = Math.min(len, s + dash);
    g.lineBetween(a.x + ux * s, a.y + uy * s, a.x + ux * e, a.y + uy * e);
  }
}

/** The Mirror Charge's badges, signs and tethers (drawn with its countdown). */
function drawMirror(g: G, state: Snapshot, w: RaidWarning, reduced: boolean) {
  const r = state.raid!,
    m = r.stormMirror;
  if (!m) return;
  const t = state.time;
  const k = clamp((m.until - t) / Math.max(0.01, m.until - m.startedAt));
  const pulse = reduced ? 1 : 0.85 + Math.sin(t * 8) * 0.15;
  const twin = (id: string) =>
    state.players.find((p) => p.id === id && p.raidBoss && p.hp > 0);
  // Tethers first (under the badges): each raider to the twin it discharges.
  for (const s of m.signs) {
    const p = state.players.find((q) => q.id === s.playerId && q.hp > 0);
    const sign = mirrorSign(m, s.playerId, t);
    const goal = m.twins.find((x) => x.sign !== sign && x.hits < x.need);
    const body = goal && twin(goal.id);
    if (!p || !body) continue;
    const color = sign! > 0 ? PLUS : MINUS;
    g.lineStyle(5, NIGHT, 0.35);
    dashedLine(g, p, body);
    g.lineStyle(2.5, color, 0.75 * pulse);
    dashedLine(g, p, body);
  }
  for (const c of m.twins) {
    const p = twin(c.id);
    if (!p) continue;
    const color = c.sign > 0 ? PLUS : MINUS,
      done = c.hits >= c.need;
    // The charged body: a dashed rim in its sign's colour.
    if (!done) {
      g.lineStyle(4, color, 0.9 * pulse);
      for (let i = 0; i < 16; i += 2) {
        const a0 = (i / 16) * TAU + (reduced ? 0 : t * 1.4),
          a1 = ((i + 1) / 16) * TAU + (reduced ? 0 : t * 1.4);
        g.beginPath()
          .arc(p.x, p.y + 6, S.radius + 12, a0, a1)
          .strokePath();
      }
    }
    const bx = p.x,
      by = p.y + TWIN_BADGE.y;
    medallion(g, bx, by, TWIN_BADGE.r, c.sign > 0, color, done ? 0.55 : 1);
    if (done) tick(g, bx + TWIN_BADGE.r * 0.9, by + TWIN_BADGE.r * 0.6, 0.9);
    else arc(g, bx, by, TWIN_BADGE.r + 6, k, color);
    if (c.need > 0)
      pips(g, bx, by + TWIN_BADGE.r + 15, Math.min(8, c.need), c.hits);
  }
  for (const s of m.signs) {
    const p = state.players.find((q) => q.id === s.playerId && q.hp > 0);
    if (!p) continue;
    const sign = mirrorSign(m, s.playerId, t)!;
    const color = sign > 0 ? PLUS : MINUS;
    const y = p.y + RAIDER_SIGN.y;
    medallion(g, p.x, y, RAIDER_SIGN.r, sign > 0, color);
    // Alone: the sign it flips to, and the time to the flip.
    if (m.flipAt !== undefined && t < m.flipAt) {
      const next = -sign as 1 | -1,
        nx = p.x + RAIDER_SIGN.r * 2 + 6;
      medallion(
        g,
        nx,
        y,
        RAIDER_SIGN.r * 0.7,
        next > 0,
        next > 0 ? PLUS : MINUS,
        0.85,
      );
      const left = clamp(
        (m.flipAt - t) / Math.max(0.01, m.flipAt - m.startedAt),
      );
      arc(g, nx, y, RAIDER_SIGN.r * 0.7 + 5, left, WHITE);
    }
  }
  void w;
}

/** Ascendant Storm Twins' warnings. Returns false for kinds it doesn't draw. */
export function drawAscendantStormTwinsWarning(
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
  if (w.kind === "mirror-charge" && !w.overload) {
    drawMirror(g, state, w, reduced);
    return true;
  }
  if (w.kind === "mirror-charge") {
    // An overload ring: its exact edge, the fill growing as it lands.
    g.fillStyle(DANGER, (0.16 + 0.24 * k) * pulse).fillCircle(
      w.x,
      w.y,
      w.radius,
    );
    g.lineStyle(9, NIGHT, 0.6).strokeCircle(w.x, w.y, w.radius);
    g.lineStyle(4.5, EDGE, 1).strokeCircle(w.x, w.y, w.radius);
    // a crackling crown just inside the edge
    const n = 14;
    g.lineStyle(3, WHITE, 0.85);
    const pts = Array.from({ length: n * 2 + 1 }, (_, i) => {
      const a = (i / (n * 2)) * TAU + (reduced ? 0 : t * 0.6),
        rr = w.radius - (i % 2 ? 16 : 6);
      return { x: w.x + Math.cos(a) * rr, y: w.y + Math.sin(a) * rr };
    });
    g.strokePoints(pts, false);
    arc(g, w.x, w.y, w.radius + 8, k, EDGE);
    return true;
  }
  if (w.kind === "short-circuit") {
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
    // A solid bar at its exact width: stand on it (never jumped).
    g.fillStyle(VIOLET, (0.3 + 0.25 * k) * pulse).fillPoints(quad, true);
    g.lineStyle(10, NIGHT, 0.6)
      .lineBetween(quad[0].x, quad[0].y, quad[1].x, quad[1].y)
      .lineBetween(quad[3].x, quad[3].y, quad[2].x, quad[2].y);
    g.lineStyle(5, WHITE, 1)
      .lineBetween(quad[0].x, quad[0].y, quad[1].x, quad[1].y)
      .lineBetween(quad[3].x, quad[3].y, quad[2].x, quad[2].y);
    // Cross-bars along it, running toward its middle as it charges.
    const flow = reduced ? 0 : (t * 60) % 46;
    g.lineStyle(3, WHITE, 0.55);
    for (let s = S.radius + 10 + flow; s < len - S.radius - 10; s += 46) {
      const cx = w.x + ux * s,
        cy = w.y + uy * s;
      g.lineBetween(cx + nx * 0.8, cy + ny * 0.8, cx - nx * 0.8, cy - ny * 0.8);
    }
    // Its core: a jagged white bolt.
    const core = Array.from({ length: 13 }, (_, i) => {
      const s = (len * i) / 12,
        off = i % 2 ? (i % 4 === 1 ? 7 : -7) : 0;
      return {
        x: w.x + ux * s - uy * off,
        y: w.y + uy * s + ux * off,
      };
    });
    g.lineStyle(7, NIGHT, 0.45).strokePoints(core, false);
    g.lineStyle(3, WHITE, 1).strokePoints(core, false);
    // The share count at its middle: a pip per raider up, gold if on it.
    const alive = state.players.filter(
      (p) => !p.raidBoss && !p.echo && p.hp > 0 && !p.out,
    );
    const on = alive.filter((p) => onShortCircuit(w, p)).length;
    const mx = (w.x + w.tx) / 2,
      my = (w.y + w.ty) / 2 - w.radius - 22;
    g.fillStyle(NIGHT, 0.75).fillRoundedRect(
      mx - alive.length * 6.5 - 8,
      my - 11,
      alive.length * 13 + 16,
      22,
      9,
    );
    pips(g, mx, my, alive.length, on);
    return true;
  }
  return false;
}

/**
 * Effects: glows that say where to stand or not (essential: the beam to
 * stand on, the overload rings, the twin my hits discharge), sparks off
 * the charged twins and the beam, and the discharge's arcs.
 */
export function drawAscendantStormTwinsFx(
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
    if (w.kind === "mirror-charge" && w.overload) {
      fx.essential(() =>
        glow(w.x, w.y, w.radius * 0.85, DANGER, 0.12 + 0.16 * k, true),
      );
      continue;
    }
    if (w.kind !== "short-circuit") continue;
    fx.essential(() => {
      for (const s of [0.3, 0.5, 0.7])
        glow(
          w.x + (w.tx - w.x) * s,
          w.y + (w.ty - w.y) * s,
          w.radius * 1.4,
          VIOLET,
          0.14 + 0.12 * k,
          true,
        );
    });
    fx.trail(`twins-short-${w.id}`, low ? 0.3 : 0.1, () => {
      const s = 0.15 + Math.random() * 0.7;
      fx.burst({
        x: w.x + (w.tx - w.x) * s,
        y: w.y + (w.ty - w.y) * s,
        z: 6,
        count: 1,
        kind: "spark",
        color: [WHITE, VIOLET],
        speed: [40, 90],
        up: [20, 50],
        life: [0.25, 0.45],
        size: [1.6, 2.6],
        drag: 1,
      });
    });
  }
  const m = r.stormMirror;
  if (m)
    for (const c of m.twins) {
      if (c.hits >= c.need) continue;
      const p = state.players.find((q) => q.id === c.id && q.hp > 0);
      if (!p) continue;
      fx.trail(`twins-charge-${c.id}`, low ? 0.4 : 0.16, () =>
        fx.burst({
          x: p.x + (Math.random() - 0.5) * 70,
          y: p.y,
          z: 40,
          count: 1,
          kind: "spark",
          color: [c.sign > 0 ? PLUS : MINUS, WHITE],
          speed: [20, 50],
          up: [40, 80],
          life: [0.3, 0.5],
          size: [1.5, 2.4],
          drag: 1,
        }),
      );
    }
  // The discharge: the beam flashes; nobody on it, arcs to every raider.
  const s = r.stormShort;
  if (s && s.until > state.time) {
    const k = clamp(1 - (s.until - state.time) / A.short.flash);
    fx.floor
      .lineStyle(A.short.width * 2 * (1 - k * 0.6), WHITE, 0.55 * (1 - k))
      .lineBetween(s.x, s.y, s.tx, s.ty);
    if (!s.sharers.length)
      for (const p of state.players) {
        if (p.raidBoss || p.hp <= 0 || p.echo) continue;
        const from = { x: (s.x + s.tx) / 2, y: (s.y + s.ty) / 2 };
        const pts = Array.from({ length: 7 }, (_, i) => ({
          x: from.x + ((p.x - from.x) * i) / 6 + (i % 2 ? 10 : -10) * (1 - k),
          y: from.y + ((p.y - from.y) * i) / 6 + (i % 2 ? -8 : 8),
        }));
        fx.g.lineStyle(3, WHITE, 0.8 * (1 - k)).strokePoints(pts, false);
      }
  }
  void casts;
}

/**
 * Ascendant Storm Twins' aura: a slow charge ring on the floor under each
 * twin, in its colour. No glows (it is always on).
 */
export function paintAscendantStormTwinsAura(
  fx: Fx,
  x: number,
  y: number,
  time: number,
  phase: number,
  blue: boolean,
  reduced: boolean,
) {
  const t = reduced ? 0 : time,
    deep = 0.45 + 0.15 * phase;
  const ring = 70 + ((t * 18 + (blue ? 20 : 0)) % 36);
  fx.floor
    .lineStyle(2.4, blue ? MINUS : PLUS, 0.45 * deep * (1 - (ring - 70) / 36))
    .strokeEllipse(x, y + 18, ring * 2, ring * 0.7);
}

/** Ascendant Storm Twins' callouts, most urgent first ("" when none). */
export function ascendantStormTwinsCue(
  state: Snapshot,
  myId: string,
  w: RaidWarning | undefined,
) {
  const r = state.raid;
  if (r?.boss !== "storm-twins" || r.variant !== "ascendant") return "";
  const me = state.players.find((p) => p.id === myId);
  const name = (id?: string) =>
    r.twins?.find((t) => t.id === id)?.name ?? "the twin";
  const ring = r.warnings.find(
    (x) =>
      x.kind === "mirror-charge" &&
      x.overload &&
      !!me &&
      Math.hypot(me.x - x.x, me.y - x.y) < x.radius + RULES.radius + 20,
  );
  if (ring) return `Overload — get out of ${name(ring.casterId)}'s ring!`;
  const short = r.warnings.find((x) => x.kind === "short-circuit");
  if (short) {
    const alive = state.players.filter(
      (p) => !p.raidBoss && !p.echo && p.hp > 0 && !p.out,
    );
    const on = alive.filter((p) => onShortCircuit(short, p)).length;
    const left = Math.max(0, Math.ceil(short.at - state.time));
    return me && onShortCircuit(short, me)
      ? `Short Circuit — hold on the beam! ${on}/${alive.length} sharing · ${left}s`
      : `Short Circuit — stand on the thick beam together! ${on}/${alive.length} on it · ${left}s`;
  }
  const m = r.stormMirror;
  if (m && (!w || w.kind === "mirror-charge")) {
    const sign = mirrorSign(m, myId, state.time);
    const left = Math.max(0, Math.ceil(m.until - state.time));
    const goal = mirrorTwinFor(state, myId);
    const mine = sign === undefined ? "" : sign > 0 ? "+" : "−";
    const flip =
      m.flipAt !== undefined && state.time < m.flipAt
        ? ` · flips in ${Math.ceil(m.flipAt - state.time)}s`
        : "";
    if (!goal)
      return `Mirror Charge — your twin is discharged. Keep clear · ${left}s`;
    const c = m.twins.find((x) => x.id === goal.id)!;
    return `Mirror Charge — you are ${mine}: hit ${goal.name} (${c.sign > 0 ? "+" : "−"}) ${c.hits}/${c.need} · ${left}s${flip}`;
  }
  return "";
}
