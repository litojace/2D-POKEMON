import { expect, it } from "vitest";
import { auraFlourish, entranceFlourish } from "../../apps/client/src/skins/tier-fx";
import { cosmeticTier } from "../../packages/shared/src/cosmetic-tier";

function graphics() {
  let n = 0;
  const g: any = new Proxy({}, { get: () => () => (n++, g) });
  return { g, count: () => n };
}
const auraCost = (id: string) => {
  const { g, count } = graphics();
  auraFlourish(g, id, 0, 0, 1234, false, 0.375);
  return count();
};

it("pricier and harder-won auras get grander flourishes", () => {
  // One aura per tier: rare, epic, legendary, mythic.
  expect(cosmeticTier("candy-aura")).toBe("rare");
  expect(cosmeticTier("winter-aura")).toBe("epic");
  expect(cosmeticTier("tidal-aura")).toBe("legendary");
  expect(cosmeticTier("galaxy-aura")).toBe("mythic");
  const costs = ["candy-aura", "winter-aura", "tidal-aura", "galaxy-aura"].map(auraCost);
  for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1]);
  // Bounded even at the top tier.
  expect(costs[3]).toBeLessThan(120);
});

it("entrances gain shockwaves, a light pillar and prismatic sparks by tier", () => {
  const burst = (id: string) => {
    const shapes: string[] = [];
    entranceFlourish((p) => shapes.push(p.shape), id, 0, 0, 1);
    return shapes;
  };
  expect(burst("candy-entrance")).toEqual([]); // rare: its own burst only
  expect(burst("winter-entrance")).toContain("shock"); // epic
  expect(burst("winter-entrance")).not.toContain("beam");
  expect(burst("galaxy-entrance")).toContain("beam"); // mythic
  expect(burst("galaxy-entrance").filter((s) => s === "shock")).toHaveLength(3);
});
