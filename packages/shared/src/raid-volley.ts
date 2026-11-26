import { RULES, blocked, normalize, type Fighter } from "./index.js";
import { EMBERWING as E } from "./raid-emberwing.js";
import { ASCENDANT_LUMIWICK } from "./raid-ascendant.js";
import type { RaidWarning } from "./raid.js";

type Point = { x: number; y: number };

/**
 * A raid volley's reach, and Lumiwick's Wing Gust that rides it. The server
 * (RaidArena.inVolley, raid-emberwing.ts) and the phone's prediction
 * (predict-fighter.ts, stepRaidCarry) both use these, so a gust that blows
 * you on the server blows you on the phone in the same tick, rather than a
 * round trip later as a 140-220 px jump (26 Nov 2026,
 * network-performance.md section 22).
 */

/** Nothing solid on the straight line between two points (the walls set). */
export function segmentClear(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10);
  for (let i = 1; i < steps; i++)
    if (
      blocked(
        a.x + ((b.x - a.x) * i) / steps,
        a.y + ((b.y - a.y) * i) / steps,
        2,
      )
    )
      return false;
  return true;
}

/**
 * Is a raider inside a volley's cone (and not hiding behind a pillar)?
 * `clear` is the line test (the server's sets the room's walls first).
 */
export function inVolleyCone(
  w: {
    x: number;
    y: number;
    tx: number;
    ty: number;
    radius: number;
    spread?: number;
  },
  p: { x: number; y: number },
  clear: (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => boolean = segmentClear,
) {
  const dx = p.x - w.x,
    dy = p.y - w.y,
    dist = Math.hypot(dx, dy);
  if (dist > w.radius + RULES.radius) return false;
  const aim = Math.atan2(w.ty - w.y, w.tx - w.x);
  const off = Math.atan2(
    Math.sin(Math.atan2(dy, dx) - aim),
    Math.cos(Math.atan2(dy, dx) - aim),
  );
  if (
    Math.abs(off) >
    (w.spread ?? 0.45) + Math.atan2(RULES.radius, Math.max(dist, 1))
  )
    return false;
  return clear(w, p);
}

/**
 * How far Lumiwick's Wing Gust blows a raider in its cone as it lands:
 * along the gust, unless they are dashing into the wind (then nothing).
 * `input` is the tick's, `time` the tick's start.
 */
export function gustBlow(
  p: Fighter,
  w: { x: number; y: number; tx: number; ty: number },
  input: { dx: number; dy: number },
  time: number,
): { x: number; y: number } | undefined {
  const dir = normalize(w.tx - w.x, w.ty - w.y),
    resist = p.dashUntil > time && input.dx * dir.x + input.dy * dir.y < -0.25;
  if (resist) return;
  return { x: dir.x * E.gust.push, y: dir.y * E.gust.push };
}

// The ascendant Lumiwick's lanes and rings (raid-ascendant-lumiwick.ts).

/** Distance from `p` to the segment a-b. */
export function lumiSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}

/**
 * Is a raider standing at (x, y) sheltered from a Snuffing Gale (inside a
 * brazier's ring)? `pad` past the raider's own radius shrinks the ring
 * (the safe-spot rule's margin); at RULES.radius it is the landing's test.
 */
export function lumiSheltered(
  braziers: readonly Point[],
  x: number,
  y: number,
  pad: number = RULES.radius,
) {
  const ring = E.brazierRadius - Math.max(0, pad - RULES.radius);
  return braziers.some((b) => Math.hypot(x - b.x, y - b.y) <= ring);
}

/**
 * Would a raider standing at (x, y) be inside this warning's hit (`pad`:
 * the raider's radius plus any margin)? The same tests the landing uses:
 * a dive's or gale's lane (a brazier's ring shelters from the gale), a
 * circle, a Backdraft round each bound brazier.
 */
export function lumiShapeHits(
  w: RaidWarning,
  x: number,
  y: number,
  braziers: readonly Point[],
  pad: number = RULES.radius,
) {
  if (w.kind === "dive-bomb")
    return lumiSegment({ x, y }, w, { x: w.tx, y: w.ty }) < w.radius + pad;
  if (w.kind === "snuff-gale")
    return (
      lumiSegment({ x, y }, w, { x: w.tx, y: w.ty }) < w.radius + pad &&
      !lumiSheltered(braziers, x, y, pad)
    );
  if (w.kind === "bound-wicks")
    return (w.braziers ?? []).some((i) => {
      const b = braziers[i];
      return !!b && Math.hypot(x - b.x, y - b.y) < w.radius + pad;
    });
  if (w.kind === "ember-rain" || w.kind === "scorched-earth")
    return Math.hypot(x - w.x, y - w.y) < w.radius + pad;
  return false;
}

/** How far the ascendant Lumiwick's Snuffing Gale blows a raider in its lane. */
export function galeBlow(w: { x: number; y: number; tx: number; ty: number }) {
  const d = normalize(w.tx - w.x, w.ty - w.y);
  return {
    x: d.x * ASCENDANT_LUMIWICK.gale.push,
    y: d.y * ASCENDANT_LUMIWICK.gale.push,
  };
}
