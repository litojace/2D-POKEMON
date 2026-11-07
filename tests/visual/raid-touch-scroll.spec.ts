import { expect, test, type Page } from "@playwright/test";
import { openHub } from "./helpers";
import { setInsets, ISLAND } from "./ui-measure";

// Every raid window that holds more than fits must scroll under a finger
// (on a phone first) (owner's report, 5 Nov). The swipe is real touch input (CDP
// touchStart/Move/End), which obeys touch-action and touch listeners the
// way a phone does; the mouse wheel and scrollTop don't. A plain scroll box
// first proves the swipe itself works in this browser.
const SIZES = [
  { name: "844x390", width: 844, height: 390, phone: true },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    phone: true,
    island: true,
  },
  { name: "667x375", width: 667, height: 375, phone: true },
  // A touch laptop or tablet: the same panels must scroll under a finger.
  { name: "1280x720", width: 1280, height: 720, phone: false },
  { name: "1440x900", width: 1440, height: 900, phone: false },
];

/** Touch input: a finger from (x, y) up by `dist` px. */
async function finger(page: Page, x: number, y: number, dist: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 10; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y - (dist * i) / 10 }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
  await page.waitForTimeout(350);
}

/**
 * Swipe `sel`'s scroller up to its end, the finger landing at a different
 * spot each time (cards, art, tags, text), and say where it got to.
 */
async function swipe(page: Page, sel: string) {
  const el = page.locator(sel).first();
  await expect(el).toBeVisible();
  const box = await el.evaluate((node) => {
    // The element itself, or the nearest ancestor, that scrolls.
    let s: HTMLElement | null = node as HTMLElement;
    while (s) {
      const o = getComputedStyle(s).overflowY;
      if (
        (o === "auto" || o === "scroll") &&
        s.scrollHeight > s.clientHeight + 4
      )
        break;
      s = s.parentElement;
    }
    const target = s ?? (node as HTMLElement);
    target.setAttribute("data-swipe-probe", "");
    target.scrollTop = 0;
    const t = target.getBoundingClientRect();
    return {
      overflow: target.scrollHeight - target.clientHeight,
      left: t.left,
      width: t.width,
      top: Math.max(t.top, 0),
      bottom: Math.min(t.bottom, innerHeight),
    };
  });
  const probe = page.locator("[data-swipe-probe]");
  const at = () => probe.evaluate((n) => (n as HTMLElement).scrollTop);
  const spots = [0.2, 0.5, 0.8, 0.35, 0.65, 0.5, 0.25, 0.75];
  const stuck: string[] = [];
  let first = 0;
  for (let i = 0; i < spots.length && box.overflow > 4; i++) {
    const before = await at();
    if (before >= box.overflow - 2) break;
    const h = box.bottom - box.top;
    const x = Math.round(box.left + box.width * spots[i]);
    const y = Math.round(box.bottom - Math.min(24, h / 5));
    const hit = await page.evaluate(
      ([x, y]) => {
        const e = document.elementFromPoint(x, y);
        return e
          ? `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`
          : "-";
      },
      [x, y],
    );
    await finger(page, x, y, Math.round(Math.max(30, h * 0.6)));
    const after = await at();
    if (i === 0) first = after - before;
    if (after - before < 4) stuck.push(`${hit} @${x},${y}`);
  }
  const end = await at();
  await probe.evaluate((n) => n.removeAttribute("data-swipe-probe"));
  return { overflow: box.overflow, first, end, stuck };
}

/** Wait for the screen to stop moving: finite animations (a panel's slide-in,
 * its contents arriving) finish before anything is measured. */
async function stillness(page: Page) {
  await page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every(
            (a) =>
              a.playState !== "running" ||
              a.effect?.getComputedTiming().iterations === Infinity,
          ),
      undefined,
      { timeout: 4000 },
    )
    .catch(() => {});
}

/**
 * Text and controls cut off (top or bottom) by a box that doesn't scroll
 * (overflow hidden or clip), so no swipe can bring them into sight. Inside
 * a scroller the scroller's own box is what must stay in sight.
 */
async function clipped(page: Page, sel: string) {
  await stillness(page);
  return page.locator(sel).evaluate((root) => {
    const out: string[] = [];
    const name = (e: Element) =>
      `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`;
    const items = root.querySelectorAll<HTMLElement>(
      "button, a, b, p, li, small, h2, h3, .ui-tag, .ui-note, summary",
    );
    for (const el of items) {
      let r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      // Not shown at all (a closed <details>, hidden): nothing to reach.
      if (
        !el.checkVisibility({
          contentVisibilityAuto: true,
          visibilityProperty: true,
        })
      )
        continue;
      for (
        let a = el.parentElement;
        a && a !== document.documentElement;
        a = a.parentElement
      ) {
        const cs = getComputedStyle(a);
        if (cs.overflowY === "visible") continue;
        const b = a.getBoundingClientRect();
        const scrolls =
          (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
          a.scrollHeight > a.clientHeight + 1;
        if (scrolls) {
          // Reachable inside it; the scroller itself must be in sight.
          r = b;
          continue;
        }
        const cut = Math.max(r.bottom - b.bottom, b.top - r.top);
        if (cut > 2) {
          out.push(
            `${name(el)} "${(el.textContent ?? "").trim().slice(0, 24)}" cut ${Math.round(cut)}px by ${name(a)}`,
          );
          break;
        }
      }
    }
    return out;
  });
}

for (const size of SIZES)
  test(`raid windows scroll by touch at ${size.name}`, async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: true,
    });
    const results: Record<string, Awaited<ReturnType<typeof swipe>>> = {};
    const cuts: Record<string, string[]> = {};
    try {
      const page = await context.newPage();
      const errors = await openHub(page);
      if (size.island) await setInsets(page, ISLAND);
      // The swipe works: a plain scroll box on top of the page moves.
      await page.evaluate(() => {
        const d = document.createElement("div");
        d.id = "probe-box";
        d.style.cssText =
          "position:fixed;left:200px;top:60px;width:200px;height:200px;overflow:auto;z-index:99999;background:#fff";
        d.innerHTML = '<div style="height:1200px"></div>';
        document.body.append(d);
      });
      const cal = await swipe(page, "#probe-box > div");
      expect(cal.first, "the swipe itself").toBeGreaterThan(10);
      await page.evaluate(() => document.getElementById("probe-box")!.remove());
      // The Raid Hall.
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      await expect(page.locator(".rh-grid")).toBeVisible();
      await page.waitForTimeout(600);
      results.hall = await swipe(page, ".rh-grid > *");
      cuts.hall = await clipped(page, ".rh-room");
      // The boss page, each tab.
      await page.evaluate(() =>
        (window as any).__room("raid", { boss: "grumblecrag" }),
      );
      await page.click('[data-raid-card="grumblecrag"]');
      for (const tab of ["party", "attacks", "rewards", "guide"]) {
        await page.click(`[data-ui-raid-tab="${tab}"]`);
        await page.waitForTimeout(500);
        results[`boss-${tab}`] = await swipe(page, ".rh-body > *");
        cuts[`boss-${tab}`] = await clipped(page, ".rh-room");
      }
      // The raid room: the seats and the picker.
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.phase = "lobby";
        w.__snap.players = w.__snap.players.filter((p: any) => !p.raidBoss);
      });
      await page.click('[data-ui-raid-tab="party"]');
      await page.click('[data-ui-raid-play="party"]');
      await page.click('[data-raid-start="party"]');
      await expect
        .poll(async () => {
          await page.evaluate(() => (window as any).__push());
          return page.locator(".room-screen .roster-room").count();
        })
        .toBe(1);
      await page.waitForTimeout(600);
      results["room-seats"] = await swipe(page, ".room-seats-body > *");
      cuts.room = await clipped(page, ".room-screen");
      results["room-picker"] = await swipe(
        page,
        ".roster-room [data-roster-card]",
      );
      // The briefing and the results, as a touch battle shows them.
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.phase = "briefing";
        w.__push();
      });
      await expect(page.locator(".rc-card.is-briefing")).toBeVisible();
      await page.waitForTimeout(800);
      results.briefing = await swipe(page, ".rc-card.is-briefing .rc-body > *");
      cuts.briefing = await clipped(page, ".rc-card");
      // Opened, its extra section makes the briefing longer still.
      await page.locator("#raid-briefing-extra > summary").click();
      await expect(page.locator("#raid-briefing-extra")).toHaveAttribute(
        "open",
        "",
      );
      await page.waitForTimeout(500);
      results["briefing-open"] = await swipe(
        page,
        ".rc-card.is-briefing .rc-body > *",
      );
      cuts["briefing-open"] = await clipped(page, ".rc-card");
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.phase = "finished";
        w.__push();
      });
      await expect(page.locator(".rc-card.is-results .rc-body")).toBeVisible();
      await page.waitForTimeout(800);
      results.results = await swipe(page, ".rc-card.is-results .rc-body > *");
      cuts.results = await clipped(page, ".rc-card");
      // A touch battle locks zoom (touch-action: none, zoom-guard.ts); the
      // briefing and results cards keep panning, every part of them.
      for (const card of ["is-briefing", "is-results"]) {
        if (card === "is-briefing")
          await page.evaluate(() => {
            const w = window as any;
            w.__snap.phase = "briefing";
            w.__push();
          });
        await expect(page.locator(`.rc-card.${card}`)).toBeVisible();
        expect(
          await page.evaluate(() =>
            document.documentElement.classList.contains("zoom-locked"),
          ),
        ).toBe(true);
        const blocked = await page
          .locator(`.rc-card.${card}`)
          .evaluate((c) =>
            [c, ...c.querySelectorAll("*")]
              .filter((e) => getComputedStyle(e).touchAction === "none")
              .map(
                (e) =>
                  `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`,
              ),
          );
        expect(blocked, `${card}: parts a finger can't pan`).toEqual([]);
        if (card === "is-briefing")
          await page.evaluate(() => {
            const w = window as any;
            w.__snap.phase = "finished";
            w.__push();
          });
      }
      // Back from the raid: the room and the Raid Hall scroll again.
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.phase = "lobby";
        w.__push();
      });
      await expect(page.locator(".room-screen .roster-room")).toHaveCount(1);
      await page.waitForTimeout(600);
      expect(
        await page.evaluate(() =>
          document.documentElement.classList.contains("zoom-locked"),
        ),
      ).toBe(false);
      results["room-after"] = await swipe(
        page,
        ".roster-room [data-roster-card]",
      );
      // Leaving a raid room goes back to its boss page; its Raid Hall
      // button goes on to the hall.
      await page.click("#leave");
      await expect(
        page.locator(".rh-room[data-raid-mode='boss']"),
      ).toBeVisible();
      await page.click("[data-raid-back]");
      await expect(page.locator(".rh-grid")).toBeVisible();
      await page.waitForTimeout(600);
      results["hall-after"] = await swipe(page, ".rh-grid > *");
      console.log(`TOUCH ${size.name}`, JSON.stringify(results));
      console.log(`CUTS ${size.name}`, JSON.stringify(cuts));
      for (const [name, c] of Object.entries(cuts))
        expect(c, `${name}: cut off, out of reach`).toEqual([]);
      // Every window that overflows reaches its end, and no spot a finger
      // lands on refuses to scroll.
      for (const [name, r] of Object.entries(results))
        if (r.overflow > 4) {
          expect(r.end, `${name} reaches its end`).toBeGreaterThanOrEqual(
            r.overflow - 2,
          );
          expect(r.stuck, `${name}: spots that don't scroll`).toEqual([]);
        }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
