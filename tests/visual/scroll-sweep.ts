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

/**
 * Mark the scrollers inside `root` that have content past their edge (big
 * enough to touch). Spots are found later, one scroller at a time, since
 * sweeping one moves the others (a chip row inside a panel that scrolls).
 */
async function findScrollers(page: Page, root: string) {
  return page.evaluate((root) => {
    const name = (e: Element) =>
      `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ""}.${[...e.classList].slice(0, 3).join(".")}`;
    const out: { id: string; name: string; axis: "y" | "x" }[] = [];
    let n = 0;
    for (const base of document.querySelectorAll(root))
      for (const el of [base, ...base.querySelectorAll("*")]) {
        if (!(el instanceof HTMLElement)) continue;
        if (!el.checkVisibility({ visibilityProperty: true })) continue;
        const cs = getComputedStyle(el);
        for (const axis of ["y", "x"] as const) {
          const o = axis === "y" ? cs.overflowY : cs.overflowX;
          const more =
            axis === "y"
              ? el.scrollHeight - el.clientHeight
              : el.scrollWidth - el.clientWidth;
          if ((o !== "auto" && o !== "scroll") || more <= 4) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 24 || r.height < 24) continue;
          const id = `s${n++}`;
          el.dataset[`sweep${axis}`] = id;
          out.push({ id, name: name(el), axis });
        }
      }
    return out;
  }, root);
}

/**
 * Put one scroller at its start and in sight (its scrolling ancestors moved
 * so it shows), and find where a finger can land on it: a spot whose
 * nearest scroller on that axis is this one.
 */
async function prepare(page: Page, id: string, axis: "y" | "x") {
  return page.evaluate(
    ([id, axis]) => {
      const el = document.querySelector<HTMLElement>(
        `[data-sweep${axis}="${id}"]`,
      )!;
      const scrolls = (e: Element, ax: "y" | "x") => {
        const cs = getComputedStyle(e);
        const o = ax === "y" ? cs.overflowY : cs.overflowX;
        return (
          (o === "auto" || o === "scroll") &&
          (ax === "y"
            ? e.scrollHeight > e.clientHeight + 4
            : e.scrollWidth > e.clientWidth + 4)
        );
      };
      if (axis === "y") el.scrollTop = 0;
      else el.scrollLeft = 0;
      // Scrolling ancestors: bring the scroller into their view.
      for (let a = el.parentElement; a; a = a.parentElement) {
        if (!scrolls(a, "y")) continue;
        const r = el.getBoundingClientRect(),
          b = a.getBoundingClientRect();
        if (r.top < b.top || r.bottom > b.bottom)
          a.scrollTop += r.top - b.top - Math.max(0, (b.height - r.height) / 2);
      }
      const r = el.getBoundingClientRect();
      const left = Math.max(r.left, 0),
        right = Math.min(r.right, innerWidth),
        top = Math.max(r.top, 0),
        bottom = Math.min(r.bottom, innerHeight);
      const spots: { x: number; y: number }[] = [];
      if (right - left < 16 || bottom - top < 16)
        return { overflow: 0, spots, size: 0, offscreen: true };
      const fx = [0.15, 0.5, 0.85, 0.3, 0.7];
      const fy = axis === "y" ? [0.8, 0.5, 0.2] : [0.5, 0.25, 0.75];
      for (const b of fy)
        for (const a of fx) {
          const x = Math.round(left + (right - left) * a);
          const y = Math.round(top + (bottom - top) * b);
          let s: Element | null = document.elementFromPoint(x, y);
          while (s && !scrolls(s, axis)) s = s.parentElement;
          if (s === el) spots.push({ x, y });
        }
      return {
        overflow:
          axis === "y"
            ? el.scrollHeight - el.clientHeight
            : el.scrollWidth - el.clientWidth,
        spots,
        size: axis === "y" ? bottom - top : right - left,
        offscreen: false,
      };
    },
    [id, axis] as const,
  );
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
        // An ancestor clips only boxes whose containing block is it or
        // inside it: a fixed box escapes them all, an absolute one escapes
        // those below its positioned ancestor.
        const pos = (e: Element) => getComputedStyle(e).position;
        let skipTo: Element | null =
          pos(el) === "fixed"
            ? document.documentElement
            : pos(el) === "absolute"
              ? el.offsetParent
              : null;
        for (
          let a = el.parentElement;
          a && a !== document.documentElement;
          a = a.parentElement
        ) {
          if (skipTo && a !== skipTo) continue;
          skipTo = null;
          const cs = getComputedStyle(a);
          if (cs.overflowY !== "visible") {
            const b = a.getBoundingClientRect();
            const scrolls =
              (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
              a.scrollHeight > a.clientHeight + 1;
            if (scrolls) {
              // Reachable inside it; the scroller itself must be in sight.
              r = b;
            } else {
              const cut = Math.max(r.bottom - b.bottom, b.top - r.top);
              if (cut > 2) {
                out.push(
                  `${name(el)} "${(el.textContent ?? "").trim().slice(0, 28)}" cut ${Math.round(cut)}px by ${name(a)}`,
                );
                break;
              }
            }
          }
          if (cs.position === "fixed") skipTo = document.documentElement;
          else if (cs.position === "absolute")
            skipTo = (a as HTMLElement).offsetParent;
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
    const prep = await prepare(page, s.id, s.axis);
    seen.push(`${s.name} ${s.axis} +${prep.overflow}`);
    if (prep.offscreen) {
      problems.push(`${s.name}: out of sight, can't be brought into view`);
      continue;
    }
    if (!prep.spots.length) {
      problems.push(`${s.name}: covered, no spot a finger can scroll it from`);
      continue;
    }
    const el = page.locator(`[data-sweep${s.axis}="${s.id}"]`);
    const at = () =>
      el.evaluate(
        (n, axis) => (axis === "y" ? n.scrollTop : n.scrollLeft),
        s.axis,
      );
    const dist = Math.round(Math.max(30, Math.min(220, prep.size * 0.55)));
    const stuck = new Set<string>();
    // Until the end, or three swipes in a row that move nothing.
    for (let i = 0, still = 0; i < 60 && still < 3; i++) {
      const before = await at();
      if (before >= prep.overflow - 2) break;
      const spot = prep.spots[i % prep.spots.length];
      if (s.axis === "y") await finger(page, spot.x, spot.y, 0, -dist);
      else await finger(page, spot.x, spot.y, -dist, 0);
      if ((await at()) - before < 3) {
        still++;
        stuck.add(`${spot.x},${spot.y}`);
      } else still = 0;
    }
    const end = await at();
    if (end < prep.overflow - 2)
      problems.push(
        `${s.name}: a swipe gets ${end} of ${prep.overflow} px${stuck.size ? ` (stuck at ${[...stuck].slice(0, 3).join(" ")})` : ""}`,
      );
  }
  await page.evaluate(() =>
    document.querySelectorAll("[data-sweepy], [data-sweepx]").forEach((n) => {
      n.removeAttribute("data-sweepy");
      n.removeAttribute("data-sweepx");
    }),
  );
  return { problems, seen, cuts: await cutOff(page, root) };
}
