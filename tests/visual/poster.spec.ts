import { expect, test, type Page } from "@playwright/test";
import { box, hubMenu, inside, openHub, skipTour, snap } from "./helpers";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

// The Poster look (apps/client/src/themes/poster): one sweep of the Lobby,
// the hub's screens and Settings with the look on, at the sizes the game is
// checked at. It is shown through `?ui=poster`, as a look that is not ready
// yet is; the rest of the visual suite runs the look underneath.
const withPoster = (page: Page) =>
  page.addInitScript(() => {
    if (!location.search) history.replaceState(null, "", "/?ui=poster");
  });
/** Elements (by selector) whose words are cut short ("…"). */
const cutOff = (page: Page, selectors: string[]) =>
  page.evaluate(
    (sels) =>
      sels.flatMap((sel) =>
        [...document.querySelectorAll<HTMLElement>(sel)]
          .filter(
            (el) =>
              el.offsetParent !== null &&
              // Across only: Anton's letters stand taller than a line of
              // their size, which reads as "taller than the box" though
              // nothing is cut.
              el.scrollWidth > el.clientWidth + 1,
          )
          .map((el) => `${sel}: "${el.textContent?.trim()}"`),
      ),
    selectors,
  );

const SIZES = [
  { width: 667, height: 375, phone: true },
  { width: 844, height: 390, phone: true },
  {
    width: 852,
    height: 393,
    phone: true,
    inset: { left: 59, right: 59, bottom: 21, top: 0 },
  },
  { width: 1440, height: 900, phone: false },
];
for (const size of SIZES) {
  const name = `${size.width}x${size.height}${size.inset ? "-notch" : ""}`;
  test(`Poster: the Lobby and the hub's screens (${name})`, async ({
    browser,
  }, info) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await skipTour(page);
      await withPoster(page);
      const errors = await openHub(page);
      if (size.inset)
        await page.evaluate((inset) => {
          for (const [key, value] of Object.entries(inset))
            document.documentElement.style.setProperty(
              `--safe-${key}`,
              `${value}px`,
            );
        }, size.inset);
      // The look is on, alone, with its own type.
      expect(
        await page.evaluate(() => document.documentElement.dataset.ui),
      ).toBe("poster");
      await expect(page.locator("#ui-theme-css")).toHaveCount(1);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => [
          document.fonts.check('20px "Anton"'),
          document.fonts.check('600 14px "Archivo"'),
          getComputedStyle(
            document.getElementById("lobby-fighter-name")!,
          ).fontFamily.includes("Anton"),
        ]),
      ).toEqual([true, true, true]);
      await snap(page, info, `poster-lobby-${name}`);

      // The fighter's name stands behind the stage, the same name as the
      // nameplate's, and follows the fighter.
      const names = () =>
        page.evaluate(() => [
          document.getElementById("lobby-bigname")!.textContent,
          document.getElementById("lobby-fighter-name")!.textContent,
          getComputedStyle(document.getElementById("lobby-bigname")!).display,
        ]);
      const [big, plate, shown] = await names();
      expect(big).toBe(plate);
      expect(shown).toBe("block");
      // The Lobby's words read in full.
      expect(
        await cutOff(page, [
          ".lobby-rail span",
          ".lobby-name h2",
          ".lobby-card b",
          ".lobby-card-kicker",
          ".lobby-mode-text b",
          ".lobby-mode-text small",
          ".lobby-slot small",
          ".account-name",
        ]),
      ).toEqual([]);
      // PLAY, the mode and every rail button are whole and a finger tall.
      const screen = {
        x: size.inset?.left ?? 0,
        y: 0,
        width: size.width - (size.inset?.left ?? 0) - (size.inset?.right ?? 0),
        height: size.height - (size.inset?.bottom ?? 0),
      };
      for (const sel of ["#lobby-play", "#lobby-mode", ".lobby-rail"]) {
        const b = await box(page, sel);
        expect(inside(b, screen), sel).toBe(true);
      }
      const rail = await page.locator(".lobby-rail button").evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { w: r.width, h: r.height };
        }),
      );
      expect(rail).toHaveLength(6);
      for (const r of rail)
        expect(Math.min(r.w, r.h)).toBeGreaterThanOrEqual(44);
      // The cards don't run under the notice above the stage.
      const cards = await box(page, ".lobby-cards");
      const play = await box(page, ".lobby-play");
      expect(cards.x + cards.width).toBeLessThanOrEqual(
        size.width - (size.inset?.right ?? 0) + 0.5,
      );
      expect(cards.y + cards.height).toBeLessThanOrEqual(play.y + 0.5);

      // Each screen: an ink board whose masthead carries the element colour,
      // Close a finger wide and on screen, the chosen tab readable.
      const el = await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--el")
          .trim(),
      );
      for (const action of [
        "fighters",
        "shop",
        "missions",
        "ranks",
        "friends",
      ]) {
        await hubMenu(page, action);
        const panel = page
          .locator(
            ".ui-panel-host:not([data-ui-parked]) > .ui-panel:not([data-ui-leaving])",
          )
          .last();
        await expect(panel).toBeVisible();
        await expect(
          page.locator(`.lobby-rail [data-lobby-action="${action}"]`),
        ).toHaveAttribute("aria-current", "page");
        await snap(page, info, `poster-${action}-${name}`);
        const look = await panel.evaluate((p) => {
          const rgb = (c: string) => {
            const d = document.createElement("i");
            d.style.color = c;
            document.body.append(d);
            const v = getComputedStyle(d).color;
            d.remove();
            return v;
          };
          const head = p.querySelector<HTMLElement>(".ui-panel-head");
          const close = p.querySelector<HTMLElement>(".ui-close");
          const c = close?.getBoundingClientRect();
          return {
            radius: getComputedStyle(p).borderTopLeftRadius,
            head: head ? getComputedStyle(head).backgroundColor : null,
            el: rgb(
              getComputedStyle(document.documentElement)
                .getPropertyValue("--el")
                .trim(),
            ),
            close: c
              ? {
                  x: c.x,
                  y: c.y,
                  width: c.width,
                  height: c.height,
                  // A finger's 44 px, with the room around it that taps too.
                  hit: [-20, 20].every((d) =>
                    close!.contains(
                      document.elementFromPoint(
                        c.x + c.width / 2 + d,
                        c.y + c.height / 2,
                      ),
                    ),
                  ),
                }
              : null,
          };
        });
        expect(look.radius, action).toBe("0px");
        // One chrome for every fighter (tokens.css): a masthead is ink and
        // the accent is cream, whatever the Lobby fighter's colour.
        if (look.head) expect(look.head, action).toBe("rgb(13, 13, 15)");
        expect(look.el, action).toBe("rgb(244, 234, 213)");
        // A tab reads whole: its words lie inside the tab row (above a
        // phone's height the Friends row came to 22 px and cut them in
        // half), and a count on a tab stands out from its chip (it was
        // white on a white wash over the element colour).
        const tabs = await panel.evaluate((p) => {
          // Painted once to read any colour (oklch too) as sRGB bytes.
          const ink = document
            .createElement("canvas")
            .getContext("2d", { willReadFrequently: true })!;
          const lum = (c: string) => {
            ink.clearRect(0, 0, 1, 1);
            ink.fillStyle = c;
            ink.fillRect(0, 0, 1, 1);
            const [r, g, b] = [...ink.getImageData(0, 0, 1, 1).data]
              .slice(0, 3)
              .map((v) => {
                v /= 255;
                return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
              });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          const row = p.querySelector<HTMLElement>(".ui-tabs");
          if (!row) return null;
          const r = row.getBoundingClientRect();
          return {
            height: r.height,
            cut: [...row.querySelectorAll<HTMLElement>(":scope > button")]
              .filter((tab) => {
                if (!tab.getBoundingClientRect().width) return false;
                const range = document.createRange();
                range.selectNodeContents(tab);
                const t = range.getBoundingClientRect();
                return t.top < r.top - 0.5 || t.bottom > r.bottom + 0.5;
              })
              .map((tab) => tab.textContent),
            counts: [...row.querySelectorAll<HTMLElement>(".ui-tag")].map(
              (tag) => {
                const style = getComputedStyle(tag);
                const a = lum(style.color);
                const b = lum(style.backgroundColor);
                return {
                  text: tag.textContent,
                  ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
                };
              },
            ),
          };
        });
        if (tabs) {
          expect(tabs.cut, `${action} tabs`).toEqual([]);
          for (const count of tabs.counts)
            expect(
              count.ratio,
              `${action} count ${count.text}`,
            ).toBeGreaterThanOrEqual(4.5);
        }
        expect(look.close, action).not.toBeNull();
        expect(
          inside(look.close!, { x: 0, y: 0, ...size }),
          `${action} close`,
        ).toBe(true);
        if (size.phone) expect(look.close!.hit, `${action} close`).toBe(true);
        // Close puts the Lobby back, and the rail's block goes.
        await panel.locator(".ui-close").click();
        await expect(
          page.locator(`.lobby-rail [data-lobby-action="${action}"]`),
        ).not.toHaveAttribute("aria-current", "page");
        await expect(panel).toBeHidden();
      }
      expect(el).toMatch(/^#[0-9a-f]{6}$/i);

      // Settings, with the look on.
      await page.evaluate(() => document.getElementById("settings")!.click());
      const dialog = page.locator("#dialog");
      await expect(dialog.locator(".settings-screen")).toBeVisible();
      await snap(page, info, `poster-settings-${name}`);
      expect(inside(await box(page, "#dialog"), { x: 0, y: 0, ...size })).toBe(
        true,
      );
      const scroll = await dialog
        .locator(".dialog-content")
        .evaluate((d) => d.scrollHeight - d.clientHeight);
      expect(scroll).toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

// A new player's Lobby in Poster: the side systems are locked by level
// (feature-unlocks.ts). At 800 px and wider Poster's rail is a text menu, so
// the "Lv 5" pill stands where the icon was, before the label; under that
// the rail folds to icons and the pill sits over the label, as in the look
// underneath.
for (const size of [
  { width: 667, height: 375 },
  { width: 844, height: 390 },
]) {
  test(`Poster: a new player's Lobby shows its locks whole (${size.width}x${size.height})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: size,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await skipTour(page);
      await page.addInitScript(() => {
        const w = window as any;
        w.__economyPatch = {
          journey: {
            xp: 0,
            recent: [],
            season: {
              id: "2026-10",
              xp: 0,
              week: "2026-W43",
              goals: {},
              completed: [],
            },
            unlocked: [],
          },
        };
        w.__accountPatch = { title: null, titleColor: null };
      });
      await withPoster(page);
      const errors = await openHub(page);
      await page.evaluate(() => document.fonts.ready);
      await snap(page, info, `poster-locks-${size.width}x${size.height}`);
      const rail = await page
        .locator(".lobby-rail button")
        .evaluateAll((buttons) =>
          buttons.map((b) => {
            const r = b.getBoundingClientRect();
            const pill = b.querySelector<HTMLElement>(".feature-lock");
            const label = b.querySelector<HTMLElement>(":scope > span")!;
            const p = pill?.getBoundingClientRect();
            const l = label.getBoundingClientRect();
            return {
              action: b.dataset.lobbyAction,
              w: r.width,
              h: r.height,
              // The pill and the label are whole, inside the button, and
              // don't sit on each other.
              pill: p
                ? {
                    inside:
                      p.left >= r.left - 0.5 &&
                      p.right <= r.right + 0.5 &&
                      p.top >= r.top - 0.5 &&
                      p.bottom <= r.bottom + 0.5,
                    clear:
                      p.right <= l.left + 0.5 ||
                      p.bottom <= l.top + 0.5 ||
                      l.right <= p.left + 0.5 ||
                      l.bottom <= p.top + 0.5,
                    cut: pill!.scrollWidth > pill!.clientWidth + 1,
                  }
                : null,
              labelCut: label.scrollWidth > label.clientWidth + 1,
            };
          }),
        );
      expect(rail).toHaveLength(6);
      // Shop, Raids, Missions and Ranks open by level; Fighters and Friends
      // never lock.
      expect(rail.filter((b) => b.pill).map((b) => b.action)).toEqual([
        "shop",
        "raids",
        "missions",
        "ranks",
      ]);
      for (const b of rail) {
        expect(Math.min(b.w, b.h), b.action).toBeGreaterThanOrEqual(40);
        expect(b.labelCut, b.action).toBe(false);
        if (b.pill)
          expect(b.pill, b.action).toEqual({
            inside: true,
            clear: true,
            cut: false,
          });
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

// An invite seat is a small tilted card: a plus and the word "INVITE". On
// the shortest phones the seat is 44 px and the word (40 px of ink) ran over
// its 3 px frame (audit B04): there the seat shows its plus alone. Measured
// in the seat's own layout (offsets), since the tilt widens every box on
// screen.
for (const size of [
  { width: 844, height: 280, word: false },
  { width: 568, height: 320, word: false },
  { width: 640, height: 360, word: true },
  { width: 667, height: 375, word: true },
]) {
  test(`Poster: an invite seat's words stay inside its frame (${size.width}x${size.height})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await skipTour(page);
      await withPoster(page);
      const errors = await openHub(page);
      await page.evaluate(() => document.fonts.ready);
      await snap(page, info, `poster-invite-${size.width}x${size.height}`);
      const seats = await page.locator(".lobby-slot").evaluateAll((slots) =>
        slots
          .filter((s) => (s as HTMLElement).offsetParent !== null)
          .map((s) => {
            const seat = s as HTMLElement;
            const plus = seat.querySelector<HTMLElement>("span")!;
            const word = seat.querySelector<HTMLElement>("small")!;
            const shown = [plus, word].filter((el) => el.offsetHeight > 1);
            return {
              size: seat.offsetWidth,
              room: seat.clientWidth,
              word: word.offsetHeight > 1,
              // Each shown line, from the frame's inner edge.
              lines: shown.map((el) => [
                el.offsetLeft,
                el.offsetLeft + el.offsetWidth,
                el.offsetTop,
                el.offsetTop + el.offsetHeight,
              ]),
              middle: shown.length
                ? (shown[0].offsetTop +
                    shown[shown.length - 1].offsetTop +
                    shown[shown.length - 1].offsetHeight) /
                  2
                : -1,
            };
          }),
      );
      expect(seats.length).toBe(2);
      for (const seat of seats) {
        expect(seat.size, "a finger wide").toBeGreaterThanOrEqual(44);
        expect(seat.word, JSON.stringify(seat)).toBe(size.word);
        for (const [left, right, top, bottom] of seat.lines) {
          // Two pixels clear of the frame on each side.
          expect(left, JSON.stringify(seat)).toBeGreaterThanOrEqual(2);
          expect(right, JSON.stringify(seat)).toBeLessThanOrEqual(
            seat.room - 2,
          );
          expect(top, JSON.stringify(seat)).toBeGreaterThanOrEqual(2);
          expect(bottom, JSON.stringify(seat)).toBeLessThanOrEqual(
            seat.room - 2,
          );
        }
        // What is shown stands in the middle of the card.
        expect(Math.abs(seat.middle - seat.room / 2)).toBeLessThanOrEqual(1.5);
      }
      // With three in the party the fourth seat is an invite card above the
      // third player: a finger wide too (it was 31 px at 568 x 320, the word
      // spilling over both sides), under the party bar and clear of the
      // player below. Under 300 px of height the row has no room for that.
      if (size.height >= 300) {
        await page.evaluate(() =>
          (window as any).__sock.fire("party", {
            code: "PARTY2",
            leader: "11111111-1111-4111-8111-111111111111",
            members: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                name: "tester",
                character: "voltkit",
              },
              {
                id: "33333333-3333-4333-8333-333333333333",
                name: "Pal",
                character: "tidefin",
              },
              {
                id: "66666666-6666-4666-8666-666666666666",
                name: "Bo",
                character: "voltkit",
              },
            ],
          }),
        );
        const fourth = page.locator("#lobby-slot-2 .lobby-slot");
        await expect(fourth).toBeVisible();
        await snap(
          page,
          info,
          `poster-invite-party-${size.width}x${size.height}`,
        );
        const party = await page.evaluate(() => {
          const rect = (sel: string) => {
            const r = document.querySelector(sel)!.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom };
          };
          const seat = document.querySelector<HTMLElement>(
            "#lobby-slot-2 .lobby-slot",
          )!;
          return {
            size: seat.offsetWidth,
            seat: rect("#lobby-slot-2 .lobby-slot"),
            bar: rect("#lobby-party-bar"),
            below: rect("#lobby-slot-1 .lobby-member"),
          };
        });
        expect(party.size, JSON.stringify(party)).toBeGreaterThanOrEqual(44);
        expect(party.seat.top, JSON.stringify(party)).toBeGreaterThanOrEqual(
          party.bar.bottom,
        );
        expect(party.seat.bottom, JSON.stringify(party)).toBeLessThanOrEqual(
          party.below.top,
        );
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

// One chrome for every fighter (owner, 27 Nov 2026): cream, ink, gold and
// red. The Lobby fighter's element colour shows only on the fighter's own
// things: the Lobby's field, the name plate and the seats take it
// (--fighter, written on the Lobby and not on the root: ui-theme.ts); the
// switch, the rail, PLAY and a masthead stay as they are when the fighter
// changes. (The chrome used to be the fighter's colour: with Voltkit the
// whole game was yellow.)
test("Poster: the fighter's colour stays on the fighter's things", async ({
  browser,
}, info) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await skipTour(page);
    await withPoster(page);
    const errors = await openHub(page);
    await page.evaluate(() => document.fonts.ready);
    const colours = () =>
      page.evaluate(() => {
        const paint = document.createElement("canvas").getContext("2d", {
          willReadFrequently: true,
        })!;
        paint.canvas.width = paint.canvas.height = 1;
        // Through a canvas: Poster's computed colours can be oklch().
        const rgb = (c: string) => {
          paint.clearRect(0, 0, 1, 1);
          paint.fillStyle = "#000";
          paint.fillStyle = c;
          paint.fillRect(0, 0, 1, 1);
          return Array.from(
            paint.getImageData(0, 0, 1, 1).data.slice(0, 3),
          ).join(",");
        };
        const css = (sel: string, prop: string, pseudo?: string) =>
          rgb(
            getComputedStyle(document.querySelector(sel)!, pseudo)[
              prop as "color"
            ],
          );
        const root = document.documentElement;
        return {
          // The fighter's own colour, as the Lobby's art has it.
          fighter: rgb(
            document
              .getElementById("lobby-fighter")!
              .style.getPropertyValue("--element"),
          ),
          rootInline: root.style.getPropertyValue("--el"),
          accent: rgb(getComputedStyle(root).getPropertyValue("--el").trim()),
          field: css(".lobby-layer", "backgroundColor"),
          plate: css(".lobby-name h2", "color"),
          play: css(".lobby-play-button", "color"),
          lobbySwitch: css(
            '.hub-scenes > button[aria-pressed="true"]',
            "backgroundColor",
          ),
          xp: css("body.hub-active .nav-xp > *", "backgroundColor"),
        };
      });
    const CREAM = "244,234,213",
      GOLD = "255,214,91";
    const first = await colours();
    // Nothing on the root: a custom property there restyles the whole page.
    expect(first.rootInline).toBe("");
    expect(first.accent).toBe(CREAM);
    expect(first.field).toBe(first.fighter);
    expect(first.plate).toBe(first.fighter);
    expect(first.play).toBe(GOLD);
    expect(first.lobbySwitch).toBe(CREAM);
    expect(first.xp).toBe(GOLD);
    // The next fighter: the field and the name plate follow, the chrome
    // does not.
    await page.evaluate(() =>
      document
        .querySelector<HTMLElement>('.lobby-step[data-lobby-step="1"]')!
        .click(),
    );
    await expect
      .poll(async () => (await colours()).field)
      .not.toBe(first.field);
    const next = await colours();
    expect(next.fighter).not.toBe(first.fighter);
    expect(next.field).toBe(next.fighter);
    expect(next.plate).toBe(next.fighter);
    expect({ ...next, fighter: 0, field: 0, plate: 0 }).toEqual({
      ...first,
      fighter: 0,
      field: 0,
      plate: 0,
    });
    // A screen over the Lobby: its masthead is ink, its open rail block
    // cream, its main button gold, with this fighter as with the first.
    await hubMenu(page, "fighters");
    await expect(page.locator(".roster-room, .ui-panel").last()).toBeVisible();
    // Once the screen has opened: a tap during its entrance is not taken.
    await page.waitForTimeout(700);
    // A fighter that is not the Lobby's, so its page offers SELECT.
    await page.click('[data-roster-card="tidefin"]');
    await page.click("[data-roster-details]");
    await expect(page.locator("[data-roster-select]").last()).toBeEnabled();
    await page.waitForTimeout(500);
    await page.mouse.move(420, 380);
    const panel = await page.evaluate(() => {
      const paint = document.createElement("canvas").getContext("2d", {
        willReadFrequently: true,
      })!;
      paint.canvas.width = paint.canvas.height = 1;
      const rgb = (c: string) => {
        paint.clearRect(0, 0, 1, 1);
        paint.fillStyle = "#000";
        paint.fillStyle = c;
        paint.fillRect(0, 0, 1, 1);
        return Array.from(paint.getImageData(0, 0, 1, 1).data.slice(0, 3)).join(
          ",",
        );
      };
      const bg = (el: Element, pseudo?: string) =>
        rgb(getComputedStyle(el, pseudo).backgroundColor);
      return {
        rail: bg(
          document.querySelector('.lobby-rail [data-lobby-action="fighters"]')!,
          "::before",
        ),
        select: bg(
          [...document.querySelectorAll("[data-roster-select]")].pop()!,
          "::before",
        ),
        tab: bg(
          document.querySelector(
            '.ui-split-main > .ui-tabs > button[aria-selected="true"]',
          )!,
        ),
      };
    });
    expect(panel.rail).toBe(CREAM);
    expect(panel.select).toBe(GOLD);
    expect(panel.tab).toBe(CREAM);
    await snap(page, info, "poster-fixed-chrome-844x390");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
