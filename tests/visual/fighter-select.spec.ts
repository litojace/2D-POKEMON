import { expect, test } from "@playwright/test";
import { openHub, snap, hubMenu } from "./helpers";

// The harness account wears a Voltkit skin. The still artwork must step aside
// once the animated (skinned) fighter is drawn, or the fighter shows twice.
// (The roster's fighter detail, UI remodel step 3.)
test("fighter select shows one fighter, even with a skin on", async ({
  page,
}, info) => {
  const errors = await openHub(page);
  await hubMenu(page, "fighters");
  await page.click('[data-roster-details="voltkit"]');
  const stage = page.locator(".roster-stage .fighter-rig-stage");
  await expect(stage).toHaveAttribute(
    "data-preview-item",
    "voltkit-stormcrown",
  );
  await expect(stage).toHaveClass(/is-ready/);
  await expect(stage.locator("canvas")).toHaveCSS("opacity", "1");
  await expect(stage.locator("svg .fighter-character").first()).toHaveCSS(
    "visibility",
    "hidden",
  );
  await snap(page, info, "fighter-select");
  // The grid's cards put every fighter's eye line at the same height. Map
  // that line (y = 93 in the 200x190 art) through the eyes layer's own
  // transform instead of measuring the eyes' outline: every champion draws
  // its eyes in its own shape, which moves the outline but not the face.
  await page.click("[data-roster-back]");
  // A card shows its art as one picture (svgBackdrop) in an <svg> box with
  // the art's viewBox: the eyes layer's transform comes from the picture's
  // own SVG, laid out off screen at 1 px per unit, then the point goes
  // through the card's box.
  const eyeLine = async (id: string) =>
    page
      .locator(`[data-roster-card="${id}"] .roster-card-art > svg`)
      .evaluate(async (box) => {
        const svg = box as SVGSVGElement;
        const url = svg.style.backgroundImage.match(/url\("?([^")]+)/)?.[1];
        let point = new DOMPoint(100, 93);
        if (url) {
          const art = new DOMParser().parseFromString(
            await (await fetch(url)).text(),
            "image/svg+xml",
          ).documentElement as unknown as SVGSVGElement;
          const [x, y, w, h] = art.getAttribute("viewBox")!.split(/\s+/);
          art.setAttribute("width", w);
          art.setAttribute("height", h);
          art.style.cssText = "position:fixed;left:0;top:0;visibility:hidden";
          document.body.append(art);
          const g = art.querySelector<SVGGraphicsElement>(".fighter-eyes > g")!;
          const p = point.matrixTransform(g.getCTM()!);
          art.remove();
          point = new DOMPoint(p.x + Number(x), p.y + Number(y));
        } else {
          // Inline art (no pictures in this browser).
          const g = svg.querySelector<SVGGraphicsElement>(".fighter-eyes > g")!;
          return point.matrixTransform(g.getScreenCTM()!).y;
        }
        return point.matrixTransform(svg.getScreenCTM()!).y;
      });
  const row = async (id: string) =>
    page
      .locator(`[data-roster-card="${id}"]`)
      .evaluate((el) => el.getBoundingClientRect().top);
  // Compare two cards on the same row.
  const [a, b] = await page
    .locator(".roster-card")
    .evaluateAll((els) =>
      els.slice(0, 2).map((e) => (e as HTMLElement).dataset.rosterCard!),
    );
  expect(Math.abs((await row(a)) - (await row(b)))).toBeLessThan(1);
  expect(Math.abs((await eyeLine(a)) - (await eyeLine(b)))).toBeLessThan(1.5);
  // Switching fighters keeps exactly one visible too.
  await page.click('[data-roster-card="terradon"]');
  await page.click("[data-roster-details]");
  await expect(stage).toHaveAttribute("data-preview-champion", "terradon");
  await expect(stage).toHaveClass(/is-ready/);
  await expect(stage.locator("svg .fighter-character").first()).toHaveCSS(
    "visibility",
    "hidden",
  );
  expect(errors).toEqual([]);
});
