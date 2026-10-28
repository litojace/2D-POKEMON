import { RaidArena } from "./raid.js";
import {
  normalize,
  move,
  RULES,
  type Fighter,
  type Input,
  type Ability,
} from "../../../packages/shared/src/index.js";
import {
  EMBERWING as E,
  brazierLifetime,
  emberwingPattern,
  type RaidAttack,
  type RaidWarning,
} from "../../../packages/shared/src/raid.js";
const segmentDistance = (
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
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
};
export class EmberwingArena extends RaidArena {
  private floorAt = new Map<string, number>();
  private brazierTargets = new Map<string, number>();
  private ringStruck = new Map<number, Set<string>>();
  private ringHits = new Map<number, Set<string>>();
  protected override def() {
    return E;
  }
  protected override bossHome() {
    return E.home;
  }
  override walls() {
    return [];
  }
  protected override pattern() {
    return emberwingPattern(this.raid.phase, this.raid.trait);
  }
  protected override alwaysExposed() {
    return !!this.raid.permanentGround;
  }
  protected override setupArena() {
    this.arenaId = "sky-terrace";
    this.raid.pillars = [];
    this.raid.braziers = E.braziers.map((p) => ({
      ...p,
      progress: 0,
      litUntil: 0,
    }));
    this.raid.groundings = 0;
    this.raid.quickGroundings = 0;
    this.raid.chapterGroundings = 0;
    this.raid.permanentGround = false;
    this.clearAttacks();
  }
  protected override clearAttacks() {
    super.clearAttacks();
    const r = this.raid;
    r.airborne = false;
    r.takeoffAt = undefined;
    r.emberDive = undefined;
    r.emberPatches = [];
    r.emberTrails = [];
    r.flameRings = [];
    r.emberFeathers = [];
    r.braziers?.forEach((p) => {
      p.progress = 0;
      p.litUntil = 0;
    });
    this.brazierTargets.clear();
    this.ringStruck.clear();
    this.floorAt.clear();
    this.ringHits.clear();
  }
  protected override onChapter() {
    this.raid.chapterGroundings = 0;
    this.raid.permanentGround = false;
    this.clearAttacks();
  }
  override feat() {
    return (
      this.raid.result === "victory" && (this.raid.quickGroundings ?? 0) >= 3
    );
  }
  protected override finishMessage(won: boolean) {
    return won
      ? "The sky grows quiet. Emberwing lands at your feet."
      : "The terrace still burns. Light the braziers and try again.";
  }
  private takeoff() {
    const r = this.raid;
    r.airborne = true;
    r.takeoffAt = this.time;
    r.braziers?.forEach((b) => {
      b.progress = 0;
      b.litUntil = 0;
    });
    r.message = "Emberwing takes flight! Light all three braziers together.";
  }
  private ground() {
    const r = this.raid;
    if (!r.airborne) return;
    r.airborne = false;
    this.brazierTargets.clear();
    r.groundings = (r.groundings ?? 0) + 1;
    r.chapterGroundings = (r.chapterGroundings ?? 0) + 1;
    if (this.time - (r.takeoffAt ?? this.time) <= 20)
      r.quickGroundings = (r.quickGroundings ?? 0) + 1;
    r.permanentGround =
      r.phase === 3 && (r.chapterGroundings ?? 0) >= 2 && !r.drill;
    r.exposedUntil = this.time + E.expose + (r.trait === "updraft" ? 2 : 0);
    r.stagger = 0;
    r.staggerUntil = 0;
    r.emberPatches = (r.emberPatches ?? [])
      .map((p) => ({ ...p, radius: p.radius * 0.45 }))
      .filter((p) => p.radius >= 30);
    r.emberTrails = [];
    r.warnings = [];
    this.charging = undefined;
    r.emberDive = undefined;
    r.flameRings = [];
    this.ringHits.clear();
    this.ringStruck.clear();
    if (r.drill === "brazier-lighting" && r.drillStats) r.drillStats.dodges++;
    r.message = r.permanentGround
      ? "WINGS BROKEN! The heart stays open — finish the fight!"
      : "GROUNDED! Fire shrinks — strike the exposed heart!";
    this.nextAttack = r.exposedUntil + 0.8;
    this.floorAt.clear();
    this.event("raid-impact", this.boss()!, 0xffce75, undefined, r.bossId);
    this.events[this.events.length - 1].raidRadius = 150;
  }
  override damage(
    target: Fighter,
    amount: number,
    owner: string,
    ability?: Ability,
  ) {
    if (target.raidBoss && this.raid.airborne) {
      if (ability?.kind === "melee" || ability?.ground) return;
      if (ability?.id !== "starfall-spray") amount *= 0.5;
    }
    super.damage(target, amount, owner, ability);
  }
  private light(index: number, by: Fighter) {
    const b = this.raid.braziers?.[index];
    if (!b || b.litUntil > this.time) return;
    b.progress = 1;
    b.litUntil =
      this.time +
      brazierLifetime(this.raid.partySize, this.raid.phase, this.raid.peril);
    if (!this.raid.drill && this.raid.contributions?.[by.id])
      this.raid.contributions[by.id].pillars++;
    this.event("heal", b, 0xffd778, 0, by.id);
  }
  private water(x: number, y: number, radius: number) {
    this.raid.emberPatches = (this.raid.emberPatches ?? []).filter(
      (p) => Math.hypot(p.x - x, p.y - y) > p.radius + radius,
    );
    this.raid.emberTrails = (this.raid.emberTrails ?? []).filter(
      (p) =>
        segmentDistance({ x, y }, p, { x: p.tx, y: p.ty }) > p.width + radius,
    );
  }
  override cast(p: Fighter, a: Ability, ex = false) {
    super.cast(p, a, ex);
    if (p.raidBoss || p.hp <= 0) return;
    if (a.id === "whirlpool") {
      const aim = p.lastInput,
        d = normalize(aim.aimX - p.x, aim.aimY - p.y),
        length = Math.min(a.range, Math.hypot(aim.aimX - p.x, aim.aimY - p.y));
      this.water(p.x + d.x * length, p.y + d.y * length, a.radius);
    }
    if (
      a.id === "blaze-whirl" &&
      (this.raid.airborne || this.raid.drill === "brazier-lighting")
    )
      this.raid.braziers?.forEach((b, i) => {
        if (Math.hypot(b.x - p.x, b.y - p.y) <= a.radius + E.brazierRadius)
          this.light(i, p);
      });
  }
  protected override canStartAttack() {
    return (
      !this.charging &&
      (this.raid.permanentGround || this.raid.exposedUntil <= this.time)
    );
  }
  protected override startAttack(kind: RaidAttack, target: Fighter) {
    const r = this.raid,
      boss = this.boss()!;
    if (kind === "brazier-lighting") {
      if (!r.airborne && r.exposedUntil <= this.time) this.takeoff();
      return;
    }
    const seen = this.seenAttacks.get(kind) ?? 0;
    this.seenAttacks.set(kind, seen + 1);
    const teach = seen < 2;
    boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);
    if (kind === "dive-bomb")
      this.warn(
        kind,
        boss.x,
        boss.y,
        target.x,
        target.y,
        E.dive.width,
        E.dive.delay,
      ).teach = teach;
    else if (kind === "ember-rain") {
      const alive = this.heroes().filter((p) => p.hp > 0),
        count =
          r.trait === "smouldering"
            ? 3
            : Math.min(9, 4 + r.peril + alive.length);
      const spots: { x: number; y: number }[] = [];
      for (let i = 0; i < count; i++) {
        const hero = alive[i % alive.length] ?? target,
          a = i * 2.39996 + (r.seed % 6),
          radius = i < alive.length ? 0 : 125 + (i % 2) * 60;
        const p = {
          x: Math.max(100, Math.min(1500, hero.x + Math.cos(a) * radius)),
          y: Math.max(100, Math.min(800, hero.y + Math.sin(a) * radius)),
        };
        if (
          spots.some(
            (q) => Math.hypot(q.x - p.x, q.y - p.y) < E.rain.radius * 1.8,
          )
        )
          continue;
        spots.push(p);
        this.warn(
          kind,
          p.x,
          p.y,
          p.x,
          p.y,
          E.rain.radius,
          E.rain.delay + i * 0.18,
        ).teach = teach;
      }
    } else if (kind === "wing-gust")
      Object.assign(
        this.warn(
          kind,
          boss.x,
          boss.y,
          target.x,
          target.y,
          E.gust.radius,
          E.gust.delay,
        ),
        { spread: E.gust.spread, teach },
      );
    else if (kind === "flame-ring")
      this.warn(kind, boss.x, boss.y, boss.x, boss.y, 80, E.ring.delay).teach =
        teach;
    else if (kind === "scorched-earth")
      this.warn(
        kind,
        target.x,
        target.y,
        target.x,
        target.y,
        E.fire.initialRadius,
        1.4,
      ).teach = teach;
    else if (kind === "heat-mark") {
      const alive = this.heroes().filter((p) => p.hp > 0),
        index = alive.indexOf(target),
        count = Math.min(alive.length, r.phase >= 3 ? 3 : 2);
      for (let i = 0; i < count; i++) {
        const p = alive[(Math.max(0, index) + i) % alive.length];
        Object.assign(
          this.warn(kind, p.x, p.y, p.x, p.y, E.heat.radius, E.heat.seconds),
          { targetId: p.id, teach },
        );
      }
    }
  }
  protected override followWarnings(boss: Fighter) {
    super.followWarnings(boss);
    for (const w of this.raid.warnings)
      if (w.kind === "heat-mark") {
        const p = this.heroes().find((p) => p.id === w.targetId && p.hp > 0);
        if (p) {
          w.x = w.tx = p.x;
          w.y = w.ty = p.y;
        }
      }
  }
  protected override resolveWarning(w: RaidWarning, boss: Fighter) {
    const r = this.raid;
    if (w.kind === "dive-bomb") {
      this.charging = {
        tx: w.tx,
        ty: w.ty,
        until: this.time + E.dive.seconds,
        hit: new Set(),
      };
      r.emberDive = {
        x: w.x,
        y: w.y,
        tx: w.tx,
        ty: w.ty,
        startedAt: this.time,
        until: this.time + E.dive.seconds,
      };
      (r.emberTrails ??= []).push({
        x: w.x,
        y: w.y,
        tx: w.tx,
        ty: w.ty,
        until: this.time + E.dive.trailSeconds,
        width: w.radius,
      });
      return;
    }
    if (w.kind === "flame-ring") {
      (r.flameRings ??= []).push({
        id: ++this.serial,
        x: w.x,
        y: w.y,
        radius: 0,
        startedAt: this.time,
      });
      return;
    }
    if (w.kind === "scorched-earth") {
      (r.emberPatches ??= []).push({
        id: ++this.serial,
        x: w.x,
        y: w.y,
        radius: w.radius,
        until: this.time + (r.trait === "smouldering" ? 42 : E.fire.seconds),
        growAt: this.time + (r.phase === 3 ? 7 : 10),
      });
      r.emberPatches = r.emberPatches.slice(-12);
      return;
    }
    if (
      w.kind === "heat-mark" &&
      !this.heroes().some((p) => p.id === w.targetId && p.hp > 0)
    )
      return;
    this.hitBy = w.kind;
    for (const p of this.heroes()) {
      if (p.hp <= 0) continue;
      if (w.kind === "wing-gust") {
        if (!this.inVolley({ ...w, kind: "volley" }, p)) continue;
        const dir = normalize(w.tx - w.x, w.ty - w.y),
          resist =
            p.dashUntil > this.time &&
            p.lastInput.dx * dir.x + p.lastInput.dy * dir.y < -0.25;
        this.damage(p, E.gust.damage, boss.id);
        if (!resist)
          move(p, dir.x * E.gust.push, dir.y * E.gust.push, RULES.radius, this.walls());
      } else if (
        (w.kind === "heat-mark" || w.kind === "ember-rain") &&
        Math.hypot(p.x - w.x, p.y - w.y) < w.radius + RULES.radius
      )
        this.damage(
          p,
          w.kind === "heat-mark" ? E.heat.damage : E.rain.damage,
          boss.id,
        );
    }
    this.hitBy = undefined;
    this.countDodges();
    this.event("raid-impact", w, 0xffa56b, undefined, boss.id);
    this.events[this.events.length - 1].raidRadius = w.radius;
  }
  protected override bossStep(dt: number, boss: Fighter) {
    const r = this.raid;
    if (this.charging) {
      const c = this.charging,
        before = { x: boss.x, y: boss.y },
        d = normalize(c.tx - boss.x, c.ty - boss.y),
        amount = Math.min(2400 * dt, Math.hypot(c.tx - boss.x, c.ty - boss.y));
      boss.x += d.x * amount;
      boss.y += d.y * amount;
      this.hitBy = "dive-bomb";
      for (const p of this.heroes())
        if (
          p.hp > 0 &&
          !c.hit.has(p.id) &&
          segmentDistance(p, before, boss) < E.dive.width + RULES.radius
        ) {
          c.hit.add(p.id);
          const mirror = p.character === "auralynx" && this.has(p, "counter");
          this.damage(p, E.dive.damage, boss.id);
          if (mirror) {
            r.stagger = Math.min(100, r.stagger + 20);
            r.message = "Mirror Guard reflects the dive! +20 stagger";
          }
        }
      this.hitBy = undefined;
      if (
        this.time >= c.until ||
        Math.hypot(boss.x - c.tx, boss.y - c.ty) < 5
      ) {
        this.struck = new Set(c.hit);
        this.countDodges();
        this.charging = undefined;
        r.emberDive = undefined;
        if (r.trait === "molting" && !r.drill)
          (r.emberFeathers ??= []).push({
            id: ++this.serial,
            x: Math.max(90, Math.min(1510, boss.x - d.y * 85)),
            y: Math.max(90, Math.min(810, boss.y + d.x * 85)),
            until: this.time + 10,
          });
      }
      return;
    }
    if (r.exposedUntil > this.time && !r.permanentGround) return;
    const x =
        E.home.x + Math.sin(this.phaseElapsed * 0.18) * (r.airborne ? 170 : 75),
      y =
        E.home.y + Math.sin(this.phaseElapsed * 0.27) * (r.airborne ? 35 : 40);
    const d = normalize(x - boss.x, y - boss.y),
      amount = Math.min(
        (r.airborne ? 65 : 45) * dt,
        Math.hypot(x - boss.x, y - boss.y),
      );
    boss.x += d.x * amount;
    boss.y += d.y * amount;
  }
  protected override worldStep(dt: number, boss: Fighter) {
    const r = this.raid;
    if (r.airborne && r.staggerUntil > this.time) this.ground();
    if (
      !r.airborne &&
      !r.permanentGround &&
      r.exposedUntil <= this.time &&
      (r.phase >= 2 || r.drill === "brazier-lighting") &&
      !this.charging
    )
      this.takeoff();
    if (
      r.airborne &&
      this.time >= (r.takeoffAt ?? 0) + (r.trait === "updraft" ? 2 : 0)
    ) {
      for (const [i, b] of (r.braziers ?? []).entries()) {
        if (b.litUntil > this.time) continue;
        if (b.litUntil) {
          b.litUntil = 0;
          b.progress = 0;
        }
        const occupants = this.heroes().filter(
          (p) =>
            p.hp > 0 &&
            Math.hypot(p.x - b.x, p.y - b.y) <= E.brazierRadius &&
            !this.has(p, "sleep"),
        );
        const lighter =
          occupants.find((p) => this.hasRite(p, "fireproof")) ?? occupants[0];
        if (lighter) {
          b.progress = Math.min(
            1,
            b.progress +
              dt /
                (E.lightSeconds *
                  (this.hasRite(lighter, "fireproof") ? 0.5 : 1)),
          );
          if (b.progress >= 1) this.light(i, lighter);
        } else b.progress = 0;
      }
      if (
        r.braziers?.length === 3 &&
        r.braziers.every((b) => b.litUntil > this.time)
      )
        this.ground();
    }
    // Cindrake's moving whirlwind can light a brazier as it passes.
    for (const z of this.zones) {
      const p = this.heroes().find((p) => p.id === z.owner && p.hp > 0);
      if (!p) continue;
      if (z.ability.id === "blaze-whirl" && r.airborne)
        r.braziers?.forEach((b, i) => {
          if (Math.hypot(b.x - z.x, b.y - z.y) <= z.radius + E.brazierRadius)
            this.light(i, p);
        });
      if (z.ability.id === "whirlpool") this.water(z.x, z.y, z.radius);
    }
    r.emberPatches = (r.emberPatches ?? []).filter((p) => p.until > this.time);
    for (const p of r.emberPatches)
      if (this.time >= p.growAt) {
        p.radius = Math.min(E.fire.maxRadius, p.radius + E.fire.growth);
        p.growAt = this.time + (r.phase === 3 ? 7 : 10);
      }
    r.emberTrails = (r.emberTrails ?? []).filter((p) => p.until > this.time);
    this.hitBy = "scorched-earth";
    for (const p of this.heroes()) {
      if (p.hp <= 0) continue;
      const burning =
        r.emberPatches.some(
          (f) => Math.hypot(f.x - p.x, f.y - p.y) < f.radius + RULES.radius,
        ) ||
        r.emberTrails.some(
          (f) =>
            segmentDistance(p, f, { x: f.tx, y: f.ty }) <
            f.width + RULES.radius,
        );
      if (burning && p.jumpUntil <= this.time) {
        const at = this.floorAt.get(p.id) ?? this.time;
        this.floorAt.set(p.id, at);
        if (this.time - at >= 0.5) {
          this.damage(
            p,
            E.fire.damage *
              Math.min(0.55, this.time - at) *
              (this.hasRite(p, "fireproof") ? 0.5 : 1),
            boss.id,
          );
          this.floorAt.set(p.id, this.time);
        }
      } else this.floorAt.delete(p.id);
    }
    this.hitBy = undefined;
    for (const ring of r.flameRings ?? []) {
      const before = ring.radius;
      ring.radius = (this.time - ring.startedAt) * E.ring.speed;
      const hits = this.ringHits.get(ring.id) ?? new Set<string>();
      const struck = this.ringStruck.get(ring.id) ?? new Set<string>();
      this.ringStruck.set(ring.id, struck);
      this.ringHits.set(ring.id, hits);
      for (const p of this.heroes()) {
        const distance = Math.hypot(p.x - ring.x, p.y - ring.y);
        if (
          p.hp <= 0 ||
          hits.has(p.id) ||
          distance < before - E.ring.width ||
          distance > ring.radius + E.ring.width + RULES.radius
        )
          continue;
        hits.add(p.id);
        if (p.jumpUntil > this.time) continue;
        struck.add(p.id);
        this.hitBy = "flame-ring";
        this.damage(p, E.ring.damage, boss.id);
        this.hitBy = undefined;
      }
      if (ring.radius > E.ring.maxRadius) {
        this.struck = new Set(struck);
        this.countDodges();
        this.ringHits.delete(ring.id);
        this.ringStruck.delete(ring.id);
      }
    }
    r.flameRings = (r.flameRings ?? []).filter(
      (p) => p.radius <= E.ring.maxRadius,
    );
    r.emberFeathers = (r.emberFeathers ?? []).filter((f) => {
      if (f.until <= this.time) return false;
      const p = this.heroes().find(
        (p) => p.hp > 0 && Math.hypot(p.x - f.x, p.y - f.y) < 42,
      );
      if (!p) return true;
      p.ult = Math.min(100, (p.ult ?? 0) + 10);
      this.event("orb", p, 0xffd778, 10, p.id);
      return false;
    });
  }
  protected override botHint(
    bot: Fighter,
    input: Input,
    go: (x: number, y: number, away: boolean) => Input,
  ): Input | undefined {
    const r = this.raid;
    const mark = r.warnings.find(
      (w) =>
        w.kind === "heat-mark" &&
        w.targetId !== bot.id &&
        Math.hypot(w.x - bot.x, w.y - bot.y) < w.radius + 80,
    );
    if (mark) return go(mark.x, mark.y, true);
    const dive = r.warnings.find(
      (w) =>
        w.kind === "dive-bomb" &&
        segmentDistance(bot, w, { x: w.tx, y: w.ty }) <
          w.radius + RULES.radius + 30,
    );
    if (dive) {
      const d = normalize(dive.tx - dive.x, dive.ty - dive.y);
      return go(bot.x - d.y * 120, bot.y + d.x * 120, false);
    }
    for (const ring of r.flameRings ?? [])
      if (
        Math.abs(Math.hypot(bot.x - ring.x, bot.y - ring.y) - ring.radius) < 100
      )
        input.jump = true;
    if (r.airborne) {
      const unlit = (r.braziers ?? [])
        .map((b, i) => ({ ...b, index: i }))
        .filter((b) => b.litUntil <= this.time);
      const seat = this.heroes()
        .filter((p) => p.hp > 0)
        .findIndex((p) => p.id === bot.id);
      for (const [id, index] of this.brazierTargets)
        if (
          !this.heroes().some((p) => p.id === id && p.hp > 0) ||
          !unlit.some((b) => b.index === index)
        )
          this.brazierTargets.delete(id);
      let target = unlit.find(
        (b) => b.index === this.brazierTargets.get(bot.id),
      );
      if (!target) {
        const available = unlit.filter(
          (b) => ![...this.brazierTargets.values()].includes(b.index),
        );
        const candidates = available.length ? available : unlit;
        target =
          candidates.find((b) => r.partySize > 1 && b.index === seat % 3) ??
          [...candidates].sort(
            (a, b) =>
              Math.hypot(a.x - bot.x, a.y - bot.y) -
              Math.hypot(b.x - bot.x, b.y - bot.y),
          )[0];
        if (target) this.brazierTargets.set(bot.id, target.index);
      }
      if (target) {
        input.basic = false;
        input.skill = -1;
        input.dash = false;
        if (
          Math.hypot(bot.x - target.x, bot.y - target.y) >
          E.brazierRadius * 0.5
        )
          return go(target.x, target.y, false);
        input.dx = input.dy = 0;
        return input;
      }
    }
    const fire = r.emberPatches?.find(
      (f) => Math.hypot(f.x - bot.x, f.y - bot.y) < f.radius + 60,
    );
    if (fire) return go(fire.x, fire.y, true);
    return undefined;
  }
}
