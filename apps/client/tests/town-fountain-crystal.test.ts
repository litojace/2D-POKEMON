import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import { FOUNTAIN } from "../src/town-art";
import {
  drawFountainCrystal,
  fountainCrystalPose,
} from "../src/town-fountain-crystal";

describe("hovering fountain crystal", () => {
  it("keeps a real gap above the socket throughout a complete hover cycle", () => {
    const heights = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const pose = fountainCrystalPose(i / 20);
      expect(
        FOUNTAIN.spout.dy - (pose.y + FOUNTAIN.crystal.ry),
      ).toBeGreaterThanOrEqual(3.99);
      expect(pose.width).toBeGreaterThan(0);
      heights.add(pose.y);
    }
    expect(heights.size).toBeGreaterThan(100);
  });
  const record = (time: number, reduced: boolean) => {
    const calls: unknown[][] = [];
    const g = Object.fromEntries(
      [
        "clear",
        "setPosition",
        "fillStyle",
        "fillEllipse",
        "lineStyle",
        "fillCircle",
        "lineBetween",
        "fillTriangle",
      ].map((method) => [
        method,
        (...args: unknown[]) => {
          calls.push([method, ...args]);
          return g;
        },
      ]),
    ) as unknown as Phaser.GameObjects.Graphics;
    drawFountainCrystal(g, 1600, 1080, time, reduced);
    return calls;
  };
  it("moves its facets, glow and glints, and freezes all motion when requested", () => {
    expect(record(1, false)).not.toEqual(record(2, false));
    expect(record(1, true)).toEqual(record(9, true));
    for (const call of record(1, false))
      for (const value of call)
        if (typeof value === "number")
          expect(Number.isFinite(value)).toBe(true);
  });
});
