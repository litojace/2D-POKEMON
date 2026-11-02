import { expect, it } from "vitest";
import { Arena, INPUT_QUEUE } from "../../apps/server/src/simulation";
import { blankInput, type Input } from "../../packages/shared/src/index";

function duel() {
  const a = new Arena("QUEUE");
  const me = a.add("me", "Me", "voltkit");
  const foe = a.add("foe", "Foe", "cindrake");
  a.start();
  a.phase = "playing";
  a.deadline = 1e9;
  me.x = 400;
  foe.x = 1200;
  me.y = foe.y = 450;
  return { a, me, foe };
}
const input = (seq: number, extra: Partial<Input> = {}): Input => ({
  ...blankInput(),
  seq,
  aimX: 1200,
  aimY: 450,
  ...extra,
});
const step = (a: Arena) => {
  a.drainInputs();
  a.tick();
};

it("applies one network input per tick, so each ack is exactly one step", () => {
  const { a, me } = duel();
  // Two inputs land between ticks (ordinary jitter).
  a.enqueue(me, input(1, { dx: 1 }));
  a.enqueue(me, input(2, { dx: 1 }));
  step(a);
  expect(me.ack).toBe(1);
  step(a);
  expect(me.ack).toBe(2);
  // A duplicate or old packet is ignored.
  a.enqueue(me, input(2, { dx: -1 }));
  a.enqueue(me, input(1, { dx: -1 }));
  step(a);
  expect(me.ack).toBe(2);
  expect(me.lastInput.dx).toBe(1);
});

it("catches up after a burst, keeping no more than the bounded depth waiting", () => {
  const { a, me } = duel();
  for (let seq = 1; seq <= 7; seq++) a.enqueue(me, input(seq, { dx: 1 }));
  step(a);
  expect(me.ack).toBe(7 - INPUT_QUEUE.depth);
  step(a);
  step(a);
  expect(me.ack).toBe(7);
});

it("never loses a skill, dash or jump press merged out of a burst", () => {
  const { a, me } = duel();
  a.enqueue(me, input(1, { basic: true, skill: 0 }));
  a.enqueue(me, input(2, { basic: true, dash: true, dx: 1 }));
  a.enqueue(me, input(3, { basic: true, jump: true, dx: 1 }));
  for (let seq = 4; seq <= 6; seq++)
    a.enqueue(me, input(seq, { basic: true, dx: 1 }));
  const events = () => a.events.map((e) => e.kind);
  step(a);
  // All three presses reached the simulation in the catch-up tick.
  expect(events()).toContain("cast");
  expect(events()).toContain("dash");
  expect(events()).toContain("jump");
  expect(me.cooldowns[0]).toBeGreaterThan(a.time);
});

it("keeps Basic held while a skill is pressed through the queue", () => {
  const { a, me } = duel();
  let seq = 0;
  for (let t = 0; t < 40; t++) {
    a.enqueue(me, input(++seq, { basic: true, skill: t === 10 ? 1 : -1 }));
    step(a);
  }
  expect(me.stats.skills).toBe(1);
  // Basic kept firing before and after the skill.
  const basics = a.events.filter(
    (e) => e.kind === "cast" && e.owner === "me" && e.abilityId === "spark-dart",
  );
  expect(basics.length).toBeGreaterThan(3);
});

it("shortens a standing queue that never empties", () => {
  const { a, me } = duel();
  let seq = 0;
  // Two inputs every tick for a while: a standing queue would grow.
  for (let t = 0; t < 4 * INPUT_QUEUE.standingTicks; t++) {
    a.enqueue(me, input(++seq, { dx: 1 }));
    if (t % 2 === 0) a.enqueue(me, input(++seq, { dx: 1 }));
    step(a);
    expect(seq - me.ack).toBeLessThanOrEqual(INPUT_QUEUE.depth);
  }
});

it("stops a fighter whose inputs stop arriving (lost connection)", () => {
  const { a, me } = duel();
  a.enqueue(me, input(1, { dx: 1, basic: true }));
  step(a);
  for (let t = 0; t < INPUT_QUEUE.staleTicks + 10; t++) step(a);
  expect(me.lastInput.dx).toBe(0);
  const x = me.x;
  for (let t = 0; t < 30; t++) step(a);
  expect(me.x).toBeCloseTo(x, 0);
});

it("drops queued inputs between rounds and on reconnect", () => {
  const { a, me } = duel();
  a.enqueue(me, input(1, { skill: 0 }));
  a.enqueue(me, input(2, { skill: 1 }));
  a.clearInputQueue(me.id);
  step(a);
  expect(me.ack).toBe(0);
  expect(a.events.some((e) => e.kind === "cast")).toBe(false);
  a.enqueue(me, input(3, { dx: 1 }));
  a.phase = "intermission";
  a.drainInputs();
  a.phase = "playing";
  step(a);
  expect(me.ack).toBe(0);
});

it("bounds a flood: the queue never holds more than its cap", () => {
  const { a, me } = duel();
  for (let seq = 1; seq <= 100; seq++) a.enqueue(me, input(seq, { dx: 1 }));
  // Older inputs were applied as they overflowed (merged, latest wins).
  expect(me.ack).toBe(100 - INPUT_QUEUE.cap);
  step(a);
  expect(100 - me.ack).toBeLessThanOrEqual(INPUT_QUEUE.depth);
});
