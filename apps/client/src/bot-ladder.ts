/**
 * The sparring bot's level for Quick Match's fallback (docs/pvp-plan.md,
 * item 4): it follows how the player does. Two wins in a row at a level
 * move it up one, two losses in a row move it down one. Kept per device:
 * a convenience, so it may be lost (private windows, cleared storage) and
 * then starts again at Easy.
 */
/** Easy to Hard, as the server's BOT_DIFFICULTIES (apps/server/src/bot.ts). */
const BOT_DIFFICULTY_ORDER = ["easy", "normal", "hard"] as const;
export type BotLevelId = (typeof BOT_DIFFICULTY_ORDER)[number];

const KEY = "arena-bot-ladder";
export interface Ladder {
  level: BotLevelId;
  /** Positive: wins in a row at this level; negative: losses in a row. */
  streak: number;
  /** The last match counted (a result screen renders many times). */
  last?: string;
}
const start = (): Ladder => ({ level: "easy", streak: 0 });

function load(): Ladder {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (
      v &&
      (BOT_DIFFICULTY_ORDER as readonly string[]).includes(v.level) &&
      Number.isFinite(v.streak)
    )
      return v;
  } catch {
    /* Optional. */
  }
  return start();
}
function save(l: Ladder) {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    /* Optional. */
  }
}

/** The level Quick Match offers when no one is free. */
export function suggestedBotLevel(): BotLevelId {
  return load().level;
}

/** Pure step, for tests: the ladder after one result at `played`. */
export function stepLadder(
  l: Ladder,
  played: BotLevelId,
  won: boolean,
): Ladder {
  // A match at another level (picked in the menu) only counts if it is
  // harder and won, so beating Hard by choice moves the ladder up there.
  const at = BOT_DIFFICULTY_ORDER.indexOf(l.level);
  const p = BOT_DIFFICULTY_ORDER.indexOf(played);
  if (p !== at) return won && p > at ? { level: played, streak: 0 } : l;
  const streak = won ? Math.max(0, l.streak) + 1 : Math.min(0, l.streak) - 1;
  if (streak >= 2 && at < BOT_DIFFICULTY_ORDER.length - 1)
    return { level: BOT_DIFFICULTY_ORDER[at + 1], streak: 0 };
  if (streak <= -2 && at > 0)
    return { level: BOT_DIFFICULTY_ORDER[at - 1], streak: 0 };
  return { level: l.level, streak };
}

/** Count a finished bot match once (`match`: its id). */
export function recordBotResult(
  match: string,
  played: BotLevelId,
  won: boolean,
) {
  const l = load();
  if (l.last === match) return;
  save({ ...stepLadder(l, played, won), last: match });
}

/**
 * Losses in a row against bots, at any level (draws neither count nor
 * reset it). Three or more and the result screen suggests Solo test or an
 * easier bot (main.ts). Kept per device, like the ladder.
 */
export const LOSS_STREAK_HINT = 3;
const LOSSES_KEY = "arena-bot-losses";
export interface LossStreak {
  streak: number;
  last?: string;
}
export function stepLosses(
  l: LossStreak,
  outcome: "win" | "loss" | "draw",
): LossStreak {
  if (outcome === "draw") return l;
  return { streak: outcome === "loss" ? l.streak + 1 : 0 };
}
/** Count a finished bot match once; the streak after it. */
export function recordBotOutcome(
  match: string,
  outcome: "win" | "loss" | "draw",
): number {
  let l: LossStreak = { streak: 0 };
  try {
    const v = JSON.parse(localStorage.getItem(LOSSES_KEY) ?? "null");
    if (v && Number.isFinite(v.streak)) l = v;
  } catch {
    /* Optional. */
  }
  if (l.last === match) return l.streak;
  const next = { ...stepLosses(l, outcome), last: match };
  try {
    localStorage.setItem(LOSSES_KEY, JSON.stringify(next));
  } catch {
    /* Optional: this visit only. */
  }
  return next.streak;
}
/** The level below `level`, or null at Easy. */
export function easierBot(level: BotLevelId): BotLevelId | null {
  const i = BOT_DIFFICULTY_ORDER.indexOf(level);
  return i > 0 ? BOT_DIFFICULTY_ORDER[i - 1] : null;
}
