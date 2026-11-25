import type { CharacterId } from "@arena/shared";
import { STARLIGHT_IDOL_NAMES } from "../../../../packages/shared/src/shop";
import type { SkinArt } from "./skin-art";
import { modernReplaces } from "./modern-designs";
import { tintPalette } from "./fashion-art";
import { IDOL_TINTS } from "./collection-colours";
// Registers the Starlight Idol designs, which modernReplaces looks up.
import "./modern-idol";

/**
 * Starlight Idol (Epic): each champion wears a body colour chosen for its
 * stage act (collection-colours.ts); the act's costume carries the theme
 * (modern-designs.ts, modern-idol.ts), and its sequins, brooches and stage
 * lights glow in play (lume layers). A short star trail on a dash, in the
 * show's pink and gold.
 */
export const IDOL_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(STARLIGHT_IDOL_NAMES) as CharacterId[]).map((id) => [
    `${id}-starlight-idol`,
    {
      palette: tintPalette(id, IDOL_TINTS[id]),
      accessories: ["modern-idol"],
      replaces: modernReplaces("idol", id),
      trail: { kind: "star", colors: [0xff6fae, 0xfff3a8, 0xffffff] },
      skill: 0xff6fae,
      // Mochi Starlet's mallet is a pink light stick.
      ...(id === "astrabun" ? { weapon: { handle: "#fff6fb", head: "#ff8fc0" } } : {}),
    } satisfies SkinArt,
  ]),
);
