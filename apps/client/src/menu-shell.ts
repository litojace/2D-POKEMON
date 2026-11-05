/** Keep the home screen (and its Play panel's place) mounted while only the
 * panel's contents change; build it afresh otherwise. Rooms draw their own
 * screen (UI remodel step 5, main.ts renderRoom). */
export function updateMenuShell(
  menu: HTMLElement,
  panelMarkup: string,
  buildShell: () => string,
  retain = !menu.hidden,
) {
  const panel = menu.querySelector<HTMLElement>(".room-panel");
  if (retain && panel && menu.querySelector(".home-screen")) {
    panel.innerHTML = panelMarkup;
    return true;
  }
  menu.innerHTML = buildShell();
  return false;
}
