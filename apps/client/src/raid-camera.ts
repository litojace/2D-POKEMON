import type { CameraView } from "./follow-camera";

/** Fit the entire raid below its HUD, uniformly and without following a raider. */
export function raidCameraView(
  width: number,
  height: number,
  hudBottom = 0,
): CameraView {
  width = Math.max(1, width);
  height = Math.max(1, height);
  const top = Math.max(0, Math.min(height - 1, hudBottom));
  const zoom = Math.min(width / 1600, (height - top) / 900);
  return {
    x: 800,
    y: 450 - top / (2 * zoom),
    zoomX: zoom,
    zoomY: zoom,
    fighterX: 1,
    fighterY: 1,
  };
}
