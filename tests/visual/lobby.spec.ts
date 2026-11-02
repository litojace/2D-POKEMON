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
      await expect(page.locator("#account-coins")).toContainText("9,999,999");
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
    const fits = await menu.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return (
        r.top >= 0 &&
        r.bottom <= innerHeight &&
        r.left >= 0 &&
        r.right <= innerWidth
      );
    });
    expect(fits).toBe(true);
    await snap(page, info, "lobby-mode-menu-844x390");
    await page.click('[data-lobby-mode="bot-hard"]');
    await expect(menu).toBeHidden();
    await expect(page.locator("#lobby-mode")).toContainText("Vs AI · Hard");
    expect(
      await page.evaluate(() => localStorage.getItem("arena-lobby-mode")),
    ).toBe("bot-hard");

    // The rail's Fighters opens the roster drawer above the Lobby.
    await page.click('[data-lobby-action="fighters"]');
    const drawer = page.locator("#home-fighter-panel");
    await expect(drawer).toBeVisible();
    expect(
      await drawer.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(
          document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2),
        );
      }),
    ).toBe(true);
    await page.locator("#home-fighter-panel [data-home-close]").first().click();
    await expect(drawer).toBeHidden();

    // The arrows change the fighter.
    const first = await page.locator("#lobby-fighter-name").textContent();
    await page.click('[data-lobby-step="1"]');
    await expect(page.locator("#lobby-fighter-name")).not.toHaveText(
      first ?? "",
    );

    // Plaza opens the walkable world; Lobby comes back.
    await page.click('#hub-scenes [data-hub-scene="plaza"]');
    await expect(page.locator("#town-menu-toggle")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator(".lobby-layer")).toHaveCount(0);
    await page.click('#hub-scenes [data-hub-scene="lobby"]');
    await expect(page.locator("#lobby-play")).toBeVisible();
    await expect(page.locator(".town-layer")).toHaveCount(0);
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
    await snap(page, info, "lobby-party-844x390");
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
