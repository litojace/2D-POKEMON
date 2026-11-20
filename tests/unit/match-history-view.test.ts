import { describe, expect, it } from "vitest";
import type { MatchHistoryEntry } from "../../packages/shared/src/accounts";
import {
  historyMarkup,
  historyState,
  opponents,
  playedAgo,
  ratingDelta,
  recentForm,
} from "../../apps/client/src/screens/match-history-view";
import {
  friendCardData,
  friendCardMarkup,
} from "../../apps/client/src/screens/friend-card";

// Match history's words and markup (docs/match-history.md).
const NOW = Date.parse("2026-11-20T12:00:00Z");
const entry = (o: Partial<MatchHistoryEntry> = {}): MatchHistoryEntry => ({
  id: "match-0001",
  playedAt: "2026-11-20T11:00:00Z",
  mode: "duel",
  arena: "classic",
  bot: null,
  result: "win",
  character: "voltkit",
  team: 0,
  rounds: ["win", "loss", "win"],
  dealt: 900,
  kos: 3,
  combos: 1,
  rating: { before: 1000, after: 1016 },
  players: [
    {
      id: "me",
      name: "Me",
      avatar: null,
      character: "voltkit",
      team: 0,
      dealt: 900,
      kos: 3,
      combos: 1,
      bot: false,
      owner: true,
      mvp: true,
    },
    {
      id: "kai",
      name: "Kai <b>",
      avatar: null,
      character: "cindrake",
      team: 1,
      dealt: 500,
      kos: 1,
      combos: 0,
      bot: false,
      owner: false,
      mvp: false,
    },
  ],
  ...o,
});

describe("words", () => {
  it("how long ago", () => {
    expect(playedAgo("2026-11-20T11:59:30Z", NOW)).toBe("just now");
    expect(playedAgo("2026-11-20T11:55:00Z", NOW)).toBe("5m ago");
    expect(playedAgo("2026-11-20T09:00:00Z", NOW)).toBe("3h ago");
    expect(playedAgo("2026-11-18T12:00:00Z", NOW)).toBe("2d ago");
    expect(playedAgo("2026-10-01T12:00:00Z", NOW)).toBe("Oct 1");
    expect(playedAgo("2025-10-01T12:00:00Z", NOW)).toBe("Oct 1, 2025");
  });

  it("who it was against", () => {
    expect(opponents(entry())).toBe("vs Kai <b>");
    expect(opponents(entry({ bot: "hard" }))).toBe("vs Hard bot");
    const team = entry({
      mode: "teams",
      players: [
        ...entry().players,
        { ...entry().players[1], id: "x", name: "Wren" },
      ],
    });
    expect(opponents(team)).toBe("vs Kai <b> +1");
  });

  it("the rating moved", () => {
    expect(ratingDelta({ before: 1000, after: 1016 })).toEqual({
      text: "+16",
      cls: "is-up",
    });
    expect(ratingDelta({ before: 1000, after: 988 })).toEqual({
      text: "−12",
      cls: "is-down",
    });
    expect(ratingDelta({ before: 1000, after: 1000 })?.text).toBe("±0");
    expect(ratingDelta(null)).toBeNull();
  });

  it("recent form counts the last ten only", () => {
    const list = [
      ...Array.from({ length: 7 }, (_, i) => entry({ id: `w${i}` })),
      ...Array.from({ length: 3 }, (_, i) =>
        entry({ id: `l${i}`, result: "loss", character: "tidefin" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        entry({ id: `old${i}`, result: "loss" }),
      ),
    ];
    const f = recentForm(list);
    expect([f.last.length, f.wins, f.losses, f.rate, f.favourite]).toEqual([
      10,
      7,
      3,
      70,
      "voltkit",
    ]);
  });
});

describe("markup", () => {
  it("loading, a problem with Try again, and empty", () => {
    const s = historyState();
    expect(historyMarkup(s, { whose: "Your", now: NOW })).toContain(
      "Loading matches",
    );
    s.problem = "Only friends can see each other's matches.";
    const problem = historyMarkup(s, { whose: "Your", now: NOW });
    expect(problem).toContain("data-history-retry");
    expect(problem).toContain("Only friends can see each other&#39;s matches.");
    s.problem = "";
    s.matches = [];
    s.kind = "bot";
    expect(historyMarkup(s, { whose: "Your", now: NOW })).toContain(
      "Matches against bots show up here.",
    );
  });

  it("a row, its board when open, names escaped, More when there's more", () => {
    const s = historyState();
    s.matches = [entry()];
    s.next = { at: "2026-11-20T11:00:00Z", id: "match-0001" };
    let html = historyMarkup(s, {
      whose: "Your",
      now: NOW,
      canOpen: (id) => id === "kai",
    });
    expect(html).toContain('class="mh-row is-win"');
    expect(html).toContain("+16");
    expect(html).toContain("1h ago");
    expect(html).toContain("data-history-more");
    expect(html).not.toContain("Kai <b>");
    expect(html).toContain("Kai &lt;b&gt;");
    expect(html).not.toContain("mh-board");
    s.open = "match-0001";
    html = historyMarkup(s, {
      whose: "Your",
      now: NOW,
      canOpen: (id) => id === "kai",
    });
    expect(html).toContain("mh-board");
    expect(html).toContain('data-history-player="kai"');
    // You aren't a link on your own board; one MVP.
    expect(html).not.toContain('data-history-player="me"');
    expect(html.match(/mh-mvp"/g)).toHaveLength(1);
    // Not a friend: a name, not a link.
    expect(historyMarkup(s, { whose: "Your", now: NOW })).not.toContain(
      "data-history-player",
    );
  });
});

describe("a friend's card", () => {
  const kai = {
    id: "kai",
    name: "Kai",
    title: "Expert",
    titleColor: "#719aff",
    fighter: "cindrake",
    avatar: null,
    raidClears: { grumblecrag: 3, emberwing: 1 },
  };
  it("reads their totals and rating as your card reads yours", () => {
    const s = historyState();
    s.totals = {
      matches: 20,
      wins: 11,
      fighters: { cindrake: { matches: 20, wins: 11 } },
    };
    s.rating = { rating: 1180, matches: 20, rank: "Expert", placementLeft: 0 };
    const d = friendCardData(kai, s);
    expect(d.progress?.matches).toBe(20);
    expect(d.progress?.rating?.rank).toBe("Expert");
    expect(d.fighter).toBe("cindrake");
    const html = friendCardMarkup(kai, s, { back: true, now: NOW });
    expect(html).toContain('aria-label="Kai&#39;s player card"');
    expect(html).toContain("data-friend-card-back");
    // Matches, wins, win rate, raid clears.
    expect(html.match(/class="pf-tile"/g)).toHaveLength(4);
    expect(html).toContain(">55%<");
    expect(html).toContain(">4<");
    // Nothing of yours to change on someone else's card.
    expect(html).not.toMatch(
      /data-profile-(share|rename|delete|title|avatar|photo)/,
    );
  });
  it("no way back when it didn't open from Friends; dashes before totals", () => {
    const html = friendCardMarkup(kai, historyState(), {
      back: false,
      now: NOW,
    });
    expect(html).not.toContain("data-friend-card-back");
    expect(html).toContain(">–<");
  });
});
