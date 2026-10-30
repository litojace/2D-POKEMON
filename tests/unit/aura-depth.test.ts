import { describe, expect, it } from "vitest";
import { AURA_LIFT, drawCollectionAura } from "../../apps/client/src/skins/collection-fx";
import { traitAura } from "../../apps/client/src/trait-effects";

/** A Graphics stand-in that records the y of every filled shape. */
function layer() {
  const ys: number[] = [];
  const g: any = new Proxy(
    {},
    {
      get: (_t, key) =>
        (...args: number[]) => {
          if (typeof key === "string" && key.startsWith("fill") && key !== "fillStyle") ys.push(args[1]);
          return g;
        },
    },
  );
  return { g, ys };
}

describe("aura items circle in front of and behind the fighter", () => {
  it("near-side items draw on the front layer, far-side ones behind", () => {
    const back = layer(),
      front = layer();
    // Galaxy: 6 sparkles at 60° apart, at t=1000 none sits exactly on the sides.
    drawCollectionAura(back.g, "galaxy-aura", 0, 0, 1000, false, front.g);
    expect(front.ys.length).toBeGreaterThan(0);
    // Items circle at hip height: the ones in front are on the near half of
    // that circle (lower on screen), the ones behind on the far half.
    const items = (ys: number[]) => ys.filter((y) => y !== 0);
    expect(items(front.ys).every((y) => y > -AURA_LIFT)).toBe(true);
    expect(items(back.ys).length).toBeGreaterThan(0);
    expect(items(back.ys).every((y) => y <= -AURA_LIFT)).toBe(true);
  });
  it("lies on the shadow's plane: same centre and flatness", () => {
    const back = layer(),
      front = layer();
    // Battle shadow 48×18: items stay within the ring's height on that plane.
    drawCollectionAura(back.g, "galaxy-aura", 0, 0, 1000, false, front.g, 18 / 48, 0);
    const items = [...back.ys, ...front.ys].filter((y) => y !== 0);
    // Six sparkles of four triangles each.
    expect(items.length).toBe(24);
    // Ring half-height 18, plus a sparkle's own half-size (2.4 × 1.16 × 0.35).
    for (const y of items) expect(Math.abs(y)).toBeLessThanOrEqual(18 + 1);
    expect(front.ys.filter((y) => y !== 0).every((y) => y > 0)).toBe(true);
    expect(back.ys.filter((y) => y !== 0).every((y) => y < 0)).toBe(true);
  });
  it("without a front layer everything still draws (frame fighters)", () => {
    const back = layer();
    drawCollectionAura(back.g, "galaxy-aura", 0, 0, 1000, false);
    expect(back.ys.some((y) => y > -AURA_LIFT)).toBe(true);
  });
});

describe("menu orbits pass behind and in front of the creature", () => {
  it("each orbiting item has a copy behind and one in front on one clock", () => {
    const aura = traitAura("voltkit");
    const motions = (s: string) => (s.match(/<animateMotion/g) ?? []).length;
    expect(motions(aura.front)).toBe(6);
    expect(motions(aura.back)).toBe(6);
    // Far half first (clockwise from the left end): hidden in front until halfway.
    expect(aura.front).toContain('values="hidden;visible"');
    expect(aura.back).toContain('values="visible;hidden"');
  });
  it("a still picture puts each item on the side it is on", () => {
    const aura = traitAura("voltkit", true);
    const count = (s: string) => (s.match(/<g transform="translate/g) ?? []).length;
    expect(count(aura.front) + count(aura.back)).toBe(6);
    expect(count(aura.front)).toBeGreaterThan(0);
    expect(count(aura.back)).toBeGreaterThan(0);
  });
});
