import { quickText, type ChatLine } from "../../../packages/shared/src/chat.js";

/**
 * Chat moderation on the server (docs/chat-plan.md, App Store Review
 * Guideline 1.2): reports from a chat line, and the automatic pause when
 * several players report the same one.
 *
 * - A report carries the channel's last lines as the server kept them, never
 *   as the reporter's page shows them, so nobody can make up a line.
 * - Three different players reporting someone within an hour stops that
 *   player chatting for an hour, until an admin has looked. The pause lives
 *   in memory: a restart lifts it (the reports themselves are saved).
 */
export const CHAT_REPORT = {
  /** Different reporters within `windowMs` that pause a player. */
  reporters: 3,
  windowMs: 60 * 60_000,
  /** How long that pause lasts. */
  pauseMs: 60 * 60_000,
  /** One player's reports of the same player count once per this long. */
  repeatMs: 10 * 60_000,
} as const;

/** arena_submit_report's context: 12 values of up to 300 characters. */
const CONTEXT_KEYS = 12;
const CONTEXT_VALUE = 300;
/** The database refuses a context over 2000 characters (migration 002). */
const CONTEXT_BUDGET = 1900;

export class ChatReports {
  /** Who reported each player, and when. */
  private reports = new Map<string, Map<string, number>>();
  private paused = new Map<string, number>();

  constructor(private now: () => number = Date.now) {}

  /**
   * A report of `targetId` by `reporterId`. Returns whether this report
   * counts (not a repeat) and whether the target is now paused.
   */
  record(reporterId: string, targetId: string) {
    const now = this.now();
    let by = this.reports.get(targetId);
    if (!by) this.reports.set(targetId, (by = new Map()));
    for (const [who, at] of by)
      if (now - at >= CHAT_REPORT.windowMs) by.delete(who);
    const last = by.get(reporterId);
    const counts = last === undefined || now - last >= CHAT_REPORT.repeatMs;
    if (counts) by.set(reporterId, now);
    let pausedNow = false;
    if (by.size >= CHAT_REPORT.reporters && !this.isPaused(targetId)) {
      this.paused.set(targetId, now + CHAT_REPORT.pauseMs);
      pausedNow = true;
    }
    return { counts, pausedNow };
  }

  /** The player is paused by reports right now. */
  isPaused(accountId: string) {
    const until = this.paused.get(accountId);
    if (until === undefined) return false;
    if (this.now() < until) return true;
    this.paused.delete(accountId);
    return false;
  }

  /** An admin looked: lift the pause. */
  lift(accountId: string) {
    this.paused.delete(accountId);
    this.reports.delete(accountId);
  }
}

/** One line as an admin reads it in a report. */
export function reportLine(l: ChatLine) {
  const said = l.quick ? `[quick] ${quickText(l.quick)}` : (l.text ?? "");
  const time = new Date(l.at).toISOString().slice(11, 19);
  return `${time} ${l.from.name} (${l.from.id.slice(0, 8)}): ${said}`.slice(
    0,
    CONTEXT_VALUE,
  );
}

/**
 * The report's context: the channel, who is reported, and the newest lines
 * that fit (oldest first), within the database's limits.
 */
export function reportContext(
  channel: string,
  target: { id: string; name: string },
  lines: ChatLine[],
): Record<string, string> {
  const context: Record<string, string> = {
    source: "chat",
    channel: channel.slice(0, CONTEXT_VALUE),
    reported: `${target.name} (${target.id})`.slice(0, CONTEXT_VALUE),
  };
  const room = CONTEXT_KEYS - Object.keys(context).length;
  const picked: string[] = [];
  let size = JSON.stringify(context).length;
  for (const l of [...lines].reverse()) {
    if (picked.length >= room) break;
    const text = reportLine(l);
    const cost = JSON.stringify(text).length + 8;
    if (size + cost > CONTEXT_BUDGET) break;
    picked.unshift(text);
    size += cost;
  }
  picked.forEach((t, i) => (context[`line${i + 1}`] = t));
  return context;
}
