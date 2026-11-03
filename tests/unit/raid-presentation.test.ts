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
  expect(html).toContain('data-stat="revives">2</td>');
  expect(html).toContain('data-stat="pillars">3</td>');
  expect(html).toContain('<th scope="col" title="Pillars broken">Pillars</th>');
  // Solo: no "team best" highlight or damage share (it would always be 100%).
  expect(html).not.toContain("is-best");
  expect(html).not.toContain("raid-score-share");
});
it("lists you first, lights each column's leader and shows damage share", () => {
  const a = setup();
  a.add("ally", "Ally");
  a.raid.contributions!.hero = { damage: 300, revives: 0, pillars: 2 };
  a.raid.contributions!.ally = { damage: 900, revives: 1, pillars: 2 };
  const html = raidContributions(a.snapshot(), "ally");
  const rows = html.split('<tr class="raid-score-row').slice(1);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toContain(" is-me");
  expect(rows[0]).toContain("<b>Ally</b>");
  expect(rows[0]).toContain('raid-score-you">You');
  expect(rows[1]).not.toContain("is-me");
  // Damage and revives lead belongs to Ally; a tied pillar lead lights both.
  expect(rows[0]).toContain('class="is-best" data-stat="damage">900');
  expect(rows[0]).toContain('class="is-best" data-stat="revives">1');
  expect(rows[1]).toContain('class="is-zero" data-stat="revives">0</td>');
  expect(rows[0]).toContain('class="is-best" data-stat="pillars">2');
  expect(rows[1]).toContain('class="is-best" data-stat="pillars">2');
  expect(rows[0]).toContain("75% of the team");
  expect(rows[1]).toContain("25% of the team");
  expect(html).toContain("2 raiders · 1,200 damage");
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
  expect(raidRewardProgress({ ...p, clears: 5 })).toContain("Cragstone skin");
  expect(raidRewardProgress({ ...p, clears: 5 })).toContain("5/10 clears");
  // Three clears already earned Mountain Conqueror; next is a no-downs clear.
  expect(raidRewardProgress({ ...p, clears: 10 })).toContain("Mountain aura");
});
