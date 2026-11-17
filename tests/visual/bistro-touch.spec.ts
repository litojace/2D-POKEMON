import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import { fakeBistro } from "./bistro-fake";
import { richBistro } from "./bistro-rich";
import { settled } from "./ui-checks";
import { ISLAND, setInsets, type Insets } from "./ui-measure";

// The Bistro on a phone is played with fingers, to iOS's measures (owner,
// 17 Nov 2026: the layout came over from the desktop; not too big either,
// or too little shows and everything needs scrolling). On every screen, at
// every phone size: each control takes taps over 44 × 44 (Apple's minimum)
// though it may look smaller, isn't a speck or a slab, doesn't touch the
// next one and its target never covers another; words are 11 px or more
// (Caption 2) and never cut short; typing doesn't zoom an iPhone (16 px
// fields); the list takes half the sheet or more; and it scrolls under a
// finger.
// bistro-layout.spec.ts checks the boxes fit; this checks they can be used.
const B = (page: Page, js: string) =>
  page.evaluate(
    `(() => { const b = window.__bistro; const srv = window.__bistroServer; ${js} })()`,
  );

/** What a finger can't use on the screen now. */
async function touchProblems(page: Page, where: string) {
  await settled(page, ".bistro-layer");
  const out = await page.evaluate(() => {
    const out: string[] = [];
    const shown = (e: Element) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return (
        r.width > 0 &&
        r.height > 0 &&
        s.display !== "none" &&
        s.visibility !== "hidden" &&
        +s.opacity > 0.05
      );
    };
    type Box = { left: number; top: number; right: number; bottom: number };
    /** A box cut to what its scrolling or clipping parents show (or null). */
    const clip = (e: Element, r: Box): Box | null => {
      let { left, top, right, bottom } = r;
      left = Math.max(left, 0);
      top = Math.max(top, 0);
      right = Math.min(right, innerWidth);
      bottom = Math.min(bottom, innerHeight);
      for (let p = e.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (/(auto|scroll|hidden|clip)/.test(s.overflowX + s.overflowY)) {
          const q = p.getBoundingClientRect();
          left = Math.max(left, q.left);
          top = Math.max(top, q.top);
          right = Math.min(right, q.right);
          bottom = Math.min(bottom, q.bottom);
        }
      }
      return right - left > 1 && bottom - top > 1
        ? { left, top, right, bottom }
        : null;
    };
    const visible = (e: Element) => !!clip(e, e.getBoundingClientRect());
    /** Where a tap counts: the box, and the margin its ::after adds. */
    const target = (e: Element): Box => {
      const r = e.getBoundingClientRect();
      const a = getComputedStyle(e, "::after");
      // (A box that hides its overflow hides the margin with it.)
      if (
        a.content === "none" ||
        a.position !== "absolute" ||
        getComputedStyle(e).overflow !== "visible"
      )
        return r;
      const px = (v: string) => parseFloat(v) || 0;
      return {
        left: Math.min(r.left, r.left + px(a.left)),
        top: Math.min(r.top, r.top + px(a.top)),
        right: Math.max(r.right, r.right - px(a.right)),
        bottom: Math.max(r.bottom, r.bottom - px(a.bottom)),
      };
    };
    const label = (e: Element) =>
      (e.getAttribute("aria-label") || e.textContent || e.className.toString())
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 28);
    const root = document.querySelector(".bistro-layer")!;
    // Controls: buttons and fields, and anything else that takes a tap.
    const controls = [
      ...root.querySelectorAll<HTMLElement>(
        "button, a[href], input, select, textarea, [role=button]",
      ),
      ...[...root.querySelectorAll<HTMLElement>("*")].filter(
        (e) =>
          !e.matches(".bs-cv") &&
          getComputedStyle(e).cursor === "pointer" &&
          getComputedStyle(e.parentElement!).cursor !== "pointer",
      ),
    ]
      .filter((e, i, all) => all.indexOf(e) === i)
      .filter((e) => !e.parentElement?.closest("button"))
      .filter((e) => shown(e) && visible(e));
    // Cards that are buttons (a dish, an item to buy) are big on purpose.
    const card = (e: Element) =>
      e.matches(".bs-dish, .bs-item, .bs-rail button, .cookdish button");
    for (const e of controls) {
      const r = e.getBoundingClientRect(),
        t = target(e);
      // Apple's least target: 44 × 44 pt.
      if (t.right - t.left < 43.5 || t.bottom - t.top < 43.5)
        out.push(
          `"${label(e)}" takes taps over ${Math.round(t.right - t.left)}×${Math.round(t.bottom - t.top)} px (iOS: 44×44)`,
        );
      // Not so small it reads as a speck, not so big it crowds the list.
      if (Math.min(r.width, r.height) < 28)
        out.push(
          `"${label(e)}" looks ${Math.round(r.width)}×${Math.round(r.height)} px (too small to see as a button)`,
        );
      if (!card(e) && r.height > 52)
        out.push(`"${label(e)}" is ${Math.round(r.height)} px tall (too big)`);
    }
    for (let i = 0; i < controls.length; i++)
      for (let j = 0; j < controls.length; j++) {
        if (i === j) continue;
        const ea = controls[i],
          eb = controls[j];
        if (ea.contains(eb) || eb.contains(ea)) continue;
        const a = clip(ea, ea.getBoundingClientRect()),
          b = clip(eb, eb.getBoundingClientRect()),
          ta = clip(ea, target(ea));
        if (!a || !b || !ta) continue;
        const gap = Math.max(
          Math.max(a.left, b.left) - Math.min(a.right, b.right),
          Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom),
        );
        if (i < j && gap < 2)
          out.push(
            `"${label(ea)}" and "${label(eb)}" touch (${gap.toFixed(1)} px)`,
          );
        // A tap meant for one never lands on the other.
        const steals =
          ta.left < b.right - 0.5 &&
          b.left < ta.right - 0.5 &&
          ta.top < b.bottom - 0.5 &&
          b.top < ta.bottom - 0.5;
        if (gap >= 2 && steals)
          out.push(`"${label(ea)}"'s target covers "${label(eb)}"`);
      }
    // A round button (border-radius 50%) is a circle, never an oval: −, +
    // and close were once stretched to 32 × 36 and 34 × 36 by the rule
    // giving controls their height. (Capsules, like the wallet, are meant.)
    for (const e of controls) {
      const r = e.getBoundingClientRect();
      if (
        getComputedStyle(e).borderTopLeftRadius === "50%" &&
        Math.abs(r.width - r.height) > 1
      )
        out.push(
          `"${label(e)}" is a ${Math.round(r.width)}×${Math.round(r.height)} oval, not a circle`,
        );
    }
    // Words: 11 px at least (the level ring's star badge: 10), whole.
    const seen = new Set<Element>();
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const p = n.parentElement!;
      if (!n.textContent!.trim() || seen.has(p)) continue;
      seen.add(p);
      if (!shown(p) || !visible(p)) continue;
      const px = parseFloat(getComputedStyle(p).fontSize);
      const least = p.matches(".bs-ring .stars") ? 10 : 11;
      if (px < least - 0.01)
        out.push(`"${n.textContent!.trim().slice(0, 28)}" is ${px} px`);
    }
    for (const e of root.querySelectorAll<HTMLElement>("*")) {
      if (!shown(e) || !visible(e)) continue;
      const s = getComputedStyle(e);
      // (Sideways for an ellipsis, down for a clamp: a target's margin adds
      // to a button's height, never its words.)
      const clipped =
        (s.textOverflow === "ellipsis" && e.scrollWidth > e.clientWidth + 1) ||
        (s.webkitLineClamp !== "none" && e.scrollHeight > e.clientHeight + 1);
      if (clipped && !/(auto|scroll)/.test(s.overflowX + s.overflowY))
        out.push(`"${label(e)}" is cut short`);
    }
    // Typing: iPhones zoom the page into a field under 16 px.
    for (const e of root.querySelectorAll<HTMLElement>(
      "input, select, textarea",
    ))
      if (shown(e) && parseFloat(getComputedStyle(e).fontSize) < 16)
        out.push(`field "${label(e)}" is under 16 px`);
    return out;
  });
  return out.map((m) => `${where}: ${m}`);
}

/**
 * Enough on screen at once, so a phone isn't all scrolling: the list takes
 * at least half the sheet (the header, tabs and buttons above it the rest),
 * and a grid shows at least one card whole.
 */
async function densityProblems(page: Page, where: string) {
  const out = await page.evaluate(() => {
    const out: string[] = [];
    const sheet = document.querySelector<HTMLElement>("#bs-sheet");
    const list = sheet?.querySelector<HTMLElement>(
      ":is(.bs-dishes, .bs-items, .bs-team, .bs-bank, .bs-pop, .bs-pantry, .bs-board)",
    );
    if (!sheet || !list) return out;
    const sh = sheet.getBoundingClientRect().height,
      lr = list.getBoundingClientRect();
    if (lr.height < sh * 0.5)
      out.push(
        `the list shows ${Math.round(lr.height)} of the sheet's ${Math.round(sh)} px`,
      );
    const cards = [
      ...list.querySelectorAll<HTMLElement>(
        ":scope > :is(.bs-dish, .bs-item, .bs-staff, .bs-card)",
      ),
    ];
    if (
      cards.length &&
      !cards.some((c) => {
        const r = c.getBoundingClientRect();
        return r.top >= lr.top - 1 && r.bottom <= lr.bottom + 1;
      })
    )
      out.push("no card shows whole");
    return out;
  });
  return out.map((m) => `${where}: ${m}`);
}

/** Drag a finger up a list (real touch events) and say how far it scrolled. */
async function fingerScroll(page: Page, selector: string) {
  const list = page.locator(selector);
  const box = (await list.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2,
    from = box.y + box.height - 16,
    to = box.y + 16;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: from }],
  });
  for (let i = 1; i <= 10; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: from + ((to - from) * i) / 10 }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
  await page.waitForTimeout(400);
  return list.evaluate((e) => e.scrollTop);
}

const PHONES: {
  width: number;
  height: number;
  inset: Insets | null;
  name: string;
}[] = [
  { width: 667, height: 375, inset: null, name: "667x375" },
  { width: 844, height: 390, inset: null, name: "844x390" },
  { width: 852, height: 393, inset: ISLAND, name: "852x393-island" },
  { width: 932, height: 430, inset: null, name: "932x430" },
];

for (const size of PHONES)
  test(`Bistro is made for fingers at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    try {
      const errors = await openLobby(page);
      if (size.inset) await setInsets(page, size.inset);
      await fakeBistro(page);
      await page.click('#hub-scenes [data-hub-scene="bistro"]');
      await page.waitForFunction(() => (window as any).__bistro?.sync().ready);
      await richBistro(page);
      await B(page, "b.setTod(0.5); b.calm()");
      const all: string[] = [];
      all.push(...(await touchProblems(page, "hud")));
      const sheets: [string, string | number | undefined][] = [
        ["cook", 0],
        ["menu", undefined],
        ["menu", "pantry"],
        ["shop", "furniture"],
        ["shop", "decor"],
        ["shop", "machines"],
        ["shop", "kitchen"],
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
        await page.waitForTimeout(300);
        const where = `${size.name} ${k}${a !== undefined ? ` ${a}` : ""}`;
        all.push(...(await touchProblems(page, where)));
        all.push(...(await densityProblems(page, where)));
        // And the end of the list (its last cards and notes).
        await page.evaluate(() =>
          document
            .querySelectorAll(
              "#bs-sheet :is(.bs-dishes, .bs-items, .bs-team, .bs-bank, .bs-pop, .bs-pantry, .bs-board)",
            )
            .forEach((e) => (e.scrollTop = e.scrollHeight)),
        );
        all.push(...(await touchProblems(page, `${where} (end)`)));
        if (k === "shop" && a === "furniture") {
          await snap(page, info, `bistro-touch-shop-${size.name}`);
          // − and + whole, around a count of its own size (the page's field
          // style once squeezed them to 17 px slivers).
          const step = await page.evaluate(() =>
            [...document.querySelectorAll("#bs-sheet .bs-step > *")].map((e) =>
              Math.round(e.getBoundingClientRect().width),
            ),
          );
          const tall = await page.evaluate(() =>
            [...document.querySelectorAll("#bs-sheet .bs-step > button")].map(
              (e) => Math.round(e.getBoundingClientRect().height),
            ),
          );
          expect(tall).toEqual([32, 32]);
          // An iOS stepper's size: 32 px parts, not the 40 px they grew to.
          expect(step[0]).toBe(32);
          expect(step[2]).toBe(32);
          expect(step[1]).toBeLessThanOrEqual(48);
        }
      }
      // A long list scrolls under a finger (the team, a dozen cards down).
      await page.evaluate(() =>
        (window as any).__bistro.sheet("staff", "team"),
      );
      await page.waitForTimeout(300);
      expect(await fingerScroll(page, "#bs-sheet .bs-team")).toBeGreaterThan(
        40,
      );
      await snap(page, info, `bistro-touch-team-${size.name}`);
      await page.click("#bs-sheet [data-close]");
      // Decorate, holding a piece from storage.
      await page.click('.bs-rail [data-act="decor"]');
      all.push(...(await touchProblems(page, `${size.name} decorate`)));
      await page.click("#bs-edit [data-hold]");
      all.push(...(await touchProblems(page, `${size.name} decorate holding`)));
      await snap(page, info, `bistro-touch-decorate-${size.name}`);
      // The piece's own buttons sit on it at once (its ghost shows on a free
      // tile), and the bar keeps only storage, Shop and Done.
      const acts = page.locator("#bs-held");
      await expect(acts).toBeVisible();
      await expect(page.locator('#bs-edit [data-ed="cancel"]')).toHaveCount(0);
      await page.locator('#bs-held [data-ed="cancel"]').tap();
      await expect(acts).toBeHidden();
      // A piece in the room: tap it, and the box puts it away.
      const item = (await B(
        page,
        `const it = srv.S.items.find((i) => i.kind === 'plant') ?? srv.S.items.find((i) => !['table','chair','stool'].includes(i.kind));
         const p = b.screen(it.x, it.y, 20); return { kind: it.kind, x: p.x, y: p.y, stored: srv.S.stored[it.kind] ?? 0 };`,
      )) as { kind: string; x: number; y: number; stored: number };
      await page.touchscreen.tap(item.x, item.y);
      await expect(page.locator('#bs-held [data-ed="store"]')).toBeVisible();
      all.push(...(await touchProblems(page, `${size.name} decorate moving`)));
      await page.locator('#bs-held [data-ed="store"]').tap();
      await expect(acts).toBeHidden();
      await B(page, "return b.flush()");
      expect(await B(page, `return srv.S.stored['${item.kind}'] ?? 0`)).toBe(
        item.stored + 1,
      );
      await page.click('#bs-edit [data-ed="done"]');
      // The report after time away.
      await B(page, "srv.S.lastSeen -= 9 * 3600 * 1000; return b.load()");
      await expect(page.locator(".bs-away")).toBeVisible();
      all.push(...(await touchProblems(page, `${size.name} away`)));
      await page.click(".bs-away [data-collect]");
      expect(all).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
