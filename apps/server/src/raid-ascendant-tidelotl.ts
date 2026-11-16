/**
 * Ascendant Tidelotl: the evolved axolotl on the Spire's twentieth floor
 * (docs/spire: "Ascendant bosses"). The raid's Tidelotl (Tidewyrm's id),
 * pushed further through the same warning, deck and honesty machinery:
 *
 * - New moves: the Breaker Wall (a towering wave over the whole court that
 *   can't be jumped, crossed by lanes of calm water: stand in one, or on an
 *   island) and the Geyser Line (three geysers in a row, marked at once,
 *   erupting one after another).
 * - Combos: bubble fans chain into geysers from chapter 2; in chapter 3 a
 *   Breaker Wall that has crossed is followed by geysers, and a strand ends
 *   with two tail sweeps (the second ring wider, a jump cooldown later).
 * - Fewer openings: the Ascendant tier's windows (strands and staggers).
 * - Reads: geysers aimed where a raider habitually dodges, the calm lanes
 *   laid away from where raiders stand (always within reach), a Geyser Line
 *   for a raider standing still to attack, feints (a dive whose ripple sinks
 *   away part-way and becomes a Geyser Line, shown in full) and the raider
 *   kneeling to revive as the first target.
 *
 * The rules are a layer (`AscendantTidelotlRules`) over a Tidewyrm arena,
 * on while the raid is Tidelotl's Ascendant form (`isAscendant`) and the
 * raid's own hooks otherwise, so one arena can carry several Ascendants'
 * layers. `AscendantTidelotlArena` is that layer always on:
 * createRaidArena(code, "tidewyrm", { variant: "ascendant" }) (server code
 * and tests only: clients can't ask for a variant).
 */
import { raidJitter } from "./raid.js";
import { TidewyrmArena } from "./raid-tidewyrm.js";
import {
  RULES,
  normalize,
  type Fighter,
  type Input,
} from "../../../packages/shared/src/index.js";
import {
  ASCENDANT_TIDELOTL as A,
  RAID,
  RAID_TRAITS,
  TIDEWYRM as T,
  isAscendant,
  type RaidAttack,
  type RaidWarning,
  type RaidWave,
} from "../../../packages/shared/src/raid.js";
import {
  raidShapeHits,
  raidShapeOf,
  type RaidReaction,
  type RaidSituation,
} from "./raid-ai.js";

type Point = { x: number; y: number };
const W = RULES.width,
  H = RULES.height;
const clampX = (x: number, pad = 60) => Math.max(pad, Math.min(W - pad, x));
const clampY = (y: number, pad = 60) => Math.max(pad, Math.min(H - pad, y));
/** The farthest any spot on the court is from a calm lane's centre (px). */
export const BREAKER_REACH = A.breaker.spacing / 2 + 40;

/**
 * The calm lanes' centres across a Breaker Wall's travel (`length`: the
 * court's size across it), `spacing` apart from `offset`, keeping every spot
 * within BREAKER_REACH of one. Undefined when that offset leaves a spot out.
 */
export function breakerLanes(offset: number, length: number) {
  const out: number[] = [];
  for (let c = offset; c <= length - 40; c += A.breaker.spacing)
    if (c >= 40) out.push(c);
  for (let s = 40; s <= length - 40; s += 10)
    if (!out.some((c) => Math.abs(s - c) <= BREAKER_REACH)) return undefined;
  return out;
}
/** Is a raider at `across` (the coordinate across the wall) inside a calm lane? */
export function inBreakerLane(
  across: number,
  gaps: readonly number[],
  gapWidth: number,
) {
  const half = gapWidth / 2 - RULES.radius;
  return gaps.some((c) => Math.abs(across - c) <= half);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TideClass = new (...args: any[]) => TidewyrmArena;

/** Ascendant Tidelotl's rules over `Base`, on while the raid is its Ascendant form. */
export function AscendantTidelotlRules<B extends TideClass>(Base: B) {
  return class AscendantTidelotlRules extends Base {
    /** How often each read was played this run (tests and balance logs). */
    tideReads = { feints: 0, habits: 0, anchors: 0, revivers: 0, lanes: 0 };
    /** Each raider's dodges: a decaying sum of directions and of weights. */
    protected tideHabits = new Map<
      string,
      { x: number; y: number; weight: number; n: number }
    >();
    /** Raiders standing in a warning when it appeared, and where they stood. */
    protected tideDodging = new Map<RaidWarning, Map<string, Point>>();
    protected tideWatched = new WeakSet<RaidWarning>();
    /** When each raider stopped moving, and last hit the boss. */
    protected tideStill = new Map<string, number>();
    protected tideHitAt = new Map<string, number>();
    /** Dives that will turn into a Geyser Line, and when. */
    protected tideFeints = new Map<RaidWarning, number>();
    /** Chapter 3: a Breaker Wall crossing, and the cast its geysers belong to. */
    protected breakerChase?: { wave: number; cast: number };

    /** Are the Ascendant's rules on? (Off: every hook is the raid's own.) */
    protected tideAscendant() {
      return isAscendant(this.raid, "tidewyrm");
    }
    /** A new fight: forget the last one's reads. */
    protected resetTideReads() {
      this.tideReads = {
        feints: 0,
        habits: 0,
        anchors: 0,
        revivers: 0,
        lanes: 0,
      };
      this.tideHabits.clear();
      this.tideDodging.clear();
      this.tideStill.clear();
      this.tideHitAt.clear();
      this.tideFeints.clear();
      this.breakerChase = undefined;
    }

    /** The Ascendant tier, with its own revive length (see ASCENDANT_TIDELOTL). */
    protected override tier() {
      const t = super.tier();
      return this.tideAscendant() && this.smart()
        ? { ...t, reviveSeconds: A.reviveSeconds }
        : t;
    }
    /** More health per extra raider than the raid's (see ASCENDANT_TIDELOTL). */
    protected override bossMaxHp() {
      const r = this.raid;
      if (!this.tideAscendant() || r.partySize <= 1) return super.bossMaxHp();
      const base = super.bossMaxHp(),
        extra = r.partySize - 1;
      return Math.round(
        (base * (T.health.base + A.perExtraPlayer * extra)) /
          (T.health.base + T.health.perExtraPlayer * extra),
      );
    }
    /** A Breaker Wall's warning keeps its length (like the Tidal Wave's). */
    protected override telegraph(kind: RaidAttack, seconds: number) {
      return kind === "breaker" && this.tideAscendant()
        ? seconds
        : super.telegraph(kind, seconds);
    }
    protected override clearAttacks() {
      super.clearAttacks();
      this.tideFeints.clear();
      this.breakerChase = undefined;
    }

    // ------------------------------------------------------------- Openings
    protected override attacksStep(dt: number) {
      if (!this.tideAscendant()) return super.attacksStep(dt);
      const r = this.raid;
      this.turnTideFeints();
      const staggered = r.staggerUntil;
      super.attacksStep(dt);
      // A stagger that started this step: a shorter window (the tier's windows).
      if (r.staggerUntil > staggered && this.smart()) {
        r.staggerUntil = this.time + this.window(RAID.staggerSeconds);
        r.exposedUntil = Math.max(r.exposedUntil, r.staggerUntil);
        this.nextAttack = r.staggerUntil + 0.4;
      }
      if (r.staggerUntil > this.time) {
        this.tideFeints.clear();
        this.breakerChase = undefined;
      }
      this.learnTideDodges();
    }

    protected override bossStep(dt: number, boss: Fighter) {
      if (!this.tideAscendant()) return super.bossStep(dt, boss);
      const r = this.raid,
        swept = this.swept,
        before = new Set(r.warnings);
      super.bossStep(dt, boss);
      // As a strand ends: a second, wider tail sweep a jump cooldown later.
      if (!swept && this.swept && this.smart()) {
        const first = r.warnings.find(
          (w) => w.kind === "slam" && !before.has(w),
        );
        if (first)
          Object.assign(
            this.warn(
              "slam",
              first.x,
              first.y,
              first.x,
              first.y,
              A.secondSweep.radius,
              first.at - this.time + RULES.jumpCooldown + 0.3,
            ),
            { followUp: true },
          );
      }
      // Chapter 3: once the wall has crossed, geysers under a raider.
      const chase = this.breakerChase;
      if (chase && !(r.waves ?? []).some((w) => w.id === chase.wave)) {
        this.breakerChase = undefined;
        const alive = this.heroes().filter((p) => p.hp > 0);
        if (alive.length && r.staggerUntil <= this.time) {
          const target = this.chooseTarget("geyser", alive);
          this.currentCast = chase.cast;
          const fresh = this.warnGeysers(target, false, A.breakerGeysers);
          for (const w of fresh) w.followUp = true;
          this.settleWarnings();
          this.currentCast = 0;
          this.nextAttack = Math.max(
            this.nextAttack,
            Math.max(...fresh.map((w) => w.at)) + 0.6,
          );
          r.message = "The wall has passed — geysers rise under you!";
        }
      }
    }

    // --------------------------------------------------------------- Attacks
    protected override startAttack(kind: RaidAttack, target: Fighter) {
      if (!this.tideAscendant()) return super.startAttack(kind, target);
      const r = this.raid,
        boss = this.boss()!;
      this.noteTideRead(kind, target);
      if (kind === "breaker" || kind === "geyser") {
        const count = this.seenAttacks.get(kind) ?? 0;
        this.seenAttacks.set(kind, count + 1);
        boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
        if (kind === "breaker") this.warnBreaker(count < 2);
        else this.warnGeysers(target, count < 2);
        return;
      }
      const before = new Set(r.warnings);
      super.startAttack(kind, target);
      if (kind === "dive" && this.smart() && this.tideFeintRoll()) {
        const dive = r.warnings.find(
          (w) => w.kind === "dive" && !before.has(w),
        );
        // Only a dive on its own turns (nothing else live to clash with).
        const others = r.warnings.some((w) => before.has(w) && this.harmful(w));
        if (dive && !dive.teach && !others && dive.lockAt !== undefined) {
          const start = dive.startedAt ?? this.time;
          this.tideFeints.set(
            dive,
            start + (dive.lockAt - start) * A.feint.turnAt,
          );
        }
      }
    }

    /**
     * A Breaker Wall from the edge nearest the raiders. Its calm lanes are
     * laid as far from where the raiders stand as the lanes' spacing allows
     * (they always have one within BREAKER_REACH).
     */
    protected warnBreaker(teach: boolean) {
      const r = this.raid,
        B = A.breaker;
      const alive = this.heroes().filter((p) => p.hp > 0);
      let side = (this.attacks + r.seed) % 4;
      if (this.smart() && alive.length) {
        const edge = (s: number) =>
          alive.reduce(
            (sum, p) =>
              sum +
              (s === 0 ? p.x : s === 1 ? W - p.x : s === 2 ? p.y : H - p.y),
            0,
          );
        side = [0, 1, 2, 3].sort((a, b) => edge(a) - edge(b))[0];
      }
      const axis = side < 2 ? "x" : "y";
      const dir = side % 2 ? -1 : 1;
      const x = axis === "x" ? (dir > 0 ? 0 : W) : W / 2,
        y = axis === "y" ? (dir > 0 ? 0 : H) : H / 2;
      const gaps = this.breakerGaps(axis, alive);
      return Object.assign(
        this.warn(
          "breaker",
          x,
          y,
          axis === "x" ? x + dir : x,
          axis === "y" ? y + dir : y,
          B.width,
          B.delay,
        ),
        { high: true, gaps, gapWidth: B.gapWidth, teach },
      );
    }
    /** The calm lanes for a wall travelling along `axis`. */
    protected breakerGaps(axis: "x" | "y", alive: Fighter[]) {
      const length = axis === "x" ? H : W,
        step = A.breaker.spacing / 16;
      let best: number[] | undefined,
        score = -1;
      for (let o = 0; o < A.breaker.spacing; o += step) {
        const lanes = breakerLanes(o, length);
        if (!lanes) continue;
        // Read: lanes away from where the raiders stand now.
        const s = this.smart()
          ? Math.min(
              ...alive.map((p) =>
                Math.min(
                  ...lanes.map((c) => Math.abs((axis === "x" ? p.y : p.x) - c)),
                ),
              ),
            )
          : 0;
        if (!best || s > score + 1e-6) {
          best = lanes;
          score = s;
        }
      }
      if (this.smart() && score > A.breaker.gapWidth / 2)
        this.tideReads.lanes++;
      return best ?? breakerLanes(A.breaker.spacing / 2, length) ?? [];
    }

    /**
     * Three geysers in a row under `target`, all marked now, erupting
     * `A.geyser.gap` apart (`chain`: their order, 1-3). Ahead of a runner
     * along their run; else toward where they usually dodge; else away from
     * the boss. `extra` delays the whole line.
     */
    protected warnGeysers(target: Fighter, teach: boolean, extra = 0) {
      const G = A.geyser,
        boss = this.boss()!;
      const delay = this.telegraph("geyser", G.delay);
      const led = this.lead(target, delay + extra);
      let base: Point = { x: target.x, y: target.y },
        dir: Point;
      if (led.x !== target.x || led.y !== target.y) {
        base = led;
        dir = normalize(target.vx ?? 0, target.vy ?? 0);
      } else {
        const habit = this.smart() ? this.tideHabitOf(target.id) : undefined;
        if (habit) {
          this.tideReads.habits++;
          const k = G.radius * A.habit.offset;
          base = { x: target.x + habit.x * k, y: target.y + habit.y * k };
          dir = habit;
        } else
          dir = normalize(target.x - boss.x || 1, target.y - boss.y || 0.01);
      }
      const out: RaidWarning[] = [];
      for (let k = 0; k < G.count; k++) {
        const x = clampX(base.x + dir.x * G.step * k, 50),
          y = clampY(base.y + dir.y * G.step * k, 50);
        const w = Object.assign(
          this.warn("geyser", x, y, x, y, G.radius, G.delay),
          { targetId: target.id, chain: k + 1, teach },
        );
        w.at += extra + k * G.gap;
        out.push(w);
      }
      return out;
    }

    protected override resolveWarning(w: RaidWarning, boss: Fighter) {
      if (!this.tideAscendant()) return super.resolveWarning(w, boss);
      const r = this.raid;
      if (w.kind === "breaker") {
        const axis = w.tx !== w.x ? "x" : "y";
        const dir = (
          axis === "x" ? Math.sign(w.tx - w.x) : Math.sign(w.ty - w.y)
        ) as 1 | -1;
        const id = ++this.serial;
        r.waves = [
          ...(r.waves ?? []),
          {
            id,
            axis,
            dir,
            pos: axis === "x" ? w.x : w.y,
            speed:
              r.trait === "rip-current" ? T.wave.ripSpeed : A.breaker.speed,
            width: A.breaker.width,
            high: true,
            gaps: [...(w.gaps ?? [])],
            gapWidth: w.gapWidth ?? A.breaker.gapWidth,
          },
        ];
        this.waveHits.set(id, new Set());
        this.event("raid-impact", w, 0x2fe0ff, undefined, boss.id);
        this.events[this.events.length - 1].raidRadius = w.radius;
        if (r.phase === 3 && this.smart())
          this.breakerChase = { wave: id, cast: this.currentCast };
        return;
      }
      if (w.kind === "geyser") {
        this.hitBy = "geyser";
        for (const p of this.heroes())
          if (
            p.hp > 0 &&
            Math.hypot(p.x - w.x, p.y - w.y) < w.radius + RULES.radius
          )
            this.damage(p, A.geyser.damage, boss.id, this.splash());
        this.hitBy = undefined;
        this.event("raid-impact", w, 0x6ff6ff, undefined, boss.id);
        this.events[this.events.length - 1].raidRadius = w.radius;
        return;
      }
      super.resolveWarning(w, boss);
      // A dive that surfaces in the water (a missed lure) from chapter 2:
      // geysers rise under the raider it followed.
      if (
        w.kind === "dive" &&
        r.phase >= 2 &&
        this.smart() &&
        this.strandedOn < 0 &&
        !r.submerged
      ) {
        const target = this.heroes().find(
          (p) => p.id === w.targetId && p.hp > 0,
        );
        if (target)
          for (const g of this.warnGeysers(target, false)) g.followUp = true;
      }
      // Bubble fans chain into geysers from chapter 2.
      if (w.kind === "bubbles" && r.phase >= 2 && this.smart()) {
        const target = this.heroes().find(
          (p) => p.id === w.targetId && p.hp > 0,
        );
        if (target)
          for (const g of this.warnGeysers(target, false)) g.followUp = true;
      }
    }

    /** Breaker Walls spare raiders in a calm lane (or on an island). */
    protected override waveSpares(wave: RaidWave, p: Fighter) {
      if (wave.gaps?.length)
        return (
          inBreakerLane(
            wave.axis === "x" ? p.y : p.x,
            wave.gaps,
            wave.gapWidth ?? A.breaker.gapWidth,
          ) || this.onIsland(p)
        );
      return super.waveSpares(wave, p);
    }
    protected override waveHit(wave: RaidWave) {
      return wave.gaps
        ? { kind: "breaker" as RaidAttack, damage: A.breaker.damage }
        : super.waveHit(wave);
    }

    // ----------------------------------------------------------------- Feint
    /** Is this dive a feint? A seeded roll per chapter (tests may force it). */
    protected tideFeintRoll() {
      const r = this.raid;
      const chance = A.feint.chance[Math.max(0, Math.min(2, r.phase - 1))];
      return raidJitter(r.seed ^ 0x7a1d, this.attacks, 11) < chance;
    }
    /**
     * Part-way through its follow a feinting dive's ripple sinks away and it
     * surfaces where it is: a Geyser Line rises under the raider the ripple
     * was following, shown in full from that moment (the honesty rules apply
     * to it as to any new attack).
     */
    protected turnTideFeints() {
      const r = this.raid,
        boss = this.boss();
      for (const [dive, at] of this.tideFeints) {
        if (!r.warnings.includes(dive) || !boss) {
          this.tideFeints.delete(dive);
          continue;
        }
        if (this.time < at) continue;
        this.tideFeints.delete(dive);
        const target = this.heroes().find(
          (p) => p.id === dive.targetId && p.hp > 0,
        );
        const live = r.warnings.filter((w) => w !== dive && this.harmful(w));
        if (!target || live.length) continue;
        r.warnings = r.warnings.filter((w) => w !== dive);
        if (!this.returning) r.submerged = false;
        this.lingerUntil = this.time + 2.5;
        this.currentCast = this.castOf.get(dive) ?? 0;
        boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
        this.warnGeysers(target, false);
        this.settleWarnings();
        this.currentCast = 0;
        this.tideReads.feints++;
        r.message = "A feint! The ripple sinks away — geysers rise.";
      }
    }

    // ------------------------------------------------------------ Habit aim
    /**
     * Watch every raider standing in a fresh warning, and where they went by
     * the time it landed: the boss remembers the direction they dodge.
     */
    protected learnTideDodges() {
      const r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0);
      for (const w of r.warnings) {
        if (this.tideWatched.has(w)) continue;
        this.tideWatched.add(w);
        if (
          !this.harmful(w) ||
          !["circle", "line", "cone"].includes(raidShapeOf(w.kind))
        )
          continue;
        const inside = new Map<string, Point>();
        for (const p of alive)
          if (raidShapeHits(w, p.x, p.y, RULES.radius))
            inside.set(p.id, { x: p.x, y: p.y });
        if (inside.size) this.tideDodging.set(w, inside);
      }
      for (const [w, from] of this.tideDodging) {
        if (r.warnings.includes(w)) continue;
        this.tideDodging.delete(w);
        for (const [id, start] of from) {
          const p = alive.find((q) => q.id === id);
          if (!p) continue;
          const dx = p.x - start.x,
            dy = p.y - start.y;
          if (Math.hypot(dx, dy) >= 30) this.noteTideDodge(id, dx, dy);
        }
      }
    }
    /** Remember one dodge of raider `id` (also used by tests). */
    noteTideDodge(id: string, dx: number, dy: number) {
      const len = Math.hypot(dx, dy) || 1;
      const h = this.tideHabits.get(id) ?? { x: 0, y: 0, weight: 0, n: 0 };
      h.x = h.x * 0.6 + dx / len;
      h.y = h.y * 0.6 + dy / len;
      h.weight = h.weight * 0.6 + 1;
      h.n++;
      this.tideHabits.set(id, h);
    }
    /** The direction a raider usually dodges, once the boss trusts it. */
    tideHabitOf(id: string): Point | undefined {
      const h = this.tideHabits.get(id);
      if (!h || h.n < A.habit.samples) return undefined;
      const len = Math.hypot(h.x, h.y);
      if (len / h.weight < A.habit.consistency) return undefined;
      return { x: h.x / len, y: h.y / len };
    }

    // ------------------------------------------------------- Other reads
    override damage(
      target: Fighter,
      amount: number,
      owner: string,
      ability?: Parameters<TidewyrmArena["damage"]>[3],
    ) {
      super.damage(target, amount, owner, ability);
      if (target.raidBoss && owner !== target.id && this.tideAscendant())
        this.tideHitAt.set(owner, this.time);
    }
    protected override trackMotion() {
      super.trackMotion();
      if (!this.tideAscendant()) return;
      for (const p of this.heroes()) {
        const still =
          p.hp > 0 && Math.hypot(p.vx ?? 0, p.vy ?? 0) < A.anchor.speed;
        if (!still) this.tideStill.delete(p.id);
        else if (!this.tideStill.has(p.id)) this.tideStill.set(p.id, this.time);
      }
    }
    /** Standing still while hitting the boss (for the anchor read). */
    tideAnchored(p: Fighter) {
      const since = this.tideStill.get(p.id);
      return (
        since !== undefined &&
        this.time - since >= A.anchor.still &&
        this.time - (this.tideHitAt.get(p.id) ?? -99) <= A.anchor.hit
      );
    }
    protected tideReviving(p: Fighter) {
      return this.heroes().some(
        (d) =>
          d.hp <= 0 &&
          !this.raid.downed[d.id]?.self &&
          Math.hypot(d.x - p.x, d.y - p.y) <= RAID.reviveRange,
      );
    }
    protected noteTideRead(kind: RaidAttack, target: Fighter) {
      if (!this.smart()) return;
      if (this.tideReviving(target)) this.tideReads.revivers++;
      else if (this.tideAnchored(target) && kind === "geyser")
        this.tideReads.anchors++;
    }
    /** A Geyser Line for a raider standing still to attack, or kneeling to revive. */
    protected override reactions(s: RaidSituation): RaidReaction[] {
      const out = super.reactions(s);
      if (!this.tideAscendant()) return out;
      for (const p of s.alive)
        if (this.tideAnchored(p))
          out.push({ kind: "geyser", score: 1.5, target: p });
      for (const p of s.reviving)
        out.push({ kind: "geyser", score: 1.6, target: p });
      return out;
    }
    /** The raider kneeling by a fallen ally comes first (geysers, bubbles). */
    protected override chooseTarget(kind: RaidAttack, alive: Fighter[]) {
      if (
        this.tideAscendant() &&
        this.smart() &&
        alive.length > 1 &&
        (kind === "geyser" || kind === "bubbles")
      ) {
        const reviver = alive
          .filter((p) => this.tideReviving(p))
          .sort(
            (a, b) =>
              (this.threat.get(b.id) ?? 0) - (this.threat.get(a.id) ?? 0),
          )[0];
        if (reviver) return reviver;
      }
      return super.chooseTarget(kind, alive);
    }
    /** Geyser Lines go at a second raider too (3+ raiders). */
    protected override pressured(kind: RaidAttack, alive: Fighter[]) {
      return (
        super.pressured(kind, alive) ||
        (this.tideAscendant() &&
          kind === "geyser" &&
          this.smart() &&
          alive.length >= 3)
      );
    }

    /** Stand-ins head for the nearest calm lane (or island) before a Breaker Wall. */
    protected override botHint(
      bot: Fighter,
      input: Input,
      go: (x: number, y: number, away: boolean) => Input,
    ): Input | undefined {
      if (!this.tideAscendant()) return super.botHint(bot, input, go);
      const r = this.raid;
      const warning = r.warnings.find((w) => w.kind === "breaker");
      const wave = (r.waves ?? []).find((w) => {
        if (!w.gaps) return false;
        // Not once it has passed this raider.
        const along = w.axis === "x" ? bot.x : bot.y;
        return (along - w.pos) * w.dir > -(w.width / 2 + RULES.radius);
      });
      const wall = warning
        ? {
            axis: (warning.tx !== warning.x ? "x" : "y") as "x" | "y",
            gaps: warning.gaps ?? [],
            gapWidth: warning.gapWidth ?? A.breaker.gapWidth,
          }
        : wave
          ? {
              axis: wave.axis,
              gaps: wave.gaps ?? [],
              gapWidth: wave.gapWidth ?? A.breaker.gapWidth,
            }
          : undefined;
      if (wall && wall.gaps.length && !this.onIsland(bot)) {
        const across = wall.axis === "x" ? bot.y : bot.x;
        if (inBreakerLane(across, wall.gaps, wall.gapWidth - 24)) {
          input.dx = input.dy = 0;
          return input;
        }
        const lane = [...wall.gaps].sort(
          (a, b) => Math.abs(a - across) - Math.abs(b - across),
        )[0];
        return wall.axis === "x"
          ? go(bot.x, lane, false)
          : go(lane, bot.y, false);
      }
      return super.botHint(bot, input, go);
    }
  };
}

export class AscendantTidelotlArena extends AscendantTidelotlRules(
  TidewyrmArena,
) {
  constructor(code: string) {
    super(code, "tidewyrm");
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
      r.maxHp = Math.round(r.maxHp / T.health.gilded);
      r.gilded = false;
    }
    const boss = this.boss();
    if (boss) Object.assign(boss, { hp: r.maxHp, name: A.name });
    this.resetTideReads();
    r.message = `${RAID_TRAITS[r.trait].name} ${A.name} · ${RAID_TRAITS[r.trait].text}`;
  }

  protected override finishMessage(won: boolean): string {
    return won
      ? "The abyss calms. The Spire opens above you."
      : "Ascendant Tidelotl's tide keeps rising. Learn its reads and climb again.";
  }
}
