import { expect, it } from "vitest";
import {
  isIOSDevice,
  isIOSWebApp,
  largeIPad,
  memoryConstrained,
  rendererDensity,
  sceneDensity,
} from "../../apps/client/src/render-budget";
it("caps an installed iOS drawing buffer without changing CSS coordinates", () => {
  expect(isIOSWebApp("iPhone AppleWebKit", 5, true)).toBe(true);
  expect(isIOSWebApp("Macintosh AppleWebKit", 5, true)).toBe(true);
  expect(isIOSWebApp("iPhone AppleWebKit", 5, false)).toBe(false);
  expect(isIOSWebApp("Macintosh AppleWebKit", 0, true)).toBe(false);
  expect(rendererDensity(3, true)).toBe(1.5);
  expect(rendererDensity(3, false)).toBe(2);
  expect(rendererDensity(1, true)).toBe(1);
  expect(rendererDensity(NaN, true)).toBe(1);
});

it("gives every iPhone and iPad the smaller battle canvas, in Safari too", () => {
  expect(isIOSDevice("iPhone AppleWebKit", 5)).toBe(true);
  expect(isIOSDevice("iPad AppleWebKit", 5)).toBe(true);
  // iPadOS reports a Mac with touch; a real Mac has no touch points.
  expect(isIOSDevice("Macintosh AppleWebKit", 5)).toBe(true);
  expect(isIOSDevice("Macintosh AppleWebKit", 0)).toBe(false);
  expect(isIOSDevice("Linux Android Chrome", 5)).toBe(false);
  // An iPhone in Safari (not installed) is capped like the Home Screen app.
  expect(rendererDensity(2, isIOSDevice("iPhone AppleWebKit", 5))).toBe(1.5);
});

it("gives memory back eagerly on iOS and on phones with little memory", () => {
  expect(memoryConstrained(true, 8)).toBe(true);
  expect(memoryConstrained(false, 2)).toBe(true);
  expect(memoryConstrained(false, 3)).toBe(true);
  expect(memoryConstrained(false, 4)).toBe(false);
  // Most browsers don't say: only iOS counts then.
  expect(memoryConstrained(false, undefined)).toBe(false);
});

it("keeps the Plaza and Farm canvases within the pixel budget on iOS", () => {
  // An iPhone draws at most 1.5x, as in battle (fewer pixels each frame).
  expect(sceneDensity(844, 390, 3, true)).toBe(1.5);
  expect(sceneDensity(844, 390, 1, true)).toBe(1);
  // An iPad-sized window at 1.5x would be 2.2 million: a little softer.
  const d = sceneDensity(1194, 834, 2, true);
  expect(d).toBeLessThan(1.5);
  expect(Math.round(1194 * d) * Math.round(834 * d)).toBeLessThanOrEqual(
    2_002_000,
  );
  // Elsewhere only the 2x cap applies.
  expect(sceneDensity(1194, 834, 2, false)).toBe(2);
  expect(sceneDensity(2560, 1440, 3, false)).toBe(2);
  // Never below 1, and no density reported counts as 1.
  expect(sceneDensity(4000, 3000, 2, true)).toBe(1);
  expect(sceneDensity(800, 600, NaN, true)).toBe(1);
  expect(sceneDensity(800, 600, 1, false)).toBe(1);
});

it("draws sharp on large iPads (4 GB or more), as on a desktop", () => {
  // The long side of the screen, in points: iPad Pro 13" (M4), 12.9",
  // 11", iPad Air 4+ and iPad 10 are large; iPhones and older iPads not.
  for (const size of [1376, 1366, 1210, 1194, 1180])
    expect(largeIPad(true, size)).toBe(true);
  for (const size of [956, 1133, 1080, 1112, 1024])
    expect(largeIPad(true, size)).toBe(false);
  // A Mac or a PC is never one, whatever its screen.
  expect(largeIPad(false, 2560)).toBe(false);
  // Battles: 2x on a large iPad, 1.5x on the rest of iOS.
  expect(rendererDensity(2, true, true)).toBe(2);
  expect(rendererDensity(2, true, false)).toBe(1.5);
  // An iPad Pro 13" home-screen app (1376x1032) draws its scenes at 2x:
  // 5.7 million pixels, within the large budget (it was about 1.19x).
  expect(sceneDensity(1376, 1032, 2, true, true)).toBe(2);
  expect(sceneDensity(1376, 1032, 2, true, false)).toBeCloseTo(1.19, 2);
  // Still within its budget on anything bigger (an external display).
  const d = sceneDensity(2560, 1440, 2, true, true);
  expect(Math.round(2560 * d) * Math.round(1440 * d)).toBeLessThanOrEqual(
    6_002_000,
  );
});
