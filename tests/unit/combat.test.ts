import { it, expect } from "vitest";
import { Arena } from "../../apps/server/src/simulation.js";
import {
  CHARACTERS,
  blankInput,
  packSnapshot,
  unpackSnapshot,
} from "../../packages/shared/src/index.js";
const duel = () => {
  const a = new Arena("ABC123");
  a.add("one", "One");
  a.add("two", "Two");
  a.start();
  a.phase = "playing";
  a.deadline = 180;
  return a;
};
it("explodes an orb at its range limit and applies splash damage once", () => {
  const a = duel(),
    [p, q] = a.players;
  p.x = 100;
  p.y = 130;
  q.x = 840;
  q.y = 200;
  p.angle = 0;
  a.cast(p, {
    ...CHARACTERS.voltkit.basic,
    range: 710,
    speed: 390,
    damage: 23,
    explosion: 100,
  });
  for (let i = 0; i < 65; i++) a.tick();
  expect(q.hp).toBe(110 - 23);
  expect(a.projectiles).toHaveLength(0);
});
it("zones damage grounded enemies repeatedly but airborne enemies avoid ground ticks", () => {
  const a = duel(),
    [p, q] = a.players;
  p.lastInput = { ...blankInput(), aimX: 400, aimY: 450 };
  p.angle = 0;
  q.x = 400;
  q.y = 450;
  a.cast(p, CHARACTERS.cindrake.skills[1]);
  q.jumpUntil = 1;
  for (let i = 0; i < 15; i++) a.tick();
  expect(q.hp).toBe(110);
  for (let i = 0; i < 35; i++) a.tick();
  expect(q.hp).toBeLessThan(110);
});
it("melee and movement attacks damage enemies within their collision range", () => {
  const a = duel(),
    [p, q] = a.players;
  q.x = p.x + 85;
  p.angle = 0;
  a.cast(p, CHARACTERS.auralynx.skills[0]);
  expect(q.hp).toBe(82);
  q.x = p.x + 100;
  a.cast(p, CHARACTERS.cindrake.skills[0]);
  for (let i = 0; i < 8; i++) a.tick();
  expect(q.hp).toBe(60);
});
it("decoys absorb a projectile before it reaches the owner", () => {
  const a = duel(),
    [p, q] = a.players;
  p.x = 260;
  q.x = 440;
  q.clone = { x: 350, y: 450, until: 3 };
  p.angle = 0;
  a.cast(p, CHARACTERS.voltkit.basic);
  for (let i = 0; i < 15; i++) a.tick();
  expect(q.hp).toBe(110);
  expect(q.clone).toBeUndefined();
});
it("packs static ability definitions as IDs and restores the renderer snapshot", () => {
  const a = duel();
  a.cast(a.players[0], CHARACTERS.voltkit.basic);
  const wire = packSnapshot(a.snapshot());
  expect(wire.projectiles[0]).not.toHaveProperty("ability");
  expect(wire.projectiles[0].abilityId).toBe("thunderbolt");
  expect(unpackSnapshot(wire).projectiles[0].ability.damage).toBe(18);
});
