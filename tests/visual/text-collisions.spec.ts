import { expect, test, type Page } from "@playwright/test";
import { hubMenu, openLobby, openPlayPanel } from "./helpers";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

// Every Lobby screen and each of its tabs, at three phones held sideways
// and a small desktop: no text runs into other text, no icon covers text,
// and no text leaves the circle it sits in (owner's screenshots, 16 Nov
// 2026: Journey's reward pictures over "Level", "LEVEL" past its ring,
// "20% off today" under the deal's countdown, "ENTRANCE" into "VICTORY",
// a raid's lock tag under its stars).
const SIZES = [
  { w: 667, h: 375 },
  { w: 844, h: 390 },
  { w: 932, h: 430 },
  { w: 1280, h: 720 },
];
const SCREENS = [
  "lobby",
  "fighters",
  "shop",
  "wardrobe",
  "raids",
  "missions",
  "ranks",
  "friends",
  "journey",
  "profile",
  "play",
];
// The server's clock for the whole sweep (window.__serverTime, sent as
// X-Server-Time by the harness): Sunday 22 Nov 2026, 00:01 in California.
// The countdowns (daily picks and missions, weekly goals, the arcade) are
// then at their widest, "23 h 59 min", and this week's arcade is always the
// same one, whatever time CI runs: at the machine's clock the weekly goals'
// "Resets in 4 d 21 h" ran into "Level road" at 667x375 on some days only
// (CI, 18 Nov 2026).
const SERVER_TIME = Date.parse("2026-11-22T08:01:00Z");
// Text painted over a picture on purpose: a fighter card's name and element
// over its art, a raid trophy's name over its painting.
const OVER_ART = ".roster-card-art, .pf-trophy";

async function collisions(page: Page, where: string) {
  await page.waitForTimeout(500);
  return page.evaluate(
    ({ where, overArt }) => {
      const panels = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".ui-panel, .ui-sheet, .rh-room, [role=dialog]",
        ),
      ).filter((e) => e.getClientRects().length);
      const root = panels.at(-1) ?? document.body;
      const visible = (e: Element) => {
        if (e.closest("details:not([open]) > :not(summary)")) return false;
        for (let n: Element | null = e; n; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (
            cs.display === "none" ||
            cs.visibility === "hidden" ||
            +cs.opacity === 0
          )
            return false;
        }
        // Text for screen readers only (1 px, clipped).
        const r = e.getBoundingClientRect();
        return r.width > 1 && r.height > 1;
      };
      // What of a box shows: cut by every scrolling or clipping box round
      // it, and by the screen.
      const shown = (el: Element, r0: DOMRect) => {
        let [l, t, r, b] = [r0.left, r0.top, r0.right, r0.bottom];
        for (
          let n: Element | null = el;
          n && n !== document.body;
          n = n.parentElement
        ) {
          const cs = getComputedStyle(n);
          if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
            const c = n.getBoundingClientRect();
            [l, t, r, b] = [
              Math.max(l, c.left),
              Math.max(t, c.top),
              Math.min(r, c.right),
              Math.min(b, c.bottom),
            ];
          }
        }
        [l, t, r, b] = [
          Math.max(l, 0),
          Math.max(t, 0),
          Math.min(r, innerWidth),
          Math.min(b, innerHeight),
        ];
        return new DOMRect(l, t, Math.max(0, r - l), Math.max(0, b - t));
      };
      // The ink of a line, not its line box (line-height adds room above
      // and below the letters).
      const ink = (r: DOMRect) =>
        new DOMRect(r.left, r.top + r.height * 0.18, r.width, r.height * 0.64);
      const out: string[] = [];
      const texts: { el: Element; r: DOMRect; t: string }[] = [];
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const el = n.parentElement;
        const t = n.textContent!.trim();
        if (!t || !el || el.closest("svg") || !visible(el)) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const line of Array.from(range.getClientRects())) {
          const r = shown(el, ink(line));
          if (r.width < 2 || r.height < 2) continue;
          const top = document.elementFromPoint(
            r.left + r.width / 2,
            r.top + r.height / 2,
          );
          const mine =
            !!top &&
            (top === el ||
              el.contains(top) ||
              top.contains(el) ||
              !!top.closest("svg, img, canvas"));
          if (!mine) {
            // Covered by another part of the same panel (a neighbour's box,
            // a tag): a collision. Under another layer (a panel over the
            // Lobby): not in sight.
            if (top && root !== document.body && root.contains(top))
              out.push(
                `${where}: "${t.slice(0, 24)}" covered by ${top.tagName.toLowerCase()}.${String(top.className).split(" ")[0]}`,
              );
            continue;
          }
          texts.push({ el, r, t: t.slice(0, 24) });
          // Cut off: a clipping box round the text (not one that ends it
          // in an ellipsis, nor a scrolling list) cuts its letters.
          let [l, rr] = [line.left, line.right];
          let card: Element | null = null;
          for (
            let n: Element | null = el;
            n && n !== root.parentElement;
            n = n.parentElement
          ) {
            const cs = getComputedStyle(n);
            const box = n.getBoundingClientRect();
            const clips = ["hidden", "clip"].includes(cs.overflowX);
            if (clips) {
              const ends =
                cs.textOverflow === "ellipsis" ||
                cs.getPropertyValue("-webkit-line-clamp") !== "none";
              if (!ends && (l < box.left - 1 || rr > box.right + 1))
                out.push(`${where}: "${t.slice(0, 24)}" is cut off`);
              [l, rr] = [Math.max(l, box.left), Math.min(rr, box.right)];
            }
            if (cs.overflowX === "auto" || cs.overflowX === "scroll") break;
            // The first box drawn round the text (a card, a tag, a slot):
            // the text stays inside it.
            if (
              !card &&
              n !== el &&
              n !== root &&
              !cs.display.startsWith("inline") &&
              (parseFloat(cs.borderLeftWidth) > 0 ||
                cs.backgroundImage !== "none" ||
                !/rgba\(.*, 0\)$|transparent/.test(cs.backgroundColor))
            ) {
              card = n;
              if (l < box.left - 1 || rr > box.right + 1)
                out.push(
                  `${where}: "${t.slice(0, 24)}" runs out of its box (${n.tagName.toLowerCase()}.${String(n.className).split(" ")[0]})`,
                );
            }
          }
        }
      }
      const pictures = Array.from(root.querySelectorAll("img, svg, canvas"))
        .filter((g) => !g.parentElement?.closest("svg") && visible(g))
        .map((g) => ({
          el: g,
          full: g.getBoundingClientRect(),
          r: shown(g, g.getBoundingClientRect()),
        }))
        // Icons, not backdrops.
        .filter(
          (g) => g.r.width > 4 && g.full.width < 160 && g.full.height < 160,
        );
      const hit = (a: DOMRect, b: DOMRect) =>
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 &&
        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
      const block = (e: Element) => {
        let x: Element | null = e;
        while (x && getComputedStyle(x).display.startsWith("inline"))
          x = x.parentElement;
        return x;
      };
      for (const t of texts)
        for (const g of pictures) {
          if (g.el.contains(t.el) || t.el.contains(g.el)) continue;
          if (g.el.closest(overArt) || t.el.closest(overArt)) continue;
          if (hit(t.r, g.r)) out.push(`${where}: an icon over "${t.t}"`);
        }
      for (let i = 0; i < texts.length; i++)
        for (let j = i + 1; j < texts.length; j++) {
          const [a, b] = [texts[i], texts[j]];
          if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el))
            continue;
          // Runs of one paragraph share their lines.
          if (block(a.el) === block(b.el)) continue;
          if (hit(a.r, b.r)) out.push(`${where}: "${a.t}" on "${b.t}"`);
        }
      // Text in a circle: each line's corners inside the circle's inside.
      for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
        if (el.closest("svg") || !visible(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 14 || Math.abs(r.width - r.height) > 1) continue;
        const cs = getComputedStyle(el);
        const rad = cs.borderTopLeftRadius;
        const round = rad.endsWith("%")
          ? parseFloat(rad) >= 50
          : parseFloat(rad) >= r.width / 2 - 0.5;
        if (!round) continue;
        let inset = parseFloat(cs.borderTopWidth) || 0;
        const before = getComputedStyle(el, "::before");
        if (
          before.content !== "none" &&
          before.position === "absolute" &&
          parseFloat(before.borderTopLeftRadius) > 0
        )
          inset = Math.max(inset, parseFloat(before.top) || 0);
        const [cx, cy, R] = [
          r.left + r.width / 2,
          r.top + r.height / 2,
          r.width / 2 - inset,
        ];
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          if (!n.textContent!.trim() || !visible(n.parentElement!)) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          for (const line of Array.from(range.getClientRects())) {
            const i = ink(line);
            const far = Math.max(
              ...[
                [i.left, i.top],
                [i.right, i.top],
                [i.left, i.bottom],
                [i.right, i.bottom],
              ].map(([x, y]) => Math.hypot(x - cx, y - cy)),
            );
            if (far > R + 0.5)
              out.push(
                `${where}: "${n.textContent!.trim().slice(0, 12)}" leaves its circle (${far.toFixed(1)} > ${R.toFixed(1)} px)`,
              );
          }
        }
      }
      return [...new Set(out)];
    },
    { where, overArt: OVER_ART },
  );
}

/** Check the screen at the top of its list and at each step down it. */
async function swept(page: Page, where: string) {
  const found = await collisions(page, where);
  const steps = await page.evaluate(() => {
    const panels = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".ui-panel, .ui-sheet, .rh-room, [role=dialog]",
      ),
    ).filter((e) => e.getClientRects().length);
    const root = panels.at(-1);
    if (!root) return 0;
    const lists = Array.from(root.querySelectorAll<HTMLElement>("*")).filter(
      (e) =>
        /auto|scroll/.test(getComputedStyle(e).overflowY) &&
        e.scrollHeight > e.clientHeight + 4,
    );
    lists.sort(
      (a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth,
    );
    const list = lists[0];
    if (!list) return 0;
    list.setAttribute("data-swept", "");
    return Math.min(
      12,
      Math.ceil(
        (list.scrollHeight - list.clientHeight) / (list.clientHeight * 0.7),
      ),
    );
  });
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((i) => {
      const list = document.querySelector<HTMLElement>("[data-swept]")!;
      list.scrollTop = i * list.clientHeight * 0.7;
    }, i);
    await page.waitForTimeout(200);
    found.push(...(await collisions(page, `${where} (scrolled ${i})`)));
  }
  await page.evaluate(() => {
    const list = document.querySelector<HTMLElement>("[data-swept]");
    if (list) {
      list.scrollTop = 0;
      list.removeAttribute("data-swept");
    }
  });
  return found;
}

for (const s of SIZES)
  test(`no text collides at ${s.w}x${s.h}`, async ({ browser }) => {
    test.setTimeout(300_000);
    const phone = s.h <= 500;
    const context = await browser.newContext({
      viewport: { width: s.w, height: s.h },
      isMobile: phone,
      hasTouch: phone,
      reducedMotion: "reduce",
    });
    await context.addInitScript((t) => {
      (window as any).__serverTime = t;
    }, SERVER_TIME);
    const problems: string[] = [];
    try {
      for (const screen of SCREENS) {
        const page = await context.newPage();
        const errors = await openLobby(page);
        if (screen === "profile") await page.click("#account-profile");
        else if (screen === "play") await openPlayPanel(page);
        else if (screen !== "lobby") await hubMenu(page, screen);
        const where = `${s.w}x${s.h} ${screen}`;
        problems.push(...(await swept(page, where)));
        // Each tab of the screen.
        const tabs = await page.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]'))
            .filter(
              (e) =>
                e.getClientRects().length &&
                !e.closest(".lobby-rail, #hub-scenes"),
            )
            .map((e) => {
              const a = Array.from(e.attributes).find((x) =>
                x.name.startsWith("data-ui-"),
              );
              return a ? `[${a.name}="${a.value}"]` : "";
            })
            .filter(Boolean),
        );
        for (const tab of tabs) {
          const t = page.locator(tab).first();
          if (!(await t.isVisible())) continue;
          await t.click();
          problems.push(...(await swept(page, `${where} ${tab}`)));
        }
        expect(errors, where).toEqual([]);
        await page.close();
      }
    } finally {
      await context.close();
    }
    expect(problems).toEqual([]);
  });
