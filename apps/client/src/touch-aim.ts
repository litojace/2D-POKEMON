/**
 * Drag-to-aim on phones (owner, 26 Nov 2026): a quick tap on a skill still
 * aims at the nearest (or locked) enemy; holding a skill shows where it
 * goes, and dragging the finger picks the direction or the spot, as in
 * Brawl Stars or a mobile MOBA. What a drag means depends on how the server
 * reads the aim for that skill's kind (apps/server/src/simulation.ts cast):
 *
 * - "self": it never reads the aim (a nova, a buff, a shield): fires on the
 *   press, as before.
 * - "line": only the direction (projectiles, beams, rushes, strikes in
 *   front): the guide is an arrow (or a wedge) of the skill's range.
 * - "point": a spot up to `range` away (zones, leaps, blinks): the drag's
 *   length picks how far.
 * - "target": the enemy nearest the aim (storms, wires, swaps): the drag
 *   picks that enemy, and the aim stays on it while the skill reads it.
 */
import type { Ability } from "@arena/shared";

export type AimKind = "self" | "line" | "point" | "target";
export interface AimSpec {
  kind: AimKind;
  /**
   * Court units: the arrow's length (line), the farthest spot (point), the
   * reach to pick an enemy in (target; 0 for anywhere on the court).
   */
  range: number;
  /** Court units: the circle drawn at the spot (point, target). */
  radius: number;
  /** Half-angle (radians) of a strike or fan in front (line), else 0. */
  arc: number;
  /** Court units: the arrow's width (line). */
  width: number;
  /** Court units: a bar across the arrow's end (a curtain, a wall of water). */
  across: number;
  /**
   * Seconds the dragged aim is kept after the finger lifts: a cast reads the
   * aim when it happens, which can be after a buffered tap's wait, a
   * wind-up, or (a storm) each wave of bolts.
   */
  hold: number;
}

/** The server keeps a skill tap this long while a basic attack recovers. */
export const SKILL_INPUT_BUFFER = 0.18;
/** Slack for the trip to the server and its tick. */
const HOLD_SLACK = 0.15;
/** A target pick reaches this far when the skill has no range (court units). */
export const ANYWHERE = 900;

const SELF = new Set<string>([
  "nova",
  "clone",
  "barrier",
  "buff",
  "rest",
  "veil",
  "tunnel",
  "cyclone",
  "taunt",
  "rewind",
  "gaze",
  "cage",
  "trail",
]);
const POINT = new Set<string>([
  "zone",
  "seedling",
  "timewarp",
  "lure",
  "garden",
  "steer",
  "blink",
  "leap",
]);
const TARGET = new Set<string>(["storm", "hunt", "tether", "swap"]);
/** Strikes in front of the caster, within `range` and `arc`. */
const FRONT = new Set<string>(["melee", "cone", "clamp", "throw", "pound"]);

type AimFields = Pick<Ability, "kind" | "range" | "radius" | "cast"> &
  Partial<
    Pick<
      Ability,
      | "follow"
      | "lunge"
      | "arc"
      | "count"
      | "fan"
      | "tickInterval"
      | "duration"
      | "explosion"
      | "screen"
    >
  >;

const SELF_SPEC: AimSpec = {
  kind: "self",
  range: 0,
  radius: 0,
  arc: 0,
  width: 0,
  across: 0,
  hold: 0,
};

export function aimSpec(a: AimFields | undefined): AimSpec {
  if (!a) return SELF_SPEC;
  const hold = SKILL_INPUT_BUFFER + (a.cast ?? 0) + HOLD_SLACK;
  const base = { ...SELF_SPEC, hold };
  // Facet Guard vaults toward the aim behind its guard; other counters stand.
  if (a.kind === "counter")
    return a.lunge
      ? { ...base, kind: "point", range: a.lunge, radius: 34 }
      : SELF_SPEC;
  // A zone that follows the caster is placed on it.
  if (a.kind === "zone" && a.follow) return SELF_SPEC;
  if (SELF.has(a.kind)) return SELF_SPEC;
  if (TARGET.has(a.kind))
    return {
      ...base,
      kind: "target",
      // A storm and a hunt find their enemy anywhere; a wire and a swap
      // only within reach.
      range: a.kind === "storm" || a.kind === "hunt" ? 0 : a.range,
      radius: a.kind === "storm" ? (a.explosion ?? 60) : 60,
      // A storm picks the enemy nearest the aim again for each wave, a hunt
      // as it flies.
      hold:
        hold +
        (a.kind === "storm"
          ? Math.max(0, (a.count ?? 3) - 1) * (a.tickInterval ?? 0.8)
          : a.kind === "hunt"
            ? Math.min(3, a.duration ?? 0)
            : 0),
    };
  if (POINT.has(a.kind))
    return {
      ...base,
      kind: "point",
      range: a.range,
      radius:
        a.kind === "blink"
          ? 34
          : a.kind === "leap"
            ? (a.explosion ?? a.radius)
            : a.radius,
    };
  if (FRONT.has(a.kind))
    return {
      ...base,
      kind: "line",
      range: a.range,
      arc: Math.acos(Math.max(-1, Math.min(1, a.arc ?? 0.35))),
    };
  // Everything else flies or runs along the aim: projectiles, beams,
  // rushes, grapples, waves, creeping barrages, curtains.
  const fan =
    a.kind === "shrapnel"
      ? (a.fan ?? 1.5) / 2
      : a.kind === "barrage"
        ? (((a.count ?? 5) - 1) / 2) * 0.11
        : 0;
  return {
    ...base,
    kind: "line",
    range: a.kind === "screen" ? (a.screen?.distance ?? 90) : a.range,
    arc: fan,
    width: Math.max(18, 2 * (a.radius ?? 9)),
    across:
      a.kind === "screen"
        ? (a.screen?.length ?? 200)
        : a.kind === "wave"
          ? 2 * a.radius
          : 0,
  };
}

/**
 * Where a drag aims: `dir` (a unit vector in court units) from `from`, and
 * `t` (0–1) how far the finger went in the drag's circle.
 */
export function aimPoint(
  spec: AimSpec,
  from: { x: number; y: number },
  dir: { x: number; y: number },
  t: number,
) {
  const k = Math.max(0, Math.min(1, t));
  const reach =
    spec.kind === "line"
      ? Math.max(spec.range, 120)
      : spec.kind === "point"
        ? spec.range * k
        : spec.kind === "target"
          ? (spec.range || ANYWHERE) * k
          : 0;
  return { x: from.x + dir.x * reach, y: from.y + dir.y * reach };
}

/**
 * A drag on the screen (`dx`, `dy` CSS px) as a court direction: the camera
 * may scale the court's two axes differently.
 */
export function courtDirection(dx: number, dy: number, zoomX = 1, zoomY = 1) {
  const x = dx / Math.max(1e-6, zoomX),
    y = dy / Math.max(1e-6, zoomY),
    d = Math.hypot(x, y);
  return d > 1e-6 ? { x: x / d, y: y / d } : { x: 1, y: 0 };
}

/** Minimal drawing surface (a Phaser Graphics) for the aim guide. */
interface Pen {
  lineStyle(width: number, color: number, alpha?: number): Pen;
  fillStyle(color: number, alpha?: number): Pen;
  beginPath(): Pen;
  moveTo(x: number, y: number): Pen;
  lineTo(x: number, y: number): Pen;
  closePath(): Pen;
  strokePath(): Pen;
  fillPath(): Pen;
  fillCircle(x: number, y: number, radius: number): Pen;
  strokeCircle(x: number, y: number, radius: number): Pen;
}
const GOLD = 0xffe28c,
  RED = 0xff5d6c,
  EDGE = 0x1a1206;

/** A dashed circle (the skill's reach round the caster). */
function dashedCircle(g: Pen, x: number, y: number, r: number) {
  const n = Math.max(24, Math.min(72, Math.round(r / 14)));
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * Math.PI * 2,
      a1 = ((i + 1) / n) * Math.PI * 2;
    g.beginPath()
      .moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r)
      .lineTo(x + Math.cos(a1) * r, y + Math.sin(a1) * r)
      .strokePath();
  }
}

/**
 * The guide on the court while a skill is held: an arrow, a wedge, a spot
 * or a ring round the enemy it will pick, gold while it will fire and red
 * over the cancel spot. `firm` false: the finger has not dragged yet (the
 * auto aim, fainter). Plain lines and fills, the same cost on every
 * graphics level. Court units; `pxPerUnit` keeps the lines readable on a
 * phone, where the court is drawn at about half size.
 */
export function drawAimGuide(
  g: Pen,
  spec: AimSpec,
  from: { x: number; y: number },
  at: { x: number; y: number },
  options: {
    firm: boolean;
    cancel: boolean;
    pxPerUnit?: number;
    /** The enemy a target skill will pick (its feet). */
    picked?: { x: number; y: number };
  },
) {
  if (spec.kind === "self") return;
  const color = options.cancel ? RED : GOLD;
  const strength = options.firm ? 1 : 0.55;
  const unit = 1 / Math.max(0.1, options.pxPerUnit ?? 1);
  // As the lock reticle: at least 3 px of colour in a dark edge, so it
  // reads on sand, ice or a closing ring's red.
  const line = Math.max(3, 3 * unit),
    edge = line + Math.max(3, 4 * unit);
  /** Fill, then outline in the dark edge and the colour, the path `trace` draws. */
  const shape = (trace: () => void, fill: number, closed = true) => {
    if (fill > 0) {
      g.fillStyle(color, fill * strength).beginPath();
      trace();
      g.closePath().fillPath();
    }
    for (const [width, tint, alpha] of [
      [edge, EDGE, 0.45],
      [line, color, 0.95],
    ] as const) {
      g.lineStyle(width, tint, alpha * strength).beginPath();
      trace();
      if (closed) g.closePath();
      g.strokePath();
    }
  };
  const circle = (x: number, y: number, r: number, fill: number) => {
    g.fillStyle(color, fill * strength).fillCircle(x, y, r);
    g.lineStyle(edge, EDGE, 0.45 * strength).strokeCircle(x, y, r);
    g.lineStyle(line, color, 0.95 * strength).strokeCircle(x, y, r);
  };
  const angle = Math.atan2(at.y - from.y, at.x - from.x);
  const ux = Math.cos(angle),
    uy = Math.sin(angle);
  if (spec.kind === "line") {
    const len = Math.max(spec.range, 60);
    if (spec.arc > 0.02) {
      // A wedge: a strike or a fan of shots.
      const steps = 16;
      shape(() => {
        g.moveTo(from.x, from.y);
        for (let i = 0; i <= steps; i++) {
          const a = angle - spec.arc + (2 * spec.arc * i) / steps;
          g.lineTo(from.x + Math.cos(a) * len, from.y + Math.sin(a) * len);
        }
      }, 0.22);
      return;
    }
    // An arrow from just in front of the caster to the end of its range.
    const w = Math.max(spec.width, 10 * unit) / 2,
      head = Math.max(w * 1.8, 18 * unit),
      start = 28,
      body = Math.max(start, len - head);
    const px = -uy,
      py = ux;
    const p = (along: number, side: number) => ({
      x: from.x + ux * along + px * side,
      y: from.y + uy * along + py * side,
    });
    const corners = [
      p(start, -w),
      p(body, -w),
      p(body, -head * 0.75),
      p(len, 0),
      p(body, head * 0.75),
      p(body, w),
      p(start, w),
    ];
    shape(() => {
      g.moveTo(corners[0].x, corners[0].y);
      for (const c of corners.slice(1)) g.lineTo(c.x, c.y);
    }, 0.3);
    if (spec.across > 0) {
      const a = p(len, -spec.across / 2),
        b = p(len, spec.across / 2);
      shape(() => g.moveTo(a.x, a.y).lineTo(b.x, b.y), 0, false);
    }
    return;
  }
  // A spot, or the enemy a target skill picks.
  g.lineStyle(line, color, 0.45 * strength);
  if (spec.range > 0) dashedCircle(g, from.x, from.y, spec.range);
  shape(
    () => g.moveTo(from.x + ux * 24, from.y + uy * 24).lineTo(at.x, at.y),
    0,
    false,
  );
  const ring = options.picked ?? at;
  circle(ring.x, ring.y, Math.max(spec.radius, 24), 0.28);
  if (options.picked && options.firm)
    g.fillStyle(color, 0.95 * strength).fillCircle(at.x, at.y, 7 * unit);
}

/**
 * The candidate a target skill picks: the one nearest `point`, within
 * `range` of `from` (0: anywhere), as the server picks it.
 */
export function pickNear<T extends { x: number; y: number }>(
  candidates: readonly T[],
  point: { x: number; y: number },
  from: { x: number; y: number },
  range: number,
): T | undefined {
  let best: T | undefined,
    bestDistance = Infinity;
  for (const c of candidates) {
    if (range > 0 && Math.hypot(c.x - from.x, c.y - from.y) > range) continue;
    const d = Math.hypot(c.x - point.x, c.y - point.y);
    if (d < bestDistance) {
      best = c;
      bestDistance = d;
    }
  }
  return best;
}
