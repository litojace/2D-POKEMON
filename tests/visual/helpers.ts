import { expect, type Page, type TestInfo } from "@playwright/test";

/** Load the client signed in and wait for the town. */
export async function openTown(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).__sock);
  // The client listens for "connect" once its account has loaded.
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__sock.fire("connect"));
        return page.locator("#town-menu-toggle").isVisible();
      },
      { timeout: 30_000, intervals: [500, 1000] },
    )
    .toBe(true);
  return errors;
}

export async function openTownMenu(page: Page) {
  await page.click("#town-menu-toggle");
  await expect(page.locator("#town-menu-items")).not.toHaveAttribute("inert", "");
}

/** Push the prepared room's snapshot until the battle screen is up. */
export async function pushUntilBattle(page: Page) {
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__push());
        return page.evaluate(() => document.body.classList.contains("battle-active"));
      },
      { timeout: 20_000, intervals: [400] },
    )
    .toBe(true);
  // A few more frames so the floor and fighters settle.
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => (window as any).__push());
    await page.waitForTimeout(300);
  }
}

export async function snap(page: Page, info: TestInfo, name: string) {
  const body = await page.screenshot();
  await info.attach(name, { body, contentType: "image/png" });
  // Locally, VISUAL_SHOTS=<folder> also saves each screen there to look over.
  const dir = process.env.VISUAL_SHOTS;
  if (dir) {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${name}.png`, body);
  }
}

export type Box = { x: number; y: number; width: number; height: number };
export const box = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
/** Is `inner` inside `outer`, give or take a pixel? */
export const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 1 &&
  inner.y >= outer.y - 1 &&
  inner.x + inner.width <= outer.x + outer.width + 1 &&
  inner.y + inner.height <= outer.y + outer.height + 1;
