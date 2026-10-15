import { expect, it } from "vitest";
import { RaidArena } from "../../apps/server/src/raid";
import {
  raidCue,
  raidContributions,
  raidRewardProgress,
} from "../../apps/client/src/raid-presentation";
const setup = () => {
  const a = new RaidArena("UI");
  a.add("hero", "<Hero>");
  a.start();
  a.phase = "playing";
  return a;
};
it("shows personal charge guidance and changes to the dodge cue at lock time", () => {
  const a = setup();
  a.raid.warnings = [
    {
      id: 1,
      kind: "charge",
      x: 0,
      y: 0,
      tx: 100,
      ty: 100,
      radius: 80,
      at: 1.7,
      lockAt: 1,
      targetId: "hero",
      teach: true,
    },
  ];
  expect(raidCue(a.snapshot(), "hero")).toContain("You are targeted — lead");
  a.time = 1;
  expect(raidCue(a.snapshot(), "hero")).toContain("locked — clear");
});
it("escapes names and includes support contributions alongside damage", () => {
  const a = setup();
  a.raid.contributions!.hero = { damage: 1024, revives: 2, pillars: 3 };
  const html = raidContributions(a.snapshot());
  expect(html).toContain("&lt;Hero&gt;");
  expect(html).toContain("1,024");
  expect(html).toContain('aria-label="Revives">2');
  expect(html).toContain('aria-label="Pillars broken">3');
});
it("uses saved reward counts and handles unavailable progress without inventing unlocks", () => {
  expect(raidRewardProgress(null)).toContain("check your progress");
  const p = {
    clears: 4,
    highestPeril: 2,
    bestSeconds: 250,
    titles: [],
    cosmetics: [],
    weekly: [],
  };
  expect(raidRewardProgress(p)).toContain("4/5 clears");
  expect(raidRewardProgress({ ...p, clears: 5 })).toContain(
    "Mountain Conqueror",
  );
  expect(raidRewardProgress({ ...p, clears: 5, highestPeril: 3 })).toContain(
    "Mountain aura",
  );
});
