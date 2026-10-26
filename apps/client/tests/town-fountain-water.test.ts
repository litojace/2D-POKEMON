import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import { FOUNTAIN } from "../src/town-art";
import {
  FOUNTAIN_STREAMS,
  drawFountainWater,
  streamPoint,
} from "../src/town-fountain-water";

describe("painted fountain cascades", () => {
  it("starts at the two bowl rims and lands within the next pool", () => {
    for (const stream of FOUNTAIN_STREAMS) {
      const target =
        stream.source === "spout"
          ? FOUNTAIN.top
          : stream.source === "top"
            ? FOUNTAIN.mid
            : FOUNTAIN.pool;
      if (stream.source === "spout") {
        expect(Math.abs(stream.start.x)).toBeLessThanOrEqual(3);
        expect(
          Math.abs(stream.start.y - FOUNTAIN.spout.dy),
        ).toBeLessThanOrEqual(1);
      } else {
        const from = FOUNTAIN[stream.source];
        expect(
          Math.hypot(
            stream.start.x / (from.rx - 0.5),
            (stream.start.y - from.dy - 1) / from.ry,
          ),
        ).toBeCloseTo(1);
      }
      expect(
        Math.hypot(
          stream.end.x / (target.rx - 5),
          (stream.end.y - target.dy) / (target.ry - 2),
        ),
      ).toBeLessThan(1);
      expect(streamPoint(stream, 0)).toEqual(stream.start);
      expect(streamPoint(stream, 1)).toEqual(stream.end);
    }
  });

  it("accelerates downward without reversing or leaving the landing path", () => {
    for (const stream of FOUNTAIN_STREAMS) {
      expect(stream.period).toBeGreaterThan(0);
      let previous = stream.start.y;
      for (let k = 1; k <= 20; k++) {
        const p = streamPoint(stream, k / 20);
        expect(p.y).toBeGreaterThan(previous);
        expect(Number.isFinite(p.x)).toBe(true);
        previous = p.y;
      }
      const early = streamPoint(stream, 0.25).y - stream.start.y;
      const late = stream.end.y - streamPoint(stream, 0.75).y;
      expect(late).toBeGreaterThan(early * 2);
    }
  });

  const record = (time: number, reduced: boolean) => {
    const calls: unknown[][] = [];
    const layer = (name: string) => {
      const g = Object.fromEntries(
        [
          "clear",
          "setPosition",
          "lineStyle",
          "strokePoints",
          "fillStyle",
          "fillEllipse",
          "strokeEllipse",
          "fillCircle",
        ].map((method) => [
          method,
          (...args: unknown[]) => {
            calls.push([name, method, ...args]);
            return g;
          },
        ]),
      );
      return g as unknown as Phaser.GameObjects.Graphics;
    };
    drawFountainWater(
      layer("behind"),
      layer("front"),
      1600,
      1080,
      time,
      reduced,
    );
    return calls;
  };

  it("animates falling highlights and splashes on both depth layers", () => {
    const first = record(1, false),
      next = record(1.17, false);
    expect(first).not.toEqual(next);
    for (const name of ["behind", "front"]) {
      expect(first.some((c) => c[0] === name && c[1] === "strokePoints")).toBe(
        true,
      );
      expect(first.some((c) => c[0] === name && c[1] === "strokeEllipse")).toBe(
        true,
      );
    }
    expect(new Set(FOUNTAIN_STREAMS.map((s) => s.phase)).size).toBeGreaterThan(
      20,
    );
  });

  it("keeps the waterfall still when reduced motion is enabled", () => {
    expect(record(1, true)).toEqual(record(9, true));
    expect(record(1, true).some((c) => c[1] === "fillCircle")).toBe(false);
  });
});
