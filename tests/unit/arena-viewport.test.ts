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
    "keeps all world edges visible and fighter proportions at %ix%i",
    (width, height) => {
      const view = arenaViewport(width, height, true);
      expect(1600 * view.zoomX).toBeCloseTo(width);
      expect(900 * view.zoomY).toBeCloseTo(height);
      expect(view.fighterX * view.zoomX).toBeCloseTo(
        view.fighterY * view.zoomY,
      );
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
