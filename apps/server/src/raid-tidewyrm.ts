import {
  CHARACTERS,
  RULES,
  move,
  normalize,
  useObstacles,
  type Ability,
  type Fighter,
  type Input,
} from "../../../packages/shared/src/index.js";
import {
  TIDEWYRM,
  type RaidAttack,
  type RaidIsland,
  type RaidWarning,
} from "../../../packages/shared/src/raid.js";
import { RaidArena, type RaidBossNumbers } from "./raid.js";

const T = TIDEWYRM;
const W = RULES.width,
  H = RULES.height;
/** Hits on a sealed ally count once per raider this often (seconds). */
const POP_GAP = 0.35;

/**
 * Tidewyrm, "The Rising Tide" (docs/raid-roster-design.md §5.1). It shares
 * the raid core (chapters, rites, downs, stagger, practice, stand-ins) and
 * brings its own arena: the Lagoon Court with four raised islands.
 *
 * Signature: it dives, a ripple follows one raider and locks, and it
 * surfaces there. On an island it is Stranded (exposed); in water it
 * splashes and dives again.
 */
export class TidewyrmArena extends RaidArena {
  /** Surfaced in water: it lingers, then swims home under water. */
  private lingerUntil = 0;
  /** Swimming back home under water after a strand or a splash. */
  private returning = false;
  /** Waves: who each one has already hit. */
  private waveHits = new Map<number, Set<string>>();
  private undertowHit = new Set<string>();
  private rootedUntil = new Map<string, number>();
  /** Bubble Prison: who popped whose bubble recently, and mash state. */
  private popAt = new Map<string, number>();
  private countedShots = new Set<number>();
  private lastBasic = new Map<string, boolean>();
  /** When each raider stepped onto the island they're on (for High Tide). */
  private onIslandSince = new Map<string, { island: number; since: number }>();
  /** Peril 3, last chapter: when the next island sinks for good. */
  private sinkAt = Infinity;
  /** Which island the boss is stranded on, if any. */
  private strandedOn = -1;

  protected override def(): RaidBossNumbers {
    return T;
  }
  protected override bossHome() {
    return { ...T.home };
  }
  protected override setupArena() {
    const r = this.raid;
    this.arenaId = "lagoon";
    r.pillars = [];
    const radius = r.trait === "spring-tide" ? T.springIslandRadius : T.islandRadius;
    r.islands = T.islands.map((i) => ({ x: i.x, y: i.y, radius, cracks: 0, sunk: false }));
    r.submerged = false;
    r.floodUntil = 0;
    r.waves = [];
    r.bubbles = [];
    r.prisons = [];
    r.undertow = undefined;
    r.strands = 0;
    this.lingerUntil = 0;
    this.returning = false;
    this.strandedOn = -1;
    this.waveHits.clear();
    this.undertowHit.clear();
    this.rootedUntil.clear();
    this.popAt.clear();
    this.countedShots.clear();
    this.lastBasic.clear();
    this.onIslandSince.clear();
    this.sinkAt = Infinity;
  }
  /** Islands are walkable ground, not walls. */
  override walls() {
    useObstacles([]);
    return [];
  }
  /** Chapter 3 does not open its core by itself: strand it. */
  protected override alwaysExposed() {
    return false;
  }
  override feat() {
    return this.raid.result === "victory" && (this.raid.strands ?? 0) >= 4;
  }
  protected override finishMessage(won: boolean) {
    return won
      ? "The tide goes out. Tidewyrm drifts off to sleep. You did it!"
      : "The tide keeps rising. Change your build and try again.";
  }
  protected override onChapter() {
    const r = this.raid;
    // Sunk islands rise again (Peril 3's lost ones stay gone).
    for (const i of r.islands ?? []) {
      i.cracks = 0;
      if (!i.gone) i.sunk = false;
    }
    this.clearAttacks();
    this.sinkAt =
      r.phase === 3 && r.peril >= 3 && !r.drill
        ? this.time + (r.partySize === 1 ? T.soloSinkEvery : T.sinkEvery)
        : Infinity;
  }
  protected override clearAttacks() {
    super.clearAttacks();
    const r = this.raid;
    r.floodUntil = 0;
    r.waves = [];
    r.bubbles = [];
    r.undertow = undefined;
    for (const p of r.prisons ?? []) this.freeFromPrison(p.playerId, false);
    r.prisons = [];
    this.waveHits.clear();
    this.rootedUntil.clear();
  }
  protected override drillReset() {
    // Practice: sunk islands come back so dives can be stranded again.
    for (const i of this.raid.islands ?? []) {
      if (i.sunk && !i.gone) i.sunk = false;
      i.cracks = 0;
    }
  }
  protected override canStartAttack() {
    const r = this.raid;
    return (
      !this.returning &&
      !(this.strandedOn >= 0 && r.exposedUntil > this.time) &&
      !r.undertow &&
      !(r.waves ?? []).length
    );
  }

  // ---------------------------------------------------------------- Islands
  /** Islands still above water. */
  private dryIslands() {
    return (this.raid.islands ?? []).filter((i) => !i.sunk && !i.gone);
  }
  /** The dry island a point stands on, if any. */
  islandAt(x: number, y: number): RaidIsland | undefined {
    return this.dryIslands().find((i) => Math.hypot(x - i.x, y - i.y) < i.radius);
  }
  private onIsland(p: Fighter) {
    return !!this.islandAt(p.x, p.y);
  }

  // ---------------------------------------------------------------- Attacks
  protected override startAttack(kind: RaidAttack, target: Fighter) {
    const r = this.raid,
      boss = this.boss()!;
    const count = this.seenAttacks.get(kind) ?? 0;
    this.seenAttacks.set(kind, count + 1);
    const teach = count < 2;
    boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
    if (kind === "dive") this.startDive(target, teach);
    else if (kind === "wave") this.startWave(teach);
    else if (kind === "bubbles") {
      const d = normalize(target.x - boss.x, target.y - boss.y);
      Object.assign(
        this.warn("bubbles", boss.x, boss.y, boss.x + d.x * 420, boss.y + d.y * 420, 420, T.bubbles.delay),
        { spread: T.bubbles.spread / 2, targetId: target.id, teach },
      );
    } else if (kind === "hightide")
      this.warn("hightide", T.home.x, T.home.y, T.home.x, T.home.y, 0, T.highTide.delay).teach = teach;
    else if (kind === "undertow")
      this.warn("undertow", T.home.x, T.home.y, T.home.x, T.home.y, T.undertow.centreRadius, T.undertow.delay).teach = teach;
    else if (kind === "prison") {
      // Nobody already sealed; alone, the only raider.
      const free = this.heroes().filter((p) => p.hp > 0 && !r.prisons?.some((q) => q.playerId === p.id));
      const who = free.includes(target) ? target : free[0];
      if (!who) return;
      Object.assign(this.warn("prison", who.x, who.y, who.x, who.y, T.prison.radius, T.prison.delay), {
        targetId: who.id,
        lockAt: this.time + T.prison.delay,
        teach,
      });
    } else super.startAttack(kind, target);
  }
  /** It dives: a ripple follows the raider (or Tidefin's clone), then locks. */
  private startDive(target: Fighter, teach: boolean) {
    const r = this.raid;
    r.submerged = true;
    this.lingerUntil = 0;
    Object.assign(
      this.warn("dive", target.x, target.y, target.x, target.y, T.dive.radius, T.dive.follow + T.dive.lock),
      { targetId: target.id, lockAt: this.time + T.dive.follow, teach },
    );
  }
  /** A band sweeps across from one edge: low (jump it) or high (be on an island). */
  private startWave(teach: boolean, delay: number = T.wave.delay) {
    const r = this.raid;
    const side = (this.attacks + r.seed) % 4;
    const axis = side < 2 ? "x" : "y";
    const dir = side % 2 ? -1 : 1;
    const x = axis === "x" ? (dir > 0 ? 0 : W) : W / 2,
      y = axis === "y" ? (dir > 0 ? 0 : H) : H / 2;
    Object.assign(
      this.warn("wave", x, y, axis === "x" ? x + dir : x, axis === "y" ? y + dir : y, T.wave.width, delay),
      { high: r.phase >= 2, teach },
    );
  }
  protected override followWarnings(boss: Fighter) {
    super.followWarnings(boss);
    for (const w of this.raid.warnings) {
      if ((w.kind !== "dive" && w.kind !== "prison") || w.lockAt === undefined || this.time >= w.lockAt)
        continue;
      const target = this.heroes().find((p) => p.id === w.targetId && p.hp > 0);
      if (!target) continue;
      // Tidefin's Mirror Mist: the ripple follows the clone instead.
      const lure = w.kind === "dive" && target.clone && target.clone.until > this.time ? target.clone : target;
      w.x = w.tx = lure.x;
      w.y = w.ty = lure.y;
    }
  }
  protected override resolveWarning(w: RaidWarning, boss: Fighter) {
    const r = this.raid;
    if (w.kind === "dive") return this.surface(w, boss);
    if (w.kind === "wave") {
      const speed = r.trait === "rip-current" ? T.wave.ripSpeed : T.wave.speed;
      const axis = w.tx !== w.x ? "x" : "y";
      const dir = (axis === "x" ? Math.sign(w.tx - w.x) : Math.sign(w.ty - w.y)) as 1 | -1;
      const id = ++this.serial;
      r.waves = [...(r.waves ?? []), { id, axis, dir, pos: axis === "x" ? w.x : w.y, speed, width: T.wave.width, high: !!w.high }];
      this.waveHits.set(id, new Set());
      return;
    }
    if (w.kind === "bubbles") {
      const n = Math.min(9, 7 + (r.peril >= 2 ? 1 : 0) + (r.phase >= 3 ? 1 : 0));
      const aim = Math.atan2(w.ty - w.y, w.tx - w.x),
        spread = w.spread ?? T.bubbles.spread / 2;
      r.bubbles = [
        ...(r.bubbles ?? []),
        ...Array.from({ length: n }, (_, i) => {
          const a = aim - spread + (2 * spread * i) / (n - 1);
          return {
            id: ++this.serial,
            x: boss.x + Math.cos(a) * 60,
            y: boss.y + Math.sin(a) * 60,
            vx: Math.cos(a) * T.bubbles.speed,
            vy: Math.sin(a) * T.bubbles.speed,
            until: this.time + T.bubbles.life,
          };
        }),
      ];
      return;
    }
    if (w.kind === "hightide") {
      r.floodUntil =
        this.time + (r.trait === "spring-tide" ? T.highTide.springSeconds : T.highTide.seconds);
      this.event("raid-impact", T.home, 0x4fd6e6, undefined, boss.id);
      this.events[this.events.length - 1].raidRadius = 600;
      // Storm Surge: High Tide leads straight into a dive.
      if (r.phase === 3 && !r.drill) {
        const alive = this.heroes().filter((p) => p.hp > 0);
        const target = alive[(this.attacks + r.seed) % Math.max(1, alive.length)];
        if (target) this.startDive(target, false);
      }
      return;
    }
    if (w.kind === "undertow") {
      r.undertow = { x: w.x, y: w.y, until: this.time + T.undertow.seconds, radius: T.undertow.centreRadius };
      this.undertowHit.clear();
      // Storm Surge: the Undertow leads into a wave as it lets go.
      if (r.phase === 3 && !r.drill) this.startWave(false, T.undertow.seconds + 0.4);
      return;
    }
    if (w.kind === "prison") {
      const p = this.heroes().find((q) => q.id === w.targetId && q.hp > 0);
      if (!p || r.prisons?.some((q) => q.playerId === p.id)) return;
      r.prisons = [
        ...(r.prisons ?? []),
        { playerId: p.id, x: p.x, y: p.y, hits: 0, presses: 0, until: this.time + T.prison.seconds, startedAt: this.time },
      ];
      this.lastBasic.set(p.id, true);
      r.message = r.partySize > 1 ? `${p.name} is trapped! Pop the bubble: three hits.` : "Trapped! Mash attack to break out.";
      return;
    }
    super.resolveWarning(w, boss);
  }
  /** The dive ends: it surfaces with a splash, stranded if on dry land. */
  private surface(w: RaidWarning, boss: Fighter) {
    const r = this.raid;
    boss.x = w.x;
    boss.y = w.y;
    r.submerged = false;
    this.hitBy = "dive";
    for (const p of this.heroes())
      if (p.hp > 0 && Math.hypot(p.x - w.x, p.y - w.y) < w.radius + RULES.radius)
        this.damage(p, T.dive.damage, boss.id, this.splash());
    this.hitBy = undefined;
    this.countDodges();
    this.event("raid-impact", w, 0x7fe9ff, undefined, boss.id);
    this.events[this.events.length - 1].raidRadius = w.radius;
    const islands = r.islands ?? [];
    const island = this.islandAt(w.x, w.y);
    if (!island) {
      this.lingerUntil = this.time + 2.5;
      this.strandedOn = -1;
      return;
    }
    // Stranded: exposed on dry land.
    this.strandedOn = islands.indexOf(island);
    island.cracks++;
    r.exposedUntil =
      this.time + (r.peril <= 1 ? T.dive.strandPeril1 : T.dive.strand) + (r.trait === "murky" ? 1 : 0);
    if (!r.drill) {
      r.strands = (r.strands ?? 0) + 1;
      r.stagger = Math.min(100, r.stagger + T.dive.strandStagger);
      if (w.targetId && r.contributions?.[w.targetId]) r.contributions[w.targetId].pillars++;
    }
    r.message = "STRANDED! Tidewyrm is on dry land. Hit it now!";
    this.nextAttack = Math.max(this.nextAttack, r.exposedUntil + 1);
  }
  /** How the splash and other water hits look to the damage rules. */
  private splash(ground = false): Ability {
    return { ...CHARACTERS.tidefin.skills[3], ground, knockback: 0 };
  }

  // ------------------------------------------------------------ Every tick
  protected override bossStep(dt: number, boss: Fighter) {
    const r = this.raid;
    // After a strand (or a splash in water) it swims home under water.
    if (this.strandedOn >= 0 && r.exposedUntil <= this.time) {
      const island = r.islands?.[this.strandedOn];
      if (island && island.cracks >= T.dive.cracks) {
        island.sunk = true;
        r.message = "The island cracks and sinks until the next chapter.";
      }
      this.strandedOn = -1;
      this.goHome();
    } else if (this.lingerUntil && this.time >= this.lingerUntil) {
      this.lingerUntil = 0;
      this.goHome();
    }
    if (this.returning) {
      const d = normalize(T.home.x - boss.x, T.home.y - boss.y),
        left = Math.hypot(T.home.x - boss.x, T.home.y - boss.y),
        step = Math.min(left, 420 * dt);
      boss.x += d.x * step;
      boss.y += d.y * step;
      if (left - step < 1) {
        this.returning = false;
        if (!r.warnings.some((w) => w.kind === "dive")) r.submerged = false;
      }
    }
    this.trackIslands();
    this.stepWaves(dt, boss);
    this.stepBubbles(dt, boss);
    this.stepPrisons(dt, boss);
    this.stepUndertow(dt, boss);
    this.stepFlood(dt, boss);
    this.stepSinking();
    // Roots and prisons hold raiders in place (before movement this tick).
    for (const p of this.heroes()) {
      const sealed = r.prisons?.some((q) => q.playerId === p.id);
      if (sealed || (this.rootedUntil.get(p.id) ?? 0) > this.time) {
        p.lastInput = { ...p.lastInput, dx: 0, dy: 0, dash: false, jump: false };
        if (sealed) p.lastInput = { ...p.lastInput, basic: false, skill: -1 };
      }
    }
  }
  private goHome() {
    this.raid.submerged = true;
    this.returning = true;
  }
  /** Remember when each raider stepped onto their island (for crowding). */
  private trackIslands() {
    const islands = this.raid.islands ?? [];
    for (const p of this.heroes()) {
      const at = this.islandAt(p.x, p.y);
      const index = at ? islands.indexOf(at) : -1;
      const known = this.onIslandSince.get(p.id);
      if (index < 0) this.onIslandSince.delete(p.id);
      else if (known?.island !== index) this.onIslandSince.set(p.id, { island: index, since: this.time });
    }
  }
  private stepWaves(dt: number, boss: Fighter) {
    const r = this.raid;
    for (const wave of r.waves ?? []) {
      wave.pos += wave.dir * wave.speed * dt;
      const hit = this.waveHits.get(wave.id) ?? new Set<string>();
      this.hitBy = "wave";
      for (const p of this.heroes()) {
        if (p.hp <= 0 || hit.has(p.id)) continue;
        const along = wave.axis === "x" ? p.x : p.y;
        if (Math.abs(along - wave.pos) > wave.width / 2 + RULES.radius) continue;
        hit.add(p.id);
        // Low waves are jumped; high waves only spare raiders on an island.
        const safe = wave.high ? this.onIsland(p) : p.jumpUntil > this.time;
        if (safe) continue;
        this.struck.add(p.id);
        this.damage(p, T.wave.damage, boss.id, this.splash());
        if (!r.drill)
          move(p, wave.axis === "x" ? wave.dir * 60 : 0, wave.axis === "y" ? wave.dir * 60 : 0);
      }
      this.hitBy = undefined;
      this.waveHits.set(wave.id, hit);
    }
    const before = (r.waves ?? []).length;
    r.waves = (r.waves ?? []).filter((w) => {
      const end = w.axis === "x" ? W : H;
      const gone = w.dir > 0 ? w.pos - w.width > end : w.pos + w.width < 0;
      if (gone) this.waveHits.delete(w.id);
      return !gone;
    });
    if (before && !r.waves.length) this.countDodges();
  }
  private stepBubbles(dt: number, boss: Fighter) {
    const r = this.raid;
    const shots = this.projectiles.filter((pr) => pr.owner !== boss.id);
    const left: NonNullable<typeof r.bubbles> = [];
    for (const b of r.bubbles ?? []) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.until <= this.time || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) continue;
      // Popped by an attack.
      if (shots.some((pr) => Math.hypot(pr.x - b.x, pr.y - b.y) < T.bubbles.radius + (pr.ability.radius ?? 10))) {
        this.event("hit", b, 0xbff6ff, 0);
        continue;
      }
      const victim = this.heroes().find(
        (p) => p.hp > 0 && Math.hypot(p.x - b.x, p.y - b.y) < T.bubbles.radius + RULES.radius,
      );
      if (!victim) {
        left.push(b);
        continue;
      }
      this.hitBy = "bubbles";
      this.damage(victim, T.bubbles.damage, boss.id, this.splash());
      this.hitBy = undefined;
      if (!this.hasRite(victim, "footing") && !r.drill)
        this.rootedUntil.set(victim.id, this.time + T.bubbles.root);
    }
    r.bubbles = left;
  }
  private stepPrisons(dt: number, boss: Fighter) {
    const r = this.raid;
    if (!r.prisons?.length) return;
    for (const prison of [...r.prisons]) {
      const p = this.heroes().find((q) => q.id === prison.playerId);
      if (!p || p.hp <= 0) {
        this.freeFromPrison(prison.playerId, false);
        continue;
      }
      // Drift to the boss's mouth, arriving as time runs out.
      const left = Math.max(0.05, prison.until - this.time);
      const d = normalize(boss.x - prison.x, boss.y - prison.y),
        dist = Math.hypot(boss.x - prison.x, boss.y - prison.y);
      const step = Math.min(dist, (dist / left) * dt);
      prison.x += d.x * step;
      prison.y += d.y * step;
      p.x = prison.x;
      p.y = prison.y;

      // Teammates pop it: shots that reach it, or swings from beside it.
      for (const pr of this.projectiles) {
        if (pr.owner === boss.id || pr.owner === p.id || this.countedShots.has(pr.id)) continue;
        if (Math.hypot(pr.x - prison.x, pr.y - prison.y) > T.prison.radius + (pr.ability.radius ?? 10) + RULES.radius)
          continue;
        this.countedShots.add(pr.id);
        // Cindrake's Magma Bomb pops it in one hit.
        prison.hits += pr.ability.id === "magma-bomb" ? T.prison.hits : 1;
      }
      for (const q of this.heroes()) {
        if (q === p || q.hp <= 0 || !q.lastInput.basic) continue;
        if (Math.hypot(q.x - prison.x, q.y - prison.y) > 110) continue;
        if (this.time < (this.popAt.get(q.id) ?? -1)) continue;
        this.popAt.set(q.id, this.time + POP_GAP);
        prison.hits++;
      }
      if (prison.hits >= T.prison.hits || prison.presses >= T.prison.presses) {
        this.freeFromPrison(p.id, true);
        continue;
      }
      if (this.time >= prison.until) {
        // Reached the mouth.
        this.freeFromPrison(p.id, false);
        if (r.drill) {
          this.struck.add(p.id);
          if (r.drillStats) r.drillStats.hits++;
          continue;
        }
        this.hitBy = "prison";
        this.damage(p, p.hp + 999, boss.id);
        this.hitBy = undefined;
      }
    }
    if (this.countedShots.size > 400) this.countedShots.clear();
  }
  private freeFromPrison(id: string, popped: boolean) {
    const r = this.raid;
    r.prisons = (r.prisons ?? []).filter((q) => q.playerId !== id);
    const p = this.players.find((q) => q.id === id);
    if (!p || !popped) return;
    p.immuneUntil = this.time + 1;
    this.event("heal", p, 0xbff6ff, 0, p.id);
    if (r.drill && r.drillStats) r.drillStats.dodges++;
  }
  private stepUndertow(dt: number, boss: Fighter) {
    const r = this.raid,
      u = r.undertow;
    if (!u) return;
    if (u.until <= this.time) {
      r.undertow = undefined;
      this.countDodges();
      return;
    }
    const pull = r.trait === "rip-current" ? T.undertow.ripPull : T.undertow.pull;
    for (const p of this.heroes()) {
      if (p.hp <= 0 || r.prisons?.some((q) => q.playerId === p.id)) continue;
      const dist = Math.hypot(u.x - p.x, u.y - p.y);
      if (dist > 4) {
        const d = normalize(u.x - p.x, u.y - p.y);
        move(p, d.x * Math.min(dist, pull * dt), d.y * Math.min(dist, pull * dt));
      }
      if (dist < u.radius + RULES.radius && !this.undertowHit.has(p.id)) {
        this.undertowHit.add(p.id);
        this.struck.add(p.id);
        this.hitBy = "undertow";
        this.damage(p, T.undertow.damage, boss.id, this.splash());
        this.hitBy = undefined;
      }
    }
  }
  private stepFlood(dt: number, boss: Fighter) {
    const r = this.raid;
    if (!r.floodUntil || r.floodUntil <= this.time) {
      if (r.floodUntil) {
        r.floodUntil = 0;
        this.countDodges();
      }
      return;
    }
    // Two fit on an island; later arrivals get pushed off (solo: no limit).
    if (r.partySize > 1 && !r.drill)
      for (const island of this.dryIslands()) {
        const on = this.heroes()
          .filter((p) => p.hp > 0 && Math.hypot(p.x - island.x, p.y - island.y) < island.radius)
          .sort((a, b) => (this.onIslandSince.get(a.id)?.since ?? 0) - (this.onIslandSince.get(b.id)?.since ?? 0));
        for (const p of on.slice(T.islandCapacity)) {
          const d = normalize(p.x - island.x || 1, p.y - island.y);
          p.x = island.x + d.x * (island.radius + RULES.radius + 6);
          p.y = island.y + d.y * (island.radius + RULES.radius + 6);
        }
      }
    this.hitBy = "hightide";
    for (const p of this.heroes()) {
      if (p.hp <= 0 || this.onIsland(p)) continue;
      this.struck.add(p.id);
      this.damage(p, T.highTide.dps * dt, boss.id);
      if (!r.drill) this.status(p, "slow", 0.3);
    }
    this.hitBy = undefined;
  }
  /** Peril 3's last chapter: an island sinks for good now and then. */
  private stepSinking() {
    const r = this.raid;
    if (this.time < this.sinkAt) return;
    const standing = (r.islands ?? []).filter((i) => !i.gone);
    if (standing.length <= T.minIslands) {
      this.sinkAt = Infinity;
      return;
    }
    const island = standing[(r.seed + standing.length) % standing.length];
    island.gone = true;
    island.sunk = true;
    r.message = "An island sinks for good!";
    this.event("raid-impact", island, 0x4fd6e6, undefined, r.bossId);
    this.events[this.events.length - 1].raidRadius = island.radius;
    this.sinkAt = this.time + (r.partySize === 1 ? T.soloSinkEvery : T.sinkEvery);
  }

  // ------------------------------------------------------------ Damage etc.
  override damage(target: Fighter, amount: number, owner: string, ability?: Ability) {
    const r = this.raid;
    // Sealed in a bubble: only reaching the mouth hurts.
    if (this.hitBy !== "prison" && r.prisons?.some((q) => q.playerId === target.id)) return;
    if (target.raidBoss) {
      // Under water it can't be reached.
      if (r.submerged) return;
      // Voltkit's Static Lance on a stranded Tidewyrm: water conducts.
      if (ability?.id === "static-lance" && this.strandedOn >= 0 && r.exposedUntil > this.time && !r.drill)
        r.stagger = Math.min(100, r.stagger + T.lanceStagger);
    }
    super.damage(target, amount, owner, ability);
  }
  override cast(p: Fighter, a: Ability, ex = false) {
    super.cast(p, a, ex);
    // Terradon's Tremor pops every bubble nearby and frees a Prison.
    if (a.id === "tremor" && !p.raidBoss) {
      const r = this.raid;
      r.bubbles = (r.bubbles ?? []).filter((b) => Math.hypot(b.x - p.x, b.y - p.y) > 260);
      for (const prison of [...(r.prisons ?? [])])
        if (prison.playerId !== p.id && Math.hypot(prison.x - p.x, prison.y - p.y) < 260)
          this.freeFromPrison(prison.playerId, true);
    }
  }
  /** Sealed raiders mash attack to break out; nothing else gets through. */
  override submit(p: Fighter, input: Input) {
    const prison = this.raid.prisons?.find((q) => q.playerId === p.id);
    if (prison && p.hp > 0 && this.phase === "playing") {
      if (input.seq <= p.ack) return;
      p.ack = input.seq;
      const was = this.lastBasic.get(p.id) ?? false;
      if (input.basic && !was) prison.presses++;
      this.lastBasic.set(p.id, input.basic);
      return;
    }
    super.submit(p, input);
  }
  /** Sure Footing: 15% faster through water. */
  override tick(dt = 1 / RULES.tick) {
    const before = new Map(
      this.phase === "playing"
        ? this.heroes()
            .filter((p) => p.hp > 0 && this.hasRite(p, "footing") && !this.onIsland(p))
            .map((p) => [p.id, { x: p.x, y: p.y }] as const)
        : [],
    );
    super.tick(dt);
    for (const [id, at] of before) {
      const p = this.players.find((q) => q.id === id);
      if (!p || p.hp <= 0 || p.dashUntil > this.time) continue;
      const dx = p.x - at.x,
        dy = p.y - at.y;
      if (dx || dy) move(p, dx * 0.15, dy * 0.15);
    }
  }

  // ------------------------------------------------------------- Stand-ins
  protected override botHint(bot: Fighter, input: Input, go: (x: number, y: number, away: boolean) => Input) {
    const r = this.raid;
    // Sealed: mash (counted here; players' presses arrive through submit()).
    const sealed = r.prisons?.find((q) => q.playerId === bot.id);
    if (sealed) {
      const press = Math.floor(this.time * 8) % 2 === 0;
      if (press && !this.lastBasic.get(bot.id)) sealed.presses++;
      this.lastBasic.set(bot.id, press);
      return { ...input, dx: 0, dy: 0, basic: false, skill: -1, dash: false, jump: false };
    }
    const nearestIsland = () => {
      const crowd = (i: RaidIsland) =>
        this.heroes().filter((p) => p !== bot && Math.hypot(p.x - i.x, p.y - i.y) < i.radius).length;
      return this.dryIslands()
        .filter((i) => r.partySize === 1 || crowd(i) < T.islandCapacity)
        .sort((a, b) => Math.hypot(a.x - bot.x, a.y - bot.y) - Math.hypot(b.x - bot.x, b.y - bot.y))[0];
    };
    const toIsland = () => {
      const island = nearestIsland();
      if (!island) return undefined;
      if (Math.hypot(island.x - bot.x, island.y - bot.y) < island.radius * 0.5) {
        input.dx = input.dy = 0;
        return input;
      }
      return go(island.x, island.y, false);
    };
    const floodSoon =
      (r.floodUntil ?? 0) > this.time ||
      r.warnings.some((w) => w.kind === "hightide") ||
      (r.waves ?? []).some((w) => w.high) ||
      r.warnings.some((w) => w.kind === "wave" && w.high);
    if (floodSoon) {
      const move = toIsland();
      if (move) return move;
    }
    const dive = r.warnings.find((w) => w.kind === "dive");
    if (dive) {
      const locked = dive.lockAt !== undefined && this.time >= dive.lockAt;
      // Lead the ripple onto an island, then step off once it locks.
      if (dive.targetId === bot.id && !locked) {
        const move = toIsland();
        if (move) return move;
      }
      if (locked && Math.hypot(bot.x - dive.x, bot.y - dive.y) < dive.radius + RULES.radius + 25)
        return go(dive.x, dive.y, true);
    }
    if (r.undertow) return go(r.undertow.x, r.undertow.y, true);
    // Jump a low wave as it reaches us.
    for (const wave of r.waves ?? []) {
      const along = wave.axis === "x" ? bot.x : bot.y;
      const ahead = (along - wave.pos) * wave.dir;
      if (!wave.high && ahead > 0 && ahead < wave.width + 60) input.jump = true;
    }
    const bubble = (r.bubbles ?? []).find((b) => Math.hypot(b.x - bot.x, b.y - bot.y) < 110);
    if (bubble) {
      const d = normalize(bubble.vx, bubble.vy);
      return go(bot.x - d.y * 100, bot.y + d.x * 100, false);
    }
    // Pop a trapped teammate.
    const prison = r.prisons?.find((q) => q.playerId !== bot.id);
    if (prison) {
      input.basic = Math.floor(this.time * 4) % 2 === 0;
      input.aimX = prison.x;
      input.aimY = prison.y;
      if (Math.hypot(prison.x - bot.x, prison.y - bot.y) > 80) return go(prison.x, prison.y, false);
      return input;
    }
    return undefined;
  }
}
