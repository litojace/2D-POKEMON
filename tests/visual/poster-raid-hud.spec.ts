import { expect, test, type Page } from "@playwright/test";
import { createRoom, openHub, openPlayPanel, pushUntilBattle } from "./helpers";
import { onPlayersLook } from "./players-look";
import { ISLAND, setInsets } from "./ui-measure";

onPlayersLook();

// A raid's and a Spire floor's HUD in Poster: the clock under the gear is
// bare digits (cream Anton with an ink stroke, no pill), as the Plaza's
// clock; the boss's phase or the floor's wave beside the name is a square
// ink label with cream words, never under 11 px. Neither covers the gear,
// the boss bar or the party's rows.
const read = (page: Page) =>
  page.evaluate(() => {
    const q = (s: string) => document.querySelector<HTMLElement>(s);
    const box = (e: Element | null) => {
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return r.height
        ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
        : null;
    };
    // Poster's colours can compute as oklch(): read them through a canvas.
    const cx = document.createElement("canvas").getContext("2d")!;
    const rgba = (c: string) => {
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = c;
      cx.fillRect(0, 0, 1, 1);
      return Array.from(cx.getImageData(0, 0, 1, 1).data);
    };
    const clock = q(".raid-elapsed")!;
    const digits = q(".raid-elapsed b")!;
    const phase = q(".raid-boss-phase")!;
    const d = getComputedStyle(digits);
    const p = getComputedStyle(phase);
    return {
      clockFill: rgba(getComputedStyle(clock).backgroundColor)[3],
      digitsFill: rgba(d.backgroundColor)[3],
      digitsColour: rgba(d.color).slice(0, 3),
      digitsFont: d.fontFamily,
      digitsStroke: d.textShadow,
      phaseFill: rgba(p.backgroundColor),
      phaseColour: rgba(p.color).slice(0, 3),
      phaseSize: parseFloat(p.fontSize),
      phaseRadius: p.borderRadius,
      phaseCut: phase.scrollWidth > phase.clientWidth + 1,
      clock: box(clock),
      phase: box(phase),
      bar: box(q(".raid-boss-health")),
      menu: box(q("#battle-menu")),
      hud: box(q("#raid-hud")),
      title: box(q(".raid-boss-heading > b")),
      titleCut: (() => {
        const t = q(".raid-boss-heading > b")!;
        return t.scrollWidth > t.clientWidth + 1;
      })(),
      party: box(q("#raid-party")),
      width: innerWidth,
    };
  });
type Box = { left: number; top: number; right: number; bottom: number } | null;
const overlap = (a: Box, b: Box) =>
  !!a &&
  !!b &&
  a.left < b.right &&
  a.right > b.left &&
  a.top < b.bottom &&
  a.bottom > b.top;

for (const view of [
  { name: "568x320", width: 568, height: 320, island: false },
  { name: "667x375", width: 667, height: 375, island: false },
  { name: "844x390", width: 844, height: 390, island: false },
  { name: "852x393-island", width: 852, height: 393, island: true },
  { name: "1440x900", width: 1440, height: 900, island: false },
])
  test(`Poster: the raid and Spire clock is bare digits, the phase an ink label (${view.name})`, async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const phone = view.height <= 500;
    const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      isMobile: phone,
      hasTouch: phone,
    });
    try {
      const page = await context.newPage();
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("raid", { boss: "grumblecrag" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      if (view.island) await setInsets(page, ISLAND);
      for (const kind of ["raid", "spire"] as const) {
        if (kind === "spire")
          await page.evaluate(() => {
            const w = window as any;
            w.__room("spire", { stage: "playing", floor: 2, seats: 2 });
            w.__push();
          });
        await expect(page.locator(".raid-elapsed b")).not.toBeEmpty();
        await expect(page.locator(".raid-boss-phase")).not.toBeEmpty();
        const s = await read(page);
        const where = `${kind} at ${view.name}`;
        // The clock: no pill, cream Anton with an ink stroke.
        expect(s.clockFill, where).toBe(0);
        expect(s.digitsFill, where).toBe(0);
        expect(s.digitsColour, where).toEqual([244, 234, 213]);
        expect(s.digitsFont, where).toContain("Anton");
        expect(s.digitsStroke, where).not.toBe("none");
        // The phase: a square ink label, cream words, 11 px or more, whole.
        expect(s.phaseFill, where).toEqual([13, 13, 15, 255]);
        expect(s.phaseColour, where).toEqual([244, 234, 213]);
        expect(s.phaseSize, where).toBeGreaterThanOrEqual(11);
        expect(s.phaseRadius, where).toBe("0px");
        expect(s.phaseCut, where).toBe(false);
        // Clear of the gear, the boss bar and the party's rows; on screen.
        expect(overlap(s.clock, s.menu), where).toBe(false);
        expect(overlap(s.clock, s.party), where).toBe(false);
        expect(overlap(s.phase, s.bar), where).toBe(false);
        // The name and its label stay inside the HUD, clear of the gear,
        // and the name reads whole.
        expect(overlap(s.phase, s.menu), where).toBe(false);
        expect(overlap(s.phase, s.title), where).toBe(false);
        expect(s.phase!.right, where).toBeLessThanOrEqual(s.hud!.right + 1);
        expect(s.title!.left, where).toBeGreaterThanOrEqual(s.hud!.left - 1);
        expect(s.titleCut, where).toBe(false);
        expect(s.clock!.right, where).toBeLessThanOrEqual(s.width);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
