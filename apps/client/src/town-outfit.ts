import {
  RAID_SLOTS,
  type RaidLoadout,
} from "../../../packages/shared/src/raid";
import type { CharacterId } from "@arena/shared";
import type { SkinLook } from "./creature-design";

/** Compare every worn slot without resending unchanged outfits or object-key order. */
export function townOutfitKey(
  character: CharacterId,
  skin?: SkinLook | null,
  look?: RaidLoadout,
) {
  return JSON.stringify([
    character,
    skin?.skin ?? null,
    skin?.stage ?? 1,
    RAID_SLOTS.map((slot) => look?.[slot] ?? null),
  ]);
}
