const markupByElement = new WeakMap<HTMLElement, string>();
/** Countdown values are filled separately so timer ticks preserve focused cards. */
export const LIVE_SECONDS = '<span class="live-seconds"></span>';
export function fillLiveSeconds(root: HTMLElement, seconds: number) {
  const n = Math.max(0, Math.ceil(seconds));
  const text = `${n} second${n === 1 ? "" : "s"}`;
  root.querySelectorAll<HTMLElement>(".live-seconds").forEach((slot) => {
    if (slot.textContent !== text) slot.textContent = text;
  });
}
export function setOverlayMarkup(element: HTMLElement, markup: string) {
  if (markupByElement.get(element) === markup) return false;
  element.innerHTML = markup;
  markupByElement.set(element, markup);
  return true;
}
