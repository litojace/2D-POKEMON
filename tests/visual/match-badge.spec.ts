import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";
import { decodePng } from "./png";

// PvP's score badge (owner, 7 Nov 2026): one pill at the top middle with
// names, rounds and the clock; health over each fighter; no opponent's
// ultimate; on phones the arena takes the height. An off-screen opponent is
// an arrow circling your fighter. Text sits on one line ("thẳng hàng").
const SIZES = [
  { name: "phone", width: 844, height: 390, phone: true },
  { name: "desktop", width: 1440, height: 900, phone: false },
];

async function match(
  page: Page,
  mode: string,
  remaining = 95,
  myName?: string,
) {
  const errors = await openHub(page);
  await page.evaluate(
    ([mode, myName]) => {
      const w = window as any;
      w.__room("pvp", { mode, phase: "playing" });
      // Before the match starts: the HUD is built once, with the names.
      if (myName) w.__snap.players[0].name = myName;
    },
    [mode, myName] as const,
  );
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  await page.evaluate((remaining) => {
    const w = window as any;
    w.__snap.remaining = remaining;
    // Real health (the harness leaves it empty), so the camera follows you
    // as in a real match.
    w.__snap.players.forEach((p: any, i: number) => {
      p.hp = [110, 75, 40, 95][i % 4];
    });
    w.__push();
  }, remaining);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => (window as any).__push());
    await page.waitForTimeout(300);
  }
  return errors;
}

type Pixels = ReturnType<typeof decodePng>;

/** Where two photos differ (photo px), or null where they don't. Read in
 * Node: in the page this waited seconds on a main thread drawing the game. */
function inkSpan(on: Pixels, off: Pixels) {
  let x0 = Infinity,
    x1 = -1,
    y0 = Infinity,
    y1 = -1;
  for (let y = 0; y < on.height; y++)
    for (let x = 0; x < on.width; x++) {
      const k = (y * on.width + x) * 4;
      const d =
        Math.abs(on.data[k] - off.data[k]) +
        Math.abs(on.data[k + 1] - off.data[k + 1]) +
        Math.abs(on.data[k + 2] - off.data[k + 2]);
      if (d > 60) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  return y1 < 0 ? null : { x0, x1, y0, y1 };
}

/** A photo of the whole badge: its CSS box, the clip and the pixels. */
async function badgeShot(page: Page) {
  const box = (await page.locator("#hud").boundingBox())!;
  const clip = {
    x: box.x - 2,
    y: box.y - 2,
    width: box.width + 4,
    height: box.height + 4,
  };
  const pixels = decodePng(
    await page.screenshot({ clip, animations: "disabled" }),
  );
  return { box, clip, pixels };
}

/** The badge photographed again with `hide` hidden, and where that differs
 * from `shown` (photo px). */
async function without(
  page: Page,
  hide: string,
  shown: Awaited<ReturnType<typeof badgeShot>>,
) {
  const tag = await page.addStyleTag({
    content: `${hide} { visibility: hidden !important; }`,
  });
  const off = decodePng(
    await page.screenshot({ clip: shown.clip, animations: "disabled" }),
  );
  await tag.evaluate((e) => e.remove());
  return inkSpan(shown.pixels, off);
}

/** Where an item's ink is (CSS px): the badge photographed with the item
 * shown and hidden; the badge is see-through, so the arena behind it can't
 * be told from text any other way. `whole` is a photo of the whole badge
 * taken once for several items: each photo at 2x costs seconds on a
 * software renderer. */
async function ink(
  page: Page,
  hide: string,
  whole?: Awaited<ReturnType<typeof badgeShot>>,
) {
  const shown = whole ?? (await badgeShot(page));
  const span = await without(page, hide, shown);
  if (!span) return null;
  const { box } = shown;
  const scale = shown.pixels.height / (box.height + 4);
  return {
    mid: box.y - 2 + (span.y0 + span.y1 + 1) / 2 / scale,
    bottom: box.y - 2 + (span.y1 + 1) / scale,
  };
}

for (const size of SIZES)
  for (const mode of ["duel", "ffa", "teams"])
    test(`the score badge at ${size.name}, ${mode}`, async ({
      browser,
    }, info) => {
      // Many pixel measurements (four cards in a free-for-all) at 2x.
      test.setTimeout(240_000);
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.phone,
        hasTouch: size.phone,
        reducedMotion: "reduce",
        // Half-pixel precision for the alignment checks.
        deviceScaleFactor: 2,
      });
      try {
        const page = await context.newPage();
        const errors = await match(page, mode);
        const hud = page.locator("#hud");
        await expect(hud).toHaveClass(/hud-badge/);
        // Names, rounds and the clock; no health numbers or ultimates.
        await expect(page.locator("#round-label")).toHaveText("R1 · BO5");
        await expect(page.locator("#timer")).toHaveText("01:35");
        for (const hidden of [
          ".hud-ultimate",
          ".health-track",
          "small[id^=health-text-]",
        ])
          for (const el of await hud.locator(hidden).all())
            await expect(el).toBeHidden();
        await expect(page.locator("#phase-label")).toBeHidden();
        // Centred at the top, inside the screen.
        const box = (await hud.boundingBox())!;
        expect(Math.abs(box.x + box.width / 2 - size.width / 2)).toBeLessThan(
          1.5,
        );
        expect(box.height).toBeLessThanOrEqual(44);
        if (size.phone) {
          // The arena starts right under the top edge.
          const frame = (await page.locator(".arena-frame").boundingBox())!;
          expect(frame.y).toBeLessThanOrEqual(6);
          expect(frame.height).toBeGreaterThanOrEqual(size.height - 10);
        }
        // One line: every name and score on one baseline, dots on the
        // names' middle, everything on the badge's middle line.
        const middle = box.y + box.height / 2;
        // Number the cards (the clock sits between them among the divs).
        const cards = await hud
          .locator(".health-card")
          .evaluateAll(
            (all) =>
              all.map(
                (c, i) => ((c as HTMLElement).dataset.testCard = String(i)),
              ).length,
          );
        const baselines: number[] = [];
        // One photo of the whole badge serves every item below; the arena
        // is hidden meanwhile, so the background behind the see-through
        // badge is the same in every photo.
        const calm = await page.addStyleTag({
          content: "#game, #arena-overlay { visibility: hidden !important; }",
        });
        const whole = await badgeShot(page);
        for (let i = 0; i < cards; i++) {
          const card = `#hud .health-card[data-test-card="${i}"]`;
          const name = (await ink(page, `${card} b`, whole))!;
          const dot = (await ink(
            page,
            `${card} > div:first-child::before`,
            whole,
          ))!;
          const score = await ink(page, `${card} strong[id^=score-]`, whole);
          baselines.push(name.bottom);
          if (score) baselines.push(score.bottom);
          expect(Math.abs(dot.mid - name.mid), `card ${i} dot`).toBeLessThan(1);
          for (const [label, part] of [
            ["name", name],
            ["dot", dot],
            ["score", score],
          ] as const)
            if (part)
              expect(
                Math.abs(part.mid - middle),
                `card ${i} ${label}`,
              ).toBeLessThanOrEqual(1.5);
        }
        expect(Math.max(...baselines) - Math.min(...baselines)).toBeLessThan(
          0.6,
        );
        const clock = (await ink(page, "#hud .timer-wrap", whole))!;
        await calm.evaluate((e) => e.remove());
        expect(Math.abs(clock.mid - middle)).toBeLessThanOrEqual(1);
        await snap(page, info, `match-badge-${size.name}-${mode}`);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

test("the badge says when the ring closes, and the arrow points at an opponent off screen", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await match(page, "duel", 25);
    const note = page.locator("#phase-label");
    await expect(note).toBeVisible();
    await expect(note).toHaveText("RING CLOSING · STAY INSIDE");
    // Under the badge, on one line.
    const badge = (await page.locator("#hud").boundingBox())!;
    const b = (await note.boundingBox())!;
    expect(b.y).toBeGreaterThanOrEqual(badge.y + badge.height);
    expect(b.height).toBeLessThan(20);
    // Kai is off screen to the right: a red-orange arrow beside you, not a
    // chip at the top.
    const bearing = page.locator(".enemy-bearing");
    await expect(bearing).toHaveClass(/is-orbit/);
    // The holder is a point (the arrow is placed by its middle).
    await expect(bearing.locator("span")).toBeVisible();
    const arrow = (await bearing.locator("span").boundingBox())!;
    const me = (await page
      .locator(".player-nameplate", { hasText: "YOU" })
      .boundingBox())!;
    const dx = arrow.x + arrow.width / 2 - (me.x + me.width / 2);
    expect(dx).toBeGreaterThan(20);
    expect(dx).toBeLessThan(90);
    expect(arrow.y).toBeGreaterThan(badge.y + badge.height);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Practice keeps the full cards", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await openHub(page);
    await page.evaluate(() => (window as any).__room("practice", {}));
    await openPlayPanel(page);
    await page.click("#play-create");
    await pushUntilBattle(page);
    await expect(page.locator("#hud")).not.toHaveClass(/hud-badge/);
    await expect(page.locator("#hud .health-track").first()).toBeVisible();
  } finally {
    await context.close();
  }
});

/** Where an element's ink is across (CSS px), like ink() for height. */
async function inkAcross(page: Page, hide: string) {
  const shown = await badgeShot(page);
  const span = (await without(page, hide, shown))!;
  const { box } = shown;
  const scale = shown.pixels.width / (box.width + 4);
  return box.x - 2 + (span.x0 + span.x1 + 1) / 2 / scale;
}

for (const size of [
  { name: "844x390", width: 844, height: 390, island: false },
  { name: "852x393-island", width: 852, height: 393, island: true },
])
  test(`the clock is in the middle whatever the names, inside the safe area (${size.name})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
      deviceScaleFactor: 2,
    });
    try {
      const page = await context.newPage();
      // A long name against a short one.
      const errors = await match(page, "duel", 95, "Bartholomew");
      if (size.island) await setInsets(page, ISLAND);
      await expect(page.locator("#hud .health-card b").first()).toHaveText(
        "Bartholomew",
      );
      const box = (await page.locator("#hud").boundingBox())!;
      const middle = box.x + box.width / 2;
      const clock = await inkAcross(page, "#hud .timer-wrap");
      expect(Math.abs(clock - middle), "clock in the pill").toBeLessThanOrEqual(
        1,
      );
      expect(
        Math.abs(middle - size.width / 2),
        "pill on the screen",
      ).toBeLessThanOrEqual(1);
      // Inside the safe area and clear of the gear.
      const inset = size.island
        ? ISLAND
        : { left: 0, right: 0, top: 0, bottom: 0 };
      expect(box.x).toBeGreaterThanOrEqual(inset.left);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width - inset.right);
      expect(box.y).toBeGreaterThanOrEqual(inset.top);
      const gear = (await page.locator("#battle-menu").boundingBox())!;
      expect(
        box.x + box.width <= gear.x ||
          gear.x + gear.width <= box.x ||
          box.y + box.height <= gear.y,
      ).toBe(true);
      const frame = (await page.locator(".arena-frame").boundingBox())!;
      expect(frame.x).toBeGreaterThanOrEqual(inset.left);
      expect(frame.x + frame.width).toBeLessThanOrEqual(
        size.width - inset.right + 0.5,
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("a fighter's name never slides under the badge or its note", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    // The ring closing: the note under the badge shows too.
    const errors = await match(page, "duel", 25);
    // Kai stands straight above you near the top of the view.
    await page.evaluate(() => {
      const w = window as any,
        [me, kai] = w.__snap.players;
      me.x = 800;
      me.y = 470;
      kai.x = 800;
      kai.y = me.y - 200;
      w.__push();
    });
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => (window as any).__push());
      await page.waitForTimeout(250);
    }
    await expect(page.locator("#phase-label")).toBeVisible();
    const covered = [
      (await page.locator("#hud").boundingBox())!,
      (await page.locator("#phase-label").boundingBox())!,
    ];
    const plates = await page
      .locator(".battle-nameplate:not([hidden])")
      .evaluateAll((all) =>
        all.map((e) => {
          const r = e.getBoundingClientRect();
          return {
            name: e.textContent,
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
          };
        }),
      );
    // Both on screen, Kai's plate at the very top (where the old 54 px
    // limit let it slide under the badge).
    expect(plates.map((p) => p.name)).toEqual(
      expect.arrayContaining(["tester · YOU", "Kai"]),
    );
    for (const plate of plates)
      for (const c of covered)
        expect(
          plate.x + plate.width <= c.x ||
            c.x + c.width <= plate.x ||
            plate.y + plate.height <= c.y ||
            c.y + c.height <= plate.y,
          `${plate.name} under the badge`,
        ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

for (const [label, me, kai] of [
  // You at the top middle (the camera stops there), Kai off to the right:
  // the arrow beside you is at the badge's height.
  ["to the right, at the top", [800, 110], [1560, 110]],
  // Kai off screen straight above you: the arrow points up, where your
  // own name is.
  ["straight above", [800, 640], [800, 40]],
] as const)
  test(`the arrow to an opponent off screen (${label}) covers neither the badge nor your name`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      const errors = await match(page, "duel");
      await page.evaluate(
        ([me, kai]) => {
          const w = window as any,
            [a, b] = w.__snap.players;
          [a.x, a.y] = me;
          [b.x, b.y] = kai;
          w.__push();
        },
        [me, kai] as const,
      );
      const arrow = page.locator(".enemy-bearing.is-orbit span");
      // Until your fighter (predicted) has arrived, so the camera centres
      // you (x 800 in both cases), and nothing moves any more.
      const yours = page.locator(".battle-nameplate", { hasText: "YOU" });
      let last = "";
      await expect
        .poll(
          async () => {
            await page.evaluate(() => (window as any).__push());
            const plate = await yours.boundingBox();
            const box = JSON.stringify([await arrow.boundingBox(), plate]);
            const centred =
              !!plate && Math.abs(plate.x + plate.width / 2 - 844 / 2) < 60;
            const still = centred && box === last;
            last = box;
            return still;
          },
          { timeout: 40_000, intervals: [500] },
        )
        .toBe(true);
      const a = (await arrow.boundingBox())!;
      const badge = (await page.locator("#hud").boundingBox())!;
      const mine = (await page
        .locator(".battle-nameplate", { hasText: "YOU" })
        .boundingBox())!;
      const apart = (p: typeof a, q: typeof a) =>
        p.x + p.width <= q.x ||
        q.x + q.width <= p.x ||
        p.y + p.height <= q.y ||
        q.y + q.height <= p.y;
      expect(apart(a, badge), "arrow under the badge").toBe(true);
      expect(
        apart(a, mine),
        `arrow over your name: arrow ${JSON.stringify(a)} name ${JSON.stringify(mine)}`,
      ).toBe(true);
      expect(apart(mine, badge), "your name under the badge").toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
