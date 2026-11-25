import type { CharacterId } from "@arena/shared";
import { LOOK_ITEM_BY_ID } from "../../../packages/shared/src/shop";
import { RAID_COSMETICS } from "../../../packages/shared/src/raid";
import { JOURNEY_ITEM_BY_ID } from "../../../packages/shared/src/journey";
import { colourPreview, hasColourPalette } from "./colour-preview";
import { fighterArt, fighterAvatar } from "./fighter-art";
import { cosmeticTier } from "../../../packages/shared/src/cosmetic-tier";

/**
 * The fighter an effect is shown on, whole (the frame skin thumbnails use):
 * one picture per fighter, made once. "" where pictures can't be made from
 * memory (tests outside a browser).
 */
const SUBJECT_FRAME = "-6 -26 212 216";
const subjects = new Map<CharacterId, string>();
function subjectUrl(champion: CharacterId) {
  if (typeof Blob === "undefined" || typeof URL.createObjectURL !== "function")
    return "";
  let url = subjects.get(champion);
  if (!url) {
    url = URL.createObjectURL(
      new Blob([fighterArt(champion, SUBJECT_FRAME)], {
        type: "image/svg+xml",
      }),
    );
    subjects.set(champion, url);
  }
  return url;
}

/**
 * Colors are shown on the fighter. An aura, entrance or victory shows its
 * own effect, with the fighter it would be on as a dim figure inside it
 * where the caller asks for one (the Shop and Wardrobe: cosmetic-fx.css
 * ".fx-subject", cosmetic-fx-preview.ts): a ring on an empty floor said
 * little about what you were buying.
 */
export function cosmeticPicture(
  id: string,
  champion: CharacterId,
  scope: string,
  stars = 0,
  /** Draw an effect round a figure of the fighter (the Shop's tiles). */
  withFigure = false,
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
  const effect =
    item.slot === "aura" || item.slot === "entrance" || item.slot === "victory";
  const subject = effect && withFigure ? subjectUrl(champion) : "";
  const figure = subject
    ? `<img class="fx-subject" src="${subject}" width="212" height="216" alt="" loading="lazy" decoding="async">`
    : "";
  return `<span class="raid-cosmetic-preview shop-look-preview${colors ? "" : " is-effect-only"}" data-cosmetic="${id}"${item.slot === "frame" ? ` data-frame-stars="${stars}"` : ""} data-tier="${cosmeticTier(id, stars)}" aria-hidden="true">${art}${figure}</span>`;
}
