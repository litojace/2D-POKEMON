import { expect, test } from "@playwright/test";
import { box, inside, openLobby, snap } from "./helpers";

// Five taps on Settings → Graphics' title: the frame-rate read-out
// (perf-hud.ts), a small table over every screen, off again with its ×. It found the owner's iPhone running
// the Lobby at 27 frames a second until the fighter's canvas got its own
// compositing layer (lobby.css).
test.use({
  viewport: { width: 844, height: 390 },
  hasTouch: true,
  isMobile: true,
});

test("five taps on Graphics show the frame-rate table over every screen", async ({
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
    await page.evaluate(() => document.getElementById("home-settings")!.click());
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
  const text = line.locator("pre");
  await expect(line).toBeVisible();
  // The page's frame rate; the Lobby fighter's frames, our own drawing time
  // and its canvas; the device. (A screen this machine draws too slowly to
  // judge reads "?".)
  await expect(text).toContainText(/^page (\d+|\?) Hz\nfighter \d+ fps/);
  await expect(text).toContainText(/ours [\d.]+ ms \(max [\d.]+\)/);
  await expect(text).toContainText(/canvas \d+x\d+ @[\d.]+x tex/);
  await expect(text).toContainText(/dpr \d/);
  // Beside the rail, on the screen, clear of PLAY; touches go through it
  // but for its ×.
  const screen = { x: 0, y: 0, width: 844, height: 390 };
  expect(inside(await box(page, ".perf-hud"), screen)).toBe(true);
  const read = await box(page, ".perf-hud");
  const play = await box(page, "#lobby-play");
  expect(read.x + read.width <= play.x || read.y + read.height <= play.y).toBe(
    true,
  );
  expect(await line.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe(
    "none",
  );
  await snap(page, info, "perf-hud-lobby");

  // Over the Shop: still there, the page's rate (the Lobby's fighter sleeps
  // behind it).
  await page.click('.lobby-rail [data-lobby-action="shop"]');
  await expect(page.locator(".fit-room")).toBeVisible();
  await expect(line).toBeVisible();
  await expect(text).toContainText(/^page (\d+|\?) Hz\ndpr/);
  await page.locator(".fit-room .ui-close").first().click();
  // (A closed Shop stays in the page, hidden, for its next open: ui/hub-panel.ts park.)
  await expect(page.locator(".fit-room:not([data-ui-leaving])")).toHaveCount(0);

  // On the Plaza too, with its own frames, canvas and Auto's measuring.
  await page.click('#hub-scenes [data-hub-scene="plaza"]');
  await expect(page.locator(".plaza-layer #pz-cv")).toBeVisible();
  await expect(line).toBeVisible();
  await expect(text).toContainText(
    /^page (\d+|\?) Hz\nplaza \d+ fps · \d+x\d+\nauto (measuring|\d+ fps|off)/,
  );
  await snap(page, info, "perf-hud-plaza");
  await page.click('#hub-scenes [data-hub-scene="lobby"]');
  await expect(art).toHaveClass(/is-ready/, { timeout: 30_000 });
  await expect(text).toContainText("fighter");

  // Its × turns it off (saved: it stays off after Settings).
  await line.locator(".perf-hud-close").click();
  await expect(line).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("ea-perf"))).toBe(null);

  // And five taps on Graphics turn it on and off again.
  await toggle("on");
  await expect(line).toBeVisible();
  await toggle("off");
  await expect(line).toHaveCount(0);
  expect(errors).toEqual([]);
});
