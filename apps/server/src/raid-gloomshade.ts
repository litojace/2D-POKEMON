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
  riteValue,
} from "../../../packages/shared/src/raid.js";
import {
  RaidArena,
  type RaidBossNumbers,
  type RaidReaction,
  type RaidSituation,
} from "./raid.js";

const G = GLOOMSHADE;
/** Hits on the real Gloomshade from one raider count at most this often. */
const STREAK_GAP = 0.2;

/** Distance from a point to a segment. */
function segmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
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
  /** Live raids: each copy picks its next spot on its own clock. */
  private driftAts: number[] = [];
  /** The last hit that counted towards the streak. */
  private streakAt = -99;
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
    r.lanterns = G.lanterns.map((l) => ({
      x: l.x,
      y: l.y,
      lit: true,
      hits: 0,
    }));
    r.decoys = [];
    r.curses = {};
    r.lights = [];
    r.revealUntil = 0;
    r.streak = 0;
    this.targets = [];
    this.driftAt = 0;
    this.driftAts = [];
    this.streakAt = -99;
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
  /** Shadopus hidden in its Ink Cloud: Gloomshade has lost track of it. */
  private inked(p: Fighter) {
    return p.character === "shadopus" && this.has(p, "stealth");
  }
  /** Attacks never pick a hidden Shadopus (and wait while nobody is seen). */
  protected override chooseTarget(kind: RaidAttack, alive: Fighter[]) {
    const seen = alive.filter((p) => !this.inked(p));
    const pool = seen.length ? seen : alive;
    // Live raids: the curse goes to whoever has the most friends close by,
    // so it spreads unless the party spreads out.
    if (kind === "curse" && this.smart() && pool.length > 1) {
      const crowd = (p: Fighter) =>
        pool.filter(
          (q) => q !== p && Math.hypot(q.x - p.x, q.y - p.y) < G.curse.radius,
        ).length;
      const best = [...pool].sort((a, b) => crowd(b) - crowd(a))[0];
      if (crowd(best) > 0) return best;
    }
    return super.chooseTarget(kind, pool);
  }
  /** Live raids: against a party of 3+ the night moves faster. */
  protected override cadence() {
    const r = this.raid;
    return (
      super.cadence() *
      (this.smart() && r.partySize >= G.split.partyCopy ? G.party.cadence : 1)
    );
  }
  /** Gloomshade pulses when raiders crowd the real one. */
  protected override reactions(s: RaidSituation): RaidReaction[] {
    const near = s.alive.filter(
      (p) => Math.hypot(p.x - s.boss.x, p.y - s.boss.y) < G.pulse.radius,
    ).length;
    return near >= 2 ? [{ kind: "pulse", score: 1 + 0.15 * near }] : [];
  }
  protected override onMechanic(p: Fighter) {
    return this.lit(p.x, p.y);
  }
  /** Live raids: in a party, a lunge also goes at a second raider. */
  protected override pressured(kind: RaidAttack, alive: Fighter[]) {
    return (
      super.pressured(kind, alive) ||
      (kind === "lunge" && this.smart() && alive.length >= 3)
    );
  }
  protected override canStartAttack() {
    return (
      super.canStartAttack() &&
      (!!this.raid.drill ||
        this.heroes().some((p) => p.hp > 0 && !this.inked(p)))
    );
  }
  override feat() {
    return (
      this.raid.result === "victory" && this.splits > 0 && this.decoyHits === 0
    );
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
      (r.lanterns ?? []).some(
        (l) => l.lit && Math.hypot(x - l.x, y - l.y) < lanternRadius(r.trait),
      ) ||
      (r.lights ?? []).some(
        (l) => l.until > this.time && Math.hypot(x - l.x, y - l.y) < l.radius,
      )
    );
  }
  /** Gloomshade and its copies (the real one first). */
  private copies() {
    const boss = this.boss();
    return [
      ...(boss ? [{ x: boss.x, y: boss.y }] : []),
      ...(this.raid.decoys ?? []),
    ];
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
    if (this.smart() && r.partySize >= G.split.partyCopy) n++;
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
    r.decoys = spots
      .slice(1)
      .map((s) => ({ id: ++this.serial, x: s.x, y: s.y }));
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
        ...(r.lanterns ?? [])
          .filter((l) => !l.lit)
          .map((l) => ({ x: l.x, y: l.y })),
      ];
      const sorted = shadows.sort(
        (a, b) =>
          Math.hypot(a.x - target.x, a.y - target.y) -
          Math.hypot(b.x - target.x, b.y - target.y),
      );
      // Chapter 2+ (live raids): a cross-lunge, the second lane from the
      // next-nearest shadow half a second later, so the lanes form an X.
      const cross = this.smart() && r.phase >= 2 && sorted.length > 1 && !teach;
      sorted.slice(0, cross ? 2 : 1).forEach((from, k) => {
        const d = normalize(target.x - from.x || 1, target.y - from.y);
        const delay = G.lunge.delay + k * G.lunge.cross;
        Object.assign(
          this.warn(
            "lunge",
            from.x,
            from.y,
            from.x + d.x * G.lunge.length,
            from.y + d.y * G.lunge.length,
            G.lunge.width,
            delay,
          ),
          {
            targetId: target.id,
            // Live raids freeze the lane a little earlier (0.65 s), so a
            // lane led ahead of a runner can still be sidestepped.
            lockAt:
              this.time +
              G.lunge.delay * 0.5 +
              k * G.lunge.cross -
              (this.smart() ? 0.05 : 0),
            teach,
          },
        );
      });
      // Live raids, a party of three or more: up to two copies lunge too,
      // each from its own body at the raider nearest it (drawn the same
      // way; only the real one casts a shadow, so the tell stays).
      const alive = this.heroes().filter((p) => p.hp > 0);
      if (this.smart() && alive.length >= G.split.partyCopy && !teach) {
        const used = sorted.slice(0, cross ? 2 : 1);
        (r.decoys ?? [])
          .filter((d) => !used.some((u) => u.x === d.x && u.y === d.y))
          .slice(0, G.lunge.copies)
          .forEach((from, k) => {
            const prey = [...alive].sort(
              (a, b) =>
                Math.hypot(a.x - from.x, a.y - from.y) -
                Math.hypot(b.x - from.x, b.y - from.y),
            )[0];
            const d = normalize(prey.x - from.x || 1, prey.y - from.y);
            const delay = G.lunge.delay + (k + 1) * G.lunge.copyGap;
            Object.assign(
              this.warn(
                "lunge",
                from.x,
                from.y,
                from.x + d.x * G.lunge.length,
                from.y + d.y * G.lunge.length,
                G.lunge.width,
                delay,
              ),
              { targetId: prey.id, lockAt: this.time + delay - 0.65, teach },
            );
          });
      }
    } else if (kind === "hands") {
      // Live raids darken the tiles most raiders stand on (after the flip,
      // if it flips); from chapter 2 it always flips.
      const flips = this.smart()
        ? r.phase >= 2 || !teach
        : r.peril >= 2 && !teach;
      let parity = (r.seed + this.attacks) % 2;
      if (this.smart()) {
        const alive = this.heroes().filter((p) => p.hp > 0);
        const under = (q: number) =>
          alive.filter((p) => handsTileDark(p.x, p.y, q)).length;
        const dark = under(1) > under(0) ? 1 : under(0) > under(1) ? 0 : parity;
        parity = flips ? 1 - dark : dark;
      }
      Object.assign(this.warn("hands", 800, 450, 800, 450, 0, G.hands.delay), {
        parity,
        ...(flips ? { shiftAt: this.time + G.hands.shiftAt } : {}),
        teach,
      });
    } else if (kind === "snuff") {
      const lit = (r.lanterns ?? [])
        .map((l, i) => ({ l, i }))
        .filter((x) => x.l.lit);
      if (!lit.length) return this.startAttack("lunge", target);
      // The lantern nearest the raider being watched goes out. Live raids
      // pick the one a cursed raider needs, else the one most raiders use.
      const dist = (l: { x: number; y: number }, p: { x: number; y: number }) =>
        Math.hypot(l.x - p.x, l.y - p.y);
      const cursed = this.heroes().find(
        (p) => p.hp > 0 && (r.curses?.[p.id]?.stacks ?? 0) > 0,
      );
      const users = (l: { x: number; y: number }) =>
        this.heroes().filter(
          (p) => p.hp > 0 && dist(l, p) < lanternRadius(r.trait),
        ).length;
      const { l, i } = lit.sort((a, b) =>
        this.smart() && cursed
          ? dist(a.l, cursed) - dist(b.l, cursed)
          : this.smart() && users(a.l) !== users(b.l)
            ? users(b.l) - users(a.l)
            : dist(a.l, target) - dist(b.l, target),
      )[0];
      Object.assign(
        this.warn(
          "snuff",
          l.x,
          l.y,
          l.x,
          l.y,
          lanternRadius(r.trait),
          r.phase >= 3 ? G.snuff.finalDelay : G.snuff.delay,
        ),
        {
          lantern: i,
          teach,
        },
      );
    } else if (kind === "curse") {
      Object.assign(
        this.warn(
          "curse",
          target.x,
          target.y,
          target.x,
          target.y,
          G.curse.radius,
          1,
        ),
        {
          targetId: target.id,
          lockAt: this.time + 1,
          teach,
        },
      );
    } else if (kind === "split") {
      this.warn(
        "split",
        boss.x,
        boss.y,
        boss.x,
        boss.y,
        120,
        G.split.delay,
      ).teach = teach;
    } else if (kind === "pulse") {
      this.warn(
        "pulse",
        boss.x,
        boss.y,
        boss.x,
        boss.y,
        G.pulse.radius,
        G.pulse.delay,
      ).teach = teach;
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
    const ability: Ability = {
      ...CHARACTERS.duskveil.skills[3],
      ground: false,
      knockback: 0,
    };
    if (w.kind === "lunge") {
      this.hitBy = "lunge";
      for (const p of this.heroes())
        if (
          p.hp > 0 &&
          segmentDistance(p.x, p.y, w.x, w.y, w.tx, w.ty) <
            w.radius + RULES.radius
        )
          this.damage(p, G.lunge.damage, boss.id, ability);
      this.hitBy = undefined;
      this.countDodges();
      return;
    }
    if (w.kind === "hands") {
      const parity =
        w.shiftAt !== undefined ? 1 - (w.parity ?? 0) : (w.parity ?? 0);
      this.hitBy = "hands";
      for (const p of this.heroes())
        if (p.hp > 0 && handsTileDark(p.x, p.y, parity))
          this.damage(p, G.hands.damage, boss.id, ability);
      this.hitBy = undefined;
      this.countDodges();
      this.event(
        "raid-impact",
        { x: 800, y: 450 },
        0x5a3a9a,
        undefined,
        boss.id,
      );
      this.events[this.events.length - 1].raidRadius = 0;
      return;
    }
    if (w.kind === "snuff") {
      const l = r.lanterns?.[w.lantern ?? -1];
      if (l) {
        // Live raids: the light bursts as it dies, hurting everyone in it.
        if (this.smart()) {
          this.hitBy = "snuff";
          for (const p of this.heroes())
            if (
              p.hp > 0 &&
              Math.hypot(p.x - l.x, p.y - l.y) < w.radius + RULES.radius
            )
              this.damage(p, G.snuff.damage, boss.id, ability);
          this.hitBy = undefined;
          this.countDodges();
        }
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
        r.message =
          r.partySize > 1
            ? `${p.name} is cursed! Spread out, and find lantern light.`
            : "Cursed! Keep moving and find lantern light.";
      }
      return;
    }
    if (w.kind === "split") return this.split();
    if (w.kind === "pulse") {
      this.hitBy = "pulse";
      for (const p of this.heroes())
        if (
          p.hp > 0 &&
          p.jumpUntil <= this.time &&
          Math.hypot(p.x - boss.x, p.y - boss.y) < w.radius + RULES.radius
        )
          this.damage(p, G.pulse.damage, boss.id, { ...ability, ground: true });
      this.hitBy = undefined;
      this.countDodges();
      // The real ring gives it away for a moment.
      r.revealUntil = Math.max(r.revealUntil ?? 0, this.time + 1.5);
      this.event("raid-impact", boss, 0xb88aff, undefined, boss.id);
      this.events[this.events.length - 1].raidRadius = w.radius;
      // Witching Hour: pulses come in pairs.
      if (r.phase >= 3 && !w.followUp && !r.drill) {
        // Live raids space the pair by the jump cooldown: both can be jumped.
        const gap = this.smart() ? RULES.jumpCooldown + 0.3 : G.pulse.pairGap;
        Object.assign(
          this.warn(
            "pulse",
            boss.x,
            boss.y,
            boss.x,
            boss.y,
            G.pulse.radius,
            gap,
          ),
          { followUp: true },
        );
        this.nextAttack = Math.max(
          this.nextAttack,
          this.time + gap + (this.smart() ? 1.2 : 2.5),
        );
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
    if (
      this.splitWhenCovered &&
      r.exposedUntil <= this.time &&
      !r.warnings.length
    ) {
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
    // Pyranda's Chestnut Mortar relights a dark lantern it lands on.
    for (const z of this.heroZones("chestnut-mortar"))
      for (const l of r.lanterns ?? [])
        if (!l.lit && Math.hypot(l.x - z.x, l.y - z.y) < z.radius + 36)
          this.relight(
            l,
            this.heroes().find((p) => p.id === z.owner),
          );
    // Sunbara's springs wash curses off the allies inside them.
    for (const p of this.heroes())
      if (p.hp > 0 && this.inSpring(p, "warm-spring", "sanctuary"))
        this.cleanse(p);
    // Lamplighter: lantern light heals 1% a second (more in later chapters).
    for (const p of this.heroes())
      if (p.hp > 0 && this.hasRite(p, "lamplighter") && this.lit(p.x, p.y)) {
        const max = CHARACTERS[p.character].health;
        p.hp = Math.min(
          max,
          p.hp + max * riteValue("lamplighter", this.raid.phase) * dt,
        );
      }
  }
  /**
   * Gloomshade and its copies drift between spots. Peril 1-2: all at once;
   * live raids: each body on its own clock, so they never move as one.
   */
  private drift(dt: number, boss: Fighter) {
    const r = this.raid;
    const copies = 1 + (r.decoys?.length ?? 0);
    if (this.smart() && this.targets.length === copies) {
      if (this.driftAts.length !== copies)
        this.driftAts = Array.from(
          { length: copies },
          (_, i) => this.time + G.driftEvery * (0.5 + i / copies),
        );
      for (let i = 0; i < copies; i++) {
        if (this.time < this.driftAts[i]) continue;
        const taken = this.targets.filter((_, j) => j !== i);
        const free = G.spots.filter(
          (s) => !taken.some((t) => t.x === s.x && t.y === s.y),
        );
        const pick = this.pickSpots(G.spots.length).find((s) =>
          free.some((f) => f.x === s.x && f.y === s.y),
        );
        if (pick) this.targets[i] = { ...pick };
        this.driftAts[i] =
          this.time +
          G.driftEvery *
            (0.8 + 0.4 * ((i * 0.37 + this.serialDrift * 0.13) % 1));
      }
    } else if (this.time >= this.driftAt || this.targets.length !== copies) {
      this.targets = this.pickSpots(copies);
      this.driftAt = this.time + G.driftEvery;
      this.driftAts = [];
    }
    const step = (
      body: { x: number; y: number },
      to: { x: number; y: number },
    ) => {
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
    const shots = this.projectiles.filter(
      (pr) => pr.owner !== boss.id && !this.countedShots.has(pr.id),
    );
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
      const shot = shots.find(
        (pr) =>
          Math.hypot(pr.x - d.x, pr.y - d.y) < 50 + (pr.ability.radius ?? 10),
      );
      const zone = this.zones.find(
        (z) =>
          z.owner !== boss.id &&
          Math.hypot(z.x - d.x, z.y - d.y) < z.radius + 40,
      );
      const swing = swings.find((p) => swingAt(p, d.x, d.y, 170));
      const by = heroes.find(
        (p) => p.id === (shot?.owner ?? zone?.owner ?? swing?.id),
      );
      if (!by) continue;
      if (shot) this.countedShots.add(shot.id);
      this.popDecoy(i, by);
    }
    for (const l of r.lanterns ?? []) {
      if (l.lit) continue;
      const shot = shots.find(
        (pr) =>
          !this.countedShots.has(pr.id) &&
          Math.hypot(pr.x - l.x, pr.y - l.y) < 36 + (pr.ability.radius ?? 10),
      );
      const swing = swings.find((p) => swingAt(p, l.x, l.y, 140));
      const by = heroes.find((p) => p.id === (shot?.owner ?? swing?.id));
      if (!by) continue;
      if (shot) this.countedShots.add(shot.id);
      l.hits++;
      if (l.hits >= (this.hasRite(by, "lamplighter") ? 1 : G.relightHits))
        this.relight(l, by);
    }
    if (this.countedShots.size > 400) this.countedShots.clear();
  }
  private relight(
    l: { x: number; y: number; lit: boolean; hits: number },
    by?: Fighter,
  ) {
    const r = this.raid;
    if (l.lit) return;
    l.lit = true;
    l.hits = 0;
    this.event("heal", l, 0xffd65b, 0, by?.id);
    if (by && !r.drill && r.contributions?.[by.id])
      r.contributions[by.id].pillars++;
  }
  private stepCurses(dt: number, boss: Fighter) {
    const r = this.raid;
    const heroes = this.heroes().filter((p) => p.hp > 0);
    const curses = (r.curses ??= {});
    const spread =
      r.trait === "restless-spirits"
        ? G.curse.restlessSpread
        : this.smart() && r.partySize >= G.split.partyCopy
          ? G.curse.partySpread
          : G.curse.spreadSeconds;
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
        } else if (c.hauntedUntil && c.hauntedUntil <= this.time)
          delete curses[p.id];
        else if (
          this.smart() &&
          r.partySize >= G.split.partyCopy &&
          c.stacks > 0
        ) {
          // Live raids, a party: the curse creeps before it haunts.
          this.hitBy = "curse";
          this.damage(p, G.curse.creep * c.stacks * dt, boss.id);
          this.hitBy = undefined;
        }
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
          (p) =>
            p !== q &&
            (curses[p.id]?.stacks ?? 0) > 0 &&
            Math.hypot(p.x - q.x, p.y - q.y) < G.curse.radius,
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
  override damage(
    target: Fighter,
    amount: number,
    owner: string,
    ability?: Ability,
  ) {
    const r = this.raid;
    const before = target.hp;
    super.damage(target, amount, owner, ability);
    // Wombolder's Landslide shakes off every copy.
    if (
      target.raidBoss &&
      ability?.id === "landslide" &&
      r.decoys?.length &&
      !r.drill
    ) {
      r.decoys = [];
      r.streak = 0;
      r.message = "The ground erupts! Every copy is shaken off.";
    }
    // Six hits in a row on the real one expose it, and the copies vanish.
    // Only while there are copies to tell it apart from: that's the puzzle.
    if (!target.raidBoss || target.hp >= before || r.drill || !r.decoys?.length)
      return;
    if (this.time - (this.lastHitAt.get(owner) ?? -9) < STREAK_GAP) return;
    this.lastHitAt.set(owner, this.time);
    if (r.exposedUntil > this.time) return;
    // Live raids: the streak breaks after a second without a hit.
    if (this.smart() && this.time - this.streakAt > G.streakGap) r.streak = 0;
    this.streakAt = this.time;
    r.streak = (r.streak ?? 0) + 1;
    if (r.streak >= G.exposeHits) {
      r.streak = 0;
      r.decoys = [];
      // Live raids: a party (3+) finds it faster, so its window is shorter.
      r.exposedUntil =
        this.time +
        (this.smart()
          ? this.window(G.exposeSeconds) *
            (r.partySize >= G.split.partyCopy ? G.party.expose : 1)
          : G.exposeSeconds);
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
      r.lights = [
        ...(r.lights ?? []),
        {
          x: p.x + d.x * reach,
          y: p.y + d.y * reach,
          radius: 160,
          until: this.time + G.sparkLight,
        },
      ];
    }
    // Lumoth's Radiant Flare relights lanterns and cleanses curses nearby.
    if (a.id === "radiant-flare") {
      for (const l of r.lanterns ?? [])
        if (!l.lit && Math.hypot(l.x - p.x, l.y - p.y) < 240)
          this.relight(l, p);
      for (const q of this.heroes())
        if (q.hp > 0 && Math.hypot(q.x - p.x, q.y - p.y) < 240) this.cleanse(q);
    }
    if (!boss) return;
    // Mystowl's Third-Eye Ray passes through copies and marks the real one.
    if (a.id === "third-eye-ray") {
      const aimAngle = Math.atan2(aim.y - p.y, aim.x - p.x),
        toBoss = Math.atan2(boss.y - p.y, boss.x - p.x);
      const off = Math.abs(
        Math.atan2(Math.sin(aimAngle - toBoss), Math.cos(aimAngle - toBoss)),
      );
      if (off < 0.25 && Math.hypot(boss.x - p.x, boss.y - p.y) < 900) {
        r.revealUntil = Math.max(r.revealUntil ?? 0, this.time + G.revealRay);
        r.message = `${p.name}'s Third-Eye Ray marks the real Gloomshade!`;
      }
    }
    // Duskveil's Haunted Lantern hung by the real one lights it up.
    if (
      a.id === "haunted-lantern" &&
      Math.hypot(aim.x - boss.x, aim.y - boss.y) < 160
    ) {
      r.revealUntil = Math.max(r.revealUntil ?? 0, this.time + G.revealMark);
      r.message = `${p.name}'s Haunted Lantern reveals the real Gloomshade!`;
    }
  }

  // ------------------------------------------------------------- Stand-ins
  protected override botHint(
    bot: Fighter,
    input: Input,
    go: (x: number, y: number, away: boolean) => Input,
  ) {
    const r = this.raid,
      boss = this.boss();
    // Grasping Hands: step onto a lit tile.
    const hands = r.warnings.find((w) => w.kind === "hands");
    if (hands) {
      const parity =
        hands.shiftAt !== undefined
          ? 1 - (hands.parity ?? 0)
          : (hands.parity ?? 0);
      // A board that will flip (it flickers): head for the tiles that will
      // be lit when the hands close (Peril 1-2 stand-ins read the board as shown).
      const showing =
        hands.shiftAt !== undefined &&
        this.time < hands.shiftAt &&
        !this.smart()
          ? (hands.parity ?? 0)
          : parity;
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
      // On a safe tile: keep clear of its edges until the hands close
      // (Peril 1-2 stand-ins carry on as before).
      if (this.smart()) {
        const tw = 1600 / G.hands.cols,
          th = 900 / G.hands.rows;
        const cx = (Math.floor(bot.x / tw) + 0.5) * tw,
          cy = (Math.floor(bot.y / th) + 0.5) * th;
        if (
          Math.abs(bot.x - cx) > tw / 2 - 40 ||
          Math.abs(bot.y - cy) > th / 2 - 40
        )
          return go(cx, cy, false);
        input.dx = input.dy = 0;
        return input;
      }
    }
    const lunge = r.warnings.find((w) => w.kind === "lunge");
    if (
      lunge &&
      segmentDistance(bot.x, bot.y, lunge.x, lunge.y, lunge.tx, lunge.ty) <
        lunge.radius + RULES.radius + 25
    ) {
      const d = normalize(lunge.tx - lunge.x, lunge.ty - lunge.y);
      return go(bot.x - d.y * 120, bot.y + d.x * 120, false);
    }
    const pulse = r.warnings.find((w) => w.kind === "pulse");
    if (
      pulse &&
      boss &&
      Math.hypot(bot.x - boss.x, bot.y - boss.y) <
        pulse.radius + RULES.radius + 20
    ) {
      if (pulse.at - this.time < 0.3) input.jump = true;
      else return go(boss.x, boss.y, true);
    }
    // Cursed: find lantern light. Otherwise keep away from cursed friends.
    const mine = r.curses?.[bot.id];
    const lanternTo = (filter: (l: { lit: boolean }) => boolean) =>
      (r.lanterns ?? [])
        .filter(filter)
        .sort(
          (a, b) =>
            Math.hypot(a.x - bot.x, a.y - bot.y) -
            Math.hypot(b.x - bot.x, b.y - bot.y),
        )[0];
    if (mine && (mine.stacks > 0 || mine.hauntedUntil > this.time)) {
      const l = lanternTo((x) => x.lit);
      if (
        l &&
        Math.hypot(l.x - bot.x, l.y - bot.y) > lanternRadius(r.trait) * 0.5
      )
        return go(l.x, l.y, false);
      if (l) {
        input.dx = input.dy = 0;
        return input;
      }
    }
    const cursedFriend = this.heroes().find(
      (p) =>
        p !== bot &&
        p.hp > 0 &&
        (r.curses?.[p.id]?.stacks ?? 0) > 0 &&
        Math.hypot(p.x - bot.x, p.y - bot.y) < G.curse.radius + 40,
    );
    if (cursedFriend) return go(cursedFriend.x, cursedFriend.y, true);
    // Relight a dark lantern.
    const dark = lanternTo((x) => !x.lit);
    if (dark && !r.warnings.length) {
      input.aimX = dark.x;
      input.aimY = dark.y;
      if (Math.hypot(dark.x - bot.x, dark.y - bot.y) > 100)
        return go(dark.x, dark.y, false);
      input.basic = Math.floor(this.time * 4) % 2 === 0;
      input.dx = input.dy = 0;
      return input;
    }
    return this.guessCopy(bot, input, go);
  }
  /** Each stand-in's guess at the real Gloomshade: a body index, until when. */
  private guesses = new Map<string, { index: number; until: number }>();
  /**
   * The engine tells a bot which body is the real one; a player can't.
   * Live raids keep stand-ins honest: while copies are out they only know
   * the real one when it is revealed or casts a shadow in lantern light;
   * otherwise they pick a body and hit it (a copy pops and curses them).
   */
  private guessCopy(
    bot: Fighter,
    input: Input,
    go: (x: number, y: number, away: boolean) => Input,
  ) {
    const r = this.raid,
      boss = this.boss();
    const decoys = r.decoys ?? [];
    if (!this.smart() || !boss || !decoys.length) return undefined;
    if ((r.revealUntil ?? 0) > this.time || this.lit(boss.x, boss.y)) {
      this.guesses.delete(bot.id);
      return undefined;
    }
    const bodies = this.copies();
    let guess = this.guesses.get(bot.id);
    if (!guess || guess.until <= this.time || guess.index >= bodies.length) {
      const roll = Math.floor(
        ((this.time * 7.31 + bot.id.length * 3.7 + decoys.length) % 1) *
          bodies.length *
          0.999,
      );
      guess = { index: roll, until: this.time + 3 };
      this.guesses.set(bot.id, guess);
    }
    if (guess.index === 0) return undefined;
    const body = bodies[guess.index];
    input.aimX = body.x;
    input.aimY = body.y;
    const d = Math.hypot(body.x - bot.x, body.y - bot.y);
    if (d > 140) {
      go(body.x, body.y, false);
      input.basic = d < 420;
      return input;
    }
    input.dx = input.dy = 0;
    input.basic = true;
    return input;
  }
}
