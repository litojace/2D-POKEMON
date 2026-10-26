import Phaser from "phaser";
import { TOWN_ART } from "../../../apps/client/src/town-assets";
import {
  paintedFountain,
  type Sprite,
} from "../../../apps/client/src/town-art";
import { drawFountainCrystal } from "../../../apps/client/src/town-fountain-crystal";
import { drawFountainWater } from "../../../apps/client/src/town-fountain-water";

/** Isolate the real stone/water layers so motion checks don't measure trees. */
export function fountainReview() {
  let back: Phaser.GameObjects.Graphics, front: Phaser.GameObjects.Graphics;
  let crystal: Phaser.GameObjects.Graphics;
  let ready!: () => void;
  const loaded = new Promise<void>((resolve) => {
    ready = resolve;
  });
  class Review extends Phaser.Scene {
    preload() {
      this.load.image("fountain-art", TOWN_ART.fountain);
    }
    create() {
      const source = this.textures
        .get("fountain-art")
        .getSourceImage() as HTMLImageElement;
      const place = (key: string, sprite: Sprite, depth: number) => {
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(sprite.w * 2);
        canvas.height = Math.ceil(sprite.h * 2);
        const ctx = canvas.getContext("2d")!;
        ctx.scale(2, 2);
        sprite.draw(ctx);
        this.textures.addCanvas(key, canvas);
        this.add
          .image(0, 0, key)
          .setOrigin(sprite.ax / sprite.w, sprite.ay / sprite.h)
          .setScale(0.5)
          .setDepth(depth);
      };
      place("basin", paintedFountain(source, false), 0);
      back = this.add.graphics().setDepth(1);
      place("column", paintedFountain(source, true), 2);
      front = this.add.graphics().setDepth(3);
      crystal = this.add.graphics().setDepth(4);
      this.cameras.main.setZoom(2).centerOn(0, -70);
      drawFountainWater(back, front, 0, 0, 0, false);
      drawFountainCrystal(crystal, 0, 0, 0, false);
      ready();
    }
  }
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    width: 640,
    height: 640,
    backgroundColor: "#182329",
    scene: [Review],
    audio: { noAudio: true },
    banner: false,
    fps: { target: 30 },
  });
  return {
    loaded,
    draw(t: number, reduced = false) {
      drawFountainWater(back, front, 0, 0, t, reduced);
      drawFountainCrystal(crystal, 0, 0, t, reduced);
    },
    destroy() {
      game.destroy(true);
    },
  };
}
