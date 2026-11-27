import { expect, test, type Page } from "@playwright/test";
import {
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
  startPractice,
  skipTour,
} from "./helpers";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

// PvP audit (docs/pvp-plan.md §3): a new mobile player's path from the
// sign-in screen to a bot match, on the owner's iPhone size (956x440
// landscape, dpr 3, touch). It records what it sees in the test output and
// checks the things the plan relies on: a new player's PLAY asks for an Easy
// bot in one tap, the first match's coach speaks touch, and every touch
// button is at least 44 px and on screen.
const PHONE = {
  viewport: { width: 956, height: 440 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

async function newPlayer(page: Page) {
  await skipTour(page);
  await page.addInitScript(() => {
    const w = window as any;
    w.__economyPatch = {
      journey: {
        xp: 0,
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
    w.__emitted = [];
    w.__emit = (ev: string, data: unknown) => w.__emitted.push({ ev, data });
  });
}

test("signed out at 956x440: what stands between install and the Lobby", async ({
  browser,
}, info) => {
  const context = await browser.newContext(PHONE);
  try {
    const page = await context.newPage();
    await page.route("**/stubs.ts*", async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()).replace(
          "getSession: async () => ({ data: { session } })",
          "getSession: async () => ({ data: { session: null } })",
        ),
      });
    });
    await page.goto("/");
    await expect(page.locator("#guest-form")).toBeVisible();
    const choices = await page
      .locator("button:visible, a[href]:visible, input:visible")
      .evaluateAll((els) =>
        els.map((e) =>
          (
            (e as HTMLElement).innerText ||
            (e as HTMLInputElement).placeholder ||
            e.getAttribute("aria-label") ||
            ""
          ).trim(),
        ),
      );
    console.log(
      `[first-match] sign-in screen controls: ${JSON.stringify(choices)}`,
    );
    await snap(page, info, "first-match-signin-956");
    // Guest: one tap, then the age question (two answers and Continue).
    await page.locator("#guest-form button[type=submit]").tap();
    const age = page.locator("[data-age-gate]");
    await expect(age).toBeVisible();
    const fields = await age.locator("select, input").count();
    console.log(`[first-match] age question fields: ${fields}`);
    await snap(page, info, "first-match-age-956");
  } finally {
    await context.close();
  }
});

test("a new player's first PLAY at 956x440 is one tap to an Easy bot, coached for touch", async ({
  browser,
}, info) => {
  const context = await browser.newContext(PHONE);
  try {
    const page = await context.newPage();
    await newPlayer(page);
    const errors = await openHub(page);
    const mode = (await page.locator("#lobby-mode").innerText()).replace(
      /\s+/g,
      " ",
    );
    const guide = (
      await page.locator("#lobby-journey-card").innerText()
    ).replace(/\s+/g, " ");
    console.log(
      `[first-match] Lobby mode button: "${mode}"; guide card: "${guide}"`,
    );
    await snap(page, info, "first-match-lobby-956");
    // PLAY, once: the client asks the server for a bot match at Easy.
    await page.evaluate(() => ((window as any).__emitted = []));
    await page.locator("#lobby-play").tap();
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).__emitted.map((e: any) => e.ev)),
      )
      .toContain("bot-match");
    const sent = await page.evaluate(
      () =>
        (window as any).__emitted.find((e: any) => e.ev === "bot-match").data,
    );
    console.log(`[first-match] PLAY sent bot-match ${JSON.stringify(sent)}`);
    expect(sent.difficulty).toBe("easy");

    // The harness has no bot: a practice room made into a bot match, as in
    // battle-coach.spec.ts.
    await page.evaluate(() => (window as any).__room("practice"));
    await openPlayPanel(page);
    await startPractice(page);
    await page.evaluate(() => {
      const w = window as any;
      delete w.__snap.practice;
      w.__snap.vsBot = "easy";
    });
    await pushUntilBattle(page);
    const coach = page.locator("#battle-coach");
    await expect(coach).toBeVisible();
    console.log(`[first-match] coach: "${(await coach.innerText()).trim()}"`);
    const buttons = await page
      .locator("#mobile-controls .touch-buttons button")
      .evaluateAll((els) =>
        els.map((b) => {
          const r = b.getBoundingClientRect();
          const el = b as HTMLElement;
          return {
            id: el.dataset.skill ?? el.dataset.action ?? "?",
            size: Math.round(Math.min(r.width, r.height)),
            left: Math.round(r.left),
            right: Math.round(r.right),
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
          };
        }),
      );
    console.log(`[first-match] touch buttons: ${JSON.stringify(buttons)}`);
    for (const b of buttons) {
      expect(b.size).toBeGreaterThanOrEqual(44);
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(956);
      expect(b.bottom).toBeLessThanOrEqual(440);
    }
    await snap(page, info, "first-match-battle-956");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
