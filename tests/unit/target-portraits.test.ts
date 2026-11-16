import { describe, expect, it } from "vitest";
import {
  controlPreferences,
  lockSlots,
  LOCK_HUD_BOTTOM,
  LOCK_PAD_EDGE,
  LOCK_ROW_CLEAR,
  LOCK_ROW_REACH,
  LOCK_SLOT_GAP,
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

// The target portraits sit in one straight row over the combat cluster:
// one height, even spacing, right end in line with the topmost button's
// right edge (the ultimate), clear of every button, the top HUD, the gear
// and the raid timer under it, on the right of the screen.
/** Where the battle puts the cluster: the touch pad's bottom-right corner,
 * 16 px in from the right and 14 px up from the bottom (style.css). */
const PAD = { right: 16, bottom: 14 };
/** Top-right: the gear (4..48) and the raid timer under it (to 80). */
const gearColumn = (width: number) => ({
  left: width - 48,
  right: width - 4,
  top: 4,
  bottom: 80,
});
function rowAt(width: number, height: number, buttonSize = 1) {
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
  const origin = {
    x: width - PAD.right - layout.width,
    y: height - PAD.bottom - layout.height,
  };
  const slots = lockSlots(layout, {
    top: LOCK_HUD_BOTTOM - origin.y,
    reach: v.width * LOCK_ROW_REACH - LOCK_PAD_EDGE,
  });
  return { layout, origin, slots };
}
/** A straight, evenly spaced row, clear of everything (cluster coordinates). */
function expectTidyRow(
  width: number,
  height: number,
  { layout, origin, slots }: ReturnType<typeof rowAt>,
) {
  const r = LOCK_SLOT_SIZE / 2;
  for (const s of slots) expect(Math.abs(s.y - slots[0].y)).toBeLessThan(0.5);
  for (let i = 1; i < slots.length; i++) {
    // Slot 0 is the right end; the rest step left by the same amount.
    expect(
      Math.abs(slots[i - 1].x - slots[i].x - (LOCK_SLOT_SIZE + LOCK_SLOT_GAP)),
    ).toBeLessThan(0.5);
  }
  const gear = gearColumn(width);
  for (const s of slots) {
    for (const b of layout.targets) {
      // Every button (round) by 6 px or more, and the row's box too.
      expect(
        Math.hypot(s.x - b.x, s.y - b.y) - r - b.size / 2,
      ).toBeGreaterThanOrEqual(5.99);
      const apart =
        s.x + r + 6 <= b.x - b.size / 2 + 0.01 ||
        b.x + b.size / 2 + 6 <= s.x - r + 0.01 ||
        s.y + r + 6 <= b.y - b.size / 2 + 0.01;
      expect(apart).toBe(true);
    }
    const screen = {
      left: origin.x + s.x - r,
      right: origin.x + s.x + r,
      top: origin.y + s.y - r,
      bottom: origin.y + s.y + r,
    };
    // On screen, on its right side, under the top HUD, beside the gear
    // column.
    expect(screen.left).toBeGreaterThanOrEqual(width * 0.55);
    expect(screen.right).toBeLessThanOrEqual(width);
    expect(screen.top).toBeGreaterThanOrEqual(LOCK_HUD_BOTTOM - 0.01);
    expect(screen.bottom).toBeLessThanOrEqual(height);
    expect(screen.right + 6 <= gear.left || screen.top >= gear.bottom + 6).toBe(
      true,
    );
  }
}
const PHONES_AND_IPADS = [
  [667, 375],
  [844, 390],
  [852, 393],
  [932, 430],
  [844, 280],
  [1180, 820],
  [1024, 768],
] as const;
describe("target portrait slots", () => {
  for (const [width, height] of PHONES_AND_IPADS)
    for (const buttonSize of [0.85, 1])
      it(`one straight row of four at ${width}x${height} (buttons ${buttonSize})`, () => {
        const row = rowAt(width, height, buttonSize);
        expect(row.slots).toHaveLength(LOCK_SLOT_MAX);
        expectTidyRow(width, height, row);
        // Just over the cluster, its right end on the ultimate's right edge.
        const ult = row.layout.targets.find((t) => t.action === "3")!;
        expect(row.slots[0].x + LOCK_SLOT_SIZE / 2).toBeCloseTo(
          ult.x + ult.size / 2,
          6,
        );
        const top = Math.min(
          ...row.layout.targets.map((t) => t.y - t.size / 2),
        );
        expect(row.slots[0].y + LOCK_SLOT_SIZE / 2).toBeCloseTo(
          top - LOCK_ROW_CLEAR,
          6,
        );
      });
  // The biggest buttons and the oldest small phone: still one tidy row,
  // with fewer portraits where four would reach the court's middle, or
  // beside the cluster where it reaches the top HUD.
  const caps: Record<string, number> = {
    "568x320": 2,
    "844x280": 3,
  };
  for (const [width, height] of [...PHONES_AND_IPADS, [568, 320]] as const)
    it(`a tidy row at ${width}x${height} with the biggest buttons`, () => {
      const row = rowAt(width, height, 1.2);
      expect(row.slots).toHaveLength(caps[`${width}x${height}`] ?? 4);
      expectTidyRow(width, height, row);
    });
  it("a tidy row on the oldest small phone (compact controls)", () => {
    const row = rowAt(568, 320);
    expect(row.layout.compact).toBe(true);
    expect(row.slots).toHaveLength(2);
    expectTidyRow(568, 320, row);
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
