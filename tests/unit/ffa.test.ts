import { describe, expect, it } from "vitest";
import { CHARACTERS, RULES } from "@arena/shared";
import { Arena } from "../../apps/server/src/simulation";
import { matchSummary } from "../../apps/server/src/match-summary";
const tick = (a: Arena, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * RULES.tick); i++) a.tick();
};
function ffa(count = 4) {
  const a = new Arena("FFA", "ffa");
  const chars = ["voltkit", "tidefin", "cindrake", "lumoth"] as const;
  for (let i = 0; i < count; i++) a.add(`p${i}`, `P${i}`, chars[i]);
  a.start();
  for (const p of a.players) a.acknowledgeInstructions(p.id);
  tick(a, RULES.countdown + 0.1);
  return a;
}
describe("free-for-all", () => {
  it("seats everyone on their own side, in separate corners", () => {
    const a = ffa();
    expect(a.phase).toBe("playing");
    expect(a.players.map((p) => a.teamOf(p))).toEqual([0, 1, 2, 3]);
    expect(a.teamScores).toEqual([0, 0, 0, 0]);
    const spots = new Set(a.players.map((p) => `${p.x},${p.y}`));
    expect(spots.size).toBe(4);
    // Everyone is everyone's enemy.
    expect(a.enemiesOf(a.players[0]).map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });
  it("starts with three and needs at least three", () => {
    const two = new Arena("F2", "ffa");
    two.add("a", "A");
    two.add("b", "B");
    two.start();
    for (const p of two.players) two.acknowledgeInstructions(p.id);
    expect(two.phase).toBe("briefing");
    const three = ffa(3);
    expect(three.phase).toBe("playing");
  });
  it("the round goes on until one fighter is left, who scores it", () => {
    const a = ffa();
    const [p0, p1, p2, p3] = a.players;
    a.damage(p1, 9999, "p0", CHARACTERS.voltkit.basic);
    a.damage(p2, 9999, "p0", CHARACTERS.voltkit.basic);
    a.tick();
    expect(a.phase).toBe("playing");
    a.damage(p0, 9999, "p3", CHARACTERS.lumoth.basic);
    a.tick();
    expect(a.phase).toBe("intermission");
    expect(a.roundWinner).toBe("p3");
    expect(a.teamScores).toEqual([0, 0, 0, 1]);
    expect(a.scores.p3).toBe(1);
    expect(p0.stats.kos).toBe(2);
    expect(p3.stats.kos).toBe(1);
    // Every loser of the round gets the comeback rite choice.
    const offers = a.players.map((p) => p.riteOffer?.length ?? 0);
    expect(offers[3]).toBeLessThan(Math.max(...offers.slice(0, 3)));
  });
  it("on time, the healthiest fighter still standing wins", () => {
    const a = ffa();
    const [p0, p1, p2] = a.players;
    p0.hp = CHARACTERS.voltkit.health * 0.5;
    p1.hp = CHARACTERS.tidefin.health * 0.9;
    p2.hp = 0;
    a.deadline = a.time;
    a.tick();
    expect(a.roundWinner).toBe("p3");
  });
  it("wins the match at the rounds needed and summarises every fighter", () => {
    const a = ffa(3);
    for (let i = 0; i < RULES.roundsToWin; i++) a.endRound(2);
    expect(a.phase).toBe("finished");
    expect(a.winner).toBe("p2");
    const summary = matchSummary(a, (id) => `acc-${id}`);
    expect(summary.mode).toBe("ffa");
    expect(summary.winnerTeam).toBe(2);
    expect(summary.players.map((p) => p.team)).toEqual([0, 1, 2]);
  });
});
