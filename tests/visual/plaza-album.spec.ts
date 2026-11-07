import { expect, test, type Browser, type Page } from "@playwright/test";
import { openPlaza, snap } from "./helpers";

// The Plaza photo album (docs/hub-redesign/PLAN.md): "Save to album" on the
// polaroid keeps the photo in this browser's IndexedDB, the newest 30. Each
// test has its own browser context, so its own empty album.
type Rect = { x: number; y: number; w: number; h: number };
type Inset = { left: number; right: number; top: number; bottom: number };
const SIZES: {
  name: string;
  width: number;
  height: number;
  inset: Inset | null;
}[] = [
  { name: "desktop", width: 1440, height: 900, inset: null },
  { name: "phone", width: 844, height: 390, inset: null },
  {
    name: "island",
    width: 852,
    height: 393,
    inset: { left: 59, right: 59, bottom: 21, top: 0 },
  },
];
const HEADER = [
  "#account-profile",
  "#hub-scenes",
  "#account-coins > *",
  "#account-leaves > *",
  ".header-menu > summary",
];
const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w - 1 &&
  b.x < a.x + a.w - 1 &&
  a.y < b.y + b.h - 1 &&
  b.y < a.y + a.h - 1;

async function open(browser: Browser, size: (typeof SIZES)[number]) {
  const phone = size.width < 1000;
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    isMobile: phone,
    hasTouch: phone,
  });
  const page = await context.newPage();
  const errors = await openPlaza(page);
  if (size.inset)
    await page.evaluate((inset) => {
      for (const [key, value] of Object.entries(inset))
        document.documentElement.style.setProperty(
          `--safe-${key}`,
          `${value}px`,
        );
    }, size.inset);
  return { context, page, errors, phone };
}

/** On-screen boxes (after transforms, so a tilted polaroid's full extent). */
const boxes = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) =>
    els
      .filter((el) => getComputedStyle(el).display !== "none")
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      }),
  );
/** Layout boxes before transforms: for sizes and lining up. */
const layout = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const e = el as HTMLElement;
      return {
        x: e.offsetLeft,
        y: e.offsetTop,
        w: e.offsetWidth,
        h: e.offsetHeight,
        text: e.textContent ?? "",
      };
    }),
  );
/** Text cut short with an ellipsis (or clipped) in these elements. */
const cutText = (page: Page, selector: string) =>
  page
    .locator(selector)
    .evaluateAll((els) =>
      els
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.textContent),
    );
/** Wait for the entrance animations (the polaroid's snap) to end. */
const settle = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) =>
    Promise.all(
      el
        .getAnimations({ subtree: true })
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ).then(() => undefined),
  );
const hideToast = (page: Page) =>
  page.evaluate(() =>
    document.getElementById("toast")?.classList.remove("show"),
  );

async function inSafeAreaBelowHeader(
  page: Page,
  size: (typeof SIZES)[number],
  selector: string,
) {
  const [r] = await boxes(page, selector);
  expect(r, selector).toBeTruthy();
  const inset = size.inset ?? { left: 0, right: 0, top: 0, bottom: 0 };
  expect(r.x, `${selector} left`).toBeGreaterThanOrEqual(inset.left - 0.5);
  expect(r.x + r.w, `${selector} right`).toBeLessThanOrEqual(
    size.width - inset.right + 0.5,
  );
  expect(r.y + r.h, `${selector} bottom`).toBeLessThanOrEqual(
    size.height - inset.bottom + 0.5,
  );
  const header = (await Promise.all(HEADER.map((s) => boxes(page, s)))).flat();
  expect(header.length).toBeGreaterThanOrEqual(4);
  for (const h of header)
    expect(overlap(r, h), `${selector} × header`).toBe(false);
  return r;
}
/** Buttons of one size, in a row (desktop) or a column (phones). Layout
 *  boxes are whole pixels, so three columns of 158.67px may differ by 1. */
async function lineUp(page: Page, selector: string, column: boolean) {
  const b = await layout(page, selector);
  expect(b.length).toBe(3);
  const near = (a: number, z: number, what: string) =>
    expect(Math.abs(a - z), what).toBeLessThanOrEqual(1);
  for (const x of b) {
    near(x.w, b[0].w, `${x.text} width`);
    expect(x.h, `${x.text} height`).toBe(b[0].h);
    if (column) expect(x.x, `${x.text} left`).toBe(b[0].x);
    else expect(x.y, `${x.text} top`).toBe(b[0].y);
  }
  // Even gaps between them.
  const step = (i: number) =>
    column ? b[i].y - b[i - 1].y : b[i].x - b[i - 1].x;
  near(step(2), step(1), "even gaps");
  expect(await cutText(page, selector)).toEqual([]);
  return b.map((x) => x.text);
}
/** Fill the album: copies of the photo saved first, with their own words. */
const fillAlbum = (page: Page, upTo: number) =>
  page.evaluate(async (upTo) => {
    const album = (window as any).__plaza.album;
    const [first] = await album.list();
    for (let n = (await album.count()) + 1; n <= upTo; n++)
      await album.add({
        ...first,
        caption: `tester with Rin #${n}`,
        at: first.at + n * 60_000,
      });
  }, upTo);
async function takePhoto(page: Page) {
  await page.evaluate(() => (window as any).__plazaPosition(1010, 520));
  await expect(page.locator("#pz-interact")).toContainText("Take photo", {
    timeout: 10_000,
  });
  await page.click("#pz-interact");
  const polaroid = page.locator("#pz-photo .polaroid");
  await expect(polaroid).toBeVisible();
  await settle(page, "#pz-photo");
  return polaroid;
}

for (const size of SIZES) {
  test(`the polaroid, the album and an open photo fit at ${size.width}x${size.height}${size.inset ? " with a Dynamic Island" : ""}`, async ({
    browser,
  }, info) => {
    const { context, page, errors, phone } = await open(browser, size);
    try {
      const shot = (what: string) =>
        snap(page, info, `album-${what}-${size.name}`);
      let panel: Rect;

      await test.step("an empty album says how to fill it", async () => {
        await page.click("#pz-album-btn");
        await expect(page.locator("#pz-album")).toBeVisible();
        const empty = page.locator(".pz-album-empty");
        await expect(empty).toContainText("No photos yet");
        await expect(empty).toContainText(
          "Take one at the Photo Spot, then press Save to album.",
        );
        await expect(page.locator("#pz-album-count")).toHaveText("0 / 30");
        await expect(page.locator("#pz-album-grid .slot.empty")).toHaveCount(
          30,
        );
        await settle(page, "#pz-album");
        panel = await inSafeAreaBelowHeader(page, size, "#pz-album-panel");
        const [grid] = await boxes(page, "#pz-album-grid");
        const [card] = await boxes(page, ".pz-album-empty");
        expect(card.x).toBeGreaterThanOrEqual(grid.x);
        expect(card.x + card.w).toBeLessThanOrEqual(grid.x + grid.w);
        expect(card.y).toBeGreaterThanOrEqual(grid.y);
        expect(card.y + card.h).toBeLessThanOrEqual(grid.y + grid.h);
        await shot("empty");
        await page.click('#pz-album [data-al="close"]');
        await expect(page.locator("#pz-album")).toBeHidden();
      });

      await test.step("the polaroid", async () => {
        const polaroid = await takePhoto(page);
        await expect(polaroid).toContainText("tester at the Photo Spot");
        await expect(polaroid).toContainText("Elemental Plaza ·");
        await inSafeAreaBelowHeader(page, size, "#pz-photo .polaroid");
        // The photo keeps its 640 × 420 shape.
        const [img] = await layout(page, "#pz-photo .polaroid img");
        expect(Math.abs(img.h - (img.w * 420) / 640)).toBeLessThan(1);
        expect(img.w).toBeGreaterThan(phone ? 300 : 480);
        expect(await lineUp(page, "#pz-photo .acts > *", phone)).toEqual([
          "Save to album",
          "Save picture",
          "Close",
        ]);
        expect(await cutText(page, "#pz-photo small")).toEqual([]);
        await shot("polaroid");
        await polaroid.locator('[data-ph="album"]').click();
        await expect(page.locator("#toast")).toContainText(
          "Saved to your album (1/30)",
        );
        await expect(polaroid).toBeHidden();
      });

      await test.step("the grid: 30 slots, the newest first", async () => {
        await fillAlbum(page, 12);
        await hideToast(page);
        await page.click("#pz-album-btn");
        const slots = page.locator("#pz-album-grid button.slot");
        await expect(slots).toHaveCount(12);
        await expect(page.locator("#pz-album-grid .slot.empty")).toHaveCount(
          18,
        );
        await expect(page.locator("#pz-album-count")).toHaveText("12 / 30");
        await expect(page.locator(".pz-album-empty")).toHaveCount(0);
        await expect(slots.first()).toHaveAttribute(
          "aria-label",
          "Open photo: tester with Rin #12",
        );
        await expect(slots.last()).toHaveAttribute(
          "aria-label",
          "Open photo: tester at the Photo Spot",
        );
        // Every thumbnail drew, from this device's copy.
        await expect
          .poll(() =>
            slots.evaluateAll((els) =>
              els.every(
                (b) =>
                  (b.querySelector("img") as HTMLImageElement).naturalWidth ===
                  256,
              ),
            ),
          )
          .toBe(true);
        await settle(page, "#pz-album");
        // A fixed-size page: the same box as when it was empty, every slot alike.
        const now = await inSafeAreaBelowHeader(page, size, "#pz-album-panel");
        expect(now).toEqual(panel);
        const cells = await boxes(page, "#pz-album-grid .slot");
        expect(cells).toHaveLength(30);
        for (const c of cells) {
          expect(Math.abs(c.w - cells[0].w)).toBeLessThan(0.5);
          expect(Math.abs(c.h - cells[0].h)).toBeLessThan(0.5);
          expect(Math.abs(c.h - (c.w * 420) / 640)).toBeLessThan(1);
        }
        expect(cells[0].w).toBeGreaterThanOrEqual(phone ? 64 : 120);
        // Rows line up and the grid needs no scrolling.
        const cols = phone ? 8 : 6;
        for (let i = 0; i < 30; i++) {
          expect(Math.abs(cells[i].x - cells[i % cols].x)).toBeLessThan(0.5);
          expect(
            Math.abs(cells[i].y - cells[Math.floor(i / cols) * cols].y),
          ).toBeLessThan(0.5);
        }
        const [grid] = await boxes(page, "#pz-album-grid");
        const last = cells[29];
        expect(last.y + last.h).toBeLessThanOrEqual(grid.y + grid.h + 0.5);
        expect(grid.y + grid.h).toBeLessThanOrEqual(now.y + now.h);
        // Header: title, count and close sit on one line, nothing cut short.
        const head = await boxes(
          page,
          "#pz-album-panel header > b, #pz-album-count, #pz-album-panel .x",
        );
        const mid = (r: Rect) => r.y + r.h / 2;
        for (const h of head)
          expect(Math.abs(mid(h) - mid(head[0]))).toBeLessThan(1);
        expect(
          await cutText(
            page,
            "#pz-album-panel header > b, #pz-album-count, .pz-album-note",
          ),
        ).toEqual([]);
        await shot("grid");
      });

      await test.step("an open photo", async () => {
        await page.locator("#pz-album-grid button.slot").nth(1).click();
        const view = page.locator("#pz-album-view .polaroid");
        await expect(view).toBeVisible();
        await expect(page.locator("#pz-album-panel")).toBeHidden();
        await expect(view).toContainText("tester with Rin #11");
        await settle(page, "#pz-album-view");
        await inSafeAreaBelowHeader(page, size, "#pz-album-view .polaroid");
        const [img] = await layout(page, "#pz-album-view img");
        expect(Math.abs(img.h - (img.w * 420) / 640)).toBeLessThan(1);
        await expect
          .poll(() =>
            page
              .locator("#pz-album-view img")
              .evaluate((i: HTMLImageElement) => i.naturalWidth),
          )
          .toBe(640);
        expect(await lineUp(page, "#pz-album-view .acts > *", phone)).toEqual([
          "Save picture",
          "Delete",
          "Back",
        ]);
        // The place, time and day are all there.
        expect(await cutText(page, "#pz-album-view small")).toEqual([]);
        await expect(page.locator("#pz-album-view small")).toHaveText(
          /^Elemental Plaza · \d\d:\d\d · \d{1,2} [A-Z][a-z]{2} \d{4}$/,
        );
        await shot("photo");
        await page.click('#pz-album-view [data-al="back"]');
        await expect(page.locator("#pz-album-panel")).toBeVisible();
        await page.click('#pz-album [data-al="close"]');
        await expect(page.locator("#pz-album")).toBeHidden();
      });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("the album keeps the newest 30, saves a picture and deletes after asking", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  // 30 photos already: one real, 29 copies.
  const polaroid = await takePhoto(page);
  await polaroid.locator('[data-ph="album"]').click();
  await expect(polaroid).toBeHidden();
  await fillAlbum(page, 30);
  // The 31st pushes out the oldest.
  await takePhoto(page);
  await page.click('[data-ph="album"]');
  await expect(page.locator("#toast")).toContainText(
    "Saved to your album. The oldest photo made room.",
  );
  const count = () =>
    page.evaluate(() => (window as any).__plaza.album.count());
  expect(await count()).toBe(30);
  await page.click("#pz-album-btn");
  await expect(page.locator("#pz-album-count")).toHaveText("30 / 30");
  const slots = page.locator("#pz-album-grid button.slot");
  await expect(slots).toHaveCount(30);
  await expect(page.locator("#pz-album-grid .slot.empty")).toHaveCount(0);
  await expect(slots.first()).toHaveAttribute(
    "aria-label",
    "Open photo: tester at the Photo Spot",
  );
  await expect(slots.last()).toHaveAttribute(
    "aria-label",
    "Open photo: tester with Rin #2",
  );
  await hideToast(page);
  await snap(page, info, "album-full");

  // Save it as a picture: a file of this photo, named by when it was taken.
  await slots.first().click();
  const save = page.locator('#pz-album-view [data-al="save"]');
  await expect(save).toHaveAttribute("href", /^blob:/);
  await expect(save).toHaveAttribute(
    "download",
    /^elemental-plaza-\d{4}-\d{2}-\d{2}-\d{4}\.jpg$/,
  );
  const download = page.waitForEvent("download");
  await save.click();
  expect((await download).suggestedFilename()).toMatch(
    /^elemental-plaza-.*\.jpg$/,
  );

  // Delete asks first; a second press deletes.
  const del = page.locator('#pz-album-view [data-al="delete"]');
  await del.click();
  await expect(del).toHaveText("Delete?");
  await expect(del).toHaveAttribute("data-sure", "1");
  expect(await count()).toBe(30);
  await snap(page, info, "album-delete-ask");
  await del.click();
  await expect(page.locator("#pz-album-view")).toBeHidden();
  await expect(page.locator("#pz-album-count")).toHaveText("29 / 30");
  await expect(slots).toHaveCount(29);
  await expect(slots.first()).toHaveAttribute(
    "aria-label",
    "Open photo: tester with Rin #30",
  );
  expect(await count()).toBe(29);

  // An unanswered "Delete?" goes back to "Delete" and deletes nothing.
  await slots.first().click();
  await del.click();
  await expect(del).toHaveText("Delete?");
  await expect(del).toHaveText("Delete", { timeout: 5_000 });
  expect(await count()).toBe(29);
  expect(errors).toEqual([]);
});

test("the album works from the keyboard and keeps its photos", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  const polaroid = await takePhoto(page);
  await polaroid.locator('[data-ph="album"]').click();
  await expect(polaroid).toBeHidden();
  await fillAlbum(page, 3);
  await page.click("#pz-album-btn");
  await expect(page.locator("#pz-album-grid button.slot")).toHaveCount(3);
  // Tab goes round the album only: close, then the three photos, then close.
  const focused = () =>
    page.evaluate(
      () =>
        document.activeElement?.getAttribute("aria-label") ??
        document.activeElement?.textContent,
    );
  expect(await focused()).toBe("Close the album");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
  expect(await focused()).toBe("Open photo: tester at the Photo Spot");
  await page.keyboard.press("Tab");
  expect(await focused()).toBe("Close the album");
  await page.keyboard.press("Shift+Tab");
  expect(await focused()).toBe("Open photo: tester at the Photo Spot");
  // Enter opens it, Escape goes back to the grid, Escape again closes.
  await page.keyboard.press("Enter");
  await expect(page.locator("#pz-album-view .polaroid")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#pz-album-panel")).toBeVisible();
  expect(await focused()).toBe("Open photo: tester at the Photo Spot");
  await page.keyboard.press("Escape");
  await expect(page.locator("#pz-album")).toBeHidden();
  // Kept on this device: a new visit (the page loads again), the photos
  // are there. (Leaving the tab keeps the Plaza itself, album and all.)
  await openPlaza(page);
  await expect(page.locator(".plaza-layer #pz-cv")).toBeVisible();
  await page.click("#pz-album-btn");
  await expect(page.locator("#pz-album-count")).toHaveText("3 / 30");
  expect(errors).toEqual([]);
});

test("you stand still while the album is open, and the Plaza rests behind it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  const layer = page.locator(".plaza-layer");
  const server = () =>
    page.evaluate(() => {
      const b = (window as any).__plazaWorld.bodyOf("local");
      return { x: b.x, y: b.y };
    });
  // Walking right, then the album opens (a click while the key is held).
  const start = await server();
  await layer.focus();
  await page.keyboard.down("d");
  await expect
    .poll(async () => (await server()).x)
    .toBeGreaterThan(start.x + 60);
  await page.click("#pz-album-btn");
  await expect(page.locator("#pz-album")).toBeVisible();
  await page.keyboard.up("d");
  await expect(layer).toHaveAttribute("data-frozen", "true", {
    timeout: 15_000,
  });
  const still = await server();
  await page.waitForTimeout(800);
  expect(await server()).toEqual(still);
  await page.click('#pz-album [data-al="close"]');
  await expect(layer).toHaveAttribute("data-frozen", "false");
  // And you can walk again.
  await layer.focus();
  await page.keyboard.down("a");
  await expect.poll(async () => (await server()).x).toBeLessThan(still.x - 30);
  await page.keyboard.up("a");
  expect(errors).toEqual([]);
});

// A tap on the dimmed background puts the polaroid, an album photo and the
// album away (a photo goes back to the grid first). A drag that starts on
// the card and ends on the background doesn't.
test("a tap on the dim background puts the polaroid, a photo and the album away", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  /** A spot on the dim background, left of a card at its middle. */
  const beside = (card: string) =>
    page.evaluate((card) => {
      const r = document.querySelector(card)!.getBoundingClientRect(),
        x = r.left - 40,
        y = r.top + r.height / 2;
      return { x, y, hit: document.elementFromPoint(x, y)?.id };
    }, card);
  const polaroid = await takePhoto(page);
  const out = await beside("#pz-photo .polaroid");
  expect(out.hit).toBe("pz-photo");
  // A drag from the photo out to the background keeps it.
  const print = await polaroid.locator("img").boundingBox();
  await page.mouse.move(print!.x + 40, print!.y + 40);
  await page.mouse.down();
  await page.mouse.move(out.x, out.y, { steps: 4 });
  await page.mouse.up();
  await polaroid.locator("p").click();
  await expect(polaroid).toBeVisible();
  // Keep it in the album for the next part, then a tap beside it.
  await polaroid.locator('[data-ph="album"]').click();
  await expect(polaroid).toBeHidden();
  await takePhoto(page);
  await page.mouse.click(out.x, out.y);
  await expect(page.locator("#pz-photo")).toBeHidden();

  // The album: a photo goes back to the grid, the grid out of the album.
  await page.click("#pz-album-btn");
  await expect(page.locator("#pz-album")).toBeVisible();
  await page.locator("#pz-album-grid button.slot").first().click();
  const view = page.locator("#pz-album-view");
  await expect(view).toBeVisible();
  await settle(page, "#pz-album");
  const photoOut = await beside("#pz-album-view .polaroid");
  expect(["pz-album", "pz-album-view"]).toContain(photoOut.hit);
  await page.mouse.click(photoOut.x, photoOut.y);
  await expect(view).toBeHidden();
  await expect(page.locator("#pz-album-panel")).toBeVisible();
  const gridOut = await beside("#pz-album-panel");
  expect(gridOut.hit).toBe("pz-album");
  // A tap in the album itself keeps it.
  await page.locator(".pz-album-note").click();
  await expect(page.locator("#pz-album")).toBeVisible();
  await page.mouse.click(gridOut.x, gridOut.y);
  await expect(page.locator("#pz-album")).toBeHidden();
  expect(errors).toEqual([]);
});
