/**
 * Ascendant bosses: the evolved forms the Spire's boss floors use (the
 * first is Ascendant Cragmuff, floor 10). The same rig, arena and honesty
 * rules as the raid, pushed further: new moves built from the boss's kit,
 * combos, shorter openings and a boss that reads the fight. A raid becomes
 * one with `RaidState.variant`; the difficulty row is `RAID_ASCENDANT_TIER`.
 */
import type { RaidAttack, RaidTier } from "./raid.js";

/** An evolved form of a raid boss (none: the ordinary raid). */
export type RaidVariant = "ascendant";

/**
 * The Ascendant difficulty row: built from ★★★ (RAID_TIERS[3]) and pushed
 * past it. Telegraphs still never go below RAID_TELEGRAPH_FLOOR, jump
 * answers keep their length, and every fairness rule holds
 * (tests/unit/raid-fairness.test.ts, raid-star3-fairness.test.ts).
 */
export const RAID_ASCENDANT_TIER: RaidTier = {
  health: 1.45,
  damage: 2.3,
  cadence: 0.66,
  concurrency: [2, 3, 3],
  telegraph: 0.8,
  leadFraction: 0.9,
  leadCap: 180,
  windows: 0.6,
  enrageAt: 300,
  reviveSeconds: 4.5,
  reviveImmunity: 1,
  pressureFrom: 1,
};

/**
 * Ascendant Cragmuff's own numbers (damage before the tier multiplier).
 * Its ordinary attacks keep GRUMBLECRAG's numbers.
 */
export const ASCENDANT_CRAGMUFF = {
  name: "Ascendant Cragmuff",
  /** Avalanche Charge: a charge (the raid's speed and damage) that splits the floor behind it. */
  avalanche: { width: 80, delay: 1.6 },
  /** Its volley's telegraph (s): never shortened below this. */
  volleyDelay: 1.5,
  /** The magma line an avalanche leaves along its path. */
  fissure: { damage: 24, width: 150, delay: 1.05 },
  /** Twin Slam: a ring round the boss, then a second, apart from it, toward its target. */
  twinSlam: {
    damage: 27,
    radius: 215,
    farRadius: 185,
    delay: 1.25,
    /** The far ring lands this long after the first (at least RAID_IMPACT_GAP). */
    gap: 0.6,
  },
  /** A wind-up that turns into a different attack (both fully telegraphed). */
  feint: {
    /** Chance a slam is a feint, by chapter. */
    chance: [0.25, 0.35, 0.45],
    /** Share of the slam's telegraph shown before it turns. */
    turnAt: 0.55,
  },
  /** Reading habits: where each raider usually dodges. */
  habit: {
    /** Dodges remembered before the boss trusts the habit. */
    samples: 3,
    /** How consistent the dodges must be (0-1, length of the mean direction). */
    consistency: 0.55,
    /** A circle aimed at a habit sits this share of its radius toward it. */
    offset: 0.5,
  },
  /** Standing still to attack: seconds still, and seconds since the last hit. */
  anchor: { still: 1.2, hit: 1.0, speed: 40 },
  /** A raider kneeling by a fallen ally is the first target. */
  reviverBonus: 2.4,
  /** Openings: pillar pause, and the stagger window (× the tier's windows). */
  pillarPause: 1.2,
  /** Chapter 3's cracked core: no bonus (normal Cragmuff: 1.2). */
  crackedCore: 1,
} as const;

/** Ascendant Cragmuff's attack order for a chapter. */
export function ascendantCragmuffPattern(
  phase: number,
  partySize: number,
): RaidAttack[] {
  // A meteor needs friends to share it; alone it becomes another volley.
  const meteor: RaidAttack = partySize > 1 ? "share" : "volley";
  if (phase === 1)
    return [
      "charge",
      "slam",
      "volley",
      "avalanche",
      "eruption",
      "twin-slam",
      "debris",
    ];
  if (phase === 2)
    return [
      "avalanche",
      "twin-slam",
      "eruption",
      "charge",
      meteor,
      "slam",
      "debris",
    ];
  return [
    "avalanche",
    "twin-slam",
    "volley",
    meteor,
    "charge",
    "eruption",
    "slam",
  ];
}

/** Every Ascendant boss's attacks for the guide (the raid's six, then its new moves). */
export const RAID_ASCENDANT_ATTACKS: Partial<Record<string, RaidAttack[]>> = {
  grumblecrag: [
    "charge",
    "slam",
    "volley",
    "debris",
    "eruption",
    "share",
    "avalanche",
    "twin-slam",
  ],
};

/** Ascendant Cragmuff's three chapters. */
export const ASCENDANT_CRAGMUFF_CHAPTERS = [
  {
    name: "Obsidian Wake",
    objective: "Bait charges into pillars. Jump both rings of the Twin Slam.",
    detail:
      "It reads you: eruptions land where you usually dodge, and standing still to attack draws a stomp. An Avalanche Charge splits the floor along its lane: stay off the glowing line until it erupts.",
  },
  {
    name: "Magma Veins",
    objective: "Break pillars fast. Watch for feints.",
    detail:
      "A slam may turn into a volley or an eruption halfway: the new warning is shown in full, so react to what is drawn now. It hunts whoever kneels to revive. Volleys chain into eruptions.",
  },
  {
    name: "Ascendant Heart",
    objective: "Open the core with pillars. Survive the combinations.",
    detail:
      "The cracked core takes no extra damage now: bait charges into pillars to open it. Twin Slams call down debris, meteors scatter into eruptions, and the ring of spikes closes in.",
  },
] as const;
