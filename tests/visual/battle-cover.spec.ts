import { expect, test, type Page } from "@playwright/test";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pickRoomMode,
  pushUntilBattle,
  snap,
  startPractice,
} from "./helpers";

/**
 * Loading covers on the way into a fight (docs/loading-screens.md): the
 * raid and Spire briefing's I'm ready waits for the arena, as the PvP Reveal
 * does, and Solo test mode has a cover of its own until the arena is in.
 */

/** Hold requests matching `pattern` until the returned release is called. */
async function hold(page: Page, pattern: RegExp) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(pattern, async (route) => {
    await held;
    await route.continue();
  });
  return release;
}

test("a raid briefing's I'm ready waits for the illustrated floor", async ({
  page,
}, info) => {
  await openHub(page);
  // The boss's painted court arrives late: the briefing must not start on
  // the stand-in floor.
  const release = await hold(page, /\/raid-arenas\/[^/]+\.webp/);
  await page.evaluate(() =>
    (window as any).__room("raid", { boss: "grumblecrag" }),
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__snap.phase = "briefing";
    w.__push();
  });
  const ready = page.locator("#raid-instructions");
  await expect(ready).toBeDisabled();
  await expect(ready).toContainText("Loading the arena");
  await snap(page, info, "raid-briefing-loading");
  release();
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__push());
        return ready.isEnabled();
      },
      { timeout: 20_000, intervals: [300] },
    )
    .toBe(true);
  await expect(ready).toContainText("I’m ready");
});

test("Solo test mode is covered until the arena has loaded", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  // A slow phone: the battle engine (loaded after the first screen) is
  // still on its way when the practice starts.
  const release = await hold(page, /\/deps\/phaser\.js/);
  await openHub(page);
  await page.evaluate(() =>
    (window as any).__room("practice", { character: "cindrake" }),
  );
  await openPlayPanel(page);
  await startPractice(page);
  await pushUntilBattle(page);
  const overlay = page.locator("#arena-overlay");
  await expect(overlay).toHaveClass(/is-practice-loading/);
  await expect(overlay.locator(".practice-loading")).toContainText(
    "Loading the arena",
  );
  // The whole screen: nothing of the court shows around it.
  const cover = (await overlay.boundingBox())!;
  expect(cover.width).toBeGreaterThanOrEqual(844);
  expect(cover.height).toBeGreaterThanOrEqual(390);
  await snap(page, info, "practice-loading-844x390");
  release();
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__push());
        return overlay.evaluate(
          (el) => !el.classList.contains("is-practice-loading"),
        );
      },
      { timeout: 20_000, intervals: [300] },
    )
    .toBe(true);
  await expect(overlay.locator(".practice-loading")).toHaveCount(0);
});

test("leaving a raid draws the Raids screen with the Lobby, not after it", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openHub(page);
  // The Raids screen's code is slow to arrive (it loads the first time the
  // screen opens, not with the game).
  await page.route(/\/screens\/raid-hall/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  await page.evaluate(() =>
    (window as any).__room("raid", { boss: "grumblecrag" }),
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  // Every frame from here: a Lobby on screen without the Raids screen over
  // it, or the screen still sliding in, is the flash this guards against.
  await page.evaluate(() => {
    const w = window as any;
    w.__frames = [];
    const look = () => {
      if (document.body.classList.contains("hub-active")) {
        const room = document.querySelector<HTMLElement>(".rh-room");
        w.__frames.push(
          room ? Number(getComputedStyle(room).opacity).toFixed(2) : "lobby",
        );
      }
      if (w.__frames.length < 30) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  await page.click("#battle-menu");
  await page.click("#exit-room");
  await expect(page.locator(".rh-room")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).__frames.length))
    .toBeGreaterThanOrEqual(30);
  const frames: string[] = await page.evaluate(() => (window as any).__frames);
  expect(frames.join(" ")).toBe(Array(frames.length).fill("1.00").join(" "));
  await snap(page, info, "raid-leave-844x390");
});

test("back from a battle, your fighter appears already moving", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openHub(page);
  await page.evaluate(() =>
    (window as any).__room("pvp", { mode: "duel", phase: "playing" }),
  );
  await openPlayPanel(page);
  await pickRoomMode(page, "duel");
  await createRoom(page);
  await pushUntilBattle(page);
  // Every frame of the Lobby until the live rig is drawn: the still
  // artwork must not be on screen (it would be swapped for the rig, in a
  // slightly different pose, a moment later).
  await page.evaluate(() => {
    const w = window as any;
    w.__looks = [];
    const look = () => {
      const art = document.querySelector<HTMLElement>("#lobby-fighter-art");
      if (document.body.classList.contains("hub-active") && art) {
        const ready = art.classList.contains("is-ready");
        w.__looks.push(
          ready
            ? "live"
            : Number(getComputedStyle(art).opacity) > 0
              ? "still"
              : "hidden",
        );
        if (ready) return;
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  await page.click("#battle-menu");
  await page.click("#exit-room");
  await expect(page.locator("#lobby-fighter-art")).toHaveClass(/is-ready/);
  const looks: string[] = await page.evaluate(() => (window as any).__looks);
  expect(looks.at(-1)).toBe("live");
  expect(looks).not.toContain("still");
  await expect(page.locator("#lobby-fighter-art")).not.toHaveClass(
    /is-arriving/,
  );
  await snap(page, info, "lobby-after-battle-844x390");
});
