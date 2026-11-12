// Web Crypto also lets the local visual lab run this exact simulation.
const randomUUID = () => crypto.randomUUID();
const randomInt = (max: number) => {
  const values = new Uint32Array(1),
    limit = Math.floor(4294967296 / max) * max;
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= limit);
  return values[0] % max;
};
import { Arena } from "./simulation.js";
import {
  CHARACTERS,
  OBSTACLES,
  RULES,
  blankInput,
  blocked,
  move,
  normalize,
  useObstacles,
  type Ability,
  type CharacterId,
  type Fighter,
  type Input,
  type StatusKind,
} from "../../../packages/shared/src/index.js";
import {
  GRUMBLECRAG,
  RAID,
  RAID_BOSSES,
  RAID_ATTACKS,
  raidChapters,
  raidTraitFor,
  ritesFor,
  riteValue,
  RESCUE_HEALTH,
  RAID_RITE_OFFER,
  RAID_RITE_PICKS,
  RAID_BOSS_RITES,
  RAID_PING_SECONDS,
  RAID_TRAITS,
  eruptionChain,
  raidPattern,
  pacificDate,
  type RaidBossId,
  type RaidDreamView,
  type DreamRune,
  type RaidAttack,
  type RaidPingKind,
  type RaidState,
  type RaidRite,
  type RaidWarning,
  type RaidTier,
  RAID_ENRAGE,
  RAID_TELEGRAPH_FLOOR,
  raidEnrageSteps,
  raidSoloRevive,
  raidTelegraph,
  raidTier,
} from "../../../packages/shared/src/raid.js";
import { BotBrain } from "./bot.js";
import {
  RAID_CLUSTER_ATTACKS,
  RAID_DURATION_ATTACKS,
  RAID_EXCLUSIVE_ATTACKS,
  RAID_FREEZE,
  RAID_HARMLESS_ATTACKS,
  RAID_IMPACT_GAP,
  RAID_JUMP_ATTACKS,
  RAID_LINE_ATTACKS,
  RAID_PRESSURE_ATTACKS,
  RAID_REACTION,
  RAID_SLOWEST_SPEED,
  buildRaidDeck,
  raidShapeHits,
  raidShapeOf,
  type RaidReaction,
  type RaidSituation,
} from "./raid-ai.js";
export type { RaidReaction, RaidSituation } from "./raid-ai.js";
const BOSS = GRUMBLECRAG;
/** The numbers every boss shares the shape of (health, Peril damage, rhythm). */
export type RaidBossNumbers = {
  readonly health: {
    readonly base: number;
    readonly perExtraPlayer: number;
    readonly gilded: number;
  };
  readonly perilDamage: readonly number[];
  readonly cadence: {
    readonly normal: number;
    readonly restless: number;
    readonly finalPhase: number;
  };
};

/** Champion tricks on Grumblecrag (docs/raid-roster-design.md §6). */
const TRICKS = {
  /** Astrabun's Mochi Pound. */
  poundStagger: 15,
  /** Wombolder's charge that would drive Grumblecrag into a pillar. */
  slamStagger: 25,
  /** Sunbara's Warm Spring: revive speed for a fallen ally inside it. */
  springRevive: 2,
};
/** Attacks thrown across the arena: aimed at raiders keeping their distance. */
const FAR_ATTACKS = new Set<string>([
  "charge",
  "volley",
  "dive",
  "wave",
  "lunge",
  "prism-lance",
  "dive-bomb",
  "twin-rush",
]);
/** Attacks that jump between raiders standing close: aimed into a crowd. */
const CROWD_ATTACKS = new Set<string>(["chain-lightning"]);
/**
 * Peril 1 and 2 (tests and the legacy rules) keep the old numbers; live raids
 * run at Peril 3 and read the star tier (RAID_TIERS).
 */
const LEGACY_TIER: RaidTier = {
  health: 1,
  damage: 1,
  cadence: 1,
  concurrency: [1, 1, 1],
  telegraph: 1,
  leadFraction: 0,
  leadCap: 0,
  windows: 1,
  enrageAt: Infinity,
  reviveSeconds: RAID.reviveSeconds,
  reviveImmunity: 2,
  pressureFrom: Infinity,
};
/** The signature card each boss plays at least once every four attacks. */
const SIGNATURES: Partial<Record<string, RaidAttack>> = {
  grumblecrag: "charge",
  tidewyrm: "dive",
  gloomshade: "split",
  somnara: "dream-sequence",
  prismatail: "light-relay",
  emberwing: "brazier-lighting",
  "storm-twins": "polarity",
};
/** A repeatable 0–1 jitter for target choice (same raid, same choices). */
export function raidJitter(seed: number, attack: number, index: number) {
  let h =
    (seed ^
      Math.imul(attack + 1, 0x9e3779b1) ^
      Math.imul(index + 1, 0x85ebca6b)) >>>
    0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}
export class RaidArena extends Arena {
  raid: RaidState;
  protected nextAttack = 0;
  protected phaseElapsed = 0;
  protected attacks = 0;
  protected started = false;
  protected charging?: {
    tx: number;
    ty: number;
    until: number;
    hit: Set<string>;
    targetId?: string;
    /** The return run of a charge that missed (it doesn't turn again). */
    back?: boolean;
  };
  /** Pillars Grumblecrag has charged into this chapter. */
  protected pillarBreaks = 0;
  protected seenAttacks = new Map<string, number>();
  protected rescueCredit = new Map<string, Set<string>>();
  protected downAt = new Map<string, number>();
  protected crawl = new Map<string, { dx: number; dy: number }>();
  protected selfUsed = false;
  protected coreAt = new Map<string, number>();
  protected damageAt = new Map<string, number>();
  /** The boss attack currently dealing damage (for "what downed you"). */
  protected hitBy?: RaidAttack;
  /** Downs per attack this run, saved for balance tuning. */
  downCauses: Partial<Record<RaidAttack, number>> = {};
  protected pingAt = new Map<string, number>();
  /** Charges this run that hit a pillar, and ones that ran their course. */
  chargeBaits = 0;
  /** Threat: recent damage each raider dealt to the boss (fades in seconds). */
  protected threat = new Map<string, number>();
  protected lastTargetId: string | undefined;
  chargeMisses = 0;
  /** Raiders hit by the attack that is resolving (practice dodge count). */
  protected struck = new Set<string>();
  /** This chapter's attack deck (the next cards, top first). */
  protected deck: RaidAttack[] = [];
  protected deckCycle = 0;
  protected lastKind: RaidAttack | undefined;
  protected sinceSignature = 0;
  /** `attacks` when the boss last played a reaction instead of the deck. */
  protected lastReaction = -99;
  /** Raiders picked by the last attacks (newest last). */
  protected recentTargets: string[] = [];
  /** Which attack each live warning belongs to (overlaps count attacks). */
  protected castOf = new WeakMap<RaidWarning, number>();
  protected castSerial = 0;
  protected currentCast = 0;
  /** Warnings already checked against the honesty rules. */
  protected settled = new WeakSet<RaidWarning>();
  /** Party pressure: the same attack at a second raider, a moment later. */
  protected echoes: {
    at: number;
    kind: RaidAttack;
    cast: number;
    exclude: string[];
  }[] = [];
  /** Recent velocity of each raider (for predictive aim). */
  protected motion = new Map<string, { t: number; vx: number; vy: number }[]>();
  /** When each raider stepped into melee range. */
  protected meleeSince = new Map<string, number>();
  constructor(code: string, boss: RaidBossId = "grumblecrag") {
    super(code, "raid");
    this.raid = {
      bossId: "raid-boss",
      boss,
      name: RAID_BOSSES[boss].name,
      peril: RAID.maxPeril,
      trait: "ancient",
      gilded: false,
      phase: 1,
      maxHp: 1,
      stagger: 0,
      staggerUntil: 0,
      exposedUntil: 0,
      warnings: [],
      pillars: [],
      downed: {},
      wards: [],
      rites: {},
      offers: {},
      daily: false,
      day: pacificDate(),
      seed: randomInt(1 << 30),
      partySize: 1,
      elapsed: 0,
      result: null,
      revives: 0,
      downs: 0,
      message: "Bait charges into pillars. Break armor. Rescue your team.",
    };
  }
  heroes() {
    return this.players.filter((p) => !p.raidBoss && !p.out);
  }
  boss() {
    return this.players.find((p) => p.raidBoss);
  }
  override add(id: string, name: string, character: CharacterId = "voltkit") {
    const p = super.add(id, name, character);
    p.team = 0;
    return p;
  }
  /** This boss's health, Peril damage and attack rhythm. */
  protected def(): RaidBossNumbers {
    return BOSS;
  }
  /** Raids have one difficulty now: always Peril 3 (the argument is kept
   * for tests and the engine's Peril-based rules). */
  configure(peril: number = RAID.maxPeril, _legacyDaily = false) {
    this.raid.peril = peril;
    this.raid.daily = false;
  }
  /** The boss's feat for this run (Grumblecrag: every charge hit a pillar). */
  feat() {
    return (
      this.raid.result === "victory" &&
      this.chargeBaits >= 3 &&
      this.chargeMisses === 0
    );
  }
  override start() {
    this.players = this.players.filter((p) => !p.raidBoss && !p.out);
    super.start();
    const r = this.raid;
    r.result = null;
    r.closingRadius = undefined;
    this.phaseElapsed = 0;
    r.resultId = undefined;
    r.rewardStatus = undefined;
    r.elapsed = 0;
    r.phase = 1;
    r.stagger = 0;
    r.staggerUntil = 0;
    r.exposedUntil = 0;
    r.partySize = this.players.length;
    r.daily = false;
    r.day = pacificDate();
    r.seed = randomInt(1 << 30);
    r.trait = raidTraitFor(r.boss, r.seed);
    r.gilded = randomInt(20) === 0;
    this.chargeBaits = 0;
    this.threat.clear();
    this.lastTargetId = undefined;
    this.chargeMisses = 0;
    const def = this.def();
    r.maxHp = Math.round(
      (def.health.base + def.health.perExtraPlayer * (r.partySize - 1)) *
        RAID.healthScale *
        (RAID.perilHealth[r.peril] ?? 1) *
        this.tier().health *
        (r.partySize === 1 ? RAID.soloHealth : 1) *
        (r.gilded ? def.health.gilded : 1),
    );
    r.enrage = 0;
    r.enrageAt = undefined;
    this.resetBrain();
    r.pings = [];
    r.drillStats = r.drill ? { hits: 0, dodges: 0 } : undefined;
    this.downCauses = {};
    this.pingAt.clear();
    r.warnings = [];
    r.wards = [];
    r.downed = {};
    r.rites = {};
    r.offers = {};
    r.contributions = Object.fromEntries(
      this.players.map((p) => [
        p.id,
        { damage: 0, revives: 0, pillars: 0, downs: 0 },
      ]),
    );
    this.seenAttacks.clear();
    this.rescueCredit.clear();
    r.downs = 0;
    r.revives = 0;
    this.setupArena();
    this.downAt.clear();
    this.crawl.clear();
    this.coreAt.clear();
    this.damageAt.clear();
    this.selfUsed = false;
    this.charging = undefined;
    this.attacks = 0;
    this.started = false;
    this.players.forEach((p, i) => {
      p.team = 0;
      p.x = 260 + (i % 2) * 85;
      p.y = 330 + Math.floor(i / 2) * 160;
    });
    const boss = super.add(r.bossId, RAID_BOSSES[r.boss].name, "terradon");
    const home = this.bossHome();
    Object.assign(boss, {
      raidBoss: true,
      team: 1,
      hp: r.maxHp,
      x: home.x,
      y: home.y,
      ready: true,
    });
    this.instructionsReady = [boss.id];
    r.message = `${r.gilded ? "Gilded " : ""}${RAID_TRAITS[r.trait].name} ${RAID_BOSSES[r.boss].name} · ${RAID_TRAITS[r.trait].text}`;
  }
  /** The arena's features at the start of a run (Grumblecrag: four pillars). */
  protected setupArena() {
    // Grumblecrag fights in the Coliseum. Rooms made with "create" turn on
    // PvP arena rotation, which would otherwise have picked a duel court
    // (the other bosses set their own arena).
    this.arenaId = "classic";
    this.raid.pillars = OBSTACLES.map((o) => ({
      x: o.x + o.w / 2,
      y: o.y + o.h / 2,
      broken: false,
    }));
  }
  /** Where the boss starts. */
  protected bossHome() {
    return { x: 1230, y: 450 };
  }
  retry() {
    if (this.phase !== "finished") return;
    this.start();
    this.instructionsReady = this.players.map((p) => p.id);
    this.offerRaidRites();
  }
  override acknowledgeInstructions(id: string) {
    const ok = super.acknowledgeInstructions(id);
    if (ok && this.phase === "countdown") this.offerRaidRites();
    return ok;
  }
  protected offerRaidRites() {
    this.phase = "intermission";
    this.deadline = this.time + RAID.riteChoiceSeconds;
    this.projectiles = [];
    this.zones = [];
    this.raid.warnings = [];
    this.clearAttacks();
    const all = ritesFor(this.raid.boss);
    for (const [seat, p] of this.heroes().entries()) {
      const owned = this.raid.rites[p.id] ?? [];
      // The boss's own rite always leads the offer (it answers its mechanic).
      const own = all.filter(
        (id) => !owned.includes(id) && RAID_BOSS_RITES[id] === this.raid.boss,
      );
      const shared = all.filter(
        (id) => !owned.includes(id) && !own.includes(id),
      );
      const room = Math.max(0, RAID_RITE_OFFER - own.length);
      const options = shared;
      // Stable by party seat for daily fairness, while teammates see varied offers.
      const offset =
        (this.raid.seed + this.raid.phase * 7 + seat) %
        Math.max(1, options.length);
      this.raid.offers[p.id] = [
        ...own,
        // Rotated by seat, so teammates see a different order (and keys 1-4).
        ...Array.from(
          { length: Math.min(room, options.length) },
          (_, i) => options[(offset + i) % options.length],
        ),
      ];
    }
  }
  override pickRite(id: string, riteId: string) {
    if (
      this.phase !== "intermission" ||
      !this.raid.offers[id]?.includes(riteId as RaidRite)
    )
      return false;
    const rites = (this.raid.rites[id] = [
      ...(this.raid.rites[id] ?? []),
      riteId as RaidRite,
    ]);
    const left = this.raid.offers[id].filter((r) => r !== riteId);
    if (rites.length >= RAID_RITE_PICKS || !left.length)
      delete this.raid.offers[id];
    else this.raid.offers[id] = left;
    if (!Object.keys(this.raid.offers).length) this.deadline = this.time + 1;
    return true;
  }
  protected hasRite(p: Fighter, id: RaidRite) {
    return this.raid.rites[p.id]?.includes(id);
  }
  override walls() {
    const list = OBSTACLES.filter((_, i) => !this.raid?.pillars[i]?.broken);
    useObstacles(list);
    return list;
  }
  override damageLimit(target: Fighter) {
    if (target.raidBoss && this.raid.phase < 3)
      return Math.max(
        0,
        target.hp - this.raid.maxHp * (this.raid.phase === 1 ? 0.67 : 0.33),
      );
    return target.hp;
  }
  override reflectDamage(source: Fighter, target: Fighter, amount: number) {
    this.damage(source, amount * 0.3, target.id);
  }
  override status(p: Fighter, kind: StatusKind, duration: number, by?: string) {
    if (
      p.raidBoss &&
      ["stun", "freeze", "paralysis", "sleep", "root"].includes(kind)
    ) {
      this.addBossStagger(p, 3);
      return;
    }
    // Sloth Time slows a boss like any other slow, not to a crawl.
    if (p.raidBoss && kind === "warp") kind = "slow";
    super.status(p, kind, duration, by);
  }
  override damage(
    target: Fighter,
    amount: number,
    owner: string,
    ability?: Ability,
  ) {
    if (target.hp <= 0 || this.phase !== "playing") return;
    const source = this.players.find((p) => p.id === owner);
    if (
      source &&
      this.teamOf(source) === this.teamOf(target) &&
      source !== target
    )
      return;
    const r = this.raid;
    if (r.drill) {
      // Practice: the boss can't be hurt, and its hits only count.
      if (target.raidBoss || !source?.raidBoss) return;
      if (ability?.ground && target.jumpUntil > this.time) return;
      if (!this.struck.has(target.id)) {
        this.struck.add(target.id);
        if (r.drillStats) r.drillStats.hits++;
        this.event("hit", target, 0xff8c99, 0, owner);
      }
      return;
    }
    if (source?.raidBoss) {
      amount *= this.bossDamage();
      if (!(ability?.ground && target.jumpUntil > this.time))
        this.struck.add(target.id);
    }
    if (target.raidBoss) {
      const exposed = this.bossExposed(target);
      amount *= exposed ? this.coreMultiplier(target) : 0.72;
      if (
        source &&
        this.hasRite(source, "courage") &&
        source.hp < CHARACTERS[source.character].health * 0.5
      )
        amount *= 1 + riteValue("courage", r.phase);
      if (
        source &&
        exposed &&
        this.hasRite(source, "core") &&
        this.time >= (this.coreAt.get(source.id) ?? 0)
      ) {
        amount += riteValue("core", r.phase);
        this.coreAt.set(source.id, this.time + 1);
      }
      this.addBossStagger(target, Math.min(1.3, amount * 0.025));
      if (source && !r.drill && r.boss === "grumblecrag")
        this.crackTricks(target, source, ability);
      // Bosses cannot be displaced or stun-locked by normal fighter kits.
      ability = ability ? { ...ability, knockback: 0 } : undefined;
    } else if (
      r.wards.some(
        (w) =>
          w.until > this.time &&
          Math.hypot(w.x - target.x, w.y - target.y) < 130,
      )
    )
      amount *= 1 - riteValue("shelter", r.phase);
    if (target.raidBoss) amount = Math.min(amount, this.damageLimit(target));
    const before = target.hp;
    super.damage(target, amount, owner, ability);
    if (target.raidBoss && source && !source.raidBoss)
      this.threat.set(
        source.id,
        (this.threat.get(source.id) ?? 0) +
          Math.max(0, before - Math.max(0, target.hp)),
      );
    if (target.raidBoss && source && r.contributions?.[source.id])
      r.contributions[source.id].damage += Math.max(
        0,
        before - Math.max(0, target.hp),
      );
    if (!target.raidBoss && target.hp < before) {
      this.damageAt.set(target.id, this.time);
      if (target.hp <= 0) {
        r.downs++;
        this.downAt.set(target.id, this.time);
        r.downed[target.id] = {
          progress: 0,
          // Solo gets one self-revive, except against ★★★ bosses.
          self: r.partySize === 1 && !this.selfUsed && !!this.soloRevive(),
          ...(this.hitBy ? { cause: this.hitBy } : {}),
        };
        if (this.hitBy)
          this.downCauses[this.hitBy] = (this.downCauses[this.hitBy] ?? 0) + 1;
        const mine = r.contributions?.[target.id];
        if (mine) mine.downs = (mine.downs ?? 0) + 1;
      }
    }
  }
  /** Astrabun's Mochi Pound, and Wombolder ramming Grumblecrag into a pillar. */
  private crackTricks(boss: Fighter, source: Fighter, ability?: Ability) {
    const r = this.raid;
    // Only the last pound of the chain (the one that stuns) counts.
    if (ability?.id === "mochi-pound" && ability.status) {
      this.addBossStagger(boss, TRICKS.poundStagger);
      r.message = `${source.name}'s Mochi Pound rattles Grumblecrag!`;
    } else if (
      ability?.kind === "rush" &&
      ability.wallSlam &&
      this.slammed(source, boss, ability.knockback)
    ) {
      this.addBossStagger(boss, TRICKS.slamStagger);
      r.message = `${source.name} rams Grumblecrag into a pillar!`;
    }
  }
  /** The engine's wall-slam check: would the knockback drive it into a wall? */
  protected slammed(from: Fighter, target: Fighter, knockback: number) {
    this.walls();
    const dir = normalize(target.x - from.x, target.y - from.y);
    for (let d = 10; d <= knockback; d += 10)
      if (blocked(target.x + dir.x * d, target.y + dir.y * d, RULES.radius))
        return true;
    return false;
  }
  /** Zones of these skills cast by raiders (champion tricks look for them). */
  protected heroZones(...ids: string[]) {
    return this.zones.filter(
      (z) =>
        ids.includes(z.ability.id) &&
        this.heroes().some((p) => p.id === z.owner),
    );
  }
  /** Pangrove curled into a ball (Curl & Roll, or flying as a Pinball)? */
  protected curled(p: Fighter) {
    return (
      p.character === "pangrove" &&
      ((!!p.roll && p.roll.until > this.time) ||
        (!!p.pinball && this.time < p.dashUntil))
    );
  }
  /** Is a raider standing in a Warm Spring (or another of these zones)? */
  protected inSpring(p: Fighter, ...ids: string[]) {
    return this.heroZones(...(ids.length ? ids : ["warm-spring"])).some(
      (z) => Math.hypot(z.x - p.x, z.y - p.y) < z.radius + RULES.radius,
    );
  }
  /**
   * Coilemur's Magnet Lash drags the first fallen ally along it (before it
   * reaches the boss) to Coilemur's side.
   */
  private lashRescue(p: Fighter, a: Ability) {
    const dir = { x: Math.cos(p.angle), y: Math.sin(p.angle) };
    const along = (q: Fighter, size: number) => {
      const t = (q.x - p.x) * dir.x + (q.y - p.y) * dir.y,
        off = Math.abs((q.y - p.y) * dir.x - (q.x - p.x) * dir.y);
      return t > 0 && t <= a.range && off < a.radius + size ? t : Infinity;
    };
    const boss = this.boss(),
      stop = boss ? along(boss, this.hitRadius(boss)) : Infinity;
    const ally = this.heroes()
      .filter(
        (q) =>
          q !== p &&
          q.hp <= 0 &&
          this.raid.downed[q.id] &&
          along(q, RULES.radius) < stop &&
          this.lineClear(p, q),
      )
      .sort((m, n) => along(m, RULES.radius) - along(n, RULES.radius))[0];
    if (!ally) return;
    const d = normalize(p.x - ally.x, p.y - ally.y),
      room = Math.max(
        0,
        Math.hypot(p.x - ally.x, p.y - ally.y) - RULES.radius * 2 - 6,
      );
    move(ally, d.x * room, d.y * room);
    this.raid.message = `${p.name} lashes ${ally.name} to safety!`;
  }
  override cast(p: Fighter, a: Ability, ex = false) {
    super.cast(p, a, ex);
    if (
      a.id === "magnet-lash" &&
      !p.raidBoss &&
      p.hp > 0 &&
      this.raid.boss === "grumblecrag"
    )
      this.lashRescue(p, a);
    // Lumoth's Kindle jump-starts the revive of fallen allies nearby.
    if (p.character === "lumoth" && a.kind === "buff" && !p.raidBoss)
      for (const ally of this.heroes()) {
        const down = this.raid.downed[ally.id];
        if (
          !down ||
          down.self ||
          ally === p ||
          Math.hypot(ally.x - p.x, ally.y - p.y) > RAID.reviveRange + 60
        )
          continue;
        down.progress = Math.min(0.95, down.progress + 0.5);
        const credit = this.rescueCredit.get(ally.id) ?? new Set<string>();
        credit.add(p.id);
        this.rescueCredit.set(ally.id, credit);
        this.event("heal", ally, 0x7dffb0, 0, p.id);
      }
    if (this.hasRite(p, "mending") && a.id === this.kit(p).skills[3].id)
      for (const hero of this.heroes())
        if (hero.hp > 0 && Math.hypot(hero.x - p.x, hero.y - p.y) < 300) {
          const before = hero.hp;
          hero.hp = Math.min(
            CHARACTERS[hero.character].health,
            hero.hp +
              CHARACTERS[hero.character].health *
                riteValue("mending", this.raid.phase),
          );
          this.event(
            "heal",
            hero,
            0x7dffb0,
            Math.round(hero.hp - before),
            hero.id,
          );
        }
  }
  override submit(p: Fighter, input: Input) {
    if (p.hp <= 0) {
      // Downed players can crawl but cannot send attacks or movement prediction.
      if (this.phase === "playing" && !p.out && input.seq > p.ack) {
        p.ack = input.seq;
        this.crawl.set(p.id, { dx: input.dx, dy: input.dy });
      }
      return;
    }
    super.submit(p, input);
  }
  override stepOrbs() {
    const heroes = this.heroes(),
      before = this.events.at(-1)?.id ?? 0;
    // Only living heroes may collect a raid orb.
    const all = this.players;
    this.players = heroes;
    super.stepOrbs();
    this.players = all;
    for (const e of this.events)
      if (e.id > before && e.abilityId === "energy-orb") {
        const owner = heroes.find((p) => p.id === e.owner);
        if (owner && this.hasRite(owner, "sharing"))
          for (const p of heroes)
            if (
              p !== owner &&
              p.hp > 0 &&
              Math.hypot(p.x - owner.x, p.y - owner.y) < 320
            )
              this.chargeUlt(p, riteValue("sharing", this.raid.phase));
      }
  }
  protected revive(p: Fighter, extra = false, self = false) {
    p.hp =
      CHARACTERS[p.character].health *
      (self
        ? (this.soloRevive()?.hp ?? 0.45)
        : 0.45 +
          (extra
            ? RESCUE_HEALTH[Math.max(0, Math.min(2, this.raid.phase - 1))]
            : 0));
    p.statuses = [];
    p.lastInput = blankInput();
    p.immuneUntil = this.time + this.tier().reviveImmunity;
    delete this.raid.downed[p.id];
    this.downAt.delete(p.id);
    this.crawl.delete(p.id);
    this.raid.revives++;
    this.event("heal", p, 0x7dffb0, Math.round(p.hp), p.id);
  }
  protected resolveDowns(dt: number) {
    const heroes = this.heroes();
    for (const p of heroes) {
      if (p.hp > 0) continue;
      const crawl = this.crawl.get(p.id) ?? { dx: 0, dy: 0 },
        dir = normalize(crawl.dx, crawl.dy);
      move(p, dir.x * 35 * dt, dir.y * 35 * dt);
      const down = this.raid.downed[p.id];
      if (!down) continue;
      if (down.self && !this.selfUsed) {
        down.progress = Math.min(
          1,
          (this.time - (this.downAt.get(p.id) ?? this.time)) /
            (this.soloRevive()?.seconds ?? RAID.selfReviveDelay),
        );
        if (down.progress >= 1) {
          this.selfUsed = true;
          this.revive(p, false, true);
        }
        continue;
      }
      const rescuers = heroes.filter(
        (q) =>
          q !== p &&
          q.hp > 0 &&
          Math.hypot(q.x - p.x, q.y - p.y) <= RAID.reviveRange &&
          this.time - (this.damageAt.get(q.id) ?? -99) > 0.6,
      );
      if (rescuers.length) {
        const credit = this.rescueCredit.get(p.id) ?? new Set<string>();
        rescuers.forEach((q) => credit.add(q.id));
        this.rescueCredit.set(p.id, credit);
        const fast = rescuers.some((q) => this.hasRite(q, "rescue"));
        // Sunbara's Warm Spring: a fallen ally inside it comes back faster.
        const spring =
          this.raid.boss === "grumblecrag" && this.inSpring(p)
            ? TRICKS.springRevive
            : 1;
        down.progress = Math.min(
          1,
          down.progress +
            (dt / this.tier().reviveSeconds) *
              spring *
              (fast ? 1 + riteValue("rescue", this.raid.phase) : 1),
        );
        if (down.progress >= 1) {
          for (const id of credit)
            if (this.raid.contributions?.[id])
              this.raid.contributions[id].revives++;
          this.rescueCredit.delete(p.id);
          this.revive(p, fast);
        }
      }
    }
    if (
      heroes.length &&
      heroes.every((p) => p.hp <= 0) &&
      !heroes.some((p) => this.raid.downed[p.id]?.self && !this.selfUsed)
    )
      this.finish(false);
  }
  protected warn(
    kind: RaidAttack,
    x: number,
    y: number,
    tx: number,
    ty: number,
    radius: number,
    delay: number,
  ): RaidWarning {
    delay = this.telegraph(kind, delay);
    const warning: RaidWarning = {
      id: ++this.serial,
      kind,
      x,
      y,
      tx,
      ty,
      radius,
      at: this.time + delay,
      startedAt: this.time,
    };
    this.raid.warnings.push(warning);
    this.castOf.set(warning, this.currentCast);
    return warning;
  }
  protected warnDebris(teach: boolean, second = false) {
    const delay = this.telegraph("debris", BOSS.debris.delay);
    for (const p of this.heroes().filter((p) => p.hp > 0)) {
      // The chapter-3 second wave lands where a running raider is heading.
      const at = second ? this.lead(p, delay) : p;
      Object.assign(
        this.warn(
          "debris",
          at.x,
          at.y,
          at.x,
          at.y,
          BOSS.debris.radius,
          BOSS.debris.delay,
        ),
        { teach },
      );
    }
    if (this.raid.peril >= 2 || this.raid.trait === "fractured")
      this.warn("debris", 800, 450, 800, 450, 135, 1.9);
  }
  /** A cone of stones from the boss towards a raider. */
  protected warnVolley(target: Fighter, teach: boolean) {
    const boss = this.boss()!;
    // The boss aims ahead of a raider running in a straight line (Peril 2:
    // a little; Peril 3: the star tier's lead).
    const legacy =
      this.raid.peril === 2 ? BOSS.volley.delay * 0.35 * this.cunning() : 0;
    const at =
      this.raid.peril >= 3
        ? this.lead(target, this.telegraph("volley", BOSS.volley.delay))
        : {
            x: target.x + (target.vx ?? 0) * legacy,
            y: target.y + (target.vy ?? 0) * legacy,
          };
    const d = normalize(at.x - boss.x, at.y - boss.y);
    const range = BOSS.volley.range + (this.raid.trait === "ancient" ? 40 : 0);
    return Object.assign(
      this.warn(
        "volley",
        boss.x,
        boss.y,
        boss.x + d.x * range,
        boss.y + d.y * range,
        range,
        BOSS.volley.delay,
      ),
      { spread: BOSS.volley.spread / 2, targetId: target.id, teach },
    );
  }
  /** Eruptions under one raider; each one that lands spawns the next. */
  protected warnEruption(target: Fighter, chain: number, teach: boolean) {
    // Into the middle of a stack around the target, else ahead of a runner.
    const at = this.aimFloor(
      "eruption",
      target,
      BOSS.eruption.radius,
      BOSS.eruption.delay,
    );
    return Object.assign(
      this.warn(
        "eruption",
        at.x,
        at.y,
        at.x,
        at.y,
        BOSS.eruption.radius,
        BOSS.eruption.delay,
      ),
      { targetId: target.id, chain, teach },
    );
  }
  /**
   * A meteor marks a raider and follows them. With friends alive it never
   * locks (gather on them to split it); alone it locks so it can be dodged.
   */
  protected warnShare(target: Fighter, teach: boolean) {
    const alone = this.heroes().filter((p) => p.hp > 0).length < 2;
    return Object.assign(
      this.warn(
        "share",
        target.x,
        target.y,
        target.x,
        target.y,
        BOSS.share.radius,
        BOSS.share.delay,
      ),
      {
        targetId: target.id,
        teach,
        ...(alone
          ? { lockAt: this.time + BOSS.share.delay - BOSS.share.soloLock }
          : {}),
      },
    );
  }
  /** Is a raider inside a volley cone (and not hiding behind a pillar)? */
  protected inVolley(w: RaidWarning, p: Fighter) {
    const dx = p.x - w.x,
      dy = p.y - w.y,
      dist = Math.hypot(dx, dy);
    if (dist > w.radius + RULES.radius) return false;
    const aim = Math.atan2(w.ty - w.y, w.tx - w.x);
    const off = Math.atan2(
      Math.sin(Math.atan2(dy, dx) - aim),
      Math.cos(Math.atan2(dy, dx) - aim),
    );
    if (
      Math.abs(off) >
      (w.spread ?? 0.45) + Math.atan2(RULES.radius, Math.max(dist, 1))
    )
      return false;
    return this.lineClear(w, p);
  }
  protected cadence() {
    const r = this.raid,
      cadence = this.def().cadence;
    const base = r.trait === "restless" ? cadence.restless : cadence.normal;
    const final = r.phase === 3 && !r.drill ? base * cadence.finalPhase : base;
    if (r.drill || r.peril < 3) return final;
    // Live raids: the star tier, party pressure (4 raiders: ×0.85) and the
    // soft enrage all shorten the gap. Telegraphs stay as long as they were.
    const party = 1 - 0.05 * (Math.max(1, r.partySize) - 1);
    return (
      final *
      this.tier().cadence *
      party *
      RAID_ENRAGE.cadence ** (r.enrage ?? 0)
    );
  }
  // ------------------------------------------------------------ Star tier
  /** This run's difficulty row (Peril 1-2 and practice keep the old rules). */
  protected tier(): RaidTier {
    return this.raid.peril >= 3 && !this.raid.drill
      ? raidTier(this.raid.boss)
      : LEGACY_TIER;
  }
  /** Boss damage × this: the tier, plus the soft enrage. */
  protected bossDamage() {
    const r = this.raid;
    if (r.peril < 3) return this.def().perilDamage[r.peril] ?? 1;
    return this.tier().damage * (1 + RAID_ENRAGE.damage * (r.enrage ?? 0));
  }
  /** A solo raider's self-revive this run (none against ★★★ bosses). */
  protected soloRevive() {
    const r = this.raid;
    if (r.peril >= 3) return raidSoloRevive(r.boss);
    return r.peril <= RAID.soloSelfReviveMaxPeril
      ? { seconds: RAID.selfReviveDelay, hp: 0.45 }
      : undefined;
  }
  /** An exposure, strand or grounded window on this tier (seconds). */
  protected window(seconds: number) {
    return seconds * this.tier().windows;
  }
  /** A telegraph's length on this tier; jump answers and durations keep theirs. */
  protected telegraph(kind: RaidAttack, seconds: number) {
    const r = this.raid;
    if (
      r.peril < 3 ||
      r.drill ||
      RAID_JUMP_ATTACKS.has(kind) ||
      RAID_DURATION_ATTACKS.has(kind) ||
      kind === "wave"
    )
      return seconds;
    return raidTelegraph(r.boss, seconds);
  }
  // ---------------------------------------------------------- Predictive aim
  /** Remember each raider's velocity for a moment (steady-movement check). */
  protected trackMotion() {
    for (const p of this.heroes()) {
      const list = this.motion.get(p.id) ?? [];
      list.push({ t: this.time, vx: p.vx ?? 0, vy: p.vy ?? 0 });
      while (list.length && list[0].t < this.time - 0.6) list.shift();
      this.motion.set(p.id, list);
    }
  }
  /** Has this raider kept running the same way for the last 0.3 s? */
  protected steady(p: Fighter) {
    const v = Math.hypot(p.vx ?? 0, p.vy ?? 0);
    if (v < 120) return false;
    const list = this.motion.get(p.id) ?? [];
    const then = list.find((s) => s.t >= this.time - 0.32);
    if (!then || then.t > this.time - 0.2) return false;
    const was = Math.hypot(then.vx, then.vy);
    if (was < 120) return false;
    const turn = Math.abs(
      Math.atan2(
        then.vx * (p.vy ?? 0) - then.vy * (p.vx ?? 0),
        then.vx * (p.vx ?? 0) + then.vy * (p.vy ?? 0),
      ),
    );
    return turn < (35 * Math.PI) / 180;
  }
  /**
   * Where `p` will be in `t` seconds if they keep running straight, capped by
   * the star tier. A raider standing still, slowing or weaving is not led, so
   * stopping or turning always beats a led shot.
   */
  protected lead(p: Fighter, t: number) {
    const tier = this.tier(),
      k = tier.leadFraction * this.cunning();
    const v = Math.hypot(p.vx ?? 0, p.vy ?? 0);
    if (k <= 0 || t <= 0 || !this.steady(p)) return { x: p.x, y: p.y };
    const d = Math.min(v * t * k, tier.leadCap);
    return {
      x: Math.max(40, Math.min(RULES.width - 40, p.x + ((p.vx ?? 0) / v) * d)),
      y: Math.max(40, Math.min(RULES.height - 40, p.y + ((p.vy ?? 0) / v) * d)),
    };
  }
  /**
   * Where a floor blast at `target` lands: the middle of a stack of raiders
   * around them (2 or more inside its reach), else ahead of a runner.
   */
  protected aimFloor(
    kind: RaidAttack,
    target: Fighter,
    radius: number,
    delay: number,
  ) {
    const r = this.raid;
    if (r.peril < 3 || r.drill) return { x: target.x, y: target.y };
    if (RAID_CLUSTER_ATTACKS.has(kind)) {
      const near = this.heroes().filter(
        (p) =>
          p.hp > 0 && Math.hypot(p.x - target.x, p.y - target.y) < radius * 1.5,
      );
      if (near.length >= 2)
        return {
          x: near.reduce((s, p) => s + p.x, 0) / near.length,
          y: near.reduce((s, p) => s + p.y, 0) / near.length,
        };
    }
    return this.lead(target, this.telegraph(kind, delay));
  }
  /** Practice: count everyone a resolved attack missed. */
  protected countDodges() {
    const stats = this.raid.drillStats;
    if (!this.raid.drill || !stats) return;
    for (const p of this.heroes())
      if (p.hp > 0 && !this.struck.has(p.id)) stats.dodges++;
  }
  protected startAttack(kind: RaidAttack, target: Fighter) {
    const r = this.raid,
      boss = this.boss()!;
    const count = this.seenAttacks.get(kind) ?? 0;
    this.seenAttacks.set(kind, count + 1);
    const teach = count < 2;
    boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
    if (kind === "charge") {
      const d = normalize(target.x - boss.x, target.y - boss.y);
      Object.assign(
        this.warn(
          "charge",
          boss.x,
          boss.y,
          Math.max(90, Math.min(1510, boss.x + d.x * 1000)),
          Math.max(90, Math.min(810, boss.y + d.y * 1000)),
          BOSS.charge.width,
          BOSS.charge.delay,
        ),
        {
          targetId: target.id,
          // Baiting gets harder: from the third pillar this chapter it
          // watches its target a little longer before it locks.
          lockAt:
            this.time +
            BOSS.charge.lock +
            (this.smart() && this.pillarBreaks >= 2 ? BOSS.charge.lateLock : 0),
          teach,
        },
      );
    } else if (kind === "slam") {
      Object.assign(
        this.warn(
          "slam",
          boss.x,
          boss.y,
          boss.x,
          boss.y,
          (r.phase >= 3 ? BOSS.slam.finalRadius : BOSS.slam.radius) +
            (r.trait === "ancient" ? 30 : 0),
          BOSS.slam.delay,
        ),
        { teach },
      );
    } else if (kind === "debris") this.warnDebris(teach);
    else if (kind === "volley") this.warnVolley(target, teach);
    else if (kind === "eruption")
      this.warnEruption(target, eruptionChain(r.phase, r.peril), teach);
    else this.warnShare(target, teach);
  }
  protected attacksStep(dt: number) {
    const r = this.raid,
      boss = this.boss()!;
    boss.lastInput = blankInput();
    if (r.stagger >= 100 && r.staggerUntil <= this.time) {
      r.stagger = 0;
      r.staggerUntil = this.time + RAID.staggerSeconds;
      r.exposedUntil = r.staggerUntil;
      r.message = "STAGGER! Core exposed — unleash your ultimates!";
      r.warnings = [];
      this.charging = undefined;
      this.echoes = [];
      this.nextAttack = r.staggerUntil + (this.smart() ? 0.4 : 1);
    }
    // Threat fades: what you did in the last few seconds is what counts.
    const fade = Math.exp(-dt / 6);
    for (const [id, value] of this.threat) this.threat.set(id, value * fade);
    this.trackMotion();
    this.trackMelee(boss);
    this.stepEnrage();
    this.worldStep(dt, boss);
    if (r.staggerUntil > this.time) return;
    this.followWarnings(boss);
    this.lockWarnings(boss);
    this.playEchoes();
    if (r.drill) {
      if (
        this.time >= this.nextAttack &&
        this.canStartAttack() &&
        !r.warnings.length
      ) {
        const alive = this.heroes().filter((p) => p.hp > 0);
        if (!alive.length) return;
        this.attacks++;
        this.startAttack(r.drill, this.chooseTarget(r.drill, alive));
        this.nextAttack = this.time + 3.2;
        this.drillReset();
      }
    } else if (this.time >= this.nextAttack && this.canStartAttack())
      this.tryAttack();
    const due = r.warnings.filter((w) => w.at <= this.time);
    r.warnings = r.warnings.filter((w) => w.at > this.time);
    for (const w of due) {
      this.struck.clear();
      this.currentCast = this.castOf.get(w) ?? 0;
      this.resolving = true;
      this.resolveWarning(w, boss);
      this.resolving = false;
    }
    this.currentCast = 0;
    this.settleWarnings();
    this.bossStep(dt, boss);
    this.settleWarnings();
  }
  /** True while a warning's landing is being resolved (follow-ups it spawns). */
  protected resolving = false;
  /** Live raids think (Peril 3); Peril 1-2 keep the old fixed rotation. */
  protected smart() {
    return this.raid.peril >= 3 && !this.raid.drill;
  }
  // ------------------------------------------------------ Choosing attacks
  /** Start the next attack if the tier lets one more be live. */
  protected tryAttack() {
    const r = this.raid;
    const alive = this.heroes().filter((p) => p.hp > 0);
    if (!alive.length) return;
    if (!this.smart()) {
      // Legacy: one attack at a time, in the pattern's fixed order.
      if (r.warnings.length) return;
      const pattern = this.pattern();
      const kind = pattern[this.attacks % pattern.length];
      const target = this.chooseTarget(kind, alive);
      this.attacks++;
      this.lastTargetId = target.id;
      this.startAttack(kind, target);
      this.nextAttack = this.time + this.cadence();
      return;
    }
    const live = this.liveThreats();
    if (live >= this.concurrency() || (live > 0 && this.busy())) return;
    const choice = this.decide(alive, live > 0);
    if (!choice) return;
    const { kind, target } = choice;
    this.currentCast = ++this.castSerial;
    const before = new Set(r.warnings);
    this.attacks++;
    this.lastTargetId = target.id;
    this.recentTargets = [...this.recentTargets.slice(-2), target.id];
    this.startAttack(kind, target);
    if (choice.deckIndex >= 0) this.deck.splice(choice.deckIndex, 1);
    else this.lastReaction = this.attacks;
    this.lastKind = kind;
    const signature = this.signature();
    this.sinceSignature = kind === signature ? 0 : this.sinceSignature + 1;
    const fresh = r.warnings.filter((w) => !before.has(w));
    this.settleWarnings();
    if (live > 0) this.spaceOverlap(fresh);
    if (this.pressured(kind, alive))
      this.echoes.push({
        at: this.time + 0.35,
        kind,
        cast: this.currentCast,
        exclude: [target.id],
      });
    this.currentCast = 0;
    this.nextAttack = this.time + this.cadence();
  }
  /**
   * The next attack and its target: a reaction to the fight when one scores
   * high enough (at most every other attack), else the deck's top card. With
   * an attack already live, the first of the top three cards that may overlap.
   */
  protected decide(
    alive: Fighter[],
    overlapping: boolean,
  ): { kind: RaidAttack; target: Fighter; deckIndex: number } | undefined {
    const pattern = this.pattern();
    if (!this.deck.length) this.refillDeck(pattern);
    if (this.attacks - this.lastReaction >= 2) {
      const s = this.situation(alive);
      const best = this.reactions(s)
        .filter(
          (x) =>
            x.score >= 1 &&
            pattern.includes(x.kind) &&
            x.kind !== this.lastKind &&
            this.allows(x.kind) &&
            (!overlapping || this.canOverlap(x.kind)),
        )
        .sort((a, b) => b.score - a.score)[0];
      if (best)
        return {
          kind: best.kind,
          target:
            best.target && alive.includes(best.target)
              ? best.target
              : this.chooseTarget(best.kind, alive),
          deckIndex: -1,
        };
    }
    // The top card, unless the boss can't play it right now (then the next
    // one it can); with an attack live, one of the top three that may overlap.
    const look = overlapping ? Math.min(3, this.deck.length) : this.deck.length;
    for (let i = 0; i < look; i++) {
      const kind = this.deck[i];
      if (!this.allows(kind)) continue;
      if (overlapping && !this.canOverlap(kind)) continue;
      return { kind, target: this.chooseTarget(kind, alive), deckIndex: i };
    }
    return undefined;
  }
  /** Can the boss play this card right now? (Somnara mid-dream: only some.) */
  protected allows(_kind: RaidAttack) {
    return true;
  }
  /** Shuffle the chapter's pattern into a new deck (chapter 1 first teaches it in order). */
  protected refillDeck(pattern: RaidAttack[]) {
    const r = this.raid,
      cycle = this.deckCycle++;
    this.deck = buildRaidDeck(pattern, {
      authored: r.phase === 1 && cycle === 0,
      jitter: (i) => raidJitter(r.seed, 7919 * r.phase + 31 * cycle, i),
      previous: this.lastKind,
      signature: this.signature(),
      sinceSignature: this.sinceSignature,
    });
  }
  /** The boss's signature attack: at least one in every four cards. */
  protected signature(): RaidAttack | undefined {
    return SIGNATURES[this.raid.boss];
  }

  /** What the boss sees: melee, stacks, the isolated and the weak. */
  protected situation(alive: Fighter[]): RaidSituation {
    const boss = this.boss()!;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    const melee = alive
      .filter((p) => dist(p, boss) < 260)
      .map((p) => ({
        p,
        seconds: this.time - (this.meleeSince.get(p.id) ?? this.time),
      }));
    let cluster = { size: 0, x: boss.x, y: boss.y, ids: [] as string[] };
    for (const p of alive) {
      const near = alive.filter((q) => dist(p, q) < 150);
      if (near.length > cluster.size)
        cluster = {
          size: near.length,
          x: near.reduce((s, q) => s + q.x, 0) / near.length,
          y: near.reduce((s, q) => s + q.y, 0) / near.length,
          ids: near.map((q) => q.id),
        };
    }
    const nearest = (p: Fighter) =>
      Math.min(...alive.filter((q) => q !== p).map((q) => dist(p, q)));
    const downed = this.heroes().filter((p) => p.hp <= 0);
    const share = (p: Fighter) => p.hp / CHARACTERS[p.character].health;
    return {
      time: this.time,
      phase: this.raid.phase,
      boss,
      alive,
      melee,
      cluster,
      isolated:
        alive.length > 1
          ? [...alive].sort((a, b) => nearest(b) - nearest(a))[0]
          : undefined,
      weakest: [...alive].sort((a, b) => share(a) - share(b))[0],
      reviving: alive.filter((p) =>
        downed.some((d) => dist(d, p) <= RAID.reviveRange),
      ),
      onMechanic: alive.filter((p) => this.onMechanic(p)),
      airborne: alive.filter((p) => p.jumpUntil > this.time),
      dashSpent: alive.filter((p) => p.dashAt > this.time),
      spread: alive.reduce((s, p) => s + dist(p, boss), 0) / alive.length,
    };
  }
  /** Is this raider using the boss's mechanic (island, pad, light…)? */
  protected onMechanic(_p: Fighter) {
    return false;
  }
  /** Remember when each raider stepped into melee range. */
  protected trackMelee(boss: Fighter) {
    for (const p of this.heroes()) {
      const near = p.hp > 0 && Math.hypot(p.x - boss.x, p.y - boss.y) < 260;
      if (!near) this.meleeSince.delete(p.id);
      else if (!this.meleeSince.has(p.id)) this.meleeSince.set(p.id, this.time);
    }
  }
  // ------------------------------------------------------------- Overlaps
  /** Most damaging attacks live at once (the tier, by chapter). */
  protected concurrency() {
    const c = this.tier().concurrency;
    return c[Math.max(0, Math.min(2, this.raid.phase - 1))];
  }
  /** Attacks that never overlap another (a boss may add its own). */
  protected exclusive(kind: RaidAttack) {
    return RAID_EXCLUSIVE_ATTACKS.has(kind);
  }
  /** Does this warning hurt by itself? */
  protected harmful(w: RaidWarning) {
    return !RAID_HARMLESS_ATTACKS.has(w.kind);
  }
  /**
   * Live hazards on the floor that are not warnings (a charge in motion, a
   * sweeping wave, rings, bubbles…): each kind counts as one live attack.
   */
  protected hazards() {
    const r = this.raid;
    return [
      this.charging,
      r.waves?.length,
      r.undertow,
      r.bubbles?.length,
      r.dreamRings?.length,
      r.quietZone,
      r.flameRings?.length,
      r.emberDive,
      r.stormRushes?.length,
      r.stormBeam,
      r.stormChain,
    ].filter(Boolean).length;
  }
  /** Something that needs the whole floor is playing out. */
  protected busy() {
    const r = this.raid;
    return (
      r.warnings.some((w) => this.exclusive(w.kind)) ||
      !!this.charging ||
      !!r.waves?.length ||
      !!r.undertow ||
      !!r.quietZone ||
      !!r.stormBeam ||
      !!r.stormRushes?.length ||
      !!r.emberDive
    );
  }
  /** Damaging attacks live now: distinct casts with warnings, plus hazards. */
  liveThreats() {
    const casts = new Set<number>();
    for (const w of this.raid.warnings)
      if (this.harmful(w)) casts.add(this.castOf.get(w) ?? -w.id);
    return casts.size + this.hazards();
  }
  /** May this attack start while another is live? A different shape, never a second jump. */
  protected canOverlap(kind: RaidAttack) {
    if (this.exclusive(kind) || raidShapeOf(kind) === "field") return false;
    const live = this.raid.warnings.filter((w) => this.harmful(w));
    const shape = raidShapeOf(kind);
    if (live.some((w) => raidShapeOf(w.kind) === shape)) return false;
    if (
      RAID_JUMP_ATTACKS.has(kind) &&
      live.some((w) => RAID_JUMP_ATTACKS.has(w.kind))
    )
      return false;
    return true;
  }
  /**
   * An attack just started while another was live: its impacts land at least
   * RAID_IMPACT_GAP from the others (the jump cooldown apart for two jumps),
   * and every raider must still have a reachable safe spot. Otherwise the new
   * attack waits until the older ones have landed. Delaying only ever gives
   * raiders more warning.
   */
  protected spaceOverlap(fresh: RaidWarning[]) {
    const r = this.raid;
    const mine = fresh.filter((w) => this.harmful(w));
    if (!mine.length) return;
    const old = r.warnings.filter((w) => !fresh.includes(w) && this.harmful(w));
    if (!old.length) return;
    const shift = (delta: number) => {
      if (delta <= 0) return;
      for (const w of fresh) {
        w.at += delta;
        if (w.lockAt !== undefined) w.lockAt += delta;
        if (w.shiftAt !== undefined) w.shiftAt += delta;
      }
    };
    const jumpGap = RULES.jumpCooldown + 0.3;
    for (let pass = 0; pass < 4; pass++) {
      let need = 0;
      for (const w of mine)
        for (const o of old) {
          const gap =
            RAID_JUMP_ATTACKS.has(w.kind) && RAID_JUMP_ATTACKS.has(o.kind)
              ? jumpGap
              : RAID_IMPACT_GAP;
          if (Math.abs(w.at - o.at) < gap)
            need = Math.max(need, o.at + gap - w.at);
        }
      if (!need) break;
      shift(need);
    }
    if (!this.safeSpotExists([...old, ...mine]))
      shift(
        Math.max(...old.map((o) => o.at)) +
          1 -
          Math.min(...mine.map((w) => w.at)),
      );
  }
  /**
   * For every raider, is there a spot they can reach before the first of
   * these shapes lands (slowest champion, after a 0.45 s reaction) that is
   * outside every one of them? Ring and field attacks are answered by
   * jumping or by the mechanic, so they don't block a spot.
   */
  safeSpotExists(shapes: RaidWarning[] = this.raid.warnings) {
    const spatial = shapes.filter(
      (w) =>
        this.harmful(w) &&
        ["circle", "line", "cone"].includes(raidShapeOf(w.kind)),
    );
    if (!spatial.length) return true;
    const first = Math.min(...spatial.map((w) => w.at));
    const reach =
      RAID_SLOWEST_SPEED * Math.max(0, first - this.time - RAID_REACTION);
    const clear = (x: number, y: number) =>
      x > RULES.radius &&
      x < RULES.width - RULES.radius &&
      y > RULES.radius &&
      y < RULES.height - RULES.radius &&
      !spatial.some((w) => raidShapeHits(w, x, y, RULES.radius + 4));
    return this.heroes()
      .filter((p) => p.hp > 0)
      .every((p) => {
        if (clear(p.x, p.y)) return true;
        for (const f of [0.35, 0.7, 1])
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            if (
              clear(
                p.x + Math.cos(a) * reach * f,
                p.y + Math.sin(a) * reach * f,
              )
            )
              return true;
          }
        return false;
      });
  }
  // ------------------------------------------------------- Party pressure
  /** In a party of 3+, from the tier's chapter, single-target attacks hit two raiders. */
  protected pressured(kind: RaidAttack, alive: Fighter[]) {
    return (
      this.smart() &&
      alive.length >= 3 &&
      this.raid.phase >= this.tier().pressureFrom &&
      RAID_PRESSURE_ATTACKS.has(kind)
    );
  }
  /** The second half of a pressured attack: the same attack at someone else. */
  protected playEchoes() {
    const r = this.raid;
    const due = this.echoes.filter((e) => e.at <= this.time);
    if (!due.length) return;
    this.echoes = this.echoes.filter((e) => e.at > this.time);
    for (const e of due) {
      const others = this.heroes().filter(
        (p) => p.hp > 0 && !e.exclude.includes(p.id),
      );
      if (!others.length) continue;
      const target = this.chooseTarget(e.kind, others);
      this.currentCast = e.cast;
      const before = new Set(r.warnings);
      this.startAttack(e.kind, target);
      const fresh = r.warnings.filter((w) => !before.has(w));
      this.settleWarnings();
      this.spaceOverlap(fresh);
      this.currentCast = 0;
    }
  }
  // ------------------------------------------------------- Honesty rules
  /**
   * Every new warning keeps the honesty rules (docs/boss-raid.md): at least
   * RAID_TELEGRAPH_FLOOR on screen (follow-ups of a visible attack aside),
   * and a shape that follows a raider freezes at least RAID_FREEZE (and long
   * enough to walk out of a circle) before it lands.
   */
  protected settleWarnings() {
    if (!this.smart()) return;
    for (const w of this.raid.warnings) {
      if (this.settled.has(w)) continue;
      this.settled.add(w);
      const start = w.startedAt ?? this.time;
      if (
        this.harmful(w) &&
        !w.followUp &&
        !this.resolving &&
        w.at - start < RAID_TELEGRAPH_FLOOR
      )
        w.at = start + RAID_TELEGRAPH_FLOOR;
      const freeze =
        raidShapeOf(w.kind) === "circle"
          ? Math.max(
              RAID_FREEZE,
              (w.radius + RULES.radius) / RAID_SLOWEST_SPEED + 0.05,
            )
          : RAID_FREEZE;
      if (w.lockAt !== undefined && w.lockAt < w.at)
        w.lockAt = Math.max(start, Math.min(w.lockAt, w.at - freeze));
      if (w.shiftAt !== undefined)
        w.shiftAt = Math.max(start, Math.min(w.shiftAt, w.at - RAID_FREEZE));
      // Two jump answers on the same ground land the jump cooldown apart.
      if (RAID_JUMP_ATTACKS.has(w.kind) && w.kind !== "lullaby") {
        const gap = RULES.jumpCooldown + 0.3;
        for (const o of this.raid.warnings)
          if (
            o !== w &&
            this.settled.has(o) &&
            RAID_JUMP_ATTACKS.has(o.kind) &&
            o.kind !== "lullaby" &&
            Math.abs(o.at - w.at) < gap &&
            Math.hypot(o.x - w.x, o.y - w.y) < o.radius + w.radius
          ) {
            const delta = o.at + gap - w.at;
            w.at += delta;
            if (w.lockAt !== undefined) w.lockAt += delta;
          }
      }
    }
  }
  /**
   * Attacks whose shape may be re-aimed ahead of a running raider as it
   * locks (only when that stays fair: see `lockWarnings`).
   */
  protected leadsOnLock(kind: RaidAttack) {
    return kind === "charge" || kind === "lunge" || kind === "dive";
  }
  protected locked = new WeakSet<RaidWarning>();
  /**
   * A following shape locks: it is re-aimed once, at where its raider will
   * be if they keep running straight, and drawn there for the rest of its
   * telegraph (the server never hits anywhere else). It only leads when a
   * raider who sees the lock late (0.45 s) can still walk out at the slowest
   * speed from the middle of the shape before it lands; otherwise it stays
   * on the raider, as before.
   */
  protected lockWarnings(boss: Fighter) {
    if (!this.smart()) return;
    for (const w of this.raid.warnings) {
      if (w.lockAt === undefined || this.time < w.lockAt || this.locked.has(w))
        continue;
      this.locked.add(w);
      if (!this.leadsOnLock(w.kind)) continue;
      // ★ bosses teach their locks plainly in chapter 1.
      if (RAID_BOSSES[this.raid.boss].stars === 1 && this.raid.phase === 1)
        continue;
      const target = this.heroes().find((p) => p.id === w.targetId && p.hp > 0);
      if (!target || (target.clone && target.clone.until > this.time)) continue;
      // A charge also travels: the boss reaches a raider a little later.
      const travel =
        w.kind === "charge"
          ? Math.hypot(target.x - boss.x, target.y - boss.y) / BOSS.charge.speed
          : 0;
      const left = w.at - this.time + travel;
      const half =
        raidShapeOf(w.kind) === "line"
          ? w.kind === "charge"
            ? 100 - RULES.radius
            : (w.width ?? 0) / 2 || w.radius
          : w.radius;
      if (half + RULES.radius > RAID_SLOWEST_SPEED * (left - RAID_REACTION))
        continue;
      const at = this.lead(target, left);
      if (at.x === target.x && at.y === target.y) continue;
      if (raidShapeOf(w.kind) === "line") {
        const d = normalize(at.x - w.x || 1, at.y - w.y);
        const len =
          w.kind === "charge" ? 1000 : Math.hypot(w.tx - w.x, w.ty - w.y);
        w.tx = w.x + d.x * len;
        w.ty = w.y + d.y * len;
        if (w.kind === "charge") {
          w.tx = Math.max(90, Math.min(1510, w.tx));
          w.ty = Math.max(90, Math.min(810, w.ty));
          boss.angle = Math.atan2(w.ty - w.y, w.tx - w.x);
        }
      } else {
        w.x = w.tx = at.x;
        w.y = w.ty = at.y;
      }
    }
  }
  // ---------------------------------------------------------- Soft enrage
  /** Past the tier's time, the boss grows furious in steps (announced). */
  protected stepEnrage() {
    const r = this.raid;
    if (!this.smart()) return;
    const steps = raidEnrageSteps(r.boss, r.elapsed);
    if (steps <= (r.enrage ?? 0)) return;
    r.enrage = steps;
    r.enrageAt = this.time;
    r.message =
      steps === 1
        ? `${r.name} grows furious! Its attacks come faster and hit harder.`
        : `${r.name}'s fury builds (${steps}/${RAID_ENRAGE.steps})!`;
  }
  /** A fresh run or chapter: forget the deck and what the boss remembered. */
  protected resetBrain() {
    this.deck = [];
    this.deckCycle = 0;
    this.lastKind = undefined;
    this.sinceSignature = 0;
    this.lastReaction = -99;
    this.recentTargets = [];
    this.echoes = [];
    this.motion.clear();
    this.meleeSince.clear();
  }
  /** Arena upkeep that carries on even while the boss is staggered. */
  protected worldStep(_dt: number, _boss: Fighter) {}
  /** How cleverly the boss picks targets and aims: 0 in practice, more on higher Peril. */
  protected cunning() {
    const r = this.raid;
    return r.drill ? 0 : r.peril >= 3 ? 1 : r.peril === 2 ? 0.8 : 0.5;
  }
  /**
   * Who the next attack goes after. Practice keeps a plain rotation. In a
   * raid the boss reads the fight: it turns on whoever is hurting it most
   * right now, punishes a raider kneeling to revive someone, throws far
   * attacks (charges, volleys) at raiders keeping their distance, drops a
   * shared meteor on whoever strayed from the group, starts chain lightning
   * in a crowd, and rarely picks the
   * same raider twice in a row. A seeded jitter keeps it from being exact.
   */
  protected chooseTarget(kind: RaidAttack, alive: Fighter[]) {
    const r = this.raid,
      c = this.cunning(),
      rotation = alive[(this.attacks + r.seed) % alive.length];
    if (alive.length < 2 || c <= 0) return rotation;
    const boss = this.boss()!;
    const total = alive.reduce(
      (sum, p) => sum + (this.threat.get(p.id) ?? 0),
      0,
    );
    const downed = this.heroes().filter((p) => p.hp <= 0);
    const live = r.peril >= 3;
    // Never the same raider three times running.
    const [a, b] = this.recentTargets.slice(-2);
    const banned = live && a !== undefined && a === b ? a : undefined;
    let best = rotation,
      bestScore = -Infinity;
    alive.forEach((p, i) => {
      if (p.id === banned) return;
      const distance = Math.hypot(p.x - boss.x, p.y - boss.y);
      const nearestAlly = Math.min(
        ...alive
          .filter((q) => q !== p)
          .map((q) => Math.hypot(q.x - p.x, q.y - p.y)),
      );
      let score = raidJitter(r.seed, this.attacks, i) * (live ? 0.35 : 0.6);
      if (live) {
        const max = CHARACTERS[p.character].health;
        // The weak, the fragile, and a raider who just spent their dash.
        score += 0.7 * (1 - Math.max(0, p.hp) / max) * c;
        if (max < 145) score += 0.3 * c;
        if (RAID_LINE_ATTACKS.has(kind) && p.dashAt > this.time)
          score += 0.6 * c;
      }
      if (total > 1) score += ((this.threat.get(p.id) ?? 0) / total) * 1.5 * c;
      if (
        downed.some((d) => Math.hypot(d.x - p.x, d.y - p.y) <= RAID.reviveRange)
      )
        score += 1.2 * c;
      if (FAR_ATTACKS.has(kind)) score += Math.min(1, distance / 900) * c;
      if (kind === "share") score += Math.min(1, nearestAlly / 600) * c;
      if (CROWD_ATTACKS.has(kind))
        score +=
          (alive.filter(
            (q) => q !== p && Math.hypot(q.x - p.x, q.y - p.y) < 220,
          ).length /
            (alive.length - 1)) *
          c;
      if (p.id === this.lastTargetId) score -= 0.8;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    });
    return best;
  }
  /** This chapter's attack order. */
  protected pattern() {
    const r = this.raid;
    return raidPattern(r.phase, r.peril, r.partySize, r.boss);
  }
  /** No new attack while one is still playing out (Grumblecrag: a charge). */
  protected canStartAttack() {
    return !this.charging;
  }
  /** Practice: restore what the attack uses up. */
  protected drillReset() {
    // Broken pillars come back so charges can be baited again.
    if (this.raid.pillars.every((p) => p.broken))
      this.raid.pillars.forEach((p) => (p.broken = false));
  }
  /** Follow a target until the warning locks, then keep a readable dodge window. */
  protected followWarnings(boss: Fighter) {
    const r = this.raid;
    for (const w of r.warnings) {
      const target = this.heroes().find((p) => p.id === w.targetId && p.hp > 0);
      if (!target) continue;
      if (w.kind === "charge") {
        if (w.lockAt === undefined || this.time >= w.lockAt) continue;
        const direction = normalize(target.x - boss.x, target.y - boss.y);
        w.tx = Math.max(90, Math.min(1510, boss.x + direction.x * 1000));
        w.ty = Math.max(90, Math.min(810, boss.y + direction.y * 1000));
        boss.angle = Math.atan2(w.ty - w.y, w.tx - w.x);
      } else if (w.kind === "share") {
        if (w.lockAt !== undefined && this.time >= w.lockAt) continue;
        w.x = w.tx = target.x;
        w.y = w.ty = target.y;
        w.sharers = this.heroes().filter(
          (p) =>
            p.hp > 0 &&
            Math.hypot(p.x - w.x, p.y - w.y) < w.radius + RULES.radius,
        ).length;
      }
    }
  }
  /** A warning's time is up: the attack lands. */
  protected resolveWarning(w: RaidWarning, boss: Fighter) {
    const r = this.raid;
    {
      if (w.kind === "charge") {
        this.charging = {
          tx: w.tx,
          ty: w.ty,
          until: this.time + 1.3,
          hit: new Set(),
          targetId: w.targetId,
          back: w.followUp,
        };
        return;
      }
      this.hitBy = w.kind;
      const ability = {
        ...CHARACTERS.terradon.skills[3],
        ground: w.kind === "slam",
        knockback: 0,
      };
      if (w.kind === "volley") {
        for (const p of this.heroes())
          if (p.hp > 0 && this.inVolley(w, p)) {
            if (
              p.character === "auralynx" &&
              this.has(p, "counter") &&
              !r.drill
            ) {
              // Auralynx's Facet Guard sends the stones back.
              r.stagger = Math.min(100, r.stagger + 12);
              r.message = `${p.name}'s guard reflects the volley!`;
              this.event("hit", boss, 0xc9f4ff, 0, p.id);
              continue;
            }
            if (this.curled(p) && !r.drill) {
              // Pangrove curled into a ball: the stones glance off its plates.
              r.message = `The volley glances off ${p.name}'s scales!`;
              this.event("hit", p, 0x7fcf6a, 0, boss.id);
              continue;
            }
            this.damage(p, BOSS.volley.damage, boss.id, ability);
          }
        // The final phase chains a volley straight into eruptions.
        if (r.phase === 3 && r.peril >= 2 && !r.drill) {
          const target = this.heroes().find(
            (p) => p.id === w.targetId && p.hp > 0,
          );
          if (target) this.warnEruption(target, 2, false);
        }
      } else if (w.kind === "share") {
        const inside = this.heroes().filter(
          (p) =>
            p.hp > 0 &&
            Math.hypot(p.x - w.x, p.y - w.y) < w.radius + RULES.radius,
        );
        const alive = this.heroes().filter((p) => p.hp > 0).length;
        const warded = inside.some((p) => this.has(p, "shield"));
        const each =
          alive < 2 || w.lockAt !== undefined
            ? BOSS.share.soloDamage
            : (BOSS.share.damage / Math.max(1, inside.length)) *
              (warded ? 1 - BOSS.share.wardReduction : 1);
        for (const p of inside) this.damage(p, each, boss.id, ability);
        if (inside.length > 1 && !r.drill)
          r.message = `Meteor shared by ${inside.length} raiders!`;
        // Chapter 3: stack, then scatter. Eruptions chase the stack's middle.
        const target = this.heroes().find((p) => p.id === w.targetId);
        if (this.smart() && r.phase === 3 && inside.length > 1 && target) {
          const cx = inside.reduce((s, p) => s + p.x, 0) / inside.length,
            cy = inside.reduce((s, p) => s + p.y, 0) / inside.length;
          Object.assign(
            this.warn(
              "eruption",
              cx,
              cy,
              cx,
              cy,
              BOSS.eruption.radius,
              RAID_TELEGRAPH_FLOOR,
            ),
            { targetId: target.id, chain: 2, followUp: true },
          );
          r.message = "Meteor shared — now scatter!";
        }
      } else {
        const damage =
          w.kind === "slam"
            ? BOSS.slam.damage
            : w.kind === "eruption"
              ? BOSS.eruption.damage
              : BOSS.debris.damage;
        for (const p of this.heroes())
          if (
            p.hp > 0 &&
            Math.hypot(p.x - w.x, p.y - w.y) < w.radius + RULES.radius
          )
            this.damage(p, damage, boss.id, ability);
      }
      this.hitBy = undefined;
      this.countDodges();
      this.event("raid-impact", w, 0xffbd6a, undefined, boss.id);
      this.events[this.events.length - 1].raidRadius = w.radius;
      if (w.kind === "eruption" && (w.chain ?? 1) > 1) {
        const target = this.heroes().find(
          (p) => p.id === w.targetId && p.hp > 0,
        );
        if (target)
          Object.assign(
            this.warn(
              "eruption",
              target.x,
              target.y,
              target.x,
              target.y,
              w.radius,
              BOSS.eruption.gap,
            ),
            { targetId: target.id, chain: (w.chain ?? 1) - 1, teach: w.teach },
          );
      }
      if (w.kind === "slam" && r.phase >= 2 && !w.followUp && !r.drill) {
        // Longer than the shared jump cooldown: both hits can be avoided fairly.
        Object.assign(
          this.warn(
            "slam",
            boss.x,
            boss.y,
            boss.x,
            boss.y,
            w.radius,
            RULES.jumpCooldown + 0.3,
          ),
          { followUp: true, teach: w.teach },
        );
        this.nextAttack = this.time + RULES.jumpCooldown + 2.8;
      } else if (w.kind === "slam" && w.followUp && r.phase === 3) {
        this.warnDebris(false);
        this.nextAttack = this.time + 4.5;
      }
    }
  }
  /** Grumblecrag's charge in motion, and the Peril 3 closing ring. */
  protected bossStep(dt: number, boss: Fighter) {
    const r = this.raid;
    if (this.charging) {
      const c = this.charging,
        dx = c.tx - boss.x,
        dy = c.ty - boss.y,
        len = Math.hypot(dx, dy) || 1,
        step = Math.min(
          len,
          (r.trait === "ancient" ? 480 : BOSS.charge.speed) * dt,
        );
      boss.x += (dx / len) * step;
      boss.y += (dy / len) * step;
      const pillar = r.pillars.find(
        (p) => !p.broken && Math.hypot(p.x - boss.x, p.y - boss.y) < 115,
      );
      if (pillar) {
        pillar.broken = true;
        if (c.targetId && r.contributions?.[c.targetId] && !r.drill)
          r.contributions[c.targetId].pillars++;
        if (!r.drill) this.chargeBaits++;
        if (!r.drill) this.pillarBreaks++;
        const live = this.smart();
        this.nextAttack = Math.max(
          this.nextAttack,
          this.time + (live ? BOSS.pillar.pause : 3),
        );
        if (!r.drill) {
          r.stagger = Math.min(100, r.stagger + 42);
          r.exposedUntil =
            this.time +
            (live
              ? this.window(
                  r.trait === "fractured"
                    ? BOSS.pillar.fractured
                    : BOSS.pillar.expose,
                )
              : r.trait === "fractured"
                ? 10
                : 8);
          r.message = "ARMOR BROKEN! Hit the glowing core.";
        }
        this.event("raid-impact", pillar, 0xffd65b, undefined, boss.id);
        this.events[this.events.length - 1].raidRadius = 100;
        this.struck = new Set(c.hit);
        this.countDodges();
        this.charging = undefined;
      } else {
        this.hitBy = "charge";
        for (const p of this.heroes())
          if (
            p.hp > 0 &&
            !c.hit.has(p.id) &&
            Math.hypot(p.x - boss.x, p.y - boss.y) < 100
          ) {
            c.hit.add(p.id);
            if (p.character === "terradon" && !r.drill) {
              // Terradon's shell stops the charge head-on.
              this.damage(p, BOSS.charge.damage / 2, boss.id);
              r.stagger = Math.min(100, r.stagger + 20);
              r.message = `${p.name} stops the charge!`;
              this.charging = undefined;
              break;
            }
            this.damage(p, BOSS.charge.damage, boss.id);
          }
        this.hitBy = undefined;
        if (this.charging && (len < 10 || this.time >= this.charging.until)) {
          // The charge ran its course without meeting a pillar.
          if (!r.drill) this.chargeMisses++;
          this.struck = new Set(c.hit);
          this.countDodges();
          this.charging = undefined;
          // Chapter 2+ it turns and comes back (alone: only in chapter 3).
          if (this.smart() && r.phase >= (r.partySize > 1 ? 2 : 3) && !c.back)
            this.chargeBack(c);
        }
      }
    }
    if (r.peril >= 3 && r.phase === 3 && !r.drill) {
      const ring = BOSS.ring;
      const radius = Math.max(
        ring.end,
        ring.start - this.phaseElapsed * ring.shrink,
      );
      r.closingRadius = radius;
      for (const p of this.heroes())
        if (p.hp > 0 && Math.hypot(p.x - 800, p.y - 450) > radius)
          this.damage(p, ring.dps * dt, boss.id);
    }
  }
  /**
   * Chapter 2+: a charge that missed every pillar turns round and comes
   * back at its target (a 0.9 s warning drawn as the first run ends). A
   * pillar still stops it.
   */
  protected chargeBack(c: NonNullable<RaidArena["charging"]>) {
    const boss = this.boss();
    const target = this.heroes().find((p) => p.id === c.targetId && p.hp > 0);
    if (!boss || !target) return;
    const d = normalize(target.x - boss.x || 1, target.y - boss.y);
    Object.assign(
      this.warn(
        "charge",
        boss.x,
        boss.y,
        Math.max(90, Math.min(1510, boss.x + d.x * 1000)),
        Math.max(90, Math.min(810, boss.y + d.y * 1000)),
        BOSS.charge.width,
        BOSS.charge.returnDelay,
      ),
      {
        targetId: target.id,
        lockAt: this.time + BOSS.charge.returnDelay - RAID_FREEZE,
        followUp: true,
      },
    );
    this.raid.message = "It turns — the charge comes back!";
  }
  /** How much a hit on the boss counts: exposed ×1.6, cracked ×1.2, armored ×0.72. */
  protected coreMultiplier(target: Fighter) {
    const r = this.raid;
    const open = r.exposedUntil > this.time || r.staggerUntil > this.time;
    if (open || (this.alwaysExposed() && !this.smart()))
      return r.trait === "restless" ? 1.8 : 1.6;
    if (this.alwaysExposed()) return BOSS.crackedCore;
    return this.bossExposed(target) ? 1.6 : 0.72;
  }
  /** Recipient-only Somnara information; ordinary raids have none. */
  dreamFor(_id: string): RaidDreamView | undefined {
    return undefined;
  }
  callRune(_id: string, _rune: DreamRune): boolean {
    return false;
  }
  /** A quick team signal over a raider's head. */
  ping(id: string, kind: RaidPingKind) {
    const p = this.heroes().find((q) => q.id === id);
    if (!p || !["playing", "countdown", "intermission"].includes(this.phase))
      return false;
    if (this.time < (this.pingAt.get(id) ?? -Infinity)) return false;
    this.pingAt.set(id, this.time + 1.2);
    const r = this.raid;
    r.pings = (r.pings ?? []).filter(
      (q) => q.playerId !== id && q.until > this.time,
    );
    r.pings.push({
      id: ++this.serial,
      playerId: id,
      kind,
      until: this.time + RAID_PING_SECONDS,
    });
    return true;
  }
  /** Practice room: the boss repeats one attack; hits only count. */
  startDrill(kind: RaidAttack) {
    if (!["lobby", "finished"].includes(this.phase) || !this.heroes().length)
      return false;
    this.raid.drill = kind;
    this.start();
    this.raid.message = `Practice · ${RAID_ATTACKS[kind].name}`;
    this.instructionsReady = this.players.map((p) => p.id);
    this.phase = "playing";
    this.deadline = this.time + RAID.timeLimit;
    return true;
  }
  setDrill(kind: RaidAttack) {
    const r = this.raid;
    if (!r.drill || this.phase === "finished") return false;
    r.drill = kind;
    r.warnings = [];
    r.drillStats = { hits: 0, dodges: 0 };
    r.message = `Practice · ${RAID_ATTACKS[kind].name}`;
    this.clearAttacks();
    this.attacks = 0;
    this.nextAttack = this.time + 1.5;
    return true;
  }
  /** Leave practice for the raid lobby. */
  stopDrill() {
    const r = this.raid;
    if (!r.drill) return false;
    r.drill = null;
    r.drillStats = undefined;
    r.warnings = [];
    this.clearAttacks();
    this.players = this.players.filter((p) => !p.raidBoss);
    this.phase = "lobby";
    for (const p of this.players) p.ready = false;
    return true;
  }
  /** An AI plays a disconnected raider's champion until they return. */
  standIn(id: string) {
    const p = this.heroes().find((q) => q.id === id);
    if (!p || this.bots.has(id)) return false;
    this.clearBufferedSkills(id);
    this.bots.set(id, new BotBrain(id, "normal", (this.raid.seed % 9973) + 1));
    this.raid.standIns = [...(this.raid.standIns ?? []), id];
    return true;
  }
  release(id: string) {
    if (!this.raid.standIns?.includes(id)) return false;
    this.bots.delete(id);
    this.raid.standIns = this.raid.standIns.filter((q) => q !== id);
    const p = this.players.find((q) => q.id === id);
    if (p) p.lastInput = blankInput();
    return true;
  }
  /** Stand-ins dodge telegraphs, share meteors and revive allies. */
  override botInput(bot: Fighter, input: Input) {
    if (bot.hp <= 0 || bot.raidBoss) return input;
    const r = this.raid;
    const go = (x: number, y: number, away: boolean) => {
      const d = normalize(x - bot.x, y - bot.y);
      input.dx = away ? -d.x : d.x;
      input.dy = away ? -d.y : d.y;
      return input;
    };
    const hint = this.botHint(bot, input, go);
    if (hint) return hint;
    const alive = this.heroes().filter((p) => p.hp > 0).length;
    // Inside one or more drawn shapes (circles, lanes, cones): head for the
    // nearest spot outside all of them, so overlapping attacks are dodged
    // together instead of one at a time.
    const shapes = r.warnings.filter(
      (w) =>
        w.kind !== "share" &&
        this.harmful(w) &&
        ["circle", "line", "cone"].includes(raidShapeOf(w.kind)),
    );
    const pad = RULES.radius + 12;
    const inside = (x: number, y: number) =>
      shapes.some((w) => raidShapeHits(w, x, y, pad));
    if (shapes.length && inside(bot.x, bot.y)) {
      for (let reach = 40; reach <= 520; reach += 40)
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const x = bot.x + Math.cos(a) * reach,
            y = bot.y + Math.sin(a) * reach;
          if (
            x > 60 &&
            x < RULES.width - 60 &&
            y > 60 &&
            y < RULES.height - 60 &&
            !inside(x, y)
          )
            return go(x, y, false);
        }
    }
    for (const w of r.warnings) {
      if (w.kind === "share") {
        if (w.targetId !== bot.id && alive > 1 && w.lockAt === undefined)
          return go(w.x, w.y, false);
        if (w.lockAt !== undefined && w.targetId === bot.id)
          return go(w.x, w.y, true);
        continue;
      }
      if (w.kind === "volley") {
        if (this.inVolley(w, bot)) {
          const aim = Math.atan2(w.ty - w.y, w.tx - w.x);
          // Step sideways out of the cone.
          return go(
            bot.x - Math.sin(aim) * 100,
            bot.y + Math.cos(aim) * 100,
            false,
          );
        }
        continue;
      }
      if (w.kind === "charge") {
        const lx = w.tx - w.x,
          ly = w.ty - w.y,
          len = Math.hypot(lx, ly) || 1;
        const t = Math.max(
          0,
          Math.min(1, ((bot.x - w.x) * lx + (bot.y - w.y) * ly) / (len * len)),
        );
        const px = w.x + lx * t,
          py = w.y + ly * t;
        if (Math.hypot(bot.x - px, bot.y - py) < w.radius + RULES.radius + 20)
          return go(px, py, true);
        continue;
      }
      if (Math.hypot(bot.x - w.x, bot.y - w.y) < w.radius + RULES.radius + 15)
        return go(w.x, w.y, true);
    }
    // Stay inside the closing ring (live raids).
    if (
      this.smart() &&
      r.closingRadius !== undefined &&
      Math.hypot(bot.x - 800, bot.y - 450) > r.closingRadius - 30
    )
      return go(800, 450, false);
    const down = this.heroes().find(
      (p) => p.hp <= 0 && r.downed[p.id] && !r.downed[p.id].self,
    );
    if (
      down &&
      Math.hypot(down.x - bot.x, down.y - bot.y) > RAID.reviveRange * 0.6
    )
      return go(down.x, down.y, false);
    return input;
  }
  protected finish(won: boolean) {
    if (this.raid.result) return;
    this.raid.result = won ? "victory" : "defeat";
    this.raid.resultId = randomUUID();
    this.phase = "finished";
    this.winnerTeam = won ? 0 : 1;
    this.winner = won ? (this.heroes()[0]?.id ?? null) : this.raid.bossId;
    this.raid.message = this.finishMessage(won);
    this.raid.warnings = [];
    this.clearAttacks();
  }
  override endRound(team: number | null) {
    this.finish(team === 0);
  }
  override forfeit(_id: string) {
    this.finish(false);
  }
  override tick(dt = 1 / RULES.tick) {
    if (this.phase !== "playing") this.clearBufferedSkills();
    if (["lobby", "briefing", "paused", "finished"].includes(this.phase))
      return;
    if (this.phase === "intermission") {
      this.time += dt;
      if (this.time >= this.deadline) {
        // Time's up: the first options left fill the remaining picks.
        for (const id of Object.keys(this.raid.offers))
          while (this.raid.offers[id]?.[0])
            this.pickRite(id, this.raid.offers[id][0]);
        this.phase = "countdown";
        this.deadline = this.time + 3;
      }
      return;
    }
    if (this.phase === "playing") {
      if (!this.started) {
        this.started = true;
        this.nextAttack = this.time + (this.smart() ? 1.2 : 2);
      }
      this.raid.elapsed += dt;
      this.phaseElapsed += dt;
      this.deadline = this.time + RAID.timeLimit - this.raid.elapsed;
      const dashers = this.heroes().filter(
        (p) =>
          p.lastInput.dash &&
          this.time >= p.dashAt &&
          this.hasRite(p, "shelter"),
      );
      for (const p of dashers)
        this.raid.wards.push({ x: p.x, y: p.y, until: this.time + 3 });
      this.raid.wards = this.raid.wards.filter((w) => w.until > this.time);
      this.raid.pings = (this.raid.pings ?? []).filter(
        (q) => q.until > this.time,
      );
      this.attacksStep(dt);
    }
    super.tick(dt);
    if (this.phase !== "playing") return;
    this.resolveDowns(dt);
    if (this.raid.result) return;
    const boss = this.boss();
    if (!boss) return;
    if (this.bossHealth() <= 0) return this.finish(true);
    if (this.raid.elapsed >= RAID.timeLimit && !this.raid.drill)
      return this.finish(false);
    const next =
      this.bossHealth() <= this.raid.maxHp * 0.33 + 1e-6
        ? 3
        : this.bossHealth() <= this.raid.maxHp * 0.67 + 1e-6
          ? 2
          : 1;
    if (next > this.raid.phase) {
      this.phaseElapsed = 0;
      this.raid.phase = next;
      this.round = next;
      this.raid.message = raidChapters(this.raid.boss)[next - 1].objective;
      this.attacks = 0;
      this.deck = [];
      this.deckCycle = 0;
      this.echoes = [];
      this.started = false;
      this.raid.staggerUntil = 0;
      this.raid.exposedUntil = 0;
      this.onChapter();
      // No rite choice mid-fight: the rites chosen at the start grow a step
      // (riteValue reads the chapter; the client announces it).
    }
  }
  /** Separate health and stagger hooks let multi-boss raids share the same phase and reward flow. */
  protected bossHealth() {
    return this.boss()?.hp ?? 0;
  }
  protected bossExposed(_target: Fighter) {
    return (
      this.alwaysExposed() ||
      this.raid.exposedUntil > this.time ||
      this.raid.staggerUntil > this.time
    );
  }
  protected addBossStagger(_target: Fighter, amount: number) {
    this.raid.stagger = Math.min(100, this.raid.stagger + amount);
  }
  /** Grumblecrag's last chapter keeps its core open. */
  protected alwaysExposed() {
    return this.raid.phase === 3;
  }
  /** A new chapter: Grumblecrag's pillars stand again. */
  protected onChapter() {
    this.raid.pillars.forEach((p) => (p.broken = false));
    this.pillarBreaks = 0;
  }
  /**
   * Reaction hook: attacks this boss wants to play right now, given what it
   * sees (`situation()`). A score of 1 or more jumps ahead of the deck, at
   * most every other attack, and only attacks in this chapter's pattern; the
   * highest score wins. Bosses override it (the default answers nothing).
   *
   * Grumblecrag's: it slams raiders who camp in melee, throws a volley at a
   * party keeping its distance, and drops eruptions on a stack.
   */
  protected reactions(s: RaidSituation): RaidReaction[] {
    if (this.raid.boss !== "grumblecrag") return [];
    const out: RaidReaction[] = [];
    const camping = s.melee.some((m) => m.seconds >= 2.5);
    if (camping || s.melee.length >= 2)
      out.push({ kind: "slam", score: 1 + 0.2 * s.melee.length });
    const open = (p: Fighter) =>
      this.lineClear(s.boss, p) &&
      Math.hypot(p.x - s.boss.x, p.y - s.boss.y) > 500;
    if (s.alive.length && s.alive.every(open))
      out.push({ kind: "volley", score: 1.1 });
    const meteorDue = this.deck[0] === "share";
    if (s.cluster.size >= 3 && !meteorDue) {
      const target = s.alive.find((p) => s.cluster.ids.includes(p.id));
      out.push({ kind: "eruption", score: 1.2, target });
    }
    return out;
  }
  /** Lines shown when the run ends. */
  protected finishMessage(won: boolean): string {
    return won
      ? "The mountain bows. Your team did it!"
      : "The mountain still stands. Change your build and try again.";
  }
  /** Boss-specific stand-in moves (before the shared dodging below). */
  protected botHint(
    _bot: Fighter,
    _input: Input,
    _go: (x: number, y: number, away: boolean) => Input,
  ): Input | undefined {
    return undefined;
  }
  /** Stop any attack that is playing out (practice switches, results). */
  protected clearAttacks() {
    this.charging = undefined;
  }
  override snapshot(remaining = 0) {
    return { ...super.snapshot(remaining), raid: this.raid };
  }
}
