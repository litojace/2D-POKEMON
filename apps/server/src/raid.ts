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
} from "../../../packages/shared/src/raid.js";
import { BotBrain } from "./bot.js";
const BOSS = GRUMBLECRAG;
/** The numbers every boss shares the shape of (health, Peril damage, rhythm). */
export type RaidBossNumbers = {
  readonly health: { readonly base: number; readonly perExtraPlayer: number; readonly gilded: number };
  readonly perilDamage: readonly number[];
  readonly cadence: { readonly normal: number; readonly restless: number; readonly finalPhase: number };
};

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
  };
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
  chargeMisses = 0;
  /** Raiders hit by the attack that is resolving (practice dodge count). */
  protected struck = new Set<string>();
  constructor(code: string, boss: RaidBossId = "grumblecrag") {
    super(code, "raid");
    this.raid = {
      bossId: "raid-boss",
      boss,
      name: RAID_BOSSES[boss].name,
      peril: 1,
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
  configure(peril: number, _legacyDaily = false) {
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
    this.chargeMisses = 0;
    const def = this.def();
    r.maxHp = Math.round(
      (def.health.base + def.health.perExtraPlayer * (r.partySize - 1)) *
        (r.gilded ? def.health.gilded : 1),
    );
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
      const options = all.filter((id) => !owned.includes(id));
      // Stable by party seat for daily fairness, while teammates see varied offers.
      const offset =
        (this.raid.seed + this.raid.phase * 7 + seat) %
        Math.max(1, options.length);
      this.raid.offers[p.id] = Array.from(
        { length: Math.min(3, options.length) },
        (_, i) => options[(offset + i) % options.length],
      );
    }
  }
  override pickRite(id: string, riteId: string) {
    if (
      this.phase !== "intermission" ||
      !this.raid.offers[id]?.includes(riteId as RaidRite)
    )
      return false;
    this.raid.rites[id] = [...(this.raid.rites[id] ?? []), riteId as RaidRite];
    delete this.raid.offers[id];
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
    if (p.raidBoss && ["stun", "freeze", "paralysis", "sleep"].includes(kind)) {
      this.addBossStagger(p, 3);
      return;
    }
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
      amount *= this.def().perilDamage[r.peril] ?? 1;
      if (!(ability?.ground && target.jumpUntil > this.time))
        this.struck.add(target.id);
    }
    if (target.raidBoss) {
      const exposed = this.bossExposed(target);
      amount *= exposed ? (r.trait === "restless" ? 1.8 : 1.6) : 0.72;
      if (
        source &&
        this.hasRite(source, "courage") &&
        source.hp < CHARACTERS[source.character].health * 0.5
      )
        amount *= 1.2;
      if (
        source &&
        exposed &&
        this.hasRite(source, "core") &&
        this.time >= (this.coreAt.get(source.id) ?? 0)
      ) {
        amount += 8;
        this.coreAt.set(source.id, this.time + 1);
      }
      this.addBossStagger(target, Math.min(1.3, amount * 0.025));
      // Bosses cannot be displaced or stun-locked by normal fighter kits.
      ability = ability ? { ...ability, knockback: 0 } : undefined;
    } else if (
      r.wards.some(
        (w) =>
          w.until > this.time &&
          Math.hypot(w.x - target.x, w.y - target.y) < 130,
      )
    )
      amount *= 0.75;
    if (target.raidBoss) amount = Math.min(amount, this.damageLimit(target));
    const before = target.hp;
    super.damage(target, amount, owner, ability);
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
          // Solo gets one self-revive, except on Peril 3.
          self:
            r.partySize === 1 &&
            !this.selfUsed &&
            r.peril <= RAID.soloSelfReviveMaxPeril,
          ...(this.hitBy ? { cause: this.hitBy } : {}),
        };
        if (this.hitBy)
          this.downCauses[this.hitBy] = (this.downCauses[this.hitBy] ?? 0) + 1;
        const mine = r.contributions?.[target.id];
        if (mine) mine.downs = (mine.downs ?? 0) + 1;
      }
    }
  }
  override cast(p: Fighter, a: Ability, ex = false) {
    super.cast(p, a, ex);
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
            hero.hp + CHARACTERS[hero.character].health * 0.12,
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
              this.chargeUlt(p, 12);
      }
  }
  protected revive(p: Fighter, extra = false) {
    p.hp = CHARACTERS[p.character].health * (extra ? 0.6 : 0.45);
    p.statuses = [];
    p.lastInput = blankInput();
    p.immuneUntil = this.time + 2;
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
            RAID.selfReviveDelay,
        );
        if (down.progress >= 1) {
          this.selfUsed = true;
          this.revive(p);
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
        down.progress = Math.min(
          1,
          down.progress + (dt / RAID.reviveSeconds) * (fast ? 1.35 : 1),
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
    return warning;
  }
  protected warnDebris(teach: boolean) {
    for (const p of this.heroes().filter((p) => p.hp > 0))
      Object.assign(
        this.warn(
          "debris",
          p.x,
          p.y,
          p.x,
          p.y,
          BOSS.debris.radius,
          BOSS.debris.delay,
        ),
        { teach },
      );
    if (this.raid.peril >= 2 || this.raid.trait === "fractured")
      this.warn("debris", 800, 450, 800, 450, 135, 1.9);
  }
  /** A cone of stones from the boss towards a raider. */
  protected warnVolley(target: Fighter, teach: boolean) {
    const boss = this.boss()!;
    const d = normalize(target.x - boss.x, target.y - boss.y);
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
    return Object.assign(
      this.warn(
        "eruption",
        target.x,
        target.y,
        target.x,
        target.y,
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
        ...(alone ? { lockAt: this.time + BOSS.share.delay - BOSS.share.soloLock } : {}),
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
    const off = Math.atan2(Math.sin(Math.atan2(dy, dx) - aim), Math.cos(Math.atan2(dy, dx) - aim));
    if (Math.abs(off) > (w.spread ?? 0.45) + Math.atan2(RULES.radius, Math.max(dist, 1)))
      return false;
    return this.lineClear(w, p);
  }
  protected cadence() {
    const r = this.raid,
      cadence = this.def().cadence;
    const base = r.trait === "restless" ? cadence.restless : cadence.normal;
    return r.phase === 3 && !r.drill ? base * cadence.finalPhase : base;
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
        { targetId: target.id, lockAt: this.time + BOSS.charge.lock, teach },
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
      this.nextAttack = r.staggerUntil + 1;
    }
    this.worldStep(dt, boss);
    if (r.staggerUntil > this.time) return;
    this.followWarnings(boss);
    if (this.time >= this.nextAttack && this.canStartAttack() && !r.warnings.length) {
      const alive = this.heroes().filter((p) => p.hp > 0);
      if (!alive.length) return;
      const target = alive[(this.attacks + r.seed) % alive.length];
      const pattern = r.drill ? [r.drill] : this.pattern();
      const kind = pattern[this.attacks++ % pattern.length];
      this.startAttack(kind, target);
      this.nextAttack = this.time + (r.drill ? 3.2 : this.cadence());
      if (r.drill) this.drillReset();
    }
    const due = r.warnings.filter((w) => w.at <= this.time);
    r.warnings = r.warnings.filter((w) => w.at > this.time);
    for (const w of due) {
      this.struck.clear();
      this.resolveWarning(w, boss);
    }
    this.bossStep(dt, boss);
  }
  /** Arena upkeep that carries on even while the boss is staggered. */
  protected worldStep(_dt: number, _boss: Fighter) {}
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
            if (this.has(p, "counter") && !r.drill) {
              // Auralynx's Mirror Guard sends the stones back.
              r.stagger = Math.min(100, r.stagger + 12);
              r.message = `${p.name}'s guard reflects the volley!`;
              this.event("hit", boss, 0xc9f4ff, 0, p.id);
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
        this.nextAttack = Math.max(this.nextAttack, this.time + 3);
        if (!r.drill) {
          r.stagger = Math.min(100, r.stagger + 42);
          r.exposedUntil = this.time + (r.trait === "fractured" ? 10 : 8);
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
        if (
          this.charging &&
          (len < 10 || this.time >= this.charging.until)
        ) {
          // The charge ran its course without meeting a pillar.
          if (!r.drill) this.chargeMisses++;
          this.struck = new Set(c.hit);
          this.countDodges();
          this.charging = undefined;
        }
      }
    }
    if (r.peril >= 3 && r.phase === 3 && !r.drill) {
      const radius = Math.max(240, 500 - this.phaseElapsed * 2);
      r.closingRadius = radius;
      for (const p of this.heroes())
        if (p.hp > 0 && Math.hypot(p.x - 800, p.y - 450) > radius)
          this.damage(p, 6 * dt, boss.id);
    }
  }
  /** Recipient-only Somnara information; ordinary raids have none. */
  dreamFor(_id: string): RaidDreamView | undefined { return undefined; }
  callRune(_id: string, _rune: DreamRune): boolean { return false; }
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
    const down = this.heroes().find(
      (p) => p.hp <= 0 && r.downed[p.id] && !r.downed[p.id].self,
    );
    if (down && Math.hypot(down.x - bot.x, down.y - bot.y) > RAID.reviveRange * 0.6)
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
    if (["lobby", "briefing", "paused", "finished"].includes(this.phase))
      return;
    if (this.phase === "intermission") {
      this.time += dt;
      if (this.time >= this.deadline) {
        for (const [id, options] of Object.entries(this.raid.offers))
          if (options[0]) this.pickRite(id, options[0]);
        this.phase = "countdown";
        this.deadline = this.time + 3;
      }
      return;
    }
    if (this.phase === "playing") {
      if (!this.started) {
        this.started = true;
        this.nextAttack = this.time + 2;
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
      this.started = false;
      this.raid.staggerUntil = 0;
      this.raid.exposedUntil = 0;
      this.onChapter();
      this.offerRaidRites();
    }
  }
  /** Separate health and stagger hooks let multi-boss raids share the same phase and reward flow. */
  protected bossHealth() {
    return this.boss()?.hp ?? 0;
  }
  protected bossExposed(_target: Fighter) {
    return this.alwaysExposed() || this.raid.exposedUntil > this.time || this.raid.staggerUntil > this.time;
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
