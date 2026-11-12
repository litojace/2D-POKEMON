import { expect, test } from "@playwright/test";
import {
  openHub,
  openLobby,
  openPlayPanel,
  pushUntilBattle,
  snap,
} from "./helpers";

// Solo raiders get one self-revive, except against ★★★ bosses (raid-solo.ts):
// the raid hall, the room and the briefing say so before the fight.
const RAIDS = {
  clears: 4,
  highestPeril: 3,
  totalClears: 4,
  bosses: { grumblecrag: { clears: 3, highestPeril: 3 } },
  titles: [],
  cosmetics: [],
  earned: [],
  weekly: [],
  loadout: {},
};

test("the raid hall warns that solo ★★★ has no revive", async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  await page.addInitScript((raids) => {
    const w = window as any;
    w.__raids = raids;
    w.__friends = { code: "a1b2c3d4", friends: [], incoming: [], outgoing: [] };
  }, RAIDS);
  const errors = await openLobby(page);
  await page.click('.lobby-rail [data-lobby-action="raids"]');
  const room = page.locator(".rh-room");
  const note = room.locator(".rh-foot-note");
  // ★ Grumblecrag: the usual self-revive.
  await room.locator('[data-raid-card="grumblecrag"]').click();
  await room.locator('[data-ui-raid-play="solo"]').click();
  await expect(note).toContainText("one self-revive");
  await expect(note).not.toHaveClass(/is-warning/);
  await room.locator('[data-ui-raid-tab="guide"]').click();
  await expect(room.locator(".rh-rules")).toContainText("one self-revive");
  // ★★★ Prismatail: a warning instead.
  await room.locator("[data-raid-back]").click();
  await room.locator('[data-raid-card="prismatail"]').click();
  await room.locator('[data-ui-raid-play="solo"]').click();
  await expect(note).toHaveClass(/is-warning/);
  await expect(note).toHaveText("Just you · no revive at ★★★");
  // Whole, not cut off with an ellipsis.
  expect(await note.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(
    true,
  );
  await snap(page, info, "raid-hall-solo-3-star");
  await room.locator('[data-ui-raid-tab="guide"]').click();
  await expect(room.locator(".rh-rules")).toContainText(
    "no revive against a ★★★ boss",
  );
  expect(errors).toEqual([]);
});

test("the briefing warns that solo ★★★ has no revive", async ({
  page,
}, info) => {
  // Four briefings in a row (slow on a busy machine).
  test.setTimeout(180_000);
  const errors = await openHub(page);
  await page.evaluate(() =>
    (window as any).__room("raid", { boss: "grumblecrag" }),
  );
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  const brief = (boss: string) =>
    page.evaluate((boss) => {
      const w = window as any;
      w.__room("raid", { boss });
      w.__snap.players = w.__snap.players.filter(
        (p: any) => p.raidBoss || p.id === "me",
      );
      w.__snap.raid.partySize = 1;
      w.__snap.phase = "briefing";
      w.__push();
    }, boss);
  const warning = page.locator(".raid-solo-warning");
  await brief("tidewyrm");
  await expect(page.locator("#raid-instructions")).toBeEnabled();
  await expect(warning).toHaveCount(0);
  await expect(page.locator(".rc-meta")).toContainText("one self-revive");
  for (const boss of ["prismatail", "emberwing", "storm-twins"]) {
    await brief(boss);
    await expect(warning).toBeVisible();
    await expect(warning).toHaveText(
      "No revive solo at ★★★ · one knockout ends the run",
    );
    await expect(page.locator(".rc-meta")).not.toContainText("self-revive");
  }
  await snap(page, info, "raid-briefing-solo-3-star");
  // A phone in landscape: the warning is on screen, clear of the ready button.
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(warning).toBeVisible();
  const w = (await warning.boundingBox())!,
    ready = (await page.locator("#raid-instructions").boundingBox())!;
  expect(w.x).toBeGreaterThanOrEqual(0);
  expect(w.x + w.width).toBeLessThanOrEqual(844);
  expect(w.y + w.height).toBeLessThanOrEqual(390);
  expect(
    w.x + w.width <= ready.x ||
      ready.x + ready.width <= w.x ||
      w.y + w.height <= ready.y ||
      ready.y + ready.height <= w.y,
  ).toBe(true);
  await snap(page, info, "raid-briefing-solo-3-star-phone");
  expect(errors).toEqual([]);
});
