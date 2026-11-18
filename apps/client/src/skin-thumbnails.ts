import type { CharacterId } from "@arena/shared";
import { fighterArt } from "./fighter-art";
import { canvasPng, idle, sizedSvg } from "./svg-raster";

/**
 * Skin thumbnails (the Shop and Wardrobe catalogue, Roster → Skins, reward
 * cards) as pictures painted once.
 *
 * A thumbnail starts as an `<img>` of its SVG, so a screen renders at once.
 * But the SVGs carry masks and filters, and the browser records and rasters
 * every one of them again each time a screen with them is built: on a 4×
 * slowed CPU, Roster → Skins spent 67 ms painting where the Skills tab spent
 * 17 ms (Nov 2026). So once a thumbnail has shown, it is
 * drawn into a bitmap in a quiet moment (svg-raster.ts), and from then on
 * the screen shows that bitmap; a screen built again (a tab switch, a patch)
 * takes it straight away.
 *
 * Looking the same:
 * - A bitmap keeps the frame's exact shape (212:216 = 53:54 px "units"), so
 *   the picture lays out exactly as the SVG did (in some boxes the picture's
 *   own shape sets the row's height), and `object-fit: contain`
 *   (`.skin-thumb`) puts it where the SVG's own fitting put the drawing.
 * - It is drawn 1.5× the device pixels it shows at. The browser doesn't snap
 *   a picture to device pixels, so a bitmap shown at about its own size is
 *   resampled, a little softer than the SVG; 1.5× measured as sharp as the
 *   SVG at 2× and 3× screens (within 1%; 1× was 2–4% softer, and 2× softer
 *   again, probably as the browser then shrinks it through a half-size copy).
 * - Never smaller than it shows: each place a thumbnail appears (its
 *   "slot", e.g. the Roster's look cards) remembers the largest size it was
 *   seen at, and a bitmap is used there only if it is at least that big.
 *   A thumbnail that grows past its bitmap (a resized window) goes back to
 *   its SVG until a bigger bitmap is ready.
 * - Anything that fails stays an SVG.
 */

/**
 * The frame a skin's thumbnail is drawn in: every skin and Awakening stage
 * whole, with a little room. Measured: all their ink lies within x -1…200,
 * y -19…186; the fighter's usual frame (0 -12 200 202) cut the crests and
 * crowns of 27 of them.
 */
const THUMB_FRAME = "-6 -26 212 216";
/** 212:216 in lowest terms: a bitmap is a whole number of these units. */
const UNIT_W = 53,
  UNIT_H = 54;
/** Device pixels drawn per device pixel shown (see above). */
const OVERSAMPLE = 1.5;
/** At most 636×648 px (1.6 MB once decoded); a bigger picture stays SVG. */
const MAX_UNITS = 12;
/**
 * Bitmaps kept, least recently used dropped first: a long stretch of the
 * catalogue (270 skins in all). About 65 KB of PNG each on a 3× phone.
 */
const MAX_BITMAPS = 160;

const svgUrls = new Map<string, string>();
const sources = new Map<string, () => string>();
interface Bitmap {
  url: string;
  units: number;
  /** Holds the decoded picture, so showing it again needs no decoding. */
  image: HTMLImageElement;
}
/** `${key}@${units}` → bitmap, least recently used first. */
const bitmaps = new Map<string, Bitmap>();
const bitmapUnits = new Map<string, number>();
/** Slot → units a bitmap needs there (the largest it was seen at). */
const slotUnits = new Map<string, number>();
const failed = new Set<string>();

/** Where a thumbnail sits, from its scope: "roster-look-voltkit-midnight" → "roster-look". */
export const thumbSlot = (scope: string, id: string) =>
  scope.endsWith(`-${id}`) ? scope.slice(0, -id.length - 1) : scope;

function svgUrl(key: string) {
  let url = svgUrls.get(key);
  if (!url) {
    url = `data:image/svg+xml,${encodeURIComponent(sources.get(key)!())}`;
    if (svgUrls.size >= 64) svgUrls.delete(svgUrls.keys().next().value!);
    svgUrls.set(key, url);
  }
  return url;
}

/** The smallest bitmap of `key` with at least `units`. */
function bitmapFor(key: string, units: number | undefined) {
  if (!units) return undefined;
  for (let u = units; u <= MAX_UNITS; u++) {
    const b = bitmaps.get(`${key}@${u}`);
    if (b) {
      bitmaps.delete(`${key}@${u}`);
      bitmaps.set(`${key}@${u}`, b);
      return b;
    }
  }
  return undefined;
}

export function skinThumbnail(
  id: string,
  champion: CharacterId,
  stage: number,
  slot: string,
) {
  const key = `${id}:${stage}`;
  if (!sources.has(key))
    sources.set(key, () =>
      fighterArt(champion, THUMB_FRAME, { skin: id, stage }),
    );
  watch();
  const src = bitmapFor(key, slotUnits.get(slot))?.url ?? svgUrl(key);
  return `<img class="skin-thumb" src="${src}" alt="" aria-hidden="true" width="212" height="216" loading="lazy" decoding="async" data-thumb="${key}" data-thumb-slot="${slot}">`;
}

let observer: ResizeObserver | undefined;
/** Watch every thumbnail that loads: its size is what its bitmap needs. */
function watch() {
  if (
    observer ||
    typeof ResizeObserver === "undefined" ||
    typeof URL.createObjectURL !== "function"
  )
    return;
  observer = new ResizeObserver(sized);
  // Load events don't bubble, but they pass the document on the way down.
  document.addEventListener(
    "load",
    (e) => {
      const img = e.target;
      if (img instanceof HTMLImageElement && img.dataset.thumb)
        observer!.observe(img);
    },
    true,
  );
  // Slots may now show their thumbnails at other sizes: measure again.
  window.addEventListener("resize", () => slotUnits.clear());
}

/** Runs after layout, before the frame is painted. */
function sized(entries: ResizeObserverEntry[]) {
  for (const e of entries) {
    const img = e.target as HTMLImageElement;
    const key = img.dataset.thumb,
      slot = img.dataset.thumbSlot;
    if (!img.isConnected || !key || !slot || !sources.has(key)) {
      observer!.unobserve(img);
      continue;
    }
    const box = e.contentBoxSize?.[0];
    const w = box ? box.inlineSize : e.contentRect.width,
      h = box ? box.blockSize : e.contentRect.height;
    if (!w || !h) continue;
    // Device pixels per unit where the picture is drawn (object-fit: contain).
    const scale = Math.min(w / UNIT_W, h / UNIT_H) * devicePixelRatio;
    const least = Math.ceil(scale);
    // A bitmap dropped from the cache counts as too small.
    const src = img.getAttribute("src") ?? "";
    const bitmapShown = src.startsWith("blob:");
    const shown = bitmapShown ? (bitmapUnits.get(src) ?? 0) : 0;
    if (least > MAX_UNITS) {
      if (bitmapShown) img.src = svgUrl(key);
      continue;
    }
    const units = Math.max(
      slotUnits.get(slot) ?? 0,
      Math.min(Math.ceil(scale * OVERSAMPLE), MAX_UNITS),
    );
    slotUnits.set(slot, units);
    if (shown >= least) continue;
    const bitmap = bitmapFor(key, units);
    if (bitmap) img.src = bitmap.url;
    else {
      if (bitmapShown) img.src = svgUrl(key);
      paint(key, units);
    }
  }
}

const wanted = new Map<string, number>();
let painting = false;
function paint(key: string, units: number) {
  if (failed.has(`${key}@${units}`) || (wanted.get(key) ?? 0) >= units) return;
  wanted.set(key, units);
  if (!painting) void paintAll();
}
async function paintAll() {
  painting = true;
  try {
    // Let the screen that asked finish arriving first.
    await new Promise((r) => setTimeout(r, 500));
    while (wanted.size) {
      const [key, units] = wanted.entries().next().value!;
      wanted.delete(key);
      if (bitmapFor(key, units)) continue;
      // Nothing shows it any more (another screen, another fighter).
      if (!document.querySelector(`img[data-thumb="${key}"]`)) continue;
      try {
        const bitmap = await rasterize(key, units);
        keep(`${key}@${units}`, bitmap);
        show(key);
      } catch {
        failed.add(`${key}@${units}`);
      }
    }
  } finally {
    painting = false;
  }
}

async function rasterize(key: string, units: number): Promise<Bitmap> {
  const width = UNIT_W * units,
    height = UNIT_H * units;
  await idle(1000);
  const svg = URL.createObjectURL(
    new Blob([sizedSvg(sources.get(key)!(), width, height)], {
      type: "image/svg+xml;charset=utf-8",
    }),
  );
  let blob: Blob | null;
  try {
    const art = new Image();
    art.src = svg;
    await art.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    // Read back at once (canvasPng): drawn on the CPU, not the GPU.
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw Error("no 2d context");
    ctx.drawImage(art, 0, 0);
    blob = await canvasPng(canvas, ctx);
  } finally {
    URL.revokeObjectURL(svg);
  }
  if (!blob) throw Error("no bitmap");
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { url, units, image };
}

function keep(id: string, bitmap: Bitmap) {
  bitmaps.set(id, bitmap);
  bitmapUnits.set(bitmap.url, bitmap.units);
  while (bitmaps.size > MAX_BITMAPS) {
    const [oldId, old] = bitmaps.entries().next().value!;
    bitmaps.delete(oldId);
    bitmapUnits.delete(old.url);
    URL.revokeObjectURL(old.url);
  }
}

/** Thumbnails of `key` on screen take its bitmap where it is big enough. */
function show(key: string) {
  for (const img of Array.from(
    document.querySelectorAll<HTMLImageElement>(`img[data-thumb="${key}"]`),
  )) {
    const units = slotUnits.get(img.dataset.thumbSlot ?? "");
    if (!units || (bitmapUnits.get(img.getAttribute("src")!) ?? 0) >= units)
      continue;
    const bitmap = bitmapFor(key, units);
    if (bitmap) img.src = bitmap.url;
  }
}

/** What's painted now (tests): `${id}:${stage}@${units}`. */
export const thumbnailBitmaps = () => [...bitmaps.keys()];
