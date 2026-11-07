import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation.js";
import {
  CHARACTERS,
  RULES,
  advanceMovement,
  blankInput,
  type CharacterId,
  type Fighter,
} from "../../packages/shared/src/index.js";

// Wave 3 of making every kit its own: three of the four slow zones and two of
// the zone ultimates that were a delayed blast at the aim.

const arena = (me: CharacterId, them: CharacterId = "terradon") => {
  const a = new Arena("WAVE3", "duel");
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
const seconds = (a: Arena, s: number) => {
  for (let i = 0; i < Math.round(RULES.tick * s); i++) a.tick();
};
const skill = (c: CharacterId, id: string) =>
  CHARACTERS[c].skills.find((k) => k.id === id)!;
/** Open ground on the classic arena's top row. */
const Y = 150;

describe("Undertow (Tidefin)", () => {
  it("sweeps an enemy standing in it along the aim, and hurts it", () => {
    const a = arena("tidefin");
    const [me, them] = a.players;
    place(me, 300, Y, 900, Y);
    place(them, 400, Y);
    const hp = them.hp;
    a.cast(me, skill("tidefin", "undertow"));
    seconds(a, 1);
    // Carried toward +x though it stands still.
    expect(them.x).toBeGreaterThan(530);
    expect(hp - them.hp).toBeGreaterThanOrEqual(skill("tidefin", "undertow").damage);
  });
  it("lets a jumping enemy over it", () => {
    const a = arena("tidefin");
    const [me, them] = a.players;
    place(me, 300, Y, 900, Y);
    place(them, 400, Y);
    them.jumpUntil = a.time + 5;
    a.cast(me, skill("tidefin", "undertow"));
    seconds(a, 0.5);
    expect(them.x).toBeCloseTo(400, 0);
  });
});

describe("Moon Gravity (Astrabun)", () => {
  it("makes enemies float: they barely change direction", () => {
    const run = (float: boolean) => {
      const a = arena("astrabun", "voltkit");
      const them = a.players[1];
      place(them, 600, Y + 200);
      if (float)
        them.statuses.push({ kind: "float", until: a.time + 5, nextTick: a.time + 5 });
      // Running right, it turns left: how far left does it get in 0.3 s?
      Object.assign(them, { vx: 250 });
      const left = { ...blankInput(), dx: -1, aimX: 0, aimY: Y + 200 };
      for (let i = 0; i < Math.round(RULES.tick * 0.3); i++)
        advanceMovement(them, left, 1 / RULES.tick, a.time);
      return them.vx;
    };
    expect(run(false)).toBeLessThan(-150);
    // Floating, it is still drifting the old way, or only just stopped.
    expect(run(true)).toBeGreaterThan(-40);
  });
  it("comes from the zone", () => {
    const a = arena("astrabun");
    const [me, them] = a.players;
    place(me, 300, Y, 500, Y);
    place(them, 500, Y);
    a.cast(me, skill("astrabun", "moon-gravity"));
    seconds(a, 0.6);
    expect(a.has(them, "float")).toBe(true);
  });
});

describe("Spark Trail (Coilemur)", () => {
  it("hurts and paralyses enemies who touch where Coilemur walked", () => {
    const a = arena("coilemur");
    const [me, them] = a.players;
    place(me, 300, Y, 900, Y);
    place(them, 1400, 850);
    a.cast(me, skill("coilemur", "spark-trail"));
    me.lastInput = { ...me.lastInput, dx: 1 };
    seconds(a, 1);
    // The trail now runs behind it; step the enemy onto it.
    me.lastInput = { ...me.lastInput, dx: 0 };
    place(them, 400, Y);
    const hp = them.hp;
    a.tick();
    expect(hp - them.hp).toBe(skill("coilemur", "spark-trail").damage);
    expect(a.has(them, "paralysis")).toBe(true);
    // It fades: long after, nothing is left.
    seconds(a, 5);
    expect(a.zones.filter((z) => z.ability.kind === "trail")).toHaveLength(0);
  });
});

describe("Sunfire Pillar (Cindrake)", () => {
  it("follows the caster's aim", () => {
    const a = arena("cindrake");
    const [me, them] = a.players;
    place(them, 1400, 850);
    place(me, 300, Y, 600, Y);
    a.cast(me, skill("cindrake", "sunfire-pillar"));
    const zone = a.zones.find((z) => z.ability.id === "sunfire-pillar")!;
    expect(zone.x).toBeCloseTo(600, 0);
    me.lastInput = { ...me.lastInput, aimX: 600, aimY: 600 };
    seconds(a, 1);
    expect(zone.y).toBeGreaterThan(Y + 150);
    expect(zone.x).toBeCloseTo(600, 0);
  });
});

describe("Mind Maze (Mystowl)", () => {
  it("confuses: an enemy that tries to walk one way goes the other", () => {
    const a = arena("mystowl");
    const [me, them] = a.players;
    place(me, 300, Y + 200, 700, Y + 200);
    place(them, 700, Y + 200);
    a.cast(me, skill("mystowl", "mind-maze"));
    seconds(a, 0.5);
    expect(a.has(them, "confuse")).toBe(true);
    them.lastInput = { ...them.lastInput, dx: 1 };
    seconds(a, 0.5);
    expect(them.x).toBeLessThan(700);
  });
});
