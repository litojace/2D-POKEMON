import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import {
  CHARACTERS,
  RULES,
  currentObstacles,
  type Projectile,
} from "@arena/shared";
import {
  LEAD,
  LocalTimeline,
  ShotTimeline,
  leadProjectile,
} from "../../apps/client/src/networking/timeline-lead";

const shot = (over: Partial<Projectile> = {}): Projectile => ({
  id: 1,
  owner: "a",
  x: 300,
  y: 300,
  vx: 900,
  vy: 0,
  remaining: 600,
  ability: CHARACTERS.voltkit.basic,
  color: 0xffffff,
  ...over,
});

describe("shots on your timeline", () => {
  it("is where the server has the shot after the ticks you are ahead", () => {
    // A real shot from the real simulation: drawn `n` ticks ahead of a
    // snapshot, it is where the server puts it `n` ticks later.
    const arena = new Arena("LEAD");
    arena.add("one", "One", "voltkit");
    arena.add("two", "Two", "voltkit");
    arena.start();
    arena.phase = "playing";
    arena.deadline = 999;
    const [p, q] = arena.players;
    arena.walls();
    Object.assign(p, { x: 120, y: 120, angle: 0 });
    Object.assign(q, { x: 120, y: 600 });
    arena.cast(p, CHARACTERS.voltkit.basic);
    expect(arena.projectiles).toHaveLength(1);
    const snapshot = structuredClone(arena.projectiles[0]);
    let compared = 0;
    for (let n = 1; n <= 6; n++) {
      arena.tick();
      const real = arena.projectiles.find((pr) => pr.id === snapshot.id);
      if (!real) break;
      const drawn = leadProjectile(
        snapshot,
        n / RULES.tick,
        currentObstacles(),
      );
      expect(drawn.x).toBeCloseTo(real.x, 3);
      expect(drawn.y).toBeCloseTo(real.y, 3);
      compared++;
    }
    expect(compared).toBeGreaterThanOrEqual(3);
  });

  it("stops at cover and the court's edge, and never past its range", () => {
    const wall = { x: 400, y: 250, w: 40, h: 100 };
    const r = CHARACTERS.voltkit.basic.radius;
    expect(leadProjectile(shot(), 0.2, [wall]).x).toBeCloseTo(400 - r, 6);
    expect(leadProjectile(shot({ remaining: 50 }), 0.2, []).x).toBeCloseTo(
      350,
      6,
    );
    const edge = leadProjectile(shot({ x: RULES.width - 40 }), 0.2, []);
    expect(edge.x).toBeCloseTo(RULES.width - r, 6);
  });

  it("draws a boomerang where the snapshot had it, and slows in a bubble", () => {
    const boomerang = shot({
      ability: { ...CHARACTERS.voltkit.basic, boomerang: true },
    });
    expect(leadProjectile(boomerang, 0.2, [])).toBe(boomerang);
    expect(leadProjectile(shot(), 0.1, [], 0.5).x).toBeCloseTo(345, 6);
    expect(leadProjectile(shot(), 0, []).x).toBe(300);
  });

  it("puts your shots on the timeline at once and eases an opponent's in", () => {
    const shots = new ShotTimeline();
    const mine = shot({ id: 7 }),
      theirs = shot({ id: 8 });
    expect(shots.seconds(mine, true, 1000, 0.15, 0.02)).toBeCloseTo(0.15, 9);
    expect(shots.seconds(theirs, false, 1000, 0.15, 0.02)).toBeCloseTo(0.02, 9);
    const half = 1000 + (LEAD.easeIn * 1000) / 2;
    expect(shots.seconds(theirs, false, half, 0.15, 0.02)).toBeCloseTo(
      0.085,
      9,
    );
    expect(
      shots.seconds(theirs, false, 1000 + LEAD.easeIn * 1000, 0.15, 0.02),
    ).toBeCloseTo(0.15, 9);
    // A shot that is gone and comes back with the same id starts again.
    shots.keep([7]);
    expect(shots.seconds(theirs, false, 5000, 0.15, 0.02)).toBeCloseTo(0.02, 9);
  });
});

describe("LocalTimeline", () => {
  it("is the unanswered inputs plus the snapshot's age, running smoothly", () => {
    const t = new LocalTimeline();
    expect(t.lead(0)).toBe(0);
    t.snapshot(3, 1000);
    expect(t.lead(1000)).toBeCloseTo(3 / RULES.tick, 9);
    // Between snapshots it runs with the clock: no 15 Hz steps.
    let previous = t.lead(1000);
    for (let now = 1016; now <= 1064; now += 16) {
      const next = t.lead(now);
      expect(next - previous).toBeCloseTo(0.016, 6);
      previous = next;
    }
    expect(t.age(1064)).toBeCloseTo(0.064, 9);
  });

  it("eases onto a new snapshot's estimate instead of jumping", () => {
    const t = new LocalTimeline();
    t.snapshot(1, 0);
    t.lead(0);
    for (let now = 16; now <= 64; now += 16) t.lead(now);
    const before = t.lead(66);
    // Two more inputs went out since, and the next snapshot answered two:
    // two wait, one tick (1/30 s) less than the clock had run on to.
    t.snapshot(2, 66);
    const after = t.lead(82);
    expect(Math.abs(after - before - 0.016)).toBeLessThan(0.02);
    // ...and closes the gap (1/30 s here) within a couple of settle times.
    let now = 82;
    for (; now < 66 + LEAD.settle * 2000; now += 16) t.lead(now);
    const target = 2 / RULES.tick + (now - 66) / 1000;
    expect(target).toBeLessThan(LEAD.max);
    expect(Math.abs(t.lead(now) - target)).toBeLessThan(0.006);
  });

  it("never runs further ahead than its cap (a stall, not latency)", () => {
    const t = new LocalTimeline();
    t.snapshot(5, 0);
    t.lead(0);
    for (let now = 16; now <= 2000; now += 16) t.lead(now);
    expect(t.lead(2000)).toBeCloseTo(LEAD.max, 9);
    expect(t.age(2000)).toBe(LEAD.max);
    t.clear();
    expect(t.lead(3000)).toBe(0);
  });
});
