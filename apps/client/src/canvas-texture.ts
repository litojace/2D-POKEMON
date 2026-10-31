import type Phaser from "phaser";

/**
 * Add a painted canvas as a texture without reading its pixels back.
 *
 * Phaser's addCanvas wraps the canvas in a CanvasTexture, whose constructor
 * (and refresh) calls getImageData over the whole canvas: a synchronous
 * read-back that stalls the frame. For a baked court floor (1600x900 times
 * the device scale) that is tens of megabytes, and the first hit of a match
 * paid it for the dust sprites. Nothing here reads texture pixels, so the
 * canvas is added as a plain image source: WebGL uploads it directly.
 */
export function addCanvasTexture(
  textures: Phaser.Textures.TextureManager,
  key: string,
  canvas: HTMLCanvasElement,
) {
  return textures.addImage(key, canvas as unknown as HTMLImageElement);
}
/** The canvas behind a texture was repainted: upload it again (no read-back). */
export function updateCanvasTexture(
  textures: Phaser.Textures.TextureManager,
  key: string,
) {
  textures.get(key)?.source[0]?.update();
}
