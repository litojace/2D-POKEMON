import {
  WORLD_ART,
  groundHeight,
} from "../../../packages/shared/src/world-art";
/** Shared framing for the static loading art and the battle rig. */
export const SHOP_PREVIEW = {
  width: 400,
  height: 260,
  x: 200,
  y: 154,
  scale: 2.1,
  cameraY: 110,
} as const;

/** The fighter select keeps its padded SVG frame (-20 -40 240 250), at two pixels per art unit. */
export const SELECTION_PREVIEW = {
  width: 480,
  height: 500,
  x: 240,
  y: 340,
  scale: 4,
  cameraY: 250,
} as const;

export function previewZoom(action: string) {
  return action === "entrance" || action === "victory" ? 0.78 : 1;
}

/** Full-height preview cameras reserve breathing room for ears and crests. */
export function shopPreviewZoom(action: string, height: number) {
  return previewZoom(action) * Math.min(1, height / 320);
}

/** The rig uses half-size art anchored at (100, 130) in source SVG units. */
export function previewViewBox(
  action: string,
  height: number = SHOP_PREVIEW.height,
) {
  const { width, x, y, scale, cameraY } = SHOP_PREVIEW;
  const zoom = shopPreviewZoom(action, height);
  const artScale = scale * 0.5 * zoom;
  const screenY = height / 2 + (y - cameraY) * zoom;
  return [
    100 - x / artScale,
    130 - screenY / artScale,
    width / artScale,
    height / artScale,
  ].join(" ");
}

/** Keep the whole projected aura inside the frame, beneath the same foot line. */
export function previewAuraScale(frame: {
  height: number;
  y: number;
  scale: number;
}) {
  const feet = frame.y + WORLD_ART.fighterFeet * frame.scale;
  return Math.min(
    frame.scale / 1.2,
    Math.max(0.1, ((frame.height - feet - 12) * 2) / groundHeight(128)),
  );
}
