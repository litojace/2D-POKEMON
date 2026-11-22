import { expect, test, type Page } from "@playwright/test";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
} from "./helpers";

// A deploy replaces the server (docs/server-updates.md). Render puts the new
// server in front about two minutes before it stops the old one; the old one
// then says so ("server-update"). Out of a match, the game moves to the new
// server at once; in a match it plays on, reads how long it has, and moves
// once the player is out of it.

const connects = (page: Page) =>
  page.evaluate(() => ((window as any).__connects as number | undefined) ?? 0);
const fire = (page: Page, payload: unknown) =>
  page.evaluate(
    (p) => (window as any).__sock.fire("server-update", p),
    payload,
  );
const clearToast = (page: Page) =>
  page.evaluate(
    () => ((document.querySelector("#toast") as HTMLElement).textContent = ""),
  );
/** The toast in full, inside the screen. */
const toastFits = (page: Page) =>
  page.locator("#toast").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      inside:
        r.left >= 0 &&
        r.right <= innerWidth &&
        r.top >= 0 &&
        r.bottom <= innerHeight,
      clipped:
        el.scrollWidth > el.clientWidth + 1 ||
        el.scrollHeight > el.clientHeight + 1,
    };
  });
async function raid(page: Page) {
  await page.evaluate(() =>
    (window as any).__room("raid", {
      boss: "gloomshade",
      pos: [500, 450, 700, 600],
    }),
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
}

test("out of a room, the game moves to the new server at once, without a word", async ({
  page,
}) => {
  const errors = await openHub(page);
  const before = await connects(page);
  await fire(page, { reconnect: true });
  await expect.poll(() => connects(page)).toBe(before + 1);
  await expect(page.locator("#toast")).not.toContainText("new version");
  expect(errors).toEqual([]);
});

test("a raid plays on; leaving it moves the game to the new server", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = await openHub(page);
  await raid(page);
  const before = await connects(page);
  await fire(page, { reconnect: true });
  await expect(page.locator("#toast")).toContainText(
    "A new version is ready. Finish your match",
  );
  // Still in the match two checks later: no move.
  await page.waitForTimeout(4500);
  expect(await connects(page)).toBe(before);
  await page.click("#battle-menu");
  await page.click("#exit-room");
  await expect.poll(() => connects(page), { timeout: 10_000 }).toBe(before + 1);
  expect(errors).toEqual([]);
});

const SIZES = [
  { name: "667x375", width: 667, height: 375 },
  { name: "844x390", width: 844, height: 390 },
  { name: "852x393-island", width: 852, height: 393 },
  { name: "desktop", width: 1280, height: 720 },
];

for (const size of SIZES)
  test(`in a raid, the countdown and the cut-off read in full at ${size.name}`, async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: size.width, height: size.height });
    const errors = await openHub(page);
    await raid(page);
    const toast = page.locator("#toast");

    // Render asks this server to stop: 285 s left, said in minutes.
    await fire(page, { reconnect: true, draining: true, left: 285_000 });
    await expect(toast).toContainText(
      "Update: the server restarts in about 5\u00a0min. Finish your match, then update.",
    );
    expect(await toastFits(page)).toEqual({ inside: true, clipped: false });
    await snap(page, info, `server-update-countdown-${size.name}`);

    // Said once: the same notice again (a refused request) adds nothing.
    await clearToast(page);
    await fire(page, { reconnect: true, draining: true, left: 280_000 });
    await page.waitForTimeout(300);
    await expect(toast).toHaveText("");

    // The time ran out with the match still going.
    await fire(page, { closing: true });
    await expect(toast).toContainText(
      "The server restarted for the update before your match ended.",
    );
    expect(await toastFits(page)).toEqual({ inside: true, clipped: false });
    await snap(page, info, `server-update-closing-${size.name}`);
    expect(errors).toEqual([]);
  });
