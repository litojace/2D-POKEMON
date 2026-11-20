/**
 * Why does your walker jerk back on the Plaza's dash track? Laps round the
 * track with a dash every second, over a modelled connection: the real
 * server (PlazaWorld, 20 steps and 10 updates a second), the browser's
 * sends (a changed stick at most every 50 ms), its own step at 60 frames a
 * second, and its correction toward the server. It counts the frames where
 * the correction moved you, and how far.
 *
 *   npx tsx scripts/perf/plaza-correction-sim.ts [seconds] [one-way ms] [jitter ms]
 *
 * OLD=1 uses the correction from before numbered inputs (the server's
 * position compared with where you are now) and untimed inputs (played
 * when they arrive). NO_HURDLES=1 takes the hurdles away (this runner
 * never jumps), NO_FOLK=1 the townsfolk and pitch bots.
 *
 * Measured 20 Nov 2026, 60 s of laps: at 100 ± 60 ms each way the old
 * correction snapped you back 164 px and eased you on 1037 frames; with
 * timed inputs, none and 11 (all in the first seconds, while the server
 * learns the connection's lag). At 200 ± 120 ms: 23 snaps of up to 182 px
 * before, none after.
 */
import { PlazaWorld } from "../../apps/server/src/plaza.js";
import { PlazaPrediction } from "../../apps/client/src/plaza/plaza-predict.js";
import {
  PLAZA,
  PLAZA_HURDLE_SEGMENTS,
  plazaBody,
  plazaCollide,
  plazaDash,
  plazaStep,
  trackPoint,
  trackPolar,
  type PlazaState,
} from "../../packages/shared/src/plaza.js";

const seconds = Number(process.argv[2] ?? 60),
  oneWay = Number(process.argv[3] ?? 60),
  jitter = Number(process.argv[4] ?? 30),
  OLD = !!process.env.OLD;

let seed = 7;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
/** An ordered link (as over a WebSocket): never overtakes. */
class Link<T> {
  private q: { at: number; v: T }[] = [];
  private last = 0;
  send(now: number, v: T) {
    this.last = Math.max(this.last, now + oneWay + random() * jitter);
    this.q.push({ at: this.last, v });
  }
  peek() {
    return this.q[0]?.at;
  }
  take(now: number) {
    const out: T[] = [];
    while (this.q.length && this.q[0].at <= now) out.push(this.q.shift()!.v);
    return out;
  }
}
type Up = {
  kind: "input" | "dash";
  dx: number;
  dy: number;
  s: number;
  t: number;
};

const T0 = Date.parse("2026-11-02T21:16:00.000Z");
/** The modelled real time (ms since the start). */
let clock = 0;
const world = new PlazaWorld(
  () => 0.5,
  () => T0 + clock,
);
world.join(
  "me",
  "acc",
  {
    name: "Me",
    title: null,
    titleColor: null,
    level: null,
    character: "voltkit",
    skin: null,
  },
  T0,
);
// NO_HURDLES=1: take the hurdles away (this runner never jumps).
if (process.env.NO_HURDLES) (PLAZA_HURDLE_SEGMENTS as unknown[]).length = 0;
// NO_FOLK=1: nobody else in the Plaza (no bumps the browser can't see).
if (process.env.NO_FOLK) {
  const c = (world as any).copies.get(1);
  c.folk.length = 0;
  c.bots.length = 0;
}
// Start on the lane, a little before the line.
const start = trackPoint(-Math.PI / 2 - 0.3);
const sb = world.bodyOf("me")!;
sb.x = start.x;
sb.y = start.y;
const P = plazaBody(start.x, start.y);
const up = new Link<Up>(),
  down = new Link<PlazaState>(),
  predict = new PlazaPrediction();

let srv: { x: number; y: number } | null = null,
  ack: [number, number] | undefined;
let sent = { x: 0, y: 0 },
  sentAt = -1e9,
  dashAt = 0,
  nextStep = 0,
  ticks = 0;
const moves: number[] = [];
let snaps = 0,
  laps = 0;
const FRAME = 1000 / 60;
for (let t = 0; t < seconds * 1000; t += FRAME) {
  // Server: what reaches it between steps, at the moment it arrives …
  for (;;) {
    const next = Math.min(nextStep, up.peek() ?? Infinity);
    if (next > t) break;
    clock = next;
    if (next === up.peek()) {
      for (const m of up.take(next)) {
        const timing = OLD ? { s: m.s } : { s: m.s, t: m.t };
        if (m.kind === "input") world.input("me", m.dx, m.dy, timing);
        else world.dash("me", m.dx, m.dy, timing);
      }
      continue;
    }
    // … and its steps.
    for (const e of world.step(1 / PLAZA.tick, T0 + nextStep))
      if (e.type === "lap") laps++;
    if (++ticks % 2 === 0) down.send(nextStep, world.view("me")!.state);
    nextStep += 1000 / PLAZA.tick;
  }
  clock = t;
  for (const s of down.take(t)) {
    const w = s.walkers.find((w) => w[0] === s.me)!;
    srv = { x: w[1], y: w[2] };
    ack = s.ack;
    if (!OLD) {
      const r = predict.server(srv, ack, P);
      if (r.snap) {
        snaps++;
        moves.push(Math.hypot(srv.x - P.x, srv.y - P.y));
        predict.shift(srv.x - P.x, srv.y - P.y);
        P.x = srv.x;
        P.y = srv.y;
      }
    }
  }
  // Browser: the stick runs clockwise along the lane's middle.
  const { a } = trackPolar(P.x, P.y),
    aim = trackPoint(a + 0.35);
  let dx = aim.x - P.x,
    dy = aim.y - P.y;
  const m = Math.hypot(dx, dy);
  dx /= m;
  dy /= m;
  if (t - dashAt >= 1000 && plazaDash(P)) {
    dashAt = t;
    const s = predict.send(t);
    up.send(t, {
      kind: "dash",
      dx: Math.round(P.dashX * 1000) / 1000,
      dy: Math.round(P.dashY * 1000) / 1000,
      s,
      t: Math.round(t),
    });
  }
  const rx = Math.round(dx * 100) / 100,
    ry = Math.round(dy * 100) / 100;
  if (
    ((rx !== sent.x || ry !== sent.y) && t - sentAt >= 50) ||
    t - sentAt >= 1000
  ) {
    up.send(t, {
      kind: "input",
      dx: rx,
      dy: ry,
      s: predict.send(t),
      t: Math.round(t),
    });
    sent = { x: rx, y: ry };
    sentAt = t;
  }
  // The browser walks with the stick it sent (the old one with the live one).
  plazaStep(P, OLD ? { x: dx, y: dy } : sent, FRAME / 1000);
  const ox = P.x,
    oy = P.y;
  if (OLD && srv) {
    // The correction before numbered inputs (plaza-scene.ts).
    const err = Math.hypot(srv.x - P.x, srv.y - P.y),
      dt = FRAME / 1000;
    if (err > 160) {
      snaps++;
      P.x = srv.x;
      P.y = srv.y;
    } else if (err > 100) {
      const k = 1 - Math.exp(-dt / 0.8);
      P.x += (srv.x - P.x) * k;
      P.y += (srv.y - P.y) * k;
    }
  } else if (!OLD) {
    const c = predict.ease(FRAME / 1000);
    P.x += c.x;
    P.y += c.y;
    plazaCollide(P);
    predict.shift(P.x - ox, P.y - oy);
    // The frame stepped from t to t + FRAME.
    predict.record(t + FRAME, P.x, P.y);
  }
  const d = Math.hypot(P.x - ox, P.y - oy);
  if (d > 0) moves.push(d);
}
const big = moves.filter((d) => d > 2);
console.log(
  JSON.stringify({
    mode: OLD ? "old" : "new",
    seconds,
    oneWay,
    jitter,
    laps,
    snaps,
    framesPulled: big.length,
    maxPull: Math.round(Math.max(0, ...moves)),
  }),
);
