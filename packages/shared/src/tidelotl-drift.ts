import { move, normalize, type Fighter, type Input } from "./index.js";
import { TIDEWYRM, type RaidTrait } from "./raid.js";

/**
 * Tidelotl moves raiders itself, every tick, before their own inputs move
 * them (RaidArena runs its attacks before Arena.tick): the Undertow draws
 * them in, and a Bubble Prison carries its prisoner to the boss's mouth.
 * The server (raid-tidewyrm.ts) and the phone's prediction
 * (predict-fighter.ts, stepRaidCarry) both step them here, so the phone
 * predicts what the server does. Before 26 Nov 2026 the phone left both
 * out: about 150 corrections a minute you saw as a shudder, in chapters 2
 * and 3 (network-performance.md section 22).
 */

/** How fast the Undertow draws raiders in (px/s); Rip Current pulls harder. */
export function undertowPull(trait: RaidTrait | undefined) {
  return trait === "rip-current"
    ? TIDEWYRM.undertow.ripPull
    : TIDEWYRM.undertow.pull;
}

/**
 * One tick of the Undertow on a raider: drawn toward its centre, walls
 * stopping them. Returns how far from the centre they were before it.
 */
export function pullIntoUndertow(
  p: Fighter,
  u: { x: number; y: number },
  pull: number,
  dt: number,
) {
  const dist = Math.hypot(u.x - p.x, u.y - p.y);
  if (dist > 4) {
    const d = normalize(u.x - p.x, u.y - p.y);
    move(p, d.x * Math.min(dist, pull * dt), d.y * Math.min(dist, pull * dt));
  }
  return dist;
}

/**
 * One tick of a Bubble Prison drifting to the boss's mouth, arriving as its
 * time runs out. `time` is the tick's start (the server's clock before the
 * tick moves it on).
 */
export function driftPrison(
  prison: { x: number; y: number; until: number },
  boss: { x: number; y: number },
  time: number,
  dt: number,
) {
  const left = Math.max(0.05, prison.until - time);
  const d = normalize(boss.x - prison.x, boss.y - prison.y),
    dist = Math.hypot(boss.x - prison.x, boss.y - prison.y);
  const step = Math.min(dist, (dist / left) * dt);
  prison.x += d.x * step;
  prison.y += d.y * step;
}

/**
 * What a rooted or sealed raider's input does this tick: no walking,
 * dashing or jumping, and, sealed in a prison, no attacks either (it pops
 * by its own presses, counted apart).
 */
export function heldInput(input: Input, sealed: boolean): Input {
  const held = { ...input, dx: 0, dy: 0, dash: false, jump: false };
  return sealed ? { ...held, basic: false, skill: -1 } : held;
}
