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
      plazaStep(P, sent, FRAME / 1000);
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
