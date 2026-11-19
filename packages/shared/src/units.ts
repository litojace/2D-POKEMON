/**
 * Players read distances in meters. The game works in court pixels, and
 * every text a player reads (skill and rite descriptions, combos, raid
 * tips) is written in them too; `inMeters` rewrites "N px" for display, so
 * authors keep one unit and players see the other.
 *
 * At 50 px to the meter a fighter (48 px across) is about a meter wide and
 * the court (1600 × 900 px) is 32 × 18 m, about a basketball court.
 */
export const PX_PER_METER = 50;

/** A distance in court pixels as players read it: "4.8 m". */
export function meters(px: number) {
  const m = px / PX_PER_METER;
  return `${Number.isInteger(m) ? m : +m.toFixed(1)} m`;
}

/** Every "N px" (or "Npx") in a player-facing text, in meters. */
export function inMeters(text: string) {
  return text.replace(/(\d+(?:\.\d+)?)\s?px\b/g, (_, n: string) =>
    meters(Number(n)),
  );
}
