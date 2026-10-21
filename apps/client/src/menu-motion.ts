/** Keep animated SVG portraits alive only while the player can see them.
 * CSS handles articulated parts; SMIL auras need the SVG clock paused too.
 */
export function watchMenuMotion(
  menu: HTMLElement,
  ...panels: (HTMLDialogElement | HTMLDetailsElement)[]
) {
  const motion =
    typeof matchMedia === "undefined"
      ? undefined
      : matchMedia("(prefers-reduced-motion: reduce)");
  const portraits = new Map<HTMLElement, boolean>();
  const paused = new WeakMap<HTMLElement, boolean>();
  const sync = () => {
    const covered =
      menu.hidden || document.hidden || panels.some((p) => p.open);
    for (const [portrait, visible] of portraits) {
      const stop =
        covered ||
        !visible ||
        !!motion?.matches ||
        !!portrait.closest?.("[inert]");
      if (paused.get(portrait) === stop) continue;
      paused.set(portrait, stop);
      portrait.toggleAttribute("data-motion-paused", stop);
      for (const svg of Array.from(portrait.querySelectorAll("svg"))) {
        if (stop) svg.pauseAnimations?.();
        else svg.unpauseAnimations?.();
      }
    }
  };
  const visibility = new IntersectionObserver((entries) => {
    for (const entry of entries)
      if (portraits.has(entry.target as HTMLElement))
        portraits.set(entry.target as HTMLElement, entry.isIntersecting);
    sync();
  });
  const discover = () => {
    const current = new Set(
      Array.from(
        menu.querySelectorAll<HTMLElement>(".card-art, .selected-art"),
      ),
    );
    for (const portrait of portraits.keys())
      if (!current.has(portrait)) {
        visibility.unobserve(portrait);
        portraits.delete(portrait);
      }
    for (const portrait of current)
      if (!portraits.has(portrait)) {
        portraits.set(portrait, false);
        visibility.observe(portrait);
      }
    sync();
  };
  const content = new MutationObserver(discover);
  content.observe(menu, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "inert"],
  });
  const cover = new MutationObserver(sync);
  for (const panel of panels)
    cover.observe(panel, { attributes: true, attributeFilter: ["open"] });
  document.addEventListener("visibilitychange", sync);
  motion?.addEventListener("change", sync);
  discover();
  return () => {
    content.disconnect();
    cover.disconnect();
    visibility.disconnect();
    document.removeEventListener("visibilitychange", sync);
    motion?.removeEventListener("change", sync);
    for (const portrait of portraits.keys()) {
      portrait.removeAttribute("data-motion-paused");
      for (const svg of Array.from(portrait.querySelectorAll("svg")))
        svg.unpauseAnimations?.();
    }
    portraits.clear();
  };
}
