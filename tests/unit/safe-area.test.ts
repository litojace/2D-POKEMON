import { describe, expect, it } from "vitest";
import {
  safeViewport,
  controlExtent,
  mobileLayout,
  DEFAULT_CONTROLS,
} from "../../apps/client/src/mobile-input";
it("reserves cutouts and home indicators without changing game dimensions", () => {
  expect(
    safeViewport(393, 852, { top: 59, bottom: 34, left: 0, right: 0 }),
  ).toEqual({ width: 369, height: 735 });
  expect(
    safeViewport(852, 393, { top: 0, bottom: 21, left: 59, right: 59 }),
  ).toEqual({ width: 710, height: 348 });
  expect(
    safeViewport(1024, 768, { top: 24, bottom: 20, left: 0, right: 0 }),
  ).toEqual({ width: 1000, height: 700 });
  for (const viewport of [
    safeViewport(393, 852, { top: 59, bottom: 34, left: 0, right: 0 }),
    safeViewport(852, 393, { top: 0, bottom: 21, left: 59, right: 59 }),
  ]) {
    const layout = mobileLayout(
      viewport.width,
      viewport.height,
      DEFAULT_CONTROLS,
    );
    expect(layout.width + layout.joystick).toBeLessThan(viewport.width);
    expect(layout.height).toBeLessThan(viewport.height);
  }
});

describe("controlExtent", () => {
  it("ignores a visual viewport shrunk by the keyboard, so raid controls keep their size", () => {
    // iPhone 16 Pro Max landscape: 440 tall; keyboard up leaves ~240 visible.
    expect(controlExtent(240, 440)).toBe(440);
    expect(controlExtent(440, 440)).toBe(440);
    expect(controlExtent(undefined, 430)).toBe(430);
    const small = mobileLayout(
      808,
      Math.max(180, controlExtent(240, 240) - 108),
    );
    const full = mobileLayout(
      808,
      Math.max(180, controlExtent(240, 440) - 108),
    );
    expect(full.joystick).toBeGreaterThan(small.joystick);
  });
});
