import type Phaser from "phaser";
import { artWidths, type RigAsset } from "./assets";

/**
 * Sharper rig textures for a scene that draws one fighter large (the menu
 * previews, shop-preview.ts): the SVG parts are rasterized `scale` times
 * bigger. Rig images stay their size in art units and tell the texture its
 * resolution, which Phaser's canvas renderer divides a frame by when it
 * draws (rig.ts), so the fighter keeps its size and gains detail. Battles
 * keep 1. Canvas renderer only: the WebGL renderer ignores `resolution`.
 */
const textureScale = new WeakMap<Phaser.Scene, number>();
export function setRigTextureScale(scene: Phaser.Scene, scale: number) {
  textureScale.set(scene, Math.max(1, scale));
}
/** Queue the `assets` not loaded yet, at the scene's texture scale. */
export function loadRigTextures(scene: Phaser.Scene, assets: RigAsset[]) {
  const scale = textureScale.get(scene) ?? 1;
  for (const a of assets)
    if (!scene.textures.exists(a.key))
      scene.load.svg(a.key, a.url, {
        width: Math.round(a.width * scale),
        height: Math.round(a.height * scale),
      });
}
/**
 * How much bigger than its art a rig texture was rasterized: 1 for a
 * battle's textures (their art's width give or take a rounded pixel) and
 * for anything that isn't a rig part.
 */
export function textureResolution(key: string, sourceWidth: number) {
  const art = artWidths.get(key);
  const r = art ? sourceWidth / art : 1;
  return r < 1.1 ? 1 : r;
}
