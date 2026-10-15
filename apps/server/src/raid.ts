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
  RAID,
  RAID_RITES,
  RAID_TRAITS,
  raidWeekly,
  type RaidState,
  type RaidRite,
  type RaidTrait,
} from "../../../packages/shared/src/raid.js";

export class RaidArena extends Arena {
  raid: RaidState;
  private nextAttack = 0;
  private phaseElapsed = 0;
  private attacks = 0;
  private started = false;
  private charging?: {
    tx: number;
    ty: number;
    until: number;
    hit: Set<string>;
  };
  private downAt = new Map<string, number>();
  private crawl = new Map<string, { dx: number; dy: number }>();
  private selfUsed = false;
  private coreAt = new Map<string, number>();
  private damageAt = new Map<string, number>();
  constructor(code: string) {
    super(code, "raid");
    const weekly = raidWeekly();
    this.raid = {
      bossId: "raid-boss",
      name: RAID.name,
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
      weekly: false,
      week: weekly.week,
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
  configure(peril: number, weekly: boolean) {
    this.raid.peril = weekly ? raidWeekly().peril : peril;
    this.raid.weekly = weekly;
  }
  override start() {
    this.players = this.players.filter((p) => !p.raidBoss && !p.out);
    super.start();
    const r = this.raid,
      weekly = raidWeekly();
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
    r.week = weekly.week;
    r.seed = r.weekly ? weekly.seed : randomInt(1 << 30);
    r.trait = r.weekly
      ? weekly.trait
      : (Object.keys(RAID_TRAITS) as RaidTrait[])[r.seed % 3];
    r.gilded = !r.weekly && randomInt(20) === 0;
    r.peril = r.weekly ? weekly.peril : r.peril;
    r.maxHp = Math.round(
      (1450 + 900 * (r.partySize - 1)) * (r.gilded ? 1.12 : 1),
    );
    r.warnings = [];
    r.wards = [];
    r.downed = {};
    r.rites = {};
    r.offers = {};
    r.downs = 0;
    r.revives = 0;
    r.pillars = OBSTACLES.map((o) => ({
      x: o.x + o.w / 2,
      y: o.y + o.h / 2,
      broken: false,
    }));
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
    const boss = super.add(r.bossId, RAID.name, "terradon");
    Object.assign(boss, {
      raidBoss: true,
      team: 1,
      hp: r.maxHp,
      x: 1230,
      y: 450,
      ready: true,
    });
    this.instructionsReady = [boss.id];
    r.message = `${r.gilded ? "Gilded " : ""}${RAID_TRAITS[r.trait].name} Grumblecrag · ${RAID_TRAITS[r.trait].text}`;
  }
  override acknowledgeInstructions(id: string) {
    const ok = super.acknowledgeInstructions(id);
    if (ok && this.phase === "countdown") this.offerRaidRites();
    return ok;
  }
  private offerRaidRites() {
    this.phase = "intermission";
    this.deadline = this.time + 15;
    this.projectiles = [];
    this.zones = [];
    this.raid.warnings = [];
    this.charging = undefined;
    const all = Object.keys(RAID_RITES) as RaidRite[];
    for (const p of this.heroes()) {
      const owned = this.raid.rites[p.id] ?? [];
      const options = all.filter((id) => !owned.includes(id));
      // Seeded options are identical for a weekly run, independent of room code.
      const offset =
        (this.raid.seed + this.raid.phase * 7) % Math.max(1, options.length);
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
  private hasRite(p: Fighter, id: RaidRite) {
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
      this.raid.stagger = Math.min(100, this.raid.stagger + 3);
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
    if (target.raidBoss) {
      const exposed = r.exposedUntil > this.time || r.staggerUntil > this.time;
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
      r.stagger = Math.min(100, r.stagger + Math.min(1.3, amount * 0.025));
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
    if (target.raidBoss && r.phase < 3)
      amount = Math.min(
        amount,
        Math.max(0, target.hp - r.maxHp * (r.phase === 1 ? 0.67 : 0.33)),
      );
    const before = target.hp;
    super.damage(target, amount, owner, ability);
    if (!target.raidBoss && target.hp < before) {
      this.damageAt.set(target.id, this.time);
      if (target.hp <= 0) {
        r.downs++;
        this.downAt.set(target.id, this.time);
        r.downed[target.id] = {
          progress: 0,
          self: r.partySize === 1 && !this.selfUsed,
        };
      }
    }
  }
  override cast(p: Fighter, a: Ability, ex = false) {
    super.cast(p, a, ex);
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
  private revive(p: Fighter, extra = false) {
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
  private resolveDowns(dt: number) {
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
        const fast = rescuers.some((q) => this.hasRite(q, "rescue"));
        down.progress = Math.min(
          1,
          down.progress + (dt / RAID.reviveSeconds) * (fast ? 1.35 : 1),
        );
        if (down.progress >= 1) this.revive(p, fast);
      }
    }
    if (
      heroes.length &&
      heroes.every((p) => p.hp <= 0) &&
      !heroes.some((p) => this.raid.downed[p.id]?.self && !this.selfUsed)
    )
      this.finish(false);
  }
  private warn(
    kind: "slam" | "charge" | "debris",
    x: number,
    y: number,
    tx: number,
    ty: number,
    radius: number,
    delay: number,
  ) {
    this.raid.warnings.push({
      id: ++this.serial,
      kind,
      x,
      y,
      tx,
      ty,
      radius,
      at: this.time + delay,
    });
  }
  private attacksStep(dt: number) {
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
    if (r.staggerUntil > this.time) return;
    if (this.time >= this.nextAttack && !this.charging) {
      const alive = this.heroes().filter((p) => p.hp > 0);
      if (!alive.length) return;
      const target = alive[(this.attacks + r.seed) % alive.length];
      boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
      const n = this.attacks++ % 3;
      if (n === 0) {
        const dx = target.x - boss.x,
          dy = target.y - boss.y,
          len = Math.hypot(dx, dy) || 1;
        this.warn(
          "charge",
          boss.x,
          boss.y,
          Math.max(90, Math.min(1510, boss.x + (dx / len) * 1000)),
          Math.max(90, Math.min(810, boss.y + (dy / len) * 1000)),
          80,
          1.7,
        );
        r.message = `${target.name}: bait the charge into a pillar!`;
      }
      if (n === 1) {
        this.warn(
          "slam",
          boss.x,
          boss.y,
          boss.x,
          boss.y,
          (r.phase >= 3 ? 320 : 240) + (r.trait === "ancient" ? 30 : 0),
          1.25,
        );
        r.message = "Ground slam — jump the shockwave!";
      }
      if (n === 2) {
        for (const p of alive)
          this.warn("debris", p.x, p.y, p.x, p.y, 95, 1.65);
        if (r.peril >= 2 || r.trait === "fractured")
          this.warn("debris", 800, 450, 800, 450, 135, 1.9);
        r.message = "Falling debris — leave the glowing circles!";
      }
      this.nextAttack =
        this.time + (r.trait === "restless" ? 3.7 : 4.7) - r.phase * 0.35;
    }
    const due = r.warnings.filter((w) => w.at <= this.time);
    r.warnings = r.warnings.filter((w) => w.at > this.time);
    for (const w of due) {
      if (w.kind === "charge") {
        const dx = w.tx - w.x,
          dy = w.ty - w.y,
          len = Math.hypot(dx, dy) || 1;
        this.charging = {
          tx: Math.max(90, Math.min(1510, w.x + (dx / len) * 1000)),
          ty: Math.max(90, Math.min(810, w.y + (dy / len) * 1000)),
          until: this.time + 1.3,
          hit: new Set(),
        };
      } else {
        const ability = {
          ...CHARACTERS.terradon.skills[3],
          ground: w.kind === "slam",
          knockback: 0,
        };
        for (const p of this.heroes())
          if (
            p.hp > 0 &&
            Math.hypot(p.x - w.x, p.y - w.y) < w.radius + RULES.radius
          )
            this.damage(p, w.kind === "slam" ? 27 : 20, boss.id, ability);
        this.event("raid-impact", w, 0xffbd6a, undefined, boss.id);
        this.events[this.events.length - 1].raidRadius = w.radius;
      }
    }
    if (this.charging) {
      const c = this.charging,
        dx = c.tx - boss.x,
        dy = c.ty - boss.y,
        len = Math.hypot(dx, dy) || 1,
        step = Math.min(len, (r.trait === "ancient" ? 480 : 650) * dt);
      boss.x += (dx / len) * step;
      boss.y += (dy / len) * step;
      const pillar = r.pillars.find(
        (p) => !p.broken && Math.hypot(p.x - boss.x, p.y - boss.y) < 115,
      );
      if (pillar) {
        pillar.broken = true;
        r.stagger = Math.min(100, r.stagger + 42);
        r.exposedUntil = this.time + (r.trait === "fractured" ? 10 : 8);
        r.message = "ARMOR BROKEN! Hit the glowing core.";
        this.event("raid-impact", pillar, 0xffd65b, undefined, boss.id);
        this.events[this.events.length - 1].raidRadius = 100;
        this.charging = undefined;
      } else {
        for (const p of this.heroes())
          if (
            p.hp > 0 &&
            !c.hit.has(p.id) &&
            Math.hypot(p.x - boss.x, p.y - boss.y) < 100
          ) {
            c.hit.add(p.id);
            this.damage(p, 28, boss.id);
          }
        if (len < 10 || this.time >= c.until) this.charging = undefined;
      }
    }
    if (r.peril >= 3 && r.phase === 3) {
      const radius = Math.max(240, 500 - this.phaseElapsed * 2);
      r.closingRadius = radius;
      for (const p of this.heroes())
        if (p.hp > 0 && Math.hypot(p.x - 800, p.y - 450) > radius)
          this.damage(p, 6 * dt, boss.id);
    }
  }
  private finish(won: boolean) {
    if (this.raid.result) return;
    this.raid.result = won ? "victory" : "defeat";
    this.raid.resultId = randomUUID();
    this.phase = "finished";
    this.winnerTeam = won ? 0 : 1;
    this.winner = won ? (this.heroes()[0]?.id ?? null) : this.raid.bossId;
    this.raid.message = won
      ? "The mountain bows. Your team did it!"
      : "The mountain still stands. Change your build and try again.";
    this.raid.warnings = [];
    this.charging = undefined;
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
      this.attacksStep(dt);
    }
    super.tick(dt);
    if (this.phase !== "playing") return;
    this.resolveDowns(dt);
    if (this.raid.result) return;
    const boss = this.boss();
    if (!boss) return;
    if (boss.hp <= 0) return this.finish(true);
    if (this.raid.elapsed >= RAID.timeLimit) return this.finish(false);
    const next =
      boss.hp / this.raid.maxHp <= 0.33
        ? 3
        : boss.hp / this.raid.maxHp <= 0.67
          ? 2
          : 1;
    if (next > this.raid.phase) {
      this.phaseElapsed = 0;
      this.raid.phase = next;
      this.round = next;
      this.raid.message = RAID.phases[next - 1];
      this.raid.pillars.forEach((p) => (p.broken = false));
      this.offerRaidRites();
    }
  }
  override snapshot(remaining = 0) {
    return { ...super.snapshot(remaining), raid: this.raid };
  }
}
