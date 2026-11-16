/**
 * The Spire on the server: a climb run inside one raid room. Wave floors
 * field Echoes (champions on team 1, each driven by the PvP bot with its
 * full kit); the elite floor fields an Echo captain that also plays one
 * borrowed mechanic of the zone's boss through the raid warning system (so
 * every raid honesty rule applies). Between floors each raider picks a
 * blessing.
 *
 * One climb is one zone, and a room runs one zone: `SpireRules` is a layer
 * over the zone's boss arena (zone 1: the Ascendant Cragmuff's rules over
 * the raid core, `SpireArena`; zone 2: the Ascendant Tidelotl's over
 * Tidelotl's arena, `SpireTideArena`). `createSpireArena(code, zone)`
 * builds the room the server was asked for.
 *
 * Flow: briefing → (blessings, from the second floor) → countdown → waves →
 * floor cleared (saved at once) → next floor in the same room. A defeat ends
 * the climb; "Climb again" starts from the checkpoint with no blessings.
 *
 * Boss floors (floor 10: the Ascendant Cragmuff; 20: the Ascendant
 * Tidelotl) are fought in this same arena: it carries the Ascendant's rules
 * (on while `raid.variant` is "ascendant") and turns them on for the floor. The room,
 * its sessions, accounts and appearance, the event numbering, the clock and
 * the blessings (hooked here, below) stay exactly as they were, and the
 * clear is saved as a Spire floor like any other (never as a raid clear:
 * server.ts files raid clears only for rooms without `spire`). Why not swap
 * the room to the boss's own arena: the room's state lives in many places
 * (the server's per-arena maps, input queues and acks inside Arena, the
 * raid's run state), and a swap that missed one would break prediction or
 * saving in ways no snapshot shows.
 *
 * After the zone's boss floor the climb ends as a victory: the zone is
 * conquered (zone 1's clear grants checkpoint 11; spireStartCheckpoint and
 * the database agree).
 */
import {
  CHARACTERS,
  RULES,
  blocked,
  maxHealth,
  useObstacles,
  type Ability,
  type CharacterId,
  type Fighter,
  type Rect,
} from "../../../packages/shared/src/index.js";
import {
  isRaider,
  type RaidAttack,
} from "../../../packages/shared/src/raid.js";
import {
  SPIRE_BASTION_AT,
  SPIRE_BUILT_TOP,
  SPIRE_CHOICE_SECONDS,
  SPIRE_ELITE_MECHANICS,
  SPIRE_FLOORS,
  SPIRE_PARTY,
  SPIRE_SEASON,
  SPIRE_ZONES,
  spireBlessingOffer,
  spireBlessingValue,
  spireCourtCap,
  spireRoster,
  spireScale,
  spireStartCheckpoint,
  spireWaves,
  spireZoneOfBoss,
  spireZoneStart,
  spireZoneTop,
  type SpireBlessingId,
  type SpireEcho,
  type SpireFloorReceipt,
  type SpireState,
} from "../../../packages/shared/src/spire.js";
import {
  spireCourtWalls,
  spireEchoSpawnCandidate,
  spireRaiderSpawn,
} from "../../../packages/shared/src/spire-court.js";
import { BotBrain } from "./bot.js";
import { RaidArena, raidJitter } from "./raid.js";
import { AscendantCragmuffRules } from "./raid-ascendant-cragmuff.js";
import { AscendantTidelotlRules } from "./raid-ascendant-tidelotl.js";
import { TidewyrmArena } from "./raid-tidewyrm.js";

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
export function blessing(
  arena: { spire: SpireRun },
  p: Fighter,
  id: SpireBlessingId,
) {
  return spireBlessingValue(id, arena.spire.state.blessings[p.id]?.[id]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RaidClass = new (...args: any[]) => RaidArena;

/** The Spire's climb over a zone's boss arena `Base` (its boss is the zone's). */
export function SpireRules<B extends RaidClass>(Base: B) {
  return class SpireRules extends Base {
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
    /** The zone this room climbs (from its boss: one zone per room). */
    readonly zone: number;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);
      this.zone = spireZoneOfBoss(this.raid.boss) ?? 1;
      const start = spireZoneStart(this.zone);
      const state: SpireState = {
        season: SPIRE_SEASON,
        zone: this.zone,
        floor: start,
        startFloor: start,
        ceiling: this.zoneTop(),
        kind: "wave",
        wave: 0,
        waves: 0,
        echoesLeft: 0,
        roster: spireRoster(this.zone),
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
    /** The zone's boss floor (or the top that is built). */
    zoneTop() {
      return Math.min(SPIRE_BUILT_TOP, spireZoneTop(this.zone));
    }
    /** The zone's Ascendant and its raid's short name. */
    zoneDef() {
      return SPIRE_ZONES[this.zone] ?? SPIRE_ZONES[1];
    }
    /**
     * Where this party may climb (validated by the server before the start),
     * kept inside this room's zone.
     */
    configureSpire(o: { startFloor: number; ceiling: number }) {
      const s = this.spire.state;
      const from = spireZoneStart(this.zone);
      s.ceiling = Math.max(from, Math.min(this.zoneTop(), o.ceiling));
      s.startFloor = Math.max(from, Math.min(s.ceiling, o.startFloor));
      s.floor = s.startFloor;
      s.problem = undefined;
      this.spire.validated = true;
    }
    override start() {
      const s = this.spire.state;
      // A new climb starts from the checkpoint this party has reached (one
      // that is built: after zone 1's boss, floor 1 again).
      s.startFloor = Math.min(
        s.ceiling,
        Math.max(s.startFloor, spireStartCheckpoint(s.best + 1, s.ceiling)),
      );
      s.kind = "wave";
      this.raid.variant = undefined;
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
        roster: spireRoster(this.zone),
      });
      this.setupFloor(s.startFloor);
      r.message = `The Spire · Floor ${s.floor}: ${SPIRE_FLOORS[s.floor]?.name ?? ""}`;
    }
    /** Is this floor the zone's Ascendant boss? */
    bossFloor() {
      return this.spire?.state.kind === "boss";
    }
    /** Floors bring their own foes (setupFloor): none at the climb's start. */
    protected override spawnBoss() {}
    /** The Ascendant on its floor; elsewhere the living elite captain. */
    override boss() {
      if (this.bossFloor()) return super.boss();
      const id = this.spire?.state.eliteId;
      return id
        ? this.players.find((p) => p.id === id && p.hp > 0 && !p.out)
        : undefined;
    }
    protected override fighting() {
      if (this.bossFloor())
        return (
          this.spire.state.clearedAt === undefined && (this.boss()?.hp ?? 0) > 0
        );
      return !!this.boss();
    }
    /** The captain is drawn bigger (SPIRE_PARTY.eliteScale): so is its hit area. */
    override hitRadius(p: Fighter) {
      return p.elite
        ? RULES.radius * SPIRE_PARTY.eliteScale
        : super.hitRadius(p);
    }
    /**
     * Wave and elite floors are fought on the Spire's court: its floor's
     * layout and the stairs (packages/shared/src/spire-court.ts, which the
     * client predicts and paints with). The boss floor keeps its raid's walls.
     */
    override walls() {
      const list = spireCourtWalls(this.spire?.state);
      if (!list) return super.walls();
      useObstacles(list);
      return list as Rect[];
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
      // Echoes and a boss from an earlier floor leave the court.
      this.players = this.players.filter((p) => !p.echo && !p.raidBoss);
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
      r.bossId = "raid-boss";
      r.maxHp = 1;
      // Chapter 1, the pillars standing, the brain and deck fresh.
      this.resetFight();
      this.resetAscendantReads();
      this.projectiles = [];
      this.zones = [];
      // The Spire's court has no pillars or islands; the boss floor's court
      // is its raid's (Cragmuff's pillars, Tidelotl's lagoon).
      if (def?.kind === "boss") this.setupArena();
      else this.clearBossCourt();
      // The Ascendant's rules are on for its floor only.
      r.variant = def?.kind === "boss" ? "ascendant" : undefined;
      r.name = def?.kind === "boss" ? this.zoneDef().ascendant : "The Spire";
      // Everyone stands again, at full health, at the stairs.
      this.heroes().forEach((p, i) => {
        Object.assign(p, {
          hp: maxHealth(p.character, this.mode),
          ...spireRaiderSpawn(i),
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
      if (def?.kind === "boss") this.spawnAscendant();
    }
    /** The Ascendant's reads start fresh each floor (the zone's layer). */
    protected resetAscendantReads() {}
    /**
     * A wave or elite floor: the raid's court features off (the Spire's own
     * court: spire-court.ts). The floor's colours and walls follow the room's
     * zone; the arena id stays the Coliseum's, as on zone 1.
     */
    protected clearBossCourt() {
      const r = this.raid;
      this.arenaId = "classic";
      r.pillars = [];
      r.islands = undefined;
    }
    /**
     * The zone's Ascendant steps onto the court (zone 1: Cragmuff; zone 2:
     * Tidelotl), at the Ascendant tier's health for this party, never Gilded.
     */
    private spawnAscendant() {
      const r = this.raid,
        name = this.zoneDef().ascendant;
      r.gilded = false;
      r.maxHp = this.bossMaxHp();
      super.spawnBoss();
      const boss = this.boss();
      if (boss) boss.name = name;
      r.message = `Floor ${this.spire.state.floor}: ${name} waits at the top.`;
    }
    /** The first live moment of a floor: the first wave (or the captain) comes. */
    private beginFloor() {
      const s = this.spire.state;
      this.floorStarted = true;
      const def = SPIRE_FLOORS[s.floor];
      if (def?.kind === "elite" && def.elite) {
        s.wave = 1;
        this.materialiseAt(def.elite.captain, true);
      } else this.startEchoWave(0);
    }
    private startEchoWave(i: number) {
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
        const { x, y } = spireEchoSpawnCandidate(echo.role, elite, j);
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
        const m = SPIRE_ELITE_MECHANICS[def?.elite?.mechanic ?? "eruption"];
        this.raid.message = `${name} — it borrowed ${m.boss}'s ${m.name}!`;
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
          this.startEchoWave(this.waveIndex + 1);
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
      r.message =
        s.kind === "boss"
          ? `${r.name} kneels! Floor ${s.floor} cleared.`
          : `Floor ${s.floor} cleared! The stairs open.`;
    }
    /** On up: the next floor in this room, or the end of what is built. */
    private nextFloor() {
      const s = this.spire.state;
      const next = s.floor + 1;
      const def = SPIRE_FLOORS[next];
      // The server decided how high this party may climb (each member must
      // have cleared a boss's raid for its floor): nothing above it.
      if (next > s.ceiling || !def) return this.finish(true);
      this.setupFloor(next);
      if (def.kind === "boss") return this.briefBoss();
      this.raid.message = `Floor ${next}: ${def.name}`;
      this.offerRaidRites();
    }
    /**
     * Before a boss floor: its briefing (the boss, its new attacks), read
     * until everyone is ready or the time is up; then the blessing cards.
     */
    private briefBoss() {
      this.phase = "briefing";
      this.deadline = this.time + SPIRE_PARTY.bossBriefing;
      // The boss is ready; the raiders confirm (Arena.acknowledgeInstructions).
      this.instructionsReady = this.players
        .filter((p) => p.raidBoss)
        .map((p) => p.id);
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
      return (
        1 + Math.max(0, ...rescuers.map((q) => blessing(this, q, "rally")))
      );
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
      // The boss floor: the boss's tier sets its numbers; blessings still count.
      if (source?.raidBoss && isRaider(target))
        amount *= 1 - blessing(this, target, "stoneskin");
      if (target.raidBoss && source && isRaider(source))
        amount *= 1 + blessing(this, source, "keen");
      const before = target.hp;
      super.damage(target, amount, owner, ability);
      const dealt = Math.max(0, before - Math.max(0, target.hp));
      if (
        source &&
        isRaider(source) &&
        (target.echo || target.raidBoss) &&
        dealt > 0
      ) {
        // (A raid counts damage to its boss itself.)
        const mine = this.raid.contributions?.[source.id];
        if (mine && target.echo) mine.damage += dealt;
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
    // (On the boss floor: the Ascendant's own deck, rhythm and enrage.)
    /** The raid attack this floor's captain borrowed (zone 1: eruptions). */
    eliteAttack(): RaidAttack {
      const m = SPIRE_FLOORS[this.spire.state.floor]?.elite?.mechanic;
      return SPIRE_ELITE_MECHANICS[m ?? "eruption"].attack;
    }
    protected override pattern(): RaidAttack[] {
      return this.bossFloor() ? super.pattern() : [this.eliteAttack()];
    }
    protected override signature(): RaidAttack | undefined {
      return this.bossFloor() ? super.signature() : this.eliteAttack();
    }
    protected override cadence() {
      if (this.bossFloor()) return super.cadence();
      return SPIRE_PARTY.eliteCadence * (1 - 0.05 * (this.raid.partySize - 1));
    }
    protected override concurrency() {
      return this.bossFloor() ? super.concurrency() : 1;
    }
    protected override stepEnrage() {
      if (this.bossFloor()) super.stepEnrage();
    }

    // -------------------------------------------------------------- Clock
    override tick(dt = 1 / RULES.tick) {
      const s = this.spire.state;
      // A boss floor's briefing runs on a clock (a climb never stalls on it).
      if (
        this.phase === "briefing" &&
        s.kind === "boss" &&
        s.floor > s.startFloor
      ) {
        this.time += dt;
        if (this.time >= this.deadline) {
          this.instructionsReady = this.players.map((p) => p.id);
          this.phase = "countdown";
          this.offerRaidRites();
        }
        return;
      }
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
        if (wake && p.dashUntil > (dashes.get(p.id) ?? 0))
          this.layWake(p, wake);
      }
    }
    protected override stepOutcome() {
      const s = this.spire.state,
        r = this.raid;
      // Everyone left: the climb ends (a raid's boss would have ended it).
      if (!this.heroes().length) return this.finish(false);
      if (s.kind === "boss") {
        if (s.clearedAt === undefined) {
          if (this.bossHealth() <= 0) this.floorCleared();
          else if (r.elapsed >= s.limit) return this.finish(false);
          // Chapters, as in the raid (its win and loss are the floor's, above).
          else return super.stepOutcome();
        }
        if (this.time >= (s.clearedAt ?? Infinity) + SPIRE_PARTY.cleared)
          this.nextFloor();
        return;
      }
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
      const from = spireStartCheckpoint(
        Math.max(s.startFloor, s.best + 1),
        s.ceiling,
      );
      if (!won)
        return s.kind === "boss"
          ? `${this.zoneDef().ascendant} stands unbroken. Climb again from floor ${from}.`
          : `The Echoes held floor ${s.floor}. Climb again from floor ${from}.`;
      const top = SPIRE_FLOORS[s.best];
      if (top?.kind === "boss")
        return SPIRE_FLOORS[s.best + 1]
          ? `Zone ${top.zone} conquered — zone ${top.zone + 1} opens at floor ${s.best + 1}.`
          : `Zone ${top.zone} conquered — more floors are coming.`;
      return `Floor ${s.best} cleared — the top of your climb for now.`;
    }
  };
}

/** Zone 1's climb: Echo floors 1–9 and the Ascendant Cragmuff on floor 10. */
export class SpireArena extends SpireRules(AscendantCragmuffRules(RaidArena)) {
  constructor(code: string) {
    super(code, "grumblecrag");
  }
  protected override resetAscendantReads() {
    this.resetReads();
  }
}
/** Zone 2's climb: Echo floors 11–19 and the Ascendant Tidelotl on floor 20 (the lagoon). */
export class SpireTideArena extends SpireRules(
  AscendantTidelotlRules(TidewyrmArena),
) {
  constructor(code: string) {
    super(code, "tidewyrm");
  }
  protected override resetAscendantReads() {
    this.resetTideReads();
  }
}
/** Any zone's climb. */
export type SpireRoom = SpireArena | SpireTideArena;
export const isSpireArena = (a: unknown): a is SpireRoom =>
  a instanceof SpireArena || a instanceof SpireTideArena;
/** The room for a climb of `zone` (the server checked it is built). */
export function createSpireArena(code: string, zone = 1): SpireRoom {
  return zone === 2 ? new SpireTideArena(code) : new SpireArena(code);
}
