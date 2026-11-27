import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, snap } from "./helpers";
import { lookShown, onPlayersLook } from "./players-look";
import { ISLAND, setInsets, type Insets } from "./ui-measure";

/**
 * Watchers get the same countdown (3, 2, 1) as the players, in PvP, raids
 * and the Spire: the whole screen edge to edge past the notch, a light
 * see-through shade with the arena in view, one big number, no card
 * (raid-countdown.spec.ts and reveal.spec.ts hold the players' one). They
 * used to keep the old card: main.ts marked the overlay .is-countdown for
 * players only, and renderWatchOverlay draws every mode a watcher sees.
 */
onPlayersLook();

const SIZES: {
  name: string;
  width: number;
  height: number;
  touch: boolean;
  inset?: Insets;
}[] = [
  { name: "667x375", width: 667, height: 375, touch: true },
  {
    name: "844x390",
    width: 844,
    height: 390,
    touch: true,
    inset: { left: 47, right: 47, bottom: 21, top: 0 },
  },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    touch: true,
    inset: ISLAND,
  },
  { name: "1280x720", width: 1280, height: 720, touch: false },
];

const MODES = ["pvp", "raid", "spire"] as const;
type Mode = (typeof MODES)[number];

/** Watch the room (Watch this room), as watch-room.spec.ts does. */
async function watch(page: Page, mode: Mode) {
  const errors = await openHub(page);
  await page.evaluate((mode) => {
    const w = window as any;
    if (mode === "pvp") w.__room("pvp", { mode: "duel", phase: "playing" });
    else if (mode === "raid") {
      w.__room("raid", { boss: "grumblecrag" });
      // The raid itself, not the Spire's Ascendant form.
      delete w.__snap.raid.spire;
      delete w.__snap.raid.variant;
    } else w.__room("spire", { stage: "playing", floor: 2, seats: 2 });
    // A six-character code, as the Watch box takes (the fake Spire's is
    // seven).
    w.__snap.code = "WATCH1";
    // Nobody in this room is the harness account: you are watching.
    for (const p of w.__snap.players) if (p.id === "me") p.id = "m1";
    const before = w.__reply;
    w.__reply = (ev: string, d: unknown) =>
      ev === "watch" ? { ok: true, code: w.__snap.code } : before(ev, d);
  }, mode);
  await openPlayPanel(page);
  const code: string = await page.evaluate(() => (window as any).__snap.code);
  await page.fill("#code", code);
  await page.click("#watch");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          (window as any).__push();
          return document.body.classList.contains("spectating");
        }),
      { timeout: 60_000, intervals: [400] },
    )
    .toBe(true);
  // A few more frames so the court and the fighters are drawn.
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => (window as any).__push());
    await page.waitForTimeout(300);
  }
  return { errors, code };
}

for (const size of SIZES)
  for (const mode of MODES)
    test(`a watcher's ${mode} countdown fills the whole screen at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(150_000);
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.touch,
        hasTouch: size.touch,
      });
      try {
        const page = await context.newPage();
        const { errors, code } = await watch(page, mode);
        expect(await lookShown(page)).toBe("poster");
        if (size.inset) await setInsets(page, size.inset);

        await page.evaluate(() => {
          const w = window as any;
          w.__snap.phase = "countdown";
          w.__snap.remaining = 2;
          w.__push();
        });
        const overlay = page.locator("#arena-overlay");
        const card = overlay.locator(".countdown-card");
        await expect(card.locator("h2")).toHaveText("2");
        await expect(card.locator(".eyebrow")).toHaveText(`Watching · ${code}`);
        await expect(overlay).toHaveClass(/\bis-countdown\b/);
        // Its own words for watchers; no "I'm ready" or other button.
        await expect(card.locator("button")).toHaveCount(0);
        const look = await page.evaluate(() => {
          const ov = document.getElementById("arena-overlay")!;
          const r = ov.getBoundingClientRect();
          const c = ov.querySelector<HTMLElement>(".countdown-card")!;
          const s = getComputedStyle(c);
          const h2 = c.querySelector("h2")!.getBoundingClientRect();
          const kicker = c.querySelector<HTMLElement>(".eyebrow")!;
          const k = kicker.getBoundingClientRect();
          const line = c.querySelector<HTMLElement>(":scope > div")!;
          const l = line.getBoundingClientRect();
          return {
            rect: [r.left, r.top, r.width, r.height].map(Math.round),
            card: [s.backgroundColor, s.backgroundImage, s.borderTopWidth],
            number: parseFloat(
              getComputedStyle(c.querySelector("h2")!).fontSize,
            ),
            numberMid: [(h2.left + h2.right) / 2, (h2.top + h2.bottom) / 2],
            kickerMid: (k.left + k.right) / 2,
            kickerInk: getComputedStyle(kicker).backgroundColor,
            // Poster's number (themes/poster/screens.css): the display face
            // with a hard ink shadow, as the players' countdown has.
            poster: (() => {
              const n = getComputedStyle(c.querySelector(".live-countdown")!);
              return [n.fontFamily, n.textShadow];
            })(),
            line: [line.textContent!.trim(), l.width, line.scrollWidth],
            lineMid: (l.left + l.right) / 2,
            // The shade is see-through: its darkest stop lets the arena show.
            alphas: [
              ...getComputedStyle(ov).backgroundImage.matchAll(
                /rgba\([^)]*,\s*([\d.]+)\)/g,
              ),
            ].map((m) => Number(m[1])),
          };
        });
        expect(look.rect).toEqual([0, 0, size.width, size.height]);
        expect(look.card).toEqual(["rgba(0, 0, 0, 0)", "none", "0px"]);
        expect(look.number).toBeGreaterThanOrEqual(110);
        // The number, its kicker and the line under it, centred on the screen.
        expect(Math.abs(look.numberMid[0] - size.width / 2)).toBeLessThan(3);
        expect(Math.abs(look.numberMid[1] - size.height / 2)).toBeLessThan(
          size.height * 0.12,
        );
        expect(Math.abs(look.kickerMid - size.width / 2)).toBeLessThan(3);
        expect(Math.abs(look.lineMid - size.width / 2)).toBeLessThan(3);
        // Poster's kicker: an ink label, not bare text.
        expect(look.kickerInk).not.toBe("rgba(0, 0, 0, 0)");
        expect(look.poster[0]).toMatch(/Anton/i);
        expect(look.poster[1]).toMatch(/8px 8px 0px/);
        // The line reads in full, on one line's width.
        expect(look.line[0]).toBe("Here we go.");
        expect(look.line[2]).toBeLessThanOrEqual(
          Math.ceil(look.line[1] as number),
        );
        expect(look.alphas.length).toBeGreaterThan(0);
        expect(Math.max(...look.alphas)).toBeLessThanOrEqual(0.65);
        // A watcher who comes in on the countdown also gets the "Watching
        // room" toast (main.ts watchRoom): it may sit under the countdown,
        // never over its number or its line.
        const clash = await page.evaluate(() => {
          const t = document.getElementById("toast")!;
          if (!t.classList.contains("show")) return null;
          const tb = t.getBoundingClientRect();
          const c = document.querySelector("#arena-overlay .countdown-card")!;
          return [...c.children].some((el) => {
            const b = el.getBoundingClientRect();
            return (
              b.left < tb.right &&
              tb.left < b.right &&
              b.top < tb.bottom &&
              tb.top < b.bottom
            );
          });
        });
        expect(clash).not.toBe(true);
        // The countdown as a watcher sees it once the toast has gone.
        await expect(page.locator("#toast")).not.toHaveClass(/\bshow\b/, {
          timeout: 10_000,
        });
        await snap(page, info, `watch-${mode}-countdown-${size.name}`);

        // The fight: nothing over the arena, and the mark is gone.
        await page.evaluate(() => {
          const w = window as any;
          w.__snap.phase = "playing";
          w.__push();
        });
        await expect(overlay).toBeEmpty();
        await expect(overlay).not.toHaveClass(/\bis-countdown\b/);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
