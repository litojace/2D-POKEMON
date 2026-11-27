/**
 * Features that open by level (owner, 26 Nov 2026): a new player's Lobby
 * shows everything, but the side systems wear a padlock with the level that
 * opens them, one per level, so each early level-up brings something new and
 * a short "Unlocked" sheet says what. Playing itself is never locked: every
 * mode on PLAY but the raid, Fighters, Friends, invites and rooms are open
 * from the start, and so is anything a friend invites you to.
 *
 * Apple's onboarding guide for games: let people play at once, teach in
 * steps, introduce side features afterwards (docs/onboarding.md).
 *
 * Rules and markup only; lobby-screen.ts draws the padlocks and main.ts
 * decides when the sheet shows. To move a feature, change its level here.
 */
import { esc, type ConfirmOptions } from "./ui/components";
import { menuIcon, type IconName } from "./menu-icons";
import "./feature-unlocks.css";

export type Feature = "raids" | "missions" | "plaza" | "shop" | "ranks";
export interface FeatureUnlock {
  id: Feature;
  /** The player level that opens it. */
  level: number;
  /** As the sheet and a locked button's message name it. */
  name: string;
  /** One line: what it is, for the "Unlocked" sheet. */
  text: string;
  icon: IconName;
}
/**
 * One feature a level, in the order a new player meets them: the first win
 * reaches Lv 2 (the First Win XP, migration 20261126120000) and opens the
 * first boss, which is also Getting started's next step.
 */
export const FEATURE_UNLOCKS: readonly FeatureUnlock[] = [
  {
    id: "raids",
    level: 2,
    name: "Boss Raids",
    text: "Fight a boss alone or with friends. Each boss gives a reward to wear.",
    icon: "bestiary",
  },
  {
    id: "missions",
    level: 3,
    name: "Daily Missions",
    text: "Six small goals a day. Each one pays coins.",
    icon: "missions",
  },
  {
    id: "plaza",
    level: 4,
    name: "The Plaza",
    text: "A town to walk around: meet players, fish and find things to do.",
    icon: "home",
  },
  {
    id: "shop",
    level: 5,
    name: "The Shop",
    text: "Spend your coins on skins and looks for your fighters.",
    icon: "shop",
  },
  {
    id: "ranks",
    level: 6,
    name: "Ranks",
    text: "The season's leaderboard: see where you stand.",
    icon: "leaderboard",
  },
];
const BY_ID = Object.fromEntries(
  FEATURE_UNLOCKS.map((u) => [u.id, u]),
) as Record<Feature, FeatureUnlock>;
export const unlockOf = (feature: Feature) => BY_ID[feature];

/**
 * Whether a feature is still locked at this level. While the account loads
 * (no level yet) nothing is: a padlock never flashes on for a player who
 * has the feature.
 */
export function featureLocked(feature: Feature, level: number | undefined) {
  return level !== undefined && level < BY_ID[feature].level;
}
/** The features still locked at this level. */
export function lockedFeatures(level: number | undefined): Feature[] {
  return FEATURE_UNLOCKS.filter((u) => featureLocked(u.id, level)).map(
    (u) => u.id,
  );
}
/**
 * What a tap on a locked feature says. Short: a toast is one line on a
 * small phone, and the player card beside it shows their level.
 */
export function lockedMessage(feature: Feature) {
  const u = BY_ID[feature];
  return `${u.name} ${u.name.endsWith("s") ? "open" : "opens"} at Lv ${u.level}`;
}
/** The features levels `from` (exclusive) to `to` (inclusive) open. */
export function unlocksBetween(from: number, to: number) {
  return FEATURE_UNLOCKS.filter((u) => u.level > from && u.level <= to);
}

const KEY = (account: string) => `arena-unlocks:${account}`;
/** The level this browser last showed this account its unlocks for. */
export function loadSeenLevel(account: string): number | null {
  try {
    const raw = localStorage.getItem(KEY(account));
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && n >= 1 ? n : null;
  } catch {
    return null;
  }
}
export function saveSeenLevel(account: string, level: number) {
  try {
    localStorage.setItem(KEY(account), String(level));
  } catch {
    /* Private mode: the sheet may show once more. */
  }
}
/**
 * What to show now, and the level to remember. The first time this browser
 * sees an account it only remembers its level: an account that already had
 * its features (or signs in on another device) gets no sheets for them.
 */
export function unlocksDue(seen: number | null, level: number) {
  if (seen === null || level <= seen)
    return { show: [] as FeatureUnlock[], seen: Math.max(seen ?? 0, level) };
  return { show: unlocksBetween(seen, level), seen: level };
}

/** A locked button's badge: a padlock and the level, over its corner. */
export const lockBadge = (feature: Feature) =>
  `<i class="feature-lock" aria-hidden="true">${menuIcon("lock")}<b>Lv ${BY_ID[feature].level}</b></i>`;
/** A locked button's name for a screen reader. */
export const lockedLabel = (label: string, feature: Feature) =>
  `${label}: opens at level ${BY_ID[feature].level}`;

/**
 * The "Unlocked" dialog (ui/components.ts confirmModal, shown by askConfirm):
 * the level reached, what it opened and what comes next. Its main button
 * goes to the first feature; Later closes it.
 */
export function unlockDialog(
  level: number,
  unlocks: readonly FeatureUnlock[],
): ConfirmOptions {
  const first = unlocks[0];
  const next = FEATURE_UNLOCKS.find((u) => u.level > level);
  const one = unlocks.length === 1;
  const coming = `<span class="unlock-next">${next ? `${esc(next.name)} · Lv ${next.level}` : "Everything is open"}</span>`;
  return {
    kicker: `Level ${level}`,
    title: one ? `Unlocked: ${first.name}` : "Unlocked",
    sub: one ? `<span class="unlock-sub">${esc(first.text)}</span>` : undefined,
    art: `<span class="unlock-art">${menuIcon(first.icon)}</span>`,
    // One feature: its line is the title, and the ledger says what's next.
    lines: one
      ? [["Next", coming]]
      : unlocks.map((u): [string, string] => [
          u.name,
          `<span class="unlock-next">Lv ${u.level}</span>`,
        ]),
    total: one ? undefined : ["Next", coming],
    cancel: "Later",
    confirm: one ? "Open" : `Open ${first.name}`,
    confirmIcon: "enter",
  };
}
