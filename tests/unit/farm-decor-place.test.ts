import { describe, expect, it } from "vitest";
import {
  DECOR_AREA,
  DECOR_GRID,
  DECOR_GROUPS,
  DECOR_SEASONS,
  DECOR_SETS,
  FARM_DECOR,
  decorBox,
  decorCap,
  decorCharm,
  decorFits,
  decorSeasonsOn,
  decorSetsDone,
  nearestDecorSpot,
  type FarmDecorPiece,
} from "../../packages/shared/src/farm";

// Decorations anywhere on the farm (20261116120000_farm_free_decor.sql).
describe("decorations on the farm's land", () => {
  it("has a size, a price and a level for every decoration", () => {
    expect(new Set(FARM_DECOR.map((d) => d.id)).size).toBe(FARM_DECOR.length);
    for (const d of FARM_DECOR) {
      expect(d.w).toBeGreaterThan(0);
      expect(d.d).toBeGreaterThan(0);
      expect(d.price).toBeGreaterThan(0);
      expect(d.charm).toBeGreaterThan(0);
    }
  });
  it("grows the room for decorations with the farm, up to 60", () => {
    expect(decorCap(1)).toBe(11);
    expect(decorCap(20)).toBe(30);
    expect(decorCap(50)).toBe(60);
    expect(decorCap(100)).toBe(60);
  });
  it("takes free grass on the grid, not the field, buildings or pond", () => {
    expect(decorFits("rock", 100, 900, [])).toBeNull();
    expect(decorFits("rock", 105, 900, [])).toBe("Choose a spot on the farm");
    expect(decorFits("rock", 0, 900, [])).toBe("Choose a spot on the farm");
    // The field, the barn's row, the pond, the gate's path, a farm tree.
    for (const [x, y] of [
      [800, 500],
      [1250, 300],
      [250, 990],
      [880, 950],
      [640, 1040],
    ])
      expect(decorFits("rock", x, y, []), `${x},${y}`).toBe(
        "Something is in the way",
      );
  });
  it("keeps decorations apart, except the one being moved", () => {
    const placed: FarmDecorPiece[] = [{ id: 1, item: "bench", x: 560, y: 900 }];
    expect(decorFits("rock", 600, 900, placed)).toBe(
      "Too close to another decoration",
    );
    expect(decorFits("bench", 570, 900, placed, 1)).toBeNull();
    // Right beside it is fine: the boxes don't overlap.
    const b = decorBox("bench", 560, 900),
      r = decorBox("rock", 640, 900);
    expect(r.x0).toBeGreaterThan(b.x1);
    expect(decorFits("rock", 640, 900, placed)).toBeNull();
  });
  it("finds the nearest free spot for a new decoration", () => {
    const spot = nearestDecorSpot("tower", 800, 500, []);
    expect(spot).not.toBeNull();
    expect(decorFits("tower", spot!.x, spot!.y, [])).toBeNull();
    expect(spot!.x % DECOR_GRID).toBe(0);
    // A farm full of rocks: still somewhere, until there's nowhere near.
    expect(nearestDecorSpot("plum", 880, 950, [], undefined, 30)).toBeNull();
  });
  it("keeps the old 8 spots on the land", () => {
    for (const [x, y] of [
      [80, 830],
      [230, 870],
      [530, 870],
      [1240, 870],
      [70, 540],
      [1700, 880],
      [1390, 890],
      [390, 890],
    ]) {
      expect(x).toBeGreaterThanOrEqual(DECOR_AREA.x0);
      expect(y).toBeLessThanOrEqual(DECOR_AREA.y1);
    }
  });
});

// The bigger catalog (20261117120000_farm_decor_catalog.sql).
describe("the decoration catalog: groups, paths, seasons, collections", () => {
  const byId = new Map(FARM_DECOR.map((d) => [d.id, d]));
  it("sorts 30+ new decorations into the shop's groups", () => {
    expect(FARM_DECOR.length).toBeGreaterThanOrEqual(19 + 30);
    const groups = new Set(DECOR_GROUPS.map((g) => g.id));
    for (const d of FARM_DECOR) {
      expect(groups.has(d.group), d.id).toBe(true);
      // The server takes ids of letters and digits only (accounts.ts).
      expect(d.id).toMatch(/^[a-z0-9]{1,32}$/);
      // Fences and hedges span 50 px so a row of them joins up on the grid.
      if (d.group === "fences" && !d.ground)
        expect((d.w * 2) % DECOR_GRID).toBe(0);
    }
    for (const g of groups)
      expect(
        FARM_DECOR.filter((d) => d.group === g).length,
        g,
      ).toBeGreaterThanOrEqual(3);
  });
  it("prices the new ones at 300 to 650 Gold Leaves per Charm", () => {
    const old = new Set(
      "rock hay bush6 mailbox bush7 bench flowers crates lamp planter mintree pine autumn cherry apple orange tower plum statue".split(
        " ",
      ),
    );
    for (const d of FARM_DECOR.filter((d) => !old.has(d.id))) {
      expect(d.price / d.charm, d.id).toBeGreaterThanOrEqual(300);
      expect(d.price / d.charm, d.id).toBeLessThanOrEqual(650);
    }
  });
  it("keeps seasonal decorations in the Seasonal group, and only them", () => {
    const seasons = new Set(DECOR_SEASONS.map((s) => s.id));
    for (const d of FARM_DECOR) {
      expect(!!d.season, d.id).toBe(d.group === "seasonal");
      if (d.season) expect(seasons.has(d.season)).toBe(true);
    }
    for (const s of seasons)
      expect(
        FARM_DECOR.some((d) => d.season === s),
        s,
      ).toBe(true);
  });
  it("sells each season's decorations on its days, over the new year too", () => {
    expect(decorSeasonsOn("2026-10-01")).toEqual(["halloween"]);
    expect(decorSeasonsOn("2026-11-07")).toEqual(["halloween"]);
    expect(decorSeasonsOn("2026-11-08")).toEqual([]);
    expect(decorSeasonsOn("2026-12-01")).toEqual(["christmas"]);
    expect(decorSeasonsOn("2027-01-06")).toEqual(["christmas"]);
    expect(decorSeasonsOn("2027-01-07")).toEqual([]);
    expect(decorSeasonsOn("2027-01-15")).toEqual(["lunar"]);
    // Every Lunar New Year to 2035 and the Lantern Festival 14 days on,
    // except 2034's (19 Feb, the latest; its Lantern Festival is 5 Mar).
    for (const day of [
      "2027-02-06",
      "2028-01-26",
      "2029-02-13",
      "2030-02-03",
      "2031-01-23",
      "2032-02-11",
      "2033-01-31",
      "2034-02-19",
      "2035-02-08",
    ])
      expect(decorSeasonsOn(day), day).toEqual(["lunar"]);
    expect(decorSeasonsOn("2028-02-29")).toEqual(["lunar"]);
    expect(decorSeasonsOn("2028-03-01")).toEqual([]);
  });
  it("lets paths overlap paths, never anything standing", () => {
    const flat = FARM_DECOR.filter((d) => d.ground);
    expect(flat.length).toBeGreaterThanOrEqual(3);
    for (const d of flat) expect(d.group).toBe("fences");
    const placed: FarmDecorPiece[] = [
      { id: 1, item: "pathstone", x: 600, y: 950 },
      { id: 2, item: "picket", x: 1100, y: 900 },
    ];
    expect(decorFits("pathgravel", 610, 950, placed)).toBeNull();
    expect(decorFits("pathstone", 600, 950, placed)).toBeNull();
    expect(decorFits("tulips", 600, 950, placed)).toBe(
      "Too close to another decoration",
    );
    expect(decorFits("pathbrick", 1100, 900, placed)).toBe(
      "Too close to another decoration",
    );
    // Still not on the field, the pond or the gate's path.
    expect(decorFits("pathstone", 800, 500, [])).toBe(
      "Something is in the way",
    );
    expect(decorFits("pathstone", 880, 950, [])).toBe(
      "Something is in the way",
    );
    // Fences 50 px apart touch without overlapping.
    expect(decorFits("picket", 1150, 900, placed)).toBeNull();
    expect(decorFits("picket", 1140, 900, placed)).toBe(
      "Too close to another decoration",
    );
  });
  it("adds a collection's Charm once all of it stands on the farm", () => {
    const ids = new Set<string>();
    for (const s of DECOR_SETS) {
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
      expect(new Set(s.items).size).toBe(s.items.length);
      expect(s.items.length).toBeGreaterThanOrEqual(3);
      for (const i of s.items) expect(byId.has(i), i).toBe(true);
      // A seasonal set is one season's.
      expect(new Set(s.items.map((i) => byId.get(i)!.season ?? "")).size).toBe(
        1,
      );
    }
    const cottage = DECOR_SETS.find((s) => s.id === "cottage")!;
    const pieces = cottage.items.map((item, k) => ({ item, id: k }));
    const sum = cottage.items.reduce((a, i) => a + byId.get(i)!.charm, 0);
    expect(decorCharm(pieces.slice(0, 4))).toBe(
      sum - byId.get(cottage.items[4])!.charm,
    );
    expect(decorSetsDone(pieces).map((s) => s.id)).toEqual(["cottage"]);
    expect(decorCharm(pieces)).toBe(sum + cottage.charm);
    // Two of a piece count it once for the set.
    expect(decorCharm([...pieces, pieces[0]])).toBe(
      sum + cottage.charm + byId.get(cottage.items[0])!.charm,
    );
  });
});
