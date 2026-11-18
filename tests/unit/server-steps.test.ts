import { expect, it } from "vitest";
import { newestStep, serverSteps } from "../../apps/client/src/predict-fighter";
import { blankInput, type Input } from "../../packages/shared/src/index";

const input = (seq: number, extra: Partial<Input> = {}): Input => ({
  ...blankInput(),
  seq,
  ...extra,
});

it("steps every pending input once, in order", () => {
  const pending = [1, 2, 3, 4, 5].map((s) => input(s));
  expect(serverSteps(pending).map((s) => [s.input.seq, s.tick])).toEqual([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [5, 5],
  ]);
});

it("dates the late inputs at the ticks the server held for them", () => {
  // The snapshot's tick and the one before it found none of your inputs:
  // the first two pending inputs step at those ticks (0 and -1), still one
  // step each, and the rest after the snapshot.
  const pending = [1, 2, 3, 4, 5].map((s) => input(s));
  expect(serverSteps(pending, 2).map((s) => [s.input.seq, s.tick])).toEqual([
    [1, -1],
    [2, 0],
    [3, 1],
    [4, 2],
    [5, 3],
  ]);
  expect(serverSteps([], 2)).toEqual([]);
});

it("predicts a new input at the tick the server will run it", () => {
  const pending: Input[] = [];
  const ticks: (number | undefined)[] = [];
  for (let s = 1; s <= 4; s++) {
    pending.push(input(s, { dash: s === 3 }));
    ticks.push(newestStep(pending, 2)?.tick);
  }
  // Every input is a step of its own (none folded away), dated as above.
  expect(ticks).toEqual([-1, 0, 1, 2]);
  expect(newestStep(pending.slice(0, 3), 2)?.input.dash).toBe(true);
  expect(newestStep(pending.slice(0, 1))).toMatchObject({ tick: 1 });
  expect(newestStep([])).toBeUndefined();
});
