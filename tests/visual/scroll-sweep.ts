import type { Page } from "@playwright/test";

/**
 * Can every panel's long content be reached? (owner, 5 Nov: "if the content
 * inside the panel is long then I have the ability to scroll").
 *
 * `scrollSweep` looks inside `root` for two kinds of trouble:
 *  - a scroller (overflow auto/scroll, more content than room) that a finger
 *    can't swipe to its end: covered by something else, or blocked by
 *    touch-action or a touch listener;
 *  - text or a control cut off by a box that doesn't scroll at all, so no
 *    swipe can bring it into sight.
 * The swipe is real touch input (CDP touch events obey touch-action the way
 * a phone does; the wheel and scrollTop would prove nothing). `fingerWorks`
 * proves the swipe works in this browser first.
 */

/** A finger from (x, y), moved by (dx, dy). */
export async function finger(
  page: Page,
  x: number,
  y: number,
  dx: number,
  dy: number,
) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 10; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + (dx * i) / 10, y: y + (dy * i) / 10 }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
  await page.waitForTimeout(300);
}

/** A plain scroll box on top of the page scrolls under the swipe. */
export async function fingerWorks(page: Page) {
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.id = "sweep-probe";
    d.style.cssText =
      "position:fixed;left:10px;top:10px;width:160px;height:160px;overflow:auto;z-index:2147483647;background:#fff;touch-action:pan-y";
    d.innerHTML = '<div style="height:1000px"></div>';
    document.body.append(d);
  });
  await finger(page, 90, 150, 0, -100);
  const moved = await page.evaluate(() => {
    const d = document.getElementById("sweep-probe")!;
    const top = d.scrollTop;
    d.remove();
    return top;
  });
  return moved > 10;
}

interface Spot {
  x: number;
  y: number;
}
interface Scroller {
  id: string;
  name: string;
  axis: "y" | "x";
  overflow: number;
  spots: Spot[];
}

/** Scrollers inside `root` with content past their edge, and where a finger
 * can land on each (a spot whose nearest scroller is that one). */
async function findScrollers(page: Page, root: string) {
  return page.evaluate((root) => {
    const name = (e: Element) =>
      `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ""}.${[...e.classList].slice(0, 3).join(".")}`;
    const scrollsY = (e: Element) => {
      const o = getComputedStyle(e).overflowY;
      return (
        (o === "auto" || o === "scroll") && e.scrollHeight > e.clientHeight + 4
      );
    };
    const scrollsX = (e: Element) => {
      const o = getComputedStyle(e).overflowX;
      return (
        (o === "auto" || o === "scroll") && e.scrollWidth > e.clientWidth + 4
      );
    };
    const out: {
      id: string;
      name: string;
      axis: "y" | "x";
      overflow: number;
      spots: { x: number; y: number }[];
    }[] = [];
    let n = 0;
    for (const base of document.querySelectorAll(root))
      for (const el of [base, ...base.querySelectorAll("*")]) {
        if (!(el instanceof HTMLElement)) continue;
        if (!el.checkVisibility({ visibilityProperty: true })) continue;
        for (const axis of ["y", "x"] as const) {
          if (axis === "y" ? !scrollsY(el) : !scrollsX(el)) continue;
          const r = el.getBoundingClientRect();
          const left = Math.max(r.left, 0),
            right = Math.min(r.right, innerWidth),
            top = Math.max(r.top, 0),
            bottom = Math.min(r.bottom, innerHeight);
          if (right - left < 24 || bottom - top < 24) continue;
          if (axis === "y") el.scrollTop = 0;
          else el.scrollLeft = 0;
          const id = `s${n++}`;
          el.dataset.sweep = id;
          const spots: { x: number; y: number }[] = [];
          const fx = [0.15, 0.5, 0.85, 0.3, 0.7];
          const fy = [0.8, 0.5, 0.2];
          for (const b of fy)
            for (const a of fx) {
              const x = Math.round(left + (right - left) * a);
              const y = Math.round(top + (bottom - top) * b);
              const hit = document.elementFromPoint(x, y);
              let s: Element | null = hit;
              while (s && !(axis === "y" ? scrollsY(s) : scrollsX(s)))
                s = s.parentElement;
              if (s === el) spots.push({ x, y });
            }
          out.push({
            id,
            name: name(el),
            axis,
            overflow:
              axis === "y"
                ? el.scrollHeight - el.clientHeight
                : el.scrollWidth - el.clientWidth,
            spots,
          });
        }
      }
    return out;
  }, root);
}

/** Text and controls cut off by a box that doesn't scroll. */
export async function cutOff(page: Page, root: string) {
  return page.evaluate((root) => {
    const out: string[] = [];
    const name = (e: Element) =>
      `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ""}.${[...e.classList].slice(0, 3).join(".")}`;
    for (const base of document.querySelectorAll(root))
      for (const el of base.querySelectorAll<HTMLElement>(
        "button, a, b, p, li, small, h2, h3, h4, label, input, .ui-tag, .ui-note, summary",
      )) {
        let r = el.getBoundingClientRect();
        // Visually hidden helpers (1 px) and things not shown at all.
        if (r.width < 3 || r.height < 3) continue;
        if (
          !el.checkVisibility({
            contentVisibilityAuto: true,
            visibilityProperty: true,
            opacityProperty: true,
          })
        )
          continue;
        for (
          let a = el.parentElement;
          a && a !== document.documentElement;
          a = a.parentElement
        ) {
          const cs = getComputedStyle(a);
          if (cs.overflowY === "visible") continue;
          const b = a.getBoundingClientRect();
          const scrolls =
            (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
            a.scrollHeight > a.clientHeight + 1;
          if (scrolls) {
            // Reachable inside it; the scroller itself must be in sight.
            r = b;
            continue;
          }
          const cut = Math.max(r.bottom - b.bottom, b.top - r.top);
          if (cut > 2) {
            out.push(
              `${name(el)} "${(el.textContent ?? "").trim().slice(0, 28)}" cut ${Math.round(cut)}px by ${name(a)}`,
            );
            break;
          }
        }
        // The window itself (the page doesn't scroll in the hub).
        if (r.bottom > innerHeight + 2 || r.top < -2)
          out.push(
            `${name(el)} "${(el.textContent ?? "").trim().slice(0, 28)}" off screen (${Math.round(r.top)}..${Math.round(r.bottom)})`,
          );
      }
    return [...new Set(out)];
  }, root);
}

/** Swipe every scroller in `root` to its end; list what can't be reached. */
export async function scrollSweep(page: Page, root: string) {
  const problems: string[] = [];
  const seen: string[] = [];
  for (const s of await findScrollers(page, root)) {
    seen.push(`${s.name} ${s.axis} +${s.overflow}`);
    if (!s.spots.length) {
      problems.push(`${s.name}: covered, no spot a finger can scroll it from`);
      continue;
    }
    const el = page.locator(`[data-sweep="${s.id}"]`);
    const at = () =>
      el.evaluate(
        (n, axis) => (axis === "y" ? n.scrollTop : n.scrollLeft),
        s.axis,
      );
    const stuck = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const before = await at();
      if (before >= s.overflow - 2) break;
      const spot = s.spots[i % s.spots.length];
      // Find where the spot is now (the scroller may have moved).
      const dist = await el.evaluate((n, axis) => {
        const r = n.getBoundingClientRect();
        const size =
          axis === "y"
            ? Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)
            : Math.min(r.right, innerWidth) - Math.max(r.left, 0);
        return Math.round(Math.max(30, Math.min(220, size * 0.55)));
      }, s.axis);
      // Start far enough from the edge the finger moves towards.
      if (s.axis === "y") await finger(page, spot.x, spot.y, 0, -dist);
      else await finger(page, spot.x, spot.y, -dist, 0);
      if ((await at()) - before < 3) stuck.add(`${spot.x},${spot.y}`);
    }
    const end = await at();
    if (end < s.overflow - 2)
      problems.push(
        `${s.name}: a swipe gets ${end} of ${s.overflow} px${stuck.size ? ` (stuck at ${[...stuck].slice(0, 3).join(" ")})` : ""}`,
      );
    await el.evaluate((n) => n.removeAttribute("data-sweep"));
  }
  return { problems, seen, cuts: await cutOff(page, root) };
}
