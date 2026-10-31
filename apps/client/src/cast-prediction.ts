import { skillReady, type Fighter } from "../../../packages/shared/src/index";

/**
 * Predicted casts: your own basic attack and skills start on the key press
 * instead of one network round trip later. The client checks the same
 * conditions the server does (cooldown or meter ready, recovered from the
 * last move, not stunned, frozen or asleep, not winding up a charge), plays
 * the animation and sound at once, and remembers the prediction. When the
 * server's "cast" event for it arrives, the echo is not played again; if it
 * never arrives (the server refused), the prediction expires and its
 * animation is cut short. Damage, hits and cooldowns stay the server's.
 */
/** "charge": a skill with a wind-up (its cast comes when the charge ends). */
export type CastAction = "basic" | "skill0" | "skill1" | "skill2" | "skill3" | "dash" | "charge";

const DISABLING = ["stun", "freeze", "sleep"];

function canAct(p: Fighter, time: number) {
  return (
    !p.out &&
    p.hp > 0 &&
    !p.charge &&
    p.recoveryUntil <= time &&
    !p.statuses.some((s) => s.until > time && DISABLING.includes(s.kind))
  );
}
/** Would the server start this skill now? */
export function canCastSkill(p: Fighter, slot: number, time: number, free = false) {
  return canAct(p, time) && skillReady(p, slot, time, free);
}
/** Would the server swing a basic attack now? */
export function canBasic(p: Fighter, time: number) {
  return canAct(p, time) && time >= p.basicAt;
}
/** Would the server start a dash now? (Recovery does not block a dash.) */
export function canDash(p: Fighter, time: number) {
  return (
    !p.out &&
    p.hp > 0 &&
    time >= p.dashAt &&
    !p.statuses.some((s) => s.until > time && DISABLING.includes(s.kind))
  );
}

export class CastPredictor {
  private pending = new Map<CastAction, number>();
  /** Round trip in ms (from the ping badge); predictions wait this long plus a margin. */
  rtt = 120;
  private get window() {
    return Math.max(300, Math.min(1200, this.rtt + 250));
  }
  /** A prediction of this action is waiting for the server. */
  waiting(action: CastAction, now: number) {
    const at = this.pending.get(action);
    return at !== undefined && now - at <= this.window;
  }
  predict(action: CastAction, now: number) {
    this.pending.set(action, now);
  }
  /** The server's cast arrived: true when it was already shown (skip the replay). */
  confirm(action: CastAction, now: number) {
    const at = this.pending.get(action);
    this.pending.delete(action);
    return at !== undefined && now - at <= this.window;
  }
  /** Predictions the server never confirmed; they are forgotten. */
  expired(now: number) {
    const gone: CastAction[] = [];
    for (const [action, at] of this.pending)
      if (now - at > this.window) {
        gone.push(action);
        this.pending.delete(action);
      }
    return gone;
  }
  clear() {
    this.pending.clear();
  }
}
