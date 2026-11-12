import { describe, expect, it } from "vitest";
import {
  GLOOM_FACE,
  gloomGuideImage,
  gloomPieces,
  gloomPlacements,
  gloomPose,
  gloomSkull,
  gloomTurn,
  type GloomCue,
} from "../../apps/client/src/boss-vector-gloom";

const cue = (o: Partial<GloomCue> = {}): GloomCue => ({
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
const rad = (deg: number) => (deg * Math.PI) / 180;
const at = (deg: number, o: Partial<GloomCue> = {}) =>
  gloomPlacements(gloomPose(cue(o)), rad(deg), 1);
const eyes = (deg: number, o: Partial<GloomCue> = {}) =>
  at(deg, o).placements.filter((p) => /^eye[nf]$/.test(p.key));

describe("vector Gloomshade rig", () => {
  it("draws every placed piece, one image per key", () => {
    const names = new Set(gloomPieces(1).map((p) => p.name));
    for (const deg of [0, 45, 90, 135, 180, 270, 315])
      for (const o of [
        {},
        { stagger: true },
        { windKind: "hands", windup: 1 },
      ]) {
        const placed = at(deg, o).placements;
        expect(new Set(placed.map((p) => p.key)).size).toBe(placed.length);
        for (const p of placed) expect(names.has(p.piece)).toBe(true);
      }
  });

  it("shows its face for each view, never squeezed, and none from behind", () => {
    expect(eyes(0).map((e) => e.piece)).toEqual([
      "eye_front_idle",
      "eye_front_idle",
    ]);
    expect(
      eyes(45)
        .map((e) => e.piece)
        .sort(),
    ).toEqual(["eye_far_idle", "eye_near_idle"]);
    expect(eyes(90).map((e) => e.piece)).toEqual(["eye_side_idle"]);
    expect(eyes(180)).toEqual([]);
    expect(eyes(150)).toEqual([]);
    for (let deg = -180; deg <= 180; deg += 5) {
      const es = eyes(deg, { reduced: true }); // no head roll
      // only ever mirrored, and both on one eye line
      for (const e of es) expect([Math.abs(e.sx), e.sy]).toEqual([1, 1]);
      if (es.length === 2) expect(es[0].y).toBeCloseTo(es[1].y, 6);
    }
  });

  it("keeps the eyes inside the head's drawn outline", () => {
    for (let deg = -170; deg <= 170; deg += 5) {
      const placed = at(deg, { reduced: true });
      const head = placed.placements.find((p) => p.key === "head")!;
      for (const e of placed.placements.filter((p) =>
        /^eye[nf]$/.test(p.key),
      )) {
        const view = placed.view;
        const [l, r] = gloomSkull(view, GLOOM_FACE.eyeLine);
        const hw = GLOOM_FACE.eye[e.piece.split("_")[1] as "front"].hw;
        const u = (e.x - head.x) * Math.sign(head.sx || 1);
        expect(u - hw).toBeGreaterThanOrEqual(l - 0.5);
        expect(u + hw).toBeLessThanOrEqual(r + 0.5);
      }
    }
  });

  it("looks sly at rest, glares to attack, and is dizzy and open when staggered", () => {
    expect(eyes(0)[0].piece).toBe("eye_front_idle");
    for (const windKind of ["lunge", "hands", "curse"])
      expect(eyes(0, { windKind, windup: 1 })[0].piece).toBe("eye_front_glare");
    expect(
      gloomPose(cue({ windKind: "hands", windup: 1 })).rear,
    ).toBeGreaterThan(0.8);
    expect(gloomPose(cue({ windKind: "lunge", windup: 1 })).crouch).toBe(1);
    const dizzy = at(0, { stagger: true });
    expect(dizzy.placements.some((p) => p.piece === "eye_front_dizzy")).toBe(
      true,
    );
    expect(dizzy.placements.some((p) => p.key === "core")).toBe(true);
    expect(dizzy.placements.filter((p) => p.piece === "star")).toHaveLength(3);
    expect(
      at(0, { exposed: true }).placements.some((p) => p.key === "core"),
    ).toBe(true);
    expect(at(0).placements.some((p) => p.key === "core")).toBe(false);
  });

  it("only the real one's moon flickers", () => {
    const moons = (flicker: boolean) =>
      [1, 1.2, 1.4, 1.6].map(
        (clock) =>
          gloomPlacements(
            gloomPose(cue({ clock, flicker })),
            0,
            1,
          ).placements.find((p) => p.key === "moon")!.alpha,
      );
    expect(new Set(moons(false))).toEqual(new Set([1]));
    expect(Math.min(...moons(true))).toBeLessThan(0.9);
  });

  it("holds still with reduced motion, keeping its windups", () => {
    const calm = gloomPose(cue({ reduced: true }));
    expect(gloomPose(cue({ reduced: true, clock: 7 }))).toEqual(calm);
    expect(
      gloomPose(
        cue({ reduced: true, castKind: "lunge", castAge: 0.2, hurt: 0.9 }),
      ),
    ).toEqual(calm);
    expect(
      gloomPose(cue({ reduced: true, windKind: "hands", windup: 1 })).rear,
    ).toBeGreaterThan(0.8);
  });

  it("curls up with its eyes shut when defeated", () => {
    const P = gloomPose(cue({ dead: true, deadAge: 3 }));
    expect([P.look, P.mouth, P.core, P.eyeGlow]).toEqual([
      "closed",
      "flat",
      0,
      0,
    ]);
    expect(P.crouch).toBeGreaterThan(1);
  });

  it("turns through eight facings without flickering", () => {
    const facingFor = (deg: number) => Math.PI / 2 - rad(deg);
    expect(
      [0, 90, 180, 270].map(
        (d) => gloomTurn(facingFor(d), undefined, 0, 0, true).facing,
      ),
    ).toEqual([0, 2, 4, 6]);
    expect(gloomTurn(facingFor(90 - 25), 2, 0, 0, true).facing).toBe(2);
  });

  it("gives the briefing diagram a crop around it (no picture outside a browser)", () => {
    for (const exposed of [false, true]) {
      const art = gloomGuideImage(exposed);
      expect(art.url).toBe("");
      const [x, y, w, h] = art.crop;
      expect(w).toBeGreaterThan(80);
      expect(h).toBeGreaterThan(80);
      expect(x + w).toBeLessThanOrEqual(art.width);
      expect(y + h).toBeLessThanOrEqual(art.height);
      expect(art.core[0]).toBeGreaterThan(x);
      expect(art.core[0]).toBeLessThan(x + w);
      expect(art.core[1]).toBeGreaterThan(y);
      expect(art.core[1]).toBeLessThan(y + h);
    }
  });
});
