import { expect, test, type Page } from "@playwright/test";
import { CHARACTERS, type CharacterId } from "../../packages/shared/src/index";
import { openHub, openPlayPanel, pushUntilBattle } from "./helpers";

/**
 * Effect budget: no champion's skills may ask the GPU for much more than
 * the heaviest kit we already ship. Older Android phones lag when skills go
 * off: effects add drawing work their GPU pays for per pixel, on top of the
 * court and fighters (docs/network-performance.md), so a new champion or a
 * reworked skill
 * fails here if it draws about twice the light, smoke or particles of any kit
 * today.
 *
 * Measured as work, not time (this machine draws on the CPU, so frame rates
 * here mean little): the effects engine's own per-frame counts
 * (fx-engine.ts FxFrameStats, read through `?perf=1`). Each champion casts
 * its four skills and its ultimate one at a time at a training dummy that
 * does nothing, with Math.random seeded, and the heaviest frame of each
 * cast counts. Cover is in screens: 1 means sprites as big as the whole
 * battle canvas.
 *
 * If a new kit fails: make its effect lighter (fewer or smaller glows,
 * fewer particles, shorter trails), or, if it really must be heavier, say
 * so in the pull request and raise the limit below on purpose.
 * EFFECT_BUDGET_MEASURE=1 prints every champion's numbers instead.
 */
/**
 * About twice the heaviest kit seen in any run on 10 Nov 2026: glow 0.30
 * screens (Sunbara, Pyranda), smoke 0.52 (Cindrake), particles 218
 * (Pyranda). Which frame a run catches varies a cast's peak by up to about
 * 40% (Cindrake's glow measured 0.21 to 0.29), so the margin is wide enough
 * that a faster machine catching the true peak does not fail, and narrow
 * enough that a kit twice as heavy as any we ship does.
 */
const LIMITS = {
  /** Additive glow light, in screens. */
  glowCover: 0.6,
  /** Soft smoke and flame bodies, in screens. */
  softCover: 1,
  /** Live particles (the engine's hard cap is 700). */
  particles: 450,
};
const MEASURE = !!process.env.EFFECT_BUDGET_MEASURE;
const CHAMPIONS = Object.keys(CHARACTERS) as CharacterId[];
/** Three groups, so CI shards can run them side by side. */
const GROUPS = [0, 1, 2].map((g) => CHAMPIONS.filter((_, i) => i % 3 === g));
const CASTS = ["skill 1", "skill 2", "skill 3", "skill 4", "ultimate"];
const CAST_GAP = 1800;
/** After the last cast, until its effects have played out. */
const TAIL = 2500;

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
    localStorage.setItem("ea-perf", "1");
    // The same particles every run (mulberry32).
    let seed = 0x5eed;
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
}

type Peak = {
  glowCover: number;
  softCover: number;
  particles: number;
  glows: number;
};

for (const [g, group] of GROUPS.entries())
  test(`every skill stays within the effect budget (group ${g + 1})`, async ({
    browser,
  }) => {
    test.setTimeout(
      60_000 + group.length * (CASTS.length * CAST_GAP + TAIL + 2500) * 2,
    );
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await instrument(page);
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("pvp", { mode: "duel", phase: "playing" }),
      );
      await openPlayPanel(page);
      await page.click("#play-create");
      await pushUntilBattle(page);
      // Each frame, the heaviest effect work so far for the current cast.
      await page.evaluate(() => {
        const w = window as any;
        const game = w.__perfGame;
        w.__peaks = {};
        w.__cast = "";
        const step = game.loop.callback;
        game.loop.callback = (time: number, delta: number) => {
          step(time, delta);
          if (!w.__cast || !w.__arenaPerf) return;
          const s = w.__arenaPerf.fx();
          // The champion's heaviest frame (what is judged), and each
          // cast's for the printout (a cast can land a little late).
          for (const key of [w.__cast, w.__skill]) {
            const p = (w.__peaks[key] ??= {
              glowCover: 0,
              softCover: 0,
              particles: 0,
              glows: 0,
            });
            p.glowCover = Math.max(p.glowCover, s.glowCover);
            p.softCover = Math.max(p.softCover, s.softCover);
            p.particles = Math.max(p.particles, s.particles);
            p.glows = Math.max(p.glows, s.glows);
          }
        };
      });
      const results: Record<string, Peak> = {};
      for (const champion of group) {
        await page.evaluate(async (champion) => {
          const w = window as any;
          clearInterval(w.__fight);
          const m = await import("/rooms.ts");
          const a = new m.Arena("PVP123", "duel");
          // Carry on the event numbering: the client skips any event whose
          // id it has already passed, so a fresh count would hide the casts.
          a.serial = w.__arena?.serial ?? 0;
          a.add("me", "Player 1", champion);
          a.add(
            "dummy",
            "Dummy",
            champion === "voltkit" ? "cindrake" : "voltkit",
          );
          a.start();
          a.phase = "playing";
          a.deadline = a.time + 1e6;
          const [me, dummy] = a.players;
          me.x = 650;
          me.y = 450;
          dummy.x = 900;
          dummy.y = 450;
          w.__arena = a;
          w.__pending = -2;
          let tick = 0;
          w.__fight = setInterval(() => {
            tick++;
            me.hp = Math.max(me.hp, 500);
            dummy.hp = Math.max(dummy.hp, 500);
            const cast = w.__pending;
            w.__pending = -2;
            if (cast === -1) me.ult = 100;
            a.submit(me, {
              ...m.blankInput(),
              seq: me.ack + 1,
              aimX: dummy.x,
              aimY: dummy.y,
              skill: cast >= 0 ? cast : -1,
              ultimate: cast === -1,
            });
            // The dummy stands still and casts nothing.
            a.submit(dummy, { ...m.blankInput(), seq: dummy.ack + 1 });
            a.tick();
            if (tick % 2) return;
            w.__snap = m.packSnapshot(a.snapshot());
            w.__push();
          }, 1000 / 30);
        }, champion);
        // The new fighter's art loads first (not measured).
        await page.waitForTimeout(2500);
        for (const [i, cast] of CASTS.entries()) {
          await page.evaluate(
            ([champion, label, slot]) => {
              const w = window as any;
              w.__cast = champion;
              w.__skill = label;
              w.__pending = slot;
            },
            [champion, `${champion} ${cast}`, i < 4 ? i : -1] as const,
          );
          await page.waitForTimeout(CAST_GAP);
        }
        // The last effects finish, still counted for this champion.
        await page.waitForTimeout(TAIL);
        await page.evaluate(() => ((window as any).__cast = ""));
        Object.assign(
          results,
          await page.evaluate(() => (window as any).__peaks),
        );
        await page.evaluate(() => ((window as any).__peaks = {}));
      }
      const champions = Object.entries(results).filter(([k]) =>
        group.includes(k as CharacterId),
      );
      const rows = Object.entries(results).map(
        ([label, p]) =>
          `${label.padEnd(22)} glow ${p.glowCover.toFixed(2).padStart(6)} scr (${String(p.glows).padStart(3)})  smoke ${p.softCover.toFixed(2).padStart(6)} scr  particles ${String(p.particles).padStart(4)}`,
      );
      console.log(`EFFECT_BUDGET group ${g + 1}\n${rows.join("\n")}`);
      if (!MEASURE) {
        const over = champions.flatMap(([label, p]) =>
          (Object.keys(LIMITS) as (keyof typeof LIMITS)[])
            .filter((k) => p[k] > LIMITS[k])
            .map(
              (k) =>
                `${label}: ${k} ${Number(p[k]).toFixed(2)} is over the limit ${LIMITS[k]}`,
            ),
        );
        expect(over, "effects heavier than any kit we ship").toEqual([]);
      }
      // Every champion's casts drew something: the measurement saw them.
      for (const champion of group) {
        const p = results[champion];
        expect(
          (p?.glows ?? 0) + (p?.particles ?? 0),
          `${champion}'s effects were seen`,
        ).toBeGreaterThan(0);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
