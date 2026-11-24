import { describe, expect, it } from "vitest";
import {
  ChatHub,
  type ChatMember,
  type ChatRoute,
} from "../../apps/server/src/chat";
import { CHAT_LIMITS } from "../../packages/shared/src/chat";

// The server's chat rules (apps/server/src/chat.ts), without sockets.
const member = (id: string, extra: Partial<ChatMember> = {}): ChatMember => ({
  accountId: id,
  name: id.toUpperCase(),
  guest: false,
  mode: "free",
  ...extra,
});
function hub(freeText = true) {
  let now = 1_000_000;
  const chat = new ChatHub({ now: () => now, freeText: () => freeText });
  return { chat, tick: (ms: number) => (now += ms) };
}
const party = (...members: ChatMember[]): ChatRoute => ({
  channel: "party",
  key: "party:ABC",
  inBattle: false,
  members,
});
const battle = (...members: ChatMember[]): ChatRoute => ({
  channel: "room",
  key: "room:XYZ",
  inBattle: true,
  members,
});

describe("typed lines", () => {
  it("reach everyone in the channel, filtered, and are kept", () => {
    const { chat } = hub();
    const sent = chat.send("ana", party(member("ana"), member("bo")), {
      text: "  gg  shit happens ",
    });
    expect(sent).toMatchObject({
      ok: true,
      deliver: ["ana", "bo"],
      line: {
        channel: "party",
        from: { id: "ana", name: "ANA" },
        text: "gg **** happens",
      },
    });
    expect(chat.history("party:ABC", "bo").map((l) => l.text)).toEqual([
      "gg **** happens",
    ]);
  });
  it("are refused outside the channel, for guests, and while paused", () => {
    expect(
      hub().chat.send("zed", party(member("ana")), { text: "hi" }),
    ).toEqual({ ok: false, error: "You're not in this chat." });
    expect(
      hub().chat.send("ana", party(member("ana", { guest: true })), {
        text: "hi",
      }),
    ).toEqual({ ok: false, error: "Make an account to type in chat." });
    expect(
      hub(false).chat.send("ana", party(member("ana")), { text: "hi" }),
    ).toEqual({
      ok: false,
      error: "Typing in chat is paused. Use quick chat.",
    });
  });
  it("refuse links and are off in a battle", () => {
    const { chat } = hub();
    expect(
      chat.send("ana", party(member("ana")), { text: "see site.com" }),
    ).toMatchObject({ ok: false, error: "Links can't be sent in chat." });
    expect(chat.send("ana", battle(member("ana")), { text: "hi" })).toEqual({
      ok: false,
      error: "Use quick chat in a battle.",
    });
  });
  it("can't flood: a gap, a burst limit and no repeats", () => {
    const { chat, tick } = hub();
    const route = party(member("ana"));
    const say = (text: string) => chat.send("ana", route, { text });
    expect(say("one").ok).toBe(true);
    expect(say("two")).toEqual({
      ok: false,
      error: "You're sending messages too fast.",
    });
    tick(CHAT_LIMITS.typedGapMs);
    expect(say("ONE")).toEqual({ ok: false, error: "You just said that." });
    for (let i = 2; i <= CHAT_LIMITS.typedBurst; i++) {
      expect(say(`line ${i}`).ok, `line ${i}`).toBe(true);
      tick(CHAT_LIMITS.typedGapMs);
    }
    // Six in ten seconds: the seventh waits for the oldest to age out.
    expect(say("seven").ok).toBe(false);
    tick(CHAT_LIMITS.burstMs);
    expect(say("seven").ok).toBe(true);
  });
  it("keep the last lines of a channel only", () => {
    const { chat, tick } = hub();
    const route = party(member("ana"));
    for (let i = 0; i < CHAT_LIMITS.history + 5; i++) {
      chat.send("ana", route, { text: `n${i}` });
      tick(CHAT_LIMITS.burstMs);
    }
    const kept = chat.history("party:ABC", "ana");
    expect(kept).toHaveLength(CHAT_LIMITS.history);
    expect(kept[0].text).toBe("n5");
    chat.drop("party:ABC");
    expect(chat.history("party:ABC", "ana")).toEqual([]);
  });
});

describe("blocking", () => {
  it("delivers nothing between two players either way, and hides history", () => {
    const { chat, tick } = hub();
    const route = party(member("ana"), member("bo"), member("cy"));
    chat.send("bo", route, { text: "before" });
    chat.setBlocks("ana", ["bo"]);
    tick(5000);
    expect(chat.send("bo", route, { text: "hello" })).toMatchObject({
      deliver: ["bo", "cy"],
    });
    tick(5000);
    expect(chat.send("ana", route, { text: "hey" })).toMatchObject({
      deliver: ["ana", "cy"],
    });
    expect(chat.history("party:ABC", "ana").map((l) => l.text)).toEqual([
      "hey",
    ]);
    expect(chat.history("party:ABC", "bo").map((l) => l.text)).toEqual([
      "before",
      "hello",
    ]);
    // Unblocked: they hear each other again.
    chat.setBlocks("ana", []);
    tick(5000);
    expect(chat.send("bo", route, { text: "back" })).toMatchObject({
      deliver: ["ana", "bo", "cy"],
    });
  });
  it("skips players whose chat is off", () => {
    const { chat } = hub();
    expect(
      chat.send("ana", party(member("ana"), member("bo", { mode: "off" })), {
        text: "hi",
      }),
    ).toMatchObject({ deliver: ["ana"] });
  });
});

describe("quick chat", () => {
  it("works for guests and checks the id", () => {
    const { chat } = hub(false);
    const route = party(member("ana", { guest: true }), member("bo"));
    expect(chat.send("ana", route, { quick: "gg" })).toMatchObject({
      ok: true,
      line: { quick: "gg" },
      deliver: ["ana", "bo"],
    });
    expect(chat.send("ana", route, { quick: "hacked" })).toEqual({
      ok: false,
      error: "Unknown quick chat.",
    });
  });
  it("one a second", () => {
    const { chat, tick } = hub();
    const route = party(member("ana"));
    expect(chat.send("ana", route, { quick: "wave" }).ok).toBe(true);
    expect(chat.send("ana", route, { quick: "wave" })).toEqual({
      ok: false,
      error: "Wait a moment.",
    });
    tick(CHAT_LIMITS.quickGapMs);
    expect(chat.send("ana", route, { quick: "wave" }).ok).toBe(true);
  });
  it("in a battle: teammates hear calls and phrases, opponents only emotes, nothing kept", () => {
    const { chat, tick } = hub();
    const route = battle(
      member("ana", { team: 0 }),
      member("bo", { team: 0 }),
      member("cy", { team: 1 }),
    );
    expect(chat.send("ana", route, { quick: "attack" })).toMatchObject({
      deliver: ["ana", "bo"],
    });
    tick(1000);
    expect(chat.send("ana", route, { quick: "gg" })).toMatchObject({
      deliver: ["ana", "bo"],
    });
    tick(1000);
    expect(chat.send("ana", route, { quick: "fire" })).toMatchObject({
      deliver: ["ana", "bo", "cy"],
    });
    expect(chat.history("room:XYZ", "ana")).toEqual([]);
  });
  it("keeps calls for battles", () => {
    expect(
      hub().chat.send("ana", party(member("ana")), { quick: "attack" }),
    ).toEqual({ ok: false, error: "Calls are for battles." });
  });
});

describe("watchers (docs/chat-plan.md, Watchers)", () => {
  const room = () =>
    battle(
      member("ana", { team: 0 }),
      member("bo", { team: 1 }),
      member("wes", { watcher: true }),
      member("vi", { watcher: true }),
    );
  it("in a battle: a watcher's emotes and phrases reach everyone, marked", () => {
    const { chat, tick } = hub();
    expect(chat.send("wes", room(), { quick: "nice" })).toMatchObject({
      ok: true,
      line: { quick: "nice", watcher: true },
      deliver: ["ana", "bo", "wes", "vi"],
    });
    tick(1000);
    expect(chat.send("wes", room(), { quick: "clap" })).toMatchObject({
      deliver: ["ana", "bo", "wes", "vi"],
    });
  });
  it("a watcher has no calls: they take no side", () => {
    expect(hub().chat.send("wes", room(), { quick: "attack" })).toEqual({
      ok: false,
      error: "Calls are for the players.",
    });
  });
  it("hears the players' emotes only, never a side's calls or phrases", () => {
    const { chat, tick } = hub();
    expect(chat.send("ana", room(), { quick: "attack" })).toMatchObject({
      deliver: ["ana"],
    });
    tick(1000);
    expect(chat.send("ana", room(), { quick: "gg" })).toMatchObject({
      deliver: ["ana"],
    });
    tick(1000);
    expect(chat.send("ana", room(), { quick: "fire" })).toMatchObject({
      deliver: ["ana", "bo", "wes", "vi"],
    });
  });
  it("a player's line is never marked as a watcher's", () => {
    const sent = hub().chat.send("ana", room(), { quick: "fire" });
    expect(sent.ok && sent.line.watcher).toBeFalsy();
  });
  it("outside a battle a watcher types like anyone, and blocks still hold", () => {
    const { chat } = hub();
    const lobby = { ...room(), inBattle: false };
    chat.setBlocks("ana", ["wes"]);
    expect(chat.send("wes", lobby, { text: "good luck!" })).toMatchObject({
      ok: true,
      deliver: ["bo", "wes", "vi"],
    });
  });
});
