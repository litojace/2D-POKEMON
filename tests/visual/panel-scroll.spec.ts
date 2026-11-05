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
  { name: "ranks", root: "#dialog", open: rail("ranks") },
  { name: "friends", root: "#dialog", open: rail("friends") },
  {
    name: "profile",
    root: "#dialog",
    open: async (page) => {
      await page.click("#account-profile");
      await expect(page.locator("#dialog")).toBeVisible();
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
    name: "play modes",
    root: "body",
    open: openPlayPanel,
  },
];

/** The Farm's sheets, from its menu. */
const FARM_SHEETS = [
  "shop",
  "orders",
  "market",
  "barn",
  "book",
  "decor",
  "cup",
  "balloon",
  "friends",
].map((sheet): Screen => ({
  name: `farm ${sheet}`,
  root: "#fm-sheet",
  open: async (page) => {
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    await expect(page.locator("#fm-menu-btn")).toBeVisible({
      timeout: 30_000,
    });
    await page.click("#fm-menu-btn");
    await page.locator(`#fm-dock [data-sheet="${sheet}"]`).click();
    await expect(page.locator("#fm-sheet")).toBeVisible();
  },
}));

type Report = Record<
  string,
  { problems: string[]; cuts: string[]; seen: string[] }
>;

async function sweepScreens(page: Page, screens: Screen[], report: Report) {
  for (const screen of screens) {
    try {
      // A fresh Lobby: close whatever is open.
      for (
        let i = 0;
        i < 3 && !(await page.locator("#lobby-play").isVisible());
        i++
      ) {
        await page.keyboard.press("Escape");
        await settle(page, 300);
      }
      if (!(await page.locator("#lobby-play").isVisible()))
        await page
          .click('#hub-scenes [data-hub-scene="lobby"]', { timeout: 3000 })
          .catch(() => {});
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

for (const size of SIZES)
  test(`every panel scrolls to its end at ${size.name}`, async ({
    browser,
  }) => {
    test.setTimeout(900_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: true,
    });
    const report: Report = {};
    try {
      const page = await context.newPage();
      const errors = await openHub(page);
      if (size.island) await setInsets(page, ISLAND);
      expect(await fingerWorks(page), "the swipe itself").toBe(true);
      await sweepScreens(page, HUB_SCREENS, report);
      await sweepScreens(page, FARM_SHEETS, report);
      // A practice match: the in-match menu, the practice panel, the results.
      await page.keyboard.press("Escape");
      await page.click('#hub-scenes [data-hub-scene="lobby"]').catch(() => {});
      await page.evaluate(() => (window as any).__room("practice"));
      await openPlayPanel(page);
      await page.click("#practice");
      await pushUntilBattle(page);
      await page.click("#battle-menu");
      await settle(page);
      report["match menu"] = await scrollSweep(page, "#dialog");
      await page.click("#settings-practice");
      await expect(page.locator(".practice-panel")).toBeVisible();
      await settle(page);
      report["practice panel"] = await scrollSweep(page, ".practice-panel");
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
      const lines: string[] = [];
      for (const [name, r] of Object.entries(report))
        lines.push(
          `${name}: ${r.seen.length} scroller(s)${r.seen.length ? ` [${r.seen.join("; ")}]` : ""}${r.problems.length ? `\n    PROBLEMS ${r.problems.join("\n    PROBLEMS ")}` : ""}${r.cuts.length ? `\n    CUT ${r.cuts.slice(0, 6).join("\n    CUT ")}` : ""}`,
        );
      console.log(`SWEEP ${size.name}\n${lines.join("\n")}`);
      const bad = Object.entries(report).filter(
        ([, r]) => r.problems.length || r.cuts.length,
      );
      expect(
        bad.map(([n]) => n),
        "panels that can't be scrolled to the end",
      ).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
