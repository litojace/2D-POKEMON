import { expect, type Page, type TestInfo } from "@playwright/test";

/**
 * Load the client signed in and wait for the hub. The hub opens on the Lobby
 * (the screen after login); the Plaza and the Farm are its other tabs.
 */
export async function openHub(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // This machine renders on the CPU (a few frames a second), so Auto would
  // always pick Low: pin High unless a test asks for Auto (__graphicsAuto)
  // or picked a quality itself.
  await page.addInitScript(() => {
    try {
      if (
        !(window as any).__graphicsAuto &&
        localStorage.getItem("ea-graphics") === null
      )
        localStorage.setItem("ea-graphics", "high");
      if (localStorage.getItem("ea-hub-scene") === null)
        localStorage.setItem("ea-hub-scene", "lobby");
    } catch {
      /* No storage: Auto. */
    }
  });
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).__sock);
  // The client listens for "connect" once its account has loaded.
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__sock.fire("connect"));
        return page.locator("#lobby-play").isVisible();
      },
      { timeout: 30_000, intervals: [500, 1000] },
    )
    .toBe(true);
  return errors;
}

/** The hub, always starting on the Lobby. */
export async function openLobby(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("ea-hub-scene", "lobby");
    } catch {
      /* No storage. */
    }
  });
  return openHub(page);
}

/** The hub's Plaza tab (the harness runs the real PlazaWorld in the page). */
export async function openPlaza(page: Page) {
  const errors = await openLobby(page);
  await page.evaluate(() => localStorage.setItem("ea-plaza-help", "1"));
  await page.click('#hub-scenes [data-hub-scene="plaza"]');
  await expect(page.locator(".plaza-layer #pz-cv")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).__plazaWorld.size))
    .toBe(1);
  // Midday, whatever the clock says (night lighting is slow on a CPU renderer).
  await page.evaluate(() => (window as any).__plaza.setTod(0.42));
  return errors;
}

/** The Play panel (private rooms, bots, solo test), from the Lobby's mode menu. */
export async function openPlayPanel(page: Page) {
  await page.click("#lobby-mode");
  await page.click('#lobby-mode-menu [data-lobby-action="more-play"]');
  await expect(page.locator("#practice")).toBeVisible();
}

/** A button on the Lobby's menu rail: fighters, wardrobe, shop, raids, journey, missions, ranks, friends. */
export async function hubMenu(page: Page, action: string) {
  await page.click(`.lobby-rail [data-lobby-action="${action}"]`);
}

/**
 * Push the prepared room's snapshot until the battle screen is up.
 *
 * The first battle of a page boots Phaser's WebGL renderer. This machine does
 * GL on the CPU (SwiftShader), so for 10–25 s after that boot starts the page
 * barely runs a task, and every evaluate here waits behind it: a spec that
 * pushed "playing" itself before calling this used to burn its whole 20 s
 * budget on a single round trip, though the battle was already up. So push and
 * check in one round trip, and give the boot room. A flow that never reaches
 * the battle still fails here.
 */
export async function pushUntilBattle(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          (window as any).__push();
          return document.body.classList.contains("battle-active");
        }),
      { timeout: 60_000, intervals: [400] },
    )
    .toBe(true);
  // A few more frames so the floor and fighters settle.
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => (window as any).__push());
    await page.waitForTimeout(300);
  }
}

export async function snap(page: Page, info: TestInfo, name: string) {
  // Finish CSS transitions first: this machine renders on the CPU, a few
  // frames a second, so a sheet sliding in can still be off-screen.
  const body = await page.screenshot({ animations: "disabled" });
  await info.attach(name, { body, contentType: "image/png" });
  // Locally, VISUAL_SHOTS=<folder> also saves each screen there to look over.
  const dir = process.env.VISUAL_SHOTS;
  if (dir) {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${name}.png`, body);
  }
}

/**
 * Let the UI motion end (ui/motion.ts): every finite animation jumps to its
 * end, so a screen sliding in or a stage gliding aside is measured where it
 * settles, and a screen fading out is gone. Looping animations (an idle bob,
 * PLAY's sweep) keep running.
 */
export const settle = (page: Page) =>
  page.evaluate(async () => {
    for (const a of document.getAnimations())
      if (
        a.effect?.getTiming().iterations !== Infinity &&
        a.playState !== "finished"
      )
        a.finish();
    // Let what waits on them (removing a closed screen) run.
    await new Promise((r) => setTimeout(r, 0));
  });

export type Box = { x: number; y: number; width: number; height: number };
export const box = async (page: Page, selector: string) => {
  await settle(page);
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
};
/** Is `inner` inside `outer`, give or take a pixel? */
export const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 1 &&
  inner.y >= outer.y - 1 &&
  inner.x + inner.width <= outer.x + outer.width + 1 &&
  inner.y + inner.height <= outer.y + outer.height + 1;
