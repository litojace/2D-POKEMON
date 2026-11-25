import { describe, expect, it } from "vitest";
import { PlazaWorld } from "../../apps/server/src/plaza";
import { positionPlazaVisitor } from "../visual/harness/plaza-position";

const T0 = Date.parse("2026-11-02T21:16:00Z");
function fixture() {
  let real = 0;
  const world = new PlazaWorld(
    () => 0.5,
    () => T0 + real,
  );
  world.join(
    "me",
    "acc",
    {
      name: "Me",
      title: null,
      titleColor: null,
      level: null,
      character: "voltkit",
      skin: null,
    },
    T0,
  );
  const body = world.bodyOf("me")!;
  Object.assign(body, { x: 600, y: 1300 });
  const stepTo = (end: number) => {
    while (real < end) {
      real = Math.min(real + 50, end);
      world.step(0.05, T0 + real);
    }
  };
  stepTo(1000);
  world.input("me", 0, 0, { s: 1, t: 1000 });
  stepTo(1050);
  return {
    world,
    body,
    stepTo,
    arriveAt: (ms: number) => {
      real = ms;
    },
  };
}

describe("Plaza fixture placement with timed inputs", () => {
  it("keeps the destination when an older neutral input arrives", () => {
    const { world, body, arriveAt } = fixture();
    positionPlazaVisitor(world, "me", 1745, 520);
    arriveAt(1060);
    // This is after the last tick, but was sent before the fixture teleport.
    // Replaying its old body used to undo the placement even when stopped.
    world.input("me", 0, 0, { s: 2, t: 1030 });
    expect({ x: body.x, y: body.y }).toEqual({ x: 1745, y: 520 });
  });

  it("still rewinds inputs through history recorded after the placement", () => {
    const { world, body, stepTo, arriveAt } = fixture();
    positionPlazaVisitor(world, "me", 600, 1500);
    stepTo(1150);
    const before = body.x;
    arriveAt(1160);
    world.input("me", 1, 0, { s: 2, t: 1120 });
    // Applied back at 1120 rather than held until the next server tick.
    expect(body.x).toBeGreaterThan(before + 1);
    expect(body.x).toBeLessThan(before + 40);
  });

  it("preserves a future input already queued before placement", () => {
    const { world, body, stepTo } = fixture();
    world.input("me", 1, 0, { s: 2, t: 1200 });
    positionPlazaVisitor(world, "me", 600, 1500);
    stepTo(1250);
    expect(body.x).toBeGreaterThan(600);
    expect(world.view("me")!.state.ack![0]).toBe(2);
  });
});
