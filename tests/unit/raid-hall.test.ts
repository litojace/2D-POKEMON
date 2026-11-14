import { describe, expect, it } from "vitest";
import type { Friend } from "../../packages/shared/src/accounts";
import {
  RAID_BOSSES,
  RAID_BOSS_ORDER,
  raidAttacksOf,
  type RaidProgress,
} from "../../packages/shared/src/raid";
import {
  bossTricks,
  canInvite,
  hallBosses,
  practiceAttack,
  raidMarkup,
  raidSeats,
  raidUnlocked,
  raidView,
  rewardCounts,
  startState,
  type RaidData,
} from "../../apps/client/src/screens/raid-hall-view";

// Raids (UI remodel step 5): the Raid Hall and the boss pages. The reward
// checks come from the old Raid Hub's tests (raid-lobby.test.ts): what they
// checked stays, on the new markup.
const progress = (extra: Partial<RaidProgress> = {}): RaidProgress => ({
  clears: 0,
  highestPeril: 0,
  bestSeconds: 0,
  titles: [],
  cosmetics: [],
  weekly: [],
  ...extra,
});
const data = (extra: Partial<RaidData> = {}): RaidData => ({
  progress: progress(),
  loading: false,
  problem: "",
  me: { name: "tester", character: "voltkit" },
  party: [],
  leader: true,
  friends: [],
  inRoom: false,
  ...extra,
});
const friend = (extra: Partial<Friend>): Friend => ({
  id: "f1",
  name: "Kai",
  online: true,
  activity: "lobby",
  fighter: "cindrake",
  ...extra,
});
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const rewards = (p: RaidProgress) =>
  raidMarkup(
    raidView("grumblecrag", { mode: "boss", tab: "rewards" }),
    data({ progress: p }),
  );

describe("the Raid Hall", () => {
  it("shows every boss and Attack practice; the others open after Grumblecrag", () => {
    const html = raidMarkup(raidView(), data());
    expect(count(html, /data-raid-card="/g)).toBe(RAID_BOSS_ORDER.length);
    expect(html).toContain("data-raid-practice-card");
    // New players: one open boss, the rest say why they are locked.
    expect(count(html, /Clear Cragmuff first/g)).toBe(
      RAID_BOSS_ORDER.length - 1,
    );
    expect(raidUnlocked(null, "grumblecrag")).toBe(true);
    expect(raidUnlocked(progress(), "tidewyrm")).toBe(false);
    const after = progress({
      bosses: { grumblecrag: { clears: 3, highestPeril: 3 } },
    });
    expect(raidUnlocked(after, "tidewyrm")).toBe(true);
    const open = raidMarkup(raidView(), data({ progress: after }));
    expect(open).not.toContain("Clear Cragmuff first");
    expect(open).toContain("3 clears");
    expect(count(open, />New</g)).toBe(RAID_BOSS_ORDER.length - 1);
  });
  it("filters by not cleared and by stars", () => {
    const p = progress({
      bosses: {
        grumblecrag: { clears: 2, highestPeril: 3 },
        emberwing: { clears: 1, highestPeril: 3 },
      },
    });
    expect(hallBosses("all", p)).toEqual(RAID_BOSS_ORDER);
    const open = hallBosses("open", p);
    expect(open).not.toContain("grumblecrag");
    expect(open).not.toContain("emberwing");
    expect(open.length).toBe(RAID_BOSS_ORDER.length - 2);
    for (const stars of [1, 2, 3] as const)
      expect(
        hallBosses(String(stars) as "1" | "2" | "3", p).every(
          (id) => RAID_BOSSES[id].stars === stars,
        ),
      ).toBe(true);
    // Nothing left: an empty state with a way back to every boss.
    const none = raidMarkup(
      raidView("grumblecrag", { filter: "open" }),
      data({
        progress: progress({
          bosses: Object.fromEntries(
            RAID_BOSS_ORDER.map((id) => [id, { clears: 1, highestPeril: 3 }]),
          ),
        }),
      }),
    );
    expect(none).toContain("Every boss here is cleared");
    expect(none).toContain('data-raid-filter="all"');
  });
  it("shows three fighters with a trick on each card, and the rewards earned", () => {
    for (const id of RAID_BOSS_ORDER) {
      expect(bossTricks(id).length).toBeGreaterThan(0);
      expect(rewardCounts(progress(), id).earned).toBe(0);
    }
    const html = raidMarkup(raidView(), data());
    const card = html
      .split('data-raid-card="grumblecrag"')[1]
      .split("</button>")[0];
    expect(count(card, /class="ui-avatar"/g)).toBe(
      Math.min(3, bossTricks("grumblecrag").length),
    );
    expect(card).toContain(
      `0 / ${rewardCounts(null, "grumblecrag").total} rewards`,
    );
  });
});

describe("fresh records patch the screen in place", () => {
  // ui/patch.ts rebuilds a box whose children change in number: loading
  // and loaded must have the same shape, or the cards (their pictures and
  // focus) are thrown away when the server answers.
  const shape = (html: string) =>
    [
      ...html.matchAll(
        /<(section|div|p|button|header|footer)\b[^>]*class="([^"]*)"/g,
      ),
    ]
      .map((m) => m[2].split(" ")[0])
      .filter((c) => /^(rh-body|rh-notes|ui-grid|rh-status)$/.test(c))
      .join(",");
  it("in the hall and on a boss page", () => {
    const loading = data({ progress: null, loading: true, friends: null });
    const loaded = data({ progress: progress({ clears: 2 }) });
    expect(shape(raidMarkup(raidView(), loading))).toBe(
      shape(raidMarkup(raidView(), loaded)),
    );
    const boss = raidView("grumblecrag", { mode: "boss" });
    expect(shape(raidMarkup(boss, loading))).toBe(
      shape(raidMarkup({ ...boss, status: "Refused." }, loaded)),
    );
  });
});

describe("a boss page", () => {
  it("has the four tabs, and Practice drills the picked attack", () => {
    const view = raidView("grumblecrag", { mode: "boss" });
    const html = raidMarkup(view, data());
    for (const tab of ["party", "attacks", "rewards", "guide"])
      expect(html).toContain(`data-ui-raid-tab="${tab}"`);
    expect(practiceAttack(view)).toBe(raidAttacksOf("grumblecrag")[0]);
    view.attack = raidAttacksOf("grumblecrag")[2];
    expect(practiceAttack(view)).toBe(raidAttacksOf("grumblecrag")[2]);
    // An attack of another boss falls back to this boss's first.
    view.attack = raidAttacksOf("tidewyrm")[0];
    expect(practiceAttack(view)).toBe(raidAttacksOf("grumblecrag")[0]);
    view.tab = "attacks";
    view.attack = null;
    const attacks = raidMarkup(view, data());
    expect(count(attacks, /data-raid-attack="/g)).toBe(
      raidAttacksOf("grumblecrag").length,
    );
  });
  it("seats you and your party, with open seats to fill", () => {
    const alone = raidSeats(data());
    expect(alone).toHaveLength(1);
    expect(alone[0].me).toBe(true);
    const party = data({
      party: [
        {
          id: "a",
          name: "Kai",
          character: "cindrake",
          leader: true,
          me: false,
        },
        {
          id: "me",
          name: "tester",
          character: "tidefin",
          leader: false,
          me: true,
        },
      ],
      leader: false,
    });
    const seats = raidSeats(party);
    // You first, wearing the fighter you have picked now.
    expect(seats.map((s) => s.name)).toEqual(["tester", "Kai"]);
    expect(seats[0].character).toBe("voltkit");
    const html = raidMarkup(raidView("grumblecrag", { mode: "boss" }), party);
    expect(count(html, /data-raid-open-seat=/g)).toBe(2);
  });
  it("invites online friends who are free, not ones in a match or already here", () => {
    const d = data({
      party: [
        {
          id: "f3",
          name: "Rae",
          character: "tidefin",
          leader: true,
          me: false,
        },
      ],
    });
    expect(canInvite(friend({}), d)).toBe(true);
    expect(canInvite(friend({ activity: "match" }), d)).toBe(false);
    expect(canInvite(friend({ online: false }), d)).toBe(false);
    expect(canInvite(friend({ id: "f3" }), d)).toBe(false);
    const html = raidMarkup(
      raidView("grumblecrag", { mode: "boss", invited: ["f2"] }),
      data({
        friends: [
          friend({}),
          friend({ id: "f2", name: "Mina" }),
          friend({ id: "f4", name: "Juniper", online: false }),
        ],
      }),
    );
    expect(html).toContain('aria-label="Invite Kai"');
    expect(html).toContain('aria-label="Invited Mina"');
    // Offline friends aren't offered.
    expect(html).not.toContain("Juniper");
  });
  it("says why a raid can't start, and what Solo and With party do", () => {
    const v = raidView("tidewyrm", { mode: "boss" });
    expect(startState(v, data()).reason).toBe(
      "Clear Cragmuff once to unlock Tidewyrm.",
    );
    const g = raidView("grumblecrag", { mode: "boss" });
    expect(startState(g, data()).ok).toBe(true);
    expect(startState(g, data()).play).toBe("solo");
    expect(startState(g, data({ inRoom: true })).reason).toBe(
      "Leave your current room first.",
    );
    const member = data({
      party: [
        {
          id: "a",
          name: "Kai",
          character: "cindrake",
          leader: true,
          me: false,
        },
        {
          id: "me",
          name: "tester",
          character: "voltkit",
          leader: false,
          me: true,
        },
      ],
      leader: false,
    });
    expect(startState(g, member).reason).toBe(
      "Your party leader starts the raid.",
    );
    // A leader with a party raids with it: Solo is off.
    const lead = { ...member, leader: true };
    expect(startState(g, lead)).toMatchObject({
      ok: true,
      play: "party",
      soloLocked: true,
    });
    const html = raidMarkup(g, lead);
    expect(html).toContain('data-raid-start="party"');
    expect(html).toMatch(/data-ui-raid-play="solo"[^>]*disabled/);
  });
});

describe("a boss's rewards", () => {
  it("marks earned rewards and shows the next ones", () => {
    const html = rewards(
      progress({
        clears: 1,
        highestPeril: 1,
        bestSeconds: 60,
        titles: ["Cragbreaker"],
      }),
    );
    // The first clear earns the title and (one difficulty) the entrance.
    expect(count(html, /class="rh-reward is-done"/g)).toBe(2);
    expect(html).toContain("1/5 clears");
    // Before migration 008 the lifetime titles say when they start counting.
    expect(html).toContain("Counts from the next raid update");
  });
  it("shows exact title progress", () => {
    const html = rewards(
      progress({
        clears: 10,
        highestPeril: 3,
        bestSeconds: 60,
        cosmetics: [
          "cragbound",
          "cragstone",
          "mountain-aura",
          "mountainborn",
          "conqueror",
        ],
        pillars: 7,
        revives: 25,
        runs: 14,
      }),
    );
    expect(html).toContain("7/25 pillars baited");
    expect(html).toContain("20/20 revives");
    // What you earn is worn from the Wardrobe.
    expect(html).toContain("data-raid-wardrobe");
  });
  it("asks you to log in to see progress", () => {
    const html = raidMarkup(
      raidView("grumblecrag", { mode: "boss", tab: "rewards" }),
      data({ progress: null }),
    );
    expect(html).toContain("Log in to see your progress.");
  });
});
