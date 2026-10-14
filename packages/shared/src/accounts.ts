import { z } from "zod";
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
      .record(z.string().max(300))
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
export type OnlineActivity = "menu" | "lobby" | "match" | "practice";
export interface OnlinePlayer {
  id: string;
  displayName: string;
  title: string | null;
  titleColor: string | null;
  isAdmin: boolean;
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
  fighters: z.record(z.object({ matches: z.number(), wins: z.number() })),
  season: z.object({ id: z.string(), matches: z.number(), wins: z.number() }),
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
    }),
  ),
  me: z
    .object({ rank: z.number(), wins: z.number(), matches: z.number() })
    .nullable(),
});
export type Leaderboard = z.infer<typeof leaderboardSchema>;
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
