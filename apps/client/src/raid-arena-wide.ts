import type { IllustratedRaidFloor } from "./raid-arena-art";
import coliseum from "./art/raid-arenas-wide/raid-coliseum.webp";
import lagoon from "./art/raid-arenas-wide/lagoon.webp";
import lanternYard from "./art/raid-arenas-wide/lantern-yard.webp";
import cloudDeck from "./art/raid-arenas-wide/cloud-deck.webp";
import sunAtrium from "./art/raid-arenas-wide/sun-atrium.webp";
import skyTerrace from "./art/raid-arenas-wide/sky-terrace.webp";
import conductorRing from "./art/raid-arenas-wide/conductor-ring.webp";

/**
 * The world round each raid court: one picture of the ground beyond the
 * walls, shown wherever the camera sees past the court (a phone's wide
 * screen at the whole-court view, the apron the follow camera slides onto).
 * It replaces the eight mirrored, dimmed copies of the court that used to
 * fill that space. The court's own picture (raid-arena-art.ts) stays on top,
 * sharp, so this one only has to look right outside the walls.
 *
 * Every picture covers the same world rectangle, centred on the court:
 * 1200 world px beyond its sides, 925 beyond its top and bottom. That is more
 * than the widest view needs (a 2.2:1 phone below the raid HUD sees about
 * 850 px past each side at the whole-court zoom).
 */
export const RAID_WIDE_BOUNDS = {
  x: -1200,
  y: -925,
  width: 4000,
  height: 2750,
} as const;

/** Dims the world beyond the walls, so the court reads as the place to fight. */
export const RAID_WIDE_TINT = 0x8c96a6;

export const RAID_ARENA_WIDE: Partial<Record<IllustratedRaidFloor, string>> = {
  "raid-coliseum": coliseum,
  lagoon,
  "lantern-yard": lanternYard,
  "cloud-deck": cloudDeck,
  "sun-atrium": sunAtrium,
  "sky-terrace": skyTerrace,
  "conductor-ring": conductorRing,
};

/** Load a court's surrounding picture; nothing happens if it has none or it fails. */
export function loadRaidWideArt(
  id: IllustratedRaidFloor,
  done: (image: HTMLImageElement) => void,
) {
  const src = RAID_ARENA_WIDE[id];
  if (!src) return false;
  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    image.onload = image.onerror = null;
    done(image);
  };
  // The mirrored surround stays if the picture can't load (offline).
  image.onerror = () => {
    image.onload = image.onerror = null;
  };
  image.src = src;
  return true;
}
