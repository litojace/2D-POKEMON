import {
  RULES,
  blankInput,
  maxHealth,
  skillReady,
  ULT_SLOT,
  type Fighter,
  type Input,
  type Zone,
} from "../../../packages/shared/src/index.js";
import type { Arena } from "./simulation.js";
/**
 * Look-ahead for the expert bot (balance measurement only): at key moments
 * it copies the match, plays each of a few candidate actions about a second
 * into the future, and takes the one that comes out best. It needs no rule
 * for a skill: whatever a skill does, the copy plays it by the real rules,
 * so a new champion's new mechanic is used (and dodged) from the start.
 */

/** Seconds played ahead to weigh skills (long enough for a blast that lands late). */
export const SKILL_HORIZON = 1.4;
/** Seconds played ahead to weigh ways out of trouble. */
export const MOVE_HORIZON = 0.8;
/** Seconds between two searches. */
export const LOOK_EVERY = 0.25;
/** Seconds a chosen way of moving is kept before the rules take over again. */
const LOOK_COMMIT = 0.2;
/** How much a cooldown second costs (as a share of health), so a skill is not spent on nothing. */
const COOLDOWN_COST = 0.0015;
/** What spending the ultimate costs (a share of health): it waits for a real gain. */
const ULT_COST = 0.08;
/** Each second a fighter spends disabled (stunned, frozen...) counts as this much health. */
const DISABLED_WORTH = 0.15;
/** Ties go to what the rules wanted. */
const RULE_PRIOR = 0.005;
const DISABLED = ["stun", "freeze", "sleep", "paralysis", "root", "shell"];

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
/** Fields a copy starts empty (no bots, no queued network input, no events). */
const FRESH: Record<string, () => unknown> = {
  bots: () => new Map(),
  events: () => [],
  inputQueues: () => new Map(),
};
/**
 * A copy of the match that plays on by itself: the same state, its own
 * random numbers (so the real match's are untouched), no bots and nothing
 * shared with the original.
 */
export function cloneArena(arena: Arena, seed: number): Arena {
  const copy = Object.create(Object.getPrototypeOf(arena)) as Record<
    string,
    unknown
  >;
  for (const [key, value] of Object.entries(arena)) {
    if (FRESH[key]) copy[key] = FRESH[key]();
    else if (typeof value === "function") continue;
    else
      copy[key] =
        typeof value === "object" && value !== null
          ? structuredClone(value)
          : value;
  }
  copy.random = rng(seed);
  return copy as unknown as Arena;
}

type Candidate = {
  /** Input for the first tick (a skill, a dash or a jump happen here). */
  first: Input;
  /** Way it keeps walking afterwards. */
  dx: number;
  dy: number;
  /** What the skill it uses costs (a share of health). */
  cost: number;
  rule?: boolean;
  /** A way of moving the bot keeps for a moment if it is chosen. */
  move?: boolean;
};
export type LookChoice = {
  input: Input;
  /** Keep walking this way until `until` (a chosen way of moving). */
  commit?: { until: number; dx: number; dy: number };
};

/**
 * Something about to hurt it: a shot on its way, an enemy zone close by, a
 * wind-up. (The enemy merely being close is not: a brawler would then
 * spend the fight stepping away from every swing.)
 */
function inDanger(arena: Arena, me: Fighter, enemy: Fighter) {
  if (enemy.charge) return true;
  for (const pr of arena.projectiles) {
    if (pr.owner === me.id || !arena.rivals(pr.owner, me.id)) continue;
    const rx = me.x - pr.x,
      ry = me.y - pr.y;
    if (Math.hypot(rx, ry) < 420 && rx * pr.vx + ry * pr.vy > 0) return true;
  }
  return arena.zones.some(
    (z) =>
      arena.rivals(z.owner, me.id) &&
      Math.hypot(z.x - me.x, z.y - me.y) < z.radius + RULES.radius + 140,
  );
}

/**
 * Plays `c` from a copy of the match and scores the result: the share of
 * health the enemy lost minus the share it lost, a disabled fighter at the
 * end, a knockout, and the cooldown spent. The enemy is expected to go on
 * doing what it is doing (walking the same way, attacking, aiming at it).
 */
function playOut(
  arena: Arena,
  meId: string,
  enemyId: string,
  c: Candidate,
  horizon: number,
  seed: number,
  unseen: (z: Zone) => boolean,
) {
  const copy = cloneArena(arena, seed);
  // What it hasn't had time to notice yet isn't in its picture of the match.
  copy.zones = copy.zones.filter((z) => !unseen(z));
  const me = copy.players.find((p) => p.id === meId)!,
    enemy = copy.players.find((p) => p.id === enemyId)!;
  const myMax = maxHealth(me.character, copy.mode, copy.players.length),
    enemyMax = maxHealth(enemy.character, copy.mode, copy.players.length);
  const myHp = me.hp,
    enemyHp = enemy.hp;
  const theirs = enemy.lastInput;
  const ticks = Math.round(horizon * RULES.tick);
  const disabled = (p: Fighter) =>
    p.statuses.some((s) => s.until > copy.time && DISABLED.includes(s.kind));
  let held = 0;
  for (let i = 0; i < ticks && copy.phase === "playing"; i++) {
    // A copy: a tick writes to the input it is given (a skill once used).
    me.lastInput =
      i === 0
        ? { ...c.first }
        : {
            ...blankInput(),
            dx: c.dx,
            dy: c.dy,
            basic: c.first.basic,
            aimX: enemy.x,
            aimY: enemy.y,
          };
    enemy.lastInput = {
      ...blankInput(),
      dx: theirs.dx,
      dy: theirs.dy,
      basic: theirs.basic,
      aimX: me.x,
      aimY: me.y,
    };
    copy.tick();
    held += (disabled(enemy) ? 1 : 0) - (disabled(me) ? 1 : 0);
  }
  let score =
    (enemyHp - Math.max(0, enemy.hp)) / enemyMax -
    (myHp - Math.max(0, me.hp)) / myMax -
    c.cost +
    (held / RULES.tick) * DISABLED_WORTH;
  if (enemy.hp <= 0) score += 1;
  if (me.hp <= 0) score -= 1;
  if (c.rule) score += RULE_PRIOR;
  return score;
}

/** The best of `candidates`, each played `horizon` seconds ahead. */
function best(
  arena: Arena,
  me: Fighter,
  enemy: Fighter,
  candidates: Candidate[],
  horizon: number,
  seed: number,
  unseen: (z: Zone) => boolean,
) {
  let pick = candidates[0],
    top = -Infinity;
  for (const c of candidates) {
    const score = playOut(arena, me.id, enemy.id, c, horizon, seed, unseen);
    if (score > top) {
      top = score;
      pick = c;
    }
  }
  return pick;
}

/**
 * The expert's look-ahead, in two steps. Skills: what its rules chose this
 * tick, holding that skill back, or each other skill that is ready (the
 * ultimate too, at a price), played SKILL_HORIZON ahead so blasts that land
 * late still count. Then, when something threatens it, ways out: that
 * choice as it stands, or with eight ways to walk, plus a dash and a jump
 * along the best walk, played MOVE_HORIZON ahead. `unseen` names the zones
 * it hasn't had time to notice (a mark that has just appeared): the copies
 * leave them out, so it reacts no faster than its rules do. Undefined when
 * there was no reason to look.
 */
export function lookAhead(
  arena: Arena,
  me: Fighter,
  enemy: Fighter,
  rule: Input,
  random: () => number,
  unseen: (z: Zone) => boolean = () => false,
): LookChoice | undefined {
  const t = arena.time;
  const skills = arena.kit(me).skills;
  const busy = !!me.charge || !!me.channel || t < me.recoveryUntil;
  const ready = busy
    ? []
    : skills
        .map((_, i) => i)
        .filter((i) => skillReady(me, i, t) && i !== rule.skill);
  const near = Math.hypot(enemy.x - me.x, enemy.y - me.y) < 900;
  const choosing = near && (ready.length > 0 || (!busy && rule.skill >= 0));
  const danger = inDanger(arena, me, enemy);
  if (!choosing && !danger) return;
  const seed = Math.floor(random() * 2 ** 31);
  const costOf = (slot: number) =>
    slot < 0
      ? 0
      : slot === ULT_SLOT
        ? ULT_COST
        : (skills[slot]?.cooldown ?? 0) * COOLDOWN_COST;
  let pick: Candidate = {
    first: rule,
    dx: rule.dx,
    dy: rule.dy,
    cost: costOf(rule.skill),
    rule: true,
  };
  if (choosing) {
    const options = [pick];
    if (rule.skill >= 0)
      options.push({
        ...pick,
        first: { ...rule, skill: -1 },
        cost: 0,
        rule: false,
      });
    for (const slot of ready)
      options.push({
        ...pick,
        first: { ...rule, skill: slot },
        cost: costOf(slot),
        rule: false,
      });
    pick = best(arena, me, enemy, options, SKILL_HORIZON, seed, unseen);
  }
  if (danger) {
    const walks: Candidate[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2,
        dx = Math.cos(a),
        dy = Math.sin(a);
      walks.push({
        first: { ...pick.first, dx, dy, dash: false, jump: false },
        dx,
        dy,
        cost: pick.cost,
        move: true,
      });
    }
    const walk = best(arena, me, enemy, walks, MOVE_HORIZON, seed, unseen);
    const options = [pick, walk];
    if (t >= me.dashAt)
      options.push({ ...walk, first: { ...walk.first, dash: true } });
    if (t >= me.jumpAt && t >= me.jumpUntil)
      options.push({ ...walk, first: { ...walk.first, jump: true } });
    pick = best(arena, me, enemy, options, MOVE_HORIZON, seed, unseen);
  }
  return {
    input: pick.first,
    commit: pick.move
      ? { until: t + LOOK_COMMIT, dx: pick.dx, dy: pick.dy }
      : undefined,
  };
}
