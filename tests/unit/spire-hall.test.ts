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
    // Both zones, each under its own heading.
    expect((html.match(/data-spire-floor=/g) ?? []).length).toBe(20);
    expect(html).toContain('data-spire-zone-floors="1"');
    expect(html).toContain('data-spire-zone-floors="2"');
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
    expect(fresh).toContain("Conquer zone 1 first");
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
    // Zone 2's floors are locked until then, Tidelotl's Ascendant at the top.
    const floors = page("floors");
    expect(floors).toMatch(/sp-floor is-locked" data-spire-floor="11"/);
    expect(floors).toContain("Ascendant Tidelotl");
    expect(floors).toContain("Breaker Wall");
    expect(floors).toContain("Tidecaller of the Spire");
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
