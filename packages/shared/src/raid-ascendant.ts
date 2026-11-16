/**
 * Ascendant bosses: the evolved forms the Spire's boss floors use (the
 * first is Ascendant Cragmuff, floor 10). The same rig, arena and honesty
 * rules as the raid, pushed further: new moves built from the boss's kit,
 * combos, shorter openings and a boss that reads the fight. A raid becomes
 * one with `RaidState.variant`; the difficulty row is `RAID_ASCENDANT_TIER`.
 */
import type { RaidAttack, RaidBossId, RaidTier } from "./raid.js";

/** An evolved form of a raid boss (none: the ordinary raid). */
export type RaidVariant = "ascendant";

/**
 * Is this raid the Ascendant form of `boss`? Each Ascendant's rules layer
 * acts only then, so one arena can carry several layers (the Spire's zones).
 */
export const isAscendant = (
  r: { variant?: RaidVariant; boss: RaidBossId },
  boss: RaidBossId,
) => r.variant === "ascendant" && r.boss === boss;

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
  tidewyrm: [
    "dive",
    "wave",
    "bubbles",
    "hightide",
    "undertow",
    "prison",
    "breaker",
    "geyser",
  ],
  gloomshade: [
    "lunge",
    "hands",
    "snuff",
    "curse",
    "split",
    "pulse",
    "nightfall",
    "pounce",
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

/**
 * Ascendant Tidelotl's own numbers (damage before the tier multiplier), the
 * Spire's twentieth floor. Its ordinary attacks keep TIDEWYRM's numbers.
 */
export const ASCENDANT_TIDELOTL = {
  name: "Ascendant Tidelotl",
  /**
   * Health added per extra raider: the raid's own scaling (850). A party is
   * held back by pressure instead (combos, echoes, overlaps, harder hits):
   * more health only made its fights twice as long as Ascendant Cragmuff's.
   */
  perExtraPlayer: 850,
  /** Seconds a teammate kneels to revive (the Ascendant tier: 4.5). */
  reviveSeconds: 6.5,
  /**
   * Breaker Wall: a towering wave that sweeps the whole court from one edge
   * (it can't be jumped). Lanes of calm water cross it (`gapWidth` wide,
   * `spacing` apart): stand in one, or on an island, as it passes.
   */
  breaker: {
    delay: 1.6,
    width: 90,
    speed: 560,
    damage: 30,
    gapWidth: 170,
    spacing: 420,
  },
  /**
   * Geyser Line: three geysers in a row under a raider, all marked at once,
   * erupting one after another (`gap` apart) along where they run or
   * usually dodge.
   */
  geyser: { radius: 85, delay: 1.5, step: 150, count: 3, gap: 0.5, damage: 26 },
  /** Chapter 3: once a Breaker Wall has crossed, geysers erupt this much later. */
  breakerGeysers: 0.5,
  /** A dive whose ripple turns, part-way through its follow, into a Geyser Line. */
  feint: {
    /** Chance a dive is a feint, by chapter. */
    chance: [0.2, 0.3, 0.4],
    /** Share of the ripple's follow shown before it turns. */
    turnAt: 0.5,
  },
  /** Reading habits (as Ascendant Cragmuff reads them). */
  habit: { samples: 3, consistency: 0.55, offset: 0.5 },
  /** Standing still to attack: seconds still, and seconds since the last hit. */
  anchor: { still: 1.2, hit: 1.0, speed: 40 },
  /** As a strand ends it sweeps its tail twice: a wider second ring. */
  secondSweep: { radius: 175 },
  /**
   * Pressure by chapter: seconds between attacks × this (the tier's cadence
   * and the party's are applied first).
   */
  cadence: [1, 0.95, 0.78],
  /** First chapter of each combo: a missed dive, a bubble fan and a crossed Breaker Wall raise geysers. */
  combosFrom: { dive: 1, bubbles: 1, breaker: 2 },
  /**
   * Party pressure: Geyser Lines also go at a second raider from this many
   * raiders alive, bubble fans from this chapter (3+ raiders).
   */
  echo: { geyserRaiders: 2, bubblesFrom: 1 },
  /**
   * Overlap: from chapter `from`, with `raiders` or more alive, a Geyser Line
   * or a bubble fan may start while one of these plays out (they don't move
   * the boss or need the whole floor at once). The raid's overlap rules
   * still space the impacts and keep everyone a safe spot.
   */
  overlap: {
    from: 1,
    raiders: 2,
    with: ["hightide", "undertow", "prison"] as readonly RaidAttack[],
  },
  /** Strand and stagger windows × (1 + this per extra raider): a party's punish window. */
  partyWindows: 0.15,
  /** Its attacks hit harder by this share per extra raider (instead of more health). */
  partyDamage: 0.25,
} as const;

/** Ascendant Tidelotl's attack order for a chapter. */
export function ascendantTidelotlPattern(phase: number): RaidAttack[] {
  if (phase === 1)
    return ["dive", "bubbles", "breaker", "dive", "geyser", "wave", "bubbles"];
  if (phase === 2)
    return [
      "dive",
      "hightide",
      "breaker",
      "bubbles",
      "prison",
      "dive",
      "geyser",
      "undertow",
    ];
  return [
    "hightide",
    "dive",
    "breaker",
    "undertow",
    "prison",
    "geyser",
    "bubbles",
    "dive",
  ];
}

/** Ascendant Tidelotl's three chapters. */
export const ASCENDANT_TIDELOTL_CHAPTERS = [
  {
    name: "Abyssal Swell",
    objective: "Lead dives onto islands. Find the calm lane in a Breaker Wall.",
    detail:
      "A Breaker Wall can't be jumped: stand in a lane of calm water, or on an island, as it passes. Bubble fans and dives that miss chain into geysers, and standing still to attack draws a Geyser Line.",
  },
  {
    name: "Lightless Deep",
    objective: "Strand it fast. Watch for a ripple that turns.",
    detail:
      "A dive's ripple may sink away and become a Geyser Line: the new warning is shown in full, so react to what is drawn now. When a Breaker Wall has crossed, geysers erupt under you. It hunts whoever kneels to revive.",
  },
  {
    name: "Ascendant Tide",
    objective: "Strand it. Survive the combinations.",
    detail:
      "Its rhythm quickens. As a strand ends it sweeps its tail twice, the second ring wider. High Tide leads into a dive, the Undertow into a wave.",
  },
] as const;

/**
 * Ascendant Inkpurr's own numbers (damage before the tier multiplier), the
 * Spire's thirtieth floor (Gloomshade's id). Its ordinary attacks keep
 * GLOOMSHADE's numbers.
 */
export const ASCENDANT_INKPURR = {
  name: "Ascendant Inkpurr",
  /** Health added per extra raider (the raid's own: 1000). */
  perExtraPlayer: 650,
  /** Seconds a teammate kneels to revive (the Ascendant tier: 4.5). */
  reviveSeconds: 5.5,
  /**
   * Nightfall: the dark swallows the yard. Only lit lanterns and the pools
   * of moonlight it leaves (one near each raider, `near`-`far` px away and
   * always within reach) are safe; the dark hurts and adds a curse stack.
   * The pools stay lit `linger` s after it lands (they cleanse like lanterns).
   */
  nightfall: {
    delay: 1.7,
    damage: 26,
    poolRadius: 115,
    near: 150,
    far: 230,
    /** A teaching Nightfall's pools sit this close. */
    teachNear: 90,
    linger: 4,
    /**
     * The court under a phone's touch controls (world px: x0, y0, x1, y1),
     * each control's box at 667x375 and 844x390 together, measured in the
     * visual harness: the joystick, dash, jump, the skills, the ultimate,
     * the attack button and the target portraits round it. A pool's centre
     * never sits within `controlMargin` of one, and at most `coverMax` of
     * its disc lies under them; a raider deep in that corner walks farther
     * (up to `farthest` px) and Nightfall waits for them.
     */
    phoneControls: [
      [-260, 560, 183, 835],
      [1528, 455, 1868, 600],
      [1534, 630, 1874, 774],
      [1124, 686, 1486, 848],
      [1078, 497, 1440, 660],
      [1188, 337, 1550, 501],
      [1381, 305, 1750, 479],
      [1269, 497, 1714, 745],
      [1184, 156, 1294, 296],
      [1316, 156, 1426, 266],
      [1405, 164, 1560, 299],
      [1533, 164, 1643, 274],
      [1574, 186, 1769, 341],
      [-298, 155, 22, 286],
    ] as readonly (readonly [number, number, number, number])[],
    controlMargin: 20,
    coverMax: 0.4,
    farthest: 560,
  },
  /**
   * Shade Pounce: every body leaps onto a raider, one after another (`gap`
   * apart): the copies first (each at the raider nearest it), the real one
   * last. A copy's landing curses; the real one's hurts more, and if it lands
   * in lantern light its shadow gives it away (`reveal` s). Without copies
   * the real one pounces twice; leaps at the same raider chase them.
   */
  pounce: {
    delay: 1.45,
    radius: 105,
    gap: 0.5,
    damage: 30,
    copyDamage: 20,
    /** At most this many copies leap with it. */
    copies: 3,
    /** Leaps at one raider land this many radii apart, along their dodge. */
    chase: 1.4,
    reveal: 1.2,
  },
  /** A lunge whose lanes sink part-way and turn into a Shade Pounce. */
  feint: {
    /** Chance a lunge is a feint, by chapter. */
    chance: [0.2, 0.3, 0.4],
    /** Share of the lunge's follow shown before it turns. */
    turnAt: 0.5,
  },
  /** A pair's seconds between attacks × this (the raid speeds up only for 3+: GLOOMSHADE.party). */
  pairCadence: 0.65,
  /** In a party under three, this many copies lunge with it (the raid: none). */
  copyLunges: 3,
  /**
   * Alone and in a pair, its splits make this many more copies than the
   * raid's (which makes one fewer alone, and one more only from 3 raiders).
   */
  extraCopies: [3, 1],
  /** Reading habits (as Ascendant Cragmuff reads them). */
  habit: { samples: 3, consistency: 0.55, offset: 0.5 },
  /** Standing still to attack: seconds still, and seconds since the last hit. */
  anchor: { still: 1.2, hit: 1.0, speed: 40 },
  /**
   * Pressure by chapter: seconds between attacks × this (the tier's cadence
   * and the party's are applied first).
   */
  cadence: [0.8, 0.72, 0.64],
  /**
   * First chapter of each combo: a lunge ends in a pounce on its raider, a
   * snuffed lantern's darkness lunges at whoever stood in its light, and a
   * Nightfall that has landed sends every body pouncing.
   */
  combosFrom: { lunge: 1, snuff: 2, nightfall: 2 },
  /**
   * Overlap: from chapter `from`, with `raiders` or more alive, a Shade
   * Pounce may bring Grasping Hands (`chance` of its casts): the board closes
   * just after the last leap, laid so every raider keeps a reachable lit
   * tile outside every circle, or there are no hands.
   */
  overlap: { from: 2, raiders: 2, chance: 0.5 },
  /** Exposure and stagger windows × (1 + this per extra raider). */
  partyWindows: 0.1,
  /** Its attacks hit harder by this share per extra raider (instead of more health). */
  partyDamage: 0.05,
} as const;

/** Ascendant Inkpurr's attack order for a chapter (it splits from chapter 1). */
export function ascendantInkpurrPattern(phase: number): RaidAttack[] {
  if (phase === 1)
    return [
      "lunge",
      "hands",
      "pounce",
      "snuff",
      "nightfall",
      "split",
      "lunge",
      "pounce",
    ];
  if (phase === 2)
    return [
      "split",
      "lunge",
      "nightfall",
      "curse",
      "pounce",
      "hands",
      "snuff",
      "pulse",
      "pounce",
    ];
  return [
    "nightfall",
    "pulse",
    "pounce",
    "lunge",
    "curse",
    "snuff",
    "hands",
    "pounce",
    "lunge",
  ];
}

/** Ascendant Inkpurr's three chapters. */
export const ASCENDANT_INKPURR_CHAPTERS = [
  {
    name: "Eclipsed Yard",
    objective: "Get into the light before Nightfall. Step out of every pounce.",
    detail:
      "It splits early. Nightfall darkens the yard: only lit lanterns and the pools of moonlight are safe, and the pools never sit where you stand. Bodies pounce one after another; the real one lands last. A lunge ends in a pounce on whoever it chased.",
  },
  {
    name: "Ink Tide",
    objective:
      "Keep the lanterns lit. Watch the board and the pounces at once.",
    detail:
      "Once Nightfall lands every body pounces, and a snuffed lantern's darkness lunges at whoever stood in its light. With friends close by, a pounce may bring Grasping Hands: a lit tile outside every circle is always within reach. It hunts whoever kneels to revive.",
  },
  {
    name: "Midnight Ascendant",
    objective: "Survive the combinations. Catch its shadow in the light.",
    detail:
      "Its rhythm quickens. A lunge may sink into the dark halfway and become a pounce: react to what is drawn now. A real one that lands in lantern light casts a shadow: hit it before it fades. Standing still to attack draws a pounce.",
  },
] as const;
