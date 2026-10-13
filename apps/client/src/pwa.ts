import { lockLandscape } from "./orientation";
import { registerSW } from "virtual:pwa-register";
import { safeToUpdate, peerMatchActive } from "./pwa-policy";
import { fullscreenHelp, fullscreenPlatform } from "./fullscreen-help";
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function setupPWA(
  getPhase: () => string | undefined,
  openDialog: (html: string) => void,
  notify: (text: string) => void,
) {
  let install: InstallPrompt | undefined,
    waiting = false,
    reloadReady = false;
  const id = "arena-pwa-tab-" + crypto.randomUUID();
  const banner = document.createElement("aside");
  banner.id = "pwa-banner";
  banner.hidden = true;
  banner.innerHTML =
    '<span></span><button class="secondary">Update app</button>';
  document.body.append(banner);
  const message = banner.querySelector("span")!;
  const update = banner.querySelector("button")!;
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
  const idle = () => safeToUpdate(getPhase()) && !peers();
  const paint = () => {
    banner.hidden = !waiting && !reloadReady;
    if (!banner.hidden) {
      const ready = idle();
      message.textContent = ready
        ? "A new arena version is ready."
        : "Update ready · available after the match.";
      update.disabled = !ready;
      update.textContent = reloadReady ? "Reload app" : "Update app";
    }
  };
  let lastBeat = 0,
    lastPhase: string | undefined;
  const heartbeat = () => {
    const now = Date.now();
    if (lastPhase === getPhase() && now - lastBeat < 9000) return;
    lastPhase = getPhase();
    lastBeat = now;
    try {
      localStorage.setItem(
        id,
        JSON.stringify({ active: !safeToUpdate(getPhase()), at: Date.now() }),
      );
    } catch {
      /* Storage is optional. */
    }
    paint();
  };
  const apply = registerSW({
    onNeedRefresh() {
      waiting = true;
      paint();
    },
    onNeedReload() {
      reloadReady = true;
      waiting = false;
      paint();
    },
    onRegisterError() {
      notify(
        "App installation is unavailable right now. Browser play still works.",
      );
    },
  });
  update.onclick = () => {
    if (!idle()) return;
    if (reloadReady) location.reload();
    else void apply(true);
  };
  heartbeat();
  setInterval(heartbeat, 10000);
  window.addEventListener("storage", paint);
  window.addEventListener("pageshow", heartbeat);
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
  return { sync: heartbeat };
}
