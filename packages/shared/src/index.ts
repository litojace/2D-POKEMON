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
  roundsToWin: 2,
  countdown: 3,
  intermission: 4,
  reconnectMs: 30000,
  maxProjectiles: 150,
  maxZones: 40,
};
export const SKILL_SLOTS = 4;
export const KEYS = {
  up: "W",
  left: "A",
  down: "S",
  right: "D",
  skills: ["1", "2", "3", "R"],
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
  | "pikachu"
  | "charizard"
  | "greninja"
  | "lucario"
  | "eevee"
  | "mewtwo"
  | "snorlax"
  | "gengar";
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
  | "stealth";
/** Statuses that count as harmful for effects such as Hex. */
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
  /** Damage multiplier while Counter Stance is active. */
  counterReduction: 0.5,
  counterReflection: 0.3,
  /** Damage multiplier while Barrier is active. */
  shieldReduction: 0.4,
  /** Helping Hand: outgoing damage multiplier and basic attack interval multiplier. */
  empowerDamage: 1.25,
  empowerInterval: 0.7,
  /** Rest leaves the sleeper vulnerable. */
  sleepDamageTaken: 1.25,
  restInterval: 0.5,
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
  /** Self buff (Helping Hand). */
  | "buff"
  /** Heal over time while asleep and vulnerable. */
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
  /** Rest: health restored per tick. */
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
  pikachu: {
    id: "pikachu",
    name: "Pikachu",
    element: "Electric",
    role: "Ranged speedster",
    description:
      "Fast and slippery. Chains quick jolts with paralysis to keep opponents at range.",
    color: 0xffd65b,
    health: 110,
    speed: 270,
    basic: basic(
      "thunder-jolt",
      "Thunder Jolt",
      "projectile",
      7,
      280,
      "A fast electric projectile.",
      { speed: 860, range: 680, radius: 9 },
    ),
    skills: [
      ability(
        "thunder-shock",
        "Thunder Shock",
        "projectile",
        18,
        8,
        "A powerful electric bolt toward your aim. Briefly paralyzes.",
        { speed: 1050, radius: 12, status: "paralysis", statusDuration: 0.6 },
      ),
      ability(
        "electro-orb",
        "Electro Orb",
        "projectile",
        22,
        10,
        "A slow electric orb that bursts on impact, shocking nearby enemies.",
        { speed: 400, radius: 22, explosion: 100 },
      ),
      ability(
        "thunder-field",
        "Thunder Field",
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
        "volt-overload",
        "Volt Overload",
        "nova",
        30,
        18,
        "After a short charge, a circular electrical explosion around Pikachu.",
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
  charizard: {
    id: "charizard",
    name: "Charizard",
    element: "Fire",
    role: "Burst damage fighter",
    description:
      "Heavy hitter that layers burns and huge fire bursts. Strongest up close.",
    color: 0xff795a,
    health: 125,
    speed: 240,
    basic: basic(
      "flame-puff",
      "Flame Puff",
      "melee",
      9,
      450,
      "A short-range burst of fire in front of Charizard.",
      { range: 150, arc: 0.2, knockback: 40 },
    ),
    skills: [
      ability(
        "fire-breath",
        "Fire Breath",
        "cone",
        5,
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
        "flame-burst",
        "Flame Burst",
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
        "inferno-spin",
        "Inferno Spin",
        "zone",
        6,
        15,
        "Spin while releasing flames around Charizard for 2.5 seconds.",
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
        "solar-blaze",
        "Solar Blaze",
        "zone",
        22,
        18,
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
  greninja: {
    id: "greninja",
    name: "Greninja",
    element: "Water",
    role: "Agile assassin",
    description:
      "The fastest fighter. Pokes with kunai, confuses with clones and finishes with a wave.",
    color: 0x63dce8,
    health: 105,
    speed: 285,
    basic: basic(
      "water-kunai",
      "Water Kunai",
      "projectile",
      6,
      260,
      "A fast water projectile.",
      { speed: 950, radius: 8 },
    ),
    skills: [
      ability(
        "water-shuriken",
        "Water Shuriken",
        "barrage",
        11,
        8,
        "Throw three water shurikens in a narrow fan.",
        { count: 3, speed: 1000, radius: 11 },
      ),
      ability(
        "aqua-ring",
        "Aqua Ring",
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
        "shadow-clone",
        "Shadow Clone",
        "clone",
        0,
        15,
        "Leave a decoy that absorbs one projectile and gain a burst of speed.",
        { duration: 3.5, status: "haste", statusDuration: 2 },
      ),
      ability(
        "tidal-surge",
        "Tidal Surge",
        "charged",
        26,
        18,
        "A wide, powerful forward-moving wave with heavy knockback.",
        { cast: 0.25, speed: 520, radius: 42, range: 800, knockback: 200 },
      ),
    ],
  },
  lucario: {
    id: "lucario",
    name: "Lucario",
    element: "Fighting",
    role: "Counter specialist",
    description:
      "Durable martial artist. Punishes careless attacks with Counter Stance.",
    color: 0x78c7ef,
    health: 140,
    speed: 235,
    basic: basic(
      "aura-jab",
      "Aura Jab",
      "melee",
      10,
      320,
      "A close-range energy punch.",
      { range: 110, arc: 0.35 },
    ),
    skills: [
      ability(
        "aura-sphere",
        "Aura Sphere",
        "projectile",
        20,
        8,
        "A concentrated aura projectile.",
        { speed: 600, radius: 20 },
      ),
      ability(
        "force-palm",
        "Force Palm",
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
        "counter-stance",
        "Counter Stance",
        "counter",
        0,
        15,
        "For 1.6 seconds, take half damage and reflect 30% back to the attacker.",
        { duration: 1.6 },
      ),
      ability(
        "aura-burst",
        "Aura Burst",
        "nova",
        34,
        18,
        "After a short charge, a circular aura explosion.",
        { radius: 200, cast: 0.4, knockback: 150 },
      ),
    ],
  },
  eevee: {
    id: "eevee",
    name: "Eevee",
    element: "Normal",
    role: "Versatile fighter",
    description:
      "Balanced at every range. Helping Hand turns steady pressure into a damage race.",
    color: 0xd9a066,
    health: 115,
    speed: 265,
    basic: basic(
      "swift-star",
      "Swift Star",
      "projectile",
      7,
      300,
      "A glowing star projectile.",
      { speed: 820, radius: 10 },
    ),
    skills: [
      ability(
        "star-volley",
        "Star Volley",
        "barrage",
        8,
        8,
        "Five glowing stars in a spread.",
        { count: 5, speed: 880, radius: 10 },
      ),
      ability("bite", "Bite", "melee", 24, 12, "A powerful close-range bite.", {
        range: 120,
        arc: 0.4,
        knockback: 90,
      }),
      ability(
        "helping-hand",
        "Helping Hand",
        "buff",
        0,
        15,
        "For 5 seconds, deal 25% more damage and basic attack 30% faster.",
        { duration: 5 },
      ),
      ability(
        "last-resort",
        "Last Resort",
        "nova",
        40,
        18,
        "After a charge, a powerful energy burst around Eevee.",
        { radius: 210, cast: 0.45, knockback: 140 },
      ),
    ],
  },
  mewtwo: {
    id: "mewtwo",
    name: "Mewtwo",
    element: "Psychic",
    role: "High-power duelist",
    description:
      "Slower attacks with high damage. Controls space with beams, pushes and Barrier.",
    color: 0xc77dff,
    health: 120,
    speed: 255,
    basic: basic(
      "psy-bolt",
      "Psy Bolt",
      "projectile",
      10,
      400,
      "A psychic energy projectile.",
      { speed: 760, radius: 11 },
    ),
    skills: [
      ability(
        "psybeam",
        "Psybeam",
        "beam",
        24,
        8,
        "An instant psychic beam toward your aim. Walls block it. Slows.",
        { range: 760, radius: 16, status: "slow", statusDuration: 0.6 },
      ),
      ability(
        "psychic-wave",
        "Psychic Wave",
        "nova",
        12,
        12,
        "A shockwave that pushes nearby opponents far away.",
        { radius: 180, knockback: 260 },
      ),
      ability(
        "barrier",
        "Barrier",
        "barrier",
        0,
        15,
        "A defensive shield that blocks 60% of damage for 3 seconds.",
        { duration: 3 },
      ),
      ability(
        "psystrike",
        "Psystrike",
        "zone",
        48,
        18,
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
  snorlax: {
    id: "snorlax",
    name: "Snorlax",
    element: "Normal",
    role: "Defensive tank",
    description:
      "Huge health pool and crushing swings. Slow, so make the opponent come to you.",
    color: 0x4fa3a5,
    health: 175,
    speed: 215,
    basic: basic(
      "heavy-swipe",
      "Heavy Swipe",
      "melee",
      14,
      600,
      "A wide melee swing in front of Snorlax.",
      { range: 130, arc: 0, knockback: 70 },
    ),
    skills: [
      ability(
        "body-slam",
        "Body Slam",
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
        "rest",
        "Rest",
        "rest",
        0,
        12,
        "Fall asleep for 2.5 seconds: heal 60 HP but you can't act and take 25% more damage.",
        { duration: 2.5, heal: 12 },
      ),
      ability(
        "yawn",
        "Yawn",
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
        "heavy-impact",
        "Heavy Impact",
        "nova",
        36,
        18,
        "Slam the ground for a large shockwave. Jump to avoid it.",
        { radius: 230, cast: 0.5, ground: true, knockback: 140 },
      ),
    ],
  },
  gengar: {
    id: "gengar",
    name: "Gengar",
    element: "Ghost",
    role: "Trickster / area control",
    description:
      "Applies burns, then cashes them in with Hex. Rewards patient setups.",
    color: 0x9a6bd8,
    health: 105,
    speed: 260,
    basic: basic(
      "shadow-orb",
      "Shadow Orb",
      "projectile",
      8,
      350,
      "A ghostly projectile.",
      { speed: 720, radius: 11 },
    ),
    skills: [
      ability(
        "shadow-sneak",
        "Shadow Sneak",
        "projectile",
        20,
        8,
        "A fast shadow strike along the ground. Jump to avoid it.",
        { speed: 1100, radius: 16, ground: true },
      ),
      ability(
        "will-o-wisp",
        "Will-O-Wisp",
        "barrage",
        6,
        12,
        "Three ghostly flames that burn for 3 seconds.",
        { count: 3, speed: 520, radius: 12, status: "burn", statusDuration: 3 },
      ),
      ability(
        "hex",
        "Hex",
        "projectile",
        16,
        15,
        "A curse that deals double damage to enemies with a harmful status.",
        { speed: 760, radius: 14, bonusVsStatus: 2 },
      ),
      ability(
        "shadow-ball",
        "Shadow Ball",
        "charged",
        34,
        18,
        "After a short charge, a powerful ghost-energy orb that explodes.",
        { cast: 0.35, speed: 560, radius: 26, explosion: 120 },
      ),
    ],
  },
};
for (const character of Object.values(CHARACTERS))
  for (const skill of [character.basic, ...character.skills])
    skill.element = character.element;
/** Seconds between basic attacks, including Helping Hand. */
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
  "pikachu",
  "charizard",
  "greninja",
  "lucario",
  "eevee",
  "mewtwo",
  "snorlax",
  "gengar",
] as const satisfies readonly CharacterId[];
/** Older internal IDs, accepted so stale clients and saved sessions keep working. */
const legacyIds: Record<string, CharacterId> = {
  voltkit: "pikachu",
  cindrake: "charizard",
  tidefin: "greninja",
  auralynx: "lucario",
  duskveil: "eevee",
  thornback: "mewtwo",
  frostfang: "snorlax",
  terradon: "gengar",
  voltling: "pikachu",
  emberwing: "charizard",
  aquashade: "greninja",
  auralith: "lucario",
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
  /** Rest: health restored per tick. */
  amount?: number;
}
export interface Stats {
  dealt: number;
  received: number;
  skills: number;
}
export interface Fighter extends Vec {
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
  kind: "cast" | "hit" | "dash" | "jump" | "land" | "round" | "beam" | "burst";
  /** Beam end point. */
  tx?: number;
  ty?: number;
  abilityId?: string;
  color: number;
  value?: number;
  owner?: string;
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
      character: normalizeCharacterId(p.character) ?? "pikachu",
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
export function unpackSnapshot(s: WireSnapshot): Snapshot {
  return {
    ...s,
    players: s.players.map((p) => ({
      ...p,
      character: normalizeCharacterId(p.character) ?? "pikachu",
    })),
    projectiles: s.projectiles.map(({ abilityId, ...pr }) => ({
      ...pr,
      ability: abilities[abilityId],
    })),
    zones: s.zones.map(({ abilityId, ...zone }) => ({
      ...zone,
      ability: abilities[abilityId],
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
export function blocked(x: number, y: number, r = RULES.radius): boolean {
  return (
    x < r ||
    y < r ||
    x > RULES.width - r ||
    y > RULES.height - r ||
    OBSTACLES.some(
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
    const speed = CHARACTERS[p.character].speed * modifier;
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
