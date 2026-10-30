import { beforeEach, describe, expect, it } from "vitest";
import { healthTrail, resetHealthTrails } from "../../apps/client/src/raid-health-trail";

describe("boss health damage trail", () => {
  beforeEach(resetHealthTrails);
  it("holds a hit for a moment, then drains to the bar", () => {
    expect(healthTrail("b", 100, 0)).toBe(100);
    // A hit takes the bar to 80: the chunk stays at 100 while it holds.
    expect(healthTrail("b", 80, 100)).toBe(100);
    expect(healthTrail("b", 80, 500)).toBe(100);
    // After the hold (450 ms) it drains at 60 points a second...
    expect(healthTrail("b", 80, 650)).toBeCloseTo(100 - 0.1 * 60, 5);
    // ...and never below the bar.
    expect(healthTrail("b", 80, 2000)).toBe(80);
  });
  it("a new hit holds the trail again; healing clears it", () => {
    healthTrail("b", 100, 0);
    healthTrail("b", 80, 100);
    healthTrail("b", 80, 700); // draining
    const mid = healthTrail("b", 70, 750); // another hit: hold again
    expect(healthTrail("b", 70, 1100)).toBe(mid);
    expect(healthTrail("b", 95, 1200)).toBe(95);
  });
  it("keeps each bar separate", () => {
    healthTrail("fizz", 100, 0);
    healthTrail("crackle", 100, 0);
    healthTrail("fizz", 50, 10);
    expect(healthTrail("crackle", 100, 20)).toBe(100);
    expect(healthTrail("fizz", 50, 20)).toBe(100);
  });
});
