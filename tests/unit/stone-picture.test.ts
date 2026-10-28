import { describe, expect, it } from "vitest";
import { OBSTACLES, blocked } from "@arena/shared";
import { BLOCK_H, BLOCK_PAD, courtBlockFrame, stoneBase } from "../../apps/client/src/arena-courts";

describe("stone blocks: what you see is what's solid", () => {
  it("draws each block's picture over exactly its footprint", () => {
    for (const o of OBSTACLES) {
      const f = courtBlockFrame(o);
      // The picture (without its padding) is the footprint: top face at the
      // back edge, front face ending at the front edge.
      expect(f.x + BLOCK_PAD).toBe(o.x);
      expect(f.y + BLOCK_PAD).toBe(o.y);
      expect(f.w - BLOCK_PAD * 2).toBe(o.w);
      expect(f.h - BLOCK_PAD * 2).toBe(o.h);
      // The base it stands on is the footprint's front part.
      const b = stoneBase(o);
      expect(b.y - BLOCK_H).toBe(o.y);
      expect(b.y + b.h).toBe(o.y + o.h);
      expect(b.h).toBeGreaterThan(0);
    }
  });

  it("keeps movement exactly as before (the footprint is the solid area)", () => {
    const o = OBSTACLES[0];
    // Just behind and just in front of the block's footprint are open.
    expect(blocked(o.x + o.w / 2, o.y - 25)).toBe(false);
    expect(blocked(o.x + o.w / 2, o.y + o.h + 25)).toBe(false);
    // Anywhere on the drawn stone is solid, including its raised top.
    expect(blocked(o.x + o.w / 2, o.y + 5)).toBe(true);
    expect(blocked(o.x + o.w / 2, o.y + o.h - 5)).toBe(true);
  });
});
