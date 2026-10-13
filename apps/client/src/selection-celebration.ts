export function celebrateSelection(root: HTMLElement, reduced: boolean) {
  if (reduced || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const el of Array.from(
    root.querySelectorAll<HTMLElement>(
      ".creature-card.selected, .selected-art",
    ),
  )) {
    el.classList.remove("selection-cheer");
    void el.offsetWidth;
    el.classList.add("selection-cheer");
    const artwork = el.querySelector("svg .fighter-character, img");
    const finish = (event: Event) => {
      if (
        event.target !== artwork ||
        (event as AnimationEvent).animationName !== "selection-leap"
      )
        return;
      el.classList.remove("selection-cheer");
      artwork?.removeEventListener("animationend", finish);
    };
    artwork?.addEventListener("animationend", finish);
  }
}
