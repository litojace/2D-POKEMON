import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import { BotBrain, chooseRite, riteValue } from "../../apps/server/src/bot";
import { FIGHTER_IDS, RITES, RITE_BY_ID, kitOf } from "@arena/shared";

const seeded = (seed = 11) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const ofFighter = (f: string) => RITES.filter((r) => r.fighter === f);

describe("bot rite choice", () => {
  it("Easy picks any card evenly; Normal leans towards majors", () => {
    const offer = [
      "auralynx-stunning-nova",
      "auralynx-hard-jab",
      "auralynx-long-palm",
    ];
    const me = { character: "auralynx" as const, rites: [] };
    const count = (difficulty: "easy" | "normal") => {
      const random = seeded();
      let majors = 0;
      for (let i = 0; i < 3000; i++)
        if (chooseRite(difficulty, offer, me, undefined, random) === offer[0])
          majors++;
      return majors / 3000;
    };
    expect(count("easy")).toBeGreaterThan(0.28);
    expect(count("easy")).toBeLessThan(0.39);
    // 3 : 1 : 1 → 60% for the major.
    expect(count("normal")).toBeGreaterThan(0.55);
    expect(count("normal")).toBeLessThan(0.65);
  });

  it("Hard takes the strongest card, every time", () => {
    const me = { character: "auralynx" as const, rites: [] };
    const offer = [
      "auralynx-hard-jab",
      "auralynx-stunning-nova",
      "auralynx-swift-prism",
    ];
    const random = seeded();
    for (let i = 0; i < 50; i++)
      expect(
        chooseRite("hard", offer, me, { character: "cindrake" }, random),
      ).toBe("auralynx-stunning-nova");
  });

  it("Hard values every rite it can be offered, majors above the average minor", () => {
    for (const f of FIGHTER_IDS) {
      const scores = ofFighter(f).map((r) => ({
        tier: r.tier,
        value: riteValue(r.id, { character: f }, { character: "voltkit" }),
      }));
      for (const s of scores) {
        expect(Number.isFinite(s.value)).toBe(true);
        expect(s.value).toBeGreaterThan(0);
      }
      const avg = (tier: string) => {
        const list = scores.filter((s) => s.tier === tier);
        return list.reduce((a, s) => a + s.value, 0) / list.length;
      };
      expect(avg("major")).toBeGreaterThan(avg("minor"));
    }
  });

  it("Hard weighs the matchup: reach and control count more against brawlers", () => {
    const me = { character: "mystowl" as const };
    const brawler = { character: "cindrake" as const };
    const shooter = { character: "voltkit" as const };
    expect(riteValue("mystowl-mind-lock", me, brawler)).toBeGreaterThan(
      riteValue("mystowl-mind-lock", me, shooter),
    );
    expect(riteValue("mystowl-far-sight", me, brawler)).toBeGreaterThan(
      riteValue("mystowl-far-sight", me, shooter),
    );
    // Wider areas are worth more with several targets around.
    expect(
      riteValue("mystowl-wide-repulse", me, shooter, true),
    ).toBeGreaterThan(riteValue("mystowl-wide-repulse", me, shooter));
    // Other fighters' rites are worthless to it.
    expect(riteValue("voltkit-hot-darts", me, shooter)).toBeLessThan(0);
  });

  it("the arena uses the bot's difficulty when it picks", () => {
    const arena = new Arena("BOTRITES");
    arena.add("one", "One", "cindrake");
    const bot = arena.add("two", "Two", "auralynx");
    arena.bots.set(bot.id, new BotBrain(bot.id, "hard", 3));
    arena.start();
    arena.phase = "playing";
    arena.deadline = 999;
    arena.round = 3; // majors on offer
    let offered: string[] = [];
    const pick = arena.pickRite.bind(arena);
    arena.pickRite = (id, rite) => {
      if (id === bot.id) offered = [...(bot.riteOffer ?? [])];
      return pick(id, rite);
    };
    arena.endRound(0);
    expect(bot.riteOffer).toBeUndefined();
    expect(offered.length).toBeGreaterThan(1);
    const best = [...offered].sort(
      (a, b) =>
        riteValue(b, { character: "auralynx" }, { character: "cindrake" }) -
        riteValue(a, { character: "auralynx" }, { character: "cindrake" }),
    )[0];
    expect(bot.rites).toEqual([best]);
  });

  it("plays with its rites: spacing and dodging use the changed numbers", () => {
    const longNeedle = kitOf("tidefin", ["tidefin-long-needle"]).basic;
    expect(longNeedle.range).toBeGreaterThan(kitOf("tidefin").basic.range);
    // The brain reads the kit through the arena, so a bot with Long Needle
    // fires its basic from further away than one without.
    const shotFrom = (rites: string[]) => {
      const arena = new Arena("NEEDLE");
      const bot = arena.add("bot", "Bot", "tidefin");
      const target = arena.add("you", "You", "terradon");
      arena.start();
      arena.phase = "playing";
      arena.deadline = 999;
      bot.rites = rites;
      const brain = new BotBrain(bot.id, "hard", 5);
      const gap = (kitOf("tidefin").basic.range + longNeedle.range) / 2;
      bot.x = 400;
      bot.y = 150; // a clear line, above the pillars
      target.x = 400 + gap;
      target.y = 150;
      let fired = false;
      for (let i = 0; i < 90 && !fired; i++) {
        arena.time += 1 / 30;
        target.x = bot.x + gap;
        target.y = bot.y;
        fired = brain.think(arena, bot).basic;
      }
      return fired;
    };
    expect(shotFrom(["tidefin-long-needle"])).toBe(true);
    expect(shotFrom([])).toBe(false);
  });
});
