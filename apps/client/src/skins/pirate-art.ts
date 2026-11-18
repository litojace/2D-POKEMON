import type { CharacterId } from "@arena/shared";
import { SKY_PIRATE_NAMES } from "../../../../packages/shared/src/shop";
import type { SkinArt } from "./skin-art";
import { PIRATE_STYLE } from "./pirate-fashion";
import { modernReplaces } from "./modern-designs";
import { tintPalette } from "./fashion-art";
import { PIRATE_TINTS } from "./modern-pirates";

/**
 * Sky Pirates (Legendary): every champion holds its own post on the ship,
 * with its own hat, coat, gear and glowing pieces (modern-pirates.ts), and
 * a body colour chosen for it (PIRATE_TINTS). Cindrake's flame and
 * Halcyra's beak are redrawn by their designs, under the bandana and cap.
 */
export const PIRATE_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(SKY_PIRATE_NAMES) as CharacterId[]).map((id) => {
    const plume = parseInt(PIRATE_STYLE[id].plume.slice(1), 16);
    return [
      `${id}-sky-pirates`,
      {
        palette: tintPalette(id, PIRATE_TINTS[id]),
        accessories: ["modern-pirates"],
        replaces: modernReplaces("pirates", id),
        trail: { kind: "coin", colors: [0xffd65b, plume] },
        skill: 0xffd65b,
        signature: `${id}-sky-pirates`,
      } satisfies SkinArt,
    ];
  }),
);
