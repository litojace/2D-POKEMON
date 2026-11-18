import type { Fighter } from "@arena/shared";
import { fighterAvatar, scopeIds, svgPicture } from "./fighter-art";
import { wornArt } from "./skins/skin-art";
import { colourPreview } from "./colour-preview";
import {
  FRAME_MAX_STARS,
  frameStars,
  RAID_COSMETICS,
} from "../../../packages/shared/src/raid";
import { LOOK_ITEMS } from "../../../packages/shared/src/shop";
import { REWARD_ITEMS } from "../../../packages/shared/src/journey";
import "./portrait-frames.css";

const frames = new Set(
  [
    ...Object.entries(RAID_COSMETICS).map(([id, item]) => ({ id, ...item })),
    ...LOOK_ITEMS,
    ...REWARD_ITEMS,
  ]
    .filter((item) => item.slot === "frame")
    .map((item) => item.id),
);

/** Stars under a boss frame (frameStars in raid.ts): ★ earned, ☆ to come. */
export function frameStarRow(stars: number) {
  stars = safeStars(stars);
  if (stars <= 0) return "";
  return `<span class="frame-stars${stars >= FRAME_MAX_STARS ? " is-legendary" : ""}" aria-label="${stars} of ${FRAME_MAX_STARS} frame stars">${"★".repeat(stars)}${"☆".repeat(FRAME_MAX_STARS - stars)}</span>`;
}
const safeStars = (stars: number) =>
  Number.isFinite(stars)
    ? Math.max(0, Math.min(FRAME_MAX_STARS, Math.floor(stars)))
    : 0;

/** Clip the portrait, never the frame's ornaments or earned stars. */
export function framePortrait(art: string, frame?: string | null, stars = 0) {
  stars = safeStars(stars);
  const disc = `<span class="portrait-disc">${art}</span>`;
  return frame && frames.has(frame)
    ? `<span class="raid-cosmetic-preview portrait-frame${stars >= FRAME_MAX_STARS ? " is-legendary-frame" : ""}" data-cosmetic="${frame}" data-portrait-frame="${frame}" data-frame-stars="${stars}">${disc}${frameStarRow(stars)}</span>`
    : disc;
}

type Portrait = Pick<
  Fighter,
  "character" | "raidLook" | "championLooks" | "raidClears"
>;
/** Equipped appearance items as a list for data-raid-cosmetic~="…". A worn
 * champion skin wins over the all-fighter Skin slot (design §10.5.2). */
export function portraitCosmetics(p: Portrait) {
  const skinned = !!wornArt(p.character, p.championLooks?.[p.character]);
  const look = skinned ? { ...p.raidLook, skin: null } : p.raidLook;
  return Object.values(look ?? {})
    .filter(Boolean)
    .join(" ");
}
/**
 * A player's portrait, in the champion skin they wear. `picture`: as one
 * shared picture rather than inline SVG (svgPicture), for lists of players.
 */
export function portraitAvatar(p: Portrait, scope: string, picture = false) {
  const skin = p.championLooks?.[p.character];
  // Use the same palette as the live rig; equipped champion skins take priority.
  const colours = !wornArt(p.character, skin) ? p.raidLook?.skin : null;
  const inline = () => {
    const art = fighterAvatar(p.character, scope, skin);
    return colours
      ? scopeIds(colourPreview(art, colours), `${scope}-colors`)
      : art;
  };
  return picture
    ? svgPicture(
        `${p.character} ${JSON.stringify(skin ?? null)} ${colours ?? ""}`,
        inline,
        p.character,
      )
    : inline();
}

/** For identity widgets that do not already paint a frame on their container. */
export function framedAvatar(
  p: Portrait,
  scope: string,
  stars = frameStars(p.raidLook?.frame, p.raidClears),
  picture = false,
) {
  return framePortrait(
    portraitAvatar(p, scope, picture),
    p.raidLook?.frame,
    stars,
  );
}
