import { describe, expect, it } from "vitest";
import {
  SOM_FACE,
  SOM_LOOKS,
  SOM_MOUTHS,
  SOM_SPEC,
  SOM_SPINE,
  somnaraGuideImage,
  somnaraPieces,
  somnaraPlacements,
  somnaraPose,
  somTurn,
  type SomCue,
} from "../../apps/client/src/boss-vector-somnara";

const cue = (o: Partial<SomCue> = {}): SomCue => ({
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
  ...o,
});
const placed = (o: Partial<SomCue> = {}, yaw = 0) =>
  somnaraPlacements(somnaraPose(cue(o)), yaw);
const keys = (p: ReturnType<typeof somnaraPlacements>) =>
  p.placements.map((q) => q.key);

describe("vector Somnara rig", () => {
  it("floats asleep, smiling, with its cottage and nightcap on its back", () => {
    const P = somnaraPose(cue());
    expect([P.look, P.mouth]).toEqual(["idle", "smile"]);
    const p = placed();
    const k = keys(p);
    // one smooth body of discs, a fluke, two flippers, the cottage and cap
    expect(k.filter((q) => /^spine\d+$/.test(q))).toHaveLength(SOM_SPINE);
    for (const part of ["fluke", "flip-1", "flip1", "cottage", "cap", "head"])
      expect(k).toContain(part);
    // one image per key, and every piece is drawn in the atlas
    expect(new Set(k).size).toBe(k.length);
    const pieces = new Set(somnaraPieces(1).map((q) => q.name));
    for (const q of p.placements) expect(pieces.has(q.piece)).toBe(true);
    // it floats: the head is well above the floor, the cap above the head
    const cap = p.placements.find((q) => q.key === "cap")!;
    expect(p.head.y).toBeLessThan(-50);
    expect(cap.y).toBeLessThan(p.head.y);
    // sorted back to front
    const z = p.placements.map((q) => q.z);
    expect(z).toEqual([...z].sort((a, b) => a - b));
  });

  it("winds up and casts each attack its own way", () => {
    const idle = somnaraPose(cue());
    const lull = somnaraPose(cue({ windKind: "lullaby", windup: 1 }));
    expect(lull.mouth).toBe("o");
    expect(lull.notes).toBeGreaterThan(0.9);
    const tail = somnaraPose(cue({ windKind: "tail-splash", windup: 1 }));
    expect(tail.tail).toBeGreaterThan(0.8);
    expect(tail.look).toBe("glare");
    const stars = somnaraPose(cue({ windKind: "falling-stars", windup: 1 }));
    expect(stars.look).toBe("wide");
    expect(stars.pitch).toBeGreaterThan(idle.pitch + 0.15);
    const song = somnaraPose(cue({ windKind: "whale-song", windup: 1 }));
    expect(song.mouth).toBe("open");
    const dream = somnaraPose(cue({ windKind: "dream-sequence", windup: 1 }));
    expect(dream.bobble).toBe(1);
    expect(dream.glow).toBeGreaterThan(idle.glow + 0.5);
    // the nightcap's bobble glows through a dream
    expect(keys(placed({ windKind: "dream-sequence", windup: 1 }))).toContain(
      "bobble",
    );
    // follow-through: the tail slams down, bubbles blown with eyes shut
    const slam = somnaraPose(cue({ castKind: "tail-splash", castAge: 0.25 }));
    expect(slam.tail).toBeLessThan(-0.5);
    expect(slam.mouth).toBe("grit");
    const blow = somnaraPose(cue({ castKind: "dream-bubbles", castAge: 0.4 }));
    expect([blow.look, blow.mouth]).toEqual(["closed", "o"]);
    expect(keys(placed({ castKind: "dream-bubbles", castAge: 0.4 }))).toContain(
      "bubble0",
    );
    // a cast long past leaves the idle pose
    expect(somnaraPose(cue({ castKind: "lullaby", castAge: 5 })).mouth).toBe(
      "smile",
    );
    // a yawn into a new phase
    expect(somnaraPose(cue({ roarAge: 0.5 })).mouth).toBe("open");
  });

  it("wakes wide-eyed with its star-heart open; dizzy when staggered", () => {
    const woke = placed({ exposed: true });
    const P = somnaraPose(cue({ exposed: true }));
    expect([P.look, P.mouth, P.exposed]).toEqual(["wide", "o", 1]);
    expect(keys(woke)).toContain("core");
    // the star-heart is on its throat, below the head
    expect(woke.core.y).toBeGreaterThan(woke.head.y);
    expect(keys(placed())).not.toContain("core");
    const dizzy = somnaraPose(cue({ exposed: true, stagger: true }));
    expect([dizzy.look, dizzy.exposed, dizzy.stars]).toEqual(["dizzy", 1, 1]);
    expect(keys(placed({ stagger: true }))).toContain("star0");
  });

  it("flinches when hit and sinks into a deep sleep when beaten", () => {
    const hurt = somnaraPose(cue({ hurt: 1 }));
    expect([hurt.look, hurt.mouth]).toEqual(["hurt", "grit"]);
    const up = placed();
    const dead = placed({ dead: true, deadAge: 3, exposed: true });
    const D = somnaraPose(cue({ dead: true, deadAge: 3, exposed: true }));
    expect([D.look, D.exposed]).toEqual(["closed", 0]);
    expect(dead.head.y).toBeGreaterThan(up.head.y + 20);
    expect(keys(dead)).not.toContain("core");
  });

  it("holds still with reduced motion, keeping windups but no flourishes", () => {
    const calm = somnaraPose(cue({ reduced: true }));
    expect(somnaraPose(cue({ reduced: true, clock: 7 }))).toEqual(calm);
    expect(
      somnaraPose(
        cue({ reduced: true, castKind: "tail-splash", castAge: 0.2, hurt: 1 }),
      ),
    ).toEqual(calm);
    expect(
      somnaraPose(cue({ reduced: true, windKind: "whale-song", windup: 1 }))
        .mouth,
    ).toBe("open");
  });

  it("shows its face towards the camera, in profile side on, and none from behind", () => {
    const eyes = (yaw: number) =>
      placed({ windKind: "whale-song", windup: 1 }, yaw)
        .placements.filter((q) => /^eye[nf]$/.test(q.key))
        .map((q) => q.piece)
        .sort();
    expect(eyes(0)).toEqual(["eye_front_glare", "eye_front_glare"]);
    expect(eyes(Math.PI / 4)).toEqual(["eye_far_glare", "eye_near_glare"]);
    expect(eyes(Math.PI / 2)).toEqual(["eye_side_glare"]);
    expect(eyes(Math.PI)).toEqual([]);
    // the head drawing for each view, mirrored for the other side
    const head = (yaw: number) =>
      placed({}, yaw).placements.find((q) => q.key === "head")!;
    expect(head(Math.PI / 2).piece).toBe("head_side");
    expect(head(-Math.PI / 2).piece).toBe("head_side");
    expect(Math.sign(head(Math.PI / 2).sx)).toBe(
      -Math.sign(head(-Math.PI / 2).sx),
    );
    expect(head(Math.PI).piece).toBe("head_back");
  });

  it("keeps the face on its lines, inside the head's outline, in every view", () => {
    const S = SOM_SPEC;
    const pieces = new Set(somnaraPieces(1).map((q) => q.name));
    for (let deg = -180; deg <= 180; deg += 1)
      for (const pitch of [-0.45, 0, 0.45])
        for (const look of SOM_LOOKS)
          for (const mouth of SOM_MOUTHS) {
            const r = SOM_FACE.face(
              { x: 0, y: 0, z: 0, yaw: (deg * Math.PI) / 180, pitch, roll: 0 },
              { look, mouth, blink: false },
            );
            for (const q of r.placements) {
              expect(pieces.has(q.piece)).toBe(true);
              // never squeezed: only ever mirrored
              expect(Math.abs(q.sx)).toBe(1);
              expect(q.sy).toBe(1);
            }
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
              // near eye, a clear gap, then the narrower far eye
              expect(far.u - far.g.hw).toBeGreaterThan(near.u + near.g.hw);
              expect(far.g.hw).toBeLessThan(near.g.hw);
            }
          }
  });

  it("turns through eight facings without flickering", () => {
    const facingFor = (deg: number) => Math.PI / 2 - (deg * Math.PI) / 180;
    expect(
      [0, 90, 180, 270].map(
        (d) => somTurn(facingFor(d), undefined, 0, 0, true).facing,
      ),
    ).toEqual([0, 2, 4, 6]);
    expect(somTurn(facingFor(90 - 25), 2, 0, 0, true).facing).toBe(2);
    expect(somTurn(facingFor(90 - 32), 2, 0, 0, true).facing).toBe(1);
  });

  it("gives the briefing diagram a crop around the whale (no picture outside a browser)", () => {
    for (const exposed of [false, true]) {
      const art = somnaraGuideImage(exposed);
      expect(art.url).toBe("");
      const [x, y, w, h] = art.crop;
      expect(w).toBeGreaterThan(150);
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
