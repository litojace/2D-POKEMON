import { expect, test, type Page } from "@playwright/test";
import {
  openHub,
  openPlayPanel,
  pushUntilBattle,
  settle,
  snap,
  createRoom,
} from "./helpers";
import { ISLAND, layoutProblems, setInsets, type Insets } from "./ui-measure";

// The Spire on iPhone and iPad first (App Store launch): every surface —
// the hub tile, the page's tabs, the briefing (floor 1 and the Ascendant's),
// the blessing cards, the HUD line, the boss floor's HUD and the results —
// inside the safe area (notch or Dynamic Island, home indicator), with
// 44 px touch targets, no clipped text and nothing under the touch controls.
const SIDES: Insets = { left: 44, right: 44, bottom: 21, top: 0 };
const IPAD: Insets = { left: 0, right: 0, bottom: 20, top: 24 };
const SIZES: { name: string; width: number; height: number; inset: Insets }[] =
  [
    {
      name: "667x375-se",
      width: 667,
      height: 375,
      inset: { ...SIDES, left: 0, right: 0, bottom: 0 },
    },
    { name: "844x390", width: 844, height: 390, inset: SIDES },
    { name: "852x393-island", width: 852, height: 393, inset: ISLAND },
    { name: "932x430", width: 932, height: 430, inset: ISLAND },
    { name: "844x280-short", width: 844, height: 280, inset: SIDES },
    { name: "1180x820-ipad", width: 1180, height: 820, inset: IPAD },
    { name: "1366x1024-ipad", width: 1366, height: 1024, inset: IPAD },
  ];
const RECORDS = {
  raids: {
    clears: 2,
    highestPeril: 3,
    bestSeconds: 200,
    titles: [],
    cosmetics: [],
    weekly: [],
    earned: [],
    bosses: {
      grumblecrag: { clears: 2, highestPeril: 3, bestSeconds: 200, runs: 3 },
    },
  },
  spire: {
    season: 0,
    highestFloor: 3,
    checkpoint: 1,
    attempts: 2,
    claimed: [1, 2, 3],
    clears: { grumblecrag: 2 },
  },
};
type Box = { x: number; y: number; right: number; bottom: number };
const boxOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    });
const overlaps = (a: Box, b: Box) =>
  a.x < b.right - 1 &&
  b.x < a.right - 1 &&
  a.y < b.bottom - 1 &&
  b.y < a.bottom - 1;

/** Inside the screen minus its safe area. */
function inSafe(
  b: Box,
  s: { width: number; height: number; inset: Insets },
  what: string,
) {
  expect(b.x, `${what} left`).toBeGreaterThanOrEqual(s.inset.left - 1);
  expect(b.right, `${what} right`).toBeLessThanOrEqual(
    s.width - s.inset.right + 1,
  );
  expect(b.y, `${what} top`).toBeGreaterThanOrEqual(s.inset.top - 1);
  expect(b.bottom, `${what} bottom`).toBeLessThanOrEqual(
    s.height - s.inset.bottom + 1,
  );
}
/**
 * Every button in sight under `root`: a finger 44 px tall lands on it (its
 * hit area may reach past what is drawn, as ui-measure's rule allows), and
 * its label is whole.
 */
async function touchTargets(page: Page, root: string) {
  const bad = await page
    .locator(root)
    .first()
    .evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>("button, [role=tab]")]
        .filter((b) => {
          const r = b.getBoundingClientRect();
          return (
            r.width > 0 &&
            r.height > 0 &&
            r.bottom > 0 &&
            r.top < innerHeight &&
            getComputedStyle(b).visibility !== "hidden"
          );
        })
        .flatMap((b) => {
          const r = b.getBoundingClientRect();
          const out: string[] = [];
          const name = (b.getAttribute("aria-label") || b.textContent || "")
            .trim()
            .slice(0, 30);
          const cx = r.x + r.width / 2,
            cy = r.y + r.height / 2;
          for (const [dx, dy] of [
            [0, -21],
            [0, 0],
            [0, 21],
            [-21, 0],
            [21, 0],
          ]) {
            const x = cx + dx,
              y = cy + dy;
            if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) continue;
            const hit = document.elementFromPoint(x, y);
            if (!hit || !(hit === b || b.contains(hit) || hit.contains(b)))
              out.push(
                `${name}: no hit at (${dx}, ${dy}) from its centre (${r.width.toFixed(0)}×${r.height.toFixed(0)})`,
              );
          }
          if (
            !b.hasAttribute("aria-label") &&
            b.scrollWidth > b.clientWidth + 1
          )
            out.push(`${name}: label clipped`);
          return out;
        }),
    );
  expect(bad).toEqual([]);
}
/** The HUD stays inside the safe area, its text whole, clear of the touch controls. */
async function hudFits(page: Page, s: (typeof SIZES)[number]) {
  const hud = await boxOf(page, "#raid-hud");
  inSafe(hud, s, "HUD");
  const clipped = await page
    .locator("#raid-hud")
    .evaluate((el) =>
      [
        ...el.querySelectorAll<HTMLElement>(
          "[data-hud=title], [data-hud=phase], .raid-callout",
        ),
      ]
        .filter(
          (e) =>
            e.offsetWidth &&
            e.scrollWidth > e.clientWidth + 1 &&
            getComputedStyle(e).textOverflow !== "ellipsis",
        )
        .map((e) => e.dataset.hud ?? e.className),
    );
  expect(clipped).toEqual([]);
  const controls = await page.evaluate(() =>
    [...document.querySelectorAll(".touch-buttons button, .joystick")]
      .filter((e) => (e as HTMLElement).offsetWidth)
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      }),
  );
  for (const c of controls)
    expect(overlaps(hud, c), "HUD under a touch control").toBe(false);
}
/** An overlay card: inside the safe area, its main action reachable. */
async function cardFits(
  page: Page,
  s: (typeof SIZES)[number],
  card: string,
  action: string,
) {
  await settle(page);
  inSafe(await boxOf(page, card), s, card);
  await expect(page.locator(action)).toBeInViewport({ ratio: 1 });
  await touchTargets(page, card);
  // The chat buttons (quick chat in a fight, the room's chat at the
  // results: top left) never sit on the card.
  await page.waitForTimeout(800);
  for (const chat of ["#battle-chat", "#chat-button"])
    if (await page.locator(chat).isVisible())
      expect(
        overlaps(await boxOf(page, chat), await boxOf(page, card)),
        `${chat} over ${card}`,
      ).toBe(false);
}

for (const s of SIZES)
  test(`the Spire on touch screens at ${s.name}`, async ({ browser }, info) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      viewport: { width: s.width, height: s.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await page.addInitScript((r) => {
        const w = window as any;
        w.__raids = r.raids;
        w.__spire = r.spire;
      }, RECORDS);
      const errors = await openHub(page);
      await setInsets(page, s.inset);
      const phone = s.height < 500;
      // The hub tile and the page's three tabs.
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      const tile = page.locator(".rh-room [data-raid-spire]");
      await tile.scrollIntoViewIfNeeded();
      await settle(page);
      inSafe(await boxOf(page, ".rh-room [data-raid-spire]"), s, "Spire tile");
      await snap(page, info, `spire-safe-hall-${s.name}`);
      await tile.click();
      for (const tab of ["climb", "floors", "blessings"]) {
        await page.locator(`[data-ui-spire-tab="${tab}"]`).click();
        expect(await layoutProblems(page, { inset: s.inset, phone })).toEqual(
          [],
        );
        await touchTargets(page, ".rh-room .ui-panel-head");
        await touchTargets(page, ".rh-room [role=tablist]");
        await touchTargets(page, ".rh-room .ui-panel-foot");
        await snap(page, info, `spire-safe-${tab}-${s.name}`);
      }

      // A wave floor with a teammate: the HUD line.
      await page.evaluate(() =>
        (window as any).__room("spire", {
          stage: "playing",
          floor: 2,
          seats: 2,
        }),
      );
      await page
        .locator(".rh-room [data-ui-close]")
        .click()
        .catch(() => {});
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      await setInsets(page, s.inset);
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        /^Floor 2 · Wave/,
      );
      await hudFits(page, s);
      await snap(page, info, `spire-safe-wave-${s.name}`);

      // The blessing cards.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 3, stage: "intermission", seats: 2 });
        w.__push();
      });
      const cards = page.locator(".raid-draft [data-raid-rite]");
      await expect(cards).toHaveCount(3);
      await settle(page);
      for (const c of await cards.all()) {
        await c.scrollIntoViewIfNeeded();
        const b = await c.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            right: r.right,
            bottom: r.bottom,
            h: r.height,
            clip: el.scrollWidth > el.clientWidth + 1,
          };
        });
        expect(b.h).toBeGreaterThanOrEqual(44);
        expect(b.clip).toBe(false);
        inSafe(b, s, "blessing card");
      }
      inSafe(await boxOf(page, ".raid-draft"), s, "blessing panel");
      // A party sees the quick-chat button between floors: it never sits
      // on a card.
      if (await page.locator("#battle-chat").isVisible()) {
        const chat = await boxOf(page, "#battle-chat");
        for (const c of await cards.all()) {
          const b = await c.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
          });
          expect(overlaps(chat, b), "chat button over a blessing card").toBe(
            false,
          );
        }
      }
      await snap(page, info, `spire-safe-blessings-${s.name}`);

      // The first floor's briefing, and the Ascendant's.
      for (const floor of [1, 10]) {
        await page.evaluate((floor) => {
          const w = window as any;
          w.__room("spire", { floor, stage: "briefing" });
          w.__push();
        }, floor);
        await expect(page.locator(".rc-card.is-briefing")).toBeVisible();
        await cardFits(page, s, ".rc-card.is-briefing", "#raid-instructions");
        await snap(page, info, `spire-safe-briefing-${floor}-${s.name}`);
      }

      // The boss floor's HUD: the raid's bar, the floor and its clock.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 10, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 10 · Phase 1/3",
      );
      await hudFits(page, s);
      await snap(page, info, `spire-safe-boss-${s.name}`);

      // The results: zone 1 conquered.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 10, stage: "finished" });
        w.__push();
      });
      await expect(page.locator(".rc-card.is-results h2")).toHaveText(
        "Zone 1 conquered!",
      );
      await cardFits(page, s, ".rc-card.is-results", "#raid-retry");
      await snap(page, info, `spire-safe-results-${s.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// Zone 2 (the Lagoon) on the same screens: the zone picker and the floors
// by zone in the hub, floor 11's HUD, the elite's, the Ascendant Tidelotl's
// briefing and boss bar, and zone 2 conquered.
const ZONE2 = {
  raids: {
    ...RECORDS.raids,
    bosses: {
      ...RECORDS.raids.bosses,
      tidewyrm: { clears: 1, highestPeril: 3, bestSeconds: 260, runs: 2 },
    },
  },
  spire: {
    season: 0,
    highestFloor: 12,
    checkpoint: 11,
    attempts: 5,
    claimed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    clears: { grumblecrag: 2, tidewyrm: 1 },
  },
};
for (const s of SIZES)
  test(`the Spire's zone 2 on touch screens at ${s.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      viewport: { width: s.width, height: s.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await page.addInitScript((r) => {
        const w = window as any;
        w.__raids = r.raids;
        w.__spire = r.spire;
      }, ZONE2);
      const errors = await openHub(page);
      await setInsets(page, s.inset);
      const phone = s.height < 500;
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      await page.locator(".rh-room [data-raid-spire]").click();
      // The zone picker: both zones, finger-sized, inside the safe area.
      const picker = page.locator(".rh-room .sp-zones");
      await picker.scrollIntoViewIfNeeded();
      await settle(page);
      await expect(picker.locator("[data-ui-spire-zone]")).toHaveCount(2);
      await expect(
        picker.locator('[data-ui-spire-zone="2"][aria-pressed="true"]'),
      ).toBeVisible();
      inSafe(await boxOf(page, ".rh-room .sp-zones"), s, "zone picker");
      expect(await layoutProblems(page, { inset: s.inset, phone })).toEqual([]);
      await touchTargets(page, ".rh-room .sp-zones");
      await touchTargets(page, ".rh-room .ui-panel-foot");
      await snap(page, info, `spire-z2-safe-picker-${s.name}`);
      // The floors tab: zone 2's heading and rows.
      await page.locator('[data-ui-spire-tab="floors"]').click();
      const head = page.locator('[data-spire-zone-floors="2"] .sp-zone-head');
      await head.scrollIntoViewIfNeeded();
      await settle(page);
      expect(await layoutProblems(page, { inset: s.inset, phone })).toEqual([]);
      await snap(page, info, `spire-z2-safe-floors-${s.name}`);

      // Floor 11 with a teammate: the HUD line.
      await page.evaluate(() =>
        (window as any).__room("spire", {
          stage: "playing",
          floor: 11,
          seats: 2,
        }),
      );
      await page
        .locator(".rh-room [data-ui-close]")
        .click()
        .catch(() => {});
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      await setInsets(page, s.inset);
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        /^Floor 11 · Wave/,
      );
      await hudFits(page, s);
      await snap(page, info, `spire-z2-safe-wave-${s.name}`);

      // The elite's HUD (its name in the title).
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 15, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 15 · Elite",
      );
      await hudFits(page, s);
      await snap(page, info, `spire-z2-safe-elite-${s.name}`);

      // The Ascendant Tidelotl's briefing, its boss bar, and the results.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 20, stage: "briefing" });
        w.__push();
      });
      await expect(page.locator(".rc-card.is-briefing h2")).toHaveText(
        "Floor 20 · Ascendant Tidelotl",
      );
      await cardFits(page, s, ".rc-card.is-briefing", "#raid-instructions");
      await snap(page, info, `spire-z2-safe-briefing-${s.name}`);
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 20, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 20 · Phase 1/3",
      );
      await hudFits(page, s);
      await snap(page, info, `spire-z2-safe-boss-${s.name}`);
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 20, stage: "finished" });
        w.__push();
      });
      await expect(page.locator(".rc-card.is-results h2")).toHaveText(
        "Zone 2 conquered!",
      );
      await cardFits(page, s, ".rc-card.is-results", "#raid-retry");
      await snap(page, info, `spire-z2-safe-results-${s.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
