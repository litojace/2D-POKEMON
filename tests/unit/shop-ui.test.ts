import { describe, expect, it } from "vitest";
import { SHOP_BUNDLES, shopPrice, type Economy } from "../../packages/shared/src/shop";
import { picksCountdown } from "../../apps/client/src/shop-ui";
import { SHOP_SECTIONS, fitView, fittingRoomMarkup } from "../../apps/client/src/screens/fitting-room-view";
import { missionsBlock, missionsMarkup } from "../../apps/client/src/missions-ui";

const economy = (extra: Partial<Economy> = {}): Economy => ({
  balance: 2000,
  owned: [],
  picks: { day: "2026-10-17", items: ["voltkit-snowcap", "galaxy-aura", "lumoth-starweaver", "mystowl-scholar"], deal: "voltkit-snowcap" },
  trialWins: { voltkit: 30, lumoth: 4 },
  awakening: {},
  looks: {},
  missions: [
    { day: "2026-10-17", slot: 0, id: "play-2", text: "Play 2 matches", tier: "easy", progress: 2, target: 2, coins: 40, done: true },
    { day: "2026-10-17", slot: 1, id: "pvp-wins-2", text: "Win 2 <b>matches</b>", tier: "medium", progress: 1, target: 2, coins: 70, done: false },
    { day: "2026-10-17", slot: 2, id: "raid-p3", text: "Clear any raid on Peril 3", tier: "hard", progress: 0, target: 1, coins: 120, done: false },
  ],
  rerolled: false,
  streak: 2,
  today: { raidClears: 1, pvpMatches: 3 },
  ...extra,
});

describe("shop prices (mirrors arena_item_price)", () => {
  it("charges full price, takes 20% off today's deal, and nothing once owned", () => {
    expect(shopPrice("voltkit-midnight", [], null)).toBe(500);
    expect(shopPrice("voltkit-snowcap", [], "voltkit-snowcap")).toBe(1200);
    expect(shopPrice("voltkit-midnight", ["voltkit-midnight"], null)).toBeNull();
    expect(shopPrice("nope", [], null)).toBeNull();
  });
  it("prices a set at 80% of the pieces you don't own (the database test expects 3,120)", () => {
    expect(shopPrice("candy-set", ["candy-aura"], null)).toBe(3120);
    const all = SHOP_BUNDLES.find((b) => b.id === "candy-set")!.items;
    expect(shopPrice("candy-set", all, null)).toBeNull();
  });
});

// The Shop's screen itself is tested in fitting-room.test.ts (UI remodel step 2).
describe("daily countdown and missions", () => {
  it("counts down to the next Pacific midnight", () => {
    // 21:30 PDT on Oct 17 is 04:30 UTC on Oct 18: 2 h 30 min to go.
    expect(picksCountdown(Date.parse("2026-10-18T04:30:00Z"))).toBe("2 h 30 min");
    expect(picksCountdown(Date.parse("2026-10-18T06:55:00Z"))).toBe("5 min");
  });
  it("escapes mission text and offers one re-roll for unfinished missions", () => {
    const html = missionsBlock(economy());
    expect(html).toContain("Win 2 &lt;b&gt;matches&lt;/b&gt;");
    expect(html.match(/data-mission-reroll/g)).toHaveLength(2);
    expect(missionsBlock(economy({ rerolled: true }))).not.toContain("data-mission-reroll");
  });
  it("gives every mission an accessible popup without expanding card content", () => {
    const html = missionsBlock(economy());
    expect(html.match(/<dialog class="mission-instructions"/g)).toHaveLength(3);
    expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(3);
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(3);
    for (const slot of [0, 1, 2]) {
      expect(html).toContain(`aria-controls="mission-guide-${slot}"`);
      expect(html).toContain(`id="mission-guide-${slot}"`);
    }
    expect(html).toContain("How to complete: Win 2 &lt;b&gt;matches&lt;/b&gt;");
    expect(html).toContain("Solo test mode and attack practice do not count");
    expect(html).not.toContain("<details");
    expect(missionsBlock(economy(), true)).not.toContain("mission-guide");
  });
  it("gives missions their own screen, out of the Shop", () => {
    expect(SHOP_SECTIONS.map(([id]) => id)).not.toContain("missions");
    expect(fittingRoomMarkup(fitView("shop", "voltkit"), { economy: economy(), progress: null, look: {} })).not.toContain("mission-list");
    const html = missionsMarkup(economy());
    expect(html).toContain("mission-list");
    expect(html).toContain("New missions in");
    expect(html).not.toMatch(/undefined|NaN|\[object/);
    expect(missionsMarkup(null)).toContain("Log in");
  });
  it("marks missions that need other people and offers a solo swap", () => {
    const html = missionsBlock(economy());
    // Slot 1 is "Win 2 matches against players" in the test economy.
    expect(html).toContain("With others");
    expect(html).toContain("Swap for a solo mission");
  });
  it("lights the streak track up to today", () => {
    const track = (e: ReturnType<typeof economy>) => (missionsMarkup(e).match(/class="is-lit/g) ?? []).length;
    // Two days so far, today not finished: two lit.
    expect(track(economy({ streak: 2 }))).toBe(2);
    // A full week paid yesterday: today starts again.
    expect(track(economy({ streak: 7 }))).toBe(0);
    const allDone = economy().missions.map((m) => ({ ...m, done: true, progress: m.target }));
    expect(track(economy({ streak: 7, missions: allDone }))).toBe(7);
  });
});
