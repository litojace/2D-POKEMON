/**
 * The "damage trail" of a boss health bar, as in most action RPGs: when the
 * boss loses health a pale chunk stays behind for a moment, then drains down
 * to the new value, so each hit reads at a glance.
 */
const HOLD_MS = 450;
/** Share of the bar (percentage points) drained per second after the hold. */
const DRAIN_PER_S = 60;

interface Trail {
  /** Where the pale chunk ends. */
  value: number;
  /** The bar's value at the last call. */
  last: number;
  holdUntil: number;
  at: number;
}
const trails = new Map<string, Trail>();

/** Where the trail ends (0–100) for a bar now at `percent`. */
export function healthTrail(key: string, percent: number, now = performance.now()) {
  const t = trails.get(key);
  if (!t || percent >= t.value) {
    // A new bar, healing or a revive: nothing trails.
    trails.set(key, { value: percent, last: percent, holdUntil: now, at: now });
    return percent;
  }
  // Every new hit holds the chunk a moment before it drains.
  if (percent < t.last) t.holdUntil = now + HOLD_MS;
  const drainFrom = Math.max(t.at, t.holdUntil);
  if (now > drainFrom)
    t.value = Math.max(percent, t.value - ((now - drainFrom) / 1000) * DRAIN_PER_S);
  t.last = percent;
  t.at = now;
  return t.value;
}
/** Forget every trail (a new raid). */
export function resetHealthTrails() {
  trails.clear();
}
