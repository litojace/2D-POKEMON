import { describe, expect, it } from "vitest";
import {
  pickClashes,
  picksHidden,
  pickTakenBy,
  veilPlayers,
  VEILED_CHARACTER,
  type CharacterId,
} from "../../packages/shared/src/index";

type P = {
  id: string;
  team: number;
  character: CharacterId;
  locked?: boolean;
  browse?: CharacterId;
};
const teamOf = (p: P) => p.team;

describe("hidden picks (docs/hidden-picks.md)", () => {
  it("hides picks in a PvP lobby only", () => {
    for (const mode of ["duel", "teams", "ffa"] as const)
      expect(picksHidden({ mode, phase: "lobby" })).toBe(true);
    expect(picksHidden({ mode: "raid", phase: "lobby" })).toBe(false);
    expect(picksHidden({ mode: "duel", phase: "briefing" })).toBe(false);
    expect(picksHidden({ mode: "duel", phase: "finished" })).toBe(false);
    expect(
      picksHidden({ mode: "duel", phase: "lobby", practice: { a: 1 } }),
    ).toBe(false);
  });

  it("a 2v2 teammate's lock takes the fighter; the other side's doesn't", () => {
    const players: P[] = [
      { id: "a", team: 0, character: "tidefin", locked: true },
      { id: "b", team: 0, character: "voltkit" },
      { id: "c", team: 1, character: "lumoth", locked: true },
    ];
    const [, b] = players;
    expect(pickTakenBy("teams", players, b, "tidefin", teamOf)?.id).toBe("a");
    expect(pickTakenBy("teams", players, b, "lumoth", teamOf)).toBeUndefined();
    // Only a lock takes it, never a look.
    players[0].locked = false;
    expect(pickTakenBy("teams", players, b, "tidefin", teamOf)).toBeUndefined();
    // Anyone may pick anything in a 1v1 or a free-for-all.
    players[0].locked = true;
    expect(pickTakenBy("duel", players, b, "tidefin", teamOf)).toBeUndefined();
    expect(pickTakenBy("ffa", players, b, "tidefin", teamOf)).toBeUndefined();
  });

  it("after a team change, every lock but the first on a fighter gives way", () => {
    const players: P[] = [
      { id: "late", team: 1, character: "glacelle", locked: true },
      { id: "early", team: 1, character: "glacelle", locked: true },
      { id: "other", team: 0, character: "glacelle", locked: true },
    ];
    const order = { early: 1, other: 2, late: 3 } as Record<string, number>;
    const out = pickClashes("teams", players, teamOf, (p) => order[p.id]);
    expect(out.map((p) => p.id)).toEqual(["late"]);
    expect(pickClashes("duel", players, teamOf, (p) => order[p.id])).toEqual(
      [],
    );
  });

  it("veils another side's pick and look, and everyone's for a watcher", () => {
    const players: P[] = [
      { id: "me", team: 0, character: "cindrake", locked: true },
      { id: "mate", team: 0, character: "voltkit", browse: "tidefin" },
      { id: "foe", team: 1, character: "mystowl", browse: "astrabun" },
    ];
    const side = (id: string) => players.find((p) => p.id === id)!.team;
    const seen = veilPlayers(players, "me", (x, y) => side(x) === side(y));
    expect(seen[0]).toBe(players[0]);
    expect(seen[1]).toBe(players[1]);
    expect(seen[2]).toEqual({
      id: "foe",
      team: 1,
      character: VEILED_CHARACTER,
      veiled: true,
    });
    const watcher = veilPlayers(players, undefined, () => true);
    expect(watcher.every((p) => (p as P & { veiled?: boolean }).veiled)).toBe(
      true,
    );
    expect(JSON.stringify(watcher)).not.toMatch(
      /cindrake|tidefin|mystowl|astrabun/,
    );
  });
});
