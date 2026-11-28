import { expect, test, type Page } from "@playwright/test";
import { createRoom, openHub, openPlayPanel, pushUntilBattle } from "./helpers";
import { onPlayersLook } from "./players-look";
import { ISLAND, setInsets } from "./ui-measure";

onPlayersLook();

// Poster's battle HUD has no navy left (themes/poster/battle-hud.css): the
// battle's glass token is ink with no hairline, so the score badge's box,
// its phase note, Jump, Dash and the target button are ink; the note and
// the small pills are square; the touch buttons' rims are ink. Checked in
// every mode, at the phone sizes and on a desktop.
const NAVY = (rgba: number[]) =>
  rgba[3] > 30 && rgba[2] > rgba[0] + 12 && rgba[2] > rgba[1] && rgba[0] < 60;

const read = (page: Page) =>
  page.evaluate(() => {
    const cx = document.createElement("canvas").getContext("2d")!;
    const rgba = (c: string) => {
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = c;
      cx.fillRect(0, 0, 1, 1);
      return Array.from(cx.getImageData(0, 0, 1, 1).data);
    };
    const shown = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    // The HUD's own pieces, not the fighters' health bars over the court.
    const pieces = Array.from(
      document.querySelectorAll<HTMLElement>(
        "#hud, #hud *, .touch-buttons, .touch-buttons *, #battle-menu .ping-badge, .ability small, .movement-ability small, .basic-hint small",
      ),
    ).filter(shown);
    return {
      navy: pieces
        .filter((e) => {
          const bg = rgba(getComputedStyle(e).backgroundColor);
          return (
            bg[3] > 30 && bg[2] > bg[0] + 12 && bg[2] > bg[1] && bg[0] < 60
          );
        })
        .map((e) => `${e.tagName.toLowerCase()}#${e.id}.${e.className}`),
      phase: (() => {
        const p = document.querySelector<HTMLElement>("#phase-label");
        if (!p || !shown(p)) return null;
        const c = getComputedStyle(p);
        return { bg: rgba(c.backgroundColor), radius: c.borderRadius };
      })(),
      rims: Array.from(
        document.querySelectorAll<HTMLElement>(
          ".touch-buttons :is(.touch-attack, .touch-ultimate, .touch-target, [data-action])",
        ),
      )
        .filter(shown)
        .filter((b) => !b.classList.contains("is-locked"))
        .map((b) => rgba(getComputedStyle(b).borderTopColor)),
      discs: Array.from(
        document.querySelectorAll<HTMLElement>(
          '.touch-buttons :is(.touch-target, [data-action="jump"], [data-action="dash"])',
        ),
      )
        .filter(shown)
        .map((b) => rgba(getComputedStyle(b).backgroundColor)),
    };
  });

for (const view of [
  { name: "667x375", width: 667, height: 375, island: false },
  { name: "844x390", width: 844, height: 390, island: false },
  { name: "852x393-island", width: 852, height: 393, island: true },
  { name: "1440x900", width: 1440, height: 900, island: false },
])
  for (const mode of ["duel", "teams", "ffa", "raid"] as const)
    test(`Poster: no navy in the battle HUD, ${mode} at ${view.name}`, async ({
      browser,
    }) => {
      test.setTimeout(90_000);
      const phone = view.height <= 500;
      const context = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        isMobile: phone,
        hasTouch: phone,
      });
      try {
        const page = await context.newPage();
        const errors = await openHub(page);
        await page.evaluate((mode) => {
          const w = window as any;
          if (mode === "raid") w.__room("raid", { boss: "grumblecrag" });
          else w.__room("pvp", { mode, phase: "playing" });
        }, mode);
        await openPlayPanel(page);
        await createRoom(page);
        await pushUntilBattle(page);
        if (view.island) await setInsets(page, ISLAND);
        await page.evaluate(() => (window as any).__push());
        const s = await read(page);
        expect(s.navy, "navy pieces").toEqual([]);
        if (s.phase) {
          expect(s.phase.bg.slice(0, 3)).toEqual([13, 13, 15]);
          expect(s.phase.radius).toBe("0px");
        }
        // Ink, or none at all (Jump and Dash take the glass's hairline, which
        // is clear here): never the old gold or grey.
        for (const rim of s.rims)
          expect(rim[3] === 0 || rim.slice(0, 3).join() === "13,13,15").toBe(
            true,
          );
        for (const disc of s.discs) {
          expect(NAVY(disc)).toBe(false);
          expect(disc.slice(0, 3)).toEqual([13, 13, 15]);
        }
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
