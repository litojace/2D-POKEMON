import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle, snap } from "./helpers";

// Ascendant Cragmuff (the Spire's tenth floor) in the real raid scene: its
// own atlas, painted once (obsidian fleece, magma crystals, a crest of
// crystals on its crown, magma veins from chapter 1), its aura, and its new
// attacks (the Avalanche Charge and its fissure, the Twin Slam). The
// server's own combat runs in the page (boss-combat-demo.ts).
const ATLAS = "cragmuff-atlas-ascendant";
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
    (window as any).__combat = createBossCombatDemo(
      "grumblecrag",
      true,
      false,
      "ascendant",
    );
  });
  return errors;
}
/** Run the server for `seconds`, a drawn frame after every few 1/30 s steps. */
const run = (page: Page, seconds: number, every = 3) =>
  page.evaluate(
    async ([seconds, every]) => {
      const c = (window as any).__combat;
      for (let i = 0; i < Math.round(seconds * 30); i++) {
        c.step(1 / 30);
        if (i % every === every - 1)
          await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          );
      }
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    },
    [seconds, every],
  );
/** Draw a few frames without moving the server (a set pose stays put). */
const hold = (page: Page) =>
  page.evaluate(async () => {
    (window as any).__combat.snapshot();
    for (let i = 0; i < 4; i++)
      await new Promise((r) => requestAnimationFrame(r));
  });
/** The ram's rig this frame: facing, view, visible images, atlas size. */
const rig = (page: Page) =>
  page.evaluate((key) => {
    const scenes = (window as any).__battle.scene.getScenes(true);
    const list = scenes.flatMap((s: any) => s.children.list);
    const root = list.find((o: any) => o.name === "cragmuff-boss");
    const images = (root?.list ?? [])
      .flatMap((c: any) => c.list ?? [])
      .filter((o: any) => o.visible && o.alpha > 0.01);
    const tex = scenes
      .map((s: any) => s.textures.get(key))
      .find((t: any) => t && t.key === key);
    const src = tex?.getSourceImage();
    return {
      visible: !!root?.visible,
      facing: root?.getData("facing"),
      view: root?.getData("view"),
      frames: images.map((o: any) => o.frame.name as string),
      images: images.length,
      textures: [
        ...new Set(images.map((o: any) => o.texture.key as string)),
      ] as string[],
      atlasBytes: src ? src.width * src.height * 4 : 0,
      raidAtlas: scenes.some((s: any) => s.textures.exists("cragmuff-atlas")),
    };
  }, ATLAS);
/** Turn the boss to face a raider placed at `angle` (screen radians). */
const face = (page: Page, angle: number) =>
  page.evaluate((angle) => {
    const a = (window as any).__combat.arena,
      boss = a.boss(),
      hero = a.heroes()[0];
    hero.x = boss.x + Math.cos(angle) * 230;
    hero.y = boss.y + Math.sin(angle) * 230;
    boss.angle = angle;
  }, angle);
/** Zoom the battle camera onto the boss (set after the scene's own camera update). */
const closeUp = (page: Page, zoom: number, dy = -60) =>
  page.evaluate(
    async ([zoom, dy]) => {
      const w = window as any;
      const scene = w.__battle.scene
        .getScenes(true)
        .find((s: any) =>
          s.children.list.some((o: any) => o.name === "cragmuff-boss"),
        );
      if (w.__closeUpFn) scene.events.off("postupdate", w.__closeUpFn);
      w.__closeUpFn = null;
      if (zoom > 1) {
        w.__closeUpFn = () => {
          const boss = w.__combat.arena.boss();
          const cam = scene.cameras.main;
          cam
            .setZoom(cam.zoomX * zoom, cam.zoomY * zoom)
            .centerOn(boss.x, boss.y + dy);
        };
        scene.events.on("postupdate", w.__closeUpFn);
      }
      for (let i = 0; i < 3; i++)
        await new Promise((r) => requestAnimationFrame(r));
    },
    [zoom, dy],
  );
/** What Cragmuff's effects drew in the last frame (by effect). */
const seen = (page: Page) =>
  page.evaluate(async () => {
    const { cragmuffFx } = await import("/cragmuff-fx.ts");
    return { ...cragmuffFx };
  });
const context = (browser: import("@playwright/test").Browser) =>
  browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });

test("Ascendant Cragmuff stands in eight facings from its own atlas, crest and veins in each", async ({
  browser,
}, info) => {
  test.setTimeout(600_000);
  const ctx = await context(browser);
  try {
    const page = await ctx.newPage();
    const errors = await raid(page);
    await run(page, 0.3);
    const seenFacings: number[] = [];
    for (let i = 0; i < 8; i++) {
      await face(page, Math.PI / 2 - (i * Math.PI) / 4);
      await hold(page);
      const r = await rig(page);
      seenFacings.push(r.facing);
      expect(r.visible).toBe(true);
      // Every image comes from the Ascendant atlas, never the raid's.
      expect(r.textures).toEqual([ATLAS]);
      expect(r.frames).toContain(`crest_${r.view}`);
      // chapter 1 already has its magma veins
      expect(r.frames).toContain(`over_${r.view}_1`);
      // legs, fleece, veins, horns behind, head, eyes, mouth, horns, crest (+ glows)
      expect(r.images).toBeLessThanOrEqual(13);
      expect(r.frames.some((f: string) => f.startsWith("eyes_"))).toBe(
        r.view <= 2,
      );
      await closeUp(page, 3.2, -60);
      await snap(page, info, `ascendant-facing-${i * 45}`);
      if ([0, 1, 2, 6, 7].includes(i)) {
        // the face close up: eyes level, nose and mouth on the face's midline
        await closeUp(page, 7, -40);
        await snap(page, info, `ascendant-face-${i * 45}`);
      }
      await closeUp(page, 1);
    }
    expect(seenFacings).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const r = await rig(page);
    expect(r.atlasBytes).toBeGreaterThan(0);
    expect(r.atlasBytes).toBeLessThanOrEqual(8 * 1024 * 1024);
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test("Ascendant Cragmuff's aura and new attacks: Avalanche Charge, its fissure, Twin Slam", async ({
  browser,
}, info) => {
  test.setTimeout(600_000);
  const ctx = await context(browser);
  try {
    const page = await ctx.newPage();
    const errors = await raid(page);
    await face(page, Math.PI);
    await run(page, 0.6);
    // the aura: heat on the floor and embers rising, always on
    const glows = () =>
      page.evaluate(
        () =>
          (window as any).__battle.scene
            .getScenes(true)
            .flatMap((s: any) => s.children.list)
            .filter(
              (o: any) =>
                o.type === "Image" &&
                o.texture?.key === "fx-glow" &&
                o.visible &&
                o.alpha > 0.02,
            ).length,
      );
    expect(await glows()).toBeGreaterThan(0);
    await closeUp(page, 2.2, -50);
    await snap(page, info, "ascendant-aura");
    await closeUp(page, 1);
    // Avalanche Charge: a locked lane with magma vents, a crack racing down it
    await page.evaluate(() => {
      const a = (window as any).__combat.arena;
      a.raid.pillars.forEach((p: any) => (p.broken = true));
      const hero = a.heroes()[0];
      hero.x = 420;
      hero.y = 600;
    });
    await page.evaluate(() => (window as any).__combat.cast("avalanche"));
    await run(page, 0.8, 1);
    const lane = await page.evaluate(() =>
      (window as any).__combat.arena.raid.warnings.map((w: any) => w.kind),
    );
    expect(lane).toContain("avalanche");
    expect((await seen(page)).cracks).toBeGreaterThan(0);
    await snap(page, info, "ascendant-avalanche-lane");
    // the run, then the fissure it leaves, glowing hotter until it erupts
    let fissure = false;
    for (let i = 0; i < 40 && !fissure; i++) {
      await run(page, 0.1, 1);
      fissure = await page.evaluate(() =>
        (window as any).__combat.arena.raid.warnings.some(
          (w: any) => w.kind === "fissure",
        ),
      );
    }
    expect(fissure).toBe(true);
    await run(page, 0.6, 1);
    expect((await seen(page)).seam).toBe(1);
    await snap(page, info, "ascendant-fissure");
    await run(page, 0.6, 1);
    expect((await seen(page)).fissure).toBe(1);
    await snap(page, info, "ascendant-fissure-erupts");
    await run(page, 1.5);
    // Twin Slam: ring 1 round the boss (one dot), ring 2 toward the raider (two)
    await page.evaluate(() => {
      const a = (window as any).__combat.arena,
        boss = a.boss(),
        hero = a.heroes()[0];
      boss.x = 1100;
      boss.y = 450;
      hero.x = 560;
      hero.y = 470;
    });
    await page.evaluate(() => (window as any).__combat.cast("twin-slam"));
    await run(page, 0.7, 1);
    const rings = await page.evaluate(() =>
      (window as any).__combat.arena.raid.warnings
        .filter((w: any) => w.kind === "twin-slam")
        .map((w: any) => w.chain),
    );
    expect(rings).toEqual([2, 1]);
    const pose = await rig(page);
    // rearing for the stomp
    expect(pose.frames.some((f: string) => f.startsWith("bodyR_"))).toBe(true);
    await snap(page, info, "ascendant-twin-slam");
    await run(page, 0.7, 1);
    await snap(page, info, "ascendant-twin-slam-second");
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});
