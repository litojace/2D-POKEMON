import { expect, it } from "vitest";
import { TargetLock } from "../../apps/client/src/target-lock";

it("the target button steps through the enemies on screen, then lets go", () => {
  const lock = new TargetLock();
  const near = ["a", "b", "c"];
  lock.cycle(near);
  expect(lock.id).toBe("a");
  lock.cycle(near);
  expect(lock.id).toBe("b");
  lock.cycle(near);
  expect(lock.id).toBe("c");
  // Past the last one: automatic aiming again.
  lock.cycle(near);
  expect(lock.id).toBeUndefined();
  lock.cycle(near);
  expect(lock.id).toBe("a");
});

it("one enemy: lock, let go", () => {
  const lock = new TargetLock();
  lock.cycle(["a"]);
  expect(lock.id).toBe("a");
  lock.cycle(["a"]);
  expect(lock.id).toBeUndefined();
});

it("a lock on an enemy now off screen starts again from the nearest", () => {
  const lock = new TargetLock();
  lock.toggle("z");
  lock.cycle(["a", "b"]);
  expect(lock.id).toBe("a");
});

it("nobody on screen: nothing changes (the button is off)", () => {
  const lock = new TargetLock();
  lock.toggle("a");
  lock.cycle([]);
  expect(lock.id).toBe("a");
});

it("enemies trading places between taps never send it back to the last one", () => {
  const lock = new TargetLock();
  lock.cycle(["a", "b"]);
  expect(lock.id).toBe("a");
  // b is nearer now.
  lock.cycle(["b", "a"]);
  expect(lock.id).toBe("b");
  // a nearer again: both have been locked, so it lets go.
  lock.cycle(["a", "b"]);
  expect(lock.id).toBeUndefined();
  // A fresh round starts from the nearest.
  lock.cycle(["b", "a"]);
  expect(lock.id).toBe("b");
});

it("a lock let go another way starts a fresh round", () => {
  const lock = new TargetLock();
  lock.cycle(["a", "b"]);
  lock.clear();
  lock.cycle(["a", "b"]);
  expect(lock.id).toBe("a");
});
