import { describe, expect, it } from "vitest";
import {
  DRAWN_ENTRANCES,
  drawCollectionEntrance,
} from "../../apps/client/src/skins/collection-fx";
import { canvasGraphics } from "../../apps/client/src/skins/fx-canvas";
import { LOOK_ITEMS } from "../../packages/shared/src/shop";
import { RAID_COSMETICS } from "../../packages/shared/src/raid";
import {
  drawWornBehind,
  greetWearer,
  type Wearer,
} from "../../apps/client/src/plaza/plaza-cosmetics";

/**
 * Entrances that draw over the greeting as well as bursting: Rainbow's arch
 * (owner 26 Nov: "Rainbow entrance chưa đặc biệt lắm") and the seven raid
 * bosses' entrances (owner 26 Nov: the boss effects were outdated). The
 * same drawing runs in a match (the rig), on the Shop's and Wardrobe's
 * stage, in every thumbnail (the canvas stand-in) and in the Plaza.
 */

/** A 2D context that records what is drawn and where. */
function recorder() {
  const calls: string[] = [];
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    line = 0;
  // The current path's shapes, counted once it is filled (as drawn) or
  // stroked (half the line's width further out).
  let path: [number, number, number, number][] = [];
  const paint = (pad: number) => {
    for (const [x0, y0, x1, y1] of path) {
      minX = Math.min(minX, x0 - pad);
      maxX = Math.max(maxX, x1 + pad);
      minY = Math.min(minY, y0 - pad);
      maxY = Math.max(maxY, y1 + pad);
    }
    path = [];
  };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, key: string) {
      if (key in target) return target[key];
      return (...a: number[]) => {
        calls.push(key);
        if (key === "beginPath") path = [];
        else if (key === "fill") paint(0);
        else if (key === "stroke") paint(line / 2);
        else if (key === "arc") {
          const [x, y, r, start, end] = a;
          // A rainbow band is part of an upper half (π..2π); a circle
          // (fillCircle) is a whole turn.
          if (start >= Math.PI - 1e-9 && end <= 2 * Math.PI + 1e-9)
            calls[calls.length - 1] = "arch";
          for (let i = 0; i <= 64; i++) {
            const t = start + ((end - start) * i) / 64;
            const px = x + Math.cos(t) * r,
              py = y + Math.sin(t) * r;
            path.push([px, py, px, py]);
          }
        } else if (key === "ellipse") {
          const [x, y, rx, ry] = a;
          path.push([x - rx, y - ry, x + rx, y + ry]);
        } else if (key === "moveTo" || key === "lineTo") {
          const [x, y] = a;
          path.push([x, y, x, y]);
        }
      };
    },
    set(target, key: string, v) {
      target[key] = v;
      if (key === "lineWidth") line = v as number;
      return true;
    },
  });
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    g: canvasGraphics(ctx as unknown as CanvasRenderingContext2D),
    calls,
    bounds: () => ({ minX, maxX, minY, maxY }),
  };
}
const G = (r: ReturnType<typeof recorder>) =>
  r.g as unknown as Parameters<typeof drawCollectionEntrance>[0];

describe("entrances that draw", () => {
  const raid = Object.entries(RAID_COSMETICS)
    .filter(([, v]) => v.slot === "entrance")
    .map(([id]) => id);
  it("are the Rainbow and every raid boss's entrance, and only they draw", () => {
    const entrances = [
      ...LOOK_ITEMS.filter((i) => i.slot === "entrance").map((i) => i.id),
      ...raid,
    ];
    expect(raid).toHaveLength(7);
    expect(Object.keys(DRAWN_ENTRANCES).sort()).toEqual(
      ["rainbow-entrance", ...raid].sort(),
    );
    for (const id of Object.keys(DRAWN_ENTRANCES))
      expect(entrances, id).toContain(id);
    for (const id of entrances) {
      const r = recorder();
      expect(drawCollectionEntrance(G(r), id, 0, 0, 1, 0.5), id).toBe(
        id in DRAWN_ENTRANCES,
      );
      if (!(id in DRAWN_ENTRANCES)) expect(r.calls, id).toEqual([]);
    }
  });

  it("Rainbow's arch springs over, stands with all six bands, then is gone", () => {
    const { length } = DRAWN_ENTRANCES["rainbow-entrance"];
    const arcs = (t: number) => {
      const r = recorder();
      drawCollectionEntrance(G(r), "rainbow-entrance", 0, 0, 1, t);
      return r.calls.filter((c) => c === "arch").length;
    };
    // At once: the first cloud, the arch only just starting.
    expect(arcs(0)).toBe(0);
    // Standing: six bands and a rim (and a sheen while it runs).
    expect(arcs(0.3)).toBeGreaterThanOrEqual(7);
    expect(arcs(1.4)).toBe(7);
    // Played: nothing more, and the call says so.
    const r = recorder();
    expect(
      drawCollectionEntrance(G(r), "rainbow-entrance", 0, 0, 1, length + 0.01),
    ).toBe(false);
    expect(r.calls).toEqual([]);
    expect(length).toBeLessThan(2.5);
  });

  it("each draws through its greeting, shows at its still, then stops", () => {
    for (const [id, d] of Object.entries(DRAWN_ENTRANCES)) {
      expect(d.still, id).toBeLessThan(d.length);
      expect(d.length, id).toBeLessThanOrEqual(2.2);
      const painted = (t: number) => {
        const r = recorder();
        drawCollectionEntrance(G(r), id, 0, 0, 1, t);
        return r.calls.filter((c) => c === "fill" || c === "stroke").length;
      };
      expect(painted(d.still), id).toBeGreaterThan(5);
      expect(painted(d.length + 0.01), id).toBe(0);
    }
  });

  it("fits its thumbnail's frame at every moment", () => {
    for (const [id, d] of Object.entries(DRAWN_ENTRANCES)) {
      const r = recorder();
      for (let t = 0; t <= d.length; t += 0.02)
        drawCollectionEntrance(G(r), id, 0, 0, 1, t);
      const b = r.bounds();
      // The frame: reach.w wide, the origin `feet` of the way down.
      expect(b.minX, id).toBeGreaterThanOrEqual(-d.reach.w / 2);
      expect(b.maxX, id).toBeLessThanOrEqual(d.reach.w / 2);
      expect(b.minY, id).toBeGreaterThanOrEqual(-d.reach.h * d.reach.feet);
      expect(b.maxY, id).toBeLessThanOrEqual(d.reach.h * (1 - d.reach.feet));
      // And it uses most of it (the frame is centred on the fighter): the
      // tile shows the effect, not a speck.
      expect(2 * Math.max(-b.minX, b.maxX), id).toBeGreaterThan(
        d.reach.w * 0.85,
      );
      expect(d.still, id).toBeLessThan(d.length);
    }
  });

  it("draws in the Plaza for the nearest players, then stops", () => {
    const frames = (full: boolean) => {
      const r = recorder();
      const b: Wearer = {
        x: 500,
        y: 600,
        z: 0,
        character: "voltkit",
        entrance: "rainbow-entrance",
      };
      greetWearer(b);
      const arcs: number[] = [];
      for (let i = 0; i < 60; i++) {
        const before = r.calls.length;
        drawWornBehind(r.ctx, b, {
          reduced: false,
          low: false,
          full,
          now: 1000 + i * 50,
        });
        arcs.push(r.calls.slice(before).filter((c) => c === "arch").length);
      }
      return arcs;
    };
    const near = frames(true);
    expect(near.slice(10, 30).every((n) => n >= 7)).toBe(true);
    // Done by 2.5 s.
    expect(near.slice(50).every((n) => n === 0)).toBe(true);
    // Far away: the burst only, no arch.
    expect(frames(false).every((n) => n === 0)).toBe(true);
  });
});
