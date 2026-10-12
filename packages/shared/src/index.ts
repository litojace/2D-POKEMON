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
  skills: ["1", "2", "3", "RMB"],
  dash: "SHIFT",
  jump: "SPACE",
};
export const OBSTACLES = [
  { x: 490, y: 240, w: 90, h: 130 },
  { x: 1020, y: 530, w: 90, h: 130 },
  { x: 490, y: 530, w: 90, h: 130 },
  { x: 1020, y: 240, w: 90, h: 130 },
  { x: 750, y: 390, w: 100, h: 120 },
];
export type CharacterId = "voltling" | "emberwing" | "aquashade" | "auralith";
export type StatusKind =
  "burn" | "paralysis" | "slow" | "freeze" | "stun" | "shield" | "haste";
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
  | "charged";
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
  skills: [Ability, Ability, Ability, Ability];
}
export const CHARACTERS: Record<CharacterId, Character> = {
  voltling: {
    id: "voltling",
    name: "Pikachu",
    element: "Electric",
    role: "Fast ranged attacker",
    color: 0xffd65b,
    health: 110,
    speed: 270,
    basic: ability("spark", "Spark", "projectile", 8, 0.38, "A quick spark.", {
      speed: 800,
    }),
    skills: [
      ability(
        "thunderbolt",
        "Thunderbolt",
        "projectile",
        18,
        4,
        "A fast electric bolt.",
        { speed: 1000 },
      ),
      ability(
        "orb",
        "Electro Orb",
        "projectile",
        23,
        7,
        "A slow orb that explodes on impact.",
        { speed: 390, radius: 22, explosion: 100 },
      ),
      ability(
        "static",
        "Static Field",
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
        "Thunderstorm",
        "zone",
        10,
        30,
        "Repeated strikes in a large targeted area.",
        { radius: 185, duration: 4, range: 600 },
      ),
    ],
  },
  emberwing: {
    id: "emberwing",
    name: "Charizard",
    element: "Fire",
    role: "High-damage fighter",
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
        "Flame Burst",
        "projectile",
        18,
        5,
        "Fire that burns for two seconds.",
        { status: "burn", statusDuration: 2 },
      ),
      ability("spin", "Fire Spin", "zone", 6, 8, "A circular ground fire.", {
        radius: 125,
        duration: 3,
        ground: true,
        range: 400,
      }),
      ability(
        "rush",
        "Dragon Rush",
        "movement",
        22,
        10,
        "Rush forward and strike on contact.",
        { range: 270, duration: 0.3 },
      ),
      ability("inferno", "Inferno", "zone", 9, 30, "A large burning zone.", {
        radius: 200,
        duration: 4,
        ground: true,
        status: "burn",
        statusDuration: 1,
        range: 500,
      }),
    ],
  },
  aquashade: {
    id: "aquashade",
    name: "Greninja",
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
        "Water Shuriken",
        "projectile",
        18,
        4,
        "A sharp, fast water blade.",
        { speed: 1050 },
      ),
      ability(
        "step",
        "Shadow Step",
        "movement",
        0,
        8,
        "A fast directional reposition.",
        { range: 230, duration: 0.16 },
      ),
      ability(
        "clone",
        "Water Clone",
        "clone",
        0,
        12,
        "A decoy absorbs one projectile; gain a speed boost.",
        { duration: 3, status: "haste", statusDuration: 2 },
      ),
      ability(
        "barrage",
        "Shuriken Barrage",
        "barrage",
        12,
        30,
        "Seven water blades in a narrow fan.",
        { count: 7, speed: 950 },
      ),
    ],
  },
  auralith: {
    id: "auralith",
    name: "Lucario",
    element: "Fighting / Energy",
    role: "Melee and counter specialist",
    color: 0xb5a1ff,
    health: 140,
    speed: 235,
    basic: ability(
      "jab",
      "Aura Jab",
      "melee",
      12,
      0.48,
      "A close-range strike.",
      { range: 100, radius: 60 },
    ),
    skills: [
      ability(
        "sphere",
        "Aura Sphere",
        "projectile",
        20,
        5,
        "A focused energy sphere.",
        { radius: 20, speed: 580 },
      ),
      ability(
        "bone",
        "Bone Rush",
        "melee",
        28,
        7,
        "A powerful close-range combination.",
        { range: 145, radius: 90, knockback: 150 },
      ),
      ability(
        "counter",
        "Counter Stance",
        "counter",
        0,
        12,
        "Shield half of incoming damage and reflect part.",
        { duration: 1.4, status: "shield", statusDuration: 1.4 },
      ),
      ability(
        "blast",
        "Mega Aura Blast",
        "charged",
        45,
        30,
        "Charge a large blast. Keep aiming during the windup.",
        { cast: 0.65, radius: 40, speed: 850, explosion: 100, range: 1000 },
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
    skill: z.number().int().min(-1).max(3),
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
export const characterSchema = z.enum([
  "voltling",
  "emberwing",
  "aquashade",
  "auralith",
]);
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
