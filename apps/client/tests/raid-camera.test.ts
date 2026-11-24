import { expect, it } from "vitest";
import { raidCameraView } from "../src/raid-camera";
import { screenToWorld } from "../src/follow-camera";

it.each([
  [1440, 900, 70],
  [1280, 1024, 70],
  [844, 390, 48],
  [844, 280, 42],
  [1170, 2532, 120],
])(
  "fits every raid corner below the HUD at %ix%i, without distorting circles",
  (width, height, top) => {
    for (const dpr of [1, 2]) {
      const w = width * dpr,
        h = height * dpr,
        inset = top * dpr;
      const view = raidCameraView(w, h, inset);
      expect(view.zoomX).toBe(view.zoomY);
      const first = screenToWorld(0, inset, w, h, view);
      const last = screenToWorld(w, h, w, h, view);
      expect(first.x).toBeLessThanOrEqual(0.0001);
      expect(first.y).toBeLessThanOrEqual(0.0001);
      expect(last.x).toBeGreaterThanOrEqual(1599.9999);
      expect(last.y).toBeGreaterThanOrEqual(899.9999);
      // One dimension uses all available room: fitting must not add extra zoom-out.
      expect(
        Math.min(w - 1600 * view.zoomX, h - inset - 900 * view.zoomY),
      ).toBeCloseTo(0);
    }
  },
);
