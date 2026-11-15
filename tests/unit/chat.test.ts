import { describe, expect, it } from "vitest";
import {
  CHAT_CALLS,
  CHAT_EMOTES,
  CHAT_PHRASES,
  quickKind,
  quickRefusal,
  quickSeenInBattle,
  quickText,
  typingRefusal,
  type ChatContext,
} from "../../packages/shared/src/chat";
import { PLAZA_EMOTES } from "../../packages/shared/src/plaza";
import { FARM_EMOTES } from "../../packages/shared/src/farm";

// The quick-chat catalogue and who may say what (packages/shared/src/chat.ts).
const at = (c: Partial<ChatContext>): ChatContext => ({
  channel: "party",
  inBattle: false,
  guest: false,
  mode: "free",
  ...c,
});

describe("the catalogue", () => {
  it("has no id twice across emotes, phrases and calls", () => {
    const ids = [
      ...Object.keys(CHAT_EMOTES),
      ...Object.keys(CHAT_PHRASES),
      ...Object.keys(CHAT_CALLS),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("keeps every Plaza and Farm emote (GG as a phrase)", () => {
    const emoji = Object.values(CHAT_EMOTES) as string[];
    for (const e of [...PLAZA_EMOTES, ...Object.values(FARM_EMOTES)])
      if (e === "GG") expect(quickText("gg")).toBe("GG");
      else expect(emoji, e).toContain(e);
  });
  it("knows its ids and nothing else", () => {
    expect(quickKind("wave")).toBe("emote");
    expect(quickKind("gg")).toBe("phrase");
    expect(quickKind("attack")).toBe("call");
    for (const bad of ["toString", "__proto__", "constructor", "", 1, null])
      expect(quickKind(bad)).toBeNull();
  });
});

describe("typing", () => {
  it("is for players with an account, in a party or a room, outside a battle", () => {
    expect(typingRefusal(at({}))).toBeNull();
    expect(typingRefusal(at({ channel: "room" }))).toBeNull();
  });
  it.each([
    [{ guest: true }, "Make an account to type in chat."],
    [{ mode: "quick" as const }, "Your chat is set to quick chat only."],
    [{ mode: "off" as const }, "Chat is off in your settings."],
    [{ channel: "place" as const }, "Here you can use quick chat."],
    [
      { channel: "room" as const, inBattle: true },
      "Use quick chat in a battle.",
    ],
  ])("refused: %o", (c, why) => expect(typingRefusal(at(c))).toBe(why));
});

describe("quick chat", () => {
  it("is open to guests and on the Plaza", () => {
    expect(quickRefusal(at({ guest: true }), "hi")).toBeNull();
    expect(quickRefusal(at({ channel: "place" }), "wave")).toBeNull();
    expect(quickRefusal(at({ mode: "quick" }), "gg")).toBeNull();
  });
  it("keeps calls for battles, and nothing when chat is off", () => {
    expect(
      quickRefusal(at({ channel: "room", inBattle: true }), "attack"),
    ).toBeNull();
    expect(quickRefusal(at({ channel: "room" }), "attack")).toBe(
      "Calls are for battles.",
    );
    expect(quickRefusal(at({ channel: "place" }), "help")).toBe(
      "Calls are for battles.",
    );
    expect(quickRefusal(at({ mode: "off" }), "wave")).toBe(
      "Chat is off in your settings.",
    );
  });
  it("in a battle: teammates see all, opponents only emotes, unless muted", () => {
    expect(quickSeenInBattle("attack", true, false)).toBe(true);
    expect(quickSeenInBattle("gg", false, false)).toBe(false);
    expect(quickSeenInBattle("attack", false, false)).toBe(false);
    expect(quickSeenInBattle("fire", false, false)).toBe(true);
    expect(quickSeenInBattle("fire", false, true)).toBe(false);
  });
});
