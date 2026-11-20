import {
  curtainHeld,
  curtainStep,
  holdStartupCurtain,
  releaseStartupCurtain,
  serverReady,
} from "./server-connection";
import { lowGraphics } from "./graphics-quality";

/**
 * Where startup has got to, as main.ts sees it:
 * - "account": the saved session is being checked;
 * - "profile": signed in, the profile (skins, fighter, avatar) is loading;
 * - "connecting": the profile is here, the hub connection isn't yet;
 * - "gate": a front-door screen that needs the player (sign up, log in,
 *   try again, another device);
 * - "scene": the first real screen is drawn underneath (hub, room, battle).
 */
export type StartupStage =
  "account" | "profile" | "connecting" | "gate" | "scene";

/**
 * Once the server has answered, the longest the curtain waits for the rest.
 * Past it the game shows whatever it has (its own "Connecting…" panel, say):
 * a loading screen must never trap a player.
 */
export const CURTAIN_CAP_MS = 12_000;
/** The longest the drawn scene may take to finish its artwork. */
export const SCENE_SETTLE_MS = 2_500;

const STEPS: Record<
  Exclude<StartupStage, "gate" | "scene">,
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
  let settling = false;
  let readySince: number | undefined;
  const finish = () => {
    clearInterval(poll);
    releaseStartupCurtain();
  };
  const tick = () => {
    if (!curtainHeld()) return clearInterval(poll);
    if (serverReady()) readySince ??= performance.now();
    else readySince = undefined;
    if (
      readySince !== undefined &&
      performance.now() - readySince > CURTAIN_CAP_MS
    )
      return finish();
    if (settling) return;
    const now = stage();
    if (now === "gate") return finish();
    if (now === "scene") {
      settling = true;
      curtainStep(0.88, "Preparing your fighter…");
      void settle().then(finish, finish);
      return;
    }
    curtainStep(...STEPS[now]);
  };
  const poll = setInterval(tick, 100);
  tick();
}
