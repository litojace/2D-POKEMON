import { expect, test } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";

// The Lobby's fighter moves with the same live rig as the Fighters roster
// (shop-preview.ts, "selection" framing), laid over its still artwork.
const SIZES = [
  { name: "1440x900", width: 1440, height: 900, phone: false },
  { name: "852x393-island", width: 852, height: 393, phone: true },
];
const art = "#lobby-fighter-art";

for (const size of SIZES)
  test(`the Lobby fighter is the live rig, sized like its artwork, at ${size.name}`, async ({
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
      const errors = await openLobby(page);
      if (size.phone) await setInsets(page, ISLAND);
      await expect(page.locator(art)).toHaveClass(/is-ready/, {
        timeout: 30_000,
      });
      const champion = await page
        .locator(art)
        .getAttribute("data-preview-champion");

      // It moves: the rig's clock runs.
      const clock = () =>
        page.evaluate(
          (s) =>
            Number(
              document.querySelector<HTMLElement>(s)!.dataset.animationTime,
            ),
          art,
        );
      const t1 = await clock();
      await expect.poll(clock, { timeout: 10_000 }).toBeGreaterThan(t1);

      // The canvas lies exactly on the artwork, in the rig's padded frame.
      const boxes = await page.evaluate((s) => {
        const host = document.querySelector(s)!;
        const svg = host.querySelector(":scope > svg:not(.ta-front-layer)")!;
        const r = (e: Element) => {
          const b = e.getBoundingClientRect();
          return [b.x, b.y, b.width, b.height].map((v) => Math.round(v));
        };
        return {
          svg: r(svg),
          canvas: r(host.querySelector(":scope > canvas")!),
          frame: svg.getAttribute("viewBox"),
        };
      }, art);
      expect(boxes.canvas).toEqual(boxes.svg);
      expect(boxes.frame).toBe("-20 -40 240 250");
      // The still fighter steps aside once the rig is drawn (no double fighter).
      expect(
        await page.evaluate(
          (s) =>
            getComputedStyle(document.querySelector(`${s} .fighter-character`)!)
              .visibility,
          art,
        ),
      ).toBe("hidden");
      // No empty band above the fighter: the party row takes the stage's
      // free height, and the fighter grows until the row's height, the room
      // beside one seat on each side, or the 560 px cap stops it.
      const fit = await page.evaluate(() => {
        const box = (s: string) => {
          const b = document.querySelector(s)!.getBoundingClientRect();
          return { l: b.left, t: b.top, r: b.right, b: b.bottom };
        };
        const row = document.querySelector(".lobby-party")!;
        const css = getComputedStyle(row);
        return {
          seat: parseFloat(css.getPropertyValue("--lobby-seat")),
          gap: parseFloat(css.columnGap),
          stage: box(".lobby-stage"),
          party: box(".lobby-party"),
          fighter: box("#lobby-fighter"),
          plate: box(".lobby-nameplate"),
          seats: [0, 1, 2].map((i) => box(`#lobby-slot-${i} > *`)),
          rail: box(".lobby-rail"),
          cards: box(".lobby-cards"),
          play: box(".lobby-play"),
          toast:
            (document.getElementById("toast")!.classList.add("show"),
            box("#toast")),
        };
      });
      const { stage, party, fighter, plate } = fit;
      const side = fighter.b - fighter.t;
      const room = Math.min(
        party.b - party.t,
        party.r - party.l - 2 * fit.seat - 2 * fit.gap,
        560,
      );
      expect(side, "the fighter fills the stage").toBeGreaterThan(room - 1);
      expect(side).toBeGreaterThan(size.phone ? 200 : 500);
      expect(fighter.t).toBeGreaterThanOrEqual(stage.t - 0.5);
      expect(fighter.b).toBeLessThanOrEqual(party.b + 0.5);
      expect(plate.t).toBeGreaterThanOrEqual(fighter.b);
      const overlaps = (a: typeof stage, b: typeof stage) =>
        a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      // Balanced: the fighter and its nameplate share one axis, a seat stands
      // the same distance from each side of it, and the third seat sits
      // straight above the right one. No seat covers the fighter.
      const [left, right, third] = fit.seats;
      const mid = (b: typeof stage) => (b.l + b.r) / 2;
      expect(Math.abs(mid(fighter) - mid(plate))).toBeLessThanOrEqual(1);
      expect(
        Math.abs(fighter.l - left.r - (right.l - fighter.r)),
      ).toBeLessThanOrEqual(1);
      expect(left.b).toBeCloseTo(right.b, 0);
      expect(third.l).toBeCloseTo(right.l, 0);
      expect(third.b).toBeLessThanOrEqual(right.t);
      for (const seat of fit.seats) {
        expect(overlaps(seat, fighter)).toBe(false);
        expect(overlaps(seat, party) && seat.l >= party.l - 0.5).toBe(true);
        expect(seat.r).toBeLessThanOrEqual(party.r + 0.5);
      }
      for (const other of [fit.rail, fit.cards, fit.play, fit.toast])
        expect(overlaps(stage, other)).toBe(false);
      await page.evaluate(() =>
        document.getElementById("toast")!.classList.remove("show"),
      );
      await snap(page, info, `lobby-fighter-rig-${size.name}`);

      // A screen over the Lobby puts the rig to sleep.
      await page.click('.lobby-rail [data-lobby-action="shop"]');
      await expect(page.locator(art)).toHaveAttribute(
        "data-rendering",
        "false",
      );
      await page.keyboard.press("Escape");
      await page.evaluate(() =>
        (document.getElementById("dialog") as HTMLDialogElement).close(),
      );

      // The arrows step to the next fighter, and the rig follows.
      await page.click('[data-lobby-step="1"]');
      await expect(page.locator(art)).not.toHaveAttribute(
        "data-preview-champion",
        champion!,
      );
      await expect(page.locator(art)).toHaveClass(/is-ready/, {
        timeout: 30_000,
      });
      expect(await page.locator(`${art} > canvas`).count()).toBe(1);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("Low graphics keeps the Lobby fighter as still artwork", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
  const errors = await openLobby(page);
  await expect(page.locator(`${art} > svg`).first()).toBeVisible();
  await page.waitForTimeout(2000);
  expect(await page.locator(`${art} > canvas`).count()).toBe(0);
  await expect(page.locator(art)).not.toHaveClass(/is-ready/);
  expect(errors).toEqual([]);
});
