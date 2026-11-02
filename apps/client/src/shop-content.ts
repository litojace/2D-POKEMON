/** Patch authored Shop markup without discarding decoded art or a live canvas.
 * Compare against the previous template, since effect renderers add their own
 * children and attributes to the live DOM. */
export class ShopContent {
  private template?: HTMLElement;
  private html = "";
  constructor(
    private root: HTMLElement,
    private open: (html: string) => void,
  ) {}

  render(html: string) {
    if (this.template && this.root.querySelector(".shop") && html === this.html)
      return;
    const next = document.createElement("div");
    next.innerHTML = html;
    if (!this.template || !this.root.querySelector(".shop")) this.open(html);
    else {
      for (const selector of [
        ".shop-head",
        ".shop-tabs",
        ".shop-preview",
        ".shop-body",
      ]) {
        const live = this.root.querySelector(selector),
          old = this.template.querySelector(selector),
          node = next.querySelector(selector);
        if (live && old && node) patch(live, old, node);
      }
    }
    this.template = next;
    this.html = html;
  }
  preview(html: string) {
    const next = document.createElement("div");
    next.innerHTML = html;
    const live = this.root.querySelector(".shop-preview"),
      old = this.template?.querySelector(".shop-preview"),
      node = next.firstElementChild;
    if (live && old && node) {
      patch(live, old, node);
      old.replaceWith(node);
      this.html = "";
    }
  }
  select(id: string | null | undefined) {
    for (const root of [this.root, this.template]) {
      if (!root) continue;
      for (const button of Array.from(
        root.querySelectorAll<HTMLElement>("[data-shop-preview]"),
      )) {
        const active = button.dataset.shopPreview === id;
        button.setAttribute("aria-pressed", String(active));
        button.closest(".shop-card")?.classList.toggle("is-selected", active);
      }
    }
  }
}
function patch(live: Node, previous: Node, next: Node) {
  if (previous.isEqualNode(next)) return;
  if (
    live.nodeType !== next.nodeType ||
    live.nodeName !== next.nodeName ||
    (live instanceof HTMLElement &&
      live.matches(".shop-live-stage, .raid-cosmetic-preview"))
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
    patch(children[i], before[i], after[i]);
  if (live instanceof HTMLSelectElement && next instanceof HTMLSelectElement)
    live.value = next.value;
}
