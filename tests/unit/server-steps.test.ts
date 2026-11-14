import { expect, it } from "vitest";
import {
  foldInputs,
  newestStep,
  serverSteps,
} from "../../apps/client/src/predict-fighter";
import { blankInput, type Input } from "../../packages/shared/src/index";

const input = (seq: number, extra: Partial<Input> = {}): Input => ({
  ...blankInput(),
  seq,
  ...extra,
});

it("folds inputs as the server merges them", () => {
  const f = foldInputs([
    input(1, { dx: 1, dash: true, skill: 2, ex: true }),
    input(2, { dx: 0, dy: 1, basic: true }),
    input(3, { dx: -1, aimX: 5 }),
  ]);
  expect(f).toMatchObject({
    seq: 3,
    dx: -1,
    dy: 0,
    aimX: 5,
    dash: true,
    basic: true,
    jump: false,
    skill: 2,
    ex: true,
  });
});

it("steps each pending input once, folding the ones the server owes", () => {
  const pending = [1, 2, 3, 4, 5].map((s) => input(s, { dx: 1 }));
  expect(serverSteps(pending).map((i) => i.seq)).toEqual([1, 2, 3, 4, 5]);
  // Two ticks ran the last input again: inputs 1-3 are one step.
  expect(serverSteps(pending, 2).map((i) => i.seq)).toEqual([3, 4, 5]);
  // Still on their way: none of them takes a step yet.
  expect(serverSteps(pending.slice(0, 2), 2)).toEqual([]);
});

it("predicts a new input at the tick the server will run it", () => {
  const pending: Input[] = [];
  const ticks: (number | undefined)[] = [];
  for (let s = 1; s <= 4; s++) {
    pending.push(input(s, { dx: 1, dash: s === 1 }));
    ticks.push(newestStep(pending, 2)?.tick);
  }
  expect(ticks).toEqual([undefined, undefined, 1, 2]);
  // The completing input carries the folded presses.
  expect(newestStep(pending.slice(0, 3), 2)?.input.dash).toBe(true);
  expect(newestStep(pending.slice(0, 1))).toMatchObject({ tick: 1 });
});
