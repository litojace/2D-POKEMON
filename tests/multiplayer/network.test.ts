import { beforeEach, afterEach, it, expect } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server.js";
import { fakeAccounts } from "../helpers/accounts";
import {
  blankInput,
  type Reply,
  type Snapshot,
} from "../../packages/shared/src/index.js";
let server: ReturnType<typeof createArenaServer>,
  clients: Socket[] = [];
let url = "";
let accounts: ReturnType<typeof fakeAccounts>;
const wait = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
const emit = (
  socket: Socket,
  event: string,
  data: unknown = {},
): Promise<Reply> =>
  new Promise((resolve, reject) =>
    socket
      .timeout(1000)
      .emit(event, data, (error: Error | null, result: Reply) =>
        error ? reject(error) : resolve(result),
      ),
  );
const connect = async (token?: string) => {
  token ??= accounts.add().token;
  const socket = io(url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    auth: { accessToken: token },
  });
  clients.push(socket);
  await new Promise<void>((resolve) => socket.on("connect", resolve));
  return socket;
};
beforeEach(async () => {
  accounts = fakeAccounts();
  server = createArenaServer({
    autoTick: false,
    reconnectMs: 150,
    accounts: accounts.provider,
  });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  if (!address || typeof address === "string") throw Error("No port");
  url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  for (const c of clients) c.disconnect();
  clients = [];
  await server.close();
});
async function lobby() {
  const one = await connect(),
    two = await connect();
  const host = await emit(one, "create", { name: "One" });
  const guest = await emit(two, "join", { name: "Two", code: host.code });
  return { one, two, host, guest, arena: server.rooms.get(host.code!)! };
}
it("runs all eight characters in solo mode with real skill damage and no second client", async () => {
  for (const character of [
    "voltkit",
    "cindrake",
    "tidefin",
    "auralynx",
    "thornback",
    "frostfang",
    "duskveil",
    "terradon",
  ]) {
    const client = await connect();
    const reply = await emit(client, "practice", { name: "Tester", character });
    expect(reply.ok).toBe(true);
    const a = server.rooms.get(reply.code!)!;
    expect(a.practice).not.toBeNull();
    expect(a.phase).toBe("playing");
    expect(a.players).toHaveLength(2);
    expect(server.sessions.size).toBe(1);
    // Both ranged and melee starters must be within their real skill range.
    a.players[0].x = 850;
    client.emit("input", {
      ...blankInput(),
      seq: 1,
      aimX: 950,
      aimY: 180,
      skill: 0,
    });
    await wait();
    for (let i = 0; i < 30; i++) server.step();
    expect(a.players[0].stats.skills).toBe(1);
    expect(a.players[1].hp).toBeLessThan(110);
    a.players[1].hp = 0;
    server.step();
    expect(a.players[1].hp).toBe(110);
    expect(a.phase).toBe("playing");
    a.deadline = 0;
    server.step();
    expect(a.overtime).toBe(false);
    await emit(client, "leave");
    expect(server.rooms.size).toBe(0);
    expect(server.sessions.size).toBe(0);
  }
});
it("switches practice characters, resets the arena, and optionally removes skill cooldowns", async () => {
  const client = await connect();
  const reply = await emit(client, "practice", {
    name: "Tester",
    character: "voltkit",
  });
  const a = server.rooms.get(reply.code!)!;
  await emit(client, "practice-options", {
    unlimitedCooldowns: true,
    targetAttacks: false,
  });
  client.emit("input", {
    ...blankInput(),
    seq: 1,
    aimX: 950,
    aimY: 180,
    skill: 3,
  });
  await wait();
  server.step();
  expect(a.players[0].stats.skills).toBe(1);
  expect(a.players[0].cooldowns[3]).toBe(0);
  for (let i = 0; i < 6; i++) server.step();
  client.emit("input", {
    ...blankInput(),
    seq: 2,
    aimX: 950,
    aimY: 180,
    skill: 3,
  });
  await wait();
  server.step();
  expect(a.players[0].stats.skills).toBe(2);
  expect((await emit(client, "practice-character", "tidefin")).ok).toBe(true);
  expect(a.players[0].character).toBe("tidefin");
  expect(a.players[0].hp).toBe(105);
  expect(a.zones).toHaveLength(0);
  a.players[0].hp = 12;
  a.players[0].x = 1200;
  await emit(client, "practice-reset");
  expect(a.players[0].hp).toBe(105);
  expect(a.players[0].x).toBe(650);
  expect(a.players[0].stats.skills).toBe(0);
  expect((await emit(client, "practice-character", "bogus")).ok).toBe(false);
});
it("practice target attacks deal damage and stop cleanly when disabled", async () => {
  const client = await connect();
  const reply = await emit(client, "practice", {
    name: "Tester",
    character: "auralynx",
  });
  const a = server.rooms.get(reply.code!)!;
  await emit(client, "practice-options", {
    unlimitedCooldowns: false,
    targetAttacks: true,
  });
  for (let i = 0; i < 65; i++) server.step();
  expect(a.players[0].stats.received).toBeGreaterThan(0);
  expect(a.zones.some((z) => z.owner === a.players[1].id)).toBe(true);
  await emit(client, "practice-options", {
    unlimitedCooldowns: false,
    targetAttacks: false,
  });
  expect(a.projectiles).toHaveLength(0);
  expect(a.zones).toHaveLength(0);
  const hp = a.players[0].hp;
  for (let i = 0; i < 65; i++) server.step();
  expect(a.players[0].hp).toBe(hp);
});
it("isolates practice commands from online rooms and preserves practice reconnection", async () => {
  const { one, two, arena } = await lobby();
  expect(
    (
      await emit(one, "practice-options", {
        unlimitedCooldowns: true,
        targetAttacks: true,
      })
    ).ok,
  ).toBe(false);
  expect((await emit(two, "practice-reset")).ok).toBe(false);
  expect((await emit(one, "practice-character", "tidefin")).ok).toBe(false);
  expect(arena.practice).toBeNull();
  const client = await connect();
  const reply = await emit(client, "practice", {
    name: "Tester",
    character: "voltkit",
  });
  const a = server.rooms.get(reply.code!)!;
  client.disconnect();
  await wait();
  expect(a.phase).toBe("paused");
  const replacement = await connect(
    (client.auth as { accessToken: string }).accessToken,
  );
  expect((await emit(replacement, "resume", { token: reply.token })).ok).toBe(
    true,
  );
  expect(a.phase).toBe("playing");
  expect(a.practice).not.toBeNull();
  await emit(replacement, "leave");
  expect(server.rooms.has(reply.code!)).toBe(false);
});
it("creates unique rooms, validates identity, capacity and unauthorized actions", async () => {
  const { one, two, host, arena } = await lobby();
  expect(host.code).toMatch(/^[A-Z2-9]{6}$/);
  expect(arena.players).toHaveLength(2);
  const third = await connect();
  expect(
    (await emit(third, "join", { name: "Third", code: host.code })).error,
  ).toContain("full");
  expect((await emit(third, "ready")).ok).toBe(false);
  expect((await emit(one, "select", "invalid")).ok).toBe(false);
  expect((await emit(two, "create", { name: "Other" })).ok).toBe(false);
  expect((await emit(third, "create", { name: "" })).ok).toBe(false);
});
it("synchronizes both players movement, skills, health, death, match results and rematch", async () => {
  const { one, two, host, guest, arena } = await lobby();
  let s1: Snapshot | undefined, s2: Snapshot | undefined;
  const receivedEvents: Snapshot["events"] = [];
  one.on("state", (s: Snapshot) => (s1 = s));
  two.on("state", (s: Snapshot) => {
    s2 = s;
    receivedEvents.push(...s.events);
  });
  await emit(one, "ready");
  await emit(two, "ready");
  expect(arena.phase).toBe("briefing");
  const briefingTime = arena.time;
  for (let i = 0; i < 120; i++) server.step();
  expect(arena.time).toBe(briefingTime);
  await emit(one, "instructions-ready");
  expect(arena.phase).toBe("briefing");
  await emit(two, "instructions-ready");
  expect(arena.phase).toBe("countdown");
  await wait();
  expect(s1?.phase).toBe("countdown");
  expect(s2?.players.map((p) => p.id)).toEqual(s1?.players.map((p) => p.id));
  for (let i = 0; i < 95; i++) server.step();
  one.emit("input", { ...blankInput(), seq: 1, dx: 1 });
  two.emit("input", { ...blankInput(), seq: 1, dy: -1 });
  await wait();
  for (let i = 0; i < 10; i++) server.step();
  await wait();
  expect(s2!.players[0].x).toBeGreaterThan(260);
  expect(s1!.players[1].y).toBeLessThan(450);
  expect(s1!.players.map((p) => [p.x, p.y])).toEqual(
    s2!.players.map((p) => [p.x, p.y]),
  );
  // The fixture positions fighters near each other; client messages contain inputs only.
  const [p, q] = arena.players;
  p.x = 260;
  p.y = 450;
  q.x = 400;
  q.y = 450;
  p.vx = p.vy = q.vx = q.vy = 0;
  one.emit("input", {
    ...blankInput(),
    seq: 2,
    skill: 0,
    aimX: 400,
    aimY: 450,
  });
  two.emit("input", { ...blankInput(), seq: 2 });
  await wait();
  for (let i = 0; i < 12; i++) server.step();
  await wait();
  expect(s1!.players[1].hp).toBeLessThan(125);
  expect(s2!.players[1].hp).toBe(s1!.players[1].hp);
  expect(s2!.players[0].cooldowns[0]).toBeGreaterThan(arena.time);
  expect(receivedEvents.some((e) => e.kind === "cast")).toBe(true);
  const before = q.hp;
  two.emit("input", { ...blankInput(), seq: 3, hp: 999, damage: 1000, x: 0 });
  await wait();
  server.step();
  expect(q.hp).toBe(before);
  expect(q.ack).toBe(2);
  q.hp = 1;
  arena.damage(q, 5, p.id);
  server.step();
  expect(arena.roundWinner).toBe(host.id);
  for (let i = 0; i < 220; i++) server.step();
  q.hp = 0;
  server.step();
  await wait();
  expect(s1!.winner).toBe(host.id);
  expect(s2!.winner).toBe(host.id);
  expect(arena.scores[host.id!]).toBe(2);
  await emit(one, "rematch");
  expect(arena.phase).toBe("finished");
  await emit(two, "rematch");
  await emit(one, "instructions-ready");
  await emit(two, "instructions-ready");
  expect(arena.phase).toBe("countdown");
  expect(arena.scores[guest.id!]).toBe(0);
  expect(arena.players.every((p) => p.hp > 0)).toBe(true);
});
it("suspends the match, securely reconnects, rejects duplicate sessions and forfeits on expiry", async () => {
  const { one, two, host, guest, arena } = await lobby();
  await emit(one, "ready");
  await emit(two, "ready");
  expect(arena.phase).toBe("briefing");
  await emit(one, "instructions-ready");
  expect(arena.phase).toBe("briefing");
  await emit(two, "instructions-ready");
  for (let i = 0; i < 95; i++) server.step();
  two.disconnect();
  await wait();
  expect(arena.phase).toBe("paused");
  const time = arena.time;
  server.step();
  expect(arena.time).toBe(time);
  const replacement = await connect(
    (two.auth as { accessToken: string }).accessToken,
  );
  expect(
    (await emit(replacement, "resume", { token: "0".repeat(64) })).ok,
  ).toBe(false);
  const resumed = await emit(replacement, "resume", { token: guest.token });
  expect(resumed.id).toBe(guest.id);
  expect(arena.phase).toBe("playing");
  const impostor = await connect();
  expect((await emit(impostor, "resume", { token: guest.token })).ok).toBe(
    false,
  );
  replacement.disconnect();
  await wait(190);
  server.step();
  expect(arena.phase).toBe("finished");
  expect(arena.winner).toBe(host.id);
  expect((await emit(impostor, "resume", { token: guest.token })).ok).toBe(
    false,
  );
});
it("cleans empty rooms and recovers a disconnected lobby slot", async () => {
  const { one, two, arena } = await lobby();
  two.disconnect();
  await wait(190);
  server.step();
  expect(arena.players).toHaveLength(1);
  one.disconnect();
  await wait(190);
  server.step();
  expect(server.rooms.size).toBe(0);
  expect(server.sessions.size).toBe(0);
});
it("broadcasts every room at 15Hz, including when an even number of rooms exist", async () => {
  const one = await connect(),
    two = await connect();
  await emit(one, "create", { name: "One" });
  await emit(two, "create", { name: "Two" });
  let a = 0,
    b = 0;
  one.on("state", () => a++);
  two.on("state", () => b++);
  for (let i = 0; i < 10; i++) server.step();
  await wait();
  expect(a).toBe(5);
  expect(b).toBe(5);
});
it("allows a fresh opponent after a player leaves and the winner returns to lobby", async () => {
  const { one, two, arena, host } = await lobby();
  await emit(one, "ready");
  await emit(two, "ready");
  expect(arena.phase).toBe("briefing");
  await emit(one, "instructions-ready");
  expect(arena.phase).toBe("briefing");
  await emit(two, "instructions-ready");
  await emit(two, "leave");
  expect(arena.winner).toBe(host.id);
  await emit(one, "lobby");
  expect(arena.players).toHaveLength(1);
  const third = await connect();
  expect(
    (await emit(third, "join", { name: "New opponent", code: host.code })).ok,
  ).toBe(true);
});
it("bounds spam and rejects another player ID in an input payload", async () => {
  const { one, two, arena, guest } = await lobby();
  await emit(one, "ready");
  await emit(two, "ready");
  expect(arena.phase).toBe("briefing");
  await emit(one, "instructions-ready");
  expect(arena.phase).toBe("briefing");
  await emit(two, "instructions-ready");
  for (let i = 0; i < 95; i++) server.step();
  one.emit("input", { ...blankInput(), seq: 1, id: guest.id, skill: 3 });
  await wait();
  server.step();
  expect(arena.players[0].stats.skills).toBe(0);
  for (let i = 2; i < 220; i++)
    one.emit("input", { ...blankInput(), seq: i, dx: 1 });
  await wait();
  server.step();
  expect(arena.players[0].ack).toBeLessThan(100);
  expect(arena.players[0].x).toBeLessThan(275);
  expect(arena.players[1].ack).toBe(0);
});
