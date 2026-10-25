import { afterEach, expect, it, vi } from "vitest";
import { friendStatus, friendsMarkup } from "../src/friends-view";
import { friendSchema } from "../../../packages/shared/src/accounts";
const now = Date.parse("2026-10-25T12:00:00Z");
const friend = { id: "pal", name: "Pal", online: false };
afterEach(() => vi.useRealTimers());
it("shows elapsed offline time at minute, hour and day boundaries", () => {
  for (const [age, label] of [
    [0, "just now"],
    [59999, "just now"],
    [60000, "1m ago"],
    [3599999, "59m ago"],
    [3600000, "1h ago"],
    [86400000, "1d ago"],
    [3 * 86400000, "3d ago"],
  ] as const)
    expect(
      friendStatus(
        { ...friend, lastOnline: new Date(now - age).toISOString() },
        now,
      ),
    ).toBe("Last online " + label);
});
it("uses a short calendar date for older history and handles clock skew safely", () => {
  expect(
    friendStatus({ ...friend, lastOnline: "2025-08-01T12:00:00Z" }, now),
  ).toMatch(/Last online .*2025/);
  expect(
    friendStatus(
      { ...friend, lastOnline: new Date(now + 60000).toISOString() },
      now,
    ),
  ).toBe("Last online just now");
  for (const lastOnline of [undefined, null, "invalid"])
    expect(friendStatus({ ...friend, lastOnline }, now)).toBe("Offline");
});
it("keeps live activity authoritative over historical timestamps", () => {
  expect(
    friendStatus(
      {
        ...friend,
        online: true,
        activity: "town",
        lastOnline: "2020-01-01T00:00:00Z",
      },
      now,
    ),
  ).toBe("In town");
  expect(
    friendStatus(
      {
        ...friend,
        online: true,
        activity: "match",
        fighter: "tidefin",
        lastOnline: null,
      },
      now,
    ),
  ).toBe("In a match as Tidefin");
});
it("exposes the exact timestamp on a semantic time element only for offline friends", () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const lastOnline = "2026-10-25T11:55:00Z";
  const markup = (online: boolean) =>
    friendsMarkup({
      code: "ABCDEF12",
      incoming: [],
      outgoing: [],
      friends: [{ ...friend, online, lastOnline }],
    });
  expect(markup(false)).toContain('datetime="2026-10-25T11:55:00.000Z"');
  expect(markup(false)).toContain("Last online 5m ago");
  expect(markup(false)).toContain('title="Last online');
  expect(markup(true)).not.toContain("<time");
});
it("accepts missing history from older servers, null history, and ISO timezone offsets", () => {
  for (const lastOnline of [undefined, null, "2026-10-25T10:15:00+02:00"])
    expect(friendSchema.parse({ ...friend, lastOnline }).lastOnline).toBe(
      lastOnline,
    );
  expect(
    friendSchema.safeParse({ ...friend, lastOnline: "not a date" }).success,
  ).toBe(false);
});
