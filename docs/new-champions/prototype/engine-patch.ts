/**
 * Simulation-only prototype of the engine changes the new champions need,
 * applied to the real server Arena and bot at runtime. Nothing here touches the
 * repository. Each block mirrors what the real change in simulation.ts would do.
 */
import {
  CHARACTERS,
  COMBOS,
  RITES,
  RITE_BY_ID,
  RULES,
  blocked,
  type Ability,
  type Fighter,
} from "../../../packages/shared/src/index.ts";
import { Arena } from "../../../apps/server/src/simulation.ts";
import { BotBrain } from "../../../apps/server/src/bot.ts";
import { NEW_CHARACTERS, NEW_COMBOS, NEW_RITES } from "./new-champions.ts";

// ---- Register the champions exactly where the real code would look them up.
Object.assign(CHARACTERS, NEW_CHARACTERS);
Object.assign(COMBOS, NEW_COMBOS);
for (const r of NEW_RITES) {
  RITES.push(r);
  RITE_BY_ID[r.id] = r;
}

type A = Arena & Record<string, any>;
const proto = Arena.prototype as any;

// ---- 1. Pull: negative knockback, clamped so the target stops in front of the caster.
const damage0 = proto.damage;
proto.damage = function (
  this: A,
  target: Fighter,
  amount: number,
  owner: string,
  ability?: Ability,
) {
  const src = this.players.find((p: Fighter) => p.id === owner);
  // 6. farBonus (Piper): more damage the farther the target is, up to the ability's range.
  const far = (ability as any)?.farBonus;
  if (far && src && amount > 0) {
    const dist = Math.hypot(target.x - src.x, target.y - src.y);
    amount *= 1 + far * Math.min(1, dist / ability!.range);
  }
  // 8. ambush (Riki): the first hit out of stealth is stronger.
  const amb = src && ambushes.get(src);
  if (amb && amount > 0 && this.time <= amb.until && target !== src) {
    amount *= amb.mult;
    ambushes.delete(src);
    ambushHits++;
  }
  if (ability && ability.knockback < 0) {
    const source = src;
    if (source) {
      const dist = Math.hypot(target.x - source.x, target.y - source.y);
      const room = Math.max(0, dist - RULES.radius * 2 - 6);
      if (-ability.knockback > room)
        ability = { ...ability, knockback: -room };
    }
  }
  return damage0.call(this, target, amount, owner, ability);
};

// ---- 2-4. New kinds handled after the normal cast (which already strips
// stealth, fires the cast event and sets self-combo marks).
// Keyed by the live fighter/zone objects, so two rooms in one process never share state.
const rushes = new Map<Fighter, { until: number; a: Ability }>();
const ambushes = new WeakMap<Fighter, { mult: number; until: number }>();
export let ambushHits = 0, wallSlams = 0;
const cast0 = proto.cast;
proto.cast = function (this: A, p: Fighter, a: Ability, ex = false) {
  // Casting while stealthed arms the ambush bonus for the hit this cast produces.
  if (this.has(p, "stealth")) {
    const veil = this.kit(p).skills.find((k: any) => k.kind === "veil" && k.ambush);
    if (veil) ambushes.set(p, { mult: (veil as any).ambush, until: this.time + 0.8 });
  }
  cast0.call(this, p, a, ex);
  if (p.hp <= 0 || p.out) return;
  const kind = a.kind as string;
  if (kind === "veil") {
    this.status(p, "stealth", a.duration);
    this.status(p, "haste", a.statusDuration ?? 1.5);
  }
  if (kind === "blink") {
    const aim = p.lastInput;
    const want = Math.min(a.range, Math.hypot(aim.aimX - p.x, aim.aimY - p.y));
    const dx = Math.cos(p.angle),
      dy = Math.sin(p.angle);
    this.walls();
    let x = p.x,
      y = p.y;
    for (let d = 8; d <= want; d += 8) {
      const nx = p.x + dx * d,
        ny = p.y + dy * d;
      if (blocked(nx, ny, RULES.radius)) break;
      x = nx;
      y = ny;
    }
    p.x = x;
    p.y = y;
    p.vx = p.vy = 0;
    if (a.damage > 0)
      for (const e of this.enemiesOf(p))
        if (
          e.hp > 0 &&
          Math.hypot(e.x - p.x, e.y - p.y) < a.radius + RULES.radius &&
          this.lineClear(p, e)
        )
          this.damage(e, a.damage, p.id, a);
  }
  if (kind === "rush") {
    const t = a.range / a.speed;
    p.dashX = Math.cos(p.angle) * a.speed;
    p.dashY = Math.sin(p.angle) * a.speed;
    p.dashUntil = this.time + t;
    p.recoveryUntil = Math.max(p.recoveryUntil, this.time + t);
    rushes.set(p, { until: this.time + t, a });
  }
};

// ---- 5. Heal zones, and rush contact, once per tick after the normal step.
const healNext = new WeakMap<object, number>();
const tick0 = proto.tick;
proto.tick = function (this: A, ...args: unknown[]) {
  const out = tick0.apply(this, args);
  for (const [p, r] of rushes) {
    if (!this.players.includes(p)) continue;
    if (p.hp <= 0 || this.time > r.until) {
      rushes.delete(p);
      continue;
    }
    const hit = this.enemiesOf(p).find(
      (e: Fighter) =>
        e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < RULES.radius * 2 + 10,
    );
    if (!hit) continue;
    rushes.delete(p);
    p.dashUntil = this.time;
    p.vx = p.vy = 0;
    const victims = r.a.explosion
      ? this.enemiesOf(p).filter(
          (e: Fighter) =>
            e.hp > 0 &&
            Math.hypot(e.x - hit.x, e.y - hit.y) < r.a.explosion! + RULES.radius,
        )
      : [hit];
    // 7. wallSlam (Reinhardt): would the knockback drive the target into a wall?
    let main = r.a;
    const slam = (r.a as any).wallSlam;
    if (slam) {
      this.walls();
      const len = Math.hypot(hit.x - p.x, hit.y - p.y) || 1;
      const dx = (hit.x - p.x) / len, dy = (hit.y - p.y) / len;
      for (let d = 10; d <= r.a.knockback; d += 10)
        if (blocked(hit.x + dx * d, hit.y + dy * d, RULES.radius)) {
          main = { ...r.a, damage: r.a.damage * slam, statusDuration: (r.a.statusDuration ?? 0.35) * 2 };
          wallSlams++;
          break;
        }
    }
    for (const v of victims) this.damage(v, v === hit ? main.damage : r.a.damage, p.id, v === hit ? main : r.a);
  }
  for (const z of this.zones) {
    if (!z.ability.heal || z.ability.kind !== "zone") continue;
    let next = healNext.get(z);
    if (next === undefined) next = this.time - 1 / RULES.tick + (z.ability.tickDelay ?? 0.35);
    while (this.time >= next) {
      next += z.ability.tickInterval ?? 0.5;
      const owner = this.players.find((q: Fighter) => q.id === z.owner);
      if (!owner) break;
      for (const ally of this.players)
        if (
          ally.hp > 0 &&
          !ally.out &&
          this.teamOf(ally) === this.teamOf(owner) &&
          Math.hypot(ally.x - z.x, ally.y - z.y) < z.radius + RULES.radius
        ) {
          const before = ally.hp;
          const amount = z.ability.heal * (ally.id === owner.id ? ((z.ability as any).selfHeal ?? 1) : 1);
          ally.hp = Math.min(CHARACTERS[ally.character].health, ally.hp + amount);
          ally.stats.healed = (ally.stats.healed ?? 0) + (ally.hp - before);
        }
    }
    healNext.set(z, next);
  }
  return out;
};

// ---- Bots: score new kinds as their nearest existing kind (sim only; a real
// release would add cases to BotBrain.chooseSkill).
let viewFor: string | null = null;
const kit0 = proto.kit;
proto.kit = function (this: A, p: Fighter) {
  const kit = kit0.call(this, p);
  if (viewFor !== p.id) return kit;
  const max = CHARACTERS[p.character].health;
  const mapped = kit.skills.map((a: Ability) => {
    const kind = a.kind as string;
    if (kind === "rush" || kind === "blink")
      return { ...a, kind: "melee", range: a.range * 0.9, damage: Math.max(a.damage, 12) };
    if (kind === "veil") return { ...a, kind: "buff" };
    if (a.heal && a.kind === "zone")
      return a.follow
        ? { ...a, kind: "nova", damage: 30, radius: a.radius }
        : p.hp / max < 0.8
          ? { ...a, kind: "barrier" }
          : { ...a, kind: "none" };
    return a;
  });
  return { basic: kit.basic, skills: mapped };
};
const choose0 = (BotBrain.prototype as any).chooseSkill;
(BotBrain.prototype as any).chooseSkill = function (
  this: unknown,
  arena: Arena,
  me: Fighter,
  ...rest: unknown[]
) {
  viewFor = me.id;
  try {
    return choose0.call(this, arena, me, ...rest);
  } finally {
    viewFor = null;
  }
};

export function resetPatchState() {
  rushes.clear();
}
