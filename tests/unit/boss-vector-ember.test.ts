import { describe, expect, it } from "vitest";
import {
  EMBER_SPEC,
  emberGuideImage,
  emberPieces,
  emberPlacements,
  emberPose,
  emberTurn,
  type EmberCue,
} from "../../apps/client/src/boss-vector-ember";

const cue = (o: Partial<EmberCue> = {}): EmberCue => ({
  clock: 1,
  phase: 1,
  reduced: false,
  flight: 1,
  windup: 0,
  castAge: 99,
  exposed: false,
  stagger: false,
  hurt: 0,
  dead: false,
  deadAge: 0,
  roarAge: 99,
  ...o,
});
const DEG = Math.PI / 180;
const at = (o: Partial<EmberCue>, deg: number) =>
  emberPlacements(emberPose(cue(o)), deg * DEG, 1);
const eyes = (p: ReturnType<typeof at>) =>
  p.placements.filter((q) => /^f-eye[nf]$/.test(q.key));

describe("vector Emberwing rig", () => {
  it("draws every placed piece, one image per key", () => {
    const names = new Set(emberPieces(1).map((p) => p.name));
    for (const deg of [0, 45, 90, 135, 180, 225, 270, 315])
      for (const o of [{}, { flight: 0 }, { exposed: true, stagger: true }]) {
        const p = at(o, deg);
        for (const q of p.placements) expect(names.has(q.piece)).toBe(true);
        const keys = p.placements.map((q) => q.key);
        expect(new Set(keys).size).toBe(keys.length);
      }
  });

  it("shows its face towards the camera, each eye drawn for its view and never squeezed", () => {
    expect(eyes(at({}, 0)).map((q) => q.piece)).toEqual([
      "eye_front_idle",
      "eye_front_idle",
    ]);
    expect(
      eyes(at({}, 45))
        .map((q) => q.piece)
        .sort(),
    ).toEqual(["eye_far_idle", "eye_near_idle"]);
    expect(eyes(at({}, 90)).map((q) => q.piece)).toEqual(["eye_side_idle"]);
    expect(eyes(at({}, 180))).toEqual([]);
    for (let deg = -180; deg <= 180; deg += 5)
      for (const e of eyes(at({}, deg))) {
        expect([Math.abs(e.sx), e.sy]).toEqual([1, 1]);
        // nothing tilts but the far eye, by its fixed lift (and the head's roll)
        expect(Math.abs(e.rot)).toBeLessThan(EMBER_SPEC.farLift + 0.12);
      }
    // three-quarter: the beak's base tucks the far eye's inner corner
    const tq = at({}, 45).placements;
    const far = tq.find((q) => q.key === "f-eyef")!;
    const near = tq.find((q) => q.key === "f-eyen")!;
    const beak = tq.find((q) => q.key === "f-beak")!;
    expect(far.z).toBeLessThan(beak.z);
    expect(beak.z).toBeLessThan(near.z);
  });

  it("flies high with its wings up, and lands on its legs with them folded", () => {
    const up = at({}, 0),
      down = at({ flight: 0 }, 0);
    expect(up.headScreen.y).toBeLessThan(down.headScreen.y - 15);
    const wing = (p: ReturnType<typeof at>) =>
      p.placements.find((q) => q.key === "wing1")!;
    // spread out to the side in flight; folded back and down when landed
    expect(Math.abs(Math.cos(wing(up).rot))).toBeGreaterThan(
      Math.abs(Math.cos(wing(down).rot)),
    );
    // its feet reach the floor when it stands
    const legs = down.placements.filter((q) => q.piece === "leg");
    for (const l of legs) expect(l.y).toBeGreaterThan(-45);
  });

  it("winds up each attack its own way, and follows through", () => {
    const idle = emberPose(cue());
    expect(emberPose(cue({ windKind: "dive-bomb", windup: 1 })).lift).toBe(
      idle.lift + 26,
    );
    expect(
      emberPose(cue({ windKind: "wing-gust", windup: 1 })).wing,
    ).toBeGreaterThan(1.2);
    expect(
      emberPose(cue({ windKind: "flame-ring", windup: 1 })).flare,
    ).toBeGreaterThan(0.9);
    const dive = emberPose(cue({ castKind: "dive-bomb", castAge: 0.27 }));
    expect(dive.pitch).toBeGreaterThan(0.4);
    expect(dive.mouth).toBe("open");
    // a cast long past leaves the idle pose
    expect(emberPose(cue({ castKind: "ember-rain", castAge: 5 })).mouth).toBe(
      "closed",
    );
  });

  it("grounded by the braziers it is dizzy with its heart open; beaten it fades to ash", () => {
    const dazed = emberPose(cue({ flight: 0, exposed: true, stagger: true }));
    expect([dazed.look, dazed.stars, dazed.exposed]).toEqual(["dizzy", 1, 1]);
    const open = emberPose(cue({ flight: 0, exposed: true }));
    expect([open.look, open.exposed]).toEqual(["wide", 1]);
    const p = at({ flight: 0, exposed: true, stagger: true }, 0);
    expect(p.placements.filter((q) => q.piece === "star")).toHaveLength(3);
    const dead = emberPose(cue({ dead: true, deadAge: 3 }));
    expect(dead.look).toBe("closed");
    expect(dead.exposed).toBe(0);
    expect(dead.alpha).toBeLessThan(0.3);
  });

  it("holds still with reduced motion, keeping windups but no flourishes", () => {
    const calm = emberPose(cue({ reduced: true }));
    expect(emberPose(cue({ reduced: true, clock: 7 }))).toEqual(calm);
    expect(
      emberPose(
        cue({
          reduced: true,
          hurt: 0.9,
          roarAge: 0.5,
          castKind: "dive-bomb",
          castAge: 0.3,
        }),
      ),
    ).toEqual(calm);
    expect(
      emberPose(cue({ reduced: true, windKind: "wing-gust", windup: 1 })).wing,
    ).toBeGreaterThan(1.2);
  });

  it("turns through eight facings without flickering", () => {
    const facingFor = (deg: number) => Math.PI / 2 - deg * DEG;
    expect(
      [0, 90, 180, 270].map(
        (d) => emberTurn(facingFor(d), undefined, 0, 0, true).facing,
      ),
    ).toEqual([0, 2, 4, 6]);
    expect(emberTurn(facingFor(90 - 25), 2, 0, 0, true).facing).toBe(2);
  });

  it("gives the briefing diagram a crop around the bird (no picture outside a browser)", () => {
    for (const exposed of [false, true]) {
      const art = emberGuideImage(exposed);
      expect(art.url).toBe("");
      const [x, y, w, h] = art.crop;
      expect(w).toBeGreaterThan(80);
      expect(h).toBeGreaterThan(60);
      expect(x + w).toBeLessThanOrEqual(art.width);
      expect(y + h).toBeLessThanOrEqual(art.height);
      expect(art.core[0]).toBeGreaterThan(x);
      expect(art.core[0]).toBeLessThan(x + w);
      expect(art.core[1]).toBeGreaterThan(y);
      expect(art.core[1]).toBeLessThan(y + h);
    }
  });
});
