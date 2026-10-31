import type Phaser from "phaser";
import { addCanvasTexture } from "./canvas-texture";

/** A Graphics' local box to paint (x, y, width, height). */
export interface BakeBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}
// Phaser's Graphics command codes (gameobjects/graphics/Commands.js).
const TRANSLATE = 16,
  SCALE = 17;

/**
 * Paint a Graphics once into a picture and show the picture instead.
 *
 * Phaser replays every Graphics command each frame and re-triangulates
 * every filled shape, even when nothing changed; a still fountain is
 * hundreds of shapes. This draws the commands once on a canvas (at `res`
 * pixels per world unit, so zooming in stays sharp), adds it as an image at
 * the same place and depth, and hides the Graphics. The canvas is uploaded
 * without reading it back (see canvas-texture.ts).
 */
export function bakeGraphics(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  key: string,
  bounds: BakeBounds,
  res = 2,
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(bounds.w * res));
  canvas.height = Math.max(1, Math.ceil(bounds.h * res));
  // The local box's corner at the canvas origin, `res` pixels per unit.
  const commands = g.commandBuffer as number[];
  commands.unshift(SCALE, res, res, TRANSLATE, -bounds.x, -bounds.y);
  g.generateTexture(canvas, canvas.width, canvas.height);
  commands.splice(0, 6);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  addCanvasTexture(scene.textures, key, canvas);
  g.setVisible(false);
  return scene.add
    .image(g.x + bounds.x, g.y + bounds.y, key)
    .setOrigin(0)
    .setScale(1 / res)
    .setDepth(g.depth);
}

/** Does a box in world units overlap what the camera shows (with a margin)? */
export function inView(
  cam: Phaser.Cameras.Scene2D.Camera,
  x: number,
  y: number,
  w: number,
  h: number,
  margin = 120,
) {
  const v = cam.worldView;
  // Before the first render the view is empty: treat everything as visible.
  if (!v.width || !v.height) return true;
  return (
    x + w > v.x - margin &&
    x < v.right + margin &&
    y + h > v.y - margin &&
    y < v.bottom + margin
  );
}
