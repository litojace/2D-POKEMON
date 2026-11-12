import { expect, test, type Page } from "@playwright/test";
import { openHub, pushUntilBattle, snap, openPlayPanel } from "./helpers";

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
/**
 * A vector boss's rig (Grumblecrag: boss-vector-rig.ts, Tidewyrm:
 * boss-vector-tide-rig.ts): its root and visible image parts.
 */
const vector = (page: Page, id: "grumblecrag" | "tidewyrm" = "grumblecrag") =>
  page.evaluate((id) => {
    const w = window as any,
      scene = w.__bossReview.rows[0].g.scene,
      root = scene.children.list.find(
        (o: any) => o.name === `vector-boss-${id}`,
      );
    if (!root) return null;
    const parts: Record<string, any> = {};
    // the body (root.list[0]) and its glows (root.list[1]); Tidewyrm's body
    // also holds its whisker lines (Graphics), which have no texture
    for (const o of root.list.flatMap((c: any) => c.list ?? []))
      if (o.visible && o.type === "Image")
        parts[o.name.replace("vector-part-", "")] = {
          x: o.x,
          y: o.y,
          rotation: o.rotation,
          sx: o.scaleX,
          sy: o.scaleY,
          alpha: o.alpha,
          frame: o.frame.name,
          texture: o.texture.key,
        };
    return {
      visible: root.visible,
      facing: root.getData("facing"),
      order: root.list[0].list
        .filter((o: any) => o.visible)
        .map((o: any) => o.name.replace("vector-part-", "")),
      parts,
    };
  }, id);
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
        view: root.getData("bossView"),
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
            flip: o.flipX,
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
  // Five painted bosses, two Storm Twins posed on their own; Grumblecrag and
  // Tidewyrm are vector art.
  expect(start).toHaveLength(6);
  const vStart = (await vector(page))!;
  expect(vStart.visible).toBe(true);
  expect(Object.keys(vStart.parts).length).toBeGreaterThan(20);
  const tStart = (await vector(page, "tidewyrm"))!;
  expect(tStart.visible).toBe(true);
  expect(Object.keys(tStart.parts).length).toBeGreaterThan(20);
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
  // Ground Slam windup: both fists rise overhead and burn.
  const vGathered = (await vector(page))!;
  expect(vGathered.parts.fistL.y).toBeLessThan(vStart.parts.fistL.y - 40);
  expect(vGathered.parts.fistR.y).toBeLessThan(vStart.parts.fistR.y - 40);
  expect(vGathered.parts["glow-fistL"]).toBeTruthy();
  // Bubble Burst windup: Tidewyrm's head lifts and leans into it.
  const tGathered = (await vector(page, "tidewyrm"))!;
  expect(
    Math.hypot(
      tGathered.parts.cran.x - tStart.parts.cran.x,
      tGathered.parts.cran.y - tStart.parts.cran.y,
    ),
  ).toBeGreaterThan(2);
  for (const rig of gathered) {
    const ready = start.find((r) => r.name === rig.name)!;
    expect(
      rig.parts.some((p) => !ready.parts.some((q) => q.frame === p.frame)),
    ).toBe(true);
  }
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    for (const row of r.rows) row.state.raid.warnings = [];
    r.frame(1, 1.45, false);
    r.frame(1, 1.5, false);
    r.frame(1, 1.55, false);
  });
  const striking = await pose(page);
  const vStriking = (await vector(page))!;
  expect(vStriking.parts.fistL.y).toBeGreaterThan(vGathered.parts.fistL.y + 40);
  const tStriking = (await vector(page, "tidewyrm"))!;
  for (const p of [
    ...Object.values(vStriking.parts),
    ...Object.values(tStriking.parts),
  ] as any[])
    for (const n of [p.x, p.y, p.rotation, p.sx, p.sy, p.alpha])
      expect(Number.isFinite(n)).toBe(true);
  for (const rig of striking) {
    expect(rig.parts.length).toBeLessThanOrEqual(2);
    const windup = gathered.find((r) => r.name === rig.name)!;
    expect(
      rig.parts.some((p) => !windup.parts.some((q) => q.frame === p.frame)),
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
  const vPaused = await vector(page);
  const tPaused = await vector(page, "tidewyrm");
  await page.evaluate(() => (window as any).__bossReview.frame(2, 20, false));
  expect(await pose(page)).toEqual(paused);
  expect(await vector(page)).toEqual(vPaused);
  expect(await vector(page, "tidewyrm")).toEqual(tPaused);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    for (const row of r.rows) row.state.phase = "playing";
    r.frame(3, 20.025, true);
  });
  const reduced = await pose(page);
  const vReduced = await vector(page);
  const tReduced = await vector(page, "tidewyrm");
  await page.evaluate(() => (window as any).__bossReview.frame(3, 22, true));
  expect(await pose(page)).toEqual(reduced);
  expect(await vector(page)).toEqual(vReduced);
  expect(await vector(page, "tidewyrm")).toEqual(tReduced);
  await snap(page, info, "seven-bosses");
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
      start.find((r) => r.name === rig.name)!.parts[0].frame,
    );
  }
  const vRetry = (await vector(page))!;
  for (const id of ["fistL", "fistR", "head", "torso"]) {
    expect(vRetry.parts[id].x).toBeCloseTo(vStart.parts[id].x, 1);
    expect(vRetry.parts[id].y).toBeCloseTo(vStart.parts[id].y, 1);
  }
  const tRetry = (await vector(page, "tidewyrm"))!;
  for (const id of ["cran", "snout", "jaw", "seg20"]) {
    expect(tRetry.parts[id].x).toBeCloseTo(tStart.parts[id].x, 1);
    expect(tRetry.parts[id].y).toBeCloseTo(tStart.parts[id].y, 1);
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
  expect((await vector(page, "tidewyrm"))?.visible).toBe(true);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    r.rows.find((o: any) => o.id === "gloomshade").state.raid.decoys = [];
    r.rows.find((o: any) => o.id === "tidewyrm").state.raid.submerged = true;
    r.frame(1, 0.8, false);
  });
  const hidden = await pose(page);
  expect(hidden.find((r) => r.name.endsWith("shade-42"))?.visible).toBe(false);
  // Tidewyrm is vector art now: diving hides its rig (no painted root at all).
  expect(hidden.some((r) => r.name.includes("tidewyrm"))).toBe(false);
  expect((await vector(page, "tidewyrm"))?.visible).toBe(false);
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
  // Still under water and undrawn for over 120 frames: its rig is disposed.
  expect(await vector(page, "tidewyrm")).toBeNull();
  expect(errors).toEqual([]);
});

test("late boss loads retain only the current boss atlas and can revisit a boss", async ({
  page,
}) => {
  const errors = await review(page, false);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    r.retain("gloomshade");
    r.frame(1, 0, false, ["gloomshade"]);
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
  await loaded("gloomshade");
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
    r.retain("gloomshade");
    r.frame(1, 1.1, false, ["gloomshade"]);
  });
  await loaded("gloomshade");
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
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("raid", {
          boss: "emberwing",
          pos: [500, 450, 700, 600],
        }),
      );
      await openPlayPanel(page);
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
      // Reproduce the real server steering back toward centre while a locked
      // Wing Gust points north. The bird must keep showing its BACK.
      await page.evaluate(async () => {
        const { createBossCombatDemo } = await import("/boss-combat-demo.ts");
        const w = window as any;
        w.__turnCombat = createBossCombatDemo("emberwing", true, false);
        w.__turnCombat.face("back");
        w.__turnCombat.cast("wing-gust");
        w.__turnTimer = setInterval(
          () => w.__turnCombat.step(1 / 30),
          1000 / 30,
        );
      });
      await page.waitForTimeout(650);
      // Freeze the server fixture during the locked cone, then wait for the
      // renderer to consume it. Slow CI GPUs may still be drawing the prior frame.
      await page.evaluate(() => clearInterval((window as any).__turnTimer));
      await expect
        .poll(() =>
          page.evaluate(() => {
            const w = window as any;
            return w.__paintedBattle.scene
              .getScenes(true)
              .flatMap((s: any) => s.children.list)
              .find(
                (o: any) =>
                  o.name === "painted-boss-emberwing:body" && o.visible,
              )
              ?.getData("bossView");
          }),
        )
        .toBe("back");
      const locked = await page.evaluate(() => {
        const w = window as any,
          root = w.__paintedBattle.scene
            .getScenes(true)
            .flatMap((s: any) => s.children.list)
            .find(
              (o: any) => o.name === "painted-boss-emberwing:body" && o.visible,
            );
        clearInterval(w.__turnTimer);
        return {
          view: root?.getData("bossView"),
          images: root?.list[0].list
            .filter((o: any) => o.type === "Image" && o.visible)
            .map((o: any) => o.texture.key),
        };
      });
      expect(locked.view).toBe("back");
      expect(locked.images).toContain("raid-directions-emberwing");
      await snap(
        page,
        info,
        `locked-cone-back-${mobile ? "iphone" : "desktop"}`,
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("an unavailable art file keeps the encounter playable without a request loop", async ({
  page,
}) => {
  let requests = 0;
  await page.route(/raid-whole-gloomshade\.webp/, (route) => {
    if (route.request().resourceType() === "script") return route.continue();
    requests++;
    return route.abort();
  });
  const errors = await review(page, false);
  await page.evaluate(() =>
    (window as any).__bossReview.frame(1, 0, false, ["gloomshade"]),
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
    for (let n = 1; n <= 40; n++) r.frame(1, n * 0.05, false, ["gloomshade"]);
    return r.rows.find((o: any) => o.id === "gloomshade").g.commandBuffer
      .length;
  });
  await page.waitForTimeout(100);
  expect(requests).toBe(attempts);
  expect(commands).toBeGreaterThan(100);
  expect(
    (await pose(page)).filter((r) => r.name.includes("gloomshade")),
  ).toEqual([]);
  expect(errors).toEqual([]);
});

// Tidewyrm is vector art now (vector-tide.spec.ts covers its rig in depth):
// stranded, its whole body lies on the island's sand, facing either way.
test("stranded Tidewyrm is one complete grounded creature in both directions", async ({
  page,
}, info) => {
  const errors = await review(page);
  // Standing in the water, side-on: how high its body reaches (the yardstick).
  await page.evaluate(() => {
    const r = (window as any).__bossReview,
      row = r.rows.find((o: any) => o.id === "tidewyrm"),
      boss = row.state.players.find((p: any) => p.raidBoss);
    boss.angle = 0;
    r.frame(1, 5.5, true);
  });
  const up = (await vector(page, "tidewyrm"))!;
  const top = (parts: Record<string, any>) =>
    Math.max(
      ...Object.entries(parts)
        .filter(([id]) => /^seg\d+$/.test(id))
        .map(([, p]) => -p.y),
    );
  const standing = top(up.parts);
  expect(standing).toBeGreaterThan(80);
  for (const facing of [1, -1]) {
    await page.evaluate((facing) => {
      const r = (window as any).__bossReview,
        row = r.rows.find((o: any) => o.id === "tidewyrm"),
        boss = row.state.players.find((p: any) => p.raidBoss);
      if (!row.state.raid.exposedUntil) r.frame();
      row.state.raid.exposedUntil = 20;
      row.state.raid.islands = [
        { x: boss.x, y: boss.y, radius: 220, sunk: false },
      ];
      boss.angle = facing > 0 ? 0 : Math.PI;
      r.frame(1, facing > 0 ? 6 : 6.25, true);
    }, facing);
    const v = (await vector(page, "tidewyrm"))!;
    const segs = Object.entries(v.parts)
      .filter(([id]) => /^seg\d+$/.test(id))
      .map(([, p]) => p);
    expect(v.visible).toBe(true);
    // turned to the side it faces, the head out ahead of the body
    expect(v.facing).toBe(facing > 0 ? 2 : 6);
    expect(Math.sign(v.parts.snout.x - v.parts.seg15.x)).toBe(facing);
    // the whole body is out on the sand (none of it under water), lying low
    expect(segs).toHaveLength(30);
    expect(top(v.parts)).toBeLessThan(standing * 0.75);
    expect(v.parts.cran.y).toBeGreaterThan(up.parts.cran.y + standing * 0.3);
    // one creature: every visible piece within a body's length of the boss
    for (const p of Object.values(v.parts) as any[])
      expect(Math.hypot(p.x, p.y)).toBeLessThan(260);
    await snap(
      page,
      info,
      `vector-tidewyrm-land-${facing > 0 ? "right" : "left"}`,
    );
  }
  expect(errors).toEqual([]);
});

// Tidewyrm's head and body are one vector rig now, so only the peacock's
// painted poses are checked here.
test("peacock heads share a continuous opaque silhouette with their bodies", async ({
  page,
}) => {
  const errors = await review(page);
  const results = await page.evaluate(() => {
    const r = (window as any).__bossReview;
    const heads = {
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

test("all seven bosses use distinct front, rear and side art with complete directional attack poses", async ({
  page,
}) => {
  const errors = await review(page);
  for (const [view, angle] of [
    ["front", Math.PI / 2],
    ["back", -Math.PI / 2],
    ["left", Math.PI],
    ["right", 0],
  ] as const) {
    const time = { front: 0, back: 1, left: 2, right: 3 }[view];
    const expected = await page.evaluate(
      ({ view, angle, time }) => {
        const r = (window as any).__bossReview;
        for (const row of r.rows) {
          row.state.raid.airborne = row.id === "emberwing";
          for (const p of row.state.players) if (p.raidBoss) p.angle = angle;
        }
        r.frame(1, time, true);
        return r.rows
          .filter(
            (row: any) => row.id !== "grumblecrag" && row.id !== "tidewyrm",
          )
          .flatMap((row: any) =>
            row.state.players
              .filter((p: any) => p.raidBoss)
              .map((p: any, index: number) => {
                const mode =
                  row.id === "storm-twins" && index === 1 ? "blue" : "body";
                const f = r.directionalFrame(row.id, mode, view, 0);
                return {
                  view,
                  frame: `pose-${f.index}`,
                  texture: `raid-${f.atlas === "base" ? "painted" : "directions"}-${row.id}`,
                  flip: f.flip,
                };
              }),
          );
      },
      { view, angle, time },
    );
    const actual = await pose(page);
    expect(actual).toHaveLength(6);
    // Grumblecrag's and Tidewyrm's rigs show the matching one of their
    // eight facings.
    const v = (await vector(page))!;
    expect(v.facing).toBe({ front: 0, right: 2, back: 4, left: 6 }[view]);
    if (view === "front") expect(v.parts.eyeL && v.parts.eyeR).toBeTruthy();
    if (view === "back") expect(v.parts.eyeL ?? v.parts.eyeR).toBeUndefined();
    if (view === "left" || view === "right")
      expect(Math.sign(v.parts.head.x - v.parts.pelvis.x)).toBe(
        view === "right" ? 1 : -1,
      );
    const t = (await vector(page, "tidewyrm"))!;
    expect(t.facing).toBe({ front: 0, right: 2, back: 4, left: 6 }[view]);
    if (view === "front")
      expect(t.parts["eye-1"] && t.parts.eye1 && t.parts.pearl).toBeTruthy();
    if (view === "back")
      expect(t.parts["eye-1"] ?? t.parts.eye1).toBeUndefined();
    if (view === "left" || view === "right")
      expect(Math.sign(t.parts.snout.x - t.parts.seg15.x)).toBe(
        view === "right" ? 1 : -1,
      );
    for (const [i, actor] of actual.entries()) {
      expect(actor.view).toBe(expected[i].view);
      expect(actor.parts).toHaveLength(1);
      const { view: _view, ...expectedPart } = expected[i];
      expect(actor.parts[0]).toMatchObject(expectedPart);
      expect(actor.parts[0].rotation).toBe(0);
    }
  }
  // Server position changes must turn the whole phoenix away while travelling,
  // even though its last attack aim still points right.
  await page.evaluate(() => {
    const r = (window as any).__bossReview,
      row = r.rows.find((o: any) => o.id === "emberwing"),
      boss = row.state.players.find((p: any) => p.raidBoss);
    boss.y -= 12;
    r.frame(1, 3.1, true);
    boss.y -= 12;
    r.frame(1, 3.25, true);
  });
  expect(
    (await pose(page)).find((o) => o.name.includes("emberwing"))!.view,
  ).toBe("back");
  expect(errors).toEqual([]);
});

test("phoenix back and profile keep flapping and change to correctly facing grounded drawings", async ({
  page,
}, info) => {
  const errors = await review(page);
  for (const [view, angle] of [
    ["back", -Math.PI / 2],
    ["right", 0],
  ] as const) {
    const clock = view === "back" ? 0 : 3;
    await page.evaluate(
      ({ angle, clock }) => {
        const r = (window as any).__bossReview,
          row = r.rows.find((o: any) => o.id === "emberwing"),
          boss = row.state.players.find((p: any) => p.raidBoss);
        row.state.raid.airborne = true;
        boss.angle = angle;
        for (let n = 0; n < 20; n++) r.frame(1, clock + n * 0.05, false);
      },
      { angle, clock },
    );
    const first = (await pose(page)).find((o) => o.name.includes("emberwing"))!;
    await page.evaluate((clock) => {
      const r = (window as any).__bossReview;
      for (let n = 20; n < 27; n++) r.frame(1, clock + n * 0.05, false);
    }, clock);
    const second = (await pose(page)).find((o) =>
      o.name.includes("emberwing"),
    )!;
    expect(second.view).toBe(view);
    expect(
      second.parts.some((p) => p.texture === "raid-directions-emberwing"),
    ).toBe(true);
    expect(second.parts.map((p) => p.frame)).not.toEqual(
      first.parts.map((p) => p.frame),
    );
    await page.evaluate((clock) => {
      const r = (window as any).__bossReview;
      r.rows.find((o: any) => o.id === "emberwing").state.raid.airborne = false;
      for (let n = 27; n < 45; n++) r.frame(1, clock + n * 0.05, false);
    }, clock);
    const grounded = (await pose(page)).find((o) =>
      o.name.includes("emberwing"),
    )!;
    expect(grounded.view).toBe(view);
    expect(grounded.parts).toHaveLength(1);
    expect(grounded.parts[0].frame).toBe(
      view === "back" ? "pose-8" : "pose-12",
    );
    await snap(page, info, `phoenix-${view}-grounded`);
  }
  expect(errors).toEqual([]);
});
