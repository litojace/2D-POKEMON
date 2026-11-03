/**
 * Update a screen in place from new markup without throwing away what the
 * browser already built: decoded pictures, a live canvas, focus, scroll
 * positions and effects attached by other code. Screens keep the markup they
 * rendered last (a detached copy) and patch the live DOM by comparing the
 * two, so whatever other code added to the live DOM (an effect canvas, a
 * renderer's attributes) is left alone where the markup didn't change.
 *
 * Elements matching `replaceWhole` are swapped as a unit when their markup
 * changes, because something else owns their insides (the live preview's
 * stage, cosmetic effect hosts).
 */
const REPLACE_WHOLE = ".shop-live-stage, .raid-cosmetic-preview";

/** Parse markup into a detached element (its first element child). */
export function parse(html: string) {
  const box = document.createElement("div");
  box.innerHTML = html;
  return box.firstElementChild as HTMLElement;
}

export function patch(
  live: Node,
  previous: Node,
  next: Node,
  replaceWhole = REPLACE_WHOLE,
) {
  if (previous.isEqualNode(next)) return;
  if (
    live.nodeType !== next.nodeType ||
    live.nodeName !== next.nodeName ||
    (live instanceof Element && live.matches(replaceWhole))
  ) {
    live.parentNode?.replaceChild(next.cloneNode(true), live);
    return;
  }
  if (
    live instanceof Element &&
    previous instanceof Element &&
    next instanceof Element
  ) {
    for (const attribute of Array.from(previous.attributes))
      if (!next.hasAttribute(attribute.name))
        live.removeAttribute(attribute.name);
    for (const attribute of Array.from(next.attributes))
      if (previous.getAttribute(attribute.name) !== attribute.value)
        live.setAttribute(attribute.name, attribute.value);
  }
  if (next.nodeType === Node.TEXT_NODE) {
    live.nodeValue = next.nodeValue;
    return;
  }
  const before = Array.from(previous.childNodes),
    after = Array.from(next.childNodes),
    children = Array.from(live.childNodes);
  if (before.length !== after.length || children.length !== before.length) {
    while (live.firstChild) live.removeChild(live.firstChild);
    for (const node of after) live.appendChild(node.cloneNode(true));
    return;
  }
  for (let i = 0; i < after.length; i++)
    patch(children[i], before[i], after[i], replaceWhole);
  if (live instanceof HTMLSelectElement && next instanceof HTMLSelectElement)
    live.value = next.value;
}
