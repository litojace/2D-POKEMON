import { expect, test } from "@playwright/test";
import { hubMenu, openHub, skipTour } from "./helpers";
import { onPlayersLook } from "./players-look";
import { ISLAND, setInsets } from "./ui-measure";

onPlayersLook();

// The Lobby's name plate shows every fighter's name whole (owner's rule: no
// "…" on what matters). In Poster's wider face the look underneath's 150 px
// cap cut "WOMBOLDER" to "WOMBO…" on phones. Step through the whole roster
// with the › arrow: each name is uncut, inside the screen, and clear of the
// two arrows beside it.
for (const view of [
  { name: "667x375", width: 667, height: 375, island: false },
  { name: "852x393-island", width: 852, height: 393, island: true },
  { name: "568x320", width: 568, height: 320, island: false },
])
  test(`Poster: the Lobby's name plate shows every fighter's name whole (${view.name})`, async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await skipTour(page);
      const errors = await openHub(page);
      if (view.island) await setInsets(page, ISLAND);
      const read = () =>
        page.evaluate(() => {
          const name = document.getElementById("lobby-fighter-name")!;
          const r = name.getBoundingClientRect();
          const arrows = Array.from(
            document.querySelectorAll<HTMLElement>(
              ".lobby-nameplate > .lobby-step",
            ),
            (a) => a.getBoundingClientRect(),
          );
          return {
            text: name.textContent ?? "",
            cut: name.scrollWidth > name.clientWidth + 1,
            left: r.left,
            right: r.right,
            width: innerWidth,
            // The arrows' inner edges: the name sits between them.
            from: Math.min(...arrows.map((a) => a.right)),
            to: Math.max(...arrows.map((a) => a.left)),
          };
        });
      const seen: string[] = [];
      for (let i = 0; i < 60; i++) {
        const s = await read();
        if (seen.includes(s.text)) break;
        seen.push(s.text);
        expect(s.cut, s.text).toBe(false);
        expect(s.left, s.text).toBeGreaterThanOrEqual(s.from);
        expect(s.right, s.text).toBeLessThanOrEqual(s.to);
        expect(s.right, s.text).toBeLessThanOrEqual(s.width);
        const before = s.text;
        await page.locator(".lobby-nameplate > .lobby-step").last().click();
        await expect
          .poll(async () => (await read()).text, { timeout: 5_000 })
          .not.toBe(before);
      }
      // The whole roster went by, the longest name among it.
      expect(seen.length).toBeGreaterThanOrEqual(12);
      expect(seen).toContain("Wombolder");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// The fighter's own page (Fighters, Details) names it under the stage: the
// longest name reads whole there too, inside the stage's column.
for (const view of [
  { name: "667x375", width: 667, height: 375, island: false },
  { name: "852x393-island", width: 852, height: 393, island: true },
])
  test(`Poster: the fighter's page shows the longest name whole (${view.name})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await skipTour(page);
      await page.addInitScript(() =>
        localStorage.setItem("arena-featured-fighter", "wombolder"),
      );
      const errors = await openHub(page);
      if (view.island) await setInsets(page, ISLAND);
      await hubMenu(page, "fighters");
      await page.click('[data-roster-details="wombolder"]');
      const name = page.locator(".roster-stage-name");
      await expect(name).toHaveText("Wombolder");
      const s = await name.evaluate((el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        const stage = el.closest(".ui-panel")!.getBoundingClientRect();
        return {
          cut: el.scrollWidth > el.clientWidth + 1,
          inside: r.left >= stage.left && r.right <= stage.right,
          shown: r.height > 0 && r.bottom <= innerHeight,
        };
      });
      expect(s).toEqual({ cut: false, inside: true, shown: true });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
