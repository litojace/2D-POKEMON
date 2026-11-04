import { openHubPanel, type HubPanel } from "../ui/hub-panel";
import { parse, patch } from "../ui/patch";
import {
  missionsMarkup,
  missionsView,
  type MissionsData,
  type MissionsView,
} from "./missions-view";
import "./missions.css";

/**
 * The Missions sheet's behaviour (UI remodel step 4). Markup comes from
 * missions-view.ts. It opens inside the Lobby as a sheet (openHubPanel), so
 * the Lobby beside it keeps running: your fighter moves and PLAY works.
 * A mission's row opens how to complete it; ↻ changes it (the server picks
 * the new one and counts the change).
 */
export interface MissionsHooks {
  data(): MissionsData;
  /** Change the mission in this slot; resolves once the new economy is in. */
  change(slot: number): Promise<void>;
  onClose?(): void;
}
export interface MissionsScreen {
  refresh(): void;
  close(): void;
  readonly isOpen: boolean;
  readonly view: MissionsView;
}

/** How often the countdown in the head is redrawn while the sheet is open. */
const TICK_MS = 30_000;

export function openMissions(hooks: MissionsHooks): MissionsScreen {
  const view = missionsView();
  let template: HTMLElement;
  let panel: HubPanel;
  let closed = false;
  const root = () => panel.root;

  function render() {
    if (closed) return;
    const next = parse(missionsMarkup(view, hooks.data()));
    patch(root(), template, next);
    template = next;
  }
  const focusOn = (selector: string) => {
    const el = root().querySelector<HTMLElement>(selector);
    el?.focus({ preventScroll: true });
    return !!el;
  };

  async function change(slot: number) {
    if (view.busy !== null) return;
    view.busy = slot;
    view.status = "";
    render();
    try {
      await hooks.change(slot);
      view.status = "New mission ready.";
    } catch (error) {
      view.status =
        error instanceof Error ? error.message : "That didn't work. Try again.";
    }
    view.busy = null;
    if (view.help === slot) view.help = null;
    render();
    // Focus stays on the row that changed (its change button, if any left).
    if (!focusOn(`[data-mission-change="${slot}"]:not([disabled])`))
      focusOn(`[data-mission-help="${slot}"]`);
  }

  const onClick = (event: MouseEvent) => {
    const t = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!t || !root().contains(t) || t.disabled) return;
    if (t.dataset.missionChange !== undefined)
      void change(Number(t.dataset.missionChange));
    else if (t.dataset.missionHelp !== undefined) {
      const slot = Number(t.dataset.missionHelp);
      view.help = view.help === slot ? null : slot;
      render();
      root()
        .querySelector(`#mission-guide-${slot}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  };
  // Arrows move between the missions (and their change buttons).
  const onKey = (event: KeyboardEvent) => {
    const t = event.target as HTMLElement;
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const row = t.closest<HTMLElement>(".missions-row");
    if (!row || !t.matches("button")) return;
    const rows = Array.from(
      root().querySelectorAll<HTMLElement>(".missions-row"),
    );
    const next = rows[rows.indexOf(row) + (event.key === "ArrowDown" ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    const same = t.classList.contains("missions-change")
      ? next.querySelector<HTMLButtonElement>(
          ".missions-change:not([disabled])",
        )
      : null;
    (same ?? next.querySelector<HTMLElement>(".missions-main"))?.focus();
  };

  const html = missionsMarkup(view, hooks.data());
  template = parse(html);
  const tick = setInterval(render, TICK_MS);
  panel = openHubPanel(html, {
    rail: "missions",
    onClose: () => {
      closed = true;
      clearInterval(tick);
      hooks.onClose?.();
    },
  });
  root().addEventListener("click", onClick);
  root().addEventListener("keydown", onKey);
  return {
    refresh: render,
    close: () => panel.close(),
    get isOpen() {
      return !closed;
    },
    get view() {
      return view;
    },
  };
}
