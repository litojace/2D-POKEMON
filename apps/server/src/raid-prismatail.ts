import { RaidArena, raidJitter } from "./raid.js";
import {
  leadPoint,
  REACTION,
  SLOWEST_RAIDER,
  type Point,
} from "./raid-boss-aim.js";
import {
  useObstacles,
  RULES,
  normalize,
  type Fighter,
  type Input,
  type Ability,
  type StatusKind,
  STRIKE_KINDS,
  RING_KINDS,
} from "../../../packages/shared/src/index.js";
import {
  PRISMATAIL as P,
  traceLight,
  angleDifference,
  prismatailPattern,
  mirrorReaches,
  prismRayEnd,
  prismRelayHold,
  type RelayNode,
  type RaidAttack,
  type RaidWarning,
  riteValue,
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
/**
 * How far a raider must walk to leave fan slice `index` of `count` (0 when
 * already outside it): sideways past the slice's edge, or out past its
 * reach, whichever is shorter. Uses the same test as the hit.
 */
export function fanEscape(
  p: Point,
  centre: Point,
  index: number,
  count: number,
  radius: number = P.fan.radius,
) {
  const dist = Math.hypot(p.x - centre.x, p.y - centre.y),
    half = Math.PI / count,
    off = angleDifference(
      Math.atan2(p.y - centre.y, p.x - centre.x),
      (index * Math.PI * 2) / count,
    );
  const inside =
    dist <= radius + RULES.radius &&
    off <= half + Math.asin(Math.min(1, RULES.radius / Math.max(1, dist)));
  if (!inside) return 0;
  const out = radius + RULES.radius - dist + 2,
    side =
      off >= half
        ? RULES.radius + 2
        : dist * Math.sin(half - off) + RULES.radius + 2;
  return Math.min(out, side);
}
export class PrismatailArena extends RaidArena {
  private relayAt = 0;
  private burnAt = new Map<string, number>();
  private held = 0;
  private arrivals: (number | undefined)[] = [];
  private rotateAt = new Map<number, number>();
  private flareUntil = new Map<string, number>();
  private wardUntil = new Map<string, number>();
  private lastLanceHit = new Map<string, number>();
  /** Shadopus's Ink Jet: Glare blinds nobody until then. */
  private inkUntil = 0;
  /** Raiders carrying the light right now (lances look for them). */
  private carriers = new Set<string>();
  /** Mirrors on the path that last broke the shield (they scramble first). */
  private lastPath = new Set<number>();
  /** A break happened: scramble its mirrors as the exposure runs out. */
  private scrambleArmed = false;
  private scrambles = 0;
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
    this.inkUntil = 0;
    this.carriers.clear();
    this.scrambleArmed = false;
    for (const m of this.raid.mirrors ?? []) {
      delete m.scrambleAt;
      delete m.scrambleTurns;
    }
  }
  protected override onChapter() {
    this.clearAttacks();
    // A new chapter never inherits a solved board: the last path scrambles.
    if (!this.raid.drill) {
      this.scramble(this.time + P.scramble.warn);
      this.relayAt = this.time + P.relayRestart;
    }
  }
  /**
   * Mirrors flash, then turn back 2–3 steps at `at`: the ones that carried
   * the last light first (1 in the first chapter, 2 later).
   */
  private scramble(at: number) {
    const r = this.raid,
      mirrors = r.mirrors ?? [],
      n = this.scrambles++;
    const least = Math.min(
        mirrors.length,
        P.scramble.mirrors[r.phase - 1] ?? P.scramble.mirrors.at(-1)!,
      ),
      most = Math.min(mirrors.length, Math.max(...P.scramble.mirrors));
    const order = mirrors
      .map((_, i) => i)
      .sort(
        (a, b) =>
          Number(this.lastPath.has(b)) - Number(this.lastPath.has(a)) ||
          raidJitter(r.seed, n, a) - raidJitter(r.seed, n, b),
      );
    const turns = mirrors.map(
        (_, i) =>
          P.scramble.turns[
            Math.floor(raidJitter(r.seed, n + 101, i) * P.scramble.turns.length)
          ],
      ),
      angles = mirrors.map((m) => m.angle),
      chosen: number[] = [];
    const pick = (i: number) => {
      chosen.push(i);
      angles[i] = mirrors[i].angle - (turns[i] * Math.PI) / 4;
    };
    for (const i of order.slice(0, least)) pick(i);
    // From where the raiders stand, a second mirror goes if one leaves a
    // route open (a board with two routes is not solved by turning one).
    while (chosen.length < most) {
      const route = this.openRoute(angles)
        .filter((node) => node.id.startsWith("mirror-"))
        .map((node) => Number(node.id.slice(7)))
        .filter((i) => !chosen.includes(i));
      if (!route.length) break;
      pick(route[0]);
    }
    for (const i of chosen) {
      mirrors[i].scrambleAt = at;
      mirrors[i].scrambleTurns = turns[i];
    }
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
    if (
      p.raidBoss &&
      ["stun", "freeze", "paralysis", "sleep", "root"].includes(kind)
    )
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
    // Shadopus's Ink Jet blots out its eyes: no Glare for a moment.
    if (
      target.raidBoss &&
      ability?.id === "ink-jet" &&
      this.heroes().some((p) => p.id === owner)
    ) {
      this.inkUntil = this.time + 3;
      this.raid.message = "Ink on its shell! Prismell can't Glare for now.";
    }
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
    // Cindrake's Sunfire Pillar and Glacelle's Frost Bloom ice relay light.
    if (a.id === "sunfire-pillar" || a.id === "frost-bloom") {
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
    if (a.id === "skyline-lance") this.cutLanes(p, a);
    if (a.id === "wing-cloak") this.wardUntil.set(p.id, this.time + a.duration);
    if (
      a.id !== "radiant-flare" &&
      [...STRIKE_KINDS, ...RING_KINDS, "cone", "beam"].includes(a.kind)
    )
      this.raid.mirrors?.forEach((m, i) => {
        const dist = Math.hypot(m.x - p.x, m.y - p.y);
        const hit = RING_KINDS.includes(a.kind)
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
  /** Halcyra's Skyline Lance cuts every Prism Lance lane it crosses. */
  private cutLanes(p: Fighter, a: Ability) {
    const beam = [...this.events]
      .reverse()
      .find(
        (e) => e.kind === "beam" && e.owner === p.id && e.abilityId === a.id,
      );
    if (!beam) return;
    const end = { x: beam.tx ?? p.x, y: beam.ty ?? p.y },
      steps = Math.ceil(Math.hypot(end.x - p.x, end.y - p.y) / 8);
    const crosses = (w: RaidWarning) => {
      for (let i = 0; i <= steps; i++) {
        const at = {
          x: p.x + ((end.x - p.x) * i) / Math.max(1, steps),
          y: p.y + ((end.y - p.y) * i) / Math.max(1, steps),
        };
        if (
          prismDistanceToSegment(at, w, { x: w.tx, y: w.ty }) <
          a.radius + w.radius
        )
          return true;
      }
      return false;
    };
    const before = this.raid.warnings.length;
    this.raid.warnings = this.raid.warnings.filter(
      (w) =>
        !(w.kind === "prism-lance" || w.kind === "refraction") || !crosses(w),
    );
    if (this.raid.warnings.length < before)
      this.raid.message = `${p.name}'s Skyline Lance cuts through the prism lances!`;
  }
  protected override canStartAttack() {
    return this.raid.exposedUntil <= this.time;
  }
  /** Lances go after whoever carries the light: hold the relay, or dodge. */
  protected override chooseTarget(kind: RaidAttack, alive: Fighter[]) {
    if (
      (kind === "prism-lance" || kind === "refraction") &&
      this.cunning() > 0
    ) {
      const carriers = alive.filter((p) => this.carriers.has(p.id));
      if (carriers.length) return super.chooseTarget(kind, carriers);
    }
    return super.chooseTarget(kind, alive);
  }
  /** Where a lance aims: a carrier where they stand, anyone else ahead. */
  private lanceAim(target: Fighter, delay: number): Point {
    return this.cunning() > 0 && !this.carriers.has(target.id)
      ? leadPoint(target, delay)
      : { x: target.x, y: target.y };
  }
  /**
   * The fan's hot slice: the one over the most raiders that everyone in it
   * can still leave in time (an empty slice always qualifies).
   */
  private fanSlice(boss: Fighter, count: number) {
    const r = this.raid,
      seeded = (r.seed + this.attacks) % count;
    if (this.cunning() <= 0) return seeded;
    const alive = this.heroes().filter((p) => p.hp > 0),
      reach = SLOWEST_RAIDER * (P.fan.delay - REACTION);
    let best = seeded,
      bestScore = -Infinity;
    for (let k = 0; k < count; k++) {
      const i = (seeded + k) % count,
        need = alive.map((p) => fanEscape(p, boss, i, count));
      if (need.some((d) => d > reach)) continue;
      const score = need.filter((d) => d > 0).length;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }
  /**
   * Halo Crush's gap: away from the raiders around the ring and against
   * the way the target runs, and always opening onto the floor.
   */
  private haloGap(centre: Point, target: Fighter) {
    const toward = Math.atan2(450 - centre.y, 800 - centre.x);
    if (this.cunning() <= 0) return toward;
    const others = this.heroes().filter(
        (p) =>
          p.hp > 0 &&
          Math.abs(Math.hypot(p.x - centre.x, p.y - centre.y) - P.halo.radius) <
            140,
      ),
      speed = Math.hypot(target.vx, target.vy),
      heading = Math.atan2(target.vy, target.vx);
    let best = toward,
      bestCost = Infinity;
    for (let k = 0; k < 16; k++) {
      const a = toward + (k * Math.PI) / 8,
        gx = centre.x + Math.cos(a) * (P.halo.radius + 40),
        gy = centre.y + Math.sin(a) * (P.halo.radius + 40);
      if (gx < 60 || gx > 1540 || gy < 60 || gy > 840) continue;
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
      const aim = this.lanceAim(
        target,
        kind === "refraction" ? 1.45 : P.lance.delay,
      );
      let end = aim;
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
        const reflected = prismRayEnd(end, aim);
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
        index = this.fanSlice(boss, count);
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
        { gapAngle: this.haloGap(target, target), teach },
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
    if (w.kind === "glare" && this.inkUntil > this.time) {
      this.raid.message = "Prismell's Glare fizzles behind the ink!";
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
  private relayRange() {
    return P.range + (this.raid.trait === "dazzling" ? 60 : 0);
  }
  private relaySources() {
    return this.raid.phase === 3 && this.raid.partySize > 1
      ? [
          { x: 350, y: 300 },
          { x: 350, y: 600 },
        ]
      : [P.source];
  }
  /** Raiders, mirrors (optionally with other arrows) and pillars the light can use. */
  private relayNodes(angles?: number[]): RelayNode[] {
    const r = this.raid,
      range = this.relayRange();
    return [
      ...this.heroes()
        .filter((p) => p.hp > 0)
        .map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
          player: true,
          range:
            range +
            (this.hasRite(p, "polished")
              ? riteValue("polished", this.raid.phase)
              : 0),
          broadcast: (this.flareUntil.get(p.id) ?? 0) > this.time,
        })),
      ...(r.mirrors ?? []).map((m, i) => ({
        ...m,
        angle: angles?.[i] ?? m.angle,
        id: `mirror-${i}`,
      })),
      ...(r.sunPillars ?? []).map((m, i) => ({ ...m, id: `pillar-${i}` })),
    ];
  }
  /** A route the light could take right now with these mirror arrows. */
  private openRoute(angles: number[]) {
    const boss = this.boss();
    if (!boss) return [];
    const nodes = this.relayNodes(angles);
    for (const source of this.relaySources()) {
      const path = traceLight(
        source,
        nodes,
        boss,
        this.relayRange(),
        this.raid.trait === "overcast" ? 3 : 2,
      );
      if (path.length) return path;
    }
    return [];
  }
  private relay(dt: number, boss: Fighter) {
    const r = this.raid;
    if (
      this.time < this.relayAt ||
      r.exposedUntil > this.time ||
      (r.drill && r.drill !== "light-relay")
    ) {
      this.burnAt.clear();
      this.carriers.clear();
      return;
    }
    r.lightStartedAt ??= this.time;
    const range = this.relayRange(),
      living = this.heroes().filter((p) => p.hp > 0);
    const nodes = this.relayNodes();
    const split = r.phase === 3 && r.partySize > 1,
      sources = this.relaySources();
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
    const carriers = this.carriers;
    carriers.clear();
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
    if (this.held >= prismRelayHold(r.phase, r.partySize)) {
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
      this.carriers.clear();
      this.lastPath = new Set(
        paths
          .flat()
          .filter((n) => n.id.startsWith("mirror-"))
          .map((n) => Number(n.id.slice(7))),
      );
      this.scrambleArmed = !r.drill;
      r.exposedUntil =
        this.time + P.expose + (r.trait === "kaleidoscope" ? 1 : 0);
      r.staggerUntil = 0;
      r.warnings = [];
      this.nextAttack = r.exposedUntil + 0.8;
      this.relayAt = r.exposedUntil + P.relayRestart;
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
    // The exposure runs out: the mirrors that carried the light flash, then turn.
    if (this.scrambleArmed && this.time >= r.exposedUntil - P.scramble.warn) {
      this.scrambleArmed = false;
      this.scramble(Math.max(r.exposedUntil, this.time + P.scramble.warn));
    }
    r.mirrors?.forEach((m) => {
      if (m.scrambleAt === undefined || this.time < m.scrambleAt) return;
      const turns = m.scrambleTurns ?? 2;
      m.angle =
        (((m.angle - (turns * Math.PI) / 4) % (Math.PI * 2)) + Math.PI * 2) %
        (Math.PI * 2);
      delete m.scrambleAt;
      delete m.scrambleTurns;
      this.event("raid-impact", m, 0xff9ab0, undefined, this.raid.bossId);
      this.events[this.events.length - 1].raidRadius = 45;
    });
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
