import { RaidArena } from "./raid.js";
import {
  useObstacles,
  RULES,
  normalize,
  type Fighter,
  type Input,
  type Ability,
  type StatusKind,
} from "../../../packages/shared/src/index.js";
import {
  PRISMATAIL as P,
  traceLight,
  angleDifference,
  prismatailPattern,
  mirrorReaches,
  prismRayEnd,
  type RelayNode,
  type RaidAttack,
  type RaidWarning,
} from "../../../packages/shared/src/raid.js";
export const prismDistanceToSegment = (
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
export class PrismatailArena extends RaidArena {
  private relayAt = 0;
  private burnAt = new Map<string, number>();
  private held = 0;
  private arrivals: (number | undefined)[] = [];
  private rotateAt = new Map<number, number>();
  private flareUntil = new Map<string, number>();
  private wardUntil = new Map<string, number>();
  private lastLanceHit = new Map<string, number>();
  protected override def() {
    return P;
  }
  protected override bossHome() {
    return { x: 1000, y: 450 };
  }
  protected override alwaysExposed() {
    return false;
  }
  override walls() {
    useObstacles([]);
    return [];
  }
  protected override pattern() {
    return prismatailPattern(this.raid.phase, this.raid.trait);
  }
  protected override setupArena() {
    this.arenaId = "sun-atrium";
    this.raid.pillars = [];
    this.raid.mirrors = P.mirrors.map((m, i) => ({
      ...m,
      angle: i === 1 ? Math.PI / 4 : i === 3 ? (Math.PI * 7) / 4 : 0,
    }));
    this.raid.shieldBreaks = 0;
    this.raid.quickBreaks = 0;
    this.raid.blinded = {};
    this.clearAttacks();
  }
  protected override clearAttacks() {
    super.clearAttacks();
    this.raid.lightLinks = [];
    this.raid.sunPillars = [];
    this.raid.lightStartedAt = undefined;
    this.raid.lightHold = 0;
    this.raid.lightArrivals = [];
    this.raid.blinded = {};
    this.relayAt = this.time + 2;
    this.held = 0;
    this.arrivals = [];
    this.burnAt.clear();
    this.rotateAt.clear();
    this.flareUntil.clear();
    this.wardUntil.clear();
    this.lastLanceHit.clear();
  }
  protected override onChapter() {
    this.clearAttacks();
  }
  override feat() {
    return this.raid.result === "victory" && (this.raid.quickBreaks ?? 0) >= 3;
  }
  protected override finishMessage(won: boolean) {
    return won
      ? "The shield shatters. The atrium shines for you!"
      : "The light fades. Reconnect the mirrors and try again.";
  }
  override status(p: Fighter, kind: StatusKind, duration: number, by?: string) {
    if (p.raidBoss && ["stun", "freeze", "paralysis", "sleep"].includes(kind))
      return;
    super.status(p, kind, duration, by);
  }
  override damage(
    target: Fighter,
    amount: number,
    owner: string,
    ability?: Ability,
  ) {
    if (target.raidBoss && this.raid.exposedUntil <= this.time) amount *= 0.12;
    super.damage(target, amount, owner, ability);
    // Only the light puzzle opens this boss; chip damage cannot bypass it via stagger.
    if (target.raidBoss) this.raid.stagger = 0;
  }
  private turn(index: number) {
    if (this.time < (this.rotateAt.get(index) ?? 0)) return;
    const m = this.raid.mirrors?.[index];
    if (!m) return;
    m.angle = (m.angle + Math.PI / 4) % (Math.PI * 2);
    this.rotateAt.set(index, this.time + 0.4);
    this.event("raid-impact", m, 0xffdf8d, undefined, this.raid.bossId);
    this.events[this.events.length - 1].raidRadius = 35;
  }
  override cast(p: Fighter, a: Ability, ex = false) {
    super.cast(p, a, ex);
    if (p.raidBoss || p.hp <= 0) return;
    if (a.id === "sunfire-pillar") {
      const aim = p.lastInput,
        d = normalize(aim.aimX - p.x, aim.aimY - p.y),
        len = Math.min(a.range, Math.hypot(aim.aimX - p.x, aim.aimY - p.y));
      (this.raid.sunPillars ??= []).push({
        x: p.x + d.x * len,
        y: p.y + d.y * len,
        until: this.time + 4,
        owner: p.id,
      });
    }
    if (a.id === "radiant-flare") this.flareUntil.set(p.id, this.time + 4);
    if (a.id === "ward") this.wardUntil.set(p.id, this.time + a.duration);
    if (
      a.id !== "radiant-flare" &&
      ["melee", "cone", "beam", "nova"].includes(a.kind)
    )
      this.raid.mirrors?.forEach((m, i) => {
        const dist = Math.hypot(m.x - p.x, m.y - p.y);
        const hit =
          a.kind === "nova"
            ? dist <= a.radius + 30
            : dist <= a.range + 30 &&
              (a.kind === "beam"
                ? prismDistanceToSegment(m, p, {
                    x: p.x + Math.cos(p.angle) * a.range,
                    y: p.y + Math.sin(p.angle) * a.range,
                  }) <
                  (a.radius || 20) + 30
                : Math.cos(Math.atan2(m.y - p.y, m.x - p.x) - p.angle) >
                  (a.arc ?? 0.35));
        if (hit) this.turn(i);
      });
  }
  protected override canStartAttack() {
    return this.raid.exposedUntil <= this.time;
  }
  protected override startAttack(kind: RaidAttack, target: Fighter) {
    const boss = this.boss()!,
      r = this.raid;
    if (kind === "light-relay") {
      this.relayAt = this.time;
      return;
    }
    const seen = this.seenAttacks.get(kind) ?? 0;
    this.seenAttacks.set(kind, seen + 1);
    const teach = seen < 2;
    boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
    if (kind === "prism-lance" || kind === "refraction") {
      let end = { x: target.x, y: target.y };
      if (kind === "refraction")
        end =
          [...(r.mirrors ?? [])].sort(
            (a, b) =>
              Math.hypot(a.x - target.x, a.y - target.y) -
              Math.hypot(b.x - target.x, b.y - target.y),
          )[0] ?? end;
      const tip = kind === "refraction" ? end : prismRayEnd(boss, end);
      this.warn(
        kind,
        boss.x,
        boss.y,
        tip.x,
        tip.y,
        P.lance.width,
        P.lance.delay,
      ).teach = teach;
      if (kind === "refraction") {
        const reflected = prismRayEnd(end, target);
        this.warn(
          kind,
          end.x,
          end.y,
          reflected.x,
          reflected.y,
          P.lance.width,
          1.45,
        ).teach = teach;
      }
    } else if (kind === "fan-display") {
      const count = r.trait === "kaleidoscope" ? 8 : 6,
        index = (r.seed + this.attacks) % count;
      Object.assign(
        this.warn(
          kind,
          boss.x,
          boss.y,
          boss.x,
          boss.y,
          P.fan.radius,
          P.fan.delay,
        ),
        { prismIndex: index, prismCount: count, teach },
      );
    } else if (kind === "glare")
      this.warn(
        kind,
        boss.x,
        boss.y,
        boss.x,
        boss.y,
        1600,
        P.glare.delay,
      ).teach = teach;
    else if (kind === "halo-crush")
      Object.assign(
        this.warn(
          kind,
          target.x,
          target.y,
          target.x,
          target.y,
          P.halo.radius,
          P.halo.delay,
        ),
        { gapAngle: Math.atan2(450 - target.y, 800 - target.x), teach },
      );
  }
  protected override resolveWarning(w: RaidWarning, boss: Fighter) {
    this.hitBy = w.kind;
    const end = { x: w.tx, y: w.ty };
    const voidOrb =
      w.kind === "prism-lance" || w.kind === "refraction"
        ? this.projectiles.find(
            (pr) =>
              pr.ability.id === "void-orb" &&
              prismDistanceToSegment(pr, w, end) <
                (pr.ability.radius || 20) + w.radius,
          )
        : undefined;
    if (voidOrb) {
      this.projectiles = this.projectiles.filter((p) => p !== voidOrb);
      this.raid.message = "Void Orb swallowed a prism lance!";
      this.hitBy = undefined;
      this.countDodges();
      return;
    }
    for (const p of this.heroes()) {
      if (p.hp <= 0) continue;
      if (w.kind === "glare") {
        const protectedByWard = this.heroes().some(
          (q) =>
            q.hp > 0 &&
            (this.wardUntil.get(q.id) ?? 0) > this.time &&
            Math.hypot(q.x - p.x, q.y - p.y) <= 150,
        );
        if (
          !protectedByWard &&
          angleDifference(p.angle, Math.atan2(boss.y - p.y, boss.x - p.x)) <
            Math.PI / 2
        ) {
          (this.raid.blinded ??= {})[p.id] = this.time + P.glare.blind;
          this.struck.add(p.id);
          if (this.raid.drillStats) this.raid.drillStats.hits++;
        }
        continue;
      }
      const a = Math.atan2(p.y - w.y, p.x - w.x),
        dist = Math.hypot(p.x - w.x, p.y - w.y);
      const hit =
        w.kind === "fan-display"
          ? dist <= w.radius + RULES.radius &&
            angleDifference(
              a,
              ((w.prismIndex ?? 0) * Math.PI * 2) / (w.prismCount ?? 6),
            ) <=
              Math.PI / (w.prismCount ?? 6) +
                Math.asin(Math.min(1, RULES.radius / Math.max(1, dist)))
          : w.kind === "halo-crush"
            ? Math.abs(dist - w.radius) <= P.halo.width + RULES.radius &&
              angleDifference(a, w.gapAngle ?? 0) > P.halo.gap
            : prismDistanceToSegment(p, w, end) <= w.radius + RULES.radius;
      if (hit) {
        if (
          w.kind === "refraction" &&
          this.time - (this.lastLanceHit.get(p.id) ?? -99) < 0.5
        )
          continue;
        if (w.kind === "prism-lance" || w.kind === "refraction")
          this.lastLanceHit.set(p.id, this.time);
        this.damage(
          p,
          w.kind === "fan-display"
            ? P.fan.damage
            : w.kind === "halo-crush"
              ? P.halo.damage
              : P.lance.damage,
          boss.id,
        );
      }
    }
    this.hitBy = undefined;
    this.countDodges();
    if (w.kind !== "glare") {
      this.event("raid-impact", w, 0xffd778, undefined, boss.id);
      this.events[this.events.length - 1].raidRadius = Math.min(180, w.radius);
    }
  }
  private relay(dt: number, boss: Fighter) {
    const r = this.raid;
    if (
      this.time < this.relayAt ||
      r.exposedUntil > this.time ||
      (r.drill && r.drill !== "light-relay")
    ) {
      this.burnAt.clear();
      return;
    }
    r.lightStartedAt ??= this.time;
    const range = P.range + (r.trait === "dazzling" ? 60 : 0),
      living = this.heroes().filter((p) => p.hp > 0);
    const nodes: RelayNode[] = [
      ...living.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        player: true,
        range: range + (this.hasRite(p, "polished") ? 60 : 0),
        broadcast: (this.flareUntil.get(p.id) ?? 0) > this.time,
      })),
      ...(r.mirrors ?? []).map((m, i) => ({ ...m, id: `mirror-${i}` })),
      ...(r.sunPillars ?? []).map((m, i) => ({ ...m, id: `pillar-${i}` })),
    ];
    const split = r.phase === 3 && r.partySize > 1,
      sources = split
        ? [
            { x: 350, y: 300 },
            { x: 350, y: 600 },
          ]
        : [P.source];
    const paths: RelayNode[][] = [],
      usedPlayers = new Set<string>();
    r.lightLinks = [];
    for (const [beam, source] of sources.entries()) {
      const path = traceLight(
        source,
        nodes,
        boss,
        range,
        r.trait === "overcast" ? 3 : 2,
        usedPlayers,
      );
      paths.push(path);
      if (path.length) {
        let from = source;
        for (const node of path) {
          r.lightLinks.push({ ...from, tx: node.x, ty: node.y, beam });
          from = node;
          if (node.player && !node.broadcast) usedPlayers.add(node.id);
        }
        r.lightLinks.push({ ...from, tx: boss.x, ty: boss.y, beam });
        this.arrivals[beam] ??= this.time;
      } else {
        const p = nodes
          .filter(
            (n) =>
              n.player &&
              !usedPlayers.has(n.id) &&
              Math.hypot(n.x - source.x, n.y - source.y) <= range,
          )
          .sort(
            (a, b) =>
              Math.hypot(a.x - source.x, a.y - source.y) -
              Math.hypot(b.x - source.x, b.y - source.y),
          )[0];
        if (p) r.lightLinks.push({ ...source, tx: p.x, ty: p.y, beam });
      }
    }
    // A 3-second pairing window: an expired first arrival starts a fresh attempt.
    if (
      split &&
      this.arrivals.some((t) => t !== undefined && this.time - t > 3)
    ) {
      this.arrivals = [];
      paths.forEach((p, i) => {
        if (p.length) this.arrivals[i] = this.time;
      });
    }
    const connected = split
      ? [0, 1].every(
          (i) =>
            this.arrivals[i] !== undefined &&
            this.time - this.arrivals[i]! <= 3,
        )
      : paths[0].length > 0;
    this.held = connected ? this.held + dt : 0;
    r.lightHold = this.held;
    r.lightArrivals = this.arrivals.map((t) => t ?? -1);
    const carriers = new Set<string>();
    paths.flat().forEach((n) => {
      if (n.player) carriers.add(n.id);
    });
    for (const link of r.lightLinks)
      for (const p of living)
        if (Math.hypot(link.tx - p.x, link.ty - p.y) < 1) carriers.add(p.id);
    for (const p of living)
      if (carriers.has(p.id) && !this.hasRite(p, "polished")) {
        const before = this.burnAt.get(p.id) ?? this.time;
        if (this.time - before >= 0.5) {
          this.damage(p, P.burn * Math.min(0.55, this.time - before), boss.id);
          this.burnAt.set(p.id, this.time);
        } else if (!this.burnAt.has(p.id)) this.burnAt.set(p.id, this.time);
      } else this.burnAt.delete(p.id);
    const hold = r.phase === 3 && r.partySize === 1 ? 2 : 0.65;
    if (this.held >= hold) {
      r.shieldBreaks = (r.shieldBreaks ?? 0) + 1;
      if (this.time - r.lightStartedAt <= 8)
        r.quickBreaks = (r.quickBreaks ?? 0) + 1;
      if (!r.drill)
        for (const p of living)
          if (
            paths.some((path) => path.some((n) => n.id === p.id)) &&
            r.contributions?.[p.id]
          )
            r.contributions[p.id].pillars++;

      this.burnAt.clear();
      r.exposedUntil =
        this.time + P.expose + (r.trait === "kaleidoscope" ? 1 : 0);
      r.staggerUntil = 0;
      r.warnings = [];
      this.nextAttack = r.exposedUntil + 0.8;
      this.relayAt = r.exposedUntil + 1.5;
      r.message = "LIGHT RELAY COMPLETE! Strike the shining heart!";
      r.lightStartedAt = undefined;
      this.arrivals = [];
      this.held = 0;
      if (r.drillStats) r.drillStats.dodges++;
    }
  }
  protected override worldStep(dt: number, boss: Fighter) {
    const r = this.raid;
    r.sunPillars = (r.sunPillars ?? []).filter((p) => p.until > this.time);
    for (const id of Object.keys(r.blinded ?? {}))
      if (r.blinded![id] <= this.time) delete r.blinded![id];
    const spent = new Set<number>();
    r.mirrors?.forEach((m, i) => {
      const shot = this.projectiles.find(
        (pr) =>
          pr.owner !== boss.id &&
          !spent.has(pr.id) &&
          prismDistanceToSegment(m, pr, {
            x: pr.x + pr.vx * dt,
            y: pr.y + pr.vy * dt,
          }) <
            35 + (pr.ability.radius || 10),
      );
      if (shot) {
        this.turn(i);
        spent.add(shot.id);
      }
    });
    this.projectiles = this.projectiles.filter((pr) => !spent.has(pr.id));
    this.relay(dt, boss);
  }
  protected override bossStep(dt: number, boss: Fighter) {
    if (
      this.raid.exposedUntil > this.time ||
      this.held > 0 ||
      this.raid.warnings.length
    )
      return;
    const tx = [1000, 1040, 1080][this.raid.phase - 1],
      ty = 450 + Math.sin(this.phaseElapsed * 0.2) * 12;
    const d = normalize(tx - boss.x, ty - boss.y),
      step = Math.min(35 * dt, Math.hypot(tx - boss.x, ty - boss.y));
    boss.x += d.x * step;
    boss.y += d.y * step;
  }
  protected override botHint(
    bot: Fighter,
    input: Input,
    go: (x: number, y: number, away: boolean) => Input,
  ): Input | undefined {
    const r = this.raid;
    const glare = this.raid.warnings.some((w) => w.kind === "glare");
    if (glare) {
      const boss = this.boss()!;
      input.aimX = Math.max(0, Math.min(1600, bot.x + (bot.x - boss.x)));
      input.aimY = Math.max(0, Math.min(900, bot.y + (bot.y - boss.y)));
      input.basic = false;
      input.skill = -1;
      return input;
    }
    const lane = this.raid.warnings.find(
      (w) =>
        (w.kind === "prism-lance" || w.kind === "refraction") &&
        prismDistanceToSegment(bot, w, { x: w.tx, y: w.ty }) <
          w.radius + RULES.radius + 30,
    );
    if (lane) {
      const d = normalize(lane.tx - lane.x, lane.ty - lane.y);
      return go(bot.x - d.y * 100, bot.y + d.x * 100, false);
    }
    if (this.raid.exposedUntil <= this.time && !this.raid.warnings.length) {
      const seat = this.heroes()
          .filter((p) => p.hp > 0)
          .findIndex((p) => p.id === bot.id),
        split = this.raid.phase === 3 && this.raid.partySize > 1;
      // Stand-ins repair the same visible arrows a player would, using ordinary attacks.
      if (seat < (split ? 2 : 1)) {
        const branch = split && seat % 2 ? [2, 3] : [0, 1];
        for (const [j, index] of branch.entries()) {
          const mirror = r.mirrors?.[index],
            destination = j === 0 ? r.mirrors?.[branch[1]] : this.boss();
          if (!mirror || !destination || mirrorReaches(mirror, destination))
            continue;
          input.aimX = mirror.x;
          input.aimY = mirror.y;
          input.skill = -1;
          input.basic = true;
          const spot = { x: mirror.x - 90, y: mirror.y };
          if (Math.hypot(bot.x - spot.x, bot.y - spot.y) > 15)
            return go(spot.x, spot.y, false);
          input.dx = input.dy = 0;
          return input;
        }
      }
      const x = 470,
        y = split ? (seat % 2 ? 600 : 300) : 450;
      if (Math.hypot(bot.x - x, bot.y - y) > 18) return go(x, y, false);
      input.dx = input.dy = 0;
      input.basic = false;
      input.skill = -1;
      return input;
    }
    return undefined;
  }
}
