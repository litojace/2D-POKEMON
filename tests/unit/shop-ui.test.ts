import { describe, expect, it } from "vitest";
import { SHOP_BUNDLES, shopPrice, type Economy } from "../../packages/shared/src/shop";
import { SHOP_TABS, itemAction, picksCountdown, shopMarkup } from "../../apps/client/src/shop-ui";
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
  const cards = (html: string) => [...html.matchAll(/data-shop-preview="([^"]+)"/g)].map((m) => m[1]);
  it("combines ownership and rarity filters without hiding the equipped state", () => {
    const e = economy({ owned: ["voltkit-midnight", "voltkit-snowcap"], looks: { voltkit: { skin: "voltkit-midnight", stage: 1 } } });
    const view = { tab: "champions", champion: "voltkit", ownership: "owned" } as const;
    expect(cards(shopMarkup(view, e))).toEqual(["voltkit-midnight", "voltkit-snowcap"]);
    expect(cards(shopMarkup({ ...view, rarity: "rare" }, e))).toEqual(["voltkit-snowcap"]);
    expect(cards(shopMarkup({ ...view, ownership: "unowned" }, e))).not.toContain("voltkit-midnight");
    const empty = shopMarkup({ ...view, rarity: "mythical" }, e);
    expect(cards(empty)).toHaveLength(0);
    expect(empty).toContain("data-shop-reset");
    expect(shopMarkup(view, e)).toContain('class="shop-owned-badge"');
  });
  it("filters Mythic Hall ownership independently of champion rarity", () => {
    expect(cards(shopMarkup({ tab: "mythic", champion: "voltkit", ownership: "owned", rarity: "common" }, economy({ owned: ["lumoth-starweaver"] })))).toEqual(["lumoth-starweaver"]);
  });
  it("shows just the selected collection and counts already owned pieces", () => {
    const html = shopMarkup({ tab: "collections", champion: "voltkit", collection: "galaxy" }, economy({ owned: ["galaxy-aura", "galaxy-frame"] }));
    expect(cards(html)).toEqual(SHOP_BUNDLES.find((b) => b.collection === "galaxy")!.items);
    expect(html).toContain("2/5 owned");
    expect(html).toContain('data-preview-item="galaxy-colours"');
    expect(html).toContain('data-shop-buy="galaxy-set"');
  });
  it("offers the right preview action and explains affordability without bypassing Mythic Trials", () => {
    const view = { tab: "champions", champion: "voltkit", preview: "voltkit-snowcap" } as const;
    const preview = (html: string) => html.split('class="shop-body"')[0];
    const short = preview(shopMarkup(view, economy({ balance: 100 })));
    expect(short).toContain("1,100 more coins needed");
    expect(short).toContain("data-shop-missions");
    expect(short).toContain('data-shop-buy="voltkit-snowcap"');
    expect(preview(shopMarkup(view, economy({ owned: ["voltkit-snowcap"] })))).toContain('data-shop-equip="voltkit-snowcap"');
    expect(preview(shopMarkup({ ...view, preview: "galaxy-aura" }, economy({ owned: ["galaxy-aura"] }), { aura: "galaxy-aura" }))).toContain('data-shop-unequip="galaxy-aura"');
    const locked = preview(shopMarkup({ ...view, preview: "lumoth-starweaver" }, economy({ balance: 0 })));
    expect(locked).toContain("Mythic Trial 4/30");
    expect(locked).not.toContain("data-shop-missions");
  });
  it("allows original comparisons for skins and colours, but not frames or effects", () => {
    for (const preview of ["voltkit-snowcap", "candy-colours"])
      expect(shopMarkup({ tab: "today", champion: "voltkit", preview }, economy())).toContain("data-preview-compare");
    for (const preview of ["galaxy-aura", "galaxy-frame", "garden-entrance", "festival-victory"])
      expect(shopMarkup({ tab: "today", champion: "voltkit", preview }, economy())).not.toContain("data-preview-compare");
  });
  it("renders every tab cleanly", () => {
    for (const [tab] of SHOP_TABS)
      for (const e of [economy(), null]) {
        const html = shopMarkup({ tab, champion: "terradon" }, e);
        expect(html, tab).not.toMatch(/undefined|NaN|\[object/);
        expect(html, tab).not.toMatch(/data-preview-facing|shop-faces|from every side/);
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
    expect(SHOP_TABS.map(([id]) => id)).not.toContain("missions");
    expect(shopMarkup({ tab: "today", champion: "voltkit" }, economy())).not.toContain("mission-list");
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
