import { describe, expect, it } from "vitest";
import {
  CHAT_NO_CONTACT,
  CHAT_NO_LINKS,
  filterChat,
} from "../../packages/shared/src/chat-filter";
import { CHAT_LIMITS } from "../../packages/shared/src/chat";
import { NAME_PART_WORDS } from "../../packages/shared/src/name-filter";

// The chat filter (packages/shared/src/chat-filter.ts): what the server lets
// through, masks or refuses.
const text = (s: string) => {
  const r = filterChat(s);
  if (!r.ok) throw new Error(`refused: ${s} (${r.error})`);
  return r;
};
const error = (s: string) => {
  const r = filterChat(s);
  return r.ok ? null : r.error;
};

describe("ordinary lines pass unchanged", () => {
  it.each([
    "gg wp",
    "Nice combo! One more?",
    "I'm at home. Me too",
    "meet me @ home. lol",
    "I did 100 200 300 damage",
    "I have 2,340 coins and 1,234 leaves",
    "that class was a classic",
    "the therapist met Nazir by the peacock",
    "Scoring 4500 points in round 3",
    "kkkkk",
    "Xin chào, chơi tiếp không?",
    "🔥🔥 let's go 👏",
  ])("%s", (s) => {
    expect(text(s)).toEqual({ ok: true, text: s, filtered: false });
  });
});

describe("rude words are masked, the rest kept", () => {
  it.each([
    ["you are shit", "you are ****"],
    ["what the fuck man", "what the **** man"],
    ["F.U.C.K this", "******* this"],
    ["f u c k you", "* * * * you"],
    ["sh1t happens", "**** happens"],
    ["5H!T", "****"],
    ["fück off", "**** off"],
    ["a s s", "* * *"],
    ["big ass", "big ***"],
    ["kkk rally", "*** rally"],
  ])("%s", (s, want) => {
    expect(text(s)).toEqual({ ok: true, text: want, filtered: true });
  });
  it("masks every word on the name filter's part list (but kkk)", () => {
    for (const w of NAME_PART_WORDS.filter(
      (w) => !["kkk", "elementarena"].includes(w),
    ))
      expect(text(`hey ${w} there`).filtered, w).toBe(true);
  });
  it("leaves the name-only words alone in a sentence", () => {
    expect(text("ask an admin or the staff").filtered).toBe(false);
  });
});

describe("links and contact details are refused", () => {
  it.each([
    "go to https://example.com",
    "www.cheats",
    "free gems at freegems.gg",
    "site (dot) com",
    "join discord.gg/abc",
    "discord / abcdef",
  ])("link: %s", (s) => expect(error(s)).toBe(CHAT_NO_LINKS));
  it.each([
    "mail me: kid@example.com",
    "kid (at) example (dot) com",
    "call 5551234",
    "call 555-1234",
    "(028) 3822.1234",
    "0912 345 678",
    "+84 912 345 678",
  ])("contact: %s", (s) => expect(error(s)).toBe(CHAT_NO_CONTACT));
});

describe("cleaning", () => {
  it("removes invisible and direction characters and squeezes spaces", () => {
    expect(text("  hi​  there‮ \n friend ").text).toBe("hi there friend");
  });
  it("can't hide a word with zero-width characters", () => {
    expect(text("fu​ck").text).toBe("****");
  });
  it("refuses empty lines and non-text", () => {
    expect(error("   ")).toBe("Type a message.");
    expect(error("​")).toBe("Type a message.");
    expect(error(42)).toBe("Type a message.");
    expect(error(undefined)).toBe("Type a message.");
  });
  it(`cuts a line to ${CHAT_LIMITS.length} characters, emoji counted once`, () => {
    expect([...text("a".repeat(500)).text]).toHaveLength(CHAT_LIMITS.length);
    expect([...text("😂".repeat(200)).text]).toHaveLength(CHAT_LIMITS.length);
  });
});
