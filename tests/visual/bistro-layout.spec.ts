import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import { fakeBistro } from "./bistro-fake";
import { settled, spills } from "./ui-checks";
import { ISLAND, setInsets, type Insets } from "./ui-measure";

// Every Bistro box, at every size: text fits its box, boxes don't run into
// each other or the top bar, everything stays on screen (and clear of a
// notch), and buttons that sit together are one size.
const B = (page: Page, js: string) =>
  page.evaluate(
    `(() => { const b = window.__bistro; const srv = window.__bistroServer; ${js} })()`,
  );

/** Problems with the boxes on screen now. */
async function problems(page: Page, where: string, inset: Insets | null) {
  await settled(page, ".bistro-layer");
  const out = (await spills(page, ".bistro-layer")).map(
    (s) => `${where}: spills ${s}`,
  );
  const more = await page.evaluate(
    ({ inset }) => {
      const out: string[] = [];
      const shown = (e: Element) => {
        const r = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        return (
          r.width > 0 &&
          r.height > 0 &&
          s.display !== "none" &&
          s.visibility !== "hidden"
        );
      };
      const boxes: [string, DOMRect][] = [];
      for (const [name, sel] of [
        ["scenes", "#hub-scenes"],
        ["profile", "#account-profile"],
        ["menu", ".header-menu"],
        ["badge", "#bs-badge"],
        ["wallet", "#bs-wallet"],
        ["chips", "#bs-chips > *"],
        ["rail", ".bs-rail"],
        ["zoom", ".bs-zoom"],
        ["bar", "#bs-bar"],
        ["edit", "#bs-edit"],
        ["visit", "#bs-visit"],
        ["sheet", "#bs-sheet"],
      ] as const)
        document.querySelectorAll(sel).forEach((e, i) => {
          if (shown(e))
            boxes.push([`${name}${i || ""}`, e.getBoundingClientRect()]);
        });
      const l = inset?.left ?? 0,
        r = innerWidth - (inset?.right ?? 0),
        b = innerHeight - (inset?.bottom ?? 0);
      for (const [n, x] of boxes) {
        if (x.left < l - 1 || x.right > r + 1 || x.top < -1 || x.bottom > b + 1)
          out.push(
            `${n} off screen (${Math.round(x.left)},${Math.round(x.top)} ${Math.round(x.width)}×${Math.round(x.height)})`,
          );
      }
      // The sheet covers the scene on purpose; the rest must not touch.
      const solid = boxes.filter(([n]) => !n.startsWith("sheet"));
      for (let i = 0; i < solid.length; i++)
        for (let j = i + 1; j < solid.length; j++) {
          const [an, a] = solid[i],
            [bn, c] = solid[j];
          if (
            a.left < c.right - 0.5 &&
            c.left < a.right - 0.5 &&
            a.top < c.bottom - 0.5 &&
            c.top < a.bottom - 0.5
          )
            out.push(`${an} × ${bn} overlap`);
        }
      // The sheet keeps clear of the menu column and the top bar's boxes.
      const sheet = boxes.find(([n]) => n === "sheet")?.[1];
      if (sheet)
        for (const [n, x] of boxes)
          if (
            [
              "rail",
              "zoom",
              "wallet",
              "scenes",
              "menu",
              "profile",
              "badge",
              "bar",
              "chips",
            ].some((k) => n.startsWith(k))
          )
            if (
              sheet.left < x.right - 0.5 &&
              x.left < sheet.right - 0.5 &&
              sheet.top < x.bottom - 0.5 &&
              x.top < sheet.bottom - 0.5
            )
              out.push(`sheet × ${n} overlap`);
      // Buttons that sit together share their size.
      const sameSize = (label: string, sel: string, by: "row" | "all") => {
        const rs = Array.from(document.querySelectorAll(sel))
          .filter(shown)
          .map((e) => e.getBoundingClientRect());
        const groups = new Map<number, DOMRect[]>();
        for (const x of rs) {
          const k = by === "row" ? Math.round(x.top) : 0;
          groups.set(k, [...(groups.get(k) ?? []), x]);
        }
        for (const g of groups.values()) {
          const w = new Set(g.map((x) => Math.round(x.width))),
            h = new Set(g.map((x) => Math.round(x.height)));
          if (w.size > 1 || h.size > 1)
            out.push(
              `${label}: uneven ${[...w].join("/")} wide, ${[...h].join("/")} tall`,
            );
        }
      };
      sameSize("rail buttons", ".bs-rail button", "all");
      sameSize("zoom buttons", ".bs-zoom button", "all");
      sameSize("counter slots", ".bs-slot", "all");
      sameSize("tabs", ".bs-tabs button", "row");
      // A tab's label shows whole (the Shop's "Gadgets" was cut to "Gadge…").
      for (const e of Array.from(
        document.querySelectorAll<HTMLElement>(".bs-tabs button"),
      ))
        if (shown(e) && e.scrollWidth > e.clientWidth + 1)
          out.push(`tab "${e.textContent?.trim()}" is cut short`);
      // Every button with words is a button: tall enough to tap, its
      // words whole (the Orders' "Hand over all ready" was a flat strip).
      for (const e of Array.from(
        document.querySelectorAll<HTMLElement>(".bistro-layer button"),
      )) {
        const words = e.textContent?.trim();
        if (!shown(e) || !words || e.closest(".bs-rail")) continue;
        const r = e.getBoundingClientRect();
        // (A finger on a phone needs a little more than a mouse.)
        const least = e.closest(".bistro-layer.phone") ? 28 : 24;
        if (r.height < least)
          out.push(
            `button "${words.slice(0, 24)}" is ${Math.round(r.height)} px tall`,
          );
        if (
          e.scrollWidth > e.clientWidth + 1 ||
          e.scrollHeight > e.clientHeight + 1
        )
          out.push(`button "${words.slice(0, 24)}" is cut short`);
      }
      sameSize("cards", ".bs-dishes > button, .bs-items > *", "row");
      // Recipes: each card's level-up at its foot, a row's in one line.
      const ups = new Map<number, number[]>();
      for (const c of Array.from(
        document.querySelectorAll<HTMLElement>(".bs-dishes.levels .bs-dish"),
      )) {
        const up = c.querySelector<HTMLElement>(
          ":scope > :is(button.up, .up.top)",
        );
        if (!shown(c) || !up) continue;
        const cr = c.getBoundingClientRect(),
          ur = up.getBoundingClientRect();
        if (cr.bottom - ur.bottom > 16)
          out.push(
            `level-up of ${c.dataset.dish} is ${Math.round(cr.bottom - ur.bottom)} px above its card's foot`,
          );
        const k = Math.round(cr.top);
        ups.set(k, [...(ups.get(k) ?? []), Math.round(ur.bottom)]);
      }
      for (const [, bs] of ups)
        if (Math.max(...bs) - Math.min(...bs) > 1)
          out.push(
            `level-up buttons not in line (${[...new Set(bs)].join("/")})`,
          );
      sameSize("edit buttons", ".bs-edit-btns button", "row");
      sameSize("visit buttons", ".bs-visit button", "row");
      sameSize("chips", "#bs-chips > *", "row");
      // Text in the visible cards and rows stays inside them.
      for (const e of Array.from(
        document.querySelectorAll<HTMLElement>(
          ".bistro-layer :is(b, small, span, em, i, strong, h2, p)",
        ),
      )) {
        if (!shown(e) || !e.textContent?.trim()) continue;
        // A counter slot's count sits on its corner like a badge: it only
        // has to stay inside the bar.
        const box = e.matches(".bs-slot > b")
          ? e.closest(".bs-bar")
          : e.closest(
              ".bs-dish, .bs-item, .bs-staff, .bs-slot, .bs-chip, .bs-badge, .bs-wallet, .bs-rail button, .bs-visit, .bs-edit, .bs-away-stats > div, .bs-pop-row, .bs-pop-fx > div, .bs-pop-plan, .bs-card, .bs-league li",
            );
        if (!box) continue;
        const t = e.getBoundingClientRect(),
          o = box.getBoundingClientRect();
        if (
          t.left < o.left - 1 ||
          t.right > o.right + 1 ||
          t.top < o.top - 1 ||
          t.bottom > o.bottom + 1
        )
          out.push(
            `"${e.textContent.trim().slice(0, 24)}" sticks out of ${box.className.split(" ")[0]}`,
          );
      }
      return out;
    },
    { inset },
  );
  return [...out, ...more.map((m) => `${where}: ${m}`)];
}

const SIZES: {
  width: number;
  height: number;
  inset: Insets | null;
  name: string;
}[] = [
  { width: 1440, height: 900, inset: null, name: "1440x900" },
  { width: 1024, height: 768, inset: null, name: "1024x768" },
  { width: 844, height: 390, inset: null, name: "844x390" },
  { width: 852, height: 393, inset: ISLAND, name: "852x393-island" },
  { width: 667, height: 375, inset: null, name: "667x375" },
];

for (const size of SIZES)
  test(`every Bistro box fits at ${size.name}`, async ({ browser }, info) => {
    test.setTimeout(180_000);
    const phone = size.width < 1000;
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: phone,
      hasTouch: phone,
    });
    const page = await context.newPage();
    try {
      const errors = await openLobby(page);
      if (size.inset) await setInsets(page, size.inset);
      await fakeBistro(page);
      await page.click('#hub-scenes [data-hub-scene="bistro"]');
      await page.waitForFunction(() => (window as any).__bistro?.sync().ready);
      // A bistro with everything: high level, big numbers, staff, stock.
      await B(
        page,
        `const S = srv.S; S.level = 12; S.coins = 1234567; S.rating = 4.6; S.served = 98765;
         S.staff.push({ id: 2, char: 'pyranda', role: 'cook', level: 3, dish: 'pho' },
                      { id: 3, char: 'glacelle', role: 'waiter', level: 5, dish: 'goicuon' },
                      { id: 4, char: 'wombolder', role: 'cook', level: 1, dish: 'lau', energy: 12 },
                      { id: 5, char: 'tidefin', role: 'janitor', level: 2, dish: 'goicuon', energy: 35 },
                      { id: 6, char: 'lumoth', role: 'waiter', level: 1, dish: 'goicuon', energy: 140,
                        friend: { id: '00000000-0000-4000-8000-000000000673', name: 'Bartholomew the Brave' } });
         S.trash = 4;
         S.stars = 2; S.tokens = 45; S.regulars = { mira: 1, tobi: 3 };
         S.dishLv = { pho: { lv: 4, mastery: 12 }, lau: { lv: 10, mastery: 0 }, goicuon: { lv: 2, mastery: 10 } };
         S.pantry = { rice: 12, flour: 3, herbs: 99, pork: 1, spice: 2 };
         S.stoves.push({ x: 3, model: 'clay', dish: null, start: 0, perfect: false }, { x: 4, model: 'clay', dish: null, start: 0, perfect: false });
         S.counter = [{ dish: 'lau', servings: 188, perfect: true }, { dish: 'pho', servings: 12, perfect: false },
                      { dish: 'banhmi', servings: 12, perfect: false }, { dish: 'goicuon', servings: 4, perfect: false }];
         // (Two catering orders ready: the Orders tab's "Hand over all" shows.)
         S.stored = { plant: 12, lamp: 3, fountain: 1, aquarium: 2, rug: 1, luckycat: 4 };
         srv.extras.leaves = 98765; srv.extras.tradedToday = 120;
         srv.friends = [
           { id: '00000000-0000-4000-8000-000000000672', name: 'Bartholomew the Brave', fighter: 'tidefin', level: 27, rating: 4.9, popularity: 47.6, likes: 1234, served: 123456, servings: 88, dined: true, liked: false },
           { id: '00000000-0000-4000-8000-000000000673', name: 'Cy', fighter: 'lumoth', level: 3, rating: 2.1, likes: 0, served: 4, servings: 0, dined: false, liked: true },
         ];
         return b.load();`,
      );
      await B(page, "b.setTod(0.5)");
      const all: string[] = [];
      const check = async (where: string) => {
        all.push(
          ...(await problems(page, `${size.name} ${where}`, size.inset)),
        );
      };
      await check("hud");
      await snap(page, info, `bistro-layout-${size.name}`);
      const sheets: [string, string | number | undefined][] = [
        ["cook", 0],
        ["menu", undefined],
        ["menu", "pantry"],
        ["shop", "furniture"],
        ["shop", "decor"],
        ["shop", "style"],
        ["shop", "bank"],
        ["staff", "team"],
        ["staff", "hire"],
        ["staff", "upgrades"],
        ["friends", undefined],
        ["popularity", undefined],
        ["board", "orders"],
        ["board", "regulars"],
        ["board", "league"],
        ["board", "event"],
      ];
      for (const [k, a] of sheets) {
        await page.evaluate(([k, a]) => (window as any).__bistro.sheet(k, a), [
          k,
          a,
        ] as const);
        await page.waitForTimeout(400);
        await check(`sheet ${k}${a !== undefined ? ` ${a}` : ""}`);
        if (k === "board" && a === "orders")
          await expect(
            page.locator("#bs-sheet [data-deliver-all]"),
          ).toBeVisible();
        // Scrolled to the end too (the last cards).
        await page.evaluate(() =>
          document
            .querySelectorAll(
              "#bs-sheet :is(.bs-dishes, .bs-items, .bs-team, .bs-bank, .bs-pop, .bs-pantry, .bs-board)",
            )
            .forEach((e) => (e.scrollTop = e.scrollHeight)),
        );
        await check(`sheet ${k}${a !== undefined ? ` ${a}` : ""} (end)`);
        if (k === "staff" && a === "team")
          await snap(page, info, `bistro-staff-${size.name}`);
      }
      await page.evaluate(() => (window as any).__bistro.sheet("menu"));
      await page.click("#bs-sheet [data-close]");
      // Decorate with something in hand.
      await page.click('.bs-rail [data-act="decor"]');
      await page.click("#bs-edit [data-hold]");
      await check("decorate");
      await snap(page, info, `bistro-decorate-${size.name}`);
      await page.click('#bs-edit [data-ed="done"]');
      // The report after time away.
      await B(page, "srv.S.lastSeen -= 9 * 3600 * 1000; return b.load()");
      await expect(page.locator(".bs-away")).toBeVisible();
      await check("away");
      await page.click(".bs-away [data-collect]");
      expect(all).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
