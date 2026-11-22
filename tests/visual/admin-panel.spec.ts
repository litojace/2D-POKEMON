import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import { exposeAccount } from "./shop-server";
import { ISLAND, setInsets, type Insets } from "./ui-measure";

// The Admin panel (apps/client/src/admin-panel.ts): five sections in the
// dialog's tab bar, phones held sideways first. The admin API is faked in the
// page with a little state, so actions change what the next load returns.

const NOVA = "22222222-2222-4222-8222-222222222222";
const BOLT = "33333333-3333-4333-8333-333333333333";
const BOSS = "44444444-4444-4444-8444-444444444444";
const RIVAL_TITLE = "55555555-5555-4555-8555-555555555555";
const OLD_TITLE = "66666666-6666-4666-8666-666666666666";

async function fakeAdmin(page: Page) {
  await page.evaluate(
    ({ NOVA, BOLT, BOSS, RIVAL_TITLE, OLD_TITLE }) => {
      const w = window as any;
      const at = (minutes: number) =>
        new Date(Date.now() - minutes * 60000).toISOString();
      const state = {
        calls: [] as { path: string; body: any }[],
        announcements: [
          {
            id: 1,
            message: "Servers restart at 03:00 for ten minutes.",
            tone: "warning",
            createdAt: at(60 * 30),
            endsAt: at(60 * 6),
            by: "Boss",
          },
        ] as any[],
        wallets: { [NOVA]: 250 } as Record<string, number>,
        chat: {} as Record<string, { until: string; reason: string }>,
        ledger: {
          [NOVA]: [{ amount: 250, reason: "pvp", at: at(60) }],
        } as Record<string, { amount: number; reason: string; at: string }[]>,
        titles: [
          {
            id: RIVAL_TITLE,
            name: "Arena Rival",
            description: "Beat an admin in a match.",
            color: "#ff697f",
            active: true,
            createdAt: at(100),
          },
          {
            id: OLD_TITLE,
            name: "Beta Tester",
            description: "Played in the beta.",
            color: "#50dbe9",
            active: false,
            createdAt: at(5000),
          },
        ],
        players: [
          {
            id: NOVA,
            displayName: "Nova",
            isAdmin: false,
            suspended: false,
            title: "Arena Rival",
            createdAt: "2026-10-01T00:00:00Z",
            lastOnline: at(1),
            titleIds: [RIVAL_TITLE],
          },
          {
            id: BOLT,
            displayName: "BoltRunnerWithALongName",
            isAdmin: false,
            suspended: true,
            title: null,
            createdAt: "2026-09-12T00:00:00Z",
            lastOnline: at(60 * 26),
            titleIds: [],
          },
          {
            id: BOSS,
            displayName: "Boss",
            isAdmin: true,
            suspended: false,
            title: null,
            createdAt: "2026-08-01T00:00:00Z",
            lastOnline: null as string | null,
            titleIds: [OLD_TITLE],
          },
        ],
        reports: [
          {
            id: 7,
            reporterId: BOLT,
            reporterName: "BoltRunnerWithALongName",
            category: "player",
            message:
              "Nova kept saying rude things in room chat after the match ended.",
            context: {
              source: "chat",
              reported: `Nova (${NOVA})`,
              room: "ABC234",
              browser:
                "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
              device: "touch · 844x390",
            },
            status: "open",
            createdAt: at(12),
            resolvedAt: null,
          },
          {
            id: 6,
            reporterId: NOVA,
            reporterName: "Nova",
            category: "bug",
            message:
              "The raid timer froze at 0:03 and the boss kept attacking.",
            context: { screen: "match", room: "RAID77", phase: "playing" },
            status: "open",
            createdAt: at(190),
            resolvedAt: null,
          },
          {
            id: 5,
            reporterId: null,
            reporterName: "",
            category: "account",
            message: "Can't log in with Apple.",
            context: {},
            status: "resolved",
            createdAt: at(3000),
            resolvedAt: at(2900),
          },
        ],
        online: [
          {
            id: NOVA,
            displayName: "Nova",
            title: "Arena Rival",
            titleColor: "#ff697f",
            isAdmin: false,
            connections: 1,
            since: at(42),
            activity: "match",
            room: "ABC234",
            phase: "playing",
            fighter: "voltkit",
            opponent: "Bolt",
          },
          {
            id: BOSS,
            displayName: "Boss",
            title: null,
            titleColor: null,
            isAdmin: true,
            connections: 2,
            since: at(5),
            activity: "menu",
            room: null,
            phase: null,
            fighter: null,
            opponent: null,
          },
          {
            id: "77777777-7777-4777-8777-777777777777",
            displayName: "Pip",
            title: null,
            titleColor: null,
            isAdmin: false,
            guest: true,
            connections: 1,
            since: at(3),
            activity: "town",
            room: null,
            phase: null,
            fighter: null,
            opponent: null,
          },
        ],
      };
      w.__admin = state;
      const reply = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      const fetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = new URL(
          String(input instanceof Request ? input.url : input),
          location.href,
        );
        if (!url.pathname.startsWith("/api/admin/")) return fetch(input, init);
        const path = url.pathname;
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        if (body) state.calls.push({ path, body });
        const q = url.searchParams;
        if (path === "/api/admin/online")
          return reply({
            players: state.online,
            guests: 4,
            at: new Date().toISOString(),
          });
        if (path === "/api/admin/reports") {
          const status = q.get("status") ?? "open";
          const list = state.reports.filter(
            (r) => status === "all" || r.status === status,
          );
          return reply({
            reports: list,
            total: list.length,
            open: state.reports.filter((r) => r.status === "open").length,
          });
        }
        const statusOf = /^\/api\/admin\/players\/([^/]+)\/status$/.exec(path);
        if (statusOf) {
          const id = statusOf[1];
          return reply({
            balance: state.wallets[id] ?? 0,
            chatUntil: state.chat[id]?.until ?? null,
            chatReason: state.chat[id]?.reason ?? null,
            coins: state.ledger[id] ?? [],
          });
        }
        if (path === "/api/admin/chat-ban") {
          if (body.hours)
            state.chat[body.playerId] = {
              until: new Date(Date.now() + body.hours * 3600000).toISOString(),
              reason: body.reason,
            };
          else delete state.chat[body.playerId];
          return reply({ ok: true });
        }
        if (path === "/api/admin/coins") {
          const balance = state.wallets[body.playerId] ?? 0;
          const applied = Math.max(body.amount, -balance);
          state.wallets[body.playerId] = balance + applied;
          (state.ledger[body.playerId] ??= []).unshift({
            amount: applied,
            reason: "admin",
            at: new Date().toISOString(),
          });
          return reply({ applied, balance: balance + applied });
        }
        if (path === "/api/admin/announcements")
          return reply(state.announcements);
        if (path === "/api/admin/announce") {
          const sent = {
            id: state.announcements.length + 1,
            message: body.message.trim(),
            tone: body.tone,
            createdAt: new Date().toISOString(),
            endsAt: new Date(Date.now() + body.hours * 3600000).toISOString(),
            by: "Boss",
          };
          state.announcements.unshift(sent);
          return reply(sent);
        }
        if (path === "/api/admin/announcements/end") {
          state.announcements.find((a) => a.id === body.id)!.endsAt =
            new Date().toISOString();
          return reply({ ok: true });
        }
        if (path === "/api/admin/players") {
          const s = (q.get("search") ?? "").toLowerCase();
          const list = state.players.filter(
            (p) => !s || p.displayName.toLowerCase().includes(s) || p.id === s,
          );
          if (q.get("sort") === "online")
            list.sort(
              (a, b) =>
                Date.parse(b.lastOnline ?? "1970-01-01") -
                Date.parse(a.lastOnline ?? "1970-01-01"),
            );
          return reply({ players: list, total: list.length });
        }
        if (path === "/api/admin/titles" && !body) return reply(state.titles);
        if (path === "/api/admin/titles") {
          if (body.id) {
            Object.assign(
              state.titles.find((t) => t.id === body.id)!,
              body,
            );
            return reply(body.id);
          }
          const id = "88888888-8888-4888-8888-888888888888";
          state.titles.unshift({
            ...body,
            id,
            createdAt: new Date().toISOString(),
          });
          return reply(id);
        }
        if (path === "/api/admin/players/suspend") {
          state.players.find((p) => p.id === body.id)!.suspended =
            body.suspended;
          return reply({ ok: true });
        }
        if (path === "/api/admin/reports/resolve") {
          state.reports.find((r) => r.id === body.id)!.status = body.resolved
            ? "resolved"
            : "open";
          return reply({ ok: true });
        }
        if (path === "/api/admin/grants") {
          const p = state.players.find((x) => x.id === body.playerId)!;
          p.titleIds = body.grant
            ? [...p.titleIds, body.titleId]
            : p.titleIds.filter((t) => t !== body.titleId);
          return reply({ ok: true });
        }
        return reply({ ok: true });
      };
    },
    { NOVA, BOLT, BOSS, RIVAL_TITLE, OLD_TITLE },
  );
}

async function openAdmin(page: Page) {
  await page.addInitScript(() => {
    (window as any).__accountPatch = { isAdmin: true };
  });
  await exposeAccount(page);
  const errors = await openLobby(page);
  await fakeAdmin(page);
  await page.evaluate(() => (window as any).__account.showAdmin());
  await expect(page.locator("#adm-root .adm-kpis")).toBeVisible();
  return errors;
}
const calls = (page: Page) =>
  page.evaluate(
    () => (window as any).__admin.calls as { path: string; body: any }[],
  );
const tab = (page: Page, name: string) =>
  page.locator(`#dialog .admin-tab[data-tab="${name}"]`);

/** Nothing in the panel sticks out sideways, and the tab bar fits. */
async function fits(page: Page, inset?: Insets) {
  return page.evaluate((inset) => {
    const content = document.querySelector<HTMLElement>(
      "#dialog .dialog-content",
    )!;
    const dialog = document
      .querySelector<HTMLElement>("#dialog")!
      .getBoundingClientRect();
    const tabs = [
      ...document.querySelectorAll<HTMLElement>("#dialog .admin-tab"),
    ].map((t) => t.getBoundingClientRect());
    const bar = document.querySelector<HTMLElement>("#dialog .admin-tabs")!;
    return {
      sideways: content.scrollWidth - content.clientWidth,
      // Inside the screen, and clear of a notch or Dynamic Island.
      inScreen:
        dialog.left >= (inset?.left ?? 0) &&
        dialog.right <= innerWidth - (inset?.right ?? 0) &&
        dialog.top >= (inset?.top ?? 0) &&
        dialog.bottom <= innerHeight - (inset?.bottom ?? 0),
      tabsFit: bar.scrollWidth <= bar.clientWidth + 1,
      tabHeight: Math.min(...tabs.map((t) => t.height)),
      wide: [...content.querySelectorAll<HTMLElement>("*")]
        .filter(
          (e) =>
            e.getBoundingClientRect().right >
            content.getBoundingClientRect().right + 1,
        )
        .map((e) => `${e.tagName}.${e.className}`)
        .slice(0, 6),
    };
  }, inset);
}

for (const size of [
  { width: 667, height: 375, name: "667x375" },
  { width: 844, height: 390, name: "844x390" },
  { width: 852, height: 393, name: "852x393-island", island: true },
  { width: 1440, height: 900, name: "1440x900" },
]) {
  test(`every Admin section fits at ${size.name}`, async ({
    browser,
  }, info) => {
    const phone = size.width < 1000;
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: phone,
      hasTouch: phone,
    });
    try {
      const page = await context.newPage();
      const errors = await openAdmin(page);
      const inset = size.island ? ISLAND : undefined;
      if (inset) await setInsets(page, inset);
      for (const name of [
        "overview",
        "players",
        "online",
        "reports",
        "titles",
        "announce",
      ]) {
        await tab(page, name).click();
        await expect(page.locator("#adm-root")).toHaveAttribute(
          "data-tab",
          name,
        );
        await expect(page.locator("#adm-root .adm-loading")).toHaveCount(0);
        if (name === "players") {
          await page.locator("[data-player] .adm-row-main").first().click();
          await expect(page.locator(".adm-detail")).toBeVisible();
        }
        const fit = await fits(page, inset);
        expect(
          fit.sideways,
          `${name} scrolls sideways: ${fit.wide.join(", ")}`,
        ).toBeLessThanOrEqual(1);
        expect(fit.inScreen, `${name} dialog on screen`).toBe(true);
        expect(fit.tabsFit, `${name} tab bar fits`).toBe(true);
        expect(fit.tabHeight).toBeGreaterThanOrEqual(40);
        await snap(page, info, `admin-${name}-${size.name}`);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("Admin actions on a phone held sideways", async ({ browser }, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openAdmin(page);
    // Overview counts come from the online list, reports and the directory.
    const kpis = page.locator(".adm-kpi b");
    await expect(kpis.nth(0)).toHaveText("3");
    await expect(kpis.nth(1)).toHaveText("1");
    await expect(kpis.nth(2)).toHaveText("2");
    await expect(kpis.nth(3)).toHaveText("3");
    await expect(page.locator('.admin-count[data-count="reports"]')).toHaveText(
      "2",
    );

    // A live player opens straight in Players, with their tools showing.
    await page.locator('.adm-mini [data-act="manage"]').first().click();
    await expect(page.locator("#adm-root")).toHaveAttribute(
      "data-tab",
      "players",
    );
    const nova = page.locator(`[data-player="${NOVA}"]`);
    await expect(nova.locator(".adm-detail")).toBeVisible();
    await expect(nova.locator(".adm-detail")).toContainText("Battling Bolt");

    // Mute their chat for 24 hours: the toast says so.
    await nova.locator('[data-act="mute"][data-hours="24"]').click();
    await expect(page.locator("#admin-message")).toHaveText(
      "Nova can't chat for 24 h.",
    );
    await expect(page.locator("#admin-message")).toHaveClass(/is-shown/);
    await snap(page, info, "admin-toast-844x390");
    expect((await calls(page)).at(-1)).toEqual({
      path: "/api/admin/chat-ban",
      body: { playerId: NOVA, hours: 24, reason: "Set in the Admin panel" },
    });
    // The row stays open after the redraw, and shows the mute.
    await expect(nova.locator(".adm-detail")).toBeVisible();
    await expect(nova.locator("[data-chat]")).toContainText("Muted until");
    await expect(nova.locator("[data-chat]")).toContainText(
      "Set in the Admin panel",
    );

    // Coins: the balance, a quick amount, a reason, then add and take.
    await expect(nova.locator("[data-coins]")).toHaveText("250");
    const coinForm = nova.locator('form[data-form="coins"]');
    const firstRef = await coinForm.getAttribute("data-ref");
    await coinForm
      .locator('[data-act="coin-preset"][data-amount="500"]')
      .click();
    await expect(coinForm.locator('input[name="amount"]')).toHaveValue("500");
    await coinForm.locator('input[name="reason"]').fill("Raid bug refund");
    await snap(page, info, "admin-coins-844x390");
    await coinForm.locator('button[value="add"]').click();
    await expect(page.locator("#admin-message")).toHaveText(
      "Added 500 coins to Nova. Balance: 750.",
    );
    expect((await calls(page)).at(-1)).toEqual({
      path: "/api/admin/coins",
      body: {
        playerId: NOVA,
        amount: 500,
        reason: "Raid bug refund",
        ref: firstRef,
      },
    });
    await expect(nova.locator("[data-coins]")).toHaveText("750");
    // A new form means a new request id.
    expect(
      await nova.locator('form[data-form="coins"]').getAttribute("data-ref"),
    ).not.toBe(firstRef);
    // Taking more than they have stops at 0.
    await nova
      .locator('form[data-form="coins"] input[name="amount"]')
      .fill("1000");
    await nova
      .locator('form[data-form="coins"] input[name="reason"]')
      .fill("Exploit clean-up");
    await nova.locator('form[data-form="coins"] button[value="take"]').click();
    await expect(page.locator("#admin-message")).toHaveText(
      "Took 750 coins from Nova. Balance: 0.",
    );
    await expect(nova.locator("[data-coins]")).toHaveText("0");
    await nova
      .locator(".adm-ledger")
      .evaluate((e) => e.closest("details")!.setAttribute("open", ""));
    await expect(nova.locator(".adm-ledger li")).toHaveCount(3);
    await expect(nova.locator(".adm-ledger li").first()).toContainText("-750");

    // Suspend asks first.
    await nova.locator('[data-act="suspend"]').click();
    await nova.locator('[data-act="suspend-yes"]').click();
    await expect(page.locator("#admin-message")).toHaveText(
      "Nova is suspended.",
    );
    await expect(nova.locator(".admin-badge.danger")).toBeVisible();

    // Delete waits for the typed name.
    await nova.locator('[data-act="delete"]').click();
    const yes = nova.locator('[data-act="delete-yes"]');
    await expect(yes).toBeDisabled();
    await expect(nova.locator("[data-confirm-name]")).toBeFocused();
    await nova.locator("[data-confirm-name]").fill("Nov");
    await expect(yes).toBeDisabled();
    await nova.locator("[data-confirm-name]").fill("Nova");
    await expect(yes).toBeEnabled();
    await nova.locator('[data-act="cancel"]').click();
    await expect(yes).toHaveCount(0);

    // Grant a title from the row.
    await nova.locator('[data-act="revoke"]').click();
    await expect(page.locator("#admin-message")).toContainText(
      "removed from Nova",
    );
    await nova.locator(".grant-select").selectOption(RIVAL_TITLE);
    await expect(page.locator("#admin-message")).toContainText(
      "granted to Nova",
    );

    // Search clears with one tap.
    await page.locator('[data-act="clear-search"]').click();
    await expect(page.locator("[data-player]")).toHaveCount(3);

    // Online: the filter chips.
    await tab(page, "online").click();
    await expect(page.locator(".online-row")).toHaveCount(3);
    await page.locator('[data-filter="match"]').click();
    await expect(page.locator(".online-row")).toHaveCount(1);
    await expect(page.locator(".online-row")).toContainText("Nova");

    // Reports: details fold away; resolve; stop chat.
    await tab(page, "reports").click();
    const chat = page.locator('[data-report="7"]');
    await expect(chat.locator("details")).not.toHaveAttribute("open", "");
    await chat.locator('[data-act="chat-stop"]').click();
    await expect(page.locator("#admin-message")).toHaveText(
      "Their chat is stopped for 24 hours.",
    );
    await chat.locator('[data-act="resolve"]').click();
    await expect(page.locator("#admin-message")).toHaveText(
      "Report marked resolved.",
    );
    await expect(page.locator('[data-report="7"]')).toHaveCount(0);
    await expect(page.locator('.admin-count[data-count="reports"]')).toHaveText(
      "1",
    );

    // Players: last online on each row, and the order.
    await tab(page, "players").click();
    await expect(page.locator(`[data-player="${BOLT}"] small`)).toContainText(
      "Seen 1d ago",
    );
    await page.locator('[data-act="sort"][data-sort="online"]').click();
    await expect(page.locator("[data-player] strong")).toHaveText([
      "Nova",
      "BoltRunnerWithALongName",
      "Boss",
    ]);
    await page.locator(`[data-player="${BOLT}"] .adm-row-main`).click();
    await expect(
      page.locator(`[data-player="${BOLT}"] .adm-facts`),
    ).toContainText("Last online");

    // Announce: write, pick a kind and a length, confirm, then end it.
    await tab(page, "announce").click();
    const announce = page.locator('form[data-form="announce"]');
    await announce
      .locator("textarea")
      .fill("Double coins all weekend in every mode!");
    await expect(announce.locator("[data-preview]")).toHaveText(
      "Double coins all weekend in every mode!",
    );
    await expect(announce.locator("[data-count]")).toHaveText("39 / 300");
    await announce
      .locator('[data-act="announce-tone"][data-tone="event"]')
      .click();
    // The text survives the redraw.
    await expect(
      page.locator('form[data-form="announce"] textarea'),
    ).toHaveValue("Double coins all weekend in every mode!");
    await page
      .locator('form[data-form="announce"] select[name="hours"]')
      .selectOption("72");
    await page
      .locator('form[data-form="announce"] button:not([type=button])')
      .click();
    await expect(page.locator(".adm-announce .admin-confirm")).toContainText(
      "next 3 days",
    );
    await snap(page, info, "admin-announce-confirm-844x390");
    await page.locator('[data-act="announce-yes"]').click();
    await expect(page.locator("#admin-message")).toHaveText(
      "Sent to every player.",
    );
    expect((await calls(page)).at(-1)).toEqual({
      path: "/api/admin/announce",
      body: {
        message: "Double coins all weekend in every mode!",
        tone: "event",
        hours: 72,
      },
    });
    // The form is empty again; the new one leads the list.
    await expect(
      page.locator('form[data-form="announce"] textarea'),
    ).toHaveValue("");
    const first = page.locator("[data-announcement]").first();
    await expect(first).toContainText("Double coins");
    await expect(first.locator(".adm-running")).toContainText("Ends in");
    await first.locator('[data-act="announce-end"]').click();
    await expect(page.locator("#admin-message")).toContainText(
      "Announcement ended",
    );
    await expect(page.locator("[data-announcement]").first()).toHaveClass(
      /is-ended/,
    );

    // Titles: turn one off, edit, create.
    await tab(page, "titles").click();
    await page
      .locator(`[data-act="title-active"][data-id="${RIVAL_TITLE}"]`)
      .click();
    await expect(page.locator("#admin-message")).toContainText(
      "can no longer be granted",
    );
    expect((await calls(page)).at(-1)?.body).toMatchObject({
      id: RIVAL_TITLE,
      active: false,
    });
    await page.locator('#adm-root [data-act="title-new"]').click();
    const form = page.locator('form[data-form="title"]');
    await expect(form.locator('input[name="name"]')).toBeFocused();
    await form.locator('input[name="name"]').fill("Champion");
    await form
      .locator('input[name="description"]')
      .fill("Won the November cup.");
    await form.locator("button:not([type=button])").click();
    await expect(page.locator("#admin-message")).toHaveText(
      "Title “Champion” created.",
    );
    await expect(page.locator(".adm-title")).toHaveCount(3);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("players see an announcement once, never over a battle", async ({
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
    const announce = (id: number, message: string) =>
      page.evaluate(
        ({ id, message }) =>
          (window as any).__sock.fire("announcement", {
            id,
            message,
            tone: "event",
            createdAt: new Date().toISOString(),
            endsAt: new Date(Date.now() + 3600000).toISOString(),
          }),
        { id, message },
      );
    await announce(41, "<b>Double</b> coins all weekend!");
    const banner = page.locator(".announcement-banner");
    await expect(banner).toBeVisible();
    // Text, never markup.
    await expect(banner.locator("p")).toHaveText(
      "<b>Double</b> coins all weekend!",
    );
    await expect(banner.locator("p b")).toHaveCount(0);
    // It slides down from above (0.2 s): measure where it settles, 8 px
    // under the top edge, not mid-slide.
    await expect(banner).toHaveClass(/is-shown/);
    await expect
      .poll(async () => (await banner.boundingBox())!.y)
      .toBeGreaterThanOrEqual(8);
    const box = await banner.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(844);
    await snap(page, info, "announcement-banner-844x390");
    await banner.locator(".announcement-ok").click();
    await expect(banner).toHaveCount(0);
    // The same one again is not shown twice on this device.
    await announce(41, "<b>Double</b> coins all weekend!");
    await expect(banner).toHaveCount(0);
    // During a battle it waits, then shows.
    await page.evaluate(() => document.body.classList.add("battle-active"));
    await announce(42, "Raid event starts now.");
    await page.waitForTimeout(500);
    await expect(banner).toHaveCount(0);
    await page.evaluate(() => document.body.classList.remove("battle-active"));
    await expect(banner).toContainText("Raid event starts now.");
    // An admin ends it early: it goes away.
    await page.evaluate(() =>
      (window as any).__sock.fire("announcement-ended", { id: 42 }),
    );
    await expect(banner).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
