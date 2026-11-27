import { CHARACTERS, type CharacterId } from "@arena/shared";
import { creatureSvg, type SkinLook } from "./creature-design";
import { scopeIds } from "./fighter-art";

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
  return scopeIds(
    creatureSvg(id, "right", undefined, undefined, "normal", look),
    "startup",
  );
}

/** Which drawing a fighter and its look need: redrawn only when it changes. */
export const runnerKey = (id: CharacterId, look?: SkinLook | null) =>
  `${id}:${look?.skin ?? ""}:${look?.stage ?? ""}`;

/** A fighter id read from storage or the address: a real one, or Voltkit. */
export const runnerFighter = (id: string | null | undefined): CharacterId =>
  id && Object.hasOwn(CHARACTERS, id) ? (id as CharacterId) : "voltkit";
