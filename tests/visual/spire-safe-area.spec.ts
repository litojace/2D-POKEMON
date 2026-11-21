import { fileURLToPath } from "node:url";
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
 * The zone picker fits its row without sideways scrolling: every chip
 * whole, inside the row and the panel, at least 44 px each way (the
 * problems found, none when it fits).
 */
async function pickerFits(page: Page) {
  return page.locator(".rh-room .sp-zone-picker").evaluate((row) => {
    const out: string[] = [];
    if (row.scrollWidth > row.clientWidth + 1)
      out.push(`row scrolls ${row.scrollWidth - row.clientWidth} px`);
    const r = row.getBoundingClientRect();
    const main = row.closest(".ui-split-main")!.getBoundingClientRect();
    for (const b of row.querySelectorAll<HTMLElement>("[data-ui-spire-zone]")) {
      const c = b.getBoundingClientRect(),
        id = b.dataset.uiSpireZone;
      if (c.left < r.left - 1 || c.right > r.right + 1)
        out.push(`zone ${id} outside its row`);
      if (c.left < main.left - 1 || c.right > main.right + 1)
        out.push(`zone ${id} outside the panel`);
      if (c.width < 44 || c.height < 44)
        out.push(`zone ${id} ${c.width.toFixed(0)}x${c.height.toFixed(0)}`);
    }
    // The picked zone's line: beside the chips, or (no room beside them)
    // in the milestones' heading; exactly one of them shown.
    const lines = [
      ...row
        .closest(".sp-body")!
        .querySelectorAll<HTMLElement>(".sp-zone-info, .sp-route-zone"),
    ].filter((e) => e.getClientRects().length > 0);
    if (lines.length !== 1) out.push(`${lines.length} zone lines shown`);
    for (const line of lines) {
      const i = line.getBoundingClientRect();
      if (i.right > main.right + 1) out.push("zone line outside the panel");
      if (line.scrollWidth > line.clientWidth + 1 && i.width < 120)
        out.push(`zone line ${i.width.toFixed(0)} px wide`);
    }
    return out;
  });
}
/**
 * Every button in sight under `root`: a finger 44 px tall lands on it (its
 * hit area may reach past what is drawn, as ui-measure's rule allows), and
 * its label is whole. In a row that scrolls sideways (the zone picker once
 * four zones are out), what is in sight is the part inside the row: a
 * button scrolled mostly out of it is reached by swiping, and the row's
 * edge fades say so.
 */
async function touchTargets(page: Page, root: string) {
  const bad = await page
    .locator(root)
    .first()
    .evaluate((el) => {
      /** The part of `b` inside every sideways-scrolling row round it. */
      const shown = (b: HTMLElement) => {
        const r = b.getBoundingClientRect();
        let left = r.left,
          right = r.right;
        for (let a = b.parentElement; a; a = a.parentElement) {
          const o = getComputedStyle(a).overflowX;
          if (o !== "auto" && o !== "scroll") continue;
          const box = a.getBoundingClientRect();
          left = Math.max(left, box.left);
          right = Math.min(right, box.right);
        }
        return { r, left, right };
      };
      return [...el.querySelectorAll<HTMLElement>("button, [role=tab]")]
        .filter((b) => {
          const { r, left, right } = shown(b);
          if (right - left < 44) return false;
          return (
            r.width > 0 &&
            r.height > 0 &&
            r.bottom > 0 &&
            r.top < innerHeight &&
            getComputedStyle(b).visibility !== "hidden"
          );
        })
        .flatMap((b) => {
          const { r, left, right } = shown(b);
          const out: string[] = [];
          const name = (b.getAttribute("aria-label") || b.textContent || "")
            .trim()
            .slice(0, 30);
          const cx = (left + right) / 2,
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
        });
    });
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
      const cards = page.locator(".rites-screen [data-raid-rite]");
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
      // The screen itself reaches every edge (like the countdown); what it
      // shows stays inside the safe area.
      inSafe(
        await boxOf(page, ".rites-screen .rites-head"),
        s,
        "blessing heading",
      );
      inSafe(
        await boxOf(page, ".rites-screen .raid-rite-options"),
        s,
        "blessing tiles",
      );
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
      // The zone picker: every zone (zones 3 to 6 locked), finger-sized,
      // inside the safe area.
      const picker = page.locator(".rh-room .sp-zone-picker");
      await picker.scrollIntoViewIfNeeded();
      await settle(page);
      await expect(picker.locator("[data-ui-spire-zone]")).toHaveCount(7);
      await expect(picker.locator('[data-ui-spire-zone="3"]')).toBeDisabled();
      await expect(picker.locator('[data-ui-spire-zone="4"]')).toBeDisabled();
      await expect(picker.locator('[data-ui-spire-zone="5"]')).toBeDisabled();
      await expect(picker.locator('[data-ui-spire-zone="6"]')).toBeDisabled();
      await expect(
        picker.locator('[data-ui-spire-zone="2"][aria-pressed="true"]'),
      ).toBeVisible();
      inSafe(await boxOf(page, ".rh-room .sp-zone-picker"), s, "zone picker");
      expect(await layoutProblems(page, { inset: s.inset, phone })).toEqual([]);
      await touchTargets(page, ".rh-room .sp-zone-picker");
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

// Zone 3 (the Lantern Yard) on the same screens: the zone picker with three
// zones, its floors in the hub, floor 21's HUD, the elite's, the Ascendant
// Inkpurr's briefing and boss bar, and zone 3 conquered.
const ZONE3 = {
  raids: {
    ...ZONE2.raids,
    bosses: {
      ...ZONE2.raids.bosses,
      gloomshade: { clears: 1, highestPeril: 3, bestSeconds: 300, runs: 2 },
    },
  },
  spire: {
    season: 0,
    highestFloor: 22,
    checkpoint: 21,
    attempts: 9,
    claimed: Array.from({ length: 22 }, (_, i) => i + 1),
    clears: { grumblecrag: 2, tidewyrm: 1, gloomshade: 1 },
  },
};
for (const s of SIZES)
  test(`the Spire's zone 3 on touch screens at ${s.name}`, async ({
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
      }, ZONE3);
      const errors = await openHub(page);
      await setInsets(page, s.inset);
      const phone = s.height < 500;
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      await page.locator(".rh-room [data-raid-spire]").click();
      // The zone picker: every zone, zone 3 picked, inside the safe area.
      const picker = page.locator(".rh-room .sp-zone-picker");
      await picker.scrollIntoViewIfNeeded();
      await settle(page);
      await expect(picker.locator("[data-ui-spire-zone]")).toHaveCount(7);
      await expect(picker.locator('[data-ui-spire-zone="4"]')).toBeDisabled();
      await expect(picker.locator('[data-ui-spire-zone="5"]')).toBeDisabled();
      await expect(picker.locator('[data-ui-spire-zone="6"]')).toBeDisabled();
      await expect(
        picker.locator('[data-ui-spire-zone="3"][aria-pressed="true"]'),
      ).toBeVisible();
      inSafe(await boxOf(page, ".rh-room .sp-zone-picker"), s, "zone picker");
      expect(await layoutProblems(page, { inset: s.inset, phone })).toEqual([]);
      await touchTargets(page, ".rh-room .sp-zone-picker");
      await touchTargets(page, ".rh-room .ui-panel-foot");
      await snap(page, info, `spire-z3-safe-picker-${s.name}`);
      // The floors tab: zone 3's heading and rows.
      await page.locator('[data-ui-spire-tab="floors"]').click();
      const head = page.locator('[data-spire-zone-floors="3"] .sp-zone-head');
      await head.scrollIntoViewIfNeeded();
      await settle(page);
      expect(await layoutProblems(page, { inset: s.inset, phone })).toEqual([]);
      await snap(page, info, `spire-z3-safe-floors-${s.name}`);

      // Floor 21 with a teammate: the HUD line.
      await page.evaluate(() =>
        (window as any).__room("spire", {
          stage: "playing",
          floor: 21,
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
        /^Floor 21 · Wave/,
      );
      await hudFits(page, s);
      await snap(page, info, `spire-z3-safe-wave-${s.name}`);

      // The elite's HUD (its name in the title).
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 25, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 25 · Elite",
      );
      await hudFits(page, s);
      await snap(page, info, `spire-z3-safe-elite-${s.name}`);

      // The Ascendant Inkpurr's briefing, its boss bar, and the results.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 30, stage: "briefing" });
        w.__push();
      });
      await expect(page.locator(".rc-card.is-briefing h2")).toHaveText(
        "Floor 30 · Ascendant Inkpurr",
      );
      await cardFits(page, s, ".rc-card.is-briefing", "#raid-instructions");
      await snap(page, info, `spire-z3-safe-briefing-${s.name}`);
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 30, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 30 · Phase 1/3",
      );
      await hudFits(page, s);
      await snap(page, info, `spire-z3-safe-boss-${s.name}`);
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 30, stage: "finished" });
        w.__push();
      });
      await expect(page.locator(".rc-card.is-results h2")).toHaveText(
        "Zone 3 conquered!",
      );
      await cardFits(page, s, ".rc-card.is-results", "#raid-retry");
      await snap(page, info, `spire-z3-safe-results-${s.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// Zone 4 (the Cloud Deck) on the same screens: the zone picker with four
// zones, its floors in the hub, floor 31's HUD, the elite's, the Ascendant
// Snoozaku's briefing and boss bar, and zone 4 conquered.
const ZONE4 = {
  raids: {
    ...ZONE3.raids,
    bosses: {
      ...ZONE3.raids.bosses,
      somnara: { clears: 1, highestPeril: 3, bestSeconds: 320, runs: 2 },
    },
  },
  spire: {
    season: 0,
    highestFloor: 32,
    checkpoint: 31,
    attempts: 12,
    claimed: Array.from({ length: 32 }, (_, i) => i + 1),
    clears: { grumblecrag: 2, tidewyrm: 1, gloomshade: 1, somnara: 1 },
  },
};
for (const s of SIZES)
  test(`the Spire's zone 4 on touch screens at ${s.name}`, async ({
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
      }, ZONE4);
      const errors = await openHub(page);
      await setInsets(page, s.inset);
      const phone = s.height < 500;
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      await page.locator(".rh-room [data-raid-spire]").click();
      // The zone picker: every zone, zone 4 picked, inside the safe area.
      const picker = page.locator(".rh-room .sp-zone-picker");
      await picker.scrollIntoViewIfNeeded();
      await settle(page);
      await expect(picker.locator("[data-ui-spire-zone]")).toHaveCount(7);
      await expect(
        picker.locator('[data-ui-spire-zone="4"][aria-pressed="true"]'),
      ).toBeVisible();
      // Every zone is in view in its row (none scrolled out of sight).
      expect(await pickerFits(page)).toEqual([]);
      inSafe(await boxOf(page, ".rh-room .sp-zone-picker"), s, "zone picker");
      expect(await layoutProblems(page, { inset: s.inset, phone })).toEqual([]);
      await touchTargets(page, ".rh-room .sp-zone-picker");
      await touchTargets(page, ".rh-room .ui-panel-foot");
      await snap(page, info, `spire-z4-safe-picker-${s.name}`);
      // The floors tab: zone 4's heading and rows.
      await page.locator('[data-ui-spire-tab="floors"]').click();
      const head = page.locator('[data-spire-zone-floors="4"] .sp-zone-head');
      await head.scrollIntoViewIfNeeded();
      await settle(page);
      expect(await layoutProblems(page, { inset: s.inset, phone })).toEqual([]);
      await snap(page, info, `spire-z4-safe-floors-${s.name}`);

      // Floor 31 with a teammate: the HUD line.
      await page.evaluate(() =>
        (window as any).__room("spire", {
          stage: "playing",
          floor: 31,
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
        /^Floor 31 · Wave/,
      );
      await hudFits(page, s);
      await snap(page, info, `spire-z4-safe-wave-${s.name}`);

      // The elite's HUD (its name in the title).
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 35, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 35 · Elite",
      );
      await hudFits(page, s);
      await snap(page, info, `spire-z4-safe-elite-${s.name}`);

      // The Ascendant Snoozaku's briefing, its boss bar, and the results.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 40, stage: "briefing" });
        w.__push();
      });
      await expect(page.locator(".rc-card.is-briefing h2")).toHaveText(
        "Floor 40 · Ascendant Snoozaku",
      );
      await cardFits(page, s, ".rc-card.is-briefing", "#raid-instructions");
      await snap(page, info, `spire-z4-safe-briefing-${s.name}`);
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 40, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 40 · Phase 1/3",
      );
      await hudFits(page, s);
      await snap(page, info, `spire-z4-safe-boss-${s.name}`);
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 40, stage: "finished" });
        w.__push();
      });
      await expect(page.locator(".rc-card.is-results h2")).toHaveText(
        "Zone 4 conquered!",
      );
      await cardFits(page, s, ".rc-card.is-results", "#raid-retry");
      await snap(page, info, `spire-z4-safe-results-${s.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// Zone 5 (the Sun Atrium) on the same screens and the smallest iPhone in
// landscape: the zone picker with five zones (and seven, as it will hold)
// in one row without sideways scrolling, its floors in the hub, floor 41's
// HUD, the elite's, the Ascendant Prismell's briefing and boss bar, and
// zone 5 conquered.
const ZONE5 = {
  raids: {
    ...ZONE4.raids,
    bosses: {
      ...ZONE4.raids.bosses,
      prismatail: { clears: 1, highestPeril: 3, bestSeconds: 300, runs: 2 },
    },
  },
  spire: {
    season: 0,
    highestFloor: 42,
    checkpoint: 41,
    attempts: 15,
    claimed: Array.from({ length: 42 }, (_, i) => i + 1),
    clears: {
      grumblecrag: 2,
      tidewyrm: 1,
      gloomshade: 1,
      somnara: 1,
      prismatail: 1,
    },
  },
};
const ZONE5_SIZES = [
  ...SIZES,
  {
    name: "568x320-se1",
    width: 568,
    height: 320,
    inset: { left: 0, right: 0, bottom: 0, top: 0 },
  },
];
for (const s of ZONE5_SIZES)
  test(`the Spire's zone 5 on touch screens at ${s.name}`, async ({
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
      }, ZONE5);
      const errors = await openHub(page);
      await setInsets(page, s.inset);
      const phone = s.height < 500;
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      await page.locator(".rh-room [data-raid-spire]").click();
      // The zone picker: all seven zones in one row, zone 5 picked, named once.
      const picker = page.locator(".rh-room .sp-zone-picker");
      await picker.scrollIntoViewIfNeeded();
      await settle(page);
      await expect(picker.locator("[data-ui-spire-zone]")).toHaveCount(7);
      await expect(
        picker.locator('[data-ui-spire-zone="5"][aria-pressed="true"]'),
      ).toBeVisible();
      await expect(
        page
          .locator(".rh-room .sp-zone-info, .rh-room .sp-route-zone")
          .locator("visible=true"),
      ).toContainText("Sun Atrium");
      expect(await pickerFits(page)).toEqual([]);
      inSafe(await boxOf(page, ".rh-room .sp-zones"), s, "zone picker");
      expect(await layoutProblems(page, { inset: s.inset, phone })).toEqual([]);
      await touchTargets(page, ".rh-room .sp-zone-picker");
      await touchTargets(page, ".rh-room .ui-panel-foot");
      await snap(page, info, `spire-z5-safe-picker-${s.name}`);
      // Seven zones (as the Spire will hold; unreleased test content only),
      // zone 7 locked: still one row, every chip whole and finger-sized.
      await page.evaluate(
        async ({ modelPath, fixturePath, raids, spire }) => {
          const { spireMarkup } = await import(modelPath);
          const { expandedSpire } = await import(fixturePath);
          const data = {
            progress: raids,
            spire: { ...spire, highestFloor: 52, checkpoint: 51 },
            loading: false,
            me: { name: "tester", character: "voltkit" },
            party: [],
            leader: true,
            inRoom: false,
          };
          document.querySelector(".sp-room")!.outerHTML = spireMarkup(
            { play: "solo", status: "" },
            data,
            expandedSpire(7),
          );
        },
        {
          modelPath: `/@fs${fileURLToPath(new URL("../../apps/client/src/screens/spire-view.ts", import.meta.url))}`,
          fixturePath: `/@fs${fileURLToPath(new URL("../fixtures/spire-catalogue.ts", import.meta.url))}`,
          raids: ZONE5.raids,
          spire: ZONE5.spire,
        },
      );
      await expect(picker.locator("[data-ui-spire-zone]")).toHaveCount(7);
      await expect(picker.locator('[data-ui-spire-zone="7"]')).toBeDisabled();
      await expect(
        picker.locator('[data-ui-spire-zone="6"][aria-pressed="true"]'),
      ).toBeVisible();
      await picker.scrollIntoViewIfNeeded();
      await settle(page);
      expect(await pickerFits(page)).toEqual([]);
      inSafe(await boxOf(page, ".rh-room .sp-zones"), s, "seven zones");
      expect(await layoutProblems(page, { inset: s.inset, phone })).toEqual([]);
      await touchTargets(page, ".rh-room .sp-zone-picker");
      await snap(page, info, `spire-z5-safe-picker7-${s.name}`);
      await page
        .locator(".rh-room [data-ui-close]")
        .click()
        .catch(() => {});
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      await page.locator(".rh-room [data-raid-spire]").click();
      // The floors tab: zone 5's heading and rows.
      await page.locator('[data-ui-spire-tab="floors"]').click();
      const head = page.locator('[data-spire-zone-floors="5"] .sp-zone-head');
      await head.scrollIntoViewIfNeeded();
      await settle(page);
      expect(await layoutProblems(page, { inset: s.inset, phone })).toEqual([]);
      await snap(page, info, `spire-z5-safe-floors-${s.name}`);

      // Floor 41 with a teammate: the HUD line.
      await page.evaluate(() =>
        (window as any).__room("spire", {
          stage: "playing",
          floor: 41,
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
        /^Floor 41 · Wave/,
      );
      await hudFits(page, s);
      await snap(page, info, `spire-z5-safe-wave-${s.name}`);

      // The elite's HUD (its name in the title).
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 45, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 45 · Elite",
      );
      await hudFits(page, s);
      await snap(page, info, `spire-z5-safe-elite-${s.name}`);

      // The Ascendant Prismell's briefing, its boss bar, and the results.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 50, stage: "briefing" });
        w.__push();
      });
      await expect(page.locator(".rc-card.is-briefing h2")).toHaveText(
        "Floor 50 · Ascendant Prismell",
      );
      await cardFits(page, s, ".rc-card.is-briefing", "#raid-instructions");
      await snap(page, info, `spire-z5-safe-briefing-${s.name}`);
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 50, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 50 · Phase 1/3",
      );
      await hudFits(page, s);
      await snap(page, info, `spire-z5-safe-boss-${s.name}`);
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 50, stage: "finished" });
        w.__push();
      });
      await expect(page.locator(".rc-card.is-results h2")).toHaveText(
        "Zone 5 conquered!",
      );
      await cardFits(page, s, ".rc-card.is-results", "#raid-retry");
      await snap(page, info, `spire-z5-safe-results-${s.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// Zone 6 (the Sky Terrace) on the same screens: the zone picker with six
// zones in one row, its floors in the hub, floor 51's HUD, the elite's, the
// Ascendant Lumiwick's briefing and boss bar, and zone 6 conquered.
const ZONE6 = {
  raids: {
    ...ZONE5.raids,
    bosses: {
      ...ZONE5.raids.bosses,
      emberwing: { clears: 1, highestPeril: 3, bestSeconds: 300, runs: 2 },
    },
  },
  spire: {
    season: 0,
    highestFloor: 52,
    checkpoint: 51,
    attempts: 18,
    claimed: Array.from({ length: 52 }, (_, i) => i + 1),
    clears: {
      grumblecrag: 2,
      tidewyrm: 1,
      gloomshade: 1,
      somnara: 1,
      prismatail: 1,
      emberwing: 1,
    },
  },
};
for (const s of ZONE5_SIZES)
  test(`the Spire's zone 6 on touch screens at ${s.name}`, async ({
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
      }, ZONE6);
      const errors = await openHub(page);
      await setInsets(page, s.inset);
      const phone = s.height < 500;
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      await page.locator(".rh-room [data-raid-spire]").click();
      // The zone picker: all seven zones in one row, zone 6 picked, named once.
      const picker = page.locator(".rh-room .sp-zone-picker");
      await picker.scrollIntoViewIfNeeded();
      await settle(page);
      await expect(picker.locator("[data-ui-spire-zone]")).toHaveCount(7);
      await expect(
        picker.locator('[data-ui-spire-zone="6"][aria-pressed="true"]'),
      ).toBeVisible();
      await expect(
        page
          .locator(".rh-room")
          .locator(".sp-zone-info, .sp-route-zone")
          .locator("visible=true"),
      ).toContainText("Sky Terrace");
      expect(await pickerFits(page)).toEqual([]);
      inSafe(await boxOf(page, ".rh-room .sp-zones"), s, "zone picker");
      expect(await layoutProblems(page, { inset: s.inset, phone })).toEqual([]);
      await touchTargets(page, ".rh-room .sp-zone-picker");
      await touchTargets(page, ".rh-room .ui-panel-foot");
      await snap(page, info, `spire-z6-safe-picker-${s.name}`);
      // The floors tab: zone 6's heading and rows.
      await page.locator('[data-ui-spire-tab="floors"]').click();
      const head = page.locator('[data-spire-zone-floors="6"] .sp-zone-head');
      await head.scrollIntoViewIfNeeded();
      await settle(page);
      expect(await layoutProblems(page, { inset: s.inset, phone })).toEqual([]);
      await snap(page, info, `spire-z6-safe-floors-${s.name}`);

      // Floor 51 with a teammate: the HUD line.
      await page.evaluate(() =>
        (window as any).__room("spire", {
          stage: "playing",
          floor: 51,
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
        /^Floor 51 · Wave/,
      );
      await hudFits(page, s);
      await snap(page, info, `spire-z6-safe-wave-${s.name}`);

      // The elite's HUD (its name in the title).
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 55, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 55 · Elite",
      );
      await hudFits(page, s);
      await snap(page, info, `spire-z6-safe-elite-${s.name}`);

      // The Ascendant Lumiwick's briefing, its boss bar, and the results.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 60, stage: "briefing" });
        w.__push();
      });
      await expect(page.locator(".rc-card.is-briefing h2")).toHaveText(
        "Floor 60 · Ascendant Lumiwick",
      );
      await cardFits(page, s, ".rc-card.is-briefing", "#raid-instructions");
      await snap(page, info, `spire-z6-safe-briefing-${s.name}`);
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 60, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 60 · Phase 1/3",
      );
      await hudFits(page, s);
      await snap(page, info, `spire-z6-safe-boss-${s.name}`);
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 60, stage: "finished" });
        w.__push();
      });
      await expect(page.locator(".rc-card.is-results h2")).toHaveText(
        "Zone 6 conquered!",
      );
      await cardFits(page, s, ".rc-card.is-results", "#raid-retry");
      await snap(page, info, `spire-z6-safe-results-${s.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// Zone 7 (the Conductor Ring, the summit) on the same screens: the zone
// picker with all seven zones in one row, its floors in the hub, floor 61's
// HUD, the elite's with its polarity, the Ascendant Storm Twins' briefing
// and boss bar (both twins'), the whole Spire conquered, and the picker of
// someone who conquered it (every chip gold).
const ZONE7 = {
  raids: {
    ...ZONE6.raids,
    bosses: {
      ...ZONE6.raids.bosses,
      "storm-twins": { clears: 1, highestPeril: 3, bestSeconds: 320, runs: 2 },
    },
  },
  spire: {
    season: 0,
    highestFloor: 62,
    checkpoint: 61,
    attempts: 21,
    claimed: Array.from({ length: 62 }, (_, i) => i + 1),
    clears: {
      grumblecrag: 2,
      tidewyrm: 1,
      gloomshade: 1,
      somnara: 1,
      prismatail: 1,
      emberwing: 1,
      "storm-twins": 1,
    },
  },
};
for (const s of ZONE5_SIZES)
  test(`the Spire's zone 7 on touch screens at ${s.name}`, async ({
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
      }, ZONE7);
      const errors = await openHub(page);
      await setInsets(page, s.inset);
      const phone = s.height < 500;
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      await page.locator(".rh-room [data-raid-spire]").click();
      // The zone picker: all seven zones in one row, zone 7 picked, named once.
      const picker = page.locator(".rh-room .sp-zone-picker");
      await picker.scrollIntoViewIfNeeded();
      await settle(page);
      await expect(picker.locator("[data-ui-spire-zone]")).toHaveCount(7);
      await expect(
        picker.locator('[data-ui-spire-zone="7"][aria-pressed="true"]'),
      ).toBeVisible();
      await expect(
        page
          .locator(".rh-room")
          .locator(".sp-zone-info, .sp-route-zone")
          .locator("visible=true"),
      ).toContainText("Conductor Ring");
      expect(await pickerFits(page)).toEqual([]);
      inSafe(await boxOf(page, ".rh-room .sp-zones"), s, "zone picker");
      expect(await layoutProblems(page, { inset: s.inset, phone })).toEqual([]);
      await touchTargets(page, ".rh-room .sp-zone-picker");
      await touchTargets(page, ".rh-room .ui-panel-foot");
      await snap(page, info, `spire-z7-safe-picker-${s.name}`);
      // The floors tab: zone 7's heading and rows.
      await page.locator('[data-ui-spire-tab="floors"]').click();
      const head = page.locator('[data-spire-zone-floors="7"] .sp-zone-head');
      await head.scrollIntoViewIfNeeded();
      await settle(page);
      expect(await layoutProblems(page, { inset: s.inset, phone })).toEqual([]);
      await snap(page, info, `spire-z7-safe-floors-${s.name}`);

      // Floor 61 with a teammate: the HUD line.
      await page.evaluate(() =>
        (window as any).__room("spire", {
          stage: "playing",
          floor: 61,
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
        /^Floor 61 · Wave/,
      );
      await hudFits(page, s);
      await snap(page, info, `spire-z7-safe-wave-${s.name}`);

      // The elite's HUD (its name in the title).
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 65, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 65 · Elite",
      );
      // Its polarity: the marks, the cue, the pad never under the thumbs.
      let marked = false;
      for (let i = 0; i < 80 && !marked; i++)
        marked = await page.evaluate(() => {
          const w = window as any;
          w.__spireStep(0.25);
          return (w.__snap.raid.polarities ?? []).length > 0;
        });
      expect(marked).toBe(true);
      await expect(page.locator("#raid-hud .raid-callout")).toHaveText(
        "Polarity — find the opposite sign!",
      );
      const pad = await page.evaluate(
        () => (window as any).__snap.raid.polarityPad,
      );
      expect(pad).toBeTruthy();
      await page.waitForTimeout(300);
      await hudFits(page, s);
      await snap(page, info, `spire-z7-safe-elite-${s.name}`);

      // The Ascendant Storm Twins' briefing, its boss bar, and the results.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 70, stage: "briefing" });
        w.__push();
      });
      await expect(page.locator(".rc-card.is-briefing h2")).toHaveText(
        "Floor 70 · Ascendant Storm Twins",
      );
      await cardFits(page, s, ".rc-card.is-briefing", "#raid-instructions");
      await snap(page, info, `spire-z7-safe-briefing-${s.name}`);
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 70, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 70 · Phase 1/3",
      );
      // Both twins' own bars under the summed one.
      await expect(page.locator("#raid-hud .raid-twin-bar")).toHaveCount(2);
      await expect(
        page.locator("#raid-hud .raid-twin-bar").first(),
      ).toContainText("Fizz");
      await expect(
        page.locator("#raid-hud .raid-twin-bar").nth(1),
      ).toContainText("Crackle");
      await hudFits(page, s);
      await snap(page, info, `spire-z7-safe-boss-${s.name}`);
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 70, stage: "finished" });
        w.__push();
      });
      await expect(page.locator(".rc-card.is-results h2")).toHaveText(
        "Zone 7 conquered — the Spire is yours!",
      );
      await expect(
        page.locator(".rc-card.is-results .spire-conquered"),
      ).toContainText("all 7 zones of the Spire are conquered");
      await cardFits(page, s, ".rc-card.is-results", "#raid-retry");
      await snap(page, info, `spire-z7-safe-results-${s.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// The whole Spire conquered (floor 70 cleared; the database keeps
// checkpoint 61): the hub celebrates, every zone chip is gold, all seven
// fit in one row.
const SUMMIT = {
  raids: ZONE7.raids,
  spire: {
    ...ZONE7.spire,
    highestFloor: 70,
    checkpoint: 61,
    claimed: Array.from({ length: 70 }, (_, i) => i + 1),
  },
};
for (const s of ZONE5_SIZES)
  test(`the conquered Spire's zone picker on touch screens at ${s.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
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
      }, SUMMIT);
      const errors = await openHub(page);
      await setInsets(page, s.inset);
      const phone = s.height < 500;
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      await page.locator(".rh-room [data-raid-spire]").click();
      await expect(page.locator(".rh-room .sp-conquered")).toContainText(
        "The Spire is yours!",
      );
      const picker = page.locator(".rh-room .sp-zone-picker");
      await picker.scrollIntoViewIfNeeded();
      await settle(page);
      await expect(picker.locator("[data-ui-spire-zone]")).toHaveCount(7);
      await expect(picker.locator(".sp-zone.is-conquered")).toHaveCount(7);
      expect(await pickerFits(page)).toEqual([]);
      inSafe(await boxOf(page, ".rh-room .sp-zones"), s, "zone picker");
      expect(await layoutProblems(page, { inset: s.inset, phone })).toEqual([]);
      await touchTargets(page, ".rh-room .sp-zone-picker");
      await touchTargets(page, ".rh-room .ui-panel-foot");
      await snap(page, info, `spire-summit-safe-picker-${s.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
