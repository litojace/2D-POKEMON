import { expect, test } from "@playwright/test";
import { RULES } from "../../packages/shared/src/index";
import { INPUT_CLOCK } from "../../apps/client/src/battle-input-clock";
import { openHub, openPlayPanel, createRoom, pushUntilBattle } from "./helpers";

test("input deadlines survive stopped rendering, quick taps and battle lifecycle changes", async ({
  browser,
}, info) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      const marker =
        "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
      expect(body).toContain(marker);
      const predict = "function predict(p, input, time) {";
      expect(body).toContain(predict);
      await route.fulfill({
        response,
        body: body
          .replace(
            predict,
            predict + "window.__predictedInputs.push(input.seq);",
          )
          .replace(marker, "window.__inputGame=gameInstance;" + marker)
          .replace(
            "const netMeter = new NetMeter();",
            "const netMeter = new NetMeter();window.__inputMeter=netMeter;",
          ),
      });
    });
    await page.addInitScript(() => {
      const w = window as any;
      w.__inputs = [];
      w.__predictedInputs = [];
      w.__emit = (event: string, input: any) => {
        if (event === "input")
          w.__inputs.push({ ...input, at: performance.now() });
      };
    });
    const errors = await openHub(page);
    await page.evaluate(() =>
      (window as any).__room("pvp", { phase: "playing" }),
    );
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    await expect
      .poll(() => page.evaluate(() => (window as any).__inputs.length))
      .toBeGreaterThan(2);
    // Suppress rendering only, not the event loop. Phaser's old update clock
    // cannot emit here; the new clock must still take exactly one step/input.
    await page.evaluate(() => {
      const w = window as any;
      w.__inputGame.loop.sleep();
      w.__inputs = [];
      w.__predictedInputs = [];
      w.__sampleStart = performance.now();
      w.__inputMeter.reset();
      for (const [i, selector] of [
        '[data-skill="0"]',
        '[data-action="dash"]',
        '[data-action="jump"]',
        '[data-action="attack"]',
      ].entries()) {
        const button = document.querySelector<HTMLElement>(
          `#mobile-controls ${selector}`,
        )!;
        for (const type of ["pointerdown", "pointerup"])
          button.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              pointerId: 70 + i,
              pointerType: "touch",
            }),
          );
      }
    });
    await page.waitForTimeout(1000);
    const active = await page.evaluate(() => ({
      inputs: (window as any).__inputs,
      meter: (window as any).__inputMeter.summary(),
      predicted: (window as any).__predictedInputs,
      elapsed: performance.now() - (window as any).__sampleStart,
    }));
    // Exact 30 Hz under hitches/jitter is judged by the deterministic clock
    // replay. Here even a slow CI renderer must emit without another frame.
    expect(active.inputs.length).toBeGreaterThanOrEqual(2);
    expect(active.inputs.length).toBeLessThanOrEqual(
      // Startup can leave bounded debt before the sample begins; it is
      // legitimate catch-up, not a second input clock running too fast.
      Math.ceil((active.elapsed * RULES.tick) / 1000) +
        INPUT_CLOCK.maxBehind +
        1,
    );
    expect(active.predicted).toEqual(
      active.inputs.map((input: any) => input.seq),
    );
    for (let i = 1; i < active.inputs.length; i++)
      expect(active.inputs[i].seq).toBe(active.inputs[i - 1].seq + 1);
    expect(active.inputs.filter((i: any) => i.skill === 0)).toHaveLength(1);
    for (const action of ["dash", "jump", "basic"])
      expect(active.inputs.filter((i: any) => i[action])).toHaveLength(1);
    expect(active.meter.pressSamples).toBe(4);
    expect(active.meter.pressToSendP95).toBeGreaterThanOrEqual(0);
    console.log("INPUT_CLOCK_BROWSER", JSON.stringify(active.meter));
    await info.attach("local-input-timing", {
      body: JSON.stringify(active.meter, null, 2),
      contentType: "application/json",
    });

    const count = () => page.evaluate(() => (window as any).__inputs.length);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hiddenAt = await count();
    await page.waitForTimeout(200);
    expect(await count()).toBe(hiddenAt);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(count).toBeGreaterThan(hiddenAt);

    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pagehide")),
    );
    const awayAt = await count();
    await page.waitForTimeout(200);
    expect(await count()).toBe(awayAt);
    // Native/webview resume may announce visibility without pageshow. The
    // shared background-exit watcher accepts this route too.
    await page.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    await expect
      .poll(count, {
        timeout: 5000,
        message: "visible resume without pageshow",
      })
      .toBeGreaterThan(awayAt);
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pagehide")),
    );
    const awayAgainAt = await count();
    await page.waitForTimeout(100);
    expect(await count()).toBe(awayAgainAt);
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pageshow")),
    );
    await expect.poll(count).toBeGreaterThan(awayAgainAt);

    await page.evaluate(() => {
      const w = window as any;
      w.__sock.connected = false;
      w.__sock.fire("disconnect", "transport close");
    });
    const droppedAt = await count();
    await page.waitForTimeout(150);
    expect(await count()).toBe(droppedAt);
    await page.evaluate(() => {
      const w = window as any;
      const timeout = w.__sock.timeout;
      w.__sock.timeout = () => ({
        emit(event: string, data: unknown, cb: any) {
          if (event === "resume")
            w.__finishResume = () =>
              cb(null, { ok: true, id: "me", token: "t", code: w.__snap.code });
          else timeout.call(w.__sock).emit(event, data, cb);
        },
      });
      w.__sock.connected = true;
      w.__sock.fire("connect");
      w.__push(); // stale snapshot before the resume identity is accepted
    });
    await page.waitForTimeout(150);
    expect(await count(), "wait for the resume identity").toBe(droppedAt);
    await page.evaluate(() => (window as any).__finishResume());
    await page.waitForTimeout(100);
    expect(await count(), "then wait for its fresh snapshot").toBe(droppedAt);
    await page.evaluate(() => (window as any).__push());
    await expect.poll(count).toBeGreaterThan(droppedAt);
    const resumed = await page.evaluate(
      (start) => (window as any).__inputs.slice(start),
      droppedAt,
    );
    expect(
      resumed.every(
        (i: any) =>
          i.skill === -1 && !i.dash && !i.jump && !i.basic && !i.dx && !i.dy,
      ),
    ).toBe(true);

    await page.click("#battle-menu");
    await page.evaluate(() => {
      const w = window as any;
      const timeout = w.__sock.timeout;
      w.__sock.timeout = () => ({
        emit(event: string, data: unknown, cb: any) {
          if (event === "leave")
            w.__finishLeave = (reply: unknown) => cb(null, reply);
          else timeout.call(w.__sock).emit(event, data, cb);
        },
      });
    });
    await page.click("#exit-room");
    const leavingAt = await count();
    await page.waitForTimeout(200);
    expect(await count(), "stop at the leave request, before its reply").toBe(
      leavingAt,
    );
    await page.evaluate(() => (window as any).__finishLeave({ ok: false }));
    await expect
      .poll(count, {
        message: "a refused leave can resume the same connection",
      })
      .toBeGreaterThan(leavingAt);
    await page.click("#exit-room");
    const leavingAgainAt = await count();
    await page.waitForTimeout(200);
    expect(await count()).toBe(leavingAgainAt);
    await page.evaluate(() => (window as any).__finishLeave({ ok: true }));
    await expect(page.locator("#battle")).toBeHidden();
    const leftAt = await count();
    await page.waitForTimeout(200);
    expect(await count()).toBe(leftAt);
    // A later battle creates a fresh scene/clock after the old timer stopped.
    await page.evaluate(() =>
      (window as any).__room("pvp", { phase: "playing" }),
    );
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    await expect.poll(count).toBeGreaterThan(leftAt);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
