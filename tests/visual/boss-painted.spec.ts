import { expect, test, type Page } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle, snap } from "./helpers";

async function review(page: Page, preload = true) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/boss-review-page", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<body style="margin:0"></body>',
    }),
  );
  await page.goto("/boss-review-page");
  await page.evaluate(async (preload) => {
    const { reviewBosses } = await import("/boss-review.ts");
    const w = window as any;
    w.__bossReview = reviewBosses(preload);
    await w.__bossReview.loaded;
    w.__bossReview.game.loop.sleep();
  }, preload);
  return errors;
}
const pose = (page: Page) =>
  page.evaluate(() => {
    const w = window as any,
      scene = w.__bossReview.rows[0].g.scene;
    return scene.children.list
      .filter((o: any) => o.name.startsWith("painted-boss-"))
      .map((root: any) => ({
        name: root.name,
        visible: root.visible,
        alpha: root.alpha,
        depth: root.depth,
        parts: root.list[0].list
          .filter((o: any) => o.type === "Image" && o.visible)
          .map((o: any) => ({
            name: o.name,
            x: o.x,
            y: o.y,
            rotation: o.rotation,
            sx: o.scaleX,
            sy: o.scaleY,
            alpha: o.alpha,
            frame: o.frame.name,
            texture: o.texture.key,
          })),
      }));
  });

test("all seven living boss rigs animate, hold a pause and keep combat snapshots immutable", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1600, height: 2000 });
  const errors = await review(page);
  await page.evaluate(() => (window as any).__bossReview.frame(1, 0, false));
  const start = await pose(page);
  expect(start).toHaveLength(8); // two independently posed Storm Twins
  expect(start.every((r) => r.visible && r.parts.length >= 2)).toBe(true);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    for (let n = 1; n <= 80; n++) r.frame(2, n * 0.025, false);
  });
  const moved = await pose(page);
  for (const rig of moved) {
    const before = start.find((r) => r.name === rig.name)!;
    expect(
      rig.parts.filter((p) => {
        const b = before.parts.find((q) => q.name === p.name);
        return (
          b &&
          (b.x !== p.x ||
            b.y !== p.y ||
            b.rotation !== p.rotation ||
            b.sy !== p.sy)
        );
      }).length,
      rig.name,
    ).toBeGreaterThanOrEqual(2);
    for (const p of rig.parts)
      for (const n of [p.x, p.y, p.rotation, p.sx, p.sy, p.alpha])
        expect(Number.isFinite(n)).toBe(true);
  }
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    for (const row of r.rows) row.state.phase = "paused";
    r.frame(2, 2.1, false);
  });
  const paused = await pose(page);
  await page.evaluate(() => (window as any).__bossReview.frame(2, 20, false));
  expect(await pose(page)).toEqual(paused);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    for (const row of r.rows) row.state.phase = "playing";
    r.frame(3, 20.025, true);
  });
  const reduced = await pose(page);
  await page.evaluate(() => (window as any).__bossReview.frame(3, 22, true));
  expect(await pose(page)).toEqual(reduced);
  await snap(page, info, "seven-painted-bosses");
  expect(errors).toEqual([]);
});

test("copies, submerging and fades cannot leave stale boss sprites on cleared layers", async ({
  page,
}) => {
  const errors = await review(page);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    const gloom = r.rows.find((o: any) => o.id === "gloomshade");
    gloom.state.raid.decoys = [{ id: 42, x: 150, y: 0 }];
    r.frame(1, 0, false);
    for (let n = 1; n <= 30; n++) r.frame(1, n * 0.025, false);
  });
  expect(
    (await pose(page)).find((r) => r.name.endsWith("shade-42"))?.visible,
  ).toBe(true);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    r.rows.find((o: any) => o.id === "gloomshade").state.raid.decoys = [];
    r.rows.find((o: any) => o.id === "tidewyrm").state.raid.submerged = true;
    r.frame(1, 0.8, false);
  });
  const hidden = await pose(page);
  expect(hidden.find((r) => r.name.endsWith("shade-42"))?.visible).toBe(false);
  expect(hidden.find((r) => r.name.includes("tidewyrm"))?.visible).toBe(false);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    const s = r.rows.find((o: any) => o.id === "somnara").state;
    s.raid.result = "victory";
    s.players.find((p: any) => p.raidBoss).hp = 0;
    for (let n = 1; n <= 40; n++) r.frame(1, 0.8 + n * 0.05, false);
  });
  expect(
    (await pose(page)).find((r) => r.name.includes("somnara"))!.alpha,
  ).toBeCloseTo(0.3);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    r.game.loop.frame += 121;
    r.frame(1, 3, false);
  });
  expect(
    (await pose(page)).find((r) => r.name.endsWith("shade-42")),
  ).toBeUndefined();
  expect(errors).toEqual([]);
});

test("late expedition loads retain only the current boss atlas and can revisit a boss", async ({
  page,
}) => {
  const errors = await review(page, false);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    r.retain("grumblecrag");
    r.frame(1, 0, false, ["grumblecrag"]);
  });
  const loaded = async (id: string) => {
    await expect
      .poll(async () => {
        await page.evaluate(
          (id) => (window as any).__bossReview.frame(1, 1, false, [id]),
          id,
        );
        return (await pose(page)).some((r) => r.name.includes(id) && r.visible);
      })
      .toBe(true);
  };
  await loaded("grumblecrag");
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    r.retain("emberwing");
    r.frame(1, 1.05, false, ["emberwing"]);
  });
  await loaded("emberwing");
  expect(
    await page.evaluate(() =>
      (window as any).__bossReview.game.textures
        .getTextureKeys()
        .filter((k: string) => k.startsWith("raid-painted-")),
    ),
  ).toEqual(["raid-painted-emberwing"]);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    r.retain("grumblecrag");
    r.frame(1, 1.1, false, ["grumblecrag"]);
  });
  await loaded("grumblecrag");
  expect(errors).toEqual([]);
});

for (const mobile of [false, true])
  test(`${mobile ? "iPhone Home Screen" : "desktop"} uses painted art inside the actual raid scene`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 844, height: 390 }
        : { width: 1440, height: 900 },
      deviceScaleFactor: mobile ? 3 : 2,
      isMobile: mobile,
      hasTouch: mobile,
      ...(mobile
        ? {
            userAgent:
              "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
          }
        : {}),
    });
    try {
      const page = await context.newPage();
      if (mobile)
        await page.addInitScript(() =>
          Object.defineProperty(navigator, "standalone", { value: true }),
        );
      await page.route(
        /\/apps\/client\/src\/main\.ts(?:\?|$)/,
        async (route) => {
          const response = await route.fetch(),
            body = await response.text();
          const marker =
            "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
          expect(body).toContain(marker);
          await route.fulfill({
            response,
            body: body.replace(
              marker,
              "window.__paintedBattle=gameInstance;" + marker,
            ),
          });
        },
      );
      const errors = await openTown(page);
      await page.evaluate(() =>
        (window as any).__room("raid", {
          boss: "emberwing",
          pos: [500, 450, 700, 600],
        }),
      );
      await openTownMenu(page);
      await page.click(".town-play");
      await page.click("#play-create");
      await pushUntilBattle(page);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const game = (window as any).__paintedBattle;
            return !!game?.scene
              .getScenes(true)
              .some((s: any) =>
                s.children.list.some(
                  (o: any) =>
                    o.name === "painted-boss-emberwing:body" && o.visible,
                ),
              );
          }),
        )
        .toBe(true);
      expect(
        await page.evaluate(() =>
          (window as any).__paintedBattle.textures
            .getTextureKeys()
            .filter((k: string) => k.startsWith("raid-painted-")),
        ),
      ).toEqual(["raid-painted-emberwing"]);
      await snap(page, info, `painted-raid-${mobile ? "iphone" : "desktop"}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("an unavailable art file keeps the encounter playable without a request loop", async ({
  page,
}) => {
  let requests = 0;
  await page.route(/raid-painted-grumblecrag\.webp/, (route) => {
    if (route.request().resourceType() === "script") return route.continue();
    requests++;
    return route.abort();
  });
  const errors = await review(page, false);
  await page.evaluate(() =>
    (window as any).__bossReview.frame(1, 0, false, ["grumblecrag"]),
  );
  await expect.poll(() => requests).toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__bossReview.rows[0].g.scene.load.isLoading(),
      ),
    )
    .toBe(false);
  // Phaser may retry a failed XHR twice; rendering must not restart the loader.
  const attempts = requests;
  expect(attempts).toBeLessThanOrEqual(3);
  const commands = await page.evaluate(() => {
    const r = (window as any).__bossReview;
    for (let n = 1; n <= 40; n++) r.frame(1, n * 0.05, false, ["grumblecrag"]);
    return r.rows[0].g.commandBuffer.length;
  });
  await page.waitForTimeout(100);
  expect(requests).toBe(attempts);
  expect(commands).toBeGreaterThan(100);
  expect(await pose(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("stranded Tidewyrm keeps its neck covered and its coil over the ground in both directions", async ({
  page,
}, info) => {
  const errors = await review(page);
  for (const facing of [1, -1]) {
    const joint = await page.evaluate((facing) => {
      const r = (window as any).__bossReview,
        row = r.rows.find((o: any) => o.id === "tidewyrm"),
        boss = row.state.players.find((p: any) => p.raidBoss);
      if (!row.state.raid.exposedUntil) r.frame();
      row.state.raid.exposedUntil = 20;
      row.state.raid.islands = [
        { x: boss.x, y: boss.y, radius: 100, sunk: false },
      ];
      boss.angle = facing > 0 ? 0 : Math.PI;
      r.frame(1, 6, true);
      const root = row.g.scene.children.list.find(
          (o: any) => o.name === "painted-boss-tidewyrm:body",
        ),
        parts = root.list[0].list;
      const head = parts.find((o: any) => o.name === "head"),
        coil = parts.find((o: any) => o.name === "coil");
      const socket = coil
        .getWorldTransformMatrix()
        .transformPoint(
          ((coil.flipX ? 1 - 0.388 : 0.388) - coil.originX) * coil.width,
          (0.35 - coil.originY) * coil.height,
        );
      const local = head
        .getWorldTransformMatrix()
        .applyInverse(socket.x, socket.y);
      let u = (local.x + head.displayOriginX) / head.width;
      if (head.flipX) u = 1 - u;
      const v = (local.y + head.displayOriginY) / head.height;
      const canvas = document.createElement("canvas"),
        source = head.texture.getSourceImage();
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(source, 0, 0);
      const alpha =
        u >= 0 && u <= 1 && v >= 0 && v <= 1
          ? ctx.getImageData(
              Math.floor(head.frame.cutX + u * head.frame.cutWidth),
              Math.floor(head.frame.cutY + v * head.frame.cutHeight),
              1,
              1,
            ).data[3]
          : 0;
      const ground = row.g
          .getWorldTransformMatrix()
          .transformPoint(boss.x, boss.y + 40),
        bounds = coil.getBounds();
      return {
        alpha,
        grounded:
          bounds.left < ground.x &&
          bounds.right > ground.x &&
          bounds.top < ground.y &&
          bounds.bottom > ground.y,
      };
    }, facing);
    expect(joint.alpha).toBeGreaterThan(220);
    expect(joint.grounded).toBe(true);
    await snap(page, info, `tidewyrm-land-${facing > 0 ? "right" : "left"}`);
  }
  expect(errors).toEqual([]);
});
