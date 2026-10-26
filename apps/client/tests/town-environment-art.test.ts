import { expect, it } from "vitest";
import {
  ANIMAL_FRAMES,
  NATURE_FRAMES,
  PROP_FRAMES,
  paintedAnimal,
  paintedNature,
  paintedProp,
} from "../src/town-environment-art";
import { treeCanopy, shrubSprite, type Sprite } from "../src/town-art";
import { duckSprite, dogSprite, gullSprite } from "../src/town-animals";
import { propSprite } from "../src/town-props";
it("keeps source crops inside the shipped illustrations", () => {
  for (const [frames, w, h] of [
    [NATURE_FRAMES, 1254, 1254],
    [Object.values(PROP_FRAMES), 1254, 1254],
    [ANIMAL_FRAMES, 1448, 1086],
  ] as const)
    for (const [x, y, cw, ch] of frames) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + cw).toBeLessThanOrEqual(w);
      expect(y + ch).toBeLessThanOrEqual(h);
    }
});
it("fits new art inside the existing clearance-safe frames, including centred fliers", () => {
  const source = {} as CanvasImageSource,
    frames: Sprite[] = [
      paintedNature(source, "crown", 3, treeCanopy(3)),
      paintedNature(source, "bush", 1, shrubSprite("bush", 1)),
      paintedProp(source, "board", propSprite("board")),
      paintedProp(source, "lamp", propSprite("lamp")),
      paintedAnimal(source, "duck", "swim", 0, false, duckSprite("swim")),
      paintedAnimal(source, "gull", "fly", 0, false, gullSprite(0)),
      paintedAnimal(source, "dog", "walk", 1, false, dogSprite("walk", 1)),
    ];
  for (const s of frames) {
    const calls: number[][] = [];
    const ctx = {
      save() {},
      restore() {},
      beginPath() {},
      rect() {},
      clip() {},
      drawImage(...args: any[]) {
        calls.push(args.slice(5));
      },
    } as unknown as CanvasRenderingContext2D;
    s.draw(ctx);
    for (const [x, y, w, h] of calls) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(s.w + 0.01);
      expect(y + h).toBeLessThanOrEqual(s.h + 0.01);
    }
  }
});
