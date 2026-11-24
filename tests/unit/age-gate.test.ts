import { describe, expect, it } from "vitest";
import { MIN_AGE, underAge } from "../../apps/client/src/age-gate";

// The neutral age question before a new account (age-gate.ts).
describe("under 13", () => {
  const now = new Date(2026, 10, 13); // 13 November 2026
  it("counts by month and year: 13 this month or earlier is old enough", () => {
    expect(MIN_AGE).toBe(13);
    expect(underAge(2013, 11, now)).toBe(false); // 13 this month
    expect(underAge(2013, 10, now)).toBe(false); // 13 last month
    expect(underAge(2013, 12, now)).toBe(true); // 13 next month
    expect(underAge(2014, 1, now)).toBe(true);
    expect(underAge(2000, 6, now)).toBe(false);
    expect(underAge(2026, 11, now)).toBe(true);
  });
  it("turns over in January", () => {
    const january = new Date(2027, 0, 5);
    expect(underAge(2014, 1, january)).toBe(false);
    expect(underAge(2014, 2, january)).toBe(true);
  });
});
