import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  openHub,
  openPlayPanel,
  snap,
  pickRoomMode,
  createRoom,
  inside,
} from "./helpers";
import { playersLook } from "./players-look";

/**
 * In-game chat on phones (chat/chat-ui.ts, docs/chat-plan.md):
 *
 * - the chat button sits 12 px right of the player card on every hub scene, clear of the scene switch, at
 *   the four landscape sizes;
 * - the drawer opens from the left and leaves PLAY free; lines, quick chips
 *   and the typing box work, and a typed line never becomes markup;
 * - in a room the button sits top left, clear of the seats.
 * The 44 pt hit areas of everything in the open drawer are checked by
 * phone-fit.spec.ts ("chat").
 */
const SIZES = [
  { name: "667x375", width: 667, height: 375, inset: [0, 0, 0] },
  { name: "844x390", width: 844, height: 390, inset: [47, 47, 21] },
  { name: "852x393-island", width: 852, height: 393, inset: [59, 59, 21] },
  { name: "932x430", width: 932, height: 430, inset: [59, 59, 21] },
];
const ME = "11111111-1111-4111-8111-111111111111",
  PAL = "22222222-2222-4222-8222-222222222222";

async function phone(browser: Browser, size: (typeof SIZES)[number]) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  await page.addInitScript(([left, right, bottom]) => {
    const set = () => {
      for (const [k, v] of Object.entries({ left, right, bottom, top: 0 }))
        document.documentElement.style.setProperty(`--safe-${k}`, `${v}px`);
    };
    if (document.documentElement) set();
    document.addEventListener("DOMContentLoaded", set);
  }, size.inset);
  return { context, page };
}
const box = async (page: Page, selector: string) =>
  (await page.locator(selector).first().boundingBox())!;

/** The button beside the card, the switch clear of both. */
/** Switch hub scene (a script click: a scene opening can keep the page busy). */
const scene = (page: Page, name: string) =>
  page.evaluate(
    (n) =>
      document
        .querySelector<HTMLButtonElement>(
          `#hub-scenes [data-hub-scene="${n}"]`,
        )!
        .click(),
    name,
  );
async function checkButton(page: Page, card: string) {
  await expect(page.locator("#chat-button")).toBeVisible();
  await expect
    .poll(async () => {
      const [c, b] = await Promise.all([
        box(page, card),
        box(page, "#chat-button"),
      ]);
      return Math.round(b.x - (c.x + c.width));
    })
    .toBe(12);
  const [c, b, scenes] = await Promise.all([
    box(page, card),
    box(page, "#chat-button"),
    box(page, "#hub-scenes"),
  ]);
  expect(b.width).toBe(40);
  expect(b.height).toBe(40);
  // Centred on the card's height.
  expect(Math.abs(b.y + b.height / 2 - (c.y + c.height / 2))).toBeLessThan(1.5);
  // The scene switch keeps 8 px or more from the button.
  expect(scenes.x - (b.x + b.width)).toBeGreaterThanOrEqual(8);
}

test("chat on a 568x320 phone: no room beside the card, so the button sits under it", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const { context, page } = await phone(browser, {
    name: "568x320",
    width: 568,
    height: 320,
    inset: [0, 0, 0],
  });
  try {
    await openHub(page);
    await page.evaluate(() => localStorage.setItem("ea-plaza-help", "1"));
    for (const [name, card] of [
      ["lobby", "#account-profile"],
      ["plaza", "#account-profile"],
    ]) {
      await scene(page, name);
      await expect(page.locator(card)).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1500);
      // Clear of the card, the switch and the pills.
      await expect
        .poll(async () =>
          page.evaluate((card) => {
            const r = (s: string) =>
              document.querySelector(s)?.getBoundingClientRect();
            const b = r("#chat-button")!;
            const clash = [
              card,
              "#hub-scenes",
              "#account-coins",
              "#home-settings",
            ]
              .map((s) => [s, r(s)] as const)
              .filter(
                ([, o]) =>
                  o &&
                  o.width &&
                  b.left < o.right - 1 &&
                  o.left < b.right - 1 &&
                  b.top < o.bottom - 1 &&
                  o.top < b.bottom - 1,
              )
              .map(([s]) => s);
            return clash;
          }, card),
        )
        .toEqual([]);
      // Nothing on the screen covers its middle.
      expect(
        await page.evaluate(() => {
          const b = document
            .getElementById("chat-button")!
            .getBoundingClientRect();
          const hit = document.elementFromPoint(
            b.left + b.width / 2,
            b.top + b.height / 2,
          );
          return !!hit?.closest("#chat-button");
        }),
        name,
      ).toBe(true);
    }
    // The most tabs at once (a party on the Plaza, and Friends) stay in
    // their row, clear of the gear, with nothing scrolled out of sight.
    await scene(page, "plaza");
    await expect(page.locator(".plaza-layer #pz-cv")).toBeVisible();
    await page.evaluate(
      ([me, pal]) =>
        (window as any).__sock.fire("party", {
          code: "PARTY2",
          leader: me,
          members: [
            { id: me, name: "tester", character: "voltkit" },
            { id: pal, name: "Pal", character: "tidefin" },
          ],
        }),
      [ME, PAL],
    );
    await page.click("#chat-button");
    await expect
      .poll(async () => Math.round((await box(page, "#chat-drawer")).x))
      .toBe(0);
    await expect(page.locator("#chat-drawer .chat-tab")).toHaveCount(3);
    const row = await page.evaluate(() => {
      const tabs = document.querySelector("#chat-drawer .chat-tabs")!;
      return {
        overflow: tabs.scrollWidth - tabs.clientWidth,
        gap:
          document.querySelector(".chat-gear")!.getBoundingClientRect().left -
          tabs.lastElementChild!.getBoundingClientRect().right,
      };
    });
    expect(row.overflow).toBeLessThanOrEqual(0);
    expect(row.gap).toBeGreaterThanOrEqual(4);
  } finally {
    await context.close();
  }
});

for (const size of SIZES)
  test(`chat at ${size.name}: the button on every hub scene, the drawer, a room`, async ({
    browser,
  }, info) => {
    test.setTimeout(240_000);
    const { context, page } = await phone(browser, size);
    try {
      const errors = await openHub(page);
      await page.evaluate(() => {
        const w = window as any;
        w.__chatSent = [];
        const before = w.__reply;
        w.__reply = (ev: string, data: any) => {
          if (ev === "chat-send") {
            w.__chatSent.push(data);
            return { ok: true };
          }
          if (ev === "chat-history") return { ok: true, lines: [] };
          return before?.(ev, data);
        };
      });
      await checkButton(page, "#account-profile");
      await page.evaluate(() => localStorage.setItem("ea-plaza-help", "1"));
      await scene(page, "plaza");
      await expect(page.locator(".plaza-layer #pz-cv")).toBeVisible();
      await checkButton(page, "#account-profile");
      await scene(page, "lobby");
      await expect(page.locator("#lobby-play")).toBeVisible();

      // No party: only Friends, and no friends yet, so it says how.
      await page.click("#chat-button");
      await expect(page.locator("#chat-drawer .chat-tab")).toHaveText([
        "Friends",
      ]);
      await expect(page.locator("#chat-drawer .chat-empty")).toContainText(
        "Add friends from Friends on the Lobby's left to message them here.",
      );
      await expect(page.locator("#chat-drawer .chat-form")).toBeHidden();
      await page.click("#chat-drawer .chat-close");
      await expect(page.locator("#chat-drawer")).toBeHidden();

      // A party: a line while shut lights the dot.
      await page.evaluate(
        ([me, pal]) => {
          const w = window as any;
          w.__sock.fire("chat-config", { freeText: true });
          w.__sock.fire("party", {
            code: "PARTY2",
            leader: me,
            members: [
              { id: me, name: "tester", character: "voltkit" },
              { id: pal, name: "Pal", character: "tidefin" },
            ],
          });
          w.__sock.fire("chat", {
            id: 1,
            channel: "party",
            from: { id: pal, name: "Pal" },
            at: Date.now(),
            text: '<img src=x onerror="window.__xss=1">hi',
          });
        },
        [ME, PAL],
      );
      await expect(page.locator("#chat-button .chat-unread")).toHaveText("1");
      await page.click("#chat-button");
      const drawer = page.locator("#chat-drawer");
      await expect(drawer).toBeVisible();
      await expect(page.locator("#chat-button .chat-unread")).toBeHidden();
      await expect(drawer.locator('[data-chat-tab="party"]')).toHaveAttribute(
        "aria-selected",
        "true",
      );
      // The line shows as text, never as markup.
      await expect(drawer.locator(".chat-line")).toHaveText(
        'Pal<img src=x onerror="window.__xss=1">hi',
      );
      expect(await drawer.locator(".chat-line img").count()).toBe(0);
      expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
      // The drawer's width, and PLAY stays clear of it.
      // (After its slide in.)
      await expect
        .poll(async () => (await box(page, "#chat-drawer")).x)
        .toBe(0);
      const [d, play] = await Promise.all([
        box(page, "#chat-drawer"),
        box(page, "#lobby-play"),
      ]);
      expect(Math.round(d.width)).toBe(
        Math.round(Math.min(360, size.width * 0.46) + size.inset[0]),
      );
      expect(d.x + d.width).toBeLessThan(play.x);
      await snap(page, info, `chat-drawer-${size.name}`);

      // A quick chip and a typed line go to the party.
      await drawer.locator('[data-chat-quick="wave"]').click();
      await page.fill("#chat-input", "  see you there ");
      await page.press("#chat-input", "Enter");
      await expect
        .poll(() => page.evaluate(() => (window as any).__chatSent))
        .toEqual([
          { channel: "party", quick: "wave" },
          { channel: "party", text: "  see you there " },
        ]);
      await expect(page.locator("#chat-input")).toHaveValue("");
      // A link is stopped on this side with the reason.
      await page.fill("#chat-input", "free gems at freegems.gg");
      await page.press("#chat-input", "Enter");
      await expect(drawer.locator(".chat-note")).toHaveText(
        "Links can't be sent in chat.",
      );
      // Typing paused on the server: quick chat only.
      await page.evaluate(() =>
        (window as any).__sock.fire("chat-config", { freeText: false }),
      );
      await expect(page.locator("#chat-input")).toBeDisabled();
      await expect(page.locator("#chat-input")).toHaveAttribute(
        "placeholder",
        "Quick chat only for now.",
      );
      // A press outside closes it (on the stage, past the drawer's edge).
      await page.mouse.click(
        Math.max(d.x + d.width + 20, size.width / 2),
        size.height * 0.55,
      );
      await expect(drawer).toBeHidden();

      // A room (no top bar): the button in the banner's top-left corner,
      // clear of its title and of the ⋯ menu in the other corner.
      await page.evaluate(() =>
        (window as any).__room("pvp", { mode: "teams", phase: "lobby" }),
      );
      await openPlayPanel(page);
      await pickRoomMode(page, "teams");
      await createRoom(page);
      await expect
        .poll(async () => {
          await page.evaluate(() => (window as any).__push());
          return page.locator(".room-screen .roster-room").count();
        })
        .toBe(1);
      await expect(page.locator("#chat-button")).toHaveAttribute(
        "data-place",
        "room",
      );
      await expect(page.locator(".topbar")).toBeHidden();
      const [btn, panel, more, title] = await Promise.all([
        box(page, "#chat-button"),
        box(page, ".room-screen .room-banner"),
        box(page, ".room-screen .room-more"),
        box(page, ".room-screen .room-banner-name"),
      ]);
      expect(inside(btn, panel)).toBe(true);
      expect(inside(more, panel)).toBe(true);
      expect(btn.x + btn.width).toBeLessThanOrEqual(title.x);
      expect(title.x + title.width).toBeLessThanOrEqual(more.x);
      expect(btn.x).toBeGreaterThanOrEqual(size.inset[0]);
      await page.click("#chat-button");
      // A 2v2 room, just joined: your Team comes first (only your side
      // reads it), Room beside it (docs/hidden-picks.md).
      await expect(drawer.locator('[data-chat-tab="team"]')).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(drawer.locator('[data-chat-tab="room"]')).toBeVisible();
      await expect(drawer.locator(".chat-empty")).toContainText(
        "Only your team reads this",
      );
      // Four tabs in a room: each one whole, clear of the settings gear
      // (the fourth read "FRIEN" under it at 844 x 390 and was gone at
      // 667: UI audit, 27 Nov 2026).
      const tabRow = await page.evaluate(() => {
        const tabs = document.querySelector("#chat-drawer .chat-tabs")!;
        const gear = document
          .querySelector("#chat-drawer .chat-gear")!
          .getBoundingClientRect();
        const row = tabs.getBoundingClientRect();
        return {
          count: tabs.children.length,
          overflow: tabs.scrollWidth - tabs.clientWidth,
          gap: gear.left - tabs.lastElementChild!.getBoundingClientRect().right,
          cut: [...tabs.children].filter((tab) => {
            const r = tab.getBoundingClientRect();
            return r.left < row.left - 0.5 || r.right > row.right + 0.5;
          }).length,
        };
      });
      expect(tabRow.count).toBe(4);
      expect(tabRow.overflow).toBeLessThanOrEqual(0);
      expect(tabRow.cut).toBe(0);
      expect(tabRow.gap).toBeGreaterThanOrEqual(4);
      await snap(page, info, `chat-room-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("tap a message to mute or report it; the gear turns chat off", async ({
  browser,
}, info) => {
  test.setTimeout(240_000);
  const { context, page } = await phone(browser, SIZES[1]);
  try {
    const errors = await openHub(page);
    await page.evaluate(
      ([me, pal]) => {
        const w = window as any;
        w.__chatSent = [];
        const before = w.__reply;
        w.__reply = (ev: string, data: any) => {
          if (ev === "chat-report" || ev === "chat-mode") {
            w.__chatSent.push([ev, data]);
            return { ok: true };
          }
          if (ev === "chat-history") return { ok: true, lines: [] };
          return before?.(ev, data);
        };
        w.__sock.fire("chat-config", { freeText: true });
        w.__sock.fire("party", {
          code: "PARTY3",
          leader: me,
          members: [
            { id: me, name: "tester", character: "voltkit" },
            { id: pal, name: "Pal", character: "tidefin" },
          ],
        });
        for (const [id, text] of [
          [1, "hello"],
          [2, "you are ****"],
        ] as const)
          w.__sock.fire("chat", {
            id,
            channel: "party",
            from: { id: pal, name: "Pal" },
            at: Date.now(),
            text,
          });
      },
      [ME, PAL],
    );
    await page.click("#chat-button");
    const drawer = page.locator("#chat-drawer");
    await expect(drawer.locator(".chat-line")).toHaveCount(2);
    // Report the rude line: asked first, then sent with the line's id.
    await drawer.locator('.chat-line[data-line="2"] .chat-say').click();
    await drawer.locator('[data-chat-act="report"]').click();
    await expect(drawer.locator(".chat-menu p")).toContainText(
      "Report this message from Pal?",
    );
    await snap(page, info, "chat-report-844x390");
    await drawer.locator('[data-chat-act="send"]').click();
    await expect(drawer.locator(".chat-note")).toContainText("Report sent");
    await expect
      .poll(() => page.evaluate(() => (window as any).__chatSent))
      .toEqual([["chat-report", { channel: "party", id: 2 }]]);
    // Mute: their lines go, and new ones don't come.
    await drawer.locator('.chat-line[data-line="1"] .chat-say').click();
    await drawer.locator('[data-chat-act="mute"]').click();
    await expect(drawer.locator(".chat-line")).toHaveCount(0);
    await page.evaluate((pal) => {
      (window as any).__sock.fire("chat", {
        id: 3,
        channel: "party",
        from: { id: pal, name: "Pal" },
        at: Date.now(),
        text: "still here?",
      });
    }, PAL);
    await expect(drawer.locator(".chat-line")).toHaveCount(0);
    await page.click("#chat-drawer .chat-close");

    // The chat's gear → Off: nothing shows, the box says so.
    await page.click("#chat-button");
    await page.click("#chat-drawer .chat-gear");
    await snap(page, info, "chat-settings-844x390");
    await page.click('#chat-drawer [data-chat-mode="off"]');
    await expect(
      page.locator('#chat-drawer [data-chat-mode="off"]'),
    ).toHaveAttribute("aria-checked", "true");
    await expect
      .poll(() => page.evaluate(() => (window as any).__chatSent.at(-1)))
      .toEqual(["chat-mode", { mode: "off" }]);
    expect(
      await page.evaluate(() => localStorage.getItem("ea-chat-mode")),
    ).toBe("off");
    await expect(drawer.locator(".chat-empty")).toHaveText(
      "Chat is off. Turn it on with the gear above.",
    );
    await expect(page.locator("#chat-input")).toBeDisabled();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Friends in the chat: unread counts, a conversation, Message from the Friends list", async ({
  browser,
}, info) => {
  test.setTimeout(240_000);
  const FAR = "33333333-3333-4333-8333-333333333333";
  const { context, page } = await phone(browser, SIZES[1]);
  try {
    const errors = await openHub(page);
    await page.evaluate(
      ([me, pal, far]) => {
        const w = window as any;
        w.__chatSent = [];
        w.__unread = { [pal]: 2 };
        w.__friends = {
          code: "a1b2c3d4",
          friends: [
            {
              id: pal,
              name: "Pal",
              title: null,
              titleColor: null,
              online: true,
            },
            {
              id: far,
              name: "Faraway",
              title: null,
              titleColor: null,
              online: false,
            },
          ],
          incoming: [],
          outgoing: [],
        };
        const before = w.__reply;
        w.__reply = (ev: string, data: any) => {
          if (ev === "chat-unread") return { ok: true, unread: w.__unread };
          if (ev === "chat-friends")
            return {
              ok: true,
              friends: [
                {
                  id: pal,
                  name: "Pal",
                  online: true,
                  unread: w.__unread[pal] ?? 0,
                },
                { id: far, name: "Faraway", online: false, unread: 0 },
              ],
            };
          if (ev === "chat-history")
            return {
              ok: true,
              lines:
                data.to === pal
                  ? [
                      {
                        id: -1,
                        channel: "friend",
                        from: { id: pal, name: "Pal" },
                        to: me,
                        at: 1000,
                        text: "you up?",
                      },
                      {
                        id: -2,
                        channel: "friend",
                        from: { id: pal, name: "Pal" },
                        to: me,
                        at: 2000,
                        quick: "wave",
                      },
                    ]
                  : [],
            };
          if (ev === "chat-send") {
            w.__chatSent.push([ev, data]);
            return { ok: true, kept: data.to === pal };
          }
          return before?.(ev, data);
        };
        const emit = w.__emit;
        w.__emit = (ev: string, data: unknown) => {
          if (ev === "chat-read") w.__chatSent.push([ev, data]);
          emit?.(ev, data);
        };
        // On connecting: two unread from Pal light the chat's dot.
        w.__sock.fire("chat-config", { freeText: true });
      },
      [ME, PAL, FAR],
    );
    await expect(page.locator("#chat-button .chat-unread")).toHaveText("2");
    await page.click("#chat-button");
    const drawer = page.locator("#chat-drawer");
    // The list: Pal first with 2 new, Faraway offline; no box until you pick.
    await expect(drawer.locator(".chat-friend")).toHaveText([
      "Pal2",
      "Faraway",
    ]);
    await expect(drawer.locator(".chat-form")).toBeHidden();
    await snap(page, info, "chat-friends-844x390");
    await drawer.locator(`[data-chat-friend="${PAL}"]`).click();
    // The conversation: their kept lines, read on opening.
    await expect(drawer.locator(".chat-with b")).toHaveText("Pal");
    await expect(drawer.locator(".chat-line")).toHaveText([
      "Palyou up?",
      "Pal👋",
    ]);
    await expect(page.locator("#chat-button .chat-unread")).toBeHidden();
    await page.fill("#chat-input", "on my way");
    await page.press("#chat-input", "Enter");
    await expect
      .poll(() => page.evaluate(() => (window as any).__chatSent))
      .toEqual([
        ["chat-read", { to: PAL }],
        ["chat-send", { channel: "friend", text: "on my way", to: PAL }],
      ]);
    // Their next line comes straight into the open conversation (and is read).
    await page.evaluate(
      ([me, pal]) =>
        (window as any).__sock.fire("chat", {
          id: -3,
          channel: "friend",
          from: { id: pal, name: "Pal" },
          to: me,
          at: Date.now(),
          text: "cool",
        }),
      [ME, PAL],
    );
    await expect(drawer.locator(".chat-line")).toHaveCount(3);
    await snap(page, info, "chat-friend-talk-844x390");
    // Back to the list; a line from someone else while there counts on them.
    await drawer.locator(".chat-back").click();
    await expect(drawer.locator(".chat-friend")).toHaveCount(2);
    await page.click("#chat-drawer .chat-close");

    // The Friends list: Message opens the chat on that friend.
    await page.click('.lobby-rail [data-lobby-action="friends"]');
    const sheet = page.locator(".friends-sheet");
    await sheet.locator(`[data-friend-menu="${FAR}"]`).click();
    await sheet.locator(`[data-friend-message="${FAR}"]`).click();
    await expect(drawer).toBeVisible();
    await expect(drawer.locator(".chat-with b")).toHaveText("Faraway");
    await expect(drawer.locator(".chat-empty")).toHaveText(
      "No messages yet. Say hi!",
    );
    // Not kept (the database update hasn't run) and they're offline: said so.
    await drawer.locator('[data-chat-quick="wave"]').click();
    await expect(drawer.locator(".chat-note")).toHaveText(
      "Faraway is offline and won't see this one.",
    );
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("times in the chat: a stamp before each stretch, as the big chat apps do", async ({
  browser,
}, info) => {
  test.setTimeout(120_000);
  const { context, page } = await phone(browser, SIZES[1]);
  try {
    const errors = await openHub(page);
    await page.evaluate(
      ([me, pal]) => {
        const w = window as any;
        // Local times around today's date, whatever the clock says.
        const day = new Date();
        day.setHours(0, 0, 0, 0);
        const at = (daysBack: number, h: number, m: number) =>
          day.getTime() - daysBack * 86_400_000 + (h * 60 + m) * 60_000;
        w.__at = at;
        const line = (id: number, t: number, text: string) => ({
          id,
          channel: "party",
          from: { id: pal, name: "Pal" },
          at: t,
          text,
        });
        const before = w.__reply;
        w.__reply = (ev: string, data: any) =>
          ev === "chat-history"
            ? {
                ok: true,
                lines: [
                  line(1, at(3, 8, 0), "three days ago"),
                  line(2, at(3, 8, 1), "a minute later"),
                  line(3, at(1, 20, 0), "yesterday"),
                  line(4, at(0, 9, 0), "this morning"),
                  line(5, at(0, 9, 10), "ten minutes on"),
                ],
              }
            : before?.(ev, data);
        w.__sock.fire("chat-config", { freeText: true });
        w.__sock.fire("party", {
          code: "PARTY4",
          leader: me,
          members: [
            { id: me, name: "tester", character: "voltkit" },
            { id: pal, name: "Pal", character: "tidefin" },
          ],
        });
      },
      [ME, PAL],
    );
    await page.click("#chat-button");
    const drawer = page.locator("#chat-drawer");
    await expect(drawer.locator(".chat-line")).toHaveCount(5);
    // Loaded history opens at its newest line, not its oldest.
    await expect
      .poll(() =>
        drawer
          .locator(".chat-lines")
          .evaluate((l) => l.scrollHeight - l.scrollTop - l.clientHeight),
      )
      .toBeLessThanOrEqual(2);
    // A stamp before the first line, a new day, and a 5-minute gap; none
    // before "a minute later".
    await expect(drawer.locator(".chat-stamp")).toHaveText([
      /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) 8:00\sAM$/,
      /^Yesterday 8:00\sPM$/,
      /^9:00\sAM$/,
      /^9:10\sAM$/,
    ]);
    expect(
      await drawer
        .locator(".chat-lines > li")
        .evaluateAll((els) =>
          els.map((e) =>
            e.classList.contains("chat-stamp") ? "|" : e.textContent,
          ),
        ),
    ).toEqual([
      "|",
      "Palthree days ago",
      "Pala minute later",
      "|",
      "Palyesterday",
      "|",
      "Palthis morning",
      "|",
      "Palten minutes on",
    ]);
    // Screen readers hear the full date.
    await expect(drawer.locator(".chat-stamp").nth(1)).toHaveAttribute(
      "aria-label",
      /\d{4}/,
    );
    // New lines: one soon after gets no stamp; one 10 minutes on does.
    for (const [id, m, text] of [
      [6, 11, "right after"],
      [7, 21, "later on"],
    ] as const)
      await page.evaluate(
        ([id, m, text, pal]) => {
          const w = window as any;
          w.__sock.fire("chat", {
            id,
            channel: "party",
            from: { id: pal, name: "Pal" },
            at: w.__at(0, 9, m),
            text,
          });
        },
        [id, m, text, PAL] as const,
      );
    await expect(drawer.locator(".chat-line")).toHaveCount(7);
    await expect(drawer.locator(".chat-stamp")).toHaveCount(5);
    await expect(drawer.locator(".chat-stamp").last()).toHaveText(/^9:21\sAM$/);
    await snap(page, info, "chat-times-844x390");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

/**
 * Stand-ins for the browser's push service (headless Chromium has none) and
 * its notification permission (which Chromium builds report differently in
 * headless runs: "denied" on CI even when granted). window.__permission sets
 * what the browser answers.
 */
const fakePush = () => {
  const w = window as any;
  let sub: any = null;
  w.__permission = "default";
  class FakeNotification {
    static get permission() {
      return w.__permission;
    }
    static async requestPermission() {
      if (w.__permission === "default") w.__permission = "granted";
      return w.__permission;
    }
  }
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: FakeNotification,
  });
  const pushManager = {
    getSubscription: async () => sub,
    subscribe: async (opts: any) => {
      w.__pushOpts = {
        userVisibleOnly: opts.userVisibleOnly,
        key: opts.applicationServerKey?.length,
      };
      sub = {
        endpoint: "https://fcm.googleapis.com/fcm/send/this-phone",
        toJSON: () => ({
          endpoint: sub.endpoint,
          keys: {
            p256dh:
              "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
            auth: "tBHItJI5svbpez7KI4CCXg",
          },
        }),
        unsubscribe: async () => {
          sub = null;
          return true;
        },
      };
      return sub;
    },
  };
  const reg = { pushManager };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve(reg),
      getRegistration: async () => reg,
      addEventListener() {},
      register: async () => reg,
    },
  });
};

test("notify me of friends' messages: the gear's switch, and when it can't be offered", async ({
  browser,
}, info) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(fakePush);
    const errors = await openHub(page);
    await page.evaluate(() => {
      const w = window as any;
      w.__pushSent = [];
      w.__pushKey =
        "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";
      const before = w.__reply;
      w.__reply = (ev: string, data: any) => {
        if (ev === "push-config") return { ok: true, key: w.__pushKey };
        if (
          ev === "push-subscribe" ||
          ev === "push-unsubscribe" ||
          ev === "push-news"
        ) {
          w.__pushSent.push([ev, data]);
          return { ok: true };
        }
        return before?.(ev, data);
      };
    });
    await page.click("#chat-button");
    await page.click("#chat-drawer .chat-gear");
    const toggle = page.locator("#chat-drawer .chat-push-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("#chat-drawer .chat-push-note")).toContainText(
      "it says who, not what",
    );
    // Game news shows only once notifications are on.
    const news = page.locator("#chat-drawer .chat-news-toggle");
    await expect(news).toBeHidden();
    await snap(page, info, "chat-push-off-844x390");
    // On: subscribed with the server's key, and the server told.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate(() => (window as any).__pushOpts)).toEqual({
      userVisibleOnly: true,
      key: 65,
    });
    expect(await page.evaluate(() => (window as any).__pushSent)).toEqual([
      [
        "push-subscribe",
        {
          endpoint: "https://fcm.googleapis.com/fcm/send/this-phone",
          keys: expect.objectContaining({ auth: "tBHItJI5svbpez7KI4CCXg" }),
        },
      ],
    ]);
    // Game news from the admins: on by default, off on this device.
    await expect(news).toBeVisible();
    await expect(news).toHaveAttribute("aria-checked", "true");
    await snap(page, info, "chat-push-on-844x390");
    await news.click();
    await expect(news).toHaveAttribute("aria-checked", "false");
    expect(
      await page.evaluate(() => (window as any).__pushSent.at(-1)),
    ).toEqual([
      "push-news",
      { endpoint: "https://fcm.googleapis.com/fcm/send/this-phone", on: false },
    ]);
    // Off again.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(
      await page.evaluate(() => (window as any).__pushSent.at(-1)),
    ).toEqual([
      "push-unsubscribe",
      { endpoint: "https://fcm.googleapis.com/fcm/send/this-phone" },
    ]);
    // Said no in the browser: explained, and the switch can't undo it.
    await page.evaluate(() => ((window as any).__permission = "denied"));
    await page.click("#chat-drawer .chat-gear");
    await page.click("#chat-drawer .chat-gear");
    await expect(page.locator("#chat-drawer .chat-push-note")).toHaveText(
      "Notifications are blocked for this game in your browser settings.",
    );
    await expect(toggle).toBeDisabled();
    // A server without notification keys: nothing offered.
    await page.evaluate(() => ((window as any).__pushKey = null));
    await page.click("#chat-drawer .chat-gear");
    await page.click("#chat-drawer .chat-gear");
    await expect(page.locator("#chat-drawer .chat-push")).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }

  // iPhone Safari, not on the Home Screen: how to get them, switch off.
  const iphone = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  });
  try {
    const page = await iphone.newPage();
    await page.addInitScript(() => {
      delete (window as any).PushManager;
    });
    await openHub(page);
    await page.evaluate(() => {
      const w = window as any;
      const before = w.__reply;
      w.__reply = (ev: string, data: any) =>
        ev === "push-config"
          ? {
              ok: true,
              key: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
            }
          : before?.(ev, data);
    });
    await page.click("#chat-button");
    await page.click("#chat-drawer .chat-gear");
    await expect(page.locator("#chat-drawer .chat-push-note")).toContainText(
      "add the game to your Home Screen first",
    );
    await expect(page.locator("#chat-drawer .chat-push-toggle")).toBeDisabled();
  } finally {
    await iphone.close();
  }
});

// A refused message (a link): the note under the field is cream words
// after the amber warning sign, on one line (themes/poster/notices.css).
// It was a whole sentence in pink.
for (const size of [
  { name: "844x390", width: 844, height: 390 },
  { name: "667x375", width: 667, height: 375 },
])
  test(`a refused message says why, in cream after a warning sign (${size.name})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      // In the look players have: the rest of this file still measures the
      // look underneath, where this note is a sentence in pink.
      await playersLook(context);
      const page = await context.newPage();
      const errors = await openHub(page);
      await page.evaluate(
        ([me, pal]) => {
          const w = window as any;
          w.__sock.fire("chat-config", { freeText: true });
          w.__sock.fire("party", {
            code: "PARTY2",
            leader: me,
            members: [
              { id: me, name: "tester", character: "voltkit" },
              { id: pal, name: "Pal", character: "tidefin" },
            ],
          });
        },
        [ME, PAL],
      );
      await page.click("#chat-button");
      await page.locator("#chat-input").fill("look at http://example.com/free");
      await page.locator("#chat-drawer .chat-send").click();
      const note = page.locator("#chat-drawer .chat-note");
      await expect(note).toHaveText("Links can't be sent in chat.");
      const look = await note.evaluate((n) => {
        const cs = getComputedStyle(n),
          sign = getComputedStyle(n, "::before"),
          r = n.getBoundingClientRect();
        return {
          words: cs.color,
          sign: sign.backgroundColor,
          signWidth: parseFloat(sign.width),
          lines: Math.round(r.height / parseFloat(cs.lineHeight)),
          inView: r.bottom <= innerHeight && r.right <= innerWidth,
        };
      });
      expect(look.words).toBe("rgb(244, 234, 213)");
      expect(look.sign).toBe("rgb(255, 162, 31)");
      expect(look.signWidth).toBeGreaterThanOrEqual(10);
      expect(look.lines).toBe(1);
      expect(look.inView).toBe(true);
      await snap(page, info, `chat-refused-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// The drawer's last old-look pieces, in the look players have
// (themes/poster/chat.css): a sender's name is cream (it was blue) and
// your own has a gold square before it, a time is the kit's grey, and the settings' two switches are one square row
// each, a finger tall ("Notify me" was still a rounded pill, 40 px).
for (const size of [
  { name: "844x390", width: 844, height: 390 },
  { name: "667x375", width: 667, height: 375 },
])
  test(`the chat in Poster: cream names, square switches a finger tall (${size.name})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      await playersLook(context);
      const page = await context.newPage();
      const errors = await openHub(page);
      await page.evaluate(
        ([me, pal]) => {
          const w = window as any;
          const before = w.__reply;
          w.__reply = (ev: string, data: any) =>
            ev === "chat-history"
              ? {
                  ok: true,
                  lines: [
                    {
                      id: 1,
                      channel: "party",
                      from: { id: pal, name: "Pal" },
                      at: Date.now() - 600_000,
                      text: "ready when you are",
                    },
                    {
                      id: 2,
                      channel: "party",
                      from: { id: me, name: "tester" },
                      at: Date.now() - 60_000,
                      text: "one more match",
                    },
                  ],
                }
              : before?.(ev, data);
          w.__sock.fire("chat-config", { freeText: true });
          w.__sock.fire("party", {
            code: "PARTY5",
            leader: me,
            members: [
              { id: me, name: "tester", character: "voltkit" },
              { id: pal, name: "Pal", character: "tidefin" },
            ],
          });
        },
        [ME, PAL],
      );
      await page.click("#chat-button");
      const drawer = page.locator("#chat-drawer");
      await expect(drawer.locator(".chat-line")).toHaveCount(2);
      const colour = (selector: string) =>
        drawer
          .locator(selector)
          .first()
          .evaluate((e) => getComputedStyle(e).color);
      expect(await colour(".chat-line:not(.is-mine) b")).toBe(
        "rgb(244, 234, 213)",
      );
      expect(await colour(".chat-stamp")).toBe("rgb(184, 184, 192)");
      // Your own line: the name cream too, after a small gold square.
      expect(await colour(".chat-line.is-mine b")).toBe("rgb(244, 234, 213)");
      const mark = (selector: string) =>
        drawer
          .locator(selector)
          .first()
          .evaluate((e) => {
            const c = getComputedStyle(e, "::before");
            return c.content === "none" ? "" : c.backgroundColor;
          });
      expect(await mark(".chat-line.is-mine b")).toBe("rgb(255, 214, 91)");
      expect(await mark(".chat-line:not(.is-mine) b")).toBe("");
      await snap(page, info, `chat-poster-lines-${size.name}`);

      // The settings, with both switches shown (a phone that can notify).
      await drawer.locator(".chat-gear").click();
      await drawer.evaluate((d) => {
        for (const s of [".chat-push", ".chat-news-toggle"])
          d.querySelector<HTMLElement>(s)!.hidden = false;
      });
      const rows = await drawer.evaluate((d) =>
        [".chat-push-toggle", ".chat-news-toggle", ".chat-modes button"].map(
          (s) => {
            const e = d.querySelector<HTMLElement>(s)!;
            const r = e.getBoundingClientRect();
            const c = getComputedStyle(e);
            return {
              s,
              x: Math.round(r.x),
              w: Math.round(r.width),
              h: Math.round(r.height),
              radius: c.borderTopLeftRadius,
              knob: getComputedStyle(e, "::before").borderTopLeftRadius,
            };
          },
        ),
      );
      const [push, news, mode] = rows;
      for (const row of rows) {
        expect(row.h, row.s).toBeGreaterThanOrEqual(44);
        expect(row.radius, row.s).toBe("0px");
      }
      expect(push.knob).toBe("0px");
      expect(news.knob).toBe("0px");
      expect([push.x, push.w]).toEqual([news.x, news.w]);
      expect(mode.x).toBe(push.x);
      await snap(page, info, `chat-poster-settings-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
