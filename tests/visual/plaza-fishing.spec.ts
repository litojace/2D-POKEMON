import { expect, test, type Page } from "@playwright/test";
import { openPlaza, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";
import {
  PLAZA_DOCK,
  PLAZA_FISH,
  PLAZA_FISHING,
  PLAZA_POND,
  PLAZA_SPOTS,
} from "../../packages/shared/src/plaza";

// Fishing mode at the pond: the round Fish button at the dock opens it (the
// camera comes in close, fishing's own buttons replace the walking ones),
// Cast, the bite, Reel!, the fish leaps in, Leave. The harness runs the
// real PlazaWorld (harness/plaza-sim.ts), which decides the fish; the
// bite waits for __plazaBiteNow (__plazaBiteAfter holds it off).
const SPOT = PLAZA_SPOTS.find((s) => s.id === "fish")!;
const mode = (page: Page) =>
  page.evaluate(() => (window as any).__plaza.fishingMode);
const phase = async (page: Page) => (await mode(page)).phase;
const toast = (page: Page) => page.locator("#toast");
const act = (page: Page) => page.locator("#pz-fish-act");
async function toPond(page: Page, errors: string[] = []) {
  // The fish bite only when a test says (__plazaBiteNow): the server's
  // random 2-6 s would race a slow machine's looks at the phase.
  await page.evaluate(() => {
    const w = window as any;
    w.__plazaBiteAfter = 600_000;
    // ... and, once bitten, waits for the tap (see "left alone" below).
    w.__plazaBiteHold = true;
  });
  // The Plaza drawing steadily first. On CI's software renderer, a cold
  // Plaza gets a frame only every few seconds at first (main's run on
  // c056869, #389: 4 frames in the whole 10 s wait), and the prompt shows
  // only on a frame after the move. Locally this takes well under a second.
  const frames = () =>
    page.evaluate(() => (window as any).__plaza.health().frames.stepped[0]);
  const from = await frames();
  await expect
    .poll(frames, {
      timeout: 45_000,
      message: "the Plaza never drew 30 more frames before the move",
    })
    .toBeGreaterThanOrEqual(from + 30);
  await page.evaluate(
    ([x, y]) => (window as any).__plazaPosition(x, y),
    [SPOT.x, SPOT.y],
  );
  try {
    await expect(page.locator("#pz-interact")).toBeVisible({ timeout: 10_000 });
  } catch (e) {
    // It failed on CI runners only (#367, #379): say what the Plaza was
    // doing, so the next failure explains itself.
    const health = await page.evaluate(async () => {
      const w = window as any,
        b = w.__plazaWorld.bodyOf("local");
      // Does the page still get animation frames at all?
      const raf = await new Promise<string>((done) => {
        const t0 = performance.now();
        requestAnimationFrame(() =>
          done(`${Math.round(performance.now() - t0)}ms`),
        );
        setTimeout(() => done("none in 2s"), 2000);
      });
      return {
        ...w.__plaza.health(),
        server: b && { x: Math.round(b.x), y: Math.round(b.y) },
        focus: document.activeElement?.className ?? null,
        raf,
      };
    });
    throw new Error(
      `the Fish prompt never showed at the spot (${SPOT.x}, ${SPOT.y}): ${JSON.stringify(health)}\npage errors: ${JSON.stringify(errors.slice(0, 5))}\n${(e as Error).message}`,
    );
  }
  await expect(page.locator("#pz-interact")).toContainText("Fish");
}
async function enter(page: Page) {
  await page.click("#pz-interact");
  await expect(page.locator("#pz-fishhud")).toBeVisible();
  await expect(act(page)).toHaveAttribute("data-kind", "cast");
}
async function cast(page: Page) {
  await act(page).click();
  await expect.poll(() => phase(page)).toBe("wait");
  await expect(act(page)).toHaveAttribute("data-kind", "reel");
}
/**
 * Land a hooked fish: hold the button while the needle is under the green
 * band's middle, let go above it, until the fight ends. Then "leap" (caught)
 * or "miss" (snapped, or it got away).
 */
async function fightIt(page: Page, key = false) {
  const b = await box(page, "#pz-fish-act");
  if (!key) await page.mouse.move((b.l + b.r) / 2, (b.t + b.b) / 2);
  let down = false;
  for (let i = 0; i < 800; i++) {
    const m = await mode(page);
    if (m.phase !== "fight") break;
    const f = m.fight;
    if (f?.result === "going") {
      const want = f.tension < (f.lo + f.hi) / 2;
      if (want !== down) {
        down = want;
        if (key) await (want ? page.keyboard.down(" ") : page.keyboard.up(" "));
        else await (want ? page.mouse.down() : page.mouse.up());
      }
    }
    await page.waitForTimeout(25);
  }
  if (down) await (key ? page.keyboard.up(" ") : page.mouse.up());
  return (await mode(page)).phase;
}
const box = (page: Page, s: string) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width };
  }, s);

for (const size of [
  { width: 667, height: 375, inset: null },
  { width: 852, height: 393, inset: ISLAND },
]) {
  const name = `${size.width}x${size.height}${size.inset ? "-island" : ""}`;
  test(`fishing mode on a phone (${name}): in close, cast, bite, catch, the Fish book, leave`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = await openPlaza(page);
      if (size.inset) await setInsets(page, size.inset);
      await toPond(page, errors);
      // At the dock: a round Fish button, not the long pill.
      // Dash's size, on Dash's line, the same gap as Dash to Jump; it pops in.
      expect(
        await page
          .locator("#pz-interact")
          .evaluate((el) => getComputedStyle(el).animationName),
      ).toBe("pz-fish-pop");
      await page
        .locator("#pz-interact")
        .evaluate((el) =>
          Promise.all(el.getAnimations().map((a) => a.finished)),
        );
      const fishBtn = await box(page, "#pz-interact");
      const dash = await box(page, "#pz-dash");
      const jump = await box(page, "#pz-jump");
      expect(Math.abs(fishBtn.w - dash.w)).toBeLessThanOrEqual(1);
      expect(Math.abs(fishBtn.b - dash.b)).toBeLessThanOrEqual(1);
      expect(
        Math.abs(dash.l - fishBtn.r - (jump.l - dash.r)),
      ).toBeLessThanOrEqual(1);
      await snap(page, info, `fishing-dock-${name}`);
      // The usual camera's width (in Plaza units), to come back to.
      await page.waitForTimeout(600);
      const usual = await page.evaluate(() => {
        const v = (window as any).__plaza.fishingMode.view;
        return v.x1 - v.x0;
      });
      await enter(page);
      // The walking controls step aside; the camera comes in close.
      for (const s of [".pz-joy", ".pz-actions", ".pz-left", "#pz-quests"])
        await expect(page.locator(s)).toBeHidden();
      // The camera frames the angler and the whole pond.
      await expect
        .poll(async () => {
          const v = (await mode(page)).view;
          return (
            v.x0 <= SPOT.x - 30 &&
            v.x1 >= PLAZA_POND.x + PLAZA_POND.rx &&
            v.y0 <= PLAZA_POND.y - PLAZA_POND.ry &&
            v.y1 >= PLAZA_POND.y + PLAZA_POND.ry
          );
        })
        .toBe(true);
      // Centred on the screen: the angler's left edge to the pond's far rim
      // sits in the middle, a touch to the right, never to the left (once
      // the camera has eased there).
      await expect
        .poll(async () => {
          const v = (await mode(page)).view,
            toX = (x: number) => ((x - v.x0) / (v.x1 - v.x0)) * size.width,
            mid =
              (toX(SPOT.x - 40) + toX(PLAZA_POND.x + PLAZA_POND.rx + 15)) / 2;
          return mid >= size.width / 2 && mid <= size.width / 2 + 30;
        })
        .toBe(true);
      // The screen changes size mid-fishing (a phone turning, a toolbar
      // going): the frame still holds the whole pond.
      await page.setViewportSize({
        width: size.width - 80,
        height: size.height,
      });
      await expect
        .poll(async () => {
          const v = (await mode(page)).view;
          return (
            v.x0 <= SPOT.x - 30 &&
            v.x1 >= PLAZA_POND.x + PLAZA_POND.rx &&
            v.y0 <= PLAZA_POND.y - PLAZA_POND.ry &&
            v.y1 >= PLAZA_POND.y + PLAZA_POND.ry
          );
        })
        .toBe(true);
      await page.setViewportSize({ width: size.width, height: size.height });
      // Today's count is a round tile beside Book, the same size.
      const today = await box(page, "#pz-fish-today"),
        bookBtn = await box(page, "#pz-fish-book2");
      expect(Math.abs(today.w - bookBtn.w)).toBeLessThanOrEqual(1);
      expect(Math.abs(today.t - bookBtn.t)).toBeLessThanOrEqual(1);
      expect(today.r).toBeLessThan(bookBtn.l);
      // Their words sit on one line ("today" level with "Book"), and the
      // widest count, 30/30, stays inside the circle with room to spare.
      const fit = await page.evaluate(() => {
        const t = document.querySelector("#pz-fish-today")!;
        const was = t.innerHTML;
        t.innerHTML = `<b>30<i>/30</i></b><small>today</small>`;
        const tr = t.getBoundingClientRect(),
          b = t.querySelector("b")!,
          range = document.createRange();
        range.selectNodeContents(b);
        const g = range.getBoundingClientRect(),
          r = tr.width / 2 - 1,
          // The circle's width at the count's middle line.
          dy = g.top + g.height / 2 - (tr.top + tr.height / 2),
          chord = 2 * Math.sqrt(r * r - dy * dy),
          labels = [
            t.querySelector("small")!.getBoundingClientRect().top,
            document
              .querySelector("#pz-fish-book2 small")!
              .getBoundingClientRect().top,
          ];
        t.innerHTML = was;
        return { width: g.width, chord, labels };
      });
      expect(Math.abs(fit.labels[0] - fit.labels[1])).toBeLessThanOrEqual(0.5);
      expect(fit.width + 8).toBeLessThanOrEqual(fit.chord);
      // Leave is red, told apart from fishing's blue buttons.
      expect(
        await page
          .locator("#pz-fish-exit")
          .evaluate((el) => getComputedStyle(el).backgroundImage),
      ).toContain("rgb(240, 82, 90)");
      await snap(page, info, `fishing-mode-${name}`);
      await cast(page);
      await snap(page, info, `fishing-wait-${name}`);
      // While the line is out the ducks keep their bodies (a little above
      // their feet) well off the line and the bobber, so neither is ever
      // drawn across a duck: each duck is turned all the way round its path.
      // Two ducks, and they never swim over each other either.
      expect(
        await page.evaluate(() => (window as any).__plaza.ducks().length),
      ).toBe(2);
      for (let k = 0; k < 24; k++) {
        const [near, apart] = await page.evaluate(async (k) => {
          const p = (window as any).__plaza,
            L = p.lineZone;
          // The lead duck's place on its path (the other keeps half a turn
          // behind it).
          p.ducks()[0].a = (k / 24) * Math.PI * 2;
          await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          );
          const [a, b] = p.ducks();
          return [
            Math.min(
              ...p.ducks().map((d: { x: number; y: number }) => {
                const bx = d.x,
                  by = d.y - 14,
                  vx = L.bx - L.ax,
                  vy = L.by - L.ay,
                  t = Math.max(
                    0,
                    Math.min(
                      1,
                      ((bx - L.ax) * vx + (by - L.ay) * vy) /
                        (vx * vx + vy * vy),
                    ),
                  );
                return Math.hypot(bx - (L.ax + vx * t), by - (L.ay + vy * t));
              }),
            ),
            Math.hypot(a.x - b.x, (a.y - b.y) * 1.6),
          ];
        }, k);
        expect(near, `duck path at ${k}/24`).toBeGreaterThan(60);
        expect(apart, `ducks apart at ${k}/24`).toBeGreaterThan(70);
      }
      // The server says it bit: tap at once (the window is about a second),
      // and the fight's close-up comes in. Land it (a fish that gets away
      // is a fair result, and so is a tap a slow machine sends after the
      // window: cast again, at most four times).
      let landed = false,
        shot = false;
      for (let tries = 0; tries < 4 && !landed; tries++) {
        if (tries) {
          await expect.poll(() => phase(page)).toBe("idle");
          await page.waitForTimeout(PLAZA_FISHING.castGapMs);
          await cast(page);
        }
        await page.evaluate(() => (window as any).__plazaBiteNow());
        await expect.poll(() => phase(page), { intervals: [50] }).toBe("bite");
        // Forced: the gold button pulses, and Playwright waits for a still one.
        await act(page).click({ force: true });
        await expect
          .poll(() => phase(page), { intervals: [50] })
          .toMatch(/fight|miss|idle/);
        if ((await phase(page)) !== "fight") continue;
        await expect(act(page)).toHaveAttribute("data-kind", "fight");
        await expect(page.locator(".pz-fish-side")).toBeHidden();
        // Hold is held for seconds: a bigger target than Cast (84 px).
        expect((await box(page, "#pz-fish-act")).w).toBeGreaterThanOrEqual(100);
        if (!shot) {
          shot = true;
          await page.waitForTimeout(700);
          await snap(page, info, `fishing-fight-${name}`);
        }
        // Landed or not: the day's count says (a slow machine may only look
        // again once the leap is over).
        const end = await fightIt(page);
        landed =
          end === "leap" ||
          (await page
            .waitForFunction(
              () => (window as any).__plaza.progress?.fishToday >= 1,
              undefined,
              { timeout: 1500 },
            )
            .then(() => true)
            .catch(() => false));
      }
      expect(landed).toBe(true);
      await snap(page, info, `fishing-leap-${name}`);
      // The catch card: the fish in full, its name, rarity and coins.
      const card = page.locator("#pz-catch");
      await expect(card).toBeVisible();
      await expect(card).toContainText("First catch!");
      await expect(card).toContainText(/\+\d+ coins/);
      await expect(page.locator("#pz-feed")).toContainText("First catch:");
      await snap(page, info, `fishing-catch-${name}`);
      await expect.poll(() => phase(page)).toBe("idle");
      await expect
        .poll(() =>
          page.evaluate(() => (window as any).__plaza.progress?.fishToday),
        )
        .toBe(1);
      await expect(page.locator("#pz-fish-today")).toContainText("1/30");
      await expect(page.locator(".pz-fish-side")).toBeVisible();
      // Fishing's buttons stay on screen and inside the safe area.
      for (const s of ["#pz-fish-act", "#pz-fish-exit", "#pz-fish-book2"]) {
        const b = await box(page, s);
        expect(b.l, s).toBeGreaterThanOrEqual(size.inset?.left ?? 0);
        expect(b.r, s).toBeLessThanOrEqual(
          size.width - (size.inset?.right ?? 0),
        );
        expect(b.b, s).toBeLessThanOrEqual(size.height);
      }

      // Another bite, left alone: the button turns gold and pulses, then
      // the server lets the fish go.
      await page.waitForTimeout(PLAZA_FISHING.castGapMs);
      await cast(page);
      await page.evaluate(() => {
        const w = window as any;
        w.__plazaBiteHold = false;
        w.__plazaBiteNow();
      });
      await expect.poll(() => phase(page), { intervals: [50] }).toBe("bite");
      // Read at once: the bite lasts about a second.
      const biting = await page.evaluate(() => [
        document.querySelector("#pz-fish-act")!.getAttribute("data-kind"),
        document.querySelector("#pz-fish-hint")!.textContent,
      ]);
      expect(biting[0]).toBe("bite");
      expect(biting[1]).toContain("biting");
      await snap(page, info, `fishing-bite-${name}`);
      await expect(page.locator("#pz-fish-hint")).toContainText("got away");
      await page.evaluate(() => ((window as any).__plazaBiteHold = true));

      // The Fish book, from fishing's own button: one caught, inside the
      // safe area, its list scrolling to the last fish.
      await page.click("#pz-fish-book2");
      const book = page.locator("#pz-fishbook");
      await expect(book).toBeVisible();
      await expect(page.locator("#pz-fishbook-count")).toHaveText(
        `1 / ${PLAZA_FISH.length}`,
      );
      await expect(page.locator(".pz-fish:not(.unknown)")).toHaveCount(1);
      await expect(page.locator(".pz-fish.unknown small.first")).toHaveCount(
        PLAZA_FISH.length - 1,
      );
      const panel = await box(page, ".pz-fishbook-panel");
      expect(panel.l).toBeGreaterThanOrEqual(size.inset?.left ?? 0);
      expect(panel.r).toBeLessThanOrEqual(
        size.width - (size.inset?.right ?? 0),
      );
      expect(panel.b).toBeLessThanOrEqual(
        size.height - (size.inset?.bottom ?? 0),
      );
      await snap(page, info, `fishbook-${name}`);
      const list = page.locator("#pz-fishbook-list");
      expect(await list.evaluate((el) => getComputedStyle(el).overflowY)).toBe(
        "auto",
      );
      await page.click('[data-fb="close"]');
      await expect(book).toBeHidden();

      // Leave: the walking controls and the usual camera come back.
      await page.click("#pz-fish-exit");
      await expect(page.locator("#pz-fishhud")).toBeHidden();
      await expect(page.locator(".pz-joy")).toBeVisible();
      await expect.poll(async () => (await mode(page)).fz).toBeLessThan(1.05);
      // ... at the usual zoom (on a phone too, where pinching is off).
      await expect
        .poll(async () => {
          const v = (await mode(page)).view;
          return Math.abs(v.x1 - v.x0 - usual) / usual;
        })
        .toBeLessThan(0.02);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("Fish walks you out onto the dock, facing the water, and the line goes out near the pond's middle", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  await toPond(page, errors);
  // Pressed from the bank, a little way from the dock.
  await enter(page);
  const local = () =>
    page.evaluate(() => {
      const b = (window as any).__plazaWorld.bodyOf("local");
      return { x: b.x, y: b.y };
    });
  const S = PLAZA_DOCK.stand,
    W = PLAZA_DOCK.walk,
    P = PLAZA_POND;
  // The server (the harness's real PlazaWorld) walks you out too: onto the
  // dock's planks, at its outer end, over the water. Not to the pixel: on a
  // runner drawing a few frames a second the browser steps at most 0.05 s
  // a frame while the server plays the stick for the real time, so the
  // server's copy can walk on to the planks' far corner (main, 22 Nov:
  // 18.7 px from the stand, at x1/y1).
  const onDockEnd = (at: { x: number; y: number }) =>
    at.x >= S.x - 12 &&
    at.x <= W.x1 + 0.5 &&
    at.y >= W.y0 - 0.5 &&
    at.y <= W.y1 + 0.5 &&
    ((at.x - P.x) / P.rx) ** 2 + ((at.y - P.y) / P.ry) ** 2 < 1;
  await expect.poll(async () => onDockEnd(await local())).toBe(true);
  // And it stays there (you're not walking on past it).
  await page.waitForTimeout(800);
  expect(onDockEnd(await local())).toBe(true);
  // Still fishing, and the cast works from the dock.
  await expect(page.locator("#pz-fishhud")).toBeVisible();
  await cast(page);
  await snap(page, info, "fishing-on-the-dock");
  expect(errors).toEqual([]);
});

test("on a keyboard: E enters and casts, a tap before the bite loses the fish, Esc leaves, and a line left out comes in", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors = await openPlaza(page);
  await toPond(page, errors);
  await page.keyboard.press("e");
  await expect(page.locator("#pz-fishhud")).toBeVisible();
  await page.keyboard.press("e");
  await expect.poll(() => phase(page)).toBe("wait");
  // A nibble is not a bite: reeling now loses the fish.
  await page.keyboard.press("e");
  await expect(page.locator("#pz-fish-hint")).toContainText("Too soon");
  await expect.poll(() => phase(page)).toBe("idle");
  // Leaving with the line out reels it in on the server too.
  await page.waitForTimeout(PLAZA_FISHING.castGapMs + 100);
  await page.keyboard.press("e");
  await expect.poll(() => phase(page)).toBe("wait");
  await page.keyboard.press("Escape");
  await expect(page.locator("#pz-fishhud")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__plazaWorld.lineOf("local")),
    )
    .toBeNull();
  // Moved off the dock while fishing (the server's word): out of the mode.
  await toPond(page, errors);
  await page.keyboard.press("e");
  await page.waitForTimeout(PLAZA_FISHING.castGapMs);
  await page.keyboard.press("e");
  await expect.poll(() => phase(page)).toBe("wait");
  await page.evaluate(
    ([x, y]) => (window as any).__plazaPosition(x, y),
    [SPOT.x - 400, SPOT.y - 200],
  );
  await expect(toast(page)).toContainText("walked away");
  await expect(page.locator("#pz-fishhud")).toBeHidden();
  // A fight on the keyboard: Space held reels, let go gives line.
  await toPond(page, errors);
  await page.keyboard.press("e");
  await page.waitForTimeout(PLAZA_FISHING.castGapMs);
  await page.keyboard.press("e");
  await expect.poll(() => phase(page)).toBe("wait");
  await page.evaluate(() => (window as any).__plazaBiteNow());
  await expect.poll(() => phase(page), { intervals: [50] }).toBe("bite");
  await page.keyboard.press("e");
  // Hooked (or, on a slow machine, a tap after the window: missed).
  await expect
    .poll(() => phase(page), { intervals: [50] })
    .toMatch(/fight|miss|idle/);
  expect(["leap", "miss", "idle"]).toContain(await fightIt(page, true));
  await page.keyboard.press("Escape");
  await expect(page.locator("#pz-fishhud")).toBeHidden();
  // The whole book filled: the server's progress brings the title.
  await page.evaluate(
    (ids) => {
      const w = window as any;
      const p = structuredClone(w.__plazaProgress);
      p.fishBook = Object.fromEntries(ids.map((id: string) => [id, 1]));
      p.fishTitle = true;
      w.__sock.fire("plaza-progress", p);
    },
    PLAZA_FISH.map((f) => f.id),
  );
  await expect(toast(page)).toContainText("Title earned: Master Angler");
  // The map no longer has a Fish book button (fishing has its own); B
  // still opens it.
  await page.click("#pz-map-btn");
  await expect(page.locator("#pz-map-book")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("#pz-map")).toBeHidden();
  await page.locator(".plaza-layer").focus();
  await page.keyboard.press("b");
  await expect(page.locator("#pz-fishbook-note")).toContainText(
    "Title earned: Master Angler",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#pz-fishbook")).toBeHidden();
  expect(errors).toEqual([]);
});
