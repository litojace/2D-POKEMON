import { describe, expect, it } from "vitest";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  CHAMPION_SKINS,
  SHOP_BUNDLES,
  type Economy,
} from "../../packages/shared/src/shop";
import type { RaidProgress } from "../../packages/shared/src/raid";
import { isNewArrival, NEW_DAYS } from "../../apps/client/src/shop-arrivals";
import {
  SHOP_SECTIONS,
  dropUnownedTryOns,
  fitView,
  fittingRoomMarkup,
  fittingRoomParts,
  missionCoinsLeft,
  ownedFor,
  pendingChanges,
  purchase,
  sortSkins,
  stageOutfit,
  type FitData,
  type FitView,
} from "../../apps/client/src/screens/fitting-room-view";

// The fitting room (UI remodel step 2): Shop + Wardrobe in one screen. These
// cover what the old shop-ui and wardrobe-ui tests covered, on the new
// markup, plus the confirmation's numbers and the Wardrobe's pending changes.
const economy = (extra: Partial<Economy> = {}): Economy => ({
  balance: 2000,
  owned: [],
  picks: {
    day: "2026-10-17",
    items: [
      "voltkit-snowcap",
      "galaxy-aura",
      "lumoth-starweaver",
      "mystowl-scholar",
    ],
    deal: "voltkit-snowcap",
  },
  trialWins: { voltkit: 30, lumoth: 4 },
  awakening: {},
  looks: {},
  missions: [
    {
      day: "2026-10-17",
      slot: 0,
      id: "play-2",
      text: "Play 2 matches",
      tier: "easy",
      progress: 2,
      target: 2,
      coins: 40,
      done: true,
    },
    {
      day: "2026-10-17",
      slot: 1,
      id: "pvp-wins-2",
      text: "Win 2 matches",
      tier: "medium",
      progress: 1,
      target: 2,
      coins: 70,
      done: false,
    },
    {
      day: "2026-10-17",
      slot: 2,
      id: "raid-p3",
      text: "Clear a raid",
      tier: "hard",
      progress: 0,
      target: 1,
      coins: 120,
      done: false,
    },
  ],
  rerolled: false,
  streak: 2,
  today: { raidClears: 1, pvpMatches: 3 },
  ...extra,
});
const data = (
  e: Economy | null = economy(),
  extra: Partial<FitData> = {},
): FitData => ({ economy: e, progress: null, look: {}, ...extra });
const shop = (extra: Partial<FitView> = {}) =>
  fitView("shop", "voltkit", extra);
const wardrobe = (extra: Partial<FitView> = {}) =>
  fitView("wardrobe", "voltkit", extra);
/** The item tiles in the catalogue, in order. */
const tiles = (html: string) =>
  [...html.matchAll(/class="ui-tile[^"]*"[^>]*data-ui-item="([^"]+)"/g)].map(
    (m) => m[1],
  );

describe("prices and the purchase confirmation", () => {
  it("shows the server's price rules: today's 20% off, sets at 80% of what you don't own", () => {
    const e = economy();
    expect(purchase("voltkit-snowcap", e)).toMatchObject({
      price: 1200,
      was: 1500,
      balance: 2000,
      after: 800,
      short: 0,
      unlimited: false,
      locked: false,
    });
    // The database test expects 3,120 for a Candy set when the aura is owned.
    const set = purchase("candy-set", economy({ owned: ["candy-aura"] }))!;
    expect(set.price).toBe(3120);
    expect(set.was).toBe(3900);
    // Owned items and complete sets have nothing to buy.
    expect(
      purchase("voltkit-snowcap", economy({ owned: ["voltkit-snowcap"] })),
    ).toBeNull();
    const all = SHOP_BUNDLES.find((b) => b.id === "candy-set")!.items;
    expect(purchase("candy-set", economy({ owned: all }))).toBeNull();
  });
  it("says how many coins are missing, and testers with unlimited coins never are", () => {
    expect(purchase("voltkit-snowcap", economy({ balance: 100 }))!.short).toBe(
      1100,
    );
    const free = purchase(
      "voltkit-snowcap",
      economy({ balance: 0, unlimitedCoins: true }),
    )!;
    expect(free).toMatchObject({ short: 0, unlimited: true, after: 0 });
  });
  it("puts Buy behind the confirmation with the price on the button, disabled when short", () => {
    const view = shop({
      selected: "voltkit-snowcap",
      tryOn: { champion: "voltkit-snowcap" },
    });
    const foot = fittingRoomParts(view, data()).foot;
    expect(foot).toMatch(/data-fit-buy="voltkit-snowcap"/);
    expect(foot).not.toMatch(/data-fit-buy="voltkit-snowcap"[^>]*disabled/);
    expect(foot).toContain("1,200");
    expect(foot).toContain("Try-ons are free");
    const short = fittingRoomParts(view, data(economy({ balance: 100 }))).foot;
    expect(short).toMatch(
      /<button[^>]*disabled[^>]*data-fit-buy="voltkit-snowcap"/,
    );
    expect(short).toContain("You need 1,100 more coins");
    // Earn coins sits beside Buy, the same size (one action group).
    expect(short).toContain("data-fit-missions");
    expect(short.match(/class="ui-actions"/g)).toHaveLength(1);
  });
  it("lets admin testers buy at zero coins, sets included", () => {
    const e = economy({ balance: 0, unlimitedCoins: true });
    const foot = fittingRoomParts(
      shop({ selected: "voltkit-snowcap" }),
      data(e),
    ).foot;
    expect(foot).not.toMatch(
      /data-fit-buy="[^"]+"[^>]*disabled|disabled[^>]*data-fit-buy/,
    );
    expect(foot).toContain("Testing: purchases don't spend coins");
    const set = fittingRoomParts(
      shop({
        section: "collections",
        collection: "candy",
        selected: "candy-set",
      }),
      data(e),
    ).foot;
    expect(set).toContain('data-fit-buy="candy-set"');
    expect(set).not.toContain("disabled");
  });
  it("counts the coins today's unfinished missions still pay", () => {
    expect(missionCoinsLeft(economy())).toBe(190);
    expect(fittingRoomParts(shop(), data()).body).toContain(
      "Missions left today",
    );
  });
});

describe("Mythic Trials and awakening", () => {
  it("locks a Mythical behind its trial, with Play as instead of Buy", () => {
    const view = shop({ selected: "lumoth-starweaver" });
    const parts = fittingRoomParts(view, data(economy({ balance: 0 })));
    expect(parts.body).toContain("Trial 4/30 wins");
    expect(parts.foot).toContain('data-fit-play-as="lumoth"');
    expect(parts.foot).not.toContain("data-fit-buy");
    expect(parts.foot).not.toContain("data-fit-missions");
    expect(purchase("lumoth-starweaver", economy())!.locked).toBe(true);
  });
  it("opens trials and every awakening stage for verified testers", () => {
    const e = economy({
      balance: 0,
      unlimitedCoins: true,
      mythicTesting: true,
      trialWins: {},
    });
    const view = shop({
      section: "mythic",
      selected: "auralynx-celestial-sage",
      tryOn: { champion: "auralynx-celestial-sage" },
      champion: "auralynx",
      stage: 3,
    });
    const parts = fittingRoomParts(view, data(e));
    expect(parts.foot).toContain('data-fit-buy="auralynx-celestial-sage"');
    expect(parts.stage).toContain("All stages unlocked for testing.");
    expect(parts.stage).not.toContain('data-locked="true"');
    expect(parts.body).not.toContain("Trial 0/30");
    // Unlimited coins alone don't skip the trial.
    expect(
      purchase(
        "auralynx-celestial-sage",
        economy({ unlimitedCoins: true, trialWins: {} }),
      )!.locked,
    ).toBe(true);
  });
  it("shows a Mythical at a chosen stage, but saves only a stage you reached", () => {
    const e = economy({
      owned: ["voltkit-stormcrown"],
      looks: { voltkit: { skin: "voltkit-stormcrown", stage: 1 } },
      awakening: {
        "voltkit-stormcrown": { wins: 31, peril3: false, stage: 2 },
      },
    });
    const view = wardrobe({
      tryOn: { champion: "voltkit-stormcrown" },
      stage: 3,
    });
    expect(stageOutfit(view, data(e)).skin).toEqual({
      skin: "voltkit-stormcrown",
      stage: 3,
    });
    const stage = fittingRoomParts(view, data(e)).stage;
    expect(stage).toMatch(
      /data-fit-awaken="3"[^>]*aria-pressed="true"[^>]*data-locked="true"/,
    );
    // Stage III isn't reached: the change saves Stage II.
    expect(pendingChanges(view, data(e))).toEqual([
      {
        slot: "champion",
        from: "voltkit-stormcrown",
        to: "voltkit-stormcrown",
        stage: 2,
      },
    ]);
  });
});

describe("fixes from review", () => {
  const worn = economy({
    owned: ["voltkit-stormcrown"],
    looks: { voltkit: { skin: "voltkit-stormcrown", stage: 3 } },
    awakening: { "voltkit-stormcrown": { wins: 80, peril3: true, stage: 3 } },
  });
  it("saves another reached stage of the worn Mythical on its own", () => {
    // Choosing a stage tries the worn skin on at that stage (fitting-room.ts).
    const view = wardrobe({
      tryOn: { champion: "voltkit-stormcrown" },
      stage: 2,
    });
    expect(pendingChanges(view, data(worn))).toEqual([
      {
        slot: "champion",
        from: "voltkit-stormcrown",
        to: "voltkit-stormcrown",
        stage: 2,
      },
    ]);
    expect(fittingRoomParts(view, data(worn)).foot).toContain("Skin: Stage II");
    // In the Shop the bar offers Equip instead of Take off.
    const shopFoot = fittingRoomParts(
      shop({
        selected: "voltkit-stormcrown",
        tryOn: { champion: "voltkit-stormcrown" },
        stage: 2,
      }),
      data(worn),
    ).foot;
    expect(shopFoot).toContain('data-fit-equip="voltkit-stormcrown"');
    expect(shopFoot).not.toContain("data-fit-unequip");
    // The stage already worn is no change.
    expect(pendingChanges({ ...view, stage: 3 }, data(worn))).toEqual([]);
  });
  it("shows a trial, not a price, if today's deal is a locked Mythical", () => {
    const e = economy({
      picks: {
        day: "2026-10-17",
        items: ["lumoth-starweaver"],
        deal: "lumoth-starweaver",
      },
    });
    const body = fittingRoomParts(shop(), data(e)).body;
    expect(body).toMatch(
      /fit-deal-price"><span class="ui-tile-foot is-trial">Trial 4\/30 wins/,
    );
  });
});

describe("the Shop's catalogue", () => {
  it("leads Today with the deal as a wide card, struck-through price and its own countdown", () => {
    const e = economy({
      picks: {
        day: "2026-10-17",
        items: ["galaxy-aura", "mystowl-scholar", "voltkit-snowcap"],
        deal: "voltkit-snowcap",
      },
    });
    const body = fittingRoomParts(shop(), data(e)).body;
    expect(body.indexOf('class="fit-deal"')).toBeLessThan(
      body.indexOf("Daily picks"),
    );
    expect(body).toMatch(/class="fit-deal"[^>]*data-ui-item="voltkit-snowcap"/);
    expect(body).toMatch(
      /<s><span class="sr-only">was <\/span>1,500<\/s><span>1,200/,
    );
    expect(body).toContain("Ends in");
    expect(body).toContain("New picks in");
    expect(tiles(body)).toEqual(["galaxy-aura", "mystowl-scholar"]);
    // Once bought there is no featured deal.
    expect(
      fittingRoomParts(
        shop(),
        data(economy({ ...e, owned: ["voltkit-snowcap"] })),
      ).body,
    ).not.toContain('class="fit-deal"');
  });
  it("combines ownership and rarity filters on Skins, with a way out when nothing matches", () => {
    const e = economy({
      owned: ["voltkit-midnight", "voltkit-snowcap"],
      looks: { voltkit: { skin: "voltkit-midnight", stage: 1 } },
    });
    const view = shop({ section: "skins", ownership: "owned" });
    // Rarest first: the Rare skin leads the Common one.
    expect(tiles(fittingRoomParts(view, data(e)).body)).toEqual([
      "voltkit-snowcap",
      "voltkit-midnight",
    ]);
    expect(
      tiles(fittingRoomParts({ ...view, rarity: "rare" }, data(e)).body),
    ).toEqual(["voltkit-snowcap"]);
    expect(
      tiles(fittingRoomParts({ ...view, ownership: "unowned" }, data(e)).body),
    ).not.toContain("voltkit-midnight");
    const none = fittingRoomParts(
      { ...view, rarity: "mythical" },
      data(e),
    ).body;
    expect(tiles(none)).toHaveLength(0);
    expect(none).toContain("data-fit-reset");
    // What you wear says Equipped; what you own says Owned.
    expect(fittingRoomParts(view, data(e)).body).toMatch(
      /data-ui-item="voltkit-midnight"[\s\S]*?Equipped/,
    );
  });
  it("filters the Mythic Hall by ownership", () => {
    const e = economy({ owned: ["lumoth-starweaver"] });
    expect(
      tiles(
        fittingRoomParts(
          shop({ section: "mythic", ownership: "owned" }),
          data(e),
        ).body,
      ),
    ).toEqual(["lumoth-starweaver"]);
    expect(
      tiles(fittingRoomParts(shop({ section: "mythic" }), data(e)).body),
    ).toHaveLength(
      CHAMPION_SKINS.filter((s) => s.rarity === "mythical").length,
    );
  });
  it("shows one collection, its set and how much of it you own", () => {
    const e = economy({ owned: ["galaxy-aura", "galaxy-frame"] });
    const body = fittingRoomParts(
      shop({ section: "collections", collection: "galaxy" }),
      data(e),
    ).body;
    expect(tiles(body)).toEqual(
      SHOP_BUNDLES.find((b) => b.collection === "galaxy")!.items,
    );
    expect(body).toMatch(
      /data-fit-collection="galaxy"[^>]*aria-pressed="true">Galaxy<span class="ui-tag">2\/5/,
    );
    expect(body).toContain('data-ui-item="galaxy-set"');
  });
  it("offers Equip for owned items and Take off for what is worn", () => {
    const e = economy({
      owned: ["voltkit-midnight", "candy-aura"],
      looks: { voltkit: { skin: "voltkit-midnight", stage: 1 } },
    });
    expect(
      fittingRoomParts(shop({ selected: "voltkit-midnight" }), data(e)).foot,
    ).toContain('data-fit-unequip="voltkit-midnight"');
    expect(
      fittingRoomParts(shop({ selected: "candy-aura" }), data(e)).foot,
    ).toContain('data-fit-equip="candy-aura"');
    expect(
      fittingRoomParts(
        shop({ selected: "candy-aura" }),
        data(e, { look: { aura: "candy-aura" } }),
      ).foot,
    ).toContain('data-fit-unequip="candy-aura"');
  });
  it("renders every section and the Wardrobe cleanly, signed out or still loading too", () => {
    const states: FitData[] = [
      data(),
      data(null),
      data(null, { loading: true }),
      data(economy({ unlimitedCoins: true, mythicTesting: true, balance: 0 })),
      data(economy(), { low: true }),
    ];
    for (const d of states) {
      for (const [section] of SHOP_SECTIONS) {
        const html = fittingRoomMarkup(
          shop({ section, champion: "terradon" }),
          d,
        );
        expect(html, section).not.toMatch(/undefined|NaN|\[object/);
      }
      for (const slot of [
        "champion",
        "skin",
        "aura",
        "entrance",
        "victory",
        "frame",
      ] as const)
        expect(fittingRoomMarkup(wardrobe({ slot }), d), slot).not.toMatch(
          /undefined|NaN|\[object/,
        );
    }
    expect(fittingRoomMarkup(shop(), data(null))).toContain("data-fit-retry");
  });
});

describe("the stage", () => {
  it("offers Hold to compare for skins and Colors, not for frames or effects", () => {
    for (const [slot, id] of [
      ["champion", "voltkit-snowcap"],
      ["skin", "candy-colours"],
    ] as const)
      expect(
        fittingRoomParts(shop({ selected: id, tryOn: { [slot]: id } }), data())
          .stage,
      ).toContain('data-preview-compare="hold"');
    for (const [slot, id] of [
      ["aura", "galaxy-aura"],
      ["frame", "galaxy-frame"],
      ["entrance", "garden-entrance"],
      ["victory", "festival-victory"],
    ] as const)
      expect(
        fittingRoomParts(shop({ selected: id, tryOn: { [slot]: id } }), data())
          .stage,
      ).not.toContain("data-preview-compare");
  });
  it("tries effects on the worn skin and stage without changing what is equipped", () => {
    const e = economy({
      looks: { tidefin: { skin: "tidefin-moontide", stage: 3 } },
    });
    const look = { skin: "candy-colours", frame: "conqueror" } as const;
    const saved = JSON.stringify({ e, look });
    for (const slot of ["aura", "entrance", "victory"] as const) {
      const view = fitView("shop", "tidefin", {
        section: "collections",
        selected: `galaxy-${slot}`,
        tryOn: { [slot]: `galaxy-${slot}` },
        action: slot === "aura" ? "idle" : slot,
      });
      const stage = fittingRoomParts(view, data(e, { look })).stage;
      expect(stage).toContain('data-preview-skin="tidefin-moontide"');
      expect(stage).toContain('data-preview-stage="3"');
      expect(stage).not.toContain("is-item");
      const sent = JSON.parse(
        decodeURIComponent(stage.match(/data-preview-look="([^"]+)"/)![1]),
      );
      expect(sent).toEqual({ ...look, [slot]: `galaxy-${slot}` });
    }
    expect(JSON.stringify({ e, look })).toBe(saved);
  });
  it("draws no portrait frame badge on the stage (portraits are preset avatars)", () => {
    const d = data(economy(), { look: { frame: "conqueror" } });
    for (const view of [shop(), wardrobe()]) {
      const stage = fittingRoomParts(view, d).stage;
      expect(stage).not.toContain("fit-frame-badge");
      expect(stage).not.toContain("data-fit-slot");
      expect(stage).not.toContain("data-portrait-frame");
      // Entrance and Victory stay on the stage.
      expect(stage).toContain('data-fit-play="entrance"');
    }
    // Frames are picked from the Wardrobe's Frame slot tab.
    expect(fittingRoomParts(wardrobe(), d).body).toContain(
      'data-fit-slot="frame"',
    );
  });
  it("shows a frame large on the portrait it goes around", () => {
    const e = economy({
      looks: { tidefin: { skin: "tidefin-moontide", stage: 3 } },
    });
    const view = fitView("shop", "tidefin", {
      section: "collections",
      collection: "galaxy",
      selected: "galaxy-frame",
      tryOn: { frame: "galaxy-frame" },
    });
    const stage = fittingRoomParts(view, data(e)).stage;
    expect(stage).toContain("is-frame");
    expect(stage).toContain('class="portrait-review-avatar fit-frame-avatar"');
    expect(stage).toContain('data-portrait-frame="galaxy-frame"');
    // Your avatar in the frame, as everyone sees you; not the fighter.
    expect(stage).toContain('class="portrait-avatar"');
    expect(stage).not.toContain('data-fighter="tidefin"');
  });
  it("draws a still fighter on Low graphics, with the original ready for Hold to compare", () => {
    const view = shop({
      selected: "voltkit-snowcap",
      tryOn: { champion: "voltkit-snowcap" },
    });
    const low = fittingRoomParts(view, data(economy(), { low: true })).stage;
    expect(low).toContain("is-still");
    expect(low).toContain('class="shop-preview-fallback fit-original" hidden');
    expect(low).not.toContain("data-fit-play");
    // Low graphics: compare works without the rig, so the button is live.
    expect(low).not.toMatch(/data-preview-compare="hold"[^>]*disabled/);
    const high = fittingRoomParts(view, data()).stage;
    expect(high).not.toContain("fit-original");
    expect(high).toContain('data-fit-play="entrance"');
  });
});

describe("the Wardrobe", () => {
  const progress = {
    cosmetics: ["conqueror"],
    earned: ["conqueror"],
    loadout: {},
    bosses: { grumblecrag: { clears: 16 } },
  } as unknown as RaidProgress;
  it("lists only what you own, plus the original look and a More in the Shop tile", () => {
    const e = economy({
      owned: ["voltkit-midnight", "galaxy-aura", "cindrake-ashen"],
    });
    const body = fittingRoomParts(wardrobe(), data(e)).body;
    expect(tiles(body)).toEqual(["original", "voltkit-midnight"]);
    const more =
      CHAMPION_SKINS.filter((s) => s.champion === "voltkit").length - 1;
    expect(body).toContain(`data-fit-more="champion"`);
    expect(body).toContain(`${more} more Voltkit skins`);
    // Shared looks: a None tile first, then the owned pieces of that slot.
    const aura = fittingRoomParts(wardrobe({ slot: "aura" }), data(e)).body;
    expect(tiles(aura)).toEqual(["none", "galaxy-aura"]);
    // Earned boss frames are yours too.
    expect(ownedFor("frame", "voltkit", e, progress).map((i) => i.id)).toEqual([
      "conqueror",
    ]);
  });
  it("shows six slot tabs with what is worn, and a fighter row instead of a dropdown", () => {
    const e = economy({
      owned: ["voltkit-stormcrown", "candy-colours"],
      looks: { voltkit: { skin: "voltkit-stormcrown", stage: 1 } },
    });
    const body = fittingRoomParts(
      wardrobe(),
      data(e, { look: { skin: "candy-colours" } }),
    ).body;
    expect(body.match(/data-fit-slot="/g)).toHaveLength(6);
    expect(body).toMatch(/data-fit-slot="champion"[\s\S]*?Storm Revenant/);
    expect(body).toMatch(/data-fit-slot="skin"[\s\S]*?Candy colors/);
    expect(body.match(/data-fit-fighter="/g)).toHaveLength(
      Object.keys(CHARACTERS).length,
    );
    expect(body).not.toContain("<select");
  });
  it("collects changes to Equip once, ignores try-ons you don't own, and can Revert", () => {
    const e = economy({
      owned: ["voltkit-midnight", "voltkit-stormcrown", "galaxy-aura"],
      looks: { voltkit: { skin: "voltkit-stormcrown", stage: 1 } },
    });
    const d = data(e, { look: { aura: "galaxy-aura" } });
    const view = wardrobe({
      tryOn: {
        champion: "voltkit-midnight",
        aura: null,
        victory: "cake-victory",
      },
    });
    expect(pendingChanges(view, d)).toEqual([
      {
        slot: "champion",
        from: "voltkit-stormcrown",
        to: "voltkit-midnight",
        stage: 1,
      },
      { slot: "aura", from: "galaxy-aura", to: null },
    ]);
    const foot = fittingRoomParts(view, d).foot;
    expect(foot).toContain("Voltkit · 2 changes");
    expect(foot).toContain("Skin: Storm Revenant → Midnight");
    expect(foot).not.toMatch(
      /data-fit-save[^>]*disabled|disabled[^>]*data-fit-save/,
    );
    // Trying on what you already wear is not a change.
    const same = wardrobe({ tryOn: { champion: "voltkit-stormcrown" } });
    expect(pendingChanges(same, d)).toEqual([]);
    expect(fittingRoomParts(same, d).foot).toMatch(
      /<button[^>]*disabled[^>]*data-fit-save/,
    );
    // Nothing tried: Revert has nothing to undo.
    expect(fittingRoomParts(wardrobe(), d).foot).toMatch(
      /<button[^>]*disabled[^>]*data-fit-revert/,
    );
  });
  it("marks a slot with an unsaved change", () => {
    const e = economy({ owned: ["voltkit-midnight"] });
    const body = fittingRoomParts(
      wardrobe({ tryOn: { champion: "voltkit-midnight" } }),
      data(e),
    ).body;
    expect(body).toMatch(/data-fit-slot="champion" data-changed="true"/);
  });
});

describe("Shop to Wardrobe", () => {
  it("drops Shop try-ons you don't own, so the stage matches the slots", () => {
    const e = economy({
      owned: ["voltkit-midnight", "galaxy-aura"],
      looks: {},
    });
    const d = data(e);
    const view = shop({
      tryOn: {
        champion: "voltkit-snowcap",
        aura: "galaxy-aura",
        entrance: "candy-entrance",
      },
      selected: "voltkit-snowcap",
      stage: 2,
      action: "entrance",
    });
    // True: a fighter skin left (the screen brings your fighter back).
    expect(dropUnownedTryOns(view, d)).toBe(true);
    // Only the owned aura stays on (a change Equip can save).
    expect(view.tryOn).toEqual({ aura: "galaxy-aura" });
    expect(view.selected).toBeNull();
    expect(view.stage).toBeUndefined();
    expect(view.action).toBe("idle");
    expect(stageOutfit(view, d).skin).toBeNull();
    // Owned try-ons are left alone.
    const kept = shop({
      tryOn: { champion: "voltkit-midnight" },
      selected: "voltkit-midnight",
    });
    expect(dropUnownedTryOns(kept, d)).toBe(false);
    expect(kept.tryOn).toEqual({ champion: "voltkit-midnight" });
    expect(kept.selected).toBe("voltkit-midnight");
  });
});

describe("Your look", () => {
  it("shows on the stage only while something you don't wear is on", () => {
    const d = data(economy());
    const stage = (v: FitView) => fittingRoomParts(v, d).stage;
    expect(stage(shop())).not.toContain("data-fit-revert");
    expect(stage(shop({ tryOn: { champion: "voltkit-snowcap" } }))).toContain(
      "data-fit-revert",
    );
    expect(stage(wardrobe({ tryOn: { aura: null } }))).toContain(
      "data-fit-revert",
    );
    // Low graphics has no Entrance or Victory, but still Your look.
    expect(stage(shop({ tryOn: { champion: "voltkit-snowcap" } }))).toContain(
      "data-fit-play",
    );
    const low = fittingRoomParts(
      shop({ tryOn: { champion: "voltkit-snowcap" } }),
      { ...d, low: true },
    ).stage;
    expect(low).not.toContain("data-fit-play");
    expect(low).toContain("data-fit-revert");
  });
});

describe("a fighter with no skins in the Shop yet", () => {
  const bare = (Object.keys(CHARACTERS) as CharacterId[]).find(
    (c) => !CHAMPION_SKINS.some((s) => s.champion === c),
  );
  it.runIf(!!bare)(
    "says so in Skins, and the Wardrobe's More tile leads to Collections",
    () => {
      const body = fittingRoomParts(
        fitView("shop", bare!, { section: "skins" }),
        data(),
      ).body;
      expect(body).toContain("No skins yet");
      expect(body).toContain('data-ui-section="collections"');
      expect(body).not.toContain("Nothing matches");
      const wardrobe = fittingRoomParts(
        fitView("wardrobe", bare!),
        data(),
      ).body;
      expect(tiles(wardrobe)).toEqual(["original"]);
      expect(wardrobe).toContain('data-fit-more="skin"');
      expect(wardrobe).toContain(`No ${CHARACTERS[bare!].name} skins yet`);
    },
  );
});

describe("the stage's animation buttons", () => {
  it("offers a Mythical's ultimate, and says which animation is playing", () => {
    const mythic = fittingRoomParts(
      shop({ tryOn: { champion: "voltkit-stormcrown" }, action: "ultimate" }),
      data(),
    ).stage;
    expect(mythic).toMatch(/data-fit-play="ultimate"[^>]*aria-pressed="true"/);
    expect(mythic).toMatch(/data-fit-play="entrance"[^>]*aria-pressed="false"/);
    // Another rarity has no ultimate of its own to show.
    const epic = fittingRoomParts(
      shop({ tryOn: { champion: "voltkit-neon-arcade" }, action: "victory" }),
      data(),
    ).stage;
    expect(epic).not.toContain('data-fit-play="ultimate"');
    expect(epic).toMatch(/data-fit-play="victory"[^>]*aria-pressed="true"/);
  });
});

// A released client keeps running after the catalogue grows: the server can
// then send ids this build has never heard of (a new skin in Today's picks,
// worn on a newer device, in the raid look). None of them may throw: Today
// is the tab the Shop opens on.
describe("ids this build doesn't know", () => {
  const NEW = "voltkit-from-the-future";
  const everyScreen = (d: FitData, extra: Partial<FitView> = {}) => {
    for (const [section] of SHOP_SECTIONS)
      fittingRoomMarkup(shop({ section, ...extra }), d);
    for (const slot of [
      "champion",
      "skin",
      "aura",
      "entrance",
      "victory",
      "frame",
    ] as const)
      fittingRoomMarkup(wardrobe({ slot, ...extra }), d);
  };
  it("leaves an unknown Today's pick out and keeps the ones it knows", () => {
    const e = economy({
      picks: {
        day: "2026-10-17",
        items: [NEW, "galaxy-aura", "new-bundle-piece", "mystowl-scholar"],
        deal: "voltkit-snowcap",
      },
    });
    const body = fittingRoomParts(shop(), data(e)).body;
    expect(tiles(body)).toEqual(["galaxy-aura", "mystowl-scholar"]);
    expect(body).not.toContain(NEW);
  });
  it("shows no featured deal when the deal is an unknown item", () => {
    const e = economy({
      picks: { day: "2026-10-17", items: [NEW, "galaxy-aura"], deal: NEW },
    });
    const body = fittingRoomParts(shop(), data(e)).body;
    expect(body).not.toContain('class="fit-deal"');
    expect(tiles(body)).toEqual(["galaxy-aura"]);
    // The known pick keeps its full price: the deal isn't it.
    expect(purchase("galaxy-aura", e)?.was).toBeUndefined();
  });
  it("still draws Today when every pick is unknown", () => {
    const e = economy({
      picks: { day: "2026-10-17", items: [NEW, "other-new"], deal: null },
    });
    const body = fittingRoomParts(shop(), data(e)).body;
    expect(tiles(body)).toEqual([]);
    expect(body).not.toContain("Daily picks");
    expect(body).toContain("Earn coins");
  });
  it("draws every screen with unknown ids owned, worn, awakened and selected", () => {
    const e = economy({
      owned: [NEW, "new-aura", "voltkit-snowcap"],
      picks: { day: "2026-10-17", items: [NEW], deal: NEW },
      looks: { voltkit: { skin: NEW, stage: 2 } },
      awakening: { [NEW]: { wins: 3, peril3: false, stage: 2 } },
    });
    const d = data(e, {
      look: { aura: "new-aura", frame: "new-frame" } as never,
      progress: {
        cosmetics: ["new-frame"],
        earned: ["new-aura"],
      } as unknown as RaidProgress,
    });
    expect(() => everyScreen(d)).not.toThrow();
    expect(() => everyScreen(d, { selected: NEW })).not.toThrow();
    expect(() =>
      everyScreen(d, {
        selected: NEW,
        tryOn: { champion: NEW, aura: "new-aura" },
      }),
    ).not.toThrow();
    expect(() =>
      everyScreen({ ...d, low: true }, { selected: NEW }),
    ).not.toThrow();
    // An unknown skin worn reads as the original look, never as a raw id.
    const html = fittingRoomMarkup(wardrobe(), d);
    expect(html).not.toContain(NEW);
    expect(html).not.toContain("new-aura");
    expect(stageOutfit(wardrobe(), d).skin).toBeNull();
  });
});

// The owner's request of 25 Nov 2026: make the Shop's items look better.
// What a tile, a set's row and the stage say about an item's rarity, and the
// order the Skins grid shows them in.
describe("rarity and order in the catalogue", () => {
  const skinsOf = (c: CharacterId) =>
    CHAMPION_SKINS.filter((s) => s.champion === c);
  const RANK = ["mythical", "legendary", "epic", "rare", "common"];
  it("lists a fighter's skins rarest first, in the catalogue's order within a rarity", () => {
    const body = fittingRoomParts(shop({ section: "skins" }), data()).body;
    const ids = tiles(body);
    expect(ids).toHaveLength(skinsOf("voltkit").length);
    const ranks = ids.map((id) =>
      RANK.indexOf(CHAMPION_SKINS.find((s) => s.id === id)!.rarity),
    );
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(ids[0]).toBe("voltkit-stormcrown");
    // Within a rarity nothing moves: the catalogue's order.
    const legendary = skinsOf("voltkit")
      .filter((s) => s.rarity === "legendary")
      .map((s) => s.id);
    expect(ids.filter((id) => legendary.includes(id))).toEqual(legendary);
  });
  it("sorts cheapest first on request, and the button says the order it shows", () => {
    const rare = fittingRoomParts(shop({ section: "skins" }), data()).body;
    expect(rare).toMatch(/data-fit-sort="price"[^>]*>.*?Rarest/s);
    const cheap = fittingRoomParts(
      shop({ section: "skins", sort: "price" }),
      data(),
    ).body;
    expect(cheap).toMatch(/data-fit-sort="rarity"[^>]*>.*?Cheapest/s);
    const ids = tiles(cheap);
    // Every Common first (500 coins), in the catalogue's order.
    const commons = skinsOf("voltkit")
      .filter((s) => s.rarity === "common")
      .map((s) => s.id);
    expect(commons).toContain("voltkit-midnight");
    expect(ids.slice(0, commons.length)).toEqual(commons);
    expect(ids.at(-1)).toBe("voltkit-stormcrown");
    // Today's deal doesn't move a skin: the order is by list price.
    const e = economy({
      picks: { day: "2026-10-17", items: [], deal: "voltkit-stormcrown" },
    });
    expect(
      tiles(
        fittingRoomParts(shop({ section: "skins", sort: "price" }), data(e))
          .body,
      ).at(-1),
    ).toBe("voltkit-stormcrown");
  });
  it("puts new arrivals first within their rarity", () => {
    const skins = skinsOf("voltkit");
    const sorted = sortSkins(
      skins,
      "rarity",
      (id) => id === "voltkit-stars-stripes",
    ).map((s) => s.id);
    const legendary = sorted.filter(
      (id) => skins.find((s) => s.id === id)!.rarity === "legendary",
    );
    expect(legendary[0]).toBe("voltkit-stars-stripes");
    expect(sorted[0]).toBe("voltkit-stormcrown");
  });
  it("marks an item New for two weeks from the day its collection arrived", () => {
    const day = Date.parse("2026-12-01T00:00:00Z");
    const arrivals = {
      "stars-stripes": "2026-12-01",
      "galaxy-aura": "2026-12-01",
    };
    const is = (id: string, at: number) => isNewArrival(id, at, arrivals);
    expect(is("voltkit-stars-stripes", day)).toBe(true);
    expect(is("mystowl-stars-stripes", day + 13 * 86_400_000)).toBe(true);
    expect(is("voltkit-stars-stripes", day + NEW_DAYS * 86_400_000)).toBe(
      false,
    );
    expect(is("voltkit-stars-stripes", day - 3 * 86_400_000)).toBe(false);
    // One item by its own id; the rest of its collection isn't new.
    expect(is("galaxy-aura", day)).toBe(true);
    expect(is("galaxy-frame", day)).toBe(false);
    expect(is("voltkit-midnight", day)).toBe(false);
    expect(is("not-an-item", day)).toBe(false);
    // Nothing is marked until a line is added to SHOP_ARRIVALS.
    expect(isNewArrival("voltkit-stars-stripes", day)).toBe(false);
  });
  it("keeps the skins above the collection rewards, and one filter row on a phone", () => {
    const body = fittingRoomParts(shop({ section: "skins" }), data()).body;
    expect(body.indexOf('class="ui-grid')).toBeLessThan(
      body.indexOf("data-fit-reward"),
    );
    expect(body).toContain('data-ui-rarity="rare"');
    // A phone held sideways: ownership and the order, no rarity chips, and
    // a rarity chosen on a wider screen doesn't hide skins there.
    const phone = fittingRoomParts(
      shop({ section: "skins", rarity: "rare" }),
      data(economy(), { compact: true }),
    ).body;
    expect(phone).not.toContain("data-ui-rarity");
    expect(phone).toContain("data-fit-sort");
    expect(tiles(phone)).toHaveLength(skinsOf("voltkit").length);
  });
  it("names a skin's collection on its tile, which tells the two Bulldozers apart", () => {
    const body = fittingRoomParts(
      fitView("shop", "wombolder", { section: "skins" }),
      data(),
    ).body;
    const sub = (id: string) =>
      body.match(
        new RegExp(`data-ui-item="${id}"[\\s\\S]*?ui-tile-sub">([^<]*)<`),
      )?.[1];
    expect(sub("wombolder-hero-squad")).toBe("Hero Squad · Wombolder");
    expect(sub("wombolder-bulldozer")).toBe("Cyber Mecha · Wombolder");
    expect(sub("wombolder-sandy")).toBe("Wombolder skin");
  });
  it("gives a set its rarest piece's rarity, not purple for every set", () => {
    const body = fittingRoomParts(shop(), data()).body;
    const rarity = (id: string) =>
      body.match(
        new RegExp(`data-ui-item="${id}" data-rarity="([a-z]+)"`),
      )?.[1];
    expect(rarity("galaxy-set")).toBe("mythical");
    expect(rarity("candy-set")).toBe("epic");
    const sets = fittingRoomParts(
      shop({ section: "collections" }),
      data(),
    ).body;
    expect(sets).toMatch(
      /data-ui-item="stars-stripes-skins" data-rarity="legendary"/,
    );
    expect(sets).toMatch(/data-ui-item="wayfarer-skins" data-rarity="rare"/);
  });
  it("dresses the stage in the rarity of what stands on it", () => {
    const stage = (view: FitView, d = data()) =>
      fittingRoomParts(view, d).stage.match(
        /class="ui-split-stage[^>]*?data-rarity="([a-z]+)"/,
      )?.[1];
    // The original look: no rarity.
    expect(stage(shop())).toBeUndefined();
    expect(
      stage(
        shop({
          selected: "voltkit-sky-pirates",
          tryOn: { champion: "voltkit-sky-pirates" },
        }),
      ),
    ).toBe("legendary");
    // Nothing picked: the skin worn.
    const worn = economy({
      owned: ["voltkit-stormcrown"],
      looks: { voltkit: { skin: "voltkit-stormcrown", stage: 1 } },
    });
    expect(stage(shop(), data(worn))).toBe("mythical");
    // A set has no rarity of its own on the stage.
    expect(stage(shop({ selected: "candy-set" }))).toBeUndefined();
    // A Legendary's rays are part of the stage light (they start at the
    // feet), hidden until the stage's rarity shows them.
    expect(fittingRoomParts(shop(), data()).stage).toContain(
      '<path class="stage-light-rays" visibility="hidden"',
    );
  });
  it("shows a frame round your portrait, and a tile with no rarity keeps its row", () => {
    const d = data(economy({ owned: ["candy-frame"] }), { avatar: null });
    const body = fittingRoomParts(wardrobe({ slot: "frame" }), d).body;
    expect(body).toMatch(
      /data-ui-item="candy-frame"[\s\S]*?ui-tile-art"><span class="raid-cosmetic-preview portrait-frame/,
    );
    expect(body).toContain('<span class="ui-rarity is-none"></span>');
  });
});
