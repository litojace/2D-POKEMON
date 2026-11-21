import { expect, test, type Page } from "@playwright/test";

import { RAID_BOSS_ORDER } from "../../packages/shared/src/raid-roster";
import { createRoom, openHub, openPlayPanel, pushUntilBattle } from "./helpers";
import { ISLAND, setInsets, type Insets } from "./ui-measure";

/**
 * Every raid and the Spire share one phone layout at the top (owner, 21 Nov
 * 2026): the quick-chat button in the top-left corner matching the gear in
 * the top-right, and the boss's (or floor's) HUD between them with the same
 * room on both sides. Bosses come from the shared roster, so a new one is
 * checked here without a test change; keep boss- and floor-specific UI out
 * of these corners (docs/raid-viewport.md, docs/spire-content-guide.md).
 */
const PHONES: {
  name: string;
  width: number;
  height: number;
  inset?: Insets;
}[] = [
  { name: "852x393", width: 852, height: 393 },
  { name: "667x375", width: 667, height: 375 },
  { name: "852x393-island", width: 852, height: 393, inset: ISLAND },
];

const boxOf = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const e = document.querySelector<HTMLElement>(selector);
    if (!e || !e.offsetWidth || getComputedStyle(e).display === "none")
      return null;
    const r = e.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }, selector);

/** The corners and the HUD between them, for what is on screen now. */
async function expectCorners(
  page: Page,
  phone: (typeof PHONES)[number],
  what: string,
) {
  const inset = phone.inset ?? { left: 0, right: 0, top: 0, bottom: 0 };
  await expect
    .poll(() => boxOf(page, "#raid-hud"), { message: what })
    .not.toBeNull();
  const hud = (await boxOf(page, "#raid-hud"))!,
    gear = (await boxOf(page, "#battle-menu"))!,
    chat = await boxOf(page, "#battle-chat");
  expect(gear, `${what}: gear`).not.toBeNull();
  // The gear: the top-right corner, 4px in from the safe area.
  expect(
    Math.abs(phone.width - inset.right - gear.right - 4),
    `${what}: gear right`,
  ).toBeLessThanOrEqual(1);
  // The HUD keeps the same room on both sides (the gear's on the right).
  const right = phone.width - hud.right,
    left = hud.left;
  expect(
    Math.abs(left - inset.left - (right - inset.right)),
    `${what}: HUD centred between the corners`,
  ).toBeLessThanOrEqual(1);
  expect(hud.right, `${what}: HUD clear of the gear`).toBeLessThanOrEqual(
    gear.left,
  );
  if (chat) {
    // The chat button mirrors the gear: same top, same size, same margin.
    expect(
      Math.abs(chat.top - gear.top),
      `${what}: chat level with the gear`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(chat.right - chat.left - (gear.right - gear.left)),
      `${what}: chat size`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(chat.left - inset.left - 4),
      `${what}: chat left`,
    ).toBeLessThanOrEqual(1);
    expect(chat.right, `${what}: HUD clear of the chat`).toBeLessThanOrEqual(
      hud.left,
    );
  }
}

async function phoneContext(
  browser: import("@playwright/test").Browser,
  phone: (typeof PHONES)[number],
) {
  return browser.newContext({
    viewport: { width: phone.width, height: phone.height },
    isMobile: true,
    hasTouch: true,
  });
}

for (const phone of PHONES) {
  test(`every raid boss: chat and gear in the top corners, HUD between them at ${phone.name}`, async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const context = await phoneContext(browser, phone);
    try {
      const page = await context.newPage();
      const errors = await openHub(page);
      if (phone.inset) await setInsets(page, phone.inset);
      await page.evaluate(
        (boss) => (window as any).__room("raid", { boss }),
        RAID_BOSS_ORDER[0],
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      for (const boss of RAID_BOSS_ORDER) {
        await page.evaluate(
          (boss) => (window as any).__room("raid", { boss }),
          boss,
        );
        await page.waitForTimeout(300);
        // A party fight: the quick-chat button shows.
        await expect(page.locator("#battle-chat"), boss).toBeVisible();
        await expectCorners(page, phone, boss);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  for (const floor of [1, 10])
    test(`the Spire's floor ${floor}: the same top corners at ${phone.name}`, async ({
      browser,
    }) => {
      test.setTimeout(120_000);
      const context = await phoneContext(browser, phone);
      try {
        const page = await context.newPage();
        const errors = await openHub(page);
        if (phone.inset) await setInsets(page, phone.inset);
        await page.evaluate(
          (floor) =>
            (window as any).__room("spire", { stage: "playing", floor }),
          floor,
        );
        await openPlayPanel(page);
        await createRoom(page);
        await pushUntilBattle(page);
        await expectCorners(page, phone, `Spire floor ${floor}`);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
}
