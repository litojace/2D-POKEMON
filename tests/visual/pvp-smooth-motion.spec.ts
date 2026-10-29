import { expect, test } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle } from "./helpers";

test("live PvP hits do not freeze everyone and unchanged nameplates keep their text nodes", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(
      "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
      "window.__motionGame=gameInstance;gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
    ) });
  });
  const errors = await openTown(page);
  await page.evaluate(() => (window as any).__room("pvp", { mode: "ffa", phase: "playing" }));
  await openTownMenu(page);
  await page.click(".town-play");
  await page.click("#play-create");
  await pushUntilBattle(page);
  await expect(page.locator(".battle-nameplate")).toHaveCount(4);
  const hit = await page.evaluate(() => {
    const scene = (window as any).__motionGame.scene.getScene("arena");
    for (const role of ["attacker", "victim", "spectator"]) {
      scene.feelHit({ id: 900, type: "hit", source: role === "attacker" ? "me" : "p2", target: role === "victim" ? "me" : "p3", value: 35, ko: true });
    }
    return { stopUntil: scene.stopUntil, koUntil: scene.koUntil, zoom: scene.koZoom };
  });
  expect(hit).toEqual({ stopUntil: 0, koUntil: 0, zoom: 1 });
  const mutations = await page.evaluate(async () => {
    const labels = [...document.querySelectorAll(".battle-nameplate")];
    const names = labels.map((label) => label.querySelector(".player-name")!.firstChild);
    let textMutations = 0, layoutWrites = 0;
    const observer = new MutationObserver((entries) => {
      for (const entry of entries) {
        if (entry.type === "childList" || entry.type === "characterData") textMutations++;
        if (entry.type === "attributes" && entry.attributeName === "style") {
          const label = entry.target as HTMLElement;
          if (label.style.left || label.style.top) layoutWrites++;
        }
      }
    });
    for (const label of labels) observer.observe(label, { subtree: true, childList: true, characterData: true, attributes: true });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    observer.disconnect();
    return { textMutations, layoutWrites, sameNodes: labels.every((label, i) => label.querySelector(".player-name")!.firstChild === names[i]) };
  });
  expect(mutations).toEqual({ textMutations: 0, layoutWrites: 0, sameNodes: true });
  await page.evaluate(() => {
    const w = window as any;
    w.__snap.players.find((p: any) => p.id === "me").name = "New name";
    w.__push();
  });
  await expect(page.locator(".battle-nameplate .player-name").filter({ hasText: "New name" })).toBeVisible();
  expect(errors).toEqual([]);
});
