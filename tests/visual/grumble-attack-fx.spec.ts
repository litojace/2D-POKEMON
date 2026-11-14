import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle, snap } from "./helpers";

// Cragmuff's attacks in the real raid scene use the vector boss demo's
// effects (grumble-attack-fx.ts), not the shared rings and spell flipbook:
// stones and the meteor in the air before they land, then dust, cracks,
// debris, geysers. The server's own combat runs in the page
// (boss-combat-demo.ts); each 1/30 s server step waits for a drawn frame,
// so every hit is seen as it lands.
async function raid(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    const marker =
      "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(marker, "window.__battle=gameInstance;" + marker),
    });
  });
  const errors = await openHub(page);
  await page.evaluate(() =>
    (window as any).__room("raid", {
      boss: "grumblecrag",
      pos: [500, 450, 700, 600],
    }),
  );
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  await page.evaluate(async () => {
    const { createBossCombatDemo } = await import("/boss-combat-demo.ts");
    (window as any).__combat = createBossCombatDemo("grumblecrag", true, false);
  });
  return errors;
}
/** Run the server for `seconds`, a drawn frame after every 1/30 s step. */
const run = (page: Page, seconds: number) =>
  page.evaluate(async (seconds) => {
    const c = (window as any).__combat;
    for (let i = 0; i < Math.round(seconds * 30); i++) {
      c.step(1 / 30);
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    }
  }, seconds);
/** What Cragmuff's effects drew in the last frame (by effect). */
const seen = (page: Page) =>
  page.evaluate(async () => {
    const { cragmuffFx } = await import("/cragmuff-fx.ts");
    return { ...cragmuffFx };
  });
/** Seconds until the boss's newest warning lands. */
const untilHit = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__combat.arena;
    const w = a.raid.warnings[a.raid.warnings.length - 1];
    return w ? w.at - a.time : 0;
  });
/** Sprites and layers the battle's effects drew this frame. */
const drawn = (page: Page) =>
  page.evaluate(() => {
    const list = (window as any).__battle.scene
      .getScenes(true)
      .flatMap((s: any) => s.children.list);
    return {
      flipbook: list.filter(
        (o: any) => o.name === "boss-spell-flipbook" && o.visible,
      ).length,
      sprites: list.filter(
        (o: any) =>
          o.type === "Image" &&
          o.texture?.key === "fx-glow" &&
          o.visible &&
          o.alpha > 0.02,
      ).length,
    };
  });

test("Cragmuff's attacks use the demo's effects, before and as they land", async ({
  browser,
}, info) => {
  test.setTimeout(420_000);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  try {
    const page = await context.newPage();
    const errors = await raid(page);
    await page.evaluate(() => (window as any).__combat.face("front"));
    await run(page, 0.5);
    for (const kind of [
      "volley",
      "share",
      "slam",
      "eruption",
      "debris",
      "charge",
    ]) {
      await page.evaluate((kind) => (window as any).__combat.cast(kind), kind);
      const lead = await untilHit(page);
      expect(lead, kind).toBeGreaterThan(0.5);
      // Just before it lands: the volley's stones and the meteor are in the air.
      await run(page, lead - 0.25);
      const before = await seen(page);
      // the ram demo's effects: stones and wool shaken from the fleece, the
      // crystal meteor forming, a crack racing to the eruption, roof rocks falling
      if (kind === "volley") {
        expect(before.stones, kind).toBeGreaterThan(0);
        expect(before.wool, kind).toBeGreaterThan(0);
      }
      if (kind === "share") expect(before.meteor, kind).toBe(1);
      if (kind === "eruption") expect(before.cracks, kind).toBeGreaterThan(0);
      if (kind === "debris") expect(before.debris, kind).toBeGreaterThan(0);
      await snap(page, info, `grumble-${kind}-before`);
      // As it lands, and a little after.
      await run(page, 0.45);
      const hit = await drawn(page);
      expect(hit.flipbook, kind).toBe(0);
      expect(hit.sprites, kind).toBeGreaterThan(0);
      const after = await seen(page);
      if (kind === "eruption") expect(after.spikes, kind).toBeGreaterThan(0);

      await snap(page, info, `grumble-${kind}-hit`);
      if (kind === "charge") {
        // where the run ends: a pillar crash's shards, or a miss's scrape marks
        await run(page, 1.0);
        const stop = await seen(page);
        expect(stop.crash + stop.scrape, kind).toBeGreaterThan(0);
        await snap(page, info, "grumble-charge-stop");
      }
      await run(page, kind === "charge" ? 0.6 : 1.2);
      // The old shared flipbook never shows for this boss.
      expect((await drawn(page)).flipbook, kind).toBe(0);
    }
    // A raider behind the middle pillar: the stones that fly at it stop at its footprint.
    await page.evaluate(() => {
      const c = (window as any).__combat,
        a = c.arena,
        boss = a.boss(),
        hero = a.heroes()[0];
      boss.x = 1230;
      boss.y = 450;
      hero.x = 620;
      hero.y = 450;
      c.cast("volley");
    });
    await run(page, (await untilHit(page)) - 0.2);
    expect((await seen(page)).stopped).toBeGreaterThan(0);
    await snap(page, info, "grumble-volley-pillar");
    await run(page, 1.2);
    // Chapter 3's closing ring: crystals stand on it.
    await page.evaluate(() => {
      (window as any).__combat.arena.raid.closingRadius = 420;
    });
    await run(page, 0.2);
    expect((await seen(page)).ring).toBeGreaterThan(3);
    await snap(page, info, "grumble-closing-ring");
    // Phase 3: hot cracks and embers.
    await page.evaluate(() => {
      (window as any).__combat.arena.raid.phase = 3;
      (window as any).__combat.cast("slam");
    });
    await run(page, (await untilHit(page)) + 0.2);
    expect((await drawn(page)).flipbook).toBe(0);
    await snap(page, info, "grumble-slam-phase3");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Cragmuff's own moments: the roar, a hit's tufts, the stagger and its death", async ({
  browser,
}, info) => {
  test.setTimeout(420_000);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  try {
    const page = await context.newPage();
    const errors = await raid(page);
    await page.evaluate(() => (window as any).__combat.face("front"));
    await run(page, 0.5);
    const moment = async (name: string, change: string, wait: number) => {
      await page.evaluate((change) => {
        const c = (window as any).__combat,
          a = c.arena,
          boss = a.boss();
        if (change === "phase") a.raid.phase = 2;
        if (change === "hurt") boss.hp -= 40;
        if (change === "stagger") a.raid.staggerUntil = a.time + 4;
        if (change === "defeat") boss.hp = 0;
      }, change);
      await run(page, wait);
      const now = await drawn(page);
      expect(now.flipbook, name).toBe(0);
      // A hit's chips are drawn shapes only; the others raise dust or glow.
      if (name !== "hurt") expect(now.sprites, name).toBeGreaterThan(0);
      await snap(page, info, `grumble-moment-${name}`);
      await run(page, 1.6);
    };
    await moment("roar", "phase", 0.45);
    await moment("hurt", "hurt", 0.2);
    await moment("stagger", "stagger", 0.3);
    // A raid won: the results stay hidden while the boss falls (style.css,
    // raid-victory-reveal), so its collapse and dust are seen. The photo
    // keeps CSS animations running (snap() would jump them to their end).
    await page.evaluate(() => ((window as any).__combat.arena.boss().hp = 0));
    await run(page, 0.07);
    const overlay = page.locator("#arena-overlay");
    await expect(overlay).toHaveClass(/raid-victory-reveal/);
    expect(await overlay.evaluate((e) => getComputedStyle(e).visibility)).toBe(
      "hidden",
    );
    expect((await drawn(page)).sprites).toBeGreaterThan(0);
    const body = await page.screenshot({ animations: "allow" });
    await info.attach("grumble-moment-defeat", {
      body,
      contentType: "image/png",
    });
    if (process.env.VISUAL_SHOTS) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(
        `${process.env.VISUAL_SHOTS}/grumble-moment-defeat.png`,
        body,
      );
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
