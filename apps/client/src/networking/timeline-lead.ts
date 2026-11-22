import {
  RULES,
  type Projectile,
  type Rect,
} from "../../../../packages/shared/src/index";
import { projectileContact } from "../../../../packages/shared/src/projectile-collision";

/**
 * Your own fighter is drawn where the server will have it once it has run
 * every input you sent and it has not yet answered: `pending` inputs, one
 * server tick each, past the last snapshot. Shots, wind-ups and zone timers
 * came from that snapshot, so they were drawn in the past: a shot about one
 * round trip plus the snapshot's age behind where it really was against you
 * (900 px/s × 0.13 s ≈ 120 px on good Wi-Fi). You stepped out of a shot you
 * saw, and the server, where the shot was further along, hit you.
 *
 * `LocalTimeline` says how far past the last snapshot your fighter is drawn,
 * so shots and timers can be drawn on that same timeline: what you see
 * dodge is what the server checks. It moves smoothly between snapshots (no
 * 15 Hz steps) and eases, rather than jumps, when a snapshot changes it.
 */
export const LEAD = {
  /** Never draw further ahead than this (s): beyond it a stall, not latency. */
  max: 0.3,
  /** Seconds to settle onto a new snapshot's estimate. */
  settle: 0.1,
  /** An opponent's new shot grows into its lead over this long (s). */
  easeIn: 0.2,
};

export class LocalTimeline {
  private base = 0;
  private receivedAt = -Infinity;
  private shown = 0;
  private lastNow = -Infinity;
  /** A snapshot arrived with `pending` of your inputs still unanswered. */
  snapshot(pending: number, receivedAt: number) {
    this.base = Math.max(0, pending) / RULES.tick;
    this.receivedAt = receivedAt;
  }
  /** Seconds since the last snapshot arrived (its own, unled, clock). */
  age(now: number) {
    if (!Number.isFinite(this.receivedAt)) return 0;
    return Math.min(LEAD.max, Math.max(0, (now - this.receivedAt) / 1000));
  }
  /**
   * The lead as the newest snapshot says it is, not eased: its unanswered
   * inputs plus its age. `lead` is smoothed for drawing, so the moment a
   * snapshot lands it still carries the previous one's age (up to one
   * snapshot interval, 67 ms, too far). Measuring against a past frame
   * (a hit on you, battle-perf hitsFar) needs this one.
   */
  estimate(now: number) {
    if (!Number.isFinite(this.receivedAt)) return 0;
    return Math.min(
      LEAD.max,
      this.base + Math.max(0, (now - this.receivedAt) / 1000),
    );
  }
  /** Seconds past the last snapshot's time at which your fighter is drawn. */
  lead(now: number) {
    if (!Number.isFinite(this.receivedAt)) return 0;
    const target = this.estimate(now);
    if (!Number.isFinite(this.lastNow) || now < this.lastNow)
      this.shown = target;
    else {
      const dt = (now - this.lastNow) / 1000;
      // Time runs on, and the estimate eases onto the newest snapshot's.
      this.shown = Math.min(LEAD.max, this.shown + dt);
      this.shown += (target - this.shown) * (1 - Math.exp(-dt / LEAD.settle));
    }
    this.lastNow = now;
    return this.shown;
  }
  clear() {
    this.base = 0;
    this.receivedAt = -Infinity;
    this.shown = 0;
    this.lastNow = -Infinity;
  }
}

/** A fighter a shot can strike, where it is drawn, with its hit radius. */
export interface ShotTarget {
  x: number;
  y: number;
  r: number;
}

/**
 * How far along the segment from `from` to `to` (0..1) a shot of radius
 * `radius` first touches a target, as the server's hit test has it
 * (centres closer than the target's hit radius plus the shot's), or
 * undefined when it touches none.
 */
export function shotTargetContact(
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
  targets: readonly ShotTarget[],
) {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const a = dx * dx + dy * dy;
  let first: number | undefined;
  for (const t of targets) {
    const reach = t.r + radius;
    const fx = from.x - t.x,
      fy = from.y - t.y;
    const c = fx * fx + fy * fy - reach * reach;
    // Already touching it: the server strikes on the next step.
    if (c <= 0) return 0;
    if (!a) continue;
    const b = 2 * (fx * dx + fy * dy);
    const disc = b * b - 4 * a * c;
    if (disc < 0) continue;
    const hit = (-b - Math.sqrt(disc)) / (2 * a);
    if (hit >= 0 && hit <= 1 && (first === undefined || hit < first))
      first = hit;
  }
  return first;
}

/**
 * Where a shot is `seconds` after its snapshot, as the server moves it: in
 * a straight line, stopped by cover and the court's edge, never past its
 * range. `slow` is a time bubble's factor where it is (1 outside). A
 * boomerang turns back, so it is drawn where the snapshot had it.
 *
 * `targets` are the fighters (and decoys) the shot can strike, where they
 * are drawn. The server stops a shot on the first one it touches, so the
 * drawn shot stops there too and waits on it for the snapshot with the
 * impact. Without this a shot you fired, drawn ahead of the server, flew
 * on through its target and the blast then went off behind it (player
 * report, 22 Nov 2026). Shots that fly through fighters (Ball Lightning's
 * `aura`) ignore them.
 */
export function leadProjectile(
  pr: Projectile,
  seconds: number,
  walls: readonly Rect[],
  slow = 1,
  targets: readonly ShotTarget[] = [],
): Projectile {
  if (!(seconds > 0) || pr.ability.boomerang) return pr;
  const speed = Math.hypot(pr.vx, pr.vy);
  if (!speed) return pr;
  const reach = Math.min(speed * seconds * slow, Math.max(0, pr.remaining));
  if (reach <= 0) return pr;
  const to = {
    x: pr.x + (pr.vx / speed) * reach,
    y: pr.y + (pr.vy / speed) * reach,
  };
  let at = projectileContact(pr, to, pr.ability.radius, walls) ?? to;
  if (targets.length && !pr.ability.aura) {
    const hit = shotTargetContact(pr, at, pr.ability.radius, targets);
    if (hit !== undefined)
      at = { x: pr.x + (at.x - pr.x) * hit, y: pr.y + (at.y - pr.y) * hit };
  }
  return {
    ...pr,
    x: at.x,
    y: at.y,
    remaining: pr.remaining - Math.hypot(at.x - pr.x, at.y - pr.y),
  };
}

/**
 * Shots on your timeline. Yours appear on it at once (your cast already
 * played on the press); an opponent's grows into it over `LEAD.easeIn`,
 * so it leaves its caster's hand instead of popping up ahead of it.
 */
export class ShotTimeline {
  private seen = new Map<number, number>();
  /** Seconds past the snapshot to draw this shot at. */
  seconds(
    pr: Projectile,
    mine: boolean,
    now: number,
    lead: number,
    age: number,
  ) {
    let first = this.seen.get(pr.id);
    if (first === undefined) this.seen.set(pr.id, (first = now));
    const ramp = mine ? 1 : Math.min(1, (now - first) / 1000 / LEAD.easeIn);
    return age + (lead - age) * ramp;
  }
  /** Forget shots that are gone. */
  keep(ids: Iterable<number>) {
    const live = new Set(ids);
    for (const id of this.seen.keys()) if (!live.has(id)) this.seen.delete(id);
  }
  clear() {
    this.seen.clear();
  }
}
