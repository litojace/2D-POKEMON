import type { CharacterId } from "@arena/shared";
import { STARS_STRIPES_NAMES } from "../../../../packages/shared/src/shop";
import type { SkinArt } from "./skin-art";
import { modernReplaces } from "./modern-designs";
// Registers the Stars & Stripes designs, which modernReplaces looks up.
import "./modern-stars";

/**
 * Stars & Stripes (Legendary): each champion keeps its own colours; its
 * costume carries the theme (modern-designs.ts, modern-stars.ts) and its
 * glowing pieces light up in play (lume layers). The signature effects
 * (epic-signature-fx.ts, table `stars`) add a Walk-of-Fame landing, a
 * fireworks victory, a motif per champion and a star-spark trail.
 */
export const STARS_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(STARS_STRIPES_NAMES) as CharacterId[]).map((id) => [
    `${id}-stars-stripes`,
    {
      palette: {},
      accessories: ["modern-stars"],
      replaces: modernReplaces("stars", id),
      trail: { kind: "star", colors: [0xc8323a, 0xffffff] },
      skill: 0xf2c14e,
      signature: `${id}-stars-stripes`,
    } satisfies SkinArt,
  ]),
);
