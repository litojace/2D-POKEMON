import { describe, expect, it } from "vitest";
import {
  FollowCamera,
  outsideView,
  screenToWorld,
} from "../../apps/client/src/follow-camera";
const focus = (x = 800, y = 450) => ({
  x,
  y,
  vx: 270,
  vy: 0,
  angle: 0,
  attacking: false,
});
describe("fighter follow camera", () => {
  it.each([
    [1200, 675, false],
    [726, 310, true],
    [390, 720, false],
  ])(
    "clamps visible court at boundaries without distorting fighters",
    (w, h, mobile) => {
      for (const [x, y] of [
        [0, 0],
        [1600, 900],
      ]) {
        const view = new FollowCamera().update(
          w,
          h,
          mobile,
          focus(x, y),
          "room:1",
          16,
          false,
        );
        const halfW = Math.min(800, w / view.zoomX / 2),
          halfH = Math.min(450, h / view.zoomY / 2);
        expect(view.x - halfW).toBeGreaterThanOrEqual(0);
        expect(view.x + halfW).toBeLessThanOrEqual(1600);
        expect(view.y - halfH).toBeGreaterThanOrEqual(0);
        expect(view.y + halfH).toBeLessThanOrEqual(900);
        expect(view.zoomX * view.fighterX).toBeCloseTo(
          view.zoomY * view.fighterY,
        );
      }
    },
  );
  it("tracks movement smoothly, then resets on a new room or round", () => {
    const camera = new FollowCamera();
    const start = camera.update(800, 450, false, focus(600), "a:1", 16, false);
    const moved = camera.update(800, 450, false, focus(1000), "a:1", 16, false);
    expect(moved.x).toBeGreaterThan(start.x);
    expect(moved.x).toBeLessThan(1000);
    const reset = camera.update(800, 450, false, focus(1000), "b:1", 16, false);
    expect(reset.x).toBeGreaterThan(moved.x);
  });
  it("projects a stationary mouse into changing world coordinates", () => {
    const camera = new FollowCamera();
    const view = camera.update(800, 450, false, focus(1000), "a", 16, false);
    const world = screenToWorld(400, 225, 800, 450, view);
    expect(world).toEqual({ x: view.x, y: view.y });
    const offset = screenToWorld(500, 225, 800, 450, view);
    expect((offset.x - view.x) * view.zoomX).toBeCloseTo(100);
    expect(outsideView(0, 0, 800, 450, view)).toBe(true);
    expect(outsideView(view.x, view.y, 800, 450, view)).toBe(false);
  });
  it("uses a steady overview without a live fighter or with reduced motion", () => {
    for (const reduced of [false, true]) {
      const view = new FollowCamera().update(
        800,
        450,
        false,
        reduced ? focus(1200) : undefined,
        "a",
        16,
        reduced,
      );
      expect(view.x).toBe(800);
      expect(view.y).toBe(450);
      expect(view.zoomX).toBe(0.5);
    }
  });
});
