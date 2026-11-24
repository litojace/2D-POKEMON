import {
  TIER_NAMES,
  cosmeticTier,
} from "../../../packages/shared/src/cosmetic-tier";

/** A small rarity label (colour from cosmetic-fx.css [data-tier]). */
export function tierChip(id: string, stars = 0) {
  const tier = cosmeticTier(id, stars);
  return `<span class="tier-chip" data-tier="${tier}">${TIER_NAMES[tier]}</span>`;
}
