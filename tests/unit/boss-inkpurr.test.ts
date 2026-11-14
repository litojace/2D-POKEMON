import { describe, expect, it } from "vitest";
import {
  INK_SCALE,
  inkPlacements,
  inkPose,
  inkTurn,
  inkView,
  type InkCue,
} from "../../apps/client/src/boss-inkpurr";
import { inkPieceSpecs } from "../../apps/client/src/boss-inkpurr-paint";

const cue = (o: Partial<InkCue> = {}): InkCue => ({
  clock: 1,
  phase: 1,
  reduced: false,
  windup: 0,
  castAge: 99,
  stagger: false,
  exposed: false,
  hurt: 0,
  dead: false,
  deadAge: 0,
  roarAge: 99,
  flicker: false,
  ...o,
});
const at = (facing: number, o: Partial<InkCue> = {}, extra = {}) =>
  inkPlacements(inkPose(cue(o)), {
    facing,
    phase: o.phase ?? 1,
    clock: o.clock ?? 1,
    ...extra,
  });
const part = (r: ReturnType<typeof at>, key: string) =>
  r.placements.find((p) => p.key === key);

describe("Inkpurr rig (Gloomshade's look)", () => {
  const names = new Set(inkPieceSpecs().map((p) => p.name));
  const states: Partial<InkCue>[] = [
    {},
    { phase: 2 },
    { phase: 3 },
    { stagger: true },
    { exposed: true },
    { hurt: 1 },
    { dead: true, deadAge: 1 },
    { dead: true, deadAge: 2 },
    { roarAge: 0.5 },
    ...["lunge", "hands", "snuff", "curse", "split", "pulse"].flatMap((k) => [
      { windKind: k, windup: 1 },
      { castKind: k, castAge: 0.25 },
    ]),
  ];

  it("places only pieces that are painted, one image per key", () => {
    for (let f = 0; f < 8; f++)
      for (const s of states) {
        const r = at(f, s, { shadow: { dx: 1, dy: 0, alpha: 0.6 } });
        for (const p of r.placements) expect(names, p.piece).toContain(p.piece);
        const keys = r.placements.map((p) => p.key);
        expect(new Set(keys).size).toBe(keys.length);
      }
  });

  it("draws five views and mirrors the other three facings", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((f) => inkView(f).v)).toEqual([
      0, 1, 2, 3, 4, 3, 2, 1,
    ]);
    for (let f = 0; f < 8; f++) {
      const r = at(f);
      expect(part(r, "body")!.piece).toBe(`body_${inkView(f).v}`);
      // the face only from the front, ¾ and side; never from behind
      expect(!!part(r, "eyes")).toBe(inkView(f).v <= 2);
    }
    // the turn: eight ways, with hysteresis
    const right = inkTurn(0, undefined, 0, 0, true);
    expect(right.facing).toBe(2);
    expect(inkTurn(Math.PI / 2, undefined, 0, 0, true).facing).toBe(0);
  });

  it("never squeezes the face: it only moves, as one group, while the body squashes", () => {
    for (let f = 0; f < 8; f++)
      for (const s of states) {
        const r = at(f, s);
        const eyes = part(r, "eyes"),
          mouth = part(r, "mouth");
        if (!eyes || !mouth) continue;
        for (const p of [eyes, mouth])
          expect(Math.abs(Math.abs(p.sx) - Math.abs(p.sy))).toBeLessThan(1e-9);
        expect(mouth.x).toBeCloseTo(eyes.x, 9);
        expect(mouth.y).toBeCloseTo(eyes.y, 9);
      }
    // ...while the body itself does squash
    const body = part(at(0, { windKind: "lunge", windup: 1 }), "body")!;
    expect(body.sy / body.sx).toBeLessThan(0.8);
  });

  it("keeps the eye line, gem and mouth on the face's centre line in the front view", () => {
    const r = at(0, { reduced: true });
    expect(r.eyes).toHaveLength(2);
    expect(r.eyes[0].y).toBeCloseTo(r.eyes[1].y, 9);
    expect(r.eyes[0].x + r.eyes[1].x).toBeCloseTo(0, 6);
    expect(r.gem!.x).toBeCloseTo(0, 6);
    expect(r.mouth!.x).toBeCloseTo(0, 6);
    // spacing gem → eyes → mouth is the same in every face view
    const gap = (f: number) => {
      const q = at(f, { reduced: true });
      return [q.eyes[0].y - q.gem!.y, q.mouth!.y - q.eyes[0].y].map((v) =>
        v.toFixed(6),
      );
    };
    expect(gap(1)).toEqual(gap(0));
    expect(gap(2)).toEqual(gap(0));
  });

  it("shows the two tells only on the real one: a flickering moon, a shadow in lantern light", () => {
    const moon = (flicker: boolean, clock: number) =>
      part(at(1, { flicker, clock }), "moon")!.alpha;
    const real = [1, 1.13, 1.29, 1.41, 1.6].map((c) => moon(true, c));
    const copy = [1, 1.13, 1.29, 1.41, 1.6].map((c) => moon(false, c));
    expect(Math.max(...real) - Math.min(...real)).toBeGreaterThan(0.1);
    expect(new Set(copy).size).toBe(1);
    // the shadow is only placed when the battle passes one (the real one in light)
    expect(part(at(1), "shadow")).toBeUndefined();
    const lit = part(
      at(1, {}, { shadow: { dx: 0, dy: 1, alpha: 0.6 } }),
      "shadow",
    );
    expect(lit).toBeTruthy();
    expect(lit!.alpha).toBeCloseTo(0.6, 6);
  });

  it("keeps a copy exactly alike, only without its idle drips", () => {
    const real = at(1, { phase: 2 }),
      copy = at(1, { phase: 2 }, { cheap: true });
    const keys = (r: ReturnType<typeof at>) => r.placements.map((p) => p.key);
    expect(keys(real)).toContain("drips");
    expect(keys(copy)).not.toContain("drips");
    expect(keys(copy)).not.toContain("hangs");
    for (const k of ["body", "tail", "eyes", "mouth", "pawL", "pawR", "puddle"])
      expect({ ...part(copy, k), z: 0 }).toEqual({ ...part(real, k), z: 0 });
    // a dozen images or so for one body
    expect(real.placements.length).toBeLessThanOrEqual(13);
  });

  it("winds up and follows through for every attack, and maps each battle state", () => {
    const P = (o: Partial<InkCue>) => inkPose(cue(o));
    expect(P({ windKind: "lunge", windup: 1 }).al).toBe("wrap");
    expect(P({ windKind: "lunge", windup: 1 }).h).toBeLessThan(P({}).h);
    expect(P({ windKind: "hands", windup: 1 }).al).toBe("up");
    expect(P({ windKind: "snuff", windup: 1 }).al).toBe("sweep");
    expect(P({ windKind: "curse", windup: 1 }).gem).toBe(1);
    expect(P({ windKind: "pulse", windup: 1 }).look).toBe("closed");
    expect(P({ windKind: "split", windup: 1 }).look).toBe("wide");
    expect(P({ castKind: "hands", castAge: 0.22 }).al).toBe("slump");
    expect(P({ castKind: "lunge", castAge: 0.27 }).al).toBe("sweep");
    expect(P({ castKind: "snuff", castAge: 0.3 }).mouth).toBe("o");
    expect(P({ castKind: "pulse", castAge: 0.3 }).moon).toBeGreaterThan(0.5);
    expect(P({ roarAge: 0.5 }).look).toBe("glare");
    expect(P({ exposed: true }).core).toBe(1);
    expect(P({ stagger: true }).look).toBe("dizzy");
    expect(P({ stagger: true }).stars).toBe(1);
    expect(P({ hurt: 1 }).look).toBe("hurt");
    // defeat: it melts, then fades
    expect(P({ dead: true, deadAge: 0.1 }).melt).toBeLessThan(0.05);
    expect(P({ dead: true, deadAge: 1.6 }).melt).toBeGreaterThan(0.5);
    expect(P({ dead: true, deadAge: 4 }).alpha).toBe(0);
    const melting = at(0, { dead: true, deadAge: 1.0 });
    expect(part(melting, "melt1") ?? part(melting, "melt2")).toBeTruthy();
  });

  it("holds still with reduced motion: no bob, no flicker, no follow-through", () => {
    const calm = inkPose(cue({ reduced: true }));
    expect(inkPose(cue({ reduced: true, clock: 7.3 }))).toEqual(calm);
    expect(
      inkPose(cue({ reduced: true, flicker: true, clock: 2 })).moonFlick,
    ).toBe(1);
    expect(
      inkPose(cue({ reduced: true, castKind: "hands", castAge: 0.2 })).al,
    ).toBe("rest");
  });

  it("is about as big as before in the arena", () => {
    const r = at(1, { reduced: true });
    const top = r.moon.y,
      width = 112 * 2 * INK_SCALE;
    expect(-top).toBeGreaterThan(110);
    expect(-top).toBeLessThan(180);
    expect(width).toBeLessThan(160);
  });
});
