import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle, snap } from "./helpers";

// Ascendant Tidelotl (the Spire's twentieth floor, Tidewyrm's id) in the
// real raid scene: its own pair of atlases, painted once (abyssal skin with
// bioluminescent spots, sea-glass gills, a crown of coral and glowing
// pearls), its aura, and its new attacks (the Breaker Wall with its calm
// lanes, the Geyser Line). The server's own combat runs in the page
// (boss-combat-demo.ts).
const MAIN = "lotl-main-ascendant",
  SKIN = "lotl-skin-ascendant";
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
      boss: "tidewyrm",
      pos: [500, 450, 700, 600],
    }),
  );
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  await page.evaluate(async () => {
    const { createBossCombatDemo } = await import("/boss-combat-demo.ts");
    (window as any).__combat = createBossCombatDemo(
      "tidewyrm",
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
/** The axolotl's rig this frame: facing, visible images (with transforms), atlas size. */
const rig = (page: Page) =>
  page.evaluate(
    ([main, skin]) => {
      const scenes = (window as any).__battle.scene.getScenes(true);
      const list = scenes.flatMap((s: any) => s.children.list);
      const root = list.find((o: any) => o.name === "vector-boss-tidewyrm");
      const parts: Record<string, any> = {};
      for (const o of root?.list.flatMap((c: any) => c.list ?? []) ?? [])
        if (o.visible && o.type === "Image" && o.alpha > 0.01)
          parts[o.name.replace("vector-part-", "")] = {
            x: o.x,
            y: o.y,
            r: o.rotation,
            sx: o.scaleX,
            sy: o.scaleY,
            frame: o.frame.name as string,
            texture: o.texture.key as string,
          };
      const bytes = [main, skin].reduce((sum, key) => {
        const tex = scenes
          .map((s: any) => s.textures.get(key))
          .find((t: any) => t && t.key === key);
        const src = tex?.getSourceImage();
        return sum + (src ? src.width * src.height * 4 : 0);
      }, 0);
      return {
        visible: !!root?.visible,
        facing: root?.getData("facing") as number,
        parts,
        textures: [
          ...new Set(Object.values(parts).map((p: any) => p.texture)),
        ].sort() as string[],
        bytes,
        raidAtlas: scenes.some((s: any) => s.textures.exists("lotl-main")),
      };
    },
    [MAIN, SKIN],
  );
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
          s.children.list.some((o: any) => o.name === "vector-boss-tidewyrm"),
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
/** The face and crown share the head's place and transform (no drift between pieces). */
function lockedToHead(parts: Record<string, any>, label: string) {
  const head = parts.head;
  expect(head, label).toBeTruthy();
  const m = (o: any) => [
    o.sx * Math.cos(o.r),
    o.sx * Math.sin(o.r),
    -o.sy * Math.sin(o.r),
    o.sy * Math.cos(o.r),
  ];
  for (const k of ["eyen", "eyef", "mouth", "pearl", "crownF", "crownB"]) {
    const f = parts[k];
    if (!f) continue;
    const at = `${label} ${k} (${f.frame})`;
    expect(f.x, at).toBeCloseTo(head.x, 3);
    expect(f.y, at).toBeCloseTo(head.y, 3);
    const mirror = k === "eyef" && /^eye_0_/.test(f.frame) ? -1 : 1;
    const hm = m(head),
      fm = m(f);
    const k0 = fm[3] / hm[3];
    expect(k0, at).toBeGreaterThan(0.6);
    expect(k0, at).toBeLessThan(1.4);
    expect(fm[0], at).toBeCloseTo(hm[0] * k0 * mirror, 4);
    expect(fm[1], at).toBeCloseTo(hm[1] * k0 * mirror, 4);
    expect(fm[2], at).toBeCloseTo(hm[2] * k0, 4);
  }
}
const context = (browser: import("@playwright/test").Browser) =>
  browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });

test("Ascendant Tidelotl floats in eight facings from its own atlases, crowned, its face locked to its head", async ({
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
      // Every image comes from the Ascendant atlases, never the raid's.
      expect(r.textures.every((t) => t === MAIN || t === SKIN)).toBe(true);
      // the crown: its near half over the head in every facing
      expect(r.parts.crownF?.frame, `facing ${i}`).toMatch(/^crownF_\d$/);
      const frames = Object.values(r.parts).map((p: any) => p.frame);
      // from the front and the sides the face shows; from behind it doesn't
      expect(
        frames.some((f) => f.startsWith("eye_")),
        `facing ${i}`,
      ).toBe(i !== 4);
      lockedToHead(r.parts, `facing ${i}`);
      await closeUp(page, 3, -50);
      await snap(page, info, `asc-tide-facing-${i * 45}`);
      if (i !== 4) {
        // the face close up: eyes level, mouth and pearl on the face's midline
        await closeUp(page, 6.5, -62);
        await snap(page, info, `asc-tide-face-${i * 45}`);
      }
      await closeUp(page, 1);
    }
    expect(seenFacings).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const r = await rig(page);
    expect(r.bytes).toBeGreaterThan(2 * 1024 * 1024);
    expect(r.bytes).toBeLessThanOrEqual(8 * 1024 * 1024);
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test("Ascendant Tidelotl's aura and new attacks: the Breaker Wall's calm lanes, the Geyser Line", async ({
  browser,
}, info) => {
  test.setTimeout(600_000);
  const ctx = await context(browser);
  try {
    const page = await ctx.newPage();
    const errors = await raid(page);
    await face(page, Math.PI / 2);
    await run(page, 0.6);
    // the aura: abyssal light on the water and rising motes, always on
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
    await closeUp(page, 2.2, -40);
    await snap(page, info, "asc-tide-aura");
    await closeUp(page, 1);

    // Breaker Wall: the edge darkens, calm lanes are bracketed
    await page.evaluate(() => {
      const hero = (window as any).__combat.arena.heroes()[0];
      hero.x = 420;
      hero.y = 600;
    });
    await page.evaluate(() => (window as any).__combat.cast("breaker"));
    await run(page, 0.8, 1);
    const wall = await page.evaluate(() =>
      (window as any).__combat.arena.raid.warnings.map((w: any) => ({
        kind: w.kind,
        gaps: w.gaps,
        gapWidth: w.gapWidth,
      })),
    );
    expect(wall.map((w: any) => w.kind)).toContain("breaker");
    expect(wall[0].gaps.length).toBeGreaterThanOrEqual(2);
    await snap(page, info, "asc-tide-breaker-warning");
    // the wall crosses: towering water broken where the lanes run
    let crossing = false;
    for (let i = 0; i < 30 && !crossing; i++) {
      await run(page, 0.1, 1);
      crossing = await page.evaluate(() =>
        ((window as any).__combat.arena.raid.waves ?? []).some(
          (w: any) => w.gaps,
        ),
      );
    }
    expect(crossing).toBe(true);
    await run(page, 0.7, 1);
    await snap(page, info, "asc-tide-breaker-wall");
    await run(page, 3);

    // Geyser Line: three rings with their order in dots, then a column of water
    await page.evaluate(() => {
      const a = (window as any).__combat.arena,
        hero = a.heroes()[0];
      hero.x = 520;
      hero.y = 700;
      hero.vx = hero.vy = 0;
    });
    await page.evaluate(() => (window as any).__combat.cast("geyser"));
    await run(page, 0.6, 1);
    const rings = await page.evaluate(() =>
      (window as any).__combat.arena.raid.warnings
        .filter((w: any) => w.kind === "geyser")
        .map((w: any) => w.chain),
    );
    expect(rings).toEqual([1, 2, 3]);
    await snap(page, info, "asc-tide-geyser-line");
    let erupted = false;
    for (let i = 0; i < 30 && !erupted; i++) {
      await run(page, 0.05, 1);
      erupted = await page.evaluate(
        () =>
          (window as any).__combat.arena.raid.warnings.filter(
            (w: any) => w.kind === "geyser",
          ).length < 3,
      );
    }
    expect(erupted).toBe(true);
    await run(page, 0.15, 1);
    await snap(page, info, "asc-tide-geyser-erupts");
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});
