import { menuIcon } from "./menu-icons";

/** Keep the battle's one settings entry separate from the optional practice panel. */
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
  menu.innerHTML = menuIcon("settings");
  menu.setAttribute("aria-label", "Battle settings");
  dock.append(
    footer,
    controls.querySelector<HTMLElement>(".mobile-tools")!,
    practice,
  );
  battle.append(dock, menu);
}
