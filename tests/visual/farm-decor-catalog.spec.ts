import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import { fakeFarm } from "./farm-fake";

// The bigger decoration catalog (20261117120000_farm_decor_catalog.sql):
// groups in the Decorate sheet with each decoration's own picture,
// collections, seasonal decorations, paths, and a farm full of them.

const farmActions = (page: Page) =>
  page.evaluate(() =>
    (window as any).__farmRequests.flatMap((r: any) => r.actions),
  );

/** Open the farm with the fake server, at a level, leaves and seasons. */
async function openFarm(
  page: Page,
  o: { level?: number; leaves?: number; seasons?: string[] } = {},
) {
  const errors = await openLobby(page);
  await fakeFarm(page);
  await page.evaluate((o) => {
    const f = (window as any).__fakeFarm;
    if (o.level) f.level = o.level;
    // Clear skies, so the pictures read.
    f.weather = { ...f.weather, now: "sun" };
    if (o.leaves) f.leaves = o.leaves;
    f.decorSeasons = o.seasons ?? [];
  }, o);
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await expect(page.locator("#fm-badge")).toContainText("tester's Farm");
  return errors;
}

/** Which preview canvases in the sheet are still blank. */
const blankPreviews = (page: Page) =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLCanvasElement>(
        "#fm-sheet [data-decoprev]",
      ),
    ]
      .filter((c) => {
        const d = c
          .getContext("2d")!
          .getImageData(0, 0, c.width, c.height).data;
        let a = 0;
        for (let k = 3; k < d.length; k += 16) a += d[k];
        return a < 255 * 20;
      })
      .map((c) => c.dataset.decoprev),
  );

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 844, height: 390 },
]) {
  const phone = viewport.width < 1000;
  test(`the Decorate sheet: groups, real previews, seasons and collections at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport,
      ...(phone ? { isMobile: true, hasTouch: true } : {}),
    });
    try {
      const page = await context.newPage();
      const errors = await openFarm(page, {
        level: 40,
        leaves: 50_000,
        seasons: ["christmas"],
      });
      await page.click('#fm-rail [data-sheet="decor"]');
      const sheet = page.locator("#fm-sheet");
      await expect(sheet).toContainText("Charm 0");
      const groups = await page.evaluate(() => {
        const D = (window as any).__farm.rules.FARM_DECOR as any[];
        const out: Record<string, string[]> = {};
        for (const d of D) (out[d.group] ??= []).push(d.id);
        return out;
      });
      expect(Object.keys(groups)).toHaveLength(8);
      const chips = sheet.locator(".deco-groups [data-dgroup]");
      await expect(chips).toHaveCount(9);
      // "All" lists every decoration, each with its own picture.
      await expect(sheet.locator(".deco-it")).toHaveCount(
        Object.values(groups).flat().length,
      );
      for (const [g, ids] of Object.entries(groups)) {
        await sheet.locator(`[data-dgroup="${g}"]`).click();
        await expect(sheet.locator(`[data-dgroup="${g}"]`)).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        await expect(sheet.locator(".deco-it")).toHaveCount(ids.length);
        expect(
          await sheet
            .locator(".deco-it")
            .evaluateAll((els) =>
              els.map((e) => (e as HTMLElement).dataset.decoitem),
            ),
        ).toEqual(ids);
        expect(await blankPreviews(page), g).toEqual([]);
        // Nothing sticks out of the sheet sideways.
        const over = await sheet.evaluate((el) => {
          const body = el.querySelector(".sh-body")!.getBoundingClientRect();
          return [...el.querySelectorAll(".deco-it")]
            .map((r) => r.getBoundingClientRect())
            .filter((r) => r.right > body.right + 1 || r.left < body.left - 1)
            .length;
        });
        expect(over, g).toBe(0);
        if (["fences", "trees", "seasonal"].includes(g))
          await snap(
            page,
            info,
            `farm-decor-sheet-${g}-${viewport.width}x${viewport.height}`,
          );
      }
      // Seasonal: Christmas is on sale (the server says so), Halloween waits.
      const snowman = sheet.locator('.deco-it[data-decoitem="snowman"]');
      await expect(snowman).toContainText("Christmas · on sale now");
      await expect(snowman.locator("button")).toBeEnabled();
      const pumpkin = sheet.locator('.deco-it[data-decoitem="pumpkin"]');
      await expect(pumpkin).toContainText("sold Oct 1 – Nov 7");
      await expect(pumpkin.locator("button")).toBeDisabled();
      await expect(
        sheet.locator('[data-dgroup="seasonal"] .dlive'),
      ).toHaveCount(1);
      // Collections, with what's on the farm.
      await sheet.locator('[data-tab="sets"]').click();
      await expect(sheet.locator(".dset")).toHaveCount(9);
      await expect(sheet.locator('[data-decoset="cottage"]')).toContainText(
        "0/5",
      );
      expect(await blankPreviews(page)).toEqual([]);
      await snap(
        page,
        info,
        `farm-decor-sheet-sets-${viewport.width}x${viewport.height}`,
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("places one decoration from every group, and a path on a path", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  try {
    const page = await context.newPage();
    const errors = await openFarm(page, {
      level: 80,
      leaves: 1_000_000,
      seasons: ["halloween"],
    });
    const sheet = page.locator("#fm-sheet"),
      bar = page.locator("#fm-deco-bar");
    const pick = {
      fences: "pathstone",
      plants: "sunflowers",
      trees: "palm",
      furniture: "picnic",
      water: "fountain",
      lights: "torch",
      statues: "deer",
      seasonal: "pumpkin",
    };
    for (const [g, id] of Object.entries(pick)) {
      await page.click('#fm-rail [data-sheet="decor"]');
      await sheet.locator(`[data-dgroup="${g}"]`).click();
      await sheet.locator(`[data-deco="${id}"]`).click();
      await expect(sheet).toBeHidden();
      await expect(bar.locator('[data-dact="ok"]')).toBeEnabled();
      await bar.locator('[data-dact="ok"]').click();
      await expect(bar).toBeHidden();
    }
    await expect
      .poll(async () => (await farmActions(page)).map((a: any) => a.item))
      .toEqual(Object.values(pick));
    // Paths may overlap each other, never anything standing: a second
    // stone path right on the first goes down, tulips there can't (the
    // same width, so only the path is in their way).
    const first = await page.evaluate(() =>
      (window as any).__farm.F.decor.find((d: any) => d.item === "pathstone"),
    );
    const onFirst = async (item: string) => {
      await page.click('#fm-rail [data-sheet="decor"]');
      await sheet.locator('[data-dgroup="all"]').click();
      await sheet.locator(`[data-deco="${item}"]`).click();
      const at = await page.evaluate(
        ([x, y]) => {
          const f = (window as any).__farm;
          f.look(x, y - 60);
          return f.worldClient(x, y);
        },
        [first.x, first.y],
      );
      await page.waitForTimeout(150);
      await page.mouse.click(at.x, at.y);
      await expect
        .poll(
          async () =>
            (await page.evaluate(() => (window as any).__farm.deco())).edit,
        )
        .toMatchObject({ item, x: first.x, y: first.y });
    };
    await onFirst("tulips");
    await expect(bar).toContainText("Too close to another decoration");
    await expect(bar.locator('[data-dact="ok"]')).toBeDisabled();
    await bar.locator('[data-dact="cancel"]').click();
    await onFirst("pathstone");
    await expect(bar).not.toContainText("Too close");
    await expect(bar.locator('[data-dact="ok"]')).toBeEnabled();
    await bar.locator('[data-dact="ok"]').click();
    await expect
      .poll(async () => (await farmActions(page)).length)
      .toBe(Object.keys(pick).length + 1);
    await page.waitForTimeout(300);
    await snap(page, info, "farm-decor-one-per-group");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

/** Lay out 60 decorations (every kind but one) on free ground, as a player might. */
async function fillFarm(page: Page) {
  return page.evaluate(() => {
    const w = window as any,
      R = w.__farm.rules,
      f = w.__fakeFarm;
    const seeds: [number, number][] = [];
    for (const y of [880, 960, 1040, 420, 520, 620, 720])
      for (let x = 40; x <= 1720; x += 70) seeds.push([x, y]);
    const placed: any[] = [];
    let k = 0;
    const all = (R.FARM_DECOR as any[]).filter((d) => d.id !== "plum");
    for (const d of all) {
      for (; k < seeds.length; k++) {
        const [sx, sy] = seeds[k];
        const s = R.nearestDecorSpot(d.id, sx, sy, placed, undefined, 60);
        if (s) {
          placed.push({
            id: 500 + placed.length,
            item: d.id,
            ...s,
            flip: placed.length % 3 === 0,
          });
          k++;
          break;
        }
      }
    }
    f.level = 60;
    f.decor = placed;
    f.charm = R.decorCharm(placed);
    return { n: placed.length, charm: f.charm };
  });
}

test("a farm with 60 decorations: day, night and Low graphics", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  try {
    const page = await context.newPage();
    const errors = await openFarm(page, { level: 60 });
    // Frame cost, measured at the same spot (after a warm-up), the best of
    // three runs: this machine draws on a shared CPU.
    const cost = () =>
      page.evaluate(() => {
        const f = (window as any).__farm;
        f.tod(0.5);
        f.look(900, 900);
        f.drawMs(3);
        return Math.min(f.drawMs(8), f.drawMs(8), f.drawMs(8));
      });
    const empty = await cost();
    const { n, charm } = await fillFarm(page);
    expect(n).toBe(60);
    await page.evaluate(() => (window as any).__farm.refresh());
    await expect
      .poll(() => page.evaluate(() => (window as any).__farm.F.decor.length))
      .toBe(60);
    expect(await page.evaluate(() => (window as any).__farm.F.charm)).toBe(
      charm,
    );
    await page.evaluate(() => (window as any).__farm.tod(0.42));
    for (const [x, y, name] of [
      [440, 900, "west"],
      [1300, 900, "east"],
      [180, 520, "lane"],
    ] as const) {
      await page.evaluate(
        ([x, y]) => (window as any).__farm.look(x, y),
        [x, y],
      );
      await page.waitForTimeout(250);
      await snap(page, info, `farm-decor-full-${name}`);
    }
    // Up close: the pictures are crisp at a big zoom.
    await page.evaluate(() => {
      const f = (window as any).__farm;
      f.zoom(2);
      f.look(1150, 900);
    });
    await page.waitForTimeout(300);
    await snap(page, info, "farm-decor-full-closeup");
    await page.evaluate(() => (window as any).__farm.look(300, 860));
    await page.waitForTimeout(300);
    await snap(page, info, "farm-decor-full-closeup-2");
    await page.evaluate(() => (window as any).__farm.zoom(1));
    // After dark the lamps, lanterns and flames light their ground.
    await page.evaluate(() => (window as any).__farm.tod(0.95));
    await page.evaluate(() => (window as any).__farm.look(1300, 900));
    await page.waitForTimeout(300);
    await snap(page, info, "farm-decor-full-night");
    // The sheet's collections show which are complete.
    await page.click('#fm-rail [data-sheet="decor"]');
    await page.locator('#fm-sheet [data-tab="sets"]').click();
    const done = await page.evaluate(() => {
      const R = (window as any).__farm.rules,
        have = new Set((window as any).__farm.F.decor.map((p: any) => p.item));
      return (R.DECOR_SETS as any[])
        .filter((s) => s.items.every((i: string) => have.has(i)))
        .map((s) => s.id);
    });
    expect(done.length).toBeGreaterThan(0);
    for (const id of done)
      await expect(
        page.locator(`#fm-sheet [data-decoset="${id}"]`),
      ).toContainText("Complete");
    await page.locator("#fm-sheet [data-close]").click();
    await page.evaluate(() => (window as any).__farm.tod(0.5));
    // Drawing them costs little next to the farm itself (any level).
    await page.evaluate(() => (window as any).__farm.look(900, 900));
    const full = await cost();
    console.log(
      `farm frame: ${empty.toFixed(1)} ms empty, ${full.toFixed(1)} ms with 60 decorations`,
    );
    expect(full).toBeLessThan(empty * 1.6 + 4);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Low graphics: 60 decorations add little to a phone's frame", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
    const errors = await openFarm(page, { level: 60 });
    await expect(page.locator(".farm-layer")).toHaveAttribute(
      "data-graphics",
      "low",
    );
    await page.evaluate(() => (window as any).__farm.look(900, 920));
    const ms = () =>
      page.evaluate(() => {
        const f = (window as any).__farm;
        return Math.min(f.drawMs(15), f.drawMs(15), f.drawMs(15));
      });
    await ms();
    const empty = await ms();
    await fillFarm(page);
    await page.evaluate(() => (window as any).__farm.refresh());
    await expect
      .poll(() => page.evaluate(() => (window as any).__farm.F.decor.length))
      .toBe(60);
    await ms();
    const full = await ms();
    console.log(
      `Low frame: ${empty.toFixed(2)} ms empty, ${full.toFixed(2)} ms with 60 decorations`,
    );
    expect(full).toBeLessThan(empty * 1.5 + 1.5);
    await snap(page, info, "farm-decor-full-low-844x390");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
