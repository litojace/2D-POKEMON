import { describe, expect, it } from "vitest";
import {
  FriendPush,
  PUSH_EVERY_MS,
  friendPayload,
  validDevice,
  type PushDevice,
  type PushResult,
} from "../../apps/server/src/push";

const keys = {
  p256dh:
    "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
  auth: "tBHItJI5svbpez7KI4CCXg",
};

describe("validDevice", () => {
  it("takes a browser push service's subscription", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc:xyz",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
      "https://web.push.apple.com/QGuQyavXutnMH",
      "https://wns2-par02p.notify.windows.com/w/?token=AwYAAA",
    ])
      expect(validDevice({ endpoint, keys })).toEqual({ endpoint, ...keys });
  });
  it("refuses any other address (the server would call it)", () => {
    for (const endpoint of [
      "http://fcm.googleapis.com/fcm/send/x",
      "https://evil.example/fcm.googleapis.com",
      "https://fcm.googleapis.com.evil.example/x",
      "https://localhost/push",
      "https://169.254.169.254/latest",
      "not a url",
    ])
      expect(validDevice({ endpoint, keys })).toBeNull();
  });
  it("refuses keys that aren't base64url, or are missing", () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/x";
    expect(
      validDevice({ endpoint, keys: { ...keys, auth: "a b c d" } }),
    ).toBeNull();
    expect(validDevice({ endpoint })).toBeNull();
    expect(validDevice(null)).toBeNull();
  });
});

describe("friendPayload", () => {
  it("says who, never what", () => {
    expect(friendPayload({ id: "p1", name: "Pal" })).toEqual({
      kind: "friend-message",
      title: "Element Arena",
      body: "New message from Pal",
      tag: "friend-p1",
      friend: { id: "p1", name: "Pal" },
    });
  });
});

describe("FriendPush", () => {
  const setup = (results: Record<string, PushResult> = {}) => {
    let clock = 1_000_000;
    const devices: Record<string, PushDevice[]> = {
      me: [
        { endpoint: "https://fcm.googleapis.com/a", ...keys },
        { endpoint: "https://fcm.googleapis.com/b", ...keys },
      ],
    };
    const sent: [string, string][] = [];
    const removed: string[] = [];
    const push = new FriendPush(
      {
        save: async () => {},
        remove: async (e) => void removed.push(e),
        list: async (p) => devices[p] ?? [],
      },
      {
        publicKey: "pub",
        send: async (d, payload) => {
          sent.push([d.endpoint, payload]);
          return results[d.endpoint] ?? "sent";
        },
      },
      () => clock,
    );
    return { push, sent, removed, tick: (ms: number) => (clock += ms) };
  };
  it("notifies every device of the player", async () => {
    const t = setup();
    expect(await t.push.notify("me", { id: "pal", name: "Pal" })).toBe(2);
    expect(JSON.parse(t.sent[0][1]).body).toBe("New message from Pal");
  });
  it("once per friend every 10 minutes, then again", async () => {
    const t = setup();
    await t.push.notify("me", { id: "pal", name: "Pal" });
    expect(await t.push.notify("me", { id: "pal", name: "Pal" })).toBe(0);
    // Another friend isn't held back.
    expect(await t.push.notify("me", { id: "bo", name: "Bo" })).toBe(2);
    t.tick(PUSH_EVERY_MS);
    expect(await t.push.notify("me", { id: "pal", name: "Pal" })).toBe(2);
  });
  it("after reading a friend, their next message notifies at once", async () => {
    const t = setup();
    await t.push.notify("me", { id: "pal", name: "Pal" });
    t.push.read("me", "pal");
    expect(await t.push.notify("me", { id: "pal", name: "Pal" })).toBe(2);
  });
  it("forgets a device its push service says is gone", async () => {
    const t = setup({ "https://fcm.googleapis.com/a": "gone" });
    expect(await t.push.notify("me", { id: "pal", name: "Pal" })).toBe(1);
    expect(t.removed).toEqual(["https://fcm.googleapis.com/a"]);
  });
  it("a player with no devices: nothing", async () => {
    const t = setup();
    expect(await t.push.notify("nobody", { id: "pal", name: "Pal" })).toBe(0);
  });
});
