/**
 * Ascendant Prismell: the evolved prism-shelled snail on the Spire's
 * fiftieth floor (docs/spire: "Ascendant bosses"). The raid's Prismell
 * (Prismatail's id), pushed further through the same warning, relay and
 * honesty machinery, and built from its own rules (the skylight's beam is
 * passed raider to raider and through the mirrors into the heart; only a
 * held relay opens the shield):
 *
 * - New moves: the Eclipse (a dark moon covers the skylight: sunfall strikes
 *   its window and the light opens at another, shown from the start, so the
 *   team rebuilds the relay from there) and the Umbral Prism (a dark prism
 *   on a raider blocks the light through them; only light handed to them by
 *   a teammate or a mirror a step away cleanses it, before it shatters and
 *   the relay's hold is lost).
 * - Its rhythm tightens by chapter, the open shield lasts less, and halos
 *   come from the first chapter.
 * - Combos (ASCENDANT_PRISMELL.combosFrom): a Prism Lance that misses closes
 *   a Halo Crush round its raider; a landed Eclipse sends lances after
 *   whoever stood in the old light. Feints: a lance whose lane curls, part
 *   way, into a Halo Crush (shown in full from then).
 * - Reads: halos closing over the spot a raider usually dodges to, a lance
 *   for a raider standing still to attack, and the raider kneeling to revive
 *   first.
 * - Overlap: from chapter 2, lances and fans may fly while a halo closes;
 *   the safe-spot rule knows each shape exactly (lanes, the fan's hot slice,
 *   the halo's band and gap, sunfall) and keeps every spot it counts clear
 *   of a phone's touch controls; an attack that would leave none waits.
 * - Nothing a raider must see or reach sits under a phone's touch controls:
 *   the skylight windows, the mirrors, the heart (its rest spot), a halo's
 *   gap and every safe spot (ASCENDANT_PRISMELL.phoneControls).
 *
 * The rules are a layer (`AscendantPrismellRules`) over a Prismatail arena,
 * on while the raid is Prismell's Ascendant form (`isAscendant`) and the
 * raid's own hooks otherwise, so one arena can carry several Ascendants'
 * layers. `AscendantPrismellArena` is that layer always on:
 * createRaidArena(code, "prismatail", { variant: "ascendant" }) (server code
 * and tests only: clients can't ask for a variant).
 */
import { raidJitter } from "./raid.js";
import { PrismatailArena, prismDistanceToSegment } from "./raid-prismatail.js";
import {
  RULES,
  normalize,
  type Fighter,
  type Input,
} from "../../../packages/shared/src/index.js";
import {
  ASCENDANT_PRISMELL as A,
  PRISMATAIL as P,
  RAID,
  RAID_TRAITS,
  angleDifference,
  ascendantPrismellPattern,
  isAscendant,
  mirrorReaches,
  prismRayEnd,
  type LightPoint,
  type RaidAttack,
  type RaidWarning,
  type RelayNode,
} from "../../../packages/shared/src/raid.js";
import {
  RAID_REACTION,
  RAID_SLOWEST_SPEED,
  type RaidReaction,
  type RaidSituation,
} from "./raid-ai.js";

type Point = { x: number; y: number };
const W = RULES.width,
  H = RULES.height;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const inCourt = (x: number, y: number, pad: number = RULES.radius) =>
  x > pad && x < W - pad && y > pad && y < H - pad;

/** Warnings with a place on the floor (a raider can stand outside them). */
export const PRISM_SPATIAL = new Set<RaidAttack>([
  "prism-lance",
  "refraction",
  "fan-display",
  "halo-crush",
  "eclipse",
]);

/**
 * Is a disc (centre, radius) within `margin` of a phone's touch controls
 * (ASCENDANT_PRISMELL.phoneControls)? A point is a disc of radius 0.
 */
export function prismUnderControls(
  x: number,
  y: number,
  radius = 0,
  margin: number = A.controlMargin,
) {
  return A.phoneControls.some(([x0, y0, x1, y1]) => {
    const dx = Math.max(x0 - x, 0, x - x1),
      dy = Math.max(y0 - y, 0, y - y1);
    return (dx === 0 && dy === 0) || Math.hypot(dx, dy) < radius + margin;
  });
}

/**
 * Would a raider standing at (x, y) be inside this warning's hit (`pad`:
 * the raider's radius plus any margin)? The same tests the landing uses:
 * a lane, the fan's hot slice, the halo's band outside its gap, sunfall.
 */
export function prismShapeHits(
  w: RaidWarning,
  x: number,
  y: number,
  pad: number = RULES.radius,
) {
  const d = Math.hypot(x - w.x, y - w.y),
    a = Math.atan2(y - w.y, x - w.x);
  if (w.kind === "prism-lance" || w.kind === "refraction")
    return (
      prismDistanceToSegment({ x, y }, w, { x: w.tx, y: w.ty }) <=
      w.radius + pad
    );
  if (w.kind === "fan-display") {
    const n = w.prismCount ?? 6;
    return (
      d <= w.radius + pad &&
      angleDifference(a, ((w.prismIndex ?? 0) * Math.PI * 2) / n) <=
        Math.PI / n + Math.asin(Math.min(1, pad / Math.max(1, d)))
    );
  }
  if (w.kind === "halo-crush")
    return (
      Math.abs(d - w.radius) <= P.halo.width + pad &&
      angleDifference(a, w.gapAngle ?? 0) > P.halo.gap
    );
  if (w.kind === "eclipse") return d < w.radius + pad;
  return false;
}

/**
 * An Umbral Prism's timer for a raider the slowest pair needs `walk` px to
 * light: a reaction, the walk at the slowest speed, the light it must
 * soak, and a little to spare. Never under ASCENDANT_PRISMELL.umbral.min.
 */
export function umbralDelay(walk: number) {
  return Math.max(
    A.umbral.min,
    RAID_REACTION +
      Math.max(0, walk) / RAID_SLOWEST_SPEED +
      A.umbral.lit +
      A.umbral.spare,
  );
}

/** Rays tried round the straight one from a skylight to a marked raider (radians). */
const PLAN_TURNS = [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.3, -1.3, 1.8, -1.8];
PLAN_TURNS.push(2.4, -2.4, Math.PI);

/**
 * Where a marked raider and a teammate stand so the teammate hands them the
 * light: the teammate inside the skylight's reach on a ray from it, the
 * marked raider farther along that ray, `apart` to `range - 40` px past the
 * teammate (inside the court, clear of the phone's controls). Alone, the
 * marked raider walks into the skylight's reach. Returns the longest walk
 * either needs (the best ray and teammate), or Infinity if none fits.
 */
export function umbralPlan(
  m: Point,
  others: Point[],
  sources: readonly Point[],
  range: number,
): { walk: number; spot?: Point; feed?: Point } {
  let best: { walk: number; spot?: Point; feed?: Point } = { walk: Infinity };
  const near = range - 40;
  for (const s of sources) {
    const d = dist(m, s);
    if (!others.length) {
      const walk = Math.max(0, d - near);
      const u =
        d > 1 ? { x: (m.x - s.x) / d, y: (m.y - s.y) / d } : { x: 1, y: 0 };
      const k = Math.min(d, near);
      if (walk < best.walk)
        best = { walk, spot: { x: s.x + u.x * k, y: s.y + u.y * k } };
      continue;
    }
    const base = Math.atan2(m.y - s.y, m.x - s.x);
    for (const turn of PLAN_TURNS) {
      const ang = base + turn,
        u = { x: Math.cos(ang), y: Math.sin(ang) };
      const feed = { x: s.x + u.x * near, y: s.y + u.y * near };
      // along the ray: as far as the marked raider is, within the hand-off band
      const along = (m.x - s.x) * u.x + (m.y - s.y) * u.y;
      const k = Math.max(
        near + A.umbral.apart + 15,
        Math.min(2 * near - 10, along),
      );
      const spot = { x: s.x + u.x * k, y: s.y + u.y * k };
      if (
        !inCourt(feed.x, feed.y, 60) ||
        !inCourt(spot.x, spot.y, 60) ||
        prismUnderControls(feed.x, feed.y) ||
        prismUnderControls(spot.x, spot.y)
      )
        continue;
      const walk = Math.max(
        dist(m, spot),
        Math.min(...others.map((o) => dist(o, feed))),
      );
      if (walk < best.walk) best = { walk, spot, feed };
    }
  }
  return best;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismClass = new (...args: any[]) => PrismatailArena;

/** Ascendant Prismell's rules over `Base`, on while the raid is its Ascendant form. */
export function AscendantPrismellRules<B extends PrismClass>(Base: B) {
  return class AscendantPrismellRules extends Base {
    /** How often each read and new move was played this run (tests and balance logs). */
    prismReads = {
      habits: 0,
      anchors: 0,
      revivers: 0,
      feints: 0,
      eclipses: 0,
      umbrals: 0,
      cleansed: 0,
      shattered: 0,
      combos: 0,
    };
    /** Each raider's dodges: a decaying sum of directions and of weights. */
    protected prismHabits = new Map<
      string,
      { x: number; y: number; weight: number; n: number }
    >();
    protected prismDodging = new Map<RaidWarning, Map<string, Point>>();
    protected prismWatched = new WeakSet<RaidWarning>();
    protected prismStill = new Map<string, number>();
    protected prismHitAt = new Map<string, number>();
    /** Casts whose lance already closed a halo. */
    protected prismCombos = new Set<number>();
    /** Lances that will turn into a Halo Crush (by cast), and when. */
    protected prismFeints = new Map<
      number,
      { at: number; target: string; lane: RaidWarning }
    >();
    /** Where a live Eclipse moves the skylights as it lands. */
    protected eclipseTo?: LightPoint[];
    /** What each Umbral Prism's timer was last fitted to (raiders, skylights). */
    protected umbralFit = new Map<number, string>();

    /** Are the Ascendant's rules on? (Off: every hook is the raid's own.) */
    protected prismAscendant() {
      return isAscendant(this.raid, "prismatail");
    }
    /** A new fight: forget the last one's reads. */
    resetPrismReads() {
      for (const k of Object.keys(this.prismReads))
        this.prismReads[k as keyof typeof this.prismReads] = 0;
      this.prismHabits.clear();
      this.prismDodging.clear();
      this.prismStill.clear();
      this.prismHitAt.clear();
      this.prismCombos.clear();
      this.prismFeints.clear();
      this.umbralFit.clear();
      this.eclipseTo = undefined;
    }

    // ---------------------------------------------------------- Numbers
    /** The Ascendant tier, with its own revive length (see ASCENDANT_PRISMELL). */
    protected override tier() {
      const t = super.tier();
      return this.prismAscendant() && this.smart()
        ? { ...t, reviveSeconds: A.reviveSeconds }
        : t;
    }
    /** Health per extra raider (see ASCENDANT_PRISMELL.perExtraPlayer). */
    protected override bossMaxHp() {
      const r = this.raid;
      if (!this.prismAscendant() || r.partySize <= 1) return super.bossMaxHp();
      const base = super.bossMaxHp(),
        extra = r.partySize - 1;
      return Math.round(
        (base * (P.health.base + A.perExtraPlayer * extra)) /
          (P.health.base + P.health.perExtraPlayer * extra),
      );
    }
    protected override pattern() {
      if (!this.prismAscendant()) return super.pattern();
      return ascendantPrismellPattern(this.raid.phase, this.raid.trait);
    }
    /** Tighter rhythm by chapter. */
    protected override cadence() {
      const base = super.cadence();
      if (!this.prismAscendant() || !this.smart()) return base;
      const extra = Math.max(0, this.raid.partySize - 1);
      return (
        base *
        A.cadence[Math.max(0, Math.min(2, this.raid.phase - 1))] *
        (1 - A.partyCadence * extra)
      );
    }
    /** Its hits by party size (see ASCENDANT_PRISMELL.damage). */
    protected override bossDamage() {
      const base = super.bossDamage();
      if (!this.prismAscendant() || !this.smart()) return base;
      const size = Math.max(1, Math.min(4, this.raid.partySize));
      return (
        base *
        A.damage[size - 1] *
        (1 + A.partyDamage * Math.max(0, this.raid.partySize - 1))
      );
    }
    /** A party's punish windows (see ASCENDANT_PRISMELL.partyWindows). */
    protected override window(seconds: number) {
      const base = super.window(seconds);
      if (!this.prismAscendant() || !this.smart()) return base;
      return base * (1 + A.partyWindows * Math.max(0, this.raid.partySize - 1));
    }
    /** The open shield: shorter than the raid's, longer for a party. */
    protected override exposeSeconds() {
      if (!this.prismAscendant() || !this.smart()) return super.exposeSeconds();
      return (
        A.expose * (1 + A.partyWindows * Math.max(0, this.raid.partySize - 1)) +
        (this.raid.trait === "kaleidoscope" ? 1 : 0)
      );
    }
    /** It rests where its heart stays clear of a phone's controls. */
    protected override restX() {
      if (!this.prismAscendant()) return super.restX();
      return A.home[Math.max(0, Math.min(2, this.raid.phase - 1))];
    }
    /** An Umbral Prism's timer keeps its length (it waits for the walk). */
    protected override telegraph(kind: RaidAttack, seconds: number) {
      return kind === "umbral-prism" && this.prismAscendant()
        ? seconds
        : super.telegraph(kind, seconds);
    }
    protected override clearAttacks() {
      super.clearAttacks();
      this.prismFeints?.clear();
      this.umbralFit?.clear();
      this.eclipseTo = undefined;
      // A new chapter (or fight) lights the raid's own skylights again.
      this.raid.lightSources = undefined;
    }

    // ---------------------------------------------------------- The light
    /** The skylights: where an Eclipse moved them, else the raid's. */
    protected override relaySources(): Point[] {
      const moved = this.prismAscendant() ? this.raid.lightSources : undefined;
      return moved?.length
        ? moved.map((s) => ({ ...s }))
        : super.relaySources();
    }
    /** Raiders under an Umbral Prism carry no light (it stops in them). */
    protected override relayNodes(angles?: number[]): RelayNode[] {
      const nodes = super.relayNodes(angles);
      if (!this.prismAscendant()) return nodes;
      const dimmed = this.dimmed();
      return dimmed.size ? nodes.filter((n) => !dimmed.has(n.id)) : nodes;
    }
    /** Raiders carrying a live Umbral Prism. */
    protected dimmed() {
      const out = new Set<string>();
      for (const w of this.raid.warnings)
        if (w.kind === "umbral-prism" && w.targetId) out.add(w.targetId);
      return out;
    }
    /** Is the skylight shining now (not while the heart is open or relit)? */
    protected sunUp() {
      return this.time >= this.relayAt && this.raid.exposedUntil <= this.time;
    }
    /**
     * Does handed-on light reach `m` now, and from where? Light spreads from
     * the skylights to raiders in reach, from raiders to anything in their
     * reach and from mirrors along their arrows (as the relay's). In a party
     * it must come from a teammate, mirror or Sun Pillar at least `apart`
     * away; alone, the skylight's own reach lights them.
     */
    umbralLight(m: Fighter): { lit: boolean; from?: Point } {
      if (!this.sunUp()) return { lit: false };
      const range = this.relayRange(),
        sources = this.relaySources();
      const alive = this.heroes().filter((p) => p.hp > 0);
      if (alive.length <= 1) {
        const s = sources.find((q) => dist(q, m) <= range);
        return s ? { lit: true, from: s } : { lit: false };
      }
      const nodes = this.relayNodes().filter((n) => n.id !== m.id);
      const reached: RelayNode[] = [];
      const seen = new Set<string>();
      for (const s of sources)
        for (const n of nodes)
          if (n.player && !seen.has(n.id) && dist(n, s) <= range) {
            seen.add(n.id);
            reached.push(n);
          }
      const passes = (from: RelayNode, to: Point) =>
        dist(from, to) <= (from.range ?? range) &&
        (from.angle === undefined ||
          mirrorReaches({ ...from, angle: from.angle }, to));
      for (let i = 0; i < reached.length && i < 64; i++)
        for (const n of nodes)
          if (!seen.has(n.id) && passes(reached[i], n)) {
            seen.add(n.id);
            reached.push(n);
          }
      const from = reached
        .filter((n) => dist(n, m) >= A.umbral.apart && passes(n, m))
        .sort((a, b) => dist(a, m) - dist(b, m))[0];
      return from
        ? { lit: true, from: { x: from.x, y: from.y } }
        : { lit: false };
    }
    /** How the slowest pair would light `m` (see `umbralPlan`). */
    umbralPlanFor(m: Fighter) {
      const others = this.heroes()
        .filter((p) => p.hp > 0 && p.id !== m.id)
        .filter((p) => !this.dimmed().has(p.id));
      const alone = this.heroes().filter((p) => p.hp > 0).length <= 1;
      return umbralPlan(
        m,
        alone ? [] : others,
        this.relaySources(),
        this.relayRange(),
      );
    }
    /** What an Umbral Prism's timer depends on (raiders up, skylights). */
    protected umbralKey() {
      const alive = this.heroes().filter((p) => p.hp > 0).length;
      return `${alive}|${this.relaySources()
        .map((s) => `${s.x},${s.y}`)
        .join(";")}`;
    }

    // -------------------------------------------------------- Overlap
    /** From chapter 2, with a party, a lance or fan may fly while a halo closes. */
    protected override exclusive(kind: RaidAttack) {
      const r = this.raid;
      if (
        this.prismAscendant() &&
        this.smart() &&
        kind === "halo-crush" &&
        r.phase >= A.overlap.from &&
        this.heroes().filter((p) => p.hp > 0).length >= A.overlap.raiders
      )
        return false;
      return super.exclusive(kind);
    }
    /** One Umbral Prism at a time, and only while the skylight shines. */
    protected override allows(kind: RaidAttack) {
      if (!this.prismAscendant()) return super.allows(kind);
      if (kind === "umbral-prism")
        return (
          this.sunUp() &&
          !this.raid.warnings.some(
            (w) => w.kind === "umbral-prism" || w.kind === "eclipse",
          )
        );
      if (kind === "eclipse")
        return !this.raid.warnings.some((w) => w.kind === "eclipse");
      return super.allows(kind);
    }
    /**
     * Is (x, y) a spot a raider can rely on? Inside the court, clear of the
     * phone's controls, and outside every lane, the fan's hot slice, the
     * halo's band (its gap is safe) and sunfall.
     */
    prismClear(shapes: RaidWarning[], x: number, y: number) {
      if (!inCourt(x, y) || prismUnderControls(x, y, 0, 0)) return false;
      for (const w of shapes)
        if (prismShapeHits(w, x, y, RULES.radius + 4)) return false;
      return true;
    }
    /** The nearest safe spot within `reach` of `p` (see `prismClear`). */
    prismSpotNear(shapes: RaidWarning[], p: Point, reach: number) {
      if (this.prismClear(shapes, p.x, p.y)) return { x: p.x, y: p.y };
      for (const f of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1])
        for (let i = 0; i < 32; i++) {
          const a = (i / 32) * Math.PI * 2;
          const x = p.x + Math.cos(a) * reach * f,
            y = p.y + Math.sin(a) * reach * f;
          if (this.prismClear(shapes, x, y)) return { x, y };
        }
      return undefined;
    }
    /**
     * Every raider can reach a safe spot before the first of these lands
     * (slowest champion, after a 0.45 s reaction): see `prismClear`.
     */
    override safeSpotExists(
      shapes: RaidWarning[] = this.raid.warnings,
      slack = 0,
    ) {
      if (!this.prismAscendant()) return super.safeSpotExists(shapes, slack);
      const live = shapes.filter((w) => PRISM_SPATIAL.has(w.kind));
      if (!live.length) return true;
      const first = Math.min(...live.map((w) => w.at));
      const reach =
        RAID_SLOWEST_SPEED *
        Math.max(0, first - this.time - RAID_REACTION - slack);
      return this.heroes()
        .filter((p) => p.hp > 0)
        .every((p) => !!this.prismSpotNear(live, p, reach));
    }
    /**
     * The raid's overlap spacing, then the Ascendant's safe-spot rule with a
     * little slack: else the new attack waits until the older ones landed.
     */
    protected override spaceOverlap(fresh: RaidWarning[]) {
      super.spaceOverlap(fresh);
      if (!this.prismAscendant()) return;
      const mine = fresh.filter((w) => PRISM_SPATIAL.has(w.kind));
      const old = this.raid.warnings.filter(
        (w) => !fresh.includes(w) && PRISM_SPATIAL.has(w.kind),
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
      }
    }
    /**
     * A follow-up of `fresh` warnings: it lands at least RAID_IMPACT_GAP
     * after anything still live, and after all of it (plus a second) if
     * together they would leave someone no way out.
     */
    protected placeFollowUp(fresh: RaidWarning[]) {
      const live = this.raid.warnings.filter(
        (w) => !fresh.includes(w) && PRISM_SPATIAL.has(w.kind),
      );
      if (!live.length || !fresh.length) return;
      const last = Math.max(...live.map((x) => x.at));
      const first = Math.min(...fresh.map((x) => x.at));
      let shift = Math.max(0, last + 0.5 - first);
      for (const w of fresh) w.at += shift;
      if (!this.safeSpotExists([...live, ...fresh], 0.1)) {
        shift = Math.max(0, last + 1 - Math.min(...fresh.map((x) => x.at)));
        for (const w of fresh) w.at += shift;
      }
    }

    // ---------------------------------------------------------- Attacks
    protected override startAttack(kind: RaidAttack, target: Fighter) {
      if (!this.prismAscendant()) return super.startAttack(kind, target);
      const r = this.raid,
        boss = this.boss()!;
      this.notePrismRead(kind, target);
      if (
        kind === "eclipse" ||
        kind === "umbral-prism" ||
        kind === "halo-crush"
      ) {
        const seen = this.seenAttacks.get(kind) ?? 0;
        this.seenAttacks.set(kind, seen + 1);
        boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
        if (kind === "eclipse") this.warnEclipse(seen < 2);
        else if (kind === "umbral-prism") this.warnUmbral(target, seen < 2);
        else this.warnHalo(target, seen < 2);
        return;
      }
      const before = new Set(r.warnings);
      super.startAttack(kind, target);
      if (kind !== "prism-lance") return;
      const lane = r.warnings.find(
        (w) => w.kind === "prism-lance" && !before.has(w),
      );
      if (!lane) return;
      lane.targetId = target.id;
      // A lance on its own may be a feint (shown in full when it turns).
      const others = [...before].some((w) => PRISM_SPATIAL.has(w.kind));
      if (this.smart() && !lane.teach && !others && this.prismFeintRoll()) {
        const start = lane.startedAt ?? this.time;
        this.prismFeints.set(this.currentCast, {
          at: start + (lane.at - start) * A.feint.turnAt,
          target: target.id,
          lane,
        });
      }
    }
    /** Is this lance a feint? A seeded roll per chapter. */
    protected prismFeintRoll() {
      const r = this.raid;
      const chance = A.feint.chance[Math.max(0, Math.min(2, r.phase - 1))];
      return raidJitter(r.seed ^ 0x9f15, this.attacks, 17) < chance;
    }
    /**
     * Part-way through, a feinting lance's lane curls away and a Halo Crush
     * closes round its raider instead, shown in full from that moment (the
     * honesty rules apply to it as to any new attack).
     */
    protected turnPrismFeints() {
      const r = this.raid;
      for (const [cast, f] of this.prismFeints) {
        if (this.time < f.at) continue;
        this.prismFeints.delete(cast);
        const target = this.heroes().find((p) => p.id === f.target && p.hp > 0);
        const live = r.warnings.filter(
          (w) => w !== f.lane && PRISM_SPATIAL.has(w.kind),
        );
        if (!r.warnings.includes(f.lane) || !target || live.length) continue;
        r.warnings = r.warnings.filter((w) => w !== f.lane);
        this.currentCast = cast;
        this.warnHalo(target, false);
        this.settleWarnings();
        this.currentCast = 0;
        this.prismReads.feints++;
        r.message = "A feint! The lance curls into a halo.";
      }
    }
    /**
     * Halo Crush round `target`. Once the boss trusts a raider's habit, the
     * ring passes over the spot they usually dodge to (standing still stays
     * safe: they are inside it). Its gap opens onto the floor, never under a
     * phone's controls.
     */
    protected warnHalo(target: Fighter, teach: boolean, followUp = false) {
      const habit = this.smart() ? this.prismHabitOf(target.id) : undefined;
      let c: Point = { x: target.x, y: target.y };
      if (habit) {
        const back = P.halo.radius * A.habit.offset;
        c = {
          x: Math.max(80, Math.min(W - 80, target.x - habit.x * back)),
          y: Math.max(80, Math.min(H - 80, target.y - habit.y * back)),
        };
        this.prismReads.habits++;
      }
      const w = Object.assign(
        this.warn(
          "halo-crush",
          c.x,
          c.y,
          c.x,
          c.y,
          P.halo.radius,
          P.halo.delay,
        ),
        {
          gapAngle: this.haloGap(c, target),
          teach,
          targetId: target.id,
          ...(followUp ? { followUp: true } : {}),
        },
      );
      return w;
    }
    /** The raid's gap rule, skipping gaps that open under the phone's controls. */
    protected override haloGap(centre: Point, target: Fighter) {
      if (!this.prismAscendant()) return super.haloGap(centre, target);
      const toward = Math.atan2(450 - centre.y, 800 - centre.x);
      const others = this.heroes().filter(
          (p) => p.hp > 0 && Math.abs(dist(p, centre) - P.halo.radius) < 140,
        ),
        speed = Math.hypot(target.vx, target.vy),
        heading = Math.atan2(target.vy, target.vx);
      let best = toward,
        bestCost = Infinity;
      for (let k = 0; k < 16; k++) {
        const a = toward + (k * Math.PI) / 8,
          gx = centre.x + Math.cos(a) * (P.halo.radius + 40),
          gy = centre.y + Math.sin(a) * (P.halo.radius + 40);
        if (gx < 60 || gx > W - 60 || gy < 60 || gy > H - 60) continue;
        const gap = {
          x: centre.x + Math.cos(a) * P.halo.radius,
          y: centre.y + Math.sin(a) * P.halo.radius,
        };
        if (prismUnderControls(gap.x, gap.y, P.halo.width)) continue;
        let cost = k ? 0.01 : 0;
        for (const p of others)
          cost += Math.max(
            0,
            Math.cos(Math.atan2(p.y - centre.y, p.x - centre.x) - a),
          );
        if (speed > 60) cost += 0.75 * (1 + Math.cos(heading - a));
        if (cost < bestCost) {
          bestCost = cost;
          best = a;
        }
      }
      return best;
    }
    /**
     * The fan's hot slice: the one over the most raiders that leaves every
     * raider a safe spot in reach (clear of the phone's controls); the
     * raid's rule if none does.
     */
    protected override fanSlice(boss: Fighter, count: number) {
      if (!this.prismAscendant()) return super.fanSlice(boss, count);
      const r = this.raid,
        seeded = (r.seed + this.attacks) % count;
      const alive = this.heroes().filter((p) => p.hp > 0);
      let best = -1,
        bestScore = -Infinity;
      for (let k = 0; k < count; k++) {
        const i = (seeded + k) % count;
        const w = {
          id: -1,
          kind: "fan-display",
          x: boss.x,
          y: boss.y,
          tx: boss.x,
          ty: boss.y,
          radius: P.fan.radius,
          at: this.time + this.telegraph("fan-display", P.fan.delay),
          prismIndex: i,
          prismCount: count,
        } as RaidWarning;
        if (!this.safeSpotExists([w])) continue;
        const score = alive.filter((p) => prismShapeHits(w, p.x, p.y)).length;
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }
      return best >= 0 ? best : super.fanSlice(boss, count);
    }
    /**
     * Eclipse: sunfall on every skylight now (a circle round each), and the
     * light opens at another window (one of the same kind: one skylight, or
     * the last chapter's pair), shown from the start.
     */
    protected warnEclipse(teach: boolean) {
      const r = this.raid;
      const now = this.relaySources();
      const sets = now.length > 1 ? A.windows.pair : A.windows.single;
      const here = (set: readonly LightPoint[]) =>
        set.length === now.length && set.every((p, i) => dist(p, now[i]) < 1);
      const options = sets.filter((set) => !here(set));
      const pick =
        options[
          Math.floor(
            raidJitter(r.seed ^ 0xec11, this.attacks, 3) * options.length,
          ) % options.length
        ] ?? sets[0];
      const out: RaidWarning[] = [];
      now.forEach((old, i) => {
        const to = pick[i] ?? pick[0];
        out.push(
          Object.assign(
            this.warn(
              "eclipse",
              old.x,
              old.y,
              to.x,
              to.y,
              A.eclipse.radius,
              A.eclipse.delay,
            ),
            { teach },
          ),
        );
      });
      this.eclipseTo = pick.map((p) => ({ ...p }));
      this.prismReads.eclipses++;
      r.message =
        "Eclipse! The skylight goes dark: the light opens at the gold window.";
      return out;
    }
    /**
     * Umbral Prism: a dark prism on `target` (and, with three raiders or
     * more from chapter 2, on the raider farthest from them). Each timer
     * lets the slowest pair walk into place after a reaction.
     */
    protected warnUmbral(target: Fighter, teach: boolean) {
      const r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0);
      const chapter = Math.max(0, Math.min(2, r.phase - 1));
      const marks =
        alive.length >= 4
          ? A.umbral.marksFour[chapter]
          : alive.length >= 3
            ? A.umbral.marks[Math.max(0, Math.min(2, r.phase - 1))]
            : 1;
      const targets = [target];
      // more marks: the raiders farthest from the marked ones
      while (targets.length < marks) {
        const far = alive
          .filter((p) => !targets.includes(p))
          .sort(
            (a, b) =>
              Math.min(...targets.map((t) => dist(b, t))) -
              Math.min(...targets.map((t) => dist(a, t))),
          )[0];
        if (!far) break;
        targets.push(far);
      }
      const out: RaidWarning[] = [];
      for (const t of targets) {
        const w = Object.assign(
          this.warn(
            "umbral-prism",
            t.x,
            t.y,
            t.x,
            t.y,
            A.umbral.radius,
            A.umbral.min,
          ),
          { targetId: t.id, lit: 0, teach },
        );
        out.push(w);
      }
      // fitted once all marks are down (a second mark blocks the first's light)
      for (const w of out) this.fitUmbral(w);
      this.prismReads.umbrals++;
      r.message =
        targets.length > 1
          ? `Umbral Prisms on ${targets.map((t) => t.name).join(" and ")}! Hand them the light.`
          : `Umbral Prism on ${target.name}! ${alive.length > 1 ? "Hand them the light from a step away." : "Stand in the skylight's light."}`;
      return out;
    }
    /** Give an Umbral Prism the time the slowest pair needs from now. */
    protected fitUmbral(w: RaidWarning) {
      const p = this.heroes().find((q) => q.id === w.targetId && q.hp > 0);
      if (!p) return;
      const plan = this.umbralPlanFor(p);
      const need = Number.isFinite(plan.walk)
        ? umbralDelay(plan.walk)
        : umbralDelay(1200);
      w.at = Math.max(w.at, this.time + need - (w.lit ?? 0));
      this.umbralFit.set(w.id, this.umbralKey());
    }

    protected override resolveWarning(w: RaidWarning, boss: Fighter) {
      if (!this.prismAscendant()) return super.resolveWarning(w, boss);
      const r = this.raid;
      if (w.kind === "eclipse") {
        this.hitBy = "eclipse";
        for (const p of this.heroes())
          if (p.hp > 0 && dist(p, w) < w.radius + RULES.radius)
            this.damage(p, A.eclipse.damage, boss.id);
        this.hitBy = undefined;
        this.event("raid-impact", w, 0xffb347, undefined, boss.id);
        this.events[this.events.length - 1].raidRadius = Math.min(
          180,
          w.radius,
        );
        const to = this.eclipseTo;
        if (!to) return;
        // The last sunfall of the cast: the light opens at the new window.
        const old = this.relaySources();
        this.eclipseTo = undefined;
        r.lightSources = to;
        this.held = 0;
        this.arrivals = [];
        r.lightHold = 0;
        r.lightStartedAt = undefined;
        for (const s of to) this.event("heal", s, 0xfff0b0, 0, boss.id);
        r.message = "The light opens at a new window! Rebuild the relay.";
        // Chapter 2 on: lances chase whoever stood in the old light.
        if (this.smart() && r.phase >= A.combosFrom.eclipse) {
          const range = this.relayRange();
          const chased = this.heroes()
            .filter((p) => p.hp > 0 && old.some((s) => dist(s, p) <= range))
            .slice(0, A.comboLances);
          const fresh: RaidWarning[] = [];
          for (const p of chased) {
            const aim = this.lanceAim(p, P.lance.delay);
            const tip = prismRayEnd(boss, aim);
            fresh.push(
              Object.assign(
                this.warn(
                  "prism-lance",
                  boss.x,
                  boss.y,
                  tip.x,
                  tip.y,
                  P.lance.width,
                  P.lance.delay,
                ),
                { followUp: true, targetId: p.id },
              ),
            );
          }
          if (fresh.length) {
            this.placeFollowUp(fresh);
            this.prismReads.combos++;
            r.message = "Lances chase the old light!";
          }
        }
        return;
      }
      if (w.kind === "umbral-prism") {
        const p = this.heroes().find((q) => q.id === w.targetId && q.hp > 0);
        this.umbralFit.delete(w.id);
        if (!p) return;
        this.hitBy = "umbral-prism";
        this.damage(p, A.umbral.damage, boss.id);
        this.hitBy = undefined;
        (r.blinded ??= {})[p.id] = this.time + P.glare.blind;
        this.held = 0;
        r.lightHold = 0;
        this.prismReads.shattered++;
        this.event("raid-impact", p, 0x5a3c8c, undefined, boss.id);
        this.events[this.events.length - 1].raidRadius = A.umbral.radius;
        r.message = `${p.name}'s Umbral Prism shatters! The relay's hold is lost.`;
        return;
      }
      super.resolveWarning(w, boss);
      if (
        w.kind !== "prism-lance" ||
        !this.smart() ||
        r.exposedUntil > this.time
      )
        return;
      // A lance that misses closes a halo round its raider.
      const cast = this.currentCast;
      const target = this.heroes().find((p) => p.id === w.targetId && p.hp > 0);
      if (
        !target ||
        w.followUp ||
        r.phase < A.combosFrom.lance ||
        (cast && this.prismCombos.has(cast)) ||
        prismDistanceToSegment(target, w, { x: w.tx, y: w.ty }) <=
          w.radius + RULES.radius
      )
        return;
      if (this.prismCombos.size > 64) this.prismCombos.clear();
      if (cast) this.prismCombos.add(cast);
      const halo = this.warnHalo(target, false, true);
      this.placeFollowUp([halo]);
      this.nextAttack = Math.max(this.nextAttack, halo.at + 0.3);
      this.prismReads.combos++;
    }

    // -------------------------------------------------------- Each tick
    protected override attacksStep(dt: number) {
      if (!this.prismAscendant()) return super.attacksStep(dt);
      this.turnPrismFeints();
      super.attacksStep(dt);
      this.learnPrismDodges();
    }
    /**
     * After the relay: each Umbral Prism follows its raider, fills while
     * handed-on light reaches them (else fades) and is cleansed when full.
     * A team that changed (a teammate fell, the skylights moved) gets the
     * time it now needs.
     */
    protected override worldStep(dt: number, boss: Fighter) {
      super.worldStep(dt, boss);
      if (!this.prismAscendant()) return;
      const r = this.raid;
      for (const w of [...r.warnings]) {
        if (w.kind !== "umbral-prism") continue;
        const p = this.heroes().find((q) => q.id === w.targetId && q.hp > 0);
        if (!p) {
          r.warnings = r.warnings.filter((x) => x !== w);
          continue;
        }
        w.x = w.tx = p.x;
        w.y = w.ty = p.y;
        const light = this.umbralLight(p);
        if (light.lit && light.from) {
          w.lit = (w.lit ?? 0) + dt;
          w.tx = light.from.x;
          w.ty = light.from.y;
        } else w.lit = Math.max(0, (w.lit ?? 0) - dt * A.umbral.decay);
        if ((w.lit ?? 0) >= A.umbral.lit) {
          r.warnings = r.warnings.filter((x) => x !== w);
          this.umbralFit.delete(w.id);
          this.prismReads.cleansed++;
          this.event("heal", p, 0xffe9a0, 0, p.id);
          r.message = `${p.name}'s Umbral Prism is cleansed!`;
          continue;
        }
        if (this.umbralFit.get(w.id) !== this.umbralKey()) this.fitUmbral(w);
      }
    }
    protected override onChapter() {
      super.onChapter();
      this.raid.lightSources = undefined;
      this.eclipseTo = undefined;
    }

    // -------------------------------------------------------- Habit aim
    /** Where each raider went from inside a fresh warning, by the time it landed. */
    protected learnPrismDodges() {
      const r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0);
      for (const w of r.warnings) {
        if (this.prismWatched.has(w)) continue;
        this.prismWatched.add(w);
        if (!PRISM_SPATIAL.has(w.kind)) continue;
        const inside = new Map<string, Point>();
        for (const p of alive)
          if (prismShapeHits(w, p.x, p.y)) inside.set(p.id, { x: p.x, y: p.y });
        if (inside.size) this.prismDodging.set(w, inside);
      }
      for (const [w, from] of this.prismDodging) {
        if (r.warnings.includes(w)) continue;
        this.prismDodging.delete(w);
        for (const [id, start] of from) {
          const p = alive.find((q) => q.id === id);
          if (!p) continue;
          const dx = p.x - start.x,
            dy = p.y - start.y;
          if (Math.hypot(dx, dy) >= 30) this.notePrismDodge(id, dx, dy);
        }
      }
    }
    /** Remember one dodge of raider `id` (also used by tests). */
    notePrismDodge(id: string, dx: number, dy: number) {
      const len = Math.hypot(dx, dy) || 1;
      const h = this.prismHabits.get(id) ?? { x: 0, y: 0, weight: 0, n: 0 };
      h.x = h.x * 0.6 + dx / len;
      h.y = h.y * 0.6 + dy / len;
      h.weight = h.weight * 0.6 + 1;
      h.n++;
      this.prismHabits.set(id, h);
    }
    /** The direction a raider usually dodges, once the boss trusts it. */
    prismHabitOf(id: string): Point | undefined {
      const h = this.prismHabits.get(id);
      if (!h || h.n < A.habit.samples) return undefined;
      const len = Math.hypot(h.x, h.y);
      if (len / h.weight < A.habit.consistency) return undefined;
      return { x: h.x / len, y: h.y / len };
    }

    // ------------------------------------------------------ Other reads
    override damage(
      target: Fighter,
      amount: number,
      owner: string,
      ability?: Parameters<PrismatailArena["damage"]>[3],
    ) {
      super.damage(target, amount, owner, ability);
      if (target.raidBoss && owner !== target.id && this.prismAscendant())
        this.prismHitAt.set(owner, this.time);
    }
    protected override trackMotion() {
      super.trackMotion();
      if (!this.prismAscendant()) return;
      for (const p of this.heroes()) {
        const still =
          p.hp > 0 && Math.hypot(p.vx ?? 0, p.vy ?? 0) < A.anchor.speed;
        if (!still) this.prismStill.delete(p.id);
        else if (!this.prismStill.has(p.id))
          this.prismStill.set(p.id, this.time);
      }
    }
    /** Standing still while hitting the boss (for the anchor read). */
    prismAnchored(p: Fighter) {
      const since = this.prismStill.get(p.id);
      return (
        since !== undefined &&
        this.time - since >= A.anchor.still &&
        this.time - (this.prismHitAt.get(p.id) ?? -99) <= A.anchor.hit
      );
    }
    protected prismReviving(p: Fighter) {
      return this.heroes().some(
        (d) =>
          d.hp <= 0 &&
          !this.raid.downed[d.id]?.self &&
          Math.hypot(d.x - p.x, d.y - p.y) <= RAID.reviveRange,
      );
    }
    protected notePrismRead(kind: RaidAttack, target: Fighter) {
      if (
        !this.smart() ||
        (kind !== "prism-lance" &&
          kind !== "halo-crush" &&
          kind !== "umbral-prism")
      )
        return;
      if (this.prismReviving(target)) this.prismReads.revivers++;
      else if (kind === "prism-lance" && this.prismAnchored(target))
        this.prismReads.anchors++;
    }
    /** A lance for a raider standing still to attack, or kneeling to revive. */
    protected override reactions(s: RaidSituation): RaidReaction[] {
      const out = super.reactions(s);
      if (!this.prismAscendant()) return out;
      for (const p of s.alive)
        if (this.prismAnchored(p))
          out.push({ kind: "prism-lance", score: 1.5, target: p });
      for (const p of s.reviving)
        out.push({ kind: "prism-lance", score: 1.6, target: p });
      return out;
    }
    /** The raider kneeling by a fallen ally comes first (lances, halos, prisms). */
    protected override chooseTarget(kind: RaidAttack, alive: Fighter[]) {
      if (
        this.prismAscendant() &&
        this.smart() &&
        alive.length > 1 &&
        (kind === "prism-lance" ||
          kind === "halo-crush" ||
          kind === "umbral-prism")
      ) {
        const reviver = alive
          .filter((p) => this.prismReviving(p))
          .sort(
            (a, b) =>
              (this.threat.get(b.id) ?? 0) - (this.threat.get(a.id) ?? 0),
          )[0];
        if (reviver) return reviver;
      }
      return super.chooseTarget(kind, alive);
    }

    // -------------------------------------------------------- Stand-ins
    /** The mirrors a skylight's stand-ins aim: the top pair above the middle, else the bottom. */
    protected branchOf(s: Point) {
      return s.y <= 450 ? [0, 1] : [2, 3];
    }
    /** Where a skylight's stand-ins stand to take its light (the raid's own spot at its windows). */
    relaySpot(s: Point): Point {
      if (s.x === 350) return { x: 470, y: s.y };
      const m = this.raid.mirrors?.[this.branchOf(s)[0]] ?? { x: 600, y: 450 };
      const u = normalize(m.x - s.x, m.y - s.y);
      return { x: s.x + u.x * 120, y: s.y + u.y * 120 };
    }
    /** Raiders under an Umbral Prism as the stand-ins' turn began. */
    protected botDimmed = new Set<string>();
    /**
     * Stand-ins play the raid's own way (its dodging, Glare and lane hints)
     * and never flee a teammate's Umbral Prism: the mark is not a place on
     * the floor.
     */
    override botInput(bot: Fighter, input: Input) {
      if (!this.prismAscendant()) return super.botInput(bot, input);
      const r = this.raid,
        all = r.warnings;
      this.botDimmed = this.dimmed();
      r.warnings = all.filter((w) => w.kind !== "umbral-prism");
      try {
        return super.botInput(bot, input);
      } finally {
        r.warnings = all;
      }
    }
    /**
     * The raid's stand-in relay, at the skylights where they are now: look
     * away from a Glare, sidestep a lane, and between attacks the first
     * seats aim the branch's mirrors with ordinary hits while everyone
     * stands in the light. A raider under an Umbral Prism steps a hand-off
     * (200 px) past a teammate in the light; alone, into the skylight's
     * reach. Anything else is the raid's own dodging.
     */
    protected override botHint(
      bot: Fighter,
      input: Input,
      go: (x: number, y: number, away: boolean) => Input,
    ): Input | undefined {
      if (!this.prismAscendant()) return super.botHint(bot, input, go);
      const r = this.raid;
      const boss = this.boss();
      if (boss && r.warnings.some((w) => w.kind === "glare")) {
        input.aimX = Math.max(0, Math.min(W, bot.x + (bot.x - boss.x)));
        input.aimY = Math.max(0, Math.min(H, bot.y + (bot.y - boss.y)));
        input.basic = false;
        input.skill = -1;
        return input;
      }
      const lane = r.warnings.find(
        (w) =>
          (w.kind === "prism-lance" || w.kind === "refraction") &&
          prismDistanceToSegment(bot, w, { x: w.tx, y: w.ty }) <
            w.radius + RULES.radius + 30,
      );
      if (lane) {
        const d = normalize(lane.tx - lane.x, lane.ty - lane.y);
        return go(bot.x - d.y * 100, bot.y + d.x * 100, false);
      }
      // A Halo Crush hits only its band: stand-ins read the ring, its safe
      // middle and its gap (the raid's dodge reads a disc and leaves the
      // middle into the band).
      const halo = r.warnings.find(
        (w) =>
          w.kind === "halo-crush" &&
          dist(bot, w) < w.radius + P.halo.width + RULES.radius + 12,
      );
      if (halo) {
        const shapes = r.warnings
          .filter((w) => PRISM_SPATIAL.has(w.kind))
          .map((w) => ({ ...w, radius: w.radius + (w === halo ? 0 : 6) }));
        const spot = this.prismSpotNear(shapes, bot, 420);
        if (spot && dist(spot, bot) > 4) return go(spot.x, spot.y, false);
        input.dx = input.dy = 0;
        return input;
      }
      if (r.exposedUntil > this.time || r.warnings.length) return undefined;
      const stay = (x: number, y: number, near = 18) => {
        if (Math.hypot(bot.x - x, bot.y - y) > near) return go(x, y, false);
        input.dx = input.dy = 0;
        return input;
      };
      const alive = this.heroes().filter((p) => p.hp > 0);
      const seat = alive.findIndex((p) => p.id === bot.id);
      const sources = this.relaySources();
      const split = sources.length > 1;
      const mine = sources[split ? seat % 2 : 0] ?? sources[0];
      const dim = this.botDimmed;
      input.basic = false;
      input.skill = -1;
      if (dim.has(bot.id) && alive.length > 1) {
        // a hand-off past a teammate at a skylight
        const fed = sources.findIndex((_, j) =>
          alive.some(
            (p, i) =>
              p.id !== bot.id && !dim.has(p.id) && (split ? i % 2 : 0) === j,
          ),
        );
        const s = sources[Math.max(0, fed)];
        const stand = this.relaySpot(s);
        const u = normalize(stand.x - s.x, stand.y - s.y);
        for (const turn of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {
          const a = Math.atan2(u.y, u.x) + turn;
          const x = stand.x + Math.cos(a) * 200,
            y = stand.y + Math.sin(a) * 200;
          if (inCourt(x, y, 60) && !prismUnderControls(x, y))
            return stay(x, y, 12);
        }
      }
      // Stand-ins repair the same visible arrows a player would, with ordinary attacks.
      if (seat >= 0 && seat < (split ? 2 : 1) && !dim.has(bot.id)) {
        const branch = this.branchOf(mine);
        for (const [j, index] of branch.entries()) {
          const mirror = r.mirrors?.[index],
            destination = j === 0 ? r.mirrors?.[branch[1]] : boss;
          if (!mirror || !destination || mirrorReaches(mirror, destination))
            continue;
          input.aimX = mirror.x;
          input.aimY = mirror.y;
          input.basic = true;
          return stay(mirror.x - 90, mirror.y, 15);
        }
      }
      const spot = this.relaySpot(mine);
      return stay(spot.x, spot.y);
    }
  };
}

export class AscendantPrismellArena extends AscendantPrismellRules(
  PrismatailArena,
) {
  constructor(code: string) {
    super(code, "prismatail");
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
      r.maxHp = Math.round(r.maxHp / P.health.gilded);
      r.gilded = false;
    }
    const boss = this.boss();
    if (boss) Object.assign(boss, { hp: r.maxHp, name: A.name });
    this.resetPrismReads();
    r.lightSources = undefined;
    r.message = `${RAID_TRAITS[r.trait].name} ${A.name} · ${RAID_TRAITS[r.trait].text}`;
  }

  protected override finishMessage(won: boolean): string {
    return won
      ? "The prism shell shatters. The Spire's summit shines for you!"
      : "Ascendant Prismell's light holds. Pass the beam faster and climb again.";
  }
}
