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
 * The battle canvas's pixels per CSS pixel: the screen's density, at most 2,
 * and at most 1.5 on iPhones and iPads (fewer pixels to fill each frame, and
 * every full-screen render buffer shrinks with it).
 */
export function rendererDensity(
  dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1,
  ios = isIOSDevice(),
) {
  return Math.max(1, Math.min(ios ? 1.5 : 2, Number.isFinite(dpr) ? dpr : 1));
}
/** Most pixels a full-screen 2D scene canvas (the Plaza, the Farm) may have on
 *  an iPhone or iPad: an iPad-sized window at 2x would be 4 million, 16 MB
 *  plus its GPU copy, kept while the scene waits behind the Lobby. */
export const SCENE_PIXEL_BUDGET = 2_000_000;
/**
 * A 2D scene canvas's pixels per CSS pixel for a width × height window: the
 * screen's density, at most 2, and on iPhones and iPads no more than keeps
 * the canvas within SCENE_PIXEL_BUDGET (a phone in landscape stays at 2x;
 * an iPad-sized window draws a little softer). Never below 1.
 */
export function sceneDensity(
  width: number,
  height: number,
  dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1,
  ios = isIOSDevice(),
) {
  let d = Math.min(2, Number.isFinite(dpr) ? dpr : 1);
  if (ios)
    d = Math.min(
      d,
      Math.sqrt(SCENE_PIXEL_BUDGET / Math.max(1, width * height)),
    );
  return Math.max(1, d);
}
