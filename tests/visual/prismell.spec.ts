import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle, snap } from "./helpers";

// Prismell, the prism-shelled snail (the "prismatail" raid), in the real raid
// scene: its atlas is painted once when the scene starts, and each frame only
// places images from it (boss-prismell-rig.ts). The server's own combat runs
// in the page (boss-combat-demo.ts); the Sun Atrium is unchanged.
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
      boss: "prismatail",
      pos: [500, 450, 700, 600],
    }),
  );
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  await page.evaluate(async () => {
    const { createBossCombatDemo } = await import("/boss-combat-demo.ts");
    const c = createBossCombatDemo("prismatail", true, false);
    // Hold the light relay off: the circling raiders could otherwise carry
    // the light to the heart mid-test (the mirrors are laid out from a random
    // seed), and a completed relay clears the warnings, so a wind-up being
    // checked would vanish. The tests open the heart by hand where needed.
    (c.arena as any).relayAt = 1e9;
    (window as any).__combat = c;
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
/** The snail's rig this frame: facing, view, expression, visible images, atlas size. */
const rig = (page: Page) =>
  page.evaluate(() => {
    const scenes = (window as any).__battle.scene.getScenes(true);
    const list = scenes.flatMap((s: any) => s.children.list);
    const root = list.find((o: any) => o.name === "prismell-boss");
    const all = (root?.list ?? []).flatMap((c: any) => c.list ?? []);
    const images = all.filter(
      (o: any) => o.type === "Image" && o.visible && o.alpha > 0.01,
    );
    const tex = scenes
      .map((s: any) => s.textures.get("prismell-atlas"))
      .find((t: any) => t && t.key === "prismell-atlas");
    const src = tex?.getSourceImage();
    const part = (name: string) => {
      const o = images.find((i: any) => i.name === `prismell-${name}`);
      return o
        ? { frame: o.frame.name, x: o.x, y: o.y, tint: o.tintTopLeft }
        : undefined;
    };
    return {
      visible: !!root?.visible,
      facing: root?.getData("facing"),
      view: root?.getData("view"),
      expr: root?.getData("expr"),
      frames: images.map((o: any) => o.frame.name as string),
      images: images.length,
      atlasBytes: src ? src.width * src.height * 4 : 0,
      shell: part("shell"),
      head: part("head"),
      eyes: part("eyes"),
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
          s.children.list.some((o: any) => o.name === "prismell-boss"),
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

test("Prismell stands in eight facings from one atlas, a few images each", async ({
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
      // standing still: body, shell, heart and shield, head, face, antennae (+ a few glows)
      expect(r.images).toBeLessThanOrEqual(20);
      expect(r.frames.some((f: string) => /^shell_\d_1$/.test(f))).toBe(true);
      if (r.view <= 2) {
        expect(r.frames.some((f: string) => f.startsWith("eyes_"))).toBe(true);
        // the head in front of the shell
        expect(r.frames.indexOf(r.head!.frame)).toBeGreaterThan(
          r.frames.indexOf(r.shell!.frame),
        );
      } else
        expect(r.frames.some((f: string) => f.startsWith("eyes_"))).toBe(false);
      await closeUp(page, 3.2, -70);
      await snap(page, info, `prismell-facing-${i * 45}`);
      if ([0, 1, 2, 7].includes(i)) {
        // the face close up: eyes level, mouth on the face's centre line
        await closeUp(page, 8, -66);
        await snap(page, info, `prismell-face-${i * 45}`);
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

test("Prismell's attacks have their poses: lance, fan, glare, halo, the open heart, stagger, phase 3, defeat", async ({
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
      await closeUp(page, zoom, -70);
      await snap(page, info, `prismell-${name}`);
      if (faceDy !== undefined) {
        await closeUp(page, 7, faceDy);
        await snap(page, info, `prismell-${name}-face`);
      }
      await closeUp(page, 1);
      return rig(page);
    };
    // Prism Lance: it hunkers down, glaring, the heart's light gathering
    await page.evaluate(() => {
      const c = (window as any).__combat;
      c.arena.raid.exposedUntil = 0;
      c.cast("prism-lance");
    });
    await run(page, 0.8);
    const lance = await pose("lance-windup", 2.2, -66);
    expect(lance.expr).toBe("glare");
    expect(lance.frames.some((f: string) => /^eyes_\d_glare$/.test(f))).toBe(
      true,
    );
    await run(page, 0.5);
    await snap(page, info, "prismell-lance-beam");
    await run(page, 1.5);
    // Fan Display: the shell shows off in the striking slice's colour
    await page.evaluate(() => (window as any).__combat.cast("fan-display"));
    await run(page, 1.1);
    const fan = await pose("fan-windup", 1.2);
    expect(fan.expr).toBe("closed");
    expect(fan.shell!.tint).not.toBe(0xffffff);
    await run(page, 2);
    // Glare: the shell flashes, spokes of light all round
    await page.evaluate(() => {
      const c = (window as any).__combat;
      c.arena.raid.exposedUntil = 0;
      c.cast("glare");
    });
    await run(page, 0.8);
    const glare = await pose("glare-windup");
    expect(
      glare.frames.filter((f: string) => f === "ray").length,
    ).toBeGreaterThanOrEqual(6);
    await run(page, 2);
    // Halo Crush (phase 2 attack): it rears up while the halo lifts off
    await page.evaluate(() => {
      (window as any).__combat.arena.raid.phase = 2;
      (window as any).__combat.cast("halo-crush");
    });
    await run(page, 1.2);
    const halo = await pose("halo-windup", 1.2);
    expect(halo.frames.some((f: string) => /^shell_\d_2$/.test(f))).toBe(true);
    await run(page, 2.2);
    // the light relay reaches the heart: the shield is gone, the heart blazes
    await page.evaluate(() => {
      const a = (window as any).__combat.arena;
      a.raid.exposedUntil = a.time + 5;
    });
    await run(page, 0.5);
    const open = await pose("heart-open", 2.2, -66);
    expect(open.frames).toContain("heart_open");
    expect(open.frames).not.toContain("shield");
    expect(open.expr).toBe("wide");
    // staggered: dizzy, stars, the heart open
    await page.evaluate(() => {
      const a = (window as any).__combat.arena;
      a.raid.exposedUntil = 0;
      a.raid.staggerUntil = a.time + 5;
    });
    await run(page, 0.6);
    const stagger = await pose("stagger", 2.2, -60);
    expect(stagger.expr).toBe("dizzy");
    expect(stagger.frames).toContain("star");
    // phase 3: more facets, more glints
    await page.evaluate(() => {
      const a = (window as any).__combat.arena;
      a.raid.staggerUntil = 0;
      a.raid.phase = 3;
    });
    await run(page, 2.2);
    const p3 = await pose("phase3");
    expect(p3.frames.some((f: string) => /^shell_\d_3$/.test(f))).toBe(true);
    // defeat: the shell goes dark and it tucks itself in
    await page.evaluate(() => {
      const a = (window as any).__combat.arena,
        boss = a.boss();
      boss.hp = 0;
      a.raid.result = "victory";
    });
    await run(page, 3.4);
    const down = await pose("defeat");
    expect(down.frames.some((f: string) => /^shellD_/.test(f))).toBe(true);
    expect(down.frames.some((f: string) => f.startsWith("eyes_"))).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Prismell's lance beam stays clear of its face, and the glare keeps the shell's facets", async ({
  browser,
}, info) => {
  test.setTimeout(720_000);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });
  try {
    const page = await context.newPage();
    const errors = await raid(page);
    await run(page, 0.3);
    // the lance in four facings: wind-up, then the beam just after it fires
    // (the raiders hold their places, so the snail keeps facing its target)
    for (const view of ["left", "front", "right", "back"] as const) {
      const name = view;
      await page.evaluate((v) => (window as any).__combat.face(v), view);
      await run(page, 0.2);
      await page.evaluate(() => {
        const c = (window as any).__combat;
        c.arena.raid.exposedUntil = 0;
        c.cast("prism-lance");
      });
      await run(page, 0.85, 2);
      await closeUp(page, 2.4, -60);
      await snap(page, info, `prismell-lance-${name}-windup`);
      await closeUp(page, 1);
      await run(page, 0.35, 2);
      await closeUp(page, 2.4, -60);
      await snap(page, info, `prismell-lance-${name}-beam`);
      await closeUp(page, 1);
      const r = await rig(page);
      expect(r.visible).toBe(true);
      await run(page, 1.2);
    }
    // the glare: wind-up, the moment it fires, and just after
    await face(page, Math.PI / 2);
    await run(page, 0.3);
    await page.evaluate(() => {
      const c = (window as any).__combat;
      c.arena.raid.exposedUntil = 0;
      c.cast("glare");
    });
    await run(page, 0.8, 2);
    await closeUp(page, 2.4, -60);
    await snap(page, info, "prismell-glare-windup-close");
    await closeUp(page, 1);
    await run(page, 0.3, 2);
    await closeUp(page, 2.4, -60);
    await snap(page, info, "prismell-glare-after-close");
    await closeUp(page, 1);
    await run(page, 1.5);
    // the heart open (relay landed)
    await page.evaluate(() => {
      const a = (window as any).__combat.arena;
      a.raid.exposedUntil = a.time + 5;
    });
    await run(page, 0.5);
    await closeUp(page, 2.4, -60);
    await snap(page, info, "prismell-exposed-close");
    await closeUp(page, 1);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
