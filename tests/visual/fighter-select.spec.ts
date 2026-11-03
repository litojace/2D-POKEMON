import { expect, test } from "@playwright/test";
import { openHub, snap, hubMenu } from "./helpers";

// The harness account wears a Voltkit skin. The still artwork must step aside
// once the animated (skinned) fighter is drawn, or the fighter shows twice.
test("fighter select shows one fighter, even with a skin on", async ({
  page,
}, info) => {
  const errors = await openHub(page);
  await hubMenu(page, "fighters");
  const stage = page.locator(".fighter-rig-stage").first();
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
  const terradon = page.locator(
    '.showcase-card[data-character="terradon"] .card-art>svg',
  );
  await expect(terradon).toHaveAttribute("viewBox", "30 3 140 140");
  // Each card must put the eye line (y = 93 in the 200x190 art) at the same
  // height. Map that line through the eyes layer's own transform instead of
  // measuring the eyes' outline: every champion now draws its eyes in its own
  // shape (Terradon's drowsy lids, Lumoth's lashes), which moves the outline
  // but not the face.
  const eyeLine = async (id: string) =>
    page
      .locator(`.showcase-card[data-character="${id}"] .fighter-eyes > g`)
      .evaluate(
        (g) =>
          new DOMPoint(100, 93).matrixTransform(
            (g as SVGGraphicsElement).getScreenCTM()!,
          ).y,
      );
  expect(
    Math.abs((await eyeLine("terradon")) - (await eyeLine("lumoth"))),
  ).toBeLessThan(1.5);
  // Switching fighters keeps exactly one visible too.
  await page
    .getByRole("button", { name: /Terradon/ })
    .first()
    .click();
  await expect(stage).toHaveAttribute("data-preview-champion", "terradon");
  await expect(stage).toHaveClass(/is-ready/);
  await expect(stage.locator("svg .fighter-character").first()).toHaveCSS(
    "visibility",
    "hidden",
  );
  expect(errors).toEqual([]);
});
