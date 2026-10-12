/** Put mobile battle utilities in one flow so optional Practice cannot overlap Menu. */
export function setupBattleDock(
  battle: HTMLElement,
  controls: HTMLElement,
  footer: HTMLElement,
  practice: HTMLElement,
) {
  const dock = document.createElement("nav");
  dock.className = "battle-dock";
  dock.setAttribute("aria-label", "Battle options");
  const menu = footer.querySelector<HTMLButtonElement>("#battle-menu")!;
  menu.textContent = "Menu";
  menu.setAttribute("aria-label", "Open battle menu");
  dock.append(
    footer,
    controls.querySelector<HTMLElement>(".mobile-tools")!,
    practice,
  );
  battle.append(dock);
}
