import { expect, test, type Page } from "@playwright/test";
import { battlePerfSchema } from "../../packages/shared/src/connection";
import { openHub, openPlayPanel, pushUntilBattle, snap } from "./helpers";

/**
 * A match in its real order — dressed fighters from the first snapshot, the
 * briefing, then the fight — must not make an older phone work harder than
 * it has to while players fight:
 *
 * - every fighter's art (skins too) is loaded by the end of the briefing:
 *   none loads mid-fight (each load stalls the frame it lands in);
 * - the page's layout is barely read per frame: a read after a style
 *   change forces the browser to lay the page out again (an off-screen
 *   fighter's nameplate once did that every frame);
 * - the page and the scene do not keep growing during the fight;
 * - when the match ends, one performance report goes to the server
 *   ("battle-perf", battle-perf.ts), and it is valid.
 *
 * Counted, not timed: this machine draws on the CPU. A scenario that
 * swaps fighters in mid-fight would load art mid-fight by design, so the
 * room is dressed before the battle opens.
 */
/**
 * The game's own layout reads per live frame. Nameplates measure once and
 * cache, so this is about 0; a read every frame (the bug this guards
 * against) is 1 or more at any frame rate.
 */
const MAX_LAYOUT_READS_PER_FRAME = 0.25;
const BRIEFING_MS = 6000;
const FIGHT_MS = 16_000;

async function instrument(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    const marker =
      "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(marker, "window.__perfGame=gameInstance;" + marker),
    });
  });
  await page.addInitScript(() => {
    const w = window as any;
    localStorage.setItem("ea-perf", "1");
    // Layout reads while a live frame runs (what forces layout per frame).
    w.__layout = {
      reads: 0,
      phaser: 0,
      by: {} as Record<string, number>,
      frames: 0,
    };
    w.__inFrame = false;
    const count = (name: string) => {
      if (!w.__inFrame) return;
      // Phaser's scale manager checks the canvas's parent size on a timer
      // (twice every 500 ms, whatever the frame rate): counted apart, or a
      // slow machine's few frames would make it look like a read a frame.
      if (/getParentBounds/.test(new Error().stack ?? "")) {
        w.__layout.phaser++;
        return;
      }
      w.__layout.reads++;
      w.__layout.by[name] = (w.__layout.by[name] ?? 0) + 1;
    };
    for (const prop of [
      "offsetWidth",
      "offsetHeight",
      "offsetTop",
      "offsetLeft",
      "clientWidth",
      "clientHeight",
    ] as const) {
      const proto = prop.startsWith("offset")
        ? HTMLElement.prototype
        : Element.prototype;
      const real = Object.getOwnPropertyDescriptor(proto, prop)!;
      Object.defineProperty(proto, prop, {
        configurable: true,
        get() {
          count(prop);
          return real.get!.call(this);
        },
      });
    }
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      count("getBoundingClientRect");
      return rect.call(this);
    };
    const style = window.getComputedStyle;
    window.getComputedStyle = function (...args: Parameters<typeof style>) {
      count("getComputedStyle");
      return style.apply(this, args);
    };
    w.__emitted = [] as [string, unknown][];
    w.__emit = (ev: string, data: unknown) => w.__emitted.push([ev, data]);
  });
}

for (const quality of ["high", "low"] as const)
  test(`a match in its real order stays light while players fight (${quality})`, async ({
    browser,
  }, info) => {
    test.setTimeout(150_000);
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await instrument(page);
      // Settings → Graphics (the harness pins High otherwise).
      await page.addInitScript(
        (q) => localStorage.setItem("ea-graphics", q),
        quality,
      );
      const errors = await openHub(page);
      // A dressed four-player match, in its briefing from the first snapshot.
      await page.evaluate(async () => {
        const w = window as any;
        w.__room("pvp", { mode: "ffa", phase: "briefing" });
        const m = await import("/rooms.ts");
        const a = new m.Arena("PVP123", "ffa");
        ["voltkit", "cindrake", "tidefin", "lumoth"].forEach((c, i) =>
          a.add(i ? `p${i + 1}` : "me", `Player ${i + 1}`, c),
        );
        a.players.forEach((p: any, i: number) => m.dressUp(p, i));
        a.start();
        w.__arena = a;
        w.__pack = () => m.packSnapshot(a.snapshot());
        w.__snap = w.__pack();
      });
      await openPlayPanel(page);
      await page.click("#play-create");
      await pushUntilBattle(page);
      await page.evaluate(() => {
        const w = window as any;
        const game = w.__perfGame;
        // Canvas resizes during the fight (each reallocates its buffer).
        w.__resizes = 0;
        const resize = game.scale.resize.bind(game.scale);
        game.scale.resize = (...a: [number, number]) => {
          if (w.__live) w.__resizes++;
          return resize(...a);
        };
        const step = game.loop.callback;
        game.loop.callback = (time: number, delta: number) => {
          const live = w.__live;
          if (live) w.__layout.frames++;
          w.__inFrame = live;
          try {
            step(time, delta);
          } finally {
            w.__inFrame = false;
          }
          // Effect work while four fighters cast (printed, for Low's budget).
          if (live && w.__arenaPerf) {
            const fx = w.__arenaPerf.fx();
            w.__glow.push(fx.glowCover - fx.essentialCover);
            w.__minShrink = Math.min(w.__minShrink ?? 1, fx.shrink);
          }
        };
        w.__brief = setInterval(() => {
          w.__snap = w.__pack();
          w.__push();
        }, 1000 / 15);
      });
      await page.waitForTimeout(BRIEFING_MS);
      const counts = () =>
        page.evaluate(() => {
          const w = window as any;
          const game = w.__perfGame;
          return {
            rigTextures: Object.keys(game.textures.list).filter((k) =>
              k.startsWith("rig-"),
            ).length,
            dom: document.getElementsByTagName("*").length,
            sceneObjects: game.scene.getScene("arena").children.list.length,
            // Everything but the effects engine's pooled sprites (kept and
            // reused at the busiest moment's size, by design).
            unpooled: game.scene
              .getScene("arena")
              .children.list.filter((o: any) => o.texture?.key !== "fx-glow")
              .length,
          };
        });
      // The fight: players spread out (some off screen), everyone casting.
      await page.evaluate(async () => {
        const w = window as any;
        clearInterval(w.__brief);
        const m = await import("/rooms.ts");
        const a = w.__arena;
        a.phase = "playing";
        a.deadline = a.time + 1e6;
        a.players.forEach((p: any, i: number) => {
          p.x = [250, 1350, 250, 1350][i];
          p.y = [200, 200, 750, 750][i];
        });
        let tick = 0;
        w.__fight = setInterval(() => {
          tick++;
          a.players.forEach((p: any, i: number) => {
            p.hp = Math.max(p.hp, 60);
            p.ult = 100;
            const target = a.players[(i + 1) % a.players.length];
            a.submit(p, {
              ...m.blankInput(),
              seq: p.ack + 1,
              dx: Math.cos(tick / 20 + i),
              dy: Math.sin(tick / 20 + i),
              aimX: target.x,
              aimY: target.y,
              basic: true,
              skill:
                (tick + i * 11) % 30 === 0 ? ((tick / 30 + i) | 0) % 4 : -1,
            });
          });
          a.tick();
          if (tick % 2) return;
          w.__snap = w.__pack();
          w.__push();
        }, 1000 / 30);
      });
      // A moment for the round to start (the countdown, the camera).
      await page.waitForTimeout(2000);
      const before = await counts();
      await page.evaluate(() => {
        const w = window as any;
        w.__layout = { reads: 0, phaser: 0, by: {}, frames: 0 };
        w.__glow = [];
        w.__live = true;
      });
      await page.waitForTimeout(FIGHT_MS);
      await page.evaluate(() => ((window as any).__live = false));
      // `?perf=1` (here, its saved form): the read-out shows real numbers
      // and never catches a touch meant for the battle.
      const overlay = page.locator(".perf-overlay");
      await expect(overlay).toBeVisible();
      await expect(overlay).toContainText(/\d+ fps/);
      await expect(overlay).toContainText(
        quality === "high" ? /high 2×/ : /low 1\.5×/,
      );
      expect(
        await overlay.evaluate((el) => getComputedStyle(el).pointerEvents),
      ).toBe("none");
      await snap(page, info, `match-perf-overlay-${quality}`);
      const after = await counts();
      const layout = await page.evaluate(() => (window as any).__layout);
      const glow = await page.evaluate(() => {
        const v = ((window as any).__glow as number[])
          .slice()
          .sort((a, b) => a - b);
        const q = (f: number) =>
          Math.round(v[Math.floor((v.length - 1) * f)] * 100) / 100;
        return {
          p50: q(0.5),
          p90: q(0.9),
          max: q(1),
          minShrink: (window as any).__minShrink ?? 1,
          resizes: (window as any).__resizes,
        };
      });
      // The match ends: the report goes out once.
      await page.evaluate(() => {
        const w = window as any;
        clearInterval(w.__fight);
        w.__arena.phase = "finished";
        w.__snap = w.__pack();
        w.__push();
      });
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as any).__emitted.filter(
                ([ev]: [string]) => ev === "battle-perf",
              ).length,
          ),
        )
        .toBe(1);
      // The effects play out (no new ones come once the match is over).
      let settled = await counts();
      await expect
        .poll(async () => (settled = await counts()).unpooled, {
          timeout: 30_000,
          intervals: [500],
        })
        .toBeLessThanOrEqual(before.unpooled + 40)
        .catch(() => undefined);
      const report = await page.evaluate(
        () =>
          (window as any).__emitted.find(
            ([ev]: [string]) => ev === "battle-perf",
          )[1],
      );
      console.log(
        "MATCH_FLOW",
        JSON.stringify({ before, after, settled, layout, glow, report }),
      );
      expect(after.rigTextures, "no fighter art loads mid-fight").toBe(
        before.rigTextures,
      );
      expect(layout.frames).toBeGreaterThan(5);
      expect(
        layout.reads / layout.frames,
        `layout reads per frame (${JSON.stringify(layout.by)})`,
      ).toBeLessThanOrEqual(MAX_LAYOUT_READS_PER_FRAME);
      expect(
        after.dom - before.dom,
        "the page does not keep growing",
      ).toBeLessThan(40);
      // Nothing leaks: once the match is over and its effects have played
      // out, the scene is back to where the fight started (pooled effect
      // sprites aside). Judged after the fight, not during it: on a machine
      // under 5 fps Phaser slows game time, so effects pile up while it lasts.
      expect(
        settled.unpooled,
        "the scene goes back to its size once the effects end",
      ).toBeLessThanOrEqual(before.unpooled + 40);
      expect(battlePerfSchema.safeParse(report).success).toBe(true);
      expect(report.quality).toBe(quality);
      expect(report.density).toBe(quality === "high" ? 2 : 1.5);
      if (quality === "low") {
        // Low's glow budget (0.75 screens) holds crowded fights' glow light
        // down, shrinking decorative glows smoothly when it must.
        expect(glow.minShrink, "the glow budget engaged").toBeLessThan(1);
        expect(glow.p90).toBeLessThanOrEqual(0.85);
      } else expect(glow.minShrink).toBe(1);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
