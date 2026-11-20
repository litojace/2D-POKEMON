import { ServerStartup, type StartupStatus } from "./server-startup";
import starfield from "./art/startup-starfield.webp";
import sigil from "./art/startup-sigil.webp";
import "./server-connection.css";
import type { LoadingArt } from "./loading-art";

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
/**
 * The startup curtain (loading-curtain notes in docs/loading-screens.md):
 * from the first frame this panel covers the game until the first screen is
 * complete (profile, skins, fighter, connection, artwork), so a player never
 * watches the hub fill in. While held, a healthy server no longer removes it:
 * the game's own steps advance the bar and releaseStartupCurtain() ends it.
 */
let held: { floor: number; message: string } | undefined;
/** The bar never moves backwards while the curtain is held. */
let shownProgress = 0;
let leaving: ReturnType<typeof setTimeout> | undefined;

function updateProgress() {
  const now = performance.now();
  if (currentStatus === "connecting" || currentStatus === "waiting")
    activeMs += now - lastTick;
  lastTick = now;
  const meter = panel?.querySelector<HTMLElement>(".server-startup-progress");
  if (!meter) return;
  // Pace the estimate across the typical one-minute cold start. Hold at 92%
  // if it takes longer; only a successful health response may complete it.
  // Held for startup, the server is only the first third of the bar: the
  // profile, the connection and the artwork fill the rest (curtainStep).
  const server = held ? 0.3 : 0.92;
  const amount = !held
    ? currentStatus === "ready"
      ? 1
      : 0.08 + 0.84 * Math.min(activeMs / 60_000, 1)
    : Math.max(
        shownProgress,
        held.floor,
        currentStatus === "ready"
          ? server
          : 0.04 + (server - 0.04) * Math.min(activeMs / 60_000, 1),
      );
  if (held) shownProgress = amount;
  meter.style.setProperty("--startup-progress", String(amount));
  meter.setAttribute(
    "aria-valuetext",
    held && currentStatus === "ready"
      ? held.message
      : currentStatus === "ready"
        ? "Connected"
        : currentStatus === "offline"
          ? "Waiting for your connection"
          : currentStatus === "failed"
            ? "Connection paused. Try again."
            : "Waiting for the game server",
  );
  // Waiting on the server is open-ended (no value); once it answers, the
  // startup steps are a real percentage, and only the release reaches 100.
  if (currentStatus !== "ready") meter.removeAttribute("aria-valuenow");
  else
    meter.setAttribute(
      "aria-valuenow",
      held ? String(Math.round(amount * 100)) : "100",
    );
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
    // Held for startup: the game's own steps continue on the same bar.
    if (held) return renderStatus();
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
  if (status === "ready" && !held) return;
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "server-startup";
    panel.className = "server-startup";
    panel.setAttribute("aria-label", "Connecting to Element Arena");
    panel.style.setProperty("--startup-backdrop", `url("${starfield}")`);
    panel.innerHTML = `<img class="server-startup-painting" alt="" decoding="async" draggable="false" hidden><div class="server-startup-card"><header class="server-startup-brand"><h1 aria-label="Element Arena"><span aria-hidden="true">ELEMENT</span><span aria-hidden="true">ARENA</span></h1><span class="server-startup-divider" aria-hidden="true"></span></header><div class="server-startup-scene" aria-hidden="true"><div class="server-startup-art"><span class="server-startup-aura"></span>${orbits}<img src="${sigil}" width="960" height="960" alt="" decoding="async" draggable="false"><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="server-startup-loading"><h2>Opening the arena…</h2><div class="server-startup-progress" role="progressbar" aria-label="Game server connection" aria-valuemin="0" aria-valuemax="100"><i></i></div><p role="status" aria-live="polite"></p><div class="server-startup-tip" hidden></div><button type="button" hidden>Try again</button></div></div>`;
    const emblem = panel.querySelector<HTMLImageElement>(
      ".server-startup-art img",
    )!;
    const shell = panel;
    emblem.addEventListener(
      "error",
      () => {
        emblem.hidden = true;
      },
      { once: true },
    );
    // The crest and the starfield fade in once decoded instead of popping
    // in (or painting in strips) over the first frames.
    void emblem
      .decode()
      .then(() => shell.classList.add("has-sigil"))
      .catch(() => {});
    const backdrop = new Image();
    backdrop.src = starfield;
    void backdrop
      .decode()
      .then(() => shell.classList.add("has-backdrop"))
      .catch(() => shell.classList.add("has-backdrop"));
    panel.querySelector("button")!.onclick = () => retry?.();
    document.body.append(panel);
  }
  const copy = {
    ready: held?.message ?? "",
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
  // "loading": the server answered and the game is still getting ready (the
  // bar keeps its sheen, unlike a finished "ready").
  panel.dataset.status = held && status === "ready" ? "loading" : status;
  updateProgress();
  syncProgressTimer();
}

/**
 * Cover the game from its first frame until releaseStartupCurtain(). Call
 * once, at startup, before anything is shown.
 */
export function holdStartupCurtain(message = "Connecting to the game server…") {
  held = { floor: 0.04, message };
  shownProgress = 0;
  clearTimeout(reveal);
  reveal = undefined;
  renderStatus();
  panel?.setAttribute("aria-busy", "true");
}
/** A startup step is done: the bar moves to at least `floor` (0–1). */
export function curtainStep(floor: number, message: string) {
  if (!held) return;
  held = { floor: Math.max(held.floor, floor), message };
  if (currentStatus === "ready") renderStatus();
  else updateProgress();
}
/** A tip under the bar while the curtain is held (null: none). */
export function setCurtainTip(markup: string | null) {
  const box = panel?.querySelector<HTMLElement>(".server-startup-tip");
  if (!box) return;
  box.hidden = !markup;
  if (markup && box.innerHTML !== markup) {
    box.innerHTML = markup;
    // Each new tip fades in (server-connection.css).
    box.classList.remove("is-new");
    void box.offsetWidth;
    box.classList.add("is-new");
  }
}
/**
 * A painting behind the curtain (loading-art.ts): the curtain takes its
 * painting layout (title, bar and tip in a column on the right) and the
 * painting fades in over the starfield once decoded. null: the starfield.
 */
export function setCurtainArt(art: LoadingArt | null) {
  const picture = panel?.querySelector<HTMLImageElement>(
    ".server-startup-painting",
  );
  if (!panel || !picture) return;
  const shell = panel;
  shell.classList.toggle("has-art", !!art);
  shell.classList.remove("has-painting");
  // With a painting the tip stands in the middle of the column (where the
  // crest is), so a long or short tip never moves the line and bar below.
  const tip = shell.querySelector<HTMLElement>(".server-startup-tip")!;
  if (art) shell.querySelector(".server-startup-scene")!.append(tip);
  else
    shell
      .querySelector(".server-startup-loading")!
      .insertBefore(tip, shell.querySelector(".server-startup-loading button"));
  picture.hidden = !art;
  if (!art) return void picture.removeAttribute("src");
  picture.style.objectPosition = art.focus ?? "";
  picture.src = art.src;
  void picture
    .decode()
    .then(() => shell.classList.add("has-painting"))
    .catch(() => {
      // Missing or broken: the starfield stays behind the same layout.
      picture.hidden = true;
    });
}
/** The game server has answered (the last health check succeeded). */
export function serverReady() {
  return currentStatus === "ready";
}
/** Whether the startup curtain still covers the game. */
export function curtainHeld() {
  return !!held;
}
/**
 * The first screen is complete: fill the bar, then fade the curtain out.
 * A server still waking up, offline or failed keeps its own panel and
 * retry button (the server's status decides, as before the curtain).
 */
export function releaseStartupCurtain() {
  if (!held) return;
  held = undefined;
  if (currentStatus !== "ready" || !panel) return void syncProgressTimer();
  const leavingPanel = panel;
  panel.dataset.status = "ready";
  panel.removeAttribute("aria-busy");
  panel.querySelector("p")!.textContent = "Entering the arena…";
  updateProgress();
  syncProgressTimer();
  // A later wait for the server (after an hour asleep, say) gets a panel
  // of its own rather than this fading one.
  panel = undefined;
  clearTimeout(leaving);
  // A short beat at full, then a quick fade: the game is already drawn
  // underneath, and it takes taps as soon as the fade starts.
  leaving = setTimeout(() => {
    leavingPanel.classList.add("is-leaving");
    leaving = setTimeout(() => {
      leavingPanel.remove();
      leaving = undefined;
    }, 320);
  }, 180);
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
