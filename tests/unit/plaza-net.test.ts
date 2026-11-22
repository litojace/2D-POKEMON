import { describe, expect, it } from "vitest";
import {
  BallPrediction,
  PLAZA_NET,
  ServerClock,
  SnapTrack,
  ballAhead,
} from "../../apps/client/src/plaza/plaza-net";
import { PlazaPrediction } from "../../apps/client/src/plaza/plaza-predict";
import {
  PLAZA,
  PLAZA_BALL,
  plazaBallStart,
  plazaBallStep,
  plazaBody,
  plazaStep,
} from "../../packages/shared/src/plaza";

describe("other walkers between snapshots", () => {
  it("are drawn between the two snapshots around the moment", () => {
    const t = new SnapTrack();
    t.push(1000, 0, 0);
    t.push(1100, 100, 50);
    expect(t.at(1050)).toEqual({ x: 50, y: 25, z: 0 });
    expect(t.at(900)).toMatchObject({ x: 0, y: 0 });
  });

  it("carry on along their way past the newest, but not forever", () => {
    const t = new SnapTrack();
    t.push(1000, 0, 0);
    t.push(1100, 24, 0);
    expect(t.at(1150)!.x).toBeCloseTo(36);
    const far = t.at(1100 + PLAZA_NET.extrapolate + 500)!.x;
    expect(far).toBeCloseTo(24 + (24 * PLAZA_NET.extrapolate) / 100);
  });

  it("ignore a snapshot older than the newest, and forget a teleport's path", () => {
    const t = new SnapTrack();
    t.push(1000, 0, 0);
    t.push(1100, 10, 0);
    t.push(1050, 999, 999);
    expect(t.newest).toMatchObject({ t: 1100, x: 10 });
    t.reset(1200, 500, 500);
    expect(t.at(1150)).toMatchObject({ x: 500, y: 500 });
  });
});

describe("the server's clock", () => {
  it("follows the least delayed snapshot, and waits longer on an uneven network", () => {
    const steady = new ServerClock(),
      uneven = new ServerClock();
    let rnd = 7;
    const r = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 60; i++) {
      const srv = 10_000 + i * 100;
      steady.sample(srv, i * 100 + 80);
      uneven.sample(srv, i * 100 + 60 + r() * 160);
    }
    // Server time ≈ local + (server - local) for the fastest arrival.
    expect(steady.now(6000)).toBeCloseTo(6000 + 10_000 - 80, 0);
    expect(steady.delay()).toBeLessThan(PLAZA_NET.delay + 5);
    expect(uneven.delay()).toBeGreaterThan(PLAZA_NET.delay + 80);
    expect(uneven.delay()).toBeLessThanOrEqual(PLAZA_NET.maxDelay);
  });
});

describe("the ball you kick", () => {
  const atRest = () => ({ ...plazaBallStart(), x: 2280, y: 900 });

  it("moves the same frame you reach it (no network trip)", () => {
    const bp = new BallPrediction(atRest());
    bp.server(atRest(), 0, 0);
    const me = plazaBody(2200, 900);
    let kickedAt = -1;
    for (let f = 0; f < 60 && kickedAt < 0; f++) {
      plazaStep(me, { x: 1, y: 0 }, 1 / 60);
      bp.step(me, 1 / 60, f * 16.7);
      if (bp.ball.vx > 0) kickedAt = f;
    }
    expect(kickedAt).toBeGreaterThan(0);
    // It went off ahead of you, never through you.
    expect(bp.ball.x - me.x).toBeGreaterThanOrEqual(
      PLAZA_BALL.radius + PLAZA.radius - 0.5,
    );
  });

  it("keeps your kick while the server can't have seen it yet, then follows the server", () => {
    const bp = new BallPrediction(atRest());
    bp.server(atRest(), 0, 0);
    const me = plazaBody(2245, 900);
    me.speed = 240;
    bp.step(me, 1 / 60, 1000); // touching: kicked
    const kicked = { ...bp.ball };
    expect(kicked.vx).toBeGreaterThan(0);
    // A snapshot from before the kick reached the server: ignored for now.
    bp.server(atRest(), 180, 1050);
    expect(bp.ball.vx).toBe(kicked.vx);
    // Much later the server still has it at rest (it never saw the kick):
    // the browser's ball eases back onto it.
    const far = plazaBody(1000, 900);
    bp.server(atRest(), 180, 2000);
    for (let i = 0; i < 90; i++) bp.step(far, 1 / 60, 2000 + i * 16.7);
    expect(Math.hypot(bp.ball.x - 2280, bp.ball.y - 900)).toBeLessThan(
      PLAZA_NET.ballDeadZone + 1,
    );
  });

  it("is run forward to now from the server's snapshot, by the same rules", () => {
    const srv = { ...atRest(), vx: 600, vy: 0 };
    const ahead = ballAhead(srv, 200);
    const b = { ...srv },
      last = {};
    for (let i = 0; i < 12; i++) plazaBallStep(b, [], 1 / 60, last);
    expect(ahead.x).toBeCloseTo(b.x, 3);
    expect(ahead.vx).toBeLessThan(600);
    // A big disagreement (someone else kicked it): straight to the server's.
    const bp = new BallPrediction(atRest());
    bp.server(atRest(), 0, 0);
    bp.server({ ...atRest(), x: 2560 }, 0, 5000);
    expect(bp.ball.x).toBe(2560);
  });

  it("waits on a goal for the server, and comes back with the server's restart", () => {
    const bp = new BallPrediction(atRest());
    bp.server(atRest(), 0, 0);
    bp.server({ ...atRest(), lock: 1 }, 100, 10);
    expect(bp.ball.lock).toBe(1);
    bp.server(atRest(), 100, 2000);
    expect(bp.ball.lock).toBe(0);
  });
});

describe("the lag between the server's snapshot and your timeline", () => {
  it("is the time since the acknowledged stick, less what the server has moved you with it", () => {
    const p = new PlazaPrediction();
    const s = p.send(1000);
    expect(p.lag([s, 50], 1200)).toBe(150);
    expect(p.lag([s + 9, 50], 1200)).toBeUndefined();
  });
});
