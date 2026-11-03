import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import type { Reply } from "@arena/shared";
import { playerLevel } from "../../packages/shared/src/journey";
import {
  PLAZA_SPOTS,
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
    bobaRefs: string[] = [];
  let leaves = 25;
  accounts.provider.rpc = async (_token, name, args) => {
    if (name === "arena_journey") return { xp: 900 };
    if (name === "arena_my_looks")
      return { voltkit: { skin: "galaxy-voltkit", stage: 1 } };
    if (name === "arena_plaza_boba") {
      bobaRefs.push(String(args.p_ref));
      if (leaves < 10) return { ok: false, leaves };
      leaves -= 10;
      return { ok: true, leaves };
    }
    return {};
  };
  accounts.provider.recordPlaza = async (event) => {
    records.push(event);
    return { leaves, orbsToday: 0 } as unknown as PlazaProgress;
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
      closed: 0,
    };
    socket.on("plaza-state", (s: PlazaState) => seen.states.push(s));
    socket.on("plaza-profiles", (list: PlazaProfile[]) =>
      list.forEach((p) => seen.profiles.set(p.id, p)),
    );
    socket.on("plaza-news", (n: PlazaNews) => seen.news.push(n));
    socket.on("plaza-progress", (p: PlazaProgress) => seen.progress.push(p));
    socket.on("plaza-closed", () => seen.closed++);
    return { socket, seen, account: user?.account };
  };
  let now = QUIET;
  const ticks = async (n: number) => {
    for (let i = 0; i < n; i++) server!.plazaStep((now += 50));
    await settle();
  };
  return { connect, ticks, records, bobaRefs };
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
  ann.socket.emit("plaza-input", { dx: 1, dy: 0 });
  await settle();
  await ticks(4);
  const state = ann.seen.states.at(-1)!;
  expect(state.me).toBe(joined.me);
  expect(state.walkers.length).toBeGreaterThanOrEqual(2);
  const mine = state.walkers.find((w) => w[0] === joined.me)!;
  expect(mine[1]).toBeGreaterThan(1350);
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

it("checks the Photo Spot and the boba truck by the server's position, and charges boba once", async () => {
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
    leaves: 15,
  });
  expect(server!.plaza.boosted(ann.socket.id!)).toBe(true);
  // Still boosted: no second charge.
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
