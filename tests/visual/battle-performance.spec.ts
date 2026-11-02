import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle } from "./helpers";

/**
 * Repeatable client performance scenarios (Chromium + CDP):
 *
 * - pvp2: a duel; pvp4: free-for-all with every fighter casting on the same
 *   ticks; raid4: four heroes against a boss whose real attacks (telegraphs,
 *   danger zones, projectiles) keep firing.
 * - soak: battle → Town → Shop → Wardrobe → battle, again and again, with
 *   memory and object counts after forced garbage collection.
 *
 * Fighters are fully dressed (skins, frames, titles) and snapshots use the
 * production compact protocol. This machine renders WebGL on the CPU
 * (SwiftShader), so frame rate here is NOT a phone's frame rate: compare
 * runs on the same machine, and read the main-thread JavaScript numbers
 * (scene update, snapshot handling, allocations, object counts) rather than
 * FPS. PERF_SECONDS lengthens the sample; PERF_CYCLES the soak.
 */
const SECONDS = Number(process.env.PERF_SECONDS ?? 6);
const CYCLES = Number(process.env.PERF_CYCLES ?? 3);

async function phone(browser: import("@playwright/test").Browser) {
  return browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
}
/** Expose the Phaser game and the account UI to the test. */
async function instrument(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text())
        .replace(
          "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
          "window.__perfGame=gameInstance;gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
        )
        .replace(
          'window.dispatchEvent(new Event("arena:ready"));',
          'window.__account=accountsUI;window.dispatchEvent(new Event("arena:ready"));',
        ),
    });
  });
}
type Scenario = "pvp2" | "pvp4" | "raid4";
async function enterBattle(page: Page, scenario: Scenario) {
  await page.evaluate(
    (s) =>
      s === "raid4"
        ? (window as any).__room("raid", { boss: "emberwing" })
        : (window as any).__room("pvp", {
            mode: s === "pvp2" ? "duel" : "ffa",
            phase: "playing",
          }),
    scenario,
  );
  await openTownMenu(page);
  await page.click(".town-play");
  await page.click("#play-create");
  await pushUntilBattle(page);
}
/** Run a real fight in the page and stream compact snapshots at 15 Hz. */
async function startFight(page: Page, scenario: Scenario) {
  await page.evaluate(async (scenario) => {
    const w = window as any;
    const m = await import("/rooms.ts");
    const heroes = ["voltkit", "cindrake", "tidefin", "lumoth"];
    const a =
      scenario === "raid4"
        ? m.createRaidArena("RAID42", "emberwing")
        : new m.Arena("PVP123", scenario === "pvp2" ? "duel" : "ffa");
    (scenario === "pvp2" ? heroes.slice(0, 2) : heroes).forEach((c, i) =>
      a.add(i ? `p${i + 1}` : "me", `Player ${i + 1}`, c),
    );
    a.players.forEach((p: any, i: number) => m.dressUp(p, i));
    if (scenario === "raid4") a.configure(1, false);
    a.start();
    a.phase = "playing";
    a.deadline = a.time + 1e6;
    const people = a.players.filter((p: any) => !p.raidBoss);
    people.forEach((p: any, i: number) => {
      p.x = 520 + (i % 2) * 520;
      p.y = 300 + Math.floor(i / 2) * 300;
    });
    const tracker = m.MetaTracker ? new m.MetaTracker() : undefined;
    w.__perf = { push: [], bytes: [], update: [], step: [], frames: [] };
    let tick = 0,
      cursor = 0;
    w.__fight = setInterval(() => {
      tick++;
      people.forEach((p: any, i: number) => {
        p.hp = Math.max(p.hp, 60);
        p.ult = 100;
        const boss = a.players.find((q: any) => q.raidBoss);
        const target = boss ?? people[(i + 1) % people.length];
        const together = people.length >= 4 && tick % 45 === 0;
        a.submit(p, {
          ...m.blankInput(),
          seq: p.ack + 1,
          dx: Math.cos(tick / 20 + i),
          dy: Math.sin(tick / 20 + i),
          aimX: target.x,
          aimY: target.y,
          basic: true,
          skill: together
            ? Math.floor(tick / 45) % 4
            : (tick + i * 11) % 90 === 0
              ? ((tick / 90 + i) | 0) % 4
              : -1,
        });
      });
      const boss = a.players.find((q: any) => q.raidBoss);
      if (boss) boss.hp = Math.max(boss.hp, 1000);
      a.tick();
      if (tick % 2) return;
      const s = a.snapshot();
      s.events = s.events.filter((e: any) => e.id > cursor);
      if (s.events.length) cursor = s.events.at(-1).id;
      const changed = tracker?.update(s.players);
      w.__snap = tracker
        ? m.packSnapshot(s, {
            compact: true,
            metaRev: tracker.rev,
            meta: changed || tick === 2 ? tracker.meta(s.players) : undefined,
          })
        : m.packSnapshot(s);
      const start = performance.now();
      w.__push();
      w.__perf.push.push(performance.now() - start);
      if (tick % 10 === 0) w.__perf.bytes.push(JSON.stringify(w.__snap).length);
    }, 1000 / 30);
    const game = w.__perfGame,
      scene = game.scene.getScene("arena");
    if (!w.__wrapped) {
      w.__wrapped = true;
      const update = scene.sys.sceneUpdate.bind(scene);
      scene.sys.sceneUpdate = (...args: any[]) => {
        const start = performance.now();
        update(...args);
        w.__perf?.update.push(performance.now() - start);
      };
      // Phaser's loop keeps its own bound step callback: time that.
      const step = game.loop.callback;
      let previous = 0;
      game.loop.callback = (time: number, delta: number) => {
        const start = performance.now();
        step(time, delta);
        w.__perf?.step.push(performance.now() - start);
        // Phaser smooths its delta: measure real frame-to-frame time.
        if (previous) w.__perf?.frames.push(start - previous);
        previous = start;
      };
    }
  }, scenario);
}
async function stopFight(page: Page) {
  await page.evaluate(() => clearInterval((window as any).__fight));
}
async function heap(context: BrowserContext, page: Page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("HeapProfiler.enable");
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.send("HeapProfiler.collectGarbage");
  const { usedSize } = await cdp.send("Runtime.getHeapUsage");
  const { result } = await cdp.send("Runtime.evaluate", {
    expression: `(() => { const g = window.__perfGame; const s = g?.scene.getScene("arena");
      return { dom: document.getElementsByTagName("*").length,
        sceneObjects: s?.children?.list?.length ?? 0,
        textures: g ? Object.keys(g.textures.list).length : 0,
        tweens: s?.tweens?.getTweens?.().length ?? 0 }; })()`,
    returnByValue: true,
  });
  await cdp.detach();
  return { heapMB: Math.round((usedSize / 2 ** 20) * 10) / 10, ...result.value };
}
const stats = (values: number[]) => {
  const s = values.slice().sort((a, b) => a - b);
  if (!s.length) return { n: 0, mean: 0, p50: 0, p95: 0, max: 0 };
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    n: s.length,
    mean: r(s.reduce((a, b) => a + b, 0) / s.length),
    p50: r(s[s.length >> 1]),
    p95: r(s[Math.floor(s.length * 0.95)]),
    max: r(s.at(-1)!),
  };
};

for (const scenario of ["pvp2", "pvp4", "raid4"] as Scenario[])
  test(`profiles the ${scenario} battle client`, async ({ browser, browserName }, info) => {
    test.skip(browserName !== "chromium", "Uses Chromium CDP");
    test.setTimeout(150_000);
    const context = await phone(browser);
    try {
      const page = await context.newPage();
      await instrument(page);
      const errors = await openTown(page);
      await enterBattle(page, scenario);
      await startFight(page, scenario);
      // Warm up past layout settling and the first effects.
      await page.waitForTimeout(4000);
      // Compact snapshots carry no names: they come from the appearance
      // block, and must still reach the nameplates.
      await expect(page.locator(".battle-nameplate .player-name")).toContainText(
        ["Player 2"],
        { timeout: 20_000 },
      );
      await expect(
        page.locator(".battle-nameplate .player-title", { hasText: "Raid Veteran" }),
      ).toHaveCount(1);
      await page.evaluate(() => {
        const p = (window as any).__perf;
        for (const k of Object.keys(p)) p[k] = [];
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send("Performance.enable");
      const before = await cdp.send("Performance.getMetrics");
      await page.waitForTimeout(SECONDS * 1000);
      const after = await cdp.send("Performance.getMetrics");
      await cdp.detach();
      const raw = await page.evaluate(() => (window as any).__perf);
      await stopFight(page);
      const metric = (m: any, name: string) =>
        m.metrics.find((x: any) => x.name === name)?.value ?? 0;
      const cpu = Object.fromEntries(
        ["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration"].map(
          (n) => [n, Math.round((metric(after, n) - metric(before, n)) * 1000)],
        ),
      );
      const result = {
        scenario,
        seconds: SECONDS,
        note: "SwiftShader software WebGL: compare runs on one machine; not phone FPS",
        snapshotHandlingMs: stats(raw.push),
        snapshotBytes: stats(raw.bytes),
        sceneUpdateMs: stats(raw.update),
        frameStepMs: stats(raw.step),
        frameIntervalMs: stats(raw.frames),
        longFrames: raw.frames.filter((d: number) => d > 50).length,
        mainThreadMs: cpu,
        memory: await heap(context, page),
      };
      console.log("BATTLE_PROFILE", JSON.stringify(result));
      await info.attach(`${scenario}-profile`, {
        body: JSON.stringify(result, null, 2),
        contentType: "application/json",
      });
      // The software renderer starves timers, so fewer than 15 a second arrive.
      expect(raw.push.length).toBeGreaterThan(SECONDS * 4);
      // Generous guards: a regression to per-snapshot rebuilds would blow these.
      expect(result.snapshotHandlingMs.p50).toBeLessThan(25);
      expect(result.frameStepMs.n).toBeGreaterThan(3);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("keeps memory steady across repeated battles, Town, Shop and Wardrobe", async ({
  browser,
  browserName,
}, info) => {
  test.skip(browserName !== "chromium", "Uses Chromium CDP");
  test.setTimeout(120_000 + CYCLES * 60_000);
  const context = await phone(browser);
  try {
    const page = await context.newPage();
    await instrument(page);
    const errors = await openTown(page);
    const samples: Record<string, unknown>[] = [];
    for (let cycle = 0; cycle < CYCLES; cycle++) {
      await enterBattle(page, cycle % 2 ? "raid4" : "pvp4");
      await startFight(page, cycle % 2 ? "raid4" : "pvp4");
      await page.waitForTimeout(3000);
      await stopFight(page);
      await page.click("#battle-menu");
      await page.click("#exit-room");
      await page.evaluate(() => {
        const d = document.querySelector<HTMLDialogElement>("#dialog");
        if (d?.open) document.querySelector<HTMLButtonElement>("#close-dialog")?.click();
      });
      await expect(page.locator("#town-menu-toggle")).toBeVisible({ timeout: 20_000 });
      // A Shop and a Wardrobe visit between matches.
      await page.evaluate(() => void (window as any).__account.showShop("champions"));
      await expect(page.locator("dialog[open]")).toHaveCount(1);
      await page.waitForTimeout(800);
      await page.click("#close-dialog");
      await page.evaluate(() => void (window as any).__account.showWardrobe());
      await expect(page.locator("dialog[open]")).toHaveCount(1);
      await page.waitForTimeout(800);
      await page.click("#close-dialog");
      await page.waitForTimeout(500);
      samples.push({ cycle, ...(await heap(context, page)) });
    }
    console.log("SOAK_PROFILE", JSON.stringify(samples));
    await info.attach("soak", {
      body: JSON.stringify(samples, null, 2),
      contentType: "application/json",
    });
    // After the first cycle has warmed caches, later cycles must not keep growing.
    const heapAt = (i: number) => samples[i].heapMB as number;
    if (samples.length >= 3)
      expect(heapAt(samples.length - 1) - heapAt(1)).toBeLessThan(
        8 * (samples.length - 2),
      );
    const objectsAt = (i: number) => samples[i].sceneObjects as number;
    expect(objectsAt(samples.length - 1)).toBeLessThanOrEqual(objectsAt(0) * 1.5 + 20);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
