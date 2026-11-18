import type { CharacterId } from "@arena/shared";
import { HON_VIET_NAMES } from "../../../../packages/shared/src/shop";
import type { SkinArt } from "./skin-art";
import { modernReplaces } from "./modern-designs";
// Registers the Hồn Việt designs, which modernReplaces looks up.
import "./modern-viet";

/**
 * Hồn Việt (Epic): each champion keeps its own colours; its costume and
 * accessories carry the theme (see modern-viet.ts and modern-designs.ts),
 * and their glowing pieces light up in play (lume layers). A short petal
 * trail in red and gold on a dash.
 */
export const VIET_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(HON_VIET_NAMES) as CharacterId[]).map((id) => [
    `${id}-hon-viet`,
    {
      palette: {},
      accessories: ["modern-viet"],
      replaces: modernReplaces("viet", id),
      trail: { kind: "petal", colors: [0xf2c14e, 0xe8322a] },
      skill: 0xf2c14e,
    } satisfies SkinArt,
  ]),
);
