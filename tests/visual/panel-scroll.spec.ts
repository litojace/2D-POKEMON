import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";
import { fingerWorks, scrollSweep } from "./scroll-sweep";

// Every panel across the game: when its content is longer than the panel,
// a finger can scroll to the end of it, and nothing is cut off by a box
// that doesn't scroll (owner, 5 Nov). See scroll-sweep.ts.
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
  { name: "1280x720", width: 1280, height: 720, phone: false },
];

type Screen = {
  name: string;
  root: string;
  open: (page: Page) => Promise<void>;
};
const rail = (action: string) => async (page: Page) => {
  await page.click(`.lobby-rail [data-lobby-action="${action}"]`);
};
const settle = (page: Page, ms = 700) => page.waitForTimeout(ms);
const HUB = ".ui-panel-host";

/** Fifty friends, ten requests each way, thirty on the Friends board and
 * twenty recent players: more than any panel shows at once. */
async function crowd(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    const id = (n: number) =>
      `55555555-5555-4555-8555-${String(n).padStart(12, "0")}`;
    const fighters = ["voltkit", "cindrake", "tidefin", "lumoth", "terradon"];
    w.__friends = {
      code: "a1b2c3d4",
      friends: Array.from({ length: 50 }, (_, i) => ({
        id: id(i),
        name: i === 3 ? "Bartholomew-the-Magnificent" : `Friend ${i}`,
        online: i % 4 === 0,
        activity: i % 8 === 0 ? "match" : "menu",
        room: i % 8 === 0 ? "ROOM01" : null,
        fighter: fighters[i % 5],
        lastOnline: new Date(Date.now() - (i + 1) * 3600e3).toISOString(),
      })),
      incoming: Array.from({ length: 10 }, (_, i) => ({
        id: id(100 + i),
        name: `Asker ${i}`,
      })),
      outgoing: Array.from({ length: 10 }, (_, i) => ({
        id: id(200 + i),
        name: `Asked ${i}`,
      })),
    };
    w.__friendsBoard = {
      season: new Date().toISOString().slice(0, 7),
      rows: Array.from({ length: 31 }, (_, i) => ({
        id: i === 7 ? "11111111-1111-4111-8111-111111111111" : id(i),
        place: i + 1,
        name: i === 7 ? "tester" : `Friend ${i}`,
        rating: 1500 - i * 10,
        rankName: "Master",
        placementLeft: 0,
        wins: 10,
        matches: 20,
        me: i === 7,
      })),
    };
    w.__recent = {
      players: Array.from({ length: 20 }, (_, i) => ({
        id: id(300 + i),
        name: `Rival ${i}`,
        fighter: fighters[i % 5],
        lastPlayed: new Date(Date.now() - (i + 1) * 3600e3).toISOString(),
        matches: 2,
        together: 0,
        wins: 1,
        losses: 1,
        relation: i % 3 === 0 ? "friend" : "none",
        online: i % 2 === 0,
      })),
    };
  });
}

/** Screens opened from the Lobby; each starts from a fresh Lobby. */
const HUB_SCREENS: Screen[] = [
  {
    name: "fighters",
    root: HUB,
    open: async (page) => {
      await rail("fighters")(page);
      await expect(page.locator("[data-roster-card]").first()).toBeVisible();
    },
  },
  {
    name: "fighter detail",
    root: HUB,
    open: async (page) => {
      await rail("fighters")(page);
      await page.locator('[data-roster-card="cindrake"]').click();
      const details = page.locator("[data-roster-details]").first();
      if (await details.isVisible()) await details.click();
      await expect(page.locator('[data-roster-mode="detail"]')).toBeVisible();
    },
  },
  ...(["today", "skins", "mythic", "collections"] as const).map((section) => ({
    name: `shop ${section}`,
    root: HUB,
    open: async (page: Page) => {
      await rail("shop")(page);
      await page.click(`[data-ui-section="${section}"]`);
    },
  })),
  {
    name: "wardrobe",
    root: HUB,
    open: async (page) => {
      await rail("wardrobe")(page);
      await expect(page.locator("[data-fit-slot]").first()).toBeVisible();
    },
  },
  ...(["frame", "aura", "champion"] as const).map((slot) => ({
    name: `wardrobe ${slot}`,
    root: HUB,
    open: async (page: Page) => {
      await rail("wardrobe")(page);
      await page.click(`[data-fit-slot="${slot}"]`);
    },
  })),
  {
    name: "missions",
    root: HUB,
    open: rail("missions"),
  },
  ...(["season", "levels", "arcade"] as const).map((tab) => ({
    name: `journey ${tab}`,
    root: HUB,
    open: async (page: Page) => {
      await rail("journey")(page);
      await page.click(`[data-ui-jtab="${tab}"]`);
    },
  })),
  { name: "raid hall", root: HUB, open: rail("raids") },
  ...(["party", "attacks", "rewards", "guide"] as const).map((tab) => ({
    name: `boss ${tab}`,
    root: HUB,
    open: async (page: Page) => {
      await rail("raids")(page);
      await page.click('[data-raid-card="grumblecrag"]');
      await page.click(`[data-ui-raid-tab="${tab}"]`);
    },
  })),
  // Step 6: Ranks (both boards) and the Friends sheet (each tab), filled
  // with more than fits: fifty friends, many requests, a long board.
  ...(["everyone", "friends"] as const).map((scope) => ({
    name: `ranks ${scope}`,
    root: HUB,
    open: async (page: Page) => {
      await crowd(page);
      await rail("ranks")(page);
      await expect(page.locator(".ranks-panel .rk-row").first()).toBeVisible();
      if (scope === "friends") {
        await page.click('[data-ui-scope="friends"]');
        await expect(page.locator(".rk-list .rk-row")).toHaveCount(31);
      }
    },
  })),
  ...(["friends", "requests", "recent"] as const).map((tab) => ({
    name: `friends ${tab}`,
    root: HUB,
    open: async (page: Page) => {
      await crowd(page);
      await rail("friends")(page);
      await expect(page.locator(".fr-row").first()).toBeVisible();
      if (tab !== "friends") {
        await page.click(`[data-ui-friends-tab="${tab}"]`);
        await expect(page.locator(".fr-row").first()).toBeVisible();
      }
    },
  })),
  {
    // A panel inside the Lobby since step 7.
    name: "profile",
    root: HUB,
    open: async (page) => {
      await page.click("#account-profile");
      await expect(
        page.locator(".profile-panel .pf-tile").first(),
      ).toBeVisible();
    },
  },
  {
    name: "invite a friend",
    root: "#dialog",
    open: async (page) => {
      await page.locator('[data-lobby-action="invite"]').first().click();
      await expect(page.locator(".party-invite")).toBeVisible();
    },
  },
  {
    name: "settings",
    root: "#dialog",
    open: async (page) => {
      await page.evaluate(() => document.getElementById("settings")!.click());
      await expect(page.locator("#dialog .settings-screen")).toBeVisible();
    },
  },
  {
    name: "controls",
    root: "#dialog",
    open: async (page) => {
      await page.evaluate(() => document.getElementById("settings")!.click());
      await page.click("#open-controls");
    },
  },
  {
    name: "credits",
    root: "#dialog",
    open: async (page) => {
      await page.evaluate(() => document.getElementById("settings")!.click());
      await page.click("#settings-credits");
      await expect(page.locator("#dialog .credits-screen")).toBeVisible();
    },
  },
  {
    name: "report a player",
    root: "#dialog",
    open: async (page) => {
      await page.evaluate(() => document.getElementById("settings")!.click());
      await page.click("#settings-report");
    },
  },
  {
    // The mode menu by itself: on a phone it shows three modes and scrolls.
    name: "mode menu",
    root: "#lobby-mode-menu",
    open: async (page) => {
      await page.click("#lobby-mode");
      await expect(page.locator("#lobby-mode-menu")).toBeVisible();
    },
  },
  {
    // More ways to play: the drawer (the mode menu closes as it opens).
    name: "play modes",
    root: "#home-play-panel",
    open: openPlayPanel,
  },
];

/** The Farm's sheets, from its right rail. */
const FARM_SHEETS = ["shop", "friends", "decor", "book"].map(
  (sheet): Screen => ({
    name: `farm ${sheet}`,
    root: "#fm-sheet",
    open: async (page) => {
      // Stay on the Farm between its sheets (closeAll closes the sheet).
      if (!(await page.locator("#fm-rail").isVisible()))
        await page.click('#hub-scenes [data-hub-scene="farm"]');
      await expect(page.locator("#fm-rail")).toBeVisible({ timeout: 30_000 });
      await page.locator(`#fm-rail [data-sheet="${sheet}"]`).click();
      await expect(page.locator("#fm-sheet")).toBeVisible();
    },
  }),
);

type Report = Record<
  string,
  { problems: string[]; cuts: string[]; seen: string[] }
>;

/** Close whatever is open (a dialog, a hub panel, a Farm sheet, a menu)
 * and stand on the Lobby. */
async function closeAll(page: Page) {
  const open = () =>
    page.evaluate(
      () =>
        !!document.querySelector(
          "dialog[open], .ui-panel-host .ui-panel, #fm-sheet:not([hidden]), #lobby-mode-menu:not([hidden]), #home-play-panel:not([hidden])",
        ),
    );
  for (let i = 0; i < 5 && (await open()); i++) {
    await page.keyboard.press("Escape");
    await settle(page, 300);
  }
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLDialogElement>("dialog[open]")
      .forEach((d) => d.close()),
  );
  // The play drawer and the mode menu close from their own buttons.
  const close = page.locator(
    "#home-play-panel:not([hidden]) [data-home-close]",
  );
  if (await close.count()) await close.first().click();
  if (await page.locator("#lobby-mode-menu:not([hidden])").count())
    await page.click("#lobby-mode");
  // On the Farm with its sheet closed: stay (its sheets open from its rail).
  if (await page.locator("#fm-rail").isVisible()) return;
  if (!(await page.locator("#lobby-play").isVisible()))
    await page
      .click('#hub-scenes [data-hub-scene="lobby"]', { timeout: 3000 })
      .catch(() => {});
  await expect(page.locator("#lobby-play")).toBeVisible();
}

async function sweepScreens(page: Page, screens: Screen[], report: Report) {
  for (const screen of screens) {
    try {
      await closeAll(page);
      await screen.open(page);
      await settle(page);
      report[screen.name] = await scrollSweep(page, screen.root);
    } catch (e) {
      report[screen.name] = {
        problems: [`could not open: ${String(e).split("\n")[0].slice(0, 160)}`],
        cuts: [],
        seen: [],
      };
    }
  }
}

const print = (size: string, name: string, r: Report[string]) =>
  console.log(
    `SWEEP ${size} | ${name}: ${r.seen.length} scroller(s)${r.seen.length ? ` [${r.seen.join("; ")}]` : ""}${r.problems.length ? `\n    PROBLEM ${r.problems.join("\n    PROBLEM ")}` : ""}${r.cuts.length ? `\n    CUT ${r.cuts.slice(0, 8).join("\n    CUT ")}` : ""}`,
  );

// Ranks, Friends and the Profile have long lists (fifty friends): about as
// slow to sweep as all the other panels together, so they are a test of
// their own and neither test comes near its time limit on a slow runner.
const SOCIAL = (s: Screen) => /^(ranks|friends|profile)\b/.test(s.name);
const GROUPS: Record<string, Screen[]> = {
  "hub panels": HUB_SCREENS.filter((s) => s.root === HUB && !SOCIAL(s)),
  "social panels": HUB_SCREENS.filter((s) => s.root === HUB && SOCIAL(s)),
  "dialogs and menus": HUB_SCREENS.filter((s) => s.root !== HUB),
  "farm sheets": FARM_SHEETS,
};

async function start(
  size: (typeof SIZES)[number],
  browser: import("@playwright/test").Browser,
) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    isMobile: size.phone,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const errors = await openHub(page);
  if (size.island) await setInsets(page, ISLAND);
  expect(await fingerWorks(page), "the swipe itself").toBe(true);
  return { context, page, errors };
}
const failing = (report: Report) =>
  Object.entries(report)
    .filter(([, r]) => r.problems.length || r.cuts.length)
    .map(([n]) => n);

for (const size of SIZES) {
  for (const [group, screens] of Object.entries(GROUPS))
    test(`${group} scroll to their end at ${size.name}`, async ({
      browser,
    }) => {
      test.setTimeout(900_000);
      const { context, page, errors } = await start(size, browser);
      const report: Report = {};
      try {
        // SWEEP_ONLY=ranks,friends sweeps only screens whose names start so.
        const only = process.env.SWEEP_ONLY?.split(",");
        for (const screen of screens.filter(
          (s) => !only || only.some((o) => s.name.startsWith(o)),
        )) {
          await sweepScreens(page, [screen], report);
          print(size.name, screen.name, report[screen.name]);
        }
        expect(
          failing(report),
          "panels that can't be scrolled to the end",
        ).toEqual([]);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  test(`the match's panels scroll to their end at ${size.name}`, async ({
    browser,
  }) => {
    test.setTimeout(600_000);
    const { context, page, errors } = await start(size, browser);
    const report: Report = {};
    try {
      await page.evaluate(() => (window as any).__room("practice"));
      await openPlayPanel(page);
      await page.click("#practice");
      await pushUntilBattle(page);
      await page.click("#battle-menu");
      await settle(page);
      report["match menu"] = await scrollSweep(page, "#dialog");
      print(size.name, "match menu", report["match menu"]);
      await page.click("#settings-practice");
      await expect(page.locator(".practice-panel")).toBeVisible();
      await settle(page);
      report["practice panel"] = await scrollSweep(page, ".practice-panel");
      print(size.name, "practice panel", report["practice panel"]);
      await page.click("#practice-close");
      await page.evaluate(() => {
        const w = window as any;
        delete w.__snap.practice;
        Object.assign(w.__snap, {
          phase: "finished",
          matchId: "sweep",
          winner: "me",
          vsBot: true,
          scores: { me: 3, "target-ABC123": 0 },
        });
        w.__push();
      });
      await expect(page.locator(".action-overlay h2")).toBeVisible();
      await settle(page);
      report["match results"] = await scrollSweep(page, "#arena-overlay");
      print(size.name, "match results", report["match results"]);
      expect(
        failing(report),
        "panels that can't be scrolled to the end",
      ).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
