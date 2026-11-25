import { expect, test, type Browser } from "@playwright/test";
import { RULES } from "../../packages/shared/src/index";
import { openHub, openPlayPanel, pushUntilBattle, createRoom } from "./helpers";

/**
 * How much of the page the browser restyles while two players fight.
 *
 * The battle HUD changes many times a second (cooldown sweeps, countdowns,
 * nameplates). Each change makes the browser recalculate styles, normally
 * of the few elements that changed. A CSS rule elsewhere can make every one
 * of those changes restyle far more: `:has()` with a broad subject did it
 * twice (15 Nov: about 140 elements a recalculation; 25 Nov: a Profile-screen
 * rule, closed in battle, cost 40% of a duel's style time and left a Pixel
 * 8a at 23–29 fps). docs/network-performance.md, section 14.
 *
 * Counted, not timed: Chromium's trace says how many elements each
 * recalculation touched (`UpdateLayoutTree` elementCount), the same on a
 * fast or a slow machine. 25 Nov 2026, before the HUD's writes were fixed
 * (section 20): median 55, p90 109 in every run; with the old Profile rule
 * put back, 448 and 448. Since: median 4, p90 16 in four runs out of four.
 * The limits sit between the two, several times today's numbers, so a HUD
 * write that makes a new node each time (`textContent =`), or a rule that
 * widens what each change restyles, fails here.
 * Elements per second is printed, not judged: it follows the frame rate.
 * STYLE_BUDGET_MEASURE=1 prints the numbers without judging.
 */
const LIMITS = {
  /** Elements restyled in a typical recalculation. */
  perRecalcMedian: 20,
  /** ... and in the busier ones (cooldown sweeps, casts). */
  perRecalcP90: 60,
};
const FIGHT_MS = 12_000;
const MEASURE = !!process.env.STYLE_BUDGET_MEASURE;

async function measureDuel(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 915, height: 412 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("ea-graphics", "low");
      // The same fight every run (mulberry32).
      let seed = 0x5eed;
      Math.random = () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    });
    const errors = await openHub(page);
    await page.evaluate(async () => {
      const w = window as any;
      w.__room("pvp", { mode: "duel", phase: "briefing" });
      const m = await import("/rooms.ts");
      const a = new m.Arena("PVP123", "duel");
      a.add("me", "Player 1", "cindrake");
      a.add("p2", "Player 2", "voltkit");
      a.start();
      w.__arena = a;
      w.__pack = () => m.packSnapshot(a.snapshot());
      w.__snap = w.__pack();
    });
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    // The fight: both cast, cooldowns run, the HUD changes all the time.
    await page.evaluate(
      async ({ tickHz, snapshotHz }) => {
        const w = window as any;
        const m = await import("/rooms.ts");
        const a = w.__arena;
        a.phase = "playing";
        a.deadline = a.time + 1e6;
        let tick = 0;
        const step = () => {
          tick++;
          a.players.forEach((p: any, i: number) => {
            p.hp = Math.max(p.hp, 60);
            const target = a.players[(i + 1) % a.players.length];
            a.submit(p, {
              ...m.blankInput(),
              seq: p.ack + 1,
              dx: Math.cos(tick / 25 + i * 2),
              dy: Math.sin(tick / 25 + i * 2),
              aimX: target.x,
              aimY: target.y,
              basic: true,
              skill:
                (tick + i * 13) % 45 === 0 ? ((tick / 45 + i) | 0) % 4 : -1,
            });
          });
          a.tick();
          if (tick % Math.round(tickHz / snapshotHz)) return;
          w.__snap = w.__pack();
          w.__push();
        };
        const from = performance.now();
        let stepped = 0;
        w.__fight = setInterval(() => {
          const due = Math.floor(((performance.now() - from) * tickHz) / 1000);
          if (due - stepped > 10) stepped = due - 10;
          while (stepped < due) {
            stepped++;
            step();
          }
        }, 1000 / tickHz);
      },
      { tickHz: RULES.tick, snapshotHz: RULES.snapshot },
    );
    // Past the countdown and the first casts.
    await page.waitForTimeout(3000);
    await browser.startTracing(page, {
      categories: [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
      ],
    });
    await page.waitForTimeout(FIGHT_MS);
    const trace = JSON.parse((await browser.stopTracing()).toString());
    await page.evaluate(() => clearInterval((window as any).__fight));
    const counts: number[] = [];
    // The count is on the event's end ("E", or a complete "X" event).
    for (const e of trace.traceEvents ?? [])
      if (
        e.name === "UpdateLayoutTree" &&
        (e.ph === "E" || e.ph === "X") &&
        typeof e.args?.elementCount === "number"
      )
        counts.push(e.args.elementCount);
    const sorted = counts.slice().sort((x, y) => x - y);
    const total = counts.reduce((s, n) => s + n, 0);
    return {
      recalcs: counts.length,
      perRecalcMedian: sorted[sorted.length >> 1] ?? 0,
      perRecalcP90: sorted[Math.floor(sorted.length * 0.9)] ?? 0,
      perRecalcMax: sorted[sorted.length - 1] ?? 0,
      perSecond: Math.round(total / (FIGHT_MS / 1000)),
      errors,
    };
  } finally {
    await context.close();
  }
}

test("a duel restyles only the elements that change", async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Chromium's trace counts elements");
  test.setTimeout(150_000);
  const r = await measureDuel(browser);
  console.log("STYLE_BUDGET", JSON.stringify({ ...r, errors: undefined }));
  expect(r.recalcs, "style recalculations traced").toBeGreaterThan(20);
  if (MEASURE) return;
  expect(
    r.perRecalcMedian,
    "elements per recalculation (median)",
  ).toBeLessThanOrEqual(LIMITS.perRecalcMedian);
  expect(
    r.perRecalcP90,
    "elements per recalculation (p90)",
  ).toBeLessThanOrEqual(LIMITS.perRecalcP90);
  expect(r.errors).toEqual([]);
});
