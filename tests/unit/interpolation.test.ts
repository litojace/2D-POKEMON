import { it, expect } from "vitest";
import { InterpolationBuffer } from "../../apps/client/src/networking/interpolation";
import { Arena } from "../../apps/server/src/simulation";
it("interpolates remote movement on the server timeline and wraps facing angles", () => {
  const a = new Arena("ABC123");
  const p = a.add("one", "One");
  const b = new InterpolationBuffer();
  p.x = 100;
  p.angle = 3.1;
  a.time = 0;
  b.add(a.snapshot(), 1000);
  p.x = 200;
  p.angle = -3.1;
  a.time = 0.2;
  b.add(a.snapshot(), 1200);
  expect(b.sample("one", 1200)!.x).toBeCloseTo(150);
  expect(Math.abs(b.sample("one", 1200)!.angle)).toBeCloseTo(Math.PI);
  expect(b.sample("one", 2000)!.x).toBe(200);
});
it("bounds buffered snapshots and clears across round transitions", () => {
  const a = new Arena("ABC123");
  a.add("one", "One");
  const b = new InterpolationBuffer();
  for (let i = 0; i < 100; i++) {
    a.time = i / 15;
    b.add(a.snapshot(), (i * 1000) / 15);
  }
  expect(b.frames).toHaveLength(12);
  b.clear();
  expect(b.sample("one", 2000)).toBeUndefined();
});
