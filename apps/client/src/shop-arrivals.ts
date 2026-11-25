import {
  CHAMPION_SKIN_BY_ID,
  LOOK_ITEM_BY_ID,
} from "../../../packages/shared/src/shop";
import { serverNow } from "./server-clock";

/**
 * When things reached the Shop, so the catalogue can mark them "New" and
 * lead with them: a collection's id (every skin or piece in it) or one
 * item's id → the day it went on sale, "YYYY-MM-DD". An item is new for
 * NEW_DAYS from that day, on the server's clock, then the mark goes by
 * itself: nothing to clean up.
 *
 * Add a line in the same pull request that adds items to the catalogue
 * (packages/shared/src/shop.ts). Display only: prices, picks and ownership
 * stay the database's.
 */
export const SHOP_ARRIVALS: Readonly<Record<string, string>> = {
  "starlight-idol": "2026-11-25",
  seaside: "2026-11-25",
  steamworks: "2026-11-25",
  borealis: "2026-11-25",
  birthstone: "2026-11-25",
  "rainy-day": "2026-11-25",
};
/** How long an arrival stays "New". */
export const NEW_DAYS = 14;

const DAY = 86_400_000;
/** Is this item a recent arrival? */
export function isNewArrival(
  id: string,
  now = serverNow(),
  arrivals: Readonly<Record<string, string>> = SHOP_ARRIVALS,
) {
  const collection =
    CHAMPION_SKIN_BY_ID[id]?.collection ?? LOOK_ITEM_BY_ID[id]?.collection;
  const day = arrivals[id] ?? (collection ? arrivals[collection] : undefined);
  if (!day) return false;
  const since = Date.parse(`${day}T00:00:00Z`);
  // A day early on the clock (time zones) still counts; a date to come
  // doesn't show ahead of its release by more than that.
  return (
    Number.isFinite(since) && now >= since - DAY && now < since + NEW_DAYS * DAY
  );
}
