import type { CharacterId } from "@arena/shared";
import { DESIGNS, type Design } from "./modern-designs";
import type { ModernTheme } from "./modern-fashion";

/**
 * Legendary detailing: each Legendary skin's own headwear and signature
 * prop, worked up past its Epic-level drawing (a plume and filigree on a
 * captain's hat, an engraved bezel on its compass, a jewel in a crown...).
 * Each collection keeps its details in its own file (legend-details-*.ts),
 * a design per champion drawn after the costume's own, on the same parts.
 */
export type Details = Partial<Record<CharacterId, Design>>;
export function legendDetails(theme: ModernTheme, table: Details) {
  const designs = (DESIGNS[theme] ??= {});
  for (const [id, extra] of Object.entries(table) as [CharacterId, Design][]) {
    const own = designs[id];
    designs[id] = (k) => {
      own?.(k);
      extra(k);
    };
  }
}

/**
 * Where Astrabun's mallet head sits on its arm part in each view (measured
 * from the art, final units; the left view mirrors the right). The mallet
 * stands upright there, its handle running down from the head; the rig
 * turns the whole arm as it swings, so a piece drawn here swings with it.
 * The head is about 38 wide and 32 tall, so a replacement covers that box.
 */
export function malletHead(k: { back: boolean; side: number }) {
  const spot = k.back ? [143, 99] : k.side ? [54, 106] : [150.7, 101.5];
  return { x: k.side < 0 ? 200 - spot[0] : spot[0], y: spot[1] };
}

/**
 * Where Duskveil's lantern hangs from its crook on the tail part (final
 * units; the tail is turned round in the right-facing view). Its glow stays
 * there when a skin takes the lantern's body off (SkinArt.heldOff).
 */
export function lanternSpot(k: { side: number }) {
  return { x: k.side > 0 ? 31.5 : 168.5, y: 126 };
}
/**
 * Tidefin's fin-blade, held point-up in the right hand: its hilt and tip on
 * the arm part (front, and profile drawn for the right-facing view and
 * mirrored for the left). Not seen from behind.
 */
export function bladeLine(k: { back: boolean; side: number }) {
  if (k.side) {
    const m = (x: number) => (k.side < 0 ? 200 - x : x);
    return { hx: m(107), hy: 152, tx: m(99), ty: 106 };
  }
  return { hx: 134, hy: 153, tx: 151, ty: 92 };
}
/** Pyranda's chestnut, in its right hand from the front. */
export const CHESTNUT = { x: 143, y: 127 };
