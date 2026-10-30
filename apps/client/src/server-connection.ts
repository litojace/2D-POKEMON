import { ServerStartup, type StartupStatus } from "./server-startup";

let retry: (() => void) | undefined;
let panel: HTMLElement | undefined;
let reveal: ReturnType<typeof setTimeout> | undefined;
let currentStatus: StartupStatus = "connecting";
let progressTimer: ReturnType<typeof setInterval> | undefined;
let dismiss: ReturnType<typeof setTimeout> | undefined;
let activeMs = 0;
let lastTick = performance.now();

function updateProgress() {
  const now = performance.now();
  if (currentStatus === "connecting" || currentStatus === "waiting")
    activeMs += now - lastTick;
  lastTick = now;
  const meter = panel?.querySelector<HTMLElement>(".server-startup-progress");
  if (!meter) return;
  // Render exposes readiness, not a boot percentage. Ease an estimated bar
  // toward 92%; only a successful health response is allowed to complete it.
  const amount =
    currentStatus === "ready"
      ? 1
      : 0.08 + 0.84 * (1 - Math.exp(-activeMs / 24_000));
  meter.style.setProperty("--startup-progress", String(amount));
  meter.setAttribute(
    "aria-valuetext",
    currentStatus === "ready"
      ? "Connected"
      : currentStatus === "offline"
        ? "Waiting for your connection"
        : currentStatus === "failed"
          ? "Connection paused. Try again."
          : "Waiting for the game server",
  );
  if (currentStatus === "ready") meter.setAttribute("aria-valuenow", "100");
  else meter.removeAttribute("aria-valuenow");
}

function syncProgressTimer() {
  clearInterval(progressTimer);
  progressTimer = undefined;
  if (panel && (currentStatus === "connecting" || currentStatus === "waiting"))
    progressTimer = setInterval(updateProgress, 250);
}

function showStatus(status: StartupStatus) {
  updateProgress();
  if (
    (currentStatus === "failed" || currentStatus === "ready") &&
    status !== currentStatus
  )
    activeMs = 0;
  currentStatus = status;
  clearTimeout(dismiss);
  dismiss = undefined;
  if (status === "ready") {
    clearTimeout(reveal);
    reveal = undefined;
    syncProgressTimer();
    if (panel) {
      panel.dataset.status = status;
      panel.querySelector("p")!.textContent = "Connected. Entering the arena…";
      updateProgress();
      // Let the fill reach the end before revealing the already-ready game.
      dismiss = setTimeout(() => {
        panel?.remove();
        panel = undefined;
        dismiss = undefined;
      }, 500);
    }
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
    panel.innerHTML = `<div class="server-startup-card"><div class="server-startup-art" aria-hidden="true"><span class="server-startup-ring"></span><span class="server-startup-crystal"></span><i></i><i></i><i></i></div><span class="server-startup-brand">ELEMENT ARENA</span><h1>Opening the arena</h1><p role="status" aria-live="polite"></p><div class="server-startup-progress" role="progressbar" aria-label="Game server connection" aria-valuemin="0" aria-valuemax="100"><i></i></div><button type="button" hidden>Try again</button></div>`;
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
  const message = panel.querySelector("p")!;
  if (message.textContent !== copy[status]) message.textContent = copy[status];
  panel.querySelector("button")!.hidden = status !== "failed";
  panel.dataset.status = status;
  updateProgress();
  syncProgressTimer();
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
