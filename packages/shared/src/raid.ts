import type { RaidBossId } from "./raid-roster.js";
export * from "./raid-roster.js";
export const RAID = {
  name: "Grumblecrag",
  maxPeril: 3,
  timeLimit: 480,
  riteChoiceSeconds: 15,
  reviveSeconds: 3,
  reviveRange: 100,
  selfReviveDelay: 6,
  staggerSeconds: 6,
  /** Solo raiders get one self-revive up to this Peril; Peril 3 solo has none. */
  soloSelfReviveMaxPeril: 2,
  phases: ["Wake the mountain", "Break the armor", "Heart of the mountain"],
} as const;
export const RAID_CHAPTERS = [
  {
    name: "Wake the mountain",
    objective: "Bait charges into pillars. Jump the slam.",
    detail:
      "Learn the warning shapes: lead a charge into a pillar to expose the core, and hide behind a pillar from the rock volley.",
  },
  {
    name: "Break the armor",
    objective: "Break pillars. Stack up for shared hits.",
    detail:
      "A second slam follows the first, eruptions chase one raider, and a falling meteor marks another: gather on them to split the damage.",
  },
  {
    name: "Heart of the mountain",
    objective: "Strike the open core. Survive the combinations.",
    detail:
      "The core stays exposed, but attacks come faster and chain together: double slams into debris, volleys into eruptions.",
  },
] as const;
export interface RaidContribution {
  damage: number;
  revives: number;
  pillars: number;
  downs?: number;
}
/** Every boss attack, with the advice shown when it downs someone. */
export type RaidAttack =
  | "charge"
  | "slam"
  | "debris"
  | "volley"
  | "eruption"
  | "share";
export const RAID_ATTACKS: Record<
  RaidAttack,
  { name: string; tip: string; practice: string }
> = {
  charge: {
    name: "Mountain Charge",
    tip: "When you're targeted, stand so a pillar is between you and the boss, then step aside as the lane locks.",
    practice: "A lane locks onto you, then the boss rushes down it.",
  },
  slam: {
    name: "Ground Slam",
    tip: "Jump just as the ring fills, or walk out of the circle. From phase 2 a second slam follows.",
    practice: "A ring fills around the boss. Jump or leave it.",
  },
  debris: {
    name: "Falling Debris",
    tip: "Keep moving: debris lands where you were standing.",
    practice: "Rocks fall on everyone's position. Keep moving.",
  },
  volley: {
    name: "Rock Volley",
    tip: "Get out of the cone or put a pillar between you and the boss. Auralynx's Mirror Guard blocks it.",
    practice: "A cone of stones. Leave it or hide behind a pillar.",
  },
  eruption: {
    name: "Chasing Eruption",
    tip: "The eruptions follow one raider: keep running in one direction and don't drag them through your team.",
    practice: "Eruptions chase you three times. Keep running.",
  },
  share: {
    name: "Shared Meteor",
    tip: "Gather on the marked raider so the meteor's damage is split. Alone, step out of the circle once it locks.",
    practice: "A meteor marks you. Alone, leave the circle after it locks.",
  },
};
/**
 * Grumblecrag's numbers in one place, so tuning (or a second boss) is a
 * matter of data. Damage is before the Peril multiplier.
 */
export const GRUMBLECRAG = {
  id: "grumblecrag",
  name: "Grumblecrag",
  health: { base: 1450, perExtraPlayer: 900, gilded: 1.12 },
  /** Boss damage at Peril 1, 2 and 3 (index = Peril). */
  perilDamage: [1, 1, 1.1, 1.2],
  /** Seconds between attacks, and the final phase's faster rhythm. */
  cadence: { normal: 5.2, restless: 4.4, finalPhase: 0.85 },
  charge: { damage: 28, width: 80, delay: 1.7, lock: 1, speed: 650 },
  slam: { damage: 27, radius: 240, finalRadius: 320, delay: 1.25 },
  debris: { damage: 20, radius: 95, delay: 1.65 },
  volley: { damage: 18, range: 560, spread: 0.9, delay: 1.4 },
  eruption: { damage: 22, radius: 100, delay: 1.25, gap: 0.75 },
  share: {
    damage: 66,
    soloDamage: 34,
    radius: 125,
    delay: 3.2,
    soloLock: 1.1,
    /** Ward (or any shield) inside the stack cuts everyone's share. */
    wardReduction: 0.35,
  },
} as const;
/** The attack order for a phase. Higher Perils add tougher combinations. */
export function raidPattern(
  phase: number,
  peril: number,
  partySize: number,
): RaidAttack[] {
  // A meteor needs friends to share it; alone it becomes a dodge.
  const meteor: RaidAttack = "share";
  if (phase === 1)
    return peril >= 3
      ? ["charge", "slam", "volley", "charge", "eruption", "debris"]
      : ["charge", "slam", "volley", "charge", "debris"];
  if (phase === 2)
    return partySize > 1 || peril >= 2
      ? ["charge", "slam", "eruption", "charge", meteor, "debris"]
      : ["charge", "slam", "eruption", "charge", "volley", "debris"];
  return ["charge", "slam", "volley", meteor, "charge", "eruption"];
}
/** How many eruptions chase their target. */
export const eruptionChain = (phase: number, peril: number) =>
  phase === 1 ? 2 : phase === 2 && peril < 2 ? 2 : 3;
/** Quick signals for teams without voice chat. */
export type RaidPingKind = "stack" | "revive" | "bait";
export const RAID_PINGS: Record<RaidPingKind, { label: string; key: string }> =
  {
    stack: { label: "Stack on me", key: "Z" },
    revive: { label: "Revive me", key: "X" },
    bait: { label: "Bait here", key: "C" },
  };
export const RAID_PING_SECONDS = 3.5;
/** What some champions' skills do against Grumblecrag. */
export const RAID_PERKS: Partial<
  Record<
    "auralynx" | "mystowl" | "terradon" | "lumoth",
    { skill: string; text: string }
  >
> = {
  auralynx: {
    skill: "Mirror Guard",
    text: "Blocks Rock Volley completely and staggers the boss.",
  },
  mystowl: {
    skill: "Ward",
    text: "Up inside a Shared Meteor, it cuts the damage for everyone by 35%.",
  },
  terradon: {
    skill: "Stone shell",
    text: "Stops a charge head-on, taking half damage and staggering the boss.",
  },
  lumoth: {
    skill: "Kindle",
    text: "Cast beside a fallen ally to fill half of their revive at once.",
  },
};
/** Separate appearance slots; each is cosmetic only. */
export type RaidSlot = "skin" | "aura" | "entrance" | "frame" | "victory";
export const RAID_SLOTS: RaidSlot[] = [
  "skin",
  "aura",
  "entrance",
  "frame",
  "victory",
];
export type RaidCosmetic =
  | "cragbound"
  | "cragstone"
  | "mountain-aura"
  | "mountainborn"
  | "conqueror"
  | "rockslide-flex";
/** A raid reward or a Shop collection piece (see shop.ts LOOK_ITEMS). */
export type AppearanceItem = RaidCosmetic | (string & {});
export type RaidLoadout = Partial<Record<RaidSlot, AppearanceItem | null>>;
/**
 * How a reward is earned. The same rules are seeded into the database
 * (migration 009, `arena_raid_rewards`), which is what actually grants them;
 * a unit test keeps the two lists identical.
 */
export type RaidRule =
  | { kind: "clears"; n: number }
  | { kind: "peril"; n: number }
  | { kind: "flawless"; peril: number }
  | { kind: "solo"; peril: number }
  | { kind: "speed"; peril: number; party: number; seconds: number }
  | { kind: "gilded" }
  | { kind: "feat" }
  | { kind: "stat"; stat: "pillars" | "revives"; n: number }
  | { kind: "total-clears"; n: number };
export interface RaidReward {
  id: string;
  /** null = earned across every boss. */
  boss: RaidBossId | null;
  slot: RaidSlot | "title";
  name: string;
  description: string;
  goal: string;
  rule: RaidRule;
}
export const RAID_REWARDS: RaidReward[] = [
  { id: "cragbreaker", boss: "grumblecrag", slot: "title", name: "Cragbreaker", description: "Title", goal: "First clear", rule: { kind: "clears", n: 1 } },
  { id: "cragbound", boss: "grumblecrag", slot: "skin", name: "Cragbound colors", description: "Earthy gold colors", goal: "5 clears", rule: { kind: "clears", n: 5 } },
  { id: "cragstone", boss: "grumblecrag", slot: "skin", name: "Cragstone skin", description: "Stone markings with glowing amber cracks", goal: "10 clears", rule: { kind: "clears", n: 10 } },
  { id: "mountainborn", boss: "grumblecrag", slot: "entrance", name: "Mountainborn entrance", description: "Arrive in a burst of pebbles each round", goal: "Clear Peril 2", rule: { kind: "peril", n: 2 } },
  { id: "mountain-conqueror", boss: "grumblecrag", slot: "title", name: "Mountain Conqueror", description: "Title", goal: "Clear Peril 3", rule: { kind: "peril", n: 3 } },
  { id: "conqueror", boss: "grumblecrag", slot: "frame", name: "Conqueror frame", description: "A carved stone portrait frame with a glowing core", goal: "Clear Peril 3", rule: { kind: "peril", n: 3 } },
  { id: "mountain-aura", boss: "grumblecrag", slot: "aura", name: "Mountain aura", description: "A golden ring beneath your fighter", goal: "Clear Peril 3 with no downs", rule: { kind: "flawless", peril: 3 } },
  { id: "rockslide-flex", boss: "grumblecrag", slot: "victory", name: "Rockslide Flex", description: "Leap onto a rising pile of rocks and flex as pebbles bounce away", goal: "Feat: every charge in a run hits a pillar (3+ charges)", rule: { kind: "feat" } },
  { id: "avalanche", boss: "grumblecrag", slot: "title", name: "Avalanche", description: "Title", goal: "Clear Peril 2 solo in under 3:30", rule: { kind: "speed", peril: 2, party: 1, seconds: 210 } },
  { id: "lone-mountain", boss: "grumblecrag", slot: "title", name: "Lone Mountain", description: "Title", goal: "Clear Peril 3 solo (no self-revive)", rule: { kind: "solo", peril: 3 } },
  { id: "gilded-cragbreaker", boss: "grumblecrag", slot: "title", name: "Gilded Cragbreaker", description: "Title", goal: "Defeat a rare Gilded Grumblecrag", rule: { kind: "gilded" } },
  { id: "pillar-breaker", boss: "grumblecrag", slot: "title", name: "Pillar Breaker", description: "Title", goal: "Bait 25 charges into pillars (wins and losses)", rule: { kind: "stat", stat: "pillars", n: 25 } },
  { id: "mountain-guardian", boss: "grumblecrag", slot: "title", name: "Mountain Guardian", description: "Title", goal: "Help revive teammates 20 times (wins and losses)", rule: { kind: "stat", stat: "revives", n: 20 } },
  { id: "boss-hunter", boss: null, slot: "title", name: "Boss Hunter", description: "Title", goal: "100 raid clears across every boss", rule: { kind: "total-clears", n: 100 } },
];
export const RAID_COSMETICS = Object.fromEntries(
  RAID_REWARDS.filter((r) => r.slot !== "title").map((r) => [
    r.id,
    {
      slot: r.slot as RaidSlot,
      name: r.name,
      description: r.description,
      goal: r.goal,
      boss: r.boss,
    },
  ]),
) as Record<
  RaidCosmetic,
  {
    slot: RaidSlot;
    name: string;
    description: string;
    goal: string;
    boss: RaidBossId | null;
  }
>;
export const RAID_TRAITS = {
  restless: {
    name: "Restless",
    text: "Faster attacks, but the exposed core takes extra damage.",
  },
  fractured: {
    name: "Fractured",
    text: "More falling debris; pillars break armor for longer.",
  },
  ancient: { name: "Ancient", text: "Slower charges and wider shockwaves." },
} as const;
export type RaidTrait = keyof typeof RAID_TRAITS;
export const RAID_RITES = {
  shelter: {
    name: "Sheltering Step",
    text: "Dashing leaves a ward. Nearby allies take 25% less damage for 3 seconds.",
    icon: "Dash",
  },
  sharing: {
    name: "Shared Spark",
    text: "Energy pickups give nearby allies 12 ultimate charge.",
    icon: "Overcharge",
  },
  core: {
    name: "Core Seeker",
    text: "Hits on the exposed core trigger an extra 8 damage once per second.",
    icon: "Static Lance",
  },
  rescue: {
    name: "Helping Paws",
    text: "Revive 35% faster and restore an extra 15% health.",
    icon: "Jump",
  },
  courage: {
    name: "Last Light",
    text: "Deal 20% more damage while below half health.",
    icon: "Spark Dart",
  },
  mending: {
    name: "Mending Pulse",
    text: "Using your ultimate heals nearby allies for 12% health.",
    icon: "Rest",
  },
} as const;
export type RaidRite = keyof typeof RAID_RITES;
export interface RaidWarning {
  id: number;
  kind: RaidAttack;
  /** Volley: half-width of the cone, in radians. */
  spread?: number;
  /** Shared meteor: how many raiders are standing in it. */
  sharers?: number;
  /** Eruption: how many more follow this one. */
  chain?: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  radius: number;
  at: number;
  /** Server start time lets clients animate the warning without guessing its duration. */
  startedAt?: number;
  targetId?: string;
  lockAt?: number;
  followUp?: boolean;
  teach?: boolean;
}
export interface RaidState {
  /** The boss entity's player id. */
  bossId: string;
  /** Which boss this raid is (Grumblecrag, …). */
  boss: RaidBossId;
  name: string;
  peril: number;
  trait: RaidTrait;
  gilded: boolean;
  phase: number;
  maxHp: number;
  stagger: number;
  staggerUntil: number;
  exposedUntil: number;
  warnings: RaidWarning[];
  pillars: { x: number; y: number; broken: boolean }[];
  downed: Record<
    string,
    { progress: number; self: boolean; cause?: RaidAttack }
  >;
  /** Quick team signals (Stack on me, Revive me, Bait here). */
  pings?: { id: number; playerId: string; kind: RaidPingKind; until: number }[];
  /** Practice: the boss repeats one attack, and hits only count. */
  drill?: RaidAttack | null;
  drillStats?: { hits: number; dodges: number };
  /** Heroes an AI is playing for while their player reconnects. */
  standIns?: string[];
  wards: { x: number; y: number; until: number }[];
  rites: Record<string, RaidRite[]>;
  offers: Record<string, RaidRite[]>;
  /** Raid of the Day: today's featured boss at Peril 2, shared seed. */
  daily: boolean;
  /** Pacific calendar date (YYYY-MM-DD) the run counts for. */
  day: string;
  seed: number;
  partySize: number;
  elapsed: number;
  result: "victory" | "defeat" | null;
  revives: number;
  downs: number;
  closingRadius?: number;
  message: string;
  resultId?: string;
  rewardStatus?: "saving" | "saved" | "unavailable";
  contributions?: Record<string, RaidContribution>;
}
export interface RaidReceipt {
  id: string;
  boss: RaidBossId;
  peril: number;
  trait: RaidTrait;
  gilded: boolean;
  /** Kept false for databases that only have migration 008. */
  weekly: boolean;
  week: string;
  daily?: boolean;
  day?: string;
  /** The boss's feat was achieved in this run (e.g. every charge baited). */
  feat?: boolean;
  seed: number;
  partySize: number;
  seconds: number;
  downs: number;
  revives: number;
  /** Defeats are saved too: they count towards titles and balance data. */
  result?: "victory" | "defeat";
  phaseReached?: number;
  /** Downs by attack, for tuning. */
  downCauses?: Partial<Record<RaidAttack, number>>;
  players: {
    accountId: string;
    character: string;
    damage?: number;
    revives?: number;
    pillars?: number;
    downs?: number;
  }[];
}
export interface RaidBossProgress {
  clears: number;
  highestPeril: number;
  bestSeconds: number | null;
  runs: number;
}
export interface RaidBoardRow {
  partySize: number;
  seconds: number;
  names: string[];
  peril: number;
}
export interface RaidProgress {
  /** Before migration 008: one cosmetic for everything. */
  equipped?: "cragbound" | "mountain-aura" | null;
  /** From migration 008: one item per slot. */
  loadout?: RaidLoadout;
  /** Lifetime totals across wins and losses (migration 008). */
  runs?: number;
  pillars?: number;
  revives?: number;
  clears: number;
  highestPeril: number;
  bestSeconds: number | null;
  titles: string[];
  cosmetics: string[];
  /** Pre-009 weekly board (empty from migration 009). */
  weekly: RaidBoardRow[];
  /** From migration 009: per-boss records, earned reward ids, today's board. */
  bosses?: Partial<Record<RaidBossId, RaidBossProgress>>;
  earned?: string[];
  stats?: Partial<Record<RaidBossId, { pillars: number; revives: number; feats: number }>>;
  totalClears?: number;
  today?: { day: string; boss: RaidBossId; cleared: boolean; board: RaidBoardRow[] };
  /** Days this Pacific week (Sun–Sat) with a Raid of the Day clear. */
  dailyClears?: string[];
}
export function raidWeek(date = new Date()) {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start.toISOString().slice(0, 10);
}

/** The equipped look from saved progress (also reads the pre-008 format). */
export function raidLookOf(
  progress: Pick<RaidProgress, "loadout" | "equipped"> | null | undefined,
): RaidLoadout {
  if (!progress) return {};
  if (progress.loadout) return { ...progress.loadout };
  if (progress.equipped === "cragbound") return { skin: "cragbound" };
  if (progress.equipped === "mountain-aura") return { aura: "mountain-aura" };
  return {};
}
