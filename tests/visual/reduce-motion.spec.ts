import { expect, test } from "@playwright/test";
import { box, inside, openHub, snap } from "./helpers";
import { onPlayersLook } from "./players-look";
import { ISLAND, setInsets } from "./ui-measure";

// Settings → Reduce motion (apps/client/src/reduced-motion.ts): the game's
// own switch, off by default. The device's accessibility setting no longer
// decides anything (owner, 27 Nov 2026: full motion whatever the phone
// says; before, an iPhone with Reduce Motion on got a much stiller game
// without being told). In the look players have.
onPlayersLook();

/** What the page says about motion: the root's mark, the stored choice. */
const motion = (page: import("@playwright/test").Page) =>
  page.evaluate(() => ({
    root: document.documentElement.dataset.motion ?? "",
    kept: localStorage.getItem("ea-reduce-motion"),
    // The dialog's pop (style.css, ea-pop) is one of the motions the switch
    // takes away.
    dialog: getComputedStyle(document.getElementById("dialog")!).animationName,
  }));

for (const s of [
  { name: "desktop", viewport: { width: 1440, height: 900 }, touch: false },
  { name: "phone", viewport: { width: 844, height: 390 }, touch: true },
  { name: "phone-small", viewport: { width: 667, height: 375 }, touch: true },
  {
    name: "phone-island",
    viewport: { width: 852, height: 393 },
    touch: true,
    island: true,
  },
])
  test(`Reduce motion is the game's own switch, off whatever the device says (${s.name})`, async ({
    browser,
  }, info) => {
    // A device that asks for reduced motion, as an iPhone with the setting
    // on does.
    const context = await browser.newContext({
      viewport: s.viewport,
      hasTouch: s.touch,
      isMobile: s.touch,
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      // As for players: the harness doesn't pass the device's setting on
      // (harness/motion-asked.ts).
      await page.addInitScript(() => {
        (window as { __deviceMotion?: boolean }).__deviceMotion = false;
      });
      const errors = await openHub(page);
      if ("island" in s) await setInsets(page, ISLAND);
      expect(
        await page.evaluate(
          () => matchMedia("(prefers-reduced-motion: reduce)").matches,
        ),
      ).toBe(true);

      await page.evaluate(() => document.getElementById("home-settings")!.click());
      const dialog = page.locator("#dialog");
      const toggle = dialog.locator("#settings-motion");
      await expect(toggle).toBeVisible();
      // Off, and the game moves: the device was not asked.
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      await expect(toggle).toHaveText("Off");
      expect(await motion(page)).toEqual({
        root: "",
        kept: null,
        dialog: "ea-pop",
      });
      // The row fits, its switch a real touch target on a phone.
      const screen = { x: 0, y: 0, ...s.viewport };
      const at = await box(page, "#settings-motion");
      expect(inside(at, screen)).toBe(true);
      expect(inside(at, await box(page, "#dialog"))).toBe(true);
      await expect(dialog).toContainText("Reduce motion");
      await expect(dialog).not.toContainText("device");
      await snap(page, info, `reduce-motion-off-${s.name}`);

      // On: CSS and code follow at once, and the choice is kept.
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await expect(toggle).toHaveText("On");
      expect(await motion(page)).toEqual({
        root: "reduced",
        kept: "on",
        dialog: "none",
      });
      await snap(page, info, `reduce-motion-on-${s.name}`);

      // Kept for the next visit.
      await page.reload();
      await expect
        .poll(() =>
          page.evaluate(() => document.documentElement.dataset.motion),
        )
        .toBe("reduced");

      // And off again.
      await page.waitForFunction(() => !!(window as any).__sock);
      await expect
        .poll(
          async () => {
            await page.evaluate(() => (window as any).__sock.fire("connect"));
            return page.locator("#lobby-play").isVisible();
          },
          { timeout: 30_000, intervals: [500, 1000] },
        )
        .toBe(true);
      await expect(page.locator("#server-startup")).toHaveCount(0, {
        timeout: 60_000,
      });
      await page.evaluate(() => document.getElementById("home-settings")!.click());
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      expect((await motion(page)).root).toBe("");
      expect((await motion(page)).kept).toBeNull();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("in the suite, a spec that asks the browser for reduced motion gets the switch", async ({
  browser,
}) => {
  // The other specs keep asking the way they always have (harness/
  // motion-asked.ts): for the visit only, nothing stored.
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await openHub(page);
    expect(
      await page.evaluate(() => [
        document.documentElement.dataset.motion,
        localStorage.getItem("ea-reduce-motion"),
      ]),
    ).toEqual(["reduced", null]);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.dataset.motion ?? ""),
      )
      .toBe("");
  } finally {
    await context.close();
  }
});

// The owner's rule where players see it first, past the suite's bridge
// (harness/motion-asked.ts): a device that asks for less motion, the switch
// off, and the runner on the startup bar still moves; only the switch
// stills it.
for (const switchOn of [false, true])
  test(`the startup runner moves whatever the device says, and stops only for the switch (${switchOn ? "on" : "off"})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      await page.addInitScript((on) => {
        (window as { __deviceMotion?: boolean }).__deviceMotion = false;
        if (on) localStorage.setItem("ea-reduce-motion", "on");
      }, switchOn);
      // The server never wakes, so the curtain stays up with its runner.
      await page.route(/\/fake-api\.ts(?:\?|$)/, async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          body: `${await response.text()}
const motionFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const path = new URL(String(input), location.href).pathname;
  if (path === '/api/health') return new Promise(() => {});
  return motionFetch(input, init);
};`,
        });
      });
      await page.goto("/");
      const runner = page.locator("#server-startup .server-startup-runner");
      await expect(runner.locator("svg .fighter-character")).toHaveCount(1);
      expect(
        await page.evaluate(
          () => matchMedia("(prefers-reduced-motion: reduce)").matches,
        ),
      ).toBe(true);
      const moving = () =>
        runner.evaluate((box) =>
          [
            ".fighter-character",
            ".fighter-tail",
            ".fighter-armL",
            ".fighter-legL",
          ].map(
            (part) =>
              getComputedStyle(box.querySelector(part) ?? box).animationName,
          ),
        );
      if (!switchOn) {
        // Running with the bar (or breathing between its steps), its tail
        // swaying, arms and legs swinging: hold it running to read them.
        await page.evaluate(() =>
          document
            .querySelector("#server-startup .server-startup-runner")!
            .classList.add("is-running"),
        );
        expect(await moving()).toEqual([
          "server-runner-bounce",
          "server-runner-tail",
          "server-runner-arm",
          "server-runner-leg",
        ]);
      } else {
        expect(await moving()).toEqual(["none", "none", "none", "none"]);
      }
    } finally {
      await context.close();
    }
  });
