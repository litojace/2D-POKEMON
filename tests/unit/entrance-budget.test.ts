import { expect, it } from "vitest";
import {
  ENTRANCE_BUDGET,
  playCollectionEntrance,
} from "../../apps/client/src/skins/collection-fx";
import type { FxParticle } from "../../apps/client/src/skins/skin-fx";
import { LOOK_ITEMS } from "../../packages/shared/src/shop";

/**
 * The fighter's rig keeps 48 particles and drops the oldest for each new one
 * (rig.ts MAX_PARTICLES). An entrance that emitted more lost its own burst,
 * which goes first: Galaxy's and Borealis's Mythical flourish alone is 50,
 * so their own star tunnel and light ribbons never showed.
 */
const rig = (id: string) => {
  const kept: FxParticle[] = [];
  const emitted: FxParticle[] = [];
  playCollectionEntrance(
    (p) => {
      emitted.push(p);
      if (kept.length >= 48) kept.shift();
      kept.push(p);
    },
    id,
    0,
    0,
    1,
  );
  return { kept, emitted };
};

it("keeps every Shop entrance within the rig's particles", () => {
  expect(ENTRANCE_BUDGET).toBe(48);
  const entrances = LOOK_ITEMS.filter((i) => i.slot === "entrance");
  expect(entrances.length).toBeGreaterThanOrEqual(13);
  for (const item of entrances)
    expect(rig(item.id).emitted.length, item.id).toBeLessThanOrEqual(48);
});

it("shows a Mythical entrance's own burst, not just its flourish", () => {
  // Galaxy's star tunnel: rings falling inward and stars rushing in.
  const galaxy = rig("galaxy-entrance").kept;
  expect(galaxy.filter((p) => p.shape === "ring").length).toBe(4);
  expect(galaxy.some((p) => p.shape === "star" && p.color === 0xffffff)).toBe(
    true,
  );
  // Borealis: ribbons of light falling from the sky.
  const borealis = rig("borealis-entrance").kept;
  expect(borealis.some((p) => p.shape === "ray" && p.vy > 300)).toBe(true);
  // The two no longer look alike.
  const shapes = (ps: FxParticle[]) =>
    ps
      .map((p) => p.shape)
      .sort()
      .join();
  expect(shapes(galaxy)).not.toBe(shapes(borealis));
});
