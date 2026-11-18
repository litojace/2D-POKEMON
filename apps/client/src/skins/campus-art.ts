import type { CharacterId } from "@arena/shared";
import { NEON_CAMPUS_NAMES } from "../../../../packages/shared/src/shop";
import type { SkinArt } from "./skin-art";
import { modernReplaces } from "./modern-designs";
// Registers the Neon Campus designs, which modernReplaces looks up.
import "./modern-campus";

/**
 * Neon Campus (Epic): each champion keeps its own colours; its club's kit
 * carries the theme (modern-designs.ts, modern-campus.ts), and its glowing
 * pieces light up in play (lume layers). A short confetti trail on a dash.
 */
export const CAMPUS_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(NEON_CAMPUS_NAMES) as CharacterId[]).map((id) => [
    `${id}-neon-campus`,
    {
      palette: {},
      accessories: ["modern-campus"],
      replaces: modernReplaces("campus", id),
      trail: { kind: "confetti", colors: [0x59f0ff, 0xff4fd8] },
      skill: 0x59f0ff,
    } satisfies SkinArt,
  ]),
);
