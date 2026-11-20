import {
  curtainHeld,
  curtainStep,
  holdStartupCurtain,
  onCurtainTap,
  releaseStartupCurtain,
  serverReady,
  setCurtainArt,
  setCurtainTip,
} from "./server-connection";
import { artForThisStart, prepareNextArt } from "./loading-art";
import {
  nextTip,
  noteTipShown,
  tipAfter,
  tipMarkup,
  tipReadMs,
  tipsEnabled,
  type LoadingTip,
} from "./loading-tips";
import { lowGraphics } from "./graphics-quality";

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
/** A long load moves on to the next tip this long after the last was read. */
export const TIP_LINGER_MS = 2_500;
/** The longest the drawn scene may take to finish its artwork. */
export const SCENE_SETTLE_MS = 2_500;

const STEPS: Record<
  Exclude<StartupStage, "gate" | "scene" | "provisional">,
  [number, string]
> = {
  // No floor: until the server answers, its own estimate paces the bar.
  account: [0, "Checking your account…"],
  profile: [0.5, "Loading your profile…"],
  connecting: [0.72, "Entering Elemental Plaza…"],
};

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
 * 100 ms while the curtain is up (startup only).
 */
export function startStartupCurtain(
  stage: () => StartupStage,
  settle: () => Promise<void> = () => sceneSettled(),
) {
  holdStartupCurtain();
  // The painting the last start chose and downloaded (none on a first start:
  // the starfield), and a tip that suits its mode.
  const art = artForThisStart();
  setCurtainArt(art ?? null);
  // A gameplay tip from the start. The curtain stays until it has been read
  // (tipReadMs), however quick the load; a tap once loaded goes in at once.
  let tip: LoadingTip | undefined = tipsEnabled()
    ? nextTip(art?.mode)
    : undefined;
  let tipSince = performance.now();
  setCurtainTip(tip ? tipMarkup(tip) : null);
  const readUntil = () => (tip ? tipSince + tipReadMs(tip) : 0);
  /** Loaded; waiting for the player to finish reading. */
  let loaded = false;
  /** When the scene was first drawn, and what its settling was for. */
  let sceneSince: number | undefined;
  let settledFor: StartupStage | undefined;
  let settling: StartupStage | undefined;
  let readySince: number | undefined;
  const release = () => {
    clearInterval(poll);
    onCurtainTap(undefined);
    releaseStartupCurtain();
    // The game is up: choose the next start's painting and download it in a
    // quiet moment, so it is on the device before that curtain needs it.
    setTimeout(() => prepareNextArt(art?.id), 3000);
  };
  /** Everything is in: lift the curtain once the tip has been read. */
  const finish = () => {
    if (performance.now() >= readUntil()) return release();
    if (loaded) return;
    loaded = true;
    curtainStep(0.97, "Ready! Tap to enter");
    onCurtainTap(release);
  };
  const tick = () => {
    if (!curtainHeld()) return clearInterval(poll);
    if (loaded) {
      if (performance.now() >= readUntil()) release();
      return;
    }
    // A long load: the next tip, once this one has been read.
    if (tip && performance.now() > readUntil() + TIP_LINGER_MS) {
      tip = tipAfter(tip, art?.mode);
      noteTipShown(tip);
      tipSince = performance.now();
      setCurtainTip(tipMarkup(tip));
    }
    if (serverReady()) readySince ??= performance.now();
    else readySince = undefined;
    if (
      readySince !== undefined &&
      performance.now() - readySince > CURTAIN_CAP_MS
    )
      return finish();
    const now = stage();
    if (now === "gate") return finish();
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
      if (now === "scene" || performance.now() - sceneSince > COPY_GRACE_MS)
        finish();
      return;
    }
    curtainStep(...STEPS[now]);
  };
  const poll = setInterval(tick, 100);
  tick();
}
