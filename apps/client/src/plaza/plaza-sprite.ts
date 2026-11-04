/**
 * Fighters in the Plaza, painted once into a small bitmap instead of handing
 * the canvas the whole SVG every frame.
 *
 * Why: a fighter's SVG lays its material brush marks and its skin's pattern
 * as canvas-sized wallpapers, each masked to one part's shape. Desktop Safari
 * drawing those SVGs into the Plaza's canvas got the masks wrong and painted
 * the wallpapers as dark rectangles over every part (head, body, arms…).
 * Chromium and WebKitGTK draw the same SVGs correctly, so the art is valid;
 * the renderer is not, and it cannot be tested here. So the Plaza checks for
 * itself: it paints the full drawing and the flat one (no masked overlays)
 * and compares them. The overlays only ever add marks inside the shape the
 * flat drawing already covers; paint outside it means the masks failed, and
 * that fighter (and every later one: it is the renderer) uses the flat art.
 *
 * Painting once is also cheaper: dozens of masks per fighter were redrawn
 * for every person on screen, sixty times a second.
 */

/** The fighter viewBox (CREATURE_VIEWBOX, 200×202), one pixel per unit:
 * the Plaza shows a fighter at most 84 units wide at twice the pixels. */
export const SPRITE_W = 200;
export const SPRITE_H = 202;

/** Alpha above this counts as painted, at or below FLAT_CLEAR as empty. */
const PAINTED = 40;
const FLAT_CLEAR = 4;

/**
 * Pixels the full drawing paints where the flat drawing is clear (RGBA
 * buffers of the same size). A correct renderer leaves only stray
 * anti-aliasing here; failed masks leave whole rectangles.
 */
export function spilledPixels(
  full: ArrayLike<number>,
  flat: ArrayLike<number>,
): number {
  let spilled = 0;
  for (let i = 3; i < full.length; i += 4)
    if (full[i] > PAINTED && flat[i] <= FLAT_CLEAR) spilled++;
  return spilled;
}
/** Whether the spill is more than anti-aliasing: over 2% of the flat
 * drawing's own painted area (and over a few dozen pixels). */
export function masksFailed(
  full: ArrayLike<number>,
  flat: ArrayLike<number>,
): boolean {
  let covered = 0;
  for (let i = 3; i < flat.length; i += 4) if (flat[i] > FLAT_CLEAR) covered++;
  return spilledPixels(full, flat) > Math.max(40, covered * 0.02);
}

/** Set once a fighter showed this browser can't draw the masks. */
let flatOnly = false;

function load(url: string): Promise<HTMLImageElement> {
  const im = new Image();
  im.decoding = "async";
  return new Promise((resolve, reject) => {
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("fighter art failed to load"));
    im.src = url;
  });
}
/**
 * willReadFrequently keeps these small canvases in CPU memory: the check
 * reads their pixels back, and reading a GPU canvas stalls the frame (it
 * cost the Plaza seconds of frames while the townsfolk's sprites baked).
 * Drawing them into the Plaza's canvas is a single upload each.
 */
function paint(im: CanvasImageSource): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SPRITE_W;
  c.height = SPRITE_H;
  c.getContext("2d", { willReadFrequently: true })!.drawImage(
    im,
    0,
    0,
    SPRITE_W,
    SPRITE_H,
  );
  return c;
}
const pixels = (c: HTMLCanvasElement) =>
  c
    .getContext("2d", { willReadFrequently: true })!
    .getImageData(0, 0, SPRITE_W, SPRITE_H).data;

/**
 * A fighter's sprite for the canvas: the full drawing when this browser
 * paints it correctly, the flat one when it doesn't. `full` is the image
 * the Plaza already loads (its URL also shows in cards and the feed).
 */
export async function bakeSprite(
  full: HTMLImageElement,
  flatUrl: string,
): Promise<CanvasImageSource> {
  if (!full.complete || !full.naturalWidth)
    await new Promise((resolve, reject) => {
      full.addEventListener("load", resolve, { once: true });
      full.addEventListener("error", reject, { once: true });
    });
  if (flatOnly) return paint(await load(flatUrl));
  const fullSprite = paint(full);
  let flat: HTMLImageElement;
  try {
    flat = await load(flatUrl);
  } catch {
    return fullSprite;
  }
  const flatSprite = paint(flat);
  try {
    if (!masksFailed(pixels(fullSprite), pixels(flatSprite))) return fullSprite;
  } catch {
    // An unreadable (tainted) canvas: keep the full drawing, as before.
    return fullSprite;
  }
  flatOnly = true;
  return flatSprite;
}
