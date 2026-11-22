/**
 * Is a fighter's art still there? A check for fighters drawn as nothing.
 *
 * A player on an iPhone Home Screen app (LomDom, 22 Nov 2026) saw their own
 * fighter vanish mid-raid: its nameplate, ground ring and shadow were drawn,
 * the body was not. The server's log showed the page going to the background
 * and the battle reconnecting mid-fight, again and again. Every rig layer is
 * a texture whose source is a canvas painted once (fighter-prepaint.ts, or
 * the loader's rasterized SVG), and the battle checks a fighter's art only
 * once (FighterLoading.hasArt). Safari may let a canvas's pixels go while
 * the page is hidden; a texture uploaded again from it (a lost and restored
 * WebGL context, a new renderer) is then blank, and nothing noticed.
 *
 * This looks at what a rig actually draws: every image in its container,
 * and a tiny copy of each texture's source. A rig is blank when every one
 * of its textures is (one bare layer can be meant: a sparkle, a mask).
 * The battle runs it after the moments that can lose pixels (the page
 * shown again, a resumed connection, a new renderer, a restored context),
 * never every frame: reading a canvas back costs.
 */

/** What a texture draws from (Phaser's TextureSource.image). */
export type ArtSource = {
  width?: number;
  height?: number;
  naturalWidth?: number;
  complete?: boolean;
};

/** Samples sources at this size: enough to find any painted pixel. */
const PROBE = 16;
let probeCanvas: HTMLCanvasElement | undefined;
let probeContext: CanvasRenderingContext2D | null | undefined;
function probe() {
  if (probeContext !== undefined) return probeContext;
  probeCanvas = document.createElement("canvas");
  probeCanvas.width = probeCanvas.height = PROBE;
  probeContext = probeCanvas.getContext("2d", { willReadFrequently: true });
  return probeContext;
}

/**
 * True when the source has nothing to draw: no size, an image that never
 * loaded, or every pixel of a small copy transparent. An unreadable source
 * (another origin) counts as fine: it can't be told, and repairing what
 * isn't broken would loop.
 */
export function sourceLooksBlank(
  source: ArtSource | undefined | null,
  read: (source: ArtSource) => Uint8ClampedArray | null = readPixels,
): boolean {
  if (!source) return true;
  if (
    source instanceof Object &&
    "complete" in source &&
    "naturalWidth" in source &&
    (!source.complete || !source.naturalWidth)
  )
    return true;
  if (!source.width || !source.height) return true;
  let pixels: Uint8ClampedArray | null;
  try {
    pixels = read(source);
  } catch {
    return false;
  }
  if (!pixels) return false;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) return false;
  return true;
}
function readPixels(source: ArtSource) {
  const g = probe();
  if (!g) return null;
  g.clearRect(0, 0, PROBE, PROBE);
  g.drawImage(source as CanvasImageSource, 0, 0, PROBE, PROBE);
  return g.getImageData(0, 0, PROBE, PROBE).data;
}

/** A texture as the check needs it (Phaser's Texture, narrowed). */
export interface ArtTexture {
  key: string;
  source: readonly { image?: unknown }[];
}
/** Anything in a rig's container that may carry a texture. */
export interface ArtNode {
  texture?: ArtTexture;
  list?: readonly ArtNode[];
}

/** Every texture a rig's container draws, once each, by key. */
export function rigTextures(root: ArtNode) {
  const found = new Map<string, ArtTexture>();
  const walk = (node: ArtNode) => {
    const t = node.texture;
    if (t?.key && !found.has(t.key)) found.set(t.key, t);
    for (const child of node.list ?? []) walk(child);
  };
  walk(root);
  return found;
}

export interface RigArtHealth {
  /** At least half of the textures the rig draws are blank (or missing). */
  blank: boolean;
  /** The blank ones' keys: what a repair removes and loads again (never a
   * shared texture that is fine). */
  keys: string[];
  /** How many textures the rig draws. */
  total: number;
}
/** The rig draws (next to) nothing: half or more of its textures are blank. */
export function rigArtHealth(
  root: ArtNode,
  read?: (source: ArtSource) => Uint8ClampedArray | null,
): RigArtHealth {
  const textures = rigTextures(root);
  const keys: string[] = [];
  let blanks = 0,
    fine = 0;
  for (const t of textures.values()) {
    if (
      t.key === "__MISSING" ||
      sourceLooksBlank(t.source[0]?.image as ArtSource | undefined, read)
    ) {
      blanks++;
      if (t.key !== "__MISSING" && t.key !== "__DEFAULT") keys.push(t.key);
    } else fine++;
    // More than half are fine: healthy, whatever the rest are. Reading a
    // canvas back costs, so a healthy rig stops here.
    if (fine * 2 > textures.size)
      return { blank: false, keys: [], total: textures.size };
  }
  return {
    blank: textures.size > 0 && blanks * 2 >= textures.size,
    keys,
    total: textures.size,
  };
}
