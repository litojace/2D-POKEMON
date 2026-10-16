export const RAID = {
  name: "Grumblecrag",
  maxPeril: 3,
  timeLimit: 480,
  riteChoiceSeconds: 15,
  reviveSeconds: 3,
  reviveRange: 100,
  selfReviveDelay: 6,
  staggerSeconds: 6,
  phases: ["Wake the mountain", "Break the armor", "Heart of the mountain"],
} as const;
export const RAID_CHAPTERS = [
  {
    name: "Wake the mountain",
    objective: "Bait charges into pillars. Jump the slam.",
    detail:
      "Learn the warning shapes and lead a charge into a pillar to expose the core.",
  },
  {
    name: "Break the armor",
    objective: "Break pillars. Watch for the second slam.",
    detail:
      "Charges come more often. A second slam follows the first — leave the circle or jump again.",
  },
  {
    name: "Heart of the mountain",
    objective: "Strike the open core. Survive the combinations.",
    detail:
      "The core stays exposed. Double slams lead into falling debris, then a longer recovery window.",
  },
] as const;
export interface RaidContribution {
  damage: number;
  revives: number;
  pillars: number;
}
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
  kind: "charge" | "slam" | "debris";
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
  bossId: string;
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
  downed: Record<string, { progress: number; self: boolean }>;
  wards: { x: number; y: number; until: number }[];
  rites: Record<string, RaidRite[]>;
  offers: Record<string, RaidRite[]>;
  weekly: boolean;
  week: string;
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
  boss: "grumblecrag";
  peril: number;
  trait: RaidTrait;
  gilded: boolean;
  weekly: boolean;
  week: string;
  seed: number;
  partySize: number;
  seconds: number;
  downs: number;
  revives: number;
  players: { accountId: string; character: string }[];
}
export interface RaidProgress {
  equipped?: "cragbound" | "mountain-aura" | null;
  clears: number;
  highestPeril: number;
  bestSeconds: number | null;
  titles: string[];
  cosmetics: string[];
  weekly: {
    partySize: number;
    seconds: number;
    names: string[];
    peril: number;
  }[];
}
export function raidWeek(date = new Date()) {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start.toISOString().slice(0, 10);
}
export function raidWeekly(date = new Date()) {
  const week = raidWeek(date);
  let seed = 2166136261;
  for (const ch of week)
    seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  const trait = (Object.keys(RAID_TRAITS) as RaidTrait[])[seed % 3];
  return { week, seed, trait, peril: 2 };
}
