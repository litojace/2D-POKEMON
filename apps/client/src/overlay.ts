const markupByElement = new WeakMap<HTMLElement, string>();
export function setOverlayMarkup(element: HTMLElement, markup: string) {
  if (markupByElement.get(element) === markup) return false;
  element.innerHTML = markup;
  markupByElement.set(element, markup);
  return true;
}
