import { expect, test, type Page } from "@playwright/test";
import { box, openLobby, snap } from "./helpers";
import { ISLAND, closeSpot, layoutProblems, setInsets } from "./ui-measure";

// UI remodel step 4 (docs/ui-remodel/PLAN.md): Missions, the hub's first
// sheet. The Lobby beside it stays live: the fighter keeps moving, PLAY
// works, and the stage re-centres in the room right of the sheet. Measured
// at the four review sizes with the shared layout rules (ui-measure.ts).
const SIZES = [
  { name: "1440x900", width: 1440, height: 900, phone: false },
  { name: "1280x720", width: 1280, height: 720, phone: false },
  { name: "844x390", width: 844, height: 390, phone: true },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    phone: true,
    island: true,
  },
];
const today = new Date().toISOString().slice(0, 10);
// The server says it is 21:30 in California: new missions in 2 h 30 min,
// whatever this machine's clock says.
const SERVER_TIME = Date.parse("2026-10-18T04:30:00Z");
const MISSIONS = [
  ["play-2", "easy", "Play 2 matches", 2, 2, 40, true],
  ["skills-30", "easy", "Use 30 skills", 18, 30, 40, false],
  ["win-1", "medium", "Win a match", 1, 1, 70, true],
  ["pvp-wins-2", "medium", "Win 2 matches against players", 0, 2, 70, false],
  ["hard-bots-3", "hard", "Beat 3 Hard bots", 1, 3, 120, false],
  ["raid-flawless", "hard", "Clear a raid with no downs", 0, 1, 120, false],
].map(([id, tier, text, progress, target, coins, done], slot) => ({
  day: today,
  slot,
  id,
  tier,
  text,
  progress,
  target,
  coins,
  done,
}));

async function prepare(page: Page) {
  await page.addInitScript(
    ({ missions, serverTime }) => {
      const w = window as any;
      w.__missions = missions;
      w.__serverTime = serverTime;
    },
    { missions: MISSIONS, serverTime: SERVER_TIME },
  );
}
/** The harness has no mission changes: answer them like the server does. */
async function changeServer(page: Page, refuse = false) {
  await page.evaluate((refuse) => {
    const w = window as any;
    w.__changes = [];
    const fetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("/api/missions/reroll")) {
        const { slot } = JSON.parse(String(init?.body ?? "{}"));
        w.__changes.push(slot);
        if (refuse)
          return new Response(
            JSON.stringify({ error: "No mission changes left today." }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        w.__missions = w.__missions.map((m: any) =>
          m.slot === slot
            ? {
                ...m,
                id: "minutes-10",
                text: "Play for 10 minutes",
                progress: 0,
                target: 10,
              }
            : m,
        );
        const economy = await (await fetch("/api/economy")).json();
        return new Response(
          JSON.stringify({
            economy: { ...economy, rerollsUsed: 1, rerollLimit: 5 },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      return fetch(input, init);
    };
  }, refuse);
}

for (const size of SIZES)
  test(`the Missions sheet beside a live Lobby at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(150_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await prepare(page);
      const errors = await openLobby(page);
      const inset = size.island ? ISLAND : undefined;
      if (inset) await setInsets(page, inset);
      const art = "#lobby-fighter-art";
      await expect(page.locator(art)).toHaveClass(/is-ready/, {
        timeout: 60_000,
      });
      await page.click('.lobby-rail [data-lobby-action="missions"]');
      const sheet = page.locator(".missions-sheet");
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveClass(/ui-sheet/);
      await expect(
        page.locator('.lobby-rail [data-lobby-action="missions"]'),
      ).toHaveAttribute("aria-current", "page");
      // Six rows, the countdown from the server's clock, done / six.
      await expect(page.locator(".missions-row")).toHaveCount(6);
      await expect(sheet.locator(".ui-kicker")).toHaveText(
        "Daily · new in 2 h 30 min",
      );
      await expect(sheet.locator(".missions-sum")).toContainText("2/6 done");
      await expect(page.locator(".missions-paid")).toHaveCount(2);
      await expect(page.locator("[data-mission-change]")).toHaveCount(4);
      await expect(page.locator(".missions-streak-days i")).toHaveCount(7);
      expect(await closeSpot(page)).toEqual([
        size.phone
          ? { right: 7, top: 7, size: 32 }
          : { right: 11, top: 11, size: 44 },
      ]);

      // The Lobby beside it: not covered, PLAY usable, the stage (and the
      // fighter in it) right of the sheet and inside the screen.
      await expect(page.locator(".lobby-layer")).not.toHaveClass(/is-covered/);
      await expect(page.locator("#lobby-play")).toBeVisible();
      await expect(page.locator("#lobby-play")).toBeEnabled();
      const s = await box(page, ".missions-sheet");
      const fighter = await box(page, "#lobby-fighter");
      const play = await box(page, ".lobby-play");
      expect(fighter.x).toBeGreaterThanOrEqual(s.x + s.width);
      expect(fighter.x + fighter.width).toBeLessThanOrEqual(
        size.width - (inset?.right ?? 0),
      );
      expect(fighter.width).toBeGreaterThanOrEqual(size.phone ? 120 : 200);
      // The fighter never stands on PLAY.
      expect(
        fighter.y + fighter.height <= play.y + 1 ||
          fighter.x + fighter.width <= play.x + 1,
      ).toBe(true);
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );
      // The last rows and the streak, scrolled to, pass too.
      await page
        .locator(".missions-body")
        .evaluate((e) => e.scrollTo({ top: e.scrollHeight }));
      await expect(page.locator(".missions-streak-row")).toBeInViewport();
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );
      await page
        .locator(".missions-body")
        .evaluate((e) => e.scrollTo({ top: 0 }));
      // The fighter keeps moving behind a sheet (the rig pauses only behind
      // full panels): two pictures a few seconds apart differ.
      const first = await page.locator(art).screenshot();
      await page.waitForTimeout(4000);
      const second = await page.locator(art).screenshot();
      expect(first.equals(second)).toBe(false);
      await snap(page, info, `missions-${size.name}`);

      // A row opens how to complete its mission, and closes again.
      const help = page.locator('[data-mission-help="3"]');
      await help.click();
      await expect(help).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator("#mission-guide-3")).toBeVisible();
      await expect(page.locator("#mission-guide-3")).toContainText(
        "room with no bots",
      );
      await expect(page.locator(".missions-row").nth(3)).toContainText(
        "With others",
      );
      await expect(help).toBeFocused();
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );
      await snap(page, info, `missions-help-${size.name}`);
      await help.click();
      await expect(page.locator("#mission-guide-3")).toBeHidden();

      // Escape leaves; the stage goes back to where it was.
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      await expect(page.locator(".lobby-layer")).not.toHaveAttribute(
        "data-ui-sheet",
        "",
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("changing a mission asks the server and shows its answer", async ({
  page,
}) => {
  await prepare(page);
  const errors = await openLobby(page);
  await changeServer(page);
  await page.click('.lobby-rail [data-lobby-action="missions"]');
  await expect(page.locator(".missions-row")).toHaveCount(6);
  const change = page.locator('[data-mission-change="1"]');
  await change.click();
  await expect(page.locator(".missions-status")).toHaveText(
    "New mission ready.",
  );
  await expect(page.locator(".missions-row").nth(1)).toContainText(
    "Play for 10 minutes",
  );
  await expect(page.locator(".missions-sum")).toContainText("4 changes left");
  expect(await page.evaluate(() => (window as any).__changes)).toEqual([1]);
  // Focus stays on the row that changed.
  await expect(change).toBeFocused();
  expect(errors).toEqual([]);
});

test("a refused change says why and keeps the mission", async ({ page }) => {
  await prepare(page);
  const errors = await openLobby(page);
  await changeServer(page, true);
  await page.click('.lobby-rail [data-lobby-action="missions"]');
  await page.click('[data-mission-change="4"]');
  await expect(page.locator(".missions-status")).toHaveText(
    "No mission changes left today.",
  );
  await expect(page.locator(".missions-row").nth(4)).toContainText(
    "Beat 3 Hard bots",
  );
  await expect(page.locator("[data-mission-change]").first()).toBeEnabled();
  expect(errors).toEqual([]);
});

test("Missions work from the keyboard", async ({ page }) => {
  await prepare(page);
  const errors = await openLobby(page);
  await page.focus('.lobby-rail [data-lobby-action="missions"]');
  await page.keyboard.press("Enter");
  await expect(page.locator(".missions-sheet")).toBeFocused();
  await page.keyboard.press("Tab");
  // Close first (the head), then the first mission.
  await expect(page.locator(".missions-sheet .ui-close")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-mission-help="0"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[data-mission-help="1"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-mission-help="1"]')).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".missions-sheet")).toHaveCount(0);
  // Focus goes back to the rail button that opened it.
  await expect(
    page.locator('.lobby-rail [data-lobby-action="missions"]'),
  ).toBeFocused();
  expect(errors).toEqual([]);
});

test("Missions with reduced motion and Low graphics", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
    await prepare(page);
    const errors = await openLobby(page);
    await page.click('.lobby-rail [data-lobby-action="missions"]');
    await expect(page.locator(".missions-sheet")).toHaveAttribute(
      "data-graphics",
      "low",
    );
    // A still fighter beside the sheet, nothing turning.
    await expect(page.locator("#lobby-fighter-art")).not.toHaveClass(
      /is-ready/,
    );
    const s = await box(page, ".missions-sheet");
    const fighter = await box(page, "#lobby-fighter");
    expect(fighter.x).toBeGreaterThanOrEqual(s.x + s.width);
    await page.evaluate(() =>
      document
        .querySelector('[data-mission-change="1"]')!
        .setAttribute("aria-busy", "true"),
    );
    expect(
      await page
        .locator('[data-mission-change="1"] svg')
        .evaluate((e) => getComputedStyle(e).animationName),
    ).toBe("none");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
