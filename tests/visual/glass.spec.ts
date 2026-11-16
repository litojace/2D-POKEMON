import { expect, test, type Page } from "@playwright/test";
import { box, hubMenu, openLobby, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";

// One glass look for every menu (ui/tokens.css --glass-*, applied by
// ui/aero.css and ui/components.css): panels, sheets, dialogs, the Play
// drawer and the toast read the same tokens as the Lobby, so changing a
// token changes all of them. Plus two phone layout rules that came with it:
// the toast stays off an open panel, and a split panel's tabs share the
// "‹ Back" row.
const PHONE = { width: 852, height: 393 };

const bg = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
const rim = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el).borderTopColor);
const setToken = (page: Page, name: string, value: string) =>
  page.evaluate(
    ([n, v]) => document.documentElement.style.setProperty(n, v),
    [name, value],
  );

test.describe("glass", () => {
  test("every surface reads the glass tokens", async ({ page }, info) => {
    await page.setViewportSize(PHONE);
    await openLobby(page);
    await setInsets(page, ISLAND);

    // A sheet, then a split panel's main column.
    await hubMenu(page, "missions");
    const sheet = ".ui-panel.missions-sheet";
    await expect(page.locator(sheet)).toBeVisible();
    expect(await bg(page, sheet)).toBe("rgba(12, 18, 35, 0.7)");
    expect(await rim(page, sheet)).toBe("rgba(226, 200, 140, 0.42)");
    // Change the token once: the open sheet follows.
    await setToken(page, "--glass-regular", "rgba(1, 2, 3, 0.5)");
    expect(await bg(page, sheet)).toBe("rgba(1, 2, 3, 0.5)");
    await setToken(page, "--glass-rim", "rgb(0, 128, 0)");
    expect(await rim(page, sheet)).toBe("rgb(0, 128, 0)");
    await page.evaluate(() =>
      document.documentElement.removeAttribute("style"),
    );
    await setInsets(page, ISLAND);
    await snap(page, info, "glass-sheet");

    await hubMenu(page, "raids");
    await page.click('[data-raid-card="grumblecrag"]');
    const main = ".rh-room .ui-split-main";
    await expect(page.locator(main)).toBeVisible();
    expect(await bg(page, main)).toBe("rgba(12, 18, 35, 0.7)");
    // Cards inside are see-through too, not solid navy blocks.
    expect(await bg(page, ".rh-seat")).toBe("rgba(70, 100, 180, 0.14)");
    await page.click("[data-ui-close]");

    // An old-style dialog (Settings): thick glass and the same rim.
    await page.evaluate(() => document.getElementById("settings")!.click());
    const dialog = "dialog[open]";
    await expect(page.locator(dialog)).toBeVisible();
    expect(await bg(page, dialog)).toBe("rgba(11, 16, 32, 0.88)");
    expect(await rim(page, dialog)).toBe("rgba(226, 200, 140, 0.42)");
    await setToken(page, "--glass-thick", "rgba(9, 9, 9, 0.6)");
    expect(await bg(page, dialog)).toBe("rgba(9, 9, 9, 0.6)");
    // Its dim lets the scene show (it was 80 % black).
    expect(
      await page
        .locator(dialog)
        .evaluate((el) => getComputedStyle(el, "::backdrop").backgroundColor),
    ).toBe("rgba(4, 8, 20, 0.5)");
  });

  test("the Lobby's rail is one glass capsule, the open screen gold", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await openLobby(page);
    const rail = ".lobby-rail";
    expect(await bg(page, rail)).toBe("rgba(13, 20, 38, 0.62)");
    expect(await rim(page, rail)).toBe("rgba(226, 200, 140, 0.42)");
    // Its buttons have no box of their own…
    expect(await bg(page, `${rail} button`)).toBe("rgba(0, 0, 0, 0)");
    // …and every one sits inside the capsule.
    const outer = await box(page, rail);
    for (const b of await page.locator(`${rail} button`).all()) {
      const r = (await b.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(outer.x);
      expect(r.x + r.width).toBeLessThanOrEqual(outer.x + outer.width + 0.5);
    }
    await hubMenu(page, "missions");
    // Once its colour change (0.15 s) has run.
    await expect
      .poll(() => bg(page, `${rail} [aria-current="page"]`))
      .toBe("rgb(255, 214, 91)");
  });

  test("Low graphics: no blur, a deeper tint", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
    await page.setViewportSize(PHONE);
    await openLobby(page);
    await hubMenu(page, "missions");
    const sheet = ".ui-panel.missions-sheet";
    await expect(page.locator(sheet)).toHaveAttribute("data-graphics", "low");
    expect(await bg(page, sheet)).toBe("rgba(12, 18, 34, 0.94)");
    expect(
      await page
        .locator(sheet)
        .evaluate((el) => getComputedStyle(el).backdropFilter),
    ).toBe("none");
  });

  test("the toast stays off an open panel on a phone", async ({
    page,
  }, info) => {
    await page.setViewportSize(PHONE);
    await openLobby(page);
    await setInsets(page, ISLAND);
    await hubMenu(page, "missions");
    await expect(page.locator(".missions-sheet")).toBeVisible();
    await page.evaluate(() => {
      const t = document.getElementById("toast")!;
      t.textContent = "Pip wants to be friends. Open Friends to answer.";
      t.classList.add("show");
      t.getAnimations().forEach((a) => a.finish());
    });
    await page.waitForTimeout(400);
    const t = await box(page, "#toast");
    const panel = await box(page, ".missions-sheet");
    expect(
      t.y + t.height,
      "the toast ends above the panel",
    ).toBeLessThanOrEqual(panel.y);
    expect(t.y).toBeGreaterThanOrEqual(0);
    await snap(page, info, "glass-toast-panel");
  });

  test("phone: a split panel's tabs share the Back row", async ({
    page,
  }, info) => {
    await page.setViewportSize(PHONE);
    await openLobby(page);
    await setInsets(page, ISLAND);
    await hubMenu(page, "raids");
    await page.click('[data-raid-card="grumblecrag"]');
    await expect(page.locator("[data-raid-back]")).toBeVisible();
    const back = await box(page, "[data-raid-back]");
    const tabs = await box(page, ".rh-room .ui-split-main > .ui-tabs");
    const close = await box(page, ".rh-room .ui-close");
    const body = await box(page, ".rh-room .rh-body");
    // One row: the tabs sit between Back and Close, at the same height.
    expect(tabs.x).toBeGreaterThanOrEqual(back.x + back.width);
    expect(tabs.y).toBeLessThan(back.y + back.height);
    expect(back.y).toBeLessThan(tabs.y + tabs.height);
    // The last tab ends clear of Close.
    const last = await page
      .locator(".rh-room .ui-tabs > button")
      .last()
      .boundingBox();
    expect(last!.x + last!.width).toBeLessThanOrEqual(close.x);
    // And the list starts under that one row.
    expect(body.y).toBeGreaterThanOrEqual(tabs.y + tabs.height - 1);
    expect(body.y - back.y).toBeLessThan(60);
    // Every tab still works.
    await page.click('[data-ui-raid-tab="attacks"]');
    await expect(page.locator('.rh-body[data-tab="attacks"]')).toBeVisible();
    await snap(page, info, "glass-raid-tabs");

    // The fighter page does the same.
    await page.click("[data-ui-close]");
    await hubMenu(page, "fighters");
    await page.click("[data-roster-details]");
    const rback = await box(page, "[data-roster-back]");
    const rtabs = await box(page, ".roster-room .ui-split-main > .ui-tabs");
    expect(rtabs.x).toBeGreaterThanOrEqual(rback.x + rback.width);
    expect(rtabs.y).toBeLessThan(rback.y + rback.height);
  });
});

// Shorter screens on a phone held sideways (MOBILE-GLASS.md, "What changed").
test.describe("phone: less scrolling", () => {
  test("the Shop folds its empty action bar and shows four tiles a row", async ({
    page,
  }, info) => {
    await page.setViewportSize(PHONE);
    await openLobby(page);
    await setInsets(page, ISLAND);
    await hubMenu(page, "shop");
    await expect(page.locator(".fit-room")).toBeVisible();
    // Nothing picked: no bar, the list takes the room.
    await expect(page.locator(".fit-room .ui-panel-foot")).toBeHidden();
    await page.click('[data-ui-section="mythic"]');
    const cols = await page
      .locator(".fit-grid")
      .first()
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      );
    expect(cols).toBe(4);
    await snap(page, info, "phone-shop-mythic");
    // A pick brings the bar back, Buy in it.
    await page.click('[data-ui-section="today"]');
    await page.click(".fit-deal");
    await expect(page.locator(".fit-room .ui-panel-foot")).toBeVisible();
    await expect(page.locator("[data-fit-buy]")).toBeVisible();
  });

  test("a 667 px phone keeps three tiles a row", async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 375 });
    await openLobby(page);
    await hubMenu(page, "shop");
    await page.click('[data-ui-section="mythic"]');
    const cols = await page
      .locator(".fit-grid")
      .first()
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      );
    expect(cols).toBe(3);
  });

  test("the raid Guide's chapters share one row", async ({ page }, info) => {
    await page.setViewportSize(PHONE);
    await openLobby(page);
    await setInsets(page, ISLAND);
    await hubMenu(page, "raids");
    await page.click('[data-raid-card="grumblecrag"]');
    await page.click('[data-ui-raid-tab="guide"]');
    const tops = await page
      .locator(".rh-chapters > li")
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
    expect(tops).toHaveLength(3);
    expect(new Set(tops).size).toBe(1);
    await snap(page, info, "phone-raid-guide");
  });

  test("the player card's mastery and trophies swipe in one row each", async ({
    page,
  }, info) => {
    await page.setViewportSize(PHONE);
    await openLobby(page);
    await setInsets(page, ISLAND);
    await page.click("#account-profile");
    for (const row of [".pf-mastery", ".pf-trophies"]) {
      const list = page.locator(row);
      await expect(list).toBeVisible();
      const tops = await list
        .locator(":scope > li")
        .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
      expect(new Set(tops).size, `${row} is one row`).toBe(1);
      // It scrolls sideways, and its box is as tall as its badges.
      const m = await list.evaluate((el) => ({
        wide: el.scrollWidth > el.clientWidth,
        whole: el.clientHeight >= el.scrollHeight - 1,
        height: el.getBoundingClientRect().height,
      }));
      expect(m.wide).toBe(true);
      expect(m.whole).toBe(true);
      expect(m.height).toBeGreaterThan(40);
    }
    // Nothing after a row starts inside it.
    const mastery = await box(page, ".pf-mastery");
    const next = await box(page, ".pf-minis");
    expect(next.y).toBeGreaterThanOrEqual(mastery.y + mastery.height);
    await snap(page, info, "phone-profile");
  });
});
