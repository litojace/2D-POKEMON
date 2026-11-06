import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import {
  boxCentred,
  centred,
  rowsEven,
  settled,
  sizes,
  spills,
} from "./ui-checks";
import { ISLAND, closeSpot, layoutProblems, setInsets } from "./ui-measure";

// UI remodel step 7 (docs/ui-remodel/PLAN.md): the player card and profile,
// a panel inside the Lobby. Measured at the five review sizes with the
// shared layout rules (ui-measure.ts) and the owner's priority: labels
// centred in their boxes on the pixels, tiles and chips of one size,
// nothing spilling out, long content scrolling.
const SIZES = [
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
type Size = (typeof SIZES)[number];
const RAIDS = {
  clears: 4,
  totalClears: 5,
  highestPeril: 3,
  bestSeconds: null,
  titles: [],
  cosmetics: [],
  weekly: [],
  bosses: {
    grumblecrag: { clears: 4, highestPeril: 3, bestSeconds: 90, runs: 6 },
    emberwing: { clears: 1, highestPeril: 3, bestSeconds: 200, runs: 2 },
  },
};
const PROGRESS = {
  matches: 9999,
  wins: 5012,
  fighters: {
    voltkit: { matches: 64, wins: 40 },
    cindrake: { matches: 31, wins: 12 },
    tidefin: { matches: 16, wins: 9 },
    lumoth: { matches: 6, wins: 2 },
  },
  achievements: [
    {
      id: "first-win",
      name: "First Victory",
      description: "Won a match.",
      earnedAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "wins-10",
      name: "Seasoned Brawler",
      description: "Won 10 matches.",
      earnedAt: "2026-10-03T00:00:00Z",
    },
    {
      id: "wins-50",
      name: "Arena Legend",
      description: "Won 50 matches.",
      earnedAt: null,
    },
    {
      id: "flawless",
      name: "Flawless",
      description: "Won a match without dropping a round.",
      earnedAt: null,
    },
    {
      id: "comeback",
      name: "Comeback Kid",
      description: "Won a match after losing the first two rounds.",
      earnedAt: null,
    },
    {
      id: "combo-artist",
      name: "Combo Artist",
      description: "Landed 5 signature combos in one match.",
      earnedAt: null,
    },
  ],
  season: { id: "2026-11", matches: 3, wins: 1 },
  rating: {
    rating: 1110,
    matches: 62,
    peak: 1140,
    rank: "Expert",
    placementLeft: 0,
    next: { name: "Candidate Master", at: 1150 },
  },
};
const TITLES = [
  ["Cragbreaker", "#d9b98a"],
  ["Expert", "#719aff"],
  ["Specialist", "#50dbe9"],
  ["Pupil", "#65d38a"],
  ["Mountain Conqueror", "#e8b06a"],
  ["First Victory", "#9ee6a8"],
  ["Seasoned Brawler", "#7fd3ff"],
].map(([name, color], i) => ({
  id: `22222222-2222-4222-8222-22222222222${i + 1}`,
  name,
  description: `How you earned ${name}.`,
  color,
  active: true,
}));

/** The account, progress and raids answers; titles equip as the server does. */
async function open(page: Page, size: Size, o: { guest?: boolean } = {}) {
  await page.addInitScript(
    ({ raids, progress, titles, guest }) => {
      const w = window as any;
      w.__raids = raids;
      w.__progress = progress;
      w.__accountPatch = {
        guest,
        title: "Cragbreaker",
        titleColor: "#d9b98a",
        ownedTitles: titles,
      };
    },
    { raids: RAIDS, progress: PROGRESS, titles: TITLES, guest: !!o.guest },
  );
  const errors = await openLobby(page);
  // Wearing a title, answered as the server does (outermost, over the
  // harness's fake API, which wraps fetch as it loads).
  await page.evaluate((titles) => {
    const w = window as any;
    w.__titleCalls = [];
    const fetch = window.fetch.bind(window);
    w.__nameCalls = [];
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      const path = new URL(url, location.href).pathname;
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      // Changing your name, answered as migration 066 does.
      if (path === "/api/account/name" && init?.method === "POST") {
        const { name } = JSON.parse(String(init?.body ?? "{}"));
        w.__nameCalls.push(name);
        if (w.__refuseName)
          return json({ error: "You can change your name again on November 20, 2026 at 03:00 UTC." }, 400);
        const now = Date.now();
        const status = { changedAt: new Date(now).toISOString(), nextAt: new Date(now + 14 * 86400e3).toISOString(), now: new Date(now).toISOString(), days: 14 };
        w.__nameStatus = status;
        w.__accountPatch = { ...w.__accountPatch, displayName: name };
        return json({ ...status, displayName: name });
      }
      if (path !== "/api/account/title") return fetch(input, init);
      const { titleId } = JSON.parse(String(init?.body ?? "{}"));
      w.__titleCalls.push(titleId ?? "");
      if (w.__refuseTitle)
        return json({ error: "That title is not yours." }, 400);
      const t = titles.find((x: any) => x.id === titleId);
      w.__accountPatch = {
        ...w.__accountPatch,
        title: t?.name ?? null,
        titleColor: t?.color ?? null,
      };
      return json({ ok: true });
    };
  }, TITLES);
  if (size.island) await setInsets(page, ISLAND);
  await page.click("#account-profile");
  const panel = page.locator(".profile-panel");
  await expect(panel).toBeVisible();
  await expect(panel.locator(".pf-tile b").first()).toHaveText("9,999");
  return { errors, panel };
}

for (const size of SIZES)
  test(`the player card and profile at ${size.name}`, async ({
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
      const { errors, panel } = await open(page, size);
      // The card: your fighter in your look, title, name, level, rank, mastery.
      const card = panel.locator(".pf-card");
      await expect(card.locator('[data-fighter="voltkit"]')).toHaveCount(1);
      await expect(card.locator(".pf-card-title")).toHaveText("Cragbreaker");
      await expect(card.locator(".pf-card-name")).toHaveText("tester");
      await expect(card.locator(".pf-card-tags")).toContainText("Lv 12");
      await expect(card.locator(".pf-card-tags")).toContainText(
        "Expert · 1,110",
      );
      await expect(card.locator(".pf-card-tags")).toContainText(
        "Crystal Voltkit",
      );
      // The numbers, the titles, every fighter, both summaries, every boss.
      await expect(panel.locator(".pf-tile b")).toHaveText([
        "9,999",
        "5,012",
        "50%",
        "5",
      ]);
      await expect(panel.locator(".pf-title-chip")).toHaveCount(
        TITLES.length + 1,
      );
      await expect(panel.locator(".pf-title-chip.is-on")).toHaveText(
        "Cragbreaker",
      );
      await expect(panel.locator(".pf-mastery-chip")).toHaveCount(16);
      await expect(panel.locator(".pf-mini")).toHaveCount(2);
      await expect(panel.locator(".pf-trophy")).toHaveCount(7);
      await expect(
        panel.locator('.pf-trophy[data-profile-boss="grumblecrag"] b'),
      ).toHaveText("4");
      await expect(panel.locator(".pf-achievements li")).toHaveCount(6);
      await settled(page, ".profile-panel");
      expect(await closeSpot(page)).toEqual([
        size.phone
          ? { right: 7, top: 7, size: 32 }
          : { right: 11, top: 11, size: 44 },
      ]);
      expect(
        await layoutProblems(page, {
          inset: size.island ? ISLAND : undefined,
          phone: size.phone,
        }),
      ).toEqual([]);
      expect(await spills(page, ".profile-panel")).toEqual([]);

      // Centred: the card's words in the card, each number and label in its
      // tile, Share card, the title chips, the links.
      await boxCentred(page, ".pf-card-name", ".pf-card", "name");
      await boxCentred(page, ".pf-card-title", ".pf-card", "title");
      await boxCentred(page, ".pf-card-tags", ".pf-card", "tags");
      for (let i = 1; i <= 4; i++) {
        await boxCentred(
          page,
          `.pf-tile:nth-child(${i}) b`,
          `.pf-tile:nth-child(${i})`,
          `tile ${i} number`,
        );
        await boxCentred(
          page,
          `.pf-tile:nth-child(${i}) small`,
          `.pf-tile:nth-child(${i})`,
          `tile ${i} label`,
        );
      }
      await centred(
        page,
        "[data-profile-share]",
        "Share card",
        1,
        size.phone ? { across: true } : {},
      );
      await centred(page, '.pf-title-chip[data-profile-title=""]', "No title");
      await centred(page, "[data-profile-rename]", "Change name");
      await boxCentred(page, ".pf-name-now", ".pf-name-row", "name", "y");
      await centred(page, ".pf-title-chip.is-on", "worn title");
      for (const go of ["ranks", "journey", "raids"])
        await centred(
          page,
          `.pf-links [data-profile-go="${go}"]`,
          `${go} link`,
        );
      // One size each: tiles, title chips' height, mastery chips, trophies,
      // the two summaries, the links; the tiles share a top edge.
      expect(await sizes(page, ".pf-tile"), "tiles").toHaveLength(1);
      expect(
        await sizes(page, ".pf-mastery-chip"),
        "mastery chips",
      ).toHaveLength(1);
      expect(await sizes(page, ".pf-trophy"), "trophies").toHaveLength(1);
      expect(await sizes(page, ".pf-mini"), "summaries").toHaveLength(1);
      expect(await sizes(page, ".pf-links > .ui-btn"), "links").toHaveLength(1);
      const chipHeights = await page.evaluate(
        () =>
          new Set(
            Array.from(document.querySelectorAll(".pf-title-chip")).map((e) =>
              Math.round(e.getBoundingClientRect().height),
            ),
          ).size,
      );
      expect(chipHeights, "title chips' height").toBe(1);
      const tiles = await rowsEven(page, ".pf-tile");
      expect(tiles.heights).toHaveLength(1);
      // Sixteen fighters in two even rows of eight.
      const rows = await page.evaluate(() => {
        const tops = Array.from(
          document.querySelectorAll(".pf-mastery-chip"),
        ).map((e) => Math.round(e.getBoundingClientRect().top));
        return [...new Set(tops)].map(
          (t) => tops.filter((x) => x === t).length,
        );
      });
      expect(rows).toEqual([8, 8]);
      // The card keeps its place; the column beside it scrolls to its end.
      const main = panel.locator(".pf-main");
      await main.evaluate((e) => (e.scrollTop = e.scrollHeight));
      await expect(panel.locator(".pf-links")).toBeInViewport();
      await expect(card).toBeInViewport();
      expect(
        await layoutProblems(page, {
          inset: size.island ? ISLAND : undefined,
          phone: size.phone,
        }),
      ).toEqual([]);
      await main.evaluate((e) => (e.scrollTop = 0));
      await settled(page, ".profile-panel");
      await snap(page, info, `profile-${size.name}`);
      // The name form: one height with the row it replaces, its buttons one
      // size and centred.
      const rowHeight = await panel.locator(".pf-name-row").evaluate((e) => e.getBoundingClientRect().height);
      await panel.locator("[data-profile-rename]").click();
      await expect(panel.locator("[data-profile-name-form] input")).toBeFocused();
      expect(await panel.locator(".pf-name-form").evaluate((e) => e.getBoundingClientRect().height)).toBe(rowHeight);
      expect(await sizes(page, ".pf-name-form > .ui-btn"), "name buttons").toHaveLength(1);
      await centred(page, "[data-profile-name-cancel]", "Cancel");
      await centred(page, '.pf-name-form button[type="submit"]', "Save", 1, size.phone ? { across: true } : {});
      expect(await layoutProblems(page, { inset: size.island ? ISLAND : undefined, phone: size.phone })).toEqual([]);
      await snap(page, info, `profile-name-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("titles wear on a tap, a refusal says why; a guest can save their account", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  try {
    const page = await context.newPage();
    const { errors, panel } = await open(page, SIZES[1]);
    const expert = panel.locator(".pf-title-chip", { hasText: "Expert" });
    await expert.click();
    await expect(panel.locator(".pf-title-chip.is-on")).toHaveText("Expert");
    await expect(panel.locator(".pf-status")).toHaveText(
      "Title on. Other players see it now.",
    );
    await expect(panel.locator(".pf-card-title")).toHaveText("Expert");
    // The HUD's nameplate follows (the account came back from the server).
    await expect(page.locator("#account-profile .nav-title")).toHaveText(
      "Expert",
    );
    await expect(expert).toBeFocused();
    await panel.locator('.pf-title-chip[data-profile-title=""]').click();
    await expect(panel.locator(".pf-title-chip.is-on")).toHaveText("No title");
    await expect(panel.locator(".pf-card-title")).toHaveCount(0);
    await page.evaluate(() => ((window as any).__refuseTitle = true));
    await panel.locator(".pf-title-chip", { hasText: "Pupil" }).click();
    await expect(panel.locator(".pf-status")).toHaveText(
      "That title is not yours.",
    );
    await expect(panel.locator(".pf-title-chip.is-on")).toHaveText("No title");
    expect(await page.evaluate(() => (window as any).__titleCalls)).toEqual([
      TITLES[1].id,
      "",
      TITLES[3].id,
    ]);
    // Keyboard: arrows move along the chips.
    await panel.locator('.pf-title-chip[data-profile-title=""]').focus();
    await page.keyboard.press("ArrowRight");
    await expect(panel.locator(".pf-title-chip").nth(1)).toBeFocused();
    // Share card: no share sheet here, so the picture downloads.
    const download = page.waitForEvent("download");
    await panel.locator("[data-profile-share]").click();
    expect((await download).suggestedFilename()).toBe(
      "element-arena-player-card.png",
    );
    await expect(panel.locator(".pf-status")).toHaveText(
      "Card saved as a picture; the message is copied.",
    );
    // A trophy opens that boss's rewards in the Raid Hall.
    await panel.locator('[data-profile-boss="emberwing"]').click();
    await expect(page.locator(".profile-panel")).toHaveCount(0);
    await expect(page.locator(".rh-room")).toBeVisible();
    await expect(page.locator('[data-ui-raid-tab="rewards"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
  const guest = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await guest.newPage();
    const { errors, panel } = await open(page, SIZES[3], { guest: true });
    await expect(panel.locator("[data-profile-save]")).toBeVisible();
    await expect(panel.locator("[data-profile-save]")).toContainText(
      "Keep your progress",
    );
    expect(await layoutProblems(page, { phone: true })).toEqual([]);
    // The links still open their screens; Escape leaves.
    await page.keyboard.press("Escape");
    await expect(page.locator(".profile-panel")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await guest.close();
  }
});

test("the profile with reduced motion and Low graphics", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
    const { errors, panel } = await open(page, SIZES[2]);
    await expect(panel).toHaveAttribute("data-graphics", "low");
    expect(
      await panel.evaluate((el) => getComputedStyle(el).backdropFilter),
    ).toBe("none");
    await panel.locator('[data-profile-go="ranks"]').first().click();
    await expect(page.locator(".ranks-panel")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("change your name: checked, confirmed, then locked for 14 days", async ({ browser }) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    const { errors, panel } = await open(page, SIZES[1]);
    const rename = panel.locator("[data-profile-rename]");
    await expect(rename).toBeEnabled();
    await expect(panel.locator(".pf-section", { hasText: "Name" })).toContainText("You can change it once every 14 days");
    // Checked here first: nothing is sent for a bad name or the same one.
    await rename.click();
    const input = panel.locator("[data-profile-name-form] input");
    await expect(input).toHaveValue("tester");
    await input.fill("!!!");
    await page.keyboard.press("Enter");
    await expect(panel.locator(".pf-name-message")).toHaveText("Use at least one letter or number.");
    await input.fill("tester");
    await page.keyboard.press("Enter");
    await expect(panel.locator(".pf-name-message")).toHaveText("That is already your name.");
    expect(await page.evaluate(() => (window as any).__nameCalls)).toEqual([]);
    // Escape closes the form, not the card.
    await page.keyboard.press("Escape");
    await expect(panel.locator(".pf-name-form")).toBeHidden();
    await expect(rename).toBeFocused();
    await expect(page.locator(".profile-panel")).toBeVisible();
    // A real change asks once more (the next one is 14 days away). Cancel
    // keeps your name.
    await rename.click();
    await input.fill("  Nova   Star ");
    await page.keyboard.press("Enter");
    const confirm = page.locator("[data-ui-confirm] .ui-modal");
    await expect(confirm).toContainText("Change your name?");
    await expect(confirm).toContainText("Nova Star");
    await expect(confirm).toContainText("in 14 days");
    await confirm.locator("[data-ui-cancel]").click();
    expect(await page.evaluate(() => (window as any).__nameCalls)).toEqual([]);
    await page.keyboard.press("Enter");
    await page.locator("[data-ui-confirm] [data-ui-confirm-ok]").click();
    // The server's name everywhere: the card, the head, the HUD.
    await expect(panel.locator(".pf-name-message")).toHaveText("Name changed. Everyone sees Nova Star now.");
    expect(await page.evaluate(() => (window as any).__nameCalls)).toEqual(["Nova Star"]);
    await expect(panel.locator(".pf-card-name")).toHaveText("Nova Star");
    await expect(panel.locator(".ui-title")).toHaveText("Nova Star");
    await expect(page.locator("#account-profile .account-name")).toHaveText("Nova Star");
    // Locked now, with the time left on the server's clock.
    await expect(rename).toBeDisabled();
    await expect(panel.locator(".pf-section", { hasText: "Name" })).toContainText(/You can change it again in 1[34] d \d+ h/);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("a locked name says when; a refusal says why", async ({ browser }) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    // Changed 4 days ago by the server's clock: 10 days to go.
    const serverTime = Date.parse("2026-11-06T12:00:00Z");
    await page.addInitScript((now) => {
      const w = window as any;
      w.__serverTime = now;
      w.__nameStatus = { changedAt: new Date(now - 4 * 86400e3).toISOString(), nextAt: new Date(now + 10 * 86400e3).toISOString(), now: new Date(now).toISOString(), days: 14 };
    }, serverTime);
    const { errors, panel } = await open(page, SIZES[3]);
    await expect(panel.locator("[data-profile-rename]")).toBeDisabled();
    await expect(panel.locator(".pf-section", { hasText: "Name" })).toContainText(/You can change it again in (10 d 0 h|9 d 23 h)/);
    expect(await layoutProblems(page, { phone: true })).toEqual([]);
    // If the server refuses anyway (another device changed it), its reason shows.
    await page.evaluate(() => {
      const w = window as any;
      w.__nameStatus = null;
      w.__refuseName = true;
    });
    await page.keyboard.press("Escape");
    await page.click("#account-profile");
    await expect(panel.locator("[data-profile-rename]")).toBeEnabled();
    await panel.locator("[data-profile-rename]").click();
    await panel.locator("[data-profile-name-form] input").fill("Nova");
    await page.keyboard.press("Enter");
    await page.locator("[data-ui-confirm] [data-ui-confirm-ok]").click();
    await expect(panel.locator(".pf-name-message")).toHaveText("You can change your name again on November 20, 2026 at 03:00 UTC.");
    await expect(panel.locator(".pf-card-name")).toHaveText("tester");
    await expect(panel.locator("[data-profile-name-form] input")).toBeFocused();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
