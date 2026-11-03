import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation.js";
import { BotBrain, hostileZone, riteValue } from "../../apps/server/src/bot.js";
import {
  CHARACTERS,
  PRACTICE_GRID,
  RITES,
  RITE_BY_ID,
  RULES,
  blankInput,
  blinkLanding,
  exAbility,
  farMultiplier,
  type Ability,
  type Fighter,
  type MatchMode,
  type Rite,
} from "../../packages/shared/src/index.js";

/** A plain ability to build test moves from (same defaults as the roster's). */
const move = (
  kind: Ability["kind"],
  extra: Partial<Ability> = {},
): Ability => ({
  id: `test-${kind}`,
  name: `Test ${kind}`,
  description: "",
  kind,
  element: "Electric",
  damage: 10,
  cooldown: 8,
  range: 700,
  cast: 0,
  recovery: 0.12,
  speed: 680,
  radius: 13,
  duration: 1,
  ground: false,
  knockback: 0,
  visual: kind,
  sound: kind,
  energyCost: 0,
  ...extra,
});
const arena = (mode: MatchMode = "duel", count = 2) => {
  const a = new Arena("MECHS", mode);
  for (let i = 0; i < count; i++) a.add(`p${i}`, `P${i}`);
  a.start();
  a.phase = "playing";
  a.deadline = 999;
  return a;
};
const place = (p: Fighter, x: number, y: number, aimX = x, aimY = y) => {
  Object.assign(p, { x, y, vx: 0, vy: 0 });
  p.lastInput = { ...blankInput(), aimX, aimY };
  p.angle = Math.atan2(aimY - y, aimX - x);
};
const gap = (p: Fighter, q: Fighter) => Math.hypot(q.x - p.x, q.y - p.y);
const ticks = (a: Arena, n: number) => {
  for (let i = 0; i < n; i++) a.tick();
};
const full = CHARACTERS.voltkit.health;

/** Swap the test fighter's (Voltkit's) skills for a test kit, restored after each test. */
const original = CHARACTERS.voltkit.skills;
const useKit = (skills: Ability[]) => {
  CHARACTERS.voltkit.skills = skills;
};
afterEach(() => {
  CHARACTERS.voltkit.skills = original;
});

describe("pull (negative knockback)", () => {
  const lash = move("projectile", {
    damage: 14,
    speed: 1000,
    range: 560,
    radius: 12,
    knockback: -600,
  });
  it("drags the target right up to the caster, never past", () => {
    const a = arena(),
      [p, q] = a.players;
    place(p, 200, 150, 600, 150);
    place(q, 600, 150);
    a.cast(p, lash);
    ticks(a, 20);
    expect(q.hp).toBe(full - 14);
    // Stopped just in front: two body radii and a small gap apart.
    expect(gap(p, q)).toBeCloseTo(RULES.radius * 2 + 6, 0);
    expect(q.x).toBeGreaterThan(p.x);
  });
  it("doesn't move a target already up close", () => {
    const a = arena(),
      [p, q] = a.players;
    place(p, 200, 150, 400, 150);
    place(q, 248, 150);
    a.cast(p, move("melee", { range: 150, arc: 0.3, knockback: -600 }));
    expect(q.hp).toBe(full - 10);
    expect(q.x).toBe(248);
  });
  it("a pulling zone that follows the caster drags enemies in tick by tick", () => {
    const a = arena(),
      [p, q] = a.players;
    place(p, 300, 150);
    place(q, 520, 150);
    a.cast(
      p,
      move("zone", {
        damage: 7,
        radius: 250,
        range: 0,
        follow: true,
        duration: 2,
        tickDelay: 0.2,
        tickInterval: 0.4,
        knockback: -70,
      }),
    );
    ticks(a, 8);
    // One tick in: 70 px closer.
    expect(gap(p, q)).toBeCloseTo(150, 0);
    ticks(a, 60);
    expect(gap(p, q)).toBeGreaterThanOrEqual(RULES.radius * 2 + 6 - 0.01);
    expect(gap(p, q)).toBeLessThan(RULES.radius * 2 + 7);
  });
  it("still pushes with positive knockback", () => {
    const a = arena(),
      [p, q] = a.players;
    place(p, 200, 150, 300, 150);
    place(q, 300, 150);
    a.cast(p, move("melee", { range: 150, arc: 0.3, knockback: 80 }));
    expect(q.x).toBeCloseTo(380, 0);
  });
});

describe("blink", () => {
  const hop = move("blink", { range: 300, radius: 90, knockback: 40 });
  it("teleports toward the aim, up to its range", () => {
    const a = arena(),
      [p] = a.players;
    place(p, 200, 150, 380, 150);
    p.vx = 200;
    a.cast(p, hop);
    expect([p.x, p.y]).toEqual([380, 150]);
    expect(p.vx).toBe(0);
    place(p, 200, 150, 1200, 150);
    a.cast(p, hop);
    expect(p.x).toBeCloseTo(500, 6);
  });
  it("stops before a wall instead of passing through it", () => {
    const a = arena(),
      [p] = a.players;
    // The centre block spans x 750-850 at this height.
    place(p, 300, 450, 1300, 450);
    a.cast(p, { ...hop, range: 600 });
    expect(p.x).toBeLessThan(750 - RULES.radius + 1);
    expect(p.x).toBeGreaterThan(700);
    expect(blinkLanding({ x: 300, y: 450 }, 0, 600)).toEqual({
      x: p.x,
      y: p.y,
    });
  });
  it("bursts where it lands, and the client learns where it left from", () => {
    const a = arena("ffa", 3),
      [p, near, far] = a.players;
    place(p, 200, 150, 500, 150);
    place(near, 560, 150);
    place(far, 900, 150);
    a.cast(p, hop);
    expect(near.hp).toBe(full - 10);
    expect(far.hp).toBe(full);
    const burst = a.events.find(
      (e) => e.kind === "burst" && e.abilityId === hop.id,
    )!;
    expect([burst.x, burst.y, burst.tx, burst.ty]).toEqual([
      500, 150, 200, 150,
    ]);
  });
});

describe("rush", () => {
  const charge = move("rush", {
    damage: 16,
    range: 380,
    speed: 1100,
    knockback: 160,
    status: "stun",
    statusDuration: 0.35,
    wallSlam: 1.5,
  });
  it("charges, hits the first enemy it touches and stops there", () => {
    const a = arena(),
      [p, q] = a.players;
    place(p, 200, 150, 600, 150);
    place(q, 450, 150);
    a.cast(p, charge);
    // Can't act until the charge is over.
    expect(p.recoveryUntil).toBeGreaterThanOrEqual(a.time + 380 / 1100 - 1e-9);
    ticks(a, 12);
    expect(q.hp).toBe(full - 16);
    expect(q.statuses.some((s) => s.kind === "stun")).toBe(true);
    expect(p.x).toBeLessThan(450);
    expect(p.dashUntil).toBeLessThanOrEqual(a.time);
    const hits = a.events.filter((e) => e.kind === "hit" && e.target === q.id);
    expect(hits).toHaveLength(1);
    // The landing is a burst at the target, without a wall slam in the open.
    expect(a.events.some((e) => e.kind === "burst" && !e.slam)).toBe(true);
  });
  it("drives a target into a wall for a slam: more damage, a longer stun", () => {
    const a = arena(),
      [p, q] = a.players;
    place(p, 1200, 150, 1600, 150);
    place(q, 1450, 150);
    a.cast(p, charge);
    ticks(a, 12);
    expect(q.hp).toBe(full - 24);
    const stun = q.statuses.find((s) => s.kind === "stun")!;
    expect(stun.until - a.time).toBeGreaterThan(0.35);
    expect(a.events.some((e) => e.kind === "burst" && e.slam)).toBe(true);
  });
  it("misses cleanly when nobody is in the way", () => {
    const a = arena(),
      [p, q] = a.players;
    place(p, 200, 150, 600, 150);
    place(q, 600, 700);
    a.cast(p, charge);
    ticks(a, 20);
    expect(q.hp).toBe(full);
    // 380 px, then a short coast on its momentum like any dash.
    expect(p.x).toBeGreaterThan(560);
    expect(p.x).toBeLessThan(650);
  });
  it("with an eruption, everyone near the target is hit too", () => {
    const a = arena("ffa", 3),
      [p, q, r] = a.players;
    place(p, 200, 150, 600, 150);
    place(q, 450, 150);
    place(r, 470, 230);
    a.cast(p, { ...charge, explosion: 130, wallSlam: undefined });
    ticks(a, 12);
    expect(q.hp).toBe(full - 16);
    expect(r.hp).toBe(full - 16);
  });
  it("ends when the charger is stunned, or dashes out of it", () => {
    for (const interrupt of ["stun", "dash"] as const) {
      const a = arena(),
        [p, q] = a.players;
      place(p, 200, 150, 600, 150);
      place(q, 450, 150);
      a.cast(p, charge);
      a.tick();
      if (interrupt === "stun") {
        // Someone walks into the stunned charger: no hit.
        a.status(p, "stun", 1);
        a.tick();
        place(q, p.x + 40, p.y);
      } else {
        // A dash down, toward someone standing there: no hit either.
        p.lastInput = { ...p.lastInput, dash: true, dy: 1, dx: 0 };
        place(q, p.x, p.y + 120);
      }
      ticks(a, 8);
      expect(q.hp).toBe(full);
    }
  });
  it("is cancelled by a knockout", () => {
    const a = arena(),
      [p, q] = a.players;
    place(p, 200, 150, 600, 150);
    place(q, 450, 150);
    a.cast(p, charge);
    p.hp = 0;
    ticks(a, 12);
    expect(q.hp).toBe(full);
  });
});

describe("veil (stealth) and ambush", () => {
  const ink = move("veil", {
    damage: 0,
    duration: 2.5,
    statusDuration: 1.5,
    ambush: 1.4,
  });
  const strike = move("melee", { damage: 20, range: 150, arc: 0.3 });
  beforeEach(() => useKit([ink, strike, strike, strike]));
  it("stealths and hastes the caster", () => {
    const a = arena(),
      [p] = a.players;
    a.cast(p, ink);
    expect(a.has(p, "stealth")).toBe(true);
    expect(a.has(p, "haste")).toBe(true);
    ticks(a, 30 * 2);
    expect(a.has(p, "stealth")).toBe(true);
    expect(a.has(p, "haste")).toBe(false);
    ticks(a, 30);
    expect(a.has(p, "stealth")).toBe(false);
  });
  it("the first hit out of stealth is an ambush, only once", () => {
    const a = arena(),
      [p, q] = a.players;
    place(p, 300, 150, 400, 150);
    place(q, 400, 150);
    a.cast(p, ink);
    a.cast(p, strike);
    expect(a.has(p, "stealth")).toBe(false);
    expect(q.hp).toBeCloseTo(full - 28, 6);
    const hit = a.events.filter((e) => e.kind === "hit").at(-1)!;
    expect(hit.ambush).toBe(true);
    a.cast(p, strike);
    expect(q.hp).toBeCloseTo(full - 48, 6);
  });
  it("no ambush once revealed by a hit, or after the moment passes", () => {
    const a = arena(),
      [p, q] = a.players;
    place(p, 300, 150, 400, 150);
    place(q, 400, 150);
    a.cast(p, ink);
    a.damage(p, 5, q.id);
    expect(a.has(p, "stealth")).toBe(false);
    a.cast(p, strike);
    expect(q.hp).toBe(full - 20);
    // Cast out of stealth at nothing; the bonus has gone by the next hit.
    a.cast(p, ink);
    place(q, 900, 150);
    a.cast(p, strike);
    ticks(a, 30);
    place(q, 400, 150);
    a.cast(p, strike);
    expect(q.hp).toBe(full - 40);
  });
});

describe("healing zones", () => {
  const spring = move("zone", {
    damage: 0,
    radius: 130,
    range: 0,
    duration: 3.5,
    tickDelay: 0.25,
    tickInterval: 0.5,
    heal: 4,
    selfHeal: 0.5,
  });
  it("heal the caster's team inside (the caster at its own share), not enemies", () => {
    const a = arena("teams", 4);
    const [p, enemy, ally, outside] = a.players;
    expect([p.team, ally.team, enemy.team]).toEqual([0, 0, 1]);
    place(p, 300, 150);
    place(ally, 360, 150);
    place(enemy, 330, 200);
    place(outside, 900, 700);
    for (const f of a.players) f.hp = 100;
    a.cast(p, spring);
    // Ticks at 0.25 s and 0.75 s.
    ticks(a, 30);
    expect(ally.hp).toBe(108);
    expect(p.hp).toBe(104);
    expect(enemy.hp).toBe(100);
    expect(outside.hp).toBe(100);
    expect(ally.stats.healed).toBe(8);
    // Nothing happens to the enemy at all (no empty hits).
    expect(
      a.events.some((e) => e.kind === "hit" && e.target === enemy.id),
    ).toBe(false);
    const heals = a.events.filter(
      (e) => e.kind === "heal" && e.abilityId === spring.id,
    );
    expect(heals.map((e) => [e.target ?? e.owner, e.value])).toEqual([
      [p.id, 2],
      [ally.id, 4],
      [p.id, 2],
      [ally.id, 4],
    ]);
  });
  it("never heal past full health, and stop when the zone ends", () => {
    const a = arena();
    const [p] = a.players;
    p.hp = full - 1;
    a.cast(p, { ...spring, selfHeal: 1 });
    ticks(a, 30 * 5);
    expect(p.hp).toBe(full);
    expect(a.zones).toHaveLength(0);
  });
  it("a spring that also slows still slows enemies; EX heals more", () => {
    const a = arena();
    const [p, q] = a.players;
    place(p, 300, 150);
    place(q, 350, 150);
    a.cast(p, { ...spring, follow: true, status: "slow", statusDuration: 0.6 });
    ticks(a, 10);
    expect(a.has(q, "slow")).toBe(true);
    expect(exAbility({ ...spring, heal: 7 }).heal).toBe(9);
  });
});

describe("farBonus", () => {
  const focus = move("beam", {
    damage: 20,
    range: 1000,
    radius: 14,
    farBonus: 0.5,
  });
  it("hits harder the farther the target is, up to the full bonus at range", () => {
    expect(farMultiplier(focus, 0)).toBe(1);
    expect(farMultiplier(focus, 500)).toBe(1.25);
    expect(farMultiplier(focus, 2000)).toBe(1.5);
    expect(farMultiplier(move("beam"), 600)).toBe(1);
    for (const [x, dealt] of [
      [200, 21],
      [1090, 29.9],
    ]) {
      const a = arena(),
        [p, q] = a.players;
      place(p, 100, 150, x, 150);
      place(q, x, 150);
      a.cast(p, focus);
      expect(full - q.hp).toBeCloseTo(dealt, 6);
    }
  });
});

describe("bots use the new kinds", () => {
  /** Hard bot `me` facing `you`: does it press skill slot `slot` within a second? */
  const presses = (
    slot: number,
    setup?: (a: Arena, me: Fighter, you: Fighter) => void,
  ) => {
    const a = arena();
    const [me, you] = a.players;
    place(me, 300, 150);
    place(you, 560, 150);
    setup?.(a, me, you);
    const brain = new BotBrain(me.id, "hard", 4);
    for (let i = 0; i < 30; i++) {
      a.time += 1 / 30;
      if (brain.think(a, me).skill === slot) return true;
    }
    return false;
  };
  const idle = move("barrier", { cooldown: 99, damage: 0 });
  it("charges or hops in once the target is within reach, not from afar", () => {
    for (const kind of ["rush", "blink"] as const) {
      useKit([
        move(kind, { range: 380, speed: 1100, damage: 16 }),
        idle,
        idle,
        idle,
      ]);
      expect(presses(0)).toBe(true);
      expect(presses(0, (_, me, you) => place(you, me.x + 800, 150))).toBe(
        false,
      );
    }
  });
  it("slips into stealth when the target is in sight", () => {
    useKit([
      move("veil", { damage: 0, ambush: 1.4, duration: 2.5 }),
      idle,
      idle,
      idle,
    ]);
    expect(presses(0)).toBe(true);
    expect(presses(0, (_, me, you) => place(you, me.x + 800, 150))).toBe(false);
  });
  it("opens a healing spring when hurt and pressed, not at full health", () => {
    const spring = move("zone", {
      damage: 0,
      heal: 4,
      range: 0,
      tickInterval: 0.5,
    });
    useKit([spring, idle, idle, idle]);
    const close = (me: Fighter, you: Fighter) => place(you, me.x + 150, 150);
    expect(
      presses(0, (_, me, you) => {
        me.hp = full * 0.5;
        close(me, you);
      }),
    ).toBe(true);
    expect(presses(0, (_, me, you) => close(me, you))).toBe(false);
  });
  it("keeps out of opponents' zones, not a teammate's or a harmless spring", () => {
    const a = arena("teams", 4);
    const [me, enemy, ally] = a.players;
    const zone = (owner: Fighter, ability: Ability) => ({
      id: 1,
      owner: owner.id,
      x: me.x,
      y: me.y,
      radius: 100,
      until: 99,
      nextTick: 0,
      ability,
      color: 0,
    });
    expect(hostileZone(a, me, zone(enemy, PRACTICE_GRID))).toBe(true);
    expect(hostileZone(a, me, zone(ally, PRACTICE_GRID))).toBe(false);
    expect(hostileZone(a, me, zone(me, PRACTICE_GRID))).toBe(false);
    const spring = move("zone", { damage: 0, heal: 4 });
    expect(hostileZone(a, me, zone(enemy, spring))).toBe(false);
    expect(hostileZone(a, me, zone(enemy, { ...spring, status: "slow" }))).toBe(
      true,
    );
  });
});

describe("rite values for the new mechanics", () => {
  const rites: Rite[] = [];
  const add = (
    skill: string,
    name: string,
    change: Pick<Rite, "mul" | "set">,
    tier: Rite["tier"] = "minor",
  ) => {
    const r: Rite = {
      id: `voltkit-test-${name}`,
      fighter: "voltkit",
      tier,
      skill,
      name,
      text: "",
      ...change,
    };
    rites.push(r);
    RITES.push(r);
    RITE_BY_ID[r.id] = r;
    return r.id;
  };
  afterEach(() => {
    for (const r of rites.splice(0)) {
      RITES.splice(RITES.indexOf(r), 1);
      delete RITE_BY_ID[r.id];
    }
  });
  const value = (id: string, crowd = false) =>
    riteValue(id, { character: "voltkit" }, { character: "voltkit" }, crowd);
  it("values every new mechanic it can be offered", () => {
    useKit([
      move("projectile", {
        id: "t-lash",
        knockback: -600,
        damage: 14,
        cooldown: 12,
      }),
      move("veil", {
        id: "t-ink",
        damage: 0,
        cooldown: 15,
        duration: 2.5,
        ambush: 1.4,
      }),
      move("zone", {
        id: "t-spring",
        damage: 0,
        heal: 4,
        selfHeal: 0.5,
        duration: 3.5,
        tickInterval: 0.5,
        cooldown: 12,
      }),
      move("rush", {
        id: "t-rush",
        damage: 16,
        cooldown: 9,
        wallSlam: 1.5,
        range: 380,
      }),
    ]);
    const ids = [
      add("t-lash", "pull", { mul: { knockback: 1.4 } }),
      add("t-ink", "veil-cooldown", { set: { cooldown: 10 } }, "major"),
      add("t-ink", "veil-duration", { set: { duration: 3.5 } }),
      add("t-spring", "spring-heal", { set: { heal: 6 } }, "major"),
      add("t-spring", "spring-duration", { set: { duration: 5 } }),
      add("t-rush", "rush-cooldown", { set: { cooldown: 6.5 } }, "major"),
    ];
    for (const id of ids) expect(value(id)).toBeGreaterThan(0.1);
    // Faster stealth: 15 s → 10 s is half as much again.
    expect(value(ids[1])).toBeCloseTo(0.5, 6);
    // Healing counts once (not again as a plain heal number).
    expect(value(ids[3])).toBeCloseTo(0.5, 6);
  });
  it("a guard that comes back sooner is worth something too", () => {
    useKit([
      move("barrier", { id: "t-guard", damage: 0, cooldown: 15 }),
      ...original.slice(1),
    ]);
    expect(
      value(add("t-guard", "quick", { set: { cooldown: 10 } })),
    ).toBeCloseTo(0.3, 6);
  });
});
