import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import { fakeFarm } from "./farm-fake";

/*
 * The land round the farm (farm-scenery.ts, farm-surround.ts): dressed to
 * the world's edge, a camera that stops just past the farm, live water, one
 * scale for everything, honest layers, and a frame that costs no more.
 */

const src = (p: string) =>
  new URL(`../../apps/client/src/farm/${p}`, import.meta.url).pathname;

async function openBuiltFarm(page: Page) {
  const errors = await openLobby(page);
  await fakeFarm(page);
  await page.evaluate(() => {
    const f = (window as any).__fakeFarm;
    const later = new Date(Date.now() + 600_000).toISOString();
    f.level = 20;
    f.pasture = true;
    f.milkAt = later;
    f.cows = [{ i: 2, milkAt: later }];
    f.coop = true;
    f.hens = [1, 2, 3].map((i) => ({ i, eggAt: null }));
    f.bakery.owned = true;
    f.weather = { now: "sun", next: "sun", until: later };
  });
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await expect(page.locator(".farm-layer #fm-cv")).toBeVisible();
  await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
  await page.evaluate(() => (window as any).__farm.tod(0.45));
  return errors;
}
/** The canvas's pixel (r, g, b) at a world point. */
const pixelAt = (page: Page, x: number, y: number) =>
  page.evaluate(
    ([x, y]) => {
      const f = (window as any).__farm,
        p = f.worldClient(x, y),
        cv = document.querySelector("#fm-cv") as HTMLCanvasElement,
        r = cv.getBoundingClientRect(),
        g = cv.getContext("2d")!,
        px = Math.round(((p.x - r.left) / r.width) * cv.width),
        py = Math.round(((p.y - r.top) / r.height) * cv.height);
      f.drawMs(1);
      return [...g.getImageData(px, py, 1, 1).data.slice(0, 3)];
    },
    [x, y],
  );

for (const vp of [
  { width: 844, height: 390, phone: true },
  { width: 1280, height: 800, phone: false },
])
  test(`the land round the farm is dressed to the camera's edge at ${vp.width}x${vp.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.phone,
      hasTouch: vp.phone,
    });
    try {
      const page = await context.newPage();
      const errors = await openBuiltFarm(page);
      // Zoomed right out: a little past the farm's fit, no further.
      const v = await page.evaluate(() => {
        const f = (window as any).__farm;
        f.zoom(0.01);
        return f.view();
      });
      expect(v.Z).toBeCloseTo(v.ZMIN, 6);
      expect(v.Z).toBeGreaterThanOrEqual(0.92 * v.fit - 1e-6);
      expect(v.Z).toBeLessThan(v.fit + 0.1);
      // Every corner of the world the camera reaches is land, never the
      // bare backdrop behind it.
      for (const [name, x, y] of [
        ["nw", -2000, -2000],
        ["ne", 4000, -2000],
        ["sw", -2000, 4000],
        ["se", 4000, 4000],
        ["middle", 880, 540],
      ] as const) {
        await page.evaluate(
          ([x, y]) => (window as any).__farm.look(x, y),
          [x, y],
        );
        const bare = await page.evaluate(() => {
          const cv = document.querySelector("#fm-cv") as HTMLCanvasElement,
            g = cv.getContext("2d")!;
          (window as any).__farm.drawMs(1);
          let n = 0;
          for (const [fx, fy] of [
            [0.02, 0.5],
            [0.98, 0.5],
            [0.5, 0.97],
            [0.3, 0.97],
            [0.7, 0.97],
          ]) {
            const d = g.getImageData(
              Math.floor(cv.width * fx),
              Math.floor(cv.height * fy),
              1,
              1,
            ).data;
            // The backdrop's plain #2f5a26.
            if (d[0] === 0x2f && d[1] === 0x5a && d[2] === 0x26) n++;
          }
          return n;
        });
        expect(bare, name).toBe(0);
        await snap(page, info, `farm-land-${name}-${vp.width}x${vp.height}`);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("the pond and the brook move; the ground round them keeps still", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openBuiltFarm(page);
  const clip = async (x: number, y: number, w: number, h: number) => {
    const a = await page.evaluate(
      ([x, y]) => (window as any).__farm.worldClient(x, y),
      [x, y],
    );
    return page.screenshot({
      clip: { x: a.x - w / 2, y: a.y - h / 2, width: w, height: h },
    });
  };
  await page.evaluate(() => {
    const f = (window as any).__farm;
    f.zoom(1.3);
    f.look(250, 1080);
  });
  await page.waitForTimeout(300);
  const pond = await clip(250, 990, 160, 60),
    brook = await clip(560, 1192, 160, 30);
  await page.waitForTimeout(900);
  expect((await clip(250, 990, 160, 60)).equals(pond), "the pond").toBe(false);
  expect((await clip(560, 1192, 160, 30)).equals(brook), "the brook").toBe(
    false,
  );
  await snap(page, info, "farm-water");
  expect(errors).toEqual([]);
});

test("a cow beside the pasture's side stands behind its nearer post", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openBuiltFarm(page);
  // The first cow, pinned just behind the post at y = 516 on the right side.
  const post = await page.evaluate(() => {
    const f = (window as any).__farm,
      P = f.pasture,
      cw = f.cows[0],
      y = P.y0 + 42 * 4;
    Object.assign(cw, {
      x: P.x1 - 30,
      x0: P.x1 - 30,
      x1: P.x1 - 30,
      y: y - 6,
      face: 1,
      hop: 0,
    });
    f.zoom(2);
    f.look(P.x1, y - 40);
    return { x: P.x1, y };
  });
  await page.waitForTimeout(200);
  // Middle of the post, where the cow's body is behind it: wood, not cow.
  const [r, g, b] = await pixelAt(page, post.x, post.y - 14);
  await snap(page, info, "farm-cow-behind-post");
  expect(r, `post pixel ${r},${g},${b}`).toBeGreaterThan(g);
  expect(g, `post pixel ${r},${g},${b}`).toBeGreaterThan(b);
  expect(r - b, `post pixel ${r},${g},${b}`).toBeGreaterThan(40);
  expect(errors).toEqual([]);
});

test("one scale: buildings, animals, people and the things round the farm", async ({
  page,
}) => {
  await openLobby(page);
  const out = await page.evaluate(
    async ([gfxPath, surroundPath, sceneryPath]) => {
      const { GFX } = await import(/* @vite-ignore */ `/@fs${gfxPath}`);
      const S = await import(/* @vite-ignore */ `/@fs${surroundPath}`);
      const { PROPS } = await import(/* @vite-ignore */ `/@fs${sceneryPath}`);
      const cv = document.createElement("canvas");
      cv.width = 900;
      cv.height = 700;
      const g = cv.getContext("2d", { willReadFrequently: true })!;
      // How tall a picture stands above the ground (opaque pixels).
      const up = (draw: (g: CanvasRenderingContext2D) => void) => {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, 900, 700);
        g.translate(450, 600);
        draw(g);
        const d = g.getImageData(0, 0, 900, 700).data;
        for (let y = 0; y < 700; y++)
          for (let x = 0; x < 900; x++)
            if (d[(y * 900 + x) * 4 + 3] > 140) return 600 - y;
        return 0;
      };
      const prop = (kind: string) => PROPS.find((p: any) => p.kind === kind);
      const at0 = (p: any) => ({ ...p, x: 0, y: 0 });
      return {
        barn: up((g) => GFX.blit(g, GFX.barn(), 0, 0)),
        mill: up((g) => GFX.blit(g, GFX.windmillBody(), 0, 0, 1.15)),
        doghouse: up((g) => GFX.blit(g, GFX.doghouse(), 0, 0, 0.8)),
        dog: up((g) => GFX.dog(g, "gold", "idle", 0, 0, 0, 0.95, 1)),
        mailbox: up((g) => GFX.blit(g, GFX.mailbox(), 0, 0)),
        bale: up((g) => S.drawProp(g, at0(prop("bale")))),
        hive: up((g) => S.drawProp(g, at0(prop("hive")))),
        woodpile: up((g) => S.drawProp(g, at0(prop("woodpile")))),
        cart: up((g) => S.drawProp(g, at0(prop("cart")))),
        tractor: up((g) => S.drawTractor(g, 0, 0, 1, 0)),
        expect: Object.fromEntries(
          ["bale", "hive", "woodpile", "cart"].map((k) => [k, prop(k).h]),
        ),
      };
    },
    [src("farm-gfx.ts"), src("farm-surround.ts"), src("farm-scenery.ts")],
  );
  console.log("sizes", JSON.stringify(out));
  // A person on the farm is 80 px; a tractor's cab about one and a half
  // people tall (2.3 m at 55 px a metre: 126 px, a puff of smoke above).
  expect(out.tractor).toBeGreaterThan(115);
  expect(out.tractor).toBeLessThan(160);
  // Things people use are as tall as their size says (±12%).
  for (const k of ["bale", "hive", "woodpile", "cart"] as const) {
    expect(out[k], k).toBeGreaterThan(out.expect[k] * 0.88);
    expect(out[k], k).toBeLessThan(out.expect[k] * 1.12);
  }
  expect(out.mailbox).toBeGreaterThan(60);
  expect(out.mailbox).toBeLessThan(72);
  // The windmill stands over the barn; the doghouse under twice the dog.
  expect(out.mill).toBeGreaterThan(out.barn);
  expect(out.doghouse).toBeLessThan(out.dog * 1.9);
  expect(out.doghouse).toBeGreaterThan(out.dog * 1.2);
});

test("the land round the farm costs little at Low on a phone", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
    const errors = await openBuiltFarm(page);
    await expect(page.locator(".farm-layer")).toHaveAttribute(
      "data-graphics",
      "low",
    );
    // The best of three runs, zoomed right out: over the farm, and over the
    // corner with the most land round it (the wood, the pond, the brook).
    const cost = (x: number, y: number) =>
      page.evaluate(
        ([x, y]) => {
          const f = (window as any).__farm;
          f.zoom(0.01);
          f.look(x, y);
          f.drawMs(3);
          return Math.min(f.drawMs(10), f.drawMs(10), f.drawMs(10));
        },
        [x, y],
      );
    const farm = await cost(880, 540),
      land = await cost(-2000, 4000);
    console.log(
      `Low frame: ${farm.toFixed(2)} ms over the farm, ${land.toFixed(2)} ms over the land round it`,
    );
    expect(land).toBeLessThan(farm * 1.35 + 1.5);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
