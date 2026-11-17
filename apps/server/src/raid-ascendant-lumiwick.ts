/**
 * Ascendant Lumiwick (Emberwing's id): the evolved sky-lantern spirit on
 * the Spire's sixtieth floor.
 *
 * STUB for the zone-6 wiring branch: a pass-through layer, so the Spire's
 * zone-6 room (SpireEmberArena, apps/server/src/spire.ts) can be built and
 * tested before the boss lands. The boss branch replaces this file at the
 * same path with the real `AscendantLumiwickRules` (same export name and
 * signature); the lead takes that version at merge.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AscendantLumiwickRules = <T extends new (...a: any[]) => any>(
  Base: T,
) => Base;
