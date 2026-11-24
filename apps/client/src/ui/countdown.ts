import {
  nextPacificDayAt,
  pacificDate,
} from "../../../../packages/shared/src/raid-roster";
import { serverNow } from "../server-clock";

/**
 * The hub's longer countdowns (UI remodel step 4): the weekly goals' reset
 * and the end of the season. Like picksCountdown() (shop-ui.ts) they count
 * on the server's clock (serverNow) and in Pacific time, where the server
 * starts its days, weeks and seasons.
 */

/** "28 d 6 h", "7 h 12 min" or "5 min" (never less than a minute). */
export function countdownText(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const d = Math.floor(minutes / 1440),
    h = Math.floor((minutes % 1440) / 60),
    m = minutes % 60;
  if (d) return `${d} d ${h} h`;
  return h ? `${h} h ${m} min` : `${m} min`;
}

/** When the next Pacific Monday starts: the weekly goals reset then. */
export function nextPacificWeekAt(now = serverNow()) {
  let t = now;
  for (let i = 0; i < 8; i++) {
    t = nextPacificDayAt(new Date(t));
    // Noon UTC on the Pacific date names its weekday safely.
    if (new Date(`${pacificDate(new Date(t))}T12:00:00Z`).getUTCDay() === 1)
      return t;
  }
  return t;
}

/**
 * When a season ("2026-12") ends: the first Pacific day of the next month.
 * The season's id comes from the server; an ended season gives `now`.
 */
export function seasonEndsAt(season: string, now = serverNow()) {
  const [year, month] = season.split("-").map(Number);
  if (!year || !month) return now;
  const next = month === 12 ? [year + 1, 1] : [year, month + 1];
  const first = `${next[0]}-${String(next[1]).padStart(2, "0")}-01`;
  let t = now;
  for (let i = 0; i < 40 && pacificDate(new Date(t)) < first; i++)
    t = nextPacificDayAt(new Date(t));
  return t;
}

/** "4 d 7 h" until the weekly goals reset. */
export const weeklyCountdown = (now = serverNow()) =>
  countdownText(nextPacificWeekAt(now) - now);
/** "28 d 6 h" until the season ends. */
export const seasonCountdown = (season: string, now = serverNow()) =>
  countdownText(seasonEndsAt(season, now) - now);
/** Today's Pacific date by the server's clock ("2026-11-04"). */
export const serverDay = (now = serverNow()) => pacificDate(new Date(now));
