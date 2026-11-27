import type { CharacterId } from "@arena/shared";
import { RAINY_DAY_NAMES } from "../../../../packages/shared/src/shop";
import type { SkinArt } from "./skin-art";
import { modernReplaces } from "./modern-designs";
// Registers the Rainy Day designs, which modernReplaces looks up.
import "./modern-rain";

/**
 * Rainy Day (Rare): each champion keeps its own colours and puts on a
 * raincoat and its own way of keeping dry (modern-rain.ts). A Rare draws
 * nothing at rest: no piece gives off light. A short trail of drops on a dash.
 */
export const RAIN_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(RAINY_DAY_NAMES) as CharacterId[]).map((id) => [
    `${id}-rainy-day`,
    {
      palette: {},
      accessories: ["modern-rain"],
      replaces: modernReplaces("rain", id),
      trail: { kind: "bubble", colors: [0xbfe8ff, 0x7fc4f2, 0xffffff] },
    } satisfies SkinArt,
  ]),
);
