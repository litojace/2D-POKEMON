import { describe, expect, it } from "vitest";
import { PlazaWorld } from "../../apps/server/src/plaza";
import {
  PLAZA_PREDICT,
  PlazaPrediction,
} from "../../apps/client/src/plaza/plaza-predict";
import {
  PLAZA,
  PLAZA_HURDLES,
  plazaBody,
  plazaCollide,
  plazaDash,
  plazaJump,
  plazaStep,
  PLAZA_HURDLE_SEGMENTS,
  segmentDistance,
  trackPoint,
  trackPolar,
  type PlazaState,
} from "../../packages/shared/src/plaza";

const T0 = Date.parse("2026-11-02T21:16:00.000Z");
const profile = {
  name: "Me",
  title: null,
  titleColor: null,
  level: null,
  character: "voltkit",
  skin: null,
};
const STEP = 1000 / PLAZA.tick;

describe("timed Plaza inputs", () => {
  it("plays a stick and a dash as far apart as the browser sent them", () => {
    let real = 0;
    const world = new PlazaWorld(
      () => 0.5,
      () => T0 + real,
    );
    world.join("me", "acc", profile, T0);
    const b = world.bodyOf("me")!;
    // Open ground: nothing to bump into on the way.
    b.x = 600;
    b.y = 1300;
    // Once one message has come 130 ms late (the lead learns it) …
    const stepTo = (ms: number) => {
      while (real + STEP <= ms) {
        real += STEP;
        world.step(STEP / 1000, T0 + real);
      }
      real = ms;
    };
    stepTo(630);
    world.input("me", 0, 0, { s: 1, t: 500 });
    // … a stick sent at browser ms 1000 that takes 60 ms and a dash sent at
    // 1100 that takes 130 ms still play 100 ms apart.
    stepTo(1060);
    world.input("me", 1, 0, { s: 2, t: 1000 });
    stepTo(1230);
    world.dash("me", 1, 0, { s: 3, t: 1100 });
    stepTo(2000);
    // The browser: walk 100 ms, then dash, from the same spot.
    const local = plazaBody(600, 1300);
    plazaStep(local, { x: 1, y: 0 }, 0.1);
    plazaDash(local, { x: 1, y: 0 });
    // The server is `ack[1]` ms past the dash; walk the browser as far.
    const ack = world.view("me")!.state.ack!;
    expect(ack[0]).toBe(3);
    for (let left = ack[1] / 1000; left > 1e-9; left -= 1 / 60)
      plazaStep(local, { x: 1, y: 0 }, Math.min(1 / 60, left));
    expect(Math.abs(world.bodyOf("me")!.x - local.x)).toBeLessThan(1);
    expect(world.bodyOf("me")!.dashCd).toBeCloseTo(local.dashCd, 2);
  });
  it("doesn't hold inputs back when the server's ticks run late", () => {
    // A busy server: a tick every 80 ms, each still told 50 ms. Inputs
    // arrive 10 ms after they're sent.
    let real = 0;
    const world = new PlazaWorld(
      () => 0.5,
      () => T0 + real,
    );
    world.join("me", "acc", profile, T0);
    let next = 80;
    const until = (ms: number) => {
      for (; next <= ms; next += 80) {
        real = next;
        world.step(STEP / 1000, T0 + real);
      }
      real = ms;
    };
    for (let t = 0; t < 4000; t += 100) {
      until(t + 10);
      world.input("me", t % 200 ? 0.5 : 0.6, 0, { s: t / 100 + 1, t });
    }
    // Stop: the server stands you still within a tick of hearing it.
    until(4010);
    world.input("me", 0, 0, { s: 99, t: 4000 });
    until(4100);
    const x = world.bodyOf("me")!.x;
    until(4600);
    expect(world.bodyOf("me")!.x).toBe(x);
    expect((world as any).visitors.get("me").lead).toBeLessThan(T0 + 30);
  });
  it("still applies untimed input at once (older browsers, bots)", () => {
    const world = new PlazaWorld();
    world.join("me", "acc", profile, T0);
    world.input("me", 1, 0);
    expect(world.dash("me")).toBe(true);
    expect(world.bodyOf("me")!.dash).toBeGreaterThan(0);
  });
  it("doesn't let a stumbler off the hurdle by standing still", () => {
    // A step that doesn't move is a path of no length: still near the hurdle.
    expect(segmentDistance(5, 0, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(
      5,
    );
    const a = PLAZA_HURDLES[0],
      p = trackPoint(a),
      t = { x: -Math.sin(a), y: Math.cos(a) },
      b = plazaBody(p.x - t.x * 20, p.y - t.y * 20);
    for (let i = 0; i < 10; i++) plazaStep(b, t, 1 / 60);
    expect(b.stumbled).toBe(true);
    for (let i = 0; i < 60; i++) plazaStep(b, { x: 0, y: 0 }, 1 / 60);
    expect(b.stumbled).toBe(true);
  });
});

describe("hurdles agree between your screen and the server", () => {
  // Hurdle 0's line, and the way round the lane through it.
  const a = PLAZA_HURDLES[0],
    mid = trackPoint(a),
    along = { x: -Math.sin(a), y: Math.cos(a) };
  {
    const m = Math.hypot(along.x, along.y);
    along.x /= m;
    along.y /= m;
  }
  /**
   * A browser running at hurdle 0 from 150 px before it for 1.5 s, jumping
   * `jumpAt` ms in (or not), then stopping; the real PlazaWorld hears every
   * input 60 ms late except the jump, `jumpLate` ms late. Returns how far
   * apart they end up, and whether each tripped (the server: by the end).
   */
  const race = (jumpAt: number | null, jumpLate: number) => {
    let real = 0;
    const world = new PlazaWorld(
      () => 0.5,
      () => T0 + real,
    );
    world.join("me", "acc", profile, T0);
    const sb = world.bodyOf("me")!,
      start = { x: mid.x - along.x * 150, y: mid.y - along.y * 150 };
    sb.x = start.x;
    sb.y = start.y;
    const P = plazaBody(start.x, start.y);
    const inbox: { at: number; go: () => void }[] = [];
    let s = 0;
    // Browser ms 1000 + t, reaching the server `late` ms later (its clock).
    const post = (t: number, late: number, go: (timing: object) => void) => {
      const timing = { s: ++s, t: Math.round(1000 + t) };
      inbox.push({ at: timing.t + late, go: () => go(timing) });
      inbox.sort((p, q) => p.at - q.at);
    };
    // Learn the 60 ms lead standing still, then run.
    post(-500, 60, (tm) => world.input("me", 0, 0, tm));
    post(0, 60, (tm) => world.input("me", along.x, along.y, tm));
    let tripped = false;
    const FRAME = 1000 / 60;
    for (let i = 0; i < 90; i++) {
      const t = i * FRAME;
      if (jumpAt !== null && t >= jumpAt && t - FRAME < jumpAt) {
        plazaJump(P);
        post(t, jumpLate, (tm) => world.jump("me", tm));
      }
      if (plazaStep(P, along, FRAME / 1000).tripped) {
        tripped = true;
        const at = t + FRAME - (PLAZA.stunSeconds - P.stun) * 1000;
        post(at, 60, (tm) => world.trip("me", PLAZA.stunSeconds, tm));
      }
    }
    post(1500, 60, (tm) => world.input("me", 0, 0, tm));
    let stunned = 0;
    for (let ms = STEP; ms <= 3500; ms += STEP) {
      while (inbox[0] && inbox[0].at <= ms) {
        real = inbox[0].at;
        inbox.shift()!.go();
      }
      real = ms;
      world.step(STEP / 1000, T0 + ms);
      stunned = world.bodyOf("me")!.stumbled ? stunned + 1 : stunned;
    }
    const srv = world.bodyOf("me")!;
    // Tripped on the server: 0.45 s (108 px) short of an untripped run.
    return { apart: Math.hypot(srv.x - P.x, srv.y - P.y), tripped, P, srv };
  };
  it("a good jump the network held back still clears on the server", () => {
    // Jump ~45 px before the line: you clear it, and so does the server …
    const ok = race(440, 60);
    expect(ok.tripped).toBe(false);
    expect(ok.apart).toBeLessThan(2);
    // … even when the jump comes up to 380 ms late (played late, it took
    // off 40–80 px nearer the hurdle there and tripped the server's copy:
    // your screen ran on and was pulled back 100 px, the halt after a jump).
    for (const late of [150, 250, 380]) {
      const r = race(440, late);
      expect(r.tripped).toBe(false);
      expect(r.apart).toBeLessThan(2);
    }
  });
  it("trips the server where your screen trips", () => {
    // No jump, a jump too late, a jump too early.
    for (const jumpAt of [null, 560, 40]) {
      const r = race(jumpAt, 60);
      expect(r.tripped).toBe(true);
      expect(r.apart).toBeLessThan(2);
    }
  });
  it("a timed player who never jumps still trips on the server", () => {
    // A browser that doesn't report trips (or a cheat): the server trips
    // you on a hurdle you plainly didn't jump.
    let real = 0;
    const world = new PlazaWorld(
      () => 0.5,
      () => T0 + real,
    );
    world.join("me", "acc", profile, T0);
    const b = world.bodyOf("me")!;
    b.x = mid.x - along.x * 60;
    b.y = mid.y - along.y * 60;
    world.input("me", along.x, along.y, { s: 1, t: 0 });
    let stun = false;
    for (let ms = STEP; ms < 1000; ms += STEP) {
      real = ms;
      world.step(STEP / 1000, T0 + ms);
      if (b.stun > 0) stun = true;
    }
    expect(stun).toBe(true);
  });
  it("takes a reported trip only near a hurdle", () => {
    const [p0, p1] = PLAZA_HURDLE_SEGMENTS[1];
    const tripAt = (x: number, y: number, left: unknown) => {
      const world = new PlazaWorld(
        () => 0.5,
        () => T0,
      );
      world.join("me", "acc", profile, T0);
      const b = world.bodyOf("me")!;
      b.x = x;
      b.y = y;
      world.trip("me", left, { s: 1, t: 0 });
      world.step(STEP / 1000, T0 + STEP);
      return b.stun;
    };
    // 20 px off the hurdle's line: near, but not on it (that trips anyone).
    const n = Math.hypot(p1.x - p0.x, p1.y - p0.y),
      hx = (p0.x + p1.x) / 2 - ((p1.y - p0.y) / n) * 20,
      hy = (p0.y + p1.y) / 2 + ((p1.x - p0.x) / n) * 20;
    expect(tripAt(600, 1300, PLAZA.stunSeconds)).toBe(0);
    expect(tripAt(hx, hy, "lots")).toBe(0);
    const stun = tripAt(hx, hy, 99);
    expect(stun).toBeGreaterThan(0);
    expect(stun).toBeLessThanOrEqual(PLAZA.stunSeconds);
  });
  it("keeps the lead while you move, so inputs stay as far apart as sent", () => {
    // Running on open ground with a 60 ms lead, one stick comes 200 ms late;
    // the stick after it, on time, still plays 300 ms after it.
    let real = 0;
    const world = new PlazaWorld(
      () => 0.5,
      () => T0 + real,
    );
    world.join("me", "acc", profile, T0);
    const b = world.bodyOf("me")!;
    b.x = 600;
    b.y = 1300;
    const stepTo = (ms: number) => {
      while (real + STEP <= ms) {
        real += STEP;
        world.step(STEP / 1000, T0 + real);
      }
      real = ms;
    };
    stepTo(560);
    world.input("me", 0, 0, { s: 1, t: 500 });
    stepTo(1060);
    world.input("me", 1, 0, { s: 2, t: 1000 });
    stepTo(1500);
    world.input("me", 0, 1, { s: 3, t: 1300 });
    stepTo(1660);
    world.input("me", 0, 0, { s: 4, t: 1600 });
    stepTo(2500);
    // 300 ms right, 300 ms down, as the browser walked.
    const local = plazaBody(600, 1300);
    for (let i = 0; i < 18; i++) plazaStep(local, { x: 1, y: 0 }, 1 / 60);
    for (let i = 0; i < 18; i++) plazaStep(local, { x: 0, y: 1 }, 1 / 60);
    expect(Math.abs(b.x - local.x)).toBeLessThan(1);
    expect(Math.abs(b.y - local.y)).toBeLessThan(1);
  });
});

describe("a hurdle you are over is cleared", () => {
  const a = PLAZA_HURDLES[0],
    mid = trackPoint(a),
    along = { x: -Math.sin(a), y: Math.cos(a) };
  {
    const m = Math.hypot(along.x, along.y);
    along.x /= m;
    along.y /= m;
  }
  /** Run at the hurdle with the stick at `k`, jumping `D` px before its line. */
  const run = (k: number, D: number) => {
    const b = plazaBody(mid.x - along.x * 200, mid.y - along.y * 200);
    let jumped = false,
      at: { s: number; z: number } | null = null;
    for (let i = 0; i < 180 && !at; i++) {
      const s = (b.x - mid.x) * along.x + (b.y - mid.y) * along.y;
      if (!jumped && -s <= D) jumped = plazaJump(b);
      if (plazaStep(b, { x: along.x * k, y: along.y * k }, 1 / 60).tripped)
        at = { s: (b.x - mid.x) * along.x + (b.y - mid.y) * along.y, z: b.z };
    }
    return at;
  };
  it("never trips you once you are over its line (an early jump landing just past it)", () => {
    // A thumb on the stick (55%) jumping 65–75 px early, and a full stick
    // 130 px early: over the bar, then down below 16 px within 12 px past
    // it. That used to trip you there, hanging in the air for 0.45 s.
    for (const [k, D] of [
      [0.55, 65],
      [0.55, 70],
      [0.55, 75],
      [1, 130],
      [1, 135],
    ])
      expect(run(k, D), `stick ${k}, ${D} px`).toBeNull();
    // Every trip is on the way to the line.
    for (const k of [0.4, 0.55, 0.8, 1])
      for (let D = 0; D <= 200; D += 5) {
        const t = run(k, D);
        if (t) expect(t.s, `stick ${k}, ${D} px`).toBeLessThanOrEqual(0);
      }
  });
  it("a trip in the air falls to the ground instead of hanging there", () => {
    // Too late: still rising (7–13 px) when you reach the bar.
    const t = run(1, 25);
    expect(t).not.toBeNull();
    expect(t!.z).toBe(0);
    // Too early: coming down before the bar.
    const e = run(0.55, 90);
    expect(e).not.toBeNull();
    expect(e!.z).toBe(0);
  });
  it("standing on a hurdle's line doesn't trip you", () => {
    const b = plazaBody(mid.x, mid.y);
    for (let i = 0; i < 10; i++) plazaStep(b, { x: 0, y: 0 }, 1 / 60);
    expect(b.stumbled).toBe(false);
    expect(b.stun).toBe(0);
  });
});

describe("snapshots that miss a slow input", () => {
  it("aren't compared: the next one has the input", () => {
    const p = new PlazaPrediction();
    for (let t = 0; t <= 400; t += 16) p.record(t, t / 10, 0);
    const s1 = p.send(100),
      s2 = p.send(200);
    expect(s2).toBe(s1 + 1);
    // The server has played s1 for 200 ms, but not s2 (sent 100 ms after).
    const r = p.server({ x: 80, y: 0 }, [s1, 200], { x: 40, y: 0 });
    expect(r.stale).toBe(true);
    expect(p.ease(1)).toEqual({ x: 0, y: 0 });
    // With s2 played, it counts.
    const r2 = p.server({ x: 80, y: 0 }, [s2, 100], { x: 40, y: 0 });
    expect(r2.stale).toBeUndefined();
    expect(r2.err).toBeCloseTo(50, 0);
  });
});

describe("your walker against the server over a bumpy connection", () => {
  /**
   * Laps of the dash track, dashing every second and jumping now and then,
   * over a link of `oneWay` ± `jitter` ms (in order, as over a WebSocket):
   * the real PlazaWorld at 20 steps and 10 updates a second, the browser at
   * 60 frames with PlazaPrediction, as plaza-scene.ts wires them.
   */
  const run = (seconds: number, oneWay: number, jitter: number) => {
    let seed = 11;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    let real = 0;
    const world = new PlazaWorld(
      () => 0.5,
      () => T0 + real,
    );
    world.join("me", "acc", profile, T0);
    const start = trackPoint(-Math.PI / 2 - 0.3),
      sb = world.bodyOf("me")!;
    sb.x = start.x;
    sb.y = start.y;
    const P = plazaBody(start.x, start.y),
      predict = new PlazaPrediction();
    type Msg = { at: number; deliver: () => void };
    const up: Msg[] = [],
      down: Msg[] = [];
    let upLast = 0,
      downLast = 0;
    const send = (q: Msg[], last: number, now: number, deliver: () => void) => {
      const at = Math.max(last, now + oneWay + random() * jitter);
      q.push({ at, deliver });
      return at;
    };
    let srv: { x: number; y: number } | null = null,
      acked = false,
      sent = { x: 0, y: 0 },
      sentAt = -1e9,
      dashAt = 0,
      jumpAt = 0,
      nextStep = STEP,
      ticks = 0,
      clock = 0,
      snaps = 0,
      laps = 0;
    const errors: number[] = [];
    const FRAME = 1000 / 60;
    for (let t = 0; t < seconds * 1000; t += FRAME) {
      for (;;) {
        const next = Math.min(nextStep, up[0]?.at ?? Infinity);
        if (next > t) break;
        real = next;
        if (up[0] && up[0].at === next) {
          up.shift()!.deliver();
          continue;
        }
        for (const e of world.step(STEP / 1000, T0 + next))
          if (e.type === "lap") laps++;
        if (++ticks % 2 === 0) {
          const state: PlazaState = structuredClone(world.view("me")!.state);
          downLast = send(down, downLast, next, () => {
            const w = state.walkers.find((w) => w[0] === state.me)!;
            srv = { x: w[1], y: w[2] };
            acked = !!state.ack;
            const r = predict.server(srv, state.ack, P);
            if (t > 3000) errors.push(r.err);
            if (r.snap) {
              snaps++;
              predict.shift(srv.x - P.x, srv.y - P.y);
              P.x = srv.x;
              P.y = srv.y;
            }
          });
        }
        nextStep += STEP;
      }
      while (down[0] && down[0].at <= t) down.shift()!.deliver();
      const stamp = () => {
        const at = Math.round(clock);
        return { s: predict.send(at), t: at };
      };
      // Round the lane clockwise; dash every second; hop each hurdle.
      const { a } = trackPolar(P.x, P.y),
        aim = trackPoint(a + 0.35);
      let dx = aim.x - P.x,
        dy = aim.y - P.y;
      const m = Math.hypot(dx, dy);
      dx = Math.round((dx / m) * 100) / 100;
      dy = Math.round((dy / m) * 100) / 100;
      if (t - dashAt >= 1000 && plazaDash(P)) {
        dashAt = t;
        const timing = stamp(),
          d = { x: P.dashX, y: P.dashY };
        upLast = send(up, upLast, t, () => world.dash("me", d.x, d.y, timing));
      }
      const nearHurdle = PLAZA_HURDLES.some((h) => {
        const p = trackPoint(h);
        return Math.hypot(p.x - P.x, p.y - P.y) < 60;
      });
      if (nearHurdle && t - jumpAt > 700 && plazaJump(P)) {
        jumpAt = t;
        const timing = stamp();
        upLast = send(up, upLast, t, () => world.jump("me", timing));
      }
      if (
        ((dx !== sent.x || dy !== sent.y) && t - sentAt >= 50) ||
        t - sentAt >= 1000
      ) {
        const timing = stamp(),
          s = { x: dx, y: dy };
        upLast = send(up, upLast, t, () => world.input("me", s.x, s.y, timing));
        sent = s;
        sentAt = t;
      }
      if (plazaStep(P, sent, FRAME / 1000).tripped) {
        // As plaza-scene.ts: the trip goes to the server, at its moment.
        const at = Math.round(
            clock + FRAME - (PLAZA.stunSeconds - P.stun) * 1000,
          ),
          timing = { s: predict.send(at), t: at };
        upLast = send(up, upLast, t, () =>
          world.trip("me", PLAZA.stunSeconds, timing),
        );
      }
      clock += FRAME;
      if (acked) {
        const bx = P.x,
          by = P.y,
          c = predict.ease(FRAME / 1000);
        P.x += c.x;
        P.y += c.y;
        plazaCollide(P);
        predict.shift(P.x - bx, P.y - by);
      }
      predict.record(clock, P.x, P.y);
    }
    errors.sort((a, b) => a - b);
    return {
      snaps,
      laps,
      median: errors[errors.length >> 1],
      p99: errors[Math.floor(errors.length * 0.99)],
      worst: errors.at(-1)!,
    };
  };
  it("agrees with the server within a few px, dashing and hopping hurdles", () => {
    for (const [oneWay, jitter] of [
      [40, 20],
      [120, 80],
    ]) {
      const r = run(40, oneWay, jitter);
      if (process.env.SHOW) console.log(oneWay, jitter, JSON.stringify(r));
      expect(r.snaps).toBe(0);
      expect(r.laps).toBeGreaterThanOrEqual(5);
      // (The server sends whole pixels.)
      expect(r.median).toBeLessThan(2);
      expect(r.p99).toBeLessThan(PLAZA_PREDICT.deadZone * 3);
      expect(r.worst).toBeLessThan(40);
    }
  });
});
