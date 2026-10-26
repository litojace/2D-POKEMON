import { expect, test } from "@playwright/test";
import { openTown } from "./helpers";

test("town keeps native architecture pixels, filtered zoom and a shared fountain source", async ({
  page,
}, info) => {
  await page.route(/\/apps\/client\/src\/town\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    const marker = "this.scenery = new TownScenery(this, options.reduced);";
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(marker, marker + "window.__artReviewScene=this;"),
    });
  });
  const errors = await openTown(page);
  await page.waitForFunction(() => !!(window as any).__artReviewScene);
  const audit = await page.evaluate(() => {
    const s = (window as any).__artReviewScene,
      manager = s.textures,
      gl = s.game.renderer.gl;
    const buildings = s.children.list.filter(
      (o: any) =>
        o.texture?.key.startsWith("town-hd-") &&
        o.texture.key !== "town-hd-obelisk",
    );
    const red = manager.get("town-hd-red").source[0];
    const fountain = s.children.list.filter(
      (o: any) => o.texture?.key === "town-fountain-painted",
    );
    let bytes = 0;
    const seen = new Set();
    for (const t of Object.values(manager.list) as any[])
      for (const src of t.source) {
        if (seen.has(src.image)) continue;
        seen.add(src.image);
        const mip =
          src.glTexture?.minFilter >= 9984 && src.glTexture?.minFilter <= 9987;
        bytes += src.width * src.height * 4 * (mip ? 4 / 3 : 1);
      }
    return {
      count: buildings.length,
      canvasCopies: Object.keys(manager.list).filter((k) =>
        /^town-painted-/.test(k),
      ),
      red: {
        w: red.width,
        h: red.height,
        pot: red.isPowerOf2,
        filter: red.glTexture?.minFilter,
      },
      expectedFilter: gl.LINEAR_MIPMAP_LINEAR,
      fountainCount: fountain.length,
      fountainMask: fountain.some((o: any) => !!o.mask),
      fountainSource: manager.get("town-fountain-painted").source[0].width,
      gpuMiB: bytes / 1024 / 1024,
    };
  });
  expect(audit.count).toBe(14);
  expect(audit.canvasCopies).toEqual([]);
  expect(audit.red).toMatchObject({
    w: 1024,
    h: 1024,
    pot: true,
    filter: audit.expectedFilter,
  });
  expect(audit.fountainCount).toBe(2);
  expect(audit.fountainMask).toBe(true);
  expect(audit.fountainSource).toBe(1402);
  expect(audit.gpuMiB).toBeLessThan(140);
  await page.evaluate(() => (window as any).__townPosition(2240, 1260));
  await page.waitForTimeout(500);
  await info.attach("native-town-architecture", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await info.attach("texture-budget", {
    body: JSON.stringify(audit),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
});
