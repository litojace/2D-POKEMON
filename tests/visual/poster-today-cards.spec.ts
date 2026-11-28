import { expect, test, type Page } from "@playwright/test";
import { openHub, skipTour } from "./helpers";
import { onPlayersLook } from "./players-look";
import { ISLAND, setInsets } from "./ui-measure";

onPlayersLook();

// The Lobby's Today cards in Poster (owner, 27 Nov 2026: "A, the sticker,
// with the motion pack"; themes/poster/lobby.css):
// - each card but the Spire's wears a sticker on its top right corner, on
//   screen and clear of the card's words and of the top bar;
// - today's six missions are six pips, and with all six done the card is
//   gold and says so (rewards are paid as each is done: nothing to claim);
// - the cards keep their place: every word reads in full and the column
//   ends above PLAY at each size;
// - the entrance, the bars' fill and the stickers' pop play once, and not
//   at all with Reduce motion or on Low graphics.

const today = new Date().toISOString().slice(0, 10);
const missions = (done: number) =>
  [
    ["play-2", "easy", "Play 2 matches", 2, 2, 40],
    ["skills-30", "easy", "Use 30 skills", 18, 30, 40],
    ["win-1", "medium", "Win a match", 1, 1, 70],
    ["pvp-wins-2", "medium", "Win 2 matches against players", 0, 2, 70],
    ["hard-bots-3", "hard", "Beat 3 Hard bots", 1, 3, 120],
    ["raid-flawless", "hard", "Clear a raid with no downs", 0, 1, 120],
  ].map(([id, tier, text, progress, target, coins], slot) => ({
    day: today,
    slot,
    id,
    tier,
    text,
    progress,
    target,
    coins,
    done: slot < done,
  }));
const stage = (page: Page, done: number) =>
  page.addInitScript((list) => {
    const w = window as any;
    w.__missions = list;
    w.__serverTime = Date.parse("2026-10-18T04:30:00Z");
  }, missions(done));

const look = (page: Page) =>
  page.evaluate(() => {
    const box = (r: DOMRect) => ({
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
    });
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(".lobby-cards > .lobby-card"),
    ).filter((c) => c.getBoundingClientRect().height > 0);
    const bar = Array.from(
      document.querySelectorAll<HTMLElement>(
        "#account-profile, .chat-button, .hub-coins, .header-menu > summary, #home-settings",
      ),
    )
      .filter((e) => e.getBoundingClientRect().height > 0)
      .map((e) => box(e.getBoundingClientRect()));
    return {
      width: innerWidth,
      limit: document.querySelector(".lobby-play")!.getBoundingClientRect().top,
      bar,
      cards: cards.map((card) => {
        const r = card.getBoundingClientRect();
        const s = getComputedStyle(card, "::before");
        const shown = s.display !== "none" && s.content !== "none";
        // The sticker's box, from its offsets on the card's border box
        // (its tilt adds about 2 px, allowed for below).
        const size = parseFloat(s.width);
        const right = r.right - parseFloat(s.right) - 3;
        const top = r.top + parseFloat(s.top) + 3;
        const words = Array.from(
          card.querySelectorAll<HTMLElement>("b, small, .lobby-card-kicker"),
        ).filter((e) => e.getBoundingClientRect().height > 0);
        return {
          id: card.id,
          classes: card.className,
          box: box(r),
          background: getComputedStyle(card).backgroundColor,
          sticker: shown
            ? {
                left: right - size,
                top,
                right,
                bottom: top + size,
                picture: s.backgroundImage.startsWith("url("),
              }
            : null,
          cut: words
            .filter((e) => e.scrollWidth > e.clientWidth + 1)
            .map((e) => e.textContent),
          words: words.map((e) => ({
            text: e.textContent,
            ...box(e.getBoundingClientRect()),
          })),
          title: card.querySelector("b")?.textContent ?? "",
          animations: [
            getComputedStyle(card).animationName,
            s.animationName,
            ...Array.from(card.querySelectorAll("progress, .guide-dots")).map(
              (e) => getComputedStyle(e).animationName,
            ),
          ],
          endless: [getComputedStyle(card), s].some(
            (c) => c.animationIterationCount === "infinite",
          ),
          pips: Array.from(card.querySelectorAll("progress")).map((p) => {
            const c = getComputedStyle(p);
            return (c.maskImage || c.webkitMaskImage || "none") !== "none";
          }),
        };
      }),
    };
  });
const overlap = (
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
  slack = 0,
) =>
  a.left < b.right - slack &&
  a.right > b.left + slack &&
  a.top < b.bottom - slack &&
  a.bottom > b.top + slack;

for (const view of [
  { name: "667x375", width: 667, height: 375, phone: true, island: false },
  { name: "844x390", width: 844, height: 390, phone: true, island: false },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    phone: true,
    island: true,
  },
  { name: "1440x900", width: 1440, height: 900, phone: false, island: false },
])
  test(`Poster: the Today cards wear their stickers, read in full and end above PLAY (${view.name})`, async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    for (const done of [4, 6]) {
      const context = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        isMobile: view.phone,
        hasTouch: view.phone,
      });
      try {
        const page = await context.newPage();
        await skipTour(page);
        await stage(page, done);
        const errors = await openHub(page);
        if (view.island) await setInsets(page, ISLAND);
        // Past the entrance (the last card starts 0.33 s in).
        await page.waitForTimeout(1_500);
        const s = await look(page);
        const journey = s.cards.find((c) => c.id === "lobby-journey-card")!;
        const day = s.cards.find((c) => c.id === "lobby-missions-card")!;
        expect(journey, "the Journey card shows").toBeTruthy();
        expect(day, "the Missions card shows").toBeTruthy();
        for (const card of s.cards) {
          const where = `${card.id}, ${done} done`;
          expect(card.cut, where).toEqual([]);
          expect(card.box.bottom, where).toBeLessThanOrEqual(s.limit - 8);
          expect(card.endless, where).toBe(false);
          if (!card.sticker) continue;
          expect(card.sticker.picture, where).toBe(true);
          // On screen (its tilt and hard shadow take 4 px more).
          expect(card.sticker.right + 4, where).toBeLessThanOrEqual(s.width);
          expect(card.sticker.top - 2, where).toBeGreaterThanOrEqual(0);
          // Clear of the card's words and of the top bar's buttons.
          for (const word of card.words)
            expect(
              overlap(card.sticker, word, 2),
              `${where}: the sticker over "${word.text}"`,
            ).toBe(false);
          for (const button of s.bar)
            expect(overlap(card.sticker, button), where).toBe(false);
        }
        // Six missions, six pips.
        expect(day.pips).toEqual([true]);
        expect(journey.pips).toEqual([false]);
        if (done === 6) {
          expect(day.classes).toContain("is-complete");
          expect(day.title).toBe("All 6 done");
          expect(day.background).not.toBe(journey.background);
        } else {
          expect(day.classes).not.toContain("is-complete");
          expect(day.title).toBe("4 / 6 done");
        }
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });

test("Poster: the Today cards' entrance plays once, and not with Reduce motion or on Low graphics", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  for (const [name, options, graphics] of [
    ["normal", {}, "high"],
    ["reduced motion", { reducedMotion: "reduce" as const }, "high"],
    ["low graphics", {}, "low"],
  ] as const) {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
      ...options,
    });
    try {
      const page = await context.newPage();
      await skipTour(page);
      await stage(page, 4);
      await page.addInitScript(
        (g) => localStorage.setItem("ea-graphics", g),
        graphics,
      );
      await openHub(page);
      const s = await look(page);
      const names = s.cards.flatMap((c) => c.animations);
      if (name === "normal") {
        expect(names).toContain("poster-card-in");
        expect(names).toContain("poster-card-pop");
        expect(names).toContain("poster-card-fill");
        // And then they are over: nothing of the cards still runs.
        await page.waitForTimeout(1_800);
        const running = await page.evaluate(
          () =>
            document
              .getAnimations()
              .filter(
                (a) =>
                  a.playState === "running" &&
                  ((a as CSSAnimation).animationName ?? "").startsWith(
                    "poster-card-",
                  ),
              ).length,
        );
        expect(running).toBe(0);
      } else {
        expect(new Set(names), name).toEqual(new Set(["none"]));
      }
      expect(s.cards.some((c) => c.endless)).toBe(false);
    } finally {
      await context.close();
    }
  }
});

// The Spire's card stands apart (owner, 27 Nov 2026; the coordinator chose
// "all three" for them on 28 Nov): ink among the cream cards with the tower
// breaking out of its frame, the next title within reach as its headline
// with the floors to it as a ladder, and a NEW tag with a glint only while
// a zone is new. Nothing in the column ends in "…", the mode's hint
// included, down to 667x375.
const SPIRE_RAIDS = {
  clears: 1,
  highestPeril: 1,
  bestSeconds: 200,
  titles: [],
  cosmetics: [],
  earned: [],
  bosses: {
    grumblecrag: { clears: 1, highestPeril: 1, bestSeconds: 200, runs: 1 },
  },
};
const climb = (highestFloor: number, checkpoint: number) => ({
  season: 0,
  highestFloor,
  checkpoint,
  attempts: 3,
  claimed: Array.from({ length: highestFloor }, (_, i) => i + 1),
  clears: { grumblecrag: 1 },
});
for (const view of [
  { name: "667x375", width: 667, height: 375 },
  { name: "844x390", width: 844, height: 390 },
])
  test(`Poster: the Spire's card is ink with its ladder, NEW and a glint only on news, and nothing is cut (${view.name})`, async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    for (const news of [false, true]) {
      const context = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        isMobile: true,
        hasTouch: true,
      });
      try {
        const page = await context.newPage();
        await skipTour(page);
        await page.addInitScript(
          ([raids, spire]) => {
            const w = window as any;
            w.__raids = raids;
            w.__spire = spire;
          },
          [SPIRE_RAIDS, news ? climb(10, 11) : climb(9, 6)] as const,
        );
        if (!news)
          await page.addInitScript(() => {
            const real = Storage.prototype.getItem;
            Storage.prototype.getItem = function (key: string) {
              if (key.startsWith("arena-spire-seen:")) return '["s0-z1"]';
              return real.call(this, key);
            };
          });
        const errors = await openHub(page);
        await page.waitForTimeout(1_500);
        const s = await page.evaluate(() => {
          const card = document.getElementById("lobby-spire-card")!;
          const journey = document.getElementById("lobby-journey-card")!;
          const tag = getComputedStyle(card, "::before");
          const canvas = document.createElement("canvas").getContext("2d")!;
          const rgb = (colour: string) => {
            canvas.clearRect(0, 0, 1, 1);
            canvas.fillStyle = colour;
            canvas.fillRect(0, 0, 1, 1);
            return Array.from(canvas.getImageData(0, 0, 1, 1).data.slice(0, 3));
          };
          const small = card.querySelector<HTMLElement>("small")!;
          const hint = document.querySelector<HTMLElement>(
            "#lobby-mode .lobby-mode-text small",
          )!;
          const lines = Array.from(
            document.querySelectorAll<HTMLElement>(
              ".lobby-cards > .lobby-card b, .lobby-cards > .lobby-card small, .lobby-cards > .lobby-card .lobby-card-kicker",
            ),
          ).filter((e) => e.getBoundingClientRect().height > 0);
          return {
            shown: card.getBoundingClientRect().height > 0,
            isNew: card.classList.contains("is-new"),
            background: rgb(getComputedStyle(card).backgroundColor),
            journeyBackground: rgb(getComputedStyle(journey).backgroundColor),
            title: card.querySelector("b")!.textContent,
            note: small.textContent,
            noteSize: parseFloat(getComputedStyle(small).fontSize),
            noteShown: small.getBoundingClientRect().height > 0,
            steps: Array.from(
              card.querySelectorAll(".lobby-spire-ladder i"),
              (i) => i.className,
            ),
            tag: tag.display === "none" ? null : tag.content,
            art: card.querySelector(".lobby-spire-art")!.getBoundingClientRect()
              .top,
            top: card.getBoundingClientRect().top,
            journeyBottom: journey.getBoundingClientRect().bottom,
            cut: [...lines, hint]
              .filter((e) => e.scrollWidth > e.clientWidth + 1)
              .map((e) => e.textContent),
            bottom: card.getBoundingClientRect().bottom,
            limit: document
              .querySelector(".lobby-play")!
              .getBoundingClientRect().top,
          };
        });
        const where = news ? "news" : "an ordinary day";
        expect(s.shown, where).toBe(true);
        expect(s.isNew, where).toBe(news);
        // Ink, where the Journey's card is cream.
        expect(s.background, where).toEqual([13, 13, 15]);
        expect(s.journeyBackground, where).toEqual([244, 234, 213]);
        expect(s.noteShown, where).toBe(true);
        expect(s.noteSize, where).toBeGreaterThanOrEqual(11);
        if (news) {
          expect(s.title).toBe("Zone 2 is open");
          expect(s.note).toBe("Floor 20 → new title");
          expect(s.steps).toEqual([...Array(9).fill(""), "is-goal"]);
          expect(s.tag).toBe('"NEW"');
        } else {
          expect(s.title).toBe("Floor 10 → title");
          expect(s.note).toBe("1 floor to go · best 9");
          expect(s.steps).toEqual([
            "is-done",
            "is-done",
            "is-done",
            "is-done",
            "is-goal",
          ]);
          expect(s.tag).toBeNull();
        }
        // The tower breaks out of the card's top, short of the card above.
        expect(s.art, where).toBeLessThan(s.top - 4);
        expect(s.art, where).toBeGreaterThanOrEqual(s.journeyBottom);
        expect(s.cut, where).toEqual([]);
        expect(s.bottom, where).toBeLessThanOrEqual(s.limit - 8);
        // The glint: on news it comes within a period; never otherwise.
        const glinting = () =>
          page.evaluate(() =>
            document
              .getElementById("lobby-spire-card")!
              .classList.contains("is-glinting"),
          );
        if (news)
          await expect
            .poll(glinting, { timeout: 8_000, intervals: [50] })
            .toBe(true);
        else {
          await page.evaluate(() => {
            const card = document.getElementById("lobby-spire-card")!;
            (window as any).__spireGlints = 0;
            new MutationObserver(() => {
              if (card.classList.contains("is-glinting"))
                (window as any).__spireGlints++;
            }).observe(card, { attributes: true, attributeFilter: ["class"] });
          });
          await page.waitForTimeout(6_500);
          expect(await page.evaluate(() => (window as any).__spireGlints)).toBe(
            0,
          );
        }
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });
