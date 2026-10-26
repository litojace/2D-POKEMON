import { expect, it } from "vitest";
import { TOWN_BUILDINGS } from "../../../packages/shared/src/town";
import {
  architectureName,
  nativeBuilding,
  paintedBuilding,
} from "../src/town-architecture";
import { TOWN_HD } from "../src/town-hd-assets";
import { paintedNature } from "../src/town-environment-art";
import { paintedFountain, treeCanopy } from "../src/town-art";

it("maps every building kind to a shipped HD source, including the temple", () => {
  for (const building of TOWN_BUILDINGS)
    expect(TOWN_HD[architectureName(building)]).toBeTruthy();
});

it("keeps the same doorstep and footprint when replacing baked architecture with source frames", () => {
  const source = {
    naturalWidth: 1024,
    naturalHeight: 1024,
  } as HTMLImageElement;
  for (const b of TOWN_BUILDINGS) {
    const old = paintedBuilding(source, b),
      native = nativeBuilding(source, b, "hd");
    const [x, y, w, h] = native.sprite.nativeImage!.rect;
    expect(native.sprite.ax).toBe(old.sprite.ax);
    expect(native.sprite.ay).toBe(old.sprite.ay);
    expect(w).toBeCloseTo(old.sprite.w - 96);
    expect(h).toBeCloseTo(old.sprite.h - 96);
    expect(x - native.sprite.ax).toBeCloseTo(48 - old.sprite.ax);
    expect(y - native.sprite.ay).toBeCloseTo(48 - old.sprite.ay);
  }
});
it("shares fountain pixels between the base and clipped upper pass", () => {
  const source = {
    naturalWidth: 1402,
    naturalHeight: 1122,
  } as HTMLImageElement;
  const a = paintedFountain(source, false),
    b = paintedFountain(source, true);
  expect(a.nativeImage!.crop).toEqual(b.nativeImage!.crop);
  expect(a.nativeImage!.rect).toEqual(b.nativeImage!.rect);
  expect(a.ax).toBe(b.ax);
  expect(a.ay).toBe(b.ay);
  expect(b.nativeImage!.clip!.length).toBeGreaterThan(10);
});
it("reuses the exact painted tree rectangle without shrinking its source image", () => {
  const sprite = paintedNature(
      {} as CanvasImageSource,
      "crown",
      0,
      treeCanopy(0),
    ),
    calls: any[][] = [];
  const ctx = {
    save() {},
    restore() {},
    drawImage(...args: any[]) {
      calls.push(args);
    },
  } as unknown as CanvasRenderingContext2D;
  sprite.draw(ctx);
  expect(sprite.nativeImage!.crop).toEqual(calls[0].slice(1, 5));
  expect(sprite.nativeImage!.rect).toEqual(calls[0].slice(5));
});
