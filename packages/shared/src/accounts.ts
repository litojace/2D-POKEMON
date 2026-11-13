import { z } from "zod";
import { nameAllowed, NAME_NOT_ALLOWED } from "./name-filter.js";
export const titleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(40),
  description: z.string().max(160),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  active: z.boolean(),
  /** Present once migration 003 has run; used for ordering only. */
  createdAt: z.string().nullable().optional(),
});
export const accountSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).max(20),
  isAdmin: z.boolean(),
  suspended: z.boolean(),
  title: z.string().nullable(),
  titleColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  ownedTitles: z.array(titleSchema),
  /** Played as a guest (anonymous login), until they save their account. */
  guest: z.boolean().optional(),
});
export type Account = z.infer<typeof accountSchema>;
export type Title = z.infer<typeof titleSchema>;
export interface ManagedPlayer {
  id: string;
  displayName: string;
  suspended: boolean;
  isAdmin: boolean;
  title: string | null;
  createdAt: string;
  titleIds: string[];
}
export interface PlayerDirectory {
  players: ManagedPlayer[];
  total: number;
}
export const suspendSchema = z
  .object({ id: z.string().uuid(), suspended: z.boolean() })
  .strict();
/** Deleting is permanent, so the request must say so explicitly. */
export const deletePlayerSchema = z
  .object({ id: z.string().uuid(), confirm: z.literal(true) })
  .strict();
/** A player deleting their own account (migration 109): it must say so. */
export const deleteMyAccountSchema = z
  .object({ confirm: z.literal(true) })
  .strict();
export const deleteTitleSchema = z
  .object({ id: z.string().uuid(), confirm: z.literal(true) })
  .strict();
export const REPORT_CATEGORIES = {
  bug: "Bug or glitch",
  player: "Player behavior",
  account: "Account or login",
  other: "Something else",
} as const;
export type ReportCategory = keyof typeof REPORT_CATEGORIES;
export const reportSchema = z
  .object({
    category: z.enum(["bug", "player", "account", "other"]),
    message: z.string().trim().min(5).max(1000),
    context: z
      .record(z.string(), z.string().max(300))
      .refine((value) => Object.keys(value).length <= 12, "Too many details"),
  })
  .strict();
export const resolveReportSchema = z
  .object({ id: z.number().int().positive(), resolved: z.boolean() })
  .strict();
export interface ProblemReport {
  id: number;
  reporterId: string | null;
  reporterName: string;
  category: ReportCategory;
  message: string;
  context: Record<string, string>;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
}
export interface ReportList {
  reports: ProblemReport[];
  total: number;
  open: number;
}
/** What a signed-in, connected player is doing right now (admin "Online" tab). */
export type OnlineActivity = "menu" | "lobby" | "match" | "practice" | "town";
export interface OnlinePlayer {
  id: string;
  displayName: string;
  title: string | null;
  titleColor: string | null;
  isAdmin: boolean;
  /** Playing on a guest (anonymous) login. */
  guest?: boolean;
  /** Open tabs/devices connected with this account. */
  connections: number;
  /** ISO time of the earliest current connection. */
  since: string;
  activity: OnlineActivity;
  room: string | null;
  /** Lobby, briefing, playing, finished… while in a room. */
  phase: string | null;
  fighter: string | null;
  opponent: string | null;
}
export interface OnlineList {
  players: OnlinePlayer[];
  /** Connected visitors who are not signed in. */
  guests: number;
  at: string;
}
export const titleUpdateSchema = titleSchema
  .extend({
    id: z.string().uuid().nullable(),
    name: z.string().trim().min(1).max(40),
  })
  .strict();
export const titleGrantSchema = z
  .object({
    playerId: z.string().uuid(),
    titleId: z.string().uuid(),
    grant: z.boolean(),
  })
  .strict();
export const equipTitleSchema = z
  .object({ titleId: z.string().uuid().nullable() })
  .strict();
/** Players change their own name once every 14 days (migration 066). */
export const NAME_CHANGE_DAYS = 14;
export const nameChangeSchema = z
  .object({ name: z.string().max(60) })
  .strict();
/** When you last changed your name and when you can next (server time). */
export const nameStatusSchema = z.object({
  changedAt: z.string().nullable(),
  nextAt: z.string().nullable(),
  now: z.string(),
  days: z.number(),
});
export type NameStatus = z.infer<typeof nameStatusSchema>;
/**
 * The same clean-up and checks the database makes, so the form can say
 * what's wrong before sending. The database still decides.
 */
export function checkName(raw: string, current: string) {
  if (/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/.test(raw))
    return { name: "", problem: "That name has characters that can't be shown." };
  const name = raw.trim().replace(/ +/g, " ");
  if (name.length < 1 || [...name].length > 20)
    return { name, problem: "A name is 1 to 20 characters." };
  if (/^[\p{P}\p{S}\s]+$/u.test(name))
    return { name, problem: "Use at least one letter or number." };
  if (name === current) return { name, problem: "That is already your name." };
  if (!nameAllowed(name)) return { name, problem: NAME_NOT_ALLOWED };
  return { name, problem: "" };
}

/**
 * Every API answer carries the server's clock in this header (milliseconds
 * since 1970), so the hub's countdowns never trust the device clock.
 */
export const SERVER_TIME_HEADER = "X-Server-Time";

/** Your skill rating and rank (migration 006). */
export const ratingSchema = z.object({
  rating: z.number(),
  matches: z.number(),
  peak: z.number().optional(),
  rank: z.string(),
  placementLeft: z.number().optional(),
  next: z.object({ name: z.string(), at: z.number() }).nullable().optional(),
  /** After a match: your rating and rank before it. */
  before: z.number().optional(),
  previousRank: z.string().optional(),
});
export type Rating = z.infer<typeof ratingSchema>;
/** One finished match, as every player in it reports it (migration 004). */
export interface MatchSummary {
  v: 1;
  mode: "duel" | "teams" | "ffa";
  arena: string;
  /** Difficulty of the AI opponent, or null for player-vs-player. */
  bot: "easy" | "normal" | "hard" | null;
  winnerTeam: number | null;
  /** Round winners in order (null = drawn round). */
  rounds: (number | null)[];
  players: {
    /** Account id; null for an AI bot. */
    account: string | null;
    name: string;
    character: string;
    team: number;
    dealt: number;
    kos: number;
    combos: number;
  }[];
}
export const matchReportSchema = z
  .object({ matchId: z.string().min(8).max(64) })
  .strict();
export const recordSchema = z.object({
  id: z.string(),
  name: z.string(),
  wins: z.number(),
  losses: z.number(),
  together: z.number().optional(),
});

export const matchReportReplySchema = z.object({
  confirmed: z.boolean(),
  records: z.array(recordSchema),
  achievements: z.array(z.string()),
  rating: ratingSchema.optional(),
});
export type HeadToHead = z.infer<typeof recordSchema>;
export type MatchReportReply = z.infer<typeof matchReportReplySchema>;
export const progressSchema = z.object({
  matches: z.number(),
  wins: z.number(),
  achievements: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      earnedAt: z.string().nullable(),
    }),
  ),
  fighters: z.record(
    z.string(),
    z.object({ matches: z.number(), wins: z.number() }),
  ),
  season: z.object({ id: z.string(), matches: z.number(), wins: z.number() }),
  rating: ratingSchema.optional(),
});
export type Progress = z.infer<typeof progressSchema>;
export const leaderboardSchema = z.object({
  season: z.string(),
  rows: z.array(
    z.object({
      rank: z.number(),
      name: z.string(),
      title: z.string().nullable(),
      titleColor: z.string().nullable(),
      wins: z.number(),
      matches: z.number(),
      me: z.boolean(),
      rating: z.number().optional(),
      rankName: z.string().optional(),
    }),
  ),
  unranked: z
    .array(z.object({ name: z.string(), left: z.number() }))
    .optional(),
  me: z
    .object({
      rank: z.number().nullable(),
      wins: z.number(),
      matches: z.number(),
    })
    .nullable(),
  rating: ratingSchema.optional(),
});
export type Leaderboard = z.infer<typeof leaderboardSchema>;
/**
 * Your friends' ratings (UI remodel step 6): you and every friend, ranked
 * among yourselves. Read-only; the server builds it from the ratings table.
 * `place` is null while a player is still in placement.
 */
export const friendsBoardSchema = z.object({
  season: z.string(),
  rows: z.array(
    z.object({
      id: z.string(),
      place: z.number().nullable(),
      name: z.string(),
      title: z.string().nullable().optional(),
      titleColor: z.string().nullable().optional(),
      rating: z.number(),
      rankName: z.string(),
      placementLeft: z.number(),
      wins: z.number(),
      matches: z.number(),
      me: z.boolean(),
    }),
  ),
  rating: ratingSchema.optional(),
});
export type FriendsBoard = z.infer<typeof friendsBoardSchema>;
/**
 * Players you met in your recent matches (UI remodel step 6), newest first.
 * Read-only, from the confirmed match records. `relation` says whether you
 * are friends or a request is waiting either way.
 */
export const recentPlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** The fighter they played in your latest match together. */
  fighter: z.string().nullable(),
  lastPlayed: z.string(),
  /** Matches together in the window, and how many on the same team. */
  matches: z.number(),
  together: z.number(),
  /** Your record against them (as opponents). */
  wins: z.number(),
  losses: z.number(),
  relation: z.enum(["friend", "sent", "received", "none"]),
  online: z.boolean().optional(),
});
export const recentPlayersSchema = z.object({
  players: z.array(recentPlayerSchema),
});
export type RecentPlayer = z.infer<typeof recentPlayerSchema>;
export type RecentPlayers = z.infer<typeof recentPlayersSchema>;
/** Fighter mastery: matches played with a fighter unlock badge tiers. */
export const MASTERY_TIERS = [
  { name: "Bronze", matches: 5, color: "#d69a6a" },
  { name: "Silver", matches: 15, color: "#cfd8e6" },
  { name: "Gold", matches: 30, color: "#ffd166" },
  { name: "Crystal", matches: 60, color: "#9ff3ff" },
] as const;
export function masteryTier(matches: number) {
  let tier: (typeof MASTERY_TIERS)[number] | null = null;
  for (const t of MASTERY_TIERS) if (matches >= t.matches) tier = t;
  return tier;
}
/** Matches still needed for the next mastery tier (null at the top). */
export function nextMastery(matches: number) {
  const next = MASTERY_TIERS.find((t) => matches < t.matches);
  return next ? { ...next, left: next.matches - matches } : null;
}

/** A friend, with what the game server knows about them right now. */
/** A public equipped raid look (colours, aura, entrance, frame, victory). */
export const publicLookSchema = z.object({
  skin: z.string().max(80).nullable().optional(),
  aura: z.string().max(80).nullable().optional(),
  entrance: z.string().max(80).nullable().optional(),
  frame: z.string().max(80).nullable().optional(),
  victory: z.string().max(80).nullable().optional(),
});
/** The Shop skin worn on one champion, and its Awakening stage. */
export const championLookSchema = z.object({
  skin: z.string().max(80),
  stage: z.number().int().min(1).max(3),
});
export const friendSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().nullable().optional(),
  titleColor: z.string().nullable().optional(),
  online: z.boolean().optional(),
  lastOnline: z.string().datetime({ offset: true }).nullable().optional(),
  activity: z
    .enum(["menu", "lobby", "match", "practice", "town"])
    .nullable()
    .optional(),
  room: z.string().nullable().optional(),
  joinable: z.boolean().optional(),
  fighter: z.string().nullable().optional(),
  /** Public equipped appearance, never owned inventory. */
  look: publicLookSchema.optional(),
  championLooks: z.record(z.string(), championLookSchema).optional(),
  raidClears: z.record(z.string(), z.number().int().nonnegative()).optional(),
  /** Verified equipped portrait frame, when appearance is available. */
  frame: z.string().max(80).nullable().optional(),
});
export const friendsSchema = z.object({
  code: z.string(),
  friends: z.array(friendSchema),
  incoming: z.array(z.object({ id: z.string(), name: z.string() })),
  outgoing: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type Friend = z.infer<typeof friendSchema>;
export type FriendList = z.infer<typeof friendsSchema>;

/** Short-lived, authenticated invitations to an existing private lobby. */
export const roomInviteRequestSchema = z
  .object({ playerId: z.string().uuid() })
  .strict();
export const roomInviteSchema = z
  .object({
    id: z.string().uuid(),
    fromId: z.string().uuid(),
    name: z.string().min(1).max(20),
    code: z.string().regex(/^[A-Z0-9]{6}$/),
    /** "party": an invitation to a party on the Lobby; `code` is the party's. */
    mode: z.enum(["duel", "teams", "ffa", "raid", "party"]),
    expiresAt: z.number().finite(),
  })
  .strict();
export type RoomInvite = z.infer<typeof roomInviteSchema>;
/** Party before a room (hub redesign phase 2b). */
export const partyInviteRequestSchema = z
  .object({ playerId: z.string().uuid(), character: z.string().min(1).max(20) })
  .strict();
export const partyAcceptSchema = z
  .object({
    code: z.string().regex(/^[A-Z0-9]{6}$/),
    character: z.string().min(1).max(20),
  })
  .strict();
export const partyStateSchema = z
  .object({
    code: z.string().regex(/^[A-Z0-9]{6}$/),
    leader: z.string().uuid(),
    members: z
      .array(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1).max(20),
          character: z.string().min(1).max(20),
          /** The skin worn on that champion (saved on their account). */
          skin: championLookSchema.nullable().optional(),
          /** Their equipped raid look: colours, aura, entrance, frame. */
          look: publicLookSchema.optional(),
        }),
      )
      .min(1)
      .max(4),
  })
  .nullable();
export type PartyState = z.infer<typeof partyStateSchema>;
export const partyRoomSchema = z
  .object({
    code: z.string().regex(/^[A-Z0-9]{6}$/),
    mode: z.enum(["duel", "teams", "ffa", "raid"]),
  })
  .strict();
/** Block or unblock a player (migration 110). */
export const blockSchema = z
  .object({ playerId: z.string().uuid(), block: z.boolean() })
  .strict();
/** The players you blocked, newest first. */
export const blockedListSchema = z.array(
  z.object({ id: z.string(), name: z.string() }),
);
export type BlockedPlayer = z.infer<typeof blockedListSchema>[number];
export const friendRequestSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[0-9a-fA-F]{8}$/)
      .optional(),
    playerId: z.string().uuid().optional(),
  })
  .strict()
  .refine((v) => !!v.code !== !!v.playerId, "Give a friend code or a player.");
export const friendRespondSchema = z
  .object({ playerId: z.string().uuid(), accept: z.boolean() })
  .strict();
export const friendRemoveSchema = z
  .object({ playerId: z.string().uuid() })
  .strict();
/** Your friend code: the first 8 characters of your account id, upper case. */
export function friendCode(accountId: string) {
  return accountId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/**
 * The rank ladder (must match supabase/migrations/006_ratings.sql). Ratings
 * start at 1000; reaching a rank grants its title for good.
 */
export const PLACEMENT_MATCHES = 5;
export const RANKS = [
  { name: "Newbie", min: 0, color: "#a9b4c9" },
  { name: "Pupil", min: 950, color: "#65d38a" },
  { name: "Specialist", min: 1000, color: "#50dbe9" },
  { name: "Expert", min: 1075, color: "#719aff" },
  { name: "Candidate Master", min: 1150, color: "#c68bff" },
  { name: "Master", min: 1225, color: "#ffbc65" },
  { name: "International Master", min: 1300, color: "#ffd29a" },
  { name: "Grandmaster", min: 1375, color: "#ff697f" },
  { name: "International Grandmaster", min: 1450, color: "#ff465f" },
  { name: "Legendary Grandmaster", min: 1550, color: "#ffd65b" },
] as const;
export function rankColor(name: string | undefined) {
  return RANKS.find((r) => r.name === name)?.color ?? "#a0afc8";
}
