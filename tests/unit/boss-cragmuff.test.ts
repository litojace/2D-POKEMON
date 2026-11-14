import { describe, expect, it } from "vitest";
import {
  cragmuffGuideImage,
  cragmuffPlacements,
  cragmuffPose,
  type CragmuffCue,
} from "../../apps/client/src/boss-cragmuff";
import {
  EYE_LINE,
  FACE_YAW,
  eyeLayout,
  headView,
  mouthLayout,
} from "../../apps/client/src/boss-cragmuff-art";

const cue = (o: Partial<CragmuffCue> = {}): CragmuffCue => ({
  time: 1,
  breath: 0,
  phase: 1,
  reduced: false,
  charge: 0,
  charging: false,
  slam: 0,
  impact: 0,
  debris: 0,
  transform: 0,
  crash: 0,
  windup: 0,
  castAge: 99,
  stagger: false,
  exposed: false,
  dazed: false,
  hurt: 0,
  dead: false,
  deathAge: 0,
  stride: 0,
  speed: 0,
  ...o,
});
const frames = (o: Partial<CragmuffCue>, facing = 0, phase: 1 | 2 | 3 = 1) =>
  cragmuffPlacements(cragmuffPose(cue(o)), facing, phase, 1).images.map(
    (p) => p.piece,
  );

describe("Cragmuff's placements", () => {
  it("stands still in seven images: legs, fleece, horns, head, eyes, mouth", () => {
    expect(frames({})).toEqual([
      "legs4_0",
      "body_0",
      "hornsB_0_1",
      "head_0",
      "eyes_0_idle",
      "mouth_0_pout",
      "hornsF_0_1",
    ]);
  });

  it("shows eight facings from five drawn views; mirrors flip, the back has no face", () => {
    const views = [0, 1, 2, 3, 4, 5, 6, 7].map((f) =>
      cragmuffPlacements(cragmuffPose(cue()), f, 1, 1),
    );
    expect(views.map((v) => v.view)).toEqual([0, 1, 2, 3, 4, 3, 2, 1]);
    expect(views.map((v) => v.mirrored)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
    // a mirrored facing places the same body flipped across the floor point
    const body = (i: number) => views[i].images.find((p) => p.key === "body")!;
    expect(body(6).piece).toBe(body(2).piece);
    expect(Math.sign(body(6).sy * body(6).sx)).toBe(
      -Math.sign(body(2).sy * body(2).sx),
    );
    for (const i of [3, 4, 5])
      expect(views[i].images.some((p) => p.piece.startsWith("eyes_"))).toBe(
        false,
      );
    // from behind, the head is drawn before (behind) the fleece
    const back = views[4].images.map((p) => p.key);
    expect(back.indexOf("head")).toBeLessThan(back.indexOf("body"));
  });

  it("rears up as its own drawing for the slam, then stomps with a squash", () => {
    expect(frames({ slam: 0.6, windKind: "slam", windup: 0.6 }, 2)).toContain(
      "bodyR_2",
    );
    const stomp = cragmuffPose(cue({ impact: 1 }));
    expect(stomp.sy).toBeLessThan(0.9);
    expect(frames({ impact: 1 }, 2)).toContain("body_2");
  });

  it("charges with the head down and the glare drawn over the horn", () => {
    const list = frames({ charge: 0.8, windKind: "charge", windup: 0.8 }, 2);
    expect(list.indexOf("eyes_2_glare")).toBeGreaterThan(
      list.indexOf("hornsF_2_1"),
    );
    // the run: legs animate one by one
    expect(
      frames({ charging: true, stride: 1 }, 2).some((f) =>
        f.startsWith("leg_2_"),
      ),
    ).toBe(true);
  });

  it("opens the core when exposed and staggered, sits dazed after a pillar", () => {
    const stagger = cragmuffPose(cue({ stagger: true, exposed: true }));
    expect(stagger.expr).toBe("dizzy");
    expect(frames({ stagger: true, exposed: true })).toContain("gem_open");
    const dazed = cragmuffPose(cue({ dazed: true, exposed: true }));
    expect(dazed.sit).toBeGreaterThan(0.5);
    expect(dazed.stars).toBe(1);
  });

  it("grows cracks and crystals from phase 2, and goes dark when defeated", () => {
    expect(frames({}, 1, 1).some((f) => f.startsWith("over_"))).toBe(false);
    expect(frames({}, 1, 2)).toContain("over_1_2");
    expect(frames({}, 1, 3)).toContain("over_1_3");
    const down = frames({ dead: true, deathAge: 4 }, 1, 3);
    expect(down).toContain("hornsFd_1_3");
    expect(down).toContain("eyes_1_closed");
  });

  it("holds still with reduced motion", () => {
    const a = cragmuffPose(cue({ time: 1, reduced: true }));
    const b = cragmuffPose(cue({ time: 2.7, reduced: true }));
    expect(a).toEqual(b);
  });
});

describe("Cragmuff's face", () => {
  it("keeps eyes level and symmetric in front, nose and mouth on the centre line", () => {
    const front = eyeLayout(0);
    expect(front).toHaveLength(2);
    expect(front[0].y).toBeCloseTo(front[1].y);
    expect(front[0].x).toBeCloseTo(-front[1].x);
    expect(mouthLayout(0).x).toBeCloseTo(0);
  });

  it("keeps the eye line and the mouth height the same in every face view", () => {
    for (const v of [0, 1, 2]) {
      for (const e of eyeLayout(v)) expect(e.y).toBeCloseTo(EYE_LINE);
      expect(mouthLayout(v).y).toBeCloseTo(mouthLayout(0).y);
    }
  });

  it("at three-quarters puts the eyes either side of the face's midline, the far eye inside the head", () => {
    const [far, near] = eyeLayout(1);
    expect(far.kind).toBe("far");
    expect(near.kind).toBe("near");
    const mid = headView(FACE_YAW[1]).P({
      x: 0,
      y: 6,
      z: Math.sqrt(43 * 43 - 36),
    }).x;
    expect(near.x + near.hw).toBeLessThan(mid);
    expect(far.x - far.hw).toBeGreaterThan(mid - 1);
    expect(far.x + far.hw).toBeLessThan(43);
    // the mouth stays near the midline
    expect(Math.abs(mouthLayout(1).x - mid)).toBeLessThan(4);
  });

  it("draws one profile eye at the side, inside the outline", () => {
    const side = eyeLayout(2);
    expect(side).toHaveLength(1);
    expect(side[0].kind).toBe("side");
    expect(Math.abs(side[0].x) + side[0].hw * 1.42).toBeLessThan(43);
  });
});

describe("Cragmuff's briefing picture", () => {
  it("has a crop around the ram even without a canvas", () => {
    const art = cragmuffGuideImage(false);
    expect(art.url).toBe("");
    const [x, y, w, h] = art.crop;
    expect(w).toBeGreaterThan(150);
    expect(h).toBeGreaterThan(150);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y + h).toBeLessThanOrEqual(art.height);
    expect(art.core[1]).toBeGreaterThan(y);
  });
});
