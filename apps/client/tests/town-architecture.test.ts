import { describe, expect, it } from "vitest";
import { TOWN_BUILDINGS } from "../../../packages/shared/src/town";
import { ARCHITECTURE, paintedBuilding } from "../src/town-architecture";

describe("painted town architecture", () => {
  it("keeps complete object crops inside their actual source atlas", () => {
    const sizes = {
      coliseum: [1254, 1254],
      raidHall: [1585, 992],
      buildings: [1024, 1536],
    };
    for (const frame of Object.values(ARCHITECTURE)) {
      const [x, y, w, h] = frame.crop,
        [sw, sh] = sizes[frame.asset];
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(sw);
      expect(y + h).toBeLessThanOrEqual(sh);
      expect(frame.anchor[0]).toBeGreaterThan(x);
      expect(frame.anchor[0]).toBeLessThan(x + w);
      expect(frame.anchor[1]).toBeGreaterThan(y);
      expect(frame.anchor[1]).toBeLessThan(y + h);
    }
  });
  it("keeps effects attached inside padded sprites and spinning sails above ground", () => {
    for (const b of TOWN_BUILDINGS) {
      const art = paintedBuilding({} as CanvasImageSource, b);
      for (const point of [
        ...art.flags,
        ...art.flames,
        ...(art.chimney ? [art.chimney] : []),
        ...(art.hub ? [art.hub] : []),
      ]) {
        expect(point.x + art.sprite.ax).toBeGreaterThanOrEqual(0);
        expect(point.x + art.sprite.ax).toBeLessThanOrEqual(art.sprite.w);
        expect(point.y + art.sprite.ay).toBeGreaterThanOrEqual(0);
        expect(point.y + art.sprite.ay).toBeLessThanOrEqual(art.sprite.h);
      }
      for (const flag of art.flags)
        expect(flag.y + art.sprite.ay - 44).toBeGreaterThanOrEqual(0);
      if (art.hub) expect(art.hub.y + 160 * art.rotorScale).toBeLessThan(50);
    }
  });
});
