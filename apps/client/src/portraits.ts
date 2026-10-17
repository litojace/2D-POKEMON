import type { Fighter } from "@arena/shared";
import { fighterAvatar } from "./fighter-art";
import { wornArt } from "./skins/skin-art";

type Portrait = Pick<Fighter, "character" | "raidLook" | "championLooks">;
/** Equipped appearance items as a list for data-raid-cosmetic~="…". A worn
 * champion skin wins over the all-fighter Skin slot (design §10.5.2). */
export function portraitCosmetics(p: Portrait) {
  const skinned = !!wornArt(p.character, p.championLooks?.[p.character]);
  const look = skinned ? { ...p.raidLook, skin: null } : p.raidLook;
  return Object.values(look ?? {})
    .filter(Boolean)
    .join(" ");
}
/** A player's portrait, in the champion skin they wear. */
export function portraitAvatar(p: Portrait, scope: string) {
  return fighterAvatar(p.character, scope, p.championLooks?.[p.character]);
}
