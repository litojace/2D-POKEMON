import { expect, test } from "@playwright/test";
import { box, inside, snap } from "./helpers";

for (const size of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 568, height: 320 },
]) {
  test(`static welcome fits ${size.width}×${size.height}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    const requests: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => requests.push(r.url()));
    await page.setViewportSize(size);
    // Real signed-out app and auth forms, without a real account.
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
    // The startup curtain lifts to the front door and fades out
    // (docs/loading-screens.md): measure the page once it has gone.
    await expect(page.locator("#server-startup")).toHaveCount(0);
    const backdrop = page.locator(".gate-backdrop");
    await backdrop.evaluate(async (element) => {
      const url = getComputedStyle(element).backgroundImage.match(
        /url\(["']?([^"')]+)["']?\)/,
      )![1];
      const image = new Image();
      image.src = url;
      await image.decode();
      await document.fonts.ready;
      // The menu has a short, one-off entrance fade. Measure the painting
      // after that UI transition, rather than during changing page opacity.
      await Promise.all(
        document
          .getAnimations()
          .filter((animation) => {
            const effect = animation.effect as KeyframeEffect | null;
            return (
              effect?.target instanceof Element &&
              effect.target.contains(element) &&
              effect.getComputedTiming().iterations !== Infinity
            );
          })
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
    await expect(
      page.locator(".welcome-gate canvas, [data-gate-champion], .gate-motes"),
    ).toHaveCount(0);
    expect(
      await backdrop.evaluate((e) => getComputedStyle(e).animationName),
    ).toBe("none");
    const card = await box(page, ".gate-card");
    expect(inside(card, { x: 0, y: 0, ...size })).toBe(true);
    expect(
      (await box(page, ".gate-heading")).x +
        (await box(page, ".gate-heading")).width,
    ).toBeLessThanOrEqual(card.x);
    // The actual background remains still under ordinary motion preferences.
    const clip = {
      x: 0,
      y: Math.round(size.height * 0.55),
      width: Math.round(size.width * 0.4),
      height: Math.round(size.height * 0.4),
    };
    // A decoded CSS background may still be uploading to the compositor on a
    // busy GPU. Wait for a still pair rather than treating that first paint as
    // continuous animation; keep ordinary animation preferences enabled.
    // CI's headless shell took longer than 5 s at 1280x720 (every run on main
    // bdd558d, 21 Nov; never locally), so it gets 20 s (#314).
    //
    // "Still" allows the CPU renderer's own noise, not motion. On CI's
    // SwiftShader two screenshots of the untouched page differed in 21-23 of
    // the 207,360 pixels, by one level in one channel, scattered over the
    // whole clip (PR #308, 21 Nov), on every pair for 5 s. Anything that moves
    // changes far more (measured here): a 30 px square sliding across the clip
    // changed 840 pixels by up to 246 levels; the backdrop fading by 30% over
    // 20 s changed 155,364 by up to 2; drifting 40 px over 30 s, 176,839 by up
    // to 70. So a pair is still when no pixel moved by more than one level and
    // fewer than one in a thousand moved at all.
    const pixelDiff = (pair: Buffer[]) =>
      page.evaluate(
        async (pngs) => {
          const read = async (b64: string) => {
            const img = new Image();
            img.src = `data:image/png;base64,${b64}`;
            await img.decode();
            const c = document.createElement("canvas");
            c.width = img.width;
            c.height = img.height;
            const g = c.getContext("2d")!;
            g.drawImage(img, 0, 0);
            return g.getImageData(0, 0, c.width, c.height);
          };
          const [a, b] = await Promise.all(pngs.map(read));
          let n = 0,
            max = 0,
            x0 = a.width,
            y0 = a.height,
            x1 = -1,
            y1 = -1;
          for (let i = 0; i < a.data.length; i += 4) {
            let d = 0;
            for (let k = 0; k < 4; k++)
              d = Math.max(d, Math.abs(a.data[i + k] - b.data[i + k]));
            if (!d) continue;
            n++;
            max = Math.max(max, d);
            const x = (i / 4) % a.width,
              y = Math.floor(i / 4 / a.width);
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x);
            y1 = Math.max(y1, y);
          }
          return {
            pixels: a.width * a.height,
            changedPixels: n,
            maxDelta: max,
            box: [x0, y0, x1, y1],
          };
        },
        pair.map((b) => b.toString("base64")),
      );
    let pair: Buffer[] = [];
    let diff: Awaited<ReturnType<typeof pixelDiff>> | undefined;
    try {
      await expect
        .poll(
          async () => {
            const first = await page.screenshot({ clip });
            await page.waitForTimeout(350);
            pair = [first, await page.screenshot({ clip })];
            if (pair[1].equals(first)) return true;
            diff = await pixelDiff(pair);
            return (
              diff.maxDelta <= 1 && diff.changedPixels * 1000 < diff.pixels
            );
          },
          { timeout: 20_000 },
        )
        .toBe(true);
    } catch (error) {
      // Keep the last pair and say where they differ and by how much.
      if (!diff) throw error;
      await info.attach("still-pair-first", {
        body: pair[0],
        contentType: "image/png",
      });
      await info.attach("still-pair-second", {
        body: pair[1],
        contentType: "image/png",
      });
      throw new Error(
        `${(error as Error).message}\nlast pair differs: ${JSON.stringify(diff)} (clip ${JSON.stringify(clip)})`,
      );
    }
    for (const mode of ["signup", "login", "forgot"]) {
      if (mode === "forgot") await page.click("#auth-forgot");
      else await page.click(`[data-auth-tab="${mode}"]`);
      await expect(page.locator(".auth-panel")).toHaveAttribute(
        "data-mode",
        mode,
      );
      expect(
        inside(await box(page, ".gate-card"), { x: 0, y: 0, ...size }),
      ).toBe(true);
      const submit = page.locator(".gate-card .auth-submit").first();
      await submit.scrollIntoViewIfNeeded();
      expect(
        inside(
          await box(page, ".gate-card .auth-submit"),
          await box(page, ".gate-card"),
        ),
      ).toBe(true);
    }
    // Recovery deliberately replaces the tabs with a back action.
    await page.getByRole("button", { name: "Back to log in" }).click();
    // Save the sign-up screen, which has the most controls on small phones.
    await page.click('[data-auth-tab="signup"]');
    await page.locator(".gate-card").evaluate((e) => (e.scrollTop = 0));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(size.width);
    await snap(page, info, `welcome-${size.width}`);
    expect(
      requests.some((url) =>
        /welcome-animation|campfire-(poster|clearing)/.test(url),
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
  });
}
