import {
  CHARACTERS,
  maxHealth,
  OBSTACLES,
  RULES,
  blankInput,
  blocked,
  currentObstacles,
  skillReady,
  ARENAS,
  COMBOS,
  hazardIn,
  RING,
  ringRadius,
  hasMark,
  kitAbility,
  kitOf,
  RITE_BY_ID,
  DEBUFFS,
  farMultiplier,
  platesOf,
  type Ability,
  type AbilityKind,
  type CharacterId,
  type StatusKind,
  type Fighter,
  type Input,
  type Zone,
  type Rect,
  RING_KINDS,
} from "../../../packages/shared/src/index.js";
import type { Arena } from "./simulation.js";
import { LOOK_EVERY, lookAhead } from "./bot-lookahead.js";
import { EXPERT_STYLE } from "./expert-style.js";
/**
 * Server-side AI opponent. Each tick it reads the arena the way a player
 * would (with a reaction delay and imperfect aim) and returns the same Input
 * a human client sends, so every cooldown and rule still applies to it.
 */
export const BOT_DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type BotDifficulty = (typeof BOT_DIFFICULTIES)[number];
/**
 * The levels a BotBrain can play at: the player-facing difficulties plus
 * "expert", which only the balance scripts use (scripts/balance). Players
 * can never pick it: rooms take a BotDifficulty (BOT_DIFFICULTIES, checked
 * by the server's schema), and an expert brain reports itself as Hard.
 */
export type BotLevel = BotDifficulty | "expert";
/**
 * Counterplay a decent player knows, each switchable for measuring what it
 * changes (docs/balance-overhaul.md, "An expert bot for measuring").
 */
export interface ExpertFlags {
  /** Looks away from a ready Eyespot Flash (gaze) in reach between attacks. */
  lookAway: boolean;
  /** Jumps over enemy seedlings (or steps round them) instead of walking on. */
  jumpSeeds: boolean;
  /** Plans a way out of marked blasts (mortars, creeping marks, bolts, flares). */
  dodgeMarks: boolean;
  /**
   * At key moments, plays a few candidate actions about a second ahead on a
   * copy of the match and takes the best (bot-lookahead.ts). Expert only.
   */
  lookAhead?: boolean;
}
export const EXPERT_FLAGS: (keyof ExpertFlags)[] = [
  "lookAway",
  "jumpSeeds",
  "dodgeMarks",
  "lookAhead",
];
/**
 * How the expert plays one champion: the hand-set numbers of its rules,
 * learned per champion by scripts/balance/train-expert.ts (expert-style.ts).
 * Anything left out plays as the rules always did.
 */
export interface Style {
  /** A shooter's preferred distance × this. */
  range?: number;
  /** A brawler's preferred distance, px (70). */
  reach?: number;
  /** How much a brawler cares about getting to that distance (2.6). */
  closeIn?: number;
  /** How much it cares about keeping the opponent in sight (× 1). */
  sight?: number;
  /** How much it circles the opponent (× 1). */
  circle?: number;
  /** Chance per tick to dash in when the gap is closable (Profile.engage). */
  engage?: number;
  /** Health share below which it plays safe (Profile.retreat). */
  retreat?: number;
  /** How carefully a shooter keeps out of corners (Profile.kite). */
  kite?: number;
  /** Each skill slot's score × this (the ultimate last). */
  slots?: number[];
  /** A skill scoring below this waits for a better moment (0). */
  floor?: number;
}
export const STYLE_KEYS = [
  "range",
  "reach",
  "closeIn",
  "sight",
  "circle",
  "engage",
  "retreat",
  "kite",
  "floor",
] as const;
interface Profile {
  /** Seconds between seeing the opponent move and reacting to it. */
  reaction: number;
  /** Random aim spread in radians. */
  aimError: number;
  /** 0..1 how much it leads a moving target with projectiles. */
  lead: number;
  /** Chance to react to a shot that would hit it. */
  dodge: number;
  /** Seconds between tactical decisions (movement plan, skill choice). */
  think: number;
  /** Chance to use a good skill opportunity when it sees one. */
  skillUse: number;
  /** Chance per decision to hesitate and stand still. */
  hesitate: number;
  /** Saves its ultimate for a finishing blow or a stunned target. */
  smartUltimate: boolean;
  /** Chance to be fooled by a decoy clone. */
  fooledByClone: number;
  /** Brawlers: chance per tick to dash in when the gap is closable. */
  engage: number;
  /** Chance each second to hold fire for that second, like a person catching their breath. */
  rest: number;
  /**
   * Counts any shot about to hit as a threat for defensive skills (barriers,
   * counters, clones), not only the ones it decided to dodge. Without it a
   * bot that rarely dodges also rarely shields, which made champions with a
   * barrier far weaker at Normal than at Hard.
   */
  seeShots?: boolean;
  /**
   * Chance each second to lose focus for that second. In PvP it is a lapse:
   * it keeps walking (and out of hazards) but attacks, casts and dodges
   * nothing. In raids it stands still as well, as the raids were tuned
   * with. Unlike `rest`, which only holds the basic attack, this slows every
   * kind of champion down alike.
   */
  daze?: number;
  /** Per-champion daze (overrides `daze` for that champion). */
  dazeBy?: Partial<Record<CharacterId, number>>;
  /**
   * In raids and the Spire (raider stand-ins and Spire Echoes), these
   * champions keep the daze the raids were tuned with (see RAID_DAZE_BY).
   */
  raidDazeBy?: Partial<Record<CharacterId, number>>;
  /**
   * Out of raids, its ultimate waits for an opening (see `smartUltimate`,
   * which raids keep using). Defaults to `smartUltimate`.
   */
  pvpSmartUltimate?: boolean;
  /**
   * PvP only, 0..1: how carefully a shooter facing a brawler keeps out of
   * the corners, where a brawler pins it. (Wider spacing and dashing out
   * were tried too: they made shooters far too strong against brawlers for
   * the champions' balance, which assumes the old footwork.)
   */
  kite?: number;
  /**
   * PvP only: below this share of its health, and behind on health, it
   * plays safe: a shooter keeps more distance, and it goes further for a
   * healing orb and leaves energy orbs alone.
   */
  retreat?: number;
  /**
   * PvP with several opponents: it joins its teammate's target, finishes a
   * fighter that is nearly out, and picks on fighters already busy brawling.
   */
  focus?: boolean;
  /**
   * The expert's counterplay (ExpertFlags). The expert bot has all of it;
   * the player levels have some, in PvP only.
   */
  expert?: ExpertFlags;
  /**
   * Seconds a player level takes to take in a new mark on the ground
   * (defaults to `reaction`; the expert's is MARK_REACTION).
   */
  markReaction?: number;
  /**
   * Measurement only: skill kinds its rules act as if they had never seen
   * (no score, never chosen), to check that the expert's look-ahead uses a
   * new mechanic the rules don't know yet (scripts/balance/new-mechanic.ts).
   */
  unknownKinds?: readonly string[];
  /** The expert's learned way of playing each champion (expert-style.ts). */
  style?: Partial<Record<CharacterId, Style>>;
}
/**
 * The skill revolution (docs/skill-revolution.md) recalibrated the duel daze
 * of Voltkit, Tidefin and Lumoth (wave A), Cindrake and Astrabun (wave B) and
 * Glacelle, Halcyra and Sunbara (wave C) and Pyranda (wave D). Raids and every Spire floor were
 * tuned by simulation with the daze they had before (the Spire's play-tests
 * use a Normal Voltkit raider; its Echoes are Normal bots too), so in raid
 * mode they keep it: their duel numbers can move without moving the Spire.
 */
export const RAID_DAZE_BY: Partial<Record<CharacterId, number>> = {
  voltkit: 0.18,
  tidefin: 0.155,
  lumoth: 0.17,
  // Wave B.
  cindrake: 0.41,
  astrabun: 0.33,
  // Wave C.
  glacelle: 0.26,
  halcyra: 0.175,
  sunbara: 0.225,
  // Wave D.
  pyranda: 0.36,
  // The 2026-11-18 rebalance after the skill revolution.
  mystowl: 0.155,
  wombolder: 0.355,
  shadopus: 0.28,
  // 0.405 before the Pangrove rework (Tunnel, Leaf Storm): 0.38 keeps
  // zone 1's floor 9 as hard as it was (11 clears in 48 against 12).
  pangrove: 0.38,
  terradon: 0.31,
  auralynx: 0.33,
  coilemur: 0.34,
};
/**
 * Normal's per-champion daze before the smarter PvP bots (2026-11-19). Raid
 * mode (raider stand-ins, Spire Echoes) still plays the old way, with this
 * daze for any champion RAID_DAZE_BY does not name, so raid and Spire
 * difficulty stays where simulation tuned it.
 */
const NORMAL_DAZE_BEFORE_SMART_BOTS: Partial<Record<CharacterId, number>> = {
  voltkit: 0.228,
  cindrake: 0.44,
  tidefin: 0.19,
  auralynx: 0.33,
  lumoth: 0.185,
  mystowl: 0.162,
  terradon: 0.318,
  duskveil: 0.27,
  coilemur: 0.335,
  pyranda: 0.37,
  glacelle: 0.25,
  halcyra: 0.168,
  sunbara: 0.21,
  astrabun: 0.29,
  wombolder: 0.37,
  shadopus: 0.292,
  pangrove: 0.393,
  mossloth: 0.475,
};
/**
 * Normal's per-champion lapse share in PvP (see `daze`), calibrated in bot
 * round robins so each champion does about as well against Normal bots as
 * against Hard ones (scripts/balance/round-robin.ts).
 */
const NORMAL_DAZE_BY: Partial<Record<CharacterId, number>> = {
  voltkit: 0.285,
  cindrake: 0.49,
  tidefin: 0.29,
  auralynx: 0.203,
  lumoth: 0.242,
  mystowl: 0.224,
  terradon: 0.265,
  duskveil: 0.361,
  coilemur: 0.31,
  pyranda: 0.281,
  glacelle: 0.232,
  halcyra: 0.268,
  sunbara: 0.255,
  astrabun: 0.242,
  wombolder: 0.335,
  shadopus: 0.33,
  pangrove: 0.355,
  mossloth: 0.29,
};
/**
 * Easy lapses 0.25 less of its seconds than Normal does on the same
 * champion, so only where Normal's share is high (brawlers such as
 * Cindrake and Pangrove, whose Easy bots otherwise beat their Normal ones:
 * Easy's slow reactions and loose aim cost a brawler little).
 */
export const EASY_DAZE_GAP = 0.25;
export const BOT_PROFILES: Record<BotDifficulty, Profile> = {
  // Easy plays like a beginner: it sees and decides late, aims loosely,
  // rarely dodges, uses few skills and saves nothing. It is weaker than
  // Normal mostly by being slower; it lapses only with the brawlers (see
  // EASY_DAZE_GAP), and like Normal it keeps moving when it does.
  easy: {
    reaction: 0.5,
    aimError: 0.27,
    lead: 0,
    dodge: 0.1,
    think: 0.45,
    skillUse: 0.35,
    hesitate: 0.25,
    smartUltimate: false,
    fooledByClone: 0.85,
    engage: 0.01,
    rest: 0.42,
    kite: 0.25,
    retreat: 0.2,
    // Of the expert's counterplay, a beginner only steps out of marked
    // blasts, and it notices them late (its reaction time).
    expert: { lookAway: false, jumpSeeds: false, dodgeMarks: true },
    markReaction: 0.9,
    dazeBy: Object.fromEntries(
      Object.entries(NORMAL_DAZE_BY)
        .map(([id, d]) => [id, +Math.max(0, d - EASY_DAZE_GAP).toFixed(3)])
        .filter(([, d]) => (d as number) > 0),
    ),
  },
  // Normal is Hard with slower reactions, more pauses and looser aim, and a
  // per-champion share of lapsed seconds (dazeBy). Every weakness a bot can
  // have helps melee champions more than ranged ones (a weak opponent kites
  // badly), so with one setting for everyone a champion's win rate flipped
  // between Hard and Normal (Cindrake 30% / 73%, Mystowl 69% / 31%). dazeBy
  // is calibrated in bot duels so each champion does about as well against
  // Normal bots as against Hard ones; see docs/new-champions/README.md.
  normal: {
    reaction: 0.36,
    aimError: 0.215,
    lead: 0.2,
    dodge: 0.43,
    think: 0.19,
    skillUse: 0.42,
    hesitate: 0.18,
    smartUltimate: false,
    pvpSmartUltimate: true,
    fooledByClone: 0.5,
    engage: 0.02,
    rest: 0.12,
    seeShots: true,
    kite: 0.6,
    retreat: 0.3,
    focus: true,
    expert: { lookAway: false, jumpSeeds: true, dodgeMarks: true },
    markReaction: 0.75,
    dazeBy: NORMAL_DAZE_BY,
    raidDazeBy: { ...NORMAL_DAZE_BEFORE_SMART_BOTS, ...RAID_DAZE_BY },
  },
  hard: {
    reaction: 0.25,
    aimError: 0.14,
    lead: 0.85,
    dodge: 0.55,
    think: 0.12,
    skillUse: 0.9,
    hesitate: 0,
    smartUltimate: true,
    fooledByClone: 0.2,
    engage: 0.2,
    rest: 0.05,
    seeShots: true,
    kite: 1,
    retreat: 0.35,
    focus: true,
    expert: { lookAway: true, jumpSeeds: true, dodgeMarks: true },
    // Marks on the ground take longer to read than a shot coming in (and
    // Pyranda's kit, all marks, fell to 41% against an instant read, 44% at 0.5 s).
    markReaction: 0.6,
  },
};
/**
 * The expert bot, for balance measurement only (never offered to players):
 * Hard made sharper where it pays (measured with difficulty-gap.ts, each
 * setting alone against Hard: reaction +18 points, dodge +9, no rests +7,
 * aim +4, quicker decisions +2; leading shots fully and engaging more made
 * it weaker), plus the counterplay in ExpertFlags. Its reaction and aim
 * are a good player's, not a machine's: at 0.1 s and 0.08 rad it landed so
 * many quick shots that kiters ruled the table (Mossloth 67%, Mystowl 63%)
 * and brawlers sank (Cindrake 31%); at 0.2 s and 0.12 those are 59%, 50%
 * and 60%, and it still beats Hard in 89% of duels (docs/balance-overhaul.md,
 * "A good player's hands").
 */
export const EXPERT_PROFILE: Profile = {
  ...BOT_PROFILES.hard,
  // It reads marks in MARK_REACTION, not in Hard's markReaction.
  markReaction: undefined,
  reaction: 0.2,
  aimError: 0.12,
  dodge: 0.9,
  think: 0.08,
  rest: 0,
  expert: {
    lookAway: true,
    jumpSeeds: true,
    dodgeMarks: true,
    lookAhead: true,
  },
  style: EXPERT_STYLE,
};
/** Every profile a BotBrain can use, the expert's included (balance scripts). */
export const BALANCE_PROFILES: Record<BotLevel, Profile> = {
  ...BOT_PROFILES,
  expert: EXPERT_PROFILE,
};
export const BOT_LABELS: Record<BotDifficulty, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
};
/** Small deterministic RNG so bot matches replay exactly in tests. */
function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DISABLES = [
  "stun",
  "freeze",
  "sleep",
  "shell",
  "paralysis",
  "root",
] as const;
const OFFENSIVE = new Set([
  "projectile",
  "charged",
  "barrage",
  "beam",
  "melee",
  "cone",
  "zone",
  "nova",
  "rush",
  "blink",
]);
/**
 * Every skill kind `chooseSkill` has a `case` for. A kind missing here (and
 * there) scores 0, so bots would never cast it: tests/unit/bot-skill-kinds
 * checks every champion's kit, with and without rites, against this list.
 * The `default` of that switch fails the typecheck if a kind listed here has
 * no `case`, so add both together.
 */
const BOT_SKILL_KIND_LIST = [
  "projectile",
  "charged",
  "barrage",
  "beam",
  "rush",
  "blink",
  "veil",
  "screen",
  "taunt",
  "rewind",
  "tether",
  "gaze",
  "clamp",
  "throw",
  "pound",
  "cage",
  "surf",
  "wave",
  "storm",
  "hunt",
  "leap",
  "creep",
  "garden",
  "lure",
  "trail",
  "steer",
  "grapple",
  "shrapnel",
  "tunnel",
  "cyclone",
  "seedling",
  "timewarp",
  "swap",
  "melee",
  "cone",
  "nova",
  "zone",
  "counter",
  "barrier",
  "clone",
  "buff",
  "rest",
] as const satisfies readonly AbilityKind[];
type BotSkillKind = (typeof BOT_SKILL_KIND_LIST)[number];
export const BOT_SKILL_KINDS: ReadonlySet<AbilityKind> = new Set(
  BOT_SKILL_KIND_LIST,
);
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
type Point = { x: number; y: number };
const NO_STYLE: Style = {};
/** Seconds before its next attack that the expert turns back to face a gazer. */
const LOOK_BACK = 0.15;
/** Seconds the expert takes to see a new mark on the ground (it isn't instant). */
const MARK_REACTION = 0.15;
/**
 * Zones worth keeping out of: an opponent's, unless it only heals its own
 * side. A teammate's zone (2v2) never hurts, and a healing spring helps.
 */
export function hostileZone(arena: Arena, me: Fighter, z: Zone) {
  if (z.owner === me.id) return false;
  const owner = arena.players.find((p) => p.id === z.owner);
  if (owner && arena.teamOf(owner) === arena.teamOf(me)) return false;
  const a = z.ability;
  // A Crystal Cage is a wall, not a hazard: fight on inside it. A rolling
  // wave is jumped (see think), not walked away from; a storm's bolts are
  // zones of their own.
  if (a.kind === "cage" || a.kind === "wave" || a.kind === "storm")
    return false;
  return !a.heal || a.damage > 0 || !!a.status || !!a.knockback || !!a.turret;
}
/**
 * A blast marked on the ground before it lands once (Chestnut Mortar,
 * Chestnut Storm's creeping marks, Thunderstorm's bolts, Radiant Flare's
 * burst): where, how wide and when. Lingering zones are not marks.
 */
export function markOf(z: Zone) {
  const a = z.ability;
  if (a.kind === "lure")
    return Number.isFinite(z.nextTick)
      ? { r: a.explosion ?? 140, at: z.nextTick, pull: a.lure?.speed ?? 150 }
      : undefined;
  if (a.kind !== "zone" || a.heal) return;
  return z.until - z.nextTick <= 0.15 &&
    z.nextTick - (z.born ?? z.nextTick) >= 0.3
    ? { r: z.radius, at: z.nextTick, pull: 0 }
    : undefined;
}
/** Does a way of `len` px cross an enemy seedling's trigger? */
function seedOnWay(
  arena: Arena,
  me: Fighter,
  ux: number,
  uy: number,
  len: number,
) {
  return arena.zones.some((z) => {
    if (
      z.ability.kind !== "seedling" ||
      z.until <= arena.time ||
      !arena.rivals(z.owner, me.id)
    )
      return false;
    const r = (z.ability.seed?.trigger ?? 30) + RULES.radius + 8,
      rx = z.x - me.x,
      ry = z.y - me.y,
      along = rx * ux + ry * uy;
    return Math.abs(rx * uy - ry * ux) < r && along > -r && along < len + r;
  });
}
/** The circle a bot keeps out of. */
function zoneArea(z: Zone) {
  return { x: z.x, y: z.y, radius: z.radius };
}
/**
 * Riptide Wave about to reach this fighter: how soon (s), or undefined if
 * it won't (it's past, beside the wall of water, or still far off).
 */
export function waveComing(arena: Arena, me: Fighter, z: Zone) {
  if (z.ability.kind !== "wave" || !arena.rivals(z.owner, me.id)) return;
  const ux = Math.cos(z.angle ?? 0),
    uy = Math.sin(z.angle ?? 0),
    dx = me.x - z.x,
    dy = me.y - z.y,
    along = dx * ux + dy * uy,
    across = Math.abs(-dx * uy + dy * ux),
    front = arena.waveFront(z);
  if (across > z.radius + RULES.radius + 20 || along < front - 30) return;
  return (along - front) / Math.max(1, z.ability.speed);
}
/** Corners just outside a block: the waypoints for walking around cover. */
const cornersOf = (o: Rect): Point[] => {
  const m = RULES.radius + 14;
  return [
    { x: o.x - m, y: o.y - m },
    { x: o.x + o.w + m, y: o.y - m },
    { x: o.x - m, y: o.y + o.h + m },
    { x: o.x + o.w + m, y: o.y + o.h + m },
  ];
};
/** Corners just outside every PvP pillar. */
const CORNERS: Point[] = OBSTACLES.flatMap(cornersOf);
const cornerCache = new WeakMap<readonly Rect[], Point[]>();
/**
 * The corners for the walls in use: the PvP pillars' (as always), plus
 * those of any other blocks the room has (the Spire's court layouts).
 */
export function cornersNow(): Point[] {
  const walls = currentObstacles();
  let list = cornerCache.get(walls);
  if (!list) {
    const extra = walls.filter(
      (w) =>
        !OBSTACLES.some(
          (o) => o.x === w.x && o.y === w.y && o.w === w.w && o.h === w.h,
        ),
    );
    list = extra.length ? [...CORNERS, ...extra.flatMap(cornersOf)] : CORNERS;
    cornerCache.set(walls, list);
  }
  return list;
}
/**
 * When cover blocks the view, the next corner to walk to: the shortest route
 * via one corner that sees both ends, else the visible corner nearest the goal.
 */
export function waypoint(
  clear: (a: Point, b: Point) => boolean,
  from: Point,
  goal: Point,
): Point | null {
  if (clear(from, goal)) return null;
  let best: Point | null = null,
    bestCost = Infinity,
    fallback: Point | null = null,
    fallbackCost = Infinity;
  for (const c of cornersNow()) {
    if (blocked(c.x, c.y, RULES.radius) || !clear(from, c)) continue;
    const toGoal = Math.hypot(goal.x - c.x, goal.y - c.y),
      cost = Math.hypot(c.x - from.x, c.y - from.y) + toGoal;
    if (clear(c, goal) && cost < bestCost) {
      bestCost = cost;
      best = c;
    } else if (toGoal < fallbackCost) {
      fallbackCost = toGoal;
      fallback = c;
    }
  }
  const next = best ?? fallback;
  // Already at that corner: no detour needed.
  return next && Math.hypot(next.x - from.x, next.y - from.y) > 20
    ? next
    : null;
}
type Seen = { t: number; x: number; y: number; vx: number; vy: number };
export class BotBrain {
  readonly profile: Profile;
  private random: () => number;
  private seen: Seen[] = [];
  private nextThink = 0;
  private plan = { dx: 0, dy: 0 };
  private strafe = 1;
  private nextStrafeFlip = 0;
  private hesitateUntil = 0;
  private nextRest = 0;
  private resting = false;
  private nextDaze = 0;
  private dazed = false;
  private wantSkill = -1;
  /** Projectile ids already judged (dodge or not) so it decides once per shot. */
  private judged = new Map<number, boolean>();
  private cloneDecision?: { until: number; fooled: boolean };
  /** The enemy it is fighting (2v2 and free-for-all have several). */
  private targetId?: string;
  /** Who it is fighting now (a teammate bot joins in, 2v2). */
  get target() {
    return this.targetId;
  }
  /** The player-facing difficulty (an expert brain plays rites as Hard). */
  readonly difficulty: BotDifficulty;
  constructor(
    readonly id: string,
    level: BotLevel,
    seed = 1,
  ) {
    this.profile = BALANCE_PROFILES[level];
    this.difficulty = level === "expert" ? "hard" : level;
    this.random = rng(seed);
  }
  /** Forget per-round memory (positions, judged shots) at a new round. */
  reset() {
    this.seen = [];
    this.nextThink = 0;
    this.judged.clear();
    this.cloneDecision = undefined;
    this.wantSkill = -1;
    this.targetId = undefined;
  }
  /**
   * Who to fight. With one opponent (a duel, a raid boss) that is them. With
   * several, it weighs each by distance, health left and whether it can see
   * them, prefers to stay on its current target, and only reconsiders when it
   * makes a tactical decision. (It used to take the first opponent in join
   * order, so in a free-for-all every bot went for the same fighter.)
   */
  private pickTarget(arena: Arena, me: Fighter) {
    const foes = arena.players.filter(
      (p) =>
        p.id !== me.id &&
        !p.out &&
        p.hp > 0 &&
        arena.teamOf(p) !== arena.teamOf(me),
    );
    let pick = foes[0];
    const current = foes.find((p) => p.id === this.targetId);
    if (foes.length > 1) {
      if (current && arena.time < this.nextThink) pick = current;
      else {
        let best = Infinity;
        // PvP: who its teammates are fighting (2v2 focus fire).
        const focus = arena.mode !== "raid" && this.profile.focus;
        const mates = focus
          ? arena.players.filter(
              (p) =>
                p.id !== me.id &&
                !p.out &&
                p.hp > 0 &&
                arena.teamOf(p) === arena.teamOf(me),
            )
          : [];
        for (const p of foes) {
          const share =
            p.hp / maxHealth(p.character, arena.mode, arena.players.length);
          let cost =
            Math.hypot(p.x - me.x, p.y - me.y) * (0.5 + 0.5 * share) +
            (arena.lineClear(me, p) ? 0 : 200) +
            (arena.has(p, "stealth") ? 300 : 0) -
            (p === current ? 150 : 0);
          if (focus) {
            // Nearly out: finish it before it heals or someone else does.
            if (share < 0.3) cost -= 140;
            // Two on one: join a teammate's fight (a bot's chosen target,
            // or whoever a player teammate stands next to).
            if (
              mates.some((m) =>
                arena.bots.has(m.id)
                  ? arena.bots.get(m.id)?.target === p.id
                  : Math.hypot(m.x - p.x, m.y - p.y) < 260,
              )
            )
              cost -= 160;
            // Free-for-all: one already trading blows with someone else is
            // distracted and losing health; pick on it.
            else if (
              arena.mode === "ffa" &&
              foes.some(
                (o) => o !== p && Math.hypot(o.x - p.x, o.y - p.y) < 280,
              )
            )
              cost -= 90;
          }
          if (cost < best) {
            best = cost;
            pick = p;
          }
        }
      }
    }
    if (!pick) return arena.players.find((p) => p.id !== me.id);
    // A new target: forget what it saw of the last one.
    if (this.targetId !== undefined && this.targetId !== pick.id) {
      this.seen = [];
      this.cloneDecision = undefined;
    }
    this.targetId = pick.id;
    return pick;
  }
  /** The expert's learned way of playing this champion (none: the rules as written). */
  private styleOf(me: Fighter): Style {
    return this.profile.style?.[me.character] ?? NO_STYLE;
  }
  /** Way of moving the look-ahead chose, kept for a moment. */
  private commit?: { until: number; dx: number; dy: number };
  private nextLook = 0;
  think(arena: Arena, me: Fighter): Input {
    const input = this.rules(arena, me);
    if (!this.profile.expert?.lookAhead) return input;
    return this.lookAheadOn(arena, me, input);
  }
  /**
   * Expert: weigh the rules' choice against a few others by playing them
   * ahead on a copy of the match (bot-lookahead.ts). Not in raids, nor
   * against a stealthed enemy (the copy would give its position away).
   */
  private lookAheadOn(arena: Arena, me: Fighter, input: Input): Input {
    const t = arena.time;
    const enemy = arena.players.find((p) => p.id === this.targetId);
    if (
      arena.mode === "raid" ||
      arena.phase !== "playing" ||
      !enemy ||
      enemy.hp <= 0 ||
      me.hp <= 0 ||
      (me.burrow && t < me.burrow.until) ||
      arena.has(enemy, "stealth")
    ) {
      this.commit = undefined;
      return input;
    }
    if (this.commit && t < this.commit.until && !input.dash && !input.jump) {
      input.dx = this.commit.dx;
      input.dy = this.commit.dy;
    }
    if (t < this.nextLook) return input;
    const choice = lookAhead(
      arena,
      me,
      enemy,
      input,
      this.random,
      (z) =>
        !!markOf(z) && arena.rivals(z.owner, me.id) && !this.seesMark(arena, z),
    );
    if (!choice) return input;
    this.nextLook = t + LOOK_EVERY;
    this.commit = choice.commit;
    return choice.input;
  }
  private rules(arena: Arena, me: Fighter): Input {
    const input = blankInput();
    // An opponent (in a raid, the boss; never a teammate).
    const enemy = this.pickTarget(arena, me);
    const t = arena.time;
    // Raids (and the Spire) keep the play they were tuned with.
    const pvp = arena.mode !== "raid";
    input.aimX = enemy?.x ?? RULES.width / 2;
    input.aimY = enemy?.y ?? RULES.height / 2;
    if (!enemy || enemy.hp <= 0 || me.hp <= 0) return input;
    // Perception: remember where the opponent was; act on a delayed view.
    if (!arena.has(enemy, "stealth"))
      this.seen.push({
        t,
        x: enemy.x,
        y: enemy.y,
        vx: enemy.vx,
        vy: enemy.vy,
      });
    while (this.seen.length > 2 && this.seen[1].t <= t - this.profile.reaction)
      this.seen.shift();
    const view = this.seen[0] ?? {
      t,
      x: enemy.x,
      y: enemy.y,
      vx: 0,
      vy: 0,
    };
    // The expert's counterplay, for the levels that have it (PvP only:
    // raids play as tuned).
    const ex = pvp ? this.profile.expert : undefined;
    // A decoy may fool it (decided once per clone).
    let target = { x: view.x, y: view.y, vx: view.vx, vy: view.vy };
    if (enemy.clone) {
      if (!this.cloneDecision || this.cloneDecision.until !== enemy.clone.until)
        this.cloneDecision = {
          until: enemy.clone.until,
          fooled: this.random() < this.profile.fooledByClone,
        };
      if (this.cloneDecision.fooled)
        target = { x: enemy.clone.x, y: enemy.clone.y, vx: 0, vy: 0 };
    }
    const character = CHARACTERS[me.character];
    // Rites can change the basic attack (reach, damage): use the real one.
    const basic = arena.kit(me).basic;
    const melee = basic.kind === "melee" || basic.kind === "cone";
    const dist = Math.hypot(target.x - me.x, target.y - me.y);
    const sight = arena.lineClear(me, target);
    const hpRatio =
        me.hp / maxHealth(me.character, arena.mode, arena.players.length),
      enemyRatio =
        enemy.hp / maxHealth(enemy.character, arena.mode, arena.players.length);
    const enemyDisabled = DISABLES.some((k) => arena.has(enemy, k));
    // ---- Threats: shots that will hit soon, and big wind-ups nearby.
    let threat: {
      dx: number;
      dy: number;
      ground: boolean;
      big: boolean;
      eta: number;
    } | null = null;
    // A shot on its way to hit it, whether or not it decides to dodge: what
    // defensive skills (barriers, counters, clones) answer. Seeing it coming
    // is not the hard part; dodging in time is, and that is what `dodge` sets.
    let incoming = false;
    for (const pr of arena.projectiles) {
      if (pr.owner === me.id) continue;
      const rx = me.x - pr.x,
        ry = me.y - pr.y,
        v2 = pr.vx * pr.vx + pr.vy * pr.vy;
      if (!v2) continue;
      const eta = (rx * pr.vx + ry * pr.vy) / v2;
      if (eta <= 0 || eta > 0.6) continue;
      const mx = pr.x + pr.vx * eta - me.x,
        my = pr.y + pr.vy * eta - me.y;
      if (Math.hypot(mx, my) > pr.ability.radius + RULES.radius + 8) continue;
      if (this.profile.seeShots) incoming = true;
      if (!this.judged.has(pr.id))
        this.judged.set(pr.id, this.random() < this.profile.dodge);
      if (!this.judged.get(pr.id)) continue;
      if (!threat || eta < threat.eta) {
        // Step sideways relative to the shot.
        const speed = Math.sqrt(v2);
        let px = -pr.vy / speed,
          py = pr.vx / speed;
        if (px * mx + py * my > 0) {
          px = -px;
          py = -py;
        }
        threat = {
          dx: px,
          dy: py,
          ground: pr.ability.ground,
          big: pr.ability.damage >= 15 || pr.ability.ground,
          eta,
        };
      }
    }
    if (this.judged.size > 200)
      for (const id of [...this.judged.keys()].slice(0, 100))
        this.judged.delete(id);
    const windup =
      enemy.charge &&
      (() => {
        // The enemy's own rites (a wider nova, say) count when dodging.
        const a = kitOf(enemy.character, enemy.rites).skills[
          enemy.charge!.skill
        ];
        // A blast ring, a cage about to rise, or rays about to turn.
        const reach = RING_KINDS.includes(a.kind) ? a.radius : 0;
        return reach > 0 &&
          Math.hypot(enemy.x - me.x, enemy.y - me.y) < reach + 40
          ? a
          : undefined;
      })();
    if (windup && !this.judged.has(-enemy.charge!.at))
      this.judged.set(-enemy.charge!.at, this.random() < this.profile.dodge);
    const fleeWindup = windup && this.judged.get(-enemy.charge!.at);
    // A dazed second. In raids (stand-ins, Spire Echoes) it stands still
    // and holds everything, as the raids were tuned with. Elsewhere it is a
    // lapse of attention, the way a person's is: it keeps moving and keeps
    // out of hazards, but attacks, casts and dodges nothing.
    // In raids only a level with raidDazeBy (Normal) is dazed; a champion
    // newer than its raidDazeBy takes its PvP share there too.
    const raidDaze = this.profile.raidDazeBy;
    const daze = pvp
      ? (this.profile.dazeBy?.[me.character] ?? this.profile.daze)
      : raidDaze &&
        (raidDaze[me.character] ?? this.profile.dazeBy?.[me.character]);
    if (daze) {
      if (t >= this.nextDaze) {
        this.nextDaze = t + 1;
        this.dazed = this.random() < daze;
      }
      if (this.dazed && !pvp) return input;
    } else this.dazed = false;
    const lapse = pvp && this.dazed;
    // ---- Tactical decisions on a timer (slower bots decide less often).
    // A shooter facing a brawler keeps it at bay (PvP; raids as tuned).
    const enemyBasic = arena.kit(enemy).basic;
    const kiting =
      pvp &&
      !melee &&
      (enemyBasic.kind === "melee" || enemyBasic.kind === "cone")
        ? (this.styleOf(me).kite ?? this.profile.kite ?? 0)
        : 0;
    // Low and behind on health: play safe until it is healed or ahead.
    const retreating =
      pvp &&
      hpRatio < (this.styleOf(me).retreat ?? this.profile.retreat ?? 0) &&
      hpRatio < enemyRatio - 0.1;
    if (t >= this.nextThink) {
      this.nextThink = t + this.profile.think * (0.8 + this.random() * 0.4);
      if (t >= this.nextStrafeFlip) {
        this.strafe = this.random() < 0.5 ? -1 : 1;
        this.nextStrafeFlip = t + 0.9 + this.random() * 1.6;
      }
      // Hesitating: in raids it stands still for a moment; elsewhere it
      // keeps moving and only lets this chance for a skill go by.
      const hesitating = this.random() < this.profile.hesitate;
      this.hesitateUntil = hesitating && !pvp ? t + this.profile.think : 0;
      // Brawlers cut the opponent off by heading for where it is going.
      const chase = melee
        ? {
            x: target.x + target.vx * 0.45 * this.profile.lead,
            y: target.y + target.vy * 0.45 * this.profile.lead,
          }
        : target;
      this.plan = this.choosePath(arena, me, chase, melee, hpRatio, {
        kiting,
        retreating,
      });
      // Closer to a useful orb than the opponent is: go and take it (healing
      // when hurt, energy when the ultimate is still charging). In PvP a
      // hurt bot goes further for healing, and nobody turns away from an
      // opponent it is about to finish.
      const finishing = pvp && enemyRatio < 0.25 && hpRatio > enemyRatio;
      const orb = lapse
        ? undefined
        : arena.orbs
            .filter((o) =>
              o.kind === "energy"
                ? (me.ult ?? 0) < RULES.ultMax * 0.7 && !retreating
                : hpRatio < 0.7,
            )
            .map((o) => ({ o, d: Math.hypot(o.x - me.x, o.y - me.y) }))
            .sort((a, b) => a.d - b.d)[0];
      const slack =
        orb && pvp && orb.o.kind !== "energy"
          ? retreating
            ? 260
            : hpRatio < 0.45
              ? 160
              : 80
          : 80;
      if (
        orb &&
        !finishing &&
        orb.d < Math.hypot(orb.o.x - enemy.x, orb.o.y - enemy.y) + slack &&
        this.random() < this.profile.skillUse + 0.2
      ) {
        const goal =
          waypoint((a, b) => arena.lineClear(a, b), me, orb.o) ?? orb.o;
        const gd = Math.hypot(goal.x - me.x, goal.y - me.y) || 1;
        this.plan = { dx: (goal.x - me.x) / gd, dy: (goal.y - me.y) / gd };
      }
      this.wantSkill =
        lapse || (pvp && hesitating)
          ? -1
          : this.chooseSkill(arena, me, enemy, target, {
              dist,
              sight,
              hpRatio,
              enemyRatio,
              enemyDisabled,
              threatened: !!threat || incoming || dist < 170,
            });
    }
    // ---- Movement.
    let { dx, dy } = this.plan;
    if (t < this.hesitateUntil) dx = dy = 0;
    // A lapse: it walks on, but reacts to nothing coming at it.
    if (lapse) threat = null;
    if (fleeWindup && !lapse) {
      const away = Math.hypot(me.x - enemy.x, me.y - enemy.y) || 1;
      dx = (me.x - enemy.x) / away;
      dy = (me.y - enemy.y) / away;
      if (t >= me.dashAt) input.dash = true;
    }
    if (threat && threat.big) {
      // Big hits: break off, jump ground attacks, dash the rest at the last moment.
      dx = threat.dx;
      dy = threat.dy;
      if (threat.ground && t >= me.jumpAt && t >= me.jumpUntil)
        input.jump = true;
      else if (threat.eta < 0.3 && t >= me.dashAt) input.dash = true;
    } else if (threat) {
      // Chip shots: sidestep while still following the plan.
      const bx = dx + threat.dx * 0.9,
        by = dy + threat.dy * 0.9,
        bl = Math.hypot(bx, by) || 1;
      dx = bx / bl;
      dy = by / bl;
    }
    // Jump a wave just before it reaches it (decided once per wave).
    for (const zone of arena.zones) {
      const eta = waveComing(arena, me, zone);
      if (eta === undefined || eta > 0.22) continue;
      const key = 1e9 + zone.id;
      if (!this.judged.has(key))
        this.judged.set(key, this.random() < this.profile.dodge);
      if (this.judged.get(key) && t >= me.jumpAt && t >= me.jumpUntil)
        input.jump = true;
    }
    // Get out of enemy zones (jump the ground ones if it can).
    let escaping = false;
    for (const zone of arena.zones)
      if (
        hostileZone(arena, me, zone) &&
        // The expert jumps seedlings and plans its way out of marks (below).
        !(ex?.jumpSeeds && zone.ability.kind === "seedling") &&
        !(
          ex?.dodgeMarks &&
          markOf(zone) &&
          (this.profile.reaction <= MARK_REACTION || this.seesMark(arena, zone))
        ) &&
        Math.hypot(zoneArea(zone).x - me.x, zoneArea(zone).y - me.y) <
          zoneArea(zone).radius + RULES.radius
      ) {
        const z = { ...zone, ...zoneArea(zone) };
        escaping = true;
        const away = Math.hypot(me.x - z.x, me.y - z.y) || 1;
        dx = (me.x - z.x) / away;
        dy = (me.y - z.y) / away;
        if (
          z.ability.ground &&
          this.profile.dodge > 0.3 &&
          t >= me.jumpAt &&
          t >= me.jumpUntil
        )
          input.jump = true;
        // Sloth Time slows walking, not dashing: dash out of the bubble.
        else if (
          z.ability.kind === "timewarp" &&
          this.profile.dodge > 0.3 &&
          t >= me.dashAt
        )
          input.dash = true;
      }
    // A wraith hunting it: keep running (dash away when it is about to touch).
    for (const zone of arena.zones) {
      if (zone.ability.kind !== "hunt" || !arena.rivals(zone.owner, me.id))
        continue;
      const d = Math.hypot(me.x - zone.x, me.y - zone.y) || 1;
      if (d > zone.radius + 100) continue;
      escaping = true;
      dx = (me.x - zone.x) / d;
      dy = (me.y - zone.y) / d;
      if (d < zone.radius + 50 && this.profile.dodge > 0.3 && t >= me.dashAt)
        input.dash = true;
    }
    // A Leaf Storm: get out past the blades (decided once per storm).
    if (enemy.cyclone && arena.time < enemy.cyclone.until) {
      const storm = kitOf(enemy.character, enemy.rites).skills[
        enemy.cyclone.slot
      ];
      const d = Math.hypot(me.x - enemy.x, me.y - enemy.y) || 1;
      const key = -1e9 - enemy.cyclone.at;
      if (!this.judged.has(key))
        this.judged.set(key, this.random() < this.profile.dodge);
      if (storm && this.judged.get(key) && d < storm.radius + 90) {
        escaping = true;
        dx = (me.x - enemy.x) / d;
        dy = (me.y - enemy.y) / d;
      }
    }
    // Expert: out of marked blasts before they land.
    if (ex?.dodgeMarks) {
      const way = this.dodgeMarks(arena, me, { dx, dy });
      if (way) {
        escaping = true;
        dx = way.dx;
        dy = way.dy;
        if (way.dash && t >= me.dashAt) input.dash = true;
      }
    }
    // Expert: hop over enemy seedlings in its way (or step round them).
    if (ex?.jumpSeeds && !arena.has(me, "root"))
      for (const z of arena.zones) {
        if (
          z.ability.kind !== "seedling" ||
          z.until <= t ||
          !arena.rivals(z.owner, me.id) ||
          t < me.jumpUntil
        )
          continue;
        const reach = (z.ability.seed?.trigger ?? 30) + RULES.radius,
          r = reach + 8,
          step = character.speed * 0.25;
        // Where its way enters and leaves the seed's reach, if it does.
        const rx = z.x - me.x,
          ry = z.y - me.y,
          along = rx * dx + ry * dy,
          miss = Math.abs(rx * dy - ry * dx);
        if (miss >= r || along <= 0 || (!dx && !dy)) continue;
        if (along - Math.sqrt(r * r - miss * miss) > step) continue;
        // Jump at the edge, so it lands past the far side.
        const half = miss < reach ? Math.sqrt(reach * reach - miss * miss) : 0;
        if (
          t >= me.jumpAt &&
          along + half < character.speed * RULES.jumpDuration
        ) {
          if (along - half < 20) input.jump = true;
        } else {
          // Round it, on the side it is already passing.
          const side = rx * dy - ry * dx > 0 ? 1 : -1,
            d = Math.hypot(rx, ry) || 1;
          dx = (-ry / d) * side;
          dy = (rx / d) * side;
        }
      }
    // Brawlers close the gap with a dash.
    if (
      !lapse &&
      melee &&
      !threat?.big &&
      // Expert: not while getting out of a mark.
      !(ex && escaping) &&
      sight &&
      dist > 120 &&
      dist < 290 &&
      t >= me.dashAt &&
      // PvP: much keener once the opponent has spent its own dash (it
      // cannot slip away), the way a player baits the escape out first.
      this.random() <
        (this.styleOf(me).engage ?? this.profile.engage) *
          (pvp && enemy.dashAt > t + 0.4 ? 3 : 1)
    ) {
      // Dash at where the opponent will be when the dash ends.
      const ahead = RULES.dashDuration * this.profile.lead;
      const gx = target.x + target.vx * ahead - me.x,
        gy = target.y + target.vy * ahead - me.y,
        g = Math.hypot(gx, gy) || 1;
      dx = gx / g;
      dy = gy / g;
      input.dash = true;
    }
    // Mossloth plants itself and fires while nothing is coming, so its moss
    // grows (a person playing it stands still the same way).
    if (
      CHARACTERS[me.character].passive === "moss" &&
      !threat &&
      !fleeWindup &&
      !escaping &&
      sight &&
      dist > 220 &&
      dist <= basic.range * 0.9 &&
      hpRatio > 0.25
    )
      dx = dy = 0;
    // Expert: a dash across an enemy seedling: hop it as well, or (when
    // only closing in) don't dash.
    if (ex?.jumpSeeds && input.dash && t >= me.dashAt) {
      const l = Math.hypot(dx, dy) || 1;
      if (
        seedOnWay(
          arena,
          me,
          dx / l,
          dy / l,
          RULES.dashSpeed * RULES.dashDuration + 40,
        )
      ) {
        if (t >= me.jumpAt && t >= me.jumpUntil) input.jump = true;
        else if (!escaping && !threat && !fleeWindup) input.dash = false;
      }
    }
    // A lapse walks out of trouble but neither jumps nor dashes.
    if (lapse) input.jump = input.dash = false;
    input.dx = clamp(dx, -1, 1);
    input.dy = clamp(dy, -1, 1);
    // ---- Aim: lead moving targets with projectiles, plus human-like spread.
    // PvP: a skill shot about to go out leads by its own speed, not the
    // basic attack's (raids keep the old aim).
    const casting =
      pvp && this.wantSkill >= 0 && skillReady(me, this.wantSkill, t)
        ? arena.kit(me).skills[this.wantSkill]
        : undefined;
    const projectileSpeed =
      casting &&
      (casting.kind === "projectile" ||
        casting.kind === "barrage" ||
        casting.kind === "charged") &&
      casting.speed > 0
        ? casting.speed
        : basic.kind === "projectile"
          ? basic.speed
          : 0;
    // A slow skill shot is led only so far: a target dodging about rarely
    // keeps going one way for long (a person leads it partway, too).
    const leadTime = projectileSpeed
      ? Math.min(
          (dist / projectileSpeed) * this.profile.lead,
          casting ? 0.45 : Infinity,
        )
      : 0;
    let ax = target.x + target.vx * leadTime,
      ay = target.y + target.vy * leadTime;
    const error = (this.random() * 2 - 1) * this.profile.aimError;
    const angle = Math.atan2(ay - me.y, ax - me.x) + error;
    const reach = Math.max(60, Math.hypot(ax - me.x, ay - me.y));
    ax = me.x + Math.cos(angle) * reach;
    ay = me.y + Math.sin(angle) * reach;
    // A seedling goes down part of the way toward the opponent, to grow
    // before it gets there (not under its feet, where it would go off unripe).
    if (
      this.wantSkill >= 0 &&
      arena.kit(me).skills[this.wantSkill]?.kind === "seedling"
    ) {
      ax = me.x + (ax - me.x) * 0.45;
      ay = me.y + (ay - me.y) * 0.45;
    }
    // Expert: a ready Eyespot Flash in reach: look away between attacks,
    // turning back just before each one (holding fire costs more than the
    // stun saves: measured, see docs/balance-overhaul.md).
    if (ex?.lookAway) {
      const g = arena.kit(enemy).skills.findIndex((k) => k.kind === "gaze");
      const gaze = g >= 0 ? arena.kit(enemy).skills[g] : undefined;
      if (
        gaze &&
        skillReady(enemy, g, t) &&
        !enemyDisabled &&
        dist < gaze.radius + RULES.radius + 40
      ) {
        const casting =
          this.wantSkill >= 0 && skillReady(me, this.wantSkill, t);
        if (!casting && me.basicAt - t > LOOK_BACK) {
          // Turned well past the flash's cone, to the side that keeps the
          // aim point on the court (a clamped point would turn it back).
          const base = Math.atan2(target.y - me.y, target.x - me.x),
            turn = (gaze.gaze ?? 0.6) + 0.5,
            inside = (side: number) => {
              const x = me.x + Math.cos(base + turn * side) * 80,
                y = me.y + Math.sin(base + turn * side) * 80;
              return x >= 0 && x <= RULES.width && y >= 0 && y <= RULES.height;
            },
            side = inside(this.strafe) ? this.strafe : -this.strafe;
          ax = me.x + Math.cos(base + turn * side) * 80;
          ay = me.y + Math.sin(base + turn * side) * 80;
        }
      }
    }
    input.aimX = clamp(ax, 0, RULES.width);
    input.aimY = clamp(ay, 0, RULES.height);
    // ---- Attack.
    // Underground (Tunnel): head for the opponent and burst up beside it.
    if (me.burrow && t < me.burrow.until) {
      const dig = arena.kit(me).skills[me.burrow.slot];
      const d = Math.hypot(enemy.x - me.x, enemy.y - me.y) || 1;
      if (hpRatio > 0.3 || d < 200) {
        input.dx = (enemy.x - me.x) / d;
        input.dy = (enemy.y - me.y) / d;
      }
      if (dig && d < dig.radius * 0.6 + RULES.radius && !lapse)
        input.skill = me.burrow.slot;
      return input;
    }
    if (lapse) return input;
    if (this.wantSkill >= 0 && skillReady(me, this.wantSkill, t)) {
      input.skill = this.wantSkill;
      this.wantSkill = -1;
    } else if (
      sight &&
      !this.restingAt(t) &&
      dist <= basic.range * 0.95 + (melee ? RULES.radius : 0)
    )
      input.basic = true;
    return input;
  }
  /**
   * Expert: a way out of the marked blasts about to land on it. It sees a
   * mark a moment after it appears (like a player) and tries sixteen
   * directions, walking or, if no walk clears them in time, dashing.
   * Undefined when the way it is already going is safe.
   */
  private dodgeMarks(
    arena: Arena,
    me: Fighter,
    now: { dx: number; dy: number },
  ): { dx: number; dy: number; dash: boolean } | undefined {
    const t = arena.time;
    const marks: { x: number; y: number; r: number; in: number }[] = [];
    let pull = 0;
    for (const z of arena.zones) {
      if (!arena.rivals(z.owner, me.id)) continue;
      const m = markOf(z);
      if (!m || !this.seesMark(arena, z)) continue;
      const left = m.at - t;
      if (left <= 0 || left > 1.2) continue;
      marks.push({ x: z.x, y: z.y, r: m.r + RULES.radius + 6, in: left });
      if (
        m.pull &&
        Math.hypot(z.x - me.x, z.y - me.y) < z.radius + RULES.radius
      )
        pull = Math.max(pull, m.pull);
    }
    if (!marks.length || arena.has(me, "root")) return;
    const speed =
      CHARACTERS[me.character].speed * (arena.has(me, "slow") ? 0.55 : 0.92) -
      pull;
    // How a way fares: marks it ends up inside, and its closest call.
    const judge = (ux: number, uy: number, burst: number) => {
      let hits = 0,
        margin = 60;
      for (const m of marks) {
        const go = burst + Math.max(0, speed) * Math.max(0, m.in - 0.05);
        const x = clamp(me.x + ux * go, 0, RULES.width),
          y = clamp(me.y + uy * go, 0, RULES.height);
        const d = Math.hypot(x - m.x, y - m.y) - m.r;
        if (d < 0) hits++;
        margin = Math.min(margin, d);
      }
      return { hits, margin };
    };
    const current = judge(now.dx, now.dy, 0);
    if (!current.hits) return;
    let best: { dx: number; dy: number; score: number } | undefined;
    let bestDash: typeof best;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2,
        ux = Math.cos(a),
        uy = Math.sin(a);
      if (blocked(me.x + ux * 40, me.y + uy * 40, RULES.radius)) continue;
      const lean = ux * now.dx + uy * now.dy;
      const walk = judge(ux, uy, 0);
      const score = -walk.hits * 100 + walk.margin + lean * 20;
      if (!best || score > best.score) best = { dx: ux, dy: uy, score };
      const dash = judge(ux, uy, RULES.dashSpeed * RULES.dashDuration);
      const dashScore = -dash.hits * 100 + dash.margin + lean * 20;
      if (!bestDash || dashScore > bestDash.score)
        bestDash = { dx: ux, dy: uy, score: dashScore };
    }
    if (!best) return;
    // A walk that clears every mark; else a dash if that does better.
    if (best.score > -50 || !bestDash || bestDash.score <= best.score)
      return { dx: best.dx, dy: best.dy, dash: false };
    return { dx: bestDash.dx, dy: bestDash.dy, dash: true };
  }
  /**
   * Has it taken in this mark yet? The expert sees one MARK_REACTION after
   * it appears; a player level after its own reaction time. Until then a
   * player level just walks out of it as it always did (zone escape), and
   * the expert ignores it, as it was measured.
   */
  private seesMark(arena: Arena, z: Zone) {
    const react = Math.max(
      MARK_REACTION,
      this.profile.markReaction ?? this.profile.reaction,
    );
    return arena.time - (z.born ?? 0) >= react;
  }
  /** Re-rolled once a second: a resting bot holds its basic attack. */
  private restingAt(t: number) {
    if (t >= this.nextRest) {
      this.nextRest = t + 1;
      this.resting = this.random() < this.profile.rest;
    }
    return this.resting;
  }
  /** Sample directions and pick the spot that keeps range, sight and safety. */
  private choosePath(
    arena: Arena,
    me: Fighter,
    target: { x: number; y: number },
    melee: boolean,
    hpRatio: number,
    pvp: { kiting: number; retreating: boolean } = {
      kiting: 0,
      retreating: false,
    },
  ) {
    const basic = arena.kit(me).basic;
    const st = this.styleOf(me);
    let preferred = melee
      ? (st.reach ?? 70)
      : clamp(basic.range * 0.5, 240, 400) * (st.range ?? 1) +
        (hpRatio < 0.35 ? 90 : 0);
    const { kiting, retreating } = pvp;
    // Low and behind: a shooter backs off further (a brawler can only win
    // up close, so it keeps fighting and goes for healing orbs instead).
    if (retreating && !melee) preferred += 110;
    // Backing straight off only when low; a brawler in reach is held off by
    // spacing, footwork out of corners and the dash (see think).
    const away = !melee && retreating ? 0.6 : 0,
      cornered = melee ? 0 : kiting + away;
    const via = waypoint((a, b) => arena.lineClear(a, b), me, target);
    let best = { dx: 0, dy: 0 },
      bestScore = -Infinity;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const dx = Math.cos(a),
        dy = Math.sin(a);
      const x = me.x + dx * 70,
        y = me.y + dy * 70;
      if (
        blocked(x, y, RULES.radius) ||
        blocked(me.x + dx * 30, me.y + dy * 30, RULES.radius)
      )
        continue;
      const d = Math.hypot(target.x - x, target.y - y);
      // Brawlers care most about closing in; shooters about range and sight.
      const now = Math.hypot(target.x - me.x, target.y - me.y);
      let score = via
        ? // Walking around cover: head for the corner.
          -Math.hypot(via.x - x, via.y - y) / 25
        : (-Math.abs(d - preferred) / 60) * (melee ? (st.closeIn ?? 2.6) : 1);
      if (arena.lineClear({ x, y }, target))
        score += (melee ? 1 : 2.2) * (st.sight ?? 1);
      // Circle the opponent instead of running straight at it.
      const tx =
          (target.x - me.x) /
          (Math.hypot(target.x - me.x, target.y - me.y) || 1),
        ty =
          (target.y - me.y) /
          (Math.hypot(target.x - me.x, target.y - me.y) || 1);
      score +=
        (dx * -ty + dy * tx) *
        this.strafe *
        (via ? 0.15 : melee && now > 180 ? 0.35 : 0.9) *
        (st.circle ?? 1);
      // Backing off: away from the opponent, and never into a corner where
      // a brawler pins it.
      if (away && now < preferred) score += away * 1.2 * (-dx * tx - dy * ty);
      if (cornered) {
        const cx = Math.min(x, RULES.width - x),
          cy = Math.min(y, RULES.height - y);
        if (cx < 220 && cy < 220)
          score -= (cornered * (220 - cx + (220 - cy))) / 160;
      }
      // Stay off the walls and out of hazards.
      const edge = Math.min(x, y, RULES.width - x, RULES.height - y);
      if (edge < 90) score -= (90 - edge) / 30;
      for (const z of arena.zones)
        if (
          hostileZone(arena, me, z) &&
          Math.hypot(zoneArea(z).x - x, zoneArea(z).y - y) <
            zoneArea(z).radius + RULES.radius
        )
          score -= 4;
      // Arena hazards: careful bots step out before a vent or surge fires.
      const clock = arena.arenaTime();
      for (const h of ARENAS[arena.arenaId].hazards)
        if (Math.hypot(h.x - x, h.y - y) < h.radius + RULES.radius) {
          if (h.kind === "pool") score -= 1;
          if (clock >= 0 && hazardIn(h, clock) < h.warn + 0.3)
            score -= 6 * this.profile.dodge;
        }
      // The closing ring: get inside (with a margin) before it bites.
      const ring = ringRadius(arena.deadline - arena.time, arena.overtime);
      if (ring !== null) {
        const out = Math.hypot(x - RING.x, y - RING.y) - (ring - 60);
        if (out > 0) score -= 2 + out / 40;
      }
      score += (this.random() - 0.5) * 0.4;
      if (score > bestScore) {
        bestScore = score;
        best = { dx, dy };
      }
    }
    return best;
  }
  /** Returns a skill slot worth casting now, or -1. */
  private chooseSkill(
    arena: Arena,
    me: Fighter,
    enemy: Fighter,
    target: { x: number; y: number },
    s: {
      dist: number;
      sight: boolean;
      hpRatio: number;
      enemyRatio: number;
      enemyDisabled: boolean;
      threatened: boolean;
    },
  ) {
    const t = arena.time;
    if (me.charge || me.channel || t < me.recoveryUntil) return -1;
    // Nothing reaches an opponent underground (Tunnel): wait for it.
    if (arena.burrowed(enemy)) return -1;
    const skills = arena.kit(me).skills;
    const smart =
      arena.mode === "raid"
        ? this.profile.smartUltimate
        : (this.profile.pvpSmartUltimate ?? this.profile.smartUltimate);
    let best = -1,
      bestScore = 0;
    skills.forEach((a: Ability, i) => {
      if (!skillReady(me, i, t)) return;
      if (this.profile.unknownKinds?.includes(a.kind)) return;
      let score = 0;
      const reach = (range: number) => s.dist <= range;
      switch (a.kind) {
        case "projectile":
        case "charged":
        case "barrage":
        case "beam":
          // A marksman's shot (farBonus) is worth more the farther away they are.
          if (s.sight && reach(a.range * 0.85))
            score =
              a.damage * farMultiplier(a, s.dist) * (a.boomerang ? 1.6 : 1) +
              // Sticky Mochi: grounding a target is worth more than its damage.
              (a.status === "grounded" ? 10 : 0);
          break;
        case "rush":
        case "blink":
          // Gap closers that land their hit on arrival: used like a long melee
          // strike, once the target is within (most of) the reach. A rooted
          // fighter's charge goes nowhere.
          if (a.kind === "rush" && arena.has(me, "root")) break;
          if (s.sight && reach(a.range * 0.9 + RULES.radius))
            score = Math.max(a.damage, 12) * 1.2;
          break;
        case "veil":
          // Slip into stealth on the way in, so the first hit is an ambush.
          if (s.sight && reach(520)) score = 15;
          break;
        case "screen": {
          // An Ember Curtain against shots coming in, or a shooter keeping its distance.
          const ranged =
            CHARACTERS[enemy.character].basic.kind !== "melee" &&
            CHARACTERS[enemy.character].basic.kind !== "cone";
          // It also burns a tongue off: raise it before a grappler latches on.
          const grapples = arena
            .kit(enemy)
            .skills.some(
              (k, n) => k.kind === "grapple" && t >= enemy.cooldowns[n] - 1,
            );
          if (
            s.threatened ||
            (ranged && s.dist > 220 && s.sight) ||
            (grapples && s.sight && s.dist > 170 && s.dist < 500)
          )
            score = 18;
          break;
        }
        case "taunt":
          // Grudge Thump: drag whoever is close into a brawl.
          if (s.sight && reach(a.radius)) score = 18 + a.damage;
          break;
        case "rewind":
          // Halcyon Rewind: an escape (and a heal) when hurt and pressed.
          if (s.threatened && s.hpRatio < 0.65) score = 17;
          break;
        case "tether":
          // Live Wire: wire a target that keeps its distance (it can't run
          // off any more); one already up close needs it less.
          if (a.tether?.yank) {
            // Well inside its reach: the wind-up gives the target time to
            // step out, and a wire that finds nobody is wasted.
            if (s.sight && reach(a.range * 0.8)) score = s.dist > 140 ? 22 : 10;
          }
          // Gill Siphon: lock on while the target is in reach.
          else if (s.sight && reach(a.range * 0.95))
            score = a.damage * (a.duration / (a.tether?.tick ?? 0.25)) * 0.6;
          break;
        case "gaze":
          // Eyespot Flash: whoever is near and looking gets stunned.
          if (s.sight && reach(a.radius * 0.9)) score = a.damage + 14;
          break;
        case "clamp":
        case "throw":
          // Static Clamp, Kraken Grasp: melee reach, the payoff comes a moment later.
          if (s.sight && reach(a.range + RULES.radius)) score = a.damage * 1.2;
          break;
        case "pound":
          // Mochi Pound: every strike of the chain while the target is close.
          if (s.sight && reach(a.range + RULES.radius)) score = a.damage * 2.4;
          break;
        case "cage":
          // Crystal Cage: shut the target in with it, up close.
          if (s.sight && reach(a.radius * 0.75)) score = a.damage + 18;
          break;
        case "surf":
          // River Dash: through the target (and on past it).
          if (s.sight && s.dist > 50 && reach(a.range * 0.9))
            score = 18 + a.damage;
          break;
        case "wave":
          // Riptide Wave crosses the court: anywhere along the aim will do.
          score = a.damage * 1.5;
          break;
        case "storm":
          // Thunderstorm finds everyone it can see.
          if (!arena.has(enemy, "stealth"))
            score = a.damage * (a.count ?? 3) * 0.6;
          break;
        case "hunt":
          // Wraith Hunt: the wraith finds the target wherever it is.
          if (!arena.has(enemy, "stealth")) score = 25;
          break;
        case "leap":
          // Magma Leap: land on the target (it erupts round where it lands).
          if (s.sight && reach(a.range + (a.explosion ?? 0) * 0.5))
            score = a.damage * 1.3;
          break;
        case "creep":
          // Chestnut Storm creeps along the aim to its full length.
          if (reach(a.range)) score = a.damage * 2;
          break;
        case "garden":
          // Overgrowth: plant the garden under the target.
          if (reach(a.range)) score = 28;
          break;
        case "lure":
          // Radiant Flare: hang the light on the target.
          if (reach(a.range)) score = a.damage * 1.2;
          break;
        case "trail":
          // Spark Trail: lay it while circling a nearby target (bots strafe).
          if (s.sight && reach(220)) score = 18 + a.damage;
          break;
        case "steer":
          // Sunfire Pillar: drop it on the target, then keep aiming at it.
          if (reach(a.range)) score = a.damage * 5;
          break;
        case "grapple":
          // Latch on from mid range: a gap closer that lands its hit first.
          if (s.sight && s.dist > 170 && reach(a.range * 0.9)) score = 22;
          break;
        case "shrapnel": {
          // Worth more with plates to spend (and only up close, where the fan lands).
          const plates =
            CHARACTERS[me.character].passive === "plates" ? platesOf(me) : 0;
          if (s.sight && reach(a.range * 0.55))
            score = a.damage * (a.count ?? 3) * (1 + plates) * 0.35;
          break;
        }
        case "tunnel":
          // Dig out of trouble, or tunnel in from mid range to burst up
          // under the opponent (a rooted digger goes nowhere).
          if (arena.has(me, "root")) break;
          if (s.threatened && s.hpRatio < 0.75) score = 19;
          else if (s.dist > 170 && reach(380)) score = 17;
          break;
        case "cyclone":
          // Leaf Storm: whip the blades up with the opponent inside the ring.
          if (reach(a.radius + 40)) score = a.damage * 6;
          break;
        case "seedling": {
          // Keep a few seedlings growing between itself and the opponent.
          const mine = arena.zones.filter(
            (z) =>
              z.owner === me.id && z.ability.kind === "seedling" && z.until > t,
          ).length;
          if (mine < (a.count ?? 3) && reach(a.range / 0.45)) score = 14;
          break;
        }
        case "timewarp":
          // Slow the opponent (and its shots) when it presses in or fires.
          if (reach(a.range) && (s.threatened || s.dist < 260)) score = 20;
          break;
        case "swap": {
          // Standing among its own seedlings: swap the opponent onto them.
          const seeded = arena.zones.some(
            (z) =>
              z.owner === me.id &&
              z.ability.kind === "seedling" &&
              z.until > t &&
              Math.hypot(z.x - me.x, z.y - me.y) < 140,
          );
          if (seeded && s.dist > 200 && reach(a.range)) score = 19;
          break;
        }
        case "melee":
          if (s.sight && reach(a.range + RULES.radius)) score = a.damage * 1.2;
          break;
        case "cone":
          if (s.sight && reach(a.range * 0.9)) score = a.damage * 4;
          break;
        case "nova":
          if (s.sight && reach(a.radius + RULES.radius * 0.5))
            score = a.damage * 1.1;
          // Overgrowth also blooms every seedling it has.
          if (score && a.bloom)
            score +=
              8 *
              arena.zones.filter(
                (z) =>
                  z.owner === me.id &&
                  z.ability.kind === "seedling" &&
                  z.until > t,
              ).length;
          break;
        case "zone":
          if (a.heal) {
            // A spring that follows (Sanctuary) is worth a big hit in the
            // thick of a fight; one left behind (Warm Spring) is a breather
            // for when hurt and under pressure.
            if (a.follow) {
              if (s.sight && reach(a.radius + RULES.radius * 0.5)) score = 33;
            } else if (s.hpRatio < 0.8 && s.threatened) score = 18;
          } else if (a.follow) {
            if (reach(a.radius * 0.9)) score = a.damage * 5;
          } else if (reach(a.range))
            // A lantern (turret) keeps shooting: worth about five wisps.
            score =
              Math.max(a.turret ? a.turret.damage * 5 : a.damage, 10) *
              (s.enemyDisabled ? 1.6 : 1);
          break;
        case "counter":
          // Facet Guard vaults: close the gap on a kiter (or block up close).
          if (a.lunge && s.sight && s.dist > 220 && s.dist < 460) score = 22;
          else if (s.threatened) score = 18;
          break;
        case "barrier":
          if (s.threatened) score = 18;
          break;
        case "clone":
          if (s.threatened && s.hpRatio < 0.7) score = 16;
          break;
        case "buff":
          // Static Glide is an escape: take off when something is coming.
          if (a.glide) {
            if (s.threatened) score = 18;
          } else if (s.sight && reach(520)) score = 15;
          break;
        case "rest":
          // Shell Up protects, so it is for when you're hurt and under fire
          // (or safely away). It comes first: nothing else saves the round.
          if (a.status === "shell") {
            if (s.hpRatio < 0.6 && (s.threatened || s.dist > 430)) score = 100;
          } else if (s.hpRatio < 0.45 && s.dist > 430 && !s.threatened)
            score = 30;
          break;
        default: {
          // Only kinds without a `case` reach here: none of them may be in
          // BOT_SKILL_KINDS (a typecheck error names the one missing a case).
          const unhandled: Exclude<AbilityKind, BotSkillKind> = a.kind;
          void unhandled;
        }
      }
      if (!score) return;
      if (OFFENSIVE.has(a.kind) && a.bonusVsStatus && s.enemyDisabled)
        score *= a.bonusVsStatus;
      // Clever bots cash in their signature combo while the mark lasts.
      const combo = COMBOS[me.character];
      if (
        smart &&
        a.id === combo.payoff &&
        hasMark(combo.self ? me : enemy, me.id, t)
      )
        score *= 1.6;
      // The ultimate (last slot): clever bots save it for a finish or an opening.
      if (i === skills.length - 1 && smart) {
        const opening =
          s.enemyDisabled ||
          s.enemyRatio < 0.55 ||
          s.hpRatio < 0.3 ||
          enemy.recoveryUntil > t + 0.2;
        if (!opening) return;
        score *= 1.5;
      }
      const st = this.styleOf(me);
      if (st.slots) score *= st.slots[i] ?? 1;
      if (st.floor && score < st.floor) return;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best >= 0 && this.random() < this.profile.skillUse) {
      void target;
      return best;
    }
    return -1;
  }
}

/**
 * Rite choice by difficulty. Easy takes any card; Normal leans towards
 * majors; Hard scores each card for its own fighter, the rites it already
 * has and the opponent it's facing, and takes the best.
 */
export function chooseRite(
  difficulty: BotDifficulty,
  offer: string[],
  me: { character: CharacterId; rites?: string[] },
  enemy: { character: CharacterId } | undefined,
  random: () => number,
  crowd = false,
) {
  if (!offer.length) return undefined;
  if (difficulty === "easy") return offer[Math.floor(random() * offer.length)];
  if (difficulty === "normal") {
    const weights = offer.map((id) =>
      RITE_BY_ID[id]?.tier === "major" ? 3 : 1,
    );
    let roll = random() * weights.reduce((a, b) => a + b, 0);
    for (const [i, w] of weights.entries())
      if ((roll -= w) < 0) return offer[i];
    return offer[0];
  }
  let best = offer[0],
    bestScore = -Infinity;
  for (const id of offer) {
    // A little noise so two near-equal cards don't always go the same way.
    const score = riteValue(id, me, enemy, crowd) + random() * 0.02;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

/** How much control each status gives (roughly, per application). */
const STATUS_WEIGHT: Partial<Record<StatusKind, number>> = {
  stun: 1,
  freeze: 1,
  sleep: 0.9,
  paralysis: 0.8,
  burn: 0.45,
  root: 0.6,
  slow: 0.3,
  haste: 0.3,
};
/** The hit an ambush multiplies, for valuing a veil. */
const VEIL_OPENER = 25;
/** A zone that heals its owner's side each tick (a healing spring). */
const healing = (a: Ability) => a.kind === "zone" && !!a.heal;
const ticking = (a: Ability) =>
  !!a.tickInterval && (a.damage > 0 || healing(a));
const ticks = (a: Ability) =>
  ticking(a) ? Math.max(1, a.duration / a.tickInterval!) : 1;
/**
 * What one use is worth if everything lands: its damage, the healing of a
 * spring (in a duel only the owner's own share), and for a veil the ambush
 * it sets up (counted against a typical opening strike).
 */
const perUse = (a: Ability, crowd = false) =>
  a.turret
    ? // A lantern: one shot after tickDelay, then one per tickInterval.
      a.turret.damage *
      (Math.floor((a.duration - (a.tickDelay ?? 0)) / (a.tickInterval ?? 1)) +
        1)
    : a.damage *
        (a.count ?? 1) *
        ticks(a) *
        // Marksman shots average half their far bonus; a charge finds a wall about a third of the time.
        (1 + (a.farBonus ?? 0) / 2) *
        (a.wallSlam ? 1 + (a.wallSlam - 1) / 3 : 1) *
        // Life drain: the healing counts too (a little less than damage).
        (1 + (a.drain ?? 0) * 0.7) +
      (a.pop?.damage ?? 0) +
      (healing(a) ? a.heal! * ticks(a) * (crowd ? 1 : (a.selfHeal ?? 1)) : 0) +
      (a.kind === "veil" ? 10 + ((a.ambush ?? 1) - 1) * VEIL_OPENER : 0);
const pace = (a: Ability) => a.cooldown || a.interval || 1;

/**
 * Estimated strength a rite adds, as a fraction (0.25 ≈ a quarter stronger
 * on that ability), adjusted for the matchup.
 */
export function riteValue(
  id: string,
  me: { character: CharacterId; rites?: string[] },
  enemy: { character: CharacterId } | undefined,
  crowd = false,
) {
  const rite = RITE_BY_ID[id];
  if (!rite || rite.fighter !== me.character) return -1;
  const owned = me.rites ?? [];
  const a0 = kitAbility(me.character, owned, rite.skill);
  const a1 = kitAbility(me.character, [...owned, id], rite.skill);
  if (!a0 || !a1) return 0;
  const enemyBasic = enemy ? CHARACTERS[enemy.character].basic : undefined;
  const enemyMelee =
    enemyBasic?.kind === "melee" || enemyBasic?.kind === "cone";
  // Matchup: reach and control matter more against brawlers who close in;
  // area matters more when there are several targets.
  const reachW = enemyMelee ? 1.3 : 1;
  const controlW = enemyMelee ? 1.2 : 1;
  const areaW = crowd ? 1.3 : 1;
  const ratio = (x: number | undefined, y: number | undefined) =>
    x && y ? y / x - 1 : 0;
  let value = 0;
  // Damage (and healing) over time: per use, divided by how often it can be used.
  const p0 = perUse(a0, crowd) / pace(a0),
    p1 = perUse(a1, crowd) / pace(a1);
  value += p0 > 0 ? p1 / p0 - 1 : p1 > 0 ? 0.5 : 0;
  // A pure utility skill (a guard, a decoy) is worth more the more often it's up.
  if (!p0 && !p1) value += 0.6 * ratio(pace(a1), pace(a0));
  // A pull (negative knockback) drags its target in: stronger is more control.
  if (a0.knockback < 0 && a1.knockback < 0)
    value += 0.3 * ratio(-a0.knockback, -a1.knockback) * controlW;
  value += 0.5 * ratio(a0.range, a1.range) * reachW;
  value += 0.6 * ratio(a0.radius, a1.radius) * areaW;
  value += a0.explosion
    ? 0.6 * ratio(a0.explosion, a1.explosion) * areaW
    : a1.explosion
      ? 0.35 * areaW
      : 0;
  value += 0.4 * ratio(a0.speed, a1.speed);
  value += 1.2 * Math.max(0, a0.cast - a1.cast);
  if (!ticking(a1)) value += 0.4 * ratio(a0.duration, a1.duration);
  const s0 = a0.status ? (STATUS_WEIGHT[a0.status] ?? 0.3) : 0,
    s1 = a1.status ? (STATUS_WEIGHT[a1.status] ?? 0.3) : 0;
  value +=
    s1 !== s0
      ? (s1 - s0) * controlW
      : 0.3 * ratio(a0.statusDuration, a1.statusDuration);
  // A healing spring's heal is already in perUse.
  if (!healing(a1)) value += 0.8 * ratio(a0.heal, a1.heal);
  if ((a1.bonusVsStatus ?? 0) > (a0.bonusVsStatus ?? 0)) {
    // Worth more the more ways this kit has to inflict a harmful status.
    const kit = kitOf(me.character, owned);
    const sources = [kit.basic, ...kit.skills].filter(
      (k) => k.status && DEBUFFS.includes(k.status),
    ).length;
    value +=
      ((a1.bonusVsStatus ?? 0) - (a0.bonusVsStatus ?? 0)) *
      0.25 *
      (1 + 0.25 * sources);
  }
  // Basic attacks are used all the time; combo skills are a bot's best plays.
  const base = CHARACTERS[me.character];
  if (base.basic.id === rite.skill) value *= 1.2;
  const combo = COMBOS[me.character];
  if (combo.setup === rite.skill || combo.payoff === rite.skill) value += 0.1;
  // Upgrading a skill you've already upgraded stacks well.
  if (owned.some((o) => RITE_BY_ID[o]?.skill === rite.skill)) value += 0.05;
  return value;
}
