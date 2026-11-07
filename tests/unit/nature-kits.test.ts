import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation.js";
import { createRaidArena } from "../../apps/server/src/raid-bosses.js";
import {
  CHARACTERS,
  MOSS,
  PLATES,
  RULES,
  STATUS_RULES,
  blankInput,
  platesOf,
  seedStage,
  type Ability,
  type CharacterId,
  type Fighter,
} from "../../packages/shared/src/index.js";

// Pangrove (armour plates, Tongue Grapple, Scale Shrapnel, Curl & Roll,
// Pinball) and Mossloth (moss, Seedling, Sloth Time, Lazy Swap,
// Overgrowth): the mechanics no other champion has.

const arena = (me: CharacterId, them: CharacterId = "voltkit") => {
  const a = new Arena("NATURE", "duel");
  a.add("me", "Me", me);
  a.add("them", "Them", them);
  a.start();
  a.phase = "playing";
  a.deadline = 999;
  return a;
};
const place = (p: Fighter, x: number, y: number, aimX = x + 100, aimY = y) => {
  Object.assign(p, { x, y, vx: 0, vy: 0 });
  p.lastInput = { ...blankInput(), aimX, aimY };
  p.angle = Math.atan2(aimY - y, aimX - x);
};
const ticks = (a: Arena, n: number) => {
  for (let i = 0; i < n; i++) a.tick();
};
const skill = (c: CharacterId, id: string) =>
  CHARACTERS[c].skills.find((k) => k.id === id)!;
/** Open ground, no pillars: the classic arena's middle row at y = 150. */
const Y = 150;

describe("Pangrove's armour plates", () => {
  const hit: Ability = { ...skill("voltkit", "ball-lightning"), explosion: 0, knockback: 0 };
  it("starts with three; a real hit breaks one and is halved", () => {
    const a = arena("pangrove");
    const [me] = a.players;
    expect(platesOf(me)).toBe(PLATES.max);
    const before = me.hp;
    a.damage(me, 20, "them", hit);
    expect(before - me.hp).toBeCloseTo(20 * PLATES.block);
    expect(platesOf(me)).toBe(2);
  });
  it("ignores chip damage and burn ticks (no ability)", () => {
    const a = arena("pangrove");
    const [me] = a.players;
    a.damage(me, 3, "them", hit);
    a.damage(me, 8, "them");
    expect(platesOf(me)).toBe(3);
  });
  it("grow back one at a time once it stops taking damage", () => {
    const a = arena("pangrove");
    const [me] = a.players;
    place(me, 300, Y);
    a.damage(me, 20, "them", hit);
    a.damage(me, 20, "them", hit);
    expect(platesOf(me)).toBe(1);
    ticks(a, Math.round(RULES.tick * (PLATES.regrowDelay - 0.2)));
    expect(platesOf(me)).toBe(1);
    ticks(a, Math.round(RULES.tick * 0.4));
    expect(platesOf(me)).toBe(2);
    ticks(a, Math.round(RULES.tick * PLATES.regrowEvery));
    expect(platesOf(me)).toBe(3);
  });
});

describe("Tongue Grapple", () => {
  it("hits the first enemy along the aim, slows it and zips Pangrove to it", () => {
    const a = arena("pangrove");
    const [me, them] = a.players;
    place(me, 300, Y, 700, Y);
    place(them, 700, Y);
    const hp = them.hp;
    a.cast(me, skill("pangrove", "tongue-grapple"));
    expect(hp - them.hp).toBe(skill("pangrove", "tongue-grapple").damage);
    expect(a.has(them, "slow")).toBe(true);
    ticks(a, 15);
    const gap = Math.hypot(them.x - me.x, them.y - me.y);
    expect(gap).toBeGreaterThan(RULES.radius * 2);
    expect(gap).toBeLessThan(RULES.radius * 2 + 30);
  });
  it("pulls Pangrove to a wall it reaches, and does nothing into empty air", () => {
    const a = arena("pangrove");
    const [me, them] = a.players;
    place(them, 1500, 850);
    // The arena's top edge is 130 px above.
    place(me, 300, Y, 300, 0);
    a.cast(me, skill("pangrove", "tongue-grapple"));
    ticks(a, 15);
    expect(me.y).toBeLessThan(RULES.radius + 10);
    place(me, 800, 820, 300, 820);
    a.cast(me, skill("pangrove", "tongue-grapple"));
    ticks(a, 15);
    expect(me.x).toBeGreaterThan(780);
  });
});

describe("Scale Shrapnel", () => {
  it("fires 3 blades plus 3 per plate and spends every plate", () => {
    const a = arena("pangrove");
    const [me, them] = a.players;
    place(them, 1500, 850);
    place(me, 300, Y, 700, Y);
    a.cast(me, skill("pangrove", "scale-shrapnel"));
    expect(a.projectiles).toHaveLength(12);
    expect(platesOf(me)).toBe(0);
    a.projectiles = [];
    a.cast(me, skill("pangrove", "scale-shrapnel"));
    expect(a.projectiles).toHaveLength(3);
  });
  it("hurts more up close with plates than without", () => {
    const dealt = (plates: number) => {
      const a = arena("pangrove");
      const [me, them] = a.players;
      place(me, 300, Y, 700, Y);
      place(them, 380, Y);
      me.plates = plates;
      const hp = them.hp;
      a.cast(me, skill("pangrove", "scale-shrapnel"));
      ticks(a, 10);
      return hp - them.hp;
    };
    expect(dealt(3)).toBeGreaterThan(dealt(0) * 2);
  });
});

describe("Curl & Roll", () => {
  const roll = (a: Arena, me: Fighter) => {
    a.cast(me, skill("pangrove", "curl-roll"));
    me.lastInput = { ...me.lastInput, dx: 1, dy: 0 };
  };
  it("builds speed on a straight line toward its top speed", () => {
    const a = arena("pangrove");
    const [me, them] = a.players;
    place(them, 1500, 850);
    place(me, 200, Y);
    roll(a, me);
    ticks(a, 6);
    const early = Math.hypot(me.vx, me.vy);
    ticks(a, 24);
    const later = Math.hypot(me.vx, me.vy);
    expect(later).toBeGreaterThan(early * 1.4);
    expect(later).toBeGreaterThan(CHARACTERS.pangrove.speed * 1.7);
    expect(later).toBeLessThanOrEqual(skill("pangrove", "curl-roll").speed + 1);
  });
  it("rams harder at speed, then bounces off", () => {
    const ram = (from: number) => {
      const a = arena("pangrove");
      const [me, them] = a.players;
      place(them, 900, Y);
      place(me, from, Y);
      roll(a, me);
      const hp = them.hp;
      for (let i = 0; i < 120 && them.hp === hp; i++) a.tick();
      return { dealt: hp - them.hp, heading: me.roll!.heading };
    };
    const slow = ram(840),
      fast = ram(300);
    expect(slow.dealt).toBeGreaterThanOrEqual(8);
    expect(fast.dealt).toBeGreaterThan(slow.dealt + 8);
    // Bounced back the way it came.
    expect(Math.cos(fast.heading)).toBeLessThan(0);
  });
  it("takes 30% less damage curled, can't attack, and uncurls when cast again", () => {
    const a = arena("pangrove");
    const [me, them] = a.players;
    place(them, 1500, 850);
    place(me, 300, Y);
    me.plates = 0;
    roll(a, me);
    const hp = me.hp;
    a.damage(me, 20, "them");
    expect(hp - me.hp).toBeCloseTo(14);
    me.lastInput = { ...me.lastInput, basic: true };
    const basics = me.basicAt;
    a.tick();
    expect(me.basicAt).toBe(basics);
    expect(me.roll).toBeDefined();
    a.submit(me, { ...me.lastInput, seq: 99, skill: 2 });
    a.tick();
    expect(me.roll).toBeUndefined();
  });
  it("bounces off walls instead of sliding along them", () => {
    const a = arena("pangrove");
    const [me, them] = a.players;
    place(them, 1500, 850);
    place(me, 1500, Y);
    roll(a, me);
    ticks(a, 20);
    expect(Math.cos(me.roll!.heading)).toBeLessThan(0);
  });
});

describe("Pinball", () => {
  it("ricochets off walls, faster each time, and ends when out of bounces", () => {
    const a = arena("pangrove");
    const [me, them] = a.players;
    place(them, 1500, 850);
    place(me, 300, Y, 0, Y);
    a.cast(me, skill("pangrove", "pinball"));
    const speed0 = Math.hypot(me.dashX, me.dashY);
    ticks(a, 20);
    expect(me.pinball!.bounces).toBe(3);
    expect(Math.hypot(me.dashX, me.dashY)).toBeCloseTo(speed0 * 1.12);
    ticks(a, RULES.tick * 3);
    expect(me.pinball).toBeUndefined();
    expect(me.recoveryUntil).toBeLessThanOrEqual(a.time + 0.2);
  });
  it("hits an enemy once per stretch, and a root stops it", () => {
    const a = arena("pangrove");
    const [me, them] = a.players;
    place(me, 300, Y, 1500, Y);
    place(them, 700, Y);
    a.cast(me, skill("pangrove", "pinball"));
    const hp = them.hp;
    ticks(a, 12);
    expect(hp - them.hp).toBe(skill("pangrove", "pinball").damage);
    a.status(me, "root", 1);
    a.tick();
    expect(me.pinball).toBeUndefined();
  });
});

describe("Mossloth's moss", () => {
  it("grows while standing still, up to five stacks, and falls off moving", () => {
    const a = arena("mossloth");
    const [me, them] = a.players;
    place(them, 1500, 850);
    place(me, 300, Y);
    ticks(a, Math.round(RULES.tick * 1.6));
    expect(me.moss).toBe(3);
    ticks(a, RULES.tick * 2);
    expect(me.moss).toBe(MOSS.max);
    me.lastInput = { ...me.lastInput, dx: 1 };
    ticks(a, Math.round(RULES.tick * 0.8));
    expect(me.moss).toBeLessThan(MOSS.max - 1);
  });
  it("takes 5% off damage a stack and heals over time", () => {
    const a = arena("mossloth");
    const [me] = a.players;
    me.moss = 4;
    const hp = me.hp;
    a.damage(me, 20, "them");
    expect(hp - me.hp).toBeCloseTo(20 * (1 - 4 * MOSS.reduction));
    const hurt = me.hp;
    me.mossStill = true;
    me.mossAt = a.time + 99;
    ticks(a, RULES.tick);
    expect(me.hp - hurt).toBeCloseTo(4 * MOSS.regen, 0);
  });
});

describe("Seedling", () => {
  it("grows a stage every 1.5 seconds and roots harder the further it grew", () => {
    const rootAt = (wait: number) => {
      const a = arena("mossloth");
      const [me, them] = a.players;
      place(me, 300, Y, 600, Y);
      place(them, 1500, 850);
      a.cast(me, skill("mossloth", "seedling"));
      const seed = a.zones[0];
      expect(seed.x).toBeCloseTo(600, 0);
      ticks(a, Math.round(RULES.tick * wait));
      const stage = seedStage(seed, a.time);
      place(them, 600, Y);
      const hp = them.hp;
      a.tick();
      const root = them.statuses.find((s) => s.kind === "root")!;
      return { stage, dealt: hp - them.hp, root: root.until - a.time };
    };
    const sprout = rootAt(0.2),
      bloom = rootAt(3.2);
    const seedling = skill("mossloth", "seedling");
    expect(sprout.stage).toBe(0);
    expect(bloom.stage).toBe(2);
    expect(sprout.dealt).toBe(Math.round(seedling.damage * seedling.seed!.stages[0]));
    expect(bloom.dealt).toBe(seedling.damage);
    expect(bloom.root).toBeGreaterThan(sprout.root * 2);
  });
  it("is cleared by a jump, and a fourth seed withers the oldest", () => {
    const a = arena("mossloth");
    const [me, them] = a.players;
    place(me, 300, Y, 600, Y);
    place(them, 1500, 850);
    a.cast(me, skill("mossloth", "seedling"));
    them.jumpUntil = a.time + 1;
    place(them, 600, Y);
    a.tick();
    expect(a.zones).toHaveLength(1);
    place(them, 1500, 850);
    // Seedling reaches 520 px: these all land at their aim.
    for (const x of [700, 800, 500]) {
      me.lastInput = { ...me.lastInput, aimX: x };
      me.angle = 0;
      a.cast(me, skill("mossloth", "seedling"));
      a.tick();
    }
    expect(a.zones.map((z) => Math.round(z.x))).toEqual([700, 800, 500]);
  });
});

describe("Sloth Time", () => {
  it("slows enemies inside to a third, and their shots, not Mossloth's", () => {
    const a = arena("mossloth");
    const [me, them] = a.players;
    place(me, 300, Y, 700, Y);
    place(them, 700, Y);
    a.cast(me, skill("mossloth", "sloth-time"));
    a.tick();
    expect(a.has(them, "warp")).toBe(true);
    them.lastInput = { ...them.lastInput, dx: 1 };
    ticks(a, 20);
    expect(Math.hypot(them.vx, them.vy)).toBeCloseTo(
      CHARACTERS.voltkit.speed * STATUS_RULES.warpMultiplier,
      0,
    );
    // An enemy shot inside the bubble crawls; one of Mossloth's own doesn't.
    a.projectiles = [];
    const shot = (owner: string) => ({
      id: ++a.serial,
      owner,
      x: 700,
      y: Y + 60,
      vx: 0,
      vy: 600,
      remaining: 600,
      ability: CHARACTERS.voltkit.basic,
      color: 0,
    });
    a.projectiles.push(shot("them"), shot("me"));
    a.tick();
    const [theirs, mine] = a.projectiles;
    expect(theirs.y - (Y + 60)).toBeCloseTo(20 * STATUS_RULES.warpMultiplier, 0);
    expect(mine.y - (Y + 60)).toBeCloseTo(20, 0);
  });
});

describe("Lazy Swap", () => {
  it("swaps places with the enemy nearest the aim and slows it", () => {
    const a = arena("mossloth");
    const [me, them] = a.players;
    place(me, 300, Y, 820, Y + 40);
    place(them, 800, Y);
    a.cast(me, skill("mossloth", "lazy-swap"));
    expect([me.x, me.y]).toEqual([800, Y]);
    expect([them.x, them.y]).toEqual([300, Y]);
    expect(a.has(them, "slow")).toBe(true);
  });
  it("swaps with its own seedling (which lands where Mossloth stood)", () => {
    const a = arena("mossloth");
    const [me, them] = a.players;
    place(them, 1500, 850);
    place(me, 300, Y, 600, Y);
    a.cast(me, skill("mossloth", "seedling"));
    a.cast(me, skill("mossloth", "lazy-swap"));
    expect(Math.round(me.x)).toBe(600);
    expect(Math.round(a.zones[0].x)).toBe(300);
  });
  it("gives most of the cooldown back when nothing is near the aim", () => {
    const a = arena("mossloth");
    const [me, them] = a.players;
    place(them, 1500, 850);
    place(me, 300, Y, 600, Y);
    me.cooldowns[2] = a.time + 12;
    a.cast(me, skill("mossloth", "lazy-swap"));
    expect(me.x).toBe(300);
    expect(me.cooldowns[2]).toBeCloseTo(a.time + 1.5);
  });
});

describe("Overgrowth", () => {
  it("roots enemies around Mossloth, blooms every seedling and fills the moss", () => {
    const a = arena("mossloth");
    const [me, them] = a.players;
    place(me, 300, Y, 700, Y);
    place(them, 1500, 850);
    a.cast(me, skill("mossloth", "seedling"));
    place(them, 700, Y + 30);
    // Not stepped on: the seed is 30 px off... then everything blooms.
    place(them, 700, Y + 80);
    a.tick();
    expect(a.zones).toHaveLength(1);
    const hp = them.hp;
    a.cast(me, skill("mossloth", "overgrowth"));
    // Out of the vines' reach, but on the seedling: its full bloom.
    expect(hp - them.hp).toBe(skill("mossloth", "seedling").damage);
    expect(a.has(them, "root")).toBe(true);
    expect(me.moss).toBe(MOSS.max);
    a.tick();
    expect(a.zones).toHaveLength(0);
  });
});

describe("combos", () => {
  it("Latched: Scale Shrapnel right after a Tongue Grapple hits 35% harder", () => {
    const dealt = (latched: boolean) => {
      const a = arena("pangrove");
      const [me, them] = a.players;
      place(me, 300, Y, 1500, Y);
      place(them, 1500, 850);
      if (latched) a.cast(me, skill("pangrove", "tongue-grapple"));
      place(me, 300, Y, 700, Y);
      place(them, 400, Y);
      me.plates = 0;
      me.dashUntil = 0;
      const hp = them.hp;
      a.cast(me, skill("pangrove", "scale-shrapnel"));
      ticks(a, 6);
      return hp - them.hp;
    };
    expect(dealt(true) / dealt(false)).toBeCloseTo(1.35, 1);
  });
  it("Timelocked: a seedling set off by a slowed enemy deals 40% more", () => {
    const dealt = (slowed: boolean) => {
      const a = arena("mossloth");
      const [me, them] = a.players;
      place(me, 300, Y, 600, Y);
      place(them, 1500, 850);
      a.cast(me, skill("mossloth", "seedling"));
      if (slowed) a.status(them, "warp", 1, "me");
      place(them, 600, Y);
      const hp = them.hp;
      a.tick();
      return hp - them.hp;
    };
    expect(dealt(true) / dealt(false)).toBeCloseTo(1.4, 1);
  });
});

describe("in raids", () => {
  it("Sloth Time slows a boss like any slow, not to a crawl", () => {
    const a = createRaidArena("NATURE", "grumblecrag");
    a.add("me", "Me", "mossloth");
    a.configure(1, false);
    a.start();
    a.phase = "playing";
    const me = a.players.find((p) => !p.raidBoss)!,
      boss = a.boss()!;
    place(me, boss.x - 300, boss.y, boss.x, boss.y);
    a.cast(me, skill("mossloth", "sloth-time"));
    a.tick();
    expect(a.has(boss, "warp")).toBe(false);
    expect(a.has(boss, "slow")).toBe(true);
  });
});
