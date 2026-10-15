import { describe, expect, it } from "vitest";
import { CHARACTERS, EX, RULES, exAbility, inputSchema, blankInput } from "@arena/shared";
import { Arena } from "../../apps/server/src/simulation";
function duel() {
  const a = new Arena("EX");
  a.add("one", "One", "cindrake");
  a.add("two", "Two", "tidefin");
  a.start();
  a.acknowledgeInstructions("one");
  a.acknowledgeInstructions("two");
  for (let i = 0; i < (RULES.countdown + 0.2) * RULES.tick; i++) a.tick();
  return a;
}
const cast = (a: Arena, slot: number, ex: boolean) => {
  const p = a.players[0];
  const enemy = a.players[1];
  a.submit(p, {
    ...blankInput(),
    seq: p.ack + 1,
    skill: slot,
    ex,
    aimX: enemy.x,
    aimY: enemy.y,
  });
  a.tick();
};
describe("EX skills", () => {
  it("makes a stronger, wider version of a skill", () => {
    const base = CHARACTERS.cindrake.skills[0];
    const ex = exAbility(base);
    expect(ex.damage).toBe(Math.round(base.damage * EX.damage));
    expect(ex.radius).toBeCloseTo(base.radius * EX.radius);
    expect(ex.id).toBe(base.id);
    expect(inputSchema.safeParse({ ...blankInput(), ex: true }).success).toBe(true);
  });
  it("spends a third of the meter, and needs it", () => {
    const a = duel();
    const p = a.players[0];
    p.ult = EX.cost - 1;
    cast(a, 0, true);
    // Too little: a normal cast instead (only the slow trickle is added).
    expect(p.ult).toBeGreaterThanOrEqual(EX.cost - 1);
    expect(a.events.some((e) => e.abilityId === "ex-cast")).toBe(false);
    const b = duel();
    const q = b.players[0];
    q.ult = 60;
    cast(b, 1, true);
    expect(q.ult).toBeLessThanOrEqual(60 - EX.cost + 1);
    const callout = b.events.find((e) => e.abilityId === "ex-cast");
    expect(callout?.combo).toContain("EX");
    expect(q.cooldowns[1]).toBeGreaterThan(b.time);
  });
  it("never applies to the ultimate", () => {
    const a = duel();
    const p = a.players[0];
    p.ult = RULES.ultMax;
    cast(a, 3, true);
    expect(p.ult).toBe(0);
    expect(a.events.some((e) => e.abilityId === "ex-cast")).toBe(false);
  });
});
