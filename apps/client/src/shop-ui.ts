import type { CharacterId } from "@arena/shared";
import { CHAMPION_SKIN_BY_ID } from "../../../packages/shared/src/shop";
import { nextPacificDayAt } from "../../../packages/shared/src/raid-roster";
import { serverNow } from "./server-clock";
import { buttonIcon } from "./menu-icons";
import { cosmeticPicture } from "./cosmetic-picture";
import { skinThumbnail, thumbSlot } from "./skin-thumbnails";

/**
 * Coin amounts, the coin pill, the daily countdown and item
 * pictures: small pieces the HUD, Missions, Journey and the fitting room
 * (screens/fitting-room-view.ts) share.
 */
export const coins = (n: number) => n.toLocaleString("en-US");
/** Short form for the fixed-size top bar pills: 99,999 · 100K · 1.25M · 10M. */
export function compactCoins(n: number) {
  if (n < 100_000) return coins(n);
  if (n < 1_000_000) return `${Math.floor(n / 1000)}K`;
  return `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, "")}M`;
}
/** The coin balance chip (header and Shop). */
export function coinChip(
  balance: number | null | undefined,
  id = "",
  unlimited = false,
  compact = false,
) {
  return `<span class="coin-chip pill"${id ? ` id="${id}"` : ""}>${unlimited ? '<span class="sr-only">Unlimited </span>' : ""}${buttonIcon("coin")}<b${unlimited ? ' aria-hidden="true" title="Unlimited coins · Purchases don’t spend coins"' : ""}>${unlimited ? "∞" : balance == null ? "—" : compact ? compactCoins(balance) : coins(balance)}</b><span class="sr-only"> coins</span></span>`;
}
/**
 * "7 h 24 min" until the next Pacific midnight, when Today's Picks (and
 * missions and the Daily Spark) change. Counted on the server's clock.
 */
export function picksCountdown(now = serverNow()) {
  const minutes = Math.max(
    1,
    Math.round((nextPacificDayAt(new Date(now)) - now) / 60_000),
  );
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

/** A small picture of the actual item; only skins and Colors use a fighter. */
export function itemPicture(
  id: string,
  champion: CharacterId,
  scope: string,
  stage = 1,
  stars = 0,
) {
  const skin = CHAMPION_SKIN_BY_ID[id];
  if (skin)
    return skinThumbnail(id, skin.champion, stage, thumbSlot(scope, id));
  return cosmeticPicture(id, champion, scope, stars);
}
