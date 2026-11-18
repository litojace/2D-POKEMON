import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation.js";
import {
  CHARACTERS,
  RULES,
  STATUS_RULES,
  blankInput,
  type CharacterId,
  type Fighter,
} from "../../packages/shared/src/index.js";

// The champion balance overhaul: Sloth Time lets go of whoever dashes out,
// and a stealthed Shadopus can't be picked as a target.

const arena = (me: CharacterId, them: CharacterId = "voltkit") => {
  const a = new Arena("BALANCE", "duel");
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

describe("Sloth Time", () => {
  it("doesn't slow a dash, so a dash gets out of the bubble", () => {
    const a = arena("mossloth");
    const [me, them] = a.players;
    place(me, 200, Y, 700, Y);
    place(them, 700, Y);
    a.cast(me, skill("mossloth", "sloth-time"));
    a.tick();
    expect(a.has(them, "warp")).toBe(true);
    them.lastInput = { ...them.lastInput, dx: 1, dash: true };
    a.tick();
    expect(Math.hypot(them.vx, them.vy)).toBeCloseTo(RULES.dashSpeed, 0);
  });
  it("lets go the moment a fighter is out of the bubble", () => {
    const a = arena("mossloth");
    const [me, them] = a.players;
    place(me, 200, Y, 700, Y);
    place(them, 700, Y);
    a.cast(me, skill("mossloth", "sloth-time"));
    a.tick();
    // Carried just past the edge (a dash): the status is still on it for a
    // moment, but it walks at full speed.
    const radius = skill("mossloth", "sloth-time").radius;
    place(them, 700 + radius + RULES.radius + 4, Y);
    them.lastInput = { ...them.lastInput, dx: 1 };
    ticks(a, 20);
    expect(Math.hypot(them.vx, them.vy)).toBeCloseTo(
      CHARACTERS.voltkit.speed,
      0,
    );
    // Back inside, it crawls again.
    const b = arena("mossloth");
    const [me2, them2] = b.players;
    place(me2, 200, Y, 700, Y);
    place(them2, 700, Y);
    b.cast(me2, skill("mossloth", "sloth-time"));
    them2.lastInput = { ...them2.lastInput, dx: 1 };
    ticks(b, 8);
    expect(Math.hypot(them2.vx, them2.vy)).toBeCloseTo(
      CHARACTERS.voltkit.speed * STATUS_RULES.warpMultiplier,
      0,
    );
  });
});

describe("Ink Cloud", () => {
  it("a stealthed enemy can't be locked on to by Gill Siphon", () => {
    const a = arena("tidefin", "shadopus");
    const [me, them] = a.players;
    place(me, 300, Y, 500, Y);
    place(them, 500, Y);
    a.status(them, "stealth", 2);
    a.cast(me, skill("tidefin", "gill-siphon"));
    expect(me.tether).toBeUndefined();
  });
  it("vanishing snaps a siphon already on it", () => {
    const a = arena("tidefin", "shadopus");
    const [me, them] = a.players;
    place(me, 300, Y, 500, Y);
    place(them, 500, Y);
    a.cast(me, skill("tidefin", "gill-siphon"));
    expect(me.tether?.target).toBe(them.id);
    a.status(them, "stealth", 2);
    a.tick();
    expect(me.tether).toBeUndefined();
  });
  it("Lazy Swap can't pick a stealthed enemy", () => {
    const a = arena("mossloth", "shadopus");
    const [me, them] = a.players;
    place(me, 300, Y, 800, Y);
    place(them, 800, Y);
    a.status(them, "stealth", 2);
    a.cast(me, skill("mossloth", "lazy-swap"));
    expect([me.x, me.y]).toEqual([300, Y]);
    expect([them.x, them.y]).toEqual([800, Y]);
  });
});
