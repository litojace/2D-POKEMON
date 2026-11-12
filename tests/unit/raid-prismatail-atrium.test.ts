import { describe, expect, it } from "vitest";
import {
  ARROW,
  BEAM_LIFT,
  CHIME,
  MIRROR_TRACK,
  arrowPush,
  atriumFrame,
  atriumImages,
  atriumPieces,
  atriumRange,
  atriumSources,
  isMirrorTurnImpact,
  packAtrium,
  pillarFade,
  type AtriumInput,
} from "../../apps/client/src/raid-prismatail-atrium";
import { PRISMATAIL as P } from "../../packages/shared/src/raid-prismatail";

const DEF = [0, Math.PI / 4, 0, (Math.PI * 7) / 4];
const chain = (pts: [number, number][], beam = 0) =>
  pts.slice(1).map((p, i) => ({
    x: pts[i][0],
    y: pts[i][1],
    tx: p[0],
    ty: p[1],
    beam,
  }));
const LINKED = chain([
  [350, 450],
  [470, 450],
  [600, 300],
  [880, 300],
  [1000, 450],
]);
const SPLIT = [
  ...chain(
    [
      [350, 300],
      [470, 300],
      [600, 300],
      [880, 300],
      [1000, 450],
    ],
    0,
  ),
  ...chain(
    [
      [350, 600],
      [470, 600],
      [600, 600],
      [880, 600],
      [1000, 450],
    ],
    1,
  ),
];
function input(o: Partial<AtriumInput> & { angles?: number[] } = {}) {
  const angles = o.angles ?? DEF;
  return {
    mirrors: P.mirrors.map((m, i) => ({
      ...m,
      angle: angles[i],
      shown: angles[i],
      turnAge: Infinity,
    })),
    links: LINKED,
    sources: atriumSources({ phase: 1, partySize: 1 }),
    range: atriumRange(),
    lit: true,
    pillars: [],
    blinded: [],
    time: 10,
    anim: 3.3,
    low: false,
    reduced: false,
    ...o,
  } as AtriumInput;
}
const all = (f: ReturnType<typeof atriumFrame>) => [
  ...f.floor,
  ...f.top,
  ...f.stands.flatMap((s) => s.items),
];
const named = (f: ReturnType<typeof atriumFrame>, re: RegExp) =>
  all(f).filter((p) => re.test(p.piece));

describe("Sun Atrium atlas", () => {
  it("packs every piece once, inside the atlas, without overlaps", () => {
    const k = 2,
      { width, height, spots } = packAtrium(k);
    const names = atriumPieces().map((p) => p.name);
    expect(spots.map((s) => s.piece.name).sort()).toEqual([...names].sort());
    for (const s of spots) {
      expect(s.x).toBeGreaterThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(1);
      expect(s.x + s.w).toBeLessThanOrEqual(width - 1);
      expect(s.y + s.h).toBeLessThanOrEqual(height - 1);
      expect(s.w).toBe(Math.ceil(s.piece.w * k * s.piece.q));
    }
    for (const a of spots)
      for (const b of spots)
        if (a !== b)
          expect(
            a.x + a.w <= b.x ||
              b.x + b.w <= a.x ||
              a.y + a.h <= b.y ||
              b.y + b.h <= a.y,
          ).toBe(true);
    // One modest texture (about 1400×1200 at 2×; under 8 MB).
    expect(width * height * 4).toBeLessThan(8e6);
  });
});

describe("Sun Atrium layout", () => {
  it("draws the skylight's reach at exactly 300, or 360 with Dazzling", () => {
    expect(atriumRange()).toBe(300);
    expect(atriumRange("dazzling")).toBe(360);
    for (const range of [300, 360]) {
      const halves = named(atriumFrame(input({ range })), /^range$/);
      expect(halves).toHaveLength(2);
      for (const [q, p] of halves.entries()) {
        expect(p.sx).toBe(range / 300);
        expect(p.sy).toBe(range / 300);
        expect([p.x, p.y]).toEqual([P.source.x, P.source.y]);
        // two halves turned half a circle apart make the whole circle
        expect(p.rot! - halves[0].rot!).toBeCloseTo(q * Math.PI);
      }
    }
  });
  it("lights two skylights in phase 3 with a party, one otherwise", () => {
    expect(atriumSources({ phase: 3, partySize: 2 })).toEqual([
      { x: 350, y: 300 },
      { x: 350, y: 600 },
    ]);
    expect(atriumSources({ phase: 3, partySize: 1 })).toEqual([P.source]);
    expect(atriumSources({ phase: 2, partySize: 4 })).toEqual([P.source]);
    const f = atriumFrame(
      input({
        sources: atriumSources({ phase: 3, partySize: 2 }),
        links: SPLIT,
      }),
    );
    expect(named(f, /^range$/)).toHaveLength(4);
    expect(named(f, /^lens$/)).toHaveLength(2);
  });
  it("puts each beam on the server's exact line, gold for the first and cyan for the second", () => {
    const f = atriumFrame(input({ links: SPLIT }));
    const beams = f.floor.filter((p) => /^beam\d$/.test(p.piece));
    const spills = f.floor.filter((p) => /^spill\d$/.test(p.piece));
    expect(beams).toHaveLength(SPLIT.length);
    expect(spills).toHaveLength(SPLIT.length);
    for (const [i, L] of SPLIT.entries()) {
      const len = Math.hypot(L.tx - L.x, L.ty - L.y),
        rot = Math.atan2(L.ty - L.y, L.tx - L.x);
      expect(beams[i].piece).toBe(`beam${L.beam}`);
      expect(beams[i].rot).toBeCloseTo(rot);
      expect(beams[i].sx! * 64).toBeCloseTo(len);
      // the beam floats over the line; its light on the floor is the line itself
      expect([beams[i].x, beams[i].y]).toEqual([L.x, L.y - BEAM_LIFT]);
      expect([spills[i].x, spills[i].y, spills[i].rot]).toEqual([
        L.x,
        L.y,
        rot,
      ]);
    }
    // a flare at every bend (each node after the first link of a beam)
    expect(named(f, /^flare0$/)).toHaveLength(3);
    expect(named(f, /^flare1$/)).toHaveLength(3);
  });
  it("keeps each mirror sorted by its front edge, in its own colour, pointing where the server says", () => {
    const f = atriumFrame(input());
    const mirrors = f.stands.filter((s) => s.key.startsWith("mirror-"));
    expect(mirrors.map((s) => [s.key, s.groundY])).toEqual(
      P.mirrors.map((m, i) => [`mirror-${i}`, m.y + 23]),
    );
    for (const [i, s] of mirrors.entries()) {
      expect(s.items[0].piece).toBe(`post${i}`);
      expect(s.items[s.items.length - 1].piece).toBe(`gem${i}`);
    }
    const arrows = f.floor.filter((p) => p.piece === "arrow");
    expect(arrows.map((a) => a.rot)).toEqual(DEF);
    // the notch it points at, on its turning track
    const notches = f.floor.filter((p) => p.piece === "glow" && p.sx === 0.36);
    for (const [i, n] of notches.entries())
      expect(
        Math.hypot(n.x - P.mirrors[i].x, n.y - P.mirrors[i].y),
      ).toBeCloseTo(MIRROR_TRACK);
  });
  it("shows every one of the eight directions clear of the crystal and its hoop", () => {
    // The post's silhouette (world units from the mirror's foot): the hoop
    // (centre 0,-24, radius 28 plus its outline) with the crystal inside it,
    // and the plinth below.
    const hidden = (x: number, y: number) =>
      Math.hypot(x, y + 24) < 32 ||
      (Math.abs(x) < 27 && y > -10 && y < 29) ||
      (Math.abs(x) < 4 && y > -60 && y < -48);
    for (let d = 0; d < 8; d++) {
      const a = (d * Math.PI) / 4,
        push = arrowPush(a),
        ux = Math.cos(a),
        uy = Math.sin(a);
      // the whole head: its base corners and its tip
      const pts = [
        [ARROW.headBase, -ARROW.halfWidth],
        [ARROW.headBase, ARROW.halfWidth],
        [(ARROW.headBase + ARROW.tip) / 2, 0],
        [ARROW.tip, 0],
      ].map(([along, side]) => [
        ux * (along + push) - uy * side,
        uy * (along + push) + ux * side,
      ]);
      for (const [x, y] of pts)
        expect(hidden(x, y), `direction ${d}`).toBe(false);
    }
    // Sideways and down the arrow starts at the post, as before.
    expect(arrowPush(0)).toBe(0);
    expect(arrowPush(Math.PI / 2)).toBe(0);
    expect(arrowPush(Math.PI)).toBe(0);
  });
  it("lights the mirrors carrying light behind their crystals, never over them", () => {
    const f = atriumFrame(input());
    const carrying = f.stands.filter((s) =>
      s.items.some((p) => p.piece === "glow"),
    );
    // mirrors 0 and 1 carry the linked beam
    expect(carrying.map((s) => s.key)).toEqual([
      "mirror-0",
      "mirror-1",
      "skylight-0",
    ]);
    for (const s of carrying) {
      const glow = s.items.findIndex((p) => p.piece === "glow"),
        crystal = s.items.findIndex((p) => /^(gem\d|lens)$/.test(p.piece));
      expect(glow).toBeLessThan(crystal);
    }
    expect(f.floor.filter((p) => p.piece === "arrowGlow")).toHaveLength(2);
  });
  it("rings a turned mirror's chime for the server's 0.4 s, at radius 35", () => {
    const turned = (age: number) => {
      const o = input();
      o.mirrors[1].turnAge = age;
      return atriumFrame(o);
    };
    expect(named(turned(0.1), /^chime$/)).toHaveLength(1);
    expect(named(turned(0.1), /^chime$/)[0]).toMatchObject({ x: 880, y: 300 });
    expect(named(turned(CHIME + 0.01), /^chime$/)).toHaveLength(0);
    expect(named(turned(Infinity), /^chime$/)).toHaveLength(0);
  });
  it("leaves out the sunbeam and floor light strips on Low", () => {
    const high = atriumFrame(
      input({
        links: SPLIT,
        sources: atriumSources({ phase: 3, partySize: 2 }),
      }),
    );
    const low = atriumFrame(
      input({
        links: SPLIT,
        sources: atriumSources({ phase: 3, partySize: 2 }),
        low: true,
      }),
    );
    expect(named(high, /^shaft$/)).toHaveLength(2);
    expect(named(high, /^spill/)).toHaveLength(8);
    expect(named(low, /^(shaft|spill\d)$/)).toHaveLength(0);
    // the beams themselves are gameplay: always drawn
    expect(named(low, /^beam\d$/)).toHaveLength(8);
    expect(atriumImages(high) - atriumImages(low)).toBe(10);
  });
  it("holds still for reduced motion: no light blades, no sparkle", () => {
    const at = (anim: number, links = LINKED, lit = true) =>
      atriumFrame(input({ anim, reduced: true, links, lit }));
    expect(named(at(1), /^(crown|spark\d|glint)$/)).toHaveLength(0);
    expect(named(at(1, [], false), /^glint$/)).toHaveLength(0);
    expect(at(1)).toEqual(at(7.5));
    // with motion: blades turn, a spark runs each link, gems glint while open
    const moving = atriumFrame(input());
    expect(named(moving, /^crown$/)).toHaveLength(1);
    expect(named(moving, /^spark0$/)).toHaveLength(LINKED.length);
    expect(
      named(atriumFrame(input({ lit: false, links: [] })), /^glint$/),
    ).toHaveLength(12);
  });
  it("dims the skylight while the heart is open", () => {
    const f = atriumFrame(input({ lit: false, links: [] }));
    expect(named(f, /^(range|shaft|crown)$/)).toHaveLength(0);
    expect(named(f, /^plate$/)[0].alpha).toBe(0.55);
    expect(named(f, /^lens$/)[0].alpha).toBe(0.6);
  });
  it("raises a Sun Pillar for its 4 seconds, fading at both ends", () => {
    expect(pillarFade(10, 14)).toBe(0);
    expect(pillarFade(10.25, 14)).toBe(1);
    expect(pillarFade(13.75, 14)).toBeCloseTo(0.5);
    expect(pillarFade(14, 14)).toBe(0);
    const f = atriumFrame(input({ pillars: [{ x: 760, y: 450, until: 12 }] }));
    expect(f.stands.find((s) => s.key === "pillar-0")).toMatchObject({
      groundY: 450,
    });
    expect(named(f, /^(pbase|pcrys)$/)).toHaveLength(2);
    expect(
      named(
        atriumFrame(input({ pillars: [{ x: 760, y: 450, until: 9 }] })),
        /^p(base|crys)$/,
      ),
    ).toHaveLength(0);
  });
  it("marks each Blinded raider over the head", () => {
    const f = atriumFrame(
      input({ blinded: [{ x: 700, y: 470 }], reduced: true }),
    );
    expect(f.top.filter((p) => p.piece === "blind")).toEqual([
      expect.objectContaining({ x: 700, y: 470 - 102 }),
    ]);
  });
  it("knows the server's mirror-turn flash, so the scene shows the chime instead", () => {
    const raid = {
      boss: "prismatail",
      mirrors: P.mirrors.map((m) => ({ ...m })),
    };
    const e = { kind: "raid-impact", x: 880, y: 300, raidRadius: 35 };
    expect(isMirrorTurnImpact(raid, e)).toBe(true);
    expect(isMirrorTurnImpact(raid, { ...e, raidRadius: 90 })).toBe(false);
    expect(isMirrorTurnImpact(raid, { ...e, x: 700 })).toBe(false);
    expect(isMirrorTurnImpact({ ...raid, boss: "emberwing" }, e)).toBe(false);
    expect(isMirrorTurnImpact(undefined, e)).toBe(false);
  });
  it("draws a modest number of images in every state", () => {
    const counts = {
      start: atriumImages(atriumFrame(input({ links: [] }))),
      linked: atriumImages(atriumFrame(input())),
      split: atriumImages(
        atriumFrame(
          input({
            links: SPLIT,
            sources: atriumSources({ phase: 3, partySize: 2 }),
          }),
        ),
      ),
      splitLow: atriumImages(
        atriumFrame(
          input({
            links: SPLIT,
            sources: atriumSources({ phase: 3, partySize: 2 }),
            low: true,
          }),
        ),
      ),
    };
    expect(counts.split).toBeLessThanOrEqual(84);
    expect(counts.splitLow).toBeLessThan(counts.split);
    expect(counts.start).toBeLessThan(counts.linked);
  });
});
