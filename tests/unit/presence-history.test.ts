import { expect, it, vi } from "vitest";
import { PresenceHistory } from "../../apps/server/src/presence-history";

it("records the authenticated sighting and throttles repeated tabs/heartbeats per account", async () => {
  let now = Date.parse("2026-10-25T12:00:00Z");
  const rpc = vi.fn(async () => null);
  const history = new PresenceHistory({ rpc }, () => now);
  await history.touch("one", "token");
  expect(rpc).toHaveBeenCalledWith("token", "arena_touch_presence", {});
  now += 30000;
  await history.touch("one", "another-tab-token");
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(history.lastOnline("one")).toBe("2026-10-25T12:00:30.000Z");
  now += 30000;
  await history.touch("one", "fresh-token");
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(rpc.mock.calls.at(-1)?.[0]).toBe("fresh-token");
  expect(history.lastOnline("unknown")).toBeUndefined();
});

it("forces a final disconnect write and coalesces it behind an in-flight heartbeat", async () => {
  let release!: () => void;
  const wait = new Promise<void>((r) => (release = r));
  const rpc = vi.fn(async () => {
    if (rpc.mock.calls.length === 1) await wait;
  });
  let now = 100000;
  const history = new PresenceHistory({ rpc }, () => now);
  const first = history.touch("one", "initial-token");
  await Promise.resolve();
  now += 1000;
  const last = history.touch("one", "refreshed-token", true);
  now += 1000;
  history.touch("one", "refreshed-token", true);
  expect(rpc).toHaveBeenCalledTimes(1);
  release();
  await Promise.all([first, last, history.flush()]);
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(rpc.mock.calls[1]).toEqual([
    "refreshed-token",
    "arena_touch_presence",
    {},
  ]);
  expect(history.lastOnline("one")).toBe(new Date(now).toISOString());
});

it("keeps local history on database failure and retries later without blocking play", async () => {
  let now = 100000;
  const rpc = vi.fn(async () => {
    throw new Error("Database unavailable");
  });
  const history = new PresenceHistory({ rpc }, () => now);
  await expect(history.touch("one", "token")).resolves.toBeUndefined();
  await history.touch("one", "token");
  expect(rpc).toHaveBeenCalledTimes(1);
  now += 1000;
  await history.touch("one", "token", true);
  expect(rpc).toHaveBeenCalledTimes(2);
  await expect(history.flush()).resolves.toBeUndefined();
});

it("bounds the recent cache while keeping the newest sightings", async () => {
  const history = new PresenceHistory({ rpc: async () => null }, () => 100000);
  for (let i = 0; i < 5002; i++) await history.touch(String(i), "token");
  expect(history.lastOnline("0")).toBeUndefined();
  expect(history.lastOnline("5001")).toBeDefined();
});
