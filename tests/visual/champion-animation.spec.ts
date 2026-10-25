import { expect, test } from "@playwright/test";

for (const canvas of [false, true])
  test(`all eight illustrated champions stay joined in ${canvas ? "Canvas fallback" : "WebGL"}`, async ({
    page,
  }, info) => {
    test.setTimeout(150_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 2080 });
    await page.route("**/champion-review", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<body style="margin:0;background:#10182b"></body>',
      }),
    );
    await page.goto("/champion-review");
    await page.evaluate(async (canvas) => {
      const { reviewChampions } = await import("/champion-rigs.ts");
      const review = ((window as any).review = reviewChampions(canvas));
      await review.loaded;
      review.pose("idle", true);
    }, canvas);
    const audit = () => page.evaluate(() => (window as any).review.audit());
    const rest = await audit();
    expect(rest).toHaveLength(24);
    let moved = false;
    for (const state of [
      "walk",
      "run",
      "basic",
      "skill0",
      "skill1",
      "skill2",
      "skill3",
      "dash",
      "jump",
      "hurt",
      "defeat",
      "victory",
      "wave",
      "blink",
    ]) {
      await page.evaluate((state) => (window as any).review.pose(state), state);
      const rows = await audit();
      for (const [i, r] of rows.entries()) {
        expect(r.finite, `${r.id} ${state}`).toBe(true);
        expect(r.gap, `${r.id} ${state}`).toBe(0);
        expect(r.visible, `${r.id} ${state}`).toBe(true);
        expect(r.exposedParts).toEqual(r.id === "auralynx" ? ["wings"] : []);
        moved ||= JSON.stringify(r.points) !== JSON.stringify(rest[i].points);
      }
    }
    if (!canvas)
      expect(
        moved,
        "the connected surface still follows the animated bones",
      ).toBe(true);
    for (const kind of ["rare", "mythical", "original"]) {
      await page.evaluate(async (kind) => {
        await (window as any).review.appearance(kind);
        (window as any).review.pose("idle", true);
      }, kind);
      for (const r of await audit()) {
        expect(r.visible).toBe(true);
        expect(r.finite).toBe(true);
        expect(r.gap).toBe(0);
        expect(r.key.includes("~")).toBe(kind !== "original");
      }
    }
    await page.waitForTimeout(200);
    await info.attach("all-eight-left-right-back", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    expect(errors).toEqual([]);
  });
