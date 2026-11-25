import { expect, it } from "vitest";
import {
  SNAPSHOT_AUTH,
  followSnapshots,
} from "../../apps/client/src/networking/snapshot-stream";
import {
  SnapshotDeltaEncoder,
  type WireSnapshot,
} from "../../packages/shared/src/index";

// The client's end of snapshots as changes: whatever arrives, the game is
// handed whole snapshots, and a delta that does not follow is never shown.

function setup() {
  const handlers: Record<string, (payload: unknown) => void> = {};
  const sent: [string, unknown][] = [];
  const shown: WireSnapshot[] = [];
  let time = 0;
  followSnapshots(
    {
      on: (event, handler) => (handlers[event] = handler as never),
      emit: (event, data) => sent.push([event, data]),
    },
    (snapshot) => shown.push(snapshot),
    () => time,
  );
  const encoder = new SnapshotDeltaEncoder();
  const snap = (n: number, x: number, code = "ROOM01") =>
    ({ code, n, x, players: [{ id: "a", x }] }) as unknown as WireSnapshot;
  /** What the server would send for this snapshot, as it arrives. */
  const server = (wire: WireSnapshot) => {
    const d = encoder.encode(wire);
    return JSON.parse(
      JSON.stringify(
        d
          ? { event: "state-delta", data: { code: wire.code, n: wire.n, d } }
          : { event: "state", data: wire },
      ),
    ) as { event: string; data: unknown };
  };
  const receive = (message: { event: string; data: unknown }) =>
    handlers[message.event](message.data);
  return {
    sent,
    shown,
    snap,
    server,
    receive,
    handlers,
    advance: (ms: number) => (time += ms),
  };
}

it("tells the server it understands deltas", () => {
  expect(SNAPSHOT_AUTH).toEqual({ delta: 1 });
});

it("hands the game whole snapshots, whichever kind arrived", () => {
  const { shown, snap, server, receive, sent } = setup();
  for (let n = 1; n <= 5; n++) receive(server(snap(n, n * 10)));
  expect(shown).toStrictEqual([1, 2, 3, 4, 5].map((n) => snap(n, n * 10)));
  expect(sent).toEqual([]);
  // Each is the game's own: changing one changes nothing that follows.
  (shown[4].players as unknown as { x: number }[])[0].x = -1;
  receive(server(snap(6, 50)));
  expect(shown[5]).toStrictEqual(snap(6, 50));
});

it("an older server's snapshots (no numbers) pass straight through", () => {
  const { shown, handlers, sent } = setup();
  const whole = {
    code: "ROOM01",
    x: 1,
    players: [],
  } as unknown as WireSnapshot;
  handlers.state(whole);
  // The very object: nothing is copied or kept.
  expect(shown[0]).toBe(whole);
  expect(sent).toEqual([]);
});

it("a delta that does not follow is not shown; it asks for a whole snapshot once, then each second", () => {
  const { shown, snap, server, receive, sent, advance } = setup();
  receive(server(snap(1, 0)));
  server(snap(2, 1)); // lost on the way
  receive(server(snap(3, 2)));
  receive(server(snap(4, 3)));
  receive(server(snap(5, 4)));
  expect(shown).toHaveLength(1);
  expect(sent).toEqual([["state-full", { code: "ROOM01" }]]);
  advance(999);
  receive(server(snap(6, 5)));
  expect(sent).toHaveLength(1);
  advance(1);
  receive(server(snap(7, 6)));
  expect(sent).toHaveLength(2);
  // The whole snapshot arrives: shown, and deltas follow again.
  receive({ event: "state", data: JSON.parse(JSON.stringify(snap(7, 6))) });
  receive(server(snap(8, 7)));
  expect(shown.slice(1)).toStrictEqual([snap(7, 6), snap(8, 7)]);
  expect(sent).toHaveLength(2);
  // And a later gap asks at once, not a second later.
  server(snap(9, 8));
  receive(server(snap(10, 9)));
  expect(sent).toHaveLength(3);
});

it("after the connection drops, nothing held is used again", () => {
  const { shown, snap, server, receive, sent, handlers } = setup();
  receive(server(snap(1, 0)));
  receive(server(snap(2, 1)));
  handlers.disconnect(undefined);
  receive(server(snap(3, 2)));
  expect(shown).toHaveLength(2);
  expect(sent).toEqual([["state-full", { code: "ROOM01" }]]);
});

it("garbage instead of a delta is refused and asked about, not thrown", () => {
  const { shown, snap, server, receive, sent, handlers } = setup();
  receive(server(snap(1, 0)));
  for (const junk of [null, undefined, 7, "x", {}, { code: "ROOM01", n: 2 }])
    expect(() => handlers["state-delta"](junk)).not.toThrow();
  expect(shown).toHaveLength(1);
  expect(sent).toHaveLength(1);
});
