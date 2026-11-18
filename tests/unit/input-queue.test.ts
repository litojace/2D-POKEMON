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

it("catches up after a burst, a few inputs a tick at most", () => {
  const { a, me } = duel();
  for (let seq = 1; seq <= 7; seq++) a.enqueue(me, input(seq, { dx: 1 }));
  step(a);
  expect(me.ack).toBe(1 + INPUT_QUEUE.catchUp);
  step(a);
  step(a);
  // Down to the bounded depth: no standing queue left behind.
  expect(7 - me.ack).toBeLessThanOrEqual(INPUT_QUEUE.depth);
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
    (e) =>
      e.kind === "cast" && e.owner === "me" && e.abilityId === "spark-dart",
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
  // Then a few a tick, down to the bounded depth.
  for (let t = 0; t < 10; t++) {
    const before = me.ack;
    step(a);
    expect(me.ack - before).toBeLessThanOrEqual(1 + INPUT_QUEUE.catchUp);
  }
  expect(100 - me.ack).toBeLessThanOrEqual(INPUT_QUEUE.depth);
});

it("holds a tick nothing arrived for, then steps each late input on its own", () => {
  // Two duels walking, one input a tick, turning at t = 5: in one, Wi-Fi
  // holds three inputs (the turn among them) and delivers them with the
  // fourth.
  const steady = duel(),
    held = duel();
  const dir = (t: number) => (t < 5 ? { dx: 1 } : { dx: 0, dy: 1 });
  let seq = 0;
  for (let t = 0; t < 12; t++) {
    seq++;
    steady.a.enqueue(steady.me, input(seq, dir(t)));
    step(steady.a);
    if (t >= 4 && t < 7) {
      // Nothing arrived: the fighter waits where it is, and the server says
      // how many ticks wait.
      const x = held.me.x,
        y = held.me.y;
      step(held.a);
      expect(held.me.held).toBe(t - 3);
      expect(held.me.x).toBe(x);
      expect(held.me.y).toBe(y);
      continue;
    }
    if (t === 7)
      for (let s = seq - 3; s <= seq; s++)
        held.a.enqueue(held.me, input(s, dir(s - 1)));
    else held.a.enqueue(held.me, input(seq, dir(t)));
    step(held.a);
  }
  // Each late input took its own step, turn included: the same place as
  // the fighter whose inputs were on time (before 18 Nov 2026 it walked on
  // in the old direction during the hold and ended a step or more away).
  expect(held.me.ack).toBe(steady.me.ack);
  expect(held.me.x).toBeCloseTo(steady.me.x, 6);
  expect(held.me.y).toBeCloseTo(steady.me.y, 6);
  expect(held.me.held).toBeUndefined();
});

it("starts a dash pressed in a late input at its own step", () => {
  const steady = duel(),
    held = duel();
  const press = (seq: number) => input(seq, { dx: 1, dash: seq === 6 });
  let seq = 0;
  for (let t = 0; t < 15; t++) {
    seq++;
    steady.a.enqueue(steady.me, press(seq));
    step(steady.a);
    if (t >= 4 && t < 7) {
      step(held.a);
      continue;
    }
    if (t === 7)
      for (let s = seq - 3; s <= seq; s++) held.a.enqueue(held.me, press(s));
    else held.a.enqueue(held.me, press(seq));
    step(held.a);
  }
  expect(held.me.x).toBeCloseTo(steady.me.x, 6);
});

it("forgets what it owed after a pause (no inputs were made then)", () => {
  const { a, me } = duel();
  a.enqueue(me, input(1, { dx: 1 }));
  step(a);
  for (let t = 0; t < INPUT_QUEUE.staleTicks + 5; t++) step(a);
  expect(me.held).toBeUndefined();
  // The tab is back: its new inputs each take their own step.
  a.enqueue(me, input(2, { dx: 1 }));
  a.enqueue(me, input(3, { dx: 1 }));
  step(a);
  expect(me.ack).toBe(2);
});

it("keeps one step per input when the phone itself froze", () => {
  // The phone froze for 200 ms: the server held six ticks, but the
  // phone's input clock catches up at most 100 ms (three inputs).
  const { a, me } = duel();
  let seq = 0;
  for (let t = 0; t < 3; t++) {
    a.enqueue(me, input(++seq, { dx: 1 }));
    step(a);
  }
  for (let t = 0; t < 6; t++) step(a);
  expect(me.held).toBe(6);
  for (let t = 0; t < 3; t++) a.enqueue(me, input(++seq, { dx: 1 }));
  step(a);
  // Then one input a tick again: the rest of the debt can never be repaid,
  // so it is forgotten after a while...
  for (let t = 0; t < INPUT_QUEUE.unpaidTicks + 2; t++) {
    a.enqueue(me, input(++seq, { dx: 1 }));
    step(a);
  }
  expect(me.held).toBeUndefined();
  // ...and every input, all along, was one step (about 9 px), as the phone
  // predicts: none lost to the debt, none taken twice.
  const x = me.x;
  for (let t = 0; t < 5; t++) {
    a.enqueue(me, input(++seq, { dx: 1 }));
    step(a);
  }
  expect(me.ack).toBe(seq);
  const perStep = (me.x - x) / 5;
  expect(perStep).toBeGreaterThan(5);
  a.enqueue(me, input(++seq, { dx: 1 }));
  const before = me.x;
  step(a);
  expect(me.x - before).toBeCloseTo(perStep, 1);
});

it("never moves a fighter faster than a step a tick, however many inputs it sends", () => {
  const honest = duel(),
    flood = duel();
  let a = 0,
    b = 0,
    from = 0;
  // Walking down, clear of walls (without the credit, the flood walks three
  // times as far until the court's edge stops it).
  for (let t = 0; t < 20; t++) {
    if (t === 10) from = honest.me.y;
    honest.a.enqueue(honest.me, input(++a, { dy: 1 }));
    step(honest.a);
    for (let k = 0; k < 3; k++)
      flood.a.enqueue(flood.me, input(++b, { dy: 1 }));
    step(flood.a);
  }
  const stepPx = (honest.me.y - from) / 10;
  expect(stepPx).toBeGreaterThan(5);
  // At most the starting credit's few steps ahead, not three times as far.
  expect(flood.me.y - honest.me.y).toBeLessThanOrEqual(
    (INPUT_QUEUE.startCredit + 1) * stepPx,
  );
});

it("tallies each player's input queue over the match for its report", () => {
  const { a, me } = duel();
  expect(a.inputStats(me.id)).toBeUndefined();
  let seq = 0;
  for (let t = 0; t < 10; t++) {
    if (t >= 3 && t < 6) {
      step(a); // held
      continue;
    }
    if (t === 6)
      for (let k = 0; k < 4; k++) a.enqueue(me, input(++seq, { dx: 1 }));
    else a.enqueue(me, input(++seq, { dx: 1 }));
    step(a);
  }
  // A flood past the queue's cap folds inputs (steps lost).
  for (let k = 0; k < INPUT_QUEUE.cap + 3; k++)
    a.enqueue(me, input(++seq, { dx: 1 }));
  const stats = a.inputStats(me.id)!;
  expect(stats.heldTicks).toBe(3);
  expect(stats.lateSteps).toBe(3);
  expect(stats.folded).toBeGreaterThanOrEqual(3);
  expect(stats.queueAvg).toBeGreaterThan(0);
  // A new match starts a new tally.
  a.start();
  expect(a.inputStats(me.id)).toBeUndefined();
});
