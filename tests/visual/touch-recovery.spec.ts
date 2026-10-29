import { expect, test, type Page } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle } from "./helpers";
async function mount(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/touch-recovery-page", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: `<style>body{margin:0;background:#101a30}.mobile-tools,.rotate-hint{display:none}.touch-pad{display:flex;gap:30px;padding:50px}.joystick-area{width:150px;height:150px;touch-action:none;background:#263554}.joystick-knob{display:block;width:24px;height:24px;background:gold}.touch-buttons{position:relative;width:300px;height:250px}.touch-buttons button{position:absolute;touch-action:none}</style><body></body>`,
    }),
  );
  await page.goto("/touch-recovery-page");
  await page.evaluate(async () => {
    // Synthetic contacts cannot grant trusted gesture focus in WebKit. Model
    // an active page here; the separate trusted-touch test covers focus recovery.
    document.hasFocus = () => true;
    const { touchRecovery } = await import("/touch-recovery.ts");
    touchRecovery();
    // Let the initial ResizeObserver reset finish before a simulated finger
    // begins. WebKit can deliver that first layout after evaluate returns.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  return errors;
}
const state = (page: Page) =>
  page.evaluate(() => {
    const c = (window as any).__touch;
    return {
      id: c.input.joystickPointer,
      dx: c.dx,
      dy: c.dy,
      basic: c.basic,
      held: c.input.pointers.size,
      knob: document.querySelector<HTMLElement>(".joystick-knob")!.style
        .transform,
    };
  });
async function down(page: Page, selector: string, id: number, primary = false) {
  const box = await page.locator(selector).boundingBox();
  await page.dispatchEvent(selector, "pointerdown", {
    pointerId: id,
    pointerType: "touch",
    isPrimary: primary,
    buttons: 1,
    clientX: box!.x + box!.width * 0.85,
    clientY: box!.y + box!.height * 0.5,
  });
}
test("lost capture and releases over disabled skills cannot strand the joystick or held attack", async ({
  page,
}) => {
  const errors = await mount(page);
  // Synthetic contacts cannot take native capture: this also exercises that fallback.
  await down(page, ".joystick-area", 11, true);
  await down(page, '[data-action="attack"]', 12);
  await down(page, '[data-skill="0"]', 13);
  expect(await state(page)).toMatchObject({ id: 11, basic: true, held: 2 });
  await page
    .locator('[data-skill="0"]')
    .evaluate((b: HTMLButtonElement) => (b.disabled = true));
  await page.dispatchEvent("body", "pointerup", {
    pointerId: 13,
    pointerType: "touch",
  });
  expect(await state(page)).toMatchObject({ id: 11, basic: true, held: 1 });
  await page.dispatchEvent("body", "pointerup", {
    pointerId: 12,
    pointerType: "touch",
  });
  expect(await state(page)).toMatchObject({ id: 11, basic: false, held: 0 });
  await page.dispatchEvent("body", "pointermove", {
    pointerId: 11,
    pointerType: "touch",
    buttons: 1,
    clientX: 210,
    clientY: 125,
  });
  expect((await state(page)).dx).toBeGreaterThan(0.5);
  await page.dispatchEvent("body", "pointercancel", {
    pointerId: 11,
    pointerType: "touch",
  });
  expect(await state(page)).toMatchObject({
    id: null,
    dx: 0,
    dy: 0,
    knob: "translate(0px, 0px)",
  });
  await down(page, ".joystick-area", 14, true);
  expect((await state(page)).dx).toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});
test("a fresh primary gesture recovers missed end events and legacy touchend centres every control", async ({
  page,
}) => {
  const errors = await mount(page);
  await down(page, ".joystick-area", 21, true);
  await down(page, '[data-action="attack"]', 22);
  // No terminal event for either contact. A new physical first finger must recover.
  await down(page, ".joystick-area", 23, true);
  expect(await state(page)).toMatchObject({ id: 23, basic: false, held: 0 });
  await page.evaluate(() => {
    // WebKit exposes native TouchEvents but does not construct them from an
    // array in automation; preserve the exact terminal touches contract.
    const end = new Event("touchend", { bubbles: true });
    Object.defineProperty(end, "touches", { value: [] });
    window.dispatchEvent(end);
  });
  expect(await state(page)).toMatchObject({ id: null, dx: 0, dy: 0 });
  await down(page, ".joystick-area", 24, true);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  expect(await state(page)).toMatchObject({ id: null, dx: 0 });
  await down(page, ".joystick-area", 25, true);
  expect((await state(page)).dx).toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});
test("a stationary held finger keeps moving without an inactivity timeout", async ({
  page,
}) => {
  const errors = await mount(page);
  await down(page, ".joystick-area", 31, true);
  const held = await state(page);
  await page.waitForTimeout(1200);
  expect(await state(page)).toEqual(held);
  expect(errors).toEqual([]);
});
test("trusted iOS-style touch recovers visible standalone play even if document focus stays false", async ({
  browser,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "CDP supplies trusted multi-touch contacts",
  );
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "standalone", { value: true }),
    );
    await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
      const response = await route.fetch(),
        body = await response.text();
      const marker = "if (touch.available)";
      expect(body).toContain(marker);
      await route.fulfill({
        response,
        body: body.replace(marker, "window.__touch=touch;" + marker),
      });
    });
    const errors = await openTown(page);
    await page.evaluate(() => (window as any).__room("practice"));
    await openTownMenu(page);
    await page.click(".town-play");
    await page.click("#practice");
    await pushUntilBattle(page);
    await page.evaluate(() => {
      Object.defineProperty(document, "hasFocus", {
        value: () => false,
        configurable: true,
      });
      const w = window as any,
        previous = w.__emit;
      w.__emit = (event: string, data: any) => {
        previous?.(event, data);
        if (event === "input") w.__lastInput = data;
      };
    });
    const box = await page.locator(".joystick-area").boundingBox(),
      x = box!.x + box!.width * 0.8,
      y = box!.y + box!.height * 0.5;
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).__lastInput?.dx ?? 0))
      .toBeGreaterThan(0.4);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).__lastInput?.dx))
      .toBe(0);
    // Opening a real menu revokes the gesture; closing it and touching re-arms play.
    await page.click("#battle-menu");
    await page.click("#close-dialog");
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 2 }],
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).__lastInput?.dx ?? 0))
      .toBeGreaterThan(0.4);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Look away releases outside the button and cannot steal or strand movement", async ({
  page,
}) => {
  const errors = await mount(page);
  await page.evaluate(async () => {
    const { prismRecovery } = await import("/touch-recovery.ts");
    await prismRecovery();
  });
  await down(page, ".joystick-area", 41, true);
  await down(page, "[data-prism-away]", 42);
  expect(await page.evaluate(() => (window as any).__lookingAway())).toBe(true);
  expect((await state(page)).dx).toBeGreaterThan(0.5);
  await page.dispatchEvent("body", "pointerup", {
    pointerId: 42,
    pointerType: "touch",
  });
  expect(await page.evaluate(() => (window as any).__lookingAway())).toBe(
    false,
  );
  expect((await state(page)).dx).toBeGreaterThan(0.5);
  await page.dispatchEvent("body", "pointerup", {
    pointerId: 41,
    pointerType: "touch",
  });
  await down(page, "[data-prism-away]", 43, true);
  // The OS misses the previous release. A new first finger must stop the old hold.
  await down(page, ".joystick-area", 44, true);
  expect(await page.evaluate(() => (window as any).__lookingAway())).toBe(
    false,
  );
  expect((await state(page)).dx).toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});


test("held Basic and movement survive repeated skill, Dash and Jump taps",async({page})=>{
  const errors=await mount(page);
  await down(page,".joystick-area",61,true);
  await down(page,'[data-action="attack"]',62);
  const movement=(await state(page)).dx;
  let pointer=63;
  for(const selector of ['[data-skill="0"]','[data-skill="1"]','[data-skill="2"]','[data-action="dash"]','[data-action="jump"]']) {
    await down(page,selector,pointer);
    await page.dispatchEvent('body','pointerup',{pointerId:pointer++,pointerType:'touch'});
    expect(await state(page)).toMatchObject({id:61,basic:true,held:1,dx:movement});
  }
  expect(await page.evaluate(()=>(window as any).__fired)).toEqual([
    {basic:true},{skill:0},{skill:1},{skill:2},{dash:true},{jump:true},
  ]);
  await page.dispatchEvent('body','pointerup',{pointerId:62,pointerType:'touch'});
  expect(await state(page)).toMatchObject({id:61,basic:false,held:0});
  await page.dispatchEvent('body','pointerup',{pointerId:61,pointerType:'touch'});
  expect(await state(page)).toMatchObject({id:null,dx:0,dy:0,basic:false});
  expect(errors).toEqual([]);
});
