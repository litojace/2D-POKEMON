// Canned answers for the account REST API (see apps/server/src/accounts.ts).
const U = "11111111-1111-4111-8111-111111111111";
const today = new Date().toISOString().slice(0, 10);
const title = (n: number, name: string, color: string) => ({
  id: `22222222-2222-4222-8222-22222222222${n}`,
  name,
  description: "",
  color,
  active: true,
});
const API: Record<string, unknown> = {
  "/api/account": {
    id: U,
    displayName: "tester",
    isAdmin: false,
    suspended: false,
    title: "Cragbreaker",
    titleColor: "#d9b98a",
    ownedTitles: [title(1, "Cragbreaker", "#d9b98a")],
    guest: false,
  },
  "/api/economy": {
    journey: { xp: 2600, recent: [], season: { id: "2026-10", xp: 0, week: "2026-W43", goals: {}, completed: [] }, unlocked: [] },
    balance: 2340,
    owned: ["voltkit-midnight", "voltkit-stormcrown"],
    picks: { day: today, items: ["cindrake-blue-flame", "lumoth-starweaver", "mystowl-scholar", "galaxy-aura"], deal: "cindrake-blue-flame" },
    trialWins: { voltkit: 30 },
    awakening: { "voltkit-stormcrown": { wins: 31, peril3: false, stage: 2 } },
    // A skin is worn on purpose: the fighter select must still show one fighter.
    looks: { voltkit: { skin: "voltkit-stormcrown", stage: 2 } },
    missions: [],
    rerolled: false,
    streak: 1,
    today: { raidClears: 0, pvpMatches: 0 },
    leaves: { balance: 1234, tradedToday: 0, tradeCap: 40, tradeLeaves: 100, tradeCoins: 5 },
  },
  "/api/progress": {
    matches: 31,
    wins: 20,
    fighters: { voltkit: { matches: 31, wins: 20 } },
    achievements: [],
    season: { id: "2026-10", matches: 0, wins: 0 },
    rating: { rating: 1000, matches: 0, peak: 1000, rank: "Pupil", placementLeft: 5, next: { name: "Specialist", at: 1050 } },
  },
  "/api/friends": { code: "a1b2c3d4", friends: [], incoming: [], outgoing: [] },
  // Ranks (step 6): the top 20 (as the server sends), Mae placing, you at #23.
  "/api/leaderboard": {
    season: today.slice(0, 7),
    rows: ["Aria", "Bram", "Cleo", "Dax", "Esme", "Finn", "Gus", "Hana", "Ivo", "Jude", "Koa", "Lior", "Nico", "Odile", "Pax", "Quill", "Rhea", "Sol", "Tam", "Uma"].map((name, i) => ({
      rank: i + 1,
      name,
      title: null,
      titleColor: null,
      rating: 1620 - i * 18,
      rankName: i < 1 ? "Legendary Grandmaster" : i < 4 ? "International Grandmaster" : i < 8 ? "Grandmaster" : i < 12 ? "International Master" : "Master",
      wins: 60 - i * 2,
      matches: 80 - i * 2,
      me: false,
    })),
    unranked: [{ name: "Mae", left: 2 }],
    me: { rank: 23, wins: 36, matches: 62 },
    rating: { rating: 1110, matches: 62, peak: 1140, rank: "Expert", placementLeft: 0, next: { name: "Candidate Master", at: 1150 } },
  },
  "/api/leaderboard/friends": {
    season: today.slice(0, 7),
    rows: [
      { id: "f-kai", place: 1, name: "Kai", rating: 1388, rankName: "Grandmaster", placementLeft: 0, wins: 14, matches: 22, me: false },
      { id: U, place: 2, name: "tester", rating: 1110, rankName: "Expert", placementLeft: 0, wins: 36, matches: 62, me: true },
      { id: "f-mina", place: 3, name: "Mina", rating: 1046, rankName: "Specialist", placementLeft: 0, wins: 8, matches: 15, me: false },
      { id: "f-rae", place: null, name: "Rae", rating: 1020, rankName: "Unranked", placementLeft: 3, wins: 2, matches: 2, me: false },
    ],
    rating: { rating: 1110, matches: 62, peak: 1140, rank: "Expert", placementLeft: 0, next: { name: "Candidate Master", at: 1150 } },
  },
  "/api/friends/recent": {
    players: [
      { id: "33333333-3333-4333-8333-333333333331", name: "Kai", fighter: "cindrake", lastPlayed: new Date(Date.now() - 2 * 3600e3).toISOString(), matches: 3, together: 0, wins: 2, losses: 1, relation: "friend", online: true },
      { id: "33333333-3333-4333-8333-333333333332", name: "Wren", fighter: "tidefin", lastPlayed: new Date(Date.now() - 5 * 3600e3).toISOString(), matches: 1, together: 1, wins: 0, losses: 0, relation: "none", online: false },
      { id: "33333333-3333-4333-8333-333333333333", name: "Oskar", fighter: "mystowl", lastPlayed: new Date(Date.now() - 30 * 3600e3).toISOString(), matches: 2, together: 0, wins: 0, losses: 2, relation: "sent", online: false },
    ],
  },
};
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname === "/api/health") return Response.json({ ok: true });
    // Tests can set window.__missions (before load, or then refresh the
    // economy) to give the player today's missions, and window.__friends to
    // give them friends and requests, and window.__raids for their raid
    // progress (its loadout is the equipped raid look); window.__board,
    // __friendsBoard and __recent replace Ranks' boards and Recent players.
    const w = window as unknown as {
      __missions?: unknown[];
      __plazaProgress?: unknown;
      __friends?: unknown;
      __raids?: unknown;
      __board?: unknown;
      __friendsBoard?: unknown;
      __recent?: unknown;
      __serverTime?: number;
    };
    const missions = w.__missions;
    const body =
      url.pathname === "/api/economy" && missions
        ? { ...(API[url.pathname] as object), missions }
        : url.pathname === "/api/plaza"
          ? w.__plazaProgress
          : url.pathname === "/api/friends" && w.__friends
            ? w.__friends
            : url.pathname === "/api/raids" && w.__raids
              ? w.__raids
              : url.pathname === "/api/leaderboard" && w.__board
                ? w.__board
                : url.pathname === "/api/leaderboard/friends" && w.__friendsBoard
                  ? w.__friendsBoard
                  : url.pathname === "/api/friends/recent" && w.__recent
                    ? w.__recent
                    : API[url.pathname];
    // window.__serverTime: the server's clock, sent as the real server does
    // (X-Server-Time); otherwise no header, so the device clock is used.
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (w.__serverTime) headers["X-Server-Time"] = String(w.__serverTime);
    return new Response(JSON.stringify(body ?? { error: "Not in the offline harness." }), {
      status: body === undefined ? 404 : 200,
      headers,
    });
  }
  return realFetch(input, init);
};
