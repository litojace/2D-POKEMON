import { expect, it } from "vitest";
import {
  ConnectionWatch,
  RECENT_MS,
  dropMessage,
} from "../../apps/client/src/connection-loss";
import { connectionReportSchema } from "../../packages/shared/src/connection";

const drop = {
  reason: "transport close",
  transport: "websocket",
  hiddenNow: false,
  offlineNow: false,
  report: true,
};

it("reports a drop once after reconnecting, with the time away", () => {
  let now = 1_000_000;
  const watch = new ConnectionWatch(() => now);
  watch.dropped(drop);
  now += 7_400;
  const report = watch.reconnected();
  expect(report).toEqual({
    reason: "transport close",
    transport: "websocket",
    hidden: false,
    offline: false,
    away: 7,
  });
  expect(connectionReportSchema.safeParse(report).success).toBe(true);
  expect(watch.reconnected()).toBeUndefined();
});

it("does not report drops outside a room", () => {
  const watch = new ConnectionWatch(() => 0);
  watch.dropped({ ...drop, report: false });
  expect(watch.reconnected()).toBeUndefined();
});

it("puts a drop down to a hidden page or lost network only when recent", () => {
  let now = 1_000_000;
  const watch = new ConnectionWatch(() => now);
  // The page went to the background and came back 10 s later; the dead
  // connection is only noticed 20 s after that.
  watch.visibility();
  now += 10_000;
  watch.visibility();
  now += 20_000;
  expect(watch.dropped(drop).hidden).toBe(true);
  // Long after the last hidden spell, it no longer counts.
  now += RECENT_MS;
  expect(watch.dropped(drop).hidden).toBe(false);
  // Hidden right now always counts; so does being offline right now.
  expect(watch.dropped({ ...drop, hiddenNow: true }).hidden).toBe(true);
  expect(watch.dropped({ ...drop, offlineNow: true }).offline).toBe(true);
  watch.network();
  now += 5_000;
  expect(watch.dropped(drop).offline).toBe(true);
});

it("explains drops in plain language and stays quiet when the server explains", () => {
  const base = { hidden: false, offline: false };
  expect(
    dropMessage({ ...base, reason: "transport close", hidden: true }),
  ).toBe("Connection lost while the game was in the background. Reconnecting…");
  expect(dropMessage({ ...base, reason: "ping timeout", offline: true })).toBe(
    "Your device lost its internet connection. Reconnecting…",
  );
  expect(dropMessage({ ...base, reason: "ping timeout" })).toBe(
    "The connection stopped responding. Reconnecting…",
  );
  expect(dropMessage({ ...base, reason: "transport error" })).toBe(
    "The network connection dropped. Reconnecting…",
  );
  expect(dropMessage({ ...base, reason: "io server disconnect" })).toBe(
    undefined,
  );
  expect(dropMessage({ ...base, reason: "io client disconnect" })).toBe(
    undefined,
  );
});
