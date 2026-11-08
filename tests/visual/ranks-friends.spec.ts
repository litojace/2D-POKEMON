import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import {
  badgeCentred,
  boxCentred,
  centred,
  rowsEven,
  settled,
  spills,
} from "./ui-checks";
import { ISLAND, closeSpot, layoutProblems, setInsets } from "./ui-measure";

// UI remodel step 6 (docs/ui-remodel/PLAN.md): Ranks (a panel) and Friends
// (a sheet beside the live Lobby). Measured at the five review sizes with
// the shared layout rules (ui-measure.ts), and the owner's priority for this
// step: every label centred in its box (measured on the pixels), rows that
// share their edges and heights, nothing cut off or spilling out.
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
// The server's clock: friends' "online … ago" count from it, not this machine's.
const SERVER_TIME = Date.parse("2026-11-06T18:00:00Z");
const ago = (h: number) => new Date(SERVER_TIME - h * 3600e3).toISOString();
const id = (n: number) =>
  `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`;
// Names are at most 20 characters (migration 001); the widest letters.
const LONG = "WWWWWWWWWWWWWWWWWWWW";
const FRIENDS = {
  code: "a1b2c3d4",
  friends: [
    {
      id: id(1),
      name: "Kai",
      online: true,
      activity: "menu",
      fighter: "cindrake",
    },
    {
      id: id(2),
      name: "Mina",
      online: true,
      activity: "match",
      room: "ABCD12",
      fighter: "lumoth",
    },
    {
      id: id(3),
      name: "Rae",
      online: true,
      activity: "town",
      fighter: "tidefin",
      frame: "galaxy-frame",
      look: { frame: "galaxy-frame" },
    },
    {
      id: id(6),
      name: LONG,
      online: true,
      activity: "lobby",
      room: "ROOM77",
      joinable: true,
      fighter: "voltkit",
    },
    {
      id: id(4),
      name: "Juniper",
      online: false,
      lastOnline: ago(2.2),
      fighter: "terradon",
    },
    {
      id: id(5),
      name: "Oskar",
      online: false,
      lastOnline: ago(30),
      fighter: "mystowl",
    },
  ],
  incoming: [{ id: id(9), name: "Pip" }],
  outgoing: [{ id: id(10), name: "Quinn" }],
};

const RECENT = {
  players: [
    {
      id: id(1),
      name: "Kai",
      fighter: "cindrake",
      lastPlayed: ago(2),
      matches: 3,
      together: 0,
      wins: 2,
      losses: 1,
      relation: "friend",
      online: true,
    },
    {
      id: id(21),
      name: "Wren",
      fighter: "tidefin",
      lastPlayed: ago(5),
      matches: 1,
      together: 1,
      wins: 0,
      losses: 0,
      relation: "none",
      online: false,
    },
    {
      id: id(22),
      name: "Oskar",
      fighter: "mystowl",
      lastPlayed: ago(30),
      matches: 2,
      together: 0,
      wins: 0,
      losses: 2,
      relation: "sent",
      online: false,
    },
  ],
};
async function open(
  page: Page,
  size: Size,
  o: { board?: unknown; friends?: unknown } = {},
) {
  await page.addInitScript(
    ({ friends, board, recent, serverTime }) => {
      const w = window as any;
      w.__friends = friends;
      if (board) w.__board = board;
      w.__recent = recent;
      w.__serverTime = serverTime;
    },
    {
      friends: o.friends ?? FRIENDS,
      board: o.board ?? null,
      recent: RECENT,
      serverTime: SERVER_TIME,
    },
  );
  const errors = await openLobby(page);
  if (size.island) await setInsets(page, ISLAND);
  return errors;
}

for (const size of SIZES)
  test(`Ranks: your rank, the board and your pinned row at ${size.name}`, async ({
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
      const errors = await open(page, size);
      await page.click('.lobby-rail [data-lobby-action="ranks"]');
      const panel = page.locator(".ranks-panel");
      await expect(panel).toBeVisible();
      await expect(
        page.locator('.lobby-rail [data-lobby-action="ranks"]'),
      ).toHaveAttribute("aria-current", "page");
      await expect(panel.locator(".rk-list .rk-row")).toHaveCount(20);
      await expect(panel.locator(".rk-medal")).toHaveCount(3);
      const pinned = panel.locator(".rk-pin .rk-row");
      await expect(pinned.locator(".rk-place")).toHaveText("23");
      await expect(pinned.locator(".rk-name b")).toHaveText("tester");
      await expect(pinned).toContainText("Expert");
      await expect(panel.locator(".rk-ladder li.is-cur")).toHaveText(/Expert/);
      await expect(panel.locator(".rk-line")).toHaveText(
        "40 more for Candidate Master · best 1,140",
      );
      if (!size.phone)
        await expect(panel.locator(".ui-kicker")).toHaveText(
          /^Season · November 2026 · ends in \d+ d \d+ h$/,
        );
      await settled(page, ".ranks-panel");
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
      expect(await spills(page, ".ranks-panel")).toEqual([]);

      // Centred labels: Everyone / Friends, the medals, a place number, the
      // monograms, the You tag, the rules button; the rank's name and
      // rating in the middle of their card.
      await centred(page, '[data-ui-scope="everyone"]', "Everyone");
      await centred(page, '[data-ui-scope="friends"]', "Friends");
      for (const n of [1, 2, 3])
        await centred(page, `.rk-medal.is-${n}`, `medal ${n}`);
      await centred(
        page,
        ".rk-list .rk-row:nth-child(4) .rk-place",
        "place 4",
        1,
        { across: true },
      );
      await centred(
        page,
        ".rk-list .rk-row:nth-child(1) .rk-avatar",
        "monogram",
      );
      await centred(page, ".rk-pin .ui-tag", "You tag");
      await centred(page, ".rk-pin .rk-place", "pinned place", 1, {
        across: true,
      });
      await boxCentred(page, ".rk-rank", ".rk-card", "rank name");
      await boxCentred(page, ".rk-rating", ".rk-card", "rating");
      await boxCentred(page, ".rk-badge", ".rk-card", "badge");
      if (!size.phone)
        await centred(page, ".rk-rules > summary", "How ranks work");

      // Rows: one height, one left edge; the pinned row's columns line up
      // with the list's; numbers share their right edge.
      const list = await rowsEven(page, ".rk-list .rk-row");
      expect(list.lefts, "rows' left edges").toHaveLength(1);
      expect(list.heights, "rows' heights").toHaveLength(1);
      const cols = await page.evaluate(() => {
        const edge = (sel: string, side: "left" | "right") =>
          Array.from(document.querySelectorAll(sel)).map((e) =>
            Math.round(e.getBoundingClientRect()[side]),
          );
        return {
          place: new Set(edge(".rk-row .rk-place", "left")).size,
          name: new Set(edge(".rk-row .rk-name", "left")).size,
          rating: new Set(edge(".rk-row .rk-rating-cell", "right")).size,
          wl: new Set(edge(".rk-row .rk-wl", "right")).size,
          headRating: Math.round(
            document
              .querySelector(".rk-head > span:nth-child(4)")!
              .getBoundingClientRect().right,
          ),
          rowRating: Math.round(
            document
              .querySelector(".rk-row .rk-rating-cell")!
              .getBoundingClientRect().right,
          ),
        };
      });
      expect(cols).toMatchObject({ place: 1, name: 1, rating: 1, wl: 1 });
      expect(cols.headRating).toBe(cols.rowRating);
      await snap(page, info, `ranks-everyone-${size.name}`);

      // Friends: you and your friends; your row pinned with your place.
      await page.click('[data-ui-scope="friends"]');
      await expect(panel.locator(".rk-list .rk-row")).toHaveCount(4);
      await expect(pinned.locator(".rk-place")).toContainText("2");
      await expect(panel.locator(".rk-list .rk-row.is-me")).toHaveCount(1);
      await expect(panel.locator(".rk-list .rk-row").nth(3)).toContainText(
        "Placing · 3 to go",
      );
      await settled(page, ".ranks-panel");
      expect(
        await layoutProblems(page, {
          inset: size.island ? ISLAND : undefined,
          phone: size.phone,
        }),
      ).toEqual([]);
      expect(await spills(page, ".ranks-panel")).toEqual([]);
      await centred(page, '[data-ui-scope="friends"]', "Friends (on)");
      await snap(page, info, `ranks-friends-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

const BIG = {
  season: "2026-11",
  rows: Array.from({ length: 20 }, (_, i) => ({
    rank: i + 1,
    name: i === 4 ? "Maximiliana-Von-Longname-The-Third" : `P${i}`,
    title: null,
    titleColor: null,
    rating: 9999 - i,
    rankName: "International Grandmaster",
    wins: 9999,
    matches: 19999,
    me: false,
  })),
  unranked: [],
  me: { rank: 12345, wins: 1234, matches: 2468 },
  rating: {
    rating: 9999,
    matches: 2468,
    peak: 9999,
    rank: "International Grandmaster",
    placementLeft: 0,
    next: { name: "Legendary Grandmaster", at: 1550 },
  },
};
const PLACING = {
  season: "2026-11",
  rows: [],
  unranked: [{ name: "tester", left: 3 }],
  me: null,
  rating: {
    rating: 1012,
    matches: 2,
    peak: 1012,
    rank: "Unranked",
    placementLeft: 3,
    next: { name: "Specialist", at: 1000 },
  },
};
const IN_TOP = {
  season: "2026-11",
  rows: ["Aria", "tester", "Cleo"].map((name, i) => ({
    rank: i + 1,
    name,
    title: null,
    titleColor: null,
    rating: 1300 - i * 50,
    rankName: "Master",
    wins: 10,
    matches: 15,
    me: name === "tester",
  })),
  unranked: [],
  me: { rank: 2, wins: 10, matches: 15 },
  rating: {
    rating: 1250,
    matches: 30,
    peak: 1250,
    rank: "Master",
    placementLeft: 0,
    next: { name: "International Master", at: 1300 },
  },
};
for (const size of [SIZES[1], SIZES[4]])
  test(`Ranks with big numbers, in placement and in the top 20 at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(150_000);
    for (const [name, board] of [
      ["big", BIG],
      ["placing", PLACING],
      ["in-top", IN_TOP],
    ] as const) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.phone,
        hasTouch: size.phone,
      });
      try {
        const page = await context.newPage();
        const errors = await open(page, size, { board });
        await page.click('.lobby-rail [data-lobby-action="ranks"]');
        const pinned = page.locator(".rk-pin .rk-row");
        await expect(pinned).toBeVisible();
        if (name === "big") {
          await expect(pinned.locator(".rk-place")).toHaveText("12,345");
          await expect(pinned.locator(".rk-rating-cell")).toHaveText("9,999");
          await expect(page.locator(".rk-line")).toHaveText(
            "Reach #1 to become Legendary Grandmaster",
          );
        } else if (name === "placing") {
          await expect(pinned.locator(".rk-place")).toHaveText("—");
          await expect(pinned).toContainText("Placing · 3 to go");
          await expect(page.locator(".rk-rank")).toHaveText("Unranked");
          await expect(page.locator(".rk-line")).toHaveText(
            "3 placement matches to go",
          );
          await expect(page.locator(".rk-ladder li.is-cur")).toHaveCount(0);
          await expect(page.locator(".rk-list .ui-empty")).toContainText(
            "Nobody is ranked yet",
          );
          await boxCentred(
            page,
            ".rk-list .ui-empty b",
            ".rk-list .ui-empty",
            "empty heading",
          );
        } else {
          await expect(
            page.locator(".rk-list .rk-row.is-me .rk-place"),
          ).toContainText("2");
          await expect(pinned.locator(".rk-place")).toContainText("2");
        }
        await settled(page, ".ranks-panel");
        expect(
          await layoutProblems(page, {
            inset: size.island ? ISLAND : undefined,
            phone: size.phone,
          }),
        ).toEqual([]);
        expect(await spills(page, ".ranks-panel")).toEqual([]);
        await snap(page, info, `ranks-${name}-${size.name}`);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });

for (const size of SIZES)
  test(`Friends: a sheet beside the live Lobby at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(150_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
      // A layout test: the fighter behind the sheet holds still, so each of
      // its many element photos doesn't wait on the live Lobby's frames
      // (seconds each on a software GPU; at large sizes the test outran its
      // time on a slow CI machine). Motion has its own test below.
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      const errors = await open(page, size);
      await page.click('.lobby-rail [data-lobby-action="friends"]');
      const sheet = page.locator(".friends-sheet");
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveClass(/ui-sheet/);
      await expect(
        page.locator('.lobby-rail [data-lobby-action="friends"]'),
      ).toHaveAttribute("aria-current", "page");
      // Requests on top, online friends first (each with one action), then
      // offline with "online … ago" by the server's clock; the code below.
      const rows = sheet.locator(".fr-row");
      await expect(rows).toHaveCount(7);
      await expect(rows.first()).toHaveClass(/is-request/);
      await expect(rows.first().locator("[data-friend-accept]")).toBeVisible();
      await expect(rows.first().locator("[data-friend-decline]")).toBeVisible();
      await expect(sheet.locator(".fr-kicker").first()).toHaveText(
        "Online · 4",
      );
      await expect(
        sheet.locator(`[data-friend-row="${id(4)}"] small`),
      ).toHaveText("Online 2 h ago");
      await expect(
        sheet.locator(`[data-friend-row="${id(5)}"] small`),
      ).toHaveText("Online yesterday");
      await expect(
        sheet.locator(`[data-friend-invite="${id(1)}"]`),
      ).toBeVisible();
      await expect(sheet.locator(`[data-friend-watch="ABCD12"]`)).toBeVisible();
      await expect(sheet.locator(`[data-friend-join="ROOM77"]`)).toBeVisible();
      await expect(
        sheet.locator(`[data-friend-row="${id(4)}"] .ui-row-acts .ui-btn`),
      ).toHaveCount(0);
      await expect(sheet.locator("[data-friend-code]")).toHaveText("A1B2 C3D4");
      await expect(sheet.locator(".fr-tab-badge")).toHaveText("1");
      // The Lobby beside it stays live: PLAY in sight and usable.
      await expect(page.locator("#lobby-play")).toBeVisible();
      await expect(page.locator("#lobby-play")).toBeEnabled();
      await settled(page, ".friends-sheet");
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
      expect(await spills(page, ".friends-sheet")).toEqual([]);

      // A long name ends in an ellipsis inside its row.
      const long = sheet.locator(`[data-friend-row="${id(6)}"] .ui-row-main b`);
      expect(
        await long.evaluate((b) => [
          getComputedStyle(b).textOverflow,
          b.getBoundingClientRect().right <=
            b.parentElement!.getBoundingClientRect().right + 0.5,
          b.getBoundingClientRect().right <=
            b
              .closest(".ui-row")!
              .querySelector(".ui-row-acts")!
              .getBoundingClientRect().left,
        ]),
      ).toEqual(["ellipsis", true, true]);

      // Centred labels: the tabs, Decline / Accept, Invite, Join, Watch,
      // Copy, Share, the tab's badge. A gold button's vertical ink can sit a
      // pixel or two off on phones (its shadow and gradient): check dx there.
      const loose = size.phone ? { across: true } : {};
      await centred(page, '[data-ui-friends-tab="friends"]', "Friends tab", 1, {
        across: true,
      });
      await centred(
        page,
        '[data-ui-friends-tab="requests"]',
        "Requests tab",
        1,
        { across: true },
      );
      await badgeCentred(page, ".fr-tab-badge", "Requests badge");
      await centred(page, "[data-friend-decline]", "Decline");
      await centred(page, "[data-friend-accept]", "Accept", 1, loose);
      await centred(
        page,
        `[data-friend-invite="${id(1)}"]`,
        "Invite",
        1,
        loose,
      );
      await centred(page, "[data-friend-join]", "Join", 1, loose);
      await centred(page, "[data-friend-watch]", "Watch");
      await centred(page, "[data-friend-copy]", "Copy");
      await centred(page, "[data-friend-share]", "Share");
      await centred(page, ".fr-add-toggle", "Add a friend");
      // Every row action is one size; the rows share edges and heights.
      const acts = await page.evaluate(() => {
        const sizes = Array.from(
          document.querySelectorAll(
            ".fr-row .ui-row-acts > :is(.ui-btn, .fr-in-party), .fr-code > .ui-btn",
          ),
        ).map((e) => {
          const r = e.getBoundingClientRect();
          return `${Math.round(r.width)}x${Math.round(r.height)}`;
        });
        return [...new Set(sizes)];
      });
      expect(acts, "row actions' sizes").toHaveLength(1);
      const even = await rowsEven(page, ".fr-row > .ui-row");
      expect(even.lefts, "rows' left edges").toHaveLength(1);
      expect(even.heights, "rows' heights").toHaveLength(1);
      // The status dot: a round 12 px (10 on phones) dot at the portrait's
      // lower right, inside the row.
      const dot = await page.evaluate(() => {
        const d = document
          .querySelector(".fr-row.is-online .fr-avatar > .ui-status")!
          .getBoundingClientRect();
        const a = document
          .querySelector(".fr-row.is-online .fr-avatar")!
          .getBoundingClientRect();
        return {
          w: d.width,
          h: d.height,
          right: Math.round(a.right - d.right),
          bottom: Math.round(a.bottom - d.bottom),
        };
      });
      expect(dot.w).toBe(dot.h);
      expect(dot.w).toBe(size.phone ? 10 : 12);
      expect(Math.abs(dot.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(dot.bottom)).toBeLessThanOrEqual(1);
      await snap(page, info, `friends-${size.name}`);

      // Requests: For you (Decline / Accept) and Sent (Cancel).
      await page.click('[data-ui-friends-tab="requests"]');
      await expect(sheet.locator(".fr-row")).toHaveCount(2);
      await expect(sheet.locator("[data-friend-cancel]")).toBeVisible();
      await settled(page, ".friends-sheet");
      expect(
        await layoutProblems(page, {
          inset: size.island ? ISLAND : undefined,
          phone: size.phone,
        }),
      ).toEqual([]);
      await centred(page, "[data-friend-cancel]", "Cancel");
      await snap(page, info, `friends-requests-${size.name}`);

      // Recent: players from your latest matches, with Add or where you stand.
      await page.click('[data-ui-friends-tab="recent"]');
      await expect(sheet.locator(".fr-row.is-recent")).toHaveCount(3);
      await expect(sheet.locator(".fr-row.is-recent").first()).toContainText(
        "2 h ago · You 2–1",
      );
      await settled(page, ".friends-sheet");
      expect(
        await layoutProblems(page, {
          inset: size.island ? ISLAND : undefined,
          phone: size.phone,
        }),
      ).toEqual([]);
      expect(await spills(page, ".friends-sheet")).toEqual([]);
      await centred(page, ".fr-row.is-recent .fr-in-party", "Friend pill");
      await centred(page, "[data-friend-add-id]", "Add friend");
      await snap(page, info, `friends-recent-${size.name}`);

      // The add-by-code row.
      await page.click(".fr-add-toggle");
      await expect(page.locator("#fr-add-code")).toBeFocused();
      await settled(page, ".friends-sheet");
      expect(
        await layoutProblems(page, {
          inset: size.island ? ISLAND : undefined,
          phone: size.phone,
        }),
      ).toEqual([]);
      await centred(page, ".fr-add .ui-btn", "Send", 1, loose);
      await snap(page, info, `friends-add-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("Friends with nobody yet, and with fifty friends", async ({
  browser,
}, info) => {
  test.setTimeout(150_000);
  for (const size of [SIZES[1], SIZES[4]]) {
    const many = {
      ...FRIENDS,
      friends: Array.from({ length: 50 }, (_, i) => ({
        id: id(100 + i),
        name: `Friend ${i}`,
        online: i % 5 === 0,
        activity: "menu",
        lastOnline: ago(i + 1),
        fighter: ["voltkit", "cindrake", "tidefin"][i % 3],
      })),
    };
    for (const [name, friends] of [
      ["empty", { code: "a1b2c3d4", friends: [], incoming: [], outgoing: [] }],
      ["fifty", many],
    ] as const) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.phone,
        hasTouch: size.phone,
      });
      try {
        const page = await context.newPage();
        const errors = await open(page, size, { friends });
        await page.click('.lobby-rail [data-lobby-action="friends"]');
        const sheet = page.locator(".friends-sheet");
        await expect(sheet).toBeVisible();
        if (name === "empty") {
          await expect(sheet.locator(".ui-empty")).toContainText(
            "No friends yet",
          );
          await boxCentred(
            page,
            ".fr-scroll .ui-empty b",
            ".fr-scroll .ui-empty",
            "empty heading",
          );
          await boxCentred(
            page,
            ".fr-scroll .ui-empty .ui-btn",
            ".fr-scroll .ui-empty",
            "empty action",
          );
          await page.click('[data-ui-friends-tab="requests"]');
          await expect(sheet.locator(".ui-empty")).toContainText("No requests");
        } else {
          await expect(sheet.locator(".fr-row")).toHaveCount(51);
          await expect(sheet.locator(".fr-kicker").first()).toHaveText(
            "Online · 10",
          );
          // A finger reaches the last friend; the code stays in sight.
          const list = sheet.locator("[data-friends-list]");
          await list.evaluate((e) => (e.scrollTop = e.scrollHeight));
          await expect(sheet.locator(".fr-row").last()).toBeInViewport();
          await expect(sheet.locator(".fr-code")).toBeInViewport();
        }
        await settled(page, ".friends-sheet");
        expect(
          await layoutProblems(page, {
            inset: size.island ? ISLAND : undefined,
            phone: size.phone,
          }),
        ).toEqual([]);
        await snap(page, info, `friends-${name}-${size.name}`);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    }
  }
});

/** The friends API's writes, answered as the server does. */
async function friendsServer(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__calls = [];
    const fetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      const path = new URL(url, location.href).pathname;
      if (/^\/api\/friends\/(respond|remove|request)$/.test(path)) {
        const body = JSON.parse(String(init?.body ?? "{}"));
        w.__calls.push({ path, body });
        const f = w.__friends;
        if (path.endsWith("respond")) {
          const who = f.incoming.find((r: any) => r.id === body.playerId);
          f.incoming = f.incoming.filter((r: any) => r.id !== body.playerId);
          if (body.accept && who) f.friends.push({ ...who, online: false });
        } else if (path.endsWith("remove")) {
          f.friends = f.friends.filter((r: any) => r.id !== body.playerId);
          f.outgoing = f.outgoing.filter((r: any) => r.id !== body.playerId);
        } else if (body.code === "DEADBEEF")
          return new Response(
            JSON.stringify({ error: "No player has that friend code." }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        return Response.json(
          path.endsWith("request") ? { result: "sent" } : { ok: true },
        );
      }
      return fetch(input, init);
    };
  });
}

test("Friends: answer, remove, pin, add by code, invite, keyboard and Escape", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  try {
    const page = await context.newPage();
    const errors = await open(page, SIZES[1]);
    await friendsServer(page);
    await page.click('.lobby-rail [data-lobby-action="friends"]');
    const sheet = page.locator(".friends-sheet");
    await expect(sheet.locator(".fr-row")).toHaveCount(7);
    // Accept: the server answers, Pip joins the list, the badge goes.
    await sheet.locator(`[data-friend-accept="${id(9)}"]`).click();
    await expect(sheet.locator(".fr-status")).toHaveText("You're now friends.");
    await expect(sheet.locator(`[data-friend-row="${id(9)}"]`)).toHaveClass(
      /is-offline/,
    );
    await expect(sheet.locator(".fr-tab-badge")).toHaveCount(0);
    // Remove asks once more; Keep backs out; Remove removes.
    await sheet.locator(`[data-friend-menu="${id(5)}"]`).click();
    await sheet.locator(`[data-friend-remove="${id(5)}"]`).click();
    await expect(sheet.locator(`#fr-opts-${id(5)}`)).toContainText(
      "Remove Oskar from your friends?",
    );
    await expect(sheet.locator(`[data-friend-keep="${id(5)}"]`)).toBeFocused();
    await sheet.locator(`[data-friend-remove-ok="${id(5)}"]`).click();
    await expect(sheet.locator(`[data-friend-row="${id(5)}"]`)).toHaveCount(0);
    // Pin: kept on this device, the friend moves to the top of the offline list.
    await sheet.locator(`[data-friend-menu="${id(4)}"]`).click();
    await sheet.locator(`[data-friend-pin="${id(4)}"]`).click();
    await expect(sheet.locator(`[data-friend-row="${id(4)}"]`)).toHaveClass(
      /is-pinned/,
    );
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).find((k) =>
          k.startsWith("arena-friend-pins:"),
        ),
      ),
    ).toBeTruthy();
    // Escape closes the options first, then the sheet.
    await page.keyboard.press("Escape");
    await expect(sheet.locator(`#fr-opts-${id(4)}`)).toBeHidden();
    await expect(sheet).toBeVisible();
    // Add by code: a bad code is caught here; the server's refusal shows.
    await page.click(".fr-add-toggle");
    await page.fill("#fr-add-code", "xyz");
    await page.keyboard.press("Enter");
    await expect(sheet.locator(".fr-status")).toHaveText(
      "A friend code is 8 letters (A–F) and digits.",
    );
    await page.fill("#fr-add-code", "dead beef");
    await page.keyboard.press("Enter");
    await expect(sheet.locator(".fr-status")).toHaveText(
      "No player has that friend code.",
    );
    await page.fill("#fr-add-code", "0011aabb");
    await page.keyboard.press("Enter");
    await expect(sheet.locator(".fr-status")).toHaveText(
      "Friend request sent.",
    );
    expect(await page.evaluate(() => (window as any).__calls.at(-1))).toEqual({
      path: "/api/friends/request",
      body: { code: "0011AABB" },
    });
    // Invite to your party: the party server's answer.
    await page.evaluate(() => {
      const w = window as any;
      w.__events = [];
      w.__emit = (event: string, data: unknown) =>
        w.__events.push({ event, data });
      // The party server: Kai can come, Rae can't.
      w.__reply = (event: string, data: any) =>
        event !== "party-invite"
          ? { ok: false, error: "Offline harness" }
          : data.playerId.endsWith("1")
            ? { ok: true }
            : { ok: false, error: "Rae can't join a party right now." };
    });
    const invite = sheet.locator(`[data-friend-invite="${id(1)}"]`);
    await invite.click();
    await expect(invite).toContainText("Invited");
    await expect(invite).toBeDisabled();
    expect(
      await page.evaluate(() =>
        (window as any).__events.filter((e: any) => e.event === "party-invite"),
      ),
    ).toEqual([
      {
        event: "party-invite",
        data: expect.objectContaining({
          playerId: "44444444-4444-4444-8444-000000000001",
        }),
      },
    ]);
    // A refusal shows the server's reason and Invite comes back.
    await sheet.locator(`[data-friend-invite="${id(3)}"]`).click();
    await expect(sheet.locator(".fr-status")).toHaveText(
      "Rae can't join a party right now.",
    );
    await expect(
      sheet.locator(`[data-friend-invite="${id(3)}"]`),
    ).toBeEnabled();
    // Keyboard: arrows move along the tabs and pick.
    await page.locator('[data-ui-friends-tab="friends"]').focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.locator('[data-ui-friends-tab="requests"]'),
    ).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.locator(".friends-sheet")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Ranks and Friends with reduced motion and Low graphics", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
    const errors = await open(page, SIZES[2]);
    await page.click('.lobby-rail [data-lobby-action="ranks"]');
    await expect(page.locator(".ranks-panel")).toHaveAttribute(
      "data-graphics",
      "low",
    );
    expect(
      await page
        .locator(".ranks-panel")
        .evaluate((el) => getComputedStyle(el).backdropFilter),
    ).toBe("none");
    await page.click('.lobby-rail [data-lobby-action="friends"]');
    await expect(page.locator(".friends-sheet")).toHaveAttribute(
      "data-graphics",
      "low",
    );
    await expect(page.locator(".ranks-panel")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
