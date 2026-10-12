import { expect, it } from "vitest";
import { stadiumBands, stadiumCrowd } from "../../apps/client/src/stadium";
import {
  safeViewport,
  mobileLayout,
  DEFAULT_CONTROLS,
} from "../../apps/client/src/mobile-input";
it("leaves a separate court between landscape controls and stadium bands", () => {
  for (const [width, height, left, right, bottom] of [
    [667, 375, 0, 0, 0],
    [852, 393, 59, 59, 21],
    [1024, 768, 0, 0, 20],
    [568, 320, 0, 0, 0],
    [667, 375, 59, 59, 21],
  ]) {
    const available = safeViewport(width, height, {
      top: 0,
      left,
      right,
      bottom,
    });
    const layout = mobileLayout(
      available.width,
      available.height,
      DEFAULT_CONTROLS,
    );
    const bands = stadiumBands(available.height);
    if (layout.compact) {
      const bottomBand = Math.max(layout.height, layout.joystick + 20) + 48;
      const courtBottom = height - bottom - bottomBand;
      const controlsTop =
        height - bottom - 42 - Math.max(layout.height, layout.joystick + 20);
      expect(courtBottom).toBeLessThan(controlsTop);
      expect(courtBottom - bands.top).toBeGreaterThan(90);
      expect(layout.width + layout.joystick + 20).toBeLessThan(available.width);
      continue;
    }
    const courtLeft = left + 12 + layout.joystick + 32;
    const courtRight = width - right - 12 - layout.width - 12;
    expect(courtRight - courtLeft).toBeGreaterThan(140);
    expect(height - bottom - bands.top - bands.bottom).toBeGreaterThan(160);
    expect(courtLeft).toBeGreaterThan(left + 12 + layout.joystick + 20);
    expect(courtRight).toBeLessThan(width - right - 12 - layout.width);
  }
});
it("keeps crowd decoration outside the input system", () => {
  const crowd = stadiumCrowd();
  expect((crowd.match(/class="spectator"/g) ?? []).length).toBe(48);
  expect((crowd.match(/aria-hidden="true"/g) ?? []).length).toBe(2);
});
