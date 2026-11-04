import { describe, expect, it } from "vitest";
import type { Economy } from "../../packages/shared/src/shop";
import {
  changesLeft,
  missionsMarkup,
  missionsView,
  streakLit,
  type MissionsView,
} from "../../apps/client/src/screens/missions-view";

// The Missions sheet (UI remodel step 4). These checks come from the old
// Missions dialog's tests (shop-ui.test.ts and mission-changes-ui.test.ts):
// what they checked stays, on the new markup.
const economy = (extra: Partial<Economy> = {}): Economy => ({
  balance: 2000,
  owned: [],
  picks: { day: "2026-10-21", items: [], deal: null },
  trialWins: {},
  awakening: {},
  looks: {},
  rerolled: false,
  rerollsUsed: 0,
  rerollLimit: 3,
  streak: 2,
  today: { raidClears: 1, pvpMatches: 3 },
  missions: [
    { day: "2026-10-21", slot: 0, id: "play-2", text: "Play 2 matches", tier: "easy", progress: 2, target: 2, coins: 40, done: true },
    { day: "2026-10-21", slot: 1, id: "pvp-wins-2", text: "Win 2 <b>matches</b>", tier: "medium", progress: 1, target: 2, coins: 70, done: false },
    { day: "2026-10-21", slot: 2, id: "raid-p3", text: "Clear any raid on Peril 3", tier: "hard", progress: 0, target: 1, coins: 120, done: false },
  ],
  ...extra,
});
const html = (e: Economy | null, view: Partial<MissionsView> = {}) =>
  missionsMarkup({ ...missionsView(), ...view }, { economy: e });
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const six = (e = economy()) => [
  ...e.missions,
  ...e.missions.map((m) => ({ ...m, slot: m.slot + 3, done: false, progress: 0 })),
];

describe("the Missions sheet", () => {
  it("is a sheet, with the server-clock countdown in its head", () => {
    const s = html(economy());
    expect(s).toContain('class="ui-panel ui-sheet missions-sheet"');
    expect(s).toMatch(/Daily · new in \d+( h \d+)? min/);
    expect(s).not.toMatch(/undefined|NaN|\[object/);
    expect(html(null)).toContain("Log in");
    expect(missionsMarkup(missionsView(), { economy: null, problem: "Database is old." })).toContain("Database is old.");
  });
  it("escapes mission text", () => {
    const s = html(economy());
    expect(s).toContain("Win 2 &lt;b&gt;matches&lt;/b&gt;");
    expect(s).not.toContain("<b>matches</b>");
  });
  it("shows each mission's difficulty, progress, coins and XP, and Paid for finished ones", () => {
    const s = html(economy());
    expect(count(s, /class="missions-row/g)).toBe(3);
    for (const tier of ["easy", "medium", "hard"]) expect(s).toContain(`data-tier="${tier}"`);
    expect(s).toContain("2/2");
    expect(s).toContain("1/2");
    expect(s).toContain("+50 XP");
    // Paid is a state, never a Claim button (decision 11).
    expect(count(s, /class="missions-paid"/g)).toBe(1);
    expect(s).not.toMatch(/Claim/i);
  });
  it("offers a change for unfinished missions while changes are left", () => {
    const s = html(economy());
    expect(count(s, /data-mission-change=/g)).toBe(2);
    expect(s).not.toContain('data-mission-change="0"');
    expect(s).toContain("3 changes left");
    expect(s).toContain("changing a mission resets its progress");
    for (const used of [0, 1, 2]) {
      const e = economy({ rerollsUsed: used, rerolled: used > 0 });
      expect(changesLeft(e)).toBe(3 - used);
      expect(count(html(e), /data-mission-change=/g)).toBe(2);
    }
  });
  it("hides changes when all are spent", () => {
    const e = economy({ rerollsUsed: 3, rerolled: true });
    expect(html(e)).not.toContain("data-mission-change");
    expect(html(e)).toContain("0 changes left");
    expect(html(e)).toContain("Paid");
  });
  it("keeps the old one-change allowance until migration 023 is applied", () => {
    for (const rerolled of [false, true]) {
      const e = economy({ rerollLimit: undefined, rerollsUsed: undefined, rerolled });
      expect(changesLeft(e)).toBe(rerolled ? 0 : 1);
      expect(html(e)).toContain("1 free mission change per day");
      expect(html(e).includes("data-mission-change")).toBe(!rerolled);
    }
  });
  it("marks missions that need other people and offers a solo swap", () => {
    const s = html(economy());
    expect(s).toContain("With others");
    expect(s).toContain("Swap for a solo mission");
  });
  it("gives every mission its own how-to, opened from its row", () => {
    const closed = html(economy());
    expect(count(closed, /data-mission-help=/g)).toBe(3);
    expect(count(closed, /aria-expanded="false"/g)).toBe(3);
    for (const slot of [0, 1, 2]) {
      expect(closed).toContain(`aria-controls="mission-guide-${slot}"`);
      expect(count(closed, new RegExp(`id="mission-guide-${slot}"`, "g"))).toBe(1);
    }
    expect(closed).toContain("How to complete: Win 2 &lt;b&gt;matches&lt;/b&gt;");
    expect(closed).toContain("Solo test mode and attack practice do not count");
    expect(count(closed, /class="missions-guide"[^>]*hidden/g)).toBe(3);
    const open = html(economy(), { help: 1 });
    expect(count(open, /aria-expanded="true"/g)).toBe(1);
    expect(count(open, /class="missions-guide"[^>]*hidden/g)).toBe(2);
    expect(open).toContain("room with no bots");
  });
  it("waits on every change button while one change is on its way", () => {
    const s = html(economy(), { busy: 1 });
    expect(count(s, /data-mission-change="\d" disabled/g)).toBe(2);
    expect(s).toContain('aria-busy="true"');
    expect(html(economy(), { status: "New mission ready." })).toContain("New mission ready.");
  });
  it("shows six missions, the all-six bonus and the 7-day streak", () => {
    for (let used = 0; used <= 5; used++) {
      const e = economy({ missions: six(), rerollLimit: 5, rerollsUsed: used });
      const s = html(e);
      expect(count(s, /class="missions-row/g)).toBe(6);
      expect(s).toContain("1/6</b> done");
      expect(s).toContain("all 6:");
      expect(s).toContain(`${5 - used} change${5 - used === 1 ? "" : "s"} left`);
      expect(s).toContain("Finish all 6 every day: the 7th day pays +300.");
      expect(count(s, /data-mission-change=/g)).toBe(used === 5 ? 0 : 5);
      for (let slot = 0; slot < 6; slot++)
        expect(count(s, new RegExp(`id="mission-guide-${slot}"`, "g"))).toBe(1);
    }
    const complete = html(
      economy({ missions: six().map((m) => ({ ...m, done: true, progress: m.target })), streak: 7, rerollLimit: 5 }),
    );
    expect(complete).toContain("All done for today");
    expect(complete).toContain("all 6 paid");
    expect(complete).not.toContain("data-mission-change=");
  });
  it("lights the streak track up to today", () => {
    const lit = (e: Economy) => count(html(e), /<i class="is-on/g);
    // Two days so far, today not finished: two lit.
    expect(streakLit(economy({ streak: 2 }))).toBe(2);
    expect(lit(economy({ streak: 2 }))).toBe(2);
    // A full week paid yesterday: today starts again.
    expect(lit(economy({ streak: 7 }))).toBe(0);
    const allDone = economy().missions.map((m) => ({ ...m, done: true, progress: m.target }));
    expect(lit(economy({ streak: 7, missions: allDone }))).toBe(7);
  });
  it("tells how many coins today's raids and real matches still pay", () => {
    expect(html(economy())).toContain("raid clears 1/5 paid, matches against players 3/10 paid");
  });
});
