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
