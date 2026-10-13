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
export const KEYS = {
  up: "W",
  left: "A",
  down: "S",
  right: "D",
  skills: ["1", "2", "R"],
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
  | "thornback"
  | "frostfang"
  | "duskveil"
  | "terradon";
export type StatusKind =
  | "burn"
  | "paralysis"
  | "slow"
  | "freeze"
  | "stun"
  | "shield"
  | "haste"
  | "stealth";
export const STATUS_RULES = {
  stacking: "refresh" as const,
  crowdControlImmunity: 2,
  burnDamage: 2,
  burnInterval: 0.5,
  slowMultiplier: 0.55,
  hasteMultiplier: 1.3,
  shieldReduction: 0.5,
  counterReflection: 0.3,
};
export type AbilityKind =
  | "projectile"
  | "zone"
  | "movement"
  | "clone"
  | "melee"
  | "counter"
  | "barrage"
  | "charged"
  | "stealth"
  | "heal";
export interface Ability {
  id: string;
  name: string;
  description: string;
  kind: AbilityKind;
  element: string;
  damage: number;
  cooldown: number;
  range: number;
  cast: number;
  recovery: number;
  speed: number;
  radius: number;
  duration: number;
  ground: boolean;
  knockback: number;
  status?: StatusKind;
  statusDuration?: number;
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
  element: "energy",
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
export interface Character {
  id: CharacterId;
  name: string;
  element: string;
  role: string;
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
    color: 0xffd65b,
    health: 110,
    speed: 270,
    basic: ability("spark", "Spark", "projectile", 8, 0.38, "A quick spark.", {
      speed: 800,
    }),
    skills: [
      ability(
        "thunderbolt",
        "Arc Pulse",
        "projectile",
        18,
        4,
        "A fast electric bolt.",
        { speed: 1000 },
      ),
      ability(
        "orb",
        "Charge Orb",
        "projectile",
        23,
        7,
        "A slow orb that explodes on impact.",
        { speed: 390, radius: 22, explosion: 100 },
      ),
      ability(
        "static",
        "Livewire Field",
        "zone",
        4,
        10,
        "A ground field that slows enemies.",
        {
          radius: 125,
          duration: 4,
          ground: true,
          status: "slow",
          statusDuration: 0.7,
          range: 450,
        },
      ),
      ability(
        "storm",
        "Overcharge",
        "zone",
        10,
        30,
        "Repeated strikes in a large targeted area.",
        { radius: 185, duration: 4, range: 600 },
      ),
    ],
  },
  cindrake: {
    id: "cindrake",
    name: "Cindrake",
    element: "Fire",
    role: "Burst damage fighter",
    color: 0xff795a,
    health: 125,
    speed: 240,
    basic: ability(
      "cinder",
      "Cinder",
      "projectile",
      9,
      0.45,
      "A burning cinder.",
      { speed: 650 },
    ),
    skills: [
      ability(
        "flame",
        "Crest Flare",
        "projectile",
        18,
        5,
        "Fire that burns for two seconds.",
        { status: "burn", statusDuration: 2 },
      ),
      ability("spin", "Ember Ring", "zone", 6, 8, "A circular ground fire.", {
        radius: 125,
        duration: 3,
        ground: true,
        range: 400,
      }),
      ability(
        "rush",
        "Ember Rush",
        "movement",
        22,
        10,
        "Rush forward and strike on contact.",
        { range: 270, duration: 0.3 },
      ),
      ability(
        "inferno",
        "Solar Bloom",
        "zone",
        9,
        30,
        "A large burning zone.",
        {
          radius: 200,
          duration: 4,
          ground: true,
          status: "burn",
          statusDuration: 1,
          range: 500,
        },
      ),
    ],
  },
  tidefin: {
    id: "tidefin",
    name: "Tidefin",
    element: "Water",
    role: "Agile assassin",
    color: 0x63dce8,
    health: 105,
    speed: 285,
    basic: ability(
      "droplet",
      "Droplet",
      "projectile",
      7,
      0.34,
      "A precise water dart.",
      { speed: 850 },
    ),
    skills: [
      ability(
        "shuriken",
        "Tidal Blade",
        "projectile",
        18,
        4,
        "A sharp, fast water blade.",
        { speed: 1050 },
      ),
      ability(
        "step",
        "Slipstream",
        "movement",
        0,
        8,
        "A fast directional reposition.",
        { range: 230, duration: 0.16 },
      ),
      ability(
        "clone",
        "Mirror Current",
        "clone",
        0,
        12,
        "A decoy absorbs one projectile; gain a speed boost.",
        { duration: 3, status: "haste", statusDuration: 2 },
      ),
      ability(
        "barrage",
        "Riptide Volley",
        "barrage",
        12,
        30,
        "Seven water blades in a narrow fan.",
        { count: 7, speed: 950 },
      ),
    ],
  },
  auralynx: {
    id: "auralynx",
    name: "Auralynx",
    element: "Energy",
    role: "Melee and counter specialist",
    color: 0xb5a1ff,
    health: 140,
    speed: 235,
    basic: ability(
      "jab",
      "Crystal Jab",
      "melee",
      12,
      0.48,
      "A close-range strike.",
      { range: 100, radius: 60 },
    ),
    skills: [
      ability(
        "sphere",
        "Prism Shot",
        "projectile",
        20,
        5,
        "A focused energy sphere.",
        { radius: 20, speed: 580 },
      ),
      ability(
        "bone",
        "Shard Combination",
        "melee",
        28,
        7,
        "A powerful close-range combination.",
        { range: 145, radius: 90, knockback: 150 },
      ),
      ability(
        "counter",
        "Prism Guard",
        "counter",
        0,
        12,
        "Shield half of incoming damage and reflect part.",
        { duration: 1.4, status: "shield", statusDuration: 1.4 },
      ),
      ability(
        "blast",
        "Nova Ray",
        "charged",
        45,
        30,
        "Charge a large blast. Keep aiming during the windup.",
        { cast: 0.65, radius: 40, speed: 850, explosion: 100, range: 1000 },
      ),
    ],
  },
  thornback: {
    id: "thornback",
    name: "Thornback",
    element: "Nature",
    role: "Defensive tank",
    color: 0x8fd58d,
    health: 185,
    speed: 185,
    basic: ability(
      "bough",
      "Bough Bash",
      "melee",
      12,
      0.7,
      "A short, sturdy shell strike.",
      { range: 95, knockback: 95 },
    ),
    skills: [
      ability(
        "seed",
        "Bramble Seed",
        "projectile",
        12,
        5,
        "A thorn seed that slows the enemy.",
        { speed: 480, status: "slow", statusDuration: 1.3 },
      ),
      ability(
        "bark",
        "Verdant Guard",
        "counter",
        0,
        11,
        "Reduce incoming damage by half and reflect part for two seconds.",
        { duration: 2 },
      ),
      ability(
        "roots",
        "Root Garden",
        "zone",
        4,
        10,
        "A vine patch that slows grounded enemies. Jump to cross it.",
        {
          radius: 135,
          range: 450,
          duration: 3,
          ground: true,
          status: "slow",
          statusDuration: 0.7,
        },
      ),
      ability(
        "bloom",
        "Wild Bloom",
        "zone",
        9,
        30,
        "Raise a large thorn garden after a brief cast. Stay out or jump through.",
        {
          cast: 0.35,
          radius: 180,
          range: 450,
          duration: 4,
          ground: true,
          status: "slow",
          statusDuration: 0.7,
        },
      ),
    ],
  },
  frostfang: {
    id: "frostfang",
    name: "Frostfang",
    element: "Ice",
    role: "Crowd control specialist",
    color: 0xb8edff,
    health: 115,
    speed: 225,
    basic: ability(
      "flake",
      "Frost Flake",
      "projectile",
      7,
      0.5,
      "A crisp shard of ice.",
      { speed: 650 },
    ),
    skills: [
      ability(
        "lance",
        "Ice Lance",
        "projectile",
        16,
        6,
        "A narrow lance that briefly freezes the target. Control immunity prevents chaining.",
        { speed: 800, status: "freeze", statusDuration: 0.6 },
      ),
      ability(
        "drift",
        "Snow Drift",
        "movement",
        0,
        8,
        "Slide forward out of danger.",
        { range: 220, duration: 0.22 },
      ),
      ability(
        "chill",
        "Cold Front",
        "zone",
        4,
        10,
        "Chilling ground slows enemies; jump over the cold.",
        {
          radius: 135,
          range: 480,
          duration: 3,
          ground: true,
          status: "slow",
          statusDuration: 0.8,
        },
      ),
      ability(
        "blizzard",
        "Crystal Blizzard",
        "barrage",
        9,
        30,
        "Five crystal shards spread across a wide fan.",
        {
          count: 5,
          speed: 700,
          status: "slow",
          statusDuration: 1.2,
          range: 700,
        },
      ),
    ],
  },
  duskveil: {
    id: "duskveil",
    name: "Duskveil",
    element: "Shadow",
    role: "Stealth assassin",
    color: 0xa98be6,
    health: 100,
    speed: 275,
    basic: ability(
      "wisp",
      "Night Wisp",
      "projectile",
      7,
      0.4,
      "A small shadow wisp.",
      { speed: 760 },
    ),
    skills: [
      ability(
        "rend",
        "Cloak Rend",
        "melee",
        25,
        5,
        "Strike at close range. Approach from an unexpected angle.",
        { range: 125, knockback: 80 },
      ),
      ability(
        "veil",
        "Shadow Veil",
        "stealth",
        0,
        12,
        "Fade for two seconds. Attacking or taking damage reveals you.",
        { duration: 2 },
      ),
      ability(
        "echo",
        "Hollow Echo",
        "clone",
        0,
        10,
        "Leave a one-hit decoy and gain a brief speed boost.",
        { duration: 2.5, statusDuration: 1.6 },
      ),
      ability(
        "eclipse",
        "Eclipse",
        "zone",
        8,
        30,
        "A shadow pool deals repeated damage and slows grounded enemies.",
        {
          radius: 160,
          range: 450,
          duration: 3,
          ground: true,
          status: "slow",
          statusDuration: 0.6,
        },
      ),
    ],
  },
  terradon: {
    id: "terradon",
    name: "Terradon",
    element: "Earth",
    role: "Heavy bruiser",
    color: 0xe6ac78,
    health: 170,
    speed: 195,
    basic: ability(
      "knuckle",
      "Stone Knuckle",
      "melee",
      15,
      0.65,
      "A heavy close-range punch.",
      { range: 105, knockback: 100 },
    ),
    skills: [
      ability(
        "fracture",
        "Faultline",
        "melee",
        25,
        7,
        "A forceful strike pushes enemies away.",
        { range: 145, knockback: 200 },
      ),
      ability(
        "bulwark",
        "Mineral Guard",
        "counter",
        0,
        12,
        "Brace with crystalline armor to reduce and reflect damage.",
        { duration: 1.8 },
      ),
      ability(
        "boulder",
        "Boulder Charge",
        "movement",
        20,
        10,
        "Charge forward, hitting an enemy once on contact.",
        { range: 240, duration: 0.3 },
      ),
      ability(
        "quake",
        "Seismic Crown",
        "zone",
        10,
        30,
        "A rumbling patch repeatedly strikes grounded enemies. Jump clear of it.",
        { radius: 185, range: 350, duration: 3, ground: true, knockback: 110 },
      ),
    ],
  },
};
for (const character of Object.values(CHARACTERS))
  for (const skill of [character.basic, ...character.skills])
    skill.element = character.element;
export interface Vec {
  x: number;
  y: number;
}
// Stable internal IDs preserve saved rooms and accounts while the presentation returns to Pokemon.
export const POKEMON_MOVES = {
  voltkit: [
    "Pikachu",
    "Electric",
    "Thunder Shot",
    "Volt Dash",
    "Electric Field",
    "Thunder Burst",
  ],
  cindrake: [
    "Charizard",
    "Fire",
    "Fire Breath",
    "Flame Dash",
    "Blazing Spin",
    "Inferno Strike",
  ],
  tidefin: [
    "Greninja",
    "Water",
    "Water Shuriken",
    "Aqua Dash",
    "Shadow Clone",
    "Water Burst",
  ],
  auralynx: [
    "Lucario",
    "Fighting",
    "Aura Sphere",
    "Force Palm",
    "Counter Stance",
    "Aura Burst",
  ],
  thornback: [
    "Gardevoir",
    "Psychic",
    "Psybeam",
    "Teleport",
    "Psychic Field",
    "Moonblast",
  ],
  frostfang: [
    "Garchomp",
    "Dragon",
    "Dragon Claw",
    "Sand Dash",
    "Earthquake",
    "Dragon Rush",
  ],
  duskveil: [
    "Sylveon",
    "Fairy",
    "Moonblast",
    "Charm",
    "Mystical Ribbon",
    "Healing Wish",
  ],
  terradon: [
    "Mimikyu",
    "Ghost",
    "Shadow Sneak",
    "Trick Room",
    "Phantom Claw",
    "Shadow Burst",
  ],
} as const;
for (const id of Object.keys(POKEMON_MOVES) as CharacterId[]) {
  const c = CHARACTERS[id],
    moves = POKEMON_MOVES[id],
    old = c.skills;
  c.color = {
    voltkit: 0xffd65b,
    cindrake: 0xef8558,
    tidefin: 0x5dbeef,
    auralynx: 0x78c7ef,
    thornback: 0xe999ce,
    frostfang: 0x777aee,
    duskveil: 0xf59ecb,
    terradon: 0xab85df,
  }[id];
  c.role = {
    voltkit: "Ranged speedster",
    cindrake: "Burst damage fighter",
    tidefin: "Agile assassin",
    auralynx: "Counter specialist",
    thornback: "Area control",
    frostfang: "Bruiser",
    duskveil: "Support and disruptor",
    terradon: "Trickster",
  }[id];
  if (id === "thornback") {
    c.health = 125;
    c.speed = 240;
  }
  if (id === "frostfang") {
    c.health = 160;
    c.speed = 230;
  }
  if (id === "duskveil") {
    c.health = 120;
    c.speed = 245;
  }
  if (id === "terradon") {
    c.health = 105;
    c.speed = 270;
  }
  c.name = moves[0];
  c.element = moves[1];
  c.basic = { ...old[0], name: moves[2], element: c.element };
  c.skills = [old[1], old[2], old[3]].map((a, i) => ({
    ...a,
    name: moves[i + 3],
    element: c.element,
  }));
  if (
    ["voltkit", "cindrake", "tidefin", "thornback", "frostfang"].includes(id)
  ) {
    c.skills[0] = {
      ...c.skills[0],
      kind: "movement",
      damage: id === "thornback" ? 0 : id === "cindrake" ? 22 : 12,
      range: 240,
      duration: id === "thornback" ? 0.08 : 0.24,
      cast: 0,
      description:
        id === "thornback"
          ? "A short teleport in the aimed direction; solid cover blocks the path."
          : "Rush forward and strike an enemy on contact.",
    };
  }
  if (id === "cindrake")
    c.skills[1] = {
      ...c.skills[1],
      kind: "zone",
      radius: 130,
      range: 120,
      duration: 3,
      ground: true,
      damage: 6,
      description:
        "A spinning patch of flame repeatedly damages grounded enemies.",
    };
  if (id === "frostfang") {
    c.basic = {
      ...c.basic,
      kind: "melee",
      range: 110,
      status: undefined,
      description: "Slash a nearby opponent with dragon claws.",
    };
    c.skills[1] = {
      ...c.skills[1],
      name: "Earthquake",
      ground: true,
      description: "Shake a patch of ground to damage and slow enemies.",
    };
    c.skills[2] = {
      ...c.skills[2],
      kind: "movement",
      range: 380,
      duration: 0.38,
      damage: 38,
      cast: 0,
      description: "A powerful dragon charge.",
    };
  }
  if (id === "duskveil") {
    c.basic = {
      ...c.basic,
      kind: "projectile",
      range: 650,
      speed: 700,
      description: "Launch a radiant fairy orb.",
    };
    c.skills[0] = {
      ...c.skills[0],
      kind: "zone",
      damage: 0,
      range: 300,
      radius: 95,
      duration: 2,
      status: "slow",
      statusDuration: 1,
      ground: false,
      description: "Charm a small area, slowing opponents.",
    };
    c.skills[1] = {
      ...c.skills[1],
      kind: "projectile",
      damage: 22,
      range: 650,
      speed: 600,
      description: "Send a ribbon of fairy energy toward an opponent.",
    };
    c.skills[2] = {
      ...c.skills[2],
      kind: "heal",
      damage: 35,
      description: "Restore up to 35 health to yourself.",
    };
  }
  if (id === "terradon") {
    c.skills[0] = {
      ...c.skills[0],
      kind: "zone",
      range: 300,
      radius: 130,
      duration: 3,
      damage: 0,
      status: "slow",
      statusDuration: 1,
      ground: false,
      description: "Create a spectral room that slows enemies.",
    };
    c.skills[1] = {
      ...c.skills[1],
      kind: "melee",
      damage: 24,
      range: 120,
      description: "Strike a nearby enemy with a phantom claw.",
    };
  }
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
    skill: z.number().int().min(-1).max(2),
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
  "thornback",
  "frostfang",
  "duskveil",
  "terradon",
] as const;
const legacyIds: Record<string, CharacterId> = {
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
  rush?: { until: number; damage: number; hit: boolean };
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
  kind: "cast" | "hit" | "dash" | "jump" | "land" | "round";
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
export function unpackSnapshot(s: WireSnapshot): Snapshot {
  return {
    ...s,
    players: s.players.map((p) => ({
      ...p,
      character: normalizeCharacterId(p.character) ?? "voltkit",
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
      if (s.kind === "freeze" || s.kind === "stun") modifier = 0;
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
