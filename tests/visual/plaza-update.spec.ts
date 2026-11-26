import { expect, test, type Page } from "@playwright/test";
import { openPlaza, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";
import {
  PLAZA_LAP_START,
  PLAZA_SPOTS,
  trackPoint,
} from "../../packages/shared/src/plaza";

// The update ask in the Plaza waits as it does in the Lobby (pwa.ts reads
// the Plaza's data-hub-busy): not over the map, the album, a typed chat
// line or fishing (it covered Reel!, and the fish got away), and asks at
// once when they close.

/** The update worker, faked: onNeedRefresh on demand (shop-stability.spec.ts). */
async function fakeUpdates(page: Page) {
  await page.route(/\/stubs\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        /export function registerSW\(\) \{[\s\S]*?\n\}/,
        "export function registerSW(options){window.__pwaOptions=options;return async()=>{window.__pwaApplies=(window.__pwaApplies||0)+1;options.onNeedReload();};}",
      ),
    });
  });
  await page.route(/\/apps\/client\/src\/pwa\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        "reload: () => location.reload()",
        "reload: () => {window.__pwaReloads=(window.__pwaReloads||0)+1;}",
      ),
    });
  });
}
const updateReady = (page: Page) =>
  page.evaluate(() => (window as any).__pwaOptions.onNeedRefresh());
const takeover = (page: Page) => page.locator("#pwa-takeover");
/** Waiting: no full-screen ask, and no banner either (not even its quiet
 * note, which covered fishing's hint and the map's list). */
async function waits(page: Page) {
  // A beat for any repaint that would show it.
  await page.waitForTimeout(300);
  await expect(takeover(page)).toBeHidden();
  await expect(page.locator("#pwa-banner")).toBeHidden();
}

/** The Plaza's controls, and the joystick's half, that the update ask
 * covers, by name. */
const covered = (page: Page) =>
  page.evaluate(() => {
    const ask = document.getElementById("pwa-banner")!.getBoundingClientRect();
    const out: string[] = [];
    for (const c of document.querySelectorAll(
      ".plaza-layer button, .plaza-layer .pz-joy, .topbar button, .topbar summary, #chat-button",
    )) {
      // Shown: not the closed Menu's buttons, which keep a box.
      if (!c.checkVisibility({ visibilityProperty: true })) continue;
      const b = c.getBoundingClientRect();
      if (
        ask.left < b.right &&
        b.left < ask.right &&
        ask.top < b.bottom &&
        b.top < ask.bottom
      )
        out.push(c.id || c.className);
    }
    return out;
  });
const goTo = (page: Page, spot: { x: number; y: number }) =>
  page.evaluate(
    ([x, y]) => (window as any).__plazaPosition(x, y),
    [spot.x, spot.y],
  );

const SPOT = PLAZA_SPOTS.find((s) => s.id === "fish")!;
const fishPhase = (page: Page) =>
  page.evaluate(() => (window as any).__plaza.fishingMode.phase);
/** Fishing with the line out (plaza-fishing.spec.ts): no bite until told. */
async function castLine(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__plazaBiteAfter = 600_000;
    w.__plazaBiteHold = true;
  });
  const frames = () =>
    page.evaluate(() => (window as any).__plaza.health().frames.stepped[0]);
  const from = await frames();
  await expect
    .poll(frames, { timeout: 45_000 })
    .toBeGreaterThanOrEqual(from + 5);
  await goTo(page, SPOT);
  await expect(page.locator("#pz-interact")).toContainText("Fish", {
    timeout: 10_000,
  });
  await page.click("#pz-interact");
  await expect(page.locator("#pz-fishhud")).toBeVisible();
  await page.click("#pz-fish-act");
  await expect.poll(() => fishPhase(page)).toBe("wait");
}

test("the Plaza with nothing open asks at once", async ({ page }) => {
  await fakeUpdates(page);
  await openPlaza(page);
  await expect(page.locator(".plaza-layer")).not.toHaveAttribute(
    "data-hub-busy",
  );
  await updateReady(page);
  await expect(takeover(page)).toBeVisible();
  await expect(page.locator("#pwa-takeover-now")).toBeFocused();
});

for (const [open, close, panel] of [
  ["#pz-map-btn", '[data-map="close"]', "#pz-map"],
  ["#pz-album-btn", '[data-al="close"]', "#pz-album"],
] as const)
  test(`the update ask waits for the Plaza's ${panel} to close`, async ({
    page,
  }) => {
    await fakeUpdates(page);
    await openPlaza(page);
    await page.click(open);
    await expect(page.locator(panel)).toBeVisible();
    await updateReady(page);
    await waits(page);
    await page.click(close);
    await expect(page.locator(panel)).toBeHidden();
    await expect(takeover(page)).toBeVisible();
  });

test("the update ask waits while typing a chat line in the Plaza", async ({
  page,
}) => {
  await fakeUpdates(page);
  await openPlaza(page);
  // A party to talk to, free text on (chat.spec.ts): the field takes typing.
  await page.evaluate(() => {
    const w = window as any,
      me = "11111111-1111-4111-8111-111111111111";
    w.__sock.fire("chat-config", { freeText: true });
    w.__sock.fire("party", {
      code: "PARTY2",
      leader: me,
      members: [
        { id: me, name: "tester", character: "voltkit" },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Pal",
          character: "tidefin",
        },
      ],
    });
  });
  await page.click("#chat-button");
  await expect(page.locator("#chat-input")).toBeEnabled();
  await page.click("#chat-input");
  await expect(page.locator("#chat-input")).toBeFocused();
  await updateReady(page);
  await waits(page);
  await expect(page.locator("#chat-input")).toBeFocused();
  await page.locator("#chat-input").blur();
  await expect(takeover(page)).toBeVisible();
});

// On the track, a lap's timer shows under the event pill, where the ask
// heads the screen (plaza.css): the ask waits for the run, as for fishing.
test("the update ask waits while a lap's timer shows", async ({ page }) => {
  await fakeUpdates(page);
  await openPlaza(page);
  // On the lane past the start line, a lap under way (plaza.spec.ts).
  const lane = trackPoint(PLAZA_LAP_START + 0.4);
  await page.evaluate(
    ([x, y, at]) => {
      const w = window as any;
      w.__plazaPosition(x, y);
      Object.assign(w.__plazaWorld.visitors.get("local").lap, {
        travelled: 0.4,
        last: at,
        startedAt: Date.now() - 3_000,
      });
    },
    [lane.x, lane.y, PLAZA_LAP_START + 0.4],
  );
  await expect(page.locator("#pz-timer")).toBeVisible();
  await expect(page.locator(".plaza-layer")).toHaveAttribute("data-hub-busy");
  await updateReady(page);
  await waits(page);
  // Off the lane, the run is over and the timer goes: the ask comes.
  await goTo(page, SPOT);
  await expect(page.locator("#pz-timer")).toBeHidden();
  await expect(takeover(page)).toBeVisible();
});

// The busy check reads the page when something opens or closes, not each
// frame: the timer and the action button rewrote `hidden` every frame, and
// each write ran it (26 Nov 2026).
test("the Plaza's busy check runs on a change, not every frame", async ({
  page,
}) => {
  await openPlaza(page);
  await goTo(page, SPOT);
  await expect(page.locator("#pz-interact")).toBeVisible();
  const { changes, frames } = await page.evaluate(
    () =>
      new Promise<{ changes: number; frames: number }>((done) => {
        let changes = 0,
          frames = 0,
          stop = false;
        const watch = new MutationObserver(() => changes++);
        watch.observe(document.querySelector(".plaza-layer")!, {
          subtree: true,
          attributes: true,
          attributeFilter: ["hidden"],
        });
        const frame = () => {
          frames++;
          if (!stop) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        setTimeout(() => {
          stop = true;
          watch.disconnect();
          done({ changes, frames });
        }, 1500);
      }),
  );
  expect(frames).toBeGreaterThan(3);
  expect(changes).toBeLessThanOrEqual(2);
});

for (const size of [
  { name: "667x375", width: 667, height: 375 },
  { name: "844x390", width: 844, height: 390 },
  { name: "852x393-island", width: 852, height: 393, inset: ISLAND },
])
  test(`the update ask waits for fishing, the Fish book and the map at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    // A phone in landscape, as plaza-fishing.spec.ts.
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await fakeUpdates(page);
    await openPlaza(page);
    if (size.inset) await setInsets(page, size.inset);

    // The map open: nothing asks; closed, the full-screen ask comes.
    await page.click("#pz-map-btn");
    await expect(page.locator("#pz-map")).toBeVisible();
    await updateReady(page);
    await waits(page);
    await snap(page, info, `plaza-update-map-${size.name}`);
    await page.click('[data-map="close"]');
    await expect(takeover(page)).toBeVisible();
    await snap(page, info, `plaza-update-after-map-${size.name}`);
    await page.locator("#pwa-takeover-later").click();
    await expect(takeover(page)).toBeHidden();

    // Fishing, line out: the ask, due again after the snooze, waits: Reel!
    // stays free to tap. So does it with the Fish book open from fishing.
    await castLine(page);
    await expect(page.locator(".plaza-layer")).toHaveAttribute("data-hub-busy");
    await page.evaluate(() => {
      const now = Date.now();
      Date.now = () => now + 11 * 60 * 1000;
      window.dispatchEvent(new Event("focus"));
    });
    await waits(page);
    await expect(page.locator("#pz-fish-act")).toBeVisible();
    await snap(page, info, `plaza-update-fishing-${size.name}`);
    await page.click("#pz-fish-book2");
    await expect(page.locator("#pz-fishbook")).toBeVisible();
    await waits(page);
    await page.click('[data-fb="close"]');
    await waits(page);

    // Leave: the banner's ask comes (Later already chose the banner).
    await page.click("#pz-fish-exit");
    await expect(page.locator("#pz-fishhud")).toBeHidden();
    await expect(page.locator("#pwa-update-now")).toBeVisible();
    // Over no control. Beside PLAY's corner, as in the Lobby, it covered the
    // action button left of Dash and Jump (Fish here, Volt Boba's the
    // widest), and the joystick's half leaves no room beside it (26 Nov 2026).
    await expect(page.locator("#pz-interact")).toContainText("Fish");
    expect(await covered(page)).toEqual([]);
    await snap(page, info, `plaza-update-after-fishing-${size.name}`);
    const cafe = PLAZA_SPOTS.find((s) => s.id === "cafe")!;
    await goTo(page, cafe);
    await expect(page.locator("#pz-interact")).toContainText("Volt Boba");
    // The camera eases over: the picture once it shows the stand.
    await expect
      .poll(
        () =>
          page.evaluate(
            ([x, y]) => {
              const v = (window as any).__plaza.view();
              return (
                Math.abs((v.x0 + v.x1) / 2 - x) < (v.x1 - v.x0) * 0.3 &&
                Math.abs((v.y0 + v.y1) / 2 - y) < (v.y1 - v.y0) * 0.3
              );
            },
            [cafe.x, cafe.y],
          ),
        { timeout: 15_000 },
      )
      .toBe(true);
    expect(await covered(page)).toEqual([]);
    await snap(page, info, `plaza-update-cafe-${size.name}`);
    await context.close();
  });
