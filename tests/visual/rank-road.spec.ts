import { expect, test, type Page } from "@playwright/test";
import { openLobby, skipTour, snap } from "./helpers";
import { centred, rowsEven, settled, spills } from "./ui-checks";
import { ISLAND, layoutProblems, setInsets } from "./ui-measure";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

// The rank road (docs/rank-road.md): Ranks opens on the road (seven tiers
// of three steps, each tier's reward, yours lit), and your rank is always
// on the Lobby, a chip beside your fighter's element. Looked at on the
// small phones first, box by box.
const ME = "11111111-1111-4111-8111-111111111111";
const LEAD = "44444444-4444-4444-8444-444444444444";
const SIZES = [
  { name: "667x375", width: 667, height: 375, phone: true },
  { name: "844x390", width: 844, height: 390, phone: true },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    phone: true,
    island: true,
  },
  { name: "1440x900", width: 1440, height: 900, phone: false },
];
type Size = (typeof SIZES)[number];
const TEMPEST = {
  rating: 1218,
  matches: 62,
  peak: 1240,
  rank: "Tempest III",
  placementLeft: 0,
  next: { name: "Tempest II", at: 1250 },
  shield: true,
};
/** Total XP at the start of a level (packages/shared/src/journey.ts). */
const XP = { 1: 0, 6: 750 } as const;
async function player(
  page: Page,
  o: { rating?: object; level?: keyof typeof XP; titles?: string[] } = {},
) {
  await skipTour(page);
  await page.addInitScript(
    ({ rating, xp, titles, me }) => {
      const w = window as any;
      w.__progress = {
        matches: 62,
        wins: 36,
        fighters: { voltkit: { matches: 31, wins: 20 } },
        achievements: [],
        season: { id: "2026-11", matches: 0, wins: 0 },
        rating,
      };
      w.__board = {
        season: "2026-11",
        rows: [],
        unranked: [],
        me: { rank: 23, wins: 36, matches: 62 },
        rating,
      };
      w.__accountPatch = {
        title: null,
        titleColor: null,
        ownedTitles: titles.map((name: string, i: number) => ({
          id: `22222222-2222-4222-8222-22222222223${i}`,
          name,
          description: "",
          color: "#ffffff",
          active: true,
        })),
      };
      if (xp !== null)
        w.__economyPatch = {
          journey: {
            xp,
            recent: [],
            season: {
              id: "2026-11",
              xp: 0,
              week: "2026-W48",
              goals: {},
              completed: [],
            },
            unlocked: [],
          },
        };
      try {
        // No "Unlocked" dialog over the Lobby.
        localStorage.setItem(`arena-unlocks:${me}`, "99");
      } catch {
        /* No storage. */
      }
    },
    {
      rating: o.rating ?? TEMPEST,
      xp: o.level ? XP[o.level] : null,
      titles: o.titles ?? [],
      me: ME,
    },
  );
}
const page0 = async (
  browser: import("@playwright/test").Browser,
  size: Size,
) => {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    isMobile: size.phone,
    hasTouch: size.phone,
  });
  return { context, page: await context.newPage() };
};
type Box = { left: number; right: number; top: number; bottom: number };
const box = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((e): Box => {
      const r = e.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    });

for (const size of SIZES)
  test(`the road: seven tiers, their rewards and where you stand at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const { context, page } = await page0(browser, size);
    try {
      // Tempest III with a shield; Prism reached once before (its title).
      await player(page, {
        titles: ["Sprout", "Spark", "Flare", "Tempest", "Prism", "Pupil"],
      });
      const errors = await openLobby(page);
      if (size.island) await setInsets(page, ISLAND);
      await page.click('.lobby-rail [data-lobby-action="ranks"]');
      const panel = page.locator(".ranks-panel");
      await expect(panel).toBeVisible();
      await expect(panel.locator('[data-ui-scope="road"]')).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      // Highest first; yours lit, with your step.
      await expect(panel.locator(".rk-tier-name > b")).toHaveText([
        "Legend",
        "Nova",
        "Prism",
        "Tempest",
        "Flare",
        "Spark",
        "Sprout",
      ]);
      const mine = panel.locator(".rk-tier.is-cur");
      await expect(mine).toHaveCount(1);
      await expect(mine.locator(".rk-tier-name > b")).toHaveText("Tempest");
      await expect(mine.locator(".ui-tag")).toHaveText("You");
      await expect(mine.locator(".rk-steps > i.is-you > b")).toHaveText("III");
      // A wide screen writes each step's rating in it; a phone has the
      // tier's first rating in its own column instead.
      const stepRating = mine.locator(".rk-steps > i.is-you > small");
      if (size.phone) {
        await expect(stepRating).toBeHidden();
        await expect(mine.locator("> .rk-from")).toHaveText("1,210");
      } else {
        await expect(stepRating).toHaveText("1,210");
        await expect(mine.locator("> .rk-from")).toBeHidden();
      }
      await expect(mine.locator(".rk-steps > i.is-on")).toHaveCount(1);
      // Every step under you is lit; none above.
      await expect(panel.locator(".rk-steps > i.is-on")).toHaveCount(1 + 9);
      // Earned: your tier and those under it, and Prism from its title.
      await expect(
        panel.locator(".rk-tier.is-earned .rk-tier-name > b"),
      ).toHaveText(["Prism", "Tempest", "Flare", "Spark", "Sprout"]);
      await expect(panel.locator('.rk-got[aria-label="Earned"]')).toHaveCount(
        5,
      );
      // Each tier's coins; the first gives its title alone.
      await expect(panel.locator(".rk-reward .ui-price")).toHaveText([
        /^1,000/,
        /^600/,
        /^400/,
        /^250/,
        /^150/,
        /^100/,
      ]);
      await expect(
        panel.locator(".rk-tier").last().locator(".rk-reward-title"),
      ).toBeVisible();
      // Your card: the rank, the way to the next, the shield in hand.
      await expect(panel.locator(".rk-rank")).toHaveText("Tempest III");
      await expect(panel.locator(".rk-line")).toHaveText(
        "32 more for Tempest II · best 1,240",
      );
      // The shield in hand; a wide card also says what it does.
      await expect(panel.locator(".rk-shield")).toContainText("Shield ready");
      const more = panel.locator(".rk-shield-more");
      if (size.phone) await expect(more).toBeHidden();
      else await expect(more).toHaveText("· holds one loss");
      await settled(page, ".ranks-panel");
      expect(
        await layoutProblems(page, {
          inset: size.island ? ISLAND : undefined,
          phone: size.phone,
        }),
      ).toEqual([]);
      expect(await spills(page, ".ranks-panel")).toEqual([]);

      // The whole road and the whole card show: nothing to scroll for.
      const fits = await page.evaluate(() =>
        [".rk-road-list", ".rk-card"].map((s) => {
          const e = document.querySelector<HTMLElement>(s)!;
          return [s, e.scrollHeight - e.clientHeight] as const;
        }),
      );
      for (const [name, over] of fits)
        expect(over, `${name} scrolls by ${over} px`).toBeLessThanOrEqual(1);

      // Rows: one height, one left edge; each column on one line.
      const rows = await rowsEven(page, ".rk-tier");
      expect(rows.lefts, "rows' left edges").toHaveLength(1);
      expect(rows.heights, "rows' heights").toHaveLength(1);
      const cols = await page.evaluate(() => {
        const edges = (sel: string, side: "left" | "right") =>
          new Set(
            Array.from(document.querySelectorAll(sel))
              .filter((e) => (e as HTMLElement).offsetParent)
              .map((e) => Math.round(e.getBoundingClientRect()[side])),
          ).size;
        const mid = (e: Element) => {
          const r = e.getBoundingClientRect();
          return Math.round((r.left + r.right) / 2);
        };
        const right = (sel: string) =>
          Math.round(
            document.querySelector(sel)!.getBoundingClientRect().right,
          );
        const rail = Array.from(document.querySelectorAll(".rk-tier")).map(
          (li) =>
            Math.round(
              parseFloat(getComputedStyle(li, "::before").left) +
                parseFloat(getComputedStyle(li, "::before").width) / 2 +
                li.getBoundingClientRect().left,
            ),
        );
        return {
          gems: new Set(
            Array.from(document.querySelectorAll(".rk-gem")).map(mid),
          ).size,
          gemOnRail: Math.abs(
            mid(document.querySelector(".rk-gem")!) - rail[0],
          ),
          names: edges(".rk-tier-name", "left"),
          from: edges(".rk-tier > .rk-from", "right"),
          stepsLeft: edges(".rk-steps", "left"),
          stepsRight: edges(".rk-steps", "right"),
          reward: edges(".rk-reward", "right"),
          coins: edges(".rk-reward .ui-price", "right"),
          ticks: edges(".rk-got", "left"),
          headReward: right(".rk-head-reward"),
          rowReward: right(".rk-reward"),
        };
      });
      expect(cols).toMatchObject({
        gems: 1,
        names: 1,
        stepsLeft: 1,
        stepsRight: 1,
        reward: 1,
        coins: 1,
        ticks: 1,
      });
      expect(cols.from).toBe(size.phone ? 1 : 0);
      expect(cols.gemOnRail, "gems sit on the rail").toBeLessThanOrEqual(1);
      expect(cols.headReward).toBe(cols.rowReward);
      // A name (with its You tag) keeps clear of the column after it.
      const name = await box(page, ".rk-tier.is-cur .ui-tag");
      const after = await box(
        page,
        size.phone
          ? ".rk-tier.is-cur > .rk-from"
          : ".rk-tier.is-cur > .rk-steps",
      );
      expect(name.right).toBeLessThanOrEqual(after.left);
      // Centred in their boxes: a step's numeral, the You tag, a tick.
      await centred(page, '[data-ui-scope="road"]', "Road");
      await centred(page, ".rk-tier.is-cur .rk-steps > i.is-you", "your step");
      await centred(page, ".rk-tier:last-child .rk-steps > i", "a step");
      await centred(page, ".rk-tier.is-cur .ui-tag", "You tag");
      if (!size.phone)
        await centred(page, ".rk-rules > summary", "How ranks work");
      // Your rank's card: a flat ink block with a thick top edge in the
      // tier's colour, not a wash of it (themes/poster/ranks-card.css).
      expect(
        await page.locator(".rk-card").evaluate((card) => {
          const c = getComputedStyle(card);
          const probe = document.createElement("i");
          probe.style.color = "var(--rank)";
          card.append(probe);
          const tier = getComputedStyle(probe).color;
          probe.remove();
          return {
            wash: c.backgroundImage,
            fill: c.backgroundColor,
            edge: c.borderTopColor === tier && c.borderTopWidth === "6px",
          };
        }),
      ).toEqual({ wash: "none", fill: "rgb(30, 30, 34)", edge: true });
      await snap(page, info, `rank-road-${size.name}`);

      // The boards are one tap away, and the road comes back.
      await page.click('[data-ui-scope="everyone"]');
      await expect(panel.locator(".rk-pin .rk-row")).toBeVisible();
      await expect(panel.locator(".rk-tier")).toHaveCount(0);
      await page.click('[data-ui-scope="road"]');
      await expect(panel.locator(".rk-tier")).toHaveCount(7);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("the road before a rank: nobody stands on it while placing", async ({
  browser,
}, info) => {
  const { context, page } = await page0(browser, SIZES[1]);
  try {
    await player(page, {
      rating: {
        rating: 1012,
        matches: 2,
        peak: 1012,
        rank: "Unranked",
        placementLeft: 3,
        next: { name: "Spark II", at: 1035 },
        shield: false,
      },
    });
    const errors = await openLobby(page);
    await page.click('.lobby-rail [data-lobby-action="ranks"]');
    const panel = page.locator(".ranks-panel");
    await expect(panel.locator(".rk-tier")).toHaveCount(7);
    await expect(panel.locator(".rk-line")).toHaveText(
      "3 placement matches to go",
    );
    await expect(
      panel.locator(".rk-tier.is-cur, .rk-tier.is-earned"),
    ).toHaveCount(0);
    await expect(panel.locator(".rk-steps > i.is-on")).toHaveCount(0);
    await expect(panel.locator(".rk-shield")).toHaveCount(0);
    await settled(page, ".ranks-panel");
    expect(await spills(page, ".ranks-panel")).toEqual([]);
    await snap(page, info, "rank-road-placing-844x390");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

for (const size of SIZES)
  test(`the Lobby's rank chip sits beside the element pill at ${size.name}`, async ({
    browser,
  }, info) => {
    const { context, page } = await page0(browser, size);
    try {
      await player(page);
      const errors = await openLobby(page);
      if (size.island) await setInsets(page, ISLAND);
      const chip = page.locator("#lobby-rank-chip");
      await expect(chip).toBeVisible();
      await expect(chip).toHaveText("Tempest III");
      await expect(chip).toHaveAttribute(
        "aria-label",
        "Your rank: Tempest III. Shield ready",
      );
      // The shield in hand takes the gem's place.
      await expect(chip.locator(".rank-chip-shield")).toHaveCount(1);
      await expect(chip.locator(".rank-chip-gem")).toHaveCount(0);
      expect(
        await chip.evaluate((e) => getComputedStyle(e).color),
        "the tier's colour",
      ).toBe("rgb(80, 219, 233)");
      await page.evaluate(() => document.fonts.ready);
      const g = await page.evaluate(() => {
        const r = (s: string) => {
          const b = document.querySelector(s)!.getBoundingClientRect();
          return { l: b.left, r: b.right, t: b.top, b: b.bottom };
        };
        const chip = document.querySelector<HTMLElement>("#lobby-rank-chip")!;
        const steps = Array.from(document.querySelectorAll(".lobby-step")).map(
          (e) => e.getBoundingClientRect(),
        );
        return {
          chip: r("#lobby-rank-chip"),
          pill: r("#lobby-fighter-element"),
          tags: r(".lobby-name-tags"),
          name: r("#lobby-fighter-name"),
          fighter: r("#lobby-fighter"),
          left: steps[0].right,
          right: steps[1].left,
          clipped: chip.scrollWidth - chip.clientWidth,
          play: r("#lobby-play"),
        };
      });
      // One row, one height, a gap between them.
      expect(Math.abs(g.chip.t - g.pill.t)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(g.chip.b - g.pill.b)).toBeLessThanOrEqual(0.5);
      expect(g.chip.l - g.pill.r).toBeGreaterThanOrEqual(3);
      // The pair is centred under the name, on the fighter's axis.
      const mid = (b: { l: number; r: number }) => (b.l + b.r) / 2;
      expect(Math.abs(mid(g.tags) - mid(g.name))).toBeLessThanOrEqual(1);
      expect(Math.abs(mid(g.tags) - mid(g.fighter))).toBeLessThanOrEqual(1.5);
      // Clear of the ‹ › arrows, and nothing cut off.
      expect(g.tags.l).toBeGreaterThanOrEqual(g.left);
      expect(g.tags.r).toBeLessThanOrEqual(g.right);
      expect(g.clipped).toBeLessThanOrEqual(0);
      expect(g.tags.b).toBeLessThanOrEqual(size.height);
      await centred(page, "#lobby-rank-chip", "rank chip", 1.5);
      expect(
        await layoutProblems(page, {
          inset: size.island ? ISLAND : undefined,
          phone: size.phone,
        }),
      ).toEqual([]);
      await snap(page, info, `rank-chip-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("the chip while placing, before a first match, and under a leader", async ({
  browser,
}, info) => {
  test.setTimeout(120_000);
  const size = SIZES[0];
  const rating = (matches: number) => ({
    rating: 1000 + matches * 6,
    matches,
    peak: 1012,
    rank: "Unranked",
    placementLeft: 5 - matches,
    next: { name: "Spark II", at: 1035 },
    shield: false,
  });
  // Placing: how many of the five are played, in the pill's quiet colour.
  {
    const { context, page } = await page0(browser, size);
    try {
      await player(page, { rating: rating(2) });
      await openLobby(page);
      const chip = page.locator("#lobby-rank-chip");
      await expect(chip).toHaveText("Placing 2/5");
      await expect(chip.locator(".rank-chip-gem")).toHaveCount(1);
      await snap(page, info, "rank-chip-placing-667x375");
    } finally {
      await context.close();
    }
  }
  // Never met a player: "Unranked" once Ranks is open (Lv 6)...
  {
    const { context, page } = await page0(browser, size);
    try {
      await player(page, { rating: rating(0), level: 6 });
      await openLobby(page);
      await expect(page.locator("#lobby-rank-chip")).toHaveText("Unranked");
    } finally {
      await context.close();
    }
  }
  // ...and nothing for a new player, whose Lobby is about the first matches.
  {
    const { context, page } = await page0(browser, size);
    try {
      await player(page, { rating: rating(0), level: 1 });
      await openLobby(page);
      await expect(page.locator("#lobby-fighter-element")).toBeVisible();
      await expect(page.locator("#lobby-rank-chip")).toBeHidden();
      // The pill alone stays centred under the name.
      const mids = await page.evaluate(() =>
        ["#lobby-fighter-element", "#lobby-fighter-name"].map((s) => {
          const b = document.querySelector(s)!.getBoundingClientRect();
          return (b.left + b.right) / 2;
        }),
      );
      expect(Math.abs(mids[0] - mids[1])).toBeLessThanOrEqual(1);
      await snap(page, info, "rank-chip-new-player-667x375");
    } finally {
      await context.close();
    }
  }
  // In a party, the leader's fighter stands in the middle: your rank under
  // it would read as theirs, so the chip waits; leading, it stays.
  {
    const { context, page } = await page0(browser, size);
    try {
      await player(page);
      await openLobby(page);
      const chip = page.locator("#lobby-rank-chip");
      await expect(chip).toBeVisible();
      const party = (leader: string) =>
        page.evaluate(
          ([me, leader, lead]) =>
            (window as any).__sock.fire("party", {
              code: "PARTY3",
              leader,
              members: [
                { id: lead, name: "Leader", character: "tidefin" },
                { id: me, name: "tester", character: "voltkit" },
              ],
              room: null,
              invites: [],
            }),
          [ME, leader, LEAD] as const,
        );
      await party(LEAD);
      await expect(page.locator("#lobby-host-name")).toHaveText("♛ Leader");
      await expect(chip).toBeHidden();
      await snap(page, info, "rank-chip-under-leader-667x375");
      await party(ME);
      await expect(page.locator("#lobby-host-name")).toHaveText("♛ You");
      await expect(chip).toBeVisible();
      const row = await page.evaluate(() =>
        ["#lobby-host-name", "#lobby-rank-chip"].map((s) => {
          const b = document.querySelector(s)!.getBoundingClientRect();
          return [b.top + b.height / 2, b.left, b.right];
        }),
      );
      expect(Math.abs(row[0][0] - row[1][0])).toBeLessThanOrEqual(1);
      expect(row[1][1]).toBeGreaterThanOrEqual(row[0][2]);
      await snap(page, info, "rank-chip-leading-667x375");
    } finally {
      await context.close();
    }
  }
});

test("beside an open sheet on a phone the name stands alone; the chip comes back", async ({
  browser,
}) => {
  const { context, page } = await page0(browser, SIZES[0]);
  try {
    await player(page);
    const errors = await openLobby(page);
    const chip = page.locator("#lobby-rank-chip");
    await expect(chip).toBeVisible();
    await page.click('.lobby-rail [data-lobby-action="friends"]');
    await expect(page.locator(".friends-sheet")).toBeVisible();
    await expect(chip).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.locator(".friends-sheet")).toHaveCount(0);
    await expect(chip).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
