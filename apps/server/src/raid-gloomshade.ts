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
  GLOOMSHADE,
  gloomshadePattern,
  handsTileDark,
  lanternRadius,
  type RaidAttack,
  type RaidWarning,
} from "../../../packages/shared/src/raid.js";
import { RaidArena, type RaidBossNumbers } from "./raid.js";

const G = GLOOMSHADE;
/** Hits on the real Gloomshade from one raider count at most this often. */
const STREAK_GAP = 0.2;

/** Distance from a point to a segment. */
function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const lx = bx - ax,
    ly = by - ay,
    len2 = lx * lx + ly * ly || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * lx + (py - ay) * ly) / len2));
  return Math.hypot(px - (ax + lx * t), py - (ay + ly * t));
}

/**
 * Gloomshade, "Lights Out" (docs/raid-roster-design.md §5.2), in the Lantern
 * Yard. Signature: from chapter 2 it splits into copies. Only the real one
 * casts a shadow in lantern light; hitting a copy curses you, and six hits in
 * a row on the real one expose its core.
 */
export class GloomshadeArena extends RaidArena {
  /** Where each copy is drifting to (index 0 is the real one). */
  private targets: { x: number; y: number }[] = [];
  private driftAt = 0;
  private serialDrift = 0;
  /** Copies hit this run (the feat is none, after at least one split). */
  decoyHits = 0;
  private splits = 0;
  private lastHitAt = new Map<string, number>();
  private countedShots = new Set<number>();
  private basicWas = new Map<string, boolean>();
  private nearFor = new Map<string, number>();
  private lightFor = new Map<string, number>();
  private stillFor = new Map<string, number>();
  private lastSpot = new Map<string, { x: number; y: number }>();
  /** Witching Hour: split again as soon as an exposure ends. */
  private splitWhenCovered = false;
  private exposedByStreak = false;

  protected override def(): RaidBossNumbers {
    return G;
  }
  protected override bossHome() {
    return { ...G.home };
  }
  protected override pattern() {
    const r = this.raid;
    return gloomshadePattern(r.phase, r.peril, r.trait === "restless-spirits");
  }
  protected override setupArena() {
    const r = this.raid;
    this.arenaId = "lantern-yard";
    r.pillars = [];
    r.lanterns = G.lanterns.map((l) => ({ x: l.x, y: l.y, lit: true, hits: 0 }));
    r.decoys = [];
    r.curses = {};
    r.lights = [];
    r.revealUntil = 0;
    r.streak = 0;
    this.targets = [];
    this.driftAt = 0;
    this.decoyHits = 0;
    this.splits = 0;
    this.splitWhenCovered = false;
    this.exposedByStreak = false;
    this.lastHitAt.clear();
    this.countedShots.clear();
    this.basicWas.clear();
    this.nearFor.clear();
    this.lightFor.clear();
    this.stillFor.clear();
    this.lastSpot.clear();
  }
  /** Lanterns are posts you walk up to, not walls. */
  override walls() {
    useObstacles([]);
    return [];
  }
  protected override alwaysExposed() {
    return false;
  }
  override feat() {
    return this.raid.result === "victory" && this.splits > 0 && this.decoyHits === 0;
  }
  protected override finishMessage(won: boolean) {
    return won
      ? "Dawn breaks. Gloomshade fades with the night. You did it!"
      : "The night goes on. Change your build and try again.";
  }
  protected override onChapter() {
    const r = this.raid;
    // The lanterns flare back on for a fresh chapter.
    for (const l of r.lanterns ?? []) {
      l.lit = true;
      l.hits = 0;
    }
    r.decoys = [];
    r.curses = {};
    r.streak = 0;
    this.splitWhenCovered = r.phase === 3 && !r.drill;
  }
  protected override clearAttacks() {
    super.clearAttacks();
    const r = this.raid;
    r.decoys = [];
    r.lights = [];
    r.curses = {};
  }
  protected override drillReset() {
    const r = this.raid;
    if ((r.lanterns ?? []).every((l) => !l.lit))
      for (const l of r.lanterns ?? []) {
        l.lit = true;
        l.hits = 0;
      }
    // Practice: copies vanish before each new split.
    if (r.drill === "split") r.decoys = [];
  }

  // ------------------------------------------------------------- Helpers
  /** Is a point in lantern (or temporary) light? */
  lit(x: number, y: number) {
    const r = this.raid;
    return (
      (r.lanterns ?? []).some((l) => l.lit && Math.hypot(x - l.x, y - l.y) < lanternRadius(r.trait)) ||
      (r.lights ?? []).some((l) => l.until > this.time && Math.hypot(x - l.x, y - l.y) < l.radius)
    );
  }
  /** Gloomshade and its copies (the real one first). */
  private copies() {
    const boss = this.boss();
    return [...(boss ? [{ x: boss.x, y: boss.y }] : []), ...(this.raid.decoys ?? [])];
  }
  private addCurse(p: Fighter) {
    const r = this.raid;
    if (p.hp <= 0 || p.raidBoss) return;
    r.curses ??= {};
    const c = (r.curses[p.id] ??= { stacks: 0, hauntedUntil: 0 });
    if (c.hauntedUntil > this.time) return;
    c.stacks = Math.min(G.curse.haunted, c.stacks + 1);
    if (c.stacks >= G.curse.haunted) {
      c.hauntedUntil = this.time + G.curse.hauntSeconds;
      r.message = `${p.name} is Haunted! Get to lantern light.`;
    }
  }
  private cleanse(p: Fighter) {
    const c = this.raid.curses?.[p.id];
    if (!c || (!c.stacks && c.hauntedUntil <= this.time)) return;
    delete this.raid.curses![p.id];
    this.event("heal", p, 0xffe7a8, 0, p.id);
  }
  /** How many copies a split makes (the real one included). */
  private copyCount() {
    const r = this.raid;
    let n = r.peril >= 3 ? G.split.peril3Copies : G.split.copies;
    if (r.trait === "moonlit") n++;
    if (r.trait === "hollow") n--;
    if (r.partySize === 1) n--;
    return Math.max(2, n);
  }
  /** Spots for every copy, shuffled from the seed (no two share one). */
  private pickSpots(count: number) {
    const spots = [...G.spots];
    let seed = (this.raid.seed + ++this.serialDrift * 7919) >>> 0;
    for (let i = spots.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    return spots.slice(0, count);
  }
  private split() {
    const r = this.raid,
      boss = this.boss();
    if (!boss) return;
    const spots = this.pickSpots(this.copyCount());
    boss.x = spots[0].x;
    boss.y = spots[0].y;
    r.decoys = spots.slice(1).map((s) => ({ id: ++this.serial, x: s.x, y: s.y }));
    this.targets = spots;
    this.driftAt = this.time + G.driftEvery;
    r.streak = 0;
    if (!r.drill) this.splits++;
    r.message = "It splits! Only the real one casts a shadow in lantern light.";
    this.event("raid-impact", boss, 0x9c7bff, undefined, boss.id);
    this.events[this.events.length - 1].raidRadius = 120;
  }
  private popDecoy(index: number, by: Fighter) {
    const r = this.raid;
    const d = r.decoys![index];
    r.decoys!.splice(index, 1);
    this.targets.splice(index + 1, 1);
    r.streak = 0;
    this.event("raid-impact", d, 0x9c7bff, undefined, r.bossId);
    this.events[this.events.length - 1].raidRadius = 60;
    if (r.drill) return;
    this.decoyHits++;
    this.addCurse(by);
    r.message = `${by.name} hit a copy! A Curse Puff clings to them.`;
  }

  // ------------------------------------------------------------- Attacks
  protected override startAttack(kind: RaidAttack, target: Fighter): void {
    const r = this.raid,
      boss = this.boss()!;
    const count = this.seenAttacks.get(kind) ?? 0;
    this.seenAttacks.set(kind, count + 1);
    const teach = count < 2;
    boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
    if (kind === "lunge") {
      // From the nearest shadow: a copy, or a lantern that has gone out.
      const shadows = [
        ...this.copies(),
        ...(r.lanterns ?? []).filter((l) => !l.lit).map((l) => ({ x: l.x, y: l.y })),
      ];
      const from = shadows.sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))[0];
      const d = normalize(target.x - from.x || 1, target.y - from.y);
      Object.assign(
        this.warn("lunge", from.x, from.y, from.x + d.x * G.lunge.length, from.y + d.y * G.lunge.length, G.lunge.width, G.lunge.delay),
        { targetId: target.id, lockAt: this.time + G.lunge.delay * 0.5, teach },
      );
    } else if (kind === "hands") {
      Object.assign(this.warn("hands", 800, 450, 800, 450, 0, G.hands.delay), {
        parity: (r.seed + this.attacks) % 2,
        ...(r.peril >= 2 && !teach ? { shiftAt: this.time + G.hands.shiftAt } : {}),
        teach,
      });
    } else if (kind === "snuff") {
      const lit = (r.lanterns ?? []).map((l, i) => ({ l, i })).filter((x) => x.l.lit);
      if (!lit.length) return this.startAttack("lunge", target);
      // The lantern nearest the raider being watched goes out.
      const { l, i } = lit.sort((a, b) => Math.hypot(a.l.x - target.x, a.l.y - target.y) - Math.hypot(b.l.x - target.x, b.l.y - target.y))[0];
      Object.assign(this.warn("snuff", l.x, l.y, l.x, l.y, lanternRadius(r.trait), r.phase >= 3 ? G.snuff.finalDelay : G.snuff.delay), {
        lantern: i,
        teach,
      });
    } else if (kind === "curse") {
      Object.assign(this.warn("curse", target.x, target.y, target.x, target.y, G.curse.radius, 1), {
        targetId: target.id,
        lockAt: this.time + 1,
        teach,
      });
    } else if (kind === "split") {
      this.warn("split", boss.x, boss.y, boss.x, boss.y, 120, G.split.delay).teach = teach;
    } else if (kind === "pulse") {
      this.warn("pulse", boss.x, boss.y, boss.x, boss.y, G.pulse.radius, G.pulse.delay).teach = teach;
    } else super.startAttack(kind, target);
  }
  protected override followWarnings(boss: Fighter) {
    super.followWarnings(boss);
    for (const w of this.raid.warnings) {
      if (w.lockAt !== undefined && this.time >= w.lockAt) continue;
      const target = this.heroes().find((p) => p.id === w.targetId && p.hp > 0);
      if (w.kind === "lunge" && target) {
        const d = normalize(target.x - w.x || 1, target.y - w.y);
        w.tx = w.x + d.x * G.lunge.length;
        w.ty = w.y + d.y * G.lunge.length;
      } else if (w.kind === "curse" && target) {
        w.x = w.tx = target.x;
        w.y = w.ty = target.y;
      }
      // The pulse rings come from wherever Gloomshade is.
      if (w.kind === "pulse") {
        w.x = w.tx = boss.x;
        w.y = w.ty = boss.y;
      }
    }
  }
  protected override resolveWarning(w: RaidWarning, boss: Fighter) {
    const r = this.raid;
    const ability: Ability = { ...CHARACTERS.duskveil.skills[3], ground: false, knockback: 0 };
    if (w.kind === "lunge") {
      this.hitBy = "lunge";
      for (const p of this.heroes())
        if (p.hp > 0 && segmentDistance(p.x, p.y, w.x, w.y, w.tx, w.ty) < w.radius + RULES.radius)
          this.damage(p, G.lunge.damage, boss.id, ability);
      this.hitBy = undefined;
      this.countDodges();
      return;
    }
    if (w.kind === "hands") {
      const parity = w.shiftAt !== undefined ? 1 - (w.parity ?? 0) : (w.parity ?? 0);
      this.hitBy = "hands";
      for (const p of this.heroes())
        if (p.hp > 0 && handsTileDark(p.x, p.y, parity)) this.damage(p, G.hands.damage, boss.id, ability);
      this.hitBy = undefined;
      this.countDodges();
      this.event("raid-impact", { x: 800, y: 450 }, 0x5a3a9a, undefined, boss.id);
      this.events[this.events.length - 1].raidRadius = 0;
      return;
    }
    if (w.kind === "snuff") {
      const l = r.lanterns?.[w.lantern ?? -1];
      if (l) {
        l.lit = false;
        l.hits = 0;
        r.message = "A lantern goes out! Hit it twice to relight it.";
      }
      return;
    }
    if (w.kind === "curse") {
      const p = this.heroes().find((q) => q.id === w.targetId && q.hp > 0);
      if (p) {
        this.addCurse(p);
        if (r.drill) this.struck.add(p.id);
        r.message = r.partySize > 1 ? `${p.name} is cursed! Spread out, and find lantern light.` : "Cursed! Keep moving and find lantern light.";
      }
      return;
    }
    if (w.kind === "split") return this.split();
    if (w.kind === "pulse") {
      this.hitBy = "pulse";
      for (const p of this.heroes())
        if (p.hp > 0 && p.jumpUntil <= this.time && Math.hypot(p.x - boss.x, p.y - boss.y) < w.radius + RULES.radius)
          this.damage(p, G.pulse.damage, boss.id, { ...ability, ground: true });
      this.hitBy = undefined;
      this.countDodges();
      // The real ring gives it away for a moment.
      r.revealUntil = Math.max(r.revealUntil ?? 0, this.time + 1.5);
      this.event("raid-impact", boss, 0xb88aff, undefined, boss.id);
      this.events[this.events.length - 1].raidRadius = w.radius;
      // Witching Hour: pulses come in pairs.
      if (r.phase >= 3 && !w.followUp && !r.drill) {
        Object.assign(this.warn("pulse", boss.x, boss.y, boss.x, boss.y, G.pulse.radius, G.pulse.pairGap), { followUp: true });
        this.nextAttack = Math.max(this.nextAttack, this.time + G.pulse.pairGap + 2.5);
      }
      return;
    }
    super.resolveWarning(w, boss);
  }

  // ------------------------------------------------------------- Each tick
  protected override bossStep(dt: number, boss: Fighter) {
    const r = this.raid;
    // Witching Hour: copies return when the core closes again.
    if (this.exposedByStreak && r.exposedUntil <= this.time) {
      this.exposedByStreak = false;
      if (r.phase >= 3 && !r.drill) this.splitWhenCovered = true;
    }
    if (this.splitWhenCovered && r.exposedUntil <= this.time && !r.warnings.length) {
      this.splitWhenCovered = false;
      this.split();
    }
    this.drift(dt, boss);
  }
  /** Lanterns, curses and lights keep going while it is staggered. */
  protected override worldStep(dt: number, boss: Fighter) {
    const r = this.raid;
    this.stepHits(boss);
    this.stepCurses(dt, boss);
    r.lights = (r.lights ?? []).filter((l) => l.until > this.time);
    // Lamplighter: lantern light heals 1% a second.
    for (const p of this.heroes())
      if (p.hp > 0 && this.hasRite(p, "lamplighter") && this.lit(p.x, p.y)) {
        const max = CHARACTERS[p.character].health;
        p.hp = Math.min(max, p.hp + max * 0.01 * dt);
      }
  }
  /** Gloomshade and its copies drift between spots, all the same way. */
  private drift(dt: number, boss: Fighter) {
    const r = this.raid;
    const copies = 1 + (r.decoys?.length ?? 0);
    if (this.time >= this.driftAt || this.targets.length !== copies) {
      this.targets = this.pickSpots(copies);
      this.driftAt = this.time + G.driftEvery;
    }
    const step = (body: { x: number; y: number }, to: { x: number; y: number }) => {
      const dist = Math.hypot(to.x - body.x, to.y - body.y);
      if (dist < 1) return;
      const d = normalize(to.x - body.x, to.y - body.y),
        s = Math.min(dist, G.driftSpeed * dt);
      body.x += d.x * s;
      body.y += d.y * s;
    };
    // Exposed or staggered, it holds still.
    if (r.exposedUntil > this.time || r.staggerUntil > this.time) return;
    step(boss, this.targets[0]);
    r.decoys?.forEach((d, i) => step(d, this.targets[i + 1]));
  }
  /** Shots and swings that reach copies or unlit lanterns. */
  private stepHits(boss: Fighter) {
    const r = this.raid;
    const heroes = this.heroes().filter((p) => p.hp > 0);
    const shots = this.projectiles.filter((pr) => pr.owner !== boss.id && !this.countedShots.has(pr.id));
    // A fresh press of attack, aimed at a spot within reach.
    const swings = heroes.filter((p) => {
      const was = this.basicWas.get(p.id) ?? false;
      this.basicWas.set(p.id, p.lastInput.basic);
      return p.lastInput.basic && !was;
    });
    const swingAt = (p: Fighter, x: number, y: number, reach: number) =>
      Math.hypot(p.x - x, p.y - y) < reach &&
      Math.hypot(p.lastInput.aimX - x, p.lastInput.aimY - y) < 110;
    for (let i = (r.decoys?.length ?? 0) - 1; i >= 0; i--) {
      const d = r.decoys![i];
      const shot = shots.find((pr) => Math.hypot(pr.x - d.x, pr.y - d.y) < 50 + (pr.ability.radius ?? 10));
      const zone = this.zones.find((z) => z.owner !== boss.id && Math.hypot(z.x - d.x, z.y - d.y) < z.radius + 40);
      const swing = swings.find((p) => swingAt(p, d.x, d.y, 170));
      const by = heroes.find((p) => p.id === (shot?.owner ?? zone?.owner ?? swing?.id));
      if (!by) continue;
      if (shot) this.countedShots.add(shot.id);
      this.popDecoy(i, by);
    }
    for (const l of r.lanterns ?? []) {
      if (l.lit) continue;
      const shot = shots.find((pr) => !this.countedShots.has(pr.id) && Math.hypot(pr.x - l.x, pr.y - l.y) < 36 + (pr.ability.radius ?? 10));
      const swing = swings.find((p) => swingAt(p, l.x, l.y, 140));
      const by = heroes.find((p) => p.id === (shot?.owner ?? swing?.id));
      if (!by) continue;
      if (shot) this.countedShots.add(shot.id);
      l.hits++;
      if (l.hits >= (this.hasRite(by, "lamplighter") ? 1 : G.relightHits)) this.relight(l, by);
    }
    if (this.countedShots.size > 400) this.countedShots.clear();
  }
  private relight(l: { x: number; y: number; lit: boolean; hits: number }, by?: Fighter) {
    const r = this.raid;
    if (l.lit) return;
    l.lit = true;
    l.hits = 0;
    this.event("heal", l, 0xffd65b, 0, by?.id);
    if (by && !r.drill && r.contributions?.[by.id]) r.contributions[by.id].pillars++;
  }
  private stepCurses(dt: number, boss: Fighter) {
    const r = this.raid;
    const heroes = this.heroes().filter((p) => p.hp > 0);
    const curses = (r.curses ??= {});
    const spread = r.trait === "restless-spirits" ? G.curse.restlessSpread : G.curse.spreadSeconds;
    for (const p of heroes) {
      const c = curses[p.id];
      const moved = this.lastSpot.get(p.id);
      const still = !!moved && Math.hypot(p.x - moved.x, p.y - moved.y) < 1.5;
      this.lastSpot.set(p.id, { x: p.x, y: p.y });
      if (c && (c.stacks > 0 || c.hauntedUntil > this.time)) {
        // Lantern light cleanses it.
        if (this.lit(p.x, p.y)) {
          const t = (this.lightFor.get(p.id) ?? 0) + dt;
          this.lightFor.set(p.id, t);
          if (t >= G.curse.cleanseSeconds) {
            this.lightFor.delete(p.id);
            this.cleanse(p);
            continue;
          }
        } else this.lightFor.delete(p.id);
        if (c.hauntedUntil > this.time) {
          this.hitBy = "curse";
          this.damage(p, G.curse.dps * dt, boss.id);
          this.hitBy = undefined;
        } else if (c.hauntedUntil && c.hauntedUntil <= this.time) delete curses[p.id];
        // Alone, the curse grows while you stand still.
        if (r.partySize === 1 && still && curses[p.id]) {
          const t = (this.stillFor.get(p.id) ?? 0) + dt;
          this.stillFor.set(p.id, t >= G.curse.soloStill ? 0 : t);
          if (t >= G.curse.soloStill) this.addCurse(p);
        } else this.stillFor.delete(p.id);
      }
    }
    // It spreads to anyone who stays close to a cursed raider.
    if (r.partySize > 1)
      for (const q of heroes) {
        const nearCursed = heroes.some(
          (p) => p !== q && (curses[p.id]?.stacks ?? 0) > 0 && Math.hypot(p.x - q.x, p.y - q.y) < G.curse.radius,
        );
        if (!nearCursed) {
          this.nearFor.delete(q.id);
          continue;
        }
        const t = (this.nearFor.get(q.id) ?? 0) + dt;
        if (t >= spread) {
          this.nearFor.delete(q.id);
          this.addCurse(q);
        } else this.nearFor.set(q.id, t);
      }
  }

  // ------------------------------------------------------------ Damage etc.
  override damage(target: Fighter, amount: number, owner: string, ability?: Ability) {
    const r = this.raid;
    const before = target.hp;
    super.damage(target, amount, owner, ability);
    // Six hits in a row on the real one expose it, and the copies vanish.
    // Only while there are copies to tell it apart from: that's the puzzle.
    if (!target.raidBoss || target.hp >= before || r.drill || !r.decoys?.length) return;
    if (this.time - (this.lastHitAt.get(owner) ?? -9) < STREAK_GAP) return;
    this.lastHitAt.set(owner, this.time);
    if (r.exposedUntil > this.time) return;
    r.streak = (r.streak ?? 0) + 1;
    if (r.streak >= G.exposeHits) {
      r.streak = 0;
      r.decoys = [];
      r.exposedUntil = this.time + G.exposeSeconds;
      r.stagger = Math.min(100, r.stagger + 20);
      this.exposedByStreak = true;
      r.message = "Found it! The copies vanish. Strike the core!";
    }
  }
  override cast(p: Fighter, a: Ability, ex = false) {
    super.cast(p, a, ex);
    if (p.raidBoss) return;
    const r = this.raid,
      boss = this.boss();
    const aim = { x: p.lastInput.aimX, y: p.lastInput.aimY };
    // Voltkit's Ball Lightning lights its landing spot.
    if (a.id === "ball-lightning") {
      const d = normalize(aim.x - p.x || 1, aim.y - p.y),
        reach = Math.min(Math.hypot(aim.x - p.x, aim.y - p.y), 600);
      r.lights = [...(r.lights ?? []), { x: p.x + d.x * reach, y: p.y + d.y * reach, radius: 160, until: this.time + G.sparkLight }];
    }
    // Lumoth's Radiant Flare relights lanterns and cleanses curses nearby.
    if (a.id === "radiant-flare") {
      for (const l of r.lanterns ?? []) if (!l.lit && Math.hypot(l.x - p.x, l.y - p.y) < 240) this.relight(l, p);
      for (const q of this.heroes()) if (q.hp > 0 && Math.hypot(q.x - p.x, q.y - p.y) < 240) this.cleanse(q);
    }
    if (!boss) return;
    // Mystowl's Focus Ray passes through copies and marks the real one.
    if (a.id === "focus-ray") {
      const aimAngle = Math.atan2(aim.y - p.y, aim.x - p.x),
        toBoss = Math.atan2(boss.y - p.y, boss.x - p.x);
      const off = Math.abs(Math.atan2(Math.sin(aimAngle - toBoss), Math.cos(aimAngle - toBoss)));
      if (off < 0.25 && Math.hypot(boss.x - p.x, boss.y - p.y) < 900) {
        r.revealUntil = Math.max(r.revealUntil ?? 0, this.time + G.revealRay);
        r.message = `${p.name}'s Focus Ray marks the real Gloomshade!`;
      }
    }
    // Duskveil's Curse Mark on the real one reveals it.
    if (a.id === "curse-mark" && Math.hypot(aim.x - boss.x, aim.y - boss.y) < 160) {
      r.revealUntil = Math.max(r.revealUntil ?? 0, this.time + G.revealMark);
      r.message = `${p.name}'s Curse Mark reveals the real Gloomshade!`;
    }
  }

  // ------------------------------------------------------------- Stand-ins
  protected override botHint(bot: Fighter, input: Input, go: (x: number, y: number, away: boolean) => Input) {
    const r = this.raid,
      boss = this.boss();
    // Grasping Hands: step onto a lit tile.
    const hands = r.warnings.find((w) => w.kind === "hands");
    if (hands) {
      const parity = hands.shiftAt !== undefined ? 1 - (hands.parity ?? 0) : (hands.parity ?? 0);
      const showing = hands.shiftAt !== undefined && this.time < hands.shiftAt ? (hands.parity ?? 0) : parity;
      if (handsTileDark(bot.x, bot.y, showing)) {
        const { cols, rows } = G.hands;
        const tw = 1600 / cols,
          th = 900 / rows;
        let best = { x: bot.x, y: bot.y, d: Infinity };
        for (let c = 0; c < cols; c++)
          for (let rr = 0; rr < rows; rr++) {
            const x = (c + 0.5) * tw,
              y = (rr + 0.5) * th;
            if (handsTileDark(x, y, showing)) continue;
            const d = Math.hypot(x - bot.x, y - bot.y);
            if (d < best.d) best = { x, y, d };
          }
        return go(best.x, best.y, false);
      }
    }
    const lunge = r.warnings.find((w) => w.kind === "lunge");
    if (lunge && segmentDistance(bot.x, bot.y, lunge.x, lunge.y, lunge.tx, lunge.ty) < lunge.radius + RULES.radius + 25) {
      const d = normalize(lunge.tx - lunge.x, lunge.ty - lunge.y);
      return go(bot.x - d.y * 120, bot.y + d.x * 120, false);
    }
    const pulse = r.warnings.find((w) => w.kind === "pulse");
    if (pulse && boss && Math.hypot(bot.x - boss.x, bot.y - boss.y) < pulse.radius + RULES.radius + 20) {
      if (pulse.at - this.time < 0.3) input.jump = true;
      else return go(boss.x, boss.y, true);
    }
    // Cursed: find lantern light. Otherwise keep away from cursed friends.
    const mine = r.curses?.[bot.id];
    const lanternTo = (filter: (l: { lit: boolean }) => boolean) =>
      (r.lanterns ?? []).filter(filter).sort((a, b) => Math.hypot(a.x - bot.x, a.y - bot.y) - Math.hypot(b.x - bot.x, b.y - bot.y))[0];
    if (mine && (mine.stacks > 0 || mine.hauntedUntil > this.time)) {
      const l = lanternTo((x) => x.lit);
      if (l && Math.hypot(l.x - bot.x, l.y - bot.y) > lanternRadius(r.trait) * 0.5) return go(l.x, l.y, false);
      if (l) {
        input.dx = input.dy = 0;
        return input;
      }
    }
    const cursedFriend = this.heroes().find(
      (p) => p !== bot && p.hp > 0 && (r.curses?.[p.id]?.stacks ?? 0) > 0 && Math.hypot(p.x - bot.x, p.y - bot.y) < G.curse.radius + 40,
    );
    if (cursedFriend) return go(cursedFriend.x, cursedFriend.y, true);
    // Relight a dark lantern.
    const dark = lanternTo((x) => !x.lit);
    if (dark && !r.warnings.length) {
      input.aimX = dark.x;
      input.aimY = dark.y;
      if (Math.hypot(dark.x - bot.x, dark.y - bot.y) > 100) return go(dark.x, dark.y, false);
      input.basic = Math.floor(this.time * 4) % 2 === 0;
      input.dx = input.dy = 0;
      return input;
    }
    return undefined;
  }
}
