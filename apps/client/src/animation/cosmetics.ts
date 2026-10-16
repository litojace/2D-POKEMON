import type Phaser from "phaser";

export type Skin = "cragbound" | "cragstone";

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

/**
 * Cragstone: the fighter's colours weathered towards warm grey stone (like
 * the menu's grayscale(.55) sepia(.25) brightness(.92)), keeping its shading.
 */
export function cragstonePixels(pixels: Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const mix = (c: number, warm: number) =>
      Math.min(255, (c * 0.45 + gray * 0.55 + warm) * 0.92);
    pixels[i] = mix(r, 10);
    pixels[i + 1] = mix(g, 4);
    pixels[i + 2] = mix(b, -6);
  }
}

/** Small deterministic random from a texture key, so cracks never flicker. */
export function seeded(key: string) {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
    return h / 4294967296;
  };
}

/**
 * Jagged crack lines across a texture, as point lists in its pixels. Only
 * body parts crack; the eyes stay clear so faces remain readable.
 */
export function crackLines(key: string, width: number, height: number) {
  if (/-eyes(-|$)/.test(key) || width < 8 || height < 8) return [];
  const random = seeded(key);
  const count = Math.max(1, Math.round((width * height) / 4200));
  const lines: { x: number; y: number }[][] = [];
  for (let n = 0; n < Math.min(count, 3); n++) {
    let x = width * (0.25 + random() * 0.5),
      y = height * (0.2 + random() * 0.6);
    let angle = random() * Math.PI * 2;
    const points = [{ x, y }];
    const steps = 3 + Math.floor(random() * 3);
    for (let s = 0; s < steps; s++) {
      angle += (random() - 0.5) * 1.6;
      const length = Math.min(width, height) * (0.08 + random() * 0.1);
      x += Math.cos(angle) * length;
      y += Math.sin(angle) * length;
      points.push({ x, y });
    }
    lines.push(points);
  }
  return lines;
}

const prefixes: Record<Skin, string> = {
  cragbound: "cragbound:",
  cragstone: "cragstone:",
};
const originalOf = (key: string) => {
  for (const prefix of Object.values(prefixes))
    if (key.startsWith(prefix)) return key.slice(prefix.length);
  return key;
};
/** Cache restyled layers once; equipping/removing never modifies original art. */
export function cosmeticLayer(
  scene: Phaser.Scene,
  key: string,
  skin: Skin | null | undefined,
) {
  const original = originalOf(key);
  if (!skin) return original;
  // Faces stay as drawn under Cragstone; Cragbound tints everything.
  if (skin === "cragstone" && /-eyes(-|$)/.test(original)) return original;
  const styled = prefixes[skin] + original;
  if (!scene.textures.exists(styled)) {
    const source = scene.textures
      .get(original)
      .getSourceImage() as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    if (skin === "cragbound") cragboundPixels(pixels.data);
    else cragstonePixels(pixels.data);
    context.putImageData(pixels, 0, 0);
    if (skin === "cragstone") {
      // Glowing amber cracks, painted only where the layer is opaque.
      context.globalCompositeOperation = "source-atop";
      context.lineCap = "round";
      context.lineJoin = "round";
      for (const line of crackLines(original, canvas.width, canvas.height))
        for (const [width, color, blur] of [
          [4, "rgba(255,170,60,.35)", 6],
          [1.6, "#ffcf7a", 0],
        ] as const) {
          context.strokeStyle = color;
          context.lineWidth = width;
          context.shadowColor = "#ff9a2e";
          context.shadowBlur = blur;
          context.beginPath();
          line.forEach((p, i) =>
            i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y),
          );
          context.stroke();
        }
    }
    scene.textures.addCanvas(styled, canvas);
  }
  return styled;
}
