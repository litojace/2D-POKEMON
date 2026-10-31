import { expect, test } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle } from "./helpers";

test("profiles a four-player PvP snapshot/render stream", async ({
  browser,
  browserName,
}, info) => {
  test.skip(
    browserName !== "chromium",
    "CPU sampling is provided by Chromium CDP",
  );
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
      const response = await route.fetch(),
        body = await response.text();
      await route.fulfill({
        response,
        body: body.replace(
          "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
          "window.__perfGame=gameInstance;gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
        ),
      });
    });
    const errors = await openTown(page);
    await page.evaluate(() =>
      (window as any).__room("pvp", { mode: "ffa", phase: "playing" }),
    );
    await openTownMenu(page);
    await page.click(".town-play");
    await page.click("#play-create");
    await pushUntilBattle(page);
    await page.evaluate(async () => {
      const w = window as any,
        { Arena, packSnapshot, blankInput, CHARACTERS } =
          await import("/rooms.ts");
      const a = new Arena("PVP123", "ffa");
      ["voltkit", "cindrake", "tidefin", "auralynx"].forEach((c, i) =>
        a.add(i ? `p${i + 1}` : "me", `Player ${i}`, c as any),
      );
      a.start();
      a.phase = "playing";
      a.deadline = a.time + 1000;
      a.players.forEach((p, i) => {
        p.x = 550 + (i % 2) * 430;
        p.y = 240 + Math.floor(i / 2) * 400;
      });
      {
        const scale = w.__perfGame.scale,
          resize = scale.resize.bind(scale);
        w.__t0 = w.__lastResize = performance.now();
        scale.resize = (...args: [number, number]) => {
          w.__lastResize = performance.now();
          return resize(...args);
        };
      }
      w.__perf = {
        packets: [],
        updates: [],
        bytes: [],
        mutations: 0,
        frames: [],
      };
      let seq = 0,
        cursor = 0;
      w.__simulation = setInterval(() => {
        a.players.forEach((p, i) => {
          p.hp = CHARACTERS[p.character].health;
          p.ult = 100;
          const target = a.players[(i + 1) % 4];
          a.submit(p, {
            ...blankInput(),
            seq: ++seq,
            dx: Math.cos(a.time + i),
            dy: Math.sin(a.time + i),
            aimX: target.x,
            aimY: target.y,
            basic: true,
            skill: seq % 120 < 4 ? Math.floor(a.time / 4) % 4 : -1,
          });
        });
        a.tick();
        if (seq % 8) return;
        const s = a.snapshot();
        s.events = s.events.filter((e) => e.id > cursor);
        if (s.events.length) cursor = s.events.at(-1)!.id;
        w.__snap = packSnapshot(s);
        const start = performance.now();
        w.__push();
        w.__perf.packets.push(performance.now() - start);
        w.__perf.bytes.push(
          new TextEncoder().encode(JSON.stringify(w.__snap)).length,
        );
      }, 1000 / 30);
      const scene = w.__perfGame.scene.getScene("arena"),
        update = scene.sys.sceneUpdate.bind(scene);
      scene.sys.sceneUpdate = (...args: any[]) => {
        const start = performance.now();
        update(...args);
        w.__perf.updates.push(performance.now() - start);
        w.__perf.frames.push(args[1]);
      };
      const hud = new MutationObserver((entries) => {
        w.__perf.mutations += entries.length;
      });
      for (const id of ["hud", "abilities", "mobile-controls"])
        hud.observe(document.getElementById(id)!, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
      w.__stopPerf = () => {
        clearInterval(w.__simulation);
        hud.disconnect();
      };
    });
    // Measure the steady fight: wait until the layout has settled (a
    // renderer resize reallocates the drawing buffer, which is very slow on
    // this test machine's software GPU and is not what this profiles).
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const w = window as any;
            return performance.now() - Math.max(w.__t0 + 6000, w.__lastResize + 3000);
          }),
        { timeout: 30_000, intervals: [500] },
      )
      .toBeGreaterThan(0);
    await page.evaluate(() => {
      const p = (window as any).__perf;
      for (const key of ["packets", "updates", "bytes", "frames"]) p[key] = [];
      p.mutations = 0;
    });
    const client = await context.newCDPSession(page);
    await client.send("Performance.enable");
    await client.send("Profiler.enable");
    await client.send("Profiler.start");
    const before = await client.send("Performance.getMetrics");
    await page.waitForTimeout(5000);
    const after = await client.send("Performance.getMetrics"),
      { profile } = await client.send("Profiler.stop");
    const result = await page.evaluate(() => {
      const w = window as any;
      w.__stopPerf();
      const p = w.__perf;
      const stats = (values: number[]) => {
        const s = values.slice().sort((a, b) => a - b);
        return {
          count: s.length,
          mean: s.reduce((a, b) => a + b, 0) / s.length,
          p95: s[Math.floor(s.length * 0.95)],
          max: s.at(-1),
        };
      };
      return {
        snapshots: stats(p.packets),
        update: stats(p.updates),
        bytes: stats(p.bytes),
        frame: stats(p.frames),
        hudMutations: p.mutations,
      };
    });
    const metric = (metrics: any, name: string) =>
      metrics.metrics.find((m: any) => m.name === name)?.value ?? 0;
    const cpu = Object.fromEntries(
      [
        "TaskDuration",
        "ScriptDuration",
        "LayoutDuration",
        "RecalcStyleDuration",
        "LayoutCount",
        "RecalcStyleCount",
      ].map((name) => [name, metric(after, name) - metric(before, name)]),
    );
    const samples = new Map<number, number>();
    for (const id of profile.samples ?? [])
      samples.set(id, (samples.get(id) ?? 0) + 1);
    const top = profile.nodes
      .map((n) => ({
        name: n.callFrame.functionName,
        url: n.callFrame.url.split("/").slice(-2).join("/"),
        samples: samples.get(n.id) ?? 0,
      }))
      .sort((a, b) => b.samples - a.samples)
      .slice(0, 20);
    const metrics = { ...result, cpu, top };
    console.log("PVP_PROFILE", JSON.stringify(metrics));
    await info.attach("pvp-profile", {
      body: JSON.stringify(metrics, null, 2),
      contentType: "application/json",
    });
    expect(result.snapshots.count).toBeGreaterThan(15);
    // Frames in 5 s of the settled fight on this machine's software GPU:
    // 14-17 before the canvas-texture change, 11-16 after (noise). The bar
    // catches a stall, not a few frames of variance.
    expect(result.update.count).toBeGreaterThanOrEqual(8);
    expect(result.hudMutations).toBeLessThan(result.snapshots.count * 30);
    expect(errors).toEqual([]);
    await client.detach();
  } finally {
    await context.close();
  }
});
