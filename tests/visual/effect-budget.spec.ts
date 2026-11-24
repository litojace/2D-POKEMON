import { expect, test, type Page } from "@playwright/test";
import { CHARACTERS, type CharacterId } from "../../packages/shared/src/index";
import { openHub, openPlayPanel, pushUntilBattle, createRoom } from "./helpers";

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
 *
 * Casts are spaced in effect time (the frame steps Phaser gives the
 * effects), not wall-clock time: under 5 fps Phaser slows game time, so on
 * a slow runner effects outlive their place and the next cast's peak
 * counted the last one's too. On CI (about 6 fps) Pyranda's ultimate read
 * 530 particles and 1.01 smoke (19 Nov 2026), on this container 271 and
 * 0.54, and 693 and 0.90 with the CPU slowed 4×; spaced in effect time,
 * 4× slower reads as this container does.
 *
 * A trail (fx.trail) emits at most once a frame, so a slow machine (this
 * container renders at about 12 fps) sees less of a fast trail than a phone
 * at 60 fps. When a kit is near a limit, measure it with fx.trail emitting
 * every interval it missed (a local change, not committed): on 18 Nov 2026
 * Cindrake read 1.3 glow and 2.4 smoke that way, against 0.4 and 1.3 here.
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

/** Wait until the effects have run `ms` of their own time (see above). */
async function effectWait(page: Page, ms: number) {
  const end = await page.evaluate((ms) => (window as any).__clock + ms, ms);
  await page.waitForFunction((end) => (window as any).__clock >= end, end, {
    polling: 50,
    timeout: 60_000 + ms * 20,
  });
}

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
      60_000 + group.length * (CASTS.length * CAST_GAP + TAIL + 2500) * 4,
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
      // Measure High, the heaviest level: on Auto a slow machine drops to
      // Low (fewer particles, slower trails) and a kit's real weight hides.
      await page.addInitScript(() => {
        try {
          localStorage.setItem("ea-graphics", "high");
        } catch {}
      });
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("pvp", { mode: "duel", phase: "playing" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      // Each frame, the heaviest effect work so far for the current cast.
      await page.evaluate(() => {
        const w = window as any;
        const game = w.__perfGame;
        w.__peaks = {};
        w.__cast = "";
        // Effect time: what the frames step the effects by (ms).
        w.__clock = 0;
        const step = game.loop.callback;
        game.loop.callback = (time: number, delta: number) => {
          w.__clock += delta;
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
          const start = w.__clock;
          // The arena keeps effect time: a slow machine runs the ticks it
          // missed (an interval that only fires a few times a second would
          // stretch every cast, and a later cast would land in an earlier
          // one's channel and be refused, so it was never measured).
          w.__fight = setInterval(() => {
            const before = tick,
              due = Math.min(
                tick + 8,
                Math.floor((w.__clock - start) / (1000 / 30)) + 1,
              );
            // A cast waits for a tick: in effect time an interval may run
            // none (the clock moves only with frames), and a cast taken then
            // was lost.
            while (tick < due) {
              tick++;
              const cast = w.__pending;
              w.__pending = -2;
              me.hp = Math.max(me.hp, 500);
              dummy.hp = Math.max(dummy.hp, 500);
              // The ultimate is the last skill slot, cast with a full meter
              // (an "ultimate" input field would be ignored: nothing was cast).
              if (cast === -1) me.ult = 100;
              a.submit(me, {
                ...m.blankInput(),
                seq: me.ack + 1,
                aimX: dummy.x,
                aimY: dummy.y,
                skill: cast >= 0 ? cast : cast === -1 ? m.ULT_SLOT : -1,
              });
              // The dummy stands still and casts nothing.
              a.submit(dummy, { ...m.blankInput(), seq: dummy.ack + 1 });
              a.tick();
            }
            // A snapshot every second tick, as the server sends them.
            if (Math.floor(tick / 2) === Math.floor(before / 2)) return;
            w.__snap = m.packSnapshot(a.snapshot());
            w.__push();
          }, 1000 / 30);
        }, champion);
        // The new fighter's art loads first (not measured), and the arena
        // runs its first ticks.
        await effectWait(page, 2500);
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
          await effectWait(page, CAST_GAP);
        }
        // The last effects finish, still counted for this champion.
        await effectWait(page, TAIL);
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

/**
 * Four-player free-for-all: the per-champion limits above judge one kit
 * at a time, but in a free-for-all four kits go off together, and on
 * 18 Nov 2026 the only battles that still stuttered on a phone were
 * four-player ones (arena-perf reports). The four heaviest kits measured
 * on 19 Nov 2026 (glow cover and count, particles) each cast the same
 * skill on the same tick, ultimates last, aimed across one another so the
 * effects overlap, and the heaviest frame counts.
 *
 * When a new or reworked kit measures heavier than one of these in the
 * per-champion test, put it in their place.
 */
const SQUAD: CharacterId[] = ["pyranda", "cindrake", "mystowl", "sunbara"];
/**
 * About twice the heaviest seen on 20 Nov 2026, casts spaced in effect
 * time: glow 1.03 to 1.23 screens (1.23 with the CPU slowed 4x), smoke 0.87
 * to 1.15, particles 382 to 583. Twice that is past the engine's hard cap
 * of 700 particles, so the cap is the particle limit.
 */
const FFA_LIMITS = {
  glowCover: 2.6,
  softCover: 2.9,
  particles: 700,
};

test("four heavy kits at once stay within the free-for-all budget", async ({
  browser,
}) => {
  test.setTimeout(60_000 + (CASTS.length * CAST_GAP + TAIL + 4000) * 4);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await instrument(page);
    await page.addInitScript(() => {
      try {
        localStorage.setItem("ea-graphics", "high");
      } catch {}
    });
    const errors = await openHub(page);
    await page.evaluate(() =>
      (window as any).__room("pvp", { mode: "ffa", phase: "playing" }),
    );
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    await page.evaluate(() => {
      const w = window as any;
      const game = w.__perfGame;
      w.__peak = { glowCover: 0, softCover: 0, particles: 0, glows: 0 };
      w.__peaks = {};
      w.__cast = "";
      // Effect time, as in the per-champion test above.
      w.__clock = 0;
      const step = game.loop.callback;
      game.loop.callback = (time: number, delta: number) => {
        w.__clock += delta;
        step(time, delta);
        if (!w.__cast || !w.__arenaPerf) return;
        const s = w.__arenaPerf.fx();
        for (const p of [
          w.__peak,
          (w.__peaks[w.__cast] ??= {
            glowCover: 0,
            softCover: 0,
            particles: 0,
            glows: 0,
          }),
        ]) {
          p.glowCover = Math.max(p.glowCover, s.glowCover);
          p.softCover = Math.max(p.softCover, s.softCover);
          p.particles = Math.max(p.particles, s.particles);
          p.glows = Math.max(p.glows, s.glows);
        }
      };
    });
    await page.evaluate(async (squad) => {
      const w = window as any;
      clearInterval(w.__fight);
      const m = await import("/rooms.ts");
      const a = new m.Arena("PVP123", "ffa");
      a.serial = w.__arena?.serial ?? 0;
      squad.forEach((c, i) =>
        a.add(i ? `p${i + 1}` : "me", `Player ${i + 1}`, c),
      );
      a.start();
      a.phase = "playing";
      a.deadline = a.time + 1e6;
      // A tight square in the middle of the court; each aims at the
      // opposite corner, so every effect crosses the middle.
      const spots = [
        [650, 350],
        [900, 350],
        [900, 550],
        [650, 550],
      ];
      a.players.forEach((p: any, i: number) => {
        [p.x, p.y] = spots[i];
      });
      w.__arena = a;
      w.__pending = -2;
      let tick = 0;
      // The arena keeps effect time, and a cast waits for a tick (see the
      // per-champion test).
      const start = w.__clock;
      w.__fight = setInterval(() => {
        const before = tick,
          due = Math.min(
            tick + 8,
            Math.floor((w.__clock - start) / (1000 / 30)) + 1,
          );
        while (tick < due) {
          tick++;
          const cast = w.__pending;
          w.__pending = -2;
          a.players.forEach((p: any, i: number) => {
            p.hp = Math.max(p.hp, 500);
            // Nobody's skill may be refused by another's stun or silence:
            // every kit's effect must be seen.
            p.statuses = [];
            if (cast === -1) p.ult = 100;
            const [x, y] = spots[(i + 2) % 4];
            a.submit(p, {
              ...m.blankInput(),
              seq: p.ack + 1,
              aimX: x,
              aimY: y,
              skill: cast >= 0 ? cast : cast === -1 ? m.ULT_SLOT : -1,
            });
          });
          a.tick();
        }
        if (Math.floor(tick / 2) === Math.floor(before / 2)) return;
        w.__snap = m.packSnapshot(a.snapshot());
        w.__push();
      }, 1000 / 30);
    }, SQUAD);
    // The four fighters' art loads first (not measured), and the arena runs
    // its first ticks.
    await effectWait(page, 4000);
    for (const [i, cast] of CASTS.entries()) {
      await page.evaluate(
        ([label, slot]) => {
          const w = window as any;
          w.__cast = label;
          w.__pending = slot;
        },
        [cast, i < 4 ? i : -1] as const,
      );
      await effectWait(page, CAST_GAP);
    }
    await effectWait(page, TAIL);
    const { peak, peaks } = await page.evaluate(() => {
      const w = window as any;
      w.__cast = "";
      clearInterval(w.__fight);
      return {
        peak: w.__peak as Peak,
        peaks: w.__peaks as Record<string, Peak>,
      };
    });
    const row = (label: string, p: Peak) =>
      `${label.padEnd(22)} glow ${p.glowCover.toFixed(2).padStart(6)} scr (${String(p.glows).padStart(3)})  smoke ${p.softCover.toFixed(2).padStart(6)} scr  particles ${String(p.particles).padStart(4)}`;
    console.log(
      `EFFECT_BUDGET ffa ${SQUAD.join(" + ")}\n${[
        row("all four", peak),
        ...Object.entries(peaks).map(([k, p]) => row(`all four ${k}`, p)),
      ].join("\n")}`,
    );
    if (!MEASURE)
      expect(
        (Object.keys(FFA_LIMITS) as (keyof typeof FFA_LIMITS)[])
          .filter((k) => peak[k] > FFA_LIMITS[k])
          .map(
            (k) =>
              `${k} ${Number(peak[k]).toFixed(2)} is over the limit ${FFA_LIMITS[k]}`,
          ),
        "four kits together heavier than the free-for-all budget",
      ).toEqual([]);
    // The casts were seen: more than any one kit draws alone.
    expect(peak.particles).toBeGreaterThan(LIMITS.particles / 2);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
