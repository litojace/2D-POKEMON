import { expect, test, type Page } from "@playwright/test";
import {
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
  startPractice,
} from "./helpers";

// The first match's coach (battle-coach.ts): a new player's match against a
// bot shows one line at a time (move, attack, skill, dash, the goal), each
// gone when the player does it; it ends with the match.
async function newPlayer(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__economyPatch = {
      journey: {
        xp: 0,
        recent: [],
        season: {
          id: "2026-10",
          xp: 0,
          week: "2026-W43",
          goals: {},
          completed: [],
        },
        unlocked: [],
      },
    };
    w.__accountPatch = { title: null, titleColor: null };
  });
}
/** A practice room made into a match against a bot (the harness has no bot). */
async function botMatch(page: Page) {
  await page.evaluate(() => (window as any).__room("practice"));
  await openPlayPanel(page);
  await startPractice(page);
  await page.evaluate(() => {
    const w = window as any;
    delete w.__snap.practice;
    w.__snap.vsBot = "easy";
  });
  await pushUntilBattle(page);
}
const coach = (page: Page) => page.locator("#battle-coach");
const step = (page: Page) => coach(page).getAttribute("data-step");
/** Keep snapshots coming so the game loop reads the keys. */
async function until(page: Page, want: string) {
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__push());
        return step(page);
      },
      { timeout: 15_000 },
    )
    .toBe(want);
}

test("the first match against a bot teaches the controls (1440x900)", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newPlayer(page);
  const errors = await openHub(page);
  await botMatch(page);
  await expect(coach(page)).toBeVisible();
  await expect(coach(page)).toHaveAttribute("data-step", "move");
  await expect(coach(page)).toContainText("W A S D");
  // Inside the court, clear of the HUD, the fighters' starting names and
  // the skill buttons, and never in the way of a tap.
  const line = (await coach(page).boundingBox())!,
    hud = (await page.locator("#hud").boundingBox())!,
    skills = (await page.locator("#abilities").boundingBox())!,
    court = (await page.locator("#battle .arena-frame").boundingBox())!;
  expect(line.y).toBeGreaterThanOrEqual(hud.y + hud.height - 1);
  expect(line.y + line.height).toBeLessThanOrEqual(skills.y);
  expect(line.x).toBeGreaterThanOrEqual(court.x);
  expect(line.x + line.width).toBeLessThanOrEqual(court.x + court.width);
  for (const plate of await page.locator(".player-nameplate").all()) {
    const r = await plate.boundingBox();
    if (r)
      expect(
        r.y + r.height <= line.y || line.y + line.height <= r.y,
        "a fighter's name under the coach",
      ).toBe(true);
  }
  expect(
    await coach(page).evaluate((el) => getComputedStyle(el).pointerEvents),
  ).toBe("none");
  await snap(page, info, "coach-move-1440");

  await page.keyboard.down("KeyD");
  await until(page, "attack");
  await page.keyboard.up("KeyD");
  const canvas = (await page.locator("#game canvas").boundingBox())!;
  await page.mouse.move(
    canvas.x + canvas.width * 0.6,
    canvas.y + canvas.height / 2,
  );
  await page.mouse.down();
  await until(page, "skill");
  await page.mouse.up();
  await page.keyboard.down("Digit1");
  await page.waitForTimeout(150);
  await page.keyboard.up("Digit1");
  await until(page, "dash");
  await page.keyboard.press("Space");
  await until(page, "goal");
  await expect(coach(page)).toContainText("Win 3 rounds");
  await snap(page, info, "coach-goal-1440");

  // The match ends: the coach goes with it.
  await page.evaluate(() => {
    const w = window as any;
    Object.assign(w.__snap, {
      phase: "finished",
      matchId: "coach-test",
      winner: "me",
      scores: { me: 3 },
    });
    w.__push();
  });
  await expect(coach(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the coach speaks touch on a phone (844x390)", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await newPlayer(page);
    const errors = await openHub(page);
    await botMatch(page);
    await expect(coach(page)).toContainText("Drag the left side");
    const line = (await coach(page).boundingBox())!;
    expect(line.x).toBeGreaterThanOrEqual(0);
    expect(line.x + line.width).toBeLessThanOrEqual(844);
    expect(
      await coach(page).evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await snap(page, info, "coach-move-844");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("an older account's bot match has no coach", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await openHub(page);
  await botMatch(page);
  await page.waitForTimeout(500);
  await expect(coach(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});
