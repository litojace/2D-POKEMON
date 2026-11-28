import { expect, test, type Page } from "@playwright/test";
import {
  openHub,
  openPlayPanel,
  pushUntilBattle,
  skipTour,
  snap,
  startPractice,
} from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

// The chat opened over a match's results (owner, 27 Nov 2026, an iPhone
// after a win against a bot): its tabs, field and Send floated on the
// sheet's dotted backdrop with no panel behind them, "No messages yet" read
// pale grey on the element colour, and the drawer hid the XP and Mastery
// tiles while its gear and Close sat on VICTORY. Now (themes/poster/
// plaza.css) the drawer is a solid ink sheet with a masthead in the
// element colour, and the results narrow to the room beside it: the
// title, the score, the tiles and every button whole and clear of the
// drawer, on screen, at the four sizes.
const SIZES = [
  { width: 667, height: 375, phone: true, island: false },
  { width: 844, height: 390, phone: true, island: false },
  { width: 852, height: 393, phone: true, island: true },
  { width: 1440, height: 900, phone: false, island: false },
];
const label = (s: (typeof SIZES)[number]) =>
  `${s.width}x${s.height}${s.island ? "-island" : ""}`;

/** A win against a bot, saved: the XP, season, mastery and coin tiles. */
async function botWin(page: Page) {
  await skipTour(page);
  await page.addInitScript(() => {
    const w = window as any;
    const journey = {
      xp: 260,
      recent: [{ ref: "match:cr-test", amount: 75, source: "match", at: "" }],
      season: {
        id: "2026-11",
        xp: 900,
        week: "2026-W48",
        goals: {},
        completed: [],
        tiers: 30,
        tierXp: 800,
        itemTiers: [5, 12, 20, 30],
      },
      spark: { day: "2026-11-26", used: 0, limit: 500 },
      unlocked: [],
    };
    w.__economyPatch = { journey: { ...journey, xp: 10, recent: [] } };
    w.__after = { journey, balance: 215 };
    w.__progress = {
      matches: 5,
      wins: 3,
      fighters: { voltkit: { matches: 5, wins: 3 } },
      achievements: [],
      season: { id: "2026-11", matches: 5, wins: 3 },
    };
    try {
      localStorage.setItem(
        "arena-unlocks:11111111-1111-4111-8111-111111111111",
        "9",
      );
    } catch {
      /* No storage. */
    }
  });
  await openHub(page);
  await page.evaluate(() => (window as any).__room("practice"));
  await openPlayPanel(page);
  await startPractice(page);
  await pushUntilBattle(page);
  await page.evaluate(() => {
    const w = window as any;
    const reply = w.__reply;
    w.__reply = (ev: string, data: unknown) =>
      ev === "match-report"
        ? {
            ok: true,
            report: { confirmed: true, records: [], achievements: [] },
          }
        : reply(ev, data);
    delete w.__snap.practice;
    const rival = w.__snap.players.find((p: any) => p.id !== "me");
    Object.assign(w.__snap, {
      phase: "finished",
      matchId: "cr-test",
      winner: "me",
      vsBot: "easy",
      activityStatus: "saved",
      scores: { me: 3, [rival.id]: 1 },
    });
    w.__push();
  });
  await expect(page.locator(".action-overlay h2")).toBeVisible();
  await page.evaluate(() => {
    const w = window as any;
    w.__economyPatch = w.__after;
    w.__sock.fire("economy-changed");
  });
  await expect(page.locator('.rw-tile[data-rw="xp"]')).toBeVisible();
}

for (const size of SIZES)
  test(`the chat over the results is an ink sheet beside them at ${label(size)}`, async ({
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
      await botWin(page);
      if (size.island) await setInsets(page, ISLAND);
      await page.locator("#chat-button").click();
      const drawer = page.locator(".chat-drawer");
      await expect(drawer).toBeVisible();
      await expect(page.locator(".chat-empty")).toBeVisible();
      // Past the drawer's slide-in, and the sheet's layout settled.
      await page.waitForTimeout(400);
      const look = await page.evaluate(() => {
        // Computed colours can come back as oklch(…): a canvas resolves them.
        const ctx = document.createElement("canvas").getContext("2d", {
          willReadFrequently: true,
        })!;
        const rgba = (css: string) => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = "#000";
          ctx.fillStyle = css;
          ctx.fillRect(0, 0, 1, 1);
          return Array.from(ctx.getImageData(0, 0, 1, 1).data);
        };
        const lum = ([r, g, b]: number[]) => {
          const f = (v: number) => {
            const c = v / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const ratio = (a: number[], b: number[]) => {
          const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
          return (hi + 0.05) / (lo + 0.05);
        };
        const d = document.querySelector<HTMLElement>(".chat-drawer")!;
        const bg = rgba(getComputedStyle(d).backgroundColor);
        const empty = rgba(
          getComputedStyle(document.querySelector(".chat-empty")!).color,
        );
        const ov = document.getElementById("arena-overlay")!;
        const r = (e: Element) => {
          const b = e.getBoundingClientRect();
          return {
            l: Math.round(b.left),
            r: Math.round(b.right),
            t: Math.round(b.top),
            b: Math.round(b.bottom),
          };
        };
        const card = ov.querySelector(".overlay-card")!;
        return {
          bg,
          emptyContrast: ratio(empty, bg),
          drawer: r(d),
          pieces: [
            card.querySelector(":scope > h2")!,
            card.querySelector(".result-score")!,
            ...card.querySelectorAll(".rw-tile"),
            ...card.querySelectorAll(".panel-actions button"),
          ].map((e) => ({
            what: (e.textContent ?? "").trim().slice(0, 24),
            ...r(e),
          })),
          // Nothing in the sheet wider than the sheet (its middle may
          // scroll up and down, never sideways).
          sideways: card.scrollWidth - card.clientWidth,
        };
      });
      // A solid ink sheet, its words at WCAG AA.
      expect(look.bg[3]).toBe(255);
      expect(Math.max(...look.bg.slice(0, 3))).toBeLessThan(24);
      expect(look.emptyContrast).toBeGreaterThanOrEqual(4.5);
      // The results beside it: clear of the drawer, on screen.
      for (const p of look.pieces) {
        expect
          .soft(p.l, `${p.what} clear of the chat`)
          .toBeGreaterThanOrEqual(look.drawer.r);
        expect.soft(p.r, `${p.what} on screen`).toBeLessThanOrEqual(size.width);
      }
      // The buttons wholly in view (the tiles may scroll under the title).
      for (const p of look.pieces.filter((p) =>
        /AGAIN|FIGHTER|SHARE|MENU/i.test(p.what),
      ))
        expect
          .soft(p.b, `${p.what} above the bottom`)
          .toBeLessThanOrEqual(size.height);
      expect(look.sideways).toBeLessThanOrEqual(1);
      await snap(page, info, `chat-results-${label(size)}`);
      // Closed again, the results take the whole screen as before.
      await page.locator(".chat-close").click();
      await expect(drawer).toBeHidden();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.getElementById("arena-overlay")!.getBoundingClientRect()
                .left,
          ),
        )
        .toBe(0);
    } finally {
      await context.close();
    }
  });
