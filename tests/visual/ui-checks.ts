import { expect, type Page } from "@playwright/test";
import { inkOffset } from "./ui-measure";

/**
 * Layout checks that assert, shared by the hub screens' specs (UI remodel
 * steps 6 and 7; the owner's priority: every label centred in its box,
 * measured on the pixels, rows even, nothing spilling out of its box).
 */
export async function settled(page: Page, root: string) {
  await page.evaluate(async (root) => {
    await document.fonts.ready;
    const el = document.querySelector(root);
    await Promise.all(
      (el?.getAnimations({ subtree: true }) ?? [])
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  }, root);
  await page.waitForTimeout(300);
}
/** A label's ink in the middle of its box (within the borders), in px. */
export async function centred(
  page: Page,
  selector: string,
  label: string,
  max = 1,
  o: { across?: boolean } = {},
) {
  const target = page.locator(selector).first();
  await target.scrollIntoViewIfNeeded();
  const ink = await inkOffset(page, target);
  ink.dy += await target.evaluate((e) => {
    const cs = getComputedStyle(e);
    return (
      (parseFloat(cs.borderBottomWidth) - parseFloat(cs.borderTopWidth)) / 2
    );
  });
  expect(
    Math.abs(ink.dx),
    `${label}: ink ${ink.dx},${ink.dy} px off centre`,
  ).toBeLessThanOrEqual(max);
  if (!o.across)
    expect(
      Math.abs(ink.dy),
      `${label}: ink ${ink.dx},${ink.dy} px off centre`,
    ).toBeLessThanOrEqual(max);
}
/**
 * A round badge's label against the badge: inkOffset's rim is too thin for an
 * 18 px circle (its dark corners read as ink), so take the label's own
 * pixels (near white) and the circle's box.
 */
export async function badgeCentred(
  page: Page,
  selector: string,
  label: string,
) {
  const target = page.locator(selector).first();
  const shot = await target.screenshot({ animations: "disabled" });
  const off = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    let x0 = width,
      x1 = -1,
      y0 = height,
      y1 = -1;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i] > 225 && data[i + 1] > 225 && data[i + 2] > 225) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
    const dpr = window.devicePixelRatio || 1;
    return {
      dx: ((x0 + x1 + 1) / 2 - width / 2) / dpr,
      dy: ((y0 + y1 + 1) / 2 - height / 2) / dpr,
    };
  }, shot.toString("base64"));
  expect(
    Math.abs(off.dx),
    `${label}: ${off.dx},${off.dy} px off centre`,
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(off.dy),
    `${label}: ${off.dx},${off.dy} px off centre`,
  ).toBeLessThanOrEqual(1);
}
/** One element's box centre against another's (headings in cards). */
export async function boxCentred(
  page: Page,
  inner: string,
  outer: string,
  label: string,
) {
  const [a, b] = await Promise.all([
    page.locator(inner).first().boundingBox(),
    page.locator(outer).first().boundingBox(),
  ]);
  const dx = a!.x + a!.width / 2 - (b!.x + b!.width / 2);
  expect(
    Math.abs(dx),
    `${label}: ${dx.toFixed(1)} px off centre`,
  ).toBeLessThanOrEqual(2);
}
/** Anything whose content is wider than its box without an ellipsis. */
export async function spills(page: Page, root: string) {
  return page.evaluate((root) => {
    const out: string[] = [];
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>(`${root} *`),
    )) {
      const cs = getComputedStyle(el);
      if (
        cs.display === "none" ||
        cs.visibility === "hidden" ||
        !el.offsetParent
      )
        continue;
      // A portrait frame's ornaments sit past the portrait on purpose (portraits.ts).
      if (
        el.matches(
          "svg, svg *, input, .ui-panel-body, [data-friends-list], .rk-list, .rk-card, .portrait-frame, .portrait-frame *, .fr-avatar:has(.portrait-frame), .ui-tabs",
        )
      )
        continue;
      // Only boxes with their own text: a small button's 44 px hit area on
      // phones is a pseudo-element past its edge, by design.
      const text = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && n.textContent!.trim(),
      );
      if (!text) continue;
      if (
        el.scrollWidth > el.clientWidth + 1 &&
        cs.textOverflow !== "ellipsis" &&
        cs.overflowX !== "auto"
      )
        out.push(
          `${el.className || el.tagName}: ${el.textContent?.trim().slice(0, 30)} (${el.scrollWidth} > ${el.clientWidth})`,
        );
    }
    return out;
  }, root);
}
/** Rows that share their left edge and their height. */
export async function rowsEven(page: Page, selector: string) {
  return page.evaluate((selector) => {
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>(selector),
    ).map((e) => e.getBoundingClientRect());
    const lefts = new Set(rows.map((r) => Math.round(r.left)));
    const heights = new Set(rows.map((r) => Math.round(r.height)));
    return { count: rows.length, lefts: [...lefts], heights: [...heights] };
  }, selector);
}

/** The distinct sizes ("WxH", rounded) of the boxes a selector finds. */
export async function sizes(page: Page, selector: string) {
  return page.evaluate((selector) => {
    const all = Array.from(document.querySelectorAll(selector)).map((e) => {
      const r = e.getBoundingClientRect();
      return `${Math.round(r.width)}x${Math.round(r.height)}`;
    });
    return [...new Set(all)];
  }, selector);
}
