import { PwaAutoUpdate } from "./pwa-auto-update";
import { lockLandscape } from "./orientation";
import { registerSW } from "virtual:pwa-register";
import { safeToUpdate, peerMatchActive } from "./pwa-policy";
import { fullscreenHelp, fullscreenPlatform } from "./fullscreen-help";
import { isNativeApp } from "./native";
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function setupPWA(
  getPhase: () => string | undefined,
  openDialog: (html: string) => void,
  notify: (text: string) => void,
) {
  // The iPhone app updates through the App Store: no worker, no banner.
  if (isNativeApp()) return { sync() {}, serverUpdating() {} };
  let install: InstallPrompt | undefined;
  let registration: ServiceWorkerRegistration | undefined;
  let lastCheck = 0;
  let checking = false;
  const id = "arena-pwa-tab-" + crypto.randomUUID();
  const banner = document.createElement("aside");
  banner.id = "pwa-banner";
  banner.hidden = true;
  // Asks before updating (docs/mobile-pwa.md): Update now, or Later.
  banner.innerHTML =
    '<span role="status"></span><div class="pwa-actions" hidden><button type="button" class="primary" id="pwa-update-now">Update now</button><button type="button" class="secondary" id="pwa-update-later">Later</button></div>';
  document.body.append(banner);
  const message = banner.querySelector("span")!;
  const actions = banner.querySelector<HTMLElement>(".pwa-actions")!;
  // The first ask fills the screen like the round countdown; after Later,
  // the banner above asks instead (docs/mobile-pwa.md).
  const takeover = document.createElement("div");
  takeover.id = "pwa-takeover";
  takeover.hidden = true;
  takeover.setAttribute("role", "dialog");
  takeover.setAttribute("aria-modal", "true");
  takeover.setAttribute("aria-labelledby", "pwa-takeover-title");
  takeover.innerHTML =
    '<div class="pwa-takeover-inner"><div class="eyebrow">Update ready</div><h2 id="pwa-takeover-title">New version</h2><p>Updating takes a few seconds. Your coins and progress stay.</p><div class="pwa-takeover-actions"><button type="button" class="primary" id="pwa-takeover-now">Update now</button><button type="button" class="secondary pwa-takeover-later" id="pwa-takeover-later">Later</button></div></div>';
  document.body.append(takeover);

  const peers = () => {
    const records: Array<{ active: boolean; at: number }> = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (!key.startsWith("arena-pwa-tab-") || key === id) continue;
        const value = JSON.parse(localStorage.getItem(key)!);
        if (typeof value.active === "boolean" && typeof value.at === "number")
          records.push(value);
      }
    } catch {
      /* Current-tab protection remains available without storage. */
    }
    return peerMatchActive(records, Date.now());
  };
  // A dialog, or a hub screen opened inside the Lobby (ui/hub-panel.ts);
  // not one parked for its next open (the Shop, closed but kept).
  const menuOpen = () =>
    !!document.querySelector(
      "dialog[open], .ui-panel-host:not([data-ui-parked])",
    );
  const idle = () =>
    safeToUpdate(getPhase(), menuOpen()) &&
    !peers() &&
    document.visibilityState === "visible" &&
    navigator.onLine;
  const automatic = new PwaAutoUpdate({
    safe: idle,
    activate: () => apply(true),
    reload: () => location.reload(),
    now: () => Date.now(),
  });
  const checkForUpdate = async (soon = false) => {
    if (
      !registration ||
      checking ||
      !navigator.onLine ||
      (!soon && document.visibilityState !== "visible") ||
      Date.now() - lastCheck < 5000
    )
      return;
    lastCheck = Date.now();
    checking = true;
    try {
      await registration.update();
    } catch {
      /* Offline, or deployment is still starting: check again later. */
    } finally {
      checking = false;
    }
  };
  const paint = () => {
    const asking = automatic.asking,
      full = automatic.fullScreen,
      safe = idle();
    if (takeover.hidden === full) {
      takeover.hidden = !full;
      if (full)
        takeover.querySelector<HTMLButtonElement>("#pwa-takeover-now")!.focus();
    }
    // "Later" hides it until the snooze ends; a match only gets a quiet note.
    banner.hidden =
      full || !automatic.pending || (safe && !asking && !automatic.accepted);
    actions.hidden = !asking;
    if (!banner.hidden) {
      const text = automatic.accepted
        ? safe
          ? "Updating to the latest arena version…"
          : "Update accepted · applies after closing menus and returning to the Lobby or the Plaza."
        : asking
          ? "New version ready. Updating takes a few seconds."
          : !document.body.classList.contains("battle-active")
            ? "Update ready · you can install it after closing menus and returning to the Lobby or the Plaza."
            : document.body.classList.contains("practice-active")
              ? "Update after practice"
              : "Update after this match";
      if (message.textContent !== text) message.textContent = text;
    }
    void automatic.sync();
  };
  const updateNow = () => {
    void automatic.accept().finally(paint);
    paint();
  };
  const later = () => {
    automatic.later();
    paint();
  };
  actions.querySelector<HTMLButtonElement>("#pwa-update-now")!.onclick =
    updateNow;
  actions.querySelector<HTMLButtonElement>("#pwa-update-later")!.onclick =
    later;
  takeover.querySelector<HTMLButtonElement>("#pwa-takeover-now")!.onclick =
    updateNow;
  takeover.querySelector<HTMLButtonElement>("#pwa-takeover-later")!.onclick =
    later;
  takeover.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      later();
    }
  });
  let lastBeat = 0,
    lastMenuOpen = false,
    lastPhase: string | undefined;
  const heartbeat = () => {
    const now = Date.now();
    const open = menuOpen();
    if (
      lastPhase === getPhase() &&
      lastMenuOpen === open &&
      now - lastBeat < 9000
    )
      return;
    lastPhase = getPhase();
    lastMenuOpen = open;
    lastBeat = now;
    try {
      localStorage.setItem(
        id,
        JSON.stringify({
          active: !safeToUpdate(getPhase(), open),
          at: Date.now(),
        }),
      );
    } catch {
      /* Storage is optional. */
    }
    paint();
  };
  const apply = registerSW({
    immediate: true,
    onRegisteredSW(_url, current) {
      registration = current;
      void checkForUpdate();
    },
    onNeedRefresh() {
      automatic.available();
      paint();
    },
    onNeedReload() {
      automatic.activated();
      paint();
    },
    onRegisterError() {
      notify(
        "App installation is unavailable right now. Browser play still works.",
      );
    },
  });
  heartbeat();
  const dialog = document.getElementById("dialog");
  if (dialog)
    new MutationObserver(heartbeat).observe(dialog, {
      attributes: true,
      attributeFilter: ["open"],
    });
  document.addEventListener("ui-panel-change", heartbeat);
  setInterval(heartbeat, 10000);
  window.addEventListener("storage", paint);
  setInterval(() => void checkForUpdate(), 60000);
  const resume = () => {
    heartbeat();
    paint();
    void checkForUpdate();
  };
  window.addEventListener("pageshow", resume);
  window.addEventListener("focus", resume);
  window.addEventListener("online", resume);
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("pagehide", () => {
    try {
      localStorage.removeItem(id);
    } catch {
      /* optional */
    }
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    install = event as InstallPrompt;
  });
  window.addEventListener("appinstalled", () => {
    install = undefined;
    notify("Element Arena installed. Open it from your home screen.");
  });
  document.getElementById("install-app")!.onclick = () => {
    const nav = navigator as Navigator & { standalone?: boolean };
    const standalone =
      matchMedia("(display-mode: standalone)").matches ||
      matchMedia("(display-mode: fullscreen)").matches ||
      nav.standalone === true;
    const platform = fullscreenPlatform(
      navigator.userAgent,
      navigator.maxTouchPoints,
    );
    const canFullscreen =
      !!document.documentElement.requestFullscreen && platform !== "iphone";
    openDialog(
      fullscreenHelp({
        standalone,
        platform,
        canPrompt: !!install,
        canFullscreen,
      }),
    );
    const dialog = document.getElementById("dialog")!;
    // The close button also resets the game's "menu open" input guard.
    const closeDialog = () =>
      dialog.querySelector<HTMLButtonElement>("#close-dialog")?.click();
    const promptButton = dialog.querySelector<HTMLButtonElement>(
      "#fullscreen-install",
    );
    if (promptButton)
      promptButton.onclick = async () => {
        const prompt = install;
        if (!prompt) return;
        install = undefined;
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        closeDialog();
        if (outcome !== "accepted")
          notify("No problem. You can add it to your home screen any time.");
      };
    const nowButton =
      dialog.querySelector<HTMLButtonElement>("#fullscreen-now");
    if (nowButton)
      nowButton.onclick = async () => {
        closeDialog();
        try {
          await document.documentElement.requestFullscreen();
          await lockLandscape();
        } catch {
          notify(
            "This browser blocked fullscreen. Add the game to your home screen instead.",
          );
        }
      };
  };
  window.addEventListener("offline", () =>
    notify(
      "You are offline. Live battles require a connection; the game will try to reconnect.",
    ),
  );
  return {
    sync: heartbeat,
    /**
     * The server said a deploy is replacing it (docs/server-updates.md): the
     * new client is probably out already, so look for it now, and the prompt
     * is ready the moment the match ends.
     */
    serverUpdating() {
      lastCheck = 0;
      void checkForUpdate(true);
    },
  };
}
