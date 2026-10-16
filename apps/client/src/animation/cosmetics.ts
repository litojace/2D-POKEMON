import type Phaser from "phaser";

/** Match the menu's sepia(1) saturate(.8) brightness(.96), including Canvas. */
export function cragboundPixels(pixels: Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2];
    const sr = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
    const sg = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
    const sb = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
    const gray = 0.213 * sr + 0.715 * sg + 0.072 * sb;
    pixels[i] = (0.8 * sr + 0.2 * gray) * 0.96;
    pixels[i + 1] = (0.8 * sg + 0.2 * gray) * 0.96;
    pixels[i + 2] = (0.8 * sb + 0.2 * gray) * 0.96;
  }
}

const prefix = "cragbound:";
/** Cache recolored layers once; equipping/removing never modifies original art. */
export function cosmeticLayer(
  scene: Phaser.Scene,
  key: string,
  equipped: boolean,
) {
  const original = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  if (!equipped) return original;
  const colored = prefix + original;
  if (!scene.textures.exists(colored)) {
    const source = scene.textures
      .get(original)
      .getSourceImage() as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    cragboundPixels(pixels.data);
    context.putImageData(pixels, 0, 0);
    scene.textures.addCanvas(colored, canvas);
  }
  return colored;
}
