import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { openHub, openPlayPanel, createRoom, pushUntilBattle } from "./helpers";

/**
 * A press's wait from the touch to its handler (battle-perf.ts,
 * `eventToHandlerP95`), on a phone held sideways with the CPU slowed 4×,
 * one thumb resting on the joystick and the other finger tapping buttons:
 * the way a duel is played.
 *
 * Production (iOS home-screen app, 59 fps) reported 0.7–0.8 s at p95 and
 * 1.35 s at worst, with the frames steady. WebKit stamps every touch and
 * pointer event with `touches.anyObject.timestamp`
 * (WKTouchEventsGestureRecognizer `_recordTouches`): the last change of
 * ANY finger down, so a thumb held still on the stick hands a skill tap the
 * time that thumb last moved. "stale" replays that: each tap carries the
 * thumb's last-move time, as WebKit would give it. The meter must not count
 * that as waiting (touch-stamp.ts).
 *
 * "real" taps carry their own time (Chromium's): the actual wait for a
 * handler on this slowed CPU.
 */
const TAPS = 12;

async function duel(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    expect(body).toContain("const netMeter = new NetMeter();");
    await route.fulfill({
      response,
      body: body.replace(
        "const netMeter = new NetMeter();",
        "const netMeter = new NetMeter();window.__inputMeter=netMeter;",
      ),
    });
  });
  const errors = await openHub(page);
  await page.evaluate(() =>
    (window as any).__room("pvp", { phase: "playing" }),
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  await expect(
    page.locator('#mobile-controls [data-action="attack"]'),
  ).toBeVisible();
  return errors;
}

/** Centres of the buttons tapped, in CSS px. */
async function targets(page: Page) {
  return page.evaluate(() =>
    [
      '[data-action="attack"]',
      '[data-action="dash"]',
      '[data-action="jump"]',
    ].map((s) => {
      const r = document
        .querySelector(`#mobile-controls ${s}`)!
        .getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }),
  );
}

async function play(page: Page, cdp: CDPSession, stale: boolean) {
  const vp = page.viewportSize()!;
  const stick = { x: vp.width * 0.18, y: vp.height * 0.7, id: 1 };
  const buttons = await targets(page);
  await page.evaluate(() => {
    (window as any).__inputMeter.reset();
  });
  // The thumb lands on the stick and pushes, then rests still.
  const now = () => Date.now() / 1000;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [stick],
  });
  let thumbMoved = now();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...stick, x: stick.x + 30 }],
  });
  thumbMoved = now();
  const thumb = { ...stick, x: stick.x + 30 };
  for (let i = 0; i < TAPS; i++) {
    await page.waitForTimeout(350 + (i % 3) * 150);
    const b = buttons[i % buttons.length];
    const finger = { x: b.x, y: b.y, id: 2 };
    // WebKit: the event's time is any finger's last change (the still thumb).
    const at = stale ? { timestamp: thumbMoved } : {};
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [thumb, finger],
      ...at,
    });
    await page.waitForTimeout(60);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      // (CDP: a touchEnd lists the points that lift.)
      touchPoints: [finger],
      ...at,
    });
  }
  await page.waitForTimeout(400);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [thumb],
  });
  return page.evaluate(() => (window as any).__inputMeter.summary());
}

for (const mode of ["real", "stale"] as const)
  test(`press latency, thumb on the stick, 4x CPU (${mode} timestamps)`, async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = await duel(page);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      const meter = await play(page, cdp, mode === "stale");
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      console.log(
        `PRESS_LATENCY ${mode} ${JSON.stringify({
          pressSamples: meter.pressSamples,
          pressStale: meter.pressStale,
          eventToHandlerP95: meter.eventToHandlerP95,
          handlerToSendP95: meter.handlerToSendP95,
          pressToSendP95: meter.pressToSendP95,
          slowInputs: meter.slowInputs,
        })}`,
      );
      // A tap's handler runs within a few frames of the touch. This
      // machine draws on the CPU: at 4× a frame here takes 60–140 ms, so the
      // limit is a few of those (production phones draw at 59 fps).
      if (mode === "real") {
        expect(meter.pressSamples).toBeGreaterThanOrEqual(TAPS - 2);
        expect(meter.pressStale ?? 0).toBe(0);
        expect(meter.eventToHandlerP95).toBeLessThan(400);
      } else {
        // Another finger's old time is not a wait: never counted as one.
        expect(meter.pressStale).toBeGreaterThanOrEqual(TAPS - 2);
        expect(meter.eventToHandlerP95 ?? 0).toBeLessThan(400);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
