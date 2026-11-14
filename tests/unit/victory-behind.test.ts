import { afterEach, expect, it, vi } from "vitest";
import { JOURNEY_ITEMS } from "../../packages/shared/src/journey";
import { RAID_REWARDS } from "../../packages/shared/src/raid";
import { LOOK_ITEMS } from "../../packages/shared/src/shop";
import { drawCollectionVictory } from "../../apps/client/src/skins/collection-fx";
import { SKIN_ART } from "../../apps/client/src/skins/skin-art";
import {
  drawSkinFx,
  type FxContext,
  type FxParticle,
} from "../../apps/client/src/skins/skin-fx";

/**
 * Victory effects play behind the champion: nothing they draw or emit may
 * land on the layer in front of the fighter, where it would cover its face.
 */
function graphics() {
  const commands: unknown[][] = [];
  const g: any = new Proxy(
    {},
    {
      get:
        (_t, k) =>
        (...args: unknown[]) => {
          commands.push([k, ...args]);
          return g;
        },
    },
  );
  return { g, commands };
}

afterEach(() => vi.restoreAllMocks());

const VICTORIES = [
  ...new Set(
    [...LOOK_ITEMS, ...RAID_REWARDS, ...JOURNEY_ITEMS]
      .filter((i) => i.slot === "victory")
      .map((i) => i.id),
  ),
];

it("knows every victory piece", () => {
  expect(VICTORIES.length).toBeGreaterThan(10);
  expect(VICTORIES).toContain("eclipse-finale");
});

it.each(VICTORIES)(
  "%s draws only behind the fighter and emits every particle behind it",
  (id) => {
    const front = graphics(),
      back = graphics(),
      particles: FxParticle[] = [];
    const dt = 1 / 30;
    for (let t = 0; t <= 3; t += dt)
      drawCollectionVictory(
        front.g,
        back.g,
        (p) => particles.push(p),
        // Every random extra fires, so none can hide.
        () => true,
        id,
        0,
        0,
        1,
        t,
        dt,
        t === 0,
      );
    expect(front.commands, id).toEqual([]);
    expect(
      particles.every((p) => p.behind),
      id,
    ).toBe(true);
  },
);

const MYTHICS = Object.entries(SKIN_ART).filter(([, art]) => art.mythic);

it.each(MYTHICS.map(([skin]) => skin))(
  "%s keeps its victory sword and burst behind the fighter",
  (skin) => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    // The same frames with and without the victory: the front layer must
    // not change, and every particle the victory adds must be behind.
    const run = (celebrate: boolean) => {
      const front = graphics(),
        back = graphics(),
        particles: FxParticle[] = [];
      for (let i = 0; i < 40; i++) {
        const ctx: FxContext = {
          g: front.g,
          under: back.g,
          emit: (p) => particles.push(p),
          chance: () => false,
          x: 200,
          y: 174,
          headX: 200,
          headY: 130,
          sc: 2,
          now: 1000 + i * 33,
          dt: 0.033,
          angle: Math.PI / 2,
          moving: false,
          dashing: false,
          hurt: false,
          defeated: false,
          greeting: false,
          celebrating: celebrate && i === 0,
          knockedOut: false,
          ultimate: false,
          ambient: true,
        };
        drawSkinFx(ctx, SKIN_ART[skin], 3);
      }
      return { front: front.commands, back: back.commands, particles };
    };
    const plain = run(false),
      won = run(true);
    expect(won.front).toEqual(plain.front);
    expect(won.back.length).toBeGreaterThan(plain.back.length);
    const added = won.particles.slice(plain.particles.length);
    expect(won.particles.length).toBeGreaterThan(plain.particles.length);
    expect(added.every((p) => p.behind)).toBe(true);
  },
);
