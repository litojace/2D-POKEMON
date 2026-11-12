import { describe, expect, it } from "vitest";
import { GLOOMSHADE, STORM_TWINS as S } from "../../packages/shared/src/raid";
import {
  cellSize,
  packPieces,
  paintSpots,
  type PieceDef,
} from "../../apps/client/src/raid-piece-stage";
import {
  BALL_RADIUS,
  HIT_RING_RADIUS,
  NIGHT_BAND,
  SNUFF_FRAMES,
  hitRing,
  nightAlpha,
  nightSlices,
  pipSpot,
  poolLook,
  relightSparks,
  smokePuffs,
  snuffBlend,
  yardPieces,
} from "../../apps/client/src/raid-yard-pieces";
import {
  FIELD,
  PAD,
  POST,
  bandThickness,
  fieldBolts,
  fieldEdgeLook,
  orbOf,
  paintRingInlay,
  postStates,
  ringPieces,
} from "../../apps/client/src/raid-ring-pieces";

/** A 2D context that records calls, and fails on any pixel read-back. */
function fakeContext() {
  const calls: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const ctx: any = new Proxy(
    {},
    {
      get: (_t, key: string) => {
        if (["getImageData", "toDataURL", "toBlob"].includes(key))
          throw new Error(`read-back: ${key}`);
        return (..._args: unknown[]) => {
          calls.push(key);
          return key.startsWith("create") ? gradient : undefined;
        };
      },
      set: () => true,
    },
  );
  return { ctx, calls };
}
const atlasOf = (defs: PieceDef[]) => {
  const packed = packPieces(defs);
  return { ...packed, texels: packed.width * packed.height };
};
const overlaps = (a: any, b: any) =>
  a.x < b.x + b.pw && b.x < a.x + a.pw && a.y < b.y + b.ph && b.y < a.y + a.ph;

describe("piece atlases", () => {
  it("packs cells inside the atlas without overlapping", () => {
    for (const defs of [yardPieces(150), yardPieces(185), ringPieces()]) {
      const { width, height, spots } = packPieces(defs);
      expect(spots).toHaveLength(defs.length);
      for (const [i, s] of spots.entries()) {
        expect(s.x + s.pw).toBeLessThanOrEqual(width);
        expect(s.y + s.ph).toBeLessThanOrEqual(height);
        expect([s.pw, s.ph]).toEqual(Object.values(cellSize(s.def)));
        for (const o of spots.slice(i + 1)) expect(overlaps(s, o)).toBe(false);
      }
    }
  });
  it("names every piece once, and keeps the atlases a modest size", () => {
    for (const defs of [yardPieces(150), ringPieces()]) {
      const names = defs.map((d) => d.name);
      expect(new Set(names).size).toBe(names.length);
    }
    const yard = atlasOf(yardPieces(150)),
      moon = atlasOf(yardPieces(185)),
      ring = atlasOf(ringPieces());
    // 2048 wide; about 4–6 MB of texture each at most.
    for (const a of [yard, moon, ring]) {
      expect(a.width).toBe(2048);
      expect(a.height).toBeLessThanOrEqual(768);
    }
  });
  it("draws the big light pools at half density", () => {
    const pool = yardPieces(150).find((d) => d.name === "pool150")!;
    expect(cellSize(pool)).toEqual({ pw: 150, ph: 150 });
    const moon = yardPieces(185).find((d) => d.name === "pool185")!;
    expect(cellSize(moon)).toEqual({ pw: 185, ph: 185 });
  });
  it("paints every piece with paths and gradients only (no pixel read-back)", () => {
    for (const defs of [yardPieces(150), yardPieces(185), ringPieces()]) {
      const { ctx, calls } = fakeContext();
      paintSpots(ctx, packPieces(defs).spots);
      expect(calls.length).toBeGreaterThan(1000);
    }
    const { ctx, calls } = fakeContext();
    paintRingInlay(ctx);
    expect(calls).toContain("ellipse");
  });
});

describe("Lantern Yard layout", () => {
  it("centres every light, edge and shade on its lantern, at the exact reach", () => {
    for (const R of [GLOOMSHADE.lightRadius, GLOOMSHADE.moonlitLightRadius]) {
      const defs = new Map(yardPieces(R).map((d) => [d.name, d]));
      for (const name of [
        `pool${R}`,
        `rim${R}`,
        `dark${R}`,
        `snuffEdge${R}`,
        ...Array.from({ length: SNUFF_FRAMES }, (_, f) => `shade${R}_${f}`),
      ]) {
        const d = defs.get(name)!;
        expect([d.ax, d.ay]).toEqual([d.w / 2, d.h / 2]);
      }
      // The edge's line is drawn at R inside a piece 2R + 8 wide.
      expect(defs.get(`rim${R}`)!.w).toBe(R * 2 + 8);
      expect(defs.get(`pool${R}`)!.w).toBe(R * 2);
    }
    const ball = yardPieces(150).find((d) => d.name === "ballRim")!;
    expect(BALL_RADIUS).toBe(160);
    expect([ball.w, ball.ax]).toEqual([BALL_RADIUS * 2 + 8, BALL_RADIUS + 4]);
  });
  it("closes the night in from eight edge frames, never over the middle", () => {
    const W = 1600,
      H = 900,
      slices = nightSlices();
    expect(slices).toHaveLength(8);
    const area = slices.reduce((n, s) => n + s.w * s.h, 0);
    expect(area).toBe(W * H - (W - 2 * NIGHT_BAND) * (H - 2 * NIGHT_BAND));
    for (const [i, a] of slices.entries()) {
      expect(
        a.x <= 800 && 800 < a.x + a.w && a.y <= 450 && 450 < a.y + a.h,
      ).toBe(false);
      for (const b of slices.slice(i + 1))
        expect(
          a.x < b.x + b.w &&
            b.x < a.x + a.w &&
            a.y < b.y + b.h &&
            b.y < a.y + a.h,
        ).toBe(false);
    }
    // As dark as before: 0.1 lit, up to 0.32 with every lantern out.
    expect(nightAlpha(0, 4) * 0.32).toBeCloseTo(0.1);
    expect(nightAlpha(4, 4)).toBeCloseTo(1);
  });
  it("cross-fades the snuff's shade from untouched to swallowed", () => {
    expect(snuffBlend(0)).toEqual({ f0: 0, f1: 1, a0: 1, a1: 0 });
    expect(snuffBlend(1)).toMatchObject({ f1: SNUFF_FRAMES - 1, a1: 1 });
    for (let p = 0; p <= 1; p += 0.05) {
      const b = snuffBlend(p);
      expect(b.a0 + b.a1).toBeCloseTo(1);
      expect(b.f1).toBe(b.f0 + 1);
    }
  });
  it("keeps the pool's size while lit; only the fill flickers", () => {
    for (let t = 0; t < 3; t += 0.1) {
      const look = poolLook(1, t, false);
      expect(look.scale).toBe(1);
      expect(look.alpha).toBeGreaterThan(0.8);
      expect(look.alpha).toBeLessThanOrEqual(1);
    }
    // Reduced motion: no flicker.
    expect(poolLook(2, 1.3, true)).toEqual({ alpha: 1, scale: 1 });
    // Snuffing shrinks the warm fill; a relight spreads it back in 0.35 s.
    expect(poolLook(0, 0, true, 1).scale).toBeCloseTo(0.12);
    expect(poolLook(0, 0, true, undefined, 0)).toEqual({
      alpha: 0,
      scale: 0.6,
    });
    expect(poolLook(0, 0, true, undefined, 0.35)).toEqual({
      alpha: 1,
      scale: 1,
    });
  });
  it("keeps the hit pips and the hit-me ring where and when they were", () => {
    expect(pipSpot(330, 210, 0)).toEqual({ x: 323, y: 126 });
    expect(pipSpot(330, 210, 1)).toEqual({ x: 337, y: 126 });
    for (let t = 0; t < 4; t += 0.07) {
      const ring = hitRing(t, false);
      // The old ring: 22 + ((t * 0.9) % 1) * 26.
      expect(ring.radius).toBeCloseTo(22 + ((t * 0.9) % 1) * 26);
      expect(ring.scale * HIT_RING_RADIUS).toBeCloseTo(ring.radius);
    }
    expect(hitRing(5, true).radius).toBe(35);
  });
  it("throws relight sparks up and lets them burn out", () => {
    expect(relightSparks(0, 0, 0)).toHaveLength(12);
    expect(relightSparks(0, 0, 0, 4)).toHaveLength(4);
    expect(relightSparks(0, 0, 1)).toHaveLength(0);
    const early = relightSparks(0, 0, 0.2);
    expect(early.every((s) => s.alpha > 0 && s.alpha < 1)).toBe(true);
    // Reduced motion: the smoke curl holds still.
    expect(smokePuffs(0, 0, 1, 0, true)).toEqual(smokePuffs(0, 0, 1, 9, true));
  });
});

describe("conductor ring layout", () => {
  it("keeps the gameplay sizes: pad rim 58, field edge 100, beam band 44", () => {
    expect(PAD.r).toBe(S.polarity.padRadius);
    expect(FIELD.r).toBe(S.field.radius);
    const defs = new Map(ringPieces().map((d) => [d.name, d]));
    for (const n of ["padPlate", "padSignPlus", "padSignMinus"])
      expect([defs.get(n)!.ax, defs.get(n)!.w]).toEqual([75, 150]);
    for (const n of ["fieldDisc", "fieldEdge0", "fieldEdge1"])
      expect([defs.get(n)!.ax, defs.get(n)!.w]).toEqual([115, 230]);
    // The band piece is 52 tall with its band in the middle 44.
    expect(bandThickness(S.link.width * 2)).toBe(52);
    expect(defs.get("band")!.h).toBe(52);
  });
  it("stands the taller posts on the same spot, their orb about 46 px up", () => {
    const post = ringPieces().find((d) => d.name === "post")!;
    // Anchored at the post's point (where it collides and sorts, as before),
    // the cell reaching 62 px above it and 28 below (its plinth).
    expect([post.ax, post.ay]).toEqual([POST.ox, POST.oy]);
    expect(post.ay).toBeCloseTo(62.4);
    expect(post.h - post.ay).toBeCloseTo(27.6);
    expect(orbOf(600, 260).y).toBeCloseTo(260 - 45.6);
  });
  it("marks each post idle, charging or conducting", () => {
    expect(postStates(4, undefined, undefined)).toEqual([
      "idle",
      "idle",
      "idle",
      "idle",
    ]);
    expect(postStates(4, 2, 0)).toEqual(["charge", "idle", "conduct", "idle"]);
  });
  it("turns the field's bolts about its centre, and holds still with reduced motion", () => {
    for (const b of fieldBolts(500, 400, 100, 1.7)) {
      expect((b.a.x + b.b.x) / 2).toBeCloseTo(500);
      expect((b.a.y + b.b.y) / 2).toBeCloseTo(400);
      expect(Math.hypot(b.a.x - 500, b.a.y - 400)).toBeCloseTo(70);
    }
    expect(fieldEdgeLook(0.3, 1, true)).toEqual(fieldEdgeLook(5.9, 1, true));
    expect(fieldEdgeLook(0.3, 1, false)).not.toEqual(
      fieldEdgeLook(5.9, 1, false),
    );
  });
});
