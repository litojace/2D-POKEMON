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

/** What a child is, to find it again when its siblings change (`loose`). */
const kind = (n: Node) =>
  n instanceof Element
    ? `${n.tagName} ${n.getAttribute("class") ?? ""}`
    : `#${n.nodeType}`;

/**
 * `loose`: where a list of children grew or shrank, keep the children that
 * are still there (same tag and class, in the same order) and patch them,
 * rather than rebuilding the whole list. For another tab of a screen: its
 * head, tab row and stage stay the same elements, and only what differs is
 * built. (Removing the focused tab, the one just tapped, would make the
 * browser restyle the whole old screen first: a quarter second on a phone.)
 */
export function patch(
  live: Node,
  previous: Node,
  next: Node,
  replaceWhole = REPLACE_WHOLE,
  loose = false,
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
  if (children.length !== before.length) {
    while (live.firstChild) live.removeChild(live.firstChild);
    for (const node of after) live.appendChild(node.cloneNode(true));
    return;
  }
  if (before.length !== after.length) {
    if (!loose) {
      while (live.firstChild) live.removeChild(live.firstChild);
      for (const node of after) live.appendChild(node.cloneNode(true));
      return;
    }
    // Each new child takes the first old one of its kind after the last
    // taken (so the kept ones never move), or is built.
    let from = 0;
    const taken = after.map((node) => {
      let i = from;
      while (i < before.length && kind(before[i]) !== kind(node)) i++;
      if (i === before.length) return -1;
      from = i + 1;
      return i;
    });
    children.forEach((node, i) => {
      if (!taken.includes(i)) live.removeChild(node);
    });
    after.forEach((node, j) => {
      const i = taken[j];
      if (i < 0)
        live.insertBefore(node.cloneNode(true), live.childNodes[j] ?? null);
      else patch(children[i], before[i], node, replaceWhole, true);
    });
  } else
    for (let i = 0; i < after.length; i++)
      patch(children[i], before[i], after[i], replaceWhole, loose);
  if (live instanceof HTMLSelectElement && next instanceof HTMLSelectElement)
    live.value = next.value;
}

/** What setInner last put in each element: its markup, a detached copy, and
 *  the element's children right after (to notice when other code swapped them). */
const shown = new WeakMap<
  Element,
  { html: string; tree: HTMLElement; kids: ChildNode[] }
>();

/**
 * Set an element's insides from markup, for panels drawn again whenever new
 * data comes in (a server answer, a timer). Markup that hasn't changed leaves
 * the element alone; markup that has is patched in, so lists keep their
 * scroll, buttons under a finger stay the same buttons (the tap still lands),
 * pictures don't reload and running animations don't restart. `fresh` (a
 * different view: another sheet or tab) draws it from scratch instead.
 * Returns whether anything changed.
 */
export function setInner(live: HTMLElement, html: string, fresh = false) {
  const last = shown.get(live);
  const kids = Array.from(live.childNodes);
  const intact =
    !!last &&
    last.kids.length === kids.length &&
    last.kids.every((node, i) => node === kids[i]);
  if (!fresh && intact && last.html === html) return false;
  const next = document.createElement(live.tagName);
  next.innerHTML = html;
  if (fresh || !intact) live.innerHTML = html;
  else patch(live, last.tree, next);
  shown.set(live, { html, tree: next, kids: Array.from(live.childNodes) });
  return true;
}
