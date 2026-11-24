import { expect, test, type Browser } from "@playwright/test";
import { openPlaza, snap } from "./helpers";

// On the Plaza, the header's avatar opens your card over the Plaza: you
// stay where you are (it used to send you back to the Lobby, owner 24 Nov).
// The round buttons (Map, gift boxes, Album) are a size up on touch screens.
type Inset = { left: number; right: number; top: number; bottom: number };
const SIZES: {
  name: string;
  width: number;
  height: number;
  touch: boolean;
  inset?: Inset;
  /** The round buttons' smallest width there. */
  round: number;
}[] = [
  { name: "desktop", width: 1440, height: 900, touch: false, round: 70 },
  { name: "ipad", width: 1366, height: 1024, touch: true, round: 84 },
  { name: "ipad-mini", width: 1133, height: 744, touch: true, round: 84 },
  { name: "phone-se", width: 667, height: 375, touch: true, round: 52 },
  { name: "phone", width: 844, height: 390, touch: true, round: 52 },
  {
    name: "island",
    width: 852,
    height: 393,
    touch: true,
    inset: { left: 59, right: 59, bottom: 21, top: 0 },
    round: 52,
  },
];

async function open(browser: Browser, size: (typeof SIZES)[number]) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    isMobile: size.touch,
    hasTouch: size.touch,
  });
  const page = await context.newPage();
  const errors = await openPlaza(page);
  if (size.inset)
    await page.evaluate((inset) => {
      for (const [key, value] of Object.entries(inset))
        document.documentElement.style.setProperty(
          `--safe-${key}`,
          `${value}px`,
        );
    }, size.inset);
  return { context, page, errors };
}

for (const size of SIZES)
  test(`your card opens over the Plaza (${size.name})`, async ({
    browser,
  }, info) => {
    const { context, page, errors } = await open(browser, size);
    // The round buttons: big enough to hit, centred words.
    const rounds = await page
      .locator(".plaza-layer .pz-left .pz-round")
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { w: r.width, h: r.height };
        }),
      );
    expect(rounds).toHaveLength(3);
    for (const r of rounds) {
      expect(r.w, "round button width").toBeGreaterThanOrEqual(size.round);
      expect(Math.abs(r.w - r.h), "a circle").toBeLessThan(1);
    }
    await snap(page, info, `plaza-profile-${size.name}-hud`);

    await page.click("#account-profile");
    const card = page.locator(
      ".plaza-layer > .ui-panel-host > .ui-panel:not([data-ui-leaving])",
    );
    await expect(card).toBeVisible();
    // Still on the Plaza: the scene, the switch and the playground.
    expect(await page.evaluate(() => document.body.dataset.hubScene)).toBe(
      "plaza",
    );
    await expect(page.locator(".plaza-layer #pz-cv")).toBeVisible();
    await expect(page.locator(".plaza-layer .pz-hud")).toBeHidden();
    // Clear of the header, inside the screen.
    const box = (await card.boundingBox())!;
    const head = (await page.locator("#account-profile").boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(head.y + head.height);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    await page.waitForTimeout(400);
    await snap(page, info, `plaza-profile-${size.name}-open`);

    // Escape closes it; the Plaza's buttons come back.
    await page.keyboard.press("Escape");
    await expect(page.locator(".plaza-layer .ui-panel")).toHaveCount(0);
    await expect(page.locator(".plaza-layer .pz-left")).toBeVisible();
    expect(await page.evaluate(() => document.body.dataset.hubScene)).toBe(
      "plaza",
    );

    // Open again, then go to the Lobby: it closes with the Plaza, and
    // opens in the Lobby from there.
    await page.click("#account-profile");
    await expect(card).toBeVisible();
    await page.click('#hub-scenes [data-hub-scene="lobby"]');
    await expect(page.locator(".plaza-layer .ui-panel")).toHaveCount(0);
    await page.click("#account-profile");
    await expect(
      page.locator(".lobby-layer > .ui-panel-host > .ui-panel"),
    ).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });
