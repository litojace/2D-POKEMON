import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle, snap } from "./helpers";

// Cragmuff, the crystal-horned mountain ram (the "grumblecrag" raid), in the
// real raid scene: its atlas is painted once when the scene starts, and
// each frame only places images from it (boss-cragmuff-rig.ts). The server's
// own combat runs in the page (boss-combat-demo.ts).
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
/** The ram's rig this frame: facing, view, expression, visible images, atlas size. */
const rig = (page: Page) =>
  page.evaluate(() => {
    const scenes = (window as any).__battle.scene.getScenes(true);
    const list = scenes.flatMap((s: any) => s.children.list);
    const root = list.find((o: any) => o.name === "cragmuff-boss");
    const images = (root?.list ?? [])
      .flatMap((c: any) => c.list ?? [])
      .filter((o: any) => o.visible && o.alpha > 0.01);
    const tex = scenes
      .map((s: any) => s.textures.get("cragmuff-atlas"))
      .find((t: any) => t && t.key === "cragmuff-atlas");
    const src = tex?.getSourceImage();
    return {
      visible: !!root?.visible,
      facing: root?.getData("facing"),
      view: root?.getData("view"),
      expr: root?.getData("expr"),
      frames: images.map((o: any) => o.frame.name as string),
      images: images.length,
      atlasBytes: src ? src.width * src.height * 4 : 0,
      root: root ? { x: root.x, y: root.y, s: root.scaleX } : null,
    };
  });
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
/** Zoom the battle camera onto the boss (for close-ups): set after the scene's own camera update. */
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

test("Cragmuff stands in eight facings from one atlas, a few images each", async ({
  browser,
}, info) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });
  try {
    const page = await context.newPage();
    const errors = await raid(page);
    await run(page, 0.3);
    const seen: number[] = [];
    for (let i = 0; i < 8; i++) {
      // facing i: i·45° from towards the camera; screen angle = 90° − yaw
      await face(page, Math.PI / 2 - (i * Math.PI) / 4);
      await hold(page);
      const r = await rig(page);
      seen.push(r.facing);
      expect(r.visible).toBe(true);
      // standing still: legs, fleece, horns behind, head, eyes, mouth, horns in front (+ glows)
      expect(r.images).toBeLessThanOrEqual(11);
      if (r.view <= 2)
        expect(r.frames.some((f: string) => f.startsWith("eyes_"))).toBe(true);
      else
        expect(r.frames.some((f: string) => f.startsWith("eyes_"))).toBe(false);
      await closeUp(page, 3.2, -55);
      await snap(page, info, `cragmuff-facing-${i * 45}`);
      if ([0, 1, 2, 7].includes(i)) {
        // the face close up: eyes level, nose and mouth on the face's midline
        await closeUp(page, 7, -40);
        await snap(page, info, `cragmuff-face-${i * 45}`);
      }
      await closeUp(page, 1);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const r = await rig(page);
    expect(r.atlasBytes).toBeGreaterThan(0);
    expect(r.atlasBytes).toBeLessThanOrEqual(8 * 1024 * 1024);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Cragmuff's attacks have their poses: charge, rear-up and stomp, volley, meteor, stagger, defeat", async ({
  browser,
}, info) => {
  test.setTimeout(420_000);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });
  try {
    const page = await context.newPage();
    const errors = await raid(page);
    await face(page, Math.PI);
    await run(page, 0.4);
    const pose = async (name: string, zoom = 2.2, faceDy?: number) => {
      await closeUp(page, zoom, -50);
      await snap(page, info, `cragmuff-${name}`);
      if (faceDy !== undefined) {
        // and the face close up, for the eye, nose and mouth check
        await closeUp(page, 6, faceDy);
        await snap(page, info, `cragmuff-${name}-face`);
      }
      await closeUp(page, 1);
      return rig(page);
    };
    // charge wind-up (side view): head down, the glare still shows over the horn
    await page.evaluate(() => (window as any).__combat.cast("charge"));
    await run(page, 1.0);
    const wind = await pose("charge-windup", 3, -30);
    expect(
      wind.frames.some((f: string) => /^eyes_\d_(glare|closed)$/.test(f)),
    ).toBe(true);
    await run(page, 1.6);
    // the slam: up on the hind legs (its own drawing), then the stomp
    await face(page, Math.PI);
    await run(page, 0.6);
    await page.evaluate(() => (window as any).__combat.cast("slam"));
    await run(page, 0.8);
    const rear = await pose("slam-rear", 2.2, -75);
    expect(rear.frames.some((f: string) => f.startsWith("bodyR_"))).toBe(true);
    await run(page, 0.5);
    const stomp = await pose("slam-stomp");
    expect(stomp.frames.some((f: string) => f.startsWith("bodyR_"))).toBe(
      false,
    );
    await run(page, 2.5);
    // the volley wind-up: rocks stuck in the puffed fleece
    await page.evaluate(() => (window as any).__combat.cast("volley"));
    await run(page, 1.0);
    const volley = await pose("volley-windup");
    expect(volley.frames.some((f: string) => f.startsWith("rock_"))).toBe(true);
    await run(page, 1.5);
    // the meteor: rearing with the horns blazing
    await page.evaluate(() => (window as any).__combat.cast("share"));
    await run(page, 1.5);
    const meteor = await pose("meteor-rear");
    expect(meteor.frames.some((f: string) => f.startsWith("bodyR_"))).toBe(
      true,
    );
    await run(page, 2.2);
    // staggered: belly down, the core open, dizzy
    await page.evaluate(() => {
      const a = (window as any).__combat.arena;
      a.raid.staggerUntil = a.time + 5;
    });
    await run(page, 0.6);
    const stagger = await pose("stagger", 3, -20);
    expect(stagger.expr).toBe("dizzy");
    expect(stagger.frames).toContain("gem_open");
    // phase 3: cracks and crystals in the fleece
    await page.evaluate(() => {
      const a = (window as any).__combat.arena;
      a.raid.staggerUntil = 0;
      a.raid.phase = 3;
    });
    await run(page, 2.2);
    const p3 = await pose("phase3");
    expect(p3.frames.some((f: string) => /^over_\d_3$/.test(f))).toBe(true);
    // defeat: sat down, crystals dark
    await page.evaluate(() => {
      const a = (window as any).__combat.arena,
        boss = a.boss();
      boss.hp = 0;
      a.raid.result = "victory";
    });
    await run(page, 3.4);
    const down = await pose("defeat", 2.2, -30);
    expect(down.frames.some((f: string) => /^hornsFd_/.test(f))).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
