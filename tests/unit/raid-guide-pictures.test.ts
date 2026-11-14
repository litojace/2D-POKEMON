import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The briefing's boss pictures paint only the pieces their pose uses, never
 * a whole battle atlas, and the briefing itself never paints on its render:
 * it lays the diagram out from the crop and fills the picture in when idle.
 * Counted on a fake canvas (no timing involved).
 */
const calls = vi.hoisted(() => ({ lumiAtlas: 0, inkAtlas: 0 }));
vi.mock("../../apps/client/src/boss-lumiwick-paint", async (load) => {
  const m =
    await load<typeof import("../../apps/client/src/boss-lumiwick-paint")>();
  return {
    ...m,
    paintLumiwickAtlas: (...a: Parameters<typeof m.paintLumiwickAtlas>) => {
      calls.lumiAtlas++;
      return m.paintLumiwickAtlas(...a);
    },
  };
});
vi.mock("../../apps/client/src/boss-inkpurr-paint", async (load) => {
  const m = await load<Record<string, (...a: unknown[]) => unknown>>();
  return {
    ...m,
    buildInkAtlas: (...a: unknown[]) => {
      calls.inkAtlas++;
      return m.buildInkAtlas(...a);
    },
  };
});

function fakeContext(canvas: object) {
  const gradient = { addColorStop: () => undefined };
  return new Proxy(
    {},
    {
      get: (_t, key: string) => {
        if (key === "getImageData") throw new Error("read-back: getImageData");
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
let created = 0;
beforeAll(() => {
  g.document = {
    createElement: () => {
      created++;
      const canvas: any = { width: 0, height: 0 };
      canvas.toDataURL = () => "data:image/png;base64,AAAA";
      const ctx = fakeContext(canvas);
      canvas.getContext = () => ctx;
      return canvas;
    },
    querySelectorAll: () => [],
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

describe("the briefing's boss pictures", () => {
  it("paint Lumiwick from its pose's own pieces, never the whole atlas", async () => {
    const { lumiwickGuideImage, lumiwickGuideStats } =
      await import("../../apps/client/src/boss-lumiwick-guide");
    const { lumiwickPieces } =
      await import("../../apps/client/src/boss-lumiwick-paint");
    const urls = [false, true].map(
      (exposed) => lumiwickGuideImage(exposed).url,
    );
    expect(calls.lumiAtlas).toBe(0);
    for (const url of urls) expect(url).toMatch(/^data:image\/png/);
    expect(lumiwickGuideStats.pieces).toBeGreaterThan(5);
    expect(lumiwickGuideStats.pieces).toBeLessThan(lumiwickPieces().length / 4);
    // each look is kept: asking again paints nothing
    const before = lumiwickGuideStats.pieces;
    lumiwickGuideImage(false);
    lumiwickGuideImage(true);
    expect(lumiwickGuideStats.pieces).toBe(before);
  });

  it("paint Inkpurr from its pose's own pieces, never the whole atlas", async () => {
    const { inkGuideImage, inkGuideStats } =
      await import("../../apps/client/src/boss-inkpurr");
    const { inkPieceSpecs } =
      await import("../../apps/client/src/boss-inkpurr-paint");
    const urls = [false, true].map((exposed) => inkGuideImage(exposed).url);
    expect(calls.inkAtlas).toBe(0);
    for (const url of urls) expect(url).toMatch(/^data:image\/png/);
    expect(inkGuideStats.pieces).toBeGreaterThan(5);
    expect(inkGuideStats.pieces).toBeLessThan(
      (inkPieceSpecs() as unknown[]).length / 4,
    );
    const before = inkGuideStats.pieces;
    inkGuideImage(false);
    inkGuideImage(true);
    expect(inkGuideStats.pieces).toBe(before);
  });

  it("paint Tidelotl's pieces once each, without reading pixels back", async () => {
    const { tidelotlGuideImage, tidelotlGuideStats, LOTL_GUIDE_CROPS } =
      await import("../../apps/client/src/boss-tidelotl");
    const art = tidelotlGuideImage(false);
    expect(art.url).toMatch(/^data:image\/png/);
    expect(art.crop).toEqual(LOTL_GUIDE_CROPS.calm);
    const before = tidelotlGuideStats.pieces;
    expect(before).toBeGreaterThan(3);
    tidelotlGuideImage(false);
    expect(tidelotlGuideStats.pieces).toBe(before);
  });

  it("lay the diagram out at once and paint the picture later", async () => {
    vi.useFakeTimers();
    try {
      const { raidGuideSprite } =
        await import("../../apps/client/src/raid-guide-sprites");
      const { somnaraGuideImage, resetSomnaraGuide } =
        await import("../../apps/client/src/boss-vector-somnara");
      resetSomnaraGuide();
      const madeBefore = created;
      const markup = raidGuideSprite("somnara", true);
      // no canvas made on the render, no picture yet, but the frame is there
      expect(created).toBe(madeBefore);
      expect(markup).toContain('data-guide-sprite="somnara"');
      expect(markup).toContain('data-guide-look="exposed"');
      expect(markup).not.toContain("href=");
      expect(markup).toMatch(/viewBox="[\d.]+ [\d.]+ [\d.]+ [\d.]+"/);
      expect(somnaraGuideImage(true, false).url).toBe("");
      await vi.runAllTimersAsync();
      expect(somnaraGuideImage(true, false).url).toMatch(/^data:image\/png/);
      // once painted, the next render carries it
      expect(raidGuideSprite("somnara", true)).toContain(
        'href="data:image/png',
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
