import { expect, it } from "vitest";
import {
  isIOSDevice,
  isIOSWebApp,
  memoryConstrained,
  rendererDensity,
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
