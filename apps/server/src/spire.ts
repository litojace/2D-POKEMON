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
 * Tidelotl's arena, `SpireTideArena`; zone 3: the Ascendant Inkpurr's over
 * Inkpurr's (Gloomshade's) arena, `SpireGloomArena`; zone 4: the Ascendant
 * Snoozaku's over Snoozaku's (Somnara's) arena, `SpireDreamArena`; zone 5:
 * the Ascendant Prismell's over Prismell's (Prismatail's) arena,
 * `SpireLightArena`; zone 6: the Ascendant Lumiwick's over Lumiwick's
 * (Emberwing's) arena, `SpireEmberArena`).
 * `createSpireArena(code, zone)` builds the room the server was asked for.
 *
 * Flow: briefing → (blessings, from the second floor) → countdown → waves →
 * floor cleared (saved at once) → next floor in the same room. A defeat ends
 * the climb; "Climb again" starts from the checkpoint with no blessings.
 *
 * Boss floors (floor 10: the Ascendant Cragmuff; 20: the Ascendant
 * Tidelotl; 30: the Ascendant Inkpurr; 40: the Ascendant Snoozaku; 50: the
 * Ascendant Prismell; 60: the Ascendant Lumiwick) are fought in this same arena: it
 * carries the Ascendant's rules (on while `raid.variant` is "ascendant") and turns them on for the floor. The room,
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
  type Input,
  type Rect,
} from "../../../packages/shared/src/index.js";
import {
  ASCENDANT_LUMIWICK,
  EMBERWING,
  GLOOMSHADE,
  PRISMATAIL,
  SOMNARA,
  STORM_TWINS,
  prismRayEnd,
  handsTileDark,
  isRaider,
  type RaidAttack,
  type RaidWarning,
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
  spireBorrowed,
  spireCourtCap,
  spireRoster,
  spireScale,
  spireStartCheckpoint,
  spireUnderControls,
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
import { AscendantInkpurrRules } from "./raid-ascendant-inkpurr.js";
import { GloomshadeArena } from "./raid-gloomshade.js";
import { AscendantSnoozakuRules } from "./raid-ascendant-snoozaku.js";
import { SomnaraArena } from "./raid-somnara.js";
import { AscendantPrismellRules } from "./raid-ascendant-prismell.js";
import { PrismatailArena } from "./raid-prismatail.js";
import { AscendantLumiwickRules } from "./raid-ascendant-lumiwick.js";
import { EmberwingArena } from "./raid-emberwing.js";
import { AscendantStormTwinsRules } from "./raid-ascendant-storm-twins.js";
import { StormTwinsArena, polaritySigns } from "./raid-storm-twins.js";
import { REACTION, SLOWEST_RAIDER, leadPoint } from "./raid-boss-aim.js";

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
      this.placeAscendant(name);
      r.message = `Floor ${this.spire.state.floor}: ${name} waits at the top.`;
    }
    /**
     * The Ascendant has stepped onto its court (its raid's spawn): it takes
     * the Ascendant's name. (Zone 7's two twins keep theirs: SpireStormArena.)
     */
    protected placeAscendant(name: string) {
      const boss = this.boss();
      if (boss) boss.name = name;
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
      // Count the new wave at once: it starts inside stepEchoes, after that
      // tick's count, and a stale 0 on the last wave read as "floor done".
      this.countEchoes();
    }
    /** Echoes of the floor still to beat: on the court, appearing or queued. */
    private countEchoes() {
      const s = this.spire.state;
      s.echoesLeft =
        this.livingEchoes().length + this.spawning.size + this.queue.length;
      return s.echoesLeft;
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
        this.raid.message = `${name} — it borrowed ${spireBorrowed(m)}!`;
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
      this.countEchoes();
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
      // A fresh count: the floor is done only when nothing is left to beat.
      if (!this.floorStarted || this.countEchoes()) return false;
      if (s.kind === "elite") return !!s.eliteId && !this.boss();
      // Every wave has come (and none is waiting to come).
      return (
        this.waveIndex >= this.waveList.length - 1 &&
        this.nextWaveAt === Infinity
      );
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
          ? `${this.zoneDef().ascendant} ${/s$/.test(this.zoneDef().ascendant) ? "stand" : "stands"} unbroken. Climb again from floor ${from}.`
          : `The Echoes held floor ${s.floor}. Climb again from floor ${from}.`;
      const top = SPIRE_FLOORS[s.best];
      // The last zone's boss: the whole Spire is conquered.
      if (top?.kind === "boss")
        return SPIRE_FLOORS[s.best + 1] && s.best + 1 <= SPIRE_BUILT_TOP
          ? `Zone ${top.zone} conquered — zone ${top.zone + 1} opens at floor ${s.best + 1}.`
          : SPIRE_FLOORS[s.best + 1]
            ? `Zone ${top.zone} conquered — more floors are coming.`
            : `Zone ${top.zone} conquered — the Spire is yours.`;
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
/**
 * Zone 3's climb: Echo floors 21–29 on the Spire's court and the Ascendant
 * Inkpurr on floor 30, in the Lantern Yard. The wave and elite floors keep
 * Inkpurr's yard switched off (no lanterns, copies, curses or lights), and
 * the captain of floor 25 only borrows its Grasping Hands: it never drifts
 * between Inkpurr's spots, never splits, and the board never flips.
 */
export class SpireGloomArena extends SpireRules(
  AscendantInkpurrRules(GloomshadeArena),
) {
  constructor(code: string) {
    super(code, "gloomshade");
  }
  protected override resetAscendantReads() {
    this.resetInkReads();
  }
  protected override clearBossCourt() {
    super.clearBossCourt();
    const r = this.raid;
    r.lanterns = undefined;
    r.decoys = [];
    r.curses = {};
    r.lights = [];
    r.revealUntil = 0;
    r.streak = 0;
  }
  /**
   * Off its own floor, Inkpurr's counters (Mystowl's ray, Duskveil's lantern,
   * Voltkit's spark light) have nothing to reveal or light: the captain is
   * no Inkpurr, and the Spire's court has no night.
   */
  override cast(p: Fighter, a: Ability, ex = false) {
    if (this.bossFloor()) return super.cast(p, a, ex);
    const r = this.raid,
      before = {
        lights: r.lights,
        revealUntil: r.revealUntil,
        message: r.message,
      };
    super.cast(p, a, ex);
    r.lights = before.lights;
    r.revealUntil = before.revealUntil;
    if (r.message !== before.message && /Inkpurr/.test(r.message))
      r.message = before.message;
  }
  /** Inkpurr's drift and splits belong to its own floor (not the captain's). */
  protected override bossStep(dt: number, boss: Fighter) {
    if (this.bossFloor()) super.bossStep(dt, boss);
  }
  /** So do its lanterns, curses and lights. */
  protected override worldStep(dt: number, boss: Fighter) {
    if (this.bossFloor()) super.worldStep(dt, boss);
  }
  /**
   * The elite's Grasping Hands: the tiles under most raiders go dark (every
   * raider has a lit tile next to theirs), on the raid's own warning clock,
   * and never flipped part-way: the Spire's elite asks you to move, it
   * doesn't trick you.
   */
  protected override startAttack(kind: RaidAttack, target: Fighter): void {
    if (this.bossFloor() || kind !== "hands")
      return super.startAttack(kind, target);
    const count = this.seenAttacks.get(kind) ?? 0;
    this.seenAttacks.set(kind, count + 1);
    const alive = this.heroes().filter((p) => p.hp > 0);
    const under = (q: number) =>
      alive.filter((p) => handsTileDark(p.x, p.y, q)).length;
    const parity =
      under(1) > under(0)
        ? 1
        : under(0) > under(1)
          ? 0
          : (this.raid.seed + this.attacks) % 2;
    Object.assign(
      this.warn("hands", 800, 450, 800, 450, 0, GLOOMSHADE.hands.delay),
      { parity, teach: count < 2 },
    );
  }
}
/** Where the elite's falling stars sit round their centre (px). */
export const SPIRE_STAR_RING = 220;
/** Stars in the elite's constellation. */
export const SPIRE_STAR_COUNT = 5;
/** A teaching constellation (the first two) is shown this much longer (s). */
export const SPIRE_STAR_TEACH = 0.4;
/**
 * Zone 4's climb: Echo floors 31–39 on the Spire's court and the Ascendant
 * Snoozaku on floor 40, on the Cloud Deck. The wave and elite floors keep
 * Snoozaku's deck switched off (no dreams, rune calls, lullaby rings,
 * bubbles, Quiet Zones or drowsiness), and the captain of floor 35 only
 * borrows its Falling Stars: never on top of a phone's touch controls.
 */
export class SpireDreamArena extends SpireRules(
  AscendantSnoozakuRules(SomnaraArena),
) {
  constructor(code: string) {
    super(code, "somnara");
  }
  protected override resetAscendantReads() {
    this.resetSnoozeReads();
  }
  protected override clearBossCourt() {
    super.clearBossCourt();
    Object.assign(this.raid, {
      dream: undefined,
      dreamRings: [],
      dreamBubbles: [],
      quietZone: undefined,
      drowsy: {},
      runeCalls: [],
      dreamTrails: [],
      dreamsSolved: 0,
      dreamMistakes: 0,
    });
  }
  /** Snoozaku's drift belongs to its own floor (not the captain's). */
  protected override bossStep(dt: number, boss: Fighter) {
    if (this.bossFloor()) super.bossStep(dt, boss);
  }
  /** So do its dreams, rings, bubbles, Quiet Zones and drowsiness. */
  protected override worldStep(dt: number, boss: Fighter) {
    if (this.bossFloor()) super.worldStep(dt, boss);
  }
  /**
   * The elite's Falling Stars: a constellation of star marks with its first
   * star on a raider (step out of it: the middle and the gaps are safe), on
   * the raid's own warning clock and damage. No star is laid under a
   * phone's touch controls: one a thumb hides is dropped, and a raider
   * standing under them draws the first star to the nearest open ground.
   */
  protected override startAttack(kind: RaidAttack, target: Fighter): void {
    if (this.bossFloor() || kind !== "falling-stars")
      return super.startAttack(kind, target);
    const count = this.seenAttacks.get(kind) ?? 0;
    this.seenAttacks.set(kind, count + 1);
    const teach = count < 2;
    const boss = this.boss();
    if (boss) boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
    for (const star of spireStarfall(target))
      this.warn(
        kind,
        star.x,
        star.y,
        star.x,
        star.y,
        SOMNARA.stars.radius,
        SOMNARA.stars.delay + (teach ? SPIRE_STAR_TEACH : 0),
      ).teach = teach;
  }
}
/**
 * Where the elite's stars fall: the first on `at` (or, under a phone's touch
 * controls, the nearest open ground), the rest on a ring round a centre
 * toward the middle of the court, each on the court and none under the
 * controls.
 */
export function spireStarfall(at: { x: number; y: number }) {
  const r = SOMNARA.stars.radius,
    W = RULES.width,
    H = RULES.height;
  let aim = { x: at.x, y: at.y };
  if (spireUnderControls(aim.x, aim.y, r)) {
    let best = { x: W / 2, y: H / 2 },
      near = Infinity;
    for (let x = r; x <= W - r; x += 20)
      for (let y = r; y <= H - r; y += 20) {
        if (spireUnderControls(x, y, r)) continue;
        const d = Math.hypot(x - at.x, y - at.y);
        if (d < near) {
          near = d;
          best = { x, y };
        }
      }
    aim = best;
  }
  // The ring's centre lies toward the court's middle, so the ring stays on it.
  const toMiddle = Math.atan2(H / 2 - aim.y, W / 2 - aim.x);
  const cx = aim.x + Math.cos(toMiddle) * SPIRE_STAR_RING,
    cy = aim.y + Math.sin(toMiddle) * SPIRE_STAR_RING;
  const first = toMiddle + Math.PI;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < SPIRE_STAR_COUNT; i++) {
    const a = first + (i * Math.PI * 2) / SPIRE_STAR_COUNT;
    const x = i === 0 ? aim.x : cx + Math.cos(a) * SPIRE_STAR_RING,
      y = i === 0 ? aim.y : cy + Math.sin(a) * SPIRE_STAR_RING;
    if (x < r / 2 || x > W - r / 2 || y < r / 2 || y > H - r / 2) continue;
    if (spireUnderControls(x, y, r)) continue;
    out.push({ x, y });
  }
  return out;
}
/** Lances in the elite's spread (the middle one on a raider). */
export const SPIRE_LANCE_COUNT = 3;
/** Radians between neighbouring lances of the spread. */
export const SPIRE_LANCE_SPREAD = 0.5;
/** A teaching spread (the first two) is shown this much longer (s). */
export const SPIRE_LANCE_TEACH = 0.6;
/** A lane shorter than this once clipped is not laid (px). */
export const SPIRE_LANCE_MIN = 140;
/**
 * Zone 5's climb: Echo floors 41–49 on the Spire's court and the Ascendant
 * Prismell on floor 50, in the Sun Atrium. The wave and elite floors keep
 * Prismell's atrium switched off (no mirrors, skylight, relay, burn, Glare
 * or sun pillars; its stand-in brain's relay posts are its own floor's),
 * and the captain of floor 45 only borrows its Prism Lances: never under a
 * phone's touch controls.
 */
export class SpireLightArena extends SpireRules(
  AscendantPrismellRules(PrismatailArena),
) {
  constructor(code: string) {
    super(code, "prismatail");
  }
  protected override resetAscendantReads() {
    this.resetPrismReads();
  }
  protected override clearBossCourt() {
    super.clearBossCourt();
    Object.assign(this.raid, {
      mirrors: [],
      lightLinks: [],
      lightSources: undefined,
      sunPillars: [],
      lightStartedAt: undefined,
      lightHold: 0,
      lightArrivals: [],
      blinded: {},
      shieldBreaks: 0,
      quickBreaks: 0,
    });
  }
  /**
   * Off its own floor, Prismell's counters have no atrium to work on: no
   * Sun Pillar or Frost Bloom relays the light, and an Echo's skill never
   * cuts the captain's lances (a raider's Skyline Lance still does, as in
   * Prismell's raid).
   */
  override cast(p: Fighter, a: Ability, ex = false) {
    if (this.bossFloor()) return super.cast(p, a, ex);
    const r = this.raid,
      before = { warnings: r.warnings, message: r.message };
    super.cast(p, a, ex);
    r.sunPillars = [];
    if (p.echo) {
      r.warnings = before.warnings;
      r.message = before.message;
    }
  }
  /** Prismell's drift belongs to its own floor (not the captain's). */
  protected override bossStep(dt: number, boss: Fighter) {
    if (this.bossFloor()) super.bossStep(dt, boss);
  }
  /** So do its mirrors, skylight relay, beam burn and Glare. */
  protected override worldStep(dt: number, boss: Fighter) {
    if (this.bossFloor()) super.worldStep(dt, boss);
  }
  /**
   * A stand-in's relay posts and mirror turning are Prismell's floor's; on
   * the Spire's court it plays like any raider (dodging what is drawn).
   */
  protected override botHint(
    bot: Fighter,
    input: Input,
    go: (x: number, y: number, away: boolean) => Input,
  ): Input | undefined {
    return this.bossFloor() ? super.botHint(bot, input, go) : undefined;
  }
  /**
   * One spread at a time: a big party's captain never sends a second spread
   * at someone else while the first is out (three lanes cross the court).
   */
  protected override pressured(kind: RaidAttack, alive: Fighter[]) {
    return this.bossFloor() && super.pressured(kind, alive);
  }
  /**
   * The elite's Prism Lances: a spread of locked lanes from the captain, the
   * middle one through a raider (sidestep into a gap, or out of the fan),
   * on the raid's own warning clock and damage. A lane runs only over open
   * ground: it starts where it leaves the phone's touch controls and stops
   * where it would reach them again.
   */
  protected override startAttack(kind: RaidAttack, target: Fighter): void {
    if (this.bossFloor() || kind !== "prism-lance")
      return super.startAttack(kind, target);
    const boss = this.boss();
    if (!boss) return;
    const count = this.seenAttacks.get(kind) ?? 0;
    this.seenAttacks.set(kind, count + 1);
    const teach = count < 2;
    boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
    for (const lane of spireLances(boss, target))
      this.warn(
        kind,
        lane.x,
        lane.y,
        lane.tx,
        lane.ty,
        PRISMATAIL.lance.width,
        PRISMATAIL.lance.delay + (teach ? SPIRE_LANCE_TEACH : 0),
      ).teach = teach;
  }
}
/**
 * The elite's lances: `SPIRE_LANCE_COUNT` lanes from `from`, the middle one
 * through `at`, the others `SPIRE_LANCE_SPREAD` apart, each running to the
 * court's edge. Each runs over one stretch of open ground only (lane and
 * margin clear of the phone's touch controls): the stretch as far out as the
 * raider, else its first one; a stretch shorter than `SPIRE_LANCE_MIN` is
 * never laid.
 */
export function spireLances(
  from: { x: number; y: number },
  at: { x: number; y: number },
) {
  const width = PRISMATAIL.lance.width,
    step = 6;
  const aim = Math.atan2(at.y - from.y, at.x - from.x),
    reach = Math.hypot(at.x - from.x, at.y - from.y);
  const out: { x: number; y: number; tx: number; ty: number }[] = [];
  for (let i = 0; i < SPIRE_LANCE_COUNT; i++) {
    const a = aim + (i - (SPIRE_LANCE_COUNT - 1) / 2) * SPIRE_LANCE_SPREAD;
    const end = prismRayEnd(from, {
      x: from.x + Math.cos(a) * 100,
      y: from.y + Math.sin(a) * 100,
    });
    const len = Math.hypot(end.x - from.x, end.y - from.y);
    // The lane's stretches of open ground (from, to: px along it).
    const open: [number, number][] = [];
    for (let d = 0; d <= len; d += step) {
      const free = !spireUnderControls(
        from.x + Math.cos(a) * d,
        from.y + Math.sin(a) * d,
        width,
      );
      const last = open.at(-1);
      if (free && last && last[1] === d - step) last[1] = d;
      else if (free) open.push([d, d]);
    }
    // The stretch as far out as the raider (the one it runs through), else
    // the first long enough to read.
    const long = open.filter(([s, e]) => e - s >= SPIRE_LANCE_MIN);
    const lane = long.find(([s, e]) => s <= reach && reach <= e) ?? long[0];
    if (!lane) continue;
    out.push({
      x: from.x + Math.cos(a) * lane[0],
      y: from.y + Math.sin(a) * lane[0],
      tx: from.x + Math.cos(a) * lane[1],
      ty: from.y + Math.sin(a) * lane[1],
    });
  }
  return out;
}
/** The elite's dive lane: a lane shorter than this once clipped is not laid (px). */
export const SPIRE_DIVE_MIN = 160;
/** The lane runs this far past where its raider is heading (px). */
export const SPIRE_DIVE_OVERSHOOT = 150;
/** A teaching dive (the first two) is shown this much longer (s). */
export const SPIRE_DIVE_TEACH = 0.6;
/** The captain's dive speed down its lane (px/s, Lumiwick's own). */
export const SPIRE_DIVE_SPEED = 2400;
/**
 * Zone 6's climb: Echo floors 51–59 on the Spire's court and the Ascendant
 * Lumiwick on floor 60, on the Sky Terrace. The wave and elite floors keep
 * Lumiwick's terrace switched off (no braziers, take-offs, groundings,
 * burning ground, dive trails, flame rings or feathers; its stand-in
 * brain's brazier routes are its own floor's), and the captain of floor 55
 * only borrows its dive: one locked lane over open ground (never under a
 * phone's touch controls, never through a wall), and the captain flies
 * only where it was drawn.
 */
export class SpireEmberArena extends SpireRules(
  AscendantLumiwickRules(EmberwingArena),
) {
  /** The captain's dive under way (elite floor). */
  private eliteDive?: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    /** The drawn lane: only it hurts. */
    lane: { x: number; y: number; tx: number; ty: number };
    startedAt: number;
    until: number;
    hit: Set<string>;
  };
  constructor(code: string) {
    super(code, "emberwing");
  }
  protected override resetAscendantReads() {
    this.resetLumiReads();
  }
  /**
   * Floor 60's braziers are the Ascendant's (clear of a phone's controls):
   * setupFloor lays the court before it turns the Ascendant's rules on.
   */
  protected override brazierSpots() {
    return this.bossFloor()
      ? ASCENDANT_LUMIWICK.braziers
      : super.brazierSpots();
  }
  protected override clearBossCourt() {
    super.clearBossCourt();
    this.eliteDive = undefined;
    // (The Ascendant's gales and wicks are warnings: clearAttacks; its
    // feints and fuses: its reads reset.)
    this.lumiFeints.clear();
    this.wickFit.clear();
    Object.assign(this.raid, {
      braziers: [],
      airborne: false,
      takeoffAt: undefined,
      emberDive: undefined,
      emberPatches: [],
      emberTrails: [],
      flameRings: [],
      emberFeathers: [],
      groundings: 0,
      quickGroundings: 0,
      chapterGroundings: 0,
      permanentGround: false,
    });
  }
  protected override clearAttacks() {
    super.clearAttacks();
    this.eliteDive = undefined;
  }
  // (Off its own floor Lumiwick's counters have nothing to work on: Heat
  // Cracks and Chestnut Mortar light braziers only while it flies, the
  // currents and vines put out fire there is none of, and its Facet Guard
  // reflects only its own dive. Its cast needs no gate.)
  /** Lumiwick's drift and dives belong to its own floor (not the captain's). */
  protected override bossStep(dt: number, boss: Fighter) {
    if (this.bossFloor()) super.bossStep(dt, boss);
  }
  /** So do its take-offs, braziers, burning ground, rings and feathers. */
  protected override worldStep(dt: number, boss: Fighter) {
    if (this.bossFloor()) super.worldStep(dt, boss);
  }
  /**
   * A stand-in's brazier routes and heat-mark spacing are Lumiwick's
   * floor's; on the Spire's court it plays like any raider (dodging what
   * is drawn).
   */
  protected override botHint(
    bot: Fighter,
    input: Input,
    go: (x: number, y: number, away: boolean) => Input,
  ): Input | undefined {
    return this.bossFloor() ? super.botHint(bot, input, go) : undefined;
  }
  /** One dive at a time: a big party's captain never sends a second one. */
  protected override pressured(kind: RaidAttack, alive: Fighter[]) {
    return this.bossFloor() && super.pressured(kind, alive);
  }
  /**
   * The elite's dive: one locked lane from the captain through where a
   * raider is heading (Lumiwick's own aim) and a little past, on the raid's
   * own warning clock and damage. The lane runs over open ground only: it
   * stops at the first wall and never runs under the phone's touch
   * controls; a lane too short to read is not laid (the captain tries again
   * a moment later).
   */
  protected override startAttack(kind: RaidAttack, target: Fighter): void {
    if (this.bossFloor() || kind !== "dive-bomb")
      return super.startAttack(kind, target);
    const boss = this.boss();
    if (!boss || this.eliteDive) return;
    this.walls();
    const plan = spireDive(
      boss,
      leadPoint(target, EMBERWING.dive.delay, {
        x0: 90,
        y0: 90,
        x1: 1510,
        y1: 810,
      }),
      this.hitRadius(boss),
    );
    if (!plan) {
      this.nextAttack = this.time + 0.6;
      return;
    }
    const count = this.seenAttacks.get(kind) ?? 0;
    this.seenAttacks.set(kind, count + 1);
    const teach = count < 2;
    boss.angle = Math.atan2(plan.ty - plan.y, plan.tx - plan.x);
    Object.assign(
      this.warn(
        kind,
        plan.x,
        plan.y,
        plan.tx,
        plan.ty,
        EMBERWING.dive.width,
        EMBERWING.dive.delay + (teach ? SPIRE_DIVE_TEACH : 0),
      ),
      { teach, targetId: target.id },
    );
  }
  /** The lane locks: the captain dives from where it stands to the lane's end. */
  protected override resolveWarning(w: RaidWarning, boss: Fighter) {
    if (this.bossFloor() || w.kind !== "dive-bomb")
      return super.resolveWarning(w, boss);
    const from = { x: boss.x, y: boss.y },
      to = { x: w.tx, y: w.ty },
      len = Math.hypot(to.x - from.x, to.y - from.y);
    boss.angle = Math.atan2(to.y - from.y, to.x - from.x);
    this.eliteDive = {
      from,
      to,
      lane: { x: w.x, y: w.y, tx: w.tx, ty: w.ty },
      startedAt: this.time,
      until: this.time + Math.max(0.2, len / SPIRE_DIVE_SPEED),
      hit: new Set(),
    };
  }
  override tick(dt = 1 / RULES.tick) {
    super.tick(dt);
    this.stepEliteDive();
  }
  /**
   * The captain flies down its lane (after the court's own movement, so its
   * brain never steers it mid-dive), hurting each raider it passes inside
   * the drawn lane once. A stagger stops it where it is.
   */
  private stepEliteDive() {
    const d = this.eliteDive;
    if (!d) return;
    const boss = this.boss();
    if (
      !boss ||
      this.phase !== "playing" ||
      this.bossFloor() ||
      this.raid.staggerUntil > this.time
    ) {
      this.eliteDive = undefined;
      return;
    }
    const before = { x: boss.x, y: boss.y };
    const t = Math.min(
      1,
      (this.time - d.startedAt) / Math.max(1e-6, d.until - d.startedAt),
    );
    Object.assign(boss, {
      x: d.from.x + (d.to.x - d.from.x) * t,
      y: d.from.y + (d.to.y - d.from.y) * t,
      vx: 0,
      vy: 0,
      angle: Math.atan2(d.to.y - d.from.y, d.to.x - d.from.x),
    });
    const reach = EMBERWING.dive.width + RULES.radius;
    this.hitBy = "dive-bomb";
    for (const p of this.heroes())
      if (
        p.hp > 0 &&
        !d.hit.has(p.id) &&
        spireSegmentDistance(p, before, boss) < reach &&
        spireSegmentDistance(p, d.lane, { x: d.lane.tx, y: d.lane.ty }) < reach
      ) {
        d.hit.add(p.id);
        this.damage(p, EMBERWING.dive.damage, boss.id);
      }
    this.hitBy = undefined;
    if (t >= 1) {
      this.eliteDive = undefined;
      this.event("raid-impact", boss, 0xffa56b, undefined, boss.id);
      this.events[this.events.length - 1].raidRadius = EMBERWING.dive.width;
    }
  }
}
/** Distance from `p` to the segment a → b. */
export function spireSegmentDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
/**
 * The elite's dive lane: from the captain at `from`, through `at` (where its
 * raider is heading) and `SPIRE_DIVE_OVERSHOOT` px on, kept on the court.
 * The captain's flight stops at the first wall (the walls in use: call
 * `walls()` first). The lane is the stretch of that flight over open ground
 * (lane width and margin clear of the phone's touch controls) that holds
 * the raider, else the longest; none shorter than `SPIRE_DIVE_MIN`.
 * Undefined when there is none: no dive.
 */
export function spireDive(
  from: { x: number; y: number },
  at: { x: number; y: number },
  bodyRadius = RULES.radius,
) {
  const width = EMBERWING.dive.width,
    step = 6,
    edge = bodyRadius + 6;
  const aim = Math.atan2(at.y - from.y, at.x - from.x),
    ux = Math.cos(aim),
    uy = Math.sin(aim),
    reach = Math.hypot(at.x - from.x, at.y - from.y);
  const want = reach + SPIRE_DIVE_OVERSHOOT;
  // How far the captain can fly that way: on the court, short of any wall.
  let flight = 0;
  for (let d = step; d <= want; d += step) {
    const x = from.x + ux * d,
      y = from.y + uy * d;
    if (
      x < edge ||
      x > RULES.width - edge ||
      y < edge ||
      y > RULES.height - edge ||
      blocked(x, y, bodyRadius)
    )
      break;
    flight = d;
  }
  // The flight's stretches of open ground (from, to: px along it).
  const open: [number, number][] = [];
  for (let d = 0; d <= flight; d += step) {
    const free = !spireUnderControls(from.x + ux * d, from.y + uy * d, width);
    const last = open.at(-1);
    if (free && last && last[1] === d - step) last[1] = d;
    else if (free) open.push([d, d]);
  }
  const long = open.filter(([s, e]) => e - s >= SPIRE_DIVE_MIN);
  const lane =
    long.find(([s, e]) => s <= reach && reach <= e) ??
    [...long].sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
  if (!lane) return undefined;
  return {
    x: from.x + ux * lane[0],
    y: from.y + uy * lane[0],
    tx: from.x + ux * lane[1],
    ty: from.y + uy * lane[1],
  };
}
/** The elite's polarity: seconds every raider may spend before they move (the raid's reaction). */
export const SPIRE_POLARITY_REACTION = REACTION;
/** Slack on top of it (a turn, a step round a teammate) before a mark counts as reachable (s). */
export const SPIRE_POLARITY_SLACK = 0.3;
/** How far the elite's pad lies from the raider it is for (px, the raid's own). */
export const SPIRE_PAD_REACH = 190;
/**
 * How far a raider can walk to answer a mark (px): the slowest champion,
 * once they have seen it.
 */
export const spirePolarityWalk = (
  seconds: number = STORM_TWINS.polarity.seconds,
) =>
  SLOWEST_RAIDER *
  Math.max(0, seconds - SPIRE_POLARITY_REACTION - SPIRE_POLARITY_SLACK);
/** Is a pad at (x, y) fair: whole on the court, off the walls and clear of the phone's touch controls? (Call walls() first.) */
export function spirePadOpen(x: number, y: number) {
  const R = STORM_TWINS.polarity.padRadius;
  return (
    x >= R + 10 &&
    x <= RULES.width - R - 10 &&
    y >= R + 10 &&
    y <= RULES.height - R - 10 &&
    !spireUnderControls(x, y, R) &&
    !blocked(x, y, R)
  );
}
/** A straight walk from `a` to `b` that no wall blocks. */
function spireOpenWalk(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10);
  for (let i = 1; i <= n; i++)
    if (
      blocked(
        a.x + ((b.x - a.x) * i) / n,
        a.y + ((b.y - a.y) * i) / n,
        RULES.radius * 0.6,
      )
    )
      return false;
  return true;
}
/**
 * Where the elite lays its pad for a raider at `at`: about
 * `SPIRE_PAD_REACH` px away (toward the court's middle first, as the raid
 * lays it), the whole pad on the court, off the walls and clear of the
 * phone's touch controls, a straight walk away. (The walls in use: call
 * `walls()` first.) Undefined when there is no such spot.
 */
export function spirePolarityPad(at: { x: number; y: number }) {
  const toMiddle = Math.atan2(
    RULES.height / 2 - at.y,
    RULES.width / 2 - at.x || 1,
  );
  for (const d of [1, 0.85, 1.2, 0.7, 1.45, 1.8, 2.2, 2.7].map(
    (k) => k * SPIRE_PAD_REACH,
  ))
    for (let i = 0; i < 24; i++) {
      const a = toMiddle + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 12);
      const x = at.x + Math.cos(a) * d,
        y = at.y + Math.sin(a) * d;
      if (spirePadOpen(x, y) && spireOpenWalk(at, { x, y })) return { x, y };
    }
  // Boxed in (a nook between walls and the controls): the nearest open spot
  // by the way round, a walk the slowest champion makes in time.
  const step = 20,
    key = (x: number, y: number) => `${x},${y}`,
    start = {
      x: Math.round(at.x / step) * step,
      y: Math.round(at.y / step) * step,
    },
    walk = spirePolarityWalk() + STORM_TWINS.polarity.padRadius,
    seen = new Set([key(start.x, start.y)]),
    queue = [{ ...start, d: Math.hypot(start.x - at.x, start.y - at.y) }];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    if (c.d > walk) continue;
    if (c.d >= STORM_TWINS.polarity.padRadius && spirePadOpen(c.x, c.y))
      return { x: c.x, y: c.y };
    for (const [dx, dy] of [
      [step, 0],
      [-step, 0],
      [0, step],
      [0, -step],
    ]) {
      const x = c.x + dx,
        y = c.y + dy;
      if (x < 0 || x > RULES.width || y < 0 || y > RULES.height) continue;
      if (seen.has(key(x, y)) || blocked(x, y, RULES.radius * 0.6)) continue;
      seen.add(key(x, y));
      queue.push({ x, y, d: c.d + step });
    }
  }
  return undefined;
}
/**
 * The elite's marks for the raiders standing at `raiders`: the twins' own
 * signs (each raider kept as far as can be from an opposite sign:
 * polaritySigns), then the Spire's fairness. Every raider must be able to
 * answer their mark alone, walking at the slowest champion's speed once
 * they have seen it (`spirePolarityWalk`): to within reach of an opposite
 * sign standing still, or onto the pad. A raider who can't is given the
 * same sign as the others who can't (nobody counted on them: no opposite
 * was in reach), and one pad of the opposite sign is laid where they all
 * reach it (alone: about `SPIRE_PAD_REACH` px away, as in the raid),
 * never under the phone's touch controls nor in a wall. Undefined when no
 * fair answer exists (the captain tries again a moment later).
 */
export function spirePolarityPlan(
  raiders: readonly { x: number; y: number }[],
  seed: number,
  seconds: number = STORM_TWINS.polarity.seconds,
):
  | { signs: (1 | -1)[]; pad?: { x: number; y: number; sign: 1 | -1 } }
  | undefined {
  if (!raiders.length) return undefined;
  const walk = spirePolarityWalk(seconds),
    range = STORM_TWINS.polarity.range,
    R = STORM_TWINS.polarity.padRadius;
  const signs = polaritySigns([...raiders], seed);
  const stuck = () =>
    raiders
      .map((_, i) => i)
      .filter(
        (i) =>
          !raiders.some(
            (q, j) =>
              signs[j] !== signs[i] &&
              Math.hypot(q.x - raiders[i].x, q.y - raiders[i].y) - range <=
                walk,
          ),
      );
  let left = stuck();
  for (let k = 0; k < 4 && left.length; k++) {
    for (const i of left) signs[i] = signs[left[0]];
    left = stuck();
  }
  if (!left.length) return { signs };
  const sign = signs[left[0]];
  if (left.some((i) => signs[i] !== sign)) return undefined;
  let spot: { x: number; y: number } | undefined;
  if (left.length === 1) spot = spirePolarityPad(raiders[left[0]]);
  else {
    let worst = Infinity;
    for (let x = 80; x <= RULES.width - 80; x += 20)
      for (let y = 80; y <= RULES.height - 80; y += 20) {
        if (!spirePadOpen(x, y)) continue;
        const far = Math.max(
          ...left.map((i) => Math.hypot(raiders[i].x - x, raiders[i].y - y)),
        );
        if (
          far < worst &&
          left.every((i) => spireOpenWalk(raiders[i], { x, y }))
        ) {
          worst = far;
          spot = { x, y };
        }
      }
  }
  if (
    !spot ||
    left.some(
      (i) =>
        Math.hypot(raiders[i].x - spot.x, raiders[i].y - spot.y) - R > walk,
    )
  )
    return undefined;
  return { signs, pad: { ...spot, sign: sign === 1 ? -1 : 1 } };
}
/** Where the twins stand on floor 70 if their raid's spots sit under the phone's controls. */
export const SPIRE_TWIN_SPAWNS = [
  { x: 820, y: 360 },
  { x: 1000, y: 560 },
] as const;
/**
 * Zone 7's climb, the Spire's summit zone: Echo floors 61–69 on the Spire's
 * court and the Ascendant Storm Twins on floor 70, in the Conductor Ring.
 *
 * The wave and elite floors keep the twins' ring switched off: no twins,
 * revivals, Link Beam, static fields, rushes, chain lightning or the raid's
 * polarity, and no stand-in brain of theirs (`twins`, `stormBeam`, …: all
 * cleared). Their hit rules key on the twins and are checked against the
 * Echoes: a raider's hits and staggers reach the captain like any elite's
 * (the twins' stagger is per twin: here the captain's is the raid's one
 * bar), their exposed core, health split and damage floor apply to the
 * twins only (an Echo is never a raid boss), Wombolder's brace only stops
 * a Twin Rush, and Coilemur's Electromagnet and Duskveil's Void Orb only
 * drag a twin (an Echo Coilemur pulls as its champion does). Halcyra's
 * Focus Shot pierces only into a twin behind the first: on the Echo
 * floors there is none, so its cast needs no gate.
 *
 * The captain of floor 65 borrows Polarity through the raid's attack deck:
 * every raider marked + or − on the raid's warning clock (spirePolarityPlan:
 * always a fair answer, and a pad clear of the phone's controls and the
 * walls), each mark settled once, and no second polarity while one is live.
 */
export class SpireStormArena extends SpireRules(
  AscendantStormTwinsRules(StormTwinsArena),
) {
  constructor(code: string) {
    super(code, "storm-twins");
  }
  protected override resetAscendantReads() {
    this.resetTwinReads();
  }
  /**
   * Floor 70's ring is the Ascendant's: setupFloor lays the court before
   * it turns the Ascendant's rules on (floor 60 once laid the raid's
   * brazier spots that way), so its court is laid with them on.
   */
  protected override setupArena() {
    if (this.bossFloor()) this.raid.variant = "ascendant";
    super.setupArena();
  }
  /**
   * Both twins keep their own names (Fizz and Crackle: the raid's name is
   * the Ascendant's), and neither starts under a phone's touch controls.
   */
  protected override placeAscendant(_name: string) {
    const twins = this.players.filter((p) => p.raidBoss);
    for (const t of this.raid.twins ?? []) {
      const p = twins.find((q) => q.id === t.id);
      if (p) p.name = t.name;
    }
    if (twins.some((p) => spireUnderControls(p.x, p.y, STORM_TWINS.radius)))
      twins.forEach((p, i) => Object.assign(p, SPIRE_TWIN_SPAWNS[i] ?? {}));
  }
  protected override clearBossCourt() {
    super.clearBossCourt();
    // The raid's beam, fields, rushes, chain, polarity and their hit memory.
    this.clearAttacks();
    Object.assign(this.raid, {
      twins: [],
      twinRevivals: 0,
      stormBeam: undefined,
      stormChain: undefined,
      stormFields: [],
      stormRushes: [],
      polarities: [],
      polarityPad: undefined,
    });
  }
  /** The captain staggers as any elite does (the twins' stagger is per twin). */
  protected override addBossStagger(p: Fighter, amount: number) {
    if (this.bossFloor()) return super.addBossStagger(p, amount);
    this.raid.stagger = Math.min(100, this.raid.stagger + amount);
  }
  /** The captain casts while no polarity is live (the twins wait for a twin). */
  protected override canStartAttack() {
    if (this.bossFloor()) return super.canStartAttack();
    return !this.raid.polarities?.length;
  }
  /** The twins' drift and rushes belong to their own floor. */
  protected override bossStep(dt: number, boss: Fighter) {
    if (this.bossFloor()) super.bossStep(dt, boss);
  }
  /** So do their revivals, fields, beams and the raid's polarity. */
  protected override worldStep(dt: number, boss: Fighter) {
    if (this.bossFloor()) super.worldStep(dt, boss);
  }
  /**
   * A stand-in's twin-balancing and dodging are the twins' floor's; on the
   * Spire's court it plays like any raider, and answers the captain's mark
   * (the opposite pad, else the nearest opposite sign).
   */
  protected override botHint(
    bot: Fighter,
    input: Input,
    go: (x: number, y: number, away: boolean) => Input,
  ): Input | undefined {
    if (this.bossFloor()) return super.botHint(bot, input, go);
    const r = this.raid,
      mark = r.polarities?.find(
        (m) => m.playerId === bot.id && !m.cancelled && m.until > this.time,
      );
    if (!mark) return undefined;
    const pad = r.polarityPad;
    if (pad && pad.sign !== mark.sign) {
      if (
        Math.hypot(bot.x - pad.x, bot.y - pad.y) >
        STORM_TWINS.polarity.padRadius * 0.6
      )
        return go(pad.x, pad.y, false);
      input.dx = input.dy = 0;
      return input;
    }
    const opposite = (r.polarities ?? [])
      .filter((m) => m.sign !== mark.sign)
      .map((m) => this.heroes().find((p) => p.id === m.playerId && p.hp > 0))
      .filter((p): p is Fighter => !!p)
      .sort(
        (a, b) =>
          Math.hypot(a.x - bot.x, a.y - bot.y) -
          Math.hypot(b.x - bot.x, b.y - bot.y),
      )[0];
    if (!opposite) return undefined;
    if (
      Math.hypot(bot.x - opposite.x, bot.y - opposite.y) >
      STORM_TWINS.polarity.range * 0.65
    )
      return go(opposite.x, opposite.y, false);
    input.dx = input.dy = 0;
    return input;
  }
  protected override pressured(kind: RaidAttack, alive: Fighter[]) {
    return this.bossFloor() && super.pressured(kind, alive);
  }
  /**
   * The elite's Polarity: every raider marked + or − (spirePolarityPlan),
   * on the raid's own warning clock (the warning is the mark's countdown;
   * the marks and the pad are what is drawn). No fair answer, no marks: the
   * captain tries again a moment later. On floor 70 the twins' own, with
   * their pad kept clear of the phone's controls.
   */
  protected override startAttack(kind: RaidAttack, target: Fighter): void {
    if (this.bossFloor()) {
      super.startAttack(kind, target);
      this.keepPadOpen();
      return;
    }
    if (kind !== "polarity") return super.startAttack(kind, target);
    const r = this.raid,
      boss = this.boss();
    if (!boss || r.polarities?.length) return;
    this.walls();
    const alive = this.heroes().filter((p) => p.hp > 0);
    const plan = spirePolarityPlan(alive, r.seed + this.attacks);
    if (!plan) {
      this.nextAttack = this.time + 0.6;
      return;
    }
    const count = this.seenAttacks.get(kind) ?? 0;
    this.seenAttacks.set(kind, count + 1);
    boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
    const w = this.warn(
      kind,
      boss.x,
      boss.y,
      boss.x,
      boss.y,
      0,
      STORM_TWINS.polarity.seconds,
    );
    // The marks' whole countdown, as in the twins' raid (the tier never
    // shortens it: the marks are what is read).
    w.at = this.time + STORM_TWINS.polarity.seconds;
    w.teach = count < 2;
    r.polarities = alive.map((p, i) => ({
      playerId: p.id,
      sign: plan.signs[i],
      until: w.at,
      cancelled: false,
    }));
    r.polarityPad = plan.pad ? { ...plan.pad, until: w.at } : undefined;
  }
  /** (Its countdown is the marks': they settle in stepElitePolarity.) */
  protected override resolveWarning(w: RaidWarning, boss: Fighter) {
    if (this.bossFloor() || w.kind !== "polarity")
      return super.resolveWarning(w, boss);
  }
  /** Floor 70: a pad the twins lay under a thumb moves to open ground. */
  private keepPadOpen() {
    const pad = this.raid.polarityPad;
    if (!pad) return;
    this.walls();
    if (spirePadOpen(pad.x, pad.y)) return;
    const mark = this.raid.polarities?.find((m) => m.sign !== pad.sign);
    const p = this.heroes().find((q) => q.id === mark?.playerId) ?? pad;
    const spot = spirePolarityPad(p);
    if (spot) Object.assign(pad, spot);
  }
  override tick(dt = 1 / RULES.tick) {
    super.tick(dt);
    this.stepElitePolarity();
  }
  /**
   * The captain's marks: a raider by an opposite sign (or on the opposite
   * pad) is cancelled, both of them; a raider left with no opposite to
   * reach (their partners went down) is let off. When the countdown runs
   * out, each mark still live hurts its raider once (twice as hard by a
   * live mark of the same sign, as in the raid); the captain's fall takes
   * its marks with it.
   */
  private stepElitePolarity() {
    const r = this.raid,
      marks = r.polarities ?? [];
    if (this.bossFloor() || !marks.length) return;
    const boss = this.boss();
    if (this.phase !== "playing" || !boss || r.result) {
      r.polarities = [];
      r.polarityPad = undefined;
      return;
    }
    const P = STORM_TWINS.polarity,
      alive = this.heroes().filter((p) => p.hp > 0),
      at = (m: { playerId: string }) => alive.find((p) => p.id === m.playerId);
    const pad = r.polarityPad;
    for (const m of marks) {
      const p = at(m);
      if (!p || m.cancelled || m.until <= this.time) continue;
      const onPad =
        !!pad &&
        pad.sign !== m.sign &&
        Math.hypot(p.x - pad.x, p.y - pad.y) <= P.padRadius;
      const partners = marks.filter((n) => n.sign !== m.sign && at(n));
      const by = partners.filter((n) => {
        const q = at(n)!;
        return Math.hypot(q.x - p.x, q.y - p.y) <= P.range;
      });
      if (onPad || by.length) {
        for (const n of [m, ...by])
          if (!n.cancelled) {
            n.cancelled = true;
            this.event("heal", at(n)!, 0x8cead0, 0, n.playerId);
          }
      } else if (!partners.length && !(pad && pad.sign !== m.sign))
        m.cancelled = true;
    }
    for (const m of marks) {
      if (m.until > this.time || m.cancelled) continue;
      const p = at(m);
      if (!p) continue;
      if (p.character === "terradon" && this.has(p, "shell")) continue;
      if (this.curled(p)) continue;
      const crowded = marks.some(
        (n) =>
          n !== m &&
          !n.cancelled &&
          n.sign === m.sign &&
          !!at(n) &&
          Math.hypot(at(n)!.x - p.x, at(n)!.y - p.y) <= P.range,
      );
      this.hitBy = "polarity";
      this.damage(p, P.damage * (crowded ? 2 : 1), boss.id);
      this.hitBy = undefined;
    }
    r.polarities = marks.filter((m) => m.until > this.time);
    if (
      r.polarityPad &&
      (r.polarityPad.until <= this.time || !r.polarities.length)
    )
      r.polarityPad = undefined;
  }
}
/** Any zone's climb. */
export type SpireRoom =
  | SpireArena
  | SpireTideArena
  | SpireGloomArena
  | SpireDreamArena
  | SpireLightArena
  | SpireEmberArena
  | SpireStormArena;
export const isSpireArena = (a: unknown): a is SpireRoom =>
  a instanceof SpireArena ||
  a instanceof SpireTideArena ||
  a instanceof SpireGloomArena ||
  a instanceof SpireDreamArena ||
  a instanceof SpireLightArena ||
  a instanceof SpireEmberArena ||
  a instanceof SpireStormArena;
/** The room for a climb of `zone` (the server checked it is built). */
export function createSpireArena(code: string, zone = 1): SpireRoom {
  return zone === 7
    ? new SpireStormArena(code)
    : zone === 6
      ? new SpireEmberArena(code)
      : zone === 5
        ? new SpireLightArena(code)
        : zone === 4
          ? new SpireDreamArena(code)
          : zone === 3
            ? new SpireGloomArena(code)
            : zone === 2
              ? new SpireTideArena(code)
              : new SpireArena(code);
}
