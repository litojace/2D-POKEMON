import { describe, expect, it, beforeEach } from "vitest";
import {
  gloomTargets,
  raidTargets,
  resetRaidTargets,
} from "../../apps/client/src/raid-targets";

const state = (o: any = {}) =>
  ({
    raid: {
      boss: "gloomshade",
      decoys: [
        { id: 7, x: 300, y: 300 },
        { id: 8, x: 900, y: 300 },
      ],
      lanterns: [
        { x: 330, y: 210, lit: true, hits: 0 },
        { x: 1270, y: 210, lit: false, hits: 1 },
      ],
      ...o.raid,
    },
    players: [
      { id: "boss", raidBoss: true, hp: 900, x: 600, y: 450 },
      { id: "me", hp: 100, x: 620, y: 470 },
    ],
  }) as any;

describe("raid targets (phones)", () => {
  beforeEach(() => resetRaidTargets());

  it("lists Inkpurr's bodies alike, and only the unlit lanterns", () => {
    const t = gloomTargets(state(), { x: 620, y: 470 })!;
    expect(t.map((x) => x.kind).sort()).toEqual([
      "lantern",
      "shade",
      "shade",
      "shade",
    ]);
    // nearest first
    expect(t[0].id).toBe("shade:boss");
    expect(t.find((x) => x.kind === "lantern")!.label).toBe("Lantern NE");
    // the real body carries nothing the copies don't
    const real = t.find((x) => x.id === "shade:boss")!;
    const copy = t.find((x) => x.id === "shade:7")!;
    expect(Object.keys(real).sort()).toEqual(Object.keys(copy).sort());
    expect(real.label).toMatch(/^Inkpurr [A-C]$/);
  });

  it("hands the letters out at random, so no label points at the real one", () => {
    const realLabels = new Set<string>();
    for (const r of [0, 0.4, 0.99]) {
      resetRaidTargets();
      const t = gloomTargets(state(), { x: 0, y: 0 }, () => r)!;
      realLabels.add(t.find((x) => x.id === "shade:boss")!.label);
      // three bodies, three different letters
      expect(
        new Set(t.filter((x) => x.kind === "shade").map((x) => x.label)).size,
      ).toBe(3);
    }
    expect(realLabels.size).toBeGreaterThan(1);
  });

  it("keeps its letters while the bodies stay, and is Inkpurr alone otherwise", () => {
    const a = gloomTargets(state(), { x: 0, y: 0 })!;
    const b = gloomTargets(state(), { x: 1600, y: 900 })!;
    for (const x of a)
      expect(b.find((y) => y.id === x.id)!.label).toBe(x.label);
    const alone = gloomTargets(state({ raid: { decoys: [] } }), {
      x: 0,
      y: 0,
    })!;
    expect(alone.filter((x) => x.kind === "shade")).toEqual([
      expect.objectContaining({ id: "shade:boss", label: "Inkpurr" }),
    ]);
    expect(
      gloomTargets({ ...state(), raid: { boss: "somnara" } } as any, {
        x: 0,
        y: 0,
      }),
    ).toBeUndefined();
  });

  it("adds the bubbles holding teammates next to Tidewyrm, never your own", () => {
    const tide = (prisons: any[]) =>
      ({
        raid: { boss: "tidewyrm", prisons },
        players: [
          { id: "boss", raidBoss: true, hp: 900, x: 800, y: 300 },
          { id: "me", name: "tester", hp: 100, x: 400, y: 500 },
          { id: "p2", name: "Kai", hp: 100, x: 500, y: 520 },
        ],
      }) as any;
    const me = { id: "me", x: 400, y: 500 };
    expect(raidTargets(tide([]), me)).toBeUndefined();
    // Your own bubble: you mash, nothing to aim at.
    expect(
      raidTargets(tide([{ playerId: "me", x: 400, y: 500 }]), me),
    ).toBeUndefined();
    const t = raidTargets(tide([{ playerId: "p2", x: 520, y: 500 }]), me)!;
    expect(t.map((x) => [x.id, x.kind, x.label])).toEqual([
      ["bubble:p2", "bubble", "Free Kai"],
      ["boss", "boss", "Tidewyrm"],
    ]);
  });
});
