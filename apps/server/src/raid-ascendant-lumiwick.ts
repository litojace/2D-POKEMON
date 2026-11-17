/**
 * Ascendant Lumiwick: the evolved sky-lantern spirit on the Spire's
 * sixtieth floor (docs/spire: "Ascendant bosses"). The raid's Lumiwick
 * (Emberwing's id), smug and refusing to come down, pushed further through
 * the same warning and honesty machinery and built from its own rule: only
 * all three braziers burning at once pull it out of the sky.
 *
 * - New moves, both about lighting together under pressure: the Snuffing
 *   Gale (a cold gale down a lane through a burning brazier: a flame with
 *   nobody in its ring goes out, and anyone standing in a brazier's ring is
 *   sheltered, so its keeper must hold while everyone else leaves the lane)
 *   and Bound Wicks (a burning wick ties two braziers, three in the last
 *   chapter: they only catch while every bound ring has a raider in it, and
 *   the fuse, fitted to the slowest team, snaps into a Backdraft that puts
 *   every flame out).
 * - Its rhythm tightens by chapter and with the party; the open heart lasts
 *   less.
 * - Combos (ASCENDANT_LUMIWICK.combosFrom): a gale whose flame was held
 *   drops embers on its keeper; kindled wicks answer with a gale at one of
 *   the flames just lit. Feints: a dive whose lane turns, part way, into a
 *   Snuffing Gale (shown in full from then).
 * - Reads: embers where a raider usually dodges, a dive for a raider
 *   standing still to attack, and the raider kneeling to revive first.
 * - Overlap: from chapter 2, embers, marks and gusts may play out while a
 *   gale is drawn; the safe-spot rule knows each shape exactly (lanes and
 *   their shelters, circles, a Backdraft's rings) and keeps
 *   every spot it counts clear of a phone's touch controls; an attack that
 *   would leave none waits.
 * - Nothing a raider must see or reach sits under a phone's touch controls:
 *   the braziers (pulled in from the raid's bottom right), the shelters, the
 *   open heart (it hovers clear of them and glides out before it opens
 *   there) and every safe spot (ASCENDANT_LUMIWICK.phoneControls).
 *
 * The rules are a layer (`AscendantLumiwickRules`) over an Emberwing arena,
 * on while the raid is Lumiwick's Ascendant form (`isAscendant`) and the
 * raid's own hooks otherwise. `AscendantLumiwickArena` is that layer always
 * on: createRaidArena(code, "emberwing", { variant: "ascendant" }) (server
 * code and tests only: clients can't ask for a variant).
 */
import { raidJitter } from "./raid.js";
import { EmberwingArena } from "./raid-emberwing.js";
import { leadPoint } from "./raid-boss-aim.js";
import {
  RULES,
  move,
  normalize,
  type Fighter,
  type Input,
} from "../../../packages/shared/src/index.js";
import {
  ASCENDANT_LUMIWICK as A,
  EMBERWING as E,
  RAID,
  RAID_TRAITS,
  ascendantLumiwickPattern,
  isAscendant,
  riteValue,
  type RaidAttack,
  type RaidWarning,
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
/** Distance from `p` to the segment a-b. */
export function lumiSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}

/** Warnings with a place on the floor (a raider can stand outside them). */
/**
 * (A Hot Gust is not one: its cone is answered by dashing into the wind,
 * as in the raid.)
 */
export const LUMI_SPATIAL = new Set<RaidAttack>([
  "dive-bomb",
  "ember-rain",
  "scorched-earth",
  "snuff-gale",
  "bound-wicks",
]);

/**
 * Is a disc (centre, radius) within `margin` of a phone's touch controls
 * (ASCENDANT_LUMIWICK.phoneControls)? A point is a disc of radius 0.
 */
export function lumiUnderControls(
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
 * Is a raider standing at (x, y) sheltered from a Snuffing Gale (inside a
 * brazier's ring)? `pad` past the raider's own radius shrinks the ring
 * (the safe-spot rule's margin); at RULES.radius it is the landing's test.
 */
export function lumiSheltered(
  braziers: readonly Point[],
  x: number,
  y: number,
  pad: number = RULES.radius,
) {
  const ring = E.brazierRadius - Math.max(0, pad - RULES.radius);
  return braziers.some((b) => Math.hypot(x - b.x, y - b.y) <= ring);
}

/**
 * Would a raider standing at (x, y) be inside this warning's hit (`pad`:
 * the raider's radius plus any margin)? The same tests the landing uses:
 * a dive's or gale's lane (a brazier's ring shelters from the gale), a
 * circle, a Backdraft round each bound brazier.
 */
export function lumiShapeHits(
  w: RaidWarning,
  x: number,
  y: number,
  braziers: readonly Point[],
  pad: number = RULES.radius,
) {
  if (w.kind === "dive-bomb")
    return lumiSegment({ x, y }, w, { x: w.tx, y: w.ty }) < w.radius + pad;
  if (w.kind === "snuff-gale")
    return (
      lumiSegment({ x, y }, w, { x: w.tx, y: w.ty }) < w.radius + pad &&
      !lumiSheltered(braziers, x, y, pad)
    );
  if (w.kind === "bound-wicks")
    return (w.braziers ?? []).some((i) => {
      const b = braziers[i];
      return !!b && Math.hypot(x - b.x, y - b.y) < w.radius + pad;
    });
  if (w.kind === "ember-rain" || w.kind === "scorched-earth")
    return Math.hypot(x - w.x, y - w.y) < w.radius + pad;
  return false;
}

/** How far a raider walks to stand in a brazier's ring (centre inside, a little in). */
export const ringWalk = (p: Point, b: Point) =>
  Math.max(0, dist(p, b) - (E.brazierRadius - 10));

/**
 * The slowest team's walk into the bound rings: one raider to each bound
 * brazier, the assignment whose longest walk is shortest. Infinity if
 * there are fewer raiders than bound braziers.
 */
export function wickWalk(raiders: readonly Point[], bound: readonly Point[]) {
  if (raiders.length < bound.length) return { walk: Infinity, seats: [] };
  let best = { walk: Infinity, seats: [] as number[] };
  const pick = (k: number, used: number[], worst: number) => {
    if (worst >= best.walk) return;
    if (k === bound.length) {
      best = { walk: worst, seats: [...used] };
      return;
    }
    for (let i = 0; i < raiders.length; i++)
      if (!used.includes(i))
        pick(
          k + 1,
          [...used, i],
          Math.max(worst, ringWalk(raiders[i], bound[k])),
        );
  };
  pick(0, [], 0);
  return best;
}

/**
 * The fuse of Bound Wicks for a team whose slowest walk in is `walk` px:
 * a reaction, the walk at the slowest speed, the light itself, and a
 * little to spare. Never under ASCENDANT_LUMIWICK.wicks.min.
 */
export function wickFuse(walk: number) {
  return Math.max(
    A.wicks.min,
    RAID_REACTION +
      Math.max(0, walk) / RAID_SLOWEST_SPEED +
      A.light +
      A.wicks.spare,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmberClass = new (...args: any[]) => EmberwingArena;

/** Ascendant Lumiwick's rules over `Base`, on while the raid is its Ascendant form. */
export function AscendantLumiwickRules<B extends EmberClass>(Base: B) {
  return class AscendantLumiwickRules extends Base {
    /** How often each read and new move was played this run (tests and balance logs). */
    lumiReads = {
      habits: 0,
      anchors: 0,
      revivers: 0,
      feints: 0,
      gales: 0,
      snuffed: 0,
      held: 0,
      wicks: 0,
      kindled: 0,
      snapped: 0,
      combos: 0,
    };
    /** Each raider's dodges: a decaying sum of directions and of weights. */
    protected lumiHabits = new Map<
      string,
      { x: number; y: number; weight: number; n: number }
    >();
    protected lumiDodging = new Map<RaidWarning, Map<string, Point>>();
    protected lumiWatched = new WeakSet<RaidWarning>();
    protected lumiStill = new Map<string, number>();
    protected lumiHitAt = new Map<string, number>();
    /** Dives that will turn into a Snuffing Gale (by cast), and when. */
    protected lumiFeints = new Map<
      number,
      { at: number; target: string; lane: RaidWarning }
    >();
    /** What each fuse was last fitted to (the raiders up). */
    protected wickFit = new Map<number, string>();

    /** Are the Ascendant's rules on? (Off: every hook is the raid's own.) */
    protected lumiAscendant() {
      return isAscendant(this.raid, "emberwing");
    }
    /** A new fight: forget the last one's reads. */
    resetLumiReads() {
      for (const k of Object.keys(this.lumiReads))
        this.lumiReads[k as keyof typeof this.lumiReads] = 0;
      this.lumiHabits.clear();
      this.lumiDodging.clear();
      this.lumiStill.clear();
      this.lumiHitAt.clear();
      this.lumiFeints.clear();
      this.wickFit.clear();
    }

    // ---------------------------------------------------------- Numbers
    /** The Ascendant tier, with its own revive length (see ASCENDANT_LUMIWICK). */
    protected override tier() {
      const t = super.tier();
      return this.lumiAscendant() && this.smart()
        ? { ...t, reviveSeconds: A.reviveSeconds }
        : t;
    }
    /** Health per extra raider (see ASCENDANT_LUMIWICK.perExtraPlayer). */
    protected override bossMaxHp() {
      const r = this.raid;
      if (!this.lumiAscendant() || r.partySize <= 1) return super.bossMaxHp();
      const base = super.bossMaxHp(),
        extra = r.partySize - 1;
      return Math.round(
        (base * (E.health.base + A.perExtraPlayer * extra)) /
          (E.health.base + E.health.perExtraPlayer * extra),
      );
    }
    protected override pattern() {
      if (!this.lumiAscendant()) return super.pattern();
      return ascendantLumiwickPattern(this.raid.phase, this.raid.trait);
    }
    /** Tighter rhythm by chapter, and per extra raider. */
    protected override cadence() {
      const base = super.cadence();
      if (!this.lumiAscendant() || !this.smart()) return base;
      const extra = Math.max(0, this.raid.partySize - 1);
      return (
        base *
        A.cadence[Math.max(0, Math.min(2, this.raid.phase - 1))] *
        (1 - A.partyCadence * extra)
      );
    }
    /** Its hits by party size (see ASCENDANT_LUMIWICK.damage). */
    protected override bossDamage() {
      const base = super.bossDamage();
      if (!this.lumiAscendant() || !this.smart()) return base;
      const size = Math.max(1, Math.min(4, this.raid.partySize));
      return (
        base *
        A.damage[size - 1] *
        (1 + A.partyDamage * Math.max(0, this.raid.partySize - 1))
      );
    }
    /** A party's punish windows (see ASCENDANT_LUMIWICK.partyWindows). */
    protected override window(seconds: number) {
      const base = super.window(seconds);
      if (!this.lumiAscendant() || !this.smart()) return base;
      return base * (1 + A.partyWindows * Math.max(0, this.raid.partySize - 1));
    }
    /** The open heart: shorter than the raid's. */
    protected override exposeSeconds() {
      if (!this.lumiAscendant() || !this.smart()) return super.exposeSeconds();
      return (
        A.expose * (1 + A.partyWindows * Math.max(0, this.raid.partySize - 1)) +
        (this.raid.trait === "updraft" ? 1 : 0)
      );
    }
    /** Its braziers: clear of a phone's controls. */
    protected override brazierSpots() {
      return this.lumiAscendant() ? A.braziers : super.brazierSpots();
    }
    /**
     * A lit brazier burns as in the raid, a pair's timed by this triangle's
     * shortest hop (one lights the third after the two together).
     */
    protected override brazierSeconds() {
      const r = this.raid;
      if (!this.lumiAscendant() || r.partySize !== 2)
        return super.brazierSeconds();
      const team = r.phase >= 3 ? 3.5 : 5;
      return Math.max(team, A.light + lumiHop() / RAID_SLOWEST_SPEED + 0.9);
    }
    /** Its braziers are slower to catch (ASCENDANT_LUMIWICK.light). */
    protected override lightSeconds() {
      return this.lumiAscendant() ? A.light : super.lightSeconds();
    }
    /** It refuses to come down: aloft again after every grounding, from chapter 1. */
    protected override fliesFrom() {
      return this.lumiAscendant() ? 1 : super.fliesFrom();
    }
    protected override bossHome() {
      return this.lumiAscendant() ? { ...A.home } : super.bossHome();
    }
    protected override hoverHome() {
      return this.lumiAscendant() ? A.home : super.hoverHome();
    }
    protected override sway(airborne: boolean) {
      if (!this.lumiAscendant()) return super.sway(airborne);
      return airborne ? A.sway.air : A.sway.ground;
    }
    /** Bound Wicks' fuse keeps its length (it is fitted to the walk). */
    protected override telegraph(kind: RaidAttack, seconds: number) {
      return kind === "bound-wicks" && this.lumiAscendant()
        ? seconds
        : super.telegraph(kind, seconds);
    }
    protected override clearAttacks() {
      super.clearAttacks();
      this.lumiFeints?.clear();
      this.wickFit?.clear();
    }

    // ---------------------------------------------------------- The braziers
    /** Is a raider standing in brazier `index`'s ring, awake, able to light it? */
    protected inRing(p: Fighter, index: number) {
      const b = this.raid.braziers?.[index];
      return (
        !!b &&
        p.hp > 0 &&
        Math.hypot(p.x - b.x, p.y - b.y) <= E.brazierRadius &&
        !this.has(p, "sleep") &&
        !this.has(p, "shell")
      );
    }
    /** The live Bound Wicks, if any. */
    protected wick() {
      return this.raid.warnings.find((w) => w.kind === "bound-wicks");
    }
    /**
     * A bound brazier catches only while every bound brazier still dark has
     * a raider in its ring (they light together); else the raid's rule.
     */
    protected override kindler(index: number, occupants: Fighter[]) {
      if (!this.lumiAscendant()) return super.kindler(index, occupants);
      const w = this.wick();
      const r = this.raid;
      if (w?.braziers?.includes(index)) {
        const dark = w.braziers.filter(
          (j) => (r.braziers?.[j]?.litUntil ?? 0) <= this.time,
        );
        if (!dark.every((j) => this.heroes().some((p) => this.inRing(p, j))))
          return undefined;
      }
      return super.kindler(index, occupants);
    }

    // -------------------------------------------------------- Overlap
    /** A Snuffing Gale stands alone in chapter 1, and always alone. */
    protected override exclusive(kind: RaidAttack) {
      if (
        this.lumiAscendant() &&
        kind === "snuff-gale" &&
        (!this.smart() ||
          this.raid.phase < A.overlap.from ||
          this.heroes().filter((p) => p.hp > 0).length < A.overlap.raiders)
      )
        return true;
      return super.exclusive(kind);
    }
    /**
     * Bound Wicks: aloft, with two dark braziers or more and two raiders up,
     * one wick at a time. One Snuffing Gale at a time.
     */
    protected override allows(kind: RaidAttack) {
      if (!this.lumiAscendant()) return super.allows(kind);
      const r = this.raid;
      if (kind === "bound-wicks") {
        const dark = (r.braziers ?? []).filter((b) => b.litUntil <= this.time);
        return (
          !!r.airborne &&
          r.exposedUntil <= this.time &&
          this.time >= (r.takeoffAt ?? 0) + (r.trait === "updraft" ? 2 : 0) &&
          dark.length >= 2 &&
          this.heroes().filter((p) => p.hp > 0).length >= 2 &&
          !this.wick()
        );
      }
      if (kind === "snuff-gale")
        return !r.warnings.some((w) => w.kind === "snuff-gale");
      return super.allows(kind);
    }
    /**
     * Is (x, y) a spot a raider can rely on? Inside the court, clear of the
     * phone's controls, and outside every lane (a brazier's ring shelters
     * from a gale), circle and Backdraft.
     */
    lumiClear(shapes: RaidWarning[], x: number, y: number) {
      if (!inCourt(x, y) || lumiUnderControls(x, y, 0, 0)) return false;
      const braziers = this.raid.braziers ?? [];
      for (const w of shapes)
        if (lumiShapeHits(w, x, y, braziers, RULES.radius + 4)) return false;
      return true;
    }
    /** The nearest safe spot within `reach` of `p` (see `lumiClear`). */
    lumiSpotNear(shapes: RaidWarning[], p: Point, reach: number) {
      if (this.lumiClear(shapes, p.x, p.y)) return { x: p.x, y: p.y };
      for (const f of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1])
        for (let i = 0; i < 32; i++) {
          const a = (i / 32) * Math.PI * 2;
          const x = p.x + Math.cos(a) * reach * f,
            y = p.y + Math.sin(a) * reach * f;
          if (this.lumiClear(shapes, x, y)) return { x, y };
        }
      return undefined;
    }
    /** The shapes a raider must be clear of by the first landing (a far-off fuse aside). */
    protected lumiLive(shapes: RaidWarning[]) {
      const live = shapes.filter((w) => LUMI_SPATIAL.has(w.kind));
      const near = live.filter((w) => w.kind !== "bound-wicks");
      if (!near.length) return live;
      const first = Math.min(...near.map((w) => w.at));
      return live.filter(
        (w) => w.kind !== "bound-wicks" || w.at <= first + 1.5,
      );
    }
    /**
     * Every raider can reach a safe spot before the first of these lands
     * (slowest champion, after a 0.45 s reaction): see `lumiClear`.
     */
    override safeSpotExists(
      shapes: RaidWarning[] = this.raid.warnings,
      slack = 0,
    ) {
      if (!this.lumiAscendant()) return super.safeSpotExists(shapes);
      const live = this.lumiLive(shapes);
      if (!live.length) return true;
      const first = Math.min(...live.map((w) => w.at));
      const reach =
        RAID_SLOWEST_SPEED *
        Math.max(0, first - this.time - RAID_REACTION - slack);
      return this.heroes()
        .filter((p) => p.hp > 0)
        .every((p) => !!this.lumiSpotNear(live, p, reach));
    }
    /**
     * The raid's overlap spacing, then the Ascendant's safe-spot rule with a
     * little slack: else the new attack waits until the older ones landed.
     */
    protected override spaceOverlap(fresh: RaidWarning[]) {
      super.spaceOverlap(fresh);
      if (!this.lumiAscendant()) return;
      const mine = fresh.filter(
        (w) => LUMI_SPATIAL.has(w.kind) && w.kind !== "bound-wicks",
      );
      const old = this.raid.warnings.filter(
        (w) => !fresh.includes(w) && LUMI_SPATIAL.has(w.kind),
      );
      if (!mine.length || !old.length) return;
      const wait =
        Math.max(
          ...old.filter((o) => o.kind !== "bound-wicks").map((o) => o.at),
          0,
        ) +
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
        (w) =>
          !fresh.includes(w) &&
          LUMI_SPATIAL.has(w.kind) &&
          w.kind !== "bound-wicks",
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
     * wick while it is on the ground, or alone) is dealt again.
     */
    protected override decide(alive: Fighter[], overlapping: boolean) {
      const out = super.decide(alive, overlapping);
      if (out || !this.lumiAscendant() || overlapping || !this.deck.length)
        return out;
      if (this.deck.some((k) => this.allows(k))) return out;
      this.deck = [];
      return super.decide(alive, overlapping);
    }
    protected override startAttack(kind: RaidAttack, target: Fighter) {
      if (!this.lumiAscendant()) return super.startAttack(kind, target);
      const r = this.raid,
        boss = this.boss()!;
      this.noteLumiRead(kind, target);
      if (kind === "snuff-gale" || kind === "bound-wicks") {
        const seen = this.seenAttacks.get(kind) ?? 0;
        this.seenAttacks.set(kind, seen + 1);
        boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
        if (kind === "snuff-gale") this.warnGale(target, seen < 2);
        else this.warnWicks(seen < 2);
        return;
      }
      const rain = kind === "ember-rain" && this.lastBrazier() === undefined;
      const before = new Set(r.warnings);
      super.startAttack(kind, target);
      if (rain && this.smart()) this.rainOnHabit(target);
      if (kind !== "dive-bomb") return;
      const lane = r.warnings.find(
        (w) => w.kind === "dive-bomb" && !before.has(w),
      );
      if (!lane) return;
      // A dive on its own may be a feint (shown in full when it turns).
      const others = [...before].some((w) => LUMI_SPATIAL.has(w.kind));
      if (this.smart() && !lane.teach && !others && this.lumiFeintRoll()) {
        const start = lane.startedAt ?? this.time;
        this.lumiFeints.set(this.currentCast, {
          at: start + (lane.at - start) * A.feint.turnAt,
          target: target.id,
          lane,
        });
      }
    }
    /** Is this dive a feint? A seeded roll per chapter. */
    protected lumiFeintRoll() {
      const r = this.raid;
      const chance = A.feint.chance[Math.max(0, Math.min(2, r.phase - 1))];
      return raidJitter(r.seed ^ 0x1e3f, this.attacks, 23) < chance;
    }
    /**
     * Part-way through, a feinting dive's lane fades and a Snuffing Gale is
     * drawn instead, shown in full from that moment (the honesty rules
     * apply to it as to any new attack).
     */
    protected turnLumiFeints() {
      const r = this.raid;
      for (const [cast, f] of this.lumiFeints) {
        if (this.time < f.at) continue;
        this.lumiFeints.delete(cast);
        const target = this.heroes().find((p) => p.id === f.target && p.hp > 0);
        const live = r.warnings.filter(
          (w) =>
            w !== f.lane &&
            LUMI_SPATIAL.has(w.kind) &&
            w.kind !== "bound-wicks",
        );
        if (
          !r.warnings.includes(f.lane) ||
          !target ||
          live.length ||
          this.charging ||
          r.warnings.some((w) => w.kind === "snuff-gale")
        )
          continue;
        r.warnings = r.warnings.filter((w) => w !== f.lane);
        this.currentCast = cast;
        this.warnGale(target, false);
        this.settleWarnings();
        this.currentCast = 0;
        this.lumiReads.feints++;
        r.message = "A feint! The dive turns into a Snuffing Gale.";
      }
    }
    /**
     * Embers where `target` usually dodges to, once the boss trusts their
     * habit (standing still is the raid's own circle on them).
     */
    protected rainOnHabit(target: Fighter) {
      const habit = this.lumiHabitOf(target.id);
      if (!habit) return;
      const x = Math.max(
          100,
          Math.min(1500, target.x + habit.x * A.habit.offset),
        ),
        y = Math.max(100, Math.min(800, target.y + habit.y * A.habit.offset));
      Object.assign(
        this.warn("ember-rain", x, y, x, y, E.rain.radius, E.rain.delay + 0.1),
        { targetId: target.id },
      );
      this.lumiReads.habits++;
    }
    /**
     * Which brazier a gale blows at: one burning or being lit (a flame
     * first, then the most progress; `prefer` first of all) that some raider
     * can reach before it lands (slowest speed, after a reaction).
     */
    galeBrazier(delay: number, prefer: number[] = []) {
      const r = this.raid;
      if (!r.airborne) return undefined;
      const alive = this.heroes().filter((p) => p.hp > 0);
      const reach =
        RAID_SLOWEST_SPEED * Math.max(0, delay - RAID_REACTION - A.gale.spare);
      let best: number | undefined,
        bestScore = -Infinity;
      (r.braziers ?? []).forEach((b, i) => {
        const lit = b.litUntil > this.time;
        if (!lit && b.progress <= 0 && !prefer.includes(i)) return;
        if (!alive.some((p) => ringWalk(p, b) <= reach)) return;
        const score =
          (prefer.includes(i) ? 4 : 0) +
          (lit ? 2 : b.progress) +
          raidJitter(r.seed ^ 0x6a1e, this.attacks, i) * 0.1;
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      });
      return best;
    }
    /**
     * Snuffing Gale: a lane from where it hovers through a brazier with a
     * flame (or one being lit) some raider can reach in time, and on past
     * it; with none, through where `target` is heading.
     */
    protected warnGale(
      target: Fighter,
      teach: boolean,
      followUp = false,
      prefer: number[] = [],
    ) {
      const r = this.raid,
        boss = this.boss()!;
      const delay = this.telegraph("snuff-gale", A.gale.delay);
      const index = this.galeBrazier(delay, prefer);
      const through =
        index !== undefined
          ? r.braziers![index]
          : leadPoint(target, delay, { x0: 90, y0: 90, x1: 1510, y1: 810 });
      let d = normalize(through.x - boss.x, through.y - boss.y);
      if (Math.hypot(through.x - boss.x, through.y - boss.y) < 30)
        d = normalize(target.x - boss.x || 1, target.y - boss.y);
      const end = {
        x: Math.max(40, Math.min(W - 40, through.x + d.x * A.gale.past)),
        y: Math.max(40, Math.min(H - 40, through.y + d.y * A.gale.past)),
      };
      boss.angle = Math.atan2(end.y - boss.y, end.x - boss.x);
      const w = Object.assign(
        this.warn(
          "snuff-gale",
          boss.x,
          boss.y,
          end.x,
          end.y,
          A.gale.width,
          A.gale.delay,
        ),
        {
          teach,
          targetId: target.id,
          ...(index !== undefined ? { brazier: index } : {}),
          ...(followUp ? { followUp: true } : {}),
        },
      );
      this.lumiReads.gales++;
      r.message =
        index !== undefined
          ? "Snuffing Gale! Hold the flame: stand in its ring."
          : "Snuffing Gale! Leave the lane.";
      return w;
    }
    /**
     * Bound Wicks: a burning wick ties two dark braziers (three in the last
     * chapter with three raiders up): the ones the team reaches soonest
     * together. Its fuse fits the slowest team's walk in and the light.
     */
    protected warnWicks(teach: boolean) {
      const r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0);
      const chapter = Math.max(0, Math.min(2, r.phase - 1));
      const dark = (r.braziers ?? [])
        .map((b, i) => ({ b, i }))
        .filter((x) => x.b.litUntil <= this.time);
      const want = Math.min(dark.length, alive.length, A.wicks.bound[chapter]);
      if (want < 2) return undefined;
      // the set of `want` dark braziers whose slowest walk in is shortest
      let best: { walk: number; set: number[] } = { walk: Infinity, set: [] };
      const sets: number[][] = [];
      const choose = (from: number, set: number[]) => {
        if (set.length === want) return sets.push(set);
        for (let k = from; k < dark.length; k++)
          choose(k + 1, [...set, dark[k].i]);
      };
      choose(0, []);
      for (const set of sets) {
        const walk = wickWalk(
          alive,
          set.map((i) => r.braziers![i]),
        ).walk;
        if (walk < best.walk) best = { walk, set };
      }
      const pts = best.set.map((i) => r.braziers![i]);
      const c = {
        x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
      };
      const w = Object.assign(
        this.warn(
          "bound-wicks",
          c.x,
          c.y,
          c.x,
          c.y,
          E.brazierRadius + A.wicks.burst,
          A.wicks.min,
        ),
        { teach, braziers: best.set },
      );
      for (const i of best.set) r.braziers![i].progress = 0;
      this.fitWicks(w);
      this.lumiReads.wicks++;
      r.message =
        best.set.length > 2
          ? "Bound Wicks! All three rings at once — light them together."
          : "Bound Wicks! Stand in both bound rings together.";
      return w;
    }
    /** What a fuse depends on: the raiders up. */
    protected wickKey() {
      return this.heroes()
        .filter((p) => p.hp > 0)
        .map((p) => p.id)
        .join(",");
    }
    /**
     * Give a fuse the time the slowest team needs from now (a team that
     * shrank below the bound count drops the farthest brazier; below two,
     * the wick falls away harmlessly).
     */
    protected fitWicks(w: RaidWarning) {
      const r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0);
      let bound = (w.braziers ?? []).filter(
        (i) => (r.braziers?.[i]?.litUntil ?? 0) <= this.time,
      );
      while (bound.length > Math.max(2, alive.length) && bound.length > 2) {
        const far = [...bound].sort(
          (a, b) =>
            Math.min(...alive.map((p) => ringWalk(p, r.braziers![b]))) -
            Math.min(...alive.map((p) => ringWalk(p, r.braziers![a]))),
        )[0];
        bound = bound.filter((i) => i !== far);
        w.braziers = (w.braziers ?? []).filter((i) => i !== far);
      }
      if (alive.length < 2 || (w.braziers ?? []).length < 2) {
        r.warnings = r.warnings.filter((x) => x !== w);
        this.wickFit.delete(w.id);
        return;
      }
      const plan = wickWalk(
        alive,
        bound.map((i) => r.braziers![i]),
      );
      const need = Number.isFinite(plan.walk)
        ? wickFuse(plan.walk)
        : wickFuse(1200);
      w.at = Math.max(w.at, this.time + need);
      this.wickFit.set(w.id, this.wickKey());
    }

    protected override resolveWarning(w: RaidWarning, boss: Fighter) {
      if (!this.lumiAscendant()) return super.resolveWarning(w, boss);
      const r = this.raid;
      if (w.kind === "snuff-gale") {
        const braziers = r.braziers ?? [];
        const d = normalize(w.tx - w.x, w.ty - w.y);
        this.hitBy = "snuff-gale";
        for (const p of this.heroes()) {
          if (p.hp <= 0 || !lumiShapeHits(w, p.x, p.y, braziers)) continue;
          this.damage(p, A.gale.damage, boss.id);
          move(p, d.x * A.gale.push, d.y * A.gale.push);
        }
        this.hitBy = undefined;
        this.event(
          "raid-impact",
          { x: w.tx, y: w.ty },
          0xbfe9ff,
          undefined,
          boss.id,
        );
        this.events[this.events.length - 1].raidRadius = w.radius;
        if (w.brazier === undefined) return;
        const b = braziers[w.brazier];
        if (!b) return;
        const keeper = this.heroes()
          .filter((p) => this.inRing(p, w.brazier!))
          .sort((p, q) => dist(p, b) - dist(q, b))[0];
        if (!keeper) {
          const had = b.litUntil > this.time || b.progress > 0;
          b.progress = 0;
          b.litUntil = 0;
          if (had) {
            this.lumiReads.snuffed++;
            r.message = "Snuffed! Nobody held that flame.";
          }
          return;
        }
        this.lumiReads.held++;
        r.message = `${keeper.name} holds the flame!`;
        // A held flame: embers on its keeper.
        if (
          this.smart() &&
          r.phase >= A.combosFrom.gale &&
          r.exposedUntil <= this.time
        ) {
          const ember = Object.assign(
            this.warn(
              "ember-rain",
              keeper.x,
              keeper.y,
              keeper.x,
              keeper.y,
              E.rain.radius,
              E.rain.delay,
            ),
            { followUp: true, targetId: keeper.id },
          );
          this.placeFollowUp([ember]);
          this.lumiReads.combos++;
        }
        return;
      }
      if (w.kind === "bound-wicks") {
        this.wickFit.delete(w.id);
        const bound = (w.braziers ?? []).filter((i) => !!r.braziers?.[i]);
        if (
          bound.every((i) => r.braziers![i].litUntil > this.time) ||
          this.heroes().filter((p) => p.hp > 0).length < 2
        )
          return;
        // The wick snaps: a Backdraft from each bound brazier, every flame out.
        this.hitBy = "bound-wicks";
        for (const p of this.heroes())
          if (p.hp > 0 && lumiShapeHits(w, p.x, p.y, r.braziers ?? []))
            this.damage(p, A.wicks.damage, boss.id);
        this.hitBy = undefined;
        for (const i of bound) {
          this.event(
            "raid-impact",
            r.braziers![i],
            0xff7a3d,
            undefined,
            boss.id,
          );
          this.events[this.events.length - 1].raidRadius = w.radius;
        }
        for (const b of r.braziers ?? []) {
          b.progress = 0;
          b.litUntil = 0;
        }
        this.lumiReads.snapped++;
        r.message = "The wick snaps! Backdraft — every flame is out.";
        return;
      }
      super.resolveWarning(w, boss);
    }

    // -------------------------------------------------------- Each tick
    protected override attacksStep(dt: number) {
      if (!this.lumiAscendant()) return super.attacksStep(dt);
      this.turnLumiFeints();
      super.attacksStep(dt);
      this.learnLumiDodges();
    }
    /**
     * After the braziers: kindled wicks fall away (from chapter 2 a gale
     * answers at one of the new flames), and a fuse whose team changed gets
     * the time it now needs.
     */
    protected override worldStep(dt: number, boss: Fighter) {
      const before = this.lumiAscendant() ? this.wick() : undefined;
      super.worldStep(dt, boss);
      if (!this.lumiAscendant()) return;
      const r = this.raid;
      // The wicks caught as the third flame did: it came down at once.
      if (
        before &&
        !r.warnings.includes(before) &&
        (before.braziers ?? []).every(
          (i) => (r.braziers?.[i]?.litUntil ?? 0) > this.time,
        )
      ) {
        this.wickFit.delete(before.id);
        this.lumiReads.kindled++;
      }
      for (const w of [...r.warnings]) {
        if (w.kind !== "bound-wicks") continue;
        const bound = w.braziers ?? [];
        if (
          bound.length &&
          bound.every((i) => (r.braziers?.[i]?.litUntil ?? 0) > this.time)
        ) {
          r.warnings = r.warnings.filter((x) => x !== w);
          this.wickFit.delete(w.id);
          this.lumiReads.kindled++;
          r.message = "The wicks catch together!";
          for (const i of bound)
            this.event("heal", r.braziers![i], 0xffd778, 0, boss.id);
          if (
            this.smart() &&
            r.phase >= A.combosFrom.wicks &&
            r.airborne &&
            !r.warnings.some((x) => x.kind === "snuff-gale")
          ) {
            const target =
              this.heroes()
                .filter((p) => p.hp > 0)
                .sort(
                  (p, q) =>
                    Math.min(...bound.map((i) => dist(p, r.braziers![i]))) -
                    Math.min(...bound.map((i) => dist(q, r.braziers![i]))),
                )[0] ?? undefined;
            if (target) {
              this.currentCast = ++this.castSerial;
              const gale = this.warnGale(target, false, true, bound);
              this.settleWarnings();
              this.placeFollowUp([gale]);
              this.currentCast = 0;
              this.nextAttack = Math.max(this.nextAttack, gale.at + 0.3);
              this.lumiReads.combos++;
              r.message = "The wicks catch — Lumiwick blows at the new flame!";
            }
          }
          continue;
        }
        if (this.wickFit.get(w.id) !== this.wickKey()) this.fitWicks(w);
      }
    }
    /**
     * It holds still while a gale is drawn (the lane starts where it
     * hovers), and an open heart under a phone's controls glides out.
     */
    protected override bossStep(dt: number, boss: Fighter) {
      if (!this.lumiAscendant()) return super.bossStep(dt, boss);
      const r = this.raid;
      if (!this.charging) {
        if (r.warnings.some((w) => w.kind === "snuff-gale")) return;
        const open = r.exposedUntil > this.time || !!r.permanentGround;
        if (open && lumiUnderControls(boss.x, boss.y, A.heartClear)) {
          const d = normalize(A.home.x - boss.x, A.home.y - boss.y),
            step = Math.min(
              A.glide * dt,
              Math.hypot(A.home.x - boss.x, A.home.y - boss.y),
            );
          boss.x += d.x * step;
          boss.y += d.y * step;
          return;
        }
      }
      super.bossStep(dt, boss);
    }

    // -------------------------------------------------------- Habit aim
    /** Where each raider went from inside a fresh warning, by the time it landed. */
    protected learnLumiDodges() {
      const r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0);
      const braziers = r.braziers ?? [];
      for (const w of r.warnings) {
        if (this.lumiWatched.has(w)) continue;
        this.lumiWatched.add(w);
        if (!LUMI_SPATIAL.has(w.kind) || w.kind === "bound-wicks") continue;
        const inside = new Map<string, Point>();
        for (const p of alive)
          if (lumiShapeHits(w, p.x, p.y, braziers))
            inside.set(p.id, { x: p.x, y: p.y });
        if (inside.size) this.lumiDodging.set(w, inside);
      }
      for (const [w, from] of this.lumiDodging) {
        if (r.warnings.includes(w)) continue;
        this.lumiDodging.delete(w);
        for (const [id, start] of from) {
          const p = alive.find((q) => q.id === id);
          if (!p) continue;
          const dx = p.x - start.x,
            dy = p.y - start.y;
          if (Math.hypot(dx, dy) >= 30) this.noteLumiDodge(id, dx, dy);
        }
      }
    }
    /** Remember one dodge of raider `id` (also used by tests). */
    noteLumiDodge(id: string, dx: number, dy: number) {
      const len = Math.hypot(dx, dy) || 1;
      const h = this.lumiHabits.get(id) ?? { x: 0, y: 0, weight: 0, n: 0 };
      h.x = h.x * 0.6 + dx / len;
      h.y = h.y * 0.6 + dy / len;
      h.weight = h.weight * 0.6 + 1;
      h.n++;
      this.lumiHabits.set(id, h);
    }
    /** The direction a raider usually dodges, once the boss trusts it. */
    lumiHabitOf(id: string): Point | undefined {
      const h = this.lumiHabits.get(id);
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
      ability?: Parameters<EmberwingArena["damage"]>[3],
    ) {
      super.damage(target, amount, owner, ability);
      if (target.raidBoss && owner !== target.id && this.lumiAscendant())
        this.lumiHitAt.set(owner, this.time);
    }
    protected override trackMotion() {
      super.trackMotion();
      if (!this.lumiAscendant()) return;
      for (const p of this.heroes()) {
        const still =
          p.hp > 0 && Math.hypot(p.vx ?? 0, p.vy ?? 0) < A.anchor.speed;
        if (!still) this.lumiStill.delete(p.id);
        else if (!this.lumiStill.has(p.id)) this.lumiStill.set(p.id, this.time);
      }
    }
    /** Standing still while hitting the boss (for the anchor read). */
    lumiAnchored(p: Fighter) {
      const since = this.lumiStill.get(p.id);
      return (
        since !== undefined &&
        this.time - since >= A.anchor.still &&
        this.time - (this.lumiHitAt.get(p.id) ?? -99) <= A.anchor.hit
      );
    }
    protected lumiReviving(p: Fighter) {
      return this.heroes().some(
        (d) =>
          d.hp <= 0 &&
          !this.raid.downed[d.id]?.self &&
          Math.hypot(d.x - p.x, d.y - p.y) <= RAID.reviveRange,
      );
    }
    protected noteLumiRead(kind: RaidAttack, target: Fighter) {
      if (!this.smart() || !LUMI_HUNTS.has(kind)) return;
      if (this.lumiReviving(target)) this.lumiReads.revivers++;
      else if (kind === "dive-bomb" && this.lumiAnchored(target))
        this.lumiReads.anchors++;
    }
    /** A dive for a raider standing still to attack; embers on one kneeling to revive. */
    protected override reactions(s: RaidSituation): RaidReaction[] {
      const out = super.reactions(s);
      if (!this.lumiAscendant()) return out;
      for (const p of s.alive)
        if (this.lumiAnchored(p))
          out.push({ kind: "dive-bomb", score: 1.5, target: p });
      for (const p of s.reviving)
        out.push({ kind: "ember-rain", score: 1.6, target: p });
      return out;
    }
    /** The raider kneeling by a fallen ally comes first. */
    protected override chooseTarget(kind: RaidAttack, alive: Fighter[]) {
      if (
        this.lumiAscendant() &&
        this.smart() &&
        alive.length > 1 &&
        LUMI_HUNTS.has(kind)
      ) {
        const reviver = alive
          .filter((p) => this.lumiReviving(p))
          .sort(
            (a, b) =>
              (this.threat.get(b.id) ?? 0) - (this.threat.get(a.id) ?? 0),
          )[0];
        if (reviver) return reviver;
      }
      return super.chooseTarget(kind, alive);
    }

    // -------------------------------------------------------- Stand-ins
    /**
     * Who stands in which bound ring: the seating the fuse was fitted to
     * (each bound brazier to a different raider, the slowest walk shortest).
     */
    wickSeats(w: RaidWarning) {
      const r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0);
      const bound = (w.braziers ?? []).filter(
        (i) => (r.braziers?.[i]?.litUntil ?? 0) <= this.time,
      );
      const plan = wickWalk(
        alive,
        bound.map((i) => r.braziers![i]),
      );
      const seats = new Map<string, number>();
      plan.seats.forEach((k, j) => seats.set(alive[k].id, bound[j]));
      return seats;
    }
    /**
     * Stand-ins play the raid's own way (dodging, rings, the brazier seats
     * by turn, the clear side of a ring under embers) with the Ascendant's
     * teamwork on top:
     * - a Snuffing Gale at a flame: whoever can reach that ring first holds
     *   it (sheltered); everyone else leaves the lane, or shelters in a ring
     *   if that is nearer;
     * - Bound Wicks: each bound ring is claimed by the raider the fuse was
     *   fitted to; they wait in it for the others, and step out of the
     *   Backdraft if the fuse can no longer be beaten.
     */
    protected override botHint(
      bot: Fighter,
      input: Input,
      go: (x: number, y: number, away: boolean) => Input,
    ): Input | undefined {
      if (!this.lumiAscendant()) return super.botHint(bot, input, go);
      const r = this.raid;
      const braziers = r.braziers ?? [];
      const stay = (x: number, y: number, near: number) => {
        input.basic = false;
        input.skill = -1;
        input.dash = false;
        if (Math.hypot(bot.x - x, bot.y - y) > near) return go(x, y, false);
        input.dx = input.dy = 0;
        return input;
      };
      // The raid's urgent dodges first: a dive lane, someone else's mark.
      const urgent = r.warnings.some(
        (w) =>
          (w.kind === "dive-bomb" &&
            lumiSegment(bot, w, { x: w.tx, y: w.ty }) <
              w.radius + RULES.radius + 30) ||
          (w.kind === "heat-mark" &&
            w.targetId !== bot.id &&
            Math.hypot(w.x - bot.x, w.y - bot.y) < w.radius + 80),
      );
      if (urgent) return super.botHint(bot, input, go);
      const gale = r.warnings.find((w) => w.kind === "snuff-gale");
      if (gale) {
        const b =
          gale.brazier !== undefined ? braziers[gale.brazier] : undefined;
        if (b) {
          const keeper = this.heroes()
            .filter((p) => p.hp > 0)
            .sort((p, q) => ringWalk(p, b) - ringWalk(q, b))[0];
          if (keeper?.id === bot.id)
            return stay(b.x, b.y, E.brazierRadius * 0.45);
        }
        if (lumiShapeHits(gale, bot.x, bot.y, braziers, RULES.radius + 10)) {
          const shapes = this.lumiLive(r.warnings).map((w) => ({
            ...w,
            radius: w.radius + 6,
          }));
          const spot = this.lumiSpotNear(shapes, bot, 420);
          if (spot) return stay(spot.x, spot.y, 6);
        }
      }
      const wick = this.wick();
      if (wick && r.airborne) {
        const seat = this.wickSeats(wick).get(bot.id);
        if (seat !== undefined) {
          const b = braziers[seat];
          const progress = Math.min(
            ...(wick.braziers ?? []).map((i) =>
              (braziers[i]?.litUntil ?? 0) > this.time
                ? 1
                : (braziers[i]?.progress ?? 0),
            ),
          );
          const walk = Math.max(
            ...[...this.wickSeats(wick)].map(([id, i]) => {
              const p = this.heroes().find((q) => q.id === id)!;
              return ringWalk(p, braziers[i]);
            }),
          );
          const need =
            walk / RAID_SLOWEST_SPEED +
            A.light *
              (1 - progress) *
              (this.hasRite(bot, "fireproof")
                ? 1 - riteValue("fireproof", r.phase)
                : 1);
          const left = wick.at - this.time;
          if (left < need - 0.05 && left < 1.6) {
            // it can't be beaten now: out of the Backdraft
            if (
              lumiShapeHits(wick, bot.x, bot.y, braziers, RULES.radius + 12)
            ) {
              const out = this.lumiSpotNear(
                [{ ...wick, radius: wick.radius + 8 }],
                bot,
                400,
              );
              if (out) return stay(out.x, out.y, 6);
            }
          } else if (!r.warnings.some((w) => w.kind === "ember-rain"))
            return stay(b.x, b.y, E.brazierRadius * 0.5);
        }
      }
      return super.botHint(bot, input, go);
    }
  };
}

/** Attacks that hunt a reviver (and read a raider standing still). */
const LUMI_HUNTS = new Set<RaidAttack>([
  "dive-bomb",
  "ember-rain",
  "heat-mark",
  "snuff-gale",
]);
/** The shortest walk between two of its braziers. */
export function lumiHop() {
  let best = Infinity;
  A.braziers.forEach((a, i) =>
    A.braziers.slice(i + 1).forEach((b) => (best = Math.min(best, dist(a, b)))),
  );
  return best;
}

export class AscendantLumiwickArena extends AscendantLumiwickRules(
  EmberwingArena,
) {
  constructor(code: string) {
    super(code, "emberwing");
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
      r.maxHp = Math.round(r.maxHp / E.health.gilded);
      r.gilded = false;
    }
    const boss = this.boss();
    if (boss) Object.assign(boss, { hp: r.maxHp, name: A.name });
    this.resetLumiReads();
    r.message = `${RAID_TRAITS[r.trait].name} ${A.name} · ${RAID_TRAITS[r.trait].text}`;
  }

  protected override finishMessage(won: boolean): string {
    return won
      ? "The last lantern settles at your feet. The Spire's summit burns for you!"
      : "Ascendant Lumiwick still floats out of reach. Light together and climb again.";
  }
}
