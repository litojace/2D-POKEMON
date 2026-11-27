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
  /**
   * Drawn where the server last had it (standing still, or a decoy): a shot
   * that reaches it is one the server hits too, so its blast can play
   * without waiting for the server (ImpactPrediction).
   */
  steady?: boolean;
}

/**
 * Where along the segment from `from` to `to` (0..1) a shot of radius
 * `radius` first touches a target, as the server's hit test has it
 * (centres closer than the target's hit radius plus the shot's), and which
 * target; undefined when it touches none.
 */
export function shotTargetContact(
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
  targets: readonly ShotTarget[],
): { along: number; target: ShotTarget } | undefined {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const a = dx * dx + dy * dy;
  let first: { along: number; target: ShotTarget } | undefined;
  for (const t of targets) {
    const reach = t.r + radius;
    const fx = from.x - t.x,
      fy = from.y - t.y;
    const c = fx * fx + fy * fy - reach * reach;
    // Already touching it: the server strikes on the next step.
    if (c <= 0) return { along: 0, target: t };
    if (!a) continue;
    const b = 2 * (fx * dx + fy * dy);
    const disc = b * b - 4 * a * c;
    if (disc < 0) continue;
    const along = (-b - Math.sqrt(disc)) / (2 * a);
    if (along >= 0 && along <= 1 && (!first || along < first.along))
      first = { along, target: t };
  }
  return first;
}

/**
 * Your own shot's blast, played the moment the drawn shot reaches a fighter
 * standing still, instead of a round trip later when the server's impact
 * arrives (the shot used to wait on its target for it). The server's impact
 * for that shot then plays nothing: it is the same blast.
 *
 * Only a target drawn where the server has it counts (`ShotTarget.steady`):
 * one that is moving is drawn in the past, so the server may see the shot
 * miss, and a blast that never happened would mislead. Those still wait.
 */
export class ImpactPrediction {
  /** Blasts played early, by shot id, until the server's impact matches. */
  private shown = new Map<
    number,
    { abilityId: string; x: number; y: number; at: number }
  >();
  /** How long a shot stays hidden after its blast, waiting for the server (ms). */
  static hold = 450;
  /** How long a played blast waits for the server's impact to match (ms). */
  static window = 1200;
  /** How far the server's impact may land from the predicted one (px). */
  static reach = 48;

  /** True the first time this shot reaches a steady target: play its blast. */
  predict(id: number, abilityId: string, x: number, y: number, now: number) {
    this.expire(now);
    if (this.shown.has(id)) return false;
    this.shown.set(id, { abilityId, x, y, at: now });
    return true;
  }
  /** Whether a shot whose blast already played is kept off the court. */
  hidden(id: number, now: number) {
    const p = this.shown.get(id);
    return !!p && now - p.at < ImpactPrediction.hold;
  }
  /**
   * A server impact of yours: true when it is a blast already played (the
   * caller skips it). Each prediction matches once.
   */
  confirm(abilityId: string | undefined, x: number, y: number, now: number) {
    this.expire(now);
    for (const [id, p] of this.shown)
      if (
        p.abilityId === abilityId &&
        Math.hypot(p.x - x, p.y - y) <= ImpactPrediction.reach
      ) {
        this.shown.delete(id);
        return true;
      }
    return false;
  }
  clear() {
    this.shown.clear();
  }
  private expire(now: number) {
    for (const [id, p] of this.shown)
      if (now - p.at > ImpactPrediction.window) this.shown.delete(id);
  }
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
): Projectile & { struck?: ShotTarget } {
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
  let struck: ShotTarget | undefined;
  if (targets.length && !pr.ability.aura) {
    const hit = shotTargetContact(pr, at, pr.ability.radius, targets);
    if (hit) {
      const k = hit.along;
      at = { x: pr.x + (at.x - pr.x) * k, y: pr.y + (at.y - pr.y) * k };
      struck = hit.target;
    }
  }
  return {
    ...pr,
    x: at.x,
    y: at.y,
    remaining: pr.remaining - Math.hypot(at.x - pr.x, at.y - pr.y),
    struck,
  };
}

/**
 * The clock a zone's timer and strike are drawn on, in server seconds.
 *
 * A zone that can strike you (an opponent's) counts down on your timeline,
 * `lead` past its snapshot, so its ring shows the time you really have to
 * get out (the server judges you where your inputs will have put you).
 *
 * Any other zone (yours, an ally's, or every zone for a watcher) counts
 * down on the snapshot's own clock, `age` past it: there is nothing for you
 * to dodge, and the hits it deals reach you on that clock. On your timeline
 * its blast went off about a round trip before the damage it dealt showed
 * up (a ring ran out, then the target was hurt: player report, 23 Nov
 * 2026). Now the blast and the damage land together, within one snapshot
 * interval.
 */
export function zoneClock(
  snapshotTime: number,
  threatensYou: boolean,
  lead: number,
  age: number,
) {
  return snapshotTime + (threatensYou ? lead : age);
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
