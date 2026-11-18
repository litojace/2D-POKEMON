import type { CharacterId } from "@arena/shared";
import { HERO_SQUAD_NAMES } from "../../../../packages/shared/src/shop";
import type { SkinArt } from "./skin-art";
import { modernReplaces } from "./modern-designs";
// Registers the Hero Squad designs, which modernReplaces looks up.
import "./modern-hero";

/**
 * Hero Squad (Epic): each champion keeps its own colours; its hero suit and
 * gear carry the theme (modern-designs.ts, modern-hero.ts), and their glowing
 * pieces light up in play (lume layers). A short star trail on a dash.
 */
export const HERO_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(HERO_SQUAD_NAMES) as CharacterId[]).map((id) => [
    `${id}-hero-squad`,
    {
      palette: {},
      accessories: ["modern-hero"],
      replaces: modernReplaces("hero", id),
      trail: { kind: "star", colors: [0xffd84a, 0xffffff] },
      skill: 0xffd84a,
    } satisfies SkinArt,
  ]),
);
