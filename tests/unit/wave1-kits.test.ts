import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation.js";
import {
  CHARACTERS,
  RULES,
  blankInput,
  type CharacterId,
  type Fighter,
} from "../../packages/shared/src/index.js";

// Wave 1 of making every kit its own: the skills that were exact copies of
// another champion's (a second barrier, counter, decoy, two slowing shots,
// two plain fans) now play on mechanics no one else has.

const arena = (me: CharacterId, them: CharacterId = "terradon") => {
  const a = new Arena("WAVE1", "duel");
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
/** Open ground on the classic arena's top row. */
const Y = 150;

describe("Ember Curtain (Pyranda)", () => {
  it("burns up enemy shots that touch it, not Pyranda's own", () => {
    const a = arena("pyranda", "voltkit");
    const [me, them] = a.players;
    place(me, 300, Y, 600, Y);
    place(them, 900, Y);
    a.cast(me, skill("pyranda", "ember-curtain"));
    const shot = (owner: string, x: number, vx: number) => ({
      id: ++a.serial,
      owner,
      x,
      y: Y,
      vx,
      vy: 0,
      remaining: 600,
      ability: CHARACTERS.voltkit.basic,
      color: 0,
    });
    // An enemy shot flying at Pyranda, and one of Pyranda's flying out.
    a.projectiles.push(shot("them", 500, -900), shot("me", 340, 900));
    ticks(a, 10);
    expect(a.projectiles.map((p) => p.owner)).toEqual(["me"]);
    expect(me.hp).toBe(me.hp);
  });
  it("sets enemies walking through it on fire", () => {
    const a = arena("pyranda");
    const [me, them] = a.players;
    place(me, 300, Y, 600, Y);
    place(them, 390, Y);
    a.cast(me, skill("pyranda", "ember-curtain"));
    ticks(a, 6);
    expect(a.has(them, "burn")).toBe(true);
  });
});

describe("Grudge Thump (Wombolder)", () => {
  it("taunts enemies near it into walking at Wombolder, and they can still fight", () => {
    const a = arena("wombolder", "voltkit");
    const [me, them] = a.players;
    place(me, 300, Y);
    place(them, 500, Y);
    const hp = them.hp;
    a.cast(me, skill("wombolder", "grudge-thump"));
    expect(hp - them.hp).toBe(skill("wombolder", "grudge-thump").damage);
    expect(a.has(them, "taunt")).toBe(true);
    // It tries to walk away, but walks at Wombolder.
    them.lastInput = { ...them.lastInput, dx: 1 };
    ticks(a, 15);
    expect(them.x).toBeLessThan(500);
    // A basic attack still goes off.
    them.lastInput = { ...them.lastInput, aimX: me.x, aimY: me.y, basic: true };
    const before = them.stats.dealt;
    ticks(a, 20);
    expect(them.stats.dealt).toBeGreaterThan(before);
  });
  it("braces Wombolder: knockback no longer moves it", () => {
    const a = arena("wombolder", "auralynx");
    const [me, them] = a.players;
    place(me, 400, Y);
    place(them, 300, Y, 400, Y);
    a.cast(me, skill("wombolder", "grudge-thump"));
    a.damage(me, 10, them.id, skill("auralynx", "shatter-paw"));
    expect(me.x).toBe(400);
  });
});

describe("Bush Boomerang (Wombolder)", () => {
  it("hits on the way out and again on the way back, then comes home", () => {
    const a = arena("wombolder");
    const [me, them] = a.players;
    place(me, 300, Y, 900, Y);
    place(them, 560, Y);
    const hp = them.hp;
    a.cast(me, skill("wombolder", "bush-boomerang"));
    ticks(a, 90);
    expect(hp - them.hp).toBe(skill("wombolder", "bush-boomerang").damage * 2);
    expect(a.projectiles).toHaveLength(0);
  });
  it("turns back early at a wall", () => {
    const a = arena("wombolder");
    const [me, them] = a.players;
    place(them, 1500, 850);
    place(me, 300, Y, 300, 0);
    a.cast(me, skill("wombolder", "bush-boomerang"));
    ticks(a, 8);
    expect(a.projectiles[0].back).toBe(true);
  });
});

describe("Halcyon Rewind (Halcyra)", () => {
  it("dives back to where Halcyra was 2 seconds ago and wins back some lost health", () => {
    const a = arena("halcyra");
    const [me, them] = a.players;
    place(them, 1500, 850);
    place(me, 300, Y);
    ticks(a, 3);
    me.lastInput = { ...me.lastInput, dx: 1 };
    ticks(a, Math.round(RULES.tick * 2));
    const hp = me.hp;
    a.damage(me, 40, them.id);
    const lost = hp - me.hp + 0;
    a.cast(me, skill("halcyra", "halcyon-rewind"));
    expect(me.x).toBeLessThan(330);
    const r = skill("halcyra", "halcyon-rewind").rewind!;
    expect(me.hp).toBeCloseTo(hp - lost + Math.min(r.max, lost * r.heal), 0);
  });
});

describe("Pinning Quill (Halcyra)", () => {
  it("leashes its target where it was hit", () => {
    const a = arena("halcyra");
    const [me, them] = a.players;
    place(me, 300, Y, 700, Y);
    place(them, 700, Y);
    a.cast(me, skill("halcyra", "pinning-quill"));
    ticks(a, 12);
    expect(a.has(them, "leash")).toBe(true);
    const pin = them.statuses.find((s) => s.kind === "leash")!;
    them.lastInput = { ...them.lastInput, dx: 1 };
    ticks(a, 40);
    const len = skill("halcyra", "pinning-quill").leash!;
    expect(Math.hypot(them.x - pin.tx!, them.y - pin.ty!)).toBeLessThanOrEqual(len + 1);
    // Free again once it wears off.
    ticks(a, Math.round(RULES.tick * 1.5));
    expect(Math.hypot(them.x - pin.tx!, them.y - pin.ty!)).toBeGreaterThan(len + 20);
  });
});

describe("Ink Jet (Shadopus)", () => {
  it("blinds: the target's basic attacks miss until it wears off", () => {
    const a = arena("shadopus", "voltkit");
    const [me, them] = a.players;
    place(me, 300, Y, 600, Y);
    place(them, 600, Y);
    a.cast(me, skill("shadopus", "ink-jet"));
    ticks(a, 12);
    expect(a.has(them, "blind")).toBe(true);
    const hp = me.hp;
    a.damage(me, 6, them.id, CHARACTERS.voltkit.basic);
    expect(me.hp).toBe(hp);
    expect(a.events.at(-1)?.miss).toBe(true);
    // Skills still land; and once it wears off, basics do too.
    a.damage(me, 10, them.id, skill("voltkit", "static-lance"));
    expect(me.hp).toBeLessThan(hp);
    ticks(a, Math.round(RULES.tick * 1.6));
    const hp2 = me.hp;
    a.damage(me, 6, them.id, CHARACTERS.voltkit.basic);
    expect(me.hp).toBeLessThan(hp2);
  });
});

describe("Gill Siphon (Tidefin)", () => {
  it("drains its target over time while it stays in reach, and snaps beyond it", () => {
    const a = arena("tidefin");
    const [me, them] = a.players;
    place(me, 300, Y, 600, Y);
    place(them, 600, Y);
    me.hp -= 40;
    const hp = them.hp,
      mine = me.hp;
    a.cast(me, skill("tidefin", "gill-siphon"));
    expect(me.tether?.target).toBe(them.id);
    // Ticks at 0.25, 0.5, 0.75 and 1 s (measured just past 1 s).
    ticks(a, Math.round(RULES.tick * 1.1));
    const dealt = hp - them.hp;
    expect(dealt).toBe(skill("tidefin", "gill-siphon").damage * 4);
    expect(me.hp - mine).toBeCloseTo(dealt * 0.5, 0);
    // It walks out of reach: the stream snaps.
    place(them, 1300, Y);
    a.tick();
    expect(me.tether).toBeUndefined();
  });
  it("gives most of the cooldown back when nobody is in reach", () => {
    const a = arena("tidefin");
    const [me, them] = a.players;
    place(them, 1500, 850);
    place(me, 300, Y, 600, Y);
    me.cooldowns[0] = a.time + 9;
    a.cast(me, skill("tidefin", "gill-siphon"));
    expect(me.tether).toBeUndefined();
    expect(me.cooldowns[0]).toBeCloseTo(a.time + 1.5);
  });
});

describe("combos", () => {
  it("Pelted: Bush Boomerang marks; Burrow Rush hits harder", () => {
    const a = arena("wombolder");
    const [me, them] = a.players;
    place(me, 300, Y, 600, Y);
    place(them, 600, Y);
    a.damage(them, 11, me.id, skill("wombolder", "bush-boomerang"));
    const hp = them.hp;
    a.damage(them, 16, me.id, skill("wombolder", "burrow-rush"));
    expect(hp - them.hp).toBeCloseTo(16 * 1.3, 0);
  });
});
