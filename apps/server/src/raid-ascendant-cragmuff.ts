/**
 * Ascendant Cragmuff: the evolved ram on the Spire's tenth floor
 * (docs/spire: "Ascendant bosses"). The raid's Cragmuff, pushed further
 * through the same warning, deck and honesty machinery:
 *
 * - New moves: the Avalanche Charge (a charge that leaves a magma fissure
 *   along its lane) and the Twin Slam (a ring round the boss, then a second
 *   ring toward its target, apart from the first and landing later).
 * - Combos: a second slam from chapter 1, volleys into eruptions from
 *   chapter 2, Twin Slams into debris in chapter 3, one more eruption.
 * - Fewer openings: the Ascendant tier's windows (pillar exposure and
 *   stagger), a shorter pause after a pillar, no bonus on chapter 3's
 *   cracked core.
 * - Reads: eruptions and debris aimed where a raider habitually dodges,
 *   a stomp or eruption for a raider standing still to attack, feints (a
 *   slam that turns, halfway, into a volley or an eruption, each shown in
 *   full) and the raider kneeling to revive as the first target.
 *
 * The rules are a layer (`AscendantCragmuffRules`) over a raid arena, on
 * while the raid is Cragmuff's Ascendant form (`isAscendant`) and the raid's
 * own hooks otherwise.
 * `AscendantCragmuffArena` is that layer always on: createRaidArena(code,
 * "grumblecrag", { variant: "ascendant" }) (server code only: clients can't
 * ask for a variant). The Spire's arena carries the same layer and turns it
 * on for its boss floor (spire.ts), so the climb's room, players and
 * blessings stay as they are.
 */
import { RaidArena, raidJitter } from "./raid.js";
import {
  CHARACTERS,
  RULES,
  normalize,
  type Fighter,
  type Input,
} from "../../../packages/shared/src/index.js";
import {
  ASCENDANT_CRAGMUFF as A,
  GRUMBLECRAG as BOSS,
  RAID,
  RAID_TRAITS,
  isAscendant,
  type RaidAttack,
  type RaidWarning,
} from "../../../packages/shared/src/raid.js";
import {
  raidShapeHits,
  raidShapeOf,
  type RaidReaction,
  type RaidSituation,
} from "./raid-ai.js";

type Point = { x: number; y: number };
const clampX = (x: number, pad = 60) =>
  Math.max(pad, Math.min(RULES.width - pad, x));
const clampY = (y: number, pad = 60) =>
  Math.max(pad, Math.min(RULES.height - pad, y));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RaidClass = new (...args: any[]) => RaidArena;

/** Ascendant Cragmuff's rules over `Base`, on while `raid.variant` is "ascendant". */
export function AscendantCragmuffRules<B extends RaidClass>(Base: B) {
  return class AscendantCragmuffRules extends Base {
    /** How often each read was played this run (tests and balance logs). */
    reads = { feints: 0, habits: 0, anchors: 0, revivers: 0 };
    /** Each raider's dodges: a decaying sum of directions and of weights. */
    protected habits = new Map<
      string,
      { x: number; y: number; weight: number; n: number }
    >();
    /** Raiders standing in a warning when it appeared, and where they stood. */
    protected dodging = new Map<RaidWarning, Map<string, Point>>();
    protected watched = new WeakSet<RaidWarning>();
    /** When each raider stopped moving, and last hit the boss. */
    protected stillSince = new Map<string, number>();
    protected hitAt = new Map<string, number>();
    /** Slams that will turn into another attack, and when. */
    protected feints = new Map<RaidWarning, number>();
    /** The Avalanche Charge in motion: where it set off. */
    protected avalanche?: { from: Point; run: object };

    /** Are the Ascendant's rules on? (Off: every hook is the raid's own.) */
    protected ascendant() {
      return isAscendant(this.raid, "grumblecrag");
    }
    /** A new fight: forget the last one's reads. */
    protected resetReads() {
      this.reads = { feints: 0, habits: 0, anchors: 0, revivers: 0 };
      this.habits.clear();
      this.dodging.clear();
      this.stillSince.clear();
      this.hitAt.clear();
      this.feints.clear();
      this.avalanche = undefined;
    }

    /**
     * Telegraphs on the Ascendant tier, except the volley's: its cone is wide
     * near the boss, and the slowest champion standing on its axis needs the
     * a little more than the raid's 1.4 s to step out of it
     * (tests/unit/raid-star3-fairness).
     */
    protected override telegraph(kind: RaidAttack, seconds: number) {
      return kind === "volley" && this.ascendant()
        ? Math.max(seconds, A.volleyDelay)
        : super.telegraph(kind, seconds);
    }

    // ------------------------------------------------------------- Openings
    /** Chapter 3's cracked core takes no bonus: only pillars and staggers open it. */
    protected override coreMultiplier(target: Fighter): number {
      const r = this.raid;
      const open = r.exposedUntil > this.time || r.staggerUntil > this.time;
      if (!open && this.alwaysExposed() && this.smart() && this.ascendant())
        return A.crackedCore;
      return super.coreMultiplier(target);
    }

    protected override attacksStep(dt: number) {
      if (!this.ascendant()) return super.attacksStep(dt);
      const r = this.raid;
      this.turnFeints();
      const staggered = r.staggerUntil;
      super.attacksStep(dt);
      // A stagger that started this step: a shorter window (the tier's windows).
      if (r.staggerUntil > staggered && this.smart()) {
        r.staggerUntil = this.time + this.window(RAID.staggerSeconds);
        r.exposedUntil = r.staggerUntil;
        this.nextAttack = r.staggerUntil + 0.4;
      }
      if (r.staggerUntil > this.time) {
        this.avalanche = undefined;
        this.feints.clear();
      }
      this.learnDodges();
    }

    protected override bossStep(dt: number, boss: Fighter) {
      if (!this.ascendant()) return super.bossStep(dt, boss);
      const breaks = this.pillarBreaks,
        next = this.nextAttack,
        run = this.avalanche;
      super.bossStep(dt, boss);
      // Into a pillar: back on its feet sooner than the raid's pause.
      if (
        this.pillarBreaks > breaks &&
        this.smart() &&
        this.nextAttack === this.time + BOSS.pillar.pause
      )
        this.nextAttack = Math.max(next, this.time + A.pillarPause);
      if (run && this.charging !== run.run) {
        this.avalanche = undefined;
        this.leaveFissure(run.from, boss);
      }
    }

    protected override clearAttacks() {
      super.clearAttacks();
      this.avalanche = undefined;
      this.feints.clear();
    }

    // --------------------------------------------------------------- Attacks
    protected override startAttack(kind: RaidAttack, target: Fighter) {
      if (!this.ascendant()) return super.startAttack(kind, target);
      const r = this.raid,
        boss = this.boss()!;
      this.noteRead(kind, target);
      if (kind === "avalanche") {
        const count = this.seenAttacks.get(kind) ?? 0;
        this.seenAttacks.set(kind, count + 1);
        boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
        const d = normalize(target.x - boss.x, target.y - boss.y);
        // Unlike the charge, its lane locks at once (led ahead of a runner
        // where that stays fair): step out of it, then keep off the fissure.
        Object.assign(
          this.warn(
            "avalanche",
            boss.x,
            boss.y,
            Math.max(90, Math.min(1510, boss.x + d.x * 1000)),
            Math.max(90, Math.min(810, boss.y + d.y * 1000)),
            A.avalanche.width,
            A.avalanche.delay,
          ),
          { targetId: target.id, lockAt: this.time, teach: count < 2 },
        );
        return;
      }
      if (kind === "twin-slam") {
        const count = this.seenAttacks.get(kind) ?? 0;
        this.seenAttacks.set(kind, count + 1);
        boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
        this.warnTwinSlam(boss, target, count < 2);
        return;
      }
      const before = new Set(r.warnings);
      super.startAttack(kind, target);
      if (kind === "slam" && this.smart() && this.feintRoll()) {
        const slam = r.warnings.find(
          (w) => w.kind === "slam" && !before.has(w),
        );
        // Only a slam on its own turns (nothing else live to clash with).
        const others = r.warnings.some((w) => before.has(w) && this.harmful(w));
        if (slam && !slam.teach && !others) {
          const start = slam.startedAt ?? this.time;
          this.feints.set(slam, start + (slam.at - start) * A.feint.turnAt);
        }
      }
    }

    /** Ring 1 round the boss, ring 2 toward the target (apart, a moment later). */
    protected warnTwinSlam(boss: Fighter, target: Fighter, teach: boolean) {
      const t = A.twinSlam,
        near = t.radius + (this.raid.trait === "ancient" ? 30 : 0);
      const d = normalize(target.x - boss.x || 1, target.y - boss.y);
      // No raider can stand in both rings: they are a raider's width apart.
      const apart = near + t.farRadius + 2 * RULES.radius + 20;
      const reach = Math.max(
        apart,
        Math.hypot(target.x - boss.x, target.y - boss.y),
      );
      const x = clampX(boss.x + d.x * reach, 70),
        y = clampY(boss.y + d.y * reach, 70);
      Object.assign(
        this.warn("twin-slam", boss.x, boss.y, boss.x, boss.y, near, t.delay),
        { teach, chain: 2 },
      );
      // A wall squeezed ring 2 onto ring 1: it lands a jump cooldown later,
      // so a raider in both can jump each (otherwise RAID_IMPACT_GAP+ apart).
      const squeezed = Math.hypot(x - boss.x, y - boss.y) < apart;
      Object.assign(
        this.warn(
          "twin-slam",
          x,
          y,
          x,
          y,
          t.farRadius,
          t.delay + (squeezed ? RULES.jumpCooldown + 0.3 : t.gap),
        ),
        { teach, chain: 1, targetId: target.id },
      );
    }

    /** The magma line an Avalanche Charge leaves along the lane it ran. */
    protected leaveFissure(from: Point, boss: Fighter) {
      if (Math.hypot(boss.x - from.x, boss.y - from.y) < 40) return;
      Object.assign(
        this.warn(
          "fissure",
          from.x,
          from.y,
          boss.x,
          boss.y,
          A.fissure.width / 2,
          A.fissure.delay,
        ),
        { width: A.fissure.width, followUp: true },
      );
      this.raid.message = "The lane splits — stay off the magma line!";
    }

    protected override resolveWarning(w: RaidWarning, boss: Fighter) {
      if (!this.ascendant()) return super.resolveWarning(w, boss);
      const r = this.raid;
      if (w.kind === "avalanche") {
        this.charging = {
          tx: w.tx,
          ty: w.ty,
          until: this.time + 1.3,
          hit: new Set(),
          targetId: w.targetId,
          // No return run: the fissure is its follow-up.
          back: true,
        };
        this.avalanche = { from: { x: boss.x, y: boss.y }, run: this.charging };
        return;
      }
      if (w.kind === "twin-slam" || w.kind === "fissure") {
        this.hitBy = w.kind;
        const ability = {
          ...CHARACTERS.terradon.skills[3],
          // A ring is jumped; the fissure is walked off.
          ground: w.kind === "twin-slam",
          knockback: 0,
        };
        const damage =
          w.kind === "twin-slam" ? A.twinSlam.damage : A.fissure.damage;
        for (const p of this.heroes())
          if (p.hp > 0 && raidShapeHits(w, p.x, p.y, RULES.radius))
            this.damage(p, damage, boss.id, ability);
        this.hitBy = undefined;
        this.event("raid-impact", w, 0xff7a3a, undefined, boss.id);
        this.events[this.events.length - 1].raidRadius = w.radius;
        // Chapter 3: the last ring calls down debris.
        if (w.kind === "twin-slam" && w.chain === 1 && r.phase === 3) {
          const before = new Set(r.warnings);
          this.warnDebris(false);
          for (const d of r.warnings)
            if (!before.has(d)) Object.assign(d, { followUp: true });
          this.nextAttack = Math.max(this.nextAttack, this.time + 3);
        }
        return;
      }
      super.resolveWarning(w, boss);
      // A second slam from chapter 1 (the raid's from chapter 2).
      if (w.kind === "slam" && r.phase === 1 && !w.followUp && this.smart()) {
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
        this.nextAttack = Math.max(
          this.nextAttack,
          this.time + RULES.jumpCooldown + 2.8,
        );
      }
      // Volleys chain into eruptions from chapter 2 (the raid's in chapter 3).
      if (w.kind === "volley" && r.phase === 2 && this.smart()) {
        const target = this.heroes().find(
          (p) => p.id === w.targetId && p.hp > 0,
        );
        if (target)
          Object.assign(this.warnEruption(target, 2, false), {
            followUp: true,
          });
      }
    }

    // ----------------------------------------------------------------- Feint
    /** Is this slam a feint? A seeded roll per chapter (tests may force it). */
    protected feintRoll() {
      const r = this.raid;
      const chance = A.feint.chance[Math.max(0, Math.min(2, r.phase - 1))];
      return raidJitter(r.seed ^ 0x51ab, this.attacks, 7) < chance;
    }
    /**
     * Halfway through its telegraph a feinting slam turns: raiders who walked
     * out of the ring get a volley at the farthest one, raiders who stayed to
     * jump get an eruption under the nearest. The slam's warning goes away and
     * the new attack is shown in full from that moment (the honesty rules
     * apply to it as to any new attack). If what it would turn into may not
     * overlap what is live, the slam simply lands.
     */
    protected turnFeints() {
      const r = this.raid,
        boss = this.boss();
      for (const [slam, at] of this.feints) {
        if (!r.warnings.includes(slam) || !boss) {
          this.feints.delete(slam);
          continue;
        }
        if (this.time < at) continue;
        this.feints.delete(slam);
        const alive = this.heroes().filter((p) => p.hp > 0);
        if (!alive.length) continue;
        const dist = (p: Fighter) => Math.hypot(p.x - boss.x, p.y - boss.y);
        const out = alive
          .filter((p) => dist(p) > slam.radius + RULES.radius)
          .sort((a, b) => dist(b) - dist(a));
        const inside = alive
          .filter((p) => !out.includes(p))
          .sort((a, b) => dist(a) - dist(b));
        const live = r.warnings.filter((w) => w !== slam && this.harmful(w));
        const free = (kind: RaidAttack) =>
          !live.some((w) => raidShapeOf(w.kind) === raidShapeOf(kind));
        const options: [RaidAttack, Fighter | undefined][] = [
          ["volley", out[0]],
          ["eruption", inside[0] ?? out[0]],
        ];
        const pick = options.find(([kind, p]) => p && free(kind));
        if (!pick) continue;
        const [kind, target] = pick as [RaidAttack, Fighter];
        r.warnings = r.warnings.filter((w) => w !== slam);
        this.currentCast = this.castOf.get(slam) ?? 0;
        const before = new Set(r.warnings);
        boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
        if (kind === "volley") this.warnVolley(target, false);
        else this.warnEruption(target, 1, false);
        const fresh = r.warnings.filter((w) => !before.has(w));
        this.settleWarnings();
        this.spaceOverlap(fresh);
        this.currentCast = 0;
        this.reads.feints++;
        r.message =
          kind === "volley"
            ? "A feint! The slam turns into a volley."
            : "A feint! The slam turns into an eruption.";
      }
    }

    // ------------------------------------------------------------ Habit aim
    /**
     * Watch every raider standing in a fresh warning, and where they went by
     * the time it landed: the boss remembers the direction they dodge.
     */
    protected learnDodges() {
      const r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0);
      for (const w of r.warnings) {
        if (this.watched.has(w)) continue;
        this.watched.add(w);
        if (
          !this.harmful(w) ||
          !["circle", "line", "cone"].includes(raidShapeOf(w.kind))
        )
          continue;
        const inside = new Map<string, Point>();
        for (const p of alive)
          if (raidShapeHits(w, p.x, p.y, RULES.radius))
            inside.set(p.id, { x: p.x, y: p.y });
        if (inside.size) this.dodging.set(w, inside);
      }
      for (const [w, from] of this.dodging) {
        if (r.warnings.includes(w)) continue;
        this.dodging.delete(w);
        for (const [id, start] of from) {
          const p = alive.find((q) => q.id === id);
          if (!p) continue;
          const dx = p.x - start.x,
            dy = p.y - start.y,
            len = Math.hypot(dx, dy);
          if (len < 30) continue;
          const h = this.habits.get(id) ?? { x: 0, y: 0, weight: 0, n: 0 };
          h.x = h.x * 0.6 + dx / len;
          h.y = h.y * 0.6 + dy / len;
          h.weight = h.weight * 0.6 + 1;
          h.n++;
          this.habits.set(id, h);
        }
      }
    }
    /** Remember one dodge of raider `id` (also used by tests). */
    noteDodge(id: string, dx: number, dy: number) {
      const len = Math.hypot(dx, dy) || 1;
      const h = this.habits.get(id) ?? { x: 0, y: 0, weight: 0, n: 0 };
      h.x = h.x * 0.6 + dx / len;
      h.y = h.y * 0.6 + dy / len;
      h.weight = h.weight * 0.6 + 1;
      h.n++;
      this.habits.set(id, h);
    }
    /** The direction a raider usually dodges, once the boss trusts it. */
    habitOf(id: string): Point | undefined {
      const h = this.habits.get(id);
      if (!h || h.n < A.habit.samples) return undefined;
      const len = Math.hypot(h.x, h.y);
      if (len / h.weight < A.habit.consistency) return undefined;
      return { x: h.x / len, y: h.y / len };
    }
    /**
     * A circle at a raider who is not running: shifted toward where they
     * usually dodge (half its radius, so they still stand inside it and the
     * other way out is the short one).
     */
    protected habitAim(p: Fighter, radius: number): Point {
      const h = this.smart() ? this.habitOf(p.id) : undefined;
      if (!h) return { x: p.x, y: p.y };
      this.reads.habits++;
      const k = radius * A.habit.offset;
      return { x: clampX(p.x + h.x * k, 40), y: clampY(p.y + h.y * k, 40) };
    }
    protected override aimFloor(
      kind: RaidAttack,
      target: Fighter,
      radius: number,
      delay: number,
    ) {
      const at = super.aimFloor(kind, target, radius, delay);
      if (!this.ascendant()) return at;
      // Not led (standing, slowing, weaving): read the habit instead.
      if (kind === "eruption" && at.x === target.x && at.y === target.y)
        return this.habitAim(target, radius);
      return at;
    }
    protected override warnDebris(teach: boolean, second = false) {
      if (!this.ascendant()) return super.warnDebris(teach, second);
      const delay = this.telegraph("debris", BOSS.debris.delay);
      for (const p of this.heroes().filter((p) => p.hp > 0)) {
        const at = second
          ? this.lead(p, delay)
          : this.habitAim(p, BOSS.debris.radius);
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

    // ------------------------------------------------------- Other reads
    override damage(
      target: Fighter,
      amount: number,
      owner: string,
      ability?: Parameters<RaidArena["damage"]>[3],
    ) {
      super.damage(target, amount, owner, ability);
      if (target.raidBoss && owner !== target.id && this.ascendant())
        this.hitAt.set(owner, this.time);
    }
    protected override trackMotion() {
      super.trackMotion();
      if (!this.ascendant()) return;
      for (const p of this.heroes()) {
        const still =
          p.hp > 0 && Math.hypot(p.vx ?? 0, p.vy ?? 0) < A.anchor.speed;
        if (!still) this.stillSince.delete(p.id);
        else if (!this.stillSince.has(p.id))
          this.stillSince.set(p.id, this.time);
      }
    }
    /** Standing still while hitting the boss (for the anchor read). */
    anchored(p: Fighter) {
      const since = this.stillSince.get(p.id);
      return (
        since !== undefined &&
        this.time - since >= A.anchor.still &&
        this.time - (this.hitAt.get(p.id) ?? -99) <= A.anchor.hit
      );
    }
    protected reviving(p: Fighter) {
      return this.heroes().some(
        (d) =>
          d.hp <= 0 &&
          !this.raid.downed[d.id]?.self &&
          Math.hypot(d.x - p.x, d.y - p.y) <= RAID.reviveRange,
      );
    }
    protected noteRead(kind: RaidAttack, target: Fighter) {
      if (!this.smart()) return;
      if (this.reviving(target)) this.reads.revivers++;
      else if (
        this.anchored(target) &&
        (kind === "twin-slam" || kind === "eruption")
      )
        this.reads.anchors++;
    }
    /**
     * The raid's reactions (slam the campers, volley a distant party, erupt a
     * stack), plus its own: a stomp or an eruption for a raider standing still
     * to attack, and an eruption under whoever kneels to revive.
     */
    protected override reactions(s: RaidSituation): RaidReaction[] {
      const out = super.reactions(s);
      if (!this.ascendant()) return out;
      for (const p of s.alive)
        if (this.anchored(p)) {
          const melee = Math.hypot(p.x - s.boss.x, p.y - s.boss.y) < 260;
          out.push({
            kind: melee ? "twin-slam" : "eruption",
            score: 1.5,
            target: p,
          });
        }
      for (const p of s.reviving)
        out.push({ kind: "eruption", score: 1.6, target: p });
      return out;
    }
    /** The raider kneeling by a fallen ally comes first, then the raid's own choice. */
    protected override chooseTarget(kind: RaidAttack, alive: Fighter[]) {
      if (
        this.ascendant() &&
        this.smart() &&
        alive.length > 1 &&
        kind !== "share"
      ) {
        const reviver = alive
          .filter((p) => this.reviving(p))
          .sort(
            (a, b) =>
              (this.threat.get(b.id) ?? 0) - (this.threat.get(a.id) ?? 0),
          )[0];
        if (reviver) return reviver;
      }
      return super.chooseTarget(kind, alive);
    }

    /** Stand-ins jump a ring of the Twin Slam they can't walk out of. */
    protected override botHint(
      bot: Fighter,
      input: Input,
      go: (x: number, y: number, away: boolean) => Input,
    ): Input | undefined {
      if (!this.ascendant()) return super.botHint(bot, input, go);
      const ring = this.raid.warnings.find(
        (w) =>
          (w.kind === "twin-slam" || w.kind === "slam") &&
          w.at - this.time < 0.25 &&
          w.at > this.time &&
          Math.hypot(bot.x - w.x, bot.y - w.y) < w.radius + RULES.radius,
      );
      if (ring && this.time >= bot.jumpAt) {
        input.jump = true;
        return input;
      }
      return undefined;
    }
  };
}

export class AscendantCragmuffArena extends AscendantCragmuffRules(RaidArena) {
  constructor(code: string) {
    super(code, "grumblecrag");
    this.raid.variant = "ascendant";
    this.raid.name = A.name;
  }

  override start() {
    super.start();
    const r = this.raid;
    r.variant = "ascendant";
    r.name = A.name;
    // The evolved form is never Gilded: one look, one health.
    if (r.gilded) {
      r.maxHp = Math.round(r.maxHp / BOSS.health.gilded);
      r.gilded = false;
    }
    const boss = this.boss();
    if (boss) Object.assign(boss, { hp: r.maxHp, name: A.name });
    this.resetReads();
    r.message = `${RAID_TRAITS[r.trait].name} ${A.name} · ${RAID_TRAITS[r.trait].text}`;
  }

  protected override finishMessage(won: boolean) {
    return won
      ? "The Ascendant kneels. The Spire opens above you."
      : "Ascendant Cragmuff stands unbroken. Learn its reads and climb again.";
  }
}
