import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { RULES } from "../../packages/shared/src/index";
import {
  RAID_BOSSES,
  type RaidBossId,
} from "../../packages/shared/src/raid-roster";
import {
  closeRaids,
  openHub,
  pushUntilBattle,
  openPlayPanel,
  createRoom,
  snap,
} from "./helpers";

/**
 * Repeatable client performance scenarios (Chromium + CDP):
 *
 * - pvp2: a duel; pvp4: free-for-all with every fighter casting on the same
 *   ticks; raid4: four heroes against a boss whose real attacks (telegraphs,
 *   danger zones, projectiles) keep firing.
 * - soak: battle → Lobby → Shop → Wardrobe → battle, again and again, with
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
// Optional manual GPU/work comparison; defaults leave the CI profiles as before.
const GPU = process.env.PERF_GPU === "1";
const QUALITY = process.env.PERF_QUALITY;
if (QUALITY && !["auto", "high", "low"].includes(QUALITY))
  throw new Error("PERF_QUALITY must be auto, high or low");
const BOSS = (process.env.PERF_RAID_BOSS ?? "emberwing") as RaidBossId;
if (!Object.hasOwn(RAID_BOSSES, BOSS))
  throw new Error("Unknown PERF_RAID_BOSS");
const SETTLE_MS = Number(process.env.PERF_SETTLE_SECONDS ?? 4) * 1000;
const HEROES =
  process.env.PERF_SQUAD === "heavy"
    ? ["pyranda", "sunbara", "mystowl", "coilemur"]
    : ["voltkit", "cindrake", "tidefin", "lumoth"];
const IPHONE_11 = process.env.PERF_DEVICE === "iphone11";

async function phone(browser: import("@playwright/test").Browser) {
  return browser.newContext({
    viewport: IPHONE_11
      ? { width: 896, height: 414 }
      : { width: 844, height: 390 },
    ...(IPHONE_11
      ? {
          // UA/viewport emulation selects the real mobile pipeline and iOS
          // canvas caps; Chromium/SwiftShader is still not Apple hardware.
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
        }
      : {}),
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
}
/** Expose the Phaser game and the account UI to the test. */
async function instrument(page: Page) {
  await page.addInitScript(
    ({ gpu, quality }) => {
      if (quality) localStorage.setItem("ea-graphics", quality);
      if (gpu) {
        localStorage.setItem("ea-perf", "1");
        let seed = 0x5eed;
        Math.random = () => {
          seed = (seed + 0x6d2b79f5) | 0;
          let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
    },
    { gpu: GPU, quality: QUALITY },
  );
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
/**
 * Count layout reads on the battle nameplates. A hidden plate that was never
 * measured on screen reads 0, which is never cached, so measuring it forced
 * a page layout on every frame. (This scenario brings fighters in off screen
 * mid-fight, so it has such plates.)
 */
async function countPlateMeasures(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__plateMeasures = { all: 0, hidden: 0 };
    for (const prop of ["offsetWidth", "offsetHeight"] as const) {
      const real = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        prop,
      )!;
      Object.defineProperty(HTMLElement.prototype, prop, {
        configurable: true,
        get() {
          if (this.classList?.contains("battle-nameplate")) {
            w.__plateMeasures.all++;
            if (this.hidden) w.__plateMeasures.hidden++;
          }
          return real.get!.call(this);
        },
      });
    }
  });
}
type Scenario = "pvp2" | "pvp4" | "raid4";
async function enterBattle(page: Page, scenario: Scenario) {
  await page.evaluate(
    ({ scenario: s, boss }) =>
      s === "raid4"
        ? (window as any).__room("raid", { boss })
        : (window as any).__room("pvp", {
            mode: s === "pvp2" ? "duel" : "ffa",
            phase: "playing",
          }),
    { scenario, boss: BOSS },
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
}
/** Run a real fight in the page and stream compact snapshots at RULES.snapshot Hz. */
async function startFight(page: Page, scenario: Scenario) {
  await page.evaluate(
    async ({ scenario, tickHz, snapshotHz, boss: bossId, heroes, gpu }) => {
      const w = window as any;
      const m = await import("/rooms.ts");
      let simulationSeed = 0x51a7;
      const simulation = <T>(run: () => T): T => {
        if (!gpu) return run();
        const visualRandom = Math.random;
        Math.random = () => {
          simulationSeed =
            (Math.imul(simulationSeed, 1664525) + 1013904223) >>> 0;
          return simulationSeed / 4294967296;
        };
        try {
          return run();
        } finally {
          Math.random = visualRandom;
        }
      };
      const a = simulation(() => {
        const a =
          scenario === "raid4"
            ? m.createRaidArena("RAID42", bossId)
            : new m.Arena("PVP123", scenario === "pvp2" ? "duel" : "ffa");
        (scenario === "pvp2" ? heroes.slice(0, 2) : heroes).forEach((c, i) =>
          a.add(i ? `p${i + 1}` : "me", `Player ${i + 1}`, c),
        );
        a.players.forEach((p: any, i: number) => m.dressUp(p, i));
        if (scenario === "raid4") a.configure(1, false);
        a.start();
        a.phase = "playing";
        a.deadline = a.time + 1e6;
        return a;
      });
      const people = a.players.filter((p: any) => !p.raidBoss);
      people.forEach((p: any, i: number) => {
        // The GPU burst comparison starts together in clear court space;
        // the legacy profile's four spots are inside the classic pillars.
        p.x = gpu ? 650 + (i % 2) * 300 : 520 + (i % 2) * 520;
        p.y = gpu
          ? 380 + Math.floor(i / 2) * 160
          : 300 + Math.floor(i / 2) * 300;
      });
      const tracker = m.MetaTracker ? new m.MetaTracker() : undefined;
      w.__gpuChanges = [];
      w.__fightStarted = performance.now();
      if (gpu)
        w.__simulation = { ticks: 0, time: a.time, phase: a.phase, skipped: 0 };
      w.__perf = {
        push: [],
        bytes: [],
        update: [],
        step: [],
        frames: [],
        input: [],
        gpu: [],
      };
      let tick = 0,
        cursor = 0;
      const tickArena = () => {
        tick++;
        people.forEach((p: any, i: number) => {
          p.hp = Math.max(p.hp, gpu ? 500 : 60);
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
        if (gpu)
          w.__simulation = {
            ticks: tick,
            time: a.time,
            phase: a.phase,
            skipped: w.__simulation.skipped,
          };
      };
      const step = () => {
        // Restore visual randomness before delivering a snapshot: its
        // synchronous handlers emit cosmetic bursts using their own RNG.
        simulation(tickArena);
        if (tick % Math.round(tickHz / snapshotHz)) return;
        const s = a.snapshot();
        s.events = s.events.filter((e: any) => e.id > cursor);
        if (s.events.length) cursor = s.events.at(-1).id;
        const changed = tracker?.update(s.players);
        w.__snap = tracker
          ? m.packSnapshot(s, {
              compact: true,
              metaRev: tracker.rev,
              meta: changed || tick === 1 ? tracker.meta(s.players) : undefined,
            })
          : m.packSnapshot(s);
        const start = performance.now();
        w.__push();
        w.__perf.push.push(performance.now() - start);
        if (tick % 10 === 0)
          w.__perf.bytes.push(JSON.stringify(w.__snap).length);
      };
      let from = performance.now(),
        running = !gpu,
        stepped = 0;
      if (gpu) {
        // Load the selected squad before starting the simulation clock.
        // Slow atlas decoding must not create startup debt in the sample.
        w.__snap = m.packSnapshot(a.snapshot());
        w.__push();
        w.__startGpuFight = () => {
          from = performance.now();
          w.__fightStarted = from;
          running = true;
        };
      }
      w.__fight = setInterval(() => {
        if (!running) return;
        const due = Math.floor(((performance.now() - from) * tickHz) / 1000);
        // The GPU comparison must keep the server's wall-time progress.
        // Retain debt and drain <=10 ticks per callback, rather than dropping
        // startup ticks and comparing two different moments of the fight.
        if (!gpu && due - stepped > 10) stepped = due - 10;
        const until = gpu ? Math.min(due, stepped + 10) : due;
        while (stepped < until) {
          stepped++;
          step();
        }
        if (gpu) w.__simulation.debt = due - stepped;
      }, 1000 / tickHz);
      const game = w.__perfGame,
        scene = game.scene.getScene("arena");
      if (!w.__wrapped) {
        w.__wrapped = true;
        if (gpu) {
          const gl = game.renderer.gl,
            draw = gl.drawArrays,
            bind = gl.bindTexture;
          gl.drawArrays = function (
            mode: number,
            first: number,
            count: number,
          ) {
            if (w.__gpuFrame) {
              w.__gpuFrame.drawCalls++;
              w.__gpuFrame.vertices += count;
            }
            return draw.call(this, mode, first, count);
          };
          gl.bindTexture = function (
            target: number,
            texture: WebGLTexture | null,
          ) {
            if (w.__gpuFrame) w.__gpuFrame.textureBinds++;
            return bind.call(this, target, texture);
          };
        }
        // Input now runs outside Phaser's step. Keep its cost visible rather
        // than mistaking a shorter scene update for less total JS work.
        if (scene.sendInput) {
          const send = scene.sendInput.bind(scene);
          scene.sendInput = () => {
            const start = performance.now();
            send();
            w.__perf?.input.push(performance.now() - start);
          };
        }
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
          if (gpu)
            w.__gpuFrame = { drawCalls: 0, vertices: 0, textureBinds: 0 };
          step(time, delta);
          w.__perf?.step.push(performance.now() - start);
          if (gpu && w.__arenaPerf) {
            const fx = w.__arenaPerf.fx(),
              quality = w.__arenaPerf.quality();
            w.__perf.gpu.push({
              glow: fx.glowCover,
              soft: fx.softCover,
              particles: fx.particles,
              density: w.__arenaPerf.density(),
              animationDelta: delta,
              phase: w.__simulation.phase,
              serverTime: w.__simulation.time,
              clockMs: start - w.__fightStarted,
              ...w.__gpuFrame,
            });
            if (w.__gpuChanges.at(-1)?.quality !== quality)
              w.__gpuChanges.push({
                atMs: Math.round(performance.now() - w.__fightStarted),
                quality,
              });
          }
          w.__gpuFrame = undefined;
          // Phaser smooths its delta: measure real frame-to-frame time.
          if (previous) w.__perf?.frames.push(start - previous);
          previous = start;
        };
      }
    },
    {
      scenario,
      tickHz: RULES.tick,
      snapshotHz: RULES.snapshot,
      boss: BOSS,
      heroes: HEROES,
      gpu: GPU,
    },
  );
  if (GPU) {
    await expect
      .poll(
        () =>
          page.evaluate(
            (heroes) => {
              const rigs = (window as any).__perfGame.scene.getScene(
                "arena",
              ).rigs;
              return heroes.every(
                (hero, i) =>
                  rigs.get(i ? `p${i + 1}` : "me")?.character === hero,
              );
            },
            scenario === "pvp2" ? HEROES.slice(0, 2) : HEROES,
          ),
        {
          timeout: 30_000,
          message: "selected squad art loads before the fight clock starts",
        },
      )
      .toBe(true);
    await page.evaluate(() => (window as any).__startGpuFight());
  }
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
  return {
    heapMB: Math.round((usedSize / 2 ** 20) * 10) / 10,
    ...result.value,
  };
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
  test(`profiles the ${scenario} battle client`, async ({
    browser,
    browserName,
  }, info) => {
    test.skip(browserName !== "chromium", "Uses Chromium CDP");
    test.setTimeout(150_000);
    const context = await phone(browser);
    try {
      const page = await context.newPage();
      await instrument(page);
      await countPlateMeasures(page);
      const errors = await openHub(page);
      await enterBattle(page, scenario);
      await startFight(page, scenario);
      // Warm up past layout settling and the first effects.
      await page.waitForTimeout(SETTLE_MS);
      // Compact snapshots carry no names: they come from the appearance
      // block, and must still reach the nameplates.
      await expect(
        page.locator(".battle-nameplate .player-name"),
      ).toContainText(["Player 2"], { timeout: 20_000 });
      await expect(
        page.locator(".battle-nameplate .player-title", {
          hasText: "Raid Veteran",
        }),
      ).toHaveCount(1);
      await page.evaluate(() => {
        const w = window as any;
        const p = w.__perf;
        for (const k of Object.keys(p)) p[k] = [];
        w.__plateMeasures = { all: 0, hidden: 0 };
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send("Performance.enable");
      const before = await cdp.send("Performance.getMetrics");
      await page.waitForTimeout(SECONDS * 1000);
      const after = await cdp.send("Performance.getMetrics");
      await cdp.detach();
      const raw = await page.evaluate(() => (window as any).__perf);
      const plates = await page.evaluate(() => (window as any).__plateMeasures);
      const hiddenPlates = await page
        .locator(".battle-nameplate[hidden]")
        .count();
      const gpu = GPU
        ? await page.evaluate(() => {
            const w = window as any,
              canvas = w.__perfGame.canvas,
              gl = w.__perfGame.renderer.gl;
            return {
              changes: w.__gpuChanges,
              quality: w.__arenaPerf.quality(),
              width: canvas.width,
              height: canvas.height,
              pixels: canvas.width * canvas.height,
              pipeline: w.__perfGame.renderer.pipelines.default.name,
              inFocus: w.__perfGame.loop.inFocus,
              simulation: w.__simulation,
              antialias: gl.getContextAttributes()?.antialias,
              samples: gl.getParameter(gl.SAMPLES),
            };
          })
        : undefined;
      if (GPU)
        await snap(page, info, `gpu-${scenario}-${QUALITY ?? "default"}`);
      await stopFight(page);
      const metric = (m: any, name: string) =>
        m.metrics.find((x: any) => x.name === name)?.value ?? 0;
      const cpu = Object.fromEntries(
        [
          "TaskDuration",
          "ScriptDuration",
          "LayoutDuration",
          "RecalcStyleDuration",
        ].map((n) => [
          n,
          Math.round((metric(after, n) - metric(before, n)) * 1000),
        ]),
      );
      const result = {
        scenario,
        ...(gpu
          ? {
              gpu: {
                ...gpu,
                boss: scenario === "raid4" ? BOSS : undefined,
                heroes: HEROES,
                settleMs: SETTLE_MS,
                phases: [...new Set(raw.gpu.map((f: any) => f.phase))],
                // Progress over exactly the sampled frames, independent of
                // later screenshot/CDP round trips.
                progressDriftMs:
                  (raw.gpu.at(-1).serverTime - raw.gpu[0].serverTime) * 1000 -
                  (raw.gpu.at(-1).clockMs - raw.gpu[0].clockMs),
                density: stats(raw.gpu.map((f: any) => f.density)),
                glow: stats(raw.gpu.map((f: any) => f.glow)),
                soft: stats(raw.gpu.map((f: any) => f.soft)),
                particles: stats(raw.gpu.map((f: any) => f.particles)),
                animationDelta: stats(
                  raw.gpu.map((f: any) => f.animationDelta),
                ),
                drawCalls: stats(raw.gpu.map((f: any) => f.drawCalls)),
                vertices: stats(raw.gpu.map((f: any) => f.vertices)),
                textureBinds: stats(raw.gpu.map((f: any) => f.textureBinds)),
              },
            }
          : {}),
        seconds: SECONDS,
        note: "SwiftShader software WebGL: compare runs on one machine; not phone FPS",
        snapshotHandlingMs: stats(raw.push),
        snapshotBytes: stats(raw.bytes),
        sceneUpdateMs: stats(raw.update),
        inputStepMs: stats(raw.input),
        frameStepMs: stats(raw.step),
        frameIntervalMs: stats(raw.frames),
        longFrames: raw.frames.filter((d: number) => d > 50).length,
        nameplateMeasures: { ...plates, hiddenPlates },
        mainThreadMs: cpu,
        memory: await heap(context, page),
      };
      console.log("BATTLE_PROFILE", JSON.stringify(result));
      await info.attach(`${scenario}-profile`, {
        body: JSON.stringify(result, null, 2),
        contentType: "application/json",
      });
      if (GPU) {
        expect([...new Set(raw.gpu.map((f: any) => f.phase))]).toEqual([
          "playing",
        ]);
        expect(
          Math.abs(result.gpu!.progressDriftMs),
          "sample must follow the server clock",
        ).toBeLessThan(500);
        expect(result.gpu!.simulation.skipped).toBe(0);
      }
      // The software renderer starves timers, so the actual arrival count can be below RULES.snapshot.
      expect(raw.push.length).toBeGreaterThanOrEqual(SECONDS * 2);
      // Generous guards: a regression to per-snapshot rebuilds would blow these.
      expect(result.snapshotHandlingMs.p50).toBeLessThan(25);
      expect(result.frameStepMs.n).toBeGreaterThan(3);
      // A hidden nameplate (an off-screen fighter) is never measured, and
      // a shown one only when its title changes, not every frame.
      expect(plates.hidden).toBe(0);
      expect(plates.all).toBeLessThan(result.frameStepMs.n / 2 + 8);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("keeps memory steady across repeated battles, Lobby, Shop and Wardrobe", async ({
  browser,
  browserName,
}, info) => {
  test.skip(browserName !== "chromium", "Uses Chromium CDP");
  test.setTimeout(120_000 + CYCLES * 60_000);
  const context = await phone(browser);
  try {
    const page = await context.newPage();
    await instrument(page);
    const errors = await openHub(page);
    const samples: Record<string, unknown>[] = [];
    for (let cycle = 0; cycle < CYCLES; cycle++) {
      await enterBattle(page, cycle % 2 ? "raid4" : "pvp4");
      await startFight(page, cycle % 2 ? "raid4" : "pvp4");
      await page.waitForTimeout(3000);
      await stopFight(page);
      await page.click("#battle-menu");
      await page.click("#exit-room");
      // A raid exit returns to the boss list; close it to see the Lobby.
      if (cycle % 2) await closeRaids(page);
      await page.evaluate(() => {
        const d = document.querySelector<HTMLDialogElement>("#dialog");
        if (d?.open)
          document.querySelector<HTMLButtonElement>("#close-dialog")?.click();
      });
      await expect(page.locator("#lobby-play")).toBeVisible({
        timeout: 20_000,
      });
      // A Shop and a Wardrobe visit between matches (the fitting room).
      await page.evaluate(
        () => void (window as any).__account.showShop("skins"),
      );
      await expect(page.locator(".fit-room")).toHaveCount(1);
      await page.waitForTimeout(800);
      await page.evaluate(() => void (window as any).__account.showWardrobe());
      await expect(
        page.locator('.fit-room[data-fit-mode="wardrobe"]'),
      ).toHaveCount(1);
      await page.waitForTimeout(800);
      await page.locator(".fit-room .ui-close").click();
      // (A closed Shop stays in the page, hidden, for its next open: ui/hub-panel.ts park.)
      await expect(
        page.locator(".fit-room:not([data-ui-leaving])"),
      ).toHaveCount(0);
      await page.waitForTimeout(500);
      samples.push({ cycle, ...(await heap(context, page)) });
    }
    console.log("SOAK_PROFILE", JSON.stringify(samples));
    await info.attach("soak", {
      body: JSON.stringify(samples, null, 2),
      contentType: "application/json",
    });
    // After the first cycle has warmed caches, later cycles must not keep
    // growing. Each closed battle used to stay in memory with its whole
    // renderer (~6 MB a cycle, via Phaser's shared bake camera).
    const heapAt = (i: number) => samples[i].heapMB as number;
    if (samples.length >= 3)
      expect(heapAt(samples.length - 1) - heapAt(1)).toBeLessThan(
        3 * (samples.length - 2) + 4,
      );
    const objectsAt = (i: number) => samples[i].sceneObjects as number;
    expect(objectsAt(samples.length - 1)).toBeLessThanOrEqual(
      objectsAt(0) * 1.5 + 20,
    );
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
