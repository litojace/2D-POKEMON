import {
  curtainHeld,
  curtainStep,
  holdStartupCurtain,
  releaseStartupCurtain,
  serverReady,
  setCurtainArt,
  setCurtainRunner,
} from "./server-connection";
import { artForThisStart, prepareNextArt } from "./loading-art";
import { lowGraphics } from "./graphics-quality";
import { lastHomeFighter } from "./home-screen";
import { wornSkin } from "./fighter-selection";

/**
 * Where startup has got to, as main.ts sees it:
 * - "account": the saved session is being checked;
 * - "profile": signed in, the profile (skins, fighter, avatar) is loading;
 * - "connecting": the profile is here, the hub connection isn't yet;
 * - "gate": a front-door screen that needs the player (sign up, log in,
 *   try again, another device);
 * - "provisional": the hub is drawn from this device's copy of the profile
 *   (profile-copy.ts) while the fresh one loads;
 * - "scene": the first real screen is drawn underneath (hub, room, battle).
 */
export type StartupStage =
  "account" | "profile" | "connecting" | "gate" | "provisional" | "scene";

/**
 * Once the server has answered, the longest the curtain waits for the rest.
 * Past it the game shows whatever it has (its own "Connecting…" panel, say):
 * a loading screen must never trap a player.
 */
export const CURTAIN_CAP_MS = 12_000;
/**
 * How long a hub drawn from the saved copy waits for the fresh profile
 * before the curtain lifts anyway. On a quick connection the fresh copy is
 * in by then (nothing can change on screen); on a slow one the saved copy
 * shows, and only what changed on another device updates after.
 */
export const COPY_GRACE_MS = 800;
/** The longest the drawn scene may take to finish its artwork. */
export const SCENE_SETTLE_MS = 2_500;
/**
 * Once the scene is complete, the longest the curtain waits for the Lobby's
 * panels to be ready (their data and code, accounts.ts warmLobby; owner,
 * 28 Nov: a tap on any tile opens it at once). On a quick connection they
 * are in before the scene is; past this a slow or failed answer lifts the
 * curtain anyway, and that panel fills in when it opens, as before.
 */
export const LOBBY_WAIT_MS = 1_500;

/** What the Lobby's panels still wait for (the latest sign-in's). */
let lobbyJob: { done: boolean } | undefined;
/**
 * A sign-in is getting the Lobby's panels ready: the curtain also waits for
 * `job` (capped by LOBBY_WAIT_MS, and by CURTAIN_CAP_MS as ever). A later
 * sign-in's job replaces this one.
 */
export function curtainWaitsFor(job: Promise<unknown>) {
  const entry = { done: false };
  lobbyJob = entry;
  const end = () => {
    entry.done = true;
  };
  void job.then(end, end);
}

const STEPS: Record<
  Exclude<StartupStage, "gate" | "scene" | "provisional">,
  [number, string]
> = {
  // No floor: until the server answers, its own estimate paces the bar.
  account: [0, "Checking your account…"],
  profile: [0.5, "Loading your profile…"],
  connecting: [0.72, "Entering Elemental Plaza…"],
};

/** The startup curtain has been started (later ones are covers again). */
let startedOnce = false;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The scene underneath is complete: fonts, the pictures it shows decoded
 * (img.decode(): no half-drawn pop-in) and the Lobby fighter's live rig
 * posed (shop-preview.ts marks it .is-ready), then two frames so it is on
 * screen. All capped: missing art leaves its still fallback, as in play.
 */
export async function sceneSettled(limit = SCENE_SETTLE_MS) {
  const end = performance.now() + limit;
  const until = (job: Promise<unknown>) =>
    Promise.race([job, sleep(Math.max(0, end - performance.now()))]);
  await until(document.fonts?.ready ?? Promise.resolve());
  // One layout read, once, at startup (never during a battle).
  const shown = Array.from(
    document.querySelectorAll<HTMLImageElement>("img"),
  ).filter(
    (img) =>
      !img.closest("#server-startup, #app-boot") &&
      img.loading !== "lazy" &&
      !!img.currentSrc &&
      img.getClientRects().length > 0,
  );
  await until(Promise.allSettled(shown.map((img) => img.decode())));
  while (performance.now() < end) {
    const rig = document.querySelector("#lobby-fighter-art");
    if (!rig || rig.classList.contains("is-ready") || lowGraphics()) break;
    await sleep(60);
  }
  await until(
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    ),
  );
}

/**
 * Cover the game from its first frame until its first screen is complete,
 * the way big mobile games hold their splash until the account, the
 * player's look and the home screen's art are in. `stage` is asked every
 * 100 ms while the curtain is up. `again`: the game is already running (a
 * log-in from the front door, another account, the hub's connection back
 * after a drop), and the same curtain covers the way back in.
 */
export function startStartupCurtain(
  stage: () => StartupStage,
  settle: () => Promise<void> = () => sceneSettled(),
  again = false,
) {
  // Later covers (a log-in, another account, a dropped hub connection) use
  // the same curtain, fading in over what was showing.
  // Not before the startup one (the first screens are drawn before it is
  // started), and never twice at once.
  if (again && (!startedOnce || curtainHeld())) return;
  startedOnce = true;
  holdStartupCurtain(undefined, again);
  // The painting the last start chose and downloaded (none on a first start:
  // the plain cover). The curtain waits for nothing but the game: it opens
  // as soon as the first screen is complete (the owner, 20 Nov: no "Tap to
  // enter", no reading time). No gameplay tips on it since 27 Nov (the
  // owner: they and the status line covered the painting).
  // (Since 22 Nov a launch lifts it onto the title screen, title-screen.ts,
  // whose Start is the one tap; the curtain itself still never waits.)
  const art = artForThisStart();
  setCurtainArt(art ?? null);
  // The runner on the bar: the fighter this device showed last, and its
  // skin as soon as the profile (or this device's copy of it) names one.
  const runner = () => {
    const id = lastHomeFighter();
    setCurtainRunner(id, wornSkin(id) ?? null);
  };
  runner();
  /** When the scene was first drawn, and what its settling was for. */
  let sceneSince: number | undefined;
  let settledFor: StartupStage | undefined;
  let settling: StartupStage | undefined;
  let readySince: number | undefined;
  /** When the scene was first complete (LOBBY_WAIT_MS counts from it). */
  let settledAt: number | undefined;
  /** Everything is in: lift the curtain. */
  const finish = (now = false) => {
    clearInterval(poll);
    releaseStartupCurtain(now);
    // The game is up: choose the next start's painting and download it in a
    // quiet moment, so it is on the device before that curtain needs it.
    setTimeout(() => prepareNextArt(art?.id), 3000);
  };
  const tick = () => {
    if (!curtainHeld()) return clearInterval(poll);
    runner();
    if (serverReady()) readySince ??= performance.now();
    else readySince = undefined;
    if (
      readySince !== undefined &&
      performance.now() - readySince > CURTAIN_CAP_MS
    )
      return finish();
    const now = stage();
    // A front-door screen waits for the player: lift without the reading
    // pause (the status needn't be read to sign in).
    if (now === "gate") return finish(true);
    if (now === "scene" || now === "provisional") {
      sceneSince ??= performance.now();
      curtainStep(0.88, "Preparing your fighter…");
      // Settle the scene, and again once if the fresh profile redrew it
      // (another fighter or skin from another device).
      if (!settling && settledFor !== now && settledFor !== "scene") {
        settling = now;
        const done = () => {
          settledFor = settling;
          settling = undefined;
        };
        void settle().then(done, done);
      }
      if (settling || !settledFor) return;
      settledAt ??= performance.now();
      // The Lobby's panels, a moment more (not under a battle: a room
      // rejoined at startup has no Lobby to tap).
      if (
        lobbyJob &&
        !lobbyJob.done &&
        !document.body.classList.contains("battle-active") &&
        performance.now() - settledAt < LOBBY_WAIT_MS
      ) {
        curtainStep(0.94, "Getting the Lobby ready…");
        return;
      }
      if (now === "scene" || performance.now() - sceneSince > COPY_GRACE_MS)
        finish();
      return;
    }
    curtainStep(...STEPS[now]);
  };
  const poll = setInterval(tick, 100);
  tick();
}
