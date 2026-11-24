/**
 * Ascendant Snoozaku: the evolved dream-eating baku on the Spire's fortieth
 * floor (docs/spire: "Ascendant bosses"). The raid's Snoozaku (Somnara's
 * id), pushed further through the same warning, deck and honesty machinery,
 * and built from its own rules (a private dream, runes called aloud, pads
 * stepped in order):
 *
 * - New moves: the Twin Dream (two Dreamers share one dream, each seeing
 *   only their own runes, and must call in turn; alone, the dream fades
 *   after a glimpse) and the Dream Tide (sleep floods the deck; one pad stays
 *   awake and only one raider, the Seer, sees which: they call it and the
 *   team runs there).
 * - Its rhythm tightens by chapter, it slows down less for a dream, and its
 *   dreams grow longer.
 * - Combos (ASCENDANT_SNOOZAKU.combosFrom): a trunk slam that misses calls
 *   stars down on its raider; a Nightmare drops stars on whoever stepped
 *   wrong; a Dream Tide that lands rings out lullabies from the awake pad.
 *   Feints: a trunk slam whose lane fades part-way into Falling Stars.
 * - Reads: stars aimed where a raider habitually dodges, stars for a raider
 *   standing still to attack, and the raider kneeling to revive first.
 * - Overlap: its stars may land while rings or bubbles are out; the
 *   safe-spot rule knows the wrong pads mid-dream (a step there is a
 *   Nightmare) and keeps every guaranteed spot clear of a phone's touch
 *   controls; an attack that would leave none waits.
 * - Its pads (and a Dream Tide's awake ring) sit clear of the phone's touch
 *   controls (ASCENDANT_SNOOZAKU.pads, phoneControls).
 *
 * The rules are a layer (`AscendantSnoozakuRules`) over a Somnara arena, on
 * while the raid is Snoozaku's Ascendant form (`isAscendant`) and the raid's
 * own hooks otherwise, so one arena can carry several Ascendants' layers.
 * `AscendantSnoozakuArena` is that layer always on:
 * createRaidArena(code, "somnara", { variant: "ascendant" }) (server code
 * and tests only: clients can't ask for a variant). The dream and the
 * awake pad stay secrets: only `dreamFor` hands a raider what they may see.
 */
import { raidJitter } from "./raid.js";
import { SomnaraArena } from "./raid-somnara.js";
import {
  RULES,
  normalize,
  type Fighter,
  type Input,
} from "../../../packages/shared/src/index.js";
import {
  ASCENDANT_SNOOZAKU as A,
  DREAM_RUNES,
  RAID,
  RAID_TRAITS,
  SOMNARA as S,
  ascendantSnoozakuPattern,
  isAscendant,
  type DreamRune,
  type RaidAttack,
  type RaidDreamView,
  type RaidWarning,
} from "../../../packages/shared/src/raid.js";
import {
  RAID_JUMP_ATTACKS,
  RAID_REACTION,
  RAID_SLOWEST_SPEED,
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
const segment = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
};

/**
 * Is a disc (centre, radius) within `margin` of a phone's touch controls
 * (ASCENDANT_SNOOZAKU.phoneControls)? A point is a disc of radius 0.
 */
export function underControls(
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
 * How long a Dream Tide waits, for raiders `walk` px (the farthest) from
 * inside the awake ring: the Seer reads the vision, calls it, the team
 * hears the call (each a reaction), then everyone walks at the slowest
 * speed, with a little to spare.
 */
export function tideDelay(walk: number) {
  return Math.max(
    A.tide.delay,
    2 * RAID_REACTION +
      A.tide.call +
      Math.max(0, walk) / RAID_SLOWEST_SPEED +
      0.25,
  );
}

/** The colour of the event that marks a Dream Tide's awake pad as it lands. */
export const TIDE_AWAKE = 0xfff3c4;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DreamClass = new (...args: any[]) => SomnaraArena;

/** Ascendant Snoozaku's rules over `Base`, on while the raid is its Ascendant form. */
export function AscendantSnoozakuRules<B extends DreamClass>(Base: B) {
  return class AscendantSnoozakuRules extends Base {
    /** How often each read and new move was played this run (tests and balance logs). */
    snoozeReads = {
      habits: 0,
      anchors: 0,
      revivers: 0,
      feints: 0,
      tides: 0,
      twins: 0,
      combos: 0,
    };
    /** Each raider's dodges: a decaying sum of directions and of weights. */
    protected snoozeHabits = new Map<
      string,
      { x: number; y: number; weight: number; n: number }
    >();
    protected snoozeDodging = new Map<RaidWarning, Map<string, Point>>();
    protected snoozeWatched = new WeakSet<RaidWarning>();
    protected snoozeStill = new Map<string, number>();
    protected snoozeHitAt = new Map<string, number>();
    /** Casts whose trunk slam already called stars down. */
    protected snoozeCombos = new Set<number>();
    /** Trunk slams that will turn into Falling Stars (by cast), and when. */
    protected snoozeFeints = new Map<
      number,
      { at: number; target: string; lane: RaidWarning }
    >();
    /** While true, each new dream (a Nightmare's too) is a Twin Dream. */
    protected twinMode = false;
    /** Each live Dream Tide's awake rune (by warning id): a secret. */
    protected tideRunes = new Map<number, DreamRune>();
    /** Dream Tides whose stand-in Seer has called. */
    protected tideCalled = new Set<number>();
    protected previousSeer = "";

    /** Are the Ascendant's rules on? (Off: every hook is the raid's own.) */
    protected snoozeAscendant() {
      return isAscendant(this.raid, "somnara");
    }
    /** A new fight: forget the last one's reads. */
    protected resetSnoozeReads() {
      for (const k of Object.keys(this.snoozeReads))
        this.snoozeReads[k as keyof typeof this.snoozeReads] = 0;
      this.snoozeHabits.clear();
      this.snoozeDodging.clear();
      this.snoozeStill.clear();
      this.snoozeHitAt.clear();
      this.snoozeCombos.clear();
      this.snoozeFeints.clear();
      this.twinMode = false;
      this.tideRunes.clear();
      this.tideCalled.clear();
      this.previousSeer = "";
    }

    // ---------------------------------------------------------- Numbers
    /** The Ascendant tier, with its own revive length (see ASCENDANT_SNOOZAKU). */
    protected override tier() {
      const t = super.tier();
      return this.snoozeAscendant() && this.smart()
        ? { ...t, reviveSeconds: A.reviveSeconds }
        : t;
    }
    /** Health per extra raider (see ASCENDANT_SNOOZAKU.perExtraPlayer). */
    protected override bossMaxHp() {
      const r = this.raid;
      if (!this.snoozeAscendant() || r.partySize <= 1) return super.bossMaxHp();
      const base = super.bossMaxHp(),
        extra = r.partySize - 1;
      return Math.round(
        (base * (S.health.base + A.perExtraPlayer * extra)) /
          (S.health.base + S.health.perExtraPlayer * extra),
      );
    }
    protected override pattern() {
      if (!this.snoozeAscendant()) return super.pattern();
      return ascendantSnoozakuPattern(this.raid.phase);
    }
    /** Its own pads, clear of the phone's touch controls. */
    protected override pads() {
      return this.snoozeAscendant() ? A.pads : super.pads();
    }
    /** Tighter rhythm by chapter; it slows down less for a dream. */
    protected override cadence() {
      const base = super.cadence();
      if (!this.snoozeAscendant() || !this.smart()) return base;
      const r = this.raid;
      const dream =
        r.dream && r.partySize > 1 ? A.dreamCadence / S.dreamCadence : 1;
      const solo = r.partySize === 1 ? A.solo.cadence : 1;
      return (
        base * dream * solo * A.cadence[Math.max(0, Math.min(2, r.phase - 1))]
      );
    }
    /** A party meets harder hits (see ASCENDANT_SNOOZAKU.partyDamage). */
    protected override bossDamage() {
      const base = super.bossDamage();
      if (!this.snoozeAscendant() || !this.smart()) return base;
      const size = Math.max(1, Math.min(4, this.raid.partySize));
      return (
        base *
        A.damage[size - 1] *
        (1 + A.partyDamage * Math.max(0, this.raid.partySize - 1))
      );
    }
    /** A party's punish windows (see ASCENDANT_SNOOZAKU.partyWindows). */
    protected override window(seconds: number) {
      const base = super.window(seconds);
      if (!this.snoozeAscendant() || !this.smart()) return base;
      return base * (1 + A.partyWindows * Math.max(0, this.raid.partySize - 1));
    }
    /** A Dream Tide's warning keeps its length (it waits for the call and the walk). */
    protected override telegraph(kind: RaidAttack, seconds: number) {
      return kind === "dream-tide" && this.snoozeAscendant()
        ? seconds
        : super.telegraph(kind, seconds);
    }
    protected override clearAttacks() {
      super.clearAttacks();
      this.snoozeFeints.clear();
      this.tideRunes.clear();
      this.tideCalled.clear();
      this.twinMode = false;
    }

    // ------------------------------------------------------------ Dreams
    /** Longer dreams by chapter; a Twin Dream one rune longer still. */
    protected override dreamLength() {
      const base = super.dreamLength();
      if (!this.snoozeAscendant()) return base;
      const r = this.raid;
      return (
        base +
        A.longerDreams[Math.max(0, Math.min(2, r.phase - 1))] +
        (this.twinMode && r.partySize > 1 ? A.twin.extra : 0)
      );
    }
    protected override dreamSeconds() {
      if (!this.snoozeAscendant()) return super.dreamSeconds();
      const solo = this.raid.partySize === 1;
      if (this.twinMode) return solo ? A.twin.soloSeconds : A.twin.seconds;
      return solo ? A.solo.seconds : super.dreamSeconds();
    }
    /**
     * A new dream; in a Twin Dream a second Dreamer shares it (a raider
     * awake if one is), and alone it fades after a glimpse. A Twin Dream is
     * never read backwards.
     */
    protected override beginDream() {
      super.beginDream();
      const r = this.raid,
        d = r.dream;
      if (!this.snoozeAscendant() || !d || !this.twinMode) return;
      d.backwards = false;
      const others = this.heroes().filter(
        (p) => p.hp > 0 && p.id !== d.dreamerId,
      );
      if (!others.length) {
        d.fadeAt = this.time + A.twin.glimpse;
        r.message = "A fleeting dream! Read it now: it fades in a moment.";
        return;
      }
      const awake = others.filter(
        (p) => (r.drowsy?.[p.id]?.sleepUntil ?? 0) <= this.time,
      );
      const pool = awake.length ? awake : others;
      const pick = new Uint32Array(1);
      crypto.getRandomValues(pick);
      const partner = pool[pick[0] % pool.length];
      d.partnerId = partner.id;
      const dreamer = this.heroes().find((p) => p.id === d.dreamerId);
      r.message = `Twin Dream! ${dreamer?.name ?? "The Dreamer"} and ${partner.name} each see half: call in turn.`;
    }
    /** Both Dreamers of a Twin Dream call. */
    protected override callers(d = this.raid.dream) {
      const base = super.callers(d);
      return this.snoozeAscendant() && d?.partnerId
        ? [...base, d.partnerId]
        : base;
    }
    /** The Dreamer whose rune a Twin Dream's step is (even: the first). */
    protected stepOwner(step: number) {
      const d = this.raid.dream;
      if (!d) return undefined;
      return d.partnerId && step % 2 === 1 ? d.partnerId : d.dreamerId;
    }
    /** The live Dream Tide, if any. */
    protected liveTide() {
      return this.raid.warnings.find((w) => w.kind === "dream-tide");
    }
    /**
     * What a raider may see: a Twin Dream's Dreamers their own runes (the
     * other's steps hidden), a faded dream only what is done, a Dream Tide's
     * Seer its awake rune. Never part of RaidState.
     */
    override dreamFor(id: string): RaidDreamView | undefined {
      if (!this.snoozeAscendant()) return super.dreamFor(id);
      const r = this.raid,
        p = this.heroes().find((q) => q.id === id && q.hp > 0);
      if (!p || this.phase !== "playing") return undefined;
      const tide = this.liveTide();
      const rune = tide && this.tideRunes.get(tide.id);
      if (tide && rune && tide.targetId === id)
        return {
          id: tide.id,
          runes: [rune],
          full: true,
          backwards: false,
          tide: true,
        };
      const d = r.dream;
      if (!d) return undefined;
      const shared = this.sharedUntil > this.time;
      if (!shared && !(d.partnerId === id || d.dreamerId === id))
        return super.dreamFor(id);
      let hidden: number[] = [];
      if (!shared && d.partnerId)
        hidden = this.sequence
          .map((_, i) => i)
          .filter((i) => (i % 2 === 1) === (id === d.dreamerId));
      else if (!shared && d.fadeAt !== undefined && this.time >= d.fadeAt)
        hidden = this.sequence.map((_, i) => i).filter((i) => i >= d.step);
      const runes = this.sequence.map((q, i) =>
        hidden.includes(i) ? DREAM_RUNES[0] : q,
      );
      return {
        id: d.id,
        runes: d.backwards ? runes.reverse() : runes,
        full: true,
        backwards: d.backwards,
        ...(hidden.length
          ? {
              hidden: d.backwards
                ? hidden.map((i) => runes.length - 1 - i)
                : hidden,
            }
          : {}),
      };
    }
    /** A Dream Tide's Seer calls the awake pad (step -1). */
    override callRune(id: string, rune: DreamRune) {
      const tide = this.snoozeAscendant() ? this.liveTide() : undefined;
      const r = this.raid,
        p = this.heroes().find((q) => q.id === id && q.hp > 0);
      if (!tide || r.dream || tide.targetId !== id)
        return super.callRune(id, rune);
      if (
        this.phase !== "playing" ||
        !p ||
        this.has(p, "sleep") ||
        !DREAM_RUNES.includes(rune) ||
        this.time < (this.runeCallAt.get(id) ?? 0)
      )
        return false;
      this.runeCallAt.set(id, this.time + 0.3);
      r.runeCalls = (r.runeCalls ?? [])
        .filter((q) => q.until > this.time)
        .slice(-5);
      r.runeCalls.push({
        id: ++this.serial,
        playerId: id,
        rune,
        step: -1,
        until: Math.max(this.time + 3.5, tide.at + 0.3),
      });
      return true;
    }
    /**
     * Stand-ins call what they see: a Twin Dream's step by the Dreamer it
     * belongs to, a Dream Tide's awake pad by its Seer (once it has read
     * the vision).
     */
    protected override botCallRunes() {
      if (!this.snoozeAscendant()) return super.botCallRunes();
      const tide = this.liveTide();
      const rune = tide && this.tideRunes.get(tide.id);
      if (
        tide &&
        rune &&
        tide.targetId &&
        this.bots.has(tide.targetId) &&
        !this.tideCalled.has(tide.id) &&
        this.time >= (tide.startedAt ?? 0) + RAID_REACTION &&
        this.callRune(tide.targetId, rune)
      )
        this.tideCalled.add(tide.id);
      const d = this.raid.dream;
      if (!d?.partnerId) return super.botCallRunes();
      const owner = this.stepOwner(d.step)!;
      if (
        this.bots.has(owner) &&
        this.time >= (this.runeCallAt.get(owner) ?? 0)
      )
        this.callRune(owner, this.sequence[d.step]);
    }
    /** What a stand-in knows of this step: its own runes, else a rune called. */
    protected override botRune(bot: Fighter) {
      if (!this.snoozeAscendant()) return super.botRune(bot);
      const d = this.raid.dream;
      if (!d) return undefined;
      const view = this.dreamFor(bot.id);
      const at = view?.backwards ? d.length - 1 - d.step : d.step;
      if (view?.full && !view.tide && !(view.hidden ?? []).includes(at))
        return view.runes[at];
      const callers = this.callers(d);
      return [...(this.raid.runeCalls ?? [])]
        .reverse()
        .find(
          (q) =>
            callers.includes(q.playerId) &&
            q.step === d.step &&
            q.until > this.time,
        )?.rune;
    }
    /** A solved dream ends the Twin Dream run. */
    protected override enterPad(
      owner: string,
      at: { x: number; y: number },
      rune: DreamRune,
    ) {
      const more = super.enterPad(owner, at, rune);
      if (!this.raid.dream) this.twinMode = false;
      return more;
    }
    /**
     * A Nightmare (chapter 2 on: combosFrom.nightmare) drops stars on whoever
     * stepped wrong, or on the Dreamer when the dream ran out.
     */
    protected override nightmare() {
      const r = this.raid;
      const who = this.wrongStep ?? r.dream?.dreamerId;
      super.nightmare();
      if (
        !this.snoozeAscendant() ||
        !this.smart() ||
        r.phase < A.combosFrom.nightmare
      )
        return;
      const target = this.heroes().find((p) => p.id === who && p.hp > 0);
      if (!target) return;
      this.chaseStars(target);
      this.snoozeReads.combos++;
    }

    // -------------------------------------------------------- Overlap
    /** Mid-dream: no new dream or tide; its stars fall from chapter 1. */
    protected override allows(kind: RaidAttack) {
      const r = this.raid;
      if (!this.snoozeAscendant() || !this.smart() || !r.dream)
        return super.allows(kind);
      if (kind === "twin-dream" || kind === "dream-tide") return false;
      if (kind === "falling-stars" && r.phase === 1)
        return !(
          r.partySize === 1 &&
          this.heroes().some((p) => p.hp > 0 && this.padAt(p.x, p.y))
        );
      return super.allows(kind);
    }
    /**
     * Is (x, y) a spot a raider can rely on? Inside the court, clear of the
     * phone's controls, outside every circle, lane and cone, off the wrong
     * pads mid-dream, and inside the awake ring while a Dream Tide rises.
     */
    protected snoozeClear(shapes: RaidWarning[], x: number, y: number) {
      if (
        x <= RULES.radius ||
        x >= W - RULES.radius ||
        y <= RULES.radius ||
        y >= H - RULES.radius ||
        underControls(x, y, 0, 0)
      )
        return false;
      const d = this.raid.dream;
      if (d) {
        const pad = this.padAt(x, y);
        if (pad && pad !== this.sequence[d.step]) return false;
      }
      for (const w of shapes) {
        if (w.kind === "dream-tide") {
          const rune = this.tideRunes.get(w.id);
          const pad = this.pads().find((p) => p.rune === rune);
          if (pad && Math.hypot(x - pad.x, y - pad.y) > w.radius - RULES.radius)
            return false;
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
     * (slowest champion, after a 0.45 s reaction; a Dream Tide also allows
     * the Seer's call and a second reaction): see `snoozeClear`. Ring
     * attacks are jumped, so they block nothing.
     */
    override safeSpotExists(
      shapes: RaidWarning[] = this.raid.warnings,
      slack = 0,
    ) {
      if (!this.snoozeAscendant()) return super.safeSpotExists(shapes, slack);
      const live = shapes.filter(
        (w) =>
          this.harmful(w) &&
          (w.kind === "dream-tide" ||
            ["circle", "line", "cone"].includes(raidShapeOf(w.kind))),
      );
      if (!live.length) return true;
      const first = Math.min(
        ...live.map((w) =>
          w.kind === "dream-tide" ? w.at - RAID_REACTION - A.tide.call : w.at,
        ),
      );
      const reach =
        RAID_SLOWEST_SPEED *
        Math.max(0, first - this.time - RAID_REACTION - slack);
      return this.heroes()
        .filter((p) => p.hp > 0)
        .every((p) => !!this.snoozeSpotNear(live, p, reach));
    }
    /** The nearest safe spot within `reach` of `p` (see `snoozeClear`). */
    snoozeSpotNear(shapes: RaidWarning[], p: Point, reach: number) {
      if (this.snoozeClear(shapes, p.x, p.y)) return { x: p.x, y: p.y };
      for (const f of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1])
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const x = p.x + Math.cos(a) * reach * f,
            y = p.y + Math.sin(a) * reach * f;
          if (this.snoozeClear(shapes, x, y)) return { x, y };
        }
      return undefined;
    }
    /**
     * The raid's overlap spacing, then the Ascendant's safe-spot rule with a
     * little slack: else the new attack waits until the older ones landed.
     */
    protected override spaceOverlap(fresh: RaidWarning[]) {
      super.spaceOverlap(fresh);
      if (!this.snoozeAscendant()) return;
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
      }
    }
    /**
     * Extra delay so a combo of telegraph `seconds` lands at least
     * RAID_IMPACT_GAP after anything still live.
     */
    protected comboDelay(kind: RaidAttack, seconds: number) {
      const live = this.raid.warnings.filter((x) => this.harmful(x));
      if (!live.length) return 0;
      const last = Math.max(...live.map((x) => x.at));
      return Math.max(
        0,
        last + 0.5 - (this.time + this.telegraph(kind, seconds)),
      );
    }

    // ---------------------------------------------------------- Attacks
    protected override startAttack(kind: RaidAttack, target: Fighter) {
      if (!this.snoozeAscendant()) return super.startAttack(kind, target);
      const r = this.raid,
        boss = this.boss()!;
      this.noteSnoozeRead(kind, target);
      if (kind === "twin-dream" || kind === "dream-tide") {
        if (r.dream) return super.startAttack("lullaby", target);
        const seen = this.seenAttacks.get(kind) ?? 0;
        this.seenAttacks.set(kind, seen + 1);
        boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
        if (kind === "dream-tide") this.warnTide(seen < 2);
        else {
          this.twinMode = true;
          this.snoozeReads.twins++;
          this.beginDream();
        }
        return;
      }
      if (kind === "dream-sequence" && !r.dream) this.twinMode = false;
      if (kind === "falling-stars") {
        const seen = this.seenAttacks.get(kind) ?? 0;
        this.seenAttacks.set(kind, seen + 1);
        boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
        this.warnStars(target, seen < 2);
        return;
      }
      const before = new Set(r.warnings);
      super.startAttack(kind, target);
      if (kind !== "tail-splash") return;
      const lane = r.warnings.find(
        (w) => w.kind === "tail-splash" && !before.has(w),
      );
      if (!lane) return;
      lane.targetId = target.id;
      // A trunk slam on its own may be a feint (shown in full when it turns).
      const others = [...before].some((w) => this.harmful(w));
      if (this.smart() && !lane.teach && !others && this.snoozeFeintRoll()) {
        const start = lane.startedAt ?? this.time;
        this.snoozeFeints.set(this.currentCast, {
          at: start + (lane.at - start) * A.feint.turnAt,
          target: target.id,
          lane,
        });
      }
    }
    /** Is this trunk slam a feint? A seeded roll per chapter. */
    protected snoozeFeintRoll() {
      const r = this.raid;
      const chance = A.feint.chance[Math.max(0, Math.min(2, r.phase - 1))];
      return raidJitter(r.seed ^ 0x5e1f, this.attacks, 13) < chance;
    }
    /**
     * Part-way through, a feinting trunk slam's lane fades and Falling Stars
     * come down round its raider instead, shown in full from that moment
     * (the honesty rules apply to it as to any new attack).
     */
    protected turnSnoozeFeints() {
      const r = this.raid;
      for (const [cast, f] of this.snoozeFeints) {
        if (this.time < f.at) continue;
        this.snoozeFeints.delete(cast);
        const target = this.heroes().find((p) => p.id === f.target && p.hp > 0);
        const live = r.warnings.filter((w) => w !== f.lane && this.harmful(w));
        if (!r.warnings.includes(f.lane) || !target || live.length) continue;
        r.warnings = r.warnings.filter((w) => w !== f.lane);
        this.currentCast = cast;
        this.warnStars(target, false);
        this.settleWarnings();
        this.currentCast = 0;
        this.snoozeReads.feints++;
        r.message = "A feint! The trunk swings up — stars are falling.";
      }
    }
    /**
     * Falling Stars round `target`: the raid's constellation, laid (once the
     * boss trusts a raider's habit) so a star lands where they usually
     * dodge. Mid-dream no star touches a pad. Stars that would leave
     * someone no way out are dropped.
     */
    protected warnStars(target: Fighter, teach: boolean) {
      const r = this.raid;
      const n = r.trait === "starry-night" ? 7 : 5;
      const ring = 220;
      const turn = ((r.seed + this.attacks) % 6) * 0.2;
      const delay = this.telegraph("falling-stars", S.stars.delay);
      const led = this.lead(target, delay);
      const habit = this.smart() ? this.snoozeHabitOf(target.id) : undefined;
      let cx = led.x,
        cy = led.y;
      if (habit && led.x === target.x && led.y === target.y) {
        // Star 0 lands on the spot a habitual dodge leads to.
        const reach = S.stars.radius * (1 + A.habit.offset);
        cx = target.x + habit.x * reach - Math.cos(turn) * ring;
        cy = target.y + habit.y * reach - Math.sin(turn) * ring;
        this.snoozeReads.habits++;
      } else if (this.smart() && r.partySize === 1) {
        cx = led.x - Math.cos(turn) * ring;
        cy = led.y - Math.sin(turn) * ring;
      }
      cx = Math.max(320, Math.min(1280, cx));
      cy = Math.max(320, Math.min(580, cy));
      const spots: Point[] = [];
      for (let i = 0; i < n; i++) {
        const a = turn + (i / n) * Math.PI * 2;
        spots.push(
          this.offPads(cx + Math.cos(a) * ring, cy + Math.sin(a) * ring),
        );
      }
      return this.placeStars(spots, S.stars.delay, teach, false);
    }
    /**
     * A combo's stars: `A.comboStars` in a row from `target` along the way
     * they usually dodge (else the way they run, else away from the boss),
     * all marked at once. Step sideways out of the row.
     */
    protected chaseStars(target: Fighter) {
      const boss = this.boss();
      const v = Math.hypot(target.vx ?? 0, target.vy ?? 0);
      const dir =
        this.snoozeHabitOf(target.id) ??
        (v > 60
          ? { x: (target.vx ?? 0) / v, y: (target.vy ?? 0) / v }
          : boss
            ? normalize(target.x - boss.x || 1, target.y - boss.y || 0.01)
            : { x: 1, y: 0 });
      const spots: Point[] = [];
      for (let k = 0; k < A.comboStars; k++)
        spots.push(
          this.offPads(
            clampX(target.x + dir.x * k * S.stars.radius * 1.8, 80),
            clampY(target.y + dir.y * k * S.stars.radius * 1.8, 80),
          ),
        );
      const extra = this.comboDelay("falling-stars", S.stars.delay);
      return this.placeStars(spots, S.stars.delay, false, true, extra);
    }
    /** Mid-dream, a star touching a pad is pushed off it. */
    protected offPads(x: number, y: number): Point {
      if (!this.raid.dream) return { x, y };
      for (const pad of this.pads()) {
        const d = Math.hypot(x - pad.x, y - pad.y),
          keep = S.padRadius + S.stars.radius + 8;
        if (d < keep) {
          const u = normalize(x - pad.x || 1, y - pad.y);
          x = pad.x + u.x * keep;
          y = pad.y + u.y * keep;
        }
      }
      return { x, y };
    }
    protected placeStars(
      spots: Point[],
      delay: number,
      teach: boolean,
      followUp: boolean,
      extra = 0,
    ) {
      const r = this.raid;
      const out = spots.map((s) =>
        Object.assign(
          this.warn("falling-stars", s.x, s.y, s.x, s.y, S.stars.radius, delay),
          { teach, ...(followUp ? { followUp: true } : {}) },
        ),
      );
      for (const w of out) w.at += extra;
      // Keep a way out: drop stars (the last first) until one exists.
      while (out.length > 1 && !this.safeSpotExists(out)) {
        const drop = out.pop()!;
        r.warnings = r.warnings.filter((w) => w !== drop);
      }
      return out;
    }
    /**
     * Dream Tide: one pad stays awake, a secret only the Seer sees. The Seer
     * is awake, alive and, when they can be, neither the Dreamer nor the last
     * Seer. The awake pad is one every raider can reach; it lands once the
     * farthest can walk well into its ring after the vision and the call.
     */
    protected warnTide(teach: boolean) {
      const r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0);
      if (!alive.length) return undefined;
      const pads = this.pads();
      const inside = A.tide.radius - RULES.radius - 14;
      const walk = (pad: Point) =>
        Math.max(
          0,
          ...alive.map((p) => Math.hypot(p.x - pad.x, p.y - pad.y) - inside),
        );
      const near = pads.filter((pad) => walk(pad) + inside <= A.tide.maxWalk);
      const pool = near.length
        ? near
        : [...pads].sort((a, b) => walk(a) - walk(b)).slice(0, 1);
      const pad =
        pool[
          Math.floor(
            raidJitter(r.seed ^ 0x71de, this.attacks, 5) * pool.length,
          ) % pool.length
        ];
      const seer = this.pickSeer(alive);
      const w = Object.assign(
        this.warn(
          "dream-tide",
          W / 2,
          H / 2,
          W / 2,
          H / 2,
          A.tide.radius,
          tideDelay(walk(pad)),
        ),
        { targetId: seer.id, teach },
      );
      this.tideRunes.set(w.id, pad.rune);
      this.previousSeer = seer.id;
      this.snoozeReads.tides++;
      r.message = `Dream Tide! Only ${seer.name} sees the pad that stays awake. Listen for the call!`;
      return w;
    }
    protected pickSeer(alive: Fighter[]) {
      const r = this.raid;
      const awake = alive.filter(
        (p) =>
          (r.drowsy?.[p.id]?.sleepUntil ?? 0) <= this.time &&
          !this.has(p, "sleep"),
      );
      const pool = awake.length ? awake : alive;
      const fresh = pool.filter(
        (p) => p.id !== this.previousSeer && p.id !== this.previousDreamer,
      );
      const from = fresh.length ? fresh : pool;
      const pick = new Uint32Array(1);
      crypto.getRandomValues(pick);
      return from[pick[0] % from.length];
    }

    protected override resolveWarning(w: RaidWarning, boss: Fighter) {
      if (!this.snoozeAscendant()) return super.resolveWarning(w, boss);
      const r = this.raid;
      if (w.kind === "dream-tide") {
        const rune = this.tideRunes.get(w.id);
        this.tideRunes.delete(w.id);
        this.tideCalled.delete(w.id);
        const pad = this.pads().find((p) => p.rune === rune);
        if (!pad) return;
        this.hitBy = "dream-tide";
        for (const p of this.heroes())
          if (p.hp > 0 && Math.hypot(p.x - pad.x, p.y - pad.y) > w.radius) {
            this.damage(p, A.tide.damage, boss.id);
            this.addDrowsy(p);
          }
        this.hitBy = undefined;
        // The awake pad, for everyone: a pale flash at its centre.
        this.event("heal", pad, TIDE_AWAKE, 0, boss.id);
        this.event(
          "raid-impact",
          { x: W / 2, y: H / 2 },
          0x6c4fb8,
          undefined,
          boss.id,
        );
        this.events[this.events.length - 1].raidRadius = 0;
        r.message = `The Dream Tide ebbs. The ${rune ? rune[0].toUpperCase() + rune.slice(1) : ""} pad stayed awake.`;
        // Chapter 2 on: lullabies ring out from the awake pad.
        if (r.phase >= A.combosFrom.tide && this.smart()) {
          const ring = Object.assign(
            this.warn(
              "lullaby",
              pad.x,
              pad.y,
              pad.x,
              pad.y,
              85,
              S.lullaby.delay,
            ),
            { followUp: true },
          );
          ring.at += this.comboDelay("lullaby", S.lullaby.delay);
          this.nextAttack = Math.max(this.nextAttack, ring.at + 1.2);
          this.snoozeReads.combos++;
          r.message = "The awake pad rings out! Jump the lullabies.";
        }
        return;
      }
      super.resolveWarning(w, boss);
      if (
        w.kind !== "tail-splash" ||
        !this.smart() ||
        r.exposedUntil > this.time
      )
        return;
      // A trunk slam that misses calls stars down on its raider.
      const cast = this.currentCast;
      const target = this.heroes().find((p) => p.id === w.targetId && p.hp > 0);
      if (
        !target ||
        w.followUp ||
        r.phase < A.combosFrom.tail ||
        (cast && this.snoozeCombos.has(cast)) ||
        segment(target, w, { x: w.tx, y: w.ty }) < w.radius + RULES.radius
      )
        return;
      if (this.snoozeCombos.size > 64) this.snoozeCombos.clear();
      if (cast) this.snoozeCombos.add(cast);
      this.chaseStars(target);
      this.snoozeReads.combos++;
    }

    // -------------------------------------------------------- Each tick
    protected override attacksStep(dt: number) {
      if (!this.snoozeAscendant()) return super.attacksStep(dt);
      const r = this.raid;
      const staggered = r.staggerUntil;
      this.turnSnoozeFeints();
      super.attacksStep(dt);
      // A stagger that started this step: a shorter window (the tier's windows).
      if (r.staggerUntil > staggered && this.smart()) {
        r.staggerUntil = this.time + this.window(RAID.staggerSeconds);
        r.exposedUntil = Math.max(r.exposedUntil, r.staggerUntil);
        this.nextAttack = r.staggerUntil + 0.4;
      }
      if (r.staggerUntil > this.time) this.snoozeFeints.clear();
      this.learnSnoozeDodges();
    }
    /**
     * A Twin Dream whose second Dreamer falls is the first's alone (they see
     * it all); a Dream Tide whose Seer falls asleep or down before calling
     * passes the vision on, and waits for the new Seer.
     */
    protected override worldStep(dt: number, boss: Fighter) {
      if (this.snoozeAscendant()) {
        const r = this.raid,
          d = r.dream;
        // Its shorter opening brings the woken thrash sooner: it still lands
        // the jump cooldown away from a lullaby already wound up.
        if (this.time >= this.thrashAt) {
          const gap = RULES.jumpCooldown + 0.3;
          const lands = this.time + S.lullaby.delay;
          const clash = r.warnings.find(
            (w) =>
              RAID_JUMP_ATTACKS.has(w.kind) && Math.abs(w.at - lands) < gap,
          );
          if (clash) this.thrashAt = clash.at + gap - S.lullaby.delay;
        }
        if (
          d?.partnerId &&
          !this.heroes().some((p) => p.id === d.partnerId && p.hp > 0)
        )
          d.partnerId = undefined;
        const tide = this.liveTide();
        const seer = tide && this.heroes().find((p) => p.id === tide.targetId);
        const called = (r.runeCalls ?? []).some(
          (q) => q.step === -1 && q.playerId === tide?.targetId,
        );
        if (
          tide &&
          !called &&
          (!seer || seer.hp <= 0 || this.has(seer, "sleep"))
        ) {
          const alive = this.heroes().filter((p) => p.hp > 0);
          if (alive.length) {
            const next = this.pickSeer(alive);
            tide.targetId = next.id;
            const rune = this.tideRunes.get(tide.id);
            const pad = this.pads().find((p) => p.rune === rune)!;
            const inside = A.tide.radius - RULES.radius - 14;
            const walk = Math.max(
              0,
              ...alive.map(
                (p) => Math.hypot(p.x - pad.x, p.y - pad.y) - inside,
              ),
            );
            tide.at = Math.max(tide.at, this.time + tideDelay(walk));
            r.message = `The vision passes to ${next.name}. Listen for the call!`;
          }
        }
      }
      super.worldStep(dt, boss);
    }

    // -------------------------------------------------------- Habit aim
    /** Where each raider went from inside a fresh warning, by the time it landed. */
    protected learnSnoozeDodges() {
      const r = this.raid;
      const alive = this.heroes().filter((p) => p.hp > 0);
      for (const w of r.warnings) {
        if (this.snoozeWatched.has(w)) continue;
        this.snoozeWatched.add(w);
        if (
          !this.harmful(w) ||
          !["circle", "line", "cone"].includes(raidShapeOf(w.kind))
        )
          continue;
        const inside = new Map<string, Point>();
        for (const p of alive)
          if (raidShapeHits(w, p.x, p.y, RULES.radius))
            inside.set(p.id, { x: p.x, y: p.y });
        if (inside.size) this.snoozeDodging.set(w, inside);
      }
      for (const [w, from] of this.snoozeDodging) {
        if (r.warnings.includes(w)) continue;
        this.snoozeDodging.delete(w);
        for (const [id, start] of from) {
          const p = alive.find((q) => q.id === id);
          if (!p) continue;
          const dx = p.x - start.x,
            dy = p.y - start.y;
          if (Math.hypot(dx, dy) >= 30) this.noteSnoozeDodge(id, dx, dy);
        }
      }
    }
    /** Remember one dodge of raider `id` (also used by tests). */
    noteSnoozeDodge(id: string, dx: number, dy: number) {
      const len = Math.hypot(dx, dy) || 1;
      const h = this.snoozeHabits.get(id) ?? { x: 0, y: 0, weight: 0, n: 0 };
      h.x = h.x * 0.6 + dx / len;
      h.y = h.y * 0.6 + dy / len;
      h.weight = h.weight * 0.6 + 1;
      h.n++;
      this.snoozeHabits.set(id, h);
    }
    /** The direction a raider usually dodges, once the boss trusts it. */
    snoozeHabitOf(id: string): Point | undefined {
      const h = this.snoozeHabits.get(id);
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
      ability?: Parameters<SomnaraArena["damage"]>[3],
    ) {
      super.damage(target, amount, owner, ability);
      if (target.raidBoss && owner !== target.id && this.snoozeAscendant())
        this.snoozeHitAt.set(owner, this.time);
    }
    protected override trackMotion() {
      super.trackMotion();
      if (!this.snoozeAscendant()) return;
      for (const p of this.heroes()) {
        const still =
          p.hp > 0 && Math.hypot(p.vx ?? 0, p.vy ?? 0) < A.anchor.speed;
        if (!still) this.snoozeStill.delete(p.id);
        else if (!this.snoozeStill.has(p.id))
          this.snoozeStill.set(p.id, this.time);
      }
    }
    /** Standing still while hitting the boss (for the anchor read). */
    snoozeAnchored(p: Fighter) {
      const since = this.snoozeStill.get(p.id);
      return (
        since !== undefined &&
        this.time - since >= A.anchor.still &&
        this.time - (this.snoozeHitAt.get(p.id) ?? -99) <= A.anchor.hit
      );
    }
    protected snoozeReviving(p: Fighter) {
      return this.heroes().some(
        (d) =>
          d.hp <= 0 &&
          !this.raid.downed[d.id]?.self &&
          Math.hypot(d.x - p.x, d.y - p.y) <= RAID.reviveRange,
      );
    }
    protected noteSnoozeRead(kind: RaidAttack, target: Fighter) {
      if (!this.smart() || (kind !== "falling-stars" && kind !== "tail-splash"))
        return;
      if (this.snoozeReviving(target)) this.snoozeReads.revivers++;
      else if (kind === "falling-stars" && this.snoozeAnchored(target))
        this.snoozeReads.anchors++;
    }
    /** Stars for a raider standing still to attack, or kneeling to revive. */
    protected override reactions(s: RaidSituation): RaidReaction[] {
      const out = super.reactions(s);
      if (!this.snoozeAscendant()) return out;
      for (const p of s.alive)
        if (this.snoozeAnchored(p))
          out.push({ kind: "falling-stars", score: 1.5, target: p });
      for (const p of s.reviving)
        out.push({ kind: "falling-stars", score: 1.6, target: p });
      return out;
    }
    /** The raider kneeling by a fallen ally comes first (stars, slams). */
    protected override chooseTarget(kind: RaidAttack, alive: Fighter[]) {
      if (
        this.snoozeAscendant() &&
        this.smart() &&
        alive.length > 1 &&
        (kind === "falling-stars" || kind === "tail-splash")
      ) {
        const reviver = alive
          .filter((p) => this.snoozeReviving(p))
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
     * Through a Dream Tide stand-ins wait near the middle until the Seer's
     * call reaches them (a reaction after it), then run onto that pad; the
     * Seer goes where its vision says.
     */
    protected override botHint(
      bot: Fighter,
      input: Input,
      go: (x: number, y: number, away: boolean) => Input,
    ): Input | undefined {
      const tide = this.snoozeAscendant() ? this.liveTide() : undefined;
      if (!tide || this.raid.dream) return super.botHint(bot, input, go);
      input.basic = false;
      input.skill = -1;
      const view = this.dreamFor(bot.id);
      const heard = [...(this.raid.runeCalls ?? [])]
        .reverse()
        .find(
          (q) =>
            q.step === -1 &&
            q.playerId === tide.targetId &&
            this.time >= this.callHeardAt(q.id),
        );
      const rune = view?.tide ? view.runes[0] : heard?.rune;
      const pad = rune && this.pads().find((p) => p.rune === rune);
      if (!pad) {
        input.dx = input.dy = 0;
        return input;
      }
      if (
        Math.hypot(bot.x - pad.x, bot.y - pad.y) <
        tide.radius - RULES.radius - 20
      ) {
        input.dx = input.dy = 0;
        return input;
      }
      return go(pad.x, pad.y, false);
    }
    /** When a stand-in hears a call: a reaction after it was made. */
    protected callSeen = new Map<number, number>();
    protected callHeardAt(id: number) {
      let at = this.callSeen.get(id);
      if (at === undefined) {
        at = this.time + RAID_REACTION;
        this.callSeen.set(id, at);
        if (this.callSeen.size > 64)
          this.callSeen.delete(this.callSeen.keys().next().value!);
      }
      return at;
    }
  };
}

export class AscendantSnoozakuArena extends AscendantSnoozakuRules(
  SomnaraArena,
) {
  constructor(code: string) {
    super(code, "somnara");
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
      r.maxHp = Math.round(r.maxHp / S.health.gilded);
      r.gilded = false;
    }
    const boss = this.boss();
    if (boss) Object.assign(boss, { hp: r.maxHp, name: A.name });
    this.resetSnoozeReads();
    r.message = `${RAID_TRAITS[r.trait].name} ${A.name} · ${RAID_TRAITS[r.trait].text}`;
  }

  protected override finishMessage(won: boolean): string {
    return won
      ? "Snoozaku wakes at last. The Spire's dreams are clear."
      : "Ascendant Snoozaku dreams on. Call clearly and climb again.";
  }
}
