import { expect, test } from "@playwright/test";

test("both fountain cascades animate and honour reduced motion", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 640, height: 640 });
  await page.route("**/fountain-review", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<body style="margin:0"></body>',
    }),
  );
  await page.goto("/fountain-review");
  await page.evaluate(async () => {
    const { fountainReview } = await import("/fountain.ts");
    const review = ((window as any).fountain = fountainReview());
    await review.loaded;
  });
  const frame = async (time: number, reduced = false) => {
    await page.evaluate(
      ({ time, reduced }) => (window as any).fountain.draw(time, reduced),
      { time, reduced },
    );
    await page.waitForTimeout(100);
    return {
      upper: await page.screenshot({
        clip: { x: 220, y: 230, width: 200, height: 70 },
      }),
      lower: await page.screenshot({
        clip: { x: 155, y: 350, width: 330, height: 100 },
      }),
    };
  };
  const first = await frame(1),
    next = await frame(1.17);
  expect(first.upper.equals(next.upper)).toBe(false);
  expect(first.lower.equals(next.lower)).toBe(false);
  await info.attach("falling-water", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  const still = await frame(1, true),
    later = await frame(9, true);
  expect(still.upper.equals(later.upper)).toBe(true);
  expect(still.lower.equals(later.lower)).toBe(true);
  expect(errors).toEqual([]);
});
