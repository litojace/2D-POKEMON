import { describe, expect, it } from "vitest";
import { CHARACTERS, RING, RULES, ringRadius } from "@arena/shared";
import { Arena } from "../../apps/server/src/simulation";
const tick = (a: Arena, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * RULES.tick); i++) a.tick();
};
function duel() {
  const a = new Arena("RING");
  a.add("one", "One", "voltkit");
  a.add("two", "Two", "terradon");
  a.start();
  a.acknowledgeInstructions("one");
  a.acknowledgeInstructions("two");
  tick(a, RULES.countdown + 0.1);
  return a;
}
describe("closing ring", () => {
  it("stays open until the last minute, then shrinks to the centre", () => {
    expect(ringRadius(RULES.roundSeconds)).toBeNull();
    expect(ringRadius(RING.startsBefore + 0.1)).toBeNull();
    expect(ringRadius(RING.startsBefore)).toBeCloseTo(RING.maxRadius);
    expect(ringRadius(RING.startsBefore / 2)).toBeCloseTo(
      (RING.maxRadius + RING.minRadius) / 2,
    );
    expect(ringRadius(0)).toBe(RING.minRadius);
    expect(ringRadius(-5)).toBe(RING.minRadius);
    expect(ringRadius(100, true)).toBe(RING.minRadius);
    // At its widest it covers the whole court.
    expect(RING.maxRadius).toBeGreaterThan(
      Math.hypot(RULES.width / 2, RULES.height / 2),
    );
  });
  it("hurts fighters outside it twice a second, crediting nobody", () => {
    const a = duel();
    const [one, two] = a.players;
    a.deadline = a.time + 5; // ring radius ≈ 230 now
    Object.assign(one, { x: RING.x, y: RING.y });
    Object.assign(two, { x: 1500, y: 450 });
    const before = { one: one.hp, two: two.hp };
    tick(a, 1);
    expect(one.hp).toBe(before.one);
    expect(two.hp).toBeCloseTo(before.two - RING.damage, 0);
    expect(one.stats.dealt).toBe(0);
    const hits = a.events.filter((e) => e.kind === "hit" && e.target === "two");
    expect(hits.length).toBeLessThanOrEqual(3);
    expect(hits.every((e) => (e.value ?? 0) >= 5)).toBe(true);
  });
  it("does nothing early in a round", () => {
    const a = duel();
    const two = a.players[1];
    Object.assign(two, { x: 1550, y: 860 });
    tick(a, 2);
    expect(two.hp).toBe(CHARACTERS.terradon.health);
  });
});
