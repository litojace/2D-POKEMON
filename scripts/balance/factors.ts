import { CHARACTERS } from "../../packages/shared/src/index.ts";

const base: Record<string, { health: number; interval: number }> = {};

/**
 * Scales each champion's strength in place: health × f and basic-attack
 * interval ÷ √f (rounded to 5 ms), so f = 1.1 is roughly 10% more health and
 * 5% faster attacks. Skills are left alone. Call after any champions are
 * injected into CHARACTERS.
 */
export function applyFactors(factors: Record<string, number>) {
  for (const [id, c] of Object.entries(CHARACTERS)) {
    base[id] ??= { health: c.health, interval: c.basic.interval ?? 0 };
    const f = factors[id] ?? 1;
    c.health = Math.round(base[id].health * f);
    const ms = Math.round((base[id].interval * 1000) / Math.sqrt(f) / 5) * 5;
    c.basic.interval = ms / 1000;
    c.basic.recovery = Math.min(0.12, ms / 1000 / 2);
  }
}

/** The values a factor gives, for writing the tuned numbers back. */
export function scaled(health: number, intervalMs: number, f: number) {
  return {
    health: Math.round(health * f),
    intervalMs: Math.round(intervalMs / Math.sqrt(f) / 5) * 5,
  };
}
