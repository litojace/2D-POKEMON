import { ServerStartup, type StartupStatus } from "./server-startup";
import "./server-connection.css";
import type { CharacterId } from "@arena/shared";
import type { SkinLook } from "./creature-design";
import type { LoadingArt } from "./loading-art";
import { runnerKey, runnerMarkup } from "./startup-runner";

/** The game's gold star (the front door's and the top bar's), by the title
 *  over a painting. */
const crest = `<svg class="server-startup-crest" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><defs><linearGradient id="startup-crest-gold" x2="0" y2="1"><stop stop-color="#fff1a3"/><stop offset="1" stop-color="#d9a340"/></linearGradient></defs><path fill="url(#startup-crest-gold)" fill-rule="evenodd" d="M32 2 42 21 62 32 43 43 32 62 21 43 2 32 21 21Zm0 14L16 32l16 16 16-16Z"/></svg>`;

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
/** Held again over a screen already showing: the curtain fades in. */
let entering = false;

/**
 * The runner on the bar (startup-runner.ts): the player's fighter stands at
 * the end of the fill and runs while the bar moves. `runnerAt` is the
 * furthest the bar has been, so only a real advance sets it running; it
 * stands again RUNNER_REST_MS after the last one (the fill's own glide,
 * server-connection.css, is 600 ms).
 */
const RUNNER_REST_MS = 700;
let runner: { id: CharacterId; look?: SkinLook | null } = { id: "voltkit" };
let runnerAt = 0;
let runnerRest: ReturnType<typeof setTimeout> | undefined;
function drawRunner() {
  const box = panel?.querySelector<HTMLElement>(".server-startup-runner");
  if (!box) return;
  const key = runnerKey(runner.id, runner.look);
  if (box.dataset.runner === key) return;
  box.dataset.runner = key;
  box.innerHTML = runnerMarkup(runner.id, runner.look);
}
function runnerMoved(amount: number) {
  if (amount <= runnerAt + 0.0005) return;
  runnerAt = amount;
  const box = panel?.querySelector<HTMLElement>(".server-startup-runner");
  if (!box) return;
  box.classList.add("is-running");
  clearTimeout(runnerRest);
  runnerRest = setTimeout(
    () => box.classList.remove("is-running"),
    RUNNER_REST_MS,
  );
}
/**
 * Who runs on the bar: the fighter this device showed last, in the skin it
 * wears (startup-curtain.ts tells it again once the profile is in).
 */
export function setCurtainRunner(id: CharacterId, look?: SkinLook | null) {
  runner = { id, look };
  drawRunner();
}

/**
 * The status line: each new status replaces the last with a short
 * cross-fade (the old one fades up and out, server-connection.css), and
 * stays at least STATUS_HOLD_MS, long enough to read, so quick steps never
 * flicker past (the owner, 20 Nov: "a little less fast"); the curtain lifts
 * only once the status on screen has had its time (statusSettleMs).
 */
const STATUS_HOLD_MS = 800;
let statusAt = 0;
let statusTimer: ReturnType<typeof setTimeout> | undefined;
let statusPending = false;
function setStatusText(line: HTMLElement, text: string, now = false) {
  clearTimeout(statusTimer);
  statusPending = false;
  if (line.dataset.text === text) return;
  const wait = STATUS_HOLD_MS - (performance.now() - statusAt);
  if (!now && line.dataset.text && wait > 0) {
    statusPending = true;
    statusTimer = setTimeout(() => setStatusText(line, text), wait);
    return;
  }
  line.dataset.text = text;
  statusAt = performance.now();
  const old = line.querySelector("span:not([aria-hidden])");
  if (old) {
    old.setAttribute("aria-hidden", "true");
    old.classList.add("is-out");
    setTimeout(() => old.remove(), 300);
  }
  const span = document.createElement("span");
  span.textContent = text;
  line.append(span);
}

/** How long until the status line has shown what it has, a waiting one too. */
function statusSettleMs() {
  const rest = Math.max(0, STATUS_HOLD_MS - (performance.now() - statusAt));
  return statusPending ? rest + STATUS_HOLD_MS : rest;
}

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
  runnerMoved(amount);
  // The percentage beside the status (the owner, 20 Nov), once the server
  // has answered: while it wakes up the bar is only an estimate, and the
  // status says so instead. Read out by the bar itself, not the line.
  const percent = panel?.querySelector<HTMLElement>(".server-startup-percent");
  if (percent)
    percent.textContent =
      currentStatus === "ready" ? `${Math.round(amount * 100)}%` : "";
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
      setStatusText(
        panel.querySelector("p")!,
        "Connected. Entering the arena…",
        true,
      );
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
    // The bar carries the runner; the status line follows it (under the
    // bar over a painting, server-connection.css).
    panel.innerHTML = `<img class="server-startup-painting" alt="" decoding="async" draggable="false" hidden><div class="server-startup-card"><header class="server-startup-brand">${crest}<h1 aria-label="Element Arena"><span aria-hidden="true">ELEMENT</span><span aria-hidden="true">ARENA</span></h1></header><div class="server-startup-loading"><h2>Opening the arena…</h2><div class="server-startup-progress" role="progressbar" aria-label="Game server connection" aria-valuemin="0" aria-valuemax="100"><i></i><span class="server-startup-runner" aria-hidden="true"></span></div><p role="status" aria-live="polite"><b class="server-startup-percent" aria-hidden="true"></b></p><button type="button" hidden>Try again</button></div></div>`;
    runnerAt = 0;
    drawRunner();
    panel.querySelector("button")!.onclick = () => retry?.();
    if (entering) panel.classList.add("is-entering");
    entering = false;
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
  setStatusText(panel.querySelector("p")!, copy[status]);
  // The heading says what is true: "Opening the arena…" over a connection
  // that gave up read as if the game were still on its way in.
  const heading =
    status === "failed"
      ? "Connection paused"
      : status === "offline"
        ? "You’re offline"
        : "Opening the arena…";
  const title = panel.querySelector("h2")!;
  if (title.textContent !== heading) title.textContent = heading;
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
export function holdStartupCurtain(
  message = "Connecting to the game server…",
  again = false,
) {
  entering = again;
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
/**
 * A painting behind the curtain (loading-art.ts): the curtain takes its
 * painting layout (the star and title top right; along the bottom a
 * full-width bar with the runner on it and one status line under it, so the
 * painting stays clear) and the painting fades in once decoded. null: the
 * plain cover.
 */
export function setCurtainArt(art: LoadingArt | null) {
  const picture = panel?.querySelector<HTMLImageElement>(
    ".server-startup-painting",
  );
  if (!panel || !picture) return;
  const shell = panel;
  shell.classList.toggle("has-art", !!art);
  shell.classList.remove("has-painting");
  picture.hidden = !art;
  if (!art) return void picture.removeAttribute("src");
  picture.style.objectPosition = art.focus ?? "";
  picture.src = art.src;
  void picture
    .decode()
    .then(() => shell.classList.add("has-painting"))
    .catch(() => {
      // Missing or broken: the ink stays behind the same layout.
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
let releasing = false;
export function releaseStartupCurtain(now = false) {
  if (!held || (releasing && !now)) return;
  // The status on screen (and one waiting for its turn) has its time first,
  // unless the screen underneath waits for the player (`now`: the front
  // door), where a reading pause only keeps them from it.
  const wait =
    !now && currentStatus === "ready" && panel ? statusSettleMs() : 0;
  if (wait > 0) {
    releasing = true;
    setTimeout(() => {
      releasing = false;
      releaseStartupCurtain();
    }, wait);
    return;
  }
  held = undefined;
  if (currentStatus !== "ready" || !panel) return void syncProgressTimer();
  const leavingPanel = panel;
  panel.dataset.status = "ready";
  panel.removeAttribute("aria-busy");
  setStatusText(panel.querySelector("p")!, "Entering the arena…", true);
  updateProgress();
  syncProgressTimer();
  // A later wait for the server (after an hour asleep, say) gets a panel
  // of its own rather than this fading one.
  panel = undefined;
  clearTimeout(leaving);
  // A beat at full, then the fade: the game is already drawn underneath,
  // and it takes taps as soon as the fade starts.
  leaving = setTimeout(() => {
    leavingPanel.classList.add("is-leaving");
    leaving = setTimeout(() => {
      leavingPanel.remove();
      leaving = undefined;
    }, 470);
  }, 400);
}

/**
 * Whether a startup curtain covers the game: held, or still fading out. For
 * what asks something of the player right after a log-in (the new guest's
 * warning), which must wait until it has gone.
 */
export function curtainCovers() {
  return !!held || leaving !== undefined;
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
