import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import type { Reply } from "@arena/shared";
import type { TownProfile, TownState } from "../../packages/shared/src/town";

let server: ReturnType<typeof createArenaServer> | undefined;
const clients: Socket[] = [];
afterEach(async () => {
  clients.splice(0).forEach((c) => c.disconnect());
  await server?.close();
});
const emit = (socket: Socket, event: string, data: unknown = {}) =>
  new Promise<Reply>((resolve, reject) =>
    socket.timeout(2000).emit(event, data, (error: Error | null, result: Reply) => (error ? reject(error) : resolve(result))),
  );
const settle = () => new Promise((r) => setTimeout(r, 60));
const setup = async () => {
  const accounts = fakeAccounts();
  accounts.provider.rpc = async (_token, name) =>
    name === "arena_journey" ? { xp: 900 } : name === "arena_my_looks" ? { voltkit: { skin: "galaxy-voltkit", stage: 1 } } : {};
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`;
  const connect = async (signedIn = true) => {
    const user = signedIn ? accounts.add(false) : undefined;
    const socket = io(url, { auth: { accessToken: user?.token ?? null }, transports: ["websocket"], reconnection: false });
    clients.push(socket);
    await new Promise<void>((r, j) => {
      socket.once("connect", r);
      socket.once("connect_error", j);
    });
    const seen = { states: [] as TownState[], profiles: new Map<number, TownProfile>(), closed: 0 };
    socket.on("town-state", (s: TownState) => seen.states.push(s));
    socket.on("town-profiles", (list: TownProfile[]) => list.forEach((p) => seen.profiles.set(p.id, p)));
    socket.on("town-closed", () => seen.closed++);
    return { socket, seen, account: user?.account };
  };
  const ticks = async (n: number) => {
    for (let i = 0; i < n; i++) server!.townStep();
    await settle();
  };
  return { connect, ticks };
};

it("lets signed-in players walk the town, see each other and emote", async () => {
  const { connect, ticks } = await setup();
  const a = await connect(),
    b = await connect();
  const joinA = await emit(a.socket, "town-join", { character: "voltkit" });
  const joinB = await emit(b.socket, "town-join", { character: "cindrake" });
  expect(joinA).toMatchObject({ ok: true, town: 1 });
  expect(joinB).toMatchObject({ ok: true, town: 1 });
  await ticks(2);
  const latest = () => b.seen.states.at(-1)!;
  const walkerA = () => latest().walkers.find((w) => w[0] === joinA.me)!;
  expect(latest().population).toBe(2);
  expect(walkerA()).toBeTruthy();
  // Profiles carry the verified account name, then level and skin once looked up.
  expect(b.seen.profiles.get(joinA.me!)?.name).toBe(a.account!.displayName);
  await ticks(2);
  expect(b.seen.profiles.get(joinA.me!)).toMatchObject({ level: expect.any(Number), skin: { skin: "galaxy-voltkit" } });

  const startX = walkerA()[1];
  a.socket.emit("town-input", { dx: 1, dy: 0 });
  await settle();
  await ticks(10);
  expect(walkerA()[1]).toBeGreaterThan(startX + 40);
  expect(walkerA()[4]).toBe(1);

  expect(await emit(a.socket, "town-emote", { emote: "heart" })).toMatchObject({ ok: true });
  expect((await emit(a.socket, "town-emote", { emote: "heart" })).ok).toBe(false);
  await ticks(2);
  expect(walkerA()[5]).toBe(2);

  // Starting a room takes you out of town.
  a.socket.emit("create", {});
  await settle();
  await ticks(2);
  expect(a.seen.closed).toBe(1);
  expect(walkerA()).toBeUndefined();
  expect(latest().population).toBe(1);
});

it("keeps signed-out players out of the town", async () => {
  const { connect } = await setup();
  const guest = await connect(false);
  const result = await emit(guest.socket, "town-join", { character: "voltkit" });
  expect(result.ok).toBe(false);
});
