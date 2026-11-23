/**
 * Solo test mode's damage meter: the last hit and the damage per second over
 * the last few seconds, read from the total damage the server reports for
 * your fighter (`stats.dealt`). Hits that land in the same server update
 * count as one hit (a multi-hit skill's ticks inside one update add up).
 */
export const PRACTICE_DPS_WINDOW = 5;

export interface PracticeMeter {
  /** Feed the latest total and the arena clock (seconds); returns the readout. */
  update(dealt: number, time: number): PracticeReadout;
}
export interface PracticeReadout {
  /** The latest hit, rounded; 0 before the first one. */
  lastHit: number;
  /** Damage over the last PRACTICE_DPS_WINDOW seconds, per second. */
  dps: number;
}

export function practiceMeter(window = PRACTICE_DPS_WINDOW): PracticeMeter {
  let total = 0;
  let clock = 0;
  let lastHit = 0;
  let hits: { time: number; amount: number }[] = [];
  return {
    update(dealt, time) {
      // A reset (arena reset, a new fighter, a new session) starts over:
      // the total or the clock went back. What is dealt by then is the new
      // starting point, not a hit.
      if (dealt < total || time < clock) {
        hits = [];
        lastHit = 0;
        total = dealt;
      }
      clock = time;
      const amount = dealt - total;
      if (amount > 0.01) {
        hits.push({ time, amount });
        lastHit = amount;
      }
      total = dealt;
      hits = hits.filter((h) => h.time > time - window);
      const sum = hits.reduce((s, h) => s + h.amount, 0);
      return { lastHit: Math.round(lastHit), dps: Math.round(sum / window) };
    },
  };
}
