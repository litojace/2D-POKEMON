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
  // Rush hours follow the clock (35 s of every 4 min) and change the pace
  // and the chips: start each test just after one (b.rush() starts one).
  await B(page, "b.calm()");
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

test("Bistro hats sit on the head, not on ears, horns or tails", async ({
  page,
}) => {
  await openBistro(page);
  // Cindrake's horns and flame and Astrabun's ears rise far above their
  // heads: a hat put on the top of the whole drawing floated over them.
  const ids = ["cindrake", "astrabun", "auralynx", "duskveil", "voltkit"];
  for (const id of ids) await B(page, `b.chefAs("${id}")`);
  await page.waitForFunction(
    (list) =>
      list.every((id) => {
        const h = (window as any).__bistro.headOf(id);
        return h.ready && h.headTop > 0;
      }),
    ids,
  );
  const heads = (await B(
    page,
    `return ${JSON.stringify(ids)}.map((id) => [id, b.headOf(id)])`,
  )) as [string, { top: number; headTop: number }][];
  for (const [id, h] of heads) {
    // The head's top is never above the drawing's, and well inside it.
    expect(h.headTop, id).toBeGreaterThanOrEqual(h.top);
    expect(h.headTop, id).toBeLessThan(80);
  }
  const by = Object.fromEntries(heads);
  expect(by.cindrake.headTop - by.cindrake.top).toBeGreaterThan(30);
  expect(by.astrabun.headTop - by.astrabun.top).toBeGreaterThan(30);
});

test("Bistro free stoves call you to cook; their bubble opens them; cooks' stoves don't call", async ({
  page,
}, info) => {
  const errors = await openBistro(page);
  // The two stoves of a new bistro are free: after a moment they call.
  await page.waitForFunction(
    () => (window as any).__bistro.calling().length === 2,
  );
  await snap(page, info, "bistro-stoves-calling");
  // Tapping the bubble (above the stove) opens that stove.
  const x0 = (await B(page, "return b.state().stoves[0].x")) as number;
  const bub = (await B(page, `return b.screen(${x0}, 0, 112)`)) as Pt;
  await page.mouse.click(bub.x, bub.y);
  await expect(page.locator("#bs-sheet")).toContainText(
    "Stove 1: what's cooking?",
  );
  await page.click('#bs-sheet [data-dish="goicuon"]');
  await expect.poll(() => B(page, "return b.calling()")).toEqual([1]);
  // A cook runs the last stove: it doesn't call you.
  await B(
    page,
    `srv.S.level = 5; srv.S.staff.push({ id: 9, char: 'pyranda', role: 'cook', level: 1, dish: 'goicuon' });
     srv.S.coins = 0; srv.S.stoves[0] = { ...srv.S.stoves[0], dish: 'goicuon', start: srv.now(), perfect: false };
     return b.load()`,
  );
  await expect.poll(() => B(page, "return b.calling()")).toEqual([]);
  expect(errors).toEqual([]);
});

test("Bistro a cook's next batch keeps its start when the server answers (a guest's paying, a ping)", async ({
  page,
}) => {
  const errors = await openBistro(page);
  // A cook on the last stove, their batch done in a second.
  await B(
    page,
    `srv.S.level = 5; srv.S.coins = 5000; srv.S.counter = [null, null, null, null];
     srv.S.staff.push({ id: 9, char: 'pyranda', role: 'cook', level: 1, dish: 'goicuon' });
     const i = srv.S.stoves.length - 1;
     srv.S.stoves[i] = { ...srv.S.stoves[i], dish: 'goicuon', start: srv.now() - 9000, dur: 10000, perfect: false };
     return b.load()`,
  );
  const last = "b.state().stoves[b.state().stoves.length - 1]";
  const first = (await B(page, `return ${last}.start`)) as number;
  // The scene's cook plates it and starts the next: when it was done.
  await expect
    .poll(() => B(page, `return ${last}.start`), { timeout: 5000 })
    .not.toBe(first);
  const next = (await B(page, `return ${last}.start`)) as number;
  expect(next).toBe(first + 10000);
  // Seconds later an answer comes (a sale, a ping): the batch stays put.
  await page.waitForTimeout(1500);
  const sent = (await B(page, "return srv.requests.length")) as number;
  await B(page, "b.sync().do({ a: 'sync' }); return b.sync().flush()");
  await expect
    .poll(() => B(page, "return srv.requests.length"))
    .toBeGreaterThan(sent);
  await page.waitForTimeout(300);
  expect(await B(page, `return ${last}.start`)).toBe(next);
  expect(
    await B(page, "return srv.S.stoves[srv.S.stoves.length - 1].start"),
  ).toBe(next);
  expect(errors).toEqual([]);
});

test("Bistro team: grouped and filtered by role; a cook's dishes carry their names", async ({
  page,
}, info) => {
  const errors = await openBistro(page);
  await B(
    page,
    `const S = srv.S; S.level = 12; S.coins = 99999;
     S.staff = [
       { id: 1, char: 'sunbara', role: 'waiter', level: 1, dish: 'goicuon' },
       { id: 2, char: 'pyranda', role: 'cook', level: 1, dish: 'pho' },
       { id: 3, char: 'terradon', role: 'janitor', level: 1, dish: 'goicuon' },
       { id: 4, char: 'lumoth', role: 'cook', level: 1, dish: 'goicuon' },
       { id: 5, char: 'mystowl', role: 'waiter', level: 1, dish: 'goicuon' },
     ];
     return b.load()`,
  );
  await B(page, "b.sheet('staff', 'team')");
  const roles = () =>
    page.locator("#bs-sheet .bs-staff .role:not(.friend)").allTextContents();
  // Cooks first, then waiters, then the janitor, each group headed.
  await expect(page.locator("#bs-sheet .bs-teamhead")).toHaveText([
    "Cooks · 2",
    "Waiters · 2",
    "Janitors · 1",
  ]);
  expect((await roles()).map((r) => r.toLowerCase())).toEqual([
    "cook",
    "cook",
    "waiter",
    "waiter",
    "janitor",
  ]);
  // A cook's dishes: each button names its dish, and the chosen one is named.
  const first = page.locator("#bs-sheet .bs-staff").first();
  await expect(first.locator(".cookdish small")).toContainText("Pho");
  await expect(first.locator('.cookdish [data-cd="2:pho"] span')).toHaveText(
    "Pho",
  );
  await expect(
    first.locator('.cookdish [data-cd="2:goicuon"] span'),
  ).toHaveText("Spring Rolls");
  await first.locator('.cookdish [data-cd="2:goicuon"]').click();
  await expect(first.locator(".cookdish small")).toContainText("Spring Rolls");
  await snap(page, info, "bistro-team-grouped");
  // The filter: waiters only.
  await page.click('#bs-sheet [data-teamrole="waiter"]');
  expect((await roles()).map((r) => r.toLowerCase())).toEqual([
    "waiter",
    "waiter",
  ]);
  await expect(page.locator("#bs-sheet .bs-teamhead")).toHaveCount(0);
  await page.click('#bs-sheet [data-teamrole="all"]');
  await expect(page.locator("#bs-sheet .bs-staff")).toHaveCount(5);
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

test("Bistro decorate: while holding an item a drag pans the room; a drag from the item moves it", async ({
  page,
}) => {
  const errors = await openBistro(page);
  await page.click('.bs-rail [data-act="decor"]');
  const from = (await B(page, "return b.screen(10, 0, 30)")) as Pt;
  await page.mouse.click(from.x, from.y);
  await expect(page.locator("#bs-edit")).toContainText("Placing: Potted Fern");
  // A drag from an empty spot moves the view, places nothing.
  const a = (await B(page, "return b.screen(6, 6)")) as Pt;
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x - 60, a.y - 40, { steps: 6 });
  await page.mouse.up();
  const moved = (await B(page, "return b.screen(6, 6)")) as Pt;
  expect(Math.round(moved.x - a.x)).toBe(-60);
  expect(Math.round(moved.y - a.y)).toBe(-40);
  await expect(page.locator("#bs-edit")).toContainText("Placing: Potted Fern");
  // On a touch screen, a drag that starts on the held item carries it and
  // drops it where it ends (with a mouse it follows the pointer anyway).
  const on = (await B(page, "return b.screen(6, 6)")) as Pt;
  const to = (await B(page, "return b.screen(9, 4)")) as Pt;
  await page.evaluate(
    ([on, to]) => {
      const cv = document.querySelector(".bistro-layer .bs-cv")!;
      const r = cv.getBoundingClientRect();
      const ev = (type: string, x: number, y: number) =>
        cv.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 7,
            pointerType: "touch",
            isPrimary: true,
            bubbles: true,
            clientX: r.left + x,
            clientY: r.top + y,
          }),
        );
      ev("pointerdown", on.x, on.y);
      for (let i = 1; i <= 8; i++)
        ev(
          "pointermove",
          on.x + ((to.x - on.x) * i) / 8,
          on.y + ((to.y - on.y) * i) / 8,
        );
      ev("pointerup", to.x, to.y);
    },
    [on, to],
  );
  await expect(page.locator("#bs-edit")).toContainText("Decorate");
  await flush(page);
  expect(
    await B(
      page,
      "return srv.S.items.some((i) => i.kind === 'plant' && i.x === 9 && i.y === 4)",
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("Bistro decorate: every piece shows a turn (mirrored, or a chair's four ways)", async ({
  page,
}) => {
  const errors = await openBistro(page);
  // Each piece drawn both ways: enough of it differs to see (a round table
  // its salt and pepper, a rug its tassels; a stool its low back).
  const flat = (await page.evaluate(() => {
    const w = window as any;
    const A = w.__bistroArt;
    const px = (k: string, rot: number) => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 200;
      const g = cv.getContext("2d")!;
      g.translate(100, 150);
      A.drawItem(g, k, 0, 0, 0, rot);
      return g.getImageData(0, 0, 200, 200).data;
    };
    const out: string[] = [];
    for (const k of Object.keys(w.__bistroRules.ITEM_BY_KIND)) {
      const n = A.itemTurns(k);
      if (n < 2) out.push(`${k}: ${n} way`);
      const a = px(k, 0);
      for (let r = 1; r < n; r++) {
        const b = px(k, r);
        let solid = 0,
          odd = 0;
        for (let i = 0; i < a.length; i += 4) {
          if (a[i + 3] < 40 && b[i + 3] < 40) continue;
          solid++;
          let d = 0;
          for (let j = 0; j < 4; j++) d += Math.abs(a[i + j] - b[i + j]);
          if (d > 90) odd++;
        }
        if (odd / solid < 0.12)
          out.push(
            `${k} turned ${r}: ${Math.round((odd / solid) * 100)}% differs`,
          );
      }
    }
    return out;
  })) as string[];
  expect(flat).toEqual([]);
  expect(errors).toEqual([]);
});

test("Bistro decorate: the room shows without anyone in it, and a piece goes down where someone stood", async ({
  page,
}) => {
  const errors = await openBistro(page);
  await B(
    page,
    "srv.S.counter = [null, null, null, null]; srv.S.stored = { plant: 1 }; return b.load()",
  );
  await expect
    .poll(() => B(page, "return b.drawnStaff().length"))
    .toBeGreaterThan(0);
  // The waiter stands on a free tile, idle.
  await B(
    page,
    "const w = b.waiters()[0]; w.gx = 6; w.gy = 6; w.path = []; return true",
  );
  await page.click('.bs-rail [data-act="decor"]');
  // Nobody is drawn while decorating: staff, guests, the chef.
  await expect.poll(() => B(page, "return b.drawnStaff().length")).toBe(0);
  await page.click('#bs-edit [data-hold="plant"]');
  const p = (await B(page, "return b.screen(6, 6)")) as Pt;
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator("#bs-edit")).toContainText("Decorate");
  await flush(page);
  expect(
    await B(
      page,
      "return srv.S.items.some((i) => i.kind === 'plant' && i.x === 6 && i.y === 6)",
    ),
  ).toBe(true);
  // The waiter stepped off it, to a free tile.
  const at = (await B(
    page,
    "const w = b.waiters()[0]; return [Math.round(w.gx), Math.round(w.gy)]",
  )) as number[];
  expect(at).not.toEqual([6, 6]);
  await page.click('#bs-edit [data-ed="done"]');
  await expect
    .poll(() => B(page, "return b.drawnStaff().length"))
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("Bistro decorate: pieces turn as they're placed (the ↻ button, R, a right click); a chair faces its table unless turned", async ({
  page,
}, info) => {
  const errors = await openBistro(page);
  await B(
    page,
    "srv.S.stored = { lamp: 2, chair: 1, trophy: 1 }; return b.load()",
  );
  await page.click('.bs-rail [data-act="decor"]');
  const at = async (x: number, y: number) =>
    (await B(page, `return b.screen(${x}, ${y})`)) as Pt;
  const rotate = page.locator("#bs-rotate");
  // A lamp: the round ↻ shows beside it once it's over the floor.
  await page.click('#bs-edit [data-hold="lamp"]');
  let p = await at(6, 6);
  await page.mouse.move(p.x, p.y);
  await expect(rotate).toBeVisible();
  await expect(page.locator('#bs-edit [data-ed="rot"]')).toBeVisible();
  const box = (await rotate.boundingBox())!;
  expect(box.x).toBeGreaterThan(p.x - 10); // beside it, to the right
  expect(box.y + box.height).toBeLessThan(p.y); // and above
  await rotate.click();
  expect(await B(page, "return b.held().rot")).toBe(1);
  await page.mouse.move(p.x, p.y);
  await snap(page, info, "bistro-decor-rotate");
  await page.mouse.click(p.x, p.y);
  // The next from storage keeps the way it faced; a right click turns it back.
  p = await at(9, 3);
  await page.mouse.move(p.x, p.y);
  expect(await B(page, "return b.held().rot")).toBe(1);
  await page.mouse.click(p.x, p.y, { button: "right" });
  expect(await B(page, "return b.held().rot")).toBe(0);
  await expect(page.locator("#bs-edit")).toContainText("Placing: "); // not placed
  await page.mouse.click(p.x, p.y);
  // A chair beside a table faces it on its own; R turns it, and it stays so.
  await page.click('#bs-edit [data-hold="chair"]');
  p = await at(4, 6);
  await page.mouse.move(p.x, p.y);
  expect(await B(page, "return b.held()")).toMatchObject({
    rot: 3,
    turned: false,
  });
  await page.keyboard.press("r");
  expect(await B(page, "return b.held()")).toMatchObject({
    rot: 0,
    turned: true,
  });
  await page.mouse.click(p.x, p.y);
  // A trophy turns too (its plaque goes to the other face).
  await page.click('#bs-edit [data-hold="trophy"]');
  p = await at(2, 7);
  await page.mouse.move(p.x, p.y);
  await expect(rotate).toBeVisible();
  await page.keyboard.press("r");
  expect(await B(page, "return b.held().rot")).toBe(1);
  await page.mouse.click(p.x, p.y);
  await expect(rotate).toBeHidden();
  await flush(page);
  const placed = (await B(
    page,
    "return srv.S.items.filter((i) => ['lamp', 'chair', 'trophy'].includes(i.kind) && i.y >= 3 && i.x !== 8 && !(i.x === 3 && i.y === 5) && !(i.x === 5 && i.y === 5) && !(i.x === 7 && i.y === 7) && !(i.x === 9 && i.y === 7)).map((i) => `${i.kind}@${i.x},${i.y}:${i.rot}`).sort()",
  )) as string[];
  expect(placed).toEqual([
    "chair@4,6:0",
    "lamp@6,6:1",
    "lamp@9,3:0",
    "trophy@2,7:1",
  ]);
  expect(errors).toEqual([]);
});

test("Bistro shop: buy any number at once (typed, or counted with − and +, held down)", async ({
  page,
}) => {
  const errors = await openBistro(page);
  await B(page, "srv.S.coins = 100000; srv.S.stored = {}; return b.load()");
  await page.click('.bs-rail [data-sheet="shop"]');
  await page.click('#bs-sheet [data-tab="decor"]');
  const n = page.locator("#bs-qty-n");
  const minus = page.locator('#bs-sheet [data-qtystep="-1"]');
  const plus = page.locator('#bs-sheet [data-qtystep="1"]');
  await expect(n).toHaveValue("1");
  await expect(minus).toBeDisabled();
  // Typed in: the prices show for that many.
  await n.fill("7");
  await expect(page.locator('#bs-sheet [data-buy="plant"] .pr')).toContainText(
    "×7",
  );
  await expect(n).toBeFocused(); // a redraw keeps the field as it is
  await plus.click();
  await expect(n).toHaveValue("8");
  await minus.click();
  await minus.click();
  await expect(n).toHaveValue("6");
  // Too many or none: the most there is, or one.
  await n.fill("500");
  await n.press("Enter");
  await expect(n).toHaveValue("99");
  await expect(plus).toBeDisabled();
  await n.fill("0");
  await n.press("Enter");
  await expect(n).toHaveValue("1");
  // Held down, + keeps counting.
  const box = (await plus.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect
    .poll(async () => Number(await n.inputValue()), { timeout: 5000 })
    .toBeGreaterThan(4);
  await page.mouse.up();
  const held = Number(await n.inputValue());
  await page.waitForTimeout(600);
  expect(Number(await n.inputValue())).toBe(held); // stops when let go
  // Buy 13 plants at once.
  await n.fill("13");
  await n.press("Enter");
  const coins = (await B(page, "return b.state().coins")) as number;
  await page.click('#bs-sheet [data-buy="plant"]');
  await expect(page.locator("#bs-edit")).toContainText("Placing: Potted Fern");
  expect(await B(page, "return b.state().stored.plant")).toBe(13);
  expect(coins - ((await B(page, "return b.state().coins")) as number)).toBe(
    13 * 120,
  );
  await flush(page);
  expect(await B(page, "return srv.S.stored.plant")).toBe(13);
  expect(errors).toEqual([]);
});

test("Bistro: a waiter takes every tip on a table in one trip", async ({
  page,
}) => {
  const errors = await openBistro(page);
  // No food, no guests: only the two tips this test leaves.
  await B(page, "srv.S.counter = [null, null, null, null]; return b.load()");
  await expect.poll(() => B(page, "return b.customers().length")).toBe(0);
  // Both chairs of the first table (3 and 4) left their coins a while ago.
  expect(await B(page, "return b.tip(3, 20) && b.tip(4, 20)")).toBe(true);
  // How many are left, as it goes: 2, then none (never one).
  const seen = (await page.evaluate(
    () =>
      new Promise<number[]>((done) => {
        const b = (window as any).__bistro;
        const out: number[] = [];
        const t0 = performance.now();
        const id = setInterval(() => {
          const n = b.piles().length;
          if (out[out.length - 1] !== n) out.push(n);
          if (n === 0 || performance.now() - t0 > 15000) {
            clearInterval(id);
            done(out);
          }
        }, 20);
      }),
  )) as number[];
  expect(seen).toEqual([2, 0]);
  expect(errors).toEqual([]);
});

test("Bistro: a server answer (coins coming in) leaves the guests, staff and stoves as they were", async ({
  page,
}) => {
  const errors = await openBistro(page);
  await B(
    page,
    `const S = srv.S; S.level = 8; S.coins = 9000;
     S.counter = [{ dish: 'goicuon', servings: 40, perfect: false }, null, null, null];
     S.staff.push({ id: 9, char: 'pyranda', role: 'cook', level: 1, dish: 'goicuon' });
     return b.load()`,
  );
  // A busy room: guests in their seats.
  await expect
    .poll(
      () =>
        B(
          page,
          "return b.customers().filter((c) => c.state === 'seated' || c.state === 'eating').length",
        ),
      { timeout: 30000 },
    )
    .toBeGreaterThan(1);
  // One stands up, still on their chair (as a guest who just paid does).
  const up = (await B(
    page,
    `const c = b.customers().find((c) => c.state === 'seated' || c.state === 'eating');
     c.state = 'leave'; c.gx = c.seat.chair.x; c.gy = c.seat.chair.y; c.path = [];
     return c.id`,
  )) as number;
  const look = () =>
    page.evaluate(() => {
      const b = (window as any).__bistro;
      return {
        guests: b.customers().map((c: any) => ({
          id: c.id,
          x: c.gx,
          y: c.gy,
          state: c.state,
          sat: c.sat,
          ordered: c.orderedAt,
        })),
        staff: b.waiters().map((w: any) => ({ x: w.gx, y: w.gy })),
        stoves: b.state().stoves.map((s: any) => s.start),
      };
    });
  for (let k = 0; k < 3; k++) {
    const a = await look();
    await B(page, "b.sync().do({ a: 'sync' }); return b.sync().flush()");
    const z = await look();
    const jumped: string[] = [];
    for (const g of z.guests) {
      const o = a.guests.find((x: any) => x.id === g.id);
      if (!o) continue;
      if (Math.hypot(g.x - o.x, g.y - o.y) > 0.6)
        jumped.push(
          `guest ${g.id}${g.id === up ? " (standing on their chair)" : ""} moved`,
        );
      // The room keeps running during the sync: a guest who sits down sets
      // `sat`, and one who orders sets `orderedAt` (from 0). Those are their
      // own steps; a restart is a timer replaced while nothing else changed.
      if (
        g.state === o.state &&
        (g.sat !== o.sat || (o.ordered !== 0 && g.ordered !== o.ordered))
      )
        jumped.push(`guest ${g.id}'s wait started again`);
    }
    z.staff.forEach((w: any, i: number) => {
      const o = a.staff[i];
      if (o && Math.hypot(w.x - o.x, w.y - o.y) > 0.6)
        jumped.push(`waiter ${i} moved`);
    });
    a.stoves.forEach((s: number, i: number) => {
      if (z.stoves[i] !== s) jumped.push(`stove ${i} started again`);
    });
    expect(jumped).toEqual([]);
  }
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
  // (Who queues now: a guest arriving meanwhile, the game still running,
  // isn't one of them.)
  const queued = (await B(
    page,
    "return b.customers().filter((c) => c.state === 'queue').map((c) => c.id)",
  )) as number[];
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
      `return b.customers().filter((c) => c.state === 'queue' && ${JSON.stringify(queued)}.includes(c.id)).length`,
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

test("Bistro Orders button breathes while orders wait for food", async ({
  page,
}) => {
  await openBistro(page);
  await B(
    page,
    `const S = srv.S; S.level = 30; S.counter = [null, null, null, null];
     if (srv.extras.league?.last) srv.extras.league.last.claimed = true;
     return b.load()`,
  );
  // Waiting: a red count of the orders, the button breathing red.
  await expect(page.locator("#bs-board-n")).toBeVisible();
  await expect(page.locator("#bs-board-n")).not.toHaveClass(/\bready\b/);
  await expect(page.locator("#bs-board-n")).toHaveCSS(
    "background-color",
    "rgb(255, 90, 90)",
  );
  await expect(page.locator("#bs-board-btn")).toHaveClass(/\bwaiting\b/);
  await expect(page.locator("#bs-board-btn")).not.toHaveClass(/\bready\b/);
  // The board's tabs count what waits; nothing can be done yet, so no gold.
  await page.click('.bs-rail [data-sheet="board"]');
  const n = await page.locator("#bs-board-n").textContent();
  await expect(page.locator('#bs-sheet [data-tn="orders"]')).toHaveText(n!);
  await expect(page.locator('#bs-sheet [data-tn="orders"]')).not.toHaveClass(
    /\bgo\b/,
  );
  await expect(page.locator('#bs-sheet [data-tn="regulars"]')).toBeVisible();
  await expect(page.locator('#bs-sheet [data-tn="regulars"]')).not.toHaveClass(
    /\bgo\b/,
  );
  // Waiting orders come first, before the empty slots' "A new order".
  await expect(page.locator("#bs-sheet .bs-card").first()).toHaveClass(
    /\bwant\b/,
  );
});

test("Bistro Orders: a clock when one runs out, a ring for the closest, wanted dishes marked, a chime when ready, hand it all over", async ({
  page,
}, info) => {
  const errors = await openBistro(page);
  // The big order (12 Banh Mi, 9 Pho) runs out in a minute; nothing cooked.
  await B(
    page,
    `const S = srv.S; S.level = 30; S.counter = [null, null, null, null];
     if (srv.extras.league?.last) srv.extras.league.last.claimed = true;
     srv.extras.orders[1].expires = b.sync().now() + 60_000;
     return b.load()`,
  );
  // 1. Running out: a blinking clock on the button, and it hurries; the
  // card's time left turns red.
  await expect(page.locator("#bs-board-urg")).toBeVisible();
  await expect(page.locator("#bs-board-btn")).toHaveClass(/\burgent\b/);
  await expect(page.locator("#bs-board-ring")).toBeHidden();
  // 4 and 5. Some Banh Mi cooked: a ring shows how far the closest order is,
  // and the counter marks the dish as wanted.
  await B(
    page,
    "srv.S.counter[0] = { dish: 'banhmi', servings: 3, perfect: false }; return b.load()",
  );
  await expect(page.locator("#bs-board-ring")).toBeVisible();
  const p = Number(
    await page
      .locator("#bs-board-ring")
      .evaluate((e) => (e as HTMLElement).style.getPropertyValue("--p")),
  );
  expect(p).toBeGreaterThan(0);
  expect(p).toBeLessThan(100);
  await expect(page.locator(".bs-slot.wanted")).toHaveCount(1);
  await page.click('.bs-rail [data-sheet="board"]');
  await expect(
    page.locator('#bs-sheet [data-order="1"]').locator("xpath=../.."),
  ).toContainText(/left/);
  await expect(page.locator("#bs-sheet .bs-card .soon")).toHaveCount(1);
  await snap(page, info, "bistro-orders-soon");
  // 2. Spring rolls cooked: the small order and Mira can both be handed
  // over now; it chimes and says so, once.
  await B(
    page,
    "srv.S.counter[2] = { dish: 'goicuon', servings: 12, perfect: false }; return b.load()",
  );
  await expect(page.locator("#toast")).toContainText(
    "2 things are ready to hand over!",
  );
  await expect(page.locator("#bs-board-n")).toHaveClass(/\bready\b/);
  // 3. Two ready: one tap hands both over.
  const all = page.locator("#bs-sheet [data-deliver-all]");
  await expect(all).toContainText("Hand over all ready (2)");
  const coins = (await B(page, "return srv.S.coins")) as number;
  await all.click();
  await flush(page);
  expect(await B(page, "return srv.S.regulars.mira")).toBe(1);
  expect((await B(page, "return srv.S.coins")) as number).toBeGreaterThan(
    coins,
  );
  await expect(page.locator("#bs-sheet [data-deliver-all]")).toHaveCount(0);
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
  // Something can be handed over now: the count turns gold and counts what
  // is ready (here at least Mira), and the button glows gold.
  await expect(page.locator("#bs-board-n")).toBeVisible();
  await expect(page.locator("#bs-board-n")).toHaveClass(/\bready\b/);
  await expect(page.locator("#bs-board-n")).toHaveCSS(
    "background-color",
    "rgb(255, 214, 91)",
  );
  const readyN = Number(await page.locator("#bs-board-n").textContent());
  expect(readyN).toBeGreaterThan(0);
  await expect(page.locator("#bs-board-btn")).toHaveClass(/\bready\b/);
  await page.click('.bs-rail [data-sheet="board"]');
  // Spring rolls on the counter: an order and Mira can be served now.
  await expect(page.locator('#bs-sheet [data-tn="orders"]')).toHaveClass(
    /\bgo\b/,
  );
  await expect(page.locator('#bs-sheet [data-tn="regulars"]')).toHaveClass(
    /\bgo\b/,
  );
  await expect(page.locator("#bs-sheet .bs-card.go")).not.toHaveCount(0);
  await snap(page, info, "bistro-orders");
  await page.click('#bs-sheet [data-order="0"]');
  await flush(page);
  expect(await B(page, "return srv.S.coins")).toBe(20040);
  expect(await B(page, "return srv.S.counter[0].servings")).toBe(8);
  // The big order (12 Banh Mi, 9 Pho) fills as you go: 5 Banh Mi on the
  // counter are put aside, kept from the guests.
  await B(
    page,
    "srv.S.counter[1] = { dish: 'banhmi', servings: 5, perfect: false }; return b.load()",
  );
  const big = page.locator('#bs-sheet [data-order="1"]');
  await expect(big).toHaveText("Put aside");
  await expect(big.locator("xpath=../..")).toContainText("0/12 Banh Mi +5");
  await big.click();
  await expect(page.locator("#toast")).toContainText(
    "Put aside 5 servings for the order",
  );
  await flush(page);
  expect(
    await B(
      page,
      "return [srv.extras.orders[1].filled.banhmi, srv.S.counter[1], srv.S.coins]",
    ),
  ).toEqual([5, null, 20040]);
  await expect(big.locator("xpath=../..")).toContainText("5/12 Banh Mi");
  // Skipping it puts them back on the counter.
  await page.click('#bs-sheet [data-skip="1"]');
  await flush(page);
  expect(await B(page, "return srv.S.counter[1]")).toEqual({
    dish: "banhmi",
    servings: 5,
    perfect: false,
  });
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
  await expect(page.locator("#bs-badge .stars")).toHaveText("★1");
  expect(errors).toEqual([]);
});

test("Bistro: a guest sits over Spring Rolls 10 to 14 s (longer for dearer dishes), so a busy room fills up", async ({
  page,
}) => {
  const errors = await openBistro(page);
  await B(
    page,
    "srv.S.counter = [{ dish: 'goicuon', servings: 20, perfect: false }, null, null, null]; return b.load()",
  );
  // Follow one guest by id: others keep coming, and those who leave drop
  // off the list.
  const id = (await B(
    page,
    "b.spawn(); const c = b.customers().at(-1); return c.id",
  )) as number;
  const state = `const c = b.customers().find((x) => x.id === ${id}); return c ? c.state : 'gone'`;
  // Seated, ordered, served: eating.
  const served = (await B(
    page,
    `for (let i = 0; i < 60; i++) { const c = b.customers().find((x) => x.id === ${id}); if (c?.state === 'eating') return true; b.advance(0.5); } return false`,
  )) as boolean;
  expect(served).toBe(true);
  await B(page, "b.advance(9.5)");
  expect(await B(page, state)).toBe("eating");
  await B(page, "b.advance(5)");
  expect(await B(page, state)).not.toBe("eating");
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
  await expect(page.locator("#bs-sheet .st em.poor")).toHaveCount(0);
  // The server answers with other coins (a level-up cost was spent): the
  // sheet shows it (every dish now out of reach) in place (ui/patch.ts),
  // the same list, and it stays put.
  await B(page, "srv.S.coins = 3; return b.load()");
  await expect(page.locator("#bs-sheet .st em.poor")).not.toHaveCount(0);
  expect(await list.evaluate((el) => !!(el as any).old)).toBe(true);
  expect(await list.evaluate((el) => el.scrollTop)).toBe(y);
  // Another tab and back starts at the top again.
  await page.click('#bs-sheet [data-rtab="pantry"]');
  await page.click('#bs-sheet [data-rtab="dishes"]');
  expect(await list.evaluate((el) => el.scrollTop)).toBe(0);
  expect(errors).toEqual([]);
});

test("Bistro: a guest's coins change a sheet in place, not by drawing it again", async ({
  page,
}) => {
  const errors = await openBistro(page);
  // Pho costs 40: with 30 coins it is out of reach, with 60 it isn't.
  await B(page, "srv.S.level = 3; srv.S.coins = 30; return b.load()");
  for (const kind of ["cook", "menu", "staff", "board"]) {
    await B(page, `b.sheet('${kind}', ${kind === "cook" ? 0 : "undefined"})`);
    await B(page, "srv.S.coins = 30; return b.load()");
    const before = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("#bs-sheet *"));
      els.forEach((e: any) => (e.__kept = true));
      return [els.length, document.querySelector("#bs-sheet")!.innerHTML];
    });
    // A guest pays: the server answers with more coins.
    await B(page, "srv.S.coins = 60; return b.load()");
    const after = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("#bs-sheet *"));
      return [
        els.length,
        els.filter((e: any) => !e.__kept).length,
        document.querySelector("#bs-sheet")!.innerHTML,
      ];
    });
    // Same elements (nothing drawn anew), whatever text or class changed.
    expect([kind, after[0], after[1]]).toEqual([kind, before[0], 0]);
    if (kind === "cook") expect(after[2]).not.toBe(before[1]);
  }
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
  // The kitchen grew a column (x 6): the plant standing at 6,0 went into
  // storage with the refused one.
  expect(await B(page, "return srv.S.stored.plant")).toBe(2);
  expect(await items("srv.S")).toEqual(
    [...before.filter((i) => i !== "plant@6,0"), "lamp@8,6"].sort(),
  );
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

test.describe("on a touch screen", () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  test("Bistro: tapping an empty stove waits for a dish, and a hired cook stands at their stove", async ({
    page,
  }) => {
    const errors = await openBistro(page);
    await B(page, "srv.S.level = 2; srv.S.coins = 900; return b.load()");
    await page.click('.bs-rail [data-sheet="staff"]');
    await page.click('#bs-sheet [data-tab="hire"]');
    await page.locator('#bs-sheet [data-hire^="cook:"]').first().click();
    await page.click("#bs-sheet [data-close]");
    // The cook takes the last stove and starts their dish.
    await expect
      .poll(() => B(page, "return b.state().stoves[1].dish"))
      .not.toBeNull();
    const cook = (await B(
      page,
      "return b.state().staff.find((s) => s.role === 'cook').id",
    )) as number;
    // Everyone on the team is drawn, the cook too.
    await expect.poll(() => B(page, "return b.drawnStaff()")).toContain(cook);
    // A tap on the first stove (yours, empty) opens the dishes, and the
    // click that follows the touch doesn't pick one.
    const stove = (await B(page, "return b.screen(1, 0, 50)")) as Pt;
    await page.touchscreen.tap(stove.x, stove.y);
    await expect(page.locator("#bs-sheet h2")).toContainText("Stove 1");
    await page.waitForTimeout(500);
    await expect(page.locator("#bs-sheet")).toBeVisible();
    expect(await B(page, "return b.state().stoves[0].dish")).toBeNull();
    // Picking a dish is a tap of its own.
    await page.locator('#bs-sheet [data-dish="banhmi"]').tap();
    await expect(page.locator("#bs-sheet")).toBeHidden();
    expect(await B(page, "return b.state().stoves[0].dish")).toBe("banhmi");
    // The cook's stove says who cooks there.
    const theirs = (await B(page, "return b.screen(2, 0, 50)")) as Pt;
    await page.touchscreen.tap(theirs.x, theirs.y);
    await expect(page.locator("#bs-tip")).toContainText("cooks here");
    expect(errors).toEqual([]);
  });
});

test("Bistro stoves: bought in the Shop, placed, moved and swapped on the kitchen's back wall", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openBistro(page);
  await B(page, "srv.S.level = 10; srv.S.coins = 100000; return b.load()");
  const spot = (x: number) =>
    B(page, `return b.screen(${x}, 0, 50)`) as Promise<Pt>;
  const tapSpot = async (x: number) => {
    const p = await spot(x);
    await page.mouse.click(p.x, p.y);
  };
  const stoves = () =>
    B(page, "return srv.S.stoves.map((s) => s.x + ':' + s.model)");
  // The Shop's Kitchen tab: three models, the Dragon Oven from level 16.
  await page.click('.bs-rail [data-sheet="shop"]');
  await page.click('#bs-sheet [data-tab="kitchen"]');
  await expect(page.locator("#bs-sheet [data-stovebuy]")).toHaveCount(3);
  await expect(
    page.locator('#bs-sheet [data-stovebuy="dragon"]'),
  ).toBeDisabled();
  await expect(page.locator("#bs-sheet .bs-note")).toContainText(
    "2 of 4 spots on the back wall",
  );
  await snap(page, info, "bistro-stove-shop");
  // A Steel Range: straight to Decorate, placed on a free spot.
  await page.click('#bs-sheet [data-stovebuy="steel"]');
  await expect(page.locator("#bs-edit")).toContainText("Placing: Steel Range");
  await tapSpot(3);
  await flush(page);
  expect(await stoves()).toEqual(["1:clay", "2:clay", "3:steel"]);
  // A Steel Range costs 8,000.
  expect(await B(page, "return srv.S.coins")).toBe(92000);
  // Moved to the last spot.
  await tapSpot(3);
  await expect(page.locator("#bs-edit")).toContainText("Moving: Steel Range");
  await tapSpot(4);
  await flush(page);
  expect(await stoves()).toEqual(["1:clay", "2:clay", "4:steel"]);
  // A Dragon Oven at level 16, swapped for the Clay Stove at x 1.
  await B(page, "srv.S.level = 16; return b.load()");
  await page.click('#bs-edit [data-ed="shop"]');
  await page.click('#bs-sheet [data-tab="kitchen"]');
  await page.click('#bs-sheet [data-stovebuy="dragon"]');
  await tapSpot(1);
  await flush(page);
  expect(await stoves()).toEqual(["1:dragon", "2:clay", "4:steel"]);
  expect(await B(page, "return srv.S.stoveStore")).toEqual({ clay: 1 });
  // The Clay Stove from storage fills the last free spot.
  await page.click('#bs-edit [data-hold-stove="clay"]');
  await tapSpot(3);
  await flush(page);
  expect(await stoves()).toEqual(["1:dragon", "2:clay", "4:steel", "3:clay"]);
  await page.click('#bs-edit [data-ed="done"]');
  // The Dragon Oven cooks 30% faster than a Clay Stove.
  await B(
    page,
    "return srv.S.stoves.forEach((s) => (s.dish = null)) ?? b.load()",
  );
  const p1 = await spot(1);
  await page.mouse.click(p1.x, p1.y);
  await page.click('#bs-sheet [data-dish="pho"]');
  const p2 = await spot(2);
  await page.mouse.click(p2.x, p2.y);
  await page.click('#bs-sheet [data-dish="pho"]');
  await flush(page);
  const [dragon, clay] = (await B(
    page,
    "return [srv.S.stoves[0].dur, srv.S.stoves[1].dur]",
  )) as number[];
  expect(dragon).toBe(Math.round(clay / 1.3));
  await snap(page, info, "bistro-stoves");
  expect(errors).toEqual([]);
});

test("Bistro items with perks: gadgets, a new table and armchair that seat a guest", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openBistro(page);
  await B(page, "srv.S.level = 12; srv.S.coins = 100000; return b.load()");
  const seats = () =>
    B(page, "return b.state().items.length") as Promise<number>;
  // The Gadgets tab: machines with their perks, cheapest first.
  await page.click('.bs-rail [data-sheet="shop"]');
  await page.click('#bs-sheet [data-tab="machines"]');
  const first = page.locator("#bs-sheet .bs-item").first();
  await expect(first).toContainText("Tip Jar");
  await expect(first).toContainText("+3% tips");
  await expect(page.locator('#bs-sheet [data-buy="piano"]')).toBeDisabled(); // level 15
  await snap(page, info, "bistro-gadgets");
  // A Tip Jar, bought and placed.
  await page.click('#bs-sheet [data-buy="tipjar"]');
  await expect(page.locator("#bs-edit")).toContainText("Placing: Tip Jar");
  const p = (await B(page, "return b.screen(10, 6, 10)")) as Pt;
  await page.mouse.click(p.x, p.y);
  await page.click('#bs-edit [data-ed="done"]');
  await flush(page);
  expect(
    await B(page, "return srv.S.items.some((i) => i.kind === 'tipjar')"),
  ).toBe(true);
  expect(await B(page, "return srv.S.coins")).toBe(100000 - 500);
  // A Garden Table and a Velvet Armchair seat one more guest.
  const before = (await B(
    page,
    "return b.state().items.filter((i) => i.kind === 'chair' || i.kind === 'armchair').length",
  )) as number;
  await B(
    page,
    `const s = b.sync();
     return [s.do({ a: 'buy', kind: 'gardentable' }), s.do({ a: 'buy', kind: 'armchair' }),
       s.do({ a: 'place', kind: 'gardentable', x: 5, y: 8, rot: 0 }),
       s.do({ a: 'place', kind: 'armchair', x: 4, y: 8, rot: 0 })].map((r) => r.ok)`,
  );
  await flush(page);
  const n = await seats();
  expect(n).toBeGreaterThan(0);
  await expect(page.locator("#bs-bar .bs-open b")).toContainText(
    `${before + 1} seats`,
  );
  expect(errors).toEqual([]);
});
