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
    expect((html.match(/data-spire-floor=/g) ?? []).length).toBe(10);
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
  it("shows floor 10 cleared, and checkpoint 1 until zone 2 exists", () => {
    const done = data({
      spire: climb({
        highestFloor: 10,
        checkpoint: 11,
        claimed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      }),
    });
    const html = page("floors", done);
    expect(html).toMatch(/sp-floor is-done" data-spire-floor="10"/);
    expect(page("climb", done)).toContain("from floor 1");
    expect(spireStartState({ play: "solo", status: "" }, done).note).toContain(
      "from floor 1",
    );
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
    const done = data({ spire: climb({ highestFloor: 10, checkpoint: 11 }) });
    expect(spirePreview(view, done).next).toBeUndefined();
    const html = spireMarkup(view, done);
    expect(html).toContain("All 10 floors conquered!");
    expect(html).toContain("Spire conquered");
    expect(html).not.toContain("Next uncleared");
    expect(html).toContain("Climb from floor 1");
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
