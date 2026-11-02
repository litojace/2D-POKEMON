import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import type { RaidArena } from "../../apps/server/src/raid";
import { fakeAccounts } from "../helpers/accounts";
import type { Reply, Snapshot } from "../../packages/shared/src/index";
let server: ReturnType<typeof createArenaServer> | undefined;
const clients: Socket[] = [];
afterEach(async () => {
  clients.splice(0).forEach((c) => c.disconnect());
  await server?.close();
});
const emit = (s: Socket, name: string, data: unknown = {}) =>
  new Promise<Reply>((r, j) =>
    s
      .timeout(2000)
      .emit(name, data, (e: Error | null, v: Reply) => (e ? j(e) : r(v))),
  );
it("keeps saved wardrobe appearance identical in snapshots, parties and live friends, including unequip", async () => {
  const f = fakeAccounts(),
    owner = f.add(false),
    viewer = f.add(false);
  let look: Record<string, string | null> = {
    frame: "conqueror",
    skin: "candy-colours",
    aura: "galaxy-aura",
    entrance: "firefall",
    victory: "twin-spark",
  };
  let looks = { tidefin: { skin: "tidefin-moontide", stage: 3 } } as Record<
    string,
    { skin: string; stage: number }
  >;
  let chosen = "voltkit",
    clears = 50;
  f.provider.recordRaid = async () => {
    clears = 60;
  };
  f.provider.rpc = async (token, name, args) => {
    if (name === "arena_friends")
      return {
        code: "ABCDEF12",
        friends: [
          {
            id: owner.account.id,
            name: "Owner",
            fighter: "voltkit",
            frame: "reef",
            look: { frame: "reef" },
            championLooks: {},
            raidClears: {},
          },
        ],
        incoming: [],
        outgoing: [],
      };
    if (name === "arena_raid_progress")
      return { loadout: look, bosses: { grumblecrag: { clears } } };
    if (name === "arena_my_looks") return looks;
    if (name === "arena_set_portrait_character") {
      expect(token).toBe(owner.token);
      chosen = String(args.p_character);
    }
    return {};
  };
  server = createArenaServer({ accounts: f.provider, autoTick: false });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`;
  const socket = io(url, {
    auth: { accessToken: owner.token },
    transports: ["websocket"],
    reconnection: false,
  });
  clients.push(socket);
  await new Promise<void>((r, j) => {
    socket.once("connect", r);
    socket.once("connect_error", j);
  });
  let snapshot: Snapshot | undefined;
  socket.on("state", (s) => {
    snapshot = s;
  });
  const room = await emit(socket, "create", { mode: "raid", name: "Owner" });
  expect(room.ok).toBe(true);
  expect((await emit(socket, "select", "tidefin")).ok).toBe(true);
  await expect
    .poll(
      () =>
        snapshot?.players.find((p) => p.id === room.id)?.raidClears
          ?.grumblecrag,
    )
    .toBe(50);
  await expect.poll(() => chosen).toBe("tidefin");
  const mine = snapshot!.players.find((p) => p.id === room.id)!;
  expect(mine).toMatchObject({ raidLook: look, championLooks: looks });
  const list = async () => {
    const response = await fetch(url + "/api/friends", {
      headers: { authorization: `Bearer ${viewer.token}` },
    });
    expect(response.status).toBe(200);
    return (await response.json()).friends[0];
  };
  expect(await list()).toMatchObject({
    fighter: "tidefin",
    frame: "conqueror",
    look,
    championLooks: looks,
    raidClears: { grumblecrag: 50 },
  });
  // The authenticated equip endpoint triggers a fresh room broadcast.
  look = { frame: null, skin: null };
  looks = {};
  const response = await fetch(url + "/api/shop/equip", {
    method: "POST",
    headers: {
      authorization: `Bearer ${owner.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ champion: "tidefin", skin: null }),
  });
  expect(response.status).toBe(200);
  await expect
    .poll(
      () => snapshot?.players.find((p) => p.id === room.id)?.raidLook?.frame,
    )
    .toBeNull();
  expect(await list()).toMatchObject({
    frame: null,
    look: { frame: null, skin: null },
    championLooks: {},
  });
  const raid = server.rooms.get(room.code!) as RaidArena;
  raid.phase = "finished";
  raid.raid.result = "victory";
  raid.raid.resultId = "22222222-2222-4222-8222-222222222222";
  raid.raid.elapsed = 40;
  server.broadcast(raid);
  await expect
    .poll(
      () =>
        snapshot?.players.find((p) => p.id === room.id)?.raidClears
          ?.grumblecrag,
    )
    .toBe(60);
  expect((await list()).raidClears.grumblecrag).toBe(60);
});
