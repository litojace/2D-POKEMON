import { it, expect } from "vitest";
import {
  INTERPOLATION,
  InterpolationBuffer,
} from "../../apps/client/src/networking/interpolation";
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
  // It heads for the 120px target at a bounded speed rather than jumping.
  expect(after).toBeGreaterThan(115);
  expect(after).toBeLessThanOrEqual(120);
  // ...and settles on the newest frame (no velocity to extrapolate here).
  expect(buffer.sample("remote", 1300)!.x).toBeCloseTo(133, 0);
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

/** A remote fighter running right at 240 px/s, snapshots every 1/15 s. */
function stream(lateness: (i: number) => number, count = 90) {
  const arena = new Arena("ADAPT"),
    p = arena.add("remote", "Remote"),
    b = new InterpolationBuffer();
  const arrivals: number[] = [];
  for (let i = 0; i < count; i++) {
    arena.time = i / 15;
    p.x = 100 + 240 * arena.time;
    p.vx = 240;
    const received = Math.max(
      arrivals.at(-1) ?? 0,
      1000 + (i * 1000) / 15 + lateness(i),
    );
    arrivals.push(received);
    b.add(arena.snapshot(), received);
  }
  return { b, arrivals };
}
it("plays close to the minimum delay on a steady connection", () => {
  const { b } = stream(() => 3);
  expect(b.delay).toBeGreaterThanOrEqual(INTERPOLATION.min);
  expect(b.delay).toBeLessThan(0.09);
});
it("buys more delay on a jittery connection, never beyond the maximum", () => {
  let seed = 3;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const jittery = stream(() => random() * 90).b;
  expect(jittery.delay).toBeGreaterThan(0.12);
  expect(jittery.delay).toBeLessThanOrEqual(INTERPOLATION.max);
  const awful = stream((i) => (i % 5 === 0 ? 900 : 0)).b;
  expect(awful.delay).toBe(INTERPOLATION.max);
});
it("fast-forwards smoothly after a stall instead of teleporting", () => {
  const arena = new Arena("STALL"),
    p = arena.add("remote", "Remote"),
    b = new InterpolationBuffer();
  let now = 1000,
    last: number | undefined,
    biggest = 0;
  for (let frame = 0; frame < 240; frame++) {
    now += 1000 / 60;
    // Snapshots every 4 frames, except a 400 ms stall that then bursts.
    if (frame % 4 === 0 && !(frame > 60 && frame < 84)) {
      for (let t = Math.round((arena.time + 1 / 15) * 15); t <= frame / 4; t++) {
        arena.time = t / 15;
        p.x = 100 + 240 * arena.time;
        p.vx = 240;
        b.add(arena.snapshot(), now);
      }
    }
    const x = b.sample("remote", now)?.x;
    if (x === undefined) continue;
    if (last !== undefined) {
      expect(x).toBeGreaterThanOrEqual(last);
      biggest = Math.max(biggest, x - last);
    }
    last = x;
  }
  // 240 px/s is 4 px a frame; the catch-up stays within the 1.6× limit.
  expect(biggest).toBeLessThan(4 * INTERPOLATION.fastest + 0.5);
});
it("extrapolates a starved opponent only a short, bounded step", () => {
  const arena = new Arena("EXTRA"),
    p = arena.add("remote", "Remote"),
    b = new InterpolationBuffer();
  for (let i = 0; i < 3; i++) {
    arena.time = i / 15;
    p.x = 100 + 1200 * arena.time; // dashing
    p.vx = 1200;
    b.add(arena.snapshot(), 1000 + (i * 1000) / 15);
  }
  const newest = 100 + 1200 * (2 / 15);
  const far = b.sample("remote", 5000)!.x;
  expect(far).toBeGreaterThan(newest);
  expect(far - newest).toBeLessThanOrEqual(INTERPOLATION.extrapolateReach + 1e-9);
});
it("resumes from a backgrounded tab on the newest frames without rewinding", () => {
  const arena = new Arena("RESUME"),
    p = arena.add("remote", "Remote"),
    b = new InterpolationBuffer();
  const feed = (from: number, to: number, at: (i: number) => number) => {
    for (let i = from; i < to; i++) {
      arena.time = i / 15;
      p.x = 100 + i * 4;
      p.vx = 60;
      b.add(arena.snapshot(), at(i));
    }
  };
  feed(0, 30, (i) => 1000 + (i * 1000) / 15);
  const before = b.sample("remote", 3000)!.x;
  // Hidden for 20 s: nothing drawn; on return, queued snapshots burst in.
  feed(30, 330, () => 23000);
  const after = b.sample("remote", 23000)!.x;
  expect(after).toBeGreaterThan(before);
  // It jumps straight to the present (within the buffer), not replaying 20 s.
  expect(after).toBeGreaterThan(100 + 300 * 4);
  const next = b.sample("remote", 23017)!.x;
  expect(next).toBeGreaterThanOrEqual(after);
});
