import { describe, expect, it } from "vitest";
import { artWidths, rigAssets } from "../../apps/client/src/animation/assets";
import {
  loadRigTextures,
  setRigTextureScale,
  textureResolution,
} from "../../apps/client/src/animation/rig-textures";

// The menu previews rasterize a fighter's parts bigger than their art so a
// large, sharp canvas shows detail (shop-preview.ts); battles keep 1×.
const scene = (have: string[] = []) => {
  const loaded: { key: string; width: number; height: number }[] = [];
  return {
    loaded,
    textures: { exists: (key: string) => have.includes(key) },
    load: {
      svg: (
        key: string,
        _url: string,
        size: { width: number; height: number },
      ) => loaded.push({ key, ...size }),
    },
  } as never as Phaser.Scene & { loaded: typeof loaded };
};

describe("sharper rig textures for the previews", () => {
  const assets = rigAssets("voltkit", null, ["down"]);
  const head = assets.find((a) => a.key.endsWith("down-head"))!;

  it("loads at art size by default, and at the scene's scale when set", () => {
    const battle = scene();
    loadRigTextures(battle, [head]);
    expect(battle.loaded[0]).toMatchObject({
      width: Math.round(head.width),
      height: Math.round(head.height),
    });
    const preview = scene();
    setRigTextureScale(preview, 3);
    loadRigTextures(preview, [head]);
    expect(preview.loaded[0]).toMatchObject({
      width: Math.round(head.width * 3),
      height: Math.round(head.height * 3),
    });
  });

  it("skips textures already loaded, and never scales below 1", () => {
    const s = scene([head.key]);
    setRigTextureScale(s, 0.5);
    loadRigTextures(s, assets);
    expect(s.loaded.map((l) => l.key)).not.toContain(head.key);
    const body = assets.find((a) => a.key.endsWith("down-body"))!;
    expect(s.loaded.find((l) => l.key === body.key)!.width).toBe(
      Math.round(body.width),
    );
  });

  it("reads a texture's resolution from its raster and its art's width", () => {
    expect(artWidths.get(head.key)).toBe(head.width);
    expect(textureResolution(head.key, Math.round(head.width * 3))).toBeCloseTo(
      3,
      1,
    );
    // A battle texture: its art's width, give or take a rounded pixel.
    expect(textureResolution(head.key, Math.round(head.width) - 1)).toBe(1);
    expect(textureResolution(head.key, Math.round(head.width))).toBe(1);
    // Anything that isn't a rig part.
    expect(textureResolution("not-a-rig-part", 500)).toBe(1);
  });
});
