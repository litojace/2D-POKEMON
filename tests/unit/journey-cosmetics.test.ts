import { it, expect, vi } from "vitest";
import { JOURNEY_ITEMS } from "../../packages/shared/src/journey";
import {
  SKINS,
  TONES,
  tonePixels,
  type Skin,
} from "../../apps/client/src/animation/cosmetics";
import {
  drawCollectionAura,
  drawCollectionVictory,
  playCollectionEntrance,
} from "../../apps/client/src/skins/collection-fx";
function graphics() {
  const commands: any[] = [];
  const g: any = new Proxy(
    {},
    {
      get:
        (_t, k) =>
        (...args: any[]) => {
          commands.push([k, ...args]);
          return g;
        },
    },
  );
  return { g, commands };
}
it.each(JOURNEY_ITEMS.filter((i) => i.slot === "aura"))(
  "animates $id with bounded geometry and a still reduced-motion version",
  (item) => {
    const a = graphics(),
      b = graphics();
    expect(drawCollectionAura(a.g, item.id, 0, 0, 1000, false)).toBe(true);
    expect(drawCollectionAura(b.g, item.id, 0, 0, 1800, false)).toBe(true);
    expect(a.commands.length).toBeLessThan(40);
    expect(a.commands).not.toEqual(b.commands);
    const c = graphics(),
      d = graphics();
    drawCollectionAura(c.g, item.id, 0, 0, 1000, true);
    drawCollectionAura(d.g, item.id, 0, 0, 1800, true);
    expect(c.commands).toEqual(d.commands);
  },
);
it.each(JOURNEY_ITEMS.filter((i) => i.slot === "victory"))(
  "draws the real $id finale and emits its initial particles only once",
  (item) => {
    const a = graphics(),
      emit = vi.fn();
    expect(
      drawCollectionVictory(
        a.g,
        a.g,
        emit,
        () => true,
        item.id,
        0,
        0,
        1,
        1,
        1 / 60,
        true,
      ),
    ).toBe(true);
    expect(emit).toHaveBeenCalledTimes(12);
    drawCollectionVictory(
      a.g,
      a.g,
      emit,
      () => true,
      item.id,
      0,
      0,
      1,
      1.1,
      1 / 60,
      false,
    );
    expect(emit).toHaveBeenCalledTimes(12);
  },
);
it("implements the Comet arrival entrance and every earned color palette", () => {
  const emit = vi.fn();
  expect(playCollectionEntrance(emit, "comet-arrival", 0, 0, 1)).toBe(true);
  expect(emit).toHaveBeenCalledTimes(18);
  for (const item of JOURNEY_ITEMS.filter((i) => i.slot === "skin")) {
    expect(SKINS).toContain(item.id);
    expect(TONES[item.id as Skin]).toBeDefined();
    const pixels = new Uint8ClampedArray([220, 140, 60, 255, 90, 40, 80, 127]);
    tonePixels(pixels, item.id as Skin);
    expect([...pixels]).not.toEqual([220, 140, 60, 255, 90, 40, 80, 127]);
    expect(pixels[3]).toBe(255);
    expect(pixels[7]).toBe(127);
  }
});
