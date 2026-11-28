import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  creatureSvg,
  proportioned,
  type CreaturePart,
  type SkinLook,
} from "./creature-design";
import { profilePivot } from "./creature-profile";
import { scopeIds } from "./fighter-art";

/** The parts the run swings (server-connection.css), each about its joint. */
const SWUNG: readonly CreaturePart[] = ["armL", "armR", "legL", "legR", "tail"];

/**
 * Each swung part's joint in the drawing's own units (the shoulder, the hip,
 * the tail's root): the battle rig's pivots (creature-profile.ts), through
 * the same chibi proportions as the drawing. The run turns the part about
 * this point (`transform-box: view-box`), so an arm swings from its
 * shoulder. It used to turn about a point of the part's own box (50% 14%);
 * an arm's box reaches in under the torso, so that point sat off the
 * shoulder and the swing threw the paw clear of the body (owner, 28 Nov).
 */
export function runnerJoints(id: CharacterId) {
  const joints: Partial<Record<CreaturePart, [number, number]>> = {};
  for (const part of SWUNG) {
    const at = profilePivot(id, "right", part);
    if (at) {
      const [x, y] = proportioned(part, ...at);
      joints[part] = [+x.toFixed(2), +y.toFixed(2)];
    }
  }
  return joints;
}

/**
 * The runner on the startup bar (the owner's idea, 27 Nov 2026): the
 * player's fighter in the game's own side view, facing right, in the skin
 * it wears. It stands at the end of the bar's fill and runs while the bar
 * moves (server-connection.ts places it and says when; the run itself is
 * CSS on the drawing's parts, server-connection.css). The drawing is the
 * battle rig's profile art (creature-design.ts), so every champion and
 * skin has one and nothing is downloaded for it.
 */
export function runnerMarkup(id: CharacterId, look?: SkinLook | null) {
  let svg = creatureSvg(id, "right", undefined, undefined, "normal", look);
  for (const [part, [x, y]] of Object.entries(runnerJoints(id)))
    svg = svg.replace(
      `<g class="fighter-${part}">`,
      `<g class="fighter-${part}" style="--joint: ${x}px ${y}px">`,
    );
  return scopeIds(svg, "startup");
}

/** Which drawing a fighter and its look need: redrawn only when it changes. */
export const runnerKey = (id: CharacterId, look?: SkinLook | null) =>
  `${id}:${look?.skin ?? ""}:${look?.stage ?? ""}`;

/** A fighter id read from storage or the address: a real one, or Voltkit. */
export const runnerFighter = (id: string | null | undefined): CharacterId =>
  id && Object.hasOwn(CHARACTERS, id) ? (id as CharacterId) : "voltkit";
