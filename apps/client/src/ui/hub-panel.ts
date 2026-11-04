import { lowGraphics } from "../graphics-quality";
import { confirmModal, type ConfirmOptions } from "./components";
import { enter, fadeIn, glide, leave, stagger } from "./motion";

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
let current:
  { panel: HubPanel; close: (replaced?: boolean) => void } | undefined;
/** Lobby parts a screen that was replaced still covers, for the next one. */
let handoff: HTMLElement[] = [];
/** What a screen's contents are: they arrive one after another. */
const ITEMS =
  ".ui-tabs, .ui-panel-body [data-ui-item], .ui-panel-body .ui-row, .ui-panel-body .ui-tile, .ui-panel-foot";
const items = (root: HTMLElement) => {
  const found = Array.from(root.querySelectorAll(ITEMS));
  return found.length > 1
    ? found
    : Array.from(root.querySelectorAll(".ui-panel-body > *, .ui-panel-foot"));
};
/** The selected tab(s), to tell a tab switch from a refresh. */
const selectedTabs = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('[role="tab"][aria-selected="true"]'))
    .map((t) => t.outerHTML.match(/data-ui-[\w-]+="[^"]*"/)?.[0] ?? "")
    .join("|");
const uncover = (el: HTMLElement) => {
  el.inert = false;
  delete el.dataset.uiCovered;
};

export const openHubPanelNow = () => current?.panel;
/** Fired on document when a hub screen opens or closes (the PWA updater waits for none). */
export const PANEL_EVENT = "ui-panel-change";

export function openHubPanel(html: string, o: HubPanelOptions = {}): HubPanel {
  current?.close(true);
  const host =
    o.host ??
    document.querySelector<HTMLElement>(".lobby-layer") ??
    document.body;
  const returnFocus = document.activeElement as HTMLElement | null;
  const wrap = document.createElement("div");
  wrap.className = "ui-panel-host";
  let covered: HTMLElement[] = handoff;
  handoff = [];
  let closed = false;
  // The Lobby's stage (fighter, party, nameplate) and the emotes under it
  // glide to their new place when a sheet opens or closes.
  const gliders = () =>
    [
      {
        el: host.querySelector<HTMLElement>(":scope > .lobby-stage")!,
        anchor: host.querySelector<HTMLElement>("#lobby-fighter"),
        scale: true,
      },
      { el: host.querySelector<HTMLElement>(":scope > .lobby-emotes")! },
    ].filter((t) => t.el);

  const mount = (markup: string) => {
    wrap.innerHTML = markup;
    const root = wrap.firstElementChild as HTMLElement | null;
    if (!root?.classList.contains("ui-panel"))
      throw new Error("openHubPanel expects markup from panel()");
    root.dataset.graphics = lowGraphics() ? "low" : "high";
    // A sheet leaves the Lobby usable; a panel covers it: the parts behind
    // leave the tab order and stop drawing (nothing peeks out at the edges).
    const sheet = root.classList.contains("ui-sheet"),
      before = covered;
    const apply = () => {
      for (const el of before) uncover(el);
      // The Lobby re-centres its stage beside a sheet (ui/components.css).
      host.toggleAttribute("data-ui-sheet", sheet);
      covered = sheet
        ? []
        : COVERED.flatMap((s) =>
            Array.from(host.querySelectorAll<HTMLElement>(`:scope ${s}`)),
          );
      for (const el of covered) {
        el.inert = true;
        el.dataset.uiCovered = "";
      }
    };
    if (host.hasAttribute("data-ui-sheet") !== sheet) glide(gliders(), apply);
    else apply();
    // Lobby parts that come back into view (a panel gave way to a sheet).
    fadeIn(before.filter((el) => !covered.includes(el)));
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
  /** `replaced`: another screen opens in its place, so the Lobby stays as
   * it is and the next screen takes it from there. */
  function close(replaced = false) {
    if (closed) return;
    closed = true;
    gone?.disconnect();
    document.removeEventListener("keydown", onKey);
    if (replaced) handoff = covered;
    else {
      const back = covered;
      for (const el of back) uncover(el);
      if (host.hasAttribute("data-ui-sheet"))
        glide(gliders(), () => host.removeAttribute("data-ui-sheet"));
      fadeIn(back);
    }
    railButton?.removeAttribute("aria-current");
    // The screen slides away and fades; it's already out of reach.
    wrap.inert = true;
    wrap.style.pointerEvents = "none";
    wrap.querySelectorAll<HTMLElement>(".ui-panel").forEach((el) => {
      el.style.pointerEvents = "none";
      // Leaving: what looks for open screens passes over it.
      el.dataset.uiLeaving = "";
    });
    void leave(root, {
      opacity: 0,
      transform: root.classList.contains("ui-sheet")
        ? "translateX(-28px)"
        : "translateX(-16px) scale(.99)",
    }).then(() => wrap.remove());
    if (current?.panel === panel) current = undefined;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    document.dispatchEvent(new Event(PANEL_EVENT));
    o.onClose?.();
  }

  let root = mount(html);
  host.append(wrap);
  // The Lobby leaves the page (Plaza, Farm, a match): its screen closes too,
  // so nothing keeps listening or drawing out of sight.
  const gone =
    host !== document.body && host.parentNode
      ? new MutationObserver(() => {
          if (!host.isConnected) close();
        })
      : undefined;
  if (gone && host.parentNode)
    gone.observe(host.parentNode, { childList: true });
  railButton?.setAttribute("aria-current", "page");
  wrap.addEventListener("click", onClick);
  // Bubble phase: menus inside the Lobby close first and mark it handled.
  document.addEventListener("keydown", onKey);
  // Focus moves into the screen (keyboard and screen readers start there);
  // Tab then reaches its tabs and buttons.
  root.tabIndex = -1;
  root.focus({ preventScroll: true });
  // In from the rail: a sheet slides further, a panel also grows a touch;
  // then its contents arrive one after another.
  enter(root, {
    opacity: 0,
    transform: root.classList.contains("ui-sheet")
      ? "translateX(-36px)"
      : "translateX(-24px) scale(.985)",
  });
  stagger(items(root));

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
      const tabs = selectedTabs(root);
      root = mount(markup);
      root.tabIndex = -1;
      // Another tab: its contents arrive like the screen's did.
      if (tabs && selectedTabs(root) !== tabs)
        stagger(items(root), { delay: 0, rise: 8 });
      if (key)
        root.querySelector<HTMLElement>(key)?.focus({ preventScroll: true });
    },
    close,
  };
  current = { panel, close };
  document.dispatchEvent(new Event(PANEL_EVENT));
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
      // The answer counts at once; the dialog then fades and sinks away.
      scrim.removeAttribute("data-ui-confirm");
      scrim.style.pointerEvents = "none";
      const modal = scrim.querySelector(".ui-modal");
      void Promise.all([
        leave(scrim, { opacity: 0 }),
        modal &&
          leave(modal, {
            opacity: 0,
            transform: "translateY(10px) scale(.97)",
          }),
      ]).then(() => scrim.remove());
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
    // The backdrop fades in and the dialog pops up from just below.
    fadeIn([scrim]);
    const modal = scrim.querySelector(".ui-modal");
    if (modal)
      enter(modal, { opacity: 0, transform: "translateY(14px) scale(.95)" });
    scrim.querySelector<HTMLElement>("[data-ui-confirm-ok]")?.focus();
  });
}
