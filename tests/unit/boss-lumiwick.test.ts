import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  ARM_PIECES,
  lumiwickAction,
  lumiwickFacing,
  lumiwickPlacements,
  lumiwickPose,
  type LumiCue,
} from "../../apps/client/src/boss-lumiwick";
import { lumiwickPieces } from "../../apps/client/src/boss-lumiwick-paint";
import {
  EXPRS,
  MOUTHS,
  eyeLayout,
  lanternR,
  mouthLayout,
  EYE_Y,
} from "../../apps/client/src/boss-lumiwick-shape";

const cue = (o: Partial<LumiCue> = {}): LumiCue => ({
  clock: 1.3,
  phase: 1,
  reduced: false,
  flight: 1,
  windup: 0,
  castAge: 99,
  exposed: false,
  groundAge: 9,
  takeoffAge: 99,
  stagger: false,
  hurt: 0,
  dead: false,
  deadAge: 0,
  roarAge: 99,
  ...o,
});
const byKey = (f: ReturnType<typeof lumiwickPlacements>) =>
  Object.fromEntries(f.placements.map((p) => [p.key, p]));

describe("Lumiwick's pose from the battle", () => {
  it("reads the most important state first", () => {
    expect(lumiwickAction(cue({ dead: true, exposed: true })).id).toBe(
      "defeat",
    );
    expect(
      lumiwickAction(cue({ exposed: true, windKind: "dive-bomb", windup: 0.5 }))
        .id,
    ).toBe("grounded");
    // an attack outranks the take-off it may follow, and a new phase's flare outranks both
    expect(
      lumiwickAction(
        cue({ takeoffAge: 0.3, windKind: "heat-mark", windup: 0.1 }),
      ).id,
    ).toBe("heat-mark");
    expect(lumiwickAction(cue({ takeoffAge: 0.3 })).id).toBe("takeoff");
    expect(
      lumiwickAction(cue({ roarAge: 0.5, windKind: "dive-bomb", windup: 0.5 }))
        .id,
    ).toBe("roar");
    expect(lumiwickAction(cue({ stagger: true })).id).toBe("stagger");
    expect(lumiwickAction(cue()).id).toBe("idle");
  });
  it("maps each warning's span onto its windup, and the cast onto the follow-through", () => {
    for (const kind of [
      "dive-bomb",
      "ember-rain",
      "wing-gust",
      "flame-ring",
      "scorched-earth",
      "heat-mark",
    ]) {
      const [a, b] = ACTIONS[kind].wind!;
      expect(lumiwickAction(cue({ windKind: kind, windup: 0 })).t).toBeCloseTo(
        a,
      );
      expect(lumiwickAction(cue({ windKind: kind, windup: 1 })).t).toBeCloseTo(
        b,
      );
      expect(lumiwickAction(cue({ castKind: kind, castAge: 0.2 }))).toEqual({
        id: kind,
        t: b + 0.2,
      });
      // long after the cast it is idle again
      expect(lumiwickAction(cue({ castKind: kind, castAge: 9 })).id).toBe(
        "idle",
      );
    }
  });
  it("gestures as designed for each attack", () => {
    expect(lumiwickPose(cue({ windKind: "heat-mark", windup: 0.4 })).al).toBe(
      "point",
    );
    expect(lumiwickPose(cue({ windKind: "flame-ring", windup: 0.5 })).al).toBe(
      "wrap",
    );
    expect(lumiwickPose(cue({ windKind: "wing-gust", windup: 0.5 })).al).toBe(
      "up",
    );
    expect(lumiwickPose(cue({ castKind: "wing-gust", castAge: 0.05 })).al).toBe(
      "sweep",
    );
    expect(
      lumiwickPose(cue({ windKind: "scorched-earth", windup: 0.6 })).pitch,
    ).toBeGreaterThan(0.2);
    // the dive tips it crown-first through the streak only
    expect(
      lumiwickPose(cue({ castKind: "dive-bomb", castAge: 0.2 })).dive,
    ).toBeCloseTo(1);
    expect(lumiwickPose(cue({ castKind: "dive-bomb", castAge: 1 })).dive).toBe(
      0,
    );
    // grounded: on the floor, deflated, heart shown, ribbons slumped
    const g = lumiwickPose(cue({ exposed: true, groundAge: 1.5 }));
    expect(g.h).toBe(70);
    expect(g.sy).toBeLessThan(0.95);
    expect(g.heart).toBe(1);
    expect(g.al).toBe("slump");
    // beaten: the flame goes out and it crumples
    const d = lumiwickPose(cue({ dead: true, deadAge: 4.5 }));
    expect(d.dim).toBe(1);
    expect(d.crumple).toBe(1);
    // not flown up yet: it floats low
    expect(lumiwickPose(cue({ flight: 0 })).h).toBeLessThan(
      lumiwickPose(cue()).h - 40,
    );
  });
  it("holds still with reduced motion (windups included)", () => {
    const a = lumiwickPlacements(
        lumiwickPose(cue({ reduced: true, clock: 1 })),
        1,
      ),
      b = lumiwickPlacements(
        lumiwickPose(cue({ reduced: true, clock: 7.7 })),
        1,
      );
    expect(b.placements).toEqual(a.placements);
    expect(
      lumiwickPose(cue({ reduced: true, windKind: "heat-mark", windup: 0.65 }))
        .al,
    ).toBe("point");
  });
});

describe("Lumiwick's eight facings and its face", () => {
  it("turns to where it faces: 0 towards the camera, 2 screen right, mirrors 5-7", () => {
    const seen = Array.from({ length: 8 }, (_, i) =>
      lumiwickFacing(Math.PI / 2 - (i * Math.PI) / 4),
    );
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const views = seen.map((f) => {
      const k = byKey(lumiwickPlacements(lumiwickPose(cue()), f));
      return [
        k.body.piece,
        Math.sign(k.body.sx * k.body.sy),
        k.eyes?.piece.split("_")[1] ?? "-",
      ];
    });
    expect(views).toEqual([
      ["body_0", 1, "0"],
      ["body_1", 1, "1"],
      ["body_2", 1, "2"],
      ["body_3", 1, "-"],
      ["body_4", 1, "-"],
      ["body_3", -1, "-"],
      ["body_2", -1, "2"],
      ["body_1", -1, "1"],
    ]);
  });
  it("keeps the face on the body exactly through bob, squash, hurt and the dive", () => {
    for (const c of [
      cue(),
      cue({ clock: 2.9 }),
      cue({ hurt: 1 }),
      cue({ castKind: "dive-bomb", castAge: 0.2 }),
      cue({ exposed: true, groundAge: 1 }),
    ])
      for (let f = 0; f < 8; f++) {
        const k = byKey(
          lumiwickPlacements(lumiwickPose(c), f, { x: 1, y: 0.3 }),
        );
        if (!k.eyes) continue;
        for (const part of [k.eyes, k.mouth]) {
          expect(part.x).toBeCloseTo(k.body.x, 6);
          expect(part.y).toBeCloseTo(k.body.y, 6);
          expect(part.rot).toBeCloseTo(k.body.rot, 6);
          expect(part.sx / k.body.sx).toBeCloseTo(1, 6);
          expect(part.sy / k.body.sy).toBeCloseTo(1, 6);
        }
      }
  });
  it("draws eyes level, on one eye line, inside the outline, with the mouth on the face's centre line", () => {
    for (let v = 0; v < 3; v++) {
      const eyes = eyeLayout(v),
        m = mouthLayout(v);
      expect(new Set(eyes.map((e) => e.y.toFixed(3))).size).toBe(1);
      expect(eyes[0].y).toBeCloseTo(eyeLayout(0)[0].y, 6);
      for (const e of eyes)
        expect(Math.abs(e.x) + e.hw).toBeLessThan(lanternR(EYE_Y) - 4);
      expect(Math.abs(m.x) + Math.max(m.wn, m.wf)).toBeLessThan(
        lanternR(-33) - 4,
      );
      if (v === 0) {
        expect(eyes[0].x).toBeCloseTo(-eyes[1].x, 6);
        expect(m.x).toBeCloseTo(0, 6);
      } else {
        // turned: the mouth moves with the face, under the space between the eyes (one eye at the side)
        const mid = eyes.reduce((s, e) => s + e.x, 0) / eyes.length;
        expect(m.x).toBeGreaterThan(0);
        expect(Math.abs(m.x - mid)).toBeLessThan(18);
      }
    }
    expect(
      eyeLayout(1)
        .map((e) => e.kind)
        .sort(),
    ).toEqual(["far", "near"]);
    expect(eyeLayout(2).map((e) => e.kind)).toEqual(["side"]);
  });
});

describe("Lumiwick's atlas pieces", () => {
  it("paints every piece the pose can place", () => {
    const names = new Set(lumiwickPieces().map((p) => p.name));
    for (let v = 0; v < 5; v++)
      for (const n of [`body_${v}`, `dim_${v}`, `curl_${v}`])
        expect(names.has(n), n).toBe(true);
    for (let v = 0; v < 3; v++) {
      for (const e of EXPRS) expect(names.has(`eyes_${v}_${e}`)).toBe(true);
      for (const m of MOUTHS) expect(names.has(`mouth_${v}_${m}`)).toBe(true);
    }
    for (const a of ARM_PIECES) expect(names.has(a), a).toBe(true);
    for (const n of [
      "heat",
      "halo",
      "crumple",
      "heart",
      "star",
      "hole",
      "wick_0",
      "flame_0",
      "burn_0",
    ])
      expect(names.has(n), n).toBe(true);
    // and every placement over a full fight names one of them, with finite numbers
    const cues = [
      cue(),
      cue({ phase: 3 }),
      cue({ exposed: true, groundAge: 2, stagger: true }),
      cue({ dead: true, deadAge: 3.2 }),
      cue({ windKind: "heat-mark", windup: 0.5 }),
      cue({ castKind: "dive-bomb", castAge: 0.2 }),
    ];
    for (const c of cues)
      for (let f = 0; f < 8; f++)
        for (const p of lumiwickPlacements(lumiwickPose(c), f, {
          x: -1,
          y: 0.4,
        }).placements) {
          expect(names.has(p.piece), p.piece).toBe(true);
          for (const n of [p.x, p.y, p.rot, p.sx, p.sy, p.alpha])
            expect(Number.isFinite(n)).toBe(true);
        }
  });
});
