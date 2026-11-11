import { expect, test, type Page } from "@playwright/test";
import { openHub, pushUntilBattle, openPlayPanel } from "./helpers";

// Predicted casts: your own skill starts on the key press, not one network
// round trip later. The offline harness never sends the server's "cast"
// echo unless a test pushes one, so whatever moves the fighter here was the
// client's own prediction.
async function practice(page: Page, character = "voltkit") {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    const marker = "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
    expect(body).toContain(marker);
    await route.fulfill({ response, body: body.replace(marker, "window.__castGame=gameInstance;" + marker) });
  });
  await openHub(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__events = [];
    w.__emit = (event: string, data: unknown) => w.__events.push({ event, data });
  });
  await page.evaluate((character) => (window as any).__room("practice", { arena: "classic", pos: [800, 760, 1300, 200], character }), character);
  await openPlayPanel(page);
  await page.click("#practice");
  await pushUntilBattle(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__snap.phase = "playing";
    w.__snap.remaining = 90;
    const me = w.__snap.players.find((p: any) => p.id === "me");
    me.cooldowns = [0, 0, 0, 0];
    me.recoveryUntil = 0;
    me.basicAt = 0;
    me.statuses = [];
    me.charge = undefined;
    w.__push();
  });
  await page.mouse.move(700, 450);
}
const rig = (page: Page) =>
  page.evaluate(() => {
    const c = (window as any).__castGame.scene.getScene("arena").rigs.get("me").controller;
    return { state: c.state as string, started: c.started as number };
  });

test("a ready skill starts on the press, before the server answers", async ({ page }) => {
  await practice(page);
  await page.keyboard.press("KeyQ");
  await expect.poll(async () => (await rig(page)).state, { timeout: 2000, intervals: [16, 50, 100] }).toBe("skill0");
  // The button answered at once and its cooldown runs.
  await expect(page.locator("#ability-0")).toHaveClass(/cooling/);
  // The press was sent to the server too.
  await expect
    .poll(() => page.evaluate(() => (window as any).__events.some((e: any) => e.event === "input" && e.data.skill === 0)))
    .toBe(true);

  // The server's echo of the same cast does not restart the animation.
  const before = await rig(page);
  await page.evaluate(() => {
    const w = window as any,
      me = w.__snap.players.find((p: any) => p.id === "me");
    w.__snap.events = [{ id: 90001, kind: "cast", owner: "me", abilityId: "static-lance", x: me.x, y: me.y, color: 0xffe18b }];
    me.cooldowns = [w.__snap.time + 8, 0, 0, 0];
    w.__push();
    w.__snap.events = [];
  });
  await page.waitForTimeout(100);
  expect((await rig(page)).started).toBe(before.started);
  // The server's cooldown has taken over from the guess.
  await expect(page.locator("#ability-0")).toHaveClass(/cooling/);
});

test("a skill still cooling shakes its button and does not move the fighter", async ({ page }) => {
  await practice(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__snap.players.find((p: any) => p.id === "me").cooldowns = [0, w.__snap.time + 6, 0, 0];
    w.__push();
  });
  // The flash lasts a quarter second: record it rather than race it.
  await page.evaluate(() => {
    const w = window as any,
      el = document.getElementById("ability-1")!;
    w.__flashes = [];
    new MutationObserver(() => w.__flashes.push(el.className)).observe(el, { attributes: true, attributeFilter: ["class"] });
  });
  await page.keyboard.press("KeyE");
  await expect
    .poll(() => page.evaluate(() => (window as any).__flashes.some((c: string) => c.includes("press-denied"))), { timeout: 3000 })
    .toBe(true);
  await page.waitForTimeout(150);
  expect((await rig(page)).state).not.toBe("skill1");
});

test("a refused prediction ends early instead of playing out", async ({ page }) => {
  await practice(page);
  await page.keyboard.press("KeyQ");
  await expect.poll(async () => (await rig(page)).state, { timeout: 2000, intervals: [16, 50] }).toBe("skill0");
  // No echo ever comes: within the prediction window (about one round trip
  // plus a margin, at most 1.2 s) the move is over.
  await expect.poll(async () => (await rig(page)).state, { timeout: 3000 }).not.toBe("skill0");
});

test("the battle gear shows the round trip to the server", async ({ page }) => {
  await practice(page);
  const badge = page.locator("#battle-menu .ping-badge");
  await expect(badge).toBeVisible({ timeout: 6000 });
  await expect(badge).toHaveText(/^\d+ ms$/);
  // The level follows the measured round trip (this offline test answers
  // at once, but a busy test machine can still be slow).
  await expect(badge).toHaveAttribute("data-level", /^(good|fair|poor)$/);
  await expect
    .poll(() => page.evaluate(() => (window as any).__events.some((e: any) => e.event === "rtt")))
    .toBe(true);
});

/** Record every skill effect played (playCast), with when it started. */
async function countEffects(page: Page) {
  await page.route(/\/apps\/client\/src\/skill-effects\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    const marker = "export function playCast(";
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(
        marker,
        "export function playCast(...a) { (window.__effects ??= []).push(a[1].id); return playCastNow(...a); }\nfunction playCastNow(",
      ),
    });
  });
}
const effects = (page: Page, id: string) =>
  page.evaluate((id) => ((window as any).__effects ?? []).filter((e: string) => e === id).length, id);
const echo = (page: Page, abilityId: string) =>
  page.evaluate((abilityId) => {
    const w = window as any,
      me = w.__snap.players.find((p: any) => p.id === "me");
    w.__snap.events = [{ id: 90100 + Math.floor(Math.random() * 1000), kind: "cast", owner: "me", abilityId, x: me.x, y: me.y, color: 0xffe18b }];
    w.__push();
    w.__snap.events = [];
  }, abilityId);

test("a shot's effect plays on the press, and once only when the server confirms", async ({ page }) => {
  await countEffects(page);
  await practice(page);
  await page.keyboard.press("KeyQ");
  // No server answer yet (this harness sends none): the effect is already up.
  await expect.poll(() => effects(page, "static-lance"), { timeout: 2000, intervals: [16, 50, 100] }).toBe(1);
  await echo(page, "static-lance");
  await page.waitForTimeout(150);
  expect(await effects(page, "static-lance")).toBe(1);
});

test("a move the server places still waits for it (a zone at the aim)", async ({ page }) => {
  await countEffects(page);
  await practice(page, "cindrake");
  await page.keyboard.press("KeyR");
  await expect.poll(async () => (await rig(page)).state, { timeout: 2000, intervals: [16, 50] }).toBe("skill2");
  expect(await effects(page, "heat-cracks")).toBe(0);
  await echo(page, "heat-cracks");
  await expect.poll(() => effects(page, "heat-cracks"), { timeout: 2000 }).toBe(1);
});

