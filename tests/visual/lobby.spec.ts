import { expect, test, type Page } from "@playwright/test";
import { openLobby, openPlayPanel, snap } from "./helpers";
import { shopServer } from "./shop-server";

// Hub redesign phase 2: the Lobby is the first screen after login. The UI
// rules from the handoff: HUD boxes keep a fixed size, text is centred in its
// box, buttons line up, all game text is English, and phone landscape down to
// 700 px wide has no overlaps.
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 844, height: 390 },
  { width: 700, height: 390 },
];
type Box = { name: string; x: number; y: number; w: number; h: number };

async function boxes(page: Page) {
  return page.evaluate(() => {
    const out: Box[] = [];
    const add = (name: string, el: Element | null) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (
        !r.width ||
        !r.height ||
        style.display === "none" ||
        style.visibility === "hidden"
      )
        return;
      out.push({ name, x: r.left, y: r.top, w: r.width, h: r.height });
    };
    add("profile", document.querySelector("#account-profile"));
    add("scenes", document.querySelector("#hub-scenes"));
    add("coins", document.querySelector("#account-coins > *"));
    add("menu", document.querySelector(".header-menu > summary"));
    add("rail", document.querySelector(".lobby-rail"));
    add("party", document.querySelector(".lobby-party"));
    add("nameplate", document.querySelector(".lobby-nameplate"));
    document
      .querySelectorAll(".lobby-card")
      .forEach((c, i) => add(`card${i}`, c));
    add("play", document.querySelector(".lobby-play"));
    return out;
  });
}
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.w - 1 &&
  b.x < a.x + a.w - 1 &&
  a.y < b.y + b.h - 1 &&
  b.y < a.y + a.h - 1;

async function hudSizes(page: Page) {
  return page.evaluate(() =>
    [
      "#account-profile",
      "#account-coins > *",
      "#account-profile .nav-level",
      "#hub-scenes",
    ].map((s) => {
      const r = document.querySelector(s)!.getBoundingClientRect();
      return [s, Math.round(r.width), Math.round(r.height)];
    }),
  );
}

for (const viewport of VIEWPORTS) {
  test(`the Lobby fits without overlaps and keeps its HUD fixed at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    const phone = viewport.width < 1000;
    const context = await browser.newContext({
      viewport,
      isMobile: phone,
      hasTouch: phone,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      await expect(page.locator("#lobby-fighter-name")).not.toBeEmpty();
      await expect(
        page.locator('#hub-scenes [data-hub-scene="lobby"]'),
      ).toHaveAttribute("aria-pressed", "true");
      // Lobby and Plaza only (the Farm and the Bistro are gone).
      await expect(page.locator("#hub-scenes [data-hub-scene]")).toHaveCount(2);
      await expect(
        page.locator('#hub-scenes [data-hub-scene="farm"]'),
      ).toHaveCount(0);
      await snap(page, info, `lobby-${viewport.width}x${viewport.height}`);

      // Nothing overlaps and everything stays on screen.
      const all = await boxes(page);
      for (const b of all) {
        expect(b.x, `${b.name} left edge`).toBeGreaterThanOrEqual(-1);
        expect(b.y, `${b.name} top edge`).toBeGreaterThanOrEqual(-1);
        expect(b.x + b.w, `${b.name} right edge`).toBeLessThanOrEqual(
          viewport.width + 1,
        );
        expect(b.y + b.h, `${b.name} bottom edge`).toBeLessThanOrEqual(
          viewport.height + 1,
        );
      }
      const clashes = all.flatMap((a, i) =>
        all
          .slice(i + 1)
          .filter((b) => overlap(a, b))
          .map((b) => `${a.name} × ${b.name}`),
      );
      expect(clashes).toEqual([]);

      // Buttons line up: the rail is one column, PLAY and the mode share edges.
      const lines = await page.evaluate(() => {
        const rail = [...document.querySelectorAll(".lobby-rail button")].map(
          (b) => b.getBoundingClientRect(),
        );
        const mode = document
          .querySelector("#lobby-mode")!
          .getBoundingClientRect();
        const play = document
          .querySelector("#lobby-play")!
          .getBoundingClientRect();
        return {
          railLefts: new Set(rail.map((r) => Math.round(r.left))).size,
          railWidths: new Set(rail.map((r) => Math.round(r.width))).size,
          playEdges: [
            Math.round(mode.left - play.left),
            Math.round(mode.right - play.right),
          ],
        };
      });
      expect(lines).toEqual({ railLefts: 1, railWidths: 1, playEdges: [0, 0] });

      // Text sits in the middle of its box.
      const offsets = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            "#hub-scenes button, #lobby-play, #account-profile .nav-level",
          ),
        ].map((el) => {
          const box = el.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(el);
          const text = range.getBoundingClientRect();
          return Math.abs(
            text.left + text.width / 2 - (box.left + box.width / 2),
          );
        }),
      );
      for (const o of offsets) expect(o).toBeLessThanOrEqual(2);

      // English only in the game UI.
      const text = await page.evaluate(
        () =>
          (document.querySelector(".lobby-layer") as HTMLElement).innerText +
          (document.querySelector(".topbar") as HTMLElement).innerText,
      );
      expect(text).not.toMatch(
        /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i,
      );

      // HUD boxes keep their size when the numbers grow.
      const before = await hudSizes(page);
      await page.evaluate(() => {
        const fetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const response = await fetch(input, init);
          if (!String(input).includes("/api/economy")) return response;
          const body = await response.json();
          return new Response(
            JSON.stringify({
              ...body,
              balance: 9999999,
              journey: { ...body.journey, xp: 431625 },
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        };
      });
      await page.click('[data-lobby-action="missions"]');
      await expect(page.locator("#account-coins")).toContainText("10M");
      await expect(page.locator("#account-coins")).toHaveAttribute(
        "aria-label",
        /9,999,999/,
      );
      await expect(page.locator("#account-profile .nav-level")).toHaveText(
        "Lv 100",
      );
      await page.keyboard.press("Escape");
      expect(await hudSizes(page)).toEqual(before);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

// The mode menu opens over the cards' column: as wide as it, under the
// header (it used to run up behind the coins and the gear, and the cards
// showed through it), and a long list scrolls inside it. 932x430 with a
// Dynamic Island is the phone it was reported on.
for (const view of [
  { width: 932, height: 430, inset: { left: 59, right: 59, bottom: 21 } },
  { width: 1280, height: 720, inset: null },
]) {
  test(`the mode menu stays under the header and inside its column at ${view.width}x${view.height}`, async ({
    browser,
  }) => {
    const phone = view.width < 1000;
    const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      isMobile: phone,
      hasTouch: phone,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      if (view.inset)
        await page.evaluate((inset) => {
          for (const [key, value] of Object.entries(inset))
            document.documentElement.style.setProperty(
              `--safe-${key}`,
              `${value}px`,
            );
        }, view.inset);
      await page.click("#lobby-mode");
      const menu = page.locator("#lobby-mode-menu");
      await expect(menu).toBeVisible();
      const m = await page.evaluate(() => {
        const r = (s: string) =>
          document.querySelector(s)!.getBoundingClientRect();
        const menu = r("#lobby-mode-menu"),
          mode = r("#lobby-mode");
        const header = Math.max(
          r("#account-profile").bottom,
          r("#account-coins > *").bottom,
          r(".header-menu > summary").bottom,
          r("#hub-scenes").bottom,
        );
        return {
          belowHeader: Math.round(menu.top - header),
          left: Math.round(menu.left - mode.left),
          right: Math.round(menu.right - mode.right),
          gap: Math.round(mode.top - menu.bottom),
          cards: getComputedStyle(document.querySelector(".lobby-cards")!)
            .visibility,
        };
      });
      expect(m.belowHeader, "menu top under the header").toBeGreaterThanOrEqual(
        4,
      );
      expect([m.left, m.right], "menu edges = the column's").toEqual([0, 0]);
      expect(m.gap, "8px above the mode button").toBe(8);
      expect(m.cards, "the cards step aside").toBe("hidden");
      // The last mode is reachable (the list scrolls inside the menu).
      await page.click('[data-lobby-mode="bot-hard"]');
      await expect(menu).toBeHidden();
      await expect(page.locator("#lobby-mode")).toContainText("Vs AI · Hard");
      await expect(page.locator(".lobby-cards")).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

// The rail keeps 12px under the player card (its frame's star row hangs
// below the card) and runs down to PLAY's bottom line: six buttons, each a
// finger (44 pt) tall, on the shortest phone too.
for (const view of [
  { width: 932, height: 430, inset: { left: 59, right: 59, bottom: 21 } },
  { width: 852, height: 393, inset: { left: 59, right: 59, bottom: 21 } },
  { width: 667, height: 375, inset: null },
  { width: 1024, height: 768, inset: null },
]) {
  test(`the rail's six buttons are a finger tall at ${view.width}x${view.height}`, async ({
    browser,
  }) => {
    const touch = view.width < 1100;
    const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      isMobile: touch,
      hasTouch: touch,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      if (view.inset)
        await page.evaluate((inset) => {
          for (const [key, value] of Object.entries(inset))
            document.documentElement.style.setProperty(
              `--safe-${key}`,
              `${value}px`,
            );
        }, view.inset);
      const rect = (s: string) =>
        page.evaluate((s) => {
          const r = document.querySelector(s)!.getBoundingClientRect();
          return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width };
        }, s);
      const card = await rect("#account-profile"),
        first = await rect(".lobby-rail button"),
        last = await rect(".lobby-rail button:last-child"),
        play = await rect("#lobby-play");
      expect(first.t - card.b, "rail under the card").toBeGreaterThanOrEqual(
        12,
      );
      expect(last.b - play.b, "rail down to PLAY's bottom line").toBeLessThan(
        1,
      );
      const heights = await page
        .locator(".lobby-rail button")
        .evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().height));
      expect(heights).toHaveLength(6);
      for (const h of heights)
        expect(h, "a rail button's height").toBeGreaterThanOrEqual(44);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("the mode menu picks and remembers a mode, and the scene switch opens the Plaza", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await page.click("#lobby-mode");
    const menu = page.locator("#lobby-mode-menu");
    await expect(menu).toBeVisible();
    await snap(page, info, "lobby-mode-menu-844x390");
    await page.click('[data-lobby-mode="bot-hard"]');
    await expect(menu).toBeHidden();
    await expect(page.locator("#lobby-mode")).toContainText("Vs AI · Hard");
    expect(
      await page.evaluate(() => localStorage.getItem("arena-lobby-mode")),
    ).toBe("bot-hard");

    // The rail's Fighters opens the roster inside the Lobby (UI remodel
    // step 3).
    await page.click('[data-lobby-action="fighters"]');
    const drawer = page.locator(".roster-room");
    await expect(drawer).toBeVisible();
    expect(
      await drawer.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(
          document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2),
        );
      }),
    ).toBe(true);
    await page.locator(".roster-room .ui-close").click();
    await expect(drawer).toHaveCount(0);

    // The arrows change the fighter.
    const first = await page.locator("#lobby-fighter-name").textContent();
    await page.click('[data-lobby-step="1"]');
    await expect(page.locator("#lobby-fighter-name")).not.toHaveText(
      first ?? "",
    );

    // Plaza opens the walkable world; Lobby comes back.
    await page.click('#hub-scenes [data-hub-scene="plaza"]');
    await expect(page.locator(".plaza-layer #pz-cv")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator(".lobby-layer")).toHaveCount(0);
    await page.click('#hub-scenes [data-hub-scene="lobby"]');
    await expect(page.locator("#lobby-play")).toBeVisible();
    // The Plaza waits behind the Lobby, hidden.
    await expect(page.locator(".plaza-layer")).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("PLAY creates a private room in the chosen mode", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await page.evaluate(() => {
      const w = window as any;
      w.__room("pvp", { phase: "lobby" });
      w.__requests = [];
      const reply = w.__reply;
      w.__reply = (ev: string, data: unknown) => {
        w.__requests.push([ev, data]);
        return reply(ev, data);
      };
    });
    await page.click("#lobby-mode");
    // On your own, rooms you can't fill aren't listed (modeListed).
    await expect(page.locator('[data-lobby-mode="teams"]')).toBeHidden();
    await expect(page.locator('[data-lobby-mode="ffa"]')).toBeHidden();
    await page.click('[data-lobby-mode="duel"]');
    await page.click("#lobby-play");
    await expect(page.locator(".lobby-layer")).toHaveCount(0);
    await expect(page.locator("body")).toHaveClass(/lobby-active/);
    const create = await page.evaluate(() =>
      (window as any).__requests.find(([ev]: [string]) => ev === "create"),
    );
    expect(create?.[1]).toMatchObject({ mode: "duel" });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("a party shows friends beside you, and a party invitation joins it", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    const me = "11111111-1111-4111-8111-111111111111",
      pal = "33333333-3333-4333-8333-333333333333",
      lead = "44444444-4444-4444-8444-444444444444";
    await page.evaluate(() => {
      const w = window as any;
      w.__requests = [];
      w.__reply = (ev: string, data: unknown) => {
        w.__requests.push([ev, data]);
        return { ok: true };
      };
    });
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
      [me, pal],
    );
    await expect(page.locator("#lobby-party-bar")).toContainText("Party · 2/4");
    await expect(page.locator("#lobby-slot-0 .lobby-member")).toContainText(
      "Pal",
    );
    // You lead: your crown under your fighter, in the element pill's place.
    await expect(page.locator("#lobby-host-name")).toHaveText("♛ You");
    await expect(page.locator("#lobby-host-name")).toBeVisible();
    await expect(page.locator("#lobby-fighter-element")).toBeHidden();
    await expect(
      page.locator("#lobby-slot-1 [data-lobby-action=invite]"),
    ).toBeVisible();
    // With one friend, one seat on each side: the third waits.
    await expect(page.locator("#lobby-slot-2")).toBeHidden();
    await snap(page, info, "lobby-party-844x390");
    // A third player fills the right seat, and the fourth seat appears
    // straight above it, clear of the fighter.
    await page.evaluate(
      ([me, pal]) =>
        (window as any).__sock.fire("party", {
          code: "PARTY2",
          leader: me,
          members: [
            { id: me, name: "tester", character: "voltkit" },
            { id: pal, name: "Pal", character: "tidefin" },
            {
              id: "66666666-6666-4666-8666-666666666666",
              name: "Bo",
              character: "voltkit",
            },
          ],
        }),
      [me, pal],
    );
    await expect(page.locator("#lobby-party-bar")).toContainText("Party · 3/4");
    await expect(page.locator("#lobby-slot-1 .lobby-member")).toContainText(
      "Bo",
    );
    const third = page.locator("#lobby-slot-2 [data-lobby-action=invite]");
    await expect(third).toBeVisible();
    const seats = await page.evaluate(() =>
      ["#lobby-slot-1 > *", "#lobby-slot-2 > *", "#lobby-fighter"].map((s) => {
        const b = document.querySelector(s)!.getBoundingClientRect();
        return { l: b.left, t: b.top, r: b.right, b: b.bottom };
      }),
    );
    const [right, above, fighter] = seats;
    expect(
      Math.abs((above.l + above.r) / 2 - (right.l + right.r) / 2),
    ).toBeLessThanOrEqual(1);
    expect(above.b).toBeLessThanOrEqual(right.t);
    expect(above.l).toBeGreaterThanOrEqual(fighter.r);
    await snap(page, info, "lobby-party-full-844x390");
    // A party invitation from someone else.
    await page.evaluate(
      (lead) =>
        (window as any).__sock.fire("room-invite", {
          id: "55555555-5555-4555-8555-555555555555",
          fromId: lead,
          name: "Lead",
          code: "PARTY9",
          mode: "party",
          expiresAt: Date.now() + 60000,
        }),
      lead,
    );
    const notice = page.locator(".room-invite-notice");
    await expect(notice).toContainText("Party invitation");
    await expect(notice).toContainText("invited you to their party");
    await notice.locator("[data-invite-join]").click();
    await expect(notice).toBeHidden();
    const accept = await page.evaluate(() =>
      (window as any).__requests.find(
        ([ev]: [string]) => ev === "party-accept",
      ),
    );
    expect(accept?.[1]).toMatchObject({ code: "PARTY9" });
    // Leaving the party asks the server.
    const leave = page.locator('[data-lobby-action="leave-party"]');
    await expect(leave).toBeVisible();
    const hit = await leave.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2,
      );
      return el.contains(top)
        ? "ok"
        : (top?.outerHTML.slice(0, 120) ?? "nothing");
    });
    expect(hit).toBe("ok");
    await leave.click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).__requests.some(
            ([ev]: [string]) => ev === "party-leave",
          ),
        ),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("in a friend's party the leader stands in the middle, you beside them, and Rejoin brings you back", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    const me = "11111111-1111-4111-8111-111111111111",
      lead = "44444444-4444-4444-8444-444444444444",
      pal = "33333333-3333-4333-8333-333333333333";
    await page.evaluate(() => {
      const w = window as any;
      w.__requests = [];
      w.__reply = (ev: string, data: unknown) => {
        w.__requests.push([ev, data]);
        return ev === "join"
          ? { ok: false, error: "Room not found." }
          : { ok: true };
      };
    });
    const fire = (room: { code: string; mode: string } | null) =>
      page.evaluate(
        ([me, lead, pal, room]) =>
          (window as any).__sock.fire("party", {
            code: "PARTY3",
            leader: lead,
            members: [
              { id: lead, name: "Leader", character: "tidefin" },
              { id: me, name: "tester", character: "voltkit" },
              { id: pal, name: "Pal", character: "lumoth", away: true },
            ],
            room,
            invites: [],
          }),
        [me, lead, pal, room] as const,
      );
    await fire(null);
    // The leader's fighter in the middle, with their name in the pill's place.
    await expect(page.locator("#lobby-fighter-art")).toHaveAttribute(
      "data-preview-champion",
      "tidefin",
    );
    await expect(page.locator("#lobby-host-name")).toHaveText("♛ Leader");
    await expect(page.locator("#lobby-host-name")).toBeVisible();
    await expect(page.locator("#lobby-fighter-element")).toBeHidden();
    // Your own seat first (left), then the others; your arrows wait.
    const mine = page.locator("#lobby-slot-0 .lobby-member");
    await expect(mine).toHaveClass(/is-you/);
    await expect(mine.locator("figcaption")).toHaveText("You");
    await expect(page.locator("#lobby-slot-1 .lobby-member")).toContainText(
      "Pal",
    );
    await expect(page.locator("#lobby-slot-1 .lobby-member")).toHaveClass(
      /is-away/,
    );
    for (const step of await page.locator(".lobby-step").all())
      await expect(step).toHaveCSS("visibility", "hidden");
    // The leader's name stays on the fighter's axis (the arrows keep their
    // place in the nameplate).
    const axis = await page.evaluate(() => {
      const mid = (s: string) => {
        const b = document.querySelector(s)!.getBoundingClientRect();
        return b.left + b.width / 2;
      };
      return [mid("#lobby-fighter"), mid(".lobby-name")];
    });
    expect(Math.abs(axis[0] - axis[1])).toBeLessThanOrEqual(2);
    // A member may invite too: the open seat (above Pal) offers it.
    await expect(
      page.locator("#lobby-slot-2 [data-lobby-action=invite]"),
    ).toBeVisible();
    // Nothing on the stage overlaps: seats beside the leader, all on screen.
    const boxes = await page.evaluate(() =>
      ["#lobby-slot-0 > *", "#lobby-fighter", "#lobby-slot-1 > *"].map((s) => {
        const b = document.querySelector(s)!.getBoundingClientRect();
        return { l: b.left, r: b.right, t: b.top, b: b.bottom };
      }),
    );
    expect(boxes[0].r).toBeLessThanOrEqual(boxes[1].l + 1);
    expect(boxes[2].l).toBeGreaterThanOrEqual(boxes[1].r - 1);
    for (const b of boxes) {
      expect(b.l).toBeGreaterThanOrEqual(0);
      expect(b.r).toBeLessThanOrEqual(844);
    }
    // Tapping your seat opens Fighters, to change your fighter.
    const tap = page.locator("#lobby-slot-0 .lobby-member-tap");
    await expect(tap).toHaveAttribute("data-lobby-action", "fighters");
    // No room yet: no Rejoin. The leader opens one you stepped out of...
    await expect(page.locator("#lobby-rejoin")).toBeHidden();
    await page.evaluate(() => {
      (window as any).__requests = [];
    });
    await fire({ code: "ROOM42", mode: "teams" });
    // ...you follow it straight from the Lobby.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).__requests.filter(([ev]: [string]) => ev === "join")
              .length,
        ),
      )
      .toBe(1);
    // The join failed (here): Rejoin waits on the party bar, tried on a tap.
    await expect(page.locator("#lobby-rejoin")).toBeVisible();
    await snap(page, info, "lobby-party-member-844x390");
    await page.locator("#lobby-rejoin").click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).__requests.filter(
              ([ev, d]: [string, any]) => ev === "join" && d?.code === "ROOM42",
            ).length,
        ),
      )
      .toBe(2);
    expect(errors.filter((e) => !/Room not found/.test(e))).toEqual([]);
  } finally {
    await context.close();
  }
});

for (const [width, height] of [
  [568, 320],
  [667, 375],
  [844, 390],
  [932, 430],
] as const)
  test(`the party stage grows into the room a ${width}x${height} phone has, leaving the Plaza around it`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      const me = "11111111-1111-4111-8111-111111111111",
        lead = "44444444-4444-4444-8444-444444444444";
      await page.evaluate(() => {
        const w = window as any;
        w.__reply = () => ({ ok: false, error: "Room not found." });
      });
      // A member's stage at its widest: leader, you, two more, and Rejoin
      // on the party bar.
      await page.evaluate(
        ([me, lead]) =>
          (window as any).__sock.fire("party", {
            code: "PARTY5",
            leader: lead,
            members: [
              { id: lead, name: "Leader", character: "tidefin" },
              { id: me, name: "tester", character: "voltkit" },
              {
                id: "66666666-6666-4666-8666-666666666666",
                name: "Bo",
                character: "lumoth",
              },
              {
                id: "77777777-7777-4777-8777-777777777777",
                name: "Rae",
                character: "cindrake",
              },
            ],
            room: { code: "ROOM77", mode: "ffa" },
          }),
        [me, lead] as const,
      );
      await expect(page.locator("#lobby-rejoin")).toBeVisible();
      const box = (s: string) =>
        page.locator(s).evaluate((e) => {
          const b = e.getBoundingClientRect();
          return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width };
        });
      const [bar, fighter, row, s0, s1, s2] = await Promise.all(
        [
          "#lobby-party-bar",
          "#lobby-fighter",
          ".lobby-party",
          "#lobby-slot-0",
          "#lobby-slot-1",
          "#lobby-slot-2",
        ].map(box),
      );
      const apart = (a: typeof bar, b: typeof bar) =>
        a.r <= b.l + 1 || b.r <= a.l + 1 || a.b <= b.t + 1 || b.b <= a.t + 1;
      // The seats grew past 36% of the fighter, but stay under 46% of it.
      expect(s0.w).toBeGreaterThan(fighter.w * 0.36 + 2);
      expect(s0.w).toBeLessThanOrEqual(fighter.w * 0.451);
      // Nothing overlaps: the bar, the seats and the fighter beside them.
      for (const seat of [s0, s1, s2]) {
        expect(apart(seat, bar)).toBe(true);
        expect(apart(seat, fighter)).toBe(true);
        expect(seat.t).toBeGreaterThanOrEqual(row.t - 1);
        expect(seat.l).toBeGreaterThanOrEqual(row.l - 1);
        expect(seat.r).toBeLessThanOrEqual(row.r + 1);
      }
      // The bar covers only the fighter frame's empty top band (11.2%).
      expect(bar.b).toBeLessThanOrEqual(fighter.t + fighter.w * 0.112 + 1);
      expect(fighter.b).toBeLessThanOrEqual(row.b + 1);
      // The Plaza still shows: the stage leaves room on both sides.
      expect(s0.l - row.l + (row.r - s1.r)).toBeGreaterThan(0);
      if (width === 844) await snap(page, info, "lobby-party-grown-844x390");
      expect(errors.filter((e) => !/Room not found/.test(e))).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("a member's stage wears everyone's own skin, Awakening stage and look", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    // Your own: a Shop skin on Voltkit and an aura (your account's save).
    await shopServer(page, {
      owned: ["voltkit-stormcrown", "galaxy-aura"],
      loadout: { aura: "galaxy-aura" },
      looks: { voltkit: { skin: "voltkit-stormcrown", stage: 1 } },
    } as Parameters<typeof shopServer>[1]);
    const errors = await openLobby(page);
    const me = "11111111-1111-4111-8111-111111111111",
      kai = "44444444-4444-4444-8444-444444444444",
      bo = "66666666-6666-4666-8666-666666666666";
    // The others' saves, as the server reads them from their accounts.
    await page.evaluate(
      ([me, kai, bo]) =>
        (window as any).__sock.fire("party", {
          code: "PARTY7",
          leader: kai,
          members: [
            {
              id: kai,
              name: "Kai",
              character: "tidefin",
              skin: { skin: "tidefin-nova-vanguard", stage: 3 },
              look: { aura: "tidal-aura" },
            },
            { id: me, name: "tester", character: "voltkit" },
            {
              id: bo,
              name: "Bo",
              character: "lumoth",
              skin: { skin: "lumoth-dream-carnival", stage: 2 },
              look: { aura: "ember-aura" },
            },
          ],
          room: null,
          invites: [],
        }),
      [me, kai, bo] as const,
    );
    const worn = (s: string) =>
      page.locator(s).evaluate((e) => ({
        champion: (e as HTMLElement).dataset.previewChampion,
        item: (e as HTMLElement).dataset.previewItem,
        stage: (e as HTMLElement).dataset.previewStage,
        look: JSON.parse(
          decodeURIComponent(
            (e as HTMLElement).dataset.previewLook ?? "%7B%7D",
          ),
        ),
      }));
    // The leader in the middle, in their skin, stage and aura...
    await expect
      .poll(() => worn("#lobby-fighter-art"))
      .toEqual({
        champion: "tidefin",
        item: "tidefin-nova-vanguard",
        stage: "3",
        look: { aura: "tidal-aura" },
      });
    // ...you beside them in yours, and the third member in theirs.
    await expect
      .poll(() => worn("#lobby-slot-0 .lobby-member-art"))
      .toMatchObject({
        champion: "voltkit",
        item: "voltkit-stormcrown",
        stage: "1",
        look: { aura: "galaxy-aura" },
      });
    expect(await worn("#lobby-slot-1 .lobby-member-art")).toEqual({
      champion: "lumoth",
      item: "lumoth-dream-carnival",
      stage: "2",
      look: { aura: "ember-aura" },
    });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("the leader removes a member with Kick, and members may invite too", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    const me = "11111111-1111-4111-8111-111111111111",
      kai = "44444444-4444-4444-8444-444444444444",
      bo = "66666666-6666-4666-8666-666666666666";
    await page.evaluate(() => {
      const w = window as any;
      w.__requests = [];
      w.__reply = (ev: string, data: unknown) => {
        w.__requests.push([ev, data]);
        return { ok: true };
      };
    });
    const fire = (leader: string) =>
      page.evaluate(
        ([me, kai, bo, leader]) =>
          (window as any).__sock.fire("party", {
            code: "PARTY8",
            leader,
            members: [
              {
                id: leader === me ? me : kai,
                name: leader === me ? "tester" : "Kai",
                character: leader === me ? "voltkit" : "tidefin",
              },
              {
                id: leader === me ? kai : me,
                name: leader === me ? "Kai" : "tester",
                character: leader === me ? "tidefin" : "voltkit",
              },
              { id: bo, name: "Bo", character: "lumoth" },
            ],
            room: null,
            invites: [],
          }),
        [me, kai, bo, leader] as const,
      );
    // Leading: a tap on Kai's seat swaps the name tag for Kick...
    await fire(me);
    const kaiSeat = page.locator("#lobby-slot-0 .lobby-member");
    await expect(kaiSeat).toContainText("Kai");
    const kick = kaiSeat.locator("[data-lobby-kick]");
    await expect(kick).toBeHidden();
    await kaiSeat.locator("[data-lobby-member]").click();
    await expect(kick).toBeVisible();
    await expect(kaiSeat.locator("figcaption")).toHaveCSS(
      "visibility",
      "hidden",
    );
    // ...another tap elsewhere puts it away; Kick itself asks the server.
    await page
      .locator(".lobby-backdrop")
      .click({ force: true, position: { x: 400, y: 380 } });
    await expect(kick).toBeHidden();
    await kaiSeat.locator("[data-lobby-member]").click();
    await kick.click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).__requests.find(
            ([ev]: [string]) => ev === "party-kick",
          ),
        ),
      )
      .toEqual(["party-kick", { playerId: kai }]);
    // A member: no Kick on anyone, and an open seat to invite into.
    await fire(kai);
    await expect(
      page.locator("[data-lobby-kick], [data-lobby-member]"),
    ).toHaveCount(0);
    const open = page.locator(".lobby-party [data-lobby-action=invite]");
    await expect(open).toHaveCount(1);
    await open.click();
    await expect(page.locator("#party-invite-list")).toBeVisible();
    await expect(page.locator(".party-invite")).toContainText("Kai's party");
    await page.keyboard.press("Escape");
    // A member's invitation names whose party it is.
    await page.evaluate(
      (bo) =>
        (window as any).__sock.fire("room-invite", {
          id: "55555555-5555-4555-8555-555555555555",
          fromId: bo,
          name: "Bo",
          code: "PARTY9",
          mode: "party",
          expiresAt: Date.now() + 60000,
          leader: "Rae",
        }),
      "77777777-7777-4777-8777-777777777777",
    );
    await expect(page.locator(".room-invite-notice")).toContainText(
      "Bo invited you to Rae's party",
    );
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Invite a friend says In party and Invited for friends already asked", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const me = "11111111-1111-4111-8111-111111111111",
      pal = "33333333-3333-4333-8333-333333333333",
      asked = "77777777-7777-4777-8777-777777777777",
      free = "88888888-8888-4888-8888-888888888888";
    // From the first load (the harness's own stub, fake-api.ts): the Lobby
    // reads the friends list as it opens and keeps that copy for a while
    // (fetchCopy), so a stub put in later isn't asked.
    await page.addInitScript(
      (ids) => {
        (window as any).__friends = {
          code: "ABCDEF12",
          friends: ids.map((id, i) => ({
            id,
            name: ["Pal", "Asked", "Free"][i],
            online: true,
          })),
          incoming: [],
          outgoing: [],
        };
      },
      [pal, asked, free],
    );
    const errors = await openLobby(page);
    await page.evaluate(
      ([me, pal, asked]) =>
        (window as any).__sock.fire("party", {
          code: "PARTY4",
          leader: me,
          members: [
            { id: me, name: "tester", character: "voltkit" },
            { id: pal, name: "Pal", character: "tidefin" },
          ],
          room: null,
          invites: [{ id: asked, expiresAt: Date.now() + 60_000 }],
        }),
      [me, pal, asked] as const,
    );
    await page.locator("#lobby-slot-1 [data-lobby-action=invite]").click();
    const row = (id: string) =>
      page.locator(`#party-invite-list [data-party-invite="${id}"]`);
    await expect(row(pal)).toContainText("In party");
    await expect(row(pal)).toBeDisabled();
    await expect(row(asked)).toContainText("Invited");
    await expect(row(asked)).toBeDisabled();
    await expect(row(free)).toContainText("Invite");
    await expect(row(free)).toBeEnabled();
    // Each friend is the Friends list's row: a portrait with its presence
    // dot, the name, and the gold button on the right, all in one line and
    // inside the row (25 Nov 2026: it was a bare name and a grey button).
    const rows = page.locator("#party-invite-list .ui-row");
    await expect(rows).toHaveCount(3);
    const problems = await rows.evaluateAll((list) =>
      list.flatMap((el) => {
        const out: string[] = [];
        const r = el.getBoundingClientRect();
        const name = el.querySelector(".ui-row-main b")!.textContent;
        const face = el.querySelector(".fr-avatar");
        const dot = el.querySelector(".fr-avatar > .ui-status");
        const button = el.querySelector("button.ui-btn.is-primary");
        if (!face || !dot || !button) return [`${name}: a part is missing`];
        for (const [what, part] of [
          ["portrait", face],
          ["button", button],
        ] as const) {
          const b = part.getBoundingClientRect();
          if (b.left < r.left || b.right > r.right)
            out.push(`${name}: ${what} outside`);
          const off = Math.abs(b.top + b.height / 2 - (r.top + r.height / 2));
          if (off > 2)
            out.push(`${name}: ${what} ${off.toFixed(1)} px off centre`);
        }
        if (el.scrollWidth > el.clientWidth)
          out.push(`${name}: the row overflows`);
        return out;
      }),
    );
    expect(problems).toEqual([]);
    // Invite, Invited and In party are one width, in one column.
    const widths = await rows.evaluateAll((list) =>
      list.map((el) =>
        Math.round(el.querySelector("button")!.getBoundingClientRect().width),
      ),
    );
    expect(new Set(widths).size, `button widths ${widths}`).toBe(1);
    // The title is set as a hub panel's is.
    await expect(page.locator("#dialog .dialog-heading")).toHaveCSS(
      "text-transform",
      "uppercase",
    );
    await snap(page, info, "party-invite-states");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("PLAY has a drawn icon (no emoji), a glow, and a light sweep that rests when asked", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const state = (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const play = document.getElementById("lobby-play")!;
      const sweep = getComputedStyle(play, "::after"),
        glow = getComputedStyle(play.parentElement!, "::before");
      return {
        text: play.textContent!.trim(),
        icon: !!play.querySelector("svg path"),
        sweep: sweep.animationName,
        glow: glow.animationName,
        glowShown: glow.content !== "none" && glow.display !== "none",
        scrollX: document.documentElement.scrollWidth - innerWidth,
      };
    });
  for (const [name, options, sweep, glow] of [
    ["normal", {}, "lobby-play-sweep", "lobby-play-glow"],
    ["reduced motion", { reducedMotion: "reduce" as const }, "none", "none"],
  ] as const) {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      ...options,
    });
    const page = await context.newPage();
    const errors = await openLobby(page);
    const s = await state(page);
    expect(s.text, name).toBe("PLAY");
    expect(s.icon, name).toBe(true);
    expect(s.sweep, name).toBe(sweep);
    expect(s.glow, name).toBe(glow);
    expect(s.glowShown, name).toBe(true);
    expect(s.scrollX, name).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
    await context.close();
  }
  // Low graphics: the glow stays still, the sweep stops.
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
  await openLobby(page);
  const low = await state(page);
  expect(low.sweep).toBe("none");
  expect(low.glow).toBe("none");
  await context.close();
});

// A portrait frame on the player card: portrait-frames.css gives a framed
// card a 14px gap for the old layout, which stacked the three rows (name,
// title, XP bar) 61px tall in the 38px inside the card, the name above it
// and the bar below. The rows stay inside, as without a frame.
for (const view of [
  { width: 1440, height: 900, phone: false },
  { width: 844, height: 390, phone: true },
]) {
  test(`the player card's rows stay inside it with a portrait frame at ${view.width}x${view.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      isMobile: view.phone,
      hasTouch: view.phone,
    });
    try {
      const page = await context.newPage();
      await page.addInitScript(() => {
        (window as any).__raids = {
          loadout: { frame: "conductor-frame" },
          bosses: { "storm-twins": { clears: 99 } },
          clears: 99,
          highestPeril: 3,
          bestSeconds: null,
          titles: [],
          cosmetics: ["conductor-frame"],
        };
      });
      const errors = await openLobby(page);
      await expect(
        page.locator("#account-profile .portrait-frame"),
      ).toBeVisible();
      const rows = await page.evaluate(() => {
        const r = (s: string) =>
          document.querySelector(s)!.getBoundingClientRect();
        const card = r("#account-profile"),
          name = r("#account-profile .account-name"),
          title = r("#account-profile .nav-title"),
          xp = r("#account-profile .nav-xp");
        return {
          top: name.top - card.top,
          order: name.bottom <= title.top && title.bottom <= xp.top,
          bottom: card.bottom - xp.bottom,
        };
      });
      expect(rows.top, "name inside the card's top").toBeGreaterThanOrEqual(2);
      expect(rows.order, "name, title, bar in order, apart").toBe(true);
      expect(
        rows.bottom,
        "bar inside the card's bottom",
      ).toBeGreaterThanOrEqual(2);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

// A sheet on the narrowest phone leaves ~200 px beside it: the fighter
// stands there with its name (the seats and arrows ran off the screen).
test("a sheet on a 667x375 phone keeps the fighter on screen", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 667, height: 375 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await page.click('.lobby-rail [data-lobby-action="missions"]');
    await expect(page.locator(".lobby-layer")).toHaveAttribute(
      "data-ui-sheet",
      "",
    );
    // Measure once the stage has glided beside the sheet (looping
    // animations, such as the fighter's idle, never finish).
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every(
          (a) =>
            a.playState !== "running" ||
            a.effect?.getTiming().iterations === Infinity,
        ),
    );
    const m = await page.evaluate(() => {
      const r = (s: string) =>
        document.querySelector(s)!.getBoundingClientRect();
      return {
        nameplate: r(".lobby-nameplate"),
        fighter: r(".lobby-fighter"),
        play: r(".lobby-play"),
      };
    });
    for (const k of ["nameplate", "fighter"] as const) {
      expect(m[k].right, `${k} on screen`).toBeLessThanOrEqual(667);
      expect(m[k].bottom, `${k} above PLAY`).toBeLessThanOrEqual(m.play.top);
    }
    await expect(page.locator(".lobby-slot-wrap").first()).toBeHidden();
    await expect(page.locator('[data-lobby-step="1"]')).toBeHidden();
    // Closing the sheet brings the seats and arrows back.
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-lobby-step="1"]')).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// The 178 px side column of a phone held sideways (667x375): the chosen
// mode's hint and the cards' own lines read in full, on two lines at most,
// for every mode ("1v1 · a player, or a …" and "Next: Ember Festival frame
// at tie…" before). The mode button is a finger tall and holds both lines.
test("on a 667x375 phone the chosen mode's hint and the cards' lines read in full", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 667, height: 375 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    const cut = () =>
      page.evaluate(() =>
        [
          document.querySelector<HTMLElement>(
            "#lobby-mode .lobby-mode-text small",
          )!,
          ...document.querySelectorAll<HTMLElement>(
            ".lobby-cards > .lobby-card > small",
          ),
        ]
          .filter((e) => e.offsetParent)
          .filter(
            (e) =>
              e.scrollWidth > e.clientWidth + 1 ||
              e.scrollHeight > e.clientHeight + 1,
          )
          .map((e) => e.textContent),
      );
    const modes = await page
      .locator("#lobby-mode-menu [data-lobby-mode]")
      .evaluateAll((buttons) =>
        buttons
          .filter((b) => !(b as HTMLElement).hidden)
          .map((b) => (b as HTMLElement).dataset.lobbyMode!),
      );
    expect(modes.length).toBeGreaterThanOrEqual(5);
    for (const mode of modes) {
      await page.click("#lobby-mode");
      await page.click(`[data-lobby-mode="${mode}"]`);
      await expect(page.locator("#lobby-mode-menu")).toBeHidden();
      expect(await cut(), mode).toEqual([]);
      const fit = await page.evaluate(() => {
        const button = document
            .querySelector("#lobby-mode")!
            .getBoundingClientRect(),
          text = document
            .querySelector("#lobby-mode .lobby-mode-text")!
            .getBoundingClientRect();
        return {
          height: Math.round(button.height),
          inside: text.top >= button.top && text.bottom <= button.bottom,
        };
      });
      // A finger tall, with both lines inside it.
      expect(fit.height, mode).toBeGreaterThanOrEqual(44);
      expect(fit.inside, mode).toBe(true);
    }
    await page.click("#lobby-mode");
    await page.click('[data-lobby-mode="quick"]');
    await expect(page.locator("#lobby-mode-menu")).toBeHidden();
    await snap(page, info, "lobby-667x375-mode-hint");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// A tap on the Lobby's background, outside the open screen, closes it, as
// the lit rail button does. A tap in the screen, a drag out of it, or a
// tap on another control (the mode button) doesn't.
test("a tap on the Lobby's background closes the open screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await openLobby(page);
  const rail = page.locator('.lobby-rail [data-lobby-action="missions"]'),
    sheet = page.locator(".missions-sheet");
  await rail.click();
  await expect(sheet).toBeVisible();
  await sheet.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished)),
  );
  // A spot on the Lobby itself: not the screen, not a control.
  const spot = await page.evaluate(() => {
    const controls =
      'button, a, input, select, textarea, label, summary, [role="button"]';
    for (let y = 860; y > 120; y -= 20)
      for (let x = 1420; x > 400; x -= 20) {
        const el = document.elementFromPoint(x, y);
        if (
          el?.closest(".lobby-layer") &&
          !el.closest(".ui-panel-host") &&
          !el.closest(controls)
        )
          return { x, y, el: el.className };
      }
    return null;
  });
  expect(spot, "a bare spot on the Lobby").not.toBeNull();
  // In the screen, and a drag from it out to that spot: it stays.
  const head = await sheet.locator(".ui-title").boundingBox();
  await page.mouse.click(head!.x + 8, head!.y + head!.height / 2);
  await page.mouse.move(head!.x + 8, head!.y + head!.height / 2);
  await page.mouse.down();
  await page.mouse.move(spot!.x, spot!.y, { steps: 4 });
  await page.mouse.up();
  await expect(sheet).toBeVisible();
  // Other controls do their own thing, and the screen stays.
  await page.click("#lobby-mode");
  await expect(page.locator("#lobby-mode-menu")).toBeVisible();
  await page.click("#lobby-mode");
  await expect(page.locator("#lobby-mode-menu")).toBeHidden();
  await expect(sheet).toBeVisible();
  // The bare spot closes the screen and puts out its rail button.
  await page.mouse.click(spot!.x, spot!.y);
  await expect(sheet).toHaveCount(0);
  await expect(rail).not.toHaveAttribute("aria-current", "page");
  // And the rail opens it again.
  await rail.click();
  await expect(sheet).toBeVisible();
  expect(errors).toEqual([]);
});

// The Spire card (spire-nudge.ts): once the Spire is open it stays in the
// cards' column, above Missions (a shortcut past the Raid Hub's carousel),
// on violet glass. While something is new (here: the Spire just opened by a
// Cragmuff clear) it glows and Raids gets a dot; opening the Spire's page
// puts the news out, not the card. It fits with nothing overlapping at every
// size, iPhones with their safe areas first.
const SPIRE_OPEN = {
  raids: {
    clears: 1,
    highestPeril: 1,
    bestSeconds: 200,
    titles: [],
    cosmetics: [],
    earned: [],
    bosses: {
      grumblecrag: { clears: 1, highestPeril: 1, bestSeconds: 200, runs: 1 },
    },
  },
  spire: {
    season: 0,
    highestFloor: 0,
    checkpoint: 1,
    attempts: 0,
    claimed: [],
    clears: { grumblecrag: 1 },
  },
};
async function withSpire(page: Page, records: unknown = SPIRE_OPEN) {
  await page.addInitScript((r) => {
    const w = window as any;
    w.__raids = (r as any).raids;
    w.__spire = (r as any).spire;
  }, records);
}
/** Seen on this device already (spire-nudge.ts), so the card has no news. */
async function spireSeen(page: Page) {
  await page.addInitScript(() => {
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      if (key.startsWith("arena-spire-seen:")) return '["s0-z1"]';
      return real.call(this, key);
    };
  });
}
const ALL_CARDS = ["journey", "spire", "missions", "friends"];
type Inset = { left: number; right: number; bottom: number };
const ISLAND: Inset = { left: 59, right: 59, bottom: 21 };
const NOTCH: Inset = { left: 47, right: 47, bottom: 21 };
const SPIRE_VIEWPORTS: {
  width: number;
  height: number;
  inset?: Inset;
  label?: string;
  expect: string[];
  /** Without news, where only one card fits. */
  seen?: string[];
}[] = [
  // iPhone Pro Max (Dynamic Island), iPhone 14 (notch), iPhone SE.
  {
    width: 932,
    height: 430,
    inset: ISLAND,
    label: "island",
    expect: ["journey", "spire", "missions"],
  },
  {
    width: 844,
    height: 390,
    inset: NOTCH,
    label: "notch",
    expect: ["journey", "spire", "missions"],
  },
  { width: 844, height: 390, expect: ["journey", "spire", "missions"] },
  { width: 700, height: 390, expect: ["journey", "spire", "missions"] },
  { width: 667, height: 375, expect: ["journey", "spire"] },
  { width: 568, height: 320, expect: ["journey", "spire"] },
  { width: 844, height: 280, expect: ["spire"], seen: ["journey"] },
  { width: 1280, height: 800, expect: ALL_CARDS },
  { width: 1180, height: 820, expect: ALL_CARDS },
  { width: 1024, height: 768, expect: ALL_CARDS },
];
for (const viewport of SPIRE_VIEWPORTS)
  for (const fresh of [true, false]) {
    const size = `${viewport.width}x${viewport.height}${viewport.label ? `-${viewport.label}` : ""}`;
    test(`the Spire card (${fresh ? "new" : "seen"}) sits above Missions without overlaps at ${size}`, async ({
      browser,
    }, info) => {
      const phone = viewport.width < 1000;
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: phone,
        hasTouch: phone,
      });
      try {
        const page = await context.newPage();
        await withSpire(page);
        if (!fresh) await spireSeen(page);
        const errors = await openLobby(page);
        if (viewport.inset) {
          await page.evaluate((inset) => {
            for (const [key, value] of Object.entries(inset))
              document.documentElement.style.setProperty(
                `--safe-${key}`,
                `${value}px`,
              );
            // The column is fitted after a resize (a rotation sets the insets).
            dispatchEvent(new Event("resize"));
          }, viewport.inset);
        }
        const card = page.locator("#lobby-spire-card");
        const badge = page.locator('.lobby-rail [data-badge-for="raids"]');
        await expect(card).toBeAttached();
        await expect(card).not.toHaveAttribute("hidden");
        if (fresh) {
          await expect(card).toContainText("The Spire is open");
          await expect(card).toContainText("Climb from floor 1");
          await expect(card).toHaveClass(/is-new/);
          await expect(badge).toBeVisible();
        } else {
          await expect(card).toContainText("Start your climb");
          await expect(card).toContainText("Climb from floor 1");
          await expect(card).not.toHaveClass(/is-new/);
          await expect(badge).toBeHidden();
        }
        // Violet glass, over the theme's tint.
        expect(
          await card.evaluate((c) => getComputedStyle(c).backgroundImage),
        ).toContain("gradient");
        await page.waitForTimeout(100);
        await snap(page, info, `lobby-spire-${fresh ? "new" : "seen"}-${size}`);
        const shown = await page.evaluate(() =>
          [
            ...document.querySelectorAll<HTMLElement>(
              ".lobby-cards > .lobby-card",
            ),
          ]
            .filter((c) => c.getBoundingClientRect().height > 0)
            .map((c) => c.id.replace(/^lobby-|-card$/g, "")),
        );
        expect(shown).toEqual(
          fresh ? viewport.expect : (viewport.seen ?? viewport.expect),
        );
        if (shown.includes("spire")) {
          const box = (await card.boundingBox())!;
          // A finger tall, inside the safe area on the right.
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.x + box.width).toBeLessThanOrEqual(
            viewport.width - (viewport.inset?.right ?? 0) + 1,
          );
        }
        const all = await boxes(page);
        for (const b of all) {
          expect(b.x, `${b.name} left edge`).toBeGreaterThanOrEqual(-1);
          expect(b.y, `${b.name} top edge`).toBeGreaterThanOrEqual(-1);
          expect(b.x + b.w, `${b.name} right edge`).toBeLessThanOrEqual(
            viewport.width + 1,
          );
          expect(b.y + b.h, `${b.name} bottom edge`).toBeLessThanOrEqual(
            viewport.height + 1,
          );
        }
        const clashes = all.flatMap((a, i) =>
          all
            .slice(i + 1)
            .filter((b) => overlap(a, b))
            .map((b) => `${a.name} × ${b.name}`),
        );
        expect(clashes).toEqual([]);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }

// A tap opens the Spire's page; that puts out the news (the glow and the
// dot on Raids) for good, and the card stays as the shortcut.
test("the Spire card opens the Spire's page and stays as a shortcut once seen", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await withSpire(page, {
      raids: SPIRE_OPEN.raids,
      spire: {
        ...SPIRE_OPEN.spire,
        highestFloor: 10,
        checkpoint: 11,
        claimed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      },
    });
    const errors = await openLobby(page);
    const card = page.locator("#lobby-spire-card");
    const badge = page.locator('.lobby-rail [data-badge-for="raids"]');
    await expect(card).toContainText("Zone 2 is open");
    await expect(card).toContainText("Climb from floor 11");
    await expect(card).toHaveClass(/is-new/);
    await expect(badge).toBeVisible();
    await snap(page, info, "lobby-spire-zone2-badge-844x390");
    await card.click();
    const room = page.locator(".rh-room");
    await expect(room).toHaveAttribute("data-raid-mode", "spire");
    await expect(badge).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(room).toHaveCount(0);
    await expect(card).toBeVisible();
    await expect(card).toContainText("Best: floor 10");
    await expect(card).toContainText("Climb from floor 11");
    await expect(card).not.toHaveClass(/is-new/);
    await expect(badge).toBeHidden();
    // Seen is kept with the account: a reload brings the card, not the news.
    await page.reload();
    await page.waitForFunction(() => !!(window as any).__sock);
    await expect
      .poll(async () => {
        await page.evaluate(() => (window as any).__sock.fire("connect"));
        return page.locator("#lobby-fighter-name").textContent();
      })
      .not.toBe("");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Best: floor 10");
    await expect(card).not.toHaveClass(/is-new/);
    await expect(badge).toBeHidden();
    // And it still goes straight to the Spire.
    await card.click();
    await expect(room).toHaveAttribute("data-raid-mode", "spire");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("the Spire card stays away before the Spire opens, shows progress while a zone is being climbed, and the Raids page puts out its news too", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  try {
    const page = await context.newPage();
    // No Cragmuff clear: the Spire is locked.
    await withSpire(page, {
      raids: { ...SPIRE_OPEN.raids, clears: 0, bosses: {} },
      spire: { ...SPIRE_OPEN.spire, clears: {} },
    });
    const errors = await openLobby(page);
    const card = page.locator("#lobby-spire-card");
    const badge = page.locator('.lobby-rail [data-badge-for="raids"]');
    await expect(page.locator(".lobby-missions-card")).toBeVisible();
    await expect(card).toBeHidden();
    await expect(badge).toBeHidden();
    // Zone 1 under way (floor 3 cleared): the card, without news.
    await page.evaluate((r) => {
      const w = window as any;
      w.__raids = r.raids;
      w.__spire = { ...r.spire, highestFloor: 3, claimed: [1, 2, 3] };
      // As the server says after a climb or a raid: records changed.
      w.__sock.fire("economy-changed");
    }, SPIRE_OPEN);
    await page.click('.lobby-rail [data-lobby-action="raids"]');
    const room = page.locator(".rh-room");
    await expect(room).toHaveAttribute("data-raid-mode", "hall");
    await expect(room.locator("[data-raid-spire]")).toContainText("3");
    await page.keyboard.press("Escape");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Best: floor 3");
    await expect(card).not.toHaveClass(/is-new/);
    await expect(badge).toBeHidden();
    // Now the Spire opens for this player (a fresh climb): news, and
    // opening the Spire from the Raid Hub's tile puts it out as well.
    await page.evaluate((r) => {
      const w = window as any;
      w.__spire = r.spire;
      w.__sock.fire("economy-changed");
    }, SPIRE_OPEN);
    await page.click('.lobby-rail [data-lobby-action="raids"]');
    await expect(room).toHaveAttribute("data-raid-mode", "hall");
    // (The open Raid Hub covers the cards' column; the rail shows.)
    await expect(badge).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card).toHaveClass(/is-new/);
    await page.click('.lobby-rail [data-lobby-action="raids"]');
    await expect(room).toHaveAttribute("data-raid-mode", "hall");
    await expect(badge).toBeVisible();
    await room.locator("[data-raid-spire]").click();
    await expect(room).toHaveAttribute("data-raid-mode", "spire");
    await expect(badge).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(room).toHaveCount(0);
    await expect(card).toBeVisible();
    await expect(card).not.toHaveClass(/is-new/);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// The whole Spire conquered (floor 70, its summit): the card says so, and
// still goes straight to the Spire (zone 7 climbs again from floor 61).
for (const viewport of [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
])
  test(`the Spire card celebrates the conquered Spire at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await withSpire(page, {
        raids: SPIRE_OPEN.raids,
        spire: {
          ...SPIRE_OPEN.spire,
          highestFloor: 70,
          checkpoint: 61,
          claimed: Array.from({ length: 70 }, (_, i) => i + 1),
          clears: { grumblecrag: 1, "storm-twins": 1 },
        },
      });
      const errors = await openLobby(page);
      const card = page.locator("#lobby-spire-card");
      await expect(card).toContainText("The Spire is yours");
      await expect(card).toContainText("Climb from floor 61");
      await expect(card).not.toHaveClass(/is-new/);
      await page.waitForTimeout(100);
      await snap(
        page,
        info,
        `lobby-spire-conquered-${viewport.width}x${viewport.height}`,
      );
      await card.click();
      await expect(page.locator(".rh-room")).toHaveAttribute(
        "data-raid-mode",
        "spire",
      );
      await expect(page.locator(".rh-room .sp-conquered")).toContainText(
        "The Spire is yours!",
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("your fighter wears its skin as soon as the Lobby opens after signing in", async ({
  page,
}) => {
  await shopServer(page);
  const errors = await openLobby(page);
  // The harness account wears Storm Crown (stage 2) on Voltkit. The account
  // answers after the Lobby is first drawn: the stage must take the skin
  // then, without leaving for the Plaza and coming back.
  const art = page.locator("#lobby-fighter-art");
  await expect(art).toHaveAttribute("data-preview-champion", "voltkit");
  await expect(art).toHaveAttribute("data-preview-item", "voltkit-stormcrown");
  await expect(art).toHaveAttribute("data-preview-stage", "2");
  expect(errors).toEqual([]);
});

test("a skin answer held back until after the Lobby is up still dresses the fighter", async ({
  page,
}) => {
  await shopServer(page);
  await page.addInitScript(() => {
    // Hold /api/economy (shop-server.ts) until the Lobby is on screen.
    const ready = () => {
      const w = window as any;
      if (w.__shop) w.__shop.delay = true;
      else setTimeout(ready, 0);
    };
    ready();
  });
  const errors = await openLobby(page);
  const art = page.locator("#lobby-fighter-art");
  await expect(art).toHaveAttribute("data-preview-champion", "voltkit");
  await page.waitForFunction(() => !!(window as any).__shop.release);
  await expect(art).toHaveAttribute("data-preview-item", "");
  await page.evaluate(() => (window as any).__shop.release());
  await expect(art).toHaveAttribute("data-preview-item", "voltkit-stormcrown");
  expect(errors).toEqual([]);
});

// Join or watch (the mode menu's last row): its one action is the gold main
// button, as on every other screen, and Close is the hub panels' round
// button (25 Nov 2026: Join was the dark secondary, Close a square).
test("Join or watch: Join is the main gold button and Close is round", async ({
  browser,
}, info) => {
  for (const size of [
    { width: 667, height: 375, phone: true },
    { width: 1440, height: 900, phone: false },
  ]) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await openLobby(page);
      await openPlayPanel(page);
      const look = await page.evaluate(() => {
        const join = document.getElementById("join")!;
        const close = document.querySelector<HTMLElement>(
          ".home-play-drawer .home-panel-close",
        )!;
        const drawer = document
          .querySelector(".home-play-drawer")!
          .getBoundingClientRect();
        const j = join.getBoundingClientRect();
        const c = close.getBoundingClientRect();
        return {
          joinGold: getComputedStyle(join).backgroundImage.includes("gradient"),
          joinInside: j.left >= drawer.left && j.right <= drawer.right,
          joinHeight: Math.round(j.height),
          closeRound: getComputedStyle(close).borderTopLeftRadius === "50%",
          closeSquare: Math.round(c.width) === Math.round(c.height),
          closeSize: Math.round(c.width),
        };
      });
      const where = `${size.width}x${size.height}`;
      expect(look.joinGold, where).toBe(true);
      expect(look.joinInside, where).toBe(true);
      // A thumb tall on a phone (a desktop's is 42 px, for a mouse).
      expect(look.joinHeight, where).toBeGreaterThanOrEqual(
        size.phone ? 44 : 40,
      );
      expect(look.closeRound, where).toBe(true);
      expect(look.closeSquare, where).toBe(true);
      expect(look.closeSize, where).toBeGreaterThanOrEqual(40);
      await snap(page, info, `join-or-watch-${where}`);
    } finally {
      await context.close();
    }
  }
});
