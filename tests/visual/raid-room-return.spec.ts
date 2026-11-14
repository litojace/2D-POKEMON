import { expect, test, type Page } from "@playwright/test";
import {
  openHub,
  pushUntilBattle,
  snap,
  openPlayPanel,
  hubMenu,
} from "./helpers";

async function prepareRaid(page: Page, lobby = false, drill?: string) {
  await page.evaluate(
    ({ lobby, drill }) => {
      const w = window as any;
      w.__room("raid", { boss: "prismatail" });
      if (lobby) {
        w.__snap.phase = "lobby";
        w.__snap.players = w.__snap.players.filter((p: any) => !p.raidBoss);
      }
      if (drill) {
        w.__snap.raid.drill = drill;
        w.__snap.raid.drillStats = { hits: 0, dodges: 0 };
      }
    },
    { lobby, drill },
  );
}
async function waitForLobby(page: Page) {
  await expect
    .poll(async () => {
      await page.evaluate(() => (window as any).__push());
      return page.evaluate(() =>
        document.body.classList.contains("lobby-active"),
      );
    })
    .toBe(true);
  // The room's seats and its picker (UI remodel step 5): no drawer.
  await expect(page.locator(".room-screen #leave")).toBeVisible();
}
async function expectHub(page: Page, tab: "party" | "attacks" | "rewards") {
  // The boss's page inside the Lobby (UI remodel step 5), on the tab you
  // left from.
  const room = page.locator(
    '.rh-room[data-raid-mode="boss"][data-raid-boss="prismatail"]',
  );
  await expect(room).toBeVisible();
  await expect(room.locator(`[data-ui-raid-tab="${tab}"]`)).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(room.locator(".rh-stage-name")).toBeInViewport();
  expect(
    await page.evaluate(() => sessionStorage.getItem("arena-token")),
  ).toBeNull();
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`leaving boss rooms restores their boss page at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width < 1000,
      hasTouch: viewport.width < 1000,
    });
    try {
      const page = await context.newPage();
      const errors = await openHub(page);
      await page.evaluate(() => {
        const fetch = window.fetch.bind(window);
        window.fetch = (input, init) =>
          String(input).includes("/api/raids")
            ? Promise.resolve(
                Response.json({
                  clears: 1,
                  highestPeril: 1,
                  bosses: { grumblecrag: { clears: 1, highestPeril: 1 } },
                  titles: [],
                  cosmetics: [],
                  earned: [],
                  weekly: [],
                  loadout: {},
                }),
              )
            : fetch(input, init);
      });
      await hubMenu(page, "raids");
      await page.click('[data-raid-card="prismatail"]');
      await page.click('[data-ui-raid-tab="rewards"]');
      await prepareRaid(page, true);
      await page.click('[data-ui-raid-play="party"]');
      await page.click('[data-raid-start="party"]');
      await waitForLobby(page);
      await page.click("#leave");
      await expectHub(page, "rewards");
      await expect(page.locator(".rh-stage-name")).toHaveText("Prismell");

      // The battle Settings exit follows the same origin. A failed leave keeps
      // the current room and its return destination intact for the next try.
      await prepareRaid(page);
      await page.click('[data-ui-raid-play="solo"]');
      await page.click('[data-raid-start="solo"]');
      await pushUntilBattle(page);
      await page.click("#battle-menu");
      await page.evaluate(() => {
        const w = window as any,
          reply = w.__reply;
        let refused = false;
        w.__reply = (event: string, data: unknown) => {
          if (event === "leave" && !refused) {
            refused = true;
            return { ok: false, error: "Temporary leave failure" };
          }
          return reply(event, data);
        };
      });
      await page.click("#exit-room");
      await expect(page.locator("#toast")).toContainText(
        "Could not leave the room yet",
      );
      await expect(page.locator("dialog[open] .settings-screen")).toBeVisible();
      await expect(page.locator(".rh-room")).toHaveCount(0);
      await page.click("#exit-room");
      await expectHub(page, "rewards");
      await snap(
        page,
        info,
        `raid-room-return-${viewport.width}x${viewport.height}`,
      );

      // Ending practice from the boss page returns to its Attacks tab.
      await page.click('[data-ui-raid-tab="attacks"]');
      const attack = page.locator("[data-raid-practice]");
      const kind = (await attack.getAttribute("data-raid-practice"))!;
      await prepareRaid(page, false, kind);
      await attack.click();
      await pushUntilBattle(page);
      await page.click(".raid-drill-picker > summary");
      await page.click("#raid-drill-leave");
      await expectHub(page, "attacks");

      // A later PvP room must not inherit the previous raid's destination.
      await page.click(".rh-room .ui-close");
      await page.evaluate(() =>
        (window as any).__room("pvp", { mode: "duel", phase: "lobby" }),
      );
      await openPlayPanel(page);
      await page.click('[data-mode="duel"]');
      await page.click("#play-create");
      await waitForLobby(page);
      await page.click("#leave");
      await expect(page.locator("#lobby-play")).toBeVisible();
      await expect(page.locator("dialog[open]")).toHaveCount(0);
      await expect(page.locator(".rh-room")).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
