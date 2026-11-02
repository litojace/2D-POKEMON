import Phaser from "phaser";

/**
 * `Graphics.generateTexture` draws through one static camera shared by every
 * game (`Phaser.GameObjects.Graphics.TargetCamera`). Each bake pushes the
 * Graphics onto that camera's render list, which nothing ever empties, and
 * the camera keeps the last scene. Every battle or town that baked a
 * texture therefore stayed in memory with its whole renderer after it closed
 * (about 6 MB per battle, measured). Bake through this helper instead.
 */
export function generateGraphicsTexture(
  g: Phaser.GameObjects.Graphics,
  key: string | HTMLCanvasElement,
  width: number,
  height: number,
) {
  try {
    g.generateTexture(key, width, height);
  } finally {
    releaseBakeCamera();
  }
}

/** Drop the shared bake camera's references to game objects and scenes. */
export function releaseBakeCamera() {
  const camera = (
    Phaser.GameObjects.Graphics as unknown as {
      TargetCamera?: {
        renderList: unknown[];
        scene?: unknown;
        sceneManager?: unknown;
        scaleManager?: unknown;
        cameraManager?: unknown;
      };
    }
  ).TargetCamera;
  if (!camera) return;
  camera.renderList.length = 0;
  camera.scene = undefined;
  camera.sceneManager = undefined;
  camera.scaleManager = undefined;
  camera.cameraManager = undefined;
}
