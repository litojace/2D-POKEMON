import {
  CHARACTERS,
  OBSTACLES,
  RULES,
  blankInput,
  blocked,
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
  type Ability,
  type CharacterId,
  type StatusKind,
  type Fighter,
  type Input,
  type Rect,
} from "../../../packages/shared/src/index.js";
import type { Arena } from "./simulation.js";
/**
 * Server-side AI opponent. Each tick it reads the arena the way a player
 * would (with a reaction delay and imperfect aim) and returns the same Input
 * a human client sends, so every cooldown and rule still applies to it.
 */
export const BOT_DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type BotDifficulty = (typeof BOT_DIFFICULTIES)[number];
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
}
export const BOT_PROFILES: Record<BotDifficulty, Profile> = {
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
  },
  normal: {
    reaction: 0.48,
    aimError: 0.27,
    lead: 0.2,
    dodge: 0.12,
    think: 0.25,
    skillUse: 0.42,
    hesitate: 0.18,
    smartUltimate: false,
    fooledByClone: 0.5,
    engage: 0.02,
    rest: 0.34,
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
  },
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
const DISABLES = ["stun", "freeze", "sleep", "paralysis"] as const;
const OFFENSIVE = new Set([
  "projectile",
  "charged",
  "barrage",
  "beam",
  "melee",
  "cone",
  "zone",
  "nova",
]);
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
type Point = { x: number; y: number };
/** Corners just outside every pillar: the waypoints for walking around cover. */
const CORNERS: Point[] = OBSTACLES.flatMap((o) => {
  const m = RULES.radius + 14;
  return [
    { x: o.x - m, y: o.y - m },
    { x: o.x + o.w + m, y: o.y - m },
    { x: o.x - m, y: o.y + o.h + m },
    { x: o.x + o.w + m, y: o.y + o.h + m },
  ];
});
/**
 * When cover blocks the view, the next corner to walk to: the shortest route
 * via one corner that sees both ends, else the visible corner nearest the goal.
 */
export function waypoint(
  clear: (a: Point, b: Point) => boolean,
  from: Point,
  goal: Point,
  obstacles: readonly Rect[] = OBSTACLES,
): Point | null {
  if (clear(from, goal)) return null;
  // Use the active room's wall corners, not the Classic arena's everywhere.
  const corners =
    obstacles === OBSTACLES
      ? CORNERS
      : obstacles.flatMap((o) => {
          const m = RULES.radius + 14;
          return [
            { x: o.x - m, y: o.y - m },
            { x: o.x + o.w + m, y: o.y - m },
            { x: o.x - m, y: o.y + o.h + m },
            { x: o.x + o.w + m, y: o.y + o.h + m },
          ];
        });
  let best: Point | null = null,
    bestCost = Infinity,
    fallback: Point | null = null,
    fallbackCost = Infinity;
  for (const c of corners) {
    if (blocked(c.x, c.y, RULES.radius, obstacles) || !clear(from, c)) continue;
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
  private wantSkill = -1;
  /** Projectile ids already judged (dodge or not) so it decides once per shot. */
  private judged = new Map<number, boolean>();
  private cloneDecision?: { until: number; fooled: boolean };
  constructor(
    readonly id: string,
    readonly difficulty: BotDifficulty,
    seed = 1,
  ) {
    this.profile = BOT_PROFILES[difficulty];
    this.random = rng(seed);
  }
  /** Forget per-round memory (positions, judged shots) at a new round. */
  reset() {
    this.seen = [];
    this.nextThink = 0;
    this.judged.clear();
    this.cloneDecision = undefined;
    this.wantSkill = -1;
  }
  think(arena: Arena, me: Fighter): Input {
    const input = blankInput();
    // An opponent (in a raid, the boss; never a teammate).
    const enemy =
      arena.players.find(
        (p) =>
          p.id !== me.id &&
          !p.out &&
          p.hp > 0 &&
          arena.teamOf(p) !== arena.teamOf(me),
      ) ?? arena.players.find((p) => p.id !== me.id);
    const t = arena.time;
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
    const hpRatio = me.hp / character.health,
      enemyRatio = enemy.hp / CHARACTERS[enemy.character].health;
    const enemyDisabled = DISABLES.some((k) => arena.has(enemy, k));
    // ---- Threats: shots that will hit soon, and big wind-ups nearby.
    let threat: {
      dx: number;
      dy: number;
      ground: boolean;
      big: boolean;
      eta: number;
    } | null = null;
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
        const a = kitOf(enemy.character, enemy.rites).skills[enemy.charge!.skill];
        return a.kind === "nova" &&
          Math.hypot(enemy.x - me.x, enemy.y - me.y) < a.radius + 40
          ? a
          : undefined;
      })();
    if (windup && !this.judged.has(-enemy.charge!.at))
      this.judged.set(-enemy.charge!.at, this.random() < this.profile.dodge);
    const fleeWindup = windup && this.judged.get(-enemy.charge!.at);
    // ---- Tactical decisions on a timer (slower bots decide less often).
    if (t >= this.nextThink) {
      this.nextThink = t + this.profile.think * (0.8 + this.random() * 0.4);
      if (t >= this.nextStrafeFlip) {
        this.strafe = this.random() < 0.5 ? -1 : 1;
        this.nextStrafeFlip = t + 0.9 + this.random() * 1.6;
      }
      this.hesitateUntil =
        this.random() < this.profile.hesitate ? t + this.profile.think : 0;
      // Brawlers cut the opponent off by heading for where it is going.
      const chase = melee
        ? {
            x: target.x + target.vx * 0.45 * this.profile.lead,
            y: target.y + target.vy * 0.45 * this.profile.lead,
          }
        : target;
      this.plan = this.choosePath(arena, me, chase, melee, hpRatio);
      // Closer to a useful orb than the opponent is: go and take it (healing
      // when hurt, energy when the ultimate is still charging).
      const orb = arena.orbs
        .filter((o) =>
          o.kind === "energy"
            ? (me.ult ?? 0) < RULES.ultMax * 0.7
            : hpRatio < 0.7,
        )
        .map((o) => ({ o, d: Math.hypot(o.x - me.x, o.y - me.y) }))
        .sort((a, b) => a.d - b.d)[0];
      if (
        orb &&
        orb.d < Math.hypot(orb.o.x - enemy.x, orb.o.y - enemy.y) + 80 &&
        this.random() < this.profile.skillUse + 0.2
      ) {
        const goal =
          waypoint((a, b) => arena.lineClear(a, b), me, orb.o, arena.walls()) ?? orb.o;
        const gd = Math.hypot(goal.x - me.x, goal.y - me.y) || 1;
        this.plan = { dx: (goal.x - me.x) / gd, dy: (goal.y - me.y) / gd };
      }
      this.wantSkill = this.chooseSkill(arena, me, enemy, target, {
        dist,
        sight,
        hpRatio,
        enemyRatio,
        enemyDisabled,
        threatened: !!threat || dist < 170,
      });
    }
    // ---- Movement.
    let { dx, dy } = this.plan;
    if (t < this.hesitateUntil) dx = dy = 0;
    if (fleeWindup) {
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
    // Get out of enemy zones (jump the ground ones if it can).
    for (const z of arena.zones)
      if (
        z.owner !== me.id &&
        Math.hypot(z.x - me.x, z.y - me.y) < z.radius + RULES.radius
      ) {
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
      }
    // Brawlers close the gap with a dash.
    if (
      melee &&
      !threat?.big &&
      sight &&
      dist > 120 &&
      dist < 290 &&
      t >= me.dashAt &&
      this.random() < this.profile.engage
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
    input.dx = clamp(dx, -1, 1);
    input.dy = clamp(dy, -1, 1);
    // ---- Aim: lead moving targets with projectiles, plus human-like spread.
    const projectileSpeed = basic.kind === "projectile" ? basic.speed : 0;
    const leadTime = projectileSpeed
      ? (dist / projectileSpeed) * this.profile.lead
      : 0;
    let ax = target.x + target.vx * leadTime,
      ay = target.y + target.vy * leadTime;
    const error = (this.random() * 2 - 1) * this.profile.aimError;
    const angle = Math.atan2(ay - me.y, ax - me.x) + error;
    const reach = Math.max(60, Math.hypot(ax - me.x, ay - me.y));
    ax = me.x + Math.cos(angle) * reach;
    ay = me.y + Math.sin(angle) * reach;
    input.aimX = clamp(ax, 0, RULES.width);
    input.aimY = clamp(ay, 0, RULES.height);
    // ---- Attack.
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
  ) {
    const basic = arena.kit(me).basic;
    const preferred = melee
      ? 70
      : clamp(basic.range * 0.5, 240, 400) + (hpRatio < 0.35 ? 90 : 0);
    const obstacles = arena.walls();
    const via = waypoint((a, b) => arena.lineClear(a, b), me, target, obstacles);
    let best = { dx: 0, dy: 0 },
      bestScore = -Infinity;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const dx = Math.cos(a),
        dy = Math.sin(a);
      const x = me.x + dx * 70,
        y = me.y + dy * 70;
      if (
        blocked(x, y, RULES.radius, obstacles) ||
        blocked(me.x + dx * 30, me.y + dy * 30, RULES.radius, obstacles)
      )
        continue;
      const d = Math.hypot(target.x - x, target.y - y);
      // Brawlers care most about closing in; shooters about range and sight.
      const now = Math.hypot(target.x - me.x, target.y - me.y);
      let score = via
        ? // Walking around cover: head for the corner.
          -Math.hypot(via.x - x, via.y - y) / 25
        : (-Math.abs(d - preferred) / 60) * (melee ? 2.6 : 1);
      if (arena.lineClear({ x, y }, target)) score += melee ? 1 : 2.2;
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
        (via ? 0.15 : melee && now > 180 ? 0.35 : 0.9);
      // Stay off the walls and out of hazards.
      const edge = Math.min(x, y, RULES.width - x, RULES.height - y);
      if (edge < 90) score -= (90 - edge) / 30;
      for (const z of arena.zones)
        if (
          z.owner !== me.id &&
          Math.hypot(z.x - x, z.y - y) < z.radius + RULES.radius
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
    const skills = arena.kit(me).skills;
    let best = -1,
      bestScore = 0;
    skills.forEach((a: Ability, i) => {
      if (!skillReady(me, i, t)) return;
      let score = 0;
      const reach = (range: number) => s.dist <= range;
      switch (a.kind) {
        case "projectile":
        case "charged":
        case "barrage":
        case "beam":
          if (s.sight && reach(a.range * 0.85)) score = a.damage;
          break;
        case "melee":
          if (s.sight && reach(a.range + RULES.radius)) score = a.damage * 1.2;
          break;
        case "cone":
          if (s.sight && reach(a.range * 0.9)) score = a.damage * 4;
          break;
        case "nova":
          if (s.sight && reach(a.radius + RULES.radius * 0.5))
            score = a.damage * 1.1;
          break;
        case "zone":
          if (a.follow) {
            if (reach(a.radius * 0.9)) score = a.damage * 5;
          } else if (reach(a.range))
            score = Math.max(a.damage, 10) * (s.enemyDisabled ? 1.6 : 1);
          break;
        case "counter":
        case "barrier":
          if (s.threatened) score = 18;
          break;
        case "clone":
          if (s.threatened && s.hpRatio < 0.7) score = 16;
          break;
        case "buff":
          if (s.sight && reach(520)) score = 15;
          break;
        case "rest":
          if (s.hpRatio < 0.45 && s.dist > 430 && !s.threatened) score = 30;
          break;
      }
      if (!score) return;
      if (OFFENSIVE.has(a.kind) && a.bonusVsStatus && s.enemyDisabled)
        score *= a.bonusVsStatus;
      // Clever bots cash in their signature combo while the mark lasts.
      const combo = COMBOS[me.character];
      if (
        this.profile.smartUltimate &&
        a.id === combo.payoff &&
        hasMark(combo.self ? me : enemy, me.id, t)
      )
        score *= 1.6;
      // The ultimate (last slot): clever bots save it for a finish or an opening.
      if (i === skills.length - 1 && this.profile.smartUltimate) {
        const opening =
          s.enemyDisabled ||
          s.enemyRatio < 0.55 ||
          s.hpRatio < 0.3 ||
          enemy.recoveryUntil > t + 0.2;
        if (!opening) return;
        score *= 1.5;
      }
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
    for (const [i, w] of weights.entries()) if ((roll -= w) < 0) return offer[i];
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
  slow: 0.3,
  haste: 0.3,
};
const ticking = (a: Ability) => !!a.tickInterval && a.damage > 0;
/** Damage one use deals if everything lands. */
const perUse = (a: Ability) =>
  a.damage *
  (a.count ?? 1) *
  (ticking(a) ? Math.max(1, a.duration / a.tickInterval!) : 1);
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
  // Damage over time: per use, divided by how often it can be used.
  const p0 = perUse(a0) / pace(a0),
    p1 = perUse(a1) / pace(a1);
  value += p0 > 0 ? p1 / p0 - 1 : p1 > 0 ? 0.5 : 0;
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
  value += 0.8 * ratio(a0.heal, a1.heal);
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
