/**
 * Deterministic replay of real Phaser TimeStep vs the production input clock.
 * npx tsx scripts/perf/input-clock-comparison.ts
 * Models main-thread stalls, DOM delivery and timer jitter, not phone FPS or
 * measured network latency. Network timing is deliberately absent: these
 * percentiles stop at emit. Browser and real-socket regressions test wiring.
 */
import { createRequire } from "node:module";
import { BattleInputClock } from "../../apps/client/src/battle-input-clock";
import { RULES } from "../../packages/shared/src/index";
const require = createRequire(import.meta.url);
const TimeStep = require("phaser/src/core/TimeStep.js");
const SECONDS = 60;

export function compareInputClock(
  hitch: number,
  legacy: boolean,
  seed = 7,
  renderHz = 60,
) {
  let now = 0,
    random = seed,
    serial = 0;
  const tasks: {
    at: number;
    id: number;
    fn: () => void;
    cancelled?: boolean;
  }[] = [];
  const rand = () =>
    (random = (Math.imul(random, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const schedule = (fn: () => void, at: number) => {
    const task = { at, id: ++serial, fn };
    tasks.push(task);
    return task;
  };
  const sends: number[] = [],
    pressToSend: number[] = [],
    handlerToSend: number[] = [],
    eventToHandler: number[] = [];
  let press: { event: number; handler: number } | undefined;
  let accepted = 0;
  const send = () => {
    sends.push(now);
    if (press) {
      pressToSend.push(now - press.event);
      handlerToSend.push(now - press.handler);
      press = undefined;
    }
  };
  const clock = new BattleInputClock(send, () => true, RULES.tick, {
    now: () => now,
    setTimeout: (fn, ms) => schedule(fn, now + Math.max(1, ms) + rand() * 2),
    clearTimeout: (handle) => {
      (handle as (typeof tasks)[number]).cancelled = true;
    },
  });
  const loop = new TimeStep({}, {});
  loop.deltaHistory = Array(loop.deltaSmoothingMax).fill(1000 / 60);
  loop.lastTime = 0;
  let accumulator = 0;
  loop.callback = (_time: number, delta: number) => {
    accumulator += Math.min(delta, 100);
    while (accumulator >= 1000 / RULES.tick) {
      accumulator -= 1000 / RULES.tick;
      send();
    }
  };
  // A press every 317 ms, independent of frames and input phase. A press
  // inside a locked main thread retains its original DOM event timestamp.
  for (let at = 17; at < SECONDS * 1000 - 300; at += 317) {
    const event = at;
    schedule(() => {
      if (press) throw Error("Replay overwrote an unsent press");
      press = { event, handler: now };
      eventToHandler.push(now - event);
      accepted++;
    }, at);
  }
  const frame = () => {
    if (legacy) loop.step(now);
    schedule(frame, now + 1000 / renderHz);
  };
  schedule(frame, 1000 / renderHz);
  if (!legacy) clock.sync();
  while (tasks.length) {
    tasks.sort((a, b) => a.at - b.at || a.id - b.id);
    const task = tasks.shift()!;
    if (task.cancelled) continue;
    let at = Math.max(now, task.at);
    // Every 2 s the main thread is blocked. All callbacks, including DOM
    // handlers and timers, wait; no worker/interval gets a fictional escape.
    const block = Math.floor(at / 2000) * 2000;
    if (block > 0 && at < block + hitch) at = block + hitch;
    if (at > SECONDS * 1000) break;
    now = at;
    task.fn();
  }
  clock.stop();
  const stats = (v: number[]) => {
    const sorted = v.slice().sort((a, b) => a - b);
    const q = (f: number) =>
      +(
        sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))] ?? 0
      ).toFixed(2);
    return { p50: q(0.5), p95: q(0.95), p99: q(0.99), max: q(1) };
  };
  return {
    clock: legacy ? "Phaser accumulator" : "monotonic deadlines",
    hitchMs: hitch,
    renderHz,
    seconds: SECONDS,
    timerJitterMs: "0–2, seeded; minimum 1 ms",
    inputHz: +(sends.length / SECONDS).toFixed(3),
    inputs: sends.length,
    acceptedPresses: accepted,
    sentPresses: pressToSend.length,
    sendGapMs: stats(sends.slice(1).map((t, i) => t - sends[i])),
    pressToSendMs: stats(pressToSend),
    eventToHandlerMs: stats(eventToHandler),
    handlerToSendMs: stats(handlerToSend),
  };
}

if (process.argv[1]?.endsWith("input-clock-comparison.ts"))
  console.log(
    JSON.stringify(
      {
        note: "Clock/DOM/timer replay using Phaser's real TimeStep, 30 Hz. No rendering or network; RTT/confirm are not these measurements.",
        runs: [
          ...[0, 50, 150, 250].flatMap((hitch) =>
            [true, false].map((legacy) => compareInputClock(hitch, legacy)),
          ),
          ...[20, 5].flatMap((hz) =>
            [true, false].map((legacy) => compareInputClock(0, legacy, 7, hz)),
          ),
        ],
      },
      null,
      2,
    ),
  );
