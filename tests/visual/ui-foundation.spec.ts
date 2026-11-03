import { expect, test, type Page } from "@playwright/test";
import { box, openLobby, snap } from "./helpers";
import {
  ISLAND,
  closeSpot,
  inkOffset,
  layoutProblems,
  setInsets,
} from "./ui-measure";

// UI remodel step 1 (docs/ui-remodel/PLAN.md): the shared tokens and
// components, the hub screen shell, the toast and the server clock. The
// shell is measured with sample screens built from the real components;
// each remodelled screen will run the same checks on itself.
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
];
const today = new Date().toISOString().slice(0, 10);
// The server says it is 21:30 in California (04:30 UTC): the daily reset is
// 2 h 30 min away, whatever this machine's clock says.
const SERVER_TIME = Date.parse("2026-10-18T04:30:00Z");
const MISSIONS = [
  ["play-2", "easy", "Play 2 matches", 2, 2, 40, true],
  ["skills-30", "easy", "Use 30 skills", 18, 30, 40, false],
  ["bot-wins-3", "medium", "Win 3 matches against bots", 1, 3, 70, false],
  ["raids-2", "medium", "Clear 2 raids", 0, 2, 70, false],
  ["raid-solo-1", "hard", "Clear a raid on your own", 0, 1, 120, false],
  ["hard-bot", "hard", "Beat a Hard bot", 0, 1, 120, false],
].map(([id, tier, text, progress, target, coins, done], slot) => ({
  day: today,
  slot,
  id,
  tier,
  text,
  progress,
  target,
  coins,
  done,
}));

/** The Lobby's own boxes: nothing new may cover them. */
async function lobbyBoxes(page: Page) {
  return page.evaluate(() =>
    [
      "#account-profile",
      "#hub-scenes",
      "#account-coins > *",
      ".lobby-rail",
      ".lobby-party",
      ".lobby-nameplate",
      ".lobby-cards",
      ".lobby-play",
      ".lobby-emotes",
    ].flatMap((s) => {
      const e = document.querySelector(s);
      if (!e) return [];
      const r = e.getBoundingClientRect();
      return r.width && r.height
        ? [{ s, x: r.x, y: r.y, w: r.width, h: r.height }]
        : [];
    }),
  );
}
const overlaps = (
  a: { x: number; y: number; w: number; h: number },
  b: typeof a,
) =>
  a.x < b.x + b.w - 1 &&
  b.x < a.x + a.w - 1 &&
  a.y < b.y + b.h - 1 &&
  b.y < a.y + a.h - 1;

for (const size of SIZES)
  test(`the hub shell, components, toast and server clock at ${size.name}`, async ({
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
      await page.addInitScript(
        ({ missions, serverTime }) => {
          const w = window as any;
          w.__missions = missions;
          w.__serverTime = serverTime;
          w.__friends = {
            code: "a1b2c3d4",
            friends: [],
            incoming: [{ id: "r1", name: "Pip" }],
            outgoing: [],
          };
        },
        { missions: MISSIONS, serverTime: SERVER_TIME },
      );
      const errors = await openLobby(page);
      const inset = size.island ? ISLAND : undefined;
      if (inset) await setInsets(page, inset);

      // The friend-request toast: plain words, under the HUD, over nothing.
      const toast = page.locator("#toast");
      await expect(toast).toHaveClass(/show/);
      await expect(toast).toHaveText(
        "Pip wants to be friends. Open Friends to answer.",
      );
      const t = await box(page, "#toast");
      const tb = { x: t.x, y: t.y, w: t.width, h: t.height };
      for (const b of await lobbyBoxes(page))
        expect(overlaps(tb, b), `the toast covers ${b.s}`).toBe(false);
      expect(tb.x).toBeGreaterThanOrEqual(inset?.left ?? 0);
      expect(tb.x + tb.w).toBeLessThanOrEqual(size.width - (inset?.right ?? 0));
      await snap(page, info, `ui-toast-${size.name}`);

      // Countdowns follow the server's clock, not this machine's.
      await expect(page.locator("#lobby-missions-card")).toContainText(
        "New in 2 h 30 min",
      );

      // A full panel: inside the Lobby, right of the rail, under the HUD.
      await page.evaluate(async () => {
        const w = window as any;
        w.__ui = await import("/ui-kit.ts");
        w.__ui.openDemo("panel");
      });
      const panel = page.locator(".ui-panel");
      await expect(panel).toBeVisible();
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );
      // The rail stays usable and shows where you are.
      await expect(
        page.locator('.lobby-rail [data-lobby-action="shop"]'),
      ).toHaveAttribute("aria-current", "page");
      expect(
        await page.evaluate(() => {
          const b = document.querySelector<HTMLElement>(
            '.lobby-rail [data-lobby-action="raids"]',
          )!;
          const r = b.getBoundingClientRect();
          const hit = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          );
          return !b.closest("[inert]") && !!hit && b.contains(hit);
        }),
        "the rail can be tapped with a panel open",
      ).toBe(true);
      // Focus moved into the panel; what it covers leaves the tab order.
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest(".ui-panel"),
        ),
      ).toBe(true);
      expect(
        await page.evaluate(() =>
          [".lobby-stage", ".lobby-cards", ".lobby-play"].map((s) => {
            const e = document.querySelector<HTMLElement>(s)!;
            return e.inert && getComputedStyle(e).visibility === "hidden";
          }),
        ),
        "the Lobby under a panel is out of the tab order and not drawn",
      ).toEqual([true, true, true]);
      // Close: one spot and one size.
      const [spot] = await closeSpot(page);
      expect(spot).toEqual(
        size.phone
          ? { right: 7, top: 7, size: 32 }
          : { right: 11, top: 11, size: 44 },
      );
      // Labels are centred in their buttons, measured on the pixels.
      for (const label of ["Revert", "Equip"]) {
        const ink = await inkOffset(
          page,
          panel.locator(".ui-actions .ui-btn", { hasText: label }),
        );
        expect(
          Math.abs(ink.dx),
          `${label}: ink ${ink.dx},${ink.dy} px off centre`,
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(ink.dy),
          `${label}: ink ${ink.dx},${ink.dy} px off centre`,
        ).toBeLessThanOrEqual(1);
      }
      const x = await inkOffset(page, panel.locator(".ui-close"));
      expect(Math.abs(x.dx)).toBeLessThanOrEqual(1);
      expect(Math.abs(x.dy)).toBeLessThanOrEqual(1);
      // A toast with a screen open: above the action bar, clear of the head
      // and every button.
      await page.evaluate(() => {
        const t = document.getElementById("toast")!;
        t.textContent = "Midnight is yours. Equip it any time.";
        t.classList.add("show");
      });
      const clash = await page.evaluate(() => {
        const t = document.getElementById("toast")!.getBoundingClientRect();
        return Array.from(
          document.querySelectorAll(
            ".ui-panel-head, .ui-panel-foot .ui-btn, .ui-tabs",
          ),
        )
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return (
              t.left < r.right - 1 &&
              r.left < t.right - 1 &&
              t.top < r.bottom - 1 &&
              r.top < t.bottom - 1
            );
          })
          .map((e) => e.className);
      });
      expect(clash, "the toast covers").toEqual([]);
      // Pictures decoded before the screenshot (this machine draws slowly).
      await page.evaluate(() =>
        Promise.all(
          Array.from(
            document.querySelectorAll<HTMLImageElement>(".ui-panel img"),
          ).map((i) => i.decode().catch(() => {})),
        ),
      );
      await snap(page, info, `ui-panel-${size.name}`);
      await page.evaluate(() =>
        document.getElementById("toast")!.classList.remove("show"),
      );
      // Escape closes it and gives the Lobby back.
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      expect(
        await page.evaluate(() =>
          [".lobby-stage", ".lobby-cards", ".lobby-play"].map((s) => {
            const e = document.querySelector<HTMLElement>(s)!;
            return !e.inert && getComputedStyle(e).visibility === "visible";
          }),
        ),
        "the Lobby is back after Escape",
      ).toEqual([true, true, true]);
      await expect(
        page.locator('.lobby-rail [data-lobby-action="shop"]'),
      ).not.toHaveAttribute("aria-current", "page");

      // A sheet: the fighter and PLAY stay in view and usable.
      await page.evaluate(() => (window as any).__ui.openDemo("sheet"));
      await expect(page.locator(".ui-sheet")).toBeVisible();
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );
      expect(
        await page.evaluate(() => {
          const play = document.querySelector<HTMLElement>("#lobby-play")!;
          const r = play.getBoundingClientRect();
          const hit = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          );
          return !play.closest("[inert]") && !!hit && play.contains(hit);
        }),
        "PLAY can be pressed beside a sheet",
      ).toBe(true);
      // Paired small buttons are the same size.
      const pair = await page
        .locator(".ui-sheet .ui-row")
        .first()
        .locator(".ui-btn")
        .evaluateAll((bs) =>
          bs.map((b) => [
            b.getBoundingClientRect().width,
            b.getBoundingClientRect().height,
          ]),
        );
      expect(pair).toHaveLength(2);
      expect(pair[0]).toEqual(pair[1]);
      expect(await closeSpot(page)).toEqual([spot]);
      await snap(page, info, `ui-sheet-${size.name}`);
      // Close returns to the Lobby.
      await page.locator(".ui-sheet .ui-close").click();
      await expect(page.locator(".ui-sheet")).toHaveCount(0);

      // Settings → Graphics → Low: panels drop the blur behind them.
      const blur = await page.evaluate(() => {
        const w = window as any;
        const read = () =>
          getComputedStyle(document.querySelector(".ui-panel")!).backdropFilter;
        w.__ui.openDemo("panel");
        const high = read();
        localStorage.setItem("ea-graphics", "low");
        w.__ui.openDemo("panel");
        const low = [
          document.querySelector<HTMLElement>(".ui-panel")!.dataset.graphics,
          read(),
        ];
        localStorage.setItem("ea-graphics", "high");
        document.querySelector<HTMLElement>(".ui-panel .ui-close")!.click();
        return { high, low };
      });
      expect(blur.high).toContain("blur");
      expect(blur.low).toEqual(["low", "none"]);

      // The purchase confirmation: Escape or Cancel says no, Buy says yes.
      await page.evaluate(() => {
        const w = window as any;
        w.__answer = w.__ui.demoConfirm();
      });
      const modal = page.locator(".ui-modal");
      await expect(modal).toBeVisible();
      await expect(modal.locator("[data-ui-confirm-ok]")).toBeFocused();
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );
      const m = await box(page, ".ui-modal");
      expect(m.x).toBeGreaterThanOrEqual(inset?.left ?? 0);
      expect(m.x + m.width).toBeLessThanOrEqual(
        size.width - (inset?.right ?? 0),
      );
      expect(m.y).toBeGreaterThanOrEqual(0);
      expect(m.y + m.height).toBeLessThanOrEqual(
        size.height - (inset?.bottom ?? 0),
      );
      await snap(page, info, `ui-confirm-${size.name}`);
      await page.keyboard.press("Escape");
      expect(await page.evaluate(() => (window as any).__answer)).toBe(false);
      await page.evaluate(() => {
        const w = window as any;
        w.__answer = w.__ui.demoConfirm();
      });
      await page.locator(".ui-modal [data-ui-confirm-ok]").click();
      expect(await page.evaluate(() => (window as any).__answer)).toBe(true);
      await expect(modal).toHaveCount(0);

      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
