import { RaidArena } from "./raid.js";
import {
  useObstacles,
  normalize,
  move,
  CHARACTERS,
  RULES,
  blankInput,
  type Fighter,
  type Input,
  type Ability,
} from "../../../packages/shared/src/index.js";
import {
  STORM_TWINS as S,
  twinKillWindow,
  stormTwinsPattern,
  stormSegmentDistance,
  stormBeamPoints,
  type StormTwin,
  type RaidAttack,
  type RaidWarning,
} from "../../../packages/shared/src/raid.js";
export class StormTwinsArena extends RaidArena {
  private beamHits = new Set<string>();
  private rushHits = new Set<string>();
  private fieldAt = new Map<string, number>();
  protected override def() {
    return S;
  }
  protected override bossHome() {
    return { x: 960, y: 380 };
  }
  override walls() {
    useObstacles([]);
    return [];
  }
  override hitRadius(p: Fighter) {
    return p.raidBoss ? S.radius : super.hitRadius(p);
  }
  protected override setupArena() {
    this.arenaId = "conductor-ring";
    this.raid.pillars = [];
    this.raid.twins = [];
    this.raid.twinRevivals = 0;
    this.clearAttacks();
  }
  override start() {
    super.start();
    const r = this.raid,
      first = this.players.find((p) => p.raidBoss)!;
    const hp = Math.round(r.maxHp / 2);
    r.maxHp = hp * 2;
    Object.assign(first, { name: "Fizz", hp, x: 960, y: 380 });
    const second = super.add("raid-crackle", "Crackle", "terradon");
    Object.assign(second, {
      raidBoss: true,
      team: 1,
      hp,
      x: 1150,
      y: 520,
      ready: true,
    });
    r.twins = [
      { id: first.id, name: "Fizz", maxHp: hp, stagger: 0, exposedUntil: 0 },
      {
        id: second.id,
        name: "Crackle",
        maxHp: hp,
        stagger: 0,
        exposedUntil: 0,
      },
    ];
    this.instructionsReady = [first.id, second.id];
  }
  override boss() {
    return this.players.find((p) => p.raidBoss && p.hp > 0) ?? super.boss();
  }
  private twins() {
    return this.players.filter((p) => p.raidBoss);
  }
  private meta(p: Fighter) {
    return this.raid.twins?.find((t) => t.id === p.id);
  }
  protected override bossHealth() {
    return this.twins().reduce((sum, p) => sum + Math.max(0, p.hp), 0);
  }
  protected override alwaysExposed() {
    return false;
  }
  protected override bossExposed(p: Fighter) {
    return (this.meta(p)?.exposedUntil ?? 0) > this.time;
  }
  protected override addBossStagger(p: Fighter, amount: number) {
    const t = this.meta(p);
    if (t && t.exposedUntil <= this.time)
      t.stagger = Math.min(
        100,
        t.stagger + amount * (this.raid.trait === "overloaded" ? 1.2 : 1),
      );
  }
  override damageLimit(p: Fighter) {
    if (!p.raidBoss) return super.damageLimit(p);
    if (this.raid.phase >= 3) return p.hp;
    const floor = this.raid.maxHp * (this.raid.phase === 1 ? 0.67 : 0.33);
    return Math.max(0, Math.min(p.hp - 1, this.bossHealth() - floor));
  }
  override damage(
    p: Fighter,
    amount: number,
    owner: string,
    ability?: Ability,
  ) {
    const before = p.hp;
    super.damage(p, amount, owner, ability);
    if (!p.raidBoss || p.hp >= before) return;
    if (ability?.id === "void-orb" && p.hp > 0) {
      const other = this.twins().find((t) => t !== p && t.hp > 0);
      if (other) {
        const dist = Math.hypot(other.x - p.x, other.y - p.y),
          d = normalize(other.x - p.x, other.y - p.y),
          pull = Math.min(140, Math.max(0, dist - 180));
        p.x += d.x * pull;
        p.y += d.y * pull;
      }
    }
    if (p.hp <= 0) {
      const t = this.meta(p)!;
      t.fallenAt = this.time;
      t.reviveAt =
        this.time +
        twinKillWindow(this.raid.peril, this.raid.partySize, this.raid.trait);
      t.stagger = 0;
      t.exposedUntil = 0;
      p.statuses = [];
      p.charge = undefined;
      p.channel = undefined;
      p.lastInput = blankInput();
      this.raid.stormBeam = undefined;
      this.beamHits.clear();
      this.raid.stormRushes = (this.raid.stormRushes ?? []).filter(
        (r) => r.id !== p.id,
      );
      this.raid.warnings = this.raid.warnings.filter(
        (w) => w.casterId !== p.id && w.kind !== "link-beam",
      );
      this.raid.message = `${t.name} is down! Finish the other twin before it revives.`;
    }
  }
  override feat() {
    const t = this.raid.twins;
    return (
      this.raid.result === "victory" &&
      !!t &&
      t.length === 2 &&
      t.every((t) => t.fallenAt !== undefined) &&
      Math.abs(t[0].fallenAt! - t[1].fallenAt!) <= 2
    );
  }
  protected override pattern() {
    return stormTwinsPattern(this.raid.phase, this.raid.trait);
  }
  protected override finishMessage(won: boolean) {
    return won
      ? "Two hearts quiet. One storm conquered."
      : "The storm gathers again. Balance their health and pair opposite signs.";
  }
  protected override clearAttacks() {
    super.clearAttacks();
    const r = this.raid;
    r.stormBeam = undefined;
    r.stormChain = undefined;
    r.stormFields = [];
    r.stormRushes = [];
    r.polarities = [];
    r.polarityPad = undefined;
    this.beamHits.clear();
    this.rushHits.clear();
    this.fieldAt.clear();
  }
  protected override onChapter() {
    this.clearAttacks();
    for (const t of this.raid.twins ?? []) {
      t.stagger = 0;
      t.exposedUntil = 0;
    }
  }
  private actors() {
    return this.twins().filter((p) => p.hp > 0 && !this.bossExposed(p));
  }
  protected override canStartAttack() {
    return (
      this.actors().length > 0 &&
      !this.raid.stormRushes?.length &&
      !this.raid.stormBeam
    );
  }
  protected override startAttack(kind: RaidAttack, target: Fighter): void {
    const r = this.raid,
      actors = this.actors();
    if (!actors.length) return;
    const seen = this.seenAttacks.get(kind) ?? 0;
    this.seenAttacks.set(kind, seen + 1);
    const teach = seen < 2;
    const caster =
      kind === "thunderclap"
        ? [...actors].sort((a, b) => a.hp - b.hp)[0]
        : actors[(this.attacks + r.seed) % actors.length];
    caster.angle = Math.atan2(target.y - caster.y, target.x - caster.x);
    const warn = (
      kind: RaidAttack,
      from: Fighter,
      x: number,
      y: number,
      tx: number,
      ty: number,
      radius: number,
      delay: number,
    ) =>
      Object.assign(this.warn(kind, x, y, tx, ty, radius, delay), {
        casterId: from.id,
        teach,
      });
    if (kind === "polarity") {
      const alive = this.heroes().filter((p) => p.hp > 0);
      r.polarities = alive.map((p, i) => ({
        playerId: p.id,
        sign: (i + r.seed) % 2 ? 1 : -1,
        until: this.time + S.polarity.seconds,
        cancelled: false,
      }));
      // A lone survivor needs the solo escape route too.
      if (alive.length === 1) {
        const p = alive[0],
          d = normalize(800 - p.x || 1, 450 - p.y);
        r.polarityPad = {
          x: Math.max(110, Math.min(1490, p.x + d.x * 190)),
          y: Math.max(140, Math.min(760, p.y + d.y * 190)),
          sign: r.polarities[0].sign === 1 ? -1 : 1,
          until: this.time + S.polarity.seconds,
        };
      }
      return;
    }
    if (kind === "link-beam") {
      if (actors.length < 2) return this.startAttack("thunderclap", target);
      const [a, b] = actors,
        post = r.phase >= 2 ? (r.seed + this.attacks) % 4 : undefined;
      a.angle = Math.atan2(b.y - a.y, b.x - a.x);
      b.angle = Math.atan2(a.y - b.y, a.x - b.x);
      Object.assign(
        warn(kind, a, a.x, a.y, b.x, b.y, S.link.width, S.link.delay),
        { beamPost: post },
      );
      return;
    }
    if (kind === "twin-rush") {
      if (actors.length < 2) return this.startAttack("thunderclap", target);
      this.rushHits.clear();
      actors.forEach((p, i) =>
        warn(
          kind,
          p,
          p.x,
          p.y,
          Math.max(100, Math.min(1500, 1600 - p.x)),
          Math.max(170, Math.min(730, 900 - p.y + (i ? -140 : 140))),
          S.rush.width,
          S.rush.delay,
        ),
      );
      return;
    }
    const cast = (from: Fighter, to: Fighter, extra = 0) => {
      from.angle = Math.atan2(to.y - from.y, to.x - from.x);
      if (kind === "chain-lightning")
        warn(
          kind,
          from,
          to.x,
          to.y,
          to.x,
          to.y,
          S.chain.range,
          S.chain.delay + extra,
        ).targetId = to.id;
      else if (kind === "static-field") {
        const centers = [
          to,
          ...(r.trait === "overloaded"
            ? this.heroes()
                .filter((p) => p.hp > 0 && p !== to)
                .slice(0, 1)
            : []),
        ];
        if (r.trait === "overloaded" && centers.length === 1)
          centers.push({ ...to, x: Math.max(130, Math.min(1470, to.x + 230)) });
        for (const p of centers)
          warn(
            kind,
            from,
            p.x,
            p.y,
            p.x,
            p.y,
            S.field.radius,
            S.field.delay + extra,
          );
      } else if (kind === "thunderclap")
        warn(
          kind,
          from,
          from.x,
          from.y,
          from.x,
          from.y,
          S.clap.radius,
          S.clap.delay + extra,
        );
    };
    cast(caster, target);
    if (
      r.trait === "in-sync" &&
      actors.length > 1 &&
      ["chain-lightning", "static-field", "thunderclap"].includes(kind)
    ) {
      const other = actors.find((p) => p !== caster)!,
        ally = this.heroes().find((p) => p.hp > 0 && p !== target);
      if (ally || kind !== "chain-lightning") cast(other, ally ?? target, 0.35);
    }
  }
  protected override followWarnings(boss: Fighter) {
    super.followWarnings(boss);
    for (const w of this.raid.warnings) {
      if (w.kind === "chain-lightning") {
        const p = this.heroes().find((p) => p.id === w.targetId && p.hp > 0);
        if (p) {
          w.x = w.tx = p.x;
          w.y = w.ty = p.y;
        }
      } else if (w.kind === "link-beam") {
        const [a, b] = this.twins();
        if (a && b) {
          w.x = a.x;
          w.y = a.y;
          w.tx = b.x;
          w.ty = b.y;
        }
      }
    }
  }
  protected override resolveWarning(w: RaidWarning, _boss: Fighter) {
    const r = this.raid,
      caster = this.twins().find((p) => p.id === w.casterId && p.hp > 0);
    if (!caster) return;
    if (w.kind === "link-beam") {
      if (this.twins().some((p) => p.hp <= 0)) return;
      this.beamHits.clear();
      const [a, b] = this.twins();
      r.stormBeam = {
        points: stormBeamPoints(a, b, w.beamPost),
        post: w.beamPost,
        until: this.time + S.link.seconds,
      };
      return;
    }
    if (w.kind === "static-field") {
      (r.stormFields ??= []).push({
        id: ++this.serial,
        x: w.x,
        y: w.y,
        radius: w.radius,
        until: this.time + S.field.seconds,
        casterId: caster.id,
      });
      r.stormFields = r.stormFields.slice(-8);
      return;
    }
    if (w.kind === "twin-rush") {
      (r.stormRushes ??= []).push({
        id: caster.id,
        x: w.x,
        y: w.y,
        tx: w.tx,
        ty: w.ty,
        until: this.time + S.rush.seconds,
      });
      return;
    }
    this.hitBy = w.kind;
    if (w.kind === "chain-lightning") {
      let p = this.heroes().find((p) => p.id === w.targetId && p.hp > 0);
      const visited = new Set<string>(),
        points = [];
      for (let i = 0; p && i < S.chain.damage.length; i++) {
        visited.add(p.id);
        points.push({ x: p.x, y: p.y });
        if (p.character === "voltkit") {
          this.chargeUlt(p, 15);
          this.event("orb", p, 0xffdf8d, 15, p.id);
          break;
        }
        this.damage(p, S.chain.damage[i], caster.id);
        if (this.hasRite(p, "grounded")) break;
        const from = p;
        p = this.heroes()
          .filter(
            (q) =>
              q.hp > 0 &&
              !visited.has(q.id) &&
              Math.hypot(q.x - from.x, q.y - from.y) <= S.chain.range,
          )
          .sort(
            (a, b) =>
              Math.hypot(a.x - from.x, a.y - from.y) -
              Math.hypot(b.x - from.x, b.y - from.y),
          )[0];
      }
      r.stormChain = { points, until: this.time + 0.65 };
    } else if (w.kind === "thunderclap")
      for (const p of this.heroes())
        if (
          p.hp > 0 &&
          p.jumpUntil <= this.time &&
          Math.hypot(p.x - w.x, p.y - w.y) <= w.radius + RULES.radius
        )
          this.damage(p, S.clap.damage, caster.id);
    this.hitBy = undefined;
    this.countDodges();
    this.event("raid-impact", w, 0x8fdfff, undefined, caster.id);
    this.events[this.events.length - 1].raidRadius = w.radius;
  }
  private polarity() {
    const r = this.raid,
      marks = r.polarities ?? [],
      alive = this.heroes().filter((p) => p.hp > 0);
    const cancel = new Set<string>();
    for (const m of marks) {
      if (m.cancelled || m.until <= this.time) continue;
      const p = alive.find((p) => p.id === m.playerId);
      if (!p) continue;
      if (
        r.polarityPad &&
        r.polarityPad.sign !== m.sign &&
        Math.hypot(p.x - r.polarityPad.x, p.y - r.polarityPad.y) <=
          S.polarity.padRadius
      )
        cancel.add(p.id);
      for (const n of marks) {
        const q = alive.find((p) => p.id === n.playerId);
        if (
          q &&
          n !== m &&
          n.until > this.time &&
          n.sign !== m.sign &&
          Math.hypot(q.x - p.x, q.y - p.y) <= S.polarity.range
        ) {
          cancel.add(p.id);
          cancel.add(q.id);
        }
      }
    }
    for (const m of marks)
      if (cancel.has(m.playerId) && !m.cancelled) {
        m.cancelled = true;
        const p = alive.find((p) => p.id === m.playerId)!;
        if (!r.drill && r.contributions?.[p.id])
          r.contributions[p.id].pillars++;
        this.event("heal", p, 0x8cead0, 0, p.id);
        if (r.drillStats) r.drillStats.dodges++;
      }
    for (const m of marks) {
      if (m.until > this.time || m.cancelled) continue;
      const p = alive.find((p) => p.id === m.playerId);
      if (!p) continue;
      if (p.character === "terradon" && this.has(p, "sleep")) continue;
      const mismatch = marks.some(
        (n) =>
          n !== m &&
          !n.cancelled &&
          n.sign === m.sign &&
          alive.some(
            (q) =>
              q.id === n.playerId &&
              Math.hypot(q.x - p.x, q.y - p.y) <= S.polarity.range,
          ),
      );
      this.hitBy = "polarity";
      this.damage(
        p,
        S.polarity.damage * (mismatch && !this.hasRite(p, "grounded") ? 2 : 1),
        this.boss()!.id,
      );
      this.hitBy = undefined;
    }
    r.polarities = marks.filter((m) => m.until > this.time);
    if (r.polarityPad && r.polarityPad.until <= this.time)
      r.polarityPad = undefined;
  }
  protected override worldStep(dt: number, _boss: Fighter) {
    const r = this.raid;
    // A simultaneous finish always wins, even on the expiry tick.
    if (this.twins().every((p) => p.hp <= 0)) return;
    for (const t of r.twins ?? []) {
      const p = this.twins().find((p) => p.id === t.id)!;
      if (p.hp <= 0 && t.reviveAt !== undefined && this.time >= t.reviveAt) {
        p.hp = Math.round(t.maxHp * S.reviveFraction);
        p.statuses = [];
        p.lastInput = blankInput();
        t.fallenAt = undefined;
        t.reviveAt = undefined;
        r.twinRevivals = (r.twinRevivals ?? 0) + 1;
        r.message = `${t.name} returns! Lower both health bars before finishing.`;
      }
      if (p.hp > 0 && t.stagger >= 100 && t.exposedUntil <= this.time) {
        t.stagger = 0;
        t.exposedUntil = this.time + 6;
        r.warnings = r.warnings.filter(
          (w) => w.casterId !== p.id && w.kind !== "link-beam",
        );
        r.stormBeam = undefined;
        r.message = `${t.name} staggered! Strike its glowing core.`;
      }
    }
    this.polarity();
    r.stormFields = (r.stormFields ?? []).filter((f) => f.until > this.time);
    this.hitBy = "static-field";
    for (const p of this.heroes()) {
      if (p.hp <= 0) continue;
      const field = r.stormFields.find(
        (f) => Math.hypot(p.x - f.x, p.y - f.y) <= f.radius + RULES.radius,
      );
      if (field && p.jumpUntil <= this.time) {
        this.status(p, "slow", 0.7, field.casterId);
        const before = this.fieldAt.get(p.id) ?? this.time;
        this.fieldAt.set(p.id, before);
        if (this.time - before >= 0.5) {
          this.damage(
            p,
            S.field.damage * Math.min(0.55, this.time - before),
            field.casterId,
          );
          this.fieldAt.set(p.id, this.time);
        }
      } else this.fieldAt.delete(p.id);
    }
    this.hitBy = undefined;
    const beam = r.stormBeam;
    if (beam) {
      const [a, b] = this.twins();
      if (a.hp <= 0 || b.hp <= 0 || beam.until <= this.time) {
        this.struck = new Set(this.beamHits);
        this.countDodges();
        r.stormBeam = undefined;
        this.beamHits.clear();
      } else {
        beam.points = stormBeamPoints(a, b, beam.post);
        this.hitBy = "link-beam";
        for (const p of this.heroes())
          if (
            p.hp > 0 &&
            !this.beamHits.has(p.id) &&
            p.jumpUntil <= this.time &&
            beam.points
              .slice(1)
              .some(
                (point, i) =>
                  stormSegmentDistance(p, beam.points[i], point) <=
                  S.link.width + RULES.radius,
              )
          ) {
            this.beamHits.add(p.id);
            const source = this.boss()!,
              mirror = p.character === "auralynx" && this.has(p, "counter");
            this.damage(
              p,
              r.trait === "bickering" ? 12 : S.link.damage,
              source.id,
            );
            if (mirror) this.addBossStagger(source, 20);
          }
        this.hitBy = undefined;
      }
    }
    if (r.stormChain && r.stormChain.until <= this.time)
      r.stormChain = undefined;
  }
  protected override bossStep(dt: number, _boss: Fighter) {
    const r = this.raid;
    for (const p of this.twins()) {
      if (p.hp <= 0 || this.bossExposed(p)) continue;
      p.lastInput = blankInput();
      const rush = r.stormRushes?.find((q) => q.id === p.id);
      if (rush) {
        const before = { x: p.x, y: p.y },
          d = normalize(rush.tx - p.x, rush.ty - p.y),
          step = Math.min(2200 * dt, Math.hypot(rush.tx - p.x, rush.ty - p.y));
        p.x += d.x * step;
        p.y += d.y * step;
        this.hitBy = "twin-rush";
        for (const hero of this.heroes())
          if (
            hero.hp > 0 &&
            !this.rushHits.has(hero.id) &&
            stormSegmentDistance(hero, before, p) <= S.rush.width + RULES.radius
          ) {
            this.rushHits.add(hero.id);
            this.damage(hero, S.rush.damage, p.id);
          }
        this.hitBy = undefined;
      } else {
        const index = this.raid.twins!.findIndex((t) => t.id === p.id),
          angle =
            this.phaseElapsed * 0.19 + index * Math.PI + (index ? 0.25 : 0),
          radius = r.phase === 1 ? 120 : r.trait === "bickering" ? 320 : 260;
        const x = S.home.x + Math.cos(angle) * radius,
          y = S.home.y + Math.sin(angle) * Math.min(170, radius * 0.6),
          d = normalize(x - p.x, y - p.y),
          step = Math.min(
            (r.phase === 1 ? 40 : 70) * dt,
            Math.hypot(x - p.x, y - p.y),
          );
        p.x += d.x * step;
        p.y += d.y * step;
      }
    }
    if (r.stormRushes?.length) {
      r.stormRushes = r.stormRushes.filter(
        (q) =>
          q.until > this.time &&
          this.twins().some(
            (p) =>
              p.id === q.id &&
              p.hp > 0 &&
              Math.hypot(p.x - q.tx, p.y - q.ty) > 5,
          ),
      );
      if (!r.stormRushes.length) {
        this.struck = new Set(this.rushHits);
        this.countDodges();
        this.rushHits.clear();
      }
    }
  }
  protected override botHint(
    bot: Fighter,
    input: Input,
    go: (x: number, y: number, away: boolean) => Input,
  ): Input | undefined {
    const r = this.raid,
      alive = this.twins().filter((p) => p.hp > 0),
      marked = r.polarities?.find(
        (m) => m.playerId === bot.id && m.until > this.time,
      );
    if (marked) {
      if (r.polarityPad && !marked.cancelled) {
        const pad = r.polarityPad;
        if (
          Math.hypot(bot.x - pad.x, bot.y - pad.y) >
          S.polarity.padRadius * 0.6
        )
          return go(pad.x, pad.y, false);
        input.dx = input.dy = 0;
        return input;
      }
      const opposite = r
        .polarities!.filter(
          (m) =>
            m.until > this.time &&
            m.sign !== marked.sign &&
            (!marked.cancelled || !m.cancelled),
        )
        .map((m) => this.heroes().find((p) => p.id === m.playerId && p.hp > 0))
        .filter((p): p is Fighter => !!p)
        .sort(
          (a, b) =>
            Math.hypot(a.x - bot.x, a.y - bot.y) -
            Math.hypot(b.x - bot.x, b.y - bot.y),
        )[0];
      if (opposite) {
        if (
          Math.hypot(bot.x - opposite.x, bot.y - opposite.y) >
          S.polarity.range * 0.65
        )
          return go(opposite.x, opposite.y, false);
        input.dx = input.dy = 0;
        return input;
      }
    }
    const chain = r.warnings.find((w) => w.kind === "chain-lightning");
    if (chain && bot.character !== "voltkit") {
      const ally = this.heroes().find(
        (p) =>
          p !== bot &&
          p.hp > 0 &&
          Math.hypot(p.x - bot.x, p.y - bot.y) < S.chain.range + 35,
      );
      if (ally) return go(ally.x, ally.y, true);
    }
    const lane = r.warnings.find(
      (w) =>
        w.kind === "twin-rush" &&
        stormSegmentDistance(bot, w, { x: w.tx, y: w.ty }) <
          w.radius + RULES.radius + 25,
    );
    if (lane) {
      const d = normalize(lane.tx - lane.x, lane.ty - lane.y);
      return go(bot.x - d.y * 100, bot.y + d.x * 100, false);
    }
    if (
      r.stormBeam?.points
        .slice(1)
        .some(
          (p, i) => stormSegmentDistance(bot, r.stormBeam!.points[i], p) < 85,
        )
    )
      input.jump = true;
    const clap = r.warnings.find(
      (w) =>
        w.kind === "thunderclap" &&
        Math.hypot(bot.x - w.x, bot.y - w.y) < w.radius + RULES.radius,
    );
    if (clap && clap.at - this.time < 0.35) input.jump = true;
    const field = r.stormFields?.find(
      (f) => Math.hypot(bot.x - f.x, bot.y - f.y) < f.radius + 50,
    );
    if (field) {
      input.jump = true;
      return go(field.x, field.y, true);
    }
    const down = this.heroes().find(
      (p) =>
        p.hp <= 0 && this.raid.downed[p.id] && !this.raid.downed[p.id].self,
    );
    if (down && Math.hypot(down.x - bot.x, down.y - bot.y) > 60)
      return go(down.x, down.y, false);
    // Keep health balanced, then automatically focus the surviving twin in its kill window.
    const target = [...alive].sort((a, b) => b.hp - a.hp)[0];
    if (target) {
      input.aimX = target.x;
      input.aimY = target.y;
      if (
        Math.hypot(bot.x - target.x, bot.y - target.y) >
        this.kit(bot).basic.range * 0.8
      )
        return go(target.x, target.y, false);
    }
    return undefined;
  }
}
