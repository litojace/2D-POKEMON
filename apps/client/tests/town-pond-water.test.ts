import { expect, it } from "vitest";
import { TOWN_POND as p } from "../../../packages/shared/src/town";
import { pondFishPose } from "../src/town-pond-water";
it("keeps swimming fish inside the pond and still in reduced motion", () => {
  for (let i = 0; i < 3; i++)
    for (let t = 0; t < 100; t += 0.7) {
      const f = pondFishPose(t, i);
      expect(Math.hypot((f.x - p.x) / p.rx, (f.y - p.y) / p.ry)).toBeLessThan(
        0.6,
      );
      expect(Number.isFinite(f.angle)).toBe(true);
    }
  expect(pondFishPose(1, 0)).not.toEqual(pondFishPose(2, 0));
  expect(pondFishPose(1, 1, true)).toEqual(pondFishPose(10, 1, true));
});

it("lets ducks feed independently while keeping still-mode poses calm", async () => {
  const { pondDuckPose } = await import("../src/town-pond-water");
  const ducks = Array.from({ length: 3 }, (_, i) => ({
    a: (i / 3) * Math.PI * 2,
    speed: 0.12 + i * 0.03,
    r: 0.55 + i * 0.12,
  }));
  for (let t = 0; t < 100; t += 0.5) {
    const poses = ducks.map((d) => pondDuckPose(d, t));
    expect(poses.every((p) => p.dabble)).toBe(false);
    for (const f of poses)
      expect(Math.hypot((f.x - p.x) / p.rx, (f.y - p.y) / p.ry)).toBeLessThan(
        0.8,
      );
  }
  expect(pondDuckPose(ducks[1], 1, true)).toEqual(
    pondDuckPose(ducks[1], 10, true),
  );
  expect(pondDuckPose(ducks[1], 1, true).dabble).toBe(false);
});
