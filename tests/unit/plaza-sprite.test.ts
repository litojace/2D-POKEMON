import { describe, expect, it } from "vitest";
import { FIGHTER_IDS } from "@arena/shared";
import { fighterArt } from "../../apps/client/src/fighter-art";
import { SKIN_ART } from "../../apps/client/src/skins/skin-art";
import {
  SPRITE_H,
  SPRITE_W,
  masksFailed,
  spilledPixels,
} from "../../apps/client/src/plaza/plaza-sprite";

// Desktop Safari painted the masked overlays of fighters drawn into the
// Plaza's canvas as dark rectangles. The Plaza compares the full drawing
// with the flat one and falls back to the flat one when paint spills out.

/** An RGBA buffer of the sprite's size, alpha 255 inside the given boxes. */
const alpha = (...boxes: [number, number, number, number][]) => {
  const d = new Uint8ClampedArray(SPRITE_W * SPRITE_H * 4);
  for (const [x0, y0, x1, y1] of boxes)
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) d[(y * SPRITE_W + x) * 4 + 3] = 255;
  return d;
};
const overlayMasks = (svg: string) =>
  (svg.match(/mask="url\(#[^)"]*-(?:m|surface)-[^)"]*\)"/g) ?? []).length;

describe("Plaza fighter sprites", () => {
  it("keeps the full drawing when the overlays stay inside the fighter", () => {
    const body = alpha([60, 40, 140, 190]);
    expect(spilledPixels(body, body)).toBe(0);
    expect(masksFailed(body, body)).toBe(false);
    // A sliver of anti-aliasing is not a failure.
    const fringe = alpha([60, 40, 140, 190], [140, 40, 141, 70]);
    expect(masksFailed(fringe, body)).toBe(false);
  });

  it("notices rectangles painted outside the fighter (failed masks)", () => {
    const flat = alpha([60, 40, 140, 190]);
    // The head's mask drawn as its bounding box, wider than the body.
    const boxed = alpha([60, 40, 140, 190], [40, 10, 160, 80]);
    expect(spilledPixels(boxed, flat)).toBeGreaterThan(1000);
    expect(masksFailed(boxed, flat)).toBe(true);
  });

  it("draws every fighter and skin flat without masked overlays, and only those go", () => {
    const looks = (id: string) => [
      null,
      ...Object.keys(SKIN_ART)
        .filter((skin) => skin.startsWith(`${id}-`))
        .map((skin) => ({ skin, stage: 3 })),
    ];
    let patterned = 0;
    for (const id of FIGHTER_IDS)
      for (const look of looks(id)) {
        const full = fighterArt(id, undefined, look);
        const flat = fighterArt(id, undefined, look, true);
        const label = `${id} ${look?.skin ?? "original"}`;
        expect(overlayMasks(full), label).toBeGreaterThan(0);
        expect(overlayMasks(flat), label).toBe(0);
        expect(flat, label).not.toContain("<pattern");
        // Everything else (accessories, awakenings, the face) is still drawn.
        for (const part of ["skin-accessory", "skin-awakening", "fighter-face"])
          expect(flat.split(part).length, `${label} ${part}`).toBe(
            full.split(part).length,
          );
        if (/-m-/.test(full)) patterned++;
      }
    expect(patterned).toBeGreaterThan(10);
  });
});
