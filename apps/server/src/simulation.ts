import {
  CHARACTERS,
  CURRENT_HOLD,
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
  DISABLING_STATUSES,
  PRACTICE_GRID,
  turretShot,
  hasMark,
  MODE_SIZE,
  MODE_MIN,
  ORB_SPOTS,
  EX,
  exAbility,
  RUSH,
  rushGoals,
  type Gem,
  CROWN,
  TEAMUP,
  ELEMENT_GIFTS,
  MUTATOR_RULES,
  roundsNeeded,
  type MutatorId,
  RING,
  ringRadius,
  RULES,
  dashCooldownOf,
  SKILL_SLOTS,
  STATUS_RULES,
  ULT_SLOT,
  skillReady,
  basicInterval,
  maxHealth,
  advanceMovement,
  holdInCage,
  blankInput,
  blinkLanding,
  emptyStats,
  farMultiplier,
  blocked,
  currentObstacles,
  move,
  normalize,
  type Ability,
  type AbilityKind,
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
  MOSS,
  PLATES,
  cycloneBlades,
  platesOf,
  seedStage,
} from "../../../packages/shared/src/index.js";
import { chooseRite, type BotBrain } from "./bot.js";
import { projectileContact } from "./projectile-collision.js";
/** Free-for-all starting corners (seat order), opposite corners first. */
const FFA_SPAWNS = [
  { x: 260, y: 250 },
  { x: 1340, y: 650 },
  { x: 1340, y: 250 },
  { x: 260, y: 650 },
];
/** Seconds between overtime / closing-ring damage ticks. */
const DRAIN_INTERVAL = 0.5;
/** Preserve a discrete skill tap through a short attack recovery, never a long cast. */
const SKILL_INPUT_BUFFER = 0.18;
/** Knockback a point-blank shot (`knockbackNear`) keeps beyond its reach. */
const NEAR_KNOCKBACK_FAR = 20;
/** Seconds after a cast out of stealth in which its first hit gets the ambush bonus. */
const AMBUSH_WINDOW = 0.8;
/**
 * Champion hits up close that Facet Guard only halves (it refracts the
 * rest: shots, beams, areas, a raid boss's attacks).
 */
const UNREFRACTED: AbilityKind[] = [
  "melee",
  "pound",
  "clamp",
  "throw",
  "cone",
  "rush",
  "tunnel",
  "cyclone",
  "grapple",
  "blink",
  "nova",
  "taunt",
];
/** A rush hits whoever it touches within this gap (px) between the two bodies. */
const RUSH_CONTACT = 10;
/** A pull leaves this gap (px) between the two bodies. */
const PULL_GAP = 6;
/**
 * Network input queue (Arena.enqueue/drainInputs). One input per tick keeps
 * the server's steps in lockstep with client prediction; `depth` bounds the
 * extra latency a burst can leave behind (2 ticks, 67 ms), and a queue
 * that stays at least 2 deep for `standingTicks` is shortened by one.
 * Clients send every tick while playing (even when idle), so inputs that
 * stop for `staleTicks` mean a lost connection: the fighter stops walking
 * instead of running on its last input until the socket times out.
 *
 * A tick with nothing queued does not move your fighter (the next input is
 * late, not lost: Wi-Fi often holds a phone's packets for a moment). The
 * tick is held: when the late inputs arrive, each takes its own step, in
 * order, at the held tick's time, before the tick's own step. So the server
 * takes one step per input, each with its own direction, exactly as the
 * phone predicted them (Fighter.held tells it how many ticks wait).
 * Running the last input again instead (until 18 Nov 2026) walked you on in
 * the old direction while you had turned, and folding the late inputs
 * afterwards could not take those steps back: every hold that met a turn
 * was an "unexplained" jump (docs/network-performance.md, sections 12 and
 * 16). Held ticks are paid only by late inputs, at most `staleTicks` of
 * them, so a client cannot move faster than one step a tick.
 */
export const INPUT_QUEUE = {
  depth: 2,
  /** Inputs a queue may hold: a held half second of them, and a burst. */
  cap: 20,
  /** Inputs past one a tick stepped at most (late ones, or on credit). */
  catchUp: 3,
  standingTicks: 30,
  staleTicks: 15,
  /** Ticks an unpaid debt waits for the rest of a burst (see drainInputs). */
  unpaidTicks: 10,
  /** At most this many steps banked (`credit`): half a second, and a burst. */
  credit: 17,
  /**
   * Credit a new queue starts with: a phone's first inputs were made for
   * ticks the server had already run (a round trip of them), and arrive
   * bunched, so a standing queue of a few is cut short without losing one.
   */
  startCredit: 5,
};
export class Arena {
  activityStatus?: "saving" | "saved" | "unavailable";
  activityEligible?: string[];
  arcade?: import("../../../packages/shared/src/arcade.js").ArcadeState;
  readonly engaged = new Set<string>();
  get crownZone() {
    return CROWN;
  }
  practice: Snapshot["practice"] = null;
  /** AI opponents in this room, by fighter id (solo vs bot). */
  bots = new Map<string, BotBrain>();
  private bufferedSkills = new Map<
    string,
    { slot: number; ex: boolean; until: number }
  >();
  /** Fighters whose tick is held this tick (drainInputs: nothing queued). */
  private heldNow = new Set<string>();
  /** Late inputs paying held ticks: a step each before this tick's own. */
  private lateSteps = new Map<string, { input: Input; time: number }[]>();
  /**
   * Each player's input queue over the match, for its arena-perf report:
   * held ticks, late inputs stepped, burst inputs stepped on credit, inputs
   * folded into another's step (a step lost: the phone jumps), and the
   * queue's depth summed over ticks. Reset when a match starts.
   */
  private inputTally = new Map<
    string,
    {
      ticks: number;
      depth: number;
      held: number;
      late: number;
      extra: number;
      folded: number;
    }
  >();
  private tally(id: string) {
    let t = this.inputTally.get(id);
    if (!t) {
      t = { ticks: 0, depth: 0, held: 0, late: 0, extra: 0, folded: 0 };
      this.inputTally.set(id, t);
    }
    return t;
  }
  /** One player's input queue over this match (arena-perf), if it had one. */
  inputStats(id: string) {
    const t = this.inputTally.get(id);
    if (!t || !t.ticks) return undefined;
    return {
      heldTicks: t.held,
      lateSteps: t.late,
      extraSteps: t.extra,
      folded: t.folded,
      queueAvg: Math.round((t.depth / t.ticks) * 100) / 100,
    };
  }
  /** Charges in progress (rush skills), by fighter id, until they touch someone or run out. */
  private rushes = new Map<string, { until: number; ability: Ability }>();
  /** Armed ambush bonuses (cast out of stealth), by fighter id. */
  private ambushes = new Map<string, { mult: number; until: number }>();
  /** Leaf Storm: when each storm's blades last swept each enemy (by id). */
  private cycloneHits = new Map<string, Map<string, number>>();
  /** Tongue Grapple zips: toward an enemy (followed) or a point, stopping `gap` short. */
  private zips = new Map<
    string,
    {
      target?: string;
      x: number;
      y: number;
      gap: number;
      speed: number;
      until: number;
    }
  >();
  /** Where each fighter was lately (Halcyon Rewind): time, place and health, oldest first. */
  private trail = new Map<
    string,
    { t: number; x: number; y: number; hp: number }[]
  >();
  /** Spark Trail: when each trail zone last hit each enemy (`zone:fighter`). */
  private rayHits = new Map<string, number>();
  /** River Dash: dashes in progress, by fighter id, and who each has gone through. */
  private surfs = new Map<
    string,
    { until: number; ability: Ability; slot: number; hit: Set<string> }
  >();
  /** Magma Leap: leaps in the air, by fighter id, landing when they end. */
  private leaps = new Map<string, { until: number; ability: Ability }>();
  /** Riptide Wave: when each enemy a wave reached stops being carried (`zone:fighter`). */
  private carried = new Map<string, number>();
  /** Riptide Wave: waves that have sent their second wall (and second walls). */
  private waveFollowed = new Set<number>();
  /** Frost Breath: ticks in a row each enemy has spent in a caster's breath (`caster:enemy`). */
  private coneStreak = new Map<string, number>();
  /** Shell Up: when each fighter's shell bursts open. */
  private restBursts = new Map<string, { at: number; ability: Ability }>();
  protected clearBufferedSkills(id?: string) {
    if (id === undefined) this.bufferedSkills.clear();
    else this.bufferedSkills.delete(id);
  }
  /**
   * Network inputs wait here and are applied one per tick (see
   * drainInputs), so each acknowledged input stands for exactly one
   * simulated step, as the client predicts it.
   */
  private inputQueues = new Map<
    string,
    {
      inputs: Input[];
      last: number;
      standing: number;
      minDepth: number;
      idle: number;
      /** Held ticks: nothing was queued, so the fighter did not move. */
      owed: number;
      /** Each held tick's time, oldest first (its late input steps then). */
      heldAt: number[];
      /**
       * Steps this fighter may still take: one more each tick, one less
       * each step, at most `credit`. A burst of inputs steps only on
       * credit (else it is folded, as always), so no client moves faster
       * than one step a tick on average, however many inputs it sends.
       */
      credit: number;
      /** Ticks in a row a debt was left unpaid with the queue emptied. */
      unpaid: number;
    }
  >();
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
  /** Orb Rush: gems on the court, gems banked per side, next spawn time. */
  gems: Gem[] = [];
  banked: number[] = [];
  private nextGem = 0;
  /** Fighter roulette: the fighter each player picked, restored in the lobby. */
  chosen = new Map<string, CharacterId>();
  /** PvP lobby: when each player locked in (2v2: the first lock keeps a fighter). */
  lockOrder = new Map<string, number>();
  lockSerial = 0;
  /** Round winners in order (null = draw). */
  roundLog: (Team | null)[] = [];
  /** Seconds spent in active play this match (for "mostly idle" checks). */
  playTime = 0;
  /** Id of the last finished real match (players report it for records). */
  matchId: string | null = null;
  /**
   * A random tag for this match, new at each start: every player's
   * arena-perf report of it carries it, so both sides read together. Not an
   * id anything else knows.
   */
  matchTag = "";
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
    let seed =
      [...code].reduce(
        (h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619),
        2166136261,
      ) >>> 0;
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
  /**
   * Everyone on the other team who is still in the match and can be hit
   * (not underground: Tunnel); with `all`, the ones underground too.
   */
  enemiesOf(p: Fighter, all = false) {
    const team = this.teamOf(p);
    return this.players.filter(
      (o) =>
        o !== p &&
        this.teamOf(o) !== team &&
        !o.out &&
        (all || !this.burrowed(o)),
    );
  }
  /** Underground (Tunnel): nothing can hit it, nor give it a status. */
  burrowed(p: Fighter) {
    return !!p.burrow && this.time < p.burrow.until;
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
      hp: maxHealth(character, this.mode, this.players.length),
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
    this.inputTally.clear();
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
    this.matchTag = Math.random().toString(36).slice(2, 8);
    this.playTime = 0;
    this.activityStatus = undefined;
    this.activityEligible = undefined;
    this.engaged.clear();
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
    this.clearBufferedSkills();
    this.clearInputQueue();
    this.rushes.clear();
    this.ambushes.clear();
    this.cycloneHits.clear();
    this.zips.clear();
    this.trail.clear();
    this.rayHits.clear();
    this.surfs.clear();
    this.leaps.clear();
    this.carried.clear();
    this.waveFollowed.clear();
    this.coneStreak.clear();
    this.restBursts.clear();
    // Fighter roulette: a fresh random fighter for everyone each round.
    if (this.rule("random") && !this.practice)
      for (const p of this.players) {
        p.character =
          FIGHTER_IDS[Math.floor(this.random() * FIGHTER_IDS.length)];
        p.rites = [];
        p.flair = undefined;
      }
    this.projectiles = [];
    this.zones = [];
    this.overtime = false;
    this.crown = this.sides.map(() => 0);
    this.gems = [];
    this.banked = this.sides.map(() => 0);
    this.nextGem = this.time + RULES.countdown + 1.5;
    for (const p of this.players) p.gems = 0;
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
        hp: p.out ? 0 : maxHealth(p.character, this.mode, this.players.length),
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
        burrow: undefined,
        cyclone: undefined,
        tether: undefined,
        grab: undefined,
        pound: undefined,
        plates: undefined,
        plateAt: 0,
        moss: 0,
        mossAt: 0,
        mossStill: undefined,
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
  /** Cancel all ongoing and buffered actions as soon as a fighter is down. */
  private stopKnockedOut(p: Fighter) {
    this.clearBufferedSkills(p.id);
    this.rushes.delete(p.id);
    this.ambushes.delete(p.id);
    this.cycloneHits.delete(p.id);
    this.zips.delete(p.id);
    this.trail.delete(p.id);
    p.tether = undefined;
    p.grab = undefined;
    p.pound = undefined;
    p.burrow = undefined;
    p.cyclone = undefined;
    p.vx = p.vy = 0;
    p.dashUntil = p.jumpUntil = 0;
    p.charge = undefined;
    p.channel = undefined;
    p.lastInput = {
      ...blankInput(),
      aimX: p.lastInput.aimX,
      aimY: p.lastInput.aimY,
    };
  }
  /**
   * Queue a network input. Applied by drainInputs() at the next tick:
   * normally exactly one per tick; a burst (after a stall) is applied at
   * once, merged as before, so stale movement never piles up and every
   * skill, dash, jump and Basic press still reaches submit().
   */
  enqueue(p: Fighter, input: Input) {
    if (this.phase !== "playing") return;
    let q = this.inputQueues.get(p.id);
    if (!q) {
      q = {
        inputs: [],
        last: p.ack,
        standing: 0,
        minDepth: Infinity,
        idle: 0,
        owed: 0,
        heldAt: [],
        credit: INPUT_QUEUE.startCredit,
        unpaid: 0,
      };
      this.inputQueues.set(p.id, q);
    }
    if (input.seq <= Math.max(q.last, p.ack)) return;
    q.last = input.seq;
    // Activity counts when it arrives, even if the match ends first.
    if (
      input.dx ||
      input.dy ||
      input.basic ||
      input.skill >= 0 ||
      input.dash ||
      input.jump
    )
      this.engaged.add(p.id);
    q.inputs.push(input);
    // A flood can never hold more than a burst's worth.
    if (q.inputs.length > INPUT_QUEUE.cap) {
      this.submit(p, q.inputs.shift()!);
      this.tally(p.id).folded++;
    }
  }
  /** Forget queued inputs (round reset, reconnect, leaving). */
  clearInputQueue(id?: string) {
    if (id === undefined) {
      this.inputQueues.clear();
      this.heldNow.clear();
      this.lateSteps.clear();
    } else {
      this.inputQueues.delete(id);
      this.heldNow.delete(id);
      this.lateSteps.delete(id);
    }
    for (const p of this.players)
      if (id === undefined || p.id === id) delete p.held;
  }
  /** Apply this tick's queued inputs. Call before tick(). */
  drainInputs() {
    if (this.phase !== "playing") {
      if (this.inputQueues.size) this.clearInputQueue();
      return;
    }
    this.heldNow.clear();
    this.lateSteps.clear();
    for (const [id, q] of this.inputQueues) {
      const p = this.players.find((f) => f.id === id);
      if (!p) {
        this.inputQueues.delete(id);
        continue;
      }
      q.minDepth = Math.min(q.minDepth, q.inputs.length);
      q.credit = Math.min(q.credit + 1, INPUT_QUEUE.credit);
      const tally = this.tally(id);
      tally.ticks++;
      tally.depth += q.inputs.length;
      if (!q.inputs.length) {
        if (++q.idle === INPUT_QUEUE.staleTicks) {
          p.lastInput = { ...p.lastInput, dx: 0, dy: 0, basic: false };
          // A pause, not a hiccup: the inputs for these ticks were never
          // made (a hidden tab), so the next ones are not late. The fighter
          // steps again (standing), so it can still be pushed and slide.
          q.owed = 0;
          q.heldAt = [];
        }
        if (q.idle < INPUT_QUEUE.staleTicks) {
          q.owed++;
          this.heldNow.add(id);
          tally.held++;
        } else q.credit--; // Stale: it steps, standing.
        this.showOwed(p, q.owed);
        continue;
      }
      q.idle = 0;
      // Burst: catch up to the newest inputs now (merged as they always
      // were), keeping at most `depth` waiting.
      let apply = Math.max(1, q.inputs.length - INPUT_QUEUE.depth);
      // Late inputs for held ticks: each takes its own step.
      apply = Math.max(apply, Math.min(q.inputs.length, 1 + q.owed));
      // At most `catchUp` more than one a tick: a long hold is made up over
      // a few ticks (others see a quick run, not a teleport). The phone
      // replays whatever is still unanswered, so it agrees all along.
      apply = Math.min(apply, 1 + INPUT_QUEUE.catchUp);
      // Inputs fill the held ticks first, oldest first, then this tick's
      // own step, in the order the phone predicts them (serverSteps). With
      // none left for this tick, it is held too.
      const late = Math.min(apply, q.owed);
      q.owed -= late;
      // Their times, before a debt forgotten below could drop them.
      const lateAt = q.heldAt.splice(0, late);
      if (apply <= late) {
        q.owed++;
        this.heldNow.add(id);
        tally.held++;
      }
      // The burst is used up and some of the debt is left: the rest may
      // still be on its way, but if the phone itself froze, its input clock
      // skipped those ticks and no inputs are coming for them. Unpaid for
      // `unpaidTicks` ticks, the debt is forgotten. Until then every input
      // is still one step (the debt only dates them), so this can wait for
      // a late burst that trickles in.
      if (q.owed > 0 && q.inputs.length <= apply) {
        if (++q.unpaid > INPUT_QUEUE.unpaidTicks) {
          q.owed = q.unpaid = 0;
          q.heldAt = [];
        }
      } else q.unpaid = 0;
      this.showOwed(p, q.owed);
      // A queue that never emptied for a second adds standing latency:
      // apply one extra input to shorten it.
      if (++q.standing >= INPUT_QUEUE.standingTicks) {
        if (q.minDepth >= 2) apply++;
        q.standing = 0;
        q.minDepth = Infinity;
      }
      // The inputs taken this tick: the late ones step at their held ticks'
      // times; the newest is this tick's own step (unless it is held); any
      // between (a burst, a standing queue cut short) step now while credit
      // lasts, and are folded into this tick's step after that.
      const taken = Math.min(apply, q.inputs.length),
        held = this.heldNow.has(id);
      let stepped = late + (held ? 0 : 1);
      const steps: { input: Input; time: number }[] = [];
      for (let i = 0; i < taken; i++) {
        const next = q.inputs.shift()!;
        if (i < late)
          steps.push({
            input: { ...next },
            time: lateAt[i] ?? this.time + 1 / RULES.tick,
          });
        else if (i < taken - 1 && q.credit - stepped >= 1) {
          steps.push({ input: { ...next }, time: this.time + 1 / RULES.tick });
          stepped++;
          tally.extra++;
        } else if (i < taken - 1) tally.folded++;
        this.submit(p, next);
      }
      tally.late += late;
      q.credit -= stepped;
      if (steps.length) this.lateSteps.set(id, steps);
    }
  }
  /** Tell the phone how many ticks wait for its late inputs (Fighter.held). */
  private showOwed(p: Fighter, owed: number) {
    if (owed > 0) p.held = owed;
    else delete p.held;
  }
  /** A dash press goes off at `time` (Arena.tick; late steps too). */
  private startDash(p: Fighter, input: Input, time: number, free: boolean) {
    // Dashing out of a charge (or a River Dash) gives it up.
    this.rushes.delete(p.id);
    this.surfs.delete(p.id);
    const d = normalize(input.dx, input.dy);
    p.dashX = (d.x || d.y ? d.x : Math.cos(p.angle)) * RULES.dashSpeed;
    p.dashY = (d.x || d.y ? d.y : Math.sin(p.angle)) * RULES.dashSpeed;
    p.dashUntil = time + RULES.dashDuration;
    p.dashAt = free ? 0 : time + dashCooldownOf(p);
    this.event("dash", p, CHARACTERS[p.character].color, undefined, p.id);
  }
  submit(p: Fighter, input: Input) {
    if (this.phase !== "playing" || input.seq <= p.ack) return;
    p.ack = input.seq;
    if (p.out || (p.hp <= 0 && this.mode !== "raid")) {
      this.stopKnockedOut(p);
      return;
    }
    if (
      input.dx ||
      input.dy ||
      input.basic ||
      input.skill >= 0 ||
      input.dash ||
      input.jump
    )
      this.engaged.add(p.id);
    if (input.skill >= 0) {
      // Latest intent wins. Held Basic/neutral packets never erase a skill tap
      // while its current animation recovers, or refresh its expiry.
      this.clearBufferedSkills(p.id);
      const free = !!this.practice?.unlimitedCooldowns && p === this.players[0];
      // Casting Tunnel again underground surfaces (it's on cooldown then).
      const uncurl = !!p.burrow && input.skill === p.burrow.slot;
      if (
        input.skill < SKILL_SLOTS &&
        p.hp > 0 &&
        (uncurl || skillReady(p, input.skill, this.time, free)) &&
        p.recoveryUntil <= this.time + SKILL_INPUT_BUFFER &&
        !p.statuses.some(
          (s) => s.until > this.time && DISABLING_STATUSES.includes(s.kind),
        )
      )
        this.bufferedSkills.set(p.id, {
          slot: input.skill,
          ex: !!input.ex,
          until: this.time + SKILL_INPUT_BUFFER,
        });
    }
    p.lastInput = {
      ...input,
      basic: input.basic || p.lastInput.basic,
      dash: input.dash || p.lastInput.dash,
      jump: input.jump || p.lastInput.jump,
      skill: input.skill >= 0 ? input.skill : p.lastInput.skill,
      ex: input.skill >= 0 ? !!input.ex : p.lastInput.ex,
    };
  }
  status(p: Fighter, kind: StatusKind, duration: number, by?: string) {
    // Underground, harmful statuses (and combo marks) can't reach it.
    if (this.burrowed(p) && (DEBUFFS.includes(kind) || kind === "mark")) return;
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
        this.pickRite(p.id, this.botRite(p, p.riteOffer));
    }
  }
  /** A bot's pick: by difficulty (see chooseRite). */
  botRite(p: Fighter, offer: string[]) {
    const brain = this.bots.get(p.id);
    const enemy = this.players.find(
      (q) => q.id !== p.id && !q.out && this.teamOf(q) !== this.teamOf(p),
    );
    return (
      chooseRite(
        brain?.difficulty ?? "normal",
        offer,
        p,
        enemy,
        this.random,
        this.mode !== "duel",
      ) ?? offer[0]
    );
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
    // Underground (Tunnel): nothing hits it.
    if (this.burrowed(target)) return;
    const source = this.players.find((p) => p.id === owner);
    // Blinded (Ink Jet): a basic attack misses.
    if (
      source &&
      source !== target &&
      ability &&
      ability.id === CHARACTERS[source.character].basic.id &&
      this.has(source, "blind")
    ) {
      this.event(
        "hit",
        target,
        CHARACTERS[target.character].color,
        0,
        undefined,
        ability.id,
      );
      Object.assign(this.events[this.events.length - 1], {
        target: target.id,
        source: owner,
        miss: true,
      });
      return;
    }
    let ambushed = false;
    if (amount > 0 && ability && source && source !== target) {
      // Marksman shots hit harder the farther away the target is.
      amount *= farMultiplier(
        ability,
        Math.hypot(target.x - source.x, target.y - source.y),
      );
      // The first hit out of stealth is an ambush.
      const ambush = this.ambushes.get(source.id);
      if (ambush) {
        this.ambushes.delete(source.id);
        if (this.time <= ambush.until) {
          amount *= ambush.mult;
          ambushed = true;
        }
      }
    }
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
      // A self combo's projectile payoff carries its mark (spent at cast time).
      ((combo.self && !!ability.selfPrimed) ||
        hasMark(combo.self ? source! : target, source!.id, this.time));
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
    if (this.has(target, "shell")) dealt *= STATUS_RULES.shellReduction;
    // Moss: each stack takes a little off.
    if (CHARACTERS[target.character].passive === "moss")
      dealt *= 1 - MOSS.reduction * (target.moss ?? 0);
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
    // Armour plates (Pangrove): one breaks to halve a real hit; any damage
    // puts their regrowth off.
    if (CHARACTERS[target.character].passive === "plates" && dealt > 0) {
      if (ability && dealt >= PLATES.minHit && platesOf(target) > 0) {
        dealt *= PLATES.block;
        target.plates = platesOf(target) - 1;
        this.event(
          "burst",
          target,
          0x9be37a,
          target.plates,
          target.id,
          "plate-break",
        );
      }
      target.plateAt = this.time + PLATES.regrowDelay;
    }
    dealt = Math.min(this.damageLimit(target), dealt);
    const standing = target.hp > 0;
    target.hp = Math.max(0, target.hp - dealt);
    target.stats.received += dealt;
    if (standing && target.hp <= 0) {
      target.stats.knocked = (target.stats.knocked ?? 0) + 1;
      this.stopKnockedOut(target);
    }
    if (source) source.stats.dealt += dealt;
    if (
      source &&
      dealt > 0 &&
      target.hp <= 0 &&
      this.teamOf(source) !== this.teamOf(target)
    )
      source.stats.kos = (source.stats.kos ?? 0) + 1;
    // Orb Rush: a knockout drops everything carried; a big hit drops one.
    if (this.rule("rush") && (target.gems ?? 0) > 0)
      if (target.hp <= 0) this.dropGems(target, target.gems ?? 0);
      else if (dealt >= RUSH.dropDamage) this.dropGems(target, 1);
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
      ...(ambushed ? { ambush: true } : {}),
    });
    // Life drain (an ability's `drain`) and the Nature team-up gift heal the
    // attacker for a share of what the hit dealt.
    if (source && source !== target && dealt > 0 && source.hp > 0) {
      const share = (ability?.drain ?? 0) + (this.gift(source, "Nature") ?? 0);
      if (share > 0) this.heal(source, dealt * share, ability?.id);
    }
    // Facet Guard refracts shots and beams; a strike up close is only halved.
    // A raid boss's attacks (no champion ability) are refracted too.
    if (
      counter &&
      source &&
      source !== target &&
      source.hp > 0 &&
      !(ability && UNREFRACTED.includes(ability.kind))
    )
      this.reflectDamage(source, target, amount);
    // Setup: mark the target for this fighter's payoff (or the guard for
    // Facet Guard, which primes the one who absorbed the hit).
    if (combo && !combo.self && !combo.anyDebuff && ability?.id === combo.setup)
      this.status(target, "mark", combo.window, source!.id);
    // Facet Guard primes Shatter Paw only on what it refracts (not strikes).
    if (
      counter &&
      source &&
      source !== target &&
      !(ability && UNREFRACTED.includes(ability.kind))
    ) {
      const guard = COMBOS[target.character];
      if (guard.onAbsorb) this.status(target, "mark", guard.window, target.id);
    }
    const status = primed && combo!.status ? combo!.status : ability?.status;
    if (status) {
      this.status(
        target,
        status,
        (primed && combo!.status
          ? combo!.statusDuration
          : ability?.statusDuration) ?? 1,
        owner,
      );
      // A leash pins its target where it was hit; a taunt points at the taunter.
      const s = target.statuses.find(
        (x) => x.kind === status && x.until > this.time,
      );
      if (s && status === "leash") {
        s.tx = target.x;
        s.ty = target.y;
        s.amount = ability?.leash ?? 110;
      }
      if (s && status === "taunt" && source) {
        s.tx = source.x;
        s.ty = source.y;
      }
    }
    if (ability && source && ability.knockback && !this.has(target, "brace")) {
      // A pull (negative knockback) stops just in front of the caster.
      const room = Math.max(
        0,
        Math.hypot(target.x - source.x, target.y - source.y) -
          this.hitRadius(target) -
          this.hitRadius(source) -
          PULL_GAP,
      );
      const clamp = (push: number) => (push < 0 ? Math.max(push, -room) : push);
      // Point-blank knockback (Ember Lob): only a light push from afar.
      const knock =
        ability.knockbackNear &&
        Math.hypot(target.x - source.x, target.y - source.y) >
          ability.knockbackNear
          ? Math.min(ability.knockback, NEAR_KNOCKBACK_FAR)
          : ability.knockback;
      const push = clamp(
        clamp(knock) *
          (primed ? (combo!.knockback ?? 1) : 1) *
          (this.gift(target, "Earth") ?? 1),
      );
      const dir = normalize(target.x - source.x, target.y - source.y);
      move(target, dir.x * push, dir.y * push);
    }
  }
  /** Restore health (capped at full), counted in stats, shown as a heal event. */
  heal(p: Fighter, amount: number, abilityId?: string) {
    const before = p.hp;
    p.hp = Math.min(
      maxHealth(p.character, this.mode, this.players.length),
      p.hp + amount,
    );
    const healed = p.hp - before;
    if (healed <= 0) return;
    p.stats.healed = (p.stats.healed ?? 0) + healed;
    if (healed >= 1)
      this.event("heal", p, 0x7dffb0, Math.round(healed), p.id, abilityId);
  }
  damageLimit(target: Fighter) {
    return target.hp;
  }
  /** Skill cooldowns × this for a fighter (modes may shorten them: Spire blessings). */
  protected cooldownScale(_p: Fighter) {
    return 1;
  }
  /** Modes can adjust what a bot decided (raids: dodge boss telegraphs). */
  botInput(_bot: Fighter, input: Input) {
    return input;
  }
  reflectDamage(source: Fighter, target: Fighter, amount: number) {
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
  hitRadius(p: Fighter) {
    return p.raidBoss ? 70 : RULES.radius;
  }
  /** Enemy is in front of `p` within `range` and the cosine threshold `arc`. */
  inArc(p: Fighter, enemy: Fighter, range: number, arc: number) {
    const distance = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    const dot = Math.cos(Math.atan2(enemy.y - p.y, enemy.x - p.x) - p.angle);
    return (
      distance < range + this.hitRadius(enemy) &&
      (distance < RULES.radius || dot > arc) &&
      this.lineClear(p, enemy)
    );
  }
  /** This fighter's (rite-changed) skill of a kind, if its kit has one. */
  skillOfKind(p: Fighter, kind: Ability["kind"]) {
    return this.kit(p).skills.find((k) => k.kind === kind);
  }
  /** Are the owners of these two things (fighters, shots, zones) on different sides? */
  rivals(a: string, b: string) {
    if (a === b) return false;
    const pa = this.players.find((q) => q.id === a),
      pb = this.players.find((q) => q.id === b);
    return !pa || !pb || this.teamOf(pa) !== this.teamOf(pb);
  }
  /**
   * Tunnel ends (cast again, out of time, or another skill): Pangrove bursts
   * up. Enemies close by take the hit and are flung away, and a plate grows back.
   */
  unburrow(p: Fighter) {
    const burrow = p.burrow;
    if (!burrow) return;
    p.burrow = undefined;
    if (p.hp <= 0 || p.out) return;
    const a = this.kit(p).skills[burrow.slot];
    if (!a) return;
    this.event("burst", p, CHARACTERS[p.character].color, a.radius, p.id, a.id);
    for (const enemy of this.enemiesOf(p))
      if (
        enemy.hp > 0 &&
        Math.hypot(enemy.x - p.x, enemy.y - p.y) <
          a.radius + this.hitRadius(enemy)
      )
        this.damage(enemy, a.damage, p.id, a);
    if (
      CHARACTERS[p.character].passive === "plates" &&
      platesOf(p) < PLATES.max &&
      a.tunnel?.plates
    ) {
      p.plates = Math.min(PLATES.max, platesOf(p) + a.tunnel.plates);
      this.event("burst", p, 0x9be37a, p.plates, p.id, "plate-grow");
    }
  }
  /** Leaf Storm ends: the blades burst outward (not when Pangrove is down). */
  endCyclone(p: Fighter) {
    const storm = p.cyclone;
    if (!storm) return;
    p.cyclone = undefined;
    this.cycloneHits.delete(p.id);
    const a = this.kit(p).skills[storm.slot];
    if (!a || p.hp <= 0 || p.out) return;
    const burst: Ability = {
      ...a,
      damage: a.cyclone?.burst ?? a.damage,
      status: undefined,
      knockback: 90,
    };
    this.event(
      "burst",
      p,
      CHARACTERS[p.character].color,
      a.explosion ?? 300,
      p.id,
      a.id,
    );
    for (const enemy of this.enemiesOf(p))
      if (
        enemy.hp > 0 &&
        Math.hypot(enemy.x - p.x, enemy.y - p.y) <
          (a.explosion ?? 300) + this.hitRadius(enemy)
      )
        this.damage(enemy, burst.damage, p.id, burst);
  }
  /**
   * A seedling goes off: everyone near it takes its hit (scaled by how far it
   * grew) and the seedling is gone.
   */
  bloomSeed(zone: Zone, stage: number) {
    const a = zone.ability;
    const share = a.seed?.stages[stage] ?? 1;
    const hit: Ability = {
      ...a,
      damage: Math.round(a.damage * share),
      statusDuration: (a.statusDuration ?? 1) * share,
    };
    zone.until = this.time;
    this.event("burst", zone, zone.color, stage, zone.owner, a.id);
    for (const enemy of this.enemiesOfOwner(zone.owner))
      if (
        enemy.hp > 0 &&
        Math.hypot(enemy.x - zone.x, enemy.y - zone.y) <
          zone.radius + this.hitRadius(enemy)
      )
        this.damage(enemy, hit.damage, zone.owner, hit);
  }
  cast(p: Fighter, a: Ability, ex = false) {
    if (p.hp <= 0 || p.out) return;
    this.walls();
    // Another skill from underground (the ultimate) surfaces first.
    if (p.burrow && a.kind !== "tunnel") this.unburrow(p);
    // Acting reveals a stealthed fighter; a veil with `ambush` makes the hit
    // this cast produces count extra.
    if (this.has(p, "stealth")) {
      const veil = this.kit(p).skills.find(
        (k) => k.kind === "veil" && k.ambush,
      );
      if (veil)
        this.ambushes.set(p.id, {
          mult: veil.ambush!,
          until: this.time + AMBUSH_WINDOW,
        });
    }
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
    // A primed self-combo payoff that flies (Static Lance after Static Glide)
    // lands after the cast has spent the mark, so the shot carries it.
    const shotAbility =
      selfPrimed &&
      ["projectile", "charged", "barrage", "shrapnel"].includes(a.kind)
        ? { ...a, selfPrimed: true }
        : a;
    const projectile = (offset: number) => {
      if (this.projectiles.length >= RULES.maxProjectiles) return;
      const muzzle = {
        x: p.x + Math.cos(angle + offset) * 30,
        y: p.y + Math.sin(angle + offset) * 30,
      };
      const contact = projectileContact(
        p,
        muzzle,
        a.radius,
        currentObstacles(),
      );
      const shot: Projectile = {
        id: ++this.serial,
        owner: p.id,
        x: contact?.x ?? muzzle.x,
        y: contact?.y ?? muzzle.y,
        vx: Math.cos(angle + offset) * a.speed,
        vy: Math.sin(angle + offset) * a.speed,
        remaining: a.range,
        ability: shotAbility,
        color,
      };
      if (contact) this.projectileImpact(shot);
      else this.projectiles.push(shot);
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
      if (selfPrimed) this.events[this.events.length - 1].combo = combo.name;
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
      const contact = projectileContact(
        p,
        { x: p.x + dx * a.range, y: p.y + dy * a.range },
        a.radius,
        currentObstacles(),
      );
      const reach = contact ? a.range * contact.fraction : a.range;
      let x = p.x,
        y = p.y;
      for (let travelled = 0; travelled < a.range; travelled += 8) {
        if (contact && travelled >= reach) {
          x = contact.x;
          y = contact.y;
          break;
        }
        x = p.x + dx * travelled;
        y = p.y + dy * travelled;
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
            e.hp > 0 &&
            Math.hypot(x - e.x, y - e.y) < a.radius + this.hitRadius(e),
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
      for (const key of [...this.coneStreak.keys()])
        if (key.startsWith(`${p.id}:`)) this.coneStreak.delete(key);
      p.channel = {
        until: this.time + a.duration,
        nextTick: this.time + (a.tickDelay ?? 0.1),
        skill,
        ...(ex ? { ex: true } : {}),
      };
    }
    if (a.kind === "blink") {
      const aim = p.lastInput;
      const from = { x: p.x, y: p.y };
      const landing = blinkLanding(
        p,
        angle,
        Math.min(a.range, Math.hypot(aim.aimX - p.x, aim.aimY - p.y)),
      );
      p.x = landing.x;
      p.y = landing.y;
      p.vx = p.vy = 0;
      // The landing: where the client draws the arrival (tx, ty: where it left).
      this.event("burst", p, color, undefined, p.id, a.id);
      Object.assign(this.events[this.events.length - 1], {
        tx: from.x,
        ty: from.y,
      });
      if (a.damage > 0)
        for (const enemy of enemies)
          if (
            enemy.hp > 0 &&
            Math.hypot(enemy.x - p.x, enemy.y - p.y) <
              a.radius + this.hitRadius(enemy) &&
            this.lineClear(p, enemy)
          )
            this.damage(enemy, a.damage, p.id, a);
    }
    if (a.kind === "rush") {
      // A dash at the rush's own speed; stepRushes() lands the hit on contact.
      const seconds = a.range / Math.max(1, a.speed);
      p.dashX = Math.cos(angle) * a.speed;
      p.dashY = Math.sin(angle) * a.speed;
      p.dashUntil = this.time + seconds;
      p.recoveryUntil = Math.max(p.recoveryUntil, this.time + seconds);
      this.rushes.set(p.id, { until: this.time + seconds, ability: a });
    }
    if (a.kind === "shrapnel") {
      // Every plate becomes blades: `count`, plus `count` per plate.
      const plated = CHARACTERS[p.character].passive === "plates";
      const plates = plated ? platesOf(p) : 0;
      const n = Math.max(
        1,
        a.perPlate !== undefined
          ? (a.count ?? 3) + a.perPlate * plates
          : (a.count ?? 3) * (1 + plates),
      );
      if (plated) {
        p.plates = 0;
        p.plateAt = this.time + PLATES.regrowDelay;
      }
      const fan = a.fan ?? 1.5;
      for (let i = 0; i < n; i++)
        projectile(n === 1 ? 0 : -fan / 2 + (fan * i) / (n - 1));
    }
    if (a.kind === "grapple") {
      // The tongue: the first enemy (or decoy) or wall along the aim.
      const dx = Math.cos(angle),
        dy = Math.sin(angle);
      const contact = projectileContact(
        p,
        { x: p.x + dx * a.range, y: p.y + dy * a.range },
        a.radius,
        currentObstacles(),
      );
      const reach = contact ? a.range * contact.fraction : a.range;
      let x = p.x + dx * a.range,
        y = p.y + dy * a.range,
        struck: Fighter | undefined,
        wall = false,
        burnt = false;
      for (let travelled = 0; travelled < a.range; travelled += 8) {
        if (contact && travelled >= reach) {
          x = contact.x;
          y = contact.y;
          wall = true;
          break;
        }
        x = p.x + dx * travelled;
        y = p.y + dy * travelled;
        // An enemy's Ember Curtain burns the tongue off, as it burns shots.
        if (this.curtainAt(p.id, { x, y }, a.radius)) {
          burnt = true;
          break;
        }
        const decoy = enemies.find(
          (e) =>
            e.clone &&
            Math.hypot(x - e.clone.x, y - e.clone.y) < a.radius + RULES.radius,
        );
        if (decoy) {
          decoy.clone = undefined;
          break;
        }
        struck = enemies.find(
          (e) =>
            e.hp > 0 &&
            Math.hypot(x - e.x, y - e.y) < a.radius + this.hitRadius(e),
        );
        if (struck) break;
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
      if (burnt) this.event("impact", { x, y }, color, undefined, p.id, a.id);
      let goal: { x: number; y: number } | undefined,
        gap = 0;
      if (struck) {
        this.damage(struck, a.damage, p.id, a);
        goal = struck;
        gap = this.hitRadius(struck) + this.hitRadius(p) + 4;
      } else if (wall) {
        // The tongue's tip (its own radius) touches the wall: end against it.
        goal = { x, y };
        gap = Math.max(2, RULES.radius - a.radius + 2);
      }
      const travel = goal ? Math.hypot(goal.x - p.x, goal.y - p.y) - gap : 0;
      if (goal && travel > 8) {
        // Zip along the tongue (a dash steered each tick by stepZip).
        const until = this.time + travel / a.speed + 0.25;
        this.zips.set(p.id, {
          target: struck?.id,
          x: goal.x,
          y: goal.y,
          gap,
          speed: a.speed,
          until,
        });
        this.rushes.delete(p.id);
        p.dashUntil = until;
        p.recoveryUntil = Math.max(
          p.recoveryUntil,
          this.time + travel / a.speed,
        );
        this.stepZip(p, 1 / RULES.tick);
      }
    }
    if (a.kind === "tunnel") {
      const slot = this.kit(p).skills.findIndex((k) => k.id === a.id);
      p.burrow = {
        until: this.time + a.duration,
        slot,
        haste: a.tunnel?.haste ?? 1,
      };
    }
    if (a.kind === "cyclone") {
      const slot = this.kit(p).skills.findIndex((k) => k.id === a.id);
      p.cyclone = { at: this.time, until: this.time + a.duration, slot };
      this.cycloneHits.set(p.id, new Map());
      this.status(p, "brace", a.duration);
    }
    if (
      (a.kind === "seedling" || a.kind === "timewarp") &&
      this.zones.length < RULES.maxZones
    ) {
      const aim = p.lastInput;
      // At the aim, over any cover in between (like every zone); an aim
      // inside a wall lands just short of it instead.
      const distance = Math.min(
        a.range,
        Math.hypot(aim.aimX - p.x, aim.aimY - p.y),
      );
      const at = {
        x: p.x + Math.cos(angle) * distance,
        y: p.y + Math.sin(angle) * distance,
      };
      const spot = blocked(at.x, at.y, 6)
        ? blinkLanding(p, angle, distance)
        : at;
      if (a.kind === "seedling") {
        // Past the limit, the oldest seedling withers.
        const mine = this.zones
          .filter(
            (z) =>
              z.owner === p.id &&
              z.ability.kind === "seedling" &&
              z.until > this.time,
          )
          .sort((m, n) => (m.born ?? 0) - (n.born ?? 0));
        for (const z of mine.slice(
          0,
          Math.max(0, mine.length - ((a.count ?? 3) - 1)),
        ))
          z.until = this.time;
      }
      this.zones.push({
        id: ++this.serial,
        owner: p.id,
        x: spot.x,
        y: spot.y,
        radius: a.radius,
        until: this.time + a.duration,
        nextTick: this.time,
        ability: a,
        color,
        born: this.time,
      });
    }
    if (a.kind === "swap") {
      // The enemy or own seedling nearest the aim, near enough to it and to us.
      const aim = { x: p.lastInput.aimX, y: p.lastInput.aimY };
      type Option = { x: number; y: number; fighter?: Fighter; zone?: Zone };
      const options: Option[] = [
        ...enemies
          .filter((e) => e.hp > 0 && !e.raidBoss && !this.has(e, "stealth"))
          .map((e): Option => ({ x: e.x, y: e.y, fighter: e })),
        ...this.zones
          .filter(
            (z) =>
              z.owner === p.id &&
              z.ability.kind === "seedling" &&
              z.until > this.time,
          )
          .map((z): Option => ({ x: z.x, y: z.y, zone: z })),
      ].filter(
        (o) =>
          Math.hypot(o.x - aim.x, o.y - aim.y) <=
            a.radius + (o.fighter ? this.hitRadius(o.fighter) : 0) &&
          Math.hypot(o.x - p.x, o.y - p.y) <= a.range,
      );
      const pick = options.sort(
        (m, n) =>
          Math.hypot(m.x - aim.x, m.y - aim.y) -
          Math.hypot(n.x - aim.x, n.y - aim.y),
      )[0];
      if (!pick) {
        // Nothing to swap with: most of the cooldown comes back.
        const slot = this.kit(p).skills.findIndex((k) => k.id === a.id);
        if (slot >= 0 && slot !== ULT_SLOT)
          p.cooldowns[slot] = Math.min(p.cooldowns[slot], this.time + 1.5);
      } else {
        const from = { x: p.x, y: p.y };
        p.x = pick.x;
        p.y = pick.y;
        p.vx = p.vy = 0;
        p.dashUntil = Math.min(p.dashUntil, this.time);
        if (pick.fighter) {
          const f = pick.fighter;
          f.x = from.x;
          f.y = from.y;
          f.vx = f.vy = 0;
          f.dashUntil = Math.min(f.dashUntil, this.time);
          this.rushes.delete(f.id);
          if (a.status) this.status(f, a.status, a.statusDuration ?? 1, p.id);
          this.event("burst", f, color, undefined, p.id, a.id);
          Object.assign(this.events[this.events.length - 1], {
            tx: p.x,
            ty: p.y,
          });
        } else if (pick.zone) {
          pick.zone.x = from.x;
          pick.zone.y = from.y;
        }
        this.event("burst", p, color, undefined, p.id, a.id);
        Object.assign(this.events[this.events.length - 1], {
          tx: from.x,
          ty: from.y,
        });
      }
    }
    if (a.kind === "screen" && this.zones.length < RULES.maxZones) {
      // A curtain across the aim, a little way ahead.
      const d = a.screen?.distance ?? 90;
      this.zones.push({
        id: ++this.serial,
        owner: p.id,
        x: p.x + Math.cos(angle) * d,
        y: p.y + Math.sin(angle) * d,
        radius: (a.screen?.length ?? 200) / 2,
        until: this.time + a.duration,
        nextTick: this.time + (a.tickDelay ?? 0.1),
        ability: a,
        color,
        born: this.time,
        angle: angle + Math.PI / 2,
      });
    }
    if (a.kind === "taunt") {
      for (const enemy of enemies)
        if (
          enemy.hp > 0 &&
          Math.hypot(enemy.x - p.x, enemy.y - p.y) <
            a.radius + this.hitRadius(enemy)
        )
          this.damage(enemy, a.damage, p.id, a);
      this.status(p, "brace", a.duration);
    }
    if (a.kind === "rewind") {
      // Back to where it was `seconds` ago (or the oldest place it remembers).
      const trail = this.trail.get(p.id) ?? [];
      const back = this.time - (a.rewind?.seconds ?? 2);
      const then = trail.find((m) => m.t >= back) ?? trail[0];
      if (then) {
        const from = { x: p.x, y: p.y };
        this.rushes.delete(p.id);
        this.stopZip(p);
        p.x = then.x;
        p.y = then.y;
        p.vx = p.vy = 0;
        p.dashUntil = Math.min(p.dashUntil, this.time);
        const lost = Math.max(0, then.hp - p.hp);
        if (lost > 0)
          this.heal(
            p,
            Math.min(a.rewind?.max ?? 30, lost * (a.rewind?.heal ?? 0.6)),
            a.id,
          );
        this.event("burst", p, color, undefined, p.id, a.id);
        Object.assign(this.events[this.events.length - 1], {
          tx: from.x,
          ty: from.y,
        });
        this.trail.set(p.id, []);
      }
    }
    if (a.kind === "tether") {
      // Live Wire: Coilemur runs faster to chase, wire or no wire.
      if (a.tether?.haste) this.status(p, "haste", a.tether.haste);
      // The enemy nearest the aim, within reach and in sight.
      const aim = { x: p.lastInput.aimX, y: p.lastInput.aimY };
      const target = enemies
        .filter(
          (e) =>
            e.hp > 0 &&
            // A stealthed enemy can't be picked out (Ink Cloud).
            !this.has(e, "stealth") &&
            Math.hypot(e.x - p.x, e.y - p.y) <= a.range + this.hitRadius(e) &&
            this.lineClear(p, e),
        )
        .sort(
          (m, n) =>
            Math.hypot(m.x - aim.x, m.y - aim.y) -
            Math.hypot(n.x - aim.x, n.y - aim.y),
        )[0];
      const slot = this.kit(p).skills.findIndex((k) => k.id === a.id);
      if (target)
        p.tether = {
          target: target.id,
          until: this.time + a.duration,
          nextTick: this.time + (a.tether?.tick ?? 0.25),
          skill: slot,
        };
      else if (slot >= 0 && slot !== ULT_SLOT && !a.tether?.haste)
        // Nobody in reach: most of the cooldown comes back (not for Live
        // Wire, whose speed burst would come back with it).
        p.cooldowns[slot] = Math.min(p.cooldowns[slot], this.time + 1.5);
    }
    if (a.kind === "gaze") {
      // Eyespot Flash: everyone near takes the hit; whoever is looking is stunned.
      for (const enemy of enemies) {
        if (
          enemy.hp <= 0 ||
          Math.hypot(enemy.x - p.x, enemy.y - p.y) >=
            a.radius + this.hitRadius(enemy) ||
          !this.lineClear(p, enemy)
        )
          continue;
        const toMe = Math.atan2(p.y - enemy.y, p.x - enemy.x);
        const off = Math.abs(
          Math.atan2(
            Math.sin(toMe - enemy.angle),
            Math.cos(toMe - enemy.angle),
          ),
        );
        this.damage(
          enemy,
          a.damage,
          p.id,
          off <= (a.gaze ?? 0.6) ? a : { ...a, status: undefined },
        );
      }
    }
    if (a.kind === "clamp" || a.kind === "throw") {
      // The nearest enemy in front, within reach.
      const target = enemies
        .filter((e) => e.hp > 0 && this.inArc(p, e, a.range, a.arc ?? 0.35))
        .sort(
          (m, n) =>
            Math.hypot(m.x - p.x, m.y - p.y) - Math.hypot(n.x - p.x, n.y - p.y),
        )[0];
      if (target && a.kind === "clamp") {
        // A combo-primed target (Magnetised) goes off at once.
        if (
          !combo.self &&
          combo.payoff === a.id &&
          hasMark(target, p.id, this.time)
        )
          this.fireClamp(target, p.id, a);
        else {
          target.statuses = target.statuses.filter(
            (s) => !(s.kind === "clamp" && s.by === p.id),
          );
          target.statuses.push({
            kind: "clamp",
            until: this.time + (a.fuse ?? 1.5),
            nextTick: this.time + (a.fuse ?? 1.5),
            by: p.id,
          });
          this.event("hit", target, color, 0, p.id, a.id);
        }
      }
      if (target && a.kind === "throw") {
        // Kraken Grasp: seize it now, hurl it when the hold runs out.
        if (a.status)
          this.status(target, a.status, a.statusDuration ?? 0.5, p.id);
        p.grab = {
          target: target.id,
          at: this.time + (a.hold ?? 0.5),
          skill: this.kit(p).skills.findIndex((k) => k.id === a.id),
        };
        this.holdGrabbed(p);
      }
    }
    if (a.kind === "pound") {
      // Mochi Pound: strike 1, 2 or 3 of the chain.
      const slot = this.kit(p).skills.findIndex((k) => k.id === a.id);
      const chain =
        p.pound && p.pound.skill === slot && this.time <= p.pound.until
          ? p.pound
          : undefined;
      const strikes = a.strikes ?? [a.damage];
      const step = Math.min(strikes.length, (chain?.step ?? 0) + 1);
      const last = step >= strikes.length;
      // Rites and EX scale every strike alike.
      const scale = a.damage / (strikes[0] || 1);
      const hit: Ability = {
        ...a,
        damage: Math.round(strikes[step - 1] * scale),
        knockback: last ? a.knockback : 30,
        status: last ? a.status : undefined,
      };
      this.event("burst", p, color, undefined, p.id, a.id);
      this.events[this.events.length - 1].step = step;
      for (const enemy of enemies)
        if (enemy.hp > 0 && this.inArc(p, enemy, a.range, a.arc ?? 0.3))
          this.damage(enemy, hit.damage, p.id, hit);
      if (slot >= 0 && slot !== ULT_SLOT) {
        if (last) p.pound = undefined;
        else {
          p.pound = {
            skill: slot,
            step,
            until: this.time + (a.chainWindow ?? 1.2),
            cdEnd: chain?.cdEnd ?? p.cooldowns[slot],
          };
          // The next strike is ready almost at once.
          p.cooldowns[slot] = Math.min(p.cooldowns[slot], this.time + 0.25);
        }
      }
    }
    if (a.kind === "cage" && this.zones.length < RULES.maxZones) {
      // Crystal Cage: whoever is inside stays in, whoever is outside stays out.
      const R = a.radius,
        until = this.time + a.duration;
      this.zones.push({
        id: ++this.serial,
        owner: p.id,
        x: p.x,
        y: p.y,
        radius: R,
        until,
        nextTick: until,
        ability: a,
        color,
        born: this.time,
      });
      for (const q of this.players) {
        if (q.hp <= 0 || q.out || q.raidBoss) continue;
        const inside = Math.hypot(q.x - p.x, q.y - p.y) < R;
        q.statuses.push({
          kind: "cage",
          until,
          nextTick: until,
          tx: p.x,
          ty: p.y,
          amount: R,
          inside,
        });
        if (inside && enemies.includes(q)) this.damage(q, a.damage, p.id, a);
      }
    }
    if (a.kind === "surf") {
      // River Dash: a dash through enemies; stepSurfs() hits whoever it passes.
      const seconds = a.range / Math.max(1, a.speed);
      p.dashX = Math.cos(angle) * a.speed;
      p.dashY = Math.sin(angle) * a.speed;
      p.dashUntil = this.time + seconds;
      p.recoveryUntil = Math.max(p.recoveryUntil, this.time + seconds);
      this.rushes.delete(p.id);
      this.surfs.set(p.id, {
        until: this.time + seconds,
        ability: a,
        slot: this.kit(p).skills.findIndex((k) => k.id === a.id),
        hit: new Set(),
      });
    }
    if (a.kind === "wave" && this.zones.length < RULES.maxZones)
      // Riptide Wave: a wall of water rolling from the caster along the aim.
      this.zones.push({
        id: ++this.serial,
        owner: p.id,
        x: p.x,
        y: p.y,
        radius: a.radius,
        until: this.time + a.range / Math.max(1, a.speed),
        nextTick: this.time,
        ability: a,
        color,
        born: this.time,
        angle,
      });
    if (a.kind === "storm" && this.zones.length < RULES.maxZones)
      // Thunderstorm: the storm itself (no area); it calls a wave of bolts
      // every tickInterval, the first one now.
      this.zones.push({
        id: ++this.serial,
        owner: p.id,
        x: p.x,
        y: p.y,
        radius: 0,
        until:
          this.time + ((a.count ?? 3) - 1) * (a.tickInterval ?? 0.8) + 0.05,
        nextTick: this.time,
        ability: a,
        color,
        born: this.time,
      });
    if (a.kind === "hunt" && this.zones.length < RULES.maxZones)
      // Wraith Hunt: the wraith leaves from the caster.
      this.zones.push({
        id: ++this.serial,
        owner: p.id,
        x: p.x,
        y: p.y,
        radius: a.radius,
        until: this.time + a.duration,
        nextTick: this.time + (a.tickDelay ?? 0.3),
        ability: a,
        color,
        born: this.time,
      });
    if (a.kind === "lure" && this.zones.length < RULES.maxZones) {
      // Radiant Flare: a light at the aim (stopped short of a wall), wider
      // when Kindled.
      const aim = p.lastInput;
      const at = blinkLanding(
        p,
        angle,
        Math.min(a.range, Math.hypot(aim.aimX - p.x, aim.aimY - p.y)),
      );
      const wide = selfPrimed ? (combo.radius ?? 1) : 1;
      this.zones.push({
        id: ++this.serial,
        owner: p.id,
        x: at.x,
        y: at.y,
        radius: a.radius * wide,
        until: this.time + a.duration,
        nextTick: this.time + a.duration,
        ability:
          wide === 1 ? a : { ...a, explosion: (a.explosion ?? 0) * wide },
        color,
        born: this.time,
      });
      if (selfPrimed) {
        // The callout only (the flare's own burst plays when it goes off).
        this.event("burst", p, color, undefined, p.id);
        this.events[this.events.length - 1].combo = combo.name;
      }
    }
    if (a.kind === "leap") {
      // Magma Leap: through the air toward the aim; stepLeaps() lands it.
      const aim = p.lastInput;
      const distance = Math.min(
        a.range,
        Math.hypot(aim.aimX - p.x, aim.aimY - p.y),
      );
      const seconds = Math.max(0.12, distance / Math.max(1, a.speed));
      p.dashX = (Math.cos(angle) * distance) / seconds;
      p.dashY = (Math.sin(angle) * distance) / seconds;
      p.dashUntil = this.time + seconds;
      p.jumpUntil = Math.max(p.jumpUntil, this.time + seconds);
      p.recoveryUntil = Math.max(p.recoveryUntil, this.time + seconds);
      this.rushes.delete(p.id);
      this.leaps.set(p.id, { until: this.time + seconds, ability: a });
    }
    if (a.kind === "creep") {
      // Chestnut Storm: blasts creeping along the aim, each a plain zone that
      // lands once (`tickDelay` after it is marked).
      const c = a.creep ?? { start: 160, step: 150, gap: 0.2 },
        delay = a.tickDelay ?? 0.6;
      for (let i = 0; i < (a.count ?? 5); i++) {
        if (this.zones.length >= RULES.maxZones) break;
        const d = c.start + c.step * i,
          at = this.time + i * c.gap;
        this.zones.push({
          id: ++this.serial,
          owner: p.id,
          x: Math.max(0, Math.min(RULES.width, p.x + Math.cos(angle) * d)),
          y: Math.max(0, Math.min(RULES.height, p.y + Math.sin(angle) * d)),
          radius: a.explosion ?? 105,
          until: at + delay + 0.1,
          nextTick: at + delay,
          ability: { ...a, kind: "zone", tickInterval: 9 },
          color,
          born: at,
        });
      }
    }
    if (a.kind === "garden" && this.zones.length < RULES.maxZones) {
      // Overgrowth: a garden at the aim (stopped short of a wall).
      const aim = p.lastInput;
      const at = blinkLanding(
        p,
        angle,
        Math.min(a.range, Math.hypot(aim.aimX - p.x, aim.aimY - p.y)),
      );
      this.zones.push({
        id: ++this.serial,
        owner: p.id,
        x: at.x,
        y: at.y,
        radius: a.radius,
        until: this.time + a.duration,
        nextTick: this.time + (a.tickDelay ?? 0.3),
        ability: a,
        color,
        born: this.time,
      });
    }
    if (a.bloom) {
      // Overgrowth: every seedling blooms at full growth, the moss grows full.
      for (const z of this.zones)
        if (
          z.owner === p.id &&
          z.ability.kind === "seedling" &&
          z.until > this.time
        )
          this.bloomSeed(z, (z.ability.seed?.stages.length ?? 1) - 1);
      if (CHARACTERS[p.character].passive === "moss") {
        p.moss = MOSS.max;
        p.mossAt = this.time + MOSS.shedEvery;
      }
    }
    if (a.kind === "trail") this.status(p, "haste", a.duration);
    if (a.kind === "trail" && this.zones.length < RULES.maxZones)
      // Spark Trail: laid behind the caster while it lasts, then it fades.
      this.zones.push({
        id: ++this.serial,
        owner: p.id,
        x: p.x,
        y: p.y,
        radius: a.radius,
        until: this.time + a.duration + (a.trail?.fade ?? 1.5),
        nextTick: this.time,
        ability: a,
        color,
        born: this.time,
        points: [{ x: p.x, y: p.y, t: this.time }],
      });
    if (a.kind === "steer" && this.zones.length < RULES.maxZones) {
      // Sunfire Pillar: rises at the aim, then follows it.
      const aim = p.lastInput;
      const distance = Math.min(
        a.range,
        Math.hypot(aim.aimX - p.x, aim.aimY - p.y),
      );
      this.zones.push({
        id: ++this.serial,
        owner: p.id,
        x: p.x + Math.cos(angle) * distance,
        y: p.y + Math.sin(angle) * distance,
        radius: a.radius,
        until: this.time + a.duration,
        nextTick: this.time + (a.tickDelay ?? 0.25),
        ability: a,
        color,
        born: this.time,
      });
    }
    if (a.kind === "veil") {
      this.status(p, "stealth", a.duration);
      this.status(p, "haste", a.statusDuration ?? 1.5);
    }
    if (a.kind === "counter") {
      this.status(p, "counter", a.duration);
      if (a.lunge) {
        // Facet Guard: vault toward the aim behind the guard.
        const distance = Math.min(
          a.lunge,
          Math.hypot(p.lastInput.aimX - p.x, p.lastInput.aimY - p.y),
        );
        const seconds = distance / Math.max(1, a.speed);
        p.dashX = Math.cos(angle) * a.speed;
        p.dashY = Math.sin(angle) * a.speed;
        p.dashUntil = this.time + seconds;
        p.recoveryUntil = Math.max(p.recoveryUntil, this.time + seconds);
      }
    }
    if (a.kind === "barrier") this.status(p, "shield", a.duration);
    if (a.kind === "buff") {
      // Kindle empowers; Static Glide grants haste instead.
      this.status(
        p,
        a.status ?? "empower",
        a.status ? (a.statusDuration ?? a.duration) : a.duration,
      );
      if (a.glide) p.jumpUntil = Math.max(p.jumpUntil, this.time + a.duration);
      if (a.pop) {
        // Takeoff pop: shoves nearby enemies away (knockback pushes from the caster) and slows them.
        // (The client draws the pop as part of the glide's own cast effect.)
        const pop: Ability = {
          ...a,
          kind: "nova",
          damage: a.pop.damage,
          knockback: a.pop.knockback,
          status: "slow",
          statusDuration: a.pop.slow,
          glide: undefined,
          pop: undefined,
        };
        for (const enemy of enemies)
          if (
            enemy.hp > 0 &&
            Math.hypot(enemy.x - p.x, enemy.y - p.y) <
              a.pop.radius + RULES.radius &&
            this.lineClear(p, enemy)
          )
            this.damage(enemy, pop.damage, p.id, pop);
      }
    }
    if (a.kind === "rest") {
      // Asleep by default; Shell Up rests in a shell instead (less damage, not more).
      const kind = a.status ?? "sleep";
      this.status(p, kind, a.duration);
      const sleep = p.statuses.find((s) => s.kind === kind)!;
      sleep.amount = a.heal ?? 0;
      // Ticks land at 0.4s, 0.9s … so a full Rest always heals duration / interval times.
      sleep.nextTick = this.time + STATUS_RULES.restInterval - 0.1;
      p.channel = undefined;
      if (a.burst)
        this.restBursts.set(p.id, { at: this.time + a.duration, ability: a });
    }
    if (a.kind === "clone") {
      p.clone = { x: p.x, y: p.y, until: this.time + a.duration };
      this.status(p, "haste", a.statusDuration ?? 2);
      // Tide Double: the axolotl regrows a little health as it slips away.
      if (a.heal) {
        const before = p.hp;
        p.hp = Math.min(
          maxHealth(p.character, this.mode, this.players.length),
          p.hp + a.heal,
        );
        p.stats.healed = (p.stats.healed ?? 0) + (p.hp - before);
      }
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
      this.event(
        "hazard",
        { x: r.x + r.w / 2, y: r.y + r.h / 2 },
        0xb59b6b,
        undefined,
        undefined,
        "hazard-wall",
      );
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
      this.event(
        "hazard",
        h,
        h.kind === "vent" ? 0xff7a3d : 0x4fd6e6,
        undefined,
        undefined,
        `hazard-${h.kind}`,
      );
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
  /** Haunted Lantern: shoot a wisp at the nearest enemy in the lantern's light. */
  private fireTurret(zone: Zone) {
    const t = zone.ability.turret!;
    if (this.projectiles.length >= RULES.maxProjectiles) return;
    const target = this.enemiesOfOwner(zone.owner)
      .filter(
        (e) =>
          e.hp > 0 &&
          !this.has(e, "stealth") &&
          Math.hypot(e.x - zone.x, e.y - zone.y) < t.range &&
          this.lineClear(zone, e),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - zone.x, a.y - zone.y) -
          Math.hypot(b.x - zone.x, b.y - zone.y),
      )[0];
    if (!target) return;
    const angle = Math.atan2(target.y - zone.y, target.x - zone.x);
    const shot = turretShot(zone.ability);
    this.projectiles.push({
      id: ++this.serial,
      owner: zone.owner,
      x: zone.x,
      y: zone.y,
      vx: Math.cos(angle) * t.speed,
      vy: Math.sin(angle) * t.speed,
      remaining: shot.range,
      ability: shot,
      color: zone.color,
    });
  }
  /**
   * A healing zone's tick: the owner's team inside it (owner included, at
   * `selfHeal` of the amount) regains health.
   */
  private healZone(zone: Zone) {
    const owner = this.players.find((p) => p.id === zone.owner);
    if (!owner || this.phase !== "playing") return;
    const a = zone.ability;
    for (const ally of this.players) {
      if (
        ally.hp <= 0 ||
        ally.out ||
        ally.raidBoss ||
        this.teamOf(ally) !== this.teamOf(owner) ||
        Math.hypot(ally.x - zone.x, ally.y - zone.y) >=
          zone.radius + RULES.radius
      )
        continue;
      const amount = a.heal! * (ally === owner ? (a.selfHeal ?? 1) : 1);
      const before = ally.hp;
      ally.hp = Math.min(
        maxHealth(ally.character, this.mode, this.players.length),
        ally.hp + amount,
      );
      const healed = ally.hp - before;
      if (healed <= 0) continue;
      ally.stats.healed = (ally.stats.healed ?? 0) + healed;
      this.event("heal", ally, 0x7dffb0, healed, ally.id, a.id);
    }
  }
  /**
   * Tongue Grapple: aim this tick's dash at the goal (an enemy is followed),
   * no further than the gap; at the goal (or out of time) the zip stops dead.
   */
  private stepZip(p: Fighter, dt: number) {
    const zip = this.zips.get(p.id);
    if (!zip) return;
    const target = zip.target
      ? this.players.find((q) => q.id === zip.target && q.hp > 0)
      : undefined;
    const gx = target?.x ?? zip.x,
      gy = target?.y ?? zip.y;
    const d = Math.hypot(gx - p.x, gy - p.y);
    const left = d - zip.gap;
    if (left <= 1 || this.time >= zip.until) {
      this.stopZip(p);
      return;
    }
    const speed = Math.min(zip.speed, left / dt);
    p.dashX = ((gx - p.x) / d) * speed;
    p.dashY = ((gy - p.y) / d) * speed;
    p.dashUntil = Math.max(p.dashUntil, this.time + dt);
  }
  private stopZip(p: Fighter) {
    if (!this.zips.delete(p.id)) return;
    p.dashUntil = Math.min(p.dashUntil, this.time);
    p.vx = p.vy = 0;
  }
  /** Halcyon Rewind's memory: where this fighter has been, the last 3 seconds. */
  private remember(p: Fighter) {
    const trail = this.trail.get(p.id) ?? [];
    trail.push({ t: this.time, x: p.x, y: p.y, hp: p.hp });
    while (trail.length && trail[0].t < this.time - 3) trail.shift();
    this.trail.set(p.id, trail);
  }
  /**
   * Gill Siphon: while the stream holds (in reach, in sight, the caster not
   * stunned), the target takes a tick of damage and the caster drinks its share.
   * Live Wire (`tether.yank`): a target that gets too far is yanked back
   * toward the caster, hurt and paralysed, and the wire snaps.
   */
  private stepTether(p: Fighter, disabled: boolean) {
    const t = p.tether!;
    const a = this.kit(p).skills[t.skill];
    const target = this.players.find((q) => q.id === t.target);
    if (
      !a ||
      !target ||
      target.hp <= 0 ||
      target.out ||
      // Slipping into stealth snaps the stream: it can't see its target.
      this.has(target, "stealth") ||
      disabled ||
      this.time >= t.until ||
      Math.hypot(target.x - p.x, target.y - p.y) >
        (a.tether?.breakRange ?? 470) + this.hitRadius(target) ||
      !this.lineClear(p, target)
    ) {
      p.tether = undefined;
      return;
    }
    const yank = a.tether?.yank;
    if (
      yank &&
      Math.hypot(target.x - p.x, target.y - p.y) >
        yank.at + this.hitRadius(target)
    ) {
      p.tether = undefined;
      this.event("burst", target, CHARACTERS[p.character].color, 0, p.id, a.id);
      this.damage(target, yank.damage, p.id, {
        ...a,
        damage: yank.damage,
        knockback: -yank.pull,
        status: yank.status,
        statusDuration: yank.statusDuration,
      });
      return;
    }
    if (this.time >= t.nextTick) {
      t.nextTick += a.tether?.tick ?? 0.25;
      this.damage(target, a.damage, p.id, a);
    }
  }
  /** Is a body (radius `r`) on this curtain? */
  onScreen(zone: Zone, body: { x: number; y: number }, r: number) {
    const ang = zone.angle ?? 0,
      ux = Math.cos(ang),
      uy = Math.sin(ang);
    const dx = body.x - zone.x,
      dy = body.y - zone.y;
    const along = dx * ux + dy * uy,
      across = Math.abs(-dx * uy + dy * ux);
    return Math.abs(along) <= zone.radius + r * 0.5 && across <= 14 + r;
  }
  /**
   * Static Clamp goes off on `target`: the hit (and its status), then an arc
   * to every other enemy of the clamper near it.
   */
  private fireClamp(target: Fighter, by: string, a: Ability) {
    target.statuses = target.statuses.filter(
      (s) => !(s.kind === "clamp" && s.by === by),
    );
    const owner = this.players.find((q) => q.id === by);
    const color = owner ? CHARACTERS[owner.character].color : 0x9fe8ff;
    this.event("burst", target, color, undefined, by, a.id);
    this.damage(target, a.damage, by, a);
    if (!owner) return;
    const arc: Ability = { ...a, damage: a.damage * (a.chain ?? 0.5) };
    for (const e of this.enemiesOf(owner))
      if (
        e !== target &&
        e.hp > 0 &&
        Math.hypot(e.x - target.x, e.y - target.y) <
          (a.explosion ?? 200) + this.hitRadius(e) &&
        this.lineClear(target, e)
      ) {
        // The arc: a bolt from the target to it.
        this.event("beam", target, color, undefined, by, a.id);
        Object.assign(this.events[this.events.length - 1], {
          tx: e.x,
          ty: e.y,
        });
        this.damage(e, arc.damage, by, arc);
      }
  }
  /** Kraken Grasp: keep the seized enemy in front of the thrower. */
  private holdGrabbed(p: Fighter) {
    const target = this.players.find((q) => q.id === p.grab?.target);
    if (!target || target.hp <= 0 || target.out) {
      p.grab = undefined;
      return;
    }
    if (target.raidBoss || this.has(target, "brace")) return;
    const x = p.x + Math.cos(p.angle) * 62,
      y = p.y + Math.sin(p.angle) * 62;
    if (!blocked(x, y)) {
      target.x = x;
      target.y = y;
      target.vx = target.vy = 0;
    }
  }
  /** Kraken Grasp: hurl the held enemy toward the thrower's aim. */
  private hurl(p: Fighter) {
    const grab = p.grab!;
    p.grab = undefined;
    const a = this.kit(p).skills[grab.skill];
    const target = this.players.find((q) => q.id === grab.target);
    if (!a || !target || target.hp <= 0 || target.out) return;
    const dir = { x: Math.cos(p.angle), y: Math.sin(p.angle) };
    const from = { x: target.x, y: target.y };
    let slam = false;
    if (!target.raidBoss && !this.has(target, "brace")) {
      const far = a.throw ?? 380;
      for (let d = 10; d <= far && !slam; d += 10)
        slam = blocked(from.x + dir.x * d, from.y + dir.y * d, RULES.radius);
      move(target, dir.x * far, dir.y * far);
      holdInCage(target, this.time);
    }
    const color = CHARACTERS[p.character].color;
    this.event("burst", target, color, undefined, p.id, a.id);
    Object.assign(this.events[this.events.length - 1], {
      tx: from.x,
      ty: from.y,
      ...(slam ? { slam: true } : {}),
    });
    const hit: Ability = {
      ...a,
      damage: a.damage * (slam ? (a.wallSlam ?? 1) : 1),
      status: undefined,
      knockback: 0,
    };
    this.damage(target, hit.damage, p.id, hit);
    // It lands on whoever is there.
    for (const e of this.enemiesOf(p))
      if (
        e !== target &&
        e.hp > 0 &&
        Math.hypot(e.x - target.x, e.y - target.y) <
          (a.explosion ?? 90) + this.hitRadius(e)
      )
        this.damage(e, a.damage / 2, p.id, {
          ...hit,
          damage: a.damage / 2,
          knockback: 60,
        });
  }
  /** Does a crystal cage stand between where this shot is and where it is going? */
  private caged(pr: Projectile, dt: number) {
    for (const z of this.zones) {
      if (z.ability.kind !== "cage" || z.until <= this.time) continue;
      const now = Math.hypot(pr.x - z.x, pr.y - z.y) - z.radius,
        next =
          Math.hypot(pr.x + pr.vx * dt - z.x, pr.y + pr.vy * dt - z.y) -
          z.radius;
      if (now < 0 !== next < 0) return true;
    }
    return false;
  }
  /**
   * Radiant Flare: the rays turn; an enemy a ray passes over takes a hit (once
   * per ray passing, through nothing solid).
   */
  /** Ball Lightning: every `aura.tick` the orb zaps the nearest enemy near it. */
  private zap(pr: Projectile) {
    const aura = pr.ability.aura!;
    if (this.time < (pr.nextZap ?? 0)) return;
    const target = this.enemiesOfOwner(pr.owner)
      .filter(
        (e) =>
          e.hp > 0 &&
          !this.has(e, "stealth") &&
          Math.hypot(e.x - pr.x, e.y - pr.y) <
            aura.radius + this.hitRadius(e) &&
          this.lineClear(pr, e),
      )
      .sort(
        (p, q) =>
          Math.hypot(p.x - pr.x, p.y - pr.y) -
          Math.hypot(q.x - pr.x, q.y - pr.y),
      )[0];
    if (!target) return;
    pr.nextZap = this.time + aura.tick;
    this.events.push({
      id: ++this.serial,
      kind: "beam",
      x: pr.x,
      y: pr.y,
      tx: target.x,
      ty: target.y,
      color: pr.color,
      owner: pr.owner,
      abilityId: pr.ability.id,
    });
    if (this.events.length > 80) this.events.shift();
    this.damage(target, aura.damage, pr.owner, {
      ...pr.ability,
      damage: aura.damage,
      knockback: 0,
    });
  }
  /** Magma Leap: a leap that has run its course lands in an eruption. */
  private stepLeaps() {
    if (!this.leaps.size) return;
    for (const [id, leap] of this.leaps) {
      const p = this.players.find((q) => q.id === id);
      if (!p || p.hp <= 0 || p.out) {
        this.leaps.delete(id);
        continue;
      }
      if (this.time < leap.until - 1e-9) continue;
      this.leaps.delete(id);
      const a = leap.ability;
      this.event(
        "burst",
        p,
        CHARACTERS[p.character].color,
        undefined,
        p.id,
        a.id,
      );
      for (const e of this.enemiesOf(p))
        if (
          e.hp > 0 &&
          Math.hypot(e.x - p.x, e.y - p.y) <
            (a.explosion ?? 110) + this.hitRadius(e) &&
          this.lineClear(p, e)
        )
          this.damage(e, a.damage, p.id, a);
    }
  }
  /**
   * Overgrowth: every `tickInterval` enemies on the garden are hurt and
   * slowed; at the end whoever is still on it takes the burst and is rooted.
   */
  private stepGarden(zone: Zone) {
    const a = zone.ability;
    const end = this.time >= zone.until - 1e-9;
    const tick = !end && this.time >= zone.nextTick;
    if (tick) zone.nextTick += a.tickInterval ?? 0.5;
    if (!end && !tick) return;
    if (end) this.event("burst", zone, zone.color, undefined, zone.owner, a.id);
    for (const enemy of this.enemiesOfOwner(zone.owner))
      if (
        enemy.hp > 0 &&
        Math.hypot(enemy.x - zone.x, enemy.y - zone.y) <
          zone.radius + this.hitRadius(enemy) * 0.5
      )
        this.damage(
          enemy,
          end ? (a.garden?.burst ?? 20) : a.damage,
          zone.owner,
          end ? a : { ...a, status: "slow", statusDuration: 0.6 },
        );
    zone.until = end ? this.time : zone.until;
  }
  /** River Dash: whoever the dashing body passes is hit once; the dash's end refunds the cooldown. */
  private stepSurfs() {
    if (!this.surfs.size) return;
    for (const [id, surf] of this.surfs) {
      const p = this.players.find((q) => q.id === id);
      if (!p || p.hp <= 0 || p.out) {
        this.surfs.delete(id);
        continue;
      }
      for (const e of this.enemiesOf(p))
        if (
          e.hp > 0 &&
          !surf.hit.has(e.id) &&
          Math.hypot(e.x - p.x, e.y - p.y) <
            this.hitRadius(e) + this.hitRadius(p) + RUSH_CONTACT
        ) {
          surf.hit.add(e.id);
          this.damage(e, surf.ability.damage, p.id, surf.ability);
        }
      if (this.time < surf.until - 1e-9) continue;
      this.surfs.delete(id);
      // Went through someone: the cooldown drops to the refund.
      if (surf.hit.size && surf.slot >= 0 && surf.ability.surf)
        p.cooldowns[surf.slot] = Math.min(
          p.cooldowns[surf.slot],
          this.time + surf.ability.surf.refund * this.cooldownScale(p),
        );
    }
  }
  /** How far a wave's front has rolled from where it started (px). */
  /** Shell Up: the shell bursts open, shoving and hurting everyone close. */
  private shellBurst(p: Fighter, a: Ability) {
    const b = a.burst!;
    this.event("burst", p, CHARACTERS[p.character].color, b.radius, p.id, a.id);
    for (const enemy of this.enemiesOf(p))
      if (
        enemy.hp > 0 &&
        Math.hypot(enemy.x - p.x, enemy.y - p.y) <
          b.radius + this.hitRadius(enemy) &&
        this.lineClear(p, enemy)
      )
        this.damage(enemy, b.damage, p.id, {
          ...a,
          damage: b.damage,
          knockback: b.knockback,
          status: undefined,
        });
  }
  waveFront(zone: Zone) {
    return Math.min(
      zone.ability.range,
      (this.time - (zone.born ?? this.time)) * zone.ability.speed,
    );
  }
  /**
   * Riptide Wave: its front hits each enemy it reaches once, then carries it
   * along (the drift Undertow used, so clients predict it) until the carry
   * runs out; a wall in the way slams it.
   */
  private stepWave(zone: Zone) {
    const second = zone.ability.wave?.second;
    if (
      second &&
      !this.waveFollowed.has(zone.id) &&
      this.time >= (zone.born ?? this.time) + second
    ) {
      // The second wall rolls out from where the first one started.
      this.waveFollowed.add(zone.id);
      if (this.zones.length < RULES.maxZones) {
        const id = ++this.serial;
        this.waveFollowed.add(id);
        this.zones.push({
          ...zone,
          id,
          born: this.time,
          nextTick: this.time,
          until:
            this.time + zone.ability.range / Math.max(1, zone.ability.speed),
        });
      }
    }
    const a = zone.ability,
      ux = Math.cos(zone.angle ?? 0),
      uy = Math.sin(zone.angle ?? 0),
      front = this.waveFront(zone);
    for (const enemy of this.enemiesOfOwner(zone.owner)) {
      if (enemy.hp <= 0) continue;
      const key = `${zone.id}:${enemy.id}`,
        r = this.hitRadius(enemy),
        dx = enemy.x - zone.x,
        dy = enemy.y - zone.y,
        along = dx * ux + dy * uy,
        across = Math.abs(-dx * uy + dy * ux);
      const carry = this.carried.get(key);
      if (carry === undefined) {
        if (
          enemy.jumpUntil > this.time ||
          across > zone.radius + r ||
          along > front + r ||
          along < front - 60
        )
          continue;
        this.carried.set(key, this.time + (a.wave?.carry ?? 0.5));
        this.damage(enemy, a.damage, zone.owner, { ...a, status: undefined });
        continue;
      }
      if (carry <= this.time || enemy.raidBoss) continue;
      // Carried into a wall: slammed, and the carry ends.
      if (
        a.wallSlam &&
        blocked(enemy.x + ux * 14, enemy.y + uy * 14, RULES.radius)
      ) {
        this.carried.set(key, this.time);
        this.event("burst", enemy, zone.color, undefined, zone.owner, a.id);
        this.events[this.events.length - 1].slam = true;
        this.damage(enemy, a.damage * a.wallSlam, zone.owner, a);
        continue;
      }
      const old = enemy.statuses.find((s) => s.kind === "current");
      const vx = ux * a.speed,
        vy = uy * a.speed;
      if (old)
        Object.assign(old, { until: this.time + CURRENT_HOLD, tx: vx, ty: vy });
      else
        enemy.statuses.push({
          kind: "current",
          until: this.time + CURRENT_HOLD,
          nextTick: this.time + CURRENT_HOLD,
          tx: vx,
          ty: vy,
          by: zone.owner,
        });
    }
  }
  /**
   * Thunderstorm: a bolt ahead of the enemy nearest the caster's aim (not a
   * stealthed one). One target, not every enemy: a storm on every foe grew
   * with their number (Spire waves, 2v2, free-for-all).
   */
  private stepStorm(zone: Zone) {
    if (this.time < zone.nextTick) return;
    const a = zone.ability;
    zone.nextTick += a.tickInterval ?? 0.8;
    const owner = this.players.find((q) => q.id === zone.owner);
    if (!owner || owner.hp <= 0 || owner.out) return;
    const delay = a.tickDelay ?? 0.55;
    // Each bolt is aimed half its delay ahead of where the enemy is going.
    const lead = delay * 0.5;
    const aim = owner.lastInput;
    const enemy = this.enemiesOf(owner)
      .filter((e) => e.hp > 0 && !e.out && !this.has(e, "stealth"))
      .sort(
        (p, q) =>
          Math.hypot(p.x - aim.aimX, p.y - aim.aimY) -
          Math.hypot(q.x - aim.aimX, q.y - aim.aimY),
      )[0];
    if (enemy && this.zones.length < RULES.maxZones)
      this.zones.push({
        id: ++this.serial,
        owner: zone.owner,
        x: Math.max(0, Math.min(RULES.width, enemy.x + enemy.vx * lead)),
        y: Math.max(0, Math.min(RULES.height, enemy.y + enemy.vy * lead)),
        radius: a.explosion ?? 75,
        until: this.time + delay + 0.05,
        nextTick: this.time + delay,
        // Each bolt is a plain zone that strikes once.
        ability: {
          ...a,
          kind: "zone",
          duration: delay + 0.05,
          tickInterval: 9,
        },
        color: zone.color,
        born: this.time,
      });
  }
  /**
   * Wraith Hunt: the wraith drifts through walls toward the nearest enemy
   * that isn't stealthed; its touch hurts, and reaps the badly hurt.
   */
  private stepHunt(zone: Zone, dt: number) {
    const a = zone.ability;
    const owner = this.players.find((q) => q.id === zone.owner);
    if (!owner || owner.hp <= 0 || owner.out) {
      zone.until = this.time;
      return;
    }
    const prey = this.enemiesOf(owner)
      .filter((e) => e.hp > 0 && !e.out && !this.has(e, "stealth"))
      .sort(
        (p, q) =>
          Math.hypot(p.x - zone.x, p.y - zone.y) -
          Math.hypot(q.x - zone.x, q.y - zone.y),
      )[0];
    if (prey) {
      const dx = prey.x - zone.x,
        dy = prey.y - zone.y,
        d = Math.hypot(dx, dy),
        step = Math.min(d, (a.hunt?.speed ?? 215) * dt);
      if (d > 0.5) {
        zone.x += (dx / d) * step;
        zone.y += (dy / d) * step;
      }
    }
    if (this.time < zone.nextTick) return;
    zone.nextTick += a.tickInterval ?? 0.4;
    for (const enemy of this.enemiesOf(owner)) {
      if (
        enemy.hp <= 0 ||
        Math.hypot(enemy.x - zone.x, enemy.y - zone.y) >
          zone.radius + this.hitRadius(enemy)
      )
        continue;
      this.damage(enemy, a.damage, owner.id, a);
      // Reaped: a champion this badly hurt is taken (never a raid boss).
      const full = maxHealth(enemy.character, this.mode, this.players.length);
      if (
        enemy.hp > 0 &&
        !enemy.raidBoss &&
        enemy.hp < full * (a.hunt?.execute ?? 0)
      ) {
        this.event("burst", enemy, zone.color, undefined, owner.id, a.id);
        this.events[this.events.length - 1].combo = "REAPED";
        this.damage(enemy, enemy.hp * 10, owner.id, { ...a, damage: 0 });
      }
    }
  }
  /** Radiant Flare: enemies near the light are drawn in; at the end it bursts. */
  private stepLure(zone: Zone) {
    const a = zone.ability;
    const bursting = this.time >= zone.nextTick;
    if (bursting) zone.nextTick = Infinity;
    if (bursting)
      this.event("burst", zone, zone.color, undefined, zone.owner, a.id);
    for (const enemy of this.enemiesOfOwner(zone.owner)) {
      if (enemy.hp <= 0) continue;
      const dx = zone.x - enemy.x,
        dy = zone.y - enemy.y,
        d = Math.hypot(dx, dy);
      if (bursting) {
        if (d < (a.explosion ?? 140) + this.hitRadius(enemy))
          this.damage(enemy, a.damage, zone.owner, a);
        continue;
      }
      if (enemy.raidBoss || d > zone.radius + this.hitRadius(enemy)) continue;
      const pull = {
        until: this.time + CURRENT_HOLD,
        tx: zone.x,
        ty: zone.y,
        amount: a.lure?.speed ?? 150,
      };
      const old = enemy.statuses.find((s) => s.kind === "lure");
      if (old) Object.assign(old, pull);
      else
        enemy.statuses.push({
          kind: "lure",
          nextTick: pull.until,
          by: zone.owner,
          ...pull,
        });
    }
  }
  /**
   * Spark Trail: the caster lays points while it lasts; each fades after
   * `trail.fade`. An enemy touching any of them takes the hit (once per tick).
   */
  private stepTrail(zone: Zone) {
    const a = zone.ability,
      owner = this.players.find((q) => q.id === zone.owner),
      laying = this.time < (zone.born ?? 0) + a.duration;
    const pts = (zone.points ??= []);
    if (laying && owner && owner.hp > 0 && !owner.out) {
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(owner.x - last.x, owner.y - last.y) >= 18)
        pts.push({ x: owner.x, y: owner.y, t: this.time });
      zone.x = owner.x;
      zone.y = owner.y;
    }
    const fade = a.trail?.fade ?? 1.5;
    while (pts.length && pts[0].t < this.time - fade) pts.shift();
    if (!pts.length) {
      if (!laying) zone.until = this.time;
      return;
    }
    for (const enemy of this.enemiesOfOwner(zone.owner)) {
      if (enemy.hp <= 0 || enemy.jumpUntil > this.time) continue;
      const r = a.radius + this.hitRadius(enemy) * 0.6;
      if (!pts.some((q) => Math.hypot(enemy.x - q.x, enemy.y - q.y) < r))
        continue;
      const key = `${zone.id}:${enemy.id}`;
      if (this.time - (this.rayHits.get(key) ?? -99) < (a.tickInterval ?? 0.5))
        continue;
      this.rayHits.set(key, this.time);
      this.damage(enemy, a.damage, zone.owner, a);
    }
  }
  /** Does a curtain against this shot's owner stand where the shot is? */
  private screened(pr: Projectile) {
    return this.curtainAt(pr.owner, pr, pr.ability.radius);
  }
  /** Does a curtain against `owner` stand at this point (a shot or a tongue)? */
  private curtainAt(
    owner: string,
    at: { x: number; y: number },
    radius: number,
  ) {
    return this.zones.some(
      (z) =>
        z.ability.kind === "screen" &&
        z.until > this.time &&
        this.rivals(z.owner, owner) &&
        this.onScreen(z, at, radius),
    );
  }
  /**
   * A boomerang: out for its range (a wall turns it early), then back to its
   * thrower through anything, hitting each enemy once a pass. Gone when it
   * gets home (or its thrower does not exist).
   */
  private stepBoomerang(pr: Projectile, dt: number) {
    const owner = this.players.find((q) => q.id === pr.owner);
    if (!owner || owner.hp <= 0 || owner.out) return false;
    if (this.screened(pr)) {
      this.event("impact", pr, pr.color, undefined, pr.owner, pr.ability.id);
      return false;
    }
    const speed = Math.hypot(pr.vx, pr.vy) || pr.ability.speed;
    if (pr.back) {
      const d = Math.hypot(owner.x - pr.x, owner.y - pr.y);
      if (d < RULES.radius + 6) return false;
      pr.vx = ((owner.x - pr.x) / d) * speed;
      pr.vy = ((owner.y - pr.y) / d) * speed;
    }
    const steps = Math.max(1, Math.ceil((speed * dt) / 10));
    for (let i = 0; i < steps; i++) {
      const next = {
        x: pr.x + (pr.vx * dt) / steps,
        y: pr.y + (pr.vy * dt) / steps,
      };
      if (!pr.back) {
        const contact = projectileContact(
          pr,
          next,
          pr.ability.radius,
          currentObstacles(),
        );
        pr.remaining -= (speed * dt) / steps;
        if (contact || pr.remaining <= 0) {
          // Turn round here, and start a new pass.
          pr.x = contact?.x ?? next.x;
          pr.y = contact?.y ?? next.y;
          pr.back = true;
          pr.hit = [];
          this.event(
            "impact",
            pr,
            pr.color,
            undefined,
            pr.owner,
            pr.ability.id,
          );
          return true;
        }
      }
      if (pr.back) pr.remaining -= (speed * dt) / steps;
      pr.x = next.x;
      pr.y = next.y;
      for (const enemy of this.enemiesOfOwner(pr.owner))
        if (
          enemy.hp > 0 &&
          !(pr.hit ?? []).includes(enemy.id) &&
          Math.hypot(pr.x - enemy.x, pr.y - enemy.y) <
            this.hitRadius(enemy) + pr.ability.radius
        ) {
          pr.hit = [...(pr.hit ?? []), enemy.id];
          this.event(
            "impact",
            pr,
            pr.color,
            undefined,
            pr.owner,
            pr.ability.id,
          );
          this.damage(enemy, pr.ability.damage, pr.owner, pr.ability);
        }
    }
    // Lost on the way back for too long: drop it.
    return pr.remaining > -pr.ability.range * 3 || !pr.back;
  }
  /**
   * Passives, after the fighter moved: Pangrove's plates grow back; Mossloth's
   * moss grows while it stands still and falls off as it moves, and heals.
   */
  private stepPassive(p: Fighter, dt: number) {
    const passive = CHARACTERS[p.character].passive;
    if (passive === "plates") {
      if (platesOf(p) < PLATES.max && this.time >= (p.plateAt ?? 0)) {
        p.plates = platesOf(p) + 1;
        p.plateAt = this.time + PLATES.regrowEvery;
        this.event("burst", p, 0x9be37a, p.plates, p.id, "plate-grow");
      }
    } else if (passive === "moss") {
      const still =
        Math.hypot(p.vx, p.vy) < MOSS.stillSpeed && this.time >= p.dashUntil;
      const moss = p.moss ?? 0;
      if (still !== p.mossStill) {
        p.mossStill = still;
        p.mossAt = this.time + (still ? MOSS.growEvery : MOSS.shedEvery);
      } else if (this.time >= (p.mossAt ?? 0)) {
        if (still && moss < MOSS.max) {
          p.moss = moss + 1;
          p.mossAt = this.time + MOSS.growEvery;
        } else if (!still && moss > 0) {
          p.moss = moss - 1;
          p.mossAt = this.time + MOSS.shedEvery;
        }
      }
      if (p.moss && this.phase === "playing") {
        const before = p.hp;
        p.hp = Math.min(
          maxHealth(p.character, this.mode, this.players.length),
          p.hp + p.moss * MOSS.regen * dt,
        );
        p.stats.healed = (p.stats.healed ?? 0) + (p.hp - before);
      }
    }
  }
  /**
   * Leaf Storm: is this enemy on a blade's spoke (the stream of leaves from
   * Pangrove out to the blade, `cyclone.blade` px wide either side)?
   */
  private sweptBy(
    p: Fighter,
    blade: { x: number; y: number },
    enemy: Fighter,
    a: Ability,
  ) {
    const reach = (a.cyclone?.blade ?? 30) + this.hitRadius(enemy);
    const bx = blade.x - p.x,
      by = blade.y - p.y,
      len = Math.hypot(bx, by) || 1;
    const ex = enemy.x - p.x,
      ey = enemy.y - p.y;
    const along = Math.max(0, Math.min(len, (ex * bx + ey * by) / len));
    return Math.hypot(ex - (bx / len) * along, ey - (by / len) * along) < reach;
  }
  /**
   * Leaf Storm: each blade circling the caster sweeps the enemies on its
   * spoke (each at most once every `tickInterval`); the storm bursts when
   * it ends.
   */
  private stepCyclones() {
    for (const p of this.players) {
      if (!p.cyclone || p.hp <= 0 || p.out) continue;
      if (this.time >= p.cyclone.until) {
        this.endCyclone(p);
        continue;
      }
      const a = this.kit(p).skills[p.cyclone.slot];
      // Underground, the blades go down with it.
      if (!a || this.burrowed(p)) continue;
      const hits = this.cycloneHits.get(p.id) ?? new Map<string, number>();
      this.cycloneHits.set(p.id, hits);
      const blades = cycloneBlades(p, a, this.time);
      for (const enemy of this.enemiesOf(p)) {
        if (
          enemy.hp <= 0 ||
          this.time <
            (hits.get(enemy.id) ?? -Infinity) + (a.tickInterval ?? 0.35)
        )
          continue;
        if (!blades.some((b) => this.sweptBy(p, b, enemy, a))) continue;
        hits.set(enemy.id, this.time);
        this.damage(enemy, a.damage, p.id, a);
      }
    }
  }
  /**
   * Rushes in progress: the first enemy the charger touches takes the hit
   * (everyone near it too, with `explosion`) and the charge stops there.
   */
  private stepRushes() {
    if (!this.rushes.size) return;
    this.walls();
    for (const [id, rush] of this.rushes) {
      const p = this.players.find((q) => q.id === id);
      if (!p || p.hp <= 0 || p.out || this.time > rush.until) {
        this.rushes.delete(id);
        continue;
      }
      const hit = this.enemiesOf(p).find(
        (e) =>
          e.hp > 0 &&
          Math.hypot(e.x - p.x, e.y - p.y) <
            this.hitRadius(e) + this.hitRadius(p) + RUSH_CONTACT,
      );
      if (!hit) continue;
      this.rushes.delete(id);
      p.dashUntil = this.time;
      p.vx = p.vy = 0;
      const a = rush.ability;
      // Wall slam: would the knockback drive the target into a wall?
      let slam = false;
      if (a.wallSlam) {
        const dir = normalize(hit.x - p.x, hit.y - p.y);
        for (let d = 10; d <= a.knockback && !slam; d += 10)
          slam = blocked(hit.x + dir.x * d, hit.y + dir.y * d, RULES.radius);
      }
      const main: Ability = slam
        ? {
            ...a,
            damage: a.damage * a.wallSlam!,
            statusDuration: (a.statusDuration ?? 0.35) * 2,
          }
        : a;
      this.event(
        "burst",
        hit,
        CHARACTERS[p.character].color,
        undefined,
        p.id,
        a.id,
      );
      if (slam) this.events[this.events.length - 1].slam = true;
      const victims = a.explosion
        ? this.enemiesOf(p).filter(
            (e) =>
              e.hp > 0 &&
              Math.hypot(e.x - hit.x, e.y - hit.y) <
                a.explosion! + this.hitRadius(e),
          )
        : [hit];
      for (const v of victims)
        if (v === hit) this.damage(v, main.damage, p.id, main);
        else this.damage(v, a.damage, p.id, a);
    }
  }
  /** A wall contact, range expiry or direct exploding-projectile hit. */
  private projectileImpact(pr: Projectile) {
    this.event("impact", pr, pr.color, undefined, pr.owner, pr.ability.id);
    if (pr.ability.explosion)
      for (const enemy of this.enemiesOfOwner(pr.owner))
        if (
          enemy.hp > 0 &&
          Math.hypot(pr.x - enemy.x, pr.y - enemy.y) <
            pr.ability.explosion + this.hitRadius(enemy) &&
          this.lineClear(pr, enemy)
        )
          this.damage(enemy, pr.ability.damage, pr.owner, pr.ability);
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
    if (this.phase !== "playing") this.clearBufferedSkills();
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
    if (this.phase === "playing") this.playTime += dt;
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
        this.cast(target, PRACTICE_GRID);
      }
    }
    for (const [id, brain] of this.bots) {
      const bot = this.players.find((p) => p.id === id);
      if (bot) bot.lastInput = this.botInput(bot, brain.think(this, bot));
    }
    for (const p of this.players) {
      // Every mode can have a knocked-out fighter while others still fight.
      if (p.out || p.hp <= 0) {
        this.stopKnockedOut(p);
        continue;
      }
      // Static Clamp: a charge that has run out goes off.
      for (const s of p.statuses.filter(
        (x) => x.kind === "clamp" && x.until <= this.time + 1e-9,
      )) {
        const by = this.players.find((q) => q.id === s.by);
        const a = by && this.kit(by).skills.find((k) => k.kind === "clamp");
        if (a) this.fireClamp(p, s.by!, a);
      }
      if (p.hp <= 0) continue;
      p.statuses = p.statuses.filter((s) => s.until > this.time);
      for (const s of p.statuses) {
        if (p.hp <= 0) break;
        if (
          (s.kind === "sleep" || s.kind === "shell") &&
          s.amount &&
          this.time >= s.nextTick
        ) {
          s.nextTick += STATUS_RULES.restInterval;
          const before = p.hp;
          p.hp = Math.min(
            maxHealth(p.character, this.mode, this.players.length),
            p.hp + s.amount,
          );
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
      // A burn tick above can kill this fighter before their queued action.
      if (p.hp <= 0) {
        this.stopKnockedOut(p);
        continue;
      }
      const input = p.lastInput;
      const freeCooldowns =
        !!this.practice?.unlimitedCooldowns && p === this.players[0];
      this.chargeUlt(p, RULES.ultPerSecond * dt);
      if (p.jumpUntil > this.time - dt && p.jumpUntil <= this.time)
        this.event("land", p, CHARACTERS[p.character].color, undefined, p.id);
      const disabled = p.statuses.some((s) =>
        DISABLING_STATUSES.includes(s.kind),
      );
      if (disabled) {
        this.clearBufferedSkills(p.id);
        p.charge = undefined;
        p.channel = undefined;
        // A stun or freeze stops a charge in its tracks (and uncurls a ball).
        if (
          this.rushes.delete(p.id) ||
          this.surfs.delete(p.id) ||
          this.leaps.delete(p.id)
        )
          p.dashUntil = Math.min(p.dashUntil, this.time);
        this.unburrow(p);
      }
      // Rooted: no dashing, and a charge stops where it is.
      const rooted = this.has(p, "root");
      if (
        rooted &&
        (this.rushes.delete(p.id) ||
          this.surfs.delete(p.id) ||
          this.leaps.delete(p.id))
      )
        p.dashUntil = Math.min(p.dashUntil, this.time);
      // Grounded (Sticky Mochi): no dashing or jumping either.
      const noDash = rooted || this.has(p, "grounded");
      if (p.burrow && this.time >= p.burrow.until) this.unburrow(p);
      // Late inputs for held ticks: a step each, at the held tick's time,
      // as the phone predicted them (drainInputs). A dash pressed in one
      // starts at its own step.
      const late = this.lateSteps.get(p.id);
      if (late) {
        this.lateSteps.delete(p.id);
        for (const s of late) {
          if (
            s.input.dash &&
            !disabled &&
            !noDash &&
            !p.burrow &&
            s.time >= p.dashAt
          ) {
            this.startDash(p, s.input, s.time, freeCooldowns);
            input.dash = false;
          }
          advanceMovement(p, s.input, dt, s.time);
        }
      }
      if (
        input.dash &&
        !disabled &&
        !noDash &&
        !p.burrow &&
        this.time >= p.dashAt
      )
        this.startDash(p, input, this.time, freeCooldowns);
      if (
        input.jump &&
        !disabled &&
        !this.has(p, "grounded") &&
        this.time >= p.jumpAt &&
        this.time >= p.jumpUntil
      ) {
        p.jumpUntil = this.time + RULES.jumpDuration;
        p.jumpAt = freeCooldowns ? 0 : this.time + RULES.jumpCooldown;
        this.event("jump", p, CHARACTERS[p.character].color, undefined, p.id);
      }
      if (this.zips.has(p.id)) {
        if (disabled || rooted) this.stopZip(p);
        else this.stepZip(p, dt);
      }
      // A taunt points at where the taunter is now (gone: it ends).
      for (const s of p.statuses)
        if (s.kind === "taunt") {
          const by = this.players.find(
            (q) => q.id === s.by && q.hp > 0 && !q.out,
          );
          if (by) {
            s.tx = by.x;
            s.ty = by.y;
          } else s.until = this.time;
        }
      // Held: nothing arrived for this tick, so it waits for the late input
      // (drainInputs) rather than walking on in the old direction.
      if (this.heldNow.delete(p.id)) {
        const q = this.inputQueues.get(p.id);
        // (A debt just forgotten dates nothing: the tick simply waits.)
        if (q && q.heldAt.length < q.owed) q.heldAt.push(this.time);
      } else advanceMovement(p, input, dt, this.time);
      this.stepPassive(p, dt);
      this.remember(p);
      if (p.tether) this.stepTether(p, disabled);
      if (p.grab) {
        if (this.time >= p.grab.at - 1e-9) this.hurl(p);
        else this.holdGrabbed(p);
      }
      if (p.pound && this.time > p.pound.until) {
        // The chain lapsed: the cooldown runs from its first strike.
        p.cooldowns[p.pound.skill] = Math.max(
          p.cooldowns[p.pound.skill],
          p.pound.cdEnd,
        );
        p.pound = undefined;
      }
      if (p.charge && this.time >= p.charge.at) {
        const a = this.kit(p).skills[p.charge.skill];
        this.cast(p, p.charge.ex ? exAbility(a) : a, p.charge.ex);
        p.charge = undefined;
      }
      const buffered = this.bufferedSkills.get(p.id);
      if (buffered && this.time > buffered.until)
        this.clearBufferedSkills(p.id);
      else if (buffered && !disabled) {
        input.skill = buffered.slot;
        input.ex = buffered.ex;
      }
      if (p.burrow) {
        // Underground: no attacks; casting Tunnel again surfaces, and the
        // ultimate (Leaf Storm) bursts straight up out of it.
        if (input.skill === p.burrow.slot) {
          this.clearBufferedSkills(p.id);
          this.unburrow(p);
          input.skill = -1;
        } else if (input.skill !== ULT_SLOT) input.skill = -1;
        input.basic = false;
      }
      // Silenced (Hush): no skills (a buffered one waits for it to end).
      if (this.has(p, "silence")) input.skill = -1;
      if (!disabled && this.time >= p.recoveryUntil && !p.charge) {
        const character = CHARACTERS[p.character];
        const kit = this.kit(p);
        if (
          input.skill >= 0 &&
          skillReady(p, input.skill, this.time, freeCooldowns)
        ) {
          this.clearBufferedSkills(p.id);
          // EX: a stronger skill 1-3 for a third of the ultimate meter.
          const ex =
            !!input.ex &&
            input.skill !== ULT_SLOT &&
            (freeCooldowns || (p.ult ?? 0) >= EX.cost);
          if (ex && !freeCooldowns) p.ult = (p.ult ?? 0) - EX.cost;
          const a = ex
            ? exAbility(kit.skills[input.skill])
            : kit.skills[input.skill];
          if (input.skill === ULT_SLOT) {
            // The ultimate spends the whole meter instead of a cooldown.
            if (!freeCooldowns) p.ult = 0;
            p.stats.ults = (p.stats.ults ?? 0) + 1;
            p.cooldowns[input.skill] = 0;
          } else
            p.cooldowns[input.skill] = freeCooldowns
              ? 0
              : this.time +
                a.cooldown *
                  (this.rule("turbo") ? MUTATOR_RULES.turboCooldown : 1) *
                  (this.gift(p, "Light") ?? 1) *
                  this.cooldownScale(p);
          p.stats.skills++;
          p.recoveryUntil =
            this.time +
            a.cast +
            a.recovery +
            (a.kind === "cone" ? a.duration : 0);
          if (a.cast)
            p.charge = { at: this.time + a.cast, skill: input.skill, ex };
          else this.cast(p, a, ex);
          if (ex) {
            // Shown over the caster like a combo callout.
            this.event("burst", p, 0xffd166, undefined, p.id, "ex-cast");
            this.events[this.events.length - 1].combo = `EX ${a.name}`;
          }
        } else if (input.basic && this.time >= p.basicAt - 1e-9) {
          // The interval is enforced here, so flooding inputs cannot fire faster.
          // Attacks only happen on ticks, so scheduling the next one from this
          // tick would round every interval up to a whole tick (335 ms became
          // 367 ms). When the attack fires on the first tick after it was due
          // (the button is held), the next one is due an interval after that.
          const due = p.basicAt;
          const held = due > 0 && this.time - due <= dt + 1e-6;
          p.basicAt =
            (held ? due : this.time) +
            basicInterval(
              character,
              this.has(p, "empower"),
              this.mode,
              this.players.length,
            ) *
              (this.gift(p, "Electric") ?? 1);
          p.recoveryUntil = this.time + kit.basic.recovery;
          this.cast(p, kit.basic);
        }
      }
      input.dash = false;
      input.basic = false;
      input.jump = false;
      input.skill = -1;
      input.ex = false;
      if (p.clone && p.clone.until <= this.time) p.clone = undefined;
      const shell = this.restBursts.get(p.id);
      if (shell && this.time >= shell.at) {
        this.restBursts.delete(p.id);
        if (p.hp > 0 && !p.out) this.shellBurst(p, shell.ability);
      }
      if (p.channel) {
        const a = this.kit(p).skills[p.channel.skill];
        if (a && this.time >= p.channel.nextTick) {
          p.channel.nextTick += a.tickInterval ?? 0.2;
          // Crest Flare: the flame reaches further as the breath goes on.
          const grown =
            (a.cone?.grow ?? 0) *
            Math.min(1, 1 - (p.channel.until - this.time) / a.duration);
          for (const enemy of this.enemiesOf(p)) {
            const key = `${p.id}:${enemy.id}`;
            if (
              enemy.hp > 0 &&
              this.inArc(p, enemy, a.range + grown, a.arc ?? 0.7)
            ) {
              this.damage(
                enemy,
                a.damage * (p.channel.ex ? EX.damage : 1),
                p.id,
                a,
              );
              // Frost Breath: long enough in the breath and it freezes solid.
              const freeze = a.cone?.freeze;
              if (freeze) {
                const n = (this.coneStreak.get(key) ?? 0) + 1;
                this.coneStreak.set(key, n);
                if (n === freeze && enemy.hp > 0)
                  this.status(enemy, "freeze", a.cone?.freezeFor ?? 0.6, p.id);
              }
            } else if ((this.coneStreak.get(key) ?? 0) > 0)
              this.coneStreak.delete(key);
          }
        }
        if (!a || this.time >= p.channel.until) p.channel = undefined;
      }
    }
    this.stepRushes();
    this.stepSurfs();
    this.stepLeaps();
    this.stepCyclones();
    // Time bubbles slow the shots of whoever they work against.
    const bubbles = this.zones.filter(
      (z) => z.ability.kind === "timewarp" && z.until > this.time,
    );
    // Swept substeps prevent fast projectiles from tunneling through a fighter or wall.
    this.projectiles = this.projectiles.filter((pr) => {
      // A Crystal Cage stops every shot that would cross it.
      if (this.caged(pr, dt)) {
        this.event("impact", pr, pr.color, undefined, pr.owner, pr.ability.id);
        return false;
      }
      if (pr.ability.boomerang) return this.stepBoomerang(pr, dt);
      // An Ember Curtain burns up the shots of whoever it works against.
      if (this.screened(pr)) {
        this.event("impact", pr, pr.color, undefined, pr.owner, pr.ability.id);
        return false;
      }
      const slowed = bubbles.some(
        (z) =>
          this.rivals(z.owner, pr.owner) &&
          Math.hypot(pr.x - z.x, pr.y - z.y) < z.radius,
      );
      const step =
        dt *
        (slowed ? (bubbles[0].ability.warp ?? STATUS_RULES.warpMultiplier) : 1);
      const steps = Math.max(
        1,
        Math.ceil((Math.hypot(pr.vx, pr.vy) * step) / 10),
      );
      const enemies = this.enemiesOfOwner(pr.owner);
      const explode = () => this.projectileImpact(pr);
      for (let i = 0; i < steps; i++) {
        const next = {
          x: pr.x + (pr.vx * step) / steps,
          y: pr.y + (pr.vy * step) / steps,
        };
        const contact = projectileContact(
          pr,
          next,
          pr.ability.radius,
          currentObstacles(),
        );
        pr.x = contact?.x ?? next.x;
        pr.y = contact?.y ?? next.y;
        pr.remaining -= (Math.hypot(pr.vx, pr.vy) * step) / steps;
        if (contact || pr.remaining <= 0) {
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
        // Ball Lightning flies through enemies (it zaps them instead).
        const struck =
          !pr.ability.aura &&
          enemies.find(
            (e) =>
              e.hp > 0 &&
              Math.hypot(pr.x - e.x, pr.y - e.y) <
                this.hitRadius(e) + pr.ability.radius,
          );
        if (struck) {
          if (pr.ability.explosion) explode();
          else {
            // Contact point, so the move's own impact effect plays on a hit
            // too (not only when it reaches a wall or the end of its range).
            this.event(
              "impact",
              pr,
              pr.color,
              undefined,
              pr.owner,
              pr.ability.id,
            );
            this.damage(struck, pr.ability.damage, pr.owner, pr.ability);
          }
          return false;
        }
      }
      if (pr.ability.aura) this.zap(pr);
      return true;
    });
    for (const zone of this.zones) {
      if (zone.ability.kind === "cage") continue;
      if (zone.ability.kind === "wave") {
        this.stepWave(zone);
        continue;
      }
      if (zone.ability.kind === "storm") {
        this.stepStorm(zone);
        continue;
      }
      if (zone.ability.kind === "hunt") {
        this.stepHunt(zone, dt);
        continue;
      }
      if (zone.ability.kind === "lure") {
        this.stepLure(zone);
        continue;
      }
      if (zone.ability.kind === "garden") {
        this.stepGarden(zone);
        continue;
      }
      if (zone.ability.kind === "trail") {
        this.stepTrail(zone);
        continue;
      }
      if (zone.ability.kind === "steer") {
        // Sunfire Pillar: drift toward the caster's aim (then hit like a zone).
        const owner = this.players.find((q) => q.id === zone.owner);
        if (owner && owner.hp > 0 && !owner.out) {
          const dx = owner.lastInput.aimX - zone.x,
            dy = owner.lastInput.aimY - zone.y,
            d = Math.hypot(dx, dy),
            stepLen = Math.min(d, (zone.ability.steer?.speed ?? 240) * dt);
          if (d > 0.5) {
            zone.x += (dx / d) * stepLen;
            zone.y += (dy / d) * stepLen;
          }
        }
      }
      if (zone.ability.kind === "screen") {
        // Enemies on the curtain catch fire.
        if (this.time >= zone.nextTick) {
          zone.nextTick += zone.ability.tickInterval ?? 0.5;
          const a = zone.ability;
          for (const enemy of this.enemiesOfOwner(zone.owner))
            if (
              enemy.hp > 0 &&
              enemy.jumpUntil <= this.time &&
              this.onScreen(zone, enemy, this.hitRadius(enemy))
            )
              if (a.damage > 0) this.damage(enemy, a.damage, zone.owner, a);
              else if (a.status)
                this.status(enemy, a.status, a.statusDuration ?? 1, zone.owner);
        }
        continue;
      }
      if (zone.ability.kind === "timewarp") {
        // Sloth Time: enemies inside move at a fraction of their speed. The
        // status carries the bubble, so movement (and client prediction)
        // stops slowing the moment a fighter dashes or walks out of it.
        const reach = (e: Fighter) => zone.radius + this.hitRadius(e) * 0.5;
        for (const enemy of this.enemiesOfOwner(zone.owner))
          if (
            enemy.hp > 0 &&
            Math.hypot(enemy.x - zone.x, enemy.y - zone.y) < reach(enemy)
          ) {
            this.status(enemy, "warp", 0.15, zone.owner);
            const warp = enemy.statuses.find((s) => s.kind === "warp");
            if (warp) {
              warp.tx = zone.x;
              warp.ty = zone.y;
              warp.amount = reach(enemy);
            }
          }
        continue;
      }
      if (zone.ability.kind === "seedling") {
        // A seedling waits for the first enemy to step on it (jumping clears it).
        if (zone.until <= this.time) continue;
        const trigger = (zone.ability.seed?.trigger ?? 30) as number;
        const stepped = this.enemiesOfOwner(zone.owner).some(
          (e) =>
            e.hp > 0 &&
            e.jumpUntil <= this.time &&
            Math.hypot(e.x - zone.x, e.y - zone.y) <
              trigger + this.hitRadius(e),
        );
        if (stepped) this.bloomSeed(zone, seedStage(zone, this.time));
        continue;
      }
      if (zone.ability.follow) {
        const owner = this.players.find((p) => p.id === zone.owner);
        if (owner) {
          zone.x = owner.x;
          zone.y = owner.y;
        }
      }
      if (this.time >= zone.nextTick && zone.ability.turret) {
        zone.nextTick += zone.ability.tickInterval ?? 0.5;
        this.fireTurret(zone);
      } else if (this.time >= zone.nextTick) {
        zone.nextTick += zone.ability.tickInterval ?? 0.5;
        const a = zone.ability;
        // A pure healing spring does nothing to enemies.
        if (!a.heal || a.damage > 0 || a.status || a.knockback)
          for (const enemy of this.enemiesOfOwner(zone.owner))
            if (
              enemy.hp > 0 &&
              Math.hypot(enemy.x - zone.x, enemy.y - zone.y) <
                zone.radius + this.hitRadius(enemy) &&
              this.lineClear(zone, enemy)
            )
              this.damage(enemy, a.damage, zone.owner, a);
        if (a.heal) this.healZone(zone);
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
          p.hp = Math.min(
            maxHealth(p.character, this.mode, this.players.length),
            p.hp + heal * dt,
          );
          p.stats.healed = (p.stats.healed ?? 0) + (p.hp - before);
        }
    }
    if (this.practice) {
      for (const [i, p] of this.players.entries())
        if (p.hp <= 0) {
          p.hp = maxHealth(p.character, this.mode, this.players.length);
          p.x = i === 0 ? 650 : 950;
          p.y = 180;
          p.vx = p.vy = 0;
          p.statuses = [];
          p.clone = undefined;
          p.charge = undefined;
          p.channel = undefined;
          p.burrow = undefined;
          p.cyclone = undefined;
          p.plates = undefined;
          p.moss = 0;
          p.dashUntil = p.jumpUntil = 0;
          p.lastInput = blankInput();
        }
      return;
    }
    if (this.mode === "raid") return;
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
          this.damage(p, 12 * DRAIN_INTERVAL, this.enemiesOf(p)[0]?.id ?? "");
        // Outside the ring everyone loses health, and nobody's credited.
        if (
          ring !== null &&
          p.hp > 0 &&
          Math.hypot(p.x - RING.x, p.y - RING.y) > ring
        )
          this.damage(p, RING.damage * DRAIN_INTERVAL, "");
      }
    }
    if (this.rule("rush") && this.stepRush()) return;
    // Crown Hill: a side alone in the circle builds up time; enough wins.
    if (this.rule("crown")) {
      const inside = this.sides.filter((t) =>
        this.standing(t).some(
          (p) =>
            Math.hypot(p.x - this.crownZone.x, p.y - this.crownZone.y) <
            this.crownZone.radius,
        ),
      );
      if (inside.length === 1) {
        const t = inside[0];
        this.crown[t] = (this.crown[t] ?? 0) + dt;
        if (this.crown[t] >= this.crownZone.holdSeconds) {
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
              sum +
              Math.max(0, p.hp) /
                maxHealth(p.character, this.mode, this.players.length),
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
  /**
   * Orb Rush: spawn gems, let fighters pick them up and bank them at their
   * own goal. Returns true when a side has banked enough to take the round.
   */
  stepRush() {
    if (this.time >= this.nextGem) {
      this.nextGem = this.time + RUSH.spawnEvery;
      if (this.gems.length < RUSH.max)
        for (let tries = 0; tries < 12; tries++) {
          const spot = {
            x: 300 + this.random() * 1000,
            y: 120 + this.random() * 660,
          };
          const goals = rushGoals(this.mode);
          if (
            blocked(spot.x, spot.y, 22) ||
            goals.some((g) => Math.hypot(g.x - spot.x, g.y - spot.y) < 260)
          )
            continue;
          this.gems.push({ id: ++this.serial, ...spot });
          this.event("orb", spot, 0xc58cff, undefined, undefined, "gem");
          break;
        }
    }
    const goals = rushGoals(this.mode);
    for (const p of this.players) {
      if (p.hp <= 0 || p.out) continue;
      this.gems = this.gems.filter((g) => {
        if (Math.hypot(g.x - p.x, g.y - p.y) > RUSH.pickup) return true;
        p.gems = (p.gems ?? 0) + 1;
        this.event("heal", p, 0xc58cff, undefined, p.id, "gem-pickup");
        return false;
      });
      const side = this.teamOf(p);
      const goal = goals[side % goals.length];
      if (
        (p.gems ?? 0) > 0 &&
        Math.hypot(goal.x - p.x, goal.y - p.y) < RUSH.goalRadius
      ) {
        this.banked[side] = (this.banked[side] ?? 0) + (p.gems ?? 0);
        this.event("burst", goal, 0xc58cff, p.gems, p.id, "gem-bank");
        p.gems = 0;
        if (this.banked[side] >= RUSH.target) {
          this.endRound(side);
          return true;
        }
      }
    }
    return false;
  }
  /** Orb Rush: drop carried gems where a fighter stands. */
  dropGems(p: Fighter, count: number) {
    const n = Math.min(count, p.gems ?? 0);
    for (let i = 0; i < n; i++) {
      const a = this.random() * Math.PI * 2;
      const spot = { x: p.x + Math.cos(a) * 60, y: p.y + Math.sin(a) * 60 };
      if (blocked(spot.x, spot.y, 22)) {
        spot.x = p.x;
        spot.y = p.y;
      }
      this.gems.push({ id: ++this.serial, ...spot });
    }
    p.gems = (p.gems ?? 0) - n;
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
              : p.hp <
                maxHealth(p.character, this.mode, this.players.length)) &&
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
      const full = maxHealth(taker.character, this.mode, this.players.length);
      const healed = Math.min(
        full - taker.hp,
        Math.round(full * RULES.orbHeal),
      );
      taker.hp += healed;
      taker.stats.healed = (taker.stats.healed ?? 0) + healed;
      // Health and stats retain fractional precision; combat popups show whole HP.
      this.event("heal", taker, 0x7dffb0, Math.round(healed), taker.id);
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
      activityStatus: this.activityStatus,
      activityEligible: this.activityEligible,
      arcade: this.arcade,
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
      gems: this.rule("rush") ? this.gems : undefined,
      banked: this.rule("rush") ? this.banked : undefined,
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
function pushOut(
  p: { x: number; y: number },
  r: { x: number; y: number; w: number; h: number },
) {
  const pad = RULES.radius + 2;
  if (
    p.x < r.x - pad ||
    p.x > r.x + r.w + pad ||
    p.y < r.y - pad ||
    p.y > r.y + r.h + pad
  )
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
