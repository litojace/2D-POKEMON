import { expect, it } from "vitest";
import {
  isIOSWebApp,
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
