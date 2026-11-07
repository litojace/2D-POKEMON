import { expect, test, type Page } from "@playwright/test";
import { box, inside, openLobby, snap } from "./helpers";
import { bossFraming } from "./raid-frames";
import { clippedFrames } from "./ui-checks";
import { raidPerksOf } from "../../packages/shared/src/raid";
import {
  ISLAND,
  closeSpot,
  inkOffset,
  layoutProblems,
  setInsets,
} from "./ui-measure";

// UI remodel step 5 (docs/ui-remodel/PLAN.md): the Raid Hall and a boss's
// page, a panel inside the Lobby. Measured at the four review sizes with the
// shared layout rules (ui-measure.ts); labels are checked for centring on
// the pixels.
const SIZES = [
  // A tall desktop window (the owner's, 4 Nov): the whole boss picture and
  // a filled Party tab.
  { name: "1720x1392", width: 1720, height: 1392, phone: false },
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
const ME = "11111111-1111-4111-8111-111111111111";
const PAL = "33333333-3333-4333-8333-333333333333";
const iso = (minAgo: number) =>
  new Date(Date.now() - minAgo * 60000).toISOString();
export const RAIDS = {
  clears: 4,
  highestPeril: 3,
  totalClears: 4,
  bosses: {
    grumblecrag: { clears: 3, highestPeril: 3 },
    emberwing: { clears: 1, highestPeril: 3 },
  },
  titles: ["Cragbreaker"],
  cosmetics: ["mountainborn"],
  earned: ["cragbreaker", "mountainborn"],
  weekly: [],
  loadout: {},
};
export const FRIENDS = {
  code: "a1b2c3d4",
  friends: [
    {
      id: "f1",
      name: "Kai",
      online: true,
      activity: "lobby",
      fighter: "cindrake",
      lastOnline: iso(0),
    },
    {
      id: "f2",
      name: "Mina",
      online: true,
      activity: "match",
      room: "ROOM42",
      fighter: "lumoth",
      lastOnline: iso(0),
    },
    {
      id: "f3",
      name: "Rae",
      online: true,
      activity: "town",
      fighter: "tidefin",
      lastOnline: iso(0),
    },
    {
      id: "f4",
      name: "Juniper",
      online: false,
      fighter: "terradon",
      lastOnline: iso(95),
    },
  ],
  incoming: [],
  outgoing: [],
};
export async function withRaids(page: Page, raids: unknown = RAIDS) {
  await page.addInitScript(
    ({ raids, friends }) => {
      const w = window as any;
      w.__raids = raids;
      w.__friends = friends;
    },
    { raids, friends: FRIENDS },
  );
}
/** Wait for the boss art and the fighters' portraits to be drawn. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(
        document.querySelectorAll<HTMLImageElement>(".rh-room img"),
      ).map((i) => i.decode().catch(() => {})),
    );
  });
  await page.waitForTimeout(400);
}
async function centred(
  page: Page,
  selector: string,
  label: string,
  o: { across?: boolean } = {},
) {
  const target = page.locator(selector).first();
  const ink = await inkOffset(page, target);
  // Measured within the borders: a tab's 3 px underline (its bottom border)
  // is not part of the space its label is centred in. Its label sits midway
  // between the top and the underline, and against the whole box it read
  // 1-1.5 px high (1.5 with CI's fonts). Even borders change nothing.
  ink.dy += await target.evaluate((e) => {
    const cs = getComputedStyle(e);
    return (
      (parseFloat(cs.borderBottomWidth) - parseFloat(cs.borderTopWidth)) / 2
    );
  });
  expect(
    Math.abs(ink.dx),
    `${label}: ink ${ink.dx},${ink.dy} px off centre`,
  ).toBeLessThanOrEqual(1);
  if (o.across) return;
  expect(
    Math.abs(ink.dy),
    `${label}: ink ${ink.dx},${ink.dy} px off centre`,
  ).toBeLessThanOrEqual(1);
}

for (const size of SIZES)
  test(`the Raid Hall and a boss page at ${size.name}`, async ({
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
      await withRaids(page);
      const errors = await openLobby(page);
      const inset = size.island ? ISLAND : undefined;
      if (inset) await setInsets(page, inset);
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      const room = page.locator(".rh-room");
      await expect(room).toHaveAttribute("data-raid-mode", "hall");
      await expect(
        page.locator('.lobby-rail [data-lobby-action="raids"]'),
      ).toHaveAttribute("aria-current", "page");
      // Seven bosses and Attack practice; the records came from the server.
      await expect(room.locator("[data-raid-card]")).toHaveCount(7);
      await expect(room.locator("[data-raid-practice-card]")).toHaveCount(1);
      await expect(
        room.locator('[data-raid-card="grumblecrag"] .ui-tag'),
      ).toHaveText("3 clears");
      await expect(
        room.locator('[data-raid-card="tidewyrm"] .ui-tag'),
      ).toHaveText("New");
      await settle(page);
      expect(await closeSpot(page)).toEqual([
        size.phone
          ? { right: 7, top: 7, size: 32 }
          : { right: 11, top: 11, size: 44 },
      ]);
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );
      await centred(
        page,
        '[data-raid-card="grumblecrag"] .ui-tag',
        "clears tag",
      );
      await centred(page, '.rh-head .ui-chip[aria-pressed="true"]', "All chip");
      await snap(page, info, `raid-hall-${size.name}`);
      // Vertical cards in an even grid (owner's note, 5 Nov): four to a
      // row, every card the same size, taller than wide; a tall screen
      // shows both rows whole.
      const cards = await room
        .locator(".rh-grid > .rh-card")
        .evaluateAll((els) =>
          els.map((e) => {
            const r = e.getBoundingClientRect();
            return {
              x: Math.round(r.left),
              w: r.width,
              h: r.height,
              b: r.bottom,
            };
          }),
        );
      expect(cards).toHaveLength(8);
      expect(new Set(cards.map((c) => c.x)).size).toBe(4);
      for (const c of cards) {
        expect(Math.abs(c.w - cards[0].w)).toBeLessThan(1);
        expect(Math.abs(c.h - cards[0].h)).toBeLessThan(1);
        expect(c.h).toBeGreaterThan(c.w * 1.1);
      }
      if (size.height > 1000) {
        const body = await box(page, ".rh-hall-body");
        expect(Math.max(...cards.map((c) => c.b))).toBeLessThanOrEqual(
          body.y + body.height + 1,
        );
      }
      // The lower cards, in sight, pass too.
      await room
        .locator(".rh-body")
        .evaluate((e) => e.scrollTo({ top: e.scrollHeight }));
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );

      // Filters: Not cleared, then three stars.
      await room.locator('[data-ui-raid-filter="open"]').click();
      await expect(room.locator("[data-raid-card]")).toHaveCount(5);
      await room.locator('[data-ui-raid-filter="3"]').click();
      await expect(room.locator("[data-raid-card]")).toHaveCount(3);
      await room.locator('[data-ui-raid-filter="all"]').click();

      // A boss page: the art on the stage, four seats, friends to invite.
      await room.locator('[data-raid-card="grumblecrag"]').click();
      await expect(room).toHaveAttribute("data-raid-mode", "boss");
      await expect(room.locator(".rh-stage-name")).toHaveText("Grumblecrag");
      await expect(room.locator(".rh-seat")).toHaveCount(4);
      await expect(room.locator(".rh-seat.is-open")).toHaveCount(3);
      await expect(room.locator('[aria-label="Invite Kai"]')).toBeEnabled();
      await expect(room.locator('[aria-label="Invite Mina"]')).toBeDisabled();
      await expect(room.locator(".rh-friend")).toHaveCount(3);
      // Every fighter with a trick against Grumblecrag.
      await expect(room.locator(".rh-pick")).toHaveCount(
        Object.keys(raidPerksOf("grumblecrag")).length,
      );
      await settle(page);
      const art = room.locator(".rh-poster img");
      expect(
        await art.evaluate((i: HTMLImageElement) => i.naturalWidth),
      ).toBeGreaterThanOrEqual(1200);
      {
        // The painting is framed vertically on the boss (owner's note,
        // 4 Nov): it fills the stage at its own shape, the boss's body in
        // the middle; a phone zooms in on its face.
        const f = await bossFraming(page);
        expect(f.covers).toBe(true);
        expect(Math.abs(f.ratio - 1536 / 1024)).toBeLessThan(0.02);
        expect(f.x).toBeGreaterThan(0.25);
        expect(f.x).toBeLessThan(0.75);
        expect(f.y).toBeGreaterThan(0.2);
        expect(f.y).toBeLessThan(0.7);
        if (size.phone) expect(f.zoom).toBeGreaterThan(1.5);
      }
      if (size.height > 1000) {
        // A tall window (the owner's, 4 Nov: its right side was mostly
        // empty): the Party tab fills most of its column, and shows all of
        // it with no scrolling. Since Next rewards left the tab (owner, 5
        // Nov; the Rewards tab has them) the seats, friends, good picks and
        // attacks fill about 70% of it.
        const fill = await room.locator(".rh-body").evaluate((b) => {
          const top = b.getBoundingClientRect().top;
          const last = b.lastElementChild!.getBoundingClientRect().bottom;
          return {
            share: (last - top) / b.clientHeight,
            scrolls: b.scrollHeight > b.clientHeight + 1,
          };
        });
        expect(fill.share).toBeGreaterThan(0.6);
        expect(fill.scrolls, "the whole Party tab in view").toBe(false);
      }
      expect(await closeSpot(page)).toEqual([
        size.phone
          ? { right: 7, top: 7, size: 32 }
          : { right: 11, top: 11, size: 44 },
      ]);
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );
      for (const label of ["Practice", "Start raid"])
        await centred(
          page,
          `.rh-room .ui-actions .ui-btn:has-text("${label}")`,
          label,
        );
      await centred(page, '.rh-room [data-ui-raid-play="solo"]', "Solo");
      // A gold button's icon is drawn in its label's colour, so icon and
      // label sit centred together (owner's note, 4 Nov).
      // On a phone's 28 px gold button the measure counts the gradient's
      // light top band as ink (its 3 px rim is too thin to skip it), so
      // only left-right is measured there; at 8x zoom label and icon sit
      // within 0.3 px of the middle both ways.
      await centred(page, '.rh-room [aria-label="Invite Kai"]', "Invite", {
        across: size.phone,
      });
      await centred(page, '.rh-room [data-ui-raid-tab="party"]', "Party tab");
      await snap(page, info, `raid-boss-${size.name}`);
      await room
        .locator(".rh-body")
        .evaluate((e) => e.scrollTo({ top: e.scrollHeight }));
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );

      // The other tabs.
      await room.locator('[data-ui-raid-tab="attacks"]').click();
      await expect(room.locator("[data-raid-attack]")).toHaveCount(6);
      await expect(
        room.locator('[data-raid-attack][aria-pressed="true"]'),
      ).toHaveCount(1);
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );
      await snap(page, info, `raid-attacks-${size.name}`);
      await room.locator('[data-ui-raid-tab="rewards"]').click();
      await expect(room.locator(".rh-reward.is-done")).toHaveCount(2);
      await settle(page);
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );
      await snap(page, info, `raid-rewards-${size.name}`);
      await room.locator('[data-ui-raid-tab="guide"]').click();
      await expect(room.locator(".rh-chapters > li")).toHaveCount(3);
      expect(await layoutProblems(page, { inset, phone: size.phone })).toEqual(
        [],
      );
      await snap(page, info, `raid-guide-${size.name}`);
      // The page never scrolls sideways.
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);

      // Back up to the hall, on the card you came from; Escape leaves.
      await room.locator("[data-raid-back]").click();
      await expect(room).toHaveAttribute("data-raid-mode", "hall");
      await expect(
        room.locator('[data-raid-card="grumblecrag"]'),
      ).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(room).toHaveCount(0);
      await expect(page.locator("#lobby-play")).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("Start raid, Practice and Invite go to the game's own calls", async ({
  page,
}) => {
  await withRaids(page);
  const errors = await openLobby(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__events = [];
    const watched = ["party-invite", "create", "select", "ready", "raid-drill"];
    w.__emit = (ev: string) => watched.includes(ev) && w.__events.push(ev);
    w.__reply = (ev: string, data: any) =>
      ev !== "party-invite"
        ? { ok: false, error: "Offline harness" }
        : data.playerId === "f1"
          ? { ok: true }
          : { ok: false, error: "Rae can't join a party right now." };
  });
  const events = () => page.evaluate(() => (window as any).__events);
  await page.click('.lobby-rail [data-lobby-action="raids"]');
  const room = page.locator(".rh-room");
  await room.locator('[data-raid-card="grumblecrag"]').click();
  // Invite: the button says Invited once the server agrees; a refusal is
  // shown with its reason and the button comes back.
  await room.locator('[aria-label="Invite Kai"]').click();
  await expect(room.locator('[aria-label="Invited Kai"]')).toBeDisabled();
  await room.locator('[aria-label="Invite Rae"]').click();
  await expect(room.locator(".rh-status")).toHaveText(
    "Rae can't join a party right now.",
  );
  await expect(room.locator('[aria-label="Invite Rae"]')).toBeEnabled();
  expect(await events()).toEqual(["party-invite", "party-invite"]);
  // An open seat leads to the invite list.
  await room.locator("[data-raid-open-seat]").first().click();
  await expect(room.locator('[aria-label="Invite Rae"]')).toBeFocused();
  // The Party tab's attack strip opens the Attacks tab on that attack.
  await room.locator('[data-ui-raid-tab="party"]').click();
  const strip = room.locator("[data-raid-attack-go]").nth(2);
  const picked = await strip.getAttribute("data-raid-attack-go");
  await strip.click();
  await expect(room.locator(`[data-raid-attack="${picked}"]`)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await room.locator('[data-ui-raid-tab="party"]').click();
  // Practice: a room, then the picked attack on its own.
  await room.locator('[data-ui-raid-tab="attacks"]').click();
  await room.locator("[data-raid-attack]").nth(1).click();
  const drill = await room
    .locator("[data-raid-attack]")
    .nth(1)
    .getAttribute("data-raid-attack");
  await expect(room.locator("[data-raid-practice]")).toHaveAttribute(
    "data-raid-practice",
    drill!,
  );
  await page.evaluate(() => {
    (window as any).__room("raid", { boss: "grumblecrag" });
    (window as any).__events = [];
  });
  await room.locator("[data-raid-practice]").click();
  await expect(room).toHaveCount(0);
  await expect
    .poll(async () => (await events()).slice(0, 3))
    .toEqual(["create", "select", "raid-drill"]);
  expect(errors).toEqual([]);
});

test("a party's leader raids with it; a member waits for the leader", async ({
  page,
}) => {
  await withRaids(page);
  const errors = await openLobby(page);
  const party = (leader: string) =>
    page.evaluate(
      ([me, pal, leader]) =>
        (window as any).__sock.fire("party", {
          code: "PARTY2",
          leader,
          members: [
            { id: me, name: "tester", character: "voltkit" },
            { id: pal, name: "Pal", character: "tidefin" },
          ],
        }),
      [ME, PAL, leader],
    );
  await party(ME);
  await page.click('.lobby-rail [data-lobby-action="raids"]');
  const room = page.locator(".rh-room");
  await room.locator('[data-raid-card="grumblecrag"]').click();
  await expect(room.locator(".rh-seat:not(.is-open)")).toHaveCount(2);
  await expect(room.locator(".rh-seat").nth(1)).toContainText("Pal");
  await expect(room.locator('[data-ui-raid-play="solo"]')).toBeDisabled();
  await expect(room.locator('[data-raid-start="party"]')).toBeEnabled();
  await expect(room.locator(".rh-foot-note")).toContainText("2 of 4 seats");
  // The leader changes: the open page follows.
  await party(PAL);
  await expect(room.locator("[data-raid-start]")).toBeDisabled();
  await expect(room.locator(".rh-foot-note")).toHaveText(
    "Your party leader starts the raid.",
  );
  expect(errors).toEqual([]);
});

test("Raids by keyboard, with reduced motion and Low graphics", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
    await withRaids(page);
    const errors = await openLobby(page);
    await page.click('.lobby-rail [data-lobby-action="raids"]');
    const room = page.locator(".rh-room");
    await expect(room).toHaveAttribute("data-graphics", "low");
    // Focus starts on the first card; arrows move across the grid.
    await expect(room.locator('[data-raid-card="grumblecrag"]')).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(room.locator('[data-raid-card="tidewyrm"]')).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter");
    await expect(room).toHaveAttribute("data-raid-mode", "boss");
    // Tabs follow the arrows.
    await expect(room.locator('[data-ui-raid-tab="party"]')).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(room.locator('[data-ui-raid-tab="attacks"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Nothing moves: no running animations inside the panel.
    expect(
      await room.evaluate(
        (el) =>
          el
            .getAnimations({ subtree: true })
            .filter((a) => a.playState === "running").length,
      ),
    ).toBe(0);
    expect(
      await room.evaluate(
        (el) =>
          getComputedStyle(el.querySelector(".ui-split-main")!).backdropFilter,
      ),
    ).toBe("none");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("phones the size of an iPhone SE keep the boss page's actions in reach", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 568, height: 320 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await withRaids(page);
    const errors = await openLobby(page);
    await page.click('.lobby-rail [data-lobby-action="raids"]');
    const room = page.locator(".rh-room");
    await room.locator('[data-raid-card="grumblecrag"]').click();
    const main = await box(page, ".rh-room .ui-split-main");
    for (const sel of [
      "[data-raid-start]",
      "[data-raid-practice]",
      '[data-ui-raid-play="party"]',
    ])
      expect(inside(await box(page, sel), main)).toBe(true);
    // The HUD at this width is the Lobby's (its own spec); the panel's rules hold.
    expect(
      (await layoutProblems(page, { phone: true })).filter(
        (p) => !/^(scenes|coins|leaves|profile|settings)\b/.test(p),
      ),
    ).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

/* Pictures on a boss's Rewards tab are whole (the reward boxes clip): a
   frame keeps its ornaments (drawn to the box's edge it loses a crown, a
   tassel, leaves), and a skin or colors shows the whole fighter. Every boss,
   with no stars and with every frame's stars earned. */
const STARRED = {
  ...RAIDS,
  bosses: Object.fromEntries(
    [
      "grumblecrag",
      "emberwing",
      "tidewyrm",
      "gloomshade",
      "somnara",
      "prismatail",
      "storm-twins",
    ].map((id) => [id, { clears: 100, highestPeril: 3 }]),
  ),
};
for (const size of [SIZES[1], SIZES[4]])
  for (const [label, raids] of [
    ["no stars", { ...RAIDS, bosses: {} }],
    ["every star", STARRED],
  ] as const)
    test(`every boss's reward pictures fit their boxes at ${size.name}, ${label}`, async ({
      browser,
    }) => {
      test.setTimeout(150_000);
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.phone,
        hasTouch: size.phone,
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage();
        await withRaids(page, raids);
        const errors = await openLobby(page);
        if (size.island) await setInsets(page, ISLAND);
        await page.click('.lobby-rail [data-lobby-action="raids"]');
        const room = page.locator(".rh-room");
        await expect(room.locator("[data-raid-card]")).toHaveCount(7);
        const bosses = await room
          .locator("[data-raid-card]")
          .evaluateAll((cards) =>
            cards.map((c) => (c as HTMLElement).dataset.raidCard!),
          );
        const bad: string[] = [];
        let frames = 0;
        for (const boss of bosses) {
          await page.click(`.rh-room [data-raid-card="${boss}"]`);
          await room.locator('[data-ui-raid-tab="rewards"]').click();
          await expect(room.locator(".rh-rewards.is-all")).toBeVisible();
          const r = await clippedFrames(
            page,
            ".rh-room .rh-reward-art:has(> [data-frame-stars])",
          );
          frames += r.count;
          bad.push(...r.bad.map((b) => `${boss}: ${b}`));
          // Skins, colors, auras, entrances and finales: the picture and
          // what is drawn in it are the box's size, not a fighter's 84 px
          // shown through a smaller window.
          bad.push(
            ...(
              await room.locator(".rh-reward-art").evaluateAll((arts) =>
                arts.flatMap((art) => {
                  const box = art.getBoundingClientRect();
                  return Array.from(
                    art.querySelectorAll<HTMLElement>(
                      ":scope > *, :scope > .raid-cosmetic-preview > :is(svg, img, canvas)",
                    ),
                  )
                    .filter((e) => {
                      const r = e.getBoundingClientRect();
                      return (
                        r.width > box.width + 0.5 || r.height > box.height + 0.5
                      );
                    })
                    .map(
                      (e) =>
                        `${art.closest("[data-raid-reward]")?.getAttribute("data-raid-reward")}: ${e.tagName.toLowerCase()} ${Math.round(e.getBoundingClientRect().width)} px in a ${Math.round(box.width)} px box`,
                    );
                }),
              )
            ).map((b) => `${boss}: ${b}`),
          );
          await room.locator("[data-raid-back]").click();
          await expect(room).toHaveAttribute("data-raid-mode", "hall");
        }
        // Each boss gives a frame.
        expect(frames).toBeGreaterThanOrEqual(7);
        expect(bad).toEqual([]);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
