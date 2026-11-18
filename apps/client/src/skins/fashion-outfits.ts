import { fashionCut } from "./fashion-fits";
import { epicFashion } from "./epic-fashion";
import { rareFashion, UNDER } from "./rare-fashion";
import type { CharacterId } from "@arena/shared";
import type { FashionCollection } from "../../../../packages/shared/src/shop";
import type { CreaturePart } from "../creature-design";
import type { Facing } from "../animation/controller";
import type { Palette } from "./skin-art";

export type FashionAccessory = `fashion-${FashionCollection}`;

/** Outfits stay on the existing body/scarf/head joints, in the same crop boxes. */
export function fashionOutfit(
  collection: FashionCollection,
  id: CharacterId,
  dir: Facing,
  p: Palette,
  head: { cx: number; top: number },
): [CreaturePart, string][] {
  if (collection === "abyssal-expedition" || collection === "dream-carnival")
    return epicFashion(id, dir, collection, p, head);
  // Each Rare collection has its own construction (rare-fashion.ts).
  return rareFashion(collection, id, dir, p, head, fashionCut(id, dir, collection)).map(({ part, svg, under }) => [part, (under ? UNDER : "") + svg]);
}
