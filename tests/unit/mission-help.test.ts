import { describe, expect, it } from "vitest";
import { MISSIONS } from "../../packages/shared/src/shop";
import { CHARACTERS } from "@arena/shared";
import { missionFeatExamples, missionHelp } from "../../apps/client/src/mission-help";

describe("mission completion instructions", () => {
  it("covers every mission without falling back to generic advice", () => {
    for (const mission of MISSIONS) {
      expect(missionHelp(mission.id), mission.id).not.toMatch(/undefined|NaN|objective shown on this card/);
      expect(missionHelp(mission.id).length).toBeGreaterThan(60);
    }
    expect(missionHelp("future-mission")).toContain("objective shown on this card");
  });
  it("distinguishes bot-friendly matches from player-only wins", () => {
    expect(missionHelp("play-2")).toContain("Wins and losses count");
    expect(missionHelp("play-2")).toContain("at least 20 seconds");
    expect(missionHelp("pvp-wins-2")).toContain("room with no bots");
    expect(missionHelp("hard-bot")).toContain("Choose Hard");
    expect(missionHelp("hard-bot")).toContain("Easy and Normal bots do not count");
  });
  it("uses each champion mission's actual fighter choices", () => {
    for (const mission of MISSIONS.filter((m) => m.metric === "wins-with")) {
      for (const champion of mission.champions!) expect(missionHelp(mission.id)).toContain(CHARACTERS[champion].name);
      expect(missionHelp(mission.id)).toContain("Raid clears do not count");
    }
  });
  it("explains whole-team raid conditions and personal 2v2 conditions separately", () => {
    expect(missionHelp("raid-flawless")).toContain("without anyone in the party being downed");
    expect(missionHelp("teams-unharmed")).toContain("Your teammate may be knocked out");
    expect(missionHelp("raid-solo-p2")).toContain("Peril 1 clears do not count");
    expect(missionHelp("daily-1")).toContain("A regular raid against the same boss does not count");
  });
  it("explains casts, ultimates and time tracking without counting basic attacks or menus", () => {
    expect(missionHelp("skills-30")).toContain("Basic attacks do not count");
    expect(missionHelp("ults-3")).toContain("EX skills do not count");
    expect(missionHelp("minutes-30")).toContain("Whole minutes from each finished game");
    expect(missionHelp("minutes-30")).toContain("time in menus does not count");
  });
  it("lists the actual boss feat requirements from the reward catalog", () => {
    const examples = missionFeatExamples("feat-1");
    expect(examples).toHaveLength(3);
    expect(examples.some((text) => text.includes("Grumblecrag") && text.includes("pillar"))).toBe(true);
    expect(examples.some((text) => text.includes("Tidewyrm") && text.includes("4 times"))).toBe(true);
    expect(examples.some((text) => text.includes("Gloomshade") && text.includes("copy"))).toBe(true);
    expect(missionFeatExamples("raid-1")).toEqual([]);
  });
});
