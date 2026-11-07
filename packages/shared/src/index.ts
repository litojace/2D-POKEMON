import type { RaidBossId, RaidLoadout, RaidState } from "./raid.js";
import type { ChampionLook } from "./shop.js";
import { z } from "zod";
import {
  META_KEYS,
  type MetaCache,
  type MetaKey,
  type SnapshotMeta,
} from "./snapshot-meta.js";
export * from "./snapshot-meta.js";
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
  reconnectMs: 60000,
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
  | "duskveil"
  | "coilemur"
  | "pyranda"
  | "glacelle"
  | "halcyra"
  | "sunbara"
  | "astrabun"
  | "wombolder"
  | "shadopus"
  | "pangrove"
  | "mossloth";
export type StatusKind =
  | "burn"
  | "paralysis"
  | "slow"
  | "freeze"
  | "stun"
  | "sleep"
  | "drowsy"
  /** Shell Up: pulled into a shell. Can't move or act, takes less damage, heals. */
  | "shell"
  | "shield"
  | "counter"
  | "empower"
  | "haste"
  | "stealth"
  /** Rooted: can't move or dash (a charge stops), but can still attack, cast and jump. */
  | "root"
  /** Inside a time bubble (Sloth Time): moves, dashes and rolls at STATUS_RULES.warpMultiplier. */
  | "warp"
  /** Taunted: walks toward the taunter (`tx`, `ty`), whatever its input; can still attack and cast. */
  | "taunt"
  /** Braced (Grudge Thump): no knockback or pull moves it. */
  | "brace"
  /** Leashed (Pinning Quill): can't go farther than `amount` px from (`tx`, `ty`). */
  | "leash"
  /** Blinded (Ink Jet): its basic attacks miss. */
  | "blind"
  /** Clamped (Static Clamp): a charge that goes off when it runs out (`by` = who clamped it). */
  | "clamp"
  /** Caged (Crystal Cage): can't cross the ring of radius `amount` round (`tx`, `ty`); `inside` says which side it is on. */
  | "cage"
  /** Combo setup: primed for the marker's payoff skill (`by` = the marker). */
  | "mark";
/** Statuses that count as harmful (the Shadow team-up gift, bots' targeting). */
export const DEBUFFS: StatusKind[] = [
  "burn",
  "paralysis",
  "slow",
  "freeze",
  "stun",
  "sleep",
  "drowsy",
  "root",
  "warp",
  "taunt",
  "leash",
  "blind",
  "clamp",
];
export const STATUS_RULES = {
  stacking: "refresh" as const,
  crowdControlImmunity: 2,
  burnDamage: 2,
  burnInterval: 0.5,
  slowMultiplier: 0.55,
  hasteMultiplier: 1.3,
  /** Damage multiplier while Facet Guard is active. */
  counterReduction: 0.5,
  counterReflection: 0.3,
  /** Damage multiplier while Wing Cloak is active. */
  shieldReduction: 0.4,
  /** Kindle: outgoing damage multiplier and basic attack interval multiplier. */
  empowerDamage: 1.25,
  empowerInterval: 0.7,
  /** Seconds between heal ticks while resting (Shell Up). */
  restInterval: 0.5,
  /** Damage multiplier while asleep. */
  sleepVulnerability: 1.2,
  /** Shell Up: damage multiplier while in the shell. */
  shellReduction: 0.55,
  /** Sloth Time: speed multiplier inside the bubble (movement and enemy shots). */
  warpMultiplier: 0.35,
};
/**
 * Pangrove's passive: armour plates. A hit of at least `minHit` damage breaks
 * one and only `block` of it gets through (0.4: the plate stops 60%); after
 * `regrowDelay` seconds without taking damage they grow back one every
 * `regrowEvery` seconds.
 */
export const PLATES = {
  max: 3,
  block: 0.4,
  minHit: 10,
  regrowDelay: 2.5,
  regrowEvery: 2,
};
/**
 * Mossloth's passive: moss grows while it stands still (under `stillSpeed`
 * px/s), a stack every `growEvery` seconds up to `max`, and falls off one
 * every `shedEvery` seconds once it moves. Each stack takes `reduction` off
 * damage taken and regrows `regen` health a second.
 */
export const MOSS = {
  max: 5,
  stillSpeed: 25,
  growEvery: 0.5,
  shedEvery: 0.3,
  reduction: 0.05,
  regen: 0.6,
};
/** Curl & Roll steering: time to build speed, turn rate, momentum lost turning and on walls. */
export const ROLL = {
  build: 0.45,
  start: 0.9,
  turn: 3.4,
  turnLoss: 0.35,
  wallLoss: 0.55,
  coast: 1.5,
  /** Ramming the same enemy again waits this long. */
  rehit: 0.6,
};
/** The passives, as players read them (the roster's overview, the tutorial). */
export const PASSIVES: Record<
  NonNullable<Character["passive"]>,
  { name: string; text: string }
> = {
  plates: {
    name: "Armour Plates",
    text: `Three leaf plates on your back. A hit of ${PLATES.minHit} damage or more breaks one, and only ${Math.round(PLATES.block * 100)}% of it gets through. After ${PLATES.regrowDelay} seconds without taking damage they grow back, one every ${PLATES.regrowEvery} seconds. Scale Shrapnel spends them.`,
  },
  moss: {
    name: "Moss",
    text: `Standing still grows moss: a stack every ${MOSS.growEvery} seconds, up to ${MOSS.max}. Each stack takes ${Math.round(MOSS.reduction * 100)}% off damage and heals ${MOSS.regen} health a second; moving sheds it. Overgrowth grows it full.`,
  },
};
/** Plates a fighter has now (Pangrove starts every round with all of them). */
export const platesOf = (p: { plates?: number }) => p.plates ?? PLATES.max;
/** A seedling's growth stage now: 0 (sprout), 1 (bud) or 2 (bloom). */
export function seedStage(zone: { born?: number; ability: Ability }, time: number) {
  const seed = zone.ability.seed;
  if (!seed) return 0;
  return Math.min(
    seed.stages.length - 1,
    Math.max(0, Math.floor((time - (zone.born ?? time)) / seed.grow)),
  );
}
/** Statuses that stop a fighter from moving and acting. */
export const DISABLING_STATUSES: StatusKind[] = ["stun", "freeze", "sleep", "shell"];
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
  /** Self buff: empower (Kindle), or `status` instead (Static Glide). */
  | "buff"
  /** Heal over time while unable to act: asleep, or in a shell (`status`). */
  | "rest"
  /**
   * Charge toward the aim for `range` px at `speed`. The first enemy touched
   * takes the hit (plus everyone within `explosion` of it) and the charge stops.
   */
  | "rush"
  /**
   * Teleport toward the aim, up to `range` px, stopping before walls. With
   * `damage`, a burst of `radius` hits enemies where the caster lands.
   */
  | "blink"
  /**
   * Stealth for `duration` (casting or taking damage reveals) plus haste for
   * `statusDuration`.
   */
  | "veil"
  /**
   * Shoot a tongue up to `range` px: the first enemy it reaches takes the hit
   * and the caster zips to it at `speed`; a wall pulls the caster to the wall.
   */
  | "grapple"
  /**
   * A fan (`fan` radians) of `count` blades for each armour plate the caster
   * has, plus `count` more; it spends every plate.
   */
  | "shrapnel"
  /**
   * Curl into a ball for up to `duration` seconds, steered like a vehicle:
   * speed builds toward `speed` px/s on straight lines, turning and walls
   * cost momentum, and enemies rammed take `damage` plus up to `roll.bonus`
   * at full speed. Casting it again uncurls.
   */
  | "roll"
  /**
   * Launch at `speed` and ricochet off up to `count` walls (faster after each),
   * hitting every enemy on each stretch once for `damage`.
   */
  | "pinball"
  /**
   * Plant a seed at the aim that grows for `seed.grow` seconds a stage; the
   * first enemy to step on it sets it off (more damage and a longer root at
   * each stage). At most `count` at once; it lasts `duration` seconds.
   */
  | "seedling"
  /**
   * A bubble at the aim for `duration`: enemies inside, and their shots,
   * move at `warp` times their speed.
   */
  | "timewarp"
  /**
   * Swap places with the enemy (not a raid boss) or own seedling nearest the
   * aim, within `radius` of the aim and `range` of the caster.
   */
  | "swap"
  /**
   * A curtain `screen.length` px wide, across the aim `screen.distance` px
   * ahead, for `duration`: enemy shots that touch it burn up, and enemies
   * crossing it get `status`.
   */
  | "screen"
  /**
   * Enemies within `radius` are Taunted for `statusDuration` (made to walk
   * toward the caster, still free to attack); the caster is Braced (no
   * knockback or pull) for `duration`.
   */
  | "taunt"
  /**
   * Jump back to where the caster was `rewind.seconds` ago and regain
   * `rewind.heal` of the health lost since (at most `rewind.max`).
   */
  | "rewind"
  /**
   * Lock a stream onto the enemy nearest the aim within `range`: every
   * `tether.tick` seconds it takes `damage` (the caster drains `drain` of it)
   * for up to `duration`, until it gets `tether.breakRange` px away or out
   * of sight.
   */
  | "tether"
  /**
   * Eyespots flash: enemies within `radius` who are facing the caster (aiming
   * within `gaze` radians of it) take `damage` and get `status`; the rest
   * only take `damage`.
   */
  | "gaze"
  /**
   * Clamp a charge onto the first enemy in front (melee reach): after `fuse`
   * seconds it takes `damage` and `status`, and arcs to enemies within
   * `explosion` of it for `chain` of that. A combo-primed target goes off at once.
   */
  | "clamp"
  /**
   * Seize the enemy in front (`range`, `arc`), hold it for `hold` seconds,
   * then hurl it `throw` px toward the aim: `damage` (× `wallSlam` into a
   * wall); enemies within `explosion` of where it lands take half.
   */
  | "throw"
  /**
   * Up to three strikes in front, each cast again within `chainWindow`
   * seconds of the last: `strikes` lists each one's damage; the last stuns
   * (`status`) and pushes (`knockback`). The cooldown starts after the last.
   */
  | "pound"
  /**
   * A ring of crystal `radius` px round the caster for `duration`: nobody
   * can cross it, nor can shots. Enemies inside take `damage` as it rises.
   */
  | "cage"
  /**
   * The caster glows for `duration`: `count` rays `range` px long turn round
   * it (a turn every `spin` seconds); an enemy a ray sweeps takes `damage`.
   */
  | "lighthouse";
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
  /**
   * Pushes the target away from the caster. Negative pulls it toward the
   * caster instead, stopping just in front of them.
   */
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
  /**
   * Rest: health restored per tick. Decoy: health restored on cast. Zone:
   * health restored each tick to the caster's team inside it.
   */
  heal?: number;
  /** Healing zone: the caster's own share of `heal` (0.5 = half). */
  selfHeal?: number;
  /**
   * Up to this much extra damage the farther the target is: none up close,
   * the full bonus at the ability's `range` (0.5 = +50%).
   */
  farBonus?: number;
  /**
   * Rush: if the knockback would drive the target into a wall, the hit deals
   * this many times the damage and its status lasts twice as long.
   */
  wallSlam?: number;
  /** Veil: the caster's first hit out of stealth deals this many times the damage. */
  ambush?: number;
  /** Life drain: the caster heals this share of the damage the hit deals (0.6 = 60%). */
  drain?: number;
  /** Shrapnel: the fan's width in radians. */
  fan?: number;
  /** Roll: extra ram damage at full speed, and the damage taken while curled. */
  roll?: { bonus: number; reduction: number };
  /** Pinball: speed multiplier after each bounce, and the damage taken meanwhile. */
  pinball?: { speedUp: number; reduction: number };
  /**
   * Seedling: seconds per growth stage, the share of `damage` and
   * `statusDuration` at each stage, and how close an enemy sets it off (px).
   */
  seed?: { grow: number; stages: number[]; trigger: number };
  /** Time bubble: speed multiplier for enemies and enemy shots inside. */
  warp?: number;
  /** Nova: every seedling the caster has blooms at full growth. */
  bloom?: boolean;
  /** Screen: how wide the curtain is and how far ahead it stands (px). */
  screen?: { length: number; distance: number };
  /** Projectile: flies `range` px out, then comes back to the caster, hitting on each pass. */
  boomerang?: boolean;
  /** Rewind: how far back (seconds), the share of health lost since it gives back, and the most. */
  rewind?: { seconds: number; heal: number; max: number };
  /** Tether: seconds between ticks, and how far the target can get before it snaps. */
  tether?: { tick: number; breakRange: number };
  /** Leash (status "leash"): how far from where it was hit the target can go (px). */
  leash?: number;
  /** Gaze: how closely (radians) an enemy must be aiming at the caster to be caught. */
  gaze?: number;
  /** Clamp: seconds until the charge goes off. */
  fuse?: number;
  /** Clamp: the share of the damage that arcs to enemies near the target. */
  chain?: number;
  /** Throw: seconds the enemy is held before it is hurled, and how far (px). */
  hold?: number;
  throw?: number;
  /** Pound: each strike's damage, in order. */
  strikes?: number[];
  /** Pound: seconds to cast the next strike before the chain ends. */
  chainWindow?: number;
  /** Lighthouse: seconds per turn of the rays. */
  spin?: number;
  /** Buff: the caster is airborne for `duration` (ground attacks miss). */
  glide?: boolean;
  /** Buff: a burst around the caster on cast that pushes enemies away and slows them. */
  pop?: { damage: number; radius: number; knockback: number; slow: number };
  /**
   * Zone: instead of hurting what is inside it, the zone shoots a projectile
   * at the nearest enemy within `range` every `tickInterval` seconds.
   */
  turret?: { damage: number; speed: number; radius: number; range: number };
  /** Set by the server on a self-combo payoff fired while primed (it lands later). */
  selfPrimed?: boolean;
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
  /** A passive of its own (Pangrove's armour plates, Mossloth's moss). */
  passive?: "plates" | "moss";
}
export const CHARACTERS: Record<CharacterId, Character> = {
  voltkit: {
    id: "voltkit",
    name: "Voltkit",
    element: "Electric",
    role: "Ranged speedster",
    description:
      "A sugar-glider kit that stores static in its antennae. Glides over trouble and stays deadly at range.",
    color: 0xffd65b,
    health: 153,
    speed: 270,
    basic: basic(
      "spark-dart",
      "Spark Dart",
      "projectile",
      6,
      270,
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
        "static-glide",
        "Static Glide",
        "buff",
        0,
        12,
        "Take off with a static pop that shoves nearby enemies away and slows them, then glide: airborne (ground attacks miss) and 30% faster. Gliding builds static (Charged).",
        {
          duration: 1.4,
          status: "haste",
          statusDuration: 1.4,
          glide: true,
          pop: { damage: 8, radius: 150, knockback: 170, slow: 0.8 },
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
    health: 151,
    speed: 240,
    basic: basic(
      "cinder-snap",
      "Cinder Snap",
      "melee",
      15,
      455,
      "A short-range burst of fire in front of Cindrake.",
      { range: 170, arc: 0.2, knockback: 10 },
    ),
    skills: [
      ability(
        "crest-flare",
        "Crest Flare",
        "cone",
        6,
        8,
        "The flame crest flares into a cone of fire for 1.2 seconds. Burns.",
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
        "heat-cracks",
        "Heat Cracks",
        "zone",
        6,
        15,
        "Cindrake's glowing cracks split open for 2.5 seconds, scorching everyone close by.",
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
        "A large pillar of fire erupts at the aim point. Burns.",
        {
          radius: 120,
          range: 520,
          duration: 1.2,
          cast: 0.15,
          tickDelay: 0.25,
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
      "An axolotl duelist in a river sash. The quickest fighter; pokes, slips away, regrows, then finishes.",
    color: 0x4fd6e6,
    health: 146,
    speed: 285,
    basic: basic(
      "tide-needle",
      "Tide Needle",
      "projectile",
      5,
      240,
      "A fast water projectile.",
      { speed: 950, radius: 8, range: 640 },
    ),
    skills: [
      ability(
        "gill-siphon",
        "Gill Siphon",
        "tether",
        3,
        10,
        "Lock a stream of water onto the enemy nearest your aim (380 px). For up to 2.1 seconds it takes 3 damage every 0.3 seconds and Tidefin drinks half of it back, until it gets 430 px away or out of sight.",
        { range: 380, radius: 60, duration: 2.1, knockback: 0, drain: 0.5, tether: { tick: 0.3, breakRange: 430 } },
      ),
      ability(
        "eddy",
        "Eddy",
        "zone",
        4,
        12,
        "A swirling eddy at the aim point that damages and slows enemies in it.",
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
        "tide-double",
        "Tide Double",
        "clone",
        0,
        15,
        "Leave a water double that soaks up one projectile, then dart away faster while regrowing 4 HP.",
        { duration: 3.5, status: "haste", statusDuration: 2, heal: 4 },
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
    health: 164,
    speed: 235,
    basic: basic(
      "prism-jab",
      "Prism Jab",
      "melee",
      13,
      335,
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
        "Fling one of the orbiting crystal shards.",
        { speed: 600, radius: 20 },
      ),
      ability(
        "shatter-paw",
        "Shatter Paw",
        "melee",
        28,
        12,
        "A crystal-gauntleted paw smash: big knockback and a brief stun.",
        {
          range: 145,
          arc: 0.3,
          knockback: 180,
          status: "stun",
          statusDuration: 0.4,
        },
      ),
      ability(
        "facet-guard",
        "Facet Guard",
        "counter",
        0,
        15,
        "For 1.6 seconds, the gauntlets' facets take half the damage and refract 30% back to the attacker.",
        { duration: 1.6 },
      ),
      ability(
        "crystal-cage",
        "Crystal Cage",
        "cage",
        24,
        20,
        "After a short charge, crystal spires rise in a 230 px ring round Auralynx for 3 seconds: nobody can cross it and no shot gets through. Enemies caught inside take 24.",
        { radius: 230, cast: 0.4, duration: 3, knockback: 0 },
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
    health: 139,
    speed: 265,
    basic: basic(
      "glint",
      "Glint",
      "projectile",
      6,
      310,
      "A glowing star projectile.",
      { speed: 820, radius: 10 },
    ),
    skills: [
      ability(
        "wing-dust",
        "Wing Dust",
        "barrage",
        8,
        8,
        "Beat your wings: five glittering motes of wing dust fly out in a spread.",
        { count: 5, speed: 880, radius: 10 },
      ),
      ability(
        "eyespot-flash",
        "Eyespot Flash",
        "gaze",
        8,
        12,
        "Flash the big eyespots on your wings: enemies within 300 px take 8, and those looking at Lumoth (aiming at it) are stunned for 0.8 seconds. Look away to dodge it.",
        {
          radius: 300,
          gaze: 0.6,
          knockback: 0,
          status: "stun",
          statusDuration: 0.8,
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
        "lighthouse",
        8,
        20,
        "After a charge, Lumoth glows like a lighthouse for 2.4 seconds: three rays of light 260 px long turn round it, and every enemy a ray sweeps takes 8.",
        {
          cast: 0.45,
          duration: 2.4,
          count: 3,
          range: 260,
          radius: 18,
          spin: 1.2,
          knockback: 0,
        },
      ),
    ],
  },
  mystowl: {
    id: "mystowl",
    name: "Mystowl",
    element: "Psychic",
    role: "High-power duelist",
    description:
      "A floating three-eyed owl. Slow, heavy attacks; controls space with its third-eye ray, a booming hoot and its wing cloak.",
    color: 0xff79d2,
    health: 134,
    speed: 255,
    basic: basic(
      "mind-dart",
      "Mind Dart",
      "projectile",
      8,
      390,
      "A psychic energy projectile.",
      { speed: 760, radius: 11 },
    ),
    skills: [
      ability(
        "third-eye-ray",
        "Third-Eye Ray",
        "beam",
        18,
        8,
        "An instant beam from the third-eye gem toward your aim. Walls block it. Slows.",
        { range: 760, radius: 16, status: "slow", statusDuration: 0.6 },
      ),
      ability(
        "booming-hoot",
        "Booming Hoot",
        "nova",
        12,
        12,
        "A booming hoot that blasts nearby opponents far away.",
        { radius: 180, knockback: 260 },
      ),
      ability(
        "wing-cloak",
        "Wing Cloak",
        "barrier",
        0,
        15,
        "Wrap up in your wing cloak: block 60% of damage for 3 seconds.",
        { duration: 3 },
      ),
      ability(
        "silent-swoop",
        "Silent Swoop",
        "zone",
        38,
        20,
        "A phantom owl swoops silently on the target spot.",
        {
          radius: 120,
          range: 600,
          cast: 0.2,
          duration: 0.7,
          tickDelay: 0.35,
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
      "A sleepy boulder tortoise. Huge health pool, crushing swings and a shell to hide in; make them come to you.",
    color: 0xc79a5b,
    health: 193,
    speed: 222,
    basic: basic(
      "boulder-swipe",
      "Boulder Swipe",
      "melee",
      15,
      630,
      "A wide melee swing in front of Terradon.",
      { range: 150, arc: 0, knockback: 25 },
    ),
    skills: [
      ability(
        "shell-bash",
        "Shell Bash",
        "melee",
        30,
        8,
        "Ram with the front of the shell: big knockback and a brief stun. No dash.",
        {
          range: 150,
          arc: 0.1,
          knockback: 160,
          status: "stun",
          statusDuration: 0.5,
        },
      ),
      ability(
        "shell-up",
        "Shell Up",
        "rest",
        0,
        16,
        "Pull into your shell for 2.5 seconds: you can't move or act, but take 45% less damage and regrow 25 HP.",
        { duration: 2.5, heal: 5, status: "shell" },
      ),
      ability(
        "mud-mire",
        "Mud Mire",
        "zone",
        0,
        15,
        "Stomp a patch of sticky mud that heavily slows enemies in it. Too sticky to jump out of.",
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
      "A hooded lantern wisp. Hangs its haunted lantern to hold ground, and strikes from the shadows at anything its ghostfire lights up.",
    color: 0x9c6bff,
    health: 152,
    speed: 260,
    basic: basic(
      "lantern-wisp",
      "Lantern Wisp",
      "projectile",
      9,
      345,
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
        "Three ghost-lantern flames that burn for 3 seconds and light the target up (Lit).",
        { count: 3, speed: 520, radius: 12, status: "burn", statusDuration: 3 },
      ),
      ability(
        "haunted-lantern",
        "Haunted Lantern",
        "zone",
        0,
        18,
        "Hang your lantern at the aim point: for 4 seconds it shoots a wisp at the nearest enemy in its light every 1.3 seconds.",
        {
          // The zone is the lantern itself; its light (turret.range) reaches much further.
          radius: 40,
          range: 450,
          duration: 4,
          knockback: 0,
          tickDelay: 0.4,
          tickInterval: 1.3,
          turret: { damage: 4, speed: 640, radius: 10, range: 330 },
        },
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
  coilemur: {
    id: "coilemur",
    name: "Coilemur",
    element: "Electric",
    role: "Grappler",
    description:
      "A ring-tailed lemur whose striped tail is a living electromagnet. Yanks runners in, then won't let go.",
    color: 0xf2c94c,
    health: 144,
    speed: 250,
    basic: basic(
      "coil-swipe",
      "Coil Swipe",
      "melee",
      12,
      360,
      "A quick crackling swipe in front of Coilemur.",
      { range: 140, arc: 0.3, knockback: 12 },
    ),
    skills: [
      ability(
        "magnet-lash",
        "Magnet Lash",
        "projectile",
        14,
        12,
        "Wind up for a quarter second, then crack your magnet tail toward the aim. The first enemy hit is dragged right up to you.",
        {
          cast: 0.25,
          speed: 1000,
          range: 560,
          radius: 12,
          knockback: -600,
        },
      ),
      ability(
        "static-clamp",
        "Static Clamp",
        "clamp",
        22,
        12,
        "Clamp a charge onto whoever is in front of you. 1.5 seconds later it goes off: 22 damage and paralysis, and it arcs to every enemy within 200 px of it for half.",
        {
          range: 150,
          arc: 0.35,
          knockback: 0,
          fuse: 1.5,
          explosion: 200,
          chain: 0.5,
          status: "paralysis",
          statusDuration: 0.6,
        },
      ),
      ability(
        "spark-tether",
        "Spark Tether",
        "zone",
        4,
        15,
        "For 3 seconds a charged ring around Coilemur shocks and slows anyone who stays close.",
        {
          radius: 135,
          duration: 3,
          follow: true,
          range: 0,
          tickDelay: 0.2,
          tickInterval: 0.5,
          knockback: 0,
          status: "slow",
          statusDuration: 0.6,
        },
      ),
      ability(
        "electromagnet",
        "Electromagnet",
        "zone",
        7,
        20,
        "Become a living magnet for 2 seconds: every enemy nearby is dragged toward you and shocked.",
        {
          radius: 250,
          duration: 2,
          follow: true,
          range: 0,
          tickDelay: 0.2,
          tickInterval: 0.4,
          knockback: -70,
          status: "paralysis",
          statusDuration: 0.4,
        },
      ),
    ],
  },
  pyranda: {
    id: "pyranda",
    name: "Pyranda",
    element: "Fire",
    role: "Artillery",
    description:
      "A shy red panda, the \"fire fox\", with a flame at the tip of its tail. Lobs burning chestnuts from the back line and curls up in its tail when caught.",
    color: 0xff8a3d,
    health: 140,
    speed: 235,
    basic: basic(
      "ember-lob",
      "Ember Lob",
      "projectile",
      10,
      440,
      "A long-range ember flicked from its tail.",
      { speed: 760, range: 760, radius: 12 },
    ),
    skills: [
      ability(
        "chestnut-mortar",
        "Chestnut Mortar",
        "zone",
        26,
        8,
        "Lob a burning chestnut over walls to the aim point. It lands 0.45 seconds later and burns.",
        {
          radius: 110,
          range: 720,
          duration: 0.5,
          tickDelay: 0.45,
          tickInterval: 1,
          knockback: 70,
          status: "burn",
          statusDuration: 1.5,
        },
      ),
      ability(
        "hot-coals",
        "Hot Coals",
        "zone",
        6,
        12,
        "Scatter a patch of hot coals for 4 seconds. Burns anyone standing in it. Jump to avoid it.",
        {
          radius: 120,
          range: 600,
          duration: 4,
          ground: true,
          tickInterval: 0.5,
          knockback: 0,
          status: "burn",
          statusDuration: 1.5,
        },
      ),
      ability(
        "ember-curtain",
        "Ember Curtain",
        "screen",
        7,
        10,
        "Sweep up a curtain of embers 240 px wide across your aim for 3 seconds: enemy shots that touch it burn up, and enemies on it take 7 damage every half second and catch fire.",
        { duration: 3, knockback: 0, status: "burn", statusDuration: 2, tickInterval: 0.5, screen: { length: 240, distance: 90 } },
      ),
      ability(
        "chestnut-storm",
        "Chestnut Storm",
        "zone",
        38,
        20,
        "Rain burning chestnuts on a huge area far away, over any wall. It glows for almost a second before it lands.",
        {
          radius: 180,
          range: 820,
          cast: 0.3,
          duration: 1,
          tickDelay: 0.9,
          tickInterval: 1,
          knockback: 130,
          status: "burn",
          statusDuration: 3,
        },
      ),
    ],
  },
  glacelle: {
    id: "glacelle",
    name: "Glacelle",
    element: "Water",
    role: "Frost controller",
    description:
      "A floating sea angel from the ice shelf. Slows, then freezes you solid; the only champion with true Freeze.",
    color: 0x9fe8ff,
    health: 152,
    speed: 255,
    basic: basic(
      "rime-shard",
      "Rime Shard",
      "projectile",
      8,
      325,
      "A small shard of ice.",
      { speed: 820, range: 660, radius: 10 },
    ),
    skills: [
      ability(
        "hailstone",
        "Hailstone",
        "projectile",
        18,
        8,
        "A heavy hailstone that slows for a second.",
        { speed: 900, radius: 14, status: "slow", statusDuration: 1 },
      ),
      ability(
        "frost-bloom",
        "Frost Bloom",
        "zone",
        14,
        12,
        "Frost blooms at the aim point and, after a moment, freezes everyone inside in place.",
        {
          radius: 125,
          range: 520,
          cast: 0.2,
          duration: 0.6,
          tickDelay: 0.5,
          tickInterval: 1,
          knockback: 0,
          status: "freeze",
          statusDuration: 0.9,
        },
      ),
      ability(
        "frost-breath",
        "Frost Breath",
        "cone",
        4,
        15,
        "Breathe a freezing cone for 1 second. Slows.",
        {
          range: 210,
          arc: 0.7,
          duration: 1,
          tickDelay: 0.1,
          tickInterval: 0.2,
          knockback: 0,
          status: "slow",
          statusDuration: 0.6,
        },
      ),
      ability(
        "whiteout",
        "Whiteout",
        "zone",
        6,
        20,
        "A blizzard at the aim point for 2.6 seconds: the first gust freezes, the rest keep stinging.",
        {
          radius: 180,
          range: 560,
          cast: 0.35,
          duration: 2.6,
          tickDelay: 0.3,
          tickInterval: 0.45,
          knockback: 0,
          status: "freeze",
          statusDuration: 1,
        },
      ),
    ],
  },
  halcyra: {
    id: "halcyra",
    name: "Halcyra",
    element: "Aura",
    role: "Marksman",
    description:
      "A kingfisher who focuses aura through a crystal beak. The longest reach in the arena, and the frailest body.",
    color: 0x6f8dff,
    health: 138,
    speed: 260,
    basic: basic(
      "aura-quill",
      "Aura Quill",
      "projectile",
      8,
      370,
      "A fast, long-range feather of aura. Up to 50% more damage the farther it flies.",
      { speed: 1000, range: 760, radius: 9, farBonus: 0.5 },
    ),
    skills: [
      ability(
        "pinning-quill",
        "Pinning Quill",
        "projectile",
        12,
        8,
        "A heavy quill that pins its target on a leash for 1.4 seconds: it can't go more than 110 px from where it was hit.",
        { speed: 1100, radius: 12, status: "leash", statusDuration: 1.4, leash: 110 },
      ),
      ability(
        "focus-shot",
        "Focus Shot",
        "beam",
        26,
        12,
        "Take aim for 0.4 seconds, then fire an instant beam across the court. Up to 50% more damage at long range. Walls block it.",
        { cast: 0.4, range: 1000, radius: 14, knockback: 60, farBonus: 0.5 },
      ),
      ability(
        "halcyon-rewind",
        "Halcyon Rewind",
        "rewind",
        0,
        17,
        "Dive back to where you were 2 seconds ago and win back 40% of the health you lost since (at most 18).",
        { knockback: 0, rewind: { seconds: 2, heal: 0.4, max: 18 } },
      ),
      ability(
        "skyline-lance",
        "Skyline Lance",
        "beam",
        40,
        20,
        "A long charge, then a lance of aura the width of the court. Decoys and walls stop it.",
        { cast: 0.6, range: 1400, radius: 26, knockback: 160 },
      ),
    ],
  },
  sunbara: {
    id: "sunbara",
    name: "Sunbara",
    element: "Light",
    role: "Support",
    description:
      "A capybara who bathes in sunlight with a glowing yuzu on its head. Everyone's friend; heals the whole team.",
    color: 0xffc26b,
    health: 190,
    speed: 240,
    basic: basic(
      "sunseed",
      "Sunseed",
      "projectile",
      7,
      335,
      "A warm seed of light.",
      { speed: 760, range: 620, radius: 10 },
    ),
    skills: [
      ability(
        "yuzu-toss",
        "Yuzu Toss",
        "projectile",
        14,
        8,
        "Toss a glowing yuzu that bursts on impact.",
        { speed: 650, radius: 16, explosion: 80 },
      ),
      ability(
        "warm-spring",
        "Warm Spring",
        "zone",
        0,
        12,
        "Open a warm spring at your feet for 3.5 seconds. Allies inside heal 4 HP every half second; Sunbara heals half that.",
        {
          radius: 130,
          range: 0,
          duration: 3.5,
          tickDelay: 0.25,
          tickInterval: 0.5,
          knockback: 0,
          heal: 4,
          selfHeal: 0.5,
        },
      ),
      ability(
        "daybreak",
        "Daybreak",
        "nova",
        10,
        15,
        "A flash of morning light around Sunbara that stuns briefly.",
        { radius: 150, knockback: 80, status: "stun", statusDuration: 0.5 },
      ),
      ability(
        "sanctuary",
        "Sanctuary",
        "zone",
        0,
        20,
        "For 4 seconds a sunny glade follows you: allies inside heal 7 HP every half second (Sunbara half that), enemies inside are slowed.",
        {
          radius: 220,
          range: 0,
          follow: true,
          duration: 4,
          tickDelay: 0.25,
          tickInterval: 0.5,
          knockback: 0,
          heal: 7,
          selfHeal: 0.5,
          status: "slow",
          statusDuration: 0.6,
        },
      ),
    ],
  },
  astrabun: {
    id: "astrabun",
    name: "Astrabun",
    element: "Psychic",
    role: "Blink duelist",
    description:
      "A moon rabbit with a mochi mallet. Hops through space to land right on top of you.",
    color: 0xd78bff,
    health: 134,
    speed: 262,
    basic: basic(
      "mallet-bop",
      "Mallet Bop",
      "melee",
      14,
      410,
      "A bonk with the mochi mallet.",
      { range: 145, arc: 0.3, knockback: 14 },
    ),
    skills: [
      ability(
        "moon-hop",
        "Moon Hop",
        "blink",
        10,
        8,
        "Teleport up to 300 px toward the aim (not through walls). A small burst where you land.",
        { range: 300, radius: 90, knockback: 40 },
      ),
      ability(
        "mochi-pound",
        "Mochi Pound",
        "pound",
        8,
        12,
        "Three pounds of the mallet: cast it again within 1.2 seconds for the next. 8, then 10, then 16 that stuns and knocks back. The cooldown starts after the last.",
        {
          range: 150,
          arc: 0.3,
          knockback: 150,
          status: "stun",
          statusDuration: 0.45,
          strikes: [8, 10, 16],
          chainWindow: 1.2,
        },
      ),
      ability(
        "moon-gravity",
        "Moon Gravity",
        "zone",
        4,
        15,
        "A patch of heavy moon gravity at the aim point for 2.5 seconds. Slows and stings.",
        {
          radius: 130,
          range: 450,
          duration: 2.5,
          tickInterval: 0.5,
          knockback: 0,
          status: "slow",
          statusDuration: 0.8,
        },
      ),
      ability(
        "full-moon",
        "Full Moon",
        "blink",
        36,
        20,
        "Rise for a moment, then crash down up to 450 px away in a big shockwave.",
        { range: 450, cast: 0.35, radius: 170, knockback: 150 },
      ),
    ],
  },
  wombolder: {
    id: "wombolder",
    name: "Wombolder",
    element: "Earth",
    role: "Charger",
    description:
      "A wombat with a rump like a boulder. Bulldozes in, blocks with its back end, and never stops digging.",
    color: 0xb08a62,
    health: 173,
    speed: 232,
    basic: basic(
      "rump-bump",
      "Rump Bump",
      "melee",
      16,
      535,
      "A wide shove with the rump.",
      { range: 140, arc: 0.15, knockback: 25 },
    ),
    skills: [
      ability(
        "burrow-rush",
        "Burrow Rush",
        "rush",
        16,
        9,
        "Charge up to 380 px toward the aim. The first enemy you hit is knocked back and stunned. Drive them into a wall for a slam: 50% more damage and a longer stun.",
        {
          range: 380,
          speed: 1100,
          knockback: 160,
          status: "stun",
          statusDuration: 0.35,
          wallSlam: 1.5,
        },
      ),
      ability(
        "bush-boomerang",
        "Bush Boomerang",
        "projectile",
        11,
        8,
        "Throw a boomerang 460 px: it comes back to you, hitting each enemy on the way out and again on the way back.",
        { speed: 820, range: 460, radius: 14, knockback: 20, boomerang: true },
      ),
      ability(
        "grudge-thump",
        "Grudge Thump",
        "taunt",
        8,
        14,
        "Thump the ground and glare: enemies within 240 px take 8 and are Taunted for 1.1 seconds (they must walk at you, but can still fight back). You're Braced for 1.5 seconds: nothing knocks you back or pulls you.",
        { radius: 240, duration: 1.5, knockback: 0, status: "taunt", statusDuration: 1.1 },
      ),
      ability(
        "landslide",
        "Landslide",
        "rush",
        30,
        20,
        "A long, unstoppable charge (620 px). On impact the ground erupts around the target; slamming them into a wall deals 30% more.",
        {
          range: 620,
          speed: 1300,
          cast: 0.25,
          explosion: 130,
          knockback: 180,
          status: "stun",
          statusDuration: 0.6,
          wallSlam: 1.3,
        },
      ),
    ],
  },
  shadopus: {
    id: "shadopus",
    name: "Shadopus",
    element: "Shadow",
    role: "Stealth assassin",
    description:
      "A midnight octopus that vanishes in its own ink. Fragile, fast, and gone before you turn around.",
    color: 0x7b5cff,
    health: 129,
    speed: 278,
    basic: basic(
      "tentacle-lash",
      "Tentacle Lash",
      "melee",
      11,
      305,
      "A quick lash of tentacles.",
      { range: 150, arc: 0.3, knockback: 10 },
    ),
    skills: [
      ability(
        "ink-jet",
        "Ink Jet",
        "projectile",
        9,
        11,
        "Squirt a jet of ink in their eyes: Blinded for 0.7 seconds, their basic attacks miss.",
        { speed: 950, range: 520, radius: 14, status: "blind", statusDuration: 0.7 },
      ),
      ability(
        "ink-strike",
        "Ink Strike",
        "melee",
        24,
        12,
        "A sharp eight-armed strike in front of you.",
        { range: 150, arc: 0.35, knockback: 60 },
      ),
      ability(
        "ink-cloud",
        "Ink Cloud",
        "veil",
        0,
        15,
        "Vanish in a cloud of ink: stealth for 2.5 seconds and a burst of speed. Casting or taking damage reveals you, and your first hit out of stealth deals 40% more.",
        { duration: 2.5, statusDuration: 1.5, ambush: 1.4 },
      ),
      ability(
        "kraken-grasp",
        "Kraken Grasp",
        "throw",
        34,
        20,
        "After a short wind-up, the tentacles seize the enemy in front (200 px), hold it for half a second, then hurl it 380 px toward your aim: 34 damage, half again into a wall. Enemies where it lands take half.",
        {
          range: 200,
          arc: 0,
          cast: 0.25,
          hold: 0.5,
          throw: 380,
          wallSlam: 1.5,
          explosion: 90,
          knockback: 0,
          status: "stun",
          statusDuration: 0.5,
        },
      ),
    ],
  },
  pangrove: {
    id: "pangrove",
    name: "Pangrove",
    element: "Nature",
    role: "Armoured roller",
    description:
      "A pangolin whose scales are living leaves. Three armour plates soak up hits; it grapples in with its tongue, curls into a ball you steer, and sheds its plates as blades.",
    color: 0x7fcf6a,
    health: 164,
    speed: 245,
    passive: "plates",
    basic: basic(
      "scale-swipe",
      "Scale Swipe",
      "melee",
      15,
      450,
      "A swipe of leafy scales in front of Pangrove.",
      { range: 150, arc: 0.25, knockback: 12 },
    ),
    skills: [
      ability(
        "tongue-grapple",
        "Tongue Grapple",
        "grapple",
        14,
        8,
        "Shoot out a sticky tongue. The first enemy it reaches takes 14 damage and is slowed, and Pangrove zips to it; a wall pulls Pangrove to the wall.",
        { range: 480, radius: 14, speed: 1300, knockback: 0, status: "slow", statusDuration: 1.2 },
      ),
      ability(
        "scale-shrapnel",
        "Scale Shrapnel",
        "shrapnel",
        6,
        9,
        "Shed your armour plates as a fan of blades: 3 blades, plus 3 for each plate you have. Every plate is spent and grows back later.",
        { count: 3, fan: 1.2, speed: 760, range: 300, radius: 10, knockback: 15 },
      ),
      ability(
        "curl-roll",
        "Curl & Roll",
        "roll",
        10,
        11,
        "Curl into a ball you steer for up to 3.5 seconds (cast again to uncurl). Speed builds on straight lines; ramming an enemy deals 10 to 34 damage, the faster the harder. Curled, you take 30% less damage.",
        { duration: 3.5, speed: 540, knockback: 140, roll: { bonus: 24, reduction: 0.7 } },
      ),
      ability(
        "pinball",
        "Pinball",
        "pinball",
        22,
        20,
        "Curl up and launch: ricochet off up to 4 walls, faster after each, hitting every enemy on each stretch for 22 damage. You take half damage meanwhile.",
        {
          cast: 0.2,
          speed: 950,
          count: 4,
          duration: 3,
          knockback: 150,
          pinball: { speedUp: 1.12, reduction: 0.5 },
        },
      ),
    ],
  },
  mossloth: {
    id: "mossloth",
    name: "Mossloth",
    element: "Nature",
    role: "Time gardener",
    description:
      "A three-toed sloth with a moss garden on its back. Moss grows while it stands still; it plants seeds that grow, slows time itself, and lazily swaps places.",
    color: 0x9bd36a,
    health: 170,
    speed: 240,
    passive: "moss",
    basic: basic(
      "seed-spit",
      "Seed Spit",
      "projectile",
      9,
      345,
      "Spit a hard seed.",
      { speed: 780, range: 640, radius: 10 },
    ),
    skills: [
      ability(
        "seedling",
        "Seedling",
        "seedling",
        26,
        5,
        "Plant a seed at the aim. It grows a stage every 1.5 seconds (sprout, bud, bloom); the first enemy to step on it sets it off for 9, 17 or 26 damage and a 0.5, 0.8 or 1.3 second root. Up to 3 at once; jump over them.",
        {
          range: 520,
          radius: 70,
          duration: 15,
          count: 3,
          ground: true,
          knockback: 0,
          status: "root",
          statusDuration: 1.3,
          bonusVsStatus: 1.4,
          seed: { grow: 1.5, stages: [0.36, 0.64, 1], trigger: 40 },
        },
      ),
      ability(
        "sloth-time",
        "Sloth Time",
        "timewarp",
        0,
        14,
        "Slow time in a bubble at the aim for 3 seconds: enemies inside, and their shots, move at a third of their speed.",
        { range: 520, radius: 150, duration: 3, knockback: 0, warp: 0.35 },
      ),
      ability(
        "lazy-swap",
        "Lazy Swap",
        "swap",
        0,
        12,
        "Swap places with the enemy or your own seedling nearest the aim (up to 600 px away). A swapped enemy is slowed for a second.",
        { range: 600, radius: 120, knockback: 0, status: "slow", statusDuration: 1 },
      ),
      ability(
        "overgrowth",
        "Overgrowth",
        "nova",
        28,
        20,
        "Vines erupt around Mossloth: 28 damage and Rooted for 1.2 seconds. Every seedling you have blooms at full growth, and your moss grows full.",
        { cast: 0.3, radius: 230, knockback: 0, status: "root", statusDuration: 1.2, bloom: true },
      ),
    ],
  },
};
/**
 * Free practice: the target drops this electrified ground patch every few
 * seconds so players can practise jumping. Not any fighter's skill.
 */
export const PRACTICE_GRID: Ability = {
  ...ability(
    "practice-grid",
    "Practice Grid",
    "zone",
    5,
    3,
    "A practice patch of electrified ground. Jump to avoid it.",
    { radius: 130, duration: 4, ground: true, status: "slow", statusDuration: 0.7, range: 450 },
  ),
  element: "Electric",
};
/**
 * Signature combos: one "setup → payoff" per fighter. The setup skill marks
 * its target (or, for `self` combos, the caster) for `window` seconds; the
 * payoff skill consumes the mark for a bonus. Readable mastery with no new
 * buttons. A self combo whose payoff is a projectile (Charged: Static Lance)
 * carries the mark on the shot, since the shot lands after the cast.
 */
export interface Combo {
  /** What the mark is called on screen. */
  name: string;
  setup: string;
  payoff: string;
  window: number;
  /** The mark sits on the caster instead of the target. */
  self?: boolean;
  /** Mark the caster when an attack hits them during the setup (Facet Guard). */
  onAbsorb?: boolean;
  /** No mark: the payoff works on any harmful status. */
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
    setup: "eddy",
    payoff: "riptide-wave",
    window: 3,
    damage: 1.3,
    text: "Eddy soaks enemies. Riptide Wave deals 30% more to Soaked targets.",
  },
  voltkit: {
    name: "Charged",
    setup: "static-glide",
    payoff: "static-lance",
    window: 2.5,
    self: true,
    damage: 1.15,
    status: "stun",
    statusDuration: 0.5,
    text: "Static Glide charges Voltkit. A Static Lance thrown while Charged stuns instead of paralysing.",
  },
  cindrake: {
    name: "Scorched",
    setup: "crest-flare",
    payoff: "magma-bomb",
    window: 3,
    damage: 1.35,
    status: "burn",
    statusDuration: 4,
    text: "Crest Flare scorches. Magma Bomb deals 35% more to Scorched targets and burns twice as long.",
  },
  mystowl: {
    name: "Dazed",
    setup: "booming-hoot",
    payoff: "silent-swoop",
    window: 3,
    damage: 1.4,
    text: "Booming Hoot dazes. Silent Swoop deals 40% more to Dazed targets.",
  },
  terradon: {
    name: "Mired",
    setup: "mud-mire",
    payoff: "shell-bash",
    window: 2.5,
    damage: 1.25,
    knockback: 1.5,
    text: "Mud Mire bogs enemies down. Shell Bash hits Mired targets 25% harder and further.",
  },
  lumoth: {
    name: "Kindled",
    setup: "kindle",
    payoff: "radiant-flare",
    window: 5,
    self: true,
    radius: 1.25,
    text: "Radiant Flare cast while Kindled has 25% longer rays.",
  },
  auralynx: {
    name: "Primed",
    setup: "facet-guard",
    payoff: "shatter-paw",
    window: 2.5,
    self: true,
    onAbsorb: true,
    damage: 1.4,
    status: "stun",
    statusDuration: 0.8,
    text: "Absorb a hit with Facet Guard to prime Shatter Paw: 40% more damage and a longer stun.",
  },
  duskveil: {
    name: "Lit",
    setup: "ghostfire",
    payoff: "shade-crawl",
    window: 3,
    damage: 1.25,
    text: "Ghostfire lights enemies up. Shade Crawl deals 25% more to Lit targets.",
  },
  coilemur: {
    name: "Magnetised",
    setup: "magnet-lash",
    payoff: "static-clamp",
    window: 2.5,
    damage: 1.35,
    status: "stun",
    statusDuration: 0.8,
    text: "Magnet Lash magnetises. Static Clamp on a Magnetised target goes off at once, deals 35% more and stuns.",
  },
  pyranda: {
    name: "Toasted",
    setup: "hot-coals",
    payoff: "chestnut-mortar",
    window: 3,
    damage: 1.3,
    text: "Hot Coals toast enemies. Chestnut Mortar deals 30% more to Toasted targets.",
  },
  glacelle: {
    name: "Chilled",
    setup: "hailstone",
    payoff: "frost-bloom",
    window: 3,
    damage: 1.3,
    status: "freeze",
    statusDuration: 1.3,
    text: "Hailstone chills. Frost Bloom hits Chilled targets 30% harder and freezes them longer.",
  },
  halcyra: {
    name: "Pinned",
    setup: "pinning-quill",
    payoff: "focus-shot",
    window: 3,
    damage: 1.35,
    text: "Pinning Quill pins its target on a leash. Focus Shot deals 35% more to a Pinned target.",
  },
  sunbara: {
    name: "Zested",
    setup: "yuzu-toss",
    payoff: "daybreak",
    window: 3,
    damage: 1.2,
    status: "stun",
    statusDuration: 0.9,
    text: "Yuzu Toss zests enemies. Daybreak stuns Zested targets almost twice as long.",
  },
  astrabun: {
    name: "Moonlit",
    setup: "moon-hop",
    payoff: "mochi-pound",
    window: 2,
    self: true,
    damage: 1.35,
    text: "The first Mochi Pound within 2 seconds of a Moon Hop deals 35% more.",
  },
  wombolder: {
    name: "Pelted",
    setup: "bush-boomerang",
    payoff: "burrow-rush",
    window: 3,
    damage: 1.3,
    status: "stun",
    statusDuration: 0.6,
    text: "Bush Boomerang pelts. Burrow Rush hits Pelted targets 30% harder and stuns longer.",
  },
  shadopus: {
    name: "Inked",
    setup: "ink-jet",
    payoff: "ink-strike",
    window: 3,
    damage: 1.4,
    text: "Ink Jet inks (and blinds) enemies. Ink Strike deals 40% more to Inked targets.",
  },
  pangrove: {
    name: "Latched",
    setup: "tongue-grapple",
    payoff: "scale-shrapnel",
    window: 2.5,
    self: true,
    damage: 1.35,
    text: "Tongue Grapple latches Pangrove on. Scale Shrapnel within 2.5 seconds deals 35% more.",
  },
  mossloth: {
    name: "Timelocked",
    setup: "sloth-time",
    payoff: "seedling",
    window: 3,
    anyDebuff: true,
    text: "A seedling set off by an enemy with a harmful status (in Sloth Time, slowed by a swap, rooted) deals 40% more.",
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
/**
 * 2v2 tuning, for the team mode only: a strength factor per champion in the
 * same form as the duel tuning, health × f and basic-attack interval ÷ √f
 * (rounded to 5 ms). Duels and raids use the champions' own numbers;
 * free-for-all has FFA_TUNING. Tuned with scripts/balance/tune-teams.ts; since
 * the bot fixes (bots pick their own target, Normal no longer flips
 * champions) every factor is within 10% of 1.
 */
export const TEAM_TUNING: Partial<Record<CharacterId, number>> = {
  voltkit: 1.045,
  cindrake: 0.993,
  tidefin: 1.037,
  auralynx: 0.97,
  lumoth: 0.997,
  mystowl: 1.006,
  terradon: 0.993,
  duskveil: 1.025,
  coilemur: 1.006,
  pyranda: 0.93,
  glacelle: 0.963,
  halcyra: 1,
  sunbara: 0.966,
  astrabun: 1.008,
  wombolder: 1.01,
  shadopus: 1.02,
  pangrove: 0.98,
  mossloth: 1.035,
};
/**
 * Free-for-all tuning, for mode "ffa" only, in the same form as TEAM_TUNING
 * (health × f, basic interval ÷ √f). A free-for-all is won by the last
 * fighter standing, so it rewards lasting rather than damage: melee champions
 * take about twice the damage per second of ranged ones (as in a duel), which
 * a duel repays with their higher damage but a free-for-all does not. Tuned
 * with scripts/balance/tune-teams.ts --mode ffa on four-player matches.
 */
export const FFA_TUNING: Partial<Record<CharacterId, number>> = {
  voltkit: 0.928,
  cindrake: 1.159,
  tidefin: 0.85,
  auralynx: 1.055,
  lumoth: 0.919,
  mystowl: 0.872,
  terradon: 1,
  duskveil: 0.917,
  coilemur: 1.178,
  pyranda: 0.876,
  glacelle: 0.981,
  halcyra: 0.845,
  sunbara: 0.911,
  astrabun: 1.026,
  wombolder: 1.054,
  shadopus: 1.06,
  pangrove: 1.02,
  mossloth: 0.94,
};
/**
 * The same for a free-for-all that started with three players, tuned on
 * three-player matches (--mode ffa --players 3): with one enemy fewer the
 * gap between melee and ranged champions is wider than with four.
 */
export const FFA_THREE_TUNING: Partial<Record<CharacterId, number>> = {
  voltkit: 0.868,
  cindrake: 1.189,
  tidefin: 0.835,
  auralynx: 1.127,
  lumoth: 0.864,
  mystowl: 0.838,
  terradon: 1.056,
  duskveil: 0.864,
  coilemur: 1.242,
  pyranda: 0.855,
  glacelle: 0.936,
  halcyra: 0.78,
  sunbara: 0.86,
  astrabun: 1.106,
  wombolder: 1.16,
  shadopus: 1.13,
  pangrove: 1.07,
  mossloth: 0.95,
};
/**
 * A champion's strength factor in this mode (1 outside 2v2 and free-for-all).
 * `players` is how many fighters the match started with; only a
 * free-for-all reads it (default: a full room).
 */
export function modeFactor(
  id: CharacterId,
  mode?: MatchMode,
  players = MODE_SIZE.ffa,
) {
  if (mode === "teams") return TEAM_TUNING[id] ?? 1;
  if (mode !== "ffa") return 1;
  return (players < MODE_SIZE.ffa ? FFA_THREE_TUNING : FFA_TUNING)[id] ?? 1;
}
/** A champion's full health in this mode (and free-for-all size). */
export function maxHealth(id: CharacterId, mode?: MatchMode, players?: number) {
  const f = modeFactor(id, mode, players);
  return f === 1
    ? CHARACTERS[id].health
    : Math.round(CHARACTERS[id].health * f);
}
/** Seconds between basic attacks, including Kindle, in this mode. */
export function basicInterval(
  character: Character,
  empowered = false,
  mode?: MatchMode,
  players?: number,
) {
  const base = character.basic.interval ?? 0.3,
    f = modeFactor(character.id, mode, players);
  const interval =
    f === 1 ? base : Math.round((base * 1000) / Math.sqrt(f) / 5) * 5 / 1000;
  return interval * (empowered ? STATUS_RULES.empowerInterval : 1);
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
  /** Cast this skill's EX version (spends EX.cost of the ultimate meter). */
  ex?: boolean;
}
/**
 * EX skills: spend a third of the ultimate meter for a stronger skill 1-3.
 * Pressing the ultimate button before the meter is full arms it.
 */
export const EX = {
  cost: 33,
  damage: 1.35,
  radius: 1.2,
  /** How long an armed EX waits for a skill. */
  armSeconds: 4,
};
/** The EX version of an ability: more damage (or healing) and reach. */
export function exAbility(a: Ability): Ability {
  return {
    ...a,
    damage: Math.round(a.damage * EX.damage),
    radius: a.radius * EX.radius,
    ...(a.heal ? { heal: Math.round(a.heal * EX.damage) } : {}),
    ...(a.turret
      ? { turret: { ...a.turret, damage: Math.round(a.turret.damage * EX.damage), range: a.turret.range * EX.radius } }
      : {}),
    ...(a.pop
      ? { pop: { ...a.pop, damage: Math.round(a.pop.damage * EX.damage), radius: a.pop.radius * EX.radius } }
      : {}),
  };
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
    ex: z.boolean().optional(),
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
  "coilemur",
  "pyranda",
  "glacelle",
  "halcyra",
  "sunbara",
  "astrabun",
  "wombolder",
  "shadopus",
  "pangrove",
  "mossloth",
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
  /** Rest (Shell Up): health restored per tick. Leash: its length (px). */
  amount?: number;
  /** Taunt: where the taunter is (kept up to date). Leash: where it is pinned. Cage: its centre. */
  tx?: number;
  ty?: number;
  /** Cage: true when the fighter was inside the ring as it rose. */
  inside?: boolean;
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
  /** Ultimates used. */
  ults?: number;
  /** Times this fighter was knocked out. */
  knocked?: number;
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
export type MatchMode = "duel" | "teams" | "ffa" | "raid";
/** Most players a room holds for each mode. */
export const MODE_SIZE: Record<MatchMode, number> = {
  duel: 2,
  teams: 4,
  ffa: 4,
  raid: 4,
};
/** Fewest players needed to start (a free-for-all can start with three). */
export const MODE_MIN: Record<MatchMode, number> = {
  duel: 2,
  teams: 4,
  ffa: 3,
  raid: 1,
};
export const TEAM_NAMES = ["Blue", "Red"] as const;
export interface Fighter extends Vec {
  raidBoss?: boolean;
  /** Equipped raid appearance (skin, aura, entrance, frame). */
  raidLook?: RaidLoadout;
  /** Equipped Shop skin for each champion (only the one being played shows). */
  championLooks?: Partial<Record<CharacterId, ChampionLook>>;
  /** Verified boss clears, used for the equipped portrait frame’s earned stars. */
  raidClears?: Partial<Record<RaidBossId, number>>;
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
  /** Mastery flair shown under this fighter (verified by the server). */
  flair?: "Bronze" | "Silver" | "Gold" | "Crystal";
  /** Orb Rush: gems this fighter is carrying. */
  gems?: number;
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
  charge?: { at: number; skill: number; ex?: boolean };
  /** Active continuous cone (Fire Breath). */
  channel?: { until: number; nextTick: number; skill: number; ex?: boolean };
  clone?: Vec & { until: number };
  /** Pangrove: armour plates left (undefined = all), and when the next grows back. */
  plates?: number;
  plateAt?: number;
  /** Mossloth: moss stacks, when the next one grows or falls, and whether it stood still. */
  moss?: number;
  mossAt?: number;
  mossStill?: boolean;
  /** Curl & Roll: rolling until `until`, at `speed` px/s toward `heading`, building to `top`. */
  roll?: { until: number; speed: number; heading: number; top: number; slot: number };
  /** Pinball: bounces left and the speed-up per bounce (the flight itself is the dash). */
  pinball?: { bounces: number; speedUp: number };
  /** Gill Siphon: the stream locked onto `target` until `until`; the next tick, and the skill slot. */
  tether?: { target: string; until: number; nextTick: number; skill: number };
  /** Mochi Pound: the strike it is on, the slot, until when the next can follow, and the cooldown's end. */
  pound?: { skill: number; step: number; until: number; cdEnd: number };
  /** Kraken Grasp: the enemy held in front, hurled at `at` (`skill` is the slot). */
  grab?: { target: string; at: number; skill: number };
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
  /** Boomerang: on its way back to the caster. */
  back?: boolean;
  /** Boomerang: who it has hit on this pass. */
  hit?: string[];
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
    description: "Always the Coliseum Sands: no arena hazards.",
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
  rush: {
    name: "Orb Rush",
    description: "Grab gems and carry them to your goal; bank 5 to win the round. Big hits knock gems loose.",
  },
} as const;
/** 2v2 team-up: partners fighting side by side both hit harder. */
export const TEAMUP = { range: 260, damage: 1.1 };
/**
 * Element team-ups: side by side in 2v2, each fighter also gives their
 * partner a gift from their element, so every pairing plays a little
 * differently (Tidefin + Voltkit: steady healing and faster basics).
 */
export const ELEMENT_GIFTS: Record<
  string,
  { name: string; text: string; value: number }
> = {
  Electric: { name: "Static charge", text: "basic attacks come 12% faster", value: 0.88 },
  Fire: { name: "Kindling", text: "+6% damage", value: 1.06 },
  Water: { name: "Tidewell", text: "heals 2 health a second", value: 2 },
  Aura: { name: "Aura ward", text: "takes 8% less damage", value: 0.92 },
  Light: { name: "Glow", text: "skills recharge 10% faster", value: 0.9 },
  Psychic: { name: "Focus", text: "ultimate charges 15% faster", value: 1.15 },
  Earth: { name: "Bedrock", text: "knocked back 40% less", value: 0.6 },
  Shadow: { name: "Dusk edge", text: "+10% damage to slowed, burning or stunned foes", value: 1.1 },
  Nature: { name: "Lifebloom", text: "heals 6% of the damage dealt", value: 0.06 },
};
/** The gift a fighter's partner gives them (by the partner's element). */
export function giftFrom(partnerCharacter: CharacterId) {
  const element = CHARACTERS[partnerCharacter].element;
  return { element, ...ELEMENT_GIFTS[element] };
}
/** Orb Rush: gems to grab and bank at your own goal. */
export const RUSH = {
  target: 5,
  /** A new gem every few seconds, up to `max` on the court. */
  spawnEvery: 3.5,
  max: 4,
  pickup: 42,
  goalRadius: 70,
  /** A hit at least this big knocks one carried gem loose. */
  dropDamage: 15,
};
/** Where each side banks gems: its own end of the court (or corner). */
export function rushGoals(mode: MatchMode | undefined): Vec[] {
  return mode === "ffa"
    ? [
        { x: 130, y: 130 },
        { x: 1470, y: 770 },
        { x: 1470, y: 130 },
        { x: 130, y: 770 },
      ]
    : [
        { x: 110, y: 450 },
        { x: 1490, y: 450 },
      ];
}
export interface Gem extends Vec {
  id: number;
}
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
  /** When it was placed (seedlings grow from then). */
  born?: number;
  /** Screen: which way the curtain runs (radians). Lighthouse: where the first ray points. */
  angle?: number;
}
export interface GameEvent extends Vec {
  id: number;
  raidRadius?: number;
  kind:
    | "raid-impact"
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
  /** Hit events: the attacker's first hit out of stealth (`ambush`). */
  ambush?: boolean;
  /** Burst events (a rush landing): the target was driven into a wall (`wallSlam`). */
  slam?: boolean;
  /** Hit events: a blinded attacker's basic attack missed. */
  miss?: boolean;
  /** Burst events (Mochi Pound): which strike of the chain it was (1, 2, 3). */
  step?: number;
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
  activityStatus?: "saving" | "saved" | "unavailable";
  activityEligible?: string[];
  arcade?: import("./arcade.js").ArcadeState;
  raid?: RaidState;
  /** Somnara: sent only to this player; absent from public/spectator snapshots. */
  raidDream?: import("./raid-somnara.js").RaidDreamView;
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
  /** Orb Rush: gems on the court and gems banked per side. */
  gems?: Gem[];
  banked?: number[];
  /** Which arena this match is played in, and when its hazards' clock started. */
  arena?: ArenaId;
  hazardClock?: number;
}
export type WireSnapshot = Omit<
  Snapshot,
  "projectiles" | "zones" | "players"
> & {
  /** Compact snapshots omit META_KEYS and send lastInput as just the aim. */
  players: (Omit<Fighter, MetaKey | "lastInput"> &
    Partial<Pick<Fighter, MetaKey>> & {
      lastInput: Pick<Input, "aimX" | "aimY"> & Partial<Input>;
    })[];
  projectiles: (Omit<Projectile, "ability"> & { abilityId: string })[];
  zones: (Omit<Zone, "ability"> & { abilityId: string })[];
  /** Appearance revision this snapshot's fighters wear (compact snapshots). */
  metaRev?: number;
  /** Appearance block, sent when it changes or a socket (re)joins. */
  meta?: SnapshotMeta;
};
const META_KEY_SET: ReadonlySet<string> = new Set(META_KEYS);
/** Display-only positions: 0.01 px is far below anything drawn. */
const fine = (n: number) => Math.round(n * 100) / 100;
/**
 * Fighters keep every value the client's prediction replays (position,
 * velocity, dash, times) exact: rounding a position can flip how a step
 * slides around a pillar corner. Only display values are rounded.
 */
function compactFighter(p: Fighter) {
  const out: Record<string, unknown> = {};
  for (const key in p)
    if (!META_KEY_SET.has(key)) out[key] = p[key as keyof Fighter];
  // Prediction re-aims every step; facing is drawn, 0.0001 rad is invisible.
  out.angle = Math.round(p.angle * 1e4) / 1e4;
  // Never show an ultimate as ready before the server's meter is full.
  if (p.ult !== undefined) out.ult = Math.floor(p.ult * 100) / 100;
  // Clients only draw other fighters' aim (wind-up telegraphs).
  out.lastInput = { aimX: fine(p.lastInput.aimX), aimY: fine(p.lastInput.aimY) };
  return out as WireSnapshot["players"][number];
}
/**
 * The projectile a turret zone fires (Haunted Lantern's wisps). It has its own
 * id so clients, which rebuild projectiles from ids, draw a small wisp rather
 * than the lantern.
 */
export function turretShot(zone: Ability): Ability {
  const t = zone.turret!;
  return {
    ...zone,
    id: `${zone.id}-shot`,
    kind: "projectile",
    damage: t.damage,
    radius: t.radius,
    speed: t.speed,
    range: t.range * 1.3,
    knockback: 0,
    turret: undefined,
    visual: "projectile",
    sound: "projectile",
  };
}
const abilities = Object.fromEntries(
  [
    ...Object.values(CHARACTERS).flatMap((c) => [c.basic, ...c.skills]),
    ...Object.values(CHARACTERS).flatMap((c) =>
      c.skills.filter((a) => a.turret).map(turretShot),
    ),
    PRACTICE_GRID,
  ].map((a) => [a.id, a]),
);
/**
 * Snapshot for the wire. Without options every fighter is sent in full (as
 * older clients and tests expect). With `compact`, appearance moves to the
 * optional `meta` block (see snapshot-meta.ts) and positions are rounded.
 */
export function packSnapshot(
  s: Snapshot,
  options?: { compact: true; metaRev: number; meta?: SnapshotMeta },
): WireSnapshot {
  if (options?.compact)
    return {
      ...s,
      players: s.players.map((p) => ({
        ...compactFighter(p),
        character: normalizeCharacterId(p.character) ?? "voltkit",
      })),
      projectiles: s.projectiles.map(({ ability, ...pr }) => ({
        ...pr,
        x: fine(pr.x),
        y: fine(pr.y),
        vx: fine(pr.vx),
        vy: fine(pr.vy),
        remaining: fine(pr.remaining),
        abilityId: ability.id,
      })),
      zones: s.zones.map(({ ability, ...zone }) => ({
        ...zone,
        abilityId: ability.id,
      })),
      metaRev: options.metaRev,
      ...(options.meta ? { meta: options.meta } : {}),
    };
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
/**
 * Back to a full Snapshot. Compact fighters get their appearance from
 * `cache` (updated here from any `meta` block); full ones are used as sent.
 */
export function unpackSnapshot(s: WireSnapshot, cache?: MetaCache): Snapshot {
  if (s.meta && cache) cache.apply(s.code, s.meta);
  const { meta: _meta, metaRev: _rev, ...rest } = s;
  return {
    ...rest,
    players: s.players.map((p) => {
      const known =
        s.metaRev !== undefined
          ? (cache?.get(s.code, p.id) ?? s.meta?.players[p.id])
          : undefined;
      return {
        ...(known ?? {}),
        ...p,
        name: p.name ?? known?.name ?? "",
        lastInput: { ...blankInput(), ...p.lastInput },
        character: normalizeCharacterId(p.character) ?? "voltkit",
      } as Fighter;
    }),
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
  /** Plaza joins: your walker id in it. */
  me?: number;
  /** Plaza joins: which Plaza copy (with `me`). */
  plaza?: number;
  /** Gold Leaves left after a Plaza purchase. */
  leaves?: number;
  /** A Plaza treat: the crop thrown, and the treats you have left. */
  crop?: string;
  treats?: number;
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
/**
 * Where a blink from `from` toward `angle` lands: up to `distance` px,
 * stopping before the first wall (it never passes through one).
 */
export function blinkLanding(from: Vec, angle: number, distance: number): Vec {
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  let x = from.x,
    y = from.y;
  for (let d = 8; d < distance + 8; d += 8) {
    const step = Math.min(d, distance);
    const nx = from.x + dx * step,
      ny = from.y + dy * step;
    if (blocked(nx, ny, RULES.radius)) break;
    x = nx;
    y = ny;
  }
  return { x, y };
}
/** Damage multiplier for `farBonus` against a target `distance` px away. */
export function farMultiplier(a: Ability, distance: number) {
  return a.farBonus
    ? 1 + a.farBonus * Math.min(1, distance / Math.max(1, a.range))
    : 1;
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
  stepMovement(p, input, dt, time);
  holdInCage(p, time);
}
/**
 * Crystal Cage: whoever was inside the ring stays inside, whoever was outside
 * stays out (after any move, knockbacks included).
 */
export function holdInCage(p: Fighter, time: number) {
  for (const cage of p.statuses) {
    if (cage.kind !== "cage" || cage.until <= time || cage.tx === undefined)
      continue;
    const R = cage.amount ?? 200,
      dx = p.x - cage.tx,
      dy = p.y - cage.ty!,
      d = Math.hypot(dx, dy);
    const ux = d > 0.001 ? dx / d : 1,
      uy = d > 0.001 ? dy / d : 0;
    if (cage.inside) {
      const max = R - RULES.radius;
      if (d <= max) continue;
      for (let k = max; k >= 0; k -= 10)
        if (!blocked(cage.tx + ux * k, cage.ty! + uy * k)) {
          p.x = cage.tx + ux * k;
          p.y = cage.ty! + uy * k;
          break;
        }
    } else {
      const min = R + RULES.radius;
      if (d >= min) continue;
      for (let k = min; k <= min + 200; k += 10)
        if (!blocked(cage.tx + ux * k, cage.ty! + uy * k)) {
          p.x = cage.tx + ux * k;
          p.y = cage.ty! + uy * k;
          break;
        }
    }
    p.vx = p.vy = 0;
  }
}
function stepMovement(p: Fighter, input: Input, dt: number, time: number): void {
  let dir = normalize(input.dx, input.dy);
  p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  // Taunted: it walks toward the taunter, whatever the input says.
  const taunt = p.statuses.find(
    (s) => s.kind === "taunt" && s.until > time && s.tx !== undefined,
  );
  if (taunt) {
    const d = Math.hypot(taunt.tx! - p.x, taunt.ty! - p.y);
    dir = d > RULES.radius * 2 ? { x: (taunt.tx! - p.x) / d, y: (taunt.ty! - p.y) / d } : { x: 0, y: 0 };
  }
  const leash = p.statuses.find(
    (s) => s.kind === "leash" && s.until > time && s.tx !== undefined,
  );
  const leashFrom = leash ? { x: p.x, y: p.y } : undefined;
  let modifier = 1,
    warp = 1;
  for (const s of p.statuses)
    if (s.until > time) {
      if (DISABLING_STATUSES.includes(s.kind)) modifier = 0;
      if (s.kind === "slow" || s.kind === "paralysis")
        modifier *= STATUS_RULES.slowMultiplier;
      if (s.kind === "haste") modifier *= STATUS_RULES.hasteMultiplier;
      if (s.kind === "root") modifier = 0;
      if (s.kind === "warp") warp = STATUS_RULES.warpMultiplier;
    }
  modifier *= warp;
  if (p.pinball && time < p.dashUntil && modifier > 0) {
    // Pinball: fly at the dash velocity and bounce off walls, faster each time.
    const r = RULES.radius;
    const nx = p.x + p.dashX * warp * dt,
      ny = p.y + p.dashY * warp * dt;
    const hitX = blocked(nx, p.y, r),
      hitY = blocked(p.x, ny, r);
    if (hitX || hitY) {
      if (p.pinball.bounces <= 0) {
        // Out of bounces: the next wall ends the flight.
        p.dashUntil = time;
        p.vx = p.vy = 0;
        return;
      }
      p.pinball.bounces--;
      if (hitX) p.dashX = -p.dashX;
      if (hitY) p.dashY = -p.dashY;
      p.dashX *= p.pinball.speedUp;
      p.dashY *= p.pinball.speedUp;
    }
    p.vx = p.dashX * warp;
    p.vy = p.dashY * warp;
    move(p, p.vx * dt, p.vy * dt);
    return;
  }
  if (p.roll && time < p.roll.until && time >= p.dashUntil) {
    // Curl & Roll: steer a ball. Speed builds toward `top` on a straight
    // line; turning and walls cost momentum.
    const roll = p.roll;
    if (dir.x || dir.y) {
      const want = Math.atan2(dir.y, dir.x);
      const diff = Math.atan2(
        Math.sin(want - roll.heading),
        Math.cos(want - roll.heading),
      );
      const turn = Math.max(-ROLL.turn * dt, Math.min(ROLL.turn * dt, diff));
      roll.heading += turn;
      roll.speed *= 1 - Math.abs(turn) * ROLL.turnLoss;
      roll.speed += (roll.top - roll.speed) * (1 - Math.exp(-dt / ROLL.build));
    } else roll.speed *= Math.exp(-ROLL.coast * dt);
    const speed = roll.speed * modifier * speedScale;
    const r = RULES.radius;
    if (blocked(p.x + Math.cos(roll.heading) * speed * dt, p.y, r)) {
      roll.heading = Math.PI - roll.heading;
      roll.speed *= ROLL.wallLoss;
    }
    if (blocked(p.x, p.y + Math.sin(roll.heading) * speed * dt, r)) {
      roll.heading = -roll.heading;
      roll.speed *= ROLL.wallLoss;
    }
    const v = roll.speed * modifier * speedScale;
    p.vx = Math.cos(roll.heading) * v;
    p.vy = Math.sin(roll.heading) * v;
    move(p, p.vx * dt, p.vy * dt);
    return;
  }
  if (time < p.dashUntil) {
    p.vx = p.dashX * warp;
    p.vy = p.dashY * warp;
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
  // Leashed: it can't go past the leash's length from where it was pinned.
  if (leash && leashFrom) {
    const len = leash.amount ?? 100,
      d = Math.hypot(p.x - leash.tx!, p.y - leash.ty!);
    if (d > len) {
      const x = leash.tx! + ((p.x - leash.tx!) * len) / d,
        y = leash.ty! + ((p.y - leash.ty!) * len) / d;
      if (blocked(x, y)) {
        p.x = leashFrom.x;
        p.y = leashFrom.y;
      } else {
        p.x = x;
        p.y = y;
      }
      p.vx = p.vy = 0;
    }
  }
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
  | "tickInterval"
  | "bonusVsStatus"
  | "drain";
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
  seconds: 12,
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
  rite("voltkit", "minor", "static-glide", "Long Glide", "Static Glide lasts 2s instead of 1.4s.", { set: { duration: 2, statusDuration: 2 } }),
  rite("voltkit", "minor", "spark-dart", "Hot Darts", "Spark Dart deals 7 damage instead of 6.", { set: { damage: 7 } }),
  rite("voltkit", "major", "static-glide", "Tailwind", "Static Glide cooldown 12s → 8s.", { set: { cooldown: 8 } }),
  rite("voltkit", "major", "ball-lightning", "Thunderhead", "Ball Lightning becomes three orbs of 14 damage with smaller blasts.", { set: { kind: "barrage", count: 3, damage: 14, explosion: 70 } }),
  rite("cindrake", "minor", "crest-flare", "Long Breath", "Crest Flare lasts 1.6s instead of 1.2s.", { set: { duration: 1.6 } }),
  rite("cindrake", "minor", "magma-bomb", "Wide Bomb", "Magma Bomb's blast is 30% wider.", { mul: { explosion: 1.3 } }),
  rite("cindrake", "minor", "heat-cracks", "Deep Cracks", "Heat Cracks lasts 3.5s instead of 2.5s.", { set: { duration: 3.5 } }),
  rite("cindrake", "minor", "cinder-snap", "Searing Snap", "Cinder Snap deals 18 damage instead of 15.", { set: { damage: 18 } }),
  rite("cindrake", "major", "sunfire-pillar", "Solar Pillar", "Sunfire Pillar erupts instantly and is 25% wider.", { set: { cast: 0 }, mul: { radius: 1.25 } }),
  rite("cindrake", "major", "heat-cracks", "Burning Cracks", "Heat Cracks sets enemies on fire.", { set: { status: "burn", statusDuration: 1.5 } }),
  rite("tidefin", "minor", "gill-siphon", "Deep Siphon", "Gill Siphon lasts 3s instead of 2.1s.", { set: { duration: 3 } }),
  rite("tidefin", "minor", "eddy", "Wide Eddy", "Eddy is 20% wider.", { mul: { radius: 1.2 } }),
  rite("tidefin", "minor", "tide-double", "Slipstream", "Tide Double's speed burst lasts 3s instead of 2s.", { set: { statusDuration: 3 } }),
  rite("tidefin", "minor", "tide-needle", "Long Needle", "Tide Needle flies 25% further.", { mul: { range: 1.25 } }),
  rite("tidefin", "major", "eddy", "Maelstrom", "Eddy deals 6 per tick instead of 4 and lasts 4.5s.", { set: { damage: 6, duration: 4.5 } }),
  rite("tidefin", "major", "gill-siphon", "Thirsty Gills", "Gill Siphon drinks back all the damage it deals instead of half.", { set: { drain: 1 } }),
  rite("auralynx", "minor", "prism-shot", "Swift Prism", "Prism Shot flies 35% faster.", { mul: { speed: 1.35 } }),
  rite("auralynx", "minor", "shatter-paw", "Long Paw", "Shatter Paw reaches 20% further.", { mul: { range: 1.2 } }),
  rite("auralynx", "minor", "facet-guard", "Steady Guard", "Facet Guard lasts 2.2s instead of 1.6s.", { set: { duration: 2.2 } }),
  rite("auralynx", "minor", "prism-jab", "Hard Jab", "Prism Jab deals 15 damage instead of 13.", { set: { damage: 15 } }),
  rite("auralynx", "major", "prism-shot", "Prism Burst", "Prism Shot explodes on impact, hitting everyone nearby.", { set: { explosion: 90 } }),
  rite("auralynx", "major", "crystal-cage", "Long Cage", "Crystal Cage stands for 4.5s instead of 3s.", { set: { duration: 4.5 } }),
  rite("lumoth", "minor", "wing-dust", "Dust Storm", "Wing Dust throws 7 motes of 7 damage instead of 5 of 8.", { set: { count: 7, damage: 7 } }),
  rite("lumoth", "minor", "eyespot-flash", "Wide Wings", "Eyespot Flash reaches 20% further.", { mul: { radius: 1.2 } }),
  rite("lumoth", "minor", "kindle", "Long Kindle", "Kindle lasts 6.5s instead of 5s.", { set: { duration: 6.5 } }),
  rite("lumoth", "minor", "glint", "Bright Glint", "Glint deals 7 damage instead of 6.", { set: { damage: 7 } }),
  rite("lumoth", "major", "radiant-flare", "Quick Flare", "Radiant Flare charges in 0.2s instead of 0.45s.", { set: { cast: 0.2 } }),
  rite("lumoth", "major", "eyespot-flash", "Dazzle", "Eyespot Flash stuns for 1.2s instead of 0.8s.", { set: { statusDuration: 1.2 } }),
  rite("mystowl", "minor", "third-eye-ray", "Far Sight", "Third-Eye Ray reaches 20% further.", { mul: { range: 1.2 } }),
  rite("mystowl", "minor", "booming-hoot", "Loud Hoot", "Booming Hoot is 20% wider.", { mul: { radius: 1.2 } }),
  rite("mystowl", "minor", "wing-cloak", "Long Cloak", "Wing Cloak lasts 4s instead of 3s.", { set: { duration: 4 } }),
  rite("mystowl", "minor", "mind-dart", "Heavy Dart", "Mind Dart deals 10 damage instead of 8.", { set: { damage: 10 } }),
  rite("mystowl", "major", "third-eye-ray", "Mind Lock", "Third-Eye Ray stuns for 0.5s instead of slowing.", { set: { status: "stun", statusDuration: 0.5 } }),
  rite("mystowl", "major", "silent-swoop", "Wide Swoop", "Silent Swoop is 35% wider.", { mul: { radius: 1.35 } }),
  rite("terradon", "minor", "shell-bash", "Long Bash", "Shell Bash reaches 20% further.", { mul: { range: 1.2 } }),
  rite("terradon", "minor", "shell-up", "Thick Moss", "Shell Up regrows 35 HP instead of 25.", { set: { heal: 7 } }),
  rite("terradon", "minor", "mud-mire", "Deep Mud", "Mud Mire is 20% wider.", { mul: { radius: 1.2 } }),
  rite("terradon", "minor", "boulder-swipe", "Heavy Swipe", "Boulder Swipe deals 18 damage instead of 15.", { set: { damage: 18 } }),
  rite("terradon", "major", "tremor", "Quick Quake", "Tremor charges in 0.25s instead of 0.5s.", { set: { cast: 0.25 } }),
  rite("terradon", "major", "mud-mire", "Sinking Mud", "Mud Mire also deals 4 damage per tick.", { set: { damage: 4 } }),
  rite("duskveil", "minor", "shade-crawl", "Deep Crawl", "Shade Crawl deals 24 damage instead of 20.", { set: { damage: 24 } }),
  rite("duskveil", "minor", "ghostfire", "Five Flames", "Ghostfire throws 5 flames instead of 3.", { set: { count: 5 } }),
  rite("duskveil", "minor", "haunted-lantern", "Long Watch", "Haunted Lantern lasts 5.5s instead of 4s.", { set: { duration: 5.5 } }),
  rite("duskveil", "minor", "lantern-wisp", "Bright Wisp", "Lantern Wisp deals 11 damage instead of 9.", { set: { damage: 11 } }),
  rite("duskveil", "major", "haunted-lantern", "Bright Lantern", "Haunted Lantern shoots twice as often.", { mul: { tickInterval: 0.5 } }),
  rite("duskveil", "major", "void-orb", "Burning Void", "Void Orb's blast is 30% wider and burns.", { mul: { explosion: 1.3 }, set: { status: "burn", statusDuration: 2 } }),
  rite("coilemur", "minor", "magnet-lash", "Long Lash", "Magnet Lash reaches 20% further.", { mul: { range: 1.2 } }),
  rite("coilemur", "minor", "static-clamp", "Tight Clamp", "Static Clamp deals 26 damage instead of 22.", { set: { damage: 26 } }),
  rite("coilemur", "minor", "spark-tether", "Long Tether", "Spark Tether lasts 4s instead of 3s.", { set: { duration: 4 } }),
  rite("coilemur", "minor", "coil-swipe", "Hot Coil", "Coil Swipe deals 14 damage instead of 12.", { set: { damage: 14 } }),
  rite("coilemur", "major", "magnet-lash", "Quick Lash", "Magnet Lash cooldown 12s → 9s.", { set: { cooldown: 9 } }),
  rite("coilemur", "major", "electromagnet", "Superconductor", "Electromagnet is 25% wider and pulls harder.", { mul: { radius: 1.25, knockback: 1.4 } }),
  rite("pyranda", "minor", "chestnut-mortar", "Big Chestnut", "Chestnut Mortar's blast is 25% wider.", { mul: { radius: 1.25 } }),
  rite("pyranda", "minor", "hot-coals", "Slow Burn", "Hot Coals last 5.5s instead of 4s.", { set: { duration: 5.5 } }),
  rite("pyranda", "minor", "ember-curtain", "Long Curtain", "Ember Curtain stands for 4.5s instead of 3s.", { set: { duration: 4.5 } }),
  rite("pyranda", "minor", "ember-lob", "Hot Lob", "Ember Lob deals 12 damage instead of 10.", { set: { damage: 12 } }),
  rite("pyranda", "major", "chestnut-mortar", "Rapid Fire", "Chestnut Mortar cooldown 8s → 5.5s.", { set: { cooldown: 5.5 } }),
  rite("pyranda", "major", "chestnut-storm", "Harvest Storm", "Chestnut Storm is 30% wider.", { mul: { radius: 1.3 } }),
  rite("glacelle", "minor", "hailstone", "Big Hail", "Hailstone deals 22 damage instead of 18.", { set: { damage: 22 } }),
  rite("glacelle", "minor", "frost-bloom", "Wide Bloom", "Frost Bloom is 20% wider.", { mul: { radius: 1.2 } }),
  rite("glacelle", "minor", "frost-breath", "Long Breath", "Frost Breath lasts 1.4s instead of 1s.", { set: { duration: 1.4 } }),
  rite("glacelle", "minor", "rime-shard", "Sharp Rime", "Rime Shard deals 9 damage instead of 8.", { set: { damage: 9 } }),
  rite("glacelle", "major", "hailstone", "Flash Freeze", "Hailstone freezes for 0.5s instead of slowing.", { set: { status: "freeze", statusDuration: 0.5 } }),
  rite("glacelle", "major", "whiteout", "Permafrost", "Whiteout lasts 3.6s and is 15% wider.", { set: { duration: 3.6 }, mul: { radius: 1.15 } }),
  rite("halcyra", "minor", "pinning-quill", "Heavy Quill", "Pinning Quill pins for 2.2s instead of 1.4s.", { set: { statusDuration: 2.2 } }),
  rite("halcyra", "minor", "focus-shot", "Steady Aim", "Focus Shot charges in 0.25s instead of 0.4s.", { set: { cast: 0.25 } }),
  rite("halcyra", "minor", "halcyon-rewind", "Quick Rewind", "Halcyon Rewind cooldown 17s → 12s.", { set: { cooldown: 12 } }),
  rite("halcyra", "minor", "aura-quill", "Keen Quill", "Aura Quill deals 9 damage instead of 8.", { set: { damage: 9 } }),
  rite("halcyra", "major", "focus-shot", "Rapid Focus", "Focus Shot cooldown 12s → 8s.", { set: { cooldown: 8 } }),
  rite("halcyra", "major", "skyline-lance", "Stunning Lance", "Skyline Lance also stuns for 0.6s.", { set: { status: "stun", statusDuration: 0.6 } }),
  rite("sunbara", "minor", "warm-spring", "Deep Spring", "Warm Spring is 25% wider.", { mul: { radius: 1.25 } }),
  rite("sunbara", "minor", "yuzu-toss", "Big Yuzu", "Yuzu Toss's burst is 30% wider.", { mul: { explosion: 1.3 } }),
  rite("sunbara", "minor", "daybreak", "Wide Dawn", "Daybreak is 20% wider.", { mul: { radius: 1.2 } }),
  rite("sunbara", "minor", "sunseed", "Bright Seed", "Sunseed deals 8 damage instead of 7.", { set: { damage: 8 } }),
  rite("sunbara", "major", "warm-spring", "Hot Spring", "Warm Spring heals allies 6 per tick instead of 4.", { set: { heal: 6 } }),
  rite("sunbara", "major", "sanctuary", "Long Summer", "Sanctuary lasts 5.5s instead of 4s.", { set: { duration: 5.5 } }),
  rite("astrabun", "minor", "moon-hop", "Far Hop", "Moon Hop reaches 380 px instead of 300.", { set: { range: 380 } }),
  rite("astrabun", "minor", "mochi-pound", "Sticky Mochi", "Mochi Pound stuns for 0.7s instead of 0.45s.", { set: { statusDuration: 0.7 } }),
  rite("astrabun", "minor", "moon-gravity", "Heavy Moon", "Moon Gravity is 20% wider.", { mul: { radius: 1.2 } }),
  rite("astrabun", "minor", "mallet-bop", "Big Bop", "Mallet Bop deals 16 damage instead of 14.", { set: { damage: 16 } }),
  rite("astrabun", "major", "moon-hop", "Double Hop", "Moon Hop cooldown 8s → 5s.", { set: { cooldown: 5 } }),
  rite("astrabun", "major", "full-moon", "Harvest Moon", "Full Moon lands instantly and is 20% wider.", { set: { cast: 0 }, mul: { radius: 1.2 } }),
  rite("wombolder", "minor", "burrow-rush", "Long Burrow", "Burrow Rush travels 20% further.", { mul: { range: 1.2 } }),
  rite("wombolder", "minor", "bush-boomerang", "Heavy Boomerang", "Bush Boomerang deals 14 damage a pass instead of 11.", { set: { damage: 14 } }),
  rite("wombolder", "minor", "grudge-thump", "Long Grudge", "Grudge Thump taunts for 1.6s instead of 1.1s.", { set: { statusDuration: 1.6 } }),
  rite("wombolder", "minor", "rump-bump", "Big Bump", "Rump Bump deals 18 damage instead of 16.", { set: { damage: 18 } }),
  rite("wombolder", "major", "burrow-rush", "Quick Burrow", "Burrow Rush cooldown 9s → 6.5s.", { set: { cooldown: 6.5 } }),
  rite("wombolder", "major", "landslide", "Avalanche", "Landslide's eruption is 35% wider.", { mul: { explosion: 1.35 } }),
  rite("shadopus", "minor", "ink-jet", "Thick Ink", "Ink Jet blinds for 1.1s instead of 0.7s.", { set: { statusDuration: 1.1 } }),
  rite("shadopus", "minor", "ink-strike", "Sharp Ink", "Ink Strike deals 28 damage instead of 24.", { set: { damage: 28 } }),
  rite("shadopus", "minor", "ink-cloud", "Deep Ink", "Ink Cloud's stealth lasts 3.5s instead of 2.5s.", { set: { duration: 3.5 } }),
  rite("shadopus", "minor", "tentacle-lash", "Long Arms", "Tentacle Lash reaches 20% further.", { mul: { range: 1.2 } }),
  rite("shadopus", "major", "ink-cloud", "Vanishing Act", "Ink Cloud cooldown 15s → 10s.", { set: { cooldown: 10 } }),
  rite("shadopus", "major", "kraken-grasp", "Leviathan", "Kraken Grasp reaches 25% further.", { mul: { range: 1.25 } }),
  rite("pangrove", "minor", "tongue-grapple", "Long Tongue", "Tongue Grapple reaches 25% further.", { mul: { range: 1.25 } }),
  rite("pangrove", "minor", "scale-shrapnel", "Sharp Plates", "Scale Shrapnel blades deal 7 damage instead of 6.", { set: { damage: 7 } }),
  rite("pangrove", "minor", "curl-roll", "Long Roll", "Curl & Roll lasts up to 5s instead of 3.5s.", { set: { duration: 5 } }),
  rite("pangrove", "minor", "scale-swipe", "Sharp Scales", "Scale Swipe deals 17 damage instead of 15.", { set: { damage: 17 } }),
  rite("pangrove", "major", "curl-roll", "Spiked Ball", "Curl & Roll rams Root the enemy for 0.8s.", { set: { status: "root", statusDuration: 0.8 } }),
  rite("pangrove", "major", "pinball", "Bank Shot", "Pinball ricochets off up to 6 walls instead of 4.", { set: { count: 6 } }),
  rite("mossloth", "minor", "seedling", "Thicket", "Up to 4 seedlings at once instead of 3.", { set: { count: 4 } }),
  rite("mossloth", "minor", "sloth-time", "Wide Bubble", "Sloth Time's bubble is 20% wider.", { mul: { radius: 1.2 } }),
  rite("mossloth", "minor", "lazy-swap", "Lazier", "Lazy Swap cooldown 12s → 9s.", { set: { cooldown: 9 } }),
  rite("mossloth", "minor", "seed-spit", "Hard Seed", "Seed Spit deals 10 damage instead of 9.", { set: { damage: 10 } }),
  rite("mossloth", "major", "seedling", "Deep Roots", "Seedlings root 50% longer.", { mul: { statusDuration: 1.5 } }),
  rite("mossloth", "major", "sloth-time", "Long Nap", "Sloth Time lasts 4.5s instead of 3s.", { set: { duration: 4.5 } }),
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
export type ArenaId =
  | "classic"
  | "tide-pools"
  | "ember-forge"
  | "shifting-ruins"
  /** Tidewyrm's raid arena (not in the PvP rotation). */
  | "lagoon"
  /** Gloomshade's raid arena (not in the PvP rotation). */
  | "lantern-yard"
  | "cloud-deck"
  | "sun-atrium"
  | "sky-terrace"
  | "conductor-ring";
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
    name: "Coliseum Sands",
    tip: "The coliseum floor: four stone blocks and a centre block for cover.",
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
  lagoon: {
    id: "lagoon",
    name: "Lagoon Court",
    tip: "A shallow lagoon with four raised islands to stand on.",
    obstacles: [],
    hazards: [],
  },  "lantern-yard": {
    id: "lantern-yard",
    name: "Lantern Yard",
    tip: "A moonlit courtyard lit by four lanterns.",
    obstacles: [],
    hazards: [],
  },
  "conductor-ring": { id: "conductor-ring", name: "Conductor Ring", tip: "Balance both twins’ health, pair opposite signs, then finish them together.", obstacles: [], hazards: [] },
  "sky-terrace": { id: "sky-terrace", name: "Sky Terrace", tip: "Light three braziers together to ground Emberwing.", obstacles: [], hazards: [] },
  "sun-atrium": { id: "sun-atrium", name: "Sun Atrium", tip: "Relay skylight through the mirror posts into the heart.", obstacles: [], hazards: [] },
  "cloud-deck": { id: "cloud-deck", name: "Cloud Deck", tip: "Follow the Dreamer and step the four rune pads in order.", obstacles: [], hazards: [] },
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
