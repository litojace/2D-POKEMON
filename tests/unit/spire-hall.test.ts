import { expandedSpire } from "../fixtures/spire-catalogue";
import { spireModel } from "../../apps/client/src/screens/spire-model";
import { describe, expect, it } from "vitest";
import type { RaidProgress } from "../../packages/shared/src/raid";
import type { SpireProgress } from "../../packages/shared/src/spire";
import {
  raidMarkup,
  raidView,
  type RaidData,
} from "../../apps/client/src/screens/raid-hall-view";
import {
  spireStartState,
  spirePreview,
  spireMarkup,
  spireUnlocked,
  spireZoneChoice,
} from "../../apps/client/src/screens/spire-view";

// The Spire in the Raid Hub: the last tile of the boss list, locked until
// a Cragmuff clear, with your climb on it; its page and its Start button.
const progress = (clears: number): RaidProgress => ({
  clears,
  highestPeril: 0,
  bestSeconds: 0,
  titles: [],
  cosmetics: [],
  weekly: [],
  bosses: clears
    ? {
        grumblecrag: {
          clears,
          highestPeril: 3,
          bestSeconds: 200,
          runs: clears,
        },
      }
    : {},
});
const climb = (extra: Partial<SpireProgress> = {}): SpireProgress => ({
  season: 0,
  highestFloor: 4,
  checkpoint: 1,
  attempts: 3,
  claimed: [1, 2, 3, 4],
  ...extra,
});
const data = (extra: Partial<RaidData> = {}): RaidData => ({
  progress: progress(1),
  spire: climb(),
  loading: false,
  problem: "",
  me: { name: "tester", character: "voltkit" },
  party: [],
  leader: true,
  friends: [],
  inRoom: false,
  ...extra,
});
const hall = (d: RaidData, filter: "all" | "open" = "all") =>
  raidMarkup(raidView("grumblecrag", { filter }), d);

describe("the Spire tile", () => {
  it("is the last tile of the boss list", () => {
    const html = hall(data());
    const grid = html.slice(html.indexOf('class="ui-grid rh-grid"'));
    const tiles = [...grid.matchAll(/data-raid-(card="[^"]+"|spire)/g)].map(
      (m) => m[1],
    );
    expect(tiles).toHaveLength(8);
    expect(tiles.at(-1)).toBe("spire");
  });
  it("shows your floor and checkpoint", () => {
    const html = hall(data());
    expect(html).toContain("Floor 4 · Checkpoint 1");
    expect(html).toContain('aria-label="The Spire, floor 4, checkpoint 1"');
    expect(html).not.toMatch(/rh-spire-card is-locked/);
  });
  it("is locked until a Cragmuff clear, and says so", () => {
    for (const d of [
      data({ progress: progress(0), spire: climb({ clears: {} }) }),
      data({ progress: null, spire: null }),
    ]) {
      const html = hall(d);
      expect(html).toMatch(/rh-spire-card is-locked/);
      expect(html).toContain("Clear Cragmuff first");
      expect(html).toContain(
        'aria-label="The Spire, locked: clear Cragmuff first"',
      );
      expect(spireUnlocked(d)).toBe(false);
    }
    // The server's own count of clears opens it too.
    expect(
      spireUnlocked(
        data({ progress: null, spire: climb({ clears: { grumblecrag: 1 } }) }),
      ),
    ).toBe(true);
  });
  it("only shows with every boss (not under a filter)", () => {
    expect(hall(data(), "open")).not.toContain("data-raid-spire");
  });
});

describe("the Spire page", () => {
  const page = (tab: "climb" | "floors" | "blessings", d = data()) =>
    raidMarkup(raidView("grumblecrag", { mode: "spire", spireTab: tab }), d);
  it("has Climb, Floors and Blessings tabs, and starts a climb", () => {
    const html = page("climb");
    expect(html).toContain('data-raid-mode="spire"');
    for (const tab of ["climb", "floors", "blessings"])
      expect(html).toContain(`data-ui-spire-tab="${tab}"`);
    expect(html).toMatch(/data-raid-start="solo"(?![^>]*disabled)/);
    expect(html).toContain("from floor 1");
  });
  it("lists each floor with its state and first-clear reward", () => {
    const html = page("floors");
    // Every zone, each under its own heading.
    expect((html.match(/data-spire-floor=/g) ?? []).length).toBe(70);
    expect(html).toContain('data-spire-zone-floors="1"');
    expect(html).toContain('data-spire-zone-floors="2"');
    expect(html).toContain('data-spire-zone-floors="3"');
    expect(html).toContain('data-spire-zone-floors="4"');
    expect(html).toContain('data-spire-zone-floors="5"');
    expect(html).toContain('data-spire-zone-floors="6"');
    expect(html).toContain('data-spire-zone-floors="7"');
    expect(html).toContain("Stormbreaker of the Spire");
    expect(html).toMatch(/sp-floor is-done" data-spire-floor="4"/);
    expect(html).toMatch(/sp-floor is-next" data-spire-floor="5"/);
    expect(html).toMatch(/sp-floor is-locked" data-spire-floor="6"/);
    // Floor 10: the Ascendant Cragmuff, built now (its title shown).
    expect(html).toMatch(/sp-floor is-locked" data-spire-floor="10"/);
    expect(html).not.toContain("is-soon");
    expect(html).toContain("Ascendant Cragmuff");
    expect(html).toContain("Earthshaker of the Spire");
    expect(html).toContain("Echo Breaker");
  });
  it("shows floor 10 cleared, and opens zone 2 from checkpoint 11", () => {
    const done = data({
      spire: climb({
        highestFloor: 10,
        checkpoint: 11,
        claimed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      }),
    });
    const html = page("floors", done);
    expect(html).toMatch(/sp-floor is-done" data-spire-floor="10"/);
    expect(html).toMatch(/sp-floor is-next" data-spire-floor="11"/);
    // The climb starts in zone 2 by default; zone 1 can be picked again.
    expect(page("climb", done)).toContain("from floor 11");
    expect(spireStartState({ play: "solo", status: "" }, done)).toMatchObject({
      ok: true,
      zone: 2,
    });
    expect(
      spireStartState({ play: "solo", status: "", spireZone: 1 }, done),
    ).toMatchObject({ ok: true, zone: 1 });
    expect(
      spireStartState({ play: "solo", status: "", spireZone: 1 }, done).note,
    ).toContain("from floor 1 ");
  });
  it("offers zone 1 always and zone 2 once its checkpoint is earned (the zone picker)", () => {
    const climbPage = (d: RaidData, zone?: number) =>
      raidMarkup(
        raidView("grumblecrag", {
          mode: "spire",
          spireTab: "climb",
          spireZone: zone,
        }),
        d,
      );
    // Checkpoint 1: zone 2 is shown, locked.
    const fresh = climbPage(data());
    expect(fresh).toMatch(/data-ui-spire-zone="1" aria-pressed="true"/);
    expect(fresh).toMatch(
      /data-ui-spire-zone="2" aria-pressed="false" disabled/,
    );
    // (Said by the locked chip, to touch, a pointer and a screen reader.)
    expect(fresh).toContain("conquer zone 1 first");
    // Asking for zone 2 without the checkpoint still climbs zone 1.
    expect(spireZoneChoice({ spireZone: 2 }, data())).toMatchObject({
      zone: 1,
      start: 1,
    });
    const at11 = data({ spire: climb({ highestFloor: 12, checkpoint: 11 }) });
    const open = climbPage(at11);
    expect(open).toMatch(/data-ui-spire-zone="2" aria-pressed="true"/);
    expect(open).not.toMatch(/data-ui-spire-zone="2"[^>]*disabled/);
    expect(open).toContain("Zone 2 · Water");
    expect(climbPage(at11, 1)).toMatch(
      /data-ui-spire-zone="1" aria-pressed="true"/,
    );
    expect(climbPage(at11, 1)).toContain("Zone 1 · Earth");
    // One zone control: the preview and milestones follow the zone picked,
    // and a preview never changes where the climb starts.
    const solo = { play: "solo" as const, status: "" };
    expect(spirePreview(solo, at11).selected.floor).toBe(13);
    expect(spirePreview({ ...solo, spireZone: 1 }, at11).selected.floor).toBe(
      1,
    );
    const zone1 = climbPage(at11, 1);
    expect(zone1).toContain('data-spire-preview="10"');
    expect(zone1).not.toContain('data-spire-preview="11"');
    expect(zone1).not.toContain("data-spire-zone=");
    expect(
      spireStartState({ ...solo, spireZone: 2, spireFloor: 4 }, at11),
    ).toMatchObject({ zone: 2, from: 11 });
    // Zone 2's floors are locked until then, Tidelotl's Ascendant at the top.
    const floors = page("floors");
    expect(floors).toMatch(/sp-floor is-locked" data-spire-floor="11"/);
    expect(floors).toContain("Ascendant Tidelotl");
    expect(floors).toContain("Breaker Wall");
    expect(floors).toContain("Tidecaller of the Spire");
  });
  it("offers zone 3 once zone 2 is conquered (checkpoint 21), locked before", () => {
    const climbPage = (d: RaidData, zone?: number) =>
      raidMarkup(
        raidView("grumblecrag", {
          mode: "spire",
          spireTab: "climb",
          spireZone: zone,
        }),
        d,
      );
    // Checkpoint 11: zone 3 is shown, locked ("Conquer zone 2 first").
    const at11 = data({ spire: climb({ highestFloor: 14, checkpoint: 11 }) });
    const locked = climbPage(at11);
    expect(locked).toMatch(
      /data-ui-spire-zone="3" aria-pressed="false" disabled/,
    );
    expect(locked).toContain("conquer zone 2 first");
    expect(spireZoneChoice({ spireZone: 3 }, at11)).toMatchObject({
      zone: 2,
      start: 11,
    });
    // Checkpoint 21: zone 3 by default, from floor 21.
    const at21 = data({
      spire: climb({
        highestFloor: 20,
        checkpoint: 21,
        claimed: Array.from({ length: 20 }, (_, i) => i + 1),
      }),
    });
    const open = climbPage(at21);
    expect(open).toMatch(/data-ui-spire-zone="3" aria-pressed="true"/);
    expect(open).not.toMatch(/data-ui-spire-zone="3"[^>]*disabled/);
    expect(open).toContain("Zone 3 · Shadow");
    expect(open).toContain("from floor 21");
    expect(spireStartState({ play: "solo", status: "" }, at21)).toMatchObject({
      ok: true,
      zone: 3,
      from: 21,
    });
    // Its floors: the next is 21, the elite on 25, Inkpurr's Ascendant on 30.
    const floors = page("floors", at21);
    expect(floors).toMatch(/sp-floor is-next" data-spire-floor="21"/);
    expect(floors).toMatch(/sp-floor is-locked" data-spire-floor="25"/);
    expect(floors).toContain("Zone 3 · Lantern Yard · Shadow");
    expect(floors).toContain("The Lightless Ring");
    expect(floors).toContain("Ascendant Inkpurr");
    expect(floors).toContain("Lanternbane of the Spire");
    // Floor 30 needs Inkpurr's raid cleared, like every boss floor.
    expect(floors).toMatch(/data-spire-floor="30"[\s\S]*?Clear its raid first/);
  });
  it("offers zone 4 once zone 3 is conquered (checkpoint 31), locked before", () => {
    const climbPage = (d: RaidData, zone?: number) =>
      raidMarkup(
        raidView("grumblecrag", {
          mode: "spire",
          spireTab: "climb",
          spireZone: zone,
        }),
        d,
      );
    // Checkpoint 21: zone 4 is shown, locked ("Conquer zone 3 first").
    const at21 = data({ spire: climb({ highestFloor: 24, checkpoint: 21 }) });
    const locked = climbPage(at21);
    expect(locked).toMatch(
      /data-ui-spire-zone="4" aria-pressed="false" disabled/,
    );
    expect(locked).toContain("conquer zone 3 first");
    expect(spireZoneChoice({ spireZone: 4 }, at21)).toMatchObject({
      zone: 3,
      start: 21,
    });
    // Checkpoint 31: zone 4 by default, from floor 31.
    const at31 = data({
      spire: climb({
        highestFloor: 30,
        checkpoint: 31,
        claimed: Array.from({ length: 30 }, (_, i) => i + 1),
      }),
    });
    const open = climbPage(at31);
    expect(open).toMatch(/data-ui-spire-zone="4" aria-pressed="true"/);
    expect(open).not.toMatch(/data-ui-spire-zone="4"[^>]*disabled/);
    expect(open).toContain("Zone 4 · Psychic");
    expect(open).toContain("from floor 31");
    expect(spireStartState({ play: "solo", status: "" }, at31)).toMatchObject({
      ok: true,
      zone: 4,
      from: 31,
    });
    // Its floors: the next is 31, the elite on 35, Snoozaku's Ascendant on 40.
    const floors = page("floors", at31);
    expect(floors).toMatch(/sp-floor is-next" data-spire-floor="31"/);
    expect(floors).toMatch(/sp-floor is-locked" data-spire-floor="35"/);
    expect(floors).toContain("Zone 4 · Cloud Deck · Psychic");
    expect(floors).toContain("The Starfall Ring");
    expect(floors).toContain("Ascendant Snoozaku");
    expect(floors).toContain("Twin Dream");
    expect(floors).toContain("Dream Tide");
    expect(floors).toContain("Dreambreaker of the Spire");
    // Floor 40 needs Snoozaku's raid cleared, like every boss floor.
    expect(floors).toMatch(/data-spire-floor="40"[\s\S]*?Clear its raid first/);
  });
  it("offers zone 5 once zone 4 is conquered (checkpoint 41), locked before", () => {
    const climbPage = (d: RaidData, zone?: number) =>
      raidMarkup(
        raidView("grumblecrag", {
          mode: "spire",
          spireTab: "climb",
          spireZone: zone,
        }),
        d,
      );
    // Checkpoint 31: zone 5 is shown, locked ("conquer zone 4 first").
    const at31 = data({ spire: climb({ highestFloor: 34, checkpoint: 31 }) });
    const locked = climbPage(at31);
    expect(locked).toMatch(
      /data-ui-spire-zone="5" aria-pressed="false" disabled/,
    );
    expect(locked).toContain(
      'aria-label="Zone 5, Sun Atrium, Light. Locked: conquer zone 4 first"',
    );
    expect(spireZoneChoice({ spireZone: 5 }, at31)).toMatchObject({
      zone: 4,
      start: 31,
    });
    // Checkpoint 41: zone 5 by default, from floor 41.
    const at41 = data({
      spire: climb({
        highestFloor: 40,
        checkpoint: 41,
        claimed: Array.from({ length: 40 }, (_, i) => i + 1),
      }),
    });
    const open = climbPage(at41);
    expect(open).toMatch(/data-ui-spire-zone="5" aria-pressed="true"/);
    expect(open).not.toMatch(/data-ui-spire-zone="5"[^>]*disabled/);
    expect(open).toContain("Zone 5 · Light");
    expect(open).toContain("from floor 41");
    // The picked zone said once beside the chips.
    expect(open).toMatch(
      /class="sp-zone-info"[\s\S]*?Sun Atrium[\s\S]*?Floors 41–50 · Ascendant Prismell/,
    );
    expect(spireStartState({ play: "solo", status: "" }, at41)).toMatchObject({
      ok: true,
      zone: 5,
      from: 41,
    });
    // Its floors: the next is 41, the elite on 45, Prismell's Ascendant on 50.
    const floors = page("floors", at41);
    expect(floors).toMatch(/sp-floor is-next" data-spire-floor="41"/);
    expect(floors).toMatch(/sp-floor is-locked" data-spire-floor="45"/);
    expect(floors).toContain("Zone 5 · Sun Atrium · Light");
    expect(floors).toContain("The Lancer&#39;s Ring");
    expect(floors).toContain("Ascendant Prismell");
    expect(floors).toContain("Sunbreaker of the Spire");
    expect(floors).toMatch(/data-spire-floor="50"[\s\S]*?Clear its raid first/);
  });
  it("shows up to seven zones as one row of chips, the picked one named once", () => {
    const content = expandedSpire(7);
    const d = data({ spire: climb({ highestFloor: 44, checkpoint: 41 }) });
    const html = spireMarkup({ play: "solo", status: "" }, d, content);
    const picker = html.match(/<div class="sp-zones"[\s\S]*?<\/p><\/div>/)![0];
    expect(picker).toContain('data-zones="7"');
    const chips = [
      ...picker.matchAll(/<button[^>]*data-ui-spire-zone="(\d)"[^>]*>/g),
    ];
    expect(chips.map((c) => c[1])).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    // Zones 1–5 open (checkpoint 41), 6 and 7 locked with their reason.
    for (const [chip, id] of chips) {
      expect(chip).toMatch(/aria-label="Zone \d, /);
      if (Number(id) > 5) {
        expect(chip).toMatch(/aria-pressed="false" disabled/);
        expect(chip).toContain(`Locked: conquer zone ${Number(id) - 1} first`);
      } else expect(chip).not.toContain("disabled");
    }
    expect(picker.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(picker).toMatch(/data-ui-spire-zone="5" aria-pressed="true"/);
    // A chip shows its number and glyph only (long names would crowd a
    // phone); the picked zone's name is said once, beside the row.
    const shown = picker
      .replace(/<button[^>]*>/g, "<button>")
      .replace(/<svg[\s\S]*?<\/svg>/g, "");
    expect(
      shown.match(/Tidal Archives beyond the Moonlit Observatory/g),
    ).toHaveLength(1);
    expect(shown).toMatch(/sp-zone-info[\s\S]*Zone 5<\/span> Tidal Archives/);
  });

  it("shows every blessing in its codex", () => {
    expect(
      (page("blessings").match(/data-spire-blessing-info=/g) ?? []).length,
    ).toBe(10);
  });
  it("can't start locked, from a room, or for someone who doesn't lead", () => {
    const view = { play: "solo" as const, status: "" };
    expect(
      spireStartState(view, data({ progress: progress(0), spire: null })),
    ).toMatchObject({
      ok: false,
      reason: "Clear Cragmuff once to open the Spire.",
    });
    expect(spireStartState(view, data({ inRoom: true })).ok).toBe(false);
    expect(spireStartState(view, data({ leader: false })).ok).toBe(false);
    const locked = page("climb", data({ progress: progress(0), spire: null }));
    expect(locked).toMatch(
      /data-raid-start="solo" disabled|disabled[^>]*data-raid-start/,
    );
  });
});

describe("Spire progress and floor previews", () => {
  const view = { play: "solo" as const, status: "" };
  it("opens the next uncleared floor while preserving the restart checkpoint", () => {
    expect(spirePreview(view, data()).selected.floor).toBe(5);
    const html = spireMarkup(view, data());
    expect(html).toContain("Next uncleared · Floor 5");
    expect(html).toContain("The Captain&#39;s Ring");
    expect(html).toContain("Echo Captain Wombolder");
    expect(html).toContain("Climb from floor 1");
    expect(html).toContain('value="4" aria-label="Floors cleared"');
    expect(html).toContain(
      '<details class="sp-guide"><summary>How to play</summary>',
    );
  });
  it("previews a locked boss and its title without changing where you start", () => {
    const html = spireMarkup({ ...view, spireFloor: 10 }, data());
    expect(html).toContain("Floor preview · Floor 10");
    expect(html).toContain("Ascendant Cragmuff");
    expect(html).toContain("Earthshaker of the Spire");
    expect(html).toContain("Clear floor 9 first");
    expect(html).toContain("Climb from floor 1");
    expect(html).not.toContain("Climb from floor 10");
    expect(html).toContain('data-spire-preview="10" aria-pressed="true"');
  });
  it("marks claimed rewards, rather than presenting them as available again", () => {
    const html = spireMarkup({ ...view, spireFloor: 1 }, data());
    expect(html).toContain("First-clear reward claimed");
    expect(html).toContain("Floor preview · Floor 1");
  });
  it("shows a fresh climb and handles a fully conquered tower without a phantom floor", () => {
    const fresh = data({ spire: climb({ highestFloor: 0, claimed: [] }) });
    expect(spirePreview(view, fresh).selected.floor).toBe(1);
    // Every released zone conquered: no next floor; climb any zone again
    // (the highest by default, zone 1 when picked).
    // (Floor 70 cleared: the database keeps checkpoint 61, there is no 71.)
    const done = data({ spire: climb({ highestFloor: 70, checkpoint: 61 }) });
    expect(spirePreview(view, done).next).toBeUndefined();
    const html = spireMarkup(view, done);
    expect(html).toContain("The Spire is yours!");
    expect(html).toContain("All 7 zones and 70 floors conquered.");
    expect(html).toContain("Spire conquered");
    expect(html).not.toContain("Next uncleared");
    expect(html).toContain("Climb from floor 61");
    // Every zone's chip says it is conquered.
    expect((html.match(/class="sp-zone[^"]*is-conquered/g) ?? []).length).toBe(
      7,
    );
    expect(html).toMatch(/Ascendant Storm Twins at the top, conquered/);
    // Zone 6 conquered, zone 7 not climbed yet: no celebration, 61 next.
    const six = data({ spire: climb({ highestFloor: 60, checkpoint: 61 }) });
    expect(spirePreview(view, six).next?.floor).toBe(61);
    const sixHtml = spireMarkup(view, six);
    expect(sixHtml).not.toContain("The Spire is yours!");
    expect(
      (sixHtml.match(/class="sp-zone[^"]*is-conquered/g) ?? []).length,
    ).toBe(6);
    expect(spireMarkup({ ...view, spireZone: 1 }, done)).toContain(
      "Climb from floor 1<",
    );
  });
  it("falls back to the next floor for an invalid preview", () => {
    expect(
      spirePreview({ ...view, spireFloor: 999 }, data()).selected.floor,
    ).toBe(5);
    expect(
      spirePreview({ ...view, spireFloor: NaN }, data()).selected.floor,
    ).toBe(5);
  });
  it("keeps party starts tied to the party checkpoint rather than the preview", () => {
    const html = spireMarkup(
      { ...view, play: "party", spireFloor: 10 },
      data(),
    );
    expect(html).toContain("Start party climb");
    expect(html).not.toContain("Climb from floor 10");
  });
});

describe("Spire content expansion", () => {
  const view = { play: "solo" as const, status: "" };
  const later = () =>
    data({
      spire: climb({
        highestFloor: 11,
        checkpoint: 11,
        claimed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      }),
    });
  it("derives a second zone, its progress and restart point from content", () => {
    const content = expandedSpire();
    const model = spireModel(view, later(), content);
    expect(model.next?.floor.floor).toBe(12);
    expect(model.activeGroup.zone.id).toBe(2);
    expect(model.groups).toHaveLength(2);
    expect(model.activeGroup.floors).toHaveLength(10);
    const html = spireMarkup(view, later(), content);
    expect(html).toContain('max="20" value="11"');
    expect(html).toContain("Climb from floor 11");
    // One zone control: the zone to climb, which the preview follows.
    expect(html).toContain('data-ui-spire-zone="2" aria-pressed="true"');
    expect(html.match(/data-spire-preview=/g) ?? []).toHaveLength(10);
    const trail = html
      .split('class="sp-tower-trail"')[1]
      .split('class="rh-stage-info"')[0];
    expect(trail.match(/<span /g) ?? []).toHaveLength(10);
  });
  it("lists released floors from every zone instead of only Zone 1", () => {
    const html = spireMarkup(
      { ...view, spireTab: "floors" },
      later(),
      expandedSpire(),
    );
    expect(html.match(/data-spire-floor=/g) ?? []).toHaveLength(20);
    expect(html).toContain("Raid Coliseum");
    expect(html).toContain("Tidal Archives beyond the Moonlit Observatory");
    expect(html).toContain('data-spire-floor="20"');
  });
  it("uses a new boss's briefing, gate and rewards without inheriting Cragmuff copy", () => {
    const model = spireModel(
      { ...view, spireFloor: 20 },
      later(),
      expandedSpire(),
    );
    expect(model.selected.state.label).toBe("Clear its raid first");
    expect(model.selected.coins).toBe(150);
    expect(model.selected.title).toBe("Keeper of the Moonlit Tidal Archives");
    const html = spireMarkup(
      { ...view, spireFloor: 20 },
      later(),
      expandedSpire(),
    );
    expect(html).toContain("Pearl Cascade, Tidal Crown");
    expect(html).not.toContain("Avalanche Charge");
    expect(html).not.toContain("Twin Slam");
    expect(html).toContain("Climb from floor 11");
  });
  it("keeps unreleased zones out of navigation and total progress", () => {
    const content = { ...expandedSpire(), builtTop: 10 };
    const model = spireModel({ ...view, spireFloor: 20 }, data(), content);
    expect(model.groups).toHaveLength(1);
    expect(model.total).toBe(10);
    expect(model.selected.floor.floor).toBe(5);
    expect(model.floors.every((f) => f.floor.floor <= 10)).toBe(true);
  });
  it("keeps mobile milestones and painting dots bounded when many zones are added", () => {
    const content = expandedSpire(8);
    const d = data({ spire: climb({ highestFloor: 70, checkpoint: 71 }) });
    const model = spireModel(view, d, content);
    expect(model.groups).toHaveLength(8);
    expect(model.activeGroup.floors).toHaveLength(10);
    expect(model.next?.floor.floor).toBe(71);
    const html = spireMarkup(view, d, content);
    expect(html.match(/data-spire-preview=/g) ?? []).toHaveLength(10);
    expect(html.match(/data-ui-spire-zone=/g) ?? []).toHaveLength(8);
    expect(html).toContain("Climb from floor 71");
  });
});
