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
  const rpcs: { token: string; name: string; args: any }[] = [];
  accounts.provider.rpc = async (token, name, args) => {
    rpcs.push({ token, name, args });
    if (name === "arena_submit_report") return 1;
    if (name === "arena_blocked_players")
      return (blocks.get(token) ?? []).map((id) => ({ id, name: "x" }));
    if (name !== "arena_friends") return {};
    return {
      code: "ABCDEF12",
      friends:
        token === lead.token
          ? [{ id: pal.account.id, name: pal.account.displayName }]
          : token === pal.token
            ? [{ id: lead.account.id, name: lead.account.displayName }]
            : [],
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
  return { accounts, blocks, rpcs, lead, pal, stranger, a, b, x, connect };
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

it("Nearby on the Plaza: quick chat only, to everyone in the copy, with the Plaza's emote", async () => {
  const f = await setup();
  for (const who of [f.a, f.b])
    expect(
      (await request(who.s, "plaza-join", { character: "voltkit" })).ok,
    ).toBe(true);
  expect(
    await request(f.a.s, "chat-send", { channel: "place", text: "hello" }),
  ).toEqual({ ok: false, error: "Here you can use quick chat." });
  expect(
    await request(f.a.s, "chat-send", { channel: "place", quick: "wave" }),
  ).toEqual({ ok: true });
  await settle();
  for (const who of [f.a, f.b])
    expect(who.heard.map((l) => [l.channel, l.quick])).toEqual([
      ["place", "wave"],
    ]);
  // Not on the Plaza: not in it.
  expect(f.x.heard).toEqual([]);
  // The wave also pops over the sender's head in the Plaza's own state.
  const plazaWorld = server!.plaza as unknown as {
    visitors: Map<string, { emote: number }>;
  };
  expect(plazaWorld.visitors.get(f.a.s.id!)?.emote).toBe(1); // 👋 is first
});

it("Nearby on a farm: your own or a friend's, never a stranger's", async () => {
  const f = await setup();
  expect(
    (await request(f.a.s, "chat-farm", { owner: f.lead.account.id })).ok,
  ).toBe(true);
  expect(
    (await request(f.b.s, "chat-farm", { owner: f.lead.account.id })).ok,
  ).toBe(true);
  expect(
    await request(f.x.s, "chat-farm", { owner: f.lead.account.id }),
  ).toEqual({ ok: false, error: "Only friends can visit." });
  expect(
    await request(f.b.s, "chat-send", { channel: "place", quick: "party" }),
  ).toEqual({ ok: true });
  await settle();
  expect(f.a.heard.map((l) => l.quick)).toEqual(["party"]);
  expect(f.x.heard).toEqual([]);
  // Leaving the farm leaves its chat.
  await request(f.b.s, "chat-farm", { owner: null });
  expect(
    (await request(f.b.s, "chat-send", { channel: "place", quick: "wave" })).ok,
  ).toBe(false);
});

it("a report carries the lines the server kept, never ones the reporter makes up", async () => {
  const f = await setup();
  await partyUp(f);
  await request(f.b.s, "chat-send", { channel: "party", text: "hello there" });
  await new Promise((r) => setTimeout(r, 1300));
  await request(f.b.s, "chat-send", { channel: "party", text: "you are shit" });
  await settle();
  const rude = f.a.heard.find((l) => l.text === "you are ****")!;
  expect(rude).toBeTruthy();
  expect(
    await request(f.a.s, "chat-report", {
      channel: "party",
      id: rude.id,
      reason: "insults",
    }),
  ).toEqual({ ok: true });
  const sent = f.rpcs.find((r) => r.name === "arena_submit_report")!;
  expect(sent.token).toBe(f.lead.token);
  expect(sent.args.p_category).toBe("player");
  expect(sent.args.p_message).toBe(
    `Chat: ${f.pal.account.displayName}: insults`,
  );
  expect(sent.args.p_context).toMatchObject({
    source: "chat",
    reported: `${f.pal.account.displayName} (${f.pal.account.id})`,
  });
  const lines = Object.entries(sent.args.p_context)
    .filter(([k]) => k.startsWith("line"))
    .map(([, v]) => v);
  expect(lines).toHaveLength(2);
  expect(lines[1]).toContain("you are ****");
  // A line that isn't there, or your own, can't be reported.
  expect(
    await request(f.a.s, "chat-report", { channel: "party", id: 99999 }),
  ).toEqual({ ok: false, error: "That message is gone." });
  const mine = f.b.heard.find((l) => l.from.id === f.pal.account.id)!;
  expect(
    await request(f.b.s, "chat-report", { channel: "party", id: mine.id }),
  ).toEqual({ ok: false, error: "That's your own message." });
});

it("chat set to off: nothing reaches you; quick only: you can't type", async () => {
  const f = await setup();
  await partyUp(f);
  expect(await request(f.b.s, "chat-mode", { mode: "off" })).toEqual({
    ok: true,
  });
  await request(f.a.s, "chat-send", { channel: "party", text: "anyone?" });
  await settle();
  expect(f.b.heard).toEqual([]);
  await request(f.b.s, "chat-mode", { mode: "quick" });
  expect(
    await request(f.b.s, "chat-send", { channel: "party", text: "hi" }),
  ).toEqual({ ok: false, error: "Your chat is set to quick chat only." });
  expect(
    (await request(f.b.s, "chat-send", { channel: "party", quick: "hi" })).ok,
  ).toBe(true);
  expect((await request(f.b.s, "chat-mode", { mode: "loud" })).ok).toBe(false);
});

it("a player an admin stopped can't type until then, but quick chat works", async () => {
  const until = new Date(Date.now() + 3_600_000).toISOString();
  const accounts = fakeAccounts();
  const a = accounts.add(false),
    b = accounts.add(false);
  accounts.provider.chatStoppedUntil = async (id) =>
    id === b.account.id ? until : null;
  accounts.provider.rpc = async (token, name) =>
    name === "arena_friends"
      ? {
          code: "ABCDEF12",
          friends: [
            token === a.token
              ? { id: b.account.id, name: b.account.displayName }
              : { id: a.account.id, name: a.account.displayName },
          ],
          incoming: [],
          outgoing: [],
        }
      : name === "arena_blocked_players"
        ? []
        : {};
  server = createArenaServer({
    accounts: accounts.provider,
    autoTick: false,
    chatFreeText: true,
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
    await new Promise<void>((r) => s.once("connect", () => r()));
    return s;
  };
  const sa = await connect(a.token),
    sb = await connect(b.token);
  await settle();
  const invite = await new Promise<{ code: string }>((resolve) => {
    sb.once("room-invite", resolve);
    void request(sa, "party-invite", {
      playerId: b.account.id,
      character: "voltkit",
    });
  });
  await request(sb, "party-accept", { code: invite.code, character: "lumoth" });
  const typed = await request(sb, "chat-send", {
    channel: "party",
    text: "hi",
  });
  expect(typed.ok).toBe(false);
  expect(typed.error).toMatch(
    /^An admin stopped your chat until .* UTC\. Quick chat still works\.$/,
  );
  expect(
    (await request(sb, "chat-send", { channel: "party", quick: "hi" })).ok,
  ).toBe(true);
  expect(
    (await request(sa, "chat-send", { channel: "party", text: "hi" })).ok,
  ).toBe(true);
});

it("friends message each other; strangers can't; kept messages come back with unread counts", async () => {
  const f = await setup();
  // A store standing in for the database (migration 20261115230000).
  const kept: {
    id: number;
    from: string;
    to: string;
    at: number;
    text: string | null;
    quick: string | null;
  }[] = [];
  const read = new Map<string, number>();
  f.accounts.provider.friendMessages = {
    async save(from, to, body) {
      kept.push({
        id: kept.length + 1,
        from,
        to,
        at: Date.now(),
        text: body.text ?? null,
        quick: body.quick ?? null,
      });
      return kept.length;
    },
    async history(me, friend) {
      return kept.filter(
        (m) => [m.from, m.to].sort().join() === [me, friend].sort().join(),
      );
    },
    async unread(me) {
      const out: Record<string, number> = {};
      for (const m of kept)
        if (m.to === me && m.id > (read.get(`${me}:${m.from}`) ?? 0))
          out[m.from] = (out[m.from] ?? 0) + 1;
      return out;
    },
    async read(me, friend) {
      read.set(`${me}:${friend}`, kept.length);
    },
  };
  await settle();
  expect(
    await request(f.a.s, "chat-send", {
      channel: "friend",
      to: f.pal.account.id,
      text: "hey pal",
    }),
  ).toEqual({ ok: true, kept: true });
  await settle();
  // Both see it, with the stored id (negated) and who it went to.
  for (const who of [f.a, f.b])
    expect(who.heard.map((l) => [l.channel, l.id, l.to, l.text])).toEqual([
      ["friend", -1, f.pal.account.id, "hey pal"],
    ]);
  // A stranger is no one's friend here.
  expect(
    (
      await request(f.x.s, "chat-send", {
        channel: "friend",
        to: f.lead.account.id,
        text: "hi",
      })
    ).ok,
  ).toBe(false);
  expect(
    (
      await request(f.a.s, "chat-send", {
        channel: "friend",
        to: f.stranger.account.id,
        text: "hi",
      })
    ).ok,
  ).toBe(false);
  // Read back from the store, and counted unread until read.
  const back = await request(f.b.s, "chat-history", {
    channel: "friend",
    to: f.lead.account.id,
  });
  expect(back.lines?.map((l) => [l.id, l.from.id, l.text])).toEqual([
    [-1, f.lead.account.id, "hey pal"],
  ]);
  expect(await request(f.b.s, "chat-unread")).toEqual({
    ok: true,
    unread: { [f.lead.account.id]: 1 },
  });
  // The Friends tab: each friend, online or not, with their unread count.
  expect(await request(f.b.s, "chat-friends")).toMatchObject({
    ok: true,
    friends: [{ id: f.lead.account.id, online: true, unread: 1 }],
  });
  f.b.s.emit("chat-read", { to: f.lead.account.id });
  await settle();
  expect(await request(f.b.s, "chat-unread")).toEqual({ ok: true, unread: {} });
  expect(
    (
      (await request(f.b.s, "chat-friends")) as {
        friends: { unread: number }[];
      }
    ).friends[0].unread,
  ).toBe(0);
});

it("before the friends' messages migration runs, friends still message live", async () => {
  const f = await setup();
  await settle();
  expect(
    await request(f.b.s, "chat-send", {
      channel: "friend",
      to: f.lead.account.id,
      quick: "wave",
    }),
  ).toEqual({ ok: true, kept: false });
  await settle();
  expect(f.a.heard.map((l) => [l.channel, l.quick, l.to])).toEqual([
    ["friend", "wave", f.lead.account.id],
  ]);
  expect(f.a.heard[0].id).toBeGreaterThan(0);
  const back = await request(f.a.s, "chat-history", {
    channel: "friend",
    to: f.pal.account.id,
  });
  expect(back.lines?.map((l) => l.quick)).toEqual(["wave"]);
});
