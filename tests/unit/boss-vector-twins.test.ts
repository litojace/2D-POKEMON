import { describe, expect, it } from "vitest";
import {
  TWIN_A,
  TWIN_LOOKS,
  TWIN_MOUTHS,
  twinBell,
  twinIdle,
  twinPlacements,
  twinPose,
  twinTurn,
  twinsGuideImage,
  twinsPieces,
  type TwinCue,
  type TwinIndex,
} from "../../apps/client/src/boss-vector-twins";

const cue = (o: Partial<TwinCue> = {}): TwinCue => ({
  twin: 0,
  clock: 1,
  phase: 1,
  reduced: false,
  windup: 0,
  castAge: 99,
  roarAge: 99,
  exposed: false,
  stagger: false,
  hurt: 0,
  down: false,
  downAge: 0,
  dead: false,
  deadAge: 0,
  ...o,
});
const at = (twin: TwinIndex, deg: number, o: Partial<TwinCue> = {}) =>
  twinPlacements(twinPose(cue({ twin, ...o })), (deg * Math.PI) / 180, twin);
const byKey = (p: ReturnType<typeof at>, key: string) =>
  p.placements.find((q) => q.key === key);

describe("vector Storm Twins rig", () => {
  it("gives each twin its own face: Fizz laughs, Crackle glowers", () => {
    const fizz = at(0, 0),
      crackle = at(1, 0);
    expect(byKey(fizz, "eyen")!.piece).toBe("fz_eye_front_idle");
    expect(byKey(crackle, "eyen")!.piece).toBe("ck_eye_front_idle");
    expect(byKey(fizz, "head")!.piece).toBe("fz_bell");
    expect(byKey(crackle, "head")!.piece).toBe("ck_bell");
    // every placed piece is drawn in the atlas
    const names = new Set(twinsPieces(1).map((p) => p.name));
    for (const twin of [0, 1] as TwinIndex[])
      for (let deg = 0; deg < 360; deg += 15)
        for (const q of at(twin, deg).placements)
          expect(names.has(q.piece)).toBe(true);
    // a piece for every look and mouth in every view
    for (const pre of ["fz", "ck"]) {
      for (const v of ["front", "near", "far", "side"])
        for (const l of TWIN_LOOKS)
          expect(names.has(`${pre}_eye_${v}_${l}`)).toBe(true);
      for (const v of ["front", "tq", "side"])
        for (const m of TWIN_MOUTHS)
          expect(names.has(`${pre}_mouth_${v}_${m}`)).toBe(true);
    }
  });

  it("draws the face for each view, never squeezed, inside the bell", () => {
    for (const twin of [0, 1] as TwinIndex[])
      for (let deg = -180; deg <= 180; deg += 5) {
        // (held still: a rolling head tilts its eye line, as it should)
        const p = at(twin, deg, { reduced: true });
        const eyes = p.placements.filter((q) => /^eye[nf]$/.test(q.key));
        for (const e of eyes) {
          // only ever mirrored
          expect(Math.abs(e.sx)).toBe(1);
          expect(e.sy).toBe(1);
          // the eye's centre stays inside the bell's outline at its height
          const head = byKey(p, "head")!;
          expect(Math.abs(e.x - head.x)).toBeLessThan(
            twinBell(e.y - head.y) - 3,
          );
        }
        if (eyes.length === 2) expect(eyes[0].y).toBeCloseTo(eyes[1].y, 1);
      }
    expect(at(0, 45).placements.map((q) => q.piece)).toContain(
      "fz_eye_far_idle",
    );
    expect(at(0, 90).view).toBe("side");
    expect(at(0, 180).placements.some((q) => /^(eye|mouth)/.test(q.key))).toBe(
      false,
    );
  });

  it("winds up each attack its own way and follows through", () => {
    const idle = twinPose(cue());
    const clap = twinPose(cue({ windKind: "thunderclap", windup: 1 }));
    expect(clap.dy).toBeGreaterThan(idle.dy + 20); // rises before the clap
    expect(clap.look).toBe("glare");
    const field = twinPose(cue({ windKind: "static-field", windup: 1 }));
    expect(field.spread).toBe(1);
    expect(field.spark).toBe(1);
    // chain lightning: Crackle charges, Fizz bounces along
    expect(
      twinPose(cue({ twin: 1, windKind: "chain-lightning", windup: 1 })).spark,
    ).toBe(1);
    const rush = twinPose(cue({ castKind: "twin-rush", castAge: 0.27 }));
    expect(rush.dz).toBeGreaterThan(30);
    expect(rush.mouth).toBe("open");
    // a cast long past leaves the idle pose
    expect(twinPose(cue({ castKind: "thunderclap", castAge: 5 })).look).toBe(
      "idle",
    );
  });

  it("opens its core when exposed, goes dizzy when staggered", () => {
    const exposed = twinPose(cue({ exposed: true }));
    expect([exposed.look, exposed.mouth, exposed.exposed]).toEqual([
      "wide",
      "o",
      1,
    ]);
    const dizzy = twinPose(cue({ stagger: true }));
    expect([dizzy.look, dizzy.stars, dizzy.exposed]).toEqual([
      "dizzy",
      true,
      1,
    ]);
    // the core sits low in the bell, under the face
    const p = at(0, 0, { exposed: true });
    expect(p.core.y).toBeGreaterThan(byKey(p, "mouth")!.y);
  });

  it("sinks and fades while down; both sink when beaten", () => {
    const up = twinPose(cue());
    const down = twinPose(cue({ down: true, downAge: 2 }));
    expect(down.look).toBe("closed");
    expect(down.alpha).toBeLessThan(0.6);
    expect(down.dy).toBeLessThan(up.dy - 30);
    expect(down.exposed).toBe(0);
    const dead = twinPose(cue({ dead: true, deadAge: 2, exposed: true }));
    expect(dead.dy).toBeLessThan(-55);
    expect(dead.look).toBe("closed");
    expect(dead.exposed).toBe(0);
  });

  it("holds still with reduced motion, keeping windups but no flourishes", () => {
    const calm = twinPose(cue({ reduced: true }));
    expect(twinPose(cue({ reduced: true, clock: 7 }))).toEqual(calm);
    expect(
      twinPose(
        cue({
          reduced: true,
          hurt: 0.9,
          roarAge: 0.5,
          castKind: "thunderclap",
          castAge: 0.25,
        }),
      ),
    ).toEqual(calm);
    expect(
      twinPose(cue({ reduced: true, windKind: "thunderclap", windup: 1 })).dy,
    ).toBeGreaterThan(calm.dy + 20);
    expect(twinIdle(1, 3, 1, true)).toEqual(twinIdle(1, 9, 1, true));
  });

  it("turns through eight facings without flickering", () => {
    const facingFor = (deg: number) => Math.PI / 2 - (deg * Math.PI) / 180;
    expect(
      [0, 90, 180, 270].map(
        (d) => twinTurn(facingFor(d), undefined, 0, 0, true).facing,
      ),
    ).toEqual([0, 2, 4, 6]);
    expect(twinTurn(facingFor(90 - 25), 2, 0, 0, true).facing).toBe(2);
    expect(twinTurn(facingFor(90 - 32), 2, 0, 0, true).facing).toBe(1);
  });

  it("gives the briefing diagram a crop around both twins (no picture outside a browser)", () => {
    for (const exposed of [false, true]) {
      const art = twinsGuideImage(exposed);
      expect(art.url).toBe("");
      const [x, y, w, h] = art.crop;
      expect(w).toBeGreaterThan(2 * TWIN_A);
      expect(h).toBeGreaterThan(TWIN_A);
      expect(x + w).toBeLessThanOrEqual(art.width);
      expect(y + h).toBeLessThanOrEqual(art.height);
      expect(art.cores).toHaveLength(2);
      for (const [cx, cy] of art.cores) {
        expect(cx).toBeGreaterThan(x);
        expect(cx).toBeLessThan(x + w);
        expect(cy).toBeGreaterThan(y);
        expect(cy).toBeLessThan(y + h);
      }
    }
  });
});
