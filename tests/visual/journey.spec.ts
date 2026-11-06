import { expect, test, type Page } from "@playwright/test";
import { box, inside, openLobby, snap } from "./helpers";
import { ISLAND, closeSpot, layoutProblems, setInsets } from "./ui-measure";

// UI remodel step 4 (docs/ui-remodel/PLAN.md): the Journey panel (Season ·
// Levels · Weekly arcade) at the four review sizes, measured with the shared
// layout rules (ui-measure.ts). It carries the checks of the old Adventure
// dialog's spec (journey-levels.spec.ts): levels 1–100, the Daily Spark and
// the 30-tier season (migration 035), nothing wider than the screen.
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
  // The old spec's narrow phone.
  { name: "700x390", width: 700, height: 390, phone: true },
];
// The server says it is Wednesday 4 Nov 2026, 12:00 in California: the
// weekly goals reset in 4 d 12 h, November's season ends in 26 d 12 h.
const SERVER_TIME = Date.parse("2026-11-04T20:00:00Z");
const journey = {
  xp: 61550 + 1200, // level 60, a little into the next level
  recent: [],
  season: {
    id: "2026-11",
    xp: 14600, // tier 12 of 30
    week: "2026-11-02",
    goals: { play: 3, skills: 50, raids: 1, arcade: 0 },
    completed: ["skills"],
    tiers: 30,
    tierXp: 1200,
    itemTiers: [5, 12, 20, 30],
  },
  spark: { day: "2026-11-04", used: 120, limit: 500 },
  unlocked: [],
};

async function withJourney(page: Page, owned: string[] = []) {
  await page.evaluate(
    ({ j, owned, serverTime }) => {
      (window as any).__serverTime = serverTime;
      const fetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const response = await fetch(input, init);
        const url = String(input instanceof Request ? input.url : input);
        if (!url.includes("/api/economy")) return response;
        const body = await response.json();
        return new Response(
          JSON.stringify({
            ...body,
            owned: [...body.owned, ...owned],
            journey: j,
          }),
          // Keep the server's clock header (X-Server-Time).
          { headers: response.headers },
        );
      };
    },
    { j: journey, owned, serverTime: SERVER_TIME },
  );
}

for (const size of SIZES)
  test(`the Journey's season, levels and weekly arcade at ${size.name}`, async ({
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
      const errors = await openLobby(page);
      const inset = size.island ? ISLAND : undefined;
      if (inset) await setInsets(page, inset);
      await withJourney(page);
      await page.click('.lobby-rail [data-lobby-action="journey"]');
      const room = page.locator(".journey-room");
      await expect(room).toHaveAttribute("data-journey-tab", "season");
      await expect(
        page.locator('.lobby-rail [data-lobby-action="journey"]'),
      ).toHaveAttribute("aria-current", "page");
      // A full panel: the Lobby behind it is covered and holds still.
      await expect(page.locator(".lobby-layer")).toHaveClass(/is-covered/);

      // Season: the banner, 30 tiers (the four cosmetics larger), the next
      // tier lit and in view, the weekly goals, the level road.
      await expect(room.locator(".journey-ring-text b")).toHaveText("60");
      await expect(room.locator(".journey-tier-count")).toHaveText(
        "Tier 12 / 30",
      );
      await expect(room.locator(".journey-banner-spark")).toContainText(
        "380 XP",
      );
      await expect(room.locator(".journey-banner .ui-timer")).toHaveText(
        "Ends in 26 d 12 h",
      );
      await expect(room.locator(".journey-tier")).toHaveCount(30);
      await expect(room.locator(".journey-tier.is-big")).toHaveCount(4);
      await expect(room.locator(".journey-tier.is-got")).toHaveCount(12);
      const next = room.locator(".journey-tier.is-next");
      await expect(next).toHaveAttribute("aria-label", /^Tier 13:/);
      expect(
        inside(
          await box(page, ".journey-tier.is-next"),
          await box(page, ".journey-road"),
        ),
      ).toBe(true);
      const coin = await box(page, ".journey-tier:not(.is-big)");
      const big = await box(page, ".journey-tier.is-big");
      expect(big.width).toBeGreaterThan(coin.width);
      await expect(room.locator(".journey-goal")).toHaveCount(4);
      await expect(
        room.locator(".journey-section .ui-timer").first(),
      ).toHaveText("Resets in 4 d 12 h");
      await expect(room.locator(".journey-levelroad")).toContainText(
        "Level 65",
      );
      // The next cosmetic to earn is picked and named in the action bar.
      await expect(room.locator(".journey-foot-text b")).toHaveText(
        "Tidal Voyage colors",
      );
      expect(await closeSpot(page)).toEqual([
        size.phone
          ? { right: 7, top: 7, size: 32 }
          : { right: 11, top: 11, size: 44 },
      ]);
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );
      await snap(page, info, `journey-season-${size.name}`);
      // The road scrolls sideways to the last tier; the page never does.
      await room
        .locator(".journey-road")
        .evaluate((e) => e.scrollTo({ left: e.scrollWidth }));
      await expect(room.locator(".journey-tier").last()).toBeInViewport();
      const fit = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth <= innerWidth + 1,
        spark: (() => {
          const s = document.querySelector<HTMLElement>(
            ".journey-banner-spark",
          )!;
          return s.scrollWidth <= s.clientWidth + 1;
        })(),
      }));
      expect(fit).toEqual({ page: true, spark: true });
      // Further down: the goals and level road, in sight, pass too.
      await room
        .locator(".journey-body")
        .evaluate((e) => e.scrollTo({ top: e.scrollHeight }));
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );

      // Levels: every milestone to 100, the Spark, the coins per level.
      await page.click('[data-ui-jtab="levels"]');
      await expect(room).toHaveAttribute("data-journey-tab", "levels");
      await expect(room).toContainText("100 coins from level 50 to 100");
      await expect(room.locator(".journey-prize")).toHaveCount(21);
      await expect(room).toContainText("Element Master");
      await expect(room.locator(".journey-banner-spark")).toBeVisible();
      await expect(room.locator(".journey-foot-text b")).toHaveText(
        "Nova entrance",
      );
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );
      await snap(page, info, `journey-levels-${size.name}`);
      const last = room.locator('[data-journey-item="element-master-frame"]');
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
      expect(
        await page.evaluate(() => {
          const d = document
            .querySelector(".journey-body")!
            .getBoundingClientRect();
          return [...document.querySelectorAll(".journey-prize")].every(
            (el) => {
              const r = el.getBoundingClientRect();
              return r.left >= d.left - 0.5 && r.right <= d.right + 0.5;
            },
          );
        }),
      ).toBe(true);

      // Weekly arcade: this week's event and three equal ways to play.
      await page.click('[data-ui-jtab="arcade"]');
      await expect(room).toHaveAttribute("data-journey-tab", "arcade");
      await expect(room.locator("[data-journey-play]")).toHaveCount(3);
      await expect(room.locator(".journey-arcade .ui-timer")).toHaveText(
        "Ends in 4 d 12 h",
      );
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );
      await snap(page, info, `journey-arcade-${size.name}`);
      await page.keyboard.press("Escape");
      await expect(room).toHaveCount(0);
      await expect(page.locator(".lobby-layer")).not.toHaveClass(/is-covered/);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("Journey rewards equip through the shared appearance route", async ({
  page,
}) => {
  const errors = await openLobby(page);
  await withJourney(page, ["prism-frame"]);
  await page.evaluate(() => {
    const w = window as any;
    w.__equips = [];
    const fetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("/api/raids/equip")) {
        const q = JSON.parse(String(init?.body));
        w.__equips.push(q);
        return Response.json({
          ok: true,
          progress: {
            v: 1,
            stats: {},
            unlocked: [],
            cosmetics: [],
            earned: [],
            loadout: { [q.slot]: q.item },
          },
        });
      }
      return fetch(input, init);
    };
  });
  await page.click('.lobby-rail [data-lobby-action="journey"]');
  await page.click('[data-ui-jtab="levels"]');
  // Not yours yet: Locked.
  await page.click('[data-journey-item="solar-aura"]');
  await expect(
    page.locator('[data-journey-equip="solar-aura"]'),
  ).toBeDisabled();
  await expect(page.locator('[data-journey-equip="solar-aura"]')).toHaveText(
    "Locked",
  );
  // Yours: Equip, then Equipped, and your portrait wears it.
  await page.click('[data-journey-item="prism-frame"]');
  const equip = page.locator('[data-journey-equip="prism-frame"]');
  await expect(equip).toBeEnabled();
  await equip.click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__equips.at(-1)))
    .toEqual({ slot: "frame", item: "prism-frame" });
  await expect(equip).toHaveText("Equipped");
  await expect(equip).toBeDisabled();
  await expect(page.locator(".journey-foot-text")).toContainText("Wearing it");
  await expect(
    page.locator("#account-profile [data-portrait-frame]"),
  ).toHaveAttribute("data-portrait-frame", "prism-frame");
  // Wardrobe leads to the fitting room.
  await page.click("[data-journey-wardrobe]");
  await expect(page.locator(".journey-room")).toHaveCount(0);
  await expect(page.locator(".fit-room")).toHaveAttribute(
    "data-fit-mode",
    "wardrobe",
  );
  expect(errors).toEqual([]);
});

test("the Journey works from the keyboard", async ({ page }) => {
  const errors = await openLobby(page);
  await withJourney(page);
  await page.focus('.lobby-rail [data-lobby-action="journey"]');
  await page.keyboard.press("Enter");
  await expect(page.locator(".journey-room")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-ui-jtab="season"]')).toBeFocused();
  // Arrows move through the tabs, and focus picks.
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-ui-jtab="levels"]')).toBeFocused();
  await expect(page.locator(".journey-room")).toHaveAttribute(
    "data-journey-tab",
    "levels",
  );
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".journey-room")).toHaveAttribute(
    "data-journey-tab",
    "season",
  );
  // The road scrolls with the keyboard; its rewards take focus and arrows.
  const reward = page
    .locator("[data-journey-road] [data-journey-item]")
    .first();
  await reward.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.locator("[data-journey-road] [data-journey-item]").nth(1),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.locator("[data-journey-road] [data-journey-item]").nth(1),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator(".journey-room")).toHaveCount(0);
  await expect(
    page.locator('.lobby-rail [data-lobby-action="journey"]'),
  ).toBeFocused();
  expect(errors).toEqual([]);
});

test("the Journey with reduced motion and Low graphics", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
    const errors = await openLobby(page);
    await withJourney(page);
    await page.click('.lobby-rail [data-lobby-action="journey"]');
    const room = page.locator(".journey-room");
    await expect(room).toHaveAttribute("data-graphics", "low");
    // Pictures only: no live fighter renderer in the panel.
    await expect(
      room.locator(".fighter-rig-stage, .shop-live-stage"),
    ).toHaveCount(0);
    await expect(room.locator(".journey-tier")).toHaveCount(30);
    expect(
      await room
        .locator(".journey-road")
        .evaluate((e) => getComputedStyle(e).scrollBehavior),
    ).toBe("auto");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

/** Frames whose picture reaches the edge of its box (the boxes clip, so a
 * frame touching the edge has lost its ornaments). Each box is photographed
 * with the frames shown and hidden; any frame pixel on the box's outermost
 * ring of pixels counts. The panel redraws on its timers, so boxes are found
 * again by index each time and frames are hidden by a style sheet (it
 * outlives a redraw, unlike a style on the element). */
const FRAME_BOX =
  ".journey-room :is(.journey-tier-art, .journey-lvl-art, .journey-prize-art, .journey-foot-art):has(> [data-frame-stars])";
async function clippedFrames(page: Page) {
  const count = await page.locator(FRAME_BOX).count();
  const bad: string[] = [];
  for (let i = 0; i < count; i++) {
    const spot = await page.evaluate(
      ([selector, i]) => {
        const art = document.querySelectorAll<HTMLElement>(selector)[i];
        art.scrollIntoView({ block: "center", inline: "center" });
        const r = art.getBoundingClientRect();
        // Rounded inwards: the picture's outer ring is the box's own edge.
        const x = Math.ceil(r.left),
          y = Math.ceil(r.top);
        return {
          id: art
            .querySelector("[data-frame-stars]")!
            .getAttribute("data-cosmetic"),
          clip: {
            x,
            y,
            width: Math.floor(r.right) - x,
            height: Math.floor(r.bottom) - y,
          },
        };
      },
      [FRAME_BOX, i] as const,
    );
    const shot = async () =>
      (
        await page.screenshot({ clip: spot.clip, animations: "disabled" })
      ).toString("base64");
    const on = await shot();
    const hide = await page.addStyleTag({
      content: "[data-frame-stars] { visibility: hidden !important; }",
    });
    const off = await shot();
    await hide.evaluate((e) => e.remove());
    const edge = await page.evaluate(
      async ([a, b]) => {
        const pixels = async (src: string) => {
          const img = new Image();
          img.src = `data:image/png;base64,${src}`;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          const g = c.getContext("2d")!;
          g.drawImage(img, 0, 0);
          return g.getImageData(0, 0, c.width, c.height);
        };
        const [p, q] = [await pixels(a), await pixels(b)];
        let hits = 0;
        for (let y = 0; y < p.height; y++)
          for (let x = 0; x < p.width; x++) {
            if (x > 0 && y > 0 && x < p.width - 1 && y < p.height - 1) continue;
            const k = (y * p.width + x) * 4;
            const d =
              Math.abs(p.data[k] - q.data[k]) +
              Math.abs(p.data[k + 1] - q.data[k + 1]) +
              Math.abs(p.data[k + 2] - q.data[k + 2]);
            if (d > 24) hits++;
          }
        return hits;
      },
      [on, off],
    );
    if (edge) bad.push(`${spot.id} (${edge} edge pixels)`);
  }
  return { count, bad };
}

for (const size of [SIZES[0], SIZES[3]])
  test(`every frame on the Journey fits its box at ${size.name}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      if (size.island) await setInsets(page, ISLAND);
      await withJourney(page);
      await page.click('.lobby-rail [data-lobby-action="journey"]');
      // The Journey's data has arrived (the 30-tier season road).
      await expect(page.locator(".journey-room .journey-tier")).toHaveCount(30);
      const season = await clippedFrames(page);
      await page.click('[data-ui-jtab="levels"]');
      await expect(page.locator(".journey-room")).toHaveAttribute(
        "data-journey-tab",
        "levels",
      );
      // The level road: 21 prizes (level 100 gives a title and a frame).
      await expect(page.locator(".journey-room .journey-prize")).toHaveCount(
        21,
      );
      const levels = await clippedFrames(page);
      // The season road's frame and the level road's five.
      expect(season.count + levels.count).toBeGreaterThanOrEqual(6);
      expect([...season.bad, ...levels.bad]).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
