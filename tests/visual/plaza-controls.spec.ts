import { expect, test, type Browser } from "@playwright/test";
import { openPlaza, snap } from "./helpers";
import { PLAZA_SPOTS } from "../../packages/shared/src/plaza";

// On the Plaza, the header's avatar opens your card over the Plaza: you
// stay where you are (it used to send you back to the Lobby, owner 24 Nov).
// The controls you play with (Dash, Jump, the stick, fishing's buttons)
// are a size up on touch screens, most of all on tablets.
type Inset = { left: number; right: number; top: number; bottom: number };
const SIZES: {
  name: string;
  width: number;
  height: number;
  touch: boolean;
  inset?: Inset;
  /** Dash's, Jump's and the stick's ring's smallest widths there. */
  dash: number;
  jump: number;
  ring: number;
}[] = [
  {
    name: "desktop",
    width: 1440,
    height: 900,
    touch: false,
    dash: 66,
    jump: 87,
    ring: 0,
  },
  {
    name: "ipad",
    width: 1366,
    height: 1024,
    touch: true,
    dash: 77,
    jump: 102,
    ring: 149,
  },
  {
    name: "ipad-mini",
    width: 1133,
    height: 744,
    touch: true,
    dash: 77,
    jump: 102,
    ring: 149,
  },
  {
    name: "phone-se",
    width: 667,
    height: 375,
    touch: true,
    dash: 69,
    jump: 87,
    ring: 123,
  },
  {
    name: "phone",
    width: 844,
    height: 390,
    touch: true,
    dash: 69,
    jump: 87,
    ring: 123,
  },
  {
    name: "island",
    width: 852,
    height: 393,
    touch: true,
    inset: { left: 59, right: 59, bottom: 21, top: 0 },
    dash: 69,
    jump: 87,
    ring: 123,
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
    // Dash and Jump: big enough to hit, round.
    for (const [id, min] of [
      ["#pz-dash", size.dash],
      ["#pz-jump", size.jump],
    ] as const) {
      const b = (await page.locator(id).boundingBox())!;
      expect(b.width, id).toBeGreaterThanOrEqual(min);
      expect(Math.abs(b.width - b.height), `${id} round`).toBeLessThan(1);
      expect(b.x + b.width, `${id} on screen`).toBeLessThanOrEqual(size.width);
      expect(b.y + b.height, `${id} on screen`).toBeLessThanOrEqual(
        size.height,
      );
    }
    // The stick: its ring where the thumb lands, the knob as far as the
    // ring's edge and no further.
    if (size.ring) {
      const x = 140 + (size.inset?.left ?? 0),
        y = size.height - 110;
      await page.evaluate(
        ([x, y]) => {
          const el = document.getElementById("pz-joy")!;
          const at = (type: string, cx: number, cy: number) =>
            el.dispatchEvent(
              new PointerEvent(type, {
                bubbles: true,
                pointerId: 7,
                pointerType: "touch",
                clientX: cx,
                clientY: cy,
              }),
            );
          at("pointerdown", x, y);
          at("pointermove", x + 400, y);
        },
        [x, y],
      );
      const ring = (await page.locator("#pz-ring").boundingBox())!;
      const knob = (await page.locator("#pz-knob").boundingBox())!;
      expect(ring.width, "the stick's ring").toBeGreaterThanOrEqual(size.ring);
      expect(Math.abs(ring.x + ring.width / 2 - x)).toBeLessThan(2);
      // Pushed far right: the knob's middle on the ring's right edge.
      expect(
        Math.abs(knob.x + knob.width / 2 - (ring.x + ring.width)),
      ).toBeLessThan(2);
      await snap(page, info, `plaza-profile-${size.name}-stick`);
      await page.evaluate(() =>
        dispatchEvent(
          new PointerEvent("pointerup", { pointerId: 7, bubbles: true }),
        ),
      );
      await expect(page.locator("#pz-ring")).toBeHidden();
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

// Fishing on a tablet: the Fish button as big as Dash, then Cast and Reel
// (and the "!" over your head when it bites) a size up from a phone's.
for (const size of SIZES.filter((s) => s.name.startsWith("ipad")))
  test(`fishing's buttons on a tablet (${size.name})`, async ({
    browser,
  }, info) => {
    const { context, page, errors } = await open(browser, size);
    await page.evaluate(() => {
      const w = window as any;
      w.__plazaBiteAfter = 600_000;
      w.__plazaBiteHold = true;
    });
    const spot = PLAZA_SPOTS.find((s) => s.id === "fish")!;
    await page.evaluate(
      ([x, y]) => (window as any).__plazaPosition(x, y),
      [spot.x, spot.y],
    );
    const fish = page.locator("#pz-interact");
    await expect(fish).toBeVisible({ timeout: 15_000 });
    await fish.evaluate((el) =>
      Promise.all(el.getAnimations().map((a) => a.finished)),
    );
    const fb = (await fish.boundingBox())!,
      dash = (await page.locator("#pz-dash").boundingBox())!;
    expect(Math.abs(fb.width - dash.width), "Fish as big as Dash").toBeLessThan(
      1,
    );
    await snap(page, info, `fishing-${size.name}-dock`);
    await fish.click();
    const act = page.locator("#pz-fish-act");
    await expect(act).toBeVisible();
    const ab = (await act.boundingBox())!;
    expect(ab.width, "Cast").toBeGreaterThanOrEqual(100);
    expect(ab.x + ab.width).toBeLessThanOrEqual(size.width);
    expect(ab.y + ab.height).toBeLessThanOrEqual(size.height);
    // Book and today sit above Cast, clear of it.
    const side = (await page.locator(".pz-fish-side").boundingBox())!;
    expect(side.y + side.height).toBeLessThanOrEqual(ab.y);
    await act.click();
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).__plaza.fishingMode.phase),
      )
      .toBe("wait");
    // Reel, as big as Cast.
    await expect(act).toHaveAttribute("data-kind", "reel");
    expect((await act.boundingBox())!.width).toBeGreaterThanOrEqual(100);
    await page.evaluate(() => (window as any).__plazaBiteNow());
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).__plaza.fishingMode.phase),
      )
      .toBe("bite");
    await snap(page, info, `fishing-${size.name}-bite`);
    expect(errors).toEqual([]);
    await context.close();
  });
