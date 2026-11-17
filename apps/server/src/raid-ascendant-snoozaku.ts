/**
 * Ascendant Snoozaku (Somnara's id): the evolved dream-baku on the Spire's
 * fortieth floor.
 *
 * STUB for the zone-4 wiring branch: a pass-through layer, so the Spire's
 * zone-4 room (SpireDreamArena, apps/server/src/spire.ts) can be built and
 * tested before the boss lands. The boss branch replaces this file at the
 * same path with the real `AscendantSnoozakuRules` (same export name and
 * signature); the lead takes that version at merge.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AscendantSnoozakuRules = <T extends new (...a: any[]) => any>(
  Base: T,
) => Base;
