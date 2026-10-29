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

describe("stands above the court", () => {
  it("fits the court plus the stands on desktop, the court's bottom on the screen's bottom", () => {
    const top = 96;
    const view = new FollowCamera().update(1600, 996, false, undefined, "a", 16, false, top);
    expect(view.zoomX).toBeCloseTo(1);
    // Shows world y from -top to 900.
    expect(view.y - 996 / view.zoomY / 2).toBeCloseTo(-top);
    expect(view.y + 996 / view.zoomY / 2).toBeCloseTo(900);
  });
  it("never shows past the stands or below the court when following on a phone", () => {
    const top = 96;
    for (const [x, y] of [
      [0, 0],
      [1600, 900],
    ]) {
      const view = new FollowCamera().update(726, 310, true, focus(x, y), "room:1", 16, false, top);
      const halfH = 310 / view.zoomY / 2;
      expect(view.y - halfH).toBeGreaterThanOrEqual(-top - 1e-6);
      expect(view.y + halfH).toBeLessThanOrEqual(900 + 1e-6);
    }
  });
  it("keeps the old view when there are no stands", () => {
    const a = new FollowCamera().update(800, 450, false, undefined, "a", 16, false);
    const b = new FollowCamera().update(800, 450, false, undefined, "a", 16, false, 0);
    expect(b).toEqual(a);
  });
});

it("widens the phone PvP view while preserving projection and court boundaries", () => {
  const narrow = new FollowCamera().update(
    844,
    390,
    true,
    focus(),
    "old",
    16,
    false,
  );
  const wide = new FollowCamera().update(
    844,
    390,
    true,
    focus(),
    "pvp",
    16,
    false,
    0,
    1.2,
  );
  expect(844 / wide.zoomX).toBeGreaterThan(1300);
  expect(844 / wide.zoomX / (844 / narrow.zoomX)).toBeGreaterThan(1.35);
  expect(wide.zoomX).toBe(wide.zoomY);
  expect(wide.x - 844 / wide.zoomX / 2).toBeGreaterThanOrEqual(0);
  expect(wide.x + 844 / wide.zoomX / 2).toBeLessThanOrEqual(1600);
});

it("reveals the same decorative margin at both mobile court edges without zooming out", () => {
  for (const [w,h] of [[844,390],[932,430],[844,280]]) {
    const make = (y:number,bottom:number) => new FollowCamera().update(w,h,true,{...focus(800,y),vx:0,vy:0},"edge",16,false,96,1.2,bottom);
    const old = make(900,0),lower=make(900,96),upper=make(0,96);
    expect(lower.zoomX).toBe(old.zoomX);
    expect(lower.zoomY).toBe(old.zoomY);
    expect(lower.y+h/lower.zoomY/2).toBeCloseTo(996);
    expect(upper.y-h/upper.zoomY/2).toBeCloseTo(-96);
    expect(lower.y).toBeGreaterThan(old.y);
    const point=screenToWorld(w/2,h/2,w,h,lower);
    expect(point.y).toBe(lower.y);
  }
});
