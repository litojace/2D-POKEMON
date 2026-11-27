import { expect, test, type Page } from "@playwright/test";
import { box, inside, openLobby, pushUntilBattle, snap } from "./helpers";
import { ISLAND, closeSpot, layoutProblems, setInsets } from "./ui-measure";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

// UI remodel step 3 (docs/ui-remodel/PLAN.md): the roster and the fighter
// detail inside the Lobby, measured at the four review sizes with the shared
// layout rules (tests/visual/ui-measure.ts).
const SIZES = [
  { name: "1440x900", width: 1440, height: 900, phone: false },
  { name: "1280x720", width: 1280, height: 720, phone: false },
  { name: "844x390", width: 844, height: 390, phone: true },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    phone: true,
    island: true,
  },
];
async function measured(
  page: Page,
  size: (typeof SIZES)[number],
  label: string,
) {
  const inset = size.island ? ISLAND : undefined;
  expect(
    await layoutProblems(page, { inset, phone: size.phone }),
    label,
  ).toEqual([]);
}

for (const size of SIZES)
  test(`the roster and fighter detail at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(150_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      if (size.island) await setInsets(page, ISLAND);
      await page.click('.lobby-rail [data-lobby-action="fighters"]');
      const room = page.locator(".roster-room");
      await expect(room).toHaveAttribute("data-roster-mode", "grid");
      await expect(
        page.locator('.lobby-rail [data-lobby-action="fighters"]'),
      ).toHaveAttribute("aria-current", "page");
      // The whole roster (the head says how many), every card one size;
      // the grid scrolls to the last one.
      const total = Number(
        (await page.locator(".roster-head .ui-kicker").textContent())?.match(
          /(\d+) fighters/,
        )?.[1] ?? NaN,
      );
      const cards = page.locator(".roster-card");
      await expect(cards).toHaveCount(total);
      expect(total).toBeGreaterThanOrEqual(16);
      // Six to a row at every review size: eighteen fighters are three
      // even rows.
      const cols = await page
        .locator(".roster-grid")
        .evaluate(
          (g) => getComputedStyle(g).gridTemplateColumns.split(" ").length,
        );
      expect(cols).toBe(6);
      expect(total % cols).toBe(0);
      // Measured once the panel has finished opening: mid scale-in, cards
      // round to two sizes for a frame (116 and 117 px at 0.9987).
      await room.evaluate((el) =>
        Promise.all(el.getAnimations().map((a) => a.finished)),
      );
      const boxes = await cards.evaluateAll((els) =>
        els.map((e) => e.getBoundingClientRect().toJSON()),
      );
      expect(
        new Set(
          boxes.map((b) => `${Math.round(b.width)}x${Math.round(b.height)}`),
        ).size,
      ).toBe(1);
      await cards.last().scrollIntoViewIfNeeded();
      expect(
        inside(
          await box(page, ".roster-card:last-child"),
          await box(page, ".roster-body"),
        ),
      ).toBe(true);
      await page
        .locator(".roster-body")
        .evaluate((e) => e.scrollTo({ top: 0 }));
      // You play Voltkit: its card is picked and marked, Select says Playing.
      await expect(
        page.locator('[data-roster-card="voltkit"]'),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator('[data-roster-card="voltkit"]')).toContainText(
        size.phone ? "Voltkit" : "Playing",
      );
      await expect(page.locator("[data-roster-select]")).toBeDisabled();
      expect(await closeSpot(page)).toEqual([
        size.phone
          ? { right: 7, top: 7, size: 32 }
          : { right: 11, top: 11, size: 44 },
      ]);
      await measured(page, size, "grid");
      await snap(page, info, `roster-${size.name}`);

      // An element filter narrows the grid.
      await page.click('[data-roster-element="Fire"]');
      expect(await cards.count()).toBeLessThan(total);
      await measured(page, size, "filtered");
      // The filter hid Voltkit: the first Fire fighter is picked instead.
      await expect(
        page.locator('.roster-card[aria-pressed="true"]'),
      ).toHaveCount(1);
      await expect(page.locator('[data-roster-card="voltkit"]')).toHaveCount(0);
      await page.click('[data-roster-element="All"]');
      await expect(cards).toHaveCount(total);

      // Pick Cindrake, then Details: the fighter on the stage, the detail
      // beside it. (The Fire filter picked a Fire fighter, maybe Cindrake;
      // a second click on the picked card would open it, so pick another
      // first.)
      await page.click('[data-roster-card="tidefin"]');
      await page.click('[data-roster-card="cindrake"]');
      await expect(page.locator("[data-roster-select]")).toBeEnabled();
      await page.click("[data-roster-details]");
      await expect(room).toHaveAttribute("data-roster-mode", "detail");
      const rig = page.locator(".roster-stage .fighter-rig-stage");
      await expect(rig).toHaveAttribute("data-preview-champion", "cindrake");
      await expect(rig).toHaveClass(/is-ready/, { timeout: 60_000 });
      await expect(page.locator(".roster-skill")).toHaveCount(5);
      const stage = await box(page, ".roster-stage");
      const main = await box(page, ".ui-split-main");
      expect(stage.x + stage.width).toBeLessThanOrEqual(main.x);
      expect(await closeSpot(page)).toEqual([
        size.phone
          ? { right: 7, top: 7, size: 32 }
          : { right: 11, top: 11, size: 44 },
      ]);
      await measured(page, size, "skills");
      await snap(page, info, `fighter-skills-${size.name}`);
      for (const tab of ["overview", "skins"]) {
        await page.click(`[data-ui-rtab="${tab}"]`);
        await expect(
          page.locator(`[data-roster-region=body][data-tab="${tab}"]`),
        ).toBeVisible();
        await measured(page, size, tab);
        await snap(page, info, `fighter-${tab}-${size.name}`);
      }
      // › steps to the next fighter: the live fighter follows (the stage is
      // swapped and the preview re-attached, its canvas drawn again).
      await page.click(".roster-next");
      const nextRig = page.locator(".roster-stage .fighter-rig-stage");
      await expect(nextRig).not.toHaveAttribute(
        "data-preview-champion",
        "cindrake",
      );
      await expect(nextRig).toHaveClass(/is-ready/, { timeout: 60_000 });
      await expect(nextRig.locator(":scope > canvas")).toHaveCount(1);
      // ‹ Roster goes back up; Escape leaves to the Lobby.
      await page.click("[data-roster-back]");
      await expect(room).toHaveAttribute("data-roster-mode", "grid");
      await page.keyboard.press("Escape");
      await expect(room).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("Select makes the fighter your Lobby fighter", async ({ page }) => {
  const errors = await openLobby(page);
  await page.click('.lobby-rail [data-lobby-action="fighters"]');
  await page.click('[data-roster-card="tidefin"]');
  await page.click("[data-roster-select]");
  await expect(page.locator(".roster-room")).toHaveCount(0);
  await expect(page.locator("#lobby-fighter-name")).toHaveText(/Tidefin/i);
  // Reopened, Tidefin is the one playing.
  await page.click('.lobby-rail [data-lobby-action="fighters"]');
  await expect(page.locator('[data-roster-card="tidefin"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator('[data-roster-card="tidefin"]')).toContainText(
    "Playing",
  );
  expect(errors).toEqual([]);
});

test("Try skins opens the Shop on that fighter's skins", async ({ page }) => {
  const errors = await openLobby(page);
  await page.click('.lobby-rail [data-lobby-action="fighters"]');
  await page.click('[data-roster-card="mystowl"]');
  await page.click("[data-roster-details]");
  await page.click("[data-roster-skins]");
  await expect(page.locator(".roster-room")).toHaveCount(0);
  await expect(page.locator(".fit-room")).toHaveAttribute(
    "data-fit-mode",
    "shop",
  );
  await expect(page.locator('[data-ui-section="skins"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator('[data-fit-fighter="mystowl"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.locator('.lobby-rail [data-lobby-action="shop"]'),
  ).toHaveAttribute("aria-current", "page");
  expect(errors).toEqual([]);
});

test("keyboard: arrows move through the grid, Enter opens the detail, [ ] step fighters", async ({
  page,
}) => {
  const errors = await openLobby(page);
  const rail = page.locator('.lobby-rail [data-lobby-action="fighters"]');
  await rail.focus();
  await page.keyboard.press("Enter");
  const first = page.locator(".roster-card").first();
  await expect(first).toBeFocused();
  await page.keyboard.press("ArrowRight");
  const second = page.locator(".roster-card").nth(1);
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  // One row down: as many cards on as the grid has columns.
  const cols = await page
    .locator(".roster-grid")
    .evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(" ").length);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".roster-card").nth(1 + cols)).toBeFocused();
  const picked = await page
    .locator(".roster-card")
    .nth(1 + cols)
    .getAttribute("data-roster-card");
  await page.keyboard.press("Enter");
  await expect(page.locator(".roster-room")).toHaveAttribute(
    "data-roster-mode",
    "detail",
  );
  const rig = page.locator(".roster-stage .fighter-rig-stage");
  await expect(rig).toHaveAttribute("data-preview-champion", picked!);
  await page.keyboard.press("]");
  await expect(rig).not.toHaveAttribute("data-preview-champion", picked!);
  await page.keyboard.press("[");
  await expect(rig).toHaveAttribute("data-preview-champion", picked!);
  // Skills move with the arrows too, and the big card follows.
  await page.locator('[data-roster-skill="0"]').focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[data-roster-skill="1"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".roster-room")).toHaveCount(0);
  await expect(rail).toBeFocused();
  expect(errors).toEqual([]);
});

test("Low graphics: a still fighter on the stage, no live rig", async ({
  page,
}, info) => {
  await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
  const errors = await openLobby(page);
  await page.click('.lobby-rail [data-lobby-action="fighters"]');
  await page.click("[data-roster-details]");
  const rig = page.locator(".roster-stage .fighter-rig-stage");
  await expect(rig).toHaveClass(/is-still/);
  await page.waitForTimeout(1500);
  await expect(rig.locator("canvas")).toHaveCount(0);
  await expect(rig.locator("> svg").first()).toBeVisible();
  await snap(page, info, "roster-low-graphics");
  expect(errors).toEqual([]);
});

test("reduced motion: the roster doesn't animate its cards", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await openLobby(page);
  await page.click('.lobby-rail [data-lobby-action="fighters"]');
  await expect(page.locator(".roster-room")).toBeVisible();
  const moving = await page.evaluate(
    () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(".roster-room, .roster-room *"),
      )
        .map((e) => getComputedStyle(e))
        .filter((s) =>
          s.transitionDuration.split(",").some((d) => parseFloat(d) > 0),
        ).length,
  );
  expect(moving).toBe(0);
  expect(errors).toEqual([]);
});

test("a second click on the picked card opens its detail, however slow", async ({
  page,
}) => {
  const errors = await openLobby(page);
  await page.click('.lobby-rail [data-lobby-action="fighters"]');
  await page.click('[data-roster-card="lumoth"]');
  await page.waitForTimeout(900); // longer than a double-click
  await page.click('[data-roster-card="lumoth"]');
  await expect(page.locator(".roster-room")).toHaveAttribute(
    "data-roster-mode",
    "detail",
  );
  await expect(
    page.locator(".roster-stage .fighter-rig-stage"),
  ).toHaveAttribute("data-preview-champion", "lumoth");
  expect(errors).toEqual([]);
});

test("Show all keeps keyboard focus in the roster", async ({ page }) => {
  const errors = await openLobby(page);
  await page.click('.lobby-rail [data-lobby-action="fighters"]');
  // An element and range with no fighter, if the roster has one.
  const elements = await page
    .locator("[data-roster-element]")
    .evaluateAll((bs) =>
      bs
        .map((b) => (b as HTMLElement).dataset.rosterElement!)
        .filter((e) => e !== "All"),
    );
  let found = false;
  for (const el of elements) {
    for (const range of ["long", "close"]) {
      await page.click(`[data-roster-element="${el}"]`);
      await page.click(`[data-roster-range="${range}"]`);
      if (await page.locator("[data-roster-reset]").count()) {
        found = true;
        break;
      }
    }
    if (found) break;
  }
  test.skip(!found, "every element has fighters of both ranges");
  await expect(page.locator("[data-roster-select]")).toBeDisabled();
  await page.locator("[data-roster-reset]").focus();
  await page.keyboard.press("Enter");
  expect(
    await page.evaluate(
      () => !!document.activeElement?.closest(".roster-room"),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("Test skills starts Solo test with that fighter, with EX skills and a damage meter", async ({
  page,
}) => {
  const errors = await openLobby(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__room("practice");
    w.__sent = [];
    const before = w.__emit;
    w.__emit = (ev: string, data: unknown) => {
      w.__sent.push([ev, data]);
      before?.(ev, data);
    };
  });
  await page.click('.lobby-rail [data-lobby-action="fighters"]');
  await page.click('[data-roster-card="mystowl"]');
  await page.click("[data-roster-details]");
  await page.click("[data-roster-try]");
  await expect(page.locator(".roster-room")).toHaveCount(0);
  // Solo test is asked for with the fighter shown, which is now yours.
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__sent.find(([ev]: [string]) => ev === "practice"),
      ),
    )
    .toEqual(["practice", expect.objectContaining({ character: "mystowl" })]);
  await pushUntilBattle(page);
  await page.click("#practice-settings > summary");
  await expect(page.locator("#practice-ex")).not.toBeChecked();
  await expect(page.locator("#practice-last")).toHaveText("0");
  await expect(page.locator("#practice-dps")).toHaveText("0");
  // EX skills: skills 1-3 go out as their EX version.
  await page.check("#practice-ex");
  await page.click("#practice-close");
  await page.evaluate(() => ((window as any).__sent = []));
  await page.keyboard.press("1");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__sent.some(
          ([ev, d]: [string, any]) => ev === "input" && d?.skill === 0 && d.ex,
        ),
      ),
    )
    .toBe(true);
  // The meter reads the damage the server reports.
  await page.evaluate(() => {
    const w = window as any;
    const me = w.__snap.players.find((p: any) => p.id === "me");
    me.stats.dealt += 24;
    w.__snap.time += 0.1;
    w.__push();
  });
  await expect(page.locator("#practice-last")).toHaveText("24");
  await expect(page.locator("#practice-dealt")).toHaveText("24");
  expect(errors).toEqual([]);
});

// A small phone held sideways (iPhone SE, 667 x 375) is narrower than the
// review sizes above: a fighter's page has 351 px for its action bar, and
// three equal buttons ran Select off the panel's edge (25 Nov 2026).
test("a fighter's actions all fit the page on a 667 px phone", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 667, height: 375 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await openLobby(page);
    await page.click('.lobby-rail [data-lobby-action="fighters"]');
    await page.click("[data-roster-details]");
    const room = page.locator('.roster-room[data-roster-mode="detail"]');
    await expect(room).toBeVisible();
    await room.evaluate((el) =>
      Promise.all(el.getAnimations().map((a) => a.finished)),
    );
    for (const tab of ["overview", "skills", "skins"]) {
      await page.click(`[data-ui-rtab=${tab}]`);
      const foot = (await box(page, ".roster-room .ui-panel-foot"))!;
      const buttons = page.locator(".roster-room .ui-panel-foot .ui-btn");
      await expect(buttons).toHaveCount(3);
      let previousRight = foot.x;
      for (let i = 0; i < 3; i++) {
        const b = (await buttons.nth(i).boundingBox())!;
        const name = `${tab}: button ${i + 1}`;
        // Inside the bar, after the one before it.
        expect(b.x, name).toBeGreaterThanOrEqual(previousRight);
        expect(b.x + b.width, name).toBeLessThanOrEqual(
          foot.x + foot.width - 4,
        );
        // Its words whole: nothing cut off inside the button.
        expect(
          await buttons
            .nth(i)
            .evaluate((el) => el.scrollWidth - el.clientWidth),
          name,
        ).toBeLessThanOrEqual(1);
        previousRight = b.x + b.width;
      }
    }
    await snap(page, info, "roster-detail-667x375");
  } finally {
    await context.close();
  }
});

// A skin's name on a fighter's Skins tab reads in full on a small phone: on
// two lines where one is too short, a word too long even for that a size
// smaller. On a 667 px phone one line held 61 px and 127 of the 432 names
// ended in "…" ("Amber Path…"; 25 Nov 2026). Every fighter, every look.
for (const size of [
  { name: "667x375", width: 667, height: 375, island: false },
  { name: "852x393-island", width: 852, height: 393, island: true },
])
  test(`every skin's name reads in full on the Skins tab at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      if (size.island) await setInsets(page, ISLAND);
      await page.click('.lobby-rail [data-lobby-action="fighters"]');
      await page.click("[data-roster-details]");
      await expect(
        page.locator('.roster-room[data-roster-mode="detail"]'),
      ).toBeVisible();
      await page.click("[data-ui-rtab=skins]");
      const seen = new Set<string>();
      let looks = 0;
      for (let i = 0; i < 40 && seen.size < 18; i++) {
        const fighter = (await page
          .locator(".roster-stage-name")
          .textContent())!;
        if (seen.has(fighter)) break;
        seen.add(fighter);
        const cards = await page.locator(".roster-look").evaluateAll((els) =>
          els.map((el) => {
            const name = el.querySelector("b")!;
            return {
              name: name.textContent,
              cutSideways: name.scrollWidth - name.clientWidth,
              cutBelow: name.scrollHeight - name.clientHeight,
              top: Math.round(el.getBoundingClientRect().top),
              label: Math.round(
                el.querySelector("small")!.getBoundingClientRect().top,
              ),
            };
          }),
        );
        looks += cards.length;
        for (const c of cards) {
          expect(c.cutSideways, `${fighter}: ${c.name}`).toBeLessThanOrEqual(1);
          expect(c.cutBelow, `${fighter}: ${c.name}`).toBeLessThanOrEqual(1);
        }
        // Owned / In the Shop sits at one height across a row of cards.
        const rows = new Map<number, Set<number>>();
        for (const c of cards)
          rows.set(c.top, (rows.get(c.top) ?? new Set()).add(c.label));
        for (const [top, labels] of rows)
          expect(labels.size, `${fighter}: row at ${top}`).toBe(1);
        if (fighter.trim() === "Mossloth") {
          await page
            .locator(".roster-look.has-long-word")
            .first()
            .scrollIntoViewIfNeeded();
          await snap(page, info, `roster-skins-long-word-${size.name}`);
        }
        await page.click(".roster-next");
        await expect(page.locator(".roster-stage-name")).not.toHaveText(
          fighter,
        );
      }
      expect(seen.size).toBe(18);
      expect(looks).toBeGreaterThan(400);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
