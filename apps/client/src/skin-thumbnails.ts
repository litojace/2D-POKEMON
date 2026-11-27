import type { CharacterId } from "@arena/shared";
import { AVATAR_VIEWBOX } from "./creature-design";
import { fighterArt, fighterAvatar } from "./fighter-art";
import { canvasPng, idle, sizedSvg } from "./svg-raster";

/**
 * Skin thumbnails (the Shop and Wardrobe catalogue, Roster → Skins, reward
 * cards) and the Roster's "Original look" as pictures painted once.
 *
 * A thumbnail starts as an `<img>` of its SVG, so a screen renders at once.
 * But the SVGs carry masks and filters, and the browser records and rasters
 * every one of them again each time a screen with them is built: on a 4×
 * slowed CPU, Roster → Skins spent 67 ms painting where the Skills tab spent
 * 17 ms (Nov 2026). So once a thumbnail has shown, it is
 * drawn into a bitmap in a quiet moment (svg-raster.ts), and from then on
 * the screen shows that bitmap; a screen built again (a tab switch, a patch)
 * takes it straight away. Not on phones (keepsSvg): there, drawing a bitmap
 * cost far more than it saved.
 *
 * Looking the same:
 * - A skin's bitmap keeps the frame's exact shape (212:216, a whole number
 *   of 53×54 px), so the picture lays out exactly as the SVG did (in some
 *   boxes the picture's own shape sets the row's height), and
 *   `object-fit: contain` (`.skin-thumb`) puts it where the SVG's own
 *   fitting put the drawing.
 * - The Original look is inline SVG: it keeps its own `<svg>` (same box,
 *   same clipping), emptied, with the bitmap as its CSS background. Inline,
 *   the art shows past its square frame as far as the box is wider or
 *   taller, so the bitmap covers that much more (measured per slot), and the
 *   box clips it as it clipped the art. (An SVG `<image>` inside was drawn
 *   with coarser filtering: 4–20% softer depending on the exact size.)
 * - Bitmaps are drawn larger than the device pixels they show at: the
 *   browser doesn't snap a picture to device pixels, so one shown at about
 *   its own size is resampled, a little softer than the SVG. How much
 *   depends on the size ratio, unevenly; measured at 2× and 3× screens:
 *   skins 1.5× (in whole 53×54 steps) were within 1% of the SVG's sharpness
 *   (1× 2–4% softer, 2× softer again); the Original look at exactly 1.75×
 *   was 1–2% crisper than inline (1.25× and 1.5× 5–14% softer).
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
/** Device pixels drawn per device pixel shown (see above): skins, inline. */
const OVERSAMPLE = { img: 1.5, inline: 1.75 };
/**
 * Sizes go in steps of device pixels per art unit: quarters for skins (a
 * bitmap is then 53×54 px times a whole number), twentieths inline.
 */
const STEP = { img: 4, inline: 20 };
/** At most 648 px a side (1.6 MB once decoded); bigger stays SVG. */
const MAX_SIDE = 648;
/**
 * Bitmaps kept, least recently used dropped first: a long stretch of the
 * catalogue (270 skins in all). About 65 KB of PNG each on a 3× phone.
 */
const MAX_BITMAPS = 160;
/**
 * Page rules the inline art obeys, which a picture of it must carry itself:
 * style.css hides the Cragstone reward's cracks. (A fighter's own look draws
 * nothing in them, checked for every fighter; this keeps it so.)
 */
const PAGE_RULES = "<style>.crag-cracks{display:none}</style>";

type Frame = [x: number, y: number, w: number, h: number];
interface Source {
  /** The art as a picture of its own (no ids to scope). */
  svg: () => string;
  frame: Frame;
  /** An `<img>` (contained in the frame), or inline SVG (overflow shows). */
  inline: boolean;
  /** Inline only: the markup shown in a slot until there is a bitmap. */
  markup?: (slot: string) => string;
}
/** What a picture needs: device px per art unit, art units shown past the frame. */
interface Need {
  ppu: number;
  mx: number;
  my: number;
}
interface Bitmap extends Need {
  key: string;
  url: string;
  /** Holds the decoded picture, so showing it again needs no decoding. */
  image: HTMLImageElement;
}

const svgUrls = new Map<string, string>();
const sources = new Map<string, Source>();
/** `${key}@${ppu}:${mx}:${my}` → bitmap, least recently used first. */
const bitmaps = new Map<string, Bitmap>();
const byUrl = new Map<string, Bitmap>();
/** Slot → what a bitmap needs there (the most it was seen needing). */
const slotNeeds = new Map<string, Need>();
/** Inline slots: whether the box is wider than the frame (the art fits its height). */
const slotWide = new Map<string, boolean>();
const failed = new Set<string>();
/** Inline Original look markup by `${key} ${slot}` (a fighter's own look never changes). */
const looks = new Map<string, string>();

const covers = (b: Need, n: Need) =>
  b.ppu >= n.ppu && b.mx >= n.mx && b.my >= n.my;
const bitmapId = (key: string, n: Need) => `${key}@${n.ppu}:${n.mx}:${n.my}`;
const parseFrame = (viewBox: string) =>
  viewBox.trim().split(/\s+/).map(Number) as Frame;

/** Where a thumbnail sits, from its scope: "roster-look-voltkit-midnight" → "roster-look". */
export const thumbSlot = (scope: string, id: string) =>
  scope.endsWith(`-${id}`) ? scope.slice(0, -id.length - 1) : scope;

function svgUrl(key: string) {
  let url = svgUrls.get(key);
  if (!url) {
    url = `data:image/svg+xml,${encodeURIComponent(sources.get(key)!.svg())}`;
    if (svgUrls.size >= 64) svgUrls.delete(svgUrls.keys().next().value!);
    svgUrls.set(key, url);
  }
  return url;
}

/** The smallest bitmap of `key` that covers `need`. */
function bitmapFor(key: string, need: Need | undefined) {
  if (!need) return undefined;
  let best: Bitmap | undefined;
  for (const b of bitmaps.values())
    if (b.key === key && covers(b, need) && (!best || b.ppu < best.ppu))
      best = b;
  if (best) {
    const id = bitmapId(key, best);
    bitmaps.delete(id);
    bitmaps.set(id, best);
  }
  return best;
}

export function skinThumbnail(
  id: string,
  champion: CharacterId,
  stage: number,
  slot: string,
) {
  const key = `${id}:${stage}`;
  if (!sources.has(key))
    sources.set(key, {
      svg: () => fighterArt(champion, THUMB_FRAME, { skin: id, stage }),
      frame: parseFrame(THUMB_FRAME),
      inline: false,
    });
  watch();
  const src = bitmapFor(key, slotNeeds.get(slot))?.url ?? svgUrl(key);
  return `<img class="skin-thumb" src="${src}" alt="" aria-hidden="true" width="212" height="216" loading="lazy" decoding="async" data-thumb="${key}" data-thumb-slot="${slot}">`;
}

/** The inline `<svg>`, emptied, with the bitmap as its background. */
function backgroundSvg(markup: string, b: Bitmap, frame: Frame, wide: boolean) {
  const [, , fw, fh] = frame;
  // Centred like the art (xMidYMid meet), at the frame's scale: the frame
  // fills the box's height when the box is wider, else its width.
  const size = wide
    ? `auto ${(((fh + 2 * b.my) / fh) * 100).toFixed(4)}%`
    : `${(((fw + 2 * b.mx) / fw) * 100).toFixed(4)}% auto`;
  return `${markup.slice(0, markup.indexOf(">")).replace("<svg ", `<svg style="background:url(${b.url}) 50% 50% / ${size} no-repeat" `)}></svg>`;
}
const withThumb = (markup: string, key: string, slot: string) =>
  markup.replace(
    "<svg ",
    `<svg data-thumb="${key}" data-thumb-slot="${slot}" `,
  );

/**
 * A fighter's own look as the Roster's look cards show it (fighterAvatar,
 * inline), painted once. Screens showing it call watchPictures after
 * rendering: inline SVG has no load event to find it by.
 */
export function originalLook(champion: CharacterId, slot: string) {
  const key = `look:${champion}`;
  if (!sources.has(key))
    sources.set(key, {
      svg: () =>
        fighterArt(champion, AVATAR_VIEWBOX).replace(
          /<svg [^>]*>/,
          (open) => open + PAGE_RULES,
        ),
      frame: parseFrame(AVATAR_VIEWBOX),
      inline: true,
      // The same every time for a slot: built once, not on every render.
      markup: (slot) => {
        let m = looks.get(`${key} ${slot}`);
        if (!m) {
          m = withThumb(
            fighterAvatar(champion, `${slot}-${champion}`),
            key,
            slot,
          );
          looks.set(`${key} ${slot}`, m);
        }
        return m;
      },
    });
  watch();
  const source = sources.get(key)!;
  const markup = source.markup!(slot);
  const bitmap = slotWide.has(slot)
    ? bitmapFor(key, slotNeeds.get(slot))
    : undefined;
  return bitmap
    ? backgroundSvg(markup, bitmap, source.frame, slotWide.get(slot)!)
    : markup;
}

/**
 * Phones keep their pictures as SVG, painted by the browser on its own
 * threads. A bitmap is the SVG rasterized on the page's own thread, in one
 * piece that can't be split: on a 3× phone at 4× CPU, one frame of 650–830 ms
 * per thumbnail (636×648 px, however it was drawn and encoded; 270–370 ms
 * without the oversampling). What it saved was 15–30 ms of work each time
 * Shop → Skins or Roster → Skins was built again (Nov 2026). A mouse-driven
 * computer, faster, keeps painting.
 */
let coarse: MediaQueryList | undefined;
const keepsSvg = () => (coarse ??= matchMedia("(pointer: coarse)")).matches;

let observer: ResizeObserver | undefined;
/** Watch every picture that loads: its size is what its bitmap needs. */
function watch() {
  if (
    observer ||
    typeof ResizeObserver === "undefined" ||
    typeof URL.createObjectURL !== "function" ||
    keepsSvg()
  )
    return;
  observer = new ResizeObserver(sized);
  // Load events don't bubble, but they pass the document on the way down.
  document.addEventListener(
    "load",
    (e) => {
      const el = e.target;
      if (el instanceof HTMLImageElement && el.dataset.thumb) look(el);
    },
    true,
  );
  // Slots may now show their pictures at other sizes: measure again.
  window.addEventListener("resize", () => {
    slotNeeds.clear();
    slotWide.clear();
  });
}

/** Watch the inline pictures (originalLook) under `root`, once rendered. */
export function watchPictures(root: ParentNode) {
  if (!observer) return;
  root.querySelectorAll("svg[data-thumb]").forEach(look);
}
/**
 * Measure an element again before the next frame is painted. Chromium
 * ignores observe() of an element it already observes (a patched one), so
 * stop first: a new observation always reports its first size.
 */
function look(el: Element) {
  observer!.unobserve(el);
  observer!.observe(el);
}

/**
 * The bitmap an element shows: null for its SVG, undefined for one dropped
 * from the cache or of another picture (both too small to count).
 */
function shownBitmap(el: Element, key: string): Bitmap | null | undefined {
  // Inline art inside: that is what shows (see sized).
  if (!(el instanceof HTMLImageElement) && el.childElementCount) return null;
  const url =
    el instanceof HTMLImageElement
      ? el.getAttribute("src")
      : (el as SVGElement).style.backgroundImage.match(/url\("?([^")]+)/)?.[1];
  if (!url?.startsWith("blob:")) return null;
  const b = byUrl.get(url);
  return b?.key === key ? b : undefined;
}
function showBitmap(el: Element, key: string, b: Bitmap | null) {
  const source = sources.get(key)!;
  if (el instanceof HTMLImageElement) el.src = b ? b.url : svgUrl(key);
  else {
    const slot = el.getAttribute("data-thumb-slot")!;
    const markup = source.markup!(slot);
    const next = b
      ? backgroundSvg(markup, b, source.frame, slotWide.get(slot)!)
      : markup;
    const style = next.match(/^<svg style="([^"]*)"/)?.[1];
    if (style) el.setAttribute("style", style);
    else el.removeAttribute("style");
    el.innerHTML = next.slice(next.indexOf(">") + 1, -"</svg>".length);
  }
}

/** Runs after layout, before the frame is painted. */
function sized(entries: ResizeObserverEntry[]) {
  for (const e of entries) {
    const el = e.target;
    const key = el.getAttribute("data-thumb"),
      slot = el.getAttribute("data-thumb-slot");
    const source = key ? sources.get(key) : undefined;
    if (!el.isConnected || !key || !slot || !source) {
      observer!.unobserve(el);
      continue;
    }
    // The screen patches its markup in, which knows nothing of the
    // background set here: new art over an old background (another fighter
    // stepped to) loses the background before the frame is painted.
    if (source.inline && el.childElementCount && el.hasAttribute("style"))
      el.removeAttribute("style");
    const box = e.contentBoxSize?.[0];
    const w = box ? box.inlineSize : e.contentRect.width,
      h = box ? box.blockSize : e.contentRect.height;
    if (!w || !h) continue;
    const [, , fw, fh] = source.frame;
    // CSS px per art unit: the frame fitted in the box (contain, or the
    // SVG's own xMidYMid meet). Inline, the box shows past the frame.
    const scale = Math.min(w / fw, h / fh);
    const kind = source.inline ? "inline" : "img";
    const step = (v: number) => Math.ceil(v * STEP[kind] - 1e-6) / STEP[kind];
    const own: Need = {
      ppu: step(scale * devicePixelRatio),
      mx: source.inline
        ? Math.max(0, Math.ceil((w / scale - fw) / 2 - 0.01))
        : 0,
      my: source.inline
        ? Math.max(0, Math.ceil((h / scale - fh) / 2 - 0.01))
        : 0,
    };
    const side = Math.max(fw + 2 * own.mx, fh + 2 * own.my);
    const shown = shownBitmap(el, key);
    if (own.ppu * side > MAX_SIDE) {
      if (shown !== null) showBitmap(el, key, null);
      continue;
    }
    const before = slotNeeds.get(slot);
    const need: Need = {
      ppu: Math.max(
        before?.ppu ?? 0,
        own.ppu,
        Math.min(
          step(scale * devicePixelRatio * OVERSAMPLE[kind]),
          Math.floor((MAX_SIDE / side) * STEP[kind]) / STEP[kind],
        ),
      ),
      // Only inline art shows past its frame: an <img> bitmap with margins
      // would change the picture's shape (and so the layout) and shrink it.
      mx: source.inline ? Math.max(before?.mx ?? 0, own.mx) : 0,
      my: source.inline ? Math.max(before?.my ?? 0, own.my) : 0,
    };
    slotNeeds.set(slot, need);
    if (source.inline) {
      const wide = w / h >= fw / fh;
      // The background is sized for one orientation: redo it if it changed.
      if (slotWide.get(slot) !== wide && shown) {
        slotWide.set(slot, wide);
        showBitmap(el, key, shown);
      }
      slotWide.set(slot, wide);
    }
    if (shown && covers(shown, own)) continue;
    const bitmap = bitmapFor(key, need);
    if (bitmap) showBitmap(el, key, bitmap);
    else {
      // A bitmap too small (or dropped) gives way to the SVG meanwhile.
      if (shown !== null) showBitmap(el, key, null);
      paint(key, need);
    }
  }
}

const wanted = new Map<string, Need>();
let painting = false;
function paint(key: string, need: Need) {
  const queued = wanted.get(key);
  if (failed.has(bitmapId(key, need)) || (queued && covers(queued, need)))
    return;
  wanted.set(key, need);
  if (!painting) void paintAll();
}
async function paintAll() {
  painting = true;
  try {
    // Let the screen that asked finish arriving first.
    await new Promise((r) => setTimeout(r, 500));
    while (wanted.size) {
      const [key, need] = wanted.entries().next().value!;
      wanted.delete(key);
      if (bitmapFor(key, need)) continue;
      // Nothing shows it any more (another screen, another fighter).
      if (!document.querySelector(`[data-thumb="${key}"]`)) continue;
      try {
        keep(await rasterize(key, need));
        show(key);
      } catch {
        failed.add(bitmapId(key, need));
      }
    }
  } finally {
    painting = false;
  }
}

async function rasterize(key: string, need: Need): Promise<Bitmap> {
  const source = sources.get(key)!;
  const [x, y, fw, fh] = source.frame;
  const region: Frame = [
    x - need.mx,
    y - need.my,
    fw + 2 * need.mx,
    fh + 2 * need.my,
  ];
  const width = Math.round(region[2] * need.ppu),
    height = Math.round(region[3] * need.ppu);
  await idle(1000);
  const svg = URL.createObjectURL(
    new Blob([sizedSvg(source.svg(), width, height, region.join(" "))], {
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
  return { key, url, image, ...need };
}

function keep(bitmap: Bitmap) {
  bitmaps.set(bitmapId(bitmap.key, bitmap), bitmap);
  byUrl.set(bitmap.url, bitmap);
  while (bitmaps.size > MAX_BITMAPS) {
    const [oldId, old] = bitmaps.entries().next().value!;
    bitmaps.delete(oldId);
    byUrl.delete(old.url);
    URL.revokeObjectURL(old.url);
  }
}

/** Pictures of `key` on screen take its bitmap where it covers their slot. */
function show(key: string) {
  for (const el of Array.from(
    document.querySelectorAll(`[data-thumb="${key}"]`),
  )) {
    const need = slotNeeds.get(el.getAttribute("data-thumb-slot") ?? "");
    const shown = shownBitmap(el, key);
    if (!need || (shown && covers(shown, need))) continue;
    const bitmap = bitmapFor(key, need);
    if (bitmap) showBitmap(el, key, bitmap);
  }
}

/** What's painted now (tests): `${key}@${ppu}:${mx}:${my}`. */
export const thumbnailBitmaps = () => [...bitmaps.keys()];
