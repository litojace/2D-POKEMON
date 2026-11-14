import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Snoozaku's atlas is drawn once, when the raid's scene starts, and never
 * read back: every piece's size comes from its geometry, so the page is
 * packed first and each piece painted straight into place. These checks
 * build the whole atlas on a fake canvas that throws on any pixel read-back.
 */
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

describe("Snoozaku's atlas", () => {
  it("is built without reading a single pixel back, within 8 MB", async () => {
    const { buildAtlas } =
      await import("../../apps/client/src/boss-snoozaku-art");
    const atlas = buildAtlas(1) as any;
    expect(Object.keys(atlas.pieces).length).toBeGreaterThan(90);
    expect(atlas.stats.bytes).toBeLessThanOrEqual(8 * 1024 * 1024);
    // one page, the game's fixed width
    expect(atlas.pages).toHaveLength(1);
    expect(atlas.pages[0].width).toBe(2048);
  });

  it("has a piece for every image the rig can place", async () => {
    const { pieceSpecs, EXPRS, MOUTHS, TRUNKS } =
      await import("../../apps/client/src/boss-snoozaku-art");
    const names = new Set((pieceSpecs() as any[]).map((p) => p.name));
    for (let v = 0; v < 5; v++)
      for (const n of [
        `body_${v}`,
        `legs4_${v}`,
        `head_${v}`,
        `cap_${v}`,
        `paws_${v}`,
        `leg_${v}_0`,
        `leg_${v}_1`,
        `over_${v}_2`,
        `over_${v}_3`,
      ])
        expect(names.has(n), n).toBe(true);
    for (let v = 0; v < 4; v++)
      for (const t of TRUNKS) expect(names.has(`trunk_${v}_${t}`)).toBe(true);
    for (let v = 0; v < 3; v++) {
      for (const e of EXPRS) expect(names.has(`eyes_${v}_${e}`)).toBe(true);
      for (const m of MOUTHS) expect(names.has(`mouth_${v}_${m}`)).toBe(true);
    }
    for (const n of [
      "heart",
      "wisp_0",
      "wisp_1",
      "bubble",
      "note",
      "zz",
      "star_1",
      "glow_gold",
      "glow_lilac",
      "glow_rose",
    ])
      expect(names.has(n), n).toBe(true);
  });

  it("keeps a fixed density, never the screen's pixel ratio", () => {
    for (const f of [
      "boss-snoozaku-art.ts",
      "boss-snoozaku.ts",
      "boss-snoozaku-rig.ts",
    ]) {
      const text = readFileSync(join(SRC, f), "utf8");
      expect(text.includes("devicePixelRatio"), f).toBe(false);
    }
  });

  it("would catch a read-back anywhere in the painter, the rig or its effects", () => {
    for (const f of [
      "boss-snoozaku-art.ts",
      "boss-snoozaku-rig.ts",
      "snoozaku-attack-fx.ts",
    ]) {
      const text = readFileSync(join(SRC, f), "utf8");
      for (const k of ["getImageData", "readPixels", "toDataURL"])
        expect(text.includes(k), `${f}: ${k}`).toBe(false);
    }
    const ctx: any = fakeContext({});
    expect(() => ctx.getImageData(0, 0, 1, 1)).toThrow(/read-back/);
  });

  it("draws its effects through the effects engine, never with its own scene objects", () => {
    const OWN =
      /\.add\.(graphics|image|sprite|text|circle|rectangle|ellipse|particles|container|line|polygon|arc|star|triangle|zone)\s*\(|new\s+Phaser\./;
    const lines = readFileSync(
      join(SRC, "snoozaku-attack-fx.ts"),
      "utf8",
    ).split("\n");
    expect(lines.filter((l) => OWN.test(l))).toEqual([]);
  });
});
