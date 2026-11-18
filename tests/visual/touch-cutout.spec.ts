import { expect, test } from "@playwright/test";
import {
  openHub,
  openPlayPanel,
  pushUntilBattle,
  startPractice,
} from "./helpers";

// In a battle on a phone held sideways, the touch controls sit closer to
// the edges than the safe area (style.css, "Big phones"), but never over the
// camera cutout. The cutout sits mid-height on the side, on either side
// (the phone can be turned either way), and reaches about 11 px less than
// the side inset from the edge: a Dynamic Island 126 px long with a 59 px
// inset, a notch about 210 px long with a 47 px inset.
const PHONES = [
  { name: "852x393 island", width: 852, height: 393, inset: 59, length: 126 },
  { name: "932x430 island", width: 932, height: 430, inset: 59, length: 126 },
  { name: "844x390 notch", width: 844, height: 390, inset: 47, length: 210 },
];

for (const phone of PHONES)
  test(`battle controls stay clear of the camera cutout at ${phone.name}`, async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: phone.width, height: phone.height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.addInitScript((inset) => {
      const set = () => {
        for (const [k, v] of Object.entries({
          left: inset,
          right: inset,
          bottom: 21,
          top: 0,
        }))
          document.documentElement.style.setProperty(`--safe-${k}`, `${v}px`);
      };
      if (document.documentElement) set();
      document.addEventListener("DOMContentLoaded", set);
    }, phone.inset);
    try {
      const errors = await openHub(page);
      await page.evaluate(() => (window as any).__room("practice"));
      await openPlayPanel(page);
      await startPractice(page);
      await pushUntilBattle(page);
      await expect(
        page.locator('.touch-buttons [data-action="dash"]'),
      ).toBeVisible();
      const controls = await page.evaluate(() =>
        [...document.querySelectorAll(".touch-buttons button, .joystick")].map(
          (e) => {
            const r = e.getBoundingClientRect();
            const el = e as HTMLElement;
            return {
              name: el.dataset.action ?? el.dataset.skill ?? el.className,
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
            };
          },
        ),
      );
      // Seven buttons, the target button and the joystick.
      expect(controls.length).toBe(9);
      const depth = phone.inset - 11;
      const top = (phone.height - phone.length) / 2;
      const bottom = top + phone.length;
      const over = controls
        .filter(
          (c) =>
            c.bottom > top &&
            c.top < bottom &&
            (c.left < depth || c.right > phone.width - depth),
        )
        .map(
          (c) =>
            `${c.name} ${Math.round(c.left)},${Math.round(c.top)} → ${Math.round(c.right)},${Math.round(c.bottom)}`,
        );
      expect(
        over,
        `cutout: x < ${depth} or > ${phone.width - depth}, y ${top}–${bottom}`,
      ).toEqual([]);
      // And still inside the screen.
      for (const c of controls) {
        expect(c.left).toBeGreaterThanOrEqual(0);
        expect(c.right).toBeLessThanOrEqual(phone.width);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
