import { describe, expect, it } from "vitest";
import {
  AnnouncementPush,
  announcementPayload,
  type PushDevice,
  type PushResult,
  type PushStore,
} from "../../apps/server/src/push";

const device = (n: number): PushDevice => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${String(n).padStart(3, "0")}`,
  p256dh: "BNcRdreALRFXTkOOUHK1EtK2",
  auth: "tBHItJI5svbpez7K",
});
function fakes(
  count: number,
  outcome: (d: PushDevice) => PushResult = () => "sent",
) {
  let devices = Array.from({ length: count }, (_, i) => device(i));
  const pages: string[] = [];
  const sent: { endpoint: string; payload: any }[] = [];
  let inFlight = 0,
    most = 0;
  const store: PushStore = {
    save: async () => {},
    list: async () => [],
    remove: async (endpoint) => {
      devices = devices.filter((d) => d.endpoint !== endpoint);
    },
    newsPage: async (after, limit) => {
      pages.push(after);
      return devices.filter((d) => d.endpoint > after).slice(0, limit);
    },
    newsCount: async () => devices.length,
  };
  const sender = {
    publicKey: "key",
    send: async (d: PushDevice, payload: string) => {
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      sent.push({ endpoint: d.endpoint, payload: JSON.parse(payload) });
      return outcome(d);
    },
  };
  return {
    store,
    sender,
    pages,
    sent,
    most: () => most,
    left: () => devices.length,
  };
}
const A = { id: 7, message: "Double coins all weekend!", tone: "event" };

describe("announcementPayload", () => {
  it("names the kind and keeps one per announcement", () => {
    expect(announcementPayload(A)).toEqual({
      kind: "announcement",
      title: "Element Arena · Event",
      body: "Double coins all weekend!",
      tag: "announcement-7",
    });
    expect(announcementPayload({ ...A, tone: "info" }).title).toBe(
      "Element Arena",
    );
  });
  it("shortens a long message for the phone", () => {
    const body = announcementPayload({ ...A, message: "x".repeat(300) }).body;
    expect(body).toHaveLength(180);
    expect(body.endsWith("…")).toBe(true);
  });
});

describe("AnnouncementPush", () => {
  it("sends to every device a page at a time, a few at once", async () => {
    const f = fakes(7);
    const push = new AnnouncementPush(f.store, f.sender, 3, 2);
    expect(await push.reach()).toBe(7);
    expect(await push.send(A)).toEqual({ sent: 7, gone: 0, failed: 0 });
    expect(new Set(f.sent.map((s) => s.endpoint)).size).toBe(7);
    expect(f.sent[0].payload.kind).toBe("announcement");
    // Pages of 3 after the last endpoint: "", 002, 005 (6 is the last, short page).
    expect(f.pages).toEqual(["", device(2).endpoint, device(5).endpoint]);
    expect(f.most()).toBeLessThanOrEqual(2);
  });
  it("forgets devices that are gone and counts failures", async () => {
    const f = fakes(4, (d) =>
      d.endpoint.endsWith("001")
        ? "gone"
        : d.endpoint.endsWith("002")
          ? "failed"
          : "sent",
    );
    const push = new AnnouncementPush(f.store, f.sender, 10, 5);
    expect(await push.send(A)).toEqual({ sent: 2, gone: 1, failed: 1 });
    expect(f.left()).toBe(3);
  });
  it("sends one announcement once", async () => {
    const f = fakes(2);
    const push = new AnnouncementPush(f.store, f.sender);
    await push.send(A);
    expect(await push.send(A)).toEqual({ sent: 0, gone: 0, failed: 0 });
    expect(f.sent).toHaveLength(2);
  });
  it("does nothing before the database can list devices", async () => {
    const f = fakes(2);
    const { newsPage, newsCount, ...old } = f.store;
    const push = new AnnouncementPush(old, f.sender);
    expect(push.available).toBe(false);
    expect(await push.send(A)).toEqual({ sent: 0, gone: 0, failed: 0 });
    expect(await push.reach()).toBe(0);
  });
});
