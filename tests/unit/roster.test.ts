import { describe, expect, it } from "vitest";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { CHAMPION_SKINS } from "../../packages/shared/src/shop";
import { RAID_BOSS_PERKS } from "../../packages/shared/src/raid";
import {
  FIGHTERS,
  fighterStats,
  looksOwned,
  mastery,
  raidTricks,
  rosterMarkup,
  rosterOrder,
  rosterView,
  stepFighter,
  type RosterData,
} from "../../apps/client/src/screens/roster-view";
import { attackRange } from "../../apps/client/src/fighter-selection";

// The roster (UI remodel step 3): filters, sort, mastery, looks, the
// fighter detail's tabs and the main button.
const matches: Partial<Record<CharacterId, number>> = {
  voltkit: 31,
  tidefin: 16,
  cindrake: 7,
};
const data = (extra: Partial<RosterData> = {}): RosterData => ({
  playing: "voltkit",
  matches: (c) => matches[c] ?? 0,
  owned: ["voltkit-midnight", "voltkit-stormcrown", "cindrake-ashen"],
  looks: { voltkit: { skin: "voltkit-stormcrown", stage: 2 } },
  keys: {
    skills: ["Q", "E", "R", "F"],
    basic: "LMB",
    dash: "RMB",
    jump: "SPACE",
  },
  ...extra,
});
const cards = (html: string) =>
  [...html.matchAll(/data-roster-card="([^"]+)"/g)].map((m) => m[1]);

describe("filters and sort", () => {
  it("sorts by mastery (most played first), then by name", () => {
    const order = rosterOrder(rosterView("voltkit"), data());
    expect(order.slice(0, 3)).toEqual(["voltkit", "tidefin", "cindrake"]);
    const rest = order.slice(3);
    expect(rest).toEqual(
      [...rest].sort((a, b) =>
        CHARACTERS[a].name.localeCompare(CHARACTERS[b].name),
      ),
    );
    expect(order).toHaveLength(FIGHTERS.length);
  });
  it("sorts by name or by element, and filters by element and range", () => {
    const byName = rosterOrder(rosterView("voltkit", { sort: "name" }), data());
    expect(byName).toEqual(
      [...FIGHTERS].sort((a, b) =>
        CHARACTERS[a].name.localeCompare(CHARACTERS[b].name),
      ),
    );
    const fire = rosterOrder(
      rosterView("voltkit", { element: "Fire" }),
      data(),
    );
    expect(fire.every((c) => CHARACTERS[c].element === "Fire")).toBe(true);
    expect(fire.length).toBeGreaterThan(0);
    for (const range of ["long", "close"] as const) {
      const list = rosterOrder(rosterView("voltkit", { range }), data());
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((c) => attackRange(c) === range)).toBe(true);
    }
  });
  it("offers a way back when nothing matches", () => {
    // No element has both every range, so pick a combination that is empty.
    const empty = FIGHTERS.map((c) => CHARACTERS[c].element).find(
      (e) =>
        rosterOrder(
          rosterView("voltkit", { element: e, range: "long" }),
          data(),
        ).length === 0 ||
        rosterOrder(
          rosterView("voltkit", { element: e, range: "close" }),
          data(),
        ).length === 0,
    );
    if (!empty) return; // every element has both ranges: nothing to show empty
    const range = rosterOrder(
      rosterView("voltkit", { element: empty, range: "long" }),
      data(),
    ).length
      ? "close"
      : "long";
    const html = rosterMarkup(
      rosterView("voltkit", { element: empty, range }),
      data(),
    );
    expect(cards(html)).toEqual([]);
    expect(html).toContain("data-roster-reset");
  });
  it("steps through every fighter with ‹ ›, wrapping round", () => {
    const view = rosterView("voltkit", { mode: "detail" });
    const seen = new Set<CharacterId>();
    let c: CharacterId = "voltkit";
    for (let i = 0; i < FIGHTERS.length; i++) {
      seen.add(c);
      c = stepFighter({ ...view, focus: c }, data(), 1);
    }
    expect(seen.size).toBe(FIGHTERS.length);
    expect(c).toBe("voltkit");
    expect(stepFighter(view, data(), -1)).toBe(
      rosterOrder(view, data()).at(-1),
    );
  });
});

describe("what a card says", () => {
  it("counts looks: the original plus owned skins, out of all of them", () => {
    const all =
      CHAMPION_SKINS.filter((s) => s.champion === "voltkit").length + 1;
    expect(looksOwned("voltkit", data().owned)).toEqual({ have: 3, all });
    expect(looksOwned("tidefin", data().owned)).toEqual({
      have: 1,
      all: CHAMPION_SKINS.filter((s) => s.champion === "tidefin").length + 1,
    });
  });
  it("tells mastery from the existing tiers, with what the next one needs", () => {
    expect(mastery(0)).toMatchObject({
      tier: null,
      progress: 0,
      label: "New · Bronze in 5 matches",
    });
    const gold = mastery(31);
    expect(gold.tier?.name).toBe("Gold");
    expect(gold.label).toBe("Gold · Crystal in 29 matches");
    expect(gold.progress).toBeCloseTo((100 * 1) / 30);
    expect(mastery(60).label).toBe("Crystal · maximum mastery");
    expect(mastery(4).label).toBe("New · Bronze in 1 match");
  });
  it("marks the fighter you play, with Select disabled for it", () => {
    const html = rosterMarkup(rosterView("voltkit"), data());
    expect(cards(html)).toHaveLength(FIGHTERS.length);
    expect(html).toMatch(/data-roster-card="voltkit"[\s\S]*?Playing/);
    expect(html).toMatch(
      /<button[^>]*disabled[^>]*data-roster-select="voltkit"/,
    );
    const other = rosterMarkup(rosterView("tidefin"), data());
    expect(other).toMatch(/data-roster-select="tidefin"/);
    expect(other).not.toMatch(/disabled[^>]*data-roster-select/);
    expect(other).toContain("3/9 looks");
  });
  it("can be a room's picker: the main button locks in instead", () => {
    const html = rosterMarkup(rosterView("voltkit"), data({ action: "lock" }));
    expect(html).toContain("Lock in");
    expect(html).not.toMatch(/disabled[^>]*data-roster-select/);
  });
});

describe("the fighter detail", () => {
  it("shows health, speed and basic damage against the roster's best", () => {
    for (const c of FIGHTERS)
      for (const [, value, max] of fighterStats(c)) {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThanOrEqual(max);
      }
    expect(fighterStats("voltkit")[0]).toEqual([
      "Health",
      CHARACTERS.voltkit.health,
      Math.max(...FIGHTERS.map((c) => CHARACTERS[c].health)),
    ]);
  });
  it("lists every skill with its key and cooldown, the basic attack and the raid tricks", () => {
    const html = rosterMarkup(
      rosterView("cindrake", { mode: "detail", tab: "skills" }),
      data(),
    );
    expect(html.match(/data-roster-skill="/g)).toHaveLength(5);
    for (const key of ["Q", "E", "R", "F", "LMB"])
      expect(html).toContain(`<span class="roster-key">${key}</span>`);
    expect(html).toContain("Ultimate");
    for (const s of CHARACTERS.cindrake.skills) expect(html).toContain(s.name);
    const tricks = raidTricks("cindrake");
    expect(tricks.length).toBe(
      Object.values(RAID_BOSS_PERKS).filter((p) => p?.cindrake).length,
    );
    for (const t of tricks) expect(html).toContain(t.text);
  });
  it("has Overview, Skills and Skins tabs, and Try skins beside Select", () => {
    for (const tab of ["overview", "skills", "skins"] as const) {
      const html = rosterMarkup(
        rosterView("voltkit", { mode: "detail", tab }),
        data(),
      );
      expect(html.match(/role="tab"/g)).toHaveLength(3);
      expect(html).toMatch(
        new RegExp(
          `data-ui-rtab="${tab}"[^>]*aria-selected="true"|aria-selected="true"[^>]*data-ui-rtab="${tab}"`,
        ),
      );
      expect(html).toContain('data-roster-skins="voltkit"');
      expect(html).toContain("data-roster-back");
    }
    const skins = rosterMarkup(
      rosterView("voltkit", { mode: "detail", tab: "skins" }),
      data(),
    );
    expect(skins.match(/class="roster-look( is-unowned)?"/g)).toHaveLength(
      looksOwned("voltkit", []).all,
    );
    expect(skins).toContain("Wearing");
  });
  it("puts the fighter on the stage in its worn skin, still on Low graphics", () => {
    const high = rosterMarkup(
      rosterView("voltkit", { mode: "detail" }),
      data(),
    );
    expect(high).toContain('data-preview-champion="voltkit"');
    expect(high).toContain('data-preview-item="voltkit-stormcrown"');
    expect(high).toContain('data-preview-stage="2"');
    expect(high).not.toContain("is-still");
    expect(
      rosterMarkup(
        rosterView("voltkit", { mode: "detail" }),
        data({ low: true }),
      ),
    ).toContain("roster-rig is-still");
  });
  it("renders every fighter and tab cleanly", () => {
    for (const c of FIGHTERS)
      for (const mode of ["grid", "detail"] as const)
        for (const tab of ["overview", "skills", "skins"] as const) {
          const html = rosterMarkup(
            rosterView(c, { mode, tab, skill: "basic" }),
            data({ owned: [], looks: {} }),
          );
          expect(html, `${c} ${mode} ${tab}`).not.toMatch(
            /undefined|NaN|\[object/,
          );
        }
  });
});

describe("the roster dresses fighters as the Wardrobe does", () => {
  const look = { skin: "candy-colours", aura: "galaxy-aura" } as const;
  it("hands the stage's rig your shared looks, with no element aura", () => {
    const html = rosterMarkup(
      rosterView("tidefin", { mode: "detail" }),
      data({ look }),
    );
    const handed = html.match(/data-preview-look="([^"]*)"/)![1];
    expect(JSON.parse(decodeURIComponent(handed))).toEqual(look);
    expect(html).not.toContain("trait-aura");
    // No fighter skin on Tidefin: your Colors tint its still art.
    expect(html).toContain("preview-palette-candy-colours");
  });
  it("lets a fighter skin win over Colors, on the stage and the cards", () => {
    const detail = rosterMarkup(
      rosterView("voltkit", { mode: "detail" }),
      data({ look }),
    );
    expect(detail).not.toMatch(
      /data-roster-region="stage"[\s\S]*preview-palette/,
    );
    const grid = rosterMarkup(rosterView("voltkit"), data({ look }));
    const card = (c: string) =>
      grid.match(new RegExp(`data-roster-card="${c}"[\\s\\S]*?</button>`))![0];
    expect(card("voltkit")).not.toContain("preview-palette");
    expect(card("tidefin")).toContain("preview-palette-candy-colours");
  });
});
