/*
 * How big an aura is next to its fighter: ONE number for the whole game.
 *
 * Every place that draws an aura round a fighter (the Lobby, the roster,
 * the Shop and the Wardrobe, battles, the Plaza) sizes it from AURA_SIZE
 * below, through the helpers here. Change AURA_SIZE and every one of them
 * follows. (Item thumbnails are the exception: there the aura fills its
 * tile, with no fighter to measure against. The Plaza, whose fighters are
 * small, draws them a little bigger on top: PLAZA_AURA_BOOST.)
 *
 * Units. An aura is drawn in its own "aura units" (collection-fx.ts): its
 * ring is about 48 of them. A fighter's art (its SVG, creature-design.ts)
 * is in "art units": the fighter stands about 160 tall, and its menu
 * shadow (fighter-art.ts menuShadow) is 64 wide (rx 32).
 */

/**
 * THE aura size: how many times the fighter's menu shadow (64 art units)
 * the aura spans. The owner set it to the Lobby's look (17-18 Nov 2026).
 */
export const AURA_SIZE = 1.6;

/** The menu shadow's half width (art units, fighter-art.ts menuShadow). */
const SHADOW_RX = 32;
/** An aura's ring, about this many aura units (as AURA_SIZE measures it). */
const RING_UNITS = 48;

/** Art units per aura unit. */
export const AURA_ART_SCALE = (SHADOW_RX * 2 * AURA_SIZE) / RING_UNITS / 2;

/**
 * Drawing units per aura unit, where a fighter's art is drawn at
 * `perArtUnit` drawing units per art unit (canvas pixels, world px...).
 * Every other helper is this one.
 */
export function auraScale(perArtUnit: number) {
  return perArtUnit * AURA_ART_SCALE;
}
/**
 * In a battle, for a fighter drawn at `rigScale` (the rig root's scale): a
 * rig unit is two art units (the rig draws half-size art).
 */
export function battleAuraScale(rigScale: number) {
  return auraScale(rigScale / 2);
}
