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
          pyranda: read("pyranda"),
          tidefin: read("tidefin"),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      // These contact lines are measured on the source illustrations:
      // Voltkit's paws/foot and Pyranda's grip/soles. Tidefin is freestanding.
      const { card, stage, voltkit, pyranda, tidefin } = placement;
      expect(stage).toEqual(card);
      expect(
        Math.abs(voltkit.x + voltkit.width * 0.835 - card.left),
      ).toBeLessThan(1);
      expect(
        Math.abs(pyranda.x + pyranda.width * 0.09 - card.right),
      ).toBeLessThan(1);
      expect(
        Math.abs(pyranda.bottom - pyranda.height * 0.02 - card.bottom),
      ).toBeLessThan(1);
      if (width > height) {
        // The shared floor stays near the safe bottom of the screen.
        expect(height - card.bottom).toBeLessThanOrEqual(48);
      }
      expect(Math.abs(tidefin.bottom - card.bottom)).toBeLessThan(1);
      expect(placement.overflow, `${width}×${height}, ${mode}`).toBe(false);

      // The decorative layers cannot steal input. Even when a form scrolls,
      // each field, submit and quick button remains reachable and unobscured.
      for (const control of await page
        .locator(
          '.auth-panel input:not([type="checkbox"]), .auth-submit, [data-gate-quick]',
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
