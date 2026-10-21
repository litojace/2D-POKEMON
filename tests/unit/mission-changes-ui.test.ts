import { describe, expect, it } from "vitest";
import type { Economy } from "../../packages/shared/src/shop";
import {
  missionsBlock,
  missionsMarkup,
} from "../../apps/client/src/missions-ui";

const economy = (extra: Partial<Economy> = {}): Economy => ({
  balance: 2000,
  owned: [],
  picks: { day: "2026-10-21", items: [], deal: null },
  trialWins: {},
  awakening: {},
  looks: {},
  rerolled: false,
  rerollsUsed: 0,
  rerollLimit: 3,
  streak: 0,
  today: { raidClears: 0, pvpMatches: 0 },
  missions: [
    {
      day: "2026-10-21",
      slot: 0,
      id: "play-2",
      text: "Play 2 matches",
      tier: "easy",
      progress: 2,
      target: 2,
      coins: 40,
      done: true,
    },
    {
      day: "2026-10-21",
      slot: 1,
      id: "pvp-wins-2",
      text: "Win 2 matches against players",
      tier: "medium",
      progress: 0,
      target: 2,
      coins: 70,
      done: false,
    },
    {
      day: "2026-10-21",
      slot: 2,
      id: "raid-p3",
      text: "Clear any raid on Peril 3",
      tier: "hard",
      progress: 0,
      target: 1,
      coins: 120,
      done: false,
    },
  ],
  ...extra,
});

describe("daily mission changes", () => {
  it.each([0, 1, 2])(
    "keeps changes available with %i used, even with the legacy flag",
    (used) => {
      const e = economy({ rerollsUsed: used, rerolled: used > 0 });
      expect(missionsBlock(e).match(/data-mission-reroll/g)).toHaveLength(2);
      expect(missionsBlock(e)).not.toContain('data-mission-reroll="0"');
      expect(missionsMarkup(e)).toContain(
        `3 free mission changes per day · ${3 - used} remaining today`,
      );
      expect(missionsMarkup(e)).toContain(
        "Changing a mission resets its progress",
      );
      expect(missionsBlock(e, true)).not.toContain("data-mission-reroll");
    },
  );
  it("hides changes when all three are spent", () => {
    const e = economy({ rerollsUsed: 3, rerolled: true });
    expect(missionsBlock(e)).not.toContain("data-mission-reroll");
    expect(missionsMarkup(e)).toContain("0 remaining today");
    expect(missionsBlock(e)).toContain("Completed");
  });
  it("respects the old database allowance until migration 023 is applied", () => {
    for (const rerolled of [false, true]) {
      const e = economy({
        rerollLimit: undefined,
        rerollsUsed: undefined,
        rerolled,
      });
      expect(missionsMarkup(e)).toContain(
        `1 free mission change per day · ${rerolled ? 0 : 1} remaining today`,
      );
      expect(missionsBlock(e).includes("data-mission-reroll")).toBe(!rerolled);
    }
  });
});
