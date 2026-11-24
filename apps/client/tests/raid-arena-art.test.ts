import { afterEach, expect, it, vi } from "vitest";
import { GLOOMSHADE, handsTileDark } from "../../../packages/shared/src/raid";
import {
  loadRaidArenaArt,
  paintIllustratedRaidFloor,
  RAID_ARENA_ART,
} from "../src/raid-arena-art";
vi.mock("../src/arena-courts", () => ({ paintKit: { grain: vi.fn() } }));
afterEach(() => vi.unstubAllGlobals());
class ImageStub {
  static made: ImageStub[] = [];
  decoding = "";
  src = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    ImageStub.made.push(this);
  }
}
it("decodes only the requested floor and releases event handlers after painting", () => {
  ImageStub.made = [];
  vi.stubGlobal("Image", ImageStub);
  const paint = vi.fn();
  loadRaidArenaArt("lagoon", paint);
  expect(ImageStub.made).toHaveLength(1);
  const image = ImageStub.made[0];
  expect(image.src).toBe(RAID_ARENA_ART.lagoon);
  expect(paint).not.toHaveBeenCalled();
  image.onload!();
  expect(paint).toHaveBeenCalledWith(image);
  expect(image.onload).toBeNull();
  expect(image.onerror).toBeNull();
});
it("leaves the working fallback alone if the floor image cannot load", () => {
  ImageStub.made = [];
  vi.stubGlobal("Image", ImageStub);
  const paint = vi.fn();
  loadRaidArenaArt("cloud-deck", paint);
  const image = ImageStub.made[0];
  image.onerror!();
  expect(paint).not.toHaveBeenCalled();
  expect(image.onload).toBeNull();
  expect(image.onerror).toBeNull();
});
it("keeps the painted checkerboard aligned with the actual Grasping Hands tiles", () => {
  const fills: { color: string; rect: number[] }[] = [];
  const target: any = {
    fillStyle: "",
    fillRect(...rect: number[]) {
      fills.push({ color: this.fillStyle, rect });
    },
  };
  const c = new Proxy(target, {
    get(o, key) {
      return o[key] ?? (() => {});
    },
  }) as CanvasRenderingContext2D;
  paintIllustratedRaidFloor(c, "lantern-yard", {} as HTMLImageElement);
  const { cols, rows } = GLOOMSHADE.hands,
    tw = 1600 / cols,
    th = 900 / rows;
  const cells = fills.filter((f) => f.rect[2] === tw && f.rect[3] === th);
  expect(cells).toHaveLength(cols * rows);
  for (const {
    color,
    rect: [x, y],
  } of cells)
    expect(color === "#c3b9f31c").toBe(
      handsTileDark(x + tw / 2, y + th / 2, 0),
    );
});
