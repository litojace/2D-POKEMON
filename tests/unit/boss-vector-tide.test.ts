import { describe, expect, it } from "vitest";
import {
  SEGMENTS,
  TIDE_FACE,
  TIDE_SPEC,
  tideBody,
  tideGuideImage,
  tideIdle,
  tidePieces,
  tidePlacements,
  tidePose,
  tideTurn,
  type TideCue,
} from "../../apps/client/src/boss-vector-tide";

const cue = (o: Partial<TideCue> = {}): TideCue => ({
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
const water = () => 0;
const keys = (p: ReturnType<typeof tidePlacements>) =>
  p.placements.map((q) => q.key);

describe("vector Tidewyrm rig", () => {
  it("rises from the water, head high, and glares harder each phase", () => {
    const { segs, head } = tideBody(tidePose(cue()), 0);
    expect(segs).toHaveLength(SEGMENTS);
    expect(head.w.y).toBeGreaterThan(90);
    // the tail lies along the water
    expect(Math.abs(segs[2].w.y)).toBeLessThan(25);
    const angers = [1, 2, 3].map((phase) => tidePose(cue({ phase })).anger);
    expect(angers[0]).toBeLessThan(angers[1]);
    expect(angers[1]).toBeLessThan(angers[2]);
  });

  it("winds up each attack its own way", () => {
    const idle = tidePose(cue());
    const tide = tidePose(cue({ windKind: "hightide", windup: 1 }));
    expect(tide.headPitch).toBeGreaterThan(0.9); // roaring at the sky
    expect(tide.jaw).toBe(1);
    const wave = tidePose(cue({ windKind: "wave", windup: 1 }));
    expect(wave.lean).toBeLessThan(-0.5); // rears back
    const slam = tidePose(cue({ castKind: "wave", castAge: 0.45 }));
    expect(slam.lean).toBeGreaterThan(0.9); // and slams down
    const undertow = tidePose(cue({ windKind: "undertow", windup: 1 }));
    expect(undertow.coil).toBeGreaterThan(idle.coil + 0.8);
    const dive = tidePose(cue({ windKind: "dive", windup: 1 }));
    expect(dive.rear).toBeGreaterThan(idle.rear);
    // a cast long past leaves the idle pose
    expect(tidePose(cue({ castKind: "bubbles", castAge: 5 })).jaw).toBe(
      idle.jaw,
    );
  });

  it("lies flat, dizzy and open when stranded, and sinks when defeated", () => {
    const P = tidePose(cue({ stranded: true }));
    expect([P.flat, P.dizzy, P.exposed]).toEqual([1, 1, 1]);
    const body = tideBody(P, 0.4);
    expect(Math.max(...body.segs.map((s) => s.w.y))).toBeLessThan(35);
    const dead = tidePose(cue({ dead: true, deathSink: 1, stranded: true }));
    expect(dead.closed).toBe(1);
    expect(dead.exposed).toBe(0);
    expect(tideBody(dead, 0).head.w.y).toBeLessThan(-150);
    // a stagger in the water opens the pearl too
    expect(tidePose(cue({ stagger: true })).exposed).toBe(1);
  });

  it("holds still with reduced motion, keeping windups but no flourishes", () => {
    const calm = tidePose(cue({ reduced: true }));
    expect(tidePose(cue({ reduced: true, clock: 7 }))).toEqual({ ...calm });
    expect(
      tidePose(
        cue({
          reduced: true,
          hurt: 0.9,
          roarAge: 0.5,
          castKind: "wave",
          castAge: 0.4,
        }),
      ),
    ).toEqual(calm);
    expect(
      tidePose(cue({ reduced: true, windKind: "hightide", windup: 1 }))
        .headPitch,
    ).toBeGreaterThan(0.9);
  });

  it("shows its face towards the camera and none from behind", () => {
    const P = tideIdle(1);
    const front = keys(tidePlacements(P, 0, 1, water));
    expect(front.filter((k) => k.startsWith("eye")).length).toBeGreaterThan(0);
    expect(front).toContain("pearl");
    const back = keys(tidePlacements(P, Math.PI, 1, water));
    expect(back.filter((k) => /^eye-?1$/.test(k))).toEqual([]);
    // one image per key
    expect(new Set(front).size).toBe(front.length);
  });

  it("draws each eye for its view and never squeezes one", () => {
    const P = tideIdle(1);
    const eyesAt = (yaw: number) =>
      tidePlacements(P, yaw, 1, water).placements.filter((q) =>
        /^eye-?1$/.test(q.key),
      );
    const names = (yaw: number) =>
      eyesAt(yaw)
        .map((q) => q.piece)
        .sort();
    expect(names(0)).toEqual(["eye-glare", "eye-glare"]);
    expect(names(Math.PI / 5)).toEqual(["eye-far-glare", "eye-near-glare"]);
    expect(names(Math.PI / 2)).toEqual(["eye-side-glare"]);
    for (let deg = -180; deg <= 180; deg += 5) {
      const eyes = eyesAt((deg * Math.PI) / 180);
      // only ever mirrored, and both on one eye line
      for (const e of eyes) expect([Math.abs(e.sx), e.sy]).toEqual([1, 1]);
      if (eyes.length === 2) expect(eyes[0].y).toBeCloseTo(eyes[1].y, 6);
      // nothing tilts but the far eye, by its fixed lift
      for (const e of eyes)
        expect(Math.abs(e.rot)).toBeCloseTo(
          e.piece.startsWith("eye-far-") ? TIDE_SPEC.farLift : 0,
          6,
        );
    }
  });

  it("keeps the face on its lines, inside the head's outline, in every view", () => {
    const S = TIDE_SPEC;
    const pieces = new Set(tidePieces(1).map((q) => q.name));
    for (let deg = -180; deg <= 180; deg += 0.5)
      for (const pitch of [-0.45, 0, 0.45])
        for (const look of [
          "glare",
          "wide",
          "squint",
          "shut",
          "dizzy",
        ] as const)
          for (const mouth of ["closed", "half", "open"] as const) {
            const r = TIDE_FACE.face(
              { x: 0, y: 0, z: 0, yaw: (deg * Math.PI) / 180, pitch, roll: 0 },
              { look, brow: "calm", mouth },
            );
            for (const q of r.placements)
              expect(pieces.has(q.piece)).toBe(true);
            // no face from behind: the head alone
            if (r.view === "back" || r.view === "backtq") {
              expect(r.placements).toHaveLength(1);
              continue;
            }
            const eyeV = S.lines.eye + pitch * S.nod;
            for (const e of r.eyes) {
              const { hw, hh } = S.eye[e.v];
              for (const dv of [-hh * 0.7, 0, hh * 0.7]) {
                const [lo, hi] = S.skullEdge(r.view, eyeV + dv);
                expect(e.u - hw).toBeGreaterThanOrEqual(lo + S.margin - 1e-9);
                expect(e.u + hw).toBeLessThanOrEqual(hi - S.margin + 1e-9);
              }
            }
            if (r.view === "tq") {
              const near = r.eyes.find((e) => e.id === "n")!,
                far = r.eyes.find((e) => e.id === "f")!;
              // near eye, a clear gap, the bridge, then the narrower far eye
              expect(far.u - far.g.hw).toBeGreaterThan(near.u + near.g.hw);
              expect(far.g.hw).toBeLessThan(near.g.hw);
            }
          }
    // at the resting three-quarter facing the bridge hides no more than its cap of the far eye
    const r = TIDE_FACE.face(
      { x: 0, y: 0, z: 0, yaw: Math.PI / 4, pitch: 0, roll: 0 },
      { look: "glare", brow: "calm", mouth: "closed" },
    );
    const far = r.eyes.find((e) => e.id === "f")!;
    expect(
      (r.bridge! - (far.u - far.g.hw)) / (2 * far.g.hw),
    ).toBeLessThanOrEqual(S.tuckCap + 1e-9);
  });

  it("cuts the body at the waterline, but not on an island's sand", () => {
    const P = tideIdle(1);
    const wet = tidePlacements(P, 0, 1, water).placements.filter(
      (q) => q.piece === "seg",
    );
    expect(wet.length).toBeGreaterThan(10);
    expect(wet.every((q) => q.waterY !== undefined)).toBe(true);
    const dry = tidePlacements(
      tidePose(cue({ stranded: true })),
      0,
      1,
      () => null,
    ).placements.filter((q) => q.piece === "seg");
    expect(dry).toHaveLength(SEGMENTS + Math.floor((SEGMENTS - 1) / 5));
    expect(dry.every((q) => q.waterY === undefined)).toBe(true);
  });

  it("turns through eight facings without flickering", () => {
    const facingFor = (deg: number) => Math.PI / 2 - (deg * Math.PI) / 180;
    expect(
      [0, 90, 180, 270].map(
        (d) => tideTurn(facingFor(d), undefined, 0, 0, true).facing,
      ),
    ).toEqual([0, 2, 4, 6]);
    expect(tideTurn(facingFor(90 - 25), 2, 0, 0, true).facing).toBe(2);
    expect(tideTurn(facingFor(90 - 32), 2, 0, 0, true).facing).toBe(1);
  });

  it("gives the briefing diagram a crop around the serpent (no picture outside a browser)", () => {
    for (const exposed of [false, true]) {
      const art = tideGuideImage(exposed);
      expect(art.url).toBe("");
      const [x, y, w, h] = art.crop;
      expect(w).toBeGreaterThan(80);
      expect(h).toBeGreaterThan(60);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(art.width);
      expect(y + h).toBeLessThanOrEqual(art.height);
      expect(art.core[0]).toBeGreaterThan(x);
      expect(art.core[0]).toBeLessThan(x + w);
      expect(art.core[1]).toBeGreaterThan(y);
      expect(art.core[1]).toBeLessThan(y + h);
    }
  });
});
