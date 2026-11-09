import { expect, test } from "@playwright/test";
import { openLobby } from "./helpers";

// The fighter you last picked is kept with your account (migration 108),
// so logging in on another device starts on it.
const art = "#lobby-fighter-art";
const champion = (page: import("@playwright/test").Page) =>
  page.locator(art).getAttribute("data-preview-champion");

test("a new device starts on the fighter the account saved", async ({
  page,
}) => {
  // This device last showed Voltkit; the account says Tidefin.
  await page.addInitScript(() => {
    localStorage.setItem("arena-featured-fighter", "voltkit");
    (window as unknown as { __savedFighter: string }).__savedFighter =
      "tidefin";
  });
  const errors = await openLobby(page);
  await expect.poll(() => champion(page), { timeout: 15_000 }).toBe("tidefin");
  await expect(page.locator("#lobby-fighter-name")).toHaveText(/Tidefin/i);
  // Kept on this device too, and not saved back (nothing changed).
  expect(
    await page.evaluate(() => localStorage.getItem("arena-featured-fighter")),
  ).toBe("tidefin");
  await page.waitForTimeout(1500);
  expect(
    await page.evaluate(
      () => (window as unknown as { __fighterSaves?: string[] }).__fighterSaves,
    ),
  ).toBeUndefined();
  expect(errors).toEqual([]);
});

test("picking a fighter saves it with the account, once you stop", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("arena-featured-fighter", "voltkit");
    (window as unknown as { __savedFighter: string }).__savedFighter =
      "voltkit";
  });
  const errors = await openLobby(page);
  await expect.poll(() => champion(page)).toBe("voltkit");
  // Three quick steps: one save, of the last one.
  // (Clicked in the page: here each Playwright click takes longer than the
  // wait before a save, on a CPU-drawn screen.)
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++)
      document.querySelector<HTMLElement>('[data-lobby-step="1"]')!.click();
  });
  const shown = await champion(page);
  expect(shown).not.toBe("voltkit");
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { __fighterSaves?: string[] }).__fighterSaves,
        ),
      { timeout: 10_000 },
    )
    .toEqual([shown]);
  expect(errors).toEqual([]);
});

test("an account with nothing saved keeps this device's fighter", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("arena-featured-fighter", "lumoth"),
  );
  const errors = await openLobby(page);
  await expect.poll(() => champion(page)).toBe("lumoth");
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { __fighterSaves?: string[] }).__fighterSaves,
        ),
      { timeout: 10_000 },
    )
    .toEqual(["lumoth"]);
  expect(errors).toEqual([]);
});
