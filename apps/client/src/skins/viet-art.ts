import type { CharacterId } from "@arena/shared";
import { HON_VIET_NAMES } from "../../../../packages/shared/src/shop";
import type { SkinArt } from "./skin-art";
import { modernReplaces } from "./modern-designs";
import { legendPalette } from "./fashion-art";
import { LEGEND_SECOND } from "./legend-colours";
import { VIET_TINTS } from "./collection-colours";
// Registers the Hồn Việt designs, which modernReplaces looks up.
import "./modern-viet";
import "./modern-viet-legend";

/**
 * Hồn Việt (Legendary): each champion wears a body colour chosen
 * for its figure (collection-colours.ts); its costume and
 * accessories carry the theme (modern-designs.ts, modern-viet.ts), with the
 * Legendary prop swaps (modern-viet-legend.ts): Astrabun's mallet
 * becomes a rabbit lantern, Sunbara's yuzu a crown of hoa mai, Tidefin holds
 * a lotus lamp, Terradon's shell turns to Kim Quy's gold. Glowing pieces
 * light up in play (lume layers), and the signature effects add the drum
 * landing, the lantern victory, a motif per champion and a petal trail
 * (epic-signature-fx.ts).
 */
export const VIET_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(HON_VIET_NAMES) as CharacterId[]).map((id) => [
    `${id}-hon-viet`,
    {
      palette: legendPalette(id, VIET_TINTS[id], LEGEND_SECOND["hon-viet"][id]),
      accessories: ["modern-vietlegend"],
      replaces: modernReplaces("vietlegend", id),
      trail: { kind: "petal", colors: [0xf2c14e, 0xe8322a] },
      skill: 0xf2c14e,
      signature: `${id}-hon-viet`,
      // Takes off the held piece its design re-forges (legend-details).
      ...(id === "duskveil" ? { heldOff: true } : {}),
      // Astrabun's mallet becomes a rabbit lantern on a bamboo rod.
      ...(id === "astrabun"
        ? { weapon: { handle: "#3f8a4f", head: "#e8322a" } }
        : {}),
    } satisfies SkinArt,
  ]),
);
