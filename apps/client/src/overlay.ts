const markupByElement = new WeakMap<HTMLElement, string>();
/** Countdown values are filled separately so timer ticks preserve focused cards. */
export const LIVE_SECONDS = '<span class="live-seconds"></span>';
/** Countdown digits update in place so the overlay card is not remounted each second. */
export const LIVE_COUNTDOWN = '<span class="live-countdown"></span>';
export function fillLiveCountdown(root: HTMLElement, seconds: number) {
  const text = String(Math.max(1, Math.ceil(seconds)));
  root.querySelectorAll<HTMLElement>(".live-countdown").forEach((slot) => {
    if (slot.textContent !== text) slot.textContent = text;
  });
}
export function fillLiveSeconds(root: HTMLElement, seconds: number) {
  const n = Math.max(0, Math.ceil(seconds));
  const text = `${n} second${n === 1 ? "" : "s"}`;
  root.querySelectorAll<HTMLElement>(".live-seconds").forEach((slot) => {
    if (slot.textContent !== text) slot.textContent = text;
  });
}
export function setOverlayMarkup(
  element: HTMLElement,
  markup: string,
  scrollKey?: string,
) {
  if (markupByElement.get(element) === markup) return false;
  const previousScroll = scrollKey
    ? element.querySelector<HTMLElement>(".panel-scroll")
    : null;
  const scrollTop =
    scrollKey && element.dataset.panelKey === scrollKey
      ? (previousScroll?.scrollTop ?? 0)
      : 0;
  const active = scrollKey ? document.activeElement : null;
  const focusId = active && element.contains(active) ? active.id : "";
  element.innerHTML = markup;
  markupByElement.set(element, markup);
  if (scrollKey) {
    element.dataset.panelKey = scrollKey;
    const scroller = element.querySelector<HTMLElement>(".panel-scroll");
    if (scroller) scroller.scrollTop = scrollTop;
    const focus = focusId && document.getElementById(focusId);
    if (focus && element.contains(focus) && !focus.hasAttribute("disabled"))
      focus.focus({ preventScroll: true });
  }
  return true;
}
