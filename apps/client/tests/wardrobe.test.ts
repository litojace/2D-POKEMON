import { describe, expect, it } from "vitest";
import type { Economy } from "../../../packages/shared/src/shop";
import type { RaidProgress } from "../../../packages/shared/src/raid";
import {
  wardrobeMarkup,
  wardrobeOutfit,
  wardrobeOwned,
  wardrobeWorn,
  type WardrobeView,
} from "../src/wardrobe-ui";
const economy = (): Economy => ({
  balance: 0,
  owned: [
    "voltkit-midnight",
    "auralynx-celestial-sage",
    "candy-colours",
    "galaxy-aura",
  ],
  picks: { day: "2026-10-22", items: [], deal: null },
  trialWins: {},
  awakening: {
    "auralynx-celestial-sage": { stage: 2, wins: 20, peril3: false },
  },
  looks: { voltkit: { skin: "voltkit-midnight", stage: 1 } },
  missions: [],
  rerolled: false,
  streak: 0,
  today: { raidClears: 0, pvpMatches: 0 },
});
const progress = (): RaidProgress => ({
  clears: 1,
  highestPeril: 1,
  bestSeconds: 100,
  titles: [],
  cosmetics: ["cragbound", "mountain-aura"],
  earned: ["mountainborn", "stormsplitter"],
  weekly: [],
});
const view = (extra: Partial<WardrobeView> = {}): WardrobeView => ({
  champion: "voltkit",
  slot: "all",
  action: "idle",
  ...extra,
});
describe("Wardrobe owned inventory", () => {
  it("combines purchased pieces and earned boss rewards, excluding unearned items and titles", () => {
    const ids = wardrobeOwned(economy(), progress(), "voltkit").map(
      (i) => i.id,
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "voltkit-midnight",
        "candy-colours",
        "galaxy-aura",
        "cragbound",
        "mountain-aura",
        "mountainborn",
      ]),
    );
    expect(ids).not.toContain("stormsplitter");
    expect(ids).not.toContain("cragstone");
    expect(ids).not.toContain("candy-frame");
  });
  it("shows only the selected fighter's champion skins, keeping shared cosmetics", () => {
    const ids = wardrobeOwned(economy(), progress(), "auralynx").map(
      (i) => i.id,
    );
    expect(ids).toContain("auralynx-celestial-sage");
    expect(ids).not.toContain("voltkit-midnight");
    expect(ids).toContain("mountain-aura");
  });
  it("deduplicates rewards present in both legacy cosmetics and earned records", () => {
    const p = progress();
    p.earned!.push("cragbound");
    expect(
      wardrobeOwned(economy(), p, "voltkit").filter(
        (i) => i.id === "cragbound",
      ),
    ).toHaveLength(1);
  });
  it("can show Shop ownership when raid storage is unavailable", () => {
    expect(wardrobeOwned(economy(), null, "voltkit").map((i) => i.id)).toEqual([
      "voltkit-midnight",
      "candy-colours",
      "galaxy-aura",
    ]);
  });
});
describe("Wardrobe complete outfit previews", () => {
  it("previews a change without mutating saved looks or shared loadout", () => {
    const e = economy(),
      look = { aura: "mountain-aura", entrance: "mountainborn" };
    const before = JSON.stringify({ e, look });
    expect(wardrobeOutfit(view({ preview: "galaxy-aura" }), e, look)).toEqual({
      skin: e.looks.voltkit,
      look: { ...look, aura: "galaxy-aura" },
    });
    expect(JSON.stringify({ e, look })).toBe(before);
  });
  it("preserves the champion skin when trying colours, matching in-game precedence", () => {
    const outfit = wardrobeOutfit(
      view({ preview: "candy-colours" }),
      economy(),
      { aura: "mountain-aura" },
    );
    expect(outfit.skin?.skin).toBe("voltkit-midnight");
    expect(outfit.look.skin).toBe("candy-colours");
  });
  it("trying the original champion skin preserves shared effects and colours", () => {
    const look = {
      skin: "candy-colours",
      aura: "mountain-aura",
      victory: "rockslide-flex",
    };
    expect(
      wardrobeOutfit(view({ preview: "original" }), economy(), look),
    ).toEqual({ skin: null, look });
  });
  it("previews an earned awakening stage and preserves the currently worn stage", () => {
    const e = economy();
    const v = view({
      champion: "auralynx",
      preview: "auralynx-celestial-sage",
    });
    expect(wardrobeOutfit(v, e, {}).skin?.stage).toBe(2);
    e.looks.auralynx = { skin: v.preview!, stage: 1 };
    expect(wardrobeOutfit(v, e, {}).skin?.stage).toBe(1);
  });
  it("reads champion skins separately from all-fighter skin slots", () => {
    expect(
      wardrobeWorn("champion", "voltkit", economy(), { skin: "cragstone" }),
    ).toBe("voltkit-midnight");
    expect(
      wardrobeWorn("skin", "voltkit", economy(), { skin: "cragstone" }),
    ).toBe("cragstone");
  });
});
describe("Wardrobe actions and empty states", () => {
  it("filters only the inventory while leaving every equipped slot reachable", () => {
    const html = wardrobeMarkup(view({ slot: "aura" }), economy(), progress(), {
      skin: "cragbound",
      aura: "mountain-aura",
    });
    expect(html).toContain('data-wardrobe-preview="mountain-aura"');
    expect(html).not.toContain('data-wardrobe-preview="voltkit-midnight"');
    expect(html).toContain('data-wardrobe-clear="champion"');
    expect(html).toContain('data-wardrobe-clear="skin"');
  });
  it("offers explicit equip or remove actions for owned selections", () => {
    const e = economy();
    expect(
      wardrobeMarkup(view({ preview: "galaxy-aura" }), e, progress(), {}),
    ).toContain('data-wardrobe-remove="false"');
    expect(
      wardrobeMarkup(view({ preview: "galaxy-aura" }), e, progress(), {
        aura: "galaxy-aura",
      }),
    ).toContain('data-wardrobe-remove="true"');
    expect(
      wardrobeMarkup(view({ preview: "cragstone" }), e, progress(), {}),
    ).not.toContain('data-wardrobe-save="cragstone"');
  });
  it("keeps an original look and earn/shop paths available to new players", () => {
    const e = economy();
    e.owned = [];
    e.looks = {};
    const html = wardrobeMarkup(view(), e, null, {});
    expect(html).toContain('data-wardrobe-preview="original"');
    expect(html).toContain("data-wardrobe-shop");
    expect(html).toContain("data-wardrobe-raids");
    expect(html).not.toMatch(/undefined|NaN|\[object/);
  });
});
