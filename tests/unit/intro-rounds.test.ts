import { describe, expect, it } from "vitest";
import { INTRO_ROUNDS, RULES, introRounds, roundsNeeded } from "@arena/shared";
import { Arena } from "../../apps/server/src/simulation";
import { cloneArena } from "../../apps/server/src/bot-lookahead";

// A new player's short first matches against a bot (INTRO_ROUNDS): one
// round, then first to two, then the usual first to three.
function duel(played?: number) {
  const a = new Arena("INTRO");
  a.add("me", "Me", "voltkit");
  a.add("bot", "Pip (Bot)", "tidefin");
  a.introPlayed = played;
  a.start();
  return a;
}
/** Win rounds for `team` until the match ends; how many it took. */
function winOut(a: Arena, team: 0 | 1) {
  let rounds = 0;
  while (a.phase !== "finished" && rounds < 10) {
    a.endRound(team);
    rounds++;
  }
  return rounds;
}

describe("the rule", () => {
  it("is one round, then first to two, then the usual", () => {
    expect([...INTRO_ROUNDS]).toEqual([1, 2]);
    expect(introRounds(0)).toBe(1);
    expect(introRounds(1)).toBe(2);
    expect(introRounds(2)).toBeUndefined();
    expect(introRounds(500)).toBeUndefined();
  });
  it("an unknown count means a full match", () => {
    for (const n of [undefined, -1, 0.5, NaN])
      expect(introRounds(n)).toBeUndefined();
  });
  it("only ever shortens a match", () => {
    expect(roundsNeeded()).toBe(RULES.roundsToWin);
    expect(roundsNeeded([], 1)).toBe(1);
    expect(roundsNeeded([], 2)).toBe(2);
    expect(roundsNeeded([], 9)).toBe(RULES.roundsToWin);
    expect(roundsNeeded(["quick"], 1)).toBe(1);
    expect(roundsNeeded(["quick"], 3)).toBe(2);
    // Nothing, or nonsense: the usual.
    for (const intro of [undefined, null, 0, -2, NaN])
      expect(roundsNeeded([], intro)).toBe(RULES.roundsToWin);
  });
});

describe("the match", () => {
  it("a first match is over after one round, either way", () => {
    for (const team of [0, 1] as const) {
      const a = duel(0);
      expect(a.roundsToWin).toBe(1);
      expect(a.snapshot().introRounds).toBe(1);
      expect(winOut(a, team)).toBe(1);
      expect(a.winnerTeam).toBe(team);
      expect(a.roundLog).toEqual([team]);
    }
  });
  it("a second match is first to two", () => {
    const a = duel(1);
    expect(a.roundsToWin).toBe(2);
    a.endRound(1);
    expect(a.phase).toBe("intermission");
    a.endRound(0);
    expect(a.phase).not.toBe("finished");
    a.endRound(0);
    expect(a.phase).toBe("finished");
    expect(a.winnerTeam).toBe(0);
  });
  it("every other match is first to three, and says nothing in its snapshot", () => {
    for (const played of [undefined, 2, 40]) {
      const a = duel(played);
      expect(a.roundsToWin).toBe(RULES.roundsToWin);
      expect(a.snapshot().introRounds).toBeUndefined();
      expect("introRounds" in JSON.parse(JSON.stringify(a.snapshot()))).toBe(
        false,
      );
      expect(winOut(a, 0)).toBe(RULES.roundsToWin);
    }
  });
  it("a draw doesn't end a one-round match", () => {
    const a = duel(0);
    a.endRound(null);
    expect(a.phase).not.toBe("finished");
    a.endRound(0);
    expect(a.phase).toBe("finished");
  });
  it("a forfeit gives the winner the short match's score", () => {
    const a = duel(0);
    a.forfeit("me");
    expect(a.scores.me).toBe(1);
    expect(a.phase).toBe("finished");
  });
  it("a rematch is the next match: two rounds, then full length", () => {
    const a = duel(0);
    expect(winOut(a, 0)).toBe(1);
    a.nextIntro();
    a.start();
    expect(a.roundsToWin).toBe(2);
    expect(winOut(a, 0)).toBe(2);
    a.nextIntro();
    a.start();
    expect(a.introPlayed).toBeUndefined();
    expect(a.roundsToWin).toBe(RULES.roundsToWin);
    expect(winOut(a, 0)).toBe(RULES.roundsToWin);
    // And stays there.
    a.nextIntro();
    expect(a.roundsToWin).toBe(RULES.roundsToWin);
  });
  it("a rematch in any other room changes nothing", () => {
    const a = duel();
    a.nextIntro();
    expect(a.introPlayed).toBeUndefined();
    expect(a.roundsToWin).toBe(RULES.roundsToWin);
  });
  it("the bot's look-ahead copy plays the same short match", () => {
    const a = duel(0);
    expect(cloneArena(a, 7).roundsToWin).toBe(1);
  });
});
