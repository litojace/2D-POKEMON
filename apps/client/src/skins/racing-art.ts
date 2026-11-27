import type { CharacterId } from "@arena/shared";
import { GRAND_PRIX_NAMES } from "../../../../packages/shared/src/shop";
import type { SkinArt } from "./skin-art";
import { modernReplaces } from "./modern-designs";
// Registers the Grand Prix designs, which modernReplaces looks up.
import { RACERS } from "./modern-racing";

/**
 * Grand Prix (Epic): each champion keeps its own colours, so the driver
 * reads as itself, and wears its team's suit (modern-racing.ts); the
 * number board's digits light up in play (lume layers). Skills take the
 * number's light; a dash leaves tyre smoke in the team's colours.
 */
// Local: skin-art.ts imports this file, so its own helper isn't ready yet.
const hexToNumber = (c: string) => Number.parseInt(c.slice(1), 16);

export const RACING_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(GRAND_PRIX_NAMES) as CharacterId[]).map((id) => {
    const r = RACERS[id];
    return [
      `${id}-grand-prix`,
      {
        palette: {},
        accessories: ["modern-racing"],
        replaces: modernReplaces("racing", id),
        trail: { kind: "dust", colors: [0xe6e6ee, hexToNumber(r.suit), hexToNumber(r.stripe)] },
        skill: hexToNumber(r.glow),
      } satisfies SkinArt,
    ];
  }),
);
