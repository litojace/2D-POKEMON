/**
 * When chat lines were said, as the big chat apps show it: not a time on
 * every line (the drawer is narrow), but a small centred stamp before a line
 * that starts a new stretch: the first line, a line 5 minutes or more after
 * the one before, or the first line of a new day.
 *
 *   today            9:42 PM
 *   yesterday        Yesterday 9:42 PM
 *   the last 6 days  Mon 9:42 PM
 *   older            Nov 3, 9:42 PM   (Nov 3, 2025, 9:42 PM another year)
 *
 * Days follow the player's own clock; the hour follows their device's
 * format (9:42 PM or 21:42).
 */

/** A new stretch of chat starts after this long without a line. */
export const STAMP_GAP_MS = 5 * 60_000;

const dayStart = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
/** Whole days from `t`'s day to `now`'s (0 today, 1 yesterday). */
const daysAgo = (t: number, now: number) =>
  Math.round((dayStart(now) - dayStart(t)) / 86_400_000);

/** Whether a stamp goes before a line said at `at`, after one at `prev`. */
export function needsStamp(at: number, prev: number | null): boolean {
  return (
    prev === null ||
    at - prev >= STAMP_GAP_MS ||
    dayStart(at) !== dayStart(prev)
  );
}

/** The stamp's text for a line said at `at`, seen at `now`. */
export function stampText(at: number, now = Date.now(), locale?: string) {
  const d = new Date(at);
  const time = d.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
  const ago = daysAgo(at, now);
  if (ago <= 0) return time;
  if (ago === 1) return `Yesterday ${time}`;
  if (ago < 7)
    return `${d.toLocaleDateString(locale, { weekday: "short" })} ${time}`;
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return `${d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })}, ${time}`;
}

/** The full date and time, for screen readers (and a tooltip). */
export const stampLong = (at: number, locale?: string) =>
  new Date(at).toLocaleString(locale, {
    dateStyle: "full",
    timeStyle: "short",
  });
