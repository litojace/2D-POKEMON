import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAMPION_SKIN_BY_ID,
  LOOK_ITEM_BY_ID,
  type Economy,
} from "../../packages/shared/src/shop";

// Which collections count as new in these tests: stand-ins for a collection
// that has just reached the Shop (the real list, SHOP_ARRIVALS, changes as
// collections ship).
const fresh = vi.hoisted(() => ({ collections: new Set<string>() }));
vi.mock("../../apps/client/src/shop-arrivals", async (original) => ({
  ...(await original<typeof import("../../apps/client/src/shop-arrivals")>()),
  isNewArrival: (id: string) => {
    const c =
      CHAMPION_SKIN_BY_ID[id]?.collection ?? LOOK_ITEM_BY_ID[id]?.collection;
    return !!c && fresh.collections.has(c);
  },
}));

import {
  fitView,
  fittingRoomParts,
  newInShop,
  type FitData,
  type FitView,
} from "../../apps/client/src/screens/fitting-room-view";

const economy = (extra: Partial<Economy> = {}): Economy => ({
  balance: 9000,
  owned: [],
  picks: {
    day: "2026-11-25",
    items: ["galaxy-aura", "mystowl-scholar"],
    deal: "voltkit-snowcap",
  },
  trialWins: {},
  awakening: {},
  looks: {},
  missions: [],
  rerolled: false,
  streak: 0,
  today: { raidClears: 0, pvpMatches: 0 },
  ...extra,
});
const data = (e = economy(), extra: Partial<FitData> = {}): FitData => ({
  economy: e,
  progress: null,
  look: {},
  ...extra,
});
const shop = (extra: Partial<FitView> = {}) =>
  fitView("shop", "voltkit", extra);
const tiles = (html: string) =>
  [...html.matchAll(/class="ui-tile[^"]*"[^>]*data-ui-item="([^"]+)"/g)].map(
    (m) => m[1],
  );
/** The tiles of the "New in the Shop" grid only. */
const newTiles = (html: string) =>
  tiles(html.match(/fit-picks fit-new"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");

beforeEach(() => fresh.collections.clear());

describe("Today's New in the Shop", () => {
  it("shows nothing while nothing is new", () => {
    const body = fittingRoomParts(shop(), data()).body;
    expect(body).not.toContain("New in the Shop");
    expect(newInShop(shop(), data())).toEqual([]);
  });

  it("shows one skin of a new collection: the fighter you're looking at", () => {
    fresh.collections.add("stars-stripes");
    expect(newInShop(shop(), data())).toEqual(["voltkit-stars-stripes"]);
    expect(newInShop(fitView("shop", "mystowl"), data())).toEqual([
      "mystowl-stars-stripes",
    ]);
    // Yours already: another fighter's skin from the same collection.
    const own = data(economy({ owned: ["voltkit-stars-stripes"] }));
    const [other] = newInShop(shop(), own);
    expect(other).toMatch(/-stars-stripes$/);
    expect(other).not.toBe("voltkit-stars-stripes");
    // All of it yours: no row.
    const all = Object.values(CHAMPION_SKIN_BY_ID)
      .filter((s) => s.collection === "stars-stripes")
      .map((s) => s.id);
    expect(newInShop(shop(), data(economy({ owned: all })))).toEqual([]);
  });

  it("lists new Look pieces one by one, rarest first, at most six", () => {
    fresh.collections.add("galaxy");
    fresh.collections.add("stars-stripes");
    // galaxy-aura is one of today's picks: it isn't shown twice.
    const ids = newInShop(shop(), data());
    expect(ids).toEqual([
      "galaxy-entrance",
      "galaxy-frame",
      "galaxy-victory",
      "voltkit-stars-stripes",
      "galaxy-colours",
    ]);
    expect(ids).not.toContain("galaxy-aura");
    expect(newInShop(shop(), data(), undefined, 3)).toHaveLength(3);
  });

  it("leaves out today's deal and what you own", () => {
    fresh.collections.add("winter");
    const e = economy({
      owned: ["winter-frame"],
      picks: { day: "2026-11-25", items: [], deal: "voltkit-snowcap" },
    });
    const ids = newInShop(shop(), data(e));
    expect(ids).not.toContain("voltkit-snowcap");
    expect(ids).not.toContain("winter-frame");
    expect(ids).toContain("winter-aura");
  });

  it("sits under the deal and above the daily picks, named by collection", () => {
    fresh.collections.add("stars-stripes");
    fresh.collections.add("galaxy");
    const body = fittingRoomParts(shop(), data()).body;
    const at = body.indexOf("New in the Shop");
    expect(at).toBeGreaterThan(body.indexOf('class="fit-deal"'));
    expect(at).toBeLessThan(body.indexOf("Daily picks"));
    expect(body).toMatch(
      /New in the Shop<\/h3><small class="ui-note">(Galaxy · Stars &amp; Stripes|Stars &amp; Stripes · Galaxy)<\/small>/,
    );
    expect(newTiles(body)).toEqual(newInShop(shop(), data()));
    // The tiles carry the New tag (shopTile reads the same arrivals).
    expect(body).toMatch(
      /data-ui-item="voltkit-stars-stripes"[^>]*>\s*<span class="ui-tag is-new">New<\/span>/,
    );
  });
});

describe("the Wardrobe's action bar", () => {
  const wardrobe = (extra: Partial<FitView> = {}) =>
    fitView("wardrobe", "voltkit", extra);
  it("puts the count of changes above the fighter's name", () => {
    const foot = fittingRoomParts(wardrobe(), data()).foot;
    expect(foot).toContain(
      '<small class="fit-foot-count">No changes</small><b class="ui-h">Voltkit</b>',
    );
    const e = economy({ owned: ["voltkit-snowcap"] });
    const changed = fittingRoomParts(
      wardrobe({ tryOn: { champion: "voltkit-snowcap" } }),
      data(e),
    ).foot;
    expect(changed).toContain(
      '<small class="fit-foot-count" data-changes="true">1 change</small><b class="ui-h">Voltkit</b>',
    );
    expect(changed).toContain("Skin: Original → Snowcap");
  });
});
