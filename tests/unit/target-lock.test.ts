import { describe, expect, it } from "vitest";
import { TargetLock, TAP_RADIUS } from "../../apps/client/src/target-lock";

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
