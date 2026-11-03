import { describe, expect, it } from "vitest";
import {
  TargetLock,
  TAP_HEIGHT,
  TAP_RADIUS,
} from "../../apps/client/src/target-lock";

const a = { id: "a", x: 100, y: 100 },
  b = { id: "b", x: 400, y: 120 },
  c = { id: "c", x: 700, y: 500 };

describe("touch target lock", () => {
  it("a tap picks the enemy under it, nearest first, within reach only", () => {
    const lock = new TargetLock();
    expect(lock.pickAt(410, 130, [a, b, c])?.id).toBe("b");
    expect(lock.pickAt(250, 110, [a, b, c])).toBeUndefined();
    expect(lock.pickAt(100 + TAP_RADIUS - 1, 100, [a, b])?.id).toBe("a");
  });
  it("a tap on the body, health bar or name counts, not only one at the feet", () => {
    const lock = new TargetLock();
    // Feet at (400, 120): the body, the health bar and the name above it.
    for (const above of [40, 80, TAP_HEIGHT, TAP_HEIGHT + TAP_RADIUS - 1])
      expect(lock.pickAt(400, 120 - above, [a, b])?.id, `${above}`).toBe("b");
    expect(
      lock.pickAt(400, 120 - TAP_HEIGHT - TAP_RADIUS - 1, [a, b]),
    ).toBeUndefined();
    // Below the feet and to the sides, as before.
    expect(lock.pickAt(400, 120 + TAP_RADIUS + 1, [a, b])).toBeUndefined();
    expect(lock.pickAt(400 + TAP_RADIUS + 1, 60, [a, b])).toBeUndefined();
    // Two enemies one above the other: the nearer column wins.
    const d = { id: "d", x: 400, y: 260 };
    expect(lock.pickAt(400, 200, [b, d])?.id).toBe("d");
    expect(lock.pickAt(400, 100, [b, d])?.id).toBe("b");
  });
  it("locks, unlocks on a second tap, and aims at the locked enemy", () => {
    const lock = new TargetLock();
    expect(lock.resolve([a, b])).toBeUndefined();
    lock.toggle("b");
    expect(lock.resolve([a, b])?.id).toBe("b");
    lock.toggle("b");
    expect(lock.id).toBeUndefined();
  });
  it("keeps the lock while the enemy is hidden, and ends it when it leaves", () => {
    const lock = new TargetLock();
    lock.toggle("c");
    // Stealthed or down: not aimable now (aim falls back to the nearest)...
    expect(lock.resolve([a, b])).toBeUndefined();
    expect(lock.id).toBe("c");
    // ...and back when it is visible again.
    expect(lock.resolve([a, c])?.id).toBe("c");
    lock.keepIf((id) => id !== "c");
    expect(lock.id).toBeUndefined();
  });
});
