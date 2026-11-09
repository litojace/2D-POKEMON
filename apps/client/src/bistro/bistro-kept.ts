/** Where each account's bistro is kept in this browser (bistro-scene.ts). */
export const KEPT = "arena-bistro:";
/**
 * Remove every kept bistro from this browser's storage (logging out). Kept
 * apart from the scene so signing out clears them even when the Bistro was
 * never opened (its code loads only when you go there).
 */
export function clearKeptBistros() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(KEPT)) localStorage.removeItem(key);
    }
  } catch {
    /* No storage. */
  }
}
