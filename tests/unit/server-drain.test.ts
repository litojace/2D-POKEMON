import { expect, it } from "vitest";
import {
  busyRoom,
  trackWrites,
  waitForDrain,
} from "../../apps/server/src/drain";

it("counts live matches as busy, but not lobbies, results or practice", () => {
  for (const phase of [
    "briefing",
    "countdown",
    "playing",
    "intermission",
    "paused",
  ])
    expect(busyRoom({ phase })).toBe(true);
  expect(busyRoom({ phase: "lobby" })).toBe(false);
  expect(busyRoom({ phase: "finished" })).toBe(false);
  expect(busyRoom({ phase: "playing", practice: {} })).toBe(false);
});

it("keeps each save the provider starts until it settles, success or not", async () => {
  const inflight = new Set<Promise<unknown>>();
  let finish!: () => void, fail!: (e: Error) => void;
  const provider = trackWrites(
    {
      label: "fake",
      save: () => new Promise<void>((r) => (finish = r)),
      broken: () => new Promise<void>((_r, j) => (fail = j)),
      plain: (n: number) => n * 2,
    },
    inflight,
  );
  expect(provider.label).toBe("fake");
  expect(provider.plain(2)).toBe(4);
  expect(inflight.size).toBe(0);
  const saved = provider.save();
  const broken = provider.broken();
  expect(inflight.size).toBe(2);
  finish();
  await saved;
  await Promise.resolve();
  expect(inflight.size).toBe(1);
  fail(Error("offline"));
  await expect(broken).rejects.toThrow("offline");
  await Promise.resolve();
  expect(inflight.size).toBe(0);
});

it("waits for busy rooms and saves, but never past the deadline", async () => {
  let now = 0,
    busy = 2;
  const inflight = new Set<Promise<unknown>>();
  const sleep = async (ms: number) => {
    now += ms;
    if (now >= 3000) busy = 0;
  };
  const done = await waitForDrain({
    busy: () => busy,
    inflight,
    deadline: 10000,
    now: () => now,
    sleep,
  });
  expect(done).toEqual({ finished: true, busy: 0, saving: 0 });
  expect(now).toBe(3000);

  busy = 1;
  inflight.add(new Promise(() => {}));
  const late = await waitForDrain({
    busy: () => busy,
    inflight,
    deadline: now + 2500,
    now: () => now,
    sleep: async (ms) => void (now += ms),
  });
  expect(late).toEqual({ finished: false, busy: 1, saving: 1 });
  expect(now).toBe(5500);
});
