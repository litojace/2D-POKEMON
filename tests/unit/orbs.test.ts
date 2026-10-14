import { describe, expect, it } from "vitest";
import { CHARACTERS, ORB_SPOTS, RULES } from "@arena/shared";
import { Arena } from "../../apps/server/src/simulation";
const tick = (a: Arena, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * RULES.tick); i++) a.tick();
};
function duel() {
  const a = new Arena("ORB");
  a.add("one", "One", "voltkit");
  a.add("two", "Two", "terradon");
  a.start();
  a.acknowledgeInstructions("one");
  a.acknowledgeInstructions("two");
  tick(a, RULES.countdown + 0.1);
  expect(a.phase).toBe("playing");
  return a;
}
describe("healing orbs", () => {
  it("first appears after the countdown plus orbFirst, then every interval", () => {
    const a = duel();
    tick(a, RULES.orbFirst - 0.5);
    expect(a.orbs).toHaveLength(0);
    tick(a, 0.6);
    expect(a.orbs).toHaveLength(1);
    expect(a.events.some((e) => e.kind === "orb")).toBe(true);
  });
  it("alternates spots in a duel and fills both in 2v2", () => {
    const a = duel();
    tick(a, RULES.orbFirst + 0.1);
    const first = { x: a.orbs[0].x, y: a.orbs[0].y };
    tick(a, RULES.orbInterval);
    expect(a.orbs).toHaveLength(2);
    const other = ORB_SPOTS.find((s) => s.x !== first.x || s.y !== first.y)!;
    expect([a.orbs[1].x, a.orbs[1].y]).toEqual([other.x, other.y]);
    const t = new Arena("T", "teams");
    ["a", "b", "c", "d"].forEach((id) => t.add(id, id));
    t.start();
    for (const p of t.players) t.acknowledgeInstructions(p.id);
    tick(t, RULES.countdown + RULES.orbFirst + 0.2);
    expect(t.orbs).toHaveLength(ORB_SPOTS.length);
  });
  it("heals the closest hurt fighter by a share of full health, capped", () => {
    const a = duel();
    tick(a, RULES.orbFirst + 0.1);
    const orb = a.orbs[0];
    const [one, two] = a.players;
    const full = CHARACTERS.voltkit.health;
    Object.assign(one, { x: orb.x, y: orb.y, hp: 40 });
    Object.assign(two, { x: orb.x + 30, y: orb.y, hp: 10 });
    a.tick();
    expect(a.orbs).toHaveLength(0);
    expect(one.hp).toBe(40 + Math.round(full * RULES.orbHeal));
    expect(two.hp).toBeLessThanOrEqual(10);
    const heal = a.events.find((e) => e.kind === "heal")!;
    expect(heal.owner).toBe("one");
    // Never above full health.
    const b = duel();
    tick(b, RULES.orbFirst + 0.1);
    Object.assign(b.players[0], {
      x: b.orbs[0].x,
      y: b.orbs[0].y,
      hp: full - 3,
    });
    b.tick();
    expect(b.players[0].hp).toBe(full);
  });
  it("is left alone by a fighter at full health", () => {
    const a = duel();
    tick(a, RULES.orbFirst + 0.1);
    const orb = a.orbs[0];
    Object.assign(a.players[0], { x: orb.x, y: orb.y });
    Object.assign(a.players[1], { x: 1500, y: 450 });
    a.tick();
    expect(a.orbs).toHaveLength(1);
  });
  it("clears at a new round and never appears in practice", () => {
    const a = duel();
    tick(a, RULES.orbFirst + 0.1);
    expect(a.orbs.length).toBeGreaterThan(0);
    a.resetRound();
    expect(a.orbs).toHaveLength(0);
    const p = new Arena("P");
    p.practice = { unlimitedCooldowns: false, targetAttacks: false };
    p.add("h", "H");
    p.add("t", "T");
    p.resetPractice();
    tick(p, RULES.orbFirst + RULES.orbInterval + 1);
    expect(p.orbs).toHaveLength(0);
  });
});
describe("energy orbs", () => {
  it("every other orb charges the ultimate instead of healing", () => {
    const a = duel();
    tick(a, RULES.orbFirst + 0.1);
    expect(a.orbs[0].kind).toBe("heal");
    tick(a, RULES.orbInterval);
    const energy = a.orbs[1];
    expect(energy.kind).toBe("energy");
    const [one] = a.players;
    // Full health doesn't matter for energy; a full meter does.
    Object.assign(one, { x: energy.x, y: energy.y, ult: RULES.ultMax });
    Object.assign(a.players[1], { x: 1500, y: 450 });
    a.tick();
    expect(a.orbs.some((o) => o.id === energy.id)).toBe(true);
    one.ult = 10;
    a.tick();
    expect(a.orbs.some((o) => o.id === energy.id)).toBe(false);
    expect(one.ult).toBeCloseTo(10 + RULES.orbEnergy, 0);
    expect(one.hp).toBe(CHARACTERS.voltkit.health);
    const event = a.events.find(
      (e) => e.kind === "heal" && e.abilityId === "energy-orb",
    )!;
    expect(event.value).toBe(RULES.orbEnergy);
  });
});
