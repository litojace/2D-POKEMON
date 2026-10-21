import { describe, expect, it } from "vitest";
import {
  RAID_BOSSES,
  RAID_BOSS_ORDER,
  RAID_DAY_SCHEDULE,
  featuredOn,
  nextRaidDayAt,
  pacificDate,
  raidDay,
  raidWeekDays,
} from "../../packages/shared/src/raid";

describe("raid roster and Raid of the Day", () => {
  it("has seven bosses, one for each day of the week", () => {
    expect(RAID_BOSS_ORDER).toHaveLength(7);
    expect(new Set(RAID_DAY_SCHEDULE).size).toBe(7);
    expect(RAID_DAY_SCHEDULE).toEqual([
      "prismatail",
      "gloomshade",
      "emberwing",
      "somnara",
      "storm-twins",
      "tidewyrm",
      "grumblecrag",
    ]);
    expect(RAID_BOSS_ORDER.every(id => RAID_BOSSES[id].playable)).toBe(true);
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
    expect(new Date(nextRaidDayAt(new Date("2026-10-17T20:00:00Z"))).toISOString()).toBe(
      "2026-10-18T07:00:00.000Z",
    );
    // Nov 1, 2026: 1 a.m. PDT, before the fall-back; the day lasts 25 hours.
    expect(new Date(nextRaidDayAt(new Date("2026-11-01T08:00:00Z"))).toISOString()).toBe(
      "2026-11-02T08:00:00.000Z",
    );
    // Mar 8, 2026: spring forward; the day lasts 23 hours.
    expect(new Date(nextRaidDayAt(new Date("2026-03-08T09:00:00Z"))).toISOString()).toBe(
      "2026-03-09T07:00:00.000Z",
    );
  });

  it("features the scheduled boss when it's built, otherwise a built one", () => {
    // Oct 17, 2026 is a Saturday: Grumblecrag's day.
    const saturday = featuredOn("2026-10-17");
    expect(saturday.weekday).toBe(6);
    expect(saturday.boss).toBe("grumblecrag");
    // Oct 18 is a Sunday (Prismatail).
    const sunday = featuredOn("2026-10-18");
    expect(sunday.scheduled).toBe("prismatail");
    expect(RAID_BOSSES[sunday.boss].playable).toBe(true);
    expect(sunday.seed).not.toBe(saturday.seed);
    expect(sunday.peril).toBe(2);
  });

  it("is the same for everyone all day long", () => {
    expect(raidDay(new Date("2026-10-17T07:01:00Z"))).toEqual(
      raidDay(new Date("2026-10-18T06:59:00Z")),
    );
  });

  it("lists the current Sunday-to-Saturday week", () => {
    const week = raidWeekDays("2026-10-14");
    expect(week.map((d) => d.day)).toEqual([
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
    ]);
    expect(week.map((d) => d.scheduled)).toEqual(RAID_DAY_SCHEDULE);
    expect(week.map((d) => d.boss)).toEqual(RAID_DAY_SCHEDULE);
  });
});
