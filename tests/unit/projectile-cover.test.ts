import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import { projectileContact } from "../../apps/server/src/projectile-collision";
import { CHARACTERS, RULES, blocked } from "@arena/shared";

function duel(angle: number) {
  const arena = new Arena("COVER");
  arena.add("one", "One", "voltkit");
  arena.add("two", "Two", "voltkit");
  arena.start();
  arena.phase = "playing";
  arena.deadline = 999;
  const [p, q] = arena.players;
  Object.assign(p, { x: 465, y: 240, angle });
  Object.assign(q, {
    x: p.x + Math.cos(angle) * 200,
    y: p.y + Math.sin(angle) * 200,
  });
  arena.walls();
  expect(blocked(p.x, p.y)).toBe(false);
  expect(blocked(q.x, q.y)).toBe(false);
  return { arena, p, q };
}

describe("stone cover", () => {
  it("stops a shot whose muzzle offset skips over a block corner", () => {
    const { arena, p, q } = duel(-0.35);
    arena.cast(p, CHARACTERS.voltkit.basic);
    expect(arena.projectiles).toHaveLength(0);
    expect(arena.events.some((e) => e.kind === "impact")).toBe(true);
    for (let i = 0; i < RULES.tick; i++) arena.tick();
    expect(q.hp).toBe(CHARACTERS.voltkit.health);
  });

  it("still lets shots pass a genuinely clear corner", () => {
    const { arena, p, q } = duel(-0.6);
    arena.cast(p, CHARACTERS.voltkit.basic);
    for (let i = 0; i < RULES.tick; i++) arena.tick();
    expect(q.hp).toBe(
      CHARACTERS.voltkit.health - CHARACTERS.voltkit.basic.damage,
    );
  });

  it("blocks the full width of a beam, including a corner graze", () => {
    const { arena, p, q } = duel(0);
    p.y = q.y = 225;
    const beam = Object.values(CHARACTERS)
      .flatMap((c) => c.skills)
      .find((a) => a.kind === "beam")!;
    arena.cast(p, { ...beam, radius: 18, range: 400, damage: 20 });
    expect(q.hp).toBe(CHARACTERS.voltkit.health);
    const shown = arena.events.find((e) => e.kind === "beam");
    expect(shown?.tx).toBeLessThan(490);
    expect(shown?.ty).toBe(225);
  });

  it("stops fast projectiles and keeps their splash on the exposed side", () => {
    const { arena, p, q } = duel(0);
    Object.assign(p, { x: 400, y: 300 });
    Object.assign(q, { x: 605, y: 300 });
    arena.cast(p, {
      ...CHARACTERS.voltkit.skills[1],
      speed: 20000,
      explosion: 240,
    });
    arena.tick();
    expect(arena.projectiles).toHaveLength(0);
    expect(q.hp).toBe(CHARACTERS.voltkit.health);
    const impact = arena.events.find((e) => e.kind === "impact");
    expect(impact).toBeDefined();
    expect(impact!.x).toBeLessThan(490);
  });
});

describe("swept projectile contact", () => {
  const block = [{ x: 490, y: 240, w: 90, h: 130 }];
  it("finds the nearest face from either direction regardless of step length", () => {
    expect(
      projectileContact({ x: 100, y: 300 }, { x: 700, y: 300 }, 9, block)?.x,
    ).toBeCloseTo(481);
    expect(
      projectileContact({ x: 700, y: 300 }, { x: 100, y: 300 }, 9, block)?.x,
    ).toBeCloseTo(589);
  });
  it("uses rounded corners instead of falsely blocking the expanded bounding box", () => {
    const from = { x: 465, y: 240 };
    expect(
      projectileContact(
        from,
        { x: from.x + Math.cos(-0.35) * 30, y: from.y + Math.sin(-0.35) * 30 },
        9,
        block,
      ),
    ).not.toBeNull();
    expect(
      projectileContact(
        from,
        { x: from.x + Math.cos(-0.6) * 30, y: from.y + Math.sin(-0.6) * 30 },
        9,
        block,
      ),
    ).toBeNull();
    expect(
      projectileContact({ x: 400, y: 220 }, { x: 700, y: 220 }, 9, block),
    ).toBeNull();
  });
  it("handles an arena boundary, a stationary blocked origin and a clear origin", () => {
    expect(
      projectileContact({ x: 25, y: 100 }, { x: -100, y: 100 }, 9, [])?.x,
    ).toBeCloseTo(9);
    expect(
      projectileContact({ x: 500, y: 300 }, { x: 500, y: 300 }, 9, block)
        ?.fraction,
    ).toBe(0);
    expect(
      projectileContact({ x: 400, y: 300 }, { x: 400, y: 300 }, 9, block),
    ).toBeNull();
  });
});
