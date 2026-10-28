import { expect, test } from "@playwright/test";
import {
  box,
  inside,
  openTown,
  openTownMenu,
  pushUntilBattle,
  snap,
} from "./helpers";

const buffValues: Record<string, string[]> = {
  shelter: ["−25%"],
  sharing: ["+12"],
  core: ["+8"],
  rescue: ["+15%", "+35%"],
  courage: ["+20%"],
  mending: ["12%"],
  grounded: ["NO"],
  fireproof: ["×2", "−50%"],
  polished: ["+60"],
  lucid: ["1st"],
  footing: ["+15%"],
  lamplighter: ["1%"],
};

for (const size of [
  { width: 1440, height: 900 },
  { width: 1024, height: 500 },
  { width: 844, height: 390 },
  { width: 844, height: 280 },
]) {
  test(`rite pictograms and tap-safe details fit at ${size.width}x${size.height}`, async ({
    browser,
    browserName,
  }, info) => {
    const mobile = size.width !== 1440;
    const context = await browser.newContext({
      viewport: size,
      isMobile: mobile,
      hasTouch: mobile,
    });
    try {
      const page = await context.newPage();
      const drawingErrors: string[] = [];
      let watchRites = false;
      page.on("console", (message) => {
        if (
          watchRites &&
          message.type() === "error" &&
          /attribute d|<path>|parsing.*path/i.test(message.text())
        )
          drawingErrors.push(message.text());
      });
      const errors = await openTown(page);
      await page.evaluate(() =>
        (window as any).__room("raid", { boss: "grumblecrag" }),
      );
      await openTownMenu(page);
      await page.click(".town-play");
      await page.click("#play-create");
      await pushUntilBattle(page);
      await page.evaluate(() => {
        const w = window as any,
          previous = w.__emit;
        w.__riteRequests = [];
        w.__emit = (event: string, data: unknown) => {
          if (event === "rite") w.__riteRequests.push(data);
          previous?.(event, data);
        };
      });
      watchRites = true;
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
        await page.locator(".raid-draft").evaluate(async (e) => {
          await Promise.all(
            e.getAnimations().map((a) => a.finished.catch(() => {})),
          );
        });
        const card = await box(page, ".raid-draft");
        for (const id of offers) {
          const selector = `[data-raid-rite="${id}"]`;
          const button = await box(page, selector),
            content = await box(page, selector + " .raid-rite-copy");
          expect(inside(button, card)).toBe(true);
          expect(inside(content, button)).toBe(true);
          expect(
            Math.abs(
              content.x + content.width / 2 - button.x - button.width / 2,
            ),
          ).toBeLessThanOrEqual(2);
          expect(
            Math.abs(
              content.y + content.height / 2 - button.y - button.height / 2,
            ),
          ).toBeLessThanOrEqual(2);
          for (const part of [
            ".raid-rite-icon",
            "b",
            ".raid-rite-trigger",
            ".raid-rite-buff-stat",
          ]) {
            expect(inside(await box(page, selector + " " + part), button)).toBe(
              true,
            );
          }
          const emblem = await box(page, selector + " .raid-rite-icon--buff");
          for (const stat of await page
            .locator(selector + " .raid-rite-buff-stat")
            .all()) {
            const statBox = await stat.boundingBox();
            expect(statBox && inside(statBox, emblem)).toBe(true);
            const value = stat.locator(".raid-rite-buff-value"),
              unit = stat.locator(".raid-rite-buff-unit");
            for (const label of [value, unit]) {
              const labelBox = await label.boundingBox();
              expect(
                labelBox && inside(labelBox, emblem),
                `${id}: ${await label.textContent()} must stay in its emblem`,
              ).toBe(true);
            }
            expect(
              await value.evaluate((e) =>
                parseFloat(getComputedStyle(e).fontSize),
              ),
            ).toBeGreaterThanOrEqual(22);
            expect(
              await unit.evaluate((e) =>
                parseFloat(getComputedStyle(e).fontSize),
              ),
            ).toBeGreaterThanOrEqual(10);
          }
          expect(
            await page
              .locator(selector + " .raid-rite-buff-value")
              .allTextContents(),
          ).toEqual(buffValues[id]);
          const svg = page.locator(selector + " svg");
          await expect(svg).toHaveAttribute("data-rite-picture", id);
          const ink = await svg.evaluate((e: SVGGraphicsElement) => {
            const r = e.getBBox();
            return {
              x: r.x,
              y: r.y,
              right: r.x + r.width,
              bottom: r.y + r.height,
            };
          });
          expect(ink.x).toBeGreaterThanOrEqual(1);
          expect(ink.y).toBeGreaterThanOrEqual(1);
          expect(ink.right).toBeLessThanOrEqual(159);
          expect(ink.bottom).toBeLessThanOrEqual(115);
        }
        await expect(
          page.locator("[data-raid-rite] .raid-rite-effect"),
        ).toHaveCount(0);
        const more = page.locator(".raid-rite-more"),
          summary = more.locator("summary");
        expect(inside(await box(page, ".raid-rite-more > summary"), card)).toBe(
          true,
        );
        await summary.click();
        await expect(more).toHaveAttribute("open", "");
        await expect(page.locator(".raid-rite-options")).toHaveJSProperty(
          "inert",
          true,
        );
        await expect(page.locator(".raid-rite-reference li")).toHaveCount(3);
        expect(inside(await box(page, ".raid-rite-reference"), card)).toBe(
          true,
        );
        expect(
          await page.evaluate(() => (window as any).__riteRequests),
        ).toEqual([]);
        const reference = await box(page, ".raid-rite-reference"),
          close = await box(page, ".raid-rite-more > summary");
        expect(reference.y + reference.height).toBeLessThanOrEqual(close.y);
        if (offers[0] === "shelter")
          await snap(
            page,
            info,
            `rite-full-effects-${size.width}x${size.height}`,
          );
        // Live countdown/team updates must preserve a reference being read.
        await page.evaluate(() => {
          const w = window as any;
          w.__snap.remaining = 12;
          w.__push();
        });
        await expect(more).toHaveAttribute("open", "");
        await expect(page.locator(".raid-choice-timer")).toContainText(
          "12 seconds",
        );
        if (size.height === 280) {
          expect(
            await page
              .locator(".raid-rite-reference")
              .evaluate((e) => e.scrollHeight > e.clientHeight),
          ).toBe(true);
        }
        if (size.height === 280 && browserName === "chromium") {
          const client = await context.newCDPSession(page);
          const area = await box(page, ".raid-rite-reference");
          const x = area.x + area.width / 2,
            y = area.y + area.height - 8;
          await client.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x, y }],
          });
          for (let i = 1; i <= 8; i++) {
            await client.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [{ x, y: y - ((area.height - 20) * i) / 8 }],
            });
          }
          await client.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
          await expect
            .poll(() =>
              page.locator(".raid-rite-reference").evaluate((e) => e.scrollTop),
            )
            .toBeGreaterThan(10);
          await client.detach();
        }
        await summary.click();
        await expect(page.locator(".raid-rite-options")).toHaveJSProperty(
          "inert",
          false,
        );
        {
          await snap(
            page,
            info,
            `rite-pictograms-${offers[0]}-${size.width}x${size.height}`,
          );
        }
      }
      const summary = page.locator(".raid-rite-more > summary");
      await summary.click();
      await summary.press("Escape");
      await expect(page.locator(".raid-rite-more")).not.toHaveAttribute(
        "open",
        "",
      );
      await expect(page.locator(".raid-rite-options")).toHaveJSProperty(
        "inert",
        false,
      );
      await page.locator('[data-raid-rite="lucid"]').click();
      await expect
        .poll(() => page.evaluate(() => (window as any).__riteRequests))
        .toEqual([{ id: "lucid" }]);
      expect(errors).toEqual([]);
      expect(drawingErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
