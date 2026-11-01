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

/** Town's drawing buffer. Phones and tablets draw it at most 1.5× like a
 * battle: the town fills the whole screen with far more on it, and at 2× it
 * ran noticeably slower than matches on the same phone. Large iPad windows
 * stay inside the home-screen app's pixel budget. Desktop keeps 2×. */
export function townRendererDensity(
  width: number,
  height: number,
  dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1,
  iosApp = isIOSWebApp(),
  touch = typeof matchMedia === "function" &&
    matchMedia("(pointer: coarse)").matches,
) {
  const pixels = Math.max(1, width * height);
  let cap = touch || iosApp ? 1.5 : 2;
  if (iosApp) cap = Math.min(cap, Math.sqrt(2_000_000 / pixels));
  return Math.max(1, Math.min(cap, Number.isFinite(dpr) ? dpr : 1));
}
