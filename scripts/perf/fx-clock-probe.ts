/**
 * npx tsx scripts/perf/fx-clock-probe.ts
 * Replays Phaser 3.90's real TimeStep through the cosmetic engine. These are
 * deterministic clock/work counts, not measured phone FPS, GPU or latency.
 */
import { createRequire } from "node:module";
import { Fx } from "../../apps/client/src/fx-engine";
const require = createRequire(import.meta.url);
const TimeStep = require("phaser/src/core/TimeStep.js");

function replay(
  name: string,
  frameMs: number,
  focus: boolean,
  warmup: boolean,
) {
  const handlers = new Map<string, (...args: number[]) => void>();
  const object = (): any => new Proxy({}, { get: () => () => object() });
  const scene: any = {
    add: { graphics: object, image: object },
    textures: { exists: () => true },
    events: {
      on: (name: string, fn: any, ctx: any) => handlers.set(name, fn.bind(ctx)),
      off() {},
      once() {},
    },
    cameras: { main: { zoom: 1, shake() {} } },
    scale: { width: 1120, height: 518 },
  };
  const fx = new Fx(scene);
  fx.density = 0.35;
  fx.glowBudget = 0.75;
  const loop = new TimeStep({}, {});
  loop.inFocus = focus;
  loop._coolDown = warmup ? loop.panicMax : 0;
  loop.deltaHistory = Array(loop.deltaSmoothingMax).fill(1000 / 60);
  loop.lastTime = 0;
  let now = 0,
    animationMs = 0,
    nextBurst = 0;
  const particles: number[] = [];
  loop.callback = (time: number, delta: number) => {
    animationMs += delta;
    handlers.get("preupdate")!(time, delta);
    // Four bursts/s, regardless of the renderer's or animation clock's pace.
    while (time >= nextBurst) {
      nextBurst += 250;
      fx.burst({
        x: 0,
        y: 0,
        count: 100,
        kind: "spark",
        color: 0xffffff,
        speed: [10, 20],
        life: [1, 1],
        size: [1, 1],
      });
    }
    handlers.get("postupdate")!(time, delta);
    particles.push(fx.stats.particles);
  };
  while (now < 12_000) loop.step((now += frameMs));
  const sorted = particles.slice().sort((a, b) => a - b);
  return {
    name,
    realSeconds: +(now / 1000).toFixed(2),
    animationSeconds: +(animationMs / 1000).toFixed(2),
    frames: particles.length,
    particleP50: sorted[sorted.length >> 1],
    particleP95: sorted[Math.floor(sorted.length * 0.95)],
    peakParticles: Math.max(...particles),
  };
}
console.log(
  JSON.stringify(
    {
      note: "Synthetic Low VFX traces, not hardware measurements",
      traces: [
        replay("60 fps, settled/focused", 1000 / 60, true, false),
        replay("30 fps, boot/resume warm-up", 1000 / 30, true, true),
        replay("30 fps, blurred", 1000 / 30, false, false),
        replay("250 ms frames, boot warm-up", 250, true, true),
      ],
    },
    null,
    2,
  ),
);
