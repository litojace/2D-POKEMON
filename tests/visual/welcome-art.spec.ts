import { expect, test } from "@playwright/test";
import { onPlayersLook } from "./players-look";
import { ISLAND, setInsets } from "./ui-measure";

onPlayersLook();

test("the illustrated grips stay on the panel through resizes and form changes", async ({
  page,
}) => {
  await page.route("**/stubs.ts*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        "getSession: async () => ({ data: { session } })",
        "getSession: async () => ({ data: { session: null } })",
      ),
    });
  });
  await page.goto("/");
  await expect(page.locator(".auth-panel")).toBeVisible();
  await expect(page.locator("#server-startup")).toHaveCount(0);
  await page.locator(".gate-action").evaluateAll(async (elements) => {
    await Promise.all(
      elements.map(async (el) => {
        const url = getComputedStyle(el).backgroundImage.match(
          /url\(["']?([^"')]+)["']?\)/,
        )?.[1];
        if (!url) throw new Error("Missing welcome illustration");
        const image = new Image();
        image.src = url;
        await image.decode();
      }),
    );
  });

  for (const [width, height] of [
    [1440, 900],
    [844, 390],
    [667, 375],
    [568, 320],
    [852, 393],
    [390, 844],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    await setInsets(
      page,
      width === 852 ? ISLAND : { left: 0, right: 0, top: 0, bottom: 0 },
    );
    for (const mode of ["login", "signup"] as const) {
      await page.locator(`[data-auth-tab="${mode}"]`).click();
      const placement = await page.evaluate(() => {
        const card = document
          .querySelector(".gate-card")!
          .getBoundingClientRect();
        const stage = document
          .querySelector(".gate-account-stage")!
          .getBoundingClientRect();
        const read = (name: string) => {
          const element = document.querySelector(`.gate-action-${name}`)!;
          const r = element.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            bottom: r.bottom,
          };
        };
        return {
          card: { left: card.left, right: card.right, bottom: card.bottom },
          stage: { left: stage.left, right: stage.right, bottom: stage.bottom },
          voltkit: read("voltkit"),
          terradon: read("terradon"),
          reaction: read("reaction"),
          betaRight:
            document
              .querySelector(".gate-intro .beta-tag")
              ?.getBoundingClientRect().right ?? 0,
          beta:
            document
              .querySelector(".gate-intro .beta-tag")
              ?.getBoundingClientRect()
              .toJSON() ?? null,
          menu: document
            .querySelector(".quick-menu-trigger")!
            .getBoundingClientRect()
            .toJSON(),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      // These contact lines are measured on the source illustrations:
      // Voltkit's grip and the ground beneath Terradon and the reacting pair.
      const { card, stage, voltkit, terradon, reaction } = placement;
      expect(stage).toEqual(card);
      expect(
        Math.abs(voltkit.x + voltkit.width * 0.835 - card.left),
      ).toBeLessThan(1);
      expect(
        Math.abs(terradon.bottom - terradon.height * 0.045 - card.bottom),
      ).toBeLessThan(1);
      expect(
        Math.abs(reaction.bottom - reaction.height * 0.09 - card.bottom),
      ).toBeLessThan(1);
      for (const art of [voltkit, terradon, reaction]) {
        expect(art.x).toBeGreaterThanOrEqual(0);
        expect(art.x + art.width).toBeLessThanOrEqual(width);
      }
      if (width > height) {
        // The shared floor stays near the safe bottom of the screen.
        expect(height - card.bottom).toBeLessThanOrEqual(48);
        expect(placement.betaRight).toBeLessThanOrEqual(card.left);
        const menu = placement.menu;
        expect(
          menu.right <= terradon.x ||
            menu.left >= terradon.x + terradon.width ||
            menu.bottom <= terradon.y ||
            menu.top >= terradon.bottom,
        ).toBe(true);
      }
      // Voltkit's flight art keeps clear of the BETA tag above it: signing
      // up, the taller form had lifted its ear onto the tag's corner at
      // 667 × 375 (themes/poster/onboarding.css).
      const tag = placement.beta;
      if (tag)
        expect(
          voltkit.y >= tag.bottom ||
            voltkit.x >= tag.right ||
            voltkit.x + voltkit.width <= tag.left ||
            voltkit.bottom <= tag.top,
          `${width}×${height}, ${mode}: Voltkit clear of BETA`,
        ).toBe(true);
      // With the Dynamic Island the fighters, the tag and MENU keep out of
      // its insets at the sides.
      if (width === 852) {
        for (const [what, box] of [
          ["Voltkit", { left: voltkit.x, right: voltkit.x + voltkit.width }],
          [
            "Terradon",
            { left: terradon.x, right: terradon.x + terradon.width },
          ],
          [
            "the pair",
            { left: reaction.x, right: reaction.x + reaction.width },
          ],
          ["BETA", tag ?? { left: ISLAND.left, right: ISLAND.left }],
          ["MENU", placement.menu],
        ] as const) {
          expect(box.left, `${what} left of the island`).toBeGreaterThanOrEqual(
            ISLAND.left,
          );
          expect(box.right, `${what} right of the island`).toBeLessThanOrEqual(
            width - ISLAND.right,
          );
        }
      }
      expect(placement.overflow, `${width}×${height}, ${mode}`).toBe(false);

      // The decorative layers cannot steal input. Even when a form scrolls,
      // each field, submit and quick button remains reachable and unobscured.
      for (const control of await page
        .locator(
          '.auth-panel input:not([type="checkbox"]), .auth-submit, .quick-menu-trigger',
        )
        .all()) {
        await control.scrollIntoViewIfNeeded();
        expect(
          await control.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const hit = document.elementFromPoint(
              r.x + r.width / 2,
              r.y + r.height / 2,
            );
            return !!hit && el.contains(hit);
          }),
        ).toBe(true);
      }
    }
  }
});

test("the group illustration is centred on the rays at each screen size", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__showTitle = true;
  });
  await page.goto("/");
  await expect(page.locator("[data-title-card]")).toBeVisible();
  await expect(page.locator("#server-startup")).toHaveCount(0);
  for (const [width, height] of [
    [1440, 900],
    [844, 390],
    [667, 375],
    [852, 393],
    [390, 844],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    await setInsets(
      page,
      width === 852 ? ISLAND : { left: 0, right: 0, top: 0, bottom: 0 },
    );
    const at = await page.evaluate(() => {
      const gate = document.querySelector(".welcome-gate")!;
      const r = gate.getBoundingClientRect();
      const css = getComputedStyle(gate);
      const art = document
        .querySelector(".title-illustration")!
        .getBoundingClientRect();
      return {
        dx:
          art.x +
          art.width / 2 -
          (r.x + r.width * parseFloat(css.getPropertyValue("--cover-x"))),
        dy:
          art.y +
          art.height / 2 -
          (r.y + r.height * parseFloat(css.getPropertyValue("--cover-y"))),
        left: art.left,
        right: art.right,
        top: art.top,
        bottom: art.bottom,
      };
    });
    expect(Math.abs(at.dx)).toBeLessThan(1);
    expect(Math.abs(at.dy)).toBeLessThan(1);
    expect(at.left).toBeGreaterThanOrEqual(0);
    expect(at.right).toBeLessThanOrEqual(width);
    expect(at.top).toBeGreaterThanOrEqual(0);
    expect(at.bottom).toBeLessThanOrEqual(height);
  }
});

test("MENU supports keyboard, dismissal and actions without starting the game", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__showTitle = true;
  });
  await page.goto("/");
  await expect(page.locator("[data-title-card]")).toBeVisible();
  await expect(page.locator("#server-startup")).toHaveCount(0);
  await expect
    .poll(async () => {
      await page.evaluate(() => (window as any).__sock.fire("connect"));
      return page.locator("#title-start").isEnabled();
    })
    .toBe(true);
  const menu = page.locator(".quick-menu-trigger");
  const actions = page.locator("#welcome-tools-actions");
  await expect(actions).toBeHidden();
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  for (const button of await page.locator("[data-gate-quick]").all()) {
    const r = (await button.boundingBox())!;
    expect(r.width).toBeGreaterThanOrEqual(44);
    expect(r.height).toBeGreaterThanOrEqual(44);
  }
  // The first background click dismisses the disclosure, without starting.
  await page.locator("#title-start").click({ position: { x: 600, y: 350 } });
  await expect(actions).toBeHidden();
  await expect(page.locator("[data-title-card]")).toBeVisible();
  await menu.click();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-gate-quick="settings"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#dialog .settings-screen")).toBeVisible();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(page.locator("[data-title-card]")).toBeVisible();
});
