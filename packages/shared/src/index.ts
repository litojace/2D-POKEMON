import { z } from "zod";
export const RULES = {
  width: 1600,
  height: 900,
  tick: 30,
  snapshot: 15,
  radius: 24,
  dashSpeed: 850,
  acceleration: 18,
  dashCooldown: 3,
  dashDuration: 0.18,
  jumpCooldown: 2,
  jumpDuration: 0.65,
  roundSeconds: 180,
  /** First to three round wins (best of five) in every mode. */
  roundsToWin: 3,
  /** Healing orbs: first spawn after the countdown, then every interval. */
  orbFirst: 12,
  orbInterval: 18,
  /** Share of the picker's full health an orb restores. */
  orbHeal: 0.25,
  orbRadius: 26,
  /** Every other orb is an energy orb: ultimate charge instead of health. */
  orbEnergy: 35,
  /** Ultimate meter (skill 4): charged by fighting, cast when full. */
  ultMax: 100,
  /** Meter per point of damage dealt, and per point taken (comeback). */
  ultPerDamageDealt: 0.42,
  ultPerDamageTaken: 0.22,
  /** Slow trickle while a round is live, so cautious fights still get one. */
  ultPerSecond: 0.6,
  /** The round's loser starts the next one with this much extra charge. */
  ultComeback: 25,
  /** Each landed basic attack shortens skills 1-3's remaining cooldowns. */
  basicHitCooldownCut: 0.25,
  countdown: 3,
  intermission: 4,
  reconnectMs: 30000,
  maxProjectiles: 150,
  maxZones: 40,
};
export const SKILL_SLOTS = 4;
/** The last skill slot is the ultimate: it uses the meter, not a cooldown. */
export const ULT_SLOT = SKILL_SLOTS - 1;
/** Can this fighter cast skill `slot` at `time`? (Practice can skip the meter.) */
export function skillReady(
  p: { cooldowns: number[]; ult?: number },
  slot: number,
  time: number,
  freeCooldowns = false,
) {
  if (freeCooldowns) return true;
  if (slot === ULT_SLOT) return (p.ult ?? 0) >= RULES.ultMax;
  return time >= (p.cooldowns[slot] ?? 0);
}
export const KEYS = {
  up: "W",
  left: "A",
  down: "S",
  right: "D",
  // Defaults only: players rebind in Settings → Controls (apps/client/src/controls.ts).
  skills: ["Q", "E", "R", "F"],
  dash: "RMB",
  jump: "SPACE",
};
export const OBSTACLES = [
  { x: 490, y: 240, w: 90, h: 130 },
  { x: 1020, y: 530, w: 90, h: 130 },
  { x: 490, y: 530, w: 90, h: 130 },
  { x: 1020, y: 240, w: 90, h: 130 },
  { x: 750, y: 390, w: 100, h: 120 },
];
export type CharacterId =
  | "voltkit"
  | "cindrake"
  | "tidefin"
  | "auralynx"
  | "lumoth"
  | "mystowl"
  | "terradon"
  | "duskveil";
export type StatusKind =
  | "burn"
  | "paralysis"
  | "slow"
  | "freeze"
  | "stun"
  | "sleep"
  | "shield"
  | "counter"
  | "empower"
  | "haste"
  | "stealth"
  /** Combo setup: primed for the marker's payoff skill (`by` = the marker). */
  | "mark";
/** Statuses that count as harmful for effects such as Curse Mark. */
export const DEBUFFS: StatusKind[] = [
  "burn",
  "paralysis",
  "slow",
  "freeze",
  "stun",
  "sleep",
];
export const STATUS_RULES = {
  stacking: "refresh" as const,
  crowdControlImmunity: 2,
  burnDamage: 2,
  burnInterval: 0.5,
  slowMultiplier: 0.55,
  hasteMultiplier: 1.3,
  /** Damage multiplier while Mirror Guard is active. */
  counterReduction: 0.5,
  counterReflection: 0.3,
  /** Damage multiplier while Ward is active. */
  shieldReduction: 0.4,
  /** Kindle: outgoing damage multiplier and basic attack interval multiplier. */
  empowerDamage: 1.25,
  empowerInterval: 0.7,
  restInterval: 0.5,
  /** Hibernate: damage multiplier while asleep (the price of the heal). */
  sleepVulnerability: 1.2,
};
export type AbilityKind =
  /** Single projectile. */
  | "projectile"
  /** Projectile fired after a wind-up (`cast`). */
  | "charged"
  /** Fan of `count` projectiles. */
  | "barrage"
  /** Ground or air area placed at the aim point (or on the caster with `follow`). */
  | "zone"
  /** Instant strike in front of the caster. */
  | "melee"
  /** Continuous cone in front of the caster for `duration`. */
  | "cone"
  /** Instant hitscan line toward the aim. */
  | "beam"
  /** Circular burst centred on the caster. */
  | "nova"
  /** Decoy that absorbs one projectile. */
  | "clone"
  /** Damage reduction plus reflection. */
  | "counter"
  /** Damage reduction only. */
  | "barrier"
  /** Self buff (Kindle). */
  | "buff"
  /** Heal over time while asleep and unable to act. */
  | "rest";
export interface Ability {
  id: string;
  name: string;
  description: string;
  kind: AbilityKind;
  element: string;
  damage: number;
  /** Seconds between uses of a special skill. Always 0 for basic attacks. */
  cooldown: number;
  /** Seconds between basic attacks. Server-enforced; not a skill cooldown. */
  interval?: number;
  range: number;
  cast: number;
  recovery: number;
  speed: number;
  /** Projectile/beam hit radius, zone or nova radius. */
  radius: number;
  /** Minimum cosine between aim and target for melee/cone hits (0 = 180°). */
  arc?: number;
  duration: number;
  ground: boolean;
  knockback: number;
  status?: StatusKind;
  statusDuration?: number;
  /** Zones and cones: first tick delay and tick spacing in seconds. */
  tickDelay?: number;
  tickInterval?: number;
  /** Zone stays centred on its caster. */
  follow?: boolean;
  /** Damage multiplier against targets with a harmful status. */
  bonusVsStatus?: number;
  /** Hibernate: health restored per tick. */
  heal?: number;
  visual: string;
  sound: string;
  energyCost: number;
  count?: number;
  explosion?: number;
}
const ability = (
  id: string,
  name: string,
  kind: AbilityKind,
  damage: number,
  cooldown: number,
  description: string,
  extra: Partial<Ability> = {},
): Ability => ({
  id,
  name,
  kind,
  damage,
  cooldown,
  description,
  element: "",
  range: 700,
  cast: 0,
  recovery: 0.12,
  speed: 680,
  radius: 13,
  duration: 1,
  ground: false,
  knockback: 65,
  visual: kind,
  sound: kind,
  energyCost: 0,
  ...extra,
});
/** Basic attacks have no cooldown, only a server-enforced attack interval. */
const basic = (
  id: string,
  name: string,
  kind: AbilityKind,
  damage: number,
  intervalMs: number,
  description: string,
  extra: Partial<Ability> = {},
): Ability =>
  ability(id, name, kind, damage, 0, description, {
    interval: intervalMs / 1000,
    recovery: Math.min(0.12, intervalMs / 1000 / 2),
    knockback: 20,
    ...extra,
  });
export interface Character {
  id: CharacterId;
  name: string;
  element: string;
  role: string;
  description: string;
  color: number;
  health: number;
  speed: number;
  basic: Ability;
  skills: Ability[];
}
export const CHARACTERS: Record<CharacterId, Character> = {
  voltkit: {
    id: "voltkit",
    name: "Voltkit",
    element: "Electric",
    role: "Ranged speedster",
    description:
      "A sugar-glider kit that stores static in its antennae. Fast, slippery and deadly at range.",
    color: 0xffd65b,
    health: 138,
    speed: 270,
    basic: basic(
      "spark-dart",
      "Spark Dart",
      "projectile",
      6,
      280,
      "A fast electric projectile.",
      { speed: 860, range: 680, radius: 9 },
    ),
    skills: [
      ability(
        "static-lance",
        "Static Lance",
        "projectile",
        18,
        8,
        "A powerful electric bolt toward your aim. Briefly paralyzes.",
        { speed: 1050, radius: 12, status: "paralysis", statusDuration: 0.6 },
      ),
      ability(
        "ball-lightning",
        "Ball Lightning",
        "projectile",
        22,
        10,
        "A slow electric orb that bursts on impact, shocking nearby enemies.",
        { speed: 400, radius: 22, explosion: 100 },
      ),
      ability(
        "storm-grid",
        "Storm Grid",
        "zone",
        5,
        14,
        "An electrified ground area that damages and slows over time. Jump to avoid it.",
        {
          radius: 130,
          duration: 4,
          ground: true,
          status: "slow",
          statusDuration: 0.7,
          range: 450,
        },
      ),
      ability(
        "overcharge",
        "Overcharge",
        "nova",
        30,
        20,
        "After a short charge, a circular electrical explosion around Voltkit.",
        {
          radius: 190,
          cast: 0.35,
          knockback: 120,
          status: "paralysis",
          statusDuration: 1,
        },
      ),
    ],
  },
  cindrake: {
    id: "cindrake",
    name: "Cindrake",
    element: "Fire",
    role: "Burst damage fighter",
    description:
      "A stout magma newt with a living flame crest. Layers burns and hits hardest up close.",
    color: 0xff7a4f,
    health: 156,
    speed: 240,
    basic: basic(
      "cinder-snap",
      "Cinder Snap",
      "melee",
      15,
      450,
      "A short-range burst of fire in front of Cindrake.",
      { range: 170, arc: 0.2, knockback: 10 },
    ),
    skills: [
      ability(
        "ember-gust",
        "Ember Gust",
        "cone",
        6,
        8,
        "A continuous cone of flame for 1.2 seconds. Burns.",
        {
          range: 230,
          arc: 0.75,
          duration: 1.2,
          tickDelay: 0.1,
          tickInterval: 0.2,
          knockback: 0,
          status: "burn",
          statusDuration: 1.5,
        },
      ),
      ability(
        "magma-bomb",
        "Magma Bomb",
        "projectile",
        24,
        12,
        "An explosive fireball that burns enemies caught in the blast.",
        {
          speed: 620,
          radius: 18,
          explosion: 110,
          status: "burn",
          statusDuration: 2,
        },
      ),
      ability(
        "blaze-whirl",
        "Blaze Whirl",
        "zone",
        6,
        15,
        "Spin while releasing flames around Cindrake for 2.5 seconds.",
        {
          radius: 120,
          duration: 2.5,
          follow: true,
          range: 0,
          tickDelay: 0.2,
          tickInterval: 0.4,
          knockback: 30,
        },
      ),
      ability(
        "sunfire-pillar",
        "Sunfire Pillar",
        "zone",
        22,
        20,
        "Summon a large pillar of fire at the aim point. Burns.",
        {
          radius: 120,
          range: 520,
          duration: 1.2,
          cast: 0.3,
          tickDelay: 0.5,
          tickInterval: 0.5,
          status: "burn",
          statusDuration: 2,
        },
      ),
    ],
  },
  tidefin: {
    id: "tidefin",
    name: "Tidefin",
    element: "Water",
    role: "Agile assassin",
    description:
      "An axolotl duelist in a river sash. The quickest fighter; pokes, misdirects, then finishes.",
    color: 0x4fd6e6,
    health: 131,
    speed: 285,
    basic: basic(
      "tide-needle",
      "Tide Needle",
      "projectile",
      5,
      260,
      "A fast water projectile.",
      { speed: 950, radius: 8, range: 640 },
    ),
    skills: [
      ability(
        "ripple-stars",
        "Ripple Stars",
        "barrage",
        11,
        8,
        "Throw three water shurikens in a narrow fan.",
        { count: 3, speed: 1000, radius: 11 },
      ),
      ability(
        "whirlpool",
        "Whirlpool",
        "zone",
        4,
        12,
        "A swirling water zone that damages and slows enemies.",
        {
          radius: 140,
          duration: 3.5,
          range: 420,
          ground: true,
          status: "slow",
          statusDuration: 0.8,
        },
      ),
      ability(
        "mirror-mist",
        "Mirror Mist",
        "clone",
        0,
        15,
        "Leave a decoy that absorbs one projectile and gain a burst of speed.",
        { duration: 3.5, status: "haste", statusDuration: 2 },
      ),
      ability(
        "riptide-wave",
        "Riptide Wave",
        "charged",
        26,
        20,
        "A wide, powerful forward-moving wave with heavy knockback.",
        { cast: 0.25, speed: 520, radius: 42, range: 800, knockback: 200 },
      ),
    ],
  },
  auralynx: {
    id: "auralynx",
    name: "Auralynx",
    element: "Aura",
    role: "Counter specialist",
    description:
      "A crystal-fisted lynx monk. Durable, patient and brutal against careless attacks.",
    color: 0x7f9cff,
    health: 175,
    speed: 235,
    basic: basic(
      "prism-jab",
      "Prism Jab",
      "melee",
      13,
      320,
      "A close-range energy punch.",
      { range: 130, arc: 0.35, knockback: 12 },
    ),
    skills: [
      ability(
        "prism-shot",
        "Prism Shot",
        "projectile",
        20,
        8,
        "A concentrated aura projectile.",
        { speed: 600, radius: 20 },
      ),
      ability(
        "shatter-palm",
        "Shatter Palm",
        "melee",
        28,
        12,
        "A close-range shockwave strike with big knockback and a brief stun.",
        {
          range: 145,
          arc: 0.3,
          knockback: 180,
          status: "stun",
          statusDuration: 0.4,
        },
      ),
      ability(
        "mirror-guard",
        "Mirror Guard",
        "counter",
        0,
        15,
        "For 1.6 seconds, take half damage and reflect 30% back to the attacker.",
        { duration: 1.6 },
      ),
      ability(
        "nova-burst",
        "Nova Burst",
        "nova",
        34,
        20,
        "After a short charge, a circular aura explosion.",
        { radius: 200, cast: 0.4, knockback: 150 },
      ),
    ],
  },
  lumoth: {
    id: "lumoth",
    name: "Lumoth",
    element: "Light",
    role: "Versatile fighter",
    description:
      "A fluffy moth that sheds glowing dust. Balanced at every range; Kindle turns pressure into a race.",
    color: 0x86f0c0,
    health: 144,
    speed: 265,
    basic: basic(
      "glint",
      "Glint",
      "projectile",
      6,
      300,
      "A glowing star projectile.",
      { speed: 820, radius: 10 },
    ),
    skills: [
      ability(
        "starfall-spray",
        "Starfall Spray",
        "barrage",
        8,
        8,
        "Five glowing stars in a spread.",
        { count: 5, speed: 880, radius: 10 },
      ),
      ability(
        "dust-strike",
        "Dust Strike",
        "melee",
        24,
        12,
        "A powerful close-range bite.",
        {
          range: 120,
          arc: 0.4,
          knockback: 90,
        },
      ),
      ability(
        "kindle",
        "Kindle",
        "buff",
        0,
        15,
        "For 5 seconds, deal 25% more damage and basic attack 30% faster.",
        { duration: 5 },
      ),
      ability(
        "radiant-flare",
        "Radiant Flare",
        "nova",
        40,
        20,
        "After a charge, a powerful energy burst around Lumoth.",
        { radius: 210, cast: 0.45, knockback: 140 },
      ),
    ],
  },
  mystowl: {
    id: "mystowl",
    name: "Mystowl",
    element: "Psychic",
    role: "High-power duelist",
    description:
      "A floating three-eyed owl. Slow, heavy attacks; controls space with rays, pushes and wards.",
    color: 0xff79d2,
    health: 130,
    speed: 255,
    basic: basic(
      "mind-dart",
      "Mind Dart",
      "projectile",
      8,
      400,
      "A psychic energy projectile.",
      { speed: 760, radius: 11 },
    ),
    skills: [
      ability(
        "focus-ray",
        "Focus Ray",
        "beam",
        18,
        8,
        "An instant psychic beam toward your aim. Walls block it. Slows.",
        { range: 760, radius: 16, status: "slow", statusDuration: 0.6 },
      ),
      ability(
        "repulse",
        "Repulse",
        "nova",
        12,
        12,
        "A shockwave that pushes nearby opponents far away.",
        { radius: 180, knockback: 260 },
      ),
      ability(
        "ward",
        "Ward",
        "barrier",
        0,
        15,
        "A defensive shield that blocks 60% of damage for 3 seconds.",
        { duration: 3 },
      ),
      ability(
        "thoughtstrike",
        "Thoughtstrike",
        "zone",
        38,
        20,
        "A delayed psychic explosion at the target location.",
        {
          radius: 120,
          range: 600,
          cast: 0.35,
          duration: 0.7,
          tickDelay: 0.5,
          tickInterval: 1,
          knockback: 120,
        },
      ),
    ],
  },
  terradon: {
    id: "terradon",
    name: "Terradon",
    element: "Earth",
    role: "Defensive tank",
    description:
      "A sleepy boulder tortoise. Huge health pool and crushing swings; make them come to you.",
    color: 0xc79a5b,
    health: 219,
    speed: 222,
    basic: basic(
      "boulder-swipe",
      "Boulder Swipe",
      "melee",
      15,
      600,
      "A wide melee swing in front of Terradon.",
      { range: 150, arc: 0, knockback: 25 },
    ),
    skills: [
      ability(
        "shell-slam",
        "Shell Slam",
        "melee",
        30,
        8,
        "A heavy close-range body attack that stuns briefly. No dash.",
        {
          range: 150,
          arc: 0.1,
          knockback: 160,
          status: "stun",
          statusDuration: 0.5,
        },
      ),
      ability(
        "hibernate",
        "Hibernate",
        "rest",
        0,
        12,
        "Fall asleep for 2.5 seconds: heal 75 HP, but you can't move or act and take 20% more damage.",
        { duration: 2.5, heal: 15 },
      ),
      ability(
        "dust-cloud",
        "Dust Cloud",
        "zone",
        0,
        15,
        "A drowsy cloud that heavily slows enemies inside.",
        {
          radius: 150,
          duration: 3,
          range: 400,
          knockback: 0,
          status: "slow",
          statusDuration: 1.2,
        },
      ),
      ability(
        "tremor",
        "Tremor",
        "nova",
        36,
        20,
        "Slam the ground for a large shockwave. Jump to avoid it.",
        { radius: 230, cast: 0.5, ground: true, knockback: 140 },
      ),
    ],
  },
  duskveil: {
    id: "duskveil",
    name: "Duskveil",
    element: "Shadow",
    role: "Trickster / area control",
    description:
      "A hooded lantern wisp. Sets burns, then cashes them in with Curse Mark.",
    color: 0x9c6bff,
    health: 150,
    speed: 260,
    basic: basic(
      "lantern-wisp",
      "Lantern Wisp",
      "projectile",
      9,
      350,
      "A ghostly projectile.",
      { speed: 720, radius: 11 },
    ),
    skills: [
      ability(
        "shade-crawl",
        "Shade Crawl",
        "projectile",
        20,
        8,
        "A fast shadow strike along the ground. Jump to avoid it.",
        { speed: 1100, radius: 16, ground: true },
      ),
      ability(
        "ghostfire",
        "Ghostfire",
        "barrage",
        6,
        12,
        "Three ghostly flames that burn for 3 seconds.",
        { count: 3, speed: 520, radius: 12, status: "burn", statusDuration: 3 },
      ),
      ability(
        "curse-mark",
        "Curse Mark",
        "projectile",
        16,
        15,
        "A curse that deals double damage to enemies with a harmful status.",
        { speed: 760, radius: 14, bonusVsStatus: 2 },
      ),
      ability(
        "void-orb",
        "Void Orb",
        "charged",
        34,
        20,
        "After a short charge, a powerful ghost-energy orb that explodes.",
        { cast: 0.35, speed: 560, radius: 26, explosion: 120 },
      ),
    ],
  },
};
/**
 * Signature combos: one "setup → payoff" per fighter. The setup skill marks
 * its target (or, for `self` combos, the caster) for `window` seconds; the
 * payoff skill consumes the mark for a bonus. Readable mastery with no new
 * buttons. Duskveil's Curse Mark (double damage on any harmful status) is the
 * same idea and is listed here so the HUD can show it.
 */
export interface Combo {
  /** What the mark is called on screen. */
  name: string;
  setup: string;
  payoff: string;
  window: number;
  /** The mark sits on the caster instead of the target. */
  self?: boolean;
  /** Mark the caster when an attack hits them during the setup (Mirror Guard). */
  onAbsorb?: boolean;
  /** No mark: the payoff works on any harmful status (Curse Mark). */
  anyDebuff?: boolean;
  damage?: number;
  radius?: number;
  knockback?: number;
  /** Replaces the payoff's own status on a combo hit. */
  status?: StatusKind;
  statusDuration?: number;
  text: string;
}
export const COMBOS: Record<CharacterId, Combo> = {
  tidefin: {
    name: "Soaked",
    setup: "whirlpool",
    payoff: "riptide-wave",
    window: 3,
    damage: 1.3,
    text: "Whirlpool soaks enemies. Riptide Wave deals 30% more to Soaked targets.",
  },
  voltkit: {
    name: "Charged",
    setup: "storm-grid",
    payoff: "static-lance",
    window: 3,
    damage: 1.15,
    status: "stun",
    statusDuration: 0.5,
    text: "Storm Grid charges enemies. Static Lance stuns a Charged target instead of paralysing it.",
  },
  cindrake: {
    name: "Scorched",
    setup: "ember-gust",
    payoff: "magma-bomb",
    window: 3,
    damage: 1.35,
    status: "burn",
    statusDuration: 4,
    text: "Ember Gust scorches. Magma Bomb deals 35% more to Scorched targets and burns twice as long.",
  },
  mystowl: {
    name: "Dazed",
    setup: "repulse",
    payoff: "thoughtstrike",
    window: 3,
    damage: 1.4,
    text: "Repulse dazes. Thoughtstrike deals 40% more to Dazed targets.",
  },
  terradon: {
    name: "Drowsy",
    setup: "dust-cloud",
    payoff: "shell-slam",
    window: 2.5,
    damage: 1.25,
    knockback: 1.5,
    text: "Dust Cloud makes enemies drowsy. Shell Slam hits Drowsy targets 25% harder and further.",
  },
  lumoth: {
    name: "Kindled",
    setup: "kindle",
    payoff: "radiant-flare",
    window: 5,
    self: true,
    radius: 1.25,
    text: "Radiant Flare cast while Kindled is 25% wider.",
  },
  auralynx: {
    name: "Primed",
    setup: "mirror-guard",
    payoff: "shatter-palm",
    window: 2.5,
    self: true,
    onAbsorb: true,
    damage: 1.4,
    status: "stun",
    statusDuration: 0.8,
    text: "Absorb a hit with Mirror Guard to prime Shatter Palm: 40% more damage and a longer stun.",
  },
  duskveil: {
    name: "Hexed",
    setup: "ghostfire",
    payoff: "curse-mark",
    window: 0,
    anyDebuff: true,
    text: "Curse Mark deals double damage to anyone with a harmful status (Ghostfire's burn works).",
  },
};
/** Is `p` carrying a combo mark placed by `by`? (Self combos: by = p.id.) */
export function hasMark(p: Fighter, by: string, time: number) {
  return p.statuses.some(
    (s) => s.kind === "mark" && s.by === by && s.until > time,
  );
}
for (const character of Object.values(CHARACTERS))
  for (const skill of [character.basic, ...character.skills])
    skill.element = character.element;
/** Seconds between basic attacks, including Kindle. */
export function basicInterval(character: Character, empowered = false) {
  return (
    (character.basic.interval ?? 0.3) *
    (empowered ? STATUS_RULES.empowerInterval : 1)
  );
}
export interface Vec {
  x: number;
  y: number;
}
export interface Input {
  seq: number;
  dx: number;
  dy: number;
  aimX: number;
  aimY: number;
  basic: boolean;
  skill: number;
  dash: boolean;
  jump: boolean;
}
export const inputSchema = z
  .object({
    seq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    dx: z.number().min(-1).max(1),
    dy: z.number().min(-1).max(1),
    aimX: z.number().finite().min(0).max(RULES.width),
    aimY: z.number().finite().min(0).max(RULES.height),
    basic: z.boolean(),
    skill: z
      .number()
      .int()
      .min(-1)
      .max(SKILL_SLOTS - 1),
    dash: z.boolean(),
    jump: z.boolean(),
  })
  .strict();
export const identitySchema = z
  .object({ name: z.string().trim().min(1).max(20) })
  .strict();
export const practiceOptionsSchema = z
  .object({ unlimitedCooldowns: z.boolean(), targetAttacks: z.boolean() })
  .strict();
export const joinSchema = identitySchema.extend({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z2-9]{6}$/),
});
export const resumeSchema = z
  .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const FIGHTER_IDS = [
  "voltkit",
  "cindrake",
  "tidefin",
  "auralynx",
  "lumoth",
  "mystowl",
  "terradon",
  "duskveil",
] as const satisfies readonly CharacterId[];
/** Older internal IDs, accepted so stale clients and saved sessions keep working. */
const legacyIds: Record<string, CharacterId> = {
  pikachu: "voltkit",
  charizard: "cindrake",
  greninja: "tidefin",
  lucario: "auralynx",
  eevee: "lumoth",
  mewtwo: "mystowl",
  snorlax: "terradon",
  gengar: "duskveil",
  thornback: "mystowl",
  frostfang: "terradon",
  voltling: "voltkit",
  emberwing: "cindrake",
  aquashade: "tidefin",
  auralith: "auralynx",
};
export function normalizeCharacterId(value: unknown): CharacterId | undefined {
  if (typeof value !== "string") return undefined;
  if (Object.hasOwn(CHARACTERS, value)) return value as CharacterId;
  return Object.hasOwn(legacyIds, value) ? legacyIds[value] : undefined;
}
export const characterSchema = z.preprocess(
  (value) => normalizeCharacterId(value) ?? value,
  z.enum(FIGHTER_IDS),
);
export interface Status {
  kind: StatusKind;
  until: number;
  nextTick: number;
  /** Hibernate: health restored per tick. */
  amount?: number;
  /** Who applied it (burn damage is credited to them). */
  by?: string;
}
export interface Stats {
  dealt: number;
  received: number;
  skills: number;
  /** Knockouts landed on opponents. */
  kos?: number;
  /** Signature combos paid off. */
  combos?: number;
  /** Health restored (healing orbs and self-heals). */
  healed?: number;
}
/** A fresh, empty stat line for the start of a match. */
export const emptyStats = (): Stats => ({
  dealt: 0,
  received: 0,
  skills: 0,
  kos: 0,
  combos: 0,
  healed: 0,
});
/**
 * Blue (0) and Red (1). In a 1v1 each player is their own team; in a
 * free-for-all every fighter is a side of their own (0-3).
 */
export type Team = number;
export type MatchMode = "duel" | "teams" | "ffa";
/** Most players a room holds for each mode. */
export const MODE_SIZE: Record<MatchMode, number> = {
  duel: 2,
  teams: 4,
  ffa: 4,
};
/** Fewest players needed to start (a free-for-all can start with three). */
export const MODE_MIN: Record<MatchMode, number> = {
  duel: 2,
  teams: 4,
  ffa: 3,
};
export const TEAM_NAMES = ["Blue", "Red"] as const;
export interface Fighter extends Vec {
  team?: Team;
  /** Left the match for good (2v2): stays on the scoreboard, out of play. */
  out?: boolean;
  title?: string | null;
  titleColor?: string | null;
  id: string;
  name: string;
  character: CharacterId;
  connected: boolean;
  ready: boolean;
  hp: number;
  vx: number;
  vy: number;
  angle: number;
  ack: number;
  cooldowns: number[];
  /** Ultimate meter, 0 to RULES.ultMax. Carries over between rounds. */
  ult?: number;
  /** Rites picked this match (ids, in order). */
  rites?: string[];
  /** Rites on offer during this intermission, until one is picked. */
  riteOffer?: string[];
  basicAt: number;
  dashAt: number;
  jumpAt: number;
  dashUntil: number;
  jumpUntil: number;
  dashX: number;
  dashY: number;
  statuses: Status[];
  immuneUntil: number;
  recoveryUntil: number;
  stats: Stats;
  charge?: { at: number; skill: number };
  /** Active continuous cone (Fire Breath). */
  channel?: { until: number; nextTick: number; skill: number };
  clone?: Vec & { until: number };
  lastInput: Input;
}
export interface Projectile extends Vec {
  id: number;
  owner: string;
  vx: number;
  vy: number;
  remaining: number;
  ability: Ability;
  color: number;
}
/** An orb on the court, waiting to be picked up. */
export interface Orb extends Vec {
  id: number;
  /** Healing (default) restores health; energy charges the ultimate meter. */
  kind?: "heal" | "energy";
}
/** Party rules the room host can switch on in the lobby. */
export const MUTATORS = {
  turbo: {
    name: "Turbo",
    description: "Skills recharge twice as fast; ultimates charge 50% faster.",
  },
  glass: {
    name: "Glass cannon",
    description: "Every hit deals 50% more damage.",
  },
  orbs: {
    name: "Orb rain",
    description: "Orbs appear twice as often.",
  },
  quick: {
    name: "Quick match",
    description: "First to 2 round wins instead of 3.",
  },
  calm: {
    name: "Calm court",
    description: "Always the Stone Court: no arena hazards.",
  },
  crown: {
    name: "Crown Hill",
    description: "Hold the centre circle alone for 12 seconds to win the round.",
  },
  random: {
    name: "Fighter roulette",
    description: "Everyone gets a random fighter each round (no rites).",
  },
  speed: {
    name: "Double time",
    description: "Everyone runs 60% faster.",
  },
  giants: {
    name: "Giants",
    description: "Fighters look huge (looks only: hits are unchanged).",
  },
} as const;
/** 2v2 team-up: partners fighting side by side both hit harder. */
export const TEAMUP = { range: 260, damage: 1.1 };
/** Crown Hill: the circle in the middle of the court, and how long to hold it. */
export const CROWN = { x: 800, y: 450, radius: 150, holdSeconds: 12 };
export type MutatorId = keyof typeof MUTATORS;
export const MUTATOR_IDS = Object.keys(MUTATORS) as MutatorId[];
export const MUTATOR_RULES = {
  turboCooldown: 0.5,
  turboUlt: 1.5,
  glassDamage: 1.5,
  orbsRate: 2,
  quickRounds: 2,
  speed: 1.6,
  giants: 1.45,
};
/** Round wins needed with these party rules. */
export function roundsNeeded(mutators: readonly string[] = []) {
  return mutators.includes("quick")
    ? MUTATOR_RULES.quickRounds
    : RULES.roundsToWin;
}
/**
 * The closing ring: in a round's last minute the safe circle shrinks from the
 * whole court down to the centre, and standing outside it hurts. Stalled
 * rounds end in a fight instead of a timeout.
 */
export const RING = {
  x: 800,
  y: 450,
  /** Seconds before the round's time limit when the ring starts closing. */
  startsBefore: 60,
  /** Covers the corners of the court. */
  maxRadius: 920,
  minRadius: 170,
  /** Health per second lost outside the ring. */
  damage: 14,
};
/** Safe radius for the time left in the round, or null while it's open. */
export function ringRadius(remaining: number, overtime = false): number | null {
  if (overtime) return RING.minRadius;
  if (remaining > RING.startsBefore) return null;
  const k = 1 - Math.max(0, remaining) / RING.startsBefore;
  return RING.maxRadius + (RING.minRadius - RING.maxRadius) * k;
}
/** Where orbs appear: top and bottom centre, equally far from both sides. */
export const ORB_SPOTS: Vec[] = [
  { x: 800, y: 190 },
  { x: 800, y: 710 },
];
export interface Zone extends Vec {
  id: number;
  owner: string;
  radius: number;
  until: number;
  nextTick: number;
  ability: Ability;
  color: number;
}
export interface GameEvent extends Vec {
  id: number;
  kind:
    | "cast"
    | "hit"
    | "dash"
    | "jump"
    | "land"
    | "round"
    | "beam"
    | "burst"
    /** A projectile ended (explosion, wall, range limit or decoy). */
    | "impact"
    /** A healing orb appeared. */
    | "orb"
    /** Someone picked up an orb (value = health restored). */
    | "heal"
    /** An arena hazard fired (abilityId: hazard-vent, hazard-pool, hazard-wall). */
    | "hazard";
  /** Beam end point. */
  tx?: number;
  ty?: number;
  abilityId?: string;
  color: number;
  value?: number;
  owner?: string;
  /** Hit events: who was hit and who dealt it. */
  target?: string;
  source?: string;
  /** Hit events: this hit knocked the target out. */
  ko?: boolean;
  /** Hit or burst events: a signature combo paid off (the combo's name). */
  combo?: string;
}
export type Phase =
  | "lobby"
  | "briefing"
  | "countdown"
  | "playing"
  | "intermission"
  | "paused"
  | "finished";
export interface Snapshot {
  instructionsReady: string[];
  practice: { unlimitedCooldowns: boolean; targetAttacks: boolean } | null;
  mode?: MatchMode;
  /** Round wins per team (Blue, Red). */
  teamScores?: number[];
  winnerTeam?: Team | null;
  roundWinnerTeam?: Team | null;
  orbs?: Orb[];
  /** Difficulty of the AI opponent in a solo-vs-bot room, else null. */
  vsBot?: "easy" | "normal" | "hard" | null;
  code: string;
  phase: Phase;
  time: number;
  remaining: number;
  round: number;
  scores: Record<string, number>;
  winner: string | null;
  roundWinner: string | null;
  players: Fighter[];
  projectiles: Projectile[];
  zones: Zone[];
  events: GameEvent[];
  pauseRemaining: number;
  overtime: boolean;
  /** Who won each round so far (team, or null for a draw), in order. */
  roundLog?: (Team | null)[];
  /** Set once a real match finishes: players report it for their records. */
  matchId?: string | null;
  /** Party rules switched on for this room. */
  mutators?: MutatorId[];
  /** Crown Hill: seconds each side has held the circle this round. */
  crown?: number[];
  /** Names of friends watching this room. */
  watchers?: string[];
  /** Which arena this match is played in, and when its hazards' clock started. */
  arena?: ArenaId;
  hazardClock?: number;
}
export type WireSnapshot = Omit<Snapshot, "projectiles" | "zones"> & {
  projectiles: (Omit<Projectile, "ability"> & { abilityId: string })[];
  zones: (Omit<Zone, "ability"> & { abilityId: string })[];
};
const abilities = Object.fromEntries(
  Object.values(CHARACTERS)
    .flatMap((c) => [c.basic, ...c.skills])
    .map((a) => [a.id, a]),
);
export function packSnapshot(s: Snapshot): WireSnapshot {
  return {
    ...s,
    players: s.players.map((p) => ({
      ...p,
      character: normalizeCharacterId(p.character) ?? "voltkit",
    })),
    projectiles: s.projectiles.map(({ ability, ...pr }) => ({
      ...pr,
      abilityId: ability.id,
    })),
    zones: s.zones.map(({ ability, ...zone }) => ({
      ...zone,
      abilityId: ability.id,
    })),
  };
}
function ownedAbility(s: WireSnapshot, owner: string, id: string): Ability {
  const p = s.players.find((q) => q.id === owner);
  const character = p && normalizeCharacterId(p.character);
  return (
    (character && p.rites?.length
      ? kitAbility(character, p.rites, id)
      : undefined) ?? abilities[id]
  );
}
export function unpackSnapshot(s: WireSnapshot): Snapshot {
  return {
    ...s,
    players: s.players.map((p) => ({
      ...p,
      character: normalizeCharacterId(p.character) ?? "voltkit",
    })),
    // Owners' rites can change an ability (e.g. a wider blast): use their kit.
    projectiles: s.projectiles.map(({ abilityId, ...pr }) => ({
      ...pr,
      ability: ownedAbility(s, pr.owner, abilityId),
    })),
    zones: s.zones.map(({ abilityId, ...zone }) => ({
      ...zone,
      ability: ownedAbility(s, zone.owner, abilityId),
    })),
  };
}
export interface Reply {
  ok: boolean;
  error?: string;
  token?: string;
  id?: string;
  code?: string;
}
export const normalize = (x: number, y: number): Vec => {
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
};
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/**
 * The walls collision uses right now. Each arena (and the moving pillar in
 * Shifting Ruins) has its own; the server sets this before simulating a room
 * and the client before predicting, so movement code needn't pass it around.
 */
let activeObstacles: readonly Rect[] = OBSTACLES;
/** Movement speed multiplier for the room being simulated (Double time). */
let speedScale = 1;
export function useSpeedScale(scale: number) {
  speedScale = scale;
}
export function useObstacles(list: readonly Rect[]) {
  activeObstacles = list;
}
export function currentObstacles() {
  return activeObstacles;
}
export function blocked(x: number, y: number, r = RULES.radius): boolean {
  return (
    x < r ||
    y < r ||
    x > RULES.width - r ||
    y > RULES.height - r ||
    activeObstacles.some(
      (o) =>
        Math.hypot(
          x - Math.max(o.x, Math.min(x, o.x + o.w)),
          y - Math.max(o.y, Math.min(y, o.y + o.h)),
        ) < r,
    )
  );
}
export function move(
  body: Vec,
  dx: number,
  dy: number,
  r = RULES.radius,
): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 10));
  for (let i = 0; i < steps; i++) {
    if (!blocked(body.x + dx / steps, body.y, r)) body.x += dx / steps;
    if (!blocked(body.x, body.y + dy / steps, r)) body.y += dy / steps;
  }
}
export function advanceMovement(
  p: Fighter,
  input: Input,
  dt: number,
  time: number,
): void {
  const dir = normalize(input.dx, input.dy);
  p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  let modifier = 1;
  for (const s of p.statuses)
    if (s.until > time) {
      if (s.kind === "freeze" || s.kind === "stun" || s.kind === "sleep")
        modifier = 0;
      if (s.kind === "slow" || s.kind === "paralysis")
        modifier *= STATUS_RULES.slowMultiplier;
      if (s.kind === "haste") modifier *= STATUS_RULES.hasteMultiplier;
    }
  if (time < p.dashUntil) {
    p.vx = p.dashX;
    p.vy = p.dashY;
  } else {
    const factor = 1 - Math.exp(-RULES.acceleration * dt);
    const speed = CHARACTERS[p.character].speed * modifier * speedScale;
    p.vx += (dir.x * speed - p.vx) * factor;
    p.vy += (dir.y * speed - p.vy) * factor;
  }
  if (modifier === 0) {
    p.vx = 0;
    p.vy = 0;
  }
  move(p, p.vx * dt, p.vy * dt);
}
export const blankInput = (): Input => ({
  seq: 0,
  dx: 0,
  dy: 0,
  aimX: 800,
  aimY: 450,
  basic: false,
  skill: -1,
  dash: false,
  jump: false,
});

/**
 * Rites: round upgrades. Between rounds each player picks one of a few
 * upgrades from their own fighter's pool; picks stack for the rest of the
 * match. Minor rites tune a skill; a major rite (offered before round 3, and
 * again until one is taken) changes how a skill plays. Every effect is a plain
 * change to one ability's numbers, so the text always matches the rules.
 */
export type RiteTier = "minor" | "major";
type RiteNumber =
  | "damage"
  | "cooldown"
  | "range"
  | "radius"
  | "duration"
  | "speed"
  | "explosion"
  | "count"
  | "cast"
  | "heal"
  | "knockback"
  | "statusDuration"
  | "bonusVsStatus";
export interface Rite {
  id: string;
  fighter: CharacterId;
  tier: RiteTier;
  name: string;
  text: string;
  /** The ability it changes (a skill or the basic attack). */
  skill: string;
  mul?: Partial<Record<RiteNumber, number>>;
  set?: Partial<Pick<Ability, RiteNumber | "status" | "kind">>;
}
export const RITE_RULES = {
  /** Intermission while players choose (seconds); it ends early once all have. */
  seconds: 8,
  /** Never shorter than this after a round ends, so the result can be read. */
  minSeconds: 2.5,
  choices: 3,
  /** The side that lost the round sees one extra choice. */
  comebackChoices: 1,
  /** Majors are offered from this round on, until one is taken. */
  majorFromRound: 3,
};
const rite = (
  fighter: CharacterId,
  tier: RiteTier,
  skill: string,
  name: string,
  text: string,
  change: Pick<Rite, "mul" | "set">,
): Rite => ({
  id: `${fighter}-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
  fighter,
  tier,
  skill,
  name,
  text,
  ...change,
});
export const RITES: Rite[] = [
  rite("voltkit", "minor", "static-lance", "Quick Lance", "Static Lance cooldown 8s → 6.5s.", { set: { cooldown: 6.5 } }),
  rite("voltkit", "minor", "ball-lightning", "Big Ball", "Ball Lightning's blast is 30% wider.", { mul: { explosion: 1.3 } }),
  rite("voltkit", "minor", "storm-grid", "Long Storm", "Storm Grid lasts 5.5s instead of 4s.", { set: { duration: 5.5 } }),
  rite("voltkit", "minor", "spark-dart", "Hot Darts", "Spark Dart deals 7 damage instead of 6.", { set: { damage: 7 } }),
  rite("voltkit", "major", "storm-grid", "Lockdown Grid", "Storm Grid paralyses instead of slowing.", { set: { status: "paralysis", statusDuration: 0.4 } }),
  rite("voltkit", "major", "ball-lightning", "Thunderhead", "Ball Lightning becomes three orbs of 14 damage with smaller blasts.", { set: { kind: "barrage", count: 3, damage: 14, explosion: 70 } }),
  rite("cindrake", "minor", "ember-gust", "Long Breath", "Ember Gust lasts 1.6s instead of 1.2s.", { set: { duration: 1.6 } }),
  rite("cindrake", "minor", "magma-bomb", "Wide Bomb", "Magma Bomb's blast is 30% wider.", { mul: { explosion: 1.3 } }),
  rite("cindrake", "minor", "blaze-whirl", "Endless Whirl", "Blaze Whirl lasts 3.5s instead of 2.5s.", { set: { duration: 3.5 } }),
  rite("cindrake", "minor", "cinder-snap", "Searing Snap", "Cinder Snap deals 18 damage instead of 15.", { set: { damage: 18 } }),
  rite("cindrake", "major", "sunfire-pillar", "Solar Pillar", "Sunfire Pillar erupts instantly and is 25% wider.", { set: { cast: 0 }, mul: { radius: 1.25 } }),
  rite("cindrake", "major", "blaze-whirl", "Burning Whirl", "Blaze Whirl sets enemies on fire.", { set: { status: "burn", statusDuration: 1.5 } }),
  rite("tidefin", "minor", "ripple-stars", "Five Stars", "Ripple Stars throws 5 stars of 9 damage instead of 3 of 11.", { set: { count: 5, damage: 9 } }),
  rite("tidefin", "minor", "whirlpool", "Deep Pool", "Whirlpool is 20% wider.", { mul: { radius: 1.2 } }),
  rite("tidefin", "minor", "mirror-mist", "Slipstream", "Mirror Mist's speed burst lasts 3s instead of 2s.", { set: { statusDuration: 3 } }),
  rite("tidefin", "minor", "tide-needle", "Long Needle", "Tide Needle flies 25% further.", { mul: { range: 1.25 } }),
  rite("tidefin", "major", "whirlpool", "Maelstrom", "Whirlpool deals 6 per tick instead of 4 and lasts 4.5s.", { set: { damage: 6, duration: 4.5 } }),
  rite("tidefin", "major", "ripple-stars", "Rapid Stars", "Ripple Stars cooldown 8s → 5s.", { set: { cooldown: 5 } }),
  rite("auralynx", "minor", "prism-shot", "Swift Prism", "Prism Shot flies 35% faster.", { mul: { speed: 1.35 } }),
  rite("auralynx", "minor", "shatter-palm", "Long Palm", "Shatter Palm reaches 20% further.", { mul: { range: 1.2 } }),
  rite("auralynx", "minor", "mirror-guard", "Steady Guard", "Mirror Guard lasts 2.2s instead of 1.6s.", { set: { duration: 2.2 } }),
  rite("auralynx", "minor", "prism-jab", "Hard Jab", "Prism Jab deals 15 damage instead of 13.", { set: { damage: 15 } }),
  rite("auralynx", "major", "prism-shot", "Prism Burst", "Prism Shot explodes on impact, hitting everyone nearby.", { set: { explosion: 90 } }),
  rite("auralynx", "major", "nova-burst", "Stunning Nova", "Nova Burst also stuns for 0.6s.", { set: { status: "stun", statusDuration: 0.6 } }),
  rite("lumoth", "minor", "starfall-spray", "Star Shower", "Starfall Spray throws 7 stars of 7 damage instead of 5 of 8.", { set: { count: 7, damage: 7 } }),
  rite("lumoth", "minor", "dust-strike", "Sharp Bite", "Dust Strike deals 28 damage instead of 24.", { set: { damage: 28 } }),
  rite("lumoth", "minor", "kindle", "Long Kindle", "Kindle lasts 6.5s instead of 5s.", { set: { duration: 6.5 } }),
  rite("lumoth", "minor", "glint", "Bright Glint", "Glint deals 7 damage instead of 6.", { set: { damage: 7 } }),
  rite("lumoth", "major", "radiant-flare", "Quick Flare", "Radiant Flare charges in 0.2s instead of 0.45s.", { set: { cast: 0.2 } }),
  rite("lumoth", "major", "dust-strike", "Stunning Bite", "Dust Strike also stuns for 0.5s.", { set: { status: "stun", statusDuration: 0.5 } }),
  rite("mystowl", "minor", "focus-ray", "Far Sight", "Focus Ray reaches 20% further.", { mul: { range: 1.2 } }),
  rite("mystowl", "minor", "repulse", "Wide Repulse", "Repulse is 20% wider.", { mul: { radius: 1.2 } }),
  rite("mystowl", "minor", "ward", "Long Ward", "Ward lasts 4s instead of 3s.", { set: { duration: 4 } }),
  rite("mystowl", "minor", "mind-dart", "Heavy Dart", "Mind Dart deals 10 damage instead of 8.", { set: { damage: 10 } }),
  rite("mystowl", "major", "focus-ray", "Mind Lock", "Focus Ray stuns for 0.5s instead of slowing.", { set: { status: "stun", statusDuration: 0.5 } }),
  rite("mystowl", "major", "thoughtstrike", "Big Thought", "Thoughtstrike is 35% wider.", { mul: { radius: 1.35 } }),
  rite("terradon", "minor", "shell-slam", "Long Slam", "Shell Slam reaches 20% further.", { mul: { range: 1.2 } }),
  rite("terradon", "minor", "hibernate", "Deep Sleep", "Hibernate heals 90 HP instead of 75.", { set: { heal: 18 } }),
  rite("terradon", "minor", "dust-cloud", "Thick Dust", "Dust Cloud is 20% wider.", { mul: { radius: 1.2 } }),
  rite("terradon", "minor", "boulder-swipe", "Heavy Swipe", "Boulder Swipe deals 18 damage instead of 15.", { set: { damage: 18 } }),
  rite("terradon", "major", "tremor", "Quick Quake", "Tremor charges in 0.25s instead of 0.5s.", { set: { cast: 0.25 } }),
  rite("terradon", "major", "dust-cloud", "Sandstorm", "Dust Cloud also deals 4 damage per tick.", { set: { damage: 4 } }),
  rite("duskveil", "minor", "shade-crawl", "Deep Crawl", "Shade Crawl deals 24 damage instead of 20.", { set: { damage: 24 } }),
  rite("duskveil", "minor", "ghostfire", "Five Flames", "Ghostfire throws 5 flames instead of 3.", { set: { count: 5 } }),
  rite("duskveil", "minor", "curse-mark", "Swift Curse", "Curse Mark flies 30% faster.", { mul: { speed: 1.3 } }),
  rite("duskveil", "minor", "lantern-wisp", "Bright Wisp", "Lantern Wisp deals 11 damage instead of 9.", { set: { damage: 11 } }),
  rite("duskveil", "major", "curse-mark", "Deep Curse", "Curse Mark deals 2.5× (not 2×) damage on a harmful status.", { set: { bonusVsStatus: 2.5 } }),
  rite("duskveil", "major", "void-orb", "Burning Void", "Void Orb's blast is 30% wider and burns.", { mul: { explosion: 1.3 }, set: { status: "burn", statusDuration: 2 } }),
];
export const RITE_BY_ID: Record<string, Rite> = Object.fromEntries(
  RITES.map((r) => [r.id, r]),
);
export interface Kit {
  basic: Ability;
  skills: Ability[];
}
const kitCache = new Map<string, Kit>();
/** A fighter's abilities with their rites applied (cached; never mutate). */
export function kitOf(character: CharacterId, rites: readonly string[] = []): Kit {
  const base = CHARACTERS[character];
  if (!rites.length) return base;
  const key = `${character}|${rites.join(",")}`;
  const cached = kitCache.get(key);
  if (cached) return cached;
  const patch = (a: Ability) => {
    let out = a;
    for (const id of rites) {
      const r = RITE_BY_ID[id];
      if (!r || r.fighter !== character || r.skill !== a.id) continue;
      out = { ...out, ...r.set };
      for (const [k, m] of Object.entries(r.mul ?? {}) as [RiteNumber, number][])
        out[k] = (out[k] ?? 0) * m;
    }
    return out;
  };
  const kit = { basic: patch(base.basic), skills: base.skills.map(patch) };
  kitCache.set(key, kit);
  return kit;
}
/** The ability with this id from a fighter's kit, rites applied. */
export function kitAbility(
  character: CharacterId,
  rites: readonly string[] | undefined,
  id: string,
) {
  const kit = kitOf(character, rites);
  return [kit.basic, ...kit.skills].find((a) => a.id === id);
}
/**
 * The rites to offer `p` before `round`: three minors, or (from round 3,
 * until a major is taken) both majors plus a minor. `extra` adds choices.
 */
export function riteOffer(
  character: CharacterId,
  owned: readonly string[],
  round: number,
  random: () => number,
  extra = 0,
) {
  const pool = (tier: RiteTier) =>
    RITES.filter(
      (r) => r.fighter === character && r.tier === tier && !owned.includes(r.id),
    );
  const shuffle = <T>(list: T[]) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  const hasMajor = owned.some((id) => RITE_BY_ID[id]?.tier === "major");
  const size = RITE_RULES.choices + extra;
  const majors =
    round >= RITE_RULES.majorFromRound && !hasMajor ? shuffle(pool("major")) : [];
  return [...majors, ...shuffle(pool("minor"))]
    .slice(0, size)
    .map((r) => r.id);
}

/**
 * Arenas. Classic is the original court; the others add one hazard each so a
 * match plays a little differently, and matches rotate through all four.
 * Hazards run on a clock that starts when a round goes live, telegraph before
 * they act, and hurt everyone the same (they never credit a player).
 */
export type ArenaId = "classic" | "tide-pools" | "ember-forge" | "shifting-ruins";
export interface Hazard {
  kind: "pool" | "vent";
  x: number;
  y: number;
  radius: number;
  /** Seconds between triggers, the first at `offset` into the round. */
  period: number;
  offset: number;
  /** Telegraph shown for this long before it triggers. */
  warn: number;
  damage: number;
  knockback: number;
  /** Jumping avoids it. */
  ground: boolean;
  status?: StatusKind;
  statusDuration?: number;
}
export interface ArenaDef {
  id: ArenaId;
  name: string;
  /** One line for the briefing. */
  tip: string;
  obstacles: Rect[];
  /** A wall that sinks and rises (Shifting Ruins). */
  shifting?: { rect: Rect; up: number; down: number; warn: number };
  hazards: Hazard[];
}
const PILLARS = OBSTACLES.slice(0, 4);
const CENTRE = OBSTACLES[4];
const vent = (x: number, y: number, offset: number): Hazard => ({
  kind: "vent",
  x,
  y,
  radius: 78,
  period: 8,
  offset,
  warn: 1.1,
  damage: 14,
  knockback: 0,
  ground: true,
  status: "burn",
  statusDuration: 2,
});
export const ARENAS: Record<ArenaId, ArenaDef> = {
  classic: {
    id: "classic",
    name: "Stone Court",
    tip: "The original court: four pillars and a centre block for cover.",
    obstacles: OBSTACLES,
    hazards: [],
  },
  "tide-pools": {
    id: "tide-pools",
    name: "Tide Pools",
    tip: "The centre is a tide pool: it slows you, and every 7 seconds it surges and throws everyone out.",
    obstacles: PILLARS,
    hazards: [
      {
        kind: "pool",
        x: 800,
        y: 450,
        radius: 120,
        period: 7,
        offset: 7,
        warn: 1.2,
        damage: 8,
        knockback: 170,
        ground: false,
        status: "slow",
        statusDuration: 0.3,
      },
    ],
  },
  "ember-forge": {
    id: "ember-forge",
    name: "Ember Forge",
    tip: "Four vents erupt in turn (they glow first). Jump or step out to avoid the burn.",
    obstacles: OBSTACLES,
    hazards: [
      vent(650, 160, 4),
      vent(950, 740, 4),
      vent(950, 160, 8),
      vent(650, 740, 8),
    ],
  },
  "shifting-ruins": {
    id: "shifting-ruins",
    name: "Shifting Ruins",
    tip: "The centre block sinks and rises again: cover comes and goes, and it shakes before it rises.",
    obstacles: PILLARS,
    shifting: { rect: CENTRE, up: 7, down: 5, warn: 1 },
    hazards: [],
  },
};
/** Matches rotate through every arena. */
export const ARENA_ROTATION: ArenaId[] = [
  "classic",
  "tide-pools",
  "ember-forge",
  "shifting-ruins",
];
const withCentre = new Map<ArenaId, Rect[]>();
/** Is the shifting wall up at `t` seconds into the round? */
export function shiftingUp(arena: ArenaDef, t: number) {
  const s = arena.shifting;
  if (!s) return false;
  return t < 0 || (((t % (s.up + s.down)) + s.up + s.down) % (s.up + s.down)) < s.up;
}
/** Seconds until the shifting wall rises (0 if it is up). */
export function shiftingRisesIn(arena: ArenaDef, t: number) {
  const s = arena.shifting;
  if (!s || shiftingUp(arena, t)) return 0;
  const cycle = s.up + s.down;
  return cycle - (t % cycle);
}
/** The walls of `arena` at `t` seconds into the round. */
export function obstaclesAt(id: ArenaId | undefined, t: number): Rect[] {
  const arena = ARENAS[id ?? "classic"];
  if (!arena.shifting || !shiftingUp(arena, t)) return arena.obstacles;
  let list = withCentre.get(arena.id);
  if (!list) {
    list = [...arena.obstacles, arena.shifting.rect];
    withCentre.set(arena.id, list);
  }
  return list;
}
/** Seconds until hazard `h` next triggers, `t` seconds into the round. */
export function hazardIn(h: Hazard, t: number) {
  if (t < h.offset) return h.offset - t;
  const since = (t - h.offset) % h.period;
  return since === 0 ? 0 : h.period - since;
}
/** What a hazard hit looks like to the damage rules (status, jump to avoid). */
export function hazardAbility(h: Hazard): Ability {
  return ability(`hazard-${h.kind}`, h.kind === "vent" ? "Vent" : "Surge", "zone", h.damage, 0, "", {
    ground: h.ground,
    knockback: 0,
    radius: h.radius,
    ...(h.kind === "vent" && h.status
      ? { status: h.status, statusDuration: h.statusDuration }
      : {}),
  });
}
