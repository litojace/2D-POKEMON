import { expect, test } from "@playwright/test";
import { TOWN_STATUES } from "../../packages/shared/src/town";
import { openTown } from "./helpers";

test("all seven carved bosses use native art and rest centrally on their pedestal caps", async ({
  page,
}, info) => {
  await page.route(/\/apps\/client\/src\/town\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text(),
      marker = "this.scenery = new TownScenery(this, options.reduced);";
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(marker, marker + "window.__statueScene=this;"),
    });
  });
  const errors = await openTown(page);
  await page.waitForFunction(() => !!(window as any).__statueScene);
  const sculptures = await page.evaluate(() => {
    const scene = (window as any).__statueScene;
    return scene.children.list
      .filter((image: any) => image.texture?.key.startsWith("town-statue-"))
      .map((image: any) => {
        const source = image.texture.source[0],
          frame = image.frame,
          canvas = document.createElement("canvas");
        canvas.width = frame.cutWidth;
        canvas.height = frame.cutHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(
          source.image,
          frame.cutX,
          frame.cutY,
          frame.cutWidth,
          frame.cutHeight,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let bottom = 0;
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++)
            if (data[(y * canvas.width + x) * 4 + 3] >= 128) bottom = y + 1;
        const band = Math.max(4, Math.round(canvas.height * 0.015));
        let left = canvas.width,
          right = 0;
        for (let y = bottom - band; y < bottom; y++)
          for (let x = 0; x < canvas.width; x++)
            if (data[(y * canvas.width + x) * 4 + 3] >= 128) {
              left = Math.min(left, x);
              right = Math.max(right, x + 1);
            }
        return {
          boss: image.texture.key.slice("town-statue-".length),
          native: source.image instanceof HTMLImageElement,
          sourceWidth: source.width,
          sourceHeight: source.height,
          filter: source.glTexture?.minFilter,
          footX:
            image.x +
            ((left + right) / 2 - image.displayOriginX) * image.scaleX,
          footY: image.y + (bottom - image.displayOriginY) * image.scaleY,
          supportWidth: (right - left) * image.scaleX,
          height: image.displayHeight,
          width: image.displayWidth,
        };
      });
  });
  expect(sculptures).toHaveLength(TOWN_STATUES.length);
  for (const statue of TOWN_STATUES) {
    const image = sculptures.find((s: any) => s.boss === statue.boss)!;
    expect(image, statue.boss).toBeTruthy();
    expect(image.native).toBe(true);
    expect(image.sourceWidth).toBe(512);
    expect(image.sourceHeight).toBe(512);
    expect(image.filter).toBe(9987); // GL.LINEAR_MIPMAP_LINEAR
    expect(Math.abs(image.footX - statue.x), statue.boss).toBeLessThan(0.25);
    expect(
      Math.abs(image.footY - (statue.y + 12 - 58)),
      statue.boss,
    ).toBeLessThan(0.25);
    expect(image.supportWidth).toBeLessThanOrEqual(68.5);
    expect(image.height).toBeLessThanOrEqual(92.01);
    expect(image.width).toBeLessThanOrEqual(96.01);
  }
  const clearOfSign = await page.evaluate(() => {
    const scene = (window as any).__statueScene;
    const sign = scene.scenery.signs.find((s: any) =>
      s.box.list.some((o: any) => o.text === "RAID HALL"),
    );
    return scene.children.list
      .filter((image: any) => image.texture?.key.startsWith("town-statue-"))
      .every((image: any) => {
        const left = image.x - image.displayOriginX * image.scaleX,
          top = image.y - image.displayOriginY * image.scaleY;
        return (
          left + image.displayWidth <= sign.left - 8 ||
          left >= sign.right + 8 ||
          top + image.displayHeight <= sign.top - 8 ||
          top >= sign.bottom + 8
        );
      });
  });
  expect(clearOfSign).toBe(true);
  await page.evaluate(() => (window as any).__townPosition(1600, 630));
  await page.waitForTimeout(500);
  await info.attach("carved-bosses-in-town", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  expect(errors).toEqual([]);
});
