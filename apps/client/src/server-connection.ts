import { ServerStartup, type StartupStatus } from "./server-startup";

let retry: (() => void) | undefined;
let panel: HTMLElement | undefined;
let reveal: ReturnType<typeof setTimeout> | undefined;
let currentStatus: StartupStatus = "connecting";

function showStatus(status: StartupStatus) {
  currentStatus = status;
  if (status === "ready") {
    clearTimeout(reveal);
    reveal = undefined;
    panel?.remove();
    panel = undefined;
    return;
  }
  // Warm servers should enter directly, without a flash of a loading screen.
  if (!panel && !reveal) {
    reveal = setTimeout(() => renderStatus(), 250);
    return;
  }
  if (panel) renderStatus();
}

function renderStatus() {
  const status = currentStatus;
  if (status === "ready") return;
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "server-startup";
    panel.className = "server-startup";
    panel.setAttribute("aria-label", "Connecting to Element Arena");
    panel.innerHTML = `<div class="server-startup-card"><div class="server-startup-art" aria-hidden="true"><span class="server-startup-ring"></span><span class="server-startup-crystal"></span><i></i><i></i><i></i></div><span class="server-startup-brand">ELEMENT ARENA</span><h1>Opening the arena</h1><p role="status" aria-live="polite"></p><span class="server-startup-dots" aria-hidden="true"><i></i><i></i><i></i></span><button type="button" hidden>Try again</button></div>`;
    panel.querySelector("button")!.onclick = () => retry?.();
    document.body.append(panel);
  }
  const copy = {
    connecting: "Connecting to the game server…",
    waiting:
      "The server is waking up. You’ll enter automatically when it’s ready.",
    offline: "You’re offline. We’ll reconnect when your connection returns.",
    failed:
      "Connection is taking longer than expected. Check your connection and try again.",
  };
  panel.querySelector("p")!.textContent = copy[status];
  panel.querySelector("button")!.hidden = status !== "failed";
  panel.dataset.status = status;
}

const startup = new ServerStartup(
  async (signal) => {
    const origin = import.meta.env.VITE_SERVER_URL || location.origin;
    const response = await fetch(new URL("/api/health", origin), {
      signal,
      cache: "no-store",
      credentials: "omit",
    });
    return response.ok && (await response.json()).ok === true;
  },
  showStatus,
  () => navigator.onLine,
);

/** On-demand startup/auth only. No recurring keep-alive pings during play. */
export const waitForServer = () => startup.wait();
export function onServerStartupRetry(handler: () => void) {
  retry = handler;
}
