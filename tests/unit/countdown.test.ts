import { describe, expect, it } from "vitest";
import {
  countdownText,
  nextPacificWeekAt,
  seasonCountdown,
  seasonEndsAt,
  serverDay,
  weeklyCountdown,
} from "../../apps/client/src/ui/countdown";

// The Journey's longer countdowns (UI remodel step 4): weekly goals reset on
// Monday and seasons end with the month, both at Pacific midnight, counted
// on the server's clock (the `now` passed in stands for serverNow()).
describe("server-time countdowns", () => {
  it("writes days and hours, or hours and minutes", () => {
    expect(countdownText(28 * 86400e3 + 6 * 3600e3 + 59e3)).toBe("28 d 6 h");
    expect(countdownText(7 * 3600e3 + 12 * 60e3)).toBe("7 h 12 min");
    expect(countdownText(5 * 60e3)).toBe("5 min");
    expect(countdownText(0)).toBe("1 min");
  });
  it("resets the weekly goals at the next Pacific Monday midnight", () => {
    // Wednesday 4 Nov 2026, 12:00 PST (20:00 UTC) → Monday 9 Nov 00:00 PST (08:00 UTC).
    const now = Date.parse("2026-11-04T20:00:00Z");
    expect(nextPacificWeekAt(now)).toBe(Date.parse("2026-11-09T08:00:00Z"));
    expect(weeklyCountdown(now)).toBe("4 d 12 h");
    // Sunday 23:30 Pacific: half an hour to go.
    expect(weeklyCountdown(Date.parse("2026-11-09T07:30:00Z"))).toBe("30 min");
    // Monday 00:00 sharp: a whole week to the next.
    expect(nextPacificWeekAt(Date.parse("2026-11-09T08:00:00Z"))).toBe(
      Date.parse("2026-11-16T08:00:00Z"),
    );
  });
  it("follows daylight saving time", () => {
    // Clocks go back on Sunday 1 Nov 2026: the Monday after is 08:00 UTC (PST).
    expect(nextPacificWeekAt(Date.parse("2026-10-28T19:00:00Z"))).toBe(
      Date.parse("2026-11-02T08:00:00Z"),
    );
    // Before the change, midnight Pacific is 07:00 UTC (PDT).
    expect(nextPacificWeekAt(Date.parse("2026-10-21T19:00:00Z"))).toBe(
      Date.parse("2026-10-26T07:00:00Z"),
    );
  });
  it("ends a season at the first Pacific midnight of the next month", () => {
    const now = Date.parse("2026-11-04T20:00:00Z");
    expect(seasonEndsAt("2026-11", now)).toBe(
      Date.parse("2026-12-01T08:00:00Z"),
    );
    expect(seasonCountdown("2026-11", now)).toBe("26 d 12 h");
    // December's season ends in January.
    expect(seasonEndsAt("2026-12", Date.parse("2026-12-31T20:00:00Z"))).toBe(
      Date.parse("2027-01-01T08:00:00Z"),
    );
    // An ended season (the server still sends last month) shows no time left.
    expect(seasonEndsAt("2026-10", now)).toBe(now);
    expect(seasonEndsAt("junk", now)).toBe(now);
  });
  it("names today's Pacific date from the server's clock", () => {
    // 04:30 UTC on 18 Oct is still 17 Oct in California.
    expect(serverDay(Date.parse("2026-10-18T04:30:00Z"))).toBe("2026-10-17");
  });
});
