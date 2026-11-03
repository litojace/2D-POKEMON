/** iOS Home Screen apps share a small WebKit/GPU budget with suspended pages. */
export function isIOSWebApp(
  ua = typeof navigator === "undefined" ? "" : navigator.userAgent,
  touch = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints,
  standalone = typeof navigator !== "undefined" &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true,
) {
  return (
    standalone &&
    (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1))
  );
}
export function rendererDensity(
  dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1,
  iosApp = isIOSWebApp(),
) {
  return Math.max(
    1,
    Math.min(iosApp ? 1.5 : 2, Number.isFinite(dpr) ? dpr : 1),
  );
}
