import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation.js";
import {
  CHARACTERS,
  COMBOS,
  RULES,
  blankInput,
  type CharacterId,
  type Fighter,
} from "../../packages/shared/src/index.js";

// The skill revolution, wave C (docs/skill-revolution.md): Glacelle's Black
// Ice.

const arena = (me: CharacterId, them: CharacterId = "terradon") => {
  const a = new Arena("REVOLUTION-C", "duel");
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
const slot = (c: CharacterId, id: string) =>
  CHARACTERS[c].skills.findIndex((k) => k.id === id);
const press = (a: Arena, p: Fighter, c: CharacterId, id: string) => {
  p.lastInput = { ...p.lastInput, skill: slot(c, id) };
  a.tick();
  p.lastInput = { ...p.lastInput, skill: -1 };
};
const sliding = (a: Arena, p: Fighter) =>
  p.statuses.some((s) => s.kind === "float" && s.until > a.time);
const Y = 150;

describe("Black Ice (Glacelle)", () => {
  it("glazes the ground at the aim: enemies on it slide, Glacelle does not", () => {
    const a = arena("glacelle");
    const [me, them] = a.players;
    place(me, 300, Y, 600, Y);
    place(them, 600, Y);
    const hp = them.hp;
    press(a, me, "glacelle", "black-ice");
    seconds(a, 0.6);
    expect(sliding(a, them)).toBe(true);
    expect(sliding(a, me)).toBe(false);
    expect(them.hp).toBeLessThan(hp);
    // The Chilled combo: Black Ice is its setup now.
    expect(COMBOS.glacelle.setup).toBe("black-ice");
  });

  it("makes an enemy on it slide: it keeps going after it lets go of the stick", () => {
    const run = (ice: boolean) => {
      const a = arena("glacelle");
      const [me, them] = a.players;
      place(me, 300, Y, 600, Y);
      place(them, 600, Y);
      if (ice) {
        press(a, me, "glacelle", "black-ice");
        seconds(a, 0.4);
      }
      // Run right for half a second, then let go.
      them.lastInput = { ...blankInput(), dx: 1, seq: them.ack + 1 };
      seconds(a, 0.5);
      them.lastInput = { ...blankInput(), seq: them.ack + 1 };
      const x = them.x;
      seconds(a, 0.25);
      return them.x - x;
    };
    // On the ice it skids on; on dry ground it stops almost at once.
    expect(run(true)).toBeGreaterThan(run(false) + 20);
  });

  it("is gone after 2 seconds", () => {
    const a = arena("glacelle");
    const [me, them] = a.players;
    place(me, 300, Y, 600, Y);
    place(them, 600, Y);
    press(a, me, "glacelle", "black-ice");
    seconds(a, 3);
    expect(sliding(a, them)).toBe(false);
  });
});
