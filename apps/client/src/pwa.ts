import { registerSW } from "virtual:pwa-register";
import { safeToUpdate, peerMatchActive } from "./pwa-policy";
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
    notify("Pokémon Arena installed. Open it from your home screen.");
  });
  document.getElementById("install-app")!.onclick = async () => {
    if (install) {
      const prompt = install;
      await prompt.prompt();
      await prompt.userChoice;
      install = undefined;
      return;
    }
    const standalone =
      matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone;
    openDialog(
      standalone
        ? "<h2>Your arena is installed.</h2><p>You are already playing in standalone mode.</p>"
        : "<h2>Install Pokémon Arena</h2><p><b>iPhone / iPad:</b> Open this site in Safari, tap Share, then Add to Home Screen and Add.</p><p><b>Android:</b> Open in Chrome and choose Install app or Add to Home screen from the browser menu.</p><p>Installation needs HTTPS and a supported browser. Online battles still need internet access.</p>",
    );
  };
  window.addEventListener("offline", () =>
    notify(
      "You are offline. Live battles require a connection; the game will try to reconnect.",
    ),
  );
  return { sync: heartbeat };
}
