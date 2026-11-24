import { describe, expect, it } from "vitest";
import {
  FACING,
  lotlFacing,
  tidelotlIdle,
  tidelotlPieces,
  tidelotlPlacements,
  tidelotlPose,
  type LotlCue,
} from "../../apps/client/src/boss-tidelotl";

const cue = (o: Partial<LotlCue> = {}): LotlCue => ({
  clock: 1,
  phase: 1,
  reduced: false,
  windup: 0,
  castAge: 99,
  stranded: false,
  stagger: false,
  hurt: 0,
  dead: false,
  rise: 1,
  deathSink: 0,
  roarAge: 99,
  ...o,
});
const keys = (l: ReturnType<typeof tidelotlPlacements>) =>
  l.placements.map((p) => p.key);
const piece = (l: ReturnType<typeof tidelotlPlacements>, key: string) =>
  l.placements.find((p) => p.key === key);

describe("Tidelotl rig", () => {
  it("has every piece each placement asks for, and none twice", () => {
    const pieces = tidelotlPieces();
    const names = new Set(pieces.map((p) => p.name));
    expect(names.size).toBe(pieces.length);
    // the skin pieces (whose colours follow the phase) are head, body, legs and tail
    for (const p of pieces)
      expect(p.skin, p.name).toBe(/^(head|body|leg|tail)_/.test(p.name));
    // every facing, every pose table name: all placed pieces exist
    const poses = [
      tidelotlPose(cue()),
      tidelotlPose(cue({ stranded: true })),
      tidelotlPose(cue({ windKind: "hightide", windup: 1 })),
      tidelotlPose(cue({ windKind: "wave", windup: 1 })),
      tidelotlPose(cue({ windKind: "bubbles", windup: 1 })),
      tidelotlPose(cue({ windKind: "prison", windup: 1 })),
      tidelotlPose(cue({ windKind: "undertow", windup: 1 })),
      tidelotlPose(cue({ stagger: true })),
      tidelotlPose(cue({ hurt: 1 })),
      tidelotlPose(cue({ dead: true, deathSink: 0.3 })),
      tidelotlPose(cue({ castKind: "slam", castAge: 0.2 })),
    ];
    for (const P of poses)
      for (let f = 0; f < 8; f++)
        for (const wet of [true, false])
          for (const p of tidelotlPlacements(P, f + 0.7, 3, wet).placements)
            expect(names.has(p.piece), p.piece).toBe(true);
  });

  it("shows eight facings from five drawn views, mirrored on the left", () => {
    expect(FACING.map((f) => f.v)).toEqual([0, 1, 2, 3, 4, 3, 2, 1]);
    const P = tidelotlIdle(1);
    const right = tidelotlPlacements(P, 2, 1, true),
      left = tidelotlPlacements(P, 6, 1, true);
    expect(piece(right, "head")!.piece).toBe("head_2");
    expect(piece(left, "head")!.piece).toBe("head_2");
    // facing right the head is ahead of the body on the right, facing left on the left
    expect(right.head.x).toBeGreaterThan(0);
    expect(left.head.x).toBeLessThan(0);
    // the left is the right mirrored (a negative determinant)
    const det = (q: { sx: number; sy: number }) => q.sx * q.sy;
    expect(det(piece(left, "head")!)).toBeLessThan(0);
    expect(det(piece(right, "head")!)).toBeGreaterThan(0);
    // from the back: no face, no pearl; the back's own tail drawing
    const back = tidelotlPlacements(P, 4, 1, true);
    expect(keys(back).filter((k) => /^(eye|mouth|pearl)/.test(k))).toEqual([]);
    expect(piece(back, "tail")!.piece).toBe("tail_4_restB");
    // from the front: both eyes and the pearl
    const front = tidelotlPlacements(P, 0, 1, true);
    expect(keys(front)).toEqual(
      expect.arrayContaining(["eyen", "eyef", "pearl", "mouth"]),
    );
  });

  it("turns to the screen angle with a little hysteresis", () => {
    expect(lotlFacing(Math.PI / 2)).toBe(0); // down the screen, at the camera
    expect(lotlFacing(0)).toBe(2); // screen right
    expect(lotlFacing(-Math.PI / 2)).toBe(4); // away
    expect(lotlFacing(Math.PI)).toBe(6); // screen left
    expect(lotlFacing((24 * Math.PI) / 180, 2)).toBe(2); // just past halfway: holds
    expect(lotlFacing((40 * Math.PI) / 180, 2)).toBe(1);
  });

  it("winds up each attack its own way and follows through", () => {
    const idle = tidelotlPose(cue());
    const tide = tidelotlPose(cue({ windKind: "hightide", windup: 1 }));
    expect(tide.mouth).toBe("open");
    expect(tide.legF).toBe("up");
    expect(tide.h).toBeGreaterThan(idle.h + 25);
    const bubbles = tidelotlPose(cue({ windKind: "bubbles", windup: 1 }));
    expect(bubbles.puff).toBeGreaterThan(1);
    expect(bubbles.mouth).toBe("o");
    const wave = tidelotlPose(cue({ windKind: "wave", windup: 1 }));
    expect(wave.tail).toBe("up");
    const slap = tidelotlPose(cue({ castKind: "wave", castAge: 0.25 }));
    expect(slap.sy).toBeLessThan(0.9); // squashed by the tail slap
    const prison = tidelotlPose(cue({ castKind: "prison", castAge: 2 }));
    expect(prison.mouth).toBe("open"); // sucking the bubble in
    const undertow = tidelotlPose(cue({ windKind: "undertow", windup: 1 }));
    expect(undertow.tail).toBe("out");
    expect(undertow.expr).not.toBe("idle");
  });

  it("surfaces claws-first, strands belly-flat with its pearl open, sweeps its tail, sinks when beaten", () => {
    const rising = tidelotlPose(cue({ rise: 0.1 }));
    expect(rising.h).toBeLessThan(0);
    expect(rising.legF).toBe("up");
    const stranded = tidelotlPose(cue({ stranded: true, reduced: true }));
    expect(stranded).toMatchObject({
      legF: "splay",
      legB: "splay",
      tail: "flop",
      expr: "dizzy",
      exposed: 1,
    });
    expect(stranded.sy).toBeLessThan(0.8);
    const sweepWind = tidelotlPose(
      cue({ stranded: true, windKind: "slam", windup: 1 }),
    );
    expect(sweepWind.tail).toBe("out");
    expect(sweepWind.expr).toBe("glare");
    const sunk = tidelotlPose(cue({ dead: true, deathSink: 1 }));
    expect(sunk.h).toBeLessThan(-150);
    expect(sunk.exposed).toBe(0);
    // stranded out of the water: nothing is cut at the waterline, no water
    const dry = tidelotlPlacements(stranded, 2, 1, false);
    expect(dry.placements.some((p) => p.cut !== undefined)).toBe(false);
    expect(keys(dry).filter((k) => /^(veil|f[lc])/.test(k))).toEqual([]);
    expect(keys(dry)).toContain("shadow");
    expect(dry.water).toBeUndefined();
    const wet = tidelotlPlacements(tidelotlIdle(1), 2, 1, true);
    expect(keys(wet)).toEqual(expect.arrayContaining(["deep", "veilh"]));
    expect(wet.water).toBeDefined();
  });

  it("sits in the water: each part is cut along its own waterline, under a veil, ringed with foam", () => {
    for (let f = 0; f < 8; f++) {
      const L = tidelotlPlacements(tidelotlIdle(1), f, 1, true);
      const head = piece(L, "head")!,
        veil = piece(L, "veilh")!;
      // cut below the surface (the veil is opaque there), not drawn whole
      expect(head.cut, `facing ${f}`).toBeGreaterThan(veil.y);
      // the foam rings the head: near side lower on screen than the far side
      const foam = L.placements.filter((p) => /^f[lc]h\d+$/.test(p.key));
      expect(foam.length, `facing ${f}`).toBeGreaterThan(5);
      const ys = foam.map((p) => p.y);
      expect(Math.max(...ys) - Math.min(...ys), `facing ${f}`).toBeGreaterThan(
        6,
      );
      // its face pieces share the head's cut, so they end on the same line
      const eye = piece(L, "eyen");
      if (eye) expect(eye.cut).toBe(head.cut);
      // Low keeps fewer flecks of foam
      const low = tidelotlPlacements(tidelotlIdle(1), f, 1, true, true);
      expect(
        low.placements.filter((p) => /^f[lc][bh]\d+$/.test(p.key)).length,
      ).toBeLessThan(
        L.placements.filter((p) => /^f[lc][bh]\d+$/.test(p.key)).length,
      );
    }
    // in profile the tail's fin skims the water: foam and rings where it touches
    const side = tidelotlPlacements(tidelotlIdle(1), 2, 1, true);
    expect(
      keys(side).filter((k) => /^tc[BFf]\d$/.test(k)).length,
    ).toBeGreaterThan(2);
    // diving: it sinks and the water closes over it, but what pokes up is
    // cut at the surface, not hidden
    const dive = tidelotlPose(cue({ dive: 1 }));
    expect(dive.h).toBeLessThan(-120);
    const under = tidelotlPlacements(dive, 0, 1, true);
    for (const k of ["head", "body"]) {
      const c = piece(under, k)!.cut!;
      expect(Number.isFinite(c), k).toBe(true);
    }
    expect(keys(under).filter((k) => /^veil/.test(k))).toEqual([]);
    // the fading-in facing of a spin is cut too, without a second veil
    const spin = tidelotlPlacements(tidelotlIdle(1), 2.8, 1, true);
    expect(piece(spin, "b:head")!.cut).toBeDefined();
    expect(keys(spin).filter((k) => /^b:(veil|f[lc])/.test(k))).toEqual([]);
  });

  it("spins smoothly: a fractional facing fades the next facing in, without legs, under the budget", () => {
    const P = tidelotlPose(cue({ windKind: "undertow", windup: 1 }));
    const whole = tidelotlPlacements(P, 3, 1, false);
    const between = tidelotlPlacements(P, 3.8, 1, false);
    expect(keys(whole).filter((k) => k.startsWith("b:"))).toEqual([]);
    const b = between.placements.filter((p) => p.key.startsWith("b:"));
    expect(b.length).toBeGreaterThan(8);
    expect(b.some((p) => /^b:leg/.test(p.key))).toBe(false);
    expect(b[0].alpha).toBeGreaterThan(0.3);
    expect(b[0].alpha).toBeLessThan(1);
    // the idle frame stays within the image budget; the spin about doubles it at most
    expect(whole.placements.length).toBeLessThanOrEqual(28);
    expect(between.placements.length).toBeLessThanOrEqual(50);
  });

  it("deepens per phase only where it should, and stills its living layer with reduced motion", () => {
    const a = tidelotlPose(cue({ clock: 1 })),
      b = tidelotlPose(cue({ clock: 2.3 }));
    expect(a.h).not.toBe(b.h);
    const ra = tidelotlPose(cue({ clock: 1, reduced: true })),
      rb = tidelotlPose(cue({ clock: 2.3, reduced: true }));
    expect(ra).toEqual(rb);
    // phases 2 and 3 light the gills and swirl water round it
    const p1 = tidelotlPlacements(tidelotlIdle(1), 1, 1, true);
    const p3 = tidelotlPlacements(tidelotlIdle(1), 1, 3, true);
    expect(piece(p1, "gillL0")!.piece).toMatch(/_0$/);
    expect(piece(p3, "gillL0")!.piece).toMatch(/_1$/);
    expect(keys(p3).filter((k) => k.startsWith("swirl"))).toHaveLength(3);
    expect(keys(p1).filter((k) => k.startsWith("swirl"))).toHaveLength(0);
  });
});
