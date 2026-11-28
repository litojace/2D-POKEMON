import type { CharacterId } from "@arena/shared";

/**
 * The ground a champion stands on: ONE rule for every view (owner, 27 Nov
 * 2026: "the shadow and aura's position and shape come first, and must be
 * the same across the whole game"; in the Lobby they changed size and shape
 * between champions, floaters and standers differed, and Shadopus's
 * tentacles poked out of them).
 *
 * The shadow and the aura are one ellipse on the ground under the body:
 * - its centre is the champion's ground point: the standard feet line,
 *   lower by `groundDrop` for the few whose art reaches below it;
 * - its width follows the champion's `footprint`;
 * - its flatness is the view's ground plane, the same for every champion:
 *   MENU_GROUND_FLAT in the Lobby, the Fighters page, the Shop and the
 *   Wardrobe; the court's own plane in battle, whose camera looks down more
 *   steeply (main.ts).
 * A champion that floats keeps the same ellipse: only its body hovers above
 * it (HOVERING in creature-design.ts).
 *
 * Fix the numbers here; no view special-cases a champion.
 * tests/unit/ground.test.ts holds the views to this file.
 */

/** Height over width of the menus' ground plane (the Shop's 128 × 26). */
export const MENU_GROUND_FLAT = 26 / 128;
/** A contact shadow is flatter than the plane it lies on (4.5 over 32). */
export const SHADOW_FLAT = 4.5 / 32;
/** The standard footprint: half the shadow's width, in art units. */
export const FOOTPRINT = 32;

/**
 * How far below the standard feet line a champion's art reaches (art
 * units), measured from the rendered rig at rest (28 Nov 2026). Its ground
 * point is that much lower, so tentacle tips and talons stand on the shadow
 * and aura, not through them.
 */
const DROP: Partial<Record<CharacterId, number>> = {
  shadopus: 12,
  halcyra: 6,
  mossloth: 4,
  terradon: 3,
  wombolder: 2,
};
/** Wider bodies: half the width of what touches the ground (art units). */
const WIDE: Partial<Record<CharacterId, number>> = {
  wombolder: 38,
  pangrove: 38,
  mossloth: 38,
  terradon: 36,
  shadopus: 36,
};

/** Art units from the standard feet line down to this champion's ground. */
export const groundDrop = (id: CharacterId) => DROP[id] ?? 0;
/** Half the width of this champion's shadow, in art units. */
export const footprint = (id: CharacterId) => WIDE[id] ?? FOOTPRINT;
/** This champion's footprint against the standard one (scales its aura). */
export const footprintScale = (id: CharacterId) => footprint(id) / FOOTPRINT;
