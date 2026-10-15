import { describe, expect, it } from "vitest";
import { CHARACTERS, RULES, RUSH, rushGoals } from "@arena/shared";
import { Arena } from "../../apps/server/src/simulation";
const tick = (a: Arena, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * RULES.tick); i++) a.tick();
};
function duel() {
  const a = new Arena("RUSH");
  a.mutators = new Set(["rush"] as never[]);
  a.add("one", "One", "voltkit");
  a.add("two", "Two", "tidefin");
  a.start();
  a.acknowledgeInstructions("one");
  a.acknowledgeInstructions("two");
  tick(a, RULES.countdown + 0.1);
  return a;
}
describe("Orb Rush", () => {
  it("spawns gems away from the goals, up to the limit", () => {
    const a = duel();
    // Keep the fighters at home so nobody picks anything up.
    for (const p of a.players) p.lastInput = { ...p.lastInput, dx: 0, dy: 0 };
    tick(a, RUSH.spawnEvery * (RUSH.max + 2));
    expect(a.gems.length).toBe(RUSH.max);
    for (const g of a.gems)
      for (const goal of rushGoals("duel"))
        expect(Math.hypot(g.x - goal.x, g.y - goal.y)).toBeGreaterThan(250);
    expect(a.snapshot().gems).toHaveLength(RUSH.max);
    expect(a.snapshot().banked).toEqual([0, 0]);
  });
  it("picks up, banks at your own goal, and wins the round at the target", () => {
    const a = duel();
    const [one] = a.players;
    const goal = rushGoals("duel")[0];
    for (let n = 0; n < RUSH.target; n++) {
      a.gems.push({ id: 1000 + n, x: 800, y: 300 });
      Object.assign(one, { x: 800, y: 300 });
      a.tick();
    }
    expect(one.gems).toBe(RUSH.target);
    // The other side's goal does nothing for you.
    const theirs = rushGoals("duel")[1];
    Object.assign(one, { x: theirs.x, y: theirs.y });
    a.tick();
    expect(one.gems).toBe(RUSH.target);
    Object.assign(one, { x: goal.x, y: goal.y });
    a.tick();
    expect(a.phase).toBe("intermission");
    expect(a.roundWinner).toBe("one");
    expect(a.banked[0]).toBe(RUSH.target);
  });
  it("a big hit knocks a gem loose and a knockout drops them all", () => {
    const a = duel();
    const [one, two] = a.players;
    one.gems = 3;
    a.damage(one, RUSH.dropDamage + 5, "two", CHARACTERS.tidefin.skills[0]);
    expect(one.gems).toBe(2);
    a.damage(one, 2, "two", CHARACTERS.tidefin.basic);
    expect(one.gems).toBe(2);
    const before = a.gems.length;
    a.damage(one, 9999, "two", CHARACTERS.tidefin.basic);
    expect(one.gems).toBe(0);
    expect(a.gems.length).toBe(before + 2);
    void two;
  });
  it("is off unless the party rule is on", () => {
    const a = new Arena("PLAIN");
    a.add("one", "One");
    a.add("two", "Two");
    a.start();
    a.acknowledgeInstructions("one");
    a.acknowledgeInstructions("two");
    tick(a, RULES.countdown + 10);
    expect(a.gems).toHaveLength(0);
    expect(a.snapshot().gems).toBeUndefined();
  });
});
