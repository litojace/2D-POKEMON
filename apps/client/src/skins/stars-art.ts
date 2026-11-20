import type { CharacterId } from "@arena/shared";
import { STARS_STRIPES_NAMES } from "../../../../packages/shared/src/shop";
import type { SkinArt } from "./skin-art";
import { modernReplaces } from "./modern-designs";
import { legendPalette } from "./fashion-art";
import { LEGEND_SECOND } from "./legend-colours";
import { STARS_TINTS } from "./collection-colours";
// Registers the Stars & Stripes designs, which modernReplaces looks up.
import "./modern-stars";

/**
 * Stars & Stripes (Legendary): each champion wears a body colour chosen
 * for its figure (collection-colours.ts); its
 * costume carries the theme (modern-designs.ts, modern-stars.ts) and its
 * glowing pieces light up in play (lume layers). The signature effects
 * (epic-signature-fx.ts, table `stars`) add a Walk-of-Fame landing, a
 * fireworks victory, a motif per champion and a star-spark trail.
 */
export const STARS_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(STARS_STRIPES_NAMES) as CharacterId[]).map((id) => [
    `${id}-stars-stripes`,
    {
      palette: legendPalette(id, STARS_TINTS[id], LEGEND_SECOND["stars-stripes"][id]),
      accessories: ["modern-stars"],
      replaces: modernReplaces("stars", id),
      trail: { kind: "star", colors: [0xc8323a, 0xffffff] },
      skill: 0xf2c14e,
      signature: `${id}-stars-stripes`,
      // Astrabun's mallet becomes a magic wand (legend-details-stars.ts).
      ...(id === "astrabun" ? { weapon: { handle: "#2a2a36", head: "#2a2a36" } } : {}),
    } satisfies SkinArt,
  ]),
);
