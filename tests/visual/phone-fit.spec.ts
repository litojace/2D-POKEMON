import { expect, test, type Browser, type Page } from "@playwright/test";
import { hubMenu, openHub, openPlayPanel, settle, snap } from "./helpers";
import { fakeFarm } from "./farm-fake";
import { fakeBistro } from "./bistro-fake";

/**
 * Phones in landscape, screen by screen (mobile UI audit, Nov 2026):
 *
 * - every control in sight takes a 44 pt finger: its hit area (what
 *   `elementFromPoint` returns, so an invisible ::after counts) is at least
 *   44 × 44, or, where its neighbours sit closer than that (the Lobby's
 *   rail, the element chips), runs all the way to them;
 * - text fields are at least 34 pt tall (iOS's own);
 * - no text under 10 px (SVG pictures aside: they scale);
 * - controls stay out of the notch, the Dynamic Island and the home bar.
 *
 * The four landscape sizes the game is built for, each with its safe area:
 * iPhone SE (no notch), 844×390 (notch), 852×393 (Dynamic Island) and the
 * Pro Max 932×430. The safe area is set before the page loads, as iOS does.
 * The battle's own controls are checked by mobile-combat-layout.spec.ts.
 */
const SIZES = [
  { name: "667x375", width: 667, height: 375, inset: [0, 0, 0] },
  { name: "844x390", width: 844, height: 390, inset: [47, 47, 21] },
  { name: "852x393-island", width: 852, height: 393, inset: [59, 59, 21] },
  { name: "932x430", width: 932, height: 430, inset: [59, 59, 21] },
];

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

/**
 * What a finger and an eye would trip over on the screen, scrolled through:
 * the screen as it opens, then its longest list a step at a time to its end.
 */
async function problems(page: Page, inset: number[]) {
  const found = new Set(await look(page, inset));
  for (let step = 0; step < 12; step++) {
    const moved = await page.evaluate(() => {
      const lists = Array.from(document.querySelectorAll("*")).filter((e) => {
        const s = getComputedStyle(e);
        return (
          /(auto|scroll)/.test(s.overflowY) &&
          e.scrollHeight > e.clientHeight + 4 &&
          e.getBoundingClientRect().height > 80
        );
      });
      const list = lists.sort((a, b) => b.clientHeight - a.clientHeight)[0];
      if (!list || list.scrollTop + list.clientHeight >= list.scrollHeight - 2)
        return false;
      list.scrollTop += list.clientHeight * 0.7;
      return true;
    });
    if (!moved) break;
    await page.waitForTimeout(150);
    for (const p of await look(page, inset)) found.add(p);
  }
  return [...found];
}

/** What a finger and an eye would trip over on the screen as it stands. */
async function look(page: Page, inset: number[]) {
  await settle(page);
  return page.evaluate(([left, right, bottom]) => {
    const out: string[] = [];
    const W = innerWidth,
      H = innerHeight;
    const R = (e: Element) => e.getBoundingClientRect();
    const shown = (e: Element) => {
      const r = R(e),
        s = getComputedStyle(e);
      return (
        r.width > 0 &&
        r.height > 0 &&
        s.visibility !== "hidden" &&
        +s.opacity > 0.05
      );
    };
    const name = (e: Element) =>
      (
        e.getAttribute("aria-label") ||
        (e as HTMLElement).innerText ||
        e.className.toString() ||
        e.tagName
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 32);
    /** Wholly in sight: on screen and not cut by a box that clips it. */
    const inView = (e: Element, r = R(e)) => {
      if (
        r.left < -0.5 ||
        r.top < -0.5 ||
        r.right > W + 0.5 ||
        r.bottom > H + 0.5
      )
        return false;
      for (let p = e.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (!/(auto|scroll|hidden|clip)/.test(s.overflowX + s.overflowY))
          continue;
        const b = R(p);
        if (
          r.left < b.left - 0.5 ||
          r.right > b.right + 0.5 ||
          r.top < b.top - 0.5 ||
          r.bottom > b.bottom + 0.5
        )
          return false;
      }
      return true;
    };
    const hits = (e: Element, x: number, y: number) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      const h = document.elementFromPoint(x, y);
      return !!h && (h === e || e.contains(h));
    };
    const controls = Array.from(
      document.querySelectorAll(
        'button, a[href], [role="button"], [role="tab"], summary, select, input:not([type="hidden"]):not([type="range"]):not([type="checkbox"]):not([type="radio"])',
      ),
    ).filter((e) => {
      if (!shown(e)) return false;
      // In sight with a finger's room round it: one resting on a list's
      // edge is checked once the list has scrolled it in.
      const r = R(e);
      const dx = Math.max(0, (44 - r.width) / 2),
        dy = Math.max(0, (44 - r.height) / 2);
      if (
        !inView(
          e,
          new DOMRect(r.x - dx, r.y - dy, r.width + 2 * dx, r.height + 2 * dy),
        ) ||
        !inView(e)
      )
        return false;
      // Only what a finger can reach: not covered by a sheet or a scrim.
      return hits(e, r.left + r.width / 2, r.top + r.height / 2);
    });
    // A control inside another (a chip's ✕) is part of it.
    const tops = controls.filter(
      (e) => !controls.some((o) => o !== e && o.contains(e)),
    );
    const boxes = tops.map(R);
    // Neighbours: every control drawn, in sight or scrolled half out of it.
    const CONTROLS =
      'button, a[href], [role="button"], [role="tab"], summary, select, input:not([type="hidden"])';
    const otherEls = Array.from(document.querySelectorAll(CONTROLS)).filter(
      shown,
    );
    const others = otherEls.map(R);
    tops.forEach((e, i) => {
      const r = boxes[i];
      const cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
      const reach = (dx: number, dy: number) => {
        let d = 0;
        for (let s = 1; s <= 30 && hits(e, cx + dx * s, cy + dy * s); s++)
          d = s;
        return d;
      };
      // From the centre, each way: half a finger (22 px), or, where a
      // neighbour sits closer, at least half way across the gap to it.
      const half = { l: 22, r: 22, t: 22, b: 22 };
      /** Sides whose nearest neighbour is a sibling (a row or a column). */
      const row = { l: false, r: false, t: false, b: false };
      const near = (k: keyof typeof half, v: number, j: number) => {
        if (v >= half[k]) return;
        half[k] = v;
        row[k] = otherEls[j].parentElement === e.parentElement;
      };
      others.forEach((o, j) => {
        if (o.left === r.left && o.top === r.top && o.width === r.width) return;
        if (
          o.left < r.right - 1 &&
          r.left < o.right - 1 &&
          o.top < r.bottom - 1 &&
          r.top < o.bottom - 1
        )
          return; // a control drawn over it (a field's eye), or inside it
        if (o.top < r.bottom && r.top < o.bottom) {
          if (o.right <= r.left + 1)
            near("l", r.width / 2 + (r.left - o.right) / 2, j);
          if (o.left >= r.right - 1)
            near("r", r.width / 2 + (o.left - r.right) / 2, j);
        }
        if (o.left < r.right && r.left < o.right) {
          if (o.bottom <= r.top + 1)
            near("t", r.height / 2 + (r.top - o.bottom) / 2, j);
          if (o.top >= r.bottom - 1)
            near("b", r.height / 2 + (o.top - r.bottom) / 2, j);
        }
      });
      // Text fields: as tall as iOS's own (34 pt); the keyboard does the rest.
      if (e.tagName === "INPUT" || e.tagName === "SELECT") {
        half.l = half.r = 0;
        half.t = Math.min(half.t, 17);
        half.b = Math.min(half.b, 17);
      }
      const got = {
        l: Math.max(r.width / 2, reach(-1, 0) + 0.5),
        r: Math.max(r.width / 2, reach(1, 0) + 0.5),
        t: Math.max(r.height / 2, reach(0, -1) + 0.5),
        b: Math.max(r.height / 2, reach(0, 1) + 0.5),
      };
      // A finger's width and height, or the control's fair share of the
      // room between its neighbours (half of each gap)...
      const across = got.l + got.r,
        tall = got.t + got.b,
        needX = half.l + half.r,
        needY = half.t + half.b;
      if (across < needX - 2.5 || tall < needY - 2.5)
        out.push(
          `small hit area: ${name(e)} ${across.toFixed(0)}×${tall.toFixed(0)} (needs ${needX.toFixed(0)}×${needY.toFixed(0)})`,
        );
      // ...and no dead gap in a row or column of them: every point between
      // it and a neighbour closer than half a finger hits one or the other.
      const dead = (
        [
          ["l", -1, 0],
          ["r", 1, 0],
          ["t", 0, -1],
          ["b", 0, 1],
        ] as const
      ).filter(([k, dx, dy]) => {
        if (half[k] >= 22 || !row[k]) return false;
        const edge = dx ? r.width / 2 : r.height / 2;
        const gap = (half[k] - edge) * 2;
        for (let s = edge + 0.5; s < edge + gap; s += 1) {
          const at = document.elementFromPoint(cx + dx * s, cy + dy * s);
          if (!at?.closest(CONTROLS)) return true;
        }
        return false;
      });
      if (dead.length)
        out.push(
          `dead gap beside ${name(e)} (${dead.map(([k]) => k).join(", ")})`,
        );
      if (
        r.left < left - 0.5 ||
        r.right > W - right + 0.5 ||
        r.bottom > H - bottom + 0.5
      )
        out.push(
          `in the safe area's edge: ${name(e)} ${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}`,
        );
    });
    // Text.
    const seen = new Set<string>();
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent || "").trim();
      const p = n.parentElement;
      if (!text || !p || p.closest("svg") || !shown(p)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.width < 1 || !inView(p, r)) continue;
      const at = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2,
      );
      if (!at || !(p.contains(at) || at.contains(p))) continue;
      const size = parseFloat(getComputedStyle(p).fontSize);
      const key = `${size}px "${text.slice(0, 24)}"`;
      if (size < 9.95 && !seen.has(key)) {
        seen.add(key);
        out.push(`text under 10 px: ${key}`);
      }
    }
    if (document.documentElement.scrollWidth > W + 1)
      out.push(
        `the page scrolls sideways: ${document.documentElement.scrollWidth}px`,
      );
    return out;
  }, inset);
}

const rail = (action: string) => async (page: Page) => {
  await hubMenu(page, action);
  await expect(page.locator(".ui-panel-host .ui-panel").first()).toBeVisible();
};
const HUB: [string, (page: Page) => Promise<void>][] = [
  ["lobby", async () => {}],
  [
    "mode menu",
    async (page) => {
      await page.click("#lobby-mode");
      await expect(page.locator("#lobby-mode-menu")).toBeVisible();
    },
  ],
  ["play panel", openPlayPanel],
  ["fighters", rail("fighters")],
  [
    "fighter detail",
    async (page) => {
      await rail("fighters")(page);
      await page.click('[data-roster-details="voltkit"]');
      await expect(page.locator('[data-roster-mode="detail"]')).toBeVisible();
    },
  ],
  ["shop", rail("shop")],
  ["wardrobe", rail("wardrobe")],
  ["journey", rail("journey")],
  ["missions", rail("missions")],
  ["ranks", rail("ranks")],
  ["friends", rail("friends")],
  ["raid hall", rail("raids")],
  [
    "boss page",
    async (page) => {
      await rail("raids")(page);
      await page.click('[data-raid-card="grumblecrag"]');
      await expect(page.locator("[data-ui-raid-tab]").first()).toBeVisible();
    },
  ],
  [
    "profile",
    async (page) => {
      await page.click("#account-profile");
      await expect(page.locator(".profile-panel")).toBeVisible();
    },
  ],
  [
    "settings",
    async (page) => {
      await page.evaluate(() => document.getElementById("settings")!.click());
      await expect(page.locator("#dialog .settings-screen")).toBeVisible();
    },
  ],
];

for (const size of SIZES) {
  test.describe(`phone fit at ${size.name}`, () => {
    test("the hub's screens", async ({ browser }, info) => {
      test.setTimeout(420_000);
      const { context, page } = await phone(browser, size);
      try {
        const report: Record<string, string[]> = {};
        let errors: string[] = [];
        for (const [screen, open] of HUB) {
          errors = errors.concat(await openHub(page));
          await open(page);
          await page.waitForTimeout(400);
          report[screen] = await problems(page, size.inset);
          if (screen === "lobby" || screen === "fighter detail")
            await snap(
              page,
              info,
              `phone-fit-${screen.replace(" ", "-")}-${size.name}`,
            );
        }
        expect(Object.entries(report).filter(([, p]) => p.length)).toEqual([]);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

    test("the room, the Plaza, the Farm and the Bistro", async ({
      browser,
    }, info) => {
      test.setTimeout(300_000);
      const { context, page } = await phone(browser, size);
      try {
        const report: Record<string, string[]> = {};
        const errors = await openHub(page);
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
        report.room = await problems(page, size.inset);
        await snap(page, info, `phone-fit-room-${size.name}`);
        // The room's heading keeps clear of its element chips.
        const [title, chips] = await Promise.all([
          page.locator(".room-screen .roster-head .ui-title").boundingBox(),
          page
            .locator(".room-screen .roster-elements .ui-chip")
            .first()
            .boundingBox(),
        ]);
        expect(title!.x + title!.width).toBeLessThanOrEqual(chips!.x);

        await page.goto("/");
        await openHub(page);
        await fakeFarm(page);
        await fakeBistro(page);
        await page.evaluate(() => localStorage.setItem("ea-plaza-help", "1"));
        await page.click('#hub-scenes [data-hub-scene="plaza"]');
        await expect(page.locator(".plaza-layer #pz-cv")).toBeVisible();
        report.plaza = await problems(page, size.inset);

        await page.click('#hub-scenes [data-hub-scene="farm"]');
        await expect(page.locator("#fm-rail")).toBeVisible({ timeout: 30_000 });
        report.farm = await problems(page, size.inset);
        // (The rail can still be gliding in on a busy machine.)
        await page
          .locator('#fm-rail [data-sheet="shop"]')
          .click({ force: true });
        await expect(page.locator("#fm-sheet")).toBeVisible();
        report["farm shop"] = await problems(page, size.inset);
        await page.keyboard.press("Escape");

        await page.click('#hub-scenes [data-hub-scene="bistro"]');
        await expect(page.locator(".bistro-layer .bs-cv")).toBeVisible();
        await page.waitForFunction(
          () => (window as any).__bistro?.sync().ready,
        );
        report.bistro = await problems(page, size.inset);
        await snap(page, info, `phone-fit-bistro-${size.name}`);
        expect(Object.entries(report).filter(([, p]) => p.length)).toEqual([]);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

    test("the welcome screen", async ({ browser }, info) => {
      const { context, page } = await phone(browser, size);
      try {
        await page.route("**/stubs.ts*", async (route) => {
          const response = await route.fetch();
          await route.fulfill({
            response,
            body: (await response.text()).replace(
              "getSession: async () => ({ data: { session } })",
              "getSession: async () => ({ data: { session: null } })",
            ),
          });
        });
        await page.goto("/");
        await expect(page.locator(".auth-panel")).toBeVisible();
        await page.waitForTimeout(600);
        expect(await problems(page, size.inset)).toEqual([]);
        await snap(page, info, `phone-fit-welcome-${size.name}`);
      } finally {
        await context.close();
      }
    });
  });
}
