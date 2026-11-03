import type { CharacterId } from "@arena/shared";
import { CHAMPION_SKIN_BY_ID } from "../../../packages/shared/src/shop";
import { nextPacificDayAt } from "../../../packages/shared/src/raid-roster";
import { serverNow } from "./server-clock";
import { fighterArt } from "./fighter-art";
import { buttonIcon } from "./menu-icons";
import { cosmeticPicture } from "./cosmetic-picture";

/**
 * Coin amounts, the coin and Gold Leaves pills, the daily countdown and item
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
/** The Gold Leaves pill (hub redesign): the same box as the coin chip. */
export function leafChip(balance: number) {
  return `<span class="coin-chip pill leaf-chip"><svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19C5 10 10 5 20 4c0 10-5 15-15 15z" fill="#7fd65a" stroke="#3f8a2e" stroke-width="1.3" stroke-linejoin="round"/><path d="M5 19 14 10" stroke="#3f8a2e" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg><b>${compactCoins(balance)}</b><span class="sr-only"> Gold Leaves</span></span>`;
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

// Isolated images let browsers cache/rasterize skin artwork once instead of
// keeping thousands of SVG mask/filter nodes live in the scrolling catalog.
const skinThumbnails = new Map<string, string>();
function skinThumbnail(id: string, champion: CharacterId, stage: number) {
  const key = `${id}:${stage}`;
  let url = skinThumbnails.get(key);
  if (!url) {
    url = `data:image/svg+xml,${encodeURIComponent(fighterArt(champion, undefined, { skin: id, stage }))}`;
    if (skinThumbnails.size >= 64)
      skinThumbnails.delete(skinThumbnails.keys().next().value!);
    skinThumbnails.set(key, url);
  }
  return `<img src="${url}" alt="" aria-hidden="true" width="200" height="202" loading="lazy" decoding="async">`;
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
  if (skin) return skinThumbnail(id, skin.champion, stage);
  return cosmeticPicture(id, champion, scope, stars);
}
