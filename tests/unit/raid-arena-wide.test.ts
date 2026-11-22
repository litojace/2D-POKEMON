import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { RAID_ARENA_ART } from "../../apps/client/src/raid-arena-art";
import {
  RAID_ARENA_WIDE,
  RAID_WIDE_BOUNDS,
} from "../../apps/client/src/raid-arena-wide";

const DIR = "apps/client/src/art/raid-arenas-wide";

/** A WebP's pixel size from its header (VP8 or VP8X). */
function webpSize(file: string) {
  const b = readFileSync(file);
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8 ")
    return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8X")
    return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  if (chunk === "VP8L") {
    const n = b.readUInt32LE(21);
    return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 };
  }
  throw new Error(`${file}: not a WebP`);
}

describe("the world round each raid court", () => {
  it("every illustrated raid court has one", () => {
    expect(Object.keys(RAID_ARENA_WIDE).sort()).toEqual(
      Object.keys(RAID_ARENA_ART).sort(),
    );
    expect(readdirSync(DIR).sort()).toEqual(
      Object.keys(RAID_ARENA_ART)
        .map((id) => `${id}.webp`)
        .sort(),
    );
  });

  it("is centred on the court and reaches past every view", () => {
    const b = RAID_WIDE_BOUNDS;
    expect(b.x + b.width / 2).toBe(800);
    expect(b.y + b.height / 2).toBe(450);
    // A 2.2:1 phone below the raid HUD sees about 850 px past each side at
    // the whole-court zoom (raid-camera.ts).
    expect(-b.x).toBeGreaterThanOrEqual(900);
    expect(-b.y).toBeGreaterThanOrEqual(300);
  });

  it("each picture has the rectangle's shape, small enough for older phones", () => {
    const shape = RAID_WIDE_BOUNDS.width / RAID_WIDE_BOUNDS.height;
    for (const file of readdirSync(DIR)) {
      const { w, h } = webpSize(`${DIR}/${file}`);
      // Stretched by under 1%: nothing on it looks squashed.
      expect(Math.abs(w / h / shape - 1), file).toBeLessThan(0.01);
      // One GPU texture of at most about 8 MB, well inside a 4096 limit.
      expect(w * h * 4, file).toBeLessThanOrEqual(8_000_000);
      expect(readFileSync(`${DIR}/${file}`).length, file).toBeLessThan(450_000);
    }
  });
});
