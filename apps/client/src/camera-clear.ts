/**
 * The battle camera's background colour as the canvas's clear colour, not
 * as a full-screen rectangle.
 *
 * Phaser clears the canvas to the game's background colour every frame and
 * then, for a camera with a background colour, draws that colour again as
 * a rectangle over the whole camera: a blended full-screen pass the court's
 * floor then covers. In a raid it was a third of all the pixels drawn each
 * frame (Gloomshade's Lantern Yard: 1.0 of 3.3 screens; a duel or
 * Grumblecrag: 1.0 of 2.3), and on a phone every one of those pixels costs
 * the graphics chip time (docs/network-performance.md, section 17).
 *
 * The clear already fills every pixel, so clearing with the camera's colour
 * and skipping its rectangle draws exactly the same picture. The camera keeps
 * its colour between frames (it is only switched off while Phaser renders),
 * so code that reads or changes it behaves as before.
 */

/** Phaser's Color, as far as this needs it. */
export interface BackdropColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
  setTo(red: number, green: number, blue: number, alpha?: number): unknown;
}
/** A Phaser camera, as far as this needs it. */
export interface BackdropCamera {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  mask: unknown;
  backgroundColor: BackdropColor;
}

/**
 * Before this frame's clear: when `camera` paints an opaque background over
 * the whole `width` × `height` canvas, make it the clear colour and switch
 * the camera's own fill off for the frame. Returns how to put the camera
 * back after rendering, or undefined when nothing changed (no camera, a
 * camera that leaves part of the canvas uncovered, a see-through or masked
 * background: Phaser draws those as before).
 */
export function takeCameraBackdrop(
  camera: BackdropCamera | undefined,
  clear: BackdropColor,
  width: number,
  height: number,
): (() => void) | undefined {
  if (!camera || !camera.visible || camera.mask) return undefined;
  const color = camera.backgroundColor;
  if (color.alpha !== 255) return undefined;
  if (
    camera.x > 0 ||
    camera.y > 0 ||
    camera.x + camera.width < width ||
    camera.y + camera.height < height
  )
    return undefined;
  clear.setTo(color.red, color.green, color.blue, 255);
  color.alpha = 0;
  return () => {
    color.alpha = 255;
  };
}

/**
 * Wire `takeCameraBackdrop` into a Phaser game's renderer: `camera` is the
 * camera rendered first (the battle has one scene with one camera). Call
 * once, from the game config's `postBoot`. (Phaser 3.90's bundled build
 * leaves its "prerenderclear" event out, so this wraps the renderer's
 * preRender, which clears, and postRender, after every camera is drawn.)
 */
export function clearWithCameraBackdrop(
  renderer: {
    config?: { backgroundColor?: BackdropColor };
    width: number;
    height: number;
    preRender(): void;
    postRender(...args: unknown[]): void;
  },
  camera: () => BackdropCamera | undefined,
) {
  const clear = renderer.config?.backgroundColor;
  if (!clear) return;
  let restore: (() => void) | undefined;
  const putBack = () => {
    restore?.();
    restore = undefined;
  };
  const preRender = renderer.preRender.bind(renderer),
    postRender = renderer.postRender.bind(renderer);
  renderer.preRender = () => {
    putBack();
    restore = takeCameraBackdrop(
      camera(),
      clear,
      renderer.width,
      renderer.height,
    );
    preRender();
  };
  renderer.postRender = (...args: unknown[]) => {
    try {
      postRender(...args);
    } finally {
      putBack();
    }
  };
}
