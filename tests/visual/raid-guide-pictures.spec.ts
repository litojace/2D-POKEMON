import { expect, test } from "@playwright/test";

// The briefing's boss pictures (boss-*-guide): Lumiwick's and Tidelotl's crops
// are tables measured once (no pixel is read back in the game). Here the
// painted pictures are measured again, so a change to the art that moves
// their edges fails until the tables are updated.
test("the measured guide crops still fit the painted pictures", async ({
  page,
}) => {
  await page.route("**/guide-pictures-page", (r) =>
    r.fulfill({ contentType: "text/html", body: "<body></body>" }),
  );
  await page.goto("/guide-pictures-page");
  const found = await page.evaluate(async (root) => {
    const lumi = await import(
      /* @vite-ignore */ `/@fs${root}/apps/client/src/boss-lumiwick-guide.ts`
    );
    const lotl = await import(
      /* @vite-ignore */ `/@fs${root}/apps/client/src/boss-tidelotl.ts`
    );
    const load = async (url: string) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    };
    // the crop the old code measured: alpha over `cut`, plus `pad` px
    const bounds = async (url: string, cut: number, pad: number) => {
      const img = await load(url),
        c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width,
        y0 = c.height,
        x1 = 0,
        y1 = 0;
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++)
          if (d[(y * c.width + x) * 4 + 3] > cut) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
      return pad
        ? [
            Math.max(0, x0 - pad),
            Math.max(0, y0 - pad),
            Math.min(c.width, x1 + pad) - Math.max(0, x0 - pad),
            Math.min(c.height, y1 + pad) - Math.max(0, y0 - pad),
          ]
        : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
    };
    const out: Record<string, { table: number[]; painted: number[] }> = {};
    for (const exposed of [false, true]) {
      const look = exposed ? "exposed" : "calm";
      const a = lumi.lumiwickGuideImage(exposed);
      out["lumiwick " + look] = {
        table: [...a.crop],
        painted: await bounds(a.url, 40, 4),
      };
      const b = lotl.tidelotlGuideImage(exposed);
      out["tidelotl " + look] = {
        table: [...b.crop],
        painted: await bounds(b.url, 12, 0),
      };
    }
    return out;
  }, process.cwd());
  for (const [name, { table, painted }] of Object.entries(found))
    for (let i = 0; i < 4; i++)
      expect(
        Math.abs(table[i] - painted[i]),
        `${name}: crop ${JSON.stringify(table)} vs painted ${JSON.stringify(painted)}`,
      ).toBeLessThanOrEqual(3);
});
