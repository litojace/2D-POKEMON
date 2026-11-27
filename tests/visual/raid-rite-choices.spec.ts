import { expect, test } from "@playwright/test";
import {
  box,
  inside,
  openHub,
  pushUntilBattle,
  snap,
  openPlayPanel,
  settle,
  createRoom,
} from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";

const buffValues: Record<string, string[]> = {
  shelter: ["−25%"],
  sharing: ["+12"],
  core: ["+8"],
  rescue: ["+15%", "+35%"],
  courage: ["+20%"],
  mending: ["12%"],
  grounded: ["NO"],
  fireproof: ["×2", "−50%"],
  polished: ["+60"],
  lucid: ["1st"],
  footing: ["+15%"],
  lamplighter: ["1%"],
};

for (const size of [
  { width: 1440, height: 900 },
  { width: 1024, height: 500 },
  { width: 844, height: 390 },
  { width: 844, height: 280 },
]) {
  test(`rite pictograms and tap-safe details fit at ${size.width}x${size.height}`, async ({
    browser,
    browserName,
  }, info) => {
    // Twelve cards measured part by part: at 1440x900 with software
    // rendering (about 12 fps) that took 1.9 minutes, over the 90 s default.
    test.setTimeout(180_000);
    const mobile = size.width !== 1440;
    const context = await browser.newContext({
      viewport: size,
      isMobile: mobile,
      hasTouch: mobile,
    });
    try {
      const page = await context.newPage();
      const drawingErrors: string[] = [];
      let watchRites = false;
      page.on("console", (message) => {
        if (
          watchRites &&
          message.type() === "error" &&
          /attribute d|<path>|parsing.*path/i.test(message.text())
        )
          drawingErrors.push(message.text());
      });
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("raid", { boss: "grumblecrag" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      await page.evaluate(() => {
        const w = window as any,
          previous = w.__emit;
        w.__riteRequests = [];
        w.__emit = (event: string, data: unknown) => {
          if (event === "rite") w.__riteRequests.push(data);
          previous?.(event, data);
        };
      });
      watchRites = true;
      // Six rites on offer, an even 3 x 2 grid.
      for (const offers of [
        ["shelter", "sharing", "core", "rescue", "courage", "mending"],
        [
          "grounded",
          "fireproof",
          "polished",
          "lucid",
          "footing",
          "lamplighter",
        ],
      ]) {
        await page.evaluate((offers) => {
          const w = window as any;
          w.__snap.phase = "intermission";
          w.__snap.remaining = 15;
          w.__snap.raid.offers.me = offers;
          w.__push();
        }, offers);
        await expect(page.locator("[data-raid-rite]")).toHaveCount(6);
        await page.locator(".rites-screen").evaluate(async (e) => {
          await Promise.all(
            e.getAnimations().map((a) => a.finished.catch(() => {})),
          );
        });
        const card = await box(page, ".rites-screen");
        // The tiles sit between the heading and the links, and nothing in a
        // tile spills out of it (nor the grid scroll) at the normal text size.
        const head = await box(page, ".rites-head"),
          foot = await box(page, ".rites-foot"),
          grid = await box(page, ".raid-rite-options");
        expect(grid.y).toBeGreaterThanOrEqual(head.y + head.height - 1);
        expect(grid.y + grid.height).toBeLessThanOrEqual(foot.y + 1);
        expect(
          await page
            .locator(".raid-rite-options")
            .evaluate((e) => [
              e.scrollHeight - e.clientHeight,
              ...[...e.children].map((b) => b.scrollHeight - b.clientHeight),
            ]),
        ).toEqual([0, 0, 0, 0, 0, 0, 0]);
        // The figures sit beside each rite's picture, never on it (owner).
        // One pass for all six: a round trip per figure is too slow here.
        expect(
          await page.evaluate(() =>
            [...document.querySelectorAll(".raid-rite-icon--buff")].flatMap(
              (emblem) => {
                const art = emblem
                  .querySelector("svg")!
                  .getBoundingClientRect();
                return [...emblem.querySelectorAll(".raid-rite-buff-stat")]
                  .map((stat) => stat.getBoundingClientRect())
                  .filter(
                    (b) =>
                      b.left < art.right - 1 &&
                      b.right > art.left + 1 &&
                      b.top < art.bottom - 1 &&
                      b.bottom > art.top + 1,
                  )
                  .map(() =>
                    emblem
                      .closest("[data-raid-rite]")!
                      .getAttribute("data-raid-rite"),
                  );
              },
            ),
          ),
          "figures covering their picture",
        ).toEqual([]);
        // Every tile measured in one pass, then checked here: a round trip
        // per part and figure (about 15 a tile) ran past the time limit at
        // 1440x900 on software rendering.
        // Very short screens keep the one-line description in Rite details.
        const partNames = [
          ".raid-rite-icon",
          "b",
          ...(size.height > 350 ? [".raid-rite-trigger"] : []),
          ".raid-rite-buff-stat",
        ];
        const tiles = await page.evaluate(
          ([offers, partNames]) => {
            const rect = (e: Element) => {
              const r = e.getBoundingClientRect();
              return { x: r.x, y: r.y, width: r.width, height: r.height };
            };
            return offers.map((id) => {
              const button = document.querySelector(
                `[data-raid-rite="${id}"]`,
              )!;
              const svg = button.querySelector("svg") as SVGGraphicsElement;
              const ink = svg.getBBox();
              return {
                id,
                button: rect(button),
                content: rect(button.querySelector(".raid-rite-copy")!),
                parts: partNames.map((p) => rect(button.querySelector(p)!)),
                emblem: rect(button.querySelector(".raid-rite-icon--buff")!),
                stats: [...button.querySelectorAll(".raid-rite-buff-stat")].map(
                  (stat) => {
                    const value = stat.querySelector(".raid-rite-buff-value")!,
                      unit = stat.querySelector(".raid-rite-buff-unit")!;
                    return {
                      box: rect(stat),
                      labels: [value, unit].map((l) => ({
                        text: l.textContent,
                        box: rect(l),
                      })),
                      valueSize: parseFloat(getComputedStyle(value).fontSize),
                      unitSize: parseFloat(getComputedStyle(unit).fontSize),
                      value: value.textContent,
                    };
                  },
                ),
                picture: svg.getAttribute("data-rite-picture"),
                // The tile's tint and the name's colour come from the rite.
                look: [
                  getComputedStyle(button).backgroundImage.includes("gradient"),
                  getComputedStyle(button.querySelector("b")!).color,
                  getComputedStyle(button).getPropertyValue("--rite-color"),
                ],
                ink: {
                  x: ink.x,
                  y: ink.y,
                  right: ink.x + ink.width,
                  bottom: ink.y + ink.height,
                },
              };
            });
          },
          [offers, partNames] as const,
        );
        for (const t of tiles) {
          const { id, button, content, emblem } = t;
          expect(inside(button, card)).toBe(true);
          expect(inside(content, button)).toBe(true);
          expect(
            Math.abs(
              content.x + content.width / 2 - button.x - button.width / 2,
            ),
          ).toBeLessThanOrEqual(2);
          expect(
            Math.abs(
              content.y + content.height / 2 - button.y - button.height / 2,
            ),
          ).toBeLessThanOrEqual(2);
          for (const [i, part] of t.parts.entries())
            expect(inside(part, button), `${id} ${partNames[i]}`).toBe(true);
          for (const stat of t.stats) {
            expect(inside(stat.box, emblem)).toBe(true);
            for (const label of stat.labels)
              expect(
                inside(label.box, emblem),
                `${id}: ${label.text} must stay in its emblem`,
              ).toBe(true);
            expect(stat.valueSize).toBeGreaterThanOrEqual(
              size.height > 350 ? 22 : 20,
            );
            expect(stat.unitSize).toBeGreaterThanOrEqual(10);
          }
          expect(t.stats.map((s) => s.value)).toEqual(buffValues[id]);
          expect(t.picture).toBe(id);
          // Every rite has its colour (six of the twelve once lost theirs
          // outside the old card: no tint, white names).
          const [tinted, nameColor, riteColor] = t.look as [
            boolean,
            string,
            string,
          ];
          expect(tinted, `${id} tile tint`).toBe(true);
          expect(riteColor.trim(), `${id} colour`).toMatch(/^#[0-9a-f]{6}$/i);
          const hex = riteColor.trim().slice(1);
          expect(nameColor, `${id} name colour`).toBe(
            `rgb(${[0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`,
          );
          expect(t.ink.x).toBeGreaterThanOrEqual(1);
          expect(t.ink.y).toBeGreaterThanOrEqual(1);
          expect(t.ink.right).toBeLessThanOrEqual(159);
          expect(t.ink.bottom).toBeLessThanOrEqual(115);
        }
        await expect(
          page.locator("[data-raid-rite] .raid-rite-effect"),
        ).toHaveCount(0);
        const more = page.locator(".raid-rite-more"),
          summary = more.locator("summary");
        expect(inside(await box(page, ".raid-rite-more > summary"), card)).toBe(
          true,
        );
        await summary.click();
        await expect(more).toHaveAttribute("open", "");
        await expect(page.locator(".raid-rite-options")).toHaveJSProperty(
          "inert",
          true,
        );
        await expect(page.locator(".raid-rite-reference li")).toHaveCount(6);
        expect(inside(await box(page, ".raid-rite-reference"), card)).toBe(
          true,
        );
        expect(
          await page.evaluate(() => (window as any).__riteRequests),
        ).toEqual([]);
        const reference = await box(page, ".raid-rite-reference"),
          close = await box(page, ".raid-rite-more > summary");
        expect(reference.y + reference.height).toBeLessThanOrEqual(close.y);
        if (offers[0] === "shelter")
          await snap(
            page,
            info,
            `rite-full-effects-${size.width}x${size.height}`,
          );
        // Live countdown/team updates must preserve a reference being read.
        await page.evaluate(() => {
          const w = window as any;
          w.__snap.remaining = 12;
          w.__push();
        });
        await expect(more).toHaveAttribute("open", "");
        await expect(page.locator(".raid-choice-timer")).toContainText(
          "12 seconds",
        );
        if (size.height === 280) {
          expect(
            await page
              .locator(".raid-rite-reference")
              .evaluate((e) => e.scrollHeight > e.clientHeight),
          ).toBe(true);
        }
        if (size.height === 280 && browserName === "chromium") {
          const client = await context.newCDPSession(page);
          const area = await box(page, ".raid-rite-reference");
          const x = area.x + area.width / 2,
            y = area.y + area.height - 8;
          await client.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x, y }],
          });
          for (let i = 1; i <= 8; i++) {
            await client.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [{ x, y: y - ((area.height - 20) * i) / 8 }],
            });
          }
          await client.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
          await expect
            .poll(() =>
              page.locator(".raid-rite-reference").evaluate((e) => e.scrollTop),
            )
            .toBeGreaterThan(10);
          await client.detach();
        }
        await summary.click();
        await expect(page.locator(".raid-rite-options")).toHaveJSProperty(
          "inert",
          false,
        );
        {
          await snap(
            page,
            info,
            `rite-pictograms-${offers[0]}-${size.width}x${size.height}`,
          );
        }
      }
      const summary = page.locator(".raid-rite-more > summary");
      await summary.click();
      await summary.press("Escape");
      await expect(page.locator(".raid-rite-more")).not.toHaveAttribute(
        "open",
        "",
      );
      await expect(page.locator(".raid-rite-options")).toHaveJSProperty(
        "inert",
        false,
      );
      await page.locator('[data-raid-rite="lucid"]').click();
      await expect
        .poll(() => page.evaluate(() => (window as any).__riteRequests))
        .toEqual([{ id: "lucid" }]);
      expect(errors).toEqual([]);
      expect(drawingErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

// The server drops a picked rite from the offers; the card stays where it was,
// checked and greyed out, and once both picks are made the rest grey out too.
for (const size of [
  { width: 1440, height: 900 },
  { width: 1366, height: 640 },
  { width: 844, height: 390 },
])
  test(`a picked rite stays in place, checked and greyed out (${size.width}x${size.height})`, async ({
    browser,
  }, info) => {
    const mobile = size.width < 1000;
    const context = await browser.newContext({
      viewport: size,
      isMobile: mobile,
      hasTouch: mobile,
    });
    try {
      const page = await context.newPage();
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("raid", { boss: "grumblecrag" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      const offer = [
        "shelter",
        "sharing",
        "core",
        "rescue",
        "courage",
        "mending",
      ];
      const show = (offers: string[] | undefined, rites: string[]) =>
        page.evaluate(
          ([offers, rites]) => {
            const w = window as any;
            w.__snap.phase = "intermission";
            w.__snap.remaining = 15;
            if (offers) w.__snap.raid.offers.me = offers;
            else delete w.__snap.raid.offers.me;
            w.__snap.raid.rites.me = rites;
            w.__push();
          },
          [offers, rites] as const,
        );
      const cards = page.locator("[data-raid-rite]");
      const places = () =>
        cards.evaluateAll((els) =>
          els.map((e) => {
            const r = e.getBoundingClientRect();
            return [
              (e as HTMLElement).dataset.raidRite,
              Math.round(r.x),
              Math.round(r.y),
            ];
          }),
        );
      // A pick redraws the same panel; its pop-in mustn't play again (it
      // moved the cards while it ran).
      const popping = () =>
        page
          .locator(".rites-screen")
          .evaluate(
            (e) =>
              e.getAnimations().filter((a) => a.playState === "running").length,
          );
      // How opaque each tile shows, its own opacity times its ancestors':
      // only a tile's content fades, never the tile, or the arena shows
      // through it (the global button:disabled fade, style.css, did).
      const tileOpacity = () =>
        cards.evaluateAll((els) =>
          els.map((e) => {
            let o = 1;
            for (let n: Element | null = e; n; n = n.parentElement)
              o *= Number(getComputedStyle(n).opacity);
            return o;
          }),
        );
      await show(offer, []);
      await expect(cards).toHaveCount(6);
      await expect(page.locator(".rites-screen")).toBeVisible();
      // Measure where the panel ends up once it has popped in (this page
      // draws no frames between steps, so its pop wouldn't finish by itself).
      await settle(page);
      const before = await places();
      // The six tiles end above the links (Rite details, Team rites) and
      // start below the heading, the chapter tip included on tall screens.
      const tilesTop = await page
        .locator(".raid-rite-options")
        .evaluate((e) => e.getBoundingClientRect().top);
      const tilesEnd = await page
        .locator(".raid-rite-options")
        .evaluate((e) => e.getBoundingClientRect().bottom);
      const headEnd = await page
        .locator(".rites-head")
        .evaluate((e) => e.getBoundingClientRect().bottom);
      const linksStart = await page
        .locator(".rites-foot")
        .evaluate((e) => e.getBoundingClientRect().top);
      expect(tilesTop).toBeGreaterThanOrEqual(headEnd - 1);
      expect(tilesEnd).toBeLessThanOrEqual(linksStart + 1);
      // First pick: Core leaves the offers but keeps its card and place.
      await show(
        offer.filter((id) => id !== "core"),
        ["core"],
      );
      const core = page.locator('[data-raid-rite="core"]');
      await expect(core).toBeDisabled();
      await expect(core).toHaveAttribute("aria-pressed", "true");
      await expect(core.locator(".raid-rite-check")).toBeVisible();
      await expect(cards).toHaveCount(6);
      expect(await popping()).toBe(0);
      expect(await places()).toEqual(before);
      for (const id of offer.filter((id) => id !== "core"))
        await expect(page.locator(`[data-raid-rite="${id}"]`)).toBeEnabled();
      // Greyed out: the picked card's text is faded.
      expect(
        await core
          .locator(".raid-rite-copy")
          .evaluate((e) => Number(getComputedStyle(e).opacity)),
      ).toBeLessThan(0.7);
      // …the tile itself not: it stays opaque.
      expect(await tileOpacity()).toEqual(Array(6).fill(1));
      await snap(page, info, `rite-picked-${size.width}x${size.height}`);
      // Second pick: every card stays, two checked, all disabled.
      await show(undefined, ["core", "courage"]);
      await expect(page.locator(".raid-rite-locked")).toBeVisible();
      await expect(cards).toHaveCount(6);
      await expect(page.locator("[data-raid-rite]:enabled")).toHaveCount(0);
      await expect(
        page.locator('[data-raid-rite][aria-pressed="true"]'),
      ).toHaveCount(2);
      expect(await popping()).toBe(0);
      expect(await places()).toEqual(before);
      // Locked: every tile still opaque, only its content greyed.
      expect(await tileOpacity()).toEqual(Array(6).fill(1));
      await snap(page, info, `rite-locked-${size.width}x${size.height}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// The rites in the style of the battle countdown (owner, Nov 2026): the
// whole screen edge to edge past the notch, under the countdown's navy
// shade, even across the screen (its middle used to show the court bright),
// with the seconds as one big number and no card. On the owner's iPhone
// held sideways (956x440 with the Dynamic Island's insets) and a small phone.
for (const size of [
  { width: 956, height: 440, island: true },
  { width: 667, height: 375, island: false },
])
  test(`the rites fill the whole screen like the countdown at ${size.width}x${size.height}${size.island ? " with the Dynamic Island" : ""}`, async ({
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
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("raid", { boss: "prismatail" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      if (size.island) await setInsets(page, ISLAND);
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.phase = "intermission";
        w.__snap.remaining = 12;
        w.__snap.raid.offers.me = [
          "shelter",
          "sharing",
          "core",
          "rescue",
          "courage",
          "mending",
        ];
        w.__push();
      });
      await expect(page.locator("[data-raid-rite]")).toHaveCount(6);
      await settle(page);
      const overlay = page.locator("#arena-overlay");
      await expect(overlay).toHaveClass(/\bis-rites\b/);
      const look = await page.evaluate(() => {
        const ov = document.getElementById("arena-overlay")!;
        const r = ov.getBoundingClientRect();
        const screen = getComputedStyle(ov.querySelector(".rites-screen")!);
        const number = ov.querySelector(".raid-choice-timer .live-number")!;
        return {
          rect: [r.left, r.top, r.width, r.height].map(Math.round),
          shade: getComputedStyle(ov).backgroundColor,
          card: [screen.backgroundColor, screen.borderTopWidth],
          number: [
            number.textContent,
            parseFloat(getComputedStyle(number).fontSize),
          ],
          // The HUD and the battle controls step aside; the quick-chat
          // button stays (a party talks between chapters), in a column the
          // screen leaves free.
          hidden: ["#raid-hud", "#mobile-controls"].map((s) => {
            const e = document.querySelector(s);
            return !e || getComputedStyle(e).visibility === "hidden";
          }),
          chat: (() => {
            const e = document.querySelector<HTMLElement>("#battle-chat");
            if (!e || e.hidden) return "none";
            if (getComputedStyle(e).visibility === "hidden") return "hidden";
            const c = e.getBoundingClientRect();
            const under = [...document.querySelectorAll("[data-raid-rite]")]
              .map((t) => t.getBoundingClientRect())
              .some(
                (t) =>
                  t.left < c.right &&
                  t.right > c.left &&
                  t.top < c.bottom &&
                  t.bottom > c.top,
              );
            return under ? "over a tile" : "clear";
          })(),
        };
      });
      expect(look.rect).toEqual([0, 0, size.width, size.height]);
      // The countdown's navy, the same strength everywhere (a plain colour,
      // not its gradient that is lighter in the middle).
      expect(look.shade).toBe("rgba(7, 18, 37, 0.65)");
      expect(look.card).toEqual(["rgba(0, 0, 0, 0)", "0px"]);
      expect(look.number[0]).toBe("12");
      expect(look.number[1]).toBeGreaterThanOrEqual(40);
      expect(look.hidden).toEqual([true, true]);
      // A party (this room has two raiders) keeps its quick chat.
      expect(look.chat).toBe("clear");
      // Every tile is a comfortable touch target, fully on screen and clear
      // of the notch's insets.
      const inset = size.island
        ? ISLAND
        : { left: 0, right: 0, top: 0, bottom: 0 };
      for (const tile of await page.locator("[data-raid-rite]").all()) {
        const b = (await tile.boundingBox())!;
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.width).toBeGreaterThanOrEqual(44);
        expect(b.x).toBeGreaterThanOrEqual(inset.left);
        expect(b.x + b.width).toBeLessThanOrEqual(size.width - inset.right);
        expect(b.y + b.height).toBeLessThanOrEqual(size.height - inset.bottom);
      }
      await snap(page, info, `rites-whole-screen-${size.width}x${size.height}`);
      // Rite details: the six in columns, not long lines across the screen.
      await page.locator(".raid-rite-more > summary").click();
      const rows = await page
        .locator(".raid-rite-reference li")
        .evaluateAll(
          (items) =>
            new Set(items.map((i) => Math.round(i.getBoundingClientRect().y)))
              .size,
        );
      expect(rows).toBeLessThanOrEqual(3);
      // The fight: the screen goes and the controls come back.
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.phase = "playing";
        w.__push();
      });
      await expect(overlay).not.toHaveClass(/\bis-rites\b/);
      await expect(page.locator("body")).not.toHaveClass(/\braid-rites-open\b/);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
