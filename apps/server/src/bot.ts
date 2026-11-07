import {
  CHARACTERS,
  maxHealth,
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
  farMultiplier,
  platesOf,
  type Ability,
  type CharacterId,
  type StatusKind,
  type Fighter,
  type Input,
  type Zone,
  RING_KINDS,
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
  /**
   * Counts any shot about to hit as a threat for defensive skills (barriers,
   * counters, clones), not only the ones it decided to dodge. Without it a
   * bot that rarely dodges also rarely shields, which made champions with a
   * barrier far weaker at Normal than at Hard.
   */
  seeShots?: boolean;
  /**
   * Chance each second to lose focus for that second: no moving, attacking
   * or skills (it still sees what is coming). Unlike `rest`, which only holds
   * the basic attack, this slows every kind of champion down alike.
   */
  daze?: number;
  /** Per-champion daze (overrides `daze` for that champion). */
  dazeBy?: Partial<Record<CharacterId, number>>;
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
  // Normal is Hard with slower reactions, more pauses and looser aim, and a
  // per-champion share of "dazed" seconds (dazeBy). Every weakness a bot can
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
    fooledByClone: 0.5,
    engage: 0.02,
    rest: 0.12,
    seeShots: true,
    dazeBy: {
      voltkit: 0.17,
      cindrake: 0.41,
      tidefin: 0.18,
      auralynx: 0.3,
      lumoth: 0.17,
      mystowl: 0.18,
      terradon: 0.3,
      duskveil: 0.27,
      coilemur: 0.32,
      pyranda: 0.38,
      glacelle: 0.26,
      halcyra: 0.19,
      sunbara: 0.23,
      astrabun: 0.32,
      wombolder: 0.36,
      shadopus: 0.28,
      pangrove: 0.39,
      mossloth: 0.485,
    },
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
const DISABLES = ["stun", "freeze", "sleep", "shell", "paralysis", "root"] as const;
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
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
type Point = { x: number; y: number };
/**
 * Zones worth keeping out of: an opponent's, unless it only heals its own
 * side. A teammate's zone (2v2) never hurts, and a healing spring helps.
 */
export function hostileZone(arena: Arena, me: Fighter, z: Zone) {
  if (z.owner === me.id) return false;
  const owner = arena.players.find((p) => p.id === z.owner);
  if (owner && arena.teamOf(owner) === arena.teamOf(me)) return false;
  const a = z.ability;
  // A Crystal Cage is a wall, not a hazard: fight on inside it.
  if (a.kind === "cage") return false;
  return !a.heal || a.damage > 0 || !!a.status || !!a.knockback || !!a.turret;
}
/** The circle a bot keeps out of: a current is a lane, so its middle and half its length. */
function zoneArea(z: Zone) {
  if (z.ability.kind !== "current") return { x: z.x, y: z.y, radius: z.radius };
  const half = z.ability.range / 2;
  return {
    x: z.x + Math.cos(z.angle ?? 0) * half,
    y: z.y + Math.sin(z.angle ?? 0) * half,
    radius: Math.max(z.radius, half * 0.6),
  };
}
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
): Point | null {
  if (clear(from, goal)) return null;
  let best: Point | null = null,
    bestCost = Infinity,
    fallback: Point | null = null,
    fallbackCost = Infinity;
  for (const c of CORNERS) {
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
        for (const p of foes) {
          const share =
            p.hp / maxHealth(p.character, arena.mode, arena.players.length);
          const cost =
            Math.hypot(p.x - me.x, p.y - me.y) * (0.5 + 0.5 * share) +
            (arena.lineClear(me, p) ? 0 : 200) +
            (arena.has(p, "stealth") ? 300 : 0) -
            (p === current ? 150 : 0);
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
  think(arena: Arena, me: Fighter): Input {
    const input = blankInput();
    // An opponent (in a raid, the boss; never a teammate).
    const enemy = this.pickTarget(arena, me);
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
    const hpRatio = me.hp / maxHealth(me.character, arena.mode, arena.players.length),
      enemyRatio = enemy.hp / maxHealth(enemy.character, arena.mode, arena.players.length);
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
        const a = kitOf(enemy.character, enemy.rites).skills[enemy.charge!.skill];
        // A blast ring, a cage about to rise, or rays about to turn.
        const reach =
          a.kind === "lighthouse" ? a.range : RING_KINDS.includes(a.kind) ? a.radius : 0;
        return reach > 0 &&
          Math.hypot(enemy.x - me.x, enemy.y - me.y) < reach + 40
          ? a
          : undefined;
      })();
    if (windup && !this.judged.has(-enemy.charge!.at))
      this.judged.set(-enemy.charge!.at, this.random() < this.profile.dodge);
    const fleeWindup = windup && this.judged.get(-enemy.charge!.at);
    // A dazed second: it stands still and holds everything.
    const daze = this.profile.dazeBy?.[me.character] ?? this.profile.daze;
    if (daze) {
      if (t >= this.nextDaze) {
        this.nextDaze = t + 1;
        this.dazed = this.random() < daze;
      }
      if (this.dazed) return input;
    }
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
          waypoint((a, b) => arena.lineClear(a, b), me, orb.o) ?? orb.o;
        const gd = Math.hypot(goal.x - me.x, goal.y - me.y) || 1;
        this.plan = { dx: (goal.x - me.x) / gd, dy: (goal.y - me.y) / gd };
      }
      this.wantSkill = this.chooseSkill(arena, me, enemy, target, {
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
    let escaping = false;
    for (const zone of arena.zones)
      if (
        hostileZone(arena, me, zone) &&
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
    // A seedling goes down part of the way toward the opponent, to grow
    // before it gets there (not under its feet, where it would go off unripe).
    if (
      this.wantSkill >= 0 &&
      arena.kit(me).skills[this.wantSkill]?.kind === "seedling"
    ) {
      ax = me.x + (ax - me.x) * 0.45;
      ay = me.y + (ay - me.y) * 0.45;
    }
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
          // A marksman's shot (farBonus) is worth more the farther away they are.
          if (s.sight && reach(a.range * 0.85))
            score = a.damage * farMultiplier(a, s.dist) * (a.boomerang ? 1.6 : 1);
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
          const ranged = CHARACTERS[enemy.character].basic.kind !== "melee" &&
            CHARACTERS[enemy.character].basic.kind !== "cone";
          if (s.threatened || (ranged && s.dist > 220 && s.sight)) score = 18;
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
          // Gill Siphon: lock on while the target is in reach.
          if (s.sight && reach(a.range * 0.95))
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
        case "lighthouse":
          // Radiant Flare: rays turning round it while the target is near.
          if (s.sight && reach(a.range * 0.8)) score = a.damage * 5;
          break;
        case "current":
          // Undertow: sweep the target away (it flows along the aim).
          if (s.sight && reach(a.range * 0.8)) score = 16;
          break;
        case "trail":
          // Spark Trail: lay it while closing in or circling a nearby target.
          if (reach(260)) score = 15 + a.damage;
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
        case "roll":
          // Curl up and steer in for a ram from a distance (a rooted ball goes nowhere).
          if (s.sight && s.dist > 160 && reach(650) && !arena.has(me, "root"))
            score = 20;
          break;
        case "pinball":
          if (s.sight && reach(700) && !arena.has(me, "root"))
            score = a.damage * 2;
          break;
        case "seedling": {
          // Keep a few seedlings growing between itself and the opponent.
          const mine = arena.zones.filter(
            (z) => z.owner === me.id && z.ability.kind === "seedling" && z.until > t,
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
            score += 8 * arena.zones.filter(
              (z) => z.owner === me.id && z.ability.kind === "seedling" && z.until > t,
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
      (Math.floor((a.duration - (a.tickDelay ?? 0)) / (a.tickInterval ?? 1)) + 1)
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
