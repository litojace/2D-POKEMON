/** Preserve the roster and its animations while entering or leaving a lobby. */
export function updateMenuShell(
  menu: HTMLElement,
  panelMarkup: string,
  buildShell: () => string,
  retain = !menu.hidden,
) {
  const panel = menu.querySelector<HTMLElement>(".room-panel");
  if (retain && panel && menu.querySelector(".roster-panel")) {
    panel.innerHTML = panelMarkup;
    return true;
  }
  menu.innerHTML = buildShell();
  return false;
}
