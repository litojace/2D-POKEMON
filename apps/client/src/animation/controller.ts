import type { RaidLoadout } from "../../../../packages/shared/src/raid";
export type Facing = "up" | "down" | "left" | "right";
export type AnimationState =
  | "idle"
  | "blink"
  | "walk"
  | "run"
  | "basic"
  | "skill0"
  | "skill1"
  | "skill2"
  | "skill3"
  | "dash"
  | "jump"
  | "land"
  | "hurt"
  | "defeat"
  | "victory"
  | "wave";
const priority: Record<AnimationState, number> = {
  idle: 0,
  blink: 1,
  walk: 2,
  run: 3,
  wave: 10,
  victory: 15,
  basic: 50,
  skill0: 55,
  skill1: 55,
  skill2: 55,
  skill3: 55,
  jump: 60,
  land: 61,
  dash: 70,
  hurt: 80,
  defeat: 100,
};
export interface AnimationPose {
  /** Equipped raid appearance (skin and entrance affect the rig). */
  look?: RaidLoadout;
  /** Shop skin worn by this champion (with its Awakening stage). */
  skin?: { skin: string; stage?: number } | null;
  /** Extra Mythical ambient particles allowed (at most two living fighters). */
  ambient?: boolean;
  hp: number;
  speed: number;
  angle: number;
  dash: boolean;
  jump: boolean;
  victory?: boolean;
  charging?: boolean;
  /** The ultimate is charged: a focused look and a glow. */
  ultReady?: boolean;
  /** Round intro (countdown): each fighter greets with its own wave. */
  greet?: boolean;
}
export function facing(angle: number): Facing {
  return Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))
    ? Math.cos(angle) > 0
      ? "right"
      : "left"
    : Math.sin(angle) > 0
      ? "down"
      : "up";
}
export class AnimationController {
  state: AnimationState = "idle";
  started = 0;
  until = 0;
  private lastEvent = -1;
  trigger(
    state: AnimationState,
    now: number,
    duration = 300,
    eventId?: number,
  ) {
    if (eventId !== undefined) {
      if (eventId <= this.lastEvent) return false;
      this.lastEvent = eventId;
    }
    if (now < this.until && priority[state] < priority[this.state])
      return false;
    this.state = state;
    this.started = now;
    this.until = now + duration;
    return true;
  }
  update(pose: AnimationPose, now: number, runThreshold: number) {
    if (pose.hp <= 0) {
      if (this.state !== "defeat") this.trigger("defeat", now, Infinity);
      return this.state;
    }
    if (this.state === "defeat") {
      this.until = 0;
      this.state = "idle";
    }
    if (
      (this.state === "wave" || this.state === "victory") &&
      (pose.speed > 12 || pose.dash || pose.jump || pose.charging)
    )
      this.until = 0;
    if (now < this.until) return this.state;
    const next: AnimationState = pose.dash
      ? "dash"
      : pose.jump
        ? "jump"
        : pose.charging
          ? "skill3"
          : pose.speed > runThreshold
            ? "run"
            : pose.speed > 12
              ? "walk"
              : pose.victory
                ? "victory"
                : pose.greet
                  ? "wave"
                  : "idle";
    if (this.state !== next) {
      this.state = next;
      this.started = now;
    }
    return this.state;
  }
  /** End this move early (a predicted cast the server refused). */
  cancel(state: AnimationState) {
    if (this.state === state) this.until = 0;
  }
  reset() {
    this.state = "idle";
    this.started = 0;
    this.until = 0;
    this.lastEvent = -1;
  }
}
