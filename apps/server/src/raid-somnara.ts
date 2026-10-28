import {
  CHARACTERS,
  RULES,
  normalize,
  type Ability,
  type Fighter,
  type Input,
} from "../../../packages/shared/src/index.js";
import {
  DREAM_RUNES,
  DREAM_RUNE_NAMES,
  SOMNARA,
  quietZoneAt,
  somnaraPattern,
  somnaraSequenceLength,
  type DreamRune,
  type RaidAttack,
  type RaidDreamView,
  type RaidWarning,
} from "../../../packages/shared/src/raid.js";
import { RaidArena, type RaidBossNumbers } from "./raid.js";
const S = SOMNARA;
const distanceToSegment = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) => {
  const dx = bx - ax,
    dy = by - ay;
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)),
  );
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
};

/** Somnara's secret sequence never enters RaidState, snapshots or public events. */
export class SomnaraArena extends RaidArena {
  private sequence: DreamRune[] = [];
  private sharedUntil = 0;
  private nextStepAt = 0;
  private previousDreamer = "";
  private occupied = new Map<string, DreamRune | undefined>();
  private ringHits = new Map<number, Set<string>>();
  private runeCallAt = new Map<string, number>();
  private trailAt = new Map<string, number>();
  private songHits = new Set<string>();

  protected override def(): RaidBossNumbers {
    return S;
  }
  protected override bossHome() {
    return { ...S.home };
  }
  protected override pattern() {
    return somnaraPattern(this.raid.phase);
  }
  protected override alwaysExposed() {
    return false;
  }
  override walls() {
    return [];
  }
  protected override setupArena() {
    this.arenaId = "cloud-deck";
    Object.assign(this.raid, {
      pillars: [],
      dream: undefined,
      dreamRings: [],
      dreamBubbles: [],
      quietZone: undefined,
      drowsy: {},
      runeCalls: [],
      dreamTrails: [],
      dreamsSolved: 0,
      dreamMistakes: 0,
    });
    this.sequence = [];
    this.songHits.clear();
    this.previousDreamer = "";
    this.sharedUntil = this.nextStepAt = 0;
    this.occupied.clear();
    this.ringHits.clear();
    this.runeCallAt.clear();
    this.trailAt.clear();
  }
  protected override clearAttacks() {
    super.clearAttacks();
    Object.assign(this.raid, {
      dream: undefined,
      dreamRings: [],
      dreamBubbles: [],
      quietZone: undefined,
      runeCalls: [],
      dreamTrails: [],
      drowsy: {},
    });
    this.sequence = [];
    this.songHits.clear();
    this.sharedUntil = 0;
    this.occupied.clear();
    this.ringHits.clear();
    for (const p of this.heroes())
      p.statuses = p.statuses.filter(
        (s) =>
          !(
            s.by === this.raid.bossId &&
            (s.kind === "sleep" || s.kind === "drowsy")
          ),
      );
  }
  protected override onChapter() {
    this.clearAttacks();
  }
  protected override finishMessage(won: boolean) {
    return won
      ? "Somnara wakes! A little house lights up among the stars."
      : "The dream drifts on. Listen for the runes and try again.";
  }
  override feat() {
    return (
      this.raid.result === "victory" &&
      (this.raid.dreamsSolved ?? 0) > 0 &&
      (this.raid.dreamMistakes ?? 0) === 0
    );
  }
  private padAt(x: number, y: number) {
    return S.pads.find((p) => Math.hypot(p.x - x, p.y - y) <= S.padRadius)
      ?.rune;
  }
  private bodies() {
    return this.heroes()
      .filter((p) => p.hp > 0)
      .flatMap((p) => [
        {
          id: p.id,
          owner: p.id,
          x: p.x,
          y: p.y,
          sleeping: this.has(p, "sleep"),
        },
        ...(p.clone && p.clone.until > this.time
          ? [
              {
                id: `${p.id}:clone`,
                owner: p.id,
                x: p.clone.x,
                y: p.clone.y,
                sleeping: false,
              },
            ]
          : []),
      ]);
  }
  private beginDream() {
    this.struck.clear();
    const alive = this.heroes().filter((p) => p.hp > 0);
    if (!alive.length) return;
    const candidates = alive.filter((p) => p.id !== this.previousDreamer);
    const pool = candidates.length ? candidates : alive;
    const random = new Uint32Array(2);
    crypto.getRandomValues(random);
    const dreamer = pool[random[0] % pool.length];
    const r = this.raid;
    const length = somnaraSequenceLength(
      r.phase,
      r.peril,
      r.partySize,
      r.trait,
    );
    this.sequence = [];
    for (let i = 0; i < length; i++) {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      const choices = DREAM_RUNES.filter(
        (rune) => rune !== this.sequence[i - 1],
      );
      this.sequence.push(choices[values[0] % choices.length]);
    }
    this.previousDreamer = dreamer.id;
    this.sharedUntil = 0;
    r.dream = {
      id: ++this.serial,
      dreamerId: dreamer.id,
      step: 0,
      length,
      startedAt: this.time,
      until:
        this.time +
        (r.partySize === 1 ? S.sequence.soloSeconds : S.sequence.seconds),
      backwards: r.phase >= 3 && r.peril >= 3 && (random[1] & 1) === 1,
    };
    r.runeCalls = [];
    this.nextStepAt = this.time + S.sequence.stepGap;
    this.occupied = new Map(
      this.bodies().map((p) => [p.id, this.padAt(p.x, p.y)]),
    );
    r.message = `${dreamer.name} is the Dreamer. Call the runes, then enter their pads in order!`;
  }
  /** Full sequence for the Dreamer/reveal, first rune only for Lucid teammates. */
  override dreamFor(id: string): RaidDreamView | undefined {
    const r = this.raid,
      d = r.dream;
    const p = this.heroes().find((p) => p.id === id && p.hp > 0);
    if (!d || !p || this.phase !== "playing") return;
    const full = d.dreamerId === id || this.sharedUntil > this.time;
    if (!full && !this.hasRite(p, "lucid")) return;
    const runes = full
      ? d.backwards
        ? [...this.sequence].reverse()
        : [...this.sequence]
      : this.sequence.slice(0, 1);
    return { id: d.id, runes, full, backwards: full && d.backwards };
  }
  override callRune(id: string, rune: DreamRune) {
    const r = this.raid,
      p = this.heroes().find((p) => p.id === id && p.hp > 0);
    if (
      this.phase !== "playing" ||
      !r.dream ||
      r.dream.dreamerId !== id ||
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
      step: r.dream.step,
      until: this.time + 3.5,
    });
    return true;
  }
  private nightmare() {
    const r = this.raid,
      boss = this.boss();
    if (!boss) return;
    r.dreamMistakes = (r.dreamMistakes ?? 0) + 1;
    this.hitBy = "nightmare";
    for (const p of this.heroes())
      if (p.hp > 0) this.damage(p, S.sequence.nightmare, boss.id);
    this.hitBy = undefined;
    this.event("raid-impact", boss, 0xc090ff, undefined, boss.id);
    this.events[this.events.length - 1].raidRadius = 500;
    this.beginDream();
    r.message = `Nightmare! New dream — ${this.heroes().find((p) => p.id === r.dream?.dreamerId)?.name ?? "the Dreamer"} calls this time.`;
  }
  private stepDream() {
    const r = this.raid,
      d = r.dream;
    if (!d) return;
    if (!this.heroes().some((p) => p.id === d.dreamerId && p.hp > 0)) {
      this.beginDream();
      return;
    }
    if (this.time >= d.until) {
      this.nightmare();
      return;
    }
    const bodies = this.bodies();
    const entered = bodies.filter((p) => {
      const rune = this.padAt(p.x, p.y),
        before = this.occupied.get(p.id);
      this.occupied.set(p.id, rune);
      return rune !== undefined && rune !== before && !p.sleeping;
    });
    for (const p of entered) {
      if (this.time < this.nextStepAt || r.dream !== d) break;
      const rune = this.padAt(p.x, p.y)!;
      if (rune !== this.sequence[d.step]) {
        this.nightmare();
        break;
      }
      d.step++;
      this.nextStepAt = this.time + S.sequence.stepGap;
      if (!r.drill && r.contributions?.[p.owner])
        r.contributions[p.owner].pillars++;
      this.event("heal", p, 0x99efdd, 0, p.owner);
      if (d.step === d.length) {
        r.dreamsSolved = (r.dreamsSolved ?? 0) + 1;
        r.dream = undefined;
        this.sequence = [];
        this.sharedUntil = 0;
        r.exposedUntil =
          this.time + S.sequence.expose + (r.trait === "deep-slumber" ? 2 : 0);
        r.message = "Dream solved! Somnara wakes — strike the shining heart!";
        this.nextAttack = Math.max(this.nextAttack, r.exposedUntil + 0.8);
        this.countDodges();
      }
    }
  }
  private addDrowsy(p: Fighter, bubble = false) {
    if (p.hp <= 0 || (bubble && this.hasRite(p, "lucid"))) return;
    const d = ((this.raid.drowsy ??= {})[p.id] ??= {
      stacks: 0,
      sleepUntil: 0,
    });
    if (d.sleepUntil > this.time) return;
    d.stacks++;
    this.status(p, "drowsy", S.drowsy.seconds, this.raid.bossId);
    if (d.stacks >= S.drowsy.stacks) {
      d.stacks = 0;
      d.sleepUntil = this.time + S.drowsy.sleep;
      p.statuses = p.statuses.filter((s) => s.kind !== "drowsy");
      // Keep Somnara's imposed sleep separate from Terradon's Hibernate.
      p.statuses.push({
        kind: "sleep",
        until: d.sleepUntil,
        nextTick: d.sleepUntil,
        by: this.raid.bossId,
      });
      this.raid.message = `${p.name} is asleep! Tap them awake with an attack.`;
    }
  }
  private wake(p: Fighter) {
    const d = this.raid.drowsy?.[p.id];
    if (!d || d.sleepUntil <= this.time) return;
    d.sleepUntil = 0;
    p.statuses = p.statuses.filter(
      (s) => !(s.kind === "sleep" && s.by === this.raid.bossId),
    );
    this.event("heal", p, 0xb7edff, 0, p.id);
  }
  override damage(
    target: Fighter,
    amount: number,
    owner: string,
    ability?: Ability,
  ) {
    const source = this.heroes().find((p) => p.id === owner);
    if (
      target.hp > 0 &&
      !target.raidBoss &&
      amount > 0 &&
      this.phase === "playing" &&
      !(ability?.ground && target.jumpUntil > this.time)
    )
      this.wake(target);
    if (source && source !== target && !target.raidBoss) return;
    super.damage(target, amount, owner, ability);
  }
  protected override canStartAttack() {
    return (
      this.raid.exposedUntil <= this.time &&
      (!this.raid.dream || this.raid.phase >= 3)
    );
  }
  protected override startAttack(kind: RaidAttack, target: Fighter): void {
    const boss = this.boss()!,
      r = this.raid;
    const seen = this.seenAttacks.get(kind) ?? 0;
    this.seenAttacks.set(kind, seen + 1);
    const teach = seen < 2;
    boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
    if (kind === "dream-sequence") {
      if (r.dream) return this.startAttack("lullaby", target);
      this.beginDream();
      return;
    }
    if (kind === "lullaby")
      this.warn(
        kind,
        boss.x,
        boss.y,
        boss.x,
        boss.y,
        85,
        S.lullaby.delay,
      ).teach = teach;
    else if (kind === "tail-splash") {
      const dir = normalize(target.x - boss.x || 1, target.y - boss.y);
      Object.assign(
        this.warn(
          kind,
          boss.x,
          boss.y,
          boss.x + dir.x * S.tail.length,
          boss.y + dir.y * S.tail.length,
          S.tail.width / 2,
          S.tail.delay,
        ),
        { width: S.tail.width, teach },
      );
    } else if (kind === "dream-bubbles")
      this.warn(
        kind,
        boss.x,
        boss.y,
        target.x,
        target.y,
        90,
        S.bubbles.delay,
      ).teach = teach;
    else if (kind === "falling-stars") {
      const n = r.trait === "starry-night" ? 7 : 5;
      // Move the constellation's centre in from edges; clamping each star
      // separately would pile several hits onto one indistinguishable marker.
      const cx = Math.max(320, Math.min(1280, target.x));
      const cy = Math.max(320, Math.min(580, target.y));
      for (let i = 0; i < n; i++) {
        const angle =
          (i / n) * Math.PI * 2 + ((r.seed + this.attacks) % 6) * 0.2;
        const x = cx + Math.cos(angle) * 220,
          y = cy + Math.sin(angle) * 220;
        this.warn(kind, x, y, x, y, S.stars.radius, S.stars.delay).teach =
          teach;
      }
    } else if (kind === "whale-song") {
      this.songHits.clear();
      this.struck.clear();
      const radius =
        S.song.radius[Math.min(3, Math.max(1, r.peril))] +
        (r.trait === "starry-night" ? 35 : 0);
      // Start close enough that the slowest fighter can reach it in four seconds.
      const x = Math.max(250, Math.min(1250, target.x)),
        y = Math.max(200, Math.min(700, target.y));
      r.quietZone = {
        x,
        y,
        radius,
        startedAt: this.time,
        until: this.time + S.song.seconds,
      };
      this.warn(kind, x, y, x, y, radius, S.song.seconds).teach = teach;
    } else if (kind === "nightmare") this.nightmare();
  }
  protected override resolveWarning(w: RaidWarning, boss: Fighter) {
    const r = this.raid;
    if (w.kind === "whale-song") {
      this.struck = new Set(this.songHits);
      this.countDodges();
      this.songHits.clear();
      r.quietZone = undefined;
      return;
    }
    if (w.kind === "lullaby") {
      for (let i = 0; i < S.lullaby.count; i++)
        (r.dreamRings ??= []).push({
          id: ++this.serial,
          x: w.x,
          y: w.y,
          radius: 0,
          startedAt: this.time + i * S.lullaby.gap,
        });
    } else if (w.kind === "dream-bubbles") {
      const n =
        r.trait === "restless-dream" ? S.bubbles.count + 2 : S.bubbles.count;
      for (let i = 0; i < n; i++) {
        const angle = (i * Math.PI * 2) / n;
        (r.dreamBubbles ??= []).push({
          id: ++this.serial,
          x: boss.x + Math.cos(angle) * 110,
          y: boss.y + Math.sin(angle) * 85,
          until: this.time + S.bubbles.seconds,
        });
      }
    } else if (w.kind === "tail-splash" || w.kind === "falling-stars") {
      this.hitBy = w.kind;
      for (const p of this.heroes()) {
        if (p.hp <= 0) continue;
        const hit =
          w.kind === "tail-splash"
            ? distanceToSegment(p.x, p.y, w.x, w.y, w.tx, w.ty) <
              w.radius + RULES.radius
            : Math.hypot(p.x - w.x, p.y - w.y) < w.radius + RULES.radius;
        if (hit)
          this.damage(
            p,
            w.kind === "tail-splash" ? S.tail.damage : S.stars.damage,
            boss.id,
          );
      }
      this.hitBy = undefined;
      this.countDodges();
      this.event(
        "raid-impact",
        { x: w.x, y: w.y },
        0xc9a3ff,
        undefined,
        boss.id,
      );
      this.events[this.events.length - 1].raidRadius = w.radius;
    }
  }
  protected override bossStep(dt: number, boss: Fighter) {
    if (
      this.raid.dream ||
      this.raid.exposedUntil > this.time ||
      this.raid.quietZone
    )
      return;
    const tx = S.home.x + Math.sin(this.phaseElapsed * 0.2) * 100,
      ty = S.home.y + Math.sin(this.phaseElapsed * 0.3) * 60;
    const d = normalize(tx - boss.x, ty - boss.y),
      amount = Math.min(Math.hypot(tx - boss.x, ty - boss.y), 45 * dt);
    boss.x += d.x * amount;
    boss.y += d.y * amount;
  }
  protected override worldStep(dt: number, boss: Fighter) {
    const r = this.raid;
    this.stepDream();
    if (r.quietZone) {
      const q = quietZoneAt(r.quietZone, this.time);
      this.hitBy = "whale-song";
      for (const p of this.heroes())
        if (p.hp > 0 && Math.hypot(p.x - q.x, p.y - q.y) > r.quietZone.radius) {
          this.songHits.add(p.id);
          this.damage(p, (S.song.damage / S.song.seconds) * dt, boss.id);
        }
      this.hitBy = undefined;
      if (this.time >= r.quietZone.until) r.quietZone = undefined;
    }
    for (const [id, d] of Object.entries(r.drowsy ?? {})) {
      const p = this.heroes().find((p) => p.id === id && p.hp > 0);
      if (!p || (d.sleepUntil <= this.time && !this.has(p, "drowsy")))
        delete r.drowsy![id];
    }
    r.runeCalls = (r.runeCalls ?? []).filter((q) => q.until > this.time);
    r.dreamTrails = (r.dreamTrails ?? []).filter((q) => q.until > this.time);
    for (const p of this.heroes())
      if (
        p.hp > 0 &&
        p.character === "duskveil" &&
        this.has(p, "stealth") &&
        this.time >= (this.trailAt.get(p.id) ?? 0)
      ) {
        this.trailAt.set(p.id, this.time + 0.18);
        r.dreamTrails.push({ x: p.x, y: p.y, until: this.time + 3 });
      }
    for (const ring of r.dreamRings ?? []) {
      if (this.time < ring.startedAt) continue;
      const before = ring.radius;
      ring.radius = Math.min(
        S.lullaby.radius + 50,
        (this.time - ring.startedAt) * S.lullaby.speed,
      );
      const hit = this.ringHits.get(ring.id) ?? new Set<string>();
      this.ringHits.set(ring.id, hit);
      for (const p of this.heroes()) {
        const dist = Math.hypot(p.x - ring.x, p.y - ring.y);
        if (
          p.hp <= 0 ||
          hit.has(p.id) ||
          dist < before - S.lullaby.width ||
          dist > ring.radius + S.lullaby.width + RULES.radius
        )
          continue;
        hit.add(p.id);
        if (p.jumpUntil > this.time) continue;
        this.hitBy = "lullaby";
        this.damage(p, S.lullaby.damage, boss.id);
        this.hitBy = undefined;
        this.addDrowsy(p);
      }
    }
    r.dreamRings = (r.dreamRings ?? []).filter(
      (q) => q.radius <= S.lullaby.radius,
    );
    for (const id of this.ringHits.keys())
      if (!r.dreamRings.some((q) => q.id === id)) this.ringHits.delete(id);
    const channels = this.heroes().filter(
      (p) =>
        p.hp > 0 &&
        p.channel &&
        p.channel.until > this.time &&
        this.kit(p).skills[p.channel.skill]?.id === "ember-gust",
    );
    const inGust = (p: Fighter, x: number, y: number) => {
      const a = this.kit(p).skills[p.channel!.skill];
      return (
        Math.hypot(x - p.x, y - p.y) < a.range + RULES.radius &&
        Math.cos(Math.atan2(y - p.y, x - p.x) - p.angle) > (a.arc ?? 0.35)
      );
    };
    const spent = new Set<number>();
    const hits = (x: number, y: number, radius: number, except?: string) =>
      this.projectiles.find(
        (pr) =>
          pr.owner !== boss.id &&
          pr.owner !== except &&
          !spent.has(pr.id) &&
          distanceToSegment(
            x,
            y,
            pr.x,
            pr.y,
            pr.x + pr.vx * dt,
            pr.y + pr.vy * dt,
          ) <
            radius + (pr.ability.radius ?? 10),
      );
    for (const p of this.heroes())
      if ((r.drowsy?.[p.id]?.sleepUntil ?? 0) > this.time) {
        const shot = hits(p.x, p.y, RULES.radius, p.id);
        if (
          shot ||
          channels.some((q) => q !== p && inGust(q, p.x, p.y)) ||
          this.zones.some(
            (z) =>
              z.owner !== boss.id &&
              z.owner !== p.id &&
              Math.hypot(z.x - p.x, z.y - p.y) < z.radius + RULES.radius,
          )
        )
          this.wake(p);
      }
    r.dreamBubbles = (r.dreamBubbles ?? []).filter((b) => {
      if (b.until <= this.time) return false;
      const shot = hits(b.x, b.y, S.bubbles.radius);
      if (shot) {
        spent.add(shot.id);
        return false;
      }
      if (
        channels.some((p) => inGust(p, b.x, b.y)) ||
        this.zones.some(
          (z) =>
            z.owner !== boss.id &&
            Math.hypot(z.x - b.x, z.y - b.y) < z.radius + S.bubbles.radius,
        ) ||
        r.dreamTrails!.some(
          (t) => Math.hypot(t.x - b.x, t.y - b.y) < 45 + S.bubbles.radius,
        )
      )
        return false;
      const target = this.heroes()
        .filter((p) => p.hp > 0)
        .sort(
          (a, c) =>
            Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y),
        )[0];
      if (!target) return true;
      const d = normalize(target.x - b.x, target.y - b.y);
      b.x += d.x * S.bubbles.speed * dt;
      b.y += d.y * S.bubbles.speed * dt;
      if (
        Math.hypot(target.x - b.x, target.y - b.y) <=
        S.bubbles.radius + RULES.radius
      ) {
        this.addDrowsy(target, true);
        return false;
      }
      return true;
    });
    this.projectiles = this.projectiles.filter((pr) => !spent.has(pr.id));
    const d = r.dream;
    if (
      d &&
      this.bots.has(d.dreamerId) &&
      this.time >= (this.runeCallAt.get(d.dreamerId) ?? 0)
    )
      this.callRune(d.dreamerId, this.sequence[d.step]);
  }
  override cast(p: Fighter, a: Ability, ex = false) {
    super.cast(p, a, ex);
    if (p.raidBoss) return;
    const affected = (x: number, y: number) =>
      a.kind === "melee" || a.kind === "cone" || a.kind === "beam"
        ? Math.hypot(x - p.x, y - p.y) < a.range + RULES.radius &&
          Math.cos(Math.atan2(y - p.y, x - p.x) - p.angle) > (a.arc ?? 0.35)
        : a.kind === "nova" &&
          Math.hypot(x - p.x, y - p.y) < a.radius + RULES.radius;
    if (["melee", "cone", "beam", "nova"].includes(a.kind)) {
      for (const ally of this.heroes())
        if (ally !== p && affected(ally.x, ally.y)) this.wake(ally);
      this.raid.dreamBubbles = (this.raid.dreamBubbles ?? []).filter(
        (b) => !affected(b.x, b.y),
      );
    }
    if (a.id === "thoughtstrike" && this.raid.dream) {
      this.sharedUntil = this.raid.dream.until;
      this.raid.message = `${p.name}'s Thoughtstrike reveals this dream to the whole team!`;
    }
  }
  protected override botHint(
    bot: Fighter,
    input: Input,
    go: (x: number, y: number, away: boolean) => Input,
  ) {
    const r = this.raid;
    if (r.quietZone) {
      const q = quietZoneAt(r.quietZone, this.time);
      if (Math.hypot(bot.x - q.x, bot.y - q.y) > r.quietZone.radius * 0.6)
        return go(q.x, q.y, false);
    }
    const d = r.dream;
    if (d) {
      input.basic = false;
      input.skill = -1;
      input.dash = false;
      // Stand-ins only solve information they could receive as a player, or a
      // rune the Dreamer actually called. Never peek at the server's secret.
      const view = this.dreamFor(bot.id);
      const called = [...(r.runeCalls ?? [])]
        .reverse()
        .find(
          (q) =>
            q.playerId === d.dreamerId &&
            q.step === d.step &&
            q.until > this.time,
        );
      const rune = view?.full
        ? (view.backwards ? [...view.runes].reverse() : view.runes)[d.step]
        : called?.rune;
      const runner = this.bots.has(d.dreamerId)
        ? d.dreamerId
        : this.heroes().find((p) => p.hp > 0 && this.bots.has(p.id))?.id;
      if (rune && runner === bot.id) {
        const pad = S.pads.find((p) => p.rune === rune)!;
        if (this.padAt(bot.x, bot.y) === rune)
          return go(pad.x + 95, pad.y, false);
        // A direct line from the left spawn to the Star pad crosses Circle.
        // Route through the centre instead of stepping a wrong rune en route.
        const blocked = S.pads.some(
          (q) =>
            q.rune !== rune &&
            Math.hypot(q.x - bot.x, q.y - bot.y) > S.padRadius + 15 &&
            distanceToSegment(q.x, q.y, bot.x, bot.y, pad.x, pad.y) <
              S.padRadius + 15,
        );
        const destination = blocked ? { x: 800, y: 450 } : pad;
        input.aimX = destination.x;
        input.aimY = destination.y;
        input.dash =
          Math.hypot(destination.x - bot.x, destination.y - bot.y) > 210 &&
          this.time >= bot.dashAt;
        return go(destination.x, destination.y, false);
      }
      input.dx = input.dy = 0;
      return input;
    }
    for (const ring of r.dreamRings ?? [])
      if (
        ring.startedAt <= this.time &&
        Math.abs(Math.hypot(bot.x - ring.x, bot.y - ring.y) - ring.radius) < 75
      )
        input.jump = true;
    return undefined;
  }
}
