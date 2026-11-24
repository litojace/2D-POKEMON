import { afterEach, describe, expect, it, vi } from "vitest";
import {
  noteServerTime,
  resetServerClock,
  serverClockKnown,
  serverNow,
} from "../../apps/client/src/server-clock";
import { picksCountdown } from "../../apps/client/src/shop-ui";

afterEach(() => {
  resetServerClock();
  vi.useRealTimers();
});

describe("the server clock", () => {
  it("is the device clock until a server answer arrives", () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-03T12:00:00Z") });
    expect(serverClockKnown()).toBe(false);
    expect(serverNow()).toBe(Date.parse("2026-11-03T12:00:00Z"));
  });
  it("follows the server, taking the middle of the request as its moment", () => {
    // The device is 3 hours fast; the request took 400 ms.
    const device = Date.parse("2026-11-03T15:00:00Z");
    vi.useFakeTimers({ now: device + 400 });
    noteServerTime(
      String(Date.parse("2026-11-03T12:00:00.200Z")),
      device,
      device + 400,
    );
    expect(serverClockKnown()).toBe(true);
    expect(serverNow()).toBe(Date.parse("2026-11-03T12:00:00.400Z"));
  });
  it("ignores answers without a usable time", () => {
    vi.useFakeTimers({ now: 1_800_000_000_000 });
    for (const header of [null, "", "0", "soon", "12345"])
      noteServerTime(header, 1_800_000_000_000, 1_800_000_000_000);
    expect(serverClockKnown()).toBe(false);
    expect(serverNow()).toBe(1_800_000_000_000);
  });
  it("drives the daily countdown, whatever the device clock says", () => {
    // Server: 21:30 PDT on Oct 17 (04:30 UTC Oct 18), 2 h 30 min to Pacific midnight.
    // Device: a day behind.
    const device = Date.parse("2026-10-17T04:30:00Z");
    vi.useFakeTimers({ now: device });
    noteServerTime(String(Date.parse("2026-10-18T04:30:00Z")), device, device);
    expect(picksCountdown()).toBe("2 h 30 min");
  });
});
