import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle, snap } from "./helpers";

// Snoozaku, the dream-eating baku (the "somnara" raid), in the real raid
// scene on the Cloud Deck: its atlas is painted once when the scene starts,
// and each frame only places images from it (boss-snoozaku-rig.ts). The
// server's own combat runs in the page (boss-combat-demo.ts).
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
      boss: "somnara",
      pos: [560, 450, 720, 600],
    }),
  );
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  await page.evaluate(async () => {
    const { createBossCombatDemo } = await import("/boss-combat-demo.ts");
    (window as any).__combat = createBossCombatDemo("somnara", true, false);
  });
  return errors;
}
/**
 * Run the server for `seconds`, a drawn frame after every few 1/30 s steps.
 * With window.__pin set, the boss keeps facing that way (the arena turns it
 * the way it drifts).
 */
const run = (page: Page, seconds: number, every = 3) =>
  page.evaluate(
    async ([seconds, every]) => {
      const w = window as any,
        c = w.__combat;
      for (let i = 0; i < Math.round(seconds * 30); i++) {
        c.step(1 / 30);
        if (w.__pin !== undefined) {
          c.arena.boss().angle = w.__pin;
          if (i % every === every - 1) c.snapshot();
        }
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
/** The baku's rig this frame: facing, view, expression, visible images, atlas size. */
const rig = (page: Page) =>
  page.evaluate(() => {
    const scenes = (window as any).__battle.scene.getScenes(true);
    const list = scenes.flatMap((s: any) => s.children.list);
    const root = list.find((o: any) => o.name === "snoozaku-boss");
    const images = (root?.list ?? [])
      .flatMap((c: any) => c.list ?? [])
      .filter((o: any) => o.visible && o.alpha > 0.01);
    const tex = scenes
      .map((s: any) => s.textures.get("snoozaku-atlas"))
      .find((t: any) => t && t.key === "snoozaku-atlas");
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
          s.children.list.some((o: any) => o.name === "snoozaku-boss"),
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

test("Snoozaku stands in eight facings from one atlas, a few images each", async ({
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
      // standing: legs, body, head, mouth, trunk, eyes, cap, wisps (+ glows): about 20 at most
      expect(r.images).toBeLessThanOrEqual(20);
      const face0 = r.frames.some((f: string) => f.startsWith("eyes_"));
      expect(face0).toBe(r.view <= 2);
      expect(r.frames.some((f: string) => f.startsWith("mouth_"))).toBe(
        r.view <= 2,
      );
      expect(r.frames.some((f: string) => f.startsWith("cap_"))).toBe(true);
      await closeUp(page, 3, -60);
      await snap(page, info, `snoozaku-facing-${i * 45}`);
      if ([0, 1, 2, 7].includes(i)) {
        // the face close up: eyes level, trunk and mouth on the face's midline
        await closeUp(page, 7, -72);
        await snap(page, info, `snoozaku-face-${i * 45}`);
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

test("Snoozaku's attacks have their poses: lullaby, trunk slam, bubbles, stars, snore, dream, stagger, woken, defeat", async ({
  browser,
}, info) => {
  test.setTimeout(600_000);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });
  try {
    const page = await context.newPage();
    const errors = await raid(page);
    await face(page, Math.PI / 4);
    await run(page, 0.4);
    let peak = 0;
    const pose = async (name: string, zoom = 2.2, faceDy?: number) => {
      const r = await rig(page);
      peak = Math.max(peak, r.images);
      await closeUp(page, zoom, -60);
      await snap(page, info, `snoozaku-${name}`);
      if (faceDy !== undefined) {
        await closeUp(page, 6, faceDy);
        await snap(page, info, `snoozaku-${name}-face`);
      }
      await closeUp(page, 1);
      return r;
    };
    // cast at a raider, then turn the baku to face where we look from (the
    // server aims it once, at the cast; the demo's raiders keep circling)
    let facing = Math.PI / 2;
    const cast = (kind: string) =>
      page.evaluate(
        ([k, angle]) => {
          const c = (window as any).__combat;
          c.cast(k);
          c.arena.boss().angle = angle;
          (window as any).__pin = angle;
        },
        [kind, facing] as const,
      );
    const towards = (view: "front" | "right") => {
      facing = view === "front" ? Math.PI / 2 : 0;
    };
    // the lullaby: the trunk raised, humming with its eyes shut, notes rising
    await cast("lullaby");
    await run(page, 0.7);
    const lull = await pose("lullaby-windup", 2.6, -70);
    expect(lull.frames.some((f: string) => /^trunk_\d_up$/.test(f))).toBe(true);
    expect(lull.frames.some((f: string) => /^eyes_\d_closed$/.test(f))).toBe(
      true,
    );
    expect(lull.frames).toContain("note");
    await run(page, 2.5);
    // the trunk slam: it rears back with a sly look, then the trunk slams down the lane
    towards("right");
    await run(page, 0.3);
    await cast("tail-splash");
    await run(page, 0.9);
    const wind = await pose("trunk-slam-windup", 2.2, -60);
    expect(wind.expr).toBe("glare");
    expect(wind.frames.some((f: string) => /^trunk_\d_up$/.test(f))).toBe(true);
    await run(page, 0.45);
    const slam = await pose("trunk-slam");
    expect(slam.frames.some((f: string) => /^trunk_\d_slam$/.test(f))).toBe(
      true,
    );
    expect(slam.expr).toBe("wide");
    await run(page, 2);
    // dream bubbles: puffed up, blowing through the trunk
    await cast("dream-bubbles");
    await run(page, 0.6);
    const bub = await pose("bubbles");
    expect(bub.frames).toContain("bubble");
    await run(page, 2);
    // falling stars: nose to the sky, eyes wide, the cap blazing
    towards("front");
    await cast("falling-stars");
    await run(page, 1.1);
    const stars = await pose("falling-stars", 2.2, -70);
    expect(stars.expr).toBe("wide");
    await run(page, 2);
    // the thunder snore: asleep on purpose, snoring Zs, the Quiet Zone open
    await cast("whale-song");
    await run(page, 1.5);
    const snore = await pose("thunder-snore");
    expect(snore.expr).toBe("closed");
    expect(snore.frames).toContain("zz");
    await run(page, 3.2);
    // the dream: asleep and dreaming, its pompom aglow
    await cast("dream-sequence");
    await run(page, 1.2);
    const dream = await pose("dream", 2.2, -70);
    expect(dream.expr).toBe("closed");
    await page.evaluate(() => {
      const a = (window as any).__combat.arena;
      a.raid.dream = undefined;
    });
    await run(page, 0.5);
    // woken: eyes popped, the star-heart open with its ring
    await page.evaluate(() => {
      const a = (window as any).__combat.arena;
      a.raid.exposedUntil = a.time + 5;
    });
    await run(page, 0.6);
    const woke = await pose("woken", 2.6, -70);
    expect(woke.expr).toBe("wide");
    expect(woke.frames).toContain("heart");
    // staggered: dizzy, stars round its head
    await page.evaluate(() => {
      const a = (window as any).__combat.arena;
      a.raid.exposedUntil = 0;
      a.raid.staggerUntil = a.time + 5;
    });
    await run(page, 0.6);
    const stagger = await pose("stagger", 2.6, -70);
    expect(stagger.expr).toBe("dizzy");
    expect(stagger.frames).toContain("star_1");
    // phase 3: star patterns on the body, more wisps, the cap aglow
    await page.evaluate(() => {
      const a = (window as any).__combat.arena;
      a.raid.staggerUntil = 0;
      a.raid.phase = 3;
    });
    await run(page, 2.2);
    const p3 = await pose("phase3");
    expect(p3.frames.some((f: string) => /^over_\d_3$/.test(f))).toBe(true);
    expect(p3.frames.filter((f: string) => f.startsWith("wisp_")).length).toBe(
      5,
    );
    // defeat: it curls up asleep
    await page.evaluate(() => {
      const a = (window as any).__combat.arena,
        boss = a.boss();
      boss.hp = 0;
      a.raid.result = "victory";
    });
    await run(page, 3.4);
    const down = await pose("defeat", 2.4, -50);
    expect(down.frames.some((f: string) => /^paws_\d$/.test(f))).toBe(true);
    expect(down.expr).toBe("closed");
    // never more than about sixty images, however busy
    expect(peak).toBeLessThanOrEqual(60);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
