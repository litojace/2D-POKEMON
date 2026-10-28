import { RAID_BOSSES, raidAttacksOf } from "../../packages/shared/src/raid";
import { expect, test } from "@playwright/test";
import {
  openTown,
  openTownMenu,
  box,
  inside,
  pushUntilBattle,
  snap,
} from "./helpers";
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
  { width: 844, height: 280 },
])
  test(`practice skills fit at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width < 1000,
      hasTouch: viewport.width < 1000,
    });
    try {
      const page = await context.newPage();
      const errors = await openTown(page);
      await page.evaluate(() => {
        const w = window as any;
        w.__events = [];
        w.__emit = (event: string, data: any) =>
          w.__events.push({ event, data });
        w.__room("raid", { boss: "grumblecrag" });
      });
      await openTownMenu(page);
      await page.click('[data-action="raids"]');
      await expect(page.locator("#raid-join-code")).toHaveCount(0);
      if (await page.locator(".raid-boss-card").count())
        await page.click('[data-raid-boss="grumblecrag"]');
      const attack = page.locator("[data-hub-practice]").first();
      await expect(attack).toBeVisible();
      await expect(
        page.locator(".raid-showcase-skill-icon svg").first(),
      ).toBeVisible();
      await snap(
        page,
        info,
        `practice-hub-${viewport.width}x${viewport.height}`,
      );
      await attack.click();
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as any).__events.some((e: any) => e.event === "raid-drill"),
          ),
        )
        .toBe(true);
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.raid.drill = "charge";
        w.__snap.raid.drillStats = { hits: 0, dodges: 0 };
        w.__push();
      });
      await pushUntilBattle(page);
      await expect(page.locator(".raid-drill-options")).toBeHidden();
      const panel = await box(page, "#raid-drill");
      expect(panel.height).toBeLessThan(90);
      await snap(
        page,
        info,
        `practice-closed-${viewport.width}x${viewport.height}`,
      );
      await page.click(".raid-drill-picker > summary");
      await expect(page.locator(".raid-drill-options")).toBeVisible();
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.raid.drillStats.hits++;
        w.__push();
      });
      await expect(page.locator(".raid-drill-options")).toBeVisible();
      await snap(
        page,
        info,
        `practice-open-${viewport.width}x${viewport.height}`,
      );
      for (const boss of Object.keys(
        RAID_BOSSES,
      ) as (keyof typeof RAID_BOSSES)[]) {
        const attacks = raidAttacksOf(boss);
        await page.evaluate(
          ({ boss, attack }) => {
            const w = window as any;
            w.__room("raid", { boss });
            w.__snap.raid.drill = attack;
            w.__snap.raid.drillStats = { dodges: 12, hits: 3 };
            w.__push();
          },
          { boss, attack: attacks[0] },
        );
        await expect(page.locator("[data-raid-drill]")).toHaveCount(
          attacks.length,
        );
        await expect(page.locator(".raid-drill-picker")).toHaveAttribute(
          "open",
          "",
        );
        const bounds = await box(page, "#raid-drill");
        expect(inside(bounds, { x: 0, y: 0, ...viewport })).toBe(true);
        const exit = await box(page, "#raid-drill-leave");
        expect(inside(exit, bounds)).toBe(true);
        await expect(page.locator("#raid-drill-leave")).toBeInViewport();
        const last = page.locator("[data-raid-drill]").last();
        await last.click();
        expect(
          await page.evaluate(() =>
            (window as any).__events.findLast(
              (e: any) => e.event === "raid-drill",
            ),
          ),
        ).toEqual({ event: "raid-drill", data: { kind: attacks.at(-1) } });
        if (viewport.width < 1000) {
          expect(
            await last.evaluate((el) => el.getBoundingClientRect().height),
          ).toBeGreaterThanOrEqual(36);
          expect(
            await last.evaluate((el) => el.scrollWidth - el.clientWidth),
          ).toBeLessThanOrEqual(1);
        }
        await expect(page.locator(".raid-drill-count")).toHaveText(
          "Dodged 12 · Hit 3",
        );
      }
      // Non-hosts can read instructions but cannot change/end a shared practice.
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.players.reverse();
        w.__push();
      });
      await expect(page.locator("#raid-drill-leave")).toBeDisabled();
      await expect(page.locator("[data-raid-drill]").first()).toBeDisabled();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
