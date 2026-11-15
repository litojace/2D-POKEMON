import { expect, test, type Browser, type Page } from "@playwright/test";
import { openHub, openPlayPanel, snap } from "./helpers";
import { fakeFarm } from "./farm-fake";
import { fakeBistro } from "./bistro-fake";

/**
 * In-game chat on phones (chat/chat-ui.ts, docs/chat-plan.md):
 *
 * - the chat button sits 12 px right of the player card (or the Farm's and
 *   the Bistro's badge) on every hub scene, clear of the scene switch, at
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
/** Switch hub scene (a script click: the Farm can keep the page busy). */
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
    await fakeFarm(page);
    await fakeBistro(page);
    await page.evaluate(() => localStorage.setItem("ea-plaza-help", "1"));
    for (const [name, card] of [
      ["lobby", "#account-profile"],
      ["plaza", "#account-profile"],
      ["farm", "#fm-badge"],
      ["bistro", "#bs-badge"],
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
              "#account-leaves",
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
      await fakeFarm(page);
      await fakeBistro(page);
      await page.evaluate(() => localStorage.setItem("ea-plaza-help", "1"));
      await scene(page, "plaza");
      await expect(page.locator(".plaza-layer #pz-cv")).toBeVisible();
      await checkButton(page, "#account-profile");
      await scene(page, "farm");
      await expect(page.locator("#fm-badge")).toBeVisible({ timeout: 30_000 });
      await checkButton(page, "#fm-badge");
      await scene(page, "bistro");
      await expect(page.locator(".bistro-layer .bs-cv")).toBeVisible();
      await checkButton(page, "#bs-badge");
      await scene(page, "lobby");
      await expect(page.locator("#lobby-play")).toBeVisible();

      // No party: only Friends, and no friends yet, so it says how.
      await page.click("#chat-button");
      await expect(page.locator("#chat-drawer .chat-tab")).toHaveText([
        "Friends",
      ]);
      await expect(page.locator("#chat-drawer .chat-empty")).toContainText(
        "Add friends (Menu → Friends) to message them here.",
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

      // A room: the button top left, clear of the seats.
      await page.evaluate(() =>
        (window as any).__room("pvp", { mode: "teams", phase: "lobby" }),
      );
      await openPlayPanel(page);
      await page.click('#menu [data-mode="teams"]');
      await page.click("#play-create");
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
      const [btn, panel] = await Promise.all([
        box(page, "#chat-button"),
        box(page, ".room-screen .room-banner"),
      ]);
      expect(btn.y + btn.height).toBeLessThanOrEqual(panel.y);
      expect(btn.x).toBeGreaterThanOrEqual(size.inset[0]);
      await page.click("#chat-button");
      // The room, just joined, comes first.
      await expect(drawer.locator('[data-chat-tab="room"]')).toHaveAttribute(
        "aria-selected",
        "true",
      );
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
