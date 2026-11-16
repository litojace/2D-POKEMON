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

  test("one knob scales every text size", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openLobby(page);
    await hubMenu(page, "missions");
    // A token size (the panel title), a px size from style.css (the
    // scene switch) and one from lobby.css (the rail's labels are hidden on
    // phones, so the player card's name).
    const probes = [
      ".missions-sheet .ui-title",
      "#hub-scenes button",
      "#account-profile",
    ];
    const sizes = () =>
      page.evaluate(
        (sel) =>
          sel.map((s) =>
            parseFloat(getComputedStyle(document.querySelector(s)!).fontSize),
          ),
        probes,
      );
    const before = await sizes();
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--text-scale", "1.5"),
    );
    const after = await sizes();
    for (let i = 0; i < probes.length; i++)
      expect(after[i], probes[i]).toBeCloseTo(before[i] * 1.5, 0);
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
    await page.click('[data-ui-section="skins"]');
    const cols = await page
      .locator(".fit-grid")
      .first()
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      );
    expect(cols).toBe(4);
    // A pick brings the bar back, Buy in it.
    await page.click('[data-ui-section="today"]');
    await page.click(".fit-deal");
    await expect(page.locator(".fit-room .ui-panel-foot")).toBeVisible();
    await expect(page.locator("[data-fit-buy]")).toBeVisible();
    await snap(page, info, "phone-shop-today");
  });

  test("a 667 px phone keeps three tiles a row", async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 375 });
    await openLobby(page);
    await hubMenu(page, "shop");
    await page.click('[data-ui-section="skins"]');
    const cols = await page
      .locator(".fit-grid")
      .first()
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      );
    expect(cols).toBe(3);
  });

  test("Mythic Hall picks one fighter and shows its three stages", async ({
    page,
  }, info) => {
    await page.setViewportSize(PHONE);
    await openLobby(page);
    await setInsets(page, ISLAND);
    await hubMenu(page, "shop");
    await page.click('[data-ui-section="mythic"]');
    const body = page.locator('[data-fit-region=body][data-section="mythic"]');
    await expect(body.locator(".fit-fighters")).toBeVisible();
    // One Mythical, the chosen fighter's, with Stage I, II and III.
    await expect(body.locator(".fit-mythic-one .ui-tile")).toHaveCount(1);
    await expect(body.locator(".fit-mythic-stages li")).toHaveText([
      /^Stage I(?!I)/,
      /^Stage II(?!I)/,
      /^Stage III/,
    ]);
    // The whole hall fits in about a screen and a half.
    const m = await page
      .locator(".fit-body")
      .evaluate((el) => el.scrollHeight / el.clientHeight);
    expect(m).toBeLessThan(1.8);
    await snap(page, info, "phone-mythic-pick");
    // Another fighter: its own Mythical, which tries on as before.
    await body.locator("[data-fit-fighter=cindrake]").click();
    const tile = body.locator(".fit-mythic-one .ui-tile");
    await expect(tile).toHaveAttribute("data-ui-item", "cindrake-sunforged");
    await tile.click();
    await expect(page.locator(".fit-room .ui-panel-foot")).toBeVisible();
    // Desktop keeps the grid of all of them.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(body.locator(".fit-mythic-one")).toHaveCount(0);
    await expect(body.locator(".fit-grid > .ui-tile")).not.toHaveCount(0);
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

  test("raid Rewards: looks two a row, then titles three a row", async ({
    page,
  }, info) => {
    await page.setViewportSize(PHONE);
    // Raid progress, so the tab lists every reward (the harness has none).
    await page.addInitScript(() => {
      const raids = {
        clears: 4,
        highestPeril: 2,
        bosses: { grumblecrag: { clears: 3, highestPeril: 2 } },
        titles: [],
        cosmetics: [],
        earned: [],
        weekly: [],
        loadout: {},
      };
      let cur = window.fetch;
      const wrap =
        (inner: typeof fetch): typeof fetch =>
        async (input, init) => {
          const url = new URL(
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.href
                : input.url,
            location.href,
          );
          return url.pathname === "/api/raids"
            ? Response.json(raids)
            : inner(input, init);
        };
      cur = wrap(cur);
      Object.defineProperty(window, "fetch", {
        configurable: true,
        get: () => cur,
        set: (v) => {
          cur = wrap(v);
        },
      });
    });
    await openLobby(page);
    await setInsets(page, ISLAND);
    await hubMenu(page, "raids");
    await page.click('[data-raid-card="grumblecrag"]');
    await page.click('[data-ui-raid-tab="rewards"]');
    const cards = page.locator(".rh-rewards.is-all > .rh-reward");
    await expect(cards).not.toHaveCount(0);
    const kinds = await cards.evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.rewardKind),
    );
    // Every look before the first title.
    expect(kinds.indexOf("title")).toBe(kinds.lastIndexOf("look") + 1);
    const perRow = (kind: string) =>
      page
        .locator(`.rh-rewards.is-all > .rh-reward[data-reward-kind="${kind}"]`)
        .evaluateAll((els) => {
          const tops = els.map((e) =>
            Math.round(e.getBoundingClientRect().top),
          );
          return tops.filter((t) => t === tops[0]).length;
        });
    expect(await perRow("look")).toBe(2);
    expect(await perRow("title")).toBe(3);
    const m = await page
      .locator(".rh-body")
      .evaluate((el) => el.scrollHeight / el.clientHeight);
    expect(m).toBeLessThan(2.1);
    await snap(page, info, "phone-raid-rewards");
  });

  test("the player card is four tabs on a phone, each without scrolling", async ({
    page,
  }, info) => {
    await page.setViewportSize(PHONE);
    await openLobby(page);
    await setInsets(page, ISLAND);
    await page.click("#account-profile");
    const panel = page.locator(".profile-panel");
    // The tabs share the head with the name, Share card and Close.
    const head = await box(page, ".profile-panel .ui-panel-head");
    const tabs = await box(page, ".profile-panel .ui-panel-head .ui-tabs");
    expect(tabs.y).toBeGreaterThanOrEqual(head.y);
    expect(tabs.y + tabs.height).toBeLessThanOrEqual(head.y + head.height + 1);
    for (const [t, shows] of [
      ["overview", ".pf-tile"],
      ["titles", ".pf-title-chip"],
      ["mastery", ".pf-mastery-chip"],
      ["trophies", ".pf-trophy"],
    ]) {
      await panel.locator(`[data-ui-profile-tab="${t}"]`).click();
      await expect(
        panel.locator(`[data-ui-profile-tab="${t}"]`),
      ).toHaveAttribute("aria-selected", "true");
      await expect(panel.locator(shows).first()).toBeVisible();
      const m = await panel
        .locator("[data-profile-main]")
        .evaluate((el) => el.scrollHeight / el.clientHeight);
      // Overview holds the name and account rows: a little over a screen.
      expect(m, t).toBeLessThan(t === "overview" ? 1.4 : 1.05);
    }
    await snap(page, info, "phone-profile-trophies");
    // A desktop keeps the one column, no tabs.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(panel.locator("[data-ui-profile-tab]")).toHaveCount(0);
    await expect(panel.locator(".pf-mastery-chip")).toHaveCount(18);
    await expect(panel.locator(".pf-trophy")).toHaveCount(7);
  });
});
