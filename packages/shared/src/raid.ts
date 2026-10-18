import type { RaidBossId } from "./raid-roster.js";
import type { CharacterId } from "./index.js";
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
  | "share"
  // Tidewyrm
  | "dive"
  | "wave"
  | "bubbles"
  | "hightide"
  | "undertow"
  | "prison";
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
  dive: {
    name: "Dive & Surface",
    tip: "When the ripple follows you, lead it onto an island, then step off before it locks. It surfaces stranded on dry land.",
    practice: "A ripple follows you, then locks. Lead it onto an island and step off.",
  },
  wave: {
    name: "Tidal Wave",
    tip: "A low wave (chapter 1) can be jumped. A high wave can't: be standing on an island when it passes.",
    practice: "A wave sweeps the arena. Jump a low one; stand on an island for a high one.",
  },
  bubbles: {
    name: "Bubble Barrage",
    tip: "Step between the slow bubbles or pop them with your attacks. A hit roots you for a moment.",
    practice: "A fan of slow bubbles. Weave through or pop them.",
  },
  hightide: {
    name: "High Tide",
    tip: "Get onto an island before the water rises. Two fit on an island; a third gets pushed off.",
    practice: "The floor floods for a few seconds. Stand on an island.",
  },
  undertow: {
    name: "Undertow",
    tip: "Dash away from the whirlpool and keep walking outward. Touching its centre hurts.",
    practice: "A whirlpool pulls everyone to the centre. Walk and dash outward.",
  },
  prison: {
    name: "Bubble Prison",
    tip: "Teammates pop the bubble with three hits. Alone, mash your attack to break out before it reaches the boss's mouth.",
    practice: "A bubble seals you and drifts to the boss. Mash attack (or have friends pop it).",
  },
};
/** Each boss's attacks, in the order the Hub and the practice room list them. */
export const RAID_BOSS_ATTACKS: Partial<Record<RaidBossId, RaidAttack[]>> = {
  grumblecrag: ["charge", "slam", "volley", "debris", "eruption", "share"],
  tidewyrm: ["dive", "wave", "bubbles", "hightide", "undertow", "prison"],
};
export const raidAttacksOf = (boss: RaidBossId) => RAID_BOSS_ATTACKS[boss] ?? [];
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
/**
 * Tidewyrm's numbers (docs/raid-roster-design.md §5.1). Damage is before the
 * Peril multiplier.
 */
export const TIDEWYRM = {
  id: "tidewyrm",
  name: "Tidewyrm",
  health: { base: 1350, perExtraPlayer: 850, gilded: 1.12 },
  perilDamage: [1, 1, 1.1, 1.2],
  cadence: { normal: 5, restless: 4.4, finalPhase: 0.85 },
  /** The Lagoon Court: four raised islands you can stand on. */
  islands: [
    { x: 470, y: 255 },
    { x: 1130, y: 255 },
    { x: 470, y: 645 },
    { x: 1130, y: 645 },
  ],
  islandRadius: 78,
  /** Spring Tide trait: bigger islands. */
  springIslandRadius: 92,
  /** How many raiders fit on an island during High Tide. */
  islandCapacity: 2,
  /** Where Tidewyrm rests between dives, and the whirlpool's centre. */
  home: { x: 800, y: 450 },
  dive: {
    follow: 1.4,
    lock: 0.8,
    damage: 26,
    radius: 110,
    /** Seconds stranded (exposed) on an island; longer on Peril 1. */
    strand: 5,
    strandPeril1: 7,
    strandStagger: 35,
    /** Strands an island survives before it sinks for the chapter. */
    cracks: 2,
  },
  wave: { delay: 1.4, speed: 520, ripSpeed: 400, width: 70, damage: 22 },
  bubbles: { delay: 0.9, speed: 150, radius: 20, damage: 10, root: 0.8, life: 5, spread: 0.9 },
  highTide: { delay: 2, seconds: 5, springSeconds: 7, dps: 7 },
  undertow: { delay: 1.2, seconds: 3, pull: 120, ripPull: 160, centreRadius: 75, damage: 24 },
  prison: { delay: 1, seconds: 6, hits: 3, presses: 8, radius: 34 },
  /** Peril 3, last chapter: an island sinks for good this often (min 2 left). */
  sinkEvery: 45,
  soloSinkEvery: 35,
  minIslands: 2,
  /** Voltkit's Static Lance on a stranded Tidewyrm (water conducts). */
  lanceStagger: 15,
} as const;
/** Tidewyrm's attack order for a chapter. */
export function tidewyrmPattern(phase: number, peril: number): RaidAttack[] {
  if (phase === 1)
    return peril >= 3
      ? ["dive", "bubbles", "wave", "dive", "wave", "bubbles"]
      : ["dive", "bubbles", "wave", "dive", "bubbles"];
  if (phase === 2)
    return ["dive", "hightide", "bubbles", "prison", "dive", "undertow", "wave"];
  // Storm Surge: High Tide leads straight into a dive, Undertow into a wave.
  return ["hightide", "dive", "undertow", "prison", "bubbles", "dive"];
}
/** The attack order for a phase. Higher Perils add tougher combinations. */
export function raidPattern(
  phase: number,
  peril: number,
  partySize: number,
  boss: RaidBossId = "grumblecrag",
): RaidAttack[] {
  if (boss === "tidewyrm") return tidewyrmPattern(phase, peril);
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
/** The third signal means something different on each boss. */
export function raidPingLabel(kind: RaidPingKind, boss: RaidBossId = "grumblecrag") {
  if (kind === "bait" && boss === "tidewyrm") return "Island here";
  return RAID_PINGS[kind].label;
}
/** What some champions' skills do against Grumblecrag (see RAID_BOSS_PERKS). */
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
/** Champion tricks per boss (docs/raid-roster-design.md §6). */
export const RAID_BOSS_PERKS: Partial<
  Record<RaidBossId, Partial<Record<CharacterId, { skill: string; text: string }>>>
> = {
  grumblecrag: RAID_PERKS,
  tidewyrm: {
    voltkit: {
      skill: "Static Lance",
      text: "Hits on a stranded Tidewyrm add extra stagger (water conducts).",
    },
    cindrake: {
      skill: "Magma Bomb",
      text: "Pops a Bubble Prison in one hit.",
    },
    tidefin: {
      skill: "Mirror Mist",
      text: "While your clone is out, the dive ripple follows the clone instead of you.",
    },
    terradon: {
      skill: "Tremor",
      text: "Pops every bubble nearby and frees a raider from a Bubble Prison.",
    },
  },
};
export const raidPerksOf = (boss: RaidBossId) => RAID_BOSS_PERKS[boss] ?? {};
/** Chapter names and goals per boss. */
export const RAID_BOSS_CHAPTERS: Partial<
  Record<RaidBossId, readonly { name: string; objective: string; detail: string }[]>
> = {
  grumblecrag: RAID_CHAPTERS,
  tidewyrm: [
    {
      name: "Low Tide",
      objective: "Lead the dive onto an island. Jump the low wave.",
      detail:
        "When a ripple follows you, walk it onto an island and step off: Tidewyrm surfaces stranded on dry land, open to attack. Jump the low waves and weave through bubbles.",
    },
    {
      name: "Turning Tide",
      objective: "Share the islands. Pop trapped friends out.",
      detail:
        "High Tide floods the floor (two raiders fit on an island), the Undertow pulls everyone in, and a Bubble Prison carries one raider to the boss's mouth: pop it with three hits. Waves are high now: stand on an island.",
    },
    {
      name: "Storm Surge",
      objective: "Keep stranding it. Survive the combinations.",
      detail:
        "The rhythm quickens: High Tide leads straight into a dive, and the Undertow into a wave. On Peril 3 an island sinks for good every 45 seconds.",
    },
  ],
};
export const raidChapters = (boss: RaidBossId) =>
  RAID_BOSS_CHAPTERS[boss] ?? RAID_CHAPTERS;
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
  | "rockslide-flex"
  | "seafoam"
  | "pearlscale"
  | "riptide"
  | "reef"
  | "tidal-aura"
  | "splashdown";
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
  { id: "tidebreaker", boss: "tidewyrm", slot: "title", name: "Tidebreaker", description: "Title", goal: "First clear", rule: { kind: "clears", n: 1 } },
  { id: "seafoam", boss: "tidewyrm", slot: "skin", name: "Seafoam colors", description: "Sea-glass teal and foam white", goal: "5 clears", rule: { kind: "clears", n: 5 } },
  { id: "pearlscale", boss: "tidewyrm", slot: "skin", name: "Pearlscale skin", description: "Shimmering scales with pearl freckles", goal: "10 clears", rule: { kind: "clears", n: 10 } },
  { id: "riptide", boss: "tidewyrm", slot: "entrance", name: "Riptide entrance", description: "Burst up out of a splash each round", goal: "Clear Peril 2", rule: { kind: "peril", n: 2 } },
  { id: "leviathans-bane", boss: "tidewyrm", slot: "title", name: "Leviathan's Bane", description: "Title", goal: "Clear Peril 3", rule: { kind: "peril", n: 3 } },
  { id: "reef", boss: "tidewyrm", slot: "frame", name: "Reef frame", description: "A coral portrait frame with a pearl", goal: "Clear Peril 3", rule: { kind: "peril", n: 3 } },
  { id: "tidal-aura", boss: "tidewyrm", slot: "aura", name: "Tidal aura", description: "A rolling ring of water beneath your fighter", goal: "Clear Peril 3 with no downs", rule: { kind: "flawless", peril: 3 } },
  { id: "splashdown", boss: "tidewyrm", slot: "victory", name: "Splashdown", description: "A wave rises and crashes in a burst of spray behind you", goal: "Feat: strand Tidewyrm 4 times in one run", rule: { kind: "feat" } },
  { id: "flash-flood", boss: "tidewyrm", slot: "title", name: "Flash Flood", description: "Title", goal: "Clear Peril 2 solo in under 4:00", rule: { kind: "speed", peril: 2, party: 1, seconds: 240 } },
  { id: "lone-current", boss: "tidewyrm", slot: "title", name: "Lone Current", description: "Title", goal: "Clear Peril 3 solo (no self-revive)", rule: { kind: "solo", peril: 3 } },
  { id: "shipwright", boss: "tidewyrm", slot: "title", name: "Shipwright", description: "Title", goal: "Strand Tidewyrm 30 times (wins and losses)", rule: { kind: "stat", stat: "pillars", n: 30 } },
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
  murky: { name: "Murky", text: "Dive ripples are harder to see, but strands last a second longer." },
  "rip-current": { name: "Rip Current", text: "A stronger Undertow, but slower waves." },
  "spring-tide": { name: "Spring Tide", text: "High Tide lasts longer, but the islands are bigger." },
} as const;
export type RaidTrait = keyof typeof RAID_TRAITS;
/** Each boss's three traits; a run rolls one from its seed. */
export const RAID_BOSS_TRAITS: Partial<Record<RaidBossId, RaidTrait[]>> = {
  grumblecrag: ["restless", "fractured", "ancient"],
  tidewyrm: ["murky", "rip-current", "spring-tide"],
};
export const raidTraitFor = (boss: RaidBossId, seed: number) => {
  const list = RAID_BOSS_TRAITS[boss] ?? RAID_BOSS_TRAITS.grumblecrag!;
  return list[seed % list.length];
};
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
  footing: {
    name: "Sure Footing",
    text: "Bubbles can't root you, and you move 15% faster through water.",
    icon: "Dash",
  },
} as const;
export type RaidRite = keyof typeof RAID_RITES;
/** Themed rites only offered against their own boss. */
export const RAID_BOSS_RITES: Partial<Record<RaidRite, RaidBossId>> = {
  footing: "tidewyrm",
};
/** The rites a boss's runs can offer: the shared six plus its own. */
export const ritesFor = (boss: RaidBossId) =>
  (Object.keys(RAID_RITES) as RaidRite[]).filter(
    (id) => !RAID_BOSS_RITES[id] || RAID_BOSS_RITES[id] === boss,
  );
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
  /** Tidal Wave: a high wave (island only) rather than a low one (jump). */
  high?: boolean;
}
/** Tidewyrm's raised islands (walkable). */
export interface RaidIsland {
  x: number;
  y: number;
  radius: number;
  /** Strands it has taken this chapter. */
  cracks: number;
  /** Under water until the next chapter. */
  sunk: boolean;
  /** Peril 3, last chapter: sunk for good. */
  gone?: boolean;
}
/** A Tidal Wave band sweeping across the arena. */
export interface RaidWave {
  id: number;
  axis: "x" | "y";
  dir: 1 | -1;
  /** Where the band's centre is now, along its axis. */
  pos: number;
  speed: number;
  width: number;
  high: boolean;
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
  /** Tidewyrm: the islands of the Lagoon Court. */
  islands?: RaidIsland[];
  /** Tidewyrm is under water (can't be hit). */
  submerged?: boolean;
  /** High Tide: the floor is flooded until this time. */
  floodUntil?: number;
  waves?: RaidWave[];
  bubbles?: { id: number; x: number; y: number; vx: number; vy: number; until: number }[];
  /** Raiders sealed in a Bubble Prison, drifting to the boss's mouth. */
  prisons?: { playerId: string; x: number; y: number; hits: number; presses: number; until: number; startedAt: number }[];
  /** The Undertow's whirlpool, while it pulls. */
  undertow?: { x: number; y: number; until: number; radius: number };
  /** Times Tidewyrm has been stranded this run (its feat). */
  strands?: number;
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
