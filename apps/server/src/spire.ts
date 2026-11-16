/**
 * The Spire on the server: a climb run inside one raid room. Wave floors
 * field Echoes (champions on team 1, each driven by the PvP bot with its
 * full kit); the elite floor fields an Echo captain that also plays one
 * borrowed Cragmuff mechanic through the raid warning system (so every raid
 * honesty rule applies). Between floors each raider picks a blessing.
 *
 * Flow: briefing → (blessings, from the second floor) → countdown → waves →
 * floor cleared (saved at once) → next floor in the same room. A defeat ends
 * the climb; "Climb again" starts from the checkpoint with no blessings.
 *
 * Boss floors (floor 10: the Ascendant Cragmuff) are a hook: `bossFloor`
 * will swap the room's arena for the boss's (phase 2). Until then a climb
 * ends at SPIRE_BUILT_TOP.
 */
import {
  CHARACTERS,
  RULES,
  blocked,
  maxHealth,
  type Ability,
  type CharacterId,
  type Fighter,
} from "../../../packages/shared/src/index.js";
import {
  isRaider,
  type RaidAttack,
} from "../../../packages/shared/src/raid.js";
import {
  SPIRE_BASTION_AT,
  SPIRE_BUILT_TOP,
  SPIRE_CHOICE_SECONDS,
  SPIRE_FLOORS,
  SPIRE_PARTY,
  SPIRE_SEASON,
  spireBlessingOffer,
  spireBlessingValue,
  spireCheckpoint,
  spireCourtCap,
  spireRoster,
  spireScale,
  spireWaves,
  spireZoneOf,
  type SpireBlessingId,
  type SpireEcho,
  type SpireFloorReceipt,
  type SpireState,
} from "../../../packages/shared/src/spire.js";
import { BotBrain } from "./bot.js";
import { RaidArena, raidJitter } from "./raid.js";

const randomUUID = () => crypto.randomUUID();
const randomSeed = () => {
  const v = new Uint32Array(1);
  crypto.getRandomValues(v);
  return v[0] % (1 << 30);
};

/** What a climb carries across floors (the public part is `state`). */
export interface SpireRun {
  state: SpireState;
  /** One id per climb: every floor it clears is saved under it. */
  runId: string;
  seed: number;
  /** Cleared floors waiting for the server to save them (server.ts drains). */
  pending: SpireFloorReceipt[];
  /** The server checked the party's checkpoints and unlocks. */
  validated: boolean;
}

/** A blessing's value for a fighter (0 without it). */
export function blessing(arena: SpireArena, p: Fighter, id: SpireBlessingId) {
  return spireBlessingValue(id, arena.spire.state.blessings[p.id]?.[id]);
}

export class SpireArena extends RaidArena {
  declare spire: SpireRun;
  private echoSerial = 0;
  /** The floor's waves (a big party has one more). */
  private waveList: SpireEcho[][] = [];
  private waveIndex = -1;
  /** Echoes of this wave not yet on the court (the court has a cap). */
  private queue: SpireEcho[] = [];
  /** Echoes waiting to materialise, by spawn id. */
  private spawning = new Map<number, SpireEcho & { elite?: boolean }>();
  /** When each beaten Echo fell (it fades out after a moment). */
  private fallenAt = new Map<string, number>();
  private nextWaveAt = Infinity;
  private floorStarted = false;
  private escortsCalled = false;
  private bastionUsed = new Set<string>();
  private wasStaggered = false;

  constructor(code: string) {
    super(code, "grumblecrag");
    const state: SpireState = {
      season: SPIRE_SEASON,
      floor: 1,
      startFloor: 1,
      ceiling: SPIRE_BUILT_TOP,
      kind: "wave",
      wave: 0,
      waves: 0,
      echoesLeft: 0,
      roster: spireRoster(1),
      spawns: [],
      blessings: {},
      offers: {},
      best: 0,
      limit: 180,
      climbSeconds: 0,
      saves: [],
    };
    this.spire = {
      state,
      runId: randomUUID(),
      seed: 1,
      pending: [],
      validated: false,
    };
    this.raid.spire = state;
    this.raid.name = "The Spire";
    this.raid.message = "Climb the Spire: beat the Echoes on every floor.";
  }
  /** Where this party may climb (validated by the server before the start). */
  configureSpire(o: { startFloor: number; ceiling: number }) {
    const s = this.spire.state;
    s.ceiling = Math.max(1, Math.min(SPIRE_BUILT_TOP, o.ceiling));
    s.startFloor = Math.max(1, Math.min(s.ceiling, o.startFloor));
    s.floor = s.startFloor;
    s.problem = undefined;
    this.spire.validated = true;
  }
  override start() {
    const s = this.spire.state;
    // A new climb starts from the checkpoint this party has reached.
    s.startFloor = Math.min(
      s.ceiling,
      Math.max(s.startFloor, spireCheckpoint(s.best + 1)),
    );
    super.start();
    const r = this.raid;
    r.name = "The Spire";
    r.trait = "ancient";
    r.gilded = false;
    this.spire.runId = randomUUID();
    this.spire.seed = randomSeed();
    this.spire.pending = [];
    Object.assign(s, {
      floor: s.startFloor,
      best: 0,
      blessings: {},
      offers: {},
      saves: [],
      climbSeconds: 0,
      roster: spireRoster(spireZoneOf(s.startFloor)),
    });
    this.setupFloor(s.startFloor);
    r.message = `The Spire · Floor ${s.floor}: ${SPIRE_FLOORS[s.floor]?.name ?? ""}`;
  }
  /** Wave floors have no boss; the elite steps in as an Echo. */
  protected override spawnBoss() {}
  /** The living elite captain plays the borrowed mechanic. */
  override boss() {
    const id = this.spire?.state.eliteId;
    return id
      ? this.players.find((p) => p.id === id && p.hp > 0 && !p.out)
      : undefined;
  }
  protected override fighting() {
    return !!this.boss();
  }
  override snapshot(remaining = 0) {
    // Echo brains are not a "bot match".
    return { ...super.snapshot(remaining), vsBot: null };
  }

  // ------------------------------------------------------------ Floors
  /** Get the court, the raiders and the floor's numbers ready. */
  private setupFloor(floor: number) {
    const s = this.spire.state,
      r = this.raid,
      def = SPIRE_FLOORS[floor];
    for (const p of this.players) if (p.echo) this.bots.delete(p.id);
    this.players = this.players.filter((p) => !p.echo);
    this.spawning.clear();
    this.fallenAt.clear();
    this.bastionUsed.clear();
    this.queue = [];
    this.waveList = spireWaves(floor, Math.max(1, r.partySize));
    this.waveIndex = -1;
    this.nextWaveAt = Infinity;
    this.floorStarted = false;
    this.escortsCalled = false;
    this.wasStaggered = false;
    this.selfUsed = false;
    Object.assign(s, {
      floor,
      kind: def?.kind ?? "wave",
      wave: 0,
      waves: def?.kind === "elite" ? 1 : this.waveList.length,
      echoesLeft: 0,
      spawns: [],
      clearedAt: undefined,
      eliteId: undefined,
      limit: spireScale(floor, r.partySize).limit,
    });
    r.elapsed = 0;
    r.warnings = [];
    r.downed = {};
    r.stagger = 0;
    r.staggerUntil = 0;
    r.exposedUntil = 0;
    r.wards = [];
    r.bossId = "raid-boss";
    r.maxHp = 1;
    this.projectiles = [];
    this.zones = [];
    this.resetBrain();
    this.attacks = 0;
    this.started = false;
    // Everyone stands again, at full health, at the stairs.
    this.heroes().forEach((p, i) => {
      Object.assign(p, {
        hp: maxHealth(p.character, this.mode),
        x: 260 + (i % 2) * 85,
        y: 330 + Math.floor(i / 2) * 160,
        vx: 0,
        vy: 0,
        angle: 0,
        statuses: [],
        cooldowns: p.cooldowns.map(() => 0),
        dashAt: 0,
        jumpAt: 0,
        dashUntil: 0,
        jumpUntil: 0,
        charge: undefined,
        channel: undefined,
        immuneUntil: 0,
      });
      this.applyBlessings(p);
    });
  }
  /** The first live moment of a floor: the first wave (or the captain) comes. */
  private beginFloor() {
    const s = this.spire.state;
    this.floorStarted = true;
    const def = SPIRE_FLOORS[s.floor];
    if (def?.kind === "elite" && def.elite) {
      s.wave = 1;
      this.materialiseAt(def.elite.captain, true);
    } else this.startWave(0);
  }
  private startWave(i: number) {
    this.waveIndex = i;
    this.spire.state.wave = i + 1;
    this.queue = [...(this.waveList[i] ?? [])];
    this.nextWaveAt = Infinity;
    this.fillCourt();
  }
  /** Echoes join while the court has room for them. */
  private fillCourt() {
    const cap = spireCourtCap(this.heroes().length);
    while (
      this.queue.length &&
      this.livingEchoes().length + this.spawning.size < cap
    )
      this.materialiseAt(this.queue.shift()!);
  }
  private livingEchoes() {
    return this.players.filter((p) => p.echo && p.hp > 0 && !p.out);
  }
  /** A harmless violet ring where an Echo is about to appear. */
  private materialiseAt(echo: SpireEcho, elite = false) {
    const s = this.spire.state;
    const at = this.spawnPoint(echo, elite);
    const id = ++this.serial;
    this.spawning.set(id, { ...echo, elite });
    s.spawns.push({
      id,
      x: at.x,
      y: at.y,
      at: this.time + SPIRE_PARTY.materialise,
      character: echo.character,
    });
  }
  /**
   * Where an Echo appears: on the far side by role (front-liners nearer,
   * casters at the back, skirmishers at the top or bottom edge), clear of
   * walls and never on top of a raider.
   */
  private spawnPoint(echo: SpireEcho, elite: boolean) {
    this.walls();
    const heroes = this.heroes().filter((p) => p.hp > 0);
    const busy = [
      ...this.players.filter((p) => p.echo && p.hp > 0),
      ...this.spire.state.spawns,
    ];
    let best = { x: 1250, y: 450 },
      bestScore = -Infinity;
    for (let i = 0; i < 24; i++) {
      const j = (k: number) =>
        raidJitter(this.spire.seed, this.serial * 31 + k, i);
      const x = elite
        ? 1150 + j(1) * 150
        : echo.role === "front"
          ? 1100 + j(1) * 220
          : echo.role === "caster"
            ? 1330 + j(1) * 170
            : 850 + j(1) * 550;
      const y =
        echo.role === "skirmisher" && !elite
          ? j(2) < 0.5
            ? 120 + j(3) * 60
            : 720 + j(3) * 60
          : 160 + j(2) * 580;
      if (blocked(x, y, RULES.radius + 6)) continue;
      const fromHero = Math.min(
        9999,
        ...heroes.map((p) => Math.hypot(p.x - x, p.y - y)),
      );
      const fromOthers = Math.min(
        9999,
        ...busy.map((p) => Math.hypot(p.x - x, p.y - y)),
      );
      const score =
        Math.min(fromHero, 600) +
        Math.min(fromOthers, 160) * 2 -
        (fromHero < 380 ? 2000 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
    return best;
  }
  /** An Echo steps out of its ring: a champion on team 1 with a bot brain. */
  private appear(spawnId: number, x: number, y: number) {
    const echo = this.spawning.get(spawnId);
    this.spawning.delete(spawnId);
    if (!echo) return;
    const s = this.spire.state,
      scale = spireScale(s.floor, Math.max(1, this.raid.partySize));
    const id = `echo-${++this.echoSerial}`;
    const def = SPIRE_FLOORS[s.floor];
    const name =
      echo.elite && def?.elite
        ? def.elite.name
        : `Echo ${CHARACTERS[echo.character].name}`;
    const p = super.add(id, name, echo.character);
    const heroes = this.heroes();
    const near = heroes[0] ?? { x: 260, y: 450 };
    Object.assign(p, {
      team: 1,
      echo: true,
      ready: true,
      x,
      y,
      angle: Math.atan2(near.y - y, near.x - x),
      ...(echo.elite ? { elite: true } : {}),
    });
    this.bots.set(
      id,
      new BotBrain(
        id,
        scale.difficulty,
        ((this.spire.seed + this.echoSerial * 7919) % 999983) + 1,
      ),
    );
    if (echo.elite) {
      s.eliteId = id;
      // The HUD's boss bar follows the captain.
      this.raid.bossId = id;
      this.raid.maxHp = p.hp;
      this.raid.message = `${name} — it borrowed Cragmuff's eruptions!`;
      // A moment to see the captain before its first eruption.
      this.nextAttack = this.time + 2.5;
    }
  }
  /** Echoes appear, fade, and the next wave comes when this one is beaten. */
  private stepEchoes() {
    const s = this.spire.state;
    for (const spawn of s.spawns.filter((q) => q.at <= this.time))
      this.appear(spawn.id, spawn.x, spawn.y);
    s.spawns = s.spawns.filter((q) => q.at > this.time);
    for (const p of this.players)
      if (p.echo && p.hp <= 0 && !this.fallenAt.has(p.id))
        this.fallenAt.set(p.id, this.time);
    for (const [id, at] of this.fallenAt)
      if (this.time >= at + SPIRE_PARTY.fade) {
        this.bots.delete(id);
        this.players = this.players.filter((p) => p.id !== id);
        this.fallenAt.delete(id);
      }
    // The captain calls its escorts at half health.
    const elite = this.boss(),
      def = SPIRE_FLOORS[s.floor];
    if (
      elite &&
      def?.elite &&
      !this.escortsCalled &&
      elite.hp <= this.raid.maxHp * 0.5
    ) {
      this.escortsCalled = true;
      this.queue.push(...def.elite.escorts);
      this.raid.message = `${elite.name} calls for help!`;
    }
    this.fillCourt();
    const living = this.livingEchoes().length;
    s.echoesLeft = living + this.spawning.size + this.queue.length;
    if (
      s.kind === "wave" &&
      this.floorStarted &&
      !s.echoesLeft &&
      this.waveIndex < this.waveList.length - 1
    ) {
      if (this.nextWaveAt === Infinity) {
        this.nextWaveAt = this.time + SPIRE_PARTY.waveGap;
        this.raid.message = `Wave ${this.waveIndex + 1} beaten — more Echoes are coming!`;
      } else if (this.time >= this.nextWaveAt)
        this.startWave(this.waveIndex + 1);
    }
  }
  private floorDone() {
    const s = this.spire.state;
    if (!this.floorStarted || s.echoesLeft) return false;
    if (s.kind === "elite") return !!s.eliteId && !this.boss();
    return this.waveIndex >= this.waveList.length - 1;
  }
  /** The floor is beaten: it is saved at once (the climb may still fail). */
  private floorCleared() {
    const s = this.spire.state,
      r = this.raid;
    s.clearedAt = this.time;
    s.best = Math.max(s.best, s.floor);
    r.warnings = [];
    this.clearAttacks();
    this.spire.pending.push({
      runId: this.spire.runId,
      season: s.season,
      floor: s.floor,
      startFloor: s.startFloor,
      partySize: r.partySize,
      seconds: Math.max(0.001, Math.round(s.climbSeconds * 1000) / 1000),
      blessings: structuredClone(s.blessings),
      // Accounts are filled in by the server (it knows who sits where).
      players: this.heroes().map((p) => ({
        accountId: p.id,
        character: p.character,
      })),
    });
    s.saves.push({ floor: s.floor, status: "saving" });
    r.message = `Floor ${s.floor} cleared! The stairs open.`;
  }
  /** On up: the next floor in this room, or the end of what is built. */
  private nextFloor() {
    const s = this.spire.state;
    const next = s.floor + 1;
    const def = SPIRE_FLOORS[next];
    if (next > s.ceiling || !def) return this.finish(true);
    if (def.kind === "boss" && !this.bossFloor(next)) return this.finish(true);
    this.setupFloor(next);
    this.raid.message = `Floor ${next}: ${def.name}`;
    this.offerRaidRites();
  }
  /**
   * HOOK (phase 2): a boss floor swaps this room's arena for the zone's
   * Ascendant boss arena (server.ts swapArena: carry serial, time, players
   * and this `spire` run) and back afterwards. Not built: the climb ends
   * below it.
   */
  protected bossFloor(_floor: number): boolean {
    return false;
  }

  // -------------------------------------------------- Blessings (rites)
  /** Blessings before every floor but the climb's first (no cards then). */
  protected override offerRaidRites() {
    const s = this.spire.state;
    this.projectiles = [];
    this.zones = [];
    this.raid.warnings = [];
    this.raid.offers = {};
    s.offers = {};
    this.clearAttacks();
    if (s.floor <= s.startFloor) {
      this.phase = "countdown";
      this.deadline = this.time + RULES.countdown;
      return;
    }
    this.phase = "intermission";
    this.deadline = this.time + SPIRE_CHOICE_SECONDS;
    for (const [seat, p] of this.heroes().entries())
      s.offers[p.id] = spireBlessingOffer(
        this.spire.seed,
        s.floor,
        seat,
        s.blessings[p.id],
      );
  }
  override pickRite(id: string, blessingId: string) {
    const s = this.spire.state;
    const offer = s.offers[id];
    if (
      this.phase !== "intermission" ||
      !offer?.includes(blessingId as SpireBlessingId)
    )
      return false;
    const mine = (s.blessings[id] ??= {});
    const b = blessingId as SpireBlessingId;
    mine[b] = (mine[b] ?? 0) + 1;
    delete s.offers[id];
    const p = this.players.find((q) => q.id === id);
    if (p) this.applyBlessings(p);
    if (!Object.keys(s.offers).length)
      this.deadline = Math.min(this.deadline, this.time + 1);
    return true;
  }
  /** Blessings that live on the fighter (the dash, which prediction reads). */
  private applyBlessings(p: Fighter) {
    const fleet = blessing(this, p, "fleet");
    p.dashCd = fleet ? RULES.dashCooldown * (1 - fleet) : undefined;
  }
  protected override cooldownScale(p: Fighter) {
    return isRaider(p) ? 1 - blessing(this, p, "focus") : 1;
  }
  override chargeUlt(p: Fighter, amount: number) {
    super.chargeUlt(
      p,
      isRaider(p) ? amount * (1 + blessing(this, p, "surge")) : amount,
    );
  }
  protected override reviveRate(rescuers: Fighter[]) {
    return 1 + Math.max(0, ...rescuers.map((q) => blessing(this, q, "rally")));
  }
  /** Static Wake: a dash lays a short crackling trail (Spark Trail's own). */
  private layWake(p: Fighter, damage: number) {
    if (this.zones.length >= RULES.maxZones) return;
    const spark = CHARACTERS.coilemur.skills.find(
      (a) => a.id === "spark-trail",
    );
    if (!spark) return;
    const a: Ability = {
      ...spark,
      damage,
      status: undefined,
      statusDuration: undefined,
      duration: RULES.dashDuration + 0.05,
      trail: { fade: 1.2 },
    };
    this.zones.push({
      id: ++this.serial,
      owner: p.id,
      x: p.x,
      y: p.y,
      radius: a.radius,
      until: this.time + a.duration + 1.2,
      nextTick: this.time,
      ability: a,
      color: CHARACTERS.coilemur.color,
      born: this.time,
      points: [{ x: p.x, y: p.y, t: this.time }],
    });
  }

  // ------------------------------------------------------------ Combat
  override damage(
    target: Fighter,
    amount: number,
    owner: string,
    ability?: Ability,
  ) {
    if (target.hp <= 0 || this.phase !== "playing") return;
    const source = this.players.find((p) => p.id === owner);
    const scale = spireScale(
      this.spire.state.floor,
      Math.max(1, this.raid.partySize),
    );
    if (source?.echo && isRaider(target))
      amount *= scale.power * (1 - blessing(this, target, "stoneskin"));
    if (target.echo && source && isRaider(source))
      amount *= scale.armour * (1 + blessing(this, source, "keen"));
    const before = target.hp;
    super.damage(target, amount, owner, ability);
    const dealt = Math.max(0, before - Math.max(0, target.hp));
    if (source && isRaider(source) && target.echo && dealt > 0) {
      const mine = this.raid.contributions?.[source.id];
      if (mine) mine.damage += dealt;
      const leech = blessing(this, source, "leech");
      if (leech && source.hp > 0) this.heal(source, dealt * leech);
      const harvest = blessing(this, source, "harvest");
      if (harvest && before > 0 && target.hp <= 0 && source.hp > 0)
        this.heal(source, maxHealth(source.character, this.mode) * harvest);
    }
    if (isRaider(target) && target.hp > 0 && dealt > 0) {
      const guard = blessing(this, target, "bastion");
      if (
        guard &&
        !this.bastionUsed.has(target.id) &&
        target.hp < maxHealth(target.character, this.mode) * SPIRE_BASTION_AT
      ) {
        this.bastionUsed.add(target.id);
        this.status(target, "shield", guard, target.id);
      }
    }
    // The captain staggers like a boss: hit it enough and it reels.
    if (target.elite && dealt > 0 && target.hp > 0)
      this.addBossStagger(target, dealt * SPIRE_PARTY.eliteStagger);
  }

  // -------------------------------------------- The elite's borrowed mechanic
  protected override pattern(): RaidAttack[] {
    return ["eruption"];
  }
  protected override signature(): RaidAttack | undefined {
    return "eruption";
  }
  protected override cadence() {
    return SPIRE_PARTY.eliteCadence * (1 - 0.05 * (this.raid.partySize - 1));
  }
  protected override concurrency() {
    return 1;
  }
  protected override stepEnrage() {}

  // -------------------------------------------------------------- Clock
  override tick(dt = 1 / RULES.tick) {
    const s = this.spire.state;
    // Time's up on the cards: the first option is taken.
    if (this.phase === "intermission" && this.time + dt >= this.deadline)
      for (const id of Object.keys(s.offers))
        if (s.offers[id]?.[0]) this.pickRite(id, s.offers[id][0]);
    const dashes = new Map(this.heroes().map((p) => [p.id, p.dashUntil]));
    super.tick(dt);
    if (this.phase !== "playing" || this.raid.result) return;
    s.climbSeconds += dt;
    this.deadline = this.time + Math.max(0, s.limit - this.raid.elapsed);
    for (const p of this.heroes()) {
      const wake = blessing(this, p, "wake");
      if (wake && p.dashUntil > (dashes.get(p.id) ?? 0)) this.layWake(p, wake);
    }
  }
  protected override stepOutcome() {
    const s = this.spire.state,
      r = this.raid;
    // Everyone left: the climb ends (a raid's boss would have ended it).
    if (!this.heroes().length) return this.finish(false);
    if (!this.floorStarted) this.beginFloor();
    this.stepEchoes();
    const elite = this.boss();
    const staggered = r.staggerUntil > this.time;
    if (elite && staggered && !this.wasStaggered) {
      this.status(elite, "stun", SPIRE_PARTY.eliteStun);
      r.message = `${elite.name} reels — hit it now!`;
    }
    this.wasStaggered = staggered;
    if (s.clearedAt === undefined && this.floorDone()) this.floorCleared();
    if (s.clearedAt !== undefined) {
      if (this.time >= s.clearedAt + SPIRE_PARTY.cleared) this.nextFloor();
    } else if (r.elapsed >= s.limit) this.finish(false);
  }
  protected override finishMessage(won: boolean) {
    const s = this.spire.state;
    if (!won)
      return `The Echoes held floor ${s.floor}. Climb again from floor ${spireCheckpoint(s.best + 1 > s.startFloor ? s.best + 1 : s.startFloor)}.`;
    return s.best >= SPIRE_BUILT_TOP
      ? `Floor ${s.best} cleared! The Ascendant waits above, soon.`
      : `Floor ${s.best} cleared — the top of your climb for now.`;
  }
}
