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

it("does not move remote fighters backwards when an otherwise ordered packet arrives late", () => {
  const arena = new Arena("JITTER");
  const p = arena.add("remote", "Remote");
  const buffer = new InterpolationBuffer();
  const add = (time: number, received: number) => {
    arena.time = time;
    p.x = time * 1000;
    buffer.add(arena.snapshot(), received);
  };
  add(0, 1000);
  add(0.066, 1066);
  const before = buffer.sample("remote", 1219)!.x;
  add(0.133, 1220); // 87ms more arrival delay than the preceding frame
  const after = buffer.sample("remote", 1220)!.x;
  expect(after).toBeGreaterThanOrEqual(before);
  expect(after).toBeCloseTo(120);
});
it("keeps the playhead monotonic as the arrival window changes and resets it for another round", () => {
  const arena = new Arena("JITTER"),
    p = arena.add("remote", "Remote"),
    b = new InterpolationBuffer();
  let position = 0;
  for (let i = 0; i < 50; i++) {
    arena.time = i / 15;
    p.x = i * 10;
    const received = 1000 + (i * 1000) / 15 + (i > 12 ? 60 : 0) + (i % 3) * 10;
    b.add(arena.snapshot(), received);
    const next = b.sample("remote", received)!.x;
    expect(next).toBeGreaterThanOrEqual(position);
    position = next;
  }
  b.clear();
  arena.time = 0;
  p.x = 10;
  b.add(arena.snapshot(), 5000);
  expect(b.sample("remote", 5000)!.x).toBe(10);
});
