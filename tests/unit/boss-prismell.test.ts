import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PRISMELL_SCALE,
  prismellGuideImage,
  prismellPlacements,
  prismellPose,
  prismellRestCue,
  type PrismellCue,
} from "../../apps/client/src/boss-prismell";
import {
  ATT,
  EYE_LINE,
  EXPRS,
  HEAD_YAW,
  MOUTH_Y,
  MOUTHS,
  eyeLayout,
  headHalf,
  mouthLayout,
  prismellPieceSpecs,
} from "../../apps/client/src/boss-prismell-paint";
import { PRISM_COLORS } from "../../packages/shared/src/raid-prismatail";

const cue = (o: Partial<PrismellCue> = {}): PrismellCue => ({
  ...prismellRestCue(),
  reduced: false,
  clock: 1.1,
  ...o,
});
const place = (o: Partial<PrismellCue> = {}, facing = 1, phase = 1) =>
  prismellPlacements(prismellPose(cue(o)), facing, phase);
const pieces = (o: Partial<PrismellCue> = {}, facing = 1, phase = 1) =>
  place(o, facing, phase).images.map((p) => p.piece);
const byKey = (o: Partial<PrismellCue>, key: string, facing = 1) => {
  const pl = place(o, facing);
  return [...pl.images, ...pl.glows].find((p) => p.key === key);
};

describe("Prismell's placements", () => {
  it("stands in a handful of images: body, head and face, antennae, shell, heart and shield", () => {
    expect(pieces({}, 1)).toEqual([
      "body_1",
      "shell_1_1",
      "heart_shut",
      "shield",
      "neck_1",
      "ant",
      "head_1",
      "eyes_1_idle",
      "mouth_1_smile",
      "ant",
    ]);
  });

  it("places only painted pieces", () => {
    const names = new Set(
      prismellPieceSpecs().map((s: { name: string }) => s.name),
    );
    const looks: Partial<PrismellCue>[] = [
      {},
      { windKind: "fan-display", windup: 0.8, prismHot: 3 },
      { windKind: "glare", windup: 0.8 },
      { stagger: true, exposed: true },
      { dead: true, deadAge: 0.8 },
      { dead: true, deadAge: 4 },
      { roarAge: 0.5 },
    ];
    for (const f of [0, 1, 2, 3, 4, 5, 6, 7])
      for (const o of looks)
        for (const ph of [1, 2, 3]) {
          const pl = place(o, f, ph);
          for (const p of [...pl.images, ...pl.glows])
            expect(names.has(p.piece), `${p.piece} f${f}`).toBe(true);
          // one image per key
          const keys = [...pl.images, ...pl.glows].map((p) => p.key);
          expect(new Set(keys).size).toBe(keys.length);
        }
  });

  it("shows eight facings from five drawn views; mirrors flip, the back has no face", () => {
    const views = [0, 1, 2, 3, 4, 5, 6, 7].map((f) => place({}, f));
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
    const shell = (i: number) =>
      views[i].images.find((p) => p.key === "shell")!;
    expect(shell(6).piece).toBe(shell(2).piece);
    expect(Math.sign(shell(6).sx * shell(6).sy)).toBe(
      -Math.sign(shell(2).sx * shell(2).sy),
    );
    // the head is on the facing's side: right at 90°, left at 270°
    expect(views[2].head.x).toBeGreaterThan(views[2].shell.x);
    expect(views[6].head.x).toBeLessThan(views[6].shell.x);
    for (const i of [3, 4, 5]) {
      expect(views[i].images.some((p) => p.piece.startsWith("eyes_"))).toBe(
        false,
      );
      expect(views[i].images.some((p) => p.piece.startsWith("mouth_"))).toBe(
        false,
      );
      // from behind, the head is behind the shell, the tail in front of it
      const keys = views[i].images.map((p) => p.key);
      expect(keys.indexOf("head")).toBeLessThan(keys.indexOf("shell"));
      expect(keys.indexOf("tail")).toBeGreaterThan(keys.indexOf("shell"));
    }
    for (const i of [0, 1, 2, 6, 7]) {
      const keys = views[i].images.map((p) => p.key);
      expect(keys.indexOf("head")).toBeGreaterThan(keys.indexOf("shell"));
      expect(keys.indexOf("eyes")).toBeGreaterThan(keys.indexOf("head"));
    }
  });

  it("never squashes the face: it moves with the head as one group", () => {
    const states: Partial<PrismellCue>[] = [
      {},
      { clock: 2.3 },
      { walk: 1, clock: 0.7 },
      { windKind: "halo-crush", windup: 0.9 },
      { castKind: "halo-crush", castAge: 0.2 },
      { hurt: 1 },
      { stagger: true, exposed: true, clock: 1.7 },
      { roarAge: 0.5 },
    ];
    for (const f of [0, 1, 2, 6, 7])
      for (const o of states) {
        const pl = place(o, f);
        const head = pl.images.find((p) => p.key === "head")!;
        for (const k of ["eyes", "mouth"]) {
          const p = pl.images.find((q) => q.key === k)!;
          // the same transform as the head: same place, turn and size
          expect(p.x).toBeCloseTo(head.x, 6);
          expect(p.y).toBeCloseTo(head.y, 6);
          expect(p.rot).toBeCloseTo(head.rot, 6);
          expect(Math.abs(p.sx)).toBeCloseTo(PRISMELL_SCALE, 6);
          expect(Math.abs(p.sy)).toBeCloseTo(PRISMELL_SCALE, 6);
        }
      }
    // ...while the body does squash
    const body = byKey({ castKind: "halo-crush", castAge: 0.2 }, "body")!;
    expect(Math.abs(body.sy)).toBeLessThan(PRISMELL_SCALE * 0.95);
  });

  it("winds up and follows through for every attack", () => {
    const rest = prismellPose(cue());
    const lance = prismellPose(cue({ windKind: "prism-lance", windup: 0.9 }));
    expect(lance.charge).toBeGreaterThan(0.8);
    expect(lance.look).toBe("glare");
    // a blink at rest never closes the wind-up glare (3.6 s is mid-blink)
    expect(prismellPose(cue({ clock: 3.6 })).look).toBe("closed");
    expect(
      prismellPose(cue({ clock: 3.6, windKind: "prism-lance", windup: 0.9 }))
        .look,
    ).toBe("glare");
    expect(
      prismellPose(cue({ windKind: "refraction", windup: 0.9 })).charge,
    ).toBeGreaterThan(0.8);
    expect(
      prismellPose(cue({ castKind: "prism-lance", castAge: 0.25 })).mouth,
    ).toBe("open");
    // Fan Display: the shell takes on the striking slice's colour, eyes shut in pride
    const fan = place({ windKind: "fan-display", windup: 0.9, prismHot: 3 }, 1);
    const shell = fan.images.find((p) => p.key === "shell")!;
    expect(shell.tint).toBeDefined();
    const hot = PRISM_COLORS[3];
    const near = (c: number, s: number) =>
      Math.abs(((c >> s) & 255) - ((hot >> s) & 255));
    expect(
      near(shell.tint!, 16) + near(shell.tint!, 8) + near(shell.tint!, 0),
    ).toBeLessThan(150);
    expect(fan.glows.some((g) => g.key === "hot" && g.tint === hot)).toBe(true);
    expect(
      prismellPose(cue({ windKind: "fan-display", windup: 0.9 })).look,
    ).toBe("closed");
    // Glare: the shell flashes with spokes of light
    const glare = place({ windKind: "glare", windup: 0.9 });
    expect(glare.glows.some((g) => g.key === "flash")).toBe(true);
    expect(
      glare.glows.filter((g) => g.piece === "ray").length,
    ).toBeGreaterThanOrEqual(6);
    // Halo Crush: it rears up, the halo lifting off the shell
    const halo = prismellPose(cue({ windKind: "halo-crush", windup: 0.9 }));
    expect(halo.lift).toBeGreaterThan(rest.lift + 5);
    expect(halo.halo).toBeGreaterThan(0.8);
    expect(
      prismellPose(cue({ castKind: "halo-crush", castAge: 0.2 })).sy,
    ).toBeLessThan(0.95);
    // the relay wakes it
    expect(
      prismellPose(cue({ windKind: "light-relay", windup: 0.6 })).look,
    ).toBe("wide");
  });

  it("opens its heart when the relay lands or it is staggered", () => {
    const shut = pieces({});
    expect(shut).toContain("heart_shut");
    expect(shut).toContain("shield");
    const open = pieces({ exposed: true });
    expect(open).toContain("heart_open");
    expect(open).not.toContain("shield");
    expect(prismellPose(cue({ exposed: true })).look).toBe("wide");
    const dizzy = place({ stagger: true, exposed: true });
    expect(dizzy.images.some((p) => p.piece === "star")).toBe(true);
    expect(dizzy.images.find((p) => p.key === "eyes")!.piece).toBe(
      "eyes_1_dizzy",
    );
    expect(dizzy.images.find((p) => p.key === "heart")!.piece).toBe(
      "heart_open",
    );
    expect(prismellPose(cue({ hurt: 1 })).look).toBe("hurt");
  });

  it("shows off at a new phase, and grows facets and glints each phase", () => {
    const roar = prismellPose(cue({ roarAge: 0.6 }));
    expect(roar.look).toBe("closed");
    expect(roar.mouth).toBe("open");
    expect(roar.lift).toBeGreaterThan(5);
    expect(pieces({}, 1, 2)).toContain("shell_1_2");
    expect(pieces({}, 1, 3)).toContain("shell_1_3");
    const glints = (ph: number) =>
      place({ reduced: true }, 2, ph).glows.filter((g) => g.piece === "sparkle")
        .length;
    expect(glints(2)).toBeGreaterThan(glints(1));
    expect(glints(3)).toBeGreaterThan(glints(2));
  });

  it("when beaten, its shell goes dark and it tucks itself in", () => {
    const early = place({ dead: true, deadAge: 0.3 });
    expect(early.images.find((p) => p.key === "eyes")?.piece).toBe(
      "eyes_1_closed",
    );
    const down = place({ dead: true, deadAge: 4 }, 1, 3);
    const names = down.images.map((p) => p.piece);
    expect(names).toContain("shellD_1");
    expect(names).toContain("bodyD_1");
    expect(names).not.toContain("head_1");
    expect(names.some((n) => n.startsWith("eyes_"))).toBe(false);
    expect(down.glows).toHaveLength(0);
    // the head slid back towards the shell before it went in
    const P = prismellPose(cue({ dead: true, deadAge: 1 }));
    expect(P.tuck).toBeGreaterThan(0.5);
  });

  it("holds still with reduced motion", () => {
    const a = place({ clock: 1, reduced: true });
    const b = place({ clock: 2.7, reduced: true });
    expect(a).toEqual(b);
    // no follow-through either
    expect(
      prismellPose(cue({ reduced: true, castKind: "halo-crush", castAge: 0.2 }))
        .sy,
    ).toBe(prismellPose(cue({ reduced: true })).sy);
  });

  it("stays within the image budget: about 20 at rest, 60 at the busiest", () => {
    let peak = 0;
    for (const f of [0, 1, 2, 3, 4, 5, 6, 7])
      for (const ph of [1, 2, 3]) {
        const rest = place({}, f, ph);
        expect(rest.images.length + rest.glows.length).toBeLessThanOrEqual(20);
        for (const o of [
          { windKind: "glare", windup: 1, roarAge: 0.5 },
          { windKind: "fan-display", windup: 1, prismHot: 1, roarAge: 0.6 },
          { stagger: true, exposed: true },
        ] as Partial<PrismellCue>[]) {
          const busy = place(o, f, ph);
          peak = Math.max(peak, busy.images.length + busy.glows.length);
        }
      }
    expect(peak).toBeLessThanOrEqual(60);
  });

  it("is about as big as before in the arena", () => {
    const pl = place({}, 2);
    // the shell's top rises some 150-200 px; the old peacock reached ~190
    expect(-pl.shellTop.y).toBeGreaterThan(140);
    expect(-pl.shellTop.y).toBeLessThan(200);
  });
});

describe("Prismell's face", () => {
  it("keeps the front eyes level and symmetric, the mouth on the centre line", () => {
    const front = eyeLayout(0);
    expect(front).toHaveLength(2);
    expect(front[0].y).toBeCloseTo(front[1].y);
    expect(front[0].x).toBeCloseTo(-front[1].x);
    expect(front[0].hw).toBeCloseTo(front[1].hw);
    expect(mouthLayout(0).x).toBeCloseTo(0);
  });

  it("keeps the eye line and the mouth height the same in every face view", () => {
    for (const v of [0, 1, 2]) {
      for (const e of eyeLayout(v)) expect(e.y).toBe(EYE_LINE);
      expect(mouthLayout(v).y).toBe(MOUTH_Y);
      // the mouth on the face's centre line, which turns with the head
      expect(mouthLayout(v).x).toBeCloseTo(
        headHalf(MOUTH_Y) * Math.sin(HEAD_YAW[v]),
      );
    }
  });

  it("at three-quarters: a near eye and a narrower far eye either side of the centre line, the far one inside the outline", () => {
    const [far, near] = eyeLayout(1);
    expect(far.kind).toBe("far");
    expect(near.kind).toBe("near");
    expect(far.hw).toBeLessThan(near.hw * 0.75);
    // same height: it is a different drawing, not a squeezed one
    expect(far.hh).toBeGreaterThan(near.hh * 0.9);
    const mid = headHalf(EYE_LINE) * Math.sin(HEAD_YAW[1]);
    expect(near.x).toBeLessThan(mid);
    expect(far.x).toBeGreaterThan(mid);
    expect(far.x + far.hw).toBeLessThan(headHalf(EYE_LINE) - 1.5);
    // spacing stays close to the front view's
    const [l, r] = eyeLayout(0);
    expect(Math.abs(far.x - near.x)).toBeGreaterThan(Math.abs(r.x - l.x) * 0.7);
  });

  it("draws one complete profile eye at the side, fully inside the outline", () => {
    const side = eyeLayout(2);
    expect(side).toHaveLength(1);
    expect(side[0].kind).toBe("side");
    expect(side[0].x + side[0].hw * 1.1).toBeLessThan(headHalf(EYE_LINE) - 1);
  });

  it("paints every eye and mouth for the three face views, and none from behind", () => {
    const names = prismellPieceSpecs().map((s: { name: string }) => s.name);
    for (const v of [0, 1, 2]) {
      for (const e of EXPRS) expect(names).toContain(`eyes_${v}_${e}`);
      for (const m of MOUTHS) expect(names).toContain(`mouth_${v}_${m}`);
    }
    expect(names.some((n: string) => /^eyes_[34]_/.test(n))).toBe(false);
  });

  it("keeps the eyes on one level line in every facing (world px)", () => {
    for (const f of [0, 1, 2, 6, 7]) {
      const pl = place({ reduced: true }, f);
      const ys = pl.eyes.map((e) => e.y - pl.head.y);
      for (const y of ys) expect(y).toBeCloseTo(EYE_LINE * PRISMELL_SCALE, 5);
    }
  });
});

describe("Prismell's attach points", () => {
  it("puts the head on the facing's side and the heart inside the shell", () => {
    expect(ATT[0].head.x).toBeCloseTo(0);
    expect(ATT[2].head.x).toBeGreaterThan(40);
    for (const a of ATT) {
      expect(Math.abs(a.core.x - a.shell.x)).toBeLessThan(30);
      expect(Math.abs(a.core.y - a.shell.y)).toBeLessThan(30);
    }
  });
});

describe("Prismell's briefing picture", () => {
  it("has a crop around the snail even without a canvas", () => {
    const art = prismellGuideImage(false);
    expect(art.url).toBe("");
    const [x, y, w, h] = art.crop;
    expect(w).toBeGreaterThan(150);
    expect(h).toBeGreaterThan(150);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y + h).toBeLessThanOrEqual(art.height);
    expect(art.core[1]).toBeGreaterThan(y);
    expect(art.core[1]).toBeLessThan(y + h);
  });
});

// ── the atlas: drawn once at scene creation, never read back ──
const SRC = join(__dirname, "../../apps/client/src");
const READ_BACK = ["getImageData", "toDataURL", "toBlob", "readPixels"];
function fakeContext(canvas: object) {
  const gradient = { addColorStop: () => undefined };
  return new Proxy(
    {},
    {
      get: (_t, key: string) => {
        if (READ_BACK.includes(key)) throw new Error(`read-back: ${key}`);
        if (key === "canvas") return canvas;
        return (..._args: unknown[]) =>
          key.startsWith("create") ? gradient : undefined;
      },
      set: () => true,
    },
  );
}
const g = globalThis as any;
const saved = { document: g.document, Path2D: g.Path2D };
describe("Prismell's atlas", () => {
  beforeAll(() => {
    g.document = {
      createElement: () => {
        const canvas: any = { width: 0, height: 0 };
        for (const k of READ_BACK)
          canvas[k] = () => {
            throw new Error(`read-back: ${k}`);
          };
        const ctx = fakeContext(canvas);
        canvas.getContext = () => ctx;
        return canvas;
      },
    };
    g.Path2D = class {
      constructor() {
        return new Proxy(this, { get: () => () => undefined });
      }
    };
  });
  afterAll(() => {
    g.document = saved.document;
    g.Path2D = saved.Path2D;
  });

  it("is built without reading a single pixel back, within 8 MB", async () => {
    const { buildPrismellAtlas } =
      await import("../../apps/client/src/boss-prismell-paint");
    const atlas = buildPrismellAtlas() as any;
    expect(Object.keys(atlas.frames).length).toBe(prismellPieceSpecs().length);
    expect(atlas.bytes).toBeGreaterThan(0);
    expect(atlas.bytes).toBeLessThanOrEqual(8 * 1024 * 1024);
  });

  it("never follows the screen's pixel ratio, and nothing in it reads pixels", () => {
    for (const f of [
      "boss-prismell-paint.ts",
      "boss-prismell.ts",
      "boss-prismell-rig.ts",
      "prismell-attack-fx.ts",
    ]) {
      const text = readFileSync(join(SRC, f), "utf8");
      for (const k of ["getImageData", "readPixels", "devicePixelRatio"])
        expect(text.includes(k), `${f}: ${k}`).toBe(false);
    }
  });
});

describe("Prismell's briefing picture, painted", () => {
  const saved2 = { document: g.document, Path2D: g.Path2D };
  const widths: number[] = [];
  beforeAll(() => {
    g.document = {
      createElement: () => {
        const canvas: any = {
          toDataURL: () => "data:image/png;base64,AAAA",
        };
        let w = 0;
        Object.defineProperty(canvas, "width", {
          get: () => w,
          set: (v: number) => {
            w = v;
            widths.push(v);
          },
        });
        canvas.height = 0;
        const ctx = new Proxy(
          {},
          {
            get: (_t, key: string) =>
              key === "canvas"
                ? canvas
                : (..._a: unknown[]) =>
                    key.startsWith("create")
                      ? { addColorStop: () => undefined }
                      : undefined,
            set: () => true,
          },
        );
        canvas.getContext = () => ctx;
        return canvas;
      },
    };
    g.Path2D = class {
      constructor() {
        return new Proxy(this, { get: () => () => undefined });
      }
    };
  });
  afterAll(() => {
    g.document = saved2.document;
    g.Path2D = saved2.Path2D;
  });

  it("paints only the pieces its pose shows, never the battle atlas", async () => {
    const m = await import("../../apps/client/src/boss-prismell");
    m.resetPrismellGuide();
    widths.length = 0;
    const art = m.prismellGuideImage(true);
    expect(art.url).toMatch(/^data:image\/png/);
    // no atlas page (2048 wide), and only a couple of dozen small canvases
    expect(Math.max(...widths)).toBeLessThan(400);
    expect(widths.filter((w) => w > 1).length).toBeLessThan(40);
    // cached per look
    widths.length = 0;
    m.prismellGuideImage(true);
    expect(widths).toHaveLength(0);
    m.resetPrismellGuide();
  });
});

describe("Prismell's light never hides its shell or face", () => {
  it("keeps the light over the shell soft during the glare, the charge and the open heart", async () => {
    // the summed additive light covering the shell's middle (the rays sit outside it)
    const onShell = (o: Partial<PrismellCue>, f = 1, ph = 3) => {
      const pl = place(o, f, ph);
      return pl.glows
        .filter((g) => g.piece === "glow")
        .filter(
          (g) =>
            Math.hypot(g.x - pl.shell.x, g.y - pl.shell.y) <
            32 * Math.abs(g.sx),
        )
        .reduce((s, g) => s + g.alpha, 0);
    };
    for (const f of [0, 1, 2, 6])
      for (const o of [
        { windKind: "glare", windup: 1 },
        { castKind: "glare", castAge: 0.3 },
        { windKind: "prism-lance", windup: 1 },
        { windKind: "refraction", windup: 1 },
        { exposed: true },
        { stagger: true, exposed: true },
        { roarAge: 0.6 },
      ] as Partial<PrismellCue>[])
        expect(onShell(o, f), JSON.stringify(o)).toBeLessThanOrEqual(0.45);
    // the glare's rays start outside the shell
    const pl = place({ windKind: "glare", windup: 1 });
    for (const r of pl.glows.filter((g) => g.piece === "ray"))
      expect(Math.hypot(r.x - pl.shell.x, r.y - pl.shell.y)).toBeGreaterThan(
        55,
      );
  });

  it("starts the lance beam past the head, in every facing", async () => {
    const { prismellBeamStart } =
      await import("../../apps/client/src/prismell-attack-fx");
    const segToHead = (
      a: { x: number; y: number },
      b: { x: number; y: number },
      h: { x: number; y: number },
    ) => {
      const dx = b.x - a.x,
        dy = b.y - a.y,
        t = Math.max(
          0,
          Math.min(
            1,
            ((h.x - a.x) * dx + (h.y - a.y) * dy) / (dx * dx + dy * dy),
          ),
        );
      return Math.hypot(a.x + dx * t - h.x, a.y + dy * t - h.y);
    };
    let crossed = 0;
    for (let f = 0; f < 8; f++)
      for (const spread of [-0.35, 0, 0.35]) {
        // the boss faces its target: screen angle = 90° − facing·45°
        const angle = Math.PI / 2 - (f * Math.PI) / 4 + spread;
        const pl = place({ windKind: "prism-lance", windup: 0.9 }, f);
        const to = { x: Math.cos(angle) * 700, y: Math.sin(angle) * 700 };
        if (segToHead(pl.heart, to, pl.head) < pl.headR) crossed++;
        const start = prismellBeamStart(pl.heart, to, pl.head, pl.headR);
        expect(
          segToHead(start, to, pl.head),
          `facing ${f}`,
        ).toBeGreaterThanOrEqual(pl.headR - 0.01);
      }
    // the check means something: from the heart, many beams would cross the face
    expect(crossed).toBeGreaterThan(4);
  });
});
