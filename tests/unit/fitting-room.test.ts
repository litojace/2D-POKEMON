import { describe, expect, it } from "vitest";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  CHAMPION_SKINS,
  SHOP_BUNDLES,
  type Economy,
} from "../../packages/shared/src/shop";
import type { RaidProgress } from "../../packages/shared/src/raid";
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
    expect(tiles(fittingRoomParts(view, data(e)).body)).toEqual([
      "voltkit-midnight",
      "voltkit-snowcap",
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
    expect(stage).toContain('data-fighter="tidefin"');
    expect(stage).toContain("tidefin-moontide");
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
    expect(body).toMatch(/data-fit-slot="champion"[\s\S]*?Stormcrown/);
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
    expect(foot).toContain("Skin: Stormcrown → Midnight");
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
