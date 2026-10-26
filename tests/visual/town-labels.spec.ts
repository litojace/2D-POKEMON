import { expect, test } from "@playwright/test";
import { openTown } from "./helpers";

test("every boss name fits within the plaque painted on its pedestal", async ({
  page,
}) => {
  const errors = await openTown(page);
  const audit = await page.evaluate(async () => {
    const { auditBossPlinths } = await import("/town-labels.ts");
    return auditBossPlinths();
  });
  expect(audit.length).toBeGreaterThanOrEqual(7);
  for (const { boss, plaque, glyphs } of audit)
    for (const line of glyphs) {
      expect(line.x, `${boss}: left plaque edge`).toBeGreaterThanOrEqual(
        plaque.x + 0.5,
      );
      expect(line.right, `${boss}: right plaque edge`).toBeLessThanOrEqual(
        plaque.x + plaque.width - 0.5,
      );
      expect(line.y, `${boss}: top plaque edge`).toBeGreaterThanOrEqual(
        plaque.y + 0.5,
      );
      expect(line.bottom, `${boss}: bottom plaque edge`).toBeLessThanOrEqual(
        plaque.y + plaque.height - 0.5,
      );
    }
  expect(errors).toEqual([]);
});

test("a floating town fighter keeps its name and title steady while the rig bobs", async ({
  page,
}) => {
  await page.route(/\/apps\/client\/src\/town\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    await route.fulfill({
      response,
      body: body
        .replace(
          "this.scenery = new TownScenery(this, options.reduced);",
          "this.scenery = new TownScenery(this, options.reduced);window.__labelScene=this;",
        )
        .replace("return body;", "window.__labelBody=body;return body;"),
    });
  });
  const errors = await openTown(page);
  await page.waitForFunction(() => !!(window as any).__labelBody?.worn);
  await page.evaluate(() =>
    (window as any).__sock.emit(
      "town-look",
      { character: "duskveil" },
      () => {},
    ),
  );
  await page.waitForFunction(
    () => (window as any).__labelBody?.rig?.character === "duskveil",
  );
  const result = await page.evaluate(() => {
    const w = window as any,
      b = w.__labelBody,
      s = w.__labelScene;
    w.__sock.fire("town-profiles", [
      { ...b.worn, title: "Moonlit", titleColor: "#b79cff" },
    ]);
    s.game.loop.sleep();
    const sample = [];
    for (let i = 0; i < 40; i++) {
      s.place(b, s.time.now + i * 150);
      sample.push({ root: b.rig.root.y, name: b.name.y, title: b.title.y });
    }
    const oldX = b.name.x,
      oldY = b.name.y;
    b.x += 40;
    b.y += 20;
    s.place(b, s.time.now + 6100);
    return {
      sample,
      dx: b.name.x - oldX,
      dy: b.name.y - oldY,
      title: b.title.text,
    };
  });
  const range = (key: "root" | "name" | "title") =>
    Math.max(...result.sample.map((p) => p[key])) -
    Math.min(...result.sample.map((p) => p[key]));
  expect(result.title).toContain("Moonlit");
  expect(range("root")).toBeGreaterThan(0.5);
  expect(range("name")).toBeLessThan(0.01);
  expect(range("title")).toBeLessThan(0.01);
  expect(result.dx).toBe(40);
  expect(result.dy).toBe(20);
  expect(errors).toEqual([]);
});
