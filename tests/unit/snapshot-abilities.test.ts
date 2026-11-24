import { expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import {
  CHARACTERS,
  FIGHTER_IDS,
  packSnapshot,
  turretShot,
  unpackSnapshot,
  type Ability,
} from "@arena/shared";

/**
 * Projectiles and zones go over the wire as an ability id and are rebuilt
 * from the shared lookup. Every move of every champion (and anything derived
 * from one, like a lantern's shot) must come back identical, compact or full.
 */
it("rebuilds every champion's moves from their ids in a snapshot", () => {
  const a = new Arena("WIRE");
  const p = a.add("p", "P");
  a.start();
  const moves: Ability[] = FIGHTER_IDS.flatMap((id) => {
    const c = CHARACTERS[id];
    return [
      c.basic,
      ...c.skills,
      ...c.skills.filter((s) => s.turret).map(turretShot),
    ];
  });
  expect(moves.length).toBeGreaterThanOrEqual(FIGHTER_IDS.length * 5);
  const snap = a.snapshot();
  snap.projectiles = moves.map((ability, i) => ({
    id: i + 1,
    owner: p.id,
    x: 100,
    y: 100,
    vx: 1,
    vy: 0,
    remaining: 10,
    ability,
    color: 0,
  }));
  snap.zones = moves.map((ability, i) => ({
    id: i + 1000,
    owner: p.id,
    x: 100,
    y: 100,
    radius: ability.radius,
    until: 9,
    nextTick: 1,
    ability,
    color: 0,
  }));
  for (const wire of [
    packSnapshot(snap),
    packSnapshot(snap, { compact: true, metaRev: 1 }),
  ]) {
    expect(JSON.stringify(wire)).not.toContain('"ability"');
    const back = unpackSnapshot(JSON.parse(JSON.stringify(wire)));
    back.projectiles.forEach((pr, i) =>
      expect(pr.ability, moves[i].id).toEqual(moves[i]),
    );
    back.zones.forEach((z, i) =>
      expect(z.ability, moves[i].id).toEqual(moves[i]),
    );
  }
});
