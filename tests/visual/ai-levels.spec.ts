import { expect, test } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts): the mode box is white there,
// and the levels' colours have to read on it.
onPlayersLook();

// The bot's levels in the Lobby's mode menu (lobby-screen.ts AI_LEVELS):
// each level's name in its colour (green, amber, red) with 1 to 3 pips, so
// it reads without the colour too, and a line of its own under it.
const SIZES = [
  { name: "844x390", width: 844, height: 390, phone: true },
  { name: "1440x900", width: 1440, height: 900, phone: false },
];
for (const size of SIZES)
  test(`the bot's levels are colour-coded, with pips, at ${size.name}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      await page.click("#lobby-mode");
      const menu = page.locator("#lobby-mode-menu");
      await expect(menu).toBeVisible();
      const rows = ["easy", "normal", "hard"].map((l) =>
        menu.locator(`[data-lobby-mode="bot-${l}"]`),
      );
      await rows[2].scrollIntoViewIfNeeded();
      const seen = [];
      for (const row of rows)
        seen.push(
          await row.evaluate((b) => {
            const mark = b.querySelector(".ai-level")!;
            return {
              text: b.querySelector("b")!.textContent,
              hint: b.querySelector("small")!.textContent,
              colour: getComputedStyle(mark).color,
              title: getComputedStyle(b.querySelector("b")!).color,
              pips: mark.querySelectorAll(".ai-pips > i.on").length,
            };
          }),
        );
      expect(seen.map((s) => s.text)).toEqual([
        "Vs AI · Easy",
        "Vs AI · Normal",
        "Vs AI · Hard",
      ]);
      expect(seen.map((s) => s.hint)).toEqual([
        "Learning · best of five",
        "A fair fight · best of five",
        "No mercy · best of five",
      ]);
      expect(seen.map((s) => s.pips)).toEqual([1, 2, 3]);
      // Three colours, none of them the title's own.
      expect(new Set(seen.map((s) => s.colour)).size).toBe(3);
      for (const s of seen) expect(s.colour).not.toBe(s.title);
      // A level adds no height: its rows are as tall as Solo test's.
      const height = (l: string) =>
        menu
          .locator(`[data-lobby-mode="${l}"]`)
          .evaluate((b) => b.getBoundingClientRect().height);
      const plain = await height("practice");
      for (const l of ["bot-easy", "bot-normal", "bot-hard"])
        expect(await height(l), l).toBe(plain);
      await snap(page, info, `ai-levels-menu-${size.name}`);
      // Picked: the mode button shows the level the same way.
      await rows[1].click();
      await expect(menu).toBeHidden();
      await expect(
        page.locator('#lobby-mode .ai-level[data-ai-level="normal"]'),
      ).toHaveText("Normal");
      await snap(page, info, `ai-levels-picked-${size.name}`);
      // On the mode box each level's name reads against the box: light
      // green on white was 1.9:1 (UI audit, 27 Nov 2026). Text needs 4.5:1.
      for (const level of ["easy", "normal", "hard"]) {
        await page.click("#lobby-mode");
        await menu.locator(`[data-lobby-mode="bot-${level}"]`).click();
        await expect(menu).toBeHidden();
        const ratio = await page
          .locator(`#lobby-mode .ai-level[data-ai-level="${level}"]`)
          .evaluate((mark) => {
            // Painted once to read any colour as sRGB bytes.
            const ink = document
              .createElement("canvas")
              .getContext("2d", { willReadFrequently: true })!;
            const lum = (c: string) => {
              ink.fillStyle = "#fff";
              ink.fillRect(0, 0, 1, 1);
              ink.fillStyle = c;
              ink.fillRect(0, 0, 1, 1);
              const [r, g, b] = [...ink.getImageData(0, 0, 1, 1).data]
                .slice(0, 3)
                .map((v) => {
                  v /= 255;
                  return v <= 0.03928
                    ? v / 12.92
                    : ((v + 0.055) / 1.055) ** 2.4;
                });
              return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            };
            const box = mark.closest("#lobby-mode")!;
            const a = lum(getComputedStyle(mark).color);
            const b = lum(getComputedStyle(box).backgroundColor);
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          });
        expect(ratio, `${level} on the mode box`).toBeGreaterThanOrEqual(4.5);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
