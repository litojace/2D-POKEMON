import type { CharacterId } from "@arena/shared";
import type { CreaturePart } from "../creature-design";
import { SKY_PIRATE_NAMES } from "../../../../packages/shared/src/shop";
import type { SkinArt } from "./skin-art";
import { PIRATE_STYLE } from "./pirate-fashion";
import { VANGUARD_KEEP_CREST } from "./vanguard-art";

/**
 * Sky Pirates (Legendary): each champion keeps its own colours, so it reads
 * as itself under the hat; the costume carries the theme. The tricorne
 * replaces head-top props (goggles, bandanas, saplings) but never a crest
 * that is part of the champion (the same list Nova Vanguard keeps).
 */
export const PIRATE_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(SKY_PIRATE_NAMES) as CharacterId[]).map((id) => {
    const replaces: CreaturePart[] = ["scarf"];
    if (!VANGUARD_KEEP_CREST.includes(id)) replaces.push("flame");
    const plume = parseInt(PIRATE_STYLE[id].plume.slice(1), 16);
    return [
      `${id}-sky-pirates`,
      {
        palette: {},
        accessories: ["sky-pirates"],
        replaces,
        trail: { kind: "coin", colors: [0xffd65b, plume] },
        skill: 0xffd65b,
        signature: `${id}-sky-pirates`,
      } satisfies SkinArt,
    ];
  }),
);
