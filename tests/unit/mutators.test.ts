import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  MUTATOR_RULES,
  RULES,
  roundsNeeded,
} from "@arena/shared";
import { Arena } from "../../apps/server/src/simulation";
const tick = (a: Arena, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * RULES.tick); i++) a.tick();
};
function duel(rules: string[] = []) {
  const a = new Arena("RULES");
  a.mutators = new Set(rules as never[]);
  a.add("one", "One", "voltkit");
  a.add("two", "Two", "tidefin");
  a.start();
  a.acknowledgeInstructions("one");
  a.acknowledgeInstructions("two");
  tick(a, RULES.countdown + 0.1);
  return a;
}
describe("party rules", () => {
  it("quick match is first to two", () => {
    expect(roundsNeeded([])).toBe(RULES.roundsToWin);
    expect(roundsNeeded(["quick"])).toBe(2);
    const a = duel(["quick"]);
    a.endRound(0);
    expect(a.phase).toBe("intermission");
    a.endRound(0);
    expect(a.phase).toBe("finished");
    expect(a.snapshot().mutators).toEqual(["quick"]);
  });
  it("glass cannon multiplies damage", () => {
    const plain = duel(),
      glass = duel(["glass"]);
    for (const a of [plain, glass])
      a.damage(a.players[1], 20, "one", CHARACTERS.voltkit.basic);
    const lost = (a: Arena) => CHARACTERS.tidefin.health - a.players[1].hp;
    expect(lost(glass)).toBeCloseTo(lost(plain) * MUTATOR_RULES.glassDamage);
  });
  it("turbo halves skill cooldowns and speeds up the meter", () => {
    const a = duel(["turbo"]);
    const p = a.players[0];
    p.lastInput = { ...p.lastInput, skill: 0, aimX: 1500, aimY: 450 };
    a.tick();
    const skill = CHARACTERS.voltkit.skills[0];
    expect(p.cooldowns[0]).toBeGreaterThan(a.time + 0.5);
    expect(p.cooldowns[0] - a.time).toBeLessThanOrEqual(
      skill.cooldown * MUTATOR_RULES.turboCooldown + 0.05,
    );
    p.ult = 0;
    a.chargeUlt(p, 10);
    expect(p.ult).toBeCloseTo(10 * MUTATOR_RULES.turboUlt);
  });
  it("orb rain doubles orbs; calm court stays on the Stone Court", () => {
    const a = duel(["orbs"]);
    tick(a, RULES.orbFirst / 2 + 0.2);
    expect(a.orbs).toHaveLength(1);
    const calm = new Arena("CALM");
    calm.rotateArenas = true;
    calm.mutators = new Set(["calm"]);
    calm.add("a", "A");
    calm.add("b", "B");
    for (let i = 0; i < 4; i++) {
      calm.start();
      expect(calm.arenaId).toBe("classic");
    }
  });
});
