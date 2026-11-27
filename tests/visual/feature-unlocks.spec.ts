import { expect, test, type Page } from "@playwright/test";
import { openHub, skipTour, snap } from "./helpers";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

// Features that open by level (feature-unlocks.ts): a new player's Lobby
// shows every button, the side systems with a padlock and the level that
// opens them; a tap says when; a level that opens one shows the "Unlocked"
// sheet once; an older account sees no padlocks at all.
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
/** Total XP at the start of each level (packages/shared/src/journey.ts). */
const XP = { 1: 0, 2: 100, 3: 225, 4: 375, 5: 550, 6: 750 } as const;
async function playerAt(
  page: Page,
  level: keyof typeof XP,
  o: { matches?: number; seen?: number } = {},
) {
  await skipTour(page);
  await page.addInitScript(
    ({ xp, matches, seen, account }) => {
      const w = window as any;
      w.__economyPatch = {
        journey: {
          xp,
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
      w.__progress = {
        matches,
        wins: 0,
        fighters: {},
        achievements: [],
        season: { id: "2026-10", matches: 0, wins: 0 },
      };
      try {
        if (seen && localStorage.getItem(`arena-unlocks:${account}`) === null)
          localStorage.setItem(`arena-unlocks:${account}`, String(seen));
      } catch {
        /* No storage. */
      }
    },
    { xp: XP[level], matches: o.matches ?? 0, seen: o.seen, account: ACCOUNT },
  );
}
type Box = { x: number; y: number; width: number; height: number };
const within = (inner: Box, outer: Box, slack = 0.5) =>
  inner.x >= outer.x - slack &&
  inner.y >= outer.y - slack &&
  inner.x + inner.width <= outer.x + outer.width + slack &&
  inner.y + inner.height <= outer.y + outer.height + slack;

const SIZES = [
  { width: 667, height: 375, phone: true },
  { width: 844, height: 390, phone: true },
  {
    width: 852,
    height: 393,
    phone: true,
    inset: { left: 59, right: 59, bottom: 21, top: 0 },
  },
  { width: 1440, height: 900, phone: false },
];
for (const size of SIZES) {
  const name = `${size.width}x${size.height}${size.inset ? "-notch" : ""}`;
  test(`a new player's Lobby shows what is still locked, and when it opens (${name})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await playerAt(page, 1);
      const errors = await openHub(page);
      if (size.inset) {
        await page.evaluate((inset) => {
          for (const [key, value] of Object.entries(inset))
            document.documentElement.style.setProperty(
              `--safe-${key}`,
              `${value}px`,
            );
        }, size.inset);
        await page.waitForTimeout(100);
      }
      const rail = (action: string) =>
        page.locator(`.lobby-rail [data-lobby-action="${action}"]`);
      // The side systems wear the padlock with their level; playing,
      // fighters and friends never do.
      for (const [action, level] of [
        ["raids", 2],
        ["missions", 3],
        ["shop", 5],
        ["ranks", 6],
      ] as const) {
        await expect(rail(action)).toHaveClass(/is-locked/);
        await expect(rail(action).locator(".feature-lock")).toHaveText(
          `Lv ${level}`,
        );
        await expect(rail(action)).toHaveAttribute(
          "aria-label",
          new RegExp(`opens at level ${level}$`),
        );
        // The pill sits inside its button, where the icon was: on a phone's
        // rail (icons over names) centred over the name; on the desktop's
        // text rail centred on the icons' column, clear of the name, which
        // starts where every other name does.
        const b = (await rail(action).boundingBox())!,
          pill = (await rail(action).locator(".feature-lock").boundingBox())!,
          name = (await rail(action).locator(":scope > span").boundingBox())!,
          icon = (await rail("fighters")
            .locator(".lobby-rail-icon")
            .boundingBox())!,
          names = (await rail("fighters")
            .locator(":scope > span")
            .boundingBox())!;
        expect(within(pill, b), `${action}'s pill inside its button`).toBe(
          true,
        );
        if (size.phone)
          expect(
            Math.abs(pill.x + pill.width / 2 - (b.x + b.width / 2)),
            `${action}'s pill centred`,
          ).toBeLessThanOrEqual(1);
        else {
          expect(
            Math.abs(pill.x + pill.width / 2 - (icon.x + icon.width / 2)),
            `${action}'s pill centred on the icons' column`,
          ).toBeLessThanOrEqual(1);
          expect(
            name.x - (pill.x + pill.width),
            `${action}'s pill clear of its name`,
          ).toBeGreaterThanOrEqual(4);
          expect(
            Math.abs(name.x - names.x),
            `${action}'s name starts where the others do`,
          ).toBeLessThanOrEqual(1);
          expect(
            name.x + name.width,
            `${action}'s name inside its button`,
          ).toBeLessThanOrEqual(b.x + b.width + 0.5);
        }
        // Still a finger tall.
        expect(b.height).toBeGreaterThanOrEqual(size.height < 380 ? 40 : 44);
      }
      for (const action of ["fighters", "friends"])
        await expect(rail(action)).not.toHaveClass(/is-locked/);
      // The Plaza's tab: locked, its pill inside the switch.
      const plaza = page.locator('#hub-scenes [data-hub-scene="plaza"]');
      await expect(plaza).toHaveClass(/is-locked/);
      await expect(plaza.locator(".feature-lock")).toHaveText("Lv 4");
      // Its pill rides the tab's corner: on screen, on the tab's right
      // half (clear of the Lobby tab), and the switch keeps its place
      // between the player card and the coins.
      const scenes = (await page.locator("#hub-scenes").boundingBox())!,
        profile = (await page.locator("#account-profile").boundingBox())!,
        coins = (await page.locator("#account-coins > *").boundingBox())!,
        tab = (await plaza.boundingBox())!,
        tabPill = (await plaza.locator(".feature-lock").boundingBox())!;
      expect(tabPill.y).toBeGreaterThanOrEqual(0);
      expect(tabPill.x).toBeGreaterThanOrEqual(tab.x);
      expect(tabPill.x + tabPill.width).toBeLessThanOrEqual(coins.x - 4);
      expect(scenes.x).toBeGreaterThanOrEqual(profile.x + profile.width);
      expect(scenes.x + scenes.width).toBeLessThanOrEqual(coins.x);
      // The Missions card says when it opens, in full.
      const card = page.locator("#lobby-missions-card");
      await expect(card).toContainText("Opens at Lv 3");
      expect(
        await card
          .locator("b")
          .evaluate((el) => el.scrollWidth - el.clientWidth),
      ).toBeLessThanOrEqual(1);
      // A first match is one round, and the mode says so.
      await expect(page.locator("#lobby-mode")).toContainText(
        "Learning · one round",
      );
      await snap(page, info, `locks-lobby-${name}`);

      // A tap on a locked button says when it opens, and opens nothing.
      await rail("raids").click();
      await expect(page.locator("#toast")).toContainText(
        "Boss Raids open at Lv 2",
      );
      await expect(page.locator(".ui-panel")).toHaveCount(0);
      await snap(page, info, `locks-toast-${name}`);
      await plaza.click();
      await expect(page.locator("#toast")).toHaveText(
        "The Plaza opens at Lv 4",
      );
      // One line, clear of the player card and the coins.
      const toast = (await page.locator("#toast").boundingBox())!;
      expect(toast.height).toBeLessThanOrEqual(44);
      await expect(page.locator("#lobby-play")).toBeVisible();
      await expect(
        page.locator('#hub-scenes [data-hub-scene="lobby"]'),
      ).toHaveAttribute("aria-pressed", "true");

      // The mode menu: Boss Raid is listed with its padlock and can't be
      // picked; the bots are open.
      await page.click("#lobby-mode");
      const raid = page.locator('#lobby-mode-menu [data-lobby-mode="raid"]');
      await expect(raid).toHaveClass(/is-locked/);
      await expect(raid.locator(".feature-lock")).toHaveText("Lv 2");
      expect(
        within(
          (await raid.locator(".feature-lock").boundingBox())!,
          (await raid.boundingBox())!,
        ),
      ).toBe(true);
      // Its row is as tall as an open mode's (the name stays on one line).
      expect((await raid.boundingBox())!.height).toBeLessThanOrEqual(
        (await page
          .locator('#lobby-mode-menu [data-lobby-mode="duel"]')
          .boundingBox())!.height + 1,
      );
      await snap(page, info, `locks-modes-${name}`);
      await raid.click();
      await expect(page.locator("#toast")).toContainText(
        "Boss Raids open at Lv 2",
      );
      await expect(page.locator("#lobby-mode")).toContainText("Easy");

      // Getting started: the boss step shows the padlock where Go was.
      await page.locator("#lobby-journey-card").click();
      const sheet = page.locator("[data-guide]");
      await expect(sheet.locator('[data-guide-go="bot"]')).toBeVisible();
      await expect(sheet.locator('[data-guide-go="raid"]')).toHaveCount(0);
      await expect(
        sheet.locator(".guide-step").nth(1).locator(".feature-lock"),
      ).toHaveText("Lv 2");
      await snap(page, info, `locks-guide-${name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test(`the first win's level shows what it unlocked, once (${name})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      // This browser last saw the account at Lv 1; it is Lv 2 now.
      await playerAt(page, 2, { matches: 1, seen: 1 });
      const errors = await openHub(page);
      const sheet = page.locator("[data-ui-confirm] .ui-modal");
      await expect(sheet).toBeVisible();
      await expect(sheet.locator(".ui-kicker")).toHaveText("Level 2");
      await expect(sheet.locator(".ui-title")).toHaveText(
        "Unlocked: Boss Raids",
      );
      await expect(sheet.locator(".unlock-sub")).toContainText("Fight a boss");
      await expect(sheet.locator(".ui-ledger")).toContainText(
        "Daily Missions · Lv 3",
      );
      // The whole dialog is on screen, nothing scrolls sideways.
      const box = (await sheet.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(size.inset?.left ?? 0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(
        size.width - (size.inset?.right ?? 0),
      );
      expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      expect(
        await sheet.evaluate((el) => el.scrollWidth - el.clientWidth),
      ).toBeLessThanOrEqual(1);
      await snap(page, info, `unlock-sheet-${name}`);
      // Raids are open now; the next one still wears its padlock, and the
      // second match is first to two.
      await expect(
        page.locator('.lobby-rail [data-lobby-action="raids"]'),
      ).not.toHaveClass(/is-locked/);
      await expect(
        page.locator('.lobby-rail [data-lobby-action="missions"]'),
      ).toHaveClass(/is-locked/);
      await expect(page.locator("#lobby-mode small")).toContainText(
        "best of 3",
      );

      // Open goes to the feature.
      await sheet.locator("[data-ui-confirm-ok]").click();
      await expect(page.locator("[data-ui-confirm]")).toHaveCount(0);
      await expect(
        page.locator(".ui-panel.rh-room:not([data-ui-leaving])"),
      ).toBeVisible({ timeout: 20_000 });

      // Once: a reload at the same level shows no sheet.
      await page.reload();
      await page.waitForFunction(() => !!(window as any).__sock);
      await expect
        .poll(async () => {
          await page.evaluate(() => (window as any).__sock.fire("connect"));
          return page.locator("#lobby-play").isVisible();
        })
        .toBe(true);
      await expect(
        page.locator('.lobby-rail [data-lobby-action="missions"]'),
      ).toHaveClass(/is-locked/);
      await page.waitForTimeout(1500);
      await expect(page.locator("[data-ui-confirm]")).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("levels gained together show in one sheet, and an account seen for the first time gets none", async ({
  page,
}, info) => {
  // Lv 1 last time, Lv 4 now: three features in one sheet.
  await playerAt(page, 4, { matches: 6, seen: 1 });
  const errors = await openHub(page);
  const sheet = page.locator("[data-ui-confirm] .ui-modal");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".ui-title")).toHaveText("Unlocked");
  await expect(sheet.locator(".ui-ledger dt")).toHaveText([
    "Boss Raids",
    "Daily Missions",
    "The Plaza",
    "Next",
  ]);
  await expect(sheet.locator(".ui-ledger dd").last()).toHaveText(
    "The Shop · Lv 5",
  );
  await snap(page, info, "unlock-sheet-three");
  await sheet.locator("[data-ui-cancel]").click();
  await expect(page.locator("[data-ui-confirm]")).toHaveCount(0);
  // Later stays on the Lobby.
  await expect(page.locator(".ui-panel")).toHaveCount(0);
  // The Plaza opens now; the Shop and Ranks are still to come.
  await expect(
    page.locator('#hub-scenes [data-hub-scene="plaza"]'),
  ).not.toHaveClass(/is-locked/);
  await expect(
    page.locator('.lobby-rail [data-lobby-action="shop"]'),
  ).toHaveClass(/is-locked/);
  expect(errors).toEqual([]);
});

test("an account this browser has never seen keeps quiet, and an older account has no padlocks", async ({
  page,
}) => {
  // The harness account as it is: far past every unlock, nothing remembered.
  await skipTour(page);
  const errors = await openHub(page);
  await expect(page.locator("#lobby-play")).toBeVisible();
  await expect(page.locator(".is-locked")).toHaveCount(0);
  await expect(page.locator(".feature-lock")).toHaveCount(0);
  // Its bot matches have their full length.
  await page.click("#lobby-mode");
  await expect(
    page.locator('#lobby-mode-menu [data-lobby-mode="bot-easy"] small'),
  ).toHaveText("Learning · best of five");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
  await expect(page.locator("[data-ui-confirm]")).toHaveCount(0);
  // Its level is remembered, so a later level-up doesn't replay old unlocks.
  expect(
    await page.evaluate(
      (a) => Number(localStorage.getItem(`arena-unlocks:${a}`)),
      ACCOUNT,
    ),
  ).toBeGreaterThanOrEqual(6);
  expect(errors).toEqual([]);
});
