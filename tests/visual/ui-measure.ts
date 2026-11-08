import type { Locator, Page } from "@playwright/test";
import { settle } from "./helpers";
import { decodePng } from "./png";

/**
 * The UI remodel's layout rules, measured (docs/ui-remodel/PLAN.md, "Tests").
 * Every hub screen's spec runs these at 1440×900, 1280×720, 844×390 and
 * 852×393 with the Dynamic Island insets:
 *
 * - buttons in an action group have one width, one height and one top edge;
 * - small buttons on one row share their height;
 * - the HUD, the rail, an open panel and (beside a sheet) PLAY never overlap,
 *   and all stay inside the safe area;
 * - no button label is cut off;
 * - on phones every control in sight can be hit across at least 44 px
 *   (one scrolled out of its list is checked once it is scrolled to).
 *
 * Each returns a list of problems (empty when the screen is right), so a
 * failure says exactly what is wrong.
 */
export interface Insets {
  left: number;
  right: number;
  bottom: number;
  top: number;
}
export const ISLAND: Insets = { left: 59, right: 59, bottom: 21, top: 0 };

/** Simulate a notch / Dynamic Island the way lobby-safe-area.spec.ts does. */
export async function setInsets(page: Page, inset: Insets) {
  await page.evaluate((inset) => {
    for (const [key, value] of Object.entries(inset))
      document.documentElement.style.setProperty(`--safe-${key}`, `${value}px`);
  }, inset);
  await page.waitForTimeout(100);
}

export async function layoutProblems(
  page: Page,
  o: { inset?: Insets; phone?: boolean } = {},
) {
  await settle(page);
  return page.evaluate(
    ({ inset, phone }) => {
      const out: string[] = [];
      const R = (e: Element) => e.getBoundingClientRect();
      const shown = (e: Element) => {
        const r = R(e);
        const s = getComputedStyle(e);
        return (
          r.width > 0 &&
          r.height > 0 &&
          s.visibility !== "hidden" &&
          s.display !== "none"
        );
      };
      const name = (e: Element) =>
        (
          e.getAttribute("aria-label") ||
          e.textContent ||
          e.className ||
          e.tagName
        )
          .toString()
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 30);
      const near = (a: number, b: number) => Math.abs(a - b) <= 0.5;
      /**
       * Wholly in sight: not scrolled out of (or cut by) a scrolling box,
       * with `reach` px to spare above and below (a finger's 44 px around a
       * small control: one resting on a list's edge is reached once
       * scrolled, and the specs scroll and measure again).
       */
      const inView = (e: Element, reach = 0) => {
        const r = R(e);
        if (r.top < 0 || r.bottom > innerHeight) return false;
        for (let p = e.parentElement; p; p = p.parentElement) {
          if (!/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowY))
            continue;
          const b = R(p);
          const scrolls = p.scrollHeight > p.clientHeight + 1;
          const m = scrolls ? reach : 0;
          if (r.top - m < b.top - 0.5 || r.bottom + m > b.bottom + 0.5)
            return false;
        }
        return true;
      };

      // 1. Action groups: equal buttons on one line.
      for (const g of Array.from(document.querySelectorAll(".ui-actions"))) {
        const bs = Array.from(g.children).filter(shown).map(R);
        for (const b of bs)
          if (
            !near(b.width, bs[0].width) ||
            !near(b.height, bs[0].height) ||
            !near(b.top, bs[0].top)
          )
            out.push(
              `unequal buttons in a group: ${bs.map((x) => `${x.width.toFixed(1)}×${x.height.toFixed(1)}@${x.top.toFixed(1)}`).join(", ")}`,
            );
      }
      // 2. Small buttons on one row: one height.
      const rows = new Map<number, DOMRect[]>();
      for (const e of Array.from(
        document.querySelectorAll(".ui-btn.is-s"),
      ).filter(shown)) {
        const r = R(e);
        const k = Math.round(r.top + r.height / 2);
        rows.set(k, [...(rows.get(k) ?? []), r]);
      }
      for (const [y, rs] of rows)
        if (rs.some((r) => !near(r.height, rs[0].height)))
          out.push(`small buttons of different heights at y≈${y}`);

      // 3. The big boxes: no overlaps, inside the screen and its safe area.
      const boxes: [string, Element][] = [];
      const add = (label: string, sel: string) =>
        document
          .querySelectorAll(sel)
          .forEach((e, i) => shown(e) && boxes.push([`${label}${i || ""}`, e]));
      add("profile", "#account-profile");
      add("scenes", "#hub-scenes");
      add("coins", "#account-coins > *");
      add("leaves", "#account-leaves > *");
      add("settings", "#home-settings");
      add("menu", ".header-menu > summary");
      add("rail", ".lobby-rail");
      add("panel", ".ui-panel");
      if (document.querySelector(".ui-sheet")) add("play", ".lobby-play");
      const L = inset?.left ?? 0,
        Rt = innerWidth - (inset?.right ?? 0),
        B = innerHeight - (inset?.bottom ?? 0),
        T = inset?.top ?? 0;
      for (const [label, e] of boxes) {
        const r = R(e);
        if (
          r.left < L - 0.5 ||
          r.right > Rt + 0.5 ||
          r.bottom > B + 0.5 ||
          r.top < T - 0.5
        )
          out.push(
            `${label} outside the safe area: ${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}`,
          );
      }
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = R(boxes[i][1]),
            b = R(boxes[j][1]);
          if (
            a.left < b.right - 1 &&
            b.left < a.right - 1 &&
            a.top < b.bottom - 1 &&
            b.top < a.bottom - 1
          )
            out.push(`${boxes[i][0]} overlaps ${boxes[j][0]}`);
        }

      // 4. Labels fit their buttons.
      for (const e of Array.from(
        document.querySelectorAll(".ui-btn, .ui-chip, .ui-tabs > button"),
      ).filter(shown))
        if (e.scrollWidth > e.clientWidth + 1)
          out.push(`label cut off: ${name(e)}`);

      // 5. Phones: a finger 44 px tall lands on the control (its hit area may
      //    be larger than what it draws).
      //    While a confirmation is open, only its own buttons can be hit (the
      //    screen under its scrim is covered on purpose).
      if (phone)
        for (const e of Array.from(
          document.querySelectorAll(
            document.querySelector(".ui-scrim")
              ? ".ui-modal .ui-btn"
              : ".ui-panel .ui-btn, .ui-panel .ui-icon-btn, .ui-modal .ui-btn",
          ),
        ).filter(shown)) {
          const r = R(e);
          const reach = (44 - r.height) / 2 - 1;
          if (r.height >= 44 || !inView(e, reach)) continue;
          for (const y of [r.top - reach, r.bottom + reach]) {
            const hit = document.elementFromPoint(r.left + r.width / 2, y);
            if (!hit || !(e === hit || e.contains(hit)))
              out.push(
                `hit area under 44 px: ${name(e)} (${r.width.toFixed(0)}×${r.height.toFixed(0)}, ${hit ? name(hit) : "nothing"} at y=${y.toFixed(0)})`,
              );
          }
        }
      return out;
    },
    { inset: o.inset ?? null, phone: !!o.phone },
  );
}

/** Close's distance from its panel's top-right corner, and its size. */
export async function closeSpot(page: Page) {
  await settle(page);
  return page.evaluate(() =>
    Array.from(document.querySelectorAll(".ui-panel")).map((p) => {
      const c = p.querySelector(".ui-close")!.getBoundingClientRect();
      const r = p.getBoundingClientRect();
      return {
        right: Math.round(r.right - c.right),
        top: Math.round(c.top - r.top),
        size: Math.round(c.width),
      };
    }),
  );
}

/**
 * How far a control's ink (its label and icon, in pixels) sits from the
 * middle of its box: { dx, dy } in CSS pixels. Measured on a screenshot, so it
 * catches font metrics and padding that layout boxes hide.
 */
export async function inkOffset(page: Page, target: Locator) {
  const shot = await target.screenshot({ animations: "disabled" });
  // Read in Node: decoding in the page waited on a main thread that is busy
  // drawing the live Lobby or a battle (seconds a shot on a software GPU).
  const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
  const { data, width, height } = decodePng(shot);
  // The fill is the most common colour on the middle row; ink is anything
  // far from it. Ignore a 3 px rim (border, shadow, rounded corners).
  const at = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const counts = new Map<string, number>();
  for (let x = 3; x < width - 3; x++) {
    const k = at(x, Math.floor(height / 2))
      .map((v) => v >> 3)
      .join(",");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const fill = [...counts]
    .sort((a, b) => b[1] - a[1])[0][0]
    .split(",")
    .map((v) => Number(v) * 8 + 4);
  let x0 = width,
    x1 = -1,
    y0 = height,
    y1 = -1;
  const rim = Math.max(3, Math.round(height * 0.12));
  for (let y = rim; y < height - rim; y++)
    for (let x = rim; x < width - rim; x++) {
      const p = at(x, y);
      if (
        Math.abs(p[0] - fill[0]) +
          Math.abs(p[1] - fill[1]) +
          Math.abs(p[2] - fill[2]) >
        150
      ) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  if (x1 < 0) return { dx: NaN, dy: NaN };
  return {
    dx: ((x0 + x1 + 1) / 2 - width / 2) / dpr,
    dy: ((y0 + y1 + 1) / 2 - height / 2) / dpr,
  };
}
