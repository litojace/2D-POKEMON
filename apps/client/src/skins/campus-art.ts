import type { CharacterId } from "@arena/shared";
import { NEON_CAMPUS_NAMES } from "../../../../packages/shared/src/shop";
import type { SkinArt } from "./skin-art";
import { modernReplaces } from "./modern-designs";
import { tintPalette } from "./fashion-art";
import { CAMPUS_TINTS } from "./collection-colours";
// Registers the Neon Campus designs, which modernReplaces looks up.
import "./modern-campus";

/**
 * Neon Campus (Epic): each champion wears a body colour chosen
 * for its figure (collection-colours.ts); its club's kit
 * carries the theme (modern-designs.ts, modern-campus.ts), and its glowing
 * pieces light up in play (lume layers). A short confetti trail on a dash.
 */
export const CAMPUS_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(NEON_CAMPUS_NAMES) as CharacterId[]).map((id) => [
    `${id}-neon-campus`,
    {
      palette: tintPalette(id, CAMPUS_TINTS[id]),
      accessories: ["modern-campus"],
      replaces: modernReplaces("campus", id),
      trail: { kind: "confetti", colors: [0x59f0ff, 0xff4fd8] },
      skill: 0x59f0ff,
      // Stargazer's mallet is its telescope's stand (epic-props.ts).
      ...(id === "astrabun" ? { weapon: { handle: "#3a3f5a", head: "#a8743a" } } : {}),
      // Bake Club Chef holds its cake where its chestnut was (epic-props.ts).
      ...(id === "pyranda" ? { heldOff: true } : {}),
    } satisfies SkinArt,
  ]),
);
