import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation.js";
import {
  CHARACTERS,
  COMBOS,
  RULES,
  ULT_SLOT,
  blankInput,
  type CharacterId,
  type Fighter,
} from "../../packages/shared/src/index.js";

// The skill revolution, wave B (docs/skill-revolution.md): Cindrake,
// Pyranda, Mossloth, Mystowl and Astrabun.

const arena = (me: CharacterId, them: CharacterId = "terradon") => {
  const a = new Arena("REVOLUTION-B", "duel");
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
const slot = (c: CharacterId, id: string) =>
  CHARACTERS[c].skills.findIndex((k) => k.id === id);
const press = (a: Arena, p: Fighter, c: CharacterId, id: string) => {
  const s = slot(c, id);
  if (s === ULT_SLOT) p.ult = RULES.ultMax;
  p.lastInput = { ...p.lastInput, skill: s };
  a.tick();
};
const Y = 150;

describe("Magma Leap (Cindrake)", () => {
  it("leaps to the aim, over ground attacks, and erupts where it lands", () => {
    const a = arena("cindrake");
    const [me, them] = a.players;
    place(me, 300, Y, 560, Y);
    place(them, 600, Y);
    const hp = them.hp;
    press(a, me, "cindrake", "magma-leap");
    // In the air on the way: a ground attack misses.
    expect(me.jumpUntil).toBeGreaterThan(a.time);
    const mine = me.hp;
    a.damage(me, 30, them.id, CHARACTERS.terradon.skills[3]);
    expect(me.hp).toBe(mine);
    seconds(a, 0.5);
    expect(me.x).toBeGreaterThan(540);
    expect(me.x).toBeLessThan(580);
    expect(hp - them.hp).toBeGreaterThanOrEqual(
      skill("cindrake", "magma-leap").damage,
    );
    expect(a.has(them, "burn")).toBe(true);
  });
  it("lands harder on a Scorched target", () => {
    expect(COMBOS.cindrake.payoff).toBe("magma-leap");
  });
});

describe("Chestnut Storm (Pyranda)", () => {
  it("creeps along the aim: an enemy in the line is hit, one beside it is not", () => {
    for (const [y, hurt] of [
      [Y, true],
      [Y + 320, false],
    ] as const) {
      const a = arena("pyranda");
      const [me, them] = a.players;
      place(me, 200, Y, 1200, Y);
      place(them, 820, y);
      const hp = them.hp;
      press(a, me, "pyranda", "chestnut-storm");
      seconds(a, 2.5);
      if (hurt)
        expect(hp - them.hp).toBeGreaterThanOrEqual(
          skill("pyranda", "chestnut-storm").damage,
        );
      else expect(them.hp).toBe(hp);
    }
  });
  it("marks every blast before it lands", () => {
    const a = arena("pyranda");
    const [me] = a.players;
    place(me, 200, Y, 1200, Y);
    press(a, me, "pyranda", "chestnut-storm");
    seconds(a, 0.35);
    const blasts = a.zones.filter((z) => z.ability.id === "chestnut-storm");
    expect(blasts).toHaveLength(skill("pyranda", "chestnut-storm").count!);
    expect(Math.max(...blasts.map((z) => z.x))).toBeCloseTo(200 + 760, 0);
  });
});

describe("Overgrowth (Mossloth)", () => {
  it("slows and hurts on the garden, and roots whoever is still on it at the end", () => {
    const a = arena("mossloth");
    const [me, them] = a.players;
    place(me, 200, Y, 600, Y);
    place(them, 620, Y);
    const hp = them.hp;
    press(a, me, "mossloth", "overgrowth");
    seconds(a, 1);
    expect(a.has(them, "slow")).toBe(true);
    seconds(a, 2);
    expect(a.has(them, "root")).toBe(true);
    expect(hp - them.hp).toBeGreaterThan(
      skill("mossloth", "overgrowth").garden!.burst,
    );
  });
  it("lets go of whoever walks off it in time", () => {
    const a = arena("mossloth");
    const [me, them] = a.players;
    place(me, 200, Y, 600, Y);
    place(them, 620, Y);
    press(a, me, "mossloth", "overgrowth");
    seconds(a, 1);
    them.x = 1100;
    seconds(a, 2);
    expect(a.has(them, "root")).toBe(false);
  });
});

describe("Hush (Mystowl)", () => {
  it("silences enemies near: no skills until it ends", () => {
    const a = arena("mystowl", "astrabun");
    const [me, them] = a.players;
    place(me, 300, Y);
    place(them, 420, Y, 300, Y);
    a.cast(me, skill("mystowl", "hush"));
    expect(a.has(them, "silence")).toBe(true);
    them.lastInput = { ...them.lastInput, skill: 0 };
    a.tick();
    expect(them.stats.skills).toBe(0);
    seconds(a, 1.2);
    them.lastInput = { ...them.lastInput, skill: 0 };
    a.tick();
    expect(them.stats.skills).toBe(1);
  });
  it("sets up Mind Maze (Dazed)", () => {
    expect(COMBOS.mystowl.setup).toBe("hush");
  });
});

describe("Sticky Mochi (Astrabun)", () => {
  it("grounds its target: no dash, no jump", () => {
    const a = arena("astrabun", "voltkit");
    const [me, them] = a.players;
    place(me, 300, Y, 900, Y);
    place(them, 600, Y);
    a.cast(me, skill("astrabun", "sticky-mochi"));
    seconds(a, 0.4);
    expect(a.has(them, "grounded")).toBe(true);
    them.lastInput = { ...them.lastInput, dash: true, jump: true, dx: 1 };
    a.tick();
    expect(them.dashUntil).toBeLessThanOrEqual(a.time);
    expect(them.jumpUntil).toBeLessThanOrEqual(a.time);
    seconds(a, 2);
    them.lastInput = { ...them.lastInput, dash: true, dx: 1 };
    a.tick();
    expect(them.dashUntil).toBeGreaterThan(a.time);
  });
});
