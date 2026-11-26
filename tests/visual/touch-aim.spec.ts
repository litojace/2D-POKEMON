import { expect, test, type Page } from "@playwright/test";
import {
  openHub,
  openPlayPanel,
  createRoom,
  pushUntilBattle,
  snap,
} from "./helpers";

/**
 * Drag-to-aim on phones (touch-aim.ts, owner 26 Nov 2026): a quick tap on
 * a skill aims automatically, as before; holding shows the guide, a drag
 * aims by hand and casts when the finger lifts; back at the middle or over
 * the cancel spot (the target button's place) lets it go. Skills that never
 * read the aim still fire on the press.
 */

async function mount(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/touch-aim-page", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: `<style>body{margin:0;background:#101a30}.mobile-tools,.rotate-hint{display:none}.touch-pad{display:flex;gap:30px;padding:50px 50px 50px 50px}.joystick-area{width:150px;height:150px;touch-action:none;background:#263554}.joystick-knob{display:block;width:24px;height:24px;background:gold}.touch-buttons{position:relative;width:300px;height:250px;margin-top:60px}.touch-buttons button{position:absolute;touch-action:none}.touch-cancel,.touch-aim-wheel{position:absolute;visibility:hidden}.touch-cancel.is-on,.touch-aim-wheel.is-on{visibility:visible}</style><body></body>`,
    }),
  );
  await page.goto("/touch-aim-page");
  await page.evaluate(async () => {
    document.hasFocus = () => true;
    const { touchRecovery } = await import("/touch-recovery.ts");
    touchRecovery();
    // Static Lance (a line), a zone (a spot), Static Glide (on itself), a
    // storm (an enemy).
    (window as any).__touch.setAims(["line", "point", "self", "target"]);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  return errors;
}

const centre = async (page: Page, selector: string) => {
  const box = (await page.locator(selector).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const pointer = (
  page: Page,
  type: string,
  id: number,
  at: { x: number; y: number },
) =>
  page.dispatchEvent("body", type, {
    pointerId: id,
    pointerType: "touch",
    isPrimary: false,
    buttons: type === "pointerup" ? 0 : 1,
    clientX: at.x,
    clientY: at.y,
  });
async function press(page: Page, selector: string, id: number) {
  const at = await centre(page, selector);
  await page.dispatchEvent(selector, "pointerdown", {
    pointerId: id,
    pointerType: "touch",
    isPrimary: false,
    buttons: 1,
    clientX: at.x,
    clientY: at.y,
  });
  return at;
}
async function dragTo(
  page: Page,
  id: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  for (let i = 1; i <= 5; i++)
    await pointer(page, "pointermove", id, {
      x: from.x + ((to.x - from.x) * i) / 5,
      y: from.y + ((to.y - from.y) * i) / 5,
    });
}
const fired = (page: Page) => page.evaluate(() => (window as any).__fired);
const drag = (page: Page) => page.evaluate(() => (window as any).__touch.drag);

test("a skill held to aim casts on lifting, where it was dragged, and can be cancelled", async ({
  page,
}) => {
  const errors = await mount(page);
  const skill = '[data-skill="0"]';
  // A quick tap: the automatic aim, cast as the finger lifts.
  let at = await press(page, skill, 31);
  expect(await fired(page)).toEqual([]);
  await expect(page.locator(".touch-aim-wheel")).toHaveClass(/is-on/);
  await pointer(page, "pointerup", 31, at);
  expect(await fired(page)).toEqual([{ skill: 0 }]);
  expect(await drag(page)).toBeNull();
  await expect(page.locator(".touch-aim-wheel")).not.toHaveClass(/is-on/);

  // A drag left: the cancel spot takes the target button's place; lifting
  // casts with the drag's direction.
  at = await press(page, skill, 32);
  await dragTo(page, 32, at, { x: at.x - 50, y: at.y });
  await expect(page.locator(".touch-cancel")).toHaveClass(/is-on/);
  await expect(page.locator(".touch-target")).toHaveClass(/is-under-cancel/);
  await pointer(page, "pointerup", 32, { x: at.x - 50, y: at.y });
  expect((await fired(page)).length).toBe(2);
  const d = await drag(page);
  expect(d).toMatchObject({ slot: 0 });
  expect(d.dx).toBeCloseTo(-1, 3);
  expect(d.dy).toBeCloseTo(0, 3);
  expect(d.t).toBeGreaterThan(0.3);
  await expect(page.locator(".touch-cancel")).not.toHaveClass(/is-on/);
  await expect(page.locator(".touch-target")).not.toHaveClass(
    /is-under-cancel/,
  );

  // Out and back to the middle: lifting lets it go.
  at = await press(page, skill, 33);
  await dragTo(page, 33, at, { x: at.x, y: at.y - 50 });
  await dragTo(page, 33, { x: at.x, y: at.y - 50 }, at);
  await expect(page.locator(".touch-aim-wheel")).toHaveClass(/is-cancel/);
  await pointer(page, "pointerup", 33, at);
  expect((await fired(page)).length).toBe(2);

  // Over the cancel spot: red, and lifting lets it go.
  const spot = await centre(page, ".touch-target");
  at = await press(page, '[data-skill="1"]', 34);
  await dragTo(page, 34, at, spot);
  await expect(page.locator(".touch-cancel")).toHaveClass(/is-hot/);
  await pointer(page, "pointerup", 34, spot);
  expect((await fired(page)).length).toBe(2);

  // A contact the system cancels never casts.
  at = await press(page, skill, 35);
  await dragTo(page, 35, at, { x: at.x + 40, y: at.y });
  await page.dispatchEvent("body", "pointercancel", {
    pointerId: 35,
    pointerType: "touch",
  });
  expect((await fired(page)).length).toBe(2);
  await expect(page.locator(".touch-aim-wheel")).not.toHaveClass(/is-on/);

  // WebKit may report the last touchend before the pointerup: the held
  // skill casts then, with its drag, and the late pointerup adds nothing.
  at = await press(page, skill, 37);
  await dragTo(page, 37, at, { x: at.x, y: at.y - 45 });
  await page.evaluate(() => {
    const end = new Event("touchend", { bubbles: true });
    Object.defineProperty(end, "touches", { value: [] });
    window.dispatchEvent(end);
  });
  expect((await fired(page)).length).toBe(3);
  expect((await drag(page)).dy).toBeCloseTo(-1, 3);
  await pointer(page, "pointerup", 37, { x: at.x, y: at.y - 45 });
  expect((await fired(page)).length).toBe(3);
  await expect(page.locator(".touch-aim-wheel")).not.toHaveClass(/is-on/);

  // A skill on itself fires on the press, before the finger lifts.
  at = await press(page, '[data-skill="2"]', 36);
  expect((await fired(page)).at(-1)).toEqual({ skill: 2 });
  await pointer(page, "pointerup", 36, at);
  expect((await fired(page)).length).toBe(4);
  expect(errors).toEqual([]);
});

test("the stick and a held basic attack go on while a skill is dragged", async ({
  page,
}) => {
  const errors = await mount(page);
  const stick = page.locator(".joystick-area");
  // Faint at rest, bright under the thumb.
  await expect(stick).not.toHaveClass(/is-held/);
  const home = await centre(page, ".joystick-area");
  await page.dispatchEvent(".joystick-area", "pointerdown", {
    pointerId: 41,
    pointerType: "touch",
    isPrimary: true,
    buttons: 1,
    clientX: home.x,
    clientY: home.y,
  });
  await expect(stick).toHaveClass(/is-held/);
  await pointer(page, "pointermove", 41, { x: home.x + 60, y: home.y });
  await press(page, '[data-action="attack"]', 42);
  const at = await press(page, '[data-skill="0"]', 43);
  await dragTo(page, 43, at, { x: at.x, y: at.y + 40 });
  const held = await page.evaluate(() => {
    const c = (window as any).__touch;
    return { dx: c.dx, basic: c.basic, held: c.input.pointers.size };
  });
  expect(held.dx).toBeGreaterThan(0.5);
  expect(held).toMatchObject({ basic: true, held: 2 });
  await pointer(page, "pointerup", 43, { x: at.x, y: at.y + 40 });
  expect(await fired(page)).toEqual([{ basic: true }, { skill: 0 }]);
  expect(await page.evaluate(() => (window as any).__touch.basic)).toBe(true);
  await page.dispatchEvent("body", "pointerup", {
    pointerId: 41,
    pointerType: "touch",
  });
  await expect(stick).not.toHaveClass(/is-held/);
  expect(errors).toEqual([]);
});

test("a button an enemy stands behind fades, and comes back", async ({
  page,
}) => {
  const errors = await mount(page);
  const at = await centre(page, '[data-skill="1"]');
  await page.evaluate(
    ([x, y]) => (window as any).__touch.setCovered([x], [y], 1),
    [at.x, at.y],
  );
  await expect(page.locator('[data-skill="1"]')).toHaveClass(/is-behind/);
  await expect(page.locator('[data-skill="0"]')).not.toHaveClass(/is-behind/);
  await page.evaluate(() => (window as any).__touch.setCovered([], [], 0));
  await expect(page.locator('[data-skill="1"]')).not.toHaveClass(/is-behind/);
  expect(errors).toEqual([]);
});

/** The phones the battle is checked on, with their safe areas. */
const PHONES = [
  { name: "667x375", width: 667, height: 375, inset: [0, 0, 0] },
  { name: "844x390", width: 844, height: 390, inset: [47, 47, 21] },
  { name: "852x393-island", width: 852, height: 393, inset: [59, 59, 21] },
];

for (const phone of PHONES)
  test(`dragging a skill in a battle aims it there at ${phone.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: phone.width, height: phone.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    try {
      const page = await context.newPage();
      await page.addInitScript(([left, right, bottom]) => {
        const w = window as any;
        w.__inputs = [];
        w.__emit = (event: string, input: any) => {
          if (event === "input")
            w.__inputs.push({ ...input, at: performance.now() });
        };
        const set = () => {
          for (const [k, v] of Object.entries({ left, right, bottom, top: 0 }))
            document.documentElement.style.setProperty(`--safe-${k}`, `${v}px`);
        };
        if (document.documentElement) set();
        document.addEventListener("DOMContentLoaded", set);
      }, phone.inset);
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("pvp", { mode: "ffa", phase: "playing" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      // Mid-round: the round must not end while the test drags.
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.remaining = 95;
        w.__push();
      });
      await page.waitForTimeout(200);
      await snap(page, info, `touch-aim-rest-${phone.name}`);
      const me = await page.evaluate(() => {
        const p = (window as any).__snap.players.find(
          (q: any) => q.id === "me",
        );
        return { x: p.x, y: p.y };
      });
      const cdp = await context.newCDPSession(page);
      const touch = (type: string, points: { x: number; y: number }[]) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: points.map((p, i) => ({
            x: p.x,
            y: p.y,
            id: i + 1,
            radiusX: 4,
            radiusY: 4,
            force: 1,
          })),
        });
      const lance = await centre(page, '#mobile-controls [data-skill="0"]');
      const left = { x: lance.x - 55, y: lance.y + 4 };
      await page.evaluate(() => ((window as any).__inputs = []));
      await touch("touchStart", [lance]);
      for (let i = 1; i <= 6; i++)
        await touch("touchMove", [
          {
            x: lance.x + ((left.x - lance.x) * i) / 6,
            y: lance.y + ((left.y - lance.y) * i) / 6,
          },
        ]);
      await page.evaluate(() => (window as any).__push());
      await page.waitForTimeout(250);
      // Held: the drag circle, the cancel spot, and the guide on the court.
      await expect(
        page.locator("#mobile-controls .touch-aim-wheel"),
      ).toHaveClass(/is-on/);
      await expect(page.locator("#mobile-controls .touch-cancel")).toHaveClass(
        /is-on/,
      );
      await snap(page, info, `touch-aim-drag-${phone.name}`);
      // Nothing is cast while the finger is down.
      expect(
        await page.evaluate(() =>
          (window as any).__inputs.filter((i: any) => i.skill === 0),
        ),
      ).toEqual([]);
      await touch("touchEnd", []);
      await page.waitForTimeout(150);
      const cast = await page.evaluate(() =>
        (window as any).__inputs.filter((i: any) => i.skill === 0),
      );
      expect(cast).toHaveLength(1);
      // Left of the fighter, where the finger went (the enemies are not),
      // the skill's whole range or the court's edge.
      expect(cast[0].aimX).toBeLessThanOrEqual(Math.max(0, me.x - 200));
      expect(Math.abs(cast[0].aimY - me.y)).toBeLessThan(200);
      // The next inputs keep that aim while a buffered or winding-up cast
      // could still read it.
      const kept = await page.evaluate(
        (seq) =>
          (window as any).__inputs.filter((i: any) => i.seq > seq).slice(0, 3),
        cast[0].seq,
      );
      for (const i of kept)
        expect(i.aimX).toBeLessThanOrEqual(Math.max(0, me.x - 200));

      // Over the cancel spot: red, and nothing is cast.
      const spot = await centre(page, "#mobile-controls .touch-target");
      await page.evaluate(() => ((window as any).__inputs = []));
      await touch("touchStart", [lance]);
      for (let i = 1; i <= 6; i++)
        await touch("touchMove", [
          {
            x: lance.x + ((spot.x - lance.x) * i) / 6,
            y: lance.y + ((spot.y - lance.y) * i) / 6,
          },
        ]);
      await expect(page.locator("#mobile-controls .touch-cancel")).toHaveClass(
        /is-hot/,
      );
      await snap(page, info, `touch-aim-cancel-${phone.name}`);
      await touch("touchEnd", []);
      await page.waitForTimeout(150);
      expect(
        await page.evaluate(() =>
          (window as any).__inputs.filter((i: any) => i.skill >= 0),
        ),
      ).toEqual([]);

      // A quick tap: the automatic aim, at the nearest enemy, as before.
      await page.waitForTimeout(500);
      await page.evaluate(() => ((window as any).__inputs = []));
      await touch("touchStart", [lance]);
      await touch("touchEnd", []);
      await page.waitForTimeout(150);
      const tap = await page.evaluate(() =>
        (window as any).__inputs.find((i: any) => i.skill === 0),
      );
      expect(tap).toBeTruthy();
      const nearest = await page.evaluate(
        ([x, y]) =>
          (window as any).__snap.players
            .filter((q: any) => q.id !== "me" && q.hp > 0)
            .map((q: any) => Math.hypot(q.x - x, q.y - y))
            .sort((a: number, b: number) => a - b)[0],
        [me.x, me.y],
      );
      expect(
        Math.abs(Math.hypot(tap.aimX - me.x, tap.aimY - me.y) - nearest),
      ).toBeLessThan(40);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
