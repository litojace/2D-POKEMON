import { expect, it } from "vitest";
import {
  battleCurves,
  curveSegments,
  roundedRectPoints,
} from "../../apps/client/src/battle-curves";

it("uses fewer vertices for tiny effects while preserving subpixel circle accuracy", () => {
  expect(curveSegments(2)).toBe(16);
  expect(curveSegments(30)).toBeLessThan(40);
  for (const radius of [0.5, 2, 5, 30, 100, 600, 1000]) {
    const n = curveSegments(radius);
    expect(radius * (1 - Math.cos(Math.PI / n))).toBeLessThan(0.181);
    expect(n % 4).toBe(0);
  }
});
it("keeps HP-bar corners inside their bounds, including slivers and empty health", () => {
  for (const width of [1, 3, 6, 30, 60]) {
    const points = roundedRectPoints(100, 200, width, 6, 3);
    expect(points.length).toBeLessThan(25); // formerly over 400 arc vertices per bar
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(100 - 1e-6);
      expect(point.x).toBeLessThanOrEqual(100 + width + 1e-6);
      expect(point.y).toBeGreaterThanOrEqual(200 - 1e-6);
      expect(point.y).toBeLessThanOrEqual(206 + 1e-6);
    }
  }
});
it("leaves Canvas and authored nonnumeric/concave corners unchanged", () => {
  const fallback: any = {
    scene: { sys: { game: { renderer: { type: 1 } } } },
    fillCircle: () => 1,
  };
  const original = fallback.fillCircle;
  expect(battleCurves(fallback).fillCircle).toBe(original);
  const calls: unknown[] = [],
    webgl: any = {
      scene: { sys: { game: { renderer: { type: 2 } } } },
      fillRoundedRect: (...args: unknown[]) => {
        calls.push(args);
        return webgl;
      },
    };
  battleCurves(webgl);
  webgl.fillRoundedRect(1, 2, 3, 4, { tl: -2, tr: 3 });
  webgl.fillRoundedRect(1, 2, 3, 4, -2);
  expect(calls).toEqual([
    [1, 2, 3, 4, { tl: -2, tr: 3 }],
    [1, 2, 3, 4, -2],
  ]);
});
