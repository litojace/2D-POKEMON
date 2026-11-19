/**
 * The Plaza's golden hour, by this device's clock. Drawing only; no rule or
 * reward depends on it.
 */

/** 0 … 1 golden light: strongest at 17:30 (0.73), a softer glow at dawn. */
export function goldenLevel(tod: number): number {
  const dusk = 1 - Math.abs(tod - 0.73) / 0.07;
  const dawn = (1 - Math.abs(tod - 0.27) / 0.05) * 0.5;
  return Math.max(0, dusk, dawn);
}
