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
    socket
      .timeout(2000)
      .emit(event, data, (error: Error | null, result: Reply) =>
        error ? reject(error) : resolve(result),
      ),
  );
const settle = () => new Promise((r) => setTimeout(r, 60));
const setup = async () => {
  const accounts = fakeAccounts();
  accounts.provider.rpc = async (_token, name) =>
    name === "arena_journey"
      ? { xp: 900 }
      : name === "arena_my_looks"
        ? { voltkit: { skin: "galaxy-voltkit", stage: 1 } }
        : {};
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`;
  const connect = async (signedIn = true) => {
    const user = signedIn ? accounts.add(false) : undefined;
    const socket = io(url, {
      auth: { accessToken: user?.token ?? null },
      transports: ["websocket"],
      reconnection: false,
    });
    clients.push(socket);
    await new Promise<void>((r, j) => {
      socket.once("connect", r);
      socket.once("connect_error", j);
    });
    const seen = {
      states: [] as TownState[],
      profiles: new Map<number, TownProfile>(),
      closed: 0,
    };
    socket.on("town-state", (s: TownState) => seen.states.push(s));
    socket.on("town-profiles", (list: TownProfile[]) =>
      list.forEach((p) => seen.profiles.set(p.id, p)),
    );
    socket.on("town-closed", () => seen.closed++);
    return { socket, seen, account: user?.account, token: user?.token };
  };
  const ticks = async (n: number) => {
    for (let i = 0; i < n; i++) server!.townStep();
    await settle();
  };
  return { connect, ticks, accounts, url };
};

it("shares verified frames with friends across town, wardrobe changes and rooms", async () => {
  const { connect, ticks, accounts, url } = await setup();
  const viewer = await connect(),
    owner = await connect();
  let frame: string | null = "galaxy-frame";
  accounts.provider.rpc = async (token, name, args) => {
    if (name === "arena_friends")
      return {
        code: "ABCDEF12",
        friends: [
          { id: owner.account!.id, name: owner.account!.displayName, frame },
        ],
        incoming: [],
        outgoing: [],
      };
    if (name === "arena_equip_raid_slot" && token === owner.token)
      frame = args.p_item as string | null;
    if (name === "arena_raid_progress" || name === "arena_equip_raid_slot")
      return { loadout: { frame: token === owner.token ? frame : null } };
    if (name === "arena_my_looks") return {};
    if (name === "arena_journey") return { xp: 900 };
    return {};
  };
  await emit(owner.socket, "town-join", { character: "auralynx" });
  await ticks(3);
  const friend = async () =>
    (
      await (
        await fetch(url + "/api/friends", {
          headers: { Authorization: `Bearer ${viewer.token}` },
        })
      ).json()
    ).friends[0];
  await expect
    .poll(friend)
    .toMatchObject({ fighter: "auralynx", frame: "galaxy-frame" });
  await emit(owner.socket, "town-look", {
    character: "auralynx",
    look: { frame: "conqueror" },
  });
  await ticks(2);
  expect((await friend()).frame).toBe("galaxy-frame");
  const equip = async (item: string | null) =>
    fetch(url + "/api/raids/equip", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${owner.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slot: "frame", item }),
    });
  expect((await equip(null)).ok).toBe(true);
  await ticks(3);
  expect((await friend()).frame).toBeNull();
  expect(
    (await emit(owner.socket, "create", { name: owner.account!.displayName })).ok,
  ).toBe(true);
  expect((await equip("conqueror")).ok).toBe(true);
  await expect
    .poll(friend)
    .toMatchObject({ activity: "lobby", frame: "conqueror" });
  owner.socket.disconnect();
  await expect
    .poll(friend)
    .toMatchObject({ online: false, frame: "conqueror" });
});

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
  expect(b.seen.profiles.get(joinA.me!)).toMatchObject({
    level: expect.any(Number),
    skin: { skin: "galaxy-voltkit" },
  });

  const startX = walkerA()[1];
  a.socket.emit("town-input", { dx: 1, dy: 0 });
  await settle();
  await ticks(10);
  expect(walkerA()[1]).toBeGreaterThan(startX + 40);
  expect(walkerA()[4]).toBe(1);

  expect(await emit(a.socket, "town-emote", { emote: "heart" })).toMatchObject({
    ok: true,
  });
  expect((await emit(a.socket, "town-emote", { emote: "heart" })).ok).toBe(
    false,
  );
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

it("shows a fighter switch (and that fighter's own skin) to everyone", async () => {
  const { connect, ticks } = await setup();
  const a = await connect(),
    b = await connect();
  const joinA = await emit(a.socket, "town-join", { character: "cindrake" });
  await emit(b.socket, "town-join", { character: "lumoth" });
  await ticks(4);
  expect(b.seen.profiles.get(joinA.me!)).toMatchObject({
    character: "cindrake",
    skin: null,
  });
  expect(
    await emit(a.socket, "town-look", { character: "voltkit" }),
  ).toMatchObject({ ok: true });
  await settle();
  await ticks(2);
  expect(b.seen.profiles.get(joinA.me!)).toMatchObject({
    character: "voltkit",
    skin: { skin: "galaxy-voltkit" },
  });
  expect(
    (await emit(a.socket, "town-look", { character: "not-a-fighter" })).ok,
  ).toBe(false);
});

it("keeps signed-out players out of the town", async () => {
  const { connect } = await setup();
  const guest = await connect(false);
  const result = await emit(guest.socket, "town-join", {
    character: "voltkit",
  });
  expect(result.ok).toBe(false);
});

it("broadcasts saved wardrobe changes to nearby visitors without a rejoin and ignores forged looks", async () => {
  const { connect, ticks, accounts, url } = await setup();
  const a = await connect(),
    b = await connect();
  let championSkin: { skin: string; stage: number } | null = {
    skin: "auralynx-celestial-sage",
    stage: 1,
  };
  let look: Record<string, string | null> = {
    skin: "candy-colours",
    aura: "nightmote",
    entrance: "firefall",
    victory: "twin-spark",
    frame: "crescent",
  };
  accounts.provider.rpc = async (token, name, args) => {
    const own = token === a.token;
    if (name === "arena_journey") return { xp: 900 };
    if (name === "arena_my_looks")
      return own && championSkin ? { auralynx: championSkin } : {};
    if (name === "arena_raid_progress") return { loadout: own ? look : {} };
    if (name === "arena_equip_raid_slot" && own) {
      look = { ...look, [args.p_slot as string]: args.p_item as string | null };
      return { loadout: look };
    }
    if (name === "arena_equip_champion_skin" && own) {
      championSkin = args.p_skin
        ? { skin: args.p_skin as string, stage: args.p_stage as number }
        : null;
      return {};
    }
    return {};
  };
  const joined = await emit(a.socket, "town-join", { character: "auralynx" });
  const viewer = await emit(b.socket, "town-join", { character: "auralynx" });
  await ticks(4);
  expect(b.seen.profiles.get(joined.me!)).toMatchObject({
    skin: championSkin,
    look,
  });
  expect(a.seen.profiles.get(viewer.me!)).toMatchObject({
    skin: null,
    look: {},
  });
  await emit(b.socket, "town-look", {
    character: "auralynx",
    skin: { skin: "auralynx-celestial-sage", stage: 3 },
    look: { aura: "halo-aura" },
    accountId: a.account!.id,
  });
  await ticks(2);
  expect(a.seen.profiles.get(viewer.me!)).toMatchObject({
    skin: null,
    look: {},
  });
  const post = (path: string, body: unknown) =>
    fetch(url + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${a.token}`,
      },
      body: JSON.stringify(body),
    });
  expect(
    (
      await post("/api/shop/equip", {
        champion: "auralynx",
        skin: "auralynx-celestial-sage",
        stage: 3,
      })
    ).ok,
  ).toBe(true);
  expect(
    (await post("/api/raids/equip", { slot: "aura", item: "halo-aura" })).ok,
  ).toBe(true);
  await ticks(4);
  expect(b.seen.profiles.get(joined.me!)).toMatchObject({
    skin: { skin: "auralynx-celestial-sage", stage: 3 },
    look: {
      skin: "candy-colours",
      aura: "halo-aura",
      entrance: "firefall",
      victory: "twin-spark",
      frame: "crescent",
    },
  });
  expect(
    (
      await post("/api/shop/equip", {
        champion: "auralynx",
        skin: null,
        stage: 1,
      })
    ).ok,
  ).toBe(true);
  expect(
    (await post("/api/raids/equip", { slot: "aura", item: null })).ok,
  ).toBe(true);
  await ticks(4);
  expect(b.seen.profiles.get(joined.me!)).toMatchObject({
    skin: null,
    look: { skin: "candy-colours", aura: null },
  });
  expect(b.seen.states.at(-1)?.population).toBe(2);
});
