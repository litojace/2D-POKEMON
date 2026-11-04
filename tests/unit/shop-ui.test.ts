import { describe, expect, it } from "vitest";
import { SHOP_BUNDLES, shopPrice, type Economy } from "../../packages/shared/src/shop";
import { picksCountdown } from "../../apps/client/src/shop-ui";
import { SHOP_SECTIONS, fitView, fittingRoomMarkup } from "../../apps/client/src/screens/fitting-room-view";

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

// The Shop's screen itself is tested in fitting-room.test.ts (UI remodel
// step 2); the Missions sheet in missions.test.ts (step 4).
describe("daily countdown", () => {
  it("counts down to the next Pacific midnight", () => {
    // 21:30 PDT on Oct 17 is 04:30 UTC on Oct 18: 2 h 30 min to go.
    expect(picksCountdown(Date.parse("2026-10-18T04:30:00Z"))).toBe("2 h 30 min");
    expect(picksCountdown(Date.parse("2026-10-18T06:55:00Z"))).toBe("5 min");
  });
  it("keeps missions out of the Shop", () => {
    expect(SHOP_SECTIONS.map(([id]) => id)).not.toContain("missions");
    expect(fittingRoomMarkup(fitView("shop", "voltkit"), { economy: economy(), progress: null, look: {} })).not.toContain("missions-");
  });
});
