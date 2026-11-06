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
  // The device told the server how long that took.
  const reports = await page.evaluate(() =>
    (window as any).__events
      .filter((e: any) => e.event === "battle-loaded")
      .map((e: any) => e.data),
  );
  expect(reports).toHaveLength(1);
  expect(reports[0]).toMatchObject({ fighters: 2, ms: expect.any(Number) });
  expect(errors).toEqual([]);
});
