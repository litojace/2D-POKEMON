import { describe, expect, it } from "vitest";
import {
  LapTimer,
  ORB_SHOWER,
  PLAZA,
  PLAZA_BUSHES,
  PLAZA_FOUNTAIN,
  PLAZA_GATE,
  PLAZA_HURDLES,
  PLAZA_PADS,
  PLAZA_PITCH,
  PLAZA_POND,
  PLAZA_ROCKS,
  PLAZA_SPAWN,
  PLAZA_SPOTS,
  PLAZA_TRACK,
  orbHeight,
  orbShower,
  plazaBallStart,
  plazaBallStep,
  plazaBody,
  plazaCollide,
  plazaDash,
  plazaJump,
  plazaStep,
  plazaStick,
  trackPoint,
} from "../../packages/shared/src/plaza";

const run = (
  b: ReturnType<typeof plazaBody>,
  dir: { x: number; y: number },
  seconds: number,
  dt = 1 / PLAZA.tick,
) => {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += dt)
    events.push(plazaStep(b, dir, dt));
  return events;
};

describe("Plaza layout", () => {
  it("scatters the approved 20 bushes and 7 rocks from the prototype's seed", () => {
    expect(PLAZA_BUSHES).toHaveLength(20);
    expect(PLAZA_ROCKS).toHaveLength(7);
    // Same generator, same first bush as the prototype.
    expect(PLAZA_BUSHES[0].kind).toBe("flower");
    for (const b of [...PLAZA_BUSHES, ...PLAZA_ROCKS]) {
      expect(b.x).toBeGreaterThan(40);
      expect(b.x).toBeLessThan(PLAZA.width - 40);
    }
  });

  it("keeps bodies out of the fountain and the pond and inside the map", () => {
    const f = plazaCollide({ x: PLAZA_FOUNTAIN.x + 1, y: PLAZA_FOUNTAIN.y });
    expect(
      Math.hypot(f.x - PLAZA_FOUNTAIN.x, f.y - PLAZA_FOUNTAIN.y),
    ).toBeGreaterThan(100);
    const p = plazaCollide({ x: PLAZA_POND.x + 5, y: PLAZA_POND.y + 5 });
    expect(
      ((p.x - PLAZA_POND.x) / PLAZA_POND.rx) ** 2 +
        ((p.y - PLAZA_POND.y) / PLAZA_POND.ry) ** 2,
    ).toBeGreaterThanOrEqual(0.999);
    expect(plazaCollide({ x: -500, y: -500 })).toEqual({ x: 30, y: 110 });
    // Only the gate opens south.
    expect(plazaCollide({ x: 400, y: 1690 }).y).toBe(PLAZA_GATE.y);
    expect(plazaCollide({ x: PLAZA_GATE.x, y: 1690 }).y).toBe(
      PLAZA_GATE.y + 30,
    );
  });

  it("can walk from the spawn to every spot", () => {
    const cell = 20,
      cols = Math.ceil(PLAZA.width / cell),
      rows = Math.ceil(PLAZA.height / cell),
      free = (c: number, r: number) => {
        const x = c * cell + cell / 2,
          y = r * cell + cell / 2,
          q = plazaCollide({ x, y });
        return Math.hypot(q.x - x, q.y - y) < 0.5;
      };
    const seen = new Uint8Array(cols * rows),
      start = [
        Math.floor(PLAZA_SPAWN.x / cell),
        Math.floor(PLAZA_SPAWN.y / cell),
      ];
    expect(free(start[0], start[1])).toBe(true);
    const queue = [start];
    seen[start[1] * cols + start[0]] = 1;
    while (queue.length) {
      const [c, r] = queue.pop()!;
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nc = c + dc,
          nr = r + dr;
        if (
          nc < 0 ||
          nr < 0 ||
          nc >= cols ||
          nr >= rows ||
          seen[nr * cols + nc]
        )
          continue;
        if (!free(nc, nr)) continue;
        seen[nr * cols + nc] = 1;
        queue.push([nc, nr]);
      }
    }
    for (const s of PLAZA_SPOTS) {
      let reachable = false;
      for (let r = 0; r < rows && !reachable; r++)
        for (let c = 0; c < cols; c++)
          if (
            seen[r * cols + c] &&
            Math.hypot(c * cell + cell / 2 - s.x, r * cell + cell / 2 - s.y) <
              s.r - 10
          ) {
            reachable = true;
            break;
          }
      expect(reachable, s.id).toBe(true);
    }
  });
});

describe("Plaza movement", () => {
  it("walks at 240 px/s, faster with Volt Boba, and cleans the stick", () => {
    const b = plazaBody(600, 1300);
    run(b, { x: 1, y: 0 }, 1);
    expect(b.x - 600).toBeCloseTo(240, 0);
    b.boost = PLAZA.boba.seconds;
    const x0 = b.x;
    run(b, { x: 1, y: 0 }, 0.5);
    expect(b.x - x0).toBeCloseTo(240 * 1.3 * 0.5, 0);
    expect(plazaStick(5, 0)).toEqual({ x: 1, y: 0 });
    expect(plazaStick(NaN, "x")).toEqual({ x: 0, y: 0 });
  });

  it("dashes 680 px/s for 0.18 s once per 0.9 s, and jumps 42 px", () => {
    const b = plazaBody(600, 1300);
    run(b, { x: 1, y: 0 }, 0.1);
    const x0 = b.x;
    expect(plazaDash(b)).toBe(true);
    expect(plazaDash(b)).toBe(false);
    run(b, { x: 0, y: 0 }, 0.2, 0.01);
    expect(b.x - x0).toBeCloseTo(680 * 0.18, -1);
    run(b, { x: 0, y: 0 }, 0.7, 0.01);
    expect(plazaDash(b)).toBe(true);
    const j = plazaBody(600, 1300);
    expect(plazaJump(j)).toBe(true);
    run(j, { x: 0, y: 0 }, 0.325, 0.005);
    expect(j.z).toBeCloseTo(42, 0);
    const landed = run(j, { x: 0, y: 0 }, 0.4, 0.005);
    expect(j.z).toBe(0);
    expect(landed.some((e) => e.landed)).toBe(true);
  });

  it("throws you high from a bounce pad", () => {
    const [x, y] = PLAZA_PADS[0];
    const b = plazaBody(x - 60, y);
    const events = run(b, { x: 1, y: 0 }, 0.3);
    expect(events.some((e) => e.bounced === 0)).toBe(true);
    let top = 0;
    for (let t = 0; t < 1.2; t += 0.01) {
      plazaStep(b, { x: 0, y: 0 }, 0.01);
      top = Math.max(top, b.z);
    }
    expect(top).toBeGreaterThan(150);
  });

  it("trips over a hurdle you walk into, not one you jump", () => {
    const p = trackPoint(PLAZA_HURDLES[0], 0.5),
      before = trackPoint(PLAZA_HURDLES[0] - 0.12, 0.5),
      dir = {
        x: (p.x - before.x) / Math.hypot(p.x - before.x, p.y - before.y),
        y: (p.y - before.y) / Math.hypot(p.x - before.x, p.y - before.y),
      };
    const walker = plazaBody(before.x, before.y);
    expect(run(walker, dir, 1).some((e) => e.tripped)).toBe(true);
    const jumper = plazaBody(before.x, before.y);
    const d = Math.hypot(p.x - before.x, p.y - before.y);
    // Jump so the top of the arc is over the hurdle.
    run(jumper, dir, Math.max(0, d / PLAZA.speed - 0.325));
    plazaJump(jumper);
    expect(run(jumper, dir, 0.8).some((e) => e.tripped)).toBe(false);
  });
});

describe("the dash track lap timer", () => {
  const lap = (
    speed: number,
    from = -Math.PI / 2 - 0.2,
    turns = 1.05,
    dt = 0.05,
  ) => {
    const timer = new LapTimer(),
      results = [];
    const total = Math.PI * 2 * turns,
      steps = Math.ceil(total / (speed * dt));
    for (let i = 0; i <= steps; i++) {
      const p = trackPoint(from + Math.min(total, i * speed * dt), 0.5);
      results.push(timer.update(p.x, p.y, i * dt * 1000));
    }
    return results;
  };
  it("times a clockwise lap from the start line", () => {
    const results = lap(0.8);
    expect(
      results.filter((r) => r.started && r.lapMs === undefined),
    ).toHaveLength(1);
    const done = results.find((r) => r.lapMs !== undefined)!;
    expect(done.lapMs! / 1000).toBeCloseTo((Math.PI * 2) / 0.8, 0);
  });
  it("doesn't miss the line at dash speed or count anticlockwise laps", () => {
    expect(
      lap(3, -Math.PI / 2 - 0.3, 1.1).some((r) => r.lapMs !== undefined),
    ).toBe(true);
    expect(
      lap(-0.8, -Math.PI / 2 + 0.2).some(
        (r) => r.started || r.lapMs !== undefined,
      ),
    ).toBe(false);
  });
  it("cancels a lap when you leave the lane", () => {
    const timer = new LapTimer();
    let t = 0;
    for (let a = -Math.PI / 2 - 0.2; a < 0; a += 0.04) {
      const p = trackPoint(a);
      timer.update(p.x, p.y, (t += 50));
    }
    expect(timer.running).toBe(true);
    expect(timer.update(PLAZA_TRACK.cx, PLAZA_TRACK.cy, (t += 50))).toEqual({
      cancelled: true,
    });
    expect(timer.running).toBe(false);
  });
});

describe("Orb Shower and Orb Ball", () => {
  it("runs the first minute of every UTC quarter hour", () => {
    const at = (iso: string) => orbShower(Date.parse(iso));
    expect(at("2026-11-02T21:15:00.000Z")).toMatchObject({
      on: true,
      key: String(Date.parse("2026-11-02T21:15:00.000Z") / 60_000),
    });
    expect(at("2026-11-02T21:15:59.999Z").on).toBe(true);
    expect(at("2026-11-02T21:16:00.000Z")).toMatchObject({
      on: false,
      startsAt: Date.parse("2026-11-02T21:30:00.000Z"),
    });
    expect(at("2026-11-02T21:59:30.000Z").startsAt).toBe(
      Date.parse("2026-11-02T22:00:00.000Z"),
    );
    expect(orbHeight(0)).toBe(ORB_SHOWER.height);
    expect(orbHeight(2000)).toBe(0);
  });
  it("scores when the ball crosses a goal mouth and names the last touch", () => {
    const ball = plazaBallStart(),
      kicker = plazaBody(ball.x - 38, ball.y),
      last: { key?: string } = {};
    kicker.dash = 0.18;
    let goal: ReturnType<typeof plazaBallStep<string>> = {};
    for (let t = 0; t < 5 && goal.goal === undefined; t += 0.05) {
      goal = plazaBallStep(ball, [{ key: "me", body: kicker }], 0.05, last);
      kicker.x = -999; // touch once
    }
    expect(goal).toEqual({ goal: 0, scorer: "me" });
    expect(ball.x).toBeGreaterThan(PLAZA_PITCH.x1);
    for (let t = 0; t < 2; t += 0.05) plazaBallStep(ball, [], 0.05, last);
    expect(ball).toMatchObject(plazaBallStart());
  });
});
