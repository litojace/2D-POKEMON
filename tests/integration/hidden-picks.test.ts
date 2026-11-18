/**
 * Hidden picks (docs/hidden-picks.md): in a PvP lobby the server never sends
 * another side's pick, a 2v2 team can't lock the same fighter twice, and
 * every pick is revealed when the match starts.
 */
import { beforeEach, afterEach, it, expect } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import type {
  CharacterId,
  Reply,
  WireSnapshot,
} from "../../packages/shared/src/index";

let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string,
  clients: Socket[];
const emit = (
  socket: Socket,
  event: string,
  data: unknown = {},
): Promise<Reply> =>
  new Promise((resolve, reject) =>
    socket
      .timeout(2000)
      .emit(event, data, (error: Error | null, value: Reply) =>
        error ? reject(error) : resolve(value),
      ),
  );
/** A signed-in socket that keeps every snapshot it is sent. */
const connect = async () => {
  const socket = io(url, {
    auth: { accessToken: accounts.add(false).token },
    transports: ["websocket"],
    reconnection: false,
  });
  clients.push(socket);
  const states: WireSnapshot[] = [];
  socket.on("state", (s: WireSnapshot) => states.push(s));
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return Object.assign(socket, { states });
};
type Player = Awaited<ReturnType<typeof connect>>;
/** Let the last snapshots arrive. */
const settle = () => new Promise((r) => setTimeout(r, 60));
const last = (s: Player) => s.states.at(-1)!;
const seat = (s: Player, id: string) =>
  last(s).players.find((p) => p.id === id)!;

beforeEach(async () => {
  accounts = fakeAccounts();
  clients = [];
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  if (!address || typeof address === "string") throw Error("No address");
  url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  for (const client of clients) client.disconnect();
  await server.close();
});

async function room(mode: "duel" | "teams" | "ffa", count: number) {
  const players = await Promise.all(
    Array.from({ length: count }, () => connect()),
  );
  const host = await emit(players[0], "create", { name: "Host", mode });
  const ids = [host.id!];
  for (const p of players.slice(1)) {
    const joined = await emit(p, "join", { name: "P", code: host.code });
    expect(joined.ok).toBe(true);
    ids.push(joined.id!);
  }
  return { players, ids, arena: server.rooms.get(host.code!)! };
}

it("1v1: neither player is sent the other's pick until the match starts", async () => {
  const {
    players: [a, b],
    ids: [aId, bId],
    arena,
  } = await room("duel", 2);
  const watcher = await connect();
  expect((await emit(watcher, "watch", { code: arena.code })).ok).toBe(true);
  const sinceJoin = b.states.length;
  expect((await emit(a, "browse", "mystowl")).ok).toBe(true);
  expect((await emit(a, "select", "cindrake")).ok).toBe(true);
  // The same fighter on both sides is fine in a 1v1.
  expect((await emit(b, "select", "cindrake")).ok).toBe(true);
  await settle();
  // You see your own pick, locked.
  expect(seat(a, aId)).toMatchObject({ character: "cindrake", locked: true });
  expect(seat(a, aId).veiled).toBeUndefined();
  // Your opponent sees that you locked in, not what.
  expect(seat(b, aId)).toMatchObject({ locked: true, veiled: true });
  expect(seat(b, aId).character).not.toBe("cindrake");
  expect(seat(b, aId).browse).toBeUndefined();
  // Nothing B received in the lobby ever named A's fighters.
  const lobby = b.states.slice(sinceJoin).filter((s) => s.phase === "lobby");
  expect(lobby.length).toBeGreaterThan(0);
  for (const s of lobby) {
    const aSeat = s.players.find((p) => p.id === aId)!;
    expect(JSON.stringify(aSeat)).not.toMatch(/cindrake|mystowl/);
  }
  // A watcher sees no pick at all.
  for (const id of [aId, bId])
    expect(seat(watcher, id)).toMatchObject({ veiled: true });
  // Both ready: the briefing reveals both picks to everyone.
  await emit(a, "ready");
  await emit(b, "ready");
  await settle();
  expect(arena.phase).toBe("briefing");
  for (const s of [a, b, watcher]) {
    expect(last(s).phase).toBe("briefing");
    expect(seat(s, aId).character).toBe("cindrake");
    expect(seat(s, bId).character).toBe("cindrake");
    expect(seat(s, aId).veiled).toBeUndefined();
  }
});

it("2v2: teammates see each other's picks, the other team doesn't; one fighter per team", async () => {
  const { players, ids, arena } = await room("teams", 4);
  // Seats alternate Blue, Red, Blue, Red.
  expect(arena.players.map((p) => p.team)).toEqual([0, 1, 0, 1]);
  const [blue1, red1, blue2, red2] = players;
  const [blue1Id, , blue2Id] = ids;
  expect((await emit(blue1, "browse", "tidefin")).ok).toBe(true);
  await settle();
  // Your teammate sees what you're looking at; the other team doesn't.
  expect(seat(blue2, blue1Id).browse).toBe("tidefin");
  expect(seat(red1, blue1Id).browse).toBeUndefined();
  expect(seat(red1, blue1Id).veiled).toBe(true);
  expect((await emit(blue1, "select", "tidefin")).ok).toBe(true);
  // Your teammate can't take it now; the other team still can.
  const taken = await emit(blue2, "select", "tidefin");
  expect(taken.ok).toBe(false);
  expect(taken.error).toMatch(/already picked Tidefin/);
  expect((await emit(red1, "select", "tidefin")).ok).toBe(true);
  // Ready without Lock in locks the fighter you're looking at, unless it's taken.
  await emit(blue2, "browse", "tidefin");
  expect((await emit(blue2, "ready")).ok).toBe(false);
  await emit(blue2, "browse", "lumoth");
  expect((await emit(blue2, "ready")).ok).toBe(true);
  await settle();
  expect(seat(blue1, blue2Id)).toMatchObject({
    character: "lumoth",
    locked: true,
    ready: true,
  });
  expect(seat(red2, blue2Id)).toMatchObject({ locked: true, veiled: true });
  expect(JSON.stringify(seat(red2, blue2Id))).not.toMatch(/lumoth/);
  // Server side, the picks are real.
  expect(arena.players.map((p) => p.character).slice(0, 3)).toEqual([
    "tidefin",
    "tidefin",
    "lumoth",
  ]);
});

it("2v2: after a team change, the later lock on a shared fighter gives way", async () => {
  const { players, ids, arena } = await room("teams", 3);
  const [blue1, red1] = players;
  // Red locks Glacelle first; Blue locks it later (allowed: other team).
  expect((await emit(red1, "select", "glacelle")).ok).toBe(true);
  expect((await emit(blue1, "select", "glacelle")).ok).toBe(true);
  // Blue joins Red: two Glacelles on one team. The earlier lock keeps it.
  expect((await emit(blue1, "team", { team: 1 })).ok).toBe(true);
  const moved = arena.players.find((p) => p.id === ids[0])!;
  const stayed = arena.players.find((p) => p.id === ids[1])!;
  expect(stayed.locked).toBe(true);
  expect(moved.locked).toBe(false);
  expect(moved.ready).toBe(false);
});

it("free-for-all: every other fighter's pick is hidden", async () => {
  const {
    players: [a, b, c],
    ids: [aId],
  } = await room("ffa", 3);
  await emit(a, "select", "duskveil");
  await emit(b, "select", "duskveil");
  await settle();
  for (const s of [b, c]) {
    expect(seat(s, aId)).toMatchObject({ veiled: true, locked: true });
    expect(JSON.stringify(seat(s, aId))).not.toMatch(/duskveil/);
  }
  expect(seat(a, aId).character).toBe("duskveil");
});

it("a raid room keeps picks open", async () => {
  const one = await connect();
  const two = await connect();
  const host = await emit(one, "create", {
    name: "Host",
    mode: "raid",
    boss: "grumblecrag",
  });
  expect(host.ok).toBe(true);
  const joined = await emit(two, "join", { name: "Two", code: host.code });
  expect(joined.ok).toBe(true);
  await emit(one, "select", "pyranda" satisfies CharacterId);
  await settle();
  expect(seat(two, host.id!).character).toBe("pyranda");
  expect(seat(two, host.id!).veiled).toBeUndefined();
});

/** Every chat line a socket receives. */
const heard = (s: Player) => {
  const lines: { channel: string; text?: string }[] = [];
  s.on("chat", (l: { channel: string; text?: string }) => lines.push(l));
  return lines;
};

it("2v2 team chat reaches your teammate only; the room reaches everyone", async () => {
  const { players } = await room("teams", 4);
  const [blue1, red1, blue2, red2] = players;
  const ears = players.map(heard);
  const sent = await emit(blue1, "chat-send", {
    channel: "team",
    text: "I take Tidefin",
  });
  expect(sent.ok).toBe(true);
  expect(
    (await emit(red1, "chat-send", { channel: "room", text: "hi all" })).ok,
  ).toBe(true);
  await settle();
  const said = (i: number) => ears[i].map((l) => `${l.channel}:${l.text}`);
  expect(said(2)).toContain("team:I take Tidefin");
  for (const i of [1, 3]) expect(said(i).join()).not.toMatch(/Tidefin/);
  for (const i of [0, 1, 2, 3]) expect(said(i)).toContain("room:hi all");
  // The other team's history is theirs too.
  const theirs = await emit(red2, "chat-history", { channel: "team" });
  expect(JSON.stringify(theirs)).not.toMatch(/Tidefin/);
  const ours = await emit(blue2, "chat-history", { channel: "team" });
  expect(JSON.stringify(ours)).toMatch(/I take Tidefin/);
  void red1;
});

it("team chat: none in a 1v1, and a team change clears what was said", async () => {
  const duel = await room("duel", 2);
  expect(
    (await emit(duel.players[0], "chat-send", { channel: "team", text: "x" }))
      .ok,
  ).toBe(false);

  const { players } = await room("teams", 3);
  const [blue1, red1] = players;
  await emit(red1, "chat-send", { channel: "team", text: "secret plan" });
  // A Blue player moves to Red: Red's earlier plans are gone, not handed over.
  expect((await emit(blue1, "team", { team: 1 })).ok).toBe(true);
  const after = await emit(blue1, "chat-history", { channel: "team" });
  expect(JSON.stringify(after)).not.toMatch(/secret plan/);
});

it("the Reveal keeps the room's chat: typed lines until the fight starts", async () => {
  const {
    players: [a, b],
    arena,
  } = await room("duel", 2);
  await emit(a, "ready");
  await emit(b, "ready");
  await settle();
  expect(arena.phase).toBe("briefing");
  const ears = heard(b);
  const said = await emit(a, "chat-send", { channel: "room", text: "gl hf" });
  expect(said.ok).toBe(true);
  await settle();
  expect(ears.map((l) => l.text)).toContain("gl hf");
  // Once the fight is on, typing waits for the end (quick chat only).
  arena.phase = "playing";
  const typed = await emit(b, "chat-send", { channel: "room", text: "oops" });
  expect(typed.ok).toBe(false);
});
