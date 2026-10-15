import type { Mood } from "../creature-design";
import type { AnimationPose, AnimationState } from "./controller";

/** Which expression the face shows for an animation state. */
export function moodFor(
  state: AnimationState,
  pose: Pick<AnimationPose, "ultReady" | "charging">,
): Mood {
  if (state === "defeat") return "dizzy";
  if (state === "hurt") return "hurt";
  if (state === "victory" || state === "wave") return "happy";
  if (pose.ultReady || pose.charging || state === "skill3") return "focus";
  return "normal";
}

/** Squash (x wider, y shorter) or stretch for a state at `progress` 0..1. */
export function squashFor(
  state: AnimationState,
  progress: number,
  elapsed: number,
  angle: number,
): [number, number] {
  if (state === "land") {
    const k = 1 - progress;
    return [1 + 0.13 * k, 1 - 0.15 * k];
  }
  if (state === "jump") {
    const k = Math.max(0, 1 - elapsed / 0.28);
    return [1 - 0.08 * k, 1 + 0.11 * k];
  }
  if (state === "dash") {
    const sideways = Math.abs(Math.cos(angle)) > 0.5;
    return sideways ? [1.1, 0.92] : [0.93, 1.09];
  }
  if (state === "hurt") {
    const k = Math.sin(Math.min(1, progress) * Math.PI);
    return [1 + 0.07 * k, 1 - 0.07 * k];
  }
  return [1, 1];
}
