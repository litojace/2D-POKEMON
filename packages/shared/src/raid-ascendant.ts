/**
 * Ascendant bosses: the evolved forms the Spire's boss floors use (the
 * first is Ascendant Cragmuff, floor 10). The same rig, arena and honesty
 * rules as the raid, pushed further: new moves built from the boss's kit,
 * combos, shorter openings and a boss that reads the fight. A raid becomes
 * one with `RaidState.variant`; the difficulty row is `RAID_ASCENDANT_TIER`.
 */
import type { DreamRune, RaidAttack, RaidBossId, RaidTier } from "./raid.js";
import type { LightPoint } from "./raid-prismatail.js";
import { SPIRE_PHONE_CONTROLS } from "./spire.js";

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
  somnara: [
    "lullaby",
    "tail-splash",
    "dream-bubbles",
    "falling-stars",
    "whale-song",
    "dream-sequence",
    "twin-dream",
    "dream-tide",
  ],
  prismatail: [
    "prism-lance",
    "fan-display",
    "glare",
    "refraction",
    "halo-crush",
    "light-relay",
    "eclipse",
    "umbral-prism",
  ],
  emberwing: [
    "dive-bomb",
    "ember-rain",
    "wing-gust",
    "flame-ring",
    "scorched-earth",
    "heat-mark",
    "snuff-gale",
    "bound-wicks",
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
     * The court under a phone's touch controls (SPIRE_PHONE_CONTROLS: the
     * joystick, dash, jump, the three skills, the ultimate and the attack
     * button; phones have no target row). A pool's centre
     * never sits within `controlMargin` of one, and at most `coverMax` of
     * its disc lies under them; a raider deep in that corner walks farther
     * (up to `farthest` px) and Nightfall waits for them.
     */
    phoneControls: SPIRE_PHONE_CONTROLS,
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
  cadence: [0.95, 0.86, 0.78],
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

/**
 * Ascendant Snoozaku's own numbers (damage before the tier multiplier), the
 * Spire's fortieth floor (Somnara's id). Its ordinary attacks keep
 * SOMNARA's numbers.
 */
export const ASCENDANT_SNOOZAKU = {
  name: "Ascendant Snoozaku",
  /** Health added per extra raider (the raid's own: 1000). */
  perExtraPlayer: 1150,
  /** Seconds a teammate kneels to revive (the Ascendant tier: 4.5). */
  reviveSeconds: 5.5,
  /**
   * Its rune pads: the raid's square pulled in at the bottom right, so no pad
   * (nor a Dream Tide's awake ring round it) sits under a phone's touch
   * controls (`phoneControls`).
   */
  pads: [
    { rune: "circle", x: 530, y: 250 },
    { rune: "star", x: 1070, y: 250 },
    { rune: "moon", x: 960, y: 650 },
    { rune: "wave", x: 640, y: 650 },
  ] as readonly { rune: DreamRune; x: number; y: number }[],
  /**
   * The court under a phone's touch controls (SPIRE_PHONE_CONTROLS: the
   * joystick, dash, jump, the three skills, the ultimate and the attack
   * button; phones have no target row). No pad, no awake ring and no safe
   * spot the boss leaves sits within `controlMargin` of one.
   */
  phoneControls: SPIRE_PHONE_CONTROLS,
  controlMargin: 12,
  /** Each chapter's dreams are this many runes longer than the raid's. */
  longerDreams: [0, 0, 0],
  /**
   * Twin Dream: two Dreamers share one dream, one rune longer; each sees only
   * their own steps (the first Dreamer the 1st, 3rd…, the second the 2nd,
   * 4th…) and they call in turn. Alone, the dream shows for `glimpse` s,
   * then fades: what is left is remembered.
   */
  twin: { seconds: 11, extra: 1, glimpse: 3.2, soloSeconds: 12 },
  /**
   * Dream Tide: sleep floods the deck; only one pad stays awake (`radius`
   * round its centre). One raider (the Seer) sees which and calls it. It
   * lands when the slowest raider, reacting `reaction` s to the vision and
   * again to the call (`call` s to make it), can walk well into the ring;
   * never sooner than `delay`. Pads farther than `maxWalk` from someone are
   * never the awake one. The deck hurts and adds a Drowsy stack.
   */
  tide: {
    delay: 3,
    radius: 105,
    call: 0.6,
    damage: 32,
    maxWalk: 620,
  },
  /** A Trunk Slam whose wind-up turns, part-way, into Falling Stars at its target. */
  feint: {
    /** Chance a trunk slam is a feint, by chapter. */
    chance: [0.2, 0.3, 0.4],
    /** Share of the slam's telegraph shown before it turns. */
    turnAt: 0.5,
  },
  /** Reading habits (as Ascendant Cragmuff reads them). */
  habit: { samples: 3, consistency: 0.55, offset: 0.55 },
  /** Standing still to attack: seconds still, and seconds since the last hit. */
  anchor: { still: 1.2, hit: 1.0, speed: 40 },
  /**
   * Pressure by chapter: seconds between attacks × this (the tier's cadence
   * and the party's are applied first).
   */
  cadence: [0.9, 0.82, 0.72],
  /**
   * Alone: seconds between attacks × this as well (the raid's own solo
   * rhythm applies first), and a dream lasts this long (the raid: 13 s).
   */
  solo: { cadence: 0.85, seconds: 11 },
  /** Mid-dream it slows down only this much (the raid: SOMNARA.dreamCadence). */
  dreamCadence: 1.15,
  /**
   * First chapter of each combo: a trunk slam that misses calls stars down
   * on its raider; a Nightmare drops stars on whoever stepped wrong (or the
   * Dreamer, on a timeout); a Dream Tide that lands rings out lullabies
   * from the awake pad.
   */
  combosFrom: { tail: 1, nightmare: 2, tide: 2 },
  /** A combo's stars: how many, and their circle (SOMNARA.stars.radius). */
  comboStars: 3,
  /**
   * Overlap: from chapter `from`, with `raiders` or more alive, Falling
   * Stars may land while a lullaby's rings or dream bubbles are out (the raid's
   * rules space impacts and keep a safe spot, off the wrong pads mid-dream
   * and clear of the phone's controls).
   */
  overlap: { from: 1, raiders: 2 },
  /** Exposure and stagger windows × (1 + this per extra raider). */
  partyWindows: 0.1,
  /** Its attacks hit harder by this share per extra raider (instead of more health). */
  partyDamage: 0,
  /** Its attacks hit this much harder than the tier's, by party size (1-4). */
  damage: [1.4, 1.15, 1.12, 1.15],
} as const;

/** Ascendant Snoozaku's attack order for a chapter. */
export function ascendantSnoozakuPattern(phase: number): RaidAttack[] {
  if (phase === 1)
    return [
      "dream-sequence",
      "tail-splash",
      "lullaby",
      "dream-tide",
      "falling-stars",
      "twin-dream",
      "dream-bubbles",
    ];
  if (phase === 2)
    return [
      "twin-dream",
      "falling-stars",
      "lullaby",
      "dream-tide",
      "tail-splash",
      "whale-song",
      "dream-bubbles",
      "dream-sequence",
    ];
  return [
    "twin-dream",
    "dream-tide",
    "falling-stars",
    "lullaby",
    "whale-song",
    "tail-splash",
    "dream-sequence",
    "dream-bubbles",
  ];
}

/** Ascendant Snoozaku's three chapters. */
export const ASCENDANT_SNOOZAKU_CHAPTERS = [
  {
    name: "Restless Slumber",
    objective:
      "Listen for the call when the Dream Tide rises. Share the Twin Dream.",
    detail:
      "A Dream Tide floods the deck: only one pad stays awake, and only the marked raider sees which. They call it; everyone runs there. In a Twin Dream two Dreamers each see half the runes: take turns calling. A trunk slam that misses calls stars down on you.",
  },
  {
    name: "Lucid Depths",
    objective: "Call fast and clearly. Watch for a slam that turns.",
    detail:
      "A trunk slam may turn into Falling Stars halfway: the new warning is shown in full, so react to what is drawn now. A Nightmare drops stars on whoever stepped wrong, and a landed Dream Tide rings out lullabies from the awake pad. It hunts whoever kneels to revive.",
  },
  {
    name: "Ascendant Dream",
    objective: "Survive the combinations. Keep the calls coming.",
    detail:
      "Its rhythm quickens. Stars fall where you usually dodge, and standing still to attack draws them onto you. Keep moving, keep calling, and strike the star-heart when it wakes.",
  },
] as const;

/**
 * Ascendant Prismell's own numbers (damage before the tier multiplier), the
 * Spire's fiftieth floor (Prismatail's id). Its ordinary attacks keep
 * PRISMATAIL's numbers, and its raid's rules hold: the skylight's beam is
 * passed raider to raider (and through the mirrors) into the heart, and only
 * a held relay opens the shield.
 */
export const ASCENDANT_PRISMELL = {
  name: "Ascendant Prismell",
  /** Health added per extra raider (the raid's own: 880). */
  perExtraPlayer: 400,
  /** Seconds a teammate kneels to revive (the Ascendant tier: 4.5). */
  reviveSeconds: 5.5,
  /**
   * Where it rests, by chapter (x; the raid backs off to 1040 and 1080):
   * its heart stays clear of a phone's touch controls (`heartClear` px round
   * it, plus `controlMargin`).
   */
  home: [1000, 1000, 1000],
  heartClear: 60,
  /**
   * The court under a phone's touch controls (SPIRE_PHONE_CONTROLS: the
   * joystick, dash, jump, the three skills, the ultimate and the attack
   * button; phones have no target row). No skylight, mirror, heart, halo
   * gap or safe spot sits within `controlMargin` of one.
   */
  phoneControls: SPIRE_PHONE_CONTROLS,
  controlMargin: 12,
  /** The open shield lasts this long (the raid: 5 s), × the party's windows. */
  expose: 3.8,
  /**
   * The skylight windows an Eclipse moves the light between: one skylight
   * (the raid's own place first), or the last chapter's pair with a party.
   * Every window has a mirror within a raider's reach of its light.
   */
  windows: {
    single: [[{ x: 350, y: 450 }], [{ x: 560, y: 170 }], [{ x: 560, y: 730 }]],
    pair: [
      [
        { x: 350, y: 300 },
        { x: 350, y: 600 },
      ],
      [
        { x: 560, y: 170 },
        { x: 560, y: 730 },
      ],
    ],
  } as {
    single: readonly (readonly LightPoint[])[];
    pair: readonly (readonly LightPoint[])[];
  },
  /**
   * Eclipse: a dark moon crosses the skylight. Sunfall strikes the old
   * window (a circle `radius` round it, after `delay`), and the light opens
   * at another window, shown from the start: the relay starts again there.
   */
  eclipse: { delay: 2, radius: 135, damage: 26 },
  /**
   * Umbral Prism: a dark prism lodges on a raider. It blocks the light (no
   * beam passes through them) and only light handed to them cleanses it:
   * from a teammate or a mirror at least `apart` px away (alone, the
   * skylight's own reach), for `lit` s, before it shatters (`damage`, a
   * Glare's blindness, and the relay's hold is lost). The timer is never
   * shorter than the slowest pair walking into place after a reaction.
   * Marks per cast by chapter, with three raiders or more (else one).
   */
  umbral: {
    lit: 0.8,
    apart: 140,
    damage: 30,
    min: 4.5,
    spare: 0.5,
    radius: 46,
    marks: [1, 2, 2],
    /** Marks per cast by chapter with four raiders up. */
    marksFour: [2, 2, 3],
    /** Out of the light, its glow fades this much slower than it fills. */
    decay: 0.5,
  },
  /** A Prism Lance whose lane, part-way, curls into a Halo Crush round its raider. */
  feint: {
    /** Chance a lance is a feint, by chapter. */
    chance: [0.2, 0.3, 0.4],
    /** Share of the lance's telegraph shown before it turns. */
    turnAt: 0.5,
  },
  /** Reading habits (as Ascendant Cragmuff reads them). */
  habit: { samples: 3, consistency: 0.55, offset: 0.5 },
  /** Standing still to attack: seconds still, and seconds since the last hit. */
  anchor: { still: 1.2, hit: 1.0, speed: 40 },
  /**
   * Pressure by chapter: seconds between attacks × this (the tier's cadence
   * and the party's are applied first).
   */
  cadence: [0.7, 0.63, 0.56],
  /**
   * A party's seconds between attacks × (1 - this per extra raider): more
   * raiders meet more attacks (not harder hits).
   */
  partyCadence: 0.11,
  /**
   * First chapter of each combo: a Prism Lance that misses closes a Halo
   * Crush round its raider; an Eclipse that lands sends lances after whoever
   * stood in the old light (at most `comboLances`).
   */
  combosFrom: { lance: 1, eclipse: 2 },
  comboLances: 2,
  /**
   * Overlap: from chapter `from`, with `raiders` or more alive, a lance or a
   * fan may play out while a Halo Crush closes (the safe-spot rule keeps
   * every raider a spot clear of both and of the phone's controls).
   */
  overlap: { from: 1, raiders: 2 },
  /** Exposure windows × (1 + this per extra raider). */
  partyWindows: 0,
  /** Its attacks hit harder by this share per extra raider. */
  partyDamage: 0,
  /** Its attacks hit this much harder than the tier's, by party size (1-4). */
  damage: [0.95, 1.15, 1.15, 1.15],
} as const;

/**
 * Ascendant Prismell's attack order for a chapter (the raid's trait rules
 * apply: Dazzling adds a Glare, Overcast fires no plain lances).
 */
export function ascendantPrismellPattern(
  phase: number,
  trait = "",
): RaidAttack[] {
  const attacks: RaidAttack[] =
    phase === 1
      ? [
          "prism-lance",
          "fan-display",
          "eclipse",
          "glare",
          "umbral-prism",
          "halo-crush",
          "prism-lance",
        ]
      : phase === 2
        ? [
            "refraction",
            "umbral-prism",
            "halo-crush",
            "eclipse",
            "fan-display",
            "prism-lance",
            "glare",
          ]
        : [
            "eclipse",
            "prism-lance",
            "umbral-prism",
            "halo-crush",
            "refraction",
            "fan-display",
            "glare",
            "prism-lance",
          ];
  if (trait === "dazzling") attacks.push("glare");
  return trait === "overcast"
    ? attacks.filter((a) => a !== "prism-lance")
    : attacks;
}

/** Ascendant Prismell's three chapters. */
export const ASCENDANT_PRISMELL_CHAPTERS = [
  {
    name: "Corona Dawn",
    objective: "Rebuild the relay when the sun moves. Hand the light on.",
    detail:
      "An Eclipse darkens the skylight: sunfall strikes it and the light opens at another window, shown from the start. An Umbral Prism blocks the light through its raider: a teammate or a mirror must shine on them from a step away to cleanse it. A lance that misses closes a halo round you.",
  },
  {
    name: "Zenith Glass",
    objective: "Keep the light moving. Watch for a lance that turns.",
    detail:
      "A Prism Lance may curl into a Halo Crush halfway: the new warning is shown in full, so react to what is drawn now. A landed Eclipse sends lances after whoever stood in the old light. Lances may fly while a halo closes. It hunts whoever kneels to revive.",
  },
  {
    name: "Ascendant Corona",
    objective: "Two paths, moving suns. Survive the combinations.",
    detail:
      "Its rhythm quickens. Halos close where you usually dodge, and standing still to attack draws a lance. An Eclipse moves both skylights: split up and rebuild both paths within 3 seconds.",
  },
] as const;

/**
 * Ascendant Lumiwick's own numbers (damage before the tier multiplier), the
 * Spire's sixtieth floor (Emberwing's id). Its ordinary attacks keep
 * EMBERWING's numbers, and its raid's rule holds: only all three braziers
 * burning at once pull the smug sky-lantern out of the sky.
 */
export const ASCENDANT_LUMIWICK = {
  name: "Ascendant Lumiwick",
  /** Health added per extra raider (the raid's own: 830). */
  perExtraPlayer: 1150,
  /** Seconds a teammate kneels to revive (the Ascendant tier: 4.5). */
  reviveSeconds: 5,
  /**
   * Its braziers: the raid's triangle pulled in from the bottom right, so no
   * ring (nor a raider standing anywhere in one) sits within `controlMargin`
   * of a phone's touch controls (`phoneControls`).
   */
  braziers: [
    { x: 780, y: 270 },
    { x: 590, y: 590 },
    { x: 970, y: 590 },
  ] as readonly { x: number; y: number }[],
  /**
   * Where it hovers (the raid: 1100, 480) and how far it sways, aloft and on
   * the ground: its heart (`heartClear` px round it) stays clear of the
   * controls wherever it is brought down; after a dive it glides back
   * (`glide` px/s) before its heart opens anywhere under them.
   */
  home: { x: 880, y: 420 },
  sway: { air: 130, ground: 75 },
  heartClear: 60,
  glide: 520,
  /**
   * The court under a phone's touch controls (SPIRE_PHONE_CONTROLS: the
   * joystick, dash, jump, the three skills, the ultimate and the attack
   * button; phones have no target row). No brazier ring, no shelter, the
   * heart and no safe spot the boss leaves sits within `controlMargin`.
   */
  phoneControls: SPIRE_PHONE_CONTROLS,
  controlMargin: 12,
  /** The open heart lasts this long (the raid: 5 s), × the party's windows. */
  expose: 3.5,
  /** Seconds a raider stands in a ring to light it (the raid: 2). */
  light: 2.6,
  /**
   * Snuffing Gale: Lumiwick blows a cold gale down a lane (`width` px each
   * side of its line) from itself through a brazier that burns or is being
   * lit, and `past` px on. A flame with nobody in its ring goes out; a raider
   * standing in any brazier's ring is sheltered (the flame holds its
   * keeper); anyone else in the lane is hit and blown along it. It only aims
   * at a flame some raider can reach in time (slowest speed, after a
   * reaction, `spare` s to spare); else the lane goes at a raider.
   */
  gale: {
    delay: 1.9,
    width: 58,
    past: 260,
    damage: 18,
    push: 140,
    spare: 0.15,
  },
  /**
   * Bound Wicks: a burning wick binds two braziers (three in the last
   * chapter, with three raiders up): they catch only together, while every
   * bound ring has a raider in it. The fuse burns for as long as the
   * slowest team needs to walk in after a reaction and light them (`spare`
   * s more, never under `min`); if it burns out first the wick snaps: a
   * Backdraft bursts from each bound brazier (its ring and `burst` px
   * round it) and every flame goes out. Never alone.
   */
  wicks: {
    min: 6,
    spare: 1.4,
    burst: 45,
    damage: 28,
    bound: [2, 2, 3],
  },
  /** A Dive Bomb whose lane, part-way, turns into a Snuffing Gale. */
  feint: {
    /** Chance a dive is a feint, by chapter. */
    chance: [0.15, 0.25, 0.35],
    /** Share of the dive's telegraph shown before it turns. */
    turnAt: 0.5,
  },
  /**
   * Reading habits (as Ascendant Cragmuff reads them): embers also fall
   * `offset` px from a raider, where they usually dodge to.
   */
  habit: { samples: 3, consistency: 0.55, offset: 100 },
  /** Standing still to attack: seconds still, and seconds since the last hit. */
  anchor: { still: 1.2, hit: 1.0, speed: 40 },
  /**
   * Pressure by chapter: seconds between attacks × this (the tier's cadence
   * and the party's are applied first).
   */
  cadence: [0.95, 0.86, 0.78],
  /**
   * A party's seconds between attacks × (1 - this per extra raider): more
   * raiders meet more attacks (not harder hits).
   */
  partyCadence: 0.03,
  /**
   * First chapter of each combo: a gale whose flame was held drops embers on
   * its keeper; kindled Bound Wicks answer with a gale at one of the flames
   * just lit (its keepers are already there: hold).
   */
  combosFrom: { gale: 1, wicks: 2 },
  /**
   * Overlap: from chapter `from`, with `raiders` or more alive, embers, heat
   * marks and gusts may play out while a Snuffing Gale is drawn (the
   * safe-spot rule keeps every raider a spot clear of all of them and of the
   * phone's controls).
   */
  overlap: { from: 2, raiders: 2 },
  /** Exposure windows × (1 + this per extra raider). */
  partyWindows: 0,
  /** Its attacks hit harder by this share per extra raider. */
  partyDamage: 0,
  /** Its attacks hit this much harder than the tier's, by party size (1-4). */
  damage: [1, 1.05, 1.05, 1],
} as const;

/**
 * Ascendant Lumiwick's attack order for a chapter (the raid's trait rules
 * apply: Molting adds a dive, Smouldering rains no embers). The raid's
 * signature (Brazier Lighting: it takes off) is dealt in as before.
 */
export function ascendantLumiwickPattern(
  phase: number,
  trait = "",
): RaidAttack[] {
  const attacks: RaidAttack[] =
    phase === 1
      ? [
          "dive-bomb",
          "snuff-gale",
          "wing-gust",
          "bound-wicks",
          "flame-ring",
          "ember-rain",
        ]
      : phase === 2
        ? [
            "dive-bomb",
            "bound-wicks",
            "heat-mark",
            "snuff-gale",
            "scorched-earth",
            "ember-rain",
            "wing-gust",
            "flame-ring",
          ]
        : [
            "snuff-gale",
            "dive-bomb",
            "bound-wicks",
            "heat-mark",
            "ember-rain",
            "snuff-gale",
            "flame-ring",
            "scorched-earth",
          ];
  if (trait === "molting") attacks.splice(2, 0, "dive-bomb");
  return trait === "smouldering"
    ? attacks.filter((a) => a !== "ember-rain")
    : attacks;
}

/** Ascendant Lumiwick's three chapters. */
export const ASCENDANT_LUMIWICK_CHAPTERS = [
  {
    name: "Lantern Rising",
    objective:
      "Hold the flame when the gale comes. Light bound wicks together.",
    detail:
      "A Snuffing Gale blows down a lane through a brazier: a flame with nobody in its ring goes out, and a raider standing in a ring is sheltered. Bound Wicks tie two braziers together: they only catch while both rings have someone in them, before the fuse burns out.",
  },
  {
    name: "Tethered Flames",
    objective: "Keep the keepers in place. Watch for a dive that turns.",
    detail:
      "A dive may turn into a Snuffing Gale halfway: the new warning is shown in full, so react to what is drawn now. Kindle the wicks and Lumiwick blows at one of the new flames: its keeper must hold. Embers fall on a keeper who held. It hunts whoever kneels to revive.",
  },
  {
    name: "Ascendant Lantern",
    objective: "Three wicks, one breath. Survive the combinations.",
    detail:
      "Its rhythm quickens. With three raiders up, the wick binds all three braziers: everyone in a ring at once. Embers fall where you usually dodge, and standing still to attack draws a dive.",
  },
] as const;
