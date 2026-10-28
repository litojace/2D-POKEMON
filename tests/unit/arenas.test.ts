import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import {
  ARENAS,
  ARENA_ROTATION,
  CHARACTERS,
  RULES,
  blocked,
  hazardIn,
  obstaclesAt,
  shiftingUp,
  type ArenaId,
} from "@arena/shared";

const live = (id: ArenaId) => {
  const arena = new Arena("ARENAS");
  arena.arenaId = id;
  arena.add("one", "One", "terradon");
  arena.add("two", "Two", "terradon");
  arena.start();
  arena.phase = "playing";
  arena.deadline = 999;
  arena.hazardClock = arena.time;
  return { arena, p: arena.players[0], q: arena.players[1] };
};
const run = (arena: Arena, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * RULES.tick); i++) arena.tick();
};

describe("arenas", () => {
  it("rotates through every arena, one per match", () => {
    const a = new Arena("ROTATE");
    a.rotateArenas = true;
    a.add("one", "One", "voltkit");
    a.add("two", "Two", "tidefin");
    const seen = new Set<ArenaId>();
    for (let i = 0; i < ARENA_ROTATION.length; i++) {
      a.start();
      seen.add(a.arenaId);
    }
    expect(seen.size).toBe(ARENA_ROTATION.length);
    // Rooms that don't rotate (tests, practice) stay on the original court.
    expect(new Arena("PLAIN").arenaId).toBe("classic");
  });
  it("keeps spawns, orbs and hazards clear of walls", () => {
    for (const id of ARENA_ROTATION) {
      const def = ARENAS[id];
      const obstacles = obstaclesAt(id, 0);
      for (const spot of [
        { x: 260, y: 450 },
        { x: 1340, y: 450 },
        { x: 260, y: 330 },
        { x: 1340, y: 570 },
      ])
        expect(blocked(spot.x, spot.y, RULES.radius, obstacles)).toBe(false);
      for (const h of def.hazards)
        expect(blocked(h.x, h.y, RULES.radius, obstacles)).toBe(false);
    }
  });
  it("Ember Forge vents burn whoever stands on them, but not a jumper", () => {
    const { arena, p, q } = live("ember-forge");
    const vent = ARENAS["ember-forge"].hazards[0];
    Object.assign(p, { x: vent.x, y: vent.y });
    Object.assign(q, { x: vent.x + 300, y: vent.y + 300 });
    run(arena, vent.offset - 0.5);
    expect(p.hp).toBe(CHARACTERS.terradon.health);
    run(arena, 0.6);
    expect(p.hp).toBeLessThan(CHARACTERS.terradon.health);
    expect(p.statuses.some((s) => s.kind === "burn")).toBe(true);
    expect(q.hp).toBe(CHARACTERS.terradon.health);
    expect(arena.events.some((e) => e.kind === "hazard")).toBe(true);
    // Jump through the next eruption.
    run(arena, vent.period - 0.7);
    const hp = p.hp;
    p.jumpUntil = arena.time + 1;
    run(arena, 0.6);
    expect(p.hp).toBe(hp);
  });
  it("the tide pool slows, then surges and throws fighters out", () => {
    const { arena, p } = live("tide-pools");
    const pool = ARENAS["tide-pools"].hazards[0];
    Object.assign(p, { x: pool.x + 20, y: pool.y });
    arena.tick();
    expect(p.statuses.some((s) => s.kind === "slow")).toBe(true);
    run(arena, pool.offset);
    expect(p.hp).toBeLessThan(CHARACTERS.terradon.health);
    expect(Math.hypot(p.x - pool.x, p.y - pool.y)).toBeGreaterThan(
      pool.radius,
    );
  });
  it("the Shifting Ruins block sinks and rises, pushing anyone out", () => {
    const def = ARENAS["shifting-ruins"];
    const s = def.shifting!;
    expect(shiftingUp(def, 1)).toBe(true);
    expect(shiftingUp(def, s.up + 1)).toBe(false);
    expect(obstaclesAt("shifting-ruins", 1)).toHaveLength(5);
    expect(obstaclesAt("shifting-ruins", s.up + 1)).toHaveLength(4);
    const { arena, p } = live("shifting-ruins");
    run(arena, s.up + 0.5);
    const centre = { x: s.rect.x + s.rect.w / 2, y: s.rect.y + s.rect.h / 2 };
    Object.assign(p, centre);
    expect(blocked(p.x, p.y, RULES.radius, arena.walls())).toBe(false);
    run(arena, s.down);
    expect(shiftingUp(def, arena.arenaTime())).toBe(true);
    expect(blocked(p.x, p.y, RULES.radius, arena.walls())).toBe(false);
    expect(Math.hypot(p.x - centre.x, p.y - centre.y)).toBeGreaterThan(40);
  });
  it("hazard timing helper counts down to the next trigger", () => {
    const vent = ARENAS["ember-forge"].hazards[0];
    expect(hazardIn(vent, 0)).toBeCloseTo(vent.offset);
    expect(hazardIn(vent, vent.offset + 1)).toBeCloseTo(vent.period - 1);
  });
});
