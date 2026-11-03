import { lowGraphics } from "../graphics-quality";
import { confirmModal, type ConfirmOptions } from "./components";

/**
 * The hub's screen shell (UI remodel rule 1): a screen opens *inside* the
 * Lobby, right of the rail and under the HUD, so your coins, the scene
 * switch and the rail stay visible and usable. A panel covers the Lobby's
 * stage; a sheet is narrow and leaves the fighter and PLAY in view.
 *
 * One screen at a time. Close, Escape and controller Back (the game sends
 * Escape) close it; opening another screen from the rail replaces it.
 */
export interface HubPanelOptions {
  /** Called once after the panel leaves (Close, Escape, replaced). */
  onClose?: () => void;
  /** The rail button to mark as current (`data-lobby-action` value). */
  rail?: string;
  /** Where to mount; defaults to the Lobby layer. */
  host?: HTMLElement;
}
export interface HubPanel {
  root: HTMLElement;
  /** Replace the panel's markup (keeps it open, mounted and focused). */
  update(html: string): void;
  close(): void;
}

/** Lobby parts a full panel covers: out of the tab order while it's open. */
const COVERED = [
  ".lobby-stage",
  ".lobby-cards",
  ".lobby-emotes",
  ".lobby-play",
];
let current: { panel: HubPanel; close: () => void } | undefined;
const uncover = (el: HTMLElement) => {
  el.inert = false;
  delete el.dataset.uiCovered;
};

export const openHubPanelNow = () => current?.panel;

export function openHubPanel(html: string, o: HubPanelOptions = {}): HubPanel {
  current?.close();
  const host =
    o.host ??
    document.querySelector<HTMLElement>(".lobby-layer") ??
    document.body;
  const returnFocus = document.activeElement as HTMLElement | null;
  const wrap = document.createElement("div");
  wrap.className = "ui-panel-host";
  let covered: HTMLElement[] = [];
  let closed = false;

  const mount = (markup: string) => {
    wrap.innerHTML = markup;
    const root = wrap.firstElementChild as HTMLElement | null;
    if (!root?.classList.contains("ui-panel"))
      throw new Error("openHubPanel expects markup from panel()");
    root.dataset.graphics = lowGraphics() ? "low" : "high";
    // A sheet leaves the Lobby usable; a panel covers it: the parts behind
    // leave the tab order and stop drawing (nothing peeks out at the edges).
    for (const el of covered) uncover(el);
    covered = root.classList.contains("ui-sheet")
      ? []
      : COVERED.flatMap((s) =>
          Array.from(host.querySelectorAll<HTMLElement>(`:scope ${s}`)),
        );
    for (const el of covered) {
      el.inert = true;
      el.dataset.uiCovered = "";
    }
    return root;
  };
  const railButton = o.rail
    ? host.querySelector<HTMLElement>(
        `.lobby-rail [data-lobby-action="${CSS.escape(o.rail)}"]`,
      )
    : null;

  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    // Whatever is on top answers Escape itself: a confirmation, or a native
    // dialog such as Settings opened from the HUD.
    if (document.querySelector("[data-ui-confirm], dialog[open]")) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };
  const onClick = (event: MouseEvent) => {
    if ((event.target as Element).closest("[data-ui-close]")) close();
  };
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    for (const el of covered) uncover(el);
    railButton?.removeAttribute("aria-current");
    wrap.remove();
    if (current?.panel === panel) current = undefined;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    o.onClose?.();
  }

  let root = mount(html);
  host.append(wrap);
  railButton?.setAttribute("aria-current", "page");
  wrap.addEventListener("click", onClick);
  // Bubble phase: menus inside the Lobby close first and mark it handled.
  document.addEventListener("keydown", onKey);
  // Focus moves into the screen (keyboard and screen readers start there);
  // Tab then reaches its tabs and buttons.
  root.tabIndex = -1;
  root.focus({ preventScroll: true });

  const panel: HubPanel = {
    get root() {
      return root;
    },
    update(markup: string) {
      if (closed) return;
      const focused = document.activeElement?.closest(
        "[data-ui-item], [data-ui-tab]",
      );
      const key = focused
        ? Array.from(focused.attributes)
            .filter((a) => a.name.startsWith("data-ui-"))
            .map((a) => `[${a.name}="${CSS.escape(a.value)}"]`)
            .join("")
        : "";
      root = mount(markup);
      root.tabIndex = -1;
      if (key)
        root.querySelector<HTMLElement>(key)?.focus({ preventScroll: true });
    },
    close,
  };
  current = { panel, close };
  return panel;
}

/**
 * Ask before spending. Resolves true on the confirm button, false on Cancel,
 * Escape or a tap outside. The amounts shown are a preview: the server sets
 * the price and checks the balance when the purchase is sent.
 */
export function askConfirm(o: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const returnFocus = document.activeElement as HTMLElement | null;
    const wrap = document.createElement("div");
    wrap.innerHTML = confirmModal(o);
    const scrim = wrap.firstElementChild as HTMLElement;
    const done = (answer: boolean) => {
      document.removeEventListener("keydown", onKey, true);
      scrim.remove();
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      resolve(answer);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        done(false);
      } else if (event.key === "Tab") {
        // Keep focus inside the dialog.
        const stops = Array.from(
          scrim.querySelectorAll<HTMLElement>("button, input"),
        );
        const i = stops.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey ? i - 1 : i + 1;
        event.preventDefault();
        stops[(next + stops.length) % stops.length]?.focus();
      }
    };
    scrim.addEventListener("click", (event) => {
      const t = event.target as Element;
      if (t === scrim || t.closest("[data-ui-cancel]")) done(false);
      else if (t.closest("[data-ui-confirm-ok]")) done(true);
    });
    document.addEventListener("keydown", onKey, true);
    document.body.append(scrim);
    scrim.querySelector<HTMLElement>("[data-ui-confirm-ok]")?.focus();
  });
}
