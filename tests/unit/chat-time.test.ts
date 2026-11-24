import { describe, expect, it } from "vitest";
import {
  needsStamp,
  stampText,
  STAMP_GAP_MS,
} from "../../apps/client/src/chat/chat-time";

// Local times (whatever the machine's time zone): Mon 16 Nov 2026, 9:42 PM.
const now = new Date(2026, 10, 16, 21, 42).getTime();
const at = (d: number, h: number, m = 0, y = 2026, mo = 10) =>
  new Date(y, mo, d, h, m).getTime();

describe("needsStamp", () => {
  it("stamps the first line", () => {
    expect(needsStamp(now, null)).toBe(true);
  });
  it("not a line soon after the one before", () => {
    expect(needsStamp(now, now - STAMP_GAP_MS + 1000)).toBe(false);
  });
  it("a line 5 minutes or more after the one before", () => {
    expect(needsStamp(now, now - STAMP_GAP_MS)).toBe(true);
  });
  it("the first line of a new day, even a minute later", () => {
    expect(needsStamp(at(17, 0, 0), at(16, 23, 59))).toBe(true);
  });
});

describe("stampText", () => {
  const t = (x: number) => stampText(x, now, "en-US");
  it("today: the time", () => expect(t(at(16, 9, 5))).toBe("9:05 AM"));
  it("yesterday", () => expect(t(at(15, 23, 30))).toBe("Yesterday 11:30 PM"));
  it("this week: the weekday", () =>
    expect(t(at(11, 8, 0))).toBe("Wed 8:00 AM"));
  it("a week or more: the date", () =>
    expect(t(at(9, 14, 15))).toBe("Nov 9, 2:15 PM"));
  it("another year: with the year", () =>
    expect(t(at(3, 7, 0, 2025))).toBe("Nov 3, 2025, 7:00 AM"));
  it("follows the device's hour format", () =>
    expect(stampText(at(16, 21, 42), now, "en-GB")).toBe("21:42"));
});
