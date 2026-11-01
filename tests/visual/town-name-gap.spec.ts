import { expect, test } from "@playwright/test";
import { openTown, snap } from "./helpers";

test("town names sit close to every champion without touching its silhouette", async ({
  page,
}, info) => {
  await page.route(/\/apps\/client\/src\/town\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text())
        .replace(
          "this.scenery = new TownScenery(this, options.reduced, low);",
          "this.scenery = new TownScenery(this, options.reduced, low);window.__labelScene=this;",
        )
        .replace("return body;", "window.__labelBody=body;return body;"),
    });
  });
  const errors = await openTown(page);
  await page.waitForFunction(() => !!(window as any).__labelBody?.worn);
  const results = [];
  for (const champion of [
    "voltkit",
    "cindrake",
    "tidefin",
    "auralynx",
    "lumoth",
    "mystowl",
    "terradon",
    "duskveil",
  ]) {
    await page.evaluate(
      (c) =>
        (window as any).__sock.emit(
          "town-look",
          { character: c, skin: null },
          () => {},
        ),
      champion,
    );
    await page.waitForFunction(
      (c) => (window as any).__labelBody?.rig?.character === c,
      champion,
    );
    const data = await page.evaluate(() => {
      const w = window as any,
        b = w.__labelBody,
        s = w.__labelScene;
      w.__sock.fire("town-profiles", [
        { ...b.worn, title: "Legendary Grandmaster", titleColor: "#ffd65b" },
      ]);
      s.game.loop.sleep();
      const extents = new Map<any, { x: number; y: number }[]>();
      // Raster edge points avoid counting the empty corners of rotated crops.
      for (const image of b.rig.images.values()) {
        const src = image.texture.getSourceImage();
        const c = document.createElement("canvas");
        c.width = src.width;
        c.height = src.height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(src, 0, 0);
        const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
        const points = [];
        for (let y = 0; y < c.height; y++) {
          let left = c.width,
            right = -1;
          for (let x = 0; x < c.width; x++)
            if (pixels[(y * c.width + x) * 4 + 3] > 160) {
              left = Math.min(left, x);
              right = Math.max(right, x);
            }
          if (right >= 0) points.push({ x: left, y }, { x: right, y });
        }
        extents.set(image, points);
      }
      const gaps = [];
      for (let i = 0; i < 32; i++) {
        s.place(b, s.time.now + 3000 + i * 130);
        let top = Infinity;
        for (const [image, bounds] of extents) {
          if (!image.visible) continue;
          const matrix = image.getWorldTransformMatrix();
          for (const point of bounds) {
            const py =
              matrix.b * (point.x - image.displayOriginX) +
              matrix.d * (point.y - image.displayOriginY) +
              matrix.ty;
            top = Math.min(top, py);
          }
        }
        gaps.push(top - b.name.y);
      }
      s.game.loop.wake();
      return { min: Math.min(...gaps), max: Math.max(...gaps) };
    });
    results.push({ champion, ...data });
    await snap(page, info, `town-name-gap-${champion}`);
  }
  await info.attach("silhouette-gaps", {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });
  for (const result of results)
    expect(
      result.min,
      `${result.champion} name must clear head/ears`,
    ).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
