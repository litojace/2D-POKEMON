import { describe, expect, it } from "vitest";
import {
  PREVIEW_FX_TOP,
  SHOP_PREVIEW,
  previewViewBox,
  shopPreviewCamera,
  shopPreviewZoom,
} from "../../apps/client/src/shop-preview-layout";
import { WORLD_ART } from "../../packages/shared/src/world-art";

/**
 * The Shop's preview camera (shop-preview-layout.ts shopPreviewCamera).
 * Owner, 26 Nov: a victory (Trophy victory) was cut off in a straight line
 * near the stage's top on a phone, and its trophy rose out of the frame.
 */
const { y, scale, cameraY } = SHOP_PREVIEW;
/** Where a world y lands on the canvas, in viewport units from its top. */
const onCanvas = (worldY: number, height: number, action: string, top = 0) => {
  const { zoom, centerY } = shopPreviewCamera(action, height, top);
  return height / 2 + (worldY - centerY) * zoom;
};

describe("the Shop's preview camera", () => {
  it("draws a fighter at rest exactly where it stood below the phone's band", () => {
    for (const height of [260, 300, 320, 363, 420])
      for (const top of [0, 20, 41.5]) {
        const below = height - top;
        const was = below / 2 + (y - cameraY) * shopPreviewZoom("idle", below);
        expect(shopPreviewCamera("idle", height, top).zoom).toBeCloseTo(
          shopPreviewZoom("idle", below),
          9,
        );
        expect(onCanvas(y, height, "idle", top)).toBeCloseTo(top + was, 6);
      }
  });

  it("keeps the old framing when there is no band", () => {
    for (const action of ["idle", "victory"])
      for (const height of [260, 320, 400]) {
        const zoom = shopPreviewZoom(action, height);
        const artScale = scale * 0.5 * zoom;
        const screenY = height / 2 + (y - cameraY) * zoom;
        if (action === "idle")
          expect(previewViewBox(action, height)).toBe(
            [
              100 - SHOP_PREVIEW.x / artScale,
              130 - screenY / artScale,
              SHOP_PREVIEW.width / artScale,
              height / artScale,
            ].join(" "),
          );
      }
  });

  it("fits a whole entrance, victory or ultimate, top to floor, in any stage", () => {
    const from = y - PREVIEW_FX_TOP * scale,
      to = y + (WORLD_ART.fighterFeet + 13) * scale;
    for (const action of ["entrance", "victory", "ultimate"])
      for (const height of [200, 240, 260, 300, 320, 363, 420, 600])
        for (const top of [0, 41.5]) {
          expect(onCanvas(from, height, action, top)).toBeGreaterThanOrEqual(0);
          expect(onCanvas(to, height, action, top)).toBeLessThanOrEqual(height);
        }
  });

  it("doesn't shrink the fighter when the stage has room for the finale", () => {
    // A tall stage: the usual 0.78, the camera only moves.
    expect(shopPreviewCamera("victory", 600).zoom).toBeCloseTo(0.78, 9);
    // A phone at 852x393: as tall as before, moved down a little.
    const phone = shopPreviewCamera("victory", 363, 41.5);
    expect(phone.zoom).toBeCloseTo(shopPreviewZoom("victory", 363 - 41.5), 9);
    // A short stage: smaller, so all of it fits.
    expect(shopPreviewCamera("victory", 240).zoom).toBeLessThan(
      shopPreviewZoom("victory", 240),
    );
  });
});
