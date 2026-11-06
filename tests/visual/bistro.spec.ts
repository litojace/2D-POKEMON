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

  // Switching tabs keeps the scene behind the other tab, paused.
  await page.click('#hub-scenes [data-hub-scene="lobby"]');
  await expect(page.locator(".bistro-layer")).toHaveCount(1);
  await expect(page.locator(".bistro-layer")).toBeHidden();
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
  // The game's coin pills are hidden here; the bistro's wallet takes their place.
  await expect(page.locator("#account-coins")).toBeHidden();
  await expect(page.locator("#account-leaves")).toBeHidden();
  const wallet = await page.locator("#bs-wallet").boundingBox();
  expect(nav && wallet && nav.x + nav.width <= wallet.x).toBeTruthy();
  for (const sel of ["#bs-badge", ".bs-rail", "#bs-bar", "#bs-wallet"]) {
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
  // At level 2 the cook is the role open to hire.
  await expect(page.locator('#bs-sheet [data-role="cook"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
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

test("Bistro: popularity sets the pace, a full room queues at the door, and Decorate grades the plan", async ({
  page,
}, info) => {
  const errors = await openBistro(page);
  // Rating 3 (18) + charm 8 (2.7) + 2 likes this week (1) = 21.7.
  await expect(page.locator("#bs-chips .pop .pop-ring")).toHaveText("22");
  await expect(page.locator("#bs-chips .pop")).toContainText("Busy");
  await expect(page.locator("#bs-chips .lay")).toContainText("Grade B");
  await page.click("#bs-chips .pop");
  // (Guests keep coming meanwhile, and happy ones raise it.)
  await expect(page.locator("#bs-sheet h2")).toHaveText(
    /^Popularity 2\d · Busy$/,
  );
  await expect(page.locator("#bs-sheet .bs-pop-row")).toHaveCount(4);
  await expect(page.locator("#bs-sheet .bs-pop-fx")).toContainText(
    "can wait at the door",
  );
  await snap(page, info, "bistro-popularity");
  await page.click("#bs-sheet [data-close]");
  // Plenty of food, and more guests than the six seats.
  await B(
    page,
    "srv.S.counter = [{ dish: 'goicuon', servings: 40, perfect: false }, null, null, null]; return b.load()",
  );
  await B(page, "for (let i = 0; i < 12; i++) { b.spawn(); b.advance(0.6); }");
  const states = (await B(
    page,
    "return b.customers().map((c) => c.state)",
  )) as string[];
  expect(states.filter((x) => x === "queue")).toHaveLength(3);
  expect(
    states.filter((x) => ["enter", "seated", "eating"].includes(x)),
  ).toHaveLength(6);
  await B(page, "b.advance(3)");
  await snap(page, info, "bistro-queue");
  // A seat comes free: the head of the queue takes it.
  const head = (await B(
    page,
    "return b.customers().find((c) => c.state === 'queue').id",
  )) as number;
  await B(
    page,
    "const c = b.customers().find((c) => c.state === 'seated' || c.state === 'eating'); b.sync().release(c.id); c.state = 'leave'; c.alpha = 0; b.advance(0.2)",
  );
  expect(
    await B(page, `return b.customers().find((c) => c.id === ${head}).state`),
  ).not.toBe("queue");
  expect(
    await B(
      page,
      "return b.customers().filter((c) => c.state === 'queue').length",
    ),
  ).toBe(2);
  // Decorate: the plan's grade, each seat tinted by the waiter's walk.
  await page.click('.bs-rail [data-act="decor"]');
  await expect(page.locator("#bs-grade")).toContainText("Floor plan B");
  await snap(page, info, "bistro-plan-heat");
  await page.click('#bs-edit [data-ed="done"]');
  expect(errors).toEqual([]);
});

test("Bistro staff: tired staff are fed, litter is swept, a janitor and a friend join the team", async ({
  page,
}, info) => {
  const errors = await openBistro(page);
  await B(
    page,
    `const S = srv.S; S.level = 9; S.coins = 9000; S.trash = 2;
     S.staff[0].energy = 15;
     S.counter = [{ dish: 'pho', servings: 10, perfect: false }, null, null, null];
     srv.friends = [{ id: '00000000-0000-4000-8000-000000000672', name: 'Ben', fighter: 'tidefin', level: 4, rating: 3.6,
       popularity: 31, likes: 7, served: 120, servings: 3, dined: false, liked: false }];
     return b.load()`,
  );
  // The waiter is exhausted, and the server's litter is on the floor.
  await expect.poll(() => B(page, "return b.litter().length")).toBe(2);
  await page.click('.bs-rail [data-sheet="staff"]');
  await expect(page.locator("#bs-sheet .bs-staff .en")).toContainText(
    "Exhausted",
  );
  await snap(page, info, "bistro-staff-tired");
  await page.click("#bs-sheet [data-feed]");
  await expect(page.locator("#bs-sheet .bs-staff .en")).toContainText("Fresh");
  await expect(page.locator("#bs-sheet .bs-staff .acts")).toContainText("Ate");
  await flush(page);
  expect(await B(page, "return srv.S.counter[0].servings")).toBe(9);
  // Sweep a bit of litter by tapping it.
  await page.click("#bs-sheet [data-close]");
  const at = (await B(
    page,
    "const l = b.litter()[0]; return b.screen(l.x, l.y)",
  )) as Pt;
  await page.mouse.click(at.x, at.y);
  await expect.poll(() => B(page, "return b.litter().length")).toBe(1);
  await flush(page);
  expect(await B(page, "return srv.S.trash")).toBe(1);
  // Hire a janitor and a friend.
  await page.click('.bs-rail [data-sheet="staff"]');
  await page.click('#bs-sheet [data-tab="hire"]');
  await page.click('#bs-sheet [data-role="janitor"]');
  await page.locator("#bs-sheet [data-hire]").first().click();
  await page.click('#bs-sheet [data-tab="hire"]');
  await page.click('#bs-sheet [data-role="waiter"]');
  await expect(page.locator("#bs-sheet .bs-item.friend")).toContainText("Ben");
  await page.click("#bs-sheet [data-hirefriend]");
  await flush(page);
  const staff = (await B(
    page,
    "return srv.S.staff.map((x) => x.role + ':' + (x.friend ? x.friend.name : x.char))",
  )) as string[];
  expect(staff).toContain("waiter:Ben");
  expect(staff.some((x) => x.startsWith("janitor:"))).toBe(true);
  await page.click('#bs-sheet [data-tab="team"]');
  await snap(page, info, "bistro-staff-team");
  await page.click("#bs-sheet [data-close]");
  // The janitor sweeps the litter up.
  await B(page, "b.advance(20)");
  await flush(page);
  expect(await B(page, "return srv.S.trash")).toBe(0);
  expect(errors).toEqual([]);
});

test("Bistro recipes: master a dish and level it up, buy at the Market, bring crops from the Farm", async ({
  page,
}, info) => {
  const errors = await openBistro(page);
  await B(
    page,
    `const S = srv.S; S.level = 6; S.coins = 5000;
     S.dishLv = { pho: { lv: 1, mastery: 5 } };
     S.pantry = { flour: 2, herbs: 1 };
     return b.load()`,
  );
  await page.click('.bs-rail [data-sheet="menu"]');
  await expect(page.locator("#bs-sheet header p")).toContainText("Gourmet 0");
  const pho = page.locator('#bs-sheet .bs-dish[data-dish="pho"]');
  await expect(pho).toContainText("Lv 1");
  await expect(pho).toContainText("5/5 batches");
  await snap(page, info, "bistro-recipes");
  await pho.locator("[data-dishup]").click();
  await expect(pho).toContainText("Lv 2");
  await flush(page);
  expect(await B(page, "return srv.S.dishLv.pho")).toEqual({
    lv: 2,
    mastery: 0,
  });
  expect(await B(page, "return srv.S.pantry")).toEqual({ flour: 1, herbs: 0 });
  await expect(page.locator("#bs-sheet header p")).toContainText("Gourmet 2");
  // The pantry: buy one of the Market's first offer, bring flour from the Farm.
  await page.click('#bs-sheet [data-rtab="pantry"]');
  await expect(page.locator("#bs-sheet .bs-pantry")).toBeVisible();
  const first = (await B(
    page,
    "return window.__bistroRules.marketOffers(b.sync().now())[0].id",
  )) as string;
  await page.click(`#bs-sheet [data-market="${first}"]`);
  await page.click('#bs-sheet [data-farm="wheat"]');
  await flush(page);
  expect(await B(page, "return srv.extras.marketBought")).toEqual({
    [first]: 1,
  });
  expect(await B(page, "return srv.extras.farmSent")).toBe(3);
  expect(await B(page, "return srv.S.pantry.flour")).toBe(
    first === "flour" ? 5 : 4,
  );
  await snap(page, info, "bistro-pantry");
  expect(errors).toEqual([]);
});

test("Bistro board: deliver a catering order, a regular's visit, claim the league, buy event decor, open a branch", async ({
  page,
}, info) => {
  const errors = await openBistro(page);
  await B(
    page,
    `const S = srv.S; S.level = 30; S.coins = 20000; S.tokens = 40;
     S.counter = [{ dish: 'goicuon', servings: 12, perfect: false }, null, null, null];
     return b.load()`,
  );
  await expect(page.locator("#bs-board-dot")).toBeVisible();
  await page.click('.bs-rail [data-sheet="board"]');
  await snap(page, info, "bistro-orders");
  await page.click('#bs-sheet [data-order="0"]');
  await flush(page);
  expect(await B(page, "return srv.S.coins")).toBe(20040);
  expect(await B(page, "return srv.S.counter[0].servings")).toBe(8);
  // Mira's first visit: six spring rolls.
  await page.click('#bs-sheet [data-tab="regulars"]');
  await snap(page, info, "bistro-regulars");
  await page.click('#bs-sheet [data-regular="mira"]');
  await flush(page);
  expect(await B(page, "return srv.S.regulars.mira")).toBe(1);
  expect(await B(page, "return srv.S.counter[0].servings")).toBe(2);
  // Last week's league: second place.
  await page.click('#bs-sheet [data-tab="league"]');
  await snap(page, info, "bistro-league");
  const coins = (await B(page, "return srv.S.coins")) as number;
  await page.click("#bs-sheet [data-league]");
  await flush(page);
  expect(await B(page, "return srv.S.coins")).toBe(coins + 1200);
  // The event: a Pumpkin Lantern for 30 tokens.
  await page.click('#bs-sheet [data-tab="event"]');
  await snap(page, info, "bistro-event");
  await page.click('#bs-sheet [data-buy="pumpkin"]');
  await page.click('#bs-edit [data-ed="done"]');
  await flush(page);
  // 40, +5 for the order and +3 for Mira during the event, −30.
  expect(await B(page, "return srv.S.tokens")).toBe(18);
  expect(await B(page, "return srv.S.stored.pumpkin")).toBe(1);
  // A new branch at level 30 (two taps).
  await page.click('.bs-rail [data-sheet="staff"]');
  await page.click('#bs-sheet [data-tab="upgrades"]');
  await page.click("#bs-sheet [data-branch]");
  await page.click("#bs-sheet [data-branch]");
  await flush(page);
  expect(
    await B(page, "return [srv.S.level, srv.S.stars, srv.S.coins]"),
  ).toEqual([1, 1, 500]);
  await expect(page.locator("#bs-badge .stars")).toHaveText("★");
  expect(errors).toEqual([]);
});

test("Bistro: a sheet scrolled down stays there when the server answers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 667, height: 375 });
  const errors = await openBistro(page);
  await B(page, "srv.S.level = 30; srv.S.coins = 5000; return b.load()");
  await B(page, "b.sheet('menu')");
  const list = page.locator("#bs-sheet .bs-dishes");
  await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
  const y = await list.evaluate((el) => el.scrollTop);
  expect(y).toBeGreaterThan(50);
  await list.evaluate((el) => ((el as any).old = true));
  // The server answers with other coins (a guest paid, a level-up cost
  // was spent): the sheet is drawn again, and the list stays put.
  await B(page, "srv.S.coins = 3; return b.load()");
  await expect.poll(() => list.evaluate((el) => !!(el as any).old)).toBe(false);
  expect(await list.evaluate((el) => el.scrollTop)).toBe(y);
  // Another tab and back starts at the top again.
  await page.click('#bs-sheet [data-rtab="pantry"]');
  await page.click('#bs-sheet [data-rtab="dishes"]');
  expect(await list.evaluate((el) => el.scrollTop)).toBe(0);
  expect(errors).toEqual([]);
});

test("Bistro: furniture in the bigger room stays through tab switches, even when one change is refused", async ({
  page,
}) => {
  const errors = await openBistro(page);
  const idle = () =>
    page.waitForFunction(
      () => {
        const s = (window as any).__bistro.sync().snapshot();
        return !s.pending && !s.outbox.length;
      },
      null,
      { timeout: 20_000 },
    );
  const items = (js: string) =>
    B(
      page,
      `return ${js}.items.map((i) => i.kind + '@' + i.x + ',' + i.y).sort()`,
    ) as Promise<string[]>;
  await B(page, "srv.S.level = 12; srv.S.coins = 50000; return b.load()");
  const before = await items("srv.S");
  // A server that turns down the far tiles (as one did before the room grew):
  // only that move is lost, and the rest of the batch still gets through.
  const ok = await B(
    page,
    `srv.refuse = (x) => x.a === 'place' && (x.x > 10 || x.y > 8);
     const s = b.sync();
     return [s.do({ a: 'expand' }), s.do({ a: 'expand' }), s.do({ a: 'expand' }),
       s.do({ a: 'buy', kind: 'plant' }), s.do({ a: 'buy', kind: 'lamp' }),
       s.do({ a: 'place', kind: 'plant', x: 15, y: 10, rot: 0 }),
       s.do({ a: 'place', kind: 'lamp', x: 8, y: 6, rot: 0 })].map((r) => r.ok)`,
  );
  expect(ok).toEqual(Array(7).fill(true));
  await idle();
  await expect(page.locator("#toast")).toHaveText(
    "That change couldn't be saved.",
  );
  expect(await B(page, "return srv.S.sizeLv")).toBe(3);
  expect(await B(page, "return srv.S.stored.plant")).toBe(1);
  expect(await items("srv.S")).toEqual([...before, "lamp@8,6"].sort());
  // The scene shows the server's room: the refused plant is back in storage.
  expect(await items("b.state()")).toEqual(await items("srv.S"));
  // With the server taking it, the plant goes to the far corner…
  await B(
    page,
    "srv.refuse = null; b.sync().do({ a: 'place', kind: 'plant', x: 15, y: 10, rot: 0 })",
  );
  await idle();
  const placed = await items("srv.S");
  expect(placed).toContain("plant@15,10");
  // …and the room is the same after another tab.
  await page.click('#hub-scenes [data-hub-scene="lobby"]');
  await expect(page.locator(".bistro-layer")).toBeHidden();
  await page.click('#hub-scenes [data-hub-scene="bistro"]');
  await expect(page.locator(".bistro-layer")).toBeVisible();
  await idle();
  expect(await items("b.state()")).toEqual(placed);
  expect(await B(page, "return b.state().sizeLv")).toBe(3);
  expect(errors).toEqual([]);
});

test("Bistro: switching tabs keeps the guests as they were, and a reload brings them back", async ({
  page,
}) => {
  const errors = await openBistro(page);
  await B(
    page,
    "for (let i = 0; i < 3; i++) { b.spawn(); b.advance(1.5); } b.advance(6);",
  );
  const ids = (await B(
    page,
    "return b.customers().map((c) => c.id + ':' + c.state)",
  )) as string[];
  expect(ids.length).toBeGreaterThanOrEqual(2);
  // To the Lobby and back: the same guests, where they were.
  await page.click('#hub-scenes [data-hub-scene="lobby"]');
  await expect(page.locator(".bistro-layer")).toBeHidden();
  await page.click('#hub-scenes [data-hub-scene="bistro"]');
  await expect(page.locator(".bistro-layer")).toBeVisible();
  // (The scene keeps running up to the switch: someone walking in may
  // have sat down meanwhile, but nobody starts over or disappears.)
  const order = ["queue", "enter", "seated", "eating", "leave"];
  const after = (await B(
    page,
    "return b.customers().map((c) => c.id + ':' + c.state)",
  )) as string[];
  const split = (x: string) => x.split(":") as [string, string];
  for (const was of ids.filter((x) => !x.endsWith(":leave"))) {
    const [id, state] = split(was);
    const now = after.map(split).find(([i]) => i === id);
    expect(now, `guest ${id}`).toBeTruthy();
    expect(order.indexOf(now![1])).toBeGreaterThanOrEqual(order.indexOf(state));
  }
  await expect(page.locator("body")).toHaveClass(/hub-screen/);
  // Reload the page: the bistro draws at once with its guests.
  const seated = (await B(
    page,
    "return b.customers().filter((c) => c.state === 'seated' || c.state === 'eating').map((c) => c.id)",
  )) as number[];
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  const again = await openLobby(page);
  await fakeBistro(page);
  await page.click('#hub-scenes [data-hub-scene="bistro"]');
  await page.waitForFunction(() => (window as any).__bistro?.customers);
  const back = (await B(
    page,
    "return b.customers().map((c) => c.id)",
  )) as number[];
  for (const id of seated) expect(back).toContain(id);
  expect(errors).toEqual([]);
  expect(again).toEqual([]);
});
