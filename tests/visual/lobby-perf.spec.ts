import { expect, test } from "@playwright/test";
import { box, inside, openLobby, snap } from "./helpers";

// Five taps on Settings → Graphics' title: the Lobby's read-out
// (lobby-perf.ts), for the owner's iPhone, where the aura turned like a
// 30 Hz screen in the Lobby but not in the Shop.
test.use({
  viewport: { width: 844, height: 390 },
  hasTouch: true,
  isMobile: true,
});

test("five taps on Graphics turn the Lobby's frame-rate read-out on and off", async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  const errors = await openLobby(page);
  const art = page.locator("#lobby-fighter-art");
  await expect(art).toHaveClass(/is-ready/, { timeout: 30_000 });
  const perf = page.locator(".lobby-perf");
  await expect(perf).toHaveCount(0);

  const toggle = async (to: "on" | "off") => {
    await page.evaluate(() => document.getElementById("settings")!.click());
    const dialog = page.locator("#dialog");
    const title = dialog.locator("#prefs-graphics");
    const count = await perf.count();
    // Four taps do nothing (a stray tap or two never changes it).
    for (let i = 0; i < 4; i++) await title.click();
    await page.waitForTimeout(300);
    expect(await perf.count()).toBe(count);
    await title.click();
    await expect(page.locator("#toast")).toHaveText(
      `Frame rate read-out ${to}`,
    );
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  };
  await toggle("on");
  await expect(perf).toBeVisible();
  // The live rig's numbers: the screen, frames drawn, our own work, canvas.
  await expect(perf.locator("pre")).toContainText(
    // (A screen this machine draws too slowly to judge reads "?".)
    /screen (\d+|\?) Hz\s+drawn \d+ fps/,
  );
  await expect(perf.locator("pre")).toContainText(/ours [\d.]+ ms/);
  await expect(perf.locator("pre")).toContainText(/canvas \d+x\d+ @/);
  // Clear of PLAY and the mode button, and on the screen.
  const screen = { x: 0, y: 0, width: 844, height: 390 };
  const read = await box(page, ".lobby-perf");
  expect(inside(read, screen)).toBe(true);
  for (const other of ["#lobby-play", "#lobby-mode"]) {
    const b = await box(page, other);
    expect(
      read.x + read.width <= b.x ||
        b.x + b.width <= read.x ||
        read.y + read.height <= b.y ||
        b.y + b.height <= read.y,
    ).toBe(true);
  }

  // Each experiment switches its suspect off, and on again.
  const style = (selector: string, pseudo: string | null, prop: string) =>
    page.evaluate(
      ([s, p, k]) =>
        getComputedStyle(document.querySelector(s!)!, p).getPropertyValue(k!),
      [selector, pseudo, prop] as const,
    );
  expect(await style(".lobby-rail", null, "backdrop-filter")).not.toBe("none");
  await perf.locator('[data-perf="blur"]').click();
  await expect(perf.locator('[data-perf="blur"]')).toHaveText("Blur off");
  expect(await style(".lobby-rail", null, "backdrop-filter")).toBe("none");
  await perf.locator('[data-perf="play"]').click();
  expect(await style(".lobby-play", "::before", "animation-name")).toBe("none");
  await perf.locator('[data-perf="cap"]').click();
  await expect(perf.locator('[data-perf="cap"]')).toHaveText("Cap 60");
  await perf.locator('[data-perf="cap"]').click();
  await expect(perf.locator('[data-perf="cap"]')).toHaveText("Cap 30");
  // Capped, the rig still moves.
  const clock = () =>
    art.evaluate((e) => Number((e as HTMLElement).dataset.animationTime));
  const before = await clock();
  await expect.poll(clock, { timeout: 10_000 }).toBeGreaterThan(before);
  await snap(page, info, "lobby-perf-phone");

  // Off again: the read-out and its experiments are gone.
  await toggle("off");
  await expect(perf).toHaveCount(0);
  expect(await style(".lobby-rail", null, "backdrop-filter")).not.toBe("none");
  expect(await style(".lobby-play", "::before", "animation-name")).not.toBe(
    "none",
  );
  expect(errors).toEqual([]);
});
