import { expect, test } from "@playwright/test";

test("painted animals contain distinct real strides, pecks and wingbeats", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/animal-review", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<body style="margin:0"></body>',
    }),
  );
  await page.setViewportSize({ width: 800, height: 480 });
  await page.goto("/animal-review");
  const groups = await page.evaluate(async () => {
    const { reviewAnimals } = await import("/animal-motion.ts");
    const review = ((window as any).animalReview = await reviewAnimals());
    return review.audit();
  });
  for (const [name, hashes] of Object.entries(groups) as [string, number[]][])
    expect(new Set(hashes).size, `${name}: duplicated still image`).toBe(
      hashes.length,
    );
  await page.evaluate(() => (window as any).animalReview.draw(7.5));
  await info.attach("moving-animal-poses", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  expect(errors).toEqual([]);
});
