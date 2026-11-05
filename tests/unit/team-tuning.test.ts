import { afterEach, describe, expect, it } from "vitest";
import {
  CHARACTERS,
  FFA_TUNING,
  FIGHTER_IDS,
  TEAM_TUNING,
  basicInterval,
  maxHealth,
  modeFactor,
  type CharacterId,
} from "../../packages/shared/src/index";
import { Arena } from "../../apps/server/src/simulation";

const shipped = { ...TEAM_TUNING };
afterEach(() => {
  for (const id of FIGHTER_IDS) delete TEAM_TUNING[id];
  Object.assign(TEAM_TUNING, shipped);
});

describe("2v2 tuning", () => {
  it("only changes champions in the team mode", () => {
    TEAM_TUNING.voltkit = 1.21;
    const c = CHARACTERS.voltkit;
    for (const mode of [undefined, "duel", "raid"] as const) {
      expect(modeFactor("voltkit", mode)).toBe(1);
      expect(maxHealth("voltkit", mode)).toBe(c.health);
      expect(basicInterval(c, false, mode)).toBe(c.basic.interval);
    }
    // A free-for-all reads its own table, never the 2v2 one.
    expect(modeFactor("voltkit", "ffa")).toBe(FFA_TUNING.voltkit ?? 1);
    expect(modeFactor("voltkit", "teams")).toBe(1.21);
    expect(maxHealth("voltkit", "teams")).toBe(Math.round(c.health * 1.21));
    // Interval ÷ √1.21 = ÷ 1.1, rounded to 5 ms.
    const ms = Math.round(((c.basic.interval ?? 0.3) * 1000) / 1.1 / 5) * 5;
    expect(basicInterval(c, false, "teams")).toBeCloseTo(ms / 1000, 9);
  });

  it("keeps every shipped factor in a sane range", () => {
    for (const [id, f] of Object.entries(TEAM_TUNING)) {
      expect(FIGHTER_IDS, id).toContain(id as CharacterId);
      expect(f, id).toBeGreaterThanOrEqual(0.6);
      expect(f, id).toBeLessThanOrEqual(1.6);
    }
  });

  it("gives fighters their 2v2 health in a team match, and their own in a duel", () => {
    TEAM_TUNING.voltkit = 1.3;
    TEAM_TUNING.auralynx = 0.8;
    const teams = new Arena("t", "teams");
    teams.add("a", "A", "voltkit");
    teams.add("b", "B", "auralynx");
    teams.add("c", "C", "tidefin");
    teams.add("d", "D", "terradon");
    teams.start();
    const hp = (arena: Arena, id: string) =>
      arena.players.find((p) => p.id === id)!.hp;
    expect(hp(teams, "a")).toBe(Math.round(CHARACTERS.voltkit.health * 1.3));
    expect(hp(teams, "b")).toBe(Math.round(CHARACTERS.auralynx.health * 0.8));
    const duel = new Arena("d", "duel");
    duel.add("a", "A", "voltkit");
    duel.add("b", "B", "auralynx");
    duel.start();
    expect(hp(duel, "a")).toBe(CHARACTERS.voltkit.health);
    expect(hp(duel, "b")).toBe(CHARACTERS.auralynx.health);
  });
});
