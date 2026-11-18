import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import { fakeBistro } from "./bistro-fake";

// The street corner around the Bistro (bistro-scenery.ts): shops across the
// road, a little square, people walking by, a bus at its stop, the canal.
// Pictures at noon, at sunset and at night, on a laptop and a small phone.
const B = (page: Page, js: string) =>
  page.evaluate(`(() => { const b = window.__bistro; ${js} })()`);
async function openBistro(page: Page) {
  const errors = await openLobby(page);
  await fakeBistro(page);
  await page.click('#hub-scenes [data-hub-scene="bistro"]');
  await expect(page.locator(".bistro-layer .bs-cv")).toBeVisible();
  await page.waitForFunction(() => (window as any).__bistro?.sync().ready);
  await B(page, "b.calm()");
  // The bus waits at its stop for the pictures.
  await B(page, "b.holdBus()");
  return errors;
}

for (const [w, h, size] of [
  [1280, 800, "laptop"],
  [844, 390, "phone"],
] as const)
  test(`Bistro street: noon, sunset and night on a ${size} (${w}×${h})`, async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: w, height: h });
    const errors = await openBistro(page);
    for (const [tod, name] of [
      [0.5, "noon"],
      [0.73, "sunset"],
      [0.93, "night"],
    ] as const) {
      await B(page, `b.setTod(${tod})`);
      // A few frames: the baked street follows the new light.
      await page.waitForTimeout(700);
      await snap(page, info, `bistro-street-${size}-${name}`);
    }
    expect(errors).toEqual([]);
  });

test("Bistro camera: zooms out only a little past the fit and never shows past the dressed town", async ({
  page,
}) => {
  test.setTimeout(120_000);
  for (const [w, h] of [
    [844, 390],
    [1280, 800],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    const errors = await openBistro(page);
    type Cam = {
      zoom: number;
      zoomMin: number;
      view: { x0: number; y0: number; x1: number; y1: number };
      scene: { x0: number; y0: number; x1: number; y1: number };
    };
    const inside = (c: Cam) => {
      expect(c.view.x0).toBeGreaterThanOrEqual(c.scene.x0 - 0.5);
      expect(c.view.y0).toBeGreaterThanOrEqual(c.scene.y0 - 0.5);
      expect(c.view.x1).toBeLessThanOrEqual(c.scene.x1 + 0.5);
      expect(c.view.y1).toBeLessThanOrEqual(c.scene.y1 + 0.5);
    };
    await page.mouse.move(w / 2, h / 2);
    for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 500);
    await page.waitForTimeout(300);
    const out = (await B(page, "return b.camera()")) as Cam;
    expect(out.zoom).toBeGreaterThanOrEqual(0.9);
    expect(out.zoom).toBeCloseTo(out.zoomMin, 5);
    inside(out);
    // Dragged hard toward each corner: still inside.
    for (const [dx, dy] of [
      [2000, 2000],
      [-4000, 0],
      [0, -4000],
      [4000, 0],
    ]) {
      await page.mouse.move(w / 2, h / 2);
      await page.mouse.down();
      await page.mouse.move(w / 2 + dx / 4, h / 2 + dy / 4, { steps: 4 });
      await page.mouse.move(w / 2 + dx, h / 2 + dy, { steps: 4 });
      await page.mouse.up();
      inside((await B(page, "return b.camera()")) as Cam);
    }
    expect(errors).toEqual([]);
  }
});

test("Bistro street: the canal's water moves (it is not a still picture)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openBistro(page);
  await B(page, "b.setTod(0.5)");
  // Look at the water left of the footbridge, the view dragged down to it.
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(640, 200, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const p = (await B(page, "return b.water()")) as { x: number; y: number };
  const clip = { x: p.x - 60, y: p.y - 10, width: 120, height: 20 };
  const a = await page.screenshot({ clip });
  await page.waitForTimeout(700);
  const b = await page.screenshot({ clip });
  expect(Buffer.compare(a, b)).not.toBe(0);
  expect(errors).toEqual([]);
});

test("Bistro street: the seasons follow the server's day (cherry blossom, autumn leaves, snow)", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openBistro(page);
  await B(page, "b.setTod(0.5)");
  for (const s of ["spring", "summer", "autumn", "winter"]) {
    await B(page, `b.setSeason("${s}")`);
    await page.waitForTimeout(700);
    await snap(page, info, `bistro-street-season-${s}`);
  }
  // Snow at night too: the lamps and shop windows on the white street.
  await B(page, "b.setTod(0.93)");
  await page.waitForTimeout(700);
  await snap(page, info, "bistro-street-season-winter-night");
  expect(errors).toEqual([]);
});

test("Bistro street: people walk by, the bus comes and goes, pigeons in the square; fewer on Low", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  type Street = {
    folk: { kind: string; x: number; y: number }[];
    bus: { y: number; state: string };
    pigeons: number;
    ducks: number;
  };
  const counts: Record<string, Street> = {};
  for (const graphics of ["high", "low"]) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.addInitScript(
      (g) => localStorage.setItem("ea-graphics", g),
      graphics,
    );
    try {
      const errors = await openBistro(page);
      await B(page, "b.holdBus(false)");
      const first = (await B(page, "return b.street()")) as Street;
      // People are moving along the sidewalks.
      await B(page, "b.advance(3)");
      const later = (await B(page, "return b.street()")) as Street;
      const walkers = (s: Street) =>
        s.folk.filter((f) => f.kind === "walk" || f.kind === "dog");
      expect(walkers(first).length).toBeGreaterThan(0);
      const moved = walkers(later).some(
        (f) =>
          !walkers(first).some(
            (g) => Math.abs(g.x - f.x) < 1e-6 && Math.abs(g.y - f.y) < 1e-6,
          ),
      );
      expect(moved).toBe(true);
      // The bus pulls away from its stop, and another comes later.
      await B(page, "b.advance(40)");
      const away = (await B(page, "return b.street()")) as Street;
      expect(away.bus.state).not.toBe("stop");
      counts[graphics] = first;
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }
  const people = (s: Street) => s.folk.filter((f) => f.kind !== "wait").length;
  expect(people(counts.low)).toBeLessThan(people(counts.high));
  expect(counts.low.pigeons).toBeLessThan(counts.high.pigeons);
});
