import { describe, expect, it } from "vitest";
import {
  PRISMA_FACE,
  PRISMA_SPEC,
  SHARDS,
  prismaGuideImage,
  prismaIdle,
  prismaPieces,
  prismaPlacements,
  prismaPose,
  prismaSkull,
  prismaTurn,
  type PrismaCue,
} from "../../apps/client/src/boss-vector-prisma";

const cue = (o: Partial<PrismaCue> = {}): PrismaCue => ({
  clock: 1,
  phase: 1,
  reduced: false,
  windup: 0,
  castAge: 99,
  roarAge: 99,
  exposed: false,
  stagger: false,
  hurt: 0,
  dead: false,
  deadAge: 0,
  ...o,
});
const at = (P: ReturnType<typeof prismaPose>, deg: number) =>
  prismaPlacements(P, (deg * Math.PI) / 180, 1).placements;
const byKey = (list: ReturnType<typeof at>, key: string) =>
  list.find((p) => p.key === key);

describe("vector Prismatail rig", () => {
  it("stands as a whole peacock: train, body, wings, legs, neck, head and crown", () => {
    const list = at(prismaPose(cue()), 0);
    expect(list.filter((p) => /^shard\d$/.test(p.key))).toHaveLength(SHARDS);
    for (const k of [
      "body",
      "brooch",
      "wing-1",
      "wing1",
      "leg-1",
      "leg1",
      "foot-1",
      "foot1",
      "head",
      "crown",
      "beak",
    ])
      expect(byKey(list, k), k).toBeTruthy();
    // one image per key, and every piece is drawn in the atlas
    const keys = list.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    const pieces = new Set(prismaPieces(1).map((p) => p.name));
    for (const p of list) expect(pieces.has(p.piece), p.piece).toBe(true);
    // the crown rides on top of the head, the train behind the body
    expect(byKey(list, "crown")!.y).toBeLessThan(byKey(list, "head")!.y);
    expect(byKey(list, "shard4")!.z).toBeLessThan(byKey(list, "body")!.z);
  });

  it("winds up each attack its own way, then follows through", () => {
    const idle = prismaPose(cue());
    const fan = prismaPose(
      cue({ windKind: "fan-display", windup: 1, prismHot: 3 }),
    );
    expect(fan.fan).toBeGreaterThan(idle.fan + 0.2); // the train spread wide
    expect(fan.shine).toBe(1);
    expect(fan.prismHot).toBe(3);
    const lance = prismaPose(cue({ windKind: "prism-lance", windup: 1 }));
    expect(lance.look).toBe("glare");
    expect(lance.neckFwd).toBeLessThan(0); // draws its head back
    const strike = prismaPose(cue({ castKind: "prism-lance", castAge: 0.25 }));
    expect(strike.neckFwd).toBeGreaterThan(20); // and stabs
    expect(strike.mouth).toBe("open");
    const glare = prismaPose(cue({ windKind: "glare", windup: 1 }));
    expect(glare.eyeGlow).toBe(1);
    const halo = prismaPose(cue({ windKind: "halo-crush", windup: 1 }));
    expect(halo.rear).toBeGreaterThan(0.4);
    expect(halo.crown).toBe(1);
    // a cast long past leaves the idle pose
    expect(prismaPose(cue({ castKind: "glare", castAge: 5 })).look).toBe(
      "idle",
    );
  });

  it("opens its heart, reels when staggered, flinches when hit, and fades when beaten", () => {
    const open = prismaPose(cue({ exposed: true }));
    expect([open.look, open.exposed]).toEqual(["wide", 1]);
    const dizzy = prismaPose(cue({ stagger: true }));
    expect([dizzy.look, dizzy.stars]).toEqual(["dizzy", true]);
    expect(prismaPose(cue({ hurt: 0.9 })).look).toBe("hurt");
    const dead = prismaPose(cue({ dead: true, deadAge: 4, exposed: true }));
    expect(dead.look).toBe("closed");
    expect(dead.exposed).toBe(0);
    expect(dead.alpha).toBeLessThan(0.5);
    const standing = byKey(at(prismaPose(cue()), 0), "head")!;
    expect(byKey(at(dead, 0), "head")!.y).toBeGreaterThan(standing.y + 20);
  });

  it("holds still with reduced motion, keeping windups but no flourishes", () => {
    const calm = prismaPose(cue({ reduced: true }));
    expect(prismaPose(cue({ reduced: true, clock: 7 }))).toEqual(calm);
    expect(
      prismaPose(
        cue({
          reduced: true,
          castKind: "prism-lance",
          castAge: 0.25,
          roarAge: 0.5,
          walk: 1,
        }),
      ),
    ).toEqual(calm);
    expect(
      prismaPose(cue({ reduced: true, windKind: "glare", windup: 0.65 }))
        .eyeGlow,
    ).toBe(0.65);
  });

  it("draws its face for each view, never squeezed, the far eye tucked behind the beak", () => {
    const P = prismaIdle(1, 1, true);
    const eyes = (deg: number) =>
      at(P, deg).filter((p) => /^eye[nf]$/.test(p.key));
    expect(
      eyes(0)
        .map((e) => e.piece)
        .sort(),
    ).toEqual(["eye_front_idle", "eye_front_idle"]);
    expect(
      eyes(45)
        .map((e) => e.piece)
        .sort(),
    ).toEqual(["eye_far_idle", "eye_near_idle"]);
    expect(eyes(90).map((e) => e.piece)).toEqual(["eye_side_idle"]);
    expect(eyes(180)).toEqual([]);
    for (let deg = -180; deg <= 180; deg += 15)
      for (const e of eyes(deg)) {
        expect([Math.abs(e.sx), e.sy]).toEqual([1, 1]);
        // nothing tilts but the far eye, by its fixed lift
        expect(Math.abs(e.rot)).toBeCloseTo(
          e.piece.startsWith("eye_far") ? PRISMA_SPEC.farLift : 0,
          6,
        );
      }
    // at three-quarter the beak (the occluder) is drawn over the far eye, under the near one
    const tq = at(P, 45);
    const z = (k: string) => byKey(tq, k)!.z;
    expect(z("eyef")).toBeLessThan(z("beak"));
    expect(z("beak")).toBeLessThan(z("eyen"));
  });

  it("keeps its eyes inside the head's outline in every view", () => {
    const S = PRISMA_SPEC;
    for (let deg = -180; deg <= 180; deg += 1) {
      const built = PRISMA_FACE.face(
        { x: 0, y: 0, z: 0, yaw: (deg * Math.PI) / 180, pitch: 0, roll: 0 },
        { look: "idle", mouth: "closed" },
      );
      for (const e of built.eyes) {
        const [l, r] = prismaSkull(built.view, S.lines.eye);
        expect(e.u - e.g.hw).toBeGreaterThanOrEqual(l - 1e-6);
        expect(e.u + e.g.hw).toBeLessThanOrEqual(r + 1e-6);
      }
    }
  });

  it("turns through eight facings without flickering", () => {
    const facingFor = (deg: number) => Math.PI / 2 - (deg * Math.PI) / 180;
    expect(
      [0, 90, 180, 270].map(
        (d) => prismaTurn(facingFor(d), undefined, 0, 0, true).facing,
      ),
    ).toEqual([0, 2, 4, 6]);
    expect(prismaTurn(facingFor(90 - 25), 2, 0, 0, true).facing).toBe(2);
    expect(prismaTurn(facingFor(90 - 32), 2, 0, 0, true).facing).toBe(1);
  });

  it("keeps the train's glows few, and lights Fan Display's colour", () => {
    const shines = (P: ReturnType<typeof prismaPose>) =>
      at(P, 0).filter((p) => p.glow && /^shine/.test(p.key));
    expect(shines(prismaPose(cue({ phase: 3 }))).length).toBeLessThanOrEqual(5);
    const fan = shines(
      prismaPose(cue({ windKind: "fan-display", windup: 1, prismHot: 2 })),
    );
    expect(fan.length).toBeGreaterThan(0);
    expect(fan.length).toBeLessThanOrEqual(5);
    expect(new Set(fan.map((p) => p.tint)).size).toBe(1);
  });

  it("gives the briefing diagram a crop around the peacock (no picture outside a browser)", () => {
    for (const exposed of [false, true]) {
      const art = prismaGuideImage(exposed);
      expect(art.url).toBe("");
      const [x, y, w, h] = art.crop;
      expect(w).toBeGreaterThan(80);
      expect(h).toBeGreaterThan(80);
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
