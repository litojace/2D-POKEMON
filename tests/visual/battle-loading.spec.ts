import { expect, test } from "@playwright/test";
import { openHub, openPlayPanel } from "./helpers";
import { FIGHTER_IDS } from "../../packages/shared/src/index";

test("the briefing holds I'm ready until the arena has loaded, and loads only the room's fighters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
        "window.__loadGame=gameInstance;gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
      ),
    });
  });
  const errors = await openHub(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__events = [];
    w.__emit = (event: string, data: unknown) =>
      w.__events.push({ event, data });
    w.__room("pvp", { mode: "duel", phase: "briefing" });
  });
  await openPlayPanel(page);
  // A slower CPU, as on an older phone, so the load takes a few seconds.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.click("#play-create");
  const ready = page.locator("#instructions-ready");
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__push());
        return ready.count();
      },
      { timeout: 60_000, intervals: [300] },
    )
    .toBe(1);
  // The briefing appears at once, but "I'm ready" waits for the arena.
  await expect(ready).toHaveText("Loading the arena…");
  await expect(ready).toBeDisabled();
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__push());
        return ready.textContent();
      },
      { timeout: 90_000, intervals: [300] },
    )
    .toBe("I’m ready");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await expect(ready).toBeEnabled();
  // The two fighters in the room are loaded; nobody else's art is.
  const loaded = await page.evaluate(
    (ids) => {
      const keys: string[] = (
        window as any
      ).__loadGame.textures.getTextureKeys();
      return ids.filter((id) => keys.some((k) => k.startsWith(`rig-${id}-`)));
    },
    [...FIGHTER_IDS],
  );
  expect(loaded.sort()).toEqual(["cindrake", "voltkit"]);
  // The device told the server how long that took (on the arena's next
  // frame, which a busy machine may not have drawn yet).
  const sent = () =>
    page.evaluate(() =>
      (window as any).__events
        .filter((e: any) => e.event === "battle-loaded")
        .map((e: any) => e.data),
    );
  await expect.poll(async () => (await sent()).length).toBe(1);
  const reports = await sent();
  expect(reports).toHaveLength(1);
  expect(reports[0]).toMatchObject({ fighters: 2, ms: expect.any(Number) });
  // Where the time went: starting the renderer, the fighters' art, the
  // scene. Together they are the whole load.
  const { ms, boot, assets, scene } = reports[0];
  for (const phase of [boot, assets, scene])
    expect(phase).toBeGreaterThanOrEqual(0);
  expect(Math.abs(boot + assets + scene - ms)).toBeLessThanOrEqual(3);
  expect(reports[0]).toMatchObject({
    density: expect.any(Number),
    build: expect.any(String),
    os: expect.any(String),
    app: expect.any(Boolean),
  });
  expect(errors).toEqual([]);
});

test("a briefing that comes before Phaser has loaded holds I'm ready too, and counts the wait", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  // Phaser loads after the first screen (phaser-runtime.ts); here it is held
  // back until the briefing is up, as on a slow phone network.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  let asked = 0;
  await page.route(
    /\/node_modules\/\.vite\/deps\/phaser\.js/,
    async (route) => {
      asked++;
      await held;
      await route.continue();
    },
  );
  const errors = await openHub(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__events = [];
    w.__emit = (event: string, data: unknown) =>
      w.__events.push({ event, data });
    w.__room("pvp", { mode: "duel", phase: "briefing" });
  });
  await openPlayPanel(page);
  await page.click("#play-create");
  const ready = page.locator("#instructions-ready");
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__push());
        return ready.count();
      },
      { timeout: 60_000, intervals: [300] },
    )
    .toBe(1);
  expect(asked).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window as any).__push());
  await expect(ready).toHaveText("Loading the arena…");
  await expect(ready).toBeDisabled();
  release();
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__push());
        return ready.textContent();
      },
      { timeout: 90_000, intervals: [300] },
    )
    .toBe("I’m ready");
  await expect(ready).toBeEnabled();
  // The report's load time includes the 1.5 s spent waiting for Phaser.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__events.filter(
            (e: any) => e.event === "battle-loaded",
          ).length,
      ),
    )
    .toBe(1);
  const report = await page.evaluate(
    () =>
      (window as any).__events.find((e: any) => e.event === "battle-loaded")
        .data,
  );
  expect(report.ms).toBeGreaterThanOrEqual(1500);
  expect(report.boot).toBeGreaterThanOrEqual(1500);
  expect(errors).toEqual([]);
});
