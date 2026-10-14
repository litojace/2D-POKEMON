import { it, expect } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import { MatchLedger, matchSummary } from "../../apps/server/src/match-summary";
import { BotBrain } from "../../apps/server/src/bot";
import { recapMarkup, recordsMarkup, mvpOf } from "../../apps/client/src/match-recap";
import { CHARACTERS } from "../../packages/shared/src/index";
import { masteryTier, nextMastery } from "../../packages/shared/src/accounts";

function finished() {
  const a = new Arena("SUMMARY");
  a.add("p1", "Ana", "voltkit");
  a.add("p2", "Ben", "tidefin");
  a.start();
  a.phase = "playing";
  const [p1, p2] = a.players;
  // Round 1: Ana knocks Ben out with her basic attack.
  p2.hp = 5;
  a.damage(p2, 50, "p1", CHARACTERS.voltkit.basic);
  return { a, p1, p2 };
}

it("tracks knockouts and keeps a round log", () => {
  const { a, p1, p2 } = finished();
  a.tick();
  expect(p1.stats.kos).toBe(1);
  expect(p2.stats.kos).toBe(0);
  expect(a.roundLog).toEqual([0]);
  expect(a.snapshot().roundLog).toEqual([0]);
});

it("builds one identical summary for every player, with bots unaccounted", () => {
  const { a } = finished();
  a.tick();
  a.winnerTeam = 0;
  const accounts: Record<string, string> = { p1: "acc-1", p2: "acc-2" };
  const summary = matchSummary(a, (id) => accounts[id] ?? null);
  expect(summary).toMatchObject({
    v: 1,
    mode: "duel",
    bot: null,
    winnerTeam: 0,
    rounds: [0],
  });
  expect(summary.players.map((p) => [p.account, p.team, p.kos])).toEqual([
    ["acc-1", 0, 1],
    ["acc-2", 1, 0],
  ]);
  // JSON round-trips unchanged (the database compares copies exactly).
  expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);
  a.bots.set("p2", new BotBrain("p2", "hard"));
  const vsBot = matchSummary(a, (id) => accounts[id] ?? null);
  expect(vsBot.bot).toBe("hard");
  expect(vsBot.players[1].account).toBeNull();
});

it("hands a finished match only to the accounts that played it", () => {
  const ledger = new MatchLedger(1000);
  const { a } = finished();
  ledger.add("m1", matchSummary(a, (id) => (id === "p1" ? "acc-1" : "acc-2")));
  expect(ledger.forPlayer("m1", "acc-1")?.players).toHaveLength(2);
  expect(ledger.forPlayer("m1", "stranger")).toBeUndefined();
  expect(ledger.forPlayer("nope", "acc-1")).toBeUndefined();
  const expired = new MatchLedger(-1);
  expired.add("m2", matchSummary(a, () => "acc-1"));
  expect(expired.forPlayer("m2", "acc-1")).toBeUndefined();
});

it("shows a recap with you first, an MVP and your head-to-head record", () => {
  const { a } = finished();
  a.tick();
  const html = recapMarkup(a.snapshot(), "p2");
  expect(html.indexOf("Ben")).toBeLessThan(html.indexOf("Ana"));
  expect(mvpOf(a.players).id).toBe("p1");
  expect(html).toContain('class="mvp"');
  expect(
    recordsMarkup({
      status: "done",
      reply: {
        confirmed: true,
        records: [{ id: "x", name: "Ana", wins: 3, losses: 1 }],
        achievements: [],
      },
    }),
  ).toContain("3–1");
  expect(recordsMarkup({ status: "pending" })).toContain("Saving");
  expect(recordsMarkup(undefined)).toBe("");
});

it("ranks fighter mastery by matches played", () => {
  expect(masteryTier(0)).toBeNull();
  expect(masteryTier(5)?.name).toBe("Bronze");
  expect(masteryTier(59)?.name).toBe("Gold");
  expect(masteryTier(200)?.name).toBe("Crystal");
  expect(nextMastery(3)).toMatchObject({ name: "Bronze", left: 2 });
  expect(nextMastery(60)).toBeNull();
});

it("lists friends online first with Join and Watch where it makes sense", async () => {
  const { friendsMarkup, friendStatus } = await import(
    "../../apps/client/src/friends-view"
  );
  const html = friendsMarkup({
    code: "ABCD1234",
    incoming: [{ id: "x", name: "Newbie" }],
    outgoing: [],
    friends: [
      { id: "1", name: "Kai", online: true, activity: "lobby", room: "ROOM01", joinable: true },
      { id: "2", name: "Mina", online: true, activity: "match", room: "ROOM02", fighter: "tidefin" },
      { id: "3", name: "Rowan", online: false },
    ],
  });
  expect(html).toContain('data-accept="x"');
  expect(html).toContain('data-join="ROOM01"');
  expect(html).toContain('data-watch="ROOM02"');
  expect(html).not.toContain('data-join="ROOM02"');
  expect(friendStatus({ id: "2", name: "Mina", online: true, activity: "match", fighter: "tidefin" })).toBe("In a match as Tidefin");
  expect(friendStatus({ id: "3", name: "Rowan", online: false })).toBe("Offline");
});
