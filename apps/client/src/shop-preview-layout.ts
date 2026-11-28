import { GROUND_FLAT } from "./ground";
import { WORLD_ART } from "../../../packages/shared/src/world-art";
import { auraScale } from "./aura-size";
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

/**
 * How far above the rig's centre an entrance, victory or ultimate plays, in
 * the rig's own units (times its scale): the tallest finales reach about
 * 146 (Meteor victory's sky, Trophy victory's glow at 142, a disco ball
 * dropping in from 150). Particles that fly on past it may leave the frame.
 */
export const PREVIEW_FX_TOP = 150;
/** Below the rig's centre: the feet (21) and the floor ring under them. */
const PREVIEW_FX_BOTTOM = WORLD_ART.fighterFeet + 13;
/** A little room inside the stage's edge, in the same units. */
const PREVIEW_FX_MARGIN = 6;

/**
 * The Shop's live preview camera: its zoom and the world y the canvas is
 * centred on, for a canvas `height` viewport units tall (400 wide).
 *
 * `top` is a band at the canvas's top, in viewport units, that the fighter
 * keeps clear of (a phone's Entrance and Victory buttons stand there): the
 * canvas covers the whole stage, so an effect reaches its top edge, and the
 * fighter is framed in the part below the band, as it was when the canvas
 * itself was moved down (it left that band empty: a finale was cut off in a
 * straight line, owner, 26 Nov).
 *
 * An entrance, victory or ultimate also fits everything it plays, from
 * PREVIEW_FX_TOP above the fighter to the floor under its feet, inside the
 * whole canvas: the camera moves up for it, and zooms out if the canvas is
 * too short for it (the trophy of Trophy victory rose out of the frame).
 */
export function shopPreviewCamera(action: string, height: number, top = 0) {
  const { y, scale, cameraY } = SHOP_PREVIEW;
  const below = Math.max(1, height - top);
  let zoom = shopPreviewZoom(action, below);
  // The fighter as it stood in the canvas below the band.
  let centerY = cameraY - top / (2 * zoom);
  if (previewZoom(action) < 1) {
    const from = y - (PREVIEW_FX_TOP + PREVIEW_FX_MARGIN) * scale,
      to = y + (PREVIEW_FX_BOTTOM + PREVIEW_FX_MARGIN) * scale;
    zoom = Math.min(zoom, height / (to - from));
    const half = height / (2 * zoom);
    // As close to where the fighter stood as keeps all of it in view.
    centerY = Math.min(Math.max(centerY, to - half), from + half);
  }
  return { zoom, centerY };
}

/** The stage's --fit-drop in px (a phone's band for Entrance and Victory,
 *  fitting-room.css), or 0 where it has none. Read on resize, never in a
 *  frame loop. */
export const fitDrop = (host: Element) =>
  typeof getComputedStyle === "function"
    ? parseFloat(getComputedStyle(host).getPropertyValue("--fit-drop")) || 0
    : 0;

/** The rig uses half-size art anchored at (100, 130) in source SVG units. */
export function previewViewBox(
  action: string,
  height: number = SHOP_PREVIEW.height,
  top = 0,
) {
  const { width, x, y, scale } = SHOP_PREVIEW;
  const { zoom, centerY } = shopPreviewCamera(action, height, top);
  const artScale = scale * 0.5 * zoom;
  const screenY = height / 2 + (y - centerY) * zoom;
  return [
    100 - x / artScale,
    130 - screenY / artScale,
    width / artScale,
    height / artScale,
  ].join(" ");
}

// The aura's size is set in one place for the whole game (aura-size.ts).
export { AURA_ART_SCALE, battleAuraScale } from "./aura-size";
/**
 * Auras lie on the same plane as the shadow (GROUND_FLAT), sized to the
 * fighter as in the Lobby (AURA_ART_SCALE), and the whole projected aura
 * stays inside the frame.
 */
export function previewAuraScale(
  frame: {
    height: number;
    y: number;
    scale: number;
  },
  flat: number = GROUND_FLAT,
) {
  const feet = frame.y + WORLD_ART.fighterFeet * frame.scale;
  return Math.min(
    // The rig draws its art at half the framing's scale.
    auraScale(frame.scale * 0.5),
    Math.max(0.1, ((frame.height - feet - 12) * 2) / (128 * flat)),
  );
}
