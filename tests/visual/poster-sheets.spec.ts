import { expect, test, type Page } from "@playwright/test";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  skipTour,
} from "./helpers";

// Poster's result sheets (themes/poster/screens.css, sheets.css), on a phone:
// the main button's words read on its slanted block (a raid or Spire
// defeat's "Run again" was element colour on element colour), a win's
// kicker is a green block (owner, 22 Nov: a green win, a red loss), and a
// win's small notes read on the element-colour sheet. Colours are read
// through a canvas: Poster's computed colours can be oklch().
const SIZE = { width: 844, height: 390 };

async function start(page: Page, room: () => void) {
  await skipTour(page);
  await page.addInitScript(() => {
    if (!location.search) history.replaceState(null, "", "/?ui=poster");
  });
  const errors = await openHub(page);
  await page.evaluate(room);
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  return errors;
}
const push = (page: Page, change: string) =>
  page.evaluate((change) => {
    const w = window as any;
    new Function("s", change)(w.__snap);
    w.__push();
  }, change);

/** The sheet's colours that must read, each as [fg, bg] RGB. */
const colours = (page: Page) =>
  page.evaluate(() => {
    const paint = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    })!;
    paint.canvas.width = paint.canvas.height = 1;
    const rgb = (c: string) => {
      paint.clearRect(0, 0, 1, 1);
      paint.fillStyle = "#000";
      paint.fillStyle = c;
      paint.fillRect(0, 0, 1, 1);
      return Array.from(paint.getImageData(0, 0, 1, 1).data.slice(0, 3));
    };
    const ov = document.getElementById("arena-overlay")!;
    const cta = ov.querySelector<HTMLElement>(
      ":is(.rc-foot, .panel-actions) :is(.ui-btn.is-primary, button.primary, button.btn-primary)",
    )!;
    const kicker = ov.querySelector<HTMLElement>(
      ".rc-head .ui-kicker, .overlay-card > .eyebrow",
    )!;
    const el = getComputedStyle(document.documentElement)
      .getPropertyValue("--el")
      .trim();
    const notes = Array.from(
      ov.querySelectorAll<HTMLElement>(".rw-pending, .records"),
    ).filter((n) => n.getBoundingClientRect().height > 0);
    return {
      cta: {
        label: cta.textContent!.trim(),
        fg: rgb(getComputedStyle(cta).color),
        bg: rgb(getComputedStyle(cta, "::before").backgroundColor),
      },
      kicker: {
        fg: rgb(getComputedStyle(kicker).color),
        bg: rgb(getComputedStyle(kicker).backgroundColor),
      },
      notes: notes.map((n) => ({
        text: n.textContent!.trim().slice(0, 30),
        fg: rgb(getComputedStyle(n).color),
        bg: rgb(el),
      })),
    };
  });
const lum = (c: number[]) => {
  const f = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** Green: the green channel leads the other two. */
const green = (c: number[]) => c[1] > c[0] + 40 && c[1] > c[2] + 40;

async function check(page: Page, win: boolean, what: string) {
  const c = await colours(page);
  expect(
    contrast(c.cta.fg, c.cta.bg),
    `${what}: "${c.cta.label}" ${c.cta.fg} on ${c.cta.bg}`,
  ).toBeGreaterThanOrEqual(4.5);
  if (win) {
    expect(green(c.kicker.bg), `${what}: kicker block ${c.kicker.bg}`).toBe(
      true,
    );
    expect(
      contrast(c.kicker.fg, c.kicker.bg),
      `${what}: kicker words`,
    ).toBeGreaterThanOrEqual(4.5);
    for (const n of c.notes)
      expect(
        contrast(n.fg, n.bg),
        `${what}: "${n.text}" ${n.fg} on ${n.bg}`,
      ).toBeGreaterThanOrEqual(4.5);
  }
}

test("Poster: PvP results, a win and a loss, read", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: SIZE,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await start(page, () =>
      (window as any).__room("pvp", { mode: "duel", phase: "playing" }),
    );
    const overlay = page.locator("#arena-overlay");
    for (const [win, change] of [
      [
        true,
        `s.phase = "finished"; s.winner = "me"; s.matchId = "m1"; s.scores = { me: 3, p2: 1 };`,
      ],
      [
        false,
        `s.phase = "finished"; s.winner = "p2"; s.matchId = "m2"; s.scores = { me: 1, p2: 3 };`,
      ],
    ] as const) {
      await push(page, change);
      await expect(overlay.locator(".match-sheet")).toHaveClass(
        win ? /\bis-victory\b/ : /\bis-defeat\b/,
      );
      await page.waitForTimeout(500);
      await check(page, win, win ? "PvP win" : "PvP loss");
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

for (const mode of ["raid", "spire"] as const)
  test(`Poster: ${mode} results read`, async ({ browser }) => {
    test.setTimeout(150_000);
    const context = await browser.newContext({
      viewport: SIZE,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = await start(
        page,
        mode === "raid"
          ? () => (window as any).__room("raid", { boss: "grumblecrag" })
          : () =>
              (window as any).__room("spire", { floor: 4, stage: "briefing" }),
      );
      const overlay = page.locator("#arena-overlay");
      if (mode === "raid") await push(page, `s.phase = "briefing";`);
      await expect(overlay.locator(".rc-card.is-briefing")).toBeVisible();
      await expect(page.locator("#raid-instructions")).toBeEnabled({
        timeout: 45_000,
      });
      if (mode === "raid") await push(page, `s.phase = "finished";`);
      else
        await page.evaluate(() => {
          const w = window as any;
          w.__room("spire", { floor: 4, stage: "finished" });
          w.__push();
        });
      await expect(overlay.locator(".rc-card.is-results")).toBeVisible();
      await page.waitForTimeout(500);
      await check(page, false, `${mode} defeat`);
      if (mode === "raid") {
        await push(page, `s.raid.result = "victory";`);
        await expect(overlay.locator(".rc-card.is-victory")).toBeVisible();
        await page.waitForTimeout(3200);
        await check(page, true, "raid clear");
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
