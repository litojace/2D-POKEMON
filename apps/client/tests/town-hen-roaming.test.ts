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

it("stands exactly where the full obstacle check says (the bucketed index changes nothing)", async () => {
  const { TOWN, TOWN_OBSTACLES } = await import("../../../packages/shared/src/town");
  const { WORLD_ART } = await import("../../../packages/shared/src/world-art");
  const reference = (x: number, y: number) => {
    const r = TOWN.radius;
    if (x < r || y < r + 40 || x > TOWN.width - r || y > TOWN.height - r) return false;
    for (const o of TOWN_OBSTACLES) {
      if (o.shape === "round") {
        const dx = (x - o.x) / (o.rx + r),
          dy = (y - o.y) / (o.ry + r * WORLD_ART.groundY);
        if (dx * dx + dy * dy < 1) return false;
      } else if (Math.abs(x - o.x) < o.w / 2 + r && Math.abs(y - o.y) < o.h / 2 + r * WORLD_ART.groundY) return false;
    }
    return true;
  };
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60000; i++) {
    const x = rand() * (TOWN.width + 40) - 20,
      y = rand() * (TOWN.height + 40) - 20;
    expect(henCanStand(x, y)).toBe(reference(x, y));
  }
  // Every obstacle's own edge, where rounding to a bucket would show first.
  for (const o of TOWN_OBSTACLES)
    for (let a = 0; a < 64; a++) {
      const w = o.shape === "round" ? o.rx + TOWN.radius : o.w / 2 + TOWN.radius,
        h = o.shape === "round" ? o.ry + TOWN.radius * WORLD_ART.groundY : o.h / 2 + TOWN.radius * WORLD_ART.groundY;
      for (const k of [0.999, 1.001]) {
        const x = o.x + Math.cos((a / 64) * Math.PI * 2) * w * k,
          y = o.y + Math.sin((a / 64) * Math.PI * 2) * h * k;
        expect(henCanStand(x, y)).toBe(reference(x, y));
      }
    }
});

it("plans a trip in a few milliseconds (it used to stall the town for a frame or more)", () => {
  planHenRoam(henRoamStart({ x: 650, y: 1100 }), 0.3, 0); // builds the shared graph once
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) planHenRoam(henRoamStart({ x: 1750, y: 1450 }), i + 0.1, i);
  expect((performance.now() - t0) / 20).toBeLessThan(8);
});
