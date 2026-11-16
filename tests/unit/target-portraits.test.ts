import { describe, expect, it } from "vitest";
import {
  controlPreferences,
  lockSlots,
  LOCK_SLOT_MAX,
  LOCK_SLOT_SIZE,
  mobileLayout,
  safeViewport,
} from "../../apps/client/src/mobile-input";
import {
  shownEnemies,
  SWAP_MARGIN,
  type PickerEnemy,
} from "../../apps/client/src/target-picker";

// The target portraits sit on an arc beside the basic attack, clear of every
// combat button, inside the cluster's right edge, one reach from the attack.
describe("target portrait slots", () => {
  for (const [width, height] of [
    [568, 320],
    [667, 375],
    [844, 390],
    [852, 393],
    [932, 430],
    [844, 280],
    [1180, 820],
    [1024, 768],
    [1366, 1024],
  ])
    for (const buttonSize of [0.85, 1, 1.2])
      it(`fit ${width}x${height} at button size ${buttonSize}`, () => {
        const v = safeViewport(width, height, {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        });
        const layout = mobileLayout(
          v.width,
          Math.max(180, v.height - 64),
          controlPreferences({ buttonSize }),
        );
        const slots = lockSlots(layout);
        expect(slots).toHaveLength(LOCK_SLOT_MAX);
        const r = LOCK_SLOT_SIZE / 2;
        const attack = layout.targets.find((t) => t.action === "attack")!;
        const reach = slots.map((s) =>
          Math.hypot(s.x - attack.x, s.y - attack.y),
        );
        for (const d of reach) expect(d).toBeCloseTo(reach[0], 6);
        for (const [i, s] of slots.entries()) {
          // Inside the cluster's right edge, above the attack button.
          expect(s.x + r).toBeLessThanOrEqual(layout.width + 0.01);
          expect(s.y).toBeLessThan(attack.y);
          for (const b of layout.targets)
            expect(
              Math.hypot(s.x - b.x, s.y - b.y) - r - b.size / 2,
            ).toBeGreaterThanOrEqual(5.9);
          for (const o of slots.slice(i + 1))
            expect(Math.hypot(s.x - o.x, s.y - o.y)).toBeGreaterThanOrEqual(
              LOCK_SLOT_SIZE,
            );
        }
        // Slot 0 is the right end; the rest go up and left.
        for (let i = 1; i < slots.length; i++)
          expect(slots[i].x).toBeLessThan(slots[i - 1].x);
      });
});

const enemy = (id: string, distance: number): PickerEnemy => ({
  id,
  name: id,
  color: "#fff",
  available: true,
  distance,
});
describe("which enemies get a portrait", () => {
  const five = [
    enemy("a", 900),
    enemy("b", 100),
    enemy("c", 500),
    enemy("d", 200),
    enemy("e", 300),
  ];
  it("shows all of them when they fit, in their own order", () => {
    expect(
      shownEnemies(five.slice(0, 4), 4, undefined).map((e) => e.id),
    ).toEqual(["a", "b", "c", "d"]);
  });
  it("shows the nearest when they do not, still in order", () => {
    expect(shownEnemies(five, 4, undefined).map((e) => e.id)).toEqual([
      "b",
      "c",
      "d",
      "e",
    ]);
  });
  it("always shows the locked one", () => {
    expect(shownEnemies(five, 4, "a").map((e) => e.id)).toEqual([
      "a",
      "b",
      "d",
      "e",
    ]);
  });
  it("keeps a shown one until another is clearly nearer", () => {
    const shown = new Set(["b", "c", "d", "e"]);
    const moved = five.map((e) =>
      e.id === "a" ? enemy("a", 500 - SWAP_MARGIN + 10) : e,
    );
    expect(shownEnemies(moved, 4, undefined, shown).map((e) => e.id)).toEqual([
      "b",
      "c",
      "d",
      "e",
    ]);
    const nearer = five.map((e) =>
      e.id === "a" ? enemy("a", 500 - SWAP_MARGIN - 10) : e,
    );
    expect(shownEnemies(nearer, 4, undefined, shown).map((e) => e.id)).toEqual([
      "a",
      "b",
      "d",
      "e",
    ]);
  });
});
