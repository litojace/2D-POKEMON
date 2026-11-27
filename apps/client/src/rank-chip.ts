/**
 * The rank chip (rank road, docs/rank-road.md): your rank under your
 * fighter in the Lobby, beside the element pill, always there once you have
 * one. A shield in hand shows in the gem's place. It only says: the rail's
 * Ranks button opens the road.
 *
 * Rules and markup only; lobby-screen.ts places it, main.ts gives it the
 * rating (from /api/progress, then from each match's report).
 */
import {
  PLACEMENT_MATCHES,
  RANK_TIERS,
  rankColor,
  rankNamed,
  type Rating,
} from "../../../packages/shared/src/accounts";
import { esc } from "./ui/components";

export interface RankChip {
  /** "Spark II", "Placing 2/5" or "Unranked". */
  text: string;
  /** The tier's colour; unset while there is no rank yet. */
  color?: string;
  /** A shield is in hand: the next loss out of the tier is held. */
  shield: boolean;
  /** For a screen reader. */
  label: string;
}
/**
 * What the chip shows. Nothing while the rating loads, and nothing for a
 * player who has never met another player while Ranks is still locked at
 * their level (feature-unlocks.ts): a new player's Lobby stays about the
 * first matches.
 */
export function rankChip(
  r: Rating | undefined,
  ranksLocked: boolean,
): RankChip | null {
  if (!r) return null;
  const left = r.placementLeft ?? 0;
  if (left > 0) {
    if (r.matches <= 0)
      return ranksLocked
        ? null
        : { text: "Unranked", shield: false, label: "Your rank: unranked" };
    const played = Math.max(0, PLACEMENT_MATCHES - left);
    return {
      text: `Placing ${played}/${PLACEMENT_MATCHES}`,
      shield: false,
      label: `Placement matches: ${played} of ${PLACEMENT_MATCHES} played`,
    };
  }
  return {
    text: r.rank,
    color: rankColor(r.rank),
    shield: !!r.shield,
    label: `Your rank: ${r.rank}${r.shield ? ". Shield ready" : ""}`,
  };
}
const SHIELD = `<svg class="rank-chip-shield" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 20 5.6v6.1c0 5-3.4 8.4-8 9.8-4.6-1.4-8-4.8-8-9.8V5.6Z" fill="currentColor"/></svg>`;
/** The chip's inside: a gem (or the shield) and the rank. */
export const rankChipMarkup = (chip: RankChip) =>
  `${chip.shield ? SHIELD : '<i class="rank-chip-gem" aria-hidden="true"></i>'}<span>${esc(chip.text)}</span>`;
/** A key that changes when the chip must be drawn again. */
export const rankChipKey = (chip: RankChip | null) =>
  chip ? `${chip.text}|${chip.color ?? ""}|${chip.shield ? 1 : 0}` : "";

/**
 * What a match's rating change is worth saying, once: a new tier (its title,
 * its coins and a shield are yours), a step up, or the shield that held a
 * loss. Nothing for an ordinary win or loss: the result's Rank tile has it.
 */
export function rankNews(r: Rating) {
  const now = rankNamed(r.rank);
  if (!now) return "";
  const tier = RANK_TIERS[now.tier];
  if (r.shielded) return `Your shield held: you stay in ${tier.name}.`;
  const was = r.previousRank ? rankNamed(r.previousRank) : undefined;
  // The match that ends placement gives a rank for the first time.
  if (!was)
    return r.previousRank === "Unranked"
      ? `You're ranked: ${r.rank}. The ${tier.name} title is yours to keep.`
      : "";
  if (now.tier > was.tier)
    return `New tier: ${tier.name}! Its title${tier.coins ? `, ${tier.coins} coins` : ""} and a shield are yours.`;
  if (now.tier === was.tier && now.step > was.step)
    return `Rank up! You're now ${r.rank}.`;
  return "";
}
