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
// the zone ultimates that were a delayed blast at the aim. (Undertow has since
// become River Dash: tests/unit/revolution-kits.test.ts.)

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
