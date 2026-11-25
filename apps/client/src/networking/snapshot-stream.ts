/**
 * Battle snapshots off the socket, whole or as changes
 * (packages/shared/src/snapshot-delta.ts; docs/network-performance.md
 * section 21).
 *
 * The handshake tells the server this client understands deltas
 * (`SNAPSHOT_AUTH`). A server that sends them sends a whole numbered
 * snapshot first (`state`) and after that only what changed
 * (`state-delta`); an older server, or one with deltas off, sends whole
 * snapshots and nothing here costs anything. Either way `onSnapshot` is
 * handed a whole snapshot that is the caller's own to keep or change, and
 * the game never knows which kind arrived.
 *
 * A delta that does not follow the snapshot we hold is not shown: the
 * server is asked for a whole one (`state-full`), once, and again each
 * second it has not come.
 */
import {
  SnapshotDeltaDecoder,
  type WireSnapshot,
  type WireSnapshotDelta,
} from "@arena/shared";

/** Added to the socket's `auth`: "send me deltas if you can". */
export const SNAPSHOT_AUTH = { delta: 1 } as const;

/** How long to wait for the whole snapshot we asked for before asking again. */
const ASK_AGAIN_MS = 1000;

interface SnapshotSocket {
  on(event: string, handler: (payload: never) => void): unknown;
  emit(event: string, data: unknown): unknown;
}

export function followSnapshots(
  socket: SnapshotSocket,
  onSnapshot: (snapshot: WireSnapshot) => void,
  now: () => number = () => performance.now(),
) {
  const decoder = new SnapshotDeltaDecoder();
  let askedAt = -Infinity;
  socket.on("state", (snapshot: WireSnapshot) => {
    decoder.full(snapshot);
    askedAt = -Infinity;
    onSnapshot(snapshot);
  });
  socket.on("state-delta", (delta: WireSnapshotDelta) => {
    const snapshot = decoder.delta(delta);
    if (snapshot) return onSnapshot(snapshot);
    const at = now();
    if (at - askedAt < ASK_AGAIN_MS) return;
    askedAt = at;
    socket.emit("state-full", { code: delta?.code });
  });
  // A new connection starts from a whole snapshot.
  socket.on("disconnect", () => {
    decoder.reset();
    askedAt = -Infinity;
  });
}
