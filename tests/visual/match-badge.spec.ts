import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";

// PvP's score badge (owner, 7 Nov 2026): one pill at the top middle with
// names, rounds and the clock; health over each fighter; no opponent's
// ultimate; on phones the arena takes the height. An off-screen opponent is
// an arrow circling your fighter. Text sits on one line ("thẳng hàng").
const SIZES = [
  { name: "phone", width: 844, height: 390, phone: true },
  { name: "desktop", width: 1440, height: 900, phone: false },
];

async function match(page: Page, mode: string, remaining = 95) {
  const errors = await openHub(page);
  await page.evaluate(
    (mode) => (window as any).__room("pvp", { mode, phase: "playing" }),
    mode,
  );
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  await page.evaluate((remaining) => {
    const w = window as any;
    w.__snap.remaining = remaining;
    w.__push();
  }, remaining);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => (window as any).__push());
    await page.waitForTimeout(300);
  }
  return errors;
}

/** Where an item's ink is (CSS px): the badge photographed with the item
 * shown and hidden; the badge is see-through, so the arena behind it can't
 * be told from text any other way. */
async function ink(page: Page, hide: string) {
  const box = (await page.locator("#hud").boundingBox())!;
  const clip = {
    x: box.x - 2,
    y: box.y - 2,
    width: box.width + 4,
    height: box.height + 4,
  };
  const shot = async () =>
    (await page.screenshot({ clip, animations: "disabled" })).toString(
      "base64",
    );
  const on = await shot();
  const tag = await page.addStyleTag({
    content: `${hide} { visibility: hidden !important; }`,
  });
  const off = await shot();
  await tag.evaluate((e) => e.remove());
  return page.evaluate(
    async ([a, b, top, height]) => {
      const pixels = async (src: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${src}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext("2d")!;
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, c.width, c.height);
      };
      const [p, q] = [await pixels(a), await pixels(b)];
      let y0 = Infinity,
        y1 = -1;
      for (let y = 0; y < p.height; y++)
        for (let x = 0; x < p.width; x++) {
          const k = (y * p.width + x) * 4;
          const d =
            Math.abs(p.data[k] - q.data[k]) +
            Math.abs(p.data[k + 1] - q.data[k + 1]) +
            Math.abs(p.data[k + 2] - q.data[k + 2]);
          if (d > 60) {
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
        }
      const scale = p.height / (height + 4);
      return y1 < 0
        ? null
        : {
            mid: top - 2 + (y0 + y1 + 1) / 2 / scale,
            bottom: top - 2 + (y1 + 1) / scale,
          };
    },
    [on, off, box.y, box.height] as const,
  );
}

for (const size of SIZES)
  for (const mode of ["duel", "ffa", "teams"])
    test(`the score badge at ${size.name}, ${mode}`, async ({
      browser,
    }, info) => {
      test.setTimeout(150_000);
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
        for (let i = 0; i < cards; i++) {
          const card = `#hud .health-card[data-test-card="${i}"]`;
          const name = (await ink(page, `${card} b`))!;
          const dot = (await ink(page, `${card} > div:first-child::before`))!;
          const score = await ink(page, `${card} strong[id^=score-]`);
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
        const clock = (await ink(page, "#hud .timer-wrap"))!;
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
  const box = (await page.locator("#hud").boundingBox())!;
  const clip = {
    x: box.x - 2,
    y: box.y - 2,
    width: box.width + 4,
    height: box.height + 4,
  };
  const shot = async () =>
    (await page.screenshot({ clip, animations: "disabled" })).toString(
      "base64",
    );
  const on = await shot();
  const tag = await page.addStyleTag({
    content: `${hide} { visibility: hidden !important; }`,
  });
  const off = await shot();
  await tag.evaluate((e) => e.remove());
  return page.evaluate(
    async ([a, b, left, width]) => {
      const pixels = async (src: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${src}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext("2d")!;
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, c.width, c.height);
      };
      const [p, q] = [await pixels(a), await pixels(b)];
      let x0 = Infinity,
        x1 = -1;
      for (let y = 0; y < p.height; y++)
        for (let x = 0; x < p.width; x++) {
          const k = (y * p.width + x) * 4;
          const d =
            Math.abs(p.data[k] - q.data[k]) +
            Math.abs(p.data[k + 1] - q.data[k + 1]) +
            Math.abs(p.data[k + 2] - q.data[k + 2]);
          if (d > 60) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
          }
        }
      const scale = p.width / (width + 4);
      return left - 2 + (x0 + x1 + 1) / 2 / scale;
    },
    [on, off, box.x, box.width] as const,
  );
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
      const errors = await match(page, "duel");
      if (size.island) await setInsets(page, ISLAND);
      // A long name against a short one.
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.players[0].name = "Bartholomew";
        w.__push();
      });
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
