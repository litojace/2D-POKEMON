import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import type { Reply } from "@arena/shared";
import { playerLevel } from "../../packages/shared/src/journey";
import {
  PLAZA,
  PLAZA_SPAWN,
  PLAZA_SPOTS,
  PLAZA_GIFT,
  type PlazaGift,
  type PlazaGiftGone,
  type PlazaNews,
  type PlazaProfile,
  type PlazaProgress,
  type PlazaRecord,
  type PlazaState,
} from "../../packages/shared/src/plaza";

// The new Plaza over real sockets: the server moves everyone, checks spots
// by its own positions and reports rewards with the service role.
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
const QUIET = Date.parse("2026-11-02T21:16:00.000Z");

const setup = async () => {
  const accounts = fakeAccounts(),
    records: PlazaRecord[] = [],
    bobaRefs: string[] = [],
    giftRefs: string[] = [];
  let gifts = 3;
  accounts.provider.rpc = async (_token, name, args) => {
    if (name === "arena_journey") return { xp: 900 };
    if (name === "arena_my_looks")
      return { voltkit: { skin: "galaxy-voltkit", stage: 1 } };
    // Volt Boba is free: the database only checks the player.
    if (name === "arena_plaza_boba") {
      bobaRefs.push(String(args.p_ref));
      return { ok: true };
    }
    // Gift boxes: the database counts what's left today down.
    if (name === "arena_plaza_gift") {
      giftRefs.push(String(args.p_ref));
      if (gifts < 1)
        return {
          ok: false,
          error:
            "No gift boxes left today. Plaza quests and rare fish earn more!",
          left: 0,
        };
      gifts--;
      return { ok: true, left: gifts };
    }
    return {};
  };
  accounts.provider.recordPlaza = async (event) => {
    records.push(event);
    return { orbsToday: 0 } as unknown as PlazaProgress;
  };
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
      states: [] as PlazaState[],
      profiles: new Map<number, PlazaProfile>(),
      news: [] as PlazaNews[],
      progress: [] as PlazaProgress[],
      gifts: [] as PlazaGift[],
      giftGone: [] as PlazaGiftGone,
      closed: 0,
    };
    socket.on("plaza-state", (s: PlazaState) => seen.states.push(s));
    socket.on("plaza-profiles", (list: PlazaProfile[]) =>
      list.forEach((p) => seen.profiles.set(p.id, p)),
    );
    socket.on("plaza-news", (n: PlazaNews) => seen.news.push(n));
    socket.on("plaza-progress", (p: PlazaProgress) => seen.progress.push(p));
    socket.on("plaza-closed", () => seen.closed++);
    socket.on("plaza-gift", (g: PlazaGift) => seen.gifts.push(g));
    socket.on("plaza-gift-gone", (g: PlazaGiftGone) =>
      seen.giftGone.push(...g),
    );
    return { socket, seen, account: user?.account };
  };
  let now = QUIET;
  const ticks = async (n: number) => {
    for (let i = 0; i < n; i++) server!.plazaStep((now += 50));
    await settle();
  };
  return { connect, ticks, records, bobaRefs, giftRefs };
};
const teleport = (socket: Socket, x: number, y: number) => {
  const b = server!.plaza.bodyOf(socket.id!)!;
  b.x = x;
  b.y = y;
};

it("lets signed-in players walk the Plaza together and see each other", async () => {
  const { connect, ticks } = await setup();
  const guest = await connect(false);
  expect(
    (await emit(guest.socket, "plaza-join", { character: "voltkit" })).ok,
  ).toBe(false);
  const ann = await connect(),
    ben = await connect();
  const joined = await emit(ann.socket, "plaza-join", { character: "voltkit" });
  expect(joined).toMatchObject({ ok: true, plaza: 1 });
  expect(
    (await emit(ben.socket, "plaza-join", { character: "tidefin" })).ok,
  ).toBe(true);
  expect(
    (await emit(ann.socket, "plaza-join", { character: "missingno" })).ok,
  ).toBe(false); // an unknown fighter is refused
  // Spawns are spread up to 70px around the spawn point: start Ann on it,
  // so walking right for 0.2 s (about 48px) always ends past it.
  teleport(ann.socket, PLAZA_SPAWN.x, PLAZA_SPAWN.y);
  ann.socket.emit("plaza-input", { dx: 1, dy: 0 });
  await settle();
  await ticks(4);
  const state = ann.seen.states.at(-1)!;
  expect(state.me).toBe(joined.me);
  expect(state.walkers.length).toBeGreaterThanOrEqual(2);
  const mine = state.walkers.find((w) => w[0] === joined.me)!;
  expect(mine[1]).toBeGreaterThan(PLAZA_SPAWN.x + 30);
  // The skin and level come from the account, not the browser.
  const me = ann.seen.profiles.get(joined.me!)!;
  expect(me).toMatchObject({
    character: "voltkit",
    level: playerLevel(900).level,
  });
  expect(me.skin).toEqual({ skin: "galaxy-voltkit", stage: 1 });
  expect(
    [...ann.seen.profiles.values()].some(
      (p) => p.name === ben.account!.displayName,
    ),
  ).toBe(true);
  expect((await emit(ann.socket, "plaza-emote", { emote: "👋" })).ok).toBe(
    true,
  );
  expect((await emit(ann.socket, "plaza-emote", { emote: "👋" })).ok).toBe(
    false,
  );
});

it("checks the Photo Spot and the boba truck by the server's position, and asks for boba once", async () => {
  const { connect, ticks, records, bobaRefs } = await setup();
  const ann = await connect();
  await emit(ann.socket, "plaza-join", { character: "voltkit" });
  expect(await emit(ann.socket, "plaza-act", { spot: "photo" })).toMatchObject({
    ok: false,
  });
  const photo = PLAZA_SPOTS.find((s) => s.id === "photo")!,
    cafe = PLAZA_SPOTS.find((s) => s.id === "cafe")!;
  teleport(ann.socket, photo.x, photo.y);
  expect((await emit(ann.socket, "plaza-act", { spot: "photo" })).ok).toBe(
    true,
  );
  await settle();
  expect(records).toEqual([{ player: ann.account!.id, kind: "photo" }]);
  expect(ann.seen.progress).toHaveLength(1);
  expect((await emit(ann.socket, "plaza-act", { spot: "cafe" })).ok).toBe(
    false,
  );
  teleport(ann.socket, cafe.x, cafe.y);
  expect(await emit(ann.socket, "plaza-act", { spot: "cafe" })).toEqual({
    ok: true,
  });
  expect(server!.plaza.boosted(ann.socket.id!)).toBe(true);
  // Still boosted: no second boba.
  expect((await emit(ann.socket, "plaza-act", { spot: "cafe" })).ok).toBe(
    false,
  );
  expect(bobaRefs).toHaveLength(1);
  expect(bobaRefs[0]).toMatch(/^[0-9a-f-]{36}$/);
  await ticks(2);
  expect(await emit(ann.socket, "plaza-act", { spot: "moon" })).toMatchObject({
    ok: false,
  });
});

it("takes you out of the Plaza when you open a room", async () => {
  const { connect } = await setup();
  const ann = await connect();
  await emit(ann.socket, "plaza-join", { character: "voltkit" });
  expect(server!.plaza.size).toBe(1);
  expect(
    (await emit(ann.socket, "create", { name: "Ann", mode: "duel" })).ok,
  ).toBe(true);
  await settle();
  expect(server!.plaza.size).toBe(0);
  expect(ann.seen.closed).toBe(1);
  expect(
    (await emit(ann.socket, "plaza-join", { character: "voltkit" })).ok,
  ).toBe(false);
});

it("tosses a gift box for everyone in your Plaza, one at a time, and its orbs are for the others", async () => {
  const { connect, ticks, giftRefs, records } = await setup();
  const ann = await connect(),
    ben = await connect();
  // Not in the Plaza yet: nothing to toss.
  expect(await emit(ann.socket, "plaza-gift")).toEqual({
    ok: false,
    error: "Not in the Plaza.",
  });
  await emit(ann.socket, "plaza-join", { character: "voltkit" });
  const benJoined = await emit(ben.socket, "plaza-join", {
    character: "tidefin",
  });
  await ticks(1);
  teleport(ann.socket, PLAZA_SPAWN.x, PLAZA_SPAWN.y);
  teleport(ben.socket, PLAZA_SPAWN.x + 600, PLAZA_SPAWN.y);
  const r = await emit(ann.socket, "plaza-gift");
  expect(r.ok).toBe(true);
  expect(r.gifts).toBe(2);
  expect(typeof r.golden).toBe("boolean");
  await settle();
  // Everyone in that Plaza sees it: from where the server has the thrower,
  // landing ahead, with its orbs.
  expect(ann.seen.gifts).toHaveLength(1);
  expect(ben.seen.gifts).toEqual(ann.seen.gifts);
  const gift = ann.seen.gifts[0];
  expect({ x0: gift.x0, y0: gift.y0 }).toEqual({
    x0: PLAZA_SPAWN.x,
    y0: PLAZA_SPAWN.y,
  });
  expect(Math.hypot(gift.x - gift.x0, gift.y - gift.y0)).toBeGreaterThan(
    PLAZA_GIFT.reach * 0.5,
  );
  expect(gift.orbs).toHaveLength(
    gift.golden ? PLAZA_GIFT.goldenOrbs : PLAZA_GIFT.orbs,
  );
  // Too soon: refused before the database is asked.
  expect(await emit(ann.socket, "plaza-gift")).toEqual({
    ok: false,
    error: "Wait a moment between gift boxes.",
  });
  expect(giftRefs).toHaveLength(1);
  // Once open, the thrower standing on an orb catches nothing…
  await ticks(Math.ceil((PLAZA_GIFT.flightMs + PLAZA_GIFT.openMs + 400) / 50));
  const [orbId, ox, oy] = gift.orbs[0];
  teleport(ann.socket, ox, oy);
  await ticks(4);
  expect(ann.seen.giftGone).toEqual([]);
  // …and someone else does: everyone sees who, and it counts as an orb.
  teleport(ann.socket, PLAZA_SPAWN.x, PLAZA_SPAWN.y);
  teleport(ben.socket, ox, oy);
  await ticks(4);
  expect(ann.seen.giftGone).toContainEqual([gift.id, orbId, benJoined.me]);
  expect(ben.seen.giftGone).toEqual(ann.seen.giftGone);
  const orbRecords = records.filter((e) => e.kind === "orb");
  expect(orbRecords.length).toBeGreaterThan(0);
  for (const e of orbRecords) expect(e.ref).toMatch(/^[0-9]{6,12}-[0-9]{1,9}$/);
  // What nobody catches fades away.
  await ticks(Math.ceil(PLAZA_GIFT.lastsMs / 50));
  const gone = new Set(ann.seen.giftGone.map(([, o]) => o));
  for (const [o] of gift.orbs) expect(gone.has(o)).toBe(true);
  // None left today: the database says so, and nobody sees a toss.
  const pause = () =>
    new Promise((res) => setTimeout(res, PLAZA_GIFT.throwSeconds * 1000 + 100));
  await pause();
  expect((await emit(ann.socket, "plaza-gift")).gifts).toBe(1);
  await pause();
  expect((await emit(ann.socket, "plaza-gift")).gifts).toBe(0);
  await pause();
  expect(await emit(ann.socket, "plaza-gift")).toEqual({
    ok: false,
    error: "No gift boxes left today. Plaza quests and rare fish earn more!",
    gifts: 0,
  });
  await settle();
  expect(ben.seen.gifts).toHaveLength(3);
  // A fresh id per toss: a retried request can't take two boxes.
  expect(new Set(giftRefs).size).toBe(4);
}, 20000);

it("jumps and dashes while the stick is being steered", async () => {
  // A dragged stick sends up to 20 updates a second. Counted with every
  // other message, they used up the 10 a second a jump or a dash may send:
  // one pressed after half a second of steering was dropped, the server
  // left you on the ground, and your phone pulled you back from the jump.
  const { connect, ticks } = await setup();
  const ann = await connect();
  expect(
    (await emit(ann.socket, "plaza-join", { character: "voltkit" })).ok,
  ).toBe(true);
  await ticks(2);
  for (let i = 0; i < 15; i++)
    ann.socket.emit("plaza-input", { dx: 1, dy: i / 100 });
  ann.socket.emit("plaza-jump", {});
  await ticks(2);
  const body = server!.plaza.bodyOf(ann.socket.id!)!;
  expect(body.air).toBeGreaterThan(0);
  // And a dash, after more steering in the same second.
  for (let i = 0; i < 15; i++)
    ann.socket.emit("plaza-input", { dx: 1, dy: -i / 100 });
  ann.socket.emit("plaza-dash", { dx: 1, dy: 0 });
  await ticks(1);
  expect(server!.plaza.bodyOf(ann.socket.id!)!.dash).toBeGreaterThan(0);
});
