import { iconLabel } from "./menu-icons";

let releaseRoomDrawer: (() => void) | undefined;

/** On narrow phones the room stays reachable without squeezing fighter details. */
function placeRoomDrawer(panel: HTMLElement) {
  if (panel.closest(".lobby-room-drawer")) return;
  const layout = panel.parentElement;
  if (
    !layout?.classList.contains("lobby-layout") ||
    layout.querySelector(".lobby-room-drawer")
  )
    return;
  releaseRoomDrawer?.();
  const drawer = document.createElement("details");
  drawer.className = "lobby-room-drawer";
  const summary = document.createElement("summary");
  summary.innerHTML = iconLabel("friends", "Room & ready");
  panel.id ||= "lobby-room";
  summary.setAttribute("aria-controls", panel.id);
  drawer.append(summary);
  panel.before(drawer);
  const compact = matchMedia("(max-width: 740px) and (orientation: landscape)");
  const events = new AbortController();
  const close = () => {
    drawer.open = false;
  };
  const sync = () => {
    if (compact.matches && panel.parentElement !== drawer) {
      drawer.append(panel);
      close();
    } else if (!compact.matches && panel.parentElement === drawer) {
      drawer.after(panel);
      close();
    }
  };
  compact.addEventListener("change", sync, { signal: events.signal });
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (drawer.open && !drawer.contains(event.target as Node)) close();
    },
    { signal: events.signal },
  );
  drawer.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && drawer.open) {
        event.preventDefault();
        event.stopPropagation();
        close();
        summary.focus();
      }
    },
    { signal: events.signal },
  );
  releaseRoomDrawer = () => events.abort();
  sync();
}

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
  placeRoomDrawer(panel);
}
