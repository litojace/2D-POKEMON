import type Phaser from "phaser";

export type Skin =
  | "cragbound"
  | "cragstone"
  | "candy-colours"
  | "galaxy-colours"
  | "retro-colours"
  | "festival-colours"
  | "garden-colours"
  | "winter-colours"
  // Tidewyrm's raid rewards.
  | "seafoam"
  | "pearlscale"
  // Gloomshade's raid rewards.
  | "dusk-colors"
  | "moonlit-skin"
  | "twilight-colors"
  | "starlit-skin"
  | "dawn-colors"
  | "prismatic-skin"
  | "ember-colors"
  | "cinderplume"
  | "static-colors"
  | "thundercell";
export const SKINS: Skin[] = [
  "cragbound",
  "cragstone",
  "candy-colours",
  "galaxy-colours",
  "retro-colours",
  "festival-colours",
  "garden-colours",
  "winter-colours",
  "seafoam",
  "pearlscale",
  "dusk-colors",
  "moonlit-skin",
  "twilight-colors",
  "starlit-skin",
  "dawn-colors",
  "prismatic-skin",
  "ember-colors",
  "cinderplume",
  "static-colors",
  "thundercell",
];
const hexRgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
/**
 * Shop "Colours": recolour by brightness through three tones (shadow, mid,
 * light), keeping a little of the original so each champion stays itself.
 */
export const TONES: Partial<Record<Skin, { tones: [number, number, number]; keep: number }>> = {
  "candy-colours": { tones: [0x9a5a9a, 0xff9ec8, 0xfff0f8], keep: 0.25 },
  "galaxy-colours": { tones: [0x0e0a2e, 0x4a3a9a, 0x9fd8ff], keep: 0.2 },
  "festival-colours": { tones: [0x5a0d12, 0xd8262a, 0xffd65b], keep: 0.2 },
  "garden-colours": { tones: [0x1f4a1a, 0x6fbf4a, 0xf0ffb0], keep: 0.25 },
  "winter-colours": { tones: [0x2a4a6e, 0x9fcfff, 0xffffff], keep: 0.3 },
  seafoam: { tones: [0x13606b, 0x4fd6c8, 0xe6fbff], keep: 0.25 },
  pearlscale: { tones: [0x1d4f6e, 0x7fd8e6, 0xfff3f8], keep: 0.3 },
  // Twilight violet shading up into lantern gold.
  "dusk-colors": { tones: [0x2b2245, 0x8a5fc8, 0xffd27a], keep: 0.25 },
  "twilight-colors": { tones: [0x352a63, 0xa89ad9, 0xf2cddd], keep: 0.3 },
  "static-colors": { tones: [0x28435f,0x81bcd6,0xffe9a1], keep:.22 },
  thundercell: { tones:[0x263451,0xa6c9e0,0xf2f7ff],keep:.18 },
  "ember-colors": { tones: [0x6a3541,0xd77c53,0xffd795], keep: .22 },
  "cinderplume": { tones: [0x242b3b,0x655064,0xecaf7a], keep: .18 },
  "dawn-colors": { tones: [0x6e3451,0xe9a279,0xfff0b9], keep: .22 },
  "prismatic-skin": { tones: [0x475b83,0xb5d9e3,0xfff9ee], keep: .15 },
  "starlit-skin": { tones: [0x242844, 0x74679f, 0xe6ddff], keep: 0.2 },
  "moonlit-skin": { tones: [0x2a3358, 0x9aa8d8, 0xf4f6ff], keep: 0.3 },
};
export function tonePixels(pixels: Uint8ClampedArray, skin: Skin) {
  const spec = TONES[skin];
  if (!spec) return;
  const [a, b, c] = spec.tones.map(hexRgb);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i],
      g = pixels[i + 1],
      bl = pixels[i + 2];
    const l = (0.299 * r + 0.587 * g + 0.114 * bl) / 255;
    const [lo, hi, k] = l < 0.5 ? [a, b, l / 0.5] : [b, c, (l - 0.5) / 0.5];
    for (let ch = 0; ch < 3; ch++) {
      const tone = lo[ch] + (hi[ch] - lo[ch]) * k;
      pixels[i + ch] = tone * (1 - spec.keep) + pixels[i + ch] * spec.keep;
    }
  }
}
/** Retro: a chunky 8-bit look (four levels per channel, a touch brighter). */
export function retroPixels(pixels: Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 4)
    for (let ch = 0; ch < 3; ch++)
      pixels[i + ch] = Math.min(255, Math.round((pixels[i + ch] / 255) * 3) * 85 + 10);
}

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
  if (/-eyes([-~]|$)/.test(key) || width < 8 || height < 8) return [];
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

const prefixes = Object.fromEntries(SKINS.map((s) => [s, `${s}:`])) as Record<Skin, string>;
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
  if (!skin || !prefixes[skin]) return original;
  // Faces stay as drawn (readable eyes); only Cragbound tints everything.
  if (skin !== "cragbound" && /-eyes([-~]|$)/.test(original)) return original;
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
    else if (skin === "cragstone") cragstonePixels(pixels.data);
    else if (skin === "retro-colours") retroPixels(pixels.data);
    else tonePixels(pixels.data, skin);
    context.putImageData(pixels, 0, 0);
    if (skin === "galaxy-colours" && !/-eyes([-~]|$)/.test(original)) {
      // A sprinkle of stars, only where the layer is opaque.
      context.globalCompositeOperation = "source-atop";
      const random = seeded(original);
      for (let n = 0; n < (canvas.width * canvas.height) / 900; n++) {
        context.fillStyle = random() < 0.7 ? "#ffffff" : "#9fd8ff";
        context.globalAlpha = 0.5 + random() * 0.5;
        const x = random() * canvas.width,
          y = random() * canvas.height,
          r = 0.6 + random() * 1.2;
        context.fillRect(x - r / 2, y - r / 2, r, r);
      }
      context.globalAlpha = 1;
    }
    if (skin === "thundercell" && !/-eyes([-~]|$)/.test(original)) {
      context.globalCompositeOperation="source-atop";
      const random=seeded(original+":thunder");
      context.strokeStyle="#80cfff";context.lineWidth=1.5;
      for(let n=0;n<canvas.width*canvas.height/3200;n++){
        const x=random()*canvas.width,y=random()*canvas.height;
        context.beginPath();context.moveTo(x,y);context.lineTo(x-3,y+5);context.lineTo(x+1,y+5);context.lineTo(x-2,y+11);context.stroke();
      }
      context.globalCompositeOperation="source-over";
    }
    if (skin === "cinderplume" && !/-eyes([-~]|$)/.test(original)) {
      context.globalCompositeOperation="source-atop";
      const random=seeded(original+":cinder");
      for(let n=0;n<canvas.width*canvas.height/2000;n++){
        const x=random()*canvas.width,y=random()*canvas.height,r=1+random()*1.4;
        context.fillStyle=random()<.5?"#ffb86b":"#e26a55";
        context.fillRect(x,y,r,r*2.5);
      }
      context.globalCompositeOperation="source-over";
    }
    if (skin === "prismatic-skin" && !/-eyes([-~]|$)/.test(original)) {
      context.globalCompositeOperation = "source-atop";
      const prism = context.createLinearGradient(0,0,canvas.width,canvas.height);
      ["#ff899e77","#ffd77866","#9aefb577","#80e1ff88","#a5adff88","#e5a0ff88"].forEach((color,i)=>prism.addColorStop(i/5,color));
      context.fillStyle=prism;
      context.fillRect(0,0,canvas.width,canvas.height);
      context.globalCompositeOperation="source-over";
    }
    if ((skin === "moonlit-skin" || skin === "starlit-skin") && !/-eyes([-~]|$)/.test(original)) {
      // A soft silver glow from the top, and a few drifting stars.
      context.globalCompositeOperation = "source-atop";
      const glow = context.createLinearGradient(0, 0, 0, canvas.height);
      glow.addColorStop(0, "rgba(244, 246, 255, .28)");
      glow.addColorStop(0.6, "rgba(244, 246, 255, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, canvas.width, canvas.height);
      const random = seeded(original + ":moon");
      for (let n = 0; n < (canvas.width * canvas.height) / 2200; n++) {
        const x = random() * canvas.width,
          y = random() * canvas.height,
          r = 1 + random() * 1.4;
        context.fillStyle = random() < 0.75 ? "rgba(255, 255, 255, .85)" : "rgba(255, 214, 91, .8)";
        context.fillRect(x - r, y - r / 4, r * 2, r / 2);
        context.fillRect(x - r / 4, y - r, r / 2, r * 2);
      }
      context.globalCompositeOperation = "source-over";
    }
    if (skin === "pearlscale" && !/-eyes([-~]|$)/.test(original)) {
      // Overlapping scale arcs with pearl freckles, only where the layer is opaque.
      context.globalCompositeOperation = "source-atop";
      const step = Math.max(8, Math.round(Math.min(canvas.width, canvas.height) / 9));
      context.lineWidth = Math.max(1, step / 9);
      for (let row = 0, y = step / 2; y < canvas.height + step; row++, y += step * 0.6)
        for (let x = (row % 2) * (step / 2); x < canvas.width + step; x += step) {
          context.strokeStyle = "rgba(255, 243, 248, .45)";
          context.beginPath();
          context.arc(x, y, step / 2, 0.15 * Math.PI, 0.85 * Math.PI);
          context.stroke();
        }
      const random = seeded(original + ":pearls");
      for (let n = 0; n < (canvas.width * canvas.height) / 1400; n++) {
        const x = random() * canvas.width,
          y = random() * canvas.height,
          r = 1.2 + random() * 1.6;
        context.fillStyle = "rgba(255, 255, 255, .9)";
        context.beginPath();
        context.arc(x, y, r, 0, Math.PI * 2);
        context.fill();
      }
    }
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
