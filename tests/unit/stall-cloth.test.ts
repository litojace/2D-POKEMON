import { describe, expect, it } from "vitest";
import { recolorCloth } from "../../apps/client/src/town-architecture";

const px = (...rgba: number[]) => new Uint8ClampedArray(rgba);
const hue = ([r, g, b]: ArrayLike<number>) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

describe("market stall cloth colours", () => {
  it("turns the red awning teal and keeps its shading", () => {
    const light = px(220, 60, 50, 255), dark = px(130, 30, 28, 255);
    recolorCloth(light, { hue: 185, sat: 1, val: 1 });
    recolorCloth(dark, { hue: 185, sat: 1, val: 1 });
    expect(hue(light)).toBeCloseTo(185, -1);
    expect(hue(dark)).toBeCloseTo(185, -1);
    // Lighter cloth stays lighter than its shadowed folds.
    expect(Math.max(...light.slice(0, 3))).toBeGreaterThan(Math.max(...dark.slice(0, 3)));
  });
  it("leaves cream stripes, wood, the lantern, the blue curtain and empty pixels alone", () => {
    for (const color of [
      [236, 222, 196, 255], // cream stripe
      [150, 96, 52, 255], // wood
      [255, 196, 70, 255], // lantern glow
      [40, 90, 140, 255], // blue curtain
      [200, 40, 40, 0], // transparent
      [40, 8, 8, 255], // near black
    ]) {
      const p = px(...color);
      recolorCloth(p, { hue: 42, sat: 1, val: 1.05 });
      expect(Array.from(p)).toEqual(color);
    }
  });
});
