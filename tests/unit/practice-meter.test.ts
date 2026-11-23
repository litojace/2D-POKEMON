import { describe, expect, it } from "vitest";
import { practiceMeter } from "../../apps/client/src/practice-meter";

describe("practice damage meter", () => {
  it("shows the last hit and the damage per second over 5 seconds", () => {
    const m = practiceMeter();
    expect(m.update(0, 1)).toEqual({ lastHit: 0, dps: 0 });
    expect(m.update(20, 2)).toEqual({ lastHit: 20, dps: 4 });
    // No new damage: the last hit stays.
    expect(m.update(20, 3)).toEqual({ lastHit: 20, dps: 4 });
    expect(m.update(50, 4)).toEqual({ lastHit: 30, dps: 10 });
    // The first hit leaves the window after 5 seconds.
    expect(m.update(50, 7.5)).toEqual({ lastHit: 30, dps: 6 });
    expect(m.update(50, 10)).toEqual({ lastHit: 30, dps: 0 });
  });
  it("starts over when the arena resets", () => {
    const m = practiceMeter();
    m.update(40, 2);
    // Reset arena: the total goes back to 0.
    expect(m.update(0, 2.1)).toEqual({ lastHit: 0, dps: 0 });
    expect(m.update(15, 3)).toEqual({ lastHit: 15, dps: 3 });
    // A new session: the clock goes back.
    expect(m.update(15, 0.5)).toEqual({ lastHit: 0, dps: 0 });
    expect(m.update(25, 1)).toEqual({ lastHit: 10, dps: 2 });
  });
});
