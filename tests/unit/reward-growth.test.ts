import { afterEach, expect, it, vi } from "vitest";
import {
  bossClears,
  frameStars,
  rewardBoss,
  type RaidProgress,
} from "../../packages/shared/src/raid";
import {
  noteSeenRewards,
  takeNewRewards,
} from "../../apps/client/src/reward-reveal";

afterEach(() => vi.unstubAllGlobals());

it("boss frames earn a star every 10 clears of their boss, up to 5", () => {
  expect(rewardBoss("conqueror")).toBe("grumblecrag");
  expect(frameStars("conqueror", { grumblecrag: 9 })).toBe(0);
  expect(frameStars("conqueror", { grumblecrag: 10 })).toBe(1);
  expect(frameStars("conqueror", { grumblecrag: 34 })).toBe(3);
  expect(frameStars("conqueror", { grumblecrag: 400 })).toBe(5);
  // Another boss's clears, a non-frame reward or a shop frame: no stars.
  expect(frameStars("conqueror", { tidewyrm: 50 })).toBe(0);
  expect(frameStars("mountain-aura", { grumblecrag: 50 })).toBe(0);
  expect(frameStars("not-a-reward", { grumblecrag: 50 })).toBe(0);
  expect(frameStars(null, { grumblecrag: 50 })).toBe(0);
});

it("reads clears per boss from saved progress, including old saves", () => {
  expect(
    bossClears({ clears: 3, bosses: { tidewyrm: { clears: 4 } } } as never),
  ).toEqual({ tidewyrm: 4 });
  expect(bossClears({ clears: 7 } as never)).toEqual({ grumblecrag: 7 });
  expect(bossClears(null)).toEqual({});
});

it("reveals only rewards earned since the account was last seen", () => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  });
  const progress = (earned: string[]) =>
    ({ earned, cosmetics: [] }) as unknown as RaidProgress;
  // First look at an account: nothing old floods in.
  expect(takeNewRewards("a", progress(["cragbreaker"]))).toEqual([]);
  expect(
    takeNewRewards("a", progress(["cragbreaker", "mountainborn"])).map(
      (r) => r.id,
    ),
  ).toEqual(["mountainborn"]);
  // Seen once, never again.
  expect(
    takeNewRewards("a", progress(["cragbreaker", "mountainborn"])),
  ).toEqual([]);
  // Signing in records without revealing.
  noteSeenRewards("b", progress(["conqueror"]));
  expect(takeNewRewards("b", progress(["conqueror"]))).toEqual([]);
  expect(takeNewRewards(undefined, progress(["conqueror"]))).toEqual([]);
});
