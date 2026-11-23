/**
 * The raid worlds, painted in code (no picture files): each illustrated raid
 * floor's court and everything round it, out to WORLD's edges. The Spire's
 * boss floors paint the same courts, under their summit grade.
 */
import type { Ctx, Part, WorldPainter } from "./kit";
import { coliseum } from "./coliseum";
import { lagoon } from "./lagoon";
import { lanternYard } from "./lantern-yard";
import { cloudDeck } from "./cloud-deck";
import { sunAtrium } from "./sun-atrium";
import { skyTerrace } from "./sky-terrace";
import { conductorRing } from "./conductor-ring";

export { WORLD } from "./kit";
export type { WorldPainter } from "./kit";

export const RAID_WORLDS = {
  "raid-coliseum": coliseum,
  lagoon,
  "lantern-yard": lanternYard,
  "cloud-deck": cloudDeck,
  "sun-atrium": sunAtrium,
  "sky-terrace": skyTerrace,
  "conductor-ring": conductorRing,
} satisfies Record<string, WorldPainter>;
export type RaidWorldId = keyof typeof RAID_WORLDS;

/**
 * World px per texel for the painting round the court: it shows past the
 * walls only, where a little softness doesn't matter, and keeps the texture
 * near 8 MB (1620 × 1215).
 */
export const WORLD_DENSITY = 0.45;

export function paintRaidWorld(c: Ctx, id: RaidWorldId, part: Part) {
  RAID_WORLDS[id].paint(c, part);
}
