/** iOS Home Screen apps share a small WebKit/GPU budget with suspended pages. */
export function isIOSWebApp(
  ua = typeof navigator === "undefined" ? "" : navigator.userAgent,
  touch = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints,
  standalone = typeof navigator !== "undefined" &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true,
) {
  return standalone && isIOSDevice(ua, touch);
}
/**
 * An iPhone or iPad, in Safari or installed (iPadOS reports a Mac with touch).
 * iOS ends a web page that uses too much memory, which players see as a white
 * screen and a reload, so these devices get the smaller budgets below.
 */
export function isIOSDevice(
  ua = typeof navigator === "undefined" ? "" : navigator.userAgent,
  touch = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints,
) {
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1);
}
/**
 * A device that should give memory back eagerly: any iPhone or iPad, or a
 * browser reporting 3 GB of memory or less (navigator.deviceMemory).
 */
export function memoryConstrained(
  ios = isIOSDevice(),
  memory = typeof navigator === "undefined"
    ? undefined
    : (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
) {
  return ios || (typeof memory === "number" && memory > 0 && memory <= 3);
}
/**
 * An iPad with a large screen (its long side 1180 points or more): iPad
 * Air 4 and later, iPad 10th generation, every iPad Pro 11", 12.9" and 13".
 * They all have 4 GB of memory or more (an iPad Pro M4 8–16 GB), so they
 * draw as sharp as a desktop. The smaller budgets below were made for
 * iPhones and older iPads (2–3 GB); on a 13" iPad they drew the Bistro at
 * about 1.2 pixels per point on a 2× screen, which looked soft (owner, iPad
 * Pro 13" M4, 11 Nov 2026). The screen's size is the device's, whatever the
 * window: Split View and Stage Manager don't change it. Graphics Auto still
 * drops to Low (1×, battles 1.5×) where frames run slow.
 */
export function largeIPad(
  ios = isIOSDevice(),
  screenSize = typeof screen === "undefined"
    ? 0
    : Math.max(screen.width, screen.height),
) {
  return ios && screenSize >= 1180;
}
/**
 * The battle canvas's pixels per CSS pixel: the screen's density, at most 2,
 * and at most 1.5 on iPhones and smaller iPads (fewer pixels to fill each
 * frame, and every full-screen render buffer shrinks with it).
 */
export function rendererDensity(
  dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1,
  ios = isIOSDevice(),
  large = largeIPad(ios),
) {
  const cap = ios && !large ? 1.5 : 2;
  return Math.max(1, Math.min(cap, Number.isFinite(dpr) ? dpr : 1));
}
/** Most pixels a full-screen 2D scene canvas (the Plaza, the Farm) may have on
 *  an iPhone or iPad: an iPad-sized window at 2x would be 4 million, 16 MB
 *  plus its GPU copy, kept while the scene waits behind the Lobby. */
export const SCENE_PIXEL_BUDGET = 2_000_000;
/** The same on a large iPad (largeIPad): a 13" screen at 2× is 5.7 million. */
export const LARGE_IPAD_PIXEL_BUDGET = 6_000_000;
/**
 * A 2D scene canvas's pixels per CSS pixel for a width × height window: the
 * screen's density, at most 2, and on iPhones and smaller iPads at most 1.5,
 * as the battle canvas (rendererDensity): Safari fills fewer pixels each
 * frame, so dragging the Farm or the Plaza stays smooth. There it also stays
 * within SCENE_PIXEL_BUDGET (an iPad-sized window draws a little softer); a
 * large iPad draws up to 2× within LARGE_IPAD_PIXEL_BUDGET. Never below 1.
 */
export function sceneDensity(
  width: number,
  height: number,
  dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1,
  ios = isIOSDevice(),
  large = largeIPad(ios),
) {
  let d = Math.min(ios && !large ? 1.5 : 2, Number.isFinite(dpr) ? dpr : 1);
  if (ios)
    d = Math.min(
      d,
      Math.sqrt(
        (large ? LARGE_IPAD_PIXEL_BUDGET : SCENE_PIXEL_BUDGET) /
          Math.max(1, width * height),
      ),
    );
  return Math.max(1, d);
}
