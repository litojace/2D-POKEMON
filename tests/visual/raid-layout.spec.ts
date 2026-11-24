import { expect, test, type Page } from "@playwright/test";

import {
  box,
  inside,
  settle,
  openHub,
  pushUntilBattle,
  snap,
  openPlayPanel,
  createRoom,
} from "./helpers";

/** Peril · NAME · Phase in one centred row, the bar below, the callout under it. */
async function expectBossFrame(page: Page, boss: string) {
  const name = await box(page, ".raid-boss-heading > b"),
    phase = await box(page, ".raid-boss-phase"),
    health = await box(
      page,
      boss === "storm-twins" ? ".raid-twin-health" : ".raid-boss-health",
    ),
    cue = await box(page, ".raid-callout"),
    hud = await box(page, "#raid-hud");
  const mid = (b: { y: number; height: number }) => b.y + b.height / 2;
  // One difficulty: no Peril chip beside the name.
  await expect(page.locator(".raid-boss-peril")).toHaveCount(0);
  expect(name.x + name.width).toBeLessThanOrEqual(phase.x);
  expect(Math.abs(mid(phase) - mid(name))).toBeLessThanOrEqual(2);
  expect(health.y).toBeGreaterThanOrEqual(name.y + name.height);
  expect(cue.y).toBeGreaterThanOrEqual(health.y + health.height);
  // Centred on the bar, and the bar inside the HUD.
  expect(
    Math.abs(name.x + name.width / 2 - (health.x + health.width / 2)),
  ).toBeLessThanOrEqual(2);
  expect(
    Math.abs(cue.x + cue.width / 2 - (health.x + health.width / 2)),
  ).toBeLessThanOrEqual(2);
  expect(health.x).toBeGreaterThanOrEqual(hud.x - 1);
  expect(health.x + health.width).toBeLessThanOrEqual(hud.x + hud.width + 1);
  await expect(page.locator(".raid-party-bars")).toHaveCount(0);
}

async function floorHudGap(page: Page) {
  const hud = await box(page, "#raid-hud"),
    game = await box(page, "#game");
  const floorTop = await page.evaluate(() => {
    const scene = (window as any).__raidLayoutGame.scene.getScene("arena"),
      c = scene.cameras.main;
    return (
      (-c.worldView.y *
        c.zoomY *
        document.getElementById("game")!.clientHeight) /
      scene.scale.height
    );
  });
  return game.y + floorTop - hud.y - hud.height;
}
/** Move "me" in the fake snapshot (the server's word on where it stands). */
async function heroTo(page: Page, x: number, y: number) {
  await page.evaluate(
    ([x, y]) => {
      const w = window as any;
      const hero = w.__snap.players.find((p: any) => p.id === "me");
      hero.x = x;
      hero.y = y;
      w.__snap.time += 1;
      w.__push();
    },
    [x, y],
  );
}
/**
 * Mark (or clear) a court-wide warning: a High Tide marked over the whole
 * court, so the camera's frame (what the moment needs) is the whole court.
 */
async function courtWarning(page: Page, on: boolean) {
  await page.evaluate((on) => {
    const w = window as any,
      s = w.__snap;
    s.raid.warnings = on
      ? [
          {
            id: 777,
            kind: "hightide",
            startedAt: s.time,
            at: s.time + 3,
            x: 800,
            y: 450,
            tx: 800,
            ty: 450,
            radius: 950,
          },
        ]
      : [];
    w.__push();
  }, on);
}
async function heroOnScreen(page: Page) {
  return page.evaluate(() => {
    const w = window as any,
      r = w.__raidLayoutGame.scene.getScene("arena").cameras.main.worldView,
      hero = w.__snap.players.find((p: any) => p.id === "me");
    return (
      hero.x > r.x && hero.x < r.right && hero.y > r.y && hero.y < r.bottom
    );
  });
}
async function cameraSignature(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).__raidLayoutGame.scene.getScene("arena").cameras
      .main;
    return [c.zoomX, c.zoomY, c.scrollX, c.scrollY];
  });
}

for (const size of [
  { width: 1440, height: 900 },
  { width: 1280, height: 1024 },
  { width: 1024, height: 500 },
  { width: 844, height: 390 },
  { width: 844, height: 280 },
]) {
  test(`raid choices are centred and the mobile court clears the HUD at ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    // Seven bosses, then the rites: on software rendering (about 14 fps
    // on a desktop-size canvas) the desktop sizes took 1.5 to 1.9 minutes,
    // over the 90 s default (CI's machines take 20 to 30 s).
    test.setTimeout(180_000);
    const mobile = size.width < 1200;
    const context = await browser.newContext({
      viewport: size,
      isMobile: mobile,
      hasTouch: mobile,
    });
    try {
      const page = await context.newPage();
      // Inspect the actual renderer's camera, without adding production hooks.
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
              "window.__raidLayoutGame=gameInstance;" + marker,
            ),
          });
        },
      );
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("raid", { boss: "grumblecrag" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);

      /** The whole-court zoom, read while a court-wide warning shows. */
      let overviewZoom = 1;
      for (const boss of [
        "grumblecrag",
        "tidewyrm",
        "gloomshade",
        "somnara",
        "prismatail",
        "emberwing",
        "storm-twins",
      ]) {
        await page.evaluate((boss) => {
          const w = window as any;
          w.__room("raid", { boss });
          const s = w.__snap,
            friend = s.players.find((p: any) => p.id === "p2");
          s.players.push(
            { ...friend, id: "p3", name: "Third raider", x: 700 },
            { ...friend, id: "p4", name: "Fourth raider", x: 900 },
          );
          s.raid.partySize = 4;
          if (boss === "somnara") {
            s.raid.dream = {
              id: 1,
              dreamerId: "me",
              step: 0,
              length: 6,
              startedAt: s.time,
              until: s.time + 14,
              backwards: false,
            };
            s.raidDream = {
              id: 1,
              full: true,
              backwards: false,
              runes: ["circle", "star", "moon", "wave", "circle", "star"],
            };
          }
          w.__push();
        }, boss);
        await expect
          .poll(async () => {
            const frame = await box(page, "#game"),
              stage = await box(page, ".arena-stage");
            return Math.abs(frame.height - stage.height);
          })
          .toBeLessThanOrEqual(2);
        // Beyond the walls: the arena's painted world (world-art/), as four
        // bands that cover WORLD round the court and never lie under it
        // (that would draw the court's pixels twice every frame).
        await expect
          .poll(() =>
            page.evaluate(() => {
              const s = (window as any).__raidLayoutGame.scene.getScene(
                "arena",
              );
              return s.raidWorld
                .filter((b: any) => b.visible)
                .map((b: any) =>
                  [b.x, b.y, b.displayWidth, b.displayHeight]
                    .map(Math.round)
                    .join(","),
                )
                .sort();
            }),
          )
          .toEqual(
            [
              "-1000,-900,3600,900",
              "-1000,900,3600,900",
              "-1000,0,1000,900",
              "1600,0,1000,900",
            ].sort(),
          );
        // The boss frame: Peril, name, Phase on one centred row; the bar
        // below; the callout centred under it. No party bars (fighters'
        // health is on their nameplates).
        await expectBossFrame(page, boss);
        if (mobile) {
          const compactHud = await box(page, "#raid-hud");
          expect(compactHud.height).toBeLessThanOrEqual(
            size.height <= 350 ? 42 : 48,
          );
          if (boss === "storm-twins")
            await expect(
              page.locator("#raid-hud > .raid-boss-health"),
            ).toBeHidden();
          // Phones follow the raider: at the court's top edge, that edge
          // still sits below the HUD.
          if (mobile) await heroTo(page, 800, 20);
          await expect.poll(() => floorHudGap(page)).toBeGreaterThanOrEqual(5);
          const clock = await box(page, ".raid-elapsed"),
            gear = await box(page, "#battle-menu");
          expect(clock.y).toBeGreaterThanOrEqual(gear.y + gear.height + 2);
          expect(
            Math.abs(clock.x + clock.width / 2 - gear.x - gear.width / 2),
          ).toBeLessThanOrEqual(2);
          // All four arena corners are visible: always on desktop; on phones
          // while a court-wide mechanic is marked.
          if (mobile) await courtWarning(page, true);
          await expect
            .poll(() =>
              page.evaluate(() => {
                const c = (window as any).__raidLayoutGame.scene.getScene(
                  "arena",
                ).cameras.main;
                const r = c.worldView;
                return (
                  r.x <= 0.5 &&
                  r.y <= 0.5 &&
                  r.right >= 1599.5 &&
                  r.bottom >= 899.5
                );
              }),
            )
            .toBe(true);
          if (mobile) {
            overviewZoom = (await cameraSignature(page))[0];
            await courtWarning(page, false);
          }
          for (const selector of [
            "#raid-prism-controls",
            "#raid-dream-panel",
            "#raid-storm-targets",
          ]) {
            const panel = page.locator(selector);
            if (await panel.isVisible()) {
              const controls = await box(page, selector),
                game = await box(page, "#game");
              const hud = await box(page, "#raid-hud");
              const obstacles = await page
                .locator(".touch-buttons > button, #battle-menu, .raid-elapsed")
                .evaluateAll((items) =>
                  items.map((item) => {
                    const r = item.getBoundingClientRect();
                    return { x: r.x, y: r.y, width: r.width, height: r.height };
                  }),
                );
              expect(controls.y).toBeGreaterThanOrEqual(hud.y + hud.height);
              for (const obstacle of obstacles) {
                const overlaps =
                  controls.x < obstacle.x + obstacle.width - 1 &&
                  controls.x + controls.width > obstacle.x + 1 &&
                  controls.y < obstacle.y + obstacle.height - 1 &&
                  controls.y + controls.height > obstacle.y + 1;
                expect(
                  overlaps,
                  `${boss}: ${selector} overlaps another control`,
                ).toBe(false);
              }
              if (selector === "#raid-prism-controls" && mobile) {
                // Phones: Prismatail's two actions fill the touch cluster's
                // contextual slot, left of the target button
                // (prism-context.spec.ts covers what they show).
                const slot = await box(page, ".touch-buttons .touch-context"),
                  aim = await box(page, ".touch-buttons [data-aim]");
                expect(Math.abs(controls.x - slot.x)).toBeLessThanOrEqual(1);
                expect(Math.abs(controls.y - slot.y)).toBeLessThanOrEqual(1);
                expect(slot.x + slot.width).toBeLessThanOrEqual(aim.x);
              }
              expect(controls.x).toBeGreaterThanOrEqual(0);
              expect(controls.x + controls.width).toBeLessThanOrEqual(
                size.width,
              );
              expect(
                await panel.evaluate((e) => e.scrollWidth - e.clientWidth),
              ).toBeLessThanOrEqual(1);
            }
          }
          const before = await box(page, "#game");
          await page.evaluate(() => {
            const w = window as any,
              s = w.__snap,
              boss = s.players.find((p: any) => p.raidBoss);
            s.raid.warnings = [
              {
                id: 501,
                kind: "charge",
                startedAt: s.time,
                at: s.time + 2,
                lockAt: s.time + 1,
                targetId: "me",
                x: boss.x,
                y: boss.y,
                tx: 500,
                ty: 450,
                radius: 80,
              },
            ];
            w.__push();
          });
          // The callout tells who is targeted (no party bars).
          await expect(page.locator(".raid-callout")).not.toBeEmpty();
          const after = await box(page, "#game");
          expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
          expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
          const canvas = await box(page, "#game canvas");
          expect(inside(canvas, after)).toBe(true);
          if (boss === "prismatail")
            await snap(page, info, `raid-wide-${size.width}x${size.height}`);
        }
        await expect.poll(() => floorHudGap(page)).toBeGreaterThanOrEqual(5);
        if (boss === "somnara")
          await page.evaluate(() => {
            const w = window as any;
            delete w.__snap.raid.dream;
            delete w.__snap.raidDream;
            w.__push();
          });
        await heroTo(page, 300, 300);
        await expect.poll(() => heroOnScreen(page)).toBe(true);
        const camera = await cameraSignature(page);
        // Desktop fits the whole court: a raider running to a corner
        // doesn't move it. Phones follow the raider there, closer up.
        await heroTo(page, 1500, 800);
        // Prismatail's light relay (mirrors) is one court-wide puzzle: phones
        // frame its skylight, mirrors, heart and raiders, no closer.
        const relay = await page.evaluate(
          () => !!(window as any).__snap.raid.mirrors?.length,
        );
        if (mobile && !relay) {
          await expect.poll(() => cameraSignature(page)).not.toEqual(camera);
          await expect.poll(() => heroOnScreen(page)).toBe(true);
          // Fighters larger than the whole-court view drew them, but the
          // swing kept gentle on phones (owner, 22 Nov 2026: a big swing each
          // court-wide skill was tiring): the court fills the space below the
          // HUD, about 1.3× on a 1024×500 phone and 1.4× on 844×390. (A squat
          // 844×280 swings more, by how tall its HUD is that moment.)
          const swing = () =>
            cameraSignature(page).then((c) => c[0] / overviewZoom);
          await expect.poll(swing).toBeGreaterThan(1.25);
          if (size.height >= 300) expect(await swing()).toBeLessThan(1.5);
        } else if (mobile) {
          await expect.poll(() => heroOnScreen(page)).toBe(true);
          await expect
            .poll(() =>
              page.evaluate(() => {
                const w = window as any,
                  r =
                    w.__raidLayoutGame.scene.getScene("arena").cameras.main
                      .worldView;
                return w.__snap.raid.mirrors.every(
                  (m: any) =>
                    m.x > r.x && m.x < r.right && m.y > r.y && m.y < r.bottom,
                );
              }),
            )
            .toBe(true);
          expect((await cameraSignature(page))[0]).toBeGreaterThanOrEqual(
            overviewZoom - 1e-6,
          );
        } else await expect.poll(() => cameraSignature(page)).toEqual(camera);
        if (boss === "prismatail") {
          // Review screenshots show the loaded floor art and the boss's vector rig.
          await expect
            .poll(() =>
              page.evaluate(() => {
                const s = (window as any).__raidLayoutGame.scene.getScene(
                  "arena",
                );
                return (
                  s.floor.texture.getSourceImage().dataset?.raidArtwork ===
                    "sun-atrium" &&
                  s.children.list.some(
                    (o: any) => o.name === "prismell-boss" && o.visible,
                  )
                );
              }),
            )
            .toBe(true);
          await snap(page, info, `raid-art-wide-${size.width}x${size.height}`);
        }
      }

      if (mobile) {
        await page.evaluate(() => {
          const w = window as any;
          w.__room("raid", { boss: "prismatail" });
          w.__snap.players = w.__snap.players.filter(
            (p: any) => p.raidBoss || p.id === "me",
          );
          w.__snap.raid.partySize = 1;
          w.__push();
        });
        await expect(page.locator(".raid-party-bars")).toHaveCount(0);
        // The follow camera at the court's top edge.
        await heroTo(page, 800, 20);
        await expect.poll(() => floorHudGap(page)).toBeGreaterThanOrEqual(5);
        // Resizing the canvas clears its drawing buffer. Capture after Phaser
        // has painted the new solo layout, rather than that transient clear.
        await page.evaluate(
          () =>
            new Promise<void>((resolve) => {
              const game = (window as any).__raidLayoutGame;
              let frames = 0;
              const painted = () => {
                if (++frames === 2) {
                  game.events.off("postrender", painted);
                  resolve();
                }
              };
              game.events.on("postrender", painted);
            }),
        );
        await snap(page, info, `raid-solo-wide-${size.width}x${size.height}`);
      }
      for (const offers of [
        ["shelter", "sharing", "core", "rescue", "courage", "mending"],
        [
          "grounded",
          "fireproof",
          "polished",
          "lucid",
          "footing",
          "lamplighter",
        ],
      ]) {
        await page.evaluate((offers) => {
          const w = window as any;
          w.__snap.phase = "intermission";
          w.__snap.remaining = 15;
          w.__snap.raid.offers.me = offers;
          w.__push();
        }, offers);
        await expect(page.locator("[data-raid-rite]")).toHaveCount(6);
        await page.locator(".rites-screen").evaluate(async (el) => {
          await Promise.all(
            el.getAnimations().map((a) => a.finished.catch(() => {})),
          );
        });
        await settle(page);
        // Every tile measured in one pass: one round trip per tile part
        // took longer than the test's time on software rendering.
        // Very short screens keep the description in Rite details.
        const parts = [
          ".raid-rite-copy",
          ".raid-rite-icon",
          "b",
          ...(size.height > 350 ? ["small"] : []),
        ];
        const tiles = await page.evaluate(
          ([offers, parts]) =>
            offers.map((id) => {
              const button = document.querySelector(
                `[data-raid-rite="${id}"]`,
              )!;
              const rect = (e: Element) => {
                const r = e.getBoundingClientRect();
                return { x: r.x, y: r.y, width: r.width, height: r.height };
              };
              return {
                id,
                button: rect(button),
                parts: parts.map((part) => rect(button.querySelector(part)!)),
              };
            }),
          [offers, parts] as const,
        );
        for (const { id, button, parts: boxes } of tiles) {
          const [content] = boxes;
          for (const [i, part] of boxes.entries())
            expect(inside(part, button), `${id} ${parts[i]}`).toBe(true);
          expect(
            Math.abs(
              content.x + content.width / 2 - (button.x + button.width / 2),
            ),
          ).toBeLessThanOrEqual(2);
          expect(
            Math.abs(
              content.y + content.height / 2 - (button.y + button.height / 2),
            ),
          ).toBeLessThanOrEqual(2);
        }
        if (offers[0] === "shelter")
          await snap(
            page,
            info,
            `raid-rites-centred-${size.width}x${size.height}`,
          );
      }
      if (size.height === 390) {
        // Safari expands/collapses its browser bars during an active encounter.
        await page.evaluate(() => {
          const w = window as any;
          w.__snap.phase = "playing";
          w.__push();
        });
        // The whole court (a court-wide mechanic) refits to the new size.
        await courtWarning(page, true);
        for (const height of [280, 390]) {
          await page.setViewportSize({ width: size.width, height });
          await expect.poll(() => floorHudGap(page)).toBeGreaterThanOrEqual(5);
          await expect
            .poll(() =>
              page.evaluate(() => {
                const c = (window as any).__raidLayoutGame.scene.getScene(
                  "arena",
                ).cameras.main;
                return c.worldView.width >= 1599 && c.worldView.height >= 899;
              }),
            )
            .toBe(true);
        }
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
