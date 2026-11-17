import { expect, test } from "@playwright/test";
import { box, openLobby, snap } from "./helpers";

// Five taps on Settings → Graphics' title: the frame-rate line along the top
// edge (perf-hud.ts), over every screen. It found the owner's iPhone running
// the Lobby at 27 frames a second until the fighter's canvas got its own
// compositing layer (lobby.css).
test.use({
  viewport: { width: 844, height: 390 },
  hasTouch: true,
  isMobile: true,
});

test("five taps on Graphics show the frame-rate line over every screen", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const errors = await openLobby(page);
  const art = page.locator("#lobby-fighter-art");
  await expect(art).toHaveClass(/is-ready/, { timeout: 30_000 });
  const line = page.locator(".perf-hud");
  await expect(line).toHaveCount(0);
  // The fighter's canvas has its own compositing layer.
  expect(
    await page.evaluate(
      () =>
        getComputedStyle(document.querySelector("#lobby-fighter-art > canvas")!)
          .willChange,
    ),
  ).toBe("transform");

  const toggle = async (to: "on" | "off") => {
    await page.evaluate(() => document.getElementById("settings")!.click());
    const dialog = page.locator("#dialog");
    const title = dialog.locator("#prefs-graphics");
    const count = await line.count();
    // Four taps do nothing (a stray tap or two never changes it).
    for (let i = 0; i < 4; i++) await title.click();
    await page.waitForTimeout(300);
    expect(await line.count()).toBe(count);
    await title.click();
    await expect(page.locator("#toast")).toHaveText(
      `Frame rate read-out ${to}`,
    );
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  };
  await toggle("on");
  await expect(line).toBeVisible();
  // The page's frame rate, then the Lobby fighter's frames, our own drawing
  // time and its canvas. (A screen this machine draws too slowly to judge
  // reads "?".)
  await expect(line).toHaveText(
    /^(\d+|\?) Hz · fighter \d+ fps [\d.]+ ms · \d+x\d+ @[\d.]+x$/,
  );
  // One line along the top edge, above the header row, and taps go through.
  const b = await box(page, ".perf-hud");
  expect(b.y).toBe(0);
  expect(b.height).toBeLessThanOrEqual(10);
  expect(await line.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe(
    "none",
  );
  const header = await box(page, "#hub-scenes");
  expect(b.y + b.height).toBeLessThanOrEqual(header.y + 2);
  await snap(page, info, "perf-hud-lobby");

  // Over the Shop: still there, the page's rate alone (the Lobby's fighter
  // sleeps behind it).
  await page.click('.lobby-rail [data-lobby-action="shop"]');
  await expect(page.locator(".fit-room")).toBeVisible();
  await expect(line).toBeVisible();
  await expect(line).toHaveText(/^(\d+|\?) Hz$/);
  await page.locator(".fit-room .ui-close").first().click();
  await expect(page.locator(".fit-room")).toHaveCount(0);

  // On the Plaza too.
  await page.click('#hub-scenes [data-hub-scene="plaza"]');
  await expect(page.locator(".plaza-layer #pz-cv")).toBeVisible();
  await expect(line).toBeVisible();
  await expect(line).toHaveText(/^(\d+|\?) Hz$/);
  await snap(page, info, "perf-hud-plaza");
  await page.click('#hub-scenes [data-hub-scene="lobby"]');
  await expect(art).toHaveClass(/is-ready/, { timeout: 30_000 });
  await expect(line).toHaveText(/ · fighter /);

  // Off again.
  await toggle("off");
  await expect(line).toHaveCount(0);
  expect(errors).toEqual([]);
});
