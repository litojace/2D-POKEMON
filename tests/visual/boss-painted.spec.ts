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
        actor: {
          x: root.list[0].x,
          y: root.list[0].y,
          sx: root.list[0].scaleX,
          sy: root.list[0].scaleY,
        },
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
  expect(
    start.every(
      (r) =>
        r.visible &&
        r.parts.length >= 1 &&
        r.parts.length <= 2 &&
        r.parts.every((p) => p.name.startsWith("complete-body-")),
    ),
  ).toBe(true);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    const kinds = {
      grumblecrag: "slam",
      tidewyrm: "bubbles",
      gloomshade: "pulse",
      somnara: "lullaby",
      prismatail: "fan-display",
      emberwing: "flame-ring",
      "storm-twins": "thunderclap",
    };
    for (const row of r.rows) {
      const boss = row.state.players.find((p: any) => p.raidBoss);
      row.state.raid.warnings = [
        {
          id: 91,
          kind: kinds[row.id],
          startedAt: 0,
          at: 1.4,
          x: boss.x,
          y: boss.y,
          tx: boss.x,
          ty: boss.y,
          radius: 120,
        },
      ];
    }
    for (let n = 1; n <= 12; n++) r.frame(1, n * 0.1, false);
  });
  const gathered = await pose(page);
  for (const rig of gathered)
    expect(
      rig.parts.some(
        (p) =>
          p.frame ===
          (rig.name.includes("emberwing") || rig.name.endsWith("twin-1")
            ? "pose-5"
            : "pose-1"),
      ),
    ).toBe(true);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    for (const row of r.rows) row.state.raid.warnings = [];
    r.frame(1, 1.45, false);
    r.frame(1, 1.5, false);
    r.frame(1, 1.55, false);
  });
  const striking = await pose(page);
  for (const rig of striking) {
    expect(rig.parts.length).toBeLessThanOrEqual(2);
    expect(
      rig.parts.some(
        (p) =>
          p.frame ===
          (rig.name.includes("emberwing") || rig.name.endsWith("twin-1")
            ? "pose-6"
            : "pose-2"),
      ),
    ).toBe(true);
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
  // A retry resets the presentation clock while the same scene/actors survive.
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    for (const row of r.rows)
      row.state.raid.warnings = [
        {
          id: 101,
          kind: "slam",
          startedAt: 29,
          at: 31,
          x: 0,
          y: 0,
          tx: 0,
          ty: 0,
          radius: 100,
        },
      ];
    r.frame(1, 30, false);
    r.frame(1, 30.05, false);
    for (const row of r.rows) row.state.raid.warnings = [];
    r.frame(1, 0, false);
  });
  for (const rig of await pose(page)) {
    expect(rig.parts).toHaveLength(1);
    expect(rig.parts[0].frame).toBe(
      rig.name.includes("emberwing") || rig.name.endsWith("twin-1")
        ? "pose-4"
        : "pose-0",
    );
  }
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
  await page.route(/raid-whole-grumblecrag\.webp/, (route) => {
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

test("stranded Tidewyrm is one complete grounded creature in both directions", async ({
  page,
}, info) => {
  const errors = await review(page);
  for (const facing of [1, -1]) {
    const result = await page.evaluate((facing) => {
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
        images = root.list[0].list.filter(
          (o: any) => o.type === "Image" && o.visible,
        );
      const image = images[0],
        bounds = image.getBounds(),
        f = r.poseData.tidewyrm.poses[4],
        footU =
          (image.flipX ? f.rect[2] - f.anchor[0] : f.anchor[0]) / f.rect[2],
        ground = row.g
          .getWorldTransformMatrix()
          .transformPoint(boss.x, boss.y + 35);
      return {
        count: images.length,
        frame: image.frame.name,
        flip: image.flipX,
        anchorError: Math.round(bounds.left + footU * bounds.width - ground.x),
        grounded:
          bounds.left < ground.x &&
          bounds.right > ground.x &&
          bounds.top < ground.y &&
          bounds.bottom > ground.y,
      };
    }, facing);
    expect(result).toEqual({
      count: 1,
      frame: "pose-4",
      flip: facing < 0,
      anchorError: 0,
      grounded: true,
    });
    await snap(
      page,
      info,
      `whole-tidewyrm-land-${facing > 0 ? "right" : "left"}`,
    );
  }
  expect(errors).toEqual([]);
});

test("serpent and peacock heads share a continuous opaque silhouette with their bodies", async ({
  page,
}) => {
  const errors = await review(page);
  const results = await page.evaluate(() => {
    const r = (window as any).__bossReview;
    const heads = {
      tidewyrm: [
        [390, 165],
        [1200, 305],
        [896, 747],
        [1268, 695],
        [1900, 542],
      ],
      prismatail: [
        [497, 162],
        [1204, 120],
        [713, 746],
        [1280, 654],
      ],
    };
    return Object.entries(heads).flatMap(([id, points]) =>
      points.map((point, index) => {
        const f = r.poseData[id].poses[index],
          image = r.game.textures.get(`raid-painted-${id}`).getSourceImage();
        const canvas = document.createElement("canvas");
        canvas.width = f.rect[2];
        canvas.height = f.rect[3];
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, ...f.rect, 0, 0, canvas.width, canvas.height);
        const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data,
          w = canvas.width,
          h = canvas.height;
        const ratio = w / (f.source[2] - f.source[0]);
        let sx = Math.round((point[0] - f.source[0]) * ratio),
          sy = Math.round((point[1] - f.source[1]) * ratio);
        let seed = -1;
        for (let radius = 0; radius < 18 && seed < 0; radius++)
          for (let dy = -radius; dy <= radius; dy++)
            for (let dx = -radius; dx <= radius; dx++) {
              const x = sx + dx,
                y = sy + dy;
              if (
                x >= 0 &&
                x < w &&
                y >= 0 &&
                y < h &&
                rgba[(y * w + x) * 4 + 3] > 128
              )
                seed = y * w + x;
            }
        let total = 0;
        for (let n = 3; n < rgba.length; n += 4) if (rgba[n] > 128) total++;
        const seen = new Uint8Array(w * h),
          queue = new Int32Array(w * h);
        let read = 0,
          write = 0;
        if (seed >= 0) {
          seen[seed] = 1;
          queue[write++] = seed;
        }
        while (read < write) {
          const p = queue[read++],
            x = p % w;
          for (const q of [
            x > 0 ? p - 1 : -1,
            x < w - 1 ? p + 1 : -1,
            p >= w ? p - w : -1,
            p < w * (h - 1) ? p + w : -1,
          ])
            if (q >= 0 && !seen[q] && rgba[q * 4 + 3] > 128) {
              seen[q] = 1;
              queue[write++] = q;
            }
        }
        return { id, index, coverage: write / Math.max(1, total) };
      }),
    );
  });
  for (const result of results)
    expect(
      result.coverage,
      `${result.id} pose ${result.index}`,
    ).toBeGreaterThan(0.82);
  expect(errors).toEqual([]);
});

test("confirmed casts have flipbook impacts, interrupted casts do not, and pause freezes the effect", async ({
  page,
}) => {
  const errors = await review(page);
  await page.evaluate(() => {
    const r = (window as any).__bossReview,
      row = r.rows.find((o: any) => o.id === "emberwing");
    row.state.raid.warnings = [
      {
        id: 1,
        kind: "flame-ring",
        startedAt: 0,
        at: 1,
        x: 0,
        y: 0,
        tx: 0,
        ty: 0,
        radius: 90,
      },
    ];
    r.frame(1, 0, false);
    r.frame(1, 0.7, false);
    row.state.raid.warnings = [];
    r.frame(1, 0.75, false);
    r.frame(1, 1.05, false);
  });
  const count = () =>
    page.evaluate(
      () =>
        (window as any).__bossReview.rows[0].g.scene.children.list.filter(
          (o: any) => o.name === "boss-spell-flipbook" && o.visible,
        ).length,
    );
  expect(await count()).toBe(0);
  await page.evaluate(() => {
    const r = (window as any).__bossReview,
      row = r.rows.find((o: any) => o.id === "emberwing");
    row.state.raid.warnings = [
      {
        id: 2,
        kind: "flame-ring",
        startedAt: 1.1,
        at: 2,
        x: 0,
        y: 0,
        tx: 0,
        ty: 0,
        radius: 90,
      },
    ];
    for (let n = 0; n < 19; n++) r.frame(1, 1.1 + n * 0.05, false);
    row.state.raid.warnings = [];
    r.frame(1, 2.05, false);
    r.frame(1, 2.1, false);
  });
  expect(await count()).toBeGreaterThan(0);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    for (const row of r.rows) row.state.phase = "paused";
    r.frame(1, 2.1, false);
  });
  const before = await page.screenshot();
  await page.evaluate(() => (window as any).__bossReview.frame(1, 30, false));
  expect((await page.screenshot()).equals(before)).toBe(true);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    for (const row of r.rows) row.state.phase = "playing";
    r.frame(1, 30.05, true);
  });
  expect(await count()).toBe(0);
  expect(errors).toEqual([]);
});
