/**
 * Ascendant Inkpurr (Gloomshade's id): the evolved shadow cat on the Spire's
 * thirtieth floor.
 *
 * STUB for the zone-3 wiring branch: a pass-through layer, so the Spire's
 * zone-3 room (SpireGloomArena, apps/server/src/spire.ts) can be built and
 * tested before the boss lands. The boss branch replaces this file at the
 * same path with the real `AscendantInkpurrRules` (same export name and
 * signature); the lead takes that version at merge.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AscendantInkpurrRules = <T extends new (...a: any[]) => any>(
  Base: T,
) => Base;
