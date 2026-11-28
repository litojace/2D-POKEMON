/**
 * The website's Plaza picture (docs/website.md, "The Plaza and its pond"):
 * the real Plaza, at the pond, with two friends on the path behind the
 * angler: the line out, then the bite.
 *
 *   npx playwright test --config scripts/site-clips/playwright.config.ts scripts/site-clips/plaza.spec.ts
 *   python3 apps/site/tools/make-scenes.py
 *
 * Writes site-clips/plaza/wait.png and bite.png, and each without the
 * fishing buttons (-clean); make-scenes.py cuts the page's pictures from
 * the bite.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { openPlaza } from "../../tests/visual/helpers";
import { playersLook } from "../../tests/visual/players-look";
import { PLAZA_SPOTS } from "../../packages/shared/src/plaza";

const OUT = "site-clips/plaza";
const SPOT = PLAZA_SPOTS.find((s) => s.id === "fish")!;
const mode = (page: Page) =>
  page.evaluate(() => (window as any).__plaza.fishingMode);
const act = (page: Page) => page.locator("#pz-fish-act");

test("plaza fishing", async ({ browser }) => {
  test.setTimeout(600_000);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await playersLook(page);
  await openPlaza(page);
  mkdirSync(OUT, { recursive: true });
  const shot = async (name: string) => {
    await page.screenshot({ path: `${OUT}/${name}.png` });
    // The scene alone: fishing's buttons and the hub's bar hidden.
    const hide = await page.addStyleTag({
      content:
        "#pz-fishhud, .pz-hud, #hub-scenes, #account-profile, #account-coins, .header-menu, .chat-button, #toast { visibility: hidden !important; }",
    });
    await page.screenshot({ path: `${OUT}/${name}-clean.png` });
    await hide.evaluate((s) => (s as Element).remove());
  };
  await page.evaluate(
    ([x, y]) => {
      const w = window as any;
      // The fish bites when told, and waits for the tap.
      w.__plazaBiteAfter = 600_000;
      w.__plazaBiteHold = true;
      w.__plazaPosition(x, y);
      w.__plazaWorld.updateProfile("local", { name: "Blaze" });
      // Two friends on the path behind the angler, clear of the rod rack.
      for (const [id, name, character, dx, dy] of [
        ["friend-1", "Nova", "tidefin", -78, -30],
        ["friend-2", "Kai", "pyranda", -128, -44],
      ] as const) {
        w.__plazaWorld.join(id, `acct-${id}`, {
          name,
          title: null,
          titleColor: null,
          level: 9,
          character,
          skin: null,
        });
        Object.assign(w.__plazaWorld.bodyOf(id), {
          x: x + dx,
          y: y + dy,
          lastX: 1,
          lastY: 0,
        });
      }
    },
    [SPOT.x, SPOT.y],
  );
  await expect(page.locator("#pz-interact")).toBeVisible({ timeout: 60_000 });
  await page.click("#pz-interact");
  await expect(page.locator("#pz-fishhud")).toBeVisible();
  await page.waitForTimeout(2500); // the camera eases in
  await act(page).click();
  await expect.poll(async () => (await mode(page)).phase).toBe("wait");
  await page.waitForTimeout(1500);
  await shot("wait");
  await page.evaluate(() => (window as any).__plazaBiteNow());
  await expect
    .poll(async () => (await mode(page)).phase, { timeout: 30_000 })
    .toBe("bite");
  await shot("bite");
  await context.close();
});
