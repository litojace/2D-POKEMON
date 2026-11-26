import type { CharacterId } from "@arena/shared";
import { LOOK_ITEM_BY_ID } from "../../../packages/shared/src/shop";
import { RAID_COSMETICS } from "../../../packages/shared/src/raid";
import { JOURNEY_ITEM_BY_ID } from "../../../packages/shared/src/journey";
import { colourPreview, hasColourPalette } from "./colour-preview";
import { fighterAvatar } from "./fighter-art";
import { cosmeticTier } from "../../../packages/shared/src/cosmetic-tier";

/**
 * Colors are shown on the fighter. An aura, entrance or victory shows its
 * own effect alone, filling the picture (cosmetic-fx-preview.ts): the Shop's
 * tiles drew a dim figure of the fighter inside it, and the owner asked for
 * the effect on its own (25 Nov 2026); the try-on stage shows it on your
 * fighter.
 */
export function cosmeticPicture(
  id: string,
  champion: CharacterId,
  scope: string,
  stars = 0,
) {
  const item =
    LOOK_ITEM_BY_ID[id] ??
    RAID_COSMETICS[id as keyof typeof RAID_COSMETICS] ??
    JOURNEY_ITEM_BY_ID[id];
  if (!item) return "";
  const colors = item.slot === "skin";
  const art = colors
    ? hasColourPalette(id)
      ? `<img src="data:image/svg+xml,${encodeURIComponent(colourPreview(fighterAvatar(champion, scope), id))}" width="84" height="84" alt="" loading="lazy" decoding="async">`
      : fighterAvatar(champion, scope)
    : "";
  return `<span class="raid-cosmetic-preview shop-look-preview${colors ? "" : " is-effect-only"}" data-cosmetic="${id}"${item.slot === "frame" ? ` data-frame-stars="${stars}"` : ""} data-tier="${cosmeticTier(id, stars)}" aria-hidden="true">${art}</span>`;
}
