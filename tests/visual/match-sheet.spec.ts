import { expect, test, type Page } from "@playwright/test";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  skipTour,
  snap,
} from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";

// Every mode opens and ends in the PvP Reveal's style (match-sheet.css,
// owner 22 Nov 2026): the raid and Spire briefings ("I'm ready"), the break
// between PvP rounds and the results of PvP, raids and the Spire take the
// whole screen past the notch, with the Reveal's centred gold kicker and
// big title, the content in the middle and a foot of buttons at the bottom,
// every button whole and on screen. They were cards over the arena.
const SIZES = [
  { width: 844, height: 390, phone: true, island: false },
  { width: 667, height: 375, phone: true, island: false },
  { width: 852, height: 393, phone: true, island: true },
  { width: 1440, height: 900, phone: false, island: false },
];

/** The sheet as laid out: what the tests below hold it to. */
async function sheet(page: Page, card: string) {
  return page.evaluate((card) => {
    const r = (e: Element | null) => {
      // Whole pixels: the panel's pop-in can leave a last 0.01 px of scale.
      const b = e!.getBoundingClientRect();
      return {
        x: Math.round(b.x),
        y: Math.round(b.y),
        w: Math.round(b.width),
        h: Math.round(b.height),
      };
    };
    const ov = document.getElementById("arena-overlay")!;
    const c = ov.querySelector(card)!;
    const title = c.querySelector(".rc-head .ui-title, :scope > h2")!;
    const foot = c.querySelector(".rc-foot, :scope > .panel-actions")!;
    const body = c.querySelector(".rc-body, :scope > .panel-scroll")!;
    const buttons = Array.from(foot.querySelectorAll("button")).map(r);
    // Every result button wears its icon, PvP's and the raid's alike.
    const icons = Array.from(foot.querySelectorAll("button")).map((b) => {
      const svg = b.querySelector("svg");
      return !!svg && svg.getBoundingClientRect().width > 0;
    });
    const kicker = c.querySelector(".rc-head .ui-kicker, :scope > .eyebrow")!;
    // The note in the foot (what happens next): never a narrow column.
    const note = foot.querySelector<HTMLElement>(".rc-meta, .sheet-note");
    const noteStyle = note && getComputedStyle(note);
    const noteLines =
      note && noteStyle && noteStyle.display !== "none"
        ? Math.round(
            note.getBoundingClientRect().height /
              (parseFloat(noteStyle.lineHeight) ||
                parseFloat(noteStyle.fontSize) * 1.3),
          )
        : 0;
    // The title's own text, centred: measure its text, not its box.
    const range = document.createRange();
    range.selectNodeContents(title);
    return {
      overlay: r(ov),
      card: r(c),
      title:
        range.getBoundingClientRect().x +
        range.getBoundingClientRect().width / 2,
      titleSize: parseFloat(getComputedStyle(title).fontSize),
      body: r(body),
      foot: r(foot),
      buttons,
      icons,
      kicker: getComputedStyle(kicker).color,
      noteLines,
    };
  }, card);
}

/**
 * Results longer than the screen (the XP card, a level-up, a note): the
 * title keeps its row and the content scrolls under it. The title's grid
 * row once shrank to 0 px on a phone held sideways and drew over the
 * scrolling details (22 Nov 2026, found by #362's session).
 */
async function tallKeepsTitle(page: Page, card: string) {
  return page.evaluate((card) => {
    const c = document.querySelector(`#arena-overlay ${card}`)!;
    const body = c.querySelector<HTMLElement>(
      ".rc-body, :scope > .panel-scroll",
    )!;
    const filler = document.createElement("div");
    filler.style.height = "900px";
    filler.style.flex = "none";
    filler.dataset.testFiller = "";
    body.append(filler);
    const head = c.querySelector(".rc-head, :scope > h2")!;
    const h = head.getBoundingClientRect(),
      b = body.getBoundingClientRect();
    const out = {
      titleHeight: Math.round(h.height),
      overlap: Math.round(h.bottom - b.top),
      scrolls: body.scrollHeight > body.clientHeight,
    };
    filler.remove();
    return out;
  }, card);
}

function holds(
  s: Awaited<ReturnType<typeof sheet>>,
  size: { width: number; height: number },
) {
  expect([s.overlay.x, s.overlay.y, s.overlay.w, s.overlay.h]).toEqual([
    0,
    0,
    size.width,
    size.height,
  ]);
  expect([s.card.x, s.card.y, s.card.w, s.card.h]).toEqual([
    0,
    0,
    size.width,
    size.height,
  ]);
  expect(Math.abs(s.title - size.width / 2)).toBeLessThanOrEqual(2);
  expect(s.titleSize).toBeGreaterThanOrEqual(24);
  // The foot below the content, at the bottom.
  expect(s.foot.y).toBeGreaterThanOrEqual(s.body.y + s.body.h - 1);
  expect(s.foot.y + s.foot.h).toBeLessThanOrEqual(size.height);
  expect(s.buttons.length).toBeGreaterThan(0);
  expect(s.noteLines).toBeLessThanOrEqual(2);
  for (const b of s.buttons) {
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w).toBeLessThanOrEqual(size.width);
    expect(b.y + b.h).toBeLessThanOrEqual(size.height);
    expect(b.h).toBeGreaterThanOrEqual(44);
    // Inside the foot, not spilling past it (1 px: each edge is rounded
    // on its own, so a sum of two can be a pixel out on CI's fonts).
    expect(b.x).toBeGreaterThanOrEqual(s.foot.x - 1);
    expect(b.x + b.w).toBeLessThanOrEqual(s.foot.x + s.foot.w + 1);
  }
  for (let i = 1; i < s.buttons.length; i++)
    expect(s.buttons[i].x).toBeGreaterThanOrEqual(
      s.buttons[i - 1].x + s.buttons[i - 1].w,
    );
}

async function start(
  page: Page,
  size: (typeof SIZES)[number],
  room: () => void,
) {
  await skipTour(page);
  const errors = await openHub(page);
  await page.evaluate(room);
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  if (size.island) await setInsets(page, ISLAND);
  return errors;
}
const push = (page: Page, change: string) =>
  page.evaluate((change) => {
    const w = window as any;
    new Function("s", change)(w.__snap);
    w.__push();
  }, change);
const label = (size: (typeof SIZES)[number]) =>
  `${size.width}x${size.height}${size.island ? "-island" : ""}`;

for (const size of SIZES) {
  test(`PvP: the round break and the results take the whole screen at ${label(size)}`, async ({
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
      const errors = await start(page, size, () =>
        (window as any).__room("pvp", { mode: "duel", phase: "playing" }),
      );
      const overlay = page.locator("#arena-overlay");
      // The break: who took the round over the arena, no card; with rites
      // on offer, the cards whole and on screen.
      await push(
        page,
        `s.phase = "intermission"; s.remaining = 8; s.roundWinner = "me";`,
      );
      await expect(overlay).toHaveClass(/\bis-break\b/);
      await expect(overlay.locator(".round-break h2")).toHaveText(
        /takes the round/,
      );
      const look = await page.evaluate(() => {
        const ov = document.getElementById("arena-overlay")!;
        const c = ov.querySelector<HTMLElement>(".round-break")!;
        const b = ov.getBoundingClientRect();
        return {
          overlay: [b.x, b.y, b.width, b.height],
          card: [
            getComputedStyle(c).backgroundImage,
            getComputedStyle(c).borderTopWidth,
          ],
        };
      });
      expect(look.overlay).toEqual([0, 0, size.width, size.height]);
      expect(look.card).toEqual(["none", "0px"]);
      await snap(page, info, `break-${label(size)}`);
      await push(
        page,
        `s.players.find((p) => p.id === "me").riteOffer = ["voltkit-quick-lance", "voltkit-tailwind"]; s.remaining = 12;`,
      );
      const rites = overlay.locator("[data-rite]");
      await expect(rites).toHaveCount(2);
      for (const r of await rites.all())
        await expect(r).toBeInViewport({ ratio: 1 });
      await snap(page, info, `break-rites-${label(size)}`);

      // The results, a win then a loss.
      for (const [name, change] of [
        [
          "win",
          `s.phase = "finished"; s.winner = "me"; s.matchId = "m1"; s.scores = { me: 3, p2: 1 };`,
        ],
        [
          "loss",
          `s.phase = "finished"; s.winner = "p2"; s.matchId = "m2"; s.scores = { me: 1, p2: 3 };`,
        ],
      ]) {
        await push(page, change);
        await expect(overlay).toHaveClass(/\bis-sheet\b/);
        await expect(overlay.locator(".match-sheet")).toHaveClass(
          name === "win" ? /\bis-victory\b/ : /\bis-defeat\b/,
        );
        await page.waitForTimeout(300);
        const look = await sheet(page, ".match-sheet");
        holds(look, size);
        // Results: a green win, a red loss (owner, 22 Nov 2026), every
        // button with its icon.
        expect(look.kicker).toBe(
          name === "win" ? "rgb(111, 227, 161)" : "rgb(255, 138, 149)",
        );
        expect(look.icons.every(Boolean)).toBe(true);
        const tall = await tallKeepsTitle(page, ".match-sheet");
        expect(tall.titleHeight).toBeGreaterThanOrEqual(20);
        expect(tall.overlap).toBeLessThanOrEqual(0);
        expect(tall.scrolls).toBe(true);
        await snap(page, info, `pvp-${name}-${label(size)}`);
      }
      // Back in a fight: nothing over the arena.
      await push(page, `s.phase = "playing";`);
      await expect(overlay).not.toHaveClass(/\bis-sheet\b|\bis-break\b/);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  for (const mode of ["raid", "spire"] as const)
    test(`${mode}: the briefing and the results take the whole screen at ${label(size)}`, async ({
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
        const errors = await start(
          page,
          size,
          mode === "raid"
            ? () => (window as any).__room("raid", { boss: "grumblecrag" })
            : () =>
                (window as any).__room("spire", {
                  floor: 4,
                  stage: "briefing",
                }),
        );
        const overlay = page.locator("#arena-overlay");
        if (mode === "raid") await push(page, `s.phase = "briefing";`);
        await expect(overlay.locator(".rc-card.is-briefing")).toBeVisible();
        await expect(overlay).toHaveClass(/\bis-sheet\b/);
        // (Held while this device loads the arena: slow on a CPU renderer.)
        await expect(page.locator("#raid-instructions")).toBeEnabled({
          timeout: 45_000,
        });
        await page.waitForTimeout(300);
        holds(await sheet(page, ".rc-card"), size);
        await snap(page, info, `${mode}-briefing-${label(size)}`);

        if (mode === "raid") await push(page, `s.phase = "finished";`);
        else
          await page.evaluate(() => {
            const w = window as any;
            w.__room("spire", { floor: 4, stage: "finished" });
            w.__push();
          });
        await expect(overlay.locator(".rc-card.is-results")).toBeVisible();
        await expect(overlay).toHaveClass(/\bis-sheet\b/);
        await page.waitForTimeout(300);
        const lost = await sheet(page, ".rc-card");
        holds(lost, size);
        const tall = await tallKeepsTitle(page, ".rc-card");
        expect(tall.titleHeight).toBeGreaterThanOrEqual(20);
        expect(tall.overlap).toBeLessThanOrEqual(0);
        expect(tall.scrolls).toBe(true);
        // A loss in red, every button with its icon (they were hidden on
        // short phones, where PvP's showed).
        expect(lost.kicker).toBe("rgb(255, 138, 149)");
        expect(lost.icons).toEqual([true, true, true]);
        await snap(page, info, `${mode}-results-${label(size)}`);
        if (mode === "raid") {
          // A clear in green (after the boss's fall: about 2.8 s).
          await push(page, `s.raid.result = "victory";`);
          await expect(overlay.locator(".rc-card.is-victory")).toBeVisible();
          await page.waitForTimeout(3200);
          const won = await sheet(page, ".rc-card");
          holds(won, size);
          expect(won.kicker).toBe("rgb(111, 227, 161)");
          expect(won.icons).toEqual([true, true, true]);
          await snap(page, info, `raid-victory-${label(size)}`);
        }
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
}
