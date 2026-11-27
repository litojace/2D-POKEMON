import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import {
  CHARACTERS,
  RULES,
  currentObstacles,
  type Projectile,
} from "@arena/shared";
import {
  ImpactPrediction,
  LEAD,
  LocalTimeline,
  ShotTimeline,
  leadProjectile,
  zoneClock,
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

  it("stops on the first fighter it strikes, where the server's impact goes off", () => {
    // Player report (22 Nov 2026): your shot, drawn ahead of the server,
    // flew on through its target and the blast then went off behind it.
    const arena = new Arena("LEAD");
    arena.add("one", "One", "voltkit");
    arena.add("two", "Two", "voltkit");
    arena.start();
    arena.phase = "playing";
    arena.deadline = 999;
    const [p, q] = arena.players;
    arena.walls();
    Object.assign(p, { x: 120, y: 60, angle: 0 });
    Object.assign(q, { x: 420, y: 60 });
    arena.cast(p, CHARACTERS.voltkit.basic);
    const snapshot = structuredClone(arena.projectiles[0]);
    // Where it stood when struck (the hit knocks it back).
    const target = [{ x: q.x, y: q.y, r: RULES.radius }];
    let impact: { x: number; y: number } | undefined;
    for (let n = 0; n < 30 && !impact; n++) {
      arena.tick();
      impact = arena.events.find(
        (e) => e.kind === "impact" && e.owner === "one",
      );
    }
    expect(impact).toBeDefined();
    // Drawn well past the moment it struck: it waits on the target's edge.
    const drawn = leadProjectile(snapshot, 0.3, currentObstacles(), 1, target);
    expect(Math.abs(drawn.x - impact!.x)).toBeLessThan(10.5);
    expect(drawn.x).toBeLessThan(420 - RULES.radius);
    expect(drawn.y).toBeCloseTo(snapshot.y, 6);
    // Without targets it is drawn past the target's centre (the bug).
    expect(leadProjectile(snapshot, 0.3, currentObstacles()).x).toBeGreaterThan(
      420,
    );
  });

  it("strikes the nearest target first, and ignores them when it flies through", () => {
    const r = CHARACTERS.voltkit.basic.radius;
    const targets = [
      { x: 470, y: 300, r: 24 },
      { x: 420, y: 310, r: 24 },
      { x: 380, y: 500, r: 24 },
    ];
    const near = leadProjectile(shot(), 0.3, [], 1, targets);
    const reach = 24 + r;
    expect(Math.hypot(near.x - 420, near.y - 310)).toBeCloseTo(reach, 6);
    expect(near.remaining).toBeCloseTo(600 - (near.x - 300), 6);
    // Ball Lightning's aura shots fly through fighters.
    const aura = shot({ ability: { ...CHARACTERS.voltkit.basic, aura: true } });
    expect(leadProjectile(aura, 0.3, [], 1, targets).x).toBeCloseTo(570, 6);
    // Already touching one: it stays where the snapshot had it.
    expect(
      leadProjectile(shot(), 0.3, [], 1, [{ x: 310, y: 300, r: 24 }]).x,
    ).toBe(300);
    // A target off its line is no obstacle.
    expect(leadProjectile(shot(), 0.1, [], 1, [targets[2]]).x).toBeCloseTo(
      390,
      6,
    );
  });

  it("says which target it stopped on, so a steady one's blast can play at once", () => {
    const still = { x: 420, y: 300, r: 24, steady: true };
    const drawn = leadProjectile(shot(), 0.3, [], 1, [still]);
    expect(drawn.struck).toBe(still);
    expect(leadProjectile(shot(), 0.05, [], 1, [still]).struck).toBeUndefined();
    expect(leadProjectile(shot(), 0.3, []).struck).toBeUndefined();
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

  it("estimates the newest snapshot's lead without the easing (hit gaps)", () => {
    const t = new LocalTimeline();
    expect(t.estimate(0)).toBe(0);
    t.snapshot(5, 0);
    for (let now = 0; now <= 64; now += 16) t.lead(now);
    // The next snapshot: five unanswered again. The eased lead still holds
    // the 64 ms the clock ran on; the estimate is the snapshot's own.
    t.snapshot(5, 66);
    expect(t.estimate(66)).toBeCloseTo(5 / RULES.tick, 9);
    expect(t.lead(66) - t.estimate(66)).toBeGreaterThan(0.05);
    expect(t.estimate(82)).toBeCloseTo(5 / RULES.tick + 0.016, 9);
    t.snapshot(20, 100);
    expect(t.estimate(100)).toBe(LEAD.max);
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

describe("ImpactPrediction", () => {
  it("plays a shot's blast once, hides the shot a moment, and skips the server's echo", () => {
    const p = new ImpactPrediction();
    expect(p.predict(5, "spark-dart", 400, 300, 1000)).toBe(true);
    // Every later frame of the same shot: no second blast.
    expect(p.predict(5, "spark-dart", 401, 300, 1016)).toBe(false);
    expect(p.hidden(5, 1100)).toBe(true);
    expect(p.hidden(5, 1000 + ImpactPrediction.hold + 1)).toBe(false);
    // Another move's impact, or one far away, is not this blast.
    expect(p.confirm("glint", 400, 300, 1150)).toBe(false);
    expect(
      p.confirm("spark-dart", 400 + ImpactPrediction.reach + 5, 300, 1150),
    ).toBe(false);
    // The server's impact a round trip later: already played, skipped once.
    expect(p.confirm("spark-dart", 390, 305, 1180)).toBe(true);
    expect(p.confirm("spark-dart", 390, 305, 1190)).toBe(false);
  });

  it("forgets a blast the server never confirms (the shot missed after all)", () => {
    const p = new ImpactPrediction();
    p.predict(9, "glint", 200, 200, 0);
    expect(p.confirm("glint", 200, 200, ImpactPrediction.window + 10)).toBe(
      false,
    );
  });
});

describe("zoneClock", () => {
  it("counts an opponent's zone down on your timeline and any other on the snapshot's", () => {
    // Player report (23 Nov 2026): your own delayed blast went off about a
    // round trip before the damage it dealt showed up.
    expect(zoneClock(10, true, 0.18, 0.04)).toBeCloseTo(10.18, 9);
    expect(zoneClock(10, false, 0.18, 0.04)).toBeCloseTo(10.04, 9);
  });

  it("puts your zone's strike on the tick the server strikes", () => {
    // A real bolt-style zone from the server: it strikes once, `tickDelay`
    // after it is placed. Drawn on the snapshot's clock its ring runs out
    // at that same server time, so the blast and the server's hit (sent in
    // that tick's snapshot) arrive together.
    const arena = new Arena("ZONE");
    arena.add("one", "One", "voltkit");
    arena.add("two", "Two", "voltkit");
    arena.start();
    arena.phase = "playing";
    arena.deadline = 999;
    const [p, q] = arena.players;
    Object.assign(p, { x: 300, y: 300 });
    Object.assign(q, { x: 500, y: 300 });
    const delay = 0.3;
    const born = arena.time;
    arena.zones.push({
      id: ++arena.serial,
      owner: p.id,
      x: q.x,
      y: q.y,
      radius: 60,
      until: born + delay + 0.05,
      nextTick: born + delay,
      ability: {
        ...CHARACTERS.voltkit.basic,
        kind: "zone",
        damage: 5,
        duration: delay + 0.05,
        tickDelay: delay,
        tickInterval: 9,
      },
      color: 0xffffff,
      born,
    } as (typeof arena.zones)[number]);
    let struckAt: number | undefined;
    for (let n = 0; n < 30 && struckAt === undefined; n++) {
      arena.tick();
      if (arena.events.some((e) => e.kind === "hit" && e.target === q.id))
        struckAt = arena.time;
    }
    expect(struckAt).toBeDefined();
    // The server strikes on the first tick at or past the strike time.
    expect(struckAt! - (born + delay)).toBeGreaterThanOrEqual(-1e-9);
    expect(struckAt! - (born + delay)).toBeLessThan(1 / RULES.tick + 1e-9);
    // That tick's snapshot (time = struckAt) arrives with age 0: your zone's
    // clock reads struckAt, past the strike, the moment its hit arrives...
    expect(zoneClock(struckAt!, false, 0.2, 0)).toBeGreaterThanOrEqual(
      born + delay,
    );
    // ...while on your timeline its ring had run out `lead` earlier.
    const previousSnapshot = struckAt! - 2 / RULES.tick;
    expect(zoneClock(previousSnapshot, true, 0.2, 0)).toBeGreaterThan(
      born + delay,
    );
  });
});
