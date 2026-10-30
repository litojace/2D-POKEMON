import { ServerStartup, type StartupStatus } from "./server-startup";
import starfield from "./art/startup-starfield.webp";
import sigil from "./art/startup-sigil.webp";
import "./server-connection.css";

/** Centered paths keep their shape while the crest floats and their light pulses. */
const orbitPaths = [
  { rx: 185, ry: 48, angle: -18 },
  { rx: 171, ry: 65, angle: 24 },
  { rx: 110, ry: 140, angle: 14 },
];
const orbits = `<svg class="server-startup-orbits" viewBox="0 0 320 320" aria-hidden="true" focusable="false">${orbitPaths.map(({ rx, ry, angle }, index) => `<g transform="rotate(${angle} 160 160)" style="--orbit-duration:${6 + index * 2}s;--orbit-delay:${-index * 2}s"><ellipse class="server-startup-orbit" cx="160" cy="160" rx="${rx}" ry="${ry}"/></g>`).join("")}</svg>`;

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
  // Pace the estimate across the typical one-minute cold start. Hold at 92%
  // if it takes longer; only a successful health response may complete it.
  const amount =
    currentStatus === "ready"
      ? 1
      : 0.08 + 0.84 * Math.min(activeMs / 60_000, 1);
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
    panel.style.setProperty("--startup-backdrop", `url("${starfield}")`);
    panel.innerHTML = `<div class="server-startup-card"><header class="server-startup-brand"><h1 aria-label="Element Arena"><span aria-hidden="true">ELEMENT</span><span aria-hidden="true">ARENA</span></h1><span class="server-startup-divider" aria-hidden="true"></span></header><div class="server-startup-scene" aria-hidden="true"><div class="server-startup-art"><span class="server-startup-aura"></span>${orbits}<img src="${sigil}" width="1254" height="1254" alt="" decoding="async" draggable="false"><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="server-startup-loading"><h2>Opening the arena…</h2><div class="server-startup-progress" role="progressbar" aria-label="Game server connection" aria-valuemin="0" aria-valuemax="100"><i></i></div><p role="status" aria-live="polite"></p><button type="button" hidden>Try again</button></div></div>`;
    const emblem = panel.querySelector("img")!;
    emblem.addEventListener(
      "error",
      () => {
        emblem.hidden = true;
      },
      { once: true },
    );
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
