import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import { settled, spills } from "./ui-checks";
import { ISLAND, layoutProblems, setInsets } from "./ui-measure";
import { KAI, KAI_FRIEND, kaiHistory, myHistory } from "./history-fixture";

// Match history (docs/match-history.md): the Matches tab of your player
// card, and a friend's card opened from Friends. Mobile landscape first.
const SIZES = [
  { name: "844x390", width: 844, height: 390, phone: true },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    phone: true,
    island: true,
  },
  { name: "667x375", width: 667, height: 375, phone: true },
  { name: "1440x900", width: 1440, height: 900, phone: false },
];
type Size = (typeof SIZES)[number];

async function open(page: Page, size: Size) {
  await page.addInitScript(
    ({ mine, kai, friend, KAI }) => {
      const w = window as any;
      w.__history = { me: mine, [KAI]: kai };
      w.__historyRating = {
        rating: 1180,
        matches: 40,
        rank: "Expert",
        placementLeft: 0,
        next: { name: "Candidate Master", at: 1250 },
      };
      w.__friends = {
        code: "ABCDEF12",
        friends: [friend],
        incoming: [],
        outgoing: [],
      };
    },
    { mine: myHistory(), kai: kaiHistory(), friend: KAI_FRIEND, KAI },
  );
  const errors = await openLobby(page);
  if (size.island) await setInsets(page, ISLAND);
  return errors;
}

for (const size of SIZES)
  test(`match history on your card at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      const errors = await open(page, size);
      await page.click("#account-profile");
      const panel = page.locator(".profile-panel");
      await expect(panel).toBeVisible();
      if (size.phone) {
        // Six tabs and Share card fit the head, none cut off or under it.
        const head = await panel.evaluate((p) => {
          const tabs = Array.from(
            p.querySelectorAll<HTMLElement>("[data-ui-profile-tab]"),
          ).map((t) => t.getBoundingClientRect());
          const share = p
            .querySelector("[data-profile-share]")!
            .getBoundingClientRect();
          const box = p
            .querySelector(".ui-panel-head .ui-tabs")!
            .getBoundingClientRect();
          return {
            count: tabs.length,
            clear: tabs.every(
              (t) => t.right <= share.left + 0.5 && t.right <= box.right + 0.5,
            ),
          };
        });
        expect(head).toEqual({ count: 6, clear: true });
        await panel.locator('[data-ui-profile-tab="matches"]').click();
        await expect(
          panel.locator('[data-profile-main][data-tab="matches"]'),
        ).toBeVisible();
      } else await panel.locator(".mh").scrollIntoViewIfNeeded();
      const rows = panel.locator(".mh-row");
      await expect(rows).toHaveCount(10);
      await expect(rows.first()).toHaveClass(/is-win/);
      await expect(rows.first().locator(".mh-delta")).toHaveText("+16");
      await expect(rows.nth(1).locator(".mh-delta")).toHaveText("−12");
      await expect(panel.locator(".mh-form")).toContainText("Last 10");
      await settled(page, ".profile-panel");
      expect(
        await layoutProblems(page, {
          inset: size.island ? ISLAND : undefined,
          phone: size.phone,
        }),
      ).toEqual([]);
      expect(await spills(page, ".profile-panel")).toEqual([]);
      await snap(page, info, `history-${size.name}`);
      // A tap opens everyone's numbers: the team match, MVP marked.
      await rows.nth(1).locator(".mh-sum").click();
      await expect(rows.nth(1).locator(".mh-board > li")).toHaveCount(4);
      await expect(rows.nth(1).locator(".mh-mvp")).toHaveCount(1);
      // Every player's numbers stand in the same columns, MVP or not.
      const columns = await rows
        .nth(1)
        .locator(".mh-board > li")
        .evaluateAll(
          (lis) =>
            new Set(
              lis.map((li) =>
                Array.from(li.querySelectorAll(".mh-cell"))
                  .map((c) => Math.round(c.getBoundingClientRect().right))
                  .join(","),
              ),
            ).size,
        );
      expect(columns, "the board's columns line up").toBe(1);
      await rows.nth(1).scrollIntoViewIfNeeded();
      await settled(page, ".profile-panel");
      expect(await spills(page, ".profile-panel")).toEqual([]);
      await snap(page, info, `history-open-${size.name}`);
      // More: the second page joins the list.
      await panel.locator("[data-history-more]").scrollIntoViewIfNeeded();
      await panel.locator("[data-history-more]").click();
      await expect(rows).toHaveCount(16);
      await expect(panel.locator("[data-history-more]")).toHaveCount(0);
      // Bots only.
      await panel.locator('[data-ui-history-kind="bot"]').click();
      await expect(rows).toHaveCount(4);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

for (const size of SIZES)
  test(`a friend's card from Friends at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      const errors = await open(page, size);
      await page.click('.lobby-rail [data-lobby-action="friends"]');
      const sheet = page.locator(".friends-sheet");
      await expect(sheet).toBeVisible();
      await sheet.locator(`[data-friend-menu="${KAI}"]`).click();
      await sheet.locator(`[data-friend-card="${KAI}"]`).click();
      const card = page.locator(".friend-card-panel");
      await expect(card).toBeVisible();
      await expect(card.locator(".pf-card-name")).toHaveText("Kai");
      await expect(card.locator(".mh-row").first()).toBeVisible();
      await expect(card.locator(".pf-card-tags")).toContainText("Expert");
      await settled(page, ".friend-card-panel");
      expect(
        await layoutProblems(page, {
          inset: size.island ? ISLAND : undefined,
          phone: size.phone,
        }),
      ).toEqual([]);
      expect(await spills(page, ".friend-card-panel")).toEqual([]);
      await snap(page, info, `friend-card-${size.name}`);
      // Back to Friends.
      await card.locator("[data-friend-card-back]").click();
      await expect(page.locator(".friends-sheet")).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
