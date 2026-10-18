import { describe, expect, it } from "vitest";
import { SHOP_BUNDLES, shopPrice, type Economy } from "../../packages/shared/src/shop";
import { SHOP_TABS, itemAction, missionsBlock, picksCountdown, shopMarkup } from "../../apps/client/src/shop-ui";

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

describe("shop buttons", () => {
  it("locks Mythicals behind the Mythic Trial and greys out what you can't afford", () => {
    expect(itemAction("lumoth-starweaver", economy())).toContain("Mythic Trial 4/30");
    expect(itemAction("voltkit-stormcrown", economy({ balance: 9000 }))).toContain('data-shop-buy="voltkit-stormcrown"');
    expect(itemAction("voltkit-stormcrown", economy())).toMatch(/data-shop-buy="voltkit-stormcrown"[^>]*disabled/);
  });
  it("offers Equip for owned items and shows what's worn", () => {
    const e = economy({ owned: ["voltkit-midnight", "candy-aura"], looks: { voltkit: { skin: "voltkit-midnight", stage: 1 } } });
    expect(itemAction("voltkit-midnight", e)).toContain("data-shop-unequip");
    expect(itemAction("candy-aura", e)).toContain("data-shop-equip");
    expect(itemAction("candy-aura", e, { aura: "candy-aura" })).toContain("data-shop-unequip");
  });
});

describe("shop page", () => {
  it("renders every tab cleanly", () => {
    for (const [tab] of SHOP_TABS)
      for (const e of [economy(), null]) {
        const html = shopMarkup({ tab, champion: "terradon" }, e);
        expect(html, tab).not.toMatch(/undefined|NaN|\[object/);
      }
  });
  it("leads Today with the deal as a wide card, showing the full price struck through", () => {
    // The deal is listed last in the picks but shown first.
    const e = economy({ picks: { day: "2026-10-17", items: ["galaxy-aura", "mystowl-scholar", "voltkit-snowcap"], deal: "voltkit-snowcap" } });
    const html = shopMarkup({ tab: "today", champion: "voltkit" }, e);
    const first = html.indexOf('class="shop-card'), hero = html.indexOf("is-hero");
    expect(hero).toBeGreaterThan(-1);
    expect(html.slice(first, hero)).not.toContain("<article");
    expect(html.match(/is-hero/g)).toHaveLength(1);
    expect(itemAction("voltkit-snowcap", e)).toMatch(/<s class="shop-was">.*1,500<\/s>.*1,200/);
    // Once bought, there's no hero (nothing left to discount).
    expect(shopMarkup({ tab: "today", champion: "voltkit" }, economy({ ...e, owned: ["voltkit-snowcap"] }))).not.toContain("is-hero");
  });
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
});
