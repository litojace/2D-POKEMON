import { describe, expect, it } from "vitest";
import {
  EMBERWING as E,
  brazierLifetime,
} from "../../packages/shared/src/raid";
import {
  RING_FLAMES_MAX,
  SCORCH_R,
  TRAIL_L,
  brazierLook,
  packTerrace,
  patchFlames,
  ringFlames,
  terracePieces,
  trailPlacement,
} from "../../apps/client/src/raid-emberwing-terrace";
import { TERRACE_Q } from "../../apps/client/src/raid-emberwing-terrace-rig";

const raid = { time: 100, airborne: true, partySize: 2, phase: 1, peril: 1 };

describe("Emberwing's terrace", () => {
  it("colours each brazier by what it means: grey, teal to light, gold lit", () => {
    expect(
      brazierLook({ progress: 0, litUntil: 0 }, { ...raid, airborne: false })
        .ring,
    ).toBe("grey");
    expect(brazierLook({ progress: 0, litUntil: 0 }, raid).ring).toBe("teal");
    // Updraft: not for the first 2 seconds after take-off.
    const up = { ...raid, trait: "updraft" };
    expect(
      brazierLook({ progress: 0, litUntil: 0 }, { ...up, takeoffAt: 99 }).ring,
    ).toBe("grey");
    expect(
      brazierLook({ progress: 0, litUntil: 0 }, { ...up, takeoffAt: 97 }).ring,
    ).toBe("teal");
    expect(
      brazierLook({ progress: 0, litUntil: 103 }, { ...raid, airborne: false })
        .ring,
    ).toBe("gold");
  });

  it("shows the lighting progress and the time left, and a fire that grows then dies down", () => {
    const cold = brazierLook({ progress: 0, litUntil: 0 }, raid);
    expect(cold).toMatchObject({ progress: 0, flame: 0, heat: 0, lit: false });
    const lighting = brazierLook({ progress: 0.6, litUntil: 0 }, raid);
    expect(lighting.progress).toBe(0.6);
    expect(lighting.flame).toBeGreaterThan(0);
    expect(lighting.left).toBeUndefined();
    const life = brazierLifetime(2, 1, 1);
    const lit = brazierLook({ progress: 0, litUntil: 100 + life * 0.8 }, raid);
    expect(lit.left).toBeCloseTo(0.8);
    expect(lit).toMatchObject({ progress: 0, flame: 1, dying: false });
    const dying = brazierLook(
      { progress: 0, litUntil: 100 + life * 0.1 },
      raid,
    );
    expect(dying.dying).toBe(true);
    expect(dying.flame).toBeLessThan(1);
    expect(dying.flame).toBeGreaterThan(lighting.flame - 0.2);
    // Solo keeps its longer timer.
    const solo = brazierLook(
      { progress: 0, litUntil: 106 },
      { ...raid, partySize: 1 },
    );
    expect(solo.left).toBeCloseTo(6 / brazierLifetime(1, 1, 1));
  });

  it("puts a burning patch's flames inside its exact radius, more on big patches", () => {
    for (const radius of [30, 60, 119, 120, 180]) {
      const fl = patchFlames({ id: 2, x: 500, y: 400, radius });
      expect(fl).toHaveLength(radius >= 120 ? 6 : 4);
      for (const f of fl)
        expect(Math.hypot(f.x - 500, f.y - 400)).toBeLessThan(radius);
    }
  });

  it("keeps a flame ring cheap: flames on its exact radius, at most a fixed count", () => {
    const big = ringFlames({ x: 800, y: 450 }, 900, {
      x0: -1e4,
      y0: -1e4,
      x1: 1e4,
      y1: 1e4,
    });
    expect(big).toHaveLength(RING_FLAMES_MAX);
    // Spread out, each grows (capped), so a big ring still reads as fire.
    expect(big[0].s / (big[1].s / 0.88)).toBeGreaterThan(1);
    for (const f of big)
      expect(Math.hypot(f.x - 800, f.y - 450)).toBeCloseTo(900, 6);
    expect(ringFlames({ x: 800, y: 450 }, 40)).toHaveLength(10);
    // Off-screen flames are not drawn.
    const edge = ringFlames({ x: 1100, y: 480 }, 900);
    expect(edge.length).toBeLessThan(RING_FLAMES_MAX);
    for (const f of edge) expect(f.x).toBeLessThanOrEqual(1624);
  });

  it("lays the dive lane exactly 2 × its width across, along the dive", () => {
    const f = { x: 1180, y: 440, tx: 690, ty: 410, width: E.dive.width };
    const p = trailPlacement(f);
    expect(Math.hypot(p.nx, p.ny)).toBeCloseTo(E.dive.width, 9);
    // Perpendicular to the dive.
    expect(p.nx * (f.tx - f.x) + p.ny * (f.ty - f.y)).toBeCloseTo(0, 6);
    expect(p.sy).toBe(1);
    expect(p.sx * TRAIL_L).toBeCloseTo(p.len + 2 * E.dive.width * 0.6, 6);
    const trail = terracePieces().find((q) => q.name === "trail")!;
    // The trail piece's band is 2 × 38 across (plus a 2 px margin each side).
    expect(trail.h).toBe(E.dive.width * 2 + 4);
    expect(trailPlacement({ ...f, width: 19 }).sy).toBe(0.5);
  });

  it("draws the burning ground at a known radius, scaled to each patch", () => {
    const scorch = terracePieces().find((q) => q.name === "scorch")!;
    expect(scorch.w).toBe(SCORCH_R * 2 + 4);
  });

  it("packs its atlas without overlaps, well under 10 MB", () => {
    const { width, height, spots } = packTerrace(TERRACE_Q);
    expect(width * height * 4).toBeLessThan(6_000_000);
    for (const a of spots) {
      expect(a.x + a.w).toBeLessThanOrEqual(width);
      for (const b of spots)
        if (a !== b)
          expect(
            a.x + a.w <= b.x ||
              b.x + b.w <= a.x ||
              a.y + a.h <= b.y ||
              b.y + b.h <= a.y,
          ).toBe(true);
    }
  });
});
