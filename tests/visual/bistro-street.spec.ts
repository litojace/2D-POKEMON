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
