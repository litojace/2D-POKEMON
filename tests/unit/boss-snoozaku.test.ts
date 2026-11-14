import { describe, expect, it } from "vitest";
import {
  snoozakuGuideImage,
  snoozakuPlacements,
  snoozakuPose,
  type SnoozakuCue,
} from "../../apps/client/src/boss-snoozaku";
import {
  EYE_LINE,
  FACE_YAW,
  HR,
  MOUTH_LINE,
  TRUNK_EL,
  centreX,
  eyeLayout,
  mouthLayout,
} from "../../apps/client/src/boss-snoozaku-art";

const cue = (o: Partial<SnoozakuCue> = {}): SnoozakuCue => ({
  time: 1,
  phase: 1,
  reduced: false,
  windup: 0,
  castAge: 99,
  roarAge: 99,
  nightmareAge: 99,
  exposed: false,
  stagger: false,
  hurt: 0,
  dead: false,
  deadAge: 0,
  stride: 0,
  speed: 0,
  ...o,
});
const placed = (o: Partial<SnoozakuCue>, facing = 0, phase: 1 | 2 | 3 = 1) =>
  snoozakuPlacements(
    snoozakuPose(cue({ phase, ...o })),
    facing,
    phase,
    o.time ?? 1,
    !!o.reduced,
  );
const frames = (o: Partial<SnoozakuCue>, facing = 0, phase: 1 | 2 | 3 = 1) =>
  placed(o, facing, phase).images.map((p) => p.piece);
const FACE = ["head", "eyes", "mouth", "trunk"];

describe("Snoozaku's placements", () => {
  it("stands still in a few images: legs, body, head, mouth, trunk, eyes, cap and two wisps", () => {
    const list = frames({});
    expect(list.filter((f) => !f.startsWith("wisp_"))).toEqual([
      "legs4_0",
      "body_0",
      "head_0",
      "mouth_0_smile",
      "trunk_0_rest",
      "eyes_0_idle",
      "cap_0",
    ]);
    expect(list.filter((f) => f.startsWith("wisp_"))).toHaveLength(2);
    expect(
      placed({}).images.length + placed({}).glows.length,
    ).toBeLessThanOrEqual(12);
  });

  it("stays within about twenty images at rest and sixty at its busiest", () => {
    for (const phase of [1, 2, 3] as const)
      for (let f = 0; f < 8; f++) {
        const p = placed({ time: 0.5 }, f, phase);
        expect(p.images.length + p.glows.length).toBeLessThanOrEqual(20);
      }
    const busy = placed(
      {
        windKind: "whale-song",
        windup: 0.8,
        exposed: true,
        castKind: "lullaby",
        castAge: 0.2,
      },
      1,
      3,
    );
    expect(busy.images.length + busy.glows.length).toBeLessThanOrEqual(60);
  });

  it("shows eight facings from five drawn views; mirrors flip, the back has no face", () => {
    const views = [0, 1, 2, 3, 4, 5, 6, 7].map((f) => placed({}, f));
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
    const body = (i: number) => views[i].images.find((p) => p.key === "body")!;
    expect(body(6).piece).toBe(body(2).piece);
    expect(Math.sign(body(6).sx * body(6).sy)).toBe(
      -Math.sign(body(2).sx * body(2).sy),
    );
    for (const i of [3, 4, 5]) {
      const list = views[i].images.map((p) => p.piece);
      expect(
        list.some((p) => p.startsWith("eyes_") || p.startsWith("mouth_")),
      ).toBe(false);
      // from behind, the head is drawn before (behind) the body, the cap after it
      const keys = views[i].images.map((p) => p.key);
      expect(keys.indexOf("head")).toBeLessThan(keys.indexOf("body"));
      expect(keys.indexOf("cap")).toBeGreaterThan(keys.indexOf("body"));
    }
    // the trunk's direction tells the facing: it points the way it looks
    const tip = (i: number) => views[i].tip.x - views[i].head.x;
    expect(tip(2)).toBeGreaterThan(20);
    expect(tip(6)).toBeLessThan(-20);
    expect(Math.abs(tip(0))).toBeLessThan(3);
  });

  it("gives every attack its own pose", () => {
    const pose = (o: Partial<SnoozakuCue>) =>
      snoozakuPose(cue({ time: 0.5, ...o }));
    const lull = pose({ windKind: "lullaby", windup: 0.7 });
    expect([lull.trunk, lull.expr, lull.mouth]).toEqual(["up", "closed", "o"]);
    expect(lull.notes).toBeGreaterThan(0.5);
    const slamWind = pose({ windKind: "tail-splash", windup: 0.8 });
    expect([slamWind.trunk, slamWind.expr]).toEqual(["up", "glare"]);
    const slam = pose({ castKind: "tail-splash", castAge: 0.1 });
    expect([slam.trunk, slam.expr]).toEqual(["slam", "wide"]);
    expect(slam.sy).toBeLessThan(0.95);
    expect(
      pose({ windKind: "dream-bubbles", windup: 0.8 }).bubbles,
    ).toBeGreaterThan(0.3);
    const stars = pose({ windKind: "falling-stars", windup: 0.8 });
    expect(stars.expr).toBe("wide");
    expect(stars.capGlow).toBeGreaterThan(1);
    const snore = pose({ windKind: "whale-song", windup: 0.8 });
    expect(snore.expr).toBe("closed");
    expect(snore.zz).toBeGreaterThan(0.5);
    const dream = pose({ windKind: "dream-sequence", windup: 1 });
    expect([dream.expr, dream.mouth]).toEqual(["closed", "sleep"]);
    const jolt = pose({ nightmareAge: 0.1 });
    expect([jolt.expr, jolt.mouth]).toEqual(["wide", "grit"]);
    const yawn = pose({ roarAge: 0.3 });
    expect([yawn.mouth, yawn.trunk]).toEqual(["open", "up"]);
    // an open mouth always lifts the trunk out of its way
    for (const p of [lull, stars, snore, yawn])
      if (p.mouth === "o" || p.mouth === "open")
        expect(p.trunk).not.toBe("rest");
  });

  it("opens the star-heart when woken, is dizzy when staggered", () => {
    const woke = placed({ exposed: true }, 1);
    expect(woke.images.map((p) => p.piece)).toContain("heart");
    expect(woke.images.find((p) => p.key === "eyes")!.piece).toBe(
      "eyes_1_wide",
    );
    expect(woke.glows.some((g) => g.key === "hglow")).toBe(true);
    // the star-heart is on the chest, below the head
    expect(woke.heart.y).toBeGreaterThan(woke.head.y + 40);
    const dizzy = placed({ stagger: true, exposed: true }, 1);
    expect(dizzy.images.find((p) => p.key === "eyes")!.piece).toBe(
      "eyes_1_dizzy",
    );
    expect(dizzy.images.filter((p) => p.piece === "star_1")).toHaveLength(3);
  });

  it("grows star patterns, wisps and a glowing cap with each phase", () => {
    const w = (ph: 1 | 2 | 3) =>
      frames({}, 1, ph).filter((f) => f.startsWith("wisp_")).length;
    expect(w(1)).toBeLessThan(w(2));
    expect(w(2)).toBeLessThan(w(3));
    expect(frames({}, 1, 1).some((f) => f.startsWith("over_"))).toBe(false);
    expect(frames({}, 1, 2)).toContain("over_1_2");
    expect(frames({}, 1, 3)).toContain("over_1_3");
    expect(placed({}, 1, 1).glows.some((g) => g.key === "capglow")).toBe(false);
    expect(placed({}, 1, 3).glows.some((g) => g.key === "capglow")).toBe(true);
  });

  it("curls up asleep when beaten: legs tucked, eyes shut, the cap flopped", () => {
    const down = placed({ dead: true, deadAge: 4 }, 1, 3);
    const list = down.images.map((p) => p.piece);
    expect(list).toContain("paws_1");
    expect(
      list.some((f) => f.startsWith("legs4_") || f.startsWith("leg_")),
    ).toBe(false);
    expect(list).toContain("eyes_1_closed");
    expect(list).toContain("mouth_1_sleep");
    expect(down.glows).toHaveLength(0);
    const up = placed({}, 1, 3);
    expect(down.head.y).toBeGreaterThan(up.head.y + 8);
  });

  it("walks with its legs one by one", () => {
    const list = frames({ speed: 40, stride: 1 }, 2);
    expect(list.filter((f) => f.startsWith("leg_2_"))).toHaveLength(4);
    expect(list.some((f) => f.startsWith("legs4_"))).toBe(false);
  });

  it("holds still with reduced motion", () => {
    expect(snoozakuPose(cue({ time: 1, reduced: true }))).toEqual(
      snoozakuPose(cue({ time: 2.7, reduced: true })),
    );
  });
});

describe("Snoozaku's face (locked)", () => {
  it("keeps the front eyes level and mirrored, the mouth on the centre line", () => {
    const front = eyeLayout(0);
    expect(front).toHaveLength(2);
    expect(front[0].y).toBeCloseTo(front[1].y);
    expect(front[0].x).toBeCloseTo(-front[1].x);
    expect(front[0].hw).toBe(front[1].hw);
    expect(mouthLayout(0).x).toBeCloseTo(0);
  });

  it("keeps the eye line and the mouth height the same in every face view", () => {
    for (const v of [0, 1, 2]) {
      for (const e of eyeLayout(v)) expect(e.y).toBeCloseTo(EYE_LINE);
      expect(mouthLayout(v).y).toBeCloseTo(MOUTH_LINE);
    }
  });

  it("at three-quarters: near eye, a gap, the trunk's root, then the narrower far eye inside the head", () => {
    const [far, near] = eyeLayout(1);
    expect(far.kind).toBe("far");
    expect(near.kind).toBe("near");
    // its own narrower drawing, not a squeezed copy: same height, less width
    expect(far.hw).toBeLessThan(near.hw * 0.75);
    const root = centreX(FACE_YAW[1], TRUNK_EL);
    expect(near.x + near.hw).toBeLessThan(root - 8);
    expect(far.x - far.hw).toBeGreaterThan(root - 1);
    const edge = Math.sqrt(HR * HR - EYE_LINE * EYE_LINE);
    expect(far.x + far.hw).toBeLessThan(edge - 2);
    // the mouth stays on (or just inside) the face's centre line
    expect(
      Math.abs(mouthLayout(1).x - centreX(FACE_YAW[1], (-32 * Math.PI) / 180)),
    ).toBeLessThan(5);
  });

  it("draws one complete profile eye at the side, inside the outline", () => {
    const side = eyeLayout(2);
    expect(side).toHaveLength(1);
    expect(side[0].kind).toBe("side");
    const edge = Math.sqrt(HR * HR - EYE_LINE * EYE_LINE);
    expect(side[0].x + side[0].hw).toBeLessThan(edge - 6);
    // complete: clear of the trunk's root
    const root = centreX(FACE_YAW[2], TRUNK_EL) * 0.86;
    expect(side[0].x + side[0].hw).toBeLessThan(root - 11.5);
    const m = mouthLayout(2);
    expect(Math.hypot(m.x + 6, m.y)).toBeLessThan(HR);
  });

  it("moves the face as one group: no part drifts through bob, squash, hurt or a nod", () => {
    const offsets = (o: Partial<SnoozakuCue>, f: number) => {
      const p = placed(o, f);
      const head = p.images.find((i) => i.key === "head")!;
      return FACE.filter((k) => p.images.some((i) => i.key === k)).map((k) => {
        const i = p.images.find((x) => x.key === k)!;
        return {
          k,
          // in the head's own frame (undo its turn)
          x:
            (i.x - head.x) * Math.cos(-head.rot) -
            (i.y - head.y) * Math.sin(-head.rot),
          y:
            (i.x - head.x) * Math.sin(-head.rot) +
            (i.y - head.y) * Math.cos(-head.rot),
          rot: i.rot - head.rot,
          sx: i.sx,
          sy: i.sy,
        };
      });
    };
    for (const f of [0, 1, 2, 7]) {
      const rest = offsets({ time: 0 }, f);
      for (const o of [
        { time: 0.7 },
        { time: 2.2, hurt: 1 },
        { windKind: "tail-splash", windup: 0.9, time: 1.3 },
        { castKind: "tail-splash", castAge: 0.1 },
        { stagger: true, exposed: true, time: 1.9 },
      ]) {
        const now = offsets(o, f);
        for (const [i, a] of rest.entries()) {
          expect(now[i].x, `${f} ${a.k}`).toBeCloseTo(a.x, 4);
          expect(now[i].y, `${f} ${a.k}`).toBeCloseTo(a.y, 4);
          expect(now[i].rot, `${f} ${a.k}`).toBeCloseTo(a.rot, 4);
          // face pieces are never scaled or squashed (only mirrored)
          expect(Math.abs(now[i].sx), `${f} ${a.k}`).toBeCloseTo(1, 6);
          expect(Math.abs(now[i].sy), `${f} ${a.k}`).toBeCloseTo(1, 6);
        }
      }
    }
  });
});

describe("Snoozaku's briefing picture", () => {
  it("has a crop around the baku even without a canvas", () => {
    const art = snoozakuGuideImage(false);
    expect(art.url).toBe("");
    const [x, y, w, h] = art.crop;
    expect(w).toBeGreaterThan(150);
    expect(h).toBeGreaterThan(150);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y + h).toBeLessThanOrEqual(art.height);
    expect(art.core[1]).toBeGreaterThan(y);
  });
});
