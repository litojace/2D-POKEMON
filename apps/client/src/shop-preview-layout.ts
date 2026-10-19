/** Shared framing for the static loading art and the battle rig. */
export const SHOP_PREVIEW = {
  width: 400,
  height: 260,
  x: 200,
  y: 174,
  scale: 1.8,
  cameraY: 130,
} as const;

export function previewZoom(action: string) {
  return action === "entrance" || action === "victory" ? 0.78 : 1;
}

/** The rig uses half-size art anchored at (100, 130) in source SVG units. */
export function previewViewBox(action: string) {
  const { width, height, x, y, scale, cameraY } = SHOP_PREVIEW;
  const zoom = previewZoom(action);
  const artScale = scale * 0.5 * zoom;
  const screenY = height / 2 + (y - cameraY) * zoom;
  return [100 - x / artScale, 130 - screenY / artScale, width / artScale, height / artScale].join(" ");
}
