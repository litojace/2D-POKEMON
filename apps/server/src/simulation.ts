import {
  CHARACTERS,
  ARENAS,
  ARENA_ROTATION,
  COMBOS,
  hazardAbility,
  hazardIn,
  obstaclesAt,
  shiftingUp,
  useObstacles,
  useSpeedScale,
  FIGHTER_IDS,
  type ArenaId,
  type Hazard,
  RITE_BY_ID,
  RITE_RULES,
  kitOf,
  riteOffer,
  DEBUFFS,
  hasMark,
  MODE_SIZE,
  MODE_MIN,
  ORB_SPOTS,
  CROWN,
  TEAMUP,
  ELEMENT_GIFTS,
  MUTATOR_RULES,
  roundsNeeded,
  type MutatorId,
  RING,
  ringRadius,
  RULES,
  SKILL_SLOTS,
  STATUS_RULES,
  ULT_SLOT,
  skillReady,
  basicInterval,
  advanceMovement,
  blankInput,
  emptyStats,
  blocked,
  move,
  normalize,
  type Ability,
  type CharacterId,
  type Fighter,
  type GameEvent,
  type Input,
  type MatchMode,
  type Orb,
  type Phase,
  type Team,
  type Projectile,
  type Snapshot,
  type StatusKind,
  type Zone,
} from "../../../packages/shared/src/index.js";
import type { BotBrain } from "./bot.js";
/** Free-for-all starting corners (seat order), opposite corners first. */
const FFA_SPAWNS = [
  { x: 260, y: 250 },
  { x: 1340, y: 650 },
  { x: 1340, y: 250 },
  { x: 260, y: 650 },
];
/** Seconds between overtime / closing-ring damage ticks. */
const DRAIN_INTERVAL = 0.5;
export class Arena {
  practice: Snapshot["practice"] = null;
  /** AI opponents in this room, by fighter id (solo vs bot). */
  bots = new Map<string, BotBrain>();
  nextPracticeZone = 0;
  time = 0;
  phase: Phase = "lobby";
  previousPhase: Phase = "playing";
  deadline = 0;
  round = 1;
  scores: Record<string, number> = {};
  winner: string | null = null;
  roundWinner: string | null = null;
  mode: MatchMode = "duel";
  teamScores: number[] = [0, 0];
  winnerTeam: Team | null = null;
  roundWinnerTeam: Team | null = null;
  overtime = false;
  /** Crown Hill: seconds each side has held the circle this round. */
  crown: number[] = [];
  /** Fighter roulette: the fighter each player picked, restored in the lobby. */
  chosen = new Map<string, CharacterId>();
  /** Round winners in order (null = draw). */
  roundLog: (Team | null)[] = [];
  /** Id of the last finished real match (players report it for records). */
  matchId: string | null = null;
  /** Rites: random source for offers. Seeded per room so bot replays repeat. */
  random: () => number;
  roundEndedAt = 0;
  /** Arena for this match. Real rooms rotate (`rotateArenas`); tests stay on Classic. */
  arenaId: ArenaId = "classic";
  rotateArenas = false;
  private arenaTurn = -1;
  /** When the live round began: hazards and the shifting wall run from here. */
  hazardClock = 0;
  players: Fighter[] = [];
  projectiles: Projectile[] = [];
  zones: Zone[] = [];
  orbs: Orb[] = [];
  nextOrb = 0;
  private orbTurn = 0;
  private orbWave = 0;
  /** Next overtime / ring damage tick. */
  private nextDrain = 0;
  events: GameEvent[] = [];
  serial = 0;
  constructor(
    public code: string,
    mode: MatchMode = "duel",
  ) {
    this.mode = mode;
    // Small seeded generator (mulberry32) keyed on the room code.
    let seed = [...code].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
    this.random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** Back to the lobby: everyone gets the fighter they picked again. */
  restoreChosen() {
    for (const p of this.players) {
      const picked = this.chosen.get(p.id);
      if (picked) p.character = picked;
    }
    this.chosen.clear();
  }
  /** Party rules the host switched on (lobby only). */
  mutators = new Set<MutatorId>();
  rule(m: MutatorId) {
    return this.mutators.has(m);
  }
  /** Round wins needed (best of five, or best of three with Quick match). */
  get roundsToWin() {
    return roundsNeeded([...this.mutators]);
  }
  /** Seconds between orbs (Orb rain halves it). */
  get orbInterval() {
    return RULES.orbInterval / (this.rule("orbs") ? MUTATOR_RULES.orbsRate : 1);
  }
  /** Most players this room holds: 2 for a duel, 4 for 2v2 or free-for-all. */
  get size() {
    return MODE_SIZE[this.mode];
  }
  /** Players needed to start (a free-for-all starts with three or four). */
  get minPlayers() {
    return MODE_MIN[this.mode];
  }
  /** Sides in play: two, or one per fighter in a free-for-all. */
  get sides(): Team[] {
    return this.mode === "ffa" ? this.players.map((_, i) => i) : [0, 1];
  }
  teamOf(p: Fighter): Team {
    if (this.mode === "ffa") return p.team ?? this.players.indexOf(p);
    return p.team ?? (this.players.indexOf(p) % 2 === 0 ? 0 : 1);
  }
  /** Everyone on the other team who is still in the match. */
  enemiesOf(p: Fighter) {
    const team = this.teamOf(p);
    return this.players.filter(
      (o) => o !== p && this.teamOf(o) !== team && !o.out,
    );
  }
  /** Enemies of whoever owns a projectile or zone (by id). */
  enemiesOfOwner(owner: string) {
    const p = this.players.find((o) => o.id === owner);
    return p ? this.enemiesOf(p) : this.players.filter((o) => o.id !== owner);
  }
  /** 2v2: is this fighter's partner standing close enough to team up? */
  teamedUp(p: Fighter) {
    return !!this.partnerNear(p);
  }
  /** 2v2: the partner standing close enough to team up, if any. */
  partnerNear(p: Fighter) {
    if (this.mode !== "teams" || p.hp <= 0 || p.out) return undefined;
    const team = this.teamOf(p);
    return this.players.find(
      (o) =>
        o !== p &&
        !o.out &&
        o.hp > 0 &&
        this.teamOf(o) === team &&
        Math.hypot(o.x - p.x, o.y - p.y) <= TEAMUP.range,
    );
  }
  /** The element gift this fighter gets from a nearby partner (2v2). */
  gift(p: Fighter, element: string) {
    const partner = this.partnerNear(p);
    return partner && CHARACTERS[partner.character].element === element
      ? ELEMENT_GIFTS[element].value
      : undefined;
  }
  /** Members of a team still standing this round. */
  standing(team: Team) {
    return this.players.filter(
      (p) => this.teamOf(p) === team && !p.out && p.hp > 0,
    );
  }
  add(id: string, name: string, character: CharacterId = "voltkit"): Fighter {
    const p: Fighter = {
      id,
      name,
      character,
      connected: true,
      ready: false,
      hp: CHARACTERS[character].health,
      x: 260,
      y: 450,
      vx: 0,
      vy: 0,
      angle: 0,
      ack: 0,
      cooldowns: Array(SKILL_SLOTS).fill(0),
      ult: 0,
      basicAt: 0,
      dashAt: 0,
      jumpAt: 0,
      dashUntil: 0,
      jumpUntil: 0,
      dashX: 0,
      dashY: 0,
      statuses: [],
      immuneUntil: 0,
      recoveryUntil: 0,
      stats: emptyStats(),
      lastInput: blankInput(),
    };
    // Join the smaller team (a duel ends up Blue vs Red); free-for-all:
    // everyone is their own side.
    const blue = this.players.filter((o) => this.teamOf(o) === 0).length;
    p.team =
      this.mode === "ffa"
        ? this.players.length
        : blue <= this.players.length - blue
          ? 0
          : 1;
    this.players.push(p);
    this.scores[id] = 0;
    return p;
  }
  event(
    kind: GameEvent["kind"],
    p: { x: number; y: number },
    color: number,
    value?: number,
    owner?: string,
    abilityId?: string,
  ) {
    this.events.push({
      id: ++this.serial,
      kind,
      x: p.x,
      y: p.y,
      color,
      value,
      owner,
      abilityId,
    });
    if (this.events.length > 80) this.events.shift();
  }
  instructionsReady: string[] = [];
  acknowledgeInstructions(id: string) {
    if (
      this.phase !== "briefing" ||
      !this.players.some((p) => p.id === id && p.connected)
    )
      return false;
    if (!this.instructionsReady.includes(id)) this.instructionsReady.push(id);
    if (
      this.players.length >= this.minPlayers &&
      this.players.every(
        (p) => p.out || (p.connected && this.instructionsReady.includes(p.id)),
      )
    ) {
      this.phase = "countdown";
      this.deadline = this.time + RULES.countdown;
    }
    return true;
  }
  start() {
    // Remember picks (rematches keep the first ones) before roulette changes them.
    for (const p of this.players)
      if (!this.chosen.has(p.id)) this.chosen.set(p.id, p.character);
    if (this.rule("calm")) this.arenaId = "classic";
    else if (this.rotateArenas && !this.practice) {
      if (this.arenaTurn < 0)
        this.arenaTurn = Math.floor(this.random() * ARENA_ROTATION.length);
      this.arenaId = ARENA_ROTATION[this.arenaTurn++ % ARENA_ROTATION.length];
    }
    this.scores = Object.fromEntries(this.players.map((p) => [p.id, 0]));
    this.round = 1;
    this.winner = null;
    this.roundWinner = null;
    // Free-for-all: seat order is each fighter's side.
    if (this.mode === "ffa") this.players.forEach((p, i) => (p.team = i));
    this.teamScores = this.sides.map(() => 0);
    this.winnerTeam = null;
    this.roundWinnerTeam = null;
    this.roundLog = [];
    this.matchId = null;
    for (const p of this.players) {
      p.stats = emptyStats();
      p.ult = 0;
      p.rites = [];
      p.riteOffer = undefined;
    }
    this.resetRound();
    // Bots have read the instructions; the match starts when the human confirms.
    this.instructionsReady = [...this.bots.keys()];
    this.phase = "briefing";
  }
  resetPractice() {
    this.start();
    this.phase = "playing";
    this.deadline = 0;
    this.players[0].x = 650;
    this.players[0].y = 180;
    this.players[1].x = 950;
    this.players[1].y = 180;
    this.nextPracticeZone = this.time + 3;
  }
  resetRound() {
    // Fighter roulette: a fresh random fighter for everyone each round.
    if (this.rule("random") && !this.practice)
      for (const p of this.players) {
        p.character = FIGHTER_IDS[Math.floor(this.random() * FIGHTER_IDS.length)];
        p.rites = [];
      }
    this.projectiles = [];
    this.zones = [];
    this.overtime = false;
    this.crown = this.sides.map(() => 0);
    const slot = [0, 0];
    for (const p of this.players) {
      const team = this.teamOf(p),
        index = this.mode === "ffa" ? 0 : slot[team]++;
      // Duel: one each side. 2v2: partners side by side, a lane apart.
      // Free-for-all: one corner each, facing the middle.
      const spot =
        this.mode === "ffa"
          ? FFA_SPAWNS[team % FFA_SPAWNS.length]
          : {
              x: team === 0 ? 260 : 1340,
              y: this.mode === "teams" ? (index === 0 ? 330 : 570) : 450,
            };
      Object.assign(p, {
        hp: p.out ? 0 : CHARACTERS[p.character].health,
        x: spot.x,
        y: spot.y,
        vx: 0,
        vy: 0,
        angle:
          this.mode === "ffa"
            ? Math.atan2(450 - spot.y, 800 - spot.x)
            : team === 0
              ? 0
              : Math.PI,
        cooldowns: Array(SKILL_SLOTS).fill(0),
        basicAt: 0,
        dashAt: 0,
        jumpAt: 0,
        dashUntil: 0,
        jumpUntil: 0,
        statuses: [],
        immuneUntil: 0,
        recoveryUntil: 0,
        charge: undefined,
        channel: undefined,
        clone: undefined,
        lastInput: blankInput(),
      });
    }
    for (const brain of this.bots.values()) brain.reset();
    this.orbs = [];
    this.orbTurn = 0;
    this.orbWave = 0;
    this.nextDrain = 0;
    this.nextOrb =
      this.time +
      RULES.countdown +
      RULES.orbFirst / (this.rule("orbs") ? MUTATOR_RULES.orbsRate : 1);
    this.phase = "countdown";
    this.deadline = this.time + RULES.countdown;
  }
  submit(p: Fighter, input: Input) {
    if (this.phase !== "playing" || input.seq <= p.ack) return;
    p.ack = input.seq;
    p.lastInput = {
      ...input,
      basic: input.basic || p.lastInput.basic,
      dash: input.dash || p.lastInput.dash,
      jump: input.jump || p.lastInput.jump,
      skill: input.skill >= 0 ? input.skill : p.lastInput.skill,
    };
  }
  status(p: Fighter, kind: StatusKind, duration: number, by?: string) {
    if (["stun", "freeze", "paralysis"].includes(kind)) {
      if (this.time < p.immuneUntil) return;
      p.immuneUntil = this.time + duration + STATUS_RULES.crowdControlImmunity;
    }
    // Combo marks from different fighters (2v2) live side by side.
    const old = p.statuses.find(
      (s) => s.kind === kind && (kind !== "mark" || s.by === by),
    );
    if (old) {
      old.until = Math.max(old.until, this.time + duration);
      if (by) old.by = by;
    } else
      p.statuses.push({
        kind,
        until: this.time + duration,
        nextTick: this.time + STATUS_RULES.burnInterval,
        ...(by ? { by } : {}),
      });
  }
  /** This fighter's abilities with their rites applied. */
  kit(p: Fighter) {
    return kitOf(p.character, p.rites);
  }
  /**
   * Deal rite choices for the coming round; bots choose straight away.
   * Everyone who lost the round (not on `wonTeam`) gets an extra choice.
   */
  offerRites(wonTeam: Team | null) {
    for (const p of this.players) {
      if (p.out) continue;
      const extra =
        wonTeam !== null && this.teamOf(p) !== wonTeam
          ? RITE_RULES.comebackChoices
          : 0;
      const offer = riteOffer(
        p.character,
        p.rites ?? [],
        this.round + 1,
        this.random,
        extra,
      );
      p.riteOffer = offer.length ? offer : undefined;
      if (p.riteOffer && this.bots.has(p.id))
        this.pickRite(p.id, this.botRite(p.riteOffer));
    }
  }
  /** Bots favour majors, otherwise any. */
  botRite(offer: string[]) {
    const weights = offer.map((id) =>
      RITE_BY_ID[id]?.tier === "major" ? 3 : 1,
    );
    let roll = this.random() * weights.reduce((a, b) => a + b, 0);
    for (const [i, w] of weights.entries()) if ((roll -= w) < 0) return offer[i];
    return offer[0];
  }
  /** A player picks one of their offered rites. */
  pickRite(id: string, riteId: string) {
    const p = this.players.find((q) => q.id === id);
    if (this.phase !== "intermission" || !p?.riteOffer?.includes(riteId))
      return false;
    p.rites = [...(p.rites ?? []), riteId];
    p.riteOffer = undefined;
    // Everyone has chosen: move on soon (but let the result be read).
    if (this.players.every((q) => !q.riteOffer))
      this.deadline = Math.min(
        this.deadline,
        Math.max(this.time + 1, this.roundEndedAt + RITE_RULES.minSeconds),
      );
    return true;
  }
  has(p: Fighter, kind: StatusKind) {
    return p.statuses.some((s) => s.kind === kind && s.until > this.time);
  }
  /** Add ultimate charge, capped at the meter's size. */
  chargeUlt(p: Fighter, amount: number) {
    if (this.phase !== "playing" && this.phase !== "intermission") return;
    if (this.rule("turbo")) amount *= MUTATOR_RULES.turboUlt;
    amount *= this.gift(p, "Psychic") ?? 1;
    p.ult = Math.min(RULES.ultMax, (p.ult ?? 0) + amount);
  }
  damage(target: Fighter, amount: number, owner: string, ability?: Ability) {
    this.walls();
    if (target.hp <= 0 || this.phase !== "playing") return;
    if (ability?.ground && target.jumpUntil > this.time) return;
    const source = this.players.find((p) => p.id === owner);
    const counter = this.has(target, "counter");
    if (amount > 0)
      target.statuses = target.statuses.filter((s) => s.kind !== "stealth");
    let dealt = amount;
    if (ability && source && this.has(source, "empower"))
      dealt *= STATUS_RULES.empowerDamage;
    let comboName: string | undefined;
    if (
      ability?.bonusVsStatus &&
      target.statuses.some(
        (s) => s.until > this.time && DEBUFFS.includes(s.kind),
      )
    ) {
      dealt *= ability.bonusVsStatus;
      if (source && COMBOS[source.character].payoff === ability.id)
        comboName = COMBOS[source.character].name;
    }
    // Signature combo payoff: the setup's mark is cashed in for a bonus.
    const combo =
      source && source !== target && ability
        ? COMBOS[source.character]
        : undefined;
    const primed =
      !!combo &&
      !combo.anyDebuff &&
      ability?.id === combo.payoff &&
      hasMark(combo.self ? source! : target, source!.id, this.time);
    if (primed) {
      comboName = combo!.name;
      dealt *= combo!.damage ?? 1;
      if (!combo!.self)
        target.statuses = target.statuses.filter(
          (s) => !(s.kind === "mark" && s.by === source!.id),
        );
    }
    if (counter) dealt *= STATUS_RULES.counterReduction;
    if (this.has(target, "shield")) dealt *= STATUS_RULES.shieldReduction;
    if (this.has(target, "sleep")) dealt *= STATUS_RULES.sleepVulnerability;
    if (this.rule("glass")) dealt *= MUTATOR_RULES.glassDamage;
    if (source && source !== target && this.teamedUp(source)) {
      dealt *= TEAMUP.damage;
      dealt *= this.gift(source, "Fire") ?? 1;
      if (
        target.statuses.some(
          (s) => s.until > this.time && DEBUFFS.includes(s.kind),
        )
      )
        dealt *= this.gift(source, "Shadow") ?? 1;
    }
    dealt *= this.gift(target, "Aura") ?? 1;
    dealt = Math.min(target.hp, dealt);
    target.hp = Math.max(0, target.hp - dealt);
    target.stats.received += dealt;
    if (source) source.stats.dealt += dealt;
    if (
      source &&
      dealt > 0 &&
      target.hp <= 0 &&
      this.teamOf(source) !== this.teamOf(target)
    )
      source.stats.kos = (source.stats.kos ?? 0) + 1;
    if (source && comboName)
      source.stats.combos = (source.stats.combos ?? 0) + 1;
    if (dealt > 0) {
      this.chargeUlt(target, dealt * RULES.ultPerDamageTaken);
      if (source && source !== target) {
        this.chargeUlt(source, dealt * RULES.ultPerDamageDealt);
        // Landed basic attacks trim the other skills' remaining cooldowns.
        if (ability?.id === CHARACTERS[source.character].basic.id)
          for (let k = 0; k < ULT_SLOT; k++)
            if (source.cooldowns[k] > this.time)
              source.cooldowns[k] = Math.max(
                this.time,
                source.cooldowns[k] - RULES.basicHitCooldownCut,
              );
      }
    }
    this.event(
      "hit",
      target,
      CHARACTERS[target.character].color,
      Math.round(dealt),
      undefined,
      ability?.id,
    );
    Object.assign(this.events[this.events.length - 1], {
      target: target.id,
      source: owner,
      ko: target.hp <= 0,
      ...(comboName ? { combo: comboName } : {}),
    });
    if (counter && source && source !== target && source.hp > 0) {
      const reflected = Math.min(
        source.hp,
        amount * STATUS_RULES.counterReflection,
      );
      source.hp -= reflected;
      source.stats.received += reflected;
      target.stats.dealt += reflected;
      this.event(
        "hit",
        source,
        CHARACTERS[target.character].color,
        Math.round(reflected),
      );
    }
    // Setup: mark the target for this fighter's payoff (or the guard for
    // Mirror Guard, which primes the one who absorbed the hit).
    if (combo && !combo.self && !combo.anyDebuff && ability?.id === combo.setup)
      this.status(target, "mark", combo.window, source!.id);
    if (counter && source && source !== target) {
      const guard = COMBOS[target.character];
      if (guard.onAbsorb) this.status(target, "mark", guard.window, target.id);
    }
    const status = primed && combo!.status ? combo!.status : ability?.status;
    if (status)
      this.status(
        target,
        status,
        (primed && combo!.status
          ? combo!.statusDuration
          : ability?.statusDuration) ?? 1,
        owner,
      );
    if (ability && source && ability.knockback) {
      const push =
        ability.knockback *
        (primed ? (combo!.knockback ?? 1) : 1) *
        (this.gift(target, "Earth") ?? 1);
      const dir = normalize(target.x - source.x, target.y - source.y);
      move(target, dir.x * push, dir.y * push);
    }
  }
  /** Enemy is in front of `p` within `range` and the cosine threshold `arc`. */
  inArc(p: Fighter, enemy: Fighter, range: number, arc: number) {
    const distance = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    const dot = Math.cos(Math.atan2(enemy.y - p.y, enemy.x - p.x) - p.angle);
    return (
      distance < range + RULES.radius &&
      (distance < RULES.radius || dot > arc) &&
      this.lineClear(p, enemy)
    );
  }
  cast(p: Fighter, a: Ability) {
    this.walls();
    p.statuses = p.statuses.filter((s) => s.kind !== "stealth");
    const color = CHARACTERS[p.character].color;
    const angle = p.angle;
    const enemies = this.enemiesOf(p);
    this.event("cast", p, color, undefined, p.id, a.id);
    const combo = COMBOS[p.character];
    const selfPrimed =
      !!combo.self && a.id === combo.payoff && hasMark(p, p.id, this.time);
    if (combo.self && !combo.onAbsorb && a.id === combo.setup)
      // A longer Kindle (rite) keeps its combo for as long as it lasts.
      this.status(
        p,
        "mark",
        a.kind === "buff" ? Math.max(combo.window, a.duration) : combo.window,
        p.id,
      );
    const projectile = (offset: number) => {
      if (this.projectiles.length >= RULES.maxProjectiles) return;
      this.projectiles.push({
        id: ++this.serial,
        owner: p.id,
        x: p.x + Math.cos(angle + offset) * 30,
        y: p.y + Math.sin(angle + offset) * 30,
        vx: Math.cos(angle + offset) * a.speed,
        vy: Math.sin(angle + offset) * a.speed,
        remaining: a.range,
        ability: a,
        color,
      });
    };
    if (a.kind === "projectile" || a.kind === "charged") projectile(0);
    if (a.kind === "barrage")
      for (let i = 0; i < (a.count ?? 5); i++)
        projectile((i - ((a.count ?? 5) - 1) / 2) * 0.11);
    if (a.kind === "zone" && this.zones.length < RULES.maxZones) {
      const aim = p.lastInput;
      const distance = a.follow
        ? 0
        : Math.min(a.range, Math.hypot(aim.aimX - p.x, aim.aimY - p.y));
      const x = p.x + Math.cos(angle) * distance,
        y = p.y + Math.sin(angle) * distance;
      this.zones.push({
        id: ++this.serial,
        owner: p.id,
        x,
        y,
        radius: a.radius,
        until: this.time + a.duration,
        nextTick: this.time + (a.tickDelay ?? 0.35),
        ability: a,
        color,
      });
    }
    if (a.kind === "melee")
      for (const enemy of enemies)
        if (enemy.hp > 0 && this.inArc(p, enemy, a.range, a.arc ?? 0.35))
          this.damage(enemy, a.damage, p.id, a);
    if (a.kind === "nova") {
      const radius = a.radius * (selfPrimed ? (combo.radius ?? 1) : 1);
      this.event("burst", p, color, undefined, p.id, a.id);
      if (selfPrimed)
        this.events[this.events.length - 1].combo = combo.name;
      for (const enemy of enemies) {
        if (
          enemy.clone &&
          Math.hypot(enemy.clone.x - p.x, enemy.clone.y - p.y) < radius
        )
          enemy.clone = undefined;
        if (
          enemy.hp > 0 &&
          Math.hypot(enemy.x - p.x, enemy.y - p.y) < radius + RULES.radius &&
          this.lineClear(p, enemy)
        )
          this.damage(enemy, a.damage, p.id, a);
      }
    }
    if (a.kind === "beam") {
      const dx = Math.cos(angle),
        dy = Math.sin(angle);
      let x = p.x,
        y = p.y;
      for (let travelled = 0; travelled < a.range; travelled += 8) {
        x = p.x + dx * travelled;
        y = p.y + dy * travelled;
        if (travelled > RULES.radius && blocked(x, y, 2)) break;
        // The beam stops at the first decoy or enemy it reaches.
        const decoy = enemies.find(
          (e) =>
            e.clone &&
            Math.hypot(x - e.clone.x, y - e.clone.y) < a.radius + RULES.radius,
        );
        if (decoy) {
          decoy.clone = undefined;
          break;
        }
        const struck = enemies.find(
          (e) =>
            e.hp > 0 && Math.hypot(x - e.x, y - e.y) < a.radius + RULES.radius,
        );
        if (struck) {
          this.damage(struck, a.damage, p.id, a);
          break;
        }
      }
      this.events.push({
        id: ++this.serial,
        kind: "beam",
        x: p.x,
        y: p.y,
        tx: x,
        ty: y,
        color,
        owner: p.id,
        abilityId: a.id,
      });
      if (this.events.length > 80) this.events.shift();
    }
    if (a.kind === "cone") {
      const skill = CHARACTERS[p.character].skills.findIndex(
        (k) => k.id === a.id,
      );
      p.channel = {
        until: this.time + a.duration,
        nextTick: this.time + (a.tickDelay ?? 0.1),
        skill,
      };
    }
    if (a.kind === "counter") this.status(p, "counter", a.duration);
    if (a.kind === "barrier") this.status(p, "shield", a.duration);
    if (a.kind === "buff") this.status(p, "empower", a.duration);
    if (a.kind === "rest") {
      this.status(p, "sleep", a.duration);
      const sleep = p.statuses.find((s) => s.kind === "sleep")!;
      sleep.amount = a.heal ?? 0;
      // Ticks land at 0.4s, 0.9s … so a full Rest always heals duration / interval times.
      sleep.nextTick = this.time + STATUS_RULES.restInterval - 0.1;
      p.channel = undefined;
    }
    if (a.kind === "clone") {
      p.clone = { x: p.x, y: p.y, until: this.time + a.duration };
      this.status(p, "haste", a.statusDuration ?? 2);
    }
    // A self combo is spent by casting the payoff, hit or miss.
    if (selfPrimed)
      p.statuses = p.statuses.filter(
        (s) => !(s.kind === "mark" && s.by === p.id),
      );
  }
  /** Seconds into the live round (negative before it starts). */
  arenaTime() {
    return this.phase === "playing" ? this.time - this.hazardClock : -1;
  }
  /** Walls right now; also makes them the ones collision uses. */
  walls() {
    const list = obstaclesAt(this.arenaId, this.arenaTime());
    useObstacles(list);
    return list;
  }
  /** Hazards, the shifting wall and the pools' slow, once per tick. */
  stepArena(dt: number) {
    const def = ARENAS[this.arenaId];
    const t = this.arenaTime(),
      before = t - dt;
    const alive = this.players.filter((p) => p.hp > 0 && !p.out);
    if (def.shifting && shiftingUp(def, t) && !shiftingUp(def, before)) {
      // The block rises: shove anyone on it out of the way, stop shots inside.
      const r = def.shifting.rect;
      for (const p of alive) pushOut(p, r);
      this.projectiles = this.projectiles.filter(
        (pr) =>
          pr.x < r.x || pr.x > r.x + r.w || pr.y < r.y || pr.y > r.y + r.h,
      );
      this.event("hazard", { x: r.x + r.w / 2, y: r.y + r.h / 2 }, 0xb59b6b, undefined, undefined, "hazard-wall");
    }
    for (const h of def.hazards) {
      const inside = alive.filter(
        (p) => Math.hypot(p.x - h.x, p.y - h.y) < h.radius + RULES.radius * 0.5,
      );
      if (h.kind === "pool" && h.status)
        for (const p of inside)
          if (p.jumpUntil <= this.time)
            this.status(p, h.status, h.statusDuration ?? 0.3);
      if (!triggers(h, before, t)) continue;
      this.event("hazard", h, h.kind === "vent" ? 0xff7a3d : 0x4fd6e6, undefined, undefined, `hazard-${h.kind}`);
      const hit = hazardAbility(h);
      for (const p of inside) {
        if (h.ground && p.jumpUntil > this.time) continue;
        this.damage(p, h.damage, "", hit);
        if (h.knockback) {
          const d = normalize(p.x - h.x || 1, p.y - h.y);
          const len = Math.hypot(d.x, d.y) || 1;
          move(p, (d.x / len) * h.knockback, (d.y / len) * h.knockback);
        }
      }
    }
  }
  lineClear(a: { x: number; y: number }, b: { x: number; y: number }) {
    this.walls();
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10);
    for (let i = 1; i < steps; i++)
      if (
        blocked(
          a.x + ((b.x - a.x) * i) / steps,
          a.y + ((b.y - a.y) * i) / steps,
          2,
        )
      )
        return false;
    return true;
  }
  tick(dt = 1 / RULES.tick) {
    // Movement rules are shared module state: set this room's before moving.
    useSpeedScale(this.rule("speed") ? MUTATOR_RULES.speed : 1);
    if (
      this.phase === "briefing" ||
      this.phase === "paused" ||
      this.phase === "lobby" ||
      this.phase === "finished"
    )
      return;
    this.time += dt;
    this.walls();
    if (this.phase === "countdown" || this.phase === "intermission") {
      if (this.time >= this.deadline) {
        if (this.phase === "intermission") {
          // Time's up: anyone still choosing gets their first option.
          for (const p of this.players)
            if (p.riteOffer) this.pickRite(p.id, p.riteOffer[0]);
          this.round++;
          this.resetRound();
        } else {
          this.phase = "playing";
          this.deadline = this.time + RULES.roundSeconds;
          this.hazardClock = this.time;
        }
      }
      return;
    }
    if (this.practice) {
      const [human, target] = this.players;
      target.lastInput = {
        ...blankInput(),
        aimX: human.x,
        aimY: human.y,
        basic: this.practice.targetAttacks,
      };
      target.angle = Math.atan2(human.y - target.y, human.x - target.x);
      if (this.practice.unlimitedCooldowns) {
        human.cooldowns = Array(SKILL_SLOTS).fill(0);
        human.dashAt = 0;
        human.jumpAt = 0;
      }
      if (this.practice.targetAttacks && this.time >= this.nextPracticeZone) {
        this.nextPracticeZone = this.time + 3;
        this.cast(target, CHARACTERS.voltkit.skills[2]);
      }
    }
    for (const [id, brain] of this.bots) {
      const bot = this.players.find((p) => p.id === id);
      if (bot) bot.lastInput = brain.think(this, bot);
    }
    for (const p of this.players) {
      // Knocked-out (2v2) or departed fighters sit still until the next round.
      // (A duel ends the round the same tick, so this only matters in 2v2.)
      if (p.out || (p.hp <= 0 && this.mode === "teams")) {
        p.vx = p.vy = 0;
        p.charge = undefined;
        p.channel = undefined;
        p.lastInput = {
          ...blankInput(),
          aimX: p.lastInput.aimX,
          aimY: p.lastInput.aimY,
        };
        continue;
      }
      p.statuses = p.statuses.filter((s) => s.until > this.time);
      for (const s of p.statuses) {
        if (s.kind === "sleep" && s.amount && this.time >= s.nextTick) {
          s.nextTick += STATUS_RULES.restInterval;
          const before = p.hp;
          p.hp = Math.min(CHARACTERS[p.character].health, p.hp + s.amount);
          p.stats.healed = (p.stats.healed ?? 0) + (p.hp - before);
        }
        if (s.kind === "burn" && this.time >= s.nextTick) {
          s.nextTick += STATUS_RULES.burnInterval;
          this.damage(
            p,
            STATUS_RULES.burnDamage,
            s.by ?? this.enemiesOf(p)[0]?.id ?? "",
          );
        }
      }
      const input = p.lastInput;
      const freeCooldowns =
        !!this.practice?.unlimitedCooldowns && p === this.players[0];
      this.chargeUlt(p, RULES.ultPerSecond * dt);
      if (p.jumpUntil > this.time - dt && p.jumpUntil <= this.time)
        this.event("land", p, CHARACTERS[p.character].color, undefined, p.id);
      const disabled = p.statuses.some(
        (s) => s.kind === "stun" || s.kind === "freeze" || s.kind === "sleep",
      );
      if (disabled) {
        p.charge = undefined;
        p.channel = undefined;
      }
      if (input.dash && !disabled && this.time >= p.dashAt) {
        const d = normalize(input.dx, input.dy);
        p.dashX = (d.x || d.y ? d.x : Math.cos(p.angle)) * RULES.dashSpeed;
        p.dashY = (d.x || d.y ? d.y : Math.sin(p.angle)) * RULES.dashSpeed;
        p.dashUntil = this.time + RULES.dashDuration;
        p.dashAt = freeCooldowns ? 0 : this.time + RULES.dashCooldown;
        this.event("dash", p, CHARACTERS[p.character].color, undefined, p.id);
      }
      if (
        input.jump &&
        !disabled &&
        this.time >= p.jumpAt &&
        this.time >= p.jumpUntil
      ) {
        p.jumpUntil = this.time + RULES.jumpDuration;
        p.jumpAt = freeCooldowns ? 0 : this.time + RULES.jumpCooldown;
        this.event("jump", p, CHARACTERS[p.character].color, undefined, p.id);
      }
      advanceMovement(p, input, dt, this.time);
      if (p.charge && this.time >= p.charge.at) {
        this.cast(p, this.kit(p).skills[p.charge.skill]);
        p.charge = undefined;
      }
      if (!disabled && this.time >= p.recoveryUntil && !p.charge) {
        const character = CHARACTERS[p.character];
        const kit = this.kit(p);
        if (
          input.skill >= 0 &&
          skillReady(p, input.skill, this.time, freeCooldowns)
        ) {
          const a = kit.skills[input.skill];
          if (input.skill === ULT_SLOT) {
            // The ultimate spends the whole meter instead of a cooldown.
            if (!freeCooldowns) p.ult = 0;
            p.cooldowns[input.skill] = 0;
          } else
            p.cooldowns[input.skill] = freeCooldowns
              ? 0
              : this.time +
                a.cooldown *
                  (this.rule("turbo") ? MUTATOR_RULES.turboCooldown : 1) *
                  (this.gift(p, "Light") ?? 1);
          p.stats.skills++;
          p.recoveryUntil =
            this.time +
            a.cast +
            a.recovery +
            (a.kind === "cone" ? a.duration : 0);
          if (a.cast) p.charge = { at: this.time + a.cast, skill: input.skill };
          else this.cast(p, a);
        } else if (input.basic && this.time >= p.basicAt) {
          // The interval is enforced here, so flooding inputs cannot fire faster.
          p.basicAt =
            this.time +
            basicInterval(character, this.has(p, "empower")) *
              (this.gift(p, "Electric") ?? 1);
          p.recoveryUntil = this.time + kit.basic.recovery;
          this.cast(p, kit.basic);
        }
      }
      input.dash = false;
      input.basic = false;
      input.jump = false;
      input.skill = -1;
      if (p.clone && p.clone.until <= this.time) p.clone = undefined;
      if (p.channel) {
        const a = this.kit(p).skills[p.channel.skill];
        if (a && this.time >= p.channel.nextTick) {
          p.channel.nextTick += a.tickInterval ?? 0.2;
          for (const enemy of this.enemiesOf(p))
            if (enemy.hp > 0 && this.inArc(p, enemy, a.range, a.arc ?? 0.7))
              this.damage(enemy, a.damage, p.id, a);
        }
        if (!a || this.time >= p.channel.until) p.channel = undefined;
      }
    }
    // Swept substeps prevent fast projectiles from tunneling through a fighter or wall.
    this.projectiles = this.projectiles.filter((pr) => {
      const steps = Math.max(
        1,
        Math.ceil((Math.hypot(pr.vx, pr.vy) * dt) / 10),
      );
      const enemies = this.enemiesOfOwner(pr.owner);
      const explode = () => {
        this.event("impact", pr, pr.color, undefined, pr.owner, pr.ability.id);
        if (pr.ability.explosion)
          for (const enemy of enemies)
            if (
              enemy.hp > 0 &&
              Math.hypot(pr.x - enemy.x, pr.y - enemy.y) <
                pr.ability.explosion + RULES.radius &&
              this.lineClear(pr, enemy)
            )
              this.damage(enemy, pr.ability.damage, pr.owner, pr.ability);
      };
      for (let i = 0; i < steps; i++) {
        pr.x += (pr.vx * dt) / steps;
        pr.y += (pr.vy * dt) / steps;
        pr.remaining -= (Math.hypot(pr.vx, pr.vy) * dt) / steps;
        if (blocked(pr.x, pr.y, pr.ability.radius) || pr.remaining <= 0) {
          explode();
          return false;
        }
        const decoy = enemies.find(
          (e) =>
            e.clone &&
            Math.hypot(pr.x - e.clone.x, pr.y - e.clone.y) <
              RULES.radius + pr.ability.radius,
        );
        if (decoy) {
          decoy.clone = undefined;
          this.event(
            "impact",
            pr,
            pr.color,
            undefined,
            pr.owner,
            pr.ability.id,
          );
          return false;
        }
        const struck = enemies.find(
          (e) =>
            e.hp > 0 &&
            Math.hypot(pr.x - e.x, pr.y - e.y) <
              RULES.radius + pr.ability.radius,
        );
        if (struck) {
          if (pr.ability.explosion) explode();
          else this.damage(struck, pr.ability.damage, pr.owner, pr.ability);
          return false;
        }
      }
      return true;
    });
    for (const zone of this.zones) {
      if (zone.ability.follow) {
        const owner = this.players.find((p) => p.id === zone.owner);
        if (owner) {
          zone.x = owner.x;
          zone.y = owner.y;
        }
      }
      if (this.time >= zone.nextTick) {
        zone.nextTick += zone.ability.tickInterval ?? 0.5;
        for (const enemy of this.enemiesOfOwner(zone.owner))
          if (
            enemy.hp > 0 &&
            Math.hypot(enemy.x - zone.x, enemy.y - zone.y) <
              zone.radius + RULES.radius &&
            this.lineClear(zone, enemy)
          )
            this.damage(enemy, zone.ability.damage, zone.owner, zone.ability);
      }
    }
    this.zones = this.zones.filter((z) => z.until > this.time);
    if (!this.practice) {
      this.stepArena(dt);
      this.walls();
      this.stepOrbs();
      // Water team-up: a Tidefin partner nearby slowly heals you.
      if (this.mode === "teams" && this.phase === "playing")
        for (const p of this.players) {
          const heal = this.gift(p, "Water");
          if (!heal) continue;
          const before = p.hp;
          p.hp = Math.min(CHARACTERS[p.character].health, p.hp + heal * dt);
          p.stats.healed = (p.stats.healed ?? 0) + (p.hp - before);
        }
    }
    if (this.practice) {
      for (const [i, p] of this.players.entries())
        if (p.hp <= 0) {
          p.hp = CHARACTERS[p.character].health;
          p.x = i === 0 ? 650 : 950;
          p.y = 180;
          p.vx = p.vy = 0;
          p.statuses = [];
          p.clone = undefined;
          p.charge = undefined;
          p.channel = undefined;
          p.dashUntil = p.jumpUntil = 0;
          p.lastInput = blankInput();
        }
      return;
    }
    // Overtime drain and the closing ring bite twice a second (one readable
    // hit each, rather than a sliver every tick).
    const ring = ringRadius(this.deadline - this.time, this.overtime);
    if (
      (this.overtime || (ring !== null && this.time < this.deadline)) &&
      this.time >= this.nextDrain
    ) {
      this.nextDrain = this.time + DRAIN_INTERVAL;
      for (const p of this.players) {
        if (p.hp <= 0 || p.out) continue;
        if (this.overtime)
          this.damage(
            p,
            12 * DRAIN_INTERVAL,
            this.enemiesOf(p)[0]?.id ?? "",
          );
        // Outside the ring everyone loses health, and nobody's credited.
        if (
          ring !== null &&
          p.hp > 0 &&
          Math.hypot(p.x - RING.x, p.y - RING.y) > ring
        )
          this.damage(p, RING.damage * DRAIN_INTERVAL, "");
      }
    }
    // Crown Hill: a side alone in the circle builds up time; enough wins.
    if (this.rule("crown")) {
      const inside = this.sides.filter((t) =>
        this.standing(t).some(
          (p) => Math.hypot(p.x - CROWN.x, p.y - CROWN.y) < CROWN.radius,
        ),
      );
      if (inside.length === 1) {
        const t = inside[0];
        this.crown[t] = (this.crown[t] ?? 0) + dt;
        if (this.crown[t] >= CROWN.holdSeconds) {
          this.endRound(t);
          return;
        }
      }
    }
    // The round ends when one side (or nobody) is left standing.
    const alive = this.sides.filter((t) => this.standing(t).length);
    if (alive.length <= 1) {
      this.endRound(alive[0] ?? null);
      return;
    }
    if (this.time >= this.deadline) {
      // Time: the team with more health left (as a share of its full health) wins.
      const share = (team: Team) => {
        const members = this.players.filter((p) => this.teamOf(p) === team);
        return (
          members.reduce(
            (sum, p) =>
              sum + Math.max(0, p.hp) / CHARACTERS[p.character].health,
            0,
          ) / Math.max(1, members.length)
        );
      };
      // Only sides still standing can win on time.
      const ranked = alive
        .map((t) => ({ t, share: share(t) }))
        .sort((a, b) => b.share - a.share);
      if (Math.abs(ranked[0].share - ranked[1].share) < 0.0001) {
        this.overtime = true;
        this.deadline = this.time + 20;
      } else this.endRound(ranked[0].t);
    }
  }
  /** Spawn healing orbs on schedule; the first fighter to touch one heals. */
  stepOrbs() {
    if (this.time >= this.nextOrb) {
      this.nextOrb += this.orbInterval;
      // Duel: one orb, alternating spots. 2v2: one at each spot.
      const spots =
        this.mode !== "duel"
          ? ORB_SPOTS
          : [ORB_SPOTS[this.orbTurn++ % ORB_SPOTS.length]];
      // Healing and energy orbs take turns (first one heals).
      const kind = this.orbWave++ % 2 === 0 ? "heal" : "energy";
      for (const spot of spots)
        if (!this.orbs.some((o) => o.x === spot.x && o.y === spot.y)) {
          this.orbs.push({ id: ++this.serial, x: spot.x, y: spot.y, kind });
          this.event("orb", spot, kind === "heal" ? 0x7dffb0 : 0xffd166);
        }
    }
    this.orbs = this.orbs.filter((orb) => {
      // Closest living fighter in reach takes it.
      const taker = this.players
        .filter(
          (p) =>
            p.hp > 0 &&
            !p.out &&
            // Full health (or a full meter) walks straight through it.
            (orb.kind === "energy"
              ? (p.ult ?? 0) < RULES.ultMax
              : p.hp < CHARACTERS[p.character].health) &&
            Math.hypot(p.x - orb.x, p.y - orb.y) <
              RULES.radius + RULES.orbRadius,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - orb.x, a.y - orb.y) -
            Math.hypot(b.x - orb.x, b.y - orb.y),
        )[0];
      if (!taker) return true;
      if (orb.kind === "energy") {
        const before = taker.ult ?? 0;
        this.chargeUlt(taker, RULES.orbEnergy);
        this.event(
          "heal",
          taker,
          0xffd166,
          Math.round((taker.ult ?? 0) - before),
          taker.id,
          "energy-orb",
        );
        return false;
      }
      const full = CHARACTERS[taker.character].health;
      const healed = Math.min(
        full - taker.hp,
        Math.round(full * RULES.orbHeal),
      );
      taker.hp += healed;
      taker.stats.healed = (taker.stats.healed ?? 0) + healed;
      this.event("heal", taker, 0x7dffb0, healed, taker.id);
      return false;
    });
  }
  /** A team (or nobody, on a double knockout) takes the round. */
  endRound(team: Team | null) {
    const members =
      team === null ? [] : this.players.filter((p) => this.teamOf(p) === team);
    this.roundWinnerTeam = team;
    this.roundLog.push(team);
    this.roundWinner =
      members.find((p) => !p.out)?.id ?? members[0]?.id ?? null;
    if (team !== null) {
      this.teamScores[team]++;
      for (const p of members) this.scores[p.id]++;
      // Comeback: the team that lost the round starts the next with extra charge.
      for (const p of this.players)
        if (this.teamOf(p) !== team) this.chargeUlt(p, RULES.ultComeback);
    }
    this.event("round", { x: 800, y: 450 }, 0xffffff);
    if (team !== null && this.teamScores[team] >= this.roundsToWin) {
      this.winnerTeam = team;
      this.winner = this.roundWinner;
      this.phase = "finished";
    } else {
      this.phase = "intermission";
      this.roundEndedAt = this.time;
      this.deadline = this.time + RULES.intermission;
      if (!this.practice && !this.rule("random")) {
        this.deadline = this.time + RITE_RULES.seconds;
        this.offerRites(team);
      }
    }
  }
  /** End the match in favour of `id`'s team (opponents left or gave up). */
  forfeit(id: string) {
    const winner = this.players.find((p) => p.id === id);
    const team = winner ? this.teamOf(winner) : 0;
    this.winner = id;
    this.winnerTeam = team;
    this.teamScores[team] = this.roundsToWin;
    for (const p of this.players)
      if (this.teamOf(p) === team) this.scores[p.id] = this.roundsToWin;
    this.phase = "finished";
  }
  snapshot(pauseRemaining = 0): Snapshot {
    return {
      instructionsReady: this.instructionsReady,
      practice: this.practice,
      vsBot: [...this.bots.values()][0]?.difficulty ?? null,
      code: this.code,
      phase: this.phase,
      time: this.time,
      remaining: Math.max(0, this.deadline - this.time),
      round: this.round,
      scores: this.scores,
      winner: this.winner,
      roundWinner: this.roundWinner,
      mode: this.mode,
      teamScores: this.teamScores,
      winnerTeam: this.winnerTeam,
      roundWinnerTeam: this.roundWinnerTeam,
      players: this.players,
      projectiles: this.projectiles,
      zones: this.zones,
      orbs: this.orbs,
      events: this.events,
      pauseRemaining,
      overtime: this.overtime,
      mutators: [...this.mutators],
      crown: this.rule("crown") ? this.crown : undefined,
      roundLog: this.roundLog,
      matchId: this.matchId,
      arena: this.arenaId,
      hazardClock: this.hazardClock,
    };
  }
}
/** Did hazard `h` trigger between `before` and `t` (seconds into the round)? */
function triggers(h: Hazard, before: number, t: number) {
  const count = (x: number) =>
    x < h.offset ? -1 : Math.floor((x - h.offset) / h.period);
  return t >= h.offset && count(t) > count(before);
}
/** Move `p` to the nearest point just outside `r` (a wall rising under it). */
function pushOut(p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) {
  const pad = RULES.radius + 2;
  if (p.x < r.x - pad || p.x > r.x + r.w + pad || p.y < r.y - pad || p.y > r.y + r.h + pad)
    return;
  const options = [
    { x: r.x - pad, y: p.y, d: p.x - (r.x - pad) },
    { x: r.x + r.w + pad, y: p.y, d: r.x + r.w + pad - p.x },
    { x: p.x, y: r.y - pad, d: p.y - (r.y - pad) },
    { x: p.x, y: r.y + r.h + pad, d: r.y + r.h + pad - p.y },
  ].sort((a, b) => a.d - b.d);
  p.x = options[0].x;
  p.y = options[0].y;
}
