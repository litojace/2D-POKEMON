/**
 * "Notify me" for friends' messages (the chat's gear; the server's push.ts).
 *
 * What this device can do decides what the gear shows:
 * - on / off: the browser can get notifications (Chrome, Edge, Firefox,
 *   Android, desktop Safari, and an iPhone's Home Screen app);
 * - install-first: an iPhone or iPad in Safari, where web notifications only
 *   work once the game is added to the Home Screen (iOS 16.4+);
 * - blocked: the player said no in the browser; only its settings undo it;
 * - unsupported: nothing to offer (the gear hides the row), as in the iPhone
 *   app until its own notifications arrive.
 */
import { isNativeApp } from "../native";

export type PushState =
  "on" | "off" | "install-first" | "blocked" | "unsupported";
interface Reply {
  ok: boolean;
  error?: string;
}
/** Asks the server (socket request): push-subscribe / push-unsubscribe. */
export type PushRequest = (event: string, data: unknown) => Promise<Reply>;

const ios = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const homeScreen = () =>
  matchMedia("(display-mode: standalone)").matches ||
  (navigator as { standalone?: boolean }).standalone === true;
const canPush = () =>
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

async function subscription() {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** What this device can do now. */
export async function pushState(): Promise<PushState> {
  if (isNativeApp()) return "unsupported";
  if (!canPush())
    return ios() && !homeScreen() ? "install-first" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  try {
    return (await subscription()) ? "on" : "off";
  } catch {
    return "off";
  }
}

/** The server's VAPID key (base64url) as the bytes PushManager wants. */
function keyBytes(key: string) {
  const b64 = (key + "=".repeat((4 - (key.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * Turn them on: ask the browser (call this straight from a tap, before any
 * other await: Safari only asks inside one), subscribe, tell the server.
 */
export async function turnPushOn(
  key: string,
  ask: PushRequest,
): Promise<Reply> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    return {
      ok: false,
      error:
        permission === "denied"
          ? "Notifications are blocked for this game in your browser settings."
          : "Notifications stay off.",
    };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key),
      }));
    const reply = await ask("push-subscribe", sub.toJSON());
    if (!reply.ok) await sub.unsubscribe().catch(() => {});
    return reply;
  } catch {
    return { ok: false, error: "Couldn't turn notifications on. Try again." };
  }
}

/** Turn them off on this device (and tell the server, when it can hear). */
export async function turnPushOff(ask?: PushRequest): Promise<Reply> {
  try {
    const sub = await subscription();
    if (!sub) return { ok: true };
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    // Even unheard, the push service now refuses this address, and the
    // server forgets it the next time it tries.
    if (ask) await ask("push-unsubscribe", { endpoint }).catch(() => null);
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't turn notifications off. Try again." };
  }
}
