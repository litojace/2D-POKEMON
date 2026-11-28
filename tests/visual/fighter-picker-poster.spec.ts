import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { openHub } from "./helpers";
import { playersLook } from "./players-look";

// The results' Change fighter grid in the look players have
// (themes/poster/fighter-picker.css): each fighter's name is the display
// face in capitals, as everywhere else, and reads whole in its tile. They
// were 11 px body type. The grid is the game's own markup
// (fighter-picker.ts), laid in a dialog the width of the results' one;
// Vite serves it by its path on disk (/@fs/…, the harness's fs.allow).
const PICKER = `/@fs${fileURLToPath(
  new URL("../../apps/client/src/fighter-picker.ts", import.meta.url),
)}`;
for (const size of [
  { width: 667, height: 375, dialog: 643 },
  { width: 844, height: 390, dialog: 820 },
])
  test(`Change fighter's names in Poster at ${size.width}x${size.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      await playersLook(context);
      const page = await context.newPage();
      const errors = await openHub(page);
      const names = await page.evaluate(
        async ([width, picker]) => {
          const { fighterPickerMarkup } = await import(picker as string);
          const dialog = document.createElement("dialog");
          dialog.style.width = `${width}px`;
          dialog.innerHTML = fighterPickerMarkup("voltkit");
          document.body.append(dialog);
          dialog.show();
          const probe = document.createElement("i");
          probe.style.fontFamily = "var(--font-display)";
          document.body.append(probe);
          const display = getComputedStyle(probe).fontFamily;
          probe.remove();
          const out = [...dialog.querySelectorAll<HTMLElement>(".fp-tile")].map(
            (t) => {
              const name = t.querySelector<HTMLElement>("span:last-child")!;
              const c = getComputedStyle(name);
              return {
                name: name.textContent,
                display: c.fontFamily === display,
                caps: c.textTransform,
                whole: name.scrollWidth <= name.clientWidth + 1,
              };
            },
          );
          dialog.remove();
          return out;
        },
        [size.dialog, PICKER] as const,
      );
      expect(names).toHaveLength(18);
      for (const n of names)
        expect(n, n.name!).toMatchObject({
          display: true,
          caps: "uppercase",
          whole: true,
        });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
