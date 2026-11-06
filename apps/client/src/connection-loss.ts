import type { ConnectionReport } from "../../../packages/shared/src/connection";

/**
 * A drop is put down to the page being hidden, or the device being offline,
 * when that happened within this long before Socket.IO noticed. A silently
 * dead connection takes up to pingInterval + pingTimeout (45 s by default)
 * to be noticed, so the window has to cover that.
 */
export const RECENT_MS = 60_000;

type Drop = Omit<ConnectionReport, "away"> & { at: number };

/**
 * Remembers why the game connection last dropped, for the message shown to
 * the player and for the report sent to the server after reconnecting.
 */
export class ConnectionWatch {
  private hiddenAt = -Infinity;
  private offlineAt = -Infinity;
  private drop: Drop | undefined;
  constructor(private readonly now: () => number = Date.now) {}
  /** Call on every visibility change: both ends of a hidden spell count. */
  visibility() {
    this.hiddenAt = this.now();
  }
  /** Call on the browser's "offline" and "online" events. */
  network() {
    this.offlineAt = this.now();
  }
  /**
   * The socket disconnected. `report` is false when nothing should be sent
   * later (the player was not in a room, or the drop was deliberate).
   */
  dropped(options: {
    reason: string;
    transport: string;
    hiddenNow: boolean;
    offlineNow: boolean;
    report: boolean;
  }) {
    const now = this.now();
    const drop: Drop = {
      reason: options.reason.slice(0, 40) || "unknown",
      transport: options.transport.slice(0, 20) || "unknown",
      hidden: options.hiddenNow || now - this.hiddenAt < RECENT_MS,
      offline: options.offlineNow || now - this.offlineAt < RECENT_MS,
      at: now,
    };
    this.drop = options.report ? drop : undefined;
    return drop;
  }
  /** The report for the last drop, once; undefined if there is none. */
  reconnected(): ConnectionReport | undefined {
    const drop = this.drop;
    this.drop = undefined;
    if (!drop) return undefined;
    const { at, ...rest } = drop;
    return {
      ...rest,
      away: Math.min(86_400, Math.max(0, Math.round((this.now() - at) / 1000))),
    };
  }
}

/**
 * Plain-language toast for a dropped connection, or undefined when there is
 * nothing to add: a deliberate client disconnect, or a server one, which
 * the server already explains ("access-revoked", "session-replaced").
 */
export function dropMessage(drop: {
  reason: string;
  hidden: boolean;
  offline: boolean;
}) {
  if (drop.reason === "io client disconnect") return undefined;
  if (drop.reason === "io server disconnect") return undefined;
  if (drop.hidden)
    return "Connection lost while the game was in the background. Reconnecting…";
  if (drop.offline)
    return "Your device lost its internet connection. Reconnecting…";
  if (drop.reason === "ping timeout")
    return "The connection stopped responding. Reconnecting…";
  return "The network connection dropped. Reconnecting…";
}
