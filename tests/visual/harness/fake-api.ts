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
  "/api/leaderboard": { season: "2026-10", rows: [], unranked: [], me: null, rating: null },
};
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.pathname.startsWith("/api/")) {
    const body = API[url.pathname];
    return new Response(JSON.stringify(body ?? { error: "Not in the offline harness." }), {
      status: body === undefined ? 404 : 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return realFetch(input, init);
};
