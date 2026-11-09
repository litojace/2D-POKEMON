import { expect, it } from "vitest";
import {
  SWITCH_CLEARANCE,
  placeSwitch,
} from "../../apps/client/src/scene-switch-place";

it("stays in the middle of the screen when it fits there", () => {
  // 1440 px: card ends at 250, pills start at 1100.
  expect(placeSwitch(1440, 250, 1100, 548, 300)).toEqual({
    x: 720,
    tight: false,
  });
});

it("moves to the middle of the gap when the middle runs into the pills", () => {
  // 812 px with a notch: the middle (406) would put its right edge at 521,
  // past the coins at 509.
  const spot = placeSwitch(812, 231, 509, 230, 174);
  expect(spot).toEqual({ x: 370, tight: false });
  expect(spot.x + 115).toBeLessThanOrEqual(509 - SWITCH_CLEARANCE);
  expect(spot.x - 115).toBeGreaterThanOrEqual(231 + SWITCH_CLEARANCE);
});

it("narrows its tabs only when even the gap is too small", () => {
  expect(placeSwitch(568, 150, 350, 214, 174)).toEqual({ x: 250, tight: true });
  // Already as narrow as it gets: no tighter style to switch to.
  expect(placeSwitch(568, 150, 350, 214, 214).tight).toBe(false);
});
