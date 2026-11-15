import { describe, expect, it } from "vitest";
import { checkName, type Progress } from "../../packages/shared/src/accounts";
import type { RaidProgress } from "../../packages/shared/src/raid";
import {
  bestMastery,
  profileMarkup,
  profileTiles,
  nameLockedFor,
  profileView,
  rankLine,
  type ProfileData,
  DELETE_WORD,
} from "../../apps/client/src/screens/profile-view";
import { cardSummary } from "../../apps/client/src/screens/profile-card";

// The player card and profile (UI remodel step 7). The old title picker's
// checks (tests/unit/title-picker.test.ts) moved here: one equipped title,
// "No title", each title's colour (bad colours never reach the style),
// escaping, and where titles come from when there are none.
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const titles = [
  {
    id: id(1),
    name: "Master",
    color: "#ffbc65",
    description: "Season rank.",
    active: true,
  },
  {
    id: id(2),
    name: "Mountain Conqueror",
    color: "#e8b06a",
    description: "Clear Grumblecrag.",
    active: true,
  },
  {
    id: id(3),
    name: "<b>Sneaky</b>",
    color: "nope",
    description: "",
    active: true,
  },
];
const progress: Progress = {
  matches: 31,
  wins: 20,
  achievements: [
    {
      id: "first-win",
      name: "First Victory",
      description: "Won a match.",
      earnedAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "wins-10",
      name: "Seasoned Brawler",
      description: "Won 10 matches.",
      earnedAt: null,
    },
  ],
  fighters: {
    voltkit: { matches: 31, wins: 20 },
    cindrake: { matches: 6, wins: 2 },
  },
  season: { id: "2026-11", matches: 3, wins: 1 },
  rating: {
    rating: 1110,
    matches: 62,
    peak: 1140,
    rank: "Expert",
    placementLeft: 0,
    next: { name: "Candidate Master", at: 1150 },
  },
};
const raids = {
  clears: 4,
  totalClears: 5,
  highestPeril: 3,
  bestSeconds: null,
  titles: [],
  cosmetics: [],
  weekly: [],
  bosses: {
    grumblecrag: { clears: 4, highestPeril: 3, bestSeconds: 90, runs: 6 },
    emberwing: { clears: 1, highestPeril: 3, bestSeconds: 200, runs: 2 },
  },
} as RaidProgress;
const data = (extra: Partial<ProfileData> = {}): ProfileData => ({
  name: "tester",
  title: "Mountain Conqueror",
  titleColor: "#e8b06a",
  titles,
  guest: false,
  role: "Player",
  email: "t@example.com",
  fighter: "voltkit",
  journey: {
    xp: 2600,
    recent: [],
    unlocked: [],
  } as unknown as ProfileData["journey"],
  progress,
  raids,
  nameStatus: null,
  canDelete: true,
  ...extra,
});
const html = (d = data(), v = profileView()) => profileMarkup(v, d);

describe("the numbers", () => {
  it("shows matches, wins, win rate and raid clears", () => {
    expect(
      profileTiles(progress, raids).map((t) => `${t.value} ${t.label}`),
    ).toEqual(["31 Matches", "20 Wins", "65% Win rate", "5 Raid clears"]);
    expect(
      profileTiles({ ...progress, matches: 0, wins: 0 }, null).map(
        (t) => t.value,
      ),
    ).toEqual(["0", "0", "0%", "–"]);
    expect(profileTiles(null, null).map((t) => t.value)).toEqual([
      "–",
      "–",
      "–",
      "–",
    ]);
  });
  it("names your best mastery and your rank", () => {
    expect(bestMastery(progress)).toEqual({
      id: "voltkit",
      text: "Gold Voltkit",
    });
    expect(
      bestMastery({
        ...progress,
        fighters: { voltkit: { matches: 2, wins: 0 } },
      }),
    ).toBeNull();
    expect(rankLine(progress)).toMatchObject({ text: "Expert · 1,110" });
    expect(
      rankLine({
        ...progress,
        rating: {
          rating: 1012,
          matches: 2,
          rank: "Unranked",
          placementLeft: 3,
        },
      })?.text,
    ).toBe("Unranked · 1,012");
    expect(rankLine({ ...progress, rating: undefined })).toBeNull();
  });
});

describe("the card", () => {
  it("shows your fighter, title, name, level, rank and best mastery", () => {
    const page = html();
    expect(page).toContain('data-fighter="voltkit"');
    expect(page).toContain(">Mountain Conqueror</small>");
    expect(page).toContain('<b class="pf-card-name">tester</b>');
    expect(page).toContain(">Lv 12<");
    expect(page).toContain("Expert · 1,110");
    expect(page).toContain(">Gold Voltkit<");
  });
  it("words the share message", () => {
    expect(cardSummary(data()).text).toBe(
      "tester, Mountain Conqueror · Level 12 · Expert · 1,110 · Gold Voltkit in Element Arena.",
    );
    expect(
      cardSummary(data({ title: null, progress: null, journey: undefined }))
        .text,
    ).toBe("tester in Element Arena.");
  });
});

describe("titles", () => {
  it("are chips with No title first and only the worn one pressed", () => {
    const page = html();
    expect(page).toContain('data-profile-title=""');
    for (const t of titles)
      expect(page).toContain(`data-profile-title="${t.id}"`);
    expect(page.match(/pf-title-chip is-on/g)).toHaveLength(1);
    expect(page).toMatch(
      new RegExp(`aria-pressed="true" data-profile-title="${id(2)}"`),
    );
    expect(html(data({ title: null }))).toMatch(
      /aria-pressed="true" data-profile-title=""/,
    );
  });
  it("wear their colour; a bad colour never reaches the style", () => {
    const page = html();
    expect(page).toContain("--title:#ffbc65");
    expect(page).not.toContain("--title:nope");
  });
  it("escape names and descriptions", () => {
    const page = html();
    expect(page).not.toContain("<b>Sneaky</b>");
    expect(page).toContain("&lt;b&gt;Sneaky&lt;/b&gt;");
  });
  it("say where titles come from when there are none", () => {
    expect(html(data({ titles: [], title: null }))).toContain("Earn titles");
  });
  it("all wait while one is being put on", () => {
    const page = html(data(), { ...profileView(), equipping: id(1) });
    expect(
      page.match(
        /data-profile-title="[^"]*" title="[^"]*" disabled|data-profile-title="" disabled/g,
      )?.length ?? 0,
    ).toBeGreaterThan(0);
    expect(page).toContain('aria-busy="true"');
  });
});

describe("the rest of the profile", () => {
  it("has every fighter's mastery, both summaries, every boss and the achievements", () => {
    const page = html();
    expect(page.match(/class="pf-mastery-chip/g)).toHaveLength(18);
    expect(page).toContain("Voltkit: Gold mastery, 31 played, 20 won");
    expect(page).toContain('data-profile-go="journey"');
    expect(page).toContain("Tier ");
    expect(page).toContain("40 more for Candidate Master");
    expect(page.match(/data-profile-boss=/g)).toHaveLength(7);
    expect(page).toContain("Cragmuff: 4 clears");
    expect(page).toContain("Lumiwick: 1 clear.");
    expect(page).toContain("1 / 2 · each one gives its title");
    expect(page).toContain('class="is-earned"><b>First Victory');
    for (const go of ["ranks", "journey", "raids"])
      expect(page).toContain(`data-profile-go="${go}"`);
    expect(page).toContain("Player · t@example.com");
  });
  it("asks a guest to save their account, and nobody else", () => {
    expect(html(data({ guest: true, role: "Guest" }))).toContain(
      "data-profile-save",
    );
    expect(html()).not.toContain("data-profile-save");
  });
  it("loads, and says why with a retry when the records can't load", () => {
    expect(html(data({ progress: null }))).toContain("Loading…");
    const page = html(data({ progress: null, progressProblem: "Down." }));
    expect(page).toContain("data-profile-retry");
    expect(page).toContain("Down.");
  });
});

describe("your name", () => {
  it("is cleaned and checked like the database does", () => {
    expect(checkName("  Nova   Star ", "tester")).toEqual({
      name: "Nova Star",
      problem: "",
    });
    expect(checkName("Bénédicte", "tester").problem).toBe("");
    expect(checkName("", "tester").problem).toBe(
      "A name is 1 to 20 characters.",
    );
    expect(checkName("   ", "tester").problem).toBe(
      "A name is 1 to 20 characters.",
    );
    expect(checkName("A".repeat(21), "tester").problem).toBe(
      "A name is 1 to 20 characters.",
    );
    expect(checkName("A".repeat(20), "tester").problem).toBe("");
    expect(checkName("Ben\u200bny", "tester").problem).toBe(
      "That name has characters that can't be shown.",
    );
    expect(checkName("Ben\nny", "tester").problem).toBe(
      "That name has characters that can't be shown.",
    );
    expect(checkName("!!! ...", "tester").problem).toBe(
      "Use at least one letter or number.",
    );
    expect(checkName(" tester ", "tester").problem).toBe(
      "That is already your name.",
    );
    expect(checkName("Sh1t Happens", "tester").problem).toBe(
      "That name isn't allowed. Please choose another.",
    );
    expect(checkName("Badminton Ace", "tester").problem).toBe("");
  });
  it("is locked until the server says, counted on the server's clock", () => {
    const now = Date.parse("2026-11-06T12:00:00Z");
    const status = (nextAt: string | null) => ({
      changedAt: null,
      nextAt,
      now: "",
      days: 14,
    });
    expect(nameLockedFor(null, now)).toBeNull();
    expect(nameLockedFor(status(null), now)).toBeNull();
    expect(nameLockedFor(status("2026-11-06T11:00:00Z"), now)).toBeNull();
    expect(nameLockedFor(status("2026-11-16T12:00:00Z"), now)).toBe(
      10 * 86_400_000,
    );
  });
  it("shows Change name, or when you can next", () => {
    const open = html();
    expect(open).toContain("You can change it once every 14 days");
    expect(open).toMatch(
      /<button type="button" class="ui-btn is-s" data-profile-rename>/,
    );
    // The form is in the markup, hidden, with your name in it.
    expect(open).toContain(
      'data-profile-name-form hidden><input name="name" maxlength="20"',
    );
    expect(open).toContain('value="tester"');
    const later = new Date(
      Date.now() + 3 * 86_400_000 + 3_600_000,
    ).toISOString();
    const locked = html(
      data({
        nameStatus: { changedAt: null, nextAt: later, now: "", days: 14 },
      }),
    );
    expect(locked).toMatch(/You can change it again in 3 d (0|1) h/);
    expect(locked).toMatch(/class="ui-btn is-s" disabled data-profile-rename/);
  });
});

describe("deleting your account", () => {
  it("is offered to players and guests, never to administrators", () => {
    expect(html()).toContain("data-profile-delete>");
    expect(html(data({ guest: true, role: "Guest" }))).toContain(
      "data-profile-delete>",
    );
    expect(
      html(data({ canDelete: false, role: "Administrator" })),
    ).not.toContain("data-profile-delete");
  });
  it("can still be reached when the records can't load", () => {
    const page = html(data({ progress: null, progressProblem: "Down." }));
    expect(page).toContain("data-profile-retry");
    expect(page).toContain("data-profile-delete>");
  });
  it("asks you to type DELETE, says what goes, and waits while it's deleting", () => {
    const closed = html();
    expect(closed).toContain("data-profile-delete-form hidden>");
    const v = { ...profileView(), deleting: true };
    const open = html(data(), v);
    expect(open).not.toContain("data-profile-delete-form hidden");
    expect(open).not.toContain("data-profile-delete>");
    expect(open).toContain(`Type <b>${DELETE_WORD}</b> to confirm`);
    expect(open).toMatch(/can(&#39;|&#039;|')t be undone/);
    expect(html(data({ guest: true }), v)).toContain("Your guest pass");
    const busy = html(data(), {
      ...v,
      deleteBusy: true,
      deleteMessage: "Deleting your account…",
    });
    expect(busy).toMatch(
      /class="ui-btn is-s is-danger" disabled aria-busy="true"><span>Delete forever/,
    );
    expect(busy).toContain("Deleting your account…");
  });
});
