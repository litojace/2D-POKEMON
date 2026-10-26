import { expect, it } from "vitest";
import { groundRoadOutline } from "../src/town-ground-layout";
import { WORLD_ART } from "../../../packages/shared/src/world-art";
import { TOWN_PATHS, pathPoints } from "../../../packages/shared/src/town";

it("keeps roads on the fountain's ground plane in every direction", () => {
  const gy = WORLD_ART.groundY,
    width = 112;
  for (const angle of [0, Math.PI / 6, Math.PI / 2, Math.PI * 0.8]) {
    const end = [Math.cos(angle) * 500, Math.sin(angle) * 500 * gy] as const;
    const outline = groundRoadOutline([[0, 0], end], width);
    const along = outline.map(
      ([x, y]) => x * Math.cos(angle) + (y / gy) * Math.sin(angle),
    );
    const across = outline.map(
      ([x, y]) => -x * Math.sin(angle) + (y / gy) * Math.cos(angle),
    );
    expect(Math.min(...across)).toBeCloseTo(-width / 2);
    expect(Math.max(...across)).toBeCloseTo(width / 2);
    expect(Math.min(...along)).toBeCloseTo(-width / 2);
    expect(Math.max(...along)).toBeCloseTo(500 + width / 2);
  }
});

it("keeps all curved lane edges finite and both road ends enclosed", () => {
  const inside = (
    x: number,
    y: number,
    polygon: readonly (readonly number[])[],
  ) => {
    let hit = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i],
        b = polygon[j];
      if (
        a[1] > y !== b[1] > y &&
        x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
      )
        hit = !hit;
    }
    return hit;
  };
  for (const road of TOWN_PATHS) {
    const points = pathPoints(road),
      outline = groundRoadOutline(points, road.width);
    expect(outline.flat().every(Number.isFinite)).toBe(true);
    for (const [x, y] of points) expect(inside(x, y, outline)).toBe(true);
  }
});
