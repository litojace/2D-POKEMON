import { describe, expect, it } from "vitest";
import { goldenLevel } from "../../apps/client/src/hub-art/day-light";

describe("the Plaza's golden hour", () => {
  it("glows gold at 17:30 and a little at dawn, never at noon or midnight", () => {
    expect(goldenLevel(0.73)).toBeCloseTo(1);
    expect(goldenLevel(0.27)).toBeCloseTo(0.5);
    expect(goldenLevel(0.5)).toBe(0);
    expect(goldenLevel(0)).toBe(0);
    for (let t = 0; t <= 1; t += 0.01) {
      expect(goldenLevel(t)).toBeGreaterThanOrEqual(0);
      expect(goldenLevel(t)).toBeLessThanOrEqual(1);
    }
  });
});
