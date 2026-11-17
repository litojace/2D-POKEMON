/**
 * Ascendant Storm Twins: the evolved thunder-jellies on the Spire's
 * seventieth floor, its summit (docs/spire: "Ascendant bosses"). The raid's
 * Fizz and Crackle pushed further through the same warning and honesty
 * machinery, built from their own rules: two bodies tied by a link beam,
 * opposite charges and a finish that must come together.
 *
 * - New moves, both teamwork between the two bodies: Mirror Charge (Fizz +,
 *   Crackle -, every raider + or -: only hits from the opposite sign
 *   discharge a twin, the same sign is repelled, so the party splits
 *   between the bodies; a twin still charged when it runs out overloads, a
 *   ring round it on the raid's warning clock; alone, the raider's sign
 *   flips half-way, both halves shown from the start) and Short Circuit (an
 *   overcharged Link Beam that can't be jumped, drawn for a long telegraph
 *   while the twins hold still: the raiders standing on it share its shock,
 *   never less than a floor each; nobody on it and it arcs over the whole
 *   court). Both are fitted to the slowest raider: a reaction, the walk at
 *   the slowest speed, and (Mirror) the hits at the slowest basic attack.
 * - Combos (ASCENDANT_STORM_TWINS.combosFrom): both twins discharged in
 *   time answer with Polarity on the same signs (the two halves must cross
 *   to pair); a shared Short Circuit leaves a static field where its
 *   sharers stood. Feints: a Twin Rush whose lanes, part-way, turn into a
 *   Link Beam (shown in full from that moment).
 * - Reads: a static field where a raider usually dodges, a Twin Rush at a
 *   raider standing still to attack, and a static field on the raider
 *   kneeling to revive (picked first by its chains, fields and rushes).
 * - Overlap: from chapter 2 with two raiders up, chains, fields, claps,
 *   beams and rushes play out while a Mirror Charge runs (never Polarity or
 *   a Short Circuit, which always stands alone); the safe-spot rule knows
 *   every shape (lanes, circles, overload rings, live fields) and keeps
 *   every spot it counts clear of a phone's touch controls; an attack that
 *   would leave none waits.
 * - Nothing a raider must see or reach sits under a phone's touch controls
 *   (ASCENDANT_STORM_TWINS.phoneControls): the twins' spawns, orbit,
 *   sweeps and rush ends, so every beam end and overload ring centre (a
 *   twin pulled there glides back out), the copper posts, the solo pad,
 *   the Short Circuit's standable stretch and every safe spot.
 * - No damage spikes: its hits by party size stay at ×1.0-1.05 of the
 *   tier, Polarity's same-sign failure is ×1.1 (the raid's ×2), the
 *   overload and the Short Circuit's shares are capped (no ordinary hit
 *   above 60% of the frailest champion's health).
 *
 * The rules are a layer (`AscendantStormTwinsRules`) over a Storm Twins
 * arena, on while the raid is the twins' Ascendant form (`isAscendant`) and
 * the raid's own hooks otherwise. Its court (spawns, orbit, box, posts,
 * pad) is read through the raid arena's hooks at use time, so it is right
 * whenever the variant switches on before the twins spawn (the Spire:
 * setupFloor sets the variant, then spawnAscendant). `AscendantStormTwinsArena`
 * is that layer always on: createRaidArena(code, "storm-twins", { variant:
 * "ascendant" }) (server code and tests only: clients can't ask for a variant).
 */
import { raidJitter } from "./raid.js";
import { StormTwinsArena, polaritySigns } from "./raid-storm-twins.js";
import { rayToBox } from "./raid-boss-aim.js";
import {
  CHARACTERS,
  FIGHTER_IDS,
  RULES,
  normalize,
  type Fighter,
  type Input,
} from "../../../packages/shared/src/index.js";
import {
  ASCENDANT_STORM_TWINS as A,
  RAID,
  RAID_TELEGRAPH_FLOOR,
  RAID_TRAITS,
  STORM_TWINS as S,
  ascendantStormTwinsPattern,
  isAscendant,
  stormBeamPoints,
  stormSegmentDistance,
  type RaidAttack,
  type RaidWarning,
  type StormMirror,
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
/** The slowest champion's basic attack interval (s): Mirror Charge fits it. */
export const SLOWEST_BASIC = Math.max(
  ...FIGHTER_IDS.map((id) => CHARACTERS[id].basic.interval ?? 0.5),
);

/**
 * Is a disc (centre, radius) within `margin` of a phone's touch controls
 * (ASCENDANT_STORM_TWINS.phoneControls)? A point is a disc of radius 0.
 */
export function twinsUnderControls(
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
/** Is a twin's body (its whole hit circle) clear of the controls? */
export const twinClear = (p: Point) => !twinsUnderControls(p.x, p.y, S.radius);

/** Warnings with a place on the floor a raider stands outside of. */
export const TWIN_SPATIAL = new Set<RaidAttack>([
  "twin-rush",
  "link-beam",
  "static-field",
  "mirror-charge",
]);

/**
 * Would a raider standing at (x, y) be inside this warning's hit (`pad`:
 * the raider's radius plus any margin)? The landing's own tests: a rush
 * lane, a Link Beam (bent through its post; jumping also answers it), a
 * static field's circle, a Mirror Charge's overload ring. (A Short Circuit
 * is stood on, not avoided; claps are jumped; chains are spread from.)
 */
export function twinShapeHits(
  w: RaidWarning,
  x: number,
  y: number,
  posts: readonly Point[] = A.posts,
  pad: number = RULES.radius,
) {
  const p = { x, y };
  if (w.kind === "twin-rush")
    return stormSegmentDistance(p, w, { x: w.tx, y: w.ty }) < w.radius + pad;
  if (w.kind === "link-beam") {
    const pts = stormBeamPoints(w, { x: w.tx, y: w.ty }, w.beamPost, posts);
    return pts
      .slice(1)
      .some((q, i) => stormSegmentDistance(p, pts[i], q) < w.radius + pad);
  }
  if (w.kind === "static-field" || (w.kind === "mirror-charge" && w.overload))
    return Math.hypot(x - w.x, y - w.y) < w.radius + pad;
  return false;
}

/** Is a raider at `p` standing on this Short Circuit (the landing's test)? */
export const onShort = (w: RaidWarning, p: Point) =>
  stormSegmentDistance(p, w, { x: w.tx, y: w.ty }) <= w.radius + RULES.radius;

/**
 * The share of a Short Circuit's shock each of `on` raiders standing on it
 * takes when `alive` are up (0 on it: the arc each takes instead).
 */
export function shortShare(on: number, alive: number) {
  if (on <= 0) return A.short.arc;
  return Math.max(
    A.short.minShare,
    Math.min(A.short.maxShare, (A.short.perRaider * alive) / on),
  );
}

/** A raider's reach on a twin: its basic attack's range, short of the edge. */
export const twinReach = (p: Fighter) =>
  Math.max(60, CHARACTERS[p.character].basic.range * 0.8) + S.radius - 20;
/**
 * Seconds a raider at distance `d` from a drifting twin needs to land
 * `hits` on it: a reaction, the walk into reach at the slowest speed less
 * the twin's drift, the hits at the slowest basic attack, and a spare.
 */
export function mirrorNeed(d: number, reach: number, hits: number) {
  return (
    RAID_REACTION +
    Math.max(0, d - reach) / (RAID_SLOWEST_SPEED - A.mirror.chase) +
    hits * SLOWEST_BASIC +
    A.mirror.spare
  );
}
/** An overload ring's telegraph: at least walking out from its centre after a reaction. */
export const overloadDelay = () =>
  Math.max(
    A.mirror.delay,
    RAID_TELEGRAPH_FLOOR,
    RAID_REACTION +
      (A.mirror.radius + RULES.radius + 6) / RAID_SLOWEST_SPEED +
      0.1,
  );
/** A raider's Mirror Charge sign right now (alone, it flips at flipAt). */
export function mirrorSignOf(m: StormMirror, id: string, now: number) {
  const s = m.signs.find((x) => x.playerId === id)?.sign;
  if (s === undefined) return undefined;
  return m.flipAt !== undefined && now >= m.flipAt ? (-s as 1 | -1) : s;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwinsClass = new (...args: any[]) => StormTwinsArena;

/** Ascendant Storm Twins' rules over `Base`, on while the raid is its Ascendant form. */
export function AscendantStormTwinsRules<B extends TwinsClass>(Base: B) {
  return class AscendantStormTwinsRules extends Base {
    /** How often each read and new move was played this run (tests and balance logs). */
    twinReads = {
      habits: 0,
      anchors: 0,
      revivers: 0,
      feints: 0,
      mirrors: 0,
      discharged: 0,
      overloads: 0,
      shorts: 0,
      shared: 0,
      pairs: 0,
      arced: 0,
      combos: 0,
    };
    /** Each raider's dodges: a decaying sum of directions and of weights. */
    protected twinHabits = new Map<
      string,
      { x: number; y: number; weight: number; n: number }
    >();
    protected twinDodging = new Map<RaidWarning, Map<string, Point>>();
    protected twinWatched = new WeakSet<RaidWarning>();
    protected twinStill = new Map<string, number>();
    protected twinHitAt = new Map<string, number>();
    /** Rushes that will turn into a Link Beam (by cast), and when. */
    protected twinFeints = new Map<
      number,
      { at: number; target: string; lanes: RaidWarning[] }
    >();
    /** When each raider's hit on each twin last counted (`raider|twin`). */
    protected mirrorHitAt = new Map<string, number>();

    /** Are the Ascendant's rules on? (Off: every hook is the raid's own.) */
    protected twinsAscendant() {
      return isAscendant(this.raid, "storm-twins");
    }
    /** A new fight: forget the last one's reads. */
    resetTwinReads() {
      for (const k of Object.keys(this.twinReads))
        this.twinReads[k as keyof typeof this.twinReads] = 0;
      this.twinHabits.clear();
      this.twinDodging.clear();
      this.twinStill.clear();
      this.twinHitAt.clear();
      this.twinFeints.clear();
      this.mirrorHitAt.clear();
    }

    // ---------------------------------------------------------- Numbers
    /** The Ascendant tier, with its own revive length (see ASCENDANT_STORM_TWINS). */
    protected override tier() {
      const t = super.tier();
      return this.twinsAscendant() && this.smart()
        ? { ...t, reviveSeconds: A.reviveSeconds }
        : t;
    }
    /** Health per extra raider (see ASCENDANT_STORM_TWINS.perExtraPlayer). */
    protected override bossMaxHp() {
      const r = this.raid;
      if (!this.twinsAscendant() || r.partySize <= 1) return super.bossMaxHp();
      const base = super.bossMaxHp(),
        extra = r.partySize - 1;
      return Math.round(
        (base * (S.health.base + A.perExtraPlayer * extra)) /
          (S.health.base + S.health.perExtraPlayer * extra),
      );
    }
    protected override pattern() {
      if (!this.twinsAscendant()) return super.pattern();
      return ascendantStormTwinsPattern(this.raid.phase);
    }
    /** Tighter rhythm by chapter, and per extra raider. */
    protected override cadence() {
      const base = super.cadence();
      if (!this.twinsAscendant() || !this.smart()) return base;
      const extra = Math.max(0, this.raid.partySize - 1);
      return (
        base *
        A.cadence[Math.max(0, Math.min(2, this.raid.phase - 1))] *
        (1 - A.partyCadence * extra)
      );
    }
    /** Its hits by party size (see ASCENDANT_STORM_TWINS.damage). */
    protected override bossDamage() {
      const base = super.bossDamage();
      if (!this.twinsAscendant() || !this.smart()) return base;
      const size = Math.max(1, Math.min(4, this.raid.partySize));
      return base * A.damage[size - 1];
    }
    /** Mirror Charge and Short Circuit keep their fitted lengths. */
    protected override telegraph(kind: RaidAttack, seconds: number) {
      return this.twinsAscendant() &&
        (kind === "mirror-charge" || kind === "short-circuit")
        ? seconds
        : super.telegraph(kind, seconds);
    }

    // ---------------------------------------------------------- The court
    protected override bossHome() {
      return this.twinsAscendant() ? { ...A.home } : super.bossHome();
    }
    protected override twinSpawns() {
      return this.twinsAscendant() ? A.spawns : super.twinSpawns();
    }
    protected override beamPosts() {
      return this.twinsAscendant() ? A.posts : super.beamPosts();
    }
    protected override rushBox() {
      return this.twinsAscendant() ? A.box : super.rushBox();
    }
    protected override driftBox() {
      return this.twinsAscendant() ? A.box : super.driftBox();
    }
    protected override orbitHome() {
      return this.twinsAscendant() ? A.home : super.orbitHome();
    }
    protected override orbitRadius() {
      if (!this.twinsAscendant()) return super.orbitRadius();
      const r = this.raid;
      return r.phase === 1
        ? A.orbit.first
        : r.trait === "bickering"
          ? A.orbit.bickering
          : A.orbit.later;
    }
    /** The solo pad: the raid's spot, or the nearest one clear of the controls. */
    protected override padSpot(p: Fighter) {
      const spot = super.padSpot(p);
      if (!this.twinsAscendant()) return spot;
      const ok = (x: number, y: number) =>
        inCourt(x, y, S.polarity.padRadius + 30) &&
        !twinsUnderControls(x, y, S.polarity.padRadius) &&
        Math.hypot(x - p.x, y - p.y) <= 240;
      if (ok(spot.x, spot.y)) return spot;
      for (const reach of [190, 150, 220, 120, 240])
        for (let i = 0; i < 32; i++) {
          const a = (i / 32) * Math.PI * 2;
          const x = p.x + Math.cos(a) * reach,
            y = p.y + Math.sin(a) * reach;
          if (ok(x, y)) return { x, y };
        }
      return { x: A.home.x, y: A.home.y };
    }

    // ---------------------------------------------------------- Overlap
    protected mirrorWarning() {
      return this.raid.warnings.find(
        (w) => w.kind === "mirror-charge" && !w.overload,
      );
    }
    protected overloads() {
      return this.raid.warnings.filter(
        (w) => w.kind === "mirror-charge" && w.overload,
      );
    }
    protected short() {
      return this.raid.warnings.find((w) => w.kind === "short-circuit");
    }
    protected polarityLive() {
      return (this.raid.polarities ?? []).some((m) => m.until > this.time);
    }
    /** A Mirror Charge's countdown hurts nobody (its overload rings do). */
    protected override harmful(w: RaidWarning) {
      if (this.twinsAscendant() && w.kind === "mirror-charge" && !w.overload)
        return false;
      return super.harmful(w);
    }
    /** A Short Circuit always stands alone. */
    protected override exclusive(kind: RaidAttack) {
      if (this.twinsAscendant() && kind === "short-circuit") return true;
      return super.exclusive(kind);
    }
    /**
     * Mirror Charge: both twins up, no Polarity, beam or charge live. Short
     * Circuit: both twins up, nothing of the sign rules live (Polarity,
     * Mirror Charge, an overload), no chain lightning, and a stretch of the
     * line to stand on. While a Mirror Charge runs: nothing else in chapter
     * 1 or alone; from ASCENDANT_STORM_TWINS.overlap, anything but Polarity,
     * Short Circuit and another charge.
     */
    protected override allows(kind: RaidAttack) {
      if (!this.twinsAscendant()) return super.allows(kind);
      const r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0).length;
      if (this.mirrorWarning()) {
        if (
          !this.smart() ||
          r.phase < A.overlap.from ||
          alive < A.overlap.raiders
        )
          return false;
        if (
          kind === "polarity" ||
          kind === "short-circuit" ||
          kind === "mirror-charge"
        )
          return false;
      }
      const two = this.actors().length >= 2;
      if (kind === "mirror-charge")
        return (
          two &&
          !this.polarityLive() &&
          !this.short() &&
          !this.overloads().length &&
          !r.stormMirror
        );
      if (kind === "short-circuit")
        return (
          two &&
          !this.polarityLive() &&
          !this.overloads().length &&
          !r.stormMirror &&
          !r.warnings.some((w) => w.kind === "chain-lightning") &&
          this.shortStretch().length > 0
        );
      if (kind === "polarity")
        return !this.short() && !this.overloads().length && !r.stormMirror;
      if (kind === "chain-lightning" && this.short()) return false;
      return super.allows(kind);
    }
    /** No new attack while a twin glides out from under the controls. */
    protected override canStartAttack() {
      if (!super.canStartAttack()) return false;
      if (!this.twinsAscendant()) return true;
      return this.twins().every((p) => p.hp <= 0 || twinClear(p));
    }
    /**
     * Is (x, y) a spot a raider can rely on? Inside the court, clear of the
     * phone's controls and of live static fields, and outside every lane,
     * circle and overload ring.
     */
    twinClearSpot(shapes: RaidWarning[], x: number, y: number) {
      if (!inCourt(x, y) || twinsUnderControls(x, y, 0, 0)) return false;
      for (const f of this.raid.stormFields ?? [])
        if (
          f.until > this.time &&
          Math.hypot(x - f.x, y - f.y) < f.radius + RULES.radius
        )
          return false;
      const posts = this.beamPosts();
      for (const w of shapes)
        if (twinShapeHits(w, x, y, posts, RULES.radius + 4)) return false;
      return true;
    }
    /** The nearest safe spot within `reach` of `p` (see `twinClearSpot`). */
    twinSpotNear(shapes: RaidWarning[], p: Point, reach: number) {
      if (this.twinClearSpot(shapes, p.x, p.y)) return { x: p.x, y: p.y };
      for (const f of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1])
        for (let i = 0; i < 32; i++) {
          const a = (i / 32) * Math.PI * 2;
          const x = p.x + Math.cos(a) * reach * f,
            y = p.y + Math.sin(a) * reach * f;
          if (this.twinClearSpot(shapes, x, y)) return { x, y };
        }
      return undefined;
    }
    /** The shapes a raider must stand clear of (its Mirror countdown aside). */
    protected twinLive(shapes: RaidWarning[]) {
      return shapes.filter(
        (w) =>
          TWIN_SPATIAL.has(w.kind) &&
          (w.kind !== "mirror-charge" || !!w.overload),
      );
    }
    /**
     * Every raider can reach a safe spot before the first of these lands
     * (slowest champion, after a 0.45 s reaction): see `twinClearSpot`.
     */
    override safeSpotExists(
      shapes: RaidWarning[] = this.raid.warnings,
      slack = 0,
    ) {
      if (!this.twinsAscendant()) return super.safeSpotExists(shapes);
      const live = this.twinLive(shapes);
      if (!live.length) return true;
      const first = Math.min(...live.map((w) => w.at));
      const reach =
        RAID_SLOWEST_SPEED *
        Math.max(0, first - this.time - RAID_REACTION - slack);
      return this.heroes()
        .filter((p) => p.hp > 0)
        .every((p) => !!this.twinSpotNear(live, p, reach));
    }
    /**
     * The raid's overlap spacing, then the Ascendant's safe-spot rule with a
     * little slack: else the new attack waits until the older ones landed.
     */
    protected override spaceOverlap(fresh: RaidWarning[]) {
      super.spaceOverlap(fresh);
      if (!this.twinsAscendant()) return;
      const mine = this.twinLive(fresh);
      const old = this.twinLive(
        this.raid.warnings.filter((w) => !fresh.includes(w)),
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
      const live = this.twinLive(
        this.raid.warnings.filter((w) => !fresh.includes(w)),
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
    /**
     * The raid's choice; a deck left with only cards it can't play now (a
     * Short Circuit while a charge runs) is dealt again.
     */
    protected override decide(alive: Fighter[], overlapping: boolean) {
      const out = super.decide(alive, overlapping);
      if (out || !this.twinsAscendant() || overlapping || !this.deck.length)
        return out;
      if (this.mirrorWarning()) return out;
      if (this.deck.some((k) => this.allows(k))) return out;
      this.deck = [];
      return super.decide(alive, overlapping);
    }
    protected override startAttack(kind: RaidAttack, target: Fighter): void {
      if (!this.twinsAscendant()) return super.startAttack(kind, target);
      const r = this.raid;
      this.noteTwinRead(kind, target);
      if (kind === "mirror-charge" || kind === "short-circuit") {
        if (this.actors().length < 2)
          return super.startAttack("thunderclap", target);
        const seen = this.seenAttacks.get(kind) ?? 0;
        this.seenAttacks.set(kind, seen + 1);
        if (kind === "mirror-charge") this.warnMirror(seen < 2);
        else if (!this.warnShort(seen < 2))
          return super.startAttack("thunderclap", target);
        return;
      }
      const before = new Set(r.warnings);
      super.startAttack(kind, target);
      if (kind === "static-field" && this.smart()) this.fieldOnHabit(target);
      if (kind === "chain-lightning" || kind === "thunderclap")
        this.pairCast(kind, target, before);
      if (kind !== "twin-rush") return;
      const lanes = r.warnings.filter(
        (w) => w.kind === "twin-rush" && !before.has(w),
      );
      // A rush on its own may be a feint (shown in full when it turns).
      const others = [...before].some((w) => this.twinLive([w]).length);
      if (
        this.smart() &&
        lanes.length === 2 &&
        !lanes[0].teach &&
        !others &&
        this.twinFeintRoll()
      ) {
        const start = lanes[0].startedAt ?? this.time;
        this.twinFeints.set(this.currentCast, {
          at: start + (lanes[0].at - start) * A.feint.turnAt,
          target: target.id,
          lanes,
        });
      }
    }
    /**
     * A party meets both twins at once (ASCENDANT_STORM_TWINS.pair): from
     * its chapter, with enough raiders up, a chain or a clap cast by one
     * twin is cast by the other too, a moment later (at another raider; a
     * clap round the other twin). The trait In Sync already does it.
     */
    protected pairCast(
      kind: "chain-lightning" | "thunderclap",
      target: Fighter,
      before: Set<RaidWarning>,
    ) {
      const r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0);
      if (
        !this.smart() ||
        r.trait === "in-sync" ||
        r.phase < A.pair.from ||
        alive.length < A.pair.raiders
      )
        return;
      const first = r.warnings.find((w) => w.kind === kind && !before.has(w));
      const other = this.actors().find((p) => p.id !== first?.casterId);
      if (!first || !other) return;
      if (kind === "chain-lightning") {
        const ally = this.chooseTarget(
          kind,
          alive.filter((p) => p !== target),
        );
        if (!ally) return;
        other.angle = Math.atan2(ally.y - other.y, ally.x - other.x);
        Object.assign(
          this.warn(
            kind,
            ally.x,
            ally.y,
            ally.x,
            ally.y,
            S.chain.range,
            S.chain.delay + A.pair.gap,
          ),
          {
            casterId: other.id,
            targetId: ally.id,
            teach: first.teach,
            at: first.at + A.pair.gap,
          },
        );
      } else
        Object.assign(
          this.warn(
            kind,
            other.x,
            other.y,
            other.x,
            other.y,
            S.clap.radius,
            S.clap.delay + A.pair.gap,
          ),
          { casterId: other.id, teach: first.teach, at: first.at + A.pair.gap },
        );
      this.twinReads.pairs++;
    }
    /**
     * Alone, the raid aims both lanes through the one raider and the twins
     * end up on top of each other: the second twin's lane runs instead
     * `soloOffset` px to the raider's side (away from the first lane), so
     * the two bodies stay apart and both lanes read.
     */
    protected override rushEnds(actors: Fighter[], target: Fighter) {
      const ends = super.rushEnds(actors, target);
      if (
        !this.twinsAscendant() ||
        actors.length < 2 ||
        this.heroes().filter((p) => p.hp > 0).length > 1
      )
        return ends;
      const [a, b] = actors;
      const d = normalize(ends[0].x - a.x || 1, ends[0].y - a.y);
      const n = { x: -d.y, y: d.x };
      const side = (b.x - a.x) * n.x + (b.y - a.y) * n.y < 0 ? -1 : 1;
      const box = this.rushBox();
      const aim = {
        x: Math.max(
          box.x0,
          Math.min(box.x1, target.x + n.x * side * A.soloOffset),
        ),
        y: Math.max(
          box.y0,
          Math.min(box.y1, target.y + n.y * side * A.soloOffset),
        ),
      };
      return [ends[0], rayToBox(b, aim, box)];
    }
    /** Is this rush a feint? A seeded roll per chapter. */
    protected twinFeintRoll() {
      const r = this.raid;
      const chance = A.feint.chance[Math.max(0, Math.min(2, r.phase - 1))];
      return raidJitter(r.seed ^ 0x7a11, this.attacks, 29) < chance;
    }
    /**
     * Part-way through, a feinting rush's lanes fade and a Link Beam is drawn
     * between the twins instead, shown in full from that moment (the
     * honesty rules apply to it as to any new attack).
     */
    protected turnTwinFeints() {
      const r = this.raid;
      for (const [cast, f] of this.twinFeints) {
        if (this.time < f.at) continue;
        this.twinFeints.delete(cast);
        const target = this.heroes().find((p) => p.id === f.target && p.hp > 0);
        if (
          !f.lanes.every((w) => r.warnings.includes(w)) ||
          !target ||
          this.actors().length < 2 ||
          r.stormRushes?.length ||
          r.stormBeam ||
          r.warnings.some(
            (w) => !f.lanes.includes(w) && this.twinLive([w]).length,
          )
        )
          continue;
        r.warnings = r.warnings.filter((w) => !f.lanes.includes(w));
        this.currentCast = cast;
        super.startAttack("link-beam", target);
        this.settleWarnings();
        this.currentCast = 0;
        this.twinReads.feints++;
        r.message = "A feint! The rush turns into a Link Beam: jump it.";
      }
    }
    /** A static field where `target` usually dodges to, once the twins trust their habit. */
    protected fieldOnHabit(target: Fighter) {
      const habit = this.twinHabitOf(target.id);
      if (!habit) return;
      const x = Math.max(
          120,
          Math.min(W - 120, target.x + habit.x * A.habit.offset),
        ),
        y = Math.max(
          140,
          Math.min(H - 140, target.y + habit.y * A.habit.offset),
        );
      const caster = this.actors()[0];
      if (!caster) return;
      Object.assign(
        this.warn("static-field", x, y, x, y, S.field.radius, S.field.delay),
        { casterId: caster.id, targetId: target.id },
      );
      this.twinReads.habits++;
    }

    // ------------------------------------------------------ Mirror Charge
    /** Fizz and Crackle, alive, in the raid's order (Fizz first). */
    protected pair() {
      const meta = this.raid.twins ?? [];
      return meta
        .map((t) => this.twins().find((p) => p.id === t.id))
        .filter((p): p is Fighter => !!p);
    }
    /**
     * Mirror Charge: Fizz +, Crackle -, and every raider + or - (half each;
     * the raiders nearer Crackle take + to hit it). Its length fits the
     * slowest raider's walk into reach and hits; alone, the raider's sign
     * flips half-way (each half fitted the same way).
     */
    protected warnMirror(teach: boolean) {
      const r = this.raid;
      const [fizz, crackle] = this.pair();
      const alive = this.heroes().filter((p) => p.hp > 0);
      if (!fizz || !crackle || !alive.length) return undefined;
      const signs: { playerId: string; sign: 1 | -1 }[] = [];
      let seconds: number,
        flipAt: number | undefined = undefined;
      if (alive.length === 1) {
        const p = alive[0];
        // Its nearer twin first: the opposite sign of it.
        const first = dist(p, fizz) <= dist(p, crackle) ? fizz : crackle;
        const second = first === fizz ? crackle : fizz;
        signs.push({ playerId: p.id, sign: first === fizz ? -1 : 1 });
        const half = Math.max(
          A.mirror.soloHalf,
          mirrorNeed(dist(p, first), twinReach(p), A.mirror.soloHits),
          mirrorNeed(dist(first, second), twinReach(p), A.mirror.soloHits),
        );
        flipAt = this.time + half;
        seconds = half * 2;
      } else {
        const order = [...alive].sort(
          (p, q) =>
            dist(p, crackle) -
            dist(p, fizz) -
            (dist(q, crackle) - dist(q, fizz)),
        );
        const plus =
          alive.length % 2
            ? (r.seed + this.attacks) % 2
              ? Math.ceil(alive.length / 2)
              : Math.floor(alive.length / 2)
            : alive.length / 2;
        order.forEach((p, i) =>
          signs.push({ playerId: p.id, sign: i < plus ? 1 : -1 }),
        );
        seconds = A.mirror.seconds;
        for (const s of signs) {
          const p = alive.find((q) => q.id === s.playerId)!;
          const twin = s.sign > 0 ? crackle : fizz;
          seconds = Math.max(
            seconds,
            mirrorNeed(dist(p, twin), twinReach(p), A.mirror.hits),
          );
        }
      }
      const mirror: StormMirror = {
        startedAt: this.time,
        until: this.time + seconds,
        ...(flipAt !== undefined ? { flipAt } : {}),
        signs,
        twins: [
          { id: fizz.id, sign: 1, need: 0, hits: 0 },
          { id: crackle.id, sign: -1, need: 0, hits: 0 },
        ],
      };
      r.stormMirror = mirror;
      this.fitMirror();
      this.mirrorHitAt.clear();
      Object.assign(
        this.warn(
          "mirror-charge",
          (fizz.x + crackle.x) / 2,
          (fizz.y + crackle.y) / 2,
          (fizz.x + crackle.x) / 2,
          (fizz.y + crackle.y) / 2,
          0,
          seconds,
        ),
        { teach },
      );
      this.twinReads.mirrors++;
      r.message =
        alive.length === 1
          ? "Mirror Charge! Hit the twin of the opposite sign — yours flips half-way."
          : "Mirror Charge! Split up: hit the twin of the opposite sign.";
      return mirror;
    }
    /**
     * Each twin's need: `hits` per raider up of the opposite sign (alone,
     * `soloHits`); a twin whose opposite raiders are all down is discharged.
     */
    protected fitMirror() {
      const m = this.raid.stormMirror;
      if (!m) return;
      const alive = new Set(
        this.heroes()
          .filter((p) => p.hp > 0)
          .map((p) => p.id),
      );
      const solo = m.flipAt !== undefined;
      for (const t of m.twins) {
        const opposite = m.signs.filter(
          (s) => s.sign !== t.sign && alive.has(s.playerId),
        ).length;
        t.need = solo
          ? alive.size
            ? A.mirror.soloHits
            : 0
          : opposite * A.mirror.hits;
      }
    }
    /** Is this twin still charged (alive, not open, hits short of its need)? */
    protected charged(t: StormMirror["twins"][number]) {
      const p = this.twins().find((q) => q.id === t.id);
      return !!p && p.hp > 0 && !this.bossExposed(p) && t.hits < t.need;
    }
    /**
     * The charge runs out (or both are discharged): a twin still charged
     * overloads, a ring round it on the raid's warning clock (it holds
     * still). Both discharged from chapter 3 answer with Polarity on the
     * same signs.
     */
    protected endMirror() {
      const r = this.raid,
        m = r.stormMirror;
      if (!m) return;
      r.stormMirror = undefined;
      r.warnings = r.warnings.filter(
        (w) => !(w.kind === "mirror-charge" && !w.overload),
      );
      const left = m.twins.filter((t) => this.charged(t));
      const rings: RaidWarning[] = [];
      for (const t of left) {
        const p = this.twins().find((q) => q.id === t.id)!;
        rings.push(
          Object.assign(
            this.warn(
              "mirror-charge",
              p.x,
              p.y,
              p.x,
              p.y,
              A.mirror.radius,
              overloadDelay(),
            ),
            { overload: true, casterId: p.id, followUp: true },
          ),
        );
      }
      if (rings.length) {
        this.placeFollowUp(rings);
        this.twinReads.overloads += rings.length;
        r.message =
          rings.length > 1
            ? "Both twins overload! Get out of both rings."
            : `${this.twins().find((p) => p.id === rings[0].casterId)?.name ?? "A twin"} overloads! Get out of its ring.`;
        return;
      }
      this.twinReads.discharged++;
      r.message = "Both twins discharged!";
      if (
        this.smart() &&
        r.phase >= A.combosFrom.mirror &&
        this.actors().length >= 2
      )
        this.mirrorPolarity(m);
    }
    /**
     * The combo: Polarity on the Mirror Charge's signs (each half stands by
     * its own twin: they cross to pair). Only if every raider can reach an
     * opposite sign in time; else the raid's own split.
     */
    protected mirrorPolarity(m: StormMirror) {
      const r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0);
      if (alive.length < 2 || this.polarityLive()) return;
      let signs = alive.map(
        (p) => m.signs.find((s) => s.playerId === p.id)?.sign ?? 1,
      ) as (1 | -1)[];
      const reach =
        2 * RAID_SLOWEST_SPEED * (S.polarity.seconds - RAID_REACTION - 0.3) +
        S.polarity.range;
      const reachable = alive.every((p, i) =>
        alive.some((q, j) => signs[j] !== signs[i] && dist(p, q) <= reach),
      );
      if (!reachable || new Set(signs).size < 2)
        signs = polaritySigns(alive, r.seed);
      r.polarities = alive.map((p, i) => ({
        playerId: p.id,
        sign: signs[i],
        until: this.time + S.polarity.seconds,
        cancelled: false,
      }));
      this.nextAttack = Math.max(this.nextAttack, this.time + 1.2);
      this.twinReads.combos++;
      r.message = "Discharged — and Polarity keeps your signs! Pair across.";
    }

    // ------------------------------------------------------ Short Circuit
    /**
     * Where on the line between the twins a raider can stand: outside both
     * bodies, clear of live static fields and of the controls (samples).
     */
    shortStretch(a?: Point, b?: Point) {
      const [p, q] = a && b ? [a, b] : this.actors();
      if (!p || !q) return [];
      const out: Point[] = [];
      for (let i = 0; i <= 24; i++) {
        const k = i / 24;
        const x = p.x + (q.x - p.x) * k,
          y = p.y + (q.y - p.y) * k;
        if (
          Math.hypot(x - p.x, y - p.y) < S.radius + RULES.radius ||
          Math.hypot(x - q.x, y - q.y) < S.radius + RULES.radius
        )
          continue;
        if (!inCourt(x, y) || twinsUnderControls(x, y, RULES.radius)) continue;
        if (
          (this.raid.stormFields ?? []).some(
            (f) =>
              f.until > this.time &&
              Math.hypot(x - f.x, y - f.y) < f.radius + RULES.radius,
          )
        )
          continue;
        out.push({ x, y });
      }
      return out;
    }
    /** How far `p` walks to stand on the Short Circuit's stretch. */
    protected shortWalk(p: Point, stretch: Point[]) {
      return Math.max(
        0,
        Math.min(...stretch.map((s) => dist(p, s))) - (A.short.width - 6),
      );
    }
    /**
     * Short Circuit: an overcharged beam straight between the twins (who
     * hold still), drawn long enough for the slowest raider to walk onto it.
     */
    protected warnShort(teach: boolean) {
      const r = this.raid;
      const [a, b] = this.actors();
      const stretch = this.shortStretch(a, b);
      if (!a || !b || !stretch.length) return undefined;
      const alive = this.heroes().filter((p) => p.hp > 0);
      const walk = Math.max(0, ...alive.map((p) => this.shortWalk(p, stretch)));
      const delay = Math.max(
        A.short.delay,
        RAID_REACTION + walk / RAID_SLOWEST_SPEED + A.short.spare,
      );
      a.angle = Math.atan2(b.y - a.y, b.x - a.x);
      b.angle = Math.atan2(a.y - b.y, a.x - b.x);
      const w = Object.assign(
        this.warn("short-circuit", a.x, a.y, b.x, b.y, A.short.width, delay),
        { casterId: a.id, teach, sharers: 0 },
      );
      this.twinReads.shorts++;
      r.message = "Short Circuit! Stand on the thick beam together.";
      return w;
    }
    /** It fires: those on it share the shock; nobody, and it arcs over the court. */
    protected resolveShort(w: RaidWarning) {
      const r = this.raid;
      const [a, b] = this.actors();
      if (!a || !b) return;
      const alive = this.heroes().filter((p) => p.hp > 0);
      const on = alive.filter((p) => onShort(w, p));
      const each = shortShare(on.length, alive.length);
      this.hitBy = "short-circuit";
      for (const p of on.length ? on : alive) this.damage(p, each, a.id);
      this.hitBy = undefined;
      r.stormShort = {
        x: w.x,
        y: w.y,
        tx: w.tx,
        ty: w.ty,
        until: this.time + A.short.flash,
        sharers: on.map((p) => p.id),
      };
      this.event(
        "raid-impact",
        { x: (w.x + w.tx) / 2, y: (w.y + w.ty) / 2 },
        0xd9b8ff,
        undefined,
        a.id,
      );
      this.events[this.events.length - 1].raidRadius = w.radius;
      if (!on.length) {
        this.twinReads.arced++;
        r.message =
          "Nobody on the beam — the Short Circuit arcs over the court!";
        return;
      }
      this.twinReads.shared++;
      r.message =
        on.length > 1
          ? `${on.length} raiders share the Short Circuit!`
          : `${on[0].name} takes the Short Circuit alone!`;
      // A shared shock: a static field where its sharers stood.
      if (this.smart() && r.phase >= A.combosFrom.short && on.length >= 2) {
        const c = {
          x: on.reduce((s, p) => s + p.x, 0) / on.length,
          y: on.reduce((s, p) => s + p.y, 0) / on.length,
        };
        this.currentCast = ++this.castSerial;
        const field = Object.assign(
          this.warn(
            "static-field",
            c.x,
            c.y,
            c.x,
            c.y,
            S.field.radius,
            S.field.delay,
          ),
          { casterId: a.id, followUp: true },
        );
        this.settleWarnings();
        this.placeFollowUp([field]);
        this.currentCast = 0;
        this.twinReads.combos++;
        r.message += " The ground where you stood turns static: step off!";
      }
    }

    protected override followWarnings(boss: Fighter) {
      super.followWarnings(boss);
      if (!this.twinsAscendant()) return;
      const alive = this.heroes().filter((p) => p.hp > 0);
      for (const w of this.raid.warnings)
        if (w.kind === "short-circuit")
          w.sharers = alive.filter((p) => onShort(w, p)).length;
    }
    protected override resolveWarning(w: RaidWarning, boss: Fighter) {
      if (!this.twinsAscendant()) return super.resolveWarning(w, boss);
      if (w.kind === "mirror-charge" && !w.overload) {
        this.endMirror();
        return;
      }
      if (w.kind === "mirror-charge") {
        const caster = this.twins().find((p) => p.id === w.casterId);
        if (!caster || caster.hp <= 0) return;
        this.hitBy = "mirror-charge";
        for (const p of this.heroes())
          if (
            p.hp > 0 &&
            Math.hypot(p.x - w.x, p.y - w.y) <= w.radius + RULES.radius
          )
            this.damage(p, A.mirror.damage, caster.id);
        this.hitBy = undefined;
        this.event("raid-impact", w, 0xffe18b, undefined, caster.id);
        this.events[this.events.length - 1].raidRadius = w.radius;
        return;
      }
      if (w.kind === "short-circuit") {
        this.resolveShort(w);
        return;
      }
      super.resolveWarning(w, boss);
    }

    // -------------------------------------------------------- Each tick
    protected override attacksStep(dt: number) {
      if (!this.twinsAscendant()) return super.attacksStep(dt);
      this.turnTwinFeints();
      super.attacksStep(dt);
      this.learnTwinDodges();
    }
    /**
     * After the raid's upkeep: the charge's needs follow the raiders up,
     * both twins discharged end it early, a Short Circuit whose twin fell or
     * opened goes out, and its flash fades.
     */
    protected override worldStep(dt: number, boss: Fighter) {
      super.worldStep(dt, boss);
      if (!this.twinsAscendant()) return;
      const r = this.raid;
      if (r.stormMirror) {
        this.fitMirror();
        if (!r.stormMirror.twins.some((t) => this.charged(t))) this.endMirror();
      }
      if (this.short() && this.actors().length < 2)
        r.warnings = r.warnings.filter((w) => w.kind !== "short-circuit");
      if (r.stormShort && r.stormShort.until <= this.time)
        r.stormShort = undefined;
    }
    /**
     * The twins hold still while a Short Circuit is drawn, and each while
     * its own overload ring is; one never drifts under a phone's controls
     * (it stops at their edge), and one pushed there glides back out.
     */
    protected override bossStep(dt: number, boss: Fighter) {
      if (!this.twinsAscendant()) return super.bossStep(dt, boss);
      const r = this.raid;
      const short = !!this.short();
      const before = new Map(
        this.twins().map((p) => [p.id, { x: p.x, y: p.y }]),
      );
      super.bossStep(dt, boss);
      for (const p of this.twins()) {
        const was = before.get(p.id)!;
        if (p.hp <= 0) continue;
        const hold =
          short ||
          r.warnings.some(
            (w) =>
              w.kind === "mirror-charge" && w.overload && w.casterId === p.id,
          );
        if (hold) {
          p.x = was.x;
          p.y = was.y;
          continue;
        }
        if (twinClear(p)) continue;
        if (twinClear(was)) {
          p.x = was.x;
          p.y = was.y;
          continue;
        }
        const d = normalize(A.home.x - was.x, A.home.y - was.y),
          step = Math.min(A.glide * dt, dist(was, A.home));
        p.x = was.x + d.x * step;
        p.y = was.y + d.y * step;
      }
    }
    protected override clearAttacks() {
      super.clearAttacks();
      this.raid.stormMirror = undefined;
      this.raid.stormShort = undefined;
      this.twinFeints?.clear();
      this.mirrorHitAt?.clear();
    }

    // ------------------------------------------------------ Hits and reads
    override damage(
      target: Fighter,
      amount: number,
      owner: string,
      ability?: Parameters<StormTwinsArena["damage"]>[3],
    ) {
      if (!this.twinsAscendant())
        return super.damage(target, amount, owner, ability);
      const r = this.raid,
        m = r.stormMirror;
      if (m && target.raidBoss && owner !== target.id && amount > 0) {
        const sign = mirrorSignOf(m, owner, this.time);
        const t = m.twins.find((x) => x.id === target.id);
        if (sign !== undefined && t && t.hits < t.need) {
          if (sign === t.sign) {
            // Repelled: the same sign does nothing to a charged twin.
            const key = `${owner}|${t.id}|x`;
            if (this.time - (this.mirrorHitAt.get(key) ?? -9) > 0.4) {
              this.mirrorHitAt.set(key, this.time);
              this.event("hit", target, 0xffffff, 0, owner);
            }
            return;
          }
          const key = `${owner}|${t.id}`;
          if (this.time - (this.mirrorHitAt.get(key) ?? -9) >= A.mirror.every) {
            this.mirrorHitAt.set(key, this.time);
            t.hits++;
            if (t.hits >= t.need) {
              this.event("heal", target, 0xc9f4ff, 0, owner);
              r.message = `${target.name} discharged!`;
            }
          }
        }
      }
      // Polarity's same-sign failure: no spike on the Ascendant tier.
      if (
        this.hitBy === "polarity" &&
        !target.raidBoss &&
        amount > S.polarity.damage
      )
        amount = S.polarity.damage * A.polarityMismatch;
      const up = this.twins().filter((p) => p.hp > 0).length;
      super.damage(target, amount, owner, ability);
      if (target.raidBoss && owner !== target.id)
        this.twinHitAt.set(owner, this.time);
      if (this.twins().filter((p) => p.hp > 0).length < up) {
        r.warnings = r.warnings.filter((w) => w.kind !== "short-circuit");
        this.fitMirror();
      }
    }
    /** Where each raider went from inside a fresh warning, by the time it landed. */
    protected learnTwinDodges() {
      const r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0);
      const posts = this.beamPosts();
      for (const w of r.warnings) {
        if (this.twinWatched.has(w)) continue;
        this.twinWatched.add(w);
        if (!this.twinLive([w]).length || w.kind === "link-beam") continue;
        const inside = new Map<string, Point>();
        for (const p of alive)
          if (twinShapeHits(w, p.x, p.y, posts))
            inside.set(p.id, { x: p.x, y: p.y });
        if (inside.size) this.twinDodging.set(w, inside);
      }
      for (const [w, from] of this.twinDodging) {
        if (r.warnings.includes(w)) continue;
        this.twinDodging.delete(w);
        for (const [id, start] of from) {
          const p = alive.find((q) => q.id === id);
          if (!p) continue;
          const dx = p.x - start.x,
            dy = p.y - start.y;
          if (Math.hypot(dx, dy) >= 30) this.noteTwinDodge(id, dx, dy);
        }
      }
    }
    /** Remember one dodge of raider `id` (also used by tests). */
    noteTwinDodge(id: string, dx: number, dy: number) {
      const len = Math.hypot(dx, dy) || 1;
      const h = this.twinHabits.get(id) ?? { x: 0, y: 0, weight: 0, n: 0 };
      h.x = h.x * 0.6 + dx / len;
      h.y = h.y * 0.6 + dy / len;
      h.weight = h.weight * 0.6 + 1;
      h.n++;
      this.twinHabits.set(id, h);
    }
    /** The direction a raider usually dodges, once the twins trust it. */
    twinHabitOf(id: string): Point | undefined {
      const h = this.twinHabits.get(id);
      if (!h || h.n < A.habit.samples) return undefined;
      const len = Math.hypot(h.x, h.y);
      if (len / h.weight < A.habit.consistency) return undefined;
      return { x: h.x / len, y: h.y / len };
    }
    protected override trackMotion() {
      super.trackMotion();
      if (!this.twinsAscendant()) return;
      for (const p of this.heroes()) {
        const still =
          p.hp > 0 && Math.hypot(p.vx ?? 0, p.vy ?? 0) < A.anchor.speed;
        if (!still) this.twinStill.delete(p.id);
        else if (!this.twinStill.has(p.id)) this.twinStill.set(p.id, this.time);
      }
    }
    /** Standing still while hitting a twin (for the anchor read). */
    twinAnchored(p: Fighter) {
      const since = this.twinStill.get(p.id);
      return (
        since !== undefined &&
        this.time - since >= A.anchor.still &&
        this.time - (this.twinHitAt.get(p.id) ?? -99) <= A.anchor.hit
      );
    }
    protected twinReviving(p: Fighter) {
      return this.heroes().some(
        (d) =>
          d.hp <= 0 &&
          !this.raid.downed[d.id]?.self &&
          Math.hypot(d.x - p.x, d.y - p.y) <= RAID.reviveRange,
      );
    }
    protected noteTwinRead(kind: RaidAttack, target: Fighter) {
      if (!this.smart() || !TWIN_HUNTS.has(kind)) return;
      if (this.twinReviving(target)) this.twinReads.revivers++;
      else if (kind === "twin-rush" && this.twinAnchored(target))
        this.twinReads.anchors++;
    }
    /** A rush at a raider standing still to attack; a field on one kneeling to revive. */
    protected override reactions(s: RaidSituation): RaidReaction[] {
      const out = super.reactions(s);
      if (!this.twinsAscendant()) return out;
      for (const p of s.alive)
        if (this.twinAnchored(p))
          out.push({ kind: "twin-rush", score: 1.5, target: p });
      for (const p of s.reviving)
        out.push({ kind: "static-field", score: 1.6, target: p });
      return out;
    }
    /** The raider kneeling by a fallen ally comes first. */
    protected override chooseTarget(kind: RaidAttack, alive: Fighter[]) {
      if (
        this.twinsAscendant() &&
        this.smart() &&
        alive.length > 1 &&
        TWIN_HUNTS.has(kind)
      ) {
        const reviver = alive
          .filter((p) => this.twinReviving(p))
          .sort(
            (a, b) =>
              (this.threat.get(b.id) ?? 0) - (this.threat.get(a.id) ?? 0),
          )[0];
        if (reviver) return reviver;
      }
      return super.chooseTarget(kind, alive);
    }

    // -------------------------------------------------------- Stand-ins
    /** The twin `bot` must hit in a Mirror Charge (still charged), if any. */
    mirrorTarget(bot: Fighter) {
      const m = this.raid.stormMirror;
      if (!m) return undefined;
      const sign = mirrorSignOf(m, bot.id, this.time);
      if (sign === undefined) return undefined;
      const t = m.twins.find((x) => x.sign !== sign && this.charged(x));
      return t && this.twins().find((p) => p.id === t.id && p.hp > 0);
    }
    /**
     * Stand-ins play the raid's own way (polarity pairs, spreading from
     * chains, out of lanes, over beams and claps) with the Ascendant's
     * teamwork on top:
     * - out of an overload ring first;
     * - a Short Circuit: everyone walks onto its stretch and stays there
     *   (out of a static field);
     * - a Mirror Charge: each walks into reach of the twin of the opposite
     *   sign and hits only it.
     */
    protected override botHint(
      bot: Fighter,
      input: Input,
      go: (x: number, y: number, away: boolean) => Input,
    ): Input | undefined {
      if (!this.twinsAscendant()) return super.botHint(bot, input, go);
      const r = this.raid;
      const stay = (x: number, y: number, near: number) => {
        if (Math.hypot(bot.x - x, bot.y - y) > near) return go(x, y, false);
        input.dx = input.dy = 0;
        return input;
      };
      const ring = this.overloads().find(
        (w) =>
          Math.hypot(bot.x - w.x, bot.y - w.y) < w.radius + RULES.radius + 14,
      );
      if (ring) {
        const shapes = this.twinLive(r.warnings).map((w) => ({
          ...w,
          radius: w.radius + 10,
        }));
        const spot = this.twinSpotNear(shapes, bot, 420);
        if (spot) return stay(spot.x, spot.y, 6);
        return go(ring.x, ring.y, true);
      }
      const short = this.short();
      if (short) {
        const stretch = this.shortStretch(
          { x: short.x, y: short.y },
          {
            x: short.tx,
            y: short.ty,
          },
        );
        const spot = [...stretch].sort(
          (p, q) => dist(bot, p) - dist(bot, q),
        )[0];
        if (spot) {
          const out = stay(spot.x, spot.y, A.short.width * 0.5);
          const twin = this.actors()[0];
          if (twin) {
            input.aimX = twin.x;
            input.aimY = twin.y;
          }
          return out;
        }
      }
      const hint = super.botHint(bot, input, go);
      const mine = this.mirrorTarget(bot);
      if (!mine) return hint;
      // The raid's urgent answers stand (a mark, a lane, a field, a chain).
      const urgent =
        (r.polarities ?? []).some(
          (m) => m.playerId === bot.id && m.until > this.time,
        ) ||
        r.warnings.some(
          (w) =>
            (w.kind === "twin-rush" &&
              stormSegmentDistance(bot, w, { x: w.tx, y: w.ty }) <
                w.radius + RULES.radius + 25) ||
            (w.kind === "static-field" &&
              Math.hypot(bot.x - w.x, bot.y - w.y) <
                w.radius + RULES.radius + 20) ||
            w.kind === "chain-lightning",
        ) ||
        (r.stormFields ?? []).some(
          (f) => Math.hypot(bot.x - f.x, bot.y - f.y) < f.radius + 50,
        );
      input.aimX = mine.x;
      input.aimY = mine.y;
      if (urgent) return hint ?? input;
      if (dist(bot, mine) > twinReach(bot) - 20)
        return go(mine.x, mine.y, false);
      input.dx = input.dy = 0;
      return input;
    }
  };
}

/** Attacks that hunt a reviver (and read a raider standing still). */
const TWIN_HUNTS = new Set<RaidAttack>([
  "chain-lightning",
  "static-field",
  "twin-rush",
]);

/** The Ascendant Storm Twins' own raid: the layer always on. */
export class AscendantStormTwinsArena extends AscendantStormTwinsRules(
  StormTwinsArena,
) {
  constructor(code: string) {
    super(code, "storm-twins");
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
      r.gilded = false;
      const hp = Math.round(r.maxHp / S.health.gilded / 2);
      r.maxHp = hp * 2;
      for (const t of r.twins ?? []) {
        t.maxHp = hp;
        const p = this.players.find((q) => q.id === t.id);
        if (p) p.hp = hp;
      }
    }
    this.resetTwinReads();
    r.message = `${RAID_TRAITS[r.trait].name} ${A.name} · ${RAID_TRAITS[r.trait].text}`;
  }

  protected override finishMessage(won: boolean): string {
    return won
      ? "Two storms fall silent at once. The Spire's summit is yours!"
      : "The Ascendant Storm Twins still crackle at the summit. Pair your charges and climb again.";
  }
}
