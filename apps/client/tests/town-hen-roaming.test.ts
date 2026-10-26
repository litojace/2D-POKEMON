import { expect, it } from "vitest";
import { townCollide } from "../../../packages/shared/src/town";
import { createHenMotion, stepHen } from "../src/town-animal-motion";
import {
  henCanStand,
  henCanWalk,
  henRoamStart,
  planHenRoam,
} from "../src/town-hen-roaming";

it("plans distant trips from every chicken's starting district on dry reachable ground", () => {
  for (const [i, [x, y]] of [
    [650, 1100],
    [1000, 1420],
    [1750, 1450],
    [2350, 1750],
    [2800, 1200],
  ].entries()) {
    let p = henRoamStart({ x, y });
    const start = { ...p };
    const route = planHenRoam(p, i + 0.3, 0);
    expect(route.points.length).toBeGreaterThan(0);
    expect(
      Math.hypot(route.destination.x - start.x, route.destination.y - start.y),
    ).toBeGreaterThan(650);
    for (const target of route.points) {
      expect(henCanWalk(p, target)).toBe(true);
      const samples = Math.ceil(
        Math.hypot(target.x - p.x, target.y - p.y) / 12,
      );
      for (let k = 0; k <= samples; k++) {
        const x = p.x + ((target.x - p.x) * k) / samples,
          y = p.y + ((target.y - p.y) * k) / samples,
          actual = townCollide(x, y);
        expect(actual.x).toBeCloseTo(x, 6);
        expect(actual.y).toBeCloseTo(y, 6);
      }
      p = target;
    }
  }
});

it("lets chickens leave their starting area, finish trips and rest without clipping or teleporting", () => {
  const hens = [
    createHenMotion({ x: 650, y: 1100 }, 0.3, true),
    createHenMotion({ x: 2350, y: 1750 }, 2.4, true),
  ];
  for (const hen of hens) {
    const regions = new Set<string>(),
      poses = new Set<string>();
    let furthest = 0;
    for (let t = 0; t < 900; t += 0.08) {
      const before = { x: hen.x, y: hen.y },
        pose = stepHen(hen, 0.08);
      expect(henCanStand(hen.x, hen.y)).toBe(true);
      expect(Math.hypot(hen.x - before.x, hen.y - before.y)).toBeLessThan(2.5);
      furthest = Math.max(
        furthest,
        Math.hypot(hen.x - hen.home.x, hen.y - hen.home.y),
      );
      regions.add(`${Math.floor(hen.x / 800)},${Math.floor(hen.y / 600)}`);
      poses.add(pose.pose);
    }
    expect(furthest).toBeGreaterThan(800);
    expect(regions.size).toBeGreaterThan(5);
    expect(hen.roam!.trip).toBeGreaterThan(3);
    expect(poses.has("walk") && poses.has("peck") && poses.has("idle")).toBe(
      true,
    );
  }
});
