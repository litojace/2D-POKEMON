import type { Fighter } from "@arena/shared";
import { fighterAvatar } from "./fighter-art";
import { wornArt } from "./skins/skin-art";
import { RAID_COSMETICS } from "../../../packages/shared/src/raid";
import { LOOK_ITEMS } from "../../../packages/shared/src/shop";
import { JOURNEY_ITEMS } from "../../../packages/shared/src/journey";
import "./portrait-frames.css";

const frames = new Set(
  [
    ...Object.entries(RAID_COSMETICS).map(([id, item]) => ({ id, ...item })),
    ...LOOK_ITEMS,
    ...JOURNEY_ITEMS,
  ]
    .filter((item) => item.slot === "frame")
    .map((item) => item.id),
);

/** Reuse the real frame artwork at any identity-avatar size. */
export function framePortrait(art: string, frame?: string | null) {
  return frame && frames.has(frame)
    ? `<span class="raid-cosmetic-preview portrait-frame" data-cosmetic="${frame}" data-portrait-frame="${frame}">${art}</span>`
    : art;
}

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

/** For identity widgets that do not already paint a frame on their container. */
export function framedAvatar(p: Portrait, scope: string) {
  return framePortrait(portraitAvatar(p, scope), p.raidLook?.frame);
}
