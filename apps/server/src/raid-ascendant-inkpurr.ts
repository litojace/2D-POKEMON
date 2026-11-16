/**
 * Ascendant Inkpurr: the evolved ink-cat on the Spire's thirtieth floor
 * (docs/spire: "Ascendant bosses"). The raid's Inkpurr (Gloomshade's id),
 * pushed further through the same warning, deck and honesty machinery, and
 * built from its own rules (shadows, lanterns, copies, curses):
 *
 * - New moves: Nightfall (the dark swallows the yard: only lit lanterns and
 *   the pools of moonlight it leaves are safe; the dark hurts and curses)
 *   and the Shade Pounce (every body leaps onto a raider in turn, the copies
 *   first and the real one last; a real one landing in lantern light casts
 *   its shadow and is revealed).
 * - It splits from chapter 1, and its rhythm tightens by chapter. Alone or
 *   in a pair it makes more copies than the raid, and its copies lunge with
 *   it (the raid's copies lunge only against 3+); a pair also meets a
 *   faster night (the raid's is for 3+).
 * - Combos (ASCENDANT_INKPURR.combosFrom): a lunge ends in a pounce on the
 *   raider it chased; from chapter 2 a snuffed lantern's darkness lunges at
 *   whoever stood in its light, and every body pounces once Nightfall has
 *   landed. Feints: a lunge whose lanes sink part-way into a full pounce.
 * - Reads: pounces aimed where a raider habitually dodges, Nightfall's pools
 *   laid away from where raiders stand and from where they usually dodge
 *   (always within reach), a pounce for a raider standing still to attack,
 *   and the raider kneeling to revive as the first target.
 * - Overlap: in a party, a pounce may bring Grasping Hands with it; the
 *   safe-spot rule knows the board (a lit tile outside every circle must
 *   stay within reach) and Nightfall's pools, or there are no hands (and an
 *   attack that would overlap others waits until they have landed).
 *
 * The rules are a layer (`AscendantInkpurrRules`) over a Gloomshade arena,
 * on while the raid is Inkpurr's Ascendant form (`isAscendant`) and the
 * raid's own hooks otherwise, so one arena can carry several Ascendants'
 * layers. `AscendantInkpurrArena` is that layer always on:
 * createRaidArena(code, "gloomshade", { variant: "ascendant" }) (server code
 * and tests only: clients can't ask for a variant).
 */
import { raidJitter } from "./raid.js";
import { GloomshadeArena } from "./raid-gloomshade.js";
import {
  RULES,
  normalize,
  type Fighter,
  type Input,
} from "../../../packages/shared/src/index.js";
import {
  ASCENDANT_INKPURR as A,
  GLOOMSHADE as G,
  RAID,
  RAID_TRAITS,
  ascendantInkpurrPattern,
  handsTileDark,
  isAscendant,
  lanternRadius,
  type RaidAttack,
  type RaidWarning,
} from "../../../packages/shared/src/raid.js";
import {
  RAID_REACTION,
  RAID_SLOWEST_SPEED,
  raidShapeHits,
  raidShapeOf,
  type RaidReaction,
  type RaidSituation,
} from "./raid-ai.js";

type Point = { x: number; y: number };
type Pool = { x: number; y: number; radius: number };
const W = RULES.width,
  H = RULES.height;
const clampX = (x: number, pad = 60) => Math.max(pad, Math.min(W - pad, x));
const clampY = (y: number, pad = 60) => Math.max(pad, Math.min(H - pad, y));
/** Seconds before a pounce lands that its body leaps. */
export const POUNCE_LEAP = 0.3;

/** Is a point inside one of Nightfall's pools of moonlight? */
export function inMoonPool(x: number, y: number, pools: readonly Pool[]) {
  return pools.some((p) => Math.hypot(x - p.x, y - p.y) < p.radius);
}
/** Is a point on a tile Grasping Hands leaves lit (with a margin)? */
export function onLitTile(w: RaidWarning, x: number, y: number, margin = 12) {
  const parity =
    w.shiftAt !== undefined ? 1 - (w.parity ?? 0) : (w.parity ?? 0);
  return [
    [0, 0],
    [margin, 0],
    [-margin, 0],
    [0, margin],
    [0, -margin],
  ].every(([dx, dy]) => !handsTileDark(x + dx, y + dy, parity));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InkClass = new (...args: any[]) => GloomshadeArena;

/** Ascendant Inkpurr's rules over `Base`, on while the raid is its Ascendant form. */
export function AscendantInkpurrRules<B extends InkClass>(Base: B) {
  return class AscendantInkpurrRules extends Base {
    /** How often each read was played this run (tests and balance logs). */
    inkReads = {
      habits: 0,
      anchors: 0,
      revivers: 0,
      pools: 0,
      reveals: 0,
      feints: 0,
    };
    /** Each raider's dodges: a decaying sum of directions and of weights. */
    protected inkHabits = new Map<
      string,
      { x: number; y: number; weight: number; n: number }
    >();
    /** Raiders standing in a warning when it appeared, and where they stood. */
    protected inkDodging = new Map<RaidWarning, Map<string, Point>>();
    protected inkWatched = new WeakSet<RaidWarning>();
    /** When each raider stopped moving, and last hit the boss. */
    protected inkStill = new Map<string, number>();
    protected inkHitAt = new Map<string, number>();
    /** Casts whose lunge already ended in a pounce. */
    protected inkCombos = new Set<number>();
    /** Where each pouncing body leaps from (its spot when the leap starts). */
    protected inkLeaps = new Map<RaidWarning, Point>();
    /** Lunges that will turn into a pounce (by cast), and when. */
    protected inkFeints = new Map<
      number,
      { at: number; target: string; lanes: RaidWarning[] }
    >();

    /** Are the Ascendant's rules on? (Off: every hook is the raid's own.) */
    protected inkAscendant() {
      return isAscendant(this.raid, "gloomshade");
    }
    /** A new fight: forget the last one's reads. */
    protected resetInkReads() {
      this.inkReads = {
        habits: 0,
        anchors: 0,
        revivers: 0,
        pools: 0,
        reveals: 0,
        feints: 0,
      };
      this.inkHabits.clear();
      this.inkFeints.clear();
      this.inkDodging.clear();
      this.inkStill.clear();
      this.inkHitAt.clear();
      this.inkCombos.clear();
      this.inkLeaps.clear();
    }

    /** The Ascendant tier, with its own revive length (see ASCENDANT_INKPURR). */
    protected override tier() {
      const t = super.tier();
      return this.inkAscendant() && this.smart()
        ? { ...t, reviveSeconds: A.reviveSeconds }
        : t;
    }
    /** Health per extra raider (see ASCENDANT_INKPURR.perExtraPlayer). */
    protected override bossMaxHp() {
      const r = this.raid;
      if (!this.inkAscendant() || r.partySize <= 1) return super.bossMaxHp();
      const base = super.bossMaxHp(),
        extra = r.partySize - 1;
      return Math.round(
        (base * (G.health.base + A.perExtraPlayer * extra)) /
          (G.health.base + G.health.perExtraPlayer * extra),
      );
    }
    /** Its own deck: it splits from chapter 1 (see ascendantInkpurrPattern). */
    protected override pattern() {
      if (!this.inkAscendant()) return super.pattern();
      const r = this.raid;
      const extra: RaidAttack[] =
        r.trait === "restless-spirits" ? ["hands"] : [];
      return [...ascendantInkpurrPattern(r.phase), ...extra];
    }
    /** Alone or in a pair, more copies than the raid's (see ASCENDANT_INKPURR.extraCopies). */
    protected override copyCount() {
      const n = super.copyCount(),
        size = this.raid.partySize;
      return this.inkAscendant() && size >= 1 && size <= 2
        ? n + A.extraCopies[size - 1]
        : n;
    }
    /** Tighter rhythm by chapter (see ASCENDANT_INKPURR.cadence). */
    protected override cadence() {
      const base = super.cadence();
      if (!this.inkAscendant() || !this.smart()) return base;
      const r = this.raid;
      // A pair meets a faster night too (the raid's is for 3+).
      const pair =
        r.partySize === 2 && r.partySize < G.split.partyCopy
          ? A.pairCadence
          : 1;
      return base * pair * A.cadence[Math.max(0, Math.min(2, r.phase - 1))];
    }
    /** A party meets harder hits (see ASCENDANT_INKPURR.partyDamage). */
    protected override bossDamage() {
      const base = super.bossDamage();
      if (!this.inkAscendant() || !this.smart()) return base;
      return base * (1 + A.partyDamage * Math.max(0, this.raid.partySize - 1));
    }
    /** A party's punish windows (see ASCENDANT_INKPURR.partyWindows). */
    protected override window(seconds: number) {
      const base = super.window(seconds);
      if (!this.inkAscendant() || !this.smart()) return base;
      return base * (1 + A.partyWindows * Math.max(0, this.raid.partySize - 1));
    }
    /** Nightfall's warning keeps its length (a wide escape, like a Breaker Wall). */
    protected override telegraph(kind: RaidAttack, seconds: number) {
      return kind === "nightfall" && this.inkAscendant()
        ? seconds
        : super.telegraph(kind, seconds);
    }
    protected override clearAttacks() {
      super.clearAttacks();
      this.inkLeaps.clear();
      this.inkFeints.clear();
    }

    // -------------------------------------------------------------- Overlap
    /** May a pounce bring Grasping Hands with it now? */
    protected inkOverlaps() {
      const r = this.raid,
        O = A.overlap;
      return (
        this.inkAscendant() &&
        this.smart() &&
        r.phase >= O.from &&
        this.heroes().filter((p) => p.hp > 0).length >= O.raiders
      );
    }
    /** A pounce never meets a pulse (the rings follow the body it moves), nor a pulse a pounce. */
    protected override canOverlap(kind: RaidAttack) {
      if (!this.inkAscendant()) return super.canOverlap(kind);
      const live = this.raid.warnings.filter((w) => this.harmful(w));
      if (kind === "pounce" && live.some((w) => w.kind === "pulse"))
        return false;
      if (kind === "pulse" && live.some((w) => w.kind === "pounce"))
        return false;
      return super.canOverlap(kind);
    }
    /**
     * The overlap (ASCENDANT_INKPURR.overlap): in a party, a pounce may bring
     * Grasping Hands, the board closing RAID_IMPACT_GAP after the last leap.
     * The board (no flip) is laid so every raider can reach a lit tile
     * outside every circle before the first leap lands; it darkens the
     * tiles most raiders stand on when that still holds, else the others,
     * else there are no hands.
     */
    protected pounceHands(circles: RaidWarning[]) {
      const r = this.raid;
      if (
        !circles.length ||
        !this.inkOverlaps() ||
        r.warnings.some((w) => w.kind === "hands") ||
        raidJitter(r.seed ^ 0x4a11, this.attacks, 17) >= A.overlap.chance
      )
        return undefined;
      const alive = this.heroes().filter((p) => p.hp > 0);
      const under = (q: number) =>
        alive.filter((p) => handsTileDark(p.x, p.y, q)).length;
      const order = under(1) >= under(0) ? [1, 0] : [0, 1];
      const last = Math.max(...circles.map((w) => w.at));
      for (const parity of order) {
        const hands = Object.assign(
          this.warn("hands", 800, 450, 800, 450, 0, G.hands.delay),
          { parity, followUp: true },
        );
        hands.at = Math.max(hands.at, last + 0.5);
        if (this.safeSpotExists([...circles, hands], 0.1)) {
          r.message = "It pounces — and the hands reach up! Find a lit tile.";
          return hands;
        }
        r.warnings = r.warnings.filter((w) => w !== hands);
      }
      return undefined;
    }
    /** Is (x, y) outside every shape, on a lit tile, and (Nightfall) in light? */
    protected inkClear(shapes: RaidWarning[], x: number, y: number) {
      if (
        x <= RULES.radius ||
        x >= W - RULES.radius ||
        y <= RULES.radius ||
        y >= H - RULES.radius
      )
        return false;
      for (const w of shapes) {
        if (w.kind === "hands") {
          if (!onLitTile(w, x, y)) return false;
        } else if (w.kind === "nightfall") {
          if (!inMoonPool(x, y, w.pools ?? []) && !this.lit(x, y)) return false;
        } else if (
          ["circle", "line", "cone"].includes(raidShapeOf(w.kind)) &&
          raidShapeHits(w, x, y, RULES.radius + 4)
        )
          return false;
      }
      return true;
    }
    /**
     * Every raider can reach a safe spot before the first of these lands
     * (slowest champion, after a 0.45 s reaction): outside every circle,
     * lane and cone, on a lit tile while Grasping Hands closes, and in light
     * while Nightfall falls. Ring attacks are jumped, so they block nothing.
     */
    override safeSpotExists(
      shapes: RaidWarning[] = this.raid.warnings,
      slack = 0,
    ) {
      if (!this.inkAscendant()) return super.safeSpotExists(shapes);
      const live = shapes.filter(
        (w) =>
          this.harmful(w) &&
          (w.kind === "hands" ||
            w.kind === "nightfall" ||
            ["circle", "line", "cone"].includes(raidShapeOf(w.kind))),
      );
      if (!live.length) return true;
      const first = Math.min(...live.map((w) => w.at));
      const reach =
        RAID_SLOWEST_SPEED *
        Math.max(0, first - this.time - RAID_REACTION - slack);
      return this.heroes()
        .filter((p) => p.hp > 0)
        .every((p) => !!this.inkSpotNear(live, p, reach));
    }
    /**
     * The raid's overlap spacing, then the Ascendant's safe-spot rule (the
     * board and Nightfall's pools included) with a little slack, so the spot
     * still exists a moment later: else the new attack waits until the older
     * ones have landed.
     */
    protected override spaceOverlap(fresh: RaidWarning[]) {
      super.spaceOverlap(fresh);
      if (!this.inkAscendant()) return;
      const mine = fresh.filter((w) => this.harmful(w));
      const old = this.raid.warnings.filter(
        (w) => !fresh.includes(w) && this.harmful(w),
      );
      if (!mine.length || !old.length) return;
      const wait =
        Math.max(...old.map((o) => o.at)) +
        1 -
        Math.min(...mine.map((w) => w.at));
      if (wait <= 0 || this.safeSpotExists([...old, ...mine], 0.1)) return;
      for (const w of fresh) {
        w.at += wait;
        if (w.lockAt !== undefined) w.lockAt += wait;
        if (w.shiftAt !== undefined) w.shiftAt += wait;
      }
    }
    /** The nearest safe spot within `reach` of `p` (see `inkClear`). */
    protected inkSpotNear(shapes: RaidWarning[], p: Point, reach: number) {
      if (this.inkClear(shapes, p.x, p.y)) return { x: p.x, y: p.y };
      for (const f of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1])
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const x = p.x + Math.cos(a) * reach * f,
            y = p.y + Math.sin(a) * reach * f;
          if (this.inkClear(shapes, x, y)) return { x, y };
        }
      return undefined;
    }

    // ------------------------------------------------------------- Attacks
    protected override startAttack(kind: RaidAttack, target: Fighter) {
      if (!this.inkAscendant()) return super.startAttack(kind, target);
      const boss = this.boss()!;
      this.noteInkRead(kind, target);
      if (kind === "nightfall" || kind === "pounce") {
        const count = this.seenAttacks.get(kind) ?? 0;
        this.seenAttacks.set(kind, count + 1);
        boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
        if (kind === "nightfall") this.warnNightfall(count < 2);
        else this.pounceHands(this.warnPounce(target, count < 2));
        return;
      }
      const r = this.raid,
        before = new Set(r.warnings);
      super.startAttack(kind, target);
      if (kind === "lunge") this.copyLunges(before);
      // A lunge on its own may be a feint (shown in full when it turns).
      if (kind === "lunge" && this.smart() && this.inkFeintRoll()) {
        const lanes = r.warnings.filter(
          (w) => w.kind === "lunge" && !before.has(w),
        );
        const others = [...before].some((w) => this.harmful(w));
        const lead = lanes[0];
        if (lead && !lead.teach && !others && lead.lockAt !== undefined) {
          const start = lead.startedAt ?? this.time;
          this.inkFeints.set(this.currentCast, {
            at: start + (lead.lockAt - start) * A.feint.turnAt,
            target: target.id,
            lanes,
          });
        }
      }
    }
    /**
     * In a party under three the raid's copies never lunge; the Ascendant's
     * do (ASCENDANT_INKPURR.copyLunges), each from its own body at the raider
     * nearest it, drawn like any lunge (only the real one casts a shadow).
     */
    protected copyLunges(before: Set<RaidWarning>) {
      const r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0 && !this.inked(p));
      const lanes = r.warnings.filter(
        (w) => w.kind === "lunge" && !before.has(w),
      );
      if (
        !this.smart() ||
        !lanes.length ||
        lanes[0].teach ||
        !alive.length ||
        alive.length >= G.split.partyCopy
      )
        return;
      (r.decoys ?? [])
        .filter((d) => !lanes.some((u) => u.x === d.x && u.y === d.y))
        .slice(0, A.copyLunges)
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
            { targetId: prey.id, lockAt: this.time + delay - 0.65 },
          );
        });
    }
    /** Is this lunge a feint? A seeded roll per chapter (tests may force it). */
    protected inkFeintRoll() {
      const r = this.raid;
      const chance = A.feint.chance[Math.max(0, Math.min(2, r.phase - 1))];
      return raidJitter(r.seed ^ 0x1b7c, this.attacks, 13) < chance;
    }
    /**
     * Part-way through its follow a feinting lunge's lanes sink into the
     * dark and every body pounces at the raider they were chasing instead,
     * shown in full from that moment (the honesty rules apply to it as to any
     * new attack).
     */
    protected turnInkFeints() {
      const r = this.raid;
      for (const [cast, f] of this.inkFeints) {
        if (this.time < f.at) continue;
        this.inkFeints.delete(cast);
        const lanes = f.lanes.filter((w) => r.warnings.includes(w));
        const target = this.heroes().find((p) => p.id === f.target && p.hp > 0);
        const live = r.warnings.filter(
          (w) => !f.lanes.includes(w) && this.harmful(w),
        );
        if (!lanes.length || !target || live.length) continue;
        r.warnings = r.warnings.filter((w) => !f.lanes.includes(w));
        this.currentCast = cast;
        this.warnPounce(target, false);
        this.settleWarnings();
        this.currentCast = 0;
        this.inkReads.feints++;
        r.message = "A feint! The lunge sinks into the dark — it pounces.";
      }
    }

    /**
     * Nightfall: the yard goes dark. A pool of moonlight near each raider
     * (shared when one is already close), never under their feet: away from
     * where they usually dodge, else away from the boss, inside the court
     * and always within reach.
     */
    protected warnNightfall(teach: boolean) {
      const pools = this.moonPools(teach);
      return Object.assign(
        this.warn(
          "nightfall",
          W / 2,
          H / 2,
          W / 2,
          H / 2,
          0,
          A.nightfall.delay,
        ),
        { pools, teach },
      );
    }
    /** Nightfall's pools for the raiders standing now. */
    moonPools(teach: boolean): Pool[] {
      const N = A.nightfall,
        boss = this.boss();
      const alive = this.heroes().filter((p) => p.hp > 0);
      const near = teach ? N.teachNear : N.near,
        far = teach ? N.teachNear + 60 : N.far;
      const pad = N.poolRadius + 30;
      const pools: Pool[] = [];
      for (const p of alive) {
        // A pool already laid within reach serves this raider too.
        if (
          pools.some((q) => {
            const d = Math.hypot(q.x - p.x, q.y - p.y);
            return d >= N.poolRadius && d <= far + 40;
          })
        )
          continue;
        const habit = this.smart() ? this.inkHabitOf(p.id) : undefined;
        const away = habit
          ? { x: -habit.x, y: -habit.y }
          : boss
            ? normalize(p.x - boss.x || 1, p.y - boss.y || 0.01)
            : { x: 1, y: 0 };
        let best: Pool | undefined,
          score = -Infinity;
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2,
            dx = Math.cos(a),
            dy = Math.sin(a);
          for (const d of [far, (near + far) / 2, near]) {
            const x = p.x + dx * d,
              y = p.y + dy * d;
            if (x < pad || x > W - pad || y < pad || y > H - pad) continue;
            // Away from the habit (or the boss), clear of other raiders' feet.
            let s = dx * away.x + dy * away.y + d / 1000;
            if (
              alive.some(
                (q) =>
                  Math.hypot(q.x - x, q.y - y) < N.poolRadius + RULES.radius,
              )
            )
              s -= 1.5;
            if (s > score) {
              score = s;
              best = { x, y, radius: N.poolRadius };
            }
          }
        }
        if (habit) this.inkReads.pools++;
        pools.push(
          best ?? {
            x: clampX(p.x, pad),
            y: clampY(p.y + near, pad),
            radius: N.poolRadius,
          },
        );
      }
      return pools;
    }

    /**
     * Shade Pounce at `target`: the copies first (each at the raider nearest
     * it, a raider apiece while there are enough), the real one last,
     * `A.pounce.gap` apart; leaps at one raider chase them. Without copies,
     * or at a lone raider, the real one pounces twice. `only` limits it to the real one;
     * `extra` delays the whole pounce.
     */
    protected warnPounce(
      target: Fighter,
      teach: boolean,
      opts: { only?: boolean; extra?: number } = {},
    ) {
      const P = A.pounce,
        r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0);
      const copies = opts.only ? [] : (r.decoys ?? []).slice(0, P.copies);
      const plan: { body: number; prey: Fighter }[] = [];
      const taken = new Set<string>([target.id]);
      for (const d of copies) {
        const pool = alive.filter((p) => !taken.has(p.id));
        const prey = [...(pool.length ? pool : alive)].sort(
          (a, b) =>
            Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y),
        )[0];
        if (!prey) continue;
        taken.add(prey.id);
        plan.push({ body: d.id, prey });
      }
      plan.push({ body: 0, prey: target });
      // Without copies, or against a lone raider, the real one leaps twice.
      if ((!copies.length && !opts.only) || alive.length === 1)
        plan.push({ body: 0, prey: target });
      const delay = this.telegraph("pounce", P.delay);
      const extra = opts.extra ?? 0;
      const out: RaidWarning[] = [];
      // Leaps at one raider chase them: each lands a step further along the
      // way they usually dodge (or away from the boss), all marked at once.
      const chased = new Map<string, { at: Point; dir: Point }>();
      plan.forEach((step, k) => {
        const prev = chased.get(step.prey.id);
        let spot: Point;
        if (prev) {
          spot = {
            x: clampX(prev.at.x + prev.dir.x * P.radius * P.chase),
            y: clampY(prev.at.y + prev.dir.y * P.radius * P.chase),
          };
        } else spot = this.pounceSpot(step.prey, delay + extra + k * P.gap);
        if (!prev) {
          const habit = this.smart()
            ? this.inkHabitOf(step.prey.id)
            : undefined;
          const boss = this.boss()!;
          chased.set(step.prey.id, {
            at: spot,
            dir:
              habit ?? normalize(spot.x - boss.x || 1, spot.y - boss.y || 0.01),
          });
        } else chased.set(step.prey.id, { ...prev, at: spot });
        out.push(
          Object.assign(
            this.warn(
              "pounce",
              spot.x,
              spot.y,
              spot.x,
              spot.y,
              P.radius,
              P.delay,
            ),
            { targetId: step.prey.id, body: step.body, teach },
          ),
        );
      });
      // A copy's circle that leaves someone no way out is dropped (the real
      // one always leaps).
      const place = () =>
        out.forEach((w, k) => {
          w.chain = k + 1;
          w.at = w.startedAt! + delay + extra + k * P.gap;
        });
      place();
      while (out.length > 1 && !this.safeSpotExists(out)) {
        const drop = out.find((w) => w.body !== 0);
        if (!drop) break;
        out.splice(out.indexOf(drop), 1);
        r.warnings = r.warnings.filter((w) => w !== drop);
        place();
      }
      return out;
    }
    /** Where a pounce at `p` lands: ahead of a runner, else toward their habit. */
    protected pounceSpot(p: Fighter, land: number): Point {
      const led = this.lead(p, land);
      if (led.x !== p.x || led.y !== p.y) return led;
      const habit = this.smart() ? this.inkHabitOf(p.id) : undefined;
      if (habit) {
        this.inkReads.habits++;
        const k = A.pounce.radius * A.habit.offset;
        return { x: clampX(p.x + habit.x * k), y: clampY(p.y + habit.y * k) };
      }
      return { x: clampX(p.x), y: clampY(p.y) };
    }
    /** A body by its pounce id (0: the real one), and its drift index. */
    protected pounceBody(id: number) {
      if (!id) return { body: this.boss() as Point | undefined, index: 0 };
      const i = (this.raid.decoys ?? []).findIndex((d) => d.id === id);
      return { body: i >= 0 ? this.raid.decoys![i] : undefined, index: i + 1 };
    }

    protected override resolveWarning(w: RaidWarning, boss: Fighter) {
      if (!this.inkAscendant()) return super.resolveWarning(w, boss);
      const r = this.raid;
      if (w.kind === "nightfall") {
        const pools = w.pools ?? [];
        this.hitBy = "nightfall";
        for (const p of this.heroes())
          if (p.hp > 0 && !inMoonPool(p.x, p.y, pools) && !this.lit(p.x, p.y)) {
            this.damage(p, A.nightfall.damage, boss.id);
            this.addCurse(p);
          }
        this.hitBy = undefined;
        // The pools stay lit a while: light that cleanses and shows shadows.
        r.lights = [
          ...(r.lights ?? []),
          ...pools.map((p) => ({
            x: p.x,
            y: p.y,
            radius: p.radius,
            until: this.time + A.nightfall.linger,
            moon: true,
          })),
        ];
        this.event("raid-impact", w, 0x3a2470, undefined, boss.id);
        this.events[this.events.length - 1].raidRadius = 0;
        r.message = "Nightfall! Only the light holds the dark back.";
        // Chapter 3 (combosFrom.nightfall): every body pounces.
        const alive = this.heroes().filter((p) => p.hp > 0 && !this.inked(p));
        if (r.phase >= A.combosFrom.nightfall && this.smart() && alive.length) {
          const fresh = this.warnPounce(
            this.chooseTarget("pounce", alive),
            false,
          );
          for (const f of fresh) f.followUp = true;
          this.nextAttack = Math.max(
            this.nextAttack,
            Math.max(...fresh.map((f) => f.at)) + 0.6,
          );
        }
        return;
      }
      if (w.kind === "pounce") {
        const { body, index } = this.pounceBody(w.body ?? 0);
        const real = !w.body;
        this.hitBy = "pounce";
        for (const p of this.heroes())
          if (
            p.hp > 0 &&
            Math.hypot(p.x - w.x, p.y - w.y) < w.radius + RULES.radius
          ) {
            this.damage(
              p,
              real ? A.pounce.damage : A.pounce.copyDamage,
              boss.id,
            );
            if (!real) this.addCurse(p);
          }
        this.hitBy = undefined;
        if (body) {
          body.x = w.x;
          body.y = w.y;
          if (this.targets[index]) this.targets[index] = { x: w.x, y: w.y };
          if (this.driftAts.length === this.targets.length)
            this.driftAts[index] = Math.max(
              this.driftAts[index] ?? 0,
              this.time + G.driftEvery * 0.6,
            );
        }
        this.inkLeaps.delete(w);
        // The real one landing in lantern light casts its shadow.
        if (real && body && this.lit(w.x, w.y) && r.decoys?.length) {
          r.revealUntil = Math.max(
            r.revealUntil ?? 0,
            this.time + A.pounce.reveal,
          );
          this.inkReads.reveals++;
          r.message = "It landed in the light: its shadow gives it away!";
        }
        this.event(
          "raid-impact",
          w,
          real ? 0xb88aff : 0x7a5ad0,
          undefined,
          boss.id,
        );
        this.events[this.events.length - 1].raidRadius = w.radius;
        return;
      }
      super.resolveWarning(w, boss);
      if (!this.smart() || r.exposedUntil > this.time) return;
      const cast = this.currentCast;
      // A lunge ends in a pounce on the raider it chased (combosFrom.lunge).
      if (
        w.kind === "lunge" &&
        !w.followUp &&
        r.phase >= A.combosFrom.lunge &&
        !this.inkCombos.has(cast) &&
        !r.warnings.some((x) => x.kind === "pulse" || x.kind === "pounce")
      ) {
        const target = this.heroes().find(
          (p) => p.id === w.targetId && p.hp > 0,
        );
        if (target) {
          if (this.inkCombos.size > 64) this.inkCombos.clear();
          if (cast) this.inkCombos.add(cast);
          const fresh = this.warnPounce(target, false, {
            only: true,
            extra: this.comboDelay(A.pounce.delay),
          });
          for (const f of fresh) f.followUp = true;
        }
      }
      // A snuffed lantern's darkness lunges (combosFrom.snuff).
      if (w.kind === "snuff" && r.phase >= A.combosFrom.snuff) {
        const l = r.lanterns?.[w.lantern ?? -1];
        const alive = this.heroes().filter((p) => p.hp > 0 && !this.inked(p));
        if (l && !l.lit && alive.length) {
          const prey = [...alive].sort(
            (a, b) =>
              Math.hypot(a.x - l.x, a.y - l.y) -
              Math.hypot(b.x - l.x, b.y - l.y),
          )[0];
          const d = normalize(prey.x - l.x || 1, prey.y - l.y);
          const later = this.comboDelay(G.lunge.delay);
          const lane = Object.assign(
            this.warn(
              "lunge",
              l.x,
              l.y,
              l.x + d.x * G.lunge.length,
              l.y + d.y * G.lunge.length,
              G.lunge.width,
              G.lunge.delay,
            ),
            {
              targetId: prey.id,
              lockAt: this.time + later + G.lunge.delay * 0.5 - 0.05,
              followUp: true,
            },
          );
          lane.at += later;
          r.message = "The dark lantern's shadow lunges!";
        }
      }
    }
    /**
     * Extra delay so a combo of telegraph `seconds` lands at least
     * RAID_IMPACT_GAP after anything still live.
     */
    protected comboDelay(seconds: number) {
      const live = this.raid.warnings.filter((x) => this.harmful(x));
      if (!live.length) return 0;
      const last = Math.max(...live.map((x) => x.at));
      return Math.max(
        0,
        last + 0.5 - (this.time + this.telegraph("pounce", seconds)),
      );
    }

    // ------------------------------------------------------------ Each tick
    protected override attacksStep(dt: number) {
      if (!this.inkAscendant()) return super.attacksStep(dt);
      const r = this.raid;
      const staggered = r.staggerUntil;
      this.turnInkFeints();
      super.attacksStep(dt);
      // A stagger that started this step: a shorter window (the tier's windows).
      if (r.staggerUntil > staggered && this.smart()) {
        r.staggerUntil = this.time + this.window(RAID.staggerSeconds);
        r.exposedUntil = Math.max(r.exposedUntil, r.staggerUntil);
        this.nextAttack = r.staggerUntil + 0.4;
      }
      if (r.staggerUntil > this.time) this.inkFeints.clear();
      this.learnInkDodges();
    }
    /**
     * Pouncing bodies hold still while their circle fills, then leap onto
     * it in the last POUNCE_LEAP seconds.
     */
    protected override bossStep(dt: number, boss: Fighter) {
      if (!this.inkAscendant()) return super.bossStep(dt, boss);
      const pounces = this.raid.warnings.filter((w) => w.kind === "pounce");
      const bodies = this.copies();
      if (pounces.length && this.targets.length !== bodies.length) {
        this.targets = bodies.map((b) => ({ x: b.x, y: b.y }));
        this.driftAts = [];
      }
      for (const w of pounces) {
        const { body, index } = this.pounceBody(w.body ?? 0);
        if (body && this.targets[index])
          this.targets[index] = { x: body.x, y: body.y };
      }
      super.bossStep(dt, boss);
      for (const w of pounces) {
        const { body } = this.pounceBody(w.body ?? 0);
        if (!body || this.time < w.at - POUNCE_LEAP) continue;
        // A body that pounces twice makes its first leap first.
        if (pounces.some((o) => o !== w && o.body === w.body && o.at < w.at))
          continue;
        const from = this.inkLeaps.get(w) ?? { x: body.x, y: body.y };
        this.inkLeaps.set(w, from);
        const k = Math.min(1, 1 - (w.at - this.time) / POUNCE_LEAP);
        body.x = from.x + (w.x - from.x) * k;
        body.y = from.y + (w.y - from.y) * k;
      }
    }

    // ------------------------------------------------------------ Habit aim
    /**
     * Watch every raider standing in a fresh warning, and where they went by
     * the time it landed: the boss remembers the direction they dodge.
     */
    protected learnInkDodges() {
      const r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0);
      for (const w of r.warnings) {
        if (this.inkWatched.has(w)) continue;
        this.inkWatched.add(w);
        if (
          !this.harmful(w) ||
          !["circle", "line", "cone"].includes(raidShapeOf(w.kind))
        )
          continue;
        const inside = new Map<string, Point>();
        for (const p of alive)
          if (raidShapeHits(w, p.x, p.y, RULES.radius))
            inside.set(p.id, { x: p.x, y: p.y });
        if (inside.size) this.inkDodging.set(w, inside);
      }
      for (const [w, from] of this.inkDodging) {
        if (r.warnings.includes(w)) continue;
        this.inkDodging.delete(w);
        for (const [id, start] of from) {
          const p = alive.find((q) => q.id === id);
          if (!p) continue;
          const dx = p.x - start.x,
            dy = p.y - start.y;
          if (Math.hypot(dx, dy) >= 30) this.noteInkDodge(id, dx, dy);
        }
      }
    }
    /** Remember one dodge of raider `id` (also used by tests). */
    noteInkDodge(id: string, dx: number, dy: number) {
      const len = Math.hypot(dx, dy) || 1;
      const h = this.inkHabits.get(id) ?? { x: 0, y: 0, weight: 0, n: 0 };
      h.x = h.x * 0.6 + dx / len;
      h.y = h.y * 0.6 + dy / len;
      h.weight = h.weight * 0.6 + 1;
      h.n++;
      this.inkHabits.set(id, h);
    }
    /** The direction a raider usually dodges, once the boss trusts it. */
    inkHabitOf(id: string): Point | undefined {
      const h = this.inkHabits.get(id);
      if (!h || h.n < A.habit.samples) return undefined;
      const len = Math.hypot(h.x, h.y);
      if (len / h.weight < A.habit.consistency) return undefined;
      return { x: h.x / len, y: h.y / len };
    }

    // ---------------------------------------------------------- Other reads
    override damage(
      target: Fighter,
      amount: number,
      owner: string,
      ability?: Parameters<GloomshadeArena["damage"]>[3],
    ) {
      super.damage(target, amount, owner, ability);
      if (target.raidBoss && owner !== target.id && this.inkAscendant())
        this.inkHitAt.set(owner, this.time);
    }
    protected override trackMotion() {
      super.trackMotion();
      if (!this.inkAscendant()) return;
      for (const p of this.heroes()) {
        const still =
          p.hp > 0 && Math.hypot(p.vx ?? 0, p.vy ?? 0) < A.anchor.speed;
        if (!still) this.inkStill.delete(p.id);
        else if (!this.inkStill.has(p.id)) this.inkStill.set(p.id, this.time);
      }
    }
    /** Standing still while hitting the boss (for the anchor read). */
    inkAnchored(p: Fighter) {
      const since = this.inkStill.get(p.id);
      return (
        since !== undefined &&
        this.time - since >= A.anchor.still &&
        this.time - (this.inkHitAt.get(p.id) ?? -99) <= A.anchor.hit
      );
    }
    protected inkReviving(p: Fighter) {
      return this.heroes().some(
        (d) =>
          d.hp <= 0 &&
          !this.raid.downed[d.id]?.self &&
          Math.hypot(d.x - p.x, d.y - p.y) <= RAID.reviveRange,
      );
    }
    protected noteInkRead(kind: RaidAttack, target: Fighter) {
      if (!this.smart() || kind !== "pounce") return;
      if (this.inkReviving(target)) this.inkReads.revivers++;
      else if (this.inkAnchored(target)) this.inkReads.anchors++;
    }
    /** A pounce for a raider standing still to attack, or kneeling to revive. */
    protected override reactions(s: RaidSituation): RaidReaction[] {
      const out = super.reactions(s);
      if (!this.inkAscendant()) return out;
      for (const p of s.alive)
        if (this.inkAnchored(p) && !this.inked(p))
          out.push({ kind: "pounce", score: 1.5, target: p });
      for (const p of s.reviving)
        if (!this.inked(p)) out.push({ kind: "pounce", score: 1.6, target: p });
      return out;
    }
    /** The raider kneeling by a fallen ally comes first (pounces, lunges). */
    protected override chooseTarget(kind: RaidAttack, alive: Fighter[]) {
      if (
        this.inkAscendant() &&
        this.smart() &&
        alive.length > 1 &&
        (kind === "pounce" || kind === "lunge")
      ) {
        const reviver = alive
          .filter((p) => this.inkReviving(p) && !this.inked(p))
          .sort(
            (a, b) =>
              (this.threat.get(b.id) ?? 0) - (this.threat.get(a.id) ?? 0),
          )[0];
        if (reviver) return reviver;
      }
      return super.chooseTarget(kind, alive);
    }

    // ------------------------------------------------------------ Stand-ins
    /**
     * Stand-ins walk into light before Nightfall, and out of pounce circles
     * onto a lit tile while the hands close (one search for all of them).
     */
    protected override botHint(
      bot: Fighter,
      input: Input,
      go: (x: number, y: number, away: boolean) => Input,
    ): Input | undefined {
      if (!this.inkAscendant()) return super.botHint(bot, input, go);
      const r = this.raid;
      const night = r.warnings.find((w) => w.kind === "nightfall");
      const pounce = r.warnings.some((w) => w.kind === "pounce");
      if (!night && !pounce) return super.botHint(bot, input, go);
      const all = r.warnings.filter(
        (w) =>
          this.harmful(w) &&
          w.kind !== "nightfall" &&
          (w.kind === "hands" ||
            ["circle", "line", "cone"].includes(raidShapeOf(w.kind))),
      );
      // Inside a pool with room to spare (or lantern light), clear of the rest.
      const pools = (night?.pools ?? []).map((p) => ({
        ...p,
        radius: p.radius - 30,
      }));
      const safe = (x: number, y: number) =>
        this.inkClear(all, x, y) &&
        (!night || inMoonPool(x, y, pools) || this.lit(x, y));
      if (safe(bot.x, bot.y)) {
        input.dx = input.dy = 0;
        return input;
      }
      if (night) {
        const lights = [
          ...(night.pools ?? []),
          ...(r.lanterns ?? [])
            .filter((l) => l.lit)
            .map((l) => ({ x: l.x, y: l.y, radius: lanternRadius(r.trait) })),
        ].sort(
          (a, b) =>
            Math.hypot(a.x - bot.x, a.y - bot.y) -
            Math.hypot(b.x - bot.x, b.y - bot.y),
        );
        if (lights[0]) return go(lights[0].x, lights[0].y, false);
      }
      for (let reach = 30; reach <= 600; reach += 30)
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const x = bot.x + Math.cos(a) * reach,
            y = bot.y + Math.sin(a) * reach;
          if (safe(x, y)) return go(x, y, false);
        }
      return super.botHint(bot, input, go);
    }
  };
}

export class AscendantInkpurrArena extends AscendantInkpurrRules(
  GloomshadeArena,
) {
  constructor(code: string) {
    super(code, "gloomshade");
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
      r.maxHp = Math.round(r.maxHp / G.health.gilded);
      r.gilded = false;
    }
    const boss = this.boss();
    if (boss) Object.assign(boss, { hp: r.maxHp, name: A.name });
    this.resetInkReads();
    r.message = `${RAID_TRAITS[r.trait].name} ${A.name} · ${RAID_TRAITS[r.trait].text}`;
  }

  protected override finishMessage(won: boolean): string {
    return won
      ? "Dawn breaks over the Spire. Inkpurr's night is over."
      : "Ascendant Inkpurr's night goes on. Learn its reads and climb again.";
  }
}
