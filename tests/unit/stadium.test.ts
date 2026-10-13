import { expect, it } from "vitest";
import { stadiumBands, stadiumCrowd } from "../../apps/client/src/stadium";
import {
  safeViewport,
  mobileLayout,
  DEFAULT_CONTROLS,
} from "../../apps/client/src/mobile-input";
it("keeps full-width landscape controls inside the safe court", () => {
  for (const [width, height, left, right, bottom] of [
    [667, 375, 0, 0, 0],
    [852, 393, 59, 59, 21],
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
      Math.max(180, available.height - 64),
      DEFAULT_CONTROLS,
    );
    const court = {
      left: left + 4,
      right: width - right - 4,
      top: 58,
      bottom: height - bottom - 4,
    };
    const controlsTop = height - bottom - 14 - layout.height;
    expect(controlsTop).toBeGreaterThan(court.top);
    expect(height - bottom - 14).toBeLessThan(court.bottom);
    expect(layout.width + layout.joystick + 32).toBeLessThanOrEqual(
      width - left - right,
    );
    expect(layout.targets).toHaveLength(6);
    expect(court.right - court.left).toBeGreaterThan(width - left - right - 10);
  }
});
it("keeps crowd decoration outside the input system", () => {
  const crowd = stadiumCrowd();
  expect((crowd.match(/class="spectator"/g) ?? []).length).toBe(48);
  expect((crowd.match(/aria-hidden="true"/g) ?? []).length).toBe(2);
});
