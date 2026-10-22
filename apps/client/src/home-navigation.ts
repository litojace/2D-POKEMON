import { firstPad, type PadLike } from "./gamepad";

const focusable = (root: ParentNode) =>
  Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]',
    ),
  ).filter(
    (el) => el.getClientRects().length && !el.closest("[hidden], [inert]"),
  );

/** Presentation-only navigation. The battle controller bindings remain unchanged. */
export function setupHomeNavigation(menu: HTMLElement, settings: () => void) {
  let panel: "fighters" | "play" | undefined;
  let returnFocus: HTMLElement | undefined;
  const modes = () => menu.querySelector<HTMLElement>("#home-modes");
  const drawer = () =>
    menu.querySelector<HTMLElement>(
      panel === "fighters" ? "#home-fighter-panel" : "#home-play-panel",
    );
  function closeModes() {
    const list = modes();
    if (list) list.hidden = true;
    menu
      .querySelector("#home-mode-toggle")
      ?.setAttribute("aria-expanded", "false");
  }
  function backFromFighterDetails() {
    const filters = menu.querySelector<HTMLElement>(
      ".roster-panel.is-filter-open",
    );
    if (filters && !filters.closest("[hidden], [inert]")) {
      filters
        .querySelector<HTMLButtonElement>("[data-champion-filter-toggle]")
        ?.click();
      return true;
    }
    const detail = menu.querySelector<HTMLElement>(".fighter-detail");
    if (!detail || detail.closest("[hidden], [inert]")) return false;
    if (detail?.dataset.preview === "skills") {
      detail
        .querySelector<HTMLButtonElement>('[data-fighter-preview="overview"]')
        ?.click();
      return true;
    }
    if (detail?.dataset.inspection) {
      detail.querySelector<HTMLButtonElement>("[data-skill-close]")?.click();
      return true;
    }
    return false;
  }
  function refresh() {
    if (!menu.querySelector(".home-screen")) {
      panel = undefined;
      return;
    }
    for (const [kind, id] of [
      ["fighters", "home-fighter-panel"],
      ["play", "home-play-panel"],
    ] as const) {
      const el = menu.querySelector<HTMLElement>(`#${id}`);
      if (el) el.hidden = panel !== kind;
    }
    const scrim = menu.querySelector<HTMLElement>(".home-panel-scrim");
    if (scrim) scrim.hidden = !panel;
    const scene = menu.querySelector<HTMLElement>(".home-scene");
    if (scene) scene.inert = !!panel;
    const rail = menu.querySelector<HTMLElement>(".home-rail");
    if (rail) rail.inert = !!panel;
    for (const b of Array.from(
      menu.querySelectorAll<HTMLElement>(".home-rail-item"),
    )) {
      const active =
        panel === "fighters"
          ? b.dataset.homeOpen === "fighters"
          : b.dataset.homeNav === "play";
      b.classList.toggle("is-active", active);
      if (active) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    }
  }
  function open(kind: "fighters" | "play", source?: HTMLElement) {
    returnFocus = source ?? (document.activeElement as HTMLElement);
    closeModes();
    panel = kind;
    refresh();
    requestAnimationFrame(() => {
      const d = drawer();
      if (!d) return;
      // Measure the roster only after its drawer is visible.
      window.dispatchEvent(new Event("resize"));
      (
        d.querySelector<HTMLElement>(
          kind === "fighters" ? ".creature-card.selected" : "#code",
        ) ?? d
      ).focus({ preventScroll: true });
    });
  }
  function close() {
    if (panel) {
      panel = undefined;
      refresh();
      const target = returnFocus?.isConnected
        ? returnFocus
        : menu.querySelector<HTMLElement>('[data-home-nav="play"]');
      target?.focus({ preventScroll: true });
    } else if (modes()?.hidden === false) {
      closeModes();
      menu
        .querySelector<HTMLElement>("#home-mode-toggle")
        ?.focus({ preventScroll: true });
    }
  }
  menu.addEventListener("click", (event) => {
    const target = (event.target as Element).closest<HTMLElement>("button");
    if (!target) return;
    if (target.hasAttribute("data-home-close")) close();
    else if (target.dataset.homeOpen)
      open(target.dataset.homeOpen as "fighters" | "play", target);
    else if (target.dataset.homeNav === "play") {
      close();
      menu
        .querySelector<HTMLElement>("#create")
        ?.focus({ preventScroll: true });
    } else if (target.id === "home-mode-toggle") {
      const list = modes();
      if (!list) return;
      list.hidden = !list.hidden;
      target.setAttribute("aria-expanded", String(!list.hidden));
      if (!list.hidden)
        list
          .querySelector<HTMLElement>('[aria-checked="true"]')
          ?.focus({ preventScroll: true });
    } else if (target.matches("[data-mode]")) {
      closeModes();
      menu
        .querySelector<HTMLElement>("#home-mode-toggle")
        ?.focus({ preventScroll: true });
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!(event.target as Element).closest(".home-mode-wrap")) closeModes();
  });
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        (!document.body.classList.contains("home-active") &&
          !document.body.classList.contains("lobby-active")) ||
        document.querySelector<HTMLDialogElement>("#dialog")?.open
      )
        return;
      if (event.key === "Escape" && backFromFighterDetails()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.key === "Escape" && (panel || modes()?.hidden === false)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      } else if (event.key === "Tab" && panel) {
        const all = focusable(drawer()!);
        const i = all.indexOf(document.activeElement as HTMLElement);
        if (event.shiftKey && i <= 0) {
          event.preventDefault();
          all.at(-1)?.focus();
        } else if (!event.shiftKey && (i === all.length - 1 || i < 0)) {
          event.preventDefault();
          all[0]?.focus();
        }
      } else if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
          event.key,
        ) &&
        (event.target as Element).matches("[data-mode]")
      ) {
        const all = Array.from(
          modes()!.querySelectorAll<HTMLButtonElement>("[data-mode]"),
        );
        const i = all.indexOf(event.target as HTMLButtonElement);
        event.preventDefault();
        all[
          (i +
            (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) +
            all.length) %
            all.length
        ].focus();
      }
    },
    true,
  );

  // Home runs while the hidden Phaser canvas sleeps. A small UI-only loop gives
  // controller users the same focusable controls as keyboard and touch users.
  const menuVisible = () =>
    document.body.classList.contains("home-active") ||
    document.body.classList.contains("lobby-active");
  let frame = 0,
    lastDirection = 0,
    lastStep = 0,
    previous = new Set<number>();
  const down = (pad: PadLike, n: number) =>
    !!pad.buttons[n] && (pad.buttons[n].pressed || pad.buttons[n].value > 0.5);
  function poll(time: number) {
    frame = 0;
    if (!menuVisible() || document.hidden) return;
    const pad = firstPad();
    if (pad) {
      const pressed = new Set([0, 1, 9].filter((i) => down(pad, i)));
      const scroller = (
        document.activeElement as HTMLElement | null
      )?.closest<HTMLElement>(
        ".skill-preview, .selected-info, .fighter-preview-slot, .lobby-room-content, .showcase-roster",
      );
      if (scroller && Math.abs(pad.axes[3] ?? 0) > 0.25)
        scroller.scrollBy({ top: pad.axes[3] * 10, behavior: "instant" });
      const d =
        down(pad, 12) || pad.axes[1] < -0.55
          ? -1
          : down(pad, 13) || pad.axes[1] > 0.55
            ? 1
            : down(pad, 14) || pad.axes[0] < -0.55
              ? -1
              : down(pad, 15) || pad.axes[0] > 0.55
                ? 1
                : 0;
      const dialog = document.querySelector<HTMLDialogElement>("#dialog");
      const header = document.querySelector<HTMLDetailsElement>("#header-menu");
      const scope = dialog?.open
        ? dialog
        : panel
          ? drawer()!
          : header?.open
            ? header
            : document;
      if (d && (d !== lastDirection || time - lastStep > 240)) {
        const all = focusable(scope),
          i = all.indexOf(document.activeElement as HTMLElement);
        all[i < 0 ? 0 : (i + d + all.length) % all.length]?.focus({
          preventScroll: false,
        });
        lastStep = time;
      }
      if (pressed.has(0) && !previous.has(0)) {
        const active = document.activeElement as HTMLElement;
        if (focusable(scope).includes(active)) active.click();
        else menu.querySelector<HTMLElement>("#create, #ready")?.focus();
      }
      if (pressed.has(1) && !previous.has(1)) {
        if (dialog?.open)
          dialog.querySelector<HTMLButtonElement>("#close-dialog")?.click();
        else if (header?.open) header.open = false;
        else if (!backFromFighterDetails()) close();
      }
      if (pressed.has(9) && !previous.has(9)) {
        if (dialog?.open)
          dialog.querySelector<HTMLButtonElement>("#close-dialog")?.click();
        else settings();
      }
      previous = pressed;
      lastDirection = d;
    } else {
      previous.clear();
      lastDirection = 0;
    }
    frame = requestAnimationFrame(poll);
  }
  function syncLoop() {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    if (menuVisible() && !document.hidden) frame = requestAnimationFrame(poll);
    else {
      previous.clear();
      lastDirection = 0;
    }
  }
  new MutationObserver(syncLoop).observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  document.addEventListener("visibilitychange", syncLoop);
  return { open, close, refresh };
}
