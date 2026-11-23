import { describe, expect, it } from "vitest";

import { RAID_BOSS_ARENA } from "../../apps/client/src/raid-arena-art";
import {
  RAID_WORLDS,
  WORLD,
  WORLD_DENSITY,
} from "../../apps/client/src/world-art";

describe("the raid worlds painted in code", () => {
  it("every boss's arena has a painter, and nothing else does", () => {
    expect(Object.keys(RAID_WORLDS).sort()).toEqual(
      [...new Set(Object.values(RAID_BOSS_ARENA))].sort(),
    );
  });

  it("each world is centred on the court and reaches past every landscape view", () => {
    expect(WORLD.x + WORLD.width / 2).toBe(800);
    expect(WORLD.y + WORLD.height / 2).toBe(450);
    // A 2.2:1 phone below the raid HUD sees about 850 px past each side at
    // the whole-court zoom (raid-camera.ts).
    expect(-WORLD.x).toBeGreaterThanOrEqual(900);
    expect(-WORLD.y).toBeGreaterThanOrEqual(600);
  });

  it("the painting round the court stays one texture of about 8 MB", () => {
    const px =
      Math.round(WORLD.width * WORLD_DENSITY) *
      Math.round(WORLD.height * WORLD_DENSITY);
    expect(px * 4).toBeLessThanOrEqual(8_000_000);
  });

  it("each world names the colour it fades to at its edges", () => {
    for (const [id, w] of Object.entries(RAID_WORLDS))
      expect(w.edge, id).toMatch(/^rgba\(\d+,\d+,\d+,1\)$/);
  });
});
