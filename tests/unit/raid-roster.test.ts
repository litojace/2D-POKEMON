import { describe, expect, it } from "vitest";
import {
  RAID_BOSSES,
  RAID_BOSS_ORDER,
  nextPacificDayAt,
  pacificDate,
} from "../../packages/shared/src/raid";

describe("raid roster and Pacific calendar", () => {
  it("has seven playable bosses", () => {
    expect(RAID_BOSS_ORDER).toHaveLength(7);
    expect(RAID_BOSS_ORDER.every((id) => RAID_BOSSES[id].playable)).toBe(true);
  });

  it("changes day at midnight Pacific, not UTC", () => {
    // 11:30 p.m. PDT on Oct 17 is already Oct 18 in UTC.
    expect(pacificDate(new Date("2026-10-18T06:30:00Z"))).toBe("2026-10-17");
    expect(pacificDate(new Date("2026-10-18T07:30:00Z"))).toBe("2026-10-18");
    // Winter (PST, UTC-8).
    expect(pacificDate(new Date("2026-12-02T07:59:00Z"))).toBe("2026-12-01");
    expect(pacificDate(new Date("2026-12-02T08:00:00Z"))).toBe("2026-12-02");
  });

  it("finds the next changeover, including the 25-hour day when clocks go back", () => {
    expect(
      new Date(
        nextPacificDayAt(new Date("2026-10-17T20:00:00Z")),
      ).toISOString(),
    ).toBe("2026-10-18T07:00:00.000Z");
    // Nov 1, 2026: 1 a.m. PDT, before the fall-back; the day lasts 25 hours.
    expect(
      new Date(
        nextPacificDayAt(new Date("2026-11-01T08:00:00Z")),
      ).toISOString(),
    ).toBe("2026-11-02T08:00:00.000Z");
    // Mar 8, 2026: spring forward; the day lasts 23 hours.
    expect(
      new Date(
        nextPacificDayAt(new Date("2026-03-08T09:00:00Z")),
      ).toISOString(),
    ).toBe("2026-03-09T07:00:00.000Z");
  });
});
