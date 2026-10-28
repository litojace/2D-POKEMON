import { expect, test } from "@playwright/test";
import {
  box,
  inside,
  openTown,
  openTownMenu,
  pushUntilBattle,
  snap,
} from "./helpers";

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
      const errors = await openTown(page);
      await page.evaluate(() =>
        (window as any).__room("raid", { boss: "grumblecrag" }),
      );
      await openTownMenu(page);
      await page.click(".town-play");
      await page.click("#play-create");
      await pushUntilBattle(page);

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
        if (!mobile) {
          const name = await box(page, ".raid-boss-heading > b"),
            cue = await box(page, ".raid-callout"),
            meta = await box(page, ".raid-boss-heading > span");
          expect(Math.abs(name.y - cue.y)).toBeLessThanOrEqual(1);
          expect(Math.abs(meta.y - cue.y)).toBeLessThanOrEqual(1);
          expect(name.x + name.width).toBeLessThanOrEqual(cue.x);
          expect(cue.x + cue.width).toBeLessThanOrEqual(meta.x);
        }
        if (mobile) {
          const compactHud = await box(page, "#raid-hud");
          expect(compactHud.height).toBeLessThanOrEqual(
            size.height <= 350 ? 42 : 48,
          );
          if (boss === "storm-twins")
            await expect(
              page.locator("#raid-hud > .raid-boss-health"),
            ).toBeHidden();
          await expect
            .poll(async () => {
              const hud = await box(page, "#raid-hud"),
                game = await box(page, "#game");
              return game.y - (hud.y + hud.height);
            })
            .toBeGreaterThanOrEqual(5);
          await expect
            .poll(async () => {
              const party = await box(page, ".raid-party-bars"),
                hud = await box(page, "#raid-hud");
              return party.y - (hud.y + hud.height);
            })
            .toBeGreaterThanOrEqual(6);
          const party = await box(page, ".raid-party-bars");
          expect(party.x).toBeLessThanOrEqual(10);
          expect(party.width).toBeLessThanOrEqual(104);
          const partyRows = await page
            .locator(".raid-party-bars > span")
            .evaluateAll((rows) =>
              rows.map((row) => {
                const r = row.getBoundingClientRect();
                return { top: r.top, bottom: r.bottom };
              }),
            );
          for (let i = 1; i < partyRows.length; i++)
            expect(partyRows[i].top).toBeGreaterThanOrEqual(
              partyRows[i - 1].bottom + 1,
            );
          const clock = await box(page, ".raid-elapsed"),
            gear = await box(page, "#battle-menu");
          expect(clock.y).toBeGreaterThanOrEqual(gear.y + gear.height + 2);
          expect(
            Math.abs(clock.x + clock.width / 2 - gear.x - gear.width / 2),
          ).toBeLessThanOrEqual(2);
          const health = await box(
              page,
              boss === "storm-twins" ? ".raid-twin-track" : ".raid-boss-health",
            ),
            name = await box(
              page,
              ".raid-boss-heading > b",
            ),
            cue = await box(page, ".raid-callout"),
            meta = await box(page, ".raid-boss-heading > span");
          expect(name.y).toBeGreaterThanOrEqual(health.y + health.height);
          expect(Math.abs(name.y - cue.y)).toBeLessThanOrEqual(1);
          expect(Math.abs(meta.y - cue.y)).toBeLessThanOrEqual(1);
          expect(name.x + name.width).toBeLessThanOrEqual(cue.x);
          expect(cue.x + cue.width).toBeLessThanOrEqual(meta.x);
          // All four arena corners remain visible, even for the three bosses
          // that previously used the tight fighter-follow camera.
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
                .locator(
                  ".touch-buttons button, #battle-menu, .raid-elapsed, .raid-party-bars",
                )
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
              if (selector === "#raid-prism-controls") {
                const buttons = await panel
                  .locator("button")
                  .evaluateAll((items) =>
                    items.map((item) => item.getBoundingClientRect().y),
                  );
                expect(Math.abs(buttons[0] - buttons[1])).toBeLessThanOrEqual(
                  1,
                );
                expect(
                  size.width - controls.x - controls.width,
                ).toBeLessThanOrEqual(size.height <= 350 ? 54 : 8);
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
          await expect(
            page.locator(".raid-party-bars .is-targeted"),
          ).toHaveCount(1);
          const after = await box(page, "#game");
          expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
          expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
          const canvas = await box(page, "#game canvas");
          expect(inside(canvas, after)).toBe(true);
          if (boss === "prismatail")
            await snap(page, info, `raid-wide-${size.width}x${size.height}`);
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
        await expect(page.locator(".raid-party-bars")).toBeVisible();
        await expect(page.locator(".raid-party-bars > span")).toHaveCount(1);
        await expect
          .poll(async () => {
            const hud = await box(page, "#raid-hud"),
              game = await box(page, "#game");
            return game.y - (hud.y + hud.height);
          })
          .toBeGreaterThanOrEqual(5);
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
        ["shelter", "sharing", "core"],
        ["rescue", "courage", "mending"],
        ["grounded", "fireproof", "polished"],
        ["lucid", "footing", "lamplighter"],
      ]) {
        await page.evaluate((offers) => {
          const w = window as any;
          w.__snap.phase = "intermission";
          w.__snap.remaining = 15;
          w.__snap.raid.offers.me = offers;
          w.__push();
        }, offers);
        await expect(page.locator("[data-raid-rite]")).toHaveCount(3);
        await page.locator(".raid-draft").evaluate(async (el) => {
          await Promise.all(
            el.getAnimations().map((a) => a.finished.catch(() => {})),
          );
        });
        for (const id of offers) {
          const button = await box(page, `[data-raid-rite="${id}"]`);
          const content = await box(
            page,
            `[data-raid-rite="${id}"] .raid-rite-copy`,
          );
          expect(inside(content, button)).toBe(true);
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
          for (const child of [".raid-rite-icon", "b", "small"]) {
            expect(
              inside(
                await box(page, `[data-raid-rite="${id}"] ${child}`),
                button,
              ),
            ).toBe(true);
          }
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
        for (const height of [280, 390]) {
          await page.setViewportSize({ width: size.width, height });
          await expect
            .poll(async () => {
              const hud = await box(page, "#raid-hud"),
                game = await box(page, "#game");
              return game.y - (hud.y + hud.height);
            })
            .toBeGreaterThanOrEqual(5);
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
