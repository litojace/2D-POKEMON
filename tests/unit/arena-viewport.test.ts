import { describe, expect, it } from "vitest";
import { arenaViewport } from "../../apps/client/src/arena-viewport";

describe("responsive court camera", () => {
  it("keeps the camera finite while the menu hides the canvas", () => {
    for (const value of Object.values(arenaViewport(0, 0, true)))
      expect(Number.isFinite(value)).toBe(true);
  });
  it.each([
    [726, 310],
    [1000, 270],
    [560, 180],
  ])(
    "fills landscape phones with an undistorted court at %ix%i",
    (width, height) => {
      const view = arenaViewport(width, height, true);
      // Uniform: circles stay round and visuals match hitboxes.
      expect(view.zoomX).toBe(view.zoomY);
      expect([view.fighterX, view.fighterY]).toEqual([1, 1]);
      // Covers the arena box; the follow camera scrolls the rest.
      expect(1600 * view.zoomX).toBeGreaterThanOrEqual(width - 1e-6);
      expect(900 * view.zoomY).toBeGreaterThanOrEqual(height - 1e-6);
      expect(
        Math.min(1600 * view.zoomX - width, 900 * view.zoomY - height),
      ).toBeCloseTo(0);
    },
  );
  it.each([
    [1200, 675],
    [390, 844],
  ])(
    "preserves uniform desktop and portrait projection at %ix%i",
    (width, height) => {
      const view = arenaViewport(width, height, false);
      expect(view.zoomX).toBe(view.zoomY);
      expect(view.fighterX).toBe(1);
      expect(view.fighterY).toBe(1);
      expect(1600 * view.zoomX).toBeLessThanOrEqual(width);
      expect(900 * view.zoomY).toBeLessThanOrEqual(height);
    },
  );
});
