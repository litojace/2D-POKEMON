import { expect, test, type Page } from "@playwright/test";
import { box, inside, openLobby, snap } from "./helpers";
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
async function centred(page: Page, selector: string, label: string) {
  const ink = await inkOffset(page, page.locator(selector).first());
  expect(
    Math.abs(ink.dx),
    `${label}: ink ${ink.dx},${ink.dy} px off centre`,
  ).toBeLessThanOrEqual(1);
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
      await expect(room.locator(".rh-pick")).toHaveCount(3);
      await settle(page);
      const art = room.locator(".rh-hero img");
      expect(
        await art.evaluate((i: HTMLImageElement) => i.naturalWidth),
      ).toBeGreaterThanOrEqual(1200);
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
