/**
 * Landscape locking for phones.
 *
 * Browsers only allow `screen.orientation.lock()` in fullscreen or in an
 * installed app (Android Chrome, Edge, Samsung Internet). iPhone and iPad
 * Safari do not support it at all, so callers fall back to the rotate hint.
 */
type Lockable = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
};

export function isInstalled(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    matchMedia("(display-mode: standalone)").matches ||
    matchMedia("(display-mode: fullscreen)").matches ||
    nav.standalone === true
  );
}

/** Whether a lock request could succeed right now (fullscreen or installed). */
export function canLockLandscape(): boolean {
  const orientation = screen.orientation as Lockable | undefined;
  if (typeof orientation?.lock !== "function") return false;
  return !!document.fullscreenElement || isInstalled();
}

/** Try to lock the screen to landscape. Never throws; resolves true on success. */
export async function lockLandscape(): Promise<boolean> {
  if (!canLockLandscape()) return false;
  try {
    await (screen.orientation as Lockable).lock!("landscape");
    return true;
  } catch {
    // iOS Safari has no lock; desktop browsers reject it. Both are fine.
    return false;
  }
}

/** Enter fullscreen (if possible) and then lock to landscape. */
export async function fullscreenLandscape(): Promise<boolean> {
  try {
    if (!document.fullscreenElement && !isInstalled())
      await document.documentElement.requestFullscreen?.();
  } catch {
    /* Fullscreen is optional; the lock below decides what happens. */
  }
  return lockLandscape();
}
