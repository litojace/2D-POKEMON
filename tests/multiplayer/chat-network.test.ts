import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import type { ChatLine } from "../../packages/shared/src/chat";
import type { Reply } from "../../packages/shared/src/index";

// In-game chat over real Socket.IO connections (docs/chat-plan.md): who is
// in the party and room channels, blocks, and the typing switch.
let server: ReturnType<typeof createArenaServer> | undefined;
const sockets: Socket[] = [];
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.disconnect());
  await server?.close();
  server = undefined;
});
type Answer = Reply & { lines?: ChatLine[] };
const request = (s: Socket, event: string, data: unknown = {}) =>
  new Promise<Answer>((resolve) => s.emit(event, data, resolve));
const settle = () => new Promise((r) => setTimeout(r, 30));

async function setup(
  chatFreeText = true,
  blockedBy: (ids: {
    lead: string;
    pal: string;
  }) => Record<string, string[]> = () => ({}),
) {
  const accounts = fakeAccounts(),
    lead = accounts.add(false),
    pal = accounts.add(false),
    stranger = accounts.add(false);
  const blocks = new Map<string, string[]>(
    Object.entries(
      blockedBy({ lead: lead.account.id, pal: pal.account.id }),
    ).map(([who, ids]) => [
      who === lead.account.id ? lead.token : pal.token,
      ids,
    ]),
  );
  accounts.provider.rpc = async (token, name) => {
    if (name === "arena_blocked_players")
      return (blocks.get(token) ?? []).map((id) => ({ id, name: "x" }));
    if (name !== "arena_friends") return {};
    return {
      code: "ABCDEF12",
      friends:
        token === lead.token
          ? [{ id: pal.account.id, name: pal.account.displayName }]
          : [{ id: lead.account.id, name: lead.account.displayName }],
      incoming: [],
      outgoing: [],
    };
  };
  server = createArenaServer({
    accounts: accounts.provider,
    autoTick: false,
    chatFreeText,
  });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`;
  const connect = async (token: string) => {
    const s = io(url, {
      auth: { accessToken: token },
      transports: ["websocket"],
      reconnection: false,
    });
    sockets.push(s);
    await new Promise<void>((r, reject) => {
      s.once("connect", r);
      s.once("connect_error", reject);
    });
    const heard: ChatLine[] = [];
    s.on("chat", (line: ChatLine) => heard.push(line));
    return { s, heard };
  };
  const a = await connect(lead.token),
    b = await connect(pal.token),
    x = await connect(stranger.token);
  return { accounts, blocks, lead, pal, stranger, a, b, x, connect };
}

async function partyUp(f: Awaited<ReturnType<typeof setup>>) {
  const invite = await new Promise<{ code: string }>((resolve) => {
    f.b.s.once("room-invite", resolve);
    void request(f.a.s, "party-invite", {
      playerId: f.pal.account.id,
      character: "voltkit",
    });
  });
  expect(
    (
      await request(f.b.s, "party-accept", {
        code: invite.code,
        character: "tidefin",
      })
    ).ok,
  ).toBe(true);
  await settle();
}

it("party chat reaches the party, not strangers, and keeps history", async () => {
  const f = await setup();
  // Not in a party yet: nobody to chat with.
  expect(
    await request(f.a.s, "chat-send", { channel: "party", text: "hi" }),
  ).toMatchObject({ ok: false });
  await partyUp(f);
  expect(
    await request(f.a.s, "chat-send", { channel: "party", text: "hi pal" }),
  ).toEqual({ ok: true });
  await settle();
  for (const who of [f.a, f.b])
    expect(who.heard.map((l) => [l.channel, l.from.id, l.text])).toEqual([
      ["party", f.lead.account.id, "hi pal"],
    ]);
  expect(f.x.heard).toEqual([]);
  // A stranger can't speak into the party, and the history is the party's.
  expect(
    (await request(f.x.s, "chat-send", { channel: "party", text: "yo" })).ok,
  ).toBe(false);
  const history = await request(f.b.s, "chat-history", { channel: "party" });
  expect(history.lines?.map((l) => l.text)).toEqual(["hi pal"]);
  expect(
    (await request(f.x.s, "chat-history", { channel: "party" })).lines,
  ).toEqual([]);
});

it("quick chat works with typing paused; typed lines wait for the switch", async () => {
  const f = await setup(false);
  await partyUp(f);
  expect(
    await request(f.a.s, "chat-send", { channel: "party", text: "hi" }),
  ).toEqual({ ok: false, error: "Typing in chat is paused. Use quick chat." });
  expect(
    await request(f.a.s, "chat-send", { channel: "party", quick: "wave" }),
  ).toEqual({ ok: true });
  await settle();
  expect(f.b.heard.map((l) => l.quick)).toEqual(["wave"]);
});

it("a block stops chat both ways, read from the player's block list", async () => {
  // The pal blocked the leader.
  const f = await setup(true, ({ lead, pal }) => ({ [pal]: [lead] }));
  await partyUp(f);
  expect(
    await request(f.a.s, "chat-send", {
      channel: "party",
      text: "can you hear",
    }),
  ).toEqual({ ok: true });
  await settle();
  expect(
    await request(f.b.s, "chat-send", { channel: "party", text: "no" }),
  ).toEqual({ ok: true });
  await settle();
  // Each still sees their own line; neither hears the other.
  expect(f.a.heard.map((l) => l.text)).toEqual(["can you hear"]);
  expect(f.b.heard.map((l) => l.text)).toEqual(["no"]);
  expect(
    (await request(f.b.s, "chat-history", { channel: "party" })).lines?.map(
      (l) => l.text,
    ),
  ).toEqual(["no"]);
});

it("room chat: typing before the battle reaches everyone in the room", async () => {
  const f = await setup();
  const host = await request(f.a.s, "create", { name: "One" });
  const code = (host as { code?: string }).code!;
  expect((await request(f.b.s, "join", { name: "Two", code })).ok).toBe(true);
  expect(
    await request(f.b.s, "chat-send", { channel: "room", text: "ready?" }),
  ).toEqual({ ok: true });
  await settle();
  expect(f.a.heard.map((l) => [l.channel, l.text])).toEqual([
    ["room", "ready?"],
  ]);
  expect(f.x.heard).toEqual([]);
  // Calls wait for the battle.
  expect(
    await request(f.a.s, "chat-send", { channel: "room", quick: "attack" }),
  ).toEqual({ ok: false, error: "Calls are for battles." });
});
