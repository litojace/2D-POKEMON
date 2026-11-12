import { expect, test } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle } from "./helpers";

// What a battle needs is ready behind the loading screen, not on its first
// frames: the Shop skins the fighters wear (a rig used to ask for them on
// its first frame, so they rasterized mid-battle and popped in late) and the
// boss's atlas of vector pieces.
test("worn skins and the boss's atlas are ready before the battle's first frame", async ({
  page,
}) => {
  // Read what the arena scene holds the moment it is created, right after it
  // has prepared the boss's atlas.
  const marker = "prewarmBossAtlas(this, state.raid.boss, state.raid.phase);";
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body
        .replace(
          "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
          "window.__game=gameInstance;gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
        )
        .replace(
          marker,
          marker +
            " window.__atCreate = { skins: this.textures.getTextureKeys().filter((k) => k.includes('~')).length, atlas: this.textures.exists('vember-atlas-1') };",
        ),
    });
  });
  const errors = await openHub(page);
  // A raid whose four fighters all wear Shop skins (Awakened ones included).
  await page.evaluate(async () => {
    const w = window as any;
    w.__room("raid", { boss: "emberwing" });
    const m = await import("/rooms.ts");
    const a = m.createRaidArena("RAID42", "emberwing");
    ["voltkit", "cindrake", "tidefin", "lumoth"].forEach((c, i) =>
      a.add(i ? `p${i + 1}` : "me", `Player ${i + 1}`, c),
    );
    a.players.forEach((p: any, i: number) => m.dressUp(p, i));
    a.start();
    w.__snap = m.packSnapshot(a.snapshot());
  });
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  const seen = await page.evaluate(async () => {
    const w = window as any,
      files: string[] = [];
    w.__game.scene
      .getScene("arena")
      .load.on("filecomplete", (key: string) => files.push(key));
    for (let i = 0; i < 30; i++) {
      w.__push();
      await new Promise((r) => setTimeout(r, 100));
    }
    return {
      ...w.__atCreate,
      skinsNow: w.__game.textures
        .getTextureKeys()
        .filter((k: string) => k.includes("~")).length,
      lateSkins: files.filter((k) => k.includes("~")).length,
    };
  });
  // every skin texture was there when the scene was created; none came later
  expect(seen.skins).toBeGreaterThan(100);
  expect(seen.skins).toBe(seen.skinsNow);
  expect(seen.lateSkins).toBe(0);
  expect(seen.atlas).toBe(true);
  expect(errors).toEqual([]);
});
