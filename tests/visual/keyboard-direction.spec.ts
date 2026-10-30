import { expect, test } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle } from "./helpers";

// Opposite directions held together: the key pressed last wins. Holding A
// and then pressing D used to cancel to a standstill until A was released.
test("pressing the opposite direction turns at once instead of stopping", async ({ page }) => {
  await openTown(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__events = [];
    w.__emit = (event: string, data: unknown) => w.__events.push({ event, data });
  });
  await page.evaluate(() => (window as any).__room("practice", { arena: "classic", pos: [800, 760, 1300, 200] }));
  await openTownMenu(page);
  await page.click(".town-play");
  await page.click("#practice");
  await pushUntilBattle(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__snap.phase = "playing";
    w.__snap.remaining = 90;
    w.__push();
  });
  await page.mouse.move(700, 450);
  const sent = () =>
    page.evaluate(() =>
      (window as any).__events.filter((e: any) => e.event === "input").map((e: any) => e.data.dx as number),
    );
  const clear = () => page.evaluate(() => ((window as any).__events = []));
  const until = (dx: number) =>
    expect.poll(async () => (await sent()).includes(dx), { timeout: 10_000 }).toBe(true);

  await page.keyboard.down("KeyA");
  await until(-1);
  // Both held: D was pressed last, so the fighter goes right, never stops.
  await page.keyboard.down("KeyD");
  await clear();
  await until(1);
  await page.waitForTimeout(400);
  expect(await sent()).not.toContain(0);
  expect(await sent()).not.toContain(-1);
  // Let go of D while still holding A: left again.
  await page.keyboard.up("KeyD");
  await clear();
  await until(-1);
  await page.keyboard.up("KeyA");
  await clear();
  await until(0);
});
