import { expect, test, type Page } from "@playwright/test";
import { openLobby, settle } from "./helpers";
import { shopServer } from "./shop-server";

// The Shop's and Wardrobe's pictures, measured (fixes for "the preview is
// blurry and squashed; items, frames above all, lose their corners"):
// - every picture sits wholly inside its tile's art box, at its own shape;
// - a frame's ornaments stay inside its box;
// - a skin's thumbnail (shop-ui.ts, 212×216) holds the whole fighter, crest,
//   horns and tail too: nothing of it touches the edge of its picture;
// - the live preview draws at the screen's pixel density, not one pixel per
//   CSS pixel stretched to fit.
const SIZES = [
  { name: "1440x900", width: 1440, height: 900, phone: false },
  { name: "844x390", width: 844, height: 390, phone: true },
];

/** Pictures that spill out of their box, or are stretched out of shape. */
const pictureProblems = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const arts = document.querySelectorAll(
      ".fit-room :is(.ui-tile-art, .fit-deal-art, .fit-slot-art, .fit-bundle-art > span, .fit-foot-art)",
    );
    for (const art of Array.from(arts)) {
      const a = art.getBoundingClientRect();
      if (!a.width || !a.height) continue;
      const tile = art.closest("[data-ui-item], .fit-deal, .fit-slot, button");
      const name = (
        tile?.getAttribute("aria-label") ||
        tile?.textContent ||
        art.className
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 40);
      for (const pic of Array.from(
        art.querySelectorAll(":scope > img, :scope > .raid-cosmetic-preview"),
      )) {
        const r = pic.getBoundingClientRect();
        if (
          r.left < a.left - 1 ||
          r.right > a.right + 1 ||
          r.top < a.top - 1 ||
          r.bottom > a.bottom + 1
        )
          out.push(
            `${name}: picture ${Math.round(r.width)}×${Math.round(r.height)} spills out of its ${Math.round(a.width)}×${Math.round(a.height)} box`,
          );
        if (pic instanceof HTMLImageElement && pic.naturalWidth) {
          const fit = getComputedStyle(pic).objectFit;
          const box = r.width / r.height,
            own = pic.naturalWidth / pic.naturalHeight;
          if (fit !== "contain" && Math.abs(box / own - 1) > 0.03)
            out.push(
              `${name}: picture stretched (${box.toFixed(2)} for ${own.toFixed(2)}, object-fit ${fit})`,
            );
        }
      }
    }
    return out;
  });

/** Skin thumbnails whose ink reaches the edge of the picture (cut off). */
const cutThumbnails = (page: Page) =>
  page.evaluate(async () => {
    const out: string[] = [];
    const imgs = Array.from(
      document.querySelectorAll<HTMLImageElement>(
        ".fit-room img[src^='data:image/svg'][width='212']",
      ),
    );
    for (const img of imgs) {
      const pic = new Image();
      pic.src = img.src;
      await pic.decode();
      const w = 212,
        h = 216;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(pic, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const alpha = (x: number, y: number) => data[(y * w + x) * 4 + 3];
      let edge = 0;
      for (let x = 0; x < w; x++)
        edge += +(alpha(x, 0) > 8) + +(alpha(x, h - 1) > 8);
      for (let y = 0; y < h; y++)
        edge += +(alpha(0, y) > 8) + +(alpha(w - 1, y) > 8);
      if (edge)
        out.push(
          `${img.closest("[data-ui-item], .fit-deal")?.getAttribute("data-ui-item") ?? img.alt}: ${edge} edge pixels inked`,
        );
    }
    return { checked: imgs.length, cut: out };
  });

/**
 * Frames whose ring or ornaments (a tassel, a planet, sparks) reach past
 * their art box, where the tile would cut them off: let the box overflow for
 * a moment, and look for frame pixels on the tile outside it (a shot with the
 * frame against one without; a pixel counts only if two shots agree, so a
 * spark that happens to flicker doesn't).
 */
async function cutFrames(page: Page) {
  const pics = page.locator(
    ".fit-room :is(.ui-tile-art, .fit-deal-art) > .raid-cosmetic-preview[data-frame-stars]",
  );
  const out: string[] = [];
  const count = await pics.count();
  for (let i = 0; i < count; i++) {
    const pic = pics.nth(i);
    await pic.scrollIntoViewIfNeeded();
    const id = await pic.getAttribute("data-cosmetic");
    const art = await pic.evaluate((p) => {
      const a = p.parentElement!,
        tile = a.closest(".ui-tile, .fit-deal")!;
      for (
        let e: HTMLElement | null = a;
        e && e !== tile.parentElement;
        e = e.parentElement
      ) {
        e.style.setProperty("overflow", "visible", "important");
        e.style.setProperty("contain", "none", "important");
      }
      const r = a.getBoundingClientRect(),
        t = tile.getBoundingClientRect();
      return {
        inner: {
          x: r.left - t.left,
          y: r.top - t.top,
          w: r.width,
          h: r.height,
        },
        clip: { x: t.left, y: t.top, width: t.width, height: t.height },
      };
    });
    const shot = () =>
      page
        .screenshot({ clip: art.clip, animations: "disabled" })
        .then((b) => b.toString("base64"));
    const a1 = await shot(),
      a2 = await shot();
    await pic.evaluate((p) => ((p as HTMLElement).style.visibility = "hidden"));
    const b = await shot();
    await pic.evaluate((p) => {
      (p as HTMLElement).style.visibility = "";
      const tile = p.closest(".ui-tile, .fit-deal")!;
      for (
        let e: HTMLElement | null = p.parentElement;
        e && e !== tile.parentElement;
        e = e.parentElement
      ) {
        e.style.removeProperty("overflow");
        e.style.removeProperty("contain");
      }
    });
    const spill = await page.evaluate(
      async ({ shots, inner, width }) => {
        const [A1, A2, B] = await Promise.all(
          shots.map(async (s) => {
            const img = new Image();
            img.src = `data:image/png;base64,${s}`;
            await img.decode();
            const c = document.createElement("canvas");
            c.width = img.width;
            c.height = img.height;
            const ctx = c.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            return ctx.getImageData(0, 0, c.width, c.height);
          }),
        );
        const k = B.width / width,
          differs = (X: ImageData, j: number) =>
            Math.abs(X.data[j] - B.data[j]) +
              Math.abs(X.data[j + 1] - B.data[j + 1]) +
              Math.abs(X.data[j + 2] - B.data[j + 2]) >
            30;
        let n = 0;
        for (let y = 0; y < B.height; y++)
          for (let x = 0; x < B.width; x++) {
            const cx = x / k,
              cy = y / k;
            if (
              cx >= inner.x - 1 &&
              cx <= inner.x + inner.w + 1 &&
              cy >= inner.y - 1 &&
              cy <= inner.y + inner.h + 1
            )
              continue;
            const j = (y * B.width + x) * 4;
            if (differs(A1, j) && differs(A2, j)) n++;
          }
        return n / (k * k);
      },
      { shots: [a1, a2, b], inner: art.inner, width: art.clip.width },
    );
    if (spill > 15)
      out.push(`${id}: ${Math.round(spill)} px² of the frame past its box`);
  }
  return { checked: count, cut: out };
}

for (const size of SIZES)
  test(`Shop and Wardrobe pictures fit their tiles, whole (${size.name})`, async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 2,
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await shopServer(page, {
        owned: [
          "voltkit-midnight",
          "voltkit-stormcrown",
          "galaxy-aura",
          "candy-colours",
          // Every frame, for the Wardrobe's frame grid.
          ...["candy", "galaxy", "retro", "festival", "garden", "winter"].map(
            (set) => `${set}-frame`,
          ),
        ],
      });
      const errors = await openLobby(page);
      await page.click('.lobby-rail [data-lobby-action="shop"]');
      await expect(page.locator(".fit-room")).toBeVisible();

      // The live preview draws at the screen's density (DPR 2 here).
      const stage = page.locator(".fit-stage .shop-live-stage");
      await expect(stage).toHaveClass(/is-ready/, { timeout: 60_000 });
      await settle(page);
      const canvas = await stage.locator("canvas").evaluate((c) => ({
        drawn: (c as HTMLCanvasElement).width,
        shown: c.getBoundingClientRect().width,
      }));
      expect
        .soft(canvas.drawn / canvas.shown, JSON.stringify(canvas))
        .toBeGreaterThan(1.5);

      let thumbs = 0;
      for (const section of ["today", "skins", "mythic", "collections"]) {
        await page.click(`[data-ui-section="${section}"]`);
        await expect(
          page.locator(`[data-fit-region=body][data-section="${section}"]`),
        ).toBeVisible();
        await settle(page);
        expect.soft(await pictureProblems(page), section).toEqual([]);
        const { checked, cut } = await cutThumbnails(page);
        thumbs += checked;
        expect.soft(cut, section).toEqual([]);
      }
      expect(thumbs).toBeGreaterThan(5);

      await page.click('[data-ui-mode="wardrobe"]');
      for (const slot of ["champion", "aura", "frame"]) {
        await page.click(`.fit-slot[data-fit-slot="${slot}"]`);
        await settle(page);
        expect
          .soft(await pictureProblems(page), `Wardrobe ${slot}`)
          .toEqual([]);
      }
      const frames = await cutFrames(page);
      expect(frames.checked).toBe(6);
      expect.soft(frames.cut).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
