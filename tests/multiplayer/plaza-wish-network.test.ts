import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import type { Reply } from "@arena/shared";
import {
  PLAZA,
  PLAZA_FOUNTAIN,
  PLAZA_SPAWN,
  plazaCollide,
  wishTarget,
  type PlazaNews,
  type PlazaTreat,
  type PlazaWish,
  type PlazaWishPay,
} from "../../packages/shared/src/plaza";

// The wishing fountain over real sockets: a treat thrown at the fountain
// (by the server's own position) is a wish for the whole copy; a full meter
// brings the fireworks and pays every wisher through the database.
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
const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

const setup = async () => {
  const accounts = fakeAccounts(),
    paid: [string, string][] = [];
  accounts.provider.rpc = async (_token, name) => {
    if (name === "arena_plaza_treats") return 10;
    if (name === "arena_plaza_treat")
      return { ok: true, treat: "candy", left: 5 };
    return {};
  };
  accounts.provider.recordWish = async (player, ref) => {
    paid.push([player, ref]);
    return { paid: true, coins: 15, today: 1 };
  };
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`;
  const connect = async () => {
    const user = accounts.add(false);
    const socket = io(url, {
      auth: { accessToken: user.token },
      transports: ["websocket"],
      reconnection: false,
    });
    clients.push(socket);
    await new Promise<void>((r, j) => {
      socket.once("connect", r);
      socket.once("connect_error", j);
    });
    const seen = {
      wishes: [] as PlazaWish[],
      treats: [] as PlazaTreat[],
      news: [] as PlazaNews[],
      pays: [] as PlazaWishPay[],
    };
    socket.on("plaza-wish", (w: PlazaWish) => seen.wishes.push(w));
    socket.on("plaza-treat", (t: PlazaTreat) => seen.treats.push(t));
    socket.on("plaza-news", (n: PlazaNews) => seen.news.push(n));
    socket.on("plaza-wish-paid", (p: PlazaWishPay) => seen.pays.push(p));
    await emit(socket, "plaza-join", { character: "voltkit" });
    return { socket, seen, account: user.account };
  };
  return { connect, paid };
};
const toFountain = (socket: Socket) => {
  const b = server!.plaza.bodyOf(socket.id!)!;
  Object.assign(
    b,
    plazaCollide({ x: PLAZA_FOUNTAIN.x, y: PLAZA_FOUNTAIN.y + 60 }),
  );
};

it("makes a wish only at the fountain, and fills the copy's meter together", async () => {
  const { connect, paid } = await setup();
  const ann = await connect(),
    ben = await connect();
  // Away from the fountain a treat is just a treat.
  Object.assign(server!.plaza.bodyOf(ann.socket.id!)!, {
    x: PLAZA_SPAWN.x,
    y: PLAZA_SPAWN.y + 150,
  });
  const plain = await emit(ann.socket, "plaza-treat");
  expect(plain).toMatchObject({ ok: true });
  expect(plain.wish).toBeUndefined();
  await settle();
  expect(ben.seen.treats.at(-1)?.wish).toBeUndefined();
  // Joining sent the empty meter; the plain treat added nothing.
  expect(ben.seen.wishes).toEqual([{ n: 0, target: 0 }]);

  toFountain(ann.socket);
  toFountain(ben.socket);
  const goal = wishTarget(2);
  expect(goal).toBe(6);
  // Ann's cooldown from the plain treat: Ben wishes first.
  expect(await emit(ben.socket, "plaza-treat")).toMatchObject({
    ok: true,
    wish: true,
  });
  await settle();
  expect(ann.seen.wishes.at(-1)).toEqual({ n: 1, target: goal });
  expect(ann.seen.treats.at(-1)?.wish).toBe(true);
  // Then both at once, three rounds a cooldown apart: six in all.
  for (let round = 0; round < 3; round++) {
    await settle(PLAZA.treatSeconds * 1000 + 50);
    await emit(ann.socket, "plaza-treat");
    if (round < 2) await emit(ben.socket, "plaza-treat");
  }
  await settle();
  // Full: fireworks for both, the news, each wisher paid once.
  for (const p of [ann, ben]) {
    const last = p.seen.wishes.at(-1)!;
    expect(last.n).toBe(0);
    expect(last.show?.at).toBeGreaterThan(0);
    expect(p.seen.news).toContainEqual({ kind: "wish" });
    expect(p.seen.pays).toEqual([{ paid: true, coins: 15, today: 1 }]);
  }
  expect(paid.map(([who]) => who).sort()).toEqual(
    [ann.account.id, ben.account.id].sort(),
  );
  expect(new Set(paid.map(([, ref]) => ref)).size).toBe(1);
  expect(paid[0][1]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );

  // Someone joining during the show sees it.
  const cat = await connect();
  await settle();
  expect(cat.seen.wishes.at(-1)?.show?.at).toBe(
    ann.seen.wishes.at(-1)!.show!.at,
  );
}, 20000);
