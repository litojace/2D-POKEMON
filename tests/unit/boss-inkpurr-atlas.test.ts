import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Inkpurr's atlas is drawn once and never read back: every piece is painted
 * straight into its trimmed size, from a table measured offline
 * (scripts/inkpurr-trims.mjs). These checks build the whole atlas on a fake
 * canvas that throws on any pixel read-back.
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

describe("Inkpurr's atlas", () => {
  it("is built without reading a single pixel back", async () => {
    const { buildInkAtlas } =
      await import("../../apps/client/src/boss-inkpurr-paint");
    const atlas = buildInkAtlas() as any;
    expect(Object.keys(atlas.frames).length).toBeGreaterThan(150);
    expect(atlas.bytes).toBeLessThanOrEqual(8 * 1024 * 1024);
  });

  it("has a measured trim for every piece, inside the piece's canvas", async () => {
    const { inkPieceSpecs, pieceCanvasSize } =
      await import("../../apps/client/src/boss-inkpurr-paint");
    const { INK_TRIMS } =
      await import("../../apps/client/src/boss-inkpurr-trims");
    for (const p of inkPieceSpecs() as any[]) {
      const t = INK_TRIMS[p.name];
      expect(t, p.name).toBeTruthy();
      const { w, h } = pieceCanvasSize(p.box, p.q);
      expect(t[0] + t[2], p.name).toBeLessThanOrEqual(w);
      expect(t[1] + t[3], p.name).toBeLessThanOrEqual(h);
    }
  });

  it("would catch a read-back anywhere in the painter or the rig", () => {
    for (const f of [
      "boss-inkpurr-paint.ts",
      "boss-inkpurr.ts",
      "boss-inkpurr-rig.ts",
    ]) {
      const text = readFileSync(join(SRC, f), "utf8");
      for (const k of ["getImageData", "readPixels"])
        expect(text.includes(k), `${f}: ${k}`).toBe(false);
    }
    const ctx: any = fakeContext({});
    expect(() => ctx.getImageData(0, 0, 1, 1)).toThrow(/read-back/);
  });
});
