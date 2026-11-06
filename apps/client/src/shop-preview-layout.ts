import { WORLD_ART } from "../../../packages/shared/src/world-art";
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
  // Room for what plays around the fighter (an ultimate's sword or sun).
  return action === "entrance" || action === "victory" || action === "ultimate"
    ? 0.78
    : 1;
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

/** The fitting room's contact shadow at the fighter's feet, in canvas pixels. */
export const SHOP_SHADOW = { width: 128, height: 26 } as const;
/** Ground plane of the fitting room: the shadow's own flatness. */
export const SHOP_GROUND_FLAT = SHOP_SHADOW.height / SHOP_SHADOW.width;

/**
 * Auras lie on the same plane as the shadow (SHOP_GROUND_FLAT), a ring wider
 * than it, and the whole projected aura stays inside the frame.
 */
export function previewAuraScale(
  frame: {
    height: number;
    y: number;
    scale: number;
  },
  flat: number = SHOP_GROUND_FLAT,
) {
  const feet = frame.y + WORLD_ART.fighterFeet * frame.scale;
  return Math.min(
    frame.scale / 1.2,
    Math.max(0.1, ((frame.height - feet - 12) * 2) / (128 * flat)),
  );
}
