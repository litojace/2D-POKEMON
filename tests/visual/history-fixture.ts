import type {
  MatchHistoryEntry,
  MatchHistoryPlayer,
} from "../../packages/shared/src/accounts";

// Match history for the visual specs (docs/match-history.md): your
// matches and Kai's, as the server answers them.
export const KAI = "33333333-3333-4333-8333-333333333331";
export const WREN = "33333333-3333-4333-8333-333333333332";
export const OSKAR = "33333333-3333-4333-8333-333333333333";
const ME = "00000000-0000-4000-8000-000000000001";
const NOW = Date.now();

const who = (
  id: string | null,
  name: string,
  character: string,
  team: number,
  dealt: number,
  kos: number,
  combos: number,
  avatar: string | null = null,
): MatchHistoryPlayer => ({
  id,
  name,
  avatar,
  character,
  team,
  dealt,
  kos,
  combos,
  bot: id === null,
  owner: false,
  mvp: false,
});

function match(
  i: number,
  o: {
    owner: string;
    mode?: MatchHistoryEntry["mode"];
    bot?: MatchHistoryEntry["bot"];
    result: MatchHistoryEntry["result"];
    rounds: MatchHistoryEntry["rounds"];
    delta?: number;
    arena?: string;
    players: MatchHistoryPlayer[];
    hoursAgo: number;
  },
): MatchHistoryEntry {
  const players = o.players.map((p) => ({ ...p, owner: p.id === o.owner }));
  let mvp = 0;
  players.forEach((p, n) => {
    if (p.dealt > players[mvp].dealt) mvp = n;
  });
  players[mvp].mvp = true;
  const me = players.find((p) => p.owner)!;
  return {
    id: `match-${o.owner.slice(0, 4)}-${String(i).padStart(3, "0")}`,
    playedAt: new Date(NOW - o.hoursAgo * 3600e3).toISOString(),
    mode: o.mode ?? "duel",
    arena: o.arena ?? "classic",
    bot: o.bot ?? null,
    result: o.result,
    character: me.character,
    team: me.team,
    rounds: o.rounds,
    dealt: me.dealt,
    kos: me.kos,
    combos: me.combos,
    rating:
      o.delta === undefined ? null : { before: 1100, after: 1100 + o.delta },
    players,
  };
}

const W = "win" as const,
  L = "loss" as const,
  D = "draw" as const;

/** Your matches: duels, teams, a free-for-all and bots, newest first. */
export function myHistory(): MatchHistoryEntry[] {
  const list: MatchHistoryEntry[] = [
    match(1, {
      owner: ME,
      result: W,
      rounds: [W, L, W],
      delta: 16,
      hoursAgo: 0.2,
      players: [
        who(ME, "tester", "voltkit", 0, 1840, 3, 2, "ea-avatar-001"),
        who(KAI, "Kai", "cindrake", 1, 1320, 1, 1, "ea-avatar-030"),
      ],
    }),
    match(2, {
      owner: ME,
      mode: "teams",
      result: L,
      rounds: [L, W, L],
      delta: -12,
      arena: "tide-pools",
      hoursAgo: 1.5,
      players: [
        who(ME, "tester", "voltkit", 0, 1210, 2, 1, "ea-avatar-001"),
        who(WREN, "Wren", "tidefin", 0, 980, 1, 0, "ea-avatar-012"),
        who(KAI, "Kai", "cindrake", 1, 1650, 3, 2, "ea-avatar-030"),
        who(OSKAR, "Oskar the Unbreakable", "mystowl", 1, 1400, 2, 1),
      ],
    }),
    match(3, {
      owner: ME,
      bot: "hard",
      result: W,
      rounds: [W, W],
      hoursAgo: 3,
      players: [
        who(ME, "tester", "cindrake", 0, 1500, 2, 3, "ea-avatar-001"),
        who(null, "Hard bot", "tidefin", 1, 700, 0, 0),
      ],
    }),
    match(4, {
      owner: ME,
      mode: "ffa",
      result: L,
      rounds: [L, L],
      delta: -9,
      hoursAgo: 20,
      players: [
        who(ME, "tester", "voltkit", 0, 900, 1, 0, "ea-avatar-001"),
        who(KAI, "Kai", "cindrake", 1, 1900, 4, 2, "ea-avatar-030"),
        who(WREN, "Wren", "tidefin", 2, 1100, 1, 1, "ea-avatar-012"),
        who(null, "Deleted player", "mystowl", 3, 600, 0, 0),
      ],
    }),
    match(5, {
      owner: ME,
      result: D,
      rounds: [W, L, D],
      delta: 0,
      hoursAgo: 30,
      players: [
        who(ME, "tester", "tidefin", 0, 1200, 1, 1, "ea-avatar-001"),
        who(OSKAR, "Oskar the Unbreakable", "mystowl", 1, 1200, 1, 0),
      ],
    }),
  ];
  // Older matches: enough for a second page.
  for (let i = 6; i <= 16; i++) {
    const won = i % 3 !== 0;
    list.push(
      match(i, {
        owner: ME,
        bot: i % 4 === 0 ? "normal" : null,
        result: won ? W : L,
        rounds: won ? [W, W] : [L, W, L],
        delta: i % 4 === 0 ? undefined : won ? 14 : -11,
        hoursAgo: 30 + i * 9,
        players: [
          who(
            ME,
            "tester",
            i % 2 ? "voltkit" : "cindrake",
            0,
            1000 + i * 20,
            2,
            1,
            "ea-avatar-001",
          ),
          i % 4 === 0
            ? who(null, "Normal bot", "tidefin", 1, 800, 1, 0)
            : who(
                KAI,
                "Kai",
                "cindrake",
                1,
                900 + i * 10,
                1,
                0,
                "ea-avatar-030",
              ),
        ],
      }),
    );
  }
  return list;
}

/** Kai's matches, as a friend sees them. */
export function kaiHistory(): MatchHistoryEntry[] {
  return myHistory()
    .filter((m) => m.players.some((p) => p.id === KAI))
    .map((m) => {
      const kai = m.players.find((p) => p.id === KAI)!;
      const flip = (r: MatchHistoryEntry["result"]) =>
        r === "win" ? "loss" : r === "loss" ? "win" : r;
      const same = kai.team === m.team;
      return {
        ...m,
        result: same ? m.result : m.mode === "ffa" ? "win" : flip(m.result),
        rounds: same ? m.rounds : m.rounds.map(flip),
        character: kai.character,
        team: kai.team,
        dealt: kai.dealt,
        kos: kai.kos,
        combos: kai.combos,
        rating: m.rating
          ? { before: 1180, after: 1180 - (m.rating.after - m.rating.before) }
          : null,
        players: [
          ...m.players.filter((p) => p.team === kai.team),
          ...m.players.filter((p) => p.team !== kai.team),
        ].map((p) => ({ ...p, owner: p.id === KAI })),
      };
    });
}

export const KAI_FRIEND = {
  id: KAI,
  name: "Kai",
  title: "Expert",
  titleColor: "#719aff",
  online: true,
  fighter: "cindrake",
  avatar: "ea-avatar-030",
  raidClears: { grumblecrag: 3, emberwing: 1 },
};
