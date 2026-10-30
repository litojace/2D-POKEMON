import { describe, expect, it } from "vitest";
import { listedMissions, trackedMissions } from "../../apps/client/src/quest-tracker";

const m = (slot: number, progress: number, target: number) => ({
  day: "2026-10-30", slot, id: `m${slot}`, text: `Mission ${slot}`, tier: "easy" as const,
  progress, target, coins: 20, done: progress >= target,
});

describe("trackedMissions", () => {
  it("lists unfinished missions, closest to done first, then by slot", () => {
    const list = [m(0, 2, 2), m(1, 18, 30), m(2, 0, 1), m(3, 2, 3), m(4, 1, 2), m(5, 0, 1)];
    expect(trackedMissions(list as never, 3).map((x) => x.slot)).toEqual([3, 1, 4]);
    expect(trackedMissions(list as never, 10).map((x) => x.slot)).toEqual([3, 1, 4, 2, 5]);
  });
  it("is empty when every mission is done", () => {
    expect(trackedMissions([m(0, 1, 1), m(1, 3, 3)] as never, 3)).toEqual([]);
  });
  it("lists every mission when expanded: what's left first, then what's done", () => {
    const list = [m(0, 2, 2), m(1, 18, 30), m(2, 0, 1), m(3, 2, 3), m(4, 1, 2), m(5, 1, 1)];
    expect(listedMissions(list as never).map((x) => x.slot)).toEqual([3, 1, 4, 2, 0, 5]);
  });
});
