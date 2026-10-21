/** Keep lobby actions outside independently scrollable room information. */
export function frameLobbyPanel(panel: HTMLElement) {
  panel.classList.add("lobby-room-panel");
  const content = document.createElement("div");
  content.className = "lobby-room-content";
  content.tabIndex = 0;
  content.setAttribute("role", "region");
  content.setAttribute("aria-label", "Room details and party rules");
  const actions =
    panel.querySelector<HTMLElement>(".raid-lobby-actions") ??
    document.createElement("div");
  actions.classList.add("lobby-actions");
  if (!actions.classList.contains("raid-lobby-actions"))
    for (const button of Array.from(
      panel.querySelectorAll<HTMLElement>("#ready, #leave, #stop-watching"),
    ))
      actions.append(button);
  actions.querySelector("#ready")?.classList.add("btn-primary");
  actions.remove();
  while (panel.firstChild) content.append(panel.firstChild);
  panel.append(content, actions);
}
