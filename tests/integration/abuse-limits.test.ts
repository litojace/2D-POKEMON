import { createServer, request, type Server } from "node:http";
import { afterEach, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import {
  ClientAddresses,
  WindowLimits,
  floodGuard,
} from "../../apps/server/src/abuse-limits";
import { fakeAccounts } from "../helpers/accounts";
import type { Reply } from "../../packages/shared/src/index";

let server: ReturnType<typeof createArenaServer> | undefined;
let proxy: Server | undefined;
let clients: Socket[] = [];
afterEach(async () => {
  for (const c of clients) c.disconnect();
  clients = [];
  await new Promise((r) => (proxy ? proxy.close(r) : r(null)));
  proxy = undefined;
  await server?.close();
  server = undefined;
  vi.useRealTimers();
});

/**
 * The game server behind a stand-in for the host's proxies. Like the real
 * ones, it keeps whatever X-Forwarded-For the client sent and appends what
 * it saw itself: the client's address (here given by the test in
 * `x-test-client`, since every local connection is 127.0.0.1), then the
 * edge's own.
 */
async function behindProxy() {
  const accounts = fakeAccounts();
  const authenticate = vi.spyOn(accounts.provider, "authenticate");
  const log: { event: string; details: Record<string, unknown> }[] = [];
  server = createArenaServer({
    accounts: accounts.provider,
    autoTick: false,
    connectionLog: (event, details) => log.push({ event, details }),
  });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const { port } = server.http.address() as { port: number };
  proxy = createServer((req, res) => {
    const { "x-test-client": client, ...headers } = req.headers;
    const sent = req.headers["x-forwarded-for"];
    headers["x-forwarded-for"] = [...(sent ? [sent] : []), client, "172.70.9.9"]
      .flat()
      .join(", ");
    req.pipe(
      request(
        { port, host: "127.0.0.1", path: req.url, method: req.method, headers },
        (upstream) => {
          res.writeHead(upstream.statusCode ?? 502, upstream.headers);
          upstream.pipe(res);
        },
      ),
    );
  });
  await new Promise<void>((r) => proxy!.listen(0, "127.0.0.1", r));
  const { port: front } = proxy.address() as { port: number };
  /** One API request from `client`; `forged` is a header the client adds. */
  const get = async (client: string, forged?: string) =>
    (
      await fetch(`http://127.0.0.1:${front}/api/account`, {
        headers: {
          "x-test-client": client,
          ...(forged ? { "X-Forwarded-For": forged } : {}),
        },
      })
    ).status;
  const many = async (count: number, client: string, forged?: () => string) => {
    const seen = new Set<number>();
    for (let i = 0; i < count; i += 20)
      for (const status of await Promise.all(
        Array.from({ length: Math.min(20, count - i) }, () =>
          get(client, forged?.()),
        ),
      ))
        seen.add(status);
    return [...seen];
  };
  const connect = (token: string, from: string) =>
    new Promise<Socket | (Error & { data?: { status?: number } })>((done) => {
      const socket = io(`http://127.0.0.1:${port}`, {
        transports: ["websocket"],
        forceNew: true,
        reconnection: false,
        auth: { accessToken: token },
        extraHeaders: { "X-Forwarded-For": `${from}, 172.70.9.9` },
      });
      clients.push(socket);
      socket.on("connect", () => done(socket));
      socket.on("connect_error", (error) => done(error));
    });
  return { accounts, authenticate, log, get, many, connect, port };
}
const A = "203.0.113.7",
  B = "198.51.100.23";

it("gives each player behind the host's proxies an allowance of their own", async () => {
  const { get, many, log } = await behindProxy();
  // No token: 401, the answer of a request that was let through.
  expect(await many(120, A)).toEqual([401]);
  expect(await get(A)).toBe(429);
  expect(await get(B)).toBe(401);
  expect(await many(119, B)).toEqual([401]);
  expect(await get(B)).toBe(429);
  // The log shows the chain's shape once, and no address.
  expect(log.filter((l) => l.event === "arena-proxy-chain")).toEqual([
    {
      event: "arena-proxy-chain",
      details: { forwarded: 2, kinds: ["public", "public"] },
    },
  ]);
});

it("keeps a client in its own allowance whatever X-Forwarded-For it sends", async () => {
  const { get, many } = await behindProxy();
  let n = 0;
  // A forged header on the very first request, before any honest one.
  expect(await get(A, "192.0.2.200")).toBe(401);
  expect(await get(B)).toBe(401);
  // (That one request is all a forged header ever gains: until the first
  // honest request shows the chain's real length, it counted elsewhere.)
  // A new made-up address each time, then the other player's address.
  expect(await many(120, A, () => `192.0.2.${++n % 250}`)).toEqual([401]);
  expect(await get(A, "192.0.2.251")).toBe(429);
  expect(await get(A, B)).toBe(429);
  expect(await get(A, `192.0.2.1, ${B}, 172.70.9.9`)).toBe(429);
  // The other player lost nothing to it: one request used, 119 left.
  expect(await many(119, B)).toEqual([401]);
  expect(await get(B)).toBe(429);
});

it("reads the address a direct connection really has, and one bucket per IPv6 /64", () => {
  const addresses = new ClientAddresses(undefined);
  // From the internet directly: its own address, whatever it claims.
  expect(addresses.of("8.8.8.8", "1.2.3.4")).toBe("8.8.8.8");
  expect(addresses.of("::ffff:8.8.8.8", undefined)).toBe("8.8.8.8");
  expect(addresses.of("127.0.0.1", undefined)).toBe("127.0.0.1");
  expect(addresses.of(undefined, undefined)).toBe("unknown");
  // Through the proxies (a private peer), with IPv6 players.
  const one = addresses.of("10.0.0.4", "2001:db8:1:2:aaaa::1, 172.70.9.9");
  expect(one).toBe("2001:db8:1:2::/64");
  expect(addresses.of("10.0.0.4", "2001:DB8:1:2::9, 172.70.9.9")).toBe(one);
  expect(addresses.of("10.0.0.4", "2001:db8:1:3::9, 172.70.9.9")).not.toBe(one);
  // Only a private address known: no key for a limit that locks out.
  expect(addresses.ofPublic("10.0.0.4", undefined)).toBeNull();
  expect(addresses.ofPublic("10.0.0.4", "1.2.3.4, 172.70.9.9")).toBe("1.2.3.4");
  // Not an address at the client's place: fall back to the connection's.
  expect(addresses.of("10.0.0.4", "nonsense, 172.70.9.9")).toBe("10.0.0.4");
  // TRUST_PROXY_HOPS pins the place instead of learning it.
  const pinned = new ClientAddresses("3");
  expect(pinned.of("10.0.0.4", "9.9.9.9, 1.2.3.4, 172.70.9.9, 10.0.0.1")).toBe(
    "1.2.3.4",
  );
  expect(pinned.of("10.0.0.4", "1.2.3.4")).toBe("1.2.3.4");
});

it("stops asking the accounts service about made-up logins from one address", async () => {
  const { accounts, authenticate, connect } = await behindProxy();
  const player = accounts.add(false);
  for (let i = 0; i < 20; i++) {
    const refused = await connect(`made-up-${i}`, A);
    expect((refused as { data?: { status?: number } }).data?.status).toBe(401);
  }
  expect(authenticate).toHaveBeenCalledTimes(20);
  for (let i = 0; i < 5; i++) {
    const refused = await connect(`made-up-more-${i}`, A);
    expect((refused as { data?: { status?: number } }).data?.status).toBe(429);
  }
  expect(authenticate).toHaveBeenCalledTimes(20);
  // A player somewhere else still gets in.
  const online = await connect(player.token, B);
  expect((online as Socket).connected).toBe(true);
});

it("gives solo-practice commands, which re-check the login, a small allowance", async () => {
  const { accounts, authenticate, connect } = await behindProxy();
  const player = accounts.add(false);
  const socket = (await connect(player.token, A)) as Socket;
  const emit = (event: string, data: unknown = {}) =>
    new Promise<Reply>((resolve, reject) =>
      socket
        .timeout(1000)
        .emit(event, data, (error: Error | null, result: Reply) =>
          error ? reject(error) : resolve(result),
        ),
    );
  expect(
    (await emit("practice", { name: "Solo", character: "voltkit" })).ok,
  ).toBe(true);
  authenticate.mockClear();
  const replies = await Promise.all(
    Array.from({ length: 40 }, () => emit("practice-reset")),
  );
  expect(replies.filter((r) => r.ok).length).toBe(10);
  expect(replies.filter((r) => r.error === "Too many requests.").length).toBe(
    30,
  );
  expect(authenticate).toHaveBeenCalledTimes(10);
});

it("drops a flood of events of any kind, and closes a connection that keeps flooding", () => {
  vi.useFakeTimers();
  let closed = 0;
  const guard = floodGuard(() => closed++, 300, 3);
  const second = (events: number) => {
    let passed = 0,
      refused = 0;
    for (let i = 0; i < events; i++)
      guard(["rtt", {}, () => refused++], () => passed++);
    vi.advanceTimersByTime(1001);
    return { passed, refused };
  };
  // A game's normal traffic passes untouched.
  expect(second(60)).toEqual({ passed: 60, refused: 0 });
  // One burst (a reconnect flushing its queue) is trimmed, not punished.
  expect(second(2000)).toEqual({ passed: 300, refused: 1700 });
  expect(second(60)).toEqual({ passed: 60, refused: 0 });
  expect(second(2000).passed).toBe(300);
  expect(second(2000).passed).toBe(300);
  expect(closed).toBe(0);
  // The third flooded second in a row closes it.
  expect(second(2000).passed).toBe(300);
  expect(closed).toBe(1);
});

it("counts a window's events per key and forgets it when the window ends", () => {
  const limits = new WindowLimits(2, 1000);
  expect([
    limits.take("a", 0),
    limits.take("a", 1),
    limits.take("a", 2),
  ]).toEqual([true, true, false]);
  expect(limits.take("b", 2)).toBe(true);
  expect(limits.over("a", 999)).toBe(true);
  expect(limits.over("a", 1001)).toBe(false);
  expect(limits.take("a", 1002)).toBe(true);
});
