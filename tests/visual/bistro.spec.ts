import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import { fakeBistro } from "./bistro-fake";

// The Bistro tab (migration 068). The harness has no database: bistro-fake.ts
// answers /api/bistro* in the page with the same shared rules.
const B = (page: Page, js: string) =>
  page.evaluate(
    `(() => { const b = window.__bistro; const srv = window.__bistroServer; ${js} })()`,
  );
async function openBistro(page: Page) {
  const errors = await openLobby(page);
  await fakeBistro(page);
  await page.click('#hub-scenes [data-hub-scene="bistro"]');
  await expect(page.locator(".bistro-layer .bs-cv")).toBeVisible();
  await page.waitForFunction(() => (window as any).__bistro?.sync().ready);
  await B(page, "b.setTod(0.5)");
  return errors;
}
/** Send what the scene has queued and wait for the answer. */
const flush = (page: Page) => B(page, "return b.flush()");
type Pt = { x: number; y: number };

test("the Bistro tab opens next to the Farm and plays a full service on the server", async ({
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
  await expect(page.locator(".bs-slot img")).toHaveCount(1);
  await expect(page.locator("#bs-loading")).toBeHidden();

  // Tap the first stove: the cook sheet opens; cook spring rolls.
  const stove = (await B(page, "return b.screen(1, 0, 50)")) as Pt;
  await page.mouse.click(stove.x, stove.y);
  await expect(page.locator("#bs-sheet h2")).toContainText("Stove 1");
  await page.click('#bs-sheet [data-dish="goicuon"]');
  await expect(page.locator("#bs-sheet")).toBeHidden();
  await flush(page);
  expect(await B(page, "return srv.S.stoves[0].dish")).toBe("goicuon");
  expect(await B(page, "return srv.S.coins")).toBe(140);
  // Sixteen seconds later (the server's clock), a tap plates it.
  await B(page, "srv.advance(16); return b.load()");
  await page.mouse.click(stove.x, stove.y);
  await flush(page);
  expect(await B(page, "return srv.S.counter[0].servings")).toBe(12);

  // Guests come in, are served, eat and leave coins; the waiter banks them
  // and each sale goes to the server.
  await B(
    page,
    "for (let i = 0; i < 3; i++) { b.spawn(); b.advance(1.5); } b.advance(25); b.advance(20);",
  );
  await flush(page);
  await expect
    .poll(() => B(page, "return srv.S.served"))
    .toBeGreaterThanOrEqual(3);
  const sales = (await B(
    page,
    "return srv.requests.flatMap((r) => r.actions).filter((a) => a.a === 'serve').length",
  )) as number;
  expect(sales).toBeGreaterThanOrEqual(3);
  await snap(page, info, "bistro-service");

  // English only in the game UI (the recipes too).
  await B(page, "b.sheet('menu')");
  const text = await page.evaluate(
    () => (document.querySelector(".bistro-layer") as HTMLElement).innerText,
  );
  expect(text).toContain("Banh Mi");
  expect(text).not.toMatch(
    /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i,
  );

  // Switching tabs closes the scene.
  await page.click('#hub-scenes [data-hub-scene="lobby"]');
  await expect(page.locator(".bistro-layer")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Bistro decorate mode moves furniture on the server and refuses the kitchen", async ({
  page,
}) => {
  const errors = await openBistro(page);
  await page.click('.bs-rail [data-act="decor"]');
  await expect(page.locator("#bs-edit")).toBeVisible();
  const from = (await B(page, "return b.screen(10, 0, 30)")) as Pt;
  await page.mouse.click(from.x, from.y);
  await expect(page.locator("#bs-edit")).toContainText("Placing: Potted Fern");
  const kitchen = (await B(page, "return b.screen(3, 1)")) as Pt;
  await page.mouse.click(kitchen.x, kitchen.y);
  await expect(page.locator("#bs-edit")).toContainText("Placing");
  const to = (await B(page, "return b.screen(9, 3)")) as Pt;
  await page.mouse.click(to.x, to.y);
  await expect(page.locator("#bs-edit")).toContainText("Decorate");
  await flush(page);
  expect(
    await B(
      page,
      "return srv.S.items.some((i) => i.kind === 'plant' && i.x === 9 && i.y === 3)",
    ),
  ).toBe(true);
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

test("Bistro staff: hire a cook who cooks alone, a report after time away, and the bank", async ({
  page,
}, info) => {
  const errors = await openBistro(page);
  await B(page, "srv.S.level = 2; srv.S.coins = 900; return b.load()");
  await page.click('.bs-rail [data-sheet="staff"]');
  await page.click('#bs-sheet [data-tab="hire"]');
  await page.locator('#bs-sheet [data-hire^="cook:"]').first().click();
  await expect(page.locator("#bs-sheet .role.cook")).toHaveCount(1);
  await flush(page);
  expect(
    await B(page, "return srv.S.staff.filter((s) => s.role === 'cook').length"),
  ).toBe(1);
  // The cook starts their dish on the last stove by themselves.
  await expect
    .poll(() => B(page, "return b.state().stoves[1].dish"))
    .not.toBeNull();
  await page.click("#bs-sheet [data-close]");
  // Three hours away: the server works the two-hour shift.
  await B(page, "srv.S.lastSeen -= 3 * 3600 * 1000; return b.load()");
  await expect(page.locator(".bs-away")).toContainText("While you were away");
  await expect(page.locator(".bs-away")).toContainText("2 h");
  await snap(page, info, "bistro-away");
  await page.click(".bs-away [data-collect]");
  await expect(page.locator("#bs-modal")).toBeHidden();
  // Trade 100 coins for 20 Gold Leaves.
  await B(page, "srv.S.coins = 5000; return b.load()");
  await page.click('.bs-rail [data-sheet="shop"]');
  await page.click('#bs-sheet [data-tab="bank"]');
  await page.click('#bs-sheet [data-trade="1"]');
  await flush(page);
  expect(await B(page, "return srv.extras.leaves")).toBe(1254);
  await expect(page.locator("#account-leaves")).toContainText("1,254");
  expect(errors).toEqual([]);
});

test("Bistro friends: visit a friend's bistro, eat there and like it", async ({
  page,
}, info) => {
  const errors = await openBistro(page);
  const ben = "00000000-0000-4000-8000-000000000672";
  await B(
    page,
    `const R = window.__bistroRules; const v = R.defaultState();
     v.floor = 'wood'; v.wall = 'mint'; v.floors = ['checker', 'wood']; v.walls = ['butter', 'mint']; v.level = 4;
     srv.views['${ben}'] = { ...v, special: 'pho', chef: 'tidefin', likes: 7, now: Date.now(),
       id: '${ben}', name: 'Ben', fighter: 'tidefin', dined: false, liked: false, myDines: 0 };
     srv.friends = [{ id: '${ben}', name: 'Ben', fighter: 'tidefin', level: 4, rating: 3.6, likes: 7,
       served: 120, servings: 6, dined: false, liked: false }];`,
  );
  await page.click('.bs-rail [data-sheet="friends"]');
  await expect(page.locator("#bs-sheet .bs-staff.friend")).toHaveCount(1);
  await page.click(`#bs-sheet [data-visit="${ben}"]`);
  await expect(page.locator("#bs-visit")).toBeVisible();
  await expect(page.locator("#bs-badge")).toContainText("Ben's Bistro");
  await expect(page.locator(".bs-rail")).toBeHidden();
  expect(await B(page, "return b.state().floor")).toBe("wood");
  await page.click('#bs-visit [data-v="dine"]');
  await expect(page.locator("#bs-banner")).toContainText("Delicious");
  await expect(page.locator('#bs-visit [data-v="dine"]')).toBeDisabled();
  await page.click('#bs-visit [data-v="like"]');
  await expect(page.locator('#bs-visit [data-v="like"]')).toContainText(
    "Liked",
  );
  await snap(page, info, "bistro-visit");
  await page.click('#bs-visit [data-v="home"]');
  await expect(page.locator("#bs-visit")).toBeHidden();
  expect(await B(page, "return b.state().floor")).toBe("checker");
  expect(errors).toEqual([]);
});
