import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";

// The Bistro tab: a restaurant demo kept on this device (no server). The
// scene exposes window.__bistro in development builds to move time on.
async function openBistro(page: Page) {
  const errors = await openLobby(page);
  await page.click('#hub-scenes [data-hub-scene="bistro"]');
  await expect(page.locator(".bistro-layer .bs-cv")).toBeVisible();
  await page.waitForFunction(() => !!(window as any).__bistro);
  await page.evaluate(() => (window as any).__bistro.setTod(0.5));
  return errors;
}

test("the Bistro tab opens next to the Farm and plays a full service", async ({
  page,
}, info) => {
  const errors = await openBistro(page);
  await expect(page.locator("#hub-scenes button")).toHaveText([
    "Lobby",
    "Plaza",
    "Farm",
    "Bistro",
  ]);
  await expect(page.locator("#bs-badge")).toContainText("Bistro");
  // The first batch of spring rolls is on the counter.
  await expect(page.locator(".bs-slot img")).toHaveCount(1);

  // Tap the first stove: the cook sheet opens; cook spring rolls.
  const stove = await page.evaluate(() =>
    (window as any).__bistro.screen(1, 0, 50),
  );
  await page.mouse.click(stove.x, stove.y);
  await expect(page.locator("#bs-sheet")).toBeVisible();
  await expect(page.locator("#bs-sheet h2")).toContainText("Stove 1");
  const coins = await page.evaluate(
    () => (window as any).__bistro.state().coins,
  );
  await page.click('#bs-sheet [data-dish="goicuon"]');
  await expect(page.locator("#bs-sheet")).toBeHidden();
  expect(
    await page.evaluate(() => (window as any).__bistro.state().stoves[0].dish),
  ).toBe("goicuon");
  expect(
    await page.evaluate(() => (window as any).__bistro.state().coins),
  ).toBe(coins - 10);

  // Guests come in, are served by the waiter, eat and leave coins.
  await page.evaluate(() => {
    const b = (window as any).__bistro;
    for (let i = 0; i < 3; i++) {
      b.spawn();
      b.advance(1.5);
    }
    b.advance(25);
  });
  const served = await page.evaluate(
    () => (window as any).__bistro.state().served,
  );
  expect(served).toBeGreaterThanOrEqual(3);
  // Waiters clear the tables; the coins are banked.
  await page.evaluate(() => (window as any).__bistro.advance(20));
  expect(
    await page.evaluate(() => (window as any).__bistro.state().coins),
  ).toBeGreaterThan(coins - 10);
  await snap(page, info, "bistro-service");
  // English only in the game UI (the recipes too).
  await page.evaluate(() => (window as any).__bistro.sheet("menu"));
  const text = await page.evaluate(
    () => (document.querySelector(".bistro-layer") as HTMLElement).innerText,
  );
  expect(text).toContain("Banh Mi");
  expect(text).not.toMatch(
    /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i,
  );

  // Switching tabs closes the scene and keeps the state on this device.
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await expect(page.locator(".bistro-layer")).toHaveCount(0);
  const saved = await page.evaluate(() =>
    Object.keys(localStorage).find((k) => k.startsWith("ea-bistro:")),
  );
  expect(saved).toBeTruthy();
  expect(errors).toEqual([]);
});

test("Bistro decorate mode moves furniture and refuses the kitchen", async ({
  page,
}) => {
  const errors = await openBistro(page);
  await page.click('.bs-rail [data-act="decor"]');
  await expect(page.locator("#bs-edit")).toBeVisible();
  // Pick up the plant at (10, 0) and drop it at (9, 3).
  const from = await page.evaluate(() =>
    (window as any).__bistro.screen(10, 0, 30),
  );
  await page.mouse.click(from.x, from.y);
  await expect(page.locator("#bs-edit")).toContainText("Placing: Potted Fern");
  const kitchen = await page.evaluate(() =>
    (window as any).__bistro.screen(3, 1),
  );
  await page.mouse.click(kitchen.x, kitchen.y);
  await expect(page.locator("#bs-edit")).toContainText("Placing");
  const to = await page.evaluate(() => (window as any).__bistro.screen(9, 3));
  await page.mouse.click(to.x, to.y);
  await expect(page.locator("#bs-edit")).toContainText("Decorate");
  const plant = await page.evaluate(() =>
    (window as any).__bistro
      .state()
      .items.find((i: any) => i.kind === "plant" && i.x === 9 && i.y === 3),
  );
  expect(plant).toBeTruthy();
  await page.click('#bs-edit [data-ed="done"]');
  await expect(page.locator("#bs-edit")).toBeHidden();
  expect(errors).toEqual([]);
});

test("Bistro fits a phone in landscape", async ({ page }, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = await openBistro(page);
  const nav = await page.locator("#hub-scenes").boundingBox();
  const coins = await page.locator("#account-coins").boundingBox();
  expect(nav && coins && nav.x + nav.width <= coins.x).toBeTruthy();
  for (const sel of ["#bs-badge", ".bs-rail", "#bs-bar"]) {
    const box = await page.locator(sel).boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(390);
    expect(box!.x + box!.width).toBeLessThanOrEqual(844);
  }
  await snap(page, info, "bistro-phone");
  expect(errors).toEqual([]);
});

test("Bistro staff: hire a cook who cooks alone, and a report after time away", async ({
  page,
}, info) => {
  const errors = await openBistro(page);
  await page.evaluate(() => {
    const s = (window as any).__bistro.state();
    s.level = 2;
    s.coins = 600;
  });
  await page.click('.bs-rail [data-sheet="staff"]');
  await page.click('#bs-sheet [data-tab="hire"]');
  await page.locator('#bs-sheet [data-hire^="cook:"]').first().click();
  await expect(page.locator("#bs-sheet .bs-staff")).toHaveCount(2);
  await expect(page.locator("#bs-sheet .role.cook")).toHaveCount(1);
  // The cook starts their dish on the last stove by themselves.
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__bistro.state().stoves[1].dish),
    )
    .not.toBeNull();
  await page.click("#bs-sheet [data-close]");
  // Three hours away: the staff work their two-hour shift.
  await page.evaluate(() => (window as any).__bistro.away(3 * 3600 * 1000));
  await expect(page.locator(".bs-away")).toBeVisible();
  await expect(page.locator(".bs-away")).toContainText("While you were away");
  await expect(page.locator(".bs-away")).toContainText("2 h");
  await snap(page, info, "bistro-away");
  await page.click(".bs-away [data-collect]");
  await expect(page.locator("#bs-modal")).toBeHidden();
  expect(errors).toEqual([]);
});
