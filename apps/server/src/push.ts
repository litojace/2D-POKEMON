/**
 * Phone and browser notifications for friends' messages (docs/chat-plan.md).
 *
 * A player turns them on in the chat's gear: their browser gives a Web Push
 * subscription, which the server keeps (migration 20261116100000). When a
 * friend messages them and none of their devices is connected, each device
 * gets a notification saying who it's from: never what it says, so a
 * message's words never leave our server.
 *
 * - At most one notification per pair of friends every 10 minutes: a burst
 *   of messages is one buzz, not ten.
 * - A device its push service says is gone (404/410) is forgotten.
 * - Off unless the server has VAPID keys (PUSH_VAPID_PUBLIC_KEY,
 *   PUSH_VAPID_PRIVATE_KEY): then the client offers nothing.
 */
import webpush from "web-push";

/** A device to notify, as the browser's PushSubscription gives it. */
export interface PushDevice {
  endpoint: string;
  p256dh: string;
  auth: string;
}
export interface PushStore {
  save(player: string, device: PushDevice): Promise<void>;
  remove(endpoint: string): Promise<void>;
  list(player: string): Promise<PushDevice[]>;
}
export type PushResult = "sent" | "gone" | "failed";
export interface PushSender {
  /** The public key browsers subscribe with. */
  readonly publicKey: string;
  send(device: PushDevice, payload: string): Promise<PushResult>;
}
/** What a notification carries (the service worker shows it, sw.ts). */
export interface FriendPushPayload {
  kind: "friend-message";
  title: string;
  body: string;
  /** One notification per friend: a newer one replaces it. */
  tag: string;
  friend: { id: string; name: string };
}

/** One notification per pair of friends this often, at most. */
export const PUSH_EVERY_MS = 10 * 60_000;

export function friendPayload(from: {
  id: string;
  name: string;
}): FriendPushPayload {
  return {
    kind: "friend-message",
    title: "Element Arena",
    body: `New message from ${from.name}`,
    tag: `friend-${from.id}`,
    friend: from,
  };
}

/** Whether a subscription the client sent looks like one (no SSRF, sizes). */
export function validDevice(input: unknown): PushDevice | null {
  const d = input as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  } | null;
  const endpoint = d?.endpoint,
    p256dh = d?.keys?.p256dh,
    auth = d?.keys?.auth;
  if (
    typeof endpoint !== "string" ||
    typeof p256dh !== "string" ||
    typeof auth !== "string" ||
    endpoint.length > 1000 ||
    p256dh.length < 10 ||
    p256dh.length > 200 ||
    auth.length < 4 ||
    auth.length > 100 ||
    !/^[A-Za-z0-9_-]+=*$/.test(p256dh) ||
    !/^[A-Za-z0-9_-]+=*$/.test(auth)
  )
    return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  // Only the browsers' own push services: the server makes a request to
  // this address, so it must never be a place of the client's choosing.
  if (
    url.protocol !== "https:" ||
    !PUSH_HOSTS.some((h) => h.test(url.hostname))
  )
    return null;
  return { endpoint, p256dh, auth };
}
/** Chrome/Android/Edge (FCM), Firefox (Mozilla), Safari and iOS (Apple), Windows. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

export class FriendPush {
  private last = new Map<string, number>();
  constructor(
    private store: PushStore,
    private sender: PushSender,
    private now: () => number = Date.now,
  ) {}
  get publicKey() {
    return this.sender.publicKey;
  }
  /**
   * A friend messaged `to`, who has no device connected: tell their devices
   * (unless they were told about this friend in the last 10 minutes).
   * Resolves with how many devices were sent to.
   */
  async notify(to: string, from: { id: string; name: string }) {
    const key = `${to}:${from.id}`,
      at = this.now();
    if (at - (this.last.get(key) ?? -Infinity) < PUSH_EVERY_MS) return 0;
    this.last.set(key, at);
    if (this.last.size > 5000)
      for (const [k, t] of this.last)
        if (at - t >= PUSH_EVERY_MS) this.last.delete(k);
    const devices = await this.store.list(to);
    const payload = JSON.stringify(friendPayload(from));
    let sent = 0;
    await Promise.all(
      devices.map(async (d) => {
        const r = await this.sender.send(d, payload);
        if (r === "sent") sent++;
        else if (r === "gone")
          await this.store.remove(d.endpoint).catch(() => {});
      }),
    );
    return sent;
  }
  /** They read this friend's messages: the next one notifies again. */
  read(to: string, from: string) {
    this.last.delete(`${to}:${from}`);
  }
}

/** Web Push with the server's VAPID keys, or null when it has none. */
export function webPushSender(
  env: NodeJS.ProcessEnv = process.env,
): PushSender | null {
  const publicKey = env.PUSH_VAPID_PUBLIC_KEY?.trim(),
    privateKey = env.PUSH_VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  const subject = env.PUSH_CONTACT?.trim() || "mailto:privacy@litojace.com";
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (error) {
    console.log("arena-push", JSON.stringify({ off: String(error) }));
    return null;
  }
  return {
    publicKey,
    async send(device, payload) {
      try {
        await webpush.sendNotification(
          {
            endpoint: device.endpoint,
            keys: { p256dh: device.p256dh, auth: device.auth },
          },
          payload,
          // Kept a day by the push service while the phone is off.
          { TTL: 24 * 3600, urgency: "normal" },
        );
        return "sent";
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        return status === 404 || status === 410 ? "gone" : "failed";
      }
    },
  };
}
