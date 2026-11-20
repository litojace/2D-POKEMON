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

describe("Live Wire (Coilemur)", () => {
  it("holds an enemy: a few sparks while close, a yank back if it runs", () => {
    const a = arena("coilemur");
    const [me, them] = a.players;
    const wire = skill("coilemur", "live-wire");
    place(me, 300, Y, 500, Y);
    place(them, 520, Y);
    a.cast(me, wire);
    expect(me.tether?.target).toBe("them");
    // Coilemur runs faster to chase.
    expect(a.has(me, "haste")).toBe(true);
    // Close by: it only stings, every half second.
    const hp = them.hp;
    seconds(a, 1.05);
    expect(hp - them.hp).toBe(wire.damage * 2);
    expect(me.tether).toBeDefined();
    // It runs: past 250 px the wire yanks it back and paralyses it.
    const before = them.hp;
    place(them, 300 + 360, Y);
    a.tick();
    expect(me.tether).toBeUndefined();
    expect(before - them.hp).toBe(wire.tether!.yank!.damage);
    expect(a.has(them, "paralysis")).toBe(true);
    seconds(a, 0.5);
    expect(them.x).toBeLessThan(300 + 360 - 150);
  });

  it("is cut by a wall between them, and finds nobody out of reach", () => {
    const a = arena("coilemur");
    const [me, them] = a.players;
    const wire = skill("coilemur", "live-wire");
    place(me, 300, Y, 1400, 850);
    place(them, 1400, 850);
    const slot = CHARACTERS.coilemur.skills.indexOf(wire);
    me.cooldowns[slot] = a.time + wire.cooldown;
    a.cast(me, wire);
    expect(me.tether).toBeUndefined();
    // No wire, no refund: the speed burst can't be had again at once.
    expect(me.cooldowns[slot]).toBeCloseTo(a.time + wire.cooldown);
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
