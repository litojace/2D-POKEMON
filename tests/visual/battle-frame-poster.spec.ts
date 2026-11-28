import { expect, test } from "@playwright/test";
import { openHub } from "./helpers";
import { playersLook } from "./players-look";

// The page around the court in the look players have
// (themes/poster/battle-frame.css): ink, the frame square with an ink rim.
// It was navy (a radial glow on #101c35) in a rounded navy frame, and a
// navy gradient behind a touch screen's stands.
const INK = "rgb(13, 13, 15)";

for (const touch of [false, true])
  test(`the court sits on ink in Poster (${touch ? "touch" : "mouse"})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: touch
        ? { width: 844, height: 390 }
        : { width: 1280, height: 720 },
      isMobile: touch,
      hasTouch: touch,
    });
    try {
      await playersLook(context);
      const page = await context.newPage();
      const errors = await openHub(page);
      const look = await page.evaluate((touch) => {
        document.body.classList.add("battle-active");
        document.body.classList.toggle("touch-mode", touch);
        const frame = document.querySelector<HTMLElement>(".arena-frame")!;
        const battle = document.getElementById("battle")!;
        const b = getComputedStyle(document.body),
          s = getComputedStyle(battle),
          f = getComputedStyle(frame);
        return {
          page: [b.backgroundColor, b.backgroundImage],
          battle: [s.backgroundColor, s.backgroundImage],
          frame: [f.backgroundColor, f.borderTopLeftRadius, f.boxShadow],
        };
      }, touch);
      expect(look.page).toEqual([INK, "none"]);
      if (touch) expect(look.battle).toEqual([INK, "none"]);
      expect(look.frame).toEqual([INK, "0px", "none"]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
