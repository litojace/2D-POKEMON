import type { RaidLoadout } from "../../../packages/shared/src/raid";

/** Equipped items as a space-separated list (for data-raid-cosmetic~=...). */
export function raidLookList(look: RaidLoadout | null | undefined) {
  return Object.values(look ?? {})
    .filter(Boolean)
    .join(" ");
}
