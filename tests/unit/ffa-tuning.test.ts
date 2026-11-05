import { afterEach, describe, expect, it } from "vitest";
import {
  CHARACTERS,
  FFA_TUNING,
  FIGHTER_IDS,
  RULES,
  TEAM_TUNING,
  basicInterval,
  maxHealth,
  modeFactor,
  type CharacterId,
  type MatchMode,
} from "../../packages/shared/src/index";
import { Arena } from "../../apps/server/src/simulation";
import { BotBrain } from "../../apps/server/src/bot";

const shipped = { ...FFA_TUNING };
afterEach(() => {
  for (const id of FIGHTER_IDS) delete FFA_TUNING[id];
  Object.assign(FFA_TUNING, shipped);
});

/** A seeded bot match, played for `seconds`: everyone's health and spot. */
function play(mode: MatchMode, picks: CharacterId[], seconds: number) {
  const arena = new Arena(`fp-${mode}`, mode);
  picks.forEach((c, i) => {
    arena.add(`P${i}`, `P${i}`, c);
    arena.bots.set(`P${i}`, new BotBrain(`P${i}`, "hard", 700 + i));
  });
  arena.start();
  arena.acknowledgeInstructions("P0");
  for (let t = 0; t < seconds * RULES.tick && arena.phase !== "finished"; t++)
    arena.tick();
  return {
    phase: arena.phase,
    rounds: [...arena.roundLog],
    fighters: arena.players.map((p) => [p.hp, p.x, p.y]),
  };
}

describe("free-for-all tuning", () => {
  it("only changes champions in a free-for-all", () => {
    FFA_TUNING.cindrake = 1.44;
    const c = CHARACTERS.cindrake;
    for (const mode of [undefined, "duel", "raid"] as const) {
      expect(modeFactor("cindrake", mode)).toBe(1);
      expect(maxHealth("cindrake", mode)).toBe(c.health);
      expect(basicInterval(c, false, mode)).toBe(c.basic.interval);
    }
    expect(modeFactor("cindrake", "teams")).toBe(TEAM_TUNING.cindrake ?? 1);
    expect(modeFactor("cindrake", "ffa")).toBe(1.44);
    expect(maxHealth("cindrake", "ffa")).toBe(Math.round(c.health * 1.44));
    // Interval ÷ √1.44 = ÷ 1.2, rounded to 5 ms.
    const ms = Math.round(((c.basic.interval ?? 0.3) * 1000) / 1.2 / 5) * 5;
    expect(basicInterval(c, false, "ffa")).toBeCloseTo(ms / 1000, 9);
  });

  it("ships a factor for every champion, in a sane range", () => {
    for (const id of FIGHTER_IDS) {
      const f = FFA_TUNING[id]!;
      expect(f, id).toBeDefined();
      expect(f, id).toBeGreaterThanOrEqual(0.6);
      expect(f, id).toBeLessThanOrEqual(1.6);
    }
    for (const id of Object.keys(FFA_TUNING))
      expect(FIGHTER_IDS, id).toContain(id as CharacterId);
  });

  it("gives fighters their free-for-all health in a free-for-all", () => {
    FFA_TUNING.voltkit = 0.8;
    FFA_TUNING.astrabun = 1.3;
    const a = new Arena("f", "ffa");
    a.add("a", "A", "voltkit");
    a.add("b", "B", "astrabun");
    a.add("c", "C", "tidefin");
    a.start();
    const hp = (id: string) => a.players.find((p) => p.id === id)!.hp;
    expect(hp("a")).toBe(Math.round(CHARACTERS.voltkit.health * 0.8));
    expect(hp("b")).toBe(Math.round(CHARACTERS.astrabun.health * 1.3));
  });

  it("leaves seeded duels and 2v2 matches exactly as they were", () => {
    const duel: CharacterId[] = ["cindrake", "halcyra"];
    const teams: CharacterId[] = ["astrabun", "pyranda", "shadopus", "voltkit"];
    for (const id of FIGHTER_IDS) FFA_TUNING[id] = 1;
    const before = [play("duel", duel, 40), play("teams", teams, 40)];
    // Wildly different free-for-all numbers must not reach other modes.
    for (const [i, id] of FIGHTER_IDS.entries())
      FFA_TUNING[id] = i % 2 ? 0.6 : 1.6;
    const after = [play("duel", duel, 40), play("teams", teams, 40)];
    expect(after).toEqual(before);
    // ...while the same change does move a free-for-all.
    for (const id of FIGHTER_IDS) FFA_TUNING[id] = 1;
    const ffa = play("ffa", teams, 20);
    for (const [i, id] of FIGHTER_IDS.entries())
      FFA_TUNING[id] = i % 2 ? 0.6 : 1.6;
    expect(play("ffa", teams, 20)).not.toEqual(ffa);
  });
});
