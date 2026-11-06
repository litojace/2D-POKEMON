import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";

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
    add("leaves", document.querySelector("#account-leaves > *"));
    add("menu", document.querySelector(".header-menu > summary"));
    add("rail", document.querySelector(".lobby-rail"));
    add("party", document.querySelector(".lobby-party"));
    add("nameplate", document.querySelector(".lobby-nameplate"));
    document
      .querySelectorAll(".lobby-card")
      .forEach((c, i) => add(`card${i}`, c));
    add("play", document.querySelector(".lobby-play"));
    add("emotes", document.querySelector(".lobby-emotes"));
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
      await expect(
        page.locator('#hub-scenes [data-hub-scene="farm"]'),
      ).toHaveCount(1);
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
              leaves: { ...body.leaves, balance: 9999999 },
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
      await expect(page.locator("#account-leaves")).toContainText("10M");
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
// below the card), the emote tile is the rail's last tile in the bottom-left
// corner, and the emotes open up that column instead of over the fighter's
// arrows.
for (const view of [
  { width: 932, height: 430, inset: { left: 59, right: 59, bottom: 21 } },
  { width: 667, height: 375, inset: null },
  { width: 1024, height: 768, inset: null },
]) {
  test(`the rail and the emote tile share a column at ${view.width}x${view.height}`, async ({
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
        tile = await rect(".lobby-emote-toggle"),
        play = await rect("#lobby-play");
      expect(first.t - card.b, "rail under the card").toBeGreaterThanOrEqual(
        12,
      );
      expect([tile.l, tile.w], "tile in the rail's column").toEqual([
        first.l,
        first.w,
      ]);
      expect(tile.t - last.b, "tile under the rail").toBeGreaterThanOrEqual(10);
      expect(
        Math.abs(tile.b - play.b),
        "tile on PLAY's bottom line",
      ).toBeLessThan(1);
      await page.click(".lobby-emote-toggle");
      const list = await rect(".lobby-emote-list");
      expect(list.t, "emotes under the card").toBeGreaterThanOrEqual(card.b);
      for (const arrow of ['[data-lobby-step="-1"]', '[data-lobby-step="1"]']) {
        const a = await rect(arrow);
        expect(
          list.r <= a.l || a.r <= list.l || list.b <= a.t || a.b <= list.t,
          `emotes clear of ${arrow}`,
        ).toBe(true);
      }
      await expect(page.locator(".lobby-rail")).toBeHidden();
      await page.click('[data-lobby-emote="👋"]');
      await expect(page.locator("#lobby-emote-bubble")).toHaveText("👋");
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
    await page.click('[data-lobby-mode="teams"]');
    await page.click("#lobby-play");
    await expect(page.locator(".lobby-layer")).toHaveCount(0);
    await expect(page.locator("body")).toHaveClass(/lobby-active/);
    const create = await page.evaluate(() =>
      (window as any).__requests.find(([ev]: [string]) => ev === "create"),
    );
    expect(create?.[1]).toMatchObject({ mode: "teams" });
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
          weekly: [],
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
// stands there with its name (the seats and arrows ran off the screen), and
// the emote tile stays in the rail's column (moved beside the sheet it
// landed on PLAY).
test("a sheet on a 667x375 phone keeps the fighter on screen and the emote tile in the rail", async ({
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
        tile: r(".lobby-emote-toggle"),
        rail: r(".lobby-rail button"),
      };
    });
    for (const k of ["nameplate", "fighter"] as const) {
      expect(m[k].right, `${k} on screen`).toBeLessThanOrEqual(667);
      expect(m[k].bottom, `${k} above PLAY`).toBeLessThanOrEqual(m.play.top);
    }
    expect(m.tile.left, "emote tile in the rail's column").toBeCloseTo(
      m.rail.left,
      0,
    );
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

// A tap on the Lobby's background, outside the open screen, closes it, as
// the lit rail button does. A tap in the screen, a drag out of it, or a
// tap on another control (the mode button, the emotes) doesn't.
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
  await page.click(".lobby-emote-toggle");
  await expect(page.locator(".lobby-emotes")).toHaveAttribute(
    "data-open",
    "true",
  );
  await expect(sheet).toBeVisible();
  // The emote list, like the mode menu, closes on a tap anywhere else.
  await page.mouse.click(head!.x + 8, head!.y + head!.height / 2);
  await expect(page.locator(".lobby-emotes")).toHaveAttribute(
    "data-open",
    "false",
  );
  // The bare spot closes the screen and puts out its rail button.
  await page.mouse.click(spot!.x, spot!.y);
  await expect(sheet).toHaveCount(0);
  await expect(rail).not.toHaveAttribute("aria-current", "page");
  // And the rail opens it again.
  await rail.click();
  await expect(sheet).toBeVisible();
  expect(errors).toEqual([]);
});
