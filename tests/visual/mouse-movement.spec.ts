import { expect, test, type Page } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle } from "./helpers";

// Controls → Movement → Mouse: the left button walks (hold to steer, click
// to walk to a spot), 1 attacks, 2 3 4 5 cast, the right button dashes, and
// the movement keys do nothing.
async function practice(page: Page, mouse: boolean) {
  if (mouse)
    await page.addInitScript(() => {
      const keys = {
        up: ["KeyW", "ArrowUp"], left: ["KeyA", "ArrowLeft"], down: ["KeyS", "ArrowDown"], right: ["KeyD", "ArrowRight"],
        basic: ["Digit1", null], skill1: ["Digit2", "KeyQ"], skill2: ["Digit3", "KeyE"], skill3: ["Digit4", "KeyR"], skill4: ["Digit5", "KeyF"],
        dash: ["Mouse2", "ShiftLeft"], jump: ["Space", null],
      };
      localStorage.setItem("arena-controls", JSON.stringify({ bindings: keys, cast: "instant", aimAssist: false, move: "mouse" }));
    });
  await openTown(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__events = [];
    w.__emit = (event: string, data: unknown) => w.__events.push({ event, data });
  });
  await page.evaluate(() => (window as any).__room("practice", { arena: "classic", pos: [800, 450, 1300, 200] }));
  await openTownMenu(page);
  await page.click(".town-play");
  await page.click("#practice");
  await pushUntilBattle(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__snap.phase = "playing";
    w.__snap.remaining = 90;
    const me = w.__snap.players.find((p: any) => p.id === "me");
    me.cooldowns = [0, 0, 0, 0];
    me.recoveryUntil = 0;
    me.statuses = [];
    w.__push();
  });
}
const lastInput = (page: Page) =>
  page.evaluate(() => (window as any).__events.filter((e: any) => e.event === "input").at(-1)?.data);
const inputsSince = (page: Page, n: number) =>
  page.evaluate((n) => (window as any).__events.filter((e: any) => e.event === "input").slice(n).map((e: any) => e.data), n);
const inputCount = (page: Page) =>
  page.evaluate(() => (window as any).__events.filter((e: any) => e.event === "input").length);

test("mouse movement: hold to walk toward the cursor; keys 1-5 and the right button act", async ({ page }) => {
  await practice(page, true);
  const box = (await page.locator("#game canvas").boundingBox())!;
  // Hold the left button on the right side of the court: walking right.
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(async () => (await lastInput(page))?.dx ?? 0, { timeout: 8000 }).toBeGreaterThan(0.8);
  // The left button is movement, not a basic attack.
  expect((await lastInput(page)).basic).toBe(false);
  await page.mouse.up();
  // The movement keys do nothing in this mode.
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.keyboard.down("KeyA");
  const n = await inputCount(page);
  await page.waitForTimeout(800);
  expect((await inputsSince(page, n)).every((i: any) => i.dx >= 0)).toBe(true);
  await page.keyboard.up("KeyA");
  // 1 held: basic attacks keep coming.
  await page.keyboard.down("Digit1");
  await expect.poll(async () => (await lastInput(page))?.basic, { timeout: 8000 }).toBe(true);
  await page.keyboard.up("Digit1");
  // 2 casts the first skill, 5 the ultimate slot.
  const m = await inputCount(page);
  await page.keyboard.press("Digit2");
  await expect.poll(async () => (await inputsSince(page, m)).some((i: any) => i.skill === 0), { timeout: 8000 }).toBe(true);
  // The right button dashes.
  const k = await inputCount(page);
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5, { button: "right" });
  await expect.poll(async () => (await inputsSince(page, k)).some((i: any) => i.dash), { timeout: 8000 }).toBe(true);
});

test("a click walks to the spot and stops there", async ({ page }) => {
  await practice(page, true);
  const box = (await page.locator("#game canvas").boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.85, box.y + box.height / 2);
  // Still walking after the button is up.
  await page.waitForTimeout(300);
  await expect.poll(async () => (await lastInput(page))?.dx ?? 0, { timeout: 8000 }).toBeGreaterThan(0.5);
});

test("Controls → Movement switches schemes and their keys", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openTown(page);
  await page.evaluate(() => document.getElementById("settings")!.click());
  await page.click("#open-controls");
  const mouse = page.locator('input[name="move"][value="mouse"]');
  await expect(page.locator('input[name="move"][value="keys"]')).toBeChecked();
  await mouse.check();
  await expect(page.locator('input[name="move"][value="mouse"]')).toBeChecked();
  await expect(page.locator('button.binding[data-action="skill1"][data-slot="0"]')).toHaveText("2");
  await expect(page.locator('button.binding[data-action="basic"][data-slot="0"]')).toHaveText("1");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("arena-controls")!));
  expect(saved.move).toBe("mouse");
  await page.locator('input[name="move"][value="keys"]').check();
  await expect(page.locator('button.binding[data-action="skill1"][data-slot="0"]')).toHaveText("Q");
});
