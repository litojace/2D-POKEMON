import type { CharacterId } from "@arena/shared";
import { SUN_DYNASTY_NAMES } from "../../../../packages/shared/src/shop";
import type { SkinArt } from "./skin-art";
import { modernReplaces } from "./modern-designs";
import { legendPalette } from "./fashion-art";
import { LEGEND_SECOND } from "./legend-colours";
import { SUN_TINTS } from "./collection-colours";
// Registers the Sun Dynasty designs, which modernReplaces looks up.
import "./modern-sun";

/**
 * Sun Dynasty (Legendary): each champion wears a body colour chosen for its
 * figure (collection-colours.ts) and the court's costume (modern-sun.ts),
 * whose collar, pectoral and jewels light up in play (lume layers). The
 * signature effects (epic-signature-fx.ts, table `sun`) add a sun-mosaic
 * landing, a winged-sunrise victory, a motif per champion and a trail of
 * gold sand.
 */
export const SUN_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(SUN_DYNASTY_NAMES) as CharacterId[]).map((id) => [
    `${id}-sun-dynasty`,
    {
      palette: legendPalette(
        id,
        SUN_TINTS[id],
        LEGEND_SECOND["sun-dynasty"][id],
      ),
      accessories: ["modern-sun"],
      replaces: modernReplaces("sun", id),
      trail: { kind: "dust", colors: [0xf2c14e, 0xe8d4a0] },
      skill: 0xf2c14e,
      signature: `${id}-sun-dynasty`,
      // The Moon Vizier's lantern and the Spice Healer's chestnut are
      // re-forged as a brass lamp and a pomegranate (modern-sun.ts).
      ...(id === "duskveil" || id === "pyranda" ? { heldOff: true } : {}),
      // The Lotus Sceptre's mallet becomes a gold sceptre crowned with a sun.
      ...(id === "astrabun"
        ? { weapon: { handle: "#f2c14e", head: "#2a7a8a" } }
        : {}),
    } satisfies SkinArt,
  ]),
);
