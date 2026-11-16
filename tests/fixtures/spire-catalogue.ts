/** Unreleased content for UI expansion tests only. Never used by the game. */
import {
  SPIRE_CATALOGUE,
  type SpireCatalogue,
} from "../../apps/client/src/screens/spire-model";
import type { SpireFloor, SpireZone } from "../../packages/shared/src/spire";

export function expandedSpire(zones = 2): SpireCatalogue {
  const floors: Record<number, SpireFloor> = structuredClone(
    SPIRE_CATALOGUE.floors,
  );
  const entries: Record<number, SpireZone> = structuredClone(
    SPIRE_CATALOGUE.zones,
  );
  // Built on zone 1 alone: the zones it adds replace any released ones.
  const rewards = structuredClone(
    SPIRE_CATALOGUE.rewards.filter((r) => r.floor <= 10),
  );
  for (let zone = 2; zone <= zones; zone++) {
    entries[zone] = {
      ...entries[1],
      id: zone,
      name: "Tidal Archives beyond the Moonlit Observatory",
      element: "Water",
      boss: "tidewyrm",
      ascendant: "Ascendant Tidelotl",
    };
    for (let local = 1; local <= 10; local++) {
      const floor = (zone - 1) * 10 + local;
      const original = floors[local];
      floors[floor] = {
        ...original,
        floor,
        zone,
        name:
          local === 10
            ? "Ascendant Tidelotl of the Moonlit Tidal Archives"
            : `Hall of Reflections beneath the Moonlit Observatory ${floor}`,
        description:
          local === 10 ? "New attacks: Pearl Cascade, Tidal Crown" : undefined,
        ...(local === 10 ? { boss: "tidewyrm" } : {}),
      } as SpireFloor;
      rewards.push({
        season: 0,
        floor,
        kind: "coins",
        item: "coins",
        amount: 150,
      });
      if (local === 10)
        rewards.push({
          season: 0,
          floor,
          kind: "title",
          item: "Keeper of the Moonlit Tidal Archives",
          amount: 0,
        });
    }
  }
  return {
    ...SPIRE_CATALOGUE,
    floors,
    zones: entries,
    rewards,
    builtTop: zones * 10,
  };
}
