import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import { exposeAccount } from "./shop-server";

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
            titleIds: [RIVAL_TITLE],
          },
          {
            id: BOLT,
            displayName: "BoltRunnerWithALongName",
            isAdmin: false,
            suspended: true,
            title: null,
            createdAt: "2026-09-12T00:00:00Z",
            titleIds: [],
          },
          {
            id: BOSS,
            displayName: "Boss",
            isAdmin: true,
            suspended: false,
            title: null,
            createdAt: "2026-08-01T00:00:00Z",
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
        if (path === "/api/admin/players") {
          const s = (q.get("search") ?? "").toLowerCase();
          const list = state.players.filter(
            (p) => !s || p.displayName.toLowerCase().includes(s) || p.id === s,
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
async function fits(page: Page) {
  return page.evaluate(() => {
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
      inScreen:
        dialog.left >= 0 &&
        dialog.right <= innerWidth &&
        dialog.top >= 0 &&
        dialog.bottom <= innerHeight,
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
  });
}

for (const size of [
  { width: 667, height: 375 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  test(`every Admin section fits at ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    const phone = size.width < 1000;
    const context = await browser.newContext({
      viewport: size,
      isMobile: phone,
      hasTouch: phone,
    });
    try {
      const page = await context.newPage();
      const errors = await openAdmin(page);
      for (const name of [
        "overview",
        "players",
        "online",
        "reports",
        "titles",
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
        const fit = await fits(page);
        expect(
          fit.sideways,
          `${name} scrolls sideways: ${fit.wide.join(", ")}`,
        ).toBeLessThanOrEqual(1);
        expect(fit.inScreen, `${name} dialog on screen`).toBe(true);
        expect(fit.tabsFit, `${name} tab bar fits`).toBe(true);
        expect(fit.tabHeight).toBeGreaterThanOrEqual(40);
        await snap(page, info, `admin-${name}-${size.width}x${size.height}`);
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
    // The row stays open after the redraw.
    await expect(nova.locator(".adm-detail")).toBeVisible();

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
